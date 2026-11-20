// make_before.js -- writes before.json: how 1.24.29 drew each A case's block (lib.js's sig), for cases_a.js to compare.
// Run from the repository root: node tests/fixtures/liftstation_review3_1230/make_before.js
// (needs the tag or branch lantern-1.24.29; the page is taken with git show into a temporary file)
"use strict";
var cp = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
var H = require("./lib.js");
var tmp = path.join(os.tmpdir(), "lantern-1.24.29.inner.html");
fs.writeFileSync(tmp, cp.execFileSync("git", ["show", "lantern-1.24.29:src/lantern.inner.html"], { cwd: H.ROOT, maxBuffer: 64 << 20 }));
var B = H.load(tmp).L;
var out = {};
require("./cases_a.js").forEach(function (c) { out[c.id] = H.sig(B.aiAct.build(H.ctl(c.lines), c.q)); });
fs.writeFileSync(path.join(__dirname, "before.json"), JSON.stringify(out, null, 1) + "\n");
console.log("1.24.29 (" + B.version + "): " + Object.keys(out).length + " circuits written to before.json");
