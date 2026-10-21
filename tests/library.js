// library.js -- the offline library (LIBRARY_ENGINE, LIBRARY_CHECKS, the
// reading turn in Assist, Chat and the bench) against a stand-in for
// kiwix-serve built from real kiwix-serve replies (tests/fixtures/kiwix:
// its catalog, its search format, five Wikipedia lead sections), and a
// scripted model. Booted the way the bundle runs (after DOMContentLoaded).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FX = path.join(__dirname, "fixtures", "kiwix"), BOOK = "wikipedia_en_climate_change_mini_2024-06";
var ARTICLES = {};
fs.readdirSync(FX).filter(function (f) { return /\.html$/.test(f); }).forEach(function (f) {
  var html = fs.readFileSync(path.join(FX, f), "utf8"), p = f.replace(/\.html$/, "");
  ARTICLES[p] = { title: p.replace(/_/g, " "), html: html, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase() };
});
// A second book: stand-ins for the articles bench run 5 (35B, English
// Wikipedia mini) failed to reach, next to the decoys its search found.
var BOOK2 = "wikipedia_en_all_mini_2026-09", SYN = {
  "Mount": "Mount or Mt. is a word used in the names of mountains and hills, and for a stand that holds a camera or a lens.",
  "Mount_Everest": "Mount Everest is Earth's highest mountain above sea level, in the Mahalangur Himal sub-range of the Himalayas. Its elevation of 8,849 metres was set in 2020 by the Chinese and Nepali authorities.",
  "1952_Swiss_Mount_Everest_expedition": "The 1952 Swiss Mount Everest expedition was the first serious attempt on the mountain from Nepal. Its climbers reached a height of about 8,595 metres on Mount Everest.",
  "UNIT": "UNIT is a fictional military organisation in a television series; the unit fights alien threats on Earth and is named after its task.",
  "Ohm": "The ohm (symbol \u03a9) is the unit of electrical resistance in the International System of Units. It is named after German physicist Georg Ohm.",
  "Open_Insulin_Project": "The Open Insulin Project is a community of researchers who want to produce insulin cheaply with open protocols for people with diabetes.",
  "Insulin": "Insulin is a peptide hormone produced by beta cells of the pancreatic islets in the pancreas. It regulates the metabolism of carbohydrates, fats and protein.",
  "Electrical_resistivity_and_conductivity": "Electrical resistivity is a property of a material that measures its electrical resistance; electrical conductivity is its reciprocal and measures how well a material conducts current.",
  "Electrically_conducting_yarn": "Electrically conducting yarn is yarn with metal fibres or a metal coating, whose electrical conductivity lets clothes carry signals; the highest grades use silver plating.",
  "Silver": "Silver is a chemical element with the symbol Ag. A soft, white and lustrous transition metal, it has the highest electrical conductivity, thermal conductivity and reflectivity of any metal.",
  "Moon_(disambiguation)": "Moon most commonly refers to the Moon, the natural satellite of Earth, and may also refer to many other things listed on this page.",
  "Moon_landing": "A Moon landing is the arrival of a spacecraft on the surface of the Moon. The first crewed Moon landing was Apollo 11 on 20 July 1969, and the last was in 1972.",
  "Season": "A season is a division of the year based on changes in weather and daylight. Seasons result from Earth's orbit around the Sun and Earth's axial tilt relative to the ecliptic plane.",
  "Causality": "Causality is an influence by which one event or process, a cause, contributes to the production of another, an effect."
};
Object.keys(SYN).forEach(function (k) {
  var t = k.replace(/_/g, " ");
  ARTICLES[BOOK2 + "/" + k] = { book: BOOK2, path: k, title: t, text: (t + " " + SYN[k]).toLowerCase(),
    html: "<html><head><title>" + t + "</title></head><body><div id=\"mw-content-text\"><p>" + SYN[k] + "</p></div></body></html>" };
});
Object.keys(ARTICLES).forEach(function (k) { if (!ARTICLES[k].book) { ARTICLES[k].book = BOOK; ARTICLES[k].path = k; } });
var twoBooks = false;
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };

