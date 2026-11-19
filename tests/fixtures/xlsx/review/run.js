// run.js -- runs the review's cases (cases.json) against Lantern in jsdom and writes what Lantern did, case by case,
// for replay.py to judge. Nothing here decides AGREE or DISAGREE: it only records.
//   node run.js <cases.json> <out dir> [inner.html] [--only id,id]
// <out dir>/got.json: {id: {...}}; <out dir>/<id>.xlsx for each case that saves a workbook.
"use strict";
var path = require("path"), fs = require("fs");
var ROOT = path.resolve(__dirname, "..", "..", "..", "..");
var JSDOM = require(path.join(ROOT, "node_modules", "jsdom")).JSDOM, VirtualConsole = require(path.join(ROOT, "node_modules", "jsdom")).VirtualConsole;
var args = process.argv.slice(2), only = null;
var oi = args.indexOf("--only");
if (oi >= 0) { only = args[oi + 1].split(","); args.splice(oi, 2); }
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
// (main session, after the review) the clipboard keeps every kind a copy puts on it, as a browser's does: a paste
// after a copy in Lantern carries Lantern's mark with the text (the review's pasted its own text alone, as from
// another program)
var board = null;
function clip(type, text) {
  var data = type === "paste" && board ? board : { "text/plain": text == null ? "" : text }, e = d.createEvent("Event");
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
function idByTitle(title) { var m = L.sheetDocs.list().filter(function (x) { return x.title === title; }); return m.length ? m[m.length - 1].id : null; }
async function openDoc(id) { if (w.document.body.getAttribute("data-app") !== "sheet") { go("sheet"); await sleep(60); } L.sheetDocs.open(id); currentId = id; await sleep(40); }
function shownText(refs) { var o = {}; refs.forEach(function (r) { var t = td(r); o[r] = t ? t.textContent : null; }); return o; }
function tdInfo(ref) { var t = td(ref); return t ? { colSpan: t.colSpan, rowSpan: t.rowSpan, hidden: t.style.display === "none", text: t.textContent } : null; }
function cellName() { var n = d.querySelector(".cellname"); return n ? n.textContent : null; }
async function importFile(name, buf) {
  var before = {}; L.sheetDocs.list().forEach(function (x) { before[x.id] = 1; });
  alerts.length = 0;
  L.sheetXlsx.open(new w.File([buf], name)); await sleep(160);
  var made = L.sheetDocs.list().filter(function (x) { return !before[x.id]; });
  var note = d.querySelector(".lp-xlsx-note");
  return { made: made, note: note ? note.textContent : null, alerts: alerts.slice() };
}
function sheetOut(s) { return { name: s.name, title: s.title, cells: s.cells, fmt: s.fmt, widths: s.widths, merges: s.merges, freeze: s.freeze, rows: s.rows, paper: s.paper }; }
function save(id, sheet) {
  var t0 = Date.now();
  var vals = L.sheetDocs.compute(sheet.cells);
  var r = X.write(sheet, vals, function (raw) { return L.sheetDocs.logical(raw, sheet.cells); }, function (raw) { return L.sheetFormat.carried(sheet, raw); });
  fs.writeFileSync(path.join(OUT, id + ".xlsx"), Buffer.from(r.bytes));
  return { notes: plain(r.notes), values: plain(vals), file: id + ".xlsx", ms: Date.now() - t0 };
}

var RUN = {
  read: async function (c) {
    var inp = typeof c.input === "string" ? { file: c.input } : c.input, buf = fs.readFileSync(path.join(FILES, inp.file));
    var g = {}, t0 = Date.now();
    try { var r = X.read(u8(buf), inp.file); } catch (e) {
      var er = { error: e.message };
      if ((c.expected || {}).alert_contains) { var im0 = await importFile(inp.file, buf); er.import_alerts = im0.alerts; }
      return er;
    }
    g.ms = Date.now() - t0;
    g.title = r.title; g.notes = plain(r.notes); g.sheets = plain(r.sheets.map(sheetOut));
    // (main session, after the review) each sheet worked out with the workbook's other sheets, as the grid does from
    // 1.24.28 (=Jan!B6 finds Jan); the review's own run worked each out alone
    var bookMap = {}; r.sheets.forEach(function (s) { bookMap[s.name] = s.cells; });
    g.values = r.sheets.map(function (s) { return plain(L.sheetDocs.compute(s.cells, bookMap, s.name)); });
    var ex = c.expected || {};
    if (ex.shown || ex.grid || ex.values) {
      var im = await importFile(inp.file, buf);
      g.import_note = im.note; g.import_alerts = im.alerts;
      g.shown = {}; g.grid = {}; g.vshown = {};
      for (var k = 0; k < r.sheets.length; k++) {
        var want = (ex.shown && ex.shown[k]) || null, wantGrid = (ex.grid && ex.grid[k]) || null, wantV = (ex.values && ex.values[k]) || null;
        if (!want && !wantGrid && !wantV) continue;
        var mine = im.made.filter(function (x) { return x.title === r.sheets[k].title; })[0];
        var id = mine && mine.id;
        if (!id) { g.shown[k] = null; continue; }
        await openDoc(id);
        if (want) g.shown[k] = shownText(Object.keys(want));
        if (wantV) g.vshown[k] = shownText(Object.keys(wantV));
        if (wantGrid) { g.grid[k] = {}; Object.keys(wantGrid).forEach(function (ref) { g.grid[k][ref] = tdInfo(ref); }); }
      }
    }
    return g;
  },
  write: async function (c) {
    var inp = c.input, sheet;
    if (inp.make_sheet) {
      var saved = [], realDl = L.download;
      L.download = function (n, data, type) { saved.push({ name: n, data: data, type: type }); };
      var made = L.aiAct.build(inp.make_sheet, "");
      var plan = made && (made.plan || made), extra = (made && (made.extra || (plan && plan.extra))) || [];
      var b = extra.filter(function (x) { return x.label === "Save .xlsx"; })[0];
      if (!b) { L.download = realDl; return { error: "no Save .xlsx in the preview", extra: extra.map(function (x) { return x.label; }) }; }
      b.run(); await sleep(20); L.download = realDl;
      if (!saved.length) return { error: "nothing was saved" };
      fs.writeFileSync(path.join(OUT, c.id + ".xlsx"), Buffer.from(saved[0].data));
      var back = X.read(saved[0].data, saved[0].name).sheets[0];
      return { file: c.id + ".xlsx", name: saved[0].name, type: saved[0].type, cells: plain(plan && plan.cells), values: plain(L.sheetDocs.compute(back.cells)), read_back: plain(sheetOut(back)) };
    }
    sheet = plain(inp.sheet);
    if (inp.fill) { for (var rr = 1; rr <= inp.fill.rows; rr++) for (var cc = 0; cc < 25; cc++) sheet.cells[String.fromCharCode(65 + cc) + rr] = String((rr * 31 + cc * 7) % 97 + 0.5); for (rr = 1; rr <= inp.fill.rows; rr++) sheet.cells["Z" + rr] = "=SUM(A" + rr + ":Y" + rr + ")"; }
    var g = {};
    // what Sheets shows for it
    var id = L.sheetDocs.create(sheet.title, plain(sheet.cells), { fmt: plain(sheet.fmt || {}), widths: plain(sheet.widths || {}), merges: plain(sheet.merges || []), freeze: sheet.freeze || 0 });
    await openDoc(id);
    g.shown = shownText(Object.keys(sheet.cells).slice(0, 400));
    if (inp.ui) {   // Save .xlsx in the sheet's toolbar
      var saved2 = [], real2 = L.download;
      L.download = function (n, data, type) { saved2.push({ name: n, data: data, type: type }); };
      var btn = Array.prototype.filter.call(d.querySelectorAll("button"), function (x) { return x.textContent === "Save .xlsx"; })[0];
      if (btn) btn.click();
      await sleep(30); L.download = real2;
      if (!saved2.length) return { error: "Save .xlsx saved nothing", shown: g.shown };
      fs.writeFileSync(path.join(OUT, c.id + ".xlsx"), Buffer.from(saved2[0].data));
      g.file = c.id + ".xlsx"; g.name = saved2[0].name; g.values = plain(L.sheetDocs.compute(sheet.cells));
      var note = d.querySelector(".lp-xlsx-note"); g.ui_note = note ? note.textContent : null; g.alerts = alerts.slice();
      return g;
    }
    var s = save(c.id, sheet); g.notes = s.notes; g.values = s.values; g.file = s.file; g.ms = s.ms;
    try { g.read_back = plain(sheetOut(X.read(u8(fs.readFileSync(path.join(OUT, s.file))), "x.xlsx").sheets[0])); } catch (e) { g.read_back_error = e.message; }
    return g;
  },
  round: async function (c) {
    var inp = typeof c.input === "string" ? { file: c.input } : c.input, buf = fs.readFileSync(path.join(FILES, inp.file));
    var r = X.read(u8(buf), inp.file), k = inp.sheet || 0, s = r.sheets[k];
    // (main session, after the review) the sheet as Import file keeps it from 1.24.28: its own name in the workbook
    // (book.sheet) and its array formulas (arrays)
    var sheet = { title: s.title, cells: s.cells, fmt: s.fmt, widths: s.widths, merges: s.merges, freeze: s.freeze, paper: s.paper, arrays: s.arrays, book: { id: "review", name: r.title, sheet: s.name, at: k } };
    var o = save(c.id, sheet);
    return { read_notes: plain(r.notes), notes: o.notes, values: o.values, file: o.file, cells: plain(s.cells), fmt: plain(s.fmt), sheet_name: s.name, title: s.title };
  },
  grammar: async function (c) {
    var g = {};
    c.input.formulas.forEach(function (f) { try { g[f] = plain(X.excelFormula(f)); } catch (e) { g[f] = { crash: e.message }; } });
    return { results: g };
  },
  order: async function (c) {
    var cells = plain(c.input.cells || {}), refs = [];
    c.input.formulas.forEach(function (f, i) { var ref = "Z" + (i + 1); cells[ref] = f; refs.push(ref); });
    var v = L.sheetDocs.compute(cells), sheet = {}, calc = {}, shown = {};
    var id = L.sheetDocs.create(c.id, plain(cells), {});
    await openDoc(id);
    c.input.formulas.forEach(function (f, i) {
      sheet[f] = v[refs[i]]; shown[f] = td(refs[i]) ? td(refs[i]).textContent : null;
      if (c.input.calculator) { try { calc[f] = L.formula.evaluate(f.replace(/^=/, ""), {}); } catch (e) { calc[f] = "THROWS: " + e.message; } }
    });
    return { sheet: plain(sheet), shown: shown, calculator: plain(calc) };
  },
  grid: async function (c) {
    var trace = [], inp = c.input;
    if (inp.open) {
      var im = await importFile(inp.open, fs.readFileSync(path.join(FILES, inp.open)));
      if (!im.made.length) return { error: "nothing opened", alerts: im.alerts };
      currentId = im.made[inp.sheet || 0].id; await openDoc(currentId);
    } else {
      var dd = plain(inp.doc);
      var id = L.sheetDocs.create(dd.title || c.id, dd.cells || {}, { fmt: dd.fmt || {}, widths: dd.widths || {}, merges: dd.merges || [], freeze: dd.freeze || 0 });
      await openDoc(id);
    }
    for (var i = 0; i < inp.steps.length; i++) {
      var st = inp.steps[i];
      try {
        if (st.click) clickCell(st.click, st);
        else if (st.key) { key(grid(), st.key, st); await sleep(5); }
        else if (st.type != null) { if (st.at) clickCell(st.at); var b = bar(); b.value = st.type; fire(b, "input"); key(b, "Enter"); await sleep(10); }
        else if (st.act) { L.sheetEdit.rowAct(st.act); await sleep(20); }
        else if (st.undo) { key(grid(), "z", { ctrl: true }); await sleep(20); }
        else if (st.redo) { key(grid(), "y", { ctrl: true }); await sleep(20); }
        else if (st.copy) { trace.push({ step: i, copied: clip("copy") }); }
        else if (st.cut) { trace.push({ step: i, cut: clip("cut") }); }
        else if (st.paste != null) { clip("paste", st.paste); await sleep(10); }
        else if (st.freeze != null) {
          var box = Array.prototype.filter.call(d.querySelectorAll("label"), function (l) { return /Freeze top row/.test(l.textContent); })[0];
          var cb = box && box.querySelector("input"); if (cb && cb.checked !== !!st.freeze) { cb.checked = !!st.freeze; fire(cb, "change"); }
          await sleep(10);
        } else if (st.save) {
          var saved = [], real = L.download;
          L.download = function (n, data, type) { saved.push({ name: n, data: data }); };
          var sb = Array.prototype.filter.call(d.querySelectorAll("button"), function (x) { return x.textContent === "Save .xlsx"; })[0];
          if (sb) sb.click(); await sleep(20); L.download = real;
          if (saved.length) { fs.writeFileSync(path.join(OUT, c.id + ".xlsx"), Buffer.from(saved[0].data)); trace.push({ step: i, saved: c.id + ".xlsx" }); }
          else trace.push({ step: i, saved: null });
        } else if (st.check) {
          var doc = docOf(), o = { step: i, name: cellName(), active: L.sheetEdit.active ? L.sheetEdit.active() : null };
          o.merges = plain(doc.merges || []); o.widths = plain(doc.widths || {}); o.freeze = doc.freeze || 0;
          o.cells = {}; (st.check.cells || []).forEach(function (r) { o.cells[r] = doc.cells[r] == null ? null : doc.cells[r]; });
          o.td = {}; (st.check.td || []).forEach(function (r) { o.td[r] = tdInfo(r); });
          o.alerts = alerts.slice();
          o.status = Array.prototype.map.call(d.querySelectorAll("[role=status]"), function (x) { return x.textContent; }).join(" | ");
          trace.push(o);
        }
      } catch (e) { trace.push({ step: i, crash: e.message }); }
    }
    return { trace: trace };
  }
};

(async function () {
  var got = {};
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i];
    if (only && only.indexOf(c.id) < 0) continue;
    var e0 = errs.length;
    try { got[c.id] = await RUN[c.group](c); } catch (e) { got[c.id] = { crash: String(e && e.stack || e).slice(0, 600) }; }
    if (errs.length > e0) got[c.id].page_errors = errs.slice(e0);
  }
  fs.writeFileSync(path.join(OUT, "got.json"), JSON.stringify(got));
  process.exit(0);
})();
