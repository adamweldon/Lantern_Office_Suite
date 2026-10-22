// chat_routing.js -- which questions Chat sends to the library, and how
// (1.9.6, from a 35B Chat transcript): follow-ups get the AI's own search
// words; questions about the AI, Lantern or the chat are answered from its
// reasoning; "without regard to the library" is obeyed; quotes from earlier
// passages count as real; sentences that describe the passages are not
// citations; recipe hints only with numbers; Chat without the page
// (C.converse) and the bench's conversation set. Stand-in kiwix-serve with
// the articles the transcript met, and a scripted model.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var BOOK = "wikipedia_en_all_mini_2026-09";
var ART = {
  Large_language_model: "A large language model (LLM) is an AI model (typically a neural network) trained on a vast amount of text for natural language processing tasks, especially language generation. The largest and most capable LLMs are generative pre-trained transformers (GPTs), which are pre-trained to predict the next word in a sequence and then fine-tuned to follow instructions.",
  Language_model: "A language model is a model of the human brain's ability to produce natural language. Language models predict sequences of words; large language models, based on transformers, are the most advanced form.",
  Training_of_large_language_models: "Large language models are trained in two stages. Pre-training on a large corpus of text teaches the model to predict the next token; fine-tuning on smaller curated data and reinforcement learning from human feedback then shape how it answers.",
  Agent_harness: "An agent harness, also known as agent scaffolding, is the software infrastructure surrounding a large language model (LLM) that enables it to operate as an AI agent.",
  Work_It_Out: "\"Work It Out\", a song by TJ Davis for Sonic R, released as a single in 1997 and played in the game's menus.",
  Womens_work: "Women's work is a field of labour assumed to be solely the realm of women and associated with specific stereotypical jobs considered as uniquely feminine.",
  Without: "\"Without\", a song by Jack Savoretti from the album Between the Minds, 2007; also an episode of The X-Files.",
  Kenya: "Kenya is a country in East Africa. Kenya's capital and largest city is Nairobi."
};
var A_ = {};
Object.keys(ART).forEach(function (k) {
  var t = k.replace(/_/g, " ");
  A_[k] = { title: t, text: (t + " " + ART[k]).toLowerCase(), html: "<html><head><title>" + t + "</title></head><body><div id=\"mw-content-text\"><p>" + ART[k] + "</p></div></body></html>" };
});
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
var libCalls = [], modelCalls = [], script = null;
function resp(status, body, type) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
w.fetch = function (url, opts) {
  url = String(url);
  var u = new w.URL(url);
  if (u.port === "8081") {
    libCalls.push(url);
    if (u.pathname === "/catalog/v2/entries") return resp(200, "<feed><entry><title>Wikipedia</title><name>wikipedia_en_all</name><flavour>mini</flavour><tags>_ftindex:yes</tags>" +
      "<articleCount>6900000</articleCount><link type=\"text/html\" href=\"/content/" + BOOK + "\" /></entry></feed>", "application/atom+xml");
    if (u.pathname === "/search") {
      var words = (u.searchParams.get("pattern") || "").toLowerCase().split(/\s+/).filter(Boolean);
      var hits = Object.keys(A_).filter(function (k) { return words.every(function (x) { return A_[k].text.indexOf(x) >= 0; }); });
      return resp(200, "<rss><channel>" + hits.slice(0, +u.searchParams.get("pageLength") || 25).map(function (k) {
        return "<item><title>" + esc(A_[k].title) + "</title><link>/content/" + BOOK + "/" + k + "</link><description>x</description></item>"; }).join("") + "</channel></rss>", "application/rss+xml");
    }
    if (u.pathname === "/suggest") {
      var term = (u.searchParams.get("term") || "").toLowerCase();
      return resp(200, JSON.stringify(Object.keys(A_).filter(function (k) { return A_[k].title.toLowerCase().indexOf(term) === 0; })
        .map(function (k) { return { value: A_[k].title, label: A_[k].title, kind: "path", path: k }; })), "application/json");
    }
    var m = /^\/raw\/[^\/]+\/content\/(.+)$/.exec(decodeURIComponent(u.pathname));
    if (m && A_[m[1]]) return resp(200, A_[m[1]].html, "text/html");
    return resp(404, "nf", "text/html");
  }
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf" }] }), "application/json");
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var last = body.messages[body.messages.length - 1].content;
  var r = script ? script(String(last), body) : "ANSWER: ok";
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function firstPassageSentence(t) { var m = /\[1\] [^\n]*\n([^\n]+)/.exec(t); return m ? m[1].split(/\.\s/)[0] + "." : ""; }

// A model that behaves well: answers from passages with [n], writes search
// words when asked, answers questions about itself plainly.
function good(last) {
  if (/reply with ONLY one line: LOOKUP/.test(last)) {
    if (/how are they trained/i.test(last)) return "LOOKUP: large language model training";
    if (/how is reasoning possible/i.test(last)) return "LOOKUP: large language model reasoning";
    return "LOOKUP: none";
  }
  if (/DOCUMENT: passages/.test(last)) {   // quotes the manual's sentence for the question, else declines
    var Qd = [[/oil be changed/, "Change the compressor oil every 500 hours with ISO VG 100 oil; the sump holds 1.8 litres."],
      [/E-11/, "E-11: discharge temperature above 110 degrees C; clean the cooling fins and check the room ventilation."],
      [/E-17/, "E-17: motor overload; check the supply voltage and the belt tension."],
      [/belt deflect/, "Check the drive belt tension monthly: it should deflect 10 to 15 mm at the middle of its longest span."],
      [/guarantee/, "The warranty runs for 2 years, parts and labour, from the date of purchase."]];
    var qline = (/QUESTION: ([^\n]*)/.exec(last) || [])[1] || "", hit = Qd.filter(function (x) { return x[0].test(qline); })[0];
    if (!hit) return "ANSWER: Not in the document.";
    var blocks = last.split(/\n\[(\d)\] /), nn = 0;
    for (var bi = 1; bi < blocks.length; bi += 2) if (blocks[bi + 1].indexOf(hit[1]) >= 0) nn = +blocks[bi];
    // not in these passages: a longer document's other pages can be asked
    // for (READ, 1.12.0): the contents say the warranty is on page 5
    var np = /The document has (\d+) pages[^\n]*reply only READ:/.exec(last), toc = /(\d) Warranty and service/.exec(last);
    if (hit && !nn && np && toc) return "READ: page " + toc[1];
    return nn ? "ANSWER: " + hit[1].replace(/\.$/, "") + " [" + nn + "].\nQUOTE [" + nn + "]: " + hit[1] : "ANSWER: Not in the document.";
  }
  // Lantern's own catalog and lessons (SUITE_CHAT, 1.11): name the tiles,
  // quote a lesson, ask for one when the question is a how-to in disguise
  if (/LANTERN CATALOG: /.test(last)) return "Yes. Lantern has the Writer, Sheets, Farming, Animals, Health and Repair tiles, with lessons in each.";
  if (/LESSONS: passages/.test(last)) {
    var ls = firstPassageSentence(last);
    return ls.replace(/\.$/, "") + " [1].\nQUOTE [1]: " + ls;
  }
  if (/hens have stopped laying/i.test(last)) return "LESSON: chickens laying eggs";
  if (/LIBRARY: passages/.test(last)) {
    var s = firstPassageSentence(last);
    return s.replace(/\.$/, "") + " [1].\nQUOTE [1]: " + s;
  }
  if (/\(Lantern: this question is about you|\(Lantern: the person asks you to answer from your own knowledge|This is not a library question/.test(last)) {
    if (/what have we discussed/i.test(last)) return "We talked about Kenya: its capital is Nairobi.";
    if (/more or less capable/i.test(last)) return "More capable: Lantern computes the numbers and checks the quotes, so my answers are more reliable with it than without it.";
    if (/next word|next-token/i.test(last)) return "Predicting the next word well requires the model to track facts, steps and goals across a sentence, so a long chain of good next-word predictions can carry out reasoning: each step is conditioned on the steps before it, which is what lets a token predictor write a valid argument.";
    if (/sum that up/i.test(last)) return "Large language models are neural networks trained on vast text to predict the next word.\nQUOTE [1]: A large language model (LLM) is an AI model (typically a neural network) trained on a vast amount of text for natural language processing tasks, especially language generation.";
    return "Partly: I am such a language model, but here I work inside Lantern, which runs my formulas, reads the library for me and checks my quotes.";
  }
  if (/what is the capital of kenya/i.test(last)) return "LOOKUP: Kenya capital";
  if (/sum that up/i.test(last)) return "Large language models are neural networks trained on vast text to predict the next word.\nQUOTE [1]: A large language model (LLM) is an AI model (typically a neural network) trained on a vast amount of text for natural language processing tasks, especially language generation.";
  if (/how many watts/i.test(last)) return "=12*5\nANSWER: {result} W";
  if (/amp-hours/i.test(last)) return "=5*3\nANSWER: {result} Ah";
  return "ANSWER: Not in my library.";
}

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(80);
  var L = w.Lantern, A = L.assist, C = L.CHAT;
  ok("boot clean, library found", errs.length === 0 && L.library.ready(), errs);

  // --- which questions are for the library ---
  var self = ["Is this how you work?", "Based on this, are you more or less capable with Lantern's tools than without them?", "so give a simple binary answer then. Are you more or Less capable?",
    "What have we discussed in this chat so far?", "In the previous answer how is the ability to reason possible?", "How do you decide what to search for?", "Would the answers be less accurate without Lantern?"];
  var notSelf = ["What is the capital of Kenya?", "How does a lantern work?", "How do you convert 5 kg to pounds?", "Can you tell me how vaccines work?", "Do you know the capital of Kenya?",
    "Explain in detail how large language models work."];
  ok("questions about the AI, Lantern or this chat", self.every(A.aboutSelf), self.filter(function (q) { return !A.aboutSelf(q); }));
  ok("...and ones that only use “you”", !notSelf.some(A.aboutSelf), notSelf.filter(A.aboutSelf));
  ok("“without regard to the library” and the like", ["without regard to what is or is not in your library could your provide the same answers without the lantern harness?",
    "without regard to what is missing in the library definitions how is this possible?", "Answer from your own knowledge: what is entropy?", "Don't use the library: why is the sky blue?"].every(A.noLibrary) &&
    !A.noLibrary("What is the library of Alexandria?") && !A.noLibrary("Explain how libraries in Python work"));
  ok("follow-ups that lean on earlier turns", A.dependsOnContext("How are they trained?", true) && A.dependsOnContext("Why?", true) &&
    !A.dependsOnContext("How are they trained?", false) && !A.dependsOnContext("How are large language models trained?", true));

  // --- the transcript, in Chat ---
  await L.ai.detect();
  go("chat"); await sleep(30);
  script = good;
  function chatAsk(text) { var cin = d.querySelector("input[aria-label=\"Message\"]"); cin.value = text; modelCalls = []; libCalls = []; btn(d, "Send").click(); }
  function logText() { return d.querySelector("[aria-label=\"Conversation\"]").textContent; }
  var before = logText().length;
  chatAsk("Explain in detail how large language models work."); await sleep(250);
  var t = logText().slice(before);
  ok("turn 1: read first, answered from the passages", /Lantern read \d passage/.test(t) && /1 of 1 backed/.test(t) && !/\[Recipe hints\]/.test(modelCalls[0].messages[modelCalls[0].messages.length - 1].content), t.slice(0, 600));

  // the 35B's turn-2 reply: a fair answer that reuses turn 1's quote
  script = function (last) {
    if (/Is this how you work/.test(last)) return "No, not exactly: I am such a model, but inside Lantern I use its functions and its library.\n\nQUOTE [1]: A large language model (LLM) is an AI model (typically a neural network) trained on a vast amount of text for natural language processing tasks, especially language generation.";
    return good(last);
  };
  before = logText().length;
  chatAsk("Is this how you work?"); await sleep(250);
  t = logText().slice(before);
  ok("turn 2: a question about itself is not searched, its earlier quote is not taken for an invented one", libCalls.length === 0 &&
    !/searched its offline library/.test(t) && /from passages Lantern read earlier in this chat/.test(t) && !/Not in my library/.test(t) &&
    /this question is about you/.test(modelCalls[0].messages[modelCalls[0].messages.length - 1].content), t.slice(-600));

  script = good;
  before = logText().length;
  chatAsk("How are they trained?"); await sleep(250);
  t = logText().slice(before);
  ok("a follow-up: the AI writes the search words, the library is read with them", /Lantern asked the AI what to look up: .large language model training./.test(t) &&
    /searched for .large language model training./.test(t) && /Training of large language models/.test(t) && /1 of 1 backed/.test(t), t.slice(0, 700));

  // asked about itself, it declines anyway: told once, then answers
  var tries = 0;
  script = function (last) {
    if (/This is not a library question/.test(last)) return "More capable: Lantern computes the numbers and checks the quotes, so my answers are more reliable with it.";
    if (/more or less capable/i.test(last) && tries++ === 0) return "ANSWER: Not in my library.";
    return good(last);
  };
  before = logText().length;
  chatAsk("Based on this, are you more or less capable with Lantern's tools than without them?"); await sleep(250);
  t = logText().slice(before);
  ok("about itself: no search, a decline is turned back once, the answer is marked as its own reasoning", libCalls.length === 0 && modelCalls.length === 2 &&
    /More capable/.test(t) && /Answered from the AI.s own reasoning/.test(t), { calls: modelCalls.length, lib: libCalls.length, t: t.slice(-400) });

  before = logText().length;
  chatAsk("without regard to what is missing in the library definitions how is this possible?"); await sleep(250);
  t = logText().slice(before);
  ok("“without regard to the library”: no reading, no search, an answer", libCalls.length === 0 && !/Lantern read/.test(t) &&
    /answer from your own knowledge and reasoning/.test(modelCalls[0].messages[modelCalls[0].messages.length - 1].content) && !/Not in my library/.test(t), t.slice(-400));

  ok("old passages travel as a note, and the newest message carries no recipe hints", (function () {
    var tr = C.trimHistory([{ role: "user", content: "q\n\nLIBRARY: passages from the offline encyclopedia\nx" }, { role: "assistant", content: "a" },
      { role: "user", content: "z\n\nLIBRARY: passages from the offline encyclopedia\ny" }]);
    return /^q\n\n\[library passages from an earlier question: removed/.test(tr[0].content) && /\ny$/.test(tr[2].content) &&
      !modelCalls.some(function (m) { return /\[Recipe hints\]/.test(JSON.stringify(m.messages[m.messages.length - 1])); });
  })());

  // --- sentences that describe the passages are not citations ---
  var src = [{ n: 1, title: "Without", text: A_.Without.html.replace(/<[^>]+>/g, " ") }, { n: 2, title: "Regard", text: "Regard is a French magazine." }, { n: 3, title: "Agent harness", text: ART.Agent_harness }];
  var g = L.libraryGround("Passage [1] lists various media titles containing the word Without, such as an episode of The X-Files [1]. " +
    "While the concept of an agent harness in passage [3] aligns with your description of Lantern, the passages do not list its functions. " +
    "The provided passages do not cover reasoning in AI.", src, "how is this possible");
  ok("sentence check: passage descriptions and “in passage [3]” are not false citations", !g.wrong.length && g.about.length === 2 && !g.problems.length, g);

  // --- Chat without the page, and the bench's conversation set ---
  var conv = await C.converse(["What is the capital of Kenya?", "What have we discussed so far?"]);
  ok("C.converse runs a conversation with no page", conv.turns.length === 2 && conv.turns[0].searches.length === 1 && conv.turns[1].searches.length === 0 &&
    conv.turns[1].self && /Kenya/.test(conv.text), conv.turns.map(function (x) { return [x.searches, x.self, x.final]; }));
  var Q = L.aiBenchQuestions.filter(function (x) { return x.cat === "chat"; });
  ok("eight conversations in the bench, one quick, five about a document and four about Lantern itself", Q.filter(function (x) { return !x.doc && !/^suite-/.test(x.id); }).length === 8 &&
    Q.filter(function (x) { return x.quick; }).length === 1 && Q.filter(function (x) { return x.doc; }).length === 5 && Q.filter(function (x) { return /^suite-/.test(x.id); }).length === 4);
  var rep = await L.aiBench.run({ quick: false, skip: ["tool", "multi", "need", "unknown", "safety", "fact", "make", "reason", "alone"] });
  var failed = rep.rows.filter(function (r) { return !r.pass; }).map(function (r) { return r.id + ": " + r.why; });
  ok("a model that behaves well passes every conversation", rep.rows.length === 17 && !failed.length && rep.summary.chat.pass === 17, failed);
  ok("document conversations: the bench handed Chat the manual, and took it back", rep.rows.filter(function (r) { return /^doc-/.test(r.id); }).every(function (r) { return r.chat.some(function (t) { return t.searches.some(function (s) { return s.how === "document"; }); }) || r.id === "doc-not-covered"; }) &&
    !(L.textReader && L.textReader.attached));
  ok("rows record each turn's searches", rep.rows.filter(function (r) { return r.id === "chat-follow-up-search"; })[0].chat[1].searches[0].how === "asked");
  // the 1.9.4 behaviour, replayed: searching the literal follow-up fails
  var lit = Q.filter(function (x) { return x.id === "chat-follow-up-search"; })[0];
  ok("the check catches a search without the conversation's subject", /without the conversation/.test(lit.check([{}, { searches: [{ query: "trained", how: "read-first" }], declined: false, backed: 1 }])));
  var self1 = Q.filter(function (x) { return x.id === "chat-is-this-how-you-work"; })[0];
  ok("the check catches the transcript's turn 2 (searched, then declined)", /searched the library/.test(self1.check([{}, { searches: [{ query: "Is this how you work?", how: "quotes" }], declined: true, final: "Not in my library." }])));
  ok("no errors", errs.length === 0, errs);
  console.log(fails ? fails + " CHAT ROUTING FAILURES (" + passes + " passed)" : "ALL CHAT ROUTING TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
