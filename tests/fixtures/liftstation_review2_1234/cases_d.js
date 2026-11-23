// cases_d.js -- rule 4: the open-circuit line in AI_SCHEMATIC parseSchematic ("like: wire G1 V1" where the current
// reaches one ground and goes no further; "like: wire X B1" for one dead end; other loose parts named before the line).
// A line handed to a model to copy must be surer than the model (CLAUDE.md rule 7): each case writes the circuit a model
// might, takes the line Lantern gives, writes it in, and asks two things -- is the line the wire the circuit lacks, and
// does the circuit with it do what the parts say (a load between the source's two sides, no short, nothing left
// hanging that Lantern then accepts without a word).
"use strict";
var lib = require("./lib.js");
var Q = "draw a circuit with a battery, a switch, lamps, a motor, a resistor, a diode, a capacitor and a ground";
function S(parts, wires) { return "MAKE SCHEMATIC: Circuit\n" + parts.join("\n") + "\n" + wires.join("\n") + "\nEND"; }
function lineOf(m) { return (/like: (wire \S+ \S+)$/.exec((m.problems || [])[0] || "") || [])[1] || ""; }
// e.line: the wire Lantern should hand ("" for none); e.after: "ok" (writing it makes a right circuit, drawn) or a
// regex the after-build's problems must match (Lantern still questions what is left)
function oc(id, harm, parts, wires, e) {
  return { id: id, harm: harm, input: S(parts, wires), right: e.right,
    run: function () {
      var m = lib.build(lib.D, S(parts, wires), e.q || Q), line = lineOf(m), bad = [];
      if (m.ok) return Promise.resolve("made as it stands: " + m.summary);
      if (line !== e.line) bad.push("the line is “" + (line || "none") + "”, want “" + (e.line || "none") + "” -- " + lib.short(m.problems[0], 300));
      (e.said || []).forEach(function (r) { if (!lib.rx(r).test(m.problems.join(" | "))) bad.push("the problem lacks /" + r + "/"); });
      if (line && e.after) {
        var a = lib.build(lib.D, S(parts, wires.concat([line])), e.q || Q);
        if (e.after === "ok" && !a.ok) bad.push("written, it is still refused: " + lib.short(a.problems.join(" | "), 300));
        if (e.after !== "ok" && (a.ok || !lib.rx(e.after).test(a.problems.join(" | ")))) bad.push("written, “" + line + "” " + (a.ok ? "is accepted as " + a.summary : "gets " + lib.short(a.problems.join(" | "), 300)) + " -- want /" + e.after + "/");
      }
      return Promise.resolve(bad.join("; "));
    } };
}
var B9 = 'part B1 battery "9 V"';
var cases = [
  oc("D-series-end", "high", [B9, "part S1 switch", "part L1 lamp"], ["wire B1 S1", "wire S1 L1"], { right: "the lamp back to the battery", line: "wire L1 B1", after: "ok" }),
  oc("D-series-ground", "high", [B9, "part S1 switch", "part L1 lamp", "part G1 ground"], ["wire B1 S1", "wire S1 L1", "wire L1 G1"], { right: "the ground back to the battery", line: "wire G1 B1", after: "ok" }),
  oc("D-parallel-ground", "high", [B9, "part J1 junction", "part L1 lamp", "part L2 lamp", "part G1 ground"], ["wire B1 J1", "wire J1 L1", "wire J1 L2", "wire L1 G1", "wire L2 G1"], { right: "both lamps to ground; the ground back to the battery", line: "wire G1 B1", after: "ok" }),
  oc("D-motor-lamp-ground", "medium", ['part B1 battery "12 V"', "part S1 switch", "part M1 motor", "part L1 lamp", "part G1 ground"], ["wire B1 S1", "wire S1 M1", "wire S1 L1", "wire M1 G1", "wire L1 G1"], { right: "the ground back", line: "wire G1 B1", after: "ok" }),
  oc("D-diode-end", "medium", [B9, "part D1 diode", "part L1 lamp"], ["wire B1 D1", "wire D1 L1"], { right: "the lamp back", line: "wire L1 B1", after: "ok" }),
  oc("D-rc-end", "medium", [B9, 'part R1 resistor "1 k"', 'part C1 capacitor "100 uF"'], ["wire B1 R1", "wire R1 C1"], { right: "the capacitor back (an RC charging circuit)", line: "wire C1 B1", after: "ok" }),
  oc("D-switch-end-after-lamp", "medium", [B9, "part L1 lamp", "part S1 switch"], ["wire B1 L1", "wire L1 S1"], { right: "the switch back (the lamp is in the loop)", line: "wire S1 B1", after: "ok" }),
  oc("D-source-ground", "medium", ['part V1 source "120 V"', "part L1 lamp", "part G1 ground"], ["wire V1 L1", "wire L1 G1"], { right: "the ground back to the source", line: "wire G1 V1", after: "ok" }),
  // ---- where no line is the right one -----------------------------------------------------------------------------
  oc("D-ground-midway", "high", [B9, "part L1 lamp", "part G1 ground", "part S1 switch"], ["wire B1 L1", "wire L1 G1", "wire G1 S1"], { right: "a switch beyond the ground: no line (it would be cut out)", line: "" }),
  oc("D-two-ends", "medium", [B9, "part J1 junction", "part L1 lamp", "part L2 lamp"], ["wire B1 J1", "wire J1 L1", "wire J1 L2"], { right: "two lamps could go back: no line", line: "" }),
  oc("D-battery-only-to-ground", "high", [B9, "part L1 lamp", "part G1 ground"], ["wire B1 G1", "wire L1 G1"], { right: "the battery's one wire is to ground: no ground line (it would lay a second wire beside the first)", line: "" }),
  oc("D-two-grounds", "low", [B9, "part L1 lamp", "part G1 ground", "part G2 ground", "part S1 switch"], ["wire B1 S1", "wire S1 L1", "wire L1 G1", "wire S1 G2"], { right: "two grounds: no line", line: "" }),
  oc("D-source-two-wires", "low", [B9, "part L1 lamp", "part L2 lamp"], ["wire B1 L1", "wire B1 L2"], { right: "the source has two wires out and none back: no line", line: "" }),
  // ---- where the line closes the circuit wrongly ------------------------------------------------------------------
  oc("D-short-through-switch", "high", [B9, "part S1 switch", "part L1 lamp", "part G1 ground"], ["wire B1 S1", "wire S1 G1", "wire S1 L1"],
    { right: "the ground is reached through the switch alone: no line (wire G1 B1 shorts the battery through S1); or, written, the short is questioned", line: "", after: "shorted|L1" }),
  oc("D-short-through-junction", "high", [B9, "part S1 switch", "part L1 lamp", "part G1 ground", "part J1 junction"], ["wire B1 J1", "wire J1 S1", "wire J1 G1", "wire S1 L1"],
    { right: "the ground is reached through a junction alone: no line (wire G1 B1 is a dead short, no part at all); or, written, the short is questioned", line: "", after: "shorted|L1" }),
  oc("D-lamp-bypassed", "high", [B9, "part S1 switch", "part L1 lamp", "part G1 ground", "part J1 junction"], ["wire B1 S1", "wire S1 J1", "wire J1 G1", "wire J1 L1"],
    { right: "the lamp hangs off the junction that goes to ground: no line, or written, questioned", line: "", after: "shorted|L1" }),
  oc("D-junction-end", "medium", [B9, "part S1 switch", "part J1 junction"], ["wire B1 S1", "wire S1 J1"], { q: "draw a battery, a switch and a junction",
    right: "the junction at the end has only a switch before it: no line (wire J1 B1 shorts the battery through S1)", line: "" }),
  oc("D-island", "medium", [B9, "part S1 switch", "part L1 lamp", "part L2 lamp", "part L3 lamp"], ["wire B1 S1", "wire S1 L1", "wire L2 L3", "wire L3 L2"],
    { right: "with the line written, L2 and L3 (wired only to each other, never to the battery) are still questioned", line: "wire L1 B1", after: "L2|L3" }),
  oc("D-ground-and-loose-lamp", "low", [B9, "part S1 switch", "part L1 lamp", "part L2 lamp", "part G1 ground"], ["wire B1 S1", "wire S1 L1", "wire L1 G1", "wire S1 L2"],
    { right: "the line, with L2 named; written, L2 on one wire is still questioned, not accepted without a word", line: "wire G1 B1", said: ["L2 is on one wire too"], after: "L2" }),
  { id: "D-35b-second-try", harm: "medium", input: "the 35B's second reply (Adam's chat), for a circuit question",
    right: "the ground line with S5 and S7 named; written, the stop buttons on one wire each are still questioned (a stop button on one wire stops nothing)",
    run: function () {
      var R2 = lib.Q35.replies[1].reply, q = "draw a circuit with a source, switches, two motors and three lamps", m = lib.build(lib.D, R2, q);
      if (!/S5 and S7 are on one wire too.*like: wire G1 V1$/.test(m.problems[0] || "")) return Promise.resolve("the line: " + (m.problems[0] || "none"));
      var a = lib.build(lib.D, R2.replace("wire L3 G1\n", "wire L3 G1\nwire G1 V1\n"), q);
      return Promise.resolve(lib.want(!a.ok && /S5|S7/.test(a.problems.join(" ")), "written, it is accepted: " + (a.ok ? a.summary : a.problems.join(" | "))));
    } },
  // ---- the line where the model named a terminal ---------------------------------------------------------------------
  // (drawn in Chromium, the line wire G1 B1 after wire B1+ S1 puts G1 on the battery's other side: right). But AI_SCHEMATIC_CHECK's
  // netlist puts B1+ and an unnamed second wire on the same terminal, so a short written that way is not seen: the line
  // writes exactly that mix (a named terminal, then an unnamed one)
  { id: "D-port-short-unseen", harm: "low", input: "wire B1+ S1, wire S1 B1 (a battery shorted through a switch, its + named)",
    right: "questioned as a short, as wire B1 S1, wire S1 B1 is",
    run: function () {
      var a = lib.build(lib.D, "MAKE SCHEMATIC: C\npart B1 battery \x229 V\x22\npart S1 switch\nwire B1+ S1\nwire S1 B1\nEND", "draw a battery and a switch");
      return Promise.resolve(lib.want(!a.ok && /shorted/.test(a.problems.join(" ")), "accepted: " + (a.ok ? a.summary : a.problems.join(" | "))));
    } },
  // ---- what has not changed --------------------------------------------------------------------------------------------
  { id: "D-hydraulic-no-line", harm: "medium", input: "a hydraulic circuit whose pump does not reach its tank",
    right: "as 1.24.33: no electrical line",
    run: function () {
      var t = "MAKE SCHEMATIC: Press\nmode hydraulic\npart P1 pump\npart T1 tank\npart V1 valve\npart C1 cylinder\nwire P1 V1\nwire V1 C1\nEND", q = "draw a hydraulic circuit with a pump, a tank, a valve and a cylinder";
      var a = lib.build(lib.D, t, q), b = lib.build(lib.P, t, q);
      return Promise.resolve(lib.want(JSON.stringify(a.problems) === JSON.stringify(b.problems), "draft " + a.problems.join(" | ") + " / was " + b.problems.join(" | ")));
    } },
  { id: "D-closed-unchanged", harm: "high", input: "a closed series circuit", right: "made, as 1.24.33",
    run: function () { var t = S([B9, "part S1 switch", "part L1 lamp"], ["wire B1 S1", "wire S1 L1", "wire L1 B1"]), a = lib.build(lib.D, t, Q), b = lib.build(lib.P, t, Q); return Promise.resolve(lib.want(a.ok && b.ok && a.summary === b.summary, a.summary + " / " + b.summary)); } }
];
module.exports = cases;
