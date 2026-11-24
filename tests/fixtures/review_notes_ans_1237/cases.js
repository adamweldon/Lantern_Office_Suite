// cases.js -- the review of 22b1c03 (wip 1.24.37: ANS in a drawing's notes is the sum just before it), written by a
// reviewer who did not write the change. Each case says what is RIGHT, as the reviewer judges it; replay.js prints
// AGREE when the page does that, DISAGREE (with what was seen and the harm) when it does not.
//
// Kinds:
//   notes   -- L.aiSchematicMore.noteText(note, state) over the notes in order, ONE state (as a drawing does)
//   apart   -- the same notes, each with no state (a caller that passes none)
//   build   -- L.aiAct.build(reply, question): ok, the notes as drawn, the problems
//   builds  -- several builds one after another on one page; the last is checked
//   rest    -- a reply with two blocks: the second block (aiAct.rest) is checked
//   solve   -- the bench's loop (aiAct.solve) with scripted replies: rounds, what went back, what was made
//   chat    -- a Chat turn (CHAT.turn) with a scripted reply: the drawings made
//   assist / formula / sheet / calc -- the formula engine's own ANS elsewhere, as on 50f9ceb
//   guardFile / guardPrompts -- every saved reply with a MAKE block, and every bench prompt, as on 50f9ceb
//
// want: {texts: [...]} the notes' texts exactly; {probs: [re...]} each must match a problem; {none: true} no
// problems; {notProbs: [re...]} none may match; {ok: bool}; {check: fn(res) -> "" or what was seen}.
"use strict";

var Q9 = "Draw a 9 V battery with 10, 15 and 30 ohm resistors in parallel, and show the total resistance on the picture.";
var Q12 = "Draw a parallel circuit for a lesson: a 12 V battery with 4, 6 and 12 ohm resistors in parallel, and show the total resistance on the picture.";
var QS = "Draw a series circuit for a lesson: a 12 V battery with 10, 20 and 30 ohm resistors in series, and show the total resistance and the current on the picture.";
var QH = "Draw a hydraulic circuit with a pump, relief valve, a 4/3 tandem lever valve and a double-acting cylinder, and show the cylinder force.";
var QP = "Draw a pneumatic circuit: a double-acting clamp cylinder worked by a 5/2 lever valve, slow to close, and show its force at 6 bar.";
var QC = "Draw a motor starter control circuit with a stop button, a start button, an overload and a run lamp.";
var QE = "Draw a circuit for an Arduino: a button on D2 and an LED on D13.";
var QW = "Draw the Ohm's law power wheel for a lesson: P, V, I and R, each with its three formulas.";

// a parallel circuit: each resistor straight across the battery (the 35B's way on Adam's laptop)
function par(v, rs, notes, title) {
  var l = ["MAKE SCHEMATIC: " + (title || "Parallel resistors"), "mode electrical", "part V1 battery \x22" + v + " V\x22"];
  rs.forEach(function (r, i) { l.push("part R" + (i + 1) + " resistor \x22" + r + " ohm\x22"); });
  rs.forEach(function (r, i) { l.push("wire V1 R" + (i + 1)); l.push("wire R" + (i + 1) + " V1"); });
  notes.forEach(function (n) { l.push("note " + n); });
  l.push("END");
  return l.join("\n");
}
// a series loop
function ser(v, rs, notes, title) {
  var l = ["MAKE SCHEMATIC: " + (title || "Series resistors"), "mode electrical", "part V1 battery \x22" + v + " V\x22"];
  rs.forEach(function (r, i) { l.push("part R" + (i + 1) + " resistor \x22" + r + " ohm\x22"); });
  l.push("wire V1 R1");
  for (var i = 1; i < rs.length; i++) l.push("wire R" + i + " R" + (i + 1));
  l.push("wire R" + rs.length + " V1");
  notes.forEach(function (n) { l.push("note " + n); });
  l.push("END");
  return l.join("\n");
}
var HYD = "MAKE HYDRAULIC: Press cylinder\npump P1 \x2220 L/min\x22\nrelief R1 \x22150 bar\x22\ncylinder C1 double \x22press\x22\nvalve V1 C1 4/3 tandem lever\n";
var PNE = "MAKE PNEUMATIC: Clamp\ncylinder C1 double \x22clamp\x22\nvalve V1 C1 5/2 lever\nflow F1 C1 extend\n";
var CON = "MAKE CONTROL: Motor starter\nstop PB1\nstart PB2 M1\noverload OL1 M1\ncoil M1 \x22motor starter\x22\nlamp LT1 M1 \x22run\x22\n";
var ELE = "MAKE ELECTRONICS: Button and LED\npin P1 \x22D2 input\x22\npin P2 \x22D13\x22\nswitch S1 P1\nled D1 P2 green\n";
var WHL = "MAKE WHEEL: Ohm's law power wheel\nP watts: P = V x I | P = V^2 / R | P = I^2 x R\nV volts: V = I x R | V = P / I | V = sqrt(P x R)\n" +
  "I amps: I = V / R | I = P / V | I = sqrt(P / R)\nR ohms: R = V / I | R = V^2 / P | R = P / I^2\n";
function notesOf(block, lines) { return block + lines.map(function (n) { return "note " + n; }).join("\n") + "\nEND"; }

var NOPREV = /uses ANS, the sum worked out just before it, but there is no sum before it: write the number, or its own sum, in place of ANS/;
var FAILPREV = /uses ANS, the sum worked out just before it, but the sum before it could not be worked out/;
var RT = "Rt = 1 / (1/10 + 1/15 + 1/30) = {=1/(1/10+1/15+1/30)} ohm";

var C = [];
function add(c) { C.push(c); }

// ---------------------------------------------------------------------------------------------------------------
// A. What ANS is in one drawing's notes (noteText, one state, in order) -- right notes first
// ---------------------------------------------------------------------------------------------------------------
add({ id: "n-adam-35b", t: "notes", notes: [RT, "Total current It = {=9/ANS} A"],
  want: { texts: ["Rt = 1 / (1/10 + 1/15 + 1/30) = 5 ohm", "Total current It = 1.8 A"], none: true }, harm: "high" });
add({ id: "n-same-note", t: "notes", notes: ["Rt = {=1/(1/10+1/15+1/30)} ohm, so It = {=9/ANS} A"],
  want: { texts: ["Rt = 5 ohm, so It = 1.8 A"], none: true }, harm: "high" });
add({ id: "n-chain-three", t: "notes", notes: ["{=2*3}", "{=ANS*4}", "{=ANS+1}"], want: { texts: ["6", "24", "25"], none: true }, harm: "high" });
add({ id: "n-series-ohm-law", t: "notes", notes: ["Rt = {=10+20+30} ohm", "I = {=12/ANS} A", "V across R1 = {=ANS*10} V"],
  want: { texts: ["Rt = 60 ohm", "I = 0.2 A", "V across R1 = 2 V"], none: true }, harm: "high" });
