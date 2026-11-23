// replay.js -- the second review of 1.24.34's cases, run against a lantern.inner.html (the draft by default) beside 1.24.33.
//   node tests/fixtures/liftstation_review2_1234/replay.js [path/to/lantern.inner.html] [--only <id regex>]
// Prints "AGREE <id>" or "DISAGREE <id> <why> [harm]" per case, then "<N> cases: <a> AGREE, <d> DISAGREE".
// A case says what is right (its own check, written before Lantern was run on it); AGREE means Lantern did that.
"use strict";
var path = require("path"), fs = require("fs");
var lib = require("./lib.js");
var args = process.argv.slice(2), only = null, file = null;
for (var i = 0; i < args.length; i++) { if (args[i] === "--only") only = new RegExp(args[++i]); else file = path.resolve(args[i]); }
var files = fs.readdirSync(__dirname).filter(function (f) { return /^cases_[a-z]\.js$/.test(f); }).sort();
(async function () {
  await lib.init(file || undefined);
  var CASES = [];
  files.forEach(function (f) { CASES = CASES.concat(require(path.join(__dirname, f))); });
  if (only) CASES = CASES.filter(function (c) { return only.test(c.id); });
  var seen = {}, a = 0, d = 0;
  for (var k = 0; k < CASES.length; k++) {
    var c = CASES[k], why;
    if (seen[c.id]) { console.log("DUPLICATE ID " + c.id); process.exit(2); }
    seen[c.id] = 1;
    try { why = await c.run(); } catch (e) { why = "the check threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e); }
    if (!why) { a++; console.log("AGREE " + c.id); }
    else { d++; console.log("DISAGREE " + c.id + " " + lib.short(why, 900) + " [" + (c.harm || "?") + "]"); }
  }
  console.log(CASES.length + " cases: " + a + " AGREE, " + d + " DISAGREE");
  process.exit(0);
})();
