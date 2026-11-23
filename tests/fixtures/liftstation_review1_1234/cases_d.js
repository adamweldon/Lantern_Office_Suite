// cases_d.js -- D: the open circuit's line to write (AI_SCHEMATIC parseSchematic): "the current reaches the ground G1
// and goes no further: join it back to V1, like: wire G1 V1" and "the current stops at L1: ... like: wire L1 B1".
// A line handed to a model to copy must be surer than the model (rule 7): each case writes the line Lantern gave and
// builds the circuit again. Right: the line is true (the ground or part named is where the current stops, and the only
// such place), and written it closes the circuit through every part the model wired -- no part left hanging on one
// wire, no wire laid beside one already there (the source shorted). Or no line at all (the general advice).
"use strict";
var fs = require("fs"), path = require("path");
var H = require("./lib.js");
var P = H.parts, W = H.wires;
var CHAT = JSON.parse(fs.readFileSync(path.join(H.ROOT, "tests/fixtures/liftstation_1234/chat_35b.json"), "utf8"));
var R2 = CHAT.replies[1].reply;
var ONE = { ground: 1, junction: 1 };
// a wire's end as Lantern reads it: the part's ID, without an explicit port (B1+, B1-, B1.a, B1:in)
function idOf(t) { return String(t).replace(/(?:[+-]|[.:][A-Za-z0-9]+)$/, "").toUpperCase(); }
function degs(ws) { var d = {}; ws.forEach(function (w) { var a = w.split(/\s+/).map(idOf); d[a[0]] = (d[a[0]] || 0) + 1; d[a[1]] = (d[a[1]] || 0) + 1; }); return d; }
// judge(parts, wires, question): "" when the line (if any) is right
function judge(ps, ws, q, needLine) {
  var t = H.sch("Circuit", P(ps).concat(W(ws))), r = H.L().aiAct.build(t, q), pr = (r.problems || []).join(" ;; ");
  if (r.ok) return "made as it stands (no open circuit found)";
  var m = /like: wire (\S+) (\S+)$/.exec(pr);
  if (!m) return needLine ? "no line given: " + pr : "";
  var a = m[1], b = m[2], d = degs(ws), type = {};
  ps.forEach(function (p) { type[p[0]] = p[1]; });
  var dup = ws.some(function (w) { var x = w.split(/\s+/).map(idOf); return (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a); });
  if (dup) return "the line \x22wire " + a + " " + b + "\x22 lays a second wire beside \x22" + ws.filter(function (w) { var x = w.split(/\s+/).map(idOf); return (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a); })[0] + "\x22: written, it shorts " + b;
  var ws2 = ws.concat([a + " " + b]), d2 = degs(ws2), r2 = H.L().aiAct.build(H.sch("Circuit", P(ps).concat(W(ws2))), q);
  if (!r2.ok) return "written, the line does not make it: " + (r2.problems || []).join("; ");
  // a part left on one wire once the line is written: beyond the place named (it can be reached from the source only
  // through that place -- "goes no further" is untrue, the line cuts it out), or on a branch of its own (a second place
  // the current could go back from: the draft's own rule says the place is then the model's to say)
  var hang = ps.filter(function (p) { return (!ONE[p[1]] || p[1] === "junction") && d2[p[0]] === 1; }).map(function (p) { return p[0]; });
  var beyond = hang.filter(function (h) { return !reachNot(ws, b, h, a); });
  if (beyond.length) return "\x22" + a + "\x22 is not where the current stops: " + beyond.join(", ") + " lies beyond it, and written, \x22wire " + a + " " + b + "\x22 leaves " + beyond.join(", ") + " out of the circuit";
  return hang.length ? "a second place the current could go back from (" + hang.join(", ") + "), yet a line naming " + a + "; written, " + hang.join(", ") + " stays on one wire" : "";
}
// reachNot(wires, from, to, skip): can "to" be reached from "from" without passing through the part "skip"?
function reachNot(ws, from, to, skip) {
  var adj = {}, seen = {}, st = [from];
  ws.forEach(function (w) { var x = w.split(/\s+/).map(idOf); (adj[x[0]] = adj[x[0]] || []).push(x[1]); (adj[x[1]] = adj[x[1]] || []).push(x[0]); });
  seen[from] = 1;
  while (st.length) { var c = st.pop(); if (c === to) return true; (adj[c] || []).forEach(function (n) { if (!seen[n] && n !== skip) { seen[n] = 1; st.push(n); } }); }
  return false;
}
function D(id, harm, ps, ws, q, right, needLine) {
  return { id: id, harm: harm, input: { question: q, parts: ps, wires: ws }, right: right, run: function () { return H.boot().then(function () { return judge(ps, ws, q, needLine); }); } };
}
var QL = "draw a circuit with a battery, a switch and a lamp";

