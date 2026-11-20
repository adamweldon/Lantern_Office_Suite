// cases_parts.js -- rule C: a question that asks for several things is made one at a time (AI_PARTS), in the
// instructions, Chat and the bench's path (Lantern.aiAct.solve).
"use strict";
var path = require("path"), fs = require("fs");
var RUN = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "liftstation_1230", "run_35b.json"), "utf8"));
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
var Q = "\x22", ADAM = RUN.question;
var CTRL = RUN.replies[1].reply;
var PIPE = blk("PIPING", "Lift station", ["well " + Q + "wet well" + Q, "inlet " + Q + "8 in gravity sewer" + Q, "pump P1 " + Q + "pump 1" + Q, "pump P2 " + Q + "pump 2" + Q, "header " + Q + "4 in force main" + Q, "vent"]);
var LEV = blk("LEVELS", "Floats", ["pump P1 P2", "float FS1 " + Q + "stop low" + Q, "float FS2 " + Q + "start high" + Q, "float FS3 " + Q + "alarm high high" + Q]);
var DRAW = blk("DRAWING", "Picture", ["rect 2 2 4 4 fill blue", "circle 10 6 2 fill red"]);
var STARTER24 = blk("CONTROL", "Starter", ["supply " + Q + "24 V DC" + Q, "stop PB1", "start PB2 M1", "coil M1 " + Q + "motor starter" + Q]);
var CODE = blk("CODE", "Blink", ["language arduino", "void setup() { pinMode(13, OUTPUT); }", "void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }"]);
var SCH = blk("SCHEMATIC", "LED", ["part B1 battery " + Q + "5 V" + Q, "part R1 resistor " + Q + "220 ohm" + Q, "part D1 led", "wire B1+ R1", "wire R1 D1+", "wire D1- B1-"]);
// a model that writes what it is asked for: the block named in the last message
function follows(map) { return function (last) { var m = /MAKE ([A-Z]+): <title>|^MAKE ([A-Z]+): <a short title>/m.exec(last); var k = m ? (m[1] || m[2]) : null; return map[k] || map._; }; }
var C = [];
function sp(id, q, kinds, why, more) { var c = { id: id, rule: "C", right: true, type: "split", q: q, kinds: kinds, why: why, harm: "medium" }; Object.keys(more || {}).forEach(function (k) { c[k] = more[k]; }); return c; }
function g(id, q, why, harm) { return { id: id, rule: "C", right: true, type: "split", q: q, why: why || "One thing asked for, with its details: one part.", harm: harm || "high" }; }
// ---- questions asking for several things ---------------------------------------------------------------------
C.push(sp("C-adam", ADAM, "CONTROL,PIPING,LEVELS", "Adam's question: three parts, the piping read with the lift station.", { texts: ["typical 2 pump lift station control", "^create a plumbing schematic for the same$", "^a drawing showing float level positioning$"], harm: "high" }));
C.push(sp("C-adam-draw", "create a diagram for a typical 2 pump lift station control with alternating relay. Then draw a plumbing schematic for the same and a drawing showing float level positioning", "CONTROL,PIPING,LEVELS", "\x22draw a plumbing schematic for the same\x22.", { harm: "high" }));
C.push(sp("C-adam-piping-diagram", "create a diagram for a typical 2 pump lift station control with alternating relay. Then create a piping diagram for the same and a drawing showing float level positioning", "CONTROL,PIPING,LEVELS", "\x22a piping diagram for the same\x22.", { harm: "high" }));
C.push(sp("C-adam-for-it", "create a diagram for a typical 2 pump lift station control with alternating relay. Then create a plumbing schematic for it and a drawing showing float level positioning", "CONTROL,PIPING,LEVELS", "\x22for it\x22.", { harm: "high" }));
C.push(sp("C-then-draw-the-piping", "Draw the control circuit for a duplex lift station, then draw the piping", "CONTROL,PIPING",
  "\x22then draw the piping\x22 after a lift station's control is the station's piping. Lantern makes it a MAKE DRAWING part (a grid picture) because \x22draw\x22 fits the drawing tool and the back-reference is read only when nothing fits.", { harm: "high" }));
