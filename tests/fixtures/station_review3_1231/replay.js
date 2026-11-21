// replay.js -- the third review of 1.24.31's MAKE STATION: every case, judged.
// node tests/fixtures/station_review3_1231/replay.js [id-prefix]
// prints AGREE <id> or DISAGREE <id> <what Lantern did> [harm] per case, and last: <n> cases: <a> AGREE, <d> DISAGREE
// (LANTERN_SRC=<file> replays against another source; 1.24.30 is always git show ad0d654)
"use strict";
var only = process.argv[2] || "";
var files = ["cases_a.js", "cases_b.js", "cases_c.js", "cases_d.js", "cases_e.js", "cases_f.js"];
var all = [];
files.forEach(function (f) { try { require.resolve("./" + f); } catch (e) { return; } require("./" + f).forEach(function (c) { if (!only || c.id.indexOf(only) === 0) all.push(c); }); });
var seen = {};
all.forEach(function (c) { if (seen[c.id]) throw new Error("two cases called " + c.id); seen[c.id] = 1; });
var agree = 0, dis = 0, byHarm = {};
function one(i) {
  if (i >= all.length) {
    console.log("disagreements by harm: " + Object.keys(byHarm).map(function (k) { return k + " " + byHarm[k]; }).join(", "));
    console.log(all.length + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
    process.exit(0);
  }
  var c = all[i], p;
  try { p = Promise.resolve(c.run()); } catch (e) { p = Promise.resolve("threw: " + (e && e.stack || e)); }
  p.then(function (r) { return r; }, function (e) { return "threw: " + (e && e.stack || e); }).then(function (r) {
    if (!r) { agree++; console.log("AGREE " + c.id); }
    else { dis++; byHarm[c.harm] = (byHarm[c.harm] || 0) + 1; console.log("DISAGREE " + c.id + " " + String(r).replace(/\s+/g, " ").slice(0, 700) + " [" + c.harm + "]"); }
    one(i + 1);
  });
}
one(0);
