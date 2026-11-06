// lesson_search.js -- which lesson Chat reads by itself for a how-to (1.24.5).
// Before: only the best-scoring lesson was looked at, and it was taken when
// one rare word of the question was in its title. So "How do I dig a well?"
// was given Deciding well, "How do I tan a hide?" trigonometry, "How do I
// prevent scurvy?" Engine care that prevents repair -- and "How do I patch
// an inner tube?", "How do I purify water?" and "How do I find north without
// a compass?" were given nothing, though a lesson answers each.
//  - SUITE_SEARCH: a hit says how much of the question it has BY WEIGHT
//    (wcover) and whether a rare word of the question is in it (rare);
//  - SUITE_PASSAGES: the first of the best five that is sure to be about the
//    question; then others of its tile, and from elsewhere only sure ones;
//  - LESSON_WORDS and Lantern.mathLessons.about: the words people ask with;
//  - a lesson asked for by its title, and the AI's own LESSON: request, are
//    as they were.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load(strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new TypeError("no model in this test")); };
  w.eval(js);
  return { w: w, L: w.Lantern, d: w.document, errs: errs };
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }

var o = load(), L = o.L, S = L.suite, ML = L.mathLessons;
ok("boot clean", o.errs.length === 0, o.errs);
function keys(q) { return S.passages(q, q, { detail: true, max: 3, strong: true }).map(function (p) { return p.key; }); }
function tileOf(k) { var e = S.entries().filter(function (x) { return x.id === k && (x.kind === "lesson" || x.kind === "guide"); })[0]; return e ? e.app : ""; }

// --- found now ----------------------------------------------------------------------------------
var FOUND = [
  ["How do I patch an inner tube?", "rep_flat"], ["How do I purify water?", "health_water"], ["How do I dry fruit?", "food_preserve"],
  ["How do I clean a carburettor?", "rep_maintain"], ["How do I prevent scurvy?", "food_micro"], ["How do I rotate crops?", "farm_rotation"],
  ["How do I find north without a compass?", "sky_stars"], ["How do I dry apples?", "health_food"], ["How do I make sauerkraut?", "food_ferment"], ["How do I pasteurise milk?", "food_milk"], ["How to treat a sick chicken?", "hus_chickens"], ["What should I feed laying hens?", "hus_chickens"]
];
var miss = FOUND.filter(function (f) { return keys(f[0])[0] !== f[1]; }).map(function (f) { return [f[0], keys(f[0])]; });
ok("a lesson that answers is found though its title does not carry the word (" + FOUND.length + " questions)", miss.length === 0, miss);
ok("...finding north gives both ways, by the stars and by the sun", keys("How do I find north without a compass?").join() === "sky_stars,sky_sun", keys("How do I find north without a compass?"));
ok("...a sick chicken: the chickens lesson, then the animals’ illness lesson, and nothing about sick people",
  keys("How to treat a sick chicken?").slice(0, 2).join() === "hus_chickens,hus_illness" && !keys("How to treat a sick chicken?").some(function (k) { return /^health_/.test(k); }), keys("How to treat a sick chicken?"));

// --- as before --------------------------------------------------------------------------------------
var SAME = [
  ["How do I fix a flat bicycle tyre?", "rep_flat"], ["How do I make compost?", "farm_soil"], ["How do I settle a dispute between neighbours fairly?", "civ_dispute"],
  ["How do I teach a child to read?", "lit_teach"], ["How do I milk a goat?", "hus_goats"], ["How would I start a farm and raise goats?", "hus_goats"],
  ["How can we make decisions fairly in a village meeting?", "civ_meeting"], ["How do I read a map scale?", "geo_map"], ["How do I set a broken bone?", "health_breaks"],
  ["How do I keep chickens safe from predators?", "hus_chickens"], ["How do I tell the time from the sun?", "sky_sun"], ["How do I replace a bicycle brake cable?", "rep_drivetrain"]
];
miss = SAME.filter(function (f) { return keys(f[0])[0] !== f[1]; }).map(function (f) { return [f[0], keys(f[0])]; });
ok("the lesson named in the question is still the first (" + SAME.length + " questions)", miss.length === 0, miss);

