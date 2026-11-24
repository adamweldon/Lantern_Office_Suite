// cases_d.js -- the bench guard: of all bench questions (Lantern.aiBenchQuestions, aiBenchQuestionsB) only make-control
// and make-control-b get a given; every other one's action prompt, and the whole system prompt Chat sends (full and
// short), byte-identical to 1.24.35's; every saved bench reply (tests/fixtures/bench_run_*.json, each row's first reply
// and its last) built and graded as on 1.24.35; each bench question's ideal graded as on 1.24.35; the two givens, copied
// as they stand, pass their questions.
"use strict";
var lib = require("./lib.js"), fs = require("fs"), path = require("path");
var DIR = path.join(lib.ROOT, "tests", "fixtures");
function rowsOf(d) { if (Array.isArray(d)) return d; if (d.rows) return d.rows; return Object.keys(d).filter(function (k) { return k[0] !== "_"; }).map(function (k) { return Object.assign({ id: k }, d[k]); }); }
var ROWS = null;
function rows() {
  if (ROWS) return ROWS;
  var out = [], seen = {};
  fs.readdirSync(DIR).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")), rs = rowsOf(d);
    if (!Array.isArray(d)) ["run", "rows", "failed", "replies", "results"].forEach(function (k) { if (Array.isArray(d[k])) rs = rs.concat(d[k]); else if (d[k] && typeof d[k] === "object" && Array.isArray(d[k].rows)) rs = rs.concat(d[k].rows); });
    rs.forEach(function (r) {
      if (!r || typeof r.q !== "string") return;
      var first = typeof r.first === "string" ? r.first : r.reply, last = typeof r.reply === "string" ? r.reply : first;
      if (typeof first !== "string") return;
      var k = r.q + "\0" + first + "\0" + last;
      if (seen[k]) return; seen[k] = 1;
      out.push({ file: f, id: r.id, q: r.q, first: first, last: last });
    });
  });
  ROWS = out;
  return out;
}
function circSig(m) {
  var c = lib.ctl(m);
  return c ? JSON.stringify(c.rungs.map(function (r) { function f(l) { return (l || []).map(function (e) { return e.id + "/" + e.kind + (e.nc ? "/nc" : ""); }).join(" "); } return [r.out.id, r.out.kind, f(r.stops), f(r.starts), !!r.seal, f(r.series), f(r.after), (r.branches || []).map(f).join("|")]; })) : "";
}
function sig(m) { return m ? JSON.stringify({ ok: !!m.ok, kind: m.block && m.block.kind, readAs: m.readAs || "", p: m.problems || [], s: m.summary || "", fix: m.fixKind || "", c: circSig(m) }) : "null"; }
function benchQs(L) { return (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []); }
var GIVEN_IDS = /^make-control(-b)?$/;
var cases = [];
cases.push({ id: "D-given-only-control", harm: "high", input: "every bench question of both sets", right: "only make-control and make-control-b are shown a given",
  run: function () {
    return lib.boot().then(function (x) {
      var qs = benchQs(x.N.L), hit = qs.filter(function (b) { return lib.shown(x.N.L, b.q).block; }).map(function (b) { return b.id; }).sort();
      return qs.length < 100 ? "only " + qs.length + " questions" : hit.join(",") === "make-control,make-control-b" ? "" : "given to: " + hit.join(", ");
    });
  } });
