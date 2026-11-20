// replay.js -- the second reviewer's MAKE SHEET cases for 1.24.29, replayed: each reply (cases.json, made by
// make_cases.js) is built as Lantern builds a model's reply (Lantern.aiAct.build(reply, question)), and judged by what
// the model meant:
//   back: false   -- a right reply: nothing goes back to the model, and every cell in want shows what the model meant
//   back: true    -- a wrong reply: it goes back, and the message says msg (a regular expression)
//   back: "either" -- it may go back; if it stays, its cells must show what the model meant
// and, where a bench question is named, Lantern.aiBench.grade passes it. formula: the formula a cell must hold; said: what
// Lantern must say it read.
// Prints AGREE <id> or DISAGREE <id> <detail> [harm], then "<n> cases: <a> AGREE, <d> DISAGREE".
// Usage: node tests/fixtures/makesheet2_1269/replay.js [inner.html]
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..", "..", "..");
var JSDOM = require(path.join(ROOT, "node_modules", "jsdom")).JSDOM, VirtualConsole = require(path.join(ROOT, "node_modules", "jsdom")).VirtualConsole;
var inner = fs.readFileSync(process.argv[2] || path.join(ROOT, "src", "lantern.inner.html"), "utf8");
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
function same(got, want) {
  if (typeof want === "number") return typeof got === "number" && Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
  return got === want;
}
function show(v) { return typeof v === "number" ? String(Number(v.toPrecision(12))) : JSON.stringify(v); }
var o = load(), L = o.L;
setTimeout(function () {
  var cases = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8")), a = 0, d = 0;
  cases.forEach(function (c) {
    var bad = [], harm = "", made, m;
    try { made = L.aiAct.build(c.reply, c.q); } catch (e) { made = null; bad.push("build fails: " + e.message); }
    m = made && made.plan === undefined && made[0] ? made[0] : made;
    if (!m || !m.plan) { if (!bad.length) bad.push("nothing was made of it" + (m && m.problems ? " (" + m.problems.join("; ").slice(0, 200) + ")" : "")); harm = "the sheet is lost"; }
    else {
      var probs = m.problems || [], back = probs.length > 0, vals = m.plan.values || {}, cells = m.plan.cells || {};
      var wrong = Object.keys(c.want || {}).filter(function (k) { return !same(vals[k], c.want[k]); });
      var wrongText = wrong.map(function (k) { return k + " " + show(vals[k]) + " (" + (cells[k] || "") + ") for " + show(c.want[k]); }).join(", ");
      if (c.back === false) {
        if (back) { bad.push("goes back: " + probs.join(" / ").slice(0, 300)); harm = "a right sheet goes back to the model"; }
        if (wrong.length) { bad.push("shows " + wrongText); if (!back) harm = "wrong numbers shown"; }
      } else if (c.back === true) {
        if (!back) { bad.push("accepted" + (wrong.length ? ", showing " + wrongText : "") + " (cells " + JSON.stringify(cells).slice(0, 200) + ")"); harm = "a wrong sheet is accepted"; }
        else if (c.msg && !probs.some(function (p) { return new RegExp(c.msg).test(p); })) bad.push("goes back, but without " + c.msg + ": " + probs.join(" / ").slice(0, 300));
      } else if (!back && wrong.length) { bad.push("accepted, showing " + wrongText); harm = "wrong numbers shown"; }
      Object.keys(c.formula || {}).forEach(function (k) { if (!back && cells[k] !== c.formula[k]) bad.push(k + " holds " + JSON.stringify(cells[k]) + ", not " + c.formula[k]); });
      if (c.said && !back && !new RegExp(c.said).test(m.summary || "")) bad.push("does not say " + c.said + " (" + (m.summary || "").slice(0, 160) + ")");
      if (c.bench && c.back === false) {
        var item = L.aiBenchQuestions.filter(function (q) { return q.id === c.bench; })[0], g;
        try { g = L.aiBench.grade(item, c.reply, { made: made }); } catch (e) { g = { pass: false, why: "grade fails: " + e.message }; }
        if (!g.pass) { bad.push("the bench fails it: " + g.why); harm = harm || "a right reply fails the bench"; }
      }
    }
    if (!bad.length) { a++; console.log("AGREE " + c.id); }
    else { d++; console.log("DISAGREE " + c.id + " " + bad.join("; ") + (harm ? " [" + harm + "]" : "")); }
  });
  if (o.errs.length) console.log("(page errors: " + o.errs.slice(0, 3).join(" | ") + ")");
  console.log(cases.length + " cases: " + a + " AGREE, " + d + " DISAGREE");
}, 80);
