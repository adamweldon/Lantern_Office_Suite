// bench_1244_4b.js -- the 4B's run of 1.24.4 on GitHub, replayed (1.24.6). It
// passed 102 of 109 (94%, 83 minutes); its seven failed rows, as the model
// wrote them, are tests/fixtures/bench_run_1244_4b.json.
//  - make-power-wheel: a line "fill gold" on its own under the last part
//    ("fill blue" on 1.24.3): AI_WHEEL reads it as that part's colour;
//  - make-slides-ladder: the deck written as several MAKE SLIDES blocks, a
//    slide or two in each: AI_SLIDES joins them (AI_ACTIONS' join hook);
//  - health-baby-breathing: "[n]" after each sentence, as the instructions
//    spell it (the 2B wrote "QUOTE [n]:" for the same question):
//    LIBRARY_CHECKS takes it off and Lantern cites the sentences itself;
//  - make-music-orchestra: "LESSON: Ode to Joy Orchestra" as a heading over
//    six sentences, three passages about slides, sentences and square
//    roots, then "Not in my library": the line is a heading, nothing is
//    read out, and the block is asked for;
//  - code-st-tank-fill: the request was more than the model holds (AI_FIT,
//    1.24.5, replayed here with the server's own words);
//  - make-sunset-house: a sunset under "fill sky", the first line of the
//    guide's example: it goes back with the line to write;
//  - make-house: a roof drawn as a red square. It is left failing (the
//    guide's example now has a roof in it).
// Where Lantern sends something back, the reply that comes back is scripted.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var R4 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_4b.json"), "utf8"));
var R2 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_2b.json"), "utf8"));
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
function load(model, strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, o = { w: w, d: w.document, errs: errs, script: null, bodies: [] };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, statusText: status === 400 ? "Bad Request" : "OK", headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url, opts) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: model }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    var body = JSON.parse(opts.body);
    o.bodies.push(body);
    var r = o.script ? o.script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
    if (r && typeof r === "object" && r.status) return resp(r.status, JSON.stringify({ error: { message: r.message, type: "exceed_context_size_error" } }), "application/json");
    return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
  };
  w.eval(js);
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1400)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list, seen) { var i = 0; return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return { role: m.role, content: textOf(m.content) }; })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
function row(R, id) { return R.rows.filter(function (r) { return r.id === id; })[0]; }