add({ id: "n-two-parallel", t: "notes", notes: ["Rt = R1 x R2 / (R1 + R2) = {=10*15/(10+15)} ohm", "It = {=9/ANS} A"],
  want: { texts: ["Rt = R1 x R2 / (R1 + R2) = 6 ohm", "It = 1.5 A"], none: true }, harm: "high" });
add({ id: "n-led-power", t: "notes", notes: ["R = (5 - 2) / 0.02 = {=(5-2)/0.02} ohm", "Power in R = {=0.02^2*ANS} W"],
  want: { texts: ["R = (5 - 2) / 0.02 = 150 ohm", "Power in R = 0.06 W"], none: true }, harm: "high" });
add({ id: "n-energy", t: "notes", notes: ["P = 12 x 2 = {=12*2} W", "In 3 hours: {=ANS*3} Wh"], want: { texts: ["P = 12 x 2 = 24 W", "In 3 hours: 72 Wh"], none: true }, harm: "high" });
add({ id: "n-ohm-then-power", t: "notes", notes: ["I = V / R = {=12/4} A", "P = V x I = {=12*ANS} W"], want: { texts: ["I = V / R = 3 A", "P = V x I = 36 W"], none: true }, harm: "high" });
add({ id: "n-convert-then-area", t: "notes", notes: ["Bore = {=CONVERT(2,\x22in\x22,\x22m\x22)} m", "Area = {=PI()*(ANS/2)^2} m2"],
  want: { texts: ["Bore = 0.0508 m", "Area = 0.002027 m2"], none: true }, harm: "high" });
add({ id: "n-ohm-symbol", t: "notes", notes: ["Rt = {=1/(1/10+1/15+1/30)} \u03a9", "It = {=9/ANS} A"], want: { texts: ["Rt = 5 \u03a9", "It = 1.8 A"], none: true }, harm: "high" });
add({ id: "n-quoted-notes", t: "notes", notes: ["\x22Rt = {=1/(1/10+1/15+1/30)} ohm\x22", "\u201cIt = {=9/ANS} A\u201d"],
  want: { texts: ["Rt = 5 ohm", "It = 1.8 A"], none: true }, harm: "high" });
add({ id: "n-lowercase-ans", t: "notes", notes: ["{=10}", "{=9/ans}", "{=Ans+1}"], want: { texts: ["10", "0.9", "1.9"], none: true }, harm: "medium" });
add({ id: "n-spaces-in-sum", t: "notes", notes: ["{= 5 }", "{= ANS * 2 }"], want: { texts: ["5", "10"], none: true }, harm: "medium" });
add({ id: "n-ans-times-ans", t: "notes", notes: ["I = {=4} A", "I squared = {=ANS*ANS}"], want: { texts: ["I = 4 A", "I squared = 16"], none: true }, harm: "medium" });
add({ id: "n-three-in-one-note", t: "notes", notes: ["{=10} then {=ANS*2} then {=ANS*2}"], want: { texts: ["10 then 20 then 40"], none: true }, harm: "medium" });
add({ id: "n-full-precision", t: "notes", notes: ["One third = {=1/3}", "Times 3 = {=ANS*3}"], want: { texts: ["One third = 0.3333", "Times 3 = 1"], none: true }, harm: "low" });
add({ id: "n-negative", t: "notes", notes: ["{=2-5}", "{=ANS*2}"], want: { texts: ["-3", "-6"], none: true }, harm: "medium" });
add({ id: "n-functions-of-ans", t: "notes", notes: ["{=5}", "{=SQRT(ANS)}", "{=ROUND(ANS,1)}"], want: { texts: ["5", "2.236", "2.2"], none: true }, harm: "medium" });
add({ id: "n-unary-and-percent", t: "notes", notes: ["{=5}", "{=-ANS}", "{=ABS(ANS)%}"], want: { texts: ["5", "-5", "0.05"], none: true }, harm: "low" });
add({ id: "n-ans-brackets", t: "notes", notes: ["{=5}", "{=ANS()}"], want: { texts: ["5", "5"], none: true }, harm: "low" });
add({ id: "n-big-numbers", t: "notes", notes: ["{=1e9}", "{=ANS/1e3}"], want: { texts: ["1e+9", "1e+6"], none: true }, harm: "low" });
add({ id: "n-pi", t: "notes", notes: ["{=PI()}", "{=ANS*2}"], want: { texts: ["3.142", "6.283"], none: true }, harm: "low" });
add({ id: "n-text-note-between", t: "notes", notes: ["Rt = {=1/(1/10+1/15+1/30)} ohm", "1/Rt = 1/R1 + 1/R2 + 1/R3", "It = {=9/ANS} A"],
  want: { texts: ["Rt = 5 ohm", "1/Rt = 1/R1 + 1/R2 + 1/R3", "It = 1.8 A"], none: true }, harm: "medium" });
add({ id: "n-ans-word-outside-sum", t: "notes", notes: ["ANS = {=2*3}", "{=ANS+1}"], want: { texts: ["ANS = 6", "7"], none: true }, harm: "low" });
add({ id: "n-adjacent-sums", t: "notes", notes: ["{=5}{=ANS+1}"], want: { texts: ["56"], none: true }, harm: "low" });
add({ id: "n-ans1-later", t: "notes", notes: ["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS1} A", "P = {=9*ANS2} W"],
  want: { texts: ["Rt = 5 ohm", "It = 1.8 A", "P = 16.2 W"], none: true }, harm: "medium" });
