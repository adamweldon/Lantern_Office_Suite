// make_before.js -- 22b1c03's results for the "same" and "prompt" cases of cases.js, written to before.json:
//   git show 22b1c03:src/lantern.inner.html > /some/where/before.html
//   node tests/fixtures/review_electronics_1237/make_before.js /some/where/before.html
// (guard_before.json is guard.js run on the same file.)
"use strict";
var path = require("path"), fs = require("fs");
module.paths.unshift(path.join(__dirname, "..", "..", "..", "node_modules"));
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js")), CASES = require("./cases.js");
var file = path.resolve(process.argv[2]);
function text(c) { return "MAKE " + (c.kind || "ELECTRONICS") + ": " + (c.title || "Circuit") + "\n" + c.lines.join("\n") + "\nEND"; }
function sig(m) { var c = m && m.plan && m.plan.circuit; return { ok: !!(m && m.ok), problems: m ? (m.problems || []).slice() : null, branches: c && c.branches ? JSON.stringify(c.branches) : null, summary: m && m.summary ? String(m.summary) : "" }; }
var o = load(file), L = o.L;
setTimeout(function () {
  var act = L.aiAct, out = { from: "22b1c03", cases: {}, prompts: { q: {}, all: {}, guide: { PROMPT: L.aiElectronics.PROMPT, HINT: L.aiElectronics.HINT } } };
  CASES.forEach(function (c) {
    if (c.t === "same") out.cases[c.id] = sig(act.build(text(c), c.q));
    if (c.t === "prompt" && c.q) out.prompts.q[c.id] = { prompt: act.prompt(c.q), relevant: act.relevant(c.q).map(function (a) { return a.id; }).join(",") };
  });
  (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).forEach(function (it) {
    var q = it.q || "";
    out.prompts.all[it.id] = { prompt: act.prompt(q), relevant: act.relevant(q).map(function (a) { return a.id; }).join(",") };
  });
  fs.writeFileSync(path.join(__dirname, "before.json"), JSON.stringify(out, null, 1) + "\n");
  console.log("before.json: " + Object.keys(out.cases).length + " cases, " + Object.keys(out.prompts.all).length + " bench prompts");
}, 80);