(async function () {
  var o = load("Qwen3.5-4B-Q4_K_M.gguf"), L = o.L;
  await sleep(80);
  await L.ai.detect();
  var B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct;
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }
  ok("boot clean, with a 4B on the kit's server (the full prompt: it is not a small model)", o.errs.length === 0 && /4B/.test(L.ai.server.label || "") && L.aiPrompt.active() === "full", [o.errs, L.ai.server.label]);
  ok("the fixture: the 4B passed 102 of 109 on 1.24.4; its seven failed rows are here", R4.summary.pass === 102 && R4.summary.n === 109 && R4.rows.length === 7 &&
    R4.rows.map(function (r) { return r.id; }).join() === "make-power-wheel,make-house,make-sunset-house,health-baby-breathing,make-slides-ladder,code-st-tank-fill,make-music-orchestra");

  // --- a colour on a line of its own ---------------------------------------------------------------------
  var w = row(R4, "make-power-wheel"), wq = item("make-power-wheel"), seen = [];
  ok("the fixture: a wheel with every formula right, then “fill gold” on its own line, questioned twice", /\nR: R=V\/I \| R=P\/I\^2 \| R=V\^2\/P\nfill gold\nnote /.test(w.reply) && w.reply === w.first.slice(w.first.indexOf("MAKE WHEEL")) &&
    /“fill gold”: a part line is/.test(w.why));
  var out = await act.solve(wq.q, seq([w.first], seen)), g = B.grade(wq, out.text, out);
  ok("the wheel is made the first time, and passes", out.rounds === 1 && out.made && out.made.ok && g.pass && out.kind !== "questioned", [out.rounds, out.kind, g.why, out.made && out.made.problems]);
  ok("...Lantern says how it read the line", /^4 parts, 12 items\. Lantern read the line “fill gold” as the colour of the part above it \(R\)$/.test(out.made.summary) &&
    out.made.plan.said.length === 1, out.made.summary);
  var WP = L.aiWheel.parse;
  function blk(lines) { return { title: "T", lines: lines, closed: true }; }
  var p1 = WP(blk(["A: one | two", "fill gold", "B: three | four"])), p2 = WP(blk(["fill red", "A: one | two", "B: three | four"])), p3 = WP(blk(["A: one | two fill blue", "colour: green", "B: three"])),
    p4 = WP(blk(["A: one | two", "fill zzzz", "B: three"])), p5 = WP(blk(["A: one | two", "Fill: #ffcc00", "B: three | four"]));
  ok("the part above gets the colour; the others are Lantern’s to colour", !!p1.parts[0].fill && !p1.parts[1].fill && p1.problems.length === 0 && p1.said.length === 1 && !!p5.parts[0].fill && p5.problems.length === 0);
  ok("with no part above, a part that has a colour already, or a colour Lantern does not know, the line is left out, and said", p2.problems.length === 0 && !p2.parts[0].fill && /^left out the line “fill red”/.test(p2.said[0]) &&
    p3.problems.length === 0 && /^left out the line “colour: green”/.test(p3.said[0]) && p4.problems.length === 0 && !p4.parts[0].fill && /^left out the line “fill zzzz”/.test(p4.said[0]),
    [p2.said, p3.said, p4.said, p2.problems, p3.problems, p4.problems]);
  ok("a line that is no part and no colour is still questioned", /a part line is <name>/.test(WP(blk(["A: one | two", "B: three", "gold everywhere"])).problems.join()) &&
    WP(blk(["A: one | two", "B: three"])).said.length === 0);

  // --- a deck in several blocks ---------------------------------------------------------------------------
  var s = row(R4, "make-slides-ladder"), sq = item("make-slides-ladder");
  ok("the fixture: MAKE SLIDES three times over with the same title (the row keeps the first 700 characters), and “the deck has 2”", (s.reply.match(/^MAKE SLIDES: Ladder Safety Toolbox Talk$/gm) || []).length === 3 &&
    s.reply.length === 700 && /asks for 4 to 6 slides, but the deck has 2/.test(s.why));
  var deckText = s.reply.slice(0, s.reply.lastIndexOf("\n")) + "\nEND";   // the row is cut mid-line: that line off, and the END the model wrote further on
  seen = [];
  out = await act.solve(sq.q, seq([deckText], seen)); g = B.grade(sq, out.text, out);
  ok("the blocks are one deck of 4 slides: made the first time, and it passes", out.rounds === 1 && out.made && out.made.ok && out.made.plan.count === 4 && g.pass, [out.rounds, out.made && out.made.problems, g.why]);
  ok("...Lantern says it joined them", /^4 slides\. Lantern joined the 3 MAKE SLIDES blocks of the reply into one deck$/.test(out.made.summary) && out.made.plan.said.length === 1, out.made.summary);
  var two = "MAKE SLIDES: Knots\n# Knots\nThree to know.\n# 1. Bowline\n- A loop that holds\nEND\n\nHere it is again, corrected:\n\nMAKE SLIDES: Knots\n# Knots\nThree to know.\n# 1. Bowline\n- A loop that will not slip\n# 2. Clove hitch\n- To a post\nEND";
  var m2 = act.fromReply(two, "Make slides about knots");
  ok("a deck written again (it starts with a slide the first has) is not joined: the first block is built, as before", m2.plan.count === 2 && !m2.plan.said && !/joined/.test(m2.summary), [m2.plan.count, m2.summary]);
  var J = L.aiSlides.join;
  ok("join: only blocks that bring new slides; one block, or none that does, is left alone", J([{ kind: "SLIDES", title: "A", lines: ["# One", "- x"], closed: true }]) === null &&
    J([{ kind: "SLIDES", title: "A", lines: ["# One", "- x"], closed: true }, { kind: "SLIDES", title: "A", lines: ["- no heading here"], closed: true }]) === null &&
    J([{ kind: "SLIDES", title: "A", lines: ["# One", "- x"], closed: true }, { kind: "SLIDES", title: "A", lines: ["# Two", "- y"], closed: false }]).closed === false);
  var guide = act.prompt(sq.q);
  ok("the guide: the whole deck is ONE block, the example is a whole deck (a title slide and each of its three steps), and the number of slides asked for is said again",
    /The whole deck is ONE block: END comes once, after the last slide\./.test(guide) && /# 3\. Give it back\n- Take off your own lock only\n- Tell the crew before power returns\nEND/.test(guide) &&
    /The question asks for 4 to 6 slides: write every slide in this ONE block, each starting with #, and END after the last\./.test(guide) &&
    !/The question asks for/.test(act.prompt("Make slides for a talk on knots.")), guide.slice(-400));
  ok("...and a talk on ladder safety is offered MAKE SLIDES only (it was MAKE CODE too, for the word ladder)", !/MAKE CODE/.test(guide) && guide.length < 1100, guide.length);

  // --- "[n]" as the instructions spell it ------------------------------------------------------------------
  var hb = row(R4, "health-baby-breathing"), hq = item("health-baby-breathing");
  ok("the fixture: five sentences that end in “[n]”, and “no sentence backed”", (hb.reply.match(/\[n\]/g) || []).length === 5 && /no sentence backed by a lesson passage/.test(hb.why));
  o.bodies.length = 0;
  o.script = function () { return hb.reply; };
  var t = await L.CHAT.turn([], hq.turns[0], {}, {});
  ok("Chat takes the “[n]” off, finds the sentences in the passage itself, and counts them: the bench passes it", t.literalN === 5 && t.citedByLantern >= 3 && t.backed === t.citedByLantern && hq.check([t]) === "",
    [t.literalN, t.citedByLantern, t.backed, hq.check([t])]);
  ok("...in one round: nothing goes back for an answer Lantern can cite itself, and nothing is still questioned", o.bodies.length === 1 && t.rounds === 1 && !t.stillDoubt &&
    t.notes.some(function (n) { return /^The AI wrote “\[n\]” as the instructions spell it, with no number; Lantern looked for each of its sentences in the passages itself\.$/.test(n); }) &&
    !t.notes.some(function (n) { return /still questions/.test(n); }), [o.bodies.length, t.notes]);
  var h2 = row(R2, "health-baby-breathing");
  o.script = function () { return h2.reply; };
  var t2 = await L.CHAT.turn([], hq.turns[0], {}, {});
  ok("the 2B’s “QUOTE [n]:” is read as a quote from the passage it is in, and is checked", /^QUOTE \[n\]: A child with a cough/m.test(h2.reply) && t2.literalN === 1 && t2.quotesOk === true && hq.check([t2]) === "",
    [t2.literalN, t2.quotesOk, hq.check([t2])]);
  var LIT = L.libraryLiteral, SRC = [{ n: 1, text: "Goats need shelter from rain." }, { n: 2, text: "Boil the water for one minute." }];
  var l1 = LIT("Boil it for one minute [n]. Keep goats dry [N].\nQUOTE [n]: Boil the water for one minute.", SRC);
  ok("literal: the marks come off; a QUOTE [n] gets the number of the passage that has it", l1.n === 3 && l1.text === "Boil it for one minute. Keep goats dry.\nQUOTE [2]: Boil the water for one minute.", l1);
  ok("...code is left alone (a fenced block, an index), and a reply without it is untouched", LIT("for (i = 0; i < n; i++) total += a[n];", SRC).n === 0 &&
    LIT("\x60\x60\x60\nx = list [n]\n\x60\x60\x60", SRC).n === 0 && LIT("Boil it [2].", SRC).text === "Boil it [2]." && L.libraryRenumber("Boil it [n].", SRC).literal === 1);
  var gv = L.libraryVerify("ANSWER: Boil it for one minute [2].\nQUOTE [n]: Boil the water for one minute.", SRC, "How long do I boil water?");
  ok("...a short answer with QUOTE [n] verifies", gv.ok === true && gv.quotes.length === 1 && gv.quotes[0].n === 2, gv);
  // an answer that cites nothing and that no passage says still goes back once, as before
  o.bodies.length = 0;
  o.script = function () { return "Babies breathe faster than adults because their lungs are small and their hearts beat quickly all day long."; };
  var t3 = await L.CHAT.turn([], hq.turns[0], {}, {});
  ok("an answer with no citation that the passage does not say is still sent back once", o.bodies.length === 2 && /the answer cites none of the passages/.test(textOf(o.bodies[1].messages[o.bodies[1].messages.length - 1].content)), o.bodies.length);

  // --- a lesson asked for where a block was wanted ------------------------------------------------------------
  var mo = row(R4, "make-music-orchestra"), mq = item("make-music-orchestra");
  ok("the fixture: \u201cLESSON: Ode to Joy Orchestra\u201d and six sentences about orchestras under it, then the passages said not to cover it, and no block", /^LESSON: Ode to Joy Orchestra$/m.test(mo.first) &&
    /1\. The main theme of Beethoven/.test(mo.first) && /templates for Slides, sentence structure rules for Compose, and the mathematical concept of square roots/.test(mo.reply) && mo.why === "no MAKE block");
  var LCM = (L.chatCommands || []).filter(function (c) { return c.id === "lessons"; })[0];
  ok("a LESSON line that heads a whole answer is a heading, not a request; alone, or repeated, or after the model\u2019s thinking, it is a request",
    LCM.test(mo.first) === null && LCM.test("LESSON: Ode to Joy Orchestra") === "Ode to Joy Orchestra" && LCM.test("LESSON: burns\nLESSON: burns\nLESSON: burns") === "burns" &&
    LCM.test("I should read the lesson first.\n\nLESSON: hen health") === "hen health", [LCM.test(mo.first)]);
  seen = [];
  out = await act.solve(mq.q, seq([mo.first, mq.ideal], seen)); g = B.grade(mq, out.text, out);
  var back = seen[1] || [], lastBack = back.length ? back[back.length - 1].content : "";
  ok("no passages are read out for it (they were the Slides guide, a lesson on sentences and one on square roots): the MAKE MUSIC block is asked for, and passes", out.rounds === 2 && g.pass && out.kind === "no block" &&
    !/\[1\]/.test(lastBack) && /^Lantern found no MAKE block in your reply/.test(lastBack) && /Its first line is:\nMAKE MUSIC: <a short title>\nthen its lines, then END\./.test(lastBack), [out.rounds, out.kind, g.why, lastBack.slice(0, 300)]);
  seen = [];
  out = await act.solve(mq.q, seq([mo.first, mo.reply, mq.ideal], seen)); g = B.grade(mq, out.text, out);
  ok("...asked once: a second reply with no block is the answer, and fails as before", out.rounds === 2 && seen.length === 2 && !g.pass && /no MAKE block/.test(g.why), [out.rounds, seen.length, g.why]);
  var nothing = L.suite.passages(mq.q, "Ode to Joy Orchestra", { detail: true, max: 3 });
  ok("...and the words it asked with find no lesson now", nothing.length === 0, nothing.map(function (x) { return x.key; }));

  // --- more than the model can hold ------------------------------------------------------------------------
  var st = row(R4, "code-st-tank-fill"), stq = item("code-st-tank-fill");
  ok("the fixture: the server refused 8409 tokens for a model that holds 8192", /request \(8409 tokens\) exceeds the available context size \(8192 tokens\)/.test(st.why));
  var refused = 0;
  o.bodies.length = 0;
  o.script = function () { if (!refused) { refused = 1; return { status: 400, message: "request (8409 tokens) exceeds the available context size (8192 tokens), try increasing it" }; } return stq.ideal; };
  out = await act.solve(stq.q, function (msgs) { return L.ai.complete(msgs, { max_tokens: stq.max_tokens }); }); g = B.grade(stq, out.text, out);
  ok("the request is shortened and sent once more, and the program that comes back passes", o.bodies.length === 2 && JSON.stringify(o.bodies[1].messages).length < JSON.stringify(o.bodies[0].messages).length && g.pass,
    [o.bodies.length, g.why]);

  // --- the house and the sunset ---------------------------------------------------------------------------------
  var ho = row(R4, "make-house"), hoq = item("make-house"), su = row(R4, "make-sunset-house"), suq = item("make-sunset-house");
  out = await act.solve(hoq.q, seq([ho.reply], [])); g = B.grade(hoq, out.text, out);
  ok("a roof drawn as a red square still fails: Lantern cannot tell from the block what was meant", !g.pass && /no red roof/.test(g.why), g.why);
  seen = [];
  var out2 = await act.solve(suq.q, seq([su.reply, su.reply.replace("rect 0 0 20 12 fill sky", "rect 0 0 20 12 fill orange")], seen)), g2 = B.grade(suq, out2.text, out2);
  var back2 = seen[1] ? seen[1][seen[1].length - 1].content : "";
  ok("a sunset under the blue of day goes back with the line to write, and the picture with that line passes", /fill sky\n/.test(su.reply) && out2.rounds === 2 && g2.pass &&
    /the question says sunset, and the sky \(\u201crect 0 0 20 12 fill sky\u201d\) is the blue of day: write rect 0 0 20 12 fill orange/.test(back2), [out2.rounds, g2.why, back2.slice(0, 300)]);
  var dg = act.prompt(hoq.q);
  ok("the drawing guide\u2019s example has a roof (a tri) and a door, and says what colour a sky is at sunset; it is not the bench\u2019s house (no red in it)",
    /MAKE DRAWING: Hut by a tree/.test(dg) && /\ntri 2 6 5 3 8 6 fill brown\n/.test(dg) && /\(The sky is sky by day, orange or pink at sunset or sunrise\.\)/.test(dg) && !/fill red/.test(dg), dg.slice(-420));
  ok("...a blue sky by day, and a night sky, are not questioned", act.fromReply("MAKE DRAWING: Hut\nrect 0 0 20 12 fill sky\nrect 3 6 4 3 fill tan\ntri 2 6 5 3 8 6 fill brown\nEND", "Draw a hut on a sunny day.").ok === true &&
    act.fromReply("MAKE DRAWING: Sunset\nrect 0 0 20 8 fill orange\nrect 0 8 20 4 fill blue\nEND", "Draw the sea at sunset.").ok === true);

  // --- rule 11 ----------------------------------------------------------------------------------------------
  var o2 = load("Qwen3.5-4B-Q4_K_M.gguf", ["AI_SLIDES"]);
  await sleep(60);
  ok("without AI_SLIDES nothing breaks, and other blocks are built as before", o2.errs.length === 0 && !o2.L.aiSlides && o2.L.aiAct.fromReply(w.reply, wq.q).ok === true, o2.errs);

  console.log(fails ? fails + " BENCH 1.24.4 4B FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.4 4B CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