add({ id: "n-ans1-ans2-sum", t: "notes", notes: ["{=2}", "{=3}", "{=ANS1+ANS2}", "{=ANS3}"], want: { texts: ["2", "3", "5", "5"], none: true }, harm: "medium" });
add({ id: "n-ans1-same-note", t: "notes", notes: ["{=5} {=ans1}"], want: { texts: ["5 5"], none: true }, harm: "low" });
add({ id: "n-ans1-and-ans", t: "notes", notes: ["{=5}", "{=ANS1 + ANS}"], want: { texts: ["5", "10"], none: true }, harm: "low" });
add({ id: "n-zero-before", t: "notes", notes: ["{=5-5}", "{=10/ANS}"], want: { texts: ["0", "?"], probs: [/\{=10\/ANS\} could not be worked out \(Divide by zero\)/] }, harm: "medium" });
add({ id: "n-quoted-ans-text", t: "notes", notes: ["{=LEN(\x22ANS\x22)}"], want: { texts: ["3"], none: true }, harm: "medium" });
add({ id: "n-quoted-ans-after", t: "notes", notes: ["{=5}", "{=LEN(\x22ANS\x22)}"], want: { texts: ["5", "3"], none: true }, harm: "medium" });
add({ id: "n-single-quoted-ans", t: "notes", notes: ["{=LEN('ANS')}"], want: { texts: ["3"], none: true }, harm: "low" });
add({ id: "n-no-ans-unchanged-1", t: "notes", notes: ["Rt = 1 / (1/4 + 1/6 + 1/12) = {=1/(1/4+1/6+1/12)} ohm"], want: { texts: ["Rt = 1 / (1/4 + 1/6 + 1/12) = 2 ohm"], none: true }, harm: "high" });
add({ id: "n-no-ans-unchanged-2", t: "notes", notes: ["{=SQRT(2)}", "{=12/4}", "{=CONVERT(1,\x22in\x22,\x22mm\x22)}"], want: { texts: ["1.414", "3", "25.4"], none: true }, harm: "high" });
add({ id: "n-no-ans-error-unchanged", t: "notes", notes: ["{=V/R}"], want: { texts: ["?"], probs: [/\{=V\/R\} could not be worked out \(Unknown name V\)/] }, harm: "medium" });

// ANS with nothing to be: questioned in words, never 0
add({ id: "n-no-prev", t: "notes", notes: ["Total current It = {=9/ANS} A"], want: { texts: ["Total current It = ? A"], probs: [NOPREV] }, harm: "high" });
add({ id: "n-no-prev-plain-ans", t: "notes", notes: ["Rt = {=ANS} ohm"], want: { texts: ["Rt = ? ohm"], probs: [NOPREV] }, harm: "high" });
add({ id: "n-no-prev-times", t: "notes", notes: ["{=ANS*30} litres"], want: { texts: ["? litres"], probs: [NOPREV] }, harm: "high" });
add({ id: "n-no-prev-plus", t: "notes", notes: ["{=ANS+5}"], want: { texts: ["?"], probs: [NOPREV] }, harm: "medium" });
add({ id: "n-no-prev-brackets", t: "notes", notes: ["{=ANS()}"], want: { texts: ["?"], probs: [NOPREV] }, harm: "low" });
add({ id: "n-reverse-order", t: "notes", notes: ["It = {=9/ANS} A", "Rt = {=1/(1/10+1/15+1/30)} ohm"], want: { texts: ["It = ? A", "Rt = 5 ohm"], probs: [NOPREV] }, harm: "high" });
add({ id: "n-reverse-in-one-note", t: "notes", notes: ["It = {=9/ANS} A where Rt = {=1/(1/10+1/15+1/30)} ohm"], want: { texts: ["It = ? A where Rt = 5 ohm"], probs: [NOPREV] }, harm: "high" });
add({ id: "n-after-failed", t: "notes", notes: ["{=1/0}", "{=ANS*2}"], want: { texts: ["?", "?"], probs: [/Divide by zero/, FAILPREV] }, harm: "high" });
add({ id: "n-after-failed-earlier-ok", t: "notes", notes: ["{=5}", "{=FOO}", "{=ANS*2}"], want: { texts: ["5", "?", "?"], probs: [/Unknown name FOO/, FAILPREV] }, harm: "high" });
add({ id: "n-after-text-result", t: "notes", notes: ["{=CONCAT(\x22a\x22,\x22b\x22)}", "{=ANS}"], want: { texts: ["?", "?"], probs: [/not a number/, FAILPREV] }, harm: "medium" });
add({ id: "n-two-questioned", t: "notes", notes: ["{=9/ANS}", "{=9/ANS}"], want: { texts: ["?", "?"], probs: [NOPREV] }, harm: "low" });
add({ id: "n-failed-then-ok-then-ans", t: "notes", notes: ["{=FOO}", "{=1}", "{=ANS+1}"], want: { texts: ["?", "1", "2"], probs: [/Unknown name FOO/] }, harm: "medium" });

// names like ANS that are not ANS: as on 50f9ceb, never filled
add({ id: "n-answer-name", t: "notes", notes: ["{=5}", "{=ANSWER*2}"], want: { texts: ["5", "?"], probs: [/Unknown name ANSWER/] }, harm: "high" });
add({ id: "n-ansi-name", t: "notes", notes: ["{=5}", "{=ANSI*2}"], want: { texts: ["5", "?"], probs: [/Unknown name ANSI/] }, harm: "high" });
add({ id: "n-bans-name", t: "notes", notes: ["{=5}", "{=BANS}"], want: { texts: ["5", "?"], probs: [/Unknown name BANS/] }, harm: "high" });
add({ id: "n-ans-underscore", t: "notes", notes: ["{=5}", "{=ANS_1}"], want: { texts: ["5", "?"], probs: [/Unknown name ANS_1/] }, harm: "medium" });
add({ id: "n-ans-space-1", t: "notes", notes: ["{=5}", "{=ANS 1}"], want: { texts: ["5", "?"], probs: [/could not be worked out/] }, harm: "medium" });
add({ id: "n-ans100", t: "notes", notes: ["{=2}", "{=ANS100}"], want: { texts: ["2", "?"], probs: [/Unknown name ANS100/] }, harm: "low" });
add({ id: "n-2ans", t: "notes", notes: ["{=5}", "{=2ANS}"], want: { texts: ["5", "?"], probs: [/could not be worked out/] }, harm: "low" });
add({ id: "n-ans-as-function", t: "notes", notes: ["{=5}", "{=ANS(2)}"], want: { texts: ["5", "?"], probs: [/Unknown function ANS/] }, harm: "low" });
// ANSn that is not there: questioned, never a number
add({ id: "n-ans10-missing", t: "notes", notes: ["{=2}", "{=ANS10}"], want: { texts: ["2", "?"], probs: [/ANS10/] }, harm: "medium" });
add({ id: "n-ans1-first", t: "notes", notes: ["{=ANS1}"], want: { texts: ["?"], probs: [/ANS1/] }, harm: "medium" });
add({ id: "n-ans0", t: "notes", notes: ["{=2}", "{=ANS0}"], want: { texts: ["2", "?"], probs: [/ANS0/] }, harm: "low" });
add({ id: "n-ans2-failed", t: "notes", notes: ["{=2}", "{=1/0}", "{=ANS2*3}"], want: { texts: ["2", "?", "?"], probs: [/ANS2 has no result/] }, harm: "medium" });
add({ id: "n-ans-self", t: "notes", notes: ["{=ANS1+1}"], want: { texts: ["?"], probs: [/ANS1/] }, harm: "medium" });

