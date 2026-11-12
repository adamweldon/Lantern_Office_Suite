// review_1256_setb.js -- the review of set B, replayed (CLAUDE.md: a new rule is tried by someone who did not write it,
// and what it wrote stays in tests/fixtures).
//
// Set B (1.24.16) was tried by a separate agent that had not seen it written: every question's ground truth worked out
// on its own, and 292 replies of its own -- right ones above all -- put through the graders
// (fixtures/review1_1256_setb.json). It found 16 graders that failed right answers, 2 that passed wrong ones, 9
// questions not of the same difficulty as their twins in set A, and 25 smaller things. Each finding has its response in
// the fixture: mended, or left as it is with the reason (a gap in Lantern that set B is there to measure, or the same
// as set A's twin). Here every reply of the reviewer's is graded again: each comes out as the reviewer said it should,
// or is one of the few known, each with its reason -- most of them Lantern putting the reply right and saying so.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1256_setb.json"), "utf8"));
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("no network")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 2400)); } }

w.eval(JS);
var ev = w.document.createEvent("Event"); ev.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(ev);
setTimeout(function () {
  var L = w.Lantern, QB = L.aiBenchQuestionsB || [];
  function item(id) { return QB.filter(function (x) { return x.id === id; })[0]; }
  ok("boot clean; the review is here: 147 questions looked at, 52 findings, 292 replies", errs.length === 0 && F.findings.length === 147 &&
    F.findings.filter(function (f) { return f.severity; }).length === 52 && F.make.length + F.puzzle.length + F.safety.length + F.sums.length === 292, errs);
  ok("every question of set B was looked at", QB.every(function (x) { return F.findings.some(function (f) { return f.id === x.id || (x.id === "atacama-continent-b" && f.id === "gobi-continent-b"); }); }),
    QB.filter(function (x) { return !F.findings.some(function (f) { return f.id === x.id; }); }).map(function (x) { return x.id; }));
  ok("every finding has its response: mended, or left with its reason", F.findings.filter(function (f) { return f.severity; }).every(function (f) {
    return /^(mended|left as it is)/.test(F.responses[f.id] || ""); }), F.findings.filter(function (f) { return f.severity && !F.responses[f.id]; }).map(function (f) { return f.id; }));
  ok("...the two graders that passed wrong answers are both mended", F.findings.filter(function (f) { return f.severity === "grader passes wrong"; }).every(function (f) { return /^mended/.test(F.responses[f.id]); }));
  ok("...and the sixteen that failed right ones", F.findings.filter(function (f) { return f.severity === "grader fails right"; }).length === 16 &&
    F.findings.filter(function (f) { return f.severity === "grader fails right"; }).every(function (f) { return /^mended/.test(F.responses[f.id]); }));

  var nk = 0, off = [];
  ["make", "puzzle", "safety", "sums"].forEach(function (k) {
    F[k].forEach(function (c) {
      var it = item(c.id), pass, why;
      if (!it) { off.push([k, c.id, "no such question"]); return; }
      if (k === "puzzle") { why = it.check(it.answerOf(c.reply)); pass = !why; }
      else { var g = L.aiBench.grade(it, c.reply, k === "make" ? { made: L.aiAct.build(c.reply, it.q) } : {}); pass = g.pass; why = g.why; }
      var key = k + "|" + c.id + "|" + c.label;
      if (c.known) { nk++; if (pass !== /^passes/.test(c.known)) off.push([key, "known to " + c.known.split(":")[0] + ", now " + (pass ? "passes" : "fails: " + why)]); }
      else if ((c.want === "pass") !== pass) off.push([key, "want " + c.want, why]);
    });
  });
  ok("every reply of the reviewer\u2019s comes out as it said, or as the known ones do (16, each with its reason)", !off.length && nk === 16, [nk, off]);
  var right = 0, wrong = 0;
  ["make", "puzzle", "safety", "sums"].forEach(function (k) { F[k].forEach(function (c) { if (c.want === "pass") right++; else wrong++; }); });
  ok("the reviewer\u2019s replies: right ones above all (" + right + " right, " + wrong + " wrong)", right > wrong * 1.5, [right, wrong]);

  console.log(fails ? fails + " REVIEW SET B FAILURES (" + passes + " passed)" : "ALL REVIEW SET B CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
}, 120);
