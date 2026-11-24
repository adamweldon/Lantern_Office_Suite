// run_circuits.js -- judges the circuit cases (cases_circuits.js) against a loaded Lantern. Returns [{id, agree, seen, harm}].
"use strict";
var lib = require("./lib.js");
function lineIndex(lines, id) {
  // the device's own line: its role word first, its ID the first tag on it (not a coil line naming it)
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].replace(/^\s*\d{1,2}[.)]\s+/, "");
    if (/^\s*coil\b/i.test(l)) continue;
    if (new RegExp("(^|\\s)" + id + "(\\s|$)").test(l)) return i;
  }
  return -1;
}
function checkNc(r, want) {
  var bad = [];
  Object.keys(want || {}).forEach(function (id) {
    var d = lib.drawn(r, id);
    if (!d.length) { bad.push(id + " not drawn"); return; }
    d.forEach(function (x) { if (x.nc !== want[id]) bad.push(id + " drawn " + (x.nc ? "nc" : "no") + " in " + x.out); });
  });
  return bad;
}
function judge(L, c) {
  lib.setPractice(L, c.saved || "");
  var r = lib.build(L, c.lines, c.q), cb = lib.ccBacks(r), other = lib.otherProblems(r);
  if (c.expect === "pass") {
    if (cb.length) return { agree: false, seen: "sent back: " + lib.short(cb.join(" | "), 400) };
    if (other.length) return { agree: false, seen: "CASE DID NOT BUILD: " + lib.short(other.join(" | "), 300), harm: "low" };
    var bad = checkNc(r, c.nc);
    if (bad.length) return { agree: false, seen: "drawn otherwise: " + bad.join(", ") };
    if (c.kept) {
      var ln = r.codes && L.codeChecks ? L.codeChecks.line(r.codes, r.codes.practice) : "";
      var miss = c.kept.filter(function (k) { return ln.indexOf(k) < 0; });
      if (miss.length) return { agree: false, seen: "kept line lacks " + JSON.stringify(miss) + ": " + lib.short(ln, 300), harm: "low" };
    }
    return { agree: true };
  }
  // back
  var want = c.dev || [];
  var got = cb.map(function (p) { return (/^(\S+)/.exec(p) || [])[1]; });
  if (!cb.length) {
    var ln2 = r.codes && L.codeChecks ? L.codeChecks.line(r.codes, r.codes.practice) : "";
    return { agree: false, seen: "not sent back (" + (other.length ? "other problems: " + lib.short(other.join(" | "), 200) : r.ok ? "built ok" : "not built") + ")" + (ln2 ? "; shown: " + lib.short(ln2, 260) : "") };
  }
  var missing = want.filter(function (d) { return got.indexOf(d) < 0; }), extra = got.filter(function (d) { return want.indexOf(d) < 0; });
  if (missing.length || extra.length) return { agree: false, seen: "sent back " + JSON.stringify(got) + " (wanted " + JSON.stringify(want) + "): " + lib.short(cb.join(" | "), 300) };
  if (c.practice && cb.some(function (p) { return p.indexOf("(" + c.practice + " practice:") < 0; })) return { agree: false, seen: "practice not " + c.practice + ": " + lib.short(cb[0], 300) };
  if (c.practice === "US" && cb.some(function (p) { return /IEC/.test(p); })) return { agree: false, seen: "US back names IEC: " + lib.short(cb[0], 300) };
  if (c.practice === "IEC" && cb.some(function (p) { return /NFPA|NEC\b/.test(p); })) return { agree: false, seen: "IEC back names NFPA/NEC: " + lib.short(cb[0], 300) };
  if (c.line && lib.writeIt(cb[0]) !== c.line) return { agree: false, seen: "line handed back: " + JSON.stringify(lib.writeIt(cb[0])) + " (right: " + JSON.stringify(c.line) + ")" };
  // the model copies each line as it stands
  var lines = c.lines.slice();
  for (var k = 0; k < cb.length; k++) {
    var wl = lib.writeIt(cb[k]), at = lineIndex(lines, got[k]);
    if (!wl) return { agree: false, seen: "no Write it line: " + lib.short(cb[k], 300) };
    if (at < 0) return { agree: false, seen: "reviewer could not find " + got[k] + "'s line", harm: "low" };
    lines[at] = wl;
  }
  var r2 = lib.build(L, lines, c.q);
  if ((r2.problems || []).length) return { agree: false, seen: "the line copied as it stands is questioned again: " + lib.short(r2.problems.join(" | "), 300) + " (lines: " + JSON.stringify(lines) + ")", harm: "high" };
  var bad2 = checkNc(r2, c.fixNc);
  if (bad2.length) return { agree: false, seen: "after the line handed back: " + bad2.join(", ") + " (lines: " + JSON.stringify(lines) + ")", harm: "high" };
  return { agree: true };
}
module.exports = function (L, cases) {
  return cases.map(function (c) { var j; try { j = judge(L, c); } catch (e) { j = { agree: false, seen: "THREW " + e.message, harm: "high" }; } j.id = c.id; if (!j.agree && !j.harm) j.harm = c.harm; return j; });
};
