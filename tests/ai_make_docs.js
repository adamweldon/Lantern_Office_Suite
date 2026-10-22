// ai_make_docs.js -- 1.12.0: the AI makes things in Writer, Slides,
// Flashcards and the Planner (AI_DOC, AI_SLIDES, AI_CARDS, AI_PLAN, and the
// host's slideDocs / cardDocs / plannerDocs), and reads more of the person's
// document (READ, TEXT_READER_READ). Block parsers and their checks, dates
// worked out by Lantern, the Chat flow with its Open buttons, the command
// list, the READ command on its own and in a conversation, and the bench's
// ideal replies. Scripted model.
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
w.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; return function () {}; }, set: function (t, k, v) { t[k] = v; return true; } });
};
w.HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="; };
var modelReplies = [], modelCalls = [];
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new TypeError("no library"));
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-4B-Q4_K_M.gguf" }] }));
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false, audio: false } }));
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var r = modelReplies.length ? modelReplies.shift() : "ANSWER: ok";
  if (typeof r === "function") r = r(body);
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }));
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function block(lines, closed) { return { kind: "X", title: "T", lines: lines, closed: closed !== false }; }
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, act = L.aiAct;
  ok("boot clean", errs.length === 0, errs);
  ok("the four new actions are there, each saying which app it opens", ["doc", "slides", "cards", "plan"].every(function (id) {
    return L.aiActions.some(function (a) { return a.id === id && a.opens; }); }) && L.aiDoc && L.aiSlides && L.aiCards && L.aiPlan);

  // --- MAKE DOC ---
  var dd = L.aiDoc.doc(block(["## Before you start", "Switch off the **main** breaker and wait.", "1. Drain the oil.", "2. Refill it.", "- Gloves", "Part | Torque", "Head bolt | 25 Nm", "A closing line for the reader."]));
  ok("doc: headings, numbered steps, bullets, a table with a header row, paragraphs, bold", /<h2>Before you start<\/h2>/.test(dd.html) && /<ol><li>Drain the oil.<\/li><li>Refill it.<\/li><\/ol>/.test(dd.html) &&
    /<ul><li>Gloves<\/li><\/ul>/.test(dd.html) && /<table><tr><th>Part<\/th><th>Torque<\/th><\/tr><tr><td>Head bolt<\/td><td>25 Nm<\/td><\/tr><\/table>/.test(dd.html) &&
    /<p>Switch off the <b>main<\/b> breaker and wait.<\/p>/.test(dd.html) && dd.parts.headings === 1 && dd.parts.items === 3 && dd.parts.rows === 2 && !dd.problems.length, dd);
  ok("doc: text is escaped, not markup", /&lt;script&gt;/.test(L.aiDoc.doc(block(["<script>alert(1)</script> is not run, and this line is long enough to count."])).html));
  ok("doc: too short, empty and cut off are problems", /only 3 words/.test(L.aiDoc.doc(block(["Hello there friend."])).problems[0]) &&
    /empty/.test(L.aiDoc.doc(block([])).problems[0]) && /cut off/.test(L.aiDoc.doc(block(["One two three four five six seven eight nine ten eleven twelve thirteen."], false)).problems.join()));
  var dres = act.build(blk("DOC", "Notice", ["## Water off", "The water will be off on Tuesday from 9 to 12 while the pipes are mended.", "- Fill a kettle first", "- Do not use the boiler"]), "");
  ok("doc: built through AI_ACTIONS, ok, with Open in Writer and a summary", dres.ok && dres.openLabel === "Open in Writer" && /words, 1 heading, 2 list items/.test(dres.summary) && /writing checker/.test(dres.summary), dres.summary);

  // --- MAKE SLIDES ---
  var sd = L.aiSlides.deck(block(["# Ladder safety", "A short talk.", "# Before you climb", "- Check the feet", "- Check the rungs", "## On the ladder", "- Three points of contact"]));
  ok("slides: # starts a slide, - a point, a plain line a sentence", sd.slides.length === 3 && sd.slides[0].lines[0] === "A short talk." && sd.slides[1].points.length === 2 && sd.slides[2].h === "On the ladder" && !sd.problems.length, sd);
  var many = ["# Too much"]; for (var i = 0; i < 9; i++) many.push("- point " + i);
  ok("slides: more than 7 points, an empty slide, a missing title and a cut-off deck are problems",
    /9 points/.test(L.aiSlides.deck(block(many)).problems.join()) && /nothing under its title/.test(L.aiSlides.deck(block(["# One", "x", "# Two"])).problems.join()) &&
    /cut off/.test(L.aiSlides.deck(block(["# One", "- a"], false)).problems.join()) && /too long/.test(L.aiSlides.deck(block(["# One", "- " + new Array(40).join("word ")])).problems.join()));
  var sres = act.build(blk("SLIDES", "Ladders", ["# Ladders", "# Climb", "- Face the ladder", "- Three points"]), "");
  ok("slides: the bodies are lists for Slides", sres.ok && sres.plan.slides[1].body === "<ul><li>Face the ladder</li><li>Three points</li></ul>" && sres.openLabel === "Open in Slides", sres.plan);

  // --- MAKE CARDS ---
  var cd = L.aiCards.cards(block(["Front | Back", "E-04 | Low oil level", "What is 7 x 8? :: 56", "Q: Unit of resistance?", "A: The ohm", "E-04 | again", "Same | same", "Lonely"]));
  ok("cards: | and :: and Q:/A: pairs; the header row is skipped", cd.pairs.length === 3 && cd.pairs[1][1] === "56" && cd.pairs[2][0] === "Unit of resistance?" && cd.pairs[2][1] === "The ohm", cd);
  ok("cards: a card twice, the same words both sides, and a line that is not a card are problems", /there twice/.test(cd.problems.join()) && /same words on both sides/.test(cd.problems.join()) && /not a card/.test(cd.problems.join()), cd.problems);
  ok("cards: one card is not a deck", /only one card/.test(L.aiCards.cards(block(["a | b"])).problems.join()));

  // --- MAKE PLAN: dates are Lantern's arithmetic ---
  var W = L.aiPlan.when, T = "2026-01-31";   // a Saturday
  ok("plan dates: today, tomorrow, in N days/weeks/months, month ends kept in the month", W("today", T) === T && W("tomorrow", T) === "2026-02-01" &&
    W("in 3 days", T) === "2026-02-03" && W("in two weeks", T) === "2026-02-14" && W("in 1 month", T) === "2026-02-28" && W("in a year", T) === "2027-01-31");
  ok("plan dates: weekdays (plain = next one, this = today when it is today)", W("next monday", T) === "2026-02-02" && W("saturday", T) === "2026-02-07" && W("this saturday", T) === T && W("Friday", T) === "2026-02-06");
  ok("plan dates: day and month (next one when past), ISO, and nonsense", W("1 December", T) === "2026-12-01" && W("1 January", T) === "2027-01-01" && W("Dec 1 2026", T) === "2026-12-01" &&
    W("on 2026-03-05", T) === "2026-03-05" && W("2026-02-30", T) === null && W("someday", T) === null);
  var pl = L.aiPlan.plan(block(["when | what | how often", "in 1 week | Check the belt | every month", "today | Drain the tank | daily", "2025-12-01 | Too late", "tomorrow | Grease it | every 2 weeks", "soonish | Something"]), T);
  ok("plan: sorted by date, repeats read; past dates, other intervals and unreadable dates are problems", pl.events.length === 2 && pl.events[0].text === "Drain the tank" && pl.events[0].repeat === "daily" &&
    pl.events[1].date === "2026-02-07" && pl.events[1].repeat === "monthly" && /in the past/.test(pl.problems.join()) && /every day, week, month or year/.test(pl.problems.join()) && /not a date/.test(pl.problems.join()), pl);

  // --- the apps' own doors ---
  var sid = L.slideDocs.create("Test deck", [{ h: "One", body: "<p>x</p>" }, { h: "Two", body: "" }]);
  ok("slideDocs: create and list", L.slideDocs.list().some(function (x) { return x.id === sid && x.slides === 2; }));
  var cid = L.cardDocs.create("Test cards", [["alpha front", "b"], ["gamma front", "d"]]);
  ok("cardDocs: create and list", L.cardDocs.list().some(function (x) { return x.id === cid && x.cards === 2; }));
  var eid = L.plannerDocs.add("2030-05-05", "Test event", "weekly");
  ok("plannerDocs: add, on (repeats too), remove", L.plannerDocs.on("2030-05-05").some(function (e) { return e.id === eid && e.repeat === "weekly"; }) &&
    L.plannerDocs.on("2030-05-12").some(function (e) { return e.id === eid; }) && (L.plannerDocs.remove("2030-05-05", eid), !L.plannerDocs.on("2030-05-05").some(function (e) { return e.id === eid; })));
  L.slideDocs.open(sid); await sleep(60);
  ok("slideDocs.open: Slides shows the deck", w.location.hash === "#slides" && /One/.test(d.body.textContent) && /Two/.test(d.body.textContent));
  L.cardDocs.open(cid); await sleep(60);
  ok("cardDocs.open: Flashcards shows the deck", w.location.hash === "#cards" && /alpha front/.test(d.body.textContent) && /gamma front/.test(d.body.textContent));
  L.plannerDocs.open("2030-05-05"); await sleep(60);
  ok("plannerDocs.open: the Planner, on that day", w.location.hash === "#planner" && /2030/.test(d.body.textContent));

  // --- the prompt and the command list ---
  ok("the prompt offers only what the question is about", /MAKE DOC:/.test(act.prompt("Write a letter to my landlord about the leaking roof")) &&
    /MAKE SLIDES:/.test(act.prompt("Make a presentation on composting")) && /MAKE CARDS:/.test(act.prompt("Make flashcards for the times tables")) &&
    /MAKE PLAN:/.test(act.prompt("Put a reminder in my planner to water the seedlings every day")) && act.prompt("What is the capital of Kenya?") === "" &&
    !/MAKE DOC:/.test(act.prompt("Summarise this page for me")));
  var cl = L.suiteCommands ? L.suiteCommands() : null;
  var listed = JSON.stringify(cl || (L.suite && L.suite.commands ? L.suite.commands() : ""));
  ok("the command list says where each MAKE opens", /MAKE DOC[^}]*opens in Writer/.test(listed) && /MAKE SLIDES[^}]*opens in Slides/.test(listed) &&
    /MAKE CARDS[^}]*opens in Flashcards/.test(listed) && /MAKE PLAN[^}]*opens in Planner/.test(listed) && /MAKE SHEET[^}]*opens in Sheets/.test(listed), listed.slice(0, 600));

  // --- Chat: made, shown, opened once ---
  await L.ai.detect();
  go("chat"); await sleep(40);
  function chatAsk(text) { var cin = d.querySelector("input[aria-label=\"Message\"]"); cin.value = text; modelCalls = []; btn(d, "Send").click(); }
  function logText() { return d.querySelector("[aria-label=\"Conversation\"]").textContent; }
  modelReplies = ["Here it is.\n" + blk("DOC", "Water off on Tuesday", ["## What is happening", "The water will be off on Tuesday from 9 to 12 while the pipes are mended.", "- Fill a kettle first", "- Do not run the boiler"])];
  var before = logText().length;
  chatAsk("Write a notice for the tenants that the water is off on Tuesday"); await sleep(250);
  var t = logText().slice(before);
  ok("Chat: the AI was told how to MAKE DOC, and the document is shown", /MAKE DOC:/.test(modelCalls[0].messages[0].content) && /Lantern made a document: Water off on Tuesday/.test(t) &&
    d.querySelector(".la-make h2") && btn(d, "Open in Writer"), t.slice(-400));
  var nW = L.writerDocs.list().length, ob = btn(d, "Open in Writer");
  ob.click(); await sleep(80);
  var wd = L.writerDocs.list().filter(function (x) { return x.title === "Water off on Tuesday"; })[0];
  ok("Open in Writer: a new document with the heading and the list", L.writerDocs.list().length === nW + 1 && w.location.hash === "#writer" && wd &&
    /<h1>Water off on Tuesday<\/h1>/.test(L.writerDocs.get(wd.id).html) && /<li>Fill a kettle first<\/li>/.test(L.writerDocs.get(wd.id).html));
  ob.click(); await sleep(60);
  ok("a second tap opens it again, it does not make another", L.writerDocs.list().length === nW + 1);

  go("chat"); await sleep(40);
  var today = L.today();
  modelReplies = [blk("PLAN", "Compressor upkeep", ["today | Drain the tank | every day", "in 1 week | Check the belt | every month"])];
  before = logText().length;
  chatAsk("Put the compressor upkeep in my planner: drain the tank every day, check the belt monthly from next week"); await sleep(250);
  t = logText().slice(before);
  ok("Chat: a plan is shown with the dates Lantern worked out", /Lantern made a plan: Compressor upkeep/.test(t) && t.indexOf(today) >= 0 && /every month/.test(t), t.slice(-400));
  var ab = btn(d, "Add to Planner");
  ab.click(); await sleep(80);
  var onToday = L.plannerDocs.on(today).filter(function (e) { return e.text === "Drain the tank"; });
  ok("Add to Planner: the entries are in the Planner, the Planner is open", w.location.hash === "#planner" && onToday.length === 1 && onToday[0].repeat === "daily" &&
    L.plannerDocs.on(L.aiPlan.when("in 1 week", today)).some(function (e) { return e.text === "Check the belt" && e.repeat === "monthly"; }));
  ab.click(); await sleep(60);
  ok("a second tap adds nothing twice", L.plannerDocs.on(today).filter(function (e) { return e.text === "Drain the tank"; }).length === 1);

  go("chat"); await sleep(40);
  modelReplies = [blk("CARDS", "Units", ["Length | metre", "Length | metre again"]),
    function (body) { var last = body.messages[body.messages.length - 1].content;
      return /there twice/.test(last) ? blk("CARDS", "Units", ["Length | metre", "Mass | kilogram", "Time | second"]) : "?"; }];
  before = logText().length;
  chatAsk("Make flashcards for the SI units"); await sleep(250);
  t = logText().slice(before);
  ok("Chat: a deck with a card twice goes back once; the fixed deck is shown", modelCalls.length === 2 && /Lantern made flashcards: Units \u2014 3 cards/.test(t), t.slice(-400));
  var nC = L.cardDocs.list().length;
  btn(d, "Open in Flashcards").click(); await sleep(80);
  ok("Open in Flashcards: a new deck, opened", L.cardDocs.list().length === nC + 1 && w.location.hash === "#cards" && /Mass/.test(d.body.textContent) && /kilogram/.test(d.body.textContent));

  go("chat"); await sleep(40);
  modelReplies = [blk("SLIDES", "Composting", ["# Composting", "# Greens and browns", "- Greens: peelings, grass", "- Browns: leaves, card"])];
  before = logText().length;
  chatAsk("Make a presentation on composting"); await sleep(250);
  var nS = L.slideDocs.list().length;
  btn(d, "Open in Slides").click(); await sleep(80);
  ok("Open in Slides: the deck, opened", L.slideDocs.list().length === nS + 1 && w.location.hash === "#slides" && /Greens and browns/.test(d.body.textContent));

  // --- READ: the AI asks for another part of the document ---
  var TR = L.textReader, cmd = TR.readCommand, read = [];
  ok("READ is a Chat command", cmd && (L.chatCommands || []).indexOf(cmd) >= 0 && /READ: page <n>/.test(cmd.usage));
  ok("READ is not offered with no document", cmd.test("READ: page 7") === null);
  var txt = { 3: "Section 1. Lift the machine with two people.", 7: "Section 2. Set the guard gap to 6 mm before use.", 9: "Section 2. Tighten the head bolts to 25 Nm in a cross pattern.", 12: "Section 3. The warranty runs for 2 years from the date of purchase." };
  var DOC = { id: "t", title: "Saw manual", per: 5, pages: [] };
  for (i = 1; i <= 12; i++) DOC.pages.push({ n: i, text: i <= 5 ? (txt[i] || "Page " + i + " of the saw manual, general notes.") : "", conf: 1, done: i <= 5, own: true });
  var realRead = TR.docs.readSection;
  TR.docs.readSection = async function (doc, k) {
    read.push(k);
    doc.pages.slice(k * doc.per, (k + 1) * doc.per).forEach(function (p) { p.text = txt[p.n] || "Page " + p.n + " of the saw manual, general notes."; p.done = true; });
  };
  TR.attached = DOC;
  ok("READ: the reply line is read; a READ: deep in a long answer is not", cmd.test("READ: page 7") === "page 7" && cmd.test("**READ:** pages 6-8") === "pages 6-8" &&
    cmd.test(new Array(60).join("words ") + "\nREAD: page 3") === null && cmd.test("Not on these pages.\nREAD: section 2") === "section 2");
  var sys = (L.chatSystem || []).map(function (f) { try { return f("q") || ""; } catch (e) { return ""; } }).join("\n");
  ok("Chat's instructions say a document is attached, what has been read, and how to READ", /DOCUMENT ATTACHED: \u201cSaw manual\u201d, 12 pages in sections of 5 \(read so far: pages 1\u20135\)/.test(sys) && /READ: page <n>/.test(sys), sys.slice(0, 400));
  var r1 = await cmd.run("page 9", "What torque for the head bolts?", {});
  ok("READ: page 9 reads its section first, then sends page 9", read.join() === "1" && r1.sources.length && r1.sources.every(function (s) { return s.page === 9; }) &&
    /25 Nm/.test(r1.prompt) && /QUESTION: What torque/.test(r1.prompt) && /page 9/.test(r1.note) && r1.how === "document", r1);
  var r2 = await cmd.run("the last page", "Warranty?", {});
  ok("READ: the last page is page 12", read.join() === "1,2" && r2.sources.every(function (s) { return s.page === 12; }) && /2 years/.test(r2.prompt));
  var r3 = await cmd.run("page 40", "x", {});
  ok("READ: a page past the end is said so", !r3.sources && /12 pages/.test(r3.note) && /from 1 to 12/.test(r3.prompt));
  var r4 = await cmd.run("guard gap", "How wide is the guard gap?", {});
  ok("READ: words are found in what has been read", r4.sources && r4.sources[0].page === 7 && /6 mm/.test(r4.prompt));
  var r5 = await cmd.run("carburettor float", "x", {});
  ok("READ: nothing found says so, and the pages read", !r5.sources && /found nothing/.test(r5.prompt) && /1\u201312 of 12/.test(r5.prompt), r5);

  // in a conversation: the answer is in a section not read yet
  DOC.pages.forEach(function (p) { if (p.n > 5) { p.done = false; p.text = ""; } });
  read = [];
  var calls = [];
  var conv = await L.CHAT.converse(["What torque should the head bolts be tightened to?"], { call: function (m) {
    calls.push(m);
    var last = String(m[m.length - 1].content);
    if (calls.length === 1) return Promise.resolve("READ: head bolts");
    if (/READ found nothing/.test(last)) return Promise.resolve("READ: section 2");
    var n = (/\[(\d)\] Saw manual, page 9/.exec(last) || [])[1];
    return Promise.resolve(n ? "ANSWER: 25 Nm, in a cross pattern [" + n + "].\nQUOTE [" + n + "]: Section 2. Tighten the head bolts to 25 Nm in a cross pattern." : "ANSWER: Not in the document.");
  } });
  var turn = conv.turns[0];
  ok("Chat: READ words, then READ a section; the answer is checked against page 9", calls.length === 3 && read.join() === "1" &&
    (turn.commands || []).map(function (c) { return c.verb + ": " + c.arg; }).join(" | ") === "READ: head bolts | READ: section 2" &&
    /25 Nm/.test(turn.final) && turn.searches.some(function (s) { return s.how === "document"; }) && !turn.declined, { calls: calls.length, read: read, commands: turn.commands, final: turn.final, searches: turn.searches });
  ok("Chat's instructions carried READ with the first question", /DOCUMENT ATTACHED[^\n]*READ: page <n>/.test(L.CHAT.buildSystem(turn.q || "What torque?")));
  TR.docs.readSection = realRead; TR.attached = null;

  // --- the bench ---
  var Q = L.aiBenchQuestions;
  function gradeIdeal(id) { var item = Q.filter(function (q) { return q.id === id; })[0]; return L.aiBench.grade(item, item.ideal, { made: act.build(item.ideal, item.q) }); }
  ["make-doc-oil-change", "make-slides-ladder", "make-cards-si-units", "make-plan-compressor"].forEach(function (id) {
    var g = gradeIdeal(id);
    ok("bench: the ideal reply passes " + id, g.pass, g.why);
  });
  function gradeWith(id, reply) { var item = Q.filter(function (q) { return q.id === id; })[0]; return L.aiBench.grade(item, reply, { made: act.build(reply, item.q) }); }
  ok("bench: a plan with the belt check a day late fails, and says so", /starts 8 days after today, not 7/.test(gradeWith("make-plan-compressor",
    blk("PLAN", "p", ["today | Drain the tank | every day", "in 8 days | Check the drive belt | every month", "in 3 months | Change the oil | once"])).why));
  ok("bench: flashcards missing a unit fail", /missing candela/.test(gradeWith("make-cards-si-units", blk("CARDS", "u", ["Length | metre", "Mass | kilogram", "Time | second", "Current | ampere", "Temperature | kelvin", "Amount | mole"])).why));
  ok("bench: slides as a document fail", /not slides/.test(gradeWith("make-slides-ladder", blk("DOC", "Ladders", ["## Ladders", "Use three points of contact on every ladder you climb, every time."])).why));
  var rq = Q.filter(function (q) { return q.id === "doc-read-another-page"; })[0];
  ok("bench: the READ conversation fails without a READ", rq && /did not ask to READ/.test(rq.check([{ final: "ANSWER: 2 years", commands: [] }])) &&
    rq.check([{ final: "The warranty runs for 2 years [1].", commands: [{ verb: "READ", arg: "page 5" }] }]) === "");
  // --- 1.12.2: Adam's conversation -- a scanned page attached, then "turn
  // this into a PDF with corrections" ---
  ["can you turn this into a PDF with corrections for what the words probably are since the ocr reader did not get them all perfectly",
    "Lantern has a writing module can you rewrite the text in it with corrections for what you believe the words should be?",
    "Write the following in the text writer in Lantern: 2.Pressing the key of l@2 once"].forEach(function (q) {
    ok("offered MAKE DOC: " + q.slice(0, 40), act.relevant(q).some(function (a) { return a.id === "doc"; }));
  });
  ok("...but not a question about a PDF", !act.relevant("What does the PDF say about the oil?").length);
  var para = function (k) { return "Paragraph " + k + ". " + new Array(14).join("Press the key of 10-2 once and the indicating LED will light up. "); };
  var scan = { id: "s", title: "Screenshot 2026-10-22 083921", per: 10, pages: [{ n: 1, done: true, conf: 0.9, text: [1, 2, 3, 4, 5].map(para).join("\n\n") }] };
  var nChunks = TR.docs.chunks(scan).length;
  TR.attached = scan;
  var seen = [];
  var cv2 = await L.CHAT.converse(["can you turn this into a PDF with corrections for what the words probably are since the ocr reader did not get them all perfectly"], { call: function (m) {
    var last = String(m[m.length - 1].content); seen.push(last);
    return Promise.resolve(/wants something made from this document/.test(last) ? blk("DOC", "Feed keys", ["## Down-feed", "Press the key of 10-2 once and the indicating LED will light up.", "Paragraph two of the corrected text, written out in full here."]) : "ANSWER: Not in the document.");
  } });
  var t0 = cv2.turns[0];
  ok("with a document attached, a request to make something gets the whole text and the MAKE instructions", seen.length === 1 && /wants something made from this document/.test(seen[0]) &&
    (seen[0].match(/\n\[\d+\] /g) || []).length === nChunks && nChunks > 3 && /MAKE DOC:/.test(L.CHAT.buildSystem(t0.q || "can you turn this into a PDF")) && !/Not in the document/.test(seen[0]), { n: seen.length, chunks: nChunks, head: (seen[0] || "").slice(-700) });
  ok("...and the document is made, with Save .pdf beside Open in Writer", t0.made && t0.made.ok && t0.made.action.id === "doc" && t0.made.extra && t0.made.extra[0].label === "Save .pdf", t0.made && t0.made.problems);
  var fq = "can you request the full text from lantern or just the 3 passages?", p3 = TR.docs.passages(scan, fq, 3);
  ok("\u201cthe full text\u201d is a question about the document, and READ: all is offered", TR.itselfAsk.test(fq) && /READ: all/.test(TR.docPrompt(scan, fq, p3, true)) && p3.length < nChunks);
  var ra = await TR.readCommand.run("all", fq, {});
  ok("READ: all sends the whole page", ra.sources && ra.sources.length === nChunks, ra.sources && ra.sources.length);
  var gr = L.libraryGround("Yes, I have the page Text Reader read: it is part of a grinder manual [1]. The page covers the feed keys [1].", [{ n: 1, text: "Press the key of 10-2 once." }], "Can you see the text?");
  ok("a sentence about the document as a whole is not a false citation", !gr.wrong.length && !gr.problems.length, gr);
  TR.attached = null;

  // --- 1.12.2: PDF straight from a document ---
  ok("Writer has a Save .pdf tool", (L.writerTools || []).some(function (t) { return t.label === "Save .pdf"; }));
  var html = "<h1>Feed keys</h1><p>Plain <b>bold</b> <i>italic</i> \u201cquoted\u201d 25 \u00b0C, 10 \u03a9.</p><ul><li>One<ul><li>One point one</li></ul></li></ul><ol><li>First</li></ol>" +
    "<table><tr><th>Part</th><th>Torque</th></tr><tr><td>Head bolt</td><td>25 Nm</td></tr></table>";
  for (i = 0; i < 40; i++) html += "<p>" + new Array(10).join("The wheel head will rise when the auto down-feed circle has finished. ") + "</p>";
  var pdf = L.pdf.fromHtml("Feed keys", html);
  var bin = await new Promise(function (res) { var fr = new w.FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsBinaryString(pdf); });
  var xr = /startxref\n(\d+)/.exec(bin), offs = [], xm, xre = /^(\d{10}) 00000 n $/gm;
  while ((xm = xre.exec(bin))) offs.push(+xm[1]);
  ok("PDF: a valid file -- header, every object where the table says, one page object per page", /^%PDF-1\.4/.test(bin) && xr && bin.slice(+xr[1], +xr[1] + 4) === "xref" &&
    offs.every(function (o, k) { return bin.slice(o, o + String(k + 1).length + 6) === (k + 1) + " 0 obj"; }) && (bin.match(/\/Type \/Page /g) || []).length === pdf.pageCount && pdf.pageCount >= 3, { pages: pdf.pageCount, offs: offs.length });
  ok("PDF: bold and italic fonts, a bullet, ruled table cells, page numbers, Ohm written out", /\/F2 /.test(bin) && /\/F3 /.test(bin) && /\(\\225\)/.test(bin) && / re S/.test(bin) &&
    /\(Page 1 of \d\)/.test(bin) && /\\223quoted\\224 25 \\260C, 10 Ohm\./.test(bin));
  // --- 1.12.3: Adam's next Chat -- a picture, "make a corrected pdf of it",
  // then "proceed with creating a document using the Writer module" ---
  ["fix the image and make a corrected pdf of it", "The write module in lantern should be able to save as a pdf.",
    "proceed with creating a document using the Writer module"].forEach(function (q) {
    ok("offered MAKE DOC: " + q.slice(0, 40), act.relevant(q).some(function (a) { return a.id === "doc"; }));
  });
  ok("the MAKE DOC instructions say it is how to make a PDF, and to use it rather than LESSON", /Save \.pdf: this is how you make a Writer document or a PDF/.test(act.prompt("write a letter to my landlord")) &&
    /not LESSON/.test(act.prompt("write a letter to my landlord")));
  var sysGo = L.CHAT.buildSystem("yes, go ahead"), sysDoc = L.CHAT.buildSystem("write a letter to my landlord");
  ok("a follow-up that names nothing still hears what Lantern can make, and how to ask (MAKE: document)", /Lantern can also MAKE a schematic/.test(sysGo) && /reply only MAKE: <document/.test(sysGo) &&
    !/reply only MAKE: <document/.test(sysDoc) && /MAKE DOC:/.test(sysDoc));
  var KO = L.aiMakeAsk.kindOf;
  ok("MAKE: <kind> in everyday words", KO("document").id === "doc" && KO("a PDF").id === "doc" && KO("presentation").id === "slides" && KO("flashcards").id === "cards" &&
    KO("schedule").id === "plan" && KO("picture").id === "drawing" && KO("circuit").id === "schematic" && KO("table").id === "sheet" && KO("sculpture") === null);
  var said2 = [];
  var cv3 = await L.CHAT.converse(["What should a notice about the water being off on Tuesday say?", "yes, go ahead"], { call: function (m) {
    var last = String(m[m.length - 1].content); said2.push(last);
    if (/Make it now/.test(last) && /MAKE DOC:/.test(last)) return Promise.resolve(blk("DOC", "Water off on Tuesday", ["## What is happening", "The water will be off on Tuesday from 9 to 12 while the pipes are mended.", "- Fill a kettle first"]));
    if (/go ahead/.test(last)) return Promise.resolve("MAKE: document");
    return Promise.resolve("Say when the water is off, why, and what to do before then.");
  } });
  var t2 = cv3.turns[1];
  ok("Chat: \u201cgo ahead\u201d -> MAKE: document -> the format -> the document, with Save .pdf", (t2.commands || []).some(function (c) { return c.verb === "MAKE" && /document/.test(c.arg); }) &&
    t2.made && t2.made.ok && t2.made.action.id === "doc" && t2.made.extra[0].label === "Save .pdf", { commands: t2.commands, made: t2.made && t2.made.problems, said: said2.slice(-2) });
  ok("the command list says a document can be saved as a PDF", /MAKE DOC[^}]*Save \.pdf makes a PDF/.test(JSON.stringify(L.suite.commands())));
  ok("no errors after all that", errs.length === 0, errs);

  console.log(fails ? fails + " MAKE DOCS FAILURES (" + passes + " passed)" : "ALL MAKE DOCS TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
