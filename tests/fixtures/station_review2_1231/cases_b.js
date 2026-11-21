// cases_b.js -- B: which tool a question is given (Lantern.aiStation.asks, aiAct.relevant, aiParts.split). A station
// asked for whole gets MAKE STATION alone; a station's drawings beside another tool's thing are one STATION part; one
// drawing alone stays its own tool; nothing that is not a wet well's station is taken whole, and nothing asked for
// beside a station is lost. Every bench question is a guard: those that are not stations route as in 1.24.30
// (before.json, made by make_before.js from commit ad0d654).
"use strict";
var H = require("./lib.js");
function got(q) { return { asks: H.L().aiStation.asks(q), ids: H.ids(q), split: H.split(q) }; }
function show(g) { return "asks " + g.asks + ", offered [" + g.ids + "], split " + g.split; }
function R(id, harm, q, right, judge) { return H.C(id, harm, { question: q }, right, function () { var g = got(q), r = judge(g, q); return r ? r + " -- " + show(g) : ""; }); }
function whole(g) { return g.asks && g.ids === "station" && !g.split ? "" : "not the station whole"; }
function notWhole(g) { return !g.asks && !/station/.test(g.ids) && !/STATION/.test(g.split || "") ? "" : "taken as a station"; }
function splitIs(k) { return function (g) { return g.split === k ? "" : "split is not " + k; }; }
function asBefore(g, q) {
  var b = H.before("rel:" + q), s = H.before("split:" + q);
  if (b === undefined) return "";
  return g.ids === b && g.split === s ? "" : "changed from 1.24.30 (offered [" + b + "], split " + s + ")";
}
var cases = [
  // ---- a station asked for whole: MAKE STATION alone ---------------------------------------------------------
  R("B-01", "high", H.ADAM_Q, "Adam's question: the station whole.", whole),
  R("B-02", "high", "Design a duplex lift station", "A station designed: whole.", whole),
  R("B-03", "medium", "Design a sewage pump station: control, piping and float settings", "Its three drawings named: whole.", whole),
  R("B-04", "medium", "Draw the control circuit, the piping and the float levels for a duplex sump", "A duplex sump's three drawings: whole.", whole),
  R("B-05", "medium", "Give me a parts list for a duplex sewage lift station", "A station's parts list is the station's (read off its drawings): whole.", whole),
  R("B-06", "medium", "Write the commissioning checklist for our new lift station", "Its commissioning checks: whole.", whole),
  R("B-07", "medium", "Create the drawings for a 2 pump sewage lift station", "Its drawings: whole.", whole),
  R("B-08", "medium", "Draw the ladder diagram and the cross section for a sump with two pumps", "Two of its drawings: whole.", whole),
  R("B-09", "medium", "Sketch the force main and valves and the control wiring of a duplex sewage station", "Its piping and control: whole.", whole),
  R("B-10", "low", "Design a stormwater pumping station for an underpass", "A storm water station designed: whole.", whole),
  R("B-11", "medium", "Draw the electrical and plumbing for a simplex lift station", "A simplex's two drawings: whole.", whole),
  R("B-12", "medium", "Draw the wet well of a duplex lift station with float levels and the piping", "Levels and piping: whole.", whole),
  R("B-13", "medium", "draw the control circuit and the plumbing for a sewage lift station with 2 pumps", "Control and plumbing: whole.", whole),
  R("B-14", "low", "Design a duplex grinder pump station", "A grinder pump station (a small sewage station) designed: whole.", whole),
  R("B-15", "low", "Design the duplex sump pump station for the parking garage: control, piping and float levels", "A garage's sump station: whole.", whole),
  // ---- one drawing alone stays its own tool -----------------------------------------------------------------
  R("B-16", "medium", "Draw the control circuit for a duplex lift station with an alternating relay", "One drawing: MAKE CONTROL (schematic), as in 1.24.30.", function (g) { return g.ids === "schematic" && !g.asks ? "" : "not the control alone"; }),
  R("B-17", "medium", "Draw the plumbing for a lift station", "One drawing: MAKE PIPING.", function (g) { return g.ids === "piping" && !g.asks ? "" : "not the piping alone"; }),
  R("B-18", "medium", "Draw the float levels in a duplex lift station's wet well", "One drawing: MAKE LEVELS.", function (g) { return g.ids === "levels" && !g.asks ? "" : "not the levels alone"; }),
  // ---- questions about a station that ask for no drawing: prose ------------------------------------------------
  R("B-19", "medium", "Explain how a duplex lift station works", "An explanation, not a drawing: no station.", notWhole),
  R("B-20", "medium", "How do the floats in a lift station work?", "A question: no station.", notWhole),
  R("B-21", "medium", "What size pumps does a lift station for 200 homes need?", "A sizing question Lantern cannot answer by drawing: no station.", notWhole),
  R("B-22", "low", "What are the commissioning checks for a lift station?", "Asked as a question: prose (or the station; either is acceptable, prose expected).", notWhole),
  // ---- not a wet well's station, or not the station's drawings: not taken whole ---------------------------------
  R("B-23", "medium", "Draw the wiring and piping for a duplex booster pump station", "A booster station (pressure, no wet well): not MAKE STATION.", notWhole),
  R("B-24", "medium", "Design a pump station for my irrigation pond", "Irrigation: not a sewage station.", notWhole),
  R("B-25", "low", "Draw the control and piping for a duplex condensate pump station", "Condensate: not a wet well's sewage station.", notWhole),
  R("B-26", "medium", "Draw a duplex pump station for the chilled water plant: controls and piping", "Chilled water: not a wet well.", notWhole),
  R("B-27", "low", "Write ladder logic for a duplex lift station: control and float levels", "Ladder logic is a PLC program (MAKE CODE's), not the drawings.", notWhole),
  R("B-28", "low", "Draw a picture of a lift station for my kid's school project", "A picture: the drawing tool, not the station's drawings.", notWhole),
  R("B-29", "low", "Draw a one-line diagram of a duplex lift station's power", "A power one-line (breakers, transfer switch, starters' power) is none of the station's three drawings: not MAKE STATION, whose control circuit is not a one-line.", notWhole),
  R("B-30", "low", "Draw the control circuit and the piping for the lift station's odor control system", "The odor control system (a blower and a carbon bed) is not the pump station: not MAKE STATION, which would draw two sewage pumps and their floats.", notWhole),
  R("B-31", "low", "Draw the wiring of the lift station's generator transfer switch and the piping", "A transfer switch's wiring is not the station's control circuit.", notWhole),
  R("B-32", "low", "Draw the bypass pumping setup for the lift station rehab: the pumps and piping",
    "Bypass pumping (temporary pumps and hoses around a station) is not a station design: not MAKE STATION, and never the station and its piping as two parts.", function (g) { return /STATION/.test(g.split || "") || g.asks ? "taken as a station" : ""; }),
  // ---- a station beside another thing: nothing lost ------------------------------------------------------------
  R("B-33", "medium", "Draw a house with a red roof, then the control circuit and piping of a duplex lift station",
    "Two things: a picture of a house, and the station (control and piping). Taken whole as the station, the house is never asked for. (1.24.30 lost the house too -- it split the question CONTROL+PIPING -- so this is not new, but the whole-question rule keeps it lost.)", function (g) { return g.split && /DRAWING/.test(g.split) && /STATION|CONTROL|SCHEMATIC/.test(g.split) ? "" : "the house is lost"; }),
  R("B-34", "high", "Draw a motor starter circuit, then the piping and the float levels of a duplex lift station",
    "Two things: a motor starter's control circuit (start/stop, not the station's), and the station's piping and levels. Taken whole, the motor starter is never drawn: the station's own alternator circuit stands in its place. (1.24.30 split it CONTROL+PIPING+LEVELS, the starter its own part: a regression.)", function (g) { return g.split && g.split.split("+").length === 2 ? "" : "the motor starter is lost"; }),
  R("B-35", "medium", "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council", "STATION then SLIDES.", splitIs("STATION+SLIDES")),
  R("B-36", "medium", "Draw the control circuit, the piping and the float levels for a duplex lift station. Then make a spreadsheet of the pump run hours", "STATION then SHEET.", splitIs("STATION+SHEET")),
  R("B-37", "medium", "Design a duplex lift station. Then write an Arduino program for its alarm dialer", "STATION then CODE.", splitIs("STATION+CODE")),
  R("B-38", "medium", "Design a duplex lift station and make flashcards for the operators", "STATION then CARDS.", splitIs("STATION+CARDS")),
  R("B-39", "low", "Make a spreadsheet of float heights for a duplex lift station, then draw its control circuit and piping", "SHEET then STATION (two of its drawings, asked after the sheet).", splitIs("SHEET+STATION")),
  R("B-40", "low", "Draw the piping of the lift station and the float levels, then email the contractor", "Two of the station's drawings: one STATION (the e-mail is not a tool's).", function (g) { return g.asks || /^STATION/.test(g.split || "") ? "" : "not one station"; }),
  R("B-41", "low", "Draw the control circuit and the float levels for a duplex lift station and write a quiz for the operators", "STATION and a QUIZ: neither lost.", function (g) { return /STATION/.test(g.split || "") && /QUIZ|CARDS/.test(g.split || "") ? "" : "not the station and the quiz"; }),
  R("B-42", "low", "Design a lift station and give me a budget", "The station and a budget sheet: neither lost.", function (g) { return /STATION/.test(g.split || "") && /SHEET/.test(g.split || "") ? "" : "not the station and the sheet"; }),
  R("B-43", "low", "Draw the control circuit and piping for a duplex lift station, then a song about it", "STATION then MUSIC.", splitIs("STATION+MUSIC")),
  R("B-44", "medium", "Draw the wiring and piping of a sump pump with a backup pump",
    "A sump with a main pump and a backup pump: if taken as a station, two pumps (the backup is a pump). Lantern's station from an empty block must not drop the backup pump.", function (g) {
      if (!g.asks) return "";
      var r = H.build("MAKE STATION: Sump\nEND", "Draw the wiring and piping of a sump pump with a backup pump"), p = H.plan(r);
      return p && p.spec.pumps.length === 2 ? "" : "the station has " + (p ? p.spec.pumps.length : "no") + " pump(s): " + (p ? H.said(p) : "");
    }),
  // ---- every bench question as a guard ------------------------------------------------------------------------
  H.C("B-45", "high", { question: "every bench question (sets A and B, 300)" }, "Only the two lift stations are stations; every other bench question is offered the tools 1.24.30 offered it.",
    function () {
      var bad = [];
      H.bench().forEach(function (it) {
        var a = H.L().aiStation.asks(it.q);
        if (a !== /^make-liftstation/.test(it.id)) bad.push(it.id + (a ? " taken as a station" : " not a station"));
        if (/^make-liftstation/.test(it.id)) return;
        var b = H.before("rel:" + it.q); if (b !== undefined && b !== H.ids(it.q)) bad.push(it.id + " offered [" + H.ids(it.q) + "] (1.24.30 [" + b + "])");
      });
      return bad.join("; ");
    }),
  H.C("B-46", "high", { question: "every bench question (sets A and B, 300)" }, "Every bench question but the lift stations is split as 1.24.30 split it.",
    function () {
      var bad = [];
      H.bench().forEach(function (it) {
        if (/^make-liftstation/.test(it.id)) return;
        var b = H.before("split:" + it.q); if (b !== undefined && b !== H.split(it.q)) bad.push(it.id + " split " + H.split(it.q) + " (1.24.30 " + b + ")");
      });
      return bad.join("; ");
    }),
  H.C("B-47", "medium", { question: "the two lift station bench questions" }, "Both lift stations: MAKE STATION alone, not split, the prompt the station's only.",
    function () {
      var bad = [];
      H.bench().filter(function (it) { return /^make-liftstation/.test(it.id); }).forEach(function (it) {
        if (H.ids(it.q) !== "station" || H.split(it.q)) bad.push(it.id + " " + H.ids(it.q) + " " + H.split(it.q));
        var pr = H.L().aiAct.prompt(it.q); if (!/MAKE STATION: <title>/.test(pr) || /MAKE CONTROL: <title>/.test(pr)) bad.push(it.id + " prompt");
      });
      return bad.join("; ");
    }),
  R("B-48", "low", "Draw the wiring and piping for a lift station, and a flow chart of its sequence", "The station's control and piping as one STATION part, and the flow chart its own.", function (g) { return /STATION/.test(g.split || "") ? "" : "the station's drawings are not one part"; }),
  R("B-49", "low", "Design a lift station control panel", "A control panel for a lift station: at least the control circuit offered (none offered is under-reach; 1.24.30 offered none either).", function (g) { return g.ids ? "" : "no tool offered"; })
];
module.exports = cases;
