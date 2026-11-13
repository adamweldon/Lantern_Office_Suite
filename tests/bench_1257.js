// bench_1257.js -- Adam's first run of set B, replayed (CLAUDE.md: a bench run's failed rows go in tests/fixtures and
// tests replay them), and what 1.24.17 changed for it.
//
// Adam ran the 35B on set B of 1.24.16 with the library on his laptop (2026-11-13, 13:38 UTC, 92 minutes): 122 of 140
// (set A on 1.24.15: 138). bench_run_1256_35b_setb.json: the 20 rows that did not pass (two puzzles tried without
// Lantern's tools, not scored) as the model wrote them, and the 126 that passed, kept as a guard of right replies. He
// wrote: "some of these were not necessarily wrong some were grossly wrong". Read row by row, the 18 scored fall in three:
//  - Lantern's own doing (8): the history cut so short the follow-up's "it" was lost; CONVERT refusing "US gallon" with
//    the wrong reason; a manual's page 3 cut from view while the same question was still being answered, so the model
//    asked for it again and again; a chord line that never stopped (435 bars); the capital of Ghana and the Galaxy S7's
//    battery searched to the wrong articles; Chat's lessons not given for a scald, a snake bite and eating on little,
//    nor the catalog's Farming for a vegetable garden; and the goats lesson for raw milk.
//  - not wrong, graded as Lantern wants (3): the burn answer was right but gave no lesson; the raw milk answer from its
//    own knowledge was right; the float switches with the low one winning is a working design, the bench asks for the
//    safer one (the high float stops it).
//  - wrong (6): photosynthesis spelled backwards from memory, not from REVERSE's result; the flag puzzle's flag left
//    with Dot; the field drawn as a triangle and the path as three gray mountains; the colour wheel as two spokes,
//    "Primary" and "Secondary"; the minor tune's F# over D minor; a NEED that turned into "Not in my library".
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1256_35b_setb.json"), "utf8"));
var FX = path.join(__dirname, "fixtures", "kiwix"), BOOK = "wikipedia_en_climate_change_mini_2024-06";

