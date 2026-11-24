// replay.js -- runs the third review's cases against src/lantern.inner.html (or argv[2]).
// Prints AGREE <id> or DISAGREE <id> <what was seen> [high|medium|low] per case, then "N cases: A AGREE, D DISAGREE".
// node tests/fixtures/review3_1236/replay.js [page.html] [--only <regex>]   (the guard cases read 1.24.35 from git, 8cb3281)
"use strict";
var path = require("path"), fs = require("fs");
var lib = require("./lib.js");
var args = process.argv.slice(2), file = path.resolve(__dirname, "../../../src/lantern.inner.html"), old = null, only = null;
for (var i = 0; i < args.length; i++) { if (args[i] === "--old") old = args[++i]; else if (args[i] === "--only") only = new RegExp(args[++i]); else file = path.resolve(args[i]); }
var CASES = [].concat(require("./cases_givens.js"), require("./cases_codes.js"), require("./cases_pick.js"), require("./cases_fill.js"), require("./cases_user.js"), require("./cases_guard.js"));
if (only) CASES = CASES.filter(function (c) { return only.test(c.id); });
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function fresh(store) { var o = lib.load(file, store); await wait(80); return o; }

// a given case: {q, expect: given id or null, has: [lines], lacks: [regex], stations, order, harm}
function runGiven(L, c) {
  var routed = lib.controlPrompt(L, c.q), g = lib.shown(L, c.q), want = c.expect;
  if (want && !routed) return c.orNone ? null : ["not routed to MAKE CONTROL at all (no prompt to put a given in)", c.harmMiss || "low"];
  if (!want && g) return ["shown " + g.id + " for a question it does not fit: " + g.lines.join(" | "), c.harm || "high"];
  if (want && !g) return c.orNone ? null : ["no given (refused) where " + want + " plainly fits", c.harmMiss || "medium"];
  if (!want) return null;
  if (g.id !== want) return ["shown " + g.id + ", not " + want, c.harm || "high"];
  var miss = (c.has || []).filter(function (l) { return g.lines.indexOf(l) < 0; });
  if (miss.length) return ["fitted wrongly: the block lacks " + miss.join(" / ") + " (block: " + g.lines.join(" | ") + ")", c.harm || "high"];
  var extra = (c.lacks || []).filter(function (re) { return g.lines.some(function (l) { return new RegExp(re, "i").test(l); }); });
  if (extra.length) return ["fitted wrongly: the block has " + extra.join(" / ") + " (block: " + g.lines.join(" | ") + ")", c.harm || "high"];
  var b = lib.build(L, g.block, c.q);
  if (!b.ok || b.problems.length) return ["the given as shown does not build clean: " + b.problems.join(" | "), "high"];
  var bad = lib.check(want, b.circuit, { stations: c.stations, order: c.order });
  if (bad) return ["the given as drawn: " + bad, "high"];
  if (c.after) { var a = c.after(L, g, b); if (a) return [a, c.harm || "high"]; }
  return null;
}
// replace each line of a block whose head and id match a line handed back
function applyLines(lines, back) {
  var out = lines.slice();
  back.forEach(function (bl) {
    var k = bl.split(/\s+/).slice(0, 2).join(" ").toLowerCase(), hit = false;
    out = out.map(function (l) { if (!hit && l.split(/\s+/).slice(0, 2).join(" ").toLowerCase() === k) { hit = true; return bl; } return l; });
    if (!hit) {   // a stop written as a button comes back as a stop line: same id
      var id = bl.split(/\s+/)[1];
      out = out.map(function (l) { if (!hit && l.split(/\s+/)[1] === id) { hit = true; return bl; } return l; });
    }
    if (!hit) out.push(bl);
  });
  return out;
}
function linesBack(problems) {
  var out = lib.writeIt(problems);
  (problems || []).forEach(function (p) { var m = /so write them nc: (.*)$/.exec(p); if (m) m[1].split(/,\s+(?=[a-z]+\s+[A-Z]{1,4}\d)/).forEach(function (x) { out.push(x); }); });
  return out;
}
// a build case: {q, lines, expect: "clean" | {back: regex, practice, fixed: true (the line copied builds clean), sim: fn(circuit) -> ""}}
function runBuild(L, c) {
  var blk = lib.block(c.title || "Circuit", c.lines), b = lib.build(L, blk, c.q);
  if (c.expect === "clean") {
    if (!b.ok || b.problems.length) return ["a right circuit sent back: " + b.problems.join(" | "), c.harm || "high"];
    if (c.sim) { var s = c.sim(b.circuit, b); if (s) return ["drawn wrong: " + s, c.harmSim || c.harm || "high"]; }
    if (c.after) { var a = c.after(b); if (a) return [a, c.harm || "medium"]; }
    return null;
  }
  var e = c.expect;
  var hit = b.problems.filter(function (p) { return new RegExp(e.back, "i").test(p); });
  if (!hit.length) return ["not caught (" + (b.ok ? "built clean" : "back: " + b.problems.join(" | ")) + ")", c.harmMiss || "medium"];
  if (e.practice && !hit.every(function (p) { return p.indexOf("(" + e.practice + " practice:") >= 0; })) return ["what went back names the wrong practice: " + hit.join(" | "), "medium"];
  if (e.practice && hit.some(function (p) { return (e.practice === "US" ? /IEC/ : /NFPA|NEC/).test(p); })) return ["what went back names the other practice too: " + hit.join(" | "), "medium"];
  if (e.line) { var got = linesBack(hit); if (got.indexOf(e.line) < 0) return ["the line handed back is " + JSON.stringify(got) + ", not " + JSON.stringify(e.line), c.harm || "high"]; }
  if (e.fixed !== false) {
    var back = linesBack(hit);
    if (!back.length) return ["no line to write went back: " + hit.join(" | "), "medium"];
    var nl = applyLines(c.lines, back), b2 = lib.build(L, lib.block(c.title || "Circuit", nl), c.q);
    if (!b2.ok || b2.problems.length) return ["the line handed back, copied, does not build clean: " + b2.problems.join(" | ") + " (lines: " + nl.join(" | ") + ")", "high"];
    if (e.sim) { var s2 = e.sim(b2.circuit, b2); if (s2) return ["the line handed back, copied, draws wrong: " + s2, "high"]; }
  }
  return null;
}
(async function () {
  var o = await fresh(), L = o.L, agree = 0, dis = 0, lines = [];
  global.__L = L;
  var env = { lib: lib, file: file, old: old, fresh: fresh, L: L, wait: wait };
  for (var k = 0; k < CASES.length; k++) {
    var c = CASES[k], r = null;
    try {
      if (c.kind === "given") r = runGiven(L, c);
      else if (c.kind === "build") r = runBuild(L, c);
      else if (c.kind === "pick") { var p0 = L.codeChecks.pick(c.q); try { L.store.set("codes.practice", c.saved || ""); } catch (e1) { } var p = L.codeChecks.pick(c.q); try { L.store.set("codes.practice", ""); } catch (e2) { } r = p === c.expect ? null : ["picked " + p + ", not " + c.expect + (c.saved ? " (saved " + c.saved + ")" : ""), c.harm || "medium"]; }
      else r = await c.run(env);
      if (r === "" || r === undefined) r = null;
      if (typeof r === "string") r = [r, c.harm || "medium"];
    } catch (e) { r = ["the case threw: " + String(e && e.stack || e).split("\n").slice(0, 2).join(" "), "high"]; }
    if (r) { dis++; lines.push("DISAGREE " + c.id + " " + String(r[0]).replace(/\s+/g, " ") + " [" + r[1] + "]"); }
    else { agree++; lines.push("AGREE " + c.id); }
  }
  lines.forEach(function (l) { console.log(l); });
  console.log(CASES.length + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
  process.exit(0);
})();
