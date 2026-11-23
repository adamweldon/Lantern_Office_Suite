// cases_f.js -- F: what Chat says when nothing was made (AI_ACTIONS view(): the action's againHint), the header that
// names what a block was read as, and the new bench question make-liftstation-drawings.
"use strict";
var fs = require("fs"), path = require("path");
var H = require("./lib.js");
var P = H.parts, W = H.wires;
var CHAT = JSON.parse(fs.readFileSync(path.join(H.ROOT, "tests/fixtures/liftstation_1234/chat_35b.json"), "utf8"));
var R1 = CHAT.replies[0].reply, R2 = CHAT.replies[1].reply, Q = CHAT.question;
function V(id, harm, text, q, right, judge) {
  return { id: id, harm: harm, input: { question: q, reply: text }, right: right, run: function () { return H.boot().then(function () { var r = H.L().aiAct.build(text, q); return judge(H.viewText(r), r); }); } };
}
function item() { return H.L().aiBenchQuestions.filter(function (x) { return x.id === "make-liftstation-drawings"; })[0]; }
function B(id, harm, replies, right, wantPass) {
  return { id: id, harm: harm, input: { question: Q, replies: replies }, right: right, run: function () { return H.boot().then(function () {
    var it = item(); if (!it) return "no bench question make-liftstation-drawings";
    return H.L().aiAct.solve(it.q, H.seq(replies)).then(function (o) { var g = H.L().aiBench.grade(it, o.text, o); return !!g.pass === wantPass ? "" : (g.pass ? "passes" : "fails: " + g.why); }); }); } };
}

module.exports = [
  V("F-01", "medium", "MAKE DRAWING: House\nrect 500 500 10 10\nEND", "draw a house", "a drawing off the grid: \x22Ask again — fewer, bigger shapes help.\x22",
    function (t) { return /Ask again — fewer, bigger shapes help\.$/.test(t) ? "" : t; }),
  V("F-02", "medium", "MAKE SHEET: Costs\n| Item | Cost |\n| a | =1/0 |\nEND", "make a table of my costs", "a table that could not be made: its own advice, or Ask again (never shapes)",
    function (t, r) { return r.plan ? "" : /shapes/.test(t) ? t : ""; }),
  V("F-03", "high", R2, "draw a circuit with a source, switches, two motors and three lamps", "a circuit: \x22Ask again.\x22 -- never \x22fewer, bigger shapes or rows\x22 (Adam's chat)",
    function (t) { return !/shapes|rows/.test(t) && /Ask again\.$/.test(t) ? "" : t; }),
  V("F-04", "medium", "MAKE MUSIC: Song\nfoo\nEND", "write a song with chords so I can hear it", "a song: Ask again.", function (t) { return /shapes|rows/.test(t) ? t : ""; }),
  V("F-05", "medium", "MAKE SLIDES: Deck\nEND", "make a slide deck about ladders", "a deck: Ask again.", function (t) { return /shapes|rows/.test(t) ? t : ""; }),
  V("F-06", "medium", H.sch("Lift Station Electrical", P([["V1", "source", "120 V"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"], ["F1", "float", "Float A"]]).concat(W(["V1 M1", "M1 V1"]))), Q,
    "a part-and-wire block read as the station that could not be made: \x22Lantern could not make a pump station\x22, Ask again.",
    function (t) { return /^Lantern could not make a pump station: Lift Station Electrical/.test(t) && /Ask again\.$/.test(t) ? "" : t; }),
  V("F-07", "high", R1, Q, "the 35B's blocks: \x22Lantern made a pump station: Dual Pump Lift Station\x22 (what was made, not \x22a schematic\x22)",
    function (t) { return /^Lantern made a pump station: Dual Pump Lift Station — Read as MAKE STATION/.test(t) ? "" : t.slice(0, 200); }),
  V("F-08", "low", H.blk("STATION", "Lift station", ["pumps 2", "floats off lead lag alarm"]), Q, "a MAKE STATION block: \x22Lantern made a pump station: Lift station\x22",
    function (t) { return /^Lantern made a pump station: Lift station —/.test(t) ? "" : t.slice(0, 200); }),
  V("F-09", "low", H.sch("Lift station plumbing", ["well \x22wet well\x22", "pump P1", "pump P2", "check CV1 P1", "valve V1 P1 gate", "header \x22force main\x22"]), "Draw a plumbing schematic for a duplex lift station",
    "a schematic read as MAKE PIPING: named as the piping made", function (t) { return /^Lantern made a pump station’s piping: Lift station plumbing/.test(t) ? "" : t.slice(0, 200); }),
  V("F-10", "low", H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]), Q,
    "a MAKE CONTROL read as the station: \x22Lantern made a pump station: Duplex\x22", function (t) { return /^Lantern made a pump station: Duplex/.test(t) ? "" : t.slice(0, 200); }),
  V("F-11", "low", "MAKE SHEET: X\nEND", "make a table of my costs", "an empty table: \x22fewer rows help\x22 does not fit a table with no rows (Ask again, or its own advice: one row a line)",
    function (t) { return /fewer rows help/.test(t) ? t : ""; }),
  V("F-12", "low", "MAKE DRAWING: House\nEND", "draw a house", "an empty drawing: \x22fewer, bigger shapes help\x22 does not fit a drawing with none",
    function (t, r) { return r.plan ? "" : /fewer, bigger shapes/.test(t) ? t : ""; }),
  // --- the bench question --------------------------------------------------------------------------------------------
  { id: "F-20", harm: "medium", input: { question: "make-liftstation-drawings" }, right: "in set A, Adam's words exactly, a make question of kind STATION with the station's three parts; the set grows by exactly this one",
    run: function () { return H.boot().then(function () { var it = item(); if (!it) return "missing"; var n = H.L().aiBenchQuestions.length, n0 = H.L0().aiBenchQuestions.length;
      return it.q === Q && it.cat === "make" && it.kind === "STATION" && it.parts.join() === "CONTROL,PIPING,LEVELS" && n === n0 + 1 ? "" : JSON.stringify([it.q === Q, it.cat, it.kind, it.parts, n, n0]); }); } },
  B("F-21", "high", ["MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND"], "its ideal passes", true),
  B("F-22", "high", [R1], "the 35B's own reply (Adam's chat), read as the station, passes", true),
  B("F-23", "medium", [R2], "the 35B's second try (an open circuit) fails", false),
  B("F-24", "medium", ["MAKE STATION: Lift station\npumps 1\nfloats off lead alarm\nEND"], "one pump is not the typical duplex: fails", false),
  B("F-25", "medium", ["MAKE DRAWING: Lift station\nrect 2 2 8 6\nEND"], "a picture on the grid fails", false),
  B("F-26", "medium", [H.sch("Lamp", ["part B1 battery \x229 V\x22", "part L1 lamp", "wire B1 L1", "wire L1 B1"])], "a lamp circuit fails", false),
  B("F-27", "medium", ["A lift station needs a P&ID, an electrical one-line diagram and a civil layout."], "prose alone fails", false),
  B("F-28", "low", ["MAKE STATION: Lift station\npumps 2\nfloats off lead\nEND"], "no high level alarm (Ten States 46: every station has one): a typical lift station's drawings should not pass without it", false)
];