["aiBenchQuestions", "aiBenchQuestionsB"].forEach(function (set) {
  cases.push({ id: "D-prompt-identical-" + set, harm: "high", input: "every question of Lantern." + set + ", act.prompt beside 1.24.35's",
    right: "byte-identical, but for make-control and make-control-b",
    run: function () {
      return lib.boot().then(function (x) {
        var qs = x.N.L[set] || [], diff = [];
        qs.forEach(function (b) { if (GIVEN_IDS.test(b.id)) return; if (lib.prompt(x.N.L, b.q) !== lib.prompt(x.O.L, b.q)) diff.push(b.id); });
        return qs.length < 50 ? "only " + qs.length + " questions" : diff.join(", ");
      });
    } });
});
["full", "short"].forEach(function (mode) {
  cases.push({ id: "D-system-identical-" + mode, harm: "high", input: "Chat's whole system prompt (CHAT.buildSystem) for every bench question, prompt mode " + mode,
    right: "byte-identical to 1.24.35's, but for make-control and make-control-b",
    run: function () {
      return lib.boot().then(function (x) {
        var diff = [], n = 0;
        [x.N.L, x.O.L].forEach(function (L) { L.aiPrompt.setMode(mode); });
        benchQs(x.N.L).forEach(function (b) {
          var a, o;
          try { a = x.N.L.CHAT.buildSystem(b.q); } catch (e) { a = "THREW " + e; }
          try { o = x.O.L.CHAT.buildSystem(b.q); } catch (e) { o = "THREW " + e; }
          n++;
          if (GIVEN_IDS.test(b.id)) { if (a === o) diff.push(b.id + " unchanged (its given is not in the system prompt)"); return; }
          if (a !== o) diff.push(b.id);
        });
        [x.N.L, x.O.L].forEach(function (L) { L.aiPrompt.setMode("auto"); });
        return n < 100 ? "only " + n : diff.join(", ");
      });
    } });
});
cases.push({ id: "D-relevant-identical", harm: "high", input: "every bench question: the tools offered (act.relevant)", right: "as 1.24.35 offered them",
  run: function () {
    return lib.boot().then(function (x) {
      var diff = [];
      function ids(L, q) { try { return L.aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); } catch (e) { return "THREW " + e; } }
      benchQs(x.N.L).forEach(function (b) { var a = ids(x.N.L, b.q), o = ids(x.O.L, b.q); if (a !== o) diff.push(b.id + ": " + a + " / " + o); });
      return diff.join("; ");
    });
  } });
cases.push({ id: "D-control-prompt-shape", harm: "medium", input: "make-control's and make-control-b's prompts beside 1.24.35's",
  right: "every line before the example as before (\x22For example:\x22 taken off the last), the example replaced by the given's line and block, and nothing after it",
  run: function () {
    return lib.boot().then(function (x) {
      var bad = [];
      benchQs(x.N.L).filter(function (b) { return GIVEN_IDS.test(b.id); }).forEach(function (b) {
        var n = lib.prompt(x.N.L, b.q).split("\n"), o = lib.prompt(x.O.L, b.q).split("\n");
        var oe = o.findIndex(function (l) { return /For example:\s*$/.test(l); }), ng = n.findIndex(function (l) { return l.indexOf(lib.MARK) === 0; });
        if (oe < 0 || ng < 0) { bad.push(b.id + ": no example or no given line"); return; }
        var head = o.slice(0, oe + 1).map(function (l, i) { return i === oe ? l.replace(/\s*For example:\s*$/, "") : l; });
        if (JSON.stringify(n.slice(0, ng)) !== JSON.stringify(head)) bad.push(b.id + ": the lines before the given differ from 1.24.35's");
        var tail = n.slice(ng + 1);
        if (!/^MAKE CONTROL: /.test(tail[0]) || tail[tail.length - 1] !== "END" || tail.filter(function (l) { return l === "END"; }).length !== 1) bad.push(b.id + ": the given block is not one MAKE ... END at the end");
      });
      return bad.join("; ");
    });
  } });
cases.push({ id: "D-saved-build", harm: "high", input: "every first and last reply in tests/fixtures/bench_run_*.json, built for its question",
  right: "built as 1.24.35 built it: ok, kind, readAs, problems, summary and any ladder's circuit",
  run: function () {
    return lib.boot().then(function (x) {
      var bad = [], n = 0;
      rows().forEach(function (r) {
        [["first", r.first], ["last", r.last]].forEach(function (t) {
          if (t[0] === "last" && t[1] === r.first) return;
          n++;
          var a = sig(lib.build(x.N.L, t[1], r.q)), b = sig(lib.build(x.O.L, t[1], r.q));
          if (a !== b) bad.push(r.file + " " + r.id + " (" + t[0] + ")");
        });
      });
      cases.filter(function (c) { return c.id === "D-saved-build"; })[0].note = n + " replies from " + rows().length + " rows";
      return n < 400 ? "only " + n + " replies read" : bad.join("; ");
    });
  } });
