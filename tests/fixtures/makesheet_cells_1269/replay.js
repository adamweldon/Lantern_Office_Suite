// replay.js -- MAKE SHEET with bracketed cell names ([B2], [b2], [$B$2], [B2:B4]), draft 1.24.29, tried by a
// reviewer who did not write the rule. Each case in cases.json is a model's reply, the question, what the model
// meant, and what Lantern should make of it ("made": the formulas and values meant; "sentBack": nothing can be
// known, so it goes back; "any": either of the outcomes listed). Expectations were set before the cases were run.
// Usage: node tests/fixtures/makesheet_cells_1269/replay.js [inner.html] [--show]
// Prints AGREE <id> / DISAGREE <id> <detail> [harm] per case, then "<n> cases: <a> AGREE, <d> DISAGREE".
// Harm: a wrong number handed over without a word is high; a right reply sent back costs the model a round (the
// case's own harm says how much it matters there); a wrong or missing message alone is low.
"use strict";
var fs = require("fs"), path = require("path");
var args = process.argv.slice(2), show = args.indexOf("--show") >= 0, only = null;
args = args.filter(function (a) { if (/^--only=/.test(a)) { only = a.slice(7).split(","); return false; } return a !== "--show"; });
var innerPath = args[0] || process.env.LANTERN_INNER || path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html");
var jsdom = require("jsdom"), JSDOM = jsdom.JSDOM, VirtualConsole = jsdom.VirtualConsole;
var DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));

function load() {
  var inner = fs.readFileSync(innerPath, "utf8");
  var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
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

// a formula compared without spaces, and in capitals outside quotes
function norm(f) {
  var out = "", q = false, s = String(f == null ? "" : f);
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === "\x22") { q = !q; out += ch; continue; }
    if (q) { out += ch; continue; }
    if (/\s/.test(ch)) continue;
    out += ch.toUpperCase();
  }
  return out;
}
function sameValue(a, b) {
  if (typeof b === "number") { var n = typeof a === "number" ? a : (a !== "" && a != null && !isNaN(Number(a)) ? Number(a) : NaN); return Math.abs(n - b) <= 1e-9 * Math.max(1, Math.abs(b)); }
  return String(a == null ? "" : a) === String(b);
}
var RANK = { low: 1, medium: 2, high: 3 };
function worst(a, b) { return (RANK[a] || 0) >= (RANK[b] || 0) ? a : b; }

function outcome(made) {
  var p = made && made.plan || {}, f = [];
  Object.keys(p.cells || {}).forEach(function (k) { if (/^=/.test(String(p.cells[k]))) f.push(k + " " + p.cells[k] + " -> " + JSON.stringify(p.values ? p.values[k] : undefined)); });
  return f.join("; ");
}

