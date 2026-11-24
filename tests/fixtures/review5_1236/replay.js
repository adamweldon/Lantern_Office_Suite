// replay.js -- the fifth review of 1.24.36 (review5_1236), run against src/lantern.inner.html or the file in argv[2].
//   node tests/fixtures/review5_1236/replay.js [path/to/lantern.inner.html]
// Prints "AGREE <id>" or "DISAGREE <id> <what was seen> [high|medium|low]" per case, then "N cases: A AGREE, D DISAGREE".
// A case says what is right; AGREE means Lantern did that. 1.24.35 (git 8cb3281) is loaded beside it for the guards and
// for the prompts of questions no given fits (they must be 1.24.35's byte for byte).
"use strict";
var path = require("path"), cp = require("child_process");
var REPO = path.join(__dirname, "..", "..", "..");
module.paths.unshift(path.join(REPO, "node_modules"));
var load5 = require("./load5.js"), S = require("./sim.js");
var GIVENS = require("./cases_givens.js"), BUILDS = require("./cases_build.js"), MISC = require("./cases_misc.js");
var file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO, "src", "lantern.inner.html");
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function blk(lines, title) { return "MAKE CONTROL: " + (title || "Control") + "\n" + lines.join("\n") + "\nEND"; }
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 400) ? s.slice(0, n || 400) + "…" : s; }
function rx(s) { return s instanceof RegExp ? s : new RegExp(s); }

// the given a question gets: {head, title, lines} or null
function givenOf(L, q) {
  var p = L.aiControl.promptOf(q), i = -1;
  p.forEach(function (l, k) { if (i < 0 && /^(?:Lantern’s tested circuit|Your own kept circuit)/.test(l)) i = k; });
  if (i < 0) return null;
  return { head: p[i], title: p[i + 1].replace(/^MAKE CONTROL:\s*/, ""), lines: p.slice(i + 2, p.lastIndexOf("END")) };
}
function circuitOf(m) { return m && m.plan && m.plan.circuit ? m.plan.circuit : null; }

function runGiven(c, ctx) {
  var L = ctx.L, g, shown, bad = [], harm = c.harm || "high";
  try { g = givenOf(L, c.q); } catch (e) { return { agree: false, did: "promptOf threw: " + e.message, harm: "high" }; }
  shown = /tested circuit for this|kept circuit for this/.test(String(L.aiAct.prompt(c.q) || ""));
  var lines = g ? g.lines : null, got = lines ? lines.join(" / ") : null;
  if (c.want !== undefined) {
    if (c.want === null && got !== null) bad.push("a given is shown where none fits: " + got);
    else if (c.want !== null && got === null) { bad.push("no given (the plain question fits " + c.want + ")"); harm = "medium"; }
    else if (c.want !== null && got !== c.want) bad.push("the given is " + got + " (right: " + c.want + ")");
  }
  if (c.check) { var w = null; try { w = c.check(lines); } catch (e) { w = "check threw " + e.message; } if (w) bad.push(w); }
  if (lines) {
    // the given, as a model copying it writes it, must be drawn with nothing sent back
    var m = L.aiAct.build(blk(lines, g.title), c.q);
    if (!m || !m.ok) bad.push("the given itself is not drawn: " + short(m ? (m.problems || []).join(" | ") : "nothing built", 300));
    if (bad.length && !shown) { harm = "low"; bad.push("(not shown in Chat: the question is not read as a control circuit's)"); }
  } else {
    // no given: the prompt must be 1.24.35's
    var a = String(L.aiAct.prompt(c.q) || ""), b = String(ctx.Lold.aiAct.prompt(c.q) || "");
    if (a !== b) bad.push("no given, but the prompt is not 1.24.35's");
  }
  return { agree: !bad.length, did: bad.join("; "), harm: harm };
}

function applyFixes(lines, problems) {
  var out = lines.slice(), miss = [];
  problems.forEach(function (p) {
    var m = /Write it: (.+)$/.exec(p);
    if (!m) return;
    var line = m[1], id = (/^\s*\S+\s+([A-Za-z]{1,4}\d{1,3}[A-Za-z]?)\b/.exec(line) || [])[1];
    if (!id) { miss.push(line); return; }
    var at = -1;
    out.forEach(function (l, i) { if (at < 0 && new RegExp("^\\s*(?:\\d{1,2}[.\\x29]\\s+)?\\S+\\s+" + id + "\\b", "i").test(l)) at = i; });
    if (at < 0) out.forEach(function (l, i) { if (at < 0 && new RegExp("^\\s*(?:\\d{1,2}[.\\x29]\\s+)?" + id + "\\b", "i").test(l)) at = i; });
    if (at < 0) miss.push(line); else out[at] = line;
  });
  return { lines: out, miss: miss };
}

