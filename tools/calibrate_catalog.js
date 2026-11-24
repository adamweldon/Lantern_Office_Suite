// calibrate_catalog.js -- how often each kind of evidence puts a question on the right shelf (LIBRARY_CATALOG, 1.24.38).
//
//   node tools/calibrate_catalog.js [labels.json ...]         prints the counts and the SURETY table to paste in
//   node tools/calibrate_catalog.js --wrong [labels.json ...] ... and every question routed to a shelf not its own
//   node tools/calibrate_catalog.js --write                   ... and writes the table into src/lantern.inner.html
//                                                                 (between CALIBRATION - START and - END)
//
// With no files it reads tests/fixtures/catalog_labels.json (the bench's questions, labelled from their ids) and every
// tests/fixtures/catalog_review*/questions.json and review*_library_*/questions.json (questions written by reviewers who
// had not seen the router). Each
// label is a list of the shelves a librarian would rightly send the question to ("none": nowhere -- Lantern has nothing
// for it; the encyclopedia, 0.2, is then a right place too, as Lantern has nothing else). A question is routed as the
// library prompt routes it; it is right when its shelf is one of the label's (on no shelf: right when the label is
// "none" or the encyclopedia, 0.2). The pct the router gives a kind of
// evidence is (right + 1) / (asked + 2): a kind seen twice and right twice is 75%, not 100%. Each kind is counted with
// the shelf it named as well ("card-one@9.3"); the router draws that shelf's count toward its kind's.
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var load = require(path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
var args = process.argv.slice(2), wrong = false, write = false, src = path.join(ROOT, "src", "lantern.inner.html");
if (args[0] === "--write") { write = true; args.shift(); }
if (args[0] === "--wrong") { wrong = true; args.shift(); }
if (args[0] === "--src") { args.shift(); src = args.shift(); }
var files = args.length ? args : [path.join(ROOT, "tests", "fixtures", "catalog_labels.json")].concat(
  fs.readdirSync(path.join(ROOT, "tests", "fixtures")).filter(function (d) { return /^catalog_review|^review\d*_library_/.test(d); }).map(function (d) { return path.join(ROOT, "tests", "fixtures", d, "questions.json"); })
    .filter(function (f) { return fs.existsSync(f); }));
function counts(L, items) {
  var C = L.catalog, by = {}, bad = [];
  items.forEach(function (x) {
    var r = C.route(x.q), want = x.shelf || [], ok = r.ev === "nothing" || !r.shelf ? want.indexOf("none") >= 0 || want.indexOf("0.2") >= 0 : want.indexOf(r.shelf) >= 0 || (want.indexOf("none") >= 0 && r.shelf === "0.2");
    var c = by[r.ev] = by[r.ev] || [0, 0];
    c[1]++; if (ok) c[0]++;
    // ... and the kind with the shelf it named (the router draws a shelf's own count toward its kind's)
    if (r.shelf) { var cs = by[r.ev + "@" + r.shelf] = by[r.ev + "@" + r.shelf] || [0, 0]; cs[1]++; if (ok) cs[0]++; }
    if (!ok) bad.push([r.ev, r.shelf, want.join("|"), x.q.slice(0, 100), x.from || ""]);
  });
  return { by: by, bad: bad };
}
module.exports = { counts: counts, files: files };
if (require.main === module) {
  var o = load(src);
  setTimeout(function () {
    var L = o.L, items = [];
    L.aiPrompt.setMode("library");
    files.forEach(function (f) { JSON.parse(fs.readFileSync(f, "utf8")).forEach(function (x) { x.from = x.from || path.basename(path.dirname(f)); items.push(x); }); });
    var c = counts(L, items), keys = Object.keys(c.by).sort();
    console.log(items.length + " questions from " + files.map(function (f) { return path.relative(ROOT, f); }).join(", "));
    keys.filter(function (k) { return k.indexOf("@") < 0; }).forEach(function (k) { var v = c.by[k]; console.log("  " + (k + "                ").slice(0, 16) + v[0] + " of " + v[1] + " right (" + Math.round(100 * (v[0] + 1) / (v[1] + 2)) + "%)"); });
    console.log("\n  var SURETY = {" + keys.map(function (k) { return JSON.stringify(k).replace(/\x22/g, "\x22") + ": [" + c.by[k][0] + ", " + c.by[k][1] + "]"; }).join(", ") + "};");
    if (write) {
      var html = fs.readFileSync(src, "utf8"), a = html.indexOf("// CALIBRATION - START\n"), b = html.indexOf("  // CALIBRATION - END", a);
      if (a < 0 || b < 0) { console.log("no CALIBRATION markers in " + src); process.exit(1); }
      a += "// CALIBRATION - START\n".length;
      html = html.slice(0, a) + "  var SURETY = {" + keys.map(function (k) { return JSON.stringify(k) + ": [" + c.by[k][0] + ", " + c.by[k][1] + "]"; }).join(", ") + "};\n" + html.slice(b);
      fs.writeFileSync(src, html);
      console.log("\nwritten to " + path.relative(ROOT, src));
    }
    if (wrong) { console.log("\nrouted elsewhere:"); c.bad.forEach(function (b) { console.log("  " + b.join(" | ")); }); }
    process.exit(0);
  }, 150);
}
