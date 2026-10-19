// run_all.js -- run every check; exit 1 if any fails. Usage: npm test
"use strict";
var cp = require("child_process"), path = require("path");
var root = path.join(__dirname, "..");
var steps = [
  ["bundle payload == src", "node", ["tools/bundle.js", "check", "Lantern_Office_Suite.html", "src/lantern.inner.html"], /^OK/m],
  ["structure (markers, rules, syntax)", "python3", ["tests/structure.py"], /node --check: OK/],
  ["no quotes inside regex literals", "node", ["tests/regex_quotes.js"], /^0 quote-bearing/m],
  ["boot tour (bundle timing, every app)", "node", ["tests/boot_tour.js"], /ALL BOOT TOUR PASS/],
  ["July 13 pages smoke", "node", ["tests/jul13_pages_smoke.js"], /ALL PASS/],
  ["July 13 pagination geometry", "node", ["tests/jul13_pages_geometry.js"], /ALL GEOMETRY PASS/],
  ["July 20 hidden/display regressions", "node", ["tests/jul20_deckplate_hidden.js"], /ALL HIDDEN\/DISPLAY REGRESSIONS PASS/],
  ["July 20 Deckplate suite smoke", "node", ["tests/jul20_deckplate_suite.js"], /ALL SUITE SMOKE TESTS PASS/],
  ["July 20 Assist + Astro", "node", ["tests/jul20_assist_astro.js"], /ALL ASSIST \+ ASTRO TESTS PASS/],
  ["July 20 Forge + Chat", "node", ["tests/jul20_forge_chat.js"], /ALL FORGE \+ CHAT TESTS PASS/]
];
var failed = 0;
steps.forEach(function (s) {
  var r = cp.spawnSync(s[1], s[2], { cwd: root, encoding: "utf8", timeout: 300000 });
  var out = (r.stdout || "") + (r.stderr || "");
  var ok = s[3].test(out);
  if (!ok) failed++;
  console.log((ok ? "PASS  " : "FAIL  ") + s[0]);
  if (!ok) console.log(out.split("\n").filter(function (l) { return /FAIL|Error|error|MISMATCH/.test(l); }).slice(0, 8).join("\n"));
});
console.log(failed ? failed + " CHECK(S) FAILED" : "ALL CHECKS PASS");
process.exit(failed ? 1 : 0);