// ANS as a reader of the drawing would take it
// (the 35B's own full prompt says "ANS holds the previous result, ANS1 the first line's, ANS2 the second's": a note line
// with no sum, or with two, puts a note's number and a sum's number apart -- Lantern must not take another note's value
// without a word)
add({ id: "n-ansn-lines-vs-sums", t: "notes",
  notes: ["Formula: 1/Rt = 1/R1 + 1/R2 + 1/R3", "Rt = {=1/(1/10+1/15+1/30)} ohm", "I1 = {=9/10} A", "It = {=9/ANS2} A"],
  want: { check: function (r) {
    var last = r.texts[3];
    if (last === "It = 1.8 A") return "";
    if (/\?/.test(last) && r.problems.some(function (p) { return /ANS2/.test(p); })) return "";
    return "ANS2 is taken as the 2nd SUM (I1's 0.9), not the 2nd note line (Rt's 5), without a word: \u201c" + last + "\u201d -- Lantern's full prompt calls ANS2 \u201cthe second line's\u201d";
  } }, harm: "high" });
add({ id: "n-ansn-two-sums-in-first-note", t: "notes",
  notes: ["Gt = {=1/10+1/15+1/30} S, so Rt = {=1/ANS} ohm", "I1 = {=9/10} A", "It = {=9/ANS2} A"],
  want: { check: function (r) {
    var last = r.texts[2];
    if (/\?/.test(last) && r.problems.some(function (p) { return /ANS2/.test(p); })) return "";
    if (last === "It = 1.8 A") return "";
    return "ANS2 counted by sums or lines gives different notes here (Rt's 5 by sums, I1's 0.9 by lines); Lantern chose without a word: \u201c" + last + "\u201d";
  } }, harm: "medium" });
add({ id: "n-ansn-one-sum-a-line", t: "notes", notes: ["R1 = {=10} ohm", "R2 = {=15} ohm", "R1 || R2 = {=ANS1*ANS2/(ANS1+ANS2)} ohm"],
  want: { texts: ["R1 = 10 ohm", "R2 = 15 ohm", "R1 || R2 = 6 ohm"], none: true }, harm: "medium" });
add({ id: "n-ans-crosses-typed-value", t: "notes", notes: ["P in R1 = {=9*9/10} W", "Rt = 5 ohm", "It = {=9/ANS} A"],
  want: { check: function (r) {
    if (/\?/.test(r.texts[2]) && r.problems.length) return "";
    return "ANS skipped the note that states Rt = 5 ohm and took P's 8.1: \u201c" + r.texts[2] + "\u201d, no word said";
  } }, harm: "medium" });
add({ id: "n-ans-branch-currents", t: "notes", notes: [RT, "I1 = {=9/10} A", "I2 = {=9/15} A", "I3 = {=9/30} A", "Total current It = {=9/ANS} A"],
  want: { check: function (r) {
    var last = r.texts[4];
    if (last === "Total current It = 1.8 A") return "";
    if (/\?/.test(last) && r.problems.length) return "";
    return "ANS is I3's 0.3, so the total current is shown as \u201c" + last + "\u201d (9 V on 5 ohm is 1.8 A) without a word; on 50f9ceb the note went back";
  } }, harm: "medium" });
add({ id: "n-ans-after-later-sum-same-note", t: "notes", notes: ["I1 = {=9/10} A", "It = {=9/ANS} A where Rt = {=1/(1/10+1/15+1/30)} ohm"],
  want: { check: function (r) {
    if (r.texts[1] === "It = 1.8 A where Rt = 5 ohm") return "";
    if (/\?/.test(r.texts[1]) && r.problems.length) return "";
    return "the note names Rt after the sum, ANS took I1's 0.9: \u201c" + r.texts[1] + "\u201d";
  } }, harm: "low" });
add({ id: "n-ans-hidden-by-cut", t: "notes",
  notes: ["The total resistance of three resistors in parallel is one over the sum of their reciprocals; for these three resistors it comes to {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS} A"],
  want: { check: function (r) {
    var shown = r.texts[0].slice(0, 120);
    if (/5 ohm/.test(shown) || /\?/.test(r.texts[1])) return "";
    return "ANS used a sum whose value is cut off the drawing (notes are cut at 120 characters): shown \u201c\u2026" + shown.slice(-30) + "\u201d then \u201c" + r.texts[1] + "\u201d";
  } }, harm: "low" });

// a caller that passes no state: each note on its own (as before for anything with no sum before)
add({ id: "a-no-state-each-alone", t: "apart", notes: ["{=5}", "{=ANS*2}"], want: { texts: ["5", "?"], probs: [NOPREV] }, harm: "medium" });
add({ id: "a-no-state-same-note", t: "apart", notes: ["{=5} and {=ANS*2}"], want: { texts: ["5 and 10"], none: true }, harm: "medium" });

// ---------------------------------------------------------------------------------------------------------------
// B. Built drawings: the schematic, and AI_SCHEMATIC_TOTAL's check of the total
// ---------------------------------------------------------------------------------------------------------------
add({ id: "b-adam-35b-block", t: "build", q: Q9, text: par(9, [10, 15, 30], [RT, "Total current It = {=9/ANS} A"]),
  want: { ok: true, texts: ["Rt = 1 / (1/10 + 1/15 + 1/30) = 5 ohm", "Total current It = 1.8 A"], none: true }, harm: "high" });
add({ id: "b-adam-35b-block-prose", t: "build", q: Q9,
  text: "Here is the parallel circuit with the total resistance and the current.\n\n" + par(9, [10, 15, 30], [RT, "Total current It = {=9/ANS} A"]) + "\n\nThe total resistance is 5 ohm.",
  want: { ok: true, texts: ["Rt = 1 / (1/10 + 1/15 + 1/30) = 5 ohm", "Total current It = 1.8 A"], none: true }, harm: "high" });
add({ id: "b-total-via-ans", t: "build", q: Q9, text: par(9, [10, 15, 30], ["1/Rt = 1/10 + 1/15 + 1/30 = {=1/10+1/15+1/30}", "Rt = {=1/ANS} ohm"]),
  want: { ok: true, texts: ["1/Rt = 1/10 + 1/15 + 1/30 = 0.2", "Rt = 5 ohm"], none: true }, harm: "high" });
add({ id: "b-total-plain-ans", t: "build", q: Q9, text: par(9, [10, 15, 30], ["{=1/(1/10+1/15+1/30)}", "Rt = {=ANS} ohm"]),
  want: { ok: true, texts: ["5", "Rt = 5 ohm"], none: true }, harm: "high" });
add({ id: "b-total-ans-omega", t: "build", q: Q9, text: par(9, [10, 15, 30], ["1/Rt = {=1/10+1/15+1/30}", "Rt = {=1/ANS} \u03a9"]),
  want: { ok: true, texts: ["1/Rt = 0.2", "Rt = 5 \u03a9"], none: true }, harm: "medium" });
