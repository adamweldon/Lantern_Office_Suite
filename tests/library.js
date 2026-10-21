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
// A redirect: kiwix-serve gives the article for "Everest" under its own
// path, so one article came back twice ("Mount Everest", "Mount Everest" --
// run 7, 1.9.6).
ARTICLES[BOOK2 + "/Everest"] = { book: BOOK2, path: "Everest", title: "Everest", text: ARTICLES[BOOK2 + "/Mount_Everest"].text,
  html: ARTICLES[BOOK2 + "/Mount_Everest"].html };
// A third book: the same encyclopedia in full ("nopic"), whole articles
// with sections, for detail questions (1.9.4).
var BOOK3 = "wikipedia_en_all_nopic_2026-09", FULL = {
  "Mount_Everest": "<p>Mount Everest is Earth's highest mountain above sea level, in the Mahalangur Himal sub-range of the Himalayas. Its elevation of 8,849 metres was set in 2020 by the Chinese and Nepali authorities.</p>" +
    "<h2>Climbing history</h2><p>The first recorded ascent was made on 29 May 1953 by Tenzing Norgay and Edmund Hillary, members of a British expedition led by John Hunt, by the southeast ridge route from Nepal.</p>" +
    "<p>Earlier British expeditions in the 1920s tried the north ridge from Tibet; George Mallory and Andrew Irvine vanished near the summit in 1924.</p>" +
    "<h2>Geology</h2><p>The summit is made of Ordovician limestone that formed on the floor of the Tethys Ocean and was lifted by the collision of the Indian and Eurasian plates.</p>" +
    "<h2>References</h2><ul><li>Hunt, John (1953). The Ascent of Everest. Hodder and Stoughton, London, a book about the climb.</li></ul>",
  "Season": "<p>A season is a division of the year based on changes in weather and daylight. Seasons result from Earth's orbit around the Sun and Earth's axial tilt relative to the ecliptic plane.</p>" +
    "<h2>Cause</h2><p>Earth's axis is tilted by about 23.4 degrees, so for half of each orbit one hemisphere leans towards the Sun and receives more direct sunlight and longer days.</p>"
};
Object.keys(FULL).forEach(function (k) {
  var t = k.replace(/_/g, " ");
  ARTICLES[BOOK3 + "/" + k] = { book: BOOK3, path: k, title: t, text: (t + " " + FULL[k].replace(/<[^>]+>/g, " ")).toLowerCase(),
    html: "<html><head><title>" + t + "</title></head><body><div id=\"mw-content-text\">" + FULL[k] + "</div></body></html>" };
});
Object.keys(ARTICLES).forEach(function (k) { if (!ARTICLES[k].book) { ARTICLES[k].book = BOOK; ARTICLES[k].path = k; } });
var twoBooks = false, threeBooks = false, searched = [];
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
      if (threeBooks) cat = cat.replace("</feed>", "<entry><title>Wikipedia</title><language>eng</language><name>wikipedia_en_all</name><flavour>nopic</flavour>" +
        "<tags>_ftindex:yes</tags><articleCount>6900000</articleCount><link type=\"text/html\" href=\"/content/" + BOOK3 + "\" /></entry></feed>");
      return resp(200, cat, "application/atom+xml");
    }
    if (u.pathname === "/search") {
      var bn = u.searchParams.get("books.name");
      if (bn !== BOOK && !(twoBooks && bn === BOOK2) && !(threeBooks && bn === BOOK3)) return resp(400, "<error>No such book</error>", "application/xml");
      searched.push(bn);
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
    if (m && threeBooks && m[1] === BOOK3 && ARTICLES[BOOK3 + "/" + m[2]]) return resp(200, ARTICLES[BOOK3 + "/" + m[2]].html, "text/html");
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

  // 1.9.4: infobox rows are facts
  var co2 = await LIB.read({ book: BOOK, path: "Carbon_dioxide", title: "Carbon dioxide" });
  ok("infobox rows are read as facts", co2.facts.some(function (f) { return /^Molar mass: 44\.009/.test(f); }) &&
    co2.facts.some(function (f) { return /^Appearance: Colorless gas/.test(f); }) &&
    !co2.facts.some(function (f) { return /^(CAS Number|ChEBI|PubChem|3D model)/.test(f); }), co2.facts);
  var co2p = LIB.passage(co2, LIB.keywords("What is the molar mass of carbon dioxide?"), 1000);
  ok("passages carry the infobox facts that match the question", /Facts from the infobox: .*Molar mass: 44\.009/.test(co2p), co2p.slice(-400));
  ok("a quote from an infobox fact verifies", V("ANSWER: 44.009 g/mol [1].\nQUOTE [1]: Molar mass: 44.009", [{ n: 1, title: "Carbon dioxide", text: co2p }],
    "What is the molar mass of carbon dioxide?").ok);

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
  cin.value = "What makes coral turn white?";
  modelReplies = ["LOOKUP: coral bleaching", function (body) {
    return "ANSWER: Corals turn white when they lose their symbiotic algae [1].\nQUOTE [1]: " + firstSentence(body, 1); }];
  modelCalls = [];
  btn(d, "Send").click(); await sleep(150);
  t = d.body.textContent;
  ok("Chat looks it up and shows checked sources", modelCalls.length === 2 && /LIBRARY:/.test(modelCalls[1].messages[modelCalls[1].messages.length - 1].content) &&
    /Lantern searched its offline library for “coral bleaching”/.test(t) && /✓ quote found/.test(t), { calls: modelCalls.length, t: t.slice(-600) });

  // --- 1.9.4: an explanation question is read first, and each sentence of
  // the answer is checked against the passages ---
  function chatAsk(text) { cin = d.querySelector("input[aria-label=\"Message\"]"); cin.value = text; modelCalls = []; btn(d, "Send").click(); }
  function logText() { return d.querySelector("[aria-label=\"Conversation\"]").textContent; }
  var before = logText().length;
  modelReplies = [function (body) {
    var last = body.messages[body.messages.length - 1].content;
    return /LIBRARY:/.test(last) ? "Coral bleaching is the process when corals become white due to loss of symbiotic algae [1]. " +
      "I think reefs can recover if the water cools again in time.\nQUOTE [1]: " + firstSentence(body, 1) : "?";
  }];
  chatAsk("Explain in detail why coral bleaching happens"); await sleep(200);
  t = logText().slice(before);
  ok("Chat reads the library before answering an explanation question", modelCalls.length === 1 &&
    /LIBRARY: passages/.test(modelCalls[0].messages[modelCalls[0].messages.length - 1].content) &&
    /Answer the QUESTION in detail/.test(modelCalls[0].messages[modelCalls[0].messages.length - 1].content) && /Lantern read \d passage/.test(t), t.slice(0, 500));
  ok("Chat checks each sentence: one backed, one the AI's own", /1 of 2 backed by the passage they cite/.test(t) &&
    /own reasoning, not from the passages/.test(t) && /reefs can recover/.test(t) && /✓ quote found/.test(t), t.slice(-700));
  before = logText().length;
  modelReplies = [function () { return "Coral bleaching is caused by plastic bags floating over the reef [1].\nQUOTE [1]: Coral bleaching is caused by plastic."; },
    function (body) { var last = body.messages[body.messages.length - 1].content;
      return /Lantern checked each sentence/.test(last) && /plastic bags/.test(last) ?
        "Coral bleaching is the process when corals become white due to loss of symbiotic algae [1].\nQUOTE [1]: " + firstSentence({ messages: body.messages.slice(0, -2) }, 1) : "?"; }];
  chatAsk("Explain coral bleaching"); await sleep(250);
  t = logText().slice(before);
  ok("Chat: a sentence citing a passage that does not say it goes back to the AI, and the fix is checked", modelCalls.length === 2 &&
    /cites \[1\] but no passage says it/.test(t) && /1 of 1 backed/.test(t) && !/still questions/.test(t), t.slice(-700));
  ok("Chat sends earlier passages as a short note only", (function () {
    var tr = L.CHAT.trimHistory([{ role: "user", content: "q1\n\nLIBRARY: passages from the offline encyclopedia\n[1] A\nlong text" }, { role: "assistant", content: "a1" },
      { role: "user", content: "q2\n\nLIBRARY: passages from the offline encyclopedia\n[1] B\ntext" }]);
    return tr.length === 3 && /^q1\n\n\[library passages from an earlier question/.test(tr[0].content) && /\[1\] B/.test(tr[2].content);
  })());
  ok("Chat drops the oldest turns of a long conversation", (function () {
    var big = []; for (var k = 0; k < 30; k++) big.push({ role: k % 2 ? "assistant" : "user", content: new Array(1001).join("x") });
    var tr = L.CHAT.trimHistory(big); return tr.length < 30 && tr[0].role === "user" && tr[tr.length - 1] === big[29];
  })());
  // the transcript holes: a fake =LOOKUP(...) line, invented QUOTE lines
  ok("=LOOKUP(...) is read as a search request, not a formula", (function () {
    var pr = A.parseReply("= LOOKUP(\"LLM\", \"architecture\")\nANSWER: x");
    return pr.lookup === "LLM architecture" && pr.exprText === "";
  })());
  ok("a NEED for encyclopedia data asks the library", A.needLibrary("specific factual data from the offline encyclopedia regarding LLMs") &&
    !A.needLibrary("How many goats do you have?"));
  before = logText().length;
  modelReplies = [function () { return "LLMs predict the next token.\nQUOTE [1]: Large language models are trained on text."; },
    function (body) { var last = body.messages[body.messages.length - 1].content;
      return /LIBRARY:/.test(last) ? "ANSWER: Coral bleaching is the process when corals become white [1].\nQUOTE [1]: " + firstSentence(body, 1) : "?"; }];
  chatAsk("What makes coral turn white again?"); await sleep(200);
  t = logText().slice(before);
  ok("Chat: QUOTE lines without passages make Lantern search the library", modelCalls.length === 2 && /wrote quotes without any passages/.test(t) && /✓ quote found/.test(t), t.slice(-500));

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
  libCalls = [];
  var evl = await LIB.lookup("How tall is Mount Everest?", "Mount Everest height"), evp = evl.sources[0].text;
  ok("passage keeps the sentence that answers", /8,849 metres/.test(evp), evp);
  ok("one article reached by two names (a redirect) is given once", libCalls.some(function (u) { return /\/content\/Everest$/.test(u); }) &&
    evl.sources.filter(function (x) { return x.title === "Mount Everest"; }).length === 1, { s: evl.sources.map(function (x) { return x.title + " " + x.path; }) });

  // --- 1.9.7: run 7 (35B, 1.9.6, 80/82) -- it declined Everest's height ---
  var EV = { title: "Mount Everest", paras: [
    "Mount Everest (known locally as Sagarmatha in Nepal and Qomolangma in Tibet) is Earth's highest mountain above sea level. It lies in the Mahalangur Himal sub-range of the Himalayas and marks part of the China-Nepal border at its summit. Its height was most recently measured in 2020 through a joint survey by Nepalese and Chinese authorities as 8,848.86 m (29,031 ft 8+1/2 in).",
    "Mount Everest attracts many climbers, including highly experienced mountaineers. There are two main climbing routes, one approaching the summit from the southeast in Nepal (known as the standard route) and the other from the north in Tibet. While not posing substantial technical climbing challenges on the standard route, Everest presents dangers such as altitude sickness, weather, and wind, as well as hazards from avalanches and the Khumbu Icefall. As of May 2024, 340 people have died on Everest. Over 200 bodies remain on the mountain and have not been removed due to the dangerous conditions.",
    "The first recorded efforts to reach Everest's summit were made by British mountaineers. As Nepal did not allow foreigners into the country at the time, the British made several attempts on the North Ridge route from the Tibetan side. The 1924 expedition resulted in one of the greatest mysteries on Everest to this day: George Mallory and Andrew Irvine made a final summit attempt on 8 June but never returned. Tenzing Norgay and Edmund Hillary made the first documented ascent of Everest in 1953, using the southeast ridge route. Mount Everest climbing permits from the Nepalese government cost mountaineers a large fee. Everest base camps on both sides of the mountain draw trekkers and mountaineers every spring."],
    facts: ["Prominence: Ranked 1st (Special definition for Everest)", "Etymology: George Everest", "Native name: Sagarmatha (Nepali); Qomolangma (Tibetan)",
      "Listing: Eight-thousander, Seven Summits, Country high point", "Isolation: n/a", "Countries: Nepal and China", "Elevation: 8,848.86 m (29,031.7 ft) Ranked 1st"] };
  var evq = "How tall is Mount Everest?", evText = LIB.passage(EV, LIB.keywords("Mount Everest height " + evq), 1000, false, evq);
  ok("passage: the words that say what about the subject decide, not the subject's own name", /Its height was most recently measured/.test(evText) &&
    /Facts from the infobox: Elevation: 8,848\.86 m/.test(evText), evText.slice(500));
  ok("passage: a quantity question prefers sentences with numbers", !/attracts many climbers/.test(evText) && /340 people/.test(evText), evText);
  ok("prompt: a number a passage states is a fact, not a calculation", /A number a passage states \(a height, a year, a count\) is a fact/.test(L.library.prompt("q", [{ n: 1, title: "T", text: "x" }], "x")));
  var evSrc = [{ n: 1, title: "Mount Everest", text: evText }, { n: 2, title: "1952 Swiss Mount Everest expedition", text: "The 1952 Swiss Mount Everest expedition reached 8,595 m." }];
  var pt = L.libraryPointer(evq, evSrc);
  ok("pointer: the sentence with the measure and a number", pt && pt.n === 1 && /^Its height was most recently measured/.test(pt.text) &&
    /^Passage \[1\] says: \u201cIts height/.test(pt.prompt) && /QUESTION: How tall is Mount Everest\?$/.test(pt.prompt) && /Not in my library/.test(pt.prompt), pt);
  ok("pointer: none for a person's own situation, an explanation, another subject, or a subject alone",
    !L.libraryPointer("What will the price of rice be next month?", [{ n: 1, title: "Rice", text: "The price of rice rose next month in 2008." }]) &&
    !L.libraryPointer("Who is the mayor of my town right now?", [{ n: 1, title: "Mayor", text: "A mayor leads the town council of a town, elected every 4 years." }]) &&
    !L.libraryPointer("Why is Mount Everest so tall?", evSrc) &&
    !L.libraryPointer("How tall is the Eiffel Tower?", evSrc) &&
    !L.libraryPointer("What is Mount Everest?", evSrc));
  ok("pointer: a fact from the infobox when no sentence has it", (function () {
    var r = L.libraryPointer("How tall is Mount Everest?", [{ n: 1, title: "Mount Everest", text: "Mount Everest is Earth's highest mountain above sea level. Facts from the infobox: Etymology: George Everest. Elevation: 8,848.86 m (29,031.7 ft) Ranked 1st." }]);
    return r && /^Elevation: 8,848\.86 m/.test(r.text);
  })());
  modelReplies = [function () { return "LOOKUP: Mount Everest height"; }, function () { return "ANSWER: Not in my library."; },
    function (m) { var last = m[m.length - 1].content; return /^Passage \[1\] says: \u201cIts elevation of 8,849 metres/.test(last) ?
      "ANSWER: Mount Everest is 8,849 metres tall [1].\nQUOTE [1]: Its elevation of 8,849 metres was set in 2020 by the Chinese and Nepali authorities." : "?"; }];
  var rp = await A.solve(evq, { call: call });
  ok("solve: a decline with the answer in front of it gets one pointer turn", rp.pointed === 1 && rp.rounds === 3 && /8,849 metres/.test(rp.parsed.answer) &&
    !rp.flags.length && L.aiBench.grade(L.aiBenchQuestions.filter(function (x) { return x.id === "everest-height"; })[0], rp.text, rp).pass, rp);
  modelReplies = [function () { return "LOOKUP: Mount Everest height"; }, function () { return "ANSWER: Not in my library."; }, function () { return "ANSWER: Not in my library."; }];
  var rq = await A.solve(evq, { call: call });
  ok("solve: the AI may still decline after the pointer; only one pointer", rq.pointed === 1 && rq.rounds === 3 && /not in my library/i.test(rq.parsed.answer), rq);
  modelReplies = [function () { return "LOOKUP: Who is the mayor"; }, function () { return "ANSWER: Not in my library."; }];
  var rr = await A.solve("Who is the mayor of my town right now?", { call: call });
  ok("solve: no pointer for a question about the person's own place", !rr.pointed && rr.rounds <= 2, rr);
  go("chat"); await sleep(30);
  var cb = logText().length;
  modelReplies = ["LOOKUP: Mount Everest height", "ANSWER: Not in my library.", function (body) {
    var last = body.messages[body.messages.length - 1].content;
    return /^Passage \[1\] says/.test(last) ? "ANSWER: Mount Everest is 8,849 metres tall [1].\nQUOTE [1]: Its elevation of 8,849 metres was set in 2020 by the Chinese and Nepali authorities." : "?"; }];
  chatAsk(evq); await sleep(250);
  var ct = logText().slice(cb);
  ok("Chat: a decline with the answer in front of it gets one pointer turn", modelCalls.length === 3 && /passage \[1\] looks like the answer/.test(ct) &&
    /8,849 metres tall/.test(ct) && /\u2713 quote found/.test(ct), { calls: modelCalls.length, t: ct.slice(-600) });
  ok("disambiguation pages are never passages", (await top("Tell me about the Moon", "Moon")).indexOf("Moon (disambiguation)") < 0);
  // --- 1.9.4: the small file and the full text, side by side ---
  threeBooks = true; await LIB.detect();
  var fams = LIB.families().filter(function (f) { return f.name === "wikipedia_en_all"; });
  ok("mini and full Wikipedia are one family", LIB.state.books.length === 3 && fams.length === 1 && fams[0].lead.id === BOOK2 && fams[0].full.id === BOOK3,
    LIB.state.books.map(function (b) { return b.id + ":" + b.flavour; }));
  searched = [];
  var quick = await LIB.lookup("How tall is Mount Everest?", "Mount Everest height");
  ok("a quick fact searches and reads the small file", quick.sources[0].book === BOOK2 && searched.indexOf(BOOK3) < 0 && /lead sections/.test(quick.sources[0].bookTitle),
    { s: quick.sources.map(function (x) { return x.book + "/" + x.path; }), searched: searched });
  searched = [];
  var deep = await LIB.lookup("Explain how Mount Everest was first climbed", "", { detail: true });
  var ev = deep.sources.filter(function (x) { return x.path === "Mount_Everest"; })[0];
  ok("a detail question reads the full article, with its sections", ev && ev.book === BOOK3 && /\(Climbing history\) The first recorded ascent/.test(ev.text) &&
    /Tenzing Norgay/.test(ev.text) && !/Ascent of Everest\. Hodder/.test(ev.text) && searched.indexOf(BOOK2) < 0 && /full articles/.test(ev.bookTitle),
    { s: deep.sources.map(function (x) { return x.book + "/" + x.path; }), t: ev && ev.text });
  ok("no article is given twice", deep.sources.map(function (x) { return x.title; }).filter(function (x, i, a) { return a.indexOf(x) !== i; }).length === 0);
  ok("explanation questions are told apart from quick facts", LIB.wantsDetail("Explain in detail how large language models work") &&
    LIB.wantsDetail("How does a heat pump work?") && LIB.wantsDetail("Tell me about the Moon") && !LIB.wantsDetail("What is the capital of Kenya?") &&
    !LIB.wantsDetail("How tall is Mount Everest?"));
  threeBooks = false;
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