C.push(sp("C-draw-piping-for-the-same", "Draw the control circuit for a duplex lift station with an alternating relay. Draw the piping for the same. Draw the float levels.", "CONTROL,PIPING,LEVELS",
  "Adam's question with \x22Draw the piping for the same\x22: the piping becomes MAKE DRAWING.", { harm: "high" }));
C.push(sp("C-semicolons-draw-piping", "Draw a lift station control circuit with an alternating relay; then draw the piping; then the float levels", "CONTROL,PIPING,LEVELS", "\x22then draw the piping\x22 again.", { harm: "high" }));
C.push(sp("C-and-then-for-it", "Draw the duplex control and then the piping for it and then the float levels for it", "CONTROL,PIPING,LEVELS", "\x22the piping for it\x22.", { harm: "high" }));
C.push(sp("C-show-piping-too", "Draw a lift station control circuit with alternating relay. Show the piping too.", "CONTROL,PIPING", "\x22Show the piping too\x22: a second thing; Lantern folds it into the control part and never asks for it."));
C.push(sp("C-piping-and-levels", "Draw the piping for a lift station and the float levels in the wet well", "PIPING,LEVELS", "Piping and float levels: Lantern keeps one part (\x22float levels\x22 is not in its list of things), so only the piping is asked for."));
C.push(sp("C-levels-and-piping", "Draw the float levels in the wet well and the piping for the station", "LEVELS,PIPING", "Float levels then piping."));
C.push(sp("C-plumbing-and-drawing", "Create a plumbing schematic for a 2 pump lift station and a drawing showing float level positioning", "PIPING,LEVELS", "Plumbing and floats."));
C.push(sp("C-control-and-plumbing-for-it", "Draw the control circuit for a duplex lift station with alternating relay and the plumbing schematic for it", "CONTROL,PIPING", "Control and its plumbing."));
C.push(sp("C-comma-list", "Draw the control for a duplex pump station, the piping and the float levels", "CONTROL,PIPING,LEVELS", "A comma list of three: not split, so all three tools are offered and only the first block is made."));
C.push(sp("C-need-three", "I need three drawings: the control circuit for a duplex lift station, the piping, and the float levels.", "CONTROL,PIPING,LEVELS", "\x22I need three drawings: ...\x22."));
C.push(sp("C-need-ladder-piping-levels", "I need a ladder diagram for a duplex lift station with alternating relay, a piping drawing of the station and a drawing of the float levels.", "CONTROL,PIPING,LEVELS", "The piping folded into the control part: never asked for."));
C.push(sp("C-duplex-and-piping-schematic", "Draw a duplex pump station control circuit and a piping schematic of the pump station", "CONTROL,PIPING", "Control and piping."));
C.push(sp("C-three-sentences", "Draw the control circuit for a duplex lift station with an alternating relay. Then draw the lift station piping. Then draw the float levels in the wet well.", "CONTROL,PIPING,LEVELS", "Three sentences."));
C.push(sp("C-also-draw-plumbing", "Draw the control circuit for a duplex lift station with an alternating relay. Also draw the plumbing schematic for the station.", "CONTROL,PIPING", "\x22Also draw\x22."));
C.push(sp("C-levels-piping-control", "Draw the float levels in the wet well. Then draw the piping of the station. Then draw the control circuit with an alternating relay.", "LEVELS,PIPING,CONTROL", "The three in the other order."));
C.push(sp("C-semicolons-plumbing", "Draw a lift station control circuit with alternating relay; then draw the plumbing for the lift station; then the float levels", "CONTROL,PIPING,LEVELS", "Semicolons, plumbing named with the station."));
C.push(sp("C-control-then-plumbing-same", "Draw the control for a duplex lift station with an alternating relay. Then draw a plumbing schematic for the same.", "CONTROL,PIPING", "Two of Adam's three."));
C.push(sp("C-sketch-and-circuit", "Write an Arduino sketch that blinks an LED and draw the circuit for it", "CODE,SCHEMATIC", "A sketch and its circuit."));
C.push(sp("C-sketch-button-circuit", "Write an Arduino sketch that reads a button and lights an LED, then draw the circuit for it.", "CODE,SCHEMATIC", "A sketch and its circuit, \x22then\x22."));
C.push(sp("C-circuit-then-sketch", "Draw the circuit for an LED and a resistor on an Arduino and write the sketch for it.", "ELECTRONICS,CODE",
  "The circuit, then \x22write the sketch for it\x22 (an Arduino sketch is a program). Lantern makes it MAKE DRAWING: \x22sketch\x22 fits the drawing tool.", { harm: "high" }));
