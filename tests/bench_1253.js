// bench_1253.js -- 1.24.13: a Start/Stop sketch run, not read by its names; what each kind of question costs.
// The 35B wrote the P1AM seal-in with its normally closed Stop the wrong way round on 1.24.12's test build
// ("if (stopPressed) { motorRunning = true; }") and on the build that was pushed ("stopPressed =
// !P1.readDiscrete(inSlot, 2)" then "(startPressed || motorRunning) && stopPressed"): the motor ran only while Stop
// was pressed, and the bench passed the second (tests/fixtures/bench_run_1252_35b_code*.json). Now:
//  - Lantern.codeScan runs a P1AM sketch press by press (nothing else: a loop, an array, a string, a member, and
//    there is no run), and the bench's P1AM question is graded by what the motor does;
//  - Lantern sends such a sketch back once (AI_CODE stopScan) when the question says how the Stop is wired, with
//    the line written the other way round -- only a line that, run again, works;
//  - Lantern's own P1AM example names its Stop as the 35B did (stopPressed) and uses it the right way round;
//  - the bench says, per kind of question, the tokens per right answer and the rounds (the research thread's brief,
//    agent/briefs/2026-11-09-model-lantern-boundary.txt).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load() {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(JS);
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  return { L: w.Lantern, errs: errs, w: w };
}
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8")); }
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var o = load(), L = o.L, w = o.w;
  await sleep(60);
  var S = L.codeScan, act = L.aiAct, B = L.aiBench, AC = L.aiCode;
  ok("boot clean; 1.24.13; the runner is there", o.errs.length === 0 && L.version === "1.24.13" && S && typeof S.startStop === "function" && typeof AC.stopScan === "function", o.errs);
  var sq = L.aiBenchQuestions.filter(function (q) { return q.id === "code-p1am-seal-in"; })[0];
  function body(t) { var m = /language arduino\n([\s\S]*?)\nEND\s*$/.exec(t) || /\x60\x60\x60\w*\n([\s\S]*?)\x60\x60\x60/.exec(t); return m ? m[1] : t; }
  function benchWhy(text) { var mk = act.fromReply(text, sq.q); return mk && mk.plan ? B.grade(sq, text, { made: { ok: true, plan: mk.plan, action: mk.action, problems: [] } }).why : "not read"; }
  function wrap(sk) { return "MAKE CODE: Motor\nlanguage arduino\n" + sk + "\nEND"; }

  // --- the question's wiring ---
  var W = S.wiring(sq.q);
  ok("the bench's question: Start on input 1, a normally closed Stop on input 2, the contactor on output 1", W && W.start.ch === 1 && !W.start.nc && W.stop.ch === 2 && W.stop.nc && W.out && W.out.ch === 1, W);
  var wq = [
    ["Write a P1AM sketch: Start pushbutton on input 3, Stop pushbutton on input 4 (normally open), motor on output 2.", { s: 3, p: 4, nc: false }],
    ["P1AM-100: a normally open Start button wired to input 1 and an NC Stop button wired to input 2, motor contactor on output 1.", { s: 1, p: 2, nc: true }],
    ["P1AM: Start button on input 1, Stop button on input 2, motor on output 1.", null],                                                   // the Stop's wiring not said
    ["P1AM: Start on input 1, a normally closed Stop on input 2 and a normally closed E-stop on input 3, motor on output 1.", null]];     // two stops
  var wbad = wq.filter(function (x) { var r = S.wiring(x[0]); return x[1] ? !(r && r.start.ch === x[1].s && r.stop.ch === x[1].p && r.stop.nc === x[1].nc) : r !== null; });
  ok("other ways of saying it are read; a question that does not say how the Stop is wired, or has two, is not", !wbad.length, wbad.map(function (x) { return [x[0], S.wiring(x[0])]; }));

  // --- the runner: nothing outside its part of C, and nothing that reaches the page ---
  var hit = [], href = w.location.href;
  w.alert = function () { hit.push("alert"); }; w.print = function () { hit.push("print"); }; w.close = function () { hit.push("close"); };
  var escapes = ["void f(int alert) {}\nvoid loop() { alert(1); }", "void f(int location) {}\nvoid loop() { location = 1; }", "void loop() { print(); }",
    "void f(int close) {}\nvoid loop() { close(); }", "void loop() { window.alert(1); }", "void loop() { int a[3]; a[0] = 1; }", "void loop() { while (1) {} }",
    "void loop() { for (;;) {} }", "void f(int n) { if (n > 0) { f(n - 1); f(n - 1); } }\nvoid loop() { f(40); }", "void loop() { String s = \x22a\x22; }"];
  escapes.forEach(function (t) { var s = S.sketch(t); if (s) s.scan({}); });
  ok("ten sketches that try to get out (an alert, a navigation, a loop, recursion that never ends ...) reach nothing", !hit.length && w.location.href === href, hit);

  // --- the bench's P1AM question, graded by what the motor does ---
  var A = fixture("bench_run_1252_35b_code.json"), F = fixture("bench_run_1252_35b_code_final.json"), G = fixture("bench_run_1251_35b_library.json");
  var r1251 = G.rows.filter(function (r) { return r.id === "code-p1am-seal-in"; })[0].reply, rTest = A.rows[0].reply, rFinal = F.rows[0].reply;
  ok("the 35B's three P1AM programs, run: Start wins (1.24.11), and twice the motor runs only while Stop is pressed (1.24.12's test build and the build pushed)",
    /Start wins over Stop/.test(benchWhy(r1251)) && benchWhy(rTest) === "Stop turns the motor on: it runs only while Stop is pressed" &&
    benchWhy(rFinal) === "Stop turns the motor on: it runs only while Stop is pressed", [benchWhy(r1251), benchWhy(rTest), benchWhy(rFinal)]);
  ok("...the last of them passed the bench of 1.24.12 (names were read, not the run)", F.rows[0].pass === true && F.lantern === "1.24.12");
  ok("the question's own model program passes, and Lantern's P1AM example run on the question's wiring passes (its overload healthy)",
    benchWhy(sq.ideal) === "" && S.startStop(L.codeExamples.filter(function (x) { return x.id === "arduino-p1am-discrete-io"; })[0].text, W).pass === true);

  // --- Lantern sends it back, with the line ---
  var mt = act.fromReply(rTest, sq.q), mf = act.fromReply(rFinal, sq.q);
  ok("the build pushed: Lantern sends it back once, with what the question says, what the run showed, and the line the other way round",
    mf && !mf.ok && mf.problems.length === 1 && /^Stop turns the motor on: the question says the Stop is normally closed, so input 2 is OFF while Stop is pressed, and stopPressed = !P1\.readDiscrete\(inSlot, 2\) makes stopPressed ON while Stop is pressed\. Lantern ran the sketch: Start alone does not start the motor; with Stop held, Start does, and the motor runs only while Stop is held\. Use stopPressed the other way round\. Write: motorRunning = \(startPressed \|\| motorRunning\) && !stopPressed;$/.test(mf.problems[0]), mf && mf.problems);
  ok("the test build's if: the same, the line being the if's own", mt && mt.problems.length === 1 && /Write: if \(!stopPressed\) \{ \(in place of if \(stopPressed\) \{\)$/.test(mt.problems[0]), mt && mt.problems);
  // the line written in, as a model would: nothing to say, and the bench passes it
  var fixedF = rFinal.replace("&& stopPressed;", "&& !stopPressed;"), fixedT = rTest.replace("if (stopPressed) {", "if (!stopPressed) {");
  var mf2 = act.fromReply(fixedF, sq.q), mt2 = act.fromReply(fixedT, sq.q);
  ok("with the line written in, both run right: Lantern says nothing and the bench passes them", mf2 && mf2.ok && mt2 && mt2.ok && benchWhy(fixedF) === "" && benchWhy(fixedT) === "", [mf2 && mf2.problems, mt2 && mt2.problems, benchWhy(fixedF), benchWhy(fixedT)]);

  // --- what it leaves alone ---
  var right = [
    "#include <P1AM.h>\nbool run = false;\nvoid setup() { while (!P1.init()) { } }\nvoid loop() {\n  bool start = P1.readDiscrete(1, 1);\n  bool stopOk = P1.readDiscrete(1, 2);\n  run = (start || run) && stopOk;\n  P1.writeDiscrete(run, 2, 1);\n}",
    "#include <P1AM.h>\nbool run = false;\nvoid setup() { while (!P1.init()) { } }\nvoid loop() {\n  bool stopPressed = !P1.readDiscrete(1, 2);\n  if (stopPressed) run = false;\n  else if (P1.readDiscrete(1, 1)) run = true;\n  P1.writeDiscrete(run, 2, 1);\n}",
    "#include <P1AM.h>\nconst int IN = 1, OUT = 2, START = 1, STOP = 2;\nbool motor = false;\nvoid setup() { while (!P1.init()) { ; } }\nvoid loop() {\n  motor = (P1.readDiscrete(IN, START) || motor) && P1.readDiscrete(IN, STOP);\n  P1.writeDiscrete(motor, OUT, 1);\n  P1.writeDiscrete(motor, OUT, 2);\n}",
    "#include <P1AM.h>\nbool running = false;\nbool stopPushed() { return !P1.readDiscrete(1, 2); }\nvoid setup() { while (!P1.init()) { } }\nvoid loop() {\n  if (stopPushed()) { running = false; }\n  if (P1.readDiscrete(1, 1) && !stopPushed()) { running = true; }\n  P1.writeDiscrete(running, 2, 1);\n}"];
  var loud = right.filter(function (t) { return AC.stopScan("arduino", t, sq.q).length || benchWhy(wrap(t)) !== ""; });
  ok("right programs in four styles (stopOk, stopPressed with an if, the reads inline with constants, a function for the Stop): no message, and the bench passes them", !loud.length,
    loud.map(function (t) { return [t.slice(-160), AC.stopScan("arduino", t, sq.q), benchWhy(wrap(t))]; }));
  ok("the wrong program on a question that does not say how its Stop is wired: Lantern says nothing (it cannot know which way round is right)",
    !AC.stopScan("arduino", body(rFinal), "Write a P1AM-100 sketch: a Start button on input 1 and a Stop button on input 2 of the input module in slot 1, a motor contactor on output 1 of slot 2, with a seal-in.").length);
  var ex = L.codeExamples.filter(function (x) { return x.id === "arduino-p1am-discrete-io"; })[0];
  ok("Lantern's P1AM example now says stopPressed, as the 35B writes it, and uses it the right way round (&& !stopPressed); Lantern has nothing to say about it",
    /bool stopPressed = !P1\.readDiscrete\(inSlot, 2\);/.test(ex.text) && /&& !stopPressed && !overloadTripped;/.test(ex.text) && !/stopOk/.test(ex.text) &&
    !AC.stopScan("arduino", ex.text, sq.q).length && !AC.startWins("arduino", ex.text, sq.q).length);

  // --- the small models' run on 1.24.12 (GitHub run 42701646389, tests/fixtures/bench_run_1252_*.json) ---
  var R08 = fixture("bench_run_1252_08b.json"), R2 = fixture("bench_run_1252_2b.json"), R4 = fixture("bench_run_1252_4b.json");
  var P08 = fixture("bench_run_1251_08b.json"), P2 = fixture("bench_run_1251_2b.json"), P4 = fixture("bench_run_1251_4b.json");
  function rowOf(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  ok("1.24.12 on GitHub: the 0.8B 59, the 2B 73, the 4B 107 of 114 (59, 72, 106 on 1.24.11); the 4B on the same AMD EPYC 7763",
    R08.summary.pass === 59 && R2.summary.pass === 73 && R4.summary.pass === 107 && R4.processor === "AMD EPYC 7763" && P4.processor === R4.processor && R08.lantern === "1.24.12");
  ok("what 1.24.12 was for: the 4B's tank fill passes (four versions failed with a runaway LESSON and a program cut in its fence), and the 2B's Blink passes (read without its MAKE line, sent back with the millis() lines)",
    rowOf(P4, "code-st-tank-fill") && !rowOf(R4, "code-st-tank-fill") && rowOf(P2, "code-blink-millis") && !rowOf(R2, "code-blink-millis"));
  ok("...the 2B's tank fill is read now and sent back, and the 2B did not mend what was sent (QUEUE 1); the 0.8B wrote its code replies of 1.24.11 word for word, one of them the MAKE CODE instructions themselves",
    /^Lantern still questions it: line 4: put the AT %I\/%Q variables in a VAR block/.test(rowOf(R2, "code-st-tank-fill").why) && rowOf(P2, "code-st-tank-fill").why === "no MAKE block" &&
    ["code-accelstepper", "code-js-ohms-law", "code-ladder-start-stop", "code-python-csv-average", "code-st-tank-fill"].every(function (id) { return rowOf(R08, id).reply === rowOf(P08, id).reply; }) &&
    /^MAKE CODE: <title>   -- a program Lantern checks/m.test(rowOf(R08, "code-ladder-start-stop").reply));

  // --- what each kind of question costs ---
  var rows = [{ cat: "tool", pass: true, tokens: 30, rounds: 1, ms: 1000 }, { cat: "tool", pass: true, tokens: 24, rounds: 1, ms: 1000 },
    { cat: "make", pass: true, tokens: 300, rounds: 2, ms: 1000 }, { cat: "make", pass: false, tokens: 100, rounds: 1, ms: 1000 },
    { cat: "chat", pass: true, tokens: 50, rounds: null, chat: [{ rounds: 2 }, { rounds: 1 }], ms: 1000 }, { cat: "alone", pass: false, tokens: 900, rounds: 1, ms: 1000 }];
  var sm = B.summary(rows);
  ok("the summary gives, per kind, tokens per right answer, the median tokens and the rounds per question; and over all the scored",
    sm.byCat.tool.tokensPerPass === 27 && sm.byCat.tool.roundsPer === 1 && sm.byCat.make.tokensPerPass === 400 && sm.byCat.make.roundsPer === 1.5 &&
    sm.byCat.chat.roundsPer === 3 && sm.byCat.make.medianTokens === 300 && sm.tokensPerPass === Math.round((54 + 400 + 50) / 4) && sm.byCat.tool.n === 2 && sm.byCat.tool.pass === 2, sm);
  console.log(fails ? fails + " 1.24.13 FAILURES (" + passes + " passed)" : "ALL 1.24.13 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