module.exports = [
  // --- the guard ----------------------------------------------------------------------------------------------------
  { id: "D-01", harm: "high", input: { question: "draw a circuit with a source, switches, two motors and three lamps", reply: "the 35B's second try in Adam's chat" },
    right: "the 35B's circuit reaches G1 and stops: \x22wire G1 V1\x22, and written it is made",
    run: function () { return H.boot().then(function () {
      var q = "draw a circuit with a source, switches, two motors and three lamps", r = H.L().aiAct.build(R2, q), pr = (r.problems || []).join(";");
      if (!/like: wire G1 V1$/.test(pr)) return "line: " + pr;
      var r2 = H.L().aiAct.build(R2.replace("wire L3 G1\n", "wire L3 G1\nwire G1 V1\n"), q); return r2.ok ? "" : "written, not made: " + r2.problems.join("; "); }); } },
  D("D-02", "medium", [["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"]], ["B1 S1", "S1 L1"], QL, "a chain that stops at L1: wire L1 B1", true),
  D("D-03", "medium", [["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"], ["G1", "ground"]], ["B1 S1", "S1 L1", "L1 G1"], QL, "a chain that ends at the ground G1: wire G1 B1", true),
  D("D-04", "medium", [["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"], ["G1", "ground"]], ["B1+ S1", "S1 L1", "L1 G1"], QL, "with the battery's + named: wire G1 B1, and it is made", true),
  D("D-05", "low", [["B1", "battery", "9 V"], ["R1", "resistor", "330"], ["D1", "diode", "LED"]], ["B1 R1", "R1 D1"], "draw a battery, a resistor and an LED", "a chain that stops at the LED: wire D1 B1", true),
  D("D-06", "low", [["B1", "battery", "9 V"], ["J1", "junction"], ["L1", "lamp"], ["L2", "lamp"]], ["B1 J1", "J1 L1", "J1 L2"], "draw a battery and two lamps", "two places it could go back from: no line (the draft's own guard)"),
  D("D-07", "low", [["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"], ["G1", "ground"], ["G2", "ground"]], ["B1 S1", "S1 L1", "L1 G1", "S1 G2"], QL, "two grounds reached: no line"),
  D("D-08", "low", [["V1", "source", "12 V"], ["S1", "switch"], ["M1", "motor"], ["L1", "lamp"], ["G1", "ground"]], ["V1 S1", "S1 M1", "M1 L1", "L1 G1"], "draw a motor and a lamp on 12 V", "a long chain to one ground: wire G1 V1", true),
  D("D-09", "low", [["B1", "battery", "9 V"], ["C1", "capacitor", "100 uF"], ["G1", "ground"]], ["B1 C1", "C1 G1"], "draw a battery and a capacitor", "a capacitor to ground: wire G1 B1"),
  D("D-10", "low", [["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"]], ["B1 S1", "S1 L1", "L1 S1"], QL, "a source with one wire into a loop that does not include it: whatever is said is not a wrong line"),
  // --- where the line is wrong ----------------------------------------------------------------------------------------
  D("D-20", "high", [["B1", "battery", "9 V"], ["G1", "ground"], ["L1", "lamp"], ["S1", "switch"]], ["B1 G1", "G1 L1", "L1 S1"],
    QL, "the battery's only wire goes to the ground, the lamp and switch hang off it and the chain stops at S1: never \x22wire G1 B1\x22 (a second wire beside B1-G1 shorts the battery and is drawn as made); the place is S1 (wire S1 B1)"),
  D("D-21", "high", [["B1", "battery", "9 V"], ["G1", "ground"], ["S1", "switch"], ["L1", "lamp"]], ["B1- G1", "G1 L1", "L1 S1"],
    QL, "the same with the battery's - named: never wire G1 B1"),
  D("D-22", "high", [["B1", "battery", "9 V"], ["G1", "ground"], ["S1", "switch"], ["L1", "lamp"]], ["B1 G1", "S1 L1", "L1 S1"],
    QL, "the battery wired only to ground, the switch and lamp a loop of their own: wire G1 B1 shorts the battery and leaves the lamp unpowered -- no such line"),
  D("D-23", "high", [["B1", "battery", "9 V"], ["M1", "motor"], ["G1", "ground"], ["S1", "switch"]], ["B1 M1", "M1 G1", "G1 S1"],
    "draw a battery, a motor and a switch", "the chain B1, M1, G1, S1 stops at the switch: wire S1 B1 keeps the switch in the circuit; wire G1 B1 runs the motor with the switch left hanging"),
  D("D-24", "medium", [["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"], ["G1", "ground"], ["R1", "resistor", "1k"]], ["B1 S1", "S1 L1", "L1 G1", "G1 R1"],
    "draw a battery, a switch, a lamp and a resistor", "the current goes on past G1 to R1: \x22G1 goes no further\x22 is untrue, and wire G1 B1 leaves R1 out"),
  D("D-25", "low", [["B1", "battery", "9 V"], ["J1", "junction"], ["L1", "lamp"], ["L2", "lamp"], ["G1", "ground"]], ["B1 J1", "J1 L1", "J1 L2", "L1 G1"],
    "draw a battery and two lamps", "two places it could go back from (G1 after L1, and L2): no line, as for two lamps (D-06)"),
  D("D-26", "low", [["V1", "source", "12 V"], ["J1", "junction"], ["M1", "motor"], ["L1", "lamp"], ["G1", "ground"]], ["V1 J1", "J1 M1", "M1 G1", "J1 L1"],
    "draw a motor and a lamp on 12 V", "two places (G1 and L1): no line"),
  D("D-27", "low", [["B1", "battery", "9 V"], ["S1", "switch"], ["J1", "junction"], ["L1", "lamp"], ["L2", "lamp"], ["J2", "junction"]], ["B1 S1", "S1 J1", "J1 L1", "J1 L2", "L2 J2"],
    "draw a battery, a switch and two lamps", "two places (L1, and J2 after L2): no line naming L1 alone"),
  D("D-28", "low", [["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"], ["L2", "lamp"], ["G1", "ground"]], ["B1 S1", "S1 L1", "L1 G1", "S1 L2"],
    "draw a battery, a switch and two lamps", "the lamps in parallel, L2 not returned: two places (G1 and L2)")
];
