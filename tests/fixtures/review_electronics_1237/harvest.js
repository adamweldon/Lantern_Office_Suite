// harvest.js -- every saved reply in tests/fixtures/bench_run*.json that holds a MAKE block, with its question.
// Each entry: {key, file, id, field, q, text}. Duplicates (the same question and the same text) are kept once.
"use strict";
var fs = require("fs"), path = require("path");
// (1.24.39) Only the files this review was last replayed with (files_1238.json, the bench_run files at 1.24.38's release):
// a reply saved later, the same as an older one, would otherwise be found under the later file's name first.
module.exports = function harvest() {
  var dir = path.join(__dirname, ".."), out = [], seen = {}, known = null;
  try { known = JSON.parse(fs.readFileSync(path.join(__dirname, "files_1238.json"), "utf8")); } catch (e) { known = null; }
  fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f) && (!known || known.indexOf(f) >= 0); }).sort().forEach(function (f) {
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
