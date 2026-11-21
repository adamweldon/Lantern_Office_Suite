// cases_write.js -- review 1 of 1.24.33: decks as Lantern's Slides editor (contenteditable) and Chat make them, saved by
// Lantern.pptx.write. For each saved file: every part valid against the ISO/IEC 29500 schemas, python-pptx finds each
// title in its title box, LibreOffice makes a page a slide (check_saved.py, in one batch), Lantern reads back the same
// titles, words and notes, and nothing typed vanishes without a word. Then what a person in PowerPoint would see:
// text that runs off the slide, tables PowerPoint must repair, pictures squashed, colours.
"use strict";
var fs = require("fs"), path = require("path"), os = require("os");
var cases = [];
var zlib = require("zlib");
// png(w, h): a solid PNG, as a data URL
function crc(buf) { var c, t = []; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (var i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function png(w, h, rgb) {
  rgb = rgb || [200, 60, 40];
  var raw = Buffer.alloc((w * 3 + 1) * h);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = rgb[0]; raw[i + 1] = rgb[1]; raw[i + 2] = rgb[2]; }
  function chunk(t, d) { var b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d])), 8 + d.length); return b; }
  var ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return "data:image/png;base64," + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}
// the 8 by 6 JPEG tests/pptx.js uses, a 1x1 GIF, WebP and SVG
var JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAGAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
var GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
var WEBP = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
var SVG = "data:image/svg+xml;base64," + Buffer.from("<svg xmlns=\x22http://www.w3.org/2000/svg\x22 width=\x2240\x22 height=\x2230\x22><rect width=\x2240\x22 height=\x2230\x22 fill=\x22red\x22/></svg>").toString("base64");
var THEMES = { night: null, chalkboard: { name: "Chalkboard", bg: "#143222", fg: "#f8fafc", accent: "#fbbf24" }, paper: { name: "Paper", bg: "#fafaf7", fg: "#1b2430", accent: "#c2410c" },
  ocean: { name: "Ocean", bg: "#082f49", fg: "#e0f2fe", accent: "#38bdf8" }, sunset: { name: "Sunset", bg: "#431407", fg: "#ffedd5", accent: "#fb923c" } };
function li(n, f) { var s = ""; for (var i = 1; i <= n; i++) s += "<li>" + f(i) + "</li>"; return s; }
var LONG = "When the pump trips, do not reset it straight away. Walk to the panel, read the fault light, and write down what it says before you touch anything. " +
  "A thermal trip means the motor got too hot: wait twenty minutes, then check the impeller for rags. A level fault means a float is stuck: lift it gently and watch the light. " +
  "If the same fault comes back twice in an hour, lock the pump out, hang your tag, and call the on-call fitter with what you wrote down. " +
  "Never bypass a float with a jumper to keep the station running; the high-level alarm is the only thing between the wet well and a flooded street. " +
  "Log every trip in the station book, with the time, the fault and what you did, so the next shift can see a pattern before it becomes a failure.";

