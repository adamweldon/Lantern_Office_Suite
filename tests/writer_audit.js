// writer_audit.js -- Writer after the app audit (1.16.0), the parts a DOM
// without layout can check (tests/browser has the rest): pasted and
// imported HTML keep their structure but not their styling or script;
// Save .txt has one line per paragraph; Save .html has the title once and
// table lines; opening a document does not change it; when the browser's
// storage is full Writer says NOT saved and a bar explains, and the text is
// still there in this session; Esc closes the dialog on top.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
w.document.execCommand = function () { return true; };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 600)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function btn(re) { return Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return re.test(b.textContent); })[0]; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, downloads = [];
  L.download = function (name, text) { downloads.push({ name: name, text: String(text) }); };

  // --- cleaning ------------------------------------------------------------------------------
  var c = L.writerClean('<div style="color:#fff;position:fixed;font-size:9px">Pasted <b style="color:red">bold</b> <span style="background:yellow">words</span></div>' +
    '<img src="x" onerror="alert(1)"><img src="data:image/png;base64,AAAA" onerror="alert(2)"><a href="javascript:void(0)">bad</a>' +
    '<a href="https://example.org" onclick="x()">good</a><script>alert(3)</script><style>p{}</style><h2 class="x">Head</h2><table><tr><td colspan="2" style="x">c</td></tr></table>');
  ok("paste/import keep paragraphs, bold, headings, tables, safe links and pictures in the file -- and nothing else",
    c === '<p>Pasted <b>bold</b> words</p><img src="data:image/png;base64,AAAA"><a>bad</a><a href="https://example.org">good</a><h2>Head</h2><table><tbody><tr><td colspan="2">c</td></tr></tbody></table>', c);
  ok("no script, event handler, style or javascript: link survives", !/script|onerror|onclick|style|javascript/i.test(c));

  // --- text out -------------------------------------------------------------------------------
  var t = L.writerText("<h1>Title</h1><p>First para.</p><p>Second&nbsp;para.</p><ul><li>one</li><li>two</li></ul><table><tr><td>a</td><td>b</td></tr></table>");
  ok("Save .txt: one line per paragraph, heading and list item", t === "Title\nFirst para.\nSecond para.\n- one\n- two\na\tb\n", JSON.stringify(t));

  // --- open, export, unchanged ------------------------------------------------------------------
  var id = L.writerDocs.create("My report", "<h1>My report</h1><p>Body text.</p><table><tr><td>x</td></tr></table>");
  w.location.hash = "writer"; fire(w, "hashchange"); await sleep(60);
  var col = L.store.collection("writer.docs"), before = col.get(id).updated;
  await sleep(15);
  L.writerDocs.open(id); await sleep(30);
  btn(/Save \.html/).click();
  var html = downloads.pop().text;
  ok("Save .html: the title once (the document already starts with it), and tables with their lines", (html.match(/<h1>/g) || []).length === 1 && /td,th\{border:1px solid/.test(html), html.slice(0, 300));
  btn(/Documents$/).click(); await sleep(20);
  ok("opening a document and going back does not change it (no new date, no move to the top)", col.get(id).updated === before);
  ok("the shared <main> is left without Writer's sideways scrolling", d.querySelector("main").style.overflowX === "");

  // --- storage full ----------------------------------------------------------------------------
  L.writerDocs.open(id); await sleep(30);
  var page = d.querySelector(".page[contenteditable]"), realSet = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function (k) { if (/writer\.docs/.test(k)) { var e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } return realSet.apply(this, arguments); };
  page.innerHTML = "<h1>My report</h1><p>Body text. And a new sentence.</p>";
  fire(page, "input"); await sleep(700);
  var footer = Array.prototype.filter.call(d.querySelectorAll(".muted"), function (x) { return /words/.test(x.textContent); }).pop();
  ok("storage full: the footer says NOT saved and a bar explains", /NOT saved: storage is full/.test(footer.textContent) && /Not saved: this browser/.test((d.querySelector("[role=alert]") || {}).textContent || ""), footer.textContent);
  ok("...and the new text is still there in this session", /new sentence/.test(L.writerDocs.get(id).html) && L.store.ok() === false);
  w.Storage.prototype.setItem = realSet;
  page.innerHTML = "<h1>My report</h1><p>Body text. And a new sentence, saved.</p>"; fire(page, "input"); await sleep(700);
  ok("space again: saved, and the store is ok", /· saved$/.test(footer.textContent) && L.store.ok() === true && /saved\./.test(JSON.parse(w.localStorage.getItem("lantern.writer.docs"))[id].html), footer.textContent);

  // --- Esc closes the dialog on top ----------------------------------------------------------------
  var stats = btn(/^Stats$/);
  if (stats) {
    stats.click(); await sleep(10);
    ok("(Stats is open)", !!d.querySelector(".guide-overlay"));
    d.body.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    ok("Esc closes Stats", !d.querySelector(".guide-overlay"));
  }

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? "WRITER AUDIT FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL WRITER AUDIT TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
