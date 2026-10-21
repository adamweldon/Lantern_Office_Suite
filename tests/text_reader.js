// text_reader.js -- Text Reader, PDF in and out, Chat with a document, and
// the Sheet Music Reader, in jsdom (no canvas: the picture-reading steps run
// in the browser test, tests/browser/text_reader_e2e.py). Checks the word
// model (punctuation, units, codes, O and 0), the layout steps on drawn
// bitmaps (blobs, lines, x-height, spaces measured against the font), glyph
// features, the PDF reader (objects packed in object streams, a fax G4
// picture decoded pixel for pixel, a page's own words with an embedded
// font), document passages, Chat answering from an attached document with
// its quote checked, and the music engine's staff finder, pitches and MIDI.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var FX = path.join(__dirname, "fixtures", "text_reader");
var expect = JSON.parse(fs.readFileSync(path.join(FX, "expect.json"), "utf8"));
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.DecompressionStream = DecompressionStream;
w.fetch = function () { return Promise.reject(new TypeError("offline")); };
// prose for the word model (it learns English from Lantern's own text)
var prose = d.createElement("script");
prose.type = "text/plain";
prose.text = 'var x = "Inspect all the hoses and the filter element for leaks and wear before you start the machine, and record the date in the log."; ' +
  'var y = "The pressure gauge reads zero when the pump is off; check the oil level every morning and keep the air inlet free of dust and paper.";';
d.head.appendChild(prose);
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 600)); } }
try { w.eval(js); } catch (e) { errs.push("eval: " + e.message); }
var L = w.Lantern, TR = L.textReader, WD = TR.words, LY = TR.layout, GL = TR.glyphs, P = L.pdf;

