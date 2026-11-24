// cases_guard.js -- a guard: every saved model reply with a MAKE CONTROL block in the bench runs
// (tests/fixtures/bench_run*.json) and Adam's lift-station run (liftstation_1230/run_35b.json), with the question it
// answered, is built by the page and by 1.24.35. What the new rules may change ("stop ... all", a fill on two nc
// floats, a cut-out sent back) must be right where they change it; elsewhere the drawing is 1.24.35's. Read at run
// time; one case per reply (a reply saved twice is taken once).
"use strict";
var fs = require("fs"), path = require("path");
var DIR = path.resolve(__dirname, "..");
var files = fs.readdirSync(DIR).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().concat(["liftstation_1230/run_35b.json"]);
var out = [], seen = {};
function walk(o, q, f, where) {
  if (Array.isArray(o)) { o.forEach(function (v, i) { take(v, q, f, where + "." + i); }); return; }
  if (!o || typeof o !== "object") return;
  var q2 = typeof o.q === "string" ? o.q : typeof o.question === "string" ? o.question : q, tag = o.id ? where + "." + o.id : where;
  Object.keys(o).forEach(function (k) { take(o[k], q2, f, tag + "." + k); });
}
function take(v, q, f, where) {
  if (typeof v === "string") {
    if (!/MAKE\s+CONTROL/i.test(v) || !q || seen[q + "\u0000" + v]) return;
    seen[q + "\u0000" + v] = 1;
    var id = "G-" + f.replace(/^bench_run_?|\.json$|\/run_35b/g, "").replace(/[^\w.]+/g, "_") + where.replace(/^\./, "-").replace(/[^\w.-]+/g, "_");
    out.push({ id: id, harm: "high", why: "a saved reply (" + f + where + "): drawn as 1.24.35 drew it, or changed only by a rule that is right for it",
      run: function (x) {
        var a = x.shape(x.build(v, q)), b = x.shape(x.buildOld(v, q));
        return a === b ? "" : "differs from 1.24.35:\n      now  " + a + "\n      was  " + b;
      } });
    return;
  }
  walk(v, q, f, where);
}
files.forEach(function (f) {
  var d; try { d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch (e) { return; }
  take(d, null, f, "");
});
module.exports = out;
