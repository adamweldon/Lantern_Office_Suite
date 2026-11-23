// cases_a.js -- AI_SCHEMATIC parseSchematic's two new general checks (1.24.34, the second review): a two-terminal part
// "wired on one side only", and parts "not joined to the circuit of" the source. They apply to every closed electrical
// MAKE SCHEMATIC, so most cases here are RIGHT circuits a model writes for the bench and for learners: each must be made
// with no problem, as 1.24.33 made it. Then the wrong circuits the checks are for, and what the checks do beside them.
"use strict";
var lib = require("./lib.js");
var Q = "\x22";
function blk(title, lines) { return lib.sch(title, ["mode electrical"].concat(lines)); }
// a right circuit: made, ok, no problem (and 1.24.33 made it too)
function right(id, q, lines, why, harm) {
  return { id: id, harm: harm || "high", right: true, input: { q: q, lines: lines }, why: why,
    run: async function (x) {
      var t = blk(id, lines), m = lib.build(x.N.L, t, q), o = lib.build(x.O.L, t, q);
      if (!(o && o.ok)) return "SETUP: 1.24.33 did not make it either (" + lib.probs(o) + ")";
      if (!(m && m.ok)) return "a right circuit is sent back: " + lib.probs(m) + (m && m.plan ? "" : " (and nothing is drawn)");
      return "";
    } };
}
// a wrong circuit: the problem named (re), and no other
function wrong(id, q, lines, re, why, harm) {
  return { id: id, harm: harm || "medium", right: false, input: { q: q, lines: lines }, why: why,
    run: async function (x) {
      var m = lib.build(x.N.L, blk(id, lines), q);
      if (m && m.ok) return "made as it stands: " + (m.summary || "");
      if (!re.test(lib.probs(m))) return "the problem said is not the one expected (" + re + "): " + lib.probs(m);
      return "";
    } };
}
var C = [];
// ---- right circuits ------------------------------------------------------------------------------------------
C.push(right("A-series-2", "draw a battery and two lamps in series", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part L2 lamp", "wire B1 L1", "wire L1 L2", "wire L2 B1"], "two lamps in series"));
C.push(right("A-par-junctions", "draw a battery and two lamps in parallel", ["part B1 battery " + Q + "9 V" + Q, "part J1 junction", "part J2 junction", "part L1 lamp", "part L2 lamp", "wire B1 J1", "wire J1 L1", "wire J1 L2", "wire L1 J2", "wire L2 J2", "wire J2 B1"], "parallel through two junctions"));
C.push(right("A-par-direct", "draw a battery and two lamps in parallel", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part L2 lamp", "wire B1 L1", "wire L1 B1", "wire B1 L2", "wire L2 B1"], "each lamp wired across the battery (the guide's own line for parallel)"));
C.push(right("A-ladder-3", "draw a battery with three lamps in parallel", ["part B1 battery " + Q + "12 V" + Q, "part L1 lamp", "part L2 lamp", "part L3 lamp", "part J1 junction", "part J2 junction", "wire B1 J1", "wire J1 L1", "wire J1 L2", "wire J1 L3", "wire L1 J2", "wire L2 J2", "wire L3 J2", "wire J2 B1"], "a ladder of three lamps"));
C.push(right("A-ladder-4-chains", "draw four lamps in parallel on a 12 V battery", ["part B1 battery " + Q + "12 V" + Q, "part L1 lamp", "part L2 lamp", "part L3 lamp", "part L4 lamp", "part J1 junction", "part J2 junction", "wire B1 J1", "wire J1 L1 J2", "wire J1 L2 J2", "wire J1 L3 J2", "wire J1 L4 J2", "wire J2 B1"], "a ladder written as three-ID wire chains"));
C.push(right("A-vm-double", "draw a battery, a lamp and a voltmeter across the lamp", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part VM1 voltmeter", "wire B1 L1", "wire L1 B1", "wire L1 VM1", "wire VM1 L1"], "a voltmeter across a lamp, its two wires to the lamp (the check's own line)"));
C.push(right("A-vm-junctions", "draw a battery, a lamp and a voltmeter across the lamp", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part VM1 voltmeter", "part J1 junction", "part J2 junction", "wire B1 J1", "wire J1 L1", "wire L1 J2", "wire J2 B1", "wire J1 VM1", "wire VM1 J2"], "a voltmeter across a lamp through junctions"));
C.push(right("A-ammeter", "draw a battery, a resistor and an ammeter", ["part B1 battery " + Q + "9 V" + Q, "part A1 ammeter", "part R1 resistor " + Q + "100 ohm" + Q, "wire B1 A1", "wire A1 R1", "wire R1 B1"], "an ammeter in series"));
C.push(right("A-vm-am", "draw a circuit to measure the current through a resistor and the voltage across it", ["part V1 source " + Q + "12 V" + Q, "part A1 ammeter", "part R1 resistor " + Q + "100 ohm" + Q, "part VM1 voltmeter", "part J1 junction", "part J2 junction", "wire V1 A1", "wire A1 J1", "wire J1 R1", "wire R1 J2", "wire J2 V1", "wire J1 VM1", "wire VM1 J2"], "ammeter in line, voltmeter across"));
C.push(right("A-led-res", "draw an LED with a resistor and a 9 V battery", ["part B1 battery " + Q + "9 V" + Q, "part R1 resistor " + Q + "470 ohm" + Q, "part D1 diode " + Q + "LED red" + Q, "wire B1 R1", "wire R1 D1", "wire D1 B1"], "an LED and its resistor"));
C.push(right("A-motor-switch", "draw a battery, a switch and a motor", ["part B1 battery " + Q + "6 V" + Q, "part S1 switch", "part M1 motor", "wire B1 S1", "wire S1 M1", "wire M1 B1"], "a motor and its switch"));
C.push(right("A-fuse-as-res", "draw a 12 V lamp circuit with a fuse and a switch", ["part B1 battery " + Q + "12 V" + Q, "part F1 resistor " + Q + "fuse 5 A" + Q, "part S1 switch", "part L1 lamp", "wire B1 F1", "wire F1 S1", "wire S1 L1", "wire L1 B1"], "a fuse drawn as a resistor (there is no fuse part)"));
C.push(right("A-gnd-return", "draw a battery, a switch and a lamp, with the return through ground", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "part G1 ground", "wire B1 S1", "wire S1 L1", "wire L1 G1", "wire G1 B1"], "a ground used as the return"));
C.push(right("A-gnd-fold", "draw a 12 V battery with two resistors in parallel", ["part V1 battery " + Q + "12 V" + Q, "part R1 resistor " + Q + "4 ohm" + Q, "part R2 resistor " + Q + "6 ohm" + Q, "part G1 ground", "wire V1 R1", "wire V1 R2", "wire R1 G1", "wire R2 G1", "wire V1 G1"], "the 35B's ground-as-return (1.12.6)"));
C.push(right("A-gnd-implied", "draw a 5 V supply, a resistor and an LED, with ground", ["part V1 source " + Q + "5 V" + Q, "part R1 resistor " + Q + "220 ohm" + Q, "part D1 diode " + Q + "LED" + Q, "wire V1 R1", "wire R1 D1", "wire D1 GND", "wire GND V1"], "a GND no part line made"));
C.push(right("A-gnd-midway", "draw a battery, a lamp and a switch, with a ground on the return", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part G1 ground", "part S1 switch", "wire B1 L1", "wire L1 G1", "wire G1 S1", "wire S1 B1"], "a ground on the way round"));
C.push(right("A-gnd-two-loads", "draw two lamps in parallel on a battery, returning through ground", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part L2 lamp", "part G1 ground", "wire B1 L1", "wire B1 L2", "wire L1 G1", "wire L2 G1", "wire G1 B1"], "two loads to one ground, the ground to the battery"));
C.push(right("A-polarity", "draw a battery and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "wire B1+ L1", "wire L1 B1-"], "B1+ and B1- terminals"));
C.push(right("A-polarity-ports", "draw a battery, a switch and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "wire B1+ S1", "wire S1 L1.1", "wire L1.2 B1-"], "terminals by number and polarity"));
C.push(right("A-ports-numbers", "draw a battery, a resistor and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part R1 resistor " + Q + "10 ohm" + Q, "part L1 lamp", "wire B1.1 R1.1", "wire R1.2 L1.1", "wire L1.2 B1.2"], "every end a numbered terminal"));
C.push(right("A-chain", "draw a battery, a switch and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "wire B1 S1 L1 B1"], "one wire A B C chain"));
C.push(right("A-chain-arrows", "draw a battery, a switch and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "wire B1 -> S1 -> L1 -> B1"], "a chain with arrows"));
C.push(right("A-chain-plus-branch", "draw a battery, a switch and two lamps in parallel after the switch", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "part L2 lamp", "wire B1 S1 L1 B1", "wire S1 L2 B1"], "two chains sharing S1"));
C.push(right("A-twice", "draw a battery and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "wire B1 L1", "wire B1 L1", "wire L1 B1"], "a wire written twice"));
C.push(right("A-lower", "draw a battery, a switch and a lamp", ["part b1 battery " + Q + "9 V" + Q, "part s1 switch", "part l1 lamp", "wire b1 s1", "wire s1 l1", "wire l1 b1"], "IDs in lower case"));
C.push(right("A-mixed-case", "draw a battery, a switch and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "wire b1 S1", "wire s1 l1", "wire L1 b1"], "the same IDs in both cases"));
C.push(right("A-to-word", "draw a battery and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "wire B1 to L1", "wire L1 to B1"], "wire A to B"));
C.push(right("A-reversed", "draw a battery, a switch and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "wire L1 B1", "wire S1 L1", "wire B1 S1"], "wires written against the flow"));
C.push(right("A-ser-par", "draw a 4 ohm resistor in series with 6 ohm and 12 ohm resistors in parallel on 12 V", ["part V1 source " + Q + "12 V" + Q, "part R1 resistor " + Q + "4 ohm" + Q, "part R2 resistor " + Q + "6 ohm" + Q, "part R3 resistor " + Q + "12 ohm" + Q, "part J1 junction", "part J2 junction", "wire V1 R1", "wire R1 J1", "wire J1 R2", "wire J1 R3", "wire R2 J2", "wire R3 J2", "wire J2 V1"], "series-parallel"));
C.push(right("A-sw-or", "draw two switches in parallel controlling one lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part S2 switch", "part L1 lamp", "part J1 junction", "part J2 junction", "wire B1 J1", "wire J1 S1", "wire J1 S2", "wire S1 J2", "wire S2 J2", "wire J2 L1", "wire L1 B1"], "two switches in parallel (either lights it)"));
C.push(right("A-sw-and", "draw two switches in series controlling one lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part S2 switch", "part L1 lamp", "wire B1 S1", "wire S1 S2", "wire S2 L1", "wire L1 B1"], "two switches in series (both to light it)"));
C.push(right("A-each-own-switch", "draw two lamps in parallel, each with its own switch", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part S2 switch", "part L1 lamp", "part L2 lamp", "part J1 junction", "part J2 junction", "wire B1 J1", "wire J1 S1", "wire S1 L1", "wire L1 J2", "wire J1 S2", "wire S2 L2", "wire L2 J2", "wire J2 B1"], "a ladder of switch-and-lamp rungs"));
C.push(right("A-rc", "draw an RC circuit with a battery, a resistor and a capacitor", ["part B1 battery " + Q + "9 V" + Q, "part R1 resistor " + Q + "10 k" + Q, "part C1 capacitor " + Q + "100 uF" + Q, "wire B1 R1", "wire R1 C1", "wire C1 B1"], "an RC charging circuit"));
C.push(right("A-cap-across", "draw a lamp with a smoothing capacitor across the supply", ["part V1 source " + Q + "12 V" + Q, "part C1 capacitor " + Q + "1000 uF" + Q, "part L1 lamp", "wire V1 L1", "wire L1 V1", "wire V1 C1", "wire C1 V1"], "a capacitor across the supply"));
C.push(right("A-vm-battery", "draw a battery, a lamp and a voltmeter across the battery", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part VM1 voltmeter", "wire B1 L1", "wire L1 B1", "wire B1 VM1", "wire VM1 B1"], "a voltmeter across the battery"));
C.push(right("A-two-cells", "draw two 1.5 V cells in series lighting a lamp", ["part B1 battery " + Q + "1.5 V" + Q, "part B2 battery " + Q + "1.5 V" + Q, "part L1 lamp", "wire B1 B2", "wire B2 L1", "wire L1 B1"], "two cells in series"));
C.push(right("A-flyback", "draw a 12 V motor with a switch and a flyback diode across the motor", ["part B1 battery " + Q + "12 V" + Q, "part S1 switch", "part M1 motor", "part D1 diode " + Q + "1N4007" + Q, "wire B1 S1", "wire S1 M1", "wire M1 B1", "wire M1 D1", "wire D1 M1"], "a diode across the motor"));
C.push(right("A-diode-series", "draw a battery, a diode for reverse polarity protection and a motor", ["part B1 battery " + Q + "12 V" + Q, "part D1 diode " + Q + "1N4007" + Q, "part M1 motor", "wire B1 D1", "wire D1 M1", "wire M1 B1"], "a diode in series"));
C.push(right("A-led-across-motor", "draw a motor with an indicator LED and its resistor across it", ["part B1 battery " + Q + "12 V" + Q, "part S1 switch", "part M1 motor", "part R1 resistor " + Q + "1 k" + Q, "part D1 diode " + Q + "LED" + Q, "part J1 junction", "part J2 junction", "wire B1 S1", "wire S1 J1", "wire J1 M1", "wire M1 J2", "wire J1 R1", "wire R1 D1", "wire D1 J2", "wire J2 B1"], "an LED branch across a motor"));
C.push(right("A-changeover", "draw a switch that changes between two lamps", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "part L2 lamp", "wire B1 S1", "wire S1 L1", "wire S1 L2", "wire L1 B1", "wire L2 B1"], "one switch to two lamps"));
C.push(right("A-synonyms", "draw a cell and a bulb", ["part C1 cell " + Q + "1.5 V" + Q, "part B1 bulb", "wire C1 B1", "wire B1 C1"], "cell and bulb"));
C.push(right("A-implied-j", "draw two lamps in parallel on a 9 V battery", ["part V1 battery " + Q + "9 V" + Q, "part L1 lamp", "part L2 lamp", "wire V1 J1", "wire J1 L1", "wire J1 L2", "wire L1 J2", "wire L2 J2", "wire J2 V1"], "junctions no part line made"));
C.push(right("A-choke", "draw a lamp with an inductor in series on AC", ["part V1 source " + Q + "120 V AC" + Q, "part X1 inductor " + Q + "choke" + Q, "part L1 lamp", "wire V1 X1", "wire X1 L1", "wire L1 V1"], "an inductor in series"));
C.push(right("A-lamp-motor-par", "draw a lamp and a motor in parallel with one switch", ["part B1 battery " + Q + "12 V" + Q, "part S1 switch", "part L1 lamp", "part M1 motor", "part J1 junction", "part J2 junction", "wire B1 S1", "wire S1 J1", "wire J1 L1", "wire J1 M1", "wire L1 J2", "wire M1 J2", "wire J2 B1"], "a lamp and a motor in parallel"));
C.push(right("A-notes", "draw three resistors in series on 12 V and show the total resistance", ["part V1 source " + Q + "12 V" + Q, "part R1 resistor " + Q + "4 ohm" + Q, "part R2 resistor " + Q + "6 ohm" + Q, "part R3 resistor " + Q + "12 ohm" + Q, "wire V1 R1", "wire R1 R2", "wire R2 R3", "wire R3 V1", "note Rt = R1 + R2 + R3 = {=4+6+12} ohm"], "with a note line"));
C.push(right("A-charger", "draw a solar panel charging a battery through a diode, and the battery lighting a lamp through a switch", ["part PV1 source " + Q + "solar panel 18 V" + Q, "part D1 diode " + Q + "1N5819" + Q, "part B1 battery " + Q + "12 V" + Q, "part S1 switch", "part L1 lamp", "wire PV1 D1", "wire D1 B1", "wire B1 PV1", "wire B1 S1", "wire S1 L1", "wire L1 B1"], "a source and a battery in one circuit"));
C.push(right("A-vm-ports", "draw a resistor on a battery with a voltmeter across the resistor", ["part B1 battery " + Q + "9 V" + Q, "part R1 resistor " + Q + "100 ohm" + Q, "part VM1 voltmeter", "wire B1 R1.1", "wire R1.2 B1", "wire VM1.1 R1.1", "wire VM1.2 R1.2"], "a voltmeter on the resistor's two numbered terminals"));
// ---- right circuits the new "not joined" check sends back ----------------------------------------------------
// Two circuits in one block, a transformer drawn as two coils, a motor turning a generator: the second circuit is joined
// to the first by nothing but a field or a shaft (or by nothing: two examples side by side). 1.24.33 drew them; now
// they go back with "wire them into it, or leave them out" -- either of which spoils a right answer. (A transformer's
// secondary wired into its primary is the one thing a transformer is there to prevent.)
C.push(right("A-two-circuits", "draw a series circuit and a parallel circuit, each with its own battery and two lamps", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part L2 lamp", "part B2 battery " + Q + "9 V" + Q, "part L3 lamp", "part L4 lamp", "wire B1 L1", "wire L1 L2", "wire L2 B1", "wire B2 L3", "wire L3 B2", "wire B2 L4", "wire L4 B2"],
  "Two circuits in one block, each closed: 1.24.33 made it; now 'B2, L3 and L4 are not joined to the circuit of B1: wire them into it, or leave them out'. Right: draw both, or ask for each in a block of its own (rest() now makes a reply's second block).", "medium"));
C.push(right("A-transformer", "draw a step-down transformer with a lamp on the secondary", ["part V1 source " + Q + "120 V AC" + Q, "part T1 inductor " + Q + "primary" + Q, "part T2 inductor " + Q + "secondary" + Q, "part L1 lamp", "wire V1 T1", "wire T1 V1", "wire T2 L1", "wire L1 T2"],
  "A transformer as two coils (MAKE SCHEMATIC has no transformer): the secondary is joined to the primary by the core only. Now 'wire them into it': copied, the lamp's circuit is wired to the 120 V side.", "medium"));
C.push(right("A-motor-generator", "draw a battery driving a motor that turns a generator, and the generator lighting a lamp", ["part B1 battery " + Q + "12 V" + Q, "part S1 switch", "part M1 motor", "part G2 generator " + Q + "dynamo" + Q, "part L1 lamp", "wire B1 S1", "wire S1 M1", "wire M1 B1", "wire G2 L1", "wire L1 G2"],
  "A generator is a source (SYN): two sources, the second joined by a shaft. Sent back as 'not joined'.", "low"));
// ---- wrong circuits the new checks are for ---------------------------------------------------------------------
C.push(wrong("A-w-lamp-one-side", "draw a battery and two lamps in parallel", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part L2 lamp", "wire B1 L1", "wire L1 B1", "wire B1 L2"], /L2 is wired on one side only, to B1/, "L2's other end unwired: it never lights"));
C.push(wrong("A-w-lamps-apart", "draw a battery and three lamps", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part L2 lamp", "part L3 lamp", "wire B1 L1", "wire L1 B1", "wire L2 L3", "wire L3 L2"], /L2 and L3 are not joined to the circuit of B1/, "two lamps joined only to each other"));
C.push(wrong("A-w-vm-one-lead", "draw a battery, a lamp and a voltmeter across the lamp", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part VM1 voltmeter", "wire B1 L1", "wire L1 B1", "wire L1 VM1"], /VM1 is wired on one side only, to L1/, "a voltmeter with one lead"));
C.push(wrong("A-w-stop-dangling", "draw a motor with a start switch and a stop switch", ["part B1 battery " + Q + "12 V" + Q, "part S1 switch " + Q + "start" + Q, "part S2 switch " + Q + "stop" + Q, "part M1 motor", "wire B1 S1", "wire S1 M1", "wire M1 B1", "wire M1 S2"], /S2 \(“stop”\) is wired on one side only, to M1/, "the 35B's stop button on one wire"));
C.push(wrong("A-w-res-to-ground", "draw a battery, a lamp and a resistor", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part R1 resistor " + Q + "100 ohm" + Q, "part G1 ground", "wire B1 L1", "wire L1 G1", "wire G1 B1", "wire R1 G1"], /R1 \(“100 ohm”\) is wired on one side only, to G1/, "a resistor hanging from the ground"));
C.push(wrong("A-w-cap-apart-loop", "draw a battery, a lamp, a resistor and a capacitor", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part R1 resistor " + Q + "1 k" + Q, "part C1 capacitor " + Q + "10 uF" + Q, "wire B1 L1", "wire L1 B1", "wire R1 C1", "wire C1 R1"], /R1 and C1 are not joined to the circuit of B1/, "an RC loop with no source"));
// ---- what the checks do beside them -------------------------------------------------------------------------------
// (1.13.4) "what the hooks question ... is drawn all the same, so the person sees what Lantern means; the block still goes
// back to the AI once". The two new checks are in parseSchematic, so a circuit they question is not drawn at all: a
// closed lamp circuit with a voltmeter on one lead was drawn by 1.24.33, and is now "Lantern could not make" if the
// correction keeps it.
C.push({ id: "A-one-side-not-drawn", harm: "low", right: false, input: { q: "draw a battery, a lamp and a voltmeter across the lamp" },
  why: "A closed circuit with one part on one wire: questioned, and (as the hooks' questions are) drawn so the person sees it.",
  run: async function (x) {
    var t = blk("Lamp", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part VM1 voltmeter", "wire B1 L1", "wire L1 B1", "wire L1 VM1"]);
    var m = lib.build(x.N.L, t, "draw a battery, a lamp and a voltmeter across the lamp"), o = lib.build(x.O.L, t, "draw a battery, a lamp and a voltmeter across the lamp");
    if (m && !m.ok && !m.plan && o && o.plan) return "questioned and now not drawn at all (1.24.33 drew it); a hook's question is drawn and sent back -- these are in parseSchematic, so nothing is shown if the correction keeps the part";
    return "";
  } });
// The 0.8B's parallel lamps (bench_run_1247_08b.json, make-parallel-lamps, its first reply): a second source V2 wired to
// V1 only, AND the two lamps wired to each other. 1.24.33 said the second, with the lines to write (wire V1 L1, wire L1
// V1; wire V1 L2, wire L2 V1); now the one-side check runs first in parseSchematic and the series-for-parallel check,
// a draw hook, never runs: the model is told only about V2, and has one correction.
C.push({ id: "A-masks-parallel-line", harm: "low", right: false, input: { file: "bench_run_1247_08b.json", row: "make-parallel-lamps" },
  why: "Both problems said in the one correction, or the one with the lines that mend what the question asks for.",
  run: async function (x) {
    var q = "Draw a circuit in which one battery lights two lamps connected in parallel.";
    var t = "MAKE SCHEMATIC: Parallel Lamp Circuit\nmode electrical\npart V1 source \x2212 V\x22\npart V2 source \x2212 V\x22\npart L1 lamp \x22100 W\x22\npart L2 lamp \x22100 W\x22\npart R1 resistor \x22100 ohm\x22\nwire V1 V2\nwire V1 R1\nwire R1 L1\nwire R1 L2\nwire L1 L2\nwire L2 V1\nEND";
    var m = lib.build(x.N.L, t, q), p = lib.probs(m);
    if (/wired on one side only/.test(p) && !/in parallel/.test(p)) return "only the one-side problem is said: " + p + " (1.24.33: " + lib.probs(lib.build(x.O.L, t, q)) + ")";
    return "";
  } });
module.exports = C;
