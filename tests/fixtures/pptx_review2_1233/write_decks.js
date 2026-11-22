// write_decks.js -- the decks the second review has Lantern save (1.24.33): light and dark themes, long text and long
// titles, tables, lists of each numbering type, links, notes with pauses, pictures beside text and across, right-to-left
// text. Exported for the cases (cases_write.js) and, run as a script, written to a folder for other programs:
//   node tests/fixtures/pptx_review2_1233/write_decks.js <folder> [src]
"use strict";
var H = require("./h.js");
var JPEG = H.JPEG;
// a 4:3 PNG (40 by 30, blue), as a data URL
var PNG43 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAAO0lEQVR4Xu3QUQ0AMAyE0K5CKmyKJ2upCe6HZ4CEM/dVQieiyzDG1RhXY1yNcTXG1RhXY1yNcTUmtvoDbwUBfPN4JYUAAAAASUVORK5CYII=";
var THEMES = {
  paper: { name: "Paper", bg: "#fafaf7", fg: "#1b2430", accent: "#c2410c" },
  night: { name: "Night (default)" },
  chalk: { name: "Chalkboard", bg: "#143222", fg: "#f8fafc", accent: "#fbbf24" },
  ocean: { name: "Ocean", bg: "#082f49", fg: "#e0f2fe", accent: "#38bdf8" },
  sunset: { name: "Sunset", bg: "#431407", fg: "#ffedd5", accent: "#fb923c" }
};
function lines(n, words) { var out = []; for (var i = 1; i <= n; i++) out.push("<li>Step " + i + ": " + words + "</li>"); return "<ul>" + out.join("") + "</ul>"; }
var LONGPOINT = "check the guard, the cable and the plug for damage before every use, and tag it out if anything is cracked";
var DECKS = {
  // a trainer's deck in the light theme: every kind of slide
  light: { title: "Ladder safety", theme: THEMES.paper, slides: [
    { h: "Ladder safety", body: "<p>A ten-minute talk for the crew</p>", notes: "Welcome.\n\nAsk who used a ladder this week.\n\n\nWait for answers." },
    { h: "Before you climb", body: "<ul><li>Check the <b>feet</b><ul><li>No cracks</li><li>No <i>grease</i></li></ul></li><li>Set it at <u>1 in 4</u></li></ul>" },
    { h: "Steps", body: "<ol><li>Isolate</li><li>Prove dead<ol type=\"a\"><li>Test the tester</li><li>Test the circuit</li></ol></li><li>Work</li></ol>" },
    { h: "Ratings", body: "<table><tr><th>Type</th><th>Load</th></tr><tr><td>I</td><td>250 lb</td></tr><tr><td>IA</td><td>300 lb</td></tr></table>" },
    { h: "The right ladder", body: "<p>Leaning or standing?</p><ul><li>Leaning: 1 in 4</li><li>Step ladder: locked open</li></ul>", img: PNG43 },
    { h: "", body: "", img: PNG43 },
    { h: "Where to read more", body: "<p>See <a href=\"https://example.org/ladder rules\">the rules</a> or <a href=\"mailto:safety@example.org\">write to us</a>.</p>" }
  ] },
  dark: { title: "Night deck", theme: THEMES.night, slides: [
    { h: "Pump checks", body: "<ul><li>Oil level</li><li>Seal leaks</li></ul>", notes: "Point at the sight glass." },
    { h: "Readings", body: "<table><tr><th>Pump</th><th>Hours</th></tr><tr><td>P1</td><td>120</td></tr></table>" }
  ] },
  chalk: { title: "Chalk deck", theme: THEMES.chalk, slides: [{ h: "Fractions", body: "<ol><li>Halves</li><li>Quarters</li></ol>" }] },
  // too much text for the box, and a title too long for its box
  long: { title: "Long", theme: THEMES.paper, slides: [
    { h: "Twelve long points", body: lines(12, LONGPOINT) },
    { h: "Thirty long points", body: lines(30, LONGPOINT) },
    { h: "What every new starter on the site needs to know about permits, isolation, confined spaces, hot work and the emergency muster points on the first day", body: "<p>Read it all.</p>" },
    { h: "Eight points beside a picture", body: lines(8, "keep the area clear of offcuts"), img: PNG43 }
  ] },
  // lists of each numbering type, from where they start, at their levels
  numbering: { title: "Numbering", theme: THEMES.paper, slides: [
    { h: "Letters", body: "<ol type=\"a\"><li>Gloves</li><li>Goggles</li></ol>" },
    { h: "Capitals from C", body: "<ol type=\"A\" start=\"3\"><li>Third</li><li>Fourth</li></ol>" },
    { h: "Roman", body: "<ol type=\"i\"><li>one</li><li>two</li><li>three</li><li>four</li></ol>" },
    { h: "Big Roman from 9", body: "<ol type=\"I\" start=\"9\"><li>nine</li><li>ten</li></ol>" },
    { h: "Mixed levels", body: "<ol><li>First<ul><li>a point</li></ul></li><li>Second<ol type=\"i\"><li>sub one</li><li>sub two</li></ol></li><li>Third</li></ol>" },
    { h: "Two lists", body: "<p>Morning:</p><ol><li>Open up</li><li>Check stock</li></ol><p>Evening:</p><ol><li>Count cash</li><li>Lock up</li></ol>" }
  ] },
  tables: { title: "Tables", theme: THEMES.paper, slides: [
    { h: "Joined cells", body: "<table><tr><th>Day</th><th>AM</th><th>PM</th></tr><tr><td rowspan=\"2\">Mon</td><td colspan=\"2\">Training</td></tr><tr><td>Site</td><td>Office</td></tr></table>" },
    { h: "Joined past the end", body: "<table><tr><th>A</th><th>B</th></tr><tr><td rowspan=\"4\">tall</td><td>x</td></tr></table>" },
    { h: "Text and a table", body: "<p>The rota for the week:</p><table><tr><td>Mon</td><td>Ann</td></tr><tr><td>Tue</td><td>Bo</td></tr></table><p>Swap with a friend if you must.</p>" },
    { h: "Twenty rows", body: "<table>" + Array.apply(null, Array(20)).map(function (x, i) { return "<tr><td>Row " + (i + 1) + "</td><td>" + (i * 3) + "</td></tr>"; }).join("") + "</table>" }
  ] },
  rtl: { title: "RTL", theme: THEMES.paper, slides: [{ h: "السلامة", body: "<p dir=\"rtl\">ارتد القفازات دائماً.</p><ul><li dir=\"rtl\">النظارات</li></ul>" }] },
  chars: { title: "Café – “quotes” <&> 🔧", theme: THEMES.paper, slides: [
    { h: "Café – <&> 🔧", body: "<p>Bell\u0007 ￾ x\u000b y   nbsp</p><pre>if (a &lt; b) {\n\treturn;\n}</pre>", notes: "Line one\r\nLine two\rLine three" }
  ] },
  empty: { title: "Nothing yet", theme: THEMES.paper, slides: [] },
  // capitals are wider than the letters an estimate of half an em is made for
  caps: { title: "Caps", theme: THEMES.paper, slides: [
    { h: "WHAT EVERY NEW STARTER NEEDS TO KNOW ABOUT PERMITS AND ISOLATION", body: "<p>Read it.</p>" },
    { h: "Warning signs", body: "<ul>" + ["DANGER: HIGH VOLTAGE - KEEP OUT UNLESS AUTHORISED AND ISOLATED", "WARNING: FORKLIFTS OPERATE IN THIS AREA - USE THE WALKWAYS", "CAUTION: HOT SURFACES - WEAR GLOVES WHEN HANDLING PIPEWORK", "NOTICE: EAR DEFENDERS MUST BE WORN BEYOND THIS POINT AT ALL TIMES", "DANGER: CONFINED SPACE - ENTRY BY PERMIT ONLY WITH A STANDBY PERSON", "WARNING: OVERHEAD CRANE - DO NOT STAND UNDER A SUSPENDED LOAD"].map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" }
  ] }
};
module.exports = { DECKS: DECKS, THEMES: THEMES, PNG43: PNG43, LONGPOINT: LONGPOINT, lines: lines };
if (require.main === module) {
  var dir = process.argv[2] || H.path.join(H.HERE, "out");
  H.fs.mkdirSync(dir, { recursive: true });
  H.get();
  setTimeout(function () {
    var notes = {};
    Object.keys(DECKS).forEach(function (k) { var w = H.write(DECKS[k]); H.fs.writeFileSync(H.path.join(dir, k + ".pptx"), w.bytes); notes[k] = w.notes; });
    H.fs.writeFileSync(H.path.join(dir, "notes.json"), JSON.stringify(notes, null, 1));
    console.log("wrote " + Object.keys(DECKS).length + " decks to " + dir);
    process.exit(0);
  }, 50);
}
