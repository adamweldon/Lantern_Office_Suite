// bench_1266.js -- the small models' run of 1.24.26, replayed (1.24.27).
// The run (44444468597, tests/fixtures/bench_run_1266_{08b,2b,4b}.json): the 0.8B 61 of 115 (AMD EPYC 9V45), the 2B 73
// (EPYC 9V74), the 4B 107 (Xeon 6975P-C); all three made the Word file when asked (make-doc-word-checklist). The 2B
// failed the lawn mower's oil change the same way on 1.24.7, 1.24.13, 1.24.20, 1.24.23, 1.24.25 and 1.24.26, on four
// processors: MAKE DOC's example began "## Before you start", and the 2B wrote that heading and then every step of
// the job under it ("Start the engine", "Dispose of the old oil"), so the heading was wrong for most of the list and
// the document had one heading. The example's figures went in too: "30 minutes" in every failed reply, and "1.8
// litres of ISO VG 100" (a compressor's oil) in the 0.8B's lawn mower on 1.24.21 and 1.24.25. An example in the
// instructions is what a small model writes (CLAUDE.md), so the example changed: its first heading is the one the
// steps go under ("## Steps"), what follows them has a heading of its own ("## Afterwards"), and it has no figure to
// copy. The replies themselves are the model's: Lantern reads them as before.
// Usage: node tests/bench_1266.js [inner.html]
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
  var R = { "08b": fixture("bench_run_1266_08b.json"), "2b": fixture("bench_run_1266_2b.json"), "4b": fixture("bench_run_1266_4b.json") };
  function row(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function grade(id, reply) { var it = item(id); return L.aiBench.grade(it, reply, { made: act.build(reply, it.q) }); }
  ok("boot clean; the run of 1.24.26: 61, 73 and 107 of 115, with 54, 42 and 8 failed rows", o.errs.length === 0 &&
    R["08b"].summary.pass === 61 && R["2b"].summary.pass === 73 && R["4b"].summary.pass === 107 && R["2b"].summary.n === 115 &&
    R["08b"].rows.length === 54 && R["2b"].rows.length === 42 && R["4b"].rows.length === 8, [o.errs, R["2b"].summary]);
  ok("all three made the Word file when asked: make-doc-word-checklist is in no model's failed rows", ["08b", "2b", "4b"].every(function (m) { return !row(R[m], "make-doc-word-checklist"); }));

  // --- the 2B's oil change, the same way on six versions ---
  var old = [fixture("bench_run_1247_2b.json"), fixture("bench_run_1253_2b.json"), R["2b"]].map(function (X) { return row(X, "make-doc-oil-change"); });
  ok("the 2B's oil change on 1.24.7, 1.24.13 and 1.24.26: one heading, “Before you start”, the example's, and every step under it",
    old.every(function (r) { return r && r.why === "no headings to find your way" && (r.reply.match(/^##/mg) || []).length === 1 && /^## Before you start\n1\. /m.test(r.reply) && (r.reply.match(/^\d+\. /mg) || []).length >= 10; }),
    old.map(function (r) { return r && r.reply.slice(0, 160); }));
  var g = grade("make-doc-oil-change", R["2b"].rows.filter(function (r) { return r.id === "make-doc-oil-change"; })[0].reply);
  ok("...Lantern reads the reply as before (the mend is what it shows the model, not how it reads)", !g.pass && g.why === "no headings to find your way", g);

  // --- the example now ---
  var prompt = act.prompt("Write a short procedure for changing the oil in a lawn mower engine, as a document I can print.");
  var ex = prompt.slice(prompt.indexOf("For example:\nMAKE DOC:")), lines = ex.split("\n").slice(1, ex.split("\n").indexOf("END") + 1);
  ok("the question gets MAKE DOC's instructions with the example", /MAKE DOC: <title>/.test(prompt) && lines[0] === "MAKE DOC: Changing the compressor oil" && lines[lines.length - 1] === "END", lines);
  // (1.24.28: "## You need" and its list went in before "## Steps"; tests/bench_1267.js says why. What 1.24.27 did holds.)
  var at = lines.indexOf("## Steps");
  ok("the heading the example's steps go under is right above step 1", at > 0 && /^1\. /.test(lines[at + 1]), lines);
  ok("...what follows the steps has a heading of its own", lines.slice(at + 1).some(function (l) { return l === "## Afterwards"; }), lines);
  ok("...no “Before you start” to put the steps under", !/Before you start/.test(ex));
  // (the first review of 1.24.27: copied whole for a compressor, the example had no step to cut the power or let the air out)
  ok("...its first step makes the machine safe: switched off and unplugged so it cannot start, the air let out, cooled", lines[at + 1] === "1. Switch off and unplug the compressor so it cannot start, let all the air out of the tank, and let it cool.", lines[at + 1]);
  ok("...and no figure a model would copy into another machine's procedure (no 30 minutes, no 1.8 litres of ISO VG 100; only the step numbers)",
    !/30 minutes|1\.8|ISO VG|litre/.test(ex) && lines.every(function (l) { return !/\d/.test(l.replace(/^\d+\. /, "")); }), lines);
  var made = act.build(lines.join("\n"), "Write a procedure");
  ok("...it is a document Lantern makes as it is: its headings, its steps, bold kept", made && made.ok !== false && L.aiDoc.doc({ title: "x", lines: lines.slice(1, -1), closed: true }).parts.headings >= 2 &&
    L.aiDoc.doc({ title: "x", lines: lines.slice(1, -1), closed: true }).parts.items >= 3 && /<b>Never<\/b>/.test(L.aiDoc.doc({ title: "x", lines: lines.slice(1, -1), closed: true }).html));
  // the 2B's way, kept: the example's first heading, then every step of the job under it. With the new example that
  // heading is right for them, and the rest of the example after them is a second heading.
  var steps = (R["2b"].rows.filter(function (r) { return r.id === "make-doc-oil-change"; })[0].reply.match(/^\d+\. .+$/mg) || []);
  var copied = "MAKE DOC: Changing the oil in a lawn mower engine\n" + lines[at] + "\n" + steps.join("\n") + "\n" + lines[lines.length - 3] + "\n" + "Check the level again after a short run.\nEND";
  var g2 = grade("make-doc-oil-change", copied);
  ok("the 2B's steps written the way it writes them, under the new example's headings, pass the question (a stand-in, not the 2B)", g2.pass, [g2.why, copied]);
  ok("the bench's own ideal reply still passes", grade("make-doc-oil-change", item("make-doc-oil-change").ideal).pass);

  // --- the 0.8B: the example's figures in a lawn mower ---
  var f21 = fixture("bench_run_1266_08b.json");
  ok("the 0.8B's failed oil change on 1.24.26 has the example's 30 minutes in it (as on every version)", /30 minutes/.test(row(f21, "make-doc-oil-change").reply));

  ok("no page errors", !o.errs.length, o.errs);
  console.log(fails ? fails + " FAILED (" + passes + " passed)" : "ALL BENCH 1.24.26 REPLAY CHECKS PASS (" + passes + " passed)");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL (threw)", e && e.stack); process.exit(1); });
