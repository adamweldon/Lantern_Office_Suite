// sheet_names.js -- MAKE SHEET formulas by column name (1.18.0): the AI
// names the columns (=[Qty]*[Price], =SUM([Cost])) and Lantern writes the
// cell names, so a formula copied down a column can never point at the
// wrong row; a formula written with cell names that looks at another row
// than the rest of its column goes back with the formula to write. And the
// correction turn of every MAKE kind repeats how Lantern reads it.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function fire(el, t) { var e = w.document.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
w.eval(js);
fire(w.document, "DOMContentLoaded");
var L = w.Lantern, act = L.aiAct;
function sheet(lines) { return act.build("MAKE SHEET: T\n" + lines.join("\n") + "\nEND", "make a table"); }
var r = sheet(["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Price]", "Milk | 1 | 0.99 | =[Qty]*[Price]", "Eggs | 12 | 0.25 | =[qty]*[price]", "Total | | | =SUM([Cost])"]);
ok("[Name] is this row's cell under that header; SUM([Name]) the rows above", r.ok && r.plan.cells.D2 === "=B2*C2" && r.plan.cells.D4 === "=B4*C4" && r.plan.cells.D5 === "=SUM(D2:D4)" && r.plan.values.D5 === 6.99, r.plan && r.plan.cells);
var item = L.aiBenchQuestions.filter(function (q) { return q.id === "make-shopping"; })[0];
ok("...and the bench's shopping question passes it", L.aiBench.grade(item, "x", { made: sheet(["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Qty]*[Price]", "Milk | 1 | 0.99 | =[Qty]*[Price]", "Eggs | 12 | 0.25 | =[Qty]*[Price]", "Total | | | =SUM([Cost])"]) }).pass);
r = sheet(["Wall area m2 | Litres per m2 | Litres", "24 | 0.1 | =[Wall area]*[Litres per m2]"]);
ok("a header named in part (the start of it) is found", r.ok && r.plan.cells.C2 === "=A2*B2", r.problems);
r = sheet(["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Quantity]*[Price]"]);
ok("a name that is no column goes back once, with the columns there are", !r.ok && r.problems.length === 1 && /D2 \(=\[Quantity\]\*\[Price\]\) names \[Quantity\], which is not a column \(the columns are Item, Qty, Price, Cost\)/.test(r.problems[0]), r.problems);
r = sheet(["Item | Cost", "Total | =SUM([Cost])"]);
ok("a total with no rows above it goes back", !r.ok && /adds up \[Cost\] above it, but there are no rows above it/.test(r.problems[0]), r.problems);
r = sheet(["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Milk | 1 | 0.99 | =B2*C2", "Eggs | 12 | 0.25 | =B4*C4", "Jam | 1 | 3 | =B5*C5", "Total | | | =SUM(D2:D5)"]);
ok("a row copied down and not changed goes back, with the formula to write", !r.ok && /D3 \(=B2\*C2\) uses row 2, but the rows around it use their own row: write =B3\*C3/.test(r.problems[0]), r.problems);
r = sheet(["Month | Sales | Change", "Jan | 10 |", "Feb | 12 | =B3-B2", "Mar | 15 | =B4-B3", "Apr | 11 | =B5-B4"]);
ok("...while a column that looks at the row above on purpose (a change from last month) is left alone", r.ok, r.problems);
r = sheet(["X | Y", "1 | =LOG10(A2)", "2 | =LOG10(A3)", "3 | =LOG10(A3)", "4 | =LOG10(A5)"]);
ok("...the formula to write keeps function names whole", /write =LOG10\(A4\)/.test(r.problems.join("|")), r.problems);
var p = act.prompt("make a table of my shopping with a total");
ok("the AI is told it may name the columns", /=\[Qty\]\*\[Price\] uses this row/.test(p) && /=SUM\(\[Litres\]\)/.test(p), p.slice(0, 600));
// --- the correction turn of every kind repeats its lines ---------------------------------------------
var d = act.build("MAKE DRAWING: x\nrect 1 1\nEND", "draw a house"), ft = act.fixText(d, "draw a house");
ok("fixText: a drawing's problem, then how Lantern reads a drawing (up to END, no example)", /^Lantern checked your MAKE DRAWING block: “rect 1 1”: a rect needs 4 numbers\./.test(ft) && /Lantern reads a MAKE DRAWING block like this:/.test(ft) && !/For example/.test(ft), ft);
var s = sheet(["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =[Quantity]*[Price]"]), st = act.fixText(s, "make a table");
ok("...a sheet's", /Lantern reads a MAKE SHEET block like this:\nMAKE SHEET: <title>/.test(st) && /names columns in \[ \]/.test(st), st);
ok("no page errors", !errs.length, errs);
console.log(fails ? fails + " SHEET NAME TESTS FAILED (" + passes + " passed)" : "ALL SHEET NAME TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
