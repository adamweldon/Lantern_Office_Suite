// cases_b.js -- B: which questions are a whole pump station (AI_STATION's asks: then only MAKE STATION is offered and
// AI_PARTS does not split the question) and which are not. Rule 7: a question is a station only when it can be nothing
// else -- not a house's plumbing, a two-family "duplex", a duplex receptacle, an air compressor, a booster, irrigation,
// chilled-water or cooling-tower pump set, a fire pump, a PLC program, one drawing of a station, or something ELSE made
// about a station (a slide deck, a spreadsheet, a chart, flashcards, a map, a plan). A question that is not a station
// must be offered what 1.24.30 offered it (ad0d654, loaded beside it). Every bench question routes as before except the
// two lift stations, and the instructions every other question gets differ only by the new tool's name in the list.
"use strict";
var H = require("./lib.js");
function now(q) { return { st: !!H.L().aiStation.asks(q), ids: H.ids(q), split: H.split(q) }; }
function was(q) { return { ids: H.ids(q, H.OLD()), split: H.split(q, H.OLD()) }; }
// a whole station: MAKE STATION alone, not split
function S(id, harm, q, right) {
  return { id: id, harm: harm, input: { question: q }, right: right, run: function () {
    var n = now(q);
    return n.st && n.ids === "station" && !n.split ? "" : "not a whole station: offered " + (n.ids || "nothing") + (n.split ? ", split " + n.split : "");
  } };
}
// not a station: offered what 1.24.30 offered (whatever that was), and never MAKE STATION
function N(id, harm, q, right) {
  return { id: id, harm: harm, input: { question: q }, right: right, run: function () {
    var n = now(q), b = was(q);
    if (n.st || /station/.test(n.ids)) return "routed as a whole pump station: only MAKE STATION offered (1.24.30 offered " + (b.ids || "nothing") + (b.split ? ", split " + b.split : "") + ")";
    return n.ids === b.ids && n.split === b.split ? "" : "offered " + (n.ids || "nothing") + (n.split ? " split " + n.split : "") + " (1.24.30: " + (b.ids || "nothing") + (b.split ? " split " + b.split : "") + ")";
  } };
}
var cases = [
  // ---- whole stations ------------------------------------------------------------------------------------------
  S("B-01", "high", H.ADAM_Q, "Adam's question: three drawings of one station."),
  S("B-02", "high", H.Q_B, "Set B's question: three drawings."),
  S("B-03", "high", "Design a duplex lift station", "A station designed whole."),
  S("B-04", "high", "Draw a 2 pump lift station: the control, the plumbing and the float positions", "Three drawings."),
  S("B-05", "medium", "make a parts list and sequence of operation for a duplex sewage pump station", "Its parts list and sequence of operation."),
  S("B-06", "medium", "Draw the wiring and the piping of a sewage pump station", "Two drawings."),
  S("B-07", "medium", "Design a sewage lift station for a small subdivision", "A station designed whole."),
  S("B-08", "medium", "Draw the complete set of drawings for a stormwater pump station", "A storm water station's drawings."),
  S("B-09", "medium", "Can you draw the electrical control and the piping for a duplex wastewater lift station?", "Two drawings, asked politely."),
  S("B-10", "medium", "Lay out a triplex pump station: the piping and the float levels", "Two drawings of a triplex."),
  S("B-11", "medium", "Draw a cross-section of a duplex lift station's wet well and its control panel wiring", "The levels and the control."),
  S("B-12", "medium", "Draw the alternating relay wiring and the float positions for a duplex lift station", "The control and the levels."),
  S("B-13", "medium", "Design a duplex sump pump system for a building's elevator pit: wiring, piping and float levels", "A duplex sump: three drawings."),
  S("B-14", "medium", "Draw the piping and the wiring for a duplex sump pump in a parking garage", "A duplex sump's two drawings."),
  S("B-15", "medium", "Draw the control wiring and the piping for a grinder pump station", "A grinder pump station is a small sewage station."),
  S("B-16", "medium", "Draw the control circuit for a duplex lift station. Then draw the piping.", "Two drawings in two sentences."),
  S("B-17", "low", "Draw a duplex lift station", "A station drawn whole."),
  S("B-18", "low", "Make a parts list for a sewage pump station", "Its parts list."),
  S("B-19", "low", "Draw a wet well with its float switches and the pump piping for a sewage station", "The levels and the piping."),
  { id: "B-20", harm: "low", input: { question: "Write the commissioning checklist for a duplex lift station" },
    right: "The commissioning checks are one of the things MAKE STATION writes (asks() names 'commissioning'): the station offered. Lantern offers the document tool, because 'Write' and 'checklist' are not among the words that show a request (a document is a fair answer too).",
    run: function () { var n = now(this.input.question); return n.ids === "station" ? "" : "offered " + n.ids + " (asks() names commissioning, but 'Write ... checklist' is not read as a request)"; } },
  // ---- one drawing of a station: its own tool --------------------------------------------------------------------
  N("B-21", "high", "Draw the control circuit for a duplex lift station with an alternating relay", "One drawing: MAKE CONTROL."),
  N("B-22", "high", "draw the plumbing for a lift station", "One drawing: MAKE PIPING."),
  N("B-23", "high", "draw a section of the wet well showing where the floats go", "One drawing: MAKE LEVELS."),
  N("B-24", "medium", "Draw the electrical one-line diagram for a lift station", "One drawing."),
  N("B-25", "medium", "Draw the piping and the valve vault for a duplex lift station", "The piping alone."),
  N("B-26", "medium", "Make a table of float heights and pump run times for a duplex lift station", "A table (and the levels): not a station."),
  // ---- not a pump station at all ----------------------------------------------------------------------------------
  N("B-27", "high", "Draw a house with a red roof", "A picture."),
  N("B-28", "high", "Write a PLC program for a duplex lift station's control and piping", "A program."),
  N("B-29", "high", "Design the fire pump station: its control and piping", "A fire pump."),
  N("B-30", "medium", "Write an Arduino sketch to control a duplex lift station's pumps and draw its piping", "A program and a drawing."),
  N("B-31", "medium", "Design a lift station pump control circuit using a PLC", "A PLC's."),
  N("B-32", "medium", "Sketch the floats and the wiring for the sump pit in my basement", "A house's sump (as 1.24.30 had it)."),
  N("B-33", "medium", "Draw the plumbing and the wiring for the sewage ejector in my house", "A house's."),
  N("B-34", "medium", "Design a duplex boiler feed pump system: the control and the piping", "A boiler's pumps."),
  N("B-35", "medium", "Draw the control and the piping for a septic tank effluent pump", "A septic tank's."),
  N("B-36", "medium", "Draw the wiring and the piping for a well pump that supplies drinking water to a house", "A drinking-water well's pump."),
  N("B-37", "medium", "Design the hydraulic power unit: its control circuit and its piping", "Hydraulics."),
  N("B-38", "medium", "Draw the wiring diagram and the floor plan for a duplex apartment", "A two-family house."),
  N("B-39", "medium", "Draw the control circuit for a duplex compressor with an alternating relay", "One drawing of a compressor."),
  N("B-40", "medium", "Draw a fire pump's controller wiring and its piping", "A fire pump."),
  N("B-41", "low", "Explain how a lift station works", "An explanation."),
  N("B-42", "low", "Draw the storm water drainage plan and its piping for a parking lot", "A drainage plan."),
  N("B-43", "medium", "Draw the plumbing and the wiring for a duplex (a two-family house)",
    "A two-family house's plumbing and wiring: not a pump station ('duplex' is its only station word). (1.24.30 already offered MAKE PIPING here; now it is a whole lift station with floats and an alternating relay.)"),
  N("B-44", "medium", "Draw a duplex receptacle wiring diagram and its parts list", "An electrical outlet: not a pump station."),
  N("B-45", "medium", "Design a duplex air compressor: draw the control circuit and the piping", "An air compressor: no wet well, no floats."),
  N("B-46", "medium", "Draw the ladder diagram and the bill of materials for a duplex air compressor", "An air compressor."),
  N("B-47", "medium", "Design a booster pump station for drinking water: the control circuit and the piping", "A booster station runs on pressure, not a wet well's floats."),
  N("B-48", "medium", "Design an irrigation pump station: its control circuit and its piping", "An irrigation station draws from a river or canal on pressure: not a wet well's floats."),
  N("B-49", "medium", "Draw the duplex pump control circuit and the piping for a cooling tower", "Cooling tower pumps."),
  N("B-50", "medium", "Draw the control circuit and the piping for duplex chilled water pumps", "Chilled water pumps."),
  N("B-51", "medium", "Design a pumping station for a water distribution system: the control and the piping", "A water distribution (pressure) station."),
  // ---- something else made ABOUT a station: its own tool --------------------------------------------------------
  N("B-52", "high", "Make a slide deck about lift stations for a city council meeting", "A slide deck: MAKE SLIDES, as 1.24.30 offered."),
  N("B-53", "high", "Make a spreadsheet of lift station pump run hours for each month", "A spreadsheet."),
  N("B-54", "high", "Make flashcards about lift station parts", "Flashcards."),
  N("B-55", "medium", "Draw a bar chart of the flow into a lift station each hour", "A chart."),
  N("B-56", "high", "Plan a maintenance schedule for our lift station", "A plan."),
  N("B-57", "medium", "Make a budget for a new lift station", "A budget (a sheet)."),
  N("B-58", "medium", "Make a checklist for the weekly inspection of a lift station", "A checklist (a document)."),
  N("B-59", "medium", "Make a calendar for lift station maintenance", "A calendar (a plan)."),
  N("B-60", "medium", "Make a table comparing duplex and triplex lift stations", "A table."),
  N("B-61", "medium", "Draw a map of the lift stations in our town", "A map."),
  N("B-62", "medium", "Draw a cartoon of a lift station for a children's book", "A picture for a book."),
  N("B-63", "low", "Create a quiz about sewage pump stations", "A quiz."),
  N("B-64", "low", "Design a logo for a pump station company", "A logo."),
  N("B-65", "low", "Make a timeline of the lift station project", "A timeline."),
  N("B-66", "low", "Create a lesson plan about how a sewage pump station works", "A lesson plan."),
  N("B-67", "low", "Write a song about a sewage pump station", "A song."),
  N("B-68", "low", "Make a pie chart of the costs of a lift station: pumps 40000, panel 15000, wet well 30000", "A pie chart."),
  { id: "B-69", harm: "low", input: { question: "What is the sequence of operation of a duplex lift station?" },
    right: "An explanation: MAKE STATION may be offered (it writes the sequence), but Chat must not demand a block when the model answers in prose (it is not a request to make).",
    run: function () {
      return H.turn(this.input.question, ["A duplex lift station runs one pump at a time: the lead float starts the lead pump, which runs down to the off float; the alternating relay changes over each cycle, and the lag float starts the second pump."]).then(function (t) {
        return t.calls === 1 ? "" : "Chat asked for a block after a prose answer (" + t.calls + " calls)";
      });
    } },
  { id: "B-70", harm: "low", input: { question: "I need the control panel wiring and the wet well float settings for our 2-pump lift station" },
    right: "Two drawings asked without a drawing verb: as 1.24.30 had it (split into the control and the levels), or a station. Not offered nothing and not split.",
    run: function () { var n = now(this.input.question), b = was(this.input.question); return n.st || (n.ids === b.ids && n.split === b.split) ? "" : "offered " + n.ids + " split " + n.split; } },
  { id: "B-73", harm: "medium", input: { question: "Draw a duplex lift station's control circuit and piping, then make a slide deck about it for the council" },
    right: "Two drawings of a station and a slide deck: the deck is still asked for (split, or MAKE SLIDES offered beside MAKE STATION). Not: MAKE STATION alone, the question not split, the deck never asked for.",
    run: function () { var n = now(this.input.question); return /slides/.test(n.ids) || /SLIDES/.test(n.split) ? "" : "offered " + n.ids + (n.split ? " split " + n.split : ", not split") + ": the slide deck is never asked for"; } },
  { id: "B-74", harm: "medium", input: { question: "Design a duplex lift station and write the PLC program for it" },
    right: "A station and its PLC program: not MAKE STATION alone; the program offered (1.24.30 offered only the program; now the question is split, the station first and then the program -- better).",
    run: function () { var n = now(this.input.question); return !n.st && /code/.test(n.ids) ? "" : "offered " + n.ids + (n.split ? " split " + n.split : ""); } },
  // ---- the bench ---------------------------------------------------------------------------------------------------
  { id: "B-71", harm: "high", input: { question: "every bench question (sets A and B)" },
    right: "Every bench question is offered the tools 1.24.30 offered, split as it split, with the same short prompt, except make-liftstation and make-liftstation-b (now MAKE STATION alone).",
    run: function () {
      var N0 = H.L(), B0 = H.OLD(), out = [];
      var all = (N0.aiBenchQuestions || []).concat(N0.aiBenchQuestionsB || []);
      all.forEach(function (it) {
        var a = H.ids(it.q, B0) + "|" + H.split(it.q, B0) + "|" + B0.aiAct.prompt(it.q).length, b = H.ids(it.q, N0) + "|" + H.split(it.q, N0) + "|" + N0.aiAct.prompt(it.q).length;
        if (a !== b && !/^make-liftstation(-b)?$/.test(it.id)) out.push(it.id + ": " + b + " (was " + a + ")");
        if (/^make-liftstation(-b)?$/.test(it.id) && H.ids(it.q, N0) !== "station") out.push(it.id + " is not MAKE STATION alone");
      });
      return all.length < 250 ? "only " + all.length + " bench questions" : out.join("; ");
    } },
  { id: "B-72", harm: "medium", input: { question: "every bench question's whole instructions (CHAT.buildSystem)" },
    right: "What each other bench question is sent differs from 1.24.30 by the new tool's name in the list of what Lantern makes, and nothing else (the long list is in every prompt; the model's cache is still shared by the whole run).",
    run: function () {
      return Promise.all([H.ready(), Promise.resolve(H.OLD().ai.detect())]).then(function () {
        var N0 = H.L(), B0 = H.OLD(), out = [], n = 0;
        (N0.aiBenchQuestions || []).concat(N0.aiBenchQuestionsB || []).forEach(function (it) {
          if (/^make-liftstation(-b)?$/.test(it.id)) return;
          var a = B0.CHAT.buildSystem(it.q), b = N0.CHAT.buildSystem(it.q);
          if (a === b) return;
          n++;
          if (b.replace("a pump station (Writer, and each drawing in Draw), ", "") !== a) out.push(it.id);
        });
        return out.length ? "differs otherwise: " + out.slice(0, 8).join(", ") : "";
      });
    } }
];
module.exports = cases;
