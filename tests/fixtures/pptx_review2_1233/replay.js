// replay.js -- the second review of 1.24.33's PowerPoint files, EMF pictures and stop rule, replayed against a Lantern
// source: every case of cases_read.js, cases_write.js, cases_ai.js and cases_browser.js.
//   node tests/fixtures/pptx_review2_1233/replay.js [path to lantern.inner.html]
// Prints AGREE <id>, DISAGREE <id> <what Lantern did> [harm], or SKIP <id> <why> (counted as AGREE), then
// "N cases: A AGREE, D DISAGREE". Cases that need Chromium, LibreOffice or python-pptx run them through child_process.
"use strict";
var path = require("path");
process.env.LANTERN_SRC = path.resolve(process.argv[2] || path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html"));
var H = require("./h.js");
var only = process.env.PPTX_R2_ONLY ? new RegExp(process.env.PPTX_R2_ONLY) : null;
var all = [].concat(require("./cases_read.js"), require("./cases_write.js"), require("./cases_ai.js"), require("./cases_browser.js"));
(async function () {
  H.get();
  await H.sleep(400);   // the AI server found (the page asks for it at once)
  var agree = 0, dis = 0, n = 0, ids = {};
  for (var i = 0; i < all.length; i++) {
    var c = all[i];
    if (ids[c.id]) throw new Error("two cases named " + c.id);
    ids[c.id] = 1;
    if (only && !only.test(c.id)) continue;
    n++;
    var r;
    try { r = await c.run(); } catch (e) { r = "threw: " + String(e && e.message || e).slice(0, 300); }
    r = String(r || "").replace(/\s+/g, " ").trim();
    if (!r) { agree++; console.log("AGREE " + c.id); }
    else if (/^SKIP\b/.test(r)) { agree++; console.log("SKIP " + c.id + " " + r.replace(/^SKIP:?\s*/, "")); }
    else { dis++; console.log("DISAGREE " + c.id + " " + r + " [" + c.harm + "]"); }
  }
  console.log(n + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
  process.exit(0);
})();
