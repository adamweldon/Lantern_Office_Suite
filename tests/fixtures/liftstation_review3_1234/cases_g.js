// cases_g.js -- every saved bench reply (tests/fixtures/bench_run_*.json: each row with a MAKE block, its first reply
// and its last) replayed through act.build and act.solve (the model scripted: the first reply, then the last) on the
// draft and on 1.24.33, and graded by L.aiBench.grade. What changed is listed here and judged; nothing else may change.
"use strict";
var lib = require("./lib.js"), fs = require("fs"), path = require("path");
var DIR = path.join(lib.ROOT, "tests", "fixtures");
function rowsOf(d) { if (Array.isArray(d)) return d; if (d.rows) return d.rows; return Object.keys(d).filter(function (k) { return k[0] !== "_"; }).map(function (k) { return Object.assign({ id: k }, d[k]); }); }
function rows() {
  var out = [], seen = {};
  fs.readdirSync(DIR).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().forEach(function (f) {
    rowsOf(JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"))).forEach(function (r) {
      if (!r || !r.q) return;
      var first = typeof r.first === "string" ? r.first : r.reply, last = typeof r.reply === "string" ? r.reply : first;
      if (typeof first !== "string" || !/MAKE\s+[A-Z]/.test(first + last)) return;
      var k = r.q + "\0" + first + "\0" + last;
      if (seen[k]) return; seen[k] = 1;
      out.push({ file: f, id: r.id, q: r.q, first: first, last: last });
    });
  });
  return out;
}
function sig(m) { return m ? JSON.stringify({ ok: !!m.ok, kind: m.block && m.block.kind, readAs: m.readAs || "", p: m.problems || [] }) : "null"; }
// the rows whose build changed, judged one by one below
var KNOWN = { "bench_run_1244_2b.json make-parallel-lamps last": 1, "bench_run_1247_08b.json make-parallel-lamps first": 1 };
var C = [];
C.push({ id: "G-bench-build", harm: "high", right: true, input: { files: "tests/fixtures/bench_run_*.json" },
  why: "Every saved reply builds as in 1.24.33 but the rows judged below",
  run: async function (x) {
    var bad = [], n = 0;
    rows().forEach(function (r) {
      [["first", r.first], ["last", r.last]].forEach(function (t) {
        if (t[0] === "last" && t[1] === r.first) return;
        n++;
        var a = sig(lib.build(x.N.L, t[1], r.q)), b = sig(lib.build(x.O.L, t[1], r.q));
        if (a !== b && !KNOWN[r.file + " " + r.id + " " + t[0]]) bad.push(r.file + " " + r.id + " (" + t[0] + "): " + a.slice(0, 200) + " / 1.24.33 " + b.slice(0, 200));
      });
    });
    return n < 300 ? "only " + n + " replies found" : bad.join(" || ");
  } });
C.push({ id: "G-bench-grade", harm: "high", right: true, input: { files: "tests/fixtures/bench_run_*.json" },
  why: "Every saved row, solved and graded as the bench does (first reply, then the last for the correction), passes or fails as in 1.24.33",
  run: async function (x) {
    function item(L, id) { return (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).filter(function (b) { return b.id === id; })[0]; }
    var rs = rows(), bad = [];
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i], g = [];
      for (var k = 0; k < 2; k++) {
        var L = k ? x.O.L : x.N.L, it = item(L, r.id), out;
        try { out = await L.aiAct.solve(r.q, lib.seq([r.first, r.last, r.last, r.last])); } catch (e) { out = { text: "THREW " + e }; }
        var gr = null; try { gr = it ? L.aiBench.grade(it, out.text, out) : null; } catch (e) { gr = { pass: "THREW " + e }; }
        g.push(gr ? String(gr.pass) : "n/a");
      }
      if (g[0] !== g[1]) bad.push(r.file + " " + r.id + ": " + g[0] + " / 1.24.33 " + g[1]);
    }
    return bad.join("; ");
  } });
// the 2B's parallel lamps (bench_run_1244_2b.json, its second reply): L2 wired to V1 only. 1.24.33 said the LED's resistor
// (true, but the question is the lamps); now L2's one wire is said -- the question's own failure. Right.
C.push({ id: "G-1244-2b-parallel-L2", harm: "medium", right: false, input: { file: "bench_run_1244_2b.json", row: "make-parallel-lamps" },
  why: "the reply's L2 lights nothing: said",
  run: async function (x) {
    var r = rows().filter(function (z) { return z.file === "bench_run_1244_2b.json" && z.id === "make-parallel-lamps"; })[0];
    if (!r) return "row not found";
    var m = lib.build(x.N.L, r.last, r.q);
    return m && !m.ok && /L2 \(“100 ohm”\) is wired on one side only, to V1/.test(lib.probs(m)) ? "" : lib.probs(m);
  } });
// the replies Chat now shows more of (rest()): each a block the model wrote, not the instructions' example nor the block made
C.push({ id: "G-bench-rest", harm: "medium", right: true, input: { files: "tests/fixtures/bench_run_*.json" },
  why: "rest() over every saved reply: what it would show is the model's own other blocks, each built; none is the made block again",
  run: async function (x) {
    var bad = [], shown = 0;
    rows().forEach(function (r) {
      [r.first, r.last].forEach(function (t) {
        var m = lib.build(x.N.L, t, r.q), rs = [];
        if (!m) return;
        try { rs = x.N.L.aiAct.rest(t, r.q, m); } catch (e) { bad.push(r.id + " THREW " + e); return; }
        rs.forEach(function (b) { shown++; if (b.block && m.block && b.block.title === m.block.title && (b.block.lines || []).join("\n") === (m.block.lines || []).join("\n")) bad.push(r.file + " " + r.id + ": the made block again"); });
      });
    });
    return bad.join("; ");
  } });
module.exports = C;
