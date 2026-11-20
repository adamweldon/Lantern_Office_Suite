#!/usr/bin/env node
// replay.js -- the second review of 1.24.30's lift station (AI_CONTROL's alternating relay, AI_PUMP_STATION's piping and
// float levels, AI_PARTS' questions in parts), replayed.
// Usage: node tests/fixtures/liftstation_review2_1230/replay.js [path/to/lantern.inner.html] [--only <id prefix>]
// Prints "AGREE <id>" or "DISAGREE <id> <what Lantern did> [harm]" for each case, then "<n> cases: <a> AGREE, <d> DISAGREE".
// The browser's drawings are in replay_browser.py (the same format).
"use strict";
var path = require("path");
var HERE = __dirname, ROOT = path.join(HERE, "..", "..", "..");
var args = process.argv.slice(2), only = null, file = path.join(ROOT, "src", "lantern.inner.html");
for (var i = 0; i < args.length; i++) { if (args[i] === "--only") only = args[++i]; else file = path.resolve(args[i]); }
var load = require("./load.js"), lib = require("./lib.js");
var o = load(file), H = lib.helpers(o);
var CASES = [].concat(require("./cases_control.js"), require("./cases_plain.js"), require("./cases_station.js"), require("./cases_parts.js"));
if (only) CASES = CASES.filter(function (c) { return c.id.indexOf(only) === 0; });
var seen = {};
CASES.forEach(function (c) { if (seen[c.id]) throw new Error("two cases called " + c.id); seen[c.id] = 1; });
var agree = 0, disagree = 0;
function one(c) {
  var r;
  try { r = c.run(H); } catch (e) { r = "the case threw: " + ((e && e.message) || e); }
  return Promise.resolve(r).then(null, function (e) { return "the case threw: " + ((e && e.message) || e); }).then(function (w) {
    if (!w) { agree++; console.log("AGREE " + c.id); }
    else { disagree++; console.log("DISAGREE " + c.id + " " + String(w).replace(/\s+/g, " ").slice(0, 600) + " [" + (c.harm || "medium") + "]"); }
  });
}
var p = Promise.resolve();
CASES.forEach(function (c) { p = p.then(function () { return one(c); }); });
p.then(function () {
  console.log(CASES.length + " cases: " + agree + " AGREE, " + disagree + " DISAGREE");
  if (o.errs.length) console.error("(page errors: " + o.errs.slice(0, 3).join(" | ") + ")");
  process.exit(0);
});
