// cases_a.js -- rule 1: which tool a question gets (AI_STATION asks(): WHOLE_W, ALLDRAW/allDrawn, ALLHEAD, DEVQ, the
// widened words-opener). Written by the second reviewer before reading the first review's cases.
// The guard first: every bench question and every saved bench reply as on 1.24.33. Then the questions a crew chief,
// an operator or a student asks about lift stations, sumps and sewage: those that should now be MAKE STATION, those
// that are a document, a program, words or another machine, and the ones that ask for one drawing only.
"use strict";
var fs = require("fs"), path = require("path");
var lib = require("./lib.js");

function station(id, q, harm, right) {
  return { id: id, harm: harm || "medium", input: q, right: right || "MAKE STATION: the question asks for a lift station's drawings",
    run: function () { var got = lib.ids(lib.D, q); return Promise.resolve(lib.want(got === "station", "offered " + (got || "nothing") + " (1.24.33: " + (lib.ids(lib.P, q) || "nothing") + ")")); } };
}
function notStation(id, q, harm, right) {
  return { id: id, harm: harm || "medium", input: q, right: right || "not MAKE STATION: the question is a document, words, a program or another thing",
    run: function () { var got = lib.ids(lib.D, q); return Promise.resolve(lib.want(!/\bstation\b/.test(got), "offered " + got + " (1.24.33: " + (lib.ids(lib.P, q) || "nothing") + ")")); } };
}
// one drawing asked for, the others declined: either that drawing's own tool, or a station that draws only it
function oneDrawing(id, q, view, harm) {
  return { id: id, harm: harm || "medium", input: q, right: "only the " + view + " (the question says the other drawings are not wanted or are done)",
    run: function () {
      var got = lib.ids(lib.D, q);
      if (got !== "station") return Promise.resolve("");
      var m = lib.build(lib.D, "MAKE STATION: Lift station\npumps 2\nEND", q), s = lib.sum(m);
      return Promise.resolve(lib.want(s.show === view, "MAKE STATION, and it draws " + s.show + " (1.24.33 offered " + (lib.ids(lib.P, q) || "nothing") + ")"));
    } };
}

var cases = [];

// ---- the guard: the bench as on 1.24.33 ------------------------------------------------------------------------
["aiBenchQuestions", "aiBenchQuestionsB"].forEach(function (set) {
  cases.push({ id: "A-bench-" + set, harm: "high", input: "every question of Lantern." + set, right: "each offered the tools 1.24.33 offered it",
    run: function () {
      var qs = lib.D.L[set] || [], diff = qs.filter(function (x) { return lib.ids(lib.D, x.q) !== lib.ids(lib.P, x.q); });
      return Promise.resolve(qs.length < 100 ? "only " + qs.length + " questions" : lib.want(!diff.length, diff.length + " differ: " + diff.slice(0, 5).map(function (x) { return x.id + " " + lib.ids(lib.D, x.q) + " (was " + lib.ids(lib.P, x.q) + ")"; }).join("; ")));
    } });
});
cases.push({ id: "A-bench-saved-replies", harm: "high", input: "every reply and first reply in tests/fixtures/bench_run*.json, built for its question",
  right: "built exactly as 1.24.33 built it (ok, readAs, problems, summary, kind)",
  run: function () {
    var dir = path.join(lib.ROOT, "tests", "fixtures"), n = 0, diff = [];
    fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).forEach(function (f) {
      var d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), rows = Array.isArray(d) ? d : Object.keys(d).filter(function (k) { return k[0] !== "_"; }).map(function (k) { return d[k]; });
      rows.forEach(function (r) {
        if (!r || typeof r.q !== "string") return;
        ["reply", "first"].forEach(function (k) {
          if (typeof r[k] !== "string") return;
          n++;
          function sig(o) { var m; try { m = o.L.aiAct.build(r[k], r.q); } catch (e) { return "threw " + e.message; } return m ? JSON.stringify([m.ok, m.readAs || "", (m.problems || []).join("|"), m.summary || "", m.block && m.block.kind]) : "null"; }
          if (sig(lib.D) !== sig(lib.P)) diff.push(f + " " + (r.id || r.q.slice(0, 30)) + " " + k);
        });
      });
    });
    return Promise.resolve(n < 400 ? "only " + n + " replies read" : lib.want(!diff.length, diff.length + " of " + n + " differ: " + diff.slice(0, 6).join("; ")));
  } });

