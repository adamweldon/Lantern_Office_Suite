// Engine tests for COMPOSE_TEXT + COMPOSE_CHECK, the thesaurus and their data modules,
// run on the module blocks taken straight from the suite source.
// Usage: node tests/compose_engine.js [inner.html | dir-with-module-files]
var fs = require("fs"), path = require("path"), vm = require("vm");
var src = process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html");
var ctx = { window: {} };
ctx.window.Lantern = { el: function () {} };
vm.createContext(ctx);
function load(code) { vm.runInContext(code, ctx); }
if (fs.statSync(src).isDirectory()) {
  ["01_COMPOSE_TEXT.js", "02_COMPOSE_RULES.js", "03_COMPOSE_RULES_USAGE.js", "04_COMPOSE_SPELL.js", "05_COMPOSE_CHECK.js", "05b_COMPOSE_CHECK_STYLE.js",
    "06_COMPOSE_THESAURUS.js", "06b_COMPOSE_INFLECT.js", "07_COMPOSE_THESAURUS_B.js"]
    .forEach(function (f) { load(fs.readFileSync(path.join(src, f), "utf8")); });
} else {
  var inner = fs.readFileSync(src, "utf8");
  ["COMPOSE_TEXT", "COMPOSE_RULES", "COMPOSE_RULES_USAGE", "COMPOSE_SPELL", "COMPOSE_CHECK", "COMPOSE_CHECK_STYLE",
    "COMPOSE_THESAURUS", "COMPOSE_INFLECT", "COMPOSE_THESAURUS_B"].forEach(function (n) {
    var a = inner.indexOf("// MODULE: " + n + " - START"), b = inner.indexOf("// MODULE: " + n + " - END");
    load(inner.slice(a, b));
  });
}
var C = ctx.window.Lantern.compose, T = C.text;
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info)); } }
function fixes(text) { return C.check(text).filter(function (x) { return x.fix != null; }).map(function (x) { return text.slice(x.start, x.end) + "->" + x.fix; }); }
function has(text, pair) { var f = fixes(text); return f.indexOf(pair) !== -1 ? true : f; }

// --- text engine ---
ok("sentences: abbreviations", T.sentences("Dr. Smith came at 5 p.m. He sat.").length === 2);
ok("sentences: decimals", T.sentences("It cost 3.5 dollars. Fine.").length === 2);
ok("sentences: newline ends", T.sentences("Title\nBody text here.").length === 2);
ok("syllables", T.syllables("readability") === 5 && T.syllables("water") === 2 && T.syllables("boxes") === 2);
var st = T.stats("The cat sat on the mat.");
ok("flesch ease", Math.abs(st.ease - 116.1) < 0.05, st.ease);
ok("fk grade", Math.abs(st.grade - (-1.4)) < 0.05, st.grade);
var hard = T.stats("Comprehensive institutional accountability necessitates systematic evaluation of organizational performance indicators.");
ok("hard text scores hard", hard.ease < 0 && hard.grade > 16, [hard.ease, hard.grade]);
ok("easeLabel", T.easeLabel(65) === "Plain English" && T.gradeLabel(7.4) === "Grade 7");
ok("caseLike", T.caseLike("Teh", "the") === "The" && T.caseLike("TEH", "the") === "THE");

// --- checker: each rule fires with the right fix ---
var cases = [
  ["I recieve your letter.", "recieve->receive"],
  ["Teh results are in.", "Teh->The"],
  ["We dont know.", "dont->don't"],
  ["I saw the the dog.", "the the->the"],
  ["She ate a apple.", "a->an"],
  ["It took an hour. He was a honest man.", "a->an"],
  ["We need an useful tool.", "an->a"],
  ["You should of called.", "should of->should have"],
  ["Your welcome to come.", "Your welcome->You're welcome"],
  ["Its a good day.", "Its a->It's a"],
  ["He is taller then me.", "taller then->taller than"],
  ["Their are many trees.", "Their are->There are"],
  ["They sold there car.", "there car->their car"],
  ["I ate to much rice.", "to much->too much"],
  ["I want to loose weight.", "loose weight->lose weight"],
  ["Ask weather or not it rains.", "weather or not->whether or not"],
  ["I can't breath here.", "can't breath->can't breathe"],
  ["Thank you for the advise.", "the advise->the advice"],
  ["This is more better.", "more better->better"],
  ["Yesterday i went home.", "i->I"],
  ["it rained. we stayed in.", "w->W"],
  ["Hello  there friend.", "  -> "],
  ["Wait , please.", " ,->,"],
  ["Eggs,milk and bread.", ",m->, m"],
  ["It ended.Then we left.", "d.Th->d. Th"],
  ["Stop!!! Now.", "!!!->!"],
  ["We will meet in order to plan.", "in order to->to"],
  ["Please utilize the form.", "utilize->use"],
  ["The food was very good.", "very good->excellent"],
  ["I am writing to ask about the job that I saw", "saw->saw."],
  ["There were less people today.", "less people->fewer people"]
];
cases.forEach(function (c) { ok("rule: " + c[1], has(c[0], c[1]) === true, has(c[0], c[1])); });

