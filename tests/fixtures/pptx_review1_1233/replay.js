// replay.js -- review 1 of 1.24.33 (PowerPoint files): every case of cases_read.js, cases_write.js and cases_glue.js
// against a Lantern source, one line a case:
//   AGREE <id> | DISAGREE <id> <what Lantern did> [harm] | SKIP <id> <why> (a program missing: counted as AGREE)
// then "N cases: A AGREE, D DISAGREE".
// Usage: node tests/fixtures/pptx_review1_1233/replay.js [src/lantern.inner.html] [--only=<regex>] [-v]
// The decks it reads are in decks/ (make_decks.py makes them). The write cases call python3 (check_saved.py: the
// ISO/IEC 29500 schemas with lxml, python-pptx) and LibreOffice when they are on the machine.
"use strict";
var path = require("path");
var ROOT = path.join(__dirname, "..", "..", "..");
var args = process.argv.slice(2), only = null, verbose = false, SRC = null;
args.forEach(function (a) { if (/^--only=/.test(a)) only = new RegExp(a.slice(7)); else if (a === "-v") verbose = true; else SRC = a; });
SRC = SRC || path.join(ROOT, "src", "lantern.inner.html");
var load = require(path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
(async function () {
  var o = load(SRC), x = require("./lib.js")(o);
  await sleep(50);
  if (!x.L.pptx || !x.L.pptx.read || !x.L.pptx.write) { console.log("this Lantern has no Lantern.pptx.read/write"); process.exit(2); }
  var all = [];
  ["cases_read.js", "cases_write.js", "cases_glue.js"].forEach(function (f) { var cs = require("./" + f); cs.forEach(function (c) { c.file = f; }); all.push({ cs: cs, prepare: cs.prepare }); });
  var list = [], agree = 0, dis = 0, skip = 0;
  for (var m = 0; m < all.length; m++) {
    var cs = all[m].cs.filter(function (c) { return !only || only.test(c.id); });
    if (!cs.length) continue;
    if (all[m].prepare) await all[m].prepare(x);
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], res;
      try { res = await c.run(x); } catch (e) { res = "threw: " + (e && e.message || e); }
      res = res == null ? "" : String(res);
      if (!res) { agree++; console.log("AGREE " + c.id); }
      else if (/^SKIP\b/.test(res)) { skip++; agree++; console.log("SKIP " + c.id + " " + res.replace(/^SKIP\s*/, "")); }
      else { dis++; console.log("DISAGREE " + c.id + " " + res.replace(/\s+/g, " ") + " [" + c.harm + "]"); if (verbose) console.log("    input: " + c.input + "\n    right: " + c.right); }
      list.push(c);
    }
  }
  if (x.savedDir) { try { require("fs").rmSync(x.savedDir, { recursive: true, force: true }); } catch (e) { } }
  console.log(list.length + " cases: " + agree + " AGREE" + (skip ? " (" + skip + " of them SKIP)" : "") + ", " + dis + " DISAGREE");
  process.exit(0);
})().catch(function (e) { console.log("replay failed: " + (e && e.stack || e)); process.exit(1); });
