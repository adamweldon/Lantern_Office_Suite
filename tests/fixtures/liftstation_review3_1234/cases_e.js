// cases_e.js -- routing in AI_STATION asks() (1.24.34): WHOLE_W / WHOLE_W2 (write, give, do, need ... a station's
// schematic or drawings, either word order), WNOUN (a summary, a specification, a list of the drawings is a document),
// ALLDRAW with its negations, the do/does/will opener, DEVQ (a device of the station is its own schematic). Each
// question: the tool it should go to, from what a crew chief or a learner means by it. Then the bench's 300 questions
// beside 1.24.33.
"use strict";
var lib = require("./lib.js");
function isSt(L, q) { return lib.ids(L, q) === "station"; }
function hobby(L, q) { var p = ""; try { p = L.aiAct.prompt(q) || ""; } catch (e) { p = ""; } return /Electrical types: battery/.test(p) && !/MAKE STATION|MAKE CONTROL/.test(p); }
function yes(id, q, why, harm) {
  return { id: id, harm: harm || "high", right: true, input: { q: q }, why: why || "a station's drawings asked to be made: MAKE STATION",
    run: async function (x) { return isSt(x.N.L, q) ? "" : "goes to “" + lib.ids(x.N.L, q) + "”, not MAKE STATION" + (hobby(x.N.L, q) ? " -- MAKE SCHEMATIC's hobby parts (battery, lamp, motor), the failure of Adam's chat" : "") + " (1.24.33: " + lib.ids(x.O.L, q) + ")"; } };
}
function no(id, q, why, harm) {
  return { id: id, harm: harm || "medium", right: true, input: { q: q }, why: why || "not a request to draw the station",
    run: async function (x) { return isSt(x.N.L, q) || x.N.L.aiStation.asks(q) ? "taken as MAKE STATION (1.24.33: " + lib.ids(x.O.L, q) + ")" : ""; } };
}
// a station's own electrical schematic: MAKE STATION or MAKE CONTROL (its control circuit), never the hobby parts
function ctlOrStation(id, q, why, harm) {
  return { id: id, harm: harm || "high", right: true, input: { q: q }, why: why,
    run: async function (x) {
      var p = x.N.L.aiAct.prompt(q) || "";
      if (isSt(x.N.L, q) || /MAKE CONTROL/.test(p)) return "";
      return "goes to " + (lib.ids(x.N.L, q) || "no tool") + (hobby(x.N.L, q) ? " with MAKE SCHEMATIC's hobby parts (battery, lamp, motor) -- Adam's chat again, one word added" : "") + "; a part-and-wire reply is then not read as the station either (1.24.33 the same)";
    } };
}
var C = [];
// ---- written, given, done, needed ...: the station --------------------------------------------------------------
C.push(yes("E-adam", "write a schematic for a typical lift station"));
C.push(yes("E-write-me-schematics", "Write me the schematics for our new duplex lift station"));
C.push(yes("E-i-need-schematic", "I need a schematic for a sewage lift station"));
C.push(yes("E-we-need-set", "We need a full set of drawings for a duplex sewage pump station"));
C.push(yes("E-do-a-schematic", "Do a schematic of a lift station"));
C.push(yes("E-do-me", "Do me a lift station schematic"));
C.push(yes("E-will-you-write", "Will you write the schematic for a lift station?"));
C.push(yes("E-can-you-write", "Can you write a schematic for a lift station?"));
C.push(yes("E-prepare-package", "Prepare the drawing package for a wastewater pumping station"));
C.push(yes("E-generate-any-other", "Generate the schematics and any other drawings a lift station needs"));
C.push(yes("E-w2-write", "write a lift station schematic"));
C.push(yes("E-w2-give", "give me lift station drawings"));
C.push(yes("E-w2-produce", "Produce lift station layout drawings"));
C.push(yes("E-w2-put-together", "Put together a lift station drawing set"));
C.push(yes("E-draft", "Draft the schematic for a simplex lift station"));
C.push(yes("E-include-all-other", "Write the schematic for a lift station and include all the other drawings it would need"));
C.push(yes("E-draw-control-include", "Draw the control schematic for a lift station. Include any other drawings it needs."));
C.push(yes("E-provide-sch-pid", "Provide the schematic and P&ID for a triplex lift station"));
C.push(yes("E-full-set-storm", "Give a full drawing set for a storm water pump station"));
C.push(yes("E-do-the-drawings", "Do the drawings for a lift station"));
C.push(yes("E-i-want", "I want the drawings for a lift station"));
C.push(yes("E-need-asap", "Need lift station schematic asap"));
C.push(yes("E-sump-station", "Give me a schematic for a sump pump station"));
C.push(yes("E-draw-me-needs", "Draw me the drawings a sewage lift station needs"));
C.push(yes("E-with-dialer", "Give me the schematic of a lift station with an alarm dialer", "the station is the subject, the dialer one of its parts"));
// ---- the station's electrical schematic: Adam's question with one word added ----------------------------------------
C.push(ctlOrStation("E-electrical-adam", "Write the electrical schematic for a typical lift station", "Adam's own question with “electrical”: views() reads “electrical” as the control drawing alone, asks() wants none or two, and the question goes to MAKE SCHEMATIC with a battery, a lamp and a motor -- the very failure this change was made for. Its part-and-wire reply is not read as the station (asks() is false).", "high"));
C.push({ id: "E-electrical-adam-reply", harm: "high", right: true, input: { q: "Write the electrical schematic for a typical lift station", reply: "tests/fixtures/liftstation_1234/chat_35b.json, the 35B's first reply" },
  why: "The 35B's reply of Adam's chat, under Adam's question with “electrical”: read as the station, as it is under the question as asked.",
  run: async function (x) {
    var CH = JSON.parse(require("fs").readFileSync(require("path").join(lib.ROOT, "tests/fixtures/liftstation_1234/chat_35b.json"), "utf8"));
    var q = "Write the electrical schematic for a typical lift station", m = lib.build(x.N.L, CH.replies[0].reply, q);
    return m && m.ok && m.readAs === "STATION" ? "" : "sent back as MAKE SCHEMATIC's: " + lib.probs(m).slice(0, 300);
  } });
