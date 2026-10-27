// bench_run11.js -- Lantern Bench run 11 (Qwen3.5-35B-A3B on 1.13.2, 87/94,
// no library that run), replayed with the model's real replies
// (tests/fixtures/bench_run11_replies.json):
//  - refrigerator: the ANSWER typed "otageifer" and 7 for otaegife and 8, was
//    questioned for the count only, and sent the same sentence back. A swap of
//    two letters now counts as one slip, so the spelling is questioned too;
//    and when the corrected answer still types Lantern's results its own way,
//    Lantern puts its results in and says so;
//  - two-coin cups: "the cup two places to its left" written as "left of
//    holder of gold" (one place) goes back once;
//  - hens: LESSON: HEN HEALTH read the Health tile's guide on people; the
//    person's question now counts too, so Chickens & eggs comes first;
//  - programs: "EXAMPLE: <title>" with the code under it -- the way Lantern
//    showed its tested example -- is a MAKE CODE block; the example is now
//    shown so it cannot be taken for a reply; the bench's MAKE path runs
//    Chat's commands (EXAMPLE:) the way Chat does; XIO(Stop) for a normally
//    closed Stop goes back, and Lantern's own prompt line now says XIC;
//  - fuel for a trip worked out the wrong way round (=150*10/420) goes back
//    with the sum.
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
var vision = false, script = null, calls = [];
function resp(status, body, type) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf" }] }), "application/json");
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: vision } }), "application/json");
  var body = JSON.parse(opts.body);
  calls.push(body);
  var r = script ? script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run11_replies.json"), "utf8"));

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(80);
  var L = w.Lantern, C = L.CHAT, A = L.assist, Q = L.aiBenchQuestions, RC = L.aiResultChecks, act = L.aiAct;
  await L.ai.detect();
  ok("boot clean", errs.length === 0, errs);
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }

  // --- refrigerator ---------------------------------------------------------------
  var lr = R["letters-refrigerator"], lp = A.parseReply(lr.reply), lrun = A.run(lp.exprText);
  var lwhy = RC.check(lr.q, lp.exprText, lrun, { parsed: lp, text: lr.reply }) || "";
  ok("letters: the run's sentence is questioned for its spelling (a swap and an extra r) and its count",
    /spells “otageifer”, but Lantern worked out “otaegife”/.test(lwhy) && /says 7/.test(lwhy), lwhy);
  ok("two letters swapped count as one slip; different words still are not close", RC.close("otageifer", "otaegife") && RC.close("form", "from") &&
    !RC.close("otaegife", "rotaregirfer") && !RC.close("apple", "orange") && !RC.close("battery", "voltage"));
  var rp = RC.repair(lp.answer, lrun.steps, lr.q, lp.exprText);
  ok("repair: Lantern's results go into the sentence", rp && rp.text === "The word spelled backwards is \x22rotaregirfer\x22, removing every 'r' leaves \x22otaegife\x22, which has 8 letters." &&
    rp.changes.length === 2, rp);
  ok("repair leaves alone what it cannot be sure of", RC.repair("It is 7 or 9 letters.", lrun.steps, lr.q, lp.exprText) === null &&
    RC.repair("Backwards it is {ANS1}.", lrun.steps, lr.q, lp.exprText) === null && RC.repair("The answer is otaegife, 8 letters.", lrun.steps, lr.q, lp.exprText) === null);
  script = function () { return lr.reply; };   // questioned, and the same sentence comes back (as in the run)
  var conv = await C.converse([lr.q], {}), t0 = conv.turns[0];
  var g = L.aiBench.grade(item("letters-refrigerator"), t0.final, { turns: conv.turns });
  ok("letters in Chat: the same sentence back after the question -- Lantern's results put in, said, and the bench passes it",
    g.pass && /otaegife/.test(t0.answerText) && /8 letters/.test(t0.answerText) && t0.repaired && t0.repaired.length === 2 && !t0.stillDoubt, [g.why, t0.answerText, t0.repaired, t0.stillDoubt]);
  ok("...and the note under the answer says what it changed", (t0.notes || []).some(function (n) { return /Lantern put its own results into the AI’s sentence/.test(n) && /“otageifer” → “otaegife”, “7” → “8”/.test(n); }), t0.notes);

  // --- cups: two places --------------------------------------------------------------
  var cu = R["cups-two-coins"], PZC = L.aiPuzzleCheck, PZ = L.aiPuzzle;
  var block11 = "TRACK: Cups\n" + cu.block.join("\n") + "\nEND";
  var fixed11 = block11.replace("swap holder of gold and left of holder of gold", "swap holder of gold and 2 left of holder of gold");
  var dw = PZC.distances({ lines: cu.block }, cu.q);
  ok("cups: “two places to its left” written as one place is questioned", dw.length === 1 && /two places to its left/.test(dw[0]) && /2 left of/.test(dw[0]), dw);
  ok("the block with the 2 passes, with the right order", PZ.run(fixed11, cu.q).ok && PZ.run(fixed11, cu.q).row.join(",") === "Yellow,Green,Blue,Red,White", PZ.run(fixed11, cu.q).problems);
  ok("a step that moves one place needs no number; “shift right 2” counts", !PZC.distances({ lines: ["row A B C", "swap A and left of B"] }, "1. A swaps with the cup directly to its left.").length &&
    !PZC.distances({ lines: ["row A B C", "shift right 2"] }, "1. Every cup moves two places to the right.").length);
  script = function (last) {
    if (/^PUZZLE RESULTS/.test(last)) return "ANSWER: The final order is Yellow, Green, Blue, Red, White; gold is under Green and silver under Blue.";
    if (/Lantern ran your TRACK block/.test(last)) return fixed11;
    return block11;
  };
  conv = await C.converse([cu.q], {}); t0 = conv.turns[0];
  g = L.aiBench.grade(item("cups-two-coins"), t0.final, { turns: conv.turns });
  ok("cups in Chat: questioned once, corrected, the bench passes it", t0.puzzles.length === 2 && !t0.puzzles[0].ok && t0.puzzles[1].ok && g.pass, [g.why, t0.puzzles]);

  // --- hens: the lesson the question is about ---------------------------------------------
  var hens = R["suite-asks-for-lesson"], S = L.suite;
  var ps = S.passages(hens.q, "HEN HEALTH", { detail: true, max: 3 });
  ok("LESSON: HEN HEALTH for “My hens have stopped laying eggs” reads Chickens & eggs first", ps.length && /^Chickens & eggs/.test(ps[0].title), ps.map(function (p) { return p.title; }));
  ok("the AI's own words still lead when they match: LESSON: Goats & milk, and the Health guide for a health question",
    /^Goats & milk/.test(S.passages("How much should a goat eat?", "Goats & milk")[0].title) &&
    /Health/.test(S.passages("How do I clean a wound?", "first aid wound")[0].title), [S.passages("How do I clean a wound?", "first aid wound").map(function (p) { return p.title; })]);
  var line1 = ps[0].text.split("\n").filter(function (l) { return /[.]$/.test(l) && l.length > 30; })[0];
  var sent1 = line1.split(/(?<=[.])\s/)[0];
  script = function (last) { return /LESSON|passage|\x5B1\x5D/.test(last) && /Chickens/.test(last) ? sent1 + " [1]" : "LESSON: HEN HEALTH"; };
  conv = await C.converse([hens.q], {}); t0 = conv.turns[0];
  g = L.aiBench.grade(item("suite-asks-for-lesson"), t0.final, { turns: conv.turns });
  ok("hens in Chat: the run's LESSON: HEN HEALTH, then a sentence from Chickens & eggs -- the bench passes it", g.pass, [g.why, t0.final, t0.searches]);

  // --- programs -------------------------------------------------------------------------
  var p1 = R["code-p1am-seal-in"], st = R["code-accelstepper"], lad = R["code-ladder-start-stop"];
  var m1 = act.build(p1.reply, p1.q), m2 = act.build(st.reply, st.q), m3 = act.build(lad.reply, lad.q);
  ok("“EXAMPLE: <title>” with the code under it is a MAKE CODE block (P1AM, stepper, ladder)",
    m1 && m1.block.viaExample && m1.plan.lang === "arduino" && m2 && m2.plan.lang === "arduino" && m3 && m3.plan.lang === "ladder",
    [m1 && m1.problems, m2 && m2.problems, m3 && m3.problems]);
  ok("...titled from the example's name, without the language and description", m1.block.title === "P1AM-100: start/stop with seal-in on discrete I/O modules" && m3.block.title === "Motor start/stop with seal-in", [m1.block.title, m3.block.title]);
  function grade(id, text, made) { return L.aiBench.grade(item(id), text, { made: made }); }
  ok("the P1AM sketch and the stepper sketch now pass the bench", grade("code-p1am-seal-in", p1.reply, m1).pass && grade("code-accelstepper", st.reply, m2).pass,
    [grade("code-p1am-seal-in", p1.reply, m1).why, grade("code-accelstepper", st.reply, m2).why]);
  ok("ladder: XIO(Stop) for the normally closed Stop goes back", !m3.ok && /XIO\x28Stop\x29 examines the stop the question calls normally closed/.test(m3.problems.join(" ")) && /use XIC\x28Stop\x29/.test(m3.problems.join(" ")), m3.problems);
  ok("...not when the question does not say normally closed, nor for XIC(Stop)", act.build(lad.reply, "Write ladder logic for a motor start/stop with a Stop pushbutton.").ok &&
    act.build("MAKE CODE: Starter\nlanguage ladder\n[XIC(Start) ,XIC(Motor) ]XIC(Stop)XIC(OL)OTE(Motor);\nEND", lad.q).ok);
  ok("EXAMPLE: on its own (no code under it) is still Chat's command, not a block", act.find("EXAMPLE: stepper accelstepper").length === 0 &&
    act.find("Let me look.\nEXAMPLE: p1am start stop").length === 0);
  var CF = L.aiCodeExamples, pl = CF.promptLines("Write an Arduino sketch for a stepper motor on an A4988 driver with AccelStepper and smooth acceleration").join("\n");
  ok("the tested example is shown between <<< and >>>, with no EXAMPLE n: or language line to copy", /<<</.test(pl) && />>>/.test(pl) && !/^EXAMPLE \d+:/m.test(pl) && !/^language /m.test(pl), pl.slice(0, 400));
  ok("Lantern's own ladder line examines a normally closed Stop with XIC", /\x5BXIC\x28Start\x29 ,XIC\x28Motor\x29 \x5DXIC\x28Stop\x29OTE\x28Motor\x29;/.test(act.prompt(lad.q)) && !/XIO\x28Stop\x29OTE/.test(act.prompt(lad.q)));
  // the bench's MAKE path: the run's ladder reply, questioned, then corrected
  var calls2 = 0;
  var out = await act.solve(lad.q, function () { calls2++; return Promise.resolve(calls2 === 1 ? lad.reply : "MAKE CODE: Motor start/stop\nlanguage ladder\n[XIC(Start) ,XIC(Motor) ]XIC(Stop)XIO(Overload)OTE(Motor);\nEND"); });
  ok("ladder through the bench's MAKE path: questioned once, corrected, passes", out.rounds === 2 && L.aiBench.grade(item("code-ladder-start-stop"), out.text, out).pass, [out.rejected, out.made && out.made.problems]);
  // ...and EXAMPLE: alone runs the command, as in Chat
  var sentEx = [];
  out = await act.solve(st.q, function (m) { sentEx.push(textOf(m[m.length - 1].content)); return Promise.resolve(sentEx.length === 1 ? "EXAMPLE: stepper accelstepper" : item("code-accelstepper").ideal); });
  ok("bench MAKE path: EXAMPLE: alone gets Lantern's tested examples, then the MAKE CODE block is graded", out.commands && /^EXAMPLE: stepper/.test(out.commands[0]) &&
    /LANTERN’S TESTED EXAMPLES/.test(sentEx[1]) && L.aiBench.grade(item("code-accelstepper"), out.text, out).pass, [out.commands, sentEx[1] && sentEx[1].slice(0, 200)]);

  // --- fuel for a trip ----------------------------------------------------------------
  var cf = R["car-fuel"], PR = L.aiProportion, cp = A.parseReply(cf.reply);
  var fwhy = PR.check(cf.q, cp.exprText, A.run(cp.exprText)) || "";
  ok("fuel: =150*10/420 is questioned with the sum (28 litres)", /420 km needs 420 × 10 ÷ 150 = 28 litres, but the lines give 3\.5714/.test(fwhy), fwhy);
  ok("...the right line is not", PR.check(cf.q, "=420*10/150", A.run("=420*10/150")) === null);
  ok("other ways of asking: per 100 km, how far, miles and gallons",
    PR.parse("My car uses 8 litres per 100 km. How many litres for a 250 km drive?").expected === 20 &&
    PR.parse("A van does 150 km on 10 litres. How far can it go on 25 litres?").expected === 375 &&
    PR.parse("A truck goes 300 miles on 20 gallons. How many gallons for 450 miles?").expected === 30);
  ok("left alone: one distance, mixed units, or nothing asked about fuel or distance",
    PR.parse("A tank holds 1000 litres and the pipe is 2 km long. How many litres flow per minute?") === null &&
    PR.parse("A car goes 100 miles on 10 litres. How many litres for 50 km?") === null &&
    PR.parse("A car goes 150 km on 10 litres. What does the trip cost at 2 dollars a litre for 420 km?") === null);
  var fseen = [];
  var res = await A.solve(cf.q, { call: function (m) { fseen.push(textOf(m[m.length - 1].content)); return Promise.resolve(fseen.length === 1 ? cf.reply : "=420*10/150\nANSWER: The trip needs {result} litres."); } });
  g = L.aiBench.grade(item("car-fuel"), res.text, res);
  ok("car-fuel in Assist (the bench's path): questioned once with the sum, then 28 -- the bench passes it", g.pass && res.kind === "questioned" && /28 litres/.test(fseen[1] || ""), [g.why, res.rejected]);

  ok("no page errors along the way", errs.length === 0, errs);
  console.log(fails ? "BENCH RUN 11 FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL BENCH RUN 11 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
