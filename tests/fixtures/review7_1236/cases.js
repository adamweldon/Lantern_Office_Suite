// The seventh review of 1.24.36's givens and code checks: cases made by a reviewer who did not write the mends of
// adb8fd7 (the sixth review's), aimed at the last round of mends (git diff 801fe71 adb8fd7 -- src/lantern.inner.html).
// Each case says what is RIGHT, and the harm when Lantern does otherwise:
//   t "given": q -> want "none" (no given block shown), or {id, lines | has, lacks}; orNone: true when showing nothing
//              is right too. Any block shown is also built with q, and must build clean (no problem, no code check back).
//   t "kept":  a circuit kept with q1 (block), then q2: want "shown" or "hidden" (or "either").
//   t "build": q and block lines -> want "back" (with a line that matches `line`) or "clean".
//   t "pick":  q -> the code followed, "US" or "IEC".
//   t "guard-prompts" / "guard-builds": 1.24.35's bench prompts and saved MAKE replies (guard_1235.json).
// harm: high | medium | low (what a DISAGREE is).
"use strict";
var Q = "\x22";
function q2(s) { return Q + s + Q; }
// Lantern's three-wire starter as GIVENS_CONTROL writes it, with what the question asks
function starter(ld, o) {
  o = o || {};
  var ls = [];
  if (o.supply) ls.push("supply " + q2(o.supply));
  if (o.estop) ls.push("estop ES1");
  var n = o.n || 1, i;
  if (n === 1) ls.push("stop PB1 M1", "start PB2 M1");
  else {
    for (i = 1; i <= n; i++) ls.push("stop PB" + i + " M1 " + q2(n === 2 ? (i === 1 ? "stop, local" : "stop, remote") : "stop " + i));
    for (i = 1; i <= n; i++) ls.push("start PB" + (n + i) + " M1 " + q2(n === 2 ? (i === 1 ? "start, local" : "start, remote") : "start " + i));
  }
  ls.push("coil M1 " + q2(ld + " " + (o.dev || "starter")), "overload OL1 M1");
  return ls.concat(o.lamps || []);
}
function seq(a, b, o) {
  o = o || {};
  var ls = [];
  if (o.estop) ls.push("estop ES1");
  ls.push("stop PB1 M1 " + q2(a + " stop"), "stop PB2 M2 " + q2(b + " stop"), "start PB3 M1 " + q2(a + " start"), "start PB4 M2 " + q2(b + " start"),
    "coil M1 " + q2(a + " starter"), "coil M2 M1 " + q2(b + " starter"), "overload OL1 M1", "overload OL2 M2");
  return ls.concat(o.lamps || []);
}
function delayed(ld, t, o) {
  o = o || {};
  var ls = [];
  if (o.supply) ls.push("supply " + q2(o.supply));
  if (o.estop) ls.push("estop ES1");
  ls.push("stop PB1 CR1", "start PB2 CR1", "relay CR1 " + q2("run"), "timer TR1 " + q2(t) + " CR1", "coil M1 TR1 " + q2(ld + " starter"), "overload OL1 M1 CR1");
  ls = ls.concat(o.lamps || []);
  if (o.horn) ls.push("horn AH1 CR1 TR1 off " + q2("warning"));
  return ls;
}
var SUMP = ["switch SS1 M1 " + q2("on/off"), "float FS1 M1 " + q2("pump on"), "coil M1 " + q2("pump starter"), "overload OL1 M1"];
var RUNL = "lamp LT1 M1 " + q2("run") + " green", STOPL = "lamp LT1 M1 off " + q2("stopped") + " red";
var ST = "control-starter", SQ = "control-sequence", DL = "control-delayed-start", SU = "control-sump";
var NOSUP = ["^supply"];
var C = [];
function g(id, q, want, harm, note, more) { var c = { id: id, t: "given", q: q, want: want, harm: harm, note: note || "" }; if (more) Object.keys(more).forEach(function (k) { c[k] = more[k]; }); C.push(c); }

