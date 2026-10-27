// bench_run12.js -- Lantern Bench run 12 (Qwen3.5-35B-A3B on 1.13.3, 113/116
// with the library), replayed with the model's real replies
// (tests/fixtures/bench_run12_replies.json):
//  - refrigerator: Lantern's =REVERSE gave "rotaregirfer", but the next line
//    typed "rortegifer" (two letters dropped) instead of ANS1, the third line
//    copied that line's result, and the sentence put {ANS2} -- a word -- where
//    the count goes. Now the retyped word is questioned; when the correction
//    still types results out, Lantern runs the lines again with its own
//    results in place, puts them in the sentence, and says what it changed;
//  - ladder: one correct rung, written as plain text with no MAKE block --
//    Chat now checks rungs written that way, and the bench grades code in a
//    reply the way Chat checks it;
//  - two lamps drawn as resistors labelled "Lamp 1" and "Lamp 2" go back once;
//  - the bench panel's "Show" rebuilds what was made from the saved reply.
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
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run12_replies.json"), "utf8"));

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
  ok("the run's lines: Lantern's REVERSE was right, the next line typed its own word", lrun.steps[0].value === "rotaregirfer" && lrun.steps[1].value === "otegife");
  var lwhy = RC.check(lr.q, lp.exprText, lrun, { parsed: lp, text: lr.reply }) || "";
  ok("questioned: line 2 retypes line 1 with letters dropped, and {ANS2} (a word) stands where the count goes",
    /line 2 types \u201crortegifer\u201d, but line 1 gave \u201crotaregirfer\u201d: write ANS1/.test(lwhy) && /puts \x7BANS2\x7D \(\u201cotegife\u201d, a word\) before \u201cletters\u201d: the count is line 3\u2019s, so put \x7BANS3\x7D there/.test(lwhy), lwhy);
  ok("mostly the same letters counts as a retype; different words do not", RC.sameLetters("rortegifer", "rotaregirfer") && !RC.sameLetters("world", "HELLO") &&
    !RC.sameLetters("otaegife", "rotaregirfer") && !RC.sameLetters("stone", "notes") === false);
  var rch = RC.rechain(lp.exprText, lrun.steps, lr.q);
  ok("rechain: the typed words become ANS1 and ANS2", rch && rch.expr === "=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS1,\x22r\x22)\n=LEN(ANS2)" && A.run(rch.expr).value === 8, rch);
  ok("nothing to rechain when the lines use ANS, or only copy a result word for word", RC.rechain("=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS1,\x22r\x22)\n=LEN(ANS2)",
    A.run("=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS1,\x22r\x22)\n=LEN(ANS2)").steps, lr.q) === null &&
    RC.rechain("=REVERSE(\x22refrigerator\x22)\n=REMOVE(\x22rotaregirfer\x22,\x22r\x22)", A.run("=REVERSE(\x22refrigerator\x22)\n=REMOVE(\x22rotaregirfer\x22,\x22r\x22)").steps, lr.q) === null);
  script = function () { return lr.reply; };   // questioned, and the same reply comes back
  var conv = await C.converse([lr.q], {}), t0 = conv.turns[0];
  var g = L.aiBench.grade(item("letters-refrigerator"), t0.final, { turns: conv.turns });
  ok("letters in Chat: the same reply after the question -- Lantern runs its own results, puts them in, and the bench passes it",
    g.pass && t0.answerText === "The word spelled backwards is \x22rotaregirfer\x22, removing every 'r' leaves \x22otaegife\x22, which has 8 letters." && t0.value === 8,
    [g.why, t0.answerText, t0.value]);
  ok("...and says what it did, under the answer", t0.rechained && t0.rechained.length === 2 && t0.repaired && t0.repaired.length === 3 && !t0.stillDoubt &&
    (t0.notes || []).some(function (n) { return /ran its lines again with its own results in place: line 2: \u201crortegifer\u201d \u2192 ANS1/.test(n); }) &&
    (t0.notes || []).some(function (n) { return /\u201c\x7BANS2\x7D\u201d \u2192 \u201c\x7BANS3\x7D\u201d/.test(n); }), [t0.rechained, t0.repaired, t0.notes]);
  ok("a right answer is left alone", RC.check(lr.q, "=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS1,\x22r\x22)\n=LEN(ANS2)",
    A.run("=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS1,\x22r\x22)\n=LEN(ANS2)"), { parsed: { answer: "Backwards it is {ANS1}; without the r's, {ANS2}, which has {ANS3} letters." } }) === null);

  // --- ladder in plain text ---------------------------------------------------------------
  var lad = R["code-ladder-start-stop"];
  ok("the run's rung, written with no MAKE block and no fence, is found as ladder", L.chatCode.blocks(lad.reply).length === 1 && L.chatCode.blocks(lad.reply)[0].lang === "ladder");
  var fr = act.fromReply(lad.reply, lad.q);
  ok("...built and checked like a MAKE CODE block: no problems", fr && fr.block.inReply && fr.plan.lang === "ladder" && fr.ok, fr && fr.problems);
  var out = await act.solve(lad.q, function () { return Promise.resolve(lad.reply); });
  g = L.aiBench.grade(item("code-ladder-start-stop"), out.text, out);
  ok("the bench grades it as Chat checks it: pass", out.inReply && g.pass && out.rounds === 1, [g.why, out.inReply]);
  ok("a reply that only mentions XIC in a sentence has no rung", L.chatCode.blocks("Use XIC(Stop) for a normally closed button.").length === 0 &&
    act.fromReply("Use XIC(Stop) for a normally closed button.", lad.q) === null);
  ok("code in a reply counts only when a program was asked for", act.fromReply(lad.reply, "What is a seal-in circuit?") === null);
  var xio = "[XIC(Start) ,XIC(Motor) ]XIO(Stop)OTE(Motor);";
  ok("a plain rung with XIO on the normally closed Stop is questioned the same way", !act.fromReply(xio, lad.q).ok && /use XIC\x28Stop\x29/.test(act.fromReply(xio, lad.q).problems.join(" ")));

  // --- two lamps drawn as resistors ---------------------------------------------------------
  var pl = R["make-parallel-lamps"], m = act.build(pl.reply, pl.q);
  ok("lamps drawn as resistors labelled Lamp 1 and Lamp 2 go back", !m.ok && m.problems.filter(function (p) { return /is drawn as a resistor but labelled \u201cLamp \d\u201d: a lamp is a part of its own/.test(p); }).length === 2, m.problems);
  var fixedLamps = pl.reply.replace("part R1 resistor", "part R1 lamp").replace("part R2 resistor", "part R2 lamp");
  var calls = 0;
  out = await act.solve(pl.q, function () { calls++; return Promise.resolve(calls === 1 ? pl.reply : fixedLamps); });
  g = L.aiBench.grade(item("make-parallel-lamps"), out.text, out);
  ok("questioned once, corrected to lamp parts, the bench passes it", out.rounds === 2 && out.fixed && g.pass, [g.why, out.rejected]);
  ok("labels that name the part's own kind, or a battery on a source, are left alone",
    act.build("MAKE SCHEMATIC: LED\nmode electrical\npart V1 source \x22Battery 9 V\x22\npart R1 resistor \x22LED resistor 330 ohm\x22\npart D1 diode \x22LED\x22\nwire V1 R1\nwire R1 D1\nwire D1 V1\nEND", "Draw an LED circuit with a 9 V battery and a resistor").ok &&
    act.build(R["make-lamp-circuit"].reply, R["make-lamp-circuit"].q).ok);

  // --- the bench panel's Show: what was made, rebuilt from the saved reply ---------------------
  var det = L.aiBenchDetail(R["row-make-parallel-lamps"]);
  ok("Show on the lamps row: why it failed, the circuit Lantern drew, and the reply", /Why it failed: not two lamps/.test(det.textContent) &&
    det.querySelector(".la-make") && /Lantern made/.test(det.textContent) && /part R1 resistor/.test(det.textContent), det.textContent.slice(0, 300));
  det = L.aiBenchDetail(R["row-code-ladder-start-stop"]);
  ok("Show on the ladder row: the rung, as a program Lantern checked", det.querySelector(".la-make") && /Ladder/.test(det.textContent) && /XIC\x28Overload\x29OTE\x28Motor\x29/.test(det.textContent), det.textContent.slice(0, 300));

  ok("no page errors along the way", errs.length === 0, errs);
  console.log(fails ? "BENCH RUN 12 FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL BENCH RUN 12 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
