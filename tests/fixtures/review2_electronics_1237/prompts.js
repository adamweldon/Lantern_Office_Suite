// prompts.js <a> <b> [<c> ...] -- every bench question's prompts (sets A and B; the full prompt, the short one, and the
// MAKE action's own) built by each version of src/lantern.inner.html, and whether they are all the same.
"use strict";
var path = require("path"), load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
function prompts(file, cb) {
  var o = load(file);
  setTimeout(function () {
    var L = o.L, A = L.assist, out = {}, qs = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []);
    ["full", "short"].forEach(function (m) {
      L.aiPrompt.setMode(m);
      qs.forEach(function (q) { try { out[m + "|" + q.id] = A.buildPrompt(q.q, A.match(q.q)); } catch (e) { out[m + "|" + q.id] = "THROW " + e.message; } });
    });
    qs.forEach(function (q) { try { out["act|" + q.id] = String(L.aiAct.prompt(q.q) || ""); } catch (e) { out["act|" + q.id] = "THROW"; } });
    cb(out, qs.length);
  }, 80);
}
var files = process.argv.slice(2), got = [];
(function next(i) {
  if (i === files.length) {
    var keys = Object.keys(got[0].p), diff = keys.filter(function (k) { return got.some(function (g) { return g.p[k] !== got[0].p[k]; }); });
    console.log(got[0].n + " questions, " + keys.length + " prompts in each of " + files.length + " versions: " + (diff.length ? diff.length + " differ: " + diff.join(", ") : "all the same"));
    return;
  }
  prompts(files[i], function (p, n) { got.push({ p: p, n: n }); next(i + 1); });
})(0);