// --- the company it keeps ------------------------------------------------------------------------------
var strays = [["How do I keep chickens safe from predators?", /^(food_|health_)/], ["How do I teach a child to read?", /^health_/], ["How do I read a map scale?", /^(mus_|ratio_)/],
  ["How do I keep my chickens safe from foxes and hawks at night in the rainy season?", /^sky_/], ["How do I milk a goat?", /^food_/]]
  .filter(function (x) { return keys(x[0]).some(function (k) { return x[1].test(k); }); }).map(function (x) { return [x[0], keys(x[0])]; });
ok("lessons from another tile that share one word no longer come along (food safety for chickens kept safe, music scales for a map scale)", strays.length === 0, strays);
ok("...a lesson of the same tile still does (how an engine works, then engine care)", keys("How do I adjust the valves on a small engine?").join() === "rep_engine,rep_maintain", keys("How do I adjust the valves on a small engine?"));
ok("...and one from another tile only when it is about the same thing, or brings a rarer word the first lacks (goat\u2019s milk: the goats lesson, then Milk and eggs for pasteurise; river water: the two water lessons)",
  keys("How do I pasteurise milk from my goat?").join() === "hus_goats,food_milk" && keys("How do I make river water safe to drink?").slice(0, 2).join() === "health_water,health_waterstore" &&
  keys("How would I start a farm and raise goats?").join() === "hus_goats", [keys("How do I pasteurise milk from my goat?"), keys("How do I make river water safe to drink?"), keys("How would I start a farm and raise goats?")]);

// --- nothing, where Lantern has nothing -----------------------------------------------------------------
var NONE = ["How do I tan a hide?", "How do I dig a well?", "How do I weld two steel plates?", "How do I make a fire without matches?", "How do I change the oil in a tractor?",
  "How do I keep water out of my boots?", "How do I make soap?", "How do I keep bees?", "How do I sharpen a knife?", "How do I make charcoal?", "How do I make glass?",
  "How do I tie a tie?", "How do I build a boat?", "How do I shoe a horse?", "How do I knit a scarf?"];
var got = NONE.filter(function (q) { return keys(q).length; }).map(function (q) { return [q, keys(q)]; });
ok("no lesson is given where none answers (" + NONE.length + " questions; before, a well got Deciding well and a hide got trigonometry)", got.length === 0, got);

// --- what a hit says --------------------------------------------------------------------------------------
function hit(q, id) { return S.search(q, { kinds: { lesson: 1, guide: 1 }, max: 12 }).filter(function (h) { return h.e.id === id; })[0]; }
var hw = hit("How do I dig a well?", "mind_decide"), hf = hit("How do I patch an inner tube?", "rep_flat"), ht = hit("How do I tan a hide?", "trig");
ok("a hit says how much of the question it has by weight: the word that names the topic missing is less than half",
  hw && hw.strong >= 1 && hw.wcover < 0.5 && ht && ht.wcover < 0.5 && hf && hf.wcover >= 0.6 && hf.rare === true, [hw && hw.wcover, ht && ht.wcover, hf && hf.wcover]);
var ex = S.search("Deciding well", { kinds: { lesson: 1 } })[0];
ok("a lesson asked for by its title is first, exact, and has all of the question", ex.e.id === "mind_decide" && ex.exact === true && ex.wcover === 1);
ok("...and Chat’s automatic reading gives it", keys("Deciding well")[0] === "mind_decide");
// the AI's own request (not the strong path) reads as it did: best match, blended with the question
var own = S.passages("My hens have stopped laying eggs. What should I check?", "HEN HEALTH", { detail: true, max: 3 });
ok("the AI’s own LESSON: request is read as before (hen health for hens that stopped laying: Chickens & eggs first)", own.length && own[0].key === "hus_chickens", own.map(function (p) { return p.key; }));

