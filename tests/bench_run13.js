// bench_run13.js -- Lantern Bench run 13 (Qwen3.5-35B-A3B on 1.14.0, 113/118
// with the library), replayed with the model's real replies
// (tests/fixtures/bench_run13_replies.json):
//  - refrigerator: the next line typed "rotarigef" for Lantern's
//    "rotaregirfer" -- a quarter of the letters dropped, the rest in order --
//    which the retype test missed, so Lantern repaired the sentence to the
//    AI's own wrong chain. Now it is a retype: questioned, and run again
//    with Lantern's own result when the same reply comes back;
//  - robot walk: "NEED: What is the size of a square in meters?" -- the
//    question counts in squares; Lantern says so, and the puzzle goes back
//    to its TURN block;
//  - AccelStepper: a right sketch (moveSteps = 800L) failed the grader,
//    which looked for 800 with no L;
//  - Structured Text tank: no PROGRAM, and FillValve := LowFloat AND NOT
//    HighFloat closes the valve as soon as the level leaves the low float --
//    both questioned now, and the six lines of Lantern's instructions the AI
//    copied after END are left out of the reply;
//  - ladder: XIC(SealIn) as the seal-in, a tag no rung sets -- questioned,
//    and code written straight into a reply now goes back once, as a MAKE
//    block does, in Chat and on the bench.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
var script = null, calls = [];
function resp(status, body, type) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
  if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf" }] }), "application/json");
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
  var body = JSON.parse(opts.body);
  calls.push(body);
  var r = script ? script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run13_replies.json"), "utf8"));

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(80);
  var L = w.Lantern, C = L.CHAT, A = L.assist, Q = L.aiBenchQuestions, RC = L.aiResultChecks, act = L.aiAct, B = L.aiBench;
  await L.ai.detect();
  ok("boot clean", errs.length === 0, errs);
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }

  // --- refrigerator ---------------------------------------------------------------
  var lr = R["letters-refrigerator"], lp = A.parseReply(lr.reply), lrun = A.run(lp.exprText);
  ok("the run's lines: Lantern's REVERSE right, the next line typed rotarigef", lrun.steps[0].value === "rotaregirfer" && lrun.steps[1].value === "otaigef" && lrun.value === 7);
  ok("rotarigef is a retype of rotaregirfer (letters dropped, the rest in order)", RC.sameLetters("rotarigef", "rotaregirfer"));
  ok("...but the right REMOVE result, a different word, and short words are not", !RC.sameLetters("otaegife", "rotaregirfer") && !RC.sameLetters("world", "HELLO") &&
    !RC.sameLetters("refrigerator", "rotaregirfer") === false && !RC.sameLetters("rot", "rotaregirfer"));
  var lwhy = RC.check(lr.q, lp.exprText, lrun, { parsed: lp, text: lr.reply }) || "";
  ok("questioned: line 2 types rotarigef, but line 1 gave rotaregirfer", /line 2 types “rotarigef”, but line 1 gave “rotaregirfer”: write ANS1/.test(lwhy), lwhy);
  var rch = RC.rechain(lp.exprText, lrun.steps, lr.q);
  ok("rechain: REMOVE(ANS1,\x22r\x22)", rch && rch.expr === "=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS1,\x22r\x22)\n=LEN(ANS2)" && A.run(rch.expr).value === 8, rch);
  script = function () { return lr.reply; };   // questioned, and the same reply comes back
  var conv = await C.converse([lr.q], {}), t0 = conv.turns[0];
  var g = B.grade(item("letters-refrigerator"), t0.final, { turns: conv.turns });
  ok("in Chat: the same reply after the question -- Lantern runs its own results, and the bench passes it",
    g.pass && /“?rotaregirfer/.test(t0.answerText) && /otaegife/.test(t0.answerText) && /8 letters/.test(t0.answerText) && t0.value === 8, [g.why, t0.answerText, t0.value]);
  ok("...and says what it did", t0.rechained && t0.rechained.length >= 1 && (t0.notes || []).some(function (n) { return /ran its lines again with its own results in place: line 2: “rotarigef” → ANS1/.test(n); }), [t0.rechained, t0.notes]);

  // --- robot walk -----------------------------------------------------------------
  var rw = R["robot-walk"], NA = L.aiNeedAnswer;
  var na = NA(A.parseReply(rw.reply).need, rw.q);
  ok("the square-size NEED is one Lantern answers: the question counts in squares", /counts in squares, so a square is the unit: no size in metres is needed/.test(na || ""), na);
  ok("...but not when the question gives or wants metres, and a battery is still the person's to say",
    NA("What is the size of each square?", "A garden is 4 squares long and each is 3 m wide. What is its area in square metres?") === null &&
    NA("How many amp-hours does the battery hold?", "How many hours will my battery run a 60 W light?") === null &&
    /a dozen is 12/.test(NA("How many eggs are in 3 dozen?", "Eggs cost 12 shillings each. How much do 3 dozen eggs cost?")));
  var turnBlock = item("robot-walk").ideal, sent = [];
  script = function (last) { sent.push(last); return sent.length === 1 ? rw.reply : sent.length === 2 ? turnBlock : item("robot-walk").idealAnswer; };
  conv = await C.converse([rw.q], {}); t0 = conv.turns[0];
  g = B.grade(item("robot-walk"), t0.final, { turns: conv.turns });
  ok("in Chat: Lantern answers the NEED and asks for the puzzle tool block, the TURN block runs, and the bench passes it",
    sent.length >= 2 && /counts in squares/.test(sent[1]) && /puzzle tool block/.test(sent[1]) && g.pass, [g.why, sent.map(function (s) { return s.slice(0, 160); }), t0.final]);

  // --- AccelStepper: the grader -----------------------------------------------------
  var st = R["code-accelstepper"], mk = act.build(st.reply, st.q);
  ok("the run's sketch builds with no problems", mk && mk.ok, mk && mk.problems);
  g = B.grade(item("code-accelstepper"), st.reply, { made: mk });
  ok("...and the grader counts 800L as 800 steps", g.pass, g.why);
  var no800 = st.reply.replace("800L", "400L").replace("moves 800 steps", "moves 400 steps").replace("800 steps forward", "400 steps forward").replace("Stepper A4988 800 steps", "Stepper").replace("at 800", "at 400").replace("800 steps back", "400 steps back");
  g = B.grade(item("code-accelstepper"), no800, { made: act.build(no800, st.q) });
  ok("...and still fails a sketch with no 800 in its code", !g.pass && /not 800 steps/.test(g.why), g.why);

  // --- Structured Text tank ------------------------------------------------------------
  var tk = R["code-st-tank-fill"], tm = act.build(tk.reply, tk.q);
  ok("the run's ST block: no PROGRAM, and the valve not held between the floats -- both questioned", tm && !tm.ok &&
    tm.problems.some(function (p) { return /not inside PROGRAM <name> \.\.\. END_PROGRAM/.test(p); }) &&
    tm.problems.some(function (p) { return /FillValve := LowFloat AND NOT HighFloat is on only while LowFloat is on.*FillValve := \x28LowFloat OR FillValve\x29 AND NOT HighFloat/.test(p); }), tm && tm.problems);
  ok("the six lines of Lantern's instructions after END are left out of the reply", tm && !/Lantern checks it \x28brackets/.test(tm.replyText) && !/XIC is true while the input is on/.test(tm.replyText) &&
    /↓ Tank Fill Control/.test(tm.replyText), tm && tm.replyText);
  var good = "MAKE CODE: Tank Fill Control\nlanguage st\nPROGRAM TankFill\nVAR\n    LowFloat : BOOL;\n    HighFloat : BOOL;\n    FillValve : BOOL;\nEND_VAR\n" +
    "IF LowFloat THEN\n    FillValve := TRUE;\nEND_IF;\nIF HighFloat THEN\n    FillValve := FALSE;\nEND_IF;\nEND_PROGRAM\nEND";
  var seal = good.replace(/IF LowFloat[\s\S]*?END_IF;\nIF HighFloat[\s\S]*?END_IF;\n/, "FillValve := (LowFloat OR FillValve) AND NOT HighFloat;\n");
  ok("set-and-reset, and the valve in its own line, are held: no problems", act.build(good, tk.q).ok && act.build(seal, tk.q).ok, [act.build(good, tk.q).problems, act.build(seal, tk.q).problems]);
  ok("a question with no on-when/off-when is not held to a latch", act.build(tk.reply.replace(/^VAR/m, "PROGRAM P\nVAR").replace("FillValve := LowFloat AND NOT HighFloat;\n", "FillValve := LowFloat AND NOT HighFloat;\nEND_PROGRAM\n"),
    "Write a Structured Text PLC program where the valve is on while the low float is on and the high float is off.").ok);
  var n = 0, out = await act.solve(tk.q, function () { n++; return Promise.resolve(n === 1 ? tk.reply : good); });
  g = B.grade(item("code-st-tank-fill"), out.text, out);
  ok("bench: questioned once, the corrected block passes", out.rounds === 2 && out.fixed && g.pass && /not inside PROGRAM/.test(out.rejected), [g.why, out.rejected]);
  var chk = item("code-st-tank-fill").check, body = "PROGRAM T\nVAR\n LowFloat : BOOL;\n HighFloat : BOOL;\n FillValve : BOOL;\nEND_VAR\n";
  ok("grader: set-and-reset and the seal-in form pass; the run's logic in a PROGRAM is not held open", chk({ lang: "st", text: act.build(good, tk.q).plan.text }) === "" &&
    chk({ lang: "st", text: act.build(seal, tk.q).plan.text }) === "" && chk({ lang: "st", text: body + "FillValve := LowFloat AND NOT HighFloat;\nEND_PROGRAM\n" }) === "the valve is not held open between the two floats",
    chk({ lang: "st", text: body + "FillValve := LowFloat AND NOT HighFloat;\nEND_PROGRAM\n" }));

  // --- ladder: XIC(SealIn) ------------------------------------------------------------
  var lad = R["code-ladder-start-stop"], fr = act.fromReply(lad.reply, lad.q);
  ok("the run's rung in plain text: questioned -- SealIn is a tag no rung sets; the seal-in is XIC(Motor)", fr && fr.block.inReply && !fr.ok &&
    /XIC\x28SealIn\x29 examines a tag no rung sets, and the seal-in contact is the coil’s own, so write XIC\x28Motor\x29/.test(fr.problems.join(" ")), fr && fr.problems);
  ok("the right rung, and a rung with OTL, are left alone", act.fromReply("[XIC(Start) ,XIC(Motor) ]XIC(Stop)XIC(Overload)OTE(Motor);", lad.q).ok &&
    L.aiCode.sealProblems("ladder", "XIC(Start)OTL(Motor);\nXIO(Stop)OTU(Motor);", lad.q).length === 0);
  ok("no seal-in asked for, none required", L.aiCode.sealProblems("ladder", "XIC(Start)XIC(Stop)OTE(Lamp);", "Write ladder logic that lights a lamp while Start is held.").length === 0);
  var fixedRung = "MAKE CODE: Motor start/stop\nlanguage ladder\n[XIC(Start) ,XIC(Motor) ]XIC(Stop)XIC(Overload)OTE(Motor);\nEND";
  n = 0; out = await act.solve(lad.q, function () { n++; return Promise.resolve(n === 1 ? lad.reply : fixedRung); });
  g = B.grade(item("code-ladder-start-stop"), out.text, out);
  ok("bench: code in the reply goes back once, the MAKE CODE block that comes back passes", out.rounds === 2 && out.fixed && g.pass && /SealIn/.test(out.rejected), [g.why, out.rounds, out.rejected]);
  var asked = [];
  script = function (last) { asked.push(last); return asked.length === 1 ? lad.reply : fixedRung; };
  conv = await C.converse([lad.q], {}); t0 = conv.turns[0];
  ok("Chat: the same -- back once with what Lantern found, and the corrected block is made", asked.length === 2 && /Lantern checked the code in your reply: .*XIC\x28SealIn\x29/.test(asked[1]) &&
    /as a MAKE CODE block/.test(asked[1]) && t0.made && t0.made.ok && t0.made.plan.lang === "ladder", [asked.map(function (s) { return s.slice(0, 200); }), t0.made && t0.made.problems]);
  asked = [];
  script = function (last) { asked.push(last); return "```cpp\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n}\n```\nThat sets pin 13 as an output."; };
  conv = await C.converse(["How does pinMode work on an Arduino?"], {});
  ok("a question that does not ask for a program is not sent back for its code", asked.length === 1, asked.length);

  // --- the new place questions, as the run answered them ----------------------------------
  ["place-distance", "place-bearing"].forEach(function (id) {
    var x = R[id], p = A.parseReply(x.reply);
    g = B.grade(item(id), x.reply, { run: A.run(p.exprText), parsed: p });
    ok(id + ": the run's reply still passes", g.pass, g.why);
  });

  ok("no page errors along the way", errs.length === 0, errs);
  console.log(fails ? "BENCH RUN 13 FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL BENCH RUN 13 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
