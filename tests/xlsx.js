// xlsx.js -- Excel files (.xlsx) in Sheets (1.24.28). Adam (2026-11-18), after a .csv lost his formulas: "we need to
// keep the excel formula as it works in excel and lantern"; then (2026-11-19) .xlsx in Sheets is the next version.
// An Excel workbook read as sheets (XLSX_READ) from files written in Excel's own form, by openpyxl, by LibreOffice,
// in the 1904 date system, in the Strict names, with inline text, and past Z and row 2000 (tests/fixtures/xlsx,
// made by make.py there); a sheet written as a workbook (XLSX_WRITE) and read back as it was; each formula as
// Excel's grammar reads it; Excel's order of minus and power in a sheet (FORMULA, ctx.excel); widths and merged
// cells on the grid (SHEET_LAYOUT), moved with their rows, kept by undo, and not torn by a sort (SHEET_ROWS,
// SHEET_EDIT); Import file and Save .xlsx in Sheets (SHEET_XLSX, SHEET_CSV); Save .xlsx beside MAKE SHEET's Open in
// Sheets, and the bench's two Excel questions (AI_SHEET, AI_MAKE_BENCH_DATA).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FX = path.join(__dirname, "fixtures", "xlsx");
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, alerts = [];
w.alert = function (m) { alerts.push(String(m)); }; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function key(el, k, o) { o = o || {}; el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl })); }
function u8(buf) { var a = new w.Uint8Array(buf.length); for (var i = 0; i < buf.length; i++) a[i] = buf[i]; return a; }
function file(name) { return u8(fs.readFileSync(path.join(FX, name))); }
function has(list, re) { return list.some(function (t) { return re.test(t); }); }
w.eval(js);