C.push(sp("C-starter-and-plc", "Draw a motor starter circuit and write the PLC program for it.", "CONTROL,CODE", "A starter and its PLC program."));
C.push(sp("C-plc-then-ladder", "Write a PLC program for a motor starter. Then draw the ladder diagram.", "CODE,CONTROL", "A PLC program then the ladder diagram."));
C.push(sp("C-sheet-and-pie", "Make a sheet of my monthly budget and a pie chart of it.", "SHEET,WHEEL", "A sheet and a pie chart of it."));
C.push(sp("C-table-pie-unrelated", "Make a table of the times tables and a pie chart of the hours in my day.", "SHEET,WHEEL", "Two unrelated things."));
C.push(sp("C-table-then-cards", "Make a table of the planets and then make flash cards of them.", "SHEET,CARDS", "A table, then cards of it."));
C.push(sp("C-slides-and-make-cards", "Make slides about the water cycle and make flash cards for it.", "SLIDES,CARDS", "Slides and cards."));
C.push(sp("C-slides-then-cards", "Make slides about the water cycle, then make flash cards for it.", "SLIDES,CARDS", "Slides, then cards."));
C.push(sp("C-slides-and-cards-no-verb", "Make slides about the water cycle and flash cards for it", "SLIDES,CARDS", "\x22and flash cards for it\x22 (no article, no verb): not split; both tools offered, one block made.", { harm: "medium" }));
C.push(sp("C-letter-and-table", "Write a letter to my landlord and make a table of the repairs.", "DOC,SHEET", "A letter and a table."));
C.push(sp("C-plan-and-sheet", "Make a planting plan for spring and a sheet of the seed costs.", "PLAN,SHEET", "A plan and a sheet: not split."));
C.push(sp("C-song-and-slides", "Write a song about the sea and make slides of its words.", "MUSIC,SLIDES", "A song and slides."));
C.push(sp("C-cards-and-table", "Make flash cards of the planets and a table of their sizes.", "CARDS,SHEET", "Cards and a table."));
C.push(sp("C-schematic-then-table", "Draw a schematic of a lamp circuit and then make a table of the currents.", "SCHEMATIC,SHEET", "A schematic, then a table."));
C.push(sp("C-pie-then-table", "Make a pie chart of my day and then a table of it.", "WHEEL,SHEET", "A pie chart, then a table."));
C.push(sp("C-piping-then-levels", "Draw the piping for a 2 pump lift station and then the float levels", "PIPING,LEVELS", "Piping then float levels."));
C.push(sp("C-four-things", "Make a table of the planets. Then make flash cards of them. Then make slides about them. Then write a song about them.", "SHEET,CARDS,SLIDES,MUSIC", "Four things."));
// ---- the guard: one thing asked for, with its details -------------------------------------------------------------
C.push({ id: "C-guard-bench-A", rule: "C", right: true, type: "benchGuard", set: "aiBenchQuestions", why: "None of the bench's questions is split.", harm: "high" });
C.push({ id: "C-guard-bench-B", rule: "C", right: true, type: "benchGuard", set: "aiBenchQuestionsB", why: "None of bench B's questions is split.", harm: "high" });
var DETAIL = "A detail of the one thing asked for, in a sentence of its own. Lantern carries the first sentence's verb (\x22Draw\x22) onto it, the drawing tool fits any \x22Draw ...\x22, and the detail becomes a MAKE DRAWING part: the first instructions tell the model to write ONLY the first part (so the detail may be left out of it), and then a picture of the detail is asked for and shown.";
[
  ["C-g-lamp-red", "Draw a circuit with a 9 V battery and a lamp. Make the lamp red."],
  ["C-g-label-each", "Draw a circuit with a 9 V battery, a switch and a lamp. Label each part.", DETAIL],
  ["C-g-24vdc", "Draw a motor starter circuit. Use a 24 V DC supply.", DETAIL],
  ["C-g-add-run-light", "Draw a motor starter circuit with a stop button, a start button and an overload. Add a green run light.", DETAIL],
  ["C-g-show-limits", "Draw a forward/reverse motor control circuit with interlocks. Show the limit switches."],
  ["C-g-budget-include", "Make a spreadsheet of my monthly budget. Include rent, food and fuel."],
  ["C-g-planets-moons", "Make a table of the planets and their moons."],
  ["C-g-arduino-fan", "Write an Arduino program that reads a temperature sensor and turns on a fan."],
  ["C-g-python-sort", "Write a Python program that sorts a list and prints it."],
  ["C-g-house-door", "Draw a house with a door and a window."],
  ["C-g-sailboat", "Draw a sailboat on the sea with the sun and a gull."],
  ["C-g-555-led", "Draw a schematic of a 555 timer and an LED."],
  ["C-g-calc-current", "Draw a parallel circuit with two lamps and a battery. Then calculate the current.", "\x22Then calculate the current\x22 asks for a sum, not a picture; it becomes a MAKE DRAWING part."],
  ["C-g-times-cards", "Make flash cards for the times tables from 1 to 12."],
  ["C-g-slides-picture", "Make slides about the water cycle. Each slide should have a picture.", "\x22Each slide should have a picture\x22 is a detail of the slides; it becomes a MAKE DRAWING part.", "medium"],
  ["C-g-plan-tomatoes", "Make a weekly plan for planting tomatoes and beans."],
  ["C-g-letter-heater", "Write a letter to my landlord about the broken heater and the leaking tap."],
  ["C-g-duplex-120v", "Draw the control circuit for a duplex lift station with an alternating relay. Use a 120 V control transformer.", DETAIL],
  ["C-g-duplex-alarm-horn", "Draw the control circuit for a duplex lift station with an alternating relay. Include a high level alarm light and horn.", DETAIL],
  ["C-g-duplex-and-alarm", "Draw the control circuit for a duplex lift station with an alternating relay and a high level alarm."],
  ["C-g-duplex-run-lights", "Draw the control circuit for a duplex lift station with an alternating relay and the run lights."],
  ["C-g-floats-left", "Draw a lift station control circuit with alternating relay. Show the float switches on the left."],
  ["C-g-plug-valves", "Draw the piping for a 2 pump lift station. Use plug valves.", DETAIL],
  ["C-g-check-gate", "Draw the piping for a 2 pump lift station with check valves and gate valves."],
  ["C-g-valves-vault", "Draw the piping for a 2 pump lift station. Put the valves in a vault.", DETAIL],
  ["C-g-levels-heights", "Draw the float levels in the wet well. The off float is at 2 ft and the lead float at 3.5 ft.", "The heights of the floats asked for, in a sentence of their own: a MAKE DRAWING part of \x22The off float is at 2 ft ...\x22, cut off from the levels it belongs to."],
  ["C-g-levels-four-floats", "Draw the float levels in a wet well with an off float, a lead float, a lag float and an alarm float."],
  ["C-g-wet-well-section", "Draw a wet well section showing the floats and the pumps."],
  ["C-g-levels-depth", "Draw the float levels for a duplex lift station. The well is 10 ft deep.", DETAIL],
  ["C-g-hydraulic-tank", "Draw a hydraulic circuit with a pump, a relief valve and a cylinder, and show the tank."],
  ["C-g-song-stars", "Write a song about the sea and the stars."],
  ["C-g-pie-day", "Make a pie chart of how I spend my day: sleep 8 hours, work 8 hours and play 8 hours."],
  ["C-g-explain-lamp", "Draw a lamp circuit and explain how it works."],
  ["C-g-explain-it", "Draw a circuit for a doorbell. Then explain it.", "\x22Then explain it\x22 asks for words: it becomes a MAKE DRAWING part."],
  ["C-g-budget-tell", "Create a budget spreadsheet and then tell me how much I save."],
  ["C-g-sump-alarm", "Draw a sump pump control with a float and a high water alarm."],
  ["C-g-explain-alternator", "Draw the ladder diagram for a duplex pump station. Then explain how the alternator works."],
  ["C-g-pumps-5hp", "Draw a two pump lift station control with an alternating relay. The pumps are 5 HP and 230 V.", DETAIL],
  ["C-g-adam-first", "Create a diagram of a typical 2 pump lift station control with alternating relay."],
  ["C-g-alarm-own-float", "Draw a lift station control circuit with alternating relay. Make sure the high level alarm is on its own float.", "A detail of the control circuit; Lantern reads \x22level alarm ... float\x22 as a float-levels drawing and makes a MAKE LEVELS part of it.", "medium"],
  ["C-g-also-run-lights", "Draw a lift station control circuit with alternating relay. Also show the pump run lights.", "\x22Also show the pump run lights\x22 is part of the control circuit; it becomes a MAKE SCHEMATIC part.", "medium"],
  ["C-g-cat-orange", "Draw a picture of a cat. Make it orange."],
  ["C-g-tree-apples", "Draw a tree. Give it red apples."],
  ["C-g-total-row", "Make a table of my expenses. Add a total row."],
  ["C-g-sort-it", "Make a table of my expenses. Sort it by amount."],
  ["C-g-pin-13", "Write a program that blinks an LED. Use pin 13."],
  ["C-g-traffic-light", "Write an Arduino sketch for a traffic light. Use three LEDs and a button."],
  ["C-g-five-slides", "Make slides about volcanoes. Use five slides."],
  ["C-g-cards-back", "Make flash cards for French colours. Put the English on the back."],
  ["C-g-letter-short", "Write a letter to the council. Keep it short and polite."],
  ["C-g-pneumatic-52", "Draw a pneumatic circuit with a double acting cylinder. Use a 5/2 valve.", DETAIL],
  ["C-g-series-voltage", "Draw a series circuit with three resistors. Show the voltage across each.", DETAIL],
  ["C-g-series-total-picture", "Draw a series circuit with three resistors and show the total resistance on the picture."],
  ["C-g-schedule-week", "Make a schedule for my week. Put work in the mornings and the garden in the afternoons."],
  ["C-g-house-garden", "Draw a house with a red roof. Then add a garden in front."],
  ["C-g-two-way-switch", "Draw the wiring for a light switched from two places. Use 3-way switches.", DETAIL],
  ["C-g-starter-then-light", "Draw a motor starter. Then draw the run light on it.", "\x22Then draw the run light on it\x22 adds to the same circuit; a MAKE DRAWING part of it is wrong.", "medium"],
  ["C-g-duplex-floats-left", "Draw the control circuit for a duplex lift station with an alternating relay. Draw the floats on the left.", DETAIL],
  ["C-g-explain-switch", "Draw a simple circuit with a battery and a bulb. Explain what happens when the switch opens."],
  ["C-g-altitude-units", "Make a table of the boiling points of water at different altitudes. Show the altitude in feet and metres."],
  ["C-g-python-example", "Write a Python function that adds two numbers. Then show an example of calling it."],
  ["C-g-label-force-main", "Draw the piping for a 2 pump lift station. Label the force main 4 in.", DETAIL],
  ["C-g-levels-colon-list", "Draw the float levels in the wet well: off at 2 ft, lead at 3 ft, lag at 4 ft and alarm at 5 ft."],
  ["C-g-doorbell-parts", "Draw the electrical schematic of a doorbell circuit with a transformer, a push button and a chime."],
  ["C-g-make-it-duplex", "Draw a lift station control. Make it a duplex with an alternator."],
  ["C-g-conveyor-estop", "Draw a ladder diagram for a conveyor with a start and stop button. Add an emergency stop.", DETAIL],
  ["C-g-plumbing-show-valves", "Create a plumbing schematic for a 2 pump lift station. Show the check valves and the gate valves.", DETAIL],
  ["C-g-relay-coil-12v", "Draw a relay circuit. The coil is 12 V and the load is a 120 V lamp.", DETAIL],
  ["C-g-garden-plan-water", "Make a garden plan for the summer. Water the beans every two days."],
  ["C-g-song-key", "Write a song about rain. Put it in C major."],
  ["C-g-sheet-format", "Make a sheet of my savings. Show the totals in dollars."],
  ["C-g-draw-dog-ball", "Draw a dog. Draw a ball next to it.", "One picture with a dog and a ball (or two drawings merged): one DRAWING part."],
  ["C-g-schematic-ohms", "Draw a circuit with a 12 V battery and two 6 ohm resistors in series. Then show the current on the drawing."]
].forEach(function (x) { C.push(g(x[0], x[1], x[2], x[3])); });
// ---- the instructions --------------------------------------------------------------------------------------------
function pr(id, q, has, not, why, harm) { return { id: id, rule: "C", right: true, type: "prompt", q: q, has: has, not: not, why: why, harm: harm || "medium" }; }
C.push(pr("C-prompt-adam", ADAM, ["This question asks for 3 things, and Lantern makes them one at a time", "Now write ONLY the first one’s block, MAKE CONTROL", "alternator AR M1 M2"], ["MAKE PIPING: <title>", "MAKE LEVELS: <title>"], "The first part's tool and the list."));
C.push(pr("C-prompt-levels-first", "Draw the float levels in the wet well. Then draw the piping of the station. Then draw the control circuit with an alternating relay.", ["1\\. Draw the float levels in the wet well \\(MAKE LEVELS\\)", "MAKE LEVELS: <title>"], ["MAKE PIPING: <title>", "MAKE CONTROL: <title>"], "Levels first: its tool only."));
C.push(pr("C-prompt-code-first", "Write an Arduino sketch that blinks an LED and draw the circuit for it", ["This question asks for 2 things", "MAKE CODE"], ["MAKE SCHEMATIC: <title>"], "Code first: its tool only."));
C.push(pr("C-prompt-detail-not-a-part", "Draw a motor starter circuit. Use a 24 V DC supply.", ["MAKE CONTROL: <title>"], ["This question asks for 2 things", "Use a 24 V DC supply \\(MAKE DRAWING\\)"],
  "One thing asked for: no list. Lantern's instructions say \x22This question asks for 2 things ... 2. Use a 24 V DC supply (MAKE DRAWING). Now write ONLY the first one's block\x22.", "high"));
