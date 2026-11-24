// cases.js -- the fourth review of 1.24.36's givens, code checks and control changes (review4_1236).
// Written by a reviewer who had not seen the earlier reviews' cases. Each case says what is right; replay.js says
// AGREE or DISAGREE. Kinds:
//   given  {q, expect: "fit"|"none"|"either", given, has: [lines], lacks: [regex], harm, missHarm}
//            fit: a given shown, of that id, with every line in has and none matching lacks, that builds clean
//            none: no given shown, and the prompt byte-for-byte 1.24.35's
//            either: none, or a fit as above
//   build  {q, reply, ok, back: [regex], steps: [regex], notSteps: [regex], same, codes: regex, harm}
//   pick   {q, expect: "US"|"IEC"}
//   user   {keep: {q, reply}, q, shown: bool, bench: bool}
//   view   {q, reply, codes: regex, keep: bool, switchTo: "IEC"|"US"}
//   guard  {what: "bench"|"fixtures"}
"use strict";
var C = [];
function given(id, q, o) { o = o || {}; o.id = id; o.kind = "given"; o.q = q; C.push(o); }
function fit(id, q, gid, has, o) { o = o || {}; o.expect = "fit"; o.given = gid; o.has = has || []; given(id, q, o); }
function none(id, q, o) { o = o || {}; o.expect = "none"; given(id, q, o); }
function either(id, q, o) { o = o || {}; o.expect = "either"; given(id, q, o); }
function build(id, q, lines, o) { o = o || {}; o.id = id; o.kind = "build"; o.q = q; o.reply = Array.isArray(lines) ? lines.join("\n") : lines; C.push(o); }
function pick(id, q, p, o) { o = o || {}; o.id = id; o.kind = "pick"; o.q = q; o.expect = p; C.push(o); }
function user(id, keepQ, keepLines, q, shown, o) { o = o || {}; o.id = id; o.kind = "user"; o.keep = { q: keepQ, reply: keepLines.join("\n") }; o.q = q; o.shown = shown; C.push(o); }
var Q = "\x22";
function qt(s) { return Q + s + Q; }

// ---------------------------------------------------------------- the guards
C.push({ id: "guard-bench-prompts", kind: "guard", what: "bench" });
C.push({ id: "guard-fixture-builds", kind: "guard", what: "fixtures" });

// ---------------------------------------------------------------- three-wire starter: fits
var STD = ["stop PB1 M1", "start PB2 M1", "overload OL1 M1"];
fit("st-conveyor", "Draw a three-wire start/stop motor starter control circuit for a conveyor", "control-starter", STD.concat(["coil M1 " + qt("conveyor starter")]), { lacks: ["^lamp", "^supply", "^estop"] });
fit("st-460-120xfmr", "Draw a 3-wire start/stop motor starter control circuit for a 460V 3-phase motor with a 120V control transformer", "control-starter", ["supply " + qt("120 V AC")].concat(STD));
fit("st-run-stop-lights", "Draw the motor starter control circuit for a pump with a green run light and a red stop light", "control-starter", ["lamp LT1 M1 " + qt("run") + " green", "lamp LT2 M1 off " + qt("stopped") + " red"]);
fit("st-both-ends", "Draw a motor starter control circuit with start/stop stations at both ends of the conveyor", "control-starter", ["stop PB1 M1 " + qt("stop, local"), "stop PB2 M1 " + qt("stop, remote"), "start PB3 M1 " + qt("start, local"), "start PB4 M1 " + qt("start, remote")]);
fit("st-three-stations", "Draw a magnetic starter control circuit with three start/stop stations for a conveyor", "control-starter", ["stop PB3 M1 " + qt("stop 3"), "start PB6 M1 " + qt("start 3")]);
fit("st-fan-off-light", "Draw a motor starter control circuit for a fan, with a light that is on while the fan is off", "control-starter", ["lamp LT1 M1 off " + qt("stopped") + " red"], { lacks: [qt("run")] });
fit("st-12vdc", "Draw a start stop control circuit for a 12 V DC motor with a contactor", "control-starter", ["supply " + qt("12 V DC"), "coil M1 " + qt("motor contactor")]);
fit("st-115v-pump", "Draw a motor starter control circuit for a 1/2 hp 115 V pump", "control-starter", STD, { lacks: ["^supply"] });
fit("st-bench-a", "Draw the control circuit for a motor starter: a stop push button, a start push button with a holding contact so the motor keeps running after start is let go, the overload contact, the starter coil, and a pilot light that is on while the motor runs.", "control-starter", STD.concat(["lamp LT1 M1 " + qt("run") + " green"]));
fit("st-bench-b", "Draw the control circuit for a pump starter: a stop push button, a start push button with a holding contact, the overload contact, the contactor coil, and a pilot light that is on while the pump is stopped.", "control-starter", STD.concat(["lamp LT1 M1 off " + qt("stopped") + " red"]), { lacks: [qt("run")] });
fit("st-dol-230coil", "Draw a DOL starter control circuit with start and stop push buttons for a 7.5 kW pump, 230 V coil", "control-starter", ["supply " + qt("230 V AC")].concat(STD));
fit("st-mixer-estop", "Draw a motor starter control circuit for a mixer with an emergency stop", "control-starter", ["estop ES1"].concat(STD));
fit("st-blower-pilot", "Draw a magnetic starter control circuit for a blower with a pilot light", "control-starter", ["lamp LT1 M1 " + qt("run") + " green"]);
fit("st-saw-mushroom", "Draw a motor starter control circuit for a table saw with a mushroom head emergency stop", "control-starter", ["estop ES1", "coil M1 " + qt("saw starter")]);
fit("st-how-wire", "How do I wire a start stop station to a motor starter for a pump?", "control-starter", STD);
fit("st-24vdc-grinder", "Draw a start/stop control circuit for a grinder, 24 V DC control", "control-starter", ["supply " + qt("24 V DC")]);
fit("st-two-locations", "Draw a motor starter control circuit for a conveyor with start/stop push buttons in two locations", "control-starter", ["stop PB2 M1 " + qt("stop, remote"), "start PB4 M1 " + qt("start, remote")]);
fit("st-exhaust-contactor", "Draw a contactor control circuit for an exhaust fan with start and stop push buttons", "control-starter", ["coil M1 " + qt("fan contactor")]);
fit("st-uk-run-lamp", "Draw the control circuit for a DOL starter for a pump with a stop/start station and a green run lamp, 230 V control", "control-starter", ["supply " + qt("230 V AC"), "lamp LT1 M1 " + qt("run") + " green"]);
fit("st-au-two-volts", "Draw the control circuit for a DOL starter with a stop/start station and a run lamp, 415 V motor, 240 V control", "control-starter", ["supply " + qt("240 V AC"), "lamp LT1 M1 " + qt("run") + " green"]);
fit("st-light-off-when-stops", "Draw a start/stop control circuit for a pump with a light that turns off when the pump stops", "control-starter", ["lamp LT1 M1 " + qt("run") + " green"], { lacks: [qt("stopped")] });
fit("st-local-remote", "Draw a motor starter control circuit with local and remote start/stop stations for a crusher", "control-starter", ["stop PB1 M1 " + qt("stop, local"), "start PB4 M1 " + qt("start, remote"), "coil M1 " + qt("crusher starter")]);
fit("st-compressor-motor", "Draw a motor starter control circuit for a compressor motor", "control-starter", ["coil M1 " + qt("compressor starter")]);
fit("st-lathe", "Wire a motor starter for a lathe with a stop and start button", "control-starter", STD.concat(["coil M1 " + qt("lathe starter")]));
fit("st-fault-light-left", "Draw a motor starter control circuit for a 480 V motor with a run light and a fault light", "control-starter", ["lamp LT1 M1 " + qt("run") + " green"], { lacks: ["fault", "^supply"] });
fit("st-in-germany", "Draw a three-wire motor starter control circuit for a pump in Germany", "control-starter", STD);
fit("st-light-off-motor-starts", "Draw a motor starter control circuit for a conveyor with a pilot light that goes out when the motor starts", "control-starter", ["lamp LT1 M1 off " + qt("stopped") + " red"], { lacks: [qt("run")] });
fit("st-power-light-left", "Draw a motor starter control circuit for a pump with a power on light and a run light", "control-starter", ["lamp LT1 M1 " + qt("run") + " green"], { lacks: ["power"] });

// ---------------------------------------------------------------- three-wire starter: refused, rightly
none("st-no-two-speed", "Draw a two-speed motor starter control circuit for a fan");
none("st-no-jog", "Draw a motor starter control circuit with start, stop and jog buttons for a conveyor");
none("st-no-hoa", "Draw a motor starter control circuit for a pump with a hand-off-auto switch");
none("st-no-vfd", "Draw a start stop control circuit for a VFD driving a fan");
none("st-no-two-machines", "Draw a motor starter control circuit for a pump and a fan");
none("st-no-iec-tags", "Draw the motor starter control circuit for a fan with start button S2 and stop button S1, contactor K1");
none("st-no-explain", "Explain how a three-wire motor starter control circuit works");
none("st-no-explain-draw", "Explain and draw a three-wire motor starter control circuit for a pump");
none("st-no-size", "What size overload heaters go in the motor starter control circuit for a 10 hp pump?");
none("st-no-two-wire", "Draw a two-wire control circuit for a motor starter with a thermostat");
none("st-no-barn-lights", "Draw a contactor control circuit with start and stop buttons for the lights in the barn");
none("st-no-heater", "Draw a start/stop contactor control circuit for a 10 kW heater");
none("st-no-hoist", "Draw a start stop motor starter control circuit for a hoist");
none("st-no-pressure", "Draw a motor starter control circuit for a pump with a pressure switch");
none("st-no-soft-start", "Draw a soft starter control circuit for a pump");
none("st-no-star-delta", "Draw a star-delta starter control circuit for a 30 kW fan");
none("st-no-two-stops", "Draw a motor starter control circuit with two stop buttons and one start button for a conveyor");
none("st-no-motor-and-panel", "Draw a motor starter control circuit for a conveyor with start/stop at the motor and at the panel");
none("st-no-colours-unsaid", "Draw a motor starter control circuit with a green light and a red light");
none("st-no-held", "Draw a motor starter control circuit where the start button must be held to run the motor");
none("st-no-restart", "Draw a start stop motor starter circuit where the motor does not restart after a power failure");
none("st-no-pump-fan-shaft", "Draw a motor starter control circuit for a fan with a pump on the same shaft");
none("st-no-control-room", "Draw a motor starter control circuit with start and stop buttons in the control room and at the machine");
none("st-no-door", "Draw a motor starter control circuit for a fan with start stop push buttons on the door and at the motor");
either("st-dust-collector", "Draw a motor starter control circuit for a dust collector fan", { has: STD });
either("st-energized", "Draw a motor starter control circuit with a pilot light that is on when the starter is energized", { has: ["lamp LT1 M1 " + qt("run") + " green"] });
either("st-remote-start", "Draw a motor starter control circuit for a pump with a remote start button");

