// replay.js -- the third review's cases of 1.24.34's lift station change, run against the draft (src/lantern.inner.html, or
// argv[2]) with 1.24.33 (0dfc9d8) loaded beside it. Prints "AGREE <id>" or "DISAGREE <id> <why> [harm]" per case, then
// "<N> cases: <a> AGREE, <d> DISAGREE". AGREE: Lantern does what is right for that input. Optional argv[3]: a regex of ids.
"use strict";
var path = require("path"), fs = require("fs");
var lib = require("./lib.js");
var only = process.argv[3] ? new RegExp(process.argv[3]) : null;
var files = fs.readdirSync(__dirname).filter(function (f) { return /^cases_[a-z]+\.js$/.test(f); }).sort();
(async function () {
  var x = await lib.boot(process.argv[2]);
  var cases = [];
  files.forEach(function (f) { cases = cases.concat(require(path.join(__dirname, f))); });
  var seen = {}, a = 0, d = 0;
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    if (seen[c.id]) { console.log("DUPLICATE ID " + c.id); process.exit(2); }
    seen[c.id] = 1;
    if (only && !only.test(c.id)) continue;
    var why;
    try { why = await c.run(x); } catch (e) { why = "THREW " + (e && e.stack || e); }
    if (!why) { a++; console.log("AGREE " + c.id); }
    else { d++; console.log("DISAGREE " + c.id + " " + String(why).replace(/\s+/g, " ").slice(0, 1200) + " [" + c.harm + "]"); }
  }
  if (x.N.errs.length || x.O.errs.length) console.log("page errors: " + JSON.stringify(x.N.errs.concat(x.O.errs)).slice(0, 400));
  console.log((a + d) + " cases: " + a + " AGREE, " + d + " DISAGREE");
  process.exit(0);
})();
