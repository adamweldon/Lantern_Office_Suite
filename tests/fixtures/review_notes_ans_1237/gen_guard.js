// gen_guard.js [inner html] -- writes guard_50f9ceb.json from 50f9ceb's page (before_50f9ceb.inner.html here, made with
// git show 50f9ceb:src/lantern.inner.html > before_50f9ceb.inner.html):
//  - builds: every saved reply with a MAKE block in tests/fixtures/bench_run*.json, with its question, built by
//    L.aiAct.build -- ok, problems and the notes as drawn (plan.notes), and a sha1 of the whole plan;
//  - prompts: a sha1 of each bench question's prompt (sets A and B): aiAct.prompt(q), and CHAT.buildSystem(q) in the
//    full and the short mode.
// replay.js compares the page it loads with this file.
"use strict";
var path = require("path"), fs = require("fs"), crypto = require("crypto");
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var file = process.argv[2] || path.join(__dirname, "before_50f9ceb.inner.html");
var lib = require("./lib.js");
var o = load(file);
setTimeout(function () {
  var L = o.L;
  var pairs = lib.savedReplies(path.join(__dirname, ".."));
  var builds = pairs.map(function (p) { return lib.buildDigest(L, p.text, p.q, p.file); });
  var prompts = lib.promptDigests(L);
  fs.writeFileSync(path.join(__dirname, "guard_50f9ceb.json"), JSON.stringify({ version: L.version, from: "50f9ceb", builds: builds, prompts: prompts }, null, 0) + "\n");
  console.log("wrote " + builds.length + " builds and " + Object.keys(prompts).length + " prompts of " + L.version);
}, 120);