// ---------------------------------------------------------------- three-wire starter: mis-fits (a given shown that does not fit)
either("st-one-light-two-states", "Draw the control circuit for a motor starter with a pilot light that is on when running and off when stopped", { has: ["lamp LT1 M1 " + qt("run") + " green"], lacks: [qt("stopped")], harm: "high" });
either("st-red-on-when-stops", "Draw a motor starter control circuit with a red light that comes on when the motor stops running", { has: ["lamp LT1 M1 off " + qt("stopped") + " red"], lacks: [qt("run")], harm: "high" });
either("st-pump-light-on-off", "Draw a motor starter control circuit for a pump with a light that is on when the pump is running and off when it is stopped", { has: ["lamp LT1 M1 " + qt("run") + " green"], lacks: [qt("stopped")], harm: "high" });
none("st-light-running-or-stopped", "Draw a motor starter control circuit with a light that shows the motor is running or stopped", { harm: "medium" });
either("st-motor-and-panel-no-at", "Draw a motor starter control circuit for a conveyor with start stop buttons at the motor and the panel", { has: ["stop PB2 M1 " + qt("stop, remote")], harm: "high" });
none("st-stop-each-end", "Draw a motor starter control circuit for a conveyor with a stop button at each end", { harm: "high" });
none("st-local-plus-remote-stop", "Draw a three-wire control circuit for a fan with a local start/stop station and a remote stop", { harm: "high" });
none("st-no-holding", "Draw a motor starter control circuit with start and stop buttons and no holding contact", { harm: "medium" });
either("st-208-pump", "Draw a start/stop control circuit for a pump on 208 V", { has: STD, lacks: ["^supply"], harm: "low" });

// ---------------------------------------------------------------- forward and reverse
var REV = ["stop PB1 all", "start PB2 M1 " + qt("forward"), "start PB3 M2 " + qt("reverse"), "coil M1 " + qt("forward"), "coil M2 " + qt("reverse"), "interlock M1 M2", "overload OL1 M1 M2"];
fit("rv-conveyor", "Draw a forward reverse motor starter control circuit for a conveyor", "control-reversing", REV, { lacks: ["^lamp"] });
fit("rv-mixer-lights", "Draw a reversing starter control circuit for a mixer with forward and reverse pilot lights", "control-reversing", REV.concat(["lamp LT1 M1 " + qt("forward") + " green", "lamp LT2 M2 " + qt("reverse") + " green"]));
fit("rv-estop", "Draw a forward reverse contactor control circuit for a 3 phase motor with a stop button and an emergency stop", "control-reversing", ["estop ES1"].concat(REV));
fit("rv-australia", "Draw a forward-reverse starter control circuit for a 415 V motor in Australia", "control-reversing", REV, { lacks: ["^supply"] });
fit("rv-stop-before-reversing", "Draw a forward reverse starter control circuit where the motor must stop before reversing", "control-reversing", REV);
fit("rv-belt", "Draw a fwd/rev contactor control circuit for a 3 phase conveyor belt motor", "control-reversing", REV);
fit("rv-driving", "Draw a fwd/rev contactor control circuit for a 3 phase motor driving a conveyor belt", "control-reversing", REV, { missHarm: "low" });
fit("rv-both-directions", "Draw a reversing starter control circuit for a fan to run in both directions", "control-reversing", REV);
none("rv-no-limits", "Draw a forward/reverse starter control circuit with limit switches at each end of travel");
none("rv-no-garage-door", "Draw a forward and reverse motor control circuit for a garage door");
none("rv-no-jog", "Draw a forward reverse starter control circuit with jog buttons");
none("rv-no-one-run-light", "Draw a reversing motor starter control circuit with a run light");
none("rv-no-stop-light", "Draw a forward/reverse starter control circuit with a stop light");
none("rv-no-drum", "Draw a forward reverse control circuit for a motor with a drum switch");
none("rv-no-two-conveyors", "Draw forward reverse control circuits for two conveyors");
none("rv-no-pb-interlock", "Draw a forward/reverse starter control circuit with push button interlocking for a winch");
none("rv-no-plugging", "Draw a forward reverse starter control circuit with plugging to stop the motor");
none("rv-both-ends", "Draw a forward/reverse starter control circuit with start and stop stations at both ends", { harm: "high" });
none("rv-local-remote", "Draw a forward reverse starter control circuit for a conveyor with a local and remote station", { harm: "high" });
none("rv-two-stops", "Draw a forward reverse starter control circuit with two stop buttons", { harm: "high" });

// ---------------------------------------------------------------- motors in sequence
fit("sq-crusher-first", "Draw a control circuit where the crusher must be running before the conveyor can start", "control-sequence", ["coil M1 " + qt("crusher starter"), "coil M2 M1 " + qt("conveyor starter"), "overload OL2 M2"]);
fit("sq-fan-first", "Draw an interlocked start control circuit: the pump can only start when the fan is running", "control-sequence", ["coil M1 " + qt("fan starter"), "coil M2 M1 " + qt("pump starter")]);
fit("sq-2-before-1", "Draw the control circuit for two conveyors started in sequence, conveyor 2 before conveyor 1", "control-sequence", ["coil M1 " + qt("conveyor 2 starter"), "coil M2 M1 " + qt("conveyor 1 starter")]);
fit("sq-feeds", "Draw a control circuit with interlocked conveyors: conveyor 1 feeds conveyor 2, so conveyor 2 must be running before conveyor 1 can start", "control-sequence", ["coil M1 " + qt("conveyor 2 starter"), "coil M2 M1 " + qt("conveyor 1 starter")]);
fit("sq-chain-3", "Draw a sequence start control circuit for three conveyors: conveyor 3 first, then conveyor 2, then conveyor 1", "control-sequence", ["coil M1 " + qt("conveyor 3 starter"), "coil M2 M1 " + qt("conveyor 2 starter"), "coil M3 M2 " + qt("conveyor 1 starter")]);
fit("sq-mixer-while-pump", "The mixer should only run while the pump is running: draw the control circuit", "control-sequence", ["coil M1 " + qt("pump starter"), "coil M2 M1 " + qt("mixer starter")]);
fit("sq-a-b", "Draw a control circuit where conveyor B cannot start unless conveyor A is running", "control-sequence", ["coil M1 " + qt("conveyor A starter"), "coil M2 M1 " + qt("conveyor B starter")]);
fit("sq-run-lights", "Draw a sequence control circuit for two conveyors that start in sequence, with a run light for each", "control-sequence", ["lamp LT1 M1 " + qt("conveyor 1 run") + " green", "lamp LT2 M2 " + qt("conveyor 2 run") + " green"]);
none("sq-no-never-together", "Draw a control circuit where the fan must not run while the pump is running");
none("sq-no-after-stopped", "Draw a control circuit where pump 2 starts after pump 1 has stopped");
none("sq-no-lube", "Draw a control circuit: start the lube pump first, then the main motor");
none("sq-no-reverse-order", "Draw a sequence control circuit for three conveyors; start them in reverse order");
none("sq-no-timer", "Draw a sequence start control circuit for two conveyors with a timer between the starts");
none("sq-no-auto", "Draw a control circuit where the second conveyor starts automatically after the first one is running");
either("sq-not-before-mixer", "Draw a control circuit where the conveyor cannot start before the mixer", { has: ["coil M1 " + qt("mixer starter"), "coil M2 M1 " + qt("conveyor starter")] });
either("sq-second-first", "Draw a control circuit with two pumps that start in sequence, the second pump starts first", { has: ["coil M1 " + qt("pump 2 starter")] });
none("sq-last-one-first", "Draw a sequence control circuit: three conveyors start in sequence, the last one first", { harm: "high" });
none("sq-one-start-button", "Draw a sequence control circuit for two conveyors started in sequence with one start button", { harm: "high" });
none("sq-downstream-first", "Draw a sequence start control circuit for two conveyors; the downstream conveyor must start first", { harm: "low" });
none("sq-iec-tags", "Draw a sequence control circuit where conveyor 2 (contactor KM2) can only start after conveyor 1 (contactor KM1) is running", { harm: "medium" });

