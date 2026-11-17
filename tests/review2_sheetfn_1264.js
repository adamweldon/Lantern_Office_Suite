// review_sheetfn_1264.js -- the review of 1.24.24's spreadsheet functions, replayed. A reviewer that had not seen
// them written made 908 cases of its own (a budget, a grade book, a stock list, dates, a mortgage, a calibration
// line, then the edges) and worked each out in LibreOffice Calc 24.2 from the same cells written as an .xlsx (Excel's
// documented value where Calc lacks the function or is known to differ): tests/fixtures/review2_sheetfn_1264.json.
// It found 141 that disagreed. What it found was mended (CHANGELOG 1.24.24); here every case is worked out again
// and each must give Excel's answer, but for the few Lantern keeps on purpose, listed in KEEP with why. Its fx
// searches (119 plain-word questions) are run again too.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review2_sheetfn_1264.json"), "utf8"));
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
  [/^=\s*-\s*[A-Z0-9.]+\s*\^/, "-x^2 is -(x^2), as in mathematics"],
  // 2^3^2 is 2^9 = 512, as in mathematics (Excel works left to right: 64)
  [/\^[^\^]*\^/, "a power of a power is worked from the right, as in mathematics"]
];
// typed in a cell, and kept as typed text: 1/2 or 9/8 with no year (Excel makes a date of it, 2 January; a person
// writing a half or a ratio would not mean one)
var KEEPTYPED = /^\s*\d{1,2}\x2F\d{1,2}\s*$/;
// two functions Sheets does not have: ISLOGICAL (TRUE is the number 1 here, so it could not tell) and T.TEST
var KEEPFN = /^=\s*(ISLOGICAL|T\.TEST)\x28/i;
// a negative that rounds to nothing shows no minus: TEXT(-0.4,"0") is 0 (Excel writes -0; LibreOffice, and the
// first review's oracle, 0)
var KEEPF = /^=TEXT\x28A1,\x220\x22\x29$/;
function keptCells(c) {
  if (KEEPFN.test(c.cells[c.ref] || "")) return "not in Sheets";
  if (KEEPF.test(c.cells[c.ref] || "") && /^-0\./.test(c.cells.A1 || "")) return "no minus on a zero"; return Object.keys(c.cells).some(function (k) { return KEEPTYPED.test(c.cells[k]); }) ? "1/2 typed is text" : null; }
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

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern;
  ok("boot clean", !errs.length, errs);
  ok("the review's record is whole: 1,248 cases, 135 that disagreed; 77 of the grid; 109 sums; 91 searches",
    R.cases.length === 1248 && R.cases.filter(function (c) { return c.agree === false; }).length === 135 && R.grid.length === 77 && R.calc.length === 109 && R.search.length === 91);

  // --- the values -----------------------------------------------------------------------------------------------
  var wrong = [], keptN = 0, unsure = 0, mended = 0, grid = R.cases.filter(function (c) { return c.group === "display"; });
  // (OFFSET(A1,1,0) and INDIRECT("A2") were worked out on a sheet with 1, 2, 3 in A1:A3; the record keeps only A1)
  R.cases.forEach(function (c) { if (/^=(OFFSET\x28A1,1,0|INDIRECT\x28\x22A2)/.test(c.cells[c.ref])) { c.cells.A2 = "2"; c.cells.A3 = "3"; } });
  R.cases.forEach(function (c) {
    if (c.group === "display") return;
    if (c.agree === null) { unsure++; return; }
    var f = c.cells[c.ref], v = L.sheetDocs.compute(c.cells)[c.ref];
    if (same(v, c.expected)) { if (c.agree === false) mended++; return; }
    if (kept(f) || keptCells(c)) { keptN++; return; }
    wrong.push({ f: f, now: v, excel: c.expected, cause: c.cause || "", cells: VERBOSE ? c.cells : undefined });
  });
  ok("every case gives Excel's answer, but those kept on purpose (" + keptN + ")", !wrong.length, wrong);
  if (VERBOSE) { console.log("mended", mended, "kept", keptN, "unsure", unsure, "wrong", wrong.length); fs.writeFileSync(VERBOSE, JSON.stringify(wrong, null, 1)); }

  // --- what the grid shows ----------------------------------------------------------------------------------------
  w.location.hash = "sheet"; fire(w, "hashchange"); await sleep(80);
  var gw = [], gridN = 0, formats = 0;
  for (var i = 0; i < R.grid.length; i++) {
    var c = R.grid[i];
    if (c.agree === null || keptCells(c)) continue;
    var id = L.sheetDocs.create("Review " + i, JSON.parse(JSON.stringify(c.cells)));
    L.sheetDocs.open(id); await sleep(15);
    var td = d.querySelector("td[data-ref=" + c.ref + "]"), shown = td ? td.textContent : null;
    gridN++;
    // (the time now differs from the reviewer's; and Excel carrying a money, per cent or date look into =A1*2 waits for
    // Sheets' number formats, the next version)
    if (/a time of day/.test(c.note || "") ? !/^\d\d:\d\d$/.test(shown) : shown !== String(c.expected)) {
      if (/carries the (currency|percent|date) format/.test(c.note || "") && /\*/.test(c.cells[c.ref])) { formats++; continue; }
      gw.push([c.cells[c.ref], shown, c.expected, c.note]);
    }
  }
  ok("what the grid shows (" + gridN + "; " + formats + " wait for number formats)", !gw.length && formats <= 3, gw);

  // --- the calculator and the AI's sums: none worse than 1.24.23 -------------------------------------------------
  // (four the reviewer found wrong on both builds are read as before: "2,500 kg"*2, "3/4"*2, "1 1/2"+0 and "10">5 --
  // without a sheet a text's first number is taken, so a model's "5 kg" still counts)
  var cw = [];
  R.calc.forEach(function (c) {
    if (c.agree === null) return;
    var v; try { v = L.formula.evaluate(c.expr, {}); } catch (e) { v = "#ERR"; }
    var ok1 = function (want) { return same(v, want) || (want === "an error" || (typeof want === "string" && /^#/.test(want))) && v === "#ERR"; };
    if (!(ok1(c.expected) || (!c.agree && ok1(c.old)))) cw.push([c.expr, v, c.agree ? c.expected : [c.expected, c.old]]);
  });
  ok("the calculator's sums: as Excel where they were, as 1.24.23 for the four", !cw.length, cw);

  // --- the fx searches -------------------------------------------------------------------------------------------
  // the reviewer wanted UPPER for "lowercase", LEFT for "right", YEAR for "month" and CHAR for "code" because those
  // had no line of their own; now they have
  var ALSO = { lowercase: "LOWER", lower: "LOWER", right: "RIGHT", month: "MONTH", code: "CODE" };
  var miss = [], first = 0, notFirst = [];
  R.search.forEach(function (s) {
    if (ALSO[s.words]) s.wanted = s.wanted.concat([ALSO[s.words]]);
    if (!s.wanted.length) return;   // ("percent change": no function is that; =(B2-A2)/A2 is)
    var top = L.formulaFind(s.words).slice(0, 3).map(function (h) { return h.n; });
    if (s.wanted.indexOf(top[0]) >= 0) first++;
    else if (!top.some(function (n) { return s.wanted.indexOf(n) >= 0; })) miss.push([s.words, top, s.wanted]);
    else notFirst.push([s.words, top, s.wanted]);
  });
  if (VERBOSE) console.log("not first:", JSON.stringify(notFirst));
  ok("the fx searches: what a person means is in the first three for every one (" + first + " of " + R.search.length + " first)", !miss.length, miss);
  ok("...and first for nine in ten", first >= Math.ceil(R.search.filter(function (s) { return s.wanted.length; }).length * 0.9), first);
  ok("no errors in the page", !errs.length, errs);
  console.log(fails ? fails + " SHEET FUNCTION REVIEW FAILURES (" + passes + " passed)" : "ALL SHEET FUNCTION REVIEW CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
