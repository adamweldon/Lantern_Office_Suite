// pc_compat.js -- does the suite still split and merge cleanly in Project
// Context Studio (PCEngine 5.2.0-web)? An emulation of what its splitter and
// merge gate look at, stricter where in doubt:
//  - markers: "// MODULE: NAME - START/END" (also SECTION/REGION/BLOCK and
//    BEGIN/FINISH) after a comment opener; every START has its END, names
//    are unique, nothing nests;
//  - Depends: the "Depends:" text within 5 lines of START is read verbatim;
//    every module name in it is a dependency, and a circle of dependencies
//    is a merge ERROR (so a header must not name a module that depends back
//    on it -- say "through the Lantern.x hook" below the header instead);
//  - brackets: the gate strips strings and comments but does not know regex
//    literals, so ( ) [ ] { } inside a regex, or // inside one, unbalance a
//    module: an ERROR (write \x28 \x29 \x5B \x5D \x7B \x7D \x2F instead);
//  - size: tokens = characters / 4; over 2,500 is a warning (listed, not
//    failed).
// Usage: node tests/pc_compat.js [inner.html]
"use strict";
var fs = require("fs"), path = require("path");
var file = process.argv.slice(2).filter(function (a) { return a.indexOf("--") !== 0; })[0];
var src = fs.readFileSync(file || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var lines = src.split("\n"), MARK = /^\s*(?:\/\/|#|<!--|\/\*)\s*(?:MODULE|SECTION|REGION|BLOCK)\s*:?\s*([A-Za-z0-9_]+)\s*-?\s*(START|BEGIN|END|FINISH)\b/i;
var errors = [], warnings = [], mods = [], open = null, seen = {};
lines.forEach(function (ln, i) {
  var m = MARK.exec(ln);
  if (!m) return;
  var name = m[1].toUpperCase(), start = /^(START|BEGIN)$/i.test(m[2]);
  if (start) {
    if (open) errors.push("marker: " + name + " starts inside " + open.name + " (line " + (i + 1) + ")");
    if (seen[name]) errors.push("marker: " + name + " appears twice");
    seen[name] = 1;
    open = { name: name, a: i };
  } else {
    if (!open || open.name !== name) { errors.push("marker: END of " + name + " without its START (line " + (i + 1) + ")"); return; }
    open.b = i; mods.push(open); open = null;
  }
});
if (open) errors.push("marker: " + open.name + " has no END");
var names = {};
mods.forEach(function (m) { names[m.name] = m; });
// Depends, verbatim, within 5 lines of START
mods.forEach(function (m) {
  var text = "", on = false;
  for (var k = m.a + 1; k <= m.a + 5 && k < m.b; k++) {
    var l = lines[k];
    if (/Exports\s*:/.test(l)) break;
    if (/Depends\s*:/.test(l)) { on = true; text += l.replace(/^.*Depends\s*:/, " "); continue; }
    if (on && /^\s*\/\//.test(l)) text += " " + l.replace(/^\s*\/\//, " ");
  }
  m.deps = (text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []).filter(function (n, i, a) { return names[n] && n !== m.name && a.indexOf(n) === i; });
});
// circles of dependencies
var state = {}, stack = [];
function visit(n) {
  state[n] = 1; stack.push(n);
  names[n].deps.forEach(function (d) {
    if (state[d] === 1) { var cyc = stack.slice(stack.indexOf(d)).concat(d); errors.push("depends: circle " + cyc.join(" -> ")); }
    else if (!state[d]) visit(d);
  });
  stack.pop(); state[n] = 2;
}
mods.forEach(function (m) { if (!state[m.name]) visit(m.name); });
// brackets, with strings and comments stripped and regex literals NOT understood
function strip(code) {
  var out = "", i = 0, n = code.length;
  while (i < n) {
    var c = code[i], d = code[i + 1];
    if (c === "/" && d === "/") { while (i < n && code[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { var e = code.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "\x22" || c === "\x27" || c === "\x60") {
      var q = c; i++;
      while (i < n && code[i] !== q) { if (code[i] === "\\") i++; if (q !== "\x60" && code[i] === "\n") break; i++; }
      i++; continue;
    }
    out += c; i++;
  }
  return out;
}
mods.forEach(function (m) {
  var body = lines.slice(m.a + 1, m.b).join("\n"), s = strip(body), pairs = { "(": ")", "[": "]", "{": "}" }, cnt = { "(": 0, "[": 0, "{": 0 }, bad = [];
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (cnt.hasOwnProperty(ch)) cnt[ch]++;
    else if (ch === ")" || ch === "]" || ch === "}") { var o = ch === ")" ? "(" : ch === "]" ? "[" : "{"; cnt[o]--; }
  }
  Object.keys(cnt).forEach(function (o) { if (cnt[o]) bad.push(o + pairs[o] + " " + (cnt[o] > 0 ? "+" : "") + cnt[o]); });
  if (bad.length) errors.push("brackets: " + m.name + " unbalanced (" + bad.join(", ") + ")");
  var tokens = Math.round(body.length / 4);
  if (tokens > 2500) warnings.push(m.name + " " + tokens);
});
console.log(mods.length + " modules; " + errors.length + " errors; " + warnings.length + " over 2,500 tokens (warnings)");
errors.forEach(function (e) { console.log("ERROR " + e); });
if (process.argv.indexOf("--warnings") >= 0) console.log("over 2,500 tokens: " + warnings.join(", "));
console.log(errors.length ? "PROJECT CONTEXT GATE FAILED" : "PROJECT CONTEXT GATE OK");
process.exit(errors.length ? 1 : 0);
