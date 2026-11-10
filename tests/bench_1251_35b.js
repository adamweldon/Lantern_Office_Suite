// bench_1251_35b.js -- Adam's run of the 35B on 1.24.11 with the library, replayed (1.24.12).
// His laptop, 2026-11-09, 128 minutes: 134 of 140, as on 1.24.9 (tests/fixtures/bench_run_1251_35b_library.json).
//  - 1.24.11's change did its work: what oral rehydration solution is made of is read on the medicine shelf and
//    passes; so does the waltz (1.24.10);
//  - the iPhone's battery and Nairobi's transport fail on their citations, as on 1.24.9 (the same rows twice);
//  - two rows fail for the first time. One of them is a program that would hurt someone: for "a Start button and a
//    normally closed Stop button ... with a seal-in" on a P1AM, the 35B wrote
//        if (startPressed) { motorRunning = true; } else if (stopPressed) { motorRunning = false; }
//    -- while Start is held, Stop is never looked at. Lantern found nothing, and the bench said "no seal-in".
//    1.24.12 sends it back with the lines that work (Stop tested first), and the bench says what was wrong;
//  - the shore at sunset and the road to the horizon fail as on 1.24.9, each in a new way.
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
  return { L: w.Lantern, errs: errs };
}
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8")); }
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct, AC = L.aiCode;
  var F = fixture("bench_run_1251_35b_library.json"), G = fixture("bench_run_1249_35b_library.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  function ids(X) { return X.rows.map(function (r) { return r.id; }).sort(); }
  ok("boot clean; the run\u2019s nine rows that did not pass (three of them puzzles without the tools, not scored), 134 of 140", o.errs.length === 0 && F.lantern === "1.24.11" &&
    F.rows.length === 9 && F.summary.pass === 134 && F.summary.n === 140, [o.errs, F.summary]);
  ok("against 1.24.9: oral rehydration and the waltz pass now; the P1AM seal-in, the two coins and two puzzles without the tools fail for the first time",
    ids(G).filter(function (i) { return ids(F).indexOf(i) < 0; }).join() === "make-music-waltz,shelf-ors" &&
    ids(F).filter(function (i) { return ids(G).indexOf(i) < 0; }).join() === "code-p1am-seal-in,cups-two-coins,doors-host-guesses-alone,houses-four-alone", [ids(F), ids(G)]);
  ok("the iPhone and Nairobi fail on their citations as on 1.24.9 (the same rows twice: QUEUE 2)", ["shelf-iphone-battery", "shelf-nairobi-transport"].every(function (id) { return row(F, id).why === row(G, id).why; }));

  // --- the seal-in in which Start wins ---
  var sq = item("code-p1am-seal-in"), sr = row(F, "code-p1am-seal-in");
  ok("the 35B wrote its program in a fence, not a MAKE CODE block: a set and a reset, Start tested first", !/MAKE CODE/.test(sr.reply) && /if \(startPressed\) \{\s*motorRunning = true;\s*\} else if \(stopPressed\)/.test(sr.reply.replace(/\/\/[^\n]*/g, "")));
  var made = act.fromReply(sr.reply, sq.q), back = act.replyCode(sr.reply, sq.q);
  ok("1.24.12: Lantern reads it and sends it back once: Start wins over Stop, with the lines to write -- the model\u2019s own names, Stop first",
    made && !made.ok && back && made.problems.length === 1 && /^Start wins over Stop: while both are on, if \(startPressed\) turns motorRunning on and else if \(stopPressed\) is never reached/.test(made.problems[0]) &&
    /NFPA 79, IEC 60204-1/.test(made.problems[0]) && /Test Stop first -- the whole if again, every branch kept: if \(stopPressed\) \{ motorRunning = false; \} else if \(startPressed\) \{ motorRunning = true; \}$/.test(made.problems[0]), made && made.problems);
  ok("...and the message that goes back holds that line", back && /Lantern checked the code in your reply: Start wins over Stop/.test(act.replyCodeText(back)));
  // the program with the line written in, as a model would: Lantern finds nothing, and the bench passes it
  var fixed = sr.reply.replace(/if \(startPressed\) \{\s*motorRunning = true;\s*\} else if \(stopPressed\) \{\s*motorRunning = false;\s*\}/, "if (stopPressed) { motorRunning = false; } else if (startPressed) { motorRunning = true; }");
  var mf = act.fromReply(fixed, sq.q);
  ok("the program with that line in it: no problems, and the bench passes it", fixed !== sr.reply && mf && mf.ok && B.grade(sq, fixed, { made: mf }).pass === true, mf && mf.problems);
  ok("the bench now says what was wrong with the 35B\u2019s program (it said \u201cno seal-in\u201d)", B.grade(sq, sr.reply, { made: { ok: true, plan: made.plan, action: made.action, problems: [] } }).why === "Start wins over Stop: while Start is held, Stop cannot stop the motor");
  ok("the bench passes the question\u2019s own model reply, a stop-first set and reset, and the OR with the motor\u2019s own state; it fails no hold at all",
    B.grade(sq, sq.ideal, { made: act.build(sq.ideal, sq.q) }).pass &&
    !sq.check({ lang: "arduino", text: "#include <P1AM.h>\nbool run = false;\nvoid setup() { while (!P1.init()) { } }\nvoid loop() {\n  bool start = P1.readDiscrete(1, 1);\n  bool stopPressed = !P1.readDiscrete(1, 2);\n  if (stopPressed) { run = false; } else if (start) { run = true; }\n  P1.writeDiscrete(run, 2, 1);\n}\n" }) &&
    /^no seal-in/.test(sq.check({ lang: "arduino", text: "#include <P1AM.h>\nvoid setup() { while (!P1.init()) { } }\nvoid loop() {\n  P1.writeDiscrete(P1.readDiscrete(1, 1) && P1.readDiscrete(1, 2), 2, 1);\n}\n" })));

  // --- what the rule acts on, and what it leaves alone ---
  var SQ = "Write a sketch with a Start button and a Stop button that runs a motor, with a seal-in.";
  function sw(lang, text, q) { return AC.startWins(lang, text, q || SQ); }
  var wrong = [
    ["arduino", "void loop() {\n  if (start) run = true;\n  else if (stop) run = false;\n}\n", /every branch kept: if \(stop\) \{ run = false; \} else if \(start\) \{ run = true; \}$/],
    ["arduino", "void loop() {\n  if (digitalRead(stopPin) == LOW) { running = false; }\n  if (digitalRead(startPin) == LOW) { running = true; }\n}\n", /Put the Stop test last: if \(digitalRead\(startPin\) == LOW\) \{ running = true; \} if \(digitalRead\(stopPin\) == LOW\) \{ running = false; \}/],
    ["arduino", "void loop() {\n  motor = start || (motor && !stopPressed);\n}\n", /Write: motor = \(start \|\| motor\) && !stopPressed;$/],
    ["arduino", "void loop() {\n  motor = startBtn || motor && stopOk;\n}\n", /Write: motor = \(startBtn \|\| motor\) && stopOk;$/],
    ["arduino", "void loop() {\n  if (startBtn) { digitalWrite(MOTOR, HIGH); } else if (stopBtn) { digitalWrite(MOTOR, LOW); }\n}\n", /every branch kept: if \(stopBtn\) \{ digitalWrite\(MOTOR, LOW\); \} else if \(startBtn\) \{ digitalWrite\(MOTOR, HIGH\); \}$/],
    ["st", "PROGRAM M\nIF Start THEN Motor := TRUE; ELSIF Stop THEN Motor := FALSE; END_IF;\nEND_PROGRAM\n", /every branch kept: IF Stop THEN Motor := FALSE; ELSIF Start THEN Motor := TRUE; END_IF;$/],
    ["st", "PROGRAM M\nIF Stop THEN Motor := FALSE; END_IF;\nIF Start THEN Motor := TRUE; END_IF;\nEND_PROGRAM\n", /Put the Stop test last: IF Start THEN Motor := TRUE; END_IF; IF Stop THEN Motor := FALSE; END_IF;$/],
    ["st", "PROGRAM M\nMotor := Start OR (Motor AND NOT StopPB);\nEND_PROGRAM\n", /Write: Motor := \(Start OR Motor\) AND NOT StopPB;$/],
    ["st", "PROGRAM M\nIF Start THEN\n  IF Ready THEN Motor := TRUE; END_IF;\nELSIF EStop THEN Motor := FALSE;\nEND_IF;\nEND_PROGRAM\n", /every branch kept: IF EStop THEN Motor := FALSE; ELSIF Start THEN IF Ready THEN Motor := TRUE; END_IF; END_IF;$/]];
  var bad = wrong.filter(function (x) { var p = sw(x[0], x[1]); return p.length !== 1 || !x[2].test(p[0]); });
  ok("each way of letting Start win is found, and the line to write is the model\u2019s own conditions, Stop first or last", !bad.length, bad.map(function (x) { return [x[1], sw(x[0], x[1])]; }));
  var right = [
    ["arduino", "void loop() {\n  if (stop) run = false;\n  else if (start) run = true;\n}\n"],
    ["arduino", "void loop() {\n  if (start) run = true;\n  if (stop) run = false;\n}\n"],
    ["arduino", "void loop() {\n  motor = (start || motor) && !stopPressed;\n}\n"],
    ["arduino", "void loop() {\n  if (start && !stopPressed) { run = true; } else if (stopPressed) { run = false; }\n}\n"],
    ["arduino", "void loop() {\n  if (startPressed && stopOk) { run = true; }\n  if (!stopOk) { run = false; }\n}\n"],
    ["arduino", "void loop() {\n  if (start) { run = true; } else { run = false; }\n}\n"],
    ["st", "PROGRAM M\nMotor := (Start OR Motor) AND NOT Stop;\nEND_PROGRAM\n"],
    ["st", "PROGRAM M\nIF Stop THEN Motor := FALSE; ELSIF Start THEN Motor := TRUE; END_IF;\nEND_PROGRAM\n"],
    ["st", "PROGRAM M\nIF Start THEN Motor := TRUE; END_IF;\nIF Stop THEN Motor := FALSE; END_IF;\nEND_PROGRAM\n"]];
  var mis = right.filter(function (x) { return sw(x[0], x[1]).length; });
  ok("programs in which Stop wins are left alone", !mis.length, mis.map(function (x) { return [x[1], sw(x[0], x[1])]; }));
  ok("...as is a latch on a question that says nothing about starting and stopping (a stop sign, a bus stop)",
    !sw("arduino", wrong[0][1], "Write a sketch that counts passengers at each bus stop.").length && !sw("arduino", wrong[0][1], "Write a sketch that turns a lamp on at dusk.").length);
  var ex = (L.codeExamples || []).filter(function (x) { return x.lang === "arduino" || x.lang === "st"; }), exHit = ex.filter(function (x) { return sw(x.lang, x.text).length; });
  ok("Lantern\u2019s own tested examples (" + ex.length + " in Arduino and Structured Text) give it nothing to say", ex.length >= 25 && !exHit.length, exHit.map(function (x) { return x.id; }));
  var ideals = Q.filter(function (q) { return /^code-/.test(q.id) && /language (arduino|st)\b/.test(q.ideal); });
  ok("nor do the bench\u2019s own model programs", ideals.length >= 4 && ideals.every(function (q) { var p = act.build(q.ideal, q.q); return p && p.ok; }), ideals.map(function (q) { var p = act.build(q.ideal, q.q); return [q.id, p && p.problems]; }));

  // --- the 35B on the 1.24.12 test build (tests/fixtures/bench_run_1252_35b_code.json): the seven program questions passed ---
  var T = fixture("bench_run_1252_35b_code.json"), tp = row(T, "code-p1am-seal-in"), tl = row(T, "code-ladder-start-stop");
  ok("the test build\u2019s run: 7 of 7 program questions, two rows kept as written", T.summary && T.summary.pass === 7 && T.summary.n === 7 && T.rows.length === 2 && tp.pass === true && tl.pass === true, T.summary);
  // its P1AM seal-in: the motor runs only while Stop is pressed (stopPressed is !readDiscrete, so it is on when Stop is pressed)
  var tm = act.fromReply(tp.reply, sq.q);
  ok("the P1AM program the test build\u2019s bench passed turns the motor on only while Stop is pressed; 1.24.12\u2019s bench fails it and says so",
    /if \(stopPressed\) \{\s*motorRunning = true;/.test(tp.reply) && tm && B.grade(sq, tp.reply, { made: tm }).pass === false &&
    // (1.24.13: Lantern itself now runs the sketch and sends it back, so the bench says "Lantern still questions it")
    (B.grade(sq, tp.reply, { made: tm }).why === "Stop turns the motor on: it runs only while Stop is pressed" || /^Lantern still questions it: Stop turns the motor on/.test(B.grade(sq, tp.reply, { made: tm }).why)) &&
    B.grade(sq, tp.reply, { made: { ok: true, plan: tm.plan, action: tm.action, problems: [] } }).why === "Stop turns the motor on: it runs only while Stop is pressed", tm && [tm.problems, B.grade(sq, tp.reply, { made: tm })]);
  // a rule in Lantern that said so was written, tried by a second reviewer, and taken out: of its 193 right programs
  // it spoke about 27, and its swap made 17 less safe (an e-stop's safe state, a dump valve, a brake). So Lantern
  // says nothing about this program; the bench does. QUEUE: a Stop that turns the motor on needs a surer rule.
  ok("...Lantern itself says nothing about it (the rule that did was taken out after review 2)", !AC.startWins("arduino", tm.plan.text, sq.q).length);
  // the ladder: the first reply asked for a lesson, and the lessons came with the block's first line
  var lq = item("code-ladder-start-stop"), lseen = [];
  function seq2(list) { var i = 0; return function (msgs) { lseen.push(msgs); return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
  var lo = await act.solve(lq.q, seq2([tl.first, tl.reply]));
  var llast = lseen[1] ? lseen[1][lseen[1].length - 1] : null, ltxt = llast ? (typeof llast.content === "string" ? llast.content : llast.content.map(function (x) { return x.text || ""; }).join("\n")) : "";
  ok("the ladder: its LESSON request brought the lessons with the block\u2019s first line, and its next reply was the block, which passes",
    tl.first === "LESSON: motor start stop ladder" && /reply with ONLY the block, with no \[n\]/.test(ltxt) && !/QUOTE \[n\]/.test(ltxt) &&
    lo.made && lo.made.ok && B.grade(lq, lo.text, lo).pass === true, [ltxt.slice(-500), lo.made && lo.made.problems]);
  console.log(fails ? fails + " BENCH 1.24.11 35B FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.11 35B CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
