// bench_1258.js -- Adam's second run of set B, replayed (CLAUDE.md: a bench run's failed rows go in tests/fixtures and
// tests replay them), and what 1.24.18 changed for it.
//
// Adam ran the 35B on set B of 1.24.17 with the library on his laptop (2026-11-13, 18:33 UTC, 101 minutes): 129 of 140
// (122 on 1.24.16). bench_run_1257_35b_setb.json: the 13 rows that did not pass (two puzzles tried without Lantern's
// tools, not scored) as the model wrote them, and the 133 that passed, kept as a guard of right replies. Every row that
// failed failed on 1.24.16 too, with the same reply word for word -- the same row twice is a finding (CLAUDE.md). Read:
//  - Lantern's own doing: the 35B asked the person "How many chickens do you have, and how many grams of feed does each
//    chicken need per day?", Lantern took that NEED to the library first, found nothing, and the model's question was
//    lost to "Not in my library" (both runs); a word typed from nowhere ("noitucisohp" under =REVERSE("photosynthesis"))
//    was too far from the result for the check of retyped results (both runs); the library ranked Capital punishment in
//    Ghana and the Galaxy S7 Edge's guide above the articles the questions name (both runs; a ranking by the named
//    subject was tried in 1.24.17 and withdrawn after two reviews); a colour wheel's Red, Yellow and Blue all painted
//    pale yellow (its parts were Primary and Secondary).
//  - as before: the scald and the snake bite as worded; Amazing Grace with no melody; the float switches graded strictly.
//  - the model's: the flag left with Dot, the field a triangle and the path mountains, the F# over D minor.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1257_35b_setb.json"), "utf8"));
var F1 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1256_35b_setb.json"), "utf8"));
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
  "Chicken": "The chicken is a domesticated bird. Chickens are kept for eggs and meat; a flock forages and is fed grain.",
  "Dwarfism_in_chickens": "Dwarfism in chickens is an inherited condition found in chickens, giving adults a small size.",
  "FEED": "FEED is a project that sells bags to fund school meals.",
  // (the review of 1.24.18) a name that is another place, and a word that names nothing
  "Paris": "Paris is the capital and largest city of France, with a population of about 2.1 million.",
  // (its second review) a name inside a longer one: Niger and Nigeria, Austria and Australia, India and Indiana
  "Nigeria": "Nigeria is a country in West Africa. It borders Niger in the north. Abuja is the capital of Nigeria.",
  "Australia": "Australia is a country in Oceania, not to be confused with Austria in Europe. Canberra is the capital of Australia.",
  "Indiana": "Indiana is a state in the Midwestern United States. Indianapolis is the capital of Indiana.",
  "Light": "Light is electromagnetic radiation that the human eye can see, with wavelengths of about 400 to 700 nanometres.",
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
  var L = w.Lantern, QB = L.aiBenchQuestionsB, C = L.CHAT, A = L.assist;
  function item(id) { return QB.filter(function (x) { return x.id === id; })[0]; }
  function row(id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  function row1(id) { return F1.rows.filter(function (r) { return r.id === id; })[0]; }
  function fake(replies) { var i = 0, seen = []; var f = function (m) { seen.push(m); return Promise.resolve(replies[Math.min(i++, replies.length - 1)]); }; f.seen = seen; return f; }
  function said(m) { return typeof m.content === "string" ? m.content : ""; }
  ok("boot clean; Adam's second run of set B: 129 of 140 on 1.24.17, 13 rows that did not pass, 133 that passed",
    errs.length === 0 && F.set === "b" && F.lantern === "1.24.17" && F.summary.pass === 129 && F.summary.n === 140 && F.rows.length === 13 && F.passed.length === 133, [errs, F.summary.pass]);
  var same = F.rows.filter(function (r) { var o = row1(r.id); return o && o.reply === r.reply; }).length;
  ok("every row that failed failed on 1.24.16 too, with the same reply word for word (the same row twice)", F.rows.every(function (r) { return !!row1(r.id); }) && same === 13, same);
  var fixedNow = ["gallons-litres-b", "chat-b-follow-up-search", "doc-b-not-covered", "suite-b-garden-tools", "health-b-burn", "food-b-raw-milk", "food-b-cheap-meals"];
  ok("seven that failed on 1.24.16 pass here (the follow-up, US gallons, the manual, the garden tool, the burn, raw milk, cheap meals)",
    fixedNow.every(function (id) { return row1(id) && F.passed.some(function (r) { return r.id === id; }); }));

  // --- the chickens: a NEED to the person, lost to the library -------------------------------------------------------
  var ch = row("need-chickens-b");
  ok("as run (twice): the 35B asked the person how many chickens, Lantern searched the library, and its last reply was Not in my library",
    /^NEED: How many chickens do you have/.test(ch.first) && ch.reply === "ANSWER: Not in my library." && ch.rounds === 2 && ch.library.sources.indexOf("Chicken") >= 0 &&
    row1("need-chickens-b").reply === ch.reply);
  var fc = fake([ch.first, ch.reply]), sc = await A.solve(ch.q, { call: fc });
  ok("now: the library had nothing, so the AI\u2019s question to the person stands", sc.text === ch.first && sc.needKept && L.aiBench.grade(item("need-chickens-b"), sc.text, sc).pass, [sc.text, sc.rounds]);
  var fcc = fake([ch.first, ch.reply]), cc = await C.converse([ch.q], { call: fcc }), ct = (cc.turns || cc)[0] || {};
  ok("...and in Chat", ct.final === ch.first && ct.needKept, [ct.final]);
  var fe = fake(["NEED: How much feed do your chickens need for a month?", ch.reply]), se = await A.solve(ch.q, { call: fe });
  ok("a NEED that only says the question again is not brought back: the decline stands", se.text === ch.reply && !se.needKept, se.text);
  ok("...nor the other way: what the needs of the person are, and what is the question again",
    A.needAsksPerson(ch.first, ch.q) && !A.needAsksPerson("NEED: How much feed do your chickens need for a month?", ch.q) && !A.needAsksPerson("the feed per chicken per day", ch.q));
  ok("(its review) the question again with a word of its own, or a NEED for the library, is not the person\u2019s; \u201chow many chickens do you have\u201d with only the question\u2019s words is",
    !A.needAsksPerson("How much feed do your hens need for a month?") && !A.needAsksPerson("How much feed do your chickens need for a whole month? Please specify.") &&
    !A.needAsksPerson("Can you look up how much feed chickens need in the library?") && !A.needAsksPerson("Data from your offline library on chicken feed") &&
    A.needAsksPerson("How many chickens do you have, and how much feed do they need in a month?", ch.q) &&
    A.needAsksPerson("What is the capacity of your battery in amp-hours?", "How many hours will my solar battery run my fridge?"));
  ok("(its second review) not for a question about no one\u2019s things, the question\u2019s own \u201cyou\u201d, nor what is to come or now",
    !A.needAsksPerson("How many eggs do you get from a hen in a year?", "How many eggs do you get from a hen in a year?") &&
    !A.needAsksPerson("How much water do you use to cook rice?", "How much water do you use to cook rice?") &&
    !A.needAsksPerson("How many hens do you keep?", "How many calories does a hen need a day?") &&
    !A.needAsksPerson("What is your location?", "Will it rain tomorrow in my town?") &&
    A.needAsksPerson("How many people are in your family?", "How many eggs does my family need each week?") && A.needAsksPerson("How many watts does your cabin use each day?", "How big a battery does my cabin need?"));
  ok("(its second review) a decline that goes on with a sentence of its own, or a quote, is not the decline alone; a reason about the passages is",
    !A.bareDecline("ANSWER: Not in my library. A laying hen eats a quarter pound of feed a day.") && !A.bareDecline("ANSWER: Not in my library. Passage one says \x22a flock forages and is fed grain\x22.") &&
    A.bareDecline("ANSWER: Not in my library. The passages are about a charity and about chickens in general.") && A.bareDecline("ANSWER: Not in my library."));
  var fo = fake([ch.first, "ANSWER: Not in my library. From my own knowledge: a hen eats about 120 g a day, so about 3.6 kg a month."]), so = await A.solve(ch.q, { call: fo });
  ok("(its review) a decline that goes on with the AI\u2019s own knowledge is left as it is", /3\.6 kg/.test(so.text) && !so.needKept, so.text);
  var fl = fake([ch.first, "=12*0.12*30\nANSWER: About {result} kg for 12 chickens [1]."]), sl = await A.solve(ch.q, { call: fl });
  ok("a reply after the library that is not a decline is left as it is", /^=12\*0\.12\*30/.test(sl.text) && !sl.needKept, sl.text);

  // --- the library: the article the question's words name, after a decline ------------------------------------------
  var gh = row("ghana-capital-b");
  ok("as run (twice): LOOKUP Ghana capital gave Capital punishment in Ghana, Capital Bank (Ghana) and a road, and the 35B declined",
    gh.library.sources.join("|") === "Capital punishment in Ghana|Capital Bank (Ghana)|R10 road (Ghana)" && gh.reply === "ANSWER: Not in my library." && row1("ghana-capital-b").reply === gh.reply);
  var lk = await L.assistLookup("What is the capital of Ghana?", "Ghana capital");
  ok("now: the three sent are as before, and Ghana, read but ranked below them, is kept back as more",
    lk.sources.map(function (s) { return s.title; }).join("|") === "Capital punishment in Ghana|Capital Bank (Ghana)|R10 road (Ghana)" && lk.more.length === 1 && lk.more[0].title === "Ghana" && lk.more[0].n === 4 &&
    /\x5B4\x5D Ghana/.test(lk.morePrompt) && /from passages \x5B1\x5D to \x5B4\x5D/.test(lk.morePrompt), [lk.sources.map(function (s) { return s.title; }), lk.more.map(function (s) { return s.title; })]);
  var fg = fake(["LOOKUP: Ghana capital", "ANSWER: Not in my library.", "ANSWER: The capital of Ghana is Accra [4].\nQUOTE [4]: The capital and largest city is Accra."]);
  var sg = await A.solve("What is the capital of Ghana?", { call: fg });
  ok("...and sent once the AI declines with the three in front of it; its [4] is a passage Lantern checks",
    /Accra \x5B4\x5D/.test(sg.text) && sg.more.join() === "Ghana" && sg.sources.length === 4 && sg.rounds === 3 && !(sg.flags || []).length, [sg.text, sg.rounds, sg.flags]);
  var fa = fake(["LOOKUP: Ghana capital", "ANSWER: Capital punishment in Ghana is for high treason only [1].\nQUOTE [1]: Capital punishment is a legal penalty in Ghana only for high treason."]);
  var sa = await A.solve("What is the capital of Ghana?", { call: fa });
  ok("an answer from the three sent is left: nothing more is sent", sa.rounds === 2 && !sa.more, [sa.rounds, sa.more]);
  var fgc = fake(["LOOKUP: Ghana capital", "ANSWER: Not in my library.", "ANSWER: The capital of Ghana is Accra [4].\nQUOTE [4]: The capital and largest city is Accra."]);
  var cg = await C.converse(["What is the capital of Ghana?"], { call: fgc }), cgt = (cg.turns || cg)[0] || {};
  ok("...and in Chat", /Accra/.test(cgt.final) && (cgt.more || []).join() === "Ghana" && /Lantern also read these articles/.test(said(fgc.seen[2][fgc.seen[2].length - 1])), [cgt.final, cgt.more]);
  var lp = await L.assistLookup("What is the capital of my country, Ghana?", "Ghana capital");
  ok("never for a question about the person\u2019s own things", !lp.more.length, lp.more.map(function (s) { return s.title; }));
  var pk = await L.assistLookup("What is the population of Paris, Kentucky?", "Paris Kentucky population"), sl2 = await L.assistLookup("What is the speed of light?", "speed of light");
  ok("(its review) only an article that has every name the question has (not Paris for Paris, Kentucky), and none for a question that names nothing (the speed of light)",
    !pk.more.some(function (s) { return s.title === "Paris"; }) && !sl2.more.length, [pk.more.map(function (s) { return s.title; }), sl2.more.map(function (s) { return s.title; })]);
  var ln = await L.assistLookup("What is the capital of Niger?", "capital of Niger"), la = await L.assistLookup("What is the capital of Austria?", "capital of Austria"),
    li = await L.assistLookup("What is the capital of India?", "capital of India");
  function tl(x) { return x.sources.concat(x.more).map(function (s) { return s.title; }); }
  ok("(its second review) a name is matched whole: not Nigeria for Niger, Australia for Austria, Indiana for India -- as more",
    !ln.more.length && !la.more.length && !li.more.some(function (s) { return s.title === "Indiana"; }), [tl(ln), tl(la), tl(li)]);
  var gc = await L.assistLookup("Ghana's capital?", "Ghana capital");
  ok("(its second review) a name may be the first word (Ghana\u2019s capital?)", gc.more.some(function (s) { return s.title === "Ghana"; }), gc.more.map(function (s) { return s.title; }));
  var gx = await L.assistLookup("How do I replace the battery in a Samsung Galaxy S7?", "");
  var shown = gx.sources.map(function (s) { return s.title; }), kept = gx.more.map(function (s) { return s.title; });
  ok("the Galaxy S7: its own guide is sent with the three, or kept back as more; never the Edge\u2019s or the Tab\u2019s as more",
    (shown.indexOf("Samsung Galaxy S7 Battery Replacement") >= 0 || kept.indexOf("Samsung Galaxy S7 Battery Replacement") >= 0) && !kept.some(function (t) { return /Edge|Tab/.test(t); }), [shown, kept]);

  // --- photosynthesis: a word typed from nowhere ----------------------------------------------------------------------
  var ph = row("letters-photosynthesis-b"), pq = ph.q;
  ok("as run (twice): =REVERSE(\u201cphotosynthesis\u201d), then =REMOVE(\u201cnoitucisohp\u201d,\u201cs\u201d) typed from nowhere, 10 letters",
    /=REMOVE\(\x22noitucisohp\x22,\x22s\x22\)/.test(ph.reply) && row1("letters-photosynthesis-b").reply === ph.reply);
  var pp = A.parseReply(ph.reply), pr = A.run(pp.exprText), rt = L.aiResultChecks.retyped(pr.steps, pq, false, pp.answer);
  ok("now: line 2 is questioned as a result typed out (line 1 gave \u201csisehtnysotohp\u201d), and line 3, a copy of line 2\u2019s, is not put on line 1",
    rt.length === 1 && rt[0].k === 1 && rt[0].j === 0 && rt[0].lit === "noitucisohp", rt);
  var fp = fake([ph.reply, "=REVERSE(\x22photosynthesis\x22)\n=REMOVE(ANS1,\x22s\x22)\n=LEN(ANS2)\nANSWER: What is left is {ANS2}, which has {ANS3} letters."]);
  var cp = await C.converse([pq], { call: fp }), cpt = (cp.turns || cp)[0] || {};
  ok("...in Chat it goes back once with \u201cwrite ANS1\u201d, and the corrected lines give iehtnyotohp, 11 letters",
    /line 2 types \u201cnoitucisohp\u201d, but line 1 gave \u201csisehtnysotohp\u201d: write ANS1/.test(said(fp.seen[1][fp.seen[1].length - 1])) && /iehtnyotohp, which has 11 letters/.test(cpt.answerText || ""),
    [cpt.answerText, fp.seen.length]);
  var guardN = 0, guardQ = [];
  F1.passed.concat(F.passed).forEach(function (r) {
    var t = String(r.reply || ""), p0 = A.parseReply(t);
    if (!p0.exprText) return;
    guardN++;
    var rr = L.aiResultChecks.retyped(A.run(p0.exprText).steps, r.q);
    if (rr.length) guardQ.push([r.id, rr]);
  });
  ok("no passed chain of either run is questioned as typing a result out (" + guardN + ")", guardN === 87 && !guardQ.length, guardQ);
  function qd(q0, t) { var p0 = A.parseReply(t); return L.aiResultChecks.check(q0, p0.exprText, A.run(p0.exprText), { parsed: p0 }); }
  ok("(its review) two words worked out side by side are not questioned (fluorine and chlorine reversed; nitrogen and oxygen in capitals)",
    !qd("Spell the first two halogens backwards.", "=REVERSE(\x22fluorine\x22)\n=REVERSE(\x22chlorine\x22)\nANSWER: {ANS1} and {ANS2}") &&
    !qd("Spell the first two halogens backwards.", "=REVERSE(\x22fluorine\x22)\n=REVERSE(\x22chlorine\x22)\nANSWER: eniroulf and enirolhc") &&
    !qd("Write the two main gases in air in capitals.", "=UPPER(\x22nitrogen\x22)\n=UPPER(\x22oxygen\x22)\nANSWER: NITROGEN and OXYGEN"));
  ok("(its review) a word that is exactly an earlier line\u2019s result is no slip (=UPPER(\u201cdesserts\u201d) under =REVERSE(\u201cstressed\u201d))",
    !qd("Reverse stressed, swap its s for z, and write the reversed word in capitals.", "=REVERSE(\x22stressed\x22)\n=SUBSTITUTE(ANS1,\x22s\x22,\x22z\x22)\n=UPPER(\x22desserts\x22)\nANSWER: {ANS2} and {ANS3}"));
  var rcP = L.aiResultChecks.rechain(pp.exprText, pr.steps, pq);
  ok("(its review) Lantern never puts a result in place of such a word itself: it asks", !rcP || !rcP.changes.some(function (c) { return /noitucisohp/.test(c.from); }), rcP && rcP.changes);

  // --- the colour wheel -----------------------------------------------------------------------------------------------
  var cw = row("make-colour-wheel-b"), mw = L.aiAct.build(cw.reply, cw.q), sj = JSON.stringify(mw.shapes);
  ok("as run (twice): the wheel\u2019s parts Primary and Secondary, its items the six colours", /Primary: Red \| Yellow \| Blue/.test(cw.reply) && row1("make-colour-wheel-b").reply === cw.reply);
  ok("now: each item named after a colour is painted that colour (Red, Yellow, Blue, Orange, Green, Violet)",
    ["#ef4444", "#facc15", "#3b82f6", "#f97316", "#22c55e", "#8b5cf6"].every(function (c) { return sj.indexOf(c) >= 0; }) && mw.ok, mw.problems);
  var tw = JSON.stringify(L.aiAct.build("MAKE WHEEL: Fruit\nApples: Red apples | Green apples\nPears: Conference | Williams\nEND", "Draw a wheel of fruit").shapes);
  ok("...but not an item that only begins with a colour (Red apples)", tw.indexOf("#ef4444") < 0 && tw.indexOf("#22c55e") < 0);
  var tea = JSON.stringify(L.aiAct.build("MAKE WHEEL: Teas\nDark: Black | Oolong\nLight: Green | White\nEND", "Draw a wheel of teas").shapes);
  var tert = JSON.stringify(L.aiAct.build("MAKE WHEEL: Twelve colours\nWarm: Red | Red-Orange | Orange | Yellow-Orange | Yellow | Yellow-Green\nCool: Green | Blue-Green | Blue | Blue-Violet | Violet | Red-Violet\nEND", "Draw a twelve-colour wheel").shapes);
  ok("(its review) only a wheel whose every item is a colour: a tea wheel\u2019s Black and Green stay; Red-Orange and Blue-Violet are painted",
    tea.indexOf("#22c55e") < 0 && tea.indexOf("#111827") < 0 && tert.indexOf("#f4511e") >= 0 && tert.indexOf("#7c3aed") >= 0);

  // --- the review of 1.24.18's rules (fixtures/review1_1258.json): its NEED cases and its chains, replayed ---------------
  var RV = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1258.json"), "utf8")), mv1 = [], mv3 = [], worse3 = 0, n1 = 0, n3 = 0;
  function fk(replies) { var i = 0; return function () { return Promise.resolve(replies[Math.min(i++, replies.length - 1)]); }; }
  for (var ci = 0; ci < RV.cases.length; ci++) {
    var c = RV.cases[ci];
    if (c.rule === 1) {
      var fin = c.path === "assist" ? (await A.solve(c.input.q, { call: fk(c.input.replies) })).text : (((await C.converse([c.input.q], { call: fk(c.input.replies) })).turns || [])[0] || {}).final;
      n1++; if (String(fin || "") !== c.final_now) mv1.push([c.id, fin]);
    } else if (c.rule === 3 && c.input.chain) {
      var p3 = A.parseReply(c.input.chain), st3 = L.aiResultChecks.check(c.input.q, p3.exprText, A.run(p3.exprText), { parsed: p3 }) ? "questioned" : "not questioned";
      n3++; if (st3 !== c.questioned_now) mv3.push([c.id, st3]);
      if (st3 === "questioned" && c.questioned_1_24_17 === "not questioned" && !/^questioned/.test(c.expected)) worse3++;
    }
  }
  ok("the review\u2019s " + n1 + " NEED cases (both paths) end as recorded, every one as it said", n1 === 58 && !mv1.length &&
    RV.cases.filter(function (c) { return c.rule === 1; }).every(function (c) { return c.ok_now; }), mv1);
  ok("the review\u2019s " + n3 + " chains are questioned as recorded, and none that 1.24.17 left alone and should be left alone is questioned now", n3 === 64 && !mv3.length && worse3 === 0, [mv3, worse3]);

  // --- the guard: every reply that passed still passes ------------------------------------------------------------------
  var bad = [], n = 0;
  F.passed.forEach(function (r) {
    var it = item(r.id), g = null;
    if (!it || !/^(make|tool|multi|need|unknown|safety)$/.test(r.cat)) return;
    try { g = L.aiBench.grade(it, r.reply, r.cat === "make" ? { made: L.aiAct.build(r.reply, it.q) } : {}); } catch (e) { g = { pass: false, why: "threw " + e.message }; }
    n++;
    if (!g.pass) bad.push([r.id, g.why]);
  });
  ok("every passed sum, picture, program and tune of the run passes still (" + n + ")", n === 75 && !bad.length, bad);

  console.log(fails ? fails + " BENCH 1.24.18 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.18 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
