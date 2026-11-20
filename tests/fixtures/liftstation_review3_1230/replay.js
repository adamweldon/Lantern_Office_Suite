// replay.js -- the third review of 1.24.30's lift station: every case, judged.
// node tests/fixtures/liftstation_review3_1230/replay.js [id-prefix]
// prints AGREE <id> or DISAGREE <id> <what Lantern did> [harm] per case, and last: <n> cases: <a> AGREE, <d> DISAGREE
"use strict";
var only = process.argv[2] || "";
var files = ["cases_a.js", "cases_b.js", "cases_c.js", "cases_d.js", "cases_f.js"];
var all = [];
files.forEach(function (f) { require("./" + f).forEach(function (c) { if (!only || c.id.indexOf(only) === 0) all.push(c); }); });
var seen = {};
all.forEach(function (c) { if (seen[c.id]) throw new Error("two cases called " + c.id); seen[c.id] = 1; });
var agree = 0, dis = 0;
function one(i) {
  if (i >= all.length) { console.log(all.length + " cases: " + agree + " AGREE, " + dis + " DISAGREE"); return; }
  var c = all[i];
  var p;
  try { p = Promise.resolve(c.run()); } catch (e) { p = Promise.resolve("threw: " + (e && e.stack || e)); }
  p.then(function (r) { return r; }, function (e) { return "threw: " + (e && e.stack || e); }).then(function (r) {
    if (!r) { agree++; console.log("AGREE " + c.id); }
    else { dis++; console.log("DISAGREE " + c.id + " " + String(r).replace(/\s+/g, " ").slice(0, 700) + " [" + c.harm + "]"); }
    one(i + 1);
  });
}
one(0);