// ---- should be MAKE STATION (new on 1.24.34) ---------------------------------------------------------------------
[
  ["A-adam", lib.Q35.question, "high"],
  ["A-write-duplex-sewage", "Write a schematic for a duplex sewage lift station"],
  ["A-give-drawings", "Give me the drawings for a lift station"],
  ["A-prepare-set-triplex", "Prepare a set of drawings for a triplex lift station"],
  ["A-generate-storm", "Generate a schematic for a storm water pump station"],
  ["A-draft-pumping", "Draft a schematic for a sewage pumping station"],
  ["A-can-you-write", "Can you write a schematic for a lift station?"],
  ["A-could-you-write", "Could you write a schematic for a lift station?"],
  ["A-please-write", "Please write a schematic for our lift station"],
  ["A-write-3-pumps", "write a schematic for a lift station with 3 pumps"],
  ["A-grinder-station", "Write a schematic for a simplex grinder pump station"],
  ["A-provide-drawings", "Provide the drawings for a sewage lift station"],
  ["A-sewer-lift", "Write a schematic for a sewer lift station"],
  ["A-diagram-storm", "Write a diagram for a storm water lift station"],
  ["A-produce-set", "Produce the drawing set for a duplex lift station"],
  ["A-write-out", "Write out a schematic for a typical sewage lift station"],
  ["A-put-together", "Put together a set of drawings for a lift station"],
  ["A-provide-typical", "Provide a typical schematic for a duplex lift station"],
  ["A-no-articles", "write schematic for lift station"],
  ["A-2pump-include-others", "Write a schematic for a 2 pump lift station and include any other drawings it needs"],
  ["A-sanitary", "Write a schematic for a sanitary lift station"],
  ["A-any-drawings-needs", "Give me any drawings a lift station needs"],
  ["A-control-and-others", "Draw the control circuit for a lift station and any other drawings it needs"],
  ["A-its-other-drawings", "Draw a typical lift station and its other drawings"],
  ["A-all-needed", "Give me all drawings needed for a lift station"],
  ["A-what-then-draw", "What drawings does a lift station need? Draw them"],
  ["A-write-up-set", "Write up the full drawing set for a lift station"],
  ["A-drives-and-floats", "Draw the schematic for the lift station's drives and floats", "low"],
  ["A-alarm-lights-station", "Write a schematic for a lift station with high level alarm lights", "low"],
  ["A-wet-well-floats-pumps", "Write a schematic for a lift station's floats and pumps", "low"]
].forEach(function (x) { cases.push(station(x[0], x[1], x[2])); });

// ---- should be MAKE STATION, and is not (the same failure as Adam's chat, the words in another order) ---------------
[
  ["A-miss-lift-station-schematic", "Write a lift station schematic", "high"],
  ["A-miss-give-lift-station-schematic", "Give me a lift station schematic", "high"],
  ["A-miss-duplex-lift-station-schematic", "Write a duplex lift station schematic", "high"],
  ["A-miss-do-a-schematic", "Do a schematic for a lift station", "medium"],
  ["A-miss-do-up", "Do up a schematic of a duplex lift station", "medium"],
  ["A-miss-do-the-drawings", "Do the drawings for our sewage lift station", "medium"],
  ["A-miss-will-you", "Will you write a schematic for a lift station?", "medium"],
  ["A-miss-would-you-write-up", "Would you write up the drawings for a lift station?", "medium"],
  ["A-miss-give-lift-station-drawings", "Give me lift station drawings", "medium"],
  ["A-miss-i-need", "I need a schematic for a lift station", "low"],
  ["A-miss-hyphen", "Write a schematic for a lift-station", "low"],
  ["A-miss-list-and-draw", "List the drawings a lift station needs and draw them", "low"]
].forEach(function (x) { cases.push(station(x[0], x[1], x[2])); });