C.push(ctlOrStation("E-electrical-draw", "Draw the electrical schematic for a lift station", "the same, with draw", "medium"));
C.push(ctlOrStation("E-electrical-give-two", "Give me the electrical schematic for a lift station with two pumps", "the same, with give and a pump count", "medium"));
C.push(ctlOrStation("E-control-panel", "Write the schematic for a lift station's control panel", "the station's control panel", "medium"));
C.push(ctlOrStation("E-please", "Lift station schematic please", "no verb", "low"));
C.push(ctlOrStation("E-show-me", "Show me the schematic for a duplex lift station", "show me: MAKE CONTROL (its control circuit)", "low"));
C.push(ctlOrStation("E-wiring-duplex", "Could you give me a wiring diagram for a duplex lift station?", "a wiring diagram: MAKE CONTROL", "low"));
C.push({ id: "E-electrical-drawings-picture", harm: "medium", right: true, input: { q: "Write up the electrical drawings for the Main Street lift station" },
  why: "A station's electrical drawings, asked to be written up: they go to MAKE DRAWING, the picture on a 20 x 12 grid (“electrical” makes one view, so not the station; “drawings” is the picture's word).",
  run: async function (x) { var q = "Write up the electrical drawings for the Main Street lift station", i = lib.ids(x.N.L, q); return /drawing/.test(i) && !/station|schematic/.test(i) ? "goes to MAKE DRAWING (a picture of shapes on a grid) (1.24.33 the same)" : ""; } });
C.push({ id: "E-pid-no-tool", harm: "low", right: true, input: { q: "Please produce a P&ID for a sewage lift station" },
  why: "DRAWOBJ names P&IDs, but SHOWV (draw, drawing, schematic, diagram, layout ...) does not, so asks() returns false first: no tool at all (1.24.33 the same).",
  run: async function (x) { var q = "Please produce a P&ID for a sewage lift station"; return lib.ids(x.N.L, q) ? "" : "no tool takes it"; } });
C.push({ id: "E-draw-them", harm: "low", right: true, input: { q: "What are the drawings needed for a lift station? Draw them." },
  why: "allDrawn()'s own example (“draw them” after a question that names them), worded one way: AI_PARTS splits it, “Draw them” alone is the picture's, and the station is refused as foreign.",
  run: async function (x) { var q = "What are the drawings needed for a lift station? Draw them."; return isSt(x.N.L, q) ? "" : "goes to " + lib.ids(x.N.L, q); } });