add({ id: "b-total-ans-first-no-prev", t: "build", q: Q9, text: par(9, [10, 15, 30], ["Rt = {=ANS} ohm"]),
  want: { ok: false, probs: [NOPREV], check: function (r) { return (r.texts || []).indexOf("Rt = 0 ohm") >= 0 ? "Rt = 0 ohm drawn" : ""; } }, harm: "high" });
add({ id: "b-current-ans-first", t: "build", q: Q9, text: par(9, [10, 15, 30], ["It = {=9/ANS} A"]),
  want: { ok: false, probs: [NOPREV] }, harm: "high" });
add({ id: "b-reverse-order", t: "build", q: Q9, text: par(9, [10, 15, 30], ["It = {=9/ANS} A", "Rt = {=1/(1/10+1/15+1/30)} ohm"]),
  want: { ok: false, probs: [NOPREV], notProbs: [/Divide by zero/] }, harm: "high" });
add({ id: "b-series-current", t: "build", q: QS, text: ser(12, [10, 20, 30], ["Rt = R1 + R2 + R3 = {=10+20+30} ohm", "I = V / Rt = {=12/ANS} A"]),
  want: { ok: true, texts: ["Rt = R1 + R2 + R3 = 60 ohm", "I = V / Rt = 0.2 A"], none: true }, harm: "high" });
add({ id: "b-series-total-via-ans", t: "build", q: QS, text: ser(12, [10, 20, 30], ["R1 + R2 = {=10+20} ohm", "Rt = {=ANS+30} ohm", "I = {=12/ANS} A"]),
  want: { ok: true, texts: ["R1 + R2 = 30 ohm", "Rt = 60 ohm", "I = 0.2 A"], none: true }, harm: "high" });
add({ id: "b-12v-lesson-ans", t: "build", q: Q12, text: par(12, [4, 6, 12], ["Rt = 1 / (1/4 + 1/6 + 1/12) = {=1/(1/4+1/6+1/12)} ohm", "It = {=12/ANS} A"]),
  want: { ok: true, texts: ["Rt = 1 / (1/4 + 1/6 + 1/12) = 2 ohm", "It = 6 A"], none: true }, harm: "high" });
// a wrong total via ANS: the guide's old example (100 and 200) carried into the total by ANS goes back, as it does written
// straight into the total's own sum (b-foreign-direct)
add({ id: "b-foreign-direct", t: "build", q: Q12, text: par(12, [4, 6, 12], ["Rt = {=100*200/(100+200)} ohm"]),
  want: { ok: false, probs: [/uses 100 and 200, which are not values of this circuit/] }, harm: "high" });
add({ id: "b-foreign-via-ans", t: "build", q: Q12, text: par(12, [4, 6, 12], ["Rt = R1 x R2 / (R1 + R2) = {=100*200/(100+200)}", "Rt = {=ANS} ohm"]),
  want: { ok: false, check: function (r) {
    if (r.problems.some(function (p) { return /not values of this circuit/.test(p); })) return "";
    return "not sent back: drawn " + JSON.stringify(r.texts) + " -- \u201cRt = 66.67 ohm\u201d beside Lantern's own 2 ohm, ok=" + r.ok;
  } }, harm: "high" });
add({ id: "b-foreign-via-ans-1-over", t: "build", q: Q12, text: par(12, [4, 6, 12], ["1/Rt = {=1/100+1/200}", "Rt = {=1/ANS} ohm"]),
  want: { ok: false, check: function (r) {
    if (r.problems.some(function (p) { return /not values of this circuit/.test(p); })) return "";
    return "not sent back: drawn " + JSON.stringify(r.texts) + ", ok=" + r.ok;
  } }, harm: "high" });
add({ id: "b-foreign-via-ans-current-only", t: "build", q: Q12, text: par(12, [4, 6, 12], ["Rt = 1 / (1/4 + 1/6 + 1/12) = {=1/(1/4+1/6+1/12)} ohm", "It = {=12/ANS} A"]),
  want: { ok: true, none: true }, harm: "medium" });
// a total missing a resistor, written straight or through ANS: the same either way (the TOTAL check reads only numbers
// that are not the circuit's; it is the reviewer's view that a note naming Rt with another number of ohms should go back)
add({ id: "b-missing-resistor-via-ans", t: "build", q: Q12, text: par(12, [4, 6, 12], ["1/Rt = {=1/4+1/6}", "Rt = {=1/ANS} ohm"]),
  want: { check: function (r) {
    if (!r.ok && r.problems.some(function (p) { return /2 ohm/.test(p); })) return "";
    return "drawn " + JSON.stringify(r.texts) + " with nothing sent back: \u201cRt = 2.4 ohm\u201d beside Lantern's own \u201cRt = 2 ohm\u201d (on 50f9ceb it went back, as Divide by zero)";
  } }, harm: "medium" });
add({ id: "b-missing-resistor-direct", t: "build", q: Q12, text: par(12, [4, 6, 12], ["Rt = {=1/(1/4+1/6)} ohm"]),
  want: { check: function (r) {
    if (!r.ok && r.problems.some(function (p) { return /2 ohm/.test(p); })) return "";
    return "drawn " + JSON.stringify(r.texts) + " with nothing sent back (as on 50f9ceb): two totals on one picture";
  } }, harm: "low" });
add({ id: "b-reciprocal-as-total-via-ans", t: "build", q: Q9, text: par(9, [10, 15, 30], ["1/Rt = {=1/10+1/15+1/30}", "Rt = {=ANS} ohm"]),
  want: { check: function (r) {
    if (!r.ok && r.problems.length) return "";
    return "drawn " + JSON.stringify(r.texts) + " with nothing sent back: \u201cRt = 0.2 ohm\u201d beside Lantern's \u201cRt = 5 ohm\u201d (on 50f9ceb \u201cRt = 0 ohm\u201d, also not sent back)";
  } }, harm: "medium" });
add({ id: "b-ansn-digit-not-foreign", t: "build", q: Q9, text: par(9, [10, 15, 30], ["R1 = {=10} ohm", "R2 = {=15} ohm", "R1 and R2 together = {=ANS1*ANS2/(ANS1+ANS2)} ohm"]),
  want: { check: function (r) {
    var bad = r.problems.filter(function (p) { return /uses 2\b/.test(p); });
    return bad.length ? "the 2 of ANS2 is read as a number that is not this circuit's: \u201c" + bad[0].slice(0, 160) + "\u2026\u201d" : "";
  } }, harm: "medium" });
add({ id: "b-ansn-digit-total-shown", t: "build", q: Q9, text: par(9, [10, 15, 30], ["G = {=1/10+1/15+1/30}", "Rt = {=1/ANS1} ohm"]),
  want: { ok: true, texts: ["G = 0.2", "Rt = 5 ohm"], none: true }, harm: "medium" });
