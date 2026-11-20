#!/usr/bin/env python3
"""replay_browser.py -- the second review's drawings (area E) in a real browser (Playwright + Chromium).

Run `python3 tools/build_site.py` first. Serves site/ on port 8338, opens index.html, and for each case calls
Lantern.aiAct.build(block, question): saves preview() (what Chat shows) as <id>.png and the same shapes painted at full
size by Lantern's own painter as <id>_full.png, in $LANTERN_PNG_OUT or png/ next to this file. Then checks what a
tradesman would see at once -- text on text and text cut off at the edge, measured with the painter's own font (bold
system-ui) -- and each case's own geometry (a float at its height, the inlet where it is, the valves in order).
Prints "AGREE <id>" / "DISAGREE <id> <what> [harm]" and "<n> cases: <a> AGREE, <d> DISAGREE".
Usage: python3 tests/fixtures/liftstation_review2_1230/replay_browser.py
"""
import base64, functools, json, os, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SITE = os.path.join(ROOT, "site")
PORT = 8338
OUT = os.environ.get("LANTERN_PNG_OUT") or os.path.join(HERE, "png")
os.makedirs(OUT, exist_ok=True)
RUN = json.load(open(os.path.join(ROOT, "tests", "fixtures", "liftstation_1230", "run_35b.json")))


def blk(kind, title, lines):
    return "MAKE " + kind + ": " + title + "\n" + "\n".join(lines) + "\nEND"


F4 = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"']
PUMPS = ['coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']
CQ = "Draw the control circuit for a typical 2 pump lift station with an alternating relay"
PQ = "Draw the plumbing schematic for a duplex sewage lift station"
LQ = "Draw the float levels in the wet well of a duplex lift station"
FT = 0.3048

