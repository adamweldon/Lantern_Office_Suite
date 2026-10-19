// Rule 11 proof for the composition modules: remove each one in turn, boot
// the suite (bundle timing), open Compose and every tab, open a Writer
// document and press every Writer tool. Any exception fails the test.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var MODS = ["COMPOSE_TEXT", "COMPOSE_RULES", "COMPOSE_RULES_USAGE", "COMPOSE_SPELL", "COMPOSE_CHECK", "COMPOSE_CHECK_STYLE",
  "COMPOSE_THESAURUS", "COMPOSE_INFLECT", "COMPOSE_THESAURUS_B", "COMPOSE_DOM", "WRITER_CHECK", "WRITER_WORDS", "WRITER_SPEAK",
  "WRITER_TEMPLATES_LETTERS", "WRITER_TEMPLATES_WORK", "WRITER_TEMPLATES_STUDY", "COMPOSE_TASKS_LIFE", "COMPOSE_TASKS_STUDY",
  "COMPOSE_TASKS_WORK", "COMPOSE_KIT", "COMPOSE_APP", "COMPOSE_PROMPTS", "COMPOSE_PRACTICE", "COMPOSE_MERGE",
  "COMPOSE_LESSONS_BASICS", "COMPOSE_LESSONS_STYLE", "COMPOSE_LESSONS_FORMS", "COMPOSE_LESSONS_LIFE",
  "CARDS_STARTERS_WRITING", "GUIDE_COMPOSE", "LOCALE_COMPOSE", "COMPOSE_SELFTEST"];
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
  if (L.apps.compose) {
    go("compose"); await sleep(10);
    var tabs = d.querySelectorAll(".lc-tabs button");
    for (var i = 0; i < tabs.length; i++) { d.querySelectorAll(".lc-tabs button")[i].click(); await sleep(5); }
    d.querySelectorAll(".lc-tabs button")[0].click(); await sleep(5);
    var card = d.querySelector(".lc-card");
    if (card) { card.click(); await sleep(5); }
  }
  if (L.writerDocs) {
    L.writerDocs.open(L.writerDocs.create("t", "<p>i recieve the the letter. It was very good.</p>")); await sleep(20);
    var bs = Array.prototype.slice.call(d.querySelectorAll(".toolbar button")).filter(function (b) {
      return /Check|Words|Read aloud/.test(b.textContent); });
    bs.forEach(function (b) { try { b.click(); } catch (e) { errs.push("click: " + e.message); } });
    await sleep(10);
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
  console.log(fails ? fails + " ISOLATION FAILURES" : "ALL " + MODS.length + " COMPOSE MODULES ISOLATED");
  process.exit(fails ? 1 : 0);
})();
