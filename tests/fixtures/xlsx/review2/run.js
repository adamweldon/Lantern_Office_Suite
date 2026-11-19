// run.js -- runs the second Excel review's cases against Lantern in jsdom and records what Lantern does, case by case.
// Nothing here judges: replay.py does, against what Excel does.
//   node run.js <cases.json> <out dir> [inner.html]
// <out dir>/got.json: {id: {...}}; <out dir>/<id>.xlsx for each case that saves a workbook.
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
// a clipboard that keeps every kind a copy puts on it, as a browser's does
var board = null;
function clip(type) {
  var data = type === "paste" && board ? board : { "text/plain": "" }, e = d.createEvent("Event");
  e.initEvent(type, true, true);
  e.clipboardData = { get types() { return Object.keys(data); }, setData: function (k, v) { data[k] = v; }, getData: function (k) { return data[k] == null ? "" : data[k]; } };
  grid().focus(); grid().dispatchEvent(e);
  if (type === "copy" || type === "cut") board = data;
  return data["text/plain"];
}
w.eval(js);
fire(d, "DOMContentLoaded");
var L = w.Lantern, X = L.xlsx;
var currentId = null;
function docOf(id) { return L.store.collection("sheet.docs").get(id || currentId); }
async function openDoc(id) { if (d.body.getAttribute("data-app") !== "sheet") { go("sheet"); await sleep(60); } L.sheetDocs.open(id); currentId = id; await sleep(40); }
function shownText(refs) { var o = {}; refs.forEach(function (r) { var t = td(r); o[r] = t ? t.textContent : null; }); return o; }
function rangeName() {
  var S = L.sheetEdit; if (!S || !S.range) return null;
  var R = S.range(), a = String.fromCharCode(65 + R.c0) + (R.r0 + 1), b = String.fromCharCode(65 + R.c1) + (R.r1 + 1);
  return a + ":" + b;
}
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

