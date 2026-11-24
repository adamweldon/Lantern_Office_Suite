// harvest.js -- every saved reply in tests/fixtures/bench_run*.json that holds a MAKE block, with its question.
// Each entry: {key, file, id, field, q, text}. Duplicates (the same question and the same text) are kept once.
"use strict";
var fs = require("fs"), path = require("path");
module.exports = function harvest() {
  var dir = path.join(__dirname, ".."), out = [], seen = {};
  fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
    (function walk(x, idHint) {
      if (Array.isArray(x)) { x.forEach(function (y) { walk(y, idHint); }); return; }
      if (!x || typeof x !== "object") return;
      var q = typeof x.q === "string" ? x.q : typeof x.question === "string" ? x.question : null;
      if (q) {
        Object.keys(x).forEach(function (k) {
          var v = x[k];
          if (typeof v !== "string" || k === "q" || k === "question") return;
          if (!/MAKE\s+[A-Z]/.test(v)) return;
          var sig = q + "\u0000" + v;
          if (seen[sig]) return;
          seen[sig] = 1;
          out.push({ key: f.replace(/\.json$/, "") + "/" + (x.id || idHint || "?") + "/" + k, file: f, id: x.id || idHint || "", field: k, q: q, text: v });
        });
      }
      Object.keys(x).forEach(function (k) { if (x[k] && typeof x[k] === "object") walk(x[k], x.id || (typeof k === "string" && /^[a-z]/.test(k) ? k : idHint)); });
    })(d, "");
  });
  // keys made unique
  var n = {};
  out.forEach(function (e) { n[e.key] = (n[e.key] || 0) + 1; if (n[e.key] > 1) e.key += "#" + n[e.key]; });
  return out;
};
