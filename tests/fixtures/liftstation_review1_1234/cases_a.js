// cases_a.js -- A: which tool (AI_STATION asks(): WHOLE's new verbs, ALLDRAW). The draft beside 1.24.33 (0dfc9d8).
// Over-reach first: documents, plans, lists, questions asked in words, other machines of a station, a question in parts;
// then the guard: the station questions the change is for, other kinds of station, programs, decks; then the bench.
"use strict";
var H = require("./lib.js");

function station(q) { return H.ids(q) === "station"; }
function routeOf(q, which) { return H.ids(q, which) + " | split " + H.split(q, which); }
// over-reach: the tool(s) 1.24.33 offered are kept
function keeps(id, harm, q, right) {
  return { id: id, harm: harm, input: { question: q }, right: right, run: function () { return H.boot().then(function () {
    var a = routeOf(q), b = routeOf(q, "old");
    return a === b ? "" : "offered " + a + " (1.24.33: " + b + ")"; }); } };
}
// the question is not the station's (whatever 1.24.33 did)
function notStation(id, harm, q, right) {
  return { id: id, harm: harm, input: { question: q }, right: right, run: function () { return H.boot().then(function () {
    return station(q) || H.L().aiStation.asks(q) ? "offered MAKE STATION only (1.24.33: " + routeOf(q, "old") + ")" : ""; }); } };
}
// guard: the station's, one MAKE STATION block, whole
function isStation(id, harm, q, right) {
  return { id: id, harm: harm, input: { question: q }, right: right, run: function () { return H.boot().then(function () {
    if (!station(q)) return "offered " + routeOf(q) + " (1.24.33: " + routeOf(q, "old") + ")";
    var p = H.L().aiAct.prompt(q);
    return /MAKE STATION: <title>/.test(p) && !/MAKE SCHEMATIC: <title>/.test(p) ? "" : "the prompt is not MAKE STATION's alone"; }); } };
}

