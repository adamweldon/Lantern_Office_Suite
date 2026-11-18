// review_sheetedit_1265.js -- the third reviewer's cases for 1.24.25 (Sheets editing as in Excel, and the
// check on POWER for power in watts), replayed. The reviewer had not seen the code written; it made its own
// cases and an oracle (an independent reader of references, checked against LibreOffice on all 696):
//   refs  -- a formula's references after a copy (shift) or rows and columns put in or taken out (move);
//   grid  -- a sheet, the clicks and keys a person makes, and what Excel leaves in the cells;
//   power -- questions and formulas, whether the check should speak, and the right answer.
// At review 1.24.25 agreed with 653 of 696, 182 of 254 and 36 of 67. Every case must now agree, or be in KEEP
// with the reason it is left as it is.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FIX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review_sheetedit_1265.json"), "utf8"));
var VERBOSE = process.argv.indexOf("-v") > 0;

// what is left as it is, and why
var KEEP = {
  // refs: Lantern's formulas reach row 9999 (=A2001 is an empty cell, as in Excel and LibreOffice, which the
  // reviewer's oracle also gives); the reviewer counted past row 2000, the most rows a sheet is given, as off
  // the sheet
  pastRow2000: function (x) { return x.fn === "shift" && /past row 2000/.test(x.note || ""); },
  // power: the energy in the question is per beat, or per motor; the model's sum of it is right, but a line
  // made from the energy stated would not be, so the check says nothing (rule 7: surer than the model)
  energyIsASum: function (x) { return x.question && (/per beat/.test(x.question) || /2 motors that each/.test(x.question)); }
};

var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, promptAnswer = null;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.prompt = function () { return promptAnswer; };
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0, kept = 0;
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function td(ref) { return d.querySelector("td[data-ref=" + ref + "]"); }
function bar() { return d.querySelector(".fbar input"); }
function grid() { return d.querySelector(".gridwrap"); }
function mouse(el, type, o) { o = o || {}; el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, shiftKey: !!o.shift, buttons: o.buttons || 0 })); }
function clickCell(ref, o) { mouse(td(ref), "mousedown", o); mouse(td(ref), "mouseup", o); mouse(td(ref), "click", o); }
function key(el, k, o) { o = o || {}; el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, metaKey: !!o.meta, altKey: !!o.alt })); }
function typeIn(ref, text) { clickCell(ref); var b = bar(); b.value = text; fire(b, "input"); key(b, "Enter"); }
function clip(type, text) {
  var data = { t: text == null ? "" : text }, e = d.createEvent("Event");
  e.initEvent(type, true, true);
  e.clipboardData = { setData: function (k, v) { data.t = v; }, getData: function () { return data.t; } };
  grid().focus(); grid().dispatchEvent(e);
  return data.t;
}
function sortKeys(o) { if (o && typeof o === "object" && !Array.isArray(o)) { var r = {}; Object.keys(o).sort().forEach(function (k) { r[k] = sortKeys(o[k]); }); return r; } return o; }
function eq(a, b) { return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b)); }
function emptyFmt(f) { return !f || !Object.keys(f).length ? null : f; }

