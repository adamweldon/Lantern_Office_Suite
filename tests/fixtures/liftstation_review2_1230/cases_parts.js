// cases_parts.js -- area D: a question that asks for several things Lantern makes is made one at a time (AI_PARTS), in
// Chat (Lantern.CHAT.turn) and on the bench's path (Lantern.aiAct.solve); a question asking for ONE thing, with its
// details, is not split. Every bench question of both sets is a guard (bench_questions.json, frozen 2026-11-20).
"use strict";
var lib = require("./lib.js");
var ADAM = lib.ADAM_Q;
var CASES = [];
function split(id, q, want, right, harm) {
  CASES.push({ id: id, q: q, input: q, right: right, harm: harm || "medium",
    run: function (H) { var got = H.split(q); var g = got ? got.join("+") : "one", w = want ? want.join("+") : "one";
      if (g === w) return ""; var ps = H.parts(q); return "split as " + (ps ? ps.map(function (p) { return p.kind + " {" + p.text + "}"; }).join(" | ") : "one thing (not split)"); } });
}
// ---- several things: split, each its own kind, in the order asked ------------------------------------------------------
split("D-adam", ADAM, ["CONTROL", "PIPING", "LEVELS"], "Adam's question: the control, the piping, the levels, in that order.", "high");
split("D-adam-lowercase-then", ADAM.replace(". Then", ". then"), ["CONTROL", "PIPING", "LEVELS"], "The same with \"then\" in lower case.", "high");
split("D-adam-semicolons", "Create a diagram for a typical 2 pump lift station control with alternating relay; then a plumbing schematic for the same; and a drawing showing the float levels.", ["CONTROL", "PIPING", "LEVELS"], "Semicolons between the three.", "medium");
split("D-and-also", "Draw the ladder diagram for a duplex pump station with an alternating relay, and also draw the piping of the station.", ["CONTROL", "PIPING"], "\"and also draw\": two.", "medium");
split("D-also-sentences", "draw the lift station control circuit with alternating relay. also draw the plumbing schematic. also draw the float levels.", ["CONTROL", "PIPING", "LEVELS"], "\"also draw\" sentences: three.", "medium");
split("D-and-a-and-a", "Draw a ladder diagram for a duplex lift station with alternating relay and a piping diagram and a float level drawing", ["CONTROL", "PIPING", "LEVELS"], "\"and a piping diagram and a float level drawing\": three.", "medium");
split("D-heading-colon", "I need three drawings: the control for a duplex lift station with an alternator, the piping, and the float levels.", ["CONTROL", "PIPING", "LEVELS"], "\"I need three drawings:\" then the list: three.", "medium");
split("D-comma-list-tail", "draw the control circuit, the piping and the float levels for a duplex lift station", ["CONTROL", "PIPING", "LEVELS"], "A list whose last words say what it is all for: three.", "medium");
split("D-piping-and-levels", "Draw the piping for a duplex sewage lift station and a drawing of the float levels in its wet well.", ["PIPING", "LEVELS"], "Piping and levels: two, in that order.", "medium");
split("D-piping-then-control", "Draw the plumbing schematic for a duplex lift station, and a ladder diagram for its pumps with an alternating relay.", ["PIPING", "CONTROL"], "Piping first, then the control: in the order asked.", "medium");
split("D-and-draw-too", "Draw the control for a duplex lift station with an alternating relay, and draw the piping too.", ["CONTROL", "PIPING"], "\"and draw the piping too\": two.", "low");
split("D-song-then-slides", "Make a song about the sea, then make slides about the sea.", ["MUSIC", "SLIDES"], "A song, then slides: two tools.", "medium");
split("D-song-and-deck-about-it", "Write a short song in C major and a slide deck about it.", ["MUSIC", "SLIDES"], "A song and a deck about it.", "medium");
split("D-motor-then-fwdrev", "Draw a motor starter circuit, then a forward/reverse circuit.", ["CONTROL", "SCHEMATIC"], "Two circuits asked one after the other: two parts (the second is asked as Lantern routes a forward/reverse circuit today).", "low");
split("D-numbered-parens", "1) draw the control circuit for a two pump lift station with an alternating relay 2) draw its piping 3) draw the float levels in the wet well", ["CONTROL", "PIPING", "LEVELS"],
  "A numbered list \"1) ... 2) ... 3) ...\" asks for three things; Lantern did not split it.", "medium");
