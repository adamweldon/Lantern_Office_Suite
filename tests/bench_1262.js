// bench_1262.js -- the 9B on Adam's laptop, set up by the one-link starter's test build (2026-11-16): set A quick 16 of
// 17, set B quick 15 of 17 (tests/fixtures/bench_run_1261_9b_seta_quick.json, bench_run_1261_9b_setb_quick.json).
//  - escape velocity from Mars (A) and from the Moon (B): =ESCV(PLANET(body,"radius")), refused as "inside the Earth
//    ... add 6371 km to an altitude"; on B the 9B did add it, and the wrong number ran. Both now get the line with
//    the body's GM (tests/other_body_gm.js has the cases);
//  - the button LED sketch (B): "arduino" alone on the line after MAKE CODE read as line 1 of the sketch ("may be
//    missing a ;"), questioned for good. Now the language's name alone is the language line.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8"), js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function fx(n) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", n), "utf8")); }
var FA = fx("bench_run_1261_9b_seta_quick.json"), FB = fx("bench_run_1261_9b_setb_quick.json");
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window; w.HTMLCanvasElement.prototype.getContext = function () { return null; }; w.fetch = function () { return Promise.reject(new Error("no network")); };
w.HTMLElement.prototype.scrollIntoView = function () {}; w.scrollTo = function () {};
w.eval(js);
function row(F, id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
function block(reply, kind) { var m = new RegExp("MAKE " + kind + ":[^\\n]*\\n([\\s\\S]*?)\\nEND").exec(reply); return m ? m[1] : null; }
setTimeout(async function () {
  var L = w.Lantern, A = L.assist;
  ok("boot clean; the two runs: 16 of 17 and 15 of 17 on the 9B", errs.length === 0 && FA.summary.pass === 16 && FB.summary.pass === 15 && /9B/.test(FA.model) && /9B/.test(FB.model), errs);
  var mb = row(FB, "moon-escape-b");
  ok("as run (B): =ESCV(PLANET(\"Moon\",\"radius\")) refused, then +6371000 written and run", /^=ESCV\(PLANET\("Moon","radius"\)\)/.test(mb.first || "") && /^=ESCV\(PLANET\("Moon","radius"\)\+6371000\)/.test(mb.reply), [mb.first, mb.reply]);
  var asked = [];
  var r = await A.solve(mb.q, { call: function (msgs) { asked.push(msgs[msgs.length - 1].content); return Promise.resolve(asked.length === 1 ? mb.first : mb.reply); } });
  ok("now the refusal comes with the line with the Moon's GM", /Write =ESCV\(PLANET\("Moon","radius"\),PLANET\("Moon","gm"\)\)/.test(asked[1] || ""), asked[1]);
  var r2 = A.run(mb.reply.split("\n")[0]), flags = (L.assistChecks || []).map(function (f) { try { return f(mb.q, mb.reply.split("\n")[0], r2, {}); } catch (e) { return null; } }).filter(Boolean);
  ok("...and the reply that added Earth's radius is questioned, with the line that leaves it out", flags.some(function (x) { return /leave Earth.s radius out .*Write =ESCV\(PLANET\("Moon","radius"\),PLANET\("Moon","gm"\)\)/.test(x); }), flags);
  var cb = row(FB, "code-b-button-led"), body = block(cb.reply, "CODE");
  var b = L.aiCode.build({ title: "T", raw: body.split("\n") }, { question: cb.q });
  ok("the button LED sketch: \"arduino\" alone is its language line, and nothing is questioned", b.problems.length === 0 && /^\/\/ Button LED Toggle/.test(L.aiCode.parse({ raw: body.split("\n") }).text), b.problems);
  ok("...as it was on 1.24.21", /missing a ; at the end/.test(cb.why || ""), cb.why);
  // (the review, tests/fixtures/review1_1262.json) which first lines are a language line, and which are code
  function lang(lines) { var q = L.aiCode.parse({ raw: lines }); return [q.lang, q.text.split("\n")[0]]; }
  var LC = [
    [["Arduino (C++)", "void setup() {", "}"], "arduino", "void setup() {"], [["Python3", "import time"], "python", "import time"],
    [["Structured-Text", "PROGRAM Main", "END_PROGRAM"], "st", "PROGRAM Main"], [["JavaScript:", "function add(a, b) { return a + b; }"], "javascript", "function add(a, b) { return a + b; }"],
    [["ST:", "PROGRAM Main", "END_PROGRAM"], "st", "PROGRAM Main"], [["ino", "void setup() {", "}"], "arduino", "void setup() {"],
    [["javascript:", "for (var i = 0; i < 3; i++) {", "  if (i === 1) break javascript;", "}"], "", "javascript:"],
    [["st = 5", "print(st)"], "", "st = 5"], [["LD", "X0"], "", "LD"], [["arduino"], "", "arduino"], [["python print(1)", "x = 2"], "", "python print(1)"]];
  LC.forEach(function (c) { var g = lang(c[0]); ok("first line " + JSON.stringify(c[0][0]) + ": " + (c[1] ? "the language line, " + c[1] : "code, kept"), (!c[1] || g[0] === c[1]) && g[1] === c[2], g); });
  var RV = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1262.json"), "utf8"));
  ok("the review's rule 2 cases are kept with the fixture", (RV.rule2 || []).length > 100, (RV.rule2 || []).length);
  // the rows that passed, in both runs: none questioned now
  var bad = [];
  [FA, FB].forEach(function (F) {
    F.rows.filter(function (x) { return x.pass; }).forEach(function (x) {
      var t = String(x.reply || ""), cb2 = block(t, "CODE");
      if (cb2) { var bb = L.aiCode.build({ title: "T", raw: cb2.split("\n") }, { question: x.q }); if (bb.problems.length) bad.push([x.id, bb.problems]); }
      if (/^=/.test(t)) { var p = A.parseReply(t), rr = A.run(p.exprText); if (L.aiChecks.otherBodyCall(p.exprText, x.q)) bad.push([x.id, "other body"]); }
    });
  });
  ok("the rows that passed in both runs: none questioned", !bad.length, bad);
  console.log(fails ? fails + " BENCH 1.24.22 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.22 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
}, 300);