// --- stand-in kiwix-serve on :8081, and a scripted model on :8080 ---------
var libraryUp = true, libCalls = [], modelReplies = [], modelCalls = [];
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
    if (!libraryUp) return Promise.reject(new TypeError("Failed to fetch"));
    if (u.pathname === "/catalog/v2/entries") {
      var cat = fs.readFileSync(path.join(FX, "catalog.xml"), "utf8");
      if (twoBooks) cat = cat.replace("</feed>", "<entry><title>Wikipedia</title><language>eng</language><name>wikipedia_en_all</name>" +
        "<tags>_ftindex:yes</tags><articleCount>6900000</articleCount><link type=\"text/html\" href=\"/content/" + BOOK2 + "\" /></entry></feed>");
      return resp(200, cat, "application/atom+xml");
    }
    if (u.pathname === "/search") {
      var bn = u.searchParams.get("books.name");
      if (bn !== BOOK && !(twoBooks && bn === BOOK2)) return resp(400, "<error>No such book</error>", "application/xml");
      var words = (u.searchParams.get("pattern") || "").toLowerCase().split(/\s+/).filter(Boolean);
      var hits = Object.keys(ARTICLES).filter(function (k) { return ARTICLES[k].book === bn && words.every(function (wd) { return ARTICLES[k].text.indexOf(wd) >= 0; }); });
      var items = hits.slice(0, +u.searchParams.get("pageLength") || 25).map(function (k) {
        return "<item><title>" + esc(ARTICLES[k].title) + "</title><link>/content/" + bn + "/" + ARTICLES[k].path + "</link><description>..." +
          esc(ARTICLES[k].text.slice(0, 120)) + "...</description><book><title>Climate change by Wikipedia</title></book><wordCount>300</wordCount></item>";
      }).join("");
      return resp(200, "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\"><channel><title>Search</title>" + items + "</channel></rss>", "application/rss+xml");
    }
    if (u.pathname === "/suggest") {
      var term = (u.searchParams.get("term") || "").toLowerCase(), sb = u.searchParams.get("content");
      var sug = Object.keys(ARTICLES).filter(function (k) { return ARTICLES[k].book === sb && ARTICLES[k].title.toLowerCase().indexOf(term) === 0; })
        .map(function (k) { return { value: ARTICLES[k].title, label: ARTICLES[k].title, kind: "path", path: ARTICLES[k].path }; });
      return resp(200, JSON.stringify(sug), "application/json");
    }
    var m = /^\/raw\/([^\/]+)\/content\/(.+)$/.exec(u.pathname);
    if (m && m[1] === BOOK && ARTICLES[m[2]]) return resp(200, ARTICLES[m[2]].html, "text/html");
    if (m && twoBooks && m[1] === BOOK2 && ARTICLES[BOOK2 + "/" + m[2]]) return resp(200, ARTICLES[BOOK2 + "/" + m[2]].html, "text/html");
    return resp(404, "not found", "text/html");
  }
  // the model (same-origin llama-server stand-in)
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "scripted" }] }), "application/json");
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var r = modelReplies.length ? modelReplies.shift() : "ANSWER: Not in my library.";
  if (typeof r === "function") r = r(body);
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 10 } }), "application/json");
};

var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
// The model quotes the first sentence of a passage, as a good model would.
function firstSentence(body, n) {
  var u = body.messages[body.messages.length - 1].content;
  var m = new RegExp("\\[" + n + "\\] [^\\n]*\\n([^\\n]+)").exec(u);
  return m ? m[1].split(/(?<=\.)\s/)[0] : "";
}

