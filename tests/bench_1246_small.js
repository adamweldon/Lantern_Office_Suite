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
  function rd(t) { return R(t).text; }
  ok("boot clean; the fixtures are the runs\u2019 failed rows (the 2B 55, the 0.8B 61, the 4B 5)", o.errs.length === 0 && F2.rows.length === 55 && F08.rows.length === 61 && F4.rows.length === 5 &&
    F2.summary.pass === 57 && F08.summary.pass === 51 && F4.summary.pass === 107, [F2.rows.length, F08.rows.length, F4.rows.length]);

  // --- how a line is read ---
  ok("\u201c=VOLTS(0.02,470) -> volts\u201d: the line is the sum, up to the arrow; an arrow inside quotes is part of the text",
    rd("=VOLTS(0.02,470) -> volts\n\nANSWER: 9.4 volts") === "=VOLTS(0.02,470)\n\nANSWER: 9.4 volts" && rd("=CEIL(2000/50) -> bags (rounded up)\nANS: 40") === "=CEIL(2000/50)\nANS: 40" &&
    rd("=WEIGHT(50)   -> newtons") === "=WEIGHT(50)" && rd("=LEN(\"a->b\")") === "=LEN(\"a->b\")" && rd("=5*3 => 15") === "=5*3" &&
    R("=VOLTS(0.02,470) -> volts").said[0] === "a formula line with \u201c-> \u2026\u201d after the sum as the sum", R("=VOLTS(0.02,470) -> volts"));
  ok("\u201c= 65*35 = 2275\u201d, \u201c=2000/15/60 = 2000/900 = 200/9 = 22.2\u201d: the line is the sum, up to the second =; a comparison inside a function is left alone",
    rd("= 65*35 = 2275") === "= 65*35" && rd("=2000/15/60 = 2000/900 = 200/9 = 22.22222222222222\nANSWER: 22.2") === "=2000/15/60\nANSWER: 22.2" &&
    rd("=CONVERT(26,\"mile\",\"km\") = 6.5\nANS: 6.5") === "=CONVERT(26,\"mile\",\"km\")\nANS: 6.5" && rd("=IF(2>=1,5,6)") === "=IF(2>=1,5,6)" && rd("=IF(3=3,5,6)") === "=IF(3=3,5,6)" &&
    R("= 65*35 = 2275").said[0] === "a formula line with its result typed after a second = as the sum", R("= 65*35 = 2275"));
  ok("\u201c=({2000}/{15})/60\u201d: a number in the { } of a recipe\u2019s blank is the number; a blank with its name in it is left for Lantern to question",
    rd("=({2000}/{15})/60") === "=(2000/15)/60" && rd("=CEIL({2000/50})") === "=CEIL((2000/50))" && rd("=({ah}*{v})/{w}") === "=({ah}*{v})/{w}" && rd("ANSWER: It weighs {result} newtons.") === "ANSWER: It weighs {result} newtons.");
  ok("a number typed on a = line of its own after a sum Lantern can work out is left out -- the last = line only, or the last before \u201c=ANS\u201d",
    rd("=CONVERT(26,\"mile\",\"km\")\n=88.5625\n\nANSWER: 88.5625") === "=CONVERT(26,\"mile\",\"km\")\n\nANSWER: 88.5625" &&
    rd("=PLANET(\"Mars\",\"escape\") -> 50480 m/s\n=ANS\n=50480\n\nANSWER: 50480") === "=PLANET(\"Mars\",\"escape\")\n=ANS\n\nANSWER: 50480" &&
    rd("=(2000/15)/60\n=133.33333333333334 hours\nANSWER: x") === "=(2000/15)/60\nANSWER: x" &&
    R("=5*3\n=15").said[0] === "a number typed on a = line after the sum left out (Lantern works the number out)", R("=5*3\n=15"));
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
      var out = await A.solve(it.q, { call: function () { k++; return Promise.resolve(rd(k === 1 ? first : r.reply)); } });
      (B.grade(it, out.text, out).pass ? pass : left).push(r.id);
    }
    return { pass: pass, left: left };
  }
  var r2 = await replay(F2), r08 = await replay(F08);
  ok("the 2B\u2019s 27 failed sums, with its replies as it wrote them: 18 pass now. The 9 left are sums it got wrong (RSERIES for two resistors in parallel, 150*10/420 for the fuel of a trip)",
    r2.pass.length === 18 && r2.left.join() === "moon-weight,water-molar,parallel,field-ha,rice-scale,rice-kg,power-bill,car-fuel,miles-speed", r2);
  ok("...the ones that pass are the ones it had right: Mars\u2019s escape velocity, the battery\u2019s hours, 26 miles in km, the kinetic energy, the plants of a bed, the eggs, the feed, Ohm\u2019s law, a sack\u2019s weight, the wavelength, the bleach, the tank, the bags, the transfer, the jerrycans, the orbit",
    ["mars-escape", "miles-km", "car-ke", "escape", "plants", "eggs", "feed", "ohms-law", "sack-weight", "radio-wave", "bleach-jerrycan", "tank-fill", "maize-bags", "hohmann-geo", "jerrycans", "geo-period"].every(function (id) { return r2.pass.indexOf(id) >= 0; }), r2.pass);
  ok("the 0.8B\u2019s 18 failed sums: 4 pass now (230 V x 4 A, a field in hectares, fuel at 65 a litre, a tank\u2019s hours: each a right sum with its result after a second =)",
    r08.pass.join() === "appliance-w,tank-fill,field-ha,fuel-cost" && r08.left.length === 14, r08);

  // --- what the short prompt shows: nothing after a recipe's line ---
  var withArrow = Q.filter(function (it) { if (!it.x) return false; var p = P.assist(it.q, A.match(it.q)), at = p.indexOf("\nRECIPE\n"); return at >= 0 && /->/.test(p.slice(at, p.indexOf("\nQUESTION:", at))); });
  var pv = P.assist(item("ohms-law").q, A.match(item("ohms-law").q));
  ok("the short prompt shows what a recipe gives on a line of its own, above its line: no recipe line has anything after it for a model to copy (every sum of the bench)",
    withArrow.length === 0 && /\nRECIPE\n- [^\n]+\n  gives: volts\n  =VOLTS\(0\.02,470\)\n/.test(pv), [withArrow.map(function (it) { return it.id; }), pv.slice(-300)]);

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
