// bench_run15.js -- Lantern Bench run 15: Qwen3.5-4B on 1.14.2, no library
// (88/96; run 14 scored 79 on the same 96 questions), replayed with the 4B's
// real replies (tests/fixtures/bench_run15_replies.json):
//  - =70*ANS/9.80665 for a weight on the Moon in newtons: divided by g;
//  - =60*5/1000+100*5/1000*0.15*30: two earlier lines glued with *, which
//    reaches only the second part of the sum;
//  - =60/3 "amp-hours" (watts over hours);
//  - "NEED: the name or address of the nearest clinic" for its phone number;
//  - a parallel circuit whose note line came after END, twice;
//  - TRACK: "person at position 2" not read as a place, and, told only that
//    no line moved 2 places, the 4B put 2 in both of its "left of" lines.
// Where Lantern sends something back, the reply that comes back is scripted.
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
var script = null;
function resp(status, body, type) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
  if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-4B-Q4_K_M.gguf" }] }), "application/json");
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
  var body = JSON.parse(opts.body);
  var r = script ? script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run15_replies.json"), "utf8"));
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(80);
  var L = w.Lantern, C = L.CHAT, A = L.assist, Q = L.aiBenchQuestions, act = L.aiAct, B = L.aiBench, PZ = L.aiPuzzle;
  await L.ai.detect();
  ok("boot clean", errs.length === 0, errs);
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }
  var g, out, m;

  // --- a weight divided by g -------------------------------------------------------------
  var mw = R["moon-weight"];
  out = await A.solve(mw.q, { call: seq([mw.reply, "=WEIGHT(70,PLANET(\x22Moon\x22,\x22gravity\x22))\nANSWER: The person weighs {result} newtons on the Moon."]) });
  g = B.grade(item("moon-weight"), out.text, out);
  ok("=70*ANS/9.80665 for newtons: questioned as kilograms-force, and the weight that comes back passes",
    /divides by 9\.80665 \x28Earth\u2019s gravity\x29, which turns newtons into kilograms-force/.test(out.rejected) && g.pass, [out.rejected, g.why]);
  ok("...a mass from a weight (newtons divided by g, asked in kg) is left alone",
    !L.assistChecks.some(function (c) { return c.id === "newtons-over-g" && c("A sack weighs 490 N on Earth. What is its mass in kilograms?", "=490/9.80665", A.run("=490/9.80665"), {}); }));

  // --- precedence -----------------------------------------------------------------------------
  var pb = R["power-bill"];
  out = await A.solve(pb.q, { call: seq([pb.reply, "=60*5/1000+100*5/1000\n=ANS*0.15*30\nANSWER: The cost over 30 days is {result} dollars."]) });
  g = B.grade(item("power-bill"), out.text, out);
  ok("two lines glued with * past a sum: questioned with the brackets, and the fix passes",
    /joins =60\*5\/1000\+100\*5\/1000 and =0\.15\*30 with \*, but \* is worked out before \+ and -.*write =\x2860\*5\/1000\+100\*5\/1000\x29\*0\.15\*30/.test(out.rejected) && g.pass, [out.rejected, g.why]);
  ok("...brackets, ANS, and a product of products are left alone", L.aiChecks.precedence("=60*5/1000+100*5/1000\n=0.15*30\n=(60*5/1000+100*5/1000)*0.15*30") === null &&
    L.aiChecks.precedence("=2*3\n=4*5\n=2*3*4*5") === null && L.aiChecks.precedence("=1+2\n=3\n=ANS1*ANS2") === null);

  // --- amp-hours, any wrong way -------------------------------------------------------------------
  var cf = R["chat-calc-follow-up"], asked = [];
  script = function (last) { asked.push(last); return asked.length === 1 ? cf.turns[0].reply : asked.length === 2 ? cf.turns[1].reply : "=5*3\nANSWER: The pump uses {result} amp-hours in 3 hours."; };
  var conv = await C.converse(item("chat-calc-follow-up").turns, {});
  g = B.grade(item("chat-calc-follow-up"), "", { turns: conv.turns });
  ok("=60/3 \u201camp-hours\u201d: questioned with 5 A \u00d7 3 h, and 15 passes", asked.length === 3 && /20 is not amps \u00d7 hours: 5 A \u00d7 3 h = 15 amp-hours/.test(asked[2]) && g.pass,
    [g.why, asked.map(function (s) { return s.slice(0, 220); })]);
  ok("...a week of amp-hours (5 A x 3 h x 7) is right", L.aiChecks.ampHoursOff("A 12 V pump draws 5 A for 3 hours a day. How many amp-hours does it use in a week?", 105, "{result} amp-hours") === null);

  // --- a phone number --------------------------------------------------------------------------------
  var pn = R["phone-number"];
  out = await A.solve(pn.q, { call: seq([pn.reply, "ANSWER: Not in my library."]) });
  g = B.grade(item("phone-number"), out.text, out);
  ok("\u201cNEED: the name or address of the nearest clinic\u201d: Lantern says no place's phone number is in its library, and the decline passes",
    /a local phone number, address or opening hours are not in Lantern\u2019s library/.test(out.needAnswered || "") && g.pass, [out.needAnswered, g.why]);

  // --- a note after END ----------------------------------------------------------------------------------
  var po = R["make-parallel-ohm"];
  m = act.build(po.reply, po.q);
  ok("the note line after END is part of the schematic: made, with the total", m && m.ok && m.block.noteAfterEnd && (m.plan.notes || m.block.lines).some(function (n) { return /Rt =/.test(n); }), m && m.problems);
  out = await act.solve(po.q, seq([po.first, po.reply]));
  g = B.grade(item("make-parallel-ohm"), out.text, out);
  ok("...the open circuit questioned once, the corrected one (note after END) passes", out.rounds === 2 && g.pass, [g.why, out.rejected]);
  ok("a note line after a code block or a plain sentence stays out", act.find("MAKE CODE: x\nlanguage python\nprint(1)\nEND\nnote this is python").every(function (b) { return !b.noteAfterEnd; }) &&
    act.find("MAKE SCHEMATIC: x\npart B1 battery\nEND\nThat is the circuit.\nnote later").every(function (b) { return !b.noteAfterEnd; }));

  // --- TRACK ----------------------------------------------------------------------------------------------
  var qb = R["queue-ball"], qb0 = qb.blocks[0], tq = "TRACK: Queue\n" + qb0.lines.join("\n") + "\nEND", r0 = PZ.run(tq, qb.q);
  ok("\u201cperson at position 2\u201d is read as a place now (the block runs; only the name Eve is asked about)", r0 && r0.final &&
    !r0.problems.some(function (p) { return /not in the row/.test(p); }), r0 && r0.problems);
  var cc = R["cups-two-coins"], b0 = "TRACK: Cups\n" + cc.blocks[0].lines.join("\n") + "\nEND", c0 = PZ.run(b0, cc.q);
  ok("one place for \u201ctwo places to its left\u201d: Lantern names the line that needs the 2, and says to leave the others",
    c0 && !c0.ok && /its line, \u201cswap holder of gold and left of holder of gold\u201d, moves 1 place: write \u201c2 left of holder of gold\u201d in that line, and leave the other lines as they are/.test(c0.problems.join(" ")), c0 && c0.problems);
  var fixed = b0.replace("swap holder of gold and left of holder of gold", "swap holder of gold and 2 left of holder of gold"), c1 = PZ.run(fixed, cc.q);
  ok("...with the 2 in that line only, the block runs to the right order", c1 && c1.ok && /1 Yellow, 2 Green, 3 Blue, 4 Red, 5 White/.test(c1.final), c1 && [c1.problems, c1.final]);
  var sent = [];
  script = function (last) { sent.push(last); return sent.length === 1 ? b0 : sent.length === 2 ? fixed : "ANSWER: Yellow, Green, Blue, Red, White; gold is under Green and silver under Blue."; };
  conv = await C.converse([cc.q], {});
  g = B.grade(item("cups-two-coins"), "", { turns: conv.turns });
  ok("in Chat: the line named, the block corrected and run, and the bench passes it", g.pass && /moves 1 place: write \u201c2 left of holder of gold\u201d in that line/.test(sent[1] || ""), [g.why, sent.map(function (s) { return s.slice(0, 200); })]);

  ok("no page errors along the way", errs.length === 0, errs);
  console.log(fails ? "BENCH RUN 15 FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL BENCH RUN 15 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
