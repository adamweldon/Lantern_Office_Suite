// replay_makesheet.js -- the third reviewer's MAKE SHEET cases (rule C), replayed in jsdom on src/lantern.inner.html
// through Lantern.aiAct.build(reply, question), as tests/bench_1268.js drives it. Prints AGREE <id> / DISAGREE <id>
// <detail> [harm] per case, then the count.
// Usage: node tests/fixtures/round3_1269/replay_makesheet.js [inner.html]
"use strict";
var load = require("./load.js").load, K = require("./makesheet_cases.js");
var agree = 0, dis = 0, out = [];
function say(ok, id, detail, harm) {
  if (ok) { agree++; out.push("AGREE " + id); }
  else { dis++; out.push("DISAGREE " + id + " " + detail + (harm ? " [" + harm + "]" : "")); }
}
function same(a, b) { return typeof b === "number" ? typeof a === "number" && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) : a === b; }
load(function (o) {
  var L = o.L;
  K.cases.forEach(function (c) {
    var r;
    try { r = L.aiAct.build(c.reply, c.q || "Make a table: " + (/MAKE SHEET: (.*)/.exec(c.reply) || [])[1]); } catch (e) { say(false, c.id, "build threw " + e.message, "no sheet"); return; }
    var probs = (r && r.problems) || [], plan = (r && r.plan) || { cells: {}, values: {} }, bad = [], harm = null;
    if (c.ok && probs.length) { bad.push("sent back: " + JSON.stringify(probs).slice(0, 400)); harm = "a right sheet sent back"; }
    if (c.back) {
      var hit = probs.some(function (p) { return c.back.every(function (s) { return p.toLowerCase().indexOf(s.toLowerCase()) >= 0; }); });
      if (!hit) { bad.push("want one problem with " + JSON.stringify(c.back) + ", got " + JSON.stringify(probs).slice(0, 400)); harm = probs.length ? "the wrong line handed over" : "a slip passed as right"; }
    }
    (c.notBack ? [c.notBack] : []).forEach(function (nb) {
      var p = probs.filter(function (q) { return nb.every(function (s) { return q.indexOf(s) >= 0; }); })[0];
      if (p) { bad.push("hands over " + JSON.stringify(nb) + ": " + p.slice(0, 250)); harm = "a wrong line handed to the model to copy"; }
    });
    Object.keys(c.values || {}).forEach(function (k) {
      var v = plan.values[k];
      if (!same(v, c.values[k])) { bad.push(k + " is " + JSON.stringify(v) + " (" + JSON.stringify(plan.cells[k]) + "), want " + JSON.stringify(c.values[k])); harm = harm || "a wrong number in the sheet, unsaid"; }
    });
    Object.keys(c.cells || {}).forEach(function (k) {
      var v = plan.cells[k] == null ? null : plan.cells[k];
      if (v !== c.cells[k]) { bad.push(k + " holds " + JSON.stringify(v) + ", want " + JSON.stringify(c.cells[k])); harm = harm || "what the model wrote changed"; }
    });
    say(!bad.length, c.id, "(" + c.kind + ") " + bad.join("; "), harm);
  });
  out.forEach(function (l) { console.log(l); });
  if (o.errs.length) console.log("page errors: " + o.errs.join(" | "));
  console.log((agree + dis) + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
}, process.argv[2]);
