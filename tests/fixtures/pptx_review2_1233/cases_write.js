// cases_write.js -- Lantern.pptx.write on the second review's decks (write_decks.js): the parts themselves, then what
// other programs make of them (check_saved.py: the ISO/IEC 29500 schemas, python-pptx, LibreOffice; check_fit.py: the
// text laid out again with Georgia's widths), then read back by Lantern. Cases that need a program the machine lacks say
// SKIP.
"use strict";
var H = require("./h.js"), W = require("./write_decks.js");
var cp = require("child_process"), os = require("os");
var D = W.DECKS, memo = {};
function w(k) { if (!memo[k]) memo[k] = H.write(D[k]); return memo[k]; }
function part(k, n) { return w(k).z.text(n) || ""; }
function slideXml(k, n) { return part(k, "ppt/slides/slide" + n + ".xml"); }
var tmp = null, checked = null, fits = {};
function folder() {
  if (tmp) return tmp;
  tmp = H.fs.mkdtempSync(H.path.join(os.tmpdir(), "pptx_r2w_"));
  Object.keys(D).forEach(function (k) { H.fs.writeFileSync(H.path.join(tmp, k + ".pptx"), w(k).bytes); });
  return tmp;
}
function py() { try { cp.execSync("python3 -c \x22import sys\x22", { stdio: "ignore" }); return "python3"; } catch (e) { return null; } }
// other(): check_saved.py's findings for every deck, once
function other() {
  if (checked) return checked;
  if (!py()) return (checked = { missing: ["python3"], decks: {} });
  var out = H.path.join(folder(), "checked.json");
  try { cp.execFileSync("python3", [H.path.join(H.HERE, "check_saved.py"), folder(), out], { stdio: "ignore", timeout: 900000 }); } catch (e) { return (checked = { missing: ["check_saved.py failed: " + String(e.message).slice(0, 200)], decks: {} }); }
  return (checked = JSON.parse(H.fs.readFileSync(out, "utf8")));
}
function fit(k) {
  if (fits[k]) return fits[k];
  if (!py()) return null;
  try { fits[k] = JSON.parse(cp.execFileSync("python3", [H.path.join(H.HERE, "check_fit.py"), H.path.join(folder(), k + ".pptx")], { encoding: "utf8", timeout: 120000 })); } catch (e) { fits[k] = null; }
  return fits[k];
}
function C(id, harm, input, right, f) {
  return { id: id, harm: harm, input: input, right: right, run: function () { return new Promise(function (ok) { var r; try { r = f(); } catch (e) { r = "threw: " + String(e && e.message || e).slice(0, 300); } ok(r || ""); }); } };
}
function eq(got, want, what) { return JSON.stringify(got) === JSON.stringify(want) ? "" : (what ? what + ": " : "") + "got " + JSON.stringify(got).slice(0, 500) + ", wanted " + JSON.stringify(want).slice(0, 500); }
function needs(what) { var o = other(); if (o.missing.some(function (m) { return m.indexOf(what) === 0 || /failed/.test(m); })) return "SKIP: " + o.missing.join(", ") + " missing"; return null; }
function clr(theme, name) { var m = new RegExp("<a:" + name + "><a:srgbClr val=\x22([0-9A-F]{6})\x22").exec(theme); return m ? m[1] : null; }
function lum(h) { var n = parseInt(h, 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); }
function pdfText(k, page) { var d = other().decks[k]; return d && d.lo && d.lo.text[page - 1] ? d.lo.text[page - 1].map(function (x) { return x.t; }).join(" ") : null; }
function emu(x) { return Math.round(x); }

