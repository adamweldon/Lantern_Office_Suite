// make_grammar.js -- runs E's grammar samples through llama.cpp's own parser (tools/gbnf_check.py) and keeps what it
// said in grammar_results.json, so replay.js can judge them where there is no llama.cpp. Needs LLAMA_LIB (a release's
// libllama.so; b11435 was used) and LLAMA_VOCAB (llama.cpp's models/ggml-vocab-qwen2.gguf), or the defaults in cases_e.js.
// Run from anywhere: node tests/fixtures/station_review1_1231/make_grammar.js
"use strict";
var fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
var H = require("./lib.js"), E = require("./cases_e.js");
var LIB = process.env.LLAMA_LIB || "/tmp/llama/llama-b11435/libllama.so";
var VOCAB = process.env.LLAMA_VOCAB || "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad/vocab/ggml-vocab-qwen2.gguf";
if (!fs.existsSync(LIB) || !fs.existsSync(VOCAB)) { console.log("no llama.cpp here (LLAMA_LIB, LLAMA_VOCAB)"); process.exit(1); }
var gc = E.grammarCases(), dir = fs.mkdtempSync(path.join(os.tmpdir(), "gbnf-")), cj = path.join(dir, "cases.json"), oj = path.join(dir, "out.json");
fs.writeFileSync(cj, JSON.stringify(gc));
var p = cp.spawnSync("python3", [path.join(H.ROOT, "tools/gbnf_check.py"), "--lib", LIB, "--vocab", VOCAB, cj, "--out", oj], { encoding: "utf8" });
process.stdout.write(p.stdout || "");
var out = JSON.parse(fs.readFileSync(oj, "utf8"));
out.forEach(function (r) { var g = gc.filter(function (c) { return c.name === r.name; })[0]; r.grammar = g.grammar; r.samples.forEach(function (s, i) { s.id = g.samples[i].id; }); });
fs.writeFileSync(E.STORED, JSON.stringify({ lantern: H.L().version, llama: path.basename(path.dirname(LIB)), vocab: path.basename(VOCAB), results: out }, null, 1) + "\n");
console.log("wrote " + E.STORED);
