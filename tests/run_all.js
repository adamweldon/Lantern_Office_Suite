// run_all.js -- run every check; exit 1 if any fails. Usage: npm test
"use strict";
var cp = require("child_process"), path = require("path");
var root = path.join(__dirname, "..");
var steps = [
  ["bundle payload == src", "node", ["tools/bundle.js", "check", "Lantern_Office_Suite.html", "src/lantern.inner.html"], /^OK/m],
  ["structure (markers, rules, syntax)", "python3", ["tests/structure.py"], /STRUCTURE OK/],
  ["no quotes inside regex literals", "node", ["tests/regex_quotes.js"], /^0 quote-bearing/m],
  ["Project Context Studio gate (markers, Depends circles, brackets outside strings)", "node", ["tests/pc_compat.js"], /PROJECT CONTEXT GATE OK/],
  ["boot tour (bundle timing, every app)", "node", ["tests/boot_tour.js"], /ALL BOOT TOUR PASS/],
  ["July 13 pages smoke", "node", ["tests/jul13_pages_smoke.js"], /ALL PASS/],
  ["July 13 pagination geometry", "node", ["tests/jul13_pages_geometry.js"], /ALL GEOMETRY PASS/],
  ["July 20 hidden/display regressions", "node", ["tests/jul20_deckplate_hidden.js"], /ALL HIDDEN\/DISPLAY REGRESSIONS PASS/],
  ["July 20 Deckplate suite smoke", "node", ["tests/jul20_deckplate_suite.js"], /ALL SUITE SMOKE TESTS PASS/],
  ["July 20 Assist + Astro", "node", ["tests/jul20_assist_astro.js"], /ALL ASSIST \+ ASTRO TESTS PASS/],
  ["July 20 Forge + Chat", "node", ["tests/jul20_forge_chat.js"], /ALL FORGE \+ CHAT TESTS PASS/],
  ["Compose engine (checker, readability, data)", "node", ["tests/compose_engine.js"], /ALL COMPOSE ENGINE TESTS PASS/],
  ["Compose app end to end", "node", ["tests/compose_app.js"], /ALL COMPOSE APP TESTS PASS/],
  ["Compose modules isolated (rule 11)", "node", ["tests/compose_isolation.js"], /COMPOSE MODULES ISOLATED/],
  ["AI layer (routing, app, bench)", "node", ["tests/ai_layer.js"], /ALL AI LAYER TESTS PASS/],
  ["Offline library (search, read, citations)", "node", ["tests/library.js"], /ALL LIBRARY TESTS PASS/],
  ["Open modules: shelves (WikiMed, iFixit, Wikivoyage ...), places and distances, codes (1.14)", "node", ["tests/open_modules.js"], /ALL OPEN MODULE TESTS PASS/],
  ["AI makes things (drawings, schematics, tables)", "node", ["tests/ai_actions.js"], /ALL AI ACTION TESTS PASS/],
  ["Waiting for the kit's model to load (progress bar, connects by itself)", "node", ["tests/ai_server_wait.js"], /ALL SERVER WAIT TESTS PASS/],
  ["Loading screen with Lantern Watch (measured progress, its advice, out-of-memory warning, a hung or missing watcher) (1.15)", "node", ["tests/ai_server_watch.js"], /ALL SERVER WATCH TESTS PASS/],
  ["Lantern Watch for real: the watcher and the page over HTTP with CORS, ready, the load log (1.15)", "node", ["tests/ai_server_watch_live.js"], /ALL LIVE WATCH TESTS PASS/],
  ["Chat routing (follow-ups, questions about itself, bench conversations)", "node", ["tests/chat_routing.js"], /ALL CHAT ROUTING TESTS PASS/],
  ["AI makes documents, slides, flashcards, plans; READ (1.12)", "node", ["tests/ai_make_docs.js"], /ALL MAKE DOCS TESTS PASS/],
  ["Code Lab (editor, checks, ladder, sandbox, examples; MAKE CODE, EXAMPLE:, code in replies)", "node", ["tests/code_lab.js"], /ALL CODE LAB TESTS PASS/],
  ["Puzzles (track, turn, solve; letters; Chat hands puzzles to Lantern)", "node", ["tests/puzzles.js"], /ALL PUZZLE TESTS PASS/],
  ["Bench run 9 replayed (named places, queues, retyped results, READ, dozens, covered shapes, totals, steps)", "node", ["tests/bench_run9.js"], /ALL BENCH RUN 9 CHECKS PASS/],
  ["Bench run 11 replayed (results put in, two places, the lesson asked about, EXAMPLE as code, XIO on a closed Stop, fuel the right way round)", "node", ["tests/bench_run11.js"], /ALL BENCH RUN 11 CHECKS PASS/],
  ["Bench run 12 replayed (retyped lines run again, a word where the count goes, a rung in plain text, lamps drawn as resistors, Show)", "node", ["tests/bench_run12.js"], /ALL BENCH RUN 12 CHECKS PASS/],
  ["Bench run 13 replayed (a retype with letters dropped, the size of a square, 800L, a tank valve held open, a seal-in on a tag nothing sets)", "node", ["tests/bench_run13.js"], /ALL BENCH RUN 13 CHECKS PASS/],
  ["Bench run 14 replayed, the 4B (LED lamps, parallel wiring, slide counts, plan dates, made-up inputs, amp-hours, retyped numbers, the quote that says it, unread pages)", "node", ["tests/bench_run14.js"], /ALL BENCH RUN 14 CHECKS PASS/],
  ["Bench run 15 replayed, the 4B (newtons over g, a sum glued with *, amp-hours any way round, a phone number, a note after END, TRACK positions and the line that needs the 2)", "node", ["tests/bench_run15.js"], /ALL BENCH RUN 15 CHECKS PASS/],
  ["Text Reader, PDF in and out, Chat with a document, Sheet Music Reader", "node", ["tests/text_reader.js"], /ALL TEXT READER TESTS PASS/],
  ["AI modules isolated (rule 11)", "node", ["tests/ai_isolation.js"], /AI MODULES ISOLATED/],
  ["Kit: model choice and bigger-model offer; popups; engine built here", "python3", ["tests/kit_offer.py"], /KIT OFFER TESTS PASS/],
  ["Kit window: Install / Start Lantern by double-click (Linux)", "python3", ["tests/kit_window.py"], /KIT WINDOW TESTS PASS/],
  ["Lantern Watch: the load watcher's story and plan, Python and PowerShell agree (1.15)", "python3", ["tests/lantern_watch/run_tests.py", "kit"], /^\d+ checks, 0 failed/m],
  ["Lantern Watch on Windows for real (PowerShell 7): the first reading at once, the log kept off the stick until the model is loaded (1.15)", "python3", ["tests/lantern_watch/live_ps.py", "kit"], /LIVE PS WATCH (TESTS PASS|SKIPPED)/],
  ["Lantern.zip: one Lantern folder; laid over the stick's old one", "python3", ["tests/lantern_zip.py"], /LANTERN ZIP TESTS PASS/]
];
var failed = 0;
steps.forEach(function (s) {
  var r = cp.spawnSync(s[1], s[2], { cwd: root, encoding: "utf8", timeout: 300000 });
  var out = (r.stdout || "") + (r.stderr || "");
  var ok = s[3].test(out) && r.status === 0;
  if (!ok) failed++;
  console.log((ok ? "PASS  " : "FAIL  ") + s[0]);
  if (!ok) console.log(out.split("\n").filter(function (l) { return /FAIL|Error|error|MISMATCH/.test(l); }).slice(0, 8).join("\n"));
});
console.log(failed ? failed + " CHECK(S) FAILED" : "ALL CHECKS PASS");
process.exit(failed ? 1 : 0);