// the decks: [id, input (what it is), deck]
var D = [
  ["typical", "Title and three bullets, with notes (as the editor makes them)", { title: "Ladder checks", slides: [{ h: "Ladder checks", body: "<ul><li>Feet</li><li>Rungs</li><li>Locks</li></ul>", notes: "Ask who has fallen.\nShow the ladder." }] }],
  ["divs", "lines typed with Enter in the editor: a bare first line, <div> lines, an empty <div><br></div>", { title: "Divs", slides: [{ h: "Before you dig", body: "Call the utility first<div>Mark the line</div><div><br></div><div>Dig by hand near it</div>" }] }],
  ["br", "a point with a line break (<br>) and a trailing <br>", { title: "Br", slides: [{ h: "Line breaks", body: "<ul><li>Gloves<br>and goggles</li><li>Boots<br></li></ul>" }] }],
  ["looks", "bold, italic, underline, <strong>/<em>, a <font color>, a <span style> bold and italic", { title: "Looks", slides: [{ h: "Looks", body: "<p><b>Bold</b> <i>italic</i> <u>under</u> <strong>strong</strong> <em>em</em> <font color=\x22#ff0000\x22>red word</font> <span style=\x22font-weight: bold\x22>sb</span> <span style=\x22font-style: italic\x22>si</span></p>" }] }],
  ["nested", "a list indented in Chrome: <ul><ul> nested without <li>", { title: "Nested", slides: [{ h: "Levels", body: "<ul><li>Top</li><ul><li>Second</li><ul><li>Third</li></ul></ul><li>Top again</li></ul>" }] }],
  ["ol-start", "<ol start=3>, and a numbered list nested in a bullet", { title: "Ol", slides: [{ h: "Steps 3 and 4", body: "<ol start=\x223\x22><li>Three</li><li>Four</li></ol><ul><li>Bullet<ol><li>one</li><li>two</li></ol></li></ul>" }] }],
  ["entities", "entities: &amp; &lt; &gt; &quot; &#8364; &nbsp; and the title with < & >", { title: "Ent", slides: [{ h: "Fish & chips <hot>", body: "<p>Fish &amp; chips &lt;b&gt; &quot;q&quot; &#8364;5&nbsp;each</p>" }] }],
  ["empty-paras", "a body of empty paragraphs only (<p></p><p> </p><div><br></div>)", { title: "Empty", slides: [{ h: "Nothing under me", body: "<p></p><p> </p><div><br></div>" }] }],
  ["long-para", "one paragraph of about 750 characters", { title: "Long", slides: [{ h: "When the pump trips", body: "<p>" + LONG + "</p>" }] }],
  ["fifteen", "15 bullets", { title: "Fifteen", slides: [{ h: "Pre-start checklist", body: "<ul>" + li(15, function (i) { return "Check item number " + i + " on the sheet"; }) + "</ul>" }] }],
  ["twelve", "12 short bullets", { title: "Twelve", slides: [{ h: "Twelve points", body: "<ul>" + li(12, function (i) { return "Point " + i; }) + "</ul>" }] }],
  ["pic-text", "seven bullets of a sentence each beside a photo", { title: "Pic text", slides: [{ h: "Climbing a ladder", body: "<ul>" + ["Keep three points of contact when climbing the ladder", "Face the ladder going up and going down again", "Carry tools on a belt, never in your hands",
    "Do not lean out further than the side rails allow", "Have someone foot the ladder on soft or sloping ground", "Tie the ladder off at the top before you start work", "Come down at once if the weather turns windy"].map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>", img: JPEG }] }],
  ["emoji", "emoji in the deck title, slide title and points", { title: "Safety \u2705", slides: [{ h: "PPE \ud83e\uddba\u2705", body: "<ul><li>\ud83d\udd25 Hot work</li><li>\u26a0\ufe0f Wet floor</li></ul>" }] }],
  ["surrogate", "a broken emoji (a lone surrogate, as a cut string leaves it)", { title: "S", slides: [{ h: "Cut \ud83d", body: "<p>Half \ude00 of an emoji</p>" }] }],
  ["rtl", "an Arabic title and points", { title: "RTL", slides: [{ h: "\u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0623\u0648\u0644\u0627\u064b", body: "<ul><li>\u0627\u0631\u062a\u062f\u0650 \u0627\u0644\u062e\u0648\u0630\u0629</li></ul>" }] }],
  ["cjk", "a Chinese title, Japanese points", { title: "CJK", slides: [{ h: "\u5b89\u5168\u7b2c\u4e00", body: "<ul><li>\u30d8\u30eb\u30e1\u30c3\u30c8\u3092\u7740\u7528</li></ul>" }] }],
  ["table", "a line, then a table with a header row", { title: "Table", slides: [{ h: "Ladder ratings", body: "<p>Ratings:</p><table><tr><th>Type</th><th>Load</th></tr><tr><td>I</td><td>250 lb</td></tr><tr><td>IA</td><td>300 lb</td></tr></table>" }] }],
  ["table-span", "a table with a cell joined across and one joined down", { title: "Span", slides: [{ h: "Rota", body: "<table><tr><th>Day</th><th>Early</th><th>Late</th></tr><tr><td>Mon</td><td rowspan=\x222\x22>Anna</td><td>Ben</td></tr><tr><td>Tue</td><td>Cara</td></tr><tr><td>Wed</td><td colspan=\x222\x22>Dev</td></tr></table>" }] }],
  ["table-rowspan-over", "a table whose first cell says rowspan=3 in a table of 2 rows (a row deleted in an editor; browsers draw it as 2)", { title: "R", slides: [{ h: "Rowspan past the end", body: "<table><tr><td rowspan=\x223\x22>Valve</td><td>Open</td></tr><tr><td>Closed</td></tr></table>" }] }],
  ["table-thead", "a table with <thead>, <tbody> and a <caption>", { title: "Thead", slides: [{ h: "Torque", body: "<table><caption>Dry threads only</caption><thead><tr><th>Bolt</th><th>Nm</th></tr></thead><tbody><tr><td>M8</td><td>25</td></tr></tbody></table>" }] }],
  ["table-30", "a table of 30 rows", { title: "Big", slides: [{ h: "Spare parts", body: "<table><tr><th>Part</th><th>Bin</th></tr>" + Array.apply(null, Array(29)).map(function (_, i) { return "<tr><td>Part " + (i + 1) + "</td><td>B" + (i + 1) + "</td></tr>"; }).join("") + "</table>" }] }],
  ["table-nested", "a table inside a table's cell", { title: "Nest", slides: [{ h: "Nested table", body: "<table><tr><td>Outer<table><tr><td>Inner</td></tr></table></td></tr></table>" }] }],
  ["table-in-li", "a table inside a list item, a point after it", { title: "Tli", slides: [{ h: "Table in a point", body: "<ul><li>Before<table><tr><td>cell</td></tr></table></li><li>After</li></ul>" }] }],
  ["text-tables", "text, two tables and a picture on one slide", { title: "Mix", slides: [{ h: "Everything", body: "<p>Two tables:</p><table><tr><td>a</td><td>b</td></tr></table><table><tr><td>c</td><td>d</td></tr></table>", img: JPEG }] }],
  ["pic-png", "a slide whose picture is a PNG, no text", { title: "Png", slides: [{ h: "Panel", body: "", img: png(160, 40) }] }],
  ["pic-tall", "a tall PNG (30 by 120) beside a point", { title: "Tall", slides: [{ h: "Tall", body: "<ul><li>Beside a tall picture</li></ul>", img: png(30, 120) }] }],
  ["pic-gif", "a GIF picture", { title: "Gif", slides: [{ h: "Gif", body: "<p>x</p>", img: GIF }] }],
  ["pic-webp-svg", "WebP and SVG pictures", { title: "WS", slides: [{ h: "WebP", body: "<p>a</p>", img: WEBP }, { h: "SVG", body: "", img: SVG }] }],
  ["pic-bad", "a damaged data URL and a web address as pictures", { title: "Bad", slides: [{ h: "Damaged", body: "", img: "data:image/png;base64,!!!!" }, { h: "Web", body: "", img: "https://example.org/a.png" }] }],
  ["pic-inline", "a picture inside the text (<img> in the body)", { title: "Inline", slides: [{ h: "Inline", body: "<p>Look: <img src=\x22" + JPEG + "\x22> here</p>" }] }],
  ["notes-blank", "notes with CRLF, a blank line and a trailing newline", { title: "N", slides: [{ h: "Notes", body: "<p>x</p>", notes: "Line one\r\nLine two\n\nAfter a blank line\n" }] }],
  ["notes-only", "a slide with only notes (no title, no text)", { title: "NO", slides: [{ h: "", body: "", notes: "Talk over a black slide." }] }],
  ["no-title", "a slide with text and no title", { title: "NT", slides: [{ h: "", body: "<p>A line with no title above it</p>" }] }],
  ["title-only", "a slide with a title and no text", { title: "TO", slides: [{ h: "Section two", body: "" }] }],
  ["long-title", "a title of 150 characters", { title: "LT", slides: [{ h: "What every operator must check before starting the pump station after a power cut, after a flood alarm, or after the fitter has worked on it", body: "<p>x</p>" }] }],
  ["headings", "headings <h2>/<h3> between points", { title: "H", slides: [{ h: "Parts", body: "<h2>Part A</h2><ul><li>x</li></ul><h3>Part B</h3><p>y</p>" }] }],
  ["pre", "a <pre> of three lines of code", { title: "Code", slides: [{ h: "Blink", body: "<pre>void setup() {\n  pinMode(13, OUTPUT);\n}</pre>" }] }],
  ["li-p", "a numbered list whose first item holds two paragraphs", { title: "LiP", slides: [{ h: "Two steps", body: "<ol><li><p>Isolate</p><p>at the breaker</p></li><li>Prove dead</li></ol>" }] }],
  ["links", "a web link, a mail link, a link with & in it, a javascript: link", { title: "Links", slides: [{ h: "Links", body: "<p><a href=\x22https://www.hse.gov.uk/\x22>HSE</a> <a href=\x22mailto:a@example.org\x22>mail</a> <a href=\x22https://example.org/?a=1&amp;b=2\x22>amp</a> <a href=\x22javascript:alert(1)\x22>js</a></p>" }] }],
  ["link-space", "a link whose address has a space in it (pasted from a file share)", { title: "LS", slides: [{ h: "Manual", body: "<p><a href=\x22https://example.org/my manual.pdf\x22>the manual</a></p>" }] }],
  ["control", "a title and text with control characters (a bell, a vertical tab from Word)", { title: "C", slides: [{ h: "Bell\u0007 here", body: "<p>Pump 1\u000bPump 2</p>" }] }],
  ["one", "a deck of one slide, a title only", { title: "One", slides: [{ h: "Only slide", body: "" }] }],
  ["none", "a deck with no slides", { title: "Nothing yet", slides: [] }],
  ["eighty", "a deck of 80 slides, each with three points and notes", { title: "Eighty", slides: Array.apply(null, Array(80)).map(function (_, i) { return { h: "Slide " + (i + 1), body: "<ul><li>a" + i + "</li><li>b" + i + "</li><li>c" + i + "</li></ul>", notes: "Note " + (i + 1) }; }) }]
];
Object.keys(THEMES).forEach(function (k) { D.push(["theme-" + k, "a slide with a title, points, a link and a table in the " + k + " theme", { title: "Theme " + k, theme: THEMES[k] || undefined,
  slides: [{ h: "Theme " + k, body: "<ul><li>Point <a href=\x22https://example.org\x22>with a link</a></li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>" }] }]); });

// ---- the batch: every deck saved, read back, and checked by python and LibreOffice at once -------------------------------
cases.prepare = function (x) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx_rv1_")), P = x.L.pptx;
  x.saved = {};
  D.forEach(function (d) {
    var s = x.saved[d[0]] = { deck: d[2], input: d[1] };
    try { var w = P.write(d[2]); s.bytes = Buffer.from(w.bytes); s.notes = w.notes; fs.writeFileSync(path.join(dir, d[0] + ".pptx"), s.bytes); }
    catch (e) { s.error = "the save threw: " + e.message; return; }
    try { s.back = P.read(w.bytes, d[0] + ".pptx"); } catch (e) { s.backError = e.message; }
    s.zip = x.L.zip.read(w.bytes);
  });
  x.savedDir = dir;
  x.checked = null;
  if (!x.which("python3")) { x.checkedWhy = "python3 is missing"; return Promise.resolve(); }
  try { x.checked = JSON.parse(x.py("check_saved.py", [dir].concat(x.which("soffice") || x.which("libreoffice") ? ["--lo"] : []))); }
  catch (e) { x.checkedWhy = "check_saved.py failed: " + String(e.message).slice(0, 200); }
  return Promise.resolve();
};

function sv(x, id) { var s = x.saved[id]; if (!s) throw new Error("no deck " + id); if (s.error) throw new Error(s.error); return s; }
function W(id, harm, deckId, right, check) {
  cases.push({ id: id, harm: harm, input: (x0(deckId) || {}).input || deckId, right: right, run: function (x) {
    try { return Promise.resolve(check(sv(x, deckId), x) || ""); } catch (e) { return Promise.resolve(e.message); }
  } });
}
function x0(id) { for (var i = 0; i < D.length; i++) if (D[i][0] === id) return { input: D[i][1] }; return null; }
function titlesOf(deck) { return (deck.slides.length ? deck.slides : [{ h: deck.title || "" }]).map(function (s) { return fix(s.h).replace(/\s+/g, " ").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim(); }); }
// a lone surrogate (half an emoji) is written as U+FFFD, as UTF-8 must
function fix(t) { return String(t || "").replace(/[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/g, function (m, a) { return (a || "") + "\ufffd"; }); }
function words(t) { return fix(t).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ").split(/[\s\u00a0]+/).filter(Boolean); }
// the words of a body's HTML, as a person reads them in the editor (a picture is not words)
function htmlWords(x, html) { return words(x.plain(html)); }
// every word typed, somewhere in the saved slide's XML text (a:t) or said in the save's notes
function slideText(s, n) { var t = s.zip.text("ppt/slides/slide" + n + ".xml") || ""; return (t.match(/<a:t>[^<]*<\x2Fa:t>/g) || []).map(function (m) { return m.slice(5, -6).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\x22").replace(/&amp;/g, "&"); }).join(" "); }
function lost(x, s) {
  var out = [];
  s.deck.slides.forEach(function (sl, i) {
    var have = words(slideText(s, i + 1)), bag = {};
    have.forEach(function (w) { bag[w] = (bag[w] || 0) + 1; });
    words(sl.h).concat(htmlWords(x, sl.body)).forEach(function (w) { if (bag[w]) bag[w]--; else out.push("slide " + (i + 1) + ": " + JSON.stringify(w)); });
  });
  return out;
}
// opens(): the three programs' verdicts on the saved file
function opens(id, harm) {
  W("w-" + id + "-opens", harm, id, "The saved file is valid in every part (ISO/IEC 29500 schemas), python-pptx finds each slide's title in its title box, and LibreOffice opens it as a page a slide.", function (s, x) {
    if (!x.checked) return "SKIP " + (x.checkedWhy || "no checks");
    var c = x.checked.files[id + ".pptx"], h = x.checked.have, want = titlesOf(s.deck), out = [];
    if (!c) return "the saved file was not checked";
    if (h.schemas && c.schema && c.schema.length) out.push("invalid: " + c.schema.slice(0, 2).join("; "));
    if (h.pptx && JSON.stringify(c.titles) !== JSON.stringify(want)) out.push("python-pptx titles " + JSON.stringify(c.titles).slice(0, 200) + " not " + JSON.stringify(want).slice(0, 200));
    if (h.lo && c.pages !== want.length) out.push("LibreOffice made " + c.pages + " pages for " + want.length + " slides");
    if (out.length) return out.join("; ");
    return h.schemas && h.pptx && h.lo ? "" : "SKIP " + ["schemas", "pptx", "lo"].filter(function (k) { return !h[k]; }).join(", ") + " missing (the rest agreed)";
  });
}
// back(): Lantern reads its own file back: the same titles and words, the notes, the picture
function back(id, harm, extra, opt) {
  W("w-" + id + "-back", harm, id, "Read back by Lantern: the same titles, every word, the same notes, a picture where there was one (that PowerPoint takes); nothing typed is gone without a word.", function (s, x) {
    if (s.backError) return "Lantern cannot read its own file: " + s.backError;
    var want = titlesOf(s.deck), got = s.back.slides.map(function (z) { return z.h; }), out = [];
    if (JSON.stringify(got) !== JSON.stringify(want) && !(opt && opt.titles === false)) out.push("titles " + JSON.stringify(got).slice(0, 160));
    var l = lost(x, s);
    if (l.length && !s.notes.length && !(opt && opt.words === false)) out.push("words gone without a word said: " + l.slice(0, 5).join(", "));
    s.deck.slides.forEach(function (sl, i) {
      var b = s.back.slides[i] || {};
      var wn = String(sl.notes || "").replace(/\r\n?/g, "\n").split("\n").filter(function (t) { return t.trim(); }).join("\n");
      if ((b.notes || "") !== wn) out.push("slide " + (i + 1) + " notes " + JSON.stringify(b.notes));
      var picOk = sl.img && /^data:image\x2F(png|jpe?g|gif|bmp);base64,[A-Za-z0-9+\x2F=]+$/i.test(sl.img);
      if (!!b.img !== !!picOk) out.push("slide " + (i + 1) + (b.img ? " gained" : " lost") + " its picture");
    });
    if (extra) { var m = extra(s, x); if (m) out.push(m); }
    return out.join("; ");
  });
}
D.forEach(function (d) { opens(d[0], /^(typical|divs|nested|table|table-span|pic-text|eighty|links)$/.test(d[0]) ? "high" : "medium"); });
// (the caption and the title of a slide with no title are their own cases below: not counted twice)
D.forEach(function (d) { if (!/^(eighty|none)$/.test(d[0])) back(d[0], /^(typical|divs|nested|ol-start|table|table-span|br|looks|fifteen|pic-text)$/.test(d[0]) ? "high" : "medium", null,
  d[0] === "table-thead" ? { words: false } : d[0] === "no-title" ? { titles: false } : null); });

// ---- what a person sees in PowerPoint ---------------------------------------------------------------------------------
// fit(s, n) -> how many times the content box's height its text needs at the size it is written in (PowerPoint draws
// normAutofit at its stored fontScale, 100% when none is stored, until the text is edited). Georgia's characters
// average about half an em; a line is 1.2 em; each paragraph after the first has the master's space before (10 pt
// at level 1, 5 pt below).
function fit(s, n) {
  var xml = s.zip.text("ppt/slides/slide" + n + ".xml"), m = /<p:sp>(?:(?!<\x2Fp:sp>).)*?<p:ph idx=\x221\x22\x2F>(?:(?!<\x2Fp:sp>)[\s\S])*<\x2Fp:sp>/.exec(xml);
  if (!m) return 0;
  var sp = m[0], ext = /<a:ext cx=\x22(\d+)\x22 cy=\x22(\d+)\x22/.exec(sp), cx = ext ? +ext[1] : 10515600, cy = ext ? +ext[2] : 4351338;
  var fs = /fontScale=\x22(\d+)\x22/.exec(sp), scale = fs ? +fs[1] / 100000 : 1, SZ = [24, 20, 18, 16, 16, 16, 16, 16, 16], h = 0;
  (sp.match(/<a:p>[\s\S]*?<\x2Fa:p>/g) || []).forEach(function (p, i) {
    var lvl = +((/lvl=\x22(\d)\x22/.exec(p) || [0, 0])[1]), sz = SZ[lvl] * scale, num = /buAutoNum/.test(p), plain = /buNone/.test(p);
    var marL = plain ? 0 : num ? 457200 * (lvl + 1) : 228600 + 457200 * lvl, usable = (cx - 182880 - marL) / 12700;
    var chars = (p.match(/<a:t>([^<]*)<\x2Fa:t>/g) || []).join("").replace(/<[^>]*>/g, "").length, brs = (p.match(/<a:br>/g) || []).length;
    h += (Math.max(1, Math.ceil(chars * 0.48 * sz / usable)) + brs) * sz * 1.2 + (i ? (lvl ? 5 : 10) : 0);
  });
  return h / ((cy - 91440) / 12700);
}
function fits(id, harm, right) {
  W("w-" + id + "-fits", harm, id, right, function (s) {
    var f = fit(s, 1);
    if (f <= 1.1) return "";
    if (s.notes.some(function (t) { return /fit|too much|shrink|split/i.test(t); })) return "";
    return "the text needs " + f.toFixed(1) + " times its box's height at the size it is saved in (no fontScale stored), so PowerPoint draws it running off the slide until someone edits it; the save said nothing";
  });
}
fits("fifteen", "high", "15 bullets do not fit at 24 pt: the file stores the size that fits (normAutofit fontScale and lnSpcReduction, which PowerPoint draws as stored), or the save says the slide holds too much. PowerPoint only shrinks on its own when the text is edited.");
fits("long-para", "high", "A paragraph too long for the box at 24 pt: stored shrunk to fit, or said.");
fits("pic-text", "high", "Seven sentence-long points beside a photo (the text box is 56% wide): stored shrunk to fit, or said.");
fits("twelve", "medium", "Twelve one-word points: they need more than the box at 24 pt; stored shrunk, or said.");
fits("typical", "low", "Three points fit; nothing said.");
W("w-long-title-fits", "medium", "long-title", "A title of four lines does not fit its box at 40 pt; the box grows upward (anchored at its foot), so the first line goes off the top of the slide in PowerPoint and LibreOffice. The file stores it shrunk to fit, or the save says the title is too long.",
  function (s) {
    var xml = s.zip.text("ppt/slides/slide1.xml"), t = /<p:ph type=\x22title\x22\x2F>[\s\S]*?<\x2Fp:sp>/.exec(xml)[0], fs = /fontScale=\x22(\d+)\x22/.exec(t), scale = fs ? +fs[1] / 100000 : 1;
    var chars = (t.match(/<a:t>([^<]*)<\x2Fa:t>/g) || []).join("").replace(/<[^>]*>/g, "").length, sz = 40 * scale, lines = Math.ceil(chars * 0.48 * sz / ((10515600 - 182880) / 12700));
    var over = lines * sz * 1.2 * 0.9 - (1325563 - 91440) / 12700 - 365125 / 12700;
    if (over <= 0 || s.notes.some(function (n) { return /title/i.test(n); })) return "";
    return "the title needs " + lines + " lines at " + sz + " pt: about " + Math.round(over) + " pt of it above the slide's top edge, and nothing said";
  });
W("w-table-30-said", "medium", "table-30", "A 30-row table does not fit the slide: the save says so.", function (s) { return s.notes.some(function (t) { return /fit/.test(t); }) ? "" : "said nothing: " + JSON.stringify(s.notes); });
W("w-rowspan-over-consistent", "medium", "table-rowspan-over",
  "The saved table joins cells only over rows it has (rowSpan 2, as the browser draws it). A rowSpan running past the last row is a table PowerPoint must repair (not sure of every version), and LibreOffice draws it broken (an empty filled cell).",
  function (s) {
    var xml = s.zip.text("ppt/slides/slide1.xml"), rows = (xml.match(/<a:tr /g) || []).length, m = /rowSpan=\x22(\d+)\x22/.exec(xml);
    return m && +m[1] > rows ? "wrote rowSpan=\x22" + m[1] + "\x22 in a table of " + rows + " rows" : "";
  });
W("w-caption-kept", "low", "table-thead", "The table's caption (\u201cDry threads only\u201d) is kept, or said: it is the rule the numbers depend on.",
  function (s) { return /Dry threads only/.test(slideText(s, 1)) || s.notes.some(function (t) { return /caption/i.test(t); }) ? "" : "the caption vanished without a word"; });
W("w-pre-lines", "low", "pre", "The code's three lines stay three lines (line breaks), not one run-on line.", function (s) { var x = s.zip.text("ppt/slides/slide1.xml"); return /setup\(\) \{<\x2Fa:t><\x2Fa:r><a:br|<a:br[^>]*>[\s\S]*pinMode/.test(x) || (x.match(/<a:p>/g) || []).length >= 4 ? "" : "joined into one line: " + slideText(s, 1); });
W("w-no-title-roundtrip", "medium", "no-title", "A slide with text and no title comes back as it was: no title, the line as text. (The title box is there, empty: it is not a slide with no title box.)",
  function (s) { var b = s.back.slides[0]; return b.h === "" ? "" : "came back with its text as the title: h=" + JSON.stringify(b.h) + ", body=" + JSON.stringify(b.body) + "; said " + JSON.stringify(s.back.notes.filter(function (t) { return /title/.test(t); })); });
W("w-li-p-indent", "low", "li-p", "Step 1's second paragraph sits under step 1's words (indented with them), and Prove dead is step 2. LibreOffice draws the second paragraph out at the left margin, left of the number; whether PowerPoint then numbers Prove dead 2 or 1 again is not sure: low.",
  function (s) {
    var x = s.zip.text("ppt/slides/slide1.xml"), mid = (x.match(/<a:p>[\s\S]*?<\x2Fa:p>/g) || []).filter(function (p) { return /at the breaker/.test(p); })[0] || "";
    return /marL=\x220\x22/.test(mid) ? "the second paragraph is written at marL 0, out at the margin, left of its step's number" : "";
  });
W("w-link-space", "low", "link-space", "The link's address is written as a valid URI (the space as %20, as browsers send it). Not sure PowerPoint refuses a raw space: low.",
  function (s) { var r = s.zip.text("ppt/slides/_rels/slide1.xml.rels"); return / Target=\x22[^\x22]* [^\x22]*\x22/.test(r) ? "wrote Target with a raw space: " + (r.match(/Target=\x22https[^\x22]*\x22/) || [""])[0] : ""; });
W("w-js-link", "medium", "links", "A javascript: link is not saved as a link (its words are).", function (s) { var r = s.zip.text("ppt/slides/_rels/slide1.xml.rels"); return /javascript:/i.test(r) ? "saved the javascript: link" : ""; });
W("w-links-kept", "medium", "links", "The web, mail and & links are hyperlinks in the file.", function (s) { var r = s.zip.text("ppt/slides/_rels/slide1.xml.rels"); return /hse\.gov\.uk/.test(r) && /mailto:a@example\.org/.test(r) && /a=1&amp;b=2/.test(r) ? "" : r.slice(0, 400); });
W("w-surrogate-utf8", "medium", "surrogate", "Every part is valid UTF-8 (a lone surrogate written as U+FFFD or left out): PowerPoint refuses a part that is not.",
  function (s) { var bad = s.zip.names.filter(function (n) { if (!/\.(xml|rels)$/.test(n)) return false; try { new (require("util").TextDecoder)("utf-8", { fatal: true }).decode(Buffer.from(s.zip.bytes(n))); return false; } catch (e) { return true; } }); return bad.length ? "not UTF-8: " + bad.join(", ") : ""; });
W("w-control-words", "medium", "control", "A vertical tab between two words (Word's line break) leaves them apart, not run together.", function (s) { return /Pump 1Pump 2/.test(slideText(s, 1)) ? "ran the words together: Pump 1Pump 2" : ""; });
W("w-none-one-slide", "medium", "none", "A deck with no slides is saved with one slide, its title the deck's.", function (s) { return s.back.slides.length === 1 && s.back.slides[0].h === "Nothing yet" ? "" : JSON.stringify(s.back.slides); });
W("w-eighty-back", "high", "eighty", "80 slides back, each with its title, three points and notes.",
  function (s) { var b = s.back.slides; if (b.length !== 80) return b.length + " slides"; for (var i = 0; i < 80; i++) if (b[i].h !== "Slide " + (i + 1) || (b[i].body.match(/<li>/g) || []).length !== 3 || b[i].notes !== "Note " + (i + 1)) return "slide " + (i + 1) + ": " + JSON.stringify(b[i]); return ""; });
W("w-notes-blank-back", "low", "notes-blank", "Notes keep their blank line when read back (the file has it; the reader drops it).", function (s) { var n = s.back.slides[0].notes; return n === "Line one\nLine two\n\nAfter a blank line" ? "" : "read back as " + JSON.stringify(n); });
W("w-said-pictures", "medium", "pic-webp-svg", "The WebP and SVG pictures not saved are said, with their slides.", function (s) { var t = s.notes.join("\n"); return /slide 1/.test(t) && /slide 2/.test(t) && /WEBP/i.test(t) && /SVG/.test(t) ? "" : JSON.stringify(s.notes); });
W("w-said-bad-pictures", "medium", "pic-bad", "The damaged picture and the web picture are said.", function (s) { return s.notes.length === 2 ? "" : JSON.stringify(s.notes); });
W("w-said-inline", "medium", "pic-inline", "The picture inside the text is said; the words around it kept.", function (s) { return /inside a slide/.test(s.notes.join()) && /Look:/.test(slideText(s, 1)) && /here/.test(slideText(s, 1)) ? "" : JSON.stringify(s.notes); });
W("w-said-nested", "medium", "table-nested", "The table inside a cell is said; its words kept or said.", function (s) { return /table inside a table/.test(s.notes.join()) ? "" : JSON.stringify(s.notes); });
W("w-table-in-li-order", "low", "table-in-li", "The table stays between Before and After, where it was typed.", function (s) { var t = slideText(s, 1); return t.indexOf("cell") < t.indexOf("After") ? "" : "moved after the list: " + t; });
// pictures: their shape kept
function aspect(id, n, wpx, hpx) {
  W("w-" + id + "-aspect", "high", id, "The picture keeps its shape (" + wpx + " by " + hpx + "), not squashed.", function (s) {
    var xml = s.zip.text("ppt/slides/slide" + n + ".xml"), m = /<p:pic>[\s\S]*?<a:ext cx=\x22(\d+)\x22 cy=\x22(\d+)\x22/.exec(xml);
    if (!m) return "no picture saved";
    var r = +m[1] / +m[2];
    return Math.abs(r - wpx / hpx) / (wpx / hpx) < 0.02 ? "" : "drawn " + (r).toFixed(2) + ":1, not " + (wpx / hpx).toFixed(2) + ":1";
  });
}
aspect("pic-png", 1, 160, 40); aspect("pic-tall", 1, 30, 120); aspect("pic-text", 1, 8, 6); aspect("pic-gif", 1, 1, 1);
W("w-pic-on-slide", "high", "pic-tall", "The picture lies inside the slide (16:9, 12192000 by 6858000).", function (s) {
  var m = /<p:pic>[\s\S]*?<a:off x=\x22(\d+)\x22 y=\x22(\d+)\x22\x2F><a:ext cx=\x22(\d+)\x22 cy=\x22(\d+)\x22/.exec(s.zip.text("ppt/slides/slide1.xml"));
  return m && +m[1] + +m[3] <= 12192000 && +m[2] + +m[4] <= 6858000 ? "" : "off the slide: " + (m && m.slice(1).join(","));
});
W("w-pic-text-apart", "high", "pic-text", "The picture beside the text does not cover it.", function (s) {
  var xml = s.zip.text("ppt/slides/slide1.xml"), p = /<p:pic>[\s\S]*?<a:off x=\x22(\d+)\x22/.exec(xml), t = /<p:ph idx=\x221\x22\x2F>[\s\S]*?<a:off x=\x22(\d+)\x22 y=\x22\d+\x22\x2F><a:ext cx=\x22(\d+)\x22/.exec(xml);
  return p && t && +t[1] + +t[2] <= +p[1] ? "" : "they overlap";
});
// colours: the theme, and text a person can read on it
function lum(h) { var c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
Object.keys(THEMES).forEach(function (k) {
  W("w-theme-" + k + "-readable", "high", "theme-" + k, "Text, titles and links read on the background: text at 4.5:1 or more, titles and links at 3:1 or more (WCAG); table lines and text in the text colour.", function (s) {
    var th = s.zip.text("ppt/theme/theme1.xml"), get = function (n) { var m = new RegExp("<a:" + n + "><a:srgbClr val=\x22([0-9A-F]{6})\x22").exec(th); return m && m[1]; };
    var bg = get("lt1"), fg = get("dk1"), ac = get("accent1"), hl = get("hlink"), out = [];
    if (contrast(fg, bg) < 4.5) out.push("text " + contrast(fg, bg).toFixed(1) + ":1");
    if (contrast(ac, bg) < 3) out.push("titles " + contrast(ac, bg).toFixed(1) + ":1");
    if (contrast(hl, bg) < 3) out.push("links " + contrast(hl, bg).toFixed(1) + ":1");
    var t = THEMES[k]; if (t && (bg !== t.bg.slice(1).toUpperCase() || fg !== t.fg.slice(1).toUpperCase())) out.push("the theme's colours are not the deck's");
    return out.join("; ");
  });
});
W("w-theme-dark-scheme", "medium", "theme-night", "A dark deck keeps the theme's Dark 1 dark and Light 1 light and maps the slide's background to Dark 1 (clrMap bg1=dk1, tx1=lt1), as PowerPoint's own dark themes do. PowerPoint's built-in table style for new tables (Medium Style 2 - Accent 1, the def Lantern's tableStyles.xml names) draws body cells as dk1 text on a 20% tint of Accent 1: with Dark 1 white, a table the colleague inserts is white text on pale peach. Shapes take lt1 text on Accent 1. Nothing wrong shows until something is added in PowerPoint.",
  function (s) { var th = s.zip.text("ppt/theme/theme1.xml"), dk1 = /<a:dk1><a:srgbClr val=\x22([0-9A-F]{6})\x22/.exec(th)[1]; return lum(dk1) > 0.5 ? "Dark 1 is " + dk1 + " (white): a table inserted in PowerPoint gets white text on pale cells" : ""; });

module.exports = cases;