// ---------------------------------------------------------------- delayed start
var DLY = ["stop PB1 CR1", "start PB2 CR1", "relay CR1 " + qt("run"), "overload OL1 M1 CR1"];
fit("dl-horn-10s", "Draw a delayed start control circuit for a conveyor: a warning horn sounds for 10 seconds, then the conveyor starts", "control-delayed-start", DLY.concat(["timer TR1 " + qt("10 s") + " CR1", "coil M1 TR1 " + qt("conveyor starter"), "horn AH1 CR1 TR1 off " + qt("warning")]));
fit("dl-fan-5min", "Draw a time delay start control circuit for a fan, 5 minutes", "control-delayed-start", DLY.concat(["timer TR1 " + qt("5 min") + " CR1"]), { lacks: ["^horn"] });
fit("dl-crusher-15s", "Draw a control circuit for a crusher with a pre-start warning horn, starting 15 s after start is pressed", "control-delayed-start", ["timer TR1 " + qt("15 s") + " CR1", "horn AH1 CR1 TR1 off " + qt("warning")]);
fit("dl-1.5min", "Draw a delayed start control circuit for a pump, starting 1.5 minutes after the start button is pressed", "control-delayed-start", ["timer TR1 " + qt("1.5 min") + " CR1"]);
fit("dl-45s-words", "Draw a time delay start control circuit for a conveyor: it starts forty-five seconds after start is pressed", "control-delayed-start", ["timer TR1 " + qt("45 s") + " CR1"]);
fit("dl-estop", "Draw a delayed start control circuit for a mixer with an emergency stop, starting 20 seconds after start is pressed", "control-delayed-start", ["estop ES1", "timer TR1 " + qt("20 s") + " CR1"]);
none("dl-no-two-machines", "Draw a delayed start control circuit where the fan starts 30 seconds after the pump");
none("dl-no-power-on", "Draw a delayed start control circuit: the compressor starts 2 minutes after power is turned on");
none("dl-no-runs-for", "Draw a delayed start control circuit for a mixer that starts 10 seconds after start is pressed and runs for 5 minutes");
none("dl-no-off-delay", "Draw an off-delay control circuit: the fan keeps running 5 minutes after the heater stops");
none("dl-no-beacon", "Draw a delayed start control circuit for a pump with a beacon that flashes before it starts");
none("dl-no-two-times", "Draw a delayed start control circuit for a conveyor with a horn that sounds for 5 seconds and a start 10 seconds after the start button");
none("dl-iec-tags", "Draw a delayed start control circuit: the motor contactor KM1 starts 10 seconds after start button S1 is pressed", { harm: "medium" });
none("dl-range", "Draw the control circuit for a delayed start: the conveyor starts 10-15 seconds after start is pressed", { harm: "medium" });
none("dl-between", "Draw a delayed start control circuit for a conveyor that starts between 5 and 10 seconds after start is pressed", { harm: "medium" });

// ---------------------------------------------------------------- air compressor
var CMP = ["switch SS1 M1 " + qt("on/off"), "overload OL1 M1"];
fit("cp-90-120", "Draw the control circuit for an air compressor with a pressure switch, cut in at 90 psi and cut out at 120 psi", "control-compressor", CMP.concat(["pressure PS1 M1 nc " + qt("cut-out 120 psi"), "coil M1 " + qt("compressor starter")]));
fit("cp-8bar", "Draw the motor starter control circuit for a shop air compressor on a pressure switch that cuts out at 8 bar", "control-compressor", ["pressure PS1 M1 nc " + qt("cut-out 8 bar")]);
fit("cp-pilot", "Draw the contactor control circuit for an air compressor with a pressure switch and a pilot light that shows when the compressor is running", "control-compressor", ["pressure PS1 M1 nc " + qt("opens at cut-out"), "coil M1 " + qt("compressor contactor"), "lamp LT1 M1 " + qt("run") + " green"]);
fit("cp-differential", "Draw the control circuit for an air compressor with a pressure switch, cut-out 20 psi above the cut-in", "control-compressor", ["pressure PS1 M1 nc " + qt("opens at cut-out")]);
fit("cp-germany", "Draw the control circuit for a 400 V air compressor with a pressure switch in Germany", "control-compressor", CMP, { lacks: ["^supply"] });
fit("cp-estop", "Draw the motor starter control circuit for an air compressor with a pressure switch and an emergency stop", "control-compressor", ["estop ES1", "pressure PS1 M1 nc " + qt("opens at cut-out")]);
none("cp-no-freezer", "Draw a compressor starter control circuit with a pressure switch for a walk-in freezer");
none("cp-no-high-temp", "Draw a motor starter control circuit for an air compressor with a pressure switch and a high temperature switch");
none("cp-no-oil", "Draw the control circuit for an air compressor starter with a pressure switch and a low oil level switch");
none("cp-no-refrigeration", "Draw a control circuit for a refrigeration compressor with a low pressure switch and a high pressure switch");
none("cp-no-two", "Draw the control circuit for two air compressors on one pressure switch");
none("cp-no-duplex", "Draw the control circuit for a duplex air compressor with lead/lag pressure switches");
none("cp-no-explain", "Explain the control circuit for an air compressor with a pressure switch");
none("cp-no-drain", "Draw the control circuit for an air compressor with a pressure switch and an auto drain solenoid");
none("cp-no-heat-pump", "Draw the contactor control circuit for a heat pump compressor with a pressure switch");
none("cp-no-low-pressure-light", "Draw the control circuit for an air compressor with a pressure switch and a low pressure light");

// ---------------------------------------------------------------- tank fill, one float
var FIL = ["switch SS1 M1 " + qt("on/off"), "float FS1 M1 nc " + qt("tank full"), "overload OL1 M1"];
fit("fl-basic", "Draw the control circuit for a pump that fills a tank, with a float switch", "control-fill", FIL.concat(["coil M1 " + qt("pump starter")]));
fit("fl-trough", "Draw the contactor control circuit for a pump that fills a cattle trough with a float switch", "control-fill", FIL.concat(["coil M1 " + qt("pump contactor")]));
fit("fl-running-light", "Draw the control circuit for a pump that fills a water tank, with a float switch and a pump running light", "control-fill", FIL.concat(["lamp LT1 M1 " + qt("pump on") + " green"]));
fit("fl-cistern-well-pump", "Draw the control circuit for a well pump filling a cistern with a float switch", "control-fill", FIL);
fit("fl-stock-tank", "Draw the control circuit for a pump that keeps a stock tank full with a float switch", "control-fill", FIL);
fit("fl-tower", "Draw the motor starter control circuit for a pump that fills a water tower with a float switch", "control-fill", FIL);
none("fl-no-from-well", "Draw the control circuit for a pump that fills a tank from a well, with a float switch in the tank");
none("fl-no-dry", "Draw the control circuit for a pump that fills a tank with a float switch, and stops the pump if the well runs dry");
none("fl-no-low-cutoff", "Draw the control circuit for a pump that fills an overhead tank with a float switch and a low level cut-off");
none("fl-no-alarm", "Draw the control circuit for a pump that fills a tank with a float switch and an overflow alarm");
none("fl-no-valve", "Draw the control circuit for a solenoid valve that fills a tank with a float switch");
none("fl-no-drain", "Draw the control circuit for a pump that fills a tank with a float switch and drains it with a valve");
none("fl-no-empty", "Draw the control circuit for a pump that fills a tank with a float switch that stops the pump when the tank is empty");
either("fl-borehole", "Draw the control circuit for a borehole pump filling an overhead tank with a float switch", { has: FIL });
none("fl-level-switches", "Draw the control circuit for a pump that fills a tank using level switches", { harm: "medium" });
none("fl-iec-tags", "Draw the control circuit for a pump that fills a tank, contactor K1 and float switch B1", { harm: "medium" });

