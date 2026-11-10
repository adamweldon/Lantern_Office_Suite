// bench_1250.js -- the small models' rows on 1.24.10, replayed (1.24.11).
// GitHub run 42509727008: the 0.8B 59 of 114 and the 2B 73, the same rows failed as on 1.24.9; the 4B 106 (110 on
// 1.24.8 and 1.24.9). The 4B ran on an AMD EPYC 7763 (on 1.24.8 an EPYC 9V74, on 1.24.9 a Xeon 8573C) and wrote,
// word for word, the replies of its 1.24.7 run to six questions, failing them again: a run's replies follow its
// processor (CLAUDE.md). Those six are the work: each has failed on two versions with the same reply.
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
  var A08 = fixture("bench_run_1250_08b.json"), A2 = fixture("bench_run_1250_2b.json"), A4 = fixture("bench_run_1250_4b.json");
  var B08 = fixture("bench_run_1249_08b.json"), B2 = fixture("bench_run_1249_2b.json"), C4 = fixture("bench_run_1247_4b.json");
  function ids(F) { return F.rows.map(function (r) { return r.id; }).sort().join(); }
  function row(F, id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  ok("boot clean; the run\u2019s failed rows (the 0.8B 55, the 2B 41, the 4B 8 of 114), the 0.8B\u2019s and the 2B\u2019s the same as on 1.24.9",
    o.errs.length === 0 && A08.rows.length === 55 && A2.rows.length === 41 && A4.rows.length === 8 && A4.summary.pass === 106 && A4.processor === "AMD EPYC 7763" &&
    ids(A08) === ids(B08) && ids(A2) === ids(B2), [o.errs, ids(A4)]);
  var six = ["water-days", "make-power-wheel", "doors-host-guesses", "letters-refrigerator", "code-st-tank-fill", "make-music-orchestra"];
  ok("the 4B\u2019s six rows of 1.24.7, failed again with the same replies, word for word (" + six.join(", ") + ")",
    six.every(function (id) { var a = row(A4, id), c = row(C4, id); return a && c && a.reply === c.reply && (a.first || "") === (c.first || ""); }));
  var rd = row(A4, "make-road-horizon"), mr = act.build(rd.reply, rd.q || "Draw a road going into the distance, toward the horizon.");
  // (1.24.14: moved after the ground and said -- the same reply on four versions, tests/bench_1254.js)
  ok("...its road, drawn under the ground written after it, was asked about as hidden (the line to write is the order); since 1.24.14 it is moved after the ground",
    /the tri 0 12 10 6 20 12 \(gray\) is hidden/.test(rd.why) && mr.ok && JSON.stringify(mr).indexOf("moved \u201ctri 0 12 10 6 20 12 fill gray\u201d after") >= 0);
  var wz = row(A4, "make-music-waltz");
  ok("...its waltz ends on E over D, a whole step from the chord: made, and failed by the bench\u2019s own ending check (Lantern mends only a half step)",
    /does not end on a note of its last chord/.test(wz.why) && /G - - F# - E\s*$/m.test(wz.reply.split("\n").filter(function (l) { return /^melody /.test(l); })[0] || ""));
  var orch = row(A4, "make-music-orchestra"), ob = act.build(orch.reply, "Arrange the main theme of Beethoven\u2019s Ode to Joy for orchestra, so I can hear the whole orchestra play it.");
  ok("...its orchestra: \u201cpart strings\u201d is the strings (the table has them; the plural rule made it \u201cstring\u201d), no longer \u201cno such instrument\u201d; its brass and bass parts, a bar or two short, are asked about as before",
    /part strings: Lantern has no such instrument/.test(orch.why) && !ob.problems.some(function (p) { return /part strings/.test(p); }) && /^part brass has 14 bars; the tune has 16/.test(ob.problems[0]), ob.problems);
  console.log(fails ? fails + " BENCH 1.24.10 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.10 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
