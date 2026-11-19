// writer_lists.js -- a list inside a list, numbered as Word and Google Docs number it (1.24.27). Adam (2026-11-19),
// asked whether Writer should show a list in a list as 1. a. i.: "lists inside lists should follow the same schema
// as word and google docs". CORE's Lantern.lists says a list's style by its level (1, a, i, then again; bullets disc,
// circle, square), and Writer's page (its CSS), Save .txt, Save .html, Save .pdf and Save .docx all ask it, so they
// agree; a Word file's lettered level comes in with no type of its own, so it moves with its level as in Word; paste
// keeps a numbered list's own style and start; and the PDF keeps a list a browser's Indent more puts straight inside
// another list (it was left out). The real page in Chromium is tests/browser/writer_lists.py.
// Usage: node tests/writer_lists.js [inner.html]
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
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent === text; })[0]; }
function frag(h) { var x = d.createElement("div"); x.innerHTML = h; return x; }
function types(h) { return Array.prototype.map.call(frag(h).querySelectorAll("ol, ul"), function (o) { return L.lists.type(o); }).join(","); }
w.eval(js);
var L = w.Lantern;

(async function () {
  var LL = L.lists;
  ok("CORE has Lantern.lists", LL && typeof LL.type === "function" && typeof LL.mark === "function" && typeof LL.css === "function");

  // --- the style by level ---
  // a browser's Indent more puts the inner list straight inside the outer one (Chromium, checked); a list inside the item too
  ok("numbered: 1, a, i, then 1 again (a list straight inside a list, as Indent more makes it)",
    types("<ol><li>one</li><ol><li>two</li><ol><li>three</li><ol><li>four</li></ol></ol></ol></ol>") === "1,a,i,1", types("<ol><li>one</li><ol><li>two</li><ol><li>three</li><ol><li>four</li></ol></ol></ol></ol>"));
  ok("...and inside the item", types("<ol><li>one<ol><li>two<ol><li>three<ol><li>four<ol><li>five</li></ol></li></ol></li></ol></li></ol></li></ol>") === "1,a,i,1,a");
  ok("bullets: disc, circle, square, then disc again", types("<ul><li>a<ul><li>b<ul><li>c<ul><li>d</li></ul></li></ul></li></ul></li></ul>") === "disc,circle,square,disc");
  ok("a level counts bullets and numbers both (Word's level is the list's depth): a numbered list in a bullet item is a, b",
    types("<ul><li>Tools<ol><li>Wrench</li></ol></li></ul>") === "disc,a" && types("<ol><li>x<ul><li>y<ol><li>z</li></ol></li></ul></li></ol>") === "1,circle,i");
  ok("a list's own style wins at any level (I, A from 2, i), and one a browser does not know is 1, 2, 3 as the browser shows it",
    types("<ol type=\"I\"><li>p<ol type=\"A\" start=\"2\"><li>b<ol type=\"i\"><li>c</li></ol></li></ol></li></ol>") === "I,A,i" &&
    types("<ol><li>p<ol type=\"1\"><li>q</li></ol></li></ol>") === "1,1" && types("<ol><li>p<ol type=\"x\"><li>q</li></ol></li></ol>") === "1,1" &&
    types("<ul><li>p<ul type=\"SQUARE\"><li>q</li></ul></li></ul>") === "disc,square");
  var deep = "", k; for (k = 0; k < 12; k++) deep += "<ol><li>" + k; for (k = 0; k < 12; k++) deep += "</li></ol>";
  ok("past Word's nine levels a list is shown as the ninth (i)", types(deep).split(",").slice(8).every(function (t) { return t === "i"; }) && types(deep).split(",").slice(0, 9).join("") === "1ai1ai1ai", types(deep));
  ok("a list in a table in a list counts the list around the table, as the page's CSS does", types("<ol><li>x<table><tr><td><ol><li>y</li></ol></td></tr></table></li></ol>") === "1,a");

  // --- the marks ---
  var M = [["1", 1, "1."], ["1", 12, "12."], ["a", 1, "a."], ["a", 26, "z."], ["a", 27, "aa."], ["a", 28, "bb."], ["a", 52, "zz."], ["a", 53, "aaa."], ["A", 28, "AB."], ["i", 4, "iv."], ["i", 9, "ix."], ["i", 14, "xiv."],
    ["I", 1999, "MCMXCIX."], ["i", 3999, "mmmcmxcix."], ["i", 4000, "4000."], ["a", 0, "0."], ["i", 0, "0."], ["1", 0, "0."], ["a", -2, "-2."], ["disc", 3, "•"], ["circle", 1, "◦"], ["square", 1, "▪"]];
  var badM = M.filter(function (m) { return LL.mark(m[0], m[1]) !== m[2]; }).map(function (m) { return m.concat(LL.mark(m[0], m[1])); });
  // (the first review: past z a level's letters went aa, ab on the page and in .txt and .pdf, aa, bb in Word)
  ok("marks: a level's letters past z as Word's (aa, bb, zz, aaa), Roman to 3999, the number past that and at 0 or less, the bullet signs", !badM.length, badM);
  ok("...a list's own type=\"a\" or \"A\" past z as a browser draws it (aa, ab: CSS cannot tell its a from A)", LL.mark("a", 28, true) === "ab." && LL.mark("a", 27, true) === "aa." && LL.mark("A", 28, true) === "AB.");
  ok("start(): as a browser reads a start (\" 4\", \"+3\", \"1e3\" is 1, -2), and none past what a browser counts or with no number",
    LL.start(" 4") === 4 && LL.start("+3") === 3 && LL.start("1e3") === 1 && LL.start("-2") === -2 && LL.start("2147483647") === 2147483647 && LL.start("2147483648") === null &&
    LL.start("12345678901") === null && LL.start("x") === null && LL.start(null) === null && LL.start("") === null);
  ok("own(): a list with a type of its own", LL.own(frag("<ol type=\"a\"><li>x</li></ol>").firstChild) && !LL.own(frag("<ol><li>x</li></ol>").firstChild));

  // --- the CSS ---
  var css = LL.css(".page"), rules = css.split("\n");
  ok("the CSS: Word's letters as a counter style, then 24 rules, each level's numbered and bulleted style, with and without :is()", rules.length === 25 &&
    rules[0] === "@counter-style lp-word-alpha{system:symbolic;symbols:a b c d e f g h i j k l m n o p q r s t u v w x y z;}" &&
    rules.indexOf(".page ol ol:not([type]){list-style-type:lower-alpha;list-style-type:lp-word-alpha;}") >= 0 && rules.indexOf(".page ol ol ol:not([type]){list-style-type:lower-roman;}") >= 0 &&
    rules.indexOf(".page ol ol ol ol:not([type]){list-style-type:decimal;}") >= 0 &&
    rules.indexOf(".page :is(ol,ul,menu) :is(ol,ul,menu) ol:not([type]){list-style-type:lower-roman;}") >= 0 &&
    rules.indexOf(".page :is(ol,ul,menu) ul:not([type]){list-style-type:circle;}") >= 0 && rules.indexOf(".page :is(ol,ul,menu) :is(ol,ul,menu) :is(ol,ul,menu) ul:not([type]){list-style-type:disc;}") >= 0, rules.slice(0, 6));

  // --- Save .txt (writerText with numbers) ---
  var chrome = "<h1>Steps</h1><ol><li>one</li><ol><li>two</li><ol><li>three</li></ol><li>two b</li></ol><li>four</li></ol><p>After.</p>";
  ok(".txt: each item with its number as the page shows it, a level in four spaces (a list straight inside a list)",
    L.writerText(chrome, true) === "Steps\n1. one\n    a. two\n        i. three\n    b. two b\n2. four\nAfter.\n", L.writerText(chrome, true));
  var inli = "<ol start=\"3\"><li>Isolate<ol><li>Open<ul><li>key</li></ul></li></ol></li><li value=\"7\">Seven</li><li>Eight</li></ol><ul><li>Rags</li></ul>";
  ok("...a list inside the item on its own line; a start and a value kept; bullets as -",
    L.writerText(inli, true) === "3. Isolate\n    a. Open\n        - key\n7. Seven\n8. Eight\n- Rags\n", L.writerText(inli, true));
  ok("...a list with words after it in the item: the words after it, in order, lined up with the item's words", L.writerText("<ol><li>Lock<ol><li>pad</li></ol>then test</li></ol>", true) === "1. Lock\n    a. pad\n   then test\n", L.writerText("<ol><li>Lock<ol><li>pad</li></ol>then test</li></ol>", true));
  // (the first review: an item's paragraphs and line breaks, a list in a table cell, an imported page's white space)
  ok("...an item's paragraphs and line breaks are its lines, lined up with its words, not double spaced",
    L.writerText("<ol><li><p>Isolate the supply.</p><p>Tell the operator first.</p><ol><li>Open the breaker</li></ol></li><li>Drain the oil<br>into a pan</li><li><p>Test</p></li></ol>", true) ===
    "1. Isolate the supply.\n   Tell the operator first.\n    a. Open the breaker\n2. Drain the oil\n   into a pan\n3. Test\n", L.writerText("<ol><li><p>Isolate the supply.</p><p>Tell the operator first.</p><ol><li>Open the breaker</li></ol></li><li>Drain the oil<br>into a pan</li><li><p>Test</p></li></ol>", true));
  ok("...a list in a table cell is a line of the cell", L.writerText("<table><tr><th>Job</th><th>Steps</th></tr><tr><td>Oil</td><td><ol><li>Drain</li><li>Refill</li></ol></td></tr></table>", true) === "Job\tSteps\nOil\t1. Drain 2. Refill\n",
    L.writerText("<table><tr><th>Job</th><th>Steps</th></tr><tr><td>Oil</td><td><ol><li>Drain</li><li>Refill</li></ol></td></tr></table>", true));
  ok("...white space as a browser shows it (an imported page's line breaks and tabs), a tab Writer keeps kept, <pre> as it is",
    L.writerText("<ol>\n  <li>Isolate\n\tthe   supply\n    <ol>\n      <li>Open</li>\n    </ol>\n  </li>\n</ol>\n<p>Name:<span style=\"white-space:pre\">\t</span>value</p><pre>a  b\n  c</pre>", true) ===
    "1. Isolate the supply\n    a. Open\nName:\tvalue\na  b\n  c\n", L.writerText("<ol>\n  <li>Isolate\n\tthe   supply\n    <ol>\n      <li>Open</li>\n    </ol>\n  </li>\n</ol>\n<p>Name:<span style=\"white-space:pre\">\t</span>value</p><pre>a  b\n  c</pre>", true));
  // (the second review: a list in a cell carried its level's indent into the cell's line; a start past a browser's)
  ok("...a list in a cell in a list item, and a list in a list in a cell: one line of the cell, no level's indent",
    L.writerText("<ol><li>Readings<table><tr><td>Pump</td><td><ol><li>Drain</li><li>Refill</li></ol></td></tr></table></li></ol>", true) === "1. Readings\nPump\ta. Drain b. Refill\n" &&
    L.writerText("<table><tr><td>Job</td><td><ol><li>Drain<ol><li>Open the tap</li></ol></li><li>Refill</li></ol></td></tr></table>", true) === "Job\t1. Drain a. Open the tap 2. Refill\n",
    [L.writerText("<ol><li>Readings<table><tr><td>Pump</td><td><ol><li>Drain</li><li>Refill</li></ol></td></tr></table></li></ol>", true), L.writerText("<table><tr><td>Job</td><td><ol><li>Drain<ol><li>Open the tap</li></ol></li><li>Refill</li></ol></td></tr></table>", true)]);
  ok("...a start past what a browser counts is no start, as on the page", L.writerText("<ol start=\"2147483648\"><li>x</li><li>y</li></ol>", true) === "1. x\n2. y\n");
  ok("...a list that begins a level in keeps its first line's indent", L.writerText("<ol><ol><li>Only item</li></ol></ol>", true) === "    a. Only item\n", L.writerText("<ol><ol><li>Only item</li></ol></ol>", true));
  ok("...own styles (I, A from 2)", L.writerText("<ol type=\"I\"><li>Part<ol type=\"A\" start=\"2\"><li>Bravo</li></ol></li><li>Two</li></ol>", true) === "I. Part\n    B. Bravo\nII. Two\n");
  ok("...and the counts (Stats) read the text as before, every item - ", L.writerText(chrome) === "Steps\n- one\n- two\n- three\n- two b\n- four\nAfter.\n", L.writerText(chrome));
  // (the first review: levels 8 and 9 had one indent)
  var deep12 = "", k2; for (k2 = 1; k2 <= 12; k2++) deep12 += "<ol><li>L" + k2; for (k2 = 0; k2 < 12; k2++) deep12 += "</li></ol>";
  var t12 = L.writerText(deep12, true).split("\n");
  ok("...nine levels nine indents (0 to 32 spaces), and a deeper list as the ninth", t12.slice(0, 12).map(function (l) { return l.search(/\S/) + l.trim().split(" ")[0]; }).join(",") === "01.,4a.,8i.,121.,16a.,20i.,241.,28a.,32i.,32i.,32i.,32i.", t12);
  var parts30 = "<ol><li>Parts<ol>", own30 = "<ol type=\"a\">"; for (k2 = 1; k2 <= 30; k2++) { parts30 += "<li>Part " + k2 + "</li>"; own30 += "<li>P" + k2 + "</li>"; } parts30 += "</ol></li></ol>"; own30 += "</ol>";
  ok("...a level's letters past z as Word's (aa, bb); a list's own type=\"a\" as a browser's (aa, ab)", /\n    bb\. Part 28\n/.test(L.writerText(parts30, true)) && /\nab\. P28\n/.test(L.writerText(own30, true)), [L.writerText(parts30, true).slice(-60), L.writerText(own30, true).slice(-30)]);

  // --- paste and import keep a numbered list's own style and start ---
  var cl = L.writerClean("<ol type=\"a\" start=\"3\" onclick=\"x()\" style=\"color:red\"><li>c</li></ol><ol type=\"disc\" start=\"3x\"><li>y</li></ol><ol start=\"-2\" type=\"I\"><li>z</li></ol><ul type=\"square\"><li>s</li></ul>");
  ok("paste keeps an <ol>'s type (1, a, A, i, I) and start (read as a browser reads it: 3x is 3), nothing else", cl === "<ol type=\"a\" start=\"3\"><li>c</li></ol><ol start=\"3\"><li>y</li></ol><ol type=\"I\" start=\"-2\"><li>z</li></ol><ul><li>s</li></ul>", cl);
  // (the first review: Google Docs and many sites give a list's style as CSS; starts a browser honours)
  var cl2 = L.writerClean("<ol style=\"list-style-type: lower-alpha\"><li>Note</li></ol><ol><li style=\"list-style-type:upper-alpha\">E<ol><li style=\"list-style-type:decimal\">Iso</li></ol><ol><li style=\"list-style-type:lower-alpha\">x</li></ol></li></ol><ol style=\"list-style-type:decimal\"><li>d</li></ol><ol start=\" 4\"><li>f</li></ol><ol start=\"+3\"><li>t</li></ol><ol start=\"1e3\"><li>e</li></ol>");
  var cl3 = L.writerClean("<ol type=\"A\" style=\"list-style-type: lower-roman\"><li>first</li></ol><ol start=\"12345678901\"><li>x</li></ol><ol><li>p<ol type=\"a\"><li>q</li></ol></li></ol>");
  ok("paste: a style given as CSS over a type (as a browser shows it); a start past a browser's is none; a type that is its level's own style left to the level",
    cl3 === "<ol type=\"i\"><li>first</li></ol><ol><li>x</li></ol><ol><li>p<ol><li>q</li></ol></li></ol>", cl3);
  ok("paste: a style given as CSS is the list's type where its level would not show it anyway; starts as a browser reads them",
    cl2 === "<ol type=\"a\"><li>Note</li></ol><ol type=\"A\"><li>E<ol type=\"1\"><li>Iso</li></ol><ol><li>x</li></ol></li></ol><ol><li>d</li></ol><ol start=\"4\"><li>f</li></ol><ol start=\"3\"><li>t</li></ol><ol start=\"1\"><li>e</li></ol>", cl2);

  // --- the PDF: marks by level, and nothing left out ---
  function pdfBlocks(h) { return L.pdf.layout.blocks(new w.DOMParser().parseFromString("<!DOCTYPE html><body>" + h, "text/html").body).filter(function (b) { return b.kind === "li"; }).map(function (b) { return b.depth + ":" + b.mark + b.runs.map(function (r) { return r.t; }).join(""); }); }
  var pb = pdfBlocks(chrome);
  ok("PDF: the list a browser's Indent more puts straight inside another is kept, a level in, 1. a. i.", pb.join("|") === "0:1.one|1:a.two|2:i.three|1:b.two b|0:2.four", pb);
  var pb2 = pdfBlocks(inli + "<ol type=\"A\" start=\"2\"><li>Bee</li></ol>");
  ok("...a start, a value and an own style kept (they were 1, 2, 3 from 1); bullets by level", pb2.join("|") === "0:3.Isolate|1:a.Open|2:▪key|0:7.Seven|0:8.Eight|0:•Rags|0:B.Bee", pb2);
  ok("...a level's letters past z as Word's", pdfBlocks(parts30)[28] === "1:bb.Part 28" && pdfBlocks(own30)[27] === "0:ab.P28", [pdfBlocks(parts30)[28], pdfBlocks(own30)[27]]);
  var pdf = L.pdf.fromHtml("t", "<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>"), pdfText = "";
  if (pdf && pdf.arrayBuffer) { var ab = await pdf.arrayBuffer(); pdfText = Buffer.from(ab).toString("latin1"); }
  else if (pdf && pdf._buffer) pdfText = Buffer.from(pdf._buffer).toString("latin1");
  ok("...the second and third levels' bullets (circle, square) drawn, as the standard fonts have no such signs", pdfText.length > 200 && (/ S Q/.test(pdfText) && / re f/.test(pdfText) && !/\(\?\) Tj/.test(pdfText)), pdfText.slice(0, 300));

  // --- the Word file ---
  function word(h) {
    var x = L.docx.write("t", h), z = L.zip.read(x.bytes), dx = z.text("word/document.xml"), nx = z.text("word/numbering.xml"), abs = {};
    nx.replace(/<w:abstractNum w:abstractNumId="(\d+)">([\s\S]*?)<\/w:abstractNum>/g, function (all, id, body) {
      abs[id] = []; body.replace(/<w:lvl w:ilvl="(\d)"><w:start w:val="(-?\d+)"\/><w:numFmt w:val="(\w+)"\/><w:lvlText w:val="([^"]*)"/g, function (a, i, s, f, t) { abs[id][+i] = f + ":" + s + ":" + t; });
    });
    var nums = {}; nx.replace(/<w:num w:numId="(\d+)"><w:abstractNumId w:val="(\d+)"\/>/g, function (a, n, b) { nums[n] = b; });
    var items = []; dx.replace(/<w:numPr><w:ilvl w:val="(\d)"\/><w:numId w:val="(\d+)"\/><\/w:numPr>[\s\S]*?<w:t[^>]*>([^<]*)<\/w:t>/g, function (a, il, n, t) { items.push(t + "=" + abs[nums[n]][+il]); });
    return { items: items, back: L.docx.read(x.bytes, "t.docx").html, abs: abs };
  }
  var w1 = word("<ol><li>one</li><ol><li>two</li><ol><li>three</li></ol></ol></ol>");
  ok("Word file: a list in a list written a, then i (Word's lowerLetter, lowerRoman) at its level",
    w1.items.join("|") === "one=decimal:1:%1.|two=lowerLetter:1:%2.|three=lowerRoman:1:%3.", w1.items);
  ok("...the levels a list has no style for are Word's own 1. a. i. cycle", w1.abs["1"].join("|") ===
    "decimal:1:%1.|lowerLetter:1:%2.|lowerRoman:1:%3.|decimal:1:%4.|lowerLetter:1:%5.|lowerRoman:1:%6.|decimal:1:%7.|lowerLetter:1:%8.|lowerRoman:1:%9.", w1.abs["1"]);
  ok("...and read back with no type of their own, so they move with their level as in Word", w1.back === "<ol><li>one<ol><li>two<ol><li>three</li></ol></li></ol></li></ol>", w1.back);
  var w2 = word("<ol><li>one<ol type=\"1\"><li>sub</li></ol></li></ol>");
  ok("a list in a list kept 1, 2, 3 by its own type=\"1\": decimal in the Word file, type=\"1\" read back", w2.items.join("|") === "one=decimal:1:%1.|sub=decimal:1:%2." && w2.back === "<ol><li>one<ol type=\"1\"><li>sub</li></ol></li></ol>", [w2.items, w2.back]);
  var w3 = word("<ul><li>Tools<ol><li>Wrench</li><li>Socket</li></ol></li></ul>");
  ok("a numbered list in a bullet item: a, b in Word as on the page, read back as it was", w3.items.join("|") === "Tools=bullet:1:\u2022|Wrench=lowerLetter:1:%2.|Socket=lowerLetter:1:%2." && w3.back === "<ul><li>Tools<ol><li>Wrench</li><li>Socket</li></ol></li></ul>", [w3.items, w3.back]);
  var w4 = word("<ol type=\"I\"><li>Part<ol type=\"A\" start=\"2\"><li>Bravo<ol><li>first</li></ol></li></ol></li></ol>");
  ok("own styles and a start kept, and the plain list inside them i by its level", w4.items.join("|") === "Part=upperRoman:1:%1.|Bravo=upperLetter:2:%2.|first=lowerRoman:1:%3." &&
    w4.back === "<ol type=\"I\"><li>Part<ol type=\"A\" start=\"2\"><li>Bravo<ol><li>first</li></ol></li></ol></li></ol>", [w4.items, w4.back]);
  var w5 = word("<ol><li>x<table><tr><td><ol><li>in cell</li></ol></td></tr></table></li></ol>");
  ok("a list in a table in a list: written as the page shows it (a)", w5.items.join("|").indexOf("in cell=lowerLetter") >= 0, w5.items);

  // --- in Writer: Save .txt and Save .html ---
  var saved = [];
  L.download = function (name, data, mime) { saved.push({ name: name, data: data, mime: mime }); };
  go("writer"); await sleep(40);
  var id = L.writerDocs.create("Steps", chrome);
  L.writerDocs.open(id); await sleep(40);
  var styleText = Array.prototype.map.call(d.querySelectorAll("style"), function (s) { return s.textContent; }).join("\n");
  ok("the rules are in the page's styles (STYLES), where Writer's page is", styleText.indexOf(".page ol ol:not([type]){list-style-type:lower-alpha;list-style-type:lp-word-alpha;}") >= 0 &&
    styleText.indexOf(".page :is(ol,ul,menu) ul:not([type]){list-style-type:circle;}") >= 0);
  btn(d, "Save .txt").click(); await sleep(10);
  var st = saved[saved.length - 1];
  ok("Writer's Save .txt: the numbers as the page shows them", st && st.name === "Steps.txt" && st.data === "Steps\n1. one\n    a. two\n        i. three\n    b. two b\n2. four\nAfter.\n", st && st.data);
  btn(d, "Save .html").click(); await sleep(10);
  var sh = saved[saved.length - 1];
  ok("Writer's Save .html: the file carries the rules, so a browser shows 1. a. i. too", sh && /\.html$/.test(sh.name) && sh.data.indexOf("body ol ol:not([type]){list-style-type:lower-alpha;list-style-type:lp-word-alpha;}") > 0 &&
    sh.data.indexOf("body :is(ol,ul,menu) :is(ol,ul,menu) ol:not([type]){list-style-type:lower-roman;}") > 0, sh && sh.data.slice(0, 400));
  // (the first review: LibreOffice reads no CSS, and showed the saved file 1. 1. 1.)
  ok("...and each list in a list says its style (type=\"a\", type=\"i\"), for a program that reads no CSS; the first level as it was",
    sh && sh.data.indexOf("<ol><li>one</li><ol type=\"a\" style=\"list-style-type:lower-alpha;list-style-type:lp-word-alpha\"><li>two</li><ol type=\"i\"><li>three</li></ol><li>two b</li></ol><li>four</li></ol>") > 0, sh && sh.data.slice(sh.data.indexOf("<body"), sh.data.indexOf("<body") + 300));

  ok("no page errors", !errs.length, errs);
  console.log(fails ? fails + " FAILED (" + passes + " passed)" : "ALL WRITER LIST CHECKS PASS (" + passes + " passed)");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL (threw)", e && e.stack); process.exit(1); });
