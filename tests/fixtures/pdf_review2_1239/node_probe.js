// node_probe.js -- the same PDFs through Node + jsdom (as tests/pdf_open.js loads Lantern): text, title, lock, fields,
// bookmarks and layers, no drawing (jsdom has no canvas). Usage: node tests/fixtures/pdf_review2_1239/node_probe.js
"use strict";
var path = require("path"), fs = require("fs");
var ROOT = path.join(__dirname, "..", "..", "..");
var load = require(path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
var fails = 0, n = 0;
function check(name, ok, info) { n++; if (!ok) fails++; console.log((ok ? "PASS  " : "FAIL  ") + name + (ok ? "" : "   got: " + JSON.stringify(info).slice(0, 300))); }
(async function () {
  var o = load(path.join(ROOT, "src", "lantern.inner.html"));
  o.w.DecompressionStream = global.DecompressionStream;
  var P = o.L.pdf;
  async function open(f, pw) {
    try { return { pdf: await P.open(new Uint8Array(fs.readFileSync(path.join(__dirname, f))), pw === undefined ? {} : { password: pw }) }; }
    catch (e) { return { err: String(e.message || e), needPassword: !!e.needPassword }; }
  }
  var ref = await open("plain3.pdf"), refT = [];
  for (var i = 0; i < 3; i++) refT.push((await P.pageText(ref.pdf, i)).text);
  var lin = [["lin2_plain.pdf"], ["lin2_rc4_40_user.pdf", "pump"], ["lin2_aes128_user.pdf", "pump"], ["lin2_aes256_owner.pdf"], ["lin2_objstm_rc4_user.pdf", "pump"], ["lin2_aes256_r5_user.pdf", "pump"]];
  for (var k = 0; k < lin.length; k++) {
    var r = await open(lin[k][0], lin[k][1]), t = [];
    if (r.pdf) for (i = 0; i < 3; i++) t.push((await P.pageText(r.pdf, i)).text);
    check("node: " + lin[k][0] + " text and title as the plain file", r.pdf && JSON.stringify(t) === JSON.stringify(refT) && r.pdf.title === "Pump Station Manual", r.err || [r.pdf.title, t[0]]);
  }
  var a = await open("lin2_aes128_user.pdf");
  check("node: a user password is asked for", a.needPassword, a);
  var s = await open("strings.pdf"), E = JSON.parse(fs.readFileSync(path.join(__dirname, "expect.json"), "utf8"));
  var fl = {}; (await P.fields(s.pdf)).forEach(function (f) { fl[f.name] = f.value; });
  var bad = E.strings.filter(function (x, k) { return x.kind === "must" && fl["s" + (k < 10 ? "0" : "") + k] !== x.want; });
  check("node: every field value in strings.pdf decoded as the standard says (" + E.strings.filter(function (x) { return x.kind === "must"; }).length + " strings)", !bad.length, bad.map(function (x) { return x.label; }));
  check("node: strings.pdf title (PDFDocEncoding)", s.pdf.title === "Café – naïve “quoted” ﬁle • € 5", s.pdf.title);
  var v = await open("ve_shapes.pdf"), vt = (await P.pageText(v.pdf, 0)).text;
  check("node: ve_shapes.pdf the same words shown and hidden as in the browser", /AND-A-C/.test(vt) && !/(^|\n)AND-A-B\n/.test(vt) && /NOT-AND-A-B/.test(vt) && !/\nNOT-A\n/.test(vt), vt.slice(0, 200));
  var f2 = await open("forms2.pdf"), ff = {}; (await P.fields(f2.pdf)).forEach(function (f) { ff[f.name] = f.value; });
  check("node: forms2.pdf radio across pages 'East', pair 'B'", ff.route === "East" && ff.pair === "B", ff);
  var dm = await open("damaged_onoff_dict.pdf"), dt;
  try { dt = (await P.pageText(dm.pdf, 0)).text; } catch (e) { dt = "THROWS: " + e.message; }
  check("node: damaged_onoff_dict.pdf page reads", /A-PART/.test(dt), dt);
  console.log(n + " node checks, " + fails + " fail");
})();