// --- a stand-in library: the articles the two searches found on Adam's laptop, and the ones they should have found ---
var ART = {
  "Ghana": "Ghana, officially the Republic of Ghana, is a country in West Africa. It lies on the Gulf of Guinea and the Atlantic Ocean. The capital and largest city is Accra.",
  "Capital_punishment_in_Ghana": "Capital punishment is a legal penalty in Ghana only for high treason. Ghana executed a criminal for the last time in 1993; the capital sentence was abolished for ordinary crimes in 2023.",
  "Capital_Bank_(Ghana)": "Capital Bank was a Ghanaian bank licensed by the Bank of Ghana. In 2017 the Bank of Ghana revoked its licence because its capital was too small.",
  "R10_road_(Ghana)": "The R10 road is a regional road in Ghana that links towns in the capital region of Ghana.",
  "Samsung_Galaxy_S7_Edge_Battery_Replacement": "Follow this guide to replace a dead battery in the Samsung Galaxy S7 Edge. Before you begin, discharge the battery below 25%. Step 1: Heat the back cover. Step 12: Disconnect the battery connector and replace the battery.",
  "Samsung_Galaxy_Tab_S7_Plus_Battery_Replacement": "Use this guide to replace the battery in your Samsung Galaxy Tab S7+. Discharge the battery below 25% before you take the tablet apart.",
  "Samsung_Galaxy_S7": "Repair guides and support for the Samsung Galaxy S7, a phone Samsung released in 2016 alongside the S7 Edge.",
  "Samsung_Galaxy_S7_Battery_Replacement": "Follow this guide to replace the battery in a Samsung Galaxy S7. Discharge the battery below 25% first. Step 1: Heat the back cover to soften the adhesive. Step 10: Disconnect the battery and replace it.",
  // (review of 1.24.17) a bare name that is a page of meanings, a unit named after a person, and a place where the person lives
  "Newton": "Newton may refer to: Isaac Newton, the English scientist; the newton, a unit of force; Newton, a town in Massachusetts.",
  "Isaac_Newton": "Sir Isaac Newton was an English mathematician and physicist. Newton discovered the laws of motion and universal gravitation, and discovered that white light is a mixture of colours.",
  "Newton_(unit)": "The newton is the unit of force in the International System of Units. It is named after Isaac Newton, who discovered the laws of motion.",
  "Kenya": "Kenya is a country in East Africa. Its capital is Nairobi. Water from the Tana river in Kenya is used to farm, and the best way to reach it is by road.",
  "Water_purification": "Water purification is the process of removing germs and chemicals from water. The best way to purify river water is to let it settle, filter it, then boil it."
};
var ARTICLES = {};
Object.keys(ART).forEach(function (k) {
  var t = k.replace(/_/g, " ");
  ARTICLES[k] = { title: t, text: (t + " " + ART[k]).toLowerCase(),
    html: "<html><head><title>" + t + "</title></head><body><div id=\"mw-content-text\"><p>" + ART[k] + "</p></div></body></html>" };
});
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
function resp(status, body, type) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function escx(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
w.fetch = function (url) {
  var u = new w.URL(String(url), "http://127.0.0.1:8080/");   // (places.txt, beside the page: not here, so Lantern uses the list it carries)
  if (u.port !== "8081") return Promise.reject(new Error("no network"));
  if (u.pathname === "/catalog/v2/entries") return resp(200, fs.readFileSync(path.join(FX, "catalog.xml"), "utf8"), "application/atom+xml");
  if (u.pathname === "/search") {
    var words = (u.searchParams.get("pattern") || "").toLowerCase().split(/\s+/).filter(Boolean);
    var hits = Object.keys(ARTICLES).filter(function (k) { return words.every(function (wd) { return ARTICLES[k].text.indexOf(wd) >= 0; }); });
    var items = hits.slice(0, +u.searchParams.get("pageLength") || 25).map(function (k) {
      return "<item><title>" + escx(ARTICLES[k].title) + "</title><link>/content/" + BOOK + "/" + k + "</link><description>..." + escx(ARTICLES[k].text.slice(0, 120)) +
        "...</description><book><title>Climate change by Wikipedia</title></book><wordCount>300</wordCount></item>";
    }).join("");
    return resp(200, "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\"><channel><title>Search</title>" + items + "</channel></rss>", "application/rss+xml");
  }
  if (u.pathname === "/suggest") {
    var term = (u.searchParams.get("term") || "").toLowerCase();
    return resp(200, JSON.stringify(Object.keys(ARTICLES).filter(function (k) { return ARTICLES[k].title.toLowerCase().indexOf(term) === 0; })
      .map(function (k) { return { value: ARTICLES[k].title, label: ARTICLES[k].title, kind: "path", path: k }; })), "application/json");
  }
  var m = /^\/raw\/([^\/]+)\/content\/(.+)$/.exec(u.pathname);
  if (m && ARTICLES[decodeURIComponent(m[2])]) return resp(200, ARTICLES[decodeURIComponent(m[2])].html, "text/html");
  return resp(404, "not found", "text/html");
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  w.eval(JS);
  var ev = w.document.createEvent("Event"); ev.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(ev);
  await sleep(400);
  var L = w.Lantern, QB = L.aiBenchQuestionsB, C = L.CHAT, S = L.suite;
  function item(id) { return QB.filter(function (x) { return x.id === id; })[0]; }
  function row(id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  ok("boot clean; Adam's run of set B: 122 of 140, 20 rows that did not pass (two puzzles alone, not scored), 126 that passed",
    errs.length === 0 && F.set === "b" && F.lantern === "1.24.16" && F.summary.pass === 122 && F.summary.n === 140 && F.rows.length === 20 && F.passed.length === 126, [errs, F.summary.pass]);

  // --- the follow-up that lost its subject ------------------------------------------------------------------------
  var fu = row("chat-b-follow-up-search").chat;
  ok("as run: the first answer read the library, the follow-up was seen as leaning on it, and the 35B said it could not tell what \u201cit\u201d was",
    fu[0].searches[0].query === "machine translation" && fu[1].contextual && !fu[1].searches.length && /unclear what \x22it\x22 refers to/.test(fu[1].reply));
  var big = "Explain in detail how machine translation works.\n\nLIBRARY: passages from the offline encyclopedia (searched for: machine translation)\n\n[1] Machine translation\n" + new Array(13).join("Machine translation is the use of computational techniques to translate text. ") + "x".repeat(11000);
  var hist = [{ role: "user", content: big }, { role: "assistant", content: fu[0].reply + " " + "y".repeat(1200) }, { role: "user", content: "How did it work in its early days?" }];
  var sent = C.trimHistory(hist);
  ok("now: a first question whose passages are more than the room keeps its question and the start of its answer; the passages go",
    sent.length === 3 && /^Explain in detail how machine translation works\./.test(sent[0].content) && /removed to save room/.test(sent[0].content) &&
    /^Machine translation is the use/.test(sent[1].content) && sent[2].content === "How did it work in its early days?", sent.map(function (m) { return m.role + ": " + String(m.content).slice(0, 80); }));
  var total = sent.reduce(function (a, m) { return a + String(m.content).length; }, 0);
  ok("...and stays within the room (with what is kept of the older ones)", total <= C.historyBudget() + 1500, total);

  // --- the manual's page 3 ------------------------------------------------------------------------------------------
  var dn = row("doc-b-not-covered").chat[0];
  ok("as run: page 3, then pages 1-2, then page 3 again (told it was above), and a fourth READ: page 3 the last reply",
    dn.commands.join("|") === "READ: page 3|READ: pages 1-2|READ: page 3" && /READ: page 3$/.test(dn.reply));
  var turn = [{ role: "user", content: "earlier question" }, { role: "assistant", content: "earlier answer" },
    { role: "user", content: "How many litres of fuel does the tank on this generator hold?\n\nDOCUMENT: passages from GX-5000 generator manual\n[1] p1\n" + "a".repeat(400) },
    { role: "assistant", content: "READ: page 3" }, { role: "user", content: "DOCUMENT: passages from GX-5000 generator manual (page 3)\n[1] Section 3: Warning lights. " + "b".repeat(400) },
    { role: "assistant", content: "READ: pages 1-2" }, { role: "user", content: "DOCUMENT: passages from GX-5000 generator manual (pages 1-2)\n[1] Section 1 " + "c".repeat(400) }];
  turn.turnStart = 2;
  var kept = C.trimHistory(turn);
  ok("now: every passage given for the question being answered stays in view (page 3 with pages 1-2)", kept.length === 7 && /Section 3: Warning lights/.test(kept[4].content) && /Section 1/.test(kept[6].content), kept.map(function (m) { return String(m.content).slice(0, 60); }));
  delete turn.turnStart;
  ok("...and, as before, a passage of an earlier question is cut when a later one is given", /removed to save room/.test(C.trimHistory(turn)[4].content));

  // --- CONVERT ----------------------------------------------------------------------------------------------------
  var gl = row("gallons-litres-b");
  function run1(x) { var r = L.assist.run(x); return r.steps[0].ok ? r.steps[0].value : r.steps[0].err; }
  ok("as run: =CONVERT(5,\u201cUS gallon\u201d,\u201cliter\u201d) was refused as units of two kinds, and the 35B asked which name to write",
    /Units are not in the same category: US gallon -> liter/.test(gl.rejected) && /^NEED:/.test(gl.reply));
  ok("now: US gallon, U.S. gallons and US gal are the US gallon (5 of them are 18.93 litres)",
    ["=CONVERT(5,\x22US gallon\x22,\x22liter\x22)", "=CONVERT(5,\x22U.S. gallons\x22,\x22l\x22)", "=CONVERT(5,\x22US gal\x22,\x22L\x22)"].every(function (x) { return Math.abs(run1(x) - 18.92705892) < 1e-6; }),
    [run1("=CONVERT(5,\x22US gallon\x22,\x22liter\x22)")]);
  ok("...the imperial gallon is 4.54609 litres, not the US one; the US fluid ounce 29.57 ml", Math.abs(run1("=CONVERT(2,\x22imperial gallons\x22,\x22l\x22)") - 9.09218) < 1e-9 &&
    Math.abs(run1("=CONVERT(1,\x22fl oz\x22,\x22ml\x22)") - 29.5735295625) < 1e-6 && Math.abs(run1("=CONVERT(1,\x22oz\x22,\x22g\x22)") - 28.349523) < 1e-6);
  ok("...and a unit Lantern does not know is said to be unknown, with the units to write", /does not know the unit \u201cbarrel\u201d: write one of liter, ml/.test(run1("=CONVERT(3,\x22barrel\x22,\x22l\x22)")) &&
    /not in the same category/.test(run1("=CONVERT(3,\x22kg\x22,\x22l\x22)")));
  ok("the bench\u2019s own sum still gives 18.93", Math.abs(L.aiBench.grade(item("gallons-litres-b"), "=CONVERT(5,\x22US gallon\x22,\x22liter\x22)\nANSWER: {result} litres", {}).value - 18.92705892) < 1e-6);

  // --- the brass band's 435 bars -------------------------------------------------------------------------------------
  var br = row("make-music-brass-b"), mk = L.aiAct.build(br.reply, br.q), said = ((mk.plan && mk.plan.said) || []).join(" | "), probs = (mk.problems || []).join(" | ");
  ok("as run: a chord line of 435 bars, the reply cut off before any melody", /the song is 435 bars/.test(br.why) && br.reply.split("\n").length === 8);
  ok("now: the chord line, 3 bars and then the same 8 again and again, is kept as 11 turns of it in 91 bars (no melody) and said so; the song is no longer too long", /the chord line repeated the same 8 bars after its first 3 for \d+ bars, with no melody: Lantern kept 91 bars, 11 turns of it/.test(said) && !/bars: keep it to 96/.test(probs), [said, probs]);
  var tw = item("make-music-twinkle-b").ideal, mk2 = L.aiAct.build(tw, item("make-music-twinkle-b").q);
  ok("...a song of its own length is left as it is", !/repeated the same/.test(((mk2.plan && mk2.plan.said) || []).join(" ")));

  // --- Lantern's own lessons, and the catalog ----------------------------------------------------------------------
  function lessons(q) { return S.chat.howTo(q) ? S.passages(q, q, { detail: true, max: 3, strong: true }).map(function (s) { return s.key; }) : []; }
  ok("as run: no lessons for the scald, the snake bite or eating on little; the goats lesson for raw milk",
    ["health-b-burn", "health-b-snakebite", "food-b-cheap-meals"].every(function (id) { return /did not give the AI Lantern/.test(row(id).why); }) && /food_milk lesson was not among/.test(row("food-b-raw-milk").why));
  var LQ = [["Is it safe to drink milk straight from our goat, and how do I make it safe?", "food_milk"], ["How can my family eat well on very little money?", "food_thrift"],
    ["How can my wife and I eat healthily without much money?", "food_thrift"], ["My hand got burned on the stove, what should I do?", "health_burns"],
    ["My brother was bitten by a dog. What should we do now?", "health_bites"], ["Steam burned my wrist when I opened the pot. What should I do?", "health_burns"],
    ["How might our village get clean water to drink?", "health_water"]];
  ok("now: raw milk is given Milk and eggs, eating on little Eating well on little, and other wordings their lessons", LQ.every(function (x) { return lessons(x[0])[0] === x[1]; }),
    LQ.map(function (x) { return x[0].slice(0, 30) + " -> " + lessons(x[0]).join(","); }));
  // (review of 1.24.17) the scald and the snake bite as Adam's run asked them are not reached: the reviewer showed that
  // what reached them (the daughter and the uncle weighing little, a lesson taken when it scores far above the next)
  // pulled other questions to the wrong lesson -- "My baby son is breathing very fast" to CPR, "My mother is confused"
  // to Basic animal care, "How do I burn brush piles?" to Burns. They are left as on 1.24.16; a model can ask LESSON:.
  ok("...the scald and the snake bite as asked in the run are not reached, as on 1.24.16 (withdrawn after the review)",
    !lessons("My daughter spilled boiling water on her arm. What should I do right now?").length && !lessons("A snake bit my uncle on the ankle in the field. What should we do?").length);
  ok("...and the words added do not pull other questions there: boiling water to drink, keeping bees, milking a goat, frying in hot oil, a dog that bites, a sick goat",
    lessons("How do I boil water to make it safe to drink?")[0] === "health_water" && !lessons("How do I keep bees?").length && lessons("How do I milk a goat?").join() === "hus_goats" &&
    lessons("How do I deep fry fish in hot oil?")[0] !== "health_burns" && lessons("How do I stop my dog from biting?")[0] !== "health_bites" &&
    lessons("My goat is coughing. What could be wrong?").indexOf("health_burns") < 0 && lessons("My baby son is breathing very fast, what should I do?")[0] !== "health_cpr" &&
    lessons("My mother is confused and forgetful, how can I care for her at home?")[0] !== "hus_basics",
    [lessons("How do I deep fry fish in hot oil?"), lessons("How do I stop my dog from biting?"), lessons("My baby son is breathing very fast, what should I do?"), lessons("My mother is confused and forgetful, how can I care for her at home?")]);
  ok("...\u201chow do my lungs work\u201d is not a how-to", !S.chat.howTo("How do my lungs work?") && S.chat.howTo("How could our village keep its well clean?"));
  var cg = S.catalog("Does Lantern have a tool to help me plan a vegetable garden?");
  ok("as run the 35B said Lantern has no tool for a vegetable garden; now the catalog names the Farming tile",
    /does not have a dedicated/.test(row("suite-b-garden-tools").reply) && (cg.groups.tile || []).some(function (e) { return e.title === "Farming"; }), Object.keys(cg.groups).map(function (k) { return k + ": " + cg.groups[k].map(function (e) { return e.title; }).join(" / "); }));
  ok("...with what the tile has, in the catalog\u2019s line for it", /vegetable garden: crop spacing, sowing depth, days to harvest/.test(S.entries().filter(function (e) { return e.kind === "tile" && e.title === "Farming"; })[0].desc));

  // --- the library: the article the question names ------------------------------------------------------------------
  await sleep(50);
  var LIB = L.library;
  ok("the stand-in library is up", LIB.ready && LIB.ready());
  var gh = await LIB.lookup("What is the capital of Ghana?", "Ghana capital");
  ok("as run the capital of Ghana was given Capital punishment in Ghana, Capital Bank (Ghana) and a road: so it is still (a bonus for the article a question names was withdrawn after two reviews)",
    row("ghana-capital-b").library.sources.join() === "Capital punishment in Ghana,Capital Bank (Ghana),R10 road (Ghana)" && gh.sources[0].title === "Capital punishment in Ghana" && !LIB.namedTitle,
    gh.sources.map(function (s) { return s.title; }));
  var gx = await LIB.lookup("How do I replace the battery in a Samsung Galaxy S7?", "");
  ok("...and the Galaxy S7\u2019s battery the S7 Edge\u2019s guide first, as run", /S7 Edge Battery/.test(row("shelf-galaxy-battery-b").library.sources[0]) && /Edge/.test(gx.sources[0].title), gx.sources.map(function (s) { return s.title; }));

  // --- the review of 1.24.17's rules (fixtures/review1_1257.json): units, lessons and the catalog replayed ---------------
  var RV = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1257.json"), "utf8")), moved = [], worse = 0, n2 = 0;
  RV.cases.forEach(function (c) {
    if (!c.now || typeof c.input !== "string") return;
    var good;
    if (c.rule === 5) {
      var ls = lessons(c.input), e = String(c.expected), m;
      if ((m = /first lesson one of ([\w \/]+)/.exec(e))) good = !!ls.length && m[1].split(/\s*\/\s*/).indexOf(ls[0]) >= 0;
      else if ((m = /^not ([\w \/]+?) first/.exec(e))) good = !ls.length || m[1].split(/\s*\/\s*/).indexOf(ls[0]) < 0;
      else good = true;
      if (/^how-to/.test(e) && !S.chat.howTo(c.input)) good = false;
    } else if (c.rule === 6) {
      var tl = (S.catalog(c.input).groups.tile || []).map(function (x) { return x.app || x.id; });
      good = /not listed/.test(c.expected) ? tl.indexOf("farming") < 0 : tl.indexOf("farming") >= 0;
    } else if (c.rule === 2) {
      var st = L.assist.run(c.input).steps[0], v = st.ok ? st.value : "error";
      good = typeof c.expected === "number" ? typeof v === "number" && Math.abs(v - c.expected) < 1e-6 * Math.max(1, Math.abs(c.expected)) : typeof v === "string";
    } else return;
    n2++;
    if ((good ? "as said" : "differs") !== c.now) moved.push([c.rule, c.input, c.now]);
    if (!good && c.on_1_24_16 === "as said") worse++;
  });
  ok("the review\u2019s " + n2 + " cases on units, lessons and the catalog come out as recorded, and none that was right on 1.24.16 is wrong now", n2 === 251 && !moved.length && worse === 0, [n2, worse, moved]);

  // --- the second review (fixtures/review2_1257.json): its unit names replayed -----------------------------------------
  function asSaid(e, v) {
    if (typeof e === "number") return typeof v === "number" && Math.abs(v - e) < 1e-6 * Math.max(1, Math.abs(e));
    var ns = (String(e).match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number);
    if (typeof v !== "number") return /error|\bERR\b/i.test(String(e));
    return ns.some(function (x) { return Math.abs(v - x) < 1e-6 * Math.max(1, Math.abs(x)); });
  }
  var RV2 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review2_1257.json"), "utf8")), moved2 = [], worse2 = 0, n3 = 0, right3 = 0;
  RV2.cases.forEach(function (c) {
    if (c.rule !== 1) return;
    var st = L.assist.run(c.input).steps[0], good = asSaid(c.expected, st.ok ? st.value : "error");
    n3++; if (good) right3++;
    if ((good ? "as said" : "differs") !== c.now) moved2.push([c.input, c.now, st.ok ? st.value : st.err]);
    if (!good && c.on_1_24_16 === "as said") worse2++;
  });
  ok("the second review\u2019s " + n3 + " unit names come out as recorded (" + right3 + " as it said), and none that was right on 1.24.16 is wrong now", n3 === 146 && right3 === 137 && !moved2.length && worse2 === 0, [n3, right3, worse2, moved2]);

  // --- the third review (fixtures/review3_1257.json): its unit names replayed, and the history it found wrong -----------
  var RV3 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review3_1257.json"), "utf8")), moved3 = [], worse3 = 0, n4 = 0, right4 = 0;
  RV3.cases.forEach(function (c) {
    if (c.rule !== 1) return;
    var st = L.assist.run(c.input).steps[0], good = asSaid(c.expected, st.ok ? st.value : "error");
    n4++; if (good) right4++;
    if ((good ? "as said" : "differs") !== c.now) moved3.push([c.input, c.now, st.ok ? st.value : st.err]);
    if (!good && c.on_1_24_16 === "as said") worse3++;
  });
  ok("the third review\u2019s " + n4 + " unit names come out as recorded (" + right4 + " as it said), and none that was right on 1.24.16 is wrong now", n4 === 229 && right4 === 219 && !moved3.length && worse3 === 0, [n4, right4, worse3, moved3]);
  var RV4 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review4_1257.json"), "utf8")), moved4 = [], worse4 = 0, n5 = 0, right5 = 0;
  RV4.cases.forEach(function (c) {
    if (c.rule !== "units") return;
    var st = L.assist.run(c.input).steps[0], good = asSaid(c.expected, st.ok ? st.value : "error");
    n5++; if (good) right5++;
    if ((good ? "as said" : "differs") !== c.now) moved4.push([c.input, c.now, st.ok ? st.value : st.err]);
    if (!good && c.on_1_24_16 === "as said") worse4++;
  });
  ok("the fourth review\u2019s " + n5 + " unit names come out as recorded (" + right5 + " as it said), and none that was right on 1.24.16 is wrong now", n5 === 225 && right5 === 214 && !moved4.length && worse4 === 0, [n5, right5, worse4, moved4]);
  function cv(e) { var st = L.assist.run(e).steps[0]; return st.ok ? Math.round(st.value * 1e6) / 1e6 : "error"; }
  ok("Lantern\u2019s own names are not plain: pint_us beside an imperial gallon is the US pint (9.6076), gallon_imp to gallon_us 1.20095",
    cv("=CONVERT(1,\x22imperial gallon\x22,\x22pint_us\x22)") === 9.607599 && cv("=CONVERT(1,\x22gallon_imp\x22,\x22gallon_us\x22)") === 1.200950, [cv("=CONVERT(1,\x22imperial gallon\x22,\x22pint_us\x22)"), cv("=CONVERT(1,\x22gallon_imp\x22,\x22gallon_us\x22)")]);
  ok("...a measure beside its own imperial one stays the US one (gallons to imperial gallons 0.83267), 8 imperial pints are 1 gallon, a plain pint beside a pint named US is asked about, sqft is read again",
    cv("=CONVERT(1,\x22gallon\x22,\x22imperial gallon\x22)") === 0.832674 && cv("=CONVERT(8,\x22imperial pints\x22,\x22gallon\x22)") === 1 &&
    cv("=CONVERT(1,\x22pint\x22,\x22US pint\x22)") === "error" && cv("=CONVERT(1,\x22sqft\x22,\x22m2\x22)") === 0.092903 && cv("=CONVERT(2,\x22pints\x22,\x22gallon\x22)") === 0.25,
    [cv("=CONVERT(1,\x22gallon\x22,\x22imperial gallon\x22)"), cv("=CONVERT(8,\x22imperial pints\x22,\x22gallon\x22)"), cv("=CONVERT(1,\x22pint\x22,\x22US pint\x22)"), cv("=CONVERT(1,\x22sqft\x22,\x22m2\x22)")]);
  ok("one-word square and cubic names are read as on 1.24.16 (sqmeters, cubicmetres), and a cup is still a cup",
    cv("=CONVERT(1,\x22sqmeters\x22,\x22sqft\x22)") === 10.76391 && cv("=CONVERT(1,\x22cubicmetres\x22,\x22liter\x22)") === 1000 && cv("=CONVERT(1,\x22cup\x22,\x22ml\x22)") === 236.588237,
    [cv("=CONVERT(1,\x22sqmeters\x22,\x22sqft\x22)"), cv("=CONVERT(1,\x22cubicmetres\x22,\x22liter\x22)"), cv("=CONVERT(1,\x22cup\x22,\x22ml\x22)")]);
  // the history: the person's words are theirs, Lantern's own are one line, prose beginning "Make" is prose
  var big = "Who built it?\n\nLIBRARY: passages from the offline encyclopedia (searched for: engines)\n\n" + new Array(150).join("Coal was burned to raise steam. ");
  var hl = [{ role: "user", content: "This is not what I asked for: the roof should be red" }, { role: "assistant", content: "MAKE PICTURE: House\nrect 0 0 10 10 red\nEND\nHere it is." },
    { role: "user", content: "That is already above. Answer the QUESTION now.\n\nQUESTION: What colour is the roof?" }, { role: "assistant", content: "Sow the seeds in rows.\nMake sure the soil stays moist.\nKeep them warm." },
    { role: "user", content: "Thanks" }, { role: "assistant", content: new Array(300).join("Engines pumped water. ") }, { role: "user", content: big }];
  hl.asked = [hl[0], hl[4], hl[6]]; hl.askedFrom = 0; hl.turnStart = 6;
  var ho = L.CHAT.trimHistory(hl, 9000).map(function (m) { return typeof m.content === "string" ? m.content : ""; }).join("\n---\n");
  ok("the person\u2019s \u201cThis is not what I asked for\u201d is kept, Lantern\u2019s \u201cThat is already above\u201d is one line, \u201cMake sure the soil stays moist\u201d stays prose, the block is one line",
    /This is not what I asked for: the roof should be red/.test(ho) && !/That is already above/.test(ho) && /Make sure the soil stays moist/.test(ho) &&
    /a block was made here \(\u201cPICTURE: House\u201d\)/.test(ho) && !/rect 0 0/.test(ho) && /Here it is/.test(ho), ho.slice(0, 900));
  // the person's own words for a marked question (not THE SONG SO FAR Lantern added, nor a block)
  var h2 = [{ role: "user", content: "Make music: that is my goal this year.\nWhere do I start?\n\nTHE SONG SO FAR: Lantern made this song earlier -- tempo 70" },
    { role: "assistant", content: "Start with scales. " + new Array(200).join("Practise daily. ") }, { role: "user", content: "And then?" }, { role: "assistant", content: "" },
    { role: "user", content: "Thanks" }, { role: "assistant", content: new Array(300).join("Engines pumped water. ") }, { role: "user", content: big }];
  h2.asked = [h2[0], h2[2], h2[4], h2[6]]; h2.askedText = ["Make music: that is my goal this year.\nWhere do I start?", "And then?", "Thanks", "Who built it?"]; h2.askedFrom = 0; h2.turnStart = 6;
  var ho2 = L.CHAT.trimHistory(h2, 9000).map(function (m) { return typeof m.content === "string" ? m.content : ""; }).join("\n---\n");
  ok("a marked question\u2019s short version is the person\u2019s own words: no THE SONG SO FAR, no block line for \u201cMake music: that is my goal\u201d; an empty old answer does not stop the older ones",
    /^Make music: that is my goal this year\.\nWhere do I start\?/.test(ho2) && !/THE SONG SO FAR|a block was made/.test(ho2) && /And then\?/.test(ho2), ho2.slice(0, 600));
  var vs = L.aiAct.build("MAKE MUSIC: V\nkey C major\ntempo 100\ntime 4/4\nchords " + new Array(31).join("C | F | G | C | ").replace(/ \| $/, "") + "\nVoice: E D C D | E E E - | D D D - | E G G -\nEND", "Write a song in C");
  var vc = L.aiAct.build("MAKE MUSIC: W\nkey C major\ntempo 100\ntime 4/4\nverse:\nchords " + new Array(5).join("Am | F | C | G | ").replace(/ \| $/, "") + "\nchorus:\nchords " + new Array(26).join("C | F | G | C | ").replace(/ \| $/, "") + "\nEND", "Write a song in C");
  ok("the chords are left as on 1.24.16 under a tune on a \u201cVoice:\u201d line, and in a song of a verse and a runaway chorus (asked to keep to 96 bars, not said to be cut)",
    !vs.plan.said.some(function (x) { return /repeated the same/.test(x); }) && !vc.plan.said.some(function (x) { return /repeated the same/.test(x); }) && vc.problems.some(function (x) { return /keep it to 96/.test(x); }),
    [vs.plan.said, vc.plan.said, vc.problems]);

  // --- the guard: every reply that passed still passes ------------------------------------------------------------------
  var bad = [], n = 0;
  F.passed.forEach(function (r) {
    var it = item(r.id), g = null;
    if (!it || !/^(make|tool|multi|need|unknown|safety)$/.test(r.cat)) return;
    try { g = L.aiBench.grade(it, r.reply, r.cat === "make" ? { made: L.aiAct.build(r.reply, it.q) } : {}); } catch (e) { g = { pass: false, why: "threw " + e.message }; }
    n++;
    if (!g.pass) bad.push([r.id, g.why]);
  });
  ok("every passed sum, picture, program and tune of the run passes still (" + n + ")", n === 74 && !bad.length, bad);

  console.log(fails ? fails + " BENCH 1.24.17 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.17 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