(async function () {
  w.eval(js);
  var ev = d.createEvent("Event"); ev.initEvent("DOMContentLoaded", true, true); d.dispatchEvent(ev);
  await sleep(60);
  var L = w.Lantern, S = L.sheetEdit, docId = null, lastClip = null;
  function current() { return L.store.collection("sheet.docs").get(docId); }
  function btn(text) { return Array.prototype.filter.call(d.querySelectorAll(".lp-editbar button"), function (b) { return b.textContent === text; })[0]; }
  function menu() { return d.querySelector(".lp-editbar select[aria-label='Rows and columns']"); }
  function pick() { return d.querySelector(".lp-editbar select[aria-label='Number format']"); }
  w.location.hash = "sheet"; fire(w, "hashchange"); await sleep(80);
  async function open(cells, extra) {
    var id = L.sheetDocs.create("Rev", JSON.parse(JSON.stringify(cells || {})));
    if (extra) { var col = L.store.collection("sheet.docs"), dd = col.get(id); for (var k in extra) dd[k] = JSON.parse(JSON.stringify(extra[k])); col.put(dd); }
    docId = id; L.sheetDocs.open(id); await sleep(30);
    return id;
  }
  async function act(a) {
    var t = a[0], i, b;
    if (t === "click") clickCell(a[1]);
    else if (t === "shiftclick") clickCell(a[1], { shift: true });
    else if (t === "drag") { mouse(td(a[1]), "mousedown", { buttons: 1 }); for (i = 2; i < a.length; i++) mouse(td(a[i]), "mouseover", { buttons: 1 }); var last = a[a.length - 1]; mouse(td(last), "mouseup"); mouse(td(last), "click"); }
    else if (t === "key") key(grid(), a[1], a[2] || {});
    else if (t === "barkey") key(bar(), a[1], a[2] || {});
    else if (t === "type") typeIn(a[1], a[2]);
    else if (t === "typenoenter") { clickCell(a[1]); b = bar(); b.value = a[2]; fire(b, "input"); }
    else if (t === "copy") lastClip = clip("copy");
    else if (t === "cut") lastClip = clip("cut");
    else if (t === "paste") clip("paste", a.length > 1 ? a[1] : lastClip);
    else if (t === "menu") { var m = menu(); m.value = a[1]; fire(m, "change"); }
    else if (t === "button") { var bb = btn(a[1]); if (!bb) throw new Error("no button " + a[1]); bb.click(); }
    else if (t === "format") { var p = pick(), has = Array.prototype.some.call(p.options, function (o) { return o.value === a[1]; }); if (has) p.value = a[1]; else { p.value = "*"; promptAnswer = a[1]; } fire(p, "change"); }
    else if (t === "freeze") { var fr = d.querySelector(".lp-editbar input[type=checkbox]"); fr.checked = !!a[1]; fire(fr, "change"); }
    else if (t === "wait") await sleep(a[1] || 10);
    else if (t === "typekey") { key(grid(), a[1]); b = bar(); if (a[1].length === 1) fire(b, "input"); key(b, "Enter"); }
    else if (t === "header") { var th = Array.prototype.filter.call(d.querySelectorAll("table.grid thead th"), function (x) { return x.textContent === a[1]; })[0]; mouse(th, "mousedown"); mouse(th, "mouseup"); mouse(th, "click"); }
    else if (t === "rowheader") { var th2 = td("A" + a[1]).parentNode.firstChild; mouse(th2, "mousedown"); mouse(th2, "mouseup"); mouse(th2, "click"); }
    else if (t === "opennew") { var keepClip = lastClip; await open(a[1] || {}); lastClip = keepClip; }
    else if (t === "undoall") { for (i = 0; i < (a[1] || 50); i++) key(grid(), "z", { ctrl: true }); }
    else if (t === "redoall") { for (i = 0; i < (a[1] || 50); i++) key(grid(), "y", { ctrl: true }); }
    else throw new Error("unknown action " + t);
    await sleep(0);
  }
  function verdict(part, label, ok, keepWhy, info) {
    if (ok) { passes++; return; }
    if (keepWhy) { kept++; if (VERBOSE) console.log("KEEP", part, keepWhy, label); return; }
    fails++; console.log("FAIL", part, label, info === undefined ? "" : JSON.stringify(info).slice(0, 500));
  }
  function keepOf(x) { for (var k in KEEP) if (KEEP[k](x)) return k; return null; }

  // --- refs: compared as references, so $A2:A$4 and $A$4:A2 (one range, its ends each with its own $) agree ----
  function canon(f) {
    return typeof f !== "string" ? f : S.eachRef(f, function (x) {
      function cell(c, r, ac, ar) { return (ac ? "$" : "") + String.fromCharCode(65 + c) + (ar ? "$" : "") + (r + 1); }
      if (x.whole === "row") return (x.ar1 ? "$" : "") + (x.r1 + 1) + ":" + (x.ar2 ? "$" : "") + (x.r2 + 1);
      if (x.whole) return (x.ac1 ? "$" : "") + String.fromCharCode(65 + x.c1) + ":" + (x.ac2 ? "$" : "") + String.fromCharCode(65 + x.c2);
      return x.two ? cell(x.c1, x.r1, x.ac1, x.ar1) + ":" + cell(x.c2, x.r2, x.ac2, x.ar2) : cell(x.c1, x.r1, x.ac1, x.ar1);
    }).replace(/#REF!:#REF!|\$?[A-Z]?\$?#REF!:\$?[A-Z]+\$?#REF!/g, "#REF!");
  }
  FIX.refs.forEach(function (x) {
    var got = x.fn === "shift" ? S.shift(x.args[0], x.args[1], x.args[2]) : S.move(x.args[0], x.args[1], x.args[2], x.args[3]);
    verdict("refs", x.fn + " " + JSON.stringify(x.args), got === x.expected || canon(got) === canon(x.expected), keepOf(x), { got: got, want: x.expected });
  });
  var c = L.sheetDocs.compute;
  verdict("refs", "the engine reads AA as past Z: =SUM(A2:AA2) is A2:Z2", c({ A2: "1", B2: "2", Z2: "3", A1: "=SUM(A2:AA2)" }).A1 === 6, null, c({ A2: "1", B2: "2", Z2: "3", A1: "=SUM(A2:AA2)" }).A1);
  verdict("refs", "=AA1 is an empty cell (as in Excel), not A1", c({ A1: "7", B1: "=AA1" }).B1 !== 7, null);

  // --- grid ---------------------------------------------------------------------------------------------------
  var n = 0;
  for (var gi = 0; gi < FIX.grid.length; gi++) {
    var g = FIX.grid[gi], e = g.expected_after, why = [], err = null;
    if (g.agree === null) continue;   // the reviewer could not say what Excel does
    try {
      // "undo everything, then redo everything: the sheet as after the sequence" -- the reviewer took that sheet
      // from Lantern as it was; it is taken again from Lantern as it is (empty cells' looks now move with a row)
      if (/redo everything: the sheet as after the sequence/.test(g.steps)) {
        n++;
        await open({ A1: "__reset" + n }); clickCell("A1"); clip("copy"); lastClip = null;
        await open(g.cells_before, g.fmt_before ? { fmt: g.fmt_before } : null);
        for (var si = 0; si < g.actions.length; si++) if (!/^(undoall|redoall)$/.test(g.actions[si][0])) await act(g.actions[si]);
        var sd = current();
        e = { cells: JSON.parse(JSON.stringify(sd.cells)), fmt: emptyFmt(sd.fmt ? JSON.parse(JSON.stringify(sd.fmt)) : null), freeze: sd.freeze || null };
      }
      n++;
      await open({ A1: "__reset" + n }); clickCell("A1"); clip("copy"); lastClip = null;
      await open(g.cells_before, g.fmt_before ? { fmt: g.fmt_before } : null);
      for (var ai = 0; ai < g.actions.length; ai++) await act(g.actions[ai]);
      var doc = current(), cells = JSON.parse(JSON.stringify(doc.cells)), fmt = emptyFmt(doc.fmt ? JSON.parse(JSON.stringify(doc.fmt)) : null);
      if ("cells" in e && !eq(cells, e.cells)) why.push("cells");
      if ("cellsSub" in e) for (var k in e.cellsSub) if (e.cellsSub[k] !== (cells[k] == null ? null : cells[k])) why.push(k + "=" + JSON.stringify(cells[k]));
      if ("fmt" in e && !eq(fmt, emptyFmt(e.fmt))) why.push("fmt " + JSON.stringify(fmt));
      if ("fmtSub" in e) for (var k2 in e.fmtSub) if (!eq(fmt && fmt[k2] || null, e.fmtSub[k2])) why.push("fmt " + k2 + "=" + JSON.stringify(fmt && fmt[k2]));
      if ("shown" in e) for (var k3 in e.shown) { var t3 = td(k3) ? td(k3).textContent : null; if (t3 !== e.shown[k3]) why.push("shown " + k3 + "=" + JSON.stringify(t3)); }
      if ("name" in e && d.querySelector(".cellname").textContent !== e.name) why.push("name " + d.querySelector(".cellname").textContent);
      if ("range" in e) { var R = S.range(), rg = String.fromCharCode(65 + R.c0) + (R.r0 + 1) + ":" + String.fromCharCode(65 + R.c1) + (R.r1 + 1); if (rg !== e.range) why.push("range " + rg); }
      if ("clip" in e && lastClip !== e.clip) why.push("clip " + JSON.stringify(lastClip));
      if ("freeze" in e && (doc.freeze || null) !== (e.freeze || null)) why.push("freeze");
      if ("picker" in e && pick().value !== e.picker) why.push("picker " + pick().value);
      if ("rows" in e && (doc.rows || null) !== e.rows) why.push("rows " + doc.rows);
    } catch (ex) { err = String(ex && ex.message || ex); why.push("error " + err); }
    verdict("grid", g.steps, !why.length, keepOf(g), why);
  }

  // --- power --------------------------------------------------------------------------------------------------
  var f = L.aiChecks.powerMeantWatts;
  FIX.power.forEach(function (p) {
    var r = f(p.question, p.formula), fired = r != null, line = fired ? (/Write =([\s\S]*)$/.exec(r) || [])[1] : null, v = null;
    if (line) try { v = L.formula.evaluate(line, { deg: false, ans: 0 }); } catch (e2) { v = null; }
    var right = p.right_answer == null || (typeof v === "number" && Math.abs(v - p.right_answer) <= Math.abs(p.right_answer) * 1e-6 + 1e-9);
    var ok = p.should_fire ? fired && right : !fired;
    verdict("power", p.question + " | " + p.formula.replace(/\n/g, " / "), ok, keepOf(p), { said: r, value: v, right: p.right_answer });
  });

  if (errs.length) { fails++; console.log("FAIL page errors", errs.slice(0, 3)); }
  console.log(fails ? fails + " REVIEW 1.24.25 EDITING FAILURES (" + passes + " passed, " + kept + " kept)" : "ALL REVIEW 1.24.25 EDITING CASES PASS (" + passes + ", " + kept + " kept as they are)");
  process.exit(fails ? 1 : 0);
})();
