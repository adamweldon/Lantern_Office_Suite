// draw_symbols.js -- Draw's schematic symbols (1.15.0), from Adam's
// Hydraulics drawing (2026-10-29): right-clicking a placed flow arrow did not
// delete it (the right button placed a new arrow first, and the delete took
// that one), and a flow arrow could only point right. Now: only the main
// button places or draws; Turn (or the R key) turns the symbols a quarter
// turn, with the arrow in the button's name turning too; a faint preview
// follows the pointer (not for Label, which asks for its text).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, prompts = 0;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.prompt = function () { prompts++; return "P1"; };
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function mouse(el, type, x, y, opts) {
  var o = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
  Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
  el.dispatchEvent(new w.MouseEvent(type, o));
}
function btn(re) { return Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return re.test(b.textContent); })[0]; }
function scene() { return w.Lantern.store.get("draw.scene", []); }
// the points of every path and triangle in a shape, flattened
function pts(o) { return o.t === "group" ? [].concat.apply([], o.shapes.map(pts)) : (o.pts || []); }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  w.Lantern.store.set("draw.scene", []);
  // a 2D context that draws nothing but notes the faint preview (opacity 0.35)
  var faint = 0, alpha = 1;
  var fake = new Proxy({}, {
    get: function (o, k) { if (k === "globalAlpha") return alpha; if (k in o) return o[k]; return function () { return { width: 10 }; }; },
    set: function (o, k, v) { if (k === "globalAlpha") { alpha = v; if (v === 0.35) faint++; } else o[k] = v; return true; }
  });
  w.HTMLCanvasElement.prototype.getContext = function () { return fake; };
  w.location.hash = "draw"; fire(w, "hashchange");
  await sleep(80);
  var cv = d.querySelector("canvas.pad");
  ok("Draw is open", !!cv);
  cv.getBoundingClientRect = function () { return { left: 0, top: 0, width: cv.width, height: cv.height }; };
  var sel = d.querySelector("select[aria-label=\x22Drawing mode\x22]");
  sel.value = String(w.Lantern.drawModes.map(function (m) { return m.id; }).indexOf("hydraulic"));
  fire(sel, "change");
  await sleep(20);
  btn(/^Flow →$/).click();
  ok("the symbols have a Turn button at 0°, and the hint says how to turn and delete", !!btn(/^Turn ↻ 0°$/) &&
    /Turn ↻ \x28or the R key\x29 turns it a quarter turn\. Right-click a placed symbol, or use the Eraser, to delete it\./.test(d.body.textContent));

  // --- place one pointing right, then one turned to point down ---------------------
  mouse(cv, "mousedown", 100, 100); mouse(w, "mouseup", 100, 100);
  var a = scene()[0];
  ok("a flow arrow placed as before: pointing right", scene().length === 1 && pts(a).some(function (p) { return p[0] === 124 && p[1] === 100; }) &&
    pts(a).every(function (p) { return p[0] <= 124; }), pts(a));
  btn(/^Turn ↻ 0°$/).click();
  ok("Turn: 90°, and the arrow in the button's name points down", !!btn(/^Turn ↻ 90°$/) && !!btn(/^Flow ↓$/) && /\x28turned 90°\x29/.test(d.body.textContent));
  mouse(cv, "mousedown", 300, 100); mouse(w, "mouseup", 300, 100);
  var b = scene()[1];
  ok("...placed: it points down, about the same spot (the tip below it)", scene().length === 2 && pts(b).some(function (p) { return p[0] === 300 && p[1] === 124; }) &&
    pts(b).every(function (p) { return p[1] <= 124 && Math.abs(p[0] - 300) <= 6; }), pts(b));

  // --- the R key ---------------------------------------------------------------------------
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true }));
  ok("R turns it again: 180°, pointing left", !!btn(/^Turn ↻ 180°$/) && !!btn(/^Flow ←$/));
  var num = d.querySelector("input.wnum");
  num.dispatchEvent(new w.KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true }));
  ok("...but not while typing in a box", !!btn(/^Turn ↻ 180°$/));
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "r", bubbles: true }));
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "r", bubbles: true }));
  faint = 0; mouse(cv, "mousemove", 420, 240);
  ok("a faint preview of the symbol follows the pointer", faint > 0, faint);
  ok("four turns come back to 0°", !!btn(/^Turn ↻ 0°$/) && !!btn(/^Flow →$/));

  // --- right-click deletes only --------------------------------------------------------
  mouse(cv, "mousedown", 100, 100, { button: 2 }); mouse(cv, "contextmenu", 100, 100, { button: 2 }); mouse(w, "mouseup", 100, 100, { button: 2 });
  ok("right-clicking the first arrow deletes it, and places nothing", scene().length === 1 && JSON.stringify(scene()[0]) === JSON.stringify(b), scene().length);
  mouse(cv, "mousedown", 500, 300, { ctrlKey: true }); mouse(cv, "contextmenu", 500, 300, { ctrlKey: true }); mouse(w, "mouseup", 500, 300);
  ok("a Mac's Ctrl-click on empty canvas places nothing either", scene().length === 1);
  btn(/^Pen$/).click();
  mouse(cv, "mousedown", 300, 100, { button: 2 }); mouse(cv, "contextmenu", 300, 100, { button: 2 }); mouse(w, "mouseup", 300, 100, { button: 2 });
  ok("with the Pen, right-clicking a symbol deletes it and leaves no dot", scene().length === 0, scene());

  // --- other symbols turn too; Label is never previewed ----------------------------------
  btn(/^Cylinder$/).click();
  btn(/^Turn ↻ 0°$/).click();
  mouse(cv, "mousedown", 200, 200); mouse(w, "mouseup", 200, 200);
  var c = scene()[0], body = c.shapes.filter(function (s) { return s.t === "rect"; })[0];
  ok("a cylinder turned 90° stands up (its body 24 wide, 60 tall)", body && body.rw === 24 && body.rh === 60, body);
  btn(/^Label$/).click();
  mouse(cv, "mousemove", 260, 260); mouse(cv, "mousemove", 280, 280);
  ok("moving over the canvas with Label chosen never asks for its text", prompts === 0, prompts);
  mouse(cv, "mousedown", 280, 280); mouse(w, "mouseup", 280, 280);
  var lab = scene()[scene().length - 1];
  ok("...a tap does, and the words stay upright at the tap", prompts === 1 && lab.t === "text" && lab.s === "P1" && lab.x === 280 && lab.y === 280, lab);
  sel.value = String(w.Lantern.drawModes.map(function (m) { return m.id; }).indexOf("pneumatic"));
  fire(sel, "change");
  await sleep(20);
  ok("another mode starts unturned", !!btn(/^Turn ↻ 0°$/) && !!btn(/^Flow →$/));

  // --- turn() itself ------------------------------------------------------------------------
  var S = w.Lantern.drawShapes, r = S.turn({ t: "rect", c: "#000", w: 3, x: 10, y: 20, rw: 40, rh: 10 }, 1, 0, 0);
  ok("turn(): a rectangle a quarter turn about the origin", r.x === -30 && r.y === 10 && r.rw === 10 && r.rh === 40, r);
  var t0 = { t: "path", c: "#000", w: 3, pts: [[1, 2]] };
  ok("turn(): no turn is the same shape; four turns come back", S.turn(t0, 0, 5, 5) === t0 && JSON.stringify(S.turn(t0, 4, 5, 5)) === JSON.stringify(t0) &&
    JSON.stringify(S.turn(S.turn(t0, 3, 5, 5), 1, 5, 5).pts) === JSON.stringify(t0.pts));

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? "DRAW SYMBOL TESTS FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL DRAW SYMBOL TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
