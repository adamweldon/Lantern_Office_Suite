// bench_1249_35b.js -- Adam's run of the 35B on 1.24.9 with the library, replayed (1.24.11).
// His laptop, 2026-11-08, 103 minutes: 134 of 140, the same seven questions failed as on 1.24.8
// (tests/fixtures/bench_run_1249_35b_library.json). What the rows show:
//  - 1.24.9's library change did its work: the three library questions, which the 35B declined on 1.24.6 and 1.24.8
//    ("Not in my library"), are answered from the library, rightly. They fail on what is cited: what oral rehydration
//    solution is made of was read in Wikipedia, not in WikiMed -- "rehydration" was not one of the medicine shelf's
//    words ("dehydration" was), so the shelf was not read; the iPhone's battery and Nairobi's transport cite a passage
//    with no quote from it that Lantern could find;
//  - the four others are the replies of 1.24.8, word for word: the road and the waltz pass on 1.24.10, the shore at
//    sunset (its sea below the picture) and the die's four moves do not.
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
  var B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct, LIB = L.library;
  var F = fixture("bench_run_1249_35b_library.json"), G = fixture("bench_run_1248_35b_library.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  ok("boot clean; the run\u2019s seven failed rows, 134 of 140, the same questions as on 1.24.8", o.errs.length === 0 && F.lantern === "1.24.9" && F.rows.length === 7 &&
    F.summary.pass === 134 && F.summary.n === 140 && F.rows.map(function (r) { return r.id; }).sort().join() === G.rows.map(function (r) { return r.id; }).sort().join(), [o.errs, F.summary]);
  var libIds = ["shelf-ors", "shelf-iphone-battery", "shelf-nairobi-transport"];
  ok("the three library questions, declined on 1.24.8, are answered from the library on 1.24.9 (the iPhone and Nairobi declined first, and were sent back)",
    libIds.every(function (id) { var r = row(F, id), g = row(G, id); return /Not in my library/.test(g.reply) && !/Not in my library/.test(r.reply) && /\[\d\]/.test(r.reply); }) &&
    /Not in my library/.test(row(F, "shelf-iphone-battery").first) && /Not in my library/.test(row(F, "shelf-nairobi-transport").first));
  var med = LIB.shelves.filter(function (s) { return s.id === "medicine"; })[0];
  ok("what oral rehydration solution is made of reads the medicine shelf first (\u201crehydration\u201d is one of its words, with ORS and electrolytes)",
    med.topic.test(item("shelf-ors").q) && med.topic.test("How much ORS for a child?") && med.topic.test("Which electrolytes are lost in sweat?") && !med.topic.test("Doors and windows of a house"));
  var mk = ["make-road-horizon", "make-music-waltz", "make-shore-sunset"];
  ok("the made things are 1.24.8\u2019s replies word for word", mk.every(function (id) { return row(F, id).reply === row(G, id).reply; }));
  var pass = mk.map(function (id) { var it = item(id), r = row(F, id), b = act.build(r.reply, it.q); return B.grade(it, r.reply, { made: b, text: r.reply }).pass === true; });
  ok("...on 1.24.10 the waltz passes and the road is asked for with the line to add; the shore, its sea below the picture, still fails",
    // (1.24.14: its tri going up from the horizon is named, the line written in its place)
    pass[1] === true && pass[0] === false && act.build(row(F, "make-road-horizon").reply, item("make-road-horizon").q).problems.join("\n").indexOf("if \u201ctri 0 6 20 6 10 0 fill gray\u201d is the road, it goes up from the horizon to a point at y 0, in the sky -- write tri 7 12 13 12 10 6 fill gray in its place, after the ground") >= 0 && pass[2] === false, pass);
  console.log(fails ? fails + " BENCH 1.24.9 35B FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.9 35B CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
