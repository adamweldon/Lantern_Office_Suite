// bench_1249.js -- the small models' rows on 1.24.9, replayed (1.24.10).
// GitHub run 42490364017. 1.24.9 changed only how the library is read, and the GitHub runs have no library:
// the 0.8B failed the same 55 rows as on 1.24.8 (59 of 114), the 4B the same 4 (110), each with the same replies
// where it was a drawing; the 2B 41 (73; on 1.24.8 77): six rows moved each way, which is no finding.
// What they show: the 4B's shore at sunset failed on both versions with the same two replies. Its first block was
// asked about the day's blue sky and the orange band under its sea, and not about the shore: the band hidden under
// the sea was read as land in front of it. The model took the band out, and the shore was asked about only then,
// a turn too late. 1.24.10 reads what is seen below the horizon.
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
  var act = L.aiAct;
  var F08 = fixture("bench_run_1249_08b.json"), F2 = fixture("bench_run_1249_2b.json"), F4 = fixture("bench_run_1249_4b.json");
  var G08 = fixture("bench_run_1248_08b.json"), G4 = fixture("bench_run_1248_4b.json");
  function ids(F) { return F.rows.map(function (r) { return r.id; }).sort().join(); }
  function row(F, id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  ok("boot clean; the run\u2019s failed rows (the 0.8B 55, the 2B 41, the 4B 4 of 114); the 0.8B and the 4B failed the same rows as on 1.24.8",
    o.errs.length === 0 && F08.rows.length === 55 && F2.rows.length === 41 && F4.rows.length === 4 && F08.summary.pass === 59 && F2.summary.pass === 73 && F4.summary.pass === 110 &&
    [F08, F2, F4].every(function (F) { return F.lantern === "1.24.9" && F.summary.n === 114; }) && ids(F08) === ids(G08) && ids(F4) === ids(G4), [o.errs, ids(F4)]);
  var s9 = row(F4, "make-shore-sunset"), s8 = row(G4, "make-shore-sunset"), Q = s9.q;
  ok("the 4B\u2019s shore at sunset: the same first block and the same reply on both versions", s9.first === s8.first && s9.reply === s8.reply && /all water/.test(s9.why), [s9.why]);
  var b1 = act.build(s9.first, Q), b2 = act.build(s9.reply, Q);
  ok("...its first block is now asked about the shore with the rest, with the line to add (the orange band under the sea is no land in front of it)",
    !b1.ok && b1.problems.length === 3 && /blue of day/.test(b1.problems[0]) && /\(orange\) is hidden/.test(b1.problems[1]) &&
    /^the question asks for a shore, but below the horizon \(y 8\) the picture is all water: add rect 0 10\.5 20 1\.5 fill sand after the water/.test(b1.problems[2]) &&
    /all water/.test(b2.problems.join()), [b1.problems, b2.problems]);
  function shore(lines) { var b = act.build("MAKE DRAWING: Shore\n" + lines.join("\n") + "\nEND", Q); return (b.problems || []).some(function (p) { return /all water/.test(p); }); }
  var sky = "rect 0 0 20 12 fill orange", sea = "rect 0 8 20 4 fill blue", mt = "tri 2 8 6 4 10 8 fill gray";
  ok("...what is seen is what counts: sand drawn after the sea is land; sand drawn before it and covered is not; a rock in front, of two cells or more, is land",
    !shore([sky, mt, sea, "rect 0 10.5 20 1.5 fill tan"]) && shore([sky, mt, "rect 0 10.5 20 1.5 fill tan", sea]) &&
    !shore([sky, mt, sea, "circle 15 10.5 1 fill gray"]) && shore([sky, mt, sea, "circle 15 10.5 0.3 fill gray"]),
    [shore([sky, mt, sea, "rect 0 10.5 20 1.5 fill tan"]), shore([sky, mt, "rect 0 10.5 20 1.5 fill tan", sea])]);
  console.log(fails ? fails + " BENCH 1.24.9 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.9 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