add({ id: "b-ans-problem-once", t: "build", q: Q9, text: par(9, [10, 15, 30], ["It = {=9/ANS} A"]),
  want: { check: function (r) { var n = r.problems.filter(function (p) { return NOPREV.test(p); }).length; return n === 1 ? "" : "the ANS problem is said " + n + " times"; } }, harm: "low" });
add({ id: "b-ans-word-in-note-text", t: "build", q: Q9, text: par(9, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = V / ANS = {=9/ANS} A"]),
  want: { ok: true, texts: ["Rt = 5 ohm", "It = V / ANS = 1.8 A"], none: true }, harm: "low" });
add({ id: "b-no-ans-untouched-35b", t: "build", q: Q12, text: par(12, [4, 6, 12], ["Rt = 1 / (1/4 + 1/6 + 1/12) = {=1/(1/4+1/6+1/12)} ohm"]),
  want: { ok: true, texts: ["Rt = 1 / (1/4 + 1/6 + 1/12) = 2 ohm"], none: true }, harm: "high" });
add({ id: "b-ans-in-label-line", t: "build", q: Q9,
  text: par(9, [10, 15, 30], []).replace("END", "text Rt = {=1/(1/10+1/15+1/30)} ohm\nlabel It = {=9/ANS} A\nEND"),
  want: { ok: true, texts: ["Rt = 5 ohm", "It = 1.8 A"], none: true }, harm: "medium" });
add({ id: "b-notes-before-parts", t: "build", q: Q9,
  text: "MAKE SCHEMATIC: Parallel resistors\nmode electrical\nnote Rt = {=1/(1/10+1/15+1/30)} ohm\nnote It = {=9/ANS} A\npart V1 battery \x229 V\x22\npart R1 resistor \x2210 ohm\x22\npart R2 resistor \x2215 ohm\x22\npart R3 resistor \x2230 ohm\x22\nwire V1 R1\nwire R1 V1\nwire V1 R2\nwire R2 V1\nwire V1 R3\nwire R3 V1\nEND",
  want: { ok: true, texts: ["Rt = 5 ohm", "It = 1.8 A"], none: true }, harm: "medium" });
add({ id: "b-ninth-note", t: "build", q: Q9, text: par(9, [10, 15, 30], ["a {=1}", "b {=ANS+1}", "c {=ANS+1}", "d {=ANS+1}", "e {=ANS+1}", "f {=ANS+1}", "g {=ANS+1}", "h {=ANS+1}", "i {=ANS+1}"]),
  want: { check: function (r) { return (r.texts || []).length === 8 && r.texts[7] === "h 8" ? "" : "drawn " + JSON.stringify(r.texts); } }, harm: "low" });
add({ id: "b-series-lamp-no-total", t: "build", q: "Draw a circuit with a 12 V battery, a switch and a lamp in series, and show the current if the lamp is 24 ohm.",
  text: "MAKE SCHEMATIC: Lamp circuit\nmode electrical\npart V1 battery \x2212 V\x22\npart S1 switch \x22closed\x22\npart L1 lamp \x2224 ohm\x22\nwire V1 S1\nwire S1 L1\nwire L1 V1\nnote I = V / R = {=12/24} A\nnote P = V x I = {=12*ANS} W\nEND",
  want: { ok: true, texts: ["I = V / R = 0.5 A", "P = V x I = 6 W"], none: true }, harm: "high" });

// ---------------------------------------------------------------------------------------------------------------
// C. Every module that shows notes: ANS after a sum, and ANS with none before it
// ---------------------------------------------------------------------------------------------------------------
add({ id: "m-hyd-ans", t: "build", q: QH, text: notesOf(HYD, ["Bore area = {=PI()*0.05^2/4} m2", "Force at 150 bar = {=ANS*150e5} N"]),
  want: { ok: true, texts: ["Bore area = 0.001963 m2", "Force at 150 bar = 29450 N"], none: true, kind: "HYDRAULIC" }, harm: "high" });
add({ id: "m-hyd-ans-first", t: "build", q: QH, text: notesOf(HYD, ["Force = {=ANS*150e5} N"]),
  want: { ok: false, probs: [NOPREV], kind: "HYDRAULIC" }, harm: "high" });
add({ id: "m-hyd-ans1", t: "build", q: QH, text: notesOf(HYD, ["Area = {=PI()*0.05^2/4} m2", "Flow 20 L/min = {=20/60000} m3/s", "Speed = {=ANS2/ANS1} m/s"]),
  want: { ok: true, texts: ["Area = 0.001963 m2", "Flow 20 L/min = 0.0003333 m3/s", "Speed = 0.1698 m/s"], none: true, kind: "HYDRAULIC" }, harm: "medium" });
add({ id: "m-hyd-two-in-note", t: "build", q: QH, text: notesOf(HYD, ["Area {=PI()*0.05^2/4} m2, force {=ANS*150e5} N"]),
  want: { ok: true, texts: ["Area 0.001963 m2, force 29450 N"], none: true, kind: "HYDRAULIC" }, harm: "medium" });
add({ id: "m-pne-ans", t: "build", q: QP, text: notesOf(PNE, ["Area = {=PI()*0.04^2/4} m2", "Force at 6 bar = {=ANS*6e5} N"]),
  want: { ok: true, texts: ["Area = 0.001257 m2", "Force at 6 bar = 754 N"], none: true, kind: "PNEUMATIC" }, harm: "high" });
add({ id: "m-pne-ans-first", t: "build", q: QP, text: notesOf(PNE, ["Force at 6 bar = {=ANS*6e5} N"]),
  want: { ok: false, probs: [NOPREV], kind: "PNEUMATIC" }, harm: "high" });
add({ id: "m-pne-after-failed", t: "build", q: QP, text: notesOf(PNE, ["Area = {=PI*D^2/4} m2", "Force = {=ANS*6e5} N"]),
  want: { ok: false, probs: [/could not be worked out/, FAILPREV], kind: "PNEUMATIC" }, harm: "medium" });
add({ id: "m-con-ans", t: "build", q: QC, text: notesOf(CON, ["Coil current = {=24/120} A", "Coil power = {=24*ANS} W"]),
  want: { ok: true, texts: ["Coil current = 0.2 A", "Coil power = 4.8 W"], none: true, kind: "CONTROL" }, harm: "high" });
add({ id: "m-con-ans-first", t: "build", q: QC, text: notesOf(CON, ["Coil power = {=24*ANS} W"]),
  want: { ok: false, probs: [NOPREV], kind: "CONTROL" }, harm: "high" });
add({ id: "m-con-text-between", t: "build", q: QC, text: notesOf(CON, ["Motor FLA = {=7.5*746/(230*0.85*0.9)} A", "Overload set at the FLA", "Fuse = {=ANS*1.75} A"]),
  want: { ok: true, texts: ["Motor FLA = 31.8 A", "Overload set at the FLA", "Fuse = 55.65 A"], none: true, kind: "CONTROL" }, harm: "medium" });
add({ id: "m-ele-ans", t: "build", q: QE, text: notesOf(ELE, ["LED resistor = {=(5-2)/0.02} ohm", "LED power = {=0.02^2*ANS} W"]),
  want: { ok: true, texts: ["LED resistor = 150 ohm", "LED power = 0.06 W"], none: true, kind: "ELECTRONICS" }, harm: "high" });
add({ id: "m-ele-ans-first", t: "build", q: QE, text: notesOf(ELE, ["LED power = {=0.02^2*ANS} W"]),
  want: { ok: false, probs: [NOPREV], kind: "ELECTRONICS" }, harm: "high" });
add({ id: "m-ele-lower", t: "build", q: QE, text: notesOf(ELE, ["Pull-up current = {=5/10000} A", "In mA: {=ans*1000} mA"]),
  want: { ok: true, texts: ["Pull-up current = 0.0005000 A", "In mA: 0.5 mA"], none: true, kind: "ELECTRONICS" }, harm: "medium" });
add({ id: "m-whl-ans", t: "build", q: QW, text: notesOf(WHL, ["At 12 V and 2 A: P = {=12*2} W", "and R = {=12/2} ohm, so I = {=12/ANS} A"]),
  want: { ok: true, texts: ["At 12 V and 2 A: P = 24 W", "and R = 6 ohm, so I = 2 A"], none: true, kind: "WHEEL" }, harm: "high" });
add({ id: "m-whl-ans-first", t: "build", q: QW, text: notesOf(WHL, ["I = {=12/ANS} A"]),
  want: { ok: false, probs: [NOPREV], kind: "WHEEL" }, harm: "high" });
add({ id: "m-whl-key-line", t: "build", q: QW, text: WHL + "key P = {=12*2} W at 12 V and 2 A\ncaption R = {=12*12/ANS} ohm\nEND",
  want: { ok: true, texts: ["P = 24 W at 12 V and 2 A", "R = 6 ohm"], none: true, kind: "WHEEL" }, harm: "medium" });
add({ id: "m-whl-seventh-note", t: "build", q: QW, text: notesOf(WHL, ["{=1}", "{=ANS+1}", "{=ANS+1}", "{=ANS+1}", "{=ANS+1}", "{=ANS+1}", "{=ANS+1}"]),
  want: { check: function (r) { return (r.texts || []).length === 6 && r.texts[5] === "6" ? "" : "drawn " + JSON.stringify(r.texts); }, kind: "WHEEL" }, harm: "low" });

// ---------------------------------------------------------------------------------------------------------------
// D. One state for one drawing, and no more
// ---------------------------------------------------------------------------------------------------------------
add({ id: "s-built-twice", t: "builds", items: [[Q9, par(9, [10, 15, 30], [RT, "It = {=9/ANS} A"])], [Q9, par(9, [10, 15, 30], [RT, "It = {=9/ANS} A"])]],
  want: { ok: true, texts: ["Rt = 1 / (1/10 + 1/15 + 1/30) = 5 ohm", "It = 1.8 A"], none: true }, harm: "high" });
add({ id: "s-next-drawing-fresh", t: "builds", items: [[Q9, par(9, [10, 15, 30], [RT])], [Q9, par(9, [10, 15, 30], ["It = {=9/ANS} A"])]],
  want: { ok: false, probs: [NOPREV] }, harm: "high" });
add({ id: "s-next-module-fresh", t: "builds", items: [[QH, notesOf(HYD, ["Area = {=PI()*0.05^2/4} m2"])], [QP, notesOf(PNE, ["Force = {=ANS*6e5} N"])]],
  want: { ok: false, probs: [NOPREV] }, harm: "high" });
add({ id: "s-wheel-then-schematic", t: "builds", items: [[QW, notesOf(WHL, ["P = {=12*2} W"])], [Q9, par(9, [10, 15, 30], ["It = {=9/ANS} A"])]],
  want: { ok: false, probs: [NOPREV] }, harm: "high" });
add({ id: "s-total-then-draw", t: "build", q: Q9, text: par(9, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm", "Twice = {=ANS*2}", "Again = {=ANS*2}"]),
  want: { ok: true, texts: ["Rt = 5 ohm", "Twice = 10", "Again = 20"], none: true }, harm: "high" });
add({ id: "s-total-then-draw-ansn", t: "build", q: Q9, text: par(9, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS1} A", "Count = {=ANS2/ANS2}"]),
  want: { ok: true, texts: ["Rt = 5 ohm", "It = 1.8 A", "Count = 1"], none: true }, harm: "high" });
add({ id: "s-two-blocks-rest", t: "rest", q: Q9,
  text: par(9, [10, 15, 30], [RT, "It = {=9/ANS} A"]) + "\n\nAnd with 12 V:\n\n" + par(12, [10, 15, 30], ["It = {=12/ANS} A"], "Parallel resistors at 12 V"),
  want: { ok: false, probs: [NOPREV], check: function (r) { return (r.texts || [])[0] === "It = 2.4 A" ? "the second drawing took the first's 5" : ""; } }, harm: "high" });
add({ id: "s-two-blocks-first", t: "build", q: Q9,
  text: par(9, [10, 15, 30], [RT, "It = {=9/ANS} A"]) + "\n\nAnd with 12 V:\n\n" + par(12, [10, 15, 30], ["It = {=12/ANS} A"], "Parallel resistors at 12 V"),
  want: { ok: true, texts: ["Rt = 1 / (1/10 + 1/15 + 1/30) = 5 ohm", "It = 1.8 A"], none: true }, harm: "high" });
add({ id: "s-two-blocks-second-own", t: "rest", q: Q9,
  text: par(9, [10, 15, 30], [RT]) + "\n\n" + par(12, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=12/ANS} A"], "At 12 V"),
  want: { ok: true, texts: ["Rt = 5 ohm", "It = 2.4 A"], none: true }, harm: "high" });
add({ id: "s-bench-second-try", t: "solve", q: Q9,
  replies: [par(9, [10, 15, 30], ["It = {=9/ANS} A", "Rt = {=1/(1/10+1/15+1/30)} ohm"]), par(9, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS} A"])],
  want: { rounds: 2, ok: true, texts: ["Rt = 5 ohm", "It = 1.8 A"], sent: [[1, /\{=9\/ANS\} uses ANS, the sum worked out just before it, but there is no sum before it/]] }, harm: "high" });
add({ id: "s-bench-second-try-other-fault", t: "solve", q: Q9,
  replies: [ser(9, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS} A"]), par(9, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS} A"])],
  want: { rounds: 2, ok: true, texts: ["Rt = 5 ohm", "It = 1.8 A"], notSent: [[1, /ANS/]] }, harm: "high" });
add({ id: "s-bench-second-try-fresh", t: "solve", q: Q9,
  replies: [ser(9, [10, 15, 30], ["Rt = {=1/(1/10+1/15+1/30)} ohm"]), par(9, [10, 15, 30], ["It = {=9/ANS} A"])],
  want: { rounds: 2, ok: false, probs: [NOPREV] }, harm: "high" });
add({ id: "s-bench-one-round", t: "solve", q: Q9, replies: [par(9, [10, 15, 30], [RT, "Total current It = {=9/ANS} A"])],
  want: { rounds: 1, ok: true, texts: ["Rt = 1 / (1/10 + 1/15 + 1/30) = 5 ohm", "Total current It = 1.8 A"] }, harm: "high" });
add({ id: "s-chat-two-drawings", t: "chat", q: Q9,
  reply: par(9, [10, 15, 30], [RT, "It = {=9/ANS} A"]) + "\n\nAnd the same with 12 V:\n\n" + par(12, [10, 15, 30], ["It = {=12/ANS} A"], "Parallel resistors at 12 V"),
  want: { check: function (ms) {
    if (ms.length < 2) return "made " + ms.length + " drawing(s)";
    var a = ms[0].plan && ms[0].plan.notes, b = ms[1].plan && ms[1].plan.notes;
    if (!a || a[1] !== "It = 1.8 A") return "first drawing: " + JSON.stringify(a);
    if (!b || b[0] !== "It = ? A") return "second drawing: " + JSON.stringify(b);
    return "";
  } }, harm: "high" });

// ---------------------------------------------------------------------------------------------------------------
// E. What goes back (rule 3: the place, why, and what to write)
// ---------------------------------------------------------------------------------------------------------------
add({ id: "e-no-prev-says-what", t: "notes", notes: ["It = {=9/ANS} A"],
  want: { probs: [/note: \{=9\/ANS\}/, /there is no sum before it/, /write the number, or its own sum, in place of ANS/] }, harm: "medium" });
add({ id: "e-failed-prev-says-which", t: "notes", notes: ["Rt = {=1/(1/10+1/15+1/R3)} ohm", "It = {=9/ANS} A"],
  want: { probs: [/Unknown name R3/, FAILPREV] }, harm: "medium" });
add({ id: "e-no-zero-in-text", t: "notes", notes: ["Force = {=ANS*6e5} N"], want: { texts: ["Force = ? N"] }, harm: "high" });
add({ id: "e-sent-back-whole", t: "solve", q: Q9, replies: [par(9, [10, 15, 30], ["It = {=9/ANS} A"]), par(9, [10, 15, 30], ["It = {=9/ANS} A"])],
  want: { rounds: 2, sent: [[1, /write the number, or its own sum, in place of ANS/]], notSent: [[1, /Divide by zero/]] }, harm: "medium" });
add({ id: "e-ansn-out-of-range-words", t: "notes", notes: ["Formula: 1/Rt = 1/R1 + 1/R2 + 1/R3", "Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS3} A"],
  want: { check: function (r) {
    var p = r.problems.filter(function (x) { return /ANS3/.test(x); })[0] || "";
    if (!p) return "no problem for ANS3; drawn " + JSON.stringify(r.texts);
    if (/\bline\b/.test(p) || !/ANS1/.test(p)) return "says \u201c" + p + "\u201d: a note has no lines numbered so, it counts sums, and it does not say what to write (ANS1 is Rt's 5)";
    return "";
  } }, harm: "low" });
add({ id: "e-ansn-failed-words", t: "notes", notes: ["Note: 1/Rt = 1/R1 + 1/R2", "Rt = {=1/(1/10+1/R2)} ohm", "It = {=9/ANS1} A"],
  want: { check: function (r) {
    var p = r.problems.filter(function (x) { return /ANS1/.test(x); })[0] || "";
    if (!p) return "no problem for ANS1";
    if (/line 1 failed/.test(p)) return "says \u201c" + p + "\u201d -- line 1 of the notes has no sum; the failed sum is in note 2";
    return "";
  } }, harm: "low" });
add({ id: "e-ans-first-sum-names-total", t: "build", q: Q9, text: par(9, [10, 15, 30], ["It = {=9/ANS} A"]),
  want: { check: function (r) {
    // the problem goes back with the general rule; Lantern adds the total it knows -- which it also says
    if (!r.problems.some(function (p) { return NOPREV.test(p); })) return "no ANS problem: " + JSON.stringify(r.problems);
    return "";
  } }, harm: "medium" });

// ---------------------------------------------------------------------------------------------------------------
// F. The formula engine's own ANS elsewhere, as on 50f9ceb
// ---------------------------------------------------------------------------------------------------------------
add({ id: "f-assist-chain", t: "assist", text: "=2*3\n=ANS*4\n=ANS1+ANS2", want: { values: [6, 24, 30] }, harm: "high" });
add({ id: "f-assist-first-ans", t: "assist", text: "=ANS*30", want: { values: [0] }, harm: "medium", note: "as on 50f9ceb (Chat's first line: ANS 0)" });
add({ id: "f-assist-after-failed", t: "assist", text: "=1/0\n=ANS*2", want: { values: [null, null], errs: [/Divide by zero/, /ANS has no result/] }, harm: "medium" });
add({ id: "f-assist-skip-failed", t: "assist", text: "=5\n=1/0\n=ANS*2", want: { values: [5, null, 10] }, harm: "medium", note: "as on 50f9ceb (Chat's ANS is the last line that was worked out)" });
add({ id: "f-formula-ans-default", t: "formula", expr: "ANS+1", ctx: {}, want: { value: 1 }, harm: "medium" });
add({ id: "f-formula-ans-given", t: "formula", expr: "ANS*2", ctx: { ans: 7 }, want: { value: 14 }, harm: "medium" });
add({ id: "f-formula-ansn", t: "formula", expr: "ANS2", ctx: { ansList: [1, 4] }, want: { value: 4 }, harm: "medium" });
add({ id: "f-formula-ansn-missing", t: "formula", expr: "ANS1", ctx: {}, want: { err: /Unknown name ANS1/ }, harm: "medium" });
add({ id: "f-sheet-ans", t: "sheet", cells: { A1: "=2+3", A2: "=ANS+1", A3: "=A1*2" }, want: { values: { A1: 5, A2: 1, A3: 10 } }, harm: "medium", note: "as on 50f9ceb" });
add({ id: "f-calc-ans", t: "calc", keys: [["2", "+", "3", "="], ["ANS", "\u00d7", "2", "="]], want: { res: ["5", "10"] }, harm: "medium" });

module.exports = C;