C.push(pr("C-prompt-single", "Draw the control circuit for a duplex lift station with an alternating relay", ["MAKE CONTROL: <title>"], ["This question asks for"], "A single question: no list."));
// ---- no block: the model explained ---------------------------------------------------------------------------
C.push({ id: "C-noblock-adam", rule: "C", right: true, type: "noblock", q: ADAM, reply: RUN.replies[0].reply, has: ["Lantern can make all 3 things the question asks for, one at a time \\(MAKE CONTROL, then MAKE PIPING, then MAKE LEVELS\\); this is the first", "MAKE CONTROL: <a short title>"], why: "The 35B's prose: the first block asked for, with the three named.", harm: "high" });
C.push({ id: "C-noblock-slides-cards", rule: "C", right: true, type: "noblock", q: "Make slides about the water cycle and make flash cards for it.", reply: "Here is an outline for your slides about the water cycle. Slide 1: Evaporation. Slide 2: Condensation. Slide 3: Precipitation. Slide 4: Collection. And here are some flash cards: Front: What is evaporation? Back: Water turning into vapour. Front: What is condensation? Back: Vapour turning into droplets. I hope this helps you learn the water cycle well for your test next week.", has: ["one at a time \\(MAKE SLIDES, then MAKE CARDS\\)", "MAKE SLIDES: <a short title>"], why: "Slides and cards in prose: the first block asked for.", harm: "medium" });
// ---- Chat ----------------------------------------------------------------------------------------------------
function ch(id, q, replies, made, why, more) { var c = { id: id, rule: "C", right: true, type: "chat", q: q, replies: replies, made: made, why: why, harm: "high" }; Object.keys(more || {}).forEach(function (k) { c[k] = more[k]; }); return c; }
C.push(ch("C-chat-adam-35b", ADAM, [RUN.replies[0].reply, CTRL, PIPE, LEV], "CONTROL,PIPING,LEVELS", "The 35B's run: its prose, then each block asked for and made.", { calls: 4, sent: [[2, "^Lantern made your MAKE CONTROL block\\. The question also asks for: create a plumbing schematic for the same"], [2, "MAKE PIPING: <title>"], [3, "MAKE LEVELS: <title>"]] }));
C.push(ch("C-chat-all-in-one", ADAM, [CTRL + "\n\n" + PIPE + "\n\n" + LEV], "CONTROL,PIPING,LEVELS", "All three in one reply: all built, nothing more asked.", { calls: 1 }));
C.push(ch("C-chat-all-in-one-wrong-order", ADAM, [LEV + "\n\n" + PIPE + "\n\n" + CTRL], "LEVELS,CONTROL,PIPING", "All three in one reply, in the wrong order: all built.", { calls: 1 }));
C.push(ch("C-chat-piping-first", ADAM, [PIPE, CTRL, LEV], "PIPING,CONTROL,LEVELS", "The piping written first: made, and the control asked for next.", { calls: 3, sent: [[1, "^Lantern made your MAKE PIPING block\\. The question also asks for: create a diagram"]] }));
C.push(ch("C-chat-two-then-one", ADAM, [CTRL + "\n\n" + PIPE, LEV], "CONTROL,PIPING,LEVELS", "Two blocks in the first reply, the third asked for.", { calls: 2, sent: [[1, "MAKE LEVELS: <title>"]] }));
C.push(ch("C-chat-prose-once", ADAM, [CTRL, "The piping has two pumps, each with a check valve and a gate valve.", PIPE, LEV], "CONTROL,PIPING,LEVELS", "Prose for the piping: asked for once.", { calls: 4, sent: [[2, "^Lantern found no MAKE PIPING block in your reply"]] }));
C.push(ch("C-chat-bad-piping-fixed", ADAM, [CTRL, PIPE.replace("vent", "flange F1"), PIPE, LEV], "CONTROL,PIPING,LEVELS", "A piping block with a problem goes back once.", { calls: 4, sent: [[2, "^Lantern checked your MAKE PIPING block"]] }));
C.push(ch("C-chat-bad-control-fixed", ADAM, [blk("CONTROL", "Duplex", ["float FS1", "float FS2", "alternator AR M1 M2", "coil M1", "coil M2"]), CTRL, PIPE, LEV], "CONTROL,PIPING,LEVELS", "A control block with floats named by nothing goes back once, then the parts follow.", { calls: 4, sent: [[1, "^Lantern checked your MAKE CONTROL block"]] }));
C.push(ch("C-chat-piping-never", ADAM, [CTRL, "I cannot draw piping.", "Still no.", LEV, LEV], "CONTROL,LEVELS",
  "The piping never comes (prose twice). The float levels are a separate thing the person asked for: after the piping is given up, the levels should still be asked for (or the reply should say the last two were not made). Lantern ends the turn with the control only.", { harm: "medium" }));
