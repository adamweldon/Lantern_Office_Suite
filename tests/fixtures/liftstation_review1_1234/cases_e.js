// cases_e.js -- E: Chat's other blocks (AI_ACTIONS rest(); ASSIST_CHAT: rec.more, restHeld across a correction). Whole
// Chat turns against a scripted model (load.js), the replies written here. Right: each block the model wrote is made
// and shown once, with what Lantern found; nothing is shown that the model did not write as a block; what the first
// block took in is not made again; rec.made (what the bench scores) is the first block's, as before.
"use strict";
var fs = require("fs"), path = require("path");
var H = require("./lib.js");
var P = H.parts, W = H.wires;
var Q = "write a schematic for a typical lift station. Include any other drawings a lift station would need";
var CHAT = JSON.parse(fs.readFileSync(path.join(H.ROOT, "tests/fixtures/liftstation_1234/chat_35b.json"), "utf8"));
var R1 = CHAT.replies[0].reply;
var ST = H.blk("STATION", "Lift station", ["pumps 2", "floats off lead lag alarm"]);
var CTL = H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]);
var PIP = H.blk("PIPING", "Piping", ["well \x22wet well\x22", "pump P1", "pump P2", "valve V1 P1 gate", "valve V2 P2 gate", "header \x22force main\x22"]);
var LEV = H.blk("LEVELS", "Levels", ["well \x22wet well\x22 10 ft", "pump P1 P2", "float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22 3 ft", "float FS3 \x22lag on\x22 4 ft", "float FS4 \x22high level alarm\x22 5 ft"]);
var ELEC = H.sch("Lift Station Electrical", ["mode electrical"].concat(P([["V1", "source", "480 V"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"], ["F1", "sensor", "Low Level Float"], ["F2", "sensor", "High Level Float"], ["F3", "sensor", "High High Level Alarm"]])).concat(W(["V1 M1", "M1 V1"])));
var QL = "Draw a circuit with a battery, a switch and a lamp";
var LAMP_BAD = H.sch("Lamp circuit", P([["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"]]).concat(W(["B1 S1", "S1 L1"])));
var LAMP_OK = H.sch("Lamp circuit", P([["B1", "battery", "9 V"], ["S1", "switch"], ["L1", "lamp"]]).concat(W(["B1 S1", "S1 L1", "L1 B1"])));
var LAMP2 = H.sch("Lamp circuit", P([["B1", "battery", "9 V"], ["L1", "lamp"], ["L2", "lamp"]]).concat(W(["B1 L1", "L1 L2", "L2 B1"])));
var TB = H.blk("SHEET", "Values", ["| Part | Value |", "| Battery | 9 V |", "| Lamp | 0.5 A |"]);
function T(id, harm, q, replies, right, judge) {
  return { id: id, harm: harm, input: { question: q, replies: replies }, right: right, run: function () { return H.boot().then(function () { return H.turn(q, replies).then(function (t) { return t.error ? "threw " + t.error.slice(0, 300) : judge(t); }); }); } };
}
function desc(t) { return "calls " + t.calls + ", made " + t.made + ", more " + JSON.stringify(t.more); }

module.exports = [
  // --- the guard ----------------------------------------------------------------------------------------------------
  T("E-01", "high", Q, [R1], "Adam's question, the 35B's reply: the station made from both blocks, nothing asked again, neither block made again on its own.",
    function (t) { return t.calls === 1 && /SCHEMATIC.*>STATION$/.test(t.made) && !t.more.length ? "" : desc(t); }),
  T("E-02", "medium", QL, [LAMP_OK + "\n\nHere are its values too:\n\n" + TB], "a circuit and a table in one reply: both made and shown, the table once.",
    function (t) { return t.calls === 1 && /^SCHEMATIC/.test(t.made) && t.more.length === 1 && /^SHEET:Values$/.test(t.more[0]) ? "" : desc(t); }),
  T("E-03", "medium", "Draw a circuit with a battery and a lamp, and make a table of its values", [LAMP_OK + "\n\n" + TB], "a question in parts keeps its own way (AI_PARTS): both made as its parts, nothing in rec.more.",
    function (t) { var ms = (t.rec.mades || []).map(function (m) { return m.block.kind; }).join(","); return ms === "SCHEMATIC,SHEET" && !t.more.length ? "" : "mades " + ms + "; " + desc(t); }),
  T("E-04", "medium", QL, [LAMP_BAD + "\n\n" + TB, LAMP_OK], "the first block sent back, the table beside it kept and shown after the corrected one.",
    function (t) { return t.calls === 2 && !/not made/.test(t.made) && t.more.length === 1 && /^SHEET/.test(t.more[0]) ? "" : desc(t); }),
  { id: "E-05", harm: "medium", input: { question: QL, reply: "the block, then the instructions' own example copied word for word" },
    right: "the instructions' example copied after the model's block is not made.",
    run: function () { return H.boot().then(function () {
      var ex = H.L().aiAct.prompt(QL).split("\n"), at = ex.indexOf("For example:"), exBlock = at >= 0 ? ex.slice(at + 1).join("\n") : "";
      if (!exBlock) return "no example in the prompt";
      return H.turn(QL, [LAMP_OK + "\n\n" + exBlock]).then(function (t) { return t.more.length ? desc(t) : ""; }); }); } },
  T("E-06", "low", QL, [LAMP_OK + "\n\nAgain:\n\n" + LAMP_OK], "the same block twice: made once.", function (t) { return t.more.length ? desc(t) : ""; }),
  T("E-07", "medium", Q, [CTL + "\n\n" + PIP + "\n\n" + LEV], "a station's three drawings' blocks: one station, none made again on its own.",
    function (t) { return t.calls === 1 && /STATION$/.test(t.made) && !t.more.length ? "" : desc(t); }),
  T("E-08", "medium", "make a slide deck about ladder safety", ["MAKE SLIDES: Ladder Safety\n# Inspect\n- feet, rungs\nEND\n\nMAKE SLIDES: Ladder Safety\n# Set up\n- 4 to 1\nEND"],
    "a deck written as two MAKE SLIDES blocks: joined, one deck, nothing made again.", function (t) { return t.more.length ? desc(t) : ""; }),
  { id: "E-09", harm: "high", input: { question: Q, reply: "R1 on the bench's path" },
    right: "the bench (solve): the 35B's reply is the station, one round; rest() does not touch it.",
    run: function () { return H.boot().then(function () { return H.L().aiAct.solve(Q, H.seq([R1])).then(function (o) { return o.rounds === 1 && o.made && o.made.readAs === "STATION" && o.made.ok ? "" : "rounds " + o.rounds + " made " + (o.made && o.made.readAs) + " ok " + (o.made && o.made.ok); }); }); } },
  T("E-10", "medium", Q, [H.sch("Lift Station Electrical", P([["V1", "source", "120 V"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"], ["F1", "float", "Float A"], ["F2", "sensor", "Low Level Float"]]).concat(W(["V1 M1", "M1 V1"]))) + "\n\n" +
    H.sch("Lift Station Piping", ["mode fluid"].concat(P([["W1", "tank", "Wet Well"], ["P1", "pump", "Pump 1"], ["P2", "pump", "Pump 2"]])).concat(W(["W1 P1", "W1 P2"]))), ST],
    "a station read from two part-and-wire blocks, one float with no job: back once as MAKE STATION; neither block shown again after.",
    function (t) { return t.calls === 2 && /^STATION/.test(t.made) && !t.more.length ? "" : desc(t); }),
  T("E-11", "high", QL, [LAMP_OK + "\n\n" + TB], "rec.made is the first block (what Chat shows first and what a bench run reads), the table in rec.more.",
    function (t) { return /^SCHEMATIC:Lamp circuit$/.test(t.made) ? "" : desc(t); }),
  T("E-12", "low", "Write a Python script that prints the average of the temp column of a CSV file", [TB + "\n\nMAKE CODE: Average\nlanguage python\nimport csv\nrows = list(csv.DictReader(open(\x22data.csv\x22)))\nprint(sum(float(r[\x22temp\x22]) for r in rows) / len(rows))\nEND"],
    "a table, then the program asked for: the program is shown too (1.24.33 never showed it).", function (t) { return t.more.some(function (m) { return /^CODE/.test(m); }) ? "" : desc(t); }),
  // --- shown twice, shown wrong, or lost ---------------------------------------------------------------------------------
  T("E-20", "medium", Q, [ST + "\n\nAnd the electrical:\n\n" + ELEC], "a MAKE STATION block and a part-and-wire schematic of the same station: one station (the schematic read into it, or named as not drawn) -- not a second whole station from the schematic, with its own floats.",
    function (t) { return t.more.some(function (m) { return />STATION/.test(m); }) ? "a second station shown: " + desc(t) : ""; }),
  T("E-21", "medium", Q, [ST + "\n\n" + CTL], "MAKE STATION then MAKE CONTROL: the control is the station's (one station), not a second whole station with its own piping and levels.",
    function (t) { return t.more.some(function (m) { return />STATION/.test(m); }) ? "a second station shown: " + desc(t) : ""; }),
  T("E-22", "medium", Q, [ST + "\n\n" + PIP], "MAKE STATION then MAKE PIPING: one station.",
    function (t) { return t.more.some(function (m) { return />STATION/.test(m); }) ? "a second station shown: " + desc(t) : ""; }),
  T("E-23", "medium", QL, [LAMP_BAD + "\n\nAnd another:\n\n" + LAMP2, LAMP_OK], "two circuits with the same title, the first sent back: the second (a right circuit) is still shown after the correction -- a title is not the block.",
    function (t) { return t.more.length === 1 ? "" : "the second circuit lost: " + desc(t); }),
  T("E-24", "medium", QL, [LAMP_BAD + "\n\n" + TB, "Sorry, I cannot fix that circuit."], "the correction answered in prose: the table the first reply had is still shown (it was held for after the correction).",
    function (t) { return t.more.some(function (m) { return /^SHEET/.test(m); }) ? "" : "the table lost: " + desc(t); }),
  T("E-25", "medium", QL, [LAMP_OK + "\n\n**Make sure:** the battery is 9 V before you close the switch."], "a sentence \x22Make sure: ...\x22 after the block is prose: nothing more shown (not \x22Lantern cannot make a sure\x22).",
    function (t) { return t.more.length ? "shown: " + desc(t) : ""; }),
  T("E-26", "low", QL, [LAMP_OK + "\n\nMake note: the lamp is rated 9 V."], "\x22Make note: ...\x22 is prose: nothing more shown.", function (t) { return t.more.length ? "shown: " + desc(t) : ""; }),
  T("E-27", "medium", Q, [H.blk("STATION", "Lift station", ["pumps 3", "floats off lead lag alarm"]) + "\n\n" + H.blk("STATION", "Lift Station", ["pumps 2", "floats off lead lag alarm"])],
    "the instructions' example copied with one capital letter changed: not a second station of another count (3 pumps and then 2).",
    function (t) { return t.more.length ? "shown: " + desc(t) : ""; }),
  T("E-28", "low", Q, [H.sch("Lift Station Electrical", P([["V1", "source", "120 V"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"], ["F1", "float", "Float A"], ["F2", "sensor", "Low Level Float"]]).concat(W(["V1 M1", "M1 V1"]))), ST],
    "what Chat says when a part-and-wire block goes back: the AI wrote MAKE SCHEMATIC, so not \x22Lantern checked the MAKE STATION block\x22.",
    function (t) { var n = t.notes.filter(function (x) { return /Lantern checked the MAKE/.test(x); })[0] || ""; return /checked the MAKE STATION block/.test(n) ? n.slice(0, 200) : ""; }),
  T("E-29", "low", QL, [LAMP_BAD + "\n\n" + TB, LAMP_OK + "\n\n" + TB.replace("MAKE SHEET: Values", "MAKE SHEET: Values table")], "the table rewritten under a new title in the corrected reply: shown once.",
    function (t) { return t.more.length === 1 ? "" : desc(t); })
  ,
  T("E-30", "high", Q, [CTL + "\n\nAnd the piping:\n\n" + R1.slice(R1.indexOf("MAKE SCHEMATIC: Lift Station Piping"))],
    "Adam's question, a MAKE CONTROL and a part-and-wire piping block: the piping the model wrote is drawn -- in the station, or shown on its own -- not taken in and dropped.",
    function (t) { var v = t.rec.made && t.rec.made.plan && t.rec.made.plan.views ? Object.keys(t.rec.made.plan.views).sort().join(",") : ""; return /piping/.test(v) || t.more.length ? "" : "made " + t.made + " with " + v + " only; more " + JSON.stringify(t.more); })
];
