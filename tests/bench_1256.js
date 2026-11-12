// bench_1256.js -- the runs of 1.24.15, replayed (CLAUDE.md: a bench run's failed rows go in tests/fixtures and tests
// replay them).
//
// Adam's run of the 35B on 1.24.15 with the library (2026-11-12, 19:25 UTC, 119 minutes): 138 of 140
// (bench_run_1255_35b_library.json). With it: "The two failures looked like they did look up the answers I am not sure
// about the grading?" They did: both are the 35B's replies of 1.24.13 and 1.24.14 word for word, and both found the
// right passages; both fail on the bench's rule that every [n] in an answer has a QUOTE [n] line found word for word
// in passage n -- the iPhone cites [3] and writes no QUOTE [3]; Nairobi's QUOTE [3] is not in passage 3. A person
// with only the stick cannot check an answer whose quote is not in the book, so Lantern sends it back, and a reply it
// still questions is not counted. Under seen: the three pictures of his 1.24.14 run, written word for word again,
// which pass now and which Lantern now draws as a person would want (tests/bench_1255.js).
//
// The small models' run of 1.24.15 on GitHub (bench_run_1255_{4b,2b,08b}.json): the 4B 108 of 114 on the same
// processor as 1.24.14 (an AMD EPYC 7763), the same six rows failing; the 2B 73 and the 0.8B 59 on other processors
// (an EPYC 9V45 and a 9V74), so not set against 1.24.14's 74 and 54 (CLAUDE.md: a run's replies follow its processor).
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
  var F = fixture("bench_run_1255_35b_library.json"), G = fixture("bench_run_1254_35b_library.json");
  function row(X, id) { return X.rows.concat(X.seen || []).filter(function (r) { return r.id === id; })[0]; }
  function ids(X) { return X.rows.map(function (r) { return r.id; }).sort(); }
  function srcs(r) { return r.library.passages.map(function (t, i) { return { n: i + 1, title: r.library.sources[i], text: t }; }); }
  ok("boot clean; Adam's run of 1.24.15: 138 of 140, five rows that did not pass (three of them puzzles without the tools, not scored), three pictures seen",
    o.errs.length === 0 && F.lantern === "1.24.15" && F.summary.pass === 138 && F.summary.n === 140 && F.rows.length === 5 && F.seen.length === 3, [o.errs, F.summary]);
  ok("against 1.24.14: the road passes now; nothing fails that passed", ids(G).filter(function (i) { return ids(F).indexOf(i) < 0; }).join() === "make-road-horizon" &&
    ids(F).filter(function (i) { return ids(G).indexOf(i) < 0; }).length === 0, [ids(F), ids(G)]);
  var same = ["shelf-iphone-battery", "shelf-nairobi-transport", "die-four-moves-alone", "houses-four-alone", "doors-host-guesses-alone", "make-house", "make-sunset-house", "make-road-horizon"];
  ok("every row of the run kept here is the 35B's reply of 1.24.14 word for word (the same rows, the same replies)",
    same.every(function (id) { return row(F, id) && row(G, id) && row(F, id).reply === row(G, id).reply; }), same.filter(function (id) { return !row(F, id) || !row(G, id) || row(F, id).reply !== row(G, id).reply; }));

  // --- Adam's question: the grading of the two library rows ---
  var ip = row(F, "shelf-iphone-battery"), nr = row(F, "shelf-nairobi-transport");
  ok("both looked the answer up: the iPhone found the iFixit guides for the iPhone 8 and 8 Plus, Nairobi Wikivoyage\u2019s Nairobi page",
    ip.library.sources.join() === "iPhone 8,iPhone 8 Battery Replacement,iPhone 8 Plus Battery Replacement" && nr.library.sources[0] === "Nairobi" && ip.rounds === 3 && nr.rounds === 3);
  ok("...and both failed on the quotes, not the facts: the iPhone cites [3] with no QUOTE [3] line, Nairobi\u2019s QUOTE [3] is not in passage 3",
    ip.why === "citation not verified: there is no QUOTE [3] line" && nr.why === "citation not verified: QUOTE [3] is not in passage 3: copy the sentence exactly", [ip.why, nr.why]);
  var vi = L.libraryVerify(L.libraryRenumber(ip.reply, srcs(ip)).text, srcs(ip), ip.q);
  ok("...Lantern reads the iPhone reply so today: QUOTE [3] is missing", !vi.ok && vi.problems.some(function (p) { return /no QUOTE \[3\] line/.test(p); }), vi.problems);
  ok("...the sentence the [3] stands for is in passage 3, the iPhone 8 Plus guide (\u201cdischarge your iPhone battery below 25%\u201d)",
    srcs(ip)[2].text.indexOf("Step 1: Before you begin, discharge your iPhone battery below 25%.") >= 0);

  // --- the three pictures Adam pointed at: written again, drawn now as he wanted ---
  function said(id) { var r = row(F, id), m = L.aiAct.fromReply(r.reply, r.q); return ((m && m.plan && m.plan.said) || []).join(" | "); }
  ok("the house: its door put on its wall; the house at sunset: its tree moved clear; the road: drawn by Lantern",
    /^moved the door, /.test(said("make-house")) && /moved the tree, /.test(said("make-sunset-house")) && /drew the road the question asks for/.test(said("make-road-horizon")),
    [said("make-house"), said("make-sunset-house"), said("make-road-horizon")]);

  // --- the small models on 1.24.15 ---
  var S4 = fixture("bench_run_1255_4b.json"), S2 = fixture("bench_run_1255_2b.json"), S0 = fixture("bench_run_1255_08b.json"), P4 = fixture("bench_run_1254_4b.json");
  ok("the small models on 1.24.15: the 4B 108, the 2B 73, the 0.8B 59", S4.lantern === "1.24.15" && S4.summary.pass === 108 && S2.summary.pass === 73 && S0.summary.pass === 59 &&
    S4.summary.n === 114, [S4.summary.pass, S2.summary.pass, S0.summary.pass]);
  ok("...the 4B on the same processor as on 1.24.14, the same six rows failing", S4.processor === P4.processor && /EPYC 7763/.test(S4.processor) &&
    S4.rows.map(function (r) { return r.id; }).sort().join() === P4.rows.map(function (r) { return r.id; }).sort().join(), S4.rows.map(function (r) { return r.id; }));
  ok("...the 2B and the 0.8B on other processors, not compared", /9V45/.test(S2.processor) && /9V74/.test(S0.processor), [S2.processor, S0.processor]);

  console.log(fails ? fails + " BENCH 1.24.16 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.16 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