// --- hints without fixes ---
ok("passive hint", C.check("The window was broken by the boys.").some(function (x) { return x.rule === "passive"; }));
ok("passive skips letter idioms", !C.check("My CV is attached. All parents are invited. No one was hurt.").some(function (x) { return x.rule === "passive"; }));
ok("lower-case after full stop still flagged", C.check("He left. then she came.").some(function (x) { return x.rule === "caps"; }));
ok("passive skips states", !C.check("I am tired and she is interested.").some(function (x) { return x.rule === "passive"; }));
ok("long sentence hint", C.check(new Array(36).join("word ") + "end.").some(function (x) { return x.rule === "long"; }));
ok("bracket hint", C.check("We met (at noon.").some(function (x) { return x.rule === "bracket"; }));
ok("quote hint", C.check("He said \"come here.").some(function (x) { return x.rule === "quote"; }));

// --- no false alarms on clean, correct text ---
var clean = [
  "I had had enough. He said that that was fine.",
  "Mr. Banda arrived at 3.45 p.m. on Monday.",
  "There is their house, and it is bigger than ours.",
  "It's a fine day; its colour is bright.",
  "We went to the market, then to the school.",
  "A university, a one-way street, an hour, an honest answer, a European car.",
  "She is a user of an umbrella and a unit leader.",
  "Please accept the gift. Everyone came except Tom.",
  "Wait... then go. Done.",
  "The visit (a short one) was useful.",
  "e.g. this is fine.",
  "I bought 2 kg of rice for 1,500 shillings.",
  "\u201cRun!\u201d shouted Ama. \u201cWhere are you?\u201d asked her brother.",
  "\"Stop!\" cried the guard, and we stopped."
];
clean.forEach(function (t) {
  var iss = C.check(t).filter(function (x) { return x.kind !== "style"; });
  ok("clean: " + t, iss.length === 0, iss.map(function (x) { return x.rule + ":" + t.slice(x.start, x.end); }));
});

// --- skip ranges excuse headings/lists ---
var doc = "my shopping list\nAnd then we bought bread milk and eggs for the week";
var sk = C.check(doc, { skip: [[0, 16]] });
ok("skip: heading not capitalised-flagged", !sk.some(function (x) { return x.rule === "caps" && x.start < 16; }));
ok("skip: body still checked", sk.some(function (x) { return x.rule === "end"; }));

// --- applyFixes ---
var t1 = "i recieve the the letter and and it was very good";
var r1 = C.applyFixes(t1, C.check(t1), function (x) { return x.safe; });
ok("applyFixes safe", r1.text === "I receive the letter and it was very good.", r1.text);
var t2 = "Their are alot of things.";
ok("applyFixes all", C.applyFixes(t2, C.check(t2)).text === "There are a lot of things.", C.applyFixes(t2, C.check(t2)).text);
var tl = C.tally(C.check(t1));
ok("tally", tl.total >= 4 && tl.spelling >= 1 && tl.fixable >= 4, tl);

// --- data integrity ---
ok("spell size", Object.keys(C.spell).length >= 400, Object.keys(C.spell).length);
ok("no spell key maps to itself", Object.keys(C.spell).every(function (k) { return k !== C.spell[k].toLowerCase(); }));
ok("usage rules compile", C.rules.usage.length >= 35 && C.rules.usage.every(function (r) { return typeof r[0].exec === "function" && r[0].global; }));

// --- thesaurus keeps the word's form ---
function syn(w) { var r = C.synonyms(w); return r ? r.words : []; }
ok("past tense: walked -> strolled", syn("walked").indexOf("strolled") >= 0, syn("walked"));
ok("doubling: walked -> stepped", syn("walked").indexOf("stepped") >= 0, syn("walked"));
ok("-ing: running -> sprinting", syn("running").indexOf("sprinting") >= 0, syn("running"));
ok("participle: gone -> departed", syn("gone").indexOf("departed") >= 0, syn("gone"));
ok("irregular past: said -> told", syn("said").indexOf("told") >= 0, syn("said"));
ok("-ly: quickly -> rapidly", syn("quickly").indexOf("rapidly") >= 0, syn("quickly"));
ok("-ily: happily -> cheerfully", syn("happily").indexOf("cheerfully") >= 0, syn("happily"));
ok("plural kept: things -> objects", syn("things").indexOf("objects") >= 0, syn("things"));
ok("no noun as verb: planned", syn("planned").indexOf("ideaed") < 0 && syn("planned").indexOf("designed") >= 0, syn("planned"));
ok("no adjective as verb: cleaned", syn("cleaned").every(function (x) { return !/ed$/.test(x) || x === "washed"; }), syn("cleaned"));
ok("-e verbs: fighting -> arguing", syn("fighting").indexOf("arguing") >= 0, syn("fighting"));
ok("inflect alone", C.inflect("carry out", "ed") === "carried out" && C.inflect("prefer", "ing") === "preferring" &&
  C.inflect("shy", "ly") === "shyly" && C.inflect("idea", "ed") === null, [C.inflect("carry out", "ed"), C.inflect("prefer", "ing"), C.inflect("shy", "ly")]);

console.log(fails ? fails + " ENGINE FAILURES (" + passes + " passed)" : "ALL COMPOSE ENGINE TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