split("D-as-well-as", "Make a ladder diagram for a 2 pump lift station with an alternating relay as well as a plumbing schematic of the station.", ["CONTROL", "PIPING"], "\"as well as a plumbing schematic\": two things; not split.", "medium");
split("D-plus", "Can you draw me the control wiring for a duplex lift station with an alternator, plus the piping and the float settings?", ["CONTROL", "PIPING", "LEVELS"], "\"plus the piping and the float settings\": three; not split.", "medium");
split("D-along-with", "Draw a lift station control circuit with an alternating relay along with the plumbing schematic.", ["CONTROL", "PIPING"], "\"along with the plumbing schematic\": two; not split.", "medium");
split("D-first-second-third", "First draw the control circuit for a duplex lift station with an alternating relay, second draw its piping, and third draw the float levels.", ["CONTROL", "PIPING", "LEVELS"],
  "\"First ..., second ..., and third draw the float levels\": three. Lantern made two, the float levels folded into the piping part as a detail.", "medium");
split("D-colon-list-after-thing", "Draw a 2 pump lift station: the control with alternating relay, the plumbing, and the float positions.", ["CONTROL", "PIPING", "LEVELS"],
  "\"Draw a 2 pump lift station:\" heads a list of three. Lantern made the heading a part of its own (MAKE SCHEMATIC for \"Draw a 2 pump lift station\"), and folded the float positions into the piping: a schematic nobody asked for first, and no float levels.", "medium");
split("D-ladder-then-spreadsheet", "Draw the ladder diagram for a duplex sewage pump station whose two pumps take turns through an alternating relay. Then make a spreadsheet of the pump run hours.", ["CONTROL", "SHEET"],
  "The second part is a spreadsheet: MAKE SHEET. Lantern took the first tool that matched (the schematic, on \"pump\") and asked for a MAKE SCHEMATIC of the run hours.", "medium");
split("D-numbered-dots", "1. Draw the control circuit for a duplex lift station with an alternating relay. 2. Draw its piping. 3. Draw the float levels.", ["CONTROL", "PIPING", "LEVELS"], "\"1. ... 2. ... 3.\": three.", "low");
CASES.push({ id: "D-numbered-dots-text", q: "1. Draw the control circuit for a duplex lift station with an alternating relay. 2. Draw its piping. 3. Draw the float levels.", input: "(the parts' text)", harm: "low",
  right: "The parts of \"1. ... 2. ... 3.\" are each part's words; the next list number is not glued on (\"... alternating relay, 2\", \"Draw its piping, 3\" -- shown to the model in the list of things asked).",
  run: function (H) { var p = H.parts(this.q); if (!p) return "not split"; var bad = p.filter(function (x) { return /,\s*\d\s*$/.test(x.text); }); return bad.length ? "parts read " + p.map(function (x) { return "“" + x.text + "”"; }).join(", ") : ""; } });
split("D-six-circuits", "Draw a forward reverse motor control circuit and a timer circuit and a sump pump control circuit and a conveyor circuit and a tank fill circuit and a drill press circuit.", null,
  "Six circuits: more than Lantern makes in one question (five at most). Either not split (one asked at a time by the person) or five and the sixth said; not three circuits folded into one part's block.", "low");
