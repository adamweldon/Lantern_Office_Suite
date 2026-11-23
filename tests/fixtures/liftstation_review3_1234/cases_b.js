// cases_b.js -- the open circuit's line (1.24.34; the second review: only where every way from the source to that place
// passes a load). Each case: a circuit that is not closed, the line Lantern should hand back (or none, where any line
// would short the source or the place is the model's to say), and -- where a line is given -- the block with the line
// copied in must then be made (rule 3: the line is for THIS circuit).
"use strict";
var lib = require("./lib.js");
var Q = "\x22";
function blk(title, lines) { return lib.sch(title, ["mode electrical"].concat(lines)); }
// want: "wire X Y" (that line, and copying it makes the circuit), or null (no line: "(add the wire that returns to it)")
function oc(id, q, lines, want, why, harm, after) {
  return { id: id, harm: harm || "medium", right: false, input: { q: q, lines: lines }, why: why,
    run: async function (x) {
      var m = lib.build(x.N.L, blk(id, lines), q), p = (m && m.problems || []).filter(function (s) { return /not closed/.test(s); })[0] || "";
      if (!p) return "no open-circuit problem: " + lib.probs(m);
      var ln = /like: wire \S+ \S+$/.test(p) ? lib.lineOf(p) : null;
      if (want === null) return ln ? "a line is handed back where none is right: " + p : "";
      if (ln !== want) return "the line is " + (ln ? "“" + ln + "”" : "not given") + ", want “" + want + "”: " + p;
      var m2 = lib.build(x.N.L, blk(id, lines.concat([want])), q);
      if (after) return after(m2) || "";
      if (!(m2 && m2.ok)) return "the line copied in does not make it: " + lib.probs(m2);
      return "";
    } };
}
var C = [];
C.push(oc("B-lamp-end", "draw a battery, a switch and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "wire B1 S1", "wire S1 L1"], "wire L1 B1", "the chain stops at the lamp"));
C.push(oc("B-switch-end", "draw a battery, a lamp and a switch", ["part B1 battery " + Q + "9 V" + Q, "part L1 lamp", "part S1 switch", "wire B1 L1", "wire L1 S1"], "wire S1 B1", "the chain stops at a switch after the lamp: the way to it passes the lamp"));
C.push(oc("B-motor-end", "draw a battery, a switch and a motor", ["part B1 battery " + Q + "6 V" + Q, "part S1 switch", "part M1 motor", "wire B1 S1", "wire S1 M1"], "wire M1 B1", "a motor at the end"));
C.push(oc("B-cap-end", "draw a battery, a resistor and a capacitor", ["part B1 battery " + Q + "9 V" + Q, "part R1 resistor " + Q + "10 k" + Q, "part C1 capacitor " + Q + "100 uF" + Q, "wire B1 R1", "wire R1 C1"], "wire C1 B1", "an RC chain"));
C.push(oc("B-led-end", "draw an LED, a resistor and a 9 V battery", ["part B1 battery " + Q + "9 V" + Q, "part R1 resistor " + Q + "470 ohm" + Q, "part D1 diode " + Q + "LED" + Q, "wire B1 R1", "wire R1 D1"], "wire D1 B1", "the LED at the end"));
C.push(oc("B-led-no-res", "draw an LED and a 9 V battery", ["part B1 battery " + Q + "9 V" + Q, "part D1 diode " + Q + "LED" + Q, "wire B1 D1"], "wire D1 B1", "an LED alone: the line closes it and Lantern's LED check adds the resistor, and says so",
  "medium", function (m2) { return m2 && m2.ok && /resistor/i.test(m2.summary || "") ? "" : "copied, the LED is across 9 V with no resistor added: " + lib.probs(m2) + " " + (m2 && m2.summary); }));
C.push(oc("B-ammeter-alone", "draw a battery and an ammeter", ["part B1 battery " + Q + "9 V" + Q, "part A1 ammeter", "wire B1 A1"], null, "an ammeter alone across the battery would be a short: no line"));
C.push(oc("B-ammeter-after-res", "draw a battery, a resistor and an ammeter", ["part B1 battery " + Q + "9 V" + Q, "part R1 resistor " + Q + "100 ohm" + Q, "part A1 ammeter", "wire B1 R1", "wire R1 A1"], "wire A1 B1", "an ammeter after the resistor: closing it is right"));
C.push(oc("B-switch-alone", "draw a battery and a switch", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "wire B1 S1"], null, "a switch alone: the line would short the battery"));
C.push(oc("B-two-ends", "draw a battery and two lamps", ["part B1 battery " + Q + "9 V" + Q, "part J1 junction", "part L1 lamp", "part L2 lamp", "wire B1 J1", "wire J1 L1", "wire J1 L2"], null, "two lamps each on one wire: the place is the model's to say"));
C.push(oc("B-gnd-end", "draw a battery, a switch and a lamp, returning through ground", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "part G1 ground", "wire B1 S1", "wire S1 L1", "wire L1 G1"], "wire G1 B1", "the current reaches the ground: join it to the battery"));
C.push(oc("B-gnd-bare-branch", "draw a battery, a lamp and a switch, returning through ground", ["part B1 battery " + Q + "9 V" + Q, "part J1 junction", "part L1 lamp", "part S1 switch", "part G1 ground", "wire B1 J1", "wire J1 L1", "wire L1 G1", "wire J1 S1", "wire S1 G1"], null, "a switch straight to the ground beside the lamp: the line would short the battery through S1"));
C.push(oc("B-gnd-via-switch", "draw a battery, a switch and a lamp, with ground", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part G1 ground", "part L1 lamp", "wire B1 S1", "wire S1 G1", "wire G1 L1"], null, "the ground reached through a switch alone (the lamp past it): no ground line"));
C.push(oc("B-two-batteries", "draw two batteries and a lamp", ["part B1 battery " + Q + "1.5 V" + Q, "part L1 lamp", "part B2 battery " + Q + "1.5 V" + Q, "wire B1 L1", "wire L1 B2"], "wire B2 B1", "a second cell at the end: closing it puts the two in series with the lamp"));
C.push(oc("B-resistor-chain", "draw three resistors in series on a 12 V supply", ["part V1 source " + Q + "12 V" + Q, "part R1 resistor " + Q + "4 ohm" + Q, "part R2 resistor " + Q + "6 ohm" + Q, "part R3 resistor " + Q + "12 ohm" + Q, "wire V1 R1", "wire R1 R2", "wire R2 R3"], "wire R3 V1", "the 35B's Ohm's-law chain, last wire missing"));
C.push(oc("B-coil-end", "draw an inductor, a switch and a battery", ["part B1 battery " + Q + "12 V" + Q, "part S1 switch", "part X1 inductor " + Q + "choke" + Q, "wire B1 S1", "wire S1 X1"], "wire X1 B1", "an inductor at the end"));
C.push(oc("B-stop-also", "draw a motor with a switch and a lamp, returning through ground", ["part B1 battery " + Q + "12 V" + Q, "part S1 switch", "part M1 motor", "part L1 lamp", "part G1 ground", "part S2 switch " + Q + "stop" + Q, "wire B1 S1", "wire S1 M1", "wire M1 G1", "wire S1 L1", "wire L1 G1", "wire M1 S2"], "wire G1 B1", "a ground end, and a stop switch on one wire named before the line",
  "medium", function (m2) { return m2 && !m2.ok && /S2 \(“stop”\) is wired on one side only/.test(lib.probs(m2)) ? "" : "with the ground joined, the stop switch on one wire is not questioned: " + lib.probs(m2); }));
// a right line Lantern could give and does not: the parallel ladder with its return missing (the bench's parallel lamps)
C.push(oc("B-ladder-no-return", "draw a battery and two lamps in parallel", ["part B1 battery " + Q + "9 V" + Q, "part J1 junction", "part J2 junction", "part L1 lamp", "part L2 lamp", "wire B1 J1", "wire J1 L1", "wire J1 L2", "wire L1 J2", "wire L2 J2"], "wire J2 B1",
  "Every way from B1 ends at J2 (two wires in, none out): the line wire J2 B1 closes it, and is withheld because J2 has two wires, not one. The slip a small model makes on the bench's parallel lamps.", "low"));
// a line that Lantern's next check then sends back
C.push(oc("B-vm-in-series", "draw a battery, a voltmeter and a lamp", ["part B1 battery " + Q + "9 V" + Q, "part VM1 voltmeter", "part L1 lamp", "wire B1 VM1", "wire VM1 L1"], null,
  "A voltmeter in the chain: the line wire L1 B1 closes a loop with the voltmeter in series, which the next check sends back (a voltmeter goes across what it measures). The way passes a load only because the voltmeter counts as one.", "low"));
// a resistor that is a fuse or a wire: a load to the rule
C.push(oc("B-fuse-alone", "draw a battery and a fuse", ["part B1 battery " + Q + "12 V" + Q, "part F1 resistor " + Q + "fuse" + Q, "wire B1 F1"], null,
  "A fuse written as a resistor (there is no fuse part), alone on the battery: the line wire F1 B1 puts a fuse straight across the battery, a short that blows it.", "low"));
// two ground symbols: a ground used as the return, as schematics draw it -- not closed to Lantern (as in 1.24.33)
C.push({ id: "B-two-ground-symbols", harm: "low", right: true, input: { q: "draw a battery, a switch and a lamp, with ground" },
  why: "Every ground symbol is one node: the battery's minus to G1 and the lamp to G2 is a closed circuit as any schematic draws it. Sent back as not closed (1.24.33 the same; not this change's, but a guard case of 'a ground used as return').",
  run: async function (x) {
    var m = lib.build(x.N.L, blk("Lamp", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "part G1 ground", "part G2 ground", "wire B1 S1", "wire S1 L1", "wire L1 G2", "wire B1 G1"]), "draw a battery, a switch and a lamp, with ground");
    return m && m.ok ? "" : "sent back: " + lib.probs(m);
  } });
// the source with two wires, one end open: no line (rule 7), and no new wording
C.push(oc("B-src-two-wires", "draw a battery, a switch and two lamps", ["part B1 battery " + Q + "9 V" + Q, "part S1 switch", "part L1 lamp", "part L2 lamp", "wire B1 S1", "wire S1 L1", "wire B1 L2"], null, "the battery has two wires, both ending at lamps: no single line"));
// the 35B's second try in Adam's chat is the test file's; a lift station circuit with a horn on the ground
C.push(oc("B-gnd-many-loads", "draw a circuit with a source, two motors and two lamps", ["part V1 source " + Q + "240 V" + Q, "part M1 motor " + Q + "Pump 1" + Q, "part M2 motor " + Q + "Pump 2" + Q, "part L1 lamp " + Q + "Run 1" + Q, "part L2 lamp " + Q + "Run 2" + Q, "part G1 ground", "part J1 junction", "wire V1 J1", "wire J1 M1", "wire J1 M2", "wire J1 L1", "wire J1 L2", "wire M1 G1", "wire M2 G1", "wire L1 G1", "wire L2 G1"], "wire G1 V1", "four loads to one ground, none back to the source"));
module.exports = C;
