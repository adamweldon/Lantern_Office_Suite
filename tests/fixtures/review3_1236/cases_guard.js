// cases_guard.js -- the guards: every bench prompt as 1.24.35's (8cb3281) but make-control and make-control-b, with or
// without a circuit kept while the bench runs; every saved reply with a MAKE block (tests/fixtures/bench_run_*.json)
// built as on 1.24.35, one case per file; the two changed bench prompts' givens passing the bench's own checks.
"use strict";
var fs = require("fs"), path = require("path");
var lib = require("./lib.js");
var OLD = "8cb3281", FIX = path.resolve(__dirname, "..");
var oldPage = null;
async function old(env) { if (!oldPage) { oldPage = lib.loadAt(OLD); await env.wait(120); } return oldPage; }
function questions(L) { return (L.aiBenchQuestions || []).map(function (q) { return { set: "a", q: q }; }).concat((L.aiBenchQuestionsB || []).map(function (q) { return { set: "b", q: q }; })); }
function walk(x, out) {
  if (Array.isArray(x)) x.forEach(function (y) { walk(y, out); });
  else if (x && typeof x === "object") {
    var q = x.q || x.question, r = x.reply;
    if (typeof r === "string" && /\bMAKE\s+[A-Z]/.test(r) && typeof q === "string") out.push({ id: x.id || "", q: q, reply: r });
    Object.keys(x).forEach(function (k) { if (x[k] && typeof x[k] === "object") walk(x[k], out); });
  }
}
function sig(r) {
  if (!r) return "null";
  var p = r.plan || {};
  return JSON.stringify({ ok: !!r.ok, problems: r.problems || [], mode: p.mode || "", circuit: p.circuit ? { rungs: p.circuit.rungs, feed: p.circuit.feed, rails: p.circuit.rails, steps: p.circuit.steps, added: p.circuit.added, changed: p.circuit.changed } : null, n: p.shapes ? p.shapes.length : (p.parts ? p.parts.length : null) });
}
var files = fs.readdirSync(FIX).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort();
var perFile = files.map(function (f) {
  var rows = []; try { walk(JSON.parse(fs.readFileSync(path.join(FIX, f), "utf8")), rows); } catch (e) { rows = []; }
  return { f: f, rows: rows };
}).filter(function (x) { return x.rows.length; });
function benchCheck(id, has) {
  return { id: "gd-" + id + "-given", kind: "fn", harm: "high", run: async function (env) {
    var L = env.L, bq = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).filter(function (x) { return x.id === id; })[0];
    if (!bq) return "no bench question " + id;
    var g = lib.shown(L, bq.q);
    if (!g || g.id !== "control-starter") return "the starter given is not shown for " + id;
    if (has.some(function (l) { return g.lines.indexOf(l) < 0; })) return "the given lacks " + has.join(" / ") + ": " + g.lines.join(" | ");
    var r = L.aiAct.build(g.block, bq.q);
    if (!r || !r.ok || !r.plan) return "the given does not build";
    var why = bq.check(r.plan, r);
    return why ? "the given fails the bench’s own check: " + why : "";
  } };
}
module.exports = [
  { id: "gd-bench-prompts", kind: "fn", harm: "high", run: async function (env) {
    var A = await old(env), B = env.L, qa = questions(A.L), qb = questions(B), diff = [];
    if (qa.length !== qb.length) return "the bench has " + qb.length + " questions, 1.24.35 had " + qa.length;
    qb.forEach(function (x) {
      var y = qa.filter(function (z) { return z.set === x.set && z.q.id === x.q.id; })[0];
      if (!y) { diff.push("new " + x.q.id); return; }
      if (A.L.aiAct.prompt(y.q.q) !== B.aiAct.prompt(x.q.q) && !/^make-control(-b)?$/.test(x.q.id)) diff.push(x.q.id);
    });
    return diff.length ? "prompts differ from 1.24.35 for " + diff.join(", ") : "";
  } },
  { id: "gd-bench-prompts-changed", kind: "fn", harm: "medium", run: async function (env) {
    var A = await old(env), B = env.L, out = [];
    ["make-control", "make-control-b"].forEach(function (id) {
      var y = questions(A.L).filter(function (z) { return z.q.id === id; })[0], x = questions(B).filter(function (z) { return z.q.id === id; })[0];
      if (!x || !y) { out.push("no " + id); return; }
      if (A.L.aiAct.prompt(y.q.q) === B.aiAct.prompt(x.q.q)) out.push(id + " is unchanged (no given shown)");
    });
    return out.join("; ");
  } },
  { id: "gd-bench-prompts-kept-running", kind: "fn", harm: "high", run: async function (env) {
    var o = await env.fresh(), L = o.L, qs = questions(L), base = {}, kept = 0;
    qs.forEach(function (x) { base[x.set + ":" + x.q.id] = L.aiAct.prompt(x.q.q); });
    // keep the ideal of every control question the bench has, as a user would after a good run
    qs.filter(function (x) { return x.q.ideal && /^MAKE CONTROL/.test(x.q.ideal); }).forEach(function (x) { var m = L.aiAct.build(x.q.ideal, x.q.q); if (L.givens.keep(m, x.q.q)) kept++; });
    if (!kept) return "nothing could be kept";
    var shownOutside = qs.filter(function (x) { var s = lib.shown(L, x.q.q); return s && s.user; }).length;
    L.aiBench.running = true;
    var diff = qs.filter(function (x) { return L.aiAct.prompt(x.q.q) !== base[x.set + ":" + x.q.id]; }).map(function (x) { return x.q.id; });
    L.aiBench.running = false;
    return !shownOutside ? "the kept circuits are not shown even outside a run (" + kept + " kept)" : diff.length ? "with circuits kept, a run’s prompts differ for " + diff.join(", ") : "";
  } },
  { id: "gd-refused-prompts-unchanged", kind: "fn", harm: "high", run: async function (env) {
    // every question of this review that is shown no given gets 1.24.35's prompt, byte for byte
    var A = await old(env), B = env.L, qs = require("./cases_givens.js").map(function (c) { return c.q; }), diff = [], n = 0;
    qs.forEach(function (q) { if (lib.shown(B, q)) return; n++; if (A.L.aiAct.prompt(q) !== B.aiAct.prompt(q)) diff.push(q); });
    return diff.length ? diff.length + " of " + n + " refused questions have another prompt than on 1.24.35: " + diff.slice(0, 3).join(" || ") : "";
  } },
  benchCheck("make-control", ["lamp LT1 M1 \x22run\x22 green"]),
  benchCheck("make-control-b", ["lamp LT1 M1 off \x22stopped\x22 red"]),
  { id: "gd-bench-ideals", kind: "fn", harm: "high", run: async function (env) {
    var A = await old(env), B = env.L, diff = [];
    questions(B).forEach(function (x) {
      if (!x.q.ideal || !/^MAKE /.test(x.q.ideal)) return;
      var y = questions(A.L).filter(function (z) { return z.set === x.set && z.q.id === x.q.id; })[0];
      if (!y || !y.q.ideal) return;
      if (sig(A.L.aiAct.build(y.q.ideal, y.q.q)) !== sig(B.aiAct.build(x.q.ideal, x.q.q))) diff.push(x.q.id);
    });
    return diff.length ? "the bench’s ideal blocks build otherwise than on 1.24.35: " + diff.join(", ") : "";
  } }
].concat(perFile.map(function (pf) {
  return { id: "gd-replies-" + pf.f.replace(/^bench_run_?|\.json$/g, ""), kind: "fn", harm: "high", run: async function (env) {
    var A = await old(env), B = env.L, diff = [];
    pf.rows.forEach(function (x) {
      var ra, rb;
      try { ra = A.L.aiAct.build(x.reply, x.q); } catch (e) { ra = { err: String(e) }; }
      try { rb = B.aiAct.build(x.reply, x.q); } catch (e) { rb = { err: String(e) }; }
      if (sig(ra) !== sig(rb)) diff.push((x.id || x.q.slice(0, 40)) + ": " + sig(rb).slice(0, 160));
    });
    return diff.length ? pf.rows.length + " replies, " + diff.length + " built otherwise than on 1.24.35: " + diff.join(" || ") : "";
  } };
}));
