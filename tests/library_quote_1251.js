// library_quote_1251.js -- the QUOTE a cited passage lacks, found by Lantern (LIBRARY_CHECKS supply(), 1.24.11).
// Adam's run of the 35B on 1.24.9 (tests/fixtures/bench_run_1249_35b_library.json): the iPhone 8's battery answered
// rightly from iFixit, "discharge the iPhone below 25% [3]" with no QUOTE [3] line, and its steps cited [2] with one
// QUOTE [2] that said none of them -- sent back, and the same again. Each part of the ANSWER that cites one passage is
// looked for in that passage; the sentence that says it, where Lantern is sure, is quoted, and said.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
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
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(js);
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  return { L: w.Lantern, errs: errs };
}
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8")); }
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var F = fixture("bench_run_1249_35b_library.json");
  function row(id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  function srcs(r) { return r.library.passages.map(function (t, i) { return { n: i + 1, title: r.library.sources[i], text: t }; }); }
  ok("boot clean", o.errs.length === 0, o.errs);
  var ip = row("shelf-iphone-battery"), ips = srcs(ip), rn = L.libraryRenumber(ip.reply, ips), v0 = L.libraryVerify(ip.reply, ips, ip.q), v = L.libraryVerify(rn.text, ips, ip.q);
  ok("the 35B\u2019s iPhone battery: sent back on 1.24.9 (no QUOTE [3]); Lantern quotes passage 3\u2019s \u201cdischarge your iPhone battery below 25%\u201d and the steps of passage 2 it cites, and the answer is verified",
    !v0.ok && /there is no QUOTE \[3\] line/.test(v0.problems[0]) && v.ok && rn.quoted.length === 5 &&
    rn.quoted[0].n === 3 && rn.quoted[0].text === "Before you begin, discharge your iPhone battery below 25%." &&
    rn.quoted.slice(1).every(function (q) { return q.n === 2; }) && /Slowly pull one battery adhesive tab away/.test(rn.quoted[1].text), [rn.quoted, v.problems]);
  var nb = row("shelf-nairobi-transport"), nbs = srcs(nb), rn2 = L.libraryRenumber(nb.reply, nbs), v2 = L.libraryVerify(rn2.text, nbs, nb.q);
  ok("Nairobi: the two sentences it says as passages 1 and 2 have them are quoted; \u201cBolt and Uber are available [3]\u201d is not found (passage 3 has \u201cBolt.\u201d and \u201cUber.\u201d), nor the sentence with \u201cnot\u201d in it, and it is asked about as before",
    rn2.quoted.length === 2 && /^Prices should always be negotiated before the trip/.test(rn2.quoted[0].text) && /^Hiring a car or using a ride-hailing app/.test(rn2.quoted[1].text) &&
    !v2.ok && v2.problems.join() === "there is no QUOTE [3] line", [rn2.quoted, v2.problems]);
  var ors = row("shelf-ors"), orss = srcs(ors), rn3 = L.libraryRenumber(ors.reply, orss);
  ok("an answer whose quotes say what it cites is left as written (oral rehydration solution)", rn3.quoted.length === 0 && rn3.text === ors.reply);
  // made-up passages: where Lantern is not sure, nothing is quoted
  var P = [{ n: 1, title: "Kettle", text: "A kettle boils water quickly. Do not fill the kettle above the maximum line. Descale the kettle every month with vinegar. The kettle switches off by itself when the water boils." },
    { n: 2, title: "Teapot", text: "Warm the teapot with hot water first. Brew black tea for three to five minutes. Green tea is brewed for two minutes." }];
  function q1(ans) { return L.libraryRenumber("ANSWER: " + ans, P).quoted; }
  ok("...the sentence is found where it is sure: three words in four, the numbers too (\u201cbrew black tea for three to five minutes [2]\u201d; \u201cdescale the kettle with vinegar every month [1]\u201d)",
    q1("Brew black tea for three to five minutes [2].").length === 1 && q1("Descale the kettle with vinegar every month [1].")[0].text === "Descale the kettle every month with vinegar.");
  ok("...and nowhere else: a \u201cnot\u201d the sentence lacks; a number it does not say; a part citing two passages; a part of one word; a passage that says it in another passage\u2019s words; a word only near",
    q1("Fill the kettle above the maximum line [1].").length === 0 && q1("Brew green tea for four minutes [2].").length === 0 && q1("Brew black tea for three to five minutes [1][2].").length === 0 &&
    q1("Vinegar [1].").length === 0 && q1("Brew black tea for three to five minutes [1].").length === 0 && q1("The kettle stops on its own at the boil [1].").length === 0,
    [q1("Fill the kettle above the maximum line [1]."), q1("Brew green tea for four minutes [2]."), q1("The kettle stops on its own at the boil [1].")]);
  console.log(fails ? fails + " LIBRARY QUOTE FAILURES (" + passes + " passed)" : "ALL LIBRARY QUOTE CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