CASES[CASES.length - 1].run = function (H) { var p = H.parts(this.q); if (!p) return ""; var multi = p.filter(function (x) { return (x.text.match(/circuit/g) || []).length > 1; }); return multi.length ? "split in " + p.length + ", one part being " + multi.map(function (x) { return "“" + x.text + "”"; }).join(", ") : ""; };
// ---- one thing with its details: not split ------------------------------------------------------------------------------
[["D-one-duplex-details", "Draw a duplex lift station control with an alternating relay, a lag float and a high level alarm."],
  ["D-one-duplex-lights-horn", "Draw a lift station control with two pumps, an alternating relay, run lights and an alarm horn."],
  ["D-one-motor-starter", "Draw a motor starter with a start button, a stop button and a run light."],
  ["D-one-levels-heights", "Draw the float levels in a wet well with an off float at 2 ft, a lead float at 3.5 ft and a lag float at 4.5 ft."],
  ["D-one-piping-details", "Draw the piping of a duplex lift station with check valves and plug valves in a valve vault."],
  ["D-one-circuit-battery-lamp", "Draw a circuit with a battery and a lamp and a switch."],
  ["D-one-table-planets", "Make a table of the planets and their moons."],
  ["D-one-arduino", "Write an Arduino program that blinks an LED and reads a button."],
  ["D-one-house-tree", "Draw a house with a red roof and a door, and a tree beside it."],
  ["D-one-cards-quiz", "Make flash cards for the parts of a cell and a quiz on them."],
  ["D-one-budget-chart", "Make a spreadsheet of my monthly budget and a chart of it."],
  ["D-one-wiring-3way", "Draw a wiring diagram of a 3-way light switch."],
  ["D-one-then-explain", "Create a schematic for a duplex lift station control. Then explain how the alternating relay works."],
  ["D-one-use-24vdc", "Draw a lift station control with an alternating relay. Use a 24 V DC supply."],
  ["D-one-make-sure", "Draw a lift station control with an alternating relay. Make sure the alarm is on its own float."],
  ["D-one-put-valves", "Draw a pump station's piping. Put the valves in a vault."],
  ["D-one-song-then-chorus", "Write a song about a river, then add a chorus about the sea."],
  ["D-one-slides-include", "Make slides about volcanoes and include a slide on safety."],
  ["D-one-led-resistor", "Draw a circuit with a 9 V battery, a 330 ohm resistor and an LED."],
  ["D-one-python-plot", "Write a Python program that reads a CSV file and then plots the data."],
  ["D-one-garden-label", "Draw a map of the garden and label the beds."],
  ["D-one-recipe-steps", "Write a recipe for bread with the ingredients and then the steps."],
  ["D-one-hydraulic-details", "Draw a hydraulic circuit with a pump, a relief valve, a directional valve and a cylinder."],
  ["D-one-pneumatic", "Draw a pneumatic circuit where a 5/2 valve extends and retracts a cylinder, and a flow control slows it."],
  ["D-one-sheet-total", "Make a spreadsheet of my expenses with a total at the bottom and then sort it by amount."],
  ["D-one-deck-sections", "Make a slide deck about the water cycle: evaporation, condensation, precipitation and collection."],
  ["D-one-song-key", "Compose a waltz in D major, then play it slower at the end."],
  ["D-one-ladder-plc", "Write a PLC ladder program for a duplex pump with an alternator and a high level alarm."],
  ["D-one-levels-detail-section", "Draw the wet well's float levels, and show the inlet invert too."],
  ["D-one-piping-and-vent", "Draw the lift station's piping and the vent."],
  ["D-one-control-and-lights", "Draw the lift station control and the run lights."],
  ["D-one-drawing-show-total", "Draw a bar chart of rainfall and show the total on the picture."],
  ["D-one-timeline", "Make a timeline of the Roman empire, then colour the wars red."],
  ["D-one-calc", "Calculate the wet well volume between the off float at 2 ft and the lead float at 3.5 ft in a 6 ft diameter well, then explain it."],
  ["D-one-question", "How does an alternating relay work in a duplex lift station, and why is a lag float needed?"],
  ["D-one-explain-then-draw-nothing", "Explain the float levels of a lift station and then list the usual heights."]
].forEach(function (x) { split(x[0], x[1], null, "One thing (with its details): not split.", "medium"); });
// ---- the first part's instructions ---------------------------------------------------------------------------------------
CASES.push({ id: "D-prompt-first-part-only", q: ADAM, input: "(the instructions)", harm: "high",
  right: "The instructions carry the list of the three things and only the first one's tool (MAKE CONTROL with the pump lines): not the piping's or the levels'.",
  run: function (H) { var p = H.L.aiAct.prompt(this.q); return /This question asks for 3 things/.test(p) && /alternator AR M1 M2/.test(p) && !/MAKE PIPING: <title>/.test(p) && !/MAKE LEVELS: <title>/.test(p) ? "" : "instructions: " + p.slice(0, 200); } });
CASES.push({ id: "D-prompt-comma-list-pump-example", q: "draw the control circuit, the piping and the float levels for a duplex lift station", input: "(the instructions)", harm: "medium",
  right: "\"draw the control circuit, the piping and the float levels for a duplex lift station\": the control part is the duplex station's, so its instructions are the pump station's (the alternator, the floats' jobs, the duplex example). Lantern read the part as \"draw the control circuit\" alone and showed the motor starter's guide and its one-float sump example.",
  run: function (H) { var p = H.L.aiAct.prompt(this.q); return /alternator AR M1 M2/.test(p) ? "" : "the first part's instructions are the motor starter's (no alternator line; example “Sump pump”)"; } });
