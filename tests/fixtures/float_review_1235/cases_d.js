// cases_d.js -- the guard: every bench question and every saved bench reply as on 1.24.34, except where the change is
// plainly right (said case by case below).
//  - the tools each bench question is offered (Lantern.aiBenchQuestions and aiBenchQuestionsB);
//  - every reply in tests/fixtures/bench_run_*.json (each row's first reply and its last) built for its question: ok,
//    readAs, the block's kind, the problems, the summary -- and, where a ladder is drawn, its circuit (rungs and each
//    contact's nc), which the change must leave alone (only the picture of a process switch changes);
//  - every row solved the bench's way (first reply, then the last for the correction) and graded by Lantern.aiBench.grade;
//  - each bench question's own ideal answer, built and graded;
//  - the ladder drawings of the saved replies: the only shapes that differ are process switches' (a float's, a pressure
//    or temperature switch's) and the label under one.
"use strict";
var lib = require("./lib.js"), fs = require("fs"), path = require("path");
var DIR = path.join(lib.ROOT, "tests", "fixtures");
function rowsOf(d) { if (Array.isArray(d)) return d; if (d.rows) return d.rows; return Object.keys(d).filter(function (k) { return k[0] !== "_"; }).map(function (k) { return Object.assign({ id: k }, d[k]); }); }
var ROWS = null;
function rows() {
  if (ROWS) return ROWS;
  var out = [], seen = {};
  fs.readdirSync(DIR).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    var rs = rowsOf(d);
    // the dict files keep their rows under other keys too ("run", "rows", "failed", "replies")
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
var cases = [];
["aiBenchQuestions", "aiBenchQuestionsB"].forEach(function (set) {
  cases.push({ id: "D-bench-tools-" + set, harm: "high", input: "every question of Lantern." + set, right: "each offered the tools 1.24.34 offered it",
    run: function () {
      return lib.boot().then(function (x) {
        var qs = x.N.L[set] || [], diff = [];
        function ids(L, q) { try { return L.aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); } catch (e) { return "THREW " + e; } }
        qs.forEach(function (b) { var a = ids(x.N.L, b.q), o = ids(x.O.L, b.q); if (a !== o) diff.push(b.id + ": " + a + " (1.24.34 " + o + ")"); });
        return qs.length < 100 ? "only " + qs.length + " questions" : diff.join("; ");
      });
    } });
});
cases.push({ id: "D-bench-saved-build", harm: "high", input: "every first and last reply in tests/fixtures/bench_run_*.json, built for its question",
  right: "built as 1.24.34 built it: ok, kind, readAs, problems, summary, and the ladder's circuit",
  run: function () {
    return lib.boot().then(function (x) {
      var bad = [], n = 0;
      rows().forEach(function (r) {
        [["first", r.first], ["last", r.last]].forEach(function (t) {
          if (t[0] === "last" && t[1] === r.first) return;
          n++;
          var a = sig(lib.build(x.N.L, t[1], r.q)), b = sig(lib.build(x.O.L, t[1], r.q));
          if (a !== b) bad.push(r.file + " " + r.id + " (" + t[0] + "): " + a.slice(0, 220) + " / 1.24.34 " + b.slice(0, 220));
        });
      });
      cases[2].note = n + " replies from " + rows().length + " rows";
      return n < 400 ? "only " + n + " replies read" : bad.join(" || ");
    });
  } });
cases.push({ id: "D-bench-saved-grade", harm: "high", input: "every saved row, solved as the bench does (the first reply, then the last) and graded",
  right: "each passes or fails as on 1.24.34",
  run: async function () {
    var x = await lib.boot(), bad = [], n = 0;
    function item(L, id) { return (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).filter(function (b) { return b.id === id; })[0]; }
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
      if (g[0] !== g[1]) bad.push(r.file + " " + r.id + ": " + g[0] + " / 1.24.34 " + g[1]);
    }
    cases[3].note = n + " rows graded";
    return n < 200 ? "only " + n + " rows graded" : bad.join("; ");
  } });
cases.push({ id: "D-bench-ideals", harm: "high", input: "each bench question's ideal answer (both sets), built and graded",
  right: "each ideal builds and grades as on 1.24.34 (and the lift station's and the control circuit's pass)",
  run: async function () {
    var x = await lib.boot(), bad = [];
    var qs = (x.N.L.aiBenchQuestions || []).concat(x.N.L.aiBenchQuestionsB || []).filter(function (b) { return typeof b.ideal === "string" && /MAKE\s/.test(b.ideal); });
    for (var i = 0; i < qs.length; i++) {
      var b = qs[i], g = [];
      for (var k = 0; k < 2; k++) {
        var L = k ? x.O.L : x.N.L, it = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).filter(function (y) { return y.id === b.id; })[0], out;
        try { out = await L.aiAct.solve(b.q, lib.seq([b.ideal])); } catch (e) { out = { text: "THREW " + e }; }
        var gr = null; try { gr = it ? L.aiBench.grade(it, out.text, out) : null; } catch (e) { gr = { pass: "THREW " + e }; }
        g.push(gr ? String(gr.pass) : "n/a");
      }
      if (g[0] !== g[1]) bad.push(b.id + ": " + g[0] + " / 1.24.34 " + g[1]);
      if (/^make-(liftstation|control)/.test(b.id) && g[0] !== "true") bad.push(b.id + "'s ideal does not pass: " + g[0]);
    }
    cases[4].note = qs.length + " ideals";
    return qs.length < 20 ? "only " + qs.length + " ideals" : bad.join("; ");
  } });
cases.push({ id: "D-bench-ladders-only-process-switches", harm: "medium", input: "every saved reply that draws a ladder (MAKE CONTROL, or a station's control view)",
  right: "the drawing differs from 1.24.34's only in its process switches (a blade, a stem, a float, a diaphragm, a bulb) and the label under one",
  run: function () {
    return lib.boot().then(function (x) {
      var bad = [], n = 0, changed = 0;
      rows().forEach(function (r) {
        [r.first, r.last].forEach(function (t, j) {
          if (j && t === r.first) return;
          var a = lib.build(x.N.L, t, r.q), b = lib.build(x.O.L, t, r.q);
          if (!lib.ctl(a) || !lib.ctl(b)) return;
          n++;
          var A = lib.flat(lib.ladderShapes(a)).map(function (s) { return JSON.stringify(s); }), B = lib.flat(lib.ladderShapes(b)).map(function (s) { return JSON.stringify(s); });
          var onlyA = A.filter(function (s) { return B.indexOf(s) < 0; }), onlyB = B.filter(function (s) { return A.indexOf(s) < 0; });
          if (onlyA.length || onlyB.length) changed++;
          // what may differ: lines and circles of a process switch (2-point paths, float circles) and 11 px label texts
          function ok(s) { var o = JSON.parse(s); return (o.t === "path" && o.pts.length === 2) || (o.t === "circle" && o.r === 6) || (o.t === "text" && o.fs === 11); }
          var odd = onlyA.concat(onlyB).filter(function (s) { return !ok(s); });
          if (odd.length) bad.push(r.file + " " + r.id + ": " + odd.slice(0, 2).join(" "));
        });
      });
      cases[5].note = n + " ladders, " + changed + " drawn differently";
      return n < 5 ? "only " + n + " ladders found (" + changed + " changed)" : bad.join(" || ");
    });
  } });
module.exports = cases;