# (id, block, question, harm, check): check is a name of a geometry check run in the page (see GEOM), with its args
CASES = [
    ("E-ctl-35b-block1", RUN["replies"][1]["reply"], RUN["question"], "medium", None),
    ("E-ctl-prompt-example", blk("CONTROL", "Duplex pump station", ['supply "120 V AC"'] + F4 + ["alternator AR M1 M2"] + PUMPS +
     ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red']), CQ, "medium", None),
    ("E-ctl-full-panel-12-rungs", blk("CONTROL", "Duplex lift station panel", F4 + ["alternator AR M1 M2"] + PUMPS + ["overload OL1 M1", "overload OL2 M2",
     'switch SS1 M1 "pump 1 HOA"', 'switch SS2 M2 "pump 2 HOA"', 'lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green',
     'lamp LT4 OL1 "pump 1 overload trip" amber', 'lamp LT5 OL2 "pump 2 overload trip" amber', 'lamp LT6 AR "pump 1 lead" white', 'horn AH1 FS4 "high level alarm"',
     'lamp LT3 FS4 "high level" red']), CQ, "medium", None),
    ("E-ctl-24vdc-contactors", blk("CONTROL", "Duplex 24 V DC", ['supply "24 V DC"'] + F4 + ["alternator AR K1 K2", 'coil K1 "pump 1 contactor"', 'coil K2 "pump 2 contactor"']),
     CQ, "medium", ("rails", "+", "0 V")),
    ("E-ctl-long-float-labels", blk("CONTROL", "Duplex", ['float FS1 "Float Switch 1 - all pumps off"', 'float FS2 "Float Switch 2 - lead pump on"',
     'float FS3 "Float Switch 3 - lag pump on"', 'float FS4 "Float Switch 4 - high level alarm"', "alternator AR M1 M2"] + PUMPS), CQ, "low", ("distinct_labels",)),
    ("E-ctl-redundant-off-two-alarms", blk("CONTROL", "Duplex, backup off, two alarms", ['float FS0 "redundant off"'] + F4 + ['float FS5 "high high alarm"', "alternator AR M1 M2"] + PUMPS +
     ['lamp LT3 "high level alarm" red']), CQ, "medium", None),
    ("E-pp-35b-words", blk("PIPING", "Lift station", ['well "Wet well"', 'inlet pipe "8 in"', 'pump P1 "Pump 1"', 'pump P2 "Pump 2"', "check valve CV1 P1", "check valve CV2 P2",
     "gate valve GV1 P1", "gate valve GV2 P2", 'discharge header "4 in force main"', "vent pipe"]), PQ, "low", ("valve_order",)),
    ("E-pp-triplex", blk("PIPING", "Triplex lift station", ["pump P1", "pump P2", "pump P3", 'header "8 in force main"']), "Draw the piping of a triplex lift station", "low", ("valve_order",)),
    ("E-pp-four-pumps-labels", blk("PIPING", "Four pump station", ['pump P1 "submersible pump 1, 15 hp"', 'pump P2 "submersible pump 2, 15 hp"', 'pump P3 "submersible pump 3, 15 hp"',
     'pump P4 "submersible pump 4, 15 hp"', 'header "10 in ductile iron force main to manhole 7"']), PQ, "medium", ("valve_order",)),
    ("E-pp-main-valves", blk("PIPING", "Duplex with main valves", ["pump P1", "pump P2", "check CV1 P1", "check CV2 P2", "valve V1 P1 plug", "valve V2 P2 plug",
     'header "4 in force main"', "air release valve ARV1", 'check CV3 "force main check"', 'valve BP1 "bypass connection" plug']), PQ, "low", ("valve_order",)),
    ("E-pp-three-inlets-long", blk("PIPING", "Station with three inlets", ['inlet "8 in PVC gravity sewer from manhole 3 on Elm Street"', 'inlet "6 in PVC from the school"',
     'inlet "4 in overflow return"', "pump P1", "pump P2", 'header "force main"', 'vent "4 in steel inverted J vent with screen"']), PQ, "medium", ("valve_order",)),
    ("E-lv-feet-inlet", blk("LEVELS", "Wet well", ['well "wet well" 10 ft', "pump P1 P2"] + [F4[i] + " " + h for i, h in enumerate(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"])] +
     ['inlet "inlet invert" 6.5 ft']), LQ, "high", ("heights", {"FS1": 2 * FT, "FS2": 3.5 * FT, "FS3": 4.5 * FT, "FS4": 5.5 * FT}, 6.5 * FT)),
    ("E-lv-no-heights", blk("LEVELS", "Wet well", ["pump P1 P2"] + F4), LQ, "medium", ("order",)),
    ("E-lv-close-floats", blk("LEVELS", "Wet well", ["pump P1 P2"] + [F4[i] + " " + h for i, h in enumerate(["2 ft", "2.25 ft", "2.5 ft", "2.75 ft"])]), LQ, "medium",
     ("heights", {"FS1": 2 * FT, "FS2": 2.25 * FT, "FS3": 2.5 * FT, "FS4": 2.75 * FT}, None)),
    ("E-lv-depths-inlet", blk("LEVELS", "Wet well", ['well "wet well" 20 ft deep'] + [F4[i] + " " + h for i, h in enumerate(["18 ft below grade", "16 ft below grade", "15 ft below grade", "14 ft below grade"])] +
     ['inlet "inlet invert" 12 ft below grade']), LQ, "high", ("heights", {"FS1": 2 * FT, "FS2": 4 * FT, "FS3": 5 * FT, "FS4": 6 * FT}, 8 * FT)),
    ("E-lv-ft-in-dash", blk("LEVELS", "Wet well", ["pump P1 P2"] + [F4[i] + " " + h for i, h in enumerate(["1'-6\"", "3'-0\"", "4'-6\"", "6'-0\""])]), LQ, "high",
     ("heights", {"FS1": 1.5 * FT, "FS2": 3 * FT, "FS3": 4.5 * FT, "FS4": 6 * FT}, None)),
    ("E-lv-metric-six-floats", blk("LEVELS", "Wet well", ['well "wet well" 3 m', "pump P1 P2 P3", 'float FS0 "low level alarm" 0.45 m', 'float FS1 "off" 0.6 m', 'float FS2 "lead on" 1.0 m',
     'float FS3 "lag on" 1.3 m', 'float FS4 "high level alarm" 1.6 m', 'float FS5 "high high alarm" 1.9 m', 'inlet "200 mm inlet sewer" 2.2 m']), LQ, "medium",
     ("heights", {"FS0": 0.45, "FS1": 0.6, "FS2": 1.0, "FS3": 1.3, "FS4": 1.6, "FS5": 1.9}, 2.2)),
]

JS = r"""
([block, q, geom]) => {
  const L = window.Lantern, out = { problems: [] };
  const m = L.aiAct.build(block, q);
  if (!m) return { error: "no block read" };
  out.ok = m.ok; out.mproblems = m.problems || [];
  if (!m.plan) return out;
  out.summary = m.summary;
  const cv = m.preview();
  out.preview = cv && cv.toDataURL ? cv.toDataURL("image/png") : null;
  // the shapes at full size, by Lantern's own painter, and the extent AI_DRAW gives them
  const sh = m.shapes, ex = [0, 0, 720, 432];
  sh.forEach(s => { const b = L.drawShapes.bbox(s); ex[2] = Math.max(ex[2], b[2] + 20); ex[3] = Math.max(ex[3], b[3] + 20); });
  const full = document.createElement("canvas"); full.width = Math.round(ex[2]); full.height = Math.round(ex[3]);
  const ctx = full.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, full.width, full.height);
  sh.forEach(s => L.drawShapes.render(ctx, s));
  out.full = full.toDataURL("image/png");
  // every text's box, measured as the painter draws it (bold, centred, middle baseline)
  const boxes = [];
  sh.forEach(s => { if (s.t !== "text") return; ctx.font = "bold " + (s.fs || 16) + "px system-ui, sans-serif"; const w = ctx.measureText(String(s.s)).width, h = (s.fs || 16);
    boxes.push({ s: String(s.s), x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - h / 2, y1: s.y + h / 2 }); });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j], ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ix > 2 && iy > 2) out.problems.push("text on text: “" + a.s.slice(0, 40) + "” and “" + b.s.slice(0, 40) + "”");
  }
  boxes.forEach(b => { if (b.x0 < -1 || b.x1 > ex[2] + 1 || b.y0 < -1 || b.y1 > ex[3] + 1) out.problems.push("cut off at the edge: “" + b.s.slice(0, 50) + "”"); });
  // text crossed by a drawn line (a pipe, a wall, a wire, a cable, a symbol's stroke): sampled along each segment, the box
  // trimmed to the letters' height; one- and two-letter texts inside symbols (G, A, P1) are the symbols' own
  const crossed = {}, flat = [];
  (function walk(list) { list.forEach(s => { if (s.t === "group") walk(s.shapes || []); else flat.push(s); }); })(sh);
  boxes.forEach(b => {
    if (b.s.length <= 2) return;
    const fs = b.y1 - b.y0, bx = { x0: b.x0 + 1, x1: b.x1 - 1, y0: b.y0 + fs * 0.22, y1: b.y1 - fs * 0.22 };
    flat.forEach(s => {
      if (crossed[b.s] || s.t !== "path" || !s.pts || (s.d && s.d[0] === 9)) return;
      for (let i = 1; i < s.pts.length && !crossed[b.s]; i++) {
        const a = s.pts[i - 1], c = s.pts[i], n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1])));
        for (let k = 0; k <= n; k++) { const x = a[0] + (c[0] - a[0]) * k / n, y = a[1] + (c[1] - a[1]) * k / n;
          if (x > bx.x0 && x < bx.x1 && y > bx.y0 && y < bx.y1) { crossed[b.s] = 1; out.problems.push("a line runs through the text “" + b.s.slice(0, 50) + "”"); break; } }
      }
    });
    flat.forEach(s => {   // a symbol's circle (a float's bulb, a pump) on a text
      if (crossed[b.s] || s.t !== "circle" || s.r > 30) return;
      const ix = Math.min(bx.x1, s.cx + s.r) - Math.max(bx.x0, s.cx - s.r), iy = Math.min(bx.y1, s.cy + s.r) - Math.max(bx.y0, s.cy - s.r);
      if (ix > 2 && iy > 2 && !(s.cx > bx.x0 && s.cx < bx.x1 && s.cy > b.y0 && s.cy < b.y1 && s.r > fs)) { crossed[b.s] = 1; out.problems.push("a symbol is drawn on the text “" + b.s.slice(0, 50) + "”"); }
    });
  });
  // the case's own geometry
  if (geom && geom[0] === "rails") { const ts = boxes.map(b => b.s); if (ts.indexOf(geom[1]) < 0 || ts.indexOf(geom[2]) < 0) out.problems.push("the rails are not marked " + geom[1] + " and " + geom[2]); }
  if (geom && geom[0] === "distinct_labels") {
    // a label cut short must still tell the devices apart
    const cut = boxes.filter(b => /\u2026$/.test(b.s)).map(b => b.s), dup = cut.filter((t, i) => cut.indexOf(t) !== i);
    if (dup.length) out.problems.push("labels cut to the same words, so the drawing does not say which is which: " + Array.from(new Set(dup)).map(t => "\u201c" + t + "\u201d").join(", ") + " (" + (cut.length) + " cut labels)");
  }
  if (geom && geom[0] === "valve_order") {
    // each pump's run: its check valve (filled triangle) left of its shutoff (two open triangles), both inside the vault
    m.plan.pumps.forEach(p => {
      const lab = id => boxes.filter(b => b.s === id || b.s.indexOf(id + " ") === 0)[0];
      const c = lab(p.check), v = lab(p.valve);
      if (!c || !v) out.problems.push(p.id + ": its valves are not labelled"); else if (!(c.x1 < v.x0)) out.problems.push(p.id + ": the shutoff valve is not after the check valve");
    });
  }
  if (geom && (geom[0] === "heights" || geom[0] === "order")) {
    const lines = sh.filter(s => s.t === "path" && s.d && s.d[0] === 9 && s.pts.length === 2 && s.pts[0][1] === s.pts[1][1]).map(s => s.pts[0][1]);
    const fl = m.plan.floats;
    if (lines.length !== fl.length) out.problems.push(lines.length + " level lines for " + fl.length + " floats");
    else if (geom[0] === "order") { for (let i = 1; i < lines.length; i++) if (!(lines[i] < lines[i - 1])) out.problems.push(fl[i].id + " is not drawn above " + fl[i - 1].id); }
    else {
      const want = geom[1], FLOOR = 590; let k = null;
      const misread = fl.filter(f => want[f.id] != null && (f.m == null || Math.abs(f.m - want[f.id]) > 0.003));
      misread.forEach(f => out.problems.push(f.id + " read as " + f.height + " and drawn there (written " + (want[f.id] / 0.3048).toFixed(2) + " ft = " + want[f.id].toFixed(3) + " m)"));
      if (!misread.length) fl.forEach((f, i) => { const w = want[f.id]; if (w == null) return; const kk = (FLOOR - lines[i]) / w; if (k == null) k = kk; else if (Math.abs(kk - k) / k > 0.01) out.problems.push(f.id + " is drawn at " + ((FLOOR - lines[i]) / k).toFixed(2) + " m for " + w.toFixed(3) + " m written (labelled " + f.height + ")"); });
      // each float's label beside its own line (within 20 px, after the labels are pushed apart)
      fl.forEach((f, i) => { const b = boxes.filter(x => x.s.indexOf(f.id + "  ") === 0)[0]; if (!b) out.problems.push(f.id + " has no label"); else if (Math.abs((b.y0 + b.y1) / 2 - lines[i]) > 40) out.problems.push(f.id + "'s label is " + Math.round(Math.abs((b.y0 + b.y1) / 2 - lines[i])) + " px from its line"); });
      if (geom[2] != null) {
        const il = sh.filter(s => s.t === "path" && s.d && s.d[0] === 3 && s.d[1] === 5)[0];
        if (!il) out.problems.push("no inlet line");
        else { const at = (FLOOR - il.pts[0][1]) / k; if (Math.abs(at - geom[2]) > 0.02) out.problems.push("the inlet is drawn at " + at.toFixed(2) + " m above the floor; it is at " + geom[2].toFixed(2) + " m"); }
      }
    }
  }
  return out;
}
"""


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=SITE))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    agree = disagree = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1200, "height": 900})
        pg.goto("http://127.0.0.1:%d/index.html" % PORT)
        pg.wait_for_function("window.Lantern && window.Lantern.aiAct && window.Lantern.aiPumpStation", timeout=60000)
        for cid, block, q, harm, geom in CASES:
            r = pg.evaluate(JS, [block, q, list(geom) if geom else None])
            probs = []
            if r.get("error"):
                probs.append(r["error"])
            elif not r.get("ok"):
                probs.append("not drawn: " + "; ".join(r.get("mproblems") or []))
            for key, name in (("preview", cid + ".png"), ("full", cid + "_full.png")):
                if r.get(key):
                    with open(os.path.join(OUT, name), "wb") as f:
                        f.write(base64.b64decode(r[key].split(",", 1)[1]))
            probs += r.get("problems") or []
            if probs:
                disagree += 1
                print("DISAGREE %s %s [%s]" % (cid, " | ".join(probs)[:700], harm))
            else:
                agree += 1
                print("AGREE " + cid)
        b.close()
    srv.shutdown()
    print("%d cases: %d AGREE, %d DISAGREE" % (len(CASES), agree, disagree))


if __name__ == "__main__":
    main()
