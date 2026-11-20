// replay.js -- the second Excel reviewer's cases for 1.24.29 (CONVERT and the mended functions), replayed.
// Each case in cases.json (made by make_cases.js) is tried three ways:
//   Chat:  Lantern.formula.evaluate(f, {})                       (skipped for cases whose formula reads cells)
//   sheet: Lantern.sheetDocs.compute({...cells, H9: "=" + f}).H9
//   save:  Lantern.xlsx.write({title, cells}, values) -- the cell H9 read back as Excel would read it: a formula is
//          worked out by this reviewer's own Excel reader (excel_convert.js for CONVERT), a value is its value
// and with --lo the saved file is also opened and recalculated in LibreOffice (lo_recalc.py; LibreOffice keeps old
// figures for lbm, psi, admkn, MTON and flb, so it is compared to 1e-6).
// Prints AGREE <id> or DISAGREE <id> <detail> [harm], then "<n> cases: <a> AGREE, <d> DISAGREE".
// Usage: node tests/fixtures/excelnames2_1269/replay.js [--lo] [inner.html]
"use strict";
var fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
var ROOT = path.join(__dirname, "..", "..", "..");
var JSDOM = require(path.join(ROOT, "node_modules", "jsdom")).JSDOM, VirtualConsole = require(path.join(ROOT, "node_modules", "jsdom")).VirtualConsole;
var XL = require("./excel_convert.js");
var args = process.argv.slice(2), LO = args.indexOf("--lo") >= 0, innerPath = args.filter(function (a) { return !/^--/.test(a); })[0];
var inner = fs.readFileSync(innerPath || path.join(ROOT, "src", "lantern.inner.html"), "utf8");
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
var TARGET = "H9";
function isErr(v) { return typeof v === "string" && /^#(N\/A|VALUE!|NUM!|REF!|NAME\?|DIV\/0!|NULL!)$/.test(v); }
function same(got, want, tol) {
  if (typeof want === "number") return typeof got === "number" && isFinite(got) && Math.abs(got - want) <= (tol || 1e-11) * Math.max(1, Math.abs(want));
  return got === want;
}
function show(v) { return typeof v === "number" ? String(Number(v.toPrecision(15))) : JSON.stringify(v); }

// ---- a small Excel reader for the saved formulas: numbers, "text", TRUE/FALSE, A1 and A1:B2, {1,2} constants, + - * / ^
// & and comparisons, and the functions the cases use. CONVERT is excel_convert.js.
function xlEval(f, cells) {
  var s = f, i = 0;
  function ws() { while (s[i] === " ") i++; }
  function cellVal(ref) { var v = cells[ref.replace(/\$/g, "").toUpperCase()]; return v === undefined ? null : v; }
  function range(a, b) {
    a = a.replace(/\$/g, "").toUpperCase(); b = b.replace(/\$/g, "").toUpperCase();
    var ca = a.charCodeAt(0), cb = b.charCodeAt(0), ra = +a.slice(1), rb = +b.slice(1), out = [];
    for (var r = Math.min(ra, rb); r <= Math.max(ra, rb); r++) for (var c = Math.min(ca, cb); c <= Math.max(ca, cb); c++) out.push(cellVal(String.fromCharCode(c) + r));
    return { arr: out };
  }
  function num(v) {
    if (v && v.err) throw v;
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "string" && v !== "" && !isNaN(+v)) return +v;
    throw { err: "#VALUE!" };
  }
  function flat(v) { return v && v.arr ? v.arr : [v]; }
  function nums(list) { var o = []; list.forEach(function (v) { flat(v).forEach(function (x) { if (x && x.err) throw x; if (typeof x === "number") o.push(x); }); }); return o; }
  var FN = {
    CONVERT: function (a) {
      var v = a[0];
      if (v === null) v = 0;
      if (typeof v === "boolean" || (typeof v === "string" && (v === "" || isNaN(+v)))) throw { err: "#VALUE!" };
      var r = XL.excel(num(v), String(a[1]), String(a[2]));
      if (typeof r === "string") throw { err: r };
      return r;
    },
    ROUND: function (a) { var m = Math.pow(10, num(a[1])), x = num(a[0]); return Math.sign(x) * Math.round(Math.abs(x) * m + 1e-9) / m; },
    IF: function (a) { return num(a[0]) ? a[1] : (a.length > 2 ? a[2] : false); },
    SUM: function (a) { return nums(a).reduce(function (p, q) { return p + q; }, 0); },
    AVERAGE: function (a) { var n = nums(a); return n.reduce(function (p, q) { return p + q; }, 0) / n.length; },
    MAX: function (a) { return Math.max.apply(null, nums(a)); },
    INDEX: function (a) { var l = flat(a[0]); return l[num(a[1]) - 1]; },
    FREQUENCY: function (a) {
      var d = nums([a[0]]), b = nums([a[1]]).slice().sort(function (p, q) { return p - q; }), out = b.map(function () { return 0; }).concat([0]);
      d.forEach(function (x) { var k = 0; while (k < b.length && x > b[k]) k++; out[k]++; });
      return { arr: out };
    }
  };
  function primary() {
    ws();
    var c = s[i], m;
    if (c === "(") { i++; var v = expr(); ws(); i++; return v; }
    if (c === "-") { i++; return -num(primary()); }
    if (c === "+") { i++; return primary(); }
    if (c === "\x22") { var j = i + 1, t = ""; while (j < s.length) { if (s[j] === "\x22") { if (s[j + 1] === "\x22") { t += "\x22"; j += 2; continue; } break; } t += s[j++]; } i = j + 1; return t; }
    if (c === "{") { i++; var arr = []; while (s[i] !== "}") { if (s[i] === "," || s[i] === ";") { i++; continue; } arr.push(primary()); ws(); } i++; return { arr: arr }; }
    if ((m = /^\d+(\.\d+)?([eE][-+]?\d+)?/.exec(s.slice(i)))) { i += m[0].length; return +m[0]; }
    if ((m = /^(TRUE|FALSE)(?![A-Za-z0-9_.(])/i.exec(s.slice(i)))) { i += m[0].length; return m[1].toUpperCase() === "TRUE"; }
    if ((m = /^(\$?[A-Z]{1,2}\$?\d+)(:(\$?[A-Z]{1,2}\$?\d+))?(?![A-Za-z0-9_(])/i.exec(s.slice(i)))) { i += m[0].length; return m[3] ? range(m[1], m[3]) : cellVal(m[1]); }
    if ((m = /^(_xlfn\.)?([A-Z][A-Z0-9.]*)\s*\(/i.exec(s.slice(i)))) {
      i += m[0].length;
      var name = m[2].toUpperCase(), a = [];
      ws();
      if (s[i] === ")") { i++; } else {
        for (;;) { ws(); if (s[i] === "," || s[i] === ")") a.push(null); else a.push(expr()); ws(); if (s[i] === ",") { i++; continue; } i++; break; }
      }
      if (!FN[name]) throw { err: "?" + name };
      return FN[name](a);
    }
    throw { err: "?parse at " + i + " in " + s };
  }
  function pow() { var v = primary(); ws(); while (s[i] === "^") { i++; v = Math.pow(num(v), num(primary())); ws(); } return v; }
  function mul() { var v = pow(); ws(); while (s[i] === "*" || s[i] === "/") { var o = s[i++]; var w = pow(); v = o === "*" ? num(v) * num(w) : num(v) / num(w); ws(); } return v; }
  function add() { var v = mul(); ws(); while (s[i] === "+" || s[i] === "-") { var o = s[i++]; var w = mul(); v = o === "+" ? num(v) + num(w) : num(v) - num(w); ws(); } return v; }
  function cat() { var v = add(); ws(); while (s[i] === "&") { i++; var w = add(); v = String(v === null ? "" : v) + String(w === null ? "" : w); ws(); } return v; }
  function expr() {
    var v = cat(); ws();
    var m = /^(<=|>=|<>|<|>|=)/.exec(s.slice(i));
    if (m) { i += m[0].length; var w = cat(), x = num(v), y = num(w); v = m[1] === "<" ? x < y : m[1] === ">" ? x > y : m[1] === "<=" ? x <= y : m[1] === ">=" ? x >= y : m[1] === "=" ? x === y : x !== y; }
    return v;
  }
  try { var r = expr(); if (r && r.arr) r = r.arr[0]; return r; } catch (e) { if (e && e.err) return e.err.charAt(0) === "?" ? { cannot: e.err.slice(1) } : e.err; throw e; }
}
function unxml(t) { return t.replace(/&quot;/g, "\x22").replace(/&apos;/g, "\x27").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }
// the saved cell: {f, v, t} and the saved values of the other cells (for the Excel reader)
function savedCells(xml, sst) {
  var strs = [], sm, sre = /<si>([\s\S]*?)<\/si>/g;
  while (sst && (sm = sre.exec(sst))) strs.push(unxml((sm[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(function (t) { return t.replace(/<[^>]+>/g, ""); }).join("")));
  var out = {}, re = /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
  while ((m = re.exec(xml))) {
    var body = m[3] || "", t = /t="([^"]+)"/.exec(m[2]), f = /<f[^>]*>([\s\S]*?)<\/f>/.exec(body), v = /<v>([\s\S]*?)<\/v>/.exec(body), is = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
    var type = t ? t[1] : "n", val = is ? unxml(is[1]) : v ? unxml(v[1]) : null;
    if (type === "n" && val !== null) val = +val;
    if (type === "s" && val !== null) val = strs[+val];
    if (type === "b") val = val === "1";
    out[m[1]] = { f: f ? unxml(f[1]) : null, v: val, t: type };
  }
  return out;
}

var o = load(), L = o.L;
setTimeout(function () {
  var cases = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));
  var results = [], loDir = LO ? fs.mkdtempSync(path.join(os.tmpdir(), "excelnames2_")) : null;
  cases.forEach(function (c) {
    var bad = [], harm = "", want = c.expect, tol = c.tol;
    // Chat
    if (c.chat !== false) {
      var got;
      try { got = L.formula.evaluate(c.f, {}); } catch (e) { got = { threw: String(e && e.message || e) }; }
      if (isErr(want)) { if (!(got && got.threw) && !(typeof got === "string" && got === want)) { bad.push("Chat gives " + show(got) + " where Excel gives " + want); harm = harm || "a number where Excel has none"; } }
      else if (got && got.threw) bad.push("Chat cannot (" + got.threw.slice(0, 120) + ") where the answer is " + show(want));
      else if (!same(got, want, tol)) { bad.push("Chat gives " + show(got) + ", not " + show(want)); harm = "wrong answer in Chat"; }
    }
    // sheet
    var cells = {};
    Object.keys(c.cells || {}).forEach(function (k) { cells[k] = c.cells[k]; });
    cells[TARGET] = "=" + c.f;
    var vals, sv;
    try { vals = L.sheetDocs.compute(cells); sv = vals[TARGET]; } catch (e) { vals = {}; sv = { threw: String(e.message) }; }
    if (!same(sv, want, tol)) { bad.push("the sheet shows " + show(sv) + ", not " + show(want)); if (!harm) harm = typeof want === "number" && typeof sv === "number" ? "wrong number in the sheet" : "the sheet differs from Excel"; }
    // save
    var x, saved, note = "";
    try { x = L.xlsx.write({ title: "Case " + c.id, cells: cells }, vals); } catch (e) { x = null; bad.push("Save .xlsx fails: " + e.message); }
    if (x) {
      var zr = L.zip.read(x.bytes), sst = null;
      try { sst = zr.text("xl/sharedStrings.xml"); } catch (e) { sst = null; }
      var xml = zr.text("xl/worksheets/sheet1.xml"), sc = savedCells(xml, sst), cell = sc[TARGET];
      note = (x.notes || []).filter(function (n) { return n.indexOf(TARGET) >= 0; }).join(" ");
      if (LO) fs.writeFileSync(path.join(loDir, c.id + ".xlsx"), Buffer.from(x.bytes));
      if (!cell) bad.push("Save .xlsx has no cell " + TARGET);
      else {
        var plain = {};
        Object.keys(sc).forEach(function (k) { plain[k] = sc[k].f ? sc[k].v : sc[k].v; });
        // what Excel shows for the saved cell
        var xlv = cell.f ? xlEval(cell.f, plain) : cell.v;
        saved = cell.f ? "=" + cell.f : "value " + show(cell.v);
        if (c.save === "formula" && !cell.f) { bad.push("saved as its value (" + show(cell.v) + "), not as a formula Excel can read" + (note ? " (note: " + note.slice(0, 160) + ")" : " and no note says so")); harm = harm || "the formula is lost in Excel"; }
        if (c.save === "value" && cell.f && !(xlv && xlv.cannot) && !same(xlv, want, tol)) { bad.push("saved as " + saved + ", which Excel works out to " + show(xlv) + ", not " + show(want)); harm = "Excel shows " + show(xlv) + " where Lantern showed " + show(want); }
        if (c.save === "value" && !cell.f && !note) bad.push("saved as its value with no note naming " + TARGET);
        if (c.saveAs && cell.f && cell.f.replace(/_xlfn\./g, "").replace(/\s+/g, "") !== c.saveAs.replace(/\s+/g, "")) bad.push("saved as " + saved + ", not =" + c.saveAs);
        if (c.save === "own") { if (!note) bad.push("no note says Excel lacks the function in " + TARGET); }
        else if (c.save === "value" && cell.f && xlv && xlv.cannot) { bad.push("kept as the formula " + saved + ", which Excel does not have (it would show #NAME?)"); harm = "Excel shows #NAME?"; }
        else if (cell.f && xlv && xlv.cannot) {
          // a function this reader does not work out: the formula must be the one entered (an Excel function), and its
          // cached value the answer
          var fx = cell.f.replace(/_xlfn\./g, "").replace(/\s+/g, ""), want2 = (c.saveAs || c.f).replace(/\s+/g, "");
          if (fx.toUpperCase() !== want2.toUpperCase()) bad.push("saved as " + saved + ", not =" + (c.saveAs || c.f));
          if (!same(cell.v, want, tol) && !(isErr(want) && cell.t === "e")) bad.push("the saved value is " + show(cell.v) + ", not " + show(want));
        } else if (cell.f && (c.save === "formula" || c.save === "any") && !same(xlv, want, tol)) {
          bad.push("saved as " + saved + ", which Excel works out to " + show(xlv) + ", not " + show(want));
          harm = "Excel shows " + show(xlv) + " where Lantern showed " + show(sv);
        }
      }
    }
    results.push({ c: c, bad: bad, harm: harm, saved: saved });
  });
  function finish(loRes) {
    var a = 0, d = 0, notes = [], loChecked = 0, loName = 0;
    results.forEach(function (r) {
      var c = r.c, bad = r.bad.slice(), harm = r.harm;
      if (loRes && loRes[c.id] !== undefined) {
        var lv = loRes[c.id], want = c.expect, off;
        off = typeof want === "number" ? !(typeof lv === "number" && Math.abs(lv - want) <= 1e-6 * Math.max(1, Math.abs(want))) : isErr(want) ? !(lv && lv.err) : lv !== want;
        if (lv && lv.err === "#NAME?" && !isErr(want)) loName++;   // LibreOffice 24.2 lacks the function (TEXTBEFORE, TEXTAFTER): not checked there
        else if (off && c.loKnown) notes.push("LO-NOTE " + c.id + " LibreOffice gives " + JSON.stringify(lv) + " for " + show(want) + ": " + c.loKnown);
        else if (off) {
          loChecked++;
          bad.push("LibreOffice recalculates the saved file to " + JSON.stringify(lv) + ", not " + show(want));
          harm = harm || "the saved file recalculates otherwise";
        } else loChecked++;
      }
      if (!bad.length) { a++; console.log("AGREE " + c.id); }
      else { d++; console.log("DISAGREE " + c.id + " " + c.f + ": " + bad.join("; ") + (harm ? " [" + harm + "]" : "")); }
    });
    notes.forEach(function (n) { console.log(n); });
    if (loRes) console.log("LibreOffice recalculated " + loChecked + " saved files against the expected answer (" + notes.length + " known LibreOffice differences, " + loName + " functions LibreOffice 24.2 lacks)");
    if (o.errs.length) console.log("(page errors: " + o.errs.slice(0, 3).join(" | ") + ")");
    console.log(results.length + " cases: " + a + " AGREE, " + d + " DISAGREE");
  }
  if (!LO) return finish(null);
  var out = cp.execFileSync("python3", [path.join(__dirname, "lo_recalc.py"), loDir, TARGET], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 600000 });
  finish(JSON.parse(out.split("\n").filter(function (l) { return /^\{/.test(l); }).pop()));
}, 80);