var RUN = {
  compute: async function (c) {
    var inp = c.input, ex = c.expected || {}, g = {};
    var v = inp.book ? L.sheetDocs.compute(plain(inp.cells), plain(inp.book), inp.self) : L.sheetDocs.compute(plain(inp.cells));
    g.values = {};
    Object.keys(ex.values || {}).forEach(function (r) { g.values[r] = v[r] === undefined ? null : v[r]; });
    if (inp.grid) {
      var id = L.sheetDocs.create(c.id, plain(inp.cells), { fmt: plain(inp.fmt || {}) });
      await openDoc(id);
      g.shown = shownText(Object.keys(Object.assign({}, ex.shown || {}, ex.shown_re || {}, ex.values || {})));
    }
    return g;
  },
  calc: async function (c) {
    try { return { value: L.formula.evaluate(c.input.src, {}) }; } catch (e) { return { value: "THROWS: " + e.message }; }
  },
  shown: async function (c) {
    var s = null, t = null;
    try { s = L.sheetFormat.shown(c.input.value, c.input.code); } catch (e) { s = "THROWS: " + e.message; }
    try { t = L.sheetDocs.compute({ A1: "=TEXT(" + c.input.value + ",\"" + c.input.code.replace(/"/g, "\"\"") + "\")" }).A1; } catch (e) { t = "THROWS: " + e.message; }
    return { text: s, text_fn: t };
  },
  grammar: async function (c) {
    try { return plain(X.excelFormula(c.input.f)); } catch (e) { return { crash: e.message }; }
  },
  save: async function (c) {
    var sh = plain(c.input.sheet), doc = { title: sh.title, cells: sh.cells, fmt: sh.fmt || {}, merges: sh.merges || [], arrays: sh.arrays || {} };
    var vals = L.sheetDocs.compute(doc.cells);
    var r = X.write(doc, vals);
    fs.writeFileSync(path.join(OUT, c.id + ".xlsx"), Buffer.from(r.bytes));
    var want = {};
    Object.keys(vals).forEach(function (k) { if (/^=/.test(String(doc.cells[k]))) want[k] = vals[k]; });
    return { notes: plain(r.notes), file: c.id + ".xlsx", values: plain(want) };
  },
  read: async function (c) {
    var buf = fs.readFileSync(path.join(FILES, c.input.file)), r, g = {};
    try { r = X.read(u8(buf), c.input.file); } catch (e) { return { error: e.message }; }
    g.notes = plain(r.notes); g.sheet_names = r.sheets.map(function (s) { return s.name; });
    var bookMap = {}; r.sheets.forEach(function (s) { bookMap[s.name] = s.cells; });
    var ex = c.expected || {}, need = Object.keys(Object.assign({}, ex.raw || {}, ex.values || {}, ex.arrays || {}, ex.fmt || {}));
    g.raw = {}; g.values = {}; g.arrays = {}; g.fmt = {};
    var vals = {};
    r.sheets.forEach(function (s) { vals[s.name] = L.sheetDocs.compute(s.cells, bookMap, s.name); });
    need.forEach(function (k) {
      var p = splitRef(k), s = p.sheet ? r.sheets.filter(function (x) { return x.name === p.sheet; })[0] : r.sheets[0];
      if (!s) { g.raw[k] = "NO SHEET"; return; }
      g.raw[k] = s.cells[p.ref] == null ? null : s.cells[p.ref];
      g.values[k] = vals[s.name][p.ref] === undefined ? null : vals[s.name][p.ref];
      g.arrays[k] = s.arrays && s.arrays[p.ref] ? (s.arrays[p.ref].ref || s.arrays[p.ref]) : null;
      g.fmt[k] = s.fmt && s.fmt[p.ref] ? s.fmt[p.ref].nf || null : null;
    });
    return g;
  },
  import: async function (c) {
    var im = await importFile(c.input.file), g = { alerts: im.alerts, note: im.note, made: im.made.map(function (x) { return x.book ? x.book.sheet : x.title; }), trace: [] };
    if (!im.made.length) return g;
    currentId = im.made[0].id;
    await openDoc(currentId);
    var steps = c.input.steps || [];
    for (var i = 0; i < steps.length; i++) {
      var st = steps[i];
      try {
        if (st.open) { var m = im.made.filter(function (x) { return x.book && x.book.sheet === st.open; })[0]; if (!m) throw new Error("no sheet " + st.open); await openDoc(m.id); }
        else if (st.type != null) { clickCell(st.at); var b = bar(); b.value = st.type; fire(b, "input"); key(b, "Enter"); await sleep(20); }
        else if (st.check) { g.shown = Object.assign(g.shown || {}, shownText(st.check)); }
        else if (st.save) { g.file = await clickSave(c.id); g.save_note = noteText(); }
      } catch (e) { g.trace.push({ step: i, crash: e.message }); }
    }
    return g;
  },
  grid: async function (c) {
    var inp = c.input, trace = [], dd = plain(inp.doc);
    var id = L.sheetDocs.create(dd.title || c.id, dd.cells || {}, { fmt: dd.fmt || {}, merges: dd.merges || [] });
    await openDoc(id);
    var g = {};
    for (var i = 0; i < inp.steps.length; i++) {
      var st = inp.steps[i];
      try {
        if (st.click) clickCell(st.click, st);
        else if (st.key) { key(grid(), st.key, st); await sleep(5); }
        else if (st.type != null) { if (st.at) clickCell(st.at); var b = bar(); b.value = st.type; fire(b, "input"); key(b, "Enter"); await sleep(15); }
        else if (st.act) { L.sheetEdit.rowAct(st.act); await sleep(20); }
        else if (st.copy) clip("copy");
        else if (st.cut) clip("cut");
        else if (st.paste) { clip("paste"); await sleep(10); }
        else if (st.save) { g.file = await clickSave(c.id); g.save_note = noteText(); }
        else if (st.undo) { key(grid(), "z", { ctrl: true }); await sleep(20); }
        else if (st.check) {
          var doc = docOf(id), o = { step: i, range: rangeName(), active: L.sheetEdit.active ? L.sheetEdit.active() : null, merges: plain(doc.merges || []), cells: {} };
          (st.check.cells || []).forEach(function (r) { o.cells[r] = doc.cells[r] == null || doc.cells[r] === "" ? null : doc.cells[r]; });
          o.alerts = alerts.slice();
          trace.push(o);
        }
      } catch (e) { trace.push({ step: i, crash: e.message }); }
    }
    g.trace = trace;
    return g;
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
