// music_review_1250.js -- the second music review of the held-note mend, replayed (1.24.10).
// A second agent, that had seen neither the mend written nor the first review, tried the narrowed mend on 173 songs
// of its own (tests/fixtures/review2_1250_music.json: each with what 1.24.8 made of it, "old", and what a musician
// would want: leave it as written (76), mend it (65) or ask the model (32)). What it found was mended: a minor chord's
// ninth and a major chord's seventh are colours, a note out of the key is no suspension, a note the tune goes back to
// is none either, C | C is one chord's span as C | - is, a tune a step too high is asked about whole, and so on.
// The mend must change no song it said to leave or to ask about; what it mends is said and plays; and against 1.24.8
// no song is worse but one (a 4-3 over a tonic pedal, which it would have asked about and is now made as written).
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
  var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review2_1250_music.json"), "utf8"));
  ok("boot clean; the review\u2019s 173 songs (76 to leave, 65 to mend, 32 to ask), each with what 1.24.8 made of it", o.errs.length === 0 && F.length === 173 &&
    F.filter(function (s) { return s.want === "as written"; }).length === 76 && F.filter(function (s) { return s.want === "mend"; }).length === 65 &&
    F.every(function (s) { return s.old && typeof s.old.ok === "boolean"; }), o.errs);
  function kind(said, ok2) { return said.length ? "mend" : ok2 ? "as written" : "ask"; }
  var rows = F.map(function (s) {
    var b = L.aiAct.build("MAKE MUSIC: " + s.name + "\n" + s.lines.join("\n") + "\nEND", s.q);
    var said = String(b.summary || "").split(/\. (?=[a-zA-Z])/).filter(function (x) { return /Lantern played|Lantern ended/.test(x); });
    return { s: s, b: b, said: said, now: kind(said, !!b.ok), was: kind((s.old.said || []).filter(function (x) { return /Lantern played|Lantern ended/.test(x); }), !!s.old.ok) };
  });
  var wrong = rows.filter(function (r) { return r.now === "mend" && r.s.want !== "mend"; });
  ok("no song the review said to leave as written, or to ask about, is mended (a tune a step too high; F - - - E F - - over C)", wrong.length === 0, wrong.map(function (r) { return [r.s.name, r.said]; }));
  var mended = rows.filter(function (r) { return r.now === "mend"; });
  ok("54 songs are mended", mended.length === 54, mended.length);
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
        if (nm !== m2[2] || String(lastBar).split(/\s+/).map(function (x) { return x.replace(/\d+$/, ""); }).indexOf(m2[2]) < 0) off.push([r.s.name, t, nm, lastBar]);
      }
    });
  });
  ok("...and in each, the chord or note said is the one that plays, and the one the line shows", off.length === 0, off);
  // (a mended song's shown lines, written out again, play as it did: the octave the tune was in is kept -- the review
  // found a B3 mended to C moved the tune up an octave as played, while the shown line played it where it was)
  var replay = mended.filter(function (r) { return r.b.plan.parts.length === 1 && r.s.lines.filter(function (l) { return /^(melody|chords) /.test(l); }).length === 2; }).filter(function (r) {
    var p = r.b.plan, lines = r.s.lines.map(function (l) { return /^melody /.test(l) ? "melody " + p.parts[0].melody.join(" | ") : /^chords /.test(l) ? "chords " + p.parts[0].chords.join(" | ") : l; });
    var b2 = L.aiAct.build("MAKE MUSIC: " + r.s.name + "\n" + lines.join("\n") + "\nEND", r.s.q);
    return !b2.plan || b2.plan.melody.map(function (n) { return n.midi; }).join() !== p.melody.map(function (n) { return n.midi; }).join() ||
      b2.plan.chords.map(function (c) { return c.name; }).join() !== p.chords.map(function (c) { return c.name; }).join();
  });
  ok("...and its lines as shown, written out again, play the same notes and chords", replay.length === 0, replay.map(function (r) { return r.s.name; }));
  var better = rows.filter(function (r) { return r.now !== r.was && r.now === r.s.want; }), worse = rows.filter(function (r) { return r.now !== r.was && r.was === r.s.want; });
  ok("against 1.24.8: 72 songs nearer what the review wanted, one further (the 4-3 over a tonic pedal, now made as written)", better.length === 72 && worse.length === 1 && worse[0].s.name === "Tonic pedal with a held 4th" && worse[0].now === "as written",
    [better.length, worse.map(function (r) { return [r.s.name, r.was, r.now]; })]);
  var dsharp = L.aiAct.build("MAKE MUSIC: x\nkey C major\nchords C | F | C | G | C\nmelody E - G - | A - F - | D# - - E | D - B - | C - - -\nEND", "a tune in C");
  ok("a note is named as the tune wrote it: D# over C is asked about as D#, not Eb", (dsharp.problems || []).some(function (p) { return /^bar 3: the melody holds D# over C \(C E G\)/.test(p); }), dsharp.problems);
  console.log(fails ? fails + " MUSIC REVIEW FAILURES (" + passes + " passed)" : "ALL MUSIC REVIEW CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