cases.push({ id: "D-saved-grade", harm: "high", input: "every saved row of a bench question, solved as the bench does (the first reply, then the last) and graded",
  right: "each passes or fails as on 1.24.35",
  run: async function () {
    var x = await lib.boot(), bad = [], n = 0;
    function item(L, id) { return benchQs(L).filter(function (b) { return b.id === id; })[0]; }
    var rs = rows();
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i], g = [];
      if (!item(x.N.L, r.id)) continue;
      n++;
      for (var k = 0; k < 2; k++) {
        var L = k ? x.O.L : x.N.L, it = item(L, r.id), out;
        try { out = await L.aiAct.solve(r.q, lib.seq([r.first, r.last, r.last, r.last])); } catch (e) { out = { text: "THREW " + e }; }
        var gr = null; try { gr = it ? L.aiBench.grade(it, out.text, out) : null; } catch (e) { gr = { pass: "THREW " + e }; }
        g.push(gr ? String(gr.pass) + (gr.why ? " " + String(gr.why).slice(0, 80) : "") : "n/a");
      }
      if (g[0] !== g[1]) bad.push(r.file + " " + r.id + ": " + g[0] + " / 1.24.35 " + g[1]);
    }
    cases.filter(function (c) { return c.id === "D-saved-grade"; })[0].note = n + " rows graded";
    return n < 200 ? "only " + n + " rows graded" : bad.join("; ");
  } });
cases.push({ id: "D-ideals", harm: "high", input: "each bench question's ideal answer (both sets), solved and graded",
  right: "each grades as on 1.24.35; make-control's and make-control-b's pass",
  run: async function () {
    var x = await lib.boot(), bad = [];
    var qs = benchQs(x.N.L).filter(function (b) { return typeof b.ideal === "string" && /MAKE\s/.test(b.ideal); });
    for (var i = 0; i < qs.length; i++) {
      var b = qs[i], g = [];
      for (var k = 0; k < 2; k++) {
        var L = k ? x.O.L : x.N.L, it = benchQs(L).filter(function (y) { return y.id === b.id; })[0], out;
        try { out = await L.aiAct.solve(b.q, lib.seq([b.ideal])); } catch (e) { out = { text: "THREW " + e }; }
        var gr = null; try { gr = it ? L.aiBench.grade(it, out.text, out) : null; } catch (e) { gr = { pass: "THREW " + e }; }
        g.push(gr ? String(gr.pass) : "n/a");
      }
      if (g[0] !== g[1]) bad.push(b.id + ": " + g[0] + " / 1.24.35 " + g[1]);
      if (GIVEN_IDS.test(b.id) && g[0] !== "true") bad.push(b.id + "'s ideal does not pass");
    }
    cases.filter(function (c) { return c.id === "D-ideals"; })[0].note = qs.length + " ideals";
    return qs.length < 20 ? "only " + qs.length + " ideals" : bad.join("; ");
  } });
// the given copied as it stands, and the given copied the way the small models copy (with a sentence before it, with
// the instructions' **bold** or a list number, or with the given's line copied above it), passes the bench question
function variants(block, line) {
  return [["as it stands", block],
    ["after a sentence", "Here is the control circuit:\n\n" + block],
    ["with the given's line above it", line + "\n" + block],
    ["in a code fence", "```\n" + block + "\n```"],
    ["without END", block.replace(/\nEND$/, "")]];
}
cases.push({ id: "D-given-copied-passes", harm: "high", input: "make-control and make-control-b answered with their given, copied as it stands and the ways small models copy",
  right: "each passes its bench question",
  run: async function () {
    var x = await lib.boot(), bad = [], L = x.N.L;
    var qs = benchQs(L).filter(function (b) { return GIVEN_IDS.test(b.id); });
    for (var i = 0; i < qs.length; i++) {
      var s = lib.shown(L, qs[i].q), vs = variants(s.block, s.says);
      for (var k = 0; k < vs.length; k++) {
        var out; try { L.ai.lastReply = vs[k][1]; L.ai.lastFinish = "stop"; out = await L.aiAct.solve(qs[i].q, lib.seq([vs[k][1], s.block])); } catch (e) { out = { text: "THREW " + e }; }
        var gr = L.aiBench.grade(qs[i], out.text, out);
        if (!gr.pass) bad.push(qs[i].id + " (" + vs[k][0] + "): " + gr.why);
      }
    }
    return bad.join("; ");
  } });
cases.push({ id: "D-given-not-ideal", harm: "medium", input: "make-control's and make-control-b's givens beside their bench ideals", right: "the given is Lantern's for every question of its kind (rule 6): not the bench's ideal answer written in",
  run: function () {
    return lib.boot().then(function (x) {
      var bad = [];
      benchQs(x.N.L).filter(function (b) { return GIVEN_IDS.test(b.id); }).forEach(function (b) {
        var s = lib.shown(x.N.L, b.q);
        if (s.block && s.block.replace(/\s+/g, " ") === String(b.ideal).replace(/\s+/g, " ")) bad.push(b.id + "'s given is its ideal word for word");
      });
      return bad.join("; ");
    });
  } });
module.exports = cases;
