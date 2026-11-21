// make_grammar.js -- writes grammar_cases.json for tools/gbnf_check.py: this review's samples (grammar_samples.js), each
// held to the grammar Lantern sends for its kind (AI_ACTIONS' grammarFor), and every kind of every action Lantern has, each
// with a one-line block it must let through (the grammar must parse, and an empty block of the kind must pass).
//   node tests/fixtures/station_review2_1231/make_grammar.js
//   python3 tools/gbnf_check.py --lib <llama.cpp b11435>/libllama.so --vocab ggml-vocab-qwen2.gguf \
//     tests/fixtures/station_review2_1231/grammar_cases.json --out tests/fixtures/station_review2_1231/grammar_results.json
"use strict";
var fs = require("fs"), path = require("path"), H = require("./lib.js");
H.boot().then(function () {
  var L = H.L(), G = L.aiAct.grammarFor, cases = [], byKind = {};
  require("./grammar_samples.js")(L).forEach(function (s) {
    if (!byKind[s.kind]) { byKind[s.kind] = { name: s.kind, grammar: G(s.kind), samples: [] }; cases.push(byKind[s.kind]); }
    byKind[s.kind].samples.push({ text: s.text, want: s.want, id: s.id });
  });
  var kinds = [];
  (L.aiActions || []).forEach(function (a) { (a.kinds || [a.kind]).forEach(function (k) { if (kinds.indexOf(k) < 0) kinds.push(k); }); });
  kinds.forEach(function (k) { if (byKind[k]) return; var g = G(k); if (g) cases.push({ name: "kind " + k, grammar: g, samples: [{ text: "MAKE " + k + ": Title\nEND", want: true, id: "kind:" + k }] }); });
  fs.writeFileSync(path.join(__dirname, "grammar_cases.json"), JSON.stringify(cases, null, 1));
  console.log("grammar_cases.json: " + cases.length + " grammars, " + cases.reduce(function (n, c) { return n + c.samples.length; }, 0) + " samples");
  process.exit(0);
});