// ---------------------------------------------------------------- supply: a transformer's two voltages
g("sup-pair-slash", "Draw a motor starter with start and stop buttons and a 480/120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium", "a control transformer's pair: the lower is the control's");
g("sup-pair-to", "Draw a motor starter with start and stop buttons and a 480 to 120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
g("sup-pair-dash", "Draw a motor starter with start and stop buttons and a 480-120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
g("sup-pair-600", "Draw a motor starter with start and stop buttons and a 600/120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
g("sup-pair-208", "Draw a motor starter with start and stop buttons and a 208/120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
g("sup-pair-480-24", "Draw a motor starter with start and stop buttons and a 480/24 V control transformer", { id: ST, lines: starter("motor", { supply: "24 V AC" }) }, "medium");
g("sup-pair-120-24", "Draw a motor starter with start and stop buttons and a 120/24 V control transformer", { id: ST, lines: starter("motor", { supply: "24 V AC" }) }, "medium");
g("sup-pair-after", "Draw a motor starter with start and stop buttons and a control transformer, 480/120 V", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "low", "801fe71 gave no supply; either is safe, the 120 V AC is right");
g("sup-pair-480-240", "Draw a motor starter with start and stop buttons and a 480/240 V control transformer", { id: ST, lines: starter("motor", { supply: "240 V AC" }) }, "low");
g("sup-24-alone", "Draw a motor starter with start and stop buttons and a 24 V control transformer", { id: ST, lines: starter("motor", { supply: "24 V AC" }) }, "medium");
g("sup-24dc", "Draw a motor starter with start and stop buttons and 24 V DC control", { id: ST, lines: starter("motor", { supply: "24 V DC" }) }, "medium");
g("sup-120vac-coil", "Draw a motor starter with start and stop buttons and a 120 VAC coil", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
// both voltages written with their V: 801fe71 gave the control's, plainly said; adb8fd7 none
g("sup-twoV-slash", "Draw a motor starter with start and stop buttons and a 480 V / 120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium", "both sides written with V: the pair rule wants one voltage and gives up");
g("sup-twoV-24", "Draw a motor starter with start and stop buttons and a 240 V / 24 V control transformer", { id: ST, lines: starter("motor", { supply: "24 V AC" }) }, "medium", "the mend's own example, said to be a control transformer's");
g("sup-twoV-nospace", "Draw a motor starter with start and stop buttons and a 480V/120V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
g("sup-paren", "Draw a motor starter with a 120 V control transformer (480 V to 120 V)", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
// a motor's (or a supply's) pair beside a control voltage said in so many words: the pair blocks the plain control voltage
g("sup-motor-pair-ctrl", "Draw a start stop circuit for a 230/460 V pump motor with 120 V control", { id: ST, lines: starter("pump", { supply: "120 V AC" }) }, "medium", "a dual-voltage motor's pair, then 120 V control");
g("sup-motor-range-ctrl", "Draw a start stop circuit for a 3 HP 208-230 V pump with a 24 V control circuit", { id: ST, has: [], hasRe: ["^supply \x2224 V"] }, "medium");
g("sup-motor-277", "Draw a motor starter with start and stop buttons, a 480/277 V motor and a 120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
g("sup-supply-400-230", "Draw a motor starter with 230 V control from a 400/230 V supply", { id: ST, lines: starter("motor", { supply: "230 V AC" }) }, "medium");
g("sup-tx-480-240-ctrl", "Draw a motor starter with start and stop buttons, 480/240 V transformer, 120 V control", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
// a MOTOR's pair, and a control transformer named with no voltage: the motor's lower voltage is taken as the control's
g("sup-motor-460-230-ct", "Draw a motor starter for a 460/230 V motor with a control transformer", { id: ST, lacks: NOSUP }, "high", "the motor's 230 V is not the control's");
g("sup-pump-480-240-ct", "Draw a pump starter with start and stop buttons for a 480/240 V pump with a control transformer", { id: ST, lacks: NOSUP }, "high");
g("sup-motor-240-120-ct", "Draw a motor starter with start and stop buttons for a 240/120 V single phase motor with a control transformer", { id: ST, lacks: NOSUP }, "high");
g("sup-ct-for-motor", "Draw a motor starter with start and stop buttons and a control transformer for the 460/230 V motor", { id: ST, lacks: NOSUP }, "high");
g("sup-fan-460-230-ct", "Draw a fan starter with start and stop buttons, the fan motor is 460/230 V, with a control transformer", { id: ST, lacks: NOSUP }, "high", "", { orNone: true });
g("sup-conv-480-240-ct", "Draw a conveyor starter with start and stop buttons for a 480/240 V conveyor motor and a control transformer", { id: ST, lacks: NOSUP }, "high", "", { orNone: true });
g("sup-ct-pair-and-motor-volt", "Draw a motor starter with a 480/120 V control transformer for a 460 V motor", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium", "the control transformer's pair, and the motor's own voltage");
g("sup-motor-pair-ct-120", "Draw a motor starter with start/stop buttons; motor 460/230 V; 120 V control transformer", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "medium");
g("sup-motor-pair-ct-480-240", "Draw a motor starter for a 480/240 V motor with start and stop buttons and a control transformer", { id: ST, lacks: NOSUP }, "high", "", { orNone: true });
// not sure: no supply line
g("sup-tx-no-control", "Draw a motor starter with start and stop buttons and a 240 V / 24 V transformer", { id: ST, lacks: NOSUP }, "high");
g("sup-fed-from", "Draw a motor starter with start and stop buttons fed from a 480/120 V transformer", { id: ST, lacks: NOSUP }, "high", "", { orNone: true });
g("sup-reversed", "Draw a motor starter with start and stop buttons and a 24/120 V control transformer", { id: ST, lacks: NOSUP }, "low", "low then high: not sure", { orNone: true });
g("sup-bare-lower", "Draw a motor starter with start and stop buttons and a 120 V/24 control transformer", { id: ST, lacks: NOSUP }, "high", "", { orNone: true });
g("sup-motor-only", "Draw a motor starter for a 460 V motor with start and stop buttons", { id: ST, lacks: NOSUP }, "high");
g("sup-motor-pair-only", "Draw a motor starter for a 230/460 V motor with start and stop buttons", { id: ST, lacks: NOSUP }, "high");
g("sup-prim-sec", "Draw a motor starter with start and stop buttons, control transformer 480 V primary, 120 V secondary", { id: ST, lines: starter("motor", { supply: "120 V AC" }) }, "low", "", { orNone: true });

// ---------------------------------------------------------------- stations: a count read only of start and stop
g("st-two-loc", "Draw a motor starter with start/stop stations at two locations", { id: ST, lines: starter("motor", { n: 2 }) }, "medium");
g("st-controlled-two", "Draw a pump starter controlled from two locations", { id: ST, lines: starter("pump", { n: 2 }) }, "medium");
g("st-two-stations", "Draw a fan starter with two start/stop stations", { id: ST, lines: starter("fan", { n: 2 }) }, "medium");
g("st-buttons-two-loc", "Draw a conveyor starter with start and stop buttons at two locations", { id: ST, lines: starter("conveyor", { n: 2 }) }, "medium");
g("st-estop-after", "Draw a motor starter with start and stop push buttons at two locations and an e-stop", { id: ST, lines: starter("motor", { n: 2, estop: 1 }) }, "medium");
g("st-three", "Draw a motor starter with three start/stop stations", { id: ST, lines: starter("motor", { n: 3 }) }, "medium");
g("st-local-remote", "Draw a motor starter with local and remote start/stop stations", { id: ST, lines: starter("motor", { n: 2 }) }, "medium");
g("st-two-and-two", "Draw a pump starter with two stop buttons and two start buttons", { id: ST, lines: starter("pump", { n: 2 }) }, "medium");
g("st-one-estop-two", "Draw a fan starter with one e-stop and two start/stop stations", { id: ST, lines: starter("fan", { n: 2, estop: 1 }) }, "medium");
g("st-started-stopped-two", "Draw a motor starter that can be started and stopped from two places", { id: ST, lines: starter("motor", { n: 2 }) }, "medium");
g("st-each-end", "Draw a conveyor starter with start/stop stations at two locations, one at each end", { id: ST, lines: starter("conveyor", { n: 2 }) }, "low");
g("st-light-after", "Draw a motor starter with start and stop at two locations and a green run light", { id: ST, lines: starter("motor", { n: 2, lamps: [RUNL] }) }, "medium");
g("st-emergency-two", "Draw a motor starter with an emergency stop and two start/stop stations", { id: ST, lines: starter("motor", { n: 2, estop: 1 }) }, "medium");
g("st-comma-estop", "Draw a motor starter, an e-stop, and start/stop at two locations", { id: ST, lines: starter("motor", { n: 2, estop: 1 }) }, "medium");
g("st-stopped-light", "Draw a pump starter with two start/stop stations and a red stopped light", { id: ST, lines: starter("pump", { n: 2, lamps: [STOPL] }) }, "medium");
g("st-2-digit", "Draw a motor starter with start-stop buttons at 2 locations", { id: ST, lines: starter("motor", { n: 2 }) }, "medium");
g("st-with-estop-comma", "Draw a motor starter with start/stop at two locations, with an e-stop", { id: ST, lines: starter("motor", { n: 2, estop: 1 }) }, "medium");
// the clause before the count holds an e-stop or a light as well as the start and stop (801fe71 right)
g("st-estop-before", "Draw a motor starter with an e-stop and start/stop buttons at two locations", { id: ST, lines: starter("motor", { n: 2, estop: 1 }) }, "medium", "the e-stop and the start/stop stand in one clause before the count");
g("st-runlight-before", "Draw a pump starter with a run light and start/stop at two locations", { id: ST, lines: starter("pump", { n: 2, lamps: [RUNL] }) }, "medium");
g("st-greenlight-before", "Draw a motor starter with a green run light and start/stop stations at two locations", { id: ST, lines: starter("motor", { n: 2, lamps: [RUNL] }) }, "medium");
g("st-stop-two-start-two", "Draw a motor starter with a stop button at two locations and a start button at two locations", { id: ST, lines: starter("motor", { n: 2 }) }, "medium", "each said at two; 801fe71 gave two stations");
// the count is not of both
g("st-estop-two-loc", "Draw a motor starter with an e-stop at two locations", "none", "high");
g("st-stops-two-one-start", "Draw a motor starter with stop buttons at two places and one start button", "none", "high");
g("st-light-two-loc", "Draw a motor starter with a run light at two locations", "none", "high");
g("st-start-two-stop-one", "Draw a pump starter with a start button at two locations and a stop button at one", "none", "high");
g("st-stopped-from-two", "Draw a fan starter that can be stopped from two locations", "none", "high");
g("st-plus-stop", "Draw a motor starter with start/stop at two locations plus a stop at the machine", "none", "high");
g("st-started-two-stopped-one", "Draw a motor starter that can be started from two places and stopped from one", "none", "high");
g("st-start-at-one", "Draw a motor starter with start/stop at two locations, the start at one", "none", "high");
g("st-pilot-two", "Draw a motor starter with a pilot light at two places", "none", "high");
g("st-stops-two-start-after", "Draw a motor starter with stop buttons at two locations and a start button", "none", "high");
g("st-one-start-stops-two", "Draw a motor starter with a start button and stop buttons at two locations", "none", "high", "one start; the stops at two locations");
g("st-start-stops-two-places", "Draw a motor starter with a start and stops at two places", "none", "high", "one start; stops at two places");
g("st-one-start-stops-two-b", "Draw a motor starter with one start button and stop buttons at two locations", "none", "high");
g("st-start-only-one", "Draw a motor starter with start and stop at two locations, but the start only from the panel", "none", "high");

// ---------------------------------------------------------------- sequences
g("sq-only-when-running", "Draw the control circuit: conveyor 2 can only start when conveyor 1 is running", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-must-not-until", "Draw the control circuit: conveyor 2 must not start until conveyor 1 is running", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-cannot-unless-rev", "Draw the control circuit: conveyor 1 cannot start unless conveyor 2 is running", { id: SQ, lines: seq("conveyor 2", "conveyor 1") }, "medium");
g("sq-interlock", "Draw the interlock control circuit: conveyor 2 can start only after conveyor 1", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-in-sequence", "Draw the control circuit for two conveyors that start in sequence", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-second-first", "Draw the control circuit: the second conveyor can only start after the first conveyor is running", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-letters", "Draw the control circuit: conveyor B can only start after conveyor A is running", { id: SQ, lines: seq("conveyor A", "conveyor B") }, "medium");
g("sq-m-tags", "Draw the control circuit: M2 can only start when M1 is running", { id: SQ, lines: seq("motor 1", "motor 2") }, "medium");
g("sq-run-light-each", "Draw the control circuit for two conveyors where conveyor 2 can only run while conveyor 1 is running, with a green run light for each", { id: SQ, lines: seq("conveyor 1", "conveyor 2", { lamps: ["lamp LT1 M1 " + q2("conveyor 1 run") + " green", "lamp LT2 M2 " + q2("conveyor 2 run") + " green"] }) }, "medium");
g("sq-one-estop", "Draw the control circuit: conveyor 2 can only start when conveyor 1 is running, with one e-stop", { id: SQ, lines: seq("conveyor 1", "conveyor 2", { estop: 1 }) }, "medium");
g("sq-red-stop-each", "Draw the control circuit: conveyor 2 can only start after conveyor 1, with a red stop button for each", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-each-with-stop", "Draw the control circuit: conveyor 2 can only start after conveyor 1, each with a stop button", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "low", "801fe71 gave none: either is safe");
g("sq-fan-before-pump", "Draw the control circuit: the fan must be running before the pump can start", { id: SQ, lines: seq("fan", "pump") }, "medium");
g("sq-has-started", "Draw the control circuit: conveyor 2 can only start when conveyor 1 has started", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-stop-for-each-conv", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, with a stop button for each conveyor", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-and-stop-each", "Draw the control circuit: conveyor 2 can start only after conveyor 1, and a stop button for each", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-own-buttons", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, each conveyor with its stop and start buttons", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "medium");
g("sq-pump-not-before-fan", "Draw the control circuit: the pump must not start before the fan", { id: SQ, lines: seq("fan", "pump") }, "low", "", { orNone: true });
// the other machine OFF, IDLE, NOT RUNNING: no sequence
g("sq-while-off", "Draw the control circuit: pump 2 can only start while pump 1 is off", "none", "high");
g("sq-not-running", "Draw the control circuit: pump 2 can only start when pump 1 is not running", "none", "high");
g("sq-unless-stopped", "Draw the control circuit: conveyor 2 cannot start unless conveyor 1 is stopped", "none", "high");
g("sq-until-stopped", "Draw the control circuit: conveyor 2 must not start until conveyor 1 has stopped", "none", "high");
g("sq-idle", "Draw the control circuit: pump 2 can start only when pump 1 is idle", "none", "high");
g("sq-down", "Draw the control circuit: pump 2 can start only when pump 1 is down", "none", "high");
g("sq-turned-off", "Draw the control circuit: pump 2 can only run when pump 1 is turned off", "none", "high");
g("sq-switched-off", "Draw the control circuit: pump 2 can only run while pump 1 is switched off", "none", "high");
g("sq-if-off", "Draw the control circuit: pump 2 can only start if pump 1 is off", "none", "high");
g("sq-finished", "Draw the control circuit: pump 2 can only start once pump 1 has finished", "none", "high");
g("sq-off-with-buttons", "Draw the control circuit: pump 2 can only start when pump 1 is off, with start and stop buttons for each", "none", "high");
g("sq-feeder-not-running", "Draw the control circuit: conveyor 2 can only start while conveyor 1, the feeder, is not running", "none", "high");
// the off said after a comma (an aside between the machine and its state)
g("sq-comma-off-feed", "Draw the control circuit: conveyor 2 can only start when conveyor 1, its feed conveyor, is off", "none", "high", "conveyor 1 OFF: the given has conveyor 2 only while conveyor 1 runs");
g("sq-comma-off-duty", "Draw the control circuit: pump 2 can only start when pump 1, the duty pump, is off", "none", "high");
g("sq-comma-off-other", "Draw the control circuit: pump 1 can start only after pump 2, the other pump, is off", "none", "high");
g("sq-comma-running-ok", "Draw the control circuit: conveyor 2 can only start when conveyor 1, which feeds it, is running", { id: SQ, lines: seq("conveyor 1", "conveyor 2") }, "low", "", { orNone: true });
// no permissive word: whether the later one starts by itself is not said
g("sq-first-then", "Draw the control circuit for a fan and a pump: the fan starts first and then the pump", "none", "high");
g("sq-m1-first", "Draw the control circuit for two motors: M1 starts first, then M2", "none", "high");
g("sq-once-running", "Draw the control circuit: conveyor 2 starts once conveyor 1 is running", "none", "high");
// a stop said otherwise than each machine's own
g("sq-stop-stops-both", "Draw the control circuit: conveyor 2 can only start when conveyor 1 is running, and conveyor 1's stop stops both", "none", "high");
g("sq-common-stop", "Draw the control circuit: conveyor 2 can only start after conveyor 1, with a common stop button", "none", "high");
g("sq-master-stop", "Draw the control circuit: conveyor 2 can only start after conveyor 1, with a master stop", "none", "high");
g("sq-halts-both", "Draw the control circuit: conveyor 2 can only start after conveyor 1, with a stop button that halts both", "none", "high");
g("sq-one-stop-pb-both", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, with one stop pushbutton for both", "none", "high");
g("sq-single-stop", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, a single stop button", "none", "high");
g("sq-stops-in-series", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, both stop buttons in series", "none", "high");
g("sq-shared-by-both", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, a stop pushbutton shared by both", "none", "high");
g("sq-red-stops-lights", "Draw the control circuit for two conveyors where conveyor 2 can only run while conveyor 1 is running, with a red stopped light for each", "none", "high");
// ONE stop button for both, said as "a stop button for both": the given draws a stop for each
g("sq-stop-for-both", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, with a stop button for both conveyors", "none", "high", "one stop for both; the given has a stop each");
g("sq-stop-common-to-both", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, with a stop button common to both", "none", "high");
g("sq-stop-for-the-two", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, a stop push button for the two conveyors", "none", "high");
g("sq-red-stop-for-both", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, with a red stop button for both", "none", "high");
g("sq-stop-on-c1-for-both", "Draw the control circuit: conveyor 2 can only start after conveyor 1 is running, with a stop button on conveyor 1 for both", "none", "high");
g("sq-stop-pb-for-both-pumps", "Draw the control circuit: pump 2 can only start after pump 1 is running, with a stop pushbutton for both pumps", "none", "high");

// ---------------------------------------------------------------- delayed start
g("dl-no-time", "Draw a delayed start control circuit for a conveyor", "none", "high", "no time said: Lantern never invents one");
g("dl-tdr-alone", "Draw a motor starter with a time delay relay", "none", "high");
g("dl-on-delay-alone", "Draw a pump starter with an on-delay timer", "none", "high");
g("dl-wait-then-runs", "Draw a control circuit: press start, wait 5 seconds, then the motor runs", { id: DL, lines: delayed("motor", "5 s") }, "medium");
g("dl-starts-after", "Draw the control circuit for a conveyor that starts 10 seconds after start is pressed", { id: DL, lines: delayed("conveyor", "10 s") }, "medium");
g("dl-hp-dots", "Draw the control circuit for a 2 h.p. pump that starts 10 seconds after start is pressed", { id: DL, lines: delayed("pump", "10 s") }, "medium");
g("dl-warning-horn", "Draw a delayed start control circuit with a 10 second warning horn before the conveyor starts", { id: DL, lines: delayed("conveyor", "10 s", { horn: 1 }) }, "medium");
g("dl-horn-same-time", "Draw a delayed start control circuit for a conveyor that starts 5 seconds after start is pressed, with a horn that sounds for those 5 seconds", { id: DL, lines: delayed("conveyor", "5 s", { horn: 1 }) }, "medium");
g("dl-wait-then-pump", "Draw a control circuit: wait 10 seconds, then the pump starts", { id: DL, lines: delayed("pump", "10 s") }, "low", "", { orNone: true });
g("dl-waits-2min", "Draw a control circuit where the motor waits for 2 minutes then starts", { id: DL, lines: delayed("motor", "2 min") }, "low", "", { orNone: true });
g("dl-start-and-stop-buttons", "Draw a delayed start control circuit with start and stop buttons, the fan starting 20 seconds after start", { id: DL, lines: delayed("fan", "20 s") }, "medium");
g("dl-a-start-a-stop", "Draw a delayed start control circuit with a start button and a stop button, the fan starting 20 seconds after start", { id: DL, lines: delayed("fan", "20 s") }, "medium");
g("dl-run-light", "Draw a delayed start control circuit for a pump with a 10 second delay and a run light", { id: DL, lines: delayed("pump", "10 s", { lamps: [RUNL] }) }, "medium");
g("dl-2hp-5s", "Draw a time delay start control circuit for a 2 HP motor, 5 second delay", { id: DL, lines: delayed("motor", "5 s") }, "medium");
g("dl-buzzer-until", "Draw a delayed start control circuit for a mixer, 15 s delay, the warning buzzer sounds until it starts", { id: DL, lines: delayed("mixer", "15 s", { horn: 1 }) }, "medium");
g("dl-estop", "Draw a delayed start control circuit for a pump: 10 second delay, start/stop push buttons and an emergency stop", { id: DL, lines: delayed("pump", "10 s", { estop: 1 }) }, "medium");
g("dl-horn-goes-off", "Draw a delayed start control circuit where a horn sounds for 10 seconds when start is pressed, then the conveyor starts and the horn goes off", { id: DL, lines: delayed("conveyor", "10 s", { horn: 1 }) }, "medium");
g("dl-hp-dots-short", "Draw a control circuit for a 2 h.p. pump, 10 s delayed start", { id: DL, lines: delayed("pump", "10 s") }, "medium");
g("dl-prestart-station", "Draw a delayed start control circuit for a conveyor with a 10 second pre-start horn, with a start-stop station", { id: DL, lines: delayed("conveyor", "10 s", { horn: 1 }) }, "medium");
g("dl-powered-24dc", "Draw a delayed start control circuit: the pump starts 10 seconds after start is pressed, powered from a 24 V DC supply", { id: DL, lines: delayed("pump", "10 s", { supply: "24 V DC" }) }, "low", "", { orNone: true });
g("dl-delay-relay-stops", "Draw a delayed start control circuit: the pump starts 30 s after start, and a delay relay that stops it", "none", "high");
g("dl-power-back-on", "Draw the control circuit for a pump that starts 10 seconds after the power comes back on", "none", "high");
g("dl-after-light-on", "Draw the control circuit for a motor that starts 10 s after the light comes on", "none", "high");
g("dl-two-times", "Draw a delayed start control circuit: the pump waits 10 seconds then runs for 5 minutes", "none", "high");
g("dl-released", "Draw a delayed start control circuit where the motor starts 10 seconds after the start button is released", "none", "high");
g("dl-off-delay-too", "Draw a delayed start control circuit: the pump starts 10 seconds after start is pressed and stops 10 seconds after stop is pressed", "none", "high");
g("dl-horn-3s", "Draw a delayed start control circuit for a conveyor that starts 5 seconds after start is pressed, with a horn that sounds for 3 seconds", "none", "high");
g("dl-waits-then-stops", "Draw a control circuit where the pump waits 10 seconds then stops", "none", "high");
g("dl-after-power-fail", "Draw a delayed start control circuit: after a power failure the pump restarts 10 seconds after power is restored", "none", "high");
// said plainly, refused by the last round (801fe71 right)
g("dl-horn-comes-on", "Draw a delayed start control circuit: press start, the warning horn comes on for 10 seconds, then the conveyor starts", { id: DL, lines: delayed("conveyor", "10 s", { horn: 1 }) }, "medium", "\"comes on\" anywhere now refuses: a horn that comes on is the given's warning");
g("dl-light-comes-on-runs", "Draw a delayed start control circuit for a pump that starts 10 seconds after start is pressed, with a green light that comes on while the pump runs", { id: DL, lines: delayed("pump", "10 s", { lamps: [RUNL] }) }, "medium");
g("dl-start-stop-estop-commas", "Draw a delayed start control circuit for a motor with start, stop and e-stop, starting 5 seconds after start is pressed", { id: DL, lines: delayed("motor", "5 s", { estop: 1 }) }, "medium", "\"start, stop\" is the buttons' own stop");
g("dl-stops-when-stop", "Draw a delayed start control circuit: the conveyor starts 10 seconds after start, and stops when stop is pressed", { id: DL, lines: delayed("conveyor", "10 s") }, "medium", "the stop button stopping it is the given's own stop");
g("dl-stop-button-stops", "Draw a delayed start control circuit for a pump that starts 10 s after start is pressed; the stop button stops the pump", { id: DL, lines: delayed("pump", "10 s") }, "medium");
// a second machine: "the motor" beside the fan or conveyor that waits for it
g("dl-fan-after-motor", "Draw the control circuit for a fan that starts 10 seconds after the motor starts", "none", "high", "two machines: the given has only the fan, started by its own button");
g("dl-conv-after-motor", "Draw the control circuit for a conveyor that starts 5 seconds after the motor starts", "none", "high");
g("dl-coolingfan-after-motor", "Draw the control circuit for a cooling fan that starts 30 seconds after the motor starts", "none", "high");

// ---------------------------------------------------------------- lights
g("lt-in-start", "Draw a motor starter with a light in the start button", "none", "high");
g("lt-button-lights-up", "Draw a motor starter with a start button that lights up", "none", "high");
g("lt-verb", "Draw a motor starter that lights a red light when stopped", "none", "high");
g("lt-illuminated", "Draw a motor starter with an illuminated start button", "none", "high");
g("lt-pilot-in-stop", "Draw a motor starter with a pilot light in the stop button", "none", "high");
g("lt-inside-pb", "Draw a motor starter with green run light inside the start pushbutton", "none", "high");
g("lt-lit-when-runs", "Draw a motor starter with a start button that is lit when the motor runs", "none", "high");
g("lt-glows", "Draw a motor starter with a start pushbutton that glows green while running", "none", "high");
g("lt-light-in-it", "Draw a motor starter with a start button with a light in it", "none", "high");
g("lt-on-stop-button", "Draw a motor starter with a green light on the stop button", "none", "high");
g("lt-stop-has-red-in-it", "Draw a motor starter with a stop button that has a red light in it", "none", "high", "a light in a button: drawn as a red RUN light");
g("lt-lamp-in-it", "Draw a motor starter with a start button with a green lamp in it", "none", "high", "a lamp in the start button: drawn as a separate run light");
g("lt-lit-up-start", "Draw a motor starter with a green lit-up start button", "none", "high", "a lit start button: the given leaves the light out");
g("lt-start-illuminated-after", "Draw a motor starter with stop and start buttons, the start button illuminated", "none", "high", "a lit start button: the given leaves the light out");
g("lt-light-up-start", "Draw a motor starter with a light-up start button", "none", "high");
g("lt-green-run", "Draw a motor starter with a green run light", { id: ST, lines: starter("motor", { lamps: [RUNL] }) }, "medium");
g("lt-red-stopped", "Draw a motor starter with a red stopped light", { id: ST, lines: starter("motor", { lamps: [STOPL] }) }, "medium");
g("lt-both", "Draw a motor starter with a green run light and a red stopped light", { id: ST, lines: starter("motor", { lamps: [RUNL, "lamp LT2 M1 off " + q2("stopped") + " red"] }) }, "medium");
g("lt-on-while-runs", "Draw a motor starter with a pilot light that is on while the motor runs", { id: ST, lines: starter("motor", { lamps: [RUNL] }) }, "medium");
g("lt-fan-stopped", "Draw a motor starter for a fan with a red light that is on when the fan is stopped", { id: ST, lines: starter("fan", { lamps: [STOPL] }) }, "medium");
g("lt-next-to-start", "Draw a motor starter with a run light next to the start button", { id: ST, lines: starter("motor", { lamps: [RUNL] }) }, "low", "", { orNone: true });
// a sump with a high water alarm
g("su-alarm-light-horn", "Draw the control circuit for a sump pump with a high water alarm light and a horn", { id: SU, lines: SUMP.concat(["float FS2 " + q2("high level alarm"), "lamp LT1 FS2 " + q2("high water") + " red", "horn AH1 FS2 " + q2("high water")]) }, "medium");
g("su-alarm-horn", "Draw the control circuit for a sump pump with a high water alarm horn", { id: SU, lines: SUMP.concat(["float FS2 " + q2("high level alarm"), "horn AH1 FS2 " + q2("high water")]) }, "medium");
g("su-alarm", "Draw the control circuit for a sump pump with a high water alarm", { id: SU, lines: SUMP.concat(["float FS2 " + q2("high level alarm"), "lamp LT1 FS2 " + q2("high water") + " red"]) }, "low", "", { orNone: true });
g("su-horn-plain-light", "Draw the control circuit for a sump pump with a high water alarm horn and a light", "none", "high");
g("su-run-light-alarm", "Draw the control circuit for a sump pump with a pump running light and a high water alarm", { id: SU, lines: SUMP.concat(["lamp LT1 M1 " + q2("pump on") + " green", "float FS2 " + q2("high level alarm"), "lamp LT2 FS2 " + q2("high water") + " red"]) }, "low", "", { orNone: true });
g("su-buzzer-hw-light", "Draw the control circuit for a sump pump with a high water alarm buzzer and a high water light", { id: SU, lines: SUMP.concat(["float FS2 " + q2("high level alarm"), "lamp LT1 FS2 " + q2("high water") + " red", "horn AH1 FS2 " + q2("high water")]) }, "medium");
g("su-horn-red-light", "Draw the control circuit for a sump pump with a high level alarm with a horn and a red light", "none", "high");
g("su-alarm-horn-light-commas", "Draw the control circuit for a sump pump with a high water alarm, a horn and a light", "none", "high");
g("su-horn-and-alarm-light", "Draw the control circuit for a sump pump with a high water alarm horn and alarm light", { id: SU, lines: SUMP.concat(["float FS2 " + q2("high level alarm"), "lamp LT1 FS2 " + q2("high water") + " red", "horn AH1 FS2 " + q2("high water")]) }, "medium");
g("su-lights-a-red", "Draw the control circuit for a sump pump with a high water alarm that sounds a horn and lights a red light", "none", "high");
g("su-light-horn-for", "Draw the control circuit for a sump pump with a light and horn for the high water alarm", "none", "high", "", { orNone: true });
g("su-alarm-light-comma-horn", "Draw the control circuit for a sump pump with a high water alarm light, and a horn", { id: SU, lines: SUMP.concat(["float FS2 " + q2("high level alarm"), "lamp LT1 FS2 " + q2("high water") + " red", "horn AH1 FS2 " + q2("high water")]) }, "medium");
g("su-alarm-red-light", "Draw the control circuit for a sump pump with a high water alarm and a red light", "none", "high");
g("su-horn-red-hw-light", "Draw the control circuit for a sump pump with a high water alarm horn and a red high water light", { id: SU, lines: SUMP.concat(["float FS2 " + q2("high level alarm"), "lamp LT1 FS2 " + q2("high water") + " red", "horn AH1 FS2 " + q2("high water")]) }, "medium");
g("su-both-horn-light", "Draw the control circuit for a sump pump with a high water alarm with both a horn and a light", "none", "high");
// a horn and a light both asked for the alarm, the light named after the horn: the given draws the horn alone
g("su-horn-and-light-for-alarm", "Draw the control circuit for a sump pump with a horn and a light for the high water alarm", "none", "high", "a light asked for the alarm, dropped", { okIf: { has: ["horn AH1 FS2 " + q2("high water")], hasRe: ["^lamp LT\\d FS2"] } });
g("su-horn-light-for-the-alarm", "Draw the control circuit for a sump pump with a high water alarm horn and a light for the alarm", "none", "high", "a light asked for the alarm, dropped", { okIf: { has: ["horn AH1 FS2 " + q2("high water")], hasRe: ["^lamp LT\\d FS2"] } });

// ---------------------------------------------------------------- e-stop, and one button that starts and stops
g("es-mushroom-stop", "Draw a motor starter with a mushroom head stop button", "none", "high");
g("es-red-mushroom", "Draw a motor starter with a red mushroom stop", "none", "high");
g("es-mushroom-estop", "Draw a motor starter with a mushroom head e-stop", { id: ST, lines: starter("motor", { estop: 1 }) }, "medium");
g("es-emergency-mushroom", "Draw a motor starter with an emergency stop mushroom button", { id: ST, lines: starter("motor", { estop: 1 }) }, "medium");
g("es-mushroom-emergency", "Draw a motor starter with a mushroom-head emergency stop", { id: ST, lines: starter("motor", { estop: 1 }) }, "medium");
g("es-plain", "Draw a motor starter with start and stop buttons and an e-stop", { id: ST, lines: starter("motor", { estop: 1 }) }, "medium");
g("es-none", "Draw a motor starter with start and stop buttons and no e-stop", { id: ST, lines: starter("motor") }, "medium");
g("es-each-station", "Draw a motor starter with e-stops at each station", "none", "high");
g("es-at-each-station", "Draw a motor starter with start and stop buttons and an e-stop at each station", "none", "high");
g("ob-push-on-off", "Draw a motor starter with a push on push off button", "none", "high");
g("ob-also-stops", "Draw a motor starter with a start button that also stops the motor", "none", "high");
g("ob-single-pb", "Draw a motor starter with a single pushbutton", "none", "high");
g("ob-one-both", "Draw a motor starter where one button both starts and stops the motor", "none", "high");
g("ob-same-for-both", "Draw a motor starter with the same button for start and stop", "none", "high");
g("ob-one-to-start-stop", "Draw a motor starter with one button to start and stop", "none", "high");
g("ob-toggle", "Draw a motor starter with a toggle button", "none", "high");
g("ob-same-pb-starts-stops", "Draw a motor starter where the same pushbutton starts and stops the motor", "none", "high", "one button; the given has two");
g("ob-push-again", "Draw a motor starter: push the button to start and push it again to stop", "none", "high");
g("ob-one-start-stop-button", "Draw a motor starter with one start/stop button", "none", "high");
g("ob-start-is-stop", "Draw a motor starter with a start button that is also the stop button", "none", "high");
g("ob-latching-pb", "Draw a motor starter with a latching push button", "none", "high", "a push-push (maintained) button, not a momentary start");
g("ob-push-to-start-stop", "Draw a motor starter with a push-to-start, push-to-stop button", "none", "high");
g("ob-single-start-stop-pb", "Draw a motor starter with a single start-stop push button", "none", "high");

// ---------------------------------------------------------------- sizes ("2 h.p." is not two hours)
g("hp-2-dots", "Draw a 2 h.p. pump starter with start and stop buttons", { id: ST, lines: starter("pump") }, "low", "801fe71 gave none", { orNone: true });
g("hp-7.5-dots", "Draw a 7.5 h.p. fan starter with start and stop buttons", { id: ST, lines: starter("fan") }, "low", "", { orNone: true });
g("hp-half-dots", "Draw a 1/2 h.p. blower starter with start and stop buttons", { id: ST, lines: starter("blower") }, "low", "", { orNone: true });
g("hp-spaced", "Draw a 2 h. p. motor starter with start and stop buttons", { id: ST, lines: starter("motor") }, "low", "", { orNone: true });
g("hp-runs-2-hours", "Draw a 2 HP conveyor starter with start/stop that runs for 2 hours", "none", "high");
g("hp-5", "Draw a 5 HP motor starter with start and stop buttons", { id: ST, lines: starter("motor") }, "medium");
g("hp-2h-run", "Draw a 3 hp pump starter with start/stop, the pump runs 2 h then stops", "none", "high");
g("hp-10-compressor", "Draw a 10 h.p. compressor starter with start and stop buttons", { id: ST, lines: starter("compressor") }, "low", "", { orNone: true });
g("hp-2hp-joined", "Draw a 2hp motor starter with start and stop buttons", { id: ST, lines: starter("motor") }, "medium");

g("hp-2-caps", "Draw a 2 H.P. pump starter with start and stop buttons", { id: ST, lines: starter("pump") }, "low", "", { orNone: true });
g("hp-delay-caps", "Draw the control circuit for a 3 H.P. conveyor that starts 10 seconds after start is pressed", { id: DL, lines: delayed("conveyor", "10 s") }, "low", "", { orNone: true });

g("gv-plural-pumps", "Draw a start stop circuit for the pumps", "none", "high", "the pumps: how many is not said; the given draws one");
g("gv-plural-fans", "Draw a start/stop control circuit for the fans", "none", "high");
g("gv-plural-two-pumps", "Draw a start stop circuit for two pumps", "none", "high");

// ---------------------------------------------------------------- code checks
function b(id, q, lines, want, harm, note, line) { C.push({ id: id, t: "build", q: q, block: lines, want: want, line: line || "", harm: harm, note: note || "" }); }
var CMP = ["stop PB1 M1", "start PB2 M1"];
b("cc-120v-cutout-no", "Draw the control circuit for an air compressor, 120 V control, with a high pressure cut-out", ["supply \x22120 V AC\x22"].concat(CMP, ["pressure PS1 M1 \x22high pressure cut-out\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"]), "back", "medium", "", "pressure PS1 M1 nc \x22high pressure cut-out\x22");
b("cc-120vac-cutout-no", "Draw the control circuit for an air compressor, 120 VAC control, with a high pressure cut-out", ["supply \x22120 V AC\x22"].concat(CMP, ["pressure PS1 M1 \x22high pressure cut-out\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"]), "back", "medium", "\"VAC\" read as vacuum", "pressure PS1 M1 nc \x22high pressure cut-out\x22");
b("cc-24vac-cutin-out-no", "Draw the control circuit for an air compressor with a 24 VAC control transformer and a pressure switch, cut-in 90 psi, cut-out 120 psi", ["supply \x2224 V AC\x22", "switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 \x22cut-in 90 psi, cut-out 120 psi\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"], "back", "medium", "\"VAC\" read as vacuum", "pressure PS1 M1 nc \x22cut-in 90 psi, cut-out 120 psi\x22");
b("cc-120vac-label", "Draw the control circuit for an air compressor with a high pressure cut-out", ["supply \x22120 VAC\x22"].concat(CMP, ["pressure PS1 M1 \x22high pressure cut-out 120 VAC\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"]), "back", "medium", "\"VAC\" in the switch's label", "pressure PS1 M1 nc");
b("cc-vacation", "Draw the well pump control for our vacation cabin, pressure switch cut-in 40 psi cut-out 60 psi", ["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 \x22cut-in 40 psi, cut-out 60 psi\x22", "coil M1 \x22well pump starter\x22", "overload OL1 M1"], "back", "medium", "\"vacation\" read as vacuum", "pressure PS1 M1 nc \x22cut-in 40 psi, cut-out 60 psi\x22");
b("cc-well-no", "Draw the well pump control, pressure switch cut-in 40 psi cut-out 60 psi", ["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 \x22cut-in 40 psi, cut-out 60 psi\x22", "coil M1 \x22well pump starter\x22", "overload OL1 M1"], "back", "medium", "", "pressure PS1 M1 nc \x22cut-in 40 psi, cut-out 60 psi\x22");
b("cc-vacuum-high-cutout", "Draw the vacuum pump control circuit with a high vacuum cut-out switch", CMP.concat(["pressure PS1 M1 \x22high vacuum cut-out\x22", "coil M1 \x22vacuum pump starter\x22", "overload OL1 M1"]), "clean", "high");
b("cc-vacuum-low-nc", "Draw the vacuum pump control circuit with a low vacuum switch", CMP.concat(["pressure PS1 M1 nc \x22low vacuum cut-out\x22", "coil M1 \x22vacuum pump starter\x22", "overload OL1 M1"]), "clean", "high");
b("cc-inhg", "Draw the control circuit for a pump with a switch that opens at 20 inHg", CMP.concat(["pressure PS1 M1 \x22high cut-out 20 inHg\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"]), "clean", "high");
b("cc-negative", "Draw the control circuit for an exhaust blower that stops on high negative pressure", CMP.concat(["pressure PS1 M1 \x22high negative pressure cut-out\x22", "coil M1 \x22blower starter\x22", "overload OL1 M1"]), "clean", "high");
b("cc-compressor-nc-ok", "Draw the control circuit for an air compressor, 120 VAC control, with a high pressure cut-out", ["supply \x22120 V AC\x22"].concat(CMP, ["pressure PS1 M1 nc \x22high pressure cut-out\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"]), "clean", "high");
b("cc-ol-no", "Draw the control circuit for a pump with a starter", CMP.concat(["coil M1 \x22pump starter\x22", "overload OL1 M1 no"]), "back", "medium", "", "overload OL1 M1");
b("cc-ol-no-label-overload", "Draw the control circuit for a pump with a starter", CMP.concat(["coil M1 \x22pump starter with overload\x22", "overload OL1 M1 no"]), "back", "medium", "a starter named with its overload is still the machine", "overload OL1 M1");
b("cc-cutout-label-overload", "Draw the control circuit for an air compressor with a high pressure cut-out", CMP.concat(["pressure PS1 M1 \x22high pressure cut-out\x22", "coil M1 \x22compressor starter and overload\x22", "overload OL1 M1"]), "back", "medium", "", "pressure PS1 M1 nc \x22high pressure cut-out\x22");
b("cc-cutout-starter-overload-protected", "Draw the control circuit for an air compressor with a high pressure cut-out", CMP.concat(["pressure PS1 M1 \x22high pressure cut-out\x22", "starter M1 \x22overload protected compressor starter\x22"]), "back", "medium", "", "pressure PS1 M1 nc \x22high pressure cut-out\x22");
b("cc-ol-no-starter-overload-relay-label", "Draw the control circuit for a pump starter", CMP.concat(["starter M1 \x22pump starter, thermal overload relay\x22", "overload OL1 M1 no"]), "back", "medium", "", "overload OL1 M1");
b("cc-stop-no-run-relay", "Draw a motor control circuit with a run relay", ["stop PB1 CR1 no", "start PB2 CR1", "relay CR1 \x22run\x22", "coil M1 CR1 \x22motor starter\x22", "overload OL1 M1"], "back", "medium", "", "stop PB1 CR1");
b("cc-stop-no-run-relay-stopped-lamp", "Draw a motor control circuit with a run relay and a stopped light", ["stop PB1 CR1 no", "start PB2 CR1", "relay CR1 \x22run\x22", "coil M1 CR1 \x22motor starter\x22", "overload OL1 M1", "lamp LT1 CR1 off \x22stopped\x22 red"], "back", "medium", "a lamp on the relay's closed contact is not a trip relay's coil", "stop PB1 CR1");
b("cc-stop-no-k1-ready-lamp", "Draw a motor control circuit with a K1 relay and a ready light", ["stop PB1 K1 no", "start PB2 K1", "relay K1 \x22run\x22", "coil M1 K1 \x22motor starter\x22", "overload OL1 M1", "lamp LT1 K1 off \x22ready\x22 white"], "back", "medium", "", "stop PB1 K1");
b("cc-stop-no-delayed-ready", "Draw a delayed start control circuit for a pump, 10 s, with a ready light", ["stop PB1 CR1 no", "start PB2 CR1", "relay CR1 \x22run\x22", "timer TR1 \x2210 s\x22 CR1", "coil M1 TR1 \x22pump starter\x22", "overload OL1 M1 CR1", "lamp LT1 CR1 off \x22ready\x22 white"], "back", "medium", "", "stop PB1 CR1");
b("cc-stop-no-delayed-horn", "Draw a delayed start control circuit for a pump, 10 s, with a warning horn", ["stop PB1 CR1 no", "start PB2 CR1", "relay CR1 \x22run\x22", "timer TR1 \x2210 s\x22 CR1", "coil M1 TR1 \x22pump starter\x22", "overload OL1 M1 CR1", "horn AH1 CR1 TR1 off \x22warning\x22"], "back", "medium", "", "stop PB1 CR1");
b("cc-stop-no-m1-lamp-off", "Draw a motor starter with a stopped light", ["stop PB1 M1 no", "start PB2 M1", "coil M1 \x22motor starter\x22", "overload OL1 M1", "lamp LT1 M1 off \x22stopped\x22 red"], "back", "medium", "", "stop PB1 M1");
b("cc-negative-dc-rail", "Draw the control circuit for an air compressor with a high pressure cut-out, 24 V DC control with the negative rail grounded", ["supply \x2224 V DC\x22"].concat(CMP, ["pressure PS1 M1 \x22high pressure cut-out\x22", "coil M1 \x22compressor contactor\x22", "overload OL1 M1"]), "back", "medium", "\"negative\" (a DC rail) read as a vacuum", "pressure PS1 M1 nc \x22high pressure cut-out\x22");
b("cc-stop-no-run-relay-idle-relay", "Draw a motor control circuit with a run relay and an idle relay", ["stop PB1 CR1 no", "start PB2 CR1", "relay CR1 \x22run\x22", "coil M1 CR1 \x22motor starter\x22", "overload OL1 M1", "coil CR2 CR1 off \x22idle relay\x22"], "back", "medium", "the run relay's closed contact drives an idle relay, not the starter: still a run relay's stop written open", "stop PB1 CR1");
b("cc-trip-relay", "Draw a motor control circuit with a trip relay", ["stop PB1 CR1 no \x22stop\x22", "relay CR1 \x22trip\x22", "start PB2 M1", "coil M1 CR1 off \x22motor starter\x22", "overload OL1 M1"], "clean", "high", "energised to trip");
b("cc-trip-relay-plain", "Draw a motor control circuit where the stop button pulls in a relay that drops the starter", ["stop PB1 CR2 no", "relay CR2 \x22stop relay\x22", "start PB2 M1", "coil M1 CR2 off \x22motor starter\x22", "overload OL1 M1"], "clean", "high");
// the givens as Lantern shows them, written back as they stand: never sent back
b("cc-given-compressor", "Draw the control circuit for an air compressor on its pressure switch, cut-out 120 psi", ["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 nc \x22cut-out 120 psi\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"], "clean", "high");
b("cc-given-sump-alarm", "Draw the control circuit for a sump pump with a high water alarm light and a horn", SUMP.concat(["float FS2 \x22high level alarm\x22", "lamp LT1 FS2 \x22high water\x22 red", "horn AH1 FS2 \x22high water\x22"]), "clean", "high");
b("cc-given-fill-two", "Draw the control circuit for a pump filling a tank with a low float and a high float", ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], "clean", "high");
b("cc-given-reversing", "Draw a forward and reverse motor starter", ["stop PB1 all", "start PB2 M1 \x22forward\x22", "start PB3 M2 \x22reverse\x22", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22", "interlock M1 M2", "overload OL1 M1 M2"], "clean", "high");
b("cc-given-delayed-horn", "Draw a delayed start control circuit with a 10 second warning horn before the conveyor starts", ["stop PB1 CR1", "start PB2 CR1", "relay CR1 \x22run\x22", "timer TR1 \x2210 s\x22 CR1", "coil M1 TR1 \x22conveyor starter\x22", "overload OL1 M1 CR1", "horn AH1 CR1 TR1 off \x22warning\x22"], "clean", "high");

// ---------------------------------------------------------------- kept circuits (the user's own givens)
function k(id, block, q1, q2x, want, harm, note) { C.push({ id: id, t: "kept", block: block, q1: q1, q2: q2x, want: want, harm: harm, note: note || "" }); }
var KS = ["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1"], KC = ["stop PB1 M1", "start PB2 M1", "coil M1 \x22conveyor starter\x22", "overload OL1 M1"];
var KF = ["estop ES1", "stop PB1 M1", "start PB2 M1", "coil M1 \x22fan starter\x22", "overload OL1 M1"], KL = KS.concat(["lamp LT1 M1 \x22run\x22 green"]);
var KSUMP = ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 \x22pump on\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"];
var KST = KS.slice(0, 0).concat(["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1"]);
k("kp-same", KS, "Draw a start stop circuit for the pump", "Draw a start stop circuit for the pump", "shown", "medium");
k("kp-please-again", KS, "Draw a start/stop control circuit for the pump", "Please draw a start/stop control circuit for the pump again", "shown", "medium");
k("kp-estop-words", KF, "Draw a fan starter with an e-stop", "Draw a fan starter with an emergency stop", "shown", "low");
k("kp-a-the", KS, "Draw a start stop circuit for the pump", "draw a start stop circuit for a pump", "shown", "low");
k("kp-green-red", KL, "Draw a pump starter with a green run light", "Draw a pump starter with a red run light", "hidden", "high");
k("kp-without-light", KL, "Draw a pump starter with a run light", "Draw a pump starter without a run light", "hidden", "high");
k("kp-no-estop", KF, "Draw a fan starter with an e-stop", "Draw a fan starter with no e-stop", "hidden", "high");
k("kp-each-pump", KS, "Draw a start stop circuit for the pump", "Draw a start stop circuit for each pump", "hidden", "high");
k("kp-24ac-24dc", ["supply \x2224 V AC\x22"].concat(KS), "Draw a pump starter with start and stop buttons, 24 V AC control", "Draw a pump starter with start and stop buttons, 24 V DC control", "hidden", "high");
k("kp-cant", KS, "Draw a pump starter where the pump can start from the panel", "Draw a pump starter where the pump can't start from the panel", "hidden", "high");
k("kp-explain", KS, "Draw a start stop circuit for the pump", "Explain the start stop circuit for the pump", "hidden", "high");
k("kp-empty-question", KS, "", "Draw a start stop circuit for the pump", "hidden", "low");
k("kp-reversed-order", ["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1", "lamp LT1 M1 \x22run\x22 green", "lamp LT2 M1 off \x22stopped\x22 red"], "Draw a pump starter with a green run light and a red stopped light", "Draw a pump starter with a red run light and a green stopped light", "hidden", "high");
// the plural folded into the singular by the stem: more machines, stations, floats or e-stops than the kept circuit has
k("kp-plural-pumps", KS, "Draw a start stop circuit for the pump", "Draw a start stop circuit for the pumps", "hidden", "high", "the pumps: more than the one kept");
k("kp-plural-conveyors", KC, "Draw a motor starter for the conveyor", "Draw motor starters for the conveyors", "hidden", "high");
k("kp-plural-fans", KF, "Draw a fan starter with an e-stop", "Draw fan starters with an e-stop", "hidden", "high");
k("kp-plural-well-pumps", KS, "Draw the start stop control for the well pump", "Draw the start stop control for the well pumps", "hidden", "high");
k("kp-plural-estops", KF, "Draw a fan starter with an e-stop", "Draw a fan starter with e-stops", "hidden", "high", "Lantern's own givens refuse e-stops in the plural");
k("kp-plural-stations", KST, "Draw a pump starter with a start/stop station", "Draw a pump starter with start/stop stations", "hidden", "high");
k("kp-plural-floats", KSUMP, "Draw the control circuit for a sump pump with a float", "Draw the control circuit for a sump pump with floats", "hidden", "high");
k("kp-run-lights", KL, "Draw a pump starter with a run light", "Draw a pump starter with run lights", "either", "low", "Lantern's own reads run lights as one run light too");
k("kp-two-vs-2", KS, "Draw a start stop circuit for two pumps", "Draw a start stop circuit for 2 pumps", "either", "low");
k("kp-this-pump", KS, "Draw a start stop circuit for the pump", "Draw a start stop circuit for this pump", "either", "low");

// ---------------------------------------------------------------- which code
function p(id, q, want, harm, note) { C.push({ id: id, t: "pick", q: q, want: want, harm: harm, note: note || "" }); }
[["ghana", "in Ghana"], ["accra-ghana", "in Accra, Ghana"], ["uganda", "in Uganda"], ["kampala-uganda", "in Kampala, Uganda"], ["tanzania", "in Tanzania"],
  ["dar-tanzania", "in Dar es Salaam, Tanzania"], ["zambia", "in Zambia"], ["zimbabwe", "in Zimbabwe"], ["pakistan", "in Pakistan"], ["karachi-pakistan", "in Karachi, Pakistan"],
  ["egypt", "in Egypt"], ["cairo-egypt", "in Cairo, Egypt"], ["bangladesh", "in Bangladesh"], ["dhaka-bangladesh", "in Dhaka, Bangladesh"], ["sri-lanka", "in Sri Lanka"],
  ["colombo-sri-lanka", "in Colombo, Sri Lanka"], ["uae", "in the UAE"], ["dubai", "in Dubai"], ["abudhabi-uae", "in Abu Dhabi, UAE"], ["kenya", "in Kenya"],
  ["nairobi-kenya", "in Nairobi, Kenya"], ["nigeria", "in Nigeria"], ["lagos-nigeria", "in Lagos, Nigeria"], ["korea", "in Korea"], ["seoul-korea", "in Seoul, Korea"],
  ["seoul-south-korea", "in Seoul, South Korea"], ["mine-zambia", "for a mine in Zambia"], ["comma-uganda", ", Uganda"]].forEach(function (x) {
  p("pk-" + x[0], "Draw a motor starter for a pump " + x[1], "IEC", "medium");
});
p("pk-lusaka-zambia", "Draw a motor starter for a pump in Lusaka, Zambia", "IEC", "low", "Zambia is in the place list but not in the comma form");
p("pk-harare-zimbabwe", "Draw a motor starter for a pump in Harare, Zimbabwe", "IEC", "low", "Zimbabwe is in the place list but not in the comma form");
p("pk-monterrey-mexico", "Draw a motor starter for a pump in Monterrey, Mexico", "US", "medium");
p("pk-mexico", "Draw a motor starter for a pump in Mexico", "US", "medium");
p("pk-iec-contactor-480-60", "Draw a motor starter with an IEC contactor, 480 V 60 Hz", "US", "medium");
p("pk-nema-400-50", "Draw a motor starter with a NEMA starter, 400 V 50 Hz", "IEC", "medium");
p("pk-iec-contactor-24dc", "Draw a motor starter with an IEC contactor and a 24 V DC coil", "IEC", "low");
p("pk-nema-size1", "Draw a motor starter with a NEMA size 1 starter", "US", "medium");
p("pk-egypt-road-ohio", "Draw a motor starter for a pump at a shop on Egypt Road in Ohio", "US", "medium");
p("pk-dubai-street-texas", "Draw a motor starter for Dubai Street in Texas", "US", "medium");
p("pk-new-mexico", "Draw a motor starter for a factory in Albuquerque, New Mexico", "US", "medium");
p("pk-nema-egypt", "Draw a motor starter with a NEMA starter for a plant in Egypt", "IEC", "medium");
p("pk-iec-texas", "Draw a motor starter with an IEC contactor for a plant in Texas", "US", "medium");
p("pk-kenya-415", "Draw a motor starter for a farm in Kenya, 415 V", "IEC", "medium");
p("pk-50hz-nema-rated", "Draw a motor starter, 230/400 V 50 Hz, NEMA rated contactor", "IEC", "medium");
C.push({ id: "pk-back-names-iec", t: "build", q: "Draw the well pump control for a farm in Ghana, pressure switch cut-in 3 bar cut-out 4 bar", block: ["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 \x22cut-in 3 bar, cut-out 4 bar\x22", "coil M1 \x22well pump starter\x22", "overload OL1 M1"], want: "back", line: "IEC practice: IEC 60204-1:2016, 9.3.2", harm: "medium", note: "the line goes back in the practice of the place named" });

// ---------------------------------------------------------------- the guards
C.push({ id: "guard-bench-prompts", t: "guard-prompts", harm: "high", note: "every bench prompt as on 1.24.35, apart from make-control and make-control-b" });
C.push({ id: "guard-saved-builds", t: "guard-builds", harm: "high", note: "every saved reply with a MAKE block builds as on 1.24.35" });

module.exports = C;
