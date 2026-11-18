// sheet_edit.js -- editing in Sheets as in Excel (1.24.25). Adam (2026-11-17): "Anything that is available on
// commercial software should be available on Lantern as much as possible plus more while being easier to use";
// (2026-11-18): "Proceed with the next stage for sheets editing". A range selected (drag, Shift+click,
// Shift+arrows, Select range); copy, cut and paste, from and to Excel's tab-separated text, a formula's references
// moved as Excel moves them ($ kept); fill down and right; undo and redo; rows and columns put in and taken out,
// every formula following (#REF! for a cell taken out); sorting with headings left on top; bold, italic,
// alignment and number formats (Excel's codes), a formula taking its first cell's look; the top row frozen; more
// rows than 100, and past 999.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function td(ref) { return d.querySelector("td[data-ref=" + ref + "]"); }
function bar() { return d.querySelector(".fbar input"); }
function grid() { return d.querySelector(".gridwrap"); }
function mouse(el, type, o) { o = o || {}; el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, shiftKey: !!o.shift, buttons: o.buttons || 0 })); }
function clickCell(ref, o) { mouse(td(ref), "mousedown", o); mouse(td(ref), "mouseup", o); mouse(td(ref), "click", o); }
function key(el, k, o) { o = o || {}; el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl })); }
function typeIn(ref, text) { clickCell(ref); var b = bar(); b.value = text; fire(b, "input"); key(b, "Enter"); }
// a clipboard event as the browser makes one for Ctrl+C, Ctrl+X, Ctrl+V
function clip(type, text) {
  var data = { t: text == null ? "" : text }, e = d.createEvent("Event");
  e.initEvent(type, true, true);
  e.clipboardData = { setData: function (k, v) { data.t = v; }, getData: function () { return data.t; } };
  grid().focus(); grid().dispatchEvent(e);
  return data.t;
}
function cells() { return w.Lantern.sheetDocs ? JSON.parse(JSON.stringify(current().cells)) : null; }
var docId = null;
function current() { return w.Lantern.store.collection("sheet.docs").get(docId); }
function btn(text) { return Array.prototype.filter.call(d.querySelectorAll(".lp-editbar button"), function (b) { return b.textContent === text; })[0]; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, S = L.sheetEdit;
  ok("boot clean", !errs.length, errs);

  // --- references moved as Excel moves them --------------------------------------------------------------------
  ok("a copy two down and one across: A1 is B3, $A$1 stays, A$1 keeps its row, $A1 its column",
    S.shift("=A1+$A$1+A$1+$A1+SUM(A1:B2)", 2, 1) === "=B3+$A$1+B$1+$A3+SUM(B3:C4)", S.shift("=A1+$A$1+A$1+$A1+SUM(A1:B2)", 2, 1));
  ok("...text and function names are left alone (\"A1\", LOG10, ATAN2)", S.shift("=\"A1\"&LOG10(B2)+ATAN2(C3,1)", 1, 0) === "=\"A1\"&LOG10(B3)+ATAN2(C4,1)");
  ok("...off the sheet is #REF!", S.shift("=A1", -1, 0) === "=#REF!" && S.shift("=Z1", 0, 1) === "=#REF!");
  ok("...a whole column moves across: SUM(B:B) to SUM(C:C)", S.shift("=SUM(B:B)", 5, 1) === "=SUM(C:C)");
  ok("two rows put in above row 3: A5 is A7, A2 stays, $A$5 moves too", S.move("=A5+A2+$A$5", "row", 2, 2) === "=A7+A2+$A$7");
  ok("row 3 taken out: A3 is #REF!, A5 is A4, a range round it shrinks", S.move("=A3+A5+SUM(A1:A6)", "row", 2, -1) === "=#REF!+A4+SUM(A1:A5)", S.move("=A3+A5+SUM(A1:A6)", "row", 2, -1));
  ok("a range all taken out is #REF!", S.move("=SUM(A3:A4)", "row", 2, -2) === "=SUM(#REF!)");
  ok("a column put in before B: B1 is C1, SUM(A1:C1) is SUM(A1:D1)", S.move("=B1+SUM(A1:C1)", "col", 1, 1) === "=C1+SUM(A1:D1)");
  ok("Excel's clipboard text: tabs, a quoted cell with a line in it", JSON.stringify(S.parseTSV("a\tb\r\n\x221,2\n3\x22\t4\r\n")) === JSON.stringify([["a", "b"], ["1,2\n3", "4"]]));

  // --- in the grid --------------------------------------------------------------------------------------------
  docId = L.sheetDocs.create("Edit", { A1: "Item", B1: "Qty", C1: "Price", D1: "Total", A2: "rice", B2: "2", C2: "$3.50", D2: "=B2*C2",
    A3: "beans", B3: "5", C3: "$1.20", A4: "oil", B4: "1", C4: "$6.00", E1: "Rate", E2: "10%" });
  w.location.hash = "sheet"; fire(w, "hashchange"); await sleep(80);
  L.sheetDocs.open(docId); await sleep(40);
  ok("the sheet is open with its editing bar", !!td("A1") && !!d.querySelector(".lp-editbar"));
  ok("a formula takes the look of the first cell it names: =B2*C2 of $3.50 shows $7.00", td("D2").textContent === "$7.00", td("D2").textContent);
  // fill down: D2 selected to D4, Ctrl+D
  clickCell("D2"); clickCell("D4", { shift: true });
  ok("Shift+click selects D2:D4 (the name box says so)", d.querySelector(".cellname").textContent === "D2:D4" && td("D3").classList.contains("rsel"));
  key(grid(), "d", { ctrl: true });
  ok("Ctrl+D fills =B2*C2 down as =B3*C3 and =B4*C4", current().cells.D3 === "=B3*C3" && current().cells.D4 === "=B4*C4" && td("D3").textContent === "$6.00", [current().cells.D3, td("D3").textContent]);
  // undo, redo
  key(grid(), "z", { ctrl: true });
  ok("Ctrl+Z takes the fill back", current().cells.D3 == null && current().cells.D4 == null);
  key(grid(), "y", { ctrl: true });
  ok("Ctrl+Y puts it back", current().cells.D4 === "=B4*C4");
  typeIn("A6", "salt");
  key(grid(), "z", { ctrl: true });
  ok("...and a typed cell is undone too", current().cells.A6 == null);
  // copy and paste inside the sheet: D2:D4 to F2
  clickCell("D2"); clickCell("D4", { shift: true });
  var copied = clip("copy");
  ok("copy gives Excel tab-separated text of what is shown", copied === "$7.00\r\n$6.00\r\n$6.00", copied);
  clickCell("F2"); clip("paste", copied);
  ok("pasted two columns across, the formulas move with them: =D2*E2 ... (as Excel)", current().cells.F2 === "=D2*E2" && current().cells.F4 === "=D4*E4", [current().cells.F2, current().cells.F4]);
  key(grid(), "z", { ctrl: true });
  // from Excel: tab-separated text
  clickCell("A8"); clip("paste", "Date\tHours\r\n2026-11-16\t7.5\r\n2026-11-17\t8\r\n");
  ok("text pasted from Excel fills the cells as typed", current().cells.A8 === "Date" && current().cells.B9 === "7.5" && current().cells.A10 === "2026-11-17", cells());
  ok("...and the pasted range stays selected", d.querySelector(".cellname").textContent === "A8:B10");
  // one cell pasted into a range fills it
  clickCell("G2"); clip("copy"); clickCell("G2"); typeIn("G2", "x"); clickCell("G2"); clip("copy"); clickCell("H2"); clickCell("H4", { shift: true }); clip("paste", "x");
  ok("one cell copied, pasted over H2:H4, fills it", current().cells.H2 === "x" && current().cells.H4 === "x");
  // cut moves
  clickCell("H2"); clickCell("H4", { shift: true }); var cut = clip("cut");
  ok("a cut leaves the cells until they are pasted, as in Excel", current().cells.H2 === "x");
  clickCell("I2"); clip("paste", cut);
  ok("...and paste moves them where chosen", current().cells.I2 === "x" && current().cells.I4 === "x" && current().cells.H2 == null);
  clickCell("K2"); clip("paste", cut);
  ok("...once: a second paste of the cut puts nothing", current().cells.K2 == null);
  // Shift+arrows, Delete on a range
  clickCell("I2"); key(grid(), "ArrowDown", { shift: true }); key(grid(), "ArrowDown", { shift: true });
  ok("Shift+arrows grow the range", d.querySelector(".cellname").textContent === "I2:I4");
  key(grid(), "Delete");
  ok("Delete empties the range", current().cells.I2 == null && current().cells.I4 == null && current().cells.G2 === "x");
  // drag
  mouse(td("A2"), "mousedown", { buttons: 1 }); mouse(td("B2"), "mouseover", { buttons: 1 }); mouse(td("B3"), "mouseover", { buttons: 1 }); mouse(td("B3"), "mouseup"); mouse(td("B3"), "click");
  ok("dragging from A2 to B3 selects A2:B3", d.querySelector(".cellname").textContent === "A2:B3", d.querySelector(".cellname").textContent);
  // on a phone: tap A2, Select range, tap B3, Copy -- the next tap chooses where to paste, it does not grow the range
  clickCell("A2"); btn("Select range").click(); clickCell("B3");
  ok("Select range, then a tap: A2:B3, A2 still the active cell", d.querySelector(".cellname").textContent === "A2:B3" && L.sheetEdit.active() === "A2");
  btn("Copy").click(); clickCell("D12");
  ok("...after Copy, Select range is off: the tap on D12 chooses D12 alone", d.querySelector(".cellname").textContent === "D12" && !btn("Select range").className);
  btn("Paste").click(); await sleep(10);
  ok("...and Paste puts the two by two block there, nothing else touched", current().cells.D12 === "rice" && current().cells.E13 === "5" && current().cells.A2 === "rice" && current().cells.B2 === "2", [current().cells.D12, current().cells.E13]);
  key(grid(), "z", { ctrl: true });
  // the clipboard in a browser keeps kinds: Lantern marks its own copy, so the same text from another program is text
  function clipKinds(type, box) {
    var e = d.createEvent("Event"); e.initEvent(type, true, true);
    e.clipboardData = { types: box.types, setData: function (k, v) { box.data[k] = v; if (box.types.indexOf(k) < 0) box.types.push(k); }, getData: function (k) { return box.data[k] || ""; } };
    grid().focus(); grid().dispatchEvent(e);
  }
  var box = { data: {}, types: [] };
  clickCell("D2"); clipKinds("copy", box);
  ok("a copy puts Excel's text and Lantern's mark on the clipboard", box.data["text/plain"] === "$7.00" && box.types.length === 2, box);
  clickCell("G20"); clipKinds("paste", box);
  ok("...pasted with its mark: the formula, moved", current().cells.G20 === "=E20*F20", current().cells.G20);
  var other = { data: { "text/plain": "$7.00" }, types: ["text/plain"] };
  clickCell("G21"); clipKinds("paste", other);
  ok("...the same text with no mark (copied in another program) is pasted as text", current().cells.G21 === "$7.00", current().cells.G21);
  key(grid(), "z", { ctrl: true }); key(grid(), "z", { ctrl: true });
  // Ctrl+A keeps the active cell; Enter inside a range moves through it
  clickCell("B3"); key(grid(), "a", { ctrl: true });
  ok("Ctrl+A selects the table round B3 and B3 stays the active cell", /^A1:/.test(d.querySelector(".cellname").textContent) && L.sheetEdit.active() === "B3", [d.querySelector(".cellname").textContent, L.sheetEdit.active()]);
  clickCell("H2"); clickCell("I3", { shift: true }); key(grid(), "Enter"); 
  ok("Enter inside H2:I3 moves to H3, the range kept", L.sheetEdit.active() === "H3" && d.querySelector(".cellname").textContent === "H2:I3");
  key(grid(), "Enter");
  ok("...then to the top of the next column, I2", L.sheetEdit.active() === "I2");
  // bold, number format
  clickCell("A1"); clickCell("E1", { shift: true });
  key(grid(), "b", { ctrl: true });
  ok("Ctrl+B makes the headings bold", current().fmt && current().fmt.A1 && current().fmt.A1.b === 1 && td("C1").style.fontWeight === "700");
  typeIn("J2", "2"); typeIn("J3", "1234.5"); clickCell("J2"); clickCell("J3", { shift: true });
  var pick = d.querySelector(".lp-editbar select[aria-label='Number format']");
  pick.value = "#,##0.00"; fire(pick, "change");
  ok("a number format shows 2 as 2.00 and 1234.5 as 1,234.50", td("J2").textContent === "2.00" && td("J3").textContent === "1,234.50", [td("J2").textContent, td("J3").textContent]);
  btn(".0" + String.fromCharCode(0x2190)).click();
  ok("fewer decimals: 2.0", td("J2").textContent === "2.0", td("J2").textContent);
  clickCell("E2"); pick.value = "0.0%"; fire(pick, "change");
  ok("per cent: 10.0%", td("E2").textContent === "10.0%", td("E2").textContent);
  // sort by price, headings left on top
  clickCell("C3");
  btn("Sort Z" + String.fromCharCode(0x2192) + "A").click();
  ok("Sort Z to A by Price keeps the headings and moves the rows with their formulas",
    current().cells.A1 === "Item" && current().cells.A2 === "oil" && current().cells.A4 === "beans" && current().cells.D2 === "=B2*C2" && td("D2").textContent === "$6.00",
    [current().cells.A2, current().cells.A3, current().cells.A4, current().cells.D2, td("D2").textContent]);
  // insert and delete a row
  var menu = d.querySelector(".lp-editbar select[aria-label='Rows and columns']");
  typeIn("D6", "=SUM(D2:D4)");
  var before = td("D6").textContent;
  clickCell("A3"); menu.value = "rowAbove"; fire(menu, "change");
  ok("a row put in above row 3: the total is =SUM(D2:D5) in D7, the same number", current().cells.D7 === "=SUM(D2:D5)" && td("D7").textContent === before, [current().cells.D7, td("D7").textContent, before]);
  clickCell("A3"); menu.value = "rowDel"; fire(menu, "change");
  ok("...and taken out again: =SUM(D2:D4) in D6", current().cells.D6 === "=SUM(D2:D4)");
  clickCell("A2"); menu.value = "rowDel"; fire(menu, "change");
  ok("a row a formula names taken out: its total shrinks, D3's own row moves up", current().cells.D5 === "=SUM(D2:D3)" && current().cells.D2 === "=B2*C2", [current().cells.D5, current().cells.D2]);
  key(grid(), "z", { ctrl: true });
  // columns
  clickCell("B1"); menu.value = "colLeft"; fire(menu, "change");
  ok("a column put in left of B: Qty is in C, D's formula reads =C2*D2 in E2", current().cells.C1 === "Qty" && current().cells.E2 === "=C2*D2", [current().cells.C1, current().cells.E2]);
  key(grid(), "z", { ctrl: true });
  ok("...undone", current().cells.B1 === "Qty");
  // freeze, more rows
  var fr = Array.prototype.filter.call(d.querySelectorAll(".lp-editbar input[type=checkbox]"), function () { return true; })[0];
  fr.checked = true; fire(fr, "change");
  ok("Freeze top row", current().freeze === 1 && d.querySelector("table.grid").classList.contains("frz1"));
  menu.value = "more"; fire(menu, "change");
  ok("100 more rows: row 200 is there", !!td("A200") && current().rows === 200);
  ok("past row 999 in a formula: =A1200", L.sheetDocs.compute({ A1200: "7", B1: "=A1200*2" }).B1 === 14);
  // paste past the last row grows the sheet
  clickCell("A199"); clip("paste", "1\n2\n3\n4\n5");
  ok("a paste past the last row adds rows", !!td("A203") && current().cells.A203 === "5");
  ok("no errors in the page", !errs.length, errs);
  console.log(fails ? fails + " SHEET EDIT FAILURES (" + passes + " passed)" : "ALL SHEET EDIT CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
