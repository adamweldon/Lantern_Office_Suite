// library_sections.js -- the part of an article the model is given (LIBRARY_ENGINE's read and passage, 1.24.8).
// Adam's run of the 35B on 1.24.6 with six books (tests/fixtures/bench_run_1246_35b_library.json) said "Not in my
// library" three times with the right article and the wrong part of it: a repair guide's first step and its readers'
// comments, a travel guide's sentences that say "visitors" and none of its "Get around", the sentences of an article
// that say "solution" and "made" and not the one that says what it holds. The pages here are stand-ins laid out as
// the offline files are (tests/fixtures/kiwix/sections_1248.json says how), served to LIB.read as kiwix-serve would.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole, fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "kiwix", "sections_1248.json"), "utf8")).pages;
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function (url) {
  var m = /\/raw\/(.+?)\/content\/(.+)$/.exec(String(url)), html = m ? FX[m[1] + "/" + m[2]] : null;
  return Promise.resolve({ ok: !!html, status: html ? 200 : 404, text: function () { return Promise.resolve(html || ""); } });
};
w.eval(js);
w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
(async function () {
  var LIB = w.Lantern.library;
  LIB.endpoint = function () { return "http://127.0.0.1:8081/"; };
  var docs = {};
  for (var k in FX) { var p = k.split("/"); docs[k] = await LIB.read({ book: p[0], path: p[1], title: p[1] }); }
  // as lookup() cuts it: the words of the model's LOOKUP and of the question; detail as Lantern decides it
  function cut(page, q, lookup) { var d = LIB.wantsDetail(q); return LIB.passage(docs[page], LIB.keywords((lookup || q) + " " + q), d ? 2200 : 1000, d, q); }
  var G = "guides/Pocketphone_3_Battery_Replacement", T = "voyage/Riverton", O = "wiki/Oral_rehydration_therapy";
  // --- a repair guide ---
  var gq = "How do I replace the battery in a Pocketphone 3?", g = cut(G, gq), gs = cut(G, "What size are the screws in the Pocketphone 3?");
  ok("a repair guide: the steps in order, each under its number (in a detailed passage a step\u2019s lines are together), the introduction first", LIB.wantsDetail(gq) &&
    /^\(Introduction\) Use this guide to put a new battery into a Pocketphone 3/.test(g) && /Step 1: Run the battery down below a quarter before you start: a full battery can burn if it is pierced\. Switch the phone off\. Step 2: Remove the two small screws/.test(g) &&
    /Step 4: Unplug the battery connector with the flat end of a plastic tool\. Pull the adhesive tabs under the battery slowly, keeping them flat\. Step 5: Lay the new battery in place/.test(g), g);
  ok("...and none of its readers\u2019 comments, their names, dates or buttons, nor a step\u2019s text twice (on 1.24.7: \u201cStep 1Run the battery down ... 2 commentsI used a guitar pick\u201d, then the step again)",
    !/guitar|rubber band|isopropyl|worth it|Sam Tester|Kim Fixer|Ana Bench|March 2024|comments|Step \dRun|Step \d[A-Z]/.test(g + " " + gs) && g.split("Run the battery down").length === 2, [g, gs]);
  ok("...a step\u2019s short lines are kept (\u201cSwitch the phone off.\u201d is 21 characters), each a paragraph that says its step: a short passage says which step (the review of the first draft found the number lost)",
    docs[G].paras.indexOf("Step 1: Switch the phone off.") >= 0 && /Step 4: Unplug the battery connector/.test(cut(G, "In which step do I unplug the Pocketphone 3 battery?")) &&
    /Step 2: Remove the two small screws/.test(cut(G, "What is step 2 of the Pocketphone 3 battery guide?")), docs[G].paras);
  // --- a travel guide ---
  var tq = "What is a good way to get around Riverton as a visitor?", t = cut(T, tq);
  ok("a travel guide: \u201ca good way to get around\u201d is given the section \u201cGet around\u201d (minibuses, taxis, motorbike taxis), not only the sentences that say \u201cvisitors\u201d",
    /Shared minibuses run on fixed routes/.test(t) && /Taxis wait at the hotels/.test(t) && /Motorbike taxis are the quickest way/.test(t), t);
  ok("...in other words too: getting about, public transport, how to move around",
    ["How do I get around Riverton?", "What public transport is there in Riverton?", "What is the best way of getting about in Riverton?", "How can I move around Riverton cheaply?"].every(function (q) { return /Shared minibuses run on fixed routes/.test(cut(T, q)); }));
  ok("...where to sleep, where to eat, the crime: each its own section",
    /Riverton has hotels for every purse/.test(cut(T, "Which hotels are there in Riverton?")) && /river fish grilled over charcoal/.test(cut(T, "What restaurants or local food does Riverton have?")) &&
    /keep to lit streets at night/.test(cut(T, "Is there much crime or theft in Riverton?")));
  ok("...a section under a section is said with its top heading, in a detailed passage (\u201cGet around / By taxi\u201d)", docs[T].sec[docs[T].paras.indexOf(docs[T].paras.filter(function (p) { return /^Taxis wait/.test(p); })[0])] === "Get around / By taxi" &&
    /\(Get around \/ By shared minibus\) Shared minibuses/.test(cut(T, "Explain how to get around Riverton.")), docs[T].sec);
  ok("...a question that asks no section is cut as before: the founding of the town, from the top", /founded as a ferry crossing/.test(cut(T, "When was Riverton founded?")) &&
    cut(T, "When was Riverton founded?").indexOf("Shared minibuses") < 0);
  // --- what a thing is made of ---
  var oq = "What is oral rehydration solution made of?", o = cut(O, oq, "oral rehydration solution ingredients");
  ok("what a thing is made of: the sentences that say so are given (\u201csmall amounts of sugar and salts\u201d, \u201cthe recommended formulation includes sodium chloride ...\u201d), which on 1.24.7 lost to \u201chomemade solutions\u201d and the 1940s",
    /small amounts of sugar and salts/.test(o) && /The recommended formulation includes sodium chloride, sodium citrate, potassium chloride and glucose\./.test(o), o);
  ok("...in other words too: its ingredients, its composition, what it is made from (not \u201cwhat goes into\u201d: a first aid kit\u2019s contents are not what it is made of)",
    ["What are the ingredients of oral rehydration solution?", "What is the composition of oral rehydration solution?", "What is oral rehydration solution made from?"].every(function (q) { return /recommended formulation includes sodium chloride/.test(cut(O, q)); }));
  ok("...a question about something else is cut as before (its history)", /first tried in the 1940s/.test(cut(O, "When was oral rehydration therapy first used?")));
  // --- a list inside a list item ---
  var c = cut("wiki/Cereal", "Which grain is pasta made from?"), c2 = cut("wiki/Cereal", "Which grain do most people eat?");
  ok("a list item that holds a list is read as before 1.24.8 -- whole, then its items on their own (a reviewer of the first draft found a year, a dictionary sense, a spec lost when only its own words were read): the grain pasta is made from is found",
    /Durum wheat, the hard wheat that pasta is made from/.test(c) && /Rice, grown in flooded fields/.test(c2), [c, c2]);
  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? fails + " LIBRARY SECTION CHECKS FAILED (" + passes + " passed)" : "ALL LIBRARY SECTION CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
