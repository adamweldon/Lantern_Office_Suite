// notes_ans_1237.js -- ANS in a drawing's notes (1.24.37).
//
// Adam, 2026-11-24, with a screenshot of his laptop's bench (the 35B, make-parallel-ohm-b, "a 9 V battery with 10, 15
// and 30 ohm resistors in parallel, and show the total resistance on the picture"): "Lantern should provide the answer
// but it does not for some reason". The 35B drew the circuit with an ammeter A1 (Total) and two notes:
//     Rt = 1 / (1/10 + 1/15 + 1/30) = {=1/(1/10+1/15+1/30)} ohm      -> 5 ohm
//     Total current It = {=9/ANS} A                                    -> the battery's 9 V over the 5 ohm
// Lantern worked each {= } out with ANS = 0, so the second went back as "note: {=9/ANS} could not be worked out (Divide
// by zero)" on both tries, the row failed, and the picture said "It = ? A" where the lesson's answer, 1.8 A, belonged.
// (The reply below is the one in the screenshot, as far as it shows: its first lines and its two notes as drawn.)
// What is checked: ANS in a note is the sum worked out just before it -- in the same note or the one before -- and
// ANS1, ANS2 ... are not read in a note (the review: the prompt counts them by lines); with no sum before it, or one
// that failed, ANS says so (never 0, never "divide by zero"); a wrong total carried by ANS goes back like one written
// straight; every kind of drawing whose notes Lantern works out
// carries ANS the same way; the bench row passes.
"use strict";
var path = require("path");
var load = require("./fixtures/liftstation_review1_1230/load.js");
var o = load(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html")), L = o.L;
var fails = 0, n = 0;
function ok(name, cond, info) { n++; if (cond) console.log("ok   " + name); else { fails++; console.log("FAIL " + name); if (info !== undefined) console.log("     " + JSON.stringify(info).slice(0, 700)); } }
setTimeout(function () {
  var Q = "Draw a parallel circuit for a lesson: a 9 V battery with 10, 15 and 30 ohm resistors in parallel, and show the total resistance on the picture.";
  var REPLY = "Here is the schematic for the parallel circuit with the calculated total resistance.\n\nMAKE SCHEMATIC: Parallel Resistors Lesson\nmode electrical\n" +
    "part V1 source \x229 V\x22\npart A1 ammeter \x22Total\x22\npart R1 resistor \x2210 ohm\x22\npart R2 resistor \x2215 ohm\x22\npart R3 resistor \x2230 ohm\x22\n" +
    "wire V1 A1\nwire A1 R1\nwire A1 R2\nwire A1 R3\nwire R1 V1\nwire R2 V1\nwire R3 V1\n" +
    "note Rt = 1 / (1/10 + 1/15 + 1/30) = {=1/(1/10+1/15+1/30)} ohm\nnote Total current It = {=9/ANS} A\nEND";
  var m = L.aiAct.build(REPLY, Q);
  var text = JSON.stringify(m.plan || {});
  ok("the 35B's reply: drawn, nothing questioned, the current worked out from the total (9 / 5 = 1.8 A)",
    m.ok && !(m.problems || []).length && /Total current It = 1\.8 A/.test(text) && /= 5 ohm/.test(text), { ok: m.ok, problems: m.problems });
  var QB = L.aiBenchQuestionsB || [], it = QB.filter(function (x) { return x.id === "make-parallel-ohm-b"; })[0];
  var g = it && L.aiBench.grade(it, REPLY, { made: m });
  ok("the bench row passes", g && g.pass, g);

  var NT = L.aiSchematicMore.noteText;
  function notes(list) { var st = {}; return list.map(function (t) { return NT(t, st); }); }
  var r = notes(["Rt = {=1/(1/10+1/15+1/30)} ohm", "It = {=9/ANS} A", "P = {=9*ANS} W"]);
  ok("ANS is the sum just before, note after note", r[1].text === "It = 1.8 A" && r[2].text === "P = 16.2 W" && !r[1].problems.length && !r[2].problems.length, r);
  r = notes(["{=2*3} then {=ANS+1}"]);
  ok("ANS within one note", r[0].text === "6 then 7", r);
  r = notes(["R = {=10+20} ohm", "I = {=12/30} A", "P = {=ANS1*ANS2^2} W"]);
  // (the review of 1.24.37: the prompt counts ANS1, ANS2 by lines and the notes by sums; with a note of words between
  // them "It = {=9/ANS2} A" took another note's value. So a note does not read them, and says what to write)
  ok("ANS1, ANS2 are not read in a note: questioned, with what to write", r[2].text === "P = ? W" && /only ANS is read/.test(r[2].problems[0]) && /in place of ANS1/.test(r[2].problems[0]), r);
  r = notes(["It = {=9/ANS} A"]);
  ok("ANS with no sum before it says so: never 0, never divide by zero",
    r[0].text === "It = ? A" && r[0].problems.length === 1 && /no sum before it/.test(r[0].problems[0]) && !/divide/i.test(r[0].problems[0]) && /in place of ANS/.test(r[0].problems[0]), r);
  r = notes(["x = {=1/0}", "y = {=ANS*2}"]);
  ok("ANS after a sum that failed says so, not a number from further back", r[1].text === "y = ?" && /could not be worked out/.test(r[1].problems[0]), r);
  r = notes(["a = {=5}", "b = {=1/0}", "c = {=ANS3}"]);
  ok("ANS3 is questioned too", r[2].text === "c = ?" && /in place of ANS3/.test(r[2].problems[0]), r);
  r = [NT("It = {=9/ANS} A"), NT("Rt = {=1/(1/10+1/15)} ohm")];
  ok("a note worked out alone (no state) is as before but for ANS: questioned, not divided by 0", r[0].text === "It = ? A" && /no sum before it/.test(r[0].problems[0]) && r[1].text === "Rt = 6 ohm", r);
  r = notes(["the \x22ANS\x22 key: {=2+2}"]);
  ok("ANS in words outside the braces is only words", r[0].text === "the \x22ANS\x22 key: 4", r);

  // (the review of 1.24.37) a total made of numbers that are not the circuit's goes back, written straight or through ANS
  var POB = "MAKE SCHEMATIC: R\nmode electrical\npart B1 battery \x229 V\x22\npart R1 resistor \x224 ohm\x22\npart R2 resistor \x224 ohm\x22\nwire B1 R1\nwire R1 B1\nwire B1 R2\nwire R2 B1\n";
  var mf = L.aiAct.build(POB + "note product over sum {=100*200/(100+200)}\nnote Rt = {=ANS} ohm\nEND", "Draw two 4 ohm resistors in parallel on a 9 V battery and show the total resistance");
  ok("a total of numbers that are not the circuit's, carried by ANS, goes back with the line to write", !mf.ok && (mf.problems || []).some(function (p) { return /not values of this circuit/.test(p) && /Write the note line as: note/.test(p); }), mf.problems);
  var mg = L.aiAct.build(POB + "note R1 = {=4} ohm\nnote R2 = {=4} ohm\nnote together = {=4*4/(4+4)} ohm\nEND", "Draw two 4 ohm resistors in parallel on a 9 V battery and show the total resistance");
  ok("a right total is left", mg.ok, mg.problems);
  // every kind of drawing with worked notes carries ANS: a control circuit's and an electronics circuit's notes
  var mc = L.aiAct.build("MAKE CONTROL: Pump\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22pump starter\x22\noverload OL1 M1\nnote FLA = {=7.5*746/(230*0.85)} A\nnote overload set at {=ANS*1.15} A\nEND", "Draw a pump starter with the motor's full load current worked out");
  ok("a control circuit's notes carry ANS", mc.ok && /overload set at 32\.91 A/.test(JSON.stringify(mc.plan || {})), { ok: mc.ok, problems: mc.problems });
  var me = L.aiAct.build("MAKE ELECTRONICS: LED\nsupply \x225 V\x22\nled D1 red\nnote R = {=(5-2)/0.02} ohm\nnote P = {=0.02^2*ANS} W\nEND", "Draw an LED on 5 V with its resistor worked out");
  ok("an electronics circuit's notes carry ANS", /P = 0\.06 W/.test(JSON.stringify(me.plan || me)), { ok: me.ok, problems: me.problems });
  console.log(fails ? fails + " NOTES ANS 1.24.37 FAILURES (" + (n - fails) + " passed)" : "ALL NOTES ANS 1.24.37 CHECKS PASS (" + n + ")");
  process.exit(fails ? 1 : 0);
}, 120);
