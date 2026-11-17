// sheet_functions.js -- Sheets with Excel's functions (1.24.24). Adam (2026-11-17): "Anything that is
// available on commercial software should be available on Lantern as much as possible plus more while being
// easier to use". Sheets knew about thirty functions; now Excel's everyday ones (SUMIF, COUNTIFS, VLOOKUP,
// XLOOKUP, INDEX/MATCH, IFS, TEXT, DATEDIF, NETWORKDAYS, PMT, IRR, SLOPE, NORM.DIST ...), worked as Excel works
// them. The values pinned here are Excel's own (its help pages' examples where it gives one: PMT, PV, NPV,
// RATE, CUMIPMT, CUMPRINC, DDB, EFFECT), or worked by hand. Also: & joins text, a blank cell is "" beside
// text, a date written 2026-11-17 is a day's number to every function and shows as a date when a formula
// gives one, and the fx button beside the formula bar finds a function by a word and puts it in the formula.
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
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 600)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function td(ref) { return d.querySelector("td[data-ref=" + ref + "]"); }
function bar() { return d.querySelector(".fbar input"); }
function mouse(el, type) { el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true })); }
function clickCell(ref) { mouse(td(ref), "mousedown"); mouse(td(ref), "click"); }
function typeInBar(text) { var b = bar(); b.value = text; try { b.setSelectionRange(text.length, text.length); } catch (e) {} fire(b, "input"); }
function key(el, k) { el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); }
function enter(ref, text) { clickCell(ref); typeInBar(text); key(bar(), "Enter"); }

// a small sheet: a price list, two dates, two columns of numbers
var BASE = { A1: "rice", B1: "2.5", C1: "kg", A2: "beans", B2: "3", C2: "kg", A3: "oil", B3: "4.25", C3: "l", A4: "apples", B4: "", C4: "kg",
  D1: "2026-01-15", D2: "2026-11-17", E1: "10", E2: "20", E3: "30", E4: "40", F1: "1", F2: "2", F3: "3", F4: "4",
  G1: "-10000", G2: "3000", G3: "4200", G4: "6800" };
