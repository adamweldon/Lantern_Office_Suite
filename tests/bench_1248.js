// bench_1248.js -- the rows of 1.24.8, replayed (1.24.10).
// GitHub run 42474037730: the 4B 110 of 114, the 2B 77, the 0.8B 59; and Adam's run of the 35B on his laptop with
// the library (134 of 140). What the rows show:
//  - the 35B's road into the distance was "tri 0 6 20 6 10 0 fill gray" written 29 times, and nothing was asked:
//    a line written three times stopped the landscape rules. 1.24.10 leaves out the earlier copies and asks for
//    the road with the line to write (tests/review_dups_1250.js);
//  - the 35B's waltz held A over E in bar 7, was told to write D or A there, and sent the same E back (as on 1.24.6
//    with the library). 1.24.10 plays A there and says so (tests/music.js);
//  - the road went without the example's road for the 0.8B and the 2B, as 1.24.8 expected (the 4B drew its own);
//  - "an ocean shore with mountains in the distance at sunset" failed for all four models, each its own way: the
//    0.8B kept the day's blue sky, the 2B and the 35B drew off the grid (the 35B's sea below the picture, under the
//    example's green ground), the 4B drew no land in front of its sea. Left as they are, written here so that a
//    change shows (agent/QUEUE.md);
//  - of the other failed rows, replayed as the models wrote them, none passes: 1.24.10 does not change how a sum, a
//    program or a document is read.
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
  var A = L.assist, B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct, R = L.aiRead;
  var F08 = fixture("bench_run_1248_08b.json"), F2 = fixture("bench_run_1248_2b.json"), F4 = fixture("bench_run_1248_4b.json"), F35 = fixture("bench_run_1248_35b_library.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(F, id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  ok("boot clean; the fixtures are the runs\u2019 failed rows (the 0.8B 55, the 2B 37, the 4B 4 of 114; the 35B 7 of 140, with the library)",
    o.errs.length === 0 && F08.rows.length === 55 && F2.rows.length === 37 && F4.rows.length === 4 && F35.rows.length === 7 &&
    F08.summary.pass === 59 && F2.summary.pass === 77 && F4.summary.pass === 110 && F35.summary.pass === 134 && F35.summary.n === 140 &&
    [F08, F2, F4].every(function (F) { return F.lantern === "1.24.8" && F.summary.n === 114; }), [o.errs, F08.rows.length, F2.rows.length, F4.rows.length, F35.rows.length]);

  // --- the 35B's waltz and road
  var wz = row(F35, "make-music-waltz"), mw = act.build(wz.reply, item("make-music-waltz").q);
  ok("the 35B\u2019s waltz (A held over E in bar 7, sent back as it was): Lantern plays A there, says so, and the waltz passes",
    /bar 7: the melody holds A over E/.test(wz.why) && mw.ok && /bar 7: Lantern played A under the tune\u2019s A, where the chords line has E/.test(mw.summary) &&
    B.grade(item("make-music-waltz"), wz.reply, { made: mw, text: wz.reply }).pass === true, [mw.problems, mw.summary]);
  var rd = row(F35, "make-road-horizon"), mr = act.build(rd.reply, item("make-road-horizon").q);
  // (1.24.14: its tri, going up from the horizon to the top of the picture, is named, the road's line to write in its place)
  ok("...its road (the triangle 29 times): the road is asked for, with the line to write", /no road that narrows/.test(rd.why) && !mr.ok &&
    mr.problems.join("\n").indexOf("if \u201ctri 0 6 20 6 10 0 fill gray\u201d is the road, it goes up from the horizon to a point at y 0, in the sky -- write tri 7 12 13 12 10 6 fill gray in its place, after the ground") >= 0, mr.problems);

  // --- the shore at sunset, four ways
  var sh = [F08, F2, F4, F35].map(function (F) { var r = row(F, "make-shore-sunset"), b = act.build(r.reply, item("make-shore-sunset").q); return { r: r, b: b }; });
  ok("the shore at sunset failed for all four models, and is questioned as on 1.24.8 (the 0.8B\u2019s blue sky, the 2B\u2019s tri off the grid, the 4B\u2019s sea with no land in front, the 35B\u2019s sea below the picture)",
    sh.every(function (x) { return x.r && !x.b.ok; }) && /blue of day/.test(sh[0].b.problems.join()) && /off the grid/.test(sh[1].b.problems.join()) &&
    /all water/.test(sh[2].b.problems.join()) && /\u201crect 0 12 20 12 fill blue\u201d is off the grid/.test(sh[3].b.problems.join()), sh.map(function (x) { return x.b.problems; }));

  // --- the rest, replayed as written
  async function replay(F) {
    var pass = [], left = [];
    for (var i = 0; i < F.rows.length; i++) {
      var r = F.rows[i], it = item(r.id), g;
      if (!it) continue;
      if (r.cat === "make") { var mk = act.build(r.reply, it.q); g = B.grade(it, r.reply, { made: mk, text: r.reply }); }
      else if (/^(tool|multi)$/.test(r.cat)) {
        var k = 0, first = r.first || r.reply;
        var out = await A.solve(it.q, { call: function () { k++; return Promise.resolve(R(k === 1 ? first : r.reply, it.q).text); } });
        g = B.grade(it, out.text, out);
      } else continue;
      (g.pass ? pass : left).push(r.id);
    }
    return { pass: pass, left: left };
  }
  var r08 = await replay(F08), r2 = await replay(F2), r4 = await replay(F4), r35 = await replay(F35);
  ok("of the failed makes and sums, replayed as the models wrote them, only the 35B\u2019s waltz passes (the 0.8B 38 rows, the 2B 26, the 4B 3, the 35B 3)",
    r08.pass.length === 0 && r08.left.length === 38 && r2.pass.length === 0 && r2.left.length === 26 && r4.pass.length === 0 && r4.left.length === 3 &&
    r35.pass.join() === "make-music-waltz" && r35.left.length === 2, [r08.pass, r08.left.length, r2.pass, r2.left.length, r4.pass, r4.left.length, r35]);
  console.log(fails ? fails + " BENCH 1.24.8 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.8 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