// --- the words people ask with -------------------------------------------------------------------------------
var W = L.lessonWords || {}, wk = Object.keys(W);
ok("LESSON_WORDS: a table of lesson -> words, every key a lesson that is loaded", wk.length >= 10 && wk.every(function (k) { return ML.has(k); }), wk.filter(function (k) { return !ML.has(k); }));
ok("...kept by the lesson (about), returned by get(), and indexed as its description", ML.about("rep_flat") === W.rep_flat && ML.get("rep_flat").about === W.rep_flat &&
  S.entries().filter(function (e) { return e.kind === "lesson" && e.id === "rep_flat"; })[0].desc === W.rep_flat);
function plain(k) { return String(ML.get(k).html).replace(/<[^>]*>/g, " ").replace(/&[a-z0-9#]+;/g, " ").toLowerCase(); }
// every word of a lesson's "about" line is for something the lesson says: its stem is in the lesson, or it is one of the other names listed here
var OTHER = { purify: 1, purifying: 1, jerky: 1, pasteurise: 1, puncture: 1, inner: 1, compass: 1, weaning: 1, deficiency: 1, pickled: 1, sourdough: 1, firewood: 1, granary: 1, temperature: 1, sodis: 1 };
var FRUIT = { apples: 1, mangoes: 1, bananas: 1, apricots: 1, figs: 1, grapes: 1 };   // kinds of fruit, for the lessons on drying fruit
var PLAIN = { find: 1, without: 1, making: 1, left: 1, out: 1 };   // words of a phrase (“find north without a compass”), not topics
var loose = [];
wk.forEach(function (k) {
  var body = S.terms(plain(k) + " " + ML.get(k).title, true), has = {};
  body.forEach(function (t) { has[t] = 1; });
  W[k].toLowerCase().split(/[^a-z0-9-]+/).forEach(function (wd) {
    if (!wd || OTHER[wd] || PLAIN[wd] || (FRUIT[wd] && /fruit/.test(plain(k)))) return;
    var st = S.terms(wd, true)[0];
    if (st && !has[st]) loose.push(k + ":" + wd);
  });
});
ok("...only words for what the lesson really says (each is in the lesson, or is a listed other name for it)", loose.length === 0, loose);
ML.add("zz_test", "A plain title", "<p>Soak the wick in tallow.</p>", { about: "candle making, rushlight" });
ok("a lesson can bring its own words: add(key, title, html, {about})", ML.about("zz_test") === "candle making, rushlight" && ML.get("zz_test").about === "candle making, rushlight");
ML.about("zz_later", "set before the lesson exists");
ML.add("zz_later", "Later", "<p>x</p>");
ok("...and about() set before the lesson is added is kept", ML.get("zz_later").about === "set before the lesson exists");
var cat = S.entries().filter(function (e) { return e.kind === "lesson" && e.id === "sky_stars"; })[0];
ok("the Search tile and the AI’s catalog show the words under the title", /Polaris/.test(cat.desc) && /compass/.test(cat.desc));

// --- without the table (rule 11) ---------------------------------------------------------------------------------
var o2 = load(["LESSON_WORDS"]), S2 = o2.L.suite;
function keys2(q) { return S2.passages(q, q, { detail: true, max: 3, strong: true }).map(function (p) { return p.key; }); }
ok("without LESSON_WORDS: boot clean, no words, title matches still found, and the wrong lessons still not given",
  o2.errs.length === 0 && o2.L.lessonWords === undefined && o2.L.mathLessons.about("rep_flat") === "" && keys2("How do I fix a flat bicycle tyre?")[0] === "rep_flat" &&
  keys2("How do I dig a well?").length === 0 && keys2("How do I patch an inner tube?")[0] === "rep_flat" && keys2("How do I purify water?").length === 0,
  [o2.errs, keys2("How do I patch an inner tube?"), keys2("How do I purify water?")]);

console.log(fails ? fails + " LESSON SEARCH FAILURES (" + passes + " passed)" : "ALL LESSON SEARCH TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