// [formula, what Excel gives] -- a number is matched to 1e-9 of its size (or to the places written)
var CASES = [
  // money (Excel's help examples)
  ["=PMT(0.05/12,360,200000)", -1073.6432460242795], ["=IPMT(0.05/12,1,360,200000)", -833.3333333333334],
  ["=PPMT(0.05/12,1,360,200000)", -240.30991269094613], ["=IPMT(0.1/12,3,36,8000,0,1)", -62.93770866094681],
  ["=FV(0.06/12,10,-200,-500,1)", 2581.40337406012], ["=PV(0.08/12,240,500)", -59777.14585118777],
  ["=NPER(0.12/12,-100,-1000,10000,1)", 59.6738656742946], ["=RATE(48,-200,8000)", 0.00770147248820165],
  ["=NPV(0.1,G1:G4)", 1188.44341233522], ["=IRR(G1:G4)", 0.163405600688989], ["=CUMIPMT(0.09/12,360,125000,13,24,0)", -11135.2321307508],
  ["=CUMPRINC(0.09/12,360,125000,13,24,0)", -934.107123420876], ["=SLN(30000,7500,10)", 2250], ["=DDB(2400,300,10,1)", 480],
  ["=EFFECT(0.0525,4)", 0.0535426673707584], ["=NOMINAL(0.053543,4)", 0.0525003198683561],
  // criteria
  ["=SUMIF(C1:C4,\"kg\",B1:B4)", 5.5], ["=SUMIF(E1:E4,\">15\")", 90], ["=COUNTIF(A1:A4,\"*e*\")", 3], ["=COUNTIF(B1:B4,\">2.6\")", 2],
  ["=COUNTIF(A1:A4,\"<>rice\")", 3], ["=COUNTIF(B1:B4,\"\")", 1], ["=COUNTIFS(C1:C4,\"kg\",B1:B4,\"<>\")", 2],
  ["=SUMIFS(E1:E4,F1:F4,\">=2\",F1:F4,\"<=3\")", 50], ["=AVERAGEIF(C1:C4,\"kg\",B1:B4)", 2.75], ["=AVERAGEIFS(E1:E4,F1:F4,\">1\")", 30],
  ["=MAXIFS(B1:B4,C1:C4,\"kg\")", 3], ["=MINIFS(E1:E4,F1:F4,\">1\")", 20], ["=COUNTIF(D1:D4,\">2026-06-01\")", 1], ["=COUNTIF(A1:A4,\"r?ce\")", 1],
  // look up
  ["=VLOOKUP(\"oil\",A1:C4,2,FALSE)", 4.25], ["=VLOOKUP(\"OIL\",A1:C4,3,FALSE)", "l"], ["=VLOOKUP(\"salt\",A1:C4,2,FALSE)", "#N/A"],
  ["=IFERROR(VLOOKUP(\"salt\",A1:C4,2,FALSE),\"none\")", "none"], ["=VLOOKUP(25,E1:F4,2)", 2], ["=VLOOKUP(5,E1:F4,2)", "#N/A"],
  ["=VLOOKUP(\"oil\",A1:C4,4,FALSE)", "#REF!"], ["=HLOOKUP(\"kg\",A1:C4,3,FALSE)", "l"],
  ["=XLOOKUP(\"beans\",A1:A4,B1:B4)", 3], ["=XLOOKUP(\"salt\",A1:A4,B1:B4,\"none\")", "none"], ["=XLOOKUP(25,E1:E4,F1:F4,\"none\",-1)", 2],
  ["=XLOOKUP(25,E1:E4,F1:F4,\"none\",1)", 3], ["=XLOOKUP(\"ap*\",A1:A4,C1:C4,\"none\",2)", "kg"], ["=XLOOKUP(\"ap*\",A1:A4,C1:C4,\"none\")", "none"],
  ["=INDEX(A1:C4,MATCH(\"oil\",A1:A4,0),2)", 4.25], ["=INDEX(E1:E4,2)", 20], ["=INDEX(A1:C1,3)", "kg"], ["=INDEX(A1:C4,5,1)", "#REF!"],
  ["=MATCH(25,E1:E4)", 2], ["=MATCH(25,E1:E4,0)", "#N/A"], ["=MATCH(\"b*\",A1:A4,0)", 2], ["=XMATCH(30,E1:E4)", 3],
  ["=LOOKUP(25,E1:E4,F1:F4)", 2], ["=ROW(A5)", 5], ["=COLUMN(C5)", 3], ["=ROWS(A1:C4)", 4], ["=COLUMNS(A1:C4)", 3],
  // logic
  ["=IFS(E1>30,\"big\",E1>5,\"mid\",TRUE,\"small\")", "mid"], ["=IFS(TRUE,1,1/0,2)", 1], ["=IFS(E1>50,1)", "#N/A"],
  ["=SWITCH(F2,1,\"one\",2,\"two\",\"many\")", "two"], ["=SWITCH(F4,1,\"one\",2,\"two\",\"many\")", "many"], ["=CHOOSE(3,\"a\",\"b\",\"c\")", "c"],
  ["=CHOOSE(1,5,1/0)", 5], ["=AND(E1>5,F1<2)", 1], ["=OR(E1>50,F1>5)", 0], ["=XOR(TRUE,TRUE,TRUE)", 1], ["=NOT(0)", 1],
  ["=ISNUMBER(MATCH(\"salt\",A1:A4,0))", 0], ["=ISNUMBER(SEARCH(\"ea\",A2))", 1], ["=ISBLANK(B4)", 1], ["=ISBLANK(B3)", 0],
  ["=ISTEXT(A1)", 1], ["=ISERROR(1/0)", 1], ["=ISERR(NA())", 0], ["=ISNA(NA())", 1], ["=IFNA(NA(),\"x\")", "x"], ["=IFNA(1/0,\"x\")", "#DIV/0!"],
  ["=ISEVEN(4)", 1], ["=ISODD(4)", 0], ["=B4=\"\"", 1], ["=A1=\"\"", 0], ["=IF(B4=\"\",\"empty\",\"full\")", "empty"], ["=B4=0", 1],
  // maths and statistics
  ["=SUMPRODUCT(E1:E4,F1:F4)", 300], ["=PRODUCT(F1:F4)", 24], ["=SUMSQ(F1:F4)", 30], ["=COUNTA(A1:C4)", 11], ["=COUNTBLANK(A1:C4)", 1],
  ["=MEDIAN(E1:E4)", 25], ["=MODE(1,2,2,1)", 1], ["=STDEV(E1:E4)", 12.9099444873581], ["=STDEV.P(E1:E4)", 11.1803398874989],
  ["=VAR.S(E1:E4)", 166.666666666667], ["=PERCENTILE(E1:E4,0.9)", 37], ["=QUARTILE(E1:E4,1)", 17.5], ["=RANK(30,E1:E4)", 2],
  ["=RANK(30,E1:E4,1)", 3], ["=LARGE(E1:E4,2)", 30], ["=SMALL(E1:E4,1)", 10], ["=SUBTOTAL(9,E1:E4)", 100], ["=SUBTOTAL(101,E1:E4)", 25],
  ["=FLOOR(7,5)", 5], ["=CEILING(7,5)", 10], ["=CEILING(-2.5,2)", -2], ["=FLOOR(-2.5,2)", -4], ["=CEILING(2.5,-2)", "#NUM!"],
  ["=CEILING.MATH(-5.5,2)", -4], ["=CEILING.MATH(-5.5,2,1)", -6], ["=FLOOR.MATH(-5.5,2)", -6], ["=MROUND(17,5)", 15], ["=MROUND(5,-2)", "#NUM!"],
  ["=ROUNDUP(1234,-2)", 1300], ["=ROUNDUP(2.301,1)", 2.4], ["=ROUNDDOWN(-2.399,1)", -2.3], ["=INT(-2.5)", -3], ["=TRUNC(-2.5)", -2],
  ["=QUOTIENT(10,3)", 3], ["=GCD(12,18)", 6], ["=LCM(4,6)", 12], ["=COMBIN(10,3)", 120], ["=PERMUT(10,3)", 720], ["=EVEN(-1)", -2], ["=ODD(0)", 1],
  ["=SIGN(-3)", -1], ["=LOG10(1000)", 3], ["=DEGREES(PI())", 180], ["=RANDBETWEEN(4,4)", 4],
  ["=SLOPE(E1:E4,F1:F4)", 10], ["=INTERCEPT(E1:E4,F1:F4)", 0], ["=CORREL(E1:E4,F1:F4)", 1], ["=FORECAST(5,E1:E4,F1:F4)", 50],
  ["=NORM.S.DIST(1,TRUE)", 0.841344746068543], ["=NORM.DIST(42,40,1.5,TRUE)", 0.908788780274132], ["=NORM.DIST(42,40,1.5,FALSE)", 0.109340049783996],
  ["=NORM.INV(0.908789,40,1.5)", 42.0000020095662], ["=NORM.S.INV(0.001)", -3.09023230616781], ["=GEOMEAN(F1:F4)", 2.21336383940064],
  ["=HARMEAN(F1:F4)", 1.92], ["=CONFIDENCE.NORM(0.05,2.5,50)", 0.692951912174839],
  // text
  ["=\"Total: \"&SUM(B1:B4)", "Total: 9.75"], ["=A1&\" \"&C1", "rice kg"], ["=0.1+0.2&\"\"", "0.3"], ["=LEFT(0.1+0.2,4)", "0.3"],
  ["=TEXT(1234.567,\"#,##0.00\")", "1,234.57"], ["=TEXT(0.256,\"0.0%\")", "25.6%"], ["=TEXT(-1234.5,\"$#,##0.00;($#,##0.00)\")", "($1,234.50)"],
  ["=TEXT(12345,\"00000000\")", "00012345"], ["=TEXT(1234567,\"0.00E+00\")", "1.23E+06"], ["=TEXT(0.5,\"#.##\")", ".5"],
  ["=TEXT(1234.5,\"#,##0,\")", "1"], ["=TEXT(0,\"0;-0;zero\")", "zero"], ["=TEXT(D2,\"dddd d mmmm yyyy\")", "Tuesday 17 November 2026"],
  ["=TEXT(0.5,\"h:mm AM/PM\")", "12:00 PM"], ["=TEXT(46343.75,\"yyyy-mm-dd hh:mm\")", "2026-11-17 18:00"], ["=TEXT(D1,\"mmm d\")", "Jan 15"],
  ["=PROPER(\"ada LOVELACE o'neil\")", "Ada Lovelace O'Neil"], ["=TRIM(\"  a   b  \")", "a b"], ["=TEXTJOIN(\", \",TRUE,A1:A4)", "rice, beans, oil, apples"],
  ["=CONCAT(A1:C1)", "rice2.5kg"], ["=CONCATENATE(\"a\",1,\"b\")", "a1b"], ["=SEARCH(\"BE\",A2)", 1], ["=SEARCH(\"x\",A2)", "#VALUE!"],
  ["=FIND(\"e\",\"beans\",3)", "#VALUE!"], ["=FIND(\"a\",\"banana\",3)", 4], ["=SUBSTITUTE(\"a-b-c\",\"-\",\"+\",2)", "a-b+c"],
  ["=SUBSTITUTE(\"a-b-c\",\"-\",\"+\")", "a+b+c"], ["=REPLACE(\"abcdef\",2,3,\"X\")", "aXef"], ["=REPT(\"ab\",3)", "ababab"],
  ["=EXACT(\"a\",\"A\")", 0], ["=VALUE(\"$1,200\")", 1200], ["=VALUE(\"12%\")", 0.12], ["=TEXTBEFORE(\"Ada Lovelace\",\" \")", "Ada"],
  ["=TEXTAFTER(\"a.b.c\",\".\",-1)", "c"], ["=TEXTAFTER(\"abc\",\"x\")", "#N/A"], ["=DOLLAR(-1234.567)", "($1,234.57)"], ["=FIXED(1234.567,1)", "1,234.6"],
  ["=CHAR(65)", "A"], ["=CODE(\"A\")", 65], ["=UNICODE(\"€\")", 8364],
  // dates (46343 is 2026-11-17 in Excel)
  ["=DATE(2026,11,17)", 46343], ["=DATE(2026,14,1)", 46419], ["=DATE(1900,1,1)", 1], ["=DATE(1900,3,1)", 61], ["=D2", "2026-11-17"],
  ["=D2-D1", 306], ["=D2+30", 46373], ["=DATEDIF(D1,D2,\"D\")", 306], ["=DATEDIF(\"2000-02-29\",\"2026-11-17\",\"Y\")", 26],
  ["=DATEDIF(\"2000-02-29\",\"2026-11-17\",\"YM\")", 8], ["=DATEDIF(\"2026-01-31\",\"2026-03-01\",\"M\")", 1], ["=DATEDIF(D2,D1,\"D\")", "#NUM!"],
  ["=EDATE(\"2026-01-31\",1)", 46081], ["=EOMONTH(\"2026-01-15\",1)", 46081], ["=EOMONTH(\"2026-11-17\",0)", 46356],
  ["=WEEKDAY(\"2026-11-17\")", 3], ["=WEEKDAY(\"2026-11-17\",2)", 2], ["=WEEKNUM(\"2026-11-17\")", 47], ["=ISOWEEKNUM(\"2026-01-01\")", 1],
  ["=NETWORKDAYS(\"2026-11-02\",\"2026-11-30\")", 21], ["=NETWORKDAYS.INTL(\"2026-11-01\",\"2026-11-30\",7)", 22],
  ["=WORKDAY(\"2026-11-17\",10)", 46357], ["=WORKDAY.INTL(\"2026-11-17\",5,\"0000011\")", 46350], ["=YEARFRAC(\"2026-01-01\",\"2026-07-01\",1)", 0.495890410958904],
  ["=DAYS(\"2026-12-25\",\"2026-11-17\")", 38], ["=YEAR(D2)", 2026], ["=MONTH(D2)", 11], ["=DAY(D2)", 17], ["=HOUR(\"14:30\")", 14],
  ["=MINUTE(TIME(14,35,10))", 35], ["=TIMEVALUE(\"2:30 pm\")", 0.604166666666667], ["=DATEVALUE(\"17 Nov 2026\")", 46343],
  ["=DATEVALUE(\"November 17, 2026\")", 46343], ["=MAX(D1:D2)", 46343], ["=MAX(D1:D2)-MIN(D1:D2)", 306], ["=COUNT(D1:D4)", 2],
  ["=XNPV(0.09,G1:G2,D1:D2)", -7209.0984333793],
  // errors as Excel names them
  ["=1/0", "#DIV/0!"], ["=NA()", "#N/A"], ["=NOSUCH(1)", "#NAME?"]
];
function close(v, want) {
  if (typeof want !== "number") return v === want;
  if (typeof v !== "number") return false;
  return Math.abs(v - want) <= Math.max(1e-9 * Math.abs(want), 1e-9);
}

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern;
  ok("boot clean", !errs.length, errs);

  // --- the values, as Excel gives them ------------------------------------------------------------------------
  var cells = {}, k;
  for (k in BASE) cells[k] = BASE[k];
  CASES.forEach(function (c, i) { cells["Z" + (i + 1)] = c[0]; });
  var out = L.sheetDocs.compute(cells), wrong = [];
  CASES.forEach(function (c, i) {
    var v = out["Z" + (i + 1)], want = c[1];
    if (!close(v, want)) wrong.push([c[0], v, c[1]]);
  });
  ok("every formula gives what Excel gives (" + CASES.length + ")", !wrong.length, wrong);
  // the row the formula is in (ROW() with nothing in the brackets)
  ok("ROW() is the formula's own row", L.sheetDocs.compute({ C7: "=ROW()", D9: "=COLUMN()" }).C7 === 7 && L.sheetDocs.compute({ D9: "=COLUMN()" }).D9 === 4);
  // NOW and TODAY are this computer's day
  var now = new Date(), today = L.sheetDocs.compute({ A1: "=TODAY()", A2: "=NOW()" });
  ok("TODAY() is today", today.A1 === L.formula.isoDay(now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate()) && today.A2 > today.A1 && today.A2 < today.A1 + 1, today);

  // --- every function has its line in the fx list; none goes to the AI ---------------------------------------
  L.suite.entries();
  var und = L.suite.undescribed || [];
  ok("every registered function is described somewhere", !und.length, und);
  var names = L.formula.names();
  ok("Excel's functions are registered (" + names.length + ")", ["SUMIF", "VLOOKUP", "XLOOKUP", "TEXT", "DATEDIF", "PMT", "IRR", "NORM.DIST", "TEXTJOIN", "NETWORKDAYS.INTL"].every(function (n) { return names.indexOf(n) >= 0; }));
  var overview = L.suite.catalog ? L.suite.catalog("").text : "";
  ok("the AI's catalog of Lantern is no longer for them (rule 5)", overview && !/VLOOKUP|SUMIF|NETWORKDAYS/.test(overview) && !/VLOOKUP|SUMIF/.test(String(L.assistBuiltins || "")), overview.length);
  ok("Lantern's POWER is still the physics one (energy / time); POW is x to a power", out && L.sheetDocs.compute({ A1: "=POWER(100,4)", A2: "=POW(2,10)" }).A1 === 25 && L.sheetDocs.compute({ A2: "=POW(2,10)" }).A2 === 1024);
  var find = L.formulaFind;
  ok("fx finds by a word: loan -> PMT", find("loan")[0].n === "PMT", find("loan").slice(0, 3).map(function (h) { return h.n; }));
  ok("fx finds by name: vlook -> VLOOKUP", find("vlook")[0].n === "VLOOKUP");
  ok("fx finds by a word: age -> DATEDIF", find("age")[0].n === "DATEDIF", find("age").slice(0, 3).map(function (h) { return h.n; }));
  ok("fx finds Lantern's own: force -> FORCE (Science and units)", find("force").some(function (h) { return h.n === "FORCE" && h.cat === "Science and units"; }));
  ok("fx by kind: Money has PMT, not SUM", find("", "Money").some(function (h) { return h.n === "PMT"; }) && !find("", "Money").some(function (h) { return h.n === "SUM"; }));

  // --- in the grid --------------------------------------------------------------------------------------------
  var id = L.sheetDocs.create("Functions", {});
  w.location.hash = "sheet"; fire(w, "hashchange"); await sleep(80);
  L.sheetDocs.open(id); await sleep(40);
  ok("the sheet is open", !!td("A1") && !!bar());
  enter("A1", "2026-11-17"); enter("A2", "=A1+30"); enter("A3", "=EDATE(A1,1)"); enter("A4", "=A1"); enter("A5", "=MAX(A1:A2)");
  enter("A6", "=A2-A1"); enter("A7", "=DATE(2026,12,25)"); enter("A8", "=TEXT(A1,\"d mmm yyyy\")"); enter("A9", "=VLOOKUP(\"x\",A1:B2,2,FALSE)");
  var shown = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"].map(function (r) { return td(r).textContent; });
  ok("dates show as dates; the days between as a number; a lookup that finds nothing as #N/A",
    JSON.stringify(shown) === JSON.stringify(["2026-11-17", "2026-12-17", "2026-12-17", "2026-11-17", "2026-12-17", "30", "2026-12-25", "17 Nov 2026", "#N/A"]), shown);
  var fx = Array.prototype.filter.call(d.querySelectorAll(".fbar button"), function (b) { return b.textContent === "fx"; })[0];
  ok("an fx button beside the formula bar", !!fx);
  clickCell("B1");
  fx.click(); await sleep(10);
  var panel = d.querySelector(".fx-panel"), q = panel && panel.querySelector("input");
  ok("fx opens a list to search, with the search box ready", !!panel && d.activeElement === q && panel.querySelectorAll(".fx-item").length > 100, panel && panel.querySelectorAll(".fx-item").length);
  q.value = "add up if"; fire(q, "input");
  var first = panel.querySelector(".fx-item");
  ok("searching 'add up if' puts SUMIF first", first && /^SUMIF\(/.test(first.querySelector("code").textContent), first && first.textContent);
  first.click(); await sleep(10);
  ok("choosing it starts the formula in B1: =SUMIF(", bar().value === "=SUMIF(" && !d.querySelector(".fx-panel") && d.activeElement === bar(), bar().value);
  typeInBar("=A6+"); fx.click(); await sleep(10);
  q = d.querySelector(".fx-panel input"); q.value = "round"; fire(q, "input");
  key(q, "Enter"); await sleep(10);
  ok("typing =A6+ then fx, round, Enter: =A6+ROUND(", bar().value === "=A6+ROUND(", bar().value);
  typeInBar("=A6+ROUND(2.345,2)"); key(bar(), "Enter");
  ok("...and it works out: 32.35", td("B1").textContent === "32.35", td("B1").textContent);
  fx.click(); await sleep(10); key(d.querySelector(".fx-panel input"), "Escape");
  ok("Escape closes the list", !d.querySelector(".fx-panel"));
  ok("no errors in the page", !errs.length, errs);

  console.log(fails ? fails + " SHEET FUNCTION FAILURES (" + passes + " passed)" : "ALL SHEET FUNCTION CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
