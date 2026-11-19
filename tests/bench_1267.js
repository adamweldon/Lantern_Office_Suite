// bench_1267.js -- the small models' run of 1.24.27, replayed (1.24.28).
// The run (44543574456, tests/fixtures/bench_run_1267_{08b,2b,4b}.json): the 0.8B 61 of 115 (AMD EPYC 9V45, the same
// 54 rows as on 1.24.26 there, word for word but one), the 2B 77 (Xeon 8573C; 75 of 114 on 1.24.22 there), the 4B 106
// (Xeon 6975P-C; 107 on 1.24.26 there, the one row more the oil change). 1.24.27 had put MAKE DOC's steps right under
// the example's first heading ("## Steps") and taken its figures out. All three now write the lawn mower's oil
// change as a procedure under "## Steps", with no "30 minutes" and no compressor's oil, and end it; and all three
// stop there: one heading, and the bench's check asks for two ("no headings to find your way"). The 4B had passed
// it. None wrote the example's "## Afterwards": they had nothing of their own to go under it. A procedure begins
// with what is needed, so the example does now (1.24.28): "## You need" and a list of two, before the steps. A small
// model writes what the example shows; the next run says whether it writes this.
// Usage: node tests/bench_1267.js [inner.html]
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
  var R = { "08b": fixture("bench_run_1267_08b.json"), "2b": fixture("bench_run_1267_2b.json"), "4b": fixture("bench_run_1267_4b.json") };
  var P = { "08b": fixture("bench_run_1266_08b.json"), "4b": fixture("bench_run_1266_4b.json") };
  function row(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function grade(id, reply) { var it = item(id); return L.aiBench.grade(it, reply, { made: act.build(reply, it.q) }); }
  ok("boot clean; the run of 1.24.27: 61, 77 and 106 of 115, with 54, 38 and 9 failed rows", o.errs.length === 0 &&
    R["08b"].summary.pass === 61 && R["2b"].summary.pass === 77 && R["4b"].summary.pass === 106 && R["4b"].summary.n === 115 &&
    R["08b"].rows.length === 54 && R["2b"].rows.length === 38 && R["4b"].rows.length === 9, [o.errs, R["4b"].summary]);
  ok("...on the processors of the runs set beside them (the 0.8B and the 4B as on 1.24.26)", R["08b"].processor === P["08b"].processor && R["4b"].processor === P["4b"].processor, [R["08b"].processor, R["4b"].processor]);
  ok("the 4B passed the oil change on 1.24.26 and fails it on 1.24.27, its one new failed row",
    !row(P["4b"], "make-doc-oil-change") && !!row(R["4b"], "make-doc-oil-change") && R["4b"].rows.filter(function (r) { return !row(P["4b"], r.id); }).map(function (r) { return r.id; }).join() === "make-doc-oil-change");

  // --- the oil change, as all three wrote it ---
  ["08b", "2b", "4b"].forEach(function (m) {
    var r = row(R[m], "make-doc-oil-change"), heads = (r && r.reply.match(/^## .*$/mg)) || [], steps = (r && r.reply.match(/^\d+\. /mg)) || [];
    ok(m + ": the steps under “## Steps”, the document's one heading; ended; no figure of the old example", r && r.why === "no headings to find your way" && heads.join() === "## Steps" &&
      steps.length >= 5 && /\nEND\s*$/.test(r.reply) && !/30 minutes|1\.8|ISO VG|Before you start/.test(r.reply), r && r.reply.slice(0, 300));
    var g = grade("make-doc-oil-change", r.reply);
    ok(m + ": ...Lantern reads it as the run did", !g.pass && g.why === "no headings to find your way", g);
  });
  ok("the 0.8B on 1.24.26 copied “30 minutes” and was cut off; on 1.24.27 it ends after five steps", /30 minutes/.test(row(P["08b"], "make-doc-oil-change").reply) &&
    (row(R["08b"], "make-doc-oil-change").reply.match(/^\d+\. /mg) || []).length === 5);
  ok("the 2B's first step takes the spark plug lead off so it cannot start (the example's “so it cannot start”)", /^1\. .*spark plug wire to prevent accidental starting/m.test(row(R["2b"], "make-doc-oil-change").reply));
  ok("the 0.8B's “unplug the battery” is the example's “unplug” on a machine most of which have none (in the report)", /unplug the battery/.test(row(R["08b"], "make-doc-oil-change").reply));

  // --- the example now ---
  var prompt = act.prompt("Write a short procedure for changing the oil in a lawn mower engine, as a document I can print.");
  var ex = prompt.slice(prompt.indexOf("For example:\nMAKE DOC:")), all = ex.split("\n"), lines = all.slice(1, all.indexOf("END") + 1);
  ok("the example begins with what is needed: “## You need” and a list of two, then “## Steps” right above step 1, then “## Afterwards”",
    lines[1] === "## You need" && /^- /.test(lines[2]) && /^- /.test(lines[3]) && lines[4] === "## Steps" && /^1\. /.test(lines[5]) &&
    lines.filter(function (l) { return /^## /.test(l); }).join("|") === "## You need|## Steps|## Afterwards", lines);
  ok("...still no figure to copy, no “Before you start”, and the first step makes the machine safe",
    !/30 minutes|1\.8|ISO VG|litre|Before you start/.test(ex) && lines.every(function (l) { return !/\d/.test(l.replace(/^\d+\. /, "")); }) &&
    lines[5] === "1. Switch off and unplug the compressor so it cannot start, let all the air out of the tank, and let it cool.", lines);
  var d = L.aiDoc.doc({ title: "x", lines: lines.slice(1, -1), closed: true });
  ok("...a document Lantern makes as it is: three headings, a list and the steps", d.parts.headings === 3 && d.parts.items === 5 && /<ul><li>A pan for the old oil<\/li>/.test(d.html), d.parts);
  // each model's own steps, with the example's list of what is needed before them (a stand-in, not the models)
  ["08b", "2b", "4b"].forEach(function (m) {
    var r = row(R[m], "make-doc-oil-change"), body = r.reply.split("\n").filter(function (l) { return !/^MAKE DOC:|^END/.test(l); });
    var stand = "MAKE DOC: Changing the oil in a lawn mower engine\n## You need\n- A pan for the old oil\n- The oil its maker names\n" + body.join("\n") + "\nEND";
    var g = grade("make-doc-oil-change", stand);
    ok(m + ": its steps under the new example's first heading and its list pass the question (a stand-in, not the " + m + ")", g.pass, [g.why, stand.slice(0, 300)]);
  });
  ok("the bench's own ideal reply still passes", grade("make-doc-oil-change", item("make-doc-oil-change").ideal).pass);

  ok("no page errors", !o.errs.length, o.errs);
  console.log(fails ? fails + " FAILED (" + passes + " passed)" : "ALL BENCH 1.24.27 REPLAY CHECKS PASS (" + passes + " passed)");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL (threw)", e && e.stack); process.exit(1); });
