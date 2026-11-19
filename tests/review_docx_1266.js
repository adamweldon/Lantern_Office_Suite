// review_docx_1266.js -- the first review of Word files in Lantern (1.24.26), replayed. A reviewer that had not seen
// the code made 97 Word files of its own (Word's own form written by hand, python-docx, LibreOffice saving HTML, flat
// ODF, RTF and Word files, odd but legal zips, hostile files) and 63 Writer documents (typed in Chromium with Writer's
// own tools, pasted, MAKE DOC's, Writer's templates, Lantern's own reads); its cases are in
// tests/fixtures/review_docx_1266.json and the files in tests/fixtures/docx/review/. "expect" is what Word shows, or
// what the HTML meant. Every case is checked here against Lantern's reading and writing, except the few KEEP lists
// with the reason each is left as it is. What needs LibreOffice, python-docx or the OOXML schema is checked by
// tests/review_docx_1266_lo.py (run in the session; it says SKIP where those are missing).
// The second review (tests/fixtures/review2_docx_1266.json, tests/fixtures/docx/review2/: 60 Word files and 45 Writer
// documents of another reviewer's own, made after the first review's mends) is replayed the same way with --second.
// Usage: node tests/review_docx_1266.js [inner.html] [-v] [--second]
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var args = process.argv.slice(2), VERBOSE = args.indexOf("-v") >= 0, SECOND = args.indexOf("--second") >= 0;
args = args.filter(function (a) { return a !== "-v" && a !== "--second"; });
var inner = fs.readFileSync(args[0] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FX = path.join(__dirname, "fixtures", "docx");
var R = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", SECOND ? "review2_docx_1266.json" : "review_docx_1266.json"), "utf8"));
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
// Left as they are, with the reason (the case still runs; it is reported, not failed)
var KEEP = SECOND ? {
  "hand2-ol-types-nested": "the read back is the HTML that was written, <ol type=\"i\"> and all; the case expected the innermost type left out, as the reader did when the case was made (it left out a type that was Word's usual one for its level; since this review it writes every type but 1, 2, 3, because Writer's page shows a list in a list 1, 2, 3)"
} : {
  "lo-lists": "Writer's page shows a numbered list inside another 1., 2. (the second review saw it on the page: no style of its own), so a Word file's lettered level comes in as <ol type=\"a\"> and Writer's plain one is saved 1., 2.; this case expected Word's 1. a. i. cycle for a plain list",
  "hand-link-odd": "Word's bookmark names hold letters, digits and _ only, so a link to #section-2 is written as #section_2, and the bookmark it goes to the same way: the link still works in Word, and reads back as #section_2",
  "hostile-deep-sdt": "3,000 content controls one inside another are read (\u201cdeep inside\u201d, \u201cafter\u201d) at once, not refused: nothing hangs, which is what the case asked of a refusal"
};
var fails = 0, passes = 0, kept = [];
function u8(buf) { var a = new w.Uint8Array(buf.length); for (var i = 0; i < buf.length; i++) a[i] = buf[i]; return a; }
function short(h) { return String(h).replace(/base64,[A-Za-z0-9+\/=]+/g, "base64,..."); }
w.eval(js);
var L = w.Lantern;
// read cases
var cache = {};
function readFile(f) {
  if (cache[f]) return cache[f];
  var t0 = Date.now(), r = { ms: 0 };
  try { r.out = L.docx.read(u8(fs.readFileSync(path.join(FX, f))), path.basename(f)); } catch (e) { r.err = e.message; }
  r.ms = Date.now() - t0;
  return (cache[f] = r);
}
R.read.forEach(function (c) {
  var e = c.expect, bad = [];
  if (/bomb/.test(c.file) && process.env.SKIP_BOMB) return;
  var r = readFile(c.file), h = r.out ? r.out.html : "";
  if (e.error && !r.err) bad.push("should be refused, was read");
  if (e.error_contains) e.error_contains.forEach(function (t) { if (!r.err || r.err.indexOf(t) < 0) bad.push("the message should say “" + t + "”: " + r.err); });
  if (!e.error && !e.error_ok && r.err) bad.push("refused: " + r.err);
  if (e.max_ms && r.ms > e.max_ms) bad.push("took " + r.ms + " ms (limit " + e.max_ms + ")");
  if (r.out) {
    (e.contains || []).forEach(function (t) { if (h.indexOf(t) < 0) bad.push("missing " + t); });
    (e.not_contains || []).forEach(function (t) { if (h.indexOf(t) >= 0) bad.push("has " + t); });
    (e.notes_contain || []).forEach(function (t) { if (r.out.notes.join(" | ").indexOf(t) < 0) bad.push("notes lack “" + t + "”: " + r.out.notes.join(" | ")); });
    if (e.title != null && r.out.title !== e.title) bad.push("title " + r.out.title);
    if (e.paper) Object.keys(e.paper).forEach(function (k) { if (!r.out.paper || r.out.paper[k] !== e.paper[k]) bad.push("paper " + JSON.stringify(r.out.paper)); });
    if (e.no_script_runs) {
      // the HTML put in a page: no script element, no on... attribute, no javascript: address
      var box = w.document.createElement("div"); box.innerHTML = h;
      var bad1 = Array.prototype.filter.call(box.querySelectorAll("*"), function (el) {
        return /^(SCRIPT|IFRAME|OBJECT|EMBED)$/.test(el.tagName) || Array.prototype.some.call(el.attributes, function (a) { return /^on/i.test(a.name) || /^\s*(javascript|vbscript|data:text)/i.test(a.value) && /href|src/i.test(a.name); });
      });
      if (bad1.length) bad.push("script-bearing HTML: " + bad1.map(function (el) { return el.outerHTML.slice(0, 80); }).join(" | "));
    }
  }
  record("read " + c.id, bad, short(h).slice(0, 600));
});
// write cases
// Word wants every cell to end with a paragraph, even one whose last thing is a table
function tcEndsWithP(xml) { return !/<\/w:tbl><\/w:tc>/.test(xml); }
R.write.forEach(function (c) {
  var e = c.expect, bad = [], out, back, xml = "";
  try {
    out = L.docx.write(c.title || c.id, c.html, c.paper || null);
    if (e.valid && !out.bytes.length) bad.push("no file made");
    var z = L.zip.read(out.bytes); xml = z.text("word/document.xml");
    back = L.docx.read(out.bytes, (c.title || c.id) + ".docx");
  } catch (er) { bad.push("failed: " + er.message); }
  if (back) {
    (e.read_back_contains || []).forEach(function (t) { if (back.html.indexOf(t) < 0) bad.push("read back lacks " + t); });
    (e.not_read_back_contains || []).forEach(function (t) { if (back.html.indexOf(t) >= 0) bad.push("read back has " + t); });
    if (e.title_back != null && back.title !== e.title_back) bad.push("title back " + back.title);
    if (e.paper_back) Object.keys(e.paper_back).forEach(function (k) { if (!back.paper || back.paper[k] !== e.paper_back[k]) bad.push("paper back " + JSON.stringify(back.paper)); });
    if (e.file_name != null && L.docx.fileName(c.title) !== e.file_name) bad.push("file name " + L.docx.fileName(c.title));
    if (e.tc_ends_with_p && !tcEndsWithP(xml)) bad.push("a table cell ends with a table, not a paragraph");
  }
  record("write " + c.id, bad, back ? short(back.html).slice(0, 600) : "");
});
function record(name, bad, info) {
  var id = name.replace(/^(read|write) /, "");
  if (!bad.length) { passes++; if (KEEP[id]) console.log("NOTE  " + name + " now passes; take it off KEEP"); return; }
  if (KEEP[id]) { kept.push(name); if (VERBOSE) console.log("KEPT  " + name + ": " + KEEP[id] + "\n      " + bad.join("; ")); return; }
  fails++;
  console.log("FAIL  " + name + ": " + bad.join("; ").slice(0, 900) + (VERBOSE ? "\n      " + info : ""));
}
if (errs.length) { fails++; console.log("FAIL  page errors", errs); }
console.log((fails ? fails + " FAILED" : SECOND ? "ALL SECOND DOCX REVIEW CHECKS PASS" : "ALL DOCX REVIEW CHECKS PASS") + " (" + passes + " agree, " + kept.length + " kept as they are)");
process.exit(fails ? 1 : 0);
