// End-to-end test of the composition suite (Compose app + Writer tools),
// booted the way the self-unpacking bundle runs it (after DOMContentLoaded).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.print = function () {}; w.scrollTo = function () {};
w.URL.createObjectURL = function () { return "blob:x"; }; w.URL.revokeObjectURL = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
// a fake voice so Read aloud can be exercised
var spoken = [];
w.SpeechSynthesisUtterance = function (t) { this.text = t; };
w.speechSynthesis = { getVoices: function () { return [{ name: "Test", lang: "en-US" }]; }, addEventListener: function () {},
  cancel: function () {}, pause: function () {}, resume: function () {}, paused: false, speaking: false,
  speak: function (u) { spoken.push(u.text); setTimeout(function () { u.onend && u.onend(); }, 1); } };
w.addEventListener("error", function (e) { errs.push("window.error: " + e.message); });

var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }

(async function () {
  await sleep(10);
  w.eval(js);
  await sleep(40);
  var L = w.Lantern;
  ok("boot clean", errs.length === 0, errs);
  ok("compose registered next to writer", L.order[L.order.indexOf("writer") + 1] === "compose", L.order.slice(0, 4));
  ok("all tiles on first paint", d.querySelectorAll(".tile").length === L.order.length, [d.querySelectorAll(".tile").length, L.order.length]);
  var st = L.selftest.run();
  ok("selftests all pass", st.fail.length === 0, st.fail);
  ok("compose selftests registered", L.selftest.tests.filter(function (t) { return /^compose:/.test(t.name); }).length === 9);

  // --- Compose: tabs and tasks
  go("compose"); await sleep(20);
  var tabs = Array.prototype.map.call(d.querySelectorAll(".lc-tabs button"), function (b) { return b.textContent; });
  ok("tabs", tabs.join("|") === "Write|Practice|Mail merge|Learn", tabs);
  ok("18 task cards", d.querySelectorAll(".lc-card").length === 18, d.querySelectorAll(".lc-card").length);

  // --- guided request letter
  btn(d, "Request letter").click(); await sleep(10);
  var steps = d.querySelectorAll(".lc-step");
  ok("request steps", steps.length === 9, steps.length);
  function field(i) { return steps[i].querySelector("textarea,input"); }
  ok("date prefilled", field(1).value.length > 5, field(1).value);
  field(0).value = "Amina Bello\nKano"; fire(field(0), "input");
  field(2).value = "The Headteacher\nKano Primary School"; fire(field(2), "input");
  field(3).value = "Request for a transfer letter"; fire(field(3), "input");
  var ta = field(5); btn(steps[5], "I am writing to ask for").click();
  ok("starter inserted", ta.value === "I am writing to ask for ", JSON.stringify(ta.value));
  ta.value += "a transfer letter for my son Musa."; fire(ta, "input");
  field(8).value = "Amina Bello"; fire(field(8), "input");
  ok("draft saved", L.store.get("compose.drafts", {}).request.fields.subject === "Request for a transfer letter");
  btn(d, "Preview").click(); await sleep(5);
  var prev = d.querySelector(".lc-prev").innerHTML;
  ok("preview has subject + greeting + sign-off", /<p><b>Request for a transfer letter<\/b><\/p><p>Dear Sir or Madam,<\/p>/.test(prev) && /Yours faithfully/.test(prev), prev.slice(0, 200));
  ok("preview shows reading level", /reading level/.test(d.querySelector(".lc-meta").textContent));

  // --- open in Writer
  btn(d, "Open in Writer").click(); await sleep(30);
  ok("writer opened the new document", d.body.getAttribute("data-app") === "writer" && !!d.querySelector(".page[contenteditable]"));
  var page = d.querySelector(".page[contenteditable]");
  ok("document title", d.querySelector("input[placeholder='Document title']").value === "Request: Request for a transfer letter");
  ok("document body", /a transfer letter for my son Musa\./.test(page.textContent));
  var tools = Array.prototype.map.call(d.querySelectorAll(".toolbar button"), function (b) { return b.textContent; });
  ok("writer tools present", tools.indexOf("✓ Check") >= 0 && tools.indexOf("Aa Words") >= 0 && tools.indexOf("Read aloud") >= 0, tools);
  ok("live reading line", /Reading level/.test((d.querySelector(".lc-live") || {}).textContent || ""));

  // --- Check + fix all
  page.innerHTML = "<h1>my notes</h1><p>i recieve your letter yesterday and and it was very good.</p><p>Their are alot of things to do.</p>";
  fire(page, "input");
  btn(d, "✓ Check").click(); await sleep(5);
  var rows = d.querySelectorAll(".lc-row");
  ok("check lists issues", rows.length >= 6, rows.length);
  var hm = L.compose.dom.model(page);
  ok("heading excused", !L.compose.check(hm.text, { skip: hm.skip }).some(function (x) { return x.start < 8 && x.rule === "caps"; }),
    L.compose.check(hm.text, { skip: hm.skip }).filter(function (x) { return x.start < 8; }));
  var sub = d.createElement("div");
  sub.innerHTML = "<p><b>Application for the post of Receptionist</b></p><p>I would like to apply for this job today</p>";
  var sm = L.compose.dom.model(sub), ends = L.compose.check(sm.text, { skip: sm.skip }).filter(function (x) { return x.rule === "end"; });
  ok("bold subject line excused from full stop", ends.length === 1 && ends[0].start > 40, ends);
  btn(d, "Fix all safe").click(); await sleep(5);
  ok("fix all safe", page.textContent === "my notesI receive your letter yesterday and it was very good.There are a lot of things to do.", page.textContent);
  ok("style hint kept, not auto-applied", /very good/.test(page.textContent) && Array.prototype.some.call(d.querySelectorAll(".lc-row"), function (r) { return /excellent/.test(r.textContent); }));
  var veryRow = Array.prototype.filter.call(d.querySelectorAll(".lc-row"), function (r) { return /excellent/.test(r.textContent); })[0];
  btn(veryRow, "Change to").click(); await sleep(5);
  ok("single fix applied", /it was excellent\./.test(page.textContent), page.textContent);
  ok("formatting kept", page.querySelector("h1").textContent === "my notes" && page.querySelectorAll("p").length === 2);
  btn(d, "✓ Check").click(); // toggle closed

  // --- Words
  var C = L.compose, M = C.dom.model(page), at = M.text.indexOf("things");
  C.dom.select(M, at, at + 6);
  btn(d, "Aa Words").click(); await sleep(5);
  var chips = Array.prototype.map.call(d.querySelectorAll(".lc-wchips button"), function (b) { return b.textContent; });
  ok("synonyms keep the plural", chips.indexOf("objects") >= 0 && chips.indexOf("items") >= 0, chips);
  btn(d.querySelector(".lc-wchips"), chips[0]).click(); await sleep(5);
  ok("synonym swapped in", page.textContent.indexOf("things") < 0 && page.textContent.indexOf(chips[0]) > 0, page.textContent);

  // --- Read aloud (mock voice)
  w.getSelection().removeAllRanges();
  btn(d, "Read aloud").click(); await sleep(5);
  btn(d, "▶ Read").click(); await sleep(60);
  ok("read aloud speaks each sentence", spoken.length >= 3 && /Finished/.test(d.querySelector(".lc-saynow").textContent), spoken);

  // --- templates
  btn(d, "← Documents").click(); await sleep(5);
  var tsel = d.querySelector("select[aria-label='Choose a template']");
  ok("templates available", tsel && tsel.options.length >= 30, tsel && tsel.options.length);
  var ci = Array.prototype.map.call(tsel.options, function (o) { return o.textContent; }).indexOf("Complaint letter");
  tsel.value = String(ci); btn(d, "+ From template").click(); await sleep(10);
  ok("template opens", /Complaint about/.test(d.querySelector(".page").textContent));

  // --- mail merge
  go("compose"); await sleep(10);
  btn(d.querySelector(".lc-tabs"), "Mail merge").click(); await sleep(5);
  btn(d, "Try an example").click(); await sleep(5);
  ok("merge preview filled", /Dear Grace Akinyi/.test(d.querySelector(".lc-prev").textContent) && /500/.test(d.querySelector(".lc-prev").textContent));
  ok("merge counts rows", /3 people/.test(d.querySelector(".lc-meta").textContent), d.querySelector(".lc-meta").textContent);
  btn(d, "Make one document to print").click(); await sleep(30);
  var mp = d.querySelector(".page");
  ok("merged document", mp && /Dear Grace Akinyi/.test(mp.textContent) && /Dear Juan dela Cruz/.test(mp.textContent) && mp.querySelectorAll("hr").length === 2);
  ok("merge helper escapes", C.merge("<p>{{ name }}</p>", { Name: "<b>" }) === "<p>&lt;b&gt;</p>");

  // --- practice
  go("compose"); await sleep(10);
  btn(d.querySelector(".lc-tabs"), "Practice").click(); await sleep(5);
  ok("prompt shown", d.querySelector(".lc-tip").textContent.length > 10);
  var pta = d.querySelector("textarea[aria-label='Your writing']");
  pta.value = "i went to the the market. it was very busy and i buyed alot of food"; fire(pta, "input");
  btn(d, "Check my writing").click(); await sleep(5);
  var fix = Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return /^Fix \d+ safe/.test(b.textContent); })[0];
  ok("practice check offers fixes", !!fix);
  fix.click(); await sleep(5);
  ok("practice fixes applied", /^I went to the market\. It was very busy and I buyed a lot of food\.?$/.test(pta.value), pta.value);
  btn(d, "Done").click(); await sleep(5);
  ok("streak recorded", /streak: 1 day/.test(d.body.textContent));

  // --- learn
  btn(d.querySelector(".lc-tabs"), "Learn").click(); await sleep(5);
  ok("18 lessons", d.querySelectorAll(".lc-card").length === 18, d.querySelectorAll(".lc-card").length);
  d.querySelector(".lc-card").click(); await sleep(5);
  ok("lesson opens", !!d.querySelector(".lesson-overlay") && /writing process/i.test(d.querySelector(".lesson-overlay").textContent));
  ok("every checker lesson exists", ["comp_spelling", "comp_grammar", "comp_punct", "comp_plain", "comp_words", "comp_confused"]
    .every(function (k) { return L.mathLessons.has(k); }));

  // --- decks, guides, language
  ok("writing decks", L.cardDecks.filter(function (x) { return x.cat === "Writing"; }).length === 3);
  ok("guides", L.guide.has("compose"));
  L.i18n.set("es");
  ok("translated tile", L.t("app.compose.name") === "Redactar");
  L.i18n.set("fr");
  ok("translated tile fr", L.t("app.compose.name") === "Rédiger");
  L.i18n.set("en");
  ok("no new languages invented", L.i18n.langs().length === 9, L.i18n.langs());
  ok("no runtime errors", errs.length === 0, errs);

  console.log(fails ? fails + " COMPOSE APP FAILURES (" + passes + " passed)" : "ALL COMPOSE APP TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e.stack); process.exit(1); });
