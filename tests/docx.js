// docx.js -- Word files (.docx) in Lantern (1.24.26). Adam (2026-11-18), with a Word file, an Excel file and a
// PowerPoint file: "Here are some files for 1.24.26. I had lantern create them then opened in word and excel made
// some changes and resaved". The zip they are packed in (ZIP_INFLATE, ZIP: deflate unpacked in plain JavaScript and
// checked against node's zlib; a zip written stored); a Word file read as a Writer document (DOCX_PARTS, DOCX_READ)
// from Word's own document.xml, python-docx, LibreOffice, a file of Word's harder features and one in the Strict
// names (tests/fixtures/docx, made by make.py there); a Writer document written as a Word file (DOCX_WRITE,
// DOCX_PACKAGE), its parts and the order Word's schema wants, and read back as it was; Save .docx and Import file in
// Writer, and Save .docx beside MAKE DOC's Open in Writer (WRITER_DOCX, AI_DOC).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path"), zlib = require("zlib");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FX = path.join(__dirname, "fixtures", "docx");
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, alerts = [];
w.alert = function (m) { alerts.push(String(m)); }; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent === text; })[0]; }
function u8(buf) { var a = new w.Uint8Array(buf.length); for (var i = 0; i < buf.length; i++) a[i] = buf[i]; return a; }
function same(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
function strip(h) { return h.replace(/base64,[A-Za-z0-9+\/=]+/g, "base64,..."); }
// a zip made here with node's zlib, for the reader: [{name, data (Buffer), level}]
function nodeZip(files) {
  var parts = [], dir = [], off = 0;
  files.forEach(function (f) {
    var name = Buffer.from(f.name), packed = f.level === 0 ? f.data : zlib.deflateRawSync(f.data, f.opts || { level: f.level }), crc = zlib.crc32(f.data);
    var h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(f.level === 0 ? 0 : 8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(packed.length, 18); h.writeUInt32LE(f.data.length, 22); h.writeUInt16LE(name.length, 26);
    var c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(f.level === 0 ? 0 : 8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(f.data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, name, packed); dir.push(c, name); off += 30 + name.length + packed.length;
  });
  var cd = Buffer.concat(dir), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cd, e]));
}
// the order Word's schema gives the children of these elements (ISO/IEC 29500-1, 17.3.1.26, 17.4.60, 17.4.42, 17.6.17)
var ORDER = {
  pPr: ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap",
    "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc",
    "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"],
  rPr: ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color",
    "spacing", "w", "kern", "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath"],
  tblPr: ["tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize", "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook"],
  tcPr: ["cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders", "shd", "noWrap", "tcMar", "textDirection", "tcFitText", "vAlign", "hideMark"],
  sectPr: ["headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols", "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid", "printerSettings", "sectPrChange"],
  style: ["name", "aliases", "basedOn", "next", "link", "autoRedefine", "hidden", "uiPriority", "semiHidden", "unhideWhenUsed", "qFormat", "locked", "personal", "personalCompose", "personalReply", "rsid", "pPr", "rPr", "tblPr", "trPr", "tcPr", "tblStylePr"],
  lvl: ["start", "numFmt", "lvlRestart", "pStyle", "isLgl", "suff", "lvlText", "lvlPicBulletId", "legacy", "lvlJc", "pPr", "rPr"]
};
function orderErrors(xml) {
  var doc = new w.DOMParser().parseFromString(xml, "application/xml"), bad = [];
  if (doc.getElementsByTagName("parsererror").length) return ["not well-formed XML"];
  Object.keys(ORDER).forEach(function (el) {
    Array.prototype.forEach.call(doc.getElementsByTagName("w:" + el), function (e) {
      var last = -1;
      for (var c = e.firstElementChild; c; c = c.nextElementSibling) {
        var i = ORDER[el].indexOf(c.localName);
        if (i < 0) { bad.push(el + " has " + c.localName); continue; }
        if (i < last) bad.push(el + ": " + c.localName + " after " + ORDER[el][last]);
        last = Math.max(last, i);
      }
    });
  });
  return bad;
}

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, i;
  ok("boot clean", errs.length === 0, errs);
  ok("the modules are there", L.inflate && L.zip && L.docx && L.docx.read && L.docx.write && L.docx.save && L.writerDocx);

  // --- ZIP_INFLATE: what node's zlib packs, at every level and strategy, comes out the same ---
  var seed = 7; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; }
  var rand = Buffer.alloc(70000); for (i = 0; i < rand.length; i++) rand[i] = rnd() & 255;
  var words = []; for (i = 0; i < 30000; i++) words.push(["<w:p>", "</w:p>", "hello", "world", "\u00e9t\u00e9", "\u2022", "</w:t></w:r>"][rnd() % 7]);
  var texts = { random: rand, repeated: Buffer.from(new Array(100001).join("abc")), xml: Buffer.from(words.join(" "), "utf8"), empty: Buffer.alloc(0), one: Buffer.from("a"),
    long_run: Buffer.alloc(300000, 0x41) };
  var opts = [{ level: 1 }, { level: 6 }, { level: 9 }, { level: 9, strategy: zlib.constants.Z_FIXED }, { level: 9, strategy: zlib.constants.Z_HUFFMAN_ONLY }, { level: 9, strategy: zlib.constants.Z_RLE }, { level: 0 }];
  var inflOk = [];
  Object.keys(texts).forEach(function (k) {
    opts.forEach(function (o) {
      var packed = zlib.deflateRawSync(texts[k], o), got = L.inflate(u8(packed), texts[k].length), got2 = L.inflate(u8(packed));
      if (!same(got, texts[k]) || !same(got2, texts[k])) inflOk.push(k + " " + JSON.stringify(o));
    });
  });
  ok("inflate: random, repeated, XML, empty, one byte and a long run, at levels 1, 6, 9, fixed, Huffman only, RLE and stored, with and without the size", !inflOk.length, inflOk);
  var flip = zlib.deflateRawSync(texts.xml); flip = u8(flip); flip[100] ^= 0x5a;
  var th = ""; try { L.inflate(flip, texts.xml.length); } catch (e) { th = e.message; }
  var cut = ""; try { L.inflate(u8(zlib.deflateRawSync(texts.xml)).subarray(0, 500)); } catch (e) { cut = e.message; }
  ok("a damaged stream, or one cut short, says the file is damaged", /damaged/.test(cut), [th, cut]);

  // --- ZIP: read what node's zlib packed (names without regard to capitals); write; damage ---
  var zb = nodeZip([{ name: "[Content_Types].xml", data: Buffer.from("<Types/>"), level: 6 }, { name: "word/Document.XML", data: texts.xml, level: 9 }, { name: "media/x.bin", data: rand, level: 0 }, { name: "empty", data: Buffer.alloc(0), level: 6 }]);
  var z = L.zip.read(u8(zb));
  ok("zip read: four parts, by any capitals or a leading slash", z.names.length === 4 && same(z.bytes("/WORD/document.xml"), texts.xml) && same(z.bytes("media/x.bin"), rand) && z.text("empty") === "" && z.bytes("nothing") === null, z.names);
  var big = ""; for (i = 0; i < 5000; i++) big += "line " + i + " \u00e9\u2022\ud83d\ude00\n";
  var mine = L.zip.write([{ name: "a.xml", data: big }, { name: "b/c.png", data: new w.Uint8Array([137, 80, 78, 71, 0, 255]) }, { name: "e", data: "" }]);
  var back = L.zip.read(mine), mb = Buffer.from(mine);
  ok("zip write: read back the same, CRC-32 as zlib's, signatures where they belong", back.text("a.xml") === big && same(back.bytes("b/c.png"), [137, 80, 78, 71, 0, 255]) && back.text("e") === "" &&
    mb.readUInt32LE(0) === 0x04034b50 && mb.readUInt32LE(14) === zlib.crc32(Buffer.from(big, "utf8")) && mb.readUInt32LE(mb.length - 22) === 0x06054b50, mb.readUInt32LE(14));
  function zerr(b) { try { var zz = L.zip.read(b); zz.names.forEach(function (n) { zz.bytes(n); }); return ""; } catch (e) { return e.message; } }
  var real = u8(fs.readFileSync(path.join(FX, "features.docx"))), changed = new w.Uint8Array(real); changed[1500] ^= 0x55;
  ok("zip: cut short, a byte changed, an old .doc: each says what it is", /damaged/.test(zerr(real.subarray(0, real.length - 300))) && /damaged/.test(zerr(changed)) &&
    /not a zip file.*\.doc/.test(zerr(new w.Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))), [zerr(real.subarray(0, real.length - 300)), zerr(changed)]);

  // --- DOCX_READ: Word's own document.xml (Adam's file: Lantern's text, saved from Word) ---
  function rd(f) { return L.docx.read(u8(fs.readFileSync(path.join(FX, f))), f); }
  var r = rd("word_plain.docx");
  ok("Word's own file: the title Adam made bold, underlined and centred, and the lines as Word has them", r.html.indexOf("<p style=\"text-align:center\"><b><u>Using Lantern</u></b></p><p><br></p><p>How to Use Lantern</p>") === 0 &&
    /<p>To create a Word document, say &quot;MAKE DOC: &lt;title&gt;&quot; followed by your content.<\/p>/.test(r.html) && (r.html.match(/<p[ >]/g) || []).length === 30, r.html.slice(0, 300));
  ok("...its title from the file's name, its Letter paper and its 1\u2033 margin", r.title === "word_plain" && r.paper && r.paper.size === "letter" && r.paper.orient === "p" && r.paper.margin === 96, [r.title, r.paper]);
  // python-docx
  r = rd("pydocx.docx");
  ok("python-docx: Title and Heading 1 to 3, bold and italic underlined runs", r.title === "Python docx sample" && r.html.indexOf("<h1>Pump maintenance</h1><h1>Before you start</h1><p>Switch off <b>and lock</b> the isolator; <i><u>then test</u></i>.</p><h2>Tools</h2>") === 0, r.html.slice(0, 300));
  ok("...lists whose numbering is in the style (List Bullet, List Number)", /<ul><li>Spanner<\/li><li>Grease gun<\/li><li>Rags<\/li><\/ul><h3>Steps<\/h3><ol><li>Drain the pump<\/li><li>Change the seal<\/li><li>Refill and test<\/li><\/ol>/.test(r.html), r.html);
  ok("...tables with cells joined down and across", r.html.indexOf("<tr><td>Seal</td><td>25 mm</td><td rowspan=\"2\">6 in all</td></tr><tr><td>Bolt</td><td>M8</td></tr>") > 0 && r.html.indexOf("<tr><td colspan=\"2\">Two columns</td><td>One</td></tr>") > 0, r.html);
  ok("...the picture at its size, the page break said in the note", /<img src="data:image\/png;base64,[A-Za-z0-9+\/=]+" width="96">/.test(r.html) && r.pictures === 1 && r.notes.some(function (t) { return /page breaks/.test(t); }), r.notes);
  // the harder features, written in Word's form
  r = rd("features.docx");
  var fh = strip(r.html);
  ok("features: Title, an outline level as a heading", fh.indexOf("<h1>Feature test</h1><h2>Changes</h2>") === 0, fh.slice(0, 200));
  ok("...tracked changes accepted (inserted kept, deleted gone), the comment's words kept and the comment left out", /<p>Kept inserted end\.commented<\/p>/.test(fh) && !/deleted/.test(fh) && !/A comment/.test(fh), fh);
  ok("...a footnote marked [1] and put at the end; a HYPERLINK field and a hyperlink as links; a PAGE field's result", /A footnote<sup>\[1\]<\/sup> and <a href="https:\/\/example.org\/a">a field link<\/a>, page 1, <a href="https:\/\/example.org\/b\?x=1&amp;y=2">a link<\/a>\./.test(fh) &&
    /<p><b>Notes<\/b><\/p><p>\[1\] The note says this\.<\/p>$/.test(fh), fh);
  ok("...content controls (block and inline) read through", /<p>Inside a content control with an inline one\.<\/p>/.test(fh));
  ok("...highlight, double strike, a w:b turned off", /<span style="background-color:#fde68a">Highlighted<\/span> and <s>double struck<\/s> and not bold\./.test(fh));
  ok("...a text box's words after its paragraph, once (not its fallback copy too)", /<p>Before the box\.<\/p><p>Text in the box\.<\/p><ol>/.test(fh) && (fh.match(/Text in the box/g) || []).length === 1, fh);
  ok("...Word's numbering: a level below, carried on after a paragraph (start 3), a restart, bullets, numId 0 no list",
    fh.indexOf("<ol><li>One<ol><li>One a</li></ol></li><li>Two</li></ol><p>A paragraph between.</p><ol start=\"3\"><li>Three, carried on</li></ol><ol><li>From one again</li></ol><ul><li>Dot</li></ul><p>Not a list (numId 0)</p>") > 0, fh);
  ok("...a table: heading row as th (its bold not doubled), a cell down two, a cell across two with two lines",
    fh.indexOf("<table><tr><th>A</th><th>B</th><th>C</th></tr><tr><td rowspan=\"2\">down two</td><td colspan=\"2\">across two<br>second line</td></tr><tr><td>b3</td><td>c3</td></tr></table>") > 0, fh);
  ok("...an inline and a floating picture with their alt text and sizes, a divider, justified text",
    fh.indexOf("<p><img src=\"data:image/png;base64,...\" alt=\"a blue box\" width=\"64\"> inline, and floating: <img src=\"data:image/png;base64,...\" alt=\"a blue box\" width=\"32\"></p><hr><p style=\"text-align:justify\">The end.</p>") > 0, fh);
  ok("...A4 sideways with a narrow margin; the notes say what was left out", r.paper && r.paper.size === "a4" && r.paper.orient === "l" && r.paper.margin === 48 &&
    ["comments are not shown", "headers and footers are not shown", "1 deletion", "text boxes", "footnotes"].every(function (t) { return r.notes.join("|").indexOf(t) >= 0; }), [r.paper, r.notes]);
  r = rd("strict.docx");
  ok("Strict names (purl.oclc.org): a heading, bold and a link", r.html === "<h1>Strict heading</h1><p><b>Bold</b> and <a href=\"https://example.org/s\">a link</a></p>", r.html);
  // LibreOffice saving Lantern's own file: its numbering shares one list between ids, as Word's may
  r = rd("libreoffice.docx");
  var lh = strip(r.html);
  ok("LibreOffice's save: lists as they were (ids sharing a definition count on; a restart and a start of 4 kept)",
    lh.indexOf("<ol><li>Switch off</li><li>Lock<ol><li>padlock</li><li>tag</li></ol></li><li>Test</li></ol><p>Between.</p><ol start=\"4\"><li>Four</li><li>Five</li></ol>") > 0 &&
    lh.indexOf("<ul><li>Wear glasses</li><li>Gloves<ul><li>nitrile</li><li>leather</li></ul></li><li>Boots</li></ul>") > 0, lh);
  ok("...the table, the quote, the indent, the code, the picture, the alignments", lh.indexOf("<tr><td>Bolt &amp; nut</td><td>25 N\u00b7m</td><td rowspan=\"2\">both</td></tr><tr><td colspan=\"2\">wide cell</td></tr>") > 0 &&
    lh.indexOf("<blockquote>A quote.</blockquote><blockquote style=\"margin: 0 0 0 40px; border: none; padding: 0px;\"><p>Indented.</p></blockquote><pre>code  line 1\n    indented</pre><hr>") > 0 &&
    /<p style="text-align:right">Right<\/p><p style="text-align:justify">Justified text\.<\/p>$/.test(lh), lh);
  function rerr(b, n) { try { L.docx.read(b, n); return ""; } catch (e) { return e.message; } }
  ok("an Excel file is named as one, an old .doc is named, a damaged file says so", /Excel workbook \(\.xlsx\), not a Word document/.test(rerr(u8(fs.readFileSync(path.join(FX, "book.xlsx"))))) &&
    /older Office file \(\.doc/.test(rerr(new w.Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].concat(new Array(40).join("0").split("").map(Number))))) && /not a zip file/.test(rerr(new w.Uint8Array(40))) &&
    /damaged/.test(rerr(changed)), [rerr(u8(fs.readFileSync(path.join(FX, "book.xlsx")))), rerr(new w.Uint8Array(40)), rerr(changed)]);

  // --- DOCX_WRITE + DOCX_PACKAGE: a Writer document as a Word file, and back ---
  var png = "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJElEQVR42mM4ISc3IIhh1OJRi0ctHrV41OJRi0ctHrV45FgMAFLhLK5O4QWwAAAAAElFTkSuQmCC";   // 40 by 20, red
  var html = "<h1>Lockout procedure</h1>" +
    "<p style=\"text-align: center;\"><b>Read this first.</b> Then <i>sign</i> the <u>sheet</u>, <s>not</s> H<sub>2</sub>O and x<sup>2</sup>, <span style=\"background-color: rgb(253, 230, 138);\">highlighted</span>.</p>" +
    "<h2>Before you start</h2><p>Name:<span style=\"white-space:pre\">\t</span>value, a <a href=\"https://example.org/x?a=1&amp;b=2\">link</a> and <a href=\"#top\">an anchor</a>.<br>Second line.</p>" +
    "<ul><li>Wear glasses</li><li>Gloves<ul><li>nitrile</li><li>leather</li></ul></li><li>Boots</li></ul>" +
    "<ol><li>Switch off</li><li>Lock<ol><li>padlock</li><li>tag</li></ol></li><li>Test</li></ol><p>Between.</p><ol start=\"4\"><li>Four</li><li>Five</li></ol>" +
    "<table><tr><th>Part</th><th>Torque</th><th>Note</th></tr><tr><td>Bolt &amp; nut</td><td>25 N\u00b7m</td><td rowspan=\"2\">both</td></tr><tr><td colspan=\"2\">wide cell</td></tr></table>" +
    "<blockquote>A quote.</blockquote><blockquote style=\"margin: 0 0 0 40px; border: none; padding: 0px;\">Indented.</blockquote>" +
    "<pre>code  line 1\n    indented</pre><hr><p><img src=\"data:image/png;base64," + png + "\" alt=\"red box\"></p>" +
    "<p><br></p><p>\u00e9t\u00e9 \u2014 \u201cquotes\u201d \ud83d\ude00 &lt;tag&gt; 5 &gt; 3 \u0007bell</p><p style=\"text-align: right;\">Right</p><p style=\"text-align: justify;\">Justified text.</p>";
  var wr = L.docx.write("Lockout <procedure> & test", html, { size: "a4", orient: "p", margin: 72 }), pk = L.zip.read(wr.bytes);
  ok("written: the parts a Word file has, [Content_Types].xml first", pk.names[0] === "[Content_Types].xml" &&
    ["_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels", "word/styles.xml", "word/numbering.xml", "word/settings.xml", "docProps/core.xml", "docProps/app.xml", "word/media/image1.png"].every(function (n) { return pk.has(n); }), pk.names);
  var ctx = pk.text("[Content_Types].xml"), rx = pk.text("word/_rels/document.xml.rels"), dx = pk.text("word/document.xml");
  ok("...every part has its content type, every relationship's part is there", ["document.main", "styles", "numbering", "settings", "core-properties", "extended-properties"].every(function (t) { return ctx.indexOf(t + "+xml") > 0; }) &&
    /Extension="png" ContentType="image\/png"/.test(ctx) && (rx.match(/Target="([^"]+)"/g) || []).every(function (t) { var g = /Target="([^"]+)"/.exec(t)[1]; return /^https?:/.test(g) || pk.has("word/" + g); }), [ctx, rx]);
  var oe = [];
  ["word/document.xml", "word/styles.xml", "word/numbering.xml"].forEach(function (n) { oe = oe.concat(orderErrors(pk.text(n)).map(function (e) { return n + ": " + e; })); });
  ok("...well-formed, and every pPr, rPr, tblPr, tcPr, sectPr, style and lvl in the order Word's schema gives", !oe.length, oe);
  ok("...the control character dropped (XML cannot hold it), the rest of the text as typed", dx.indexOf("bell") > 0 && !/\u0007/.test(dx) && dx.indexOf("\u00e9t\u00e9 \u2014 \u201cquotes\u201d \ud83d\ude00 &lt;tag&gt; 5 &gt; 3 bell") > 0);
  ok("...A4 upright with 0.75\u2033 margins; the title in docProps", /<w:pgSz w:w="11906" w:h="16838"\/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/.test(dx) && /<dc:title>Lockout &lt;procedure&gt; &amp; test<\/dc:title>/.test(pk.text("docProps/core.xml")));
  ok("...headings as Heading 1 and 2, the link as a hyperlink with its relationship, the anchor as w:anchor", /<w:pStyle w:val="Heading1"\/>.*Lockout procedure/.test(dx) && /<w:hyperlink r:id="rId\d+" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"\/>/.test(dx) &&
    /<w:hyperlink w:anchor="top"/.test(dx) && /Target="https:\/\/example.org\/x\?a=1&amp;b=2" TargetMode="External"/.test(rx));
  ok("...the header row repeated on each page and bold; the picture 40 by 20 (in EMU)", /<w:tr><w:trPr><w:tblHeader\/><\/w:trPr>/.test(dx) && /<wp:extent cx="381000" cy="190500"\/>/.test(dx));
  var rb = L.docx.read(wr.bytes, "x.docx"), want = html.replace(/<blockquote style="[^"]*">Indented\.<\/blockquote>/, "<blockquote style=\"margin: 0 0 0 40px; border: none; padding: 0px;\"><p>Indented.</p></blockquote>")
    .replace(/ style="text-align: (\w+);"/g, " style=\"text-align:$1\"").replace(/ style="background-color: rgb\(253, 230, 138\);"/, " style=\"background-color:#fde68a\"").replace(/\u0007/, "")
    .replace("alt=\"red box\">", "alt=\"red box\" width=\"40\">").replace(/<span style="white-space:pre">\t<\/span>/, "<span style=\"white-space:pre\">\t</span>");
  ok("...and read back, it is the document it was", strip(rb.html) === strip(want) && rb.title === "Lockout <procedure> & test" && rb.paper.size === "a4" && rb.paper.margin === 72, [strip(rb.html), strip(want)]);
  // the HTML a browser's editor makes, and edge cases
  function rt(h, paper) { var x = L.docx.write("t", h, paper); return { back: L.docx.read(x.bytes, "t.docx").html, dx: L.zip.read(x.bytes).text("word/document.xml"), notes: x.notes, err: orderErrors(L.zip.read(x.bytes).text("word/document.xml")) }; }
  var e1 = rt("<p></p>");
  ok("an empty document: one empty paragraph, still a Word file", /<w:body><w:p\/><w:sectPr>/.test(e1.dx) && e1.back === "<p><br></p>", e1.dx.slice(0, 400));
  var e2 = rt("<div>typed line</div><div><br></div><div>next <span style=\"font-weight: bold;\">bold</span> <font color=\"red\">red</font></div>text at the top level");
  ok("a browser's own lines (divs, a styled span, a font tag, text loose at the top)", e2.back === "<p>typed line</p><p><br></p><p>next <b>bold</b> red</p><p>text at the top level</p>", e2.back);
  var deep = "x"; for (i = 0; i < 12; i++) deep = "<ul><li>level " + i + deep + "</li></ul>";
  var e3 = rt(deep);
  ok("lists twelve deep are kept to Word's nine levels", e3.err.length === 0 && !/w:ilvl w:val="9"/.test(e3.dx) && /w:ilvl w:val="8"/.test(e3.dx), e3.err);
  var e4 = rt("<table><tr><td rowspan=\"5\">tall</td><td></td></tr><tr><td>b</td><td>extra</td></tr></table>");
  ok("a table with a rowspan past its last row and a ragged row: square, every cell a paragraph", e4.err.length === 0 && (e4.dx.match(/<w:tc>/g) || []).length === 6 && /<w:vMerge\/>/.test(e4.dx) && /<\/w:tbl><w:p\/><w:sectPr>/.test(e4.dx), e4.dx.slice(e4.dx.indexOf("<w:tbl>"), e4.dx.indexOf("<w:tbl>") + 900));
  var e5 = rt("<p><a href=\"javascript:alert(1)\">bad</a> <a href=\"file:///c:/x\">file</a> <img src=\"https://example.org/x.png\"> <img src=\"data:image/svg+xml;base64,PHN2Zy8+\"></p>");
  ok("a javascript: or file: link is written as words; a picture from the web or an SVG is left out, and said", /<w:t xml:space="preserve">bad<\/w:t>/.test(e5.dx) && !/javascript|file:/.test(e5.dx) && !/w:drawing/.test(e5.dx) && e5.notes.length === 1, [e5.notes, e5.dx.slice(0, 600)]);
  var long = ""; for (i = 0; i < 2000; i++) long += "<p>Paragraph " + i + " with <b>bold</b> and <i>italic</i> words in it.</p>";
  var t0 = Date.now(), e6 = L.docx.write("long", long), t1 = Date.now(), e6b = L.docx.read(e6.bytes), t2 = Date.now();
  ok("two thousand paragraphs written and read back in a few seconds at most", (e6b.html.match(/<p>/g) || []).length === 2000 && t2 - t0 < 8000, [t1 - t0, t2 - t1]);
  var e7 = rt("<p>a</p>", { size: "letter", orient: "l", margin: 48 });
  ok("Letter sideways with 0.5\u2033 margins", /<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"\/><w:pgMar w:top="720"/.test(e7.dx));
  ok("a file name Windows, a Mac and a phone can all use", L.docx.fileName("Q3: report/plan? <draft>") === "Q3 report plan draft.docx" && L.docx.fileName("") === "document.docx" && L.docx.fileName("...") === "document.docx", L.docx.fileName("Q3: report/plan? <draft>"));

  // --- Writer: Save .docx, and Import file with a .docx ---
  var saved = [];
  L.download = function (name, data, mime) { saved.push({ name: name, data: data, mime: mime }); };
  go("writer"); await sleep(40);
  var id = L.writerDocs.create("Shop notes", "<h1>Shop notes</h1><ul><li>Oil</li><li>Rags</li></ul>");
  L.writerDocs.open(id); await sleep(40);
  var sb = btn(d, "Save .docx");
  ok("Writer has Save .docx (beside Save .pdf)", !!sb && !!btn(d, "Save .pdf"));
  sb.click(); await sleep(10);
  var s0 = saved[saved.length - 1];
  ok("...it downloads Shop notes.docx, a Word file of the document", s0 && s0.name === "Shop notes.docx" && /wordprocessingml\.document$/.test(s0.mime) &&
    L.docx.read(s0.data).html === "<h1>Shop notes</h1><ul><li>Oil</li><li>Rags</li></ul>", s0 && [s0.name, s0.mime]);
  go("writer"); await sleep(10);
  var back2 = btn(d, "\u2190 Documents"); if (back2) back2.click(); await sleep(20);
  var imp = btn(d, "Import file");
  ok("the library's Import file offers .docx", !!imp && /Word/.test(imp.title));
  imp.click(); await sleep(10);
  var inp = d.querySelector("input[type=file]");
  ok("...its chooser takes .docx", inp && /\.docx/.test(inp.accept), inp && inp.accept);
  var file = new w.File([u8(fs.readFileSync(path.join(FX, "features.docx")))], "features.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  Object.defineProperty(inp, "files", { value: [file] });
  var nDocs = L.writerDocs.list().length;
  fire(inp, "change"); await sleep(300);
  var pageEl = d.querySelector(".page"), note = d.querySelector(".lp-docx-note");
  ok("...a .docx opens as a new document with its title, headings and table", L.writerDocs.list().length === nDocs + 1 && pageEl && /Feature test/.test(pageEl.innerHTML) && pageEl.querySelector("table td[rowspan=\"2\"]") &&
    (d.querySelector("input[placeholder=\"Document title\"]") || {}).value === "features", pageEl && pageEl.innerHTML.slice(0, 200));
  ok("...with a note above the page saying what was left out", note && /Opened from the Word file/.test(note.textContent) && /comments are not shown/.test(note.textContent) && /headers and footers/.test(note.textContent), note && note.textContent);
  var opened = L.writerDocs.list().filter(function (x) { return x.title === "features"; })[0], st = opened && L.store.collection("writer.docs").get(opened.id);
  ok("...on the paper the Word file had (A4, sideways, narrow)", st && st.paper && st.paper.size === "a4" && st.paper.orient === "l" && st.paper.margin === 48, st && st.paper);
  btn(note, "OK").click();
  ok("...and OK puts the note away", !d.querySelector(".lp-docx-note"));
  // an old .doc, and a damaged .docx
  btn(d, "\u2190 Documents").click(); await sleep(20);
  btn(d, "Import file").click(); await sleep(10);
  inp = d.querySelector("input[type=file]");
  Object.defineProperty(inp, "files", { value: [new w.File([new w.Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], "old.doc")] });
  fire(inp, "change"); await sleep(50);
  ok("an old .doc: told to save it as .docx first", /old\.doc.*save it as \.docx/.test(alerts[alerts.length - 1] || ""), alerts);
  btn(d, "Import file").click(); await sleep(10);
  inp = d.querySelector("input[type=file]");
  Object.defineProperty(inp, "files", { value: [new w.File([changed], "broken.docx")] });
  nDocs = L.writerDocs.list().length;
  fire(inp, "change"); await sleep(200);
  ok("a damaged .docx: said, and no document made", /could not open .broken\.docx.*damaged/.test(alerts[alerts.length - 1] || "") && L.writerDocs.list().length === nDocs, alerts.slice(-1));

  // --- MAKE DOC: Save .docx beside Save .pdf; the AI is told it makes Word files ---
  var act = L.aiActions.filter(function (a) { return a.id === "doc"; })[0];
  var built = act.build({ kind: "DOC", title: "Winter checklist", lines: ["## Engine", "- Drain the fuel", "- Change the oil", "## Blade", "1. Sharpen it", "2. Oil it", "Part | When", "Plug | Each year"], closed: true });
  var xd = (built.extra || []).filter(function (x) { return x.label === "Save .docx"; })[0];
  ok("MAKE DOC: Save .docx is there with Save .pdf", xd && built.extra[0].label === "Save .pdf", (built.extra || []).map(function (x) { return x.label; }));
  xd.run();
  var s1 = saved[saved.length - 1], s1r = s1 && L.docx.read(s1.data);
  ok("...it saves Winter checklist.docx: the title on top, headings, both lists and the table", s1 && s1.name === "Winter checklist.docx" && s1r.html.indexOf("<h1>Winter checklist</h1><h2>Engine</h2><ul><li>Drain the fuel</li><li>Change the oil</li></ul><h2>Blade</h2><ol><li>Sharpen it</li><li>Oil it</li></ol><table><tr><th>Part</th><th>When</th></tr>") === 0, s1r && s1r.html);
  ok("the AI's instructions for a document name Save .docx and Word files", act.prompt.join(" ").indexOf("Save .docx") > 0 && /Word file \(\.docx\)/.test(act.prompt.join(" ")) && /Save \.docx a Word file/.test(act.also));
  ok("a request for a Word file or a .docx is a document", act.match("Make me a Word document I can print: a weekly checklist") && act.match("Write the procedure and save it as a .docx") && act.match("put it in a docx for me"));
  // the bench's Word file question
  var bq = L.aiBenchQuestions.filter(function (q) { return q.id === "make-doc-word-checklist"; })[0];
  function bgrade(reply) { return L.aiBench.grade(bq, reply, { made: L.aiAct.build(reply, bq.q) }); }
  var gi = bgrade(bq.ideal), gn = bgrade("ANSWER: I cannot create Word files, but here is a checklist: extinguishers, exits, guards."),
    gs = bgrade("MAKE DOC: Checklist\n## Weekly\n- Extinguishers checked and in their places on the wall\n- Exits clear of boxes, carts and tools\nThe foreman signs this sheet each Friday afternoon and keeps it in the office file for a year.\nEND");
  ok("bench: the Word file question's ideal passes; \u201cI cannot create Word files\u201d fails; two things to check fail", bq && gi.pass && !gn.pass && !gs.pass && /fewer than five/.test(gs.why), [gi.why, gn.why, gs.why]);
  L.guide.open("writer"); await sleep(10);
  var gov = d.querySelector(".guide-overlay");
  ok("Writer's help says how Word files come and go", gov && /Word files \(\.docx\)/.test(gov.textContent) && /Save \.docx downloads the document as a Word file/.test(gov.textContent) && /Import file in the document library opens a \.docx/.test(gov.textContent), gov && gov.textContent.slice(-900));
  if (gov && gov.parentNode) gov.parentNode.removeChild(gov);
  ok("no errors", errs.length === 0, errs);
  console.log((fails ? "FAILED " + fails : "ALL DOCX CHECKS PASS") + " (" + passes + " passed)");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
