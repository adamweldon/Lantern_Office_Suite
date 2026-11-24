// gen_guard.js <1.24.35 inner html> -- writes guard_1235.json: a sha1 of every bench prompt (sets A and B) as 1.24.35
// (8cb3281) shows it. Made with: git show 8cb3281:src/lantern.inner.html > /tmp/x.html; node gen_guard.js /tmp/x.html
"use strict";
var path = require("path"), fs = require("fs"), crypto = require("crypto");
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var o = load(process.argv[2]);
setTimeout(function () {
  var L = o.L, h = {};
  (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).forEach(function (x) {
    var p; try { p = String(L.aiAct.prompt(x.q)); } catch (e) { p = "ERR " + e; }
    h[x.id] = crypto.createHash("sha1").update(p).digest("hex");
  });
  fs.writeFileSync(path.join(__dirname, "guard_1235.json"), JSON.stringify({ version: L.version, prompts: h }) + "\n");
  console.log("wrote " + Object.keys(h).length + " prompts of " + L.version);
}, 100);
