// cases_e.js -- rule 5: Chat (AI_ACTIONS rest(), ASSIST_CHAT restHeld and the end-of-turn flush). A reply's further MAKE
// blocks are built and shown; kept across a correction; never twice; never prose that begins "Make ..."; never a second
// station beside MAKE STATION (said instead, and what is said is true). What rec.made is must not change (the bench
// scores it), and act.solve (the bench's path) must not change.
// Whole Chat turns are driven with a scripted model (load.js), as tests/liftstation_1234.js does.
"use strict";
var lib = require("./lib.js");
function B(k, t, ls) { return "MAKE " + k + ": " + t + "\n" + ls.join("\n") + "\nEND"; }
var BL = B("SCHEMATIC", "Lamp", ["mode electrical", 'part B1 battery "9 V"', "part L1 lamp", "wire B1 L1", "wire L1 B1"]);
var BAD = B("SCHEMATIC", "Lamp", ["mode electrical", 'part B1 battery "9 V"', "part L1 lamp", "wire B1 L1"]);
var TB = B("SHEET", "Values", ["| Part | Value |", "| Battery | 9 V |", "| Lamp | 0.5 A |"]);
var EL = B("SCHEMATIC", "Lift station control", ['part V1 source "120 V"', 'part F1 float "Pumps Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Level Alarm"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', "wire V1 F1", "wire F1 F2", "wire F2 M1", "wire F3 M2", "wire M1 V1", "wire M2 V1"]);
var ST3 = B("STATION", "Lift station", ["pumps 3", "floats off lead lag alarm", 'well "wet well" 12 ft']);
var SQ = "write a schematic for a typical lift station", LQ = "Draw a circuit with a battery and a lamp";
// (the mending: the other blocks are rec.moreMade, as finding "observations" asked; only that name changed here)
function kinds(r) { return (r.moreMade || []).map(function (m) { return m && m.block ? m.block.kind + ":" + m.block.title + (m.ok ? "" : "!") : String(m); }); }
function notes(r) { return (r.notes || []).join(" | "); }
function turn(id, harm, q, replies, right, check) {
  return { id: id, harm: harm, input: q + " / " + replies.map(function (x) { return lib.short(x, 80); }).join(" // "), right: right,
    run: async function () { var x = await lib.chat(lib.D, q, replies); return check(x.r, x.sent); } };
}
var cases = [
  turn("E-adam-chat", "high", lib.Q35.question, [lib.Q35.replies[0].reply], "the station made from the 35B's two blocks in one call; neither block made again on its own",
    function (r, sent) { return lib.all([lib.want(sent.length === 1, sent.length + " calls"), lib.want(r.made && r.made.ok && r.made.readAs === "STATION", "made " + (r.made && r.made.readAs)), lib.want(!kinds(r).length, "more: " + kinds(r))]); }),
  turn("E-circuit-and-table", "high", LQ, [BL + "\n\nIts values:\n\n" + TB], "both made and shown: the circuit as rec.made, the table after it",
    function (r) { return lib.all([lib.want(r.made && r.made.block.kind === "SCHEMATIC" && r.made.ok, "made"), lib.want(kinds(r).join() === "SHEET:Values", "more: " + kinds(r))]); }),
  turn("E-two-circuits", "medium", LQ, [BL + "\n\nAnother way:\n\n" + BL.replace("Lamp", "Lamp 2").replace("9 V", "12 V")], "both circuits shown, the second once",
    function (r) { return lib.want(kinds(r).join() === "SCHEMATIC:Lamp 2", "more: " + kinds(r)); }),
  turn("E-drawing-and-code", "low", "Draw a house", [B("DRAWING", "House", ["rect 4 6 8 5 fill tan", "tri 4 6 8 2 12 6 fill red"]) + "\n\n" + B("CODE", "Blink", ["language arduino", "void setup(){pinMode(13,OUTPUT);}", "void loop(){digitalWrite(13,HIGH);delay(500);digitalWrite(13,LOW);delay(500);}"])],
    "the program the model wrote beside the drawing is built and shown", function (r) { return lib.want(kinds(r).join() === "CODE:Blink", "more: " + kinds(r)); }),
  turn("E-held-across-correction", "high", LQ, [BAD + "\n\n" + TB, BL], "the circuit corrected once; the table written beside the first try shown after it",
    function (r, sent) { return lib.all([lib.want(sent.length === 2, sent.length + " calls"), lib.want(r.made && r.made.ok, "not made"), lib.want(kinds(r).join() === "SHEET:Values", "more: " + kinds(r))]); }),
  turn("E-held-prose-correction", "medium", LQ, [BAD + "\n\n" + TB, "Sorry, I cannot fix it."], "the correction came back in prose: the table is still shown, rec.made stays the failed circuit",
    function (r) { return lib.all([lib.want(r.made && !r.made.ok && r.made.block.kind === "SCHEMATIC", "made " + (r.made && r.made.block.kind)), lib.want(kinds(r).join() === "SHEET:Values", "more: " + kinds(r))]); }),
  turn("E-held-rewritten", "medium", LQ, [BAD + "\n\n" + TB, BL + "\n\n" + TB.replace("Values", "Values again")], "the table rewritten under another title with the correction: shown once (the new one)",
    function (r) { return lib.want(kinds(r).join() === "SHEET:Values again", "more: " + kinds(r)); }),
  turn("E-self-corrected-copy", "medium", LQ, [BAD + "\n\nOops, that one is open. Corrected:\n\n" + BL, BL], "the model's own corrected copy and Lantern's correction are the same circuit: shown once",
    function (r) { return lib.want(!kinds(r).length, "after the corrected circuit, the same circuit (" + kinds(r).join() + ") is shown again"); }),
  turn("E-prose-make-sure", "medium", LQ, [BL + "\n\n**Make sure:** the lamp is rated for 9 V.\nMake note: polarity does not matter for a lamp."], "prose that begins Make ... is not a block",
    function (r) { return lib.want(!kinds(r).length, "more: " + kinds(r)); }),
  turn("E-prose-make-kind", "low", LQ, [BL + "\n\n**Make Drawing:** if you want a picture, ask me.\nThanks!"], "“**Make Drawing:** if you want a picture, ask me.” is prose, not a drawing: nothing more shown",
    function (r) { return lib.want(!kinds(r).length, "a failed block is shown under the answer: " + kinds(r)); }),
  turn("E-prose-make-sheet", "low", LQ, [BL + "\n\nMake Sheet: optional, if you want the values in a table."], "a sentence that begins “Make Sheet:” is prose: nothing more shown",
    function (r) { return lib.want(!kinds(r).length, "a failed block is shown under the answer: " + kinds(r)); }),
  turn("E-station-then-schematic", "medium", SQ, [ST3 + "\n\nHere is its wiring too:\n\n" + EL], "the station from MAKE STATION; the schematic beside it not made again, and what is said is true: it disagrees (2 pumps, MAKE STATION 3) and none of it was used",
    function (r) { var n = notes(r); return lib.all([lib.want(r.made && r.made.block.kind === "STATION" && r.made.ok, "made " + (r.made && r.made.block.kind)), lib.want(!kinds(r).length, "more: " + kinds(r)), lib.want(!/not made again/.test(n) || /2 pumps|disagree|not used|not read/.test(n), "said: " + n)]); }),
  turn("E-schematic-then-station", "high", SQ, [EL + "\n\nAs one block:\n\n" + ST3], "the MAKE STATION block (the one the instructions asked for) makes the station, or the disagreement is said; never “MAKE STATION ... was not made again” about a block whose lines were not used",
    function (r) { var n = notes(r); return lib.want(!/MAKE STATION: Lift station beside the station; the station’s drawings are made from its one block, so it was not made again/.test(n), "said: " + n + " -- the station was made from the schematic (" + (r.made && r.made.summary ? lib.short(r.made.summary, 120) : "") + ")"); }),
  turn("E-station-then-control", "low", SQ, [B("STATION", "Lift station", ["pumps 2", "floats off lead alarm"]) + "\n\n" + B("CONTROL", "Duplex", ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'horn AH1 FS4 "alarm"'])],
    "one station; the MAKE CONTROL beside it (a lag float and a horn the station has not) not made as a second one, and said truly: its lines were not used",
    function (r) { var n = notes(r); return lib.all([lib.want(!kinds(r).length, "more: " + kinds(r)), lib.want(/MAKE CONTROL/.test(n) && !/so it was not made again\.$/.test(n.split(" | ").pop()) || /not used|lag|horn/.test(n), "said: " + n)]); }),
  turn("E-station-own-example-after", "medium", SQ, [ST3 + "\n\nFor example:\n\nMAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND"], "the instructions' own example copied after the block: not made, not said",
    function (r) { return lib.all([lib.want(!kinds(r).length, "more: " + kinds(r)), lib.want(!/also wrote/.test(notes(r)), "said: " + notes(r))]); }),
  turn("E-station-read-back-note", "medium", SQ, [B("SCHEMATIC", "Lift station", ['part V1 source "120 V"', 'part LS1 switch "Level Switch 1"', 'part LS2 switch "Level Switch 2"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', "wire V1 LS1", "wire LS1 M1", "wire M1 V1"]), 'MAKE STATION: Lift station\npumps 2\nfloat LS1 "off"\nfloat LS2 "lead on"\nEND'],
    "the note names what the block was read as (MAKE SCHEMATIC, read as MAKE STATION); the model is asked for MAKE STATION; made",
    function (r, sent) { return lib.all([lib.want(/MAKE SCHEMATIC block, read as MAKE STATION/.test(notes(r)), "note: " + notes(r)), lib.want(/MAKE STATION/.test(sent[1] || ""), "asked: " + lib.short(sent[1], 200)), lib.want(r.made && r.made.ok, "not made")]); }),
  // ---- rec.made as on 1.24.33 ---------------------------------------------------------------------------------------
  { id: "E-rec-made-unchanged", harm: "high", input: "five multi-block replies to questions that are not a station's", right: "rec.made (kind, ok, problems) and the calls made as on 1.24.33",
    run: async function () {
      var T = [[LQ, [BL + "\n\n" + TB]], [LQ, [BAD + "\n\n" + TB, BL]], [LQ, [BL + "\n\n" + BL.replace("Lamp", "Lamp 2")]], ["Draw a house", [B("DRAWING", "House", ["rect 4 6 8 5 fill tan"]) + "\n\n" + TB]], ["make a table of the values of a 9 V battery and a lamp", [TB + "\n\n" + BL]]], bad = [];
      for (var i = 0; i < T.length; i++) {
        var a = await lib.chat(lib.D, T[i][0], T[i][1]), b = await lib.chat(lib.P, T[i][0], T[i][1]);
        function sig(x) { var m = x.r.made; return JSON.stringify([x.sent.length, m ? m.block.kind : null, m ? m.ok : null, m ? m.problems : null]); }
        if (sig(a) !== sig(b)) bad.push(i + ": " + sig(a) + " vs " + sig(b));
      }
      return lib.all(bad);
    } },
  // ---- the bench's path ----------------------------------------------------------------------------------------------
  { id: "E-solve-unchanged", harm: "high", input: "act.solve on multi-block replies to questions that are not a station's", right: "the same text, made, parts and rounds as 1.24.33",
    run: async function () {
      var T = [[LQ, [BL + "\n\n" + TB]], [LQ, [BAD + "\n\n" + TB, BL]], ["Draw a house", [B("DRAWING", "House", ["rect 4 6 8 5 fill tan"]) + "\n\n" + TB]], ["draw a circuit with a source, switches, two motors and three lamps", [lib.Q35.replies[1].reply, lib.Q35.replies[1].reply]]], bad = [];
      for (var i = 0; i < T.length; i++) {
        var a = await lib.solve(lib.D, T[i][0], T[i][1]), b = await lib.solve(lib.P, T[i][0], T[i][1]);
        function sig(x) { var o = x.out, m = o.made; return JSON.stringify([x.sent.length, o.rounds, o.text, m ? [m.block.kind, m.ok] : null, (o.parts || []).map(function (p) { return p.kind + p.ok; })]); }
        // the open circuit's message has its line now: compare without it
        var sa = sig(a).replace(/; the current [^\x22]*?like: wire \S+ \S+/g, " (add the wire that returns to it)").replace(/; the current [^\x22]*?wire \S+ \S+/g, ""), sb = sig(b);
        if (sa !== sb) bad.push(i + ": " + lib.short(sa, 200) + " vs " + lib.short(sb, 200));
      }
      return lib.all(bad);
    } },
  { id: "E-solve-adam-bench", harm: "high", input: "Adam's question on the bench's path, answered with the 35B's reply", right: "the station, passing make-liftstation's checks",
    run: async function () {
      var b0 = lib.D.L.aiBenchQuestions.filter(function (x) { return x.id === "make-liftstation"; })[0], bq = Object.assign({}, b0, { q: lib.Q35.question });
      var x = await lib.solve(lib.D, bq.q, [lib.Q35.replies[0].reply]), g = lib.D.L.aiBench.grade(bq, x.out.text, x.out);
      return lib.want(g.pass, JSON.stringify(g).slice(0, 300));
    } }
];
module.exports = cases;
