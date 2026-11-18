// review_sheetfn_1264.js -- the review of 1.24.24's spreadsheet functions, replayed. A reviewer that had not seen
// them written made 908 cases of its own (a budget, a grade book, a stock list, dates, a mortgage, a calibration
// line, then the edges) and worked each out in LibreOffice Calc 24.2 from the same cells written as an .xlsx (Excel's
// documented value where Calc lacks the function or is known to differ): tests/fixtures/review_sheetfn_1264.json.
// It found 141 that disagreed. What it found was mended (CHANGELOG 1.24.24); here every case is worked out again
// and each must give Excel's answer, but for the few Lantern keeps on purpose, listed in KEEP with why. Its fx
// searches (119 plain-word questions) are run again too.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review_sheetfn_1264.json"), "utf8"));
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0, VERBOSE = process.env.VERBOSE;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 3000)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }

// What Lantern keeps on purpose (the formula in the case's own cell, and why)
var KEEP = [
  // arrays: Sheets has no array arithmetic (a range times a range, {1,2,3}); it says so with an error, never a wrong number
  [/\{|\b[A-Z]{1,2}\d+:[A-Z]{1,2}\d+\s*[*\x2F+=<>-]|[*\x2F+=<>-]\s*[A-Z]{1,2}\d+:[A-Z]{1,2}\d+/, "array arithmetic: an error, not a number"],
  // -2^2 is -4 in Lantern, as in mathematics (Excel gives 4); the AI's sums and the calculator use the same engine
  [/^=\s*-\s*[A-Z0-9.]+\s*\^/, "-x^2 is -(x^2), as in mathematics"]
];
function kept(f) { for (var i = 0; i < KEEP.length; i++) if (KEEP[i][0].test(f)) return KEEP[i][1]; return null; }
function same(v, want) {
  if (typeof want === "number") {
    if (typeof v === "string" && /^-?[\d.]+(e[+-]?\d+)?$/i.test(v)) v = +v;
    return typeof v === "number" && Math.abs(v - want) <= Math.max(1e-9 * Math.abs(want), 1e-9);
  }
  if (typeof want === "boolean") return v === (want ? 1 : 0);
  if (want === null || want === "") return v === null || v === "" || v === 0;
  return String(v) === String(want);
}

// the reviews were made on 17 November 2026: TODAY() is that day here, whatever the day the test runs
var RealDate = w.Date, FIXED = RealDate.UTC(2026, 10, 17, 18, 0, 0);
function FixedDate() {
  if (!(this instanceof FixedDate)) return new RealDate(FIXED).toString();
  return arguments.length ? new (Function.prototype.bind.apply(RealDate, [null].concat([].slice.call(arguments))))() : new RealDate(FIXED);
}
FixedDate.UTC = RealDate.UTC; FixedDate.parse = RealDate.parse; FixedDate.now = function () { return FIXED; }; FixedDate.prototype = RealDate.prototype;
w.Date = FixedDate;
(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern;
  ok("boot clean", !errs.length, errs);
  ok("the review's record is whole: 908 cases, 141 that disagreed on 1.24.24 as first written",
    R.cases.length === 908 && R.cases.filter(function (c) { return c.agree === false; }).length === 141);

  // --- the values -----------------------------------------------------------------------------------------------
  var wrong = [], keptN = 0, unsure = 0, mended = 0, grid = R.cases.filter(function (c) { return c.group === "display"; });
  R.cases.forEach(function (c) {
    if (c.group === "display") return;
    if (c.agree === null) { unsure++; return; }
    var f = c.cells[c.ref], v = L.sheetDocs.compute(c.cells)[c.ref];
    if (same(v, c.expected)) { if (c.agree === false) mended++; return; }
    if (kept(f)) { keptN++; return; }
    wrong.push({ f: f, now: v, excel: c.expected, cause: c.cause || "", cells: VERBOSE ? c.cells : undefined });
  });
  ok("every case gives Excel's answer, but those kept on purpose (" + keptN + ")", !wrong.length, wrong);
  if (VERBOSE) { console.log("mended", mended, "kept", keptN, "unsure", unsure, "wrong", wrong.length); fs.writeFileSync(VERBOSE, JSON.stringify(wrong, null, 1)); }

  // --- what the grid shows ----------------------------------------------------------------------------------------
  w.location.hash = "sheet"; fire(w, "hashchange"); await sleep(80);
  var gw = [];
  for (var i = 0; i < grid.length; i++) {
    var c = grid[i], id = L.sheetDocs.create("Review " + i, JSON.parse(JSON.stringify(c.cells)));
    L.sheetDocs.open(id); await sleep(15);
    var td = d.querySelector("td[data-ref=" + c.ref + "]"), shown = td ? td.textContent : null;
    // (two the reviewer described: "14:30 (Excel shows 2:30 PM)", and "a fraction of a day" -- a time of day here)
    var want = /^a fraction of a day$/.test(c.expected) ? /^\d\d:\d\d$/ : new RegExp("^" + String(c.expected).replace(/ \(.*$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$");
    // a test (=TODAY()>A1) the reviewer wrote as 1 with "(TRUE)" beside it: Excel shows TRUE, and so does Lantern from 1.24.25
    if (c.expected === "1" && /\(TRUE\)/.test(c.note || "")) want = /^TRUE$/;
    if (!want.test(shown)) gw.push([c.cells[c.ref], shown, c.expected]);
  }
  ok("what the grid shows: a date as a date, a count of days as a number (" + grid.length + ")", !gw.length, gw);

  // --- the fx searches -------------------------------------------------------------------------------------------
  // the reviewer wanted UPPER for "lowercase", LEFT for "right", YEAR for "month" and CHAR for "code" because those
  // had no line of their own; now they have
  var ALSO = { lowercase: "LOWER", lower: "LOWER", right: "RIGHT", month: "MONTH", code: "CODE", power: "POWER" };   // (POWER is Excel's from 1.24.25)
  var miss = [], first = 0, notFirst = [];
  R.search.forEach(function (s) {
    if (ALSO[s.words]) s.wanted = s.wanted.concat([ALSO[s.words]]);
    if (s.wanted.indexOf("POW") >= 0) s.wanted = s.wanted.concat(["POWER"]);   // the same since 1.24.25
    var top = L.formulaFind(s.words).slice(0, 3).map(function (h) { return h.n; });
    if (s.wanted.indexOf(top[0]) >= 0) first++;
    else if (!top.some(function (n) { return s.wanted.indexOf(n) >= 0; })) miss.push([s.words, top, s.wanted]);
    else notFirst.push([s.words, top, s.wanted]);
  });
  if (VERBOSE) console.log("not first:", JSON.stringify(notFirst));
  ok("the fx searches: what a person means is in the first three for every one (" + first + " of " + R.search.length + " first)", !miss.length, miss);
  ok("...and first for nine in ten", first >= Math.ceil(R.search.length * 0.9), first);
  ok("no errors in the page", !errs.length, errs);
  console.log(fails ? fails + " SHEET FUNCTION REVIEW FAILURES (" + passes + " passed)" : "ALL SHEET FUNCTION REVIEW CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
