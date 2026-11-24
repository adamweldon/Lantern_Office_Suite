// node tests/fixtures/review7_1236/gen_guard.js <1.24.35's lantern.inner.html>
// (git show 8cb3281:src/lantern.inner.html > /some/tmp/1235.html) -- writes guard_1235.json beside it: a hash of every
// bench prompt (L.aiBenchQuestions and L.aiBenchQuestionsB via L.aiAct.prompt) and of how every saved reply with a
// MAKE block in tests/fixtures/bench_run_*.json builds, on 1.24.35. replay.js compares the file it runs on with them.
"use strict";
var path = require("path"), fs = require("fs"), crypto = require("crypto");
var ROOT = path.join(__dirname, "..", "..", "..");
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
if (!process.argv[2]) { console.log("give 1.24.35's lantern.inner.html"); process.exit(1); }
var L = load(process.argv[2]).L;
function h(s) { return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 16); }
setTimeout(function () {
  var out = { from: "8cb3281 (1.24.35)", prompts: {}, builds: {} };
  [["A", L.aiBenchQuestions], ["B", L.aiBenchQuestionsB]].forEach(function (pp) { (pp[1] || []).forEach(function (x) { out.prompts[pp[0] + ":" + x.id] = h(L.aiAct.prompt(x.q)); }); });
  var FX = path.join(ROOT, "tests", "fixtures");
  fs.readdirSync(FX).filter(function (f) { return /^bench_run_.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d = JSON.parse(fs.readFileSync(path.join(FX, f), "utf8")), rows = Array.isArray(d) ? d : (d.rows || d.failed || []);
    if (!Array.isArray(rows)) return;
    rows.forEach(function (r, i) {
      if (!r || typeof r !== "object" || !r.q) return;
      Object.keys(r).forEach(function (kk) {
        var v = r[kk];
        if (typeof v !== "string" || !/MAKE\s+[A-Z]/.test(v)) return;
        var bb = null;
        try { bb = L.aiAct.build(v, r.q); } catch (e) { bb = { err: String(e).slice(0, 100) }; }
        var dg = bb ? { ok: !!bb.ok, problems: (bb.problems || []).join(" || ").slice(0, 600), summary: String(bb.summary || "").slice(0, 600), err: bb.err || "" } : null;
        out.builds[f + "#" + i + "." + kk] = { q: r.q.slice(0, 80), h: h(JSON.stringify(dg)) };
      });
    });
  });
  fs.writeFileSync(path.join(__dirname, "guard_1235.json"), JSON.stringify(out));
  console.log(Object.keys(out.prompts).length + " prompts, " + Object.keys(out.builds).length + " builds");
  process.exit(0);
}, 120);