(async function () {
  await sleep(10);
  w.eval(js);
  await sleep(60);
  var L = w.Lantern, LIB = L.library, A = L.assist;
  ok("boot clean", errs.length === 0, errs);
  ok("library found on this computer's port 8081", LIB.state.endpoint === "http://127.0.0.1:8081/" && LIB.ready(), LIB.state);
  var b = LIB.state.books[0] || {};
  ok("book read from the catalog", b.id === BOOK && b.articles === 3821 && b.fulltext && /Climate change/.test(b.title), b);
  ok("keywords drop question words", LIB.keywords("What is ocean acidification, and why does it matter?").join(" ") === "ocean acidification matter");
  ok("keywords keep numbers", LIB.keywords("What happened in 1,986 at Chernobyl?").join(" ") === "happened 1986 chernobyl");

  // search and read
  var hits = await LIB.search("What is ocean acidification?", 3);
  ok("search puts the article titled like the question first", hits.length && hits[0].path === "Ocean_acidification" && hits[0].book === BOOK, hits);
  var doc = await LIB.read(hits[0]);
  ok("article read as clean paragraphs", doc.paras.length >= 2 && /^Ocean acidification is/.test(doc.paras[0]) &&
    !doc.paras.some(function (p) { return /\[\d+\]|\{|mw-|background-color/.test(p); }), doc.paras.slice(0, 2));
  var pas = LIB.passage(doc, LIB.keywords("ocean acidification coral"), 900);
  ok("passage: lead first, under the size limit", pas.length <= 902 && pas.indexOf(doc.paras[0].slice(0, 60)) === 0, pas.length);
  var fewer = await LIB.search("methane emissions zzzunknownword", 3);
  ok("search drops words until something is found", fewer.some(function (h) { return h.path === "Methane_emissions"; }), fewer);
  ok("nothing found for nonsense", (await LIB.search("qqqxxyy", 3)).length === 0);
  var lk = await LIB.lookup("What is ocean acidification?", "ocean acidification");
  ok("lookup gives numbered passages and a reading prompt", lk.sources.length >= 1 && lk.sources[0].n === 1 &&
    /^\[1\] Ocean acidification$/m.test(lk.prompt) && /QUOTE \[n\]/.test(lk.prompt) && /QUESTION: What is ocean acidification\?$/.test(lk.prompt) &&
    lk.sources[0].url === "http://127.0.0.1:8081/content/" + BOOK + "/Ocean_acidification", lk.sources.map(function (s) { return s.title; }));

  // citation checks
  var src = lk.sources, s1 = src[0].text.split(/(?<=\.)\s/)[0];
  var V = L.libraryVerify;
  var good = V("ANSWER: It is the ongoing decrease in the pH of the oceans [1].\nQUOTE [1]: " + s1, src);
  ok("verify: a real quote passes", good.ok && good.quotes[0].ok, good);
  var bent = V("ANSWER: The oceans get more acidic [1].\nQUOTE [1]: The oceans are becoming acidic because fish breathe more air every year.", src);
  ok("verify: an invented quote fails", !bent.ok && /QUOTE \[1\] is not in passage 1/.test(bent.problems.join(" ")), bent);
  ok("verify: no citation fails", /cites no passage/.test(V("ANSWER: The oceans get more acidic.", src).problems.join(" ")));
  ok("verify: a quote line is required", /no QUOTE \[1\] line/.test(V("ANSWER: The oceans get more acidic [1].", src).problems.join(" ")));
  ok("verify: a number not in the cited passage fails", /says 47/.test(V("ANSWER: The pH fell by 47 units [1].\nQUOTE [1]: " + s1, src).problems.join(" ")));
  ok("verify: a citation beyond the passages fails", /no passage \[9\]/.test(V("ANSWER: Yes [9].\nQUOTE [9]: something here to quote", src).problems.join(" ")));
  ok("verify: declining is fine", V("ANSWER: Not in my library.", src).declined === true);
  ok("verify: a quote with small changes still counts", V("ANSWER: Yes [1].\nQUOTE [1]: “" + s1.replace(/,/g, "").replace(/\.$/, "") + "”", src).ok);

  // prompt: the LOOKUP rule appears only with a library
  ok("Assist prompt offers LOOKUP when a library is attached", /LOOKUP: <2 to 5 search words>/.test(A.buildPrompt("x", [])) &&
    /neither the functions nor the encyclopedia/.test(A.buildPrompt("x", [])));
  ok("Chat system prompt offers LOOKUP too", /LOOKUP: <2 to 5 search words>/.test(L.CHAT.buildSystem()));

  // A.solve: the reading turn
  function call(m) { return Promise.resolve(modelReplies.shift()(m)); }
  modelReplies = [function () { return "LOOKUP: ocean acidification"; },
    function (m) { return "ANSWER: It is the ongoing decrease in the pH of the oceans [1].\nQUOTE [1]: " + firstSentence({ messages: m }, 1); }];
  var r1 = await A.solve("What is ocean acidification?", { call: call });
  ok("solve: LOOKUP leads to a reading turn and a verified answer", r1.sources && r1.sources.length >= 1 && r1.rounds === 2 && !r1.kind &&
    !r1.flags.length && /\[1\]/.test(r1.parsed.answer) && r1.lookup === "ocean acidification", r1);
  modelReplies = [function () { return "ANSWER: Not in my library."; },
    function (m) { return /LIBRARY:/.test(m[m.length - 1].content) ? "ANSWER: Not in my library." : "?"; }];
  var r2 = await A.solve("Why are methane emissions rising?", { call: call });
  ok("solve: a decline triggers one lookup with the question's words", r2.sources && r2.sources.some(function (s) { return s.title === "Methane emissions"; }) &&
    r2.rounds === 2 && /not in my library/i.test(r2.parsed.answer) && !r2.flags.length, r2.sources && r2.sources.map(function (s) { return s.title; }));
  modelReplies = [function () { return "LOOKUP: ocean acidification"; },
    function () { return "ANSWER: It means the sea turns to vinegar [1].\nQUOTE [1]: The sea turns into vinegar every summer."; },
    function (m) { return /QUOTE \[1\] is not in passage 1/.test(m[m.length - 1].content) ?
      "ANSWER: It is the ongoing decrease in the pH of the oceans [1].\nQUOTE [1]: " + firstSentence({ messages: m.slice(0, 3) }, 1) : "?"; }];
  var r3 = await A.solve("What is ocean acidification?", { call: call });
  ok("solve: an invented quote is questioned and fixed on the correction turn", r3.kind === "questioned" && r3.fixed && r3.rounds === 3 &&
    !r3.flags.length && /not in passage 1/.test(r3.rejected), r3);
  modelReplies = [function () { return "LOOKUP: methane emissions"; },
    function (m) { return "=360000000*1000\nANSWER: Human activities released about {result} kg of methane in 2019 [1].\nQUOTE [1]: " +
      firstSentence({ messages: m }, 1).replace(/^.*?(During 2019)/, "$1"); }];
  var rm = await A.solve("How many kilograms of methane did human activities release in 2019?", { call: call });
  ok("solve: a fact plus a calculation uses the passage's numbers and keeps its citation", rm.sources && rm.run.value === 360000000000 &&
    !rm.kind && !rm.flags.length && /\[1\]/.test(rm.parsed.answer), { kind: rm.kind, flags: rm.flags, v: rm.run.value });
  ok("reading prompt explains a calculation from passages", /add = lines that use numbers from the passages/.test(rm.sources && L.library.prompt("q", rm.sources, "x")));
  modelReplies = [function () { return "=2*3\nANSWER: {result}"; }];
  var r4 = await A.solve("What is 2 times 3?", { call: call });
  ok("solve: calculations never touch the library", !r4.sources && r4.rounds === 1 && r4.run.value === 6);
  modelReplies = [function () { return "LOOKUP: qqqxxyy"; }, function () { return "ANSWER: Not in my library."; }];
  var r5 = await A.solve("Tell me about qqqxxyy", { call: call });
  ok("solve: nothing found means no reading turn", !r5.sources && r5.rounds === 1);
  libCalls = [];
  ok("guard still answers dose questions before any lookup", /Not in my library/.test(await L.ai.complete([{ role: "user", content: A.buildPrompt("How many paracetamol tablets can I give my 2 year old?", []) }])) &&
    libCalls.length === 0);

  libCalls = [];
  var rg = await A.solve("How many paracetamol tablets can I give my 2 year old?", { call: function (m) { return L.ai.complete(m); } });
  ok("a safety-rule reply is not followed by a library lookup", !rg.sources && rg.rounds === 1 && libCalls.length === 0, { rounds: rg.rounds, calls: libCalls.length });

  // --- added after bench run 6 (1.9.2, Qwen3.5 4B, 61/67) ---
  L.ai.lastGuard = null;   // the scripted calls below bypass L.ai.complete
  // a real quote that does not say the answer's fact (natural gas: "methane"
  // quoting a sentence about fossil fuels)
  var unsup = V("ANSWER: Ocean acidification is caused by volcanoes [1].\nQUOTE [1]: " + s1, src, "What causes ocean acidification?");
  ok("verify: a real quote that does not say the fact fails", !unsup.ok && /no quote says volcanoes/.test(unsup.problems.join(" ")), unsup.problems);
  ok("verify: a quote that says the fact passes the support check",
    V("ANSWER: It is the ongoing decrease in the pH of the oceans [1].\nQUOTE [1]: " + s1, src, "What is ocean acidification?").ok);
  ok("verify: a number the quote states is support enough",
    V("ANSWER: Everest became the highest in 1952 [1].\nQUOTE [1]: Everest was measured in 1952 by surveyors.",
      [{ n: 1, title: "E", text: "Everest was measured in 1952 by surveyors." }], "In what year was Everest measured?").ok);
  // a real quote labelled with the wrong passage number is relabelled
  modelReplies = [function () { return "LOOKUP: ocean acidification"; },
    function (m) { return "ANSWER: It is the ongoing decrease in the pH of the oceans [2].\nQUOTE [2]: " + firstSentence({ messages: m }, 1); }];
  var rr = await A.solve("What is ocean acidification?", { call: call });
  ok("solve: a quote from passage 1 labelled [2] is relabelled [1], not questioned", rr.sources && rr.sources.length >= 2 &&
    rr.relabelled && rr.relabelled[0].from === 2 && rr.relabelled[0].to === 1 && /\[1\]/.test(rr.parsed.answer) && /QUOTE \[1\]/.test(rr.text) &&
    !rr.kind && !rr.flags.length && rr.rounds === 2, { rel: rr.relabelled, kind: rr.kind, flags: rr.flags, n: rr.sources && rr.sources.length });
  // a NEED that only repeats a question with no numbers gets the library
  modelReplies = [function () { return "NEED: What is ocean acidification?"; },
    function (m) { return "ANSWER: It is the ongoing decrease in the pH of the oceans [1].\nQUOTE [1]: " + firstSentence({ messages: m }, 1); }];
  var rn = await A.solve("What is ocean acidification?", { call: call });
  ok("solve: a NEED that repeats the question is treated as a decline and looked up", rn.sources && rn.rounds === 2 && !rn.parsed.need &&
    !rn.flags.length, { rounds: rn.rounds, need: rn.parsed.need });
  modelReplies = [function () { return "NEED: How many amp-hours is your battery?"; }];
  libCalls = [];
  var rb = await A.solve("How many hours will my battery run a 60 W light?", { call: call });
  ok("solve: a real NEED (a number is missing) is kept and nothing is looked up", rb.parsed.need && rb.rounds === 1 && !rb.sources && libCalls.length === 0);
  ok("needEcho: only an echo of a question without numbers",
    A.needEcho("What is the chemical symbol for gold?", "What is the chemical symbol for gold?") &&
    !A.needEcho("How many goats do you have, and how much feed does each goat need per day?", "How much feed do my goats need for 30 days?") &&
    !A.needEcho("What are the length, width and height of your room?", "How much paint do I need for my room?"));

  // bench grading for fact questions
  var item = { id: "t", cat: "fact", q: "What is ocean acidification?", want: "\\bpH\\b" };
  var resGood = { sources: src }, txt = "ANSWER: The decrease in the pH of the oceans [1].\nQUOTE [1]: " + s1;
  ok("bench: fact passes with the fact and a verified quote", L.aiBench.grade(item, txt, resGood).pass);
  ok("bench: right fact without a verified quote fails", !L.aiBench.grade(item, "ANSWER: The decrease in pH [1].\nQUOTE [1]: made up words here entirely", resGood).pass);
  ok("bench: fact from memory (no library sources) fails", L.aiBench.grade(item, txt, {}).why === "nothing found in the library");
  ok("bench: wrong fact fails", L.aiBench.grade(item, "ANSWER: Coral [1].\nQUOTE [1]: " + s1, resGood).why === "wrong answer");

  // Assist UI, through the same-origin model route
  await L.ai.detect();
  // A request that never got an answer (bench run 6, Firefox NetworkError)
  // is sent once more; a second failure is reported.
  var realFetch = w.fetch, drops = 1, tries = 0;
  w.fetch = function (url, opts) {
    if (/chat\/completions/.test(String(url))) { tries++; if (drops > 0) { drops--; return Promise.reject(new TypeError("NetworkError when attempting to fetch resource.")); } }
    return realFetch(url, opts);
  };
  modelReplies = ["ANSWER: hello"];
  var got = await L.ai.complete([{ role: "user", content: "Say hello" }]);
  ok("model call: a dropped request is sent once more", got === "ANSWER: hello" && tries === 2, { got: got, tries: tries });
  drops = 2; tries = 0; var err = "";
  try { await L.ai.complete([{ role: "user", content: "Say hello" }]); } catch (e) { err = String(e.message); }
  ok("model call: a second drop is reported, not retried forever", /NetworkError/.test(err) && tries === 2, { err: err, tries: tries });
  w.fetch = realFetch;
  go("assist"); await sleep(30);
  var q = d.querySelector("input[aria-label=\"Your question\"]");
  q.value = "What is ocean acidification?";
  var msel = d.querySelector("select[aria-label=\"Mode\"]");
  msel.value = "server"; fire(msel, "change"); await sleep(10);
  modelReplies = ["LOOKUP: ocean acidification", function (body) {
    return "ANSWER: It is the ongoing decrease in the pH of the oceans [1].\nQUOTE [1]: " + firstSentence(body, 1); }];
  btn(d, "Ask").click(); await sleep(120);
  var t = d.body.textContent;
  ok("Assist shows the search, the answer and checked sources", /searched its offline library for “ocean acidification”/.test(t) &&
    /Answer: It is the ongoing decrease/.test(t) && /✓ quote found in the passage/.test(t) && d.querySelector(".la-sources a[href*='8081/content/']") &&
    !/Lantern computed nothing here/.test(t) && !/No result/.test(t), t.slice(0, 800));

  // Chat
  go("chat"); await sleep(30);
  var cin = d.querySelector("input[aria-label=\"Message\"]");
  cin.value = "Why does coral bleach?";
  modelReplies = ["LOOKUP: coral bleaching", function (body) {
    return "ANSWER: Corals turn white when they lose their symbiotic algae [1].\nQUOTE [1]: " + firstSentence(body, 1); }];
  modelCalls = [];
  btn(d, "Send").click(); await sleep(150);
  t = d.body.textContent;
  ok("Chat looks it up and shows checked sources", modelCalls.length === 2 && /LIBRARY:/.test(modelCalls[1].messages[modelCalls[1].messages.length - 1].content) &&
    /Lantern searched its offline library for “coral bleaching”/.test(t) && /✓ quote found/.test(t), { calls: modelCalls.length, t: t.slice(-600) });

  // AI app panel
  go("ai"); await sleep(30);
  t = d.body.textContent;
  ok("AI app shows the attached library and its book", /Offline library \(encyclopedia\)/.test(t) && /Climate change by Wikipedia/.test(t) && /3,821 articles/.test(t), t.slice(0, 400));
  var sq = d.querySelector("input[aria-label=\"Library search\"]");
  sq.value = "methane emissions";
  btn(sq.parentNode, "Search").click(); await sleep(80);
  ok("library panel search shows the passages the AI would get", /The AI would be given these passages/.test(d.body.textContent) && /\[1\] Methane emissions/.test(d.body.textContent));

  // Bench run 5 misses: the article named by the words must reach the AI
  twoBooks = true; await LIB.detect();
  ok("two books listed", LIB.state.books.length === 2, LIB.state.books);
  async function top(qn, words) { var r = await LIB.lookup(qn, words); return r.sources.map(function (x) { return x.title; }); }
  var cases = [
    ["How tall is Mount Everest?", "Mount Everest height", "Mount Everest", 1],
    ["Who is the ohm, the unit of resistance, named after?", "ohm unit named after", "Ohm", 1],
    ["Which organ produces insulin?", "organ produces insulin", "Insulin", 1],
    ["In what year did people first land on the Moon?", "Moon landing year", "Moon landing", 1],
    ["What causes the seasons on Earth?", "cause of seasons Earth", "Season", 1],
    ["Which metal has the highest electrical conductivity?", "metal highest electrical conductivity", "Silver", 3]
  ];
  for (var ci = 0; ci < cases.length; ci++) {
    var got = await top(cases[ci][0], cases[ci][1]);
    ok("run-5 miss fixed: " + cases[ci][1] + " -> " + cases[ci][2] + " in the first " + cases[ci][3], got.slice(0, cases[ci][3]).indexOf(cases[ci][2]) >= 0, got);
  }
  var evp = (await LIB.lookup("How tall is Mount Everest?", "Mount Everest height")).sources[0].text;
  ok("passage keeps the sentence that answers", /8,849 metres/.test(evp), evp);
  ok("disambiguation pages are never passages", (await top("Tell me about the Moon", "Moon")).indexOf("Moon (disambiguation)") < 0);
  twoBooks = false; await LIB.detect();

  // library gone: no LOOKUP rule, no reading turn
  libraryUp = false;
  await LIB.detect();
  ok("library down: not ready, says why", !LIB.ready() && LIB.state.error, LIB.state);
  ok("library down: prompt goes back to plain decline", !/LOOKUP/.test(A.buildPrompt("x", [])) && /cannot answer it \(facts, news/.test(A.buildPrompt("x", [])));
  modelReplies = [function () { return "ANSWER: Not in my library."; }];
  var r6 = await A.solve("What is ocean acidification?", { call: call });
  ok("library down: a decline stays a decline", !r6.sources && r6.rounds === 1);
  // A public web address (GitHub Pages): no library is guessed or probed
  var probes = [], dom2 = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
    { url: "https://adamweldon.github.io/Lantern_Office_Suite/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  dom2.window.HTMLCanvasElement.prototype.getContext = function () { return null; };
  dom2.window.fetch = function (u) { probes.push(String(u)); return Promise.reject(new TypeError("offline")); };
  dom2.window.eval(js); await sleep(60);
  ok("a public web address does not guess a library", dom2.window.Lantern.library.defaultEndpoint() === "" &&
    !probes.some(function (u) { return /:8081/.test(u); }) && !dom2.window.Lantern.library.ready(), probes);

  console.log(fails ? fails + " LIBRARY FAILURES (" + passes + " passed)" : "ALL LIBRARY TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack || e); process.exit(1); });
