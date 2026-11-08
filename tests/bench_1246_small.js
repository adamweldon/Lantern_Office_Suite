// bench_1246_small.js -- the small models' rows on 1.24.6, replayed (1.24.7).
// On 1.24.6 (GitHub run 42201761437: the 4B 107 of 112, the 2B 57, the 0.8B
// 51) the 2B had the right sum in its first reply for most of the function
// questions and passed 6 of 21, because of how it wrote the line:
//     =VOLTS(0.02,470) -> volts        what the recipe's line gives, copied onto
//                                      the line (the short prompt showed it there)
//     =CONVERT(26,"mile","km")         the sum, then a number typed on a = line of
//     =88.5625                         its own -- Lantern took the last line
//     =({2000}/{15})/60                the numbers put into the recipe's { }
// and the 0.8B wrote "= 65*35 = 2275": the sum and its result after a second =.
// The 4B wrote every formula of the power wheel on a line of its own, and
// its sketch for "without delay()" was questioned for the word delay() in a
// comment. Each row is replayed as the model wrote it. 1.24.7 reads the
// numbers in braces; an arrow or a second = goes back to the model with what
// is wrong said plainly (eight reviews took the readers for them back).
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
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(js);
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
  var A = L.assist, B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct, P = L.aiPrompt, R = L.aiRead;
  var F2 = fixture("bench_run_1246_2b.json"), F08 = fixture("bench_run_1246_08b.json"), F4 = fixture("bench_run_1246_4b.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(F, id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  function rd(t, q) { return R(t, q).text; }
  var HOWMUCH = "Fuel costs 65 pesos a litre. How much do 35 litres cost?";
  ok("boot clean; the fixtures are the runs\u2019 failed rows (the 2B 55, the 0.8B 61, the 4B 5)", o.errs.length === 0 && F2.rows.length === 55 && F08.rows.length === 61 && F4.rows.length === 5 &&
    F2.summary.pass === 57 && F08.summary.pass === 51 && F4.summary.pass === 107, [F2.rows.length, F08.rows.length, F4.rows.length]);

  // --- how a line is read ---
  // (1.24.7 read "=VOLTS(0.02,470) -> volts" as the sum, and "= 65*35 = 2275". Eight reviews broke each version of those
  // readers: the arrow was a step still to do, a unit to change into, a unit the ANSWER did not use, half a chain; the
  // second = a count rounded, a per cent, a test. Each time 1.24.6 had sent the reply back and 1.24.7 handed the person
  // a wrong number. So the lines stay as the model wrote them, and go back with what is wrong said plainly.)
  ok("an arrow after a sum, or a number after a second =, stays as the model wrote it: Lantern cannot see what the model meant by it (\u201c=VOLTS(0.02,470) -> volts\u201d, \u201c=7/2 -> 4\u201d, \u201c=3 -> minutes\u201d, \u201c=KE(1000,20) -> joules\u201d under kJ, \u201c= 65*35 = 2275\u201d, \u201c=7/2 = 4\u201d, \u201c=12/80 = 0.15 = 15%\u201d)",
    [["=VOLTS(0.02,470) -> volts\nANSWER: {result} volts", ""], ["=CEIL(2000/50) -> bags (rounded up)\nANS: 40", ""], ["=7/2 -> 4\nANSWER: You need {result} cars.", ""], ["=3 -> minutes\nANSWER: {result} minutes.", ""],
      ["=KE(1000,20) -> joules\nANSWER: {result} kJ", ""], ["=2*60 -> minutes\n=30*ANS -> litres\nANSWER: {result} litres", ""], ["=5*3 => 15", ""], ["= 65*35 = 2275", HOWMUCH],
      ["=7/2 = 4\nANSWER: {result} cars", "How many cars for 7 people, 2 to a car?"], ["=12/80 = 0.15 = 15%\nANSWER: It is {result}%.", "What is 12 out of 80 as a percent?"],
      ["=17*23=391\nANSWER: {result}", "Check whether 17 times 23 makes 391."], ["=LEN(\"a->b\")", ""]].every(function (x) { var r = R(x[0], x[1]); return r.text === x[0] && !r.said.length; }));
  ok("...and goes back with what is wrong said plainly: a formula line holds only the sum; a step goes in the sum, the unit in the ANSWER (with the recipe\u2019s line where there is one, as on 1.24.6)",
    /^a formula line holds only the sum: what follows the arrow cannot be worked out\. Put a step \(rounding, a change of unit\) in the sum itself, and the unit in the ANSWER$/.test(A.run("=VOLTS(0.02,470) -> volts").steps[0].err) &&
    /a formula line holds only the sum/.test(A.run("=7/2 \u2192 4").steps[0].err) && !/a formula line holds/.test(A.run("=LEN(\"a->b\")+FOO(1)").steps[0].err || ""));
  ok("a line that uses ANS where no line before it could be worked out cannot be worked out either (it was 0: \u201c=2*60 -> minutes\u201d, \u201c=30*ANS\u201d gave 0 litres); after a line that was worked out, ANS is that line\u2019s, as before",
    A.run("=2*60 -> minutes\n=30*ANS").value === null && A.run("=2*60 -> minutes\n=30*ans").value === null && A.run("=2*60\n=ANS minutes\n=ANS*30").value === 3600 && A.run("=2*60\n=30*ANS").value === 3600);
  ok("\u201c=({2000}/{15})/60\u201d: a number in the { } of a recipe\u2019s blank is the number; a blank with its name in it is left for Lantern to question",
    rd("=({2000}/{15})/60") === "=(2000/15)/60" && rd("=CEIL({2000/50})") === "=CEIL((2000/50))" && rd("=({ah}*{v})/{w}") === "=({ah}*{v})/{w}" && rd("ANSWER: It weighs {result} newtons.") === "ANSWER: It weighs {result} newtons.");
  // (1.24.7 at first left out a number typed on its own = line under a sum. The fourth and fifth reviews wrote 44 right
  // replies whose last step was done in the head, and no rule told the step from a slip: the model's number stands)
  ok("a number typed on a = line of its own under a sum is the model\u2019s, and stays as written: its last step done in its head (\u201c=80*25/100\u201d, \u201c=60\u201d for a coat at 25% off; \u201c=350/100\u201d, \u201c=28\u201d for 8 litres per 100 km) or a slip (the 2B\u2019s 88.5625) -- Lantern cannot tell which",
    rd("=80*25/100\n=60\nANSWER: The price is 60 dollars.", "A coat costs $80 and is 25% off. What is the sale price?") === "=80*25/100\n=60\nANSWER: The price is 60 dollars." &&
    rd("=350/100\n=28\nANSWER: 28 litres", "A car uses 8 litres per 100 km. How much fuel does it need for 350 km?") === "=350/100\n=28\nANSWER: 28 litres" &&
    rd(row(F2, "miles-km").reply, item("miles-km").q) === row(F2, "miles-km").reply && R("=5*3\n=15").said.length === 0);
  // (the second review: the older readers inside a document, and lines named later)
  ok("no reader touches a line inside a MAKE block or a code fence: an answer key\u2019s \u201cANS: B\u201d three times running, a quiz\u2019s \u201cANS: 12*12\u201d, a worksheet\u2019s \u201cANSWER: SQRT(49)\u201d; a line of prose that begins \u201cMake sure\u201d opens no block",
    rd("MAKE DOC: Answer key\nAnswers to the quiz.\nANS: B\nANS: B\nANS: B\nANS: C\nEND") === "MAKE DOC: Answer key\nAnswers to the quiz.\nANS: B\nANS: B\nANS: B\nANS: C\nEND" &&
    rd("MAKE DOC: Quiz\n1. What is 12 x 12?\nANS: 12*12\n2. What is 9 x 9?\nANS: 9*9\nEND") === "MAKE DOC: Quiz\n1. What is 12 x 12?\nANS: 12*12\n2. What is 9 x 9?\nANS: 9*9\nEND" &&
    rd("MAKE DOC: Roots\nANSWER: SQRT(49)\nEND") === "MAKE DOC: Roots\nANSWER: SQRT(49)\nEND" &&
    rd("Make sure the units match.\nANS: 2000/15") === "Make sure the units match.\n=2000/15\nANSWER: {result}" &&
    rd("MAKE QUIZ: Seven times\n1. 6 x 7\n=6*7=42\nEND\nANSWER: The answer is 42.", "What is 6 times 7? Make a quiz.") === "MAKE QUIZ: Seven times\n1. 6 x 7\n=6*7=42\nEND\nANSWER: The answer is 42.");
  // (the sixth review: an ANSWER line after a line of a MAKE block that is not a program ends the block, as it does for
  // AI_ACTIONS, which makes the table and reads the ANSWER as the answer. The formula is worked out, and its line goes
  // under the ANSWER, so the table is as the model wrote it)
  ok("...an ANSWER line after a line of a MAKE block ends it, as it does where the block is made: \u201cMAKE TABLE: Distance\u201d, \u201c5 | ?\u201d, \u201cANSWER: CONVERT(5,\"km\",\"mile\")\u201d gives the formula\u2019s result, and the table is as written; in a program, an ANSWER line is the program\u2019s",
    rd("MAKE TABLE: Distance\nkm | miles\n5 | ?\nANSWER: CONVERT(5,\"km\",\"mile\")", "How many miles is 5 km?") === "MAKE TABLE: Distance\nkm | miles\n5 | ?\nANSWER: {result}\n=CONVERT(5,\"km\",\"mile\")" &&
    Math.abs(A.run(A.parseReply(rd("MAKE TABLE: Distance\nkm | miles\n5 | ?\nANSWER: CONVERT(5,\"km\",\"mile\")", "How many miles is 5 km?")).exprText).value - 3.10686) < 0.001 &&
    rd("MAKE CODE: Sum\nprint(2+3)\nANSWER: SQRT(49)\nEND") === "MAKE CODE: Sum\nprint(2+3)\nANSWER: SQRT(49)\nEND");
  ok("...one line three times is read as once only where the lines are not named later: \u201c=10\u201d three times and \u201c=ANS1+ANS2+ANS3\u201d are three resistors",
    rd("=10\n=10\n=10\n=ANS1+ANS2+ANS3\nANSWER: {result} ohms") === "=10\n=10\n=10\n=ANS1+ANS2+ANS3\nANSWER: {result} ohms" && rd("=4*5\n=4*5\n=4*5\nANSWER: {result}") === "=4*5\nANSWER: {result}");
  ok("...a formula after \u201cANSWER:\u201d is the sum where Lantern can work it out (not \u201cMAX(A1,B1)\u201d, \u201cPI()*r^2\u201d); where the question names the formula as the thing asked, the answer says the formula and what it gives (\u201cWhat formula changes 5 km to miles?\u201d)",
    rd("ANSWER: MAX(A1,B1)", "Which function gives the larger of two cells?") === "ANSWER: MAX(A1,B1)" && rd("ANSWER: PI()*r^2", "What is the area of a circle of radius r?") === "ANSWER: PI()*r^2" &&
    rd("ANSWER: CONVERT(5,\"km\",\"mile\")", "What formula changes 5 km to miles?") === "=CONVERT(5,\"km\",\"mile\")\nANSWER: CONVERT(5,\"km\",\"mile\"), which gives {result}" &&
    rd("ANSWER: POW(3,2)", "How do I write 3 squared as a formula?") === "=POW(3,2)\nANSWER: POW(3,2), which gives {result}" &&
    rd("ANSWER: CONVERT(26,\"mile\",\"km\")", "What is 26 miles in km?") === "=CONVERT(26,\"mile\",\"km\")\nANSWER: {result}");
  ok("...a number that starts a chain, or stands in the middle of one, may be a value the next line uses: it stays. A number typed with no sum at all stays a number with no sum",
    rd("=1000\n=ANS*2") === "=1000\n=ANS*2" && rd("=5*3\n=1000\n=ANS/2") === "=5*3\n=1000\n=ANS/2" && rd("= 36") === "= 36" && rd("=7.5 cups") === "=7.5 cups" &&
    rd("=5*40\n=2000/ANS\nANSWER: The tank lasts {result} days.") === "=5*40\n=2000/ANS\nANSWER: The tank lasts {result} days." && rd("=5*40\n=2*PI") === "=5*40\n=2*PI");

  // --- the 35B's right sums are read as they were ---
  var S35 = fixture("bench_run_1244_35b_sums.json"), changed = S35.rows.filter(function (r) { return rd(r.reply) !== r.reply; });
  ok("the 35B\u2019s 45 right sums of 1.24.4: nothing in them is read differently", S35.rows.length === 45 && changed.length === 0, changed.map(function (r) { return [r.id, r.reply, rd(r.reply)]; }));

  // --- the rows, as the models wrote them ---
  async function replay(F) {
    var pass = [], left = [];
    for (var i = 0; i < F.rows.length; i++) {
      var r = F.rows[i];
      if (!/^(tool|multi)$/.test(r.cat)) continue;
      var it = item(r.id), k = 0, first = r.first || r.reply;
      var out = await A.solve(it.q, { call: function () { k++; return Promise.resolve(rd(k === 1 ? first : r.reply, it.q)); } });
      (B.grade(it, out.text, out).pass ? pass : left).push(r.id);
    }
    return { pass: pass, left: left };
  }
  var r2 = await replay(F2), r08 = await replay(F08);
  // (1.24.7 read the 2B's arrows and the 0.8B's second = for a while, and up to 15 of these rows passed. Eight reviews
  // took those readers back, and the rows replayed with the replies as the models wrote them -- the same reply on the
  // second turn as on the first -- fail as on 1.24.6. What 1.24.7 changes for them is at the source: the short prompt
  // no longer shows "-> volts" after a recipe's line, and a line with an arrow goes back with what is wrong said
  // plainly. The small models' run on 1.24.7 says whether they still write it.)
  ok("the 2B\u2019s 27 failed sums and the 0.8B\u2019s 18, replayed with the replies as they wrote them, twice: none passes, as on 1.24.6 -- the lines with an arrow or a second = go back to the model (the run of 1.24.7 says what the models write with its prompt)",
    r2.pass.length === 0 && r2.left.length === 27 && r08.pass.length === 0 && r08.left.length === 18, [r2, r08]);

  // --- what the short prompt shows: nothing after a recipe's line ---
  var withArrow = Q.filter(function (it) { if (!it.x) return false; var p = P.assist(it.q, A.match(it.q)), at = p.indexOf("\nRECIPE\n"); return at >= 0 && /->/.test(p.slice(at, p.indexOf("\nQUESTION:", at))); });
  var pv = P.assist(item("ohms-law").q, A.match(item("ohms-law").q));
  ok("the short prompt shows what a recipe gives on a line of its own, above its line: no recipe line has anything after it for a model to copy (every sum of the bench)",
    withArrow.length === 0 && /\nRECIPE\n- [^\n]+\n  needs: amps in A; ohms in ohm\n  gives: volts\n  =VOLTS\(\{amps\},\{ohms\}\)\n/.test(pv), [withArrow.map(function (it) { return it.id; }), pv.slice(-300)]);

  // --- a dose is the sum for its own plain question, and no other ---
  // (1.24.6 held any sum on a question that fitted the bleach card to 2 drops a litre. The second review of 1.24.7
  // asked that card about handwashing, soaking instruments, an aquarium, water from a dam, milky water, scented
  // bleach, teaspoons.)
  var RDc = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function dose(q, expr) { return RDc(q, expr, A.run(expr), {}); }
  ok("a sum for drops of bleach in clear water to drink that gives another number is held to the recipe (2 drops a litre): 20 drops a litre is ten times the dose",
    /^Lantern\u2019s recipe for this question gives 40 \(drops for clear water/.test(dose("How many drops of bleach for 20 litres of clear water to drink?", "=20*20")) &&
    /write =2\*20$/.test(dose("How many drops of household bleach make a 20 litre jerrycan of clear water safe to drink?", "=20*4")) && /gives 30 /.test(dose("How many drops of bleach for 15 L of drinking water?", "=15*7")));
  ok("...and for any other question about bleach Lantern says nothing about the recipe: another use (handwashing, soaking instruments, an aquarium, nappies), water that may not be clear (from the dam, milky, icy, stagnant), another bleach (scented, thick, diluted), another measure (teaspoons, capfuls, cc), the time to wait",
    ["How many drops of bleach in 5 litres of water for handwashing?", "How many drops of bleach in 2 litres of water to soak instruments?", "How many drops of bleach in the water of my 100 litre aquarium?",
      "How many drops of bleach in 10 litres of water to soak nappies?", "How many drops of bleach for 20 litres of water from the dam?", "How many drops of bleach for 20 litres of milky water?",
      "How many drops of bleach for 20 litres of icy water?", "How many drops of bleach for 20 litres of stagnant water?", "How many drops of scented bleach for 10 litres of drinking water?",
      "How many drops of thick bleach for 10 litres of drinking water?", "How many drops of diluted bleach for 10 litres of drinking water?", "How many teaspoons of bleach for 200 litres of water?",
      "How many capfuls of bleach for 200 litres of water?", "How much bleach, in cc, for 100 litres of water?", "How long must I wait after adding bleach to 20 litres of water?",
      "How many drops of bleach do I need for 20 litres of cloudy water?",
      // (the third review: drinking not said; liquid chlorine; drops of water; bleach water; to clear; bleach to drink)
      "How many drops of bleach for 20 litres of clear water?", "How many drops of liquid chlorine do I add to 20 litres of water to drink?", "How many drops of water do I add to 1 litre of bleach to make it safe?",
      "How many drops of bleach do I need to make 10 litres of bleach water?", "How many drops of bleach will clear 10 litres of water?", "How many drops of bleach can I drink in 1 litre of water?"].every(function (q) { return dose(q, "=20*7") === null; }));
  // (the seventh review: only where the question names the unit the recipe gives -- a wavelength asked with no unit is
  // answered right in centimetres as well)
  ok("...the other one-blank recipes are held as on 1.24.6 where the question asks in the recipe\u2019s unit (a wavelength in metres worked as frequency over the speed of light); asked with no unit, nothing is said",
    /write =WAVELEN\(100\)$/.test(dose("What is the wavelength of a 100 MHz signal, in metres?", "=100*10^6/299792458")) && !dose("What is the wavelength of a 100 MHz signal?", "=100*10^6/299792458"));

  // --- the 4B ---
  var w4 = row(F4, "make-power-wheel"), iw = item("make-power-wheel"), mw = act.fromReply(w4.first.replace(/^LESSON:[^\n]*\n+[^\n]*\n+/, ""), iw.q);
  ok("the 4B\u2019s wheel, every formula on a line of its own and no part line: each formula goes into the part for the letter it gives, and Lantern says so; the wheel passes",
    !!mw && mw.ok === true && /^4 parts, 12 items\./.test(mw.summary) && /put each formula written on a line of its own into the part for the letter it gives \(P, V, I, R\)/.test(mw.summary) &&
    B.grade(iw, w4.first, { made: mw, text: w4.first }).pass === true, mw && [mw.ok, mw.summary, mw.problems]);
  var b4 = row(F4, "code-blink-millis"), ib = item("code-blink-millis"), mb = act.fromReply(b4.reply, ib.q);
  ok("the 4B\u2019s sketch, timed with millis(), with \u201cwithout using delay()\u201d in its opening comment: not questioned; it passes", !!mb && mb.ok === true && B.grade(ib, b4.reply, { made: mb, text: b4.reply }).pass === true, mb && mb.problems);
  var bad = act.fromReply("MAKE CODE: Blink\nlanguage arduino\n/* blink without delay */\nvoid setup() { pinMode(13, OUTPUT); }\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\nEND", ib.q);
  ok("...a sketch that does call delay() is still questioned, at the line of the call (the fifth of the program), not at the comment on its first", !!bad && bad.ok === false && /^line 5 calls delay\(\), and the question says without delay\(\)/.test(bad.problems.join("\n")), bad && bad.problems);

  console.log(fails ? fails + " BENCH 1.24.6 SMALL MODEL FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.6 SMALL MODEL CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
