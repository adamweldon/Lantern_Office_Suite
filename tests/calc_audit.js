// calc_audit.js -- the Calculator after the app audit (1.16.0): what a
// TI-30 / fx-991 user expects after =, with errors, memory and the keyboard,
// and the shared number formatting and formula fixes found with it (very
// small and very large numbers, percent, ROUND/MOD as Excel, trig at 90
// degrees, LOG(x,base), FACT of a fraction, cancellation noise).
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
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 500)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function keyBtn(label) {
  var b = Array.prototype.filter.call(d.querySelectorAll(".calcbox button"), function (x) { return x.textContent === label; })[0];
  if (!b) throw new Error("no key " + label);
  return b;
}
function press() { Array.prototype.slice.call(arguments).forEach(function (k) { keyBtn(k).click(); }); }
function type(s) { s.split("").forEach(function (ch) { d.body.dispatchEvent(new w.KeyboardEvent("keydown", { key: ch, bubbles: true, cancelable: true })); }); }
function keyName(k, o) { var opts = { key: k, bubbles: true, cancelable: true }; Object.keys(o || {}).forEach(function (x) { opts[x] = o[x]; }); var e = new w.KeyboardEvent("keydown", opts); d.body.dispatchEvent(e); return e; }
function shown() { return { expr: d.querySelector(".cdisp .expr").textContent, res: d.querySelector(".cdisp .res").textContent, st: d.querySelector(".cdisp .cstat").textContent }; }
var X = "×", MINUS = "−", DIV = "÷", BACK = "⌫";

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var F = w.Lantern.formula, fmt = w.Lantern.fmtNum;
  function ev(s, deg) { try { return fmt(F.evaluate(s, { deg: deg !== false, ans: -4 })); } catch (e) { return "ERR " + e.message; } }

  // --- the shared formatting and formula fixes --------------------------------------------
  ok("fmtNum: Planck's constant x2 and Boltzmann x300 are not 0; 10^300 and 170! are not Infinity; 1/123456789 keeps its digits",
    ev("6.62607015e-34*2") === "1.32521403e-33" && ev("1.380649e-23*300") === "4.141947e-21" && ev("10^300") === "1e+300" &&
    ev("FACT(170)") === "7.25741561531e+306" && ev("1/123456789") === "8.10000007371e-9", [ev("6.62607015e-34*2"), ev("10^300"), ev("1/123456789")]);
  ok("...and ordinary results are as before (0.1+0.2 = 0.3, 1/3*3 = 1, 100-99.99 = 0.01)", ev("0.1+0.2") === "0.3" && ev("1/3*3") === "1" && ev("100-99.99") === "0.01");
  ok("cancellation noise is 0: 0.1*3-0.3", ev("0.1*3-0.3") === "0", ev("0.1*3-0.3"));
  ok("percent: 50% = 0.5, 200*5% = 10, 50%+10 = 10.5; 17%5 is still the remainder 2",
    ev("50%") === "0.5" && ev("200*5%") === "10" && ev("50%+10") === "10.5" && ev("17%5") === "2");
  ok("trig at quarter turns: SIN(180) = 0, COS(90) = 0, TAN(45) = 1, TAN(90) is undefined; in radians SIN(PI) = 0",
    ev("SIN(180)") === "0" && ev("COS(90)") === "0" && ev("TAN(45)") === "1" && /TAN of 90 degrees is undefined/.test(ev("TAN(90)")) && ev("SIN(PI)", false) === "0" && ev("SIN(30)") === "0.5");
  ok("LOG(8,2) = 3 (LOG(100) = 2); FACT(2.5) is an error; FACT(5) = 120", ev("LOG(8,2)") === "3" && ev("LOG(100)") === "2" && /whole number/.test(ev("FACT(2.5)")) && ev("FACT(5)") === "120");
  ok("MOD and ROUND as Excel: MOD(-7,3) = 2, MOD(7,-3) = -2, MOD(5,0) an error; ROUND(-2.5) = -3, ROUND(1.005,2) = 1.01",
    ev("MOD(-7,3)") === "2" && ev("MOD(7,-3)") === "-2" && /Divide by zero/.test(ev("MOD(5,0)")) && ev("ROUND(-2.5)") === "-3" && ev("ROUND(1.005,2)") === "1.01" && ev("ROUND(2.5)") === "3");

  // --- the Calculator ---------------------------------------------------------------------------
  w.Lantern.store.set("calc.mem", 0); w.Lantern.store.set("calc.deg", true);
  w.location.hash = "calc"; fire(w, "hashchange"); await sleep(60);
  press("2", "+", "3", "=");
  ok("after =, the sum stays above the answer", shown().expr === "2+3 =" && shown().res === "5", shown());
  press("7");
  ok("a number after = starts a new calculation (not 57)", shown().expr === "7", shown());
  press("C", "1", DIV, "3", "=", X, "3", "=");
  ok("an operator after = goes on from the answer itself: 1/3 = x3 = 1 (not 0.9999999999)", shown().res === "1" && shown().expr === "ANS*3 =", shown());
  press("C", "2", MINUS, "6", "=", "x²", "=");
  ok("2-6 = then x² = 16 (not -16)", shown().res === "16", shown());
  // the guide's memory example: 12 x 4 = M+, 5 x 3 = M+, MR shows 63
  press("MC", "1", "2", X, "4", "=", "M+", "5", X, "3", "=", "M+", "C", "MR", "=");
  ok("the guide's memory example gives 63, and the display shows M", shown().res === "63" && /M/.test(shown().st), shown());
  press("C", "5", "+", "M+");
  ok("M+ on an unfinished sum adds nothing and says so", /nothing to add to memory/.test(shown().res) && w.Lantern.store.get("calc.mem", 0) === 63, [shown(), w.Lantern.store.get("calc.mem", 0)]);
  press("C", "2", "MR", "=");
  ok("a value after a number multiplies it: 2 MR = 126", shown().res === "126", shown());
  press("C", "2", "π", "=");
  ok("2 π = 6.28... (2*PI)", /^6\.283185307/.test(shown().res) && shown().expr === "2*PI =", shown());
  press("C", "2", "e", "+", "1", "=");
  ok("2 e +1 = 6.43... (2*E+1, not 2E+1 = 20)", /^6\.43656/.test(shown().res), shown());
  press("C", "5", "10ˣ", "3", "=");
  ok("5 10ˣ 3 = 5000 (not 510^3)", shown().res === "5000", shown());
  press("C", "sin", "3", "0", "=");
  ok("sin 3 0 = closes the bracket: 0.5", shown().res === "0.5" && shown().expr === "SIN(30) =", shown());
  press("C", "1", DIV, "0", "=");
  ok("an error keeps the expression and says why", shown().expr === "1/0" && /^Error: Divide by zero/.test(shown().res), shown());
  press(BACK, "5", "=");
  ok("...so it can be corrected: 1/5 = 0.2", shown().res === "0.2", shown());
  var hist = w.Lantern.store.get("calc.history", []).length;
  press("=", "=");
  ok("= again adds nothing to the history", w.Lantern.store.get("calc.history", []).length === hist);
  press("C", "sin");
  press(BACK);
  ok("Backspace after sin removes the whole SIN(", shown().expr === " ", shown());
  press("C", "=");
  ok("= on an empty display does nothing (no Error)", shown().res === "0", shown());
  press("C", "tan", "9", "0", "=");
  ok("tan 90 = says it is undefined", /undefined/.test(shown().res), shown());

  // --- the keyboard ---------------------------------------------------------------------------
  press("C");
  type("sqrt(16)"); keyName("Enter");
  ok("typed sqrt(16) = 4 (letters used to be dropped: 16)", shown().res === "4", shown());
  press("C"); type("6.02e23*2"); keyName("Enter");
  ok("typed 6.02e23*2 keeps its e: 1.204e+24", shown().res === "1.204e+24", shown());
  press("C"); type("IF(5>3,1,0)"); keyName("Enter");
  ok("typed IF(5>3,1,0) = 1", shown().res === "1", shown());
  press("C"); type("12+3");
  var z = keyName("-", { ctrlKey: true });
  ok("Ctrl+- is left to the browser (zoom), not typed", shown().expr === "12+3" && !z.defaultPrevented, shown());
  keyName("Escape");
  ok("Esc clears", shown().expr === " ");
  type("12+34");
  var hb = Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return b.textContent === "History"; })[0];
  hb.click(); await sleep(10);
  keyName("Escape");
  ok("Esc with History open closes History and keeps the sum", !d.querySelector(".guide-overlay") && shown().expr === "12+34", shown());
  var cb = Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return b.textContent === "Constants"; })[0];
  cb.click(); await sleep(10);
  type("5");
  ok("typing while Constants is open does not change the sum behind it", shown().expr === "12+34", shown());
  var g = Array.prototype.filter.call(d.querySelectorAll(".guide-overlay .item .grow"), function (x) { return /^g = /.test(x.textContent); })[0];
  g.click(); await sleep(10);
  ok("a constant after a number multiplies it (12+34*9.80665)", shown().expr === "12+34*9.80665", shown());
  type("+1"); keyName("Enter");
  ok("after the dialog closed, typing reaches the calculator again", shown().expr === "12+34*9.80665+1 =", shown());
  hb.click(); await sleep(10);
  var first = d.querySelector(".guide-overlay .item .grow"); first.click(); await sleep(10);
  ok("a history entry after = starts a new calculation with its value", /^346\.42/.test(shown().expr), shown());

  // --- memory and RAD kept ----------------------------------------------------------------------
  keyBtn("DEG").click();
  ok("RAD shows on the display", /RAD/.test(shown().st), shown());
  w.location.hash = "home"; fire(w, "hashchange"); await sleep(30); w.location.hash = "calc"; fire(w, "hashchange"); await sleep(40);
  ok("memory and RAD are kept when the calculator opens again", /RAD/.test(shown().st) && /M/.test(shown().st) && !!keyBtn("RAD"), shown());
  keyBtn("RAD").click();

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? "CALC AUDIT FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL CALC AUDIT TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
