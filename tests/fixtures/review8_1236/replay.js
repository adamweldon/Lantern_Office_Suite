// replay.js [inner html] -- runs the eighth review's cases (cases.js) against src/lantern.inner.html, or the file named.
// Prints AGREE <id> or DISAGREE <id> <what was seen> [high|medium|low] for each, and a last line
// "N cases: A AGREE, D DISAGREE".
"use strict";
var path = require("path"), fs = require("fs"), crypto = require("crypto");
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var cases = require("./cases.js");
var file = process.argv[2] || path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html");
var o = load(file);

// the block Lantern shows the model to copy, as the prompt carries it
function given(L, q) {
  var ls = String(L.aiAct.prompt(q) || "").split("\n"), i;
  for (i = 0; i < ls.length; i++) if (/^(?:Lantern’s tested circuit for this|Your own kept circuit for this)/.test(ls[i])) break;
  if (i >= ls.length) return null;
  var out = [];
  for (var j = i + 2; j < ls.length && ls[j] !== "END"; j++) out.push(ls[j]);
  return { kept: /^Your own/.test(ls[i]), lines: out };
}
function same(a, b) { return a === null || b === null ? a === b : a.join("\n") === b.join("\n"); }
function show(g) { return g ? "[" + g.join(" / ") + "]" : "no given"; }
function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + "..." : s; }
// a code check's line back: "(US practice: ...)" or "(IEC practice: ...)"
function codeBacks(m) { return ((m && m.problems) || []).map(function (p) { return typeof p === "string" ? p : JSON.stringify(p); }).filter(function (p) { return /\((?:US|IEC) practice:/.test(p); }); }
function oks(m) { return m && m.codes ? (m.codes.checked || []).filter(function (r) { return r.ok; }).map(function (r) { return r.ok; }) : []; }
function forgetAll(L) { L.givens.mine().forEach(function (g) { L.givens.forget(g.id); }); }

function run(c, L) {
  // -> {ok: bool, seen: text, harm}
  if (c.t === "given") {
    var g = given(L, c.q), lines = g && !g.kept ? g.lines : null, alts = [c.want].concat(c.accept || []);
    if (g && g.kept) return { ok: false, seen: "a kept circuit shown", harm: "high" };
    if (alts.some(function (a) { return same(a, lines); })) return { ok: true };
    return { ok: false, seen: show(lines), harm: c.harm || (lines ? "high" : "medium") };
  }
  if (c.t === "build") {
    var m = null;
    try { m = L.aiAct.build(c.text, c.q); } catch (e) { return { ok: false, seen: "threw " + e, harm: "high" }; }
    var cb = codeBacks(m), w = c.want;
    if (w.code === 0) {
      if (cb.length) return { ok: false, seen: "sent back: " + cut(cb.join(" | "), 260), harm: c.harm || "high" };
      if (c.okHas && !oks(m).some(function (x) { return x.indexOf(c.okHas) >= 0; })) return { ok: false, seen: "kept lines: " + JSON.stringify(oks(m)) + (m && m.problems && m.problems.length ? " problems: " + cut(m.problems.join(" | "), 160) : ""), harm: c.harm || "low" };
      return { ok: true };
    }
    if (!cb.some(function (x) { return w.code.test(x); })) return { ok: false, seen: cb.length ? "sent back other: " + cut(cb.join(" | "), 200) : "nothing sent back", harm: c.harm || "medium" };
    return { ok: true };
  }
  if (c.t === "keep") {
    forgetAll(L);
    var mm = L.aiAct.build(c.text, c.q1), u = L.givens.keep(mm, c.q1);
    if (!u) { forgetAll(L); return { ok: false, seen: "not kept: " + cut(JSON.stringify((mm && mm.problems) || []), 160), harm: "low" }; }
    var gm = L.givens.match("CONTROL", c.q2), gp = given(L, c.q2), shown = !!(gm && gm.user && gp && gp.kept);
    forgetAll(L);
    if (shown === c.want) return { ok: true };
    return { ok: false, seen: shown ? "the kept circuit shown" : "the kept circuit not shown", harm: c.harm || (shown ? "high" : "medium") };
  }
  if (c.t === "pick") {
    var p = L.codeChecks.pick(c.q);
    return p === c.want ? { ok: true } : { ok: false, seen: "picked " + p, harm: c.harm || "medium" };
  }
  if (c.t === "guard") {
    var gd = JSON.parse(fs.readFileSync(path.join(__dirname, "guard_1235.json"), "utf8")).prompts, bad = [];
    (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).forEach(function (x) {
      if (/^make-control(?:-b)?$/.test(x.id)) return;
      var s; try { s = String(L.aiAct.prompt(x.q)); } catch (e) { s = "ERR " + e; }
      if (gd[x.id] !== crypto.createHash("sha1").update(s).digest("hex")) bad.push(x.id);
    });
    return bad.length ? { ok: false, seen: "prompts differ from 1.24.35: " + bad.join(","), harm: "high" } : { ok: true };
  }
  return { ok: false, seen: "unknown case kind " + c.t, harm: "low" };
}

setTimeout(function () {
  var L = o.L, a = 0, d = 0;
  cases.forEach(function (c) {
    var r;
    try { r = run(c, L); } catch (e) { r = { ok: false, seen: "threw " + e, harm: "high" }; }
    if (r.ok) { a++; console.log("AGREE " + c.id); }
    else { d++; console.log("DISAGREE " + c.id + " " + String(r.seen).replace(/\s+/g, " ") + " [" + r.harm + "]"); }
  });
  console.log(cases.length + " cases: " + a + " AGREE, " + d + " DISAGREE");
}, 100);
