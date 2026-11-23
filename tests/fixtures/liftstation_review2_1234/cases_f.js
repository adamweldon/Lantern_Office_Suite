// cases_f.js -- rule 6: AI_ACTIONS view(). The failure's advice is the action's own (againHint), none for an empty
// result, and the header names what a block was read as.
"use strict";
var lib = require("./lib.js");
function B(k, t, ls) { return "MAKE " + k + ": " + t + "\n" + ls.join("\n") + "\nEND"; }
function v(id, harm, text, q, right, check) {
  return { id: id, harm: harm, input: lib.short(text, 120) + " / " + q, right: right,
    run: function () { var m = lib.build(lib.D, text, q), t = lib.D.L.aiAct.view(m).textContent; return Promise.resolve(check(t, m)); } };
}
var cases = [
  v("F-circuit-open", "medium", B("SCHEMATIC", "Lamp", ['part B1 battery "9 V"', "part L1 lamp", "wire B1 L1"]), "draw a battery and a lamp",
    "a circuit that could not be made: never “fewer, bigger shapes or rows”; the line to write shown", function (t) { return lib.all([lib.want(!/shapes|rows/.test(t), t), lib.want(/like: wire L1 B1\. Ask again\.$/.test(t), t)]); }),
  v("F-drawing-off-grid", "medium", B("DRAWING", "House", ["rect 30 4 4 2 fill brown"]), "draw a house",
    "a drawing off the grid: fewer, bigger shapes help", function (t) { return lib.want(/Ask again — fewer, bigger shapes help\.$/.test(t), t); }),
  v("F-drawing-empty", "low", B("DRAWING", "House", []), "draw a house", "a drawing with nothing in it: no advice about fewer shapes", function (t) { return lib.want(/Ask again\.$/.test(t) && !/fewer/.test(t), t); }),
  v("F-sheet-empty", "low", B("SHEET", "T", []), "make a table of the values", "an empty table: no advice about fewer rows", function (t) { return lib.want(/Ask again\.$/.test(t) && !/fewer/.test(t), t); }),
  v("F-control-refused", "medium", B("CONTROL", "Motor", ['coil M1 "motor"']), "draw a motor starter control circuit", "a control circuit refused: no shapes or rows advice", function (t) { return lib.want(!/shapes|rows/.test(t) && /Ask again\.$/.test(t), t); }),
  v("F-station-from-schematic-header", "medium", lib.Q35.replies[0].reply, lib.Q35.question, "the header names what was made: a pump station, Dual Pump Lift Station",
    function (t) { return lib.want(/^Lantern made a pump station: Dual Pump Lift Station — Read as MAKE STATION/.test(t), lib.short(t, 200)); }),
  v("F-station-read-failed-header", "medium", B("SCHEMATIC", "Lift station", ['part V1 source "120 V"', 'part LS1 switch "Level Switch 1"', 'part LS2 switch "Level Switch 2"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', "wire V1 LS1", "wire LS1 M1", "wire M1 V1"]), "write a schematic for a typical lift station",
    "a schematic read as a station that could not be made: “Lantern could not make a pump station”, the lines to write", function (t) { return lib.want(/^Lantern could not make a pump station: Lift station/.test(t) && /like: float LS1/.test(t) && /Ask again\.$/.test(t), lib.short(t, 300)); }),
  v("F-plain-schematic-header", "medium", B("SCHEMATIC", "Lamp", ['part B1 battery "9 V"', "part L1 lamp", "wire B1 L1", "wire L1 B1"]), "draw a battery and a lamp",
    "a schematic that is a schematic: the header as 1.24.33", function (t, m) { var p = lib.P.L.aiAct.view(lib.build(lib.P, B("SCHEMATIC", "Lamp", ['part B1 battery "9 V"', "part L1 lamp", "wire B1 L1", "wire L1 B1"]), "draw a battery and a lamp")).textContent; return lib.want(t === p, t + " / was " + p); }),
  v("F-piping-read-as-station-header", "low", B("SCHEMATIC", "Lift station piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part CV1 valve "Check Valve 1"', 'part CV2 valve "Check Valve 2"', "wire W1 P1", "wire W1 P2", "wire P1 CV1", "wire P2 CV2"]), "write a schematic for a typical lift station",
    "the header calls the result a pump station named Lift station (not “Lift station piping”)", function (t) { return lib.want(/^Lantern made a pump station: Lift station —/.test(t), lib.short(t, 200)); })
];
module.exports = cases;