// ---------------------------------------------------------------- tank fill, two floats
var FT = ["float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "overload OL1 M1"];
fit("ft-high-low", "Draw the control circuit for a pump that fills a tank with a high float and a low float", "control-fill-two", FT);
fit("ft-pilot", "Draw the control circuit for a pump that fills a tank with two floats and a pilot light that is on while the pump runs", "control-fill-two", FT.concat(["lamp LT1 M1 " + qt("pump on") + " green"]));
fit("ft-2-switches", "Draw the motor starter control circuit for a pump that fills a tank with 2 float switches, start at low level and stop at high level", "control-fill-two", FT);
fit("ft-tower", "Draw the control circuit for a pump that fills a water tower, with a low level float to start it and a high level float to stop it", "control-fill-two", FT);
fit("ft-between", "Draw the control circuit for a pump that fills a tank between a low float and a high float", "control-fill-two", FT);
none("ft-no-alarm", "Draw the control circuit for a pump that fills a tank with high and low level floats and a high level alarm");
none("ft-no-cistern", "Draw the control circuit for a pump that fills a tank from a cistern with two floats");
none("ft-no-three", "Draw the control circuit for a pump that fills a tank with three floats");
none("ft-no-series", "Draw the control circuit for a pump that fills a tank with two floats wired in series");
none("ft-iec-tags", "Draw the control circuit for a pump that fills a tank between a low float and a high float, contactor KM1", { harm: "medium" });

// ---------------------------------------------------------------- sump pump
var SMP = ["switch SS1 M1 " + qt("on/off"), "float FS1 M1 " + qt("pump on"), "overload OL1 M1"];
fit("sp-basic", "Draw the control wiring for a sump pump with a float switch", "control-sump", SMP.concat(["coil M1 " + qt("pump starter")]), { lacks: ["FS2", "^lamp", "^horn"] });
fit("sp-hw-light", "Draw a ladder diagram for a sump pump with a float switch and a high water alarm light", "control-sump", SMP.concat(["float FS2 " + qt("high level alarm"), "lamp LT1 FS2 " + qt("high water") + " red"]));
fit("sp-hw-horn", "Draw the control circuit for a sump pump with a float switch and a high water alarm horn", "control-sump", SMP.concat(["float FS2 " + qt("high level alarm"), "horn AH1 FS2 " + qt("high water")]));
fit("sp-bilge-12v", "Draw the contactor control circuit for a bilge pump with a float switch, 12 V DC", "control-sump", ["supply " + qt("12 V DC"), "coil M1 " + qt("pump contactor")]);
fit("sp-basement-pilot", "Draw the control circuit for a basement sump pump with a float switch and a pilot light when the pump runs", "control-sump", SMP.concat(["lamp LT1 M1 " + qt("pump on") + " green"]));
fit("sp-pit", "Draw the motor starter control circuit for a pump that empties a pit, with a float switch", "control-sump", SMP);
either("sp-alarm-light", "Draw the control circuit for a sump pump with a float switch and an alarm light", { has: SMP, harm: "low" });
none("sp-no-fail-alarm", "Draw the control circuit for a sump pump with a float switch and a pump fail alarm");
none("sp-no-into-tank", "Draw the control circuit for a sump pump with a float switch that pumps into a holding tank");
none("sp-no-duplex", "Draw a sump pump control circuit with two pumps alternating");
none("sp-no-two-floats", "Draw the control circuit for a sump pump with two floats");
none("sp-no-silence", "Draw the control circuit for a sump pump with a float switch and an alarm horn with a silence button");
none("sp-no-iec", "Draw a sump pump control circuit with a float switch, contactor KM1");
none("sp-no-refrig-pumpdown", "Draw the pump down control circuit for a walk-in cooler");
none("sp-no-refrig-solenoid", "Draw a pump-down control circuit with a liquid line solenoid and a low pressure switch");
none("sp-overload-alarm-light", "Draw the control circuit for a sump pump with a float switch and an overload alarm light", { harm: "high" });
none("sp-horn-when-runs", "Draw the control circuit for a sump pump with a float switch and an alarm horn that sounds when the pump runs", { harm: "high" });
none("sp-manual-run", "Draw the control circuit for a sump pump with a float switch and a manual run switch", { harm: "high" });

// ---------------------------------------------------------------- model replies: copies of givens, small changes, fences, numbers, no END
function L() { return [].slice.call(arguments); }
build("rp-starter-copy", "Draw a three-wire start/stop motor starter control circuit for a conveyor", L("MAKE CONTROL: Conveyor starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("conveyor starter"), "overload OL1 M1", "END"), { ok: true, same: true, noBack: true });
build("rp-starter-fenced", "Draw a three-wire start/stop motor starter control circuit for a conveyor", L("Here it is:", "```", "MAKE CONTROL: Conveyor starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("conveyor starter"), "overload OL1 M1", "END", "```"), { ok: true, same: true });
build("rp-starter-numbered", "Draw a three-wire start/stop motor starter control circuit for a conveyor", L("MAKE CONTROL: Conveyor starter", "1. stop PB1 M1", "2. start PB2 M1", "3. coil M1 " + qt("conveyor starter"), "4. overload OL1 M1", "END"), { ok: true, same: true });
build("rp-starter-no-end", "Draw a three-wire start/stop motor starter control circuit for a conveyor", L("MAKE CONTROL: Conveyor starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("conveyor starter"), "overload OL1 M1"), { ok: true, same: true });
build("rp-starter-two-lights", "Draw the motor starter control circuit for a pump with a green run light and a red stop light", L("MAKE CONTROL: Pump starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("pump starter"), "overload OL1 M1", "lamp LT1 M1 " + qt("run") + " green", "lamp LT2 M1 off " + qt("stopped") + " red", "END"), { ok: true, same: true, steps: ["LT2 \\(stopped, red\\) lights while M1 is off"] });
build("rp-starter-2stations", "Draw a motor starter control circuit with start/stop stations at both ends of the conveyor", L("MAKE CONTROL: Conveyor starter", "stop PB1 M1 " + qt("stop, local"), "stop PB2 M1 " + qt("stop, remote"), "start PB3 M1 " + qt("start, local"), "start PB4 M1 " + qt("start, remote"), "coil M1 " + qt("conveyor starter"), "overload OL1 M1", "END"), { ok: true, same: true, steps: ["PB3 \\(start, local\\) or PB4 \\(start, remote\\)"] });
build("rp-rev-copy", "Draw a forward reverse motor starter control circuit for a conveyor", L("MAKE CONTROL: Reversing conveyor starter").concat(REV, ["END"]), { ok: true, steps: ["PB1 \\(stop, in L1\\)", "while M2 is off", "while M1 is off"], codes: "locked out of each other" });
build("rp-rev-no-interlock", "Draw a forward reverse motor starter control circuit for a conveyor", L("MAKE CONTROL: Reversing conveyor starter", "stop PB1 all", "start PB2 M1 " + qt("forward"), "start PB3 M2 " + qt("reverse"), "coil M1 " + qt("forward"), "coil M2 " + qt("reverse"), "overload OL1 M1 M2", "END"), { ok: true, steps: ["while M2 is off", "while M1 is off"] });
build("rp-rev-stop-no-all", "Draw a forward reverse motor starter control circuit for a conveyor", L("MAKE CONTROL: Reversing conveyor starter", "stop PB1", "start PB2 M1 " + qt("forward"), "start PB3 M2 " + qt("reverse"), "coil M1 " + qt("forward"), "coil M2 " + qt("reverse"), "interlock M1 M2", "overload OL1 M1 M2", "END"), { ok: true, same: true, steps: ["PB1 \\(stop, in L1\\)"] });
build("rp-rev-stop-everything", "Draw a forward reverse motor starter control circuit for a conveyor", L("MAKE CONTROL: Reversing", "stop PB1 everything", "start PB2 M1 " + qt("forward"), "start PB3 M2 " + qt("reverse"), "coil M1 " + qt("forward"), "coil M2 " + qt("reverse"), "END"), { ok: true, steps: ["PB1 \\(stop, in L1\\)"] });
build("rp-all-on-starter", "Draw a motor starter control circuit", L("MAKE CONTROL: Motor starter", "stop PB1 all", "start PB2 M1", "coil M1 " + qt("motor starter"), "END"), { ok: true, steps: ["PB1 \\(stop, in L1\\)"] });
build("rp-all-lamp-only", "Draw a fan control", L("MAKE CONTROL: Fan", "stop PB1 all", "lamp LT1 " + qt("power") + " white", "END"), { ok: false, same: true });
build("rp-all-named-coil", "Draw a motor starter control circuit for two motors", L("MAKE CONTROL: Two motors", "stop PB1 M1 all", "start PB2 M1", "start PB3 M2", "stop PB4 M2", "coil M1 " + qt("motor 1 starter"), "coil M2 " + qt("motor 2 starter"), "END"), { ok: true, steps: ["PB1 \\(stop\\) or OL1"], notSteps: ["PB1 \\(stop, in L1\\)"] });
build("rp-seq-copy", "Draw a control circuit where the crusher must be running before the conveyor can start", L("MAKE CONTROL: Sequence start", "stop PB1 M1 " + qt("crusher stop"), "stop PB2 M2 " + qt("conveyor stop"), "start PB3 M1 " + qt("crusher start"), "start PB4 M2 " + qt("conveyor start"), "coil M1 " + qt("crusher starter"), "coil M2 M1 " + qt("conveyor starter"), "overload OL1 M1", "overload OL2 M2", "END"), { ok: true, same: true, steps: ["holds it in while M1 is on"] });
build("rp-delay-copy", "Draw a delayed start control circuit for a conveyor: a warning horn sounds for 10 seconds, then the conveyor starts", L("MAKE CONTROL: Delayed start").concat(DLY, ["timer TR1 " + qt("10 s") + " CR1", "coil M1 TR1 " + qt("conveyor starter"), "horn AH1 CR1 TR1 off " + qt("warning"), "END"]), { ok: true, same: true, steps: ["AH1 \\(warning\\) is on while CR1 is on and TR1 has not timed out", "M1 \\(conveyor starter\\) is on while TR1 has timed out"] });
build("rp-comp-copy", "Draw the control circuit for an air compressor with a pressure switch, cut in at 90 psi and cut out at 120 psi", L("MAKE CONTROL: Air compressor", "switch SS1 M1 " + qt("on/off"), "pressure PS1 M1 nc " + qt("cut-out 120 psi"), "coil M1 " + qt("compressor starter"), "overload OL1 M1", "END"), { ok: true, same: true, codes: "PS1 opens as the pressure rises" });
build("rp-comp-nc-dropped", "Draw the control circuit for an air compressor with a pressure switch, cut in at 90 psi and cut out at 120 psi", L("MAKE CONTROL: Air compressor", "switch SS1 M1 " + qt("on/off"), "pressure PS1 M1 " + qt("cut-out 120 psi"), "coil M1 " + qt("compressor starter"), "overload OL1 M1", "END"), { ok: false, back: ["Write it: pressure PS1 M1 nc \x22cut-out 120 psi\x22"] });
build("rp-comp-opens-dropped", "Draw the control circuit for an air compressor with a pressure switch", L("MAKE CONTROL: Air compressor", "switch SS1 M1 " + qt("on/off"), "pressure PS1 M1 " + qt("opens at cut-out"), "coil M1 " + qt("compressor starter"), "overload OL1 M1", "END"), { ok: false, back: ["Write it: pressure PS1 M1 nc \x22opens at cut-out\x22"] });
build("rp-fill-copy", "Draw the control circuit for a pump that fills a tank, with a float switch", L("MAKE CONTROL: Tank fill pump").concat(FIL, ["coil M1 " + qt("pump starter"), "END"]), { ok: true, same: true, steps: ["FS1 \\(tank full\\) is not tripped"] });
build("rp-fill-nc-dropped", "Draw the control circuit for a pump that fills a tank, with a float switch", L("MAKE CONTROL: Tank fill pump", "switch SS1 M1 " + qt("on/off"), "float FS1 M1 " + qt("tank full"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: false, back: ["Write it: float FS1 M1 nc \x22tank full\x22"], harm: "medium" });
build("rp-fill-old-example", "Draw the control circuit for a pump that fills a tank, with a float switch", L("MAKE CONTROL: Tank fill", "switch SS1 M1 " + qt("hand"), "float FS1 M1", "coil M1 " + qt("pump starter"), "lamp LT1 M1 " + qt("pump on") + " green", "END"), { ok: true, same: true });
build("rp-fill2-copy", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("MAKE CONTROL: Tank fill pump, two floats", "switch SS1 M1 " + qt("on/off")).concat(FT, ["coil M1 " + qt("pump starter"), "END"]), { ok: true, steps: ["When FS1 \\(low level start\\) makes, M1 \\(pump starter\\) pulls in, and its own contact holds it in while FS2 \\(high level stop\\) is not tripped"] });
build("rp-fill2-fenced-numbered", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("```", "MAKE CONTROL: Tank fill pump, two floats", "1. switch SS1 M1 " + qt("on/off"), "2. float FS1 M1 nc " + qt("low level start"), "3. float FS2 M1 nc " + qt("high level stop"), "4. coil M1 " + qt("pump starter"), "5. overload OL1 M1", "```"), { ok: true, steps: ["When FS1 \\(low level start\\) makes"] });
build("rp-fill2-no-floats", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("MAKE CONTROL: Tank fill pump", "switch SS1 M1 " + qt("on/off"), "float FS1 M1 " + qt("low level start"), "float FS2 M1 " + qt("high level stop"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: false, back: ["float FS1 M1 nc \x22low level start\x22, float FS2 M1 nc \x22high level stop\x22"] });
build("rp-fill2-no-said-no", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("MAKE CONTROL: Tank fill pump", "float FS1 M1 no " + qt("low level start"), "float FS2 M1 normally open " + qt("high level stop"), "coil M1 " + qt("pump starter"), "END"), { ok: false, back: ["float FS1 M1 nc \x22low level start\x22, float FS2 M1 nc \x22high level stop\x22"] });
build("rp-fill2-unquoted", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("MAKE CONTROL: Tank fill pump", "float FS1 M1 low", "float FS2 M1 high", "coil M1 " + qt("pump starter"), "END"), { ok: false, back: ["float FS1 M1 low nc, float FS2 M1 high nc"] });
build("rp-fill2-cutoff-label", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("MAKE CONTROL: Tank fill pump", "switch SS1 M1 " + qt("on/off"), "float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level cut-off"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: true, steps: ["When FS1 \\(low level start\\) makes"], harm: "medium" });
build("rp-fill2-mixed", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("MAKE CONTROL: Tank fill pump", "switch SS1 M1 " + qt("on/off"), "float FS1 M1 " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: false, back: ["float FS1 M1 nc \x22low level start\x22"], harm: "medium" });
build("rp-fill2-dry-run", "Draw the control circuit for a well pump that fills a storage tank, with a dry-run float", L("MAKE CONTROL: Well pump", "float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "float FS3 M1 " + qt("well dry run"), "coil M1 " + qt("well pump starter"), "overload OL1 M1", "END"), { ok: true, steps: ["When FS1 \\(low level start\\) makes", "FS3 \\(well dry run\\) is made"] });
build("rp-fill2-supply-guard", "Draw the control circuit for a transfer pump that fills a tank", L("MAKE CONTROL: Transfer pump", "float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "float FS3 M1 " + qt("supply low cut-out"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: true, steps: ["When FS1 \\(low level start\\) makes", "FS3 \\(supply low cut-out\\) is made"], notSteps: ["When FS3"] });
build("rp-fill2-guard-nc", "Draw the control circuit for a transfer pump that fills a tank", L("MAKE CONTROL: Transfer pump", "float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "float FS3 M1 nc " + qt("suction low cut-out"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: false, back: ["Write it: float FS3 M1 \x22suction low cut-out\x22"] });
build("rp-fill2-two-vessels", "Draw the control circuit for a pump that fills the house tank from a cistern", L("MAKE CONTROL: House tank", "float FS1 M1 nc " + qt("tank low"), "float FS2 M1 nc " + qt("tank high"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: true, steps: ["When FS1 \\(tank low\\) makes"], harm: "low" });
build("rp-fill2-pond", "Draw the control circuit for a pump that fills a tank", L("MAKE CONTROL: Tank fill", "float FS1 M1 nc " + qt("pond low"), "float FS2 M1 nc " + qt("tank high"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: true, notSteps: ["When FS1 \\(pond low\\) makes"] });
build("rp-fill2-relay", "Draw the control circuit for a pump that fills a tank with a high float and a low float", L("MAKE CONTROL: Tank fill", "float FS1 CR1 nc " + qt("low"), "float FS2 CR1 nc " + qt("high"), "coil CR1 " + qt("fill relay"), "coil M1 CR1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: true, steps: ["When FS1 \\(low\\) makes, CR1 \\(fill relay\\) pulls in"] });
build("rp-fill2-with-stop-pb", "Draw the control circuit for a pump that fills a tank with a high float and a low float and a stop button", L("MAKE CONTROL: Tank fill", "stop PB1 M1", "float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "coil M1 " + qt("pump starter"), "END"), { ok: true, steps: ["When FS1 \\(low level start\\) makes", "PB1 \\(stop\\)"] });
build("rp-fill2-start-pb-left", "Draw the control circuit for a pump that fills a tank with a high float and a low float and a start button", L("MAKE CONTROL: Tank fill", "start PB2 M1", "float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "coil M1 " + qt("pump starter"), "END"), { ok: true, same: true });
build("rp-hopper-levels", "Draw the control circuit for an auger that fills a grain hopper with two level switches", L("MAKE CONTROL: Hopper fill", "float FS1 M1 " + qt("low level start"), "float FS2 M1 " + qt("high level stop"), "coil M1 " + qt("auger starter"), "overload OL1 M1", "END"), { ok: false, back: ["float FS1 M1 nc \x22low level start\x22, float FS2 M1 nc \x22high level stop\x22"] });
build("rp-sump-copy", "Draw a ladder diagram for a sump pump with a float switch and a high water alarm light", L("MAKE CONTROL: Sump pump").concat(SMP, ["coil M1 " + qt("pump starter"), "float FS2 " + qt("high level alarm"), "lamp LT1 FS2 " + qt("high water") + " red", "END"]), { ok: true, same: true, steps: ["LT1 \\(high water, red\\) lights while FS2 \\(high level alarm\\) is made"] });
build("rp-sump-two-nc-left", "Draw the control circuit for a sump pump with a high and a low float", L("MAKE CONTROL: Sump", "float FS1 M1 nc " + qt("low"), "float FS2 M1 nc " + qt("high"), "coil M1 " + qt("pump starter"), "END"), { ok: true, same: true });
build("rp-sump-on-off", "Draw the control circuit for a sump pump with an on float and an off float", L("MAKE CONTROL: Sump", "float FS1 M1 " + qt("pump off"), "float FS2 M1 " + qt("pump on"), "coil M1 " + qt("pump starter"), "END"), { ok: true, same: true, steps: ["When FS2 \\(pump on\\) makes"] });
build("rp-duplex-pumps", "Draw the control circuit for a duplex lift station with an alternating relay", L("MAKE CONTROL: Duplex pump station", "supply " + qt("120 V AC"), "float FS1 " + qt("off"), "float FS2 " + qt("lead on"), "float FS3 " + qt("lag on"), "float FS4 " + qt("high level alarm"), "alternator AR M1 M2", "coil M1 " + qt("pump 1 starter"), "coil M2 " + qt("pump 2 starter"), "lamp LT1 M1 " + qt("pump 1 run") + " green", "lamp LT2 M2 " + qt("pump 2 run") + " green", "lamp LT3 FS4 " + qt("high level") + " red", "END"), { ok: true, same: true });
build("rp-iec-tags", "Draw a motor starter control circuit for a fan to IEC", L("MAKE CONTROL: Fan contactor", "stop S1 KM1", "start S2 KM1", "coil KM1 " + qt("fan contactor"), "overload F2 KM1", "lamp H1 KM1 " + qt("run") + " green", "END"), { ok: true, same: true, codes: "IEC 60204-1:2016, 7\\.3" });

// ---------------------------------------------------------------- code checks: right circuits kept
build("cc-boiler", "Draw the burner control circuit for a boiler with a thermostat, a high limit and a low water cut-off", L("MAKE CONTROL: Boiler burner", "coil CR1 " + qt("burner relay"), "temp TS1 CR1 " + qt("thermostat"), "temp TS2 CR1 nc " + qt("high limit"), "float FS1 CR1 " + qt("low water cut-off"), "lamp LT1 CR1 " + qt("burner on") + " amber", "END"), { ok: true, codes: "TS2 opens as the temperature rises, FS1 opens as the water falls" });
build("cc-refrig", "Draw the control circuit for a refrigeration compressor with a low pressure cut-out and a high pressure cut-out", L("MAKE CONTROL: Refrigeration compressor", "coil M1 " + qt("compressor contactor"), "pressure PS1 M1 " + qt("low pressure cut-out"), "pressure PS2 M1 nc " + qt("high pressure cut-out"), "temp TS1 M1 nc " + qt("thermostat"), "overload OL1 M1", "END"), { ok: true, codes: "PS1 opens as the pressure falls, PS2 opens as the pressure rises" });
build("cc-well", "Draw the control circuit for a well pump with a pressure switch, cut-in 40 psi and cut-out 60 psi, and a low pressure cut-off", L("MAKE CONTROL: Well pump", "pressure PS1 M1 nc " + qt("cut-in 40 psi, cut-out 60 psi"), "pressure PS2 M1 " + qt("low pressure cut-off"), "coil M1 " + qt("well pump starter"), "overload OL1 M1", "END"), { ok: true });
build("cc-exhaust-fan", "Draw the control circuit for an exhaust fan that runs when the temperature is high", L("MAKE CONTROL: Exhaust fan", "temp TS1 M1 " + qt("high temperature"), "coil M1 " + qt("exhaust fan starter"), "overload OL1 M1", "END"), { ok: true, same: true });
build("cc-hpu", "Draw the control circuit for a hydraulic power unit motor starter with a high pressure cut-out, low oil level and high oil temperature shutdown", L("MAKE CONTROL: Hydraulic power unit", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("pump motor starter"), "pressure PS1 M1 nc " + qt("high pressure cut-out"), "float FS1 M1 " + qt("low oil level cut-out"), "temp TS1 M1 nc " + qt("high oil temperature shutdown"), "overload OL1 M1", "END"), { ok: true, codes: "FS1 opens as the level falls" });
build("cc-heater", "Draw the control circuit for a heater contactor with a thermostat and a high limit", L("MAKE CONTROL: Heater", "temp TS1 M1 nc " + qt("thermostat"), "temp TS2 M1 nc " + qt("high limit"), "coil M1 " + qt("heater contactor"), "END"), { ok: true });
build("cc-heater-ol-ref", "Draw the control circuit for a heater contactor with a thermostat and a high limit", L("MAKE CONTROL: Heater", "temp TS1 M1 nc " + qt("thermostat"), "temp TS2 M1 nc " + qt("high limit"), "coil M1 " + qt("heater contactor"), "END"), { ok: true, notCodes: "Article 430", harm: "low" });
build("cc-heat-trace", "Draw the control circuit for heat trace with a low temperature thermostat", L("MAKE CONTROL: Heat trace", "temp TS1 M1 nc " + qt("low temperature"), "coil M1 " + qt("heat trace contactor"), "END"), { ok: true, same: true });
build("cc-freezestat-fan", "Draw the control circuit for an air handler supply fan with a freeze stat", L("MAKE CONTROL: Supply fan", "stop PB1 M1", "start PB2 M1", "temp TS1 M1 " + qt("freezestat low temperature cut-out"), "coil M1 " + qt("supply fan starter"), "overload OL1 M1", "END"), { ok: true, same: true });
build("cc-kiln", "Draw the control circuit for a kiln with an over-temperature cut-out", L("MAKE CONTROL: Kiln", "temp TS1 CR1 nc " + qt("over-temperature cut-out"), "temp TS2 CR1 nc " + qt("controller"), "coil CR1 " + qt("kiln contactor"), "END"), { ok: true });
build("cc-booster-suction", "Draw a motor starter control for a pump with a low suction pressure cut-out", L("MAKE CONTROL: Booster pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + qt("low suction pressure cut-out"), "coil M1 " + qt("booster pump starter"), "overload OL1 M1", "END"), { ok: true });
build("cc-vacuum-mbar", "Draw the control circuit for a vacuum pump with a vacuum switch", L("MAKE CONTROL: Vacuum pump", "pressure PS1 M1 " + qt("cut-in 600 mbar, cut-out 200 mbar"), "coil M1 " + qt("vacuum pump starter"), "overload OL1 M1", "END"), { ok: true });
build("cc-refrig-ci-co", "Draw the control circuit for a refrigeration compressor with a pressure switch", L("MAKE CONTROL: Compressor", "pressure PS1 M1 " + qt("cut-in 35 psi, cut-out 15 psi"), "coil M1 " + qt("compressor contactor"), "END"), { ok: true });
build("cc-air-co", "Draw the control circuit for an air compressor", L("MAKE CONTROL: Air compressor", "pressure PS1 M1 nc " + qt("cut-out 125 psi"), "coil M1 " + qt("compressor starter"), "overload OL1 M1", "END"), { ok: true });
build("cc-tower-fan", "Draw the control circuit for a cooling tower fan on a high temperature thermostat", L("MAKE CONTROL: Cooling tower fan", "temp TS1 M1 " + qt("high temperature cut-in"), "coil M1 " + qt("tower fan starter"), "overload OL1 M1", "END"), { ok: true, same: true });
build("cc-fill-highcut", "Draw the control circuit for a pump that fills a tank with a high level cut-off float", L("MAKE CONTROL: Fill", "float FS1 M1 nc " + qt("high level cut-off"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: true, codes: "FS1 opens as the water rises" });
build("cc-sump-high-start", "Draw the control circuit for a sump pump with a high level float", L("MAKE CONTROL: Sump", "float FS1 M1 " + qt("high level"), "coil M1 " + qt("sump pump starter"), "END"), { ok: true, same: true });
build("cc-sump-safety", "Draw the control circuit for a sump pump with a high level safety float", L("MAKE CONTROL: Sump", "float FS1 M1 " + qt("high level safety cut-in"), "float FS2 M1 " + qt("pump on"), "coil M1 " + qt("sump pump starter"), "END"), { ok: true, same: true });
build("cc-boiler-low-limit", "Draw a boiler burner control with a low limit", L("MAKE CONTROL: Boiler", "temp TS1 CR1 nc " + qt("low limit"), "coil CR1 " + qt("burner relay"), "END"), { ok: true, same: true });
build("cc-low-ambient", "Draw the control circuit for a condensing unit with a low ambient cut-out", L("MAKE CONTROL: Condensing unit", "temp TS1 M1 " + qt("low ambient cut-out"), "coil M1 " + qt("compressor contactor"), "END"), { ok: true });
build("cc-dosing", "Draw the control circuit for a chemical dosing pump with a low level cut-off", L("MAKE CONTROL: Dosing pump", "float FS1 M1 " + qt("low level cut-off"), "coil M1 " + qt("dosing pump starter"), "END"), { ok: true, codes: "FS1 opens as the level falls" });
build("cc-washer", "Draw the control circuit for a pressure washer pump with a low water pressure cut-out", L("MAKE CONTROL: Pressure washer", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + qt("low water pressure cut-out"), "coil M1 " + qt("pump motor starter"), "END"), { ok: true });
build("cc-dryer-burner", "Draw the control circuit for a grain dryer burner with a high limit", L("MAKE CONTROL: Grain dryer", "coil M1 " + qt("fan starter"), "start PB2 M1", "stop PB1 M1", "coil CR1 M1 " + qt("burner relay"), "temp TS1 CR1 nc " + qt("high limit"), "END"), { ok: true });
build("cc-static-fan", "Draw the control circuit for a supply fan with a high static pressure safety", L("MAKE CONTROL: Supply fan", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + qt("high static pressure safety"), "coil M1 " + qt("supply fan starter"), "END"), { ok: true, same: true });
build("cc-chiller-lowtemp", "Draw the control circuit for a chiller compressor with a low temperature cut-out", L("MAKE CONTROL: Chiller", "temp TS1 M1 " + qt("low temperature cut-out"), "coil M1 " + qt("compressor contactor"), "END"), { ok: true });
build("cc-relay-cutout", "Draw an air compressor control with a run relay", L("MAKE CONTROL: Compressor", "coil CR1 " + qt("compressor run relay"), "pressure PS1 CR1 nc " + qt("cut-out 150 psi"), "coil M1 CR1 " + qt("compressor starter"), "overload OL1 M1", "END"), { ok: true });
build("cc-coil-line-nc", "Draw a compressor control", L("MAKE CONTROL: Compressor", "switch SS1 M1", "coil M1 PS1 nc " + qt("compressor starter"), "pressure PS1 " + qt("high pressure cut-out"), "END"), { ok: true });
build("cc-silence", "Draw an alarm circuit with a horn silence button", L("MAKE CONTROL: Alarm", "float FS1 CR1 " + qt("high level alarm"), "coil CR1 " + qt("alarm relay"), "button PB1 CR2 " + qt("horn off"), "coil CR2 CR1 " + qt("silence relay"), "horn AH1 CR1 CR2 off " + qt("alarm"), "lamp LT1 CR1 " + qt("high level") + " red", "END"), { ok: true, same: true });
build("cc-trip-light", "Draw a motor starter with a trip light", L("MAKE CONTROL: Motor starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("motor starter"), "overload OL1 M1", "lamp LT1 OL1 " + qt("overload tripped") + " amber", "END"), { ok: true, same: true });
build("cc-trip-light-no", "Draw a motor starter with a trip light", L("MAKE CONTROL: Motor starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("motor starter"), "overload OL1 M1", "overload OL1 LT1 no", "lamp LT1 " + qt("overload tripped") + " amber", "END"), { ok: true, same: true });

// ---------------------------------------------------------------- code checks: wrong circuits sent back, with the right line
build("cw-boiler", "Draw the burner control circuit for a boiler with a thermostat, a high limit and a low water cut-off", L("MAKE CONTROL: Boiler burner", "coil CR1 " + qt("burner relay"), "temp TS1 CR1 " + qt("thermostat"), "temp TS2 CR1 " + qt("high limit"), "float FS1 CR1 nc " + qt("low water cut-off"), "END"), { ok: false, back: ["Write it: temp TS2 CR1 nc \x22high limit\x22", "Write it: float FS1 CR1 \x22low water cut-off\x22"] });
build("cw-well", "Draw the control circuit for a well pump with a pressure switch, cut-in 40 psi and cut-out 60 psi", L("MAKE CONTROL: Well pump", "pressure PS1 M1 " + qt("cut-in 40 psi, cut-out 60 psi"), "coil M1 " + qt("well pump starter"), "overload OL1 M1", "END"), { ok: false, back: ["Write it: pressure PS1 M1 nc \x22cut-in 40 psi, cut-out 60 psi\x22"] });
build("cw-booster-nc", "Draw a motor starter control for a pump with a low suction pressure cut-out", L("MAKE CONTROL: Booster pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + qt("low suction pressure cut-out"), "coil M1 " + qt("booster pump starter"), "overload OL1 M1", "END"), { ok: false, back: ["Write it: pressure PS1 M1 \x22low suction pressure cut-out\x22"] });
build("cw-dry-run-nc", "Draw a pump control with a dry run float", L("MAKE CONTROL: Pump", "stop PB1 M1", "start PB2 M1", "float FS1 M1 nc " + qt("dry run protection"), "coil M1 " + qt("pump starter"), "END"), { ok: false, back: ["Write it: float FS1 M1 \x22dry run protection\x22"] });
build("cw-water-heater", "Draw a water heater control", L("MAKE CONTROL: Water heater", "temp TS1 M1 " + qt("high limit cut-out"), "temp TS2 M1 nc " + qt("thermostat"), "coil M1 " + qt("element contactor"), "END"), { ok: false, back: ["Write it: temp TS1 M1 nc \x22high limit cut-out\x22"] });
build("cw-refrig-hp", "Draw the control circuit for a refrigeration compressor with a high pressure cut-out", L("MAKE CONTROL: Compressor", "pressure PS2 M1 " + qt("high pressure cut-out"), "coil M1 " + qt("compressor contactor"), "END"), { ok: false, back: ["Write it: pressure PS2 M1 nc \x22high pressure cut-out\x22"] });
build("cw-kiln", "Draw the control circuit for a kiln with an over-temperature cut-out", L("MAKE CONTROL: Kiln", "temp TS1 CR1 " + qt("over-temperature cut-out"), "coil CR1 " + qt("kiln contactor"), "END"), { ok: false, back: ["Write it: temp TS1 CR1 nc \x22over-temperature cut-out\x22"] });
build("cw-fill-shutoff", "Draw the control circuit for a pump that fills a tank with a high level shut-off float", L("MAKE CONTROL: Fill", "float FS1 M1 " + qt("high level shut-off"), "coil M1 " + qt("pump starter"), "END"), { ok: false, back: ["Write it: float FS1 M1 nc \x22high level shut-off\x22"] });
build("cw-hpu-oil-nc", "Draw the control circuit for a hydraulic power unit with a low oil level cut-out", L("MAKE CONTROL: HPU", "stop PB1 M1", "start PB2 M1", "float FS1 M1 nc " + qt("low oil level cut-out"), "coil M1 " + qt("pump motor starter"), "END"), { ok: false, back: ["Write it: float FS1 M1 \x22low oil level cut-out\x22"] });
build("cw-iec-ref", "Draw a DOL starter for a 400 V motor", L("MAKE CONTROL: Starter", "stop PB1 M1 no", "start PB2 M1", "coil M1 " + qt("motor starter"), "END"), { ok: false, back: ["IEC practice: IEC 60204-1:2016, 9\\.4\\)\\. Write it: stop PB1 M1$"] });
build("cw-stop-as-button", "Draw a motor starter control circuit", L("MAKE CONTROL: Motor starter", "button PB1 M1 " + qt("stop"), "button PB2 M1 " + qt("start"), "coil M1 " + qt("motor starter"), "overload OL1 M1", "END"), { ok: false, back: ["Write it: stop PB1 M1$"] });
build("cw-stop-ol-no", "Draw a motor starter control circuit", L("MAKE CONTROL: Motor starter", "stop PB1 M1 no", "start PB2 M1", "coil M1 " + qt("motor starter"), "overload OL1 M1 no", "END"), { ok: false, back: ["Write it: stop PB1 M1$", "Write it: overload OL1 M1$"] });
build("cw-estop-as-button", "Draw a motor starter control circuit with an emergency stop", L("MAKE CONTROL: Motor starter", "button PB0 M1 " + qt("emergency stop"), "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("motor starter"), "END"), { ok: false, back: ["Write it: estop PB0$"] });
build("cw-off-button", "Draw a fan starter control circuit", L("MAKE CONTROL: Fan", "stop PB1 M1", "start PB2 M1", "button PB3 M1 " + qt("off"), "coil M1 " + qt("fan starter"), "END"), { ok: false, back: ["Write it: stop PB3 M1 \x22off\x22"] });
build("cw-coil-line-no", "Draw a compressor control", L("MAKE CONTROL: Compressor", "switch SS1 M1", "coil M1 PS1 " + qt("compressor starter"), "pressure PS1 " + qt("high pressure cut-out"), "END"), { ok: false, back: ["Write it: pressure PS1 M1 nc \x22high pressure cut-out\x22"] });
// a check that misfires: a right circuit sent back, or a line that builds wrong
// (an energise-to-trip relay -- CR1 pulled in by the cut-out, M1 on CR1's closed contact -- is not fail-safe and may go
// back; but the line that goes back must build a working circuit: "pressure PS1 CR1 nc" beside "coil M1 CR1 off" stops
// the pump whenever the pressure is normal)
build("cw-trip-relay-pump", "Draw a pump starter with a high pressure shutdown relay", L("MAKE CONTROL: Pump", "stop PB1 M1", "start PB2 M1", "coil CR1 " + qt("pump shutdown relay"), "pressure PS1 CR1 " + qt("high pressure cut-out"), "coil M1 CR1 off " + qt("pump starter"), "overload OL1 M1", "END"), { notBack: ["Write it: pressure PS1 CR1 nc"], harm: "high" });
build("cw-trip-relay-comp", "Draw a motor starter for a compressor with a high pressure trip relay", L("MAKE CONTROL: Compressor", "stop PB1 M1", "start PB2 M1", "coil CR1 " + qt("compressor safety relay"), "pressure PS1 CR1 " + qt("high pressure cut-out"), "coil M1 CR1 off " + qt("compressor starter"), "overload OL1 M1", "END"), { notBack: ["Write it: pressure PS1 CR1 nc"], harm: "high" });
build("cw-ol-alarm-relay", "Draw a motor starter with an overload alarm relay", L("MAKE CONTROL: Motor starter with alarm", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("motor starter"), "overload OL1 M1", "overload OL1 CR3 no", "coil CR3 " + qt("overload alarm relay"), "horn AH1 CR3 " + qt("overload"), "END"), { notBack: ["Write it: overload OL1 CR3$"], harm: "high" });
build("cw-booster-bare-suction", "Draw the control circuit for a booster pump with a pressure switch, cut-in 40 psi and cut-out 60 psi, and a low suction cut-out at 10 psi", L("MAKE CONTROL: Booster pump", "pressure PS1 M1 nc " + qt("cut-in 40 psi, cut-out 60 psi"), "pressure PS2 M1 " + qt("cut-out 10 psi"), "coil M1 " + qt("booster pump starter"), "overload OL1 M1", "END"), { notBack: ["Write it: pressure PS2 M1 nc"], harm: "high" });

// ---------------------------------------------------------------- which code is followed
pick("pk-germany-400", "Draw a DOL starter for a 400 V motor in Germany", "IEC");
pick("pk-indiana", "Draw a starter for a customer in Indiana", "US");
pick("pk-nsw", "Draw a starter for a pump in New South Wales", "IEC");
pick("pk-480", "Draw a starter for a 480 V motor", "US");
pick("pk-ireland", "Draw a starter for a farm in Ireland", "IEC");
pick("pk-nec-germany", "Draw a starter per NEC for a plant in Germany", "US");
pick("pk-iec-us", "Draw a starter to IEC 60204-1 for a US customer", "IEC");
pick("pk-50hz", "Draw a starter for a 230 V 50 Hz motor", "IEC");
pick("pk-ontario", "Draw a starter for a 575 V motor in Ontario", "US");
pick("pk-germany-road", "Draw a starter for a pump on Germany Road", "US");
pick("pk-china-380", "Draw a starter for a 380 V motor in China", "IEC");
pick("pk-caps", "SHOW US A STARTER FOR A PUMP", "US");
pick("pk-ce", "Draw a starter with CE marking", "IEC");
pick("pk-ul508a", "Draw a starter, UL 508A panel", "US");
pick("pk-uk", "Draw a starter for a site in the UK", "IEC");
pick("pk-kenya-415", "Draw a starter for 415V in Kenya", "IEC");
pick("pk-canada-240", "Draw a starter for a 240 V motor in Canada", "US");
pick("pk-tulsa", "Draw a starter for a plating shop pump in Tulsa", "US");
pick("pk-new-mexico", "Draw a starter for a well pump in New Mexico", "US");
pick("pk-brazil-comma", "Draw a starter for our mill in Sao Paulo, Brazil", "IEC", { harm: "low" });
pick("pk-south-african", "Draw a starter for a South African mine", "IEC", { harm: "low" });
pick("pk-indian-creek", "Draw a starter for the Indian Creek farms pump", "US", { harm: "low" });

// ---------------------------------------------------------------- the user's own givens
var KEEP_CONV = ["MAKE CONTROL: Conveyor", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("conveyor starter"), "overload OL1 M1", "lamp LT1 M1 " + qt("run") + " green", "END"];
var KQ = "Draw a start stop circuit for a conveyor with a run light";
user("us-same", KQ, KEEP_CONV, KQ, true);
user("us-bench-running", KQ, KEEP_CONV, KQ, false, { bench: true });
user("us-24v", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with a run light, 24 V", false);
user("us-explain", KQ, KEEP_CONV, "Explain a start stop circuit for a conveyor with a run light", false);
user("us-estop", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with a run light and an emergency stop", false);
user("us-jog", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with a run light and a jog button", false);
user("us-no-light", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with no lights", false);
user("us-two-stations", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with a run light and two stations", false);
user("us-second-conveyor", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor and a second conveyor with run lights", false, { harm: "high" });
user("us-brake", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with a run light and a brake", false, { harm: "medium" });
user("us-plus-stop-light", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with a run light and a stop light", false, { harm: "medium" });
user("us-red-light", KQ, KEEP_CONV, "Draw a start stop circuit for a conveyor with a red light", false, { harm: "low" });
var KEEP_PUMP = ["MAKE CONTROL: Pump", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"];
user("us-pump-same", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump", true);
user("us-pump-flow", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump with a flow switch", false);
user("us-pump-two-wire", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump, two wire", false);
user("us-pump-float", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump with a float switch", false);
user("us-pump-pressure", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump with a pressure switch", false);
user("us-fire-pump", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a fire pump", false, { harm: "high" });
user("us-another-pump", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump and another pump", false, { harm: "high" });
user("us-without-overload", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump without overload", false, { harm: "medium" });
user("us-jockey", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a jockey pump", false, { harm: "medium" });
user("us-interlock", "Draw a motor starter for a pump", KEEP_PUMP, "Draw a motor starter for a pump with an interlock", false, { harm: "medium" });
var KEEP_DUPLEX = ["MAKE CONTROL: Duplex", "supply " + qt("120 V AC"), "float FS1 " + qt("off"), "float FS2 " + qt("lead on"), "float FS3 " + qt("lag on"), "float FS4 " + qt("high level alarm"), "alternator AR M1 M2", "coil M1 " + qt("pump 1 starter"), "coil M2 " + qt("pump 2 starter"), "lamp LT3 FS4 " + qt("high level") + " red", "END"];
var KDQ = "Draw the control circuit for a duplex lift station with an alternating relay";
user("us-duplex-same", KDQ, KEEP_DUPLEX, KDQ, true);
user("us-duplex-sewage", KDQ, KEEP_DUPLEX, "Draw a control circuit for a duplex sewage lift station with alternating relay", true);
user("us-triplex", KDQ, KEEP_DUPLEX, "Draw the control circuit for a triplex lift station with an alternating relay", false);
user("us-duplex-seal-fail", KDQ, KEEP_DUPLEX, "Draw the control circuit for a duplex lift station with an alternating relay and seal fail lights", false);
var KEEP_FILL2 = ["MAKE CONTROL: Tank fill pump, two floats", "switch SS1 M1 " + qt("on/off"), "float FS1 M1 nc " + qt("low level start"), "float FS2 M1 nc " + qt("high level stop"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"];
user("us-fill2-vs-fill1", "Draw the control circuit for a pump that fills a tank between a low float and a high float", KEEP_FILL2, "Draw the control circuit for a pump that fills a tank with a float switch", false);
user("us-fill2-vs-well", "Draw the control circuit for a pump that fills a tank between a low float and a high float", KEEP_FILL2, "Draw the control circuit for a pump that fills a tank from a well between a low float and a high float", false);
user("us-sent-back-not-kept", "Draw a motor starter control circuit", ["MAKE CONTROL: Motor starter", "stop PB1 M1 no", "start PB2 M1", "coil M1 " + qt("motor starter"), "END"], "Draw a motor starter control circuit", false, { keepFails: true });
C.push({ id: "us-forget", kind: "userforget", keep: { q: KQ, reply: KEEP_CONV.join("\n") } });
C.push({ id: "us-schematic-keep-button", kind: "view", q: "Draw a motor starter control circuit", reply: "MAKE SCHEMATIC: Starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 " + qt("motor starter") + "\nEND", keepWorks: true, harm: "low" });

// ---------------------------------------------------------------- what is shown under the drawing
C.push({ id: "vw-codes-line", kind: "view", q: "Draw a motor starter control circuit for a conveyor with an emergency stop", reply: "MAKE CONTROL: Conveyor\nestop ES1\nstop PB1 M1\nstart PB2 M1\ncoil M1 " + qt("conveyor starter") + "\noverload OL1 M1\nEND", codes: "^Checked to US practice \\(NEC and NFPA 79\\): the overload OL1 on M1 — NEC Article 430, Part III; the stop normally closed — NFPA 79, control functions in the event of failure; the emergency stop ES1 ahead of every rung — NFPA 79, 10\\.7\\. Use IEC practice$", keep: true });
C.push({ id: "vw-switch-iec", kind: "view", q: "Draw a motor starter control circuit for a conveyor with an emergency stop", reply: "MAKE CONTROL: Conveyor\nestop ES1\nstop PB1 M1\nstart PB2 M1\ncoil M1 " + qt("conveyor starter") + "\noverload OL1 M1\nEND", switchTo: "IEC", codesAfter: "^Checked to IEC practice \\(IEC 60204-1\\): the overload OL1 on M1 — IEC 60204-1:2016, 7\\.3; the stop normally closed — IEC 60204-1:2016, 9\\.4; the emergency stop ES1 ahead of every rung — IEC 60204-1:2016, 10\\.7\\. Use US practice$", pickAfter: ["Draw a motor starter", "IEC"] });
C.push({ id: "vw-sent-back-no-tools", kind: "view", q: "Draw a motor starter control circuit", reply: "MAKE CONTROL: Starter\nbutton PB1 M1 " + qt("stop") + "\nbutton PB2 M1 " + qt("start") + "\ncoil M1 " + qt("motor starter") + "\nEND", noTools: true });
C.push({ id: "vw-interlock-listed", kind: "view", q: "Draw a forward reverse motor starter control circuit for a conveyor", reply: ["MAKE CONTROL: Reversing"].concat(REV, ["END"]).join("\n"), codes: "M1 and M2 locked out of each other — NFPA 79, interlocks for contrary motions" });


// ---------------------------------------------------------------- more right circuits from the trades, and two more wrong ones
build("cc-septic", "Draw the control circuit for a septic effluent pump with a float and a high level alarm", L("MAKE CONTROL: Effluent pump", "float FS1 M1 " + qt("pump on"), "coil M1 " + qt("effluent pump starter"), "float FS2 AH1 " + qt("high level alarm"), "horn AH1 " + qt("high level"), "END"), { ok: true, same: true });
build("cc-stock-heater", "Draw the control circuit for a stock tank heater with a thermostat", L("MAKE CONTROL: Tank heater", "temp TS1 CR1 nc " + qt("thermostat"), "coil CR1 " + qt("heater relay"), "END"), { ok: true, same: true });
build("cc-zero-speed", "Draw a conveyor starter with a zero speed switch", L("MAKE CONTROL: Conveyor", "stop PB1 M1", "start PB2 M1", "limit LS1 M1 nc " + qt("zero speed"), "coil M1 " + qt("conveyor starter"), "END"), { ok: true, same: true });
build("cc-fused", "Draw a motor starter control circuit with a control fuse", L("MAKE CONTROL: Starter", "supply " + qt("120 V AC"), "fuse FU1", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("motor starter"), "overload OL1 M1", "END"), { ok: true, same: true });
build("cc-student-lamps", "Draw a relay circuit with two lights", L("MAKE CONTROL: Relay", "switch SS1 CR1", "coil CR1 " + qt("relay"), "lamp LT1 CR1 " + qt("on") + " green", "lamp LT2 CR1 off " + qt("off") + " red", "END"), { ok: true, same: true });
build("cc-irrigation-lp", "Draw the control circuit for an irrigation pump with a low pressure cut-out", L("MAKE CONTROL: Irrigation pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + qt("low pressure cut-out"), "coil M1 " + qt("irrigation pump starter"), "overload OL1 M1", "END"), { ok: true });
build("cw-stop-open", "Draw a motor starter control circuit", L("MAKE CONTROL: Starter", "stop PB1 M1 open", "start PB2 M1", "coil M1 " + qt("motor starter"), "END"), { ok: false, back: ["Write it: stop PB1 M1$"] });
build("cw-ol-normally-open", "Draw a motor starter control circuit", L("MAKE CONTROL: Starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + qt("motor starter"), "overload OL1 M1 normally open", "END"), { ok: false, back: ["Write it: overload OL1 M1$"] });
C.push({ id: "pr-shape", kind: "shape", q: "Draw a three-wire start/stop motor starter control circuit for a conveyor" });
C.push({ id: "pr-shape-pumps", kind: "shape", q: "Draw the control circuit for a duplex lift station with an alternating relay", pumps: true });

// ---------------------------------------------------------------- a booster draws from its break tank: its floats guard the source, never fill it
build("rp-booster-two-nc", "Draw the control circuit for a booster pump on a break tank with a low float and a high float", L("MAKE CONTROL: Booster pump", "float FS1 M1 nc " + qt("low"), "float FS2 M1 nc " + qt("high"), "coil M1 " + qt("booster pump starter"), "overload OL1 M1", "END"), { notSteps: ["When FS1 \\(low\\) makes"], harm: "high" });
build("rp-booster-two-no", "Draw the control circuit for a booster pump on a break tank with a low float and a high float", L("MAKE CONTROL: Booster pump", "float FS1 M1 " + qt("low"), "float FS2 M1 " + qt("high"), "coil M1 " + qt("booster pump starter"), "overload OL1 M1", "END"), { notBack: ["float FS1 M1 nc"], harm: "high" });
build("rp-supply-tank-left", "Draw the control circuit for a pump on a supply tank with a low float and a high float", L("MAKE CONTROL: Supply pump", "float FS1 M1 nc " + qt("low level"), "float FS2 M1 nc " + qt("high level"), "coil M1 " + qt("pump starter"), "overload OL1 M1", "END"), { ok: true, same: true });
none("sq-sequential-stop", "Draw a control circuit where motor 2 starts after motor 1 is running, and motor 1 can only stop after motor 2 has stopped", { harm: "high" });
none("dl-horn-while-runs", "Draw a delayed start control circuit: the conveyor starts 10 seconds after start is pressed and a horn sounds while the conveyor runs", { harm: "high" });
none("sq-stops-before", "Draw a sequence control circuit where conveyor 2 starts after conveyor 1 is running and stops before it");

none("st-estop-each-end", "Draw a three-wire motor starter control circuit for a conveyor with an emergency stop at each end", { harm: "high" });
none("st-remote-stop-station", "Draw a motor starter control circuit for a pump with a remote stop station", { harm: "medium" });
fit("st-stop-far-end", "Draw a motor starter control circuit for a conveyor where the stop button is at the far end", "control-starter", STD);
fit("st-off-button", "Draw a motor starter control circuit for a pump with a start button and an off button", "control-starter", STD);
none("st-no-pump-and-house", "Draw a motor starter control circuit with start and stop push buttons for a pump, one station at the pump and one at the house");
user("us-rank-over-own", "Draw a three-wire start/stop motor starter control circuit for a conveyor", ["MAKE CONTROL: Belt conveyor", "stop PB1 M1 " + qt("belt stop"), "start PB2 M1 " + qt("belt start"), "coil M1 " + qt("belt starter"), "overload OL1 M1", "END"], "Draw a three-wire start/stop motor starter control circuit for a conveyor", true);

module.exports = C;
