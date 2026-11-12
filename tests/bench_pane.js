// bench_pane.js -- tools/bench_pane.js (1.24.2): Lantern Bench started and read
// from outside the page, as a Claude chat linked to a computer does in the
// desktop app's browser pane. Chosen questions by id and by pattern, the
// rows kept as they finish, the bench's whole list put back, a second start
// refused while one runs. The questions used are the ones Lantern answers by
// rule (a child's dose, bleach and ammonia), so no model is needed.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var tool = fs.readFileSync(path.join(__dirname, "..", "tools", "bench_pane.js"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; return function () {}; }, set: function (t, k, v) { t[k] = v; return true; } }); };
var calls = 0;
w.fetch = function () { calls++; return Promise.reject(new TypeError("no model in this test")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
w.eval(js);
(async function () {
  var L = w.Lantern, all = L.aiBenchQuestions, n = all.length;
  w.eval(tool);
  var B = w.lanternBench;
  ok("the tool is there, and says so when Lantern Bench is not", B && typeof B.start === "function" && typeof B.status === "function" && B.status().state === "none", B && Object.keys(B));
  ok("a question that is not in the bench is named, and nothing starts", JSON.stringify(B.start({ ids: ["child-dose", "no-such-question"] }).missing) === "[\"no-such-question\"]" && B.status().state === "none" &&
    B.start({ match: "^zzz" }).error === "no question matches" && L.aiBenchQuestions.length === n);
  var st = B.start({ ids: ["bleach-mix", "child-dose"] });
  ok("chosen questions start, in the bench's own order", st.started && st.kind === "chosen" && st.lantern === L.version && st.questions.join() === "child-dose,bleach-mix", st);
  ok("...a second start while it runs is refused", B.start({ quick: true }).busy === true);
  for (var i = 0; i < 100 && B.status().state === "running"; i++) await sleep(50);
  var s = B.status();
  ok("...they finish: both pass by Lantern's rule, with no call to a model", s.state === "done" && s.done === 2 && s.total === 2 && !s.fails.length && s.summary && s.summary.pass === 2 &&
    s.last.length === 2 && /^child-dose:ok:\d+s$/.test(s.last[0]), s);
  ok("...the rows and the report are kept in the page's storage", JSON.parse(w.localStorage.getItem("lanternBench.rows")).length === 2 && JSON.parse(w.localStorage.getItem("lanternBench.report")).lantern === L.version &&
    B.rows(["bleach-mix"]).length === 1 && B.rows("failed").length === 0 && B.report().rows.length === 2);
  ok("...and the bench has its whole list again", L.aiBenchQuestions === all && L.aiBenchQuestions.length === n, L.aiBenchQuestions.length);
  var st2 = B.start({ match: "^(child-dose|bleach-mix)$" });
  for (i = 0; i < 100 && B.status().state === "running"; i++) await sleep(50);
  ok("questions chosen by a pattern", st2.started && st2.questions.length === 2 && B.status().state === "done" && L.aiBenchQuestions.length === n, st2);
  // (1.24.16) set B: the same kinds of question asking for other things
  var allB = L.aiBenchQuestionsB, nb = allB.length;
  var st3 = B.start({ set: "b", ids: ["bleach-vinegar-b", "ibuprofen-child-b"] });
  for (i = 0; i < 100 && B.status().state === "running"; i++) await sleep(50);
  var s3 = B.status();
  ok("set B: chosen questions of set B start and finish, and its report says set b", st3.started && st3.set === "b" && st3.kind === "set B chosen" && st3.questions.join() === "ibuprofen-child-b,bleach-vinegar-b" &&
    s3.state === "done" && s3.done === 2 && B.report().set === "b" && L.aiBenchQuestionsB === allB && L.aiBenchQuestionsB.length === nb && L.aiBenchQuestions === all, [st3, s3.state, s3.done]);
  ok("...a set A id is not in set B", JSON.stringify(B.start({ set: "b", ids: ["child-dose"] }).missing) === "[\"child-dose\"]");
  ok("the tool is ES5, like Lantern (no arrow functions, let, const or template literals)", !/=>|\blet\s|\bconst\s|`/.test(tool.replace(/\/\/[^\n]*/g, "")));
  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? fails + " BENCH PANE FAILURES (" + passes + " passed)" : "ALL BENCH PANE TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack || e); process.exit(1); });
