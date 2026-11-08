// review4_1247.js -- the fourth independent review of 1.24.7, replayed (2026-11-07).
// After the third review's findings were mended, another agent that had not
// seen the rules written tried them on inputs of its own: 84 right pictures
// and 24 wrong ones, 58 replies, 42 recipe questions with a sum. On the
// mended draft it found:
//  - a star the moon was drawn over put in front of the moon; a road redrawn
//    over the river the model drew across it; of two dunes in the air one
//    stood on the sand and one left floating; a yellow moon called the sun;
//  - 14 right replies whose last step was done in the head ("=350/100",
//    "=28" for 8 litres per 100 km) read as the step before it; "Using the
//    CONVERT function, how many km ...?" taken for a question about the
//    formula; "Make the sum:" opening a block; a Chat answer that says what
//    to type ("=PI()*A1^2 -> the area, with the radius in A1") cut at its
//    arrow; a chain of steps ("=2000/15 = 133.33/60 = 2.22") cut to its
//    first;
//  - for drops of bleach "per litre", the line for the whole drum (20 times
//    the dose); and right sums for a half-wave dipole, the orbits in a day,
//    an escape velocity in km/h, the weight on one leg of a table, told to
//    be a recipe's line that gives something else.
// Each was mended. Its inputs are the fixture; what 1.24.6 gave and what
// this version gives are written beside each.
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
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review4_1247.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function near(a, b) { return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.01); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var S = L.aiScene, A = L.assist;
  ok("boot clean; the review\u2019s inputs: 84 right pictures, 24 wrong, 58 replies, 42 recipe questions",
    o.errs.length === 0 && F.right.length === 84 && F.wrong.length === 24 && F.replies.length === 58 && F.recipes.length === 42, o.errs);

  // --- pictures ---
  function mend(c) { return S.mend(c.lines.slice(), c.q); }
  var touched = F.right.filter(function (c) { var m = mend(c); return m.said.length || m.problems.length || m.lines.join("\n") !== c.lines.join("\n"); });
  ok("every one of the 84 right pictures comes through as written: the moon over a star (stars are farther), sunbeams, sails, the tiers of a pine, far ranges, clouds, colours written as #hex",
    touched.length === 0, touched.map(function (c) { return [c.name, mend(c)]; }));
  var wNow = F.wrong.filter(function (c) { var m = mend(c); return m.lines.join("\n") !== c.after.join("\n") || m.said.join("|") !== c.said.join("|") || m.problems.join("|") !== c.problems.join("|"); });
  ok("the 24 wrong pictures: each drawn as the fixture has it (looked at, as written and as drawn)", wNow.length === 0, wNow.map(function (c) { return [c.name, mend(c)]; }));
  function w5(name) { return F.wrong.filter(function (c) { return c.name === name; })[0]; }
  // (the sixth review of 1.24.7: in a question about the moon and not the sun, nothing is moved as the sun -- a yellow
  // disc there may be the moon, a lamp, a window -- and the moon is left where it was drawn)
  ok("...a road with a river drawn across it is left as drawn; two dunes in the air both go down, called dunes; a yellow moon in a question about the moon is left where it was drawn; green hills are hills",
    mend(w5("road strip crossing a river band (river drawn after the road)")).said.length === 0 &&
    mend(w5("desert dunes floating (6 wide, no mountain word)")).said.join() === "stood the 2 tan dunes on the horizon (y 8), behind what was already on the ground: their bases were in the sky" &&
    mend(w5("yellow full moon drawn over the mountain's peak")).said.length === 0 && mend(w5("yellow full moon drawn over the mountain's peak")).lines.join("|") === w5("yellow full moon drawn over the mountain's peak").lines.join("|") &&
    /^stood the 2 green hills on the horizon/.test(mend(w5("valley hills floating, sun after")).said[0]), F.wrong.map(function (c) { return [c.name, mend(c).said]; }));

  // --- replies ---
  function outcome(reply, q) { var t = L.aiRead(reply, q).text, p = A.parseReply(t), run = null; try { run = p.exprText ? A.run(p.exprText) : null; } catch (e) { run = null; } return { text: t, value: run ? run.value : null }; }
  var rNow = F.replies.filter(function (r) { var b = outcome(r.reply, r.q); return b.text !== r.text || !(b.value === r.value || near(b.value, r.value)); });
  ok("the 58 replies: each read as the fixture has it", rNow.length === 0, rNow.map(function (r) { return [r.q, r.reply, outcome(r.reply, r.q)]; }));
  var lost = F.replies.filter(function (r) { return r.kind === "right" && r.expect !== null && near(r.v1246, r.expect) && !near(r.value, r.expect); });
  ok("...no right reply that 1.24.6 read right is read wrong: the 14 last steps done in the head stay (\u201c=350/100\u201d, \u201c=28\u201d; \u201c=4+8+12\u201d, \u201c=8\u201d; \u201c=100-32\u201d, \u201c=37.8\u201d), a formula word with \u201chow many\u201d is worked out, \u201cMake the sum:\u201d opens nothing",
    lost.length === 0 && F.replies.filter(function (r) { return r.cat === "typed" && r.kind === "right"; }).every(function (r) { return near(r.value, r.expect); }), lost.map(function (r) { return [r.q, r.v1246, r.value, r.expect]; }));
  ok("...a Chat answer reaches the person as it was written: \u201c=PI()*A1^2 -> the area, with the radius in A1\u201d keeps its words (a formula with a cell in it is not a sum Lantern runs)",
    F.replies.filter(function (r) { return r.kind === "text"; }).every(function (r) { return outcome(r.reply, r.q).text === r.reply; }) && F.replies.filter(function (r) { return r.kind === "text"; }).length >= 3);
  ok("...a chain of steps on one line is left as written, not cut to its first step (\u201c=2000/15 = 133.33/60 = 2.22\u201d, \u201c=2000/15 -> /60 -> 2.22\u201d, \u201c=1000*1.05^10 = 1628.89 - 1000\u201d)",
    F.replies.filter(function (r) { return r.kind === "wrong"; }).every(function (r) { return r.value === r.v1246 || near(r.value, r.expect) || r.value === null; }), F.replies.filter(function (r) { return r.kind === "wrong"; }).map(function (r) { return [r.q, r.reply, r.v1246, r.value]; }));

  // --- the recipes ---
  var RDc = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function speaks(r) { return !!RDc(r.q, r.sum, A.run(r.sum), {}); }
  var cNow = F.recipes.filter(function (r) { return speaks(r) !== r.speaks; });
  ok("the 42 recipe questions: Lantern says nothing of a recipe where the question asks for what it does not give -- drops of bleach per litre, a half-wave dipole, a wavelength in feet, a radio signal\u2019s time, the orbits in a day, an escape velocity in km/h, the weight on one leg of a table, a black hole\u2019s diameter",
    cNow.length === 0 && F.recipes.every(function (r) { return !r.speaks || r.shouldSpeak; }), cNow.map(function (r) { return r.q; }));
  ok("...and still holds a sum to the recipe for its own plain question: drops of bleach for a jerrycan of water to drink, the wavelength of a 100 MHz signal, a satellite\u2019s minutes at 420 km, a 50 kg sack in newtons, an escape velocity at 400 km (a sum that does not run gets the recipe another way: with the error)",
    /write =2\*20$/.test(RDc("How many drops of household bleach make a 20 litre jerrycan of clear water safe to drink?", "=20*4", A.run("=20*4"), {}) || "") &&
    /write =WAVELEN\(100\)$/.test(RDc("What is the wavelength of a 100 MHz radio signal, in metres?", "=100*10^6/299792458", A.run("=100*10^6/299792458"), {}) || "") &&
    /write =ORBITT\(CONVERT\(420\+6371,"km","m"\)\)\/60$/.test(RDc("How long does a satellite take to orbit Earth at 420 km altitude, in minutes?", "=CONVERT(420+6371,\"km\",\"m\")/60", A.run("=CONVERT(420+6371,\"km\",\"m\")/60"), {}) || "") &&
    /write =WEIGHT\(50\)$/.test(RDc("What is the weight in newtons of a 50 kg sack?", "=50*10*10", A.run("=50*10*10"), {}) || "") &&
    /write =ESCV\(CONVERT\(400\+6371,"km","m"\)\)$/.test(RDc("What is the escape velocity at 400 km altitude?", "=SQRT(2*9.8*400000)", A.run("=SQRT(2*9.8*400000)"), {}) || ""));

  console.log(fails ? fails + " REVIEW 4 FAILURES (" + passes + " passed)" : "ALL REVIEW 4 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