module.exports = [
  // --- the question that prompted the change, and its kin --------------------------------------------------------
  isStation("A-01", "high", "write a schematic for a typical lift station. Include any other drawings a lift station would need", "Adam's question: MAKE STATION, whole (the change's aim)."),
  isStation("A-02", "medium", "Write a schematic for a lift station", "A lift station's schematic written: the station (drawn was already)."),
  isStation("A-03", "medium", "Can you write me a schematic for a lift station?", "Asked politely: still a request to make it."),
  isStation("A-04", "medium", "Please write a schematic for a lift station", "The station."),
  isStation("A-05", "medium", "Give me a schematic of a duplex lift station", "The station."),
  isStation("A-06", "medium", "Provide the schematic for a wastewater pump station", "The station."),
  isStation("A-07", "medium", "Give me a schematic for a storm water pump station", "A storm water station is a wet well's: the station."),
  isStation("A-08", "medium", "Draft a set of drawings for a duplex lift station", "A set of drawings: the whole station (1.24.33 offered nothing)."),
  isStation("A-09", "medium", "Put together a drawing package for a lift station", "A drawing package: the station."),
  isStation("A-10", "medium", "Write all the other drawings a lift station needs", "The station's drawings asked to be made."),
  isStation("A-11", "low", "Write a schematic for a lift station with three pumps", "A triplex: the station (Lantern says the control is a controller maker's)."),
  isStation("A-12", "low", "Prepare the electrical and piping drawings for a lift station", "Two drawings named: the station (as on 1.24.33)."),

  // --- documents, plans and calculations: their own tool, or words ----------------------------------------------------
  keeps("A-13", "high", "Write a plan for replacing the pumps at our lift station", "A plan of work is the Planner's (MAKE PLAN), as 1.24.33 offered: not three drawings of a station."),
  keeps("A-14", "high", "Give me a plan for maintaining a lift station", "A maintenance plan is MAKE PLAN's (1.24.33), not MAKE STATION's."),
  keeps("A-15", "high", "Put together a training plan for lift station operators", "A training plan is MAKE PLAN's (1.24.33)."),
  keeps("A-16", "high", "Give me a plan of action for a lift station overflow", "An action plan for an overflow: MAKE PLAN (1.24.33)."),
  keeps("A-17", "high", "Write up an emergency response plan for a lift station failure", "An emergency response plan: MAKE PLAN (1.24.33)."),
  keeps("A-18", "high", "Write a report listing the drawings a lift station requires", "A report is a document (1.24.33 offered DOC): ALLDRAW must not outrank OTHER_DOC."),
  keeps("A-19", "medium", "Provide a list of drawings required for a lift station permit", "A list of the drawings is words (or a document), not the drawings made."),
  keeps("A-20", "medium", "Write the drawing index for a lift station", "A drawing index is a list of sheet names, not the drawings."),
  keeps("A-21", "medium", "Write a plan to clean the lift station wet well", "Cleaning a wet well: words (with its confined-space cautions), not three drawings (1.24.33: no tool)."),
  keeps("A-22", "medium", "Give me a lift station design calculation", "A calculation (wet well volume, cycle time): the calculator's way, not MAKE STATION (1.24.33: no tool)."),
  keeps("A-23", "medium", "Write a plan to bypass pump a lift station", "Bypass pumping is a plan in words (1.24.33: no tool)."),
  notStation("A-24", "medium", "Write a description of a lift station", "A description: words."),
  notStation("A-25", "medium", "Write the specification for a lift station", "A specification: words."),
  notStation("A-26", "low", "Write a lift station SOP", "An SOP: a document (MAKE DOC)."),
  notStation("A-27", "low", "Generate a maintenance checklist for a lift station", "A checklist: MAKE DOC."),
  notStation("A-28", "low", "Write a song about all the drawings a lift station needs", "A song: MAKE MUSIC."),
  notStation("A-29", "low", "Write an essay on the drawings a lift station needs", "An essay: a document."),
  notStation("A-30", "low", "Prepare a budget for a lift station", "A budget: MAKE SHEET."),

  // --- asked in words -------------------------------------------------------------------------------------------------
  keeps("A-31", "high", "Give me an overview of lift station design", "An overview is answered in words (1.24.33: no tool); MAKE STATION's prompt says Reply with ONE block."),
  keeps("A-32", "medium", "Give me tips on lift station design", "Tips: words."),
  keeps("A-33", "medium", "Do I need any other drawings for a lift station?", "A yes-or-no question about drawings: answered in words."),
  keeps("A-34", "medium", "Are there any other drawings a lift station needs?", "A question in words."),
  keeps("A-35", "medium", "Is a P&ID one of the drawings a lift station needs?", "A question in words."),
  keeps("A-36", "medium", "List the drawings a lift station needs", "Listing them is words, not drawing them."),
  keeps("A-37", "medium", "I need to know which drawings a lift station requires", "To know which: words."),
  keeps("A-38", "low", "Give me a rundown of the drawings a lift station needs", "A rundown: words."),
  notStation("A-39", "medium", "What drawings does a lift station need?", "Asked in words (the draft's own guard)."),
  notStation("A-40", "low", "Tell me what drawings a lift station needs", "Asked in words."),

  // --- another machine of a station, or another station -----------------------------------------------------------------
  keeps("A-41", "medium", "Write a schematic for a lift station's alarm dialer", "An alarm dialer's circuit is a schematic of its own (1.24.33). (\x22Draw ...\x22 already went to MAKE STATION on 1.24.33: the draft spreads that to \x22write\x22.)"),
  keeps("A-42", "medium", "Write a schematic for a lift station's VFDs", "VFDs are drives, not the station's three drawings (as A-41: \x22draw\x22 already over-reached on 1.24.33)."),
  keeps("A-43", "medium", "Write a schematic for the lift station's SCADA RTU", "An RTU's wiring: a schematic of its own."),
  keeps("A-44", "medium", "Write a schematic for a lift station's level transmitter", "A transmitter's loop wiring, not the station."),
  keeps("A-45", "medium", "Write a schematic for the lift station's emergency lighting", "Emergency lighting: a circuit of its own."),
  keeps("A-46", "low", "Write a schematic for the lift station's alarm light", "One alarm light's circuit (hm: the station's control has it, so low)."),
  keeps("A-47", "medium", "Draw a lift station, and a motor starter circuit with any other drawings it needs", "Two things asked (1.24.33 split it STATION + CONTROL): ALLDRAW in the starter's part must not make it the station's."),
  notStation("A-48", "medium", "write a schematic for a fire pump station", "A fire pump station is not a wet well's."),
  notStation("A-49", "medium", "Write a schematic for a booster pump station", "A booster station: not a wet well's."),
  notStation("A-50", "low", "Write a schematic for a gas compressor station", "A compressor station."),
  notStation("A-51", "low", "Write a schematic for an irrigation pump station", "Irrigation: not a wet well's."),
  notStation("A-52", "low", "Write a schematic for a chilled water pump station", "Chilled water: not a wet well's."),
  notStation("A-53", "low", "Write a schematic for the lift station's generator", "A generator's circuit."),
  notStation("A-54", "low", "Write the schematic for a lift station's odor control fan", "A fan's circuit."),
  notStation("A-55", "medium", "Write a PLC program for a lift station", "A program: MAKE CODE."),
  notStation("A-56", "medium", "Make a slide deck about lift stations for the council", "A deck: MAKE SLIDES."),
  notStation("A-57", "low", "Write the control schematic for a lift station", "One drawing named (the control): MAKE SCHEMATIC / CONTROL, as 1.24.33."),
  { id: "A-58", harm: "medium", input: { question: "Write a schematic for a typical lift station and write the PLC program" },
    right: "In parts: the station and the program (1.24.33: SCHEMATIC + CODE).",
    run: function () { return H.boot().then(function () { var s = H.split("Write a schematic for a typical lift station and write the PLC program"); return s === "STATION+CODE" ? "" : "split " + s; }); } },
  { id: "A-59", harm: "medium", input: { question: "Write a schematic for a lift station and a slide deck about it" },
    right: "In parts: the station and the deck.",
    run: function () { return H.boot().then(function () { var s = H.split("Write a schematic for a lift station and a slide deck about it"); return s === "STATION+SLIDES" ? "" : "split " + s; }); } },

  // --- the bench: every question, ideal and saved reply ---------------------------------------------------------------
  { id: "A-60", harm: "high", input: { question: "every bench question (sets A and B) but the new one" },
    right: "Offered the same tools, split and prompt as on 1.24.33.",
    run: function () { return H.boot().then(function () {
      var by0 = {}, bad = []; H.bench0().forEach(function (x) { by0[x.id] = x; });
      H.bench().forEach(function (x) { if (!by0[x.id]) return; if (routeOf(x.q) !== routeOf(x.q, "old") || H.L().aiAct.prompt(x.q) !== H.L0().aiAct.prompt(x.q)) bad.push(x.id); });
      return bad.length ? bad.join(", ") : ""; }); } },
  { id: "A-61", harm: "high", input: { question: "every bench ideal (sets A and B) but the new one, on the bench's path (solve)" },
    right: "Graded as on 1.24.33: the same pass, rounds, summary and problems.",
    run: function () { return H.boot().then(async function () {
      var by0 = {}, bad = []; H.bench0().forEach(function (x) { by0[x.id] = x; });
      var B = H.bench();
      for (var i = 0; i < B.length; i++) {
        var it = B[i], it0 = by0[it.id];
        if (!it0 || !it.ideal) continue;
        var r1 = await H.L().aiAct.solve(it.q, H.seq([it.ideal])), r0 = await H.L0().aiAct.solve(it0.q, H.seq([it0.ideal]));
        var g1 = H.L().aiBench.grade(it, r1.text, r1), g0 = H.L0().aiBench.grade(it0, r0.text, r0);
        if (JSON.stringify([g1.pass, r1.rounds, r1.made && r1.made.summary, r1.made && r1.made.problems]) !== JSON.stringify([g0.pass, r0.rounds, r0.made && r0.made.summary, r0.made && r0.made.problems])) bad.push(it.id);
      }
      return bad.length ? bad.join(", ") : ""; }); } },
  { id: "A-62", harm: "high", input: { question: "every model reply with a MAKE block kept in tests/fixtures/bench_run_*.json (312 distinct)" },
    right: "Built as 1.24.33 built it: ok, readAs, problems and summary the same.",
    run: function () { return H.boot().then(function () {
      var rows = H.benchReplies(), bad = [];
      function s(r) { return r ? JSON.stringify([r.ok, r.readAs || "", (r.problems || []).join(";"), r.summary || ""]) : "null"; }
      rows.forEach(function (r) { var a, b; try { a = s(H.L().aiAct.build(r.reply, r.q)); } catch (e) { a = "threw " + e; } try { b = s(H.L0().aiAct.build(r.reply, r.q)); } catch (e) { b = "threw " + e; } if (a !== b) bad.push(r.f + " " + r.id); });
      return rows.length < 300 ? "only " + rows.length + " replies" : bad.length ? bad.length + " differ: " + bad.slice(0, 6).join(", ") : ""; }); } },
  { id: "A-63", harm: "high", input: { question: "every saved bench reply, on the bench's path (the reply repeated for any further call)" },
    right: "Graded as on 1.24.33: the same pass, reason and rounds.",
    run: function () { return H.boot().then(async function () {
      var by = {}, by0 = {}, bad = [], rows = H.benchReplies(); H.bench().forEach(function (i) { by[i.id] = i; }); H.bench0().forEach(function (i) { by0[i.id] = i; });
      for (var k = 0; k < rows.length; k++) { var r = rows[k], it = by[r.id], it0 = by0[r.id]; if (!it || !it0) continue;
        var f = function () { return Promise.resolve(r.reply); };
        var a = await H.L().aiAct.solve(it.q, f), b = await H.L0().aiAct.solve(it0.q, f), ga = H.L().aiBench.grade(it, a.text, a), gb = H.L0().aiBench.grade(it0, b.text, b);
        if (ga.pass !== gb.pass || ga.why !== gb.why || a.rounds !== b.rounds) bad.push(r.f + " " + r.id); }
      return bad.length ? bad.length + " differ: " + bad.slice(0, 6).join(", ") : ""; }); } },
  { id: "A-64", harm: "high", input: { question: "every saved bench reply as a whole Chat turn (the reply repeated for any further call)" },
    right: "rec.made, the number of calls and of notes as on 1.24.33 (rec.more is new and may hold the reply's other blocks).",
    run: function () { return H.boot().then(async function () {
      var rows = H.benchReplies(), bad = [];
      for (var k = 0; k < rows.length; k++) { var r = rows[k], a = await H.turn(r.q, [r.reply]), b = await H.turn(r.q, [r.reply], "old");
        if (JSON.stringify([a.calls, a.made, a.notes.length, a.error || ""]) !== JSON.stringify([b.calls, b.made, b.notes.length, b.error || ""])) bad.push(r.f + " " + r.id); }
      return bad.length ? bad.length + " differ: " + bad.slice(0, 6).join(", ") : ""; }); } }
  ,
  { id: "A-65", harm: "high", input: { question: "Give me an overview of lift station design", replies: ["ANSWER: <an overview in words>", "MAKE STATION ..."] },
    right: "the model's overview in words is the answer (1.24.33: one call, the prose shown); Lantern does not press for a MAKE STATION block in its place.",
    run: function () { return H.boot().then(function () {
      var prose = "ANSWER: A lift station is designed around its wet well, pumps and controls. Size the wet well for the cycle time, choose two pumps each able to take the peak flow, and provide alarms.";
      return H.turn("Give me an overview of lift station design", [prose, "MAKE STATION: Lift station\npumps 2\nEND"]).then(function (t) { return t.calls === 1 ? "" : t.calls + " calls: " + t.notes.join(" | ").slice(0, 200) + "; made " + t.made; }); }); } }
];