// ---- not MAKE STATION: a document, words, a program, another device or station -------------------------------------
[
  ["A-no-report", "Write a report on lift station drawings"],
  ["A-no-essay", "Write an essay about lift station schematics"],
  ["A-no-plc", "Write a PLC program for a lift station"],
  ["A-no-ladder-logic", "Write ladder logic for a duplex lift station"],
  ["A-no-fire-pump", "write a schematic for a fire pump station"],
  ["A-no-booster", "write a schematic for a booster pump station"],
  ["A-no-water-pump-station", "Write a schematic for a water pump station"],
  ["A-no-dialer", "Write a schematic for a lift station's alarm dialer"],
  ["A-no-vfd", "Give me the schematic of a lift station's VFD"],
  ["A-no-lights", "Write a schematic for the lift station lights"],
  ["A-no-level-transmitter", "Give me a schematic for a lift station's level transmitter"],
  ["A-no-scada", "Write a schematic for the lift station SCADA"],
  ["A-no-generator", "Write a schematic for the lift station's generator"],
  ["A-no-transfer-switch", "Write a schematic of a lift station transfer switch"],
  ["A-no-fence-gate", "Write a schematic for the lift station fence gate"],
  ["A-no-rundown", "Give me a rundown of the drawings a lift station needs"],
  ["A-no-what-drawings", "What drawings does a lift station need?"],
  ["A-no-name-drawings", "Name the drawings a lift station needs"],
  ["A-no-is-pid-needed", "Is a P&ID needed for a lift station?"],
  ["A-no-are-there", "Are there standard drawings for lift stations?"],
  ["A-no-do-you-have", "Do you have a schematic for a lift station?"],
  ["A-no-does-lantern", "Does Lantern have lift station drawings?"],
  ["A-no-drawing-index", "Prepare a drawing index for a lift station"],
  ["A-no-drawing-numbers", "Give me the drawing numbers for the lift station"],
  ["A-no-schematic-review", "Write a schematic review for a lift station"],
  ["A-no-review-checklist", "Write a checklist for reviewing lift station drawings"],
  ["A-no-description", "Write me a description of the schematic for a lift station"],
  ["A-no-deck", "Make a slide deck about lift stations for the council"],
  ["A-no-table", "Write a schematic of a lift station in a table"],
  ["A-no-sump-pump", "write a schematic for a sump pump"],
  ["A-no-summary", "Give me a summary of lift station schematics"],
  ["A-no-specification", "Write a specification for lift station drawings"],
  ["A-no-work-order", "Write a work order for the lift station schematic update"],
  ["A-no-legend", "Write a schematic legend for a lift station", "low"],
  ["A-no-explanation", "Give me a schematic explanation of a lift station", "low"],
  ["A-no-symbols", "Give me the schematic symbols used on lift station drawings", "low"],
  ["A-no-notes", "Write the schematic notes for the lift station", "low"]
].forEach(function (x) { cases.push(notStation(x[0], x[1], x[2])); });

// ---- one drawing, the others declined or done ------------------------------------------------------------------------
cases.push(oneDrawing("A-one-do-not-include", "Draw the control circuit for a lift station; do not include any other drawings", "control"));
cases.push(oneDrawing("A-one-already-have", "Draw just the control circuit for the lift station, I already have the other drawings.", "control"));
cases.push(oneDrawing("A-one-others-done", "Draw the float levels for the lift station; the other drawings are already done", "levels"));
cases.push(oneDrawing("A-one-no-others-needed", "Draw the piping for a lift station, no other drawings needed", "piping"));
cases.push(oneDrawing("A-one-as-drawings-require", "Draw the control circuit for a lift station as the city's drawings require", "control", "low"));

module.exports = cases;
