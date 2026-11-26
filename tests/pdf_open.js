// pdf_open.js -- Lantern opens locked PDFs (1.24.39): the crypto against Node's own, then every lock qpdf and pypdf
// make (RC4 40 and 128, AES-128, AES-256 revisions 5 and 6, with object streams), locked only against changes
// (no question asked) or with a user password (asked; the wrong one refused; the owner password opens it too).
// Usage: node tests/pdf_open.js
"use strict";
var path = require("path"), fs = require("fs"), crypto = require("crypto");
var load = require(path.join(__dirname, "fixtures", "liftstation_review1_1230", "load.js"));
var FX = path.join(__dirname, "fixtures", "pdf_open");
var fails = 0, n = 0;
function check(name, ok, info) { n++; if (!ok) { fails++; console.log("FAIL  " + name + (info !== undefined ? "  " + String(info).slice(0, 300) : "")); } else console.log("PASS  " + name); }
(async function () {
  var o = load(path.join(__dirname, "..", "src", "lantern.inner.html"));
  o.w.DecompressionStream = global.DecompressionStream;
  var L = o.L, P = L.pdf, C = P.cryptCore;
  // the sums, against Node's own
  function hex(b) { return Buffer.from(b).toString("hex"); }
  var ok = true;
  [0, 1, 55, 56, 64, 111, 112, 128, 1000].forEach(function (len) {
    var b = crypto.randomBytes(len), u = new Uint8Array(b);
    ["md5", "sha256", "sha384", "sha512"].forEach(function (h) { if (hex(C[h](u)) !== crypto.createHash(h).update(b).digest("hex")) ok = false; });
  });
  check("MD5, SHA-256, SHA-384, SHA-512 match Node's", ok);
  ok = true;
  [16, 32].forEach(function (kl) {
    [0, 5, 16, 100].forEach(function (len) {
      var key = crypto.randomBytes(kl), iv = crypto.randomBytes(16), data = crypto.randomBytes(len);
      var c = crypto.createCipheriv(kl === 16 ? "aes-128-cbc" : "aes-256-cbc", key, iv), ct = Buffer.concat([c.update(data), c.final()]);
      if (hex(C.aesEncrypt(new Uint8Array(key), new Uint8Array(data), new Uint8Array(iv))) !== hex(ct)) ok = false;
      if (hex(C.aesDecrypt(new Uint8Array(key), new Uint8Array(Buffer.concat([iv, ct])))) !== hex(data)) ok = false;
    });
  });
  check("AES-128 and AES-256 (CBC) match Node's", ok);
  check("RC4 matches the published vector (Key, Plaintext)", hex(C.rc4(new Uint8Array(Buffer.from("Key")), new Uint8Array(Buffer.from("Plaintext")))) === "bbf316e8d940af0ad3");
  async function open(f, pw) {
    try { var pdf = await P.open(new Uint8Array(fs.readFileSync(path.join(FX, f))), pw === undefined ? {} : { password: pw }); var t = await P.pageText(pdf, 1); return { pdf: pdf, text: t.text }; }
    catch (e) { return { err: e }; }
  }
  var owner = ["owner_rc4_40.pdf", "owner_rc4_128.pdf", "owner_aes_128.pdf", "owner_aes_256.pdf", "owner_aes_256_r5.pdf", "owner_aes_256_objstm.pdf", "owner_rc4_128_objstm.pdf",
    "pypdf_owner_aes128.pdf", "pypdf_owner_rc4.pdf", "owner_aes_256_noprint.pdf"];
  var plain = await open("plain.pdf");
  check("the unlocked PDF reads (page 2)", plain.text && /Pump P-101 page 2/.test(plain.text) && !plain.pdf.security, plain.err || plain.text);
  for (var i = 0; i < owner.length; i++) {
    var r = await open(owner[i]);
    check(owner[i] + ": locked only against changes, opens with no question, reads the same", r.text === plain.text && r.pdf.security && r.pdf.security.locked && !r.pdf.security.userPassword, r.err || r.text);
  }
  var np = await open("owner_aes_256_noprint.pdf");
  check("what the maker asked is read: no printing, no changes, no copying", np.pdf && !np.pdf.security.permissions.print && !np.pdf.security.permissions.change && !np.pdf.security.permissions.copy, np.pdf && JSON.stringify(np.pdf.security));
  var ow = await open("owner_aes_256.pdf");
  check("... and an ordinary lock allows them", ow.pdf && ow.pdf.security.permissions.print && ow.pdf.security.permissions.copy && ow.pdf.security.method === "AES-256", ow.pdf && JSON.stringify(ow.pdf.security));
  var users = ["user_rc4_128.pdf", "user_aes_128.pdf", "user_aes_256.pdf"];
  for (i = 0; i < users.length; i++) {
    var a = await open(users[i]), b = await open(users[i], "wrong one"), c2 = await open(users[i], "lantern"), d = await open(users[i], "ownerpw");
    check(users[i] + ": asks for its password", a.err && a.err.needPassword && !a.err.wrongPassword, a.err || "opened");
    check(users[i] + ": a wrong password is refused, and said", b.err && b.err.needPassword && b.err.wrongPassword, b.err || "opened");
    check(users[i] + ": the user password opens it", c2.text === plain.text && c2.pdf.security.userPassword, c2.err || c2.text);
    check(users[i] + ": the owner password opens it too", d.text === plain.text && d.pdf.security.owner, d.err || d.text);
  }
  // what the first review found (tests/fixtures/pdf_review1_1239; its own checks run in a browser: run_review.py)
  var RV = path.join(__dirname, "fixtures", "pdf_review1_1239");
  async function rv(f, pw) { try { return { pdf: await P.open(new Uint8Array(fs.readFileSync(path.join(RV, f))), pw === undefined ? {} : { password: pw }) }; } catch (e) { return { err: e }; } }
  var lin = await rv("lin_aes128_owner.pdf"), lt = lin.pdf && (await P.pageText(lin.pdf, 0)).text;
  check("a linearized (Fast Web View) locked PDF: its lock is found in its first trailer, and it reads", lin.pdf && lin.pdf.security && /\S/.test(lt || ""), lin.err || lt);
  var lu = await rv("lin_aes256_user.pdf");
  check("... and one with a user password asks for it", lu.err && lu.err.needPassword, lu.err || "opened without asking");
  var lp = await rv("lin_plain.pdf");
  check("a linearized PDF's title is read", lp.pdf && lp.pdf.title !== "", lp.pdf && JSON.stringify(lp.pdf.title));
  var nv = await rv("nav_rl_pypdf.pdf"), ol = nv.pdf ? P.outline(nv.pdf) : [];
  check("bookmark titles in the PDF's own letters (PDFDocEncoding): an en dash", JSON.stringify(ol).indexOf("Wiring \u2013 main panel") >= 0, JSON.stringify(ol).slice(0, 300));
  var u8 = await rv("pdf20_utf8_strings.pdf"), ol8 = u8.pdf ? JSON.stringify(P.outline(u8.pdf)) : "";
  check("PDF 2.0 UTF-8 text strings", /\u00e9t\u00e9/.test(ol8) && !/\u00c3/.test(ol8), ol8.slice(0, 300));
  var eu = await rv("qpdf_aes128_user_euro.pdf", "\u20acuro-5");
  check("a password with a Euro sign opens an AES-128 lock (PDFDocEncoding 0xA0)", eu.pdf && eu.pdf.security, eu.err);
  var fr = await rv("form_rl.pdf"), ff = fr.pdf ? await P.fields(fr.pdf) : [], col = ff.filter(function (f) { return f.name === "colour"; });
  check("a radio group is one field, its value the button that is on", col.length === 1 && col[0].value === "green", JSON.stringify(col));
  var dl = await rv("damaged_lock_no_OU.pdf");
  check("a damaged lock is said to be damaged, no password asked", dl.err && !dl.err.needPassword && /damaged/.test(dl.err.message), dl.err ? dl.err.message : "opened");
  console.log(fails ? fails + " of " + n + " FAILED" : "ALL " + n + " PDF OPEN CHECKS PASS");
  process.exit(fails ? 1 : 0);
})();
