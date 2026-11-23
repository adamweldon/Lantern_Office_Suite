// replay.js -- the review of 1.24.35's float switches, its cases (cases_*.js) run against a lantern.inner.html (the
// draft, src/lantern.inner.html, by default) with 1.24.34 as released (git show 1e318a5) loaded beside it.
//   node tests/fixtures/float_review_1235/replay.js [path/to/lantern.inner.html] [--only <id regex>]
// Prints "AGREE <id>" or "DISAGREE <id> <why> [harm]" per case, then "<N> cases: <a> AGREE, <d> DISAGREE".
// A case says what is right (its own check, written from what the part or circuit is, not from what Lantern did);
// AGREE means Lantern did that. A case may leave a note (how many rows it read); it is printed after its id.
"use strict";
var path = require("path"), fs = require("fs");
var lib = require("./lib.js");
var args = process.argv.slice(2), only = null, file = null;
for (var i = 0; i < args.length; i++) { if (args[i] === "--only") only = new RegExp(args[++i]); else file = path.resolve(args[i]); }
var files = fs.readdirSync(__dirname).filter(function (f) { return /^cases_[a-z]\.js$/.test(f); }).sort();
(async function () {
  await lib.boot(file || undefined);
  var CASES = [];
  files.forEach(function (f) { CASES = CASES.concat(require(path.join(__dirname, f))); });
  if (only) CASES = CASES.filter(function (c) { return only.test(c.id); });
  var seen = {}, a = 0, d = 0, byHarm = {};
  for (var k = 0; k < CASES.length; k++) {
    var c = CASES[k], why;
    if (seen[c.id]) { console.log("DUPLICATE ID " + c.id); process.exit(2); }
    seen[c.id] = 1;
    try { why = await c.run(); } catch (e) { why = "the check threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e); }
    if (!why) { a++; console.log("AGREE " + c.id + (c.note ? "  (" + c.note + ")" : "")); }
    else { d++; byHarm[c.harm || "?"] = (byHarm[c.harm || "?"] || 0) + 1; console.log("DISAGREE " + c.id + " " + lib.short(why, 900) + " [" + (c.harm || "?") + "]"); }
  }
  if (d) console.log("disagreements by harm: " + Object.keys(byHarm).map(function (h) { return h + " " + byHarm[h]; }).join(", "));
  console.log(CASES.length + " cases: " + a + " AGREE, " + d + " DISAGREE");
  process.exit(0);
})();