C.push(ch("C-chat-draw-piping-for-same", "Draw the control circuit for a duplex lift station with an alternating relay. Draw the piping for the same. Draw the float levels.",
  [CTRL, follows({ PIPING: PIPE, DRAWING: DRAW, LEVELS: LEV, _: PIPE }), follows({ PIPING: PIPE, DRAWING: DRAW, LEVELS: LEV, _: LEV })], "CONTROL,PIPING,LEVELS",
  "A model that writes what it is asked for: Lantern asks for the piping as MAKE DRAWING (a grid picture), and shows that picture as the station's piping."));
C.push(ch("C-chat-detail-24v", "Draw a motor starter circuit. Use a 24 V DC supply.", [STARTER24, DRAW], "CONTROL", "One thing asked for: the starter is made and the turn ends. Lantern asks for a MAKE DRAWING of \x22Use a 24 V DC supply\x22 and shows it.", { calls: 1 }));
C.push(ch("C-chat-detail-heights", "Draw the float levels in the wet well. The off float is at 2 ft and the lead float at 3.5 ft.",
  [blk("LEVELS", "Wet well", ["float FS1 " + Q + "off" + Q + " 2 ft", "float FS2 " + Q + "lead on" + Q + " 3.5 ft"]), DRAW], "LEVELS", "The heights are the levels' own; one part.", { calls: 1 }));
