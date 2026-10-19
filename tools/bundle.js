#!/usr/bin/env node
// Lantern bundle tool -- decode / encode the self-unpacking wrapper.
//
//   node tools/bundle.js decode <bundle.html> <inner.html>
//       Extract the inner suite from the __bundler/template payload line.
//   node tools/bundle.js encode <wrapper.html> <inner.html> <out.html>
//       Re-encode inner.html into the payload line of wrapper.html.
//       Every byte outside that one line is copied verbatim.
//   node tools/bundle.js verify <bundle.html>
//       Decode then re-encode in memory; exit 1 unless byte-identical.
//   node tools/bundle.js check <bundle.html> <inner.html>
//       Exit 1 unless the bundle's payload decodes exactly to inner.html.
//
// Encoding = JSON.stringify(inner) with every "</" written as "</"
// (the bundler's own escaping; non-ASCII characters stay raw).
"use strict";
var fs = require("fs");

function split(path) {
  var text = fs.readFileSync(path, "utf8");
  var lines = text.split("\n");
  var i = -1;
  for (var k = 0; k < lines.length; k++) {
    if (lines[k].indexOf('<script type="__bundler/template">') !== -1) { i = k + 1; break; }
  }
  if (i < 0) throw new Error("no __bundler/template block in " + path);
  return { lines: lines, idx: i };
}
function encodeInner(inner) {
  return JSON.stringify(inner).split("</").join("<\\u002F");
}

var cmd = process.argv[2];
if (cmd === "decode") {
  var b = split(process.argv[3]);
  fs.writeFileSync(process.argv[4], JSON.parse(b.lines[b.idx]));
  console.log("decoded payload line " + (b.idx + 1) + " -> " + process.argv[4]);
} else if (cmd === "encode") {
  var w = split(process.argv[3]);
  var inner = fs.readFileSync(process.argv[4], "utf8");
  w.lines[w.idx] = encodeInner(inner);
  fs.writeFileSync(process.argv[5], w.lines.join("\n"));
  var back = JSON.parse(split(process.argv[5]).lines[w.idx]);
  if (back !== inner) { console.error("FAIL: re-decode mismatch"); process.exit(1); }
  console.log("encoded " + process.argv[4] + " -> " + process.argv[5] + " (re-decode identical)");
} else if (cmd === "verify") {
  var v = split(process.argv[3]);
  var raw = v.lines[v.idx];
  var ok = encodeInner(JSON.parse(raw)) === raw;
  console.log((ok ? "OK" : "FAIL") + ": payload round-trip " + (ok ? "byte-identical" : "differs"));
  process.exit(ok ? 0 : 1);
} else if (cmd === "check") {
  var c = split(process.argv[3]);
  var same = JSON.parse(c.lines[c.idx]) === fs.readFileSync(process.argv[4], "utf8");
  console.log((same ? "OK" : "FAIL") + ": bundle payload " + (same ? "matches " : "does not match ") + process.argv[4]);
  process.exit(same ? 0 : 1);
} else {
  console.log("usage: bundle.js decode|encode|verify|check ...");
  process.exit(2);
}
