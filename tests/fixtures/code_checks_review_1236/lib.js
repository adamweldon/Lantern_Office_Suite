// lib.js -- the code checks review (1.24.36): loading a Lantern build in jsdom, building control blocks, reading what
// was drawn and what went back. Written by the reviewer; uses the loader of tests/fixtures/liftstation_review1_1230.
"use strict";
var fs = require("fs"), path = require("path"), os = require("os");
var LOADER = path.join(__dirname, "..", "liftstation_review1_1230", "load.js");
var load0 = require(LOADER);

// load(file) -> Promise of {o, L}: the page's script run in jsdom, after 80 ms
function load(file) {
  return new Promise(function (res, rej) {
    var o;
    try { o = load0(file); } catch (e) { rej(e); return; }
    setTimeout(function () { res({ o: o, L: o.L }); }, 80);
  });
}

// the text of a module, START marker to END marker, in an inner html
function moduleSpan(src, name) {
  var a = src.indexOf("// MODULE: " + name + " - START"), b = src.indexOf("// MODULE: " + name + " - END");
  if (a < 0 || b < 0) return null;
  // from the line of ===== above START to the line of ===== below END
  var s = src.lastIndexOf("\n// =====", a - 2), e = src.indexOf("\n", src.indexOf("\n", b) + 1);
  return { from: s + 1, to: e + 1, text: src.slice(a, b) };
}
// strip(file, names) -> a temp file with those modules taken out (as a user would drop them)
function strip(file, names, tag) {
  var src = fs.readFileSync(file, "utf8");
  names.forEach(function (n) {
    var sp = moduleSpan(src, n);
    if (!sp) throw new Error("no module " + n);
    src = src.slice(0, sp.from) + src.slice(sp.to);
  });
  var out = path.join(os.tmpdir(), "ccr1236_" + (tag || names.join("_")) + "_" + process.pid + ".html");
  fs.writeFileSync(out, src);
  return out;
}

function block(lines, title) { return "MAKE CONTROL: " + (title || "Circuit") + "\n" + lines.join("\n") + "\nEND"; }
function build(L, lines, q, title) {
  var r;
  try { r = L.aiAct.build(block(lines, title), q || "draw a control circuit"); } catch (e) { r = { ok: false, problems: ["THREW " + e.message], plan: null }; }
  return r || { ok: false, problems: ["no block"], plan: null };
}
var CC_RE = /\((US|IEC) practice: [^)]*\)/;
function ccBacks(r) { return (r.problems || []).filter(function (p) { return CC_RE.test(p); }); }
function otherProblems(r) { return (r.problems || []).filter(function (p) { return !CC_RE.test(p); }); }
function writeIt(p) { var m = /Write it: (.*)$/.exec(p); return m ? m[1].replace(/\.$/, "") : null; }
// every element drawn with that id, with where it is: [{nc, at, out}]
function drawn(r, id) {
  var out = [];
  var c = r && r.plan && r.plan.circuit;
  if (!c) return out;
  (c.feed || []).forEach(function (f) { if (f.id === id) out.push({ nc: true, at: "feed", out: "" }); });
  (c.rungs || []).forEach(function (rg) {
    ["stops", "starts", "series", "after"].forEach(function (k) { (rg[k] || []).forEach(function (e) { if (e.id === id && e.kind !== "contact") out.push({ nc: !!e.nc, at: k, out: rg.out.id }); }); });
    (rg.branches || []).forEach(function (b) { b.forEach(function (e) { if (e.id === id && e.kind !== "contact") out.push({ nc: !!e.nc, at: "branch", out: rg.out.id }); }); });
  });
  return out;
}
function setPractice(L, v) { try { L.store.set("codes.practice", v || ""); } catch (e) { } }
function short(s, n) { s = String(s); n = n || 160; return s.length > n ? s.slice(0, n) + "..." : s; }

module.exports = { load: load, strip: strip, moduleSpan: moduleSpan, build: build, block: block, ccBacks: ccBacks, otherProblems: otherProblems,
  writeIt: writeIt, drawn: drawn, setPractice: setPractice, short: short, CC_RE: CC_RE };
