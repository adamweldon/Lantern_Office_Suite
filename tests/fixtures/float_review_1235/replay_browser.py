#!/usr/bin/env python3
"""replay_browser.py -- the review of 1.24.35's float switches: the ladders of render_inputs.js drawn in Chromium
(Playwright), by the built page (site/index.html: run `python3 tools/build_site.py` first if src changed) and by 1.24.34
as released (git show 1e318a5:site/index.html, written to <out dir>/old_site), side by side.

For each input it saves <id>-new.png and <id>-old.png (the ladder's own preview canvas, as Chat shows it) and each
process switch (float, pressure, temperature) drawn at 3x by Lantern's renderer, <id>-<tag>-<n>-new.png / -old.png, and prints the files.
How a drawing looks to a person is Adam's to judge; this only makes the pictures to look at.
Usage: python3 tests/fixtures/float_review_1235/replay_browser.py <out dir> [port]
"""
import base64, functools, json, os, subprocess, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "png")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8361
os.makedirs(OUT, exist_ok=True)
OLD_SITE = os.path.join(OUT, "old_site")
os.makedirs(OLD_SITE, exist_ok=True)
for f in ("index.html", "lantern-sw.js"):
    with open(os.path.join(OLD_SITE, f), "wb") as fh:
        fh.write(subprocess.check_output(["git", "show", "1e318a5:site/" + f], cwd=ROOT))
INPUTS = json.loads(subprocess.check_output(["node", os.path.join(HERE, "render_inputs.js")]))


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(d, port):
    srv = ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=d))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


JS = r"""
([text, q]) => {
  const m = Lantern.aiAct.build(text, q);
  const out = { ok: !!m.ok, problems: m.problems || [], png: null, procs: [] };
  const v = m.views && m.views.control ? m.views.control : m;
  let cv = null;
  try { const c = v.preview && v.preview(); cv = c && (c.toDataURL ? c : c.querySelector && c.querySelector("canvas")); } catch (e) { out.err = String(e); }
  if (cv) out.png = cv.toDataURL("image/png");
  // the process switches: their tags (12 px text) and where the symbol is
  const flat = []; (function walk(s) { (Array.isArray(s) ? s : [s]).forEach(x => { if (!x) return; if (x.t === "group") walk(x.shapes); else flat.push(x); }); })(v.shapes || []);
  const c = m.plan && (m.plan.circuit || (m.plan.views && m.plan.views.control && m.plan.views.control.circuit));
  const kinds = {};
  if (c) c.rungs.forEach(r => ["stops", "starts", "series", "after"].forEach(k => (r[k] || []).forEach(e => { kinds[e.id] = e.kind; })) || (r.branches || []).forEach(b => b.forEach(e => { kinds[e.id] = e.kind; })));
  if (c) c.rungs.forEach(r => (r.branches || []).forEach(b => b.forEach(e => { kinds[e.id] = e.kind; })));
  flat.forEach(t => {
    if (t.t !== "text" || t.fs !== 12 || !/^(float|pressure|temp)$/.test(kinds[t.s] || "")) return;
    // the tag is 34 above the symbol, or (in a branch row) 30 under it: the blade starts 11 left of the symbol's centre
    const above = flat.some(s => s.t === "path" && s.pts && s.pts.length === 2 && Math.abs(s.pts[0][0] - (t.x - 11)) < 0.5 && Math.abs(s.pts[0][1] - (t.y + 34)) < 0.5);
    out.procs.push({ id: t.s, x: t.x, y: above ? t.y + 34 : t.y - 30 });
  });
  if (cv) { out.w = cv.width; out.h = cv.height; }
  // each process switch at 3x, drawn by Lantern's own renderer (Draw's), 100 x 100 drawing units around it
  out.crops = out.procs.map(pr => {
    const k = 3, cw = document.createElement("canvas"); cw.width = 100 * k; cw.height = 100 * k;
    const ctx = cw.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw.width, cw.height);
    ctx.save(); ctx.scale(k, k); ctx.translate(-(pr.x - 50), -(pr.y - 46));
    (v.shapes || []).forEach(s => Lantern.drawShapes.render(ctx, s)); ctx.restore();
    return cw.toDataURL("image/png");
  });
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    srvs = [serve(os.path.join(ROOT, "site"), PORT), serve(OLD_SITE, PORT + 1)]
    for tag, port in (("new", PORT), ("old", PORT + 1)):
        pg = b.new_page(viewport={"width": 1400, "height": 1000})
        pg.goto("http://127.0.0.1:%d/index.html" % port)
        pg.wait_for_function("window.Lantern && window.Lantern.aiAct && window.Lantern.ladderSym", timeout=60000)
        ver = pg.evaluate("Lantern.version")
        print("%s: Lantern %s" % (tag, ver))
        for it in INPUTS:
            r = pg.evaluate(JS, [it["text"], it["q"]])
            if not r["png"]:
                print("  %s: no drawing (ok=%s) %s" % (it["id"], r["ok"], "; ".join(r["problems"])[:300]))
                continue
            f = os.path.join(OUT, "%s-%s.png" % (it["id"], tag))
            with open(f, "wb") as fh:
                fh.write(base64.b64decode(r["png"].split(",", 1)[1]))
            print("  %s ok=%s %dx%d -> %s" % (it["id"], r["ok"], r.get("w", 0), r.get("h", 0), f))
            seen = {}
            for pr, url in zip(r["procs"], r.get("crops", [])):
                n = seen.get(pr["id"], 0) + 1
                seen[pr["id"]] = n
                g = os.path.join(OUT, "%s-%s-%d-%s.png" % (it["id"], pr["id"], n, tag))
                with open(g, "wb") as fh:
                    fh.write(base64.b64decode(url.split(",", 1)[1]))
                print("     " + g)
        pg.close()
    b.close()
    for s in srvs:
        s.shutdown()

# contact sheets: each process switch at 3x, the draft on the left and 1.24.34 on the right (Pillow, if it is there)
try:
    from PIL import Image, ImageDraw
    import glob
    pairs = []
    for it in INPUTS:
        for f in sorted(glob.glob(os.path.join(OUT, it["id"] + "-*-*-new.png"))):
            o = f[:-8] + "-old.png"
            if os.path.exists(o):
                pairs.append((f, o))
    for k in range(0, len(pairs), 6):
        rs = pairs[k:k + 6]
        im = Image.new("RGB", (610, 316 * len(rs)), "white")
        d = ImageDraw.Draw(im)
        for i, (a, b) in enumerate(rs):
            y = i * 316
            d.text((4, y + 1), os.path.basename(a)[:-8] + "   (draft | 1.24.34)", fill="black")
            im.paste(Image.open(a), (0, y + 14))
            im.paste(Image.open(b), (310, y + 14))
        g = os.path.join(OUT, "sheet_%02d.png" % (k // 6))
        im.save(g)
        print("sheet " + g)
except ImportError:
    print("(no Pillow: no contact sheets)")
