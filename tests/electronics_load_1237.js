// electronics_load_1237.js -- a transistor's load named on its own line only, or by the guide's relay K1 (1.24.37).
//
// Adam, 2026-11-24, with a screenshot of his laptop's bench (the 35B, make-electronics-b, "Draw a circuit in which an
// Arduino output pin switches a 12 V DC motor through an NPN transistor"). Its first reply:
//     supply "12 V" / pin P1 "Arduino D9" / transistor Q1 K1 P1 / motor M1 P1 / diode D1 M1
// -- "transistor Q1 K1 P1" is the guide's own line (its example is a relay K1). Lantern said Q1 switched nothing,
// "like: transistor Q1 K1 P1" (the guide's line again). The second reply wrote "transistor Q1 M1 P1" and left the motor's
// own line out; Lantern said there was nothing to power, "like: led D1", the transistor switched nothing "like:
// transistor Q1 K1 P1", the diode should name "K1". Both failed, and the row with them. The same two replies, word for
// word, are saved from an earlier run of the 35B in tests/fixtures/bench_run_1258_35b_setb.json: the same row failing twice.
// What is checked: both replies draw the motor switched by Q1 from P1, with its diode, and say what Lantern read; the
// row passes; where Lantern is not sure -- two loads free, the question naming two kinds or none, the load on another
// pin, a letter that is not the asked kind -- nothing is read in, and what goes back names this question's load, not
// the guide's K1.
"use strict";
var path = require("path");
var load = require("./fixtures/liftstation_review1_1230/load.js");
var o = load(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html")), L = o.L;
var fails = 0, n = 0;
function ok(name, cond, info) { n++; if (cond) console.log("ok   " + name); else { fails++; console.log("FAIL " + name); if (info !== undefined) console.log("     " + JSON.stringify(info).slice(0, 800)); } }
function blk(lines) { return "MAKE ELECTRONICS: Arduino Motor Driver\n" + lines.join("\n") + "\nEND"; }
setTimeout(function () {
  var Q = "Draw a circuit in which an Arduino output pin switches a 12 V DC motor through an NPN transistor.";
  var R1 = blk(["supply \x2212 V\x22", "pin P1 \x22Arduino D9\x22", "transistor Q1 K1 P1", "motor M1 P1", "diode D1 M1", "note Flyback diode across motor to protect transistor"]);
  var R2 = blk(["supply \x2212 V\x22", "pin P1 \x22Arduino D9\x22", "transistor Q1 M1 P1", "diode D1 M1", "note Flyback diode across motor to protect transistor"]);
  var it = (L.aiBenchQuestionsB || []).filter(function (x) { return x.id === "make-electronics-b"; })[0];
  function br(m) { var c = m.plan && m.plan.circuit; return c ? c.branches.map(function (b) { return [b.load && b.load.id, b.load && b.load.kind, b.q, b.pin, b.diode && b.diode.id]; }) : null; }
  [[R1, "the first reply (transistor Q1 K1 P1 beside motor M1 P1)", /Q1’s line names K1, which no line has: M1 is the one motor for it to switch/], [R2, "the second reply (transistor Q1 M1 P1, no motor line)", /added motor M1, which Q1’s line names/]].forEach(function (x) {
    var m = L.aiAct.build(x[0], Q), b = br(m), g = it && L.aiBench.grade(it, x[0], { made: m });
    ok(x[1] + ": the motor switched by Q1 from P1, its diode D1, said; the row passes",
      m.ok && b && b.length === 1 && b[0][0] === "M1" && b[0][1] === "motor" && b[0][2] === "Q1" && b[0][3] === "P1" && b[0][4] === "D1" && x[2].test(m.summary || "") && g && g.pass, { ok: m.ok, problems: m.problems, b: b, g: g, s: m.summary });
  });
  function build(lines, q) { return L.aiAct.build(blk(lines), q || Q); }
  var m;
  m = build(["supply \x2212 V\x22", "pin P1 \x22D9\x22", "transistor Q1 K1 P1", "motor M1 P1", "lamp L1 P2"]);
  ok("two loads free: K1 is not read as either", !m.ok && m.problems.some(function (p) { return /Q1 switches nothing/.test(p); }), m.problems);
  m = build(["supply \x2212 V\x22", "pin P1 \x22D9\x22", "pin P2 \x22D10\x22", "transistor Q1 K1 P1", "motor M1 P2"]);
  ok("the motor on another pin: not read as Q1's", !m.ok || !/Q1’s line names K1/.test(m.summary || ""), { ok: m.ok, problems: m.problems, s: m.summary });
  m = build(["supply \x2212 V\x22", "pin P1 \x22D9\x22", "transistor Q1 K1 P1", "motor M1 P1"], "Draw an Arduino pin switching a relay that runs a 12 V motor through an NPN transistor");
  ok("a question naming a relay and a motor: nothing read in", !m.ok && m.problems.some(function (p) { return /Q1 switches nothing/.test(p); }), m.problems);
  m = build(["supply \x2212 V\x22", "pin P1 \x22D9\x22", "transistor Q1 X1 P1"]);
  ok("a letter that is not the asked kind is not added, and what goes back names the motor asked for, not K1",
    !m.ok && m.problems.some(function (p) { return /add the motor the question asks for, like: motor M1/.test(p); }) && !m.problems.some(function (p) { return /\bK1\b/.test(p); }), m.problems);
  m = build(["supply \x2212 V\x22", "pin P1 \x22D9\x22", "transistor Q1 K1 P1"], "Draw an Arduino output pin switching a 12 V relay coil through an NPN transistor");
  ok("the relay asked for, named only on the transistor's line: added, and said", m.ok && /added relay K1/.test(m.summary || ""), { ok: m.ok, problems: m.problems });
  m = build(["supply \x2212 V\x22", "pin P1 \x22D9\x22", "transistor Q1 M1 P1"], "Draw a transistor switching something from an Arduino pin");
  ok("no kind asked: M1 is not guessed a motor", !m.ok, m.problems);
  // the guide's own example still draws as before
  m = L.aiAct.build("MAKE ELECTRONICS: Relay driver\nsupply \x2212 V\x22\npin P1 \x22Arduino D7\x22\nrelay K1 \x2212 V coil\x22\ntransistor Q1 K1 P1\nEND", "Draw a circuit in which an Arduino output pin switches a 12 V relay coil through an NPN transistor.");
  ok("the guide's relay driver as before, nothing read in", m.ok && !/which no line has|which Q1’s line names/.test(m.summary || ""), { ok: m.ok, problems: m.problems });
  console.log(fails ? fails + " ELECTRONICS LOAD 1.24.37 FAILURES (" + (n - fails) + " passed)" : "ALL ELECTRONICS LOAD 1.24.37 CHECKS PASS (" + n + ")");
  process.exit(fails ? 1 : 0);
}, 120);
