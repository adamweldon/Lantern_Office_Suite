// library_review_1248.js -- the reviews of 1.24.8's library change, replayed (2026-11-08).
// Each review was made by an agent that had not seen the change written, on pages and questions of its own, laid
// out as the offline files are (mwoffliner for Wikipedia, WikiMed and Wikivoyage; the openzim iFixit scraper's
// templates; Wiktionary; Wikibooks; pages made from websites), every page in its own words. For each question the
// fixture says whether 1.24.7 put the words that answer it in the passage, at the length Lantern picks and at the
// other. The test: none that 1.24.7 found is lost, but those written below with why -- the answer only in a reader's
// comment on a repair guide (the change leaves comments out; whether it should is Adam's), and a few at the length
// Lantern does not pick for the question where a sentence that fits takes the room.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole, fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var SETS = ["library_review1_1248.json", "library_review2_1248.json", "library_review3_1248.json", "library_review4_1248.json", "library_review5_1248.json"].filter(function (f) {
  return fs.existsSync(path.join(__dirname, "fixtures", "kiwix", f)); });
// what is lost on purpose, or by the room at the length Lantern does not pick: [review, page, question, length, why]
var ACCEPT = [
  ["2", "ifixit/Electric_Kettle_Heating_Element_Replacement", "Can I use a flathead screwdriver instead of a tri-wing?", "*", "only in a reader's comment"],
  ["2", "ifixit/Electric_Kettle_Heating_Element_Replacement", "My kettle element reads fine but the kettle doesn't work, what else could it be?", "flipped", "only in a reader's comment"],
  ["2", "ifixit/Electric_Kettle_Heating_Element_Replacement", "What if my kettle trips the breaker?", "*", "only in a reader's comment"],
  ["3", "ifixit/Home_Router_Power_Jack_Replacement", "What screwdriver do I need for the newer router model?", "*", "only in a reader's comment"],
  ["4", "ifixit_en_all_2025-12/Guide/Lenovo_ThinkPad_T480_Fan_Replacement/101", "Why is my T480 fan still loud after replacing it?", "*", "only in a reader's comment"],
  ["4", "ifixit_en_all_2025-12/Guide/Front_Load_Washer_Drain_Pump_Replacement/202", "Which side should I lay the washing machine on?", "*", "only in a reader's comment"],
  ["4", "ifixit_en_all_2025-12/Guide/Bicycle_Chain_Replacement/303", "Can I reuse a master link?", "*", "only in a reader's comment"],
  ["4", "ifixit_en_all_2025-12/Guide/Ceiling_Fan_Capacitor_Replacement/404", "Can a fan capacitor hold a charge?", "*", "only in a reader's comment (a warning)"],
  ["1", "ifixit/Bicycle_Chain_Replacement", "How do I lubricate a new bike chain?", "flipped", "short, where Lantern gives it in detail: the step lines that say \u201cnew chain\u201d come first"],
  ["3", "ifixit/PocketPlay_X3_Teardown", "How are the joysticks attached in the X3?", "flipped", "short, where Lantern gives it in detail: the introduction's long sentence takes the room"],
  ["3", "ifixit/PocketPlay_X3_Teardown", "How do I fix joystick drift on the X3?", "flipped", "short, where Lantern gives it in detail: the introduction's long sentence takes the room"],
  ["4", "wikivoyage_en_all_maxi_2026-02/Kampala", "What is the best way to get around Kampala?", "flipped", "in detail, where Lantern gives it short: the room"],
  ["5", "wikivoyage_en_all_maxi_2024-01/A/Saint_Petersburg", "How do I get to Peterhof?", "flipped", "short, where Lantern gives it in detail: Get around is favoured, and the sentence of See with the hydrofoils does not fit"]];
function accepted(set, p, mode) { return ACCEPT.filter(function (a) { return a[0] === set && a[1] === p.page && a[2] === p.question && (a[3] === "*" || a[3] === mode); })[0]; }
function low(t) { return String(t).toLowerCase().replace(/\s+/g, " "); }
function has(text, ans) { var l = low(text); return ans.every(function (a) { return l.indexOf(low(a)) >= 0; }); }
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1500)); } }
function boot(pages) {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.fetch = function (url) {
    var m = /\/raw\/(.+?)\/content\/(.+)$/.exec(String(url)), h = m ? pages[m[1] + "/" + decodeURIComponent(m[2])] : null;
    return Promise.resolve({ ok: !!h, status: h ? 200 : 404, headers: { get: function () { return "text/html"; } }, text: function () { return Promise.resolve(h || ""); } });
  };
  w.eval(js);
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  var LIB = w.Lantern.library;
  LIB.endpoint = function () { return "http://127.0.0.1:8081/"; };
  return { LIB: LIB, errs: errs };
}
(async function () {
  ok("the five reviews' pages and questions are here", SETS.length === 5, SETS);
  var tot = { q: 0, lost: 0, gained: 0, kept: 0 };
  for (var s = 0; s < SETS.length; s++) {
    var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "kiwix", SETS[s]), "utf8")), set = String(s + 1), b = boot(F.pages), LIB = b.LIB, docs = {}, k;
    for (k in F.pages) { var parts = k.split("/"); docs[k] = await LIB.read({ book: parts[0], path: parts.slice(1).join("/"), title: parts.slice(1).join("/").replace(/_/g, " ") }); }
    var lost = [], gained = 0, kept = 0;
    F.pairs.forEach(function (p) {
      ["as-lookup", "flipped"].forEach(function (mode) {
        var d0 = LIB.wantsDetail(p.question), det = mode === "flipped" ? !d0 : d0;
        var text = LIB.passage(docs[p.page], LIB.keywords((p.lookup && /\w/.test(p.lookup) ? p.lookup : p.question) + " " + p.question), det ? 2200 : 1000, det, p.question);
        var now = has(text, p.answer_needs);
        if (p.before[mode] && !now && !accepted(set, p, mode)) lost.push([p.page, p.question, mode, p.answer_needs, text.slice(0, 600)]);
        if (!p.before[mode] && now) gained++;
        if (p.before[mode] && now) kept++;
      });
    });
    tot.q += F.pairs.length; tot.lost += lost.length; tot.gained += gained; tot.kept += kept;
    ok("review " + set + ": " + Object.keys(F.pages).length + " pages, " + F.pairs.length + " questions at both lengths: no answer that 1.24.7 found is lost but those written with why (" + gained + " found that 1.24.7 does not find)",
      b.errs.length === 0 && lost.length === 0, [b.errs, lost]);
  }
  console.log("questions " + tot.q + ", cuts with the answer on both " + tot.kept + ", found now and not on 1.24.7 " + tot.gained);
  console.log(fails ? fails + " LIBRARY REVIEW FAILURES (" + passes + " passed)" : "ALL LIBRARY REVIEW CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