function runBuild(c, ctx) {
  var L = ctx.L, m = L.aiAct.build(blk(c.lines, c.title), c.q), bad = [];
  if (!m) return { agree: false, did: "nothing built", harm: c.harm };
  var probs = m.problems || [], ptxt = probs.join(" | ");
  function simOn(mm) { if (!c.sim) return null; var cc = circuitOf(mm); if (!cc) return "not drawn as a control circuit (" + (mm && mm.plan ? mm.plan.mode : "-") + ")"; try { return c.sim(cc, S); } catch (e) { return "sim threw " + e.message; } }
  if (c.expect === "ok") {
    if (!m.ok) {
      bad.push("sent back: " + short(ptxt, 500));
      if (/Write it: /.test(ptxt)) {
        var f0 = applyFixes(c.lines, probs), m0 = L.aiAct.build(blk(f0.lines, c.title), c.q);
        var s0 = m0 && m0.ok ? simOn(m0) : null;
        bad.push(m0 && m0.ok ? (s0 ? "and the line handed back, copied in, draws it wrong: " + s0 : "the line handed back draws") : "the line handed back is sent back again: " + short(m0 ? m0.problems.join(" | ") : "-", 200));
      }
    } else { var s = simOn(m); if (s) bad.push("drawn wrong: " + s); }
  } else {
    if (m.ok) bad.push("drawn without a word (" + short(m.summary, 200) + ")");
    else {
      (c.want || []).forEach(function (w) { if (!probs.some(function (p) { return rx(w).test(p); })) bad.push("nothing sent back matches /" + w + "/"); });
      (c.not || []).forEach(function (w) { if (probs.some(function (p) { return rx(w).test(p); })) bad.push("what is sent back has /" + w + "/"); });
      if (c.fix) {
        if (!/Write it: /.test(ptxt)) bad.push("no line to write in what goes back: " + short(ptxt, 300));
        else {
          var f = applyFixes(c.lines, probs);
          if (f.miss.length) bad.push("a line handed back names no device of the block: " + f.miss.join(" | "));
          var m2 = L.aiAct.build(blk(f.lines, c.title), c.q);
          if (!m2 || !m2.ok) bad.push("the lines handed back, copied in, are sent back again: " + short(m2 ? m2.problems.join(" | ") : "-", 300));
          else { var s2 = simOn(m2); if (s2) bad.push("the lines handed back, copied in, draw it wrong: " + s2); }
        }
      }
    }
  }
  return { agree: !bad.length, did: bad.join("; ") + (c.note && bad.length ? " (" + c.note + ")" : ""), harm: c.harm };
}

(async function () {
  var oldHtml = cp.execSync("git show 8cb3281:src/lantern.inner.html", { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString();
  var o = load5(file), oo = load5({ html: oldHtml });
  await sleep(80);
  var ctx = { L: o.L, o: o, Lold: oo.L, blk: blk, S: S, oldHtml: oldHtml, repo: REPO,
    fresh: function (store) { var x = load5(file, { store: store || {} }); return x; } };
  var n = 0, a = 0, d = 0;
  function out(id, r, harm) {
    n++;
    if (r.agree) { a++; console.log("AGREE " + id); }
    else { d++; console.log("DISAGREE " + id + " " + short(r.did, 900) + " [" + (r.harm || harm || "medium") + "]"); }
  }
  GIVENS.forEach(function (c) { var r; try { r = runGiven(c, ctx); } catch (e) { r = { agree: false, did: "threw " + e.message, harm: "high" }; } out(c.id, r, c.harm); });
  BUILDS.forEach(function (c) { var r; try { r = runBuild(c, ctx); } catch (e) { r = { agree: false, did: "threw " + e.message, harm: "high" }; } out(c.id, r, c.harm); });
  for (var i = 0; i < MISC.length; i++) {
    var c = MISC[i], r;
    try { r = c.run(ctx); } catch (e) { r = { agree: false, did: "threw " + e.message }; }
    if (r && r.then) r = await r;
    if (!r.harm) r.harm = c.harm;
    out(c.id, r, c.harm);
  }
  console.log(n + " cases: " + a + " AGREE, " + d + " DISAGREE");
  process.exit(0);
})().catch(function (e) { console.log("replay failed: " + (e && e.stack || e)); process.exit(1); });
