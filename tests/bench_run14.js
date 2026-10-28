// bench_run14.js -- Lantern Bench run 14: Qwen3.5-4B on 1.14.1 (100/118;
// the 35B scored 118/118 on the same build), replayed with the 4B's real
// replies (tests/fixtures/bench_run14_replies.json). The misses Lantern can
// do something about:
//  - lamps labelled "LED" were sent back as diodes by Lantern's own label
//    check (1.13.4), and the circuits lost their lamps -- an LED lamp is a
//    lamp now;
//  - "in parallel" drawn as one loop through every part (series) -- now
//    questioned, with how to wire each part across the source;
//  - a deck of 2 slides for "4 to 6 slides", and a planner line "in 1 month"
//    for "starting one week from today" -- both checked against the question;
//  - =RUNTIME(10,60): a 10 Wh battery nobody mentioned (10 passed as a unit
//    factor) -- a made-up input to a quantity function is questioned;
//  - "180 amp-hours" from 60 W x 3 h -- watt-hours, questioned;
//  - =1436.06/60 for Lantern's 1435.7027 (a result retyped with its own
//    rounding) -- Lantern runs its own result there, and the sentence's
//    number with it, with no turn spent; and when the 4B then asked for
//    Earth's mass, Lantern has it (PLANET);
//  - "no quote says methane" now points at the passage sentence that does;
//  - "NEED: What is the name of your town?" for the mayor right now: Lantern
//    says no place's office holder right now is in its library;
//  - "Not in the document" about a 5-page manual it had seen 2 pages of:
//    asked to READ the page that may say it first; and "From my own
//    knowledge: most compressors ... 1-year warranty" about this compressor
//    is left out of the answer.
// Where Lantern now sends something back, the reply that comes back is
// scripted (the model's next reply is the next bench run's to show).
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
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run14_replies.json"), "utf8"));
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(80);
  var L = w.Lantern, C = L.CHAT, A = L.assist, Q = L.aiBenchQuestions, act = L.aiAct, B = L.aiBench;
  await L.ai.detect();
  ok("boot clean", errs.length === 0, errs);
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }
  var g, out, m;

  // --- lamps labelled LED stay lamps -------------------------------------------------------
  var lc = R["make-lamp-circuit"];
  m = act.build(lc.first, lc.q);
  ok("the 4B's first lamp circuit (lamp labelled LED) is made as it is: no push to a diode", m && m.ok, m && m.problems);
  out = await act.solve(lc.q, seq([lc.first]));
  g = B.grade(item("make-lamp-circuit"), out.text, out);
  ok("...and the bench passes it with no correction turn", g.pass && out.rounds === 1, [g.why, out.rounds]);
  ok("a resistor labelled Lamp still goes back as a lamp (run 12)", !act.build("MAKE SCHEMATIC: x\nmode electrical\npart B1 battery \x2212 V\x22\npart R1 resistor \x22Lamp 1\x22\nwire B1 R1\nwire R1 B1\nEND", "Draw a lamp and a battery").ok);

  // --- parallel asked, series drawn ----------------------------------------------------------
  var pl = R["make-parallel-lamps"];
  m = act.build(pl.first, pl.q);
  ok("two lamps wired to each other for \u201cin parallel\u201d: questioned, with how to wire each across B1", m && !m.ok &&
    /asks for the lamps in parallel, but L1 and L2 are wired to each other, which puts them in series: wire each lamp across B1 on its own \x28wire B1 L1, wire L1 B1; wire B1 L2, wire L2 B1\x29/.test(m.problems.join(" ")) &&
    !/diode/.test(m.problems.join(" ")), m && m.problems);
  var plFixed = "MAKE SCHEMATIC: Parallel Lamps\nmode electrical\npart B1 battery \x229 V\x22\npart L1 lamp \x22LED\x22\npart L2 lamp \x22LED\x22\nwire B1 L1\nwire L1 B1\nwire B1 L2\nwire L2 B1\nEND";
  out = await act.solve(pl.q, seq([pl.first, plFixed]));
  g = B.grade(item("make-parallel-lamps"), out.text, out);
  ok("...corrected once to two lamps across the battery, the bench passes it", g.pass && out.rounds === 2 && out.fixed, [g.why, out.rejected]);
  var po = R["make-parallel-ohm"];
  m = act.build(po.reply, po.q);
  ok("three resistors in one loop for \u201cin parallel\u201d: questioned", m && !m.ok && /resistors in parallel, but R1 and R2 are wired to each other/.test(m.problems.join(" ")), m && m.problems);
  ok("a series question, and a real parallel drawing, are left alone", act.build(po.reply, "Draw a series circuit: a 12 V battery with 4, 6 and 12 ohm resistors.").ok &&
    act.build(item("make-parallel-ohm").ideal, po.q).ok && act.build(item("make-parallel-lamps").ideal, pl.q).ok);
  out = await act.solve(po.q, seq([po.reply, item("make-parallel-ohm").ideal]));
  g = B.grade(item("make-parallel-ohm"), out.text, out);
  ok("...and the corrected block passes", g.pass && out.rounds === 2, [g.why, out.rejected]);

  // --- slides and planner against the question -------------------------------------------------
  var sl = R["make-slides-ladder"];
  m = act.build(sl.reply, sl.q);
  ok("2 slides for \u201c4 to 6 slides\u201d: questioned", m && !m.ok && /asks for 4 to 6 slides, but the deck has 2: add slides so there are 4 to 6/.test(m.problems.join(" ")), m && m.problems);
  ok("the slide count read from the question: a range, between, a number, none",
    L.aiSlides.asked("4 to 6 slides").lo === 4 && L.aiSlides.asked("between three and five slides").hi === 5 && L.aiSlides.asked("a 5-slide deck").lo === 5 &&
    L.aiSlides.asked("Make a slide deck on ladders") === null);
  var deck5 = "MAKE SLIDES: Ladder Safety\n# Ladder Safety\nA toolbox talk.\n# Inspect\n- Check the rungs\n# Set up\n- Firm, level ground\n# Climb\n- Three points of contact\n# Store\n- Dry and flat\nEND";
  out = await act.solve(sl.q, seq([sl.reply, deck5]));
  g = B.grade(item("make-slides-ladder"), out.text, out);
  ok("...a deck of 5 comes back and passes", g.pass && out.rounds === 2, [g.why, out.rejected]);
  var pn = R["make-plan-compressor"];
  m = act.build(pn.reply, pn.q);
  ok("\u201cin 1 month\u201d for \u201cstarting one week from today\u201d: questioned", m && !m.ok &&
    /the question says \u201cone week from today\u201d \x28\d{4}-\d\d-\d\d\x29, but no line starts then: .*e\.g\. in one week/.test(m.problems.join(" ")), m && m.problems);
  ok("the question's own dates: today, one week, three months (and not \u201cevery month\u201d)", L.aiPlan.said(pn.q, "2026-10-28").map(function (x) { return x.date; }).join(",") === "2026-10-28,2026-11-04,2027-01-28",
    L.aiPlan.said(pn.q, "2026-10-28"));
  out = await act.solve(pn.q, seq([pn.reply, item("make-plan-compressor").ideal]));
  g = B.grade(item("make-plan-compressor"), out.text, out);
  ok("...the corrected plan passes", g.pass && out.rounds === 2, [g.why, out.rejected]);
  ok("the ideal plan and slides are not questioned", act.build(item("make-plan-compressor").ideal, pn.q).ok && act.build(item("make-slides-ladder").ideal, sl.q).ok);

  // --- a made-up battery -------------------------------------------------------------------------
  var nb = R["need-battery"];
  out = await A.solve(nb.q, { call: seq([nb.reply, "NEED: How many watt-hours (or amp-hours and volts) does your battery hold?"]) });
  g = B.grade(item("need-battery"), out.text, out);
  ok("=RUNTIME(10,60): 10 is questioned as an input nobody gave, and the NEED that comes back passes", /RUNTIME is given 10 for Wh, which is not in the question/.test(out.rejected) && g.pass, [out.rejected, g.why]);
  ok("given inputs, combined ones (100 Ah x 12 V) and constants in optional places are left alone",
    (function () {
      var probs = [];
      ["=RUNTIME(1200,60)", "=RUNTIME(100*12,60)", "=WEIGHT(50,9.81)"].forEach(function (x) {
        var qq = /RUNTIME/.test(x) ? "A 100 Ah 12 V battery runs a 60 W light. How many hours will it last?" : "What is the weight in newtons of a 50 kg sack?";
        if (L.aiChecks.inputs(qq, x).length) probs.push(x);
      });
      return !probs.length;
    })());

  // --- amp-hours from watts (Chat) ------------------------------------------------------------------
  var cf = R["chat-calc-follow-up"], asked = [];
  script = function (last) { asked.push(last); return asked.length === 1 ? cf.turns[0].reply : asked.length === 2 ? cf.turns[1].reply : "=5*3\nANSWER: The pump uses {result} amp-hours in 3 hours."; };
  var conv = await C.converse(item("chat-calc-follow-up").turns, {});
  g = B.grade(item("chat-calc-follow-up"), "", { turns: conv.turns });
  ok("\u201c180 amp-hours\u201d (60 W x 3 h) is questioned as watt-hours, and 5 x 3 = 15 passes", asked.length === 3 &&
    /the ANSWER gives amp-hours, but 180 is volts \u00d7 amps \u00d7 hours \x2812 V \u00d7 5 A \u00d7 3 h\x29, which is watt-hours; amp-hours are amps \u00d7 hours: =5\*3/.test(asked[2]) && g.pass,
    [g.why, asked.map(function (s) { return s.slice(0, 200); })]);

  // --- a retyped result, and Earth's mass ----------------------------------------------------------
  var gp = R["geo-period"];
  out = await A.solve(gp.q, { call: seq([gp.first, "should not be asked"]) });
  g = B.grade(item("geo-period"), out.text, out);
  ok("=1436.06/60 for Lantern's 1435.7027: Lantern runs ANS4/60 and the sentence's 23.9343 with it, with no turn spent; the bench passes it",
    out.rounds === 1 && g.pass && Math.abs(out.run.value - 23.9284) < 1e-3 && /line 5: 1436\.06 -> ANS4/.test((out.rechained || []).join(" ")) &&
    /23\.9343 -> 23\.9284/.test((out.repaired || []).join(" ")) && /23\.9284 hours/.test(out.parsed.answer), [g.why, out.rounds, out.rechained, out.repaired, out.text]);
  var na = L.aiNeedAnswer(A.parseReply(gp.reply).need, gp.q);
  ok("the 4B's NEED for Earth's mass or GM: Lantern has both (PLANET)", /Earth\u2019s mass is 5\.9722e24 kg: =PLANET\x28\x22Earth\x22,\x22mass\x22\x29; Earth\u2019s GM \x28gravitational parameter\x29 is 3\.986e14 m\^3\/s\^2/.test(na || ""), na);
  ok("...but not a NEED for the person's own numbers", L.aiNeedAnswer("How many amp-hours does your battery hold?", "How many hours will my battery run a 60 W light?") === null);
  ok("an exact copy of a result, or a number from the question, is left alone; a rounded copy (133.3 for 133.33) is rechained",
    L.aiResultChecks.rechainNumbers("=100*12\n=1200/60", A.run("=100*12\n=1200/60").steps, "100 Ah 12 V 60 W") === null &&
    L.aiResultChecks.rechainNumbers("=2000/15\n=2000/60", A.run("=2000/15\n=2000/60").steps, "2000 litres 15 litres per minute") === null &&
    L.aiResultChecks.rechainNumbers("=2000/15\n=133.3/60", A.run("=2000/15\n=133.3/60").steps, "2000 litres 15 litres per minute").expr === "=2000/15\n=ANS1/60");

  // --- the passage sentence that says it --------------------------------------------------------------
  var ng = R["natural-gas"], srcs = ng.library.passages.map(function (t, i) { return { n: i + 1, title: ng.library.sources[i], text: t, book: "wikipedia_en_all_mini_2026-09" }; });
  var v = L.libraryVerify(ng.reply, srcs, ng.q);
  ok("\u201cno quote says methane\u201d now points at the sentence that does", !v.ok && /no quote says methane: passage \x5B1\x5D says it in \u201cNatural gas \x28also gas, methane gas or fossil gas\x29 is a fossil fuel, naturally occurring in geological formations\.\u201d \u2014 QUOTE that sentence/.test(v.problems.join(" ")), v.problems);
  v = L.libraryVerify("ANSWER: The main component of natural gas is methane [1].\nQUOTE [1]: Natural gas (also gas, methane gas or fossil gas) is a fossil fuel, naturally occurring in geological formations.", srcs, ng.q);
  ok("...and quoting it passes", v.ok, v.problems);

  // --- the mayor right now -------------------------------------------------------------------------------
  var my = R["mayor"];
  ok("\u201cWhat is the name of your town?\u201d for the mayor right now: Lantern answers it", /who holds an office right now is not in Lantern\u2019s library.*\nNow reply: ANSWER: Not in my library\./.test(L.aiNeedAnswer(A.parseReply(my.reply).need, my.q) || ""));
  var sent = [];
  out = await A.solve(my.q, { call: function (msgs) { sent.push(textOf(msgs[msgs.length - 1].content)); return Promise.resolve(sent.length === 1 ? my.reply : "ANSWER: Not in my library."); } });
  g = B.grade(item("mayor"), out.text, out);
  ok("...sent as it is, with its own last line, and the decline that comes back passes", g.pass && /\nNow reply: ANSWER: Not in my library\.$/.test(sent[1] || "") && !/= lines/.test(sent[1] || ""), [g.why, sent[1]]);
  ok("a mayor in a named year, or a battery, is left to the AI", L.aiNeedAnswer("Which town?", "Who was the mayor of Tulsa in 1990?") === null);

  // --- the document ----------------------------------------------------------------------------------------
  function attach(doc) { L.textReader.attached = { id: "bench", title: doc.title, per: 10, pages: doc.pages.map(function (t, k) { return { n: k + 1, text: t, conf: 1, done: true, own: true }; }) }; }
  var rp = R["doc-read-another-page"], it = item("doc-read-another-page"), seenMsgs = [];
  attach(it.doc);
  script = function (last) {
    seenMsgs.push(last);
    if (seenMsgs.length === 1) return rp.reply;
    if (seenMsgs.length === 2) return "READ: page 5";
    var n = (/\x5B(\d+)\x5D[^\n]*\n[^\n]*warranty runs for 2 years/i.exec(last) || [])[1] || "1";
    return "ANSWER: The guarantee runs for 2 years, parts and labour [" + n + "].\nQUOTE [" + n + "]: The warranty runs for 2 years, parts and labour, from the date of purchase.";
  };
  conv = await C.converse(it.turns, {});
  g = B.grade(it, "", { turns: conv.turns });
  ok("\u201cNot in the document\u201d after seeing 2 of 5 pages: asked to READ the page that may say it; READ page 5, 2 years, and the bench passes it",
    seenMsgs.length === 3 && /were not in front of you\. Before you answer Not in the document, find the page that may say it/.test(seenMsgs[1]) && g.pass,
    [g.why, seenMsgs.map(function (s) { return s.slice(0, 220); })]);
  var nc = R["doc-not-covered"], it2 = item("doc-not-covered");
  attach(it2.doc);
  seenMsgs = [];
  script = function (last) { seenMsgs.push(last); return nc.reply; };
  conv = await C.converse(it2.turns, {});
  var t0 = conv.turns[0];
  g = B.grade(it2, "", { turns: conv.turns });
  ok("\u201cFrom my own knowledge: most compressors ... 1-year warranty\u201d about this compressor is left out, said under the answer, and the bench passes it",
    g.pass && !/1-year/.test(t0.final) && /Not in the document/.test(t0.final) && t0.ownLeftOut &&
    (t0.notes || []).some(function (n) { return /Lantern left out what the AI added from its own knowledge \x28\u201cFrom my own knowledge: Most standard air compressors/.test(n) && /about this compressor/.test(n); }),
    [g.why, t0.final, t0.notes]);
  ok("...once every page has been seen, Lantern does not ask for more pages", seenMsgs.length === 1 || !/not in front of you/.test(seenMsgs[1] || ""), seenMsgs.length);
  ok("own knowledge on a general question with a document attached is kept", L.chatDocDecline.ownGuess("What is a compressor duty cycle?", "ANSWER: Not in the document.\nFrom my own knowledge: it is the share of time it may run.") === null);
  L.textReader.attached = null;

  ok("no page errors along the way", errs.length === 0, errs);
  console.log(fails ? "BENCH RUN 14 FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL BENCH RUN 14 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
