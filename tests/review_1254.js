// review_1254.js -- the three reviews of 1.24.14's rules, replayed (tests/fixtures/review{1,2,3}_1254_*.json).
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
// A second agent, which had seen neither, made 510 cases of its own against the mended rules:
//  - TRACK: 8 wrong blocks passed that 1.24.13 caught and 4 right ones were questioned that it ran -- a chain counted
//    from another thing ("right of right of Bible" for the book with the bookmark), a step's phrase paired with
//    another step's line, the same phrase at two steps, "behind" in a queue listed back to front. Now a chain is
//    only ever accepted, never the cause of a question: "X swaps with ... N places to its left" written as the swap of
//    X with a chain from X itself, the phrase once in the steps, X's words in that step; and a number inside a chain
//    counts for no step;
//  - the library: 38 wrong and 15 partly wrong answers verified once the line was written -- "Yes." as a sentence of
//    its own, a "For children," frame cut, a minus written as a dash, "more than", "usually", "over" left out, warm
//    and cold, a sentence cut at "p.m.", "week" for "weekday", a dose for adults handed for a child. Mended: no line
//    to an answer with a yes or a no anywhere; only a "To ..." frame is cut, and only when its words are the
//    passage's; a dash before a number is a minus; only empty words may be left out; a fact for children, adults,
//    babies ... is handed only from a sentence that names them;
//  - drawings: the road moved out from under the tide, drifting sand, ice; a rock and a dune named as the road; a
//    sea seen from far out named for the beach; an autumn tree's dark orange crown taken for the sun. Mended.
// A third agent made 316 cases against TRACK and the library line as they then were:
//  - TRACK: 16 wrong blocks passed that 1.24.13 caught -- the step's text was read from step 1, so another step gave
//    the swap or the thing's words; a step that lifts a coin; "the cup next to the gold cup"; "Di" found in
//    "directly". Now the step must read, word for word, "<a name of the row> swaps with the <thing> N places to its
//    left" (or "The <thing> holding the <token> swaps ..."), from its own number to the next, no other step saying
//    the same of the same thing, and the block must swap that name (or "holder of <token>") with a chain from it;
//  - the library: 65 wrong or partly wrong answers verified once the line was written -- 30 of them moved to a
//    passage about another town, drug or mountain; "It is about half the size of Earth"; a ferret, a 6-year-old;
//    sentences cut at "p.m. (" and "approx."; "First of all" for step 4; "1/2" read as 1 to 2; an answer's other part
//    a word off its own quote ("white" chocolate beside "dark"). Now no move; no sentence that points back; every
//    word the question asks with in the sentence or the passage's title; short forms kept whole; fractions as
//    numbers; ordinals are facts; every other part's words in its quote, in order, but one in four. The 35B's own
//    iPhone answer, its other parts paraphrased, is no longer handed its line (tests/bench_1254.js).
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
  ok("boot clean", o.errs.length === 0, o.errs);
  function last(t) { var i = String(t || "").indexOf("Final order"); return i >= 0 ? String(t).slice(i).trim() : ""; }
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
  function review(rv, want) {
    var T = fixture(rv + "_1254_track.json"), Q = fixture(rv + "_1254_quote.json"), D = want.n[2] ? fixture(rv + "_1254_draw.json") : [];
    ok(rv + ": " + T.length + " blocks, " + Q.length + " answers, " + D.length + " drawings", T.length === want.n[0] && Q.length === want.n[1] && D.length === want.n[2], [T.length, Q.length, D.length]);
    // --- TRACK ---
    var rightQ = [], wrongPass = [], badLine = [];
    T.forEach(function (c) {
      var r = L.aiPuzzle.run(c.text, c.q);
      if (c.verdict === "right" && !r.ok) rightQ.push(c.name);
      if (c.verdict !== "right" && r.ok && last(L.aiPuzzle.resultText(r)) !== last(c.truth)) wrongPass.push(c.name);
      var m = /its line, \u201c([^\u201d]+)\u201d, moves[^:]*: write \u201c([^\u201d]+)\u201d in that line/.exec((r.problems || []).join(" | "));
      var sides = m && /^\s*swap\s+(.+?)\s+and\s+(.+)$/i.exec(m[1]);
      if (sides && /\bleft of left of|\bright of right of/.test(m[1])) {
        var from = /(left|right) of/.test(sides[2]) ? sides[2] : sides[1];
        var r2 = L.aiPuzzle.run(c.text.replace(m[1], m[1].replace(from, m[2])), c.q);
        if (r2.problems.some(function (p) { return /is off the row/.test(p); })) badLine.push(c.name);
      }
    });
    ok(rv + ": " + want.rightQ + " right blocks questioned, each questioned on 1.24.13 as well (" + want.rightQold + " were then)", rightQ.length === want.rightQ && rightQ.indexOf("bench-chain-35b") < 0, rightQ);
    ok(rv + ": the wrong blocks that run unquestioned, each passing on 1.24.13 too (" + want.wrongPassOld + " did then)", wrongPass.join() === want.wrongPass.join(), wrongPass);
    ok(rv + ": no line handed for a chain falls off the row", badLine.length === 0, badLine);
    // --- the library ---
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
    ok(rv + ": every answer verified or not as on 1.24.13", changedOk.length === 0, changedOk);
    ok(rv + ": no wrong or partly wrong answer verified once its handed line is written", wrongOk.length === 0, wrongOk);
    ok(rv + ": " + want.helped + " right answers verified once it is", helped === want.helped, helped);
    // --- the drawings ---
    var touched = [], newBad = [];
    D.forEach(function (c) {
      if (c.verdict !== "right") return;
      var m = L.aiAct.fromReply(c.text, c.q), now = { ok: !!(m && m.ok), problems: (m && m.problems) || [], said: (m && m.plan && m.plan.said) || [] }, was = c.on1253 || {};
      if (!now.ok || now.said.length) touched.push(c.name);
      // (nothing asked or changed that was not then; what a shape of an unknown colour, left out, led to is gone with
      // it -- a house whose dark gray roof was not read, asked for a roof -- and what that shape now meets, it meets
      // as any shape: an oval off the grid)
      var shade = (was.problems || []).filter(function (p) { return /unknown colour \u201c(dark|light|pale|deep|bright)\u201d/.test(p); });
      var lines = shade.map(function (p) { return (/^\u201c([^\u201d]+)\u201d/.exec(p) || [])[1]; }).filter(Boolean);
      var wasP = (was.problems || []).filter(function (p) { return shade.indexOf(p) < 0; });
      if (now.problems.some(function (p) { return wasP.indexOf(p) < 0 && !lines.some(function (l) { return p.indexOf(l) >= 0; }); }) ||
        now.said.some(function (x) { return (was.said || []).indexOf(x) < 0; })) newBad.push(c.name);
    });
    if (!D.length) return { D: D };
    ok(rv + ": the right pictures asked about are those 1.24.13 asked about (" + touched.length + ")", touched.join() === want.touched.join(), touched);
    ok(rv + ": no right picture is asked or changed in a way 1.24.13 did not", newBad.length === 0, newBad);
    return { D: D };
  }
  var r1 = review("review1", { n: [106, 286, 157], rightQ: 18, rightQold: 31, wrongPassOld: 7, wrongPass: ["move2r-after-right", "bench6-step1-one-num", "seven-left-of-2-left", "front2-one", "nested-step2-one"], helped: 23,
    touched: ["road-under-ground-twice", "road-snow-buried", "road-flooded", "land-sunset-sea-sliver", "land-sun-set-hidden", "land-moon-behind-cloud", "land-moon-overcast", "land-swimmer"] });
  review("review2", { n: [84, 310, 116], rightQ: 16, rightQold: 30, wrongPassOld: 6, wrongPass: ["books-step2-swapped-from-bible-num", "mugs-step3-one-place-num1", "kids-step2-one-place", "jewels-number-pearl-base", "cars-step3-chain-num-elsewhere"], helped: 45,
    touched: ["sh-snow-bright-white", "rd-road-twice", "rd-tide", "rd-tide-causeway-sand", "rd-drifting-sand", "rd-snow-control", "rd-flooded-control", "shore-from-far-out"] });
  review("review3", { n: [75, 241, 0], rightQ: 25, rightQold: 34, wrongPassOld: 0, wrongPass: [], helped: 36 });
  var D = r1.D;
  function said(name) { var c = D.filter(function (x) { return x.name === name; })[0], m = L.aiAct.fromReply(c.text, c.q); return { ok: m.ok, all: m.problems.concat((m.plan && m.plan.said) || []).join(" | ") }; }
  ok("a road under the ground is moved after it; not under snow, flood water, fog, or a near field drawn after the far one",
    /^moved \u201ctri 0 12 10 6 20 12 fill gray\u201d/.test(said("road-4b-bench").all) && !/moved/.test(said("road-snow-buried").all) && !/moved/.test(said("road-flooded").all) &&
    !/moved/.test(said("road-fog-all").all) && !/moved \u201ctri 2 12 6 12 4 6/.test(said("road-moved-said-two-bands").all));
  // (1.24.14 named the road's tri; since 1.24.15 Lantern draws the road itself when nothing is on the ground, and the
  // tri the model drew stays as it is: tests/bench_1255.js)
  // (and a narrow tri of the road's colour standing on the horizon where Lantern's road would end -- the tall dark pine
  // here -- is asked about as on 1.24.14, not drawn under: a bowtie, the third review of 1.24.15)
  ok("the road is drawn when nothing is on the ground, and the 35B's tri left as drawn; the tall dark pine asked for as on 1.24.14, not named as the road",
    /drew the road the question asks for, tri 7 12 13 12 10 6 fill gray/.test(said("up-35b-bench").all) && /add tri 7 12 13 12 10 6 fill gray after the ground/.test(said("up-dark-tree").all) && !/is the road|drew the/.test(said("up-dark-tree").all));
  ok("the sand is asked for in place of a strip of light water that shows, not of one the sea covers", /in place of \u201crect 0 10 20 2 fill sky\u201d/.test(said("shore-strip-sky").all) &&
    !/in place of/.test(said("shore-strip-before-sea").all));
  ok("a sun drawn in a shade of yellow, orange or red is a sun", D.filter(function (c) { return /^col-sun-/.test(c.name); }).every(function (c) { return !/the question asks for a sun/.test(said(c.name).all); }));

  console.log(fails ? fails + " REVIEW 1.24.14 FAILURES (" + passes + " passed)" : "ALL REVIEW 1.24.14 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