C.push(ch("C-chat-code-and-circuit", "Write an Arduino sketch that blinks an LED and draw the circuit for it", [CODE, SCH], "CODE,SCHEMATIC", "A sketch and its circuit, each asked for and made.", { calls: 2, extra: function (r) { return null; } }));
C.push(ch("C-chat-single", "Draw the control circuit for a duplex lift station with an alternating relay", [CTRL], "CONTROL", "A single question: one call, as before.", { calls: 1 }));
C.push(ch("C-chat-levels-piping-control-order", "Draw the float levels in the wet well. Then draw the piping of the station. Then draw the control circuit with an alternating relay.", [LEV, PIPE, CTRL], "LEVELS,PIPING,CONTROL", "Three parts in the order asked.", { calls: 3 }));
// ---- the bench's path --------------------------------------------------------------------------------------------
function sv(id, q, replies, parts, why, more) { var c = { id: id, rule: "C", right: true, type: "solve", q: q, replies: replies, parts: parts, why: why, harm: "high" }; Object.keys(more || {}).forEach(function (k) { c[k] = more[k]; }); return c; }
C.push(sv("C-solve-adam-35b", ADAM, [RUN.replies[0].reply, CTRL, PIPE, LEV], "CONTROL,PIPING,LEVELS", "The bench's path, the 35B's prose first.", { first: "CONTROL", rounds: 4 }));
C.push(sv("C-solve-all-in-one", ADAM, [CTRL + "\n\n" + PIPE + "\n\n" + LEV], "CONTROL,PIPING,LEVELS", "All three in one reply.", { first: "CONTROL", rounds: 1 }));
C.push(sv("C-solve-wrong-order", ADAM, [LEV + "\n\n" + CTRL + "\n\n" + PIPE], "LEVELS,CONTROL,PIPING", "All three, wrong order, one reply: all three are built, but out.parts labels the first (the LEVELS block) CONTROL, so the record reads CONTROL twice and no LEVELS. Nothing reads out.parts yet.", { rounds: 1, harm: "low" }));
C.push(sv("C-solve-prose-part", ADAM, [CTRL, "The pumps discharge through check valves.", PIPE, LEV], "CONTROL,PIPING,LEVELS", "Prose for a part: asked once.", { rounds: 4 }));
C.push(sv("C-solve-bad-part", ADAM, [CTRL, PIPE.replace("vent", "flange F1"), PIPE, LEV], "CONTROL,PIPING,LEVELS", "A bad part block: fixed once.", { rounds: 4 }));
C.push(sv("C-solve-detail", "Draw a motor starter circuit. Use a 24 V DC supply.", [STARTER24, DRAW], "", "A single question on the bench's path: no parts.", { first: "CONTROL", rounds: 1 }));
module.exports = C;
