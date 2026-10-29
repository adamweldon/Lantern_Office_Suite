// sheet_audit.js -- Sheets after the app audit (1.16.0): typing is kept when
// another cell is clicked or the sheet is left; a cell clicked while a
// formula is typed goes into it; text cells, IF that guards a division,
// IFERROR, =PI(); errors as Excel names them and never hidden inside a SUM;
// numbers typed as 1,500 / $12.50 / 10%; Excel's keys; CSV import that
// replaces or opens a new sheet and says what did not fit; no empty
// "Untitled sheet" left behind.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, alerts = [], confirmAnswer = true;
w.alert = function (m) { alerts.push(String(m)); }; w.confirm = function () { return confirmAnswer; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 500)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function td(ref) { return d.querySelector("td[data-ref=" + ref + "]"); }
function bar() { return d.querySelector(".fbar input"); }
function grid() { return d.querySelector(".gridwrap"); }
function mouse(el, type) { el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true })); }
function clickCell(ref) { mouse(td(ref), "mousedown"); mouse(td(ref), "click"); }
function typeInBar(text) { var b = bar(); b.value = text; try { b.setSelectionRange(text.length, text.length); } catch (e) {} fire(b, "input"); }
function key(el, k, o) { var opts = { key: k, bubbles: true, cancelable: true }; Object.keys(o || {}).forEach(function (x) { opts[x] = o[x]; }); el.dispatchEvent(new w.KeyboardEvent("keydown", opts)); }
function enter(ref, text) { clickCell(ref); typeInBar(text); key(bar(), "Enter"); }
function btn(re) { return Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return re.test(b.textContent); })[0]; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern;
  var id = L.sheetDocs.create("Audit", {});
  w.location.hash = "sheet"; fire(w, "hashchange"); await sleep(80);
  L.sheetDocs.open(id); await sleep(40);
  ok("the sheet is open", !!td("A1") && !!bar());
  function cells() { return L.store.collection("sheet.docs").get(id).cells; }

  // --- typing kept --------------------------------------------------------------------------------
  clickCell("A1"); typeInBar("123"); clickCell("C3");
  ok("typing in A1, then clicking C3: A1 keeps 123 (it used to be thrown away)", cells().A1 === "123" && td("A1").textContent === "123", cells());
  clickCell("B1"); typeInBar("=SUM("); clickCell("A1");
  ok("typing =SUM( then clicking A1 puts A1 into the formula, and the bar keeps the focus", bar().value === "=SUM(A1" && d.activeElement === bar(), [bar().value, d.activeElement && d.activeElement.tagName]);
  typeInBar(bar().value + ")"); key(bar(), "Enter");
  ok("...Enter: B1 = 123", td("B1").textContent === "123", td("B1").textContent);
  clickCell("A2"); typeInBar("7");
  btn(/Sheets$/).click(); await sleep(20);
  ok("typing, then ← Sheets: kept", cells().A2 === "7", cells());
  L.sheetDocs.open(id); await sleep(30);

  // --- formulas -----------------------------------------------------------------------------------
  enter("A1", "hello");
  enter("B2", "=A1"); enter("C2", "=LEN(A1)"); enter("D2", "=UPPER(A1)"); enter("E2", "=A1=\"HELLO\"");
  ok("a formula reads a text cell: =A1, =LEN(A1), =UPPER(A1), =A1=\"HELLO\" (text compares ignore case)",
    td("B2").textContent === "hello" && td("C2").textContent === "5" && td("D2").textContent === "HELLO" && td("E2").textContent === "1",
    [td("B2").textContent, td("C2").textContent, td("D2").textContent, td("E2").textContent]);
  enter("A3", "10"); enter("B3", "0");
  enter("C3", "=IF(B3=0,0,A3/B3)"); enter("D3", "=IF(A3>10,\"big\",\"small\")"); enter("E3", "=IFERROR(A3/B3,\"none\")"); enter("F3", "=PI()");
  ok("IF guards a division by zero; IF gives text; IFERROR; =PI()", td("C3").textContent === "0" && td("D3").textContent === "small" &&
    td("E3").textContent === "none" && /^3\.14159/.test(td("F3").textContent), [td("C3").textContent, td("D3").textContent, td("E3").textContent, td("F3").textContent]);
  enter("G1", "5"); enter("G2", "=1/0"); enter("G3", "10"); enter("G4", "=SUM(G1:G3)");
  ok("an error inside a range shows in the SUM (#DIV/0!), not a total that looks right", td("G2").textContent === "#DIV/0!" && td("G4").textContent === "#DIV/0!", [td("G2").textContent, td("G4").textContent]);
  enter("H1", "1"); enter("H2", "2"); enter("H3", "3"); enter("H4", "=SUM(H1:H4)");
  ok("a total that includes its own cell is a loop", td("H4").textContent === "#CYCLE", td("H4").textContent);
  enter("I1", "=J1"); enter("J1", "=I1");
  ok("a two-cell loop is #CYCLE in both cells", td("I1").textContent === "#CYCLE" && td("J1").textContent === "#CYCLE", [td("I1").textContent, td("J1").textContent]);
  enter("K1", "=FOO(1)"); enter("K2", "=A1+1");
  ok("errors as Excel names them: #NAME? and #VALUE!", td("K1").textContent === "#NAME?" && td("K2").textContent === "#VALUE!", [td("K1").textContent, td("K2").textContent]);

  // --- typed numbers ---------------------------------------------------------------------------------
  enter("L1", "1,500"); enter("L2", "$12.50"); enter("L3", "10%"); enter("L4", "=SUM(L1:L3)"); enter("L5", "4.7e-11");
  ok("1,500, $12.50 and 10% are numbers (SUM = 1512.6) and show as typed; 4.7e-11 is not 0",
    td("L4").textContent === "1512.6" && td("L1").textContent === "1,500" && td("L2").textContent === "$12.50" && td("L3").textContent === "10%" && td("L5").textContent === "4.7e-11",
    [td("L4").textContent, td("L1").textContent, td("L5").textContent]);
  enter("M1", " "); enter("M2", "0x1F"); enter("M3", "Infinity"); enter("M4", "=COUNT(M1:M3)");
  ok("a space, 0x1F and Infinity are text, not NaN or numbers", td("M1").textContent !== "NaN" && td("M2").textContent === "0x1F" && td("M4").textContent === "0", [td("M1").textContent, td("M4").textContent]);

  // --- keys ------------------------------------------------------------------------------------------------
  clickCell("C5"); key(grid(), "Tab");
  ok("Tab on the grid moves right", d.querySelector(".cellname").textContent === "D5");
  key(grid(), "Tab", { shiftKey: true });
  ok("Shift+Tab moves left", d.querySelector(".cellname").textContent === "C5");
  key(grid(), "Home");
  ok("Home goes to column A", d.querySelector(".cellname").textContent === "A5");
  clickCell("C7"); typeInBar("9"); key(bar(), "Enter", { shiftKey: true });
  ok("Shift+Enter keeps the value and moves up", cells().C7 === "9" && d.querySelector(".cellname").textContent === "C6");
  key(grid(), "End");
  key(grid(), "Home", { ctrlKey: true });
  ok("Ctrl+Home goes to A1", d.querySelector(".cellname").textContent === "A1");

  // --- CSV import --------------------------------------------------------------------------------------
  var rows = ["name,score"]; for (var i = 1; i <= 149; i++) rows.push("p" + i + "," + i);
  var big = rows.join("\n"), fileIn = d.querySelector("input[type=file][accept*=csv]");
  function importFile(text, name) { Object.defineProperty(fileIn, "files", { value: [new w.File([text], name)], configurable: true }); fire(fileIn, "change"); }
  var nBefore = L.sheetDocs.list().length;
  confirmAnswer = false;
  importFile(big, "people.csv"); await sleep(80);
  var lst = L.sheetDocs.list(), made = lst.filter(function (x) { return x.title === "people"; })[0];
  ok("a CSV into a sheet with data: Cancel opens it as a new sheet, named after the file", lst.length === nBefore + 1 && !!made && cells().A1 === "hello", lst.map(function (x) { return x.title; }));
  ok("...and says it kept 100 of 150 rows (it used to drop them without a word)", alerts.some(function (a) { return /imported 100 of 150 rows/.test(a); }), alerts);
  var v = L.sheetDocs.values(made.id);
  ok("...the new sheet has rows 1 to 100 of the file", v.A1 === "name" && v.B100 === 99 && v.A101 === undefined, [v.A1, v.B100]);
  confirmAnswer = true;
  fileIn = d.querySelector("input[type=file][accept*=csv]");   // the new sheet's own toolbar
  importFile("a,b\n1,2", "small.csv"); await sleep(80);
  var cur = L.store.collection("sheet.docs").get(made.id);
  ok("...and OK replaces the open sheet's cells (no old cells left)", cur && cur.cells.A1 === "a" && cur.cells.B2 === "2" && cur.cells.A3 === undefined, cur && Object.keys(cur.cells).length);

  // --- an empty new sheet is not kept --------------------------------------------------------------
  btn(/Sheets$/).click(); await sleep(20);
  var n0 = L.sheetDocs.list().length;
  btn(/New sheet/).click(); await sleep(20);
  btn(/Sheets$/).click(); await sleep(20);
  ok("+ New sheet, then back with nothing in it: no “Untitled sheet” left behind", L.sheetDocs.list().length === n0, L.sheetDocs.list().length);

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? "SHEET AUDIT FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL SHEET AUDIT TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