(async function () {
  // --- the word model: shapes first, sense to settle close calls ---------------
  WD.reset();
  function best(cands) { return WD.decode(cands, { caps: false }).text; }
  function c(list) { return list.map(function (x) { return { ch: x[0], d: x[1] }; }); }
  ok("a known word beats look-alike marks", WD.sense("all") > WD.sense("a!!") + 3, [WD.sense("all"), WD.sense("a!!")]);
  ok("a mark inside a word costs", WD.sense("leaks") > WD.sense("!eaks") + 3);
  ok("a lone 0 is a number, not the letter O", WD.sense("0") > WD.sense("O"), [WD.sense("0"), WD.sense("O")]);
  ok("an abbreviation keeps its O (ISO)", WD.sense("ISO") > WD.sense("IS0"), [WD.sense("ISO"), WD.sense("IS0")]);
  ok("a code with digits is fine (E-11)", WD.sense("E-11") > WD.sense("E-ll"), [WD.sense("E-11"), WD.sense("E-ll")]);
  ok("units keep their case (kW, lb)", WD.sense("ft-lb") > WD.sense("ft-Ib"), [WD.sense("ft-lb"), WD.sense("ft-Ib")]);
  ok("an initial after a number is fine (C.)", WD.sense("C.") > WD.sense("Cv") - 1);
  ok("decode: close shapes settled by the word", best([c([["l", 0.10], ["1", 0.12]]), c([["e", 0.05], ["c", 0.08]]), c([["a", 0.05]]), c([["k", 0.05]]), c([["s", 0.05], ["5", 0.07]])]) === "leaks");
  ok("decode: clear shapes win over sense", best([c([["x", 0.02], ["a", 0.4]]), c([["q", 0.02], ["l", 0.4]]), c([["z", 0.02], ["l", 0.4]])]) === "xqz");
  ok("decode: a number stays a number", best([c([["5", 0.05], ["S", 0.06]]), c([["0", 0.05], ["O", 0.05]]), c([["0", 0.05], ["O", 0.05]])]) === "500");
  var before = WD.known("zorbulator");
  WD.learn(["Zorbulator"], true);
  ok("corrections are learnt and kept", !before && WD.known("zorbulator") && JSON.stringify(L.store.get("textReader.words", {})).indexOf("zorbulator") >= 0);

  // --- layout on drawn bitmaps --------------------------------------------------
  function bitmap(w, h, rects) {
    var a = new Uint8Array(w * h);
    rects.forEach(function (r) { for (var y = r[1]; y < r[1] + r[3]; y++) for (var x = r[0]; x < r[0] + r[2]; x++) a[y * w + x] = 1; });
    return { w: w, h: h, b: a };
  }
  // two lines of "letters": x-height 10 boxes and taller 15 boxes, words apart
  var rects = [], x0, ln;
  for (ln = 0; ln < 2; ln++) {
    var base = 30 + ln * 30, xx = 10;
    for (var wd = 0; wd < 4; wd++) {
      for (var k = 0; k < 5; k++) { var tall = (k + wd) % 3 === 0; rects.push([xx, base - (tall ? 15 : 10), 6, tall ? 15 : 10]); xx += 8; }
      xx += 8;
    }
  }
  var im = bitmap(200, 100, rects), comps = LY.components(im);
  ok("components: every drawn letter is one blob", comps.length === 40, comps.length);
  var lines = LY.lines(comps, 10);
  ok("lines: two lines found", lines.length === 2, lines.length);
  LY.metrics(lines[0]);
  ok("metrics: baseline, x-height and cap height", lines[0].base === 30 && lines[0].xh === 10 && lines[0].cap === 15 && !lines[0].caps, [lines[0].base, lines[0].xh, lines[0].cap, lines[0].caps]);
  var gs = LY.glyphs(lines[0]);
  var words = LY.words(lines[0], gs);
  ok("words: gaps split four words", words.length === 4 && words.every(function (q) { return q.length === 5; }), words.map(function (q) { return q.length; }));
  // spaces measured against the font: a "1" leaves a wide gap that is not a space
  var g3 = [{ x0: 0, x1: 4, m: [{ ch: "1", t: { lsb: 0.2, rsb: 0.5, sp: 0.55 } }] }, { x0: 12, x1: 20, m: [{ ch: "5", t: { lsb: 0.1, rsb: 0.1, sp: 0.55 } }] },
    { x0: 22, x1: 30, m: [{ ch: "0", t: { lsb: 0.1, rsb: 0.1, sp: 0.55 } }] }, { x0: 40, x1: 48, m: [{ ch: "k", t: { lsb: 0.1, rsb: 0.1, sp: 0.55 } }] },
    { x0: 50, x1: 58, m: [{ ch: "g", t: { lsb: 0.1, rsb: 0.1, sp: 0.55 } }] }, { x0: 60, x1: 68, m: [{ ch: "s", t: { lsb: 0.1, rsb: 0.1, sp: 0.55 } }] }];
  var w3 = LY.words({ xh: 10 }, g3, {});
  ok("words: a 1's wide gap is not a space", w3.length === 2 && w3[0].length === 3, w3.map(function (q) { return q.length; }));
  var cut = LY.cut({ comps: [{ runs: [0, 0, 10, 1, 0, 10] }], x0: 0, x1: 10, y0: 0, y1: 2 }, 4, 10);
  ok("cut: part of a blob between two columns", cut && cut.x0 === 4 && cut.x1 === 10 && cut.comps[0].n === 12, cut);

  // --- glyph features -------------------------------------------------------------
  var bar = { w: 3, h: 30, b: new Uint8Array(90).fill(1) };
  var f = GL.features(bar, { base: 30, xh: 15 }, { y0: 0, y1: 30 });
  var nz = 0; for (var i = 0; i < f.u.length; i++) if (Math.abs(f.u[i]) > 1e-6) nz++;
  ok("a thin bar (l, I) still has a shape to compare", nz > 20, nz);
  var ring = { w: 10, h: 10, b: new Uint8Array(100) };
  for (i = 0; i < 100; i++) { var rx = i % 10, ry = (i - rx) / 10; ring.b[i] = rx < 2 || rx > 7 || ry < 2 || ry > 7 ? 1 : 0; }
  ok("holes: an O has one", GL.holes(ring) === 1);
  var two = { w: 4, h: 12, b: new Uint8Array(48) };
  for (i = 0; i < 48; i++) { var ty = Math.floor(i / 4); two.b[i] = ty < 3 || ty > 5 ? 1 : 0; }
  ok("parts: an i or ! has two", GL.parts(two) === 2);

  // --- PDF reading --------------------------------------------------------------
  function load(n) { var b = fs.readFileSync(path.join(FX, n)); var u = new w.Uint8Array(b.length); u.set(b); return u; }
  var pdf = await P.open(load("g4_objstm.pdf"));
  ok("PDF: object streams unpacked, one page", pdf.count === 1 && pdf.pages[0].w > 0, { count: pdf.count });
  var img = null;
  Object.keys(pdf.doc.offs).forEach(function (n) { var o = pdf.doc.get(n); if (o && o.stream && o.dict.Subtype === "/Image") img = o; });
  var data = await pdf.doc.stream(img, true), parm = {};
  Object.keys(img.imageParms || {}).forEach(function (k) { parm[k] = pdf.doc.resolve(img.imageParms[k]); });
  if (!parm.Columns) parm.Columns = img.dict.Width;
  // what the page shows: the fax code's "black" is sample 0 unless BlackIs1,
  // and a Decode array [1 0] swaps the two
  var fax = P.ccitt(data, parm), black = 0, dec = pdf.doc.resolve(img.dict.Decode), inv = dec && +dec[0] === 1;
  for (i = 0; i < fax.px.length; i++) { var sv = parm.BlackIs1 ? fax.px[i] : 1 - fax.px[i]; if ((inv ? 1 - sv : sv) === 0) black++; }
  ok("PDF: fax (G4) picture decoded pixel for pixel", img.imageFilter === "/CCITTFaxDecode" && fax.w === expect.g4.w && fax.h === expect.g4.h && black === expect.g4.black,
    { filter: img.imageFilter, w: fax.w, h: fax.h, black: black, want: expect.g4 });
  var own = await P.open(load("own_text.pdf")), tx = await P.pageText(own, 0);
  ok("PDF: a page's own words, with an embedded font", tx.text.split("\n").join("|") === expect.own_text.join("|"), tx.text);

  // --- documents and Chat ---------------------------------------------------------
  var D = TR.docs;
  var doc = { id: "t", title: "Pump manual", per: 2, pages: [
    { n: 1, done: true, conf: 0.95, text: "Safety first. Switch off the main breaker before servicing the pump.\n\nWear safety glasses and gloves." },
    { n: 2, done: true, conf: 0.95, text: "Torque the flange bolts to 85 N-m (63 ft-lb) in a cross pattern.\n\nDo not reuse the gasket." },
    { n: 3, done: true, conf: 0.9, text: "Code E-11 means the temperature is above 65 degrees C." }] };
  var ps = D.passages(doc, "What torque for the flange bolts?", 3);
  ok("passages: the right page first", ps.length && ps[0].page === 2 && ps[0].doc, ps);
  ok("passages: a code in the question finds its page", D.passages(doc, "what does E-11 mean", 3)[0].page === 3);
  ok("passages: a named page", D.passages(doc, "what is on page 1?", 3).every(function (p) { return p.page === 1; }));
  ok("sections: pages in groups", D.sections(doc).length === 2 && D.sections(doc)[1].from === 3);
  var learnt = D.correct(doc, 0, doc.pages[0].text + " Quarnex");
  ok("correct: new words learnt", learnt.indexOf("Quarnex") >= 0 && WD.known("quarnex"));
  var C = L.CHAT, prompts = [];
  TR.attached = doc;
  var rec = await C.turn([], "What torque should the flange bolts get?", {}, { headless: true, call: function (m) {
    var last = m[m.length - 1].content; prompts.push(typeof last === "string" ? last : "");
    return Promise.resolve("ANSWER: 85 N-m (63 ft-lb) [1].\nQUOTE [1]: Torque the flange bolts to 85 N-m (63 ft-lb) in a cross pattern.");
  } });
  ok("chat: the document's passages go first", /DOCUMENT: passages from “Pump manual”/.test(prompts[0]) && rec.searches.some(function (s) { return s.how === "document"; }), prompts[0]);
  ok("chat: the answer's quote is checked against the document", rec.sources && rec.sources[0].doc && !rec.stillDoubt, rec);
  var rec2 = await C.turn([], "What torque should the flange bolts get?", {}, { headless: true, call: function () {
    return Promise.resolve("ANSWER: 120 N-m [1].\nQUOTE [1]: Torque the flange bolts to 120 N-m.");
  } });
  ok("chat: a made-up quote is caught", rec2.stillDoubt && rec2.stillDoubt.length, rec2.stillDoubt);
  var rec3 = await C.turn([], "Who wrote Hamlet?", {}, { headless: true, call: function (m) { prompts.push(m[m.length - 1].content); return Promise.resolve("ANSWER: Shakespeare."); } });
  ok("chat: a question the document does not cover goes on as usual", !/DOCUMENT: passages/.test(prompts[prompts.length - 1]) && !rec3.searches.some(function (s) { return s.how === "document"; }));
  var hist = C.trimHistory([{ role: "user", content: "q1\n\nDOCUMENT: passages from “X”\n[1] a" }, { role: "assistant", content: "a" }, { role: "user", content: "q2\n\nDOCUMENT: passages from “X”\n[1] b" }]);
  ok("chat: older document passages are dropped from what is sent", /document passages from an earlier question/.test(hist[0].content) && /\[1\] b/.test(hist[2].content));
  TR.attached = null;

  // --- the second reader's word-by-word comparison -----------------------------------
  var cmp = TR.view.compare("Torque the bolts to 85 N-m in a cross pattern.", "Torque the bolts to 86 N-m in a cross-pattern.");
  ok("compare: two readings lined up word by word", cmp.same === 7 && cmp.parts.filter(function (x) { return !x.same; }).length === 2 &&
    cmp.parts.some(function (x) { return x.a === "85" && x.b === "86"; }), cmp);

  // --- the Sheet Music Reader engine --------------------------------------------------
  var SM = L.sheetMusic, sw = 600, sh = 140, st = new Uint8Array(sw * sh);
  [30, 40, 50, 60, 70].forEach(function (y) { for (var x = 20; x < 580; x++) { st[y * sw + x] = 1; st[(y + 1) * sw + x] = 1; } });
  var found = SM.staves({ w: sw, h: sh, b: st });
  ok("music: a staff of five lines", found.length === 1 && Math.abs(found[0].spacing - 10) < 0.6, found);
  ok("music: middle line pitches (treble B4, bass D3)", SM.name(SM.PITCH.treble[0]) === "B4" && SM.name(SM.PITCH.bass[0]) === "D3" && SM.name(SM.PITCH.treble[-6]) === "C4" && SM.name(SM.PITCH.treble[6]) === "A5");
  var mid = SM.midi({ chords: [{ system: 0, x: 0, notes: [{ midi: 60 }, { midi: 64 }] }, { system: 0, x: 50, notes: [{ midi: 67 }] }] }, { bpm: 90 });
  ok("music: a MIDI file", String.fromCharCode(mid[0], mid[1], mid[2], mid[3]) === "MThd" && String.fromCharCode(mid[14], mid[15], mid[16], mid[17]) === "MTrk" && mid.length > 40, mid.length);
  ok("handwriting: a stub that says so", L.handwritingReader && L.handwritingReader.available() === false && /not built yet/.test(L.handwritingReader.TODO));
  ok("no page errors", !errs.length, errs);
  console.log(passes + " passed, " + fails + " failed");
  console.log(fails ? "TEXT READER TESTS FAILED" : "ALL TEXT READER TESTS PASS");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL exception", e && e.stack); process.exit(1); });
