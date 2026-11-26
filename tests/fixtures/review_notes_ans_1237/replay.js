// replay.js [inner html] -- the review of 22b1c03 (ANS in a drawing's notes), against src/lantern.inner.html or the
// file named. Prints AGREE <id> or DISAGREE <id> <what was seen> [high|medium|low] per case, and a last line
// "N cases: A AGREE, D DISAGREE".
//   cases.js            the reviewer's own cases (what is right, as the reviewer judges it)
//   guard_50f9ceb.json  every saved reply with a MAKE block in tests/fixtures/bench_run*.json, built on 50f9ceb, and
//                       every bench prompt (aiAct.prompt, CHAT.buildSystem full and short) -- made by gen_guard.js
"use strict";
var path = require("path"), fs = require("fs");
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var lib = require("./lib.js");
var CASES = require("./cases.js");
var file = process.argv[2] || path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html");
var GUARD = JSON.parse(fs.readFileSync(path.join(__dirname, "guard_50f9ceb.json"), "utf8"));
var o = load(file);
lib.freezeDate(o.w, 2026, 10, 24);   // (1.24.39) the day the guard was made: "one week from today" read as of then

function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + "…" : s; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// what a case's want says of a result {ok, texts, problems, kind}
function judge(w, r) {
  var bad = [];
  if (w.kind && r.kind !== w.kind) bad.push("built as " + r.kind + ", not " + w.kind);
  if (w.ok != null && !!r.ok !== w.ok) bad.push("ok=" + !!r.ok + " (want " + w.ok + ")");
  if (w.texts && JSON.stringify(r.texts) !== JSON.stringify(w.texts)) bad.push("drawn " + JSON.stringify(r.texts) + " (want " + JSON.stringify(w.texts) + ")");
  if (w.none && (r.problems || []).length) bad.push("problems " + JSON.stringify(r.problems));
  (w.probs || []).forEach(function (re) { if (!(r.problems || []).some(function (p) { return re.test(p); })) bad.push("no problem like " + re + " in " + JSON.stringify(r.problems)); });
  (w.notProbs || []).forEach(function (re) { var h = (r.problems || []).filter(function (p) { return re.test(p); }); if (h.length) bad.push("problem " + JSON.stringify(h[0])); });
  if (w.check) { var c = w.check(r); if (c) bad.push(c); }
  return bad;
}
function made(m) {
  if (!m) return { ok: false, texts: null, problems: ["(nothing built)"], kind: null };
  return { ok: !!m.ok, texts: m.plan && m.plan.notes ? m.plan.notes.slice() : null, problems: (m.problems || []).map(String), kind: m.block ? String(m.block.kind) : null };
}

var T = {};
T.notes = function (c, L) {
  var st = {}, rs = c.notes.map(function (n) { return L.aiSchematicMore.noteText(n, st); });
  return judge(c.want, { texts: rs.map(function (r) { return r.text; }), problems: [].concat.apply([], rs.map(function (r) { return r.problems; })) });
};
T.apart = function (c, L) {
  var rs = c.notes.map(function (n) { return L.aiSchematicMore.noteText(n); });
  return judge(c.want, { texts: rs.map(function (r) { return r.text; }), problems: [].concat.apply([], rs.map(function (r) { return r.problems; })) });
};
T.build = function (c, L) { return judge(c.want, made(L.aiAct.build(c.text, c.q))); };
T.builds = function (c, L) {
  var m = null;
  c.items.forEach(function (it) { m = L.aiAct.build(it[1], it[0]); });
  return judge(c.want, made(m));
};
T.rest = function (c, L) {
  var first = L.aiAct.build(c.text, c.q), more = L.aiAct.rest(c.text, c.q, first);
  if (!more.length) return ["no second drawing built"];
  return judge(c.want, made(more[0]));
};
T.solve = async function (c, L) {
  var sent = [], i = 0;
  var out = await L.aiAct.solve(c.q, function (msgs) { sent.push(o.textOf(msgs[msgs.length - 1].content)); var r = c.replies[Math.min(i++, c.replies.length - 1)]; return Promise.resolve(r); });
  var r = made(out.made), bad = judge(c.want, r);
  if (c.want.rounds != null && out.rounds !== c.want.rounds) bad.push(out.rounds + " rounds (want " + c.want.rounds + ")");
  (c.want.sent || []).forEach(function (x) { var t = sent[x[0]]; if (!t || !x[1].test(t)) bad.push("message " + (x[0] + 1) + " lacks " + x[1] + (t ? ": " + cut(t, 200) : " (not sent)")); });
  (c.want.notSent || []).forEach(function (x) { var t = sent[x[0]]; if (t && x[1].test(t)) bad.push("message " + (x[0] + 1) + " has " + x[1] + ": " + cut(t, 200)); });
  return bad;
};
T.chat = async function (c, L) {
  o.script = function () { return c.reply; };
  var r;
  try { r = await L.CHAT.turn([], c.q, {}, {}); } finally { o.script = null; }
  var ms = (r && r.made ? [r.made] : []).concat((r && r.moreMade) || []);
  var e = c.want.check(ms);
  return e ? [e] : [];
};
T.assist = function (c, L) {
  var r = L.assist.run(c.text), bad = [];
  var vals = r.steps.map(function (s) { return s.ok ? s.value : null; });
  if (JSON.stringify(vals) !== JSON.stringify(c.want.values)) bad.push("values " + JSON.stringify(vals) + " (want " + JSON.stringify(c.want.values) + ")");
  (c.want.errs || []).forEach(function (re, k) { var s = r.steps.filter(function (x) { return !x.ok; })[k]; if (!s || !re.test(s.err)) bad.push("error " + (k + 1) + " is " + (s ? JSON.stringify(s.err) : "none") + " (want " + re + ")"); });
  return bad;
};
T.formula = function (c, L) {
  var v, e = null;
  try { v = L.formula.evaluate(c.expr, JSON.parse(JSON.stringify(c.ctx))); } catch (x) { e = String(x && x.message || x); }
  if (c.want.err) return e && c.want.err.test(e) ? [] : ["gave " + (e ? "error " + e : v) + " (want error " + c.want.err + ")"];
  return e ? ["error " + e] : v === c.want.value ? [] : ["gave " + v + " (want " + c.want.value + ")"];
};
T.sheet = function (c, L) {
  var out = L.sheetDocs.compute(c.cells), bad = [];
  Object.keys(c.want.values).forEach(function (k) { if (out[k] !== c.want.values[k]) bad.push(k + " is " + JSON.stringify(out[k]) + " (want " + c.want.values[k] + ")"); });
  return bad;
};
T.calc = async function (c, L) {
  var d = o.d, w = o.w;
  function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
  w.location.hash = "calc"; fire(w, "hashchange"); await sleep(80);
  function key(label) { var b = Array.prototype.filter.call(d.querySelectorAll(".calcbox button"), function (x) { return x.textContent === label; })[0]; if (!b) throw new Error("no key " + label); return b; }
  var res = [];
  c.keys.forEach(function (ks) { ks.forEach(function (k) { key(k).click(); }); res.push(d.querySelector(".cdisp .res").textContent); });
  w.location.hash = ""; fire(w, "hashchange");
  return JSON.stringify(res) === JSON.stringify(c.want.res) ? [] : ["shown " + JSON.stringify(res) + " (want " + JSON.stringify(c.want.res) + ")"];
};

