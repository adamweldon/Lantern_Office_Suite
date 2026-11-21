#!/usr/bin/env python3
"""replay_browser.py -- the review's drawings in a real browser (Playwright + Chromium).

Builds nothing: run `python3 tools/build_site.py` first. Serves site/ on a port of its own, opens index.html,
calls Lantern.aiAct.build(...) for each drawing, saves m.preview() as a PNG in png/ next to this file, and checks
what a tradesman would see at once: text running into other text (measured with the painter's own font) and text
cut off at the canvas edge. Prints "AGREE <id>" / "DISAGREE <id> <detail> [harm]" and a count, like replay.js.
Usage: python3 tests/fixtures/liftstation_review1_1230/replay_browser.py [port]
"""
import functools, json, os, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SITE = os.path.join(ROOT, "site")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8337
OUT = os.environ.get("LANTERN_PNG_OUT") or os.path.join(HERE, "png")  # the review wrapper draws into a temporary folder
os.makedirs(OUT, exist_ok=True)
RUN = json.load(open(os.path.join(ROOT, "tests", "fixtures", "liftstation_1230", "run_35b.json")))
Q = '"'


def blk(kind, title, lines):
    return "MAKE " + kind + ": " + title + "\n" + "\n".join(lines) + "\nEND"


F4 = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"']
PUMPS = ['coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']
# (id, block, question, harm if text collides) -- every drawing must have no text on text and nothing cut off
CASES = [
    ("D-control-35b-block1", RUN["replies"][1]["reply"], RUN["question"], "medium"),
    ("D-control-prompt-example", blk("CONTROL", "Duplex pump station", ['supply "120 V AC"'] + F4 + ["alternator AR M1 M2"] + PUMPS +
     ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red']), "Draw the control circuit for a duplex lift station", "medium"),
    ("D-control-8-rungs", blk("CONTROL", "Duplex with fail lights", F4 + ["alternator AR M1 M2"] + PUMPS + ["overload OL1 M1", "overload OL2 M2",
     'lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT5 OL1 "pump 1 fail" amber', 'lamp LT6 OL2 "pump 2 fail" amber', 'horn AH1 "high level alarm"']),
     "Draw the control circuit for a duplex lift station", "medium"),
    ("D-control-24vdc", blk("CONTROL", "Duplex 24 V", ['supply "24 V DC"', 'float FS1 "stop"', 'float FS2 "start"', 'float FS3 "alarm"', "alternator AR K1 K2",
     'coil K1 "pump 1 contactor"', 'coil K2 "pump 2 contactor"']), "Draw the control circuit for a duplex lift station", "medium"),
    ("D-piping-1", blk("PIPING", "Simplex", ['pump P1 "grinder pump"']), "Draw the piping for a lift station", "medium"),
    ("D-piping-2-full", blk("PIPING", "Lift station", ['well "wet well"', 'inlet "8 in PVC gravity sewer"', 'pump P1 "submersible pump 1"', 'pump P2 "submersible pump 2"',
     "check valve CV1 P1", "check valve CV2 P2", "gate valve GV1 P1", "gate valve GV2 P2", 'force main "4 in DI force main"', "vent pipe"]), "Draw the piping for a 2 pump lift station", "medium"),
    ("D-piping-3", blk("PIPING", "Triplex", ["pump P1", "pump P2", "pump P3", "valve V1 P1 plug", "valve V2 P2 plug", "valve V3 P3 plug"]), "Draw the piping for a 3 pump lift station", "medium"),
    ("D-piping-4-two-inlets", blk("PIPING", "Four pumps", ["pumps 4", 'inlet "north 10 in sewer"', 'inlet "south 8 in sewer"', 'header "6 in force main"']), "Draw the piping for a 4 pump lift station", "medium"),
    ("D-levels-ft", blk("LEVELS", "Wet well", ['well "wet well" 12 ft', "pump P1 P2", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 4 ft', 'float FS3 "lag on" 5 ft',
     'float FS4 "high level alarm" 6 ft', 'inlet "inlet invert" 7 ft']), "Draw the float levels in the wet well", "medium"),
    ("D-levels-no-heights", blk("LEVELS", "Floats", ["pump P1 P2", 'float FS1 "stop low"', 'float FS2 "start high"', 'float FS3 "alarm high high"']), "Draw the float levels in the wet well", "medium"),
    ("D-levels-mm-close", blk("LEVELS", "Close floats", ['float FS1 "off" 500 mm', 'float FS2 "lead on" 700 mm', 'float FS3 "lag on" 950 mm', 'float FS4 "high level alarm" 1300 mm', "inlet 1200 mm"]),
     "Draw the float levels in the wet well", "medium"),
    ("D-levels-deep-well", blk("LEVELS", "Deep well", ['well "wet well" 30 ft', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 2.75 ft', 'float FS3 "lag on" 3.5 ft', 'float FS4 "high level alarm" 4.25 ft']),
     "Draw the float levels in the wet well", "medium"),
    ("D-levels-elevations", blk("LEVELS", "Elevations", ['float FS1 "off" el. 101.5 ft', 'float FS2 "lead on" el. 103.0 ft', 'float FS3 "high level alarm" el. 104.5 ft', "inlet el. 105.0 ft"]),
     "Draw the float levels in the wet well", "medium"),
    ("D-levels-inlet-near-alarm", blk("LEVELS", "Inlet near alarm", ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft', 'inlet "8 in sewer invert" 5.2 ft']),
     "Draw the float levels in the wet well", "medium"),
]

JS = r"""
([block, q]) => {
  let m = Lantern.aiAct.build(block, q);
  // (1.24.31) a station question's block is read as MAKE STATION (AI_STATION): its own drawing of this block's kind
  if (m && m.plan && m.plan.mode === "station" && m.views) { const vk = { CONTROL: "control", PIPING: "piping", LEVELS: "levels", SCHEMATIC: "piping" }[String((/MAKE\s+([A-Z]+)/.exec(block) || [])[1])]; const sub = m.views[vk]; if (sub) m = Object.assign({}, sub, { ok: !(sub.problems || []).length }); }
  if (!m || !m.plan) return { ok: false, problems: m ? m.problems : ["no block"] };
  const cv = m.preview();
  const k = cv.width / (cv.width / (cv.width ? 1 : 1));
  const shapes = m.shapes || [];
  const c2 = document.createElement("canvas").getContext("2d");
  const boxes = [];
  let maxX = 0, maxY = 0;
  shapes.forEach(s => { const b = Lantern.drawShapes.bbox(s); maxX = Math.max(maxX, b[2] + 20); maxY = Math.max(maxY, b[3] + 20); });
  shapes.filter(s => s.t === "text").forEach(s => {
    c2.font = "bold " + (s.fs || 16) + "px system-ui, sans-serif";
    const w = c2.measureText(String(s.s)).width, h = (s.fs || 16) * 0.9;
    boxes.push({ s: String(s.s), x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - h / 2, y1: s.y + h / 2 });
  });
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ox > 1 && oy > 1) hits.push("“" + a.s + "” on “" + b.s + "”");
  }
  const cut = boxes.filter(b => b.x0 < -1 || b.x1 > maxX + 1).map(b => "“" + b.s + "”");
  return { ok: true, png: cv.toDataURL("image/png"), hits, cut, w: cv.width, h: cv.height };
}
"""


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=SITE)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    srv = serve()
    a = d = 0
    with sync_playwright() as p:
        br = p.chromium.launch()
        pg = br.new_page(viewport={"width": 1200, "height": 900})
        pg.goto("http://127.0.0.1:%d/index.html" % PORT)
        pg.wait_for_function("window.Lantern && Lantern.aiAct && Lantern.aiPumpStation", timeout=60000)
        for cid, block, q, harm in CASES:
            r = pg.evaluate(JS, [block, q])
            if not r.get("ok"):
                d += 1
                print("DISAGREE %s not drawn: %s [%s]" % (cid, "; ".join(r.get("problems") or [])[:300], harm))
                continue
            import base64
            open(os.path.join(OUT, cid + ".png"), "wb").write(base64.b64decode(r["png"].split(",", 1)[1]))
            bad = []
            if r["hits"]:
                bad.append("text on text: " + ", ".join(r["hits"][:6]) + (" and %d more" % (len(r["hits"]) - 6) if len(r["hits"]) > 6 else ""))
            if r["cut"]:
                bad.append("text cut off at the edge: " + ", ".join(r["cut"][:4]))
            if bad:
                d += 1
                print("DISAGREE %s %s [%s]" % (cid, "; ".join(bad)[:700], harm))
            else:
                a += 1
                print("AGREE " + cid)
        br.close()
    srv.shutdown()
    print("%d cases: %d AGREE, %d DISAGREE" % (a + d, a, d))


if __name__ == "__main__":
    main()
