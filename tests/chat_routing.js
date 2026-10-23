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
  Kenya: "Kenya is a country in East Africa. Kenya's capital and largest city is Nairobi.",
  Raspberry_Pi_400: "The Raspberry Pi 400 (2020) is a single-board computer built into a compact keyboard. It runs Raspberry Pi OS by default."
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
  // a how-to the encyclopedia does not cover: answered from its own knowledge, said (1.12.9)
  if (/date and time on a Raspberry Pi from the terminal/.test(last)) return "The library has nothing on this.\nFrom my own knowledge: run sudo date -s \x272026-10-23 12:00:00\x27, " +
    "or sudo timedatectl set-time \x272026-10-23 12:00:00\x27; with internet the Pi sets its clock by itself.";
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
  ok("nine conversations in the bench (1.12.9: a how-to answered from the AI's own knowledge), one quick, five about a document and four about Lantern itself", Q.filter(function (x) { return !x.doc && !/^suite-/.test(x.id); }).length === 9 &&
    Q.filter(function (x) { return x.quick; }).length === 1 && Q.filter(function (x) { return x.doc; }).length === 5 && Q.filter(function (x) { return /^suite-/.test(x.id); }).length === 4);
  var rep = await L.aiBench.run({ quick: false, skip: ["tool", "multi", "need", "unknown", "safety", "fact", "make", "reason", "alone"] });
  var failed = rep.rows.filter(function (r) { return !r.pass; }).map(function (r) { return r.id + ": " + r.why; });
  ok("a model that behaves well passes every conversation", rep.rows.length === 18 && !failed.length && rep.summary.chat.pass === 18, failed);
  ok("document conversations: the bench handed Chat the manual, and took it back", rep.rows.filter(function (r) { return /^doc-/.test(r.id); }).every(function (r) { return r.chat.some(function (t) { return t.searches.some(function (s) { return s.how === "document"; }); }) || r.id === "doc-not-covered"; }) &&
    !(L.textReader && L.textReader.attached));
  ok("rows record each turn's searches", rep.rows.filter(function (r) { return r.id === "chat-follow-up-search"; })[0].chat[1].searches[0].how === "asked");
  // the 1.9.4 behaviour, replayed: searching the literal follow-up fails
  var lit = Q.filter(function (x) { return x.id === "chat-follow-up-search"; })[0];
  ok("the check catches a search without the conversation's subject", /without the conversation/.test(lit.check([{}, { searches: [{ query: "trained", how: "read-first" }], declined: false, backed: 1 }])));
  var self1 = Q.filter(function (x) { return x.id === "chat-is-this-how-you-work"; })[0];
  ok("the check catches the transcript's turn 2 (searched, then declined)", /searched the library/.test(self1.check([{}, { searches: [{ query: "Is this how you work?", how: "quotes" }], declined: true, final: "Not in my library." }])));
  // --- 1.12.9: the AI answers from its own knowledge, and says so -----------
  // (Adam's Chat: an AccelStepper + TMC2209 example and setting the clock on
  // a Raspberry Pi 400 were refused -- "my rules strictly require that all
  // facts come only from the library" -- though the model knew both)
  var OWN = L.chatOwn, sys9 = C.buildSystem("How do I set the date and time on a rpi400");
  ok("the instructions: Lantern first, then the AI's own knowledge, said with “From my own knowledge:”", !!OWN && /Use Lantern first/.test(sys9) &&
    /still help: answer from your own knowledge/.test(sys9) && /“From my own knowledge:”/.test(sys9) && !/never type data from memory/.test(sys9) &&
    /Answer from them, with \[n\]/.test(sys9) && /then answer from your own knowledge as above/.test(sys9) && /only for what no one could know offline/.test(sys9), sys9.slice(0, 1600));
  var sent9 = [], turn9 = [];
  script = function (last, body) {
    sent9.push(body.messages.map(function (m) { return typeof m.content === "string" ? m.content : ""; }).join("\n----\n"));
    if (/LIBRARY: passages/.test(last)) return "The passages say the Raspberry Pi 400 runs Raspberry Pi OS [1], but not how to set its clock.\nANSWER: Not in my library.\n" +
      "From my own knowledge: open a terminal and run sudo date -s \x272026-10-23 12:00:00\x27, or use sudo timedatectl set-time; with internet it sets itself by NTP. " +
      "The Pi 400 has no battery-backed clock, so it forgets the time when it is off.";
    if (/rpi400/i.test(last)) return "LOOKUP: Raspberry Pi 400 date time setup";
    return "ANSWER: Not in my library.";
  };
  var r9 = await C.turn(turn9, "How do I set the date and time on a rpi400", {}, {});
  var libMsg = sent9.filter(function (x) { return /LIBRARY: passages/.test(x); })[0] || "";
  ok("the library's “then: Not in my library” reaches the AI as “say so, then your own knowledge, said”", /Not in my library\. -- then, if you know the answer, give it anyway, starting with the words “From my own knowledge:”/.test(libMsg) &&
    !/reply exactly: ANSWER: Not in my library/.test(libMsg), libMsg.slice(-700));
  ok("the Pi 400 clock: library first, then the AI's own answer, not counted as a refusal", r9.searches.length === 1 && r9.own === true && r9.declined === false &&
    /sudo date -s/.test(r9.final), { s: r9.searches, own: r9.own, d: r9.declined });
  ok("Lantern labels it: from the AI's own knowledge, not checked", r9.notes.some(function (n) { return /^◦ From the AI’s own knowledge: the part after “From my own knowledge” did not come from Lantern’s library or tools/.test(n); }), r9.notes);
  // the library has nothing at all: the AI is told to answer from what it knows
  var sent9b = [];
  script = function (last, body) {
    sent9b.push(last);
    if (/has nothing on that/.test(last)) return "From my own knowledge: wire STEP to pin 3 and DIR to pin 2, then\n#include <AccelStepper.h>\nAccelStepper stepper(AccelStepper::DRIVER, 3, 2);\nvoid setup() { stepper.setMaxSpeed(1000); stepper.setAcceleration(500); stepper.moveTo(3200); }\nvoid loop() { stepper.run(); }";
    if (/AccelStepper/i.test(last)) return "LOOKUP: AccelStepper TMC2209 example";
    return "ANSWER: Not in my library.";
  };
  var r9b = await C.turn([], "Write an Arduino AccelStepper example for a TMC2209 driver", {}, {});
  ok("nothing in the library: the AI is asked for its own knowledge, and gives the code, labelled", sent9b.some(function (x) { return /has nothing on that\. Answer from your own knowledge, starting with the words “From my own knowledge:”/.test(x); }) &&
    r9b.own && !r9b.declined && /AccelStepper stepper/.test(r9b.final) && r9b.notes.some(function (n) { return /From the AI’s own knowledge/.test(n); }), { sent: sent9b, notes: r9b.notes });
  // an answer from its own knowledge that does not say so is labelled anyway
  script = function () { return "Use a TMC2209 in step/dir mode: STEP and DIR from the Arduino, EN low to enable, set the current with the Vref pot, and keep motor power off while wiring."; };
  var r9c = await C.turn([], "How do I wire a TMC2209 to an Arduino Uno?", {}, {});
  ok("unlabelled, but no library and no tools behind it: Lantern labels it as the AI's own knowledge", !r9c.own && r9c.searches.length === 0 &&
    r9c.notes.some(function (n) { return /this answer used neither Lantern’s library nor its tools/.test(n); }), r9c.notes);
  // what no one could know offline is still declined, with no own-knowledge note
  script = function () { return "ANSWER: Not in my library."; };
  var r9d = await C.turn([], "Who is the mayor of my town right now?", {}, {});
  ok("the mayor of my town: still Not in my library, no label", r9d.declined && !r9d.own && !r9d.notes.some(function (n) { return /own knowledge/.test(n); }), r9d.notes);
  // a general fact it knows, used in = lines and said: not questioned; a value
  // only the person knows: still asked for
  var asked9 = [];
  script = function (last) {
    asked9.push(last);
    if (/Lantern questioned that/.test(last)) return "NEED: How many amp-hours is your battery?";
    if (/steel plate/.test(last)) return "=2*1.5*0.01*7850\nANSWER: The plate weighs about {result} kg. From my own knowledge: steel is about 7850 kg per cubic metre.";
    if (/my battery/.test(last)) return "=75*12.8/60\nANSWER: About {result} hours. From my own knowledge: a typical battery is 75 Ah at 12.8 V.";
    return "ANSWER: ok";
  };
  var r9e = await C.turn([], "How much does a steel plate 2 m by 1.5 m by 10 mm weigh?", {}, {});
  ok("a general fact it knows (steel's density), said: computed, not questioned, labelled", Math.abs(r9e.value - 235.5) < 1e-9 && !asked9.some(function (x) { return /Lantern questioned that/.test(x); }) &&
    r9e.notes.some(function (n) { return /From the AI’s own knowledge/.test(n); }) && !r9e.notes.some(function (n) { return /computed nothing/.test(n); }), { v: r9e.value, notes: r9e.notes });
  asked9 = [];
  var r9f = await C.turn([], "How long will my battery last running a 60 W lamp?", {}, {});
  var q9 = asked9.filter(function (x) { return /Lantern questioned that/.test(x); })[0] || "";
  ok("a value only the person knows (their battery) is still questioned, with the person/general choice spelled out", /the formula uses 75, 12\.8/.test(q9) &&
    /when only the person knows it \x28their tank, their battery\x29, reply NEED/.test(q9) && /NEED/.test(r9f.final), q9);
  ok("the library check: an answer from the AI's own knowledge claims nothing from the passages", L.libraryVerify("ANSWER: From my own knowledge: it is 42.", [{ n: 1, text: "x" }], "q").declined &&
    L.libraryGround("Not in my library. From my own knowledge: it runs Linux.", [{ n: 1, text: "x" }], "q").declined);
  script = function () { return "ANSWER: Not in my library.\nFrom my own knowledge: I am a language model working inside Lantern."; };
  var r9g = await C.turn([], "Is this how you work?", {}, {});
  ok("a question about the AI itself: one note, not two", r9g.notes.filter(function (n) { return /own (knowledge|reasoning)/.test(n); }).length <= 1, r9g.notes);
  var ap = A.buildPrompt ? A.buildPrompt("Who won the last election?") : "";
  ok("Assist, the calculator-style app, keeps its strict rules", !ap || (/reply exactly: ANSWER: Not in my library/.test(ap) && !/From my own knowledge/.test(ap)), ap.slice(0, 300));
  var notes9 = [];
  script = function () { return "From my own knowledge: hold the power button for 5 seconds to reset it."; };
  await C.turn([], "How do I reset a Raspberry Pi 400 keyboard?", { note: function (t, c) { notes9.push(c + "|" + t); } }, {});
  ok("in Chat the label has its own look (class la-own)", notes9.some(function (x) { return /^la-own\|/.test(x); }) && !!d.getElementById("la-own-style"), notes9);
  // code in fences shows in a fixed-width font, without the fence lines
  script = function () { return "From my own knowledge:\n\x60\x60\x60cpp\nvoid loop() { stepper.run(); }\n\x60\x60\x60"; };
  go("chat"); await sleep(40);
  var qin = d.querySelector("input[aria-label='Message']"), logEl = d.querySelector("[aria-label='Conversation']");
  qin.value = "Show the AccelStepper loop"; btn(d, "Send").click(); await sleep(300);
  var codes = Array.prototype.map.call(logEl.querySelectorAll("code"), function (c) { return c.textContent; });
  ok("Chat shows fenced code in a fixed-width font, without the fence lines", codes.indexOf("void loop() { stepper.run(); }") >= 0 && !/\x60\x60\x60/.test(logEl.textContent) &&
    !!logEl.querySelector(".la-own"), { codes: codes, text: logEl.textContent.slice(-300) });
  script = null;
  ok("no errors", errs.length === 0, errs);
  console.log(fails ? fails + " CHAT ROUTING FAILURES (" + passes + " passed)" : "ALL CHAT ROUTING TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
