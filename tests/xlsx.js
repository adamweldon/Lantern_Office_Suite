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
  ok("...a formula from another sheet kept as written, and the cell named where Lantern differs from Excel", r.sheets[1].cells.C2 === "=B2*Prices!B2*(1+\x27Rates\x27!B1)" && has(r.notes, /“Order”: Lantern works out 1 formula differently from what Excel saved: C2 \(Excel 30, here/), [r.sheets[1].cells.C2, r.notes]);
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
  click("C1"); S.rowAct("colLeft"); await sleep(20);
  ok("a column put in left of it: the merge moves right and widens nothing; widths move with their columns", doc().merges.join() === "D1:F1" && doc().widths.A === 15.28515625 && doc().widths.G === 12.42578125 && !doc().widths.F, [doc().merges, doc().widths]);
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

  if (errs.length) { fails++; console.log("FAIL page errors", errs.slice(0, 3)); }
  console.log(fails ? fails + " XLSX FAILURES (" + passes + " passed)" : "ALL XLSX CHECKS PASS (" + passes + " passed)");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crash", e && e.stack); process.exit(1); });
