#!/usr/bin/env python3
"""draw_log.py -- draw the pictures a model made, to look at them.

A score cannot show how a picture looks. The bench's log prints every MAKE
DRAWING block a model wrote, passed or not, between "=== DRAWINGS" and
"=== END DRAWINGS ===" (tools/bench_headless.py, from 1.24.7). This draws
each of them twice in a real browser, on the built site: as the model wrote
it (AI_DRAW alone), and as Lantern draws it now (everything Lantern does to
a block: AI_SCENE and the checks), with what Lantern said and questioned.

Usage:
  python3 tools/build_site.py
  python3 tools/draw_log.py <job.log | blocks.json> <outdir>

  <job.log>      a bench job's log (gh api .../actions/jobs/<id>/logs)
  <blocks.json>  or a list: [{"id": "...", "q": "the request", "reply": "MAKE DRAWING: ...\n...\nEND"}]

Written into <outdir>: <id>.png (as Lantern draws it), <id>-as-written.png,
and sheet.png: every picture, before and after, side by side.
Needs Playwright with Chromium, like tests/browser/.
"""
import base64, html, json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("DRAW_PORT", "8141"))

def rows_of(path):
    text = open(path, encoding="utf-8", errors="replace").read()
    if path.endswith(".json"):
        return json.loads(text)
    rows, on = [], False
    for line in text.split("\n"):
        t = re.sub(r"^\S+Z ", "", line)
        if "=== DRAWINGS" in t: on = True; continue
        if "=== END DRAWINGS" in t: on = False
        if on and "{" in t:
            try: rows.append(json.loads(t[t.index("{"):]))
            except ValueError: pass
    return rows

DRAW = """(a) => {
  var bs = Lantern.aiAct.find(a[0]).filter(function (b) { return b.action && b.action.id === 'drawing'; });
  if (!bs.length) return null;
  var raw = Lantern.aiDraw.picture({ lines: bs[0].lines, title: bs[0].title, closed: bs[0].closed }, a[1]), m = Lantern.aiAct.build(a[0], a[1]);
  return { title: bs[0].title, before: raw && raw.png ? raw.png() : null, after: m && m.png ? m.png() : null, ok: !!(m && m.ok), problems: (m && m.problems) || [],
    said: (m && m.plan && m.plan.said) || [] };
}"""

def main():
    if len(sys.argv) < 3:
        print(__doc__); return 2
    rows, out = rows_of(sys.argv[1]), sys.argv[2]
    os.makedirs(out, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    cells = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1000, "height": 800})
            pg.goto("http://127.0.0.1:%d/index.html" % PORT)
            pg.wait_for_function("!!(window.Lantern && Lantern.aiAct && Lantern.aiDraw)", timeout=30000)
            for i, r in enumerate(rows):
                rid = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(r.get("id") or r.get("name") or "picture-%d" % (i + 1)))
                for which in ("reply", "first"):
                    text = r.get(which) or (r.get("text") if which == "reply" else None)
                    if not text or "MAKE DRAWING" not in text:
                        continue
                    d = pg.evaluate(DRAW, [text, r.get("q") or ""])
                    if not d:
                        continue
                    name = rid + ("" if which == "reply" else "-first")
                    for key, suffix in (("after", ""), ("before", "-as-written")):
                        if d[key]:
                            open(os.path.join(out, name + suffix + ".png"), "wb").write(base64.b64decode(d[key].split(",")[1]))
                    verdict = "" if "pass" not in r else (" [the bench: passed]" if r["pass"] else " [the bench: failed -- %s]" % str(r.get("why") or "")[:160])
                    note = ("Lantern " + "; ".join(d["said"]) + ". " if d["said"] else "") + ("Questioned: " + "; ".join(d["problems"]) if d["problems"] else "")
                    cells.append((name + verdict, r.get("q") or "", d["before"], d["after"], note))
                    print("%-36s %s%s" % (name, "ok" if d["ok"] else "questioned", ("  | " + note[:200]) if note else ""))
            # the sheet: a page of the pictures, photographed
            body = "".join(
                "<div class=c><b>%s</b><br><i>%s</i><br><img src='%s'><img src='%s'><div class=n>%s</div></div>" %
                (html.escape(t), html.escape(q), bf or "", af or "", html.escape(n)) for t, q, bf, af, n in cells)
            pg.set_content("<style>body{font:12px system-ui;margin:10px;width:780px}.c{margin:0 0 14px}img{width:380px;height:228px;margin:4px 6px 0 0;border:1px solid #999}.n{color:#444}</style>"
                           "<p>Left: as the model wrote it. Right: as Lantern draws it.</p>" + body)
            pg.screenshot(path=os.path.join(out, "sheet.png"), full_page=True)
            b.close()
    finally:
        srv.terminate()
    print("%d pictures -> %s (sheet.png)" % (len(cells), out))
    return 0

if __name__ == "__main__":
    sys.exit(main())