// ---- whole Chat turns against a scripted model --------------------------------------------------------------------------
var CTRL = lib.blk("CONTROL", "Duplex lift station", lib.F4.concat(["alternator AR M1 M2"], lib.PUMPS));
var PIPE = lib.blk("PIPING", "Lift station piping", ['well "wet well"', "pump P1", "pump P2", 'header "4 in force main"']);
var LEV = lib.blk("LEVELS", "Wet well", ["pump P1 P2", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS4 "high level alarm" 5.5 ft']);
var BAD = lib.blk("CONTROL", "Duplex", ["float FS1", "float FS2", "alternator AR M1 M2", "coil M1", "coil M2"]);
var SCHEM = lib.blk("SCHEMATIC", "Plumbing", ["part P1 pump", "part V1 valve", "wire P1 V1"]);
var PROSE = "The piping has two pumps, each with a check valve and a gate valve, joining a force main.";
function turn(id, replies, want, right, harm, q) {
  CASES.push({ id: id, q: q || ADAM, input: replies.map(function (r) { return r.split("\n")[0]; }).join(" / "), right: right, harm: harm || "medium",
    run: function (H) { return H.turn(this.q, replies).then(function (t) { return want(t) || ""; }); } });
}
function made(t) { return t.mades.join(","); }
turn("D-turn-each-in-turn", [CTRL, PIPE, LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 3 ? "" : "made " + made(t) + " in " + t.calls + " replies"; },
  "Each part's block in turn: control, piping, levels made, each once, in three replies; the turn ends.", "high");
turn("D-turn-asks-with-own-instructions", [CTRL, PIPE, LEV], function (t) { return /MAKE PIPING: <title>/.test(t.sent[1]) && /MAKE LEVELS: <title>/.test(t.sent[2]) && !/MAKE LEVELS: <title>/.test(t.sent[1]) ? "" : "the requests for parts 2 and 3 do not carry their own instructions"; },
  "Each next part is asked for with that part's own instructions (MAKE PIPING's, then MAKE LEVELS').", "medium");
turn("D-turn-all-at-once", [CTRL + "\n\n" + PIPE + "\n\n" + LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 1 ? "" : "made " + made(t) + " in " + t.calls; },
  "All three blocks in one reply: all made, nothing asked again.", "high");
turn("D-turn-two-then-one", [CTRL + "\n\n" + PIPE, LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 2 ? "" : "made " + made(t) + " in " + t.calls; },
  "Control and piping in one reply, then the levels: three made in two replies.", "medium");
turn("D-turn-prose-then-block", [CTRL, PROSE, PIPE, LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 4 && /no MAKE PIPING block/.test(t.notes.join(" ")) ? "" : "made " + made(t) + " in " + t.calls; },
  "Prose for the piping: asked for once more; then made; then the levels.", "high");
turn("D-turn-prose-twice", [CTRL, PROSE, PROSE, LEV], function (t) { return made(t) === "CONTROL,LEVELS" && t.calls === 4 && /so it was not made/.test(t.notes.join(" ")) ? "" : "made " + made(t) + " in " + t.calls + "; notes " + t.notes.join(" / ").slice(0, 200); },
  "Prose twice for the piping: that part left and said, the levels asked for; the turn ends.", "medium");
turn("D-turn-levels-for-part-2", [CTRL, LEV, PIPE], function (t) { return made(t) === "CONTROL,LEVELS,PIPING" && t.calls === 3 ? "" : "made " + made(t) + " in " + t.calls; },
  "The levels block written when the piping was asked for: the levels count, and the piping is asked for next.", "medium");
turn("D-turn-prose-first", ["I cannot create visual diagrams, but here is a description of each.", CTRL, PIPE, LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" ? "" : "made " + made(t); },
  "The 35B's refusal first: Lantern asks for the first block, then each part.", "high");
turn("D-turn-bad-then-fixed", [BAD, CTRL, PIPE, LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 4 ? "" : "made " + made(t) + " in " + t.calls; },
  "The control block sent back once, corrected, then the others.", "medium");
turn("D-turn-control-again-for-piping", [CTRL, CTRL, LEV], function (t) {
  var says = t.notes.filter(function (n) { return /made MAKE CONTROL and MAKE PIPING/.test(n); }).length || t.sent.some(function (s) { return /^Lantern made your MAKE PIPING block/.test(s); });
  return made(t).indexOf("PIPING") < 0 || says ? "the second CONTROL block was taken as the piping part: made " + made(t) + (says ? "; and Lantern told the model and the person “Lantern made your MAKE PIPING block” / “made MAKE CONTROL and MAKE PIPING”" : "") : ""; },
  "A second MAKE CONTROL block when the piping was asked for is not the piping: the piping must still be asked for (once), and nothing may say the piping was made. Lantern counted the second control block as the piping part, said “Lantern made MAKE CONTROL and MAKE PIPING”, asked for the levels -- and the piping was never made.", "medium");
turn("D-turn-schematic-for-piping-sent-back-as-control", [CTRL, SCHEM, PIPE, LEV], function (t) { var s = t.sent[2] || ""; return /write it as MAKE CONTROL/.test(s) ? "the MAKE SCHEMATIC written for the PIPING part went back with “this is a control circuit: write it as MAKE CONTROL”" : ""; },
  "A MAKE SCHEMATIC block (parts and wires) written for the piping part: what goes back must ask for MAKE PIPING -- the part asked for. Lantern sent “this is a control circuit: write it as MAKE CONTROL ...” (it read the whole question, which is about control): the line sent back is wrong for this part.", "medium");
turn("D-turn-schematic-then-obeys", [CTRL, SCHEM, CTRL, LEV], function (t) { return made(t).indexOf("PIPING") < 0 ? "the model did as told (MAKE CONTROL) and that was taken as the piping part: made " + made(t) : ""; },
  "Following on: a model that does as it is told and writes MAKE CONTROL again ends with no piping, the second control counted as the piping part.", "medium");
turn("D-turn-bad-control-twice-not-said-made", [BAD, BAD, PIPE, LEV], function (t) {
  var claim = t.notes.filter(function (n) { return /^Lantern made MAKE CONTROL/.test(n); }).concat(t.sent.filter(function (s) { return /^Lantern made your MAKE CONTROL block/.test(s); }));
  return claim.length ? "nothing was drawn for the control (" + made(t) + "), and Lantern said “" + claim[0].slice(0, 90) + "”" : ""; },
  "The control block wrong twice: nothing drawn for it. What Lantern says next must not say it was made (“Lantern made MAKE CONTROL; now the second ...”, and to the model “Lantern made your MAKE CONTROL block”).", "medium");
turn("D-turn-single-question-one-block", [CTRL, PIPE], function (t) { var m = t.rec.made; return m && m.ok && String(m.block.kind).toUpperCase() === "CONTROL" && !t.rec.parts && t.calls === 1 ? "" : "made " + (m ? m.block.kind : "nothing") + " in " + t.calls + (t.rec.parts ? " (split!)" : ""); },
  "A question asking for one thing: one block made, the turn ends (nothing more asked).", "high", lib.CTRL_Q);
turn("D-turn-wrong-piping-then-fixed", [CTRL, lib.blk("PIPING", "x", ["pump P1", "pump P2", "check CV1 P1", "hoses everywhere"]), PIPE, LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 4 ? "" : "made " + made(t) + " in " + t.calls; },
  "A piping block with a line Lantern cannot read: back once, corrected, then the levels.", "medium");
var RUN = require("../liftstation_1230/run_35b.json");
turn("D-turn-35b-own-replies", [RUN.replies[0].reply, RUN.replies[1].reply, PIPE, LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 4 ? "" : "made " + made(t) + " in " + t.calls; },
  "Adam's question with the 35B's own first two replies (its prose, then its block with \"alternating AR M1 M2\"), then the piping and the levels: all three made, in four replies.", "high");
turn("D-turn-prose-forever-ends", [PROSE], function (t) {
  var claim = t.notes.filter(function (n) { return /^Lantern made MAKE/.test(n); });
  return t.calls <= 12 && !claim.length && !(t.rec.mades || []).length ? "" : "replies " + t.calls + ", made " + made(t) + (claim.length ? ", said “" + claim[0].slice(0, 60) + "”" : ""); },
  "A model that only ever writes prose: the turn ends (a bounded number of replies), nothing is said to be made.", "medium");
turn("D-turn-control-then-two-at-once", [CTRL, PIPE + "\n\n" + LEV], function (t) { return made(t) === "CONTROL,PIPING,LEVELS" && t.calls === 2 ? "" : "made " + made(t) + " in " + t.calls; },
  "The control, then the piping and the levels together in the second reply: all made, nothing asked for again.", "medium");
// ---- the bench's path ----------------------------------------------------------------------------------------------------
solve("D-solve-prose-first", ["I cannot create visual diagrams, but here is a description of each.", CTRL, PIPE, LEV], function (s) { return s.parts.join() === "CONTROL,PIPING,LEVELS" ? "" : (s.parts.join() || "nothing") + " (made: " + (s.out.made ? s.out.made.block.kind : "none") + ")"; },
  "On the bench's path the 35B's refusal is asked once for the block (as in Chat), then the parts follow.", "high");
function solve(id, replies, want, right, harm) {
  CASES.push({ id: id, q: ADAM, input: replies.map(function (r) { return r.split("\n")[0]; }).join(" / "), right: right, harm: harm || "medium",
    run: function (H) { return H.solve(this.q, replies).then(function (s) { return want(s) || ""; }); } });
}
solve("D-solve-each", [CTRL, PIPE, LEV], function (s) { return s.parts.join() === "CONTROL,PIPING,LEVELS" ? "" : s.parts.join(); }, "The bench's path makes the three, part by part.", "high");
solve("D-solve-all-at-once", [CTRL + "\n\n" + PIPE + "\n\n" + LEV], function (s) { return s.parts.join() === "CONTROL,PIPING,LEVELS" && s.calls === 1 ? "" : s.parts.join() + " in " + s.calls; }, "All at once on the bench's path.", "medium");
solve("D-solve-prose-twice-not-said-made", [CTRL, PROSE, PROSE, LEV], function (s) { var c = s.sent.filter(function (x) { return /^Lantern made your MAKE PIPING block/.test(x); }); return c.length ? "after two replies of prose for the piping (not made), the model was told “Lantern made your MAKE PIPING block”" : ""; },
  "On the bench's path, after prose twice for the piping (nothing made), the request for the levels must not tell the model “Lantern made your MAKE PIPING block” (Chat says “Lantern made nothing for the second part”).", "low");
solve("D-solve-control-again", [CTRL, CTRL, LEV], function (s) { return s.parts.indexOf("PIPING") < 0 ? "the second CONTROL block was counted as the piping part: " + s.parts.join() : ""; },
  "On the bench's path, a second CONTROL block for the piping part is not the piping (the bench grades it as “the MAKE PIPING part was not made”, rightly -- but the piping was never asked for again).", "medium");
CASES.push({ id: "D-bench-grade-ideal", q: ADAM, input: "the bench item's own ideal reply", harm: "high",
  right: "The bench item make-liftstation's ideal reply (its three blocks) is graded as passing on the bench's path, every part made.",
  run: function (H) {
    var item = H.L.aiBenchQuestions.filter(function (b) { return b.id === "make-liftstation"; })[0];
    if (!item) return "no make-liftstation";
    return H.solve(item.q, [item.ideal]).then(function (s) {
      var m = s.out.made; if (!m || !m.ok) return "the ideal's control not made";
      var w = item.check(m.plan); if (w) return "check: " + w;
      var miss = item.parts.slice(1).filter(function (k) { var g = (s.out.parts || []).filter(function (x) { return x.kind === k && x.ok; })[0]; return !g || item.partCheck[k](g.made.plan); });
      return miss.length ? "parts failing: " + miss.join() : "";
    });
  } });
CASES.push({ id: "D-bench-b-grade-ideal", q: "(set B)", input: "the bench item's own ideal reply", harm: "high",
  right: "make-liftstation-b's ideal passes, part by part.",
  run: function (H) {
    var item = H.L.aiBenchQuestionsB.filter(function (b) { return b.id === "make-liftstation-b"; })[0];
    if (!item) return "no make-liftstation-b";
    return H.solve(item.q, [item.ideal]).then(function (s) {
      var m = s.out.made; if (!m || !m.ok) return "the ideal's control not made"; var w = item.check(m.plan); if (w) return "check: " + w;
      var miss = item.parts.slice(1).filter(function (k) { var g = (s.out.parts || []).filter(function (x) { return x.kind === k && x.ok; })[0]; return !g || item.partCheck[k](g.made.plan); });
      return miss.length ? "parts failing: " + miss.join() : "";
    });
  } });
// ---- every bench question is a guard: only the two lift station questions split, into control, piping, levels ---------
require("./bench_questions.json").forEach(function (b) {
  CASES.push({ id: "D-bench-" + b.set + "-" + b.id, q: b.q, input: b.q, harm: "high",
    right: b.parts ? "A bench question in parts: split into " + b.parts.join(", ") + "." : "A bench question asking for one thing: not split.",
    run: function (H) { var got = H.split(b.q); var want = b.parts ? b.parts.join("+") : "one"; var g = got ? got.join("+") : "one"; return g === want ? "" : "split as " + g; } });
});
module.exports = CASES;
