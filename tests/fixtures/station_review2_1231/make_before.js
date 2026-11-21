// make_before.js -- writes before.json: what 1.24.30 (commit ad0d654) did with this review's inputs, for the cases that
// say "as 1.24.30": the tools each routing question and bench question was offered (rel:), how it was split (split:),
// and each control block's circuit (ctl:<case id>).
//   node tests/fixtures/station_review2_1231/make_before.js
"use strict";
var cp = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
var ROOT = path.resolve(__dirname, "../../..");
var OLD = path.join(os.tmpdir(), "lantern_1230_" + process.pid + ".html");
fs.writeFileSync(OLD, cp.execSync("git -C " + JSON.stringify(ROOT) + " show ad0d654:src/lantern.inner.html", { maxBuffer: 1 << 28 }));
process.env.LANTERN_SRC = OLD;
var H = require("./lib.js");
var out = {};
H.boot().then(function () {
  var L = H.L();
  function rel(q) { return L.aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
  function split(q) { var p = L.aiParts.split(q); return p ? p.map(function (x) { return x.kind; }).join("+") : null; }
  var qs = [];
  require("./cases_b.js").forEach(function (c) { if (c.input && /^[A-Z]/i.test(c.input.question) && !/^every|^the two/.test(c.input.question)) qs.push(c.input.question); });
  (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).forEach(function (it) { qs.push(it.q); });
  qs.forEach(function (q) { out["rel:" + q] = rel(q); out["split:" + q] = split(q); });
  require("./cases_d.js").forEach(function (c) { out["ctl:" + c.id] = H.sig(L.aiAct.build(c.input.block, c.input.question)); });
  fs.writeFileSync(path.join(__dirname, "before.json"), JSON.stringify(out, null, 1));
  fs.unlinkSync(OLD);
  console.log("before.json: " + Object.keys(out).length + " entries from 1.24.30 (ad0d654)");
  process.exit(0);
});