// ---- not the station ----------------------------------------------------------------------------------------------
C.push(no("E-n-summary", "Write a summary of the drawings a lift station needs"));
C.push(no("E-n-spec", "Give me a specification for lift station drawings"));
C.push(no("E-n-list", "Write a list of the schematics a lift station needs"));
C.push(no("E-n-requirements", "Give me the requirements for lift station schematics"));
C.push(no("E-n-estimate", "Write a cost estimate for lift station drawings"));
C.push(no("E-n-what", "What drawings does a lift station need?"));
C.push(no("E-n-do-need", "Do lift stations need a schematic?"));
C.push(no("E-n-does-need", "Does a lift station need a P&ID?"));
C.push(no("E-n-do-i-need", "Do I need a P&ID for a lift station?"));
C.push(no("E-n-will-need", "Will a lift station need a schematic?"));
C.push(no("E-n-explanation", "Write an explanation of the lift station schematic"));
C.push(no("E-n-description", "Give me a description of a lift station schematic"));
C.push(no("E-n-tips", "Give me tips for reading lift station drawings"));
C.push(no("E-n-report", "Write a report on the lift station drawings"));
C.push(no("E-n-dialer", "Write the schematic for the lift station's alarm dialer", "a device of the station: its own schematic"));
C.push(no("E-n-vfds", "Draw the wiring diagram for the lift station's VFDs", "a device of the station"));
C.push(no("E-n-transfer", "Write the schematic for a lift station's generator transfer switch", "a device of the station"));
C.push(no("E-n-lighting", "Draw a schematic of the lighting for a lift station", "a device of the station (1.24.33 took it as the station)"));
C.push(no("E-n-transmitter", "Give me a wiring diagram for the level transmitter at our lift station", "a device of the station"));
C.push(no("E-n-alarm-light", "Write the schematic for the lift station's alarm light", "a device of the station"));
C.push(no("E-n-heater", "Draw the lift station's heater circuit", "a device of the station"));
C.push(no("E-n-booster", "Write the drawings for a booster pump station", "not a wet well's station"));
C.push(no("E-n-plc", "Write a PLC program for a lift station", "a program"));
C.push(no("E-n-fire", "write a schematic for a fire pump station", "not a wet well's station"));
C.push(no("E-n-deck", "Make a slide deck about lift stations", "slides"));
C.push(no("E-n-standards", "Write the standards for lift station drawings"));
C.push(no("E-n-review-checklist", "Write the checklist for reviewing lift station schematics"));
C.push(no("E-n-review", "Write the review of the lift station schematic"));
C.push(no("E-n-index", "Give me the drawing index for a lift station"));
C.push(no("E-n-history", "Give me the history of lift station design drawings"));
C.push(no("E-n-does-show", "Does the lift station schematic show the floats?"));
C.push(no("E-n-do-you-have", "Do you have a lift station schematic?"));
C.push(no("E-n-will-include", "Will the drawings for the lift station include the floats?"));
C.push(no("E-n-table-too", "Give me a schematic for a lift station and a table of the pump sizes", "in parts: a table is another tool's (AI_PARTS)", "low"));
// ---- negations: the station, and only the drawing asked for ------------------------------------------------------
function only(id, q, why, harm) {
  return { id: id, harm: harm || "medium", right: true, input: { q: q }, why: why,
    run: async function (x) {
      if (!isSt(x.N.L, q)) return "not the station: " + lib.ids(x.N.L, q);
      var m = x.N.L.aiAct.build("MAKE STATION: LS\npumps 2\nfloats off lead lag alarm\nEND", q);
      var sh = m && m.plan ? m.plan.show.join(",") : "";
      return sh === "control" ? "" : "draws " + sh + ": the question says no other drawings (ALLNOT keeps allDrawn() false, but a station question naming no view draws all three anyway)";
    } };
}
C.push(only("E-neg-do-not", "Do not include any other drawings; just write the schematic for a lift station", "“do not include any other drawings”", "medium"));
C.push(only("E-neg-already", "Write the schematic for a lift station. I already have the other drawings.", "“I already have the other drawings”", "low"));
C.push(only("E-neg-without", "Write the schematic for a lift station without any other drawings", "“without any other drawings”", "low"));
C.push(only("E-neg-done", "Write the schematic for a lift station; the other drawings are already done.", "“the other drawings are already done”", "low"));
// ---- the bench --------------------------------------------------------------------------------------------------------
C.push({ id: "E-bench-300", harm: "high", right: true, input: { q: "L.aiBenchQuestions and L.aiBenchQuestionsB" },
  why: "Every bench question goes to the tools it went to in 1.24.33, with the same instructions",
  run: async function (x) {
    var qs = (x.N.L.aiBenchQuestions || []).concat(x.N.L.aiBenchQuestionsB || []), bad = [];
    if (qs.length < 300) return "only " + qs.length + " bench questions found";
    qs.forEach(function (b) { if (lib.ids(x.N.L, b.q) !== lib.ids(x.O.L, b.q) || x.N.L.aiAct.prompt(b.q) !== x.O.L.aiAct.prompt(b.q)) bad.push(b.id); });
    return bad.length ? "changed: " + bad.join(", ") : "";
  } });
module.exports = C;
