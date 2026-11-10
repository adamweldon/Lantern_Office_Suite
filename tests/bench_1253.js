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

  // --- the fifth review (tests/fixtures/review5_1253_*.json) ---
  // 164 sketches of the reviewer's own, run through its own evaluator and check (tests/review5_p1am_check.js)
  var R5 = fixture("review5_1253_p1am.json").items, r5 = require("./review5_p1am_check.js")(L, R5);
  var rightOut = r5.out.filter(function (x) { return x.right; }), wrongOut = r5.out.filter(function (x) { return !x.right; });
  ok("review 5: none of its 95 right sketches gets a message, and the bench passes those that answer its question (7 spoken about, 4 failed, on the build it was given)",
    rightOut.length === 95 && rightOut.every(function (x) { return !x.stopScan.length && !x.bench; }), rightOut.filter(function (x) { return x.stopScan.length || x.bench; }).map(function (x) { return [x.id, x.stopScan, x.bench]; }));
  ok("review 5: of its 69 wrong ones, every one the bench is asked about fails it, and 48 get a message; the six left are a motor that starts again when Stop is let go (the Stop read right: the bench says it) and a sketch timed with millis()",
    wrongOut.length === 69 && wrongOut.filter(function (x) { return x.stopScan.length; }).length >= 48 &&
    r5.misses.map(function (m) { return m[0]; }).join() === "W11-output-gated-restart,W12-ternary-gate-restart,W26-request-latch-restart,W46-latch-gate-right-read,W65-B0-restart-gate-two-uses,W66-millis-beacon-wrong-stop" &&
    !r5.findings.some(function (f) { return /bench passes a wrong program|wiring read wrong|message on a right|bench fails a right/.test(f[1]); }), [r5.misses.map(function (m) { return m[0]; }), r5.findings]);
  // (review 6's mends: an input the question leaves open that holds the motor off whatever is pressed -- an overload left
  // tripped -- says nothing about the Stop; so three wrong sketches its spec left to silence are spoken about now, and
  // truly: a Stop read from input 3 where the question has it on 2, and two with an overload, each given a line that works)
  var allowed = { "W10-stop-wrong-channel": /^Stop does not stop the motor/, "W19-overload-plus-wrong-stop": /Write: running = \(start \|\| running\) && !stopPressed && olOk;$/,
    "W57-QQ-overload-named-wrong": /Write: running = \(start \|\| running\) && !stopPressed && olOk;$/ };
  ok("review 5: every line to write, put in the sketch and run by the reviewer's own evaluator, works (one, a statement over two lines, is given whole on one line: its placing tool cannot set it back, the line is right)",
    r5.out.filter(function (x) { return x.writeCheck === "works"; }).length >= 35 && r5.findings.every(function (f) {
      return (f[0] === "W38-split-line" && /could not place/.test(f[2])) || (allowed[f[0]] && f[1] === "message where the spec says silent" && allowed[f[0]].test(f[2]));
    }), r5.findings);
  var esc = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "review5_escape_run.js")], { timeout: 120000, encoding: "utf8" }), er = null;
  try { er = JSON.parse(String(esc.stdout).trim().split("\n").pop()); } catch (e) { er = null; }
  ok("review 5's 45 sketches that try to get out (12 reached the page and 11 hung or crawled through the first runner, which turned the sketch into JavaScript): nothing reached, no navigation, none over 3 seconds",
    er && er.cases.length === 45 && !er.navigated && !er.name && er.cases.every(function (c) { return !c.reached.length && c.ms < 3000; }), er ? er.cases.filter(function (c) { return c.reached.length || c.ms >= 3000; }) : [esc.status, esc.signal, String(esc.stderr).slice(0, 300)]);

  // --- the sixth review (tests/fixtures/review6_1253_*.json) ---
  // 77 small sketches run by Lantern's interpreter and, by the reviewer, as C++ (g++): the outputs C gave are kept
  var I6 = fixture("review6_1253_interp.json").items, view6 = function (out) {
    var v = {}, slots = {};
    Object.keys(out || {}).forEach(function (k) { var sl = +k.split(":")[0], ch = +k.split(":")[1]; if (sl >= 9 && sl <= 15 && k.indexOf("pin") < 0) { slots[sl] = slots[sl] || 0; if (out[k]) slots[sl] |= (1 << (ch - 1)); } else v[k] = out[k] ? 1 : 0; });
    for (var sl in slots) v["s" + sl] = slots[sl] | 0;
    return v;
  };
  var idiff = I6.filter(function (c) {
    var sk = S.sketch(c.sketch); if (!sk) return true;
    return c.scans.some(function (inp, i) { var a = view6(sk.scan(inp)), b = c.c[i], ks = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { ks[k] = 1; }); return Object.keys(ks).some(function (k) { return a[k] !== b[k]; }); });
  }).map(function (c) { return c.id + " " + c.desc; });
  ok("review 6: its 77 sketches run as C runs them, scan by scan (18 did not: a bool not made 0 or 1, integer sizes, float division, octal and character literals, macros)", I6.length === 77 && !idiff.length, idiff);
  // 59 start/stop sketches in other words
  var P6 = fixture("review6_1253_p1am.json").items, item6 = sq;
  var p6 = P6.map(function (c) {
    var said = AC.stopScan("arduino", c.sketch, c.q), rp = wrap(c.sketch), mk = act.fromReply(rp, c.q);
    return { id: c.id, right: c.kind === "right", bench: !!c.bench, said: said, why: c.bench ? B.grade(item6, rp, { made: mk }).why : null };
  });
  var r6bad = p6.filter(function (x) { return x.right && (x.said.length || (x.bench && x.why)); }), w6 = p6.filter(function (x) { return !x.right; });
  ok("review 6: none of its 37 right sketches gets a message, and the bench passes those that answer its question (a // inside a string and a bool from a bitmask failed it)",
    p6.filter(function (x) { return x.right; }).length === 37 && !r6bad.length, r6bad);
  ok("review 6: of its 22 wrong ones, all but one get a message (the one left keeps its inputs in an array, which is not run), and the bench fails all it can run",
    w6.length === 22 && w6.filter(function (x) { return !x.said.length; }).map(function (x) { return x.id; }).join() === "X21" &&
    w6.filter(function (x) { return x.bench && !x.why; }).map(function (x) { return x.id; }).join() === "X21", w6.filter(function (x) { return !x.said.length || (x.bench && !x.why); }));
  var x22 = p6.filter(function (x) { return x.id === "X22"; })[0];
  ok("...and a statement over two lines with a // comment in it is given whole on one line without the comment (it hid the rest)", x22 && /Write: running = !stopPressed && \(start \|\| running\);$/.test(x22.said[0] || ""), x22 && x22.said);
  var esc6 = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "review6_safety_run.js")], { timeout: 240000, encoding: "utf8" }), e6 = null;
  try { e6 = JSON.parse(String(esc6.stdout).trim().split("\n").pop()); } catch (e) { e6 = null; }
  ok("review 6's 93 safety sketches (names like __proto__ and constructor, 100,000 brackets, doubling macros, writes to ever-new slots, 2,300 lines naming the Stop): nothing reaches the page, nothing throws out, none takes 5 seconds (six took longer or crashed)",
    e6 && e6.cases.length === 93 && !e6.navigated && !e6.proto && e6.cases.every(function (c) { return !c.reached.length && !c.err && c.ms < 5000; }),
    e6 ? e6.cases.filter(function (c) { return c.reached.length || c.err || c.ms >= 5000; }) : [esc6.status, esc6.signal, String(esc6.stderr).slice(0, 300)]);

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
