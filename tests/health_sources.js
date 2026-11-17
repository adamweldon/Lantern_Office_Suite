// health_sources.js -- every Health lesson names the published guidance it follows (1.24.22).
// Adam, 2026-11-17: "let's go ahead and add it as it is only positive. I see no negatives to stating the source".
// The sources were named only in the modules' comments. Each lesson now shows a line under it -- "Sources: ...
// Checked against these in November 2026." -- printed with it, and the tile's tools say where their figures come
// from. The lines are the ones separate checkers confirmed against pages they opened
// (tests/fixtures/health_sources_1262.json keeps each line and the pages); a change to one is a decision, not a slip.
// The line is not searched and not sent to the AI with the lesson (rule 5: keep the prompt short).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FIX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "health_sources_1262.json"), "utf8"));
function load(strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new TypeError("no model in this test")); };
  w.print = function () {};
  w.eval(js);
  return { w: w, L: w.Lantern, d: w.document, errs: errs };
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
var TAIL = ". Checked against these in November 2026.";

(function () {
  var o = load(), L = o.L, d = o.d, ML = L.mathLessons;
  ok("boot clean", o.errs.length === 0, o.errs);
  var KEYS = ML.list().map(function (l) { return l.key; }).filter(function (k) { return /^health_/.test(k); });
  var byId = {};
  FIX.lessons.forEach(function (f) { byId[f.id] = f; });

  // --- the checkers' record -----------------------------------------------------------------
  ok("the record covers the 42 lessons, no more", KEYS.length === 42 && FIX.lessons.length === 42 && KEYS.every(function (k) { return byId[k]; }), [KEYS.length, FIX.lessons.length]);
  var noPage = FIX.lessons.filter(function (f) { return !(f.opened || []).some(function (p) { return p.opened && /^https?:\/\//.test(p.url || ""); }); });
  ok("every line rests on at least one page a checker opened", !noPage.length, noPage.map(function (f) { return f.id; }));

  // --- each lesson's line ---------------------------------------------------------------------
  var wrong = KEYS.filter(function (k) { return ML.get(k).sources !== "Sources: " + byId[k].source_line + TAIL; });
  ok("each lesson's sources are the checked line, word for word", !wrong.length, wrong.map(function (k) { return [k, ML.get(k).sources]; }));
  ok("plain words: ASCII, no web addresses in the line", KEYS.every(function (k) { var s = ML.get(k).sources; return /^[\x20-\x7e]+$/.test(s) && !/https?:|www\./.test(s); }));
  ok("the line is kept apart from the lesson's own text", KEYS.every(function (k) { return ML.get(k).html.indexOf("Sources:") < 0; }));
  // what each line must name -- the bodies whose figures the lesson carries (health.js pins the figures)
  var MUST = {
    health_cpr: /Resuscitation Council UK/, health_emergency: /Resuscitation Council UK/, health_first: /Resuscitation Council UK/,
    health_breathing: /Integrated Management of Childhood Illness/, health_danger: /Integrated Management of Childhood Illness/,
    health_diarrhoea: /WHO/, health_water: /CDC/, health_pregnancy: /WHO/, health_head: /NICE|NHS/, health_mind: /Psychological first aid/i
  };
  Object.keys(MUST).forEach(function (k) { ok(k + " names " + MUST[k].source, MUST[k].test(ML.get(k).sources), ML.get(k).sources); });

  // --- shown under the lesson, and printed with it -----------------------------------------------
  var shown = 0, last = 0;
  KEYS.forEach(function (k) {
    ML.open(k);
    var ov = d.querySelector(".lesson-overlay"), body = ov && ov.querySelector(".lesson-body");
    var p = body && body.querySelector("p.lesson-sources");
    if (p && p.textContent === ML.get(k).sources) shown++;
    if (p && body.lastElementChild === p) last++;
    if (ov) all(ov, ".guide-head button").pop().click();
  });
  ok("every lesson shows its sources", shown === 42, shown);
  ok("...as its last line, under the advice to get trained help", last === 42, last);
  ML.open("health_cpr");
  var ov = d.querySelector(".lesson-overlay"), pr = all(ov, ".guide-head button").filter(function (b) { return b.textContent === "Print"; })[0];
  ok("Print prints the lesson's own body, sources and all", pr && ov.querySelector(".lesson-body .lesson-sources"), !!pr);
  all(ov, ".guide-head button").pop().click();

  // --- not searched, not sent ---------------------------------------------------------------------
  var S = L.suite;
  if (S && S.search) {
    var hits = S.search("Resuscitation Council guidelines", { kinds: { lesson: 1 }, max: 10 }) || [];
    ok("a source's name finds no Health lesson (the line is not searched)", !hits.some(function (h) { return /^health_/.test(h.e && h.e.id || ""); }), hits.map(function (h) { return h.e && h.e.id; }));
    var e = (S.entries ? S.entries() : []).filter(function (x) { return x.id === "health_cpr"; })[0];
    if (e) ok("the lesson the AI is given has no sources line", S.text(e).indexOf("Checked against these") < 0);
  }

  // --- a lesson with no sources is as before ------------------------------------------------------
  ML.add("zz_plain", "A plain lesson", "<p>Nothing to cite.</p>");
  ML.open("zz_plain");
  var ov2 = d.querySelector(".lesson-overlay");
  ok("a lesson added without sources shows none", ML.get("zz_plain").sources === "" && !ov2.querySelector(".lesson-sources"));
  all(ov2, ".guide-head button").pop().click();

  // --- the tile's own tools and cards ---------------------------------------------------------------
  var ws = d.createElement("div"); d.body.appendChild(ws); L.apps.health.mount(ws);
  var tool = function (id) { var b = ws.querySelector(".health-tool[data-tool='" + id + "']"); return b ? b.textContent : ""; };
  var ors = all(ws, "p.health-sources").map(function (p) { return p.textContent; });
  ok("the ORS mixer says where its recipe comes from", ors.some(function (t) { return /ORS/.test(t) && /WHO/.test(t); }), ors);
  ok("the breath and pulse counter names WHO's chart booklet and MedlinePlus", /Sources: .*Integrated Management of Childhood Illness.*MedlinePlus/.test(tool("count")), tool("count").slice(-300));
  ok("bleach for water names the CDC's table", /Sources: .*CDC/.test(tool("bleach")), tool("bleach").slice(-300));
  var cardBtn = all(ws, "button").filter(function (b) { return b.textContent === "Print survival cards"; })[0];
  cardBtn.click();
  var cards = d.querySelector(".print-area");
  ok("the printed survival cards carry their sources", cards && /Sources: /.test(cards.textContent) && /Resuscitation Council UK/.test(cards.textContent), cards && cards.textContent.slice(-400));

  // --- each lesson module still drops (rule 11) -----------------------------------------------------
  var o3 = load(["HEALTH_LESSONS_WASH", "HEALTH_LESSONS_BIRTH", "HEALTH_COUNT", "HEALTH_BLEACH"]);
  ok("modules dropped: still boots, the rest keep their sources", !o3.errs.length && o3.L.mathLessons.get("health_cpr").sources.indexOf("Sources: ") === 0 && !o3.L.mathLessons.get("health_kit"), o3.errs);

  console.log(fails ? fails + " HEALTH SOURCES FAILURES (" + passes + " passed)" : "ALL HEALTH SOURCES CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
