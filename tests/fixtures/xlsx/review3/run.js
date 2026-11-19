// run.js -- the third Excel review of Lantern (1.24.28): runs each case of cases.json against Lantern in jsdom and
// records what Lantern does. Nothing here judges; replay.py does, against what Excel does.
//   node run.js <cases.json> <out dir> [inner.html]
// Writes <out dir>/got.json ({id: {...}}) and <out dir>/<id>.xlsx for each case that saves a workbook.
"use strict";
var path = require("path"), fs = require("fs");
var ROOT = path.resolve(__dirname, "..", "..", "..", "..");
var jsdom = require(path.join(ROOT, "node_modules", "jsdom")), JSDOM = jsdom.JSDOM, VirtualConsole = jsdom.VirtualConsole;
var args = process.argv.slice(2);
var CASES = JSON.parse(fs.readFileSync(args[0], "utf8")), OUT = args[1];
var inner = fs.readFileSync(args[2] || path.join(ROOT, "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FILES = path.join(__dirname, "files");
fs.mkdirSync(OUT, { recursive: true });
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 300)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, alerts = [];
w.alert = function (m) { alerts.push(String(m)); }; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.prompt = function () { return null; };
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function key(el, k, o) { o = o || {}; el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl })); }
function mouse(el, type, o) { o = o || {}; el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, shiftKey: !!o.shift, buttons: o.buttons || 0 })); }
function td(ref) { return d.querySelector("td[data-ref=" + ref + "]"); }
function grid() { return d.querySelector(".gridwrap"); }
function bar() { return d.querySelector(".fbar input"); }
function clickCell(ref, o) { var t = td(ref); if (!t) throw new Error("no cell " + ref + " on the grid"); mouse(t, "mousedown", o); mouse(t, "mouseup", o); mouse(t, "click", o); }
function u8(buf) { var a = new w.Uint8Array(buf.length); for (var i = 0; i < buf.length; i++) a[i] = buf[i]; return a; }
function plain(x) { return x === undefined ? null : JSON.parse(JSON.stringify(x)); }
w.eval(js);
fire(d, "DOMContentLoaded");
var L = w.Lantern, X = L.xlsx;
var currentId = null;
function docOf(id) { return L.store.collection("sheet.docs").get(id || currentId); }
async function openDoc(id) { if (d.body.getAttribute("data-app") !== "sheet") { go("sheet"); await sleep(60); } L.sheetDocs.open(id); currentId = id; await sleep(40); }
function shownText(refs) { var o = {}; refs.forEach(function (r) { var t = td(r); o[r] = t ? t.textContent : null; }); return o; }
function cellName(c, r) { var s = "", n = c + 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s + (r + 1); }
function rangeName() { var S = L.sheetEdit; if (!S || !S.range) return null; var R = S.range(); return cellName(R.c0, R.r0) + ":" + cellName(R.c1, R.r1); }
function noteText() { return Array.prototype.map.call(d.querySelectorAll(".lp-xlsx-note"), function (x) { return x.textContent; }).join(" | "); }
async function clickSave(id) {
  var saved = [], real = L.download;
  L.download = function (n, data, type) { saved.push({ name: n, data: data, type: type }); };
  var b = Array.prototype.filter.call(d.querySelectorAll("button"), function (x) { return x.textContent === "Save .xlsx"; })[0];
  if (b) b.click();
  await sleep(30); L.download = real;
  if (!saved.length) return null;
  fs.writeFileSync(path.join(OUT, id + ".xlsx"), Buffer.from(saved[0].data));
  return id + ".xlsx";
}
async function importFile(name) {
  var before = {}; L.sheetDocs.list().forEach(function (x) { before[x.id] = 1; });
  alerts.length = 0;
  Array.prototype.forEach.call(d.querySelectorAll(".lp-xlsx-note"), function (n) { n.parentNode.removeChild(n); });
  if (d.body.getAttribute("data-app") !== "sheet") { go("sheet"); await sleep(60); }
  L.sheetXlsx.open(new w.File([fs.readFileSync(path.join(FILES, name))], name)); await sleep(200);
  var made = L.sheetDocs.list().filter(function (x) { return !before[x.id]; }).map(function (x) { return docOf(x.id); });
  return { made: made, note: noteText(), alerts: alerts.slice() };
}
function splitRef(r) { var i = r.lastIndexOf("!"); return i < 0 ? { sheet: null, ref: r } : { sheet: r.slice(0, i), ref: r.slice(i + 1) }; }
function val(v) { return v === undefined ? null : v; }

