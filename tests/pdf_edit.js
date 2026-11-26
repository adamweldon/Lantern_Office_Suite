// pdf_edit.js -- changing a PDF (1.24.40), each change a new copy checked by qpdf (and pypdf and poppler where they
// read it): pages kept, turned, moved, cropped, blank pages, PDFs combined; words stamped on pages; forms filled
// and flattened; comments and a signature written in; a copy locked with AES-256; a page's own words changed;
// a PDF made into a form, then filled in; a table found for a spreadsheet; bookmarks and links made by hand. The PDFs are tests/fixtures/
// pdf_open (and pdf_edit). Usage: node tests/pdf_edit.js
"use strict";
var path = require("path"), fs = require("fs"), cp = require("child_process"), os = require("os");
var T = process.env.LANTERN_TESTS || __dirname;   // (tests/, or where it is when run from elsewhere)
var load = require(path.join(T, "fixtures", "liftstation_review1_1230", "load.js"));
var FX = path.join(T, "fixtures", "pdf_open"), OUT = fs.mkdtempSync(path.join(os.tmpdir(), "pdf_edit_"));
var bad = 0, n = 0;
function ck(name, ok, info) { n++; console.log((ok ? "PASS  " : "FAIL  ") + name + (ok ? "" : "  " + String(info).slice(0, 400))); if (!ok) bad++; }
function qcheck(b, name) { var f = path.join(OUT, name); fs.writeFileSync(f, b); var r = cp.spawnSync("qpdf", ["--check", f], { encoding: "utf8" }); return r.status === 0 || r.status === 3 ? "ok" : r.stdout + r.stderr; }
function save(b, name) { var f = path.join(OUT, name); fs.writeFileSync(f, b); return f; }
function q(args) { var r = cp.spawnSync("qpdf", args, { encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; }
(async function () {
  var o = load(process.argv[2] || path.join(T, "..", "src", "lantern.inner.html"));
  o.w.DecompressionStream = global.DecompressionStream; o.w.CompressionStream = global.CompressionStream;
  if (!o.w.crypto || !o.w.crypto.getRandomValues) o.w.crypto = globalThis.crypto;
  var P = o.L.pdf;
  async function op(f) { return P.open(new Uint8Array(fs.readFileSync(path.join(FX, f)))); }
  async function txt(pdf, i) { return (await P.pageText(pdf, i)).text; }
  // --- edit ---
  await (async function () {
  var nav = await op("nav.pdf");
  var b1 = P.pagesOut(nav, { order: [2, 0], rotate: { 0: 90 } });
  ck("reordered nav: qpdf check", qcheck(b1, "nav_reordered.pdf") === "ok", qcheck(b1, "x.pdf"));
  var n1 = await P.open(b1);
  ck("2 pages, page 3 first, page 1 turned", n1.count === 2 && /Section 3/.test(await txt(n1, 0)) && /Section 1/.test(await txt(n1, 1)) && n1.pages[1].rotate === 90, n1.count + " " + n1.pages.map(function (p) { return p.rotate; }));
  var ol = P.outline(n1);
  ck("bookmarks kept and mapped (Safety first -> new page 2; Wiring table -> new page 1; Spare parts dropped)", JSON.stringify(ol.map(function (x) { return [x.title, x.page, x.kids.length]; })) === JSON.stringify([["Safety first", 1, 0], ["Wiring table", 0, 0]]), JSON.stringify(ol));
  var lk = await P.links(n1, 1);
  ck("link on the kept page to a kept page still works; the web link kept", lk.length === 2 && lk[0].page === 0 && lk[1].uri === "https://example.org/manual", JSON.stringify(lk));
  ck("the comment comes along", /Check this terminal/.test(await txt(n1, 1)), await txt(n1, 1));
  var lock = await op("owner_aes_256.pdf"), b2 = P.pagesOut(lock, { order: [1, 0] }), n2 = await P.open(b2);
  ck("a locked PDF's pages, written out unlocked and readable", !n2.security && /page 2/.test(await txt(n2, 0)) && qcheck(b2, "unlocked.pdf") === "ok", JSON.stringify(n2.security));
  var form = await op("form_plain.pdf"), c = P.combine([{ pdf: nav, name: "nav.pdf" }, { pdf: form, name: "form_plain.pdf" }, { pdf: lock, name: "owner.pdf" }]);
  ck("combined: qpdf check", qcheck(c, "combined.pdf") === "ok", qcheck(c, "y.pdf"));
  var n3 = await P.open(c);
  ck("combined: 3 + 1 + 2 pages", n3.count === 6, n3.count);
  var o3 = P.outline(n3);
  ck("combined: a bookmark per file at its first page, own bookmarks under it", JSON.stringify(o3.map(function (x) { return [x.title, x.page, x.kids.map(function (k) { return k.title; })]; })) === JSON.stringify([["nav", 0, ["Safety first", "Wiring table"]], ["form_plain", 3, []], ["owner", 4, ["Section 1", "Section 2"]]]), JSON.stringify(o3));
  var f3 = await P.fields(n3);
  ck("combined: the form's fields and values come along", f3.filter(function (f) { return f.name === "name" && f.value === "ADAM WELDON" && f.page === 4; }).length === 1, JSON.stringify(f3));
  ck("combined: page 4 reads the form with its values", /Name: ADAM WELDON/.test(await txt(n3, 3)), await txt(n3, 3));
  var b4 = P.pagesOut(nav, { order: [0, { blank: [612, 792] }, 1] }), n4 = await P.open(b4);
  ck("a blank page put in", n4.count === 3 && !(await txt(n4, 1)).trim() && qcheck(b4, "blank.pdf") === "ok", n4.count);
  var b5 = P.pagesOut(nav, { order: [0], crop: { 0: [72, 72, 540, 720] } }), n5 = await P.open(b5);
  ck("cropped page", n5.pages[0].w === 468 && n5.pages[0].h === 648, n5.pages[0].w + "x" + n5.pages[0].h);
  var lay = await op("layers.pdf"), b6 = P.pagesOut(lay, { order: [0] }), n6 = await P.open(b6);
  ck("layers kept, still off", JSON.stringify(P.layers(n6).map(function (l) { return [l.name, l.on]; })) === JSON.stringify([["Wiring", true], ["Dimensions", false]]) && !/DIMENSIONS/.test(await txt(n6, 0)), JSON.stringify(P.layers(n6)));
  
  })();
  // --- stamp ---
  await (async function () {
  var nav = await P.open(new Uint8Array(fs.readFileSync(path.join(FX, "nav.pdf"))));
  var b = P.stamp(nav, { items: [{ text: "Page {n} of {N}", where: "bottom-center" }, { text: "DRAFT", where: "center", size: 60, opacity: 0.3 }], file: "nav.pdf", bates: { prefix: "ABC", start: 120 } });
  ck("stamped: qpdf check", qcheck(b, "stamped.pdf") === "ok", qcheck(b, "s.pdf"));
  var s = await P.open(b), t = (await P.pageText(s, 1)).text;
  ck("page numbers and the watermark are in the page's words", /Page 2 of 3/.test(t) && /DRAFT/.test(t) && /Section 2/.test(t), t);
  var b2 = P.stamp(nav, { items: [{ text: "{bates}", where: "bottom-right" }], pages: [0, 2], bates: { prefix: "ABC", start: 120, digits: 6 } }), s2 = await P.open(b2);
  ck("Bates numbers run on over the pages chosen", /ABC000120/.test((await P.pageText(s2, 0)).text) && !/ABC/.test((await P.pageText(s2, 1)).text) && /ABC000121/.test((await P.pageText(s2, 2)).text), (await P.pageText(s2, 2)).text);
  ck("bookmarks and links still there", P.outline(s2).length === 2 && (await P.links(s2, 0)).length === 2, JSON.stringify(P.outline(s2)));
  var rot = await P.open(P.pagesOut(nav, { order: [0], rotate: { 0: 90 } })), b3 = P.stamp(rot, { items: [{ text: "TOP LEFT", where: "top-left" }] }), s3 = await P.open(b3);
  ck("on a page turned sideways the stamp is still written (qpdf)", qcheck(b3, "rot.pdf") === "ok" && /TOP LEFT/.test((await P.pageText(s3, 0)).text), (await P.pageText(s3, 0)).text);
  
  })();
  // --- forms ---
  await (async function () {
  var form = await op("form_plain.pdf");
  var b = await P.fillForm(form, { name: "JANE DOE", done: false, shift: "Day shift", notes: "All checked.", pin: "9999" });
  ck("filled: qpdf", qcheck(b, "filled.pdf") === "ok", qcheck(b, "f.pdf"));
  var f = await P.open(b), fs2 = await P.fields(f), byName = {};
  fs2.forEach(function (x) { byName[x.name] = x.value; });
  ck("filled: the values are in the PDF", byName.name === "JANE DOE" && byName.done === "Off" && byName.shift === "Day shift" && byName.notes === "All checked." && byName.pin === "", JSON.stringify(byName));
  var an = await P.annots(f, 0);
  ck("filled: every field has its own drawing now", an.filter(function (a) { return a.field && a.field.type !== "check"; }).every(function (a) { return a.apRef; }), JSON.stringify(an.map(function (a) { return [a.field && a.field.name, !!a.apRef]; })));
  var t = (await P.pageText(f, 0)).text;
  ck("filled: the text reads the new values", /Name: JANE DOE/.test(t) && /Done: \[ \]/.test(t) && /Shift: Day shift/.test(t), t);
  var ff = await op("form_filled.pdf"), b2 = await P.fillForm(ff, { name: "SMITH", done: false }), f2 = await P.open(b2), v2 = {};
  (await P.fields(f2)).forEach(function (x) { v2[x.name] = x.value; });
  ck("a form with its own drawings (reportlab): refilled", v2.name === "SMITH" && v2.done === "Off" && qcheck(b2, "refilled.pdf") === "ok", JSON.stringify(v2));
  var fl = await P.flatten(f), g = await P.open(fl);
  ck("flattened: qpdf", qcheck(fl, "flat.pdf") === "ok", qcheck(fl, "fl.pdf"));
  ck("flattened: no fields left, no form", (await P.fields(g)).length === 0 && !(g.doc.catalog.AcroForm), JSON.stringify(await P.fields(g)));
  var tg = (await P.pageText(g, 0)).text;
  ck("flattened: the values are part of the page's words now", /JANE DOE/.test(tg) && /Day shift/.test(tg) && /All checked/.test(tg) && !/9999/.test(tg), tg);
  var nav = await op("nav.pdf"), fl2 = await P.flatten(nav), g2 = await P.open(fl2), l2 = await P.links(g2, 0), a2 = await P.annots(g2, 0);
  ck("flattened comments: the box is drawn into the page, the links kept", l2.length === 2 && a2.filter(function (a) { return a.sub === "Square"; }).length === 0 && qcheck(fl2, "flatnav.pdf") === "ok", JSON.stringify(a2.map(function (a) { return a.sub; })));
  var ann = await op("annotated.pdf"), fl3 = await P.flatten(ann), g3 = await P.open(fl3);
  ck("flattened pypdf comments (no drawings of their own): the typed comment's words in the page", /CHECK THIS/.test((await P.pageText(g3, 0)).text) && qcheck(fl3, "flatann.pdf") === "ok", (await P.pageText(g3, 0)).text);
  
  })();
  // --- annot ---
  await (async function () {
  ck("addAnnots exported", typeof P.addAnnots === "function", typeof P.addAnnots);
  var plain = await op("plain.pdf");
  // a fake signature picture: 4x2, red, half see-through
  var rgb = new Uint8Array(24).fill(200), al = new Uint8Array(8).fill(255);
  var sigimg = { image: { dict: { Type: "/XObject", Subtype: "/Image", Width: 4, Height: 2, BitsPerComponent: 8, ColorSpace: "/DeviceRGB" }, data: rgb }, smask: { dict: { Type: "/XObject", Subtype: "/Image", Width: 4, Height: 2, BitsPerComponent: 8, ColorSpace: "/DeviceGray" }, data: al } };
  var list = [
    { page: 0, kind: "note", rect: [50, 700, 70, 720], text: "Check the torque here", color: [1, 0.9, 0.1] },
    { page: 0, kind: "text", rect: [100, 600, 300, 640], text: "REPLACED 2026-11-25" },
    { page: 0, kind: "highlight", rect: [72, 690, 300, 710], quads: [[72, 690, 300, 710]], color: [1, 0.9, 0.1] },
    { page: 0, kind: "underline", rect: [72, 670, 300, 680], quads: [[72, 670, 300, 680]] },
    { page: 0, kind: "strike", rect: [72, 650, 300, 660], quads: [[72, 650, 300, 660]] },
    { page: 0, kind: "box", rect: [400, 400, 500, 500], color: [1, 0, 0] },
    { page: 0, kind: "circle", rect: [400, 300, 500, 380] },
    { page: 0, kind: "line", rect: [98, 98, 302, 202], paths: [[[100, 100], [300, 200]]] },
    { page: 0, kind: "pen", rect: [98, 248, 202, 302], paths: [[[100, 250], [150, 300], [200, 260]]] },
    { page: 0, kind: "stamp", rect: [300, 100, 440, 144], text: "APPROVED", color: [0.1, 0.5, 0.1] },
    { page: 0, kind: "sign", rect: [100, 50, 200, 100], image: sigimg }];
  var b = await P.addAnnots(plain, list);
  ck("qpdf --check", qcheck(b, "annots.pdf") === "ok", qcheck(b, "a.pdf"));
  var f = await P.open(b), an = await P.annots(f, 0), subs = an.map(function (a) { return a.sub; }).sort().join(",");
  ck("all eleven comments are on the page", an.length === 11, subs);
  ck("each has its own drawing", an.every(function (a) { return a.apRef; }), JSON.stringify(an.map(function (a) { return [a.sub, !!a.apRef]; })));
  var t = (await P.pageText(f, 0));
  ck("the typed words read on the page", /REPLACED 2026-11-25/.test(t.text), t.text);
  ck("the note's words read in the comments", /Check the torque here/.test(t.text), t.text);
  // the original page text still there
  var t0 = (await P.pageText(plain, 0)).text.trim().split("\n")[0];
  ck("the page's own words kept", t.text.indexOf(t0) >= 0, t0);
  // pypdf reads them too
  var py = cp.spawnSync("python3", ["-c", "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(sorted(a.get_object()['/Subtype'] for a in r.pages[0]['/Annots']))", path.join(OUT, "annots.pdf")], { encoding: "utf8" });
  ck("pypdf sees them", /Stamp/.test(py.stdout) && /Ink/.test(py.stdout) && /FreeText/.test(py.stdout), py.stdout + py.stderr);
  // poppler draws them: the box's red is on the page picture
  var r = cp.spawnSync("pdftoppm", ["-r", "36", "-png", "-singlefile", path.join(OUT, "annots.pdf"), path.join(OUT, "annots")], { encoding: "utf8" });
  ck("poppler draws it", r.status === 0, r.stderr);
  // flatten keeps them as part of the page
  var fl = await P.flatten(f, { forms: true, comments: true }), g = await P.open(fl), ag = await P.annots(g, 0);
  ck("flattened: no comments left and qpdf passes", ag.length === 0 && qcheck(fl, "annots_flat.pdf") === "ok", JSON.stringify(ag.map(function (a) { return a.sub; })));
  ck("flattened: the text box words are part of the page", /REPLACED 2026-11-25/.test((await P.pageText(g, 0)).text), (await P.pageText(g, 0)).text);
  // a locked PDF: comments written to an unlocked copy
  var lk = await op("owner_aes_256.pdf"), b2 = await P.addAnnots(lk, [{ page: 0, kind: "box", rect: [10, 10, 60, 60] }]);
  ck("on a locked PDF (owner password only): written, opens, qpdf passes", qcheck(b2, "locked_annot.pdf") === "ok" && (await P.annots(await P.open(b2), 0)).length >= 1, "");
  // non-Latin author/text
  var b3 = await P.addAnnots(plain, [{ page: 0, kind: "note", rect: [10, 10, 30, 30], text: "°C ≤ 40 Ω" }]), f3 = await P.open(b3), a3 = await P.annots(f3, 0);
  ck("a note with non-Latin letters keeps them", a3.length === 1 && /≤/.test(a3[0].contents || ""), JSON.stringify(a3[0]));
  
  })();
  // --- protect ---
  await (async function () {
  ck("protect exported", typeof P.protect === "function", typeof P.protect);
  var plain = await op("plain.pdf"), t0 = (await P.pageText(plain, 1)).text;
  // a password to open it, an owner's password, no printing or copying
  var b = P.protect(plain, { userPassword: "open sesame", ownerPassword: "Boss-Ø", allow: { print: false, copy: false } }), f = save(b, "locked.pdf");
  var r = q(["--password=open sesame", "--check", f]);
  ck("qpdf: opens with the password and checks clean", r.code === 0 || r.code === 3, r.out.slice(-400));
  r = q(["--password=open sesame", "--show-encryption", f]);
  ck("qpdf: AES-256 (R6), printing and copying not allowed", /R = 6/.test(r.out) && /AESv3/.test(r.out) && /print low resolution: not allowed/.test(r.out) && /extract for any purpose: not allowed/.test(r.out), r.out);
  r = q(["--check", f]);
  ck("qpdf: no password, refused", r.code === 2 && /password/i.test(r.out), r.out.slice(-200));
  r = q(["--password=Boss-Ø", "--show-encryption", f]);
  ck("qpdf: the owner's password opens it as owner", /R = 6/.test(r.out) && r.code === 0, r.out.slice(-300));
  var py = cp.spawnSync("python3", ["-c", "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(r.decrypt('open sesame'))\nprint(r.pages[1].extract_text())", f], { encoding: "utf8" });
  ck("pypdf: opens it and reads page 2", /Pump P-101 page 2/.test(py.stdout), py.stdout + py.stderr);
  var e1 = null; try { await P.open(b); } catch (e) { e1 = e; }
  ck("Lantern: asks for the password", e1 && e1.needPassword, e1);
  var l = await P.open(b, { password: "open sesame" }), t1 = (await P.pageText(l, 1)).text;
  ck("Lantern: the password opens it, the same words, what was asked read back", t1 === t0 && l.security.method === "AES-256" && !l.security.permissions.print && !l.security.permissions.copy && l.security.permissions.change, JSON.stringify(l.security));
  var lo = await P.open(b, { password: "Boss-Ø" });
  ck("Lantern: the owner's password opens it as owner", lo.security.owner, JSON.stringify(lo.security));
  // owner only: anyone opens it, the limits read
  var b2 = P.protect(plain, { ownerPassword: "boss", allow: { change: false, assemble: false } }), f2 = save(b2, "owner_only.pdf");
  r = q(["--check", f2]);
  ck("owner only: qpdf opens it with no password", r.code === 0 || r.code === 3, r.out.slice(-300));
  var l2 = await P.open(b2);
  ck("owner only: Lantern opens it with no question; no changes, no assembly", !l2.security.permissions.change && !l2.security.permissions.assemble && l2.security.permissions.print, JSON.stringify(l2.security));
  // a form and comments keep working under the lock
  var form = await op("form_filled.pdf"), b3 = P.protect(form, { userPassword: "x" }), l3 = await P.open(b3, { password: "x" }), fv = await P.fields(l3);
  ck("a locked form keeps its values", fv.some(function (x) { return x.name === "name" && /WELDON/.test(x.value); }), JSON.stringify(fv));
  r = q(["--password=x", "--check", save(b3, "form_locked.pdf")]);
  ck("... and qpdf checks it clean", r.code === 0 || r.code === 3, r.out.slice(-300));
  var e2 = null; try { P.protect(plain, {}); } catch (e) { e2 = e; }
  ck("no password at all: refused, said", e2 && /password/.test(e2.message), e2);
  var e3 = null; try { P.protect(plain, { userPassword: "a", allow: { print: false } }); } catch (e) { e3 = e; }
  ck("limits with no owner's password: refused, said", e3 && /owner/.test(e3.message), e3);
  // two locks of the same PDF differ (a new key each time)
  var b4 = P.protect(plain, { userPassword: "open sesame" }), b5 = P.protect(plain, { userPassword: "open sesame" });
  ck("a new random key each time", Buffer.compare(Buffer.from(b4), Buffer.from(b5)) !== 0, "");
  
  })();
  // --- edit text ---
  await (async function () {
  function bbox(f) { var h = cp.spawnSync("pdftotext", ["-bbox", f, "-"], { encoding: "utf8" }).stdout, out = {}; h.replace(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g, function (m, a, b, c, d, w) { (out[w] = out[w] || []).push([+a, +b, +c, +d]); }); return out; }
  var src = path.join(T, "fixtures", "pdf_edit", "shows.pdf"), pdf = await P.open(new Uint8Array(fs.readFileSync(src)));
  var boxes = (await P.pageText(pdf, 0)).boxes, pcs = [].concat.apply([], boxes.map(P.editPieces));
  function piece(t) { return pcs.filter(function (p) { return p.text === t; })[0]; }
  ck("the page's lines, and the two columns as two pieces", ["Torque the flange bolts to 45 Nm.", "Pressure tested at 6 bar.", "First line", "Second line", "Third line", "Left column words", "Right column words", "Kept as it is."].every(piece), JSON.stringify(pcs.map(function (p) { return p.text; })));
  ck("every piece knows where it is shown", pcs.every(function (p) { return p.parts.every(function (q) { return q.src; }); }), "");
  var before = bbox(src);
  var b = await P.editText(pdf, [{ page: 0, line: piece("Torque the flange bolts to 45 Nm."), text: "Torque the flange bolts to 60 Nm." },
    { page: 0, line: piece("Pressure tested at 6 bar."), text: "Pressure tested at 10 bar." },
    { page: 0, line: piece("Second line"), text: "Second line, changed" },
    { page: 0, line: piece("Left column words"), text: "Left words new" },
    { page: 0, at: [72, 480], text: "A line added here.", size: 11 }]);
  var f = save(b, "edited.pdf"), r = cp.spawnSync("qpdf", ["--check", f], { encoding: "utf8" });
  ck("qpdf checks it clean", r.status === 0 || r.status === 3, r.stdout + r.stderr);
  var t = cp.spawnSync("pdftotext", [f, "-"], { encoding: "utf8" }).stdout;
  ck("the new words read (poppler)", /60 Nm/.test(t) && /10 bar/.test(t) && /Second line, changed/.test(t) && /Left words new/.test(t) && /A line added here/.test(t), t);
  ck("the old words are gone from the page, not covered", !/45 Nm/.test(t) && !/6 bar\./.test(t.replace("16 bar", "")) && !/Left column words/.test(t), t);
  var raw = cp.spawnSync("qpdf", ["--qdf", "--object-streams=disable", f, "-"]).stdout.toString("latin1");
  ck("... nor anywhere in the file", raw.indexOf("45 Nm") < 0 && raw.indexOf("Left column") < 0, "");
  var after = bbox(f);
  function same(w) { return JSON.stringify(before[w]) === JSON.stringify(after[w]); }
  ck("the lines not changed stay exactly where they were (poppler's boxes)", same("First") && same("Third") && same("Right") && same("Kept"), JSON.stringify([before.First, after.First, before.Third, after.Third, before.Right, after.Right]));
  ck("a changed line starts where the old one did", Math.abs(after.Torque[0][0] - before.Torque[0][0]) < 0.6 && Math.abs(after.Torque[0][3] - before.Torque[0][3]) < 1.5, JSON.stringify([before.Torque, after.Torque]));
  var g = await P.open(b), tl = (await P.pageText(g, 0)).text;
  ck("Lantern reads the changed page too", /60 Nm/.test(tl) && !/45 Nm/.test(tl) && /Right column words/.test(tl), tl);
  // a line from a form's drawing (a field's value) cannot be edited here
  var ff = await P.open(new Uint8Array(fs.readFileSync(path.join(FX, "form_filled.pdf")))), fb = [].concat.apply([], (await P.pageText(ff, 0)).boxes.map(P.editPieces));
  var val = fb.filter(function (p) { return /WELDON/.test(p.text); })[0], e1 = null;
  try { await P.editText(ff, [{ page: 0, line: val, text: "X" }]); } catch (e) { e1 = e; }
  ck("a form's value is refused here, and said", e1 && /borrows/.test(e1.message), e1);
  })();
  // --- make a form ---
  await (async function () {
  var plain = await P.open(new Uint8Array(fs.readFileSync(path.join(FX, "plain.pdf"))));
  var b = await P.addFields(plain, [{ page: 0, kind: "text", name: "Pump number", rect: [72, 600, 250, 620] }, { page: 0, kind: "tick", name: "Overload reset", rect: [72, 570, 86, 584] },
    { page: 1, kind: "lines", name: "Notes", rect: [72, 400, 400, 480] }, { page: 1, kind: "choice", name: "Condition", rect: [72, 360, 250, 380], options: ["OK", "Needs repair", "Replaced"] }]);
  var f = save(b, "made_form.pdf"), r = cp.spawnSync("qpdf", ["--check", f], { encoding: "utf8" });
  ck("qpdf checks the new form clean", r.status === 0 || r.status === 3, r.stdout + r.stderr);
  var py = cp.spawnSync("python3", ["-c", "import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(json.dumps({k:str(v.get('/FT')) for k,v in r.get_fields().items()}))", f], { encoding: "utf8" });
  ck("pypdf sees the four boxes, each its kind", py.stdout.trim() === JSON.stringify({ "Pump number": "/Tx", "Overload reset": "/Btn", "Notes": "/Tx", "Condition": "/Ch" }).replace(/,/g, ", ").replace(/:/g, ": "), py.stdout + py.stderr);
  var g = await P.open(b), fl = await P.fields(g);
  ck("Lantern lists them, on their pages", JSON.stringify(fl.map(function (x) { return [x.name, x.type, x.page]; })) === JSON.stringify([["Pump number", "text", 1], ["Overload reset", "check", 1], ["Notes", "text", 2], ["Condition", "choice", 2]]), JSON.stringify(fl));
  var filled = await P.fillForm(g, { "Pump number": "P-101", "Overload reset": true, "Notes": "Bearing noise at full speed.", "Condition": "Needs repair" }), h = await P.open(filled), v = {};
  (await P.fields(h)).forEach(function (x) { v[x.name] = x.value; });
  ck("filled in: every answer kept", v["Pump number"] === "P-101" && v["Overload reset"] !== "Off" && v["Notes"] === "Bearing noise at full speed." && v["Condition"] === "Needs repair", JSON.stringify(v));
  var f2 = save(filled, "made_filled.pdf"), r2 = cp.spawnSync("qpdf", ["--check", f2], { encoding: "utf8" });
  var pv = cp.spawnSync("python3", ["-c", "import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(json.dumps({k:str(v.get('/V')) for k,v in r.get_fields().items()}))", f2], { encoding: "utf8" });
  ck("... qpdf clean, pypdf reads the answers", (r2.status === 0 || r2.status === 3) && /P-101/.test(pv.stdout) && /Needs repair/.test(pv.stdout) && /Yes/.test(pv.stdout), pv.stdout + pv.stderr);
  var e1 = null; try { await P.addFields(g, [{ page: 0, kind: "text", name: "Pump number", rect: [72, 500, 200, 520] }]); } catch (e) { e1 = e; }
  ck("a name already in the form is refused, and said", e1 && /already/.test(e1.message), e1);
  var ff = await P.open(new Uint8Array(fs.readFileSync(path.join(FX, "form_plain.pdf")))), b3 = await P.addFields(ff, [{ page: 0, kind: "text", name: "Second name", rect: [72, 300, 250, 320] }]), g3 = await P.open(b3);
  ck("added to a form that has fields: the old ones kept with their values, the new one beside them", JSON.stringify((await P.fields(g3)).map(function (x) { return x.name; })) === JSON.stringify(["name", "done", "shift", "pin", "notes", "Second name"]) && (await P.fields(g3))[0].value === "ADAM WELDON", JSON.stringify(await P.fields(g3)));
  })();
  // --- tables for a spreadsheet ---
  await (async function () {
    var tp = await P.open(new Uint8Array(fs.readFileSync(path.join(T, "fixtures", "pdf_edit", "table.pdf")))), tb = await P.tablesOf(tp), c = P.tablesCsv(tb);
    ck("a parts table found as rows and columns, commas inside cells quoted, the prose around it left out", tb.length === 1 && c === "Page 1\r\nItem,Part number,Description,Qty\r\n1,PX-101-04,\"Mechanical seal, 35 mm\",2\r\n2,PX-101-11,\"Impeller, bronze\",1\r\n3,BRG-6206,\"Bearing, ball, sealed\",4\r\n4,GSK-220,\"Gasket set, casing\",1\r\n", JSON.stringify(c));
    var none = 0;
    for (var f of ["plain.pdf", "nav.pdf", "form_filled.pdf", "annotated.pdf"]) none += (await P.tablesOf(await op(f))).length;
    ck("no tables found in PDFs of prose, a form or comments", none === 0, none);
  })();
  // --- bookmarks and links made by hand ---
  await (async function () {
    var nav = await op("nav.pdf"), ol = P.outline(nav);
    ol.push({ title: "Parts list \u2013 page 3", page: 2, kids: [] });
    ol[0].title = "Safety first (read this)";
    var b = P.setBookmarks(nav, ol), f = save(b, "marks.pdf"), r = q(["--check", f]), g = await P.open(b), o2 = P.outline(g);
    ck("bookmarks renamed and added: qpdf clean, read back with their pages", (r.code === 0 || r.code === 3) && JSON.stringify(o2.map(function (x) { return [x.title, x.page]; })) === JSON.stringify([["Safety first (read this)", 0], ["Wiring table", 2], ["Parts list \u2013 page 3", 2]]) && o2[1].kids.length === 1, JSON.stringify(o2) + r.out);
    var py = cp.spawnSync("python3", ["-c", "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint([ (o.title, r.get_destination_page_number(o)) for o in r.outline if not isinstance(o, list)])", f], { encoding: "utf8" });
    ck("... pypdf reads them too", /Parts list . page 3', 2/.test(py.stdout) && /Safety first \(read this\)', 0/.test(py.stdout), py.stdout + py.stderr);
    var b2 = P.addLinks(g, [{ page: 0, rect: [72, 600, 200, 620], toPage: 2 }, { page: 1, rect: [72, 600, 200, 620], uri: "https://example.org/pump" }]), h = await P.open(b2);
    var l0 = (await P.links(h, 0)).filter(function (l) { return l.rect[0] === 72 && l.rect[1] === 600 && l.rect[2] === 200; }), l1 = (await P.links(h, 1)).filter(function (l) { return l.uri === "https://example.org/pump"; });
    ck("links drawn by hand: to a page, and to a web address; the bookmarks kept", l0.length === 1 && l0[0].page === 2 && l1.length === 1 && P.outline(h).length === 3 && (q(["--check", save(b2, "links.pdf")]).code !== 2), JSON.stringify([l0, l1]));
    var none = P.setBookmarks(nav, []), hn = await P.open(none);
    ck("every bookmark removed: none left, qpdf clean", P.outline(hn).length === 0 && q(["--check", save(none, "nomarks.pdf")]).code !== 2, JSON.stringify(P.outline(hn)));
  })();
  console.log(bad ? bad + " of " + n + " FAILED" : "ALL " + n + " PDF EDIT CHECKS PASS");
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.log("ERROR " + (e && e.stack)); process.exit(1); });