(async function () {
  await sleep(120);
  var L = o.L, a = 0, d = 0, lines = [];
  function say(id, bad, harm) {
    if (!bad.length) { a++; console.log("AGREE " + id); }
    else { d++; console.log("DISAGREE " + id + " " + cut(bad.join("; "), 900).replace(/\s+/g, " ") + " [" + (harm || "medium") + "]"); }
  }
  // the guards first, on a fresh page, in the order gen_guard.js built them
  // (1.24.39) the guard is the replies saved when it was made, found by their own key: a reply saved since (a later
  // bench run's fixture) is another review's to guard, and is counted, not judged
  var pairs = lib.savedReplies(path.join(__dirname, "..")), byFile = {}, order = [], byKey = {}, later = 0, found = 0;
  GUARD.builds.forEach(function (g, k) { byKey[g.key] = { g: g, k: k }; });
  pairs.forEach(function (p) {
    var key = lib.sha(p.q + "\u0000" + p.text), hit = byKey[key];
    if (!hit) { later++; return; }
    found++;
    var now = lib.buildDigest(L, p.text, p.q, p.file), was = hit.g, k = hit.k, f = was.file || p.file;   // (its file as when the guard was made)
    if (!byFile[f]) { byFile[f] = { n: 0, bad: [] }; order.push(f); }
    byFile[f].n++;
    var diff = [];
    ["err", "none", "ok"].forEach(function (x) { if (JSON.stringify(was[x]) !== JSON.stringify(now[x])) diff.push(x + " " + JSON.stringify(was[x]) + " -> " + JSON.stringify(now[x])); });
    if (JSON.stringify(was.problems) !== JSON.stringify(now.problems)) diff.push("problems " + cut(JSON.stringify(was.problems), 200) + " -> " + cut(JSON.stringify(now.problems), 200));
    if (JSON.stringify(was.notes) !== JSON.stringify(now.notes)) diff.push("notes " + JSON.stringify(was.notes) + " -> " + JSON.stringify(now.notes));
    if (!diff.length && was.plan !== now.plan) diff.push("the plan differs");
    if (diff.length) byFile[f].bad.push("reply " + k + " (" + p.field + ", " + cut(p.q, 60) + "): " + diff.join("; "));
  });
  if (found !== GUARD.builds.length) say("guard-count", ["saved replies of the guard found: " + found + ", guard: " + GUARD.builds.length], "medium");
  if (later) console.log("(" + later + " replies saved after the guard was made: not judged here)");
  order.forEach(function (f) { say("guard-" + f.replace(/\.json$/, "") + "-" + byFile[f].n, byFile[f].bad, "high"); });
  var pn = lib.promptDigests(L), pb = Object.keys(GUARD.prompts).filter(function (k) { return pn[k] !== GUARD.prompts[k]; });
  if (Object.keys(pn).length !== Object.keys(GUARD.prompts).length) pb.push("count " + Object.keys(pn).length + " vs " + Object.keys(GUARD.prompts).length);
  say("guard-prompts-" + Object.keys(GUARD.prompts).length, pb.length ? ["prompts differ from 50f9ceb: " + pb.join(",")] : [], "high");

  for (var k = 0; k < CASES.length; k++) {
    var c = CASES[k], bad;
    try { bad = await T[c.t](c, L); } catch (e) { bad = ["the case threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e)]; }
    say(c.id, bad, c.harm);
  }
  console.log((a + d) + " cases: " + a + " AGREE, " + d + " DISAGREE");
  process.exit(0);
})();
