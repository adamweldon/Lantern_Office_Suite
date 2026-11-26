// lib.js -- shared by gen_guard.js and replay.js
"use strict";
var fs = require("fs"), path = require("path"), crypto = require("crypto");
function sha(s) { return crypto.createHash("sha1").update(String(s)).digest("hex"); }
// every saved reply with a MAKE block, with its question, from tests/fixtures/bench_run*.json (in file order, no repeats)
function savedReplies(dir) {
  var files = fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort(), seen = {}, out = [];
  files.forEach(function (f) {
    var d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    (function walk(x) {
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (!x || typeof x !== "object") return;
      if (typeof x.q === "string") Object.keys(x).forEach(function (k) {
        var v = x[k];
        if (typeof v === "string" && /MAKE\s+[A-Z]/.test(v)) {
          var key = sha(x.q + "\u0000" + v);
          if (!seen[key]) { seen[key] = 1; out.push({ file: f, field: k, q: x.q, text: v }); }
        }
      });
      Object.keys(x).forEach(function (k) { if (x[k] && typeof x[k] === "object") walk(x[k]); });
    })(d);
  });
  return out;
}
function buildDigest(L, text, q, file) {
  var m = null, err = null;
  try { m = L.aiAct.build(text, q); } catch (e) { err = String(e && e.message || e); }
  var d = { key: sha(q + "\u0000" + text), file: file || "" };
  if (err) { d.err = err; return d; }
  if (!m) { d.none = true; return d; }
  d.ok = !!m.ok;
  d.problems = (m.problems || []).map(String);
  d.notes = m.plan && m.plan.notes ? m.plan.notes.slice() : null;
  d.plan = sha(JSON.stringify(m.plan || null));
  return d;
}
function promptDigests(L) {
  var out = {}, Q = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []), P = L.aiPrompt, was = P && P.mode ? P.mode() : null;
  Q.forEach(function (x) {
    var a, b, c;
    try { a = String(L.aiAct.prompt(x.q)); } catch (e) { a = "ERR " + e; }
    try { P.setMode("full"); b = String(L.CHAT.buildSystem(x.q)); } catch (e) { b = "ERR " + e; }
    try { P.setMode("short"); c = String(L.CHAT.buildSystem(x.q)); } catch (e) { c = "ERR " + e; }
    out[x.id] = sha(a) + " " + sha(b) + " " + sha(c);
  });
  try { if (was) P.setMode(was); } catch (e) { /* as it was */ }
  return out;
}
// freezeDate(window, y, m, d): the page's today fixed (noon that day), so a reply that says "today" or "one week from
// today" is read as on the day a guard was made, whatever day the test runs (1.24.39)
function freezeDate(W, y, m, d) {
  var RD = W.Date, T = new RD(y, m, d, 12, 0, 0).getTime();
  function D() { if (!(this instanceof D)) return new RD(T).toString(); var a = [null].concat([].slice.call(arguments)); return arguments.length ? new (Function.prototype.bind.apply(RD, a))() : new RD(T); }
  D.prototype = RD.prototype; D.now = function () { return T; }; D.UTC = RD.UTC; D.parse = RD.parse;
  W.Date = D;
}
module.exports = { sha: sha, savedReplies: savedReplies, buildDigest: buildDigest, promptDigests: promptDigests, freezeDate: freezeDate };
