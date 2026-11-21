// grammar_samples.js -- the replies this review runs through Lantern's block grammars with llama.cpp's own parser
// (make_grammar.js writes grammar_cases.json from them; tools/gbnf_check.py writes grammar_results.json). want: true for
// a reply whose every line Lantern's parser reads (the grammar must let it through), false for prose or a reply that is
// not one block of the kind (the grammar must hold it out). harm: what it costs when the grammar gets it wrong.
"use strict";
function S(id, kind, harm, want, text, right) { return { id: id, kind: kind, harm: harm, want: want, text: text, right: right }; }
var B = function (k, lines, t) { return "MAKE " + k + ": " + (t || "Lift station") + "\n" + lines.join("\n") + "\nEND"; };
module.exports = function (L) {
  var st = L.aiStation, q = "Design a duplex sewage lift station: the control circuit, the piping and the float levels";
  var bl = st.blocks(st.spec(st.parse({ lines: ["pumps 2", "floats off lead lag alarm high high alarm", "alarm horn", "supply \x22120 V AC\x22", "valves plug", "main \x224 in force main\x22", "inlet \x228 in gravity sewer\x22 6 ft", "well \x22wet well\x22 12 ft"] }), q));
  var RUN = require(require("path").join(__dirname, "..", "liftstation_1230", "run_35b.json"));
  var s = [
    // ---- STATION: what the parser reads -----------------------------------------------------------------------
    S("GS-01", "STATION", "high", true, B("STATION", ["pumps 2", "floats off lead lag alarm"]), "The guide's own example."),
    S("GS-02", "STATION", "medium", true, B("STATION", ["Pumps: 2", "Floats: off, lead, lag, high level alarm"]), "Capitals and colons."),
    S("GS-03", "STATION", "high", true, B("STATION", ["pumps 2", "floats off lead lag alarm", "float FS2 \x22lead on\x22 <height>", "well \x22wet well\x22 <depth>"]), "The correction's own lines copied (fixHint), placeholders and all."),
    S("GS-04", "STATION", "high", true, B("STATION", ["float FS2 \x22lead on\x22 <height>", "well \x22wet well\x22 <depth>", "inlet \x22gravity sewer\x22 <height>", "main \x22force main\x22", "valves <kind>", "supply \x22<volts>\x22"]), "Every line of the guide copied as it stands."),
    S("GS-05", "STATION", "low", true, B("STATION", ["pumps 2", "shut-off valves: plug"]), "'shut-off valves' (the parser's LEADS read shut[ -]?off)."),
    S("GS-06", "STATION", "low", true, B("STATION", ["pumps 2", "swing check valves"]), "'swing check valves' (the parser reads the check valve's kind)."),
    S("GS-07", "STATION", "low", true, B("STATION", ["pumps 2", "wet-well 12 ft deep"]), "'wet-well' (LEADS: wet[ -]+well)."),
    S("GS-08", "STATION", "low", true, B("STATION", ["pumps 2", "force-main 4 in"]), "'force-main'."),
    S("GS-09", "STATION", "low", true, B("STATION", ["pumps 2", "the wet well 12 ft deep"]), "'the wet well' (LEADS: (the )?wet well)."),
    S("GS-10", "STATION", "low", true, B("STATION", ["pumps 2", "floats off lead lag alarm", "high-level light red"]), "'high-level light' (LEADS: high[ -]level light: the alarm's light)."),
    S("GS-11", "STATION", "low", true, B("STATION", ["• pumps 2", "• floats off lead lag alarm"]), "A round bullet, which the parser strips."),
    S("GS-12", "STATION", "low", true, B("STATION", ["  pumps 2", "  floats off lead lag alarm"]), "Lines indented, which the parser reads."),
    S("GS-13", "STATION", "low", true, B("STATION", ["pumps 2", "flap check valves"]), "'flap check valves'."),
    S("GS-14", "STATION", "medium", true, B("STATION", ["Duplex", "Type: duplex", "Number of pumps: 2"]), "The station's kind and the count's own words."),
    S("GS-15", "STATION", "medium", true, B("STATION", ["pumps 2", "alarm horn", "run lights none", "control voltage 120 V AC", "supply: 24 V DC"]), "Horn, lights, voltage."),
    S("GS-16", "STATION", "medium", true, B("STATION", ["pumps 2", "isolation valves gate", "ball valves"]), "Valves by their kinds."),
    S("GS-17", "STATION", "medium", true, B("STATION", ["1) pumps 2", "10. floats off lead lag alarm"]), "Numbers of a list."),
    S("GS-18", "STATION", "medium", true, "MAKE STATION: Lift station: duplex, 2 pumps\n\npumps 2\n\nEND", "Blank lines and a colon in the title."),
    S("GS-19", "STATION", "medium", true, B("STATION", ["pumps 2", "float switches: off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft"]), "'float switches:'."),
    S("GS-20", "STATION", "low", true, B("STATION", ["pumps 2", "gravity sewer 8 in at 6 ft", "rising main 100 mm"]), "'gravity sewer', 'rising main'."),
    S("GS-21", "STATION", "medium", true, B("STATION", ["pumps 2", "levels: off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft"]), "A levels line."),
    S("GS-22", "LIFT STATION", "medium", true, B("LIFT STATION", ["pumps 2", "floats off lead lag alarm"]), "The action's other kind (MAKE LIFT STATION), held to its own grammar."),
    // ---- STATION: what is not one block --------------------------------------------------------------------
    S("GS-30", "STATION", "high", false, "Here is the station:\n" + B("STATION", ["pumps 2"]), "Prose before the block."),
    S("GS-31", "STATION", "medium", false, "```\n" + B("STATION", ["pumps 2"]) + "\n```", "A code fence."),
    S("GS-32", "STATION", "high", false, B("STATION", ["The station has two pumps that take turns."]), "A sentence in the block."),
    S("GS-33", "STATION", "high", false, B("STATION", ["pumps 2"]) + "\n\nLantern will draw the rest.", "Prose after END."),
    S("GS-34", "STATION", "medium", false, B("STATION", ["I chose plug valves because they pass solids."]), "A sentence that begins 'I'."),
    S("GS-35", "STATION", "high", false, "MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm", "No END."),
    S("GS-36", "STATION", "medium", false, B("STATION", ["pumps 2", "Power: if the power fails the alarm dials out on a 12 V battery"]), "A sentence that begins with a line's word (the parser then reads the sentence as the control voltage: A-78)."),
    S("GS-37", "STATION", "low", false, B("STATION", ["pumps 2", "Pumps alternate on each cycle so they wear evenly."]), "A sentence that begins 'Pumps' (harmless to the parser: no count in it)."),
    S("GS-38", "STATION", "high", false, B("CONTROL", ["pumps 2"]), "Another kind of block."),
    // ---- CONTROL ---------------------------------------------------------------------------------------------------
    S("GC-01", "CONTROL", "high", true, "MAKE CONTROL: Lift station\n" + bl.control.lines.join("\n") + "\nEND", "The control Lantern writes for a station (supply, floats, alternator, coils, lamps, horn)."),
    S("GC-02", "CONTROL", "high", true, RUN.replies[1].reply, "The 35B's own MAKE CONTROL for Adam's question (every line read)."),
    S("GC-03", "CONTROL", "high", true, "MAKE CONTROL: Duplex pump station\n" + L.aiControl.PROMPT_PUMPS.slice(L.aiControl.PROMPT_PUMPS.indexOf("MAKE CONTROL: Duplex pump station") + 1, -1).join("\n") + "\nEND", "The guide's duplex example, copied."),
    S("GC-04", "CONTROL", "low", true, B("CONTROL", ["Off float FS1", "Lead float FS2", "alternator AR M1 M2", "coil M1", "coil M2"]), "'Off float FS1' (the parser finds 'float' in the line's second word and reads 'off' as its job)."),
    S("GC-05", "CONTROL", "medium", true, B("CONTROL", ["Alternating relay AR M1 M2", "Run light LT1 M1 green", "Motor starter M1 \x22pump 1\x22", "Float switch FS1 \x22off\x22"]), "Devices by their two-word names."),
    S("GC-06", "CONTROL", "medium", false, B("CONTROL", ["The floats start the pumps."]), "Prose."),
    S("GC-07", "CONTROL", "medium", false, B("CONTROL", ["float FS1 \x22off\x22", "Wire L1 to FS1 then to CR1."]), "A wire written (the parser sends it back)."),
    // ---- PIPING ----------------------------------------------------------------------------------------------------
    S("GP-01", "PIPING", "high", true, "MAKE PIPING: Lift station\n" + bl.piping.lines.join("\n") + "\nEND", "The piping Lantern writes for a station."),
    S("GP-02", "PIPING", "medium", true, B("PIPING", ["pump P1", "Swing check valve CV1 P1", "Non-return valve NRV2 P2", "Shut-off valve V1 P1 gate", "Air release valve ARV1", "Valve vault", "Discharge pipe"]), "Valves by their names."),
    S("GP-03", "PIPING", "low", true, B("PIPING", ["wet-well \x22wet well\x22", "pump P1"]), "'wet-well' (LEADS: wet[- ]well)."),
    S("GP-04", "PIPING", "medium", false, B("PIPING", ["The pumps discharge into a header."]), "Prose."),
    // ---- LEVELS ----------------------------------------------------------------------------------------------------
    S("GL-01", "LEVELS", "high", true, "MAKE LEVELS: Wet well\n" + bl.levels.lines.join("\n") + "\nEND", "The levels Lantern writes for a station."),
    S("GL-02", "LEVELS", "medium", true, B("LEVELS", ["FS1: off 2 ft", "LSL1: off", "Floor el. 95 ft", "Float switch FS2 lead on 3 ft", "Off 2 ft"]), "Tags first, the floor, a job first."),
    S("GL-03", "LEVELS", "medium", false, B("LEVELS", ["The off float is at the bottom."]), "Prose.")
  ];
  return s;
};