(async function () {
  var L = w.Lantern, X = L.xlsx;
  ok("the modules are there", X && X.read && X.write && X.excelFormula && L.sheetXlsx && L.sheetLayout && L.formula.all);

  // --- Excel's order of operations in a sheet; the calculator keeps the order on paper ---
  var v = L.sheetDocs.compute({ A1: "=-2^2", A2: "=2^3^2", A3: "=2^-1", A4: "=-2^-2", A5: "=-(2^2)", A6: "=3-2^2", B1: "3", A7: "=-B1^2", A8: "=2^3*2" });
  ok("a sheet: =-2^2 is 4 and =2^3^2 is 64, as in Excel, LibreOffice and Google Sheets", v.A1 === 4 && v.A2 === 64, [v.A1, v.A2]);
  ok("...=2^-1 is 0.5, =-2^-2 is 0.25, =-(2^2) is -4, =3-2^2 is -1, =-B1^2 is 9, =2^3*2 is 16", v.A3 === 0.5 && v.A4 === 0.25 && v.A5 === -4 && v.A6 === -1 && v.A7 === 9 && v.A8 === 16, v);
  ok("the calculator keeps -2^2 = -4 and 2^3^2 = 512, as on paper", L.formula.evaluate("-2^2", {}) === -4 && L.formula.evaluate("2^3^2", {}) === 512);
  var all = L.formula.all();
  ok("Lantern.formula.all names the built-in functions too (SUM, IF) and the others (VOLTS)", all.indexOf("SUM") >= 0 && all.indexOf("IF") >= 0 && all.indexOf("VOLTS") >= 0 && all.length > L.formula.names().length);

  // --- reading: Excel's own form ---
  var r = X.read(file("excel_form.xlsx"), "excel_form.xlsx"), s = r.sheets[0], c = s.cells;
  ok("Excel's form: one sheet, named after the file", r.sheets.length === 1 && s.title === "excel_form" && s.name === "Sheet1", [r.sheets.length, s.title]);
  ok("...the words and numbers (shared text, numbers as written)", c.C1 === "Paint for two rooms" && c.A3 === "Hall" && c.B3 === "15" && c.F4 === "0.5" && c.D6 === "100", c);
  ok("...a shared formula written out in each cell, as Excel shows it", c.G3 === "=D3*F3" && c.G4 === "=D4*F4" && c.G5 === "=D5*F5" && c.G6 === "=D6*F6", [c.G4, c.G5, c.G6]);
  ok("...SUM kept, _xlfn. left out of CONCAT", c.D7 === "=SUM(D3:D6)" && c.B8 === "=CONCAT(A3,\" and \",A4)", [c.D7, c.B8]);
  ok("...=-2^2 and =2^3^2 as written; the sheet's own name left out of Sheet1!D8", c.C8 === "=-2^2" && c.A10 === "=2^3^2" && c.B10 === "=D8*4", [c.C8, c.A10, c.B10]);
  ok("...TRUE, #N/A, and 00123 kept as text ('00123)", c.D8 === "TRUE" && c.E8 === "#N/A" && c.F8 === "\x2700123", [c.D8, c.E8, c.F8]);
  ok("...the name Rate written as the cell it names", c.D9 === "=$F$9" && c.E9 === "=D5*(1+$F$9)", [c.D9, c.E9]);
  ok("...rich text kept as its words", c.A9 === "Bold and plain", c.A9);
  var f = s.fmt;
  ok("...the merged title centred, its covered cells too", f.C1 && f.C1.al === "center" && f.D1 && f.D1.al === "center", [f.C1, f.D1]);
  ok("...a formula's General said, so no look is carried to it (G4 is 90, not 9000%)", f.G4 && f.G4.nf === "General" && f.G3.nf === "General" && f.D7.nf === "#,##0.00", [f.G4, f.D7]);
  ok("...the headings bold", f.A2 && f.A2.b && f.G2 && f.G2.b, f.A2);
  ok("...number formats as Excel codes: a custom one, per cent, the short date, #,##0.00 bold on the right", f.B3 && f.B3.nf === "0.0\" ft\"" && f.F3.nf === "0%" && f.A8.nf === "m/d/yyyy" &&
    f.D7.nf === "#,##0.00" && f.D7.b && f.D7.al === "right", [f.B3, f.F3, f.A8, f.D7]);
  ok("...a text format (@) is not kept as a format; the cell is text by its apostrophe", !(f.F8 && f.F8.nf), f.F8);
  ok("...column widths as Excel has them, the hidden one too", s.widths.A === 15.28515625 && s.widths.F === 12.42578125 && s.widths.H === 9.140625 && !s.widths.B, s.widths);
  ok("...the merged cells and the frozen top row", JSON.stringify(s.merges) === "[\"C1:E1\"]" && s.freeze === 1 && s.rows === 100, [s.merges, s.freeze, s.rows]);
  ok("...the paper: Letter, upright, Excel's 0.7 inch margin as Sheets' nearest (0.75)", s.paper && s.paper.size === "letter" && s.paper.orient === "p" && s.paper.margin === 0.75 && s.paper.scale === 100, s.paper);
  var n = r.notes;
  ok("...the notes: colours and borders, wrapped text, hidden rows and columns, the name, rich text", has(n, /^Colours, borders, fonts/) && has(n, /wrapped/) && has(n, /^Hidden rows and columns/) &&
    has(n, /The name Rate is written as \$F\$9/) && has(n, /^Bold or coloured words inside a cell/), n);
  ok("...nothing worked out differently from what Excel saved (=-2^2 is 4, TRUE*4 is 4)", !has(n, /differently/), n);
  ok("...and no function Lantern does not have", !has(n, /does not have/), n);

  // --- another sheet, a hidden one, a chart sheet ---
  r = X.read(file("workbook2.xlsx"), "workbook2.xlsx");
  ok("three sheets: each a sheet of its own, the hidden one too; the chart sheet left out", r.sheets.length === 3 && r.sheets.map(function (x) { return x.title; }).join("|") === "workbook2 — Prices|workbook2 — Order|workbook2 — Rates", r.sheets.map(function (x) { return x.title; }));
  ok("...the notes say so", has(r.notes, /^Each of the workbook’s 3 sheets/) && has(r.notes, /chart sheet “Chart1” is left out/) && has(r.notes, /“Rates” was hidden/), r.notes);
  // (1.24.28, the first review) a formula that uses another sheet is worked out from it, as Excel does: C2 is 30 here too
  ok("...a formula from another sheet kept as written, and worked out from the other sheets as Excel did (no note for C2)", r.sheets[1].cells.C2 === "=B2*Prices!B2*(1+\x27Rates\x27!B1)" && !has(r.notes, /C2 \(Excel/) &&
    L.sheetDocs.compute(r.sheets[1].cells, { Prices: r.sheets[0].cells, Order: r.sheets[1].cells, Rates: r.sheets[2].cells }, "Order").C2 === 30, [r.sheets[1].cells.C2, r.notes]);
  ok("...a formula of its own sheet worked out as Excel did (no note for C3)", !has(r.notes, /C3 \(Excel/), r.notes);

  // --- the 1904 dates, Strict, inline text, past Z and row 2000 ---
  r = X.read(file("date1904.xlsx"), "date1904.xlsx"); s = r.sheets[0];
  ok("1904 dates: a date is moved to the 1900 count (2026-11-17 is 46343); a number of days is not", s.cells.A1 === "46343" && s.cells.B1 === "1.5" && s.cells.C1 === "=B1/2" && s.fmt.A1.nf === "m/d/yyyy", [s.cells, s.fmt.A1]);
  r = X.read(file("strict.xlsx"), "strict.xlsx"); s = r.sheets[0];
  ok("the Strict names read", s.name === "Strict" && s.cells.A1 === "Strict" && s.cells.C1 === "=B1*21" && !r.notes.length, [s.cells, r.notes]);
  r = X.read(file("inline.xlsx"), "inline.xlsx"); s = r.sheets[0];
  ok("inline text, cells without a reference, _x000D_, 1E-3, a date as a date (t=d)", s.cells.A1 === "Name" && s.cells.B1 === "Joined" && s.cells.A2 === "Ann\r" && s.cells.B2 === "=A2&\"!\"" && s.cells.C2 === "0.001" &&
    s.cells.D2 === "46343" && s.fmt.D2 && s.fmt.D2.nf === "yyyy-mm-dd", [s.cells, s.fmt]);
  r = X.read(file("big.xlsx"), "big.xlsx"); s = r.sheets[0];
  ok("past Z and past row 2000: left out, and said", s.cells.Z1 === "26" && !s.cells.AA1 && s.cells.A2000 === "2000" && !s.cells.A2001 && s.rows === 2000 &&
    has(r.notes, /^2 cells past column Z are left out/) && has(r.notes, /^3 cells past row 2000 are left out/), [s.rows, r.notes]);

  // --- other programs' files ---
  r = X.read(file("openpyxl.xlsx"), "openpyxl.xlsx"); s = r.sheets[0];
  ok("openpyxl's file: formulas, bold, money, alignment, width, merge, freeze", s.cells.D2 === "=B2*C2" && s.cells.D4 === "=SUM(D2:D3)" && s.fmt.A1.b && s.fmt.C2.nf === "\"$\"#,##0.00" &&
    s.fmt.A4.al === "right" && s.widths.A === 20 && s.merges.join() === "A6:D6" && s.freeze === 1, [s.cells, s.fmt.C2, s.widths, s.merges]);
  r = X.read(file("libreoffice.xlsx"), "libreoffice.xlsx"); s = r.sheets[0];
  ok("LibreOffice's file: the merged title, dates, money, formulas", s.merges.join() === "A1:D1" && s.fmt.A1.al === "center" && s.fmt.A1.i && s.cells.D3 === "=B3*C3" &&
    s.cells.C5 === "=ROUND(D5/B5,3)" && /^=DAYS\(A4,A3\)$/.test(s.cells.B6) && /^=IFS\(/i.test(s.cells.C6) && /y/.test(s.fmt.A3.nf) && /\$|\[\$/.test(s.fmt.C3.nf), [s.cells, s.fmt.A3, s.fmt.C3]);
  ok("...worked out as LibreOffice did", !has(r.notes, /differently/), r.notes);
  // what is not an Excel workbook
  function err(bytes, name) { try { X.read(bytes, name); return ""; } catch (e) { return e.message; } }
  ok("a Word file is turned away, and told where it opens", /Word document.*Writer/.test(err(u8(fs.readFileSync(path.join(__dirname, "fixtures", "docx", "pydocx.docx"))), "a.docx")));
  ok("so is a file that is not a zip", /not a zip/.test(err(u8(Buffer.from("Name,Qty\nBolts,3\n")), "a.xlsx")));

  // --- Excel's grammar ---
  function EF(f) { return X.excelFormula(f); }
  [["SUM(A1:A3)", "SUM(A1:A3)"], ["CONCAT(A1,A2)", "_xlfn.CONCAT(A1,A2)"], ["FILTER(A1:A3,B1:B3>2)", "_xlfn._xlws.FILTER(A1:A3,B1:B3>2)"], ["XLOOKUP(5,A1:A3,B1:B3)", "_xlfn.XLOOKUP(5,A1:A3,B1:B3)"],
    ["IF(A1,,2)", "IF(A1,,2)"], ["NOW()", "NOW()"], ["A1%", "A1%"], ["50%*A1", "50%*A1"], ["PI*2", "PI()*2"], ["E^2", "EXP(1)^2"], ["SUM(A1:A2 A2:A3)", "SUM(A1:A2 A2:A3)"],
    ["Rates!B2*2", "Rates!B2*2"], ["\x27Tax 2026\x27!B2", "\x27Tax 2026\x27!B2"], ["{1,2;3,4}", "{1,2;3,4}"], ["\"a\"\"b\"&\"c\"", "\"a\"\"b\"&\"c\""], ["-A1^2", "-A1^2"], ["SUM (A1:A3)", "SUM(A1:A3)"],
    ["Table1[Price]*2", "Table1[Price]*2"], ["#N/A", "#N/A"], ["A:A", "A:A"], ["1:3", "1:3"], ["$A$1:$B$2", "$A$1:$B$2"], ["TRUE+1", "TRUE+1"], ["A1>=2", "A1>=2"], ["A1<>2", "A1<>2"], ["VOLTS(2,3)", "VOLTS(2,3)"]
  ].forEach(function (p) { var e = EF(p[0]); ok("Excel reads " + p[0], e.ok && e.f === p[1], e); });
  ["17%5", "(1+2", "SUM(A1:A2", "2(3)", "A1=>2", "A1==2", "A1!=2", "ANS+1", "3 4", "2A1", "SUM(A1:A2)+", "\"open", "1,5", "A1)"].forEach(function (f2) { var e = EF(f2); ok("Excel cannot read " + f2, !e.ok && e.why, e); });
  ok("a function Excel does not have is named", EF("VOLTS(2,3)*WATTS(1,2)").lantern.join() === "VOLTS,WATTS");

  // --- writing, and reading back ---
  var src = X.read(file("excel_form.xlsx"), "excel_form.xlsx").sheets[0], vals = L.sheetDocs.compute(src.cells);
  var out = X.write({ title: "Paint", cells: src.cells, fmt: src.fmt, widths: src.widths, merges: src.merges, freeze: src.freeze, paper: { size: "a4", orient: "l", margin: 0.5, scale: 80 } }, vals, function (raw) { return L.sheetDocs.logical(raw, src.cells); }, function (raw) { return L.sheetFormat.carried(src, raw); });
  var z = L.zip.read(out.bytes), back = X.read(out.bytes, "Paint.xlsx"), b = back.sheets[0];
  ok("written: the parts of a workbook", ["[Content_Types].xml", "_rels\x2F.rels", "xl\x2Fworkbook.xml", "xl\x2F_rels\x2Fworkbook.xml.rels", "xl\x2Fworksheets\x2Fsheet1.xml", "xl\x2Fstyles.xml", "xl\x2FsharedStrings.xml", "docProps\x2Fcore.xml", "docProps\x2Fapp.xml"].every(function (p) { return z.has(p); }), z.names);
  ok("...read back: every cell as it was", JSON.stringify(b.cells) === JSON.stringify(src.cells), { a: src.cells, b: b.cells });
  ok("...its paper: A4 sideways, half an inch, 80%", b.paper.size === "a4" && b.paper.orient === "l" && b.paper.margin === 0.5 && b.paper.scale === 80, b.paper);
  ok("...its looks, widths, merged cells and frozen row", JSON.stringify(b.fmt) === JSON.stringify(src.fmt) && b.widths.A === 15.285156 && b.widths.H === 9.140625 && b.merges.join() === "C1:E1" && b.freeze === 1, [b.fmt, b.widths]);
  ok("...no notes either way (Excel has every function, reads every formula)", !out.notes.length && !back.notes.length, [out.notes, back.notes]);
  var sx = z.text("xl\x2Fworksheets\x2Fsheet1.xml"), wx = z.text("xl\x2Fworkbook.xml");
  ok("...the formulas with Lantern's values saved beside them, CONCAT as Excel writes it", /<c r="G4"><f>D4\*F4<\/f><v>90<\/v><\/c>/.test(sx) && /<f>_xlfn.CONCAT\(A3,&quot;|<f>_xlfn.CONCAT\(A3," and ",A4\)<\/f><v>Hall and Kitchen<\/v>/.test(sx) && /<c r="C8"><f>-2\^2<\/f><v>4<\/v>/.test(sx), sx.slice(0, 2000));
  ok("...TRUE, #N/A and '00123 as Excel's own kinds of cell", /<c r="D8" t="b"><v>1<\/v><\/c>/.test(sx) && /<c r="E8" t="e"><v>#N\/A<\/v><\/c>/.test(sx) && /<c r="F8" s="\d+" t="s">/.test(sx));
  ok("...Excel asked to work the formulas out when it opens the file; the frozen pane, the widths, the merge", /fullCalcOnLoad="1"/.test(wx) && /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(sx) &&
    /<col min="1" max="1" width="15.285156" customWidth="1"\/>/.test(sx) && /<mergeCells count="1"><mergeCell ref="C1:E1"\/><\/mergeCells>/.test(sx));
  ok("...the parts of a sheet in the order Excel's schema wants", /<dimension[^>]*\/><sheetViews>.*<\/sheetViews><sheetFormatPr[^>]*\/><cols>.*<\/cols><sheetData>.*<\/sheetData><mergeCells.*<\/mergeCells><pageMargins[^>]*\/><pageSetup paperSize="9" scale="80" orientation="landscape"\/><\/worksheet>$/.test(sx), sx.slice(-300));
  // a sheet of Lantern's own
  var mine = { title: "Lantern's own: 1/2", cells: { A1: "Volts", B1: "=VOLTS(2,3)", A2: "Left", B2: "=17%5", A3: "$3.50", B3: "=A3*2", A4: "12%", A5: "=pi*2", A6: "2026-11-17", A7: "=(1+2" }, fmt: { A1: { b: 1 } } };
  var mv = L.sheetDocs.compute(mine.cells), mo = X.write(mine, mv, null, function (raw) { return L.sheetFormat.carried(mine, raw); });
  var mz = L.zip.read(mo.bytes), mx = mz.text("xl\x2Fworksheets\x2Fsheet1.xml"), ms = mz.text("xl\x2Fstyles.xml"), mb = X.read(mo.bytes, "x.xlsx").sheets[0];
  ok("Lantern's own: VOLTS kept and named in the notes", /<f>VOLTS\(2,3\)<\/f>/.test(mx) && has(mo.notes, /^Excel does not have Lantern’s VOLTS \(B1\)/), mo.notes);
  ok("...17%5 and (1+2 saved as their text, and said", /<c r="B2" t="s">/.test(mx) && has(mo.notes, /Saved as text, not as a formula.*B2 \(% between two values/) && has(mo.notes, /A7 \(a “\(” is not closed\)/) && mb.cells.B2 === "\x27=17%5", [mo.notes, mb.cells.B2]);
  ok("...pi as Excel's PI()", /<f>PI\(\)\*2<\/f>/.test(mx));
  ok("...$3.50 typed is money, and a formula from it too; 12% is per cent", /formatCode="\$#,##0.00"/.test(ms) && mb.fmt.A3 && mb.fmt.A3.nf === "$#,##0.00" && mb.fmt.B3 && mb.fmt.B3.nf === "$#,##0.00" && mb.fmt.A4 && mb.fmt.A4.nf === "0%" && mb.cells.A4 === "0.12", [mb.fmt, mb.cells.A4]);
  ok("...the sheet's name has no / (Excel will not have one): the title has it as a space", /<sheet name="Lantern&apos;s own: 1 2"|<sheet name="Lantern's own  1 2"|<sheet name="Lantern's own 1 2"/.test(mz.text("xl\x2Fworkbook.xml")), mz.text("xl\x2Fworkbook.xml"));
  ok("...and the file's name has none either", X.fileName("a/b: c") === "a b c.xlsx", X.fileName("a/b: c"));

  // --- in Sheets ---
  go("sheet"); await sleep(60);
  var lib = d.querySelector("#app") || d.body;
  ok("the list of sheets has Import file", Array.prototype.some.call(d.querySelectorAll("button"), function (x) { return x.textContent === "Import file"; }));
  L.sheetXlsx.open(new w.File([fs.readFileSync(path.join(FX, "excel_form.xlsx"))], "excel_form.xlsx")); await sleep(150);
  var note = d.querySelector(".lp-xlsx-note");
  ok("Import file opens it as a sheet, with a note above the grid", note && /Opened from the Excel file “excel_form.xlsx”/.test(note.textContent) && /Colours, borders/.test(note.textContent), note && note.textContent);
  function tdOf(ref) { return d.querySelector("td[data-ref=" + ref + "]"); }
  ok("...the title across C1:E1, D1 and E1 passed over", tdOf("C1").colSpan === 3 && tdOf("D1").style.display === "none" && tdOf("E1").style.display === "none" && tdOf("C1").textContent === "Paint for two rooms", [tdOf("C1").colSpan, tdOf("D1").style.display]);
  var css = (d.getElementById("lp-sheet-widths") || {}).textContent || "";
  ok("...column A 112 pixels wide (15.29 characters), F 92", /nth-child\(2\)\{width:112px/.test(css) && /nth-child\(7\)\{width:92px/.test(css), css);
  ok("...G4 shows 90, worked out by the sheet", tdOf("G4").textContent === "90", tdOf("G4").textContent);
  ok("...C8 shows 4 (=-2^2), A10 64", tdOf("C8").textContent === "4" && tdOf("A10").textContent === "64", [tdOf("C8").textContent, tdOf("A10").textContent]);
  var grid = d.querySelector(".gridwrap"), name = function () { return d.querySelector(".cellname").textContent; };
  function click(ref) { var t = tdOf(ref); ["mousedown", "mouseup", "click"].forEach(function (k) { t.dispatchEvent(new w.MouseEvent(k, { bubbles: true, cancelable: true })); }); }
  click("B1"); key(grid, "ArrowRight");
  ok("an arrow into the merged cell goes to it", name() === "C1", name());
  key(grid, "ArrowRight");
  ok("...and on from it, past the cells it covers", name() === "F1", name());
  key(grid, "ArrowLeft");
  ok("...and back to it from the right", name() === "C1", name());
  click("D2"); key(grid, "ArrowUp");
  ok("...from below a covered cell too", name() === "C1", name());
  var S = L.sheetEdit, doc = function () { var id = L.sheetDocs.list().filter(function (x) { return x.title === "excel_form"; })[0].id; return L.store.collection("sheet.docs").get(id); };
  click("A1"); S.rowAct("rowAbove"); await sleep(20);
  ok("a row put in above: the merged cell moves down with its row", doc().merges.join() === "C2:E2" && tdOf("C2").colSpan === 3 && tdOf("C1").colSpan === 1, doc().merges);
  key(grid, "z", { ctrl: true }); await sleep(20);
  ok("...undo puts it back", doc().merges.join() === "C1:E1" && tdOf("C1").colSpan === 3, doc().merges);
  click("B1"); S.rowAct("colLeft"); await sleep(20);
  ok("a column put in left of it: the merge moves right and widens nothing; widths move with their columns", doc().merges.join() === "D1:F1" && doc().widths.A === 15.28515625 && doc().widths.G === 12.42578125 && !doc().widths.F, [doc().merges, doc().widths]);
  key(grid, "z", { ctrl: true }); await sleep(20);
  // (1.24.28, the first review) the merged cell selected is all its columns, as in Excel: three put in before it
  click("C1"); S.rowAct("colLeft"); await sleep(20);
  ok("...the merged cell itself selected: as many columns put in as it covers, as in Excel", doc().merges.join() === "F1:H1" && doc().widths.I === 12.42578125, [doc().merges, doc().widths]);
  key(grid, "z", { ctrl: true }); await sleep(20);
  click("D3"); S.rowAct("rowAbove"); await sleep(20);
  ok("a row put in inside a tall merge grows it (none here: C1:E1 is one row, and stays)", doc().merges.join() === "C1:E1", doc().merges);
  key(grid, "z", { ctrl: true }); await sleep(20);
  // a sort that would move a merged cell is refused (Excel: "all the merged cells need to be the same size")
  var sd = { cells: { A1: "b", B1: "x", A2: "a", B2: "y", A3: "c" }, merges: ["A1:B1"] }, before = JSON.stringify(sd.cells);
  ok("a sort over rows with a merged cell is refused, as Excel refuses it", L.sheetRows.sort(sd, { c0: 0, r0: 0, c1: 1, r1: 2 }, 0, false, false, L.sheetDocs.compute(sd.cells)) === false && JSON.stringify(sd.cells) === before, sd.cells);
  sd = { cells: { A1: "Name", B1: "Age", A2: "b", A3: "a" }, merges: ["A1:B1"] };
  L.sheetRows.sort(sd, { c0: 0, r0: 0, c1: 1, r1: 2 }, 0, false, true, L.sheetDocs.compute(sd.cells));
  ok("...a merged heading above the rows sorted is no matter", sd.cells.A2 === "a" && sd.cells.A3 === "b", sd.cells);
  var saved = [], realDl = L.download;
  L.download = function (n, data, type) { saved.push({ name: n, data: data, type: type }); };
  var sx2 = Array.prototype.filter.call(d.querySelectorAll("button"), function (x) { return x.textContent === "Save .xlsx"; })[0];
  ok("Save .xlsx is in the sheet's toolbar", !!sx2);
  sx2.click(); await sleep(20);
  ok("...it saves excel_form.xlsx, an Excel workbook", saved.length === 1 && saved[0].name === "excel_form.xlsx" && /spreadsheetml.sheet$/.test(saved[0].type), saved.map(function (x) { return x.name; }));
  var again = saved[0] && X.read(saved[0].data, "x.xlsx").sheets[0];
  ok("...with the sheet in it as it is: formulas, merge, widths", again && again.cells.G5 === "=D5*F5" && again.merges.join() === "C1:E1" && again.widths.A > 15, again && again.cells.G5);
  // the toolbar's Import file opens a .csv into the sheet as before, and an Excel file as new sheets
  var fi = d.querySelector("input[type=file][accept*=xlsx]"), n0 = L.sheetDocs.list().length;
  Object.defineProperty(fi, "files", { value: [new w.File([fs.readFileSync(path.join(FX, "workbook2.xlsx"))], "workbook2.xlsx")], configurable: true }); fire(fi, "change"); await sleep(150);
  ok("the sheet's Import file opens a workbook as new sheets (3), the first shown", L.sheetDocs.list().length === n0 + 3 && d.querySelector("input[placeholder='Sheet name']").value === "workbook2 — Prices", [L.sheetDocs.list().length - n0, d.querySelector("input[placeholder='Sheet name']").value]);
  alerts.length = 0;
  L.sheetXlsx.open(new w.File(["not a workbook"], "broken.xlsx")); await sleep(100);
  ok("a damaged file: said in plain words, nothing made", alerts.length === 1 && /Lantern could not open “broken.xlsx”: this is not a zip file/.test(alerts[0]), alerts);

  // --- MAKE SHEET, and the bench ---
  var act = L.aiAct, sheetAct = L.aiActions.filter(function (a) { return a.id === "sheet"; })[0];
  ok("MAKE SHEET says Save .xlsx makes an Excel file, and is offered for an Excel file asked for", /Save \.xlsx/.test(sheetAct.prompt[0]) && /Excel file/.test(sheetAct.also) &&
    act.relevant("Make me an Excel spreadsheet of my costs").some(function (a) { return a.id === "sheet"; }), sheetAct.prompt[0]);
  var made = act.build("MAKE SHEET: Costs\nItem | Cost\nRent | 120\nFood | 85.50\nTotal | =SUM(B2:B3)\nEND", "");
  var plan = made && (made.plan || made), extra = (made.extra || (plan && plan.extra) || []);
  ok("...its preview has Save .xlsx", extra.some(function (x) { return x.label === "Save .xlsx"; }), extra.map(function (x) { return x.label; }));
  saved.length = 0;
  extra.filter(function (x) { return x.label === "Save .xlsx"; })[0].run(); await sleep(10);
  var ab = saved[0] && X.read(saved[0].data, "c.xlsx").sheets[0];
  ok("...which saves the table with its formula", ab && ab.cells.B4 === "=SUM(B2:B3)" && ab.cells.B3 === "85.5" && saved[0].name === "Costs.xlsx", ab && ab.cells);
  L.download = realDl;
  function grade(qs, id) { var item = qs.filter(function (q) { return q.id === id; })[0]; return item ? L.aiBench.grade(item, item.ideal, { made: act.build(item.ideal, item.q) }) : { pass: false, why: "no question " + id }; }
  ["make-sheet-excel"].forEach(function (id) { var g = grade(L.aiBenchQuestions, id); ok("bench: the ideal reply passes " + id, g.pass, g.why); });
  ["make-sheet-excel-b"].forEach(function (id) { var g = grade(L.aiBenchQuestionsB, id); ok("bench: the ideal reply passes " + id, g.pass, g.why); });
  var item = L.aiBenchQuestions.filter(function (q) { return q.id === "make-sheet-excel"; })[0];
  var g2 = L.aiBench.grade(item, "MAKE SHEET: Job\nItem | Cost\nLabour | 75\nParts | 40\nTravel | 12\nTotal | 127\nEND", { made: act.build("MAKE SHEET: Job\nItem | Cost\nLabour | 75\nParts | 40\nTravel | 12\nTotal | 127\nEND", item.q) });
  ok("bench: a table with no formulas fails make-sheet-excel", !g2.pass && /no formulas/.test(g2.why), g2.why);

  // --- the first review's mends (1.24.28; tests/review_xlsx_1268.py replays the review itself) ---
  var RF = path.join(__dirname, "fixtures", "xlsx", "review", "files");
  function rfile(n) { return u8(fs.readFileSync(path.join(RF, n))); }
  var cs = { A2: "North", A3: "South", A4: "North", B2: "1", B3: "2", B4: "3", B5: "4", C2: "1.5", C3: "0.5", C4: "1", C5: "0.25", D2: "100", D3: "50", D4: "125",
    E1: "=SUMPRODUCT((A2:A4=\"North\")*(D2:D4))", E2: "=SUMPRODUCT(--(B2:B5>2))", E3: "=SUM(B2:B5*C2:C5)", E4: "=SUM(IF(B2:B5>2,C2:C5))", E5: "=AVERAGE(IF(A2:A4=\"North\",D2:D4))",
    E6: "=SUMPRODUCT(A2:A4=\"North\")", E7: "=VLOOKUP(6,{0,\"low\";5,\"mid\";10,\"high\"},2,TRUE)", E8: "=B2:B5*2", E9: "=COUNTA(UNIQUE(A2:A4))", E10: "=SUM(FILTER(D2:D4,A2:A4=\"North\"))",
    F1: "=50%^2", F2: "=2^300%", F3: "=17%5", F4: "=SUM(B2:B5)+1", F5: "=IF(B3>1,\"y\",\"n\")", F6: "=\"x\"&B2", F7: "=B2:B5", F8: "=GAMMAFN(5)", F9: "=BASE(255,16,4)", F10: "=ERROR.TYPE(1/0)" };
  var cv = L.sheetDocs.compute(cs);
  ok("a range or a list in { } worked out cell by cell in a sheet, as in Excel (SUMPRODUCT, SUM(IF()), AVERAGE(IF()), VLOOKUP over { })",
    cv.E1 === 225 && cv.E2 === 2 && cv.E3 === 6.5 && cv.E4 === 1.25 && cv.E5 === 112.5 && cv.E7 === "mid", [cv.E1, cv.E2, cv.E3, cv.E4, cv.E5, cv.E7]);
  ok("...a list of yes and no counts as 0s in SUMPRODUCT, as in Excel; a list in a cell shows its first value; UNIQUE and FILTER taken whole", cv.E6 === 0 && cv.E8 === 2 && cv.E9 === 2 && cv.E10 === 225, [cv.E6, cv.E8, cv.E9, cv.E10]);
  ok("...per cent before a power (50%^2, 2^300%), 17%5 still the remainder; ordinary formulas as before; a range alone in a cell shows its first value, as Excel 365 does",
    cv.F1 === 0.25 && cv.F2 === 8 && cv.F3 === 2 && cv.F4 === 11 && cv.F5 === "y" && cv.F6 === "x1" && cv.F7 === 1, [cv.F1, cv.F2, cv.F3, cv.F4, cv.F5, cv.F6, cv.F7]);
  ok("...GAMMAFN (Excel's GAMMA), BASE, ERROR.TYPE", cv.F8 === 24 && cv.F9 === "00FF" && cv.F10 === 2, [cv.F8, cv.F9, cv.F10]);
  var calcErr = function (src) { try { L.formula.evaluate(src); return null; } catch (e) { return e.message; } };
  ok("...the Calculator keeps -2^2 as -4 and does not read { }", L.formula.evaluate("-2^2") === -4 && /Bad character/.test(calcErr("{1,2}")), calcErr("{1,2}"));
  var bk = { Jan: { B2: "10", B6: "=B2*2" }, Feb: { B2: "20" }, Mar: { B2: "30" }, Summary: {} }, sv = L.sheetDocs.compute({ A1: "=Jan!B6", A2: "=SUM(Jan:Mar!B2)", A3: "='Feb'!B2+1", A4: "=Nope!A1" }, bk, "Summary");
  ok("another sheet of the workbook: =Jan!B6, =SUM(Jan:Mar!B2), ='Feb'!B2; a sheet not there is #REF!", sv.A1 === 20 && sv.A2 === 60 && sv.A3 === 21 && sv.A4 === "#REF!", sv);
  // the writer
  function xml(bytes, part) { return L.zip.text ? L.zip.text(L.zip.read(bytes), part) : L.zip.read(bytes).text(part); }
  var zr = function (bytes) { return L.zip.read(bytes); };
  var wd = { title: "Mends", cells: { A1: "2026-11-17", A2: "=A1+30", A3: "3:30 PM", A4: "17 Nov 2026", B1: "1", B2: "2", B3: "3", B4: "4", C1: "=SUM(B1:B4*B1:B4)", C2: "=UNIQUE(B1:B4)", C3: "=LORE(0.5*299792458)",
    C4: "=GAMMAFN(5)", C5: "=Other!A1", C6: "=networkdays.intl(A1,A2,1)", C7: "=AB1+1", D1: new Array(33001).join("x"),
    // (1.24.29) CONVERT's units as Excel names them: lb is lbm, an hour h is hr; bar Excel has not
    E1: "=CONVERT(2,\"lb\",\"kg\")", E2: "=CONVERT(3,\"h\",\"min\")", E3: "=CONVERT(1,\"bar\",\"psi\")", E4: "=CONVERT(1,\"ton\",\"kg\")", E5: "=GAMMA(5)" } };
  var wr = X.write(wd, L.sheetDocs.compute(wd.cells)), z1 = zr(wr.bytes), sx = z1.text("xl\x2Fworksheets\x2Fsheet1.xml"), st = z1.text("xl\x2Fstyles.xml");
  var wback = X.read(wr.bytes, "m.xlsx"), wsb = wback.sheets[0];
  ok("typed dates and times saved as Excel's numbers with the look they were typed in; a formula's date with a date's look",
    /<c r="A1" s="\d+"><v>46343<\/v>/.test(sx) && /<c r="A2" s="\d+"><f>A1\+30<\/f><v>46373<\/v>/.test(sx) && wsb.fmt.A1.nf === "yyyy-mm-dd" && wsb.fmt.A2.nf === "yyyy-mm-dd" &&
    wsb.fmt.A3.nf === "h:mm AM\x2FPM" && wsb.fmt.A4.nf === "dd mmm yyyy" && wsb.cells.A3 === "0.645833333333333", [wsb.cells.A1, wsb.cells.A3, wsb.fmt]);
  // (1.24.29, Adam 2026-11-20: Excel's function names mean what they mean in Excel) GAMMAFN, 1.24.28's name, saved as GAMMA and read back as GAMMA
  ok("Excel's GAMMA read back as GAMMA, said nowhere", wsb.cells.C4 === "=GAMMA(5)" && wsb.cells.E5 === "=GAMMA(5)" && !has(wback.notes, /GAMMAFN/), [wsb.cells.C4, wback.notes]);
  ok("an array formula: t=\"array\"; a spilling one with cm=\"1\" and the metadata part Excel 365 writes",
    /<c r="C1"[^>]*><f t="array" ref="C1">SUM\(B1:B4\*B1:B4\)<\/f>/.test(sx) && /<c r="C2"[^>]* cm="1"><f t="array" ref="C2">_xlfn.UNIQUE\(B1:B4\)<\/f>/.test(sx) && z1.has("xl\x2Fmetadata.xml") &&
    /sheetMetadata\+xml/.test(z1.text("[Content_Types].xml")) && /sheetMetadata/.test(z1.text("xl\x2F_rels\x2Fworkbook.xml.rels")), sx.slice(sx.indexOf('r="C1"') - 5, sx.indexOf('r="C1"') + 300));
  ok("LORE (the Lorentz factor, Lantern's own) kept with its value; GAMMAFN and GAMMA as Excel's _xlfn.GAMMA; a sheet not in the file: the value, and said",
    /<c r="C3"[^>]*><f>LORE\(0\.5\*299792458\)<\/f><v>1\.1547/.test(sx) && /<c r="C4"[^>]*><f>_xlfn.GAMMA\(5\)<\/f>/.test(sx) && /<c r="E5"[^>]*><f>_xlfn.GAMMA\(5\)<\/f><v>24<\/v>/.test(sx) &&
    /<c r="C5"[^>]*t="e"><v>#REF!<\/v>/.test(sx) && has(wr.notes, /^Saved as the value Lantern worked out.*C5 \(it uses the sheet “Other”/), [wr.notes, sx.slice(sx.indexOf('r="C3"') - 5, sx.indexOf('r="C3"') + 200)]);
  ok("CONVERT saved with Excel's units: lb as lbm, an hour as hr; ton is Excel's short ton here too; bar, which Excel has not, saved as the value and said",
    /<c r="E1"[^>]*><f>CONVERT\(2,&quot;lbm&quot;,&quot;kg&quot;\)<\/f><v>0\.90718474<\/v>/.test(sx) && /<c r="E2"[^>]*><f>CONVERT\(3,&quot;hr&quot;,&quot;mn&quot;\)<\/f><v>180<\/v>/.test(sx) &&
    /<c r="E4"[^>]*><f>CONVERT\(1,&quot;ton&quot;,&quot;kg&quot;\)<\/f><v>907\.18474<\/v>/.test(sx) && /<c r="E3"[^>]*><v>14\.5037/.test(sx) && !/<c r="E3"[^>]*><f>/.test(sx) && has(wr.notes, /E3 \(a unit of CONVERT that Excel does not have/),
    [wr.notes, sx.slice(sx.indexOf('r="E1"') - 5, sx.indexOf('r="E1"') + 420)]);
  ok("NETWORKDAYS.INTL without _xlfn., in capitals; a column past Z said; a text over 32,767 characters cut, and said",
    /<f>NETWORKDAYS\.INTL\(A1,A2,1\)<\/f>/.test(sx) && has(wr.notes, /past Z \(C7\)/) && has(wr.notes, /32,767 characters.*D1/) && z1.text("xl\x2FsharedStrings.xml").indexOf(new Array(32768).join("x") + "<") > 0, wr.notes);
  // a workbook's sheets saved together
  var crs = X.read(rfile("crosssheet.xlsx"), "crosssheet.xlsx"), bmap = {};
  crs.sheets.forEach(function (s) { bmap[s.name] = s.cells; });
  var wb = X.writeBook(crs.sheets.map(function (s) { return { doc: s, name: s.name, values: L.sheetDocs.compute(s.cells, bmap, s.name) }; })), wz = zr(wb.bytes);
  ok("a workbook's sheets saved together under their own names; no formula saved as a value", wb.names.join("|") === crs.sheets.map(function (s) { return s.name; }).join("|") && wb.names.indexOf("Summary") >= 0 &&
    (wz.text("xl\x2Fworkbook.xml").match(/<sheet /g) || []).length === crs.sheets.length && !has(wb.notes, /^Saved as the value/), [wb.names, wb.notes]);
  // the reader
  var t1904 = X.read(rfile("date1904_mac.xlsx"), "m.xlsx").sheets[0];
  ok("a 1904 workbook: a length of time in [h]:mm is left as it is (36 hours), a date is moved to Sheets' count", t1904.cells.C2 === "1.5" && +t1904.cells.A2 > 40000, [t1904.cells.A2, t1904.cells.C2]);
  var tt = X.read(rfile("table.xlsx"), "t.xlsx");
  ok("an Excel table's names written as the cells they stand for, and said once", tt.sheets[0].cells.D2 === "=B2*C2" && tt.sheets[0].cells.G2 === "=SUM(D2:D5)" && tt.notes.filter(function (n) { return /table Orders/.test(n); }).length === 1, [tt.sheets[0].cells, tt.notes]);
  var pw = null; try { X.read(rfile("password.xlsx"), "p.xlsx"); } catch (e) { pw = e.message; }
  ok("a workbook locked with a password is said to be so", /locked with a password/.test(pw || ""), pw);
  var tn = X.read(rfile("text_numbers.xlsx"), "n.xlsx").sheets[0], tnv = L.sheetDocs.compute(tn.cells);
  ok("text that Sheets would read as a number, a date or a time stays text (COUNT of it 0, as in Excel)", tnv.D5 === 0 && tn.cells.A2 === "\x2702134", [tnv.D5, tn.cells.A2]);
  ok("comments: their cells and words in the note", has(X.read(rfile("comments.xlsx"), "c.xlsx").notes, /^Comments are not kept: B2 “Price from the supplier/), "comments");

  // --- the second review's mends (1.24.28; tests/review2_xlsx_1268.py replays the review itself) ---
  var c2 = { A2: "North", A3: "South", A4: "North", A5: "East", B2: "Widget", B3: "Gadget", B4: "Widget", B5: "Bolt", C2: "5", C3: "3", C4: "4", C5: "2", E2: "2026-03-01", E3: "2026-02-01", E4: "2026-03-09", E5: "2026-01-01",
    K1: "=SUMPRODUCT(LEN(B2:B5))", K2: "=SUMPRODUCT(1/COUNTIF(B2:B5,B2:B5))", K3: "=SUMPRODUCT(--ISNUMBER(SEARCH(\"Wid\",B2:B5)))", K4: "=SUMPRODUCT((MONTH(E2:E5)=3)*C2:C5)",
    K5: "=SUM(IFERROR(C2:C5/(A2:A5=\"North\"),0))", K6: "=COUNT(SQRT(-1))", K7: "=ISERROR(LN(0))", K8: "=IFERROR(SQRT(-4),\"no root\")", K9: "=MAX(INDEX(C2:C5*2,0))", K10: "=ERROR.TYPE(1/0)",
    K11: "=@C2:C5*2", K12: "=SUM(Jan!B:B)", K13: "=INDIRECT(\"Jan!B6\")", K14: "=1.2.10&\"\"" };
  delete c2.K14;
  var v2 = L.sheetDocs.compute(c2, { Jan: { B2: "100", B6: "40" }, Here: c2 }, "Here");
  ok("a list given where a function takes one value is worked out for each of its cells (LEN, COUNTIF's test, SEARCH, MONTH), and a cell's error stays in its cell (IFERROR)",
    v2.K1 === 22 && Math.abs(v2.K2 - 3) < 1e-12 && v2.K3 === 2 && v2.K4 === 9 && v2.K5 === 9, [v2.K1, v2.K2, v2.K3, v2.K4, v2.K5]);
  ok("...SQRT(-1) and LN(0) are #NUM! to COUNT, ISERROR and IFERROR; INDEX(list,0) the whole list; ERROR.TYPE(1/0) is 2",
    v2.K6 === 0 && v2.K7 === 1 && v2.K8 === "no root" && v2.K9 === 10 && v2.K10 === 2, [v2.K6, v2.K7, v2.K8, v2.K9, v2.K10]);
  ok("...Excel's @ (C2:C5 in row 11: none, so #VALUE!); another sheet's whole column and INDIRECT(\"Jan!B6\")", v2.K11 === "#VALUE!" && v2.K12 === 140 && v2.K13 === 40, [v2.K11, v2.K12, v2.K13]);
  var at5 = L.sheetDocs.compute({ C2: "1", C3: "2", C4: "3", C5: "7", J5: "=@C2:C5*2" }).J5;
  ok("...=@C2:C5*2 in row 5 is C5*2, as Excel 2019 reads =C2:C5*2 there", at5 === 14, at5);
  ok("a date with dots has a year of four digits: 1.2.10 is not a date, 17.11.2026 is", L.formula.dayOf("1.2.10") === null && L.formula.dayOf("17.11.2026") === 46343, [L.formula.dayOf("1.2.10"), L.formula.dayOf("17.11.2026")]);
  var g2 = function (f) { return X.excelFormula(f); };
  ok("Excel's grammar: ROUND(A1) as ROUND(A1,0), FLOOR(A1) as FLOOR(A1,1), POW and CEIL as POWER and CEILING; LEN(A2:A9) and =C2:C4 array formulas; @ plain, or SINGLE in an array formula; SUM() refused",
    g2("ROUND(A1)").f === "ROUND(A1,0)" && g2("FLOOR(A1)").f === "FLOOR(A1,1)" && g2("POW(2,3)").f === "POWER(2,3)" && g2("CEIL(2.5)").f === "CEILING(2.5,1)" &&
    g2("SUM(LEN(A2:A9))").array && g2("C2:C4").array && g2("@C2:C9*2").f === "C2:C9*2" && !g2("@C2:C9*2").array && g2("@C2:C9*D2:D9").f === "_xlfn.SINGLE(C2:C9)*D2:D9" && !g2("SUM()").ok,
    [g2("ROUND(A1)").f, g2("@C2:C9*2"), g2("@C2:C9*D2:D9").f]);
  var w3 = X.write({ title: "t", cells: { A1: "1 1/2", A2: "(100)", A3: "($1,200.50)", A4: "1.2.10", A5: "=SUM(A1:A3)" } }, L.sheetDocs.compute({ A1: "1 1/2", A2: "(100)", A3: "($1,200.50)", A4: "1.2.10", A5: "=SUM(A1:A3)" }));
  var b3 = X.read(w3.bytes, "t.xlsx").sheets[0];
  ok("1 1/2 and (100) typed are saved as numbers with their looks, as Excel keeps them; 1.2.10 as text", b3.cells.A1 === "1.5" && b3.fmt.A1.nf === "# ?\x2F?" && b3.cells.A2 === "-100" && b3.fmt.A2.nf === "#,##0_);(#,##0)" &&
    b3.cells.A3 === "-1200.5" && b3.fmt.A3.nf === "$#,##0.00_);($#,##0.00)" && b3.cells.A4 === "1.2.10", [b3.cells, b3.fmt]);
  // a plain formula from an Excel file that names a range where one value belongs: @ as Excel 365 shows it, saved plain
  var imp = { title: "i", cells: { C2: "1", C3: "2", C4: "3", C5: "7", J5: "=@C2:C5*2" } }, wi = X.write(imp, L.sheetDocs.compute(imp.cells)), zi = L.zip.read(wi.bytes).text("xl\x2Fworksheets\x2Fsheet1.xml");
  ok("...and saved again as Excel had it, a plain formula (Excel's own 14, not an array formula's 2)", /<c r="J5"><f>C2:C5\*2<\/f><v>14<\/v>/.test(zi), zi.slice(zi.indexOf('r="J5"') - 5, zi.indexOf('r="J5"') + 80));

  // --- the third review's mends (1.24.28; tests/review3_xlsx_1268.py replays the review itself) ---
  var c3 = { A2: "North", A3: "South", A4: "North", B2: "Widget", B3: "Gadget", B4: "Bolt", C2: "5", C4: "7", K2: "10", K3: "30", K4: "20",
    P1: "=SUM(ROW(A2:A11))", P2: "=INDEX(B2:B4,SMALL(IF(A2:A4=\"North\",ROW(A2:A4)-1),2))", P3: "=SUMPRODUCT(--ISBLANK(C2:C4))", P4: "=SUM(LARGE(K2:K4,{1,2}))",
    P5: "=ADDRESS(2,2,1,1,\"Jan\")", P6: "=0^0", P7: "=LOG(10,1)", P8: "=ACOSH(1)" };
  var v3 = L.sheetDocs.compute(c3);
  ok("ROW of a range is a list; ISBLANK of each cell of one; LARGE given a list of k; ADDRESS names its sheet; 0^0 and LOG to base 1 as Excel's errors; ACOSH",
    v3.P1 === 65 && v3.P2 === "Bolt" && v3.P3 === 1 && v3.P4 === 50 && v3.P5 === "Jan!$B$2" && v3.P6 === "#NUM!" && v3.P7 === "#DIV/0!" && v3.P8 === 0, [v3.P1, v3.P2, v3.P3, v3.P4, v3.P5, v3.P6, v3.P7, v3.P8]);
  ok("5.3.2026 is 5 March (dots are day first); (-100) is not a number; (5%) is -5%", L.formula.dayOf("5.3.2026") === 46086 && L.formula.textNum("(-100)", true) === null && L.formula.textNum("(5%)", true) === -0.05,
    [L.formula.dayOf("5.3.2026"), L.formula.textNum("(-100)", true)]);
  var w4 = X.write({ title: "t", cells: { A1: "(5%)", B1: "=MID(\"abcd\",2)", B2: "=LEN()", B3: "=@(C2:C9)*D2:D9" } }, {}), z4 = L.zip.read(w4.bytes).text("xl\x2Fworksheets\x2Fsheet1.xml"), b4 = X.read(w4.bytes, "t.xlsx").sheets[0];
  ok("the writer: (5%) with a per cent's look in brackets; MID(x,2) as MID(x,2,1); LEN() refused; @( ) as _xlfn.SINGLE( ) in an array formula",
    b4.fmt.A1.nf === "0%_);(0%)" && /MID\(&quot;abcd&quot;,2,1\)/.test(z4) && has(w4.notes, /LEN with nothing in its brackets/) && /<f t="array" ref="B3">_xlfn.SINGLE\(\(C2:C9\)\)\*D2:D9<\/f>/.test(z4), [b4.fmt.A1, w4.notes, z4.slice(z4.indexOf('r="B3"'), z4.indexOf('r="B3"') + 120)]);

  if (errs.length) { fails++; console.log("FAIL page errors", errs.slice(0, 3)); }
  console.log(fails ? fails + " XLSX FAILURES (" + passes + " passed)" : "ALL XLSX CHECKS PASS (" + passes + " passed)");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crash", e && e.stack); process.exit(1); });
