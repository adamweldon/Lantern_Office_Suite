// review_1254.js -- the first review of 1.24.14's rules, replayed (tests/fixtures/review1_1254_{track,quote,draw}.json).
// An agent that had not seen the rules written made 549 cases of its own: 106 TRACK blocks, 286 library answers with
// their passages, 157 drawings. On the first draft it found:
//  - TRACK: 16 wrong blocks passed only because a chain anywhere in the block counted for a step, "behind behind" and
//    "2 seats left of" were counted as the runner does not read them, a "move ... to left of left of" line was counted
//    as two places, and the way a chain went was not looked at. Now a chain is counted only in the step's own swap
//    line, of "left of" or "right of", all one way, and it decides by its places and its way;
//  - the library: 34 wrong answers verified once the handed line was written (a yes stripped before the match, a
//    "do not" or an "if" before a comma left out, "In children" left out, 74 F matched to "74 C (165 F)", a wrong part
//    riding on the others). Now the part must be the whole sentence, but for what says nothing; a yes or a no is
//    never handed a line; every other part must be backed by the model's own quote, with the same "not";
//  - drawings: the moved road under snow, flood water and a near field; the tall dark pine named as the road; the sand
//    "in place of" a strip the sea covers; a sun in "pale yellow" asked for again. Each mended.
// Each count below is what Lantern does now; a change shows here.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load() {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(JS);
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
  var T = fixture("review1_1254_track.json"), Q = fixture("review1_1254_quote.json"), D = fixture("review1_1254_draw.json");
  ok("boot clean; the review's 106 blocks, 286 answers and 157 drawings", o.errs.length === 0 && T.length === 106 && Q.length === 286 && D.length === 157, o.errs);

  // --- TRACK ---
  function last(t) { var i = String(t || "").indexOf("Final order"); return i >= 0 ? String(t).slice(i).trim() : ""; }
  var rightQ = [], wrongPass = [], badLine = [];
  T.forEach(function (c) {
    var r = L.aiPuzzle.run(c.text, c.q);
    if (c.verdict === "right" && !r.ok) rightQ.push(c.name);
    if (c.verdict !== "right" && r.ok && last(L.aiPuzzle.resultText(r)) !== last(c.truth)) wrongPass.push(c.name);
    // a line handed for a swap's chain: written in, does that step run as the steps say?
    var m = /its line, \u201c([^\u201d]+)\u201d, moves[^:]*: write \u201c([^\u201d]+)\u201d in that line/.exec((r.problems || []).join(" | "));
    if (m && /^\s*swap\b/i.test(m[1]) && /\bleft of left of|\bright of right of/.test(m[1])) {
      var sides = /^\s*swap\s+(.+?)\s+and\s+(.+)$/i.exec(m[1]), from = /(left|right) of/.test(sides[2]) ? sides[2] : sides[1];
      var r2 = L.aiPuzzle.run(c.text.replace(m[1], m[1].replace(from, m[2])), c.q);
      if (r2.problems.some(function (p) { return /is off the row/.test(p); })) badLine.push(c.name);
    }
  });
  ok("the bench's own block (the 35B's, \u201cleft of left of holder of gold\u201d) runs with nothing questioned", rightQ.indexOf("bench-chain-35b") < 0 && T.some(function (c) { return c.name === "bench-chain-35b"; }));
  ok("of the 42 right blocks, 12 are questioned, each questioned on 1.24.13 as well (31 were then): chains in the step's own words, \u201cbehind behind\u201d, a move line",
    rightQ.length === 12, rightQ);
  ok("of the 64 wrong or partly wrong blocks, 4 run to a wrong answer unquestioned, each passing on 1.24.13 too: \u201cN places in front of\u201d is not read, nor a count elsewhere in the block, nor a move line",
    wrongPass.join() === "move2r-after-right,bench6-step1-one-num,front2-one,nested-step2-one", wrongPass);
  ok("no line handed for a chain falls off the row", badLine.length === 0, badLine);

  // --- the library ---
  function handIn(text, problems) {
    var t = text, add = 0;
    problems.forEach(function (p) {
      var m = /: for \u201c[\s\S]*?\u201d write QUOTE \[(\d+)\]: ([\s\S]*)$/.exec(p), mv = /: \u201c([\s\S]*?)\u201d is in passage \[(\d+)\], not \[(\d+)\] \u2014 write \[\d+\] after it in place of \[\d+\], and QUOTE \[\d+\]: ([\s\S]*?)( \u2014 and leave out your QUOTE \[\d+\] line)?$/.exec(p);
      if (m) { t += "\nQUOTE [" + m[1] + "]: " + m[2]; add++; }
      else if (mv) {
        t = t.replace(mv[1] + " [" + mv[3] + "]", mv[1] + " [" + mv[2] + "]");
        if (mv[5]) t = t.split("\n").filter(function (l) { return !new RegExp("^\\s*QUOTE\\s*\\[?\\s*" + mv[3] + "\\b").test(l); }).join("\n");
        t += "\nQUOTE [" + mv[2] + "]: " + mv[4]; add++;
      }
    });
    return add ? t : null;
  }
  var helped = 0, wrongOk = [], changedOk = [];
  Q.forEach(function (c) {
    var t = L.libraryRenumber(c.reply, c.sources).text, v = L.libraryVerify(t, c.sources, c.q);
    if (!!v.ok !== !!(c.on1253 && c.on1253.ok)) changedOk.push(c.name);
    if (v.ok) return;
    var t2 = handIn(t, v.problems);
    if (!t2) return;
    var v2 = L.libraryVerify(L.libraryRenumber(t2, c.sources).text, c.sources, c.q);
    if (v2.ok && c.verdict === "right") helped++;
    if (v2.ok && c.verdict !== "right") wrongOk.push(c.name);
  });
  ok("every answer is verified or not as on 1.24.13 (the rule hands a line; it verifies nothing itself)", changedOk.length === 0, changedOk);
  ok("no wrong or partly wrong answer of the 138 is verified once the line it is handed is written (34 were on the first draft)", wrongOk.length === 0, wrongOk);
  ok("...and 60 of the 148 right ones are", helped === 60, helped);

  // --- the drawings ---
  var touched = [], newBad = [];
  D.forEach(function (c) {
    var m = L.aiAct.fromReply(c.text, c.q), now = { ok: !!(m && m.ok), problems: (m && m.problems) || [], said: (m && m.plan && m.plan.said) || [] };
    if (c.verdict === "right") {
      if (!now.ok || now.said.length) touched.push(c.name);
      var was = c.on1253 || {};
      var wasP = (was.problems || []).filter(function (p) { return !/unknown colour \u201c(dark|light|pale|deep|bright)\u201d/.test(p); });
      // (nothing asked that was not asked then; what a shape of an unknown colour, left out, led to is gone with it --
      // a house whose dark gray roof was not read, asked for a roof)
      if (now.problems.some(function (p) { return wasP.indexOf(p) < 0; })) newBad.push(c.name);
    }
  });
  ok("of the 98 right pictures, 8 are asked about, as on 1.24.13 (a road under snow or flood water, a sun set in the sea, a moon behind a cloud, a swimmer's body in the sea); none is moved or named",
    touched.length === 8 && touched.every(function (n) { return /^(road-under-ground-twice|road-snow-buried|road-flooded|land-sunset-sea-sliver|land-sun-set-hidden|land-moon-behind-cloud|land-moon-overcast|land-swimmer)$/.test(n); }), touched);
  ok("no right picture is asked anything it was not asked on 1.24.13", newBad.length === 0, newBad);
  function said(name) { var c = D.filter(function (x) { return x.name === name; })[0], m = L.aiAct.fromReply(c.text, c.q); return { ok: m.ok, all: m.problems.concat((m.plan && m.plan.said) || []).join(" | ") }; }
  ok("a road under the ground is moved after it; not under snow, flood water, fog, or a near field drawn after the far one",
    /^moved \u201ctri 0 12 10 6 20 12 fill gray\u201d/.test(said("road-4b-bench").all) && !/moved/.test(said("road-snow-buried").all) && !/moved/.test(said("road-flooded").all) &&
    !/moved/.test(said("road-fog-all").all) && !/moved \u201ctri 2 12 6 12 4 6/.test(said("road-moved-said-two-bands").all));
  ok("the road drawn going up is named; a tall dark pine the question asks for is not", /if \u201ctri 0 6 20 6 10 0 fill gray\u201d is the road/.test(said("up-35b-bench").all) && !/is the road/.test(said("up-dark-tree").all));
  ok("the sand is asked for in place of a strip of water that shows, not of one the sea covers", /in place of \u201crect 0 10 20 2 fill sky\u201d/.test(said("shore-strip-sky").all) &&
    !/in place of/.test(said("shore-strip-before-sea").all));
  ok("a sun drawn in a shade of yellow, orange or red is a sun", D.filter(function (c) { return /^col-sun-/.test(c.name); }).every(function (c) { return !/the question asks for a sun/.test(said(c.name).all); }));

  console.log(fails ? fails + " REVIEW 1.24.14 FAILURES (" + passes + " passed)" : "ALL REVIEW 1.24.14 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
