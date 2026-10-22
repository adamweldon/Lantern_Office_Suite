// Rule 11 proof for the AI layer: remove each AI module in turn, boot the
// suite (bundle timing), open the AI app (every section), Assist in AI-model
// mode, Chat, Text Reader and Music, and run every selftest. Any exception fails the test.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var MODS = ["PLANET_DATA", "AI_RECIPES", "AI_ENGINE", "AI_GUARD", "AI_CHECKS", "AI_DEVICE", "AI_BENCH_DATA", "AI_BENCH", "AI_PROMPT", "AI_APP", "AI_PANEL_DEVICE", "AI_PANEL_SERVER",
  "AI_PANEL_BENCH", "PWA_SITE", "GUIDE_AI_SETUP", "AI_SELFTEST", "ASSIST_CHAT",
  "LIBRARY_ENGINE", "LIBRARY_CHECKS", "LIBRARY_PANEL", "LIBRARY_BENCH_DATA", "AI_ACTIONS", "AI_SCHEMATIC", "AI_DRAW", "AI_SHEET", "AI_MAKE_BENCH_DATA", "AI_CHAT_BENCH_DATA",
  "TEXT_FUNCS", "AI_PUZZLE", "AI_PUZZLE_TRACK", "AI_PUZZLE_TURN", "AI_PUZZLE_SOLVE", "AI_PUZZLE_BENCH_DATA",
  "TEXT_READER_IMAGE", "TEXT_READER_LAYOUT", "TEXT_READER_GLYPHS", "TEXT_READER_WORDS", "TEXT_READER", "PDF_PARSE", "PDF_CCITT", "PDF_PAGES", "PDF_TEXT",
  "PDF_WRITE", "HANDWRITING_READER", "TEXT_READER_DOCS", "TEXT_READER_VIEW", "TEXT_READER_APP", "TEXT_READER_CHAT", "SHEET_MUSIC_ENGINE", "SHEET_MUSIC_APP",
  "GUIDE_TEXT_READER", "TEXT_READER_BENCH_DATA", "SUITE_TEXT", "SUITE_COMMAND_LIST", "SUITE_INDEX", "SUITE_LIST", "SUITE_SEARCH", "SUITE_PASSAGES",
  "SUITE_CATALOG", "SUITE_CARD", "SUITE_CHAT", "SUITE_COMMANDS", "IMAGE_SHRINK", "CHAT_PICTURES", "SUITE_PANEL", "GUIDE_SUITE", "SUITE_BENCH_DATA",
  "TEXT_READER_PROMPT", "AI_DOC", "AI_SLIDES", "AI_CARDS", "AI_PLAN", "TEXT_READER_READ", "AI_MAKE_DOCS_BENCH_DATA", "GUIDE_MAKE_DOCS",
  "TEXT_READER_CHECK", "TEXT_READER_MISREAD", "PDF_DOC_LAYOUT", "PDF_DOC", "AI_MAKE_ASK", "AI_SCHEMATIC_MORE",
  "AI_DRAW_CHECK", "AI_WHEEL_COLOURS", "AI_WHEEL_LAYOUT", "AI_WHEEL", "AI_WHEEL_CHECK"];
function without(src, name) {
  var a = src.indexOf("// MODULE: " + name + " - START"), b = src.indexOf("// MODULE: " + name + " - END");
  if (a < 0 || b < 0) throw new Error("missing " + name);
  return src.slice(0, a) + "// (removed " + name + ")\n" + src.slice(b + ("// MODULE: " + name + " - END").length);
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function run(variant) {
  var js = variant.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 160)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
    { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, d = w.document;
  w.alert = function () {}; w.confirm = function () { return true; }; w.print = function () {}; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {}; w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.addEventListener("error", function (e) { errs.push("window.error: " + e.message); });
  function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
  function go(h) { w.location.hash = h; fire(w, "hashchange"); }
  try { w.eval(js); } catch (e) { errs.push("eval: " + e.message); }
  await sleep(30);
  var L = w.Lantern;
  w.fetch = function () { return Promise.resolve({ ok: true, json: function () {
    return Promise.resolve({ choices: [{ message: { content: "=2+2\nANSWER: 4" } }] }); } }); };
  ["ai", "assist", "chat", "reader", "music"].forEach(function (h) { if (L.apps[h]) { go(h); } });
  await sleep(10);
  if (L.apps.ai) {
    go("ai"); await sleep(10);
    Array.prototype.slice.call(d.querySelectorAll(".la-choice button")).forEach(function (b) { b.click(); });
    var q = Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return /^Quick run/.test(b.textContent); })[0];
    if (q) { q.click(); await sleep(60); }
  }
  if (L.apps.assist) {
    go("assist"); await sleep(10);
    var m = d.querySelector("select[aria-label=\"Mode\"]");
    if (m) { m.value = "server"; var ev = d.createEvent("Event"); ev.initEvent("change", true, true); m.dispatchEvent(ev); await sleep(5); }
  }
  if (L.selftest) { var r = L.selftest.run(); r.fail.forEach(function (f) { errs.push("selftest " + f.name); }); }
  w.close();
  return { errs: errs, apps: L.order.length };
}

(async function () {
  var fails = 0, base = await run(inner);
  if (base.errs.length) { console.log("FAIL baseline", base.errs); fails++; }
  for (var i = 0; i < MODS.length; i++) {
    var r = await run(without(inner, MODS[i]));
    if (r.errs.length) { fails++; console.log("FAIL without " + MODS[i] + ": " + r.errs.slice(0, 3).join(" | ")); }
  }
  console.log(fails ? fails + " ISOLATION FAILURES" : "ALL " + MODS.length + " AI MODULES ISOLATED");
  process.exit(fails ? 1 : 0);
})();
