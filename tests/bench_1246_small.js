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
// comment. Each row is replayed as the model wrote it.
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
  // (the sixth and seventh reviews of 1.24.7: what follows the arrow is cut only where the line is one of Lantern's own
  // recipe lines and what follows is that recipe's own "gives", or it is the sum's own value as far as it is written,
  // and the ANSWER gives the result in that unit or names none -- and only where every arrow of the reply is one of
  // these. Anything else goes back to the model as on 1.24.6)
  ok("\u201c=VOLTS(0.02,470) -> volts\u201d: the line is the sum, up to the arrow; an arrow inside quotes is part of the text",
    rd("=VOLTS(0.02,470) -> volts\n\nANSWER: 9.4 volts") === "=VOLTS(0.02,470)\n\nANSWER: 9.4 volts" && rd("=VOLTS(0.02,470) -> volts\nANSWER: {result} V") === "=VOLTS(0.02,470)\nANSWER: {result} V" &&
    rd("=WEIGHT(50)   -> newtons") === "=WEIGHT(50)" && rd("=LEN(\"a->b\")") === "=LEN(\"a->b\")" && rd("=5*3 => 15") === "=5*3" &&
    R("=VOLTS(0.02,470) -> volts").said[0] === "a formula line with \u201c-> \u2026\u201d after the sum as the sum", R("=VOLTS(0.02,470) -> volts"));
  ok("...Lantern\u2019s own line with its own label is read (\u201c=CEIL(2000/50) -> bags (rounded up)\u201d); not a step still to do, nor a unit the ANSWER does not give the result in: \u201c-> bags, rounded up\u201d, \u201c-> percent\u201d, \u201c-> squared\u201d, \u201c-> both ways\u201d; \u201c-> minutes\u201d over an ANSWER in hours, \u201c-> Wh\u201d over one in kWh, \u201c-> pence\u201d over one in pounds, \u201c-> dollars\u201d over one in cents",
    rd("=CEIL(2000/50) -> bags (rounded up)\nANS: 40") === "=CEIL(2000/50)\nANS: 40" &&
    ["=110/25 -> bags, rounded up\nANSWER: You need {result} bags.", "=7/2 -> 4\nANSWER: You need {result} cars.", "=3 -> minutes\nANSWER: {result} minutes.",
      "=3/8 -> 0.375\nANSWER: {result}%", "=2*60 -> minutes\n=30*ANS -> litres\nANSWER: {result} litres", "=CONVERT(5,\"km\",\"mile\") -> km\nANSWER: {result} km", "=12/80 -> percent\nANSWER: It is {result}%.", "=4.5 -> squared\nANSWER: {result} square metres.",
      "=3.50 -> both ways\nANSWER: The return trip costs ${result}.", "=2000/15 -> minutes\nANSWER: It takes {result} hours.", "=1500*4 -> Wh\nANSWER: It uses {result} kWh.",
      "=65*35 -> pence\nANSWER: That is \u00a3{result}.", "=2*2.5 -> dollars\nANSWER: {result} cents"].every(function (t) { return rd(t) === t; }) &&
    rd("=50-80 -> -30 dollars\nANSWER: {result} dollars") === "=50-80\nANSWER: {result} dollars" && rd("=(10-32)/1.8 -> -12.2 C\nANSWER: {result} C") === "=(10-32)/1.8\nANSWER: {result} C");
  // (the reviews of 1.24.7: what follows the second = is cut only where it is the sum's own value, every step of it --
  // a number that is not may be the model's next step, done in the head, as surely as a slip, and stays as written)
  ok("\u201c= 65*35 = 2275\u201d, \u201c=2000/15/60 = 2000/900 = 2.2222\u201d: the line is the sum, up to the second =, where what follows is the sum\u2019s own value; the 0.8B\u2019s chain that ends wrong (\u201c= 200/9 = 22.2\u201d), and 6.5 after =CONVERT(26,\"mile\",\"km\"), stay as written; a comparison inside a function is left alone",
    rd("= 65*35 = 2275", HOWMUCH) === "= 65*35" && rd("=2000/15/60 = 2000/900 = 2.2222\nANSWER: {result}", "How many hours does it take?") === "=2000/15/60\nANSWER: {result}" &&
    rd("=2000/15/60 = 2000/900 = 200/9 = 22.22222222222222\nANSWER: 22.2", "How many hours does it take?") === "=2000/15/60 = 2000/900 = 200/9 = 22.22222222222222\nANSWER: 22.2" &&
    rd("=CONVERT(26,\"mile\",\"km\") = 6.5\nANS: 6.5", "What is 26 miles in km?") === "=CONVERT(26,\"mile\",\"km\") = 6.5\nANS: 6.5" && rd("=IF(2>=1,5,6)", HOWMUCH) === "=IF(2>=1,5,6)" && rd("=IF(3=3,5,6)", HOWMUCH) === "=IF(3=3,5,6)" &&
    R("= 65*35 = 2275", HOWMUCH).said[0] === "a formula line with its result typed after a second = as the sum", R("= 65*35 = 2275", HOWMUCH));
  // (the second review: a comparison is a sum too -- 1 for yes)
  ok("...only where the question asks for a number. Where it asks whether something is so (\u201cCheck whether\u201d, \u201cVerify that\u201d, \u201cTell me if\u201d, \u201cConfirm\u201d, \u201cCheck it\u201d, \u201cCompare\u201d, \u201cIs ...?\u201d), where the answer says what 1 and 0 mean, and where Lantern does not know the question, \u201c=17*23=391\u201d is the sum",
    rd("=17*23=391\nANSWER: {result}", "Check whether 17 times 23 makes 391.") === "=17*23=391\nANSWER: {result}" && rd("=12^2=144\nANSWER: {result}", "Verify that 12 squared is 144.") === "=12^2=144\nANSWER: {result}" &&
    rd("=3*12=36\nANSWER: {result}", "Tell me if 3 dozen eggs is 36 eggs.") === "=3*12=36\nANSWER: {result}" && rd("=LEN(\"abc\")=3\nANSWER: {result}", "Confirm that the word abc has 3 letters.") === "=LEN(\"abc\")=3\nANSWER: {result}" &&
    rd("=3*65=185\nANSWER: {result} (1 if the bill agrees, 0 if not)", "A bill for 3 items at 65 pesos came to 185 pesos. Check it.") === "=3*65=185\nANSWER: {result} (1 if the bill agrees, 0 if not)" &&
    rd("=(17*23)=391\nANSWER: {result}", "Compare 17*23 with 391: write 1 if they match.") === "=(17*23)=391\nANSWER: {result}" && rd("=17*23=391\nANSWER: {result}", "Is 17*23 equal to 391?") === "=17*23=391\nANSWER: {result}" &&
    rd("=17*23-391=0\nANSWER: {result} (1 means it leaves nothing)", "What is 17*23 less 391?") === "=17*23-391=0\nANSWER: {result} (1 means it leaves nothing)" && rd("= 65*35 = 2275") === "= 65*35 = 2275" && rd("= 65*35 = 2275", "") === "= 65*35 = 2275");
  var twoTurns = [{ role: "user", content: "You are a careful calculation assistant.\nQUESTION: Is 17*23 equal to 391?\nThe question gives these numbers: 17; 23; 391." }, { role: "assistant", content: "=17*23" },
    { role: "user", content: "Lantern questioned that: the ANSWER says 1, but Lantern\u2019s lines give 391.\nOtherwise reply again with corrected = lines and the ANSWER line only." }];
  ok("...the question is the person\u2019s, on the second turn too (not what Lantern sent back), and the whole of a message of two lines",
    R("=17*23=391\nANSWER: {result}", twoTurns).text === "=17*23=391\nANSWER: {result}" && R("=12*12=144\nANSWER: {result}", [{ role: "user", content: "Here is one to check.\nIs 12*12 equal to 144?" }]).text === "=12*12=144\nANSWER: {result}" &&
    R("= 65*35 = 2275\nANSWER: {result}", [{ role: "user", content: "You are a careful calculation assistant.\nQUESTION: " + HOWMUCH + "\nThe question gives these numbers: 65 pesos; 35 litres." }]).text === "= 65*35\nANSWER: {result}");
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
    rd("Make sure the units match.\n=2000/15 -> 133.33\nANSWER: {result}") === "Make sure the units match.\n=2000/15\nANSWER: {result}" &&
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
  // (the reviews of 1.24.7 took back what could not be told from a model's own step: a number typed under the sum, a
  // number after a second = that is not the sum's value. Three of the 2B's rows and two of the 0.8B's that passed with
  // those readers are left failing as on 1.24.6 -- the 2B's 88.5625 under =CONVERT(26,"mile","km"), 360 under
  // =12*12*3, 50480 under Mars's escape velocity; the 0.8B's 9.6 after =120*80/10000 and its chain to 22.2)
  // (and the sixth review took back the rest: a number of ten digits or more typed under a sum, or after an arrow, may be
  // a step done in the head too ("=1024^3", "=10737418240" for 10 GiB); "-> bags (rounded up)" is not a unit. Five more
  // of the 2B's rows are left failing as on 1.24.6: the battery's hours and the orbit's (a long number typed under the
  // sum), the tank (133.33 hours typed under it), the plants (a long number after the arrow), the bags)
  // (the seventh: an arrow is read only before a recipe's own label or the sum's own value; a whole number after a sum
  // that is not whole is a count rounded, the model's step -- so the 2B's escape velocity, 11186 after a sum of
  // 11186.x, goes back as on 1.24.6, and its bags, "-> bags (rounded up)" after the recipe's own line, are read)
  ok("the 2B\u2019s 27 failed sums, with its replies as it wrote them: 10 pass now. The 17 left are sums it got wrong (RSERIES for two resistors in parallel, 150*10/420 for the fuel of a trip), and nine where it typed a number under a right sum or after its arrow, which Lantern cannot tell from a step done in the head",
    r2.pass.length === 10 && r2.left.join() === "mars-escape,moon-weight,water-molar,battery-hours,miles-km,parallel,escape,plants,tank-fill,field-ha,rice-scale,egg-dozens,geo-period,rice-kg,power-bill,car-fuel,miles-speed", r2);
  ok("...the ones that pass are ones it had right: the kinetic energy, the eggs, the feed, Ohm\u2019s law, a sack\u2019s weight, the wavelength, the bags, the bleach, the transfer, the jerrycans",
    ["car-ke", "eggs", "feed", "ohms-law", "sack-weight", "radio-wave", "maize-bags", "bleach-jerrycan", "hohmann-geo", "jerrycans"].every(function (id) { return r2.pass.indexOf(id) >= 0; }), r2.pass);
  ok("the 0.8B\u2019s 18 failed sums: 2 pass now (230 V x 4 A, fuel at 65 a litre: each a right sum with its own value after a second =); a field in hectares (9.6 after =120*80/10000) and a tank\u2019s hours (a chain that ends at 22.2) stay as written",
    r08.pass.join() === "appliance-w,fuel-cost" && r08.left.length === 16, r08);

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
