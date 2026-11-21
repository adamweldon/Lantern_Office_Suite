# replay_browser.py -- E: the lift station's drawings in a real browser (Chromium through Playwright), the third
# review of 1.24.30. Serves site/ on port 8339 (build it first: python3 tools/build_site.py), builds each block with
# Lantern.aiAct.build(...), saves it full size (<id>.png) and as Lantern's own png() gives it to a model that can see
# (<id>_as_the_model_sees_it.png, 720 px wide) to the folder in LANTERN_PNG_OUT (default: png/ beside this file), and measures every word on the drawing with the canvas's own font:
#   text on text   -- two labels whose boxes overlap (more than 2 px each way)
#   text cut off   -- a label running past the picture's edge
#   text on a line -- a label a drawn line runs through (listed; judged by eye, see findings.txt; a case names the
#                     crossings that are wrong when the PNG shows them so)
# Prints AGREE <id> or DISAGREE <id> <what> [harm] per case and last: <n> cases: <a> AGREE, <d> DISAGREE
# Usage: python3 tests/fixtures/liftstation_review3_1230/replay_browser.py
import json, os, sys, subprocess, time, base64
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.environ.get("LANTERN_PNG_OUT") or os.path.join(HERE, "png")
PORT = 8339
os.makedirs(OUT, exist_ok=True)
CQ = "Draw the control circuit for a typical 2 pump lift station with an alternating relay"
LQ = "Draw the float level positions in the wet well of a duplex lift station"
PQ = "Draw the plumbing schematic for a duplex sewage lift station"
def blk(kind, title, lines): return "MAKE %s: %s\n%s\nEND" % (kind, title, "\n".join(lines))
F4 = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"']
P2 = ['alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']
R35 = json.load(open(os.path.join(HERE, "..", "liftstation_1230", "run_35b.json")))["replies"]
# id, harm, question, block, what is right, crossings that are wrong (substrings of a "label | line" entry), more checks
CASES = [
  ("E-01", "high", CQ, blk("CONTROL", "Duplex pump station", ['supply "120 V AC"'] + F4 + P2 + ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red']),
   "The instructions' example: every label readable, none on another, none cut off.", []),
  ("E-02", "high", CQ, blk("CONTROL", "Duplex lift station with hand-off-auto, thermal and fault lights", ['float FS1 "Float Switch 1 - pumps off"', 'float FS2 "Float Switch 2 - lead pump on"', 'float FS3 "Float Switch 3 - lag pump on"', 'float FS4 "Float Switch 4 - high water alarm"'] + P2 +
     ['switch SS1 M1 "pump 1 hand-off-auto"', 'switch SS2 M2 "pump 2 hand-off-auto"', 'temp TS1 M1 nc "pump 1 motor high temperature"', 'temp TS2 M2 nc "pump 2 motor high temperature"', 'overload OL1 M1', 'overload OL2 M2', 'lamp LT4 OL1 "pump 1 overload tripped" red', 'lamp LT5 OL2 "pump 2 overload tripped" red', 'lamp LT1 M1 "pump 1 running" green']),
   "A long block (11 rungs, long labels): readable.", []),
  ("E-03", "high", "x", R35[1]["reply"], "The 35B's own control block: readable.", []),
  ("E-04", "high", PQ, blk("PIPING", "Lift station", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', 'header "4 in force main"', 'vent']),
   "The instructions' piping example: readable.", []),
  ("E-05", "high", "Draw the piping for a 4 pump lift station", blk("PIPING", "Four pump lift station", ['well "wet well, 12 ft diameter precast concrete"', 'inlet "18 in gravity sewer from the east interceptor"', 'pump P1 "submersible pump 1, 40 HP"', 'pump P2 "submersible pump 2, 40 HP"', 'pump P3 "submersible pump 3, 40 HP"', 'pump P4 "submersible pump 4, 40 HP"',
     'valve V1 P1 plug', 'valve V2 P2 plug', 'valve V3 P3 plug', 'valve V4 P4 plug', 'header "12 in ductile iron discharge header"', 'main "12 in force main to the treatment plant"', 'vent "6 in inverted J vent with screen"']),
   "Four pumps, long labels: readable.", []),
  ("E-06", "high", PQ, blk("PIPING", "Three inlets", ['well "wet well"', 'inlet "north 8 in PVC gravity sewer from Elm Street"', 'inlet "east 6 in PVC gravity sewer from the school"', 'inlet "south 10 in gravity sewer from the subdivision"', 'pump P1', 'pump P2',
     'check CV3 "force main check valve"', 'valve PV1 "plug valve on force main"', 'valve ARV1 "air release"', 'header "6 in discharge header"', 'main "6 in force main"']),
   "Three inlets and three valves on the force main: readable.", []),
  ("E-07", "medium", "Draw the plumbing schematic for a simplex sewage lift station", blk("PIPING", "Simplex", ['well "basin"', 'pump P1 "grinder pump"', 'header "2 in force main"']), "A simplex: readable.", []),
  ("E-08", "high", LQ, blk("LEVELS", "Wet well", ['well "wet well" 10 ft', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS4 "high level alarm" 5.5 ft', 'inlet "inlet invert" 6.5 ft']),
   "The instructions' levels example: readable, to scale.", []),
  ("E-09", "high", LQ, blk("LEVELS", "Wet well, depths", ['well "wet well" 20 ft deep', 'float FS1 "off" 18 ft below grade', 'float FS2 "lead on" 16.5 ft below grade', 'float FS3 "lag on" 15.5 ft below grade', 'float FS4 "high level alarm" 14.5 ft below grade', 'inlet "inlet invert" 13 ft below grade']),
   "Depths below grade (long height texts): readable.", []),
  ("E-10", "high", LQ, blk("LEVELS", "Wet well, elevations", ['floor el. 100.0 ft', 'float FS1 "pumps off" el. 101.5 ft', 'float FS2 "lead pump on" el. 102.5 ft', 'float FS3 "lag pump on" el. 103.5 ft', 'float FS4 "high water level alarm" el. 104.5 ft', 'inlet "inlet invert" el. 105.25 ft']),
   "Elevations with long labels: readable, none cut off.", []),
  ("E-11", "medium", LQ, blk("LEVELS", "Wet well, rim elevation", ['well "wet well" rim el. 110.0 ft', 'float FS1 "off" el. 101.5 ft', 'float FS2 "lead on" el. 102.5 ft', 'float FS3 "lag on" el. 103.5 ft', 'float FS4 "high level alarm" el. 104.5 ft']),
   "A rim elevation: the floats drawn apart, above the pumps, readable (F-14: the rim's elevation is read as the well's depth, and the floats are drawn in the bottom 18 px, through the pumps).", [],
   "levelsAbovePumps"),
  ("E-12", "high", LQ, blk("LEVELS", "Seven floats", ['float FS1 "low level alarm" 1 ft', 'float FS2 "redundant off" 1.5 ft', 'float FS3 "off" 2 ft', 'float FS4 "lead on" 2.5 ft', 'float FS5 "lag on" 3 ft', 'float FS6 "high level alarm" 3.5 ft', 'float FS7 "high high alarm" 4 ft']),
   "Seven floats 6 in apart: labels stepped apart, readable.", []),
  ("E-13", "medium", LQ, blk("LEVELS", "In order", ['pump P1 P2 P3 P4', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'inlet "8 in gravity sewer"']),
   "No heights, four pumps: readable.", []),
  ("E-14", "medium", LQ, blk("LEVELS", "Metric", ['well "wet well" 3,000 mm', 'float FS1 "off" 600 mm', 'float FS2 "lead on" 1,050 mm', 'float FS3 "lag on" 1,350 mm', 'float FS4 "high level alarm" 1,650 mm', 'inlet "inlet invert" 1,950 mm']),
   "Millimetres: readable.", []),
  ("E-15", "medium", "Draw a sump pump control with on and off floats and a high level alarm light", blk("CONTROL", "Sump", ['float FS1 M1 "off"', 'float FS2 M1 "on"', 'float FS3 LT1 "high level alarm"', 'coil M1 "sump pump"', 'lamp LT1 "high level alarm" red']),
   "A pump-down with the holding contact: readable.", []),
  ("E-16", "medium", LQ, blk("LEVELS", "Close floats", ['float FS1 "off" 2 ft', 'float FS2 "lead on" 2 ft 2 in', 'float FS3 "lag on" 2 ft 4 in', 'float FS4 "high level alarm" 2 ft 6 in', 'inlet "inlet invert" 2 ft 8 in']),
   "Floats 2 in apart and an inlet just above: labels stepped, the inlet's words clear of theirs.", []),
]
MEASURE = r"""
(args) => {
  const [text, q, name] = args;
  let r = window.Lantern.aiAct.build(text, q);
  // (1.24.31) a station question's block is read as MAKE STATION (AI_STATION): its own drawing of this block's kind
  if (r && r.plan && r.plan.mode === "station" && r.views) { const vk = { CONTROL: "control", PIPING: "piping", LEVELS: "levels", SCHEMATIC: "piping" }[String((/MAKE\s+([A-Z]+)/.exec(text) || [])[1])]; const sub = r.views[vk]; if (sub) r = Object.assign({}, sub, { ok: !(sub.problems || []).length }); }
  if (!r) return {err: "no block read"};
  if (!r.ok || !r.shapes) return {err: "not drawn: " + (r.problems || []).join("; ")};
  const png = r.png();
  // the picture's frame, as AI_DRAW's result() takes it
  const S = window.Lantern.drawShapes;
  let W = 720, Hh = 432;
  r.shapes.forEach(s => { const b = S.bbox(s); W = Math.max(W, b[2] + 20); Hh = Math.max(Hh, b[3] + 20); });
  const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
  const texts = r.shapes.filter(s => s.t === "text").map(s => {
    ctx.font = "bold " + (s.fs || 16) + "px system-ui, sans-serif";
    const w = ctx.measureText(String(s.s)).width, h = (s.fs || 16) * 0.8;
    return {s: String(s.s), x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - h / 2, y1: s.y + h / 2};
  });
  // the same picture at full size (Lantern's png() is cut down to 720 px wide), for looking at
  const big = document.createElement("canvas"); big.width = Math.round(W); big.height = Math.round(Hh);
  const bx = big.getContext("2d"); bx.fillStyle = "#ffffff"; bx.fillRect(0, 0, big.width, big.height);
  r.shapes.forEach(s => S.render(bx, s));
  const out = {png: png, full: big.toDataURL("image/png"), w: W, h: Hh, onText: [], cut: [], onLine: [], summary: r.summary,
    levels: r.shapes.filter(s => s.t === "path" && s.d && s.d[0] === 9 && s.d[1] === 6 && s.pts && s.pts.length === 2).map(s => s.pts[0][1])};
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j], ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ox > 2 && oy > 2) out.onText.push(a.s + " || " + b.s);
  }
  texts.forEach(t => { if (t.x0 < -1 || t.y0 < -1 || t.x1 > W + 1 || t.y1 > Hh + 1) out.cut.push(t.s + " [" + Math.round(t.x0) + ".." + Math.round(t.x1) + " of " + Math.round(W) + "]"); });
  // a segment through a box (shrunk 1 px): Liang-Barsky clipping
  function hits(p, q, b) {
    let t0 = 0, t1 = 1; const dx = q[0] - p[0], dy = q[1] - p[1];
    const P = [-dx, dx, -dy, dy], Q = [p[0] - b.x0, b.x1 - p[0], p[1] - b.y0, b.y1 - p[1]];
    for (let k = 0; k < 4; k++) { if (P[k] === 0) { if (Q[k] < 0) return false; } else { const t = Q[k] / P[k]; if (P[k] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) return false; } }
    return true;
  }
  r.shapes.forEach((s, si) => {
    if (s.t !== "path" || !s.pts || (s.w || 1) < 1) return;
    texts.forEach(t => {
      const b = {x0: t.x0 + 1, x1: t.x1 - 1, y0: t.y0 + 1, y1: t.y1 - 1};
      for (let k = 0; k + 1 < s.pts.length; k++) if (hits(s.pts[k], s.pts[k + 1], b)) { out.onLine.push(t.s + " | line " + si + " (" + s.c + ", w " + (s.w || 1) + (s.d ? ", dashed" : "") + ")"); break; }
    });
  });
  return out;
}
"""
def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    agree = dis = 0
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1100, "height": 900})
            def handle(route):
                u = route.request.url
                if "/v1/" in u or "/props" in u or "/health" in u or ":8081" in u: return route.fulfill(status=404, body="")
                return route.continue_()
            pg.route("**/*", handle)
            pg.goto("http://127.0.0.1:%d/index.html" % PORT)
            pg.wait_for_function("!!(window.Lantern && window.Lantern.aiAct && window.Lantern.aiAct.build && window.Lantern.aiPumpStation)", timeout=30000)
            ver = pg.evaluate("window.Lantern.version")
            for c in CASES:
                cid, harm, q, text, right, wrong = c[:6]
                more = c[6] if len(c) > 6 else None
                r = pg.evaluate(MEASURE, [text, q if q != "x" else "create a diagram for a typical 2 pump lift station control with alternating relay", cid])
                what = []
                # levelsAbovePumps: every float's level line drawn clear of the pumps (46 px up from the floor at y 590)
                if more == "levelsAbovePumps" and not r.get("err") and r.get("levels"):
                    low = [round(590 - y) for y in r["levels"] if 590 - y < 46]
                    if len(low) > 1: what.append("%d of the %d float levels are drawn %s px above the floor, through the pumps (46 px high)" % (len(low), len(r["levels"]), low))
                if r.get("err"): what.append(r["err"])
                else:
                    with open(os.path.join(OUT, cid + ".png"), "wb") as f: f.write(base64.b64decode(r["full"].split(",", 1)[1]))
                    with open(os.path.join(OUT, cid + "_as_the_model_sees_it.png"), "wb") as f: f.write(base64.b64decode(r["png"].split(",", 1)[1]))
                    if r["onText"]: what.append("text on text: " + "; ".join(r["onText"][:6]))
                    if r["cut"]: what.append("text cut off: " + "; ".join(r["cut"][:6]))
                    bad = [x for x in r["onLine"] if any(wr in x for wr in wrong)]
                    if bad: what.append("text on a line: " + "; ".join(bad[:6]))
                    with open(os.path.join(OUT, cid + ".txt"), "w") as f:
                        f.write("Lantern %s\n%s\nsize %dx%d\ntext on text: %s\ncut off: %s\ntext on a line (by eye):\n  %s\n" % (ver, right, r["w"], r["h"], r["onText"], r["cut"], "\n  ".join(r["onLine"])))
                if what: dis += 1; print("DISAGREE %s %s [%s]" % (cid, " | ".join(what)[:700], harm))
                else: agree += 1; print("AGREE " + cid)
            b.close()
    finally:
        srv.terminate()
    print("%d cases: %d AGREE, %d DISAGREE" % (len(CASES), agree, dis))
main()
