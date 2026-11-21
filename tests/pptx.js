// pptx.js -- PowerPoint files in Slides (1.24.33). A deck saved as .pptx and read back; the package itself (every part
// readable, named in the content types, every relationship's part there, the deck's colours as the file's theme); decks
// from python-pptx (placeholders with the master's bullets, levels, links, text boxes in reading order, a slide with no
// title box, a table with joined cells, two pictures, a chart, a group, a hidden slide, a numbered list from 3, an EMF
// picture, a SmartArt diagram) and the same decks as LibreOffice saves them; what was not kept, said; files that are not presentations;
// Save .pptx and Open .pptx in Slides; MAKE SLIDES' Save .pptx in Chat. tests/pptx_lo.py checks the saves against the
// schema and in python-pptx and LibreOffice.
"use strict";
var fs = require("fs"), path = require("path");
var load = require(path.join(__dirname, "fixtures", "liftstation_review1_1230", "load.js"));
var SRC = (process.argv[2] && process.argv[2] !== "--write-deck" ? process.argv[2] : null) || path.join(__dirname, "..", "src", "lantern.inner.html");
var FX = path.join(__dirname, "fixtures", "pptx_1233");
var passes = 0, fails = 0;
function ok(name, cond, info) {
  if (cond) { passes++; console.log("ok   " + name); }
  else { fails++; console.log("FAIL " + name + (info !== undefined ? "\n     " + JSON.stringify(info).slice(0, 1500) : "")); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// a small JPEG (8 by 6, grey), as Slides stores a picture
var JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAGAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
var DECK = { title: "Ladder safety & you", theme: { name: "Paper", bg: "#fafaf7", fg: "#1b2430", accent: "#c2410c" }, slides: [
  { h: "Ladder safety", body: "<p>A two-minute talk for the crew.</p>" },
  { h: "Before you climb", body: "<ul><li>Check the <b>feet</b> and rungs<ul><li>No cracks</li><li>No <i>grease</i></li></ul></li><li>Set it at <u>1 in 4</u></li></ul><p>See <a href=\x22https://www.osha.gov/ladders\x22>OSHA</a>.</p>", notes: "Ask who has fallen.\nShow the ladder." },
  { h: "Steps", body: "<ol><li>Isolate</li><li>Prove zero</li><li>Give it back</li></ol>", img: JPEG },
  { h: "Loads", body: "<p>Ratings:</p><table><tr><th>Type</th><th>Load</th></tr><tr><td>I</td><td>250 lb</td></tr><tr><td colspan=\x222\x22>IA: 300 lb</td></tr></table>" },
  { h: "", body: "", img: JPEG },
  { h: "Café – “quotes” <&>", body: "<h2>Heading</h2><p>Line one<br>line two</p><div>x &amp; y</div><p>H<sub>2</sub>O and m<sup>2</sup>, <s>old</s> new</p>" },
  { h: "Numbers from 4", body: "<ol start=\x224\x22><li>four</li><li>five<ol><li>five a</li></ol></li></ol><p>after\u0007 the list</p>" }
] };
var BACK = [
  ["Ladder safety", "<p>A two-minute talk for the crew.</p>"],
  ["Before you climb", "<ul><li>Check the <b>feet</b> and rungs<ul><li>No cracks</li><li>No <i>grease</i></li></ul></li><li>Set it at <u>1 in 4</u></li></ul><p>See <a href=\x22https://www.osha.gov/ladders\x22>OSHA</a>.</p>"],
  ["Steps", "<ol><li>Isolate</li><li>Prove zero</li><li>Give it back</li></ol>"],
  ["Loads", "<p>Ratings:</p><table><tr><th><b>Type</b></th><th><b>Load</b></th></tr><tr><td>I</td><td>250 lb</td></tr><tr><td colspan=\x222\x22>IA: 300 lb</td></tr></table>"],
  ["", ""],
  ["Café – “quotes” <&>", "<p><b>Heading</b></p><p>Line one<br>line two</p><p>x &amp; y</p><p>H<sub>2</sub>O and m<sup>2</sup>, <s>old</s> new</p>"],
  ["Numbers from 4", "<ol start=\x224\x22><li>four</li><li>five<ol><li>five a</li></ol></li></ol><p>after the list</p>"]
];
// the python-pptx deck as Lantern reads it (tests/fixtures/pptx_1233/make.py)
var PY = [
  ["Pump station basics", "<p>A course for operators</p>"],
  ["Before you start", "<ul><li>Lock out the panel<ul><li>Hang your own tag</li><li>Test <b>dead</b></li></ul></li><li>Read the <a href=\x22https://example.org/manual\x22><i>manual</i></a></li></ul>"],
  ["Two columns", "<p>Left box</p><p>Right box</p><p>Under both</p>"],
  ["No title box here", "<p>A long sentence low on the slide that says what the wet well does and why the floats hang where they do.</p>"],
  ["Float heights", "<table><tr><th>Float</th><th>Height</th><th>Job</th></tr><tr><td>FS1</td><td>0.5 m</td><td>off</td></tr><tr><td>FS2</td><td>1.0 m</td><td>lead on</td></tr><tr><td colspan=\x223\x22>FS3 and FS4</td></tr></table>"],
  ["Two pictures", ""],
  ["Run hours", "<table><tr><th></th><th>Hours</th></tr><tr><td>Pump 1</td><td>120</td></tr><tr><td>Pump 2</td><td>118</td></tr></table>"],
  ["Grouped", "<p>Inside the group</p><p>Also inside</p>"],
  ["Hidden slide", "<ul><li>Only for the trainer</li></ul>"],
  ["Steps from three", "<ol start=\x223\x22><li>Isolate</li><li>Prove dead</li><li>Work</li></ol>"],
  ["A Visio drawing", ""]
];
function u8(o, b) { var a = new o.w.Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b[i]; return a; }
// what other programs change on the way: a link underlined, a table's header row as plain cells, a chart's title above it
function loose(h) { return h.replace(/<\x2F?u>/g, "").replace(/<(\x2F?)th>/g, "<$1td>").replace(/<p><b>Hours<\x2Fb><\x2Fp>/, ""); }

(async function () {
  var o = load(SRC), L = o.L, w = o.w;
  await sleep(50);
  var P = L.pptx;
  // node tests/pptx.js --write-deck <file>: the deck below as Lantern saves it (lo_lantern.pptx is LibreOffice's save of it)
  if (process.argv.indexOf("--write-deck") > 0) { fs.writeFileSync(process.argv[process.argv.indexOf("--write-deck") + 1], Buffer.from(P.write(DECK).bytes)); process.exit(0); }
  ok("boot clean, with Lantern.pptx (read, write, save, draw) and Slides' Save .pptx and Open .pptx", o.errs.length === 0 && P && P.read && P.write && P.save && P.draw && L.slidesPptx &&
    (L.slideDeckTools || []).some(function (t) { return t.label === "Save .pptx"; }) && (L.slideLibTools || []).some(function (t) { return t.label === "Open .pptx"; }), o.errs);

  // --- a deck saved and read back --------------------------------------------------------------------------------
  var wr = P.write(DECK), back = P.read(wr.bytes, "deck.pptx");
  ok("a deck saved as .pptx is read back: every title and every slide's text (lists at their levels, numbers from 4, looks, links, a table with joined cells, headings, line breaks)",
    back.slides.length === BACK.length && BACK.every(function (b, i) { return back.slides[i].h === b[0] && back.slides[i].body === b[1]; }),
    back.slides.map(function (s, i) { return s.h === BACK[i][0] && s.body === BACK[i][1] ? "same" : [s.h, s.body]; }));
  ok("...its pictures (beside the text, and alone) and its notes, its title; nothing said lost but the layout", !!back.slides[2].img && !!back.slides[4].img && !back.slides[0].img &&
    back.slides[1].notes === "Ask who has fallen.\nShow the ladder." && back.title === "Ladder safety & you" && wr.notes.length === 0 && back.notes.length === 1 && /^the layout/.test(back.notes[0]), [wr.notes, back.notes, back.title]);
  var Z = L.zip.read(wr.bytes), names = Z.names, ct = Z.text("[Content_Types].xml");
  var xmlOk = names.filter(function (n) { return /\.(xml|rels)$/.test(n); }).every(function (n) { var d = new w.DOMParser().parseFromString(Z.text(n), "application\x2Fxml"); return !d.getElementsByTagName("parsererror").length; });
  ok("the package: every part is XML a parser reads", xmlOk);
  var unnamed = names.filter(function (n) { return /\.xml$/.test(n) && n !== "[Content_Types].xml" && ct.indexOf("PartName=\x22\x2F" + n + "\x22") < 0; });
  var noDefault = names.filter(function (n) { var e = (n.match(/\.([a-z]+)$/) || [])[1]; return e && !/^(xml|rels)$/.test(e) && ct.indexOf("Extension=\x22" + e + "\x22") < 0; });
  ok("...every part is named in the content types, and every picture's kind", !unnamed.length && !noDefault.length, [unnamed, noDefault]);
  var missing = [];
  names.filter(function (n) { return /\.rels$/.test(n); }).forEach(function (n) {
    var base = n.replace(/_rels\x2F([^\x2F]*)\.rels$/, "$1"), dir = base.replace(/[^\x2F]*$/, "");
    (Z.text(n).match(/<Relationship [^>]*>/g) || []).forEach(function (r) {
      if (/TargetMode=\x22External\x22/.test(r)) return;
      var t = (/Target=\x22([^\x22]*)\x22/.exec(r) || [])[1], parts = (dir + t).split("\x2F"), outp = [];
      parts.forEach(function (p) { if (p === "..") outp.pop(); else if (p && p !== ".") outp.push(p); });
      if (names.indexOf(outp.join("\x2F")) < 0) missing.push(n + " -> " + t);
    });
  });
  ok("...every relationship's part is there", !missing.length, missing);
  var pres = Z.text("ppt\x2Fpresentation.xml"), th = Z.text("ppt\x2Ftheme\x2Ftheme1.xml");
  var ids = (pres.match(/<p:sldId id=\x22(\d+)\x22/g) || []).map(function (s) { return +s.replace(/\D/g, ""); });
  ok("...seven slides with ids from 256, wide (16:9), notes on the one that has them", ids.length === 7 && ids[0] === 256 && ids.every(function (v, i) { return !i || v > ids[i - 1]; }) &&
    /<p:sldSz cx=\x2212192000\x22 cy=\x226858000\x22\x2F>/.test(pres) && names.indexOf("ppt\x2FnotesSlides\x2FnotesSlide2.xml") >= 0 && names.filter(function (n) { return /notesSlide\d+\.xml$/.test(n); }).length === 1);
  ok("...the deck's colours are the file's theme: text, background and titles (a light deck: Dark 1 its text, Light 1 its background)", /<a:dk1><a:srgbClr val=\x221B2430\x22\x2F>/.test(th) && /<a:lt1><a:srgbClr val=\x22FAFAF7\x22\x2F>/.test(th) && /<a:accent1><a:srgbClr val=\x22C2410C\x22\x2F>/.test(th));
  var night = L.zip.read(P.write({ title: "", slides: [{ h: "Hi", body: "" }] }).bytes).text("ppt\x2Ftheme\x2Ftheme1.xml");
  var nightM = L.zip.read(P.write({ title: "", slides: [{ h: "Hi", body: "" }] }).bytes).text("ppt\x2FslideMasters\x2FslideMaster1.xml");
  ok("...and a deck with no theme chosen has Slides' own (Night): Dark 1 its near-black and Light 1 its white, the background mapped to Dark 1, as PowerPoint's dark themes are (the first review: a table added in PowerPoint read white on pale)",
    /<a:dk1><a:srgbClr val=\x220B0F14\x22\x2F>/.test(night) && /<a:lt1><a:srgbClr val=\x22FFFFFF\x22\x2F>/.test(night) && /<a:accent1><a:srgbClr val=\x22C2410C\x22\x2F>/.test(night) && /<p:clrMap bg1=\x22dk1\x22 tx1=\x22lt1\x22/.test(nightM));
  // every Slides theme read on its own background, through the master's colour map: text 4.5:1, titles and links 3:1
  function lum(h) { var c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function con(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  var poor = [];
  [null, { name: "Chalkboard", bg: "#143222", fg: "#f8fafc", accent: "#fbbf24" }, { name: "Paper", bg: "#fafaf7", fg: "#1b2430", accent: "#c2410c" }, { name: "Ocean", bg: "#082f49", fg: "#e0f2fe", accent: "#38bdf8" }, { name: "Sunset", bg: "#431407", fg: "#ffedd5", accent: "#fb923c" }].forEach(function (t) {
    var zz = L.zip.read(P.write({ title: "", theme: t, slides: [{ h: "Hi", body: "" }] }).bytes), thx = zz.text("ppt\x2Ftheme\x2Ftheme1.xml"), mx = zz.text("ppt\x2FslideMasters\x2FslideMaster1.xml");
    function col(n) { return (new RegExp("<a:" + n + "><a:srgbClr val=\x22([0-9A-F]{6})\x22").exec(thx) || [])[1]; }
    function map(n) { return (new RegExp(n + "=\x22([a-z0-9]+)\x22").exec(/<p:clrMap [^>]*>/.exec(mx)[0]) || [])[1]; }
    var bg = col(map("bg1")), tx = col(map("tx1")), nm = t ? t.name : "Night", want = t ? t.bg.slice(1).toUpperCase() : "0B0F14";
    if (bg !== want) poor.push(nm + ": background " + bg);
    if (con(tx, bg) < 4.5) poor.push(nm + ": text " + con(tx, bg).toFixed(1));
    if (con(col("accent1"), bg) < 3) poor.push(nm + ": titles " + con(col("accent1"), bg).toFixed(1));
    if (con(col("hlink"), bg) < 3) poor.push(nm + ": links " + con(col("hlink"), bg).toFixed(1));
    if (lum(col("dk1")) > lum(col("lt1"))) poor.push(nm + ": Dark 1 lighter than Light 1");
  });
  ok("...each of Slides' five themes: its background is the slide's, and text, titles and links read on it (through the colour map)", !poor.length, poor);
  var s3 = Z.text("ppt\x2Fslides\x2Fslide3.xml"), s5 = Z.text("ppt\x2Fslides\x2Fslide5.xml");
  ok("...a picture beside the text keeps its shape (8 by 6), and a picture alone is across the content box", /<p:pic>/.test(s3) && /<p:pic>/.test(s5) && (function () {
    var m = /<p:pic>[\s\S]*?<a:ext cx=\x22(\d+)\x22 cy=\x22(\d+)\x22/.exec(s3); return m && Math.abs(+m[1] / +m[2] - 8 / 6) < 0.01;
  })() && /<p:ph idx=\x221\x22\x2F>[\s\S]*?<a:xfrm>/.test(s3) && !/<p:ph idx=\x221\x22/.test(s5), [s3.slice(0, 600)]);
  ok("...a character XML cannot hold (a bell) is left out, and the link is the slide's own relationship", !/\x07/.test(Z.text("ppt\x2Fslides\x2Fslide7.xml")) &&
    /Target=\x22https:\x2F\x2Fwww.osha.gov\x2Fladders\x22 TargetMode=\x22External\x22/.test(Z.text("ppt\x2Fslides\x2F_rels\x2Fslide2.xml.rels")));
  var empty = P.read(P.write({ title: "Nothing", slides: [] }).bytes);
  ok("a deck with no slides is saved with one, its title", empty.slides.length === 1 && empty.slides[0].h === "Nothing");
  var odd = P.write({ title: "Odd", slides: [{ h: "A", body: "<p>text <img src=\x22" + JPEG + "\x22></p>", img: "data:image\x2Fsvg+xml;base64,PHN2Zy8+" }, { h: "B", body: "<table><tr><td><table><tr><td>in</td></tr></table></td></tr></table>" }] });
  ok("...what a save cannot keep is said: a picture inside the text, an SVG picture, a table inside a table's cell", odd.notes.length === 3 && /inside a slide.s text \(slide 1\)/.test(odd.notes.join()) &&
    /SVG, which PowerPoint does not take/.test(odd.notes.join()) && /table inside a table.s cell \(slide 2\)/.test(odd.notes.join()), odd.notes);

  // --- decks from python-pptx and LibreOffice ---------------------------------------------------------------------
  var py = P.read(u8(o, fs.readFileSync(path.join(FX, "python_pptx.pptx"))), "python_pptx.pptx");
  ok("python-pptx's deck: each slide's title and text as PowerPoint shows them (the master's bullets, levels, a link, boxes left to right, a slide titled by its short first line, a table with a row joined, a chart as a table of its numbers, a group, a numbered list from 3)",
    py.slides.length === PY.length && PY.every(function (b, i) { return py.slides[i].h === b[0] && py.slides[i].body === b[1]; }), py.slides.map(function (s, i) { return s.h === PY[i][0] && s.body === PY[i][1] ? "same" : [s.h, s.body]; }));
  ok("...the larger of two pictures kept, notes kept, the EMF picture not", py.slides[5].img && /^data:image\x2Fpng/.test(py.slides[5].img) && (function () {
    var b = Buffer.from(py.slides[5].img.split(",")[1], "base64"); return b.readUInt32BE(16) === 400 && b.readUInt32BE(20) === 300; })() && !py.slides[10].img &&
    py.slides[1].notes === "Ask who has locked out before.\nShow a lock.");
  ok("...and both pictures of slide 6 with where each sat, in the order they lie (for Slides to put them together)", py.slides[5].pics && py.slides[5].pics.length === 2 &&
    py.slides[5].pics[0].x === 457200 && py.slides[5].pics[1].x === 2743200 && py.slides[5].pics[1].w === 5486400 && /^data:image\x2Fpng/.test(py.slides[5].pics[0].url) && !py.slides[0].pics, py.slides[5].pics && py.slides[5].pics.map(function (p) { return [p.x, p.y, p.w, p.h]; }));
  var said = py.notes.join("\n");
  ok("...and what was not kept said, with the slides: the other picture, the EMF, the chart kept as a table, the hidden slide, the title taken from a first line, the layout",
    py.notes.length === 6 && /^1 more picture: .*\(slide 6\)$/m.test(said) && /^1 picture in EMF that Lantern could not draw \(slide 11\)$/m.test(said) && /^1 chart kept as a table of its numbers.*\(slide 7\)$/m.test(said) &&
    /hidden in PowerPoint.*\(slide 9\)$/m.test(said) && /short first line as its title \(slide 4\)$/m.test(said) && /^the layout/m.test(said), py.notes);
  var sm = P.read(u8(o, fs.readFileSync(path.join(FX, "smartart.pptx"))), "smartart.pptx");
  ok("a SmartArt diagram is kept as a list of its words, a point under another one level in, and that is said", sm.slides[0].h === "Lockout as a diagram" &&
    sm.slides[0].body === "<ul><li>Isolate<ul><li>Lock the breaker</li></ul></li><li>Prove dead</li></ul>" && /^1 SmartArt diagram kept as a list of its words.*\(slide 1\)$/.test(sm.notes[0]), [sm.slides[0].body, sm.notes]);
  var lo = P.read(u8(o, fs.readFileSync(path.join(FX, "lo_python.pptx"))), "lo_python.pptx");
  ok("the same deck as LibreOffice saves it: the same titles and text", lo.slides.length === PY.length && PY.every(function (b, i) { return lo.slides[i].h === b[0] && loose(lo.slides[i].body) === loose(b[1]); }) && lo.slides[1].notes === py.slides[1].notes,
    lo.slides.map(function (s, i) { return s.h === PY[i][0] && loose(s.body) === loose(PY[i][1]) ? "same" : [s.h, s.body]; }));
  var lo2 = P.read(u8(o, fs.readFileSync(path.join(FX, "lo_lantern.pptx"))), "lo_lantern.pptx");
  ok("a deck Lantern saved, opened and saved again by LibreOffice: the same titles, text, pictures and notes", lo2.slides.length === 7 && lo2.slides.every(function (s, i) { return s.h === BACK[i][0] && loose(s.body) === loose(BACK[i][1]); }) &&
    !!lo2.slides[2].img && !!lo2.slides[4].img && lo2.slides[1].notes === "Ask who has fallen.\nShow the ladder.", lo2.slides.map(function (s) { return [s.h, s.body]; }));
  function err(b, f) { try { P.read(b, f); return ""; } catch (e) { return e.message; } }
  var docx = fs.readFileSync(path.join(__dirname, "fixtures", "docx", "word_plain.docx"));
  ok("a Word file, a file that is not a zip, and a presentation with no slides are each said for what they are", /Word document \(\.docx\), not a PowerPoint/.test(err(u8(o, docx), "x.pptx")) &&
    /not a zip/.test(err(u8(o, Buffer.from("hello, not a zip at all, just text")), "x.pptx")) &&
    /no slides/.test(err(L.zip.write([{ name: "[Content_Types].xml", data: "<Types xmlns=\x22x\x22><Override PartName=\x22\x2Fppt\x2Fpresentation.xml\x22 ContentType=\x22application\x2Fvnd.openxmlformats-officedocument.presentationml.presentation.main+xml\x22\x2F><\x2FTypes>" },
      { name: "_rels\x2F.rels", data: "<Relationships xmlns=\x22http:\x2F\x2Fschemas.openxmlformats.org\x2Fpackage\x2F2006\x2Frelationships\x22><Relationship Id=\x22rId1\x22 Type=\x22http:\x2F\x2Fschemas.openxmlformats.org\x2FofficeDocument\x2F2006\x2Frelationships\x2FofficeDocument\x22 Target=\x22ppt\x2Fpresentation.xml\x22\x2F><\x2FRelationships>" },
      { name: "ppt\x2Fpresentation.xml", data: "<p:presentation xmlns:p=\x22http:\x2F\x2Fschemas.openxmlformats.org\x2Fpresentationml\x2F2006\x2Fmain\x22><p:sldIdLst\x2F><\x2Fp:presentation>" }]), "empty.pptx")),
    [err(u8(o, docx), "x.pptx")]);

  // --- in Slides, and in Chat -------------------------------------------------------------------------------------
  var got = [];
  L.download = function (name, data, mime) { got.push({ name: name, data: data, mime: mime }); };
  var saveTool = L.slideDeckTools.filter(function (t) { return t.label === "Save .pptx"; })[0], saved = 0;
  saveTool.run({ doc: DECK, save: function () { saved++; } });
  ok("Slides' Save .pptx saves the deck first, then downloads a PowerPoint file named for it", saved === 1 && got.length === 1 && got[0].name === "Ladder safety & you.pptx" &&
    /presentationml\.presentation$/.test(got[0].mime) && P.read(got[0].data).slides.length === 7, got.map(function (g) { return [g.name, g.mime]; }));
  var made = null, opened = [];
  var api = { newDeck: function (title, slides) { made = { id: "d1", title: title, slides: slides }; return made; }, col: { put: function () {} }, open: function (id) { opened.push(id); } };
  L.slidesPptx.open(new w.File([fs.readFileSync(path.join(FX, "python_pptx.pptx"))], "Pump course.pptx"), api);
  for (var i = 0; i < 40 && !made; i++) await sleep(25);
  var dlg = o.d.querySelector(".guide-overlay[aria-label=\x22PowerPoint file\x22]");
  ok("Open .pptx makes a new deck of the file: its title, its slides with their notes and picture", made && made.title === "Pump course" && made.slides.length === 11 && made.slides[0].h === "Pump station basics" &&
    made.slides[1].notes && !!made.slides[5].img, made && [made.title, made.slides.length]);
  ok("...and says what it could not keep, slide by slide", dlg && /Opened from the PowerPoint file “Pump course\.pptx” \(11 slides\)/.test(dlg.textContent) && dlg.querySelectorAll("li").length === 6, dlg && dlg.textContent.slice(0, 300));
  if (dlg) dlg.parentNode.removeChild(dlg);
  var bad = null;
  w.alert = function (m) { bad = m; };
  L.slidesPptx.open(new w.File([docx], "letter.docx"), api);
  for (i = 0; i < 40 && !bad; i++) await sleep(25);
  ok("...a Word file given to Open .pptx is refused, saying what it is", bad && /could not open “letter\.docx”: this is a Word document/.test(bad), bad);
  var act = L.aiActions.filter(function (a) { return a.id === "slides"; })[0];
  var view = L.aiAct.build("MAKE SLIDES: Ladder safety\n# Ladder safety\nA short talk.\n# Before you climb\n- Check the feet\n- Three points of contact\nEND", "Make a short presentation on ladder safety");
  var ex = view && (view.extra || []).filter(function (e) { return e.label === "Save .pptx"; })[0];
  got = [];
  if (ex) ex.run();
  ok("Chat's MAKE SLIDES offers Save .pptx: the deck as a PowerPoint file at once", act && /Save \.pptx/.test(act.also) && ex && got.length === 1 && got[0].name === "Ladder safety.pptx" &&
    P.read(got[0].data).slides[1].body === "<ul><li>Check the feet</li><li>Three points of contact</li></ul>", got.map(function (g) { return g.name; }));
  ok("Slides' guide says how (Save .pptx, Open .pptx, what is not kept)", /PowerPoint files \(\.pptx\)/.test(JSON.stringify(L.guide.get("slides"))) && /Open \.pptx/.test(JSON.stringify(L.guide.get("slides"))));
  ok("no errors on the way", o.errs.length === 0, o.errs);
  console.log(fails ? fails + " PPTX FAILURES (" + passes + " passed)" : "ALL PPTX CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL " + (e && e.stack || e)); process.exit(1); });