var RUN = {
  // a sheet's cells worked out (one sheet, or one sheet of a workbook: input.book {name: cells}, input.self)
  compute: async function (c) {
    var inp = c.input, want = Object.keys((c.expected && c.expected.values) || {}), g = { values: {} }, look = Object.keys(Object.assign({}, (c.expected && c.expected.values) || {}, (c.expected && c.expected.shown) || {}));
    var v = inp.book ? L.sheetDocs.compute(plain(inp.book[inp.self]), plain(inp.book), inp.self) : L.sheetDocs.compute(plain(inp.cells));
    want.forEach(function (r) { g.values[r] = val(v[r]); });
    if (inp.grid) {   // what the grid shows for these cells
      var id = L.sheetDocs.create(c.id, plain(inp.cells), {});
      await openDoc(id);
      g.shown = shownText(look);
    }
    return g;
  },
  // an Excel file read: each named cell's formula as Lantern holds it, and its value
  read: async function (c) {
    var buf = fs.readFileSync(path.join(FILES, c.input.file)), r, g = { raw: {}, values: {}, arrays: {} };
    try { r = X.read(u8(buf), c.input.file); } catch (e) { return { error: e.message }; }
    g.notes = plain(r.notes);
    var book = {}; r.sheets.forEach(function (s) { book[s.name] = s.cells; });
    var vals = {}; r.sheets.forEach(function (s) { vals[s.name] = L.sheetDocs.compute(s.cells, book, s.name); });
    Object.keys(c.expected.cells || {}).forEach(function (k) {
      var p = splitRef(k), s = p.sheet ? r.sheets.filter(function (x) { return x.name === p.sheet; })[0] : r.sheets[0];
      if (!s) { g.raw[k] = "NO SHEET"; return; }
      g.raw[k] = s.cells[p.ref] == null ? null : s.cells[p.ref];
      g.values[k] = val(vals[s.name][p.ref]);
      g.arrays[k] = s.arrays && s.arrays[p.ref] ? plain(s.arrays[p.ref]) : null;
    });
    return g;
  },
  // an Excel file imported (Import file) and saved again (Save .xlsx), as a person does it
  roundtrip: async function (c) {
    var im = await importFile(c.input.file), g = { note: im.note, alerts: im.alerts };
    if (!im.made.length) return g;
    var first = im.made.filter(function (x) { return !c.input.sheet || (x.book && x.book.sheet === c.input.sheet); })[0] || im.made[0];
    await openDoc(first.id);
    g.file = await clickSave(c.id); g.save_note = noteText();
    var book = {}; im.made.forEach(function (m) { if (m.book) book[m.book.sheet] = m.cells; });
    var v = L.sheetDocs.compute(first.cells, book, first.book ? first.book.sheet : undefined);
    g.raw = {}; g.values = {};
    Object.keys(c.expected.cells || {}).forEach(function (k) { g.raw[k] = first.cells[k] == null ? null : first.cells[k]; g.values[k] = val(v[k]); });
    return g;
  },
  // a formula as Save .xlsx writes it into the file
  grammar: async function (c) {
    try { return plain(X.excelFormula(c.input.f)); } catch (e) { return { crash: e.message }; }
  },
  // a sheet typed (cell by cell through the formula bar) and saved with Save .xlsx
  typed: async function (c) {
    var id = L.sheetDocs.create(c.id, {}, {}), g = { trace: [] };
    await openDoc(id);
    var keys = Object.keys(c.input.cells);
    for (var i = 0; i < keys.length; i++) {
      try { clickCell(keys[i]); var b = bar(); b.value = c.input.cells[keys[i]]; fire(b, "input"); key(b, "Enter"); await sleep(10); }
      catch (e) { g.trace.push({ at: keys[i], crash: e.message }); }
    }
    var doc = docOf(id), v = L.sheetDocs.compute(doc.cells);
    g.values = {}; g.shown = shownText(Object.keys(c.expected.cells || {}));
    Object.keys(c.expected.cells || {}).forEach(function (k) { g.values[k] = val(v[k]); });
    g.file = await clickSave(c.id); g.save_note = noteText(); g.alerts = alerts.slice();
    return g;
  },
  // a sheet's cells (as they would be typed) saved with Lantern.xlsx.write
  save: async function (c) {
    var doc = { title: c.input.title || c.id, cells: plain(c.input.cells), fmt: {}, merges: [], arrays: {} };
    var vals = L.sheetDocs.compute(doc.cells), r = X.write(doc, vals);
    fs.writeFileSync(path.join(OUT, c.id + ".xlsx"), Buffer.from(r.bytes));
    var g = { notes: plain(r.notes), file: c.id + ".xlsx", values: {} };
    Object.keys(c.expected.cells || {}).forEach(function (k) { g.values[k] = val(vals[k]); });
    return g;
  },
  // clicks and keys on a sheet with a merged cell
  grid: async function (c) {
    var inp = c.input, dd = plain(inp.doc), trace = [];
    var id = L.sheetDocs.create(dd.title || c.id, dd.cells || {}, { fmt: dd.fmt || {}, merges: dd.merges || [] });
    await openDoc(id);
    for (var i = 0; i < inp.steps.length; i++) {
      var st = inp.steps[i];
      try {
        if (st.click) clickCell(st.click, st);
        else if (st.key) { key(grid(), st.key, st); await sleep(5); }
        else if (st.type != null) { var b = bar(); b.value = st.type; fire(b, "input"); key(b, st.end || "Enter", st); await sleep(15); }
        else if (st.check) trace.push({ step: i, range: rangeName(), active: L.sheetEdit.active ? L.sheetEdit.active() : null });
      } catch (e) { trace.push({ step: i, crash: e.message }); }
    }
    return { trace: trace };
  }
};

(async function () {
  var got = {};
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i], e0 = errs.length;
    try { got[c.id] = await RUN[c.kind](c); } catch (e) { got[c.id] = { crash: String(e && e.stack || e).slice(0, 600) }; }
    if (errs.length > e0) got[c.id].page_errors = errs.slice(e0);
  }
  fs.writeFileSync(path.join(OUT, "got.json"), JSON.stringify(got));
  process.exit(0);
})();
