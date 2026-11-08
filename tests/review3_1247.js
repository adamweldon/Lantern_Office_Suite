// review3_1247.js -- the third independent review of 1.24.7, replayed (2026-11-07).
// Before 1.24.7 was pushed, an agent that had not seen AI_SCENE or AI_READ
// written made inputs of its own to break them: 287 pictures right as
// written and 45 wrong ones, 154 replies a model might write, 88 questions
// about drops of bleach and 23 about the other one-blank recipes. On the
// draft it reviewed, 26 right pictures were changed or questioned, 15 wrong
// ones were mended into another wrong picture, 59 replies read otherwise
// than as written (38 of them right ones that 1.24.6 read correctly), 18
// bleach questions given the drinking-water dose that were not that
// question, and 9 right sums written with a recipe's own function told to
// be the recipe's. Its inputs are the fixtures; what Lantern now does with
// each is written beside it, and was looked at (the pictures side by side,
// as written and as drawn).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load() {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(JS);
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  return { L: w.Lantern, errs: errs };
}
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8")); }
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var S = L.aiScene, A = L.assist, SC = fixture("scene_review3_1247.json"), RD = fixture("read_review3_1247.json");
  ok("boot clean; the review\u2019s inputs: 287 right pictures, 45 wrong, 154 replies, 88 questions about bleach, 23 about the other recipes",
    o.errs.length === 0 && SC.right.length === 287 && SC.wrong.length === 45 && RD.replies.length === 154 && RD.bleach.length === 88 && RD.cards.length === 23, o.errs);

  // --- pictures right as written ---
  function mend(c) { return S.mend(c.lines.slice(), c.q); }
  function same(c) { var m = mend(c); return !m.said.length && !m.problems.length && m.lines.join("\n") === c.lines.join("\n"); }
  function r3(name) { return SC.right.filter(function (c) { return c.name === name; })[0]; }
  var touched = SC.right.filter(function (c) { return !same(c); });
  ok("of the 287 right pictures, one is changed, and it looks the same: a band written twice in a row, whose second line is left out and said",
    touched.length === 1 && touched[0].name === "DUP: identical consecutive lines (harmless repeat)" && mend(touched[0]).lines.join("|") === "rect 0 0 20 12 fill sky|rect 0 8 20 4 fill green|circle 16 2 1.2 fill yellow" &&
    mend(touched[0]).said.join() === "left out a background line that was written a second time (\u201crect 0 8 20 4 fill green\u201d): it covered nothing drawn in between", touched.map(function (c) { return [c.name, mend(c)]; }));
  function allSame(names) { return names.every(function (n) { return !!r3(n) && same(r3(n)); }); }
  ok("...a glow drawn round the sun stays behind it (a gold oval, an orange strip at sunset): the sun goes just behind the first thing it was drawn over, and a shape of its own colours is not that",
    allSame(["BREAK? gold glow oval then the sun (sunset over the sea)", "BREAK? orange glow rect (not wide) then the sun, sea"]));
  ok("...a round thing the question does not call the sun, drawn on a slope below the land\u2019s top, is a bush or a tree (gorse on a hill, an autumn tree on a short trunk); a gold one on the horizon of a field at dusk is a haystack as likely as the sun",
    allSame(["BREAK? lone yellow gorse bush on a hill slope, no sun", "BREAK? orange autumn tree on a hill, short line trunk, no sun", "BREAK? gold haystack centred on the horizon at dusk, no sun drawn"]));
  ok("...\u201ca light\u201d is a lamp: a ceiling lamp, a desk lamp, a traffic light, a lantern in a tree, a street lamp are not plain landscapes; \u201clight blue\u201d is a colour",
    allSame(["BREAK? hanging ceiling lamp (plain words: 'a light')", "GATE: desk lamp shade, bulb poking out below", "GATE: traffic light, lamps (r 1.3) wider than the 2-wide box",
      "BREAK? lantern hanging from a tree crown at night", "BREAK? street lamp under an arm, night road (moon too)"]) && !S.plain("Draw a light.") && S.plain("Draw hills under a light blue sky."));
  ok("...a shore is land below the horizon by how much of it lies there: a cliff or a dune that rises from the bottom edge into the sky is land; a coast seen from above is a map",
    allSame(["BREAK? rocky coast: tall gray cliff on the left to the bottom", "BREAK? coast at sunset: brown cliff tri to the bottom", "BREAK? seaside: tall dune on the right reaching the bottom",
      "GATE: coast from above, land at the top, sea below (map-like)", "GATE: coast from above with mountain symbols on the land"]) && !S.plain("Draw the coast from above."));
  ok("...\u201cfar away\u201d is not going away: a path over the hills far away, a river in a valley far away, a track by the sea far away",
    allSame(["BREAK? path over the far hills (curve on the hills), ground bare", "BREAK? river in a far valley between mountains, ground bare", "BREAK? a track by the sea far away (the far coast road), bare"]));
  ok("...a sea or grass written again lower down is kept: over the setting sun\u2019s lower half, a swimmer, a duck, a hull, the feet of fence posts",
    allSame(["DUP: sea drawn again to hide the setting sun's lower half (not plain)", "DUP: swimmer's body under the water (sea drawn again)", "DUP: duck on a pond, pond drawn again to cut the body at the water line",
      "DUP: fence posts sunk into the grass (grass drawn again)", "DUP: iceberg with its top over the water and the hidden part drawn (no dup) + water twice same line", "DUP: sea drawn again to hide the sun's lower half (plain)",
      "DUP: moon rising out of the lake, lake drawn again (not plain: 'out')"]));
  ok("...a roof on a wall drawn as a square with no fill is held up by it, not a mountain", allSame(["house roof gray 6 wide above horizon, square wall"]));

  // --- wrong pictures ---
  function w3(name) { return SC.wrong.filter(function (c) { return c.name === name; })[0]; }
  var wNow = SC.wrong.filter(function (c) { var m = mend(c); return m.lines.join("\n") !== c.after.join("\n") || m.said.join("|") !== c.said.join("|") || m.problems.join("|") !== c.problems.join("|"); });
  var n = {}; SC.wrong.forEach(function (c) { n[c.now] = (n[c.now] || 0) + 1; });
  // (the sixth review of 1.24.7: the moon is left where the model drew it -- a white disc at night is a snow cap or a
  // cloud as often -- so five of these pictures with the moon in front are left as drawn)
  ok("the 45 wrong pictures: 30 mended, 2 sent back with the line to add, 13 left as the model drew them (the moon in front of a mountain or a cloud among them); each drawn as the fixture has it (looked at, as written and as drawn)",
    wNow.length === 0 && n.mended === 30 && n["sent back"] === 2 && n.left === 13, [n, wNow.map(function (c) { return [c.name, mend(c)]; })]);
  function after(name) { return mend(w3(name)).lines.join("|"); }
  ok("...the sun or moon drawn first, behind a mountain in the air, stays behind it when the mountain is stood on the horizon (the mountain goes just before the ground, not to the back of the sky; the moon, which is not known for the moon, goes down with the peak it was drawn behind)",
    after("sun drawn first (behind), mountain floating in the air") === "rect 0 0 20 12 fill sky|circle 10 3 1.5 fill yellow|tri 4 8 10 2 16 8 fill gray|rect 0 8 20 4 fill green" &&
    after("moon first, floating mountain overlapping it") === "rect 0 0 20 12 fill navy|circle 12 4.5 1.4 fill white|tri 5 8 11 3.5 17 8 fill gray|rect 0 8 20 4 fill dark green");
  ok("...a near range in the air stays in front of the far range the model drew before it",
    after("far range on the horizon drawn first, near range floating") === "rect 0 0 20 12 fill sky|tri 4 8 12 1.5 20 8 fill purple|tri 0 8 6 3.5 12 8 fill gray|rect 0 8 20 4 fill green");
  ok("...what is drawn on the sun goes behind with it: a face; a crescent moon in front of a mountain is left as drawn",
    after("crescent moon (offset sky disc) in front of a mountain") === w3("crescent moon (offset sky disc) in front of a mountain").lines.join("|") &&
    after("sun with a smile (curve) in front of a mountain") === "rect 0 0 20 12 fill sky|circle 10 4.5 1.8 fill yellow|circle 9.4 4 0.2 fill black|circle 10.6 4 0.2 fill black|curve 9.2 5 10 5.6 10.8 5 color black width 2|tri 2 8 8 3 14 8 fill gray|rect 0 8 20 4 fill green");
  ok("...what lies on a mountain goes down with it: its other half, a snow cap that pokes out a little; one with a tree on it that pokes out is left as drawn",
    after("two-tone mountain floating (light half)") === "rect 0 0 20 12 fill sky|tri 4 8 9 4 14 8 fill gray|tri 9 4 9 8 14 8 fill light gray|rect 0 8 20 4 fill green" &&
    after("snow cap poking 0.4 above a tall floating peak") === "rect 0 0 20 12 fill sky|tri 6 8 9 4 12 8 fill gray|tri 8.2 5.2 9 3.6 9.8 5.2 fill white|rect 0 8 20 4 fill green" &&
    w3("floating mountain with a tree on its slope that pokes out of its box").now === "left");
  ok("...strokes of light on the sea under a setting sun stay on the sea (they are not rays: they go across, not away from the sun)",
    after("sun setting in front of the sea, three reflection strokes close under it") === "rect 0 0 20 12 fill orange|circle 10 7 1.5 fill yellow|rect 0 7 20 5 fill dark blue|line 9 7.6 11 7.6 color yellow width 2|line 9.2 8.1 10.8 8.1 color yellow width 2|line 9.4 8.6 10.6 8.6 color yellow width 2");
  ok("...a road with things on it is left as drawn: sleepers drawn as rects, dashes, a car, a boat, a bridge",
    ["railway as two upright rails + sleepers drawn as rects", "road strip at the left edge with dashes as rects", "road as two upright lines with a car on it near the horizon", "river strip with a boat near the horizon", "river strip with a bridge (rect) across it"]
      .every(function (nm) { return w3(nm).now === "left"; }));
  ok("...a small tri the sun was drawn over (a sail) is not called \u201cthe mountain\u201d", mend(w3("sun in front of the sea (setting), boat drawn before it")).said.join() === "put the sun behind the water: it was drawn in front");

  // --- replies ---
  function msgs(q) { return [{ role: "system", content: "You are Lantern\u2019s helper." }, { role: "user", content: "Lantern works sums out.\nQUESTION: " + q + "\n" }, { role: "assistant", content: "=1" }, { role: "user", content: "Lantern questioned that: try again" }]; }
  function outcome(text) { var p = A.parseReply(text), run = p.exprText ? A.run(p.exprText) : null, v = run ? run.value : null; return { value: v, answer: p.answer != null ? A.finalAnswer(p.answer, v, run && run.steps).text : null }; }
  var rNow = RD.replies.filter(function (x) { var rd = L.aiRead(x.reply, x.msgs ? msgs(x.q) : x.q), b = outcome(x.reply), a = outcome(rd.text);
    return a.answer !== x.answer || (b.value !== a.value || b.answer !== a.answer) !== x.readerChanges; });
  ok("the 154 replies: the readers change 31 -- 11 wrong as written (\u201c= 65*40 = 2600\u201d, \u201c=9^2-1 \u2192 80\u201d, \u201cANS: 4*9\u201d), one whose answer reads the same, and 19 that give a formula after ANSWER: it is worked out, and where the question names the formula as the thing asked the answer says both (\u201cSQRT(2), which gives 1.4142\u201d) -- and each answer is the fixture\u2019s",
    rNow.length === 0 && RD.replies.filter(function (x) { return x.readerChanges; }).length === 31, rNow.map(function (x) { return [x.q, x.reply, L.aiRead(x.reply, x.q).text]; }));
  function ans(q, reply) { return outcome(L.aiRead(reply, q).text).answer; }
  ok("...a test the question writes is the model\u2019s test, worked out to 1 or 0: \u201cthe test 2^10 = 1024\u201d, \u201cCalculate 3+4=8\u201d, \u201cWork out if 17 times 23 is 391\u201d, \u201cchecking 9^2 against 81\u201d, \u201cMAX(3,4)=4\u201d; a result typed after the sum is still cut",
    ans("What do you get from the test 2^10 = 1024?", "=2^10=1024\nANSWER: The test gives {result}.") === "The test gives 1." && ans("Calculate 3+4=8 for me.", "=3+4=8\nANSWER: {result}") === "0" &&
    ans("Work out if 17 times 23 is 391.", "=17*23=391\nANSWER: {result} (1: it is, 0: it is not)") === "1 (1: it is, 0: it is not)" && ans("What is the outcome of checking 9^2 against 81?", "=9^2=81\nANSWER: {result}") === "1" &&
    ans("What does MAX(3,4)=4 give?", "=MAX(3,4)=4\nANSWER: {result}") === "1" && ans("Petrol is 65 a litre. What do 40 litres cost?", "= 65*40 = 2600\nANSWER: {result}") === "2600" &&
    ans("What is 1 times 7?", "=1*7=7\nANSWER: {result}") === "7" && ans("What is 25*4?", "=25*4=100\nANSWER: {result}") === "100");
  ok("...a formula after ANSWER: is worked out where Lantern can; where the question names the formula as the thing asked (\u201cWhat should I put in a cell\u201d, \u201cWhich Calc command\u201d, \u201cthe spreadsheet entry\u201d, \u201cWhat goes in the cell\u201d, \u201cWhat do I type\u201d) the answer says the formula and what it gives; where it asks for a number with a formula word (\u201cUsing the CONVERT function, how many km ...\u201d), the number is in it too (the fourth and fifth reviews: an oven, a jar label, a microwave)",
    ans("What should I put in a cell to change 26 miles to km?", "ANSWER: CONVERT(26,\"mile\",\"km\")") === "CONVERT(26,\"mile\",\"km\"), which gives 41.843" && ans("Which Calc command gives the square root of 2?", "ANSWER: SQRT(2)") === "SQRT(2), which gives 1.4142" &&
    ans("Tell me the spreadsheet entry for the absolute value of -9.", "ANSWER: ABS(-9)") === "ABS(-9), which gives 9" && ans("What goes in the cell to add 5 and 7?", "ANSWER: SUM(5,7)") === "SUM(5,7), which gives 12" &&
    ans("What do I type to get 12 squared?", "ANSWER: POW(12,2)") === "POW(12,2), which gives 144" && ans("What is 26 miles in km?", "ANSWER: CONVERT(26,\"mile\",\"km\")") === "41.843" &&
    /41\.843/.test(ans("Using the CONVERT function, how many km is 26 miles?", "ANSWER: CONVERT(26,\"mile\",\"km\")")) && ans("What voltage do I put across a 470 ohm resistor for 0.02 A?", "ANSWER: VOLTS(0.02,470)") === "9.4" &&
    /356/.test(ans("What do I enter on the oven for 180 C in Fahrenheit?", "ANSWER: CONVERT(180,\"C\",\"F\")")));
  ok("...a block whose kind is written in lower case (\u201cMAKE doc:\u201d, \u201cMAKE cards:\u201d, \u201cMAKE table:\u201d) is a block: its lines are not read as sums",
    L.aiRead("MAKE doc: Twelves\n=12*1 = 12\n=12*2 = 24\nEND\nANSWER: The sheet is ready.", "What is a good answer sheet for the 12 times table? Make it as a doc.").text === "MAKE doc: Twelves\n=12*1 = 12\n=12*2 = 24\nEND\nANSWER: The sheet is ready." &&
    L.aiRead("MAKE cards: Squares\nfront: 7 squared\nANS: 7*7\nEND", "What is in the cards for squares? Make flashcards.").text === "MAKE cards: Squares\nfront: 7 squared\nANS: 7*7\nEND");

  // --- the recipes ---
  var RDc = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function speaks(x) { return !!RDc(x.q, x.sum, A.run(x.sum), {}); }
  var bNow = RD.bleach.filter(function (x) { return speaks(x) !== x.speaks; }), bDiff = RD.bleach.filter(function (x) { return x.speaks !== x.shouldSpeak; });
  ok("the 88 bleach questions: Lantern holds a sum to 2 drops a litre for 23 of the 24 the review called the plain question, and for none of the 64 others (another strength, drops of water, bleach water, bleach \u201cto clear\u201d, bleach to drink, water to use); the one it leaves says nothing of drinking",
    bNow.length === 0 && RD.bleach.filter(function (x) { return x.speaks; }).length === 23 && bDiff.length === 1 && bDiff[0].q === "How many drops of bleach to add to 1 litre of clear water in a bottle?", [bNow.map(function (x) { return x.q; }), bDiff.map(function (x) { return x.q; })]);
  var cNow = RD.cards.filter(function (x) { return speaks(x) !== x.speaks; }), cOwn = RD.cards.filter(function (x) { return !x.shouldSpeak; });
  ok("the 23 other recipe questions: a recipe is held to only for its own question, in its own words (twice round, from the centre, in km/s, a half-wave, a quarter-wave, in centimetres, in water, along a slope, in miles are other questions): Lantern says nothing of the recipe for any of the 9; the cards that do not say which questions are their own say nothing at all (the Schwarzschild radius, a geostationary orbit, a fast clock)",
    cNow.length === 0 && cOwn.every(function (x) { return !speaks(x); }) && cOwn.length >= 9, cNow.map(function (x) { return x.q; }));
  ok("...a sum written without it is still held to the recipe (the 0.8B\u2019s wavelength as frequency over the speed of light)",
    /write =WAVELEN\(100\)$/.test(RDc("What is the wavelength of a 100 MHz signal?", "=100*10^6/299792458", A.run("=100*10^6/299792458"), {})));

  console.log(fails ? fails + " REVIEW 3 FAILURES (" + passes + " passed)" : "ALL REVIEW 3 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
