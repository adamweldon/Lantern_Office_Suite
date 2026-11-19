// bench_1268.js -- the small models' run of 1.24.28, replayed (1.24.29).
// The run (44609599991, tests/fixtures/bench_run_1268_{08b,2b,4b}.json): the 0.8B 61 of 116 (AMD EPYC 9V74), the 2B
// 73 (EPYC 9V74; 73 of 115 on 1.24.26 there), the 4B 106 (Xeon 6975P-C; 106 of 115 on 1.24.27 there). The 4B passes
// the oil change under MAKE DOC's new example ("## You need" first); the 0.8B copied that example whole into the
// mower's document (the compressor's tank and all) and the 2B's list of what is needed ran on until it was cut off.
// The new Excel question failed on all three, each by its own sheet (no formulas; the labour worked out from the
// wrong cells). The 4B's shopping list, after its =[2]*[1.50] was sent back, wrote =[B2]*[C2]: [B2] where no column is
// called B2 can only be the cell, and from 1.24.29 Lantern reads it so, and says so.
// Usage: node tests/bench_1268.js [inner.html]
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
  var Q = L.aiBenchQuestions, act = L.aiAct;
  var R = { "08b": fixture("bench_run_1268_08b.json"), "2b": fixture("bench_run_1268_2b.json"), "4b": fixture("bench_run_1268_4b.json") };
  var P = { "4b": fixture("bench_run_1267_4b.json"), "2b": fixture("bench_run_1266_2b.json") };
  function row(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function grade(id, reply) { var it = item(id); return L.aiBench.grade(it, reply, { made: act.build(reply, it.q) }); }
  ok("boot clean; the run of 1.24.28: 61, 73 and 106 of 116, with 55, 43 and 10 failed rows", o.errs.length === 0 &&
    R["08b"].summary.pass === 61 && R["2b"].summary.pass === 73 && R["4b"].summary.pass === 106 && R["4b"].summary.n === 116 &&
    R["08b"].rows.length === 55 && R["2b"].rows.length === 43 && R["4b"].rows.length === 10, [o.errs, R["4b"].summary]);
  ok("...the 4B on the processor of its 1.24.27 run, the 2B on that of its 1.24.26 run (73 there too)", R["4b"].processor === P["4b"].processor && R["2b"].processor === P["2b"].processor && P["2b"].summary.pass === 73,
    [R["4b"].processor, R["2b"].processor]);
  var new4 = R["4b"].rows.filter(function (r) { return !row(P["4b"], r.id); }).map(function (r) { return r.id; }).sort().join();
  ok("the 4B passes the oil change (failed on 1.24.27); its new failed rows the new Excel question and the shopping list", !row(R["4b"], "make-doc-oil-change") && !!row(P["4b"], "make-doc-oil-change") &&
    new4 === "make-sheet-excel,make-shopping", new4);

  // --- the shopping list: =[B2]*[C2], the 4B's second reply after its first (=[2]*[1.50]) was sent back ---
  var sh = row(R["4b"], "make-shopping");
  ok("the 4B wrote =[B2]*[C2] for =B2*C2, and the run's Lantern questioned [B2] as a column", /=\[B2\]\*\[C2\]/.test(sh.reply) && /names \[B2\], which is not a column/.test(sh.why), sh.why);
  var g = grade("make-shopping", sh.reply), made = act.build(sh.reply, item("make-shopping").q);
  ok("...[B2] where no column is called B2 is the cell B2 (1.24.29): the list passes, and Lantern says what it read", g.pass && JSON.stringify(made).indexOf("read [B2] as the cell B2") >= 0, [g.why, JSON.stringify(made).slice(0, 300)]);
  ok("...a column called [Total] is still the column (=SUM([Total]))", /=SUM\(D2:D4\)/.test(JSON.stringify(made)), JSON.stringify(made).slice(0, 400));

  // --- the Excel question: the models' own sheets ---
  var ex4 = row(R["4b"], "make-sheet-excel");
  ok("the 4B's Excel sheet puts 3 under Labour and works out =A2*B2 (9, not 75): its own error, read as it wrote it", /3 \| 3 \| 25 \| =A2\*B2/.test(ex4.reply) && !grade("make-sheet-excel", ex4.reply).pass &&
    grade("make-sheet-excel", ex4.reply).why === "the labour is not worked out (3 hours at 25 is 75)", ex4.reply);
  ok("the 0.8B's is a table of numbers, the 2B's says it cannot make an .xlsx and leaves the totals empty: no formulas, both", grade("make-sheet-excel", row(R["08b"], "make-sheet-excel").reply).why === "no formulas: the sheet should work out the costs" &&
    /cannot generate a downloadable/.test(row(R["2b"], "make-sheet-excel").reply) && grade("make-sheet-excel", row(R["2b"], "make-sheet-excel").reply).why === "no formulas: the sheet should work out the costs");
  ok("the bench's own ideal reply passes, and makes an Excel file with its formulas", grade("make-sheet-excel", item("make-sheet-excel").ideal).pass);

  // --- the oil change under the example that begins with what is needed ---
  var o8 = row(R["08b"], "make-doc-oil-change"), o2 = row(R["2b"], "make-doc-oil-change");
  ok("the 0.8B copied the example whole, the compressor's tank and all, into the mower's document, and stopped without END",
    /let all the air out of the tank/.test(o8.reply) && !/\nEND\s*$/.test(o8.reply) && /cut off before END/.test(o8.why), o8.reply.slice(0, 300));
  ok("the 2B's list of what is needed ran on (a rag for the filter, a rag for the pan ...) until it was cut off",
    (o2.reply.match(/- A rag for wiping the oil (filter|pan)/g) || []).length >= 10 && /cut off before END/.test(o2.why), o2.reply.slice(0, 200));
  ok("the bench's own ideal reply still passes", grade("make-doc-oil-change", item("make-doc-oil-change").ideal).pass);

  ok("no page errors", !o.errs.length, o.errs);
  console.log(fails ? fails + " FAILED (" + passes + " passed)" : "ALL BENCH 1.24.28 REPLAY CHECKS PASS (" + passes + " passed)");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL (threw)", e && e.stack); process.exit(1); });
