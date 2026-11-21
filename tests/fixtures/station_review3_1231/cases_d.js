// cases_d.js -- D: the drawings' own blocks written for a station question (read as MAKE STATION), and blocks that
// disagree. What the blocks agree on is drawn as written; a disagreement is said or goes back once with the line to
// write for THIS station; nothing is invented that neither block has; a right block is not lost in the correction.
"use strict";
var H = require("./lib.js");
var Q = "Design a duplex lift station: draw the control circuit, the piping and the float levels";
var C4 = H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'], "Duplex");
var LV4 = H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft']);
var LV3 = H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "high level alarm" 5 ft']);
var P2 = H.blk("PIPING", "Station", ['well "wet well"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', 'valve V1 P1 gate', 'valve V2 P2 gate', 'header "4 in force main"']);
var P3 = H.blk("PIPING", "Station", ['pump P1', 'pump P2', 'pump P3']);
function build(t, q) { return H.L().aiAct.build(t, q || Q); }
function R(id, harm, text, right, judge, q) { return { id: id, harm: harm, input: { question: q || Q, reply: text }, right: right, run: function () { return H.boot().then(function () { return judge(build(text, q), q || Q); }); } }; }
// every float the station's written parts name is in the drawn control circuit and the drawn levels
function phantom(r) {
  var p = r.plan, lv = p.views.levels ? p.views.levels.floats.map(function (f) { return f.id; }) : null, cc = p.views.control ? p.views.control.circuit : null;
  var inC = function (id) { return !cc || cc.rungs.some(function (g) { return g.stops.concat(g.starts, g.series, [].concat.apply([], g.branches || [])).some(function (e) { return e.id === id; }); }); };
  var out = [];
  p.spec.floats.forEach(function (f) { if (lv && lv.indexOf(f.id) < 0) out.push(f.id + " (" + f.label + ") is in the parts list but not in the drawn levels"); else if (!inC(f.id)) out.push(f.id + " (" + f.label + ") is in the parts list but not in the drawn control circuit"); });
  p.sequence.plain.concat(p.checks.run).forEach(function (s) { if (/nothing drawn comes on/.test(s)) out.push("“" + s.slice(0, 90) + "…”"); });
  return out.join("; ");
}
module.exports = [
  R("D-01", "medium", C4 + "\n\n" + LV3,
    "The control's FS3 is the lag float and the levels' FS3 the alarm: they disagree, and it goes back once as one MAKE STATION block, naming FS3.",
    function (r) { return !r.ok && r.fixKind === "STATION" && /FS3 is lag on in the control circuit and high level alarm in the float levels/.test(r.problems.join(" ")) ? "" : "ok " + r.ok + ", problems " + (r.problems || []).join("; "); }),
  R("D-02", "medium", C4 + "\n\n" + LV3,
    "The line handed back (rule 3) is one that, written as it stands, is drawn: the floats with heights for all or for none. Lantern's line gives FS1, FS2 and FS4 heights and FS3 none -- a block that comes back again (“give every float its height above the floor, or none”).",
    function (r) {
      var m = /like: (float FS1[^\n]*)$/.exec(r.problems.join(" ")); if (!m) return "no line handed back: " + r.problems.join("; ");
      var lines = m[1].replace(/\.$/, "").split(/,\s*(?=float )/), r2 = build(H.st(["pumps 2"].concat(lines)));
      return r2.ok ? "" : "the line handed back, copied, comes back: " + r2.problems.join("; ") + " (line: " + m[1] + ")"; }),
  R("D-03", "high", H.ctl(['float FS1 "stop"', 'float FS2 "start"', 'float FS3 "lag"', 'float FS4 "alarm"', 'alternator AR M1 M2', 'coil M1', 'coil M2'], "Duplex") + "\n\n" + LV4,
    "The control and the levels name the same four floats, FS1 to FS4, with the same jobs in other words (stop/off, start/lead on, alarm/high level alarm): one station of four floats. Lantern made a fifth, FS5 “high level alarm”, that is in neither drawing, listed it as a part and wrote “If the water reaches FS5, nothing drawn comes on” and “Lift FS5: nothing drawn comes on” -- with nothing said and nothing sent back.",
    function (r) { return !r.plan ? "not drawn" : H.floatsOf(r).split(",").length !== 4 ? "floats " + H.floatsOf(r) + ": " + phantom(r) : phantom(r); }),
  R("D-04", "high", H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "alarm"', 'alternator AR M1 M2', 'coil M1', 'coil M2'], "Duplex") + "\n\n" +
    H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "high water alarm" 5 ft']),
    "FS3 “alarm” in the control and FS3 “high water alarm” in the levels are one float. Lantern made two (FS3 and FS4), one of them in neither drawing.",
    function (r) { return !r.plan ? "not drawn" : H.floatsOf(r).split(",").length !== 3 ? "floats " + H.floatsOf(r) + ": " + phantom(r) : phantom(r); }),
  R("D-05", "medium", C4 + "\n\n" + P3, "A piping of three pumps beside a duplex control: said (the question's two kept).",
    function (r) { return r.ok && /the piping written has 3 pumps and the station 2/.test(r.plan.warn.join(" ")) ? "" : "warn " + (r.plan && r.plan.warn); }),
  R("D-06", "medium", C4 + "\n\n" + P2 + "\n\n" + LV4, "All three written and agreeing: each drawn as written, one station, nothing questioned.",
    function (r) { return r.ok && r.readAs === "STATION" && r.plan.given.join() === "control,piping,levels" && !r.plan.warn.length && H.floatsOf(r) === "FS1:off@2 ft,FS2:lead@3 ft,FS3:lag@4 ft,FS4:alarm@5 ft" ? "" : JSON.stringify([r.ok, r.plan && r.plan.given, r.plan && r.plan.warn, H.floatsOf(r)]); }),
  R("D-07", "medium", LV4, "The levels alone: the station made from them; the control's floats are the levels' own (FS1 to FS4, same jobs).",
    function (r) { var c = r.plan && r.plan.views.control && r.plan.views.control.circuit; if (!r.ok || !c) return "not drawn"; var ids = []; c.rungs.forEach(function (g) { g.stops.concat(g.starts, g.series).forEach(function (e) { if (e.kind === "float" && ids.indexOf(e.id) < 0) ids.push(e.id); }); }); return ids.sort().join() === "FS1,FS2,FS3,FS4" ? "" : "control floats " + ids.sort().join(); }),
  R("D-08", "medium", P2, "The piping alone: drawn as written (gate valves, the 4 in force main), the rest made.",
    function (r) { return r.ok && r.plan.given.join() === "piping" && r.plan.views.piping.pumps.every(function (p) { return p.valveKind === "gate"; }) ? "" : JSON.stringify([r.ok, r.plan && r.plan.given]); }),
  R("D-09", "medium", C4 + "\n\n" + H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft', 'float FS5 "high high alarm" 6 ft']),
    "A float in the levels and not in the control (FS5 high high): back once, naming it, with every float's line.",
    function (r) { return !r.ok && /FS5 \(high high alarm\) is in the float levels and not in the control circuit/.test(r.problems.join(" ")) ? "" : "ok " + r.ok + " " + (r.problems || []).join("; "); }),
  R("D-10", "low", H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float "off" 2 ft', 'float "lead on" 3 ft', 'float "lag on" 4 ft', 'float "high level alarm" 5 ft']) + "\n\n" + C4,
    "Levels without tags beside a control with them: one set of floats, the control's tags with the levels' heights.",
    function (r) { return r.ok && H.floatsOf(r) === "FS1:off@2 ft,FS2:lead@3 ft,FS3:lag@4 ft,FS4:alarm@5 ft" ? "" : H.floatsOf(r); }),
  R("D-11", "medium", H.ctl(['float FS1 "off"', 'float FS2 "pump on"', 'coil M1 "pump starter"'], "Simplex"),
    "A simplex control for a duplex question: back once, with the line to write in the block it is asked for. The correction asks for MAKE STATION (held to its grammar) but hands MAKE CONTROL lines (“alternator AR M1 M2, coil M1 ...”); the station's own line is “pumps 2”. It also tells the model “Lantern checked your MAKE STATION block” of a block it wrote as MAKE CONTROL.",
    function (r, q) { var f = H.L().aiAct.fixText(r, q); if (r.ok) return "drawn"; return H.L().aiAct.fixKind(r) === "STATION" && /like: alternator AR M1 M2, coil M1/.test(f) ? "the MAKE STATION correction hands MAKE CONTROL lines: " + (/write the two pumps[^\n]*/.exec(f) || [""])[0] : ""; }),
  { id: "D-12", harm: "medium", input: { question: Q, replies: ["MAKE CONTROL (24 V DC, a horn on FS4) + MAKE LEVELS with FS1 above FS2", "MAKE LEVELS corrected"] },
    right: "Chat: the levels go back once (MAKE LEVELS, its grammar); the corrected levels are drawn with the control the model wrote (24 V DC, the horn). Lantern built the second reply alone: the model's control is gone, the station has Lantern's usual control between L1 and L2, no horn, and says “no control voltage”.",
    run: function () { return H.boot().then(function () {
      var C = H.ctl(['supply "24 V DC"', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'horn AH1 FS4 "high level"'], "Duplex");
      var bad = H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 4 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 5 ft', 'float FS4 "high level alarm" 6 ft']);
      var good = H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 5 ft', 'float FS4 "high level alarm" 6 ft']);
      return H.turn(Q, [C + "\n\n" + bad, good]).then(function (t) {
        var m = t.rec.made; if (!m || !m.plan) return "nothing made";
        var c = m.plan.views.control && m.plan.views.control.circuit, horn = c && c.rungs.some(function (g) { return g.out.kind === "horn"; });
        return m.plan.spec.supply === "24 V DC" && horn ? "" : "the model's control lost: given " + m.plan.given.join() + ", supply “" + m.plan.spec.supply + "”, horn " + !!horn + "; " + m.summary.slice(0, 200);
      }); }); } },
  { id: "D-13", harm: "medium", input: { question: Q, path: "solve", replies: ["the same two replies as D-12"] },
    right: "The bench's path: as D-12.",
    run: function () { return H.boot().then(function () {
      var C = H.ctl(['supply "24 V DC"', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'horn AH1 FS4 "high level"'], "Duplex");
      var bad = H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 4 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 5 ft', 'float FS4 "high level alarm" 6 ft']);
      var good = H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 5 ft', 'float FS4 "high level alarm" 6 ft']);
      return H.solve(Q, [C + "\n\n" + bad, good]).then(function (s) { var m = s.out.made; return m && m.plan && m.plan.spec.supply === "24 V DC" ? "" : "the model's control lost: supply “" + (m && m.plan && m.plan.spec.supply) + "”, given " + (m && m.plan && m.plan.given); });
    }); } },
  { id: "D-14", harm: "low", input: { question: Q, reply: "MAKE CONTROL + MAKE LEVELS with FS1 above FS2" },
    right: "Chat's note names the block with the problem (the levels); it said “Lantern checked the MAKE CONTROL block: the float levels: ...”.",
    run: function () { return H.boot().then(function () {
      var bad = H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 4 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 5 ft', 'float FS4 "high level alarm" 6 ft']);
      return H.turn(Q, [C4 + "\n\n" + bad, LV4]).then(function (t) { var n = t.notes.filter(function (x) { return /Lantern checked/.test(x); })[0] || ""; return /checked the MAKE CONTROL block: the float levels/.test(n) ? n.slice(0, 160) : ""; }); }); } },
  R("D-15", "medium", H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1', 'coil M2', 'lamp LT1 FS4 "alarm" red'], "Duplex") + "\n\n" + LV4,
    "Control and levels agreeing, labels identical: four floats, no phantom (the merge holds when the words match).",
    function (r) { return r.ok && H.floatsOf(r) === "FS1:off@2 ft,FS2:lead@3 ft,FS3:lag@4 ft,FS4:alarm@5 ft" ? phantom(r) : H.floatsOf(r) + " " + (r.problems || []).join(";"); }),
  R("D-16", "medium", H.ctl(['alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'], "Duplex"),
    "A floatless duplex control for a station question: the four floats AI_CONTROL adds are the station's four (same tags and jobs in the control, the levels and the parts list), said once.",
    function (r) { return r.ok && H.floatsOf(r) === "FS1:off,FS2:lead,FS3:lag,FS4:alarm" && r.plan.views.levels.floats.map(function (f) { return f.id; }).join() === "FS1,FS2,FS3,FS4" ? phantom(r) : H.floatsOf(r) + " " + (r.problems || []).join(";"); }),
  R("D-17", "medium", H.blk("SCHEMATIC", "Duplex", ['float FS1 "off"', 'float FS2 "lead on"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']),
    "A MAKE SCHEMATIC holding the station's control lines: read as the station, its control as written.",
    function (r) { return r.ok && r.readAs === "STATION" && r.plan.given.join() === "control" ? "" : JSON.stringify([r.ok, r.readAs, r.plan && r.plan.given]); }),
  R("D-18", "medium", H.ctl(['stop PB1', 'start PB2 M1', 'coil M1 "vent fan starter"', 'lamp LT1 M1 "fan run" green'], "Vent fan"),
    "A fan's starter (no float, no alternator) for a station question is not the station's control: drawn as written, not read as the station (the station is then asked for once, B-22).",
    function (r) { return r.readAs ? "read as " + r.readAs : r.ok ? "" : r.problems.join("; "); }),
  R("D-19", "low", H.ctl(['float FS1 "off"', 'float FS2 "pump 1 on"', 'float FS3 "pump 2 on"', 'float FS4 "high level alarm"', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'], "Two pumps"),
    "Two pumps, each on its own float, no alternator: back once with lines right for this station (FS3 is pump 2's: float FS3 M2, or an alternator). The lines handed back put every float on M1 (“float FS3 M1”) -- MAKE CONTROL's 1.24.30 text, now inside a station's correction.",
    function (r) { var p = (r.problems || []).join(" "); return r.ok ? "drawn" : /float FS3 M1/.test(p) ? "handed back “float FS3 M1” for pump 2's float" : ""; })
];
