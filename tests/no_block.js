// no_block.js -- a thing was asked for, Lantern can make it, and the reply
// has no block (AI_NO_BLOCK, 1.24.5).
// Seen on the 35B's full run on 1.24.4 (tests/fixtures/bench_run_1244_35b.json):
// "Draw a pneumatic circuit ..." got 700 tokens of thinking aloud and no block,
// and nothing went back. Now the block is asked for once, with its first line:
//  - the line is the one the instructions for that question give (MAKE
//    PNEUMATIC for air, MAKE CODE for a sketch that names an LED, MAKE WHEEL
//    for "draw the power wheel"), for every MAKE question of the bench and
//    for none of the others;
//  - a question that only opens like a request, a reply that is something
//    else Lantern acts on, a short question back, a program written into the
//    reply, and a reply after the block was made are all left alone;
//  - the bench's path (aiAct.solve) and Chat both ask once, and only once;
//  - without the module nothing is asked (rule 11).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var RUN = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_35b.json"), "utf8"));
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
function load(strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, o = { w: w, d: w.document, errs: errs, script: null };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url, opts) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-Q4_K_M.gguf" }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    var body = JSON.parse(opts.body);
    var r = o.script ? o.script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
    return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
  };
  w.eval(js);
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list, seen) { var i = 0; return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return { role: m.role, content: textOf(m.content) }; })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }

(async function () {
  var o = load(), L = o.L;
  await sleep(80);
  await L.ai.detect();
  var NBK = L.aiNoBlock, Q = L.aiBenchQuestions, act = L.aiAct, B = L.aiBench, C = L.CHAT;
  ok("boot clean, and the hook is there", o.errs.length === 0 && typeof NBK === "function" && (L.chatNoBlock || []).length >= 1, o.errs);
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }
  var PROSE = "To do this we need a valve and a cylinder. Let us think about which valve fits best, and why.";

  // --- the first line, for every question that asks for a thing ---------------------------------
  var makes = Q.filter(function (q) { return q.cat === "make"; }), wrong = [];
  makes.forEach(function (q) {
    var nb = NBK(q.q, PROSE), want = (/^MAKE\s+([A-Z]+)/.exec(q.ideal || "") || [])[1];
    if (!nb || nb.kinds.length !== 1 || nb.kind !== want || nb.prompt.indexOf("Its first line is:\nMAKE " + want + ": <a short title>\nthen its lines, then END.") < 0) wrong.push([q.id, want, nb && nb.kinds]);
  });
  ok("every MAKE question of the bench (" + makes.length + "): one first line, the one its model answer starts with", makes.length >= 28 && wrong.length === 0, wrong);
  var others = Q.filter(function (q) { return q.cat !== "make" && NBK(q.q || (q.turns && q.turns[0]) || "", PROSE); }).map(function (q) { return q.id; });
  ok("no other question of the bench is asked for a block", others.length === 0, others);
  function kind(q) { var nb = NBK(q, PROSE); return nb ? nb.kinds.join("+") : "-"; }
  ok("air is MAKE PNEUMATIC and oil MAKE HYDRAULIC, as the instructions for those questions say (the tool’s kind is SCHEMATIC)",
    kind(item("make-pneumatic").q) === "PNEUMATIC" && kind("Please draw a hydraulic circuit with a pump, a valve and a cylinder") === "HYDRAULIC" &&
    kind("Can you draw a circuit with two lamps in parallel?") === "SCHEMATIC");
  ok("the thing named first after the verb: a sketch that names an LED is a program, a slide deck about ladders is slides",
    kind("Write an Arduino sketch that blinks the LED on pin 13 every half second without using delay().") === "CODE" &&
    kind("Make a short slide deck, 4 to 6 slides, for a toolbox talk on ladder safety.") === "SLIDES" &&
    kind("Write a Python script that reads a CSV file called readings.csv and prints the average of its temp column.") === "CODE" &&
    kind("Draw a circuit with an LED and write the Arduino code for it") === "SCHEMATIC");
  ok("a tool that fits only by the verb gives way to the one the words name: draw the power wheel",
    kind("Draw the Ohm’s law power wheel for a lesson: P, V, I and R, each with its three formulas.") === "WHEEL" && kind("Draw a house with a red roof") === "DRAWING");
  ok("after a verb that moves a thing somewhere, the place named last: on flash cards, into slides, in my planner",
    kind("Put the times tables on flash cards") === "CARDS" && kind("Turn this list into slides for a talk") === "SLIDES" &&
    kind(item("make-plan-compressor").q) === "PLAN");
  ok("asked politely, or after a word of the chat", kind("Ok, now make a pie chart of where the day goes") === "WHEEL" && kind("Would you draft a report on the pump?") === "DOC" &&
    kind("I need a schedule for greasing the bearings every month") === "PLAN");

  // --- left alone --------------------------------------------------------------------------------
  ok("a question that only opens like a request is not one", ["Make sure I understand: what is a relay circuit?", "Show me how a transistor circuit works",
    "Give me an example of a flashcard", "What is a pneumatic cylinder?", "Write down why the sky is blue", "Add up 3 and 4", "Convert 5 km to miles", "Make it louder"]
    .every(function (q) { return NBK(q, PROSE) === null; }));
  var QP = item("make-pneumatic").q;
  ok("a reply that is something else Lantern acts on: a block, a formula, a NEED, a command",
    NBK(QP, item("make-pneumatic").ideal) === null && NBK(QP, "Here it is.\nMAKE PNEUMATIC: Push\ncylinder C1 double\nEND") === null &&
    NBK("Make a table of 3 loads", "=3*4\nANSWER: {result}") === null && NBK(QP, "NEED: the supply pressure") === null && NBK(QP, "LESSON: pneumatic valves") === null);
  ok("a short question back is the AI asking, not explaining", NBK(QP, "Which do you want the push button to work: the valve directly, or a pilot signal?") === null &&
    NBK(QP, PROSE + " " + new Array(40).join("More thinking aloud. ") + "Is that right?") !== null);
  var QC = "Write an Arduino AccelStepper example for a TMC2209 driver";
  ok("a program written straight into the reply, fenced or not, is there to read",
    NBK(QC, "From my own knowledge: wire STEP to pin 3, then\n#include <AccelStepper.h>\nAccelStepper stepper(AccelStepper::DRIVER, 3, 2);\nvoid setup() { stepper.setMaxSpeed(1000); }\nvoid loop() { stepper.run(); }") === null &&
    NBK(QC, "Here:\n```cpp\nvoid loop() {}\n```") === null && NBK(QC, "You would use the AccelStepper library and call run() in the loop.") !== null);
  ok("a reply after the block was made (the AI’s word on the picture) is not asked for another",
    NBK("Draw a yellow sun over a blue sea", "LOOKS RIGHT. A yellow sun sits above a blue band of sea.", { msgs: [
      { role: "user", content: "Draw a yellow sun over a blue sea" }, { role: "assistant", content: "MAKE DRAWING: Sun\ncircle 10 4 2 fill yellow\nEND" },
      { role: "user", content: [{ type: "text", text: "This is the picture Lantern drew for “Draw a yellow sun over a blue sea”. Does it look right?" }] },
      { role: "assistant", content: "LOOKS RIGHT. A yellow sun sits above a blue band of sea." }] }) === null &&
    NBK("Draw a yellow sun over a blue sea", "A sun is a circle and the sea a band.", { msgs: [
      { role: "user", content: "Draw a house" }, { role: "assistant", content: "MAKE DRAWING: House\nrect 4 6 8 6\nEND" },
      { role: "user", content: "Draw a yellow sun over a blue sea" }, { role: "assistant", content: "A sun is a circle and the sea a band." }] }) !== null);

  // --- the bench's path: the 35B's reply on 1.24.4, replayed -------------------------------------------
  var row = RUN.rows.filter(function (r) { return r.id === "make-pneumatic"; })[0], it = item("make-pneumatic"), seen = [];
  ok("the fixture: the 35B thought aloud for 700 tokens and wrote no block", row && row.why === "no MAKE block" && row.tokens === 700 && !/^\s*MAKE /m.test(row.reply) && /Let\x27s re-read/.test(row.reply));
  var out = await act.solve(it.q, seq([row.reply, it.ideal], seen));
  var g = B.grade(it, out.text, out);
  var back = seen[1] || [];
  ok("the block is asked for once, with MAKE PNEUMATIC as its first line, and the block that comes back passes", out.rounds === 2 && out.kind === "no block" && out.fixed === true && g.pass &&
    back.length === 4 && /^Lantern found no MAKE block in your reply, so nothing was made\. Do not explain and do not think aloud\./.test(back[3].content) &&
    /Its first line is:\nMAKE PNEUMATIC: <a short title>\nthen its lines, then END\.$/.test(back[3].content), [out.rounds, out.kind, out.fixed, g.why, back.length && back[3].content]);
  ok("...the reply that rambled goes back cut short, not whole", back.length === 4 && back[2].role === "assistant" && back[2].content.length <= 502 && row.reply.indexOf(back[2].content.slice(0, 480)) === 0, back[2] && back[2].content.length);
  seen = [];
  out = await act.solve(it.q, seq([row.reply, "I think the 5/2 valve with a roller is best. Shall I go on?"], seen));
  g = B.grade(it, out.text, out);
  ok("...asked once only: a second reply with no block is the answer, and fails as before", out.rounds === 2 && seen.length === 2 && !g.pass && /no MAKE block/.test(g.why), [out.rounds, seen.length, g.why]);
  seen = [];
  out = await act.solve(it.q, seq([it.ideal], seen));
  ok("a block the first time: nothing is asked", out.rounds === 1 && seen.length === 1 && B.grade(it, out.text, out).pass && out.kind !== "no block", [out.rounds, out.kind]);
  seen = [];
  var cq = item("code-blink-millis");
  out = await act.solve(cq.q, seq([cq.ideal.replace(/^MAKE CODE:[^\n]*\n(?:language[^\n]*\n)?/, "```cpp\n").replace(/\nEND\s*$/, "\n```")], seen));
  ok("a sketch written fenced into the reply is graded as it was, not asked for again", seen.length === 1 && out.kind !== "no block", [seen.length, out.kind, out.text.slice(0, 80)]);

  // --- Chat ------------------------------------------------------------------------------------------
  var sent = [];
  o.script = function (last) { sent.push(last); return sent.length === 1 ? row.reply : it.ideal; };
  var r = await C.turn([], it.q, {}, {});
  ok("Chat: the block is asked for, the note says so, and the circuit is made", sent.length === 2 && /^Lantern found no MAKE block in your reply/.test(sent[1]) && /MAKE PNEUMATIC: <a short title>/.test(sent[1]) &&
    r.notes.some(function (n) { return /The AI explained instead of writing a MAKE PNEUMATIC block; Lantern asked for the block itself/.test(n); }) && /^MAKE PNEUMATIC/m.test(r.final), [sent.length, r.notes, String(r.final).slice(0, 80)]);
  sent = [];
  o.script = function (last) { sent.push(last); return PROSE; };
  r = await C.turn([], it.q, {}, {});
  ok("Chat: asked once a question, not again and again", sent.filter(function (x) { return /^Lantern found no MAKE block/.test(x); }).length === 1 && sent.length === 2, sent.length);
  sent = [];
  o.script = function (last) { sent.push(last); return "A pneumatic cylinder is a tube with a piston that compressed air pushes along."; };
  r = await C.turn([], "What is a pneumatic cylinder?", {}, {});
  ok("Chat: a question about a thing gets its answer, and no block is asked for", sent.length === 1 && !r.notes.some(function (n) { return /asked for the block/.test(n); }), [sent.length, r.notes]);

  // --- without the module ----------------------------------------------------------------------------------
  var o2 = load(["AI_NO_BLOCK"]), L2 = o2.L;
  await sleep(80);
  seen = [];
  out = await L2.aiAct.solve(it.q, seq([row.reply, it.ideal], seen));
  ok("without AI_NO_BLOCK: boot clean, nothing is asked, the reply fails as it did on 1.24.4", o2.errs.length === 0 && L2.aiNoBlock === undefined && seen.length === 1 && out.rounds === 1 &&
    /no MAKE block/.test(L2.aiBench.grade(L2.aiBenchQuestions.filter(function (x) { return x.id === "make-pneumatic"; })[0], out.text, out).why), [o2.errs, seen.length]);

  console.log(fails ? fails + " NO BLOCK FAILURES (" + passes + " passed)" : "ALL NO BLOCK TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack || e); process.exit(1); });
