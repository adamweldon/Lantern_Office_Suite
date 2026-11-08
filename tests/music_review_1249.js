// music_review_1249.js -- the first music review of the held-note mend, replayed (1.24.10).
// An agent that had not seen the mend written tried the first draft (1.24.9, held back) on 107 songs of its own
// (tests/fixtures/review1_1249_music.json), and said of each what a musician would want: leave it as written
// (57), mend it (40) or ask the model (10). The draft mended 71, about 30 of them songs that were right. The
// narrowed mend must change no song it said to leave or to ask about; what it mends is said, and what is said
// is what plays.
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
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 2000)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1249_music.json"), "utf8"));
  ok("boot clean; the review\u2019s 107 songs (57 to leave, 40 to mend, 10 to ask)", o.errs.length === 0 && F.length === 107 &&
    F.filter(function (s) { return s.want === "as written"; }).length === 57 && F.filter(function (s) { return s.want === "mend"; }).length === 40, o.errs);
  var rows = F.map(function (s) {
    var b = L.aiAct.build("MAKE MUSIC: " + s.name + "\n" + s.lines.join("\n") + "\nEND", s.q);
    var said = String(b.summary || "").split(/\. (?=[a-zA-Z])/).filter(function (x) { return /Lantern played|Lantern ended/.test(x); });
    return { s: s, b: b, said: said, mended: said.length > 0, asked: (b.problems || []).some(function (p) { return /a half step from a note of the chord/.test(p); }) };
  });
  var wrong = rows.filter(function (r) { return r.mended && r.s.want !== "mend"; });
  ok("no song the review said to leave as written, or to ask about, is mended", wrong.length === 0, wrong.map(function (r) { return [r.s.name, r.said]; }));
  var mended = rows.filter(function (r) { return r.mended; });
  ok("22 songs are mended, each one the review said to mend (the draft mended 71)", mended.length === 22, mended.map(function (r) { return r.s.name; }));
  // what is said is what plays: "bar N: Lantern played X ..." -> the chord played in bar N is X, and the chords line shows X;
  // "bar N: ... Lantern ended it on Y" -> the last note plays Y and the melody line shows it
  var off = [];
  mended.forEach(function (r) {
    var p = r.b.plan;
    r.said.forEach(function (t) {
      var m1 = /bar (\d+): Lantern played (\S+) under/.exec(t), m2 = /bar (\d+): the tune ended on .* Lantern ended it on (\S+), a note/.exec(t);
      if (m1) {
        var bar = +m1[1], ch = m1[2], played = p.chords.filter(function (c) { return c.bar === bar; }).map(function (c) { return c.name; });
        var part = p.parts.filter(function (x) { return bar - 1 >= x.from && bar - 1 < x.from + x.bars; })[0], shown = part ? part.chords[bar - 1 - part.from] : null;
        if (played.join() !== ch || shown !== ch) off.push([r.s.name, t, played, shown]);
      }
      if (m2) {
        var last = p.melody[p.melody.length - 1], nm = last.letter + (last.acc > 0 ? "#" : last.acc < 0 ? "b" : "");
        var lastPart = p.parts[p.parts.length - 1], lastBar = lastPart.melody[lastPart.melody.length - 1];
        if (nm !== m2[2] || String(lastBar).split(/\s+/).indexOf(m2[2]) < 0) off.push([r.s.name, t, nm, lastBar]);
      }
    });
  });
  ok("...and in each, the chord or note said is the one that plays, and the one the line shows", off.length === 0, off);
  var asked = rows.filter(function (r) { return r.s.want === "ask"; }), lostAsk = asked.filter(function (r) { return !r.asked && !r.mended && r.b.ok; });
  ok("every song the review said to ask about is still asked about, or sent back for something else", lostAsk.length === 0, lostAsk.map(function (r) { return r.s.name; }));
  console.log(fails ? fails + " MUSIC REVIEW FAILURES (" + passes + " passed)" : "ALL MUSIC REVIEW CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