var cases = [];
// every part of every deck against the schemas (PowerPoint repairs a file whose parts are not valid)
Object.keys(D).forEach(function (k) {
  cases.push(C("write-schema-" + k, "high", "the " + k + " deck saved by Lantern, every XML part", "valid against the ISO/IEC 29500 schemas (pml.xsd, dml-main.xsd, the package's own)",
    function () { var s = needs("schemas") || needs("python3"); if (s) return s; var d = other().decks[k]; if (!d || !d.schema) return "SKIP: no schema check"; return d.schema.length ? d.schema.slice(0, 3).join("; ") : ""; }));
});
cases = cases.concat([
  C("write-package-whole", "high", "every deck saved: its content types and relationships", "every part named in [Content_Types].xml (by extension or by name), every relationship's target there",
    function () {
      var bad = [];
      Object.keys(D).forEach(function (k) {
        var z = w(k).z, ct = z.text("[Content_Types].xml"), defs = {}, ovs = {};
        ct.replace(/<Default Extension=\x22([^\x22]+)\x22/g, function (m, e) { defs[e.toLowerCase()] = 1; });
        ct.replace(/<Override PartName=\x22([^\x22]+)\x22/g, function (m, p) { ovs[p.replace(/^\x2F/, "")] = 1; });
        z.names.forEach(function (n) { if (n === "[Content_Types].xml") return; var e = (n.match(/\.([^.\x2F]+)$/) || [])[1]; if (!ovs[n] && !defs[(e || "").toLowerCase()]) bad.push(k + ": " + n + " has no content type"); });
        Object.keys(ovs).forEach(function (p) { if (z.names.indexOf(p) < 0) bad.push(k + ": " + p + " named but missing"); });
        z.names.filter(function (n) { return /\.rels$/.test(n); }).forEach(function (rn) {
          var base = rn.replace(/(^|\x2F)_rels\x2F([^\x2F]*)\.rels$/, "$1$2").replace(/[^\x2F]*$/, "");
          z.text(rn).replace(/<Relationship [^>]*>/g, function (r) {
            if (/TargetMode=\x22External\x22/.test(r)) return;
            var t = /Target=\x22([^\x22]+)\x22/.exec(r)[1], parts = (base + t).split("\x2F"), outp = [];
            parts.forEach(function (p) { if (p === "..") outp.pop(); else if (p && p !== ".") outp.push(p); });
            if (z.names.indexOf(outp.join("\x2F")) < 0) bad.push(k + ": " + rn + " points at " + t + ", not in the file");
          });
        });
      });
      return bad.slice(0, 5).join("; ");
    }),
  C("write-pptx-titles", "medium", "every deck saved, opened by python-pptx", "each slide's title in its title placeholder, the slides in order",
    function () { var s = needs("python-pptx") || needs("python3"); if (s) return s; var bad = []; Object.keys(D).forEach(function (k) { var d = other().decks[k]; if (!d || !d.pptx) return bad.push(k + ": not checked"); if (d.pptx.error) return bad.push(k + ": " + d.pptx.error); var want = D[k].slides.length ? D[k].slides.map(function (s) { return String(s.h || "").replace(/\s+/g, " "); }) : [D[k].title]; var got = d.pptx.slides.map(function (s) { return s.title; }); if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(k + ": " + JSON.stringify(got).slice(0, 200)); }); return bad.join("; "); }),
  C("write-lo-pages", "medium", "every deck saved, opened by LibreOffice Impress (made into a PDF)", "a page for each slide",
    function () { var s = needs("LibreOffice") || needs("python3"); if (s) return s; var bad = []; Object.keys(D).forEach(function (k) { var d = other().decks[k], n = D[k].slides.length || 1; if (!d || !d.lo) bad.push(k + ": LibreOffice made nothing"); else if (d.lo.pages !== n) bad.push(k + ": " + d.lo.pages + " pages for " + n + " slides"); }); return bad.join("; "); }),
  // ---- the deck's colours -----------------------------------------------------------------------------------------------
  C("write-theme-light", "medium", "the light deck (Paper: background #fafaf7, text #1b2430, titles #c2410c)", "Dark 1 the text colour, Light 1 the background, the master mapping background to Light 1",
    function () { var t = part("light", "ppt/theme/theme1.xml"), m = part("light", "ppt/slideMasters/slideMaster1.xml"); return eq([clr(t, "dk1"), clr(t, "lt1"), clr(t, "accent1"), /<p:clrMap bg1=\x22lt1\x22 tx1=\x22dk1\x22/.test(m)], ["1B2430", "FAFAF7", "C2410C", true]); }),
  C("write-theme-dark", "medium", "the dark deck (Night: background #0b0f14, white text)", "Dark 1 the darker colour (the background), Light 1 the lighter; the master maps the background to Dark 1 and the text to Light 1",
    function () { var t = part("dark", "ppt/theme/theme1.xml"), m = part("dark", "ppt/slideMasters/slideMaster1.xml"); return eq([lum(clr(t, "dk1")) < lum(clr(t, "lt1")), clr(t, "dk1"), /<p:clrMap bg1=\x22dk1\x22 tx1=\x22lt1\x22 bg2=\x22dk2\x22 tx2=\x22lt2\x22/.test(m)], [true, "0B0F14", true]); }),
  C("write-theme-chalk", "low", "the Chalkboard deck (#143222 background, #f8fafc text, #fbbf24 titles)", "a dark deck: Dark 1 the green, Light 1 the white",
    function () { var t = part("chalk", "ppt/theme/theme1.xml"); return eq([clr(t, "dk1"), clr(t, "lt1"), clr(t, "accent1")], ["143222", "F8FAFC", "FBBF24"]); }),
  C("write-dark-shown", "medium", "the dark deck opened by LibreOffice and drawn", "a dark page, the title in the accent colour, the text light",
    function () { var s = needs("LibreOffice") || needs("python3"); if (s) return s; var d = other().decks.dark, c = d && d.lo && d.lo.colours && d.lo.colours[0]; if (!c) return "SKIP: no colours read (pdftoppm or PIL missing)"; var bad = []; if (c.bg[0] + c.bg[1] + c.bg[2] > 120) bad.push("background " + c.bg); if (!c.first || c.first[0] < 150 || c.first[2] > 120) bad.push("title ink " + c.first); if (!c.last || c.last[0] + c.last[1] + c.last[2] < 450) bad.push("text ink " + c.last); return bad.join("; "); }),
  C("write-light-shown", "medium", "the light deck opened by LibreOffice and drawn", "a light page, the title in the accent colour, the text dark",
    function () { var s = needs("LibreOffice") || needs("python3"); if (s) return s; var d = other().decks.light, c = d && d.lo && d.lo.colours && d.lo.colours[1]; if (!c) return "SKIP: no colours read"; var bad = []; if (c.bg[0] + c.bg[1] + c.bg[2] < 600) bad.push("background " + c.bg); if (!c.first || c.first[0] < 150 || c.first[2] > 120) bad.push("title ink " + c.first); if (!c.last || c.last[0] + c.last[1] + c.last[2] > 300) bad.push("text ink " + c.last); return bad.join("; "); }),
  // ---- lists ------------------------------------------------------------------------------------------------------------
  C("write-num-types", "medium", "lists lettered a, capitals from C, roman i, big roman from IX", "PowerPoint's numbering types: alphaLcPeriod, alphaUcPeriod from 3, romanLcPeriod, romanUcPeriod from 9",
    function () { var got = [1, 2, 3, 4].map(function (n) { var m = /<a:buAutoNum type=\x22([a-zA-Z]+)\x22( startAt=\x22(\d+)\x22)?/.exec(slideXml("numbering", n)); return m ? m[1] + (m[3] ? "@" + m[3] : "") : null; }); return eq(got, ["alphaLcPeriod", "alphaUcPeriod@3", "romanLcPeriod", "romanUcPeriod@9"]); }),
  C("write-num-shown", "medium", "the numbering deck opened by LibreOffice", "C. D., i. to iv., IX. X. as the lists say",
    function () { var s = needs("LibreOffice") || needs("python3"); if (s) return s; var p2 = pdfText("numbering", 2) || "", p3 = pdfText("numbering", 3) || "", p4 = pdfText("numbering", 4) || ""; var bad = []; if (!/C\.\s*Third/.test(p2)) bad.push("capitals: " + p2); if (!/iv\.\s*four/.test(p3)) bad.push("roman: " + p3); if (!/IX\.\s*nine/.test(p4)) bad.push("big roman: " + p4); return bad.join("; "); }),
  C("write-num-restart-shown", "low", "slide “Two lists”: Morning: 1. 2.; Evening: 1. 2. (two numbered lists with a line between)", "LibreOffice numbers the evening list 1, 2 (PowerPoint restarts after a paragraph with no number; LibreOffice goes on unless told where to start)",
    function () { var s = needs("LibreOffice") || needs("python3"); if (s) return s; var t = pdfText("numbering", 6) || ""; return /Evening:\s*1\.\s*Count cash\s*2\.\s*Lock up/.test(t) ? "" : "LibreOffice shows: " + t; }),
  C("write-num-levels", "medium", "a numbered list with a bulleted point and a roman sub-list under its items", "the levels written; read back the same",
    function () { var s = D.numbering.slides[4], b = H.readBytes(w("numbering").bytes, "n.pptx").slides[4]; return eq(b.body, s.body); }),
  // ---- tables -----------------------------------------------------------------------------------------------------------
  C("write-table-joined", "medium", "a rota: Mon joined down two rows, Training across two columns", "gridSpan and rowSpan on the joined cells, hMerge and vMerge on those they cover; python-pptx sees the rows",
    function () { var x = slideXml("tables", 1); var bad = []; if (!/<a:tc rowSpan=\x222\x22>/.test(x)) bad.push("no rowSpan"); if (!/<a:tc gridSpan=\x222\x22>/.test(x)) bad.push("no gridSpan"); if ((x.match(/hMerge=\x221\x22/g) || []).length !== 1 || (x.match(/vMerge=\x221\x22/g) || []).length !== 1) bad.push("covered cells marked " + (x.match(/[hv]Merge=\x221\x22/g) || []).join(",")); return bad.join("; "); }),
  C("write-table-past-end", "medium", "a cell joined over 4 rows in a table of 2", "joined over the rows there are (no rowSpan past the table)", function () { return /rowSpan=\x22[3-9]/.test(slideXml("tables", 2)) ? "rowSpan past the table" : ""; }),
  C("write-text-after-table", "low", "a slide: a line, a table, then “Swap with a friend if you must.”", "the last line after the table, where it was written", function () {
    var d = other().decks.tables, sh = d && d.pptx && d.pptx.slides && d.pptx.slides[2].shapes;
    var x = slideXml("tables", 3), a = x.indexOf("Swap with a friend"), t = x.indexOf("<p:graphicFrame>");
    var ys = sh ? sh.filter(function (e) { return /Content|Table/.test(e.name); }).map(function (e) { return [e.name, e.y, e.text || ""]; }) : null;
    var tb = ys && ys.filter(function (e) { return /Table/.test(e[0]); })[0], cb = ys && ys.filter(function (e) { return /Content/.test(e[0]); })[0];
    if (cb && tb && /Swap/.test(cb[2]) && cb[1] < tb[1]) return "the line is in the text box above the table";
    return a > t ? "" : "the line is written before the table"; }),
  C("write-many-rows-said", "low", "a table of 20 rows", "said as more than fits (split the slide)", function () { return /more text and tables than fit \(slide 4\)/.test(w("tables").notes.join(" ")) ? "" : "not said: " + JSON.stringify(w("tables").notes); }),
  // ---- text that does not fit -------------------------------------------------------------------------------------------
  C("write-fit-twelve", "medium", "twelve long points (two lines each at full size)", "stored shrunk (fontScale) so they fit their box, laid out with Georgia's widths",
    function () { var f = fit("long"); if (!f) return "SKIP: python3 or PIL missing"; var b = f.boxes.filter(function (x) { return x.slide === 1 && !x.title; })[0]; return b.scale < 1 && b.need <= b.avail * 1.02 ? "" : "scale " + b.scale + ": needs " + b.need + " pt of " + b.avail; }),
  C("write-fit-thirty-said", "low", "thirty long points", "stored shrunk below 60%, and said", function () { return /more text than fits well \(slides 1 and 2\)/.test(w("long").notes.join(" ")) ? "" : "said " + JSON.stringify(w("long").notes); }),
  C("write-fit-long-title", "medium", "a title of 150 characters", "shrunk to fit the title box", function () { var f = fit("long"); if (!f) return "SKIP: python3 or PIL missing"; var b = f.boxes.filter(function (x) { return x.slide === 3 && x.title; })[0]; return b.need <= b.avail * 1.02 ? "" : "scale " + b.scale + ": needs " + b.need + " pt of " + b.avail; }),
  C("write-fit-beside-picture", "medium", "eight points beside a picture (the text box narrower)", "fits its narrower box", function () { var f = fit("long"); if (!f) return "SKIP: python3 or PIL missing"; var b = f.boxes.filter(function (x) { return x.slide === 4 && !x.title; })[0]; return b.need <= b.avail * 1.02 ? "" : "scale " + b.scale + ": needs " + b.need + " pt of " + b.avail; }),
  C("write-fit-capitals", "medium", "six safety signs in capitals (“DANGER: HIGH VOLTAGE - KEEP OUT ...”), 60 to 70 letters each", "stored shrunk so they fit their box, as PowerPoint draws them unedited",
    function () { var f = fit("caps"); if (!f) return "SKIP: python3 or PIL missing"; var b = f.boxes.filter(function (x) { return x.slide === 2 && !x.title; })[0]; return b.need <= b.avail * 1.02 ? "" : "stored at " + Math.round(b.scale * 100) + "%: needs " + b.need + " pt of the box's " + b.avail + " pt (runs off the bottom of the slide)"; }),
  C("write-fit-capital-title", "low", "a title of 64 capitals", "fits its box", function () { var f = fit("caps"); if (!f) return "SKIP: python3 or PIL missing"; var b = f.boxes.filter(function (x) { return x.slide === 1 && x.title; })[0]; return b.need <= b.avail * 1.02 ? "" : "scale " + b.scale + ": needs " + b.need + " pt of " + b.avail; }),
  // ---- pictures ---------------------------------------------------------------------------------------------------------
  C("write-picture-beside", "medium", "a slide with text and a 4:3 picture", "the picture right of the text box, inside the slide, 4:3",
    function () { var x = slideXml("light", 5), c = /<p:cNvPr id=\x22\d+\x22 name=\x22Content[^>]*>[\s\S]*?<a:off x=\x22(\d+)\x22 y=\x22(\d+)\x22\x2F><a:ext cx=\x22(\d+)\x22 cy=\x22(\d+)\x22/.exec(x), p = /<p:pic>[\s\S]*?<a:off x=\x22(\d+)\x22 y=\x22(\d+)\x22\x2F><a:ext cx=\x22(\d+)\x22 cy=\x22(\d+)\x22/.exec(x);
      if (!c || !p) return "no text box or picture place"; var tx = +c[1] + +c[3], px = +p[1], r = +p[3] / +p[4]; return px >= tx && px + +p[3] <= 12192000 && +p[2] + +p[4] <= 6858000 && Math.abs(r - 4 / 3) < 0.02 ? "" : "text ends at " + tx + ", picture " + p.slice(1).join(",") + " (ratio " + r.toFixed(3) + ")"; }),
  C("write-picture-alone", "low", "a slide with only a 4:3 picture", "the picture across the body area, 4:3", function () { var x = slideXml("light", 6), p = /<p:pic>[\s\S]*?<a:off x=\x22(\d+)\x22 y=\x22(\d+)\x22\x2F><a:ext cx=\x22(\d+)\x22 cy=\x22(\d+)\x22/.exec(x); if (!p) return "no picture"; return Math.abs(+p[3] / +p[4] - 4 / 3) < 0.02 && +p[4] > 4e6 ? "" : "picture " + p.slice(1).join(","); }),
  C("write-inline-picture-said", "low", "a body with an <img> in its text", "said: a slide's own picture is saved, not one in its text", function () { var r = H.write({ title: "x", slides: [{ h: "Pic", body: "<p>See <img src=\x22" + H.JPEG + "\x22> here</p>" }] }); return /pictures inside a slide.s text \(slide 1\)/.test(r.notes.join(" ")) ? "" : "said " + JSON.stringify(r.notes); }),
  C("write-webp-said", "low", "a slide picture in WEBP", "said, and the deck saved", function () { var r = H.write({ title: "x", slides: [{ h: "Pic", body: "<p>a</p>", img: "data:image/webp;base64,UklGRhYAAABXRUJQVlA4IAoAAAAQAgCdASoBAAEAAA==" }] }); return /WEBP/.test(r.notes.join(" ")) && !r.z.names.some(function (n) { return /media/.test(n); }) ? "" : "said " + JSON.stringify(r.notes); }),
  // ---- links, notes, characters, right to left ----------------------------------------------------------------------
  C("write-links", "medium", "a link to “https://example.org/ladder rules” (a space) and a mailto link", "both external hyperlinks, the space as %20", function () { var r = part("light", "ppt/slides/_rels/slide7.xml.rels"); return /Target=\x22https:\x2F\x2Fexample\.org\x2Fladder%20rules\x22 TargetMode=\x22External\x22/.test(r) && /Target=\x22mailto:safety@example\.org\x22/.test(r) ? "" : r.slice(0, 400); }),
  C("write-notes", "medium", "notes with blank lines (pauses)", "a notes slide with the blank lines as empty paragraphs; python-pptx reads them",
    function () { var s = needs("python-pptx") || needs("python3"); if (s) return s; var n = other().decks.light.pptx.slides[0].notes; return eq(n, "Welcome.\n\nAsk who used a ladder this week.\n\n\nWait for answers."); }),
  C("write-notes-crlf", "low", "notes with Windows (\\r\\n) and old Mac (\\r) line ends", "three lines", function () { var b = H.readBytes(w("chars").bytes, "c.pptx").slides[0]; return eq(b.notes, "Line one\nLine two\nLine three"); }),
  C("write-characters", "medium", "a title with é, –, <&> and an emoji; text with a bell character and U+FFFE", "the title exact; the characters XML cannot hold left out; python-pptx opens it",
    function () { var s = needs("python-pptx") || needs("python3"); if (s) return s; var t = other().decks.chars.pptx.slides[0].title; return eq(t, "Café – <&> 🔧"); }),
  C("write-pre-lines", "low", "a block of code (<pre>) of three lines with a tab", "its lines kept as line breaks", function () { return /\{<\x2Fa:t><\x2Fa:r><a:br>/.test(slideXml("chars", 1)) ? "" : "lines joined"; }),
  C("write-rtl", "low", "an Arabic paragraph and point marked dir=\x22rtl\x22", "written right to left (rtl=\x221\x22), so PowerPoint and LibreOffice set it from the right", function () { return /rtl=\x221\x22/.test(slideXml("rtl", 1)) ? "" : "written left to right (no rtl): read back as " + H.readBytes(w("rtl").bytes, "r.pptx").slides[0].body.slice(0, 120); }),
  C("write-empty-deck", "low", "a deck with no slides, titled “Nothing yet”", "one slide with the deck's title", function () { var b = H.readBytes(w("empty").bytes, "e.pptx"); return eq([b.slides.length, b.slides[0].h], [1, "Nothing yet"]); }),
  C("write-size", "low", "any deck", "16:9 (12,192,000 by 6,858,000 EMU)", function () { return /<p:sldSz cx=\x2212192000\x22 cy=\x226858000\x22\x2F>/.test(part("light", "ppt/presentation.xml")) ? "" : "another size"; }),
  C("write-roundtrip-light", "medium", "the light deck saved and read back", "the same slides (a header cell's text read back bold, a link's space as %20, two blank lines in notes as one)",
    function () { var b = H.readBytes(w("light").bytes, "l.pptx").slides, bad = []; D.light.slides.forEach(function (s, i) { var g = b[i] || {}; var body = g.body.replace(/<th><b>([^<]*)<\x2Fb><\x2Fth>/g, "<th>$1</th>").replace(/%20/g, " "); if (g.h !== s.h || body !== s.body || !!g.img !== !!s.img || (g.notes || "").replace(/\n{3,}/g, "\n\n") !== (s.notes || "").replace(/\n{3,}/g, "\n\n")) bad.push("slide " + (i + 1) + ": " + body.slice(0, 120)); }); return bad.join("; "); }),
  C("write-roundtrip-numbering", "medium", "the numbering deck saved and read back", "the same lists", function () { var b = H.readBytes(w("numbering").bytes, "n.pptx").slides, bad = []; D.numbering.slides.forEach(function (s, i) { if ((b[i] || {}).body !== s.body) bad.push("slide " + (i + 1) + ": " + (b[i] || {}).body); }); return bad.join("; "); }),
  C("write-file-name", "low", "a deck titled “Ladder: safety/2025?”", "a file name without : / ?", function () { var f = H.L().pptx.fileName("Ladder: safety/2025?"); return /[:\x2F?]/.test(f) || !/\.pptx$/.test(f) ? "named " + f : ""; }),
  C("write-short-hex", "low", "a theme given as #fff on #000", "white text on black, as six-digit colours", function () { var r = H.write({ title: "x", theme: { name: "t", bg: "#000", fg: "#fff", accent: "#f80" }, slides: [{ h: "a", body: "<p>b</p>" }] }); var t = r.z.text("ppt/theme/theme1.xml"); return eq([clr(t, "dk1"), clr(t, "lt1"), clr(t, "accent1")], ["000000", "FFFFFF", "FF8800"]); }),
  C("write-make-slides", "medium", "a deck Chat made (MAKE SLIDES: four slides) saved as .pptx", "python-pptx opens it with the four titles",
    function () {
      var made = H.L().aiAct.build("MAKE SLIDES: Changing a tyre\n# Changing a tyre\nA two-minute talk.\n# Before you start\n- Park on flat ground\n- Hazard lights on\n# Loosen and lift\n- Loosen the nuts a half turn\n- Jack under the sill mark\n# Swap and tighten\n- Tighten in a star pattern\n- Check the pressure\nEND", "Make a slide deck on changing a tyre");
      if (!made || !made.plan) return "no deck made";
      var d = { title: "Changing a tyre", slides: made.plan.slides || made.plan }, r = H.write(d), f = H.path.join(folder(), "made_slides.pptx"); H.fs.writeFileSync(f, r.bytes);
      if (!py()) return "SKIP: python3 missing";
      try { var t = cp.execFileSync("python3", ["-c", "import sys\nfrom pptx import Presentation\nprint('|'.join(s.shapes.title.text for s in Presentation(sys.argv[1]).slides))", f], { encoding: "utf8" }).trim(); return eq(t, "Changing a tyre|Before you start|Loosen and lift|Swap and tighten"); } catch (e) { return /No module named/.test(String(e.stderr || e.message)) ? "SKIP: python-pptx missing" : "python-pptx: " + String(e.stderr || e.message).slice(0, 200); }
    }),
  C("write-lo-roundtrip", "medium", "the light deck saved by Lantern, saved again by LibreOffice Impress as .pptx", "Lantern reads the same titles and lists back",
    function () {
      var so = null; try { so = cp.execSync("command -v soffice || command -v libreoffice", { encoding: "utf8" }).trim(); } catch (e) { so = null; }
      if (!so) return "SKIP: LibreOffice is not installed";
      var d = H.path.join(folder(), "lo"); H.fs.mkdirSync(d, { recursive: true });
      try { cp.execFileSync(so, ["--headless", "--convert-to", "pptx:Impress Office Open XML", "--outdir", d, H.path.join(folder(), "light.pptx")], { env: Object.assign({}, process.env, { HOME: d }), stdio: "ignore", timeout: 300000 }); } catch (e) { return "SKIP: LibreOffice failed"; }
      var f = H.path.join(d, "light.pptx"); if (!H.fs.existsSync(f)) return "SKIP: LibreOffice made nothing";
      var b = H.readBytes(H.fs.readFileSync(f), "light.pptx").slides, bad = [];
      D.light.slides.forEach(function (s, i) { var g = b[i] || {}; if (g.h !== s.h) bad.push("slide " + (i + 1) + " title " + JSON.stringify(g.h)); if (/<li>/.test(s.body) && !/<li>/.test(g.body || "")) bad.push("slide " + (i + 1) + " lost its list"); });
      return bad.join("; ");
    })
]);
module.exports = cases;
