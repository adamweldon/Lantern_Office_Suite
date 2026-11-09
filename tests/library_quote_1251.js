// library_quote_1251.js -- why Lantern does not write a QUOTE for the model (1.24.11).
// Adam's run of the 35B on 1.24.9 (tests/fixtures/bench_run_1249_35b_library.json): the iPhone 8's battery answered
// rightly from iFixit, "discharge the iPhone below 25% [3]" with no QUOTE [3] line, and sent back. A rule was drafted
// that looked for the sentence in the cited passage itself -- the part's numbers, three of its words in four, the same
// "not" -- and quoted it. An agent that had not seen it written tried it on 339 answers of its own
// (tests/fixtures/review1_1251_quote.json): of 181 wrong or partly wrong answers, 1.24.10 verified 1 and the rule 101 --
// a dose swapped, 165 C for F, "do not leave the building" quoted for "leave", "over" for "under", a step the passage
// never had carried by the quotes of the others -- and told the person Lantern had found the sentence. Words in common
// do not say what a sentence means. The rule was taken out: the check that an answer is the library's, not the
// model's memory, stays the model's quotes. These answers are replayed so that no such rule comes back unseen.
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
  var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1251_quote.json"), "utf8"));
  ok("boot clean; the review\u2019s 339 answers", o.errs.length === 0 && R.length === 339, o.errs);
  var rows = R.map(function (c) {
    var rn = L.libraryRenumber(c.reply, c.sources), v = L.libraryVerify(rn.text, c.sources, c.q);
    return { c: c, rn: rn, ok: !!v.ok };
  });
  var added = rows.filter(function (r) { return (r.rn.quoted && r.rn.quoted.length) || (r.rn.text.match(/^\s*QUOTE/gim) || []).length > (String(r.c.reply).match(/^\s*QUOTE/gim) || []).length; });
  ok("Lantern adds no QUOTE line to a reply", added.length === 0, added.map(function (r) { return r.c.name; }));
  var wrongOk = rows.filter(function (r) { return r.c.truth !== "right" && r.ok; });
  ok("no wrong or partly wrong answer is verified but the one 1.24.10 verified too (a quote that has its words and not its 12 in 24 hours: verify\u2019s own hole, in the queue)",
    wrongOk.length === 1 && wrongOk[0].c.name === "dose-model-quote-covers-12-in-24", wrongOk.map(function (r) { return r.c.name; }));
  var same = rows.filter(function (r) { return r.ok !== !!r.c.old.ok; });
  ok("...every answer is verified or not as on 1.24.10", same.length === 0, same.map(function (r) { return r.c.name; }));
  var F = fixture("bench_run_1249_35b_library.json"), ip = F.rows.filter(function (r) { return r.id === "shelf-iphone-battery"; })[0];
  var ips = ip.library.passages.map(function (t, i) { return { n: i + 1, title: ip.library.sources[i], text: t }; });
  ok("...and the 35B\u2019s iPhone battery goes back as on 1.24.9: there is no QUOTE [3] line (written so that a change shows)",
    !L.libraryVerify(L.libraryRenumber(ip.reply, ips).text, ips, ip.q).ok);
  console.log(fails ? fails + " LIBRARY QUOTE FAILURES (" + passes + " passed)" : "ALL LIBRARY QUOTE CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