// one expectation against what Lantern made; returns { ok, detail, harm }
function judgeOne(c, e, made, graded) {
  var probs = (made && made.problems) || [], plan = (made && made.plan) || {}, cells = plan.cells || {}, vals = plan.values || {};
  var saidText = (plan.said || []).join(" | ") + " | " + (made && made.summary || "");
  var bad = [], harm = null;
  function fail(msg, h) { bad.push(msg); harm = worst(harm, h); }
  if (e.kind === "made") {
    if (probs.length) return { ok: false, detail: "sent back: " + probs.slice(0, 2).join(" / "), harm: c.harmBack || c.harm };
    var vbad = [], fbad = [];
    Object.keys(e.values || {}).forEach(function (k) { if (!sameValue(vals[k], e.values[k])) vbad.push(k + "=" + JSON.stringify(vals[k]) + " (meant " + JSON.stringify(e.values[k]) + ", formula " + cells[k] + ")"); });
    Object.keys(e.formulas || {}).forEach(function (k) { if (norm(cells[k]) !== norm(e.formulas[k])) fbad.push(k + " " + cells[k] + " (meant " + e.formulas[k] + ")"); });
    if (vbad.length) fail("made without a word, wrong values: " + vbad.join(", "), "high");
    if (fbad.length) fail("formula: " + fbad.join(", "), vbad.length ? "high" : "low");
    Object.keys(e.texts || {}).forEach(function (k) { if (cells[k] !== e.texts[k]) fail("text " + k + " " + JSON.stringify(cells[k]) + " (meant " + JSON.stringify(e.texts[k]) + ")", "low"); });
  } else if (e.kind === "sentBack") {
    if (!probs.length) return { ok: false, detail: "made without a word: " + outcome(made) + (plan.said && plan.said.length ? " (said: " + plan.said.slice(0, 2).join("; ") + ")" : ""), harm: c.harm };
    var pt = probs.join(" / ");
    (e.problemHas || []).forEach(function (s) { if (pt.indexOf(s) < 0) fail("sent back, but the message does not name " + s + ": " + probs.slice(0, 2).join(" / "), "low"); });
    (e.clear || []).forEach(function (s) { if (pt.indexOf(s) < 0) fail("sent back, but the message does not say it is about a " + s + ": " + probs.slice(0, 2).join(" / "), "low"); });
  }
  (e.said || []).forEach(function (s) { if (saidText.indexOf(s) < 0) fail("not said: " + JSON.stringify(s) + " (said: " + JSON.stringify(plan.said || []) + ")", "low"); });
  (e.notSaid || []).forEach(function (s) { if (saidText.indexOf(s) >= 0) fail("said " + JSON.stringify(s) + ": " + JSON.stringify(plan.said || []), "low"); });
  if (e.grade !== undefined && graded && graded.pass !== e.grade) fail("bench grade " + (graded.pass ? "passes" : "fails (" + graded.why + ")") + ", meant " + (e.grade ? "a pass" : "a fail"), "medium");
  return bad.length ? { ok: false, detail: bad.join("; "), harm: harm } : { ok: true };
}

function judge(c, made, graded) {
  var e = c.expect;
  if (e.kind !== "any") return judgeOne(c, e, made, graded);
  var rs = e.any.map(function (alt) { return judgeOne(c, alt, made, graded); });
  for (var i = 0; i < rs.length; i++) if (rs[i].ok) return rs[i];
  var back = (made && made.problems && made.problems.length) ? "sentBack" : "made";
  for (i = 0; i < rs.length; i++) if (e.any[i].kind === back) return rs[i];
  return rs[0];
}

(function () {
  var o = load(), L = o.L;
  setTimeout(function () {
    if (o.errs.length) console.log("BOOT ERRORS " + JSON.stringify(o.errs));
    var item = (L.aiBenchQuestions || []).filter(function (q) { return q.id === "make-shopping"; })[0];
    var agree = 0, dis = 0, byHarm = { high: 0, medium: 0, low: 0 };
    var cases = only ? DATA.cases.filter(function (c) { return only.indexOf(c.id) >= 0; }) : DATA.cases;
    cases.forEach(function (c) {
      var made, graded = null, r;
      try {
        made = L.aiAct.build(c.reply, c.q);
        if (c.expect.grade !== undefined || (c.expect.any && c.expect.any.some(function (a) { return a.grade !== undefined; }))) graded = L.aiBench.grade(item, c.reply, { made: L.aiAct.build(c.reply, item.q) });
        r = judge(c, made, graded);
      } catch (err) { r = { ok: false, detail: "threw: " + String(err && err.message || err).slice(0, 200), harm: "high" }; }
      if (r.ok) { agree++; console.log("AGREE " + c.id); }
      else { dis++; byHarm[r.harm] = (byHarm[r.harm] || 0) + 1; console.log("DISAGREE " + c.id + " " + r.detail + " [" + r.harm + "]"); }
      if (show) {
        console.log("    problems: " + JSON.stringify((made && made.problems) || []));
        console.log("    said: " + JSON.stringify((made && made.plan && made.plan.said) || []));
        console.log("    formulas: " + outcome(made));
      }
    });
    console.log("(disagreements by harm: high " + byHarm.high + ", medium " + byHarm.medium + ", low " + byHarm.low + "; Lantern " + L.version + " from " + innerPath + ")");
    console.log(cases.length + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
  }, 80);
})();
