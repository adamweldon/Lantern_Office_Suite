// cases_givens.js -- the fifth review of 1.24.36's givens (review5_1236): questions people ask, in their own words, and
// what Lantern's prompt for them should hold. Written by a reviewer who had not seen the givens' own tests.
//   want: the given's lines (after its MAKE line) that the question should get, as "line / line / ..."; null: no given
//         (the prompt as 1.24.35 had it)
//   check(lines): for a case where more than one answer is right -- returns what is wrong, or null; lines is null when
//         no given is shown
//   harm: how bad it is when Lantern does otherwise
// The replay builds every given it sees shown (as a model copying it would write it) and expects it drawn with nothing
// sent back.
"use strict";
function S(load, dev, extra, pre) {   // a plain three-wire starter, as the given writes it
  return (pre || []).concat(["stop PB1 M1", "start PB2 M1", "coil M1 \x22" + load + " " + (dev || "starter") + "\x22", "overload OL1 M1"], extra || []).join(" / ");
}
var RUN = "lamp LT1 M1 \x22run\x22 green", STOPPED = "lamp LT1 M1 off \x22stopped\x22 red";
var REV = "stop PB1 all / start PB2 M1 \x22forward\x22 / start PB3 M2 \x22reverse\x22 / coil M1 \x22forward\x22 / coil M2 \x22reverse\x22 / interlock M1 M2 / overload OL1 M1 M2";
function SEQ2(a, b, dev) {
  dev = dev || "starter";
  return ["stop PB1 M1 \x22" + a + " stop\x22", "stop PB2 M2 \x22" + b + " stop\x22", "start PB3 M1 \x22" + a + " start\x22", "start PB4 M2 \x22" + b + " start\x22",
    "coil M1 \x22" + a + " " + dev + "\x22", "coil M2 M1 \x22" + b + " " + dev + "\x22", "overload OL1 M1", "overload OL2 M2"].join(" / ");
}
function DLY(t, load, horn, pre) {
  return (pre || []).concat(["stop PB1 CR1", "start PB2 CR1", "relay CR1 \x22run\x22", "timer TR1 \x22" + t + "\x22 CR1", "coil M1 TR1 \x22" + load + " starter\x22", "overload OL1 M1 CR1"],
    horn ? ["horn AH1 CR1 TR1 off \x22warning\x22"] : []).join(" / ");
}
var COMP = function (co, dev, pre, post) { return (pre || []).concat(["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 nc \x22" + (co ? "cut-out " + co : "opens at cut-out") + "\x22", "coil M1 \x22compressor " + (dev || "starter") + "\x22", "overload OL1 M1"], post || []).join(" / "); };
var FILL1 = function (dev, post) { return ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22tank full\x22", "coil M1 \x22pump " + (dev || "contactor") + "\x22", "overload OL1 M1"].concat(post || []).join(" / "); };
var FILL2 = function (dev) { return ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump " + (dev || "contactor") + "\x22", "overload OL1 M1"].join(" / "); };
var SUMP = function (dev, post) { return ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 \x22pump on\x22", "coil M1 \x22pump " + (dev || "contactor") + "\x22", "overload OL1 M1"].concat(post || []).join(" / "); };
// a given may be left out, but if shown it must not put this voltage on the control's rails
function noSupply(v) { return function (ls) { if (!ls) return null; var s = ls.filter(function (l) { return /^supply\b/.test(l); })[0]; return s && new RegExp("\x22" + v + " V").test(s) ? "the given draws the control at " + v + " V, the motor's voltage the question names (" + s + ")" : null; }; }
// a given may be left out; if shown it must have a line matching re
function needs(re, what) { return function (ls) { if (!ls) return null; return ls.some(function (l) { return re.test(l); }) ? null : "the given shown lacks " + what + " (" + ls.join(" / ") + ")"; }; }
function noGiven(what) { return function (ls) { return ls ? "a given is shown that " + what + ": " + ls.join(" / ") : null; }; }

module.exports = [
  // ---- three-wire starters that fit, as people ask them -------------------------------------------------------------
  { id: "g-starter-conveyor", q: "Draw a motor starter circuit with start and stop push buttons for a conveyor", want: S("conveyor"), harm: "medium" },
  { id: "g-starter-pump-run", q: "Draw a 3-wire start/stop control for a pump motor with a green run light", want: S("pump", 0, [RUN]), harm: "high" },
  { id: "g-starter-fan-2lights", q: "Draw a three wire control circuit for a fan with a red stop light and a green run light", want: S("fan", 0, ["lamp LT1 M1 off \x22stopped\x22 red", "lamp LT2 M1 \x22run\x22 green"]), harm: "high" },
  { id: "g-starter-ctrl-xfmr", q: "Draw a motor starter for a 460V 3-phase motor with 120V control transformer", want: S("motor", 0, 0, ["supply \x22120 V AC\x22"]), harm: "high" },
  { id: "g-starter-24vdc", q: "Draw a motor starter with 24 V DC control for a pump", want: S("pump", 0, 0, ["supply \x2224 V DC\x22"]), harm: "high" },
  { id: "g-starter-estop-saw", q: "Draw a motor starter circuit with an e-stop for a saw", want: S("saw", 0, 0, ["estop ES1"]), harm: "high" },
  { id: "g-starter-2stations", q: "Draw a magnetic starter circuit with two start/stop stations for a conveyor", want: "stop PB1 M1 \x22stop, local\x22 / stop PB2 M1 \x22stop, remote\x22 / start PB3 M1 \x22start, local\x22 / start PB4 M1 \x22start, remote\x22 / coil M1 \x22conveyor starter\x22 / overload OL1 M1", harm: "high" },
  { id: "g-starter-local-remote", q: "Draw a motor starter circuit with local and remote stations for a pump", want: "stop PB1 M1 \x22stop, local\x22 / stop PB2 M1 \x22stop, remote\x22 / start PB3 M1 \x22start, local\x22 / start PB4 M1 \x22start, remote\x22 / coil M1 \x22pump starter\x22 / overload OL1 M1", harm: "high" },
  { id: "g-starter-3stations", q: "Draw a motor starter for a conveyor with three start/stop stations", want: "stop PB1 M1 \x22stop 1\x22 / stop PB2 M1 \x22stop 2\x22 / stop PB3 M1 \x22stop 3\x22 / start PB4 M1 \x22start 1\x22 / start PB5 M1 \x22start 2\x22 / start PB6 M1 \x22start 3\x22 / coil M1 \x22conveyor starter\x22 / overload OL1 M1", harm: "high" },
  { id: "g-starter-two-places", q: "Draw a motor starter for a conveyor that can be started and stopped from two places", want: "stop PB1 M1 \x22stop, local\x22 / stop PB2 M1 \x22stop, remote\x22 / start PB3 M1 \x22start, local\x22 / start PB4 M1 \x22start, remote\x22 / coil M1 \x22conveyor starter\x22 / overload OL1 M1", harm: "high" },
  { id: "g-starter-stopped-light", q: "Draw a start stop circuit for a pump with a pilot light that is on while the pump is stopped", want: S("pump", 0, [STOPPED]), harm: "high" },
  { id: "g-starter-red-run", q: "Draw a motor starter circuit for a fan with a red light when running and a green light when stopped", want: S("fan", 0, ["lamp LT1 M1 \x22run\x22 red", "lamp LT2 M1 off \x22stopped\x22 green"]), harm: "high" },
  { id: "g-starter-goes-out", q: "Draw a motor starter for a fan with a red light that goes out when the fan starts", want: S("fan", 0, [STOPPED]), harm: "high" },
  { id: "g-starter-not-running", q: "Draw a motor starter for a conveyor with a light that is on when the conveyor is not running", want: S("conveyor", 0, [STOPPED]), harm: "high" },
  { id: "g-starter-blue", q: "Draw a motor starter for a conveyor with a blue light while it runs", want: S("conveyor", 0, ["lamp LT1 M1 \x22run\x22 blue"]), harm: "high" },
  { id: "g-starter-both-lights", q: "Draw a motor starter for a conveyor with a light on when stopped and a light on when running", want: S("conveyor", 0, [STOPPED, "lamp LT2 M1 \x22run\x22 green"]), harm: "high" },
  { id: "g-starter-24vdc-400v", q: "Draw a DOL starter for a pump with 24VDC control and 400 V motor", want: S("pump", 0, 0, ["supply \x2224 V DC\x22"]), harm: "high" },
  { id: "g-starter-110-xfmr", q: "Draw a DOL starter for a pump with a 110 V control transformer", want: S("pump", 0, 0, ["supply \x22110 V AC\x22"]), harm: "high" },
  { id: "g-starter-nema1", q: "Draw a magnetic motor starter with start and stop for a pump, NEMA size 1", want: S("pump"), harm: "medium" },
  { id: "g-starter-no-estop", q: "Draw a motor starter for a conveyor without an e-stop", want: S("conveyor"), harm: "high" },
  { id: "g-starter-no-light", q: "Draw a motor starter circuit for a grinder with no pilot light", want: S("grinder"), harm: "high" },
  { id: "g-starter-table-saw", q: "Draw a start/stop circuit for a table saw motor starter", want: S("saw"), harm: "medium" },
  { id: "g-starter-5hp", q: "Draw a magnetic starter for a 5 hp pump with start and stop", want: S("pump"), harm: "medium" },
  { id: "g-starter-contactor", q: "Draw a contactor control circuit with start and stop push buttons for a ventilation fan", want: S("fan", "contactor"), harm: "medium" },
  { id: "g-starter-mushroom", q: "Draw a motor starter for a conveyor with an emergency stop mushroom button", want: S("conveyor", 0, 0, ["estop ES1"]), harm: "high" },
  { id: "g-starter-uk-230", q: "Draw a DOL starter with stop and start push buttons for a pump, 230 V control circuit", want: S("pump", 0, 0, ["supply \x22230 V AC\x22"]), harm: "high" },
  { id: "g-starter-germany", q: "Draw a motor starter circuit for a pump in Germany", want: S("pump"), harm: "medium" },
  { id: "g-starter-trip-light-left", q: "Draw a motor starter for a pump with a run light and an overload trip light", want: S("pump", 0, [RUN]), harm: "medium" },
  { id: "g-starter-power-light-left", q: "Draw a motor starter for a fan with a white power on light", want: S("fan"), harm: "medium" },
  // ---- more ways people ask for a starter, from other trades and places ---------------------------------------------
  { id: "g-wire-dol-3kw", q: "Wire a DOL starter with stop/start for a 3 kW pump", want: S("pump"), harm: "medium" },
  { id: "g-24vac-coil", q: "Can you draw the control wiring of a fan starter with stop and start buttons, 24 VAC coil", want: S("fan", 0, 0, ["supply \x2224 V AC\x22"]), harm: "high" },
  { id: "g-hold-in", q: "I need a hold-in circuit for a pump motor starter", want: S("pump"), harm: "medium" },
  { id: "g-how-do-i", q: "How do I wire a three wire start stop for my lathe?", want: S("lathe"), harm: "medium" },
  { id: "g-1ph-240-contactor", q: "Draw a start-stop circuit for a 1 phase 240 V pump motor with a contactor", want: S("pump", "contactor"), harm: "high" },
  { id: "g-auger-estop", q: "Draw a start stop circuit for an auger motor with a contactor and an emergency stop", want: S("auger", "contactor", 0, ["estop ES1"]), harm: "high" },
  { id: "g-120v-coil-480v", q: "Draw a 120V coil starter for a 480V pump with start and stop", want: S("pump", 0, 0, ["supply \x22120 V AC\x22"]), harm: "high" },
  { id: "g-400v-motor-230v-ctrl", q: "Draw a motor starter circuit for a pump, 400 V three phase motor, 230 V control", want: S("pump", 0, 0, ["supply \x22230 V AC\x22"]), harm: "high" },
  { id: "g-415-110", q: "Draw a motor starter circuit for a pump, 415V motor, 110V control", want: S("pump", 0, 0, ["supply \x22110 V AC\x22"]), harm: "high" },
  { id: "g-230v-coil", q: "Draw a motor starter with a 230V coil for a pump", want: S("pump", 0, 0, ["supply \x22230 V AC\x22"]), harm: "high" },
  { id: "g-mushroom-run", q: "Draw a motor starter for a pump with a mushroom head e-stop and a run light", want: S("pump", 0, [RUN], ["estop ES1"]), harm: "high" },
  { id: "g-crusher-run", q: "Draw the control for a crusher starter with start and stop, and a run light", want: S("crusher", 0, [RUN]), harm: "high" },
  { id: "g-latching", q: "Draw a latching start stop circuit for a conveyor motor starter", want: S("conveyor"), harm: "medium" },
  { id: "F-volt-ctrl-said-first", q: "Draw a motor starter circuit for a pump, control voltage 230 V, motor 400 V three phase", check: needs(/^supply \x22230 V AC\x22/, "the 230 V control voltage the question names (the given has no supply line)"), harm: "low" },
  // ---- three-wire starters: no given, the question asks for more ----------------------------------------------------
  { id: "n-starter-fuse", q: "Draw a start stop circuit for a motor with a control fuse", want: null, harm: "high" },
  { id: "n-starter-lights-load", q: "Draw a start/stop station controlling a contactor for the shop lights", want: null, harm: "high" },
  { id: "n-starter-key", q: "Draw a motor starter for a conveyor with a key switch", want: null, harm: "high" },
  { id: "n-starter-hoa", q: "Draw a motor starter for a pump with a selector switch for hand and auto", want: null, harm: "high" },
  { id: "n-starter-iec-tags", q: "Draw a motor starter with K1, S1 and S2 for a pump", want: null, harm: "high" },
  { id: "n-starter-star-delta", q: "Draw a star delta starter control circuit for a pump", want: null, harm: "high" },
  { id: "n-starter-two-speed", q: "Draw a two speed motor starter control circuit for a fan", want: null, harm: "high" },
  { id: "n-starter-vfd", q: "Draw a motor starter control circuit for a pump with a VFD", want: null, harm: "high" },
  { id: "n-starter-jog", q: "Draw a motor starter control circuit with start, stop and jog buttons for a conveyor", want: null, harm: "high" },
  { id: "n-starter-two-pumps", q: "Draw a motor starter control circuit for two pumps with start and stop buttons", want: null, harm: "high" },
  { id: "n-starter-conveyor-fan", q: "Draw a start stop motor starter for a conveyor and a fan", want: null, harm: "high" },
  { id: "n-starter-explain", q: "Explain how a motor starter's holding contact works", want: null, harm: "high" },
  { id: "n-starter-size", q: "What size overload heaters for a 10 hp motor starter", want: null, harm: "high" },
  { id: "n-starter-heater", q: "Draw a contactor control circuit for a heater with start and stop buttons", want: null, harm: "high" },
  { id: "n-starter-two-lights", q: "Draw a motor starter for a conveyor with two lights", want: null, harm: "high" },
  { id: "n-starter-green-red", q: "Draw a motor starter for a conveyor with a green light and a red light", want: null, harm: "high" },
  { id: "n-starter-restart", q: "Draw a motor starter circuit for a pump that restarts automatically after a power failure", want: null, harm: "high" },
  { id: "n-starter-thermostat", q: "Draw a motor starter control circuit for a fan with a thermostat", want: null, harm: "high" },
  { id: "n-starter-spanish", q: "Dibuja un arrancador de motor con botones de arranque y parada", want: null, harm: "high" },
  { id: "n-starter-bore", q: "Draw a DOL starter circuit with start and stop for a bore pump", want: null, harm: "medium" },
  { id: "n-starter-hoist", q: "Draw a forward reverse starter for a hoist", want: null, harm: "high" },
  { id: "n-starter-pull-cord", q: "Draw a motor starter for a conveyor with a pull cord e-stop", want: null, harm: "high" },
  { id: "n-starter-estop-each", q: "Draw a motor starter for a conveyor with an emergency stop at each station", want: null, harm: "high" },
  { id: "n-starter-1start-2stop", q: "Draw a motor starter circuit with one start button and two stop buttons for a saw", want: null, harm: "high" },
  { id: "n-starter-panel-machine", q: "Draw a motor starter for a pump with start/stop push buttons at the motor and at the panel", want: null, harm: "high" },
  { id: "n-starter-plc", q: "Draw a motor starter for a pump controlled by a PLC", want: null, harm: "high" },
  // ---- the starter given shown for a question that says a time it does not have (found by this review) ---------------
  { id: "F-time-runs-10min", q: "Draw a motor starter for a pump with a start button, a stop button, and the pump runs for 10 minutes then stops", check: noGiven("has no timer for the 10 minutes the pump is to run"), harm: "high" },
  { id: "F-time-run-on", q: "Draw a motor starter for a fan that keeps running for 30 minutes after you press stop", check: noGiven("has no off-delay: the fan is to keep running 30 minutes after stop"), harm: "high" },
  { id: "F-time-stops-2h", q: "Draw a motor starter for a conveyor that stops after 2 hours", check: noGiven("has no timer to stop the conveyor after 2 hours"), harm: "high" },
  { id: "F-time-runs-5min", q: "Draw a motor starter for a pump that runs for 5 minutes", check: noGiven("has no timer for the 5 minutes"), harm: "high" },
  { id: "F-time-anti-restart", q: "Draw a start stop circuit for a fan that can't be started again for 5 minutes after it stops", check: noGiven("has no anti-restart timer"), harm: "high" },
  { id: "F-time-turns-off-1h", q: "Draw a motor starter for a pump that turns off after 1 hour", check: noGiven("has no timer to turn the pump off after 1 hour"), harm: "high" },
  { id: "F-time-10min-after-stop", q: "Draw a motor starter with start/stop for an exhaust fan running 10 minutes after the stop", check: noGiven("has no off-delay"), harm: "high" },
  { id: "F-time-20s-later", q: "Draw a motor starter for a pump: press start, it runs; press stop, it stops 20 seconds later", check: noGiven("has no off-delay of 20 seconds"), harm: "high" },
  { id: "F-time-once-every-hour", q: "Draw a motor starter for a pump with start and stop that runs once every hour", check: noGiven("has no cycle timer"), harm: "high" },
  { id: "F-time-starts-again", q: "Draw a motor starter for a conveyor that starts again after 5 minutes", check: noGiven("is a delayed start on the button, not a restart 5 minutes after the conveyor stops"), harm: "medium" },
  // ---- the control voltage (found by this review): the motor's voltage drawn as the control's -----------------------
  { id: "F-volt-575-crusher", q: "Draw a motor starter control circuit for a 575 V crusher", check: noSupply(575), harm: "high" },
  { id: "F-volt-400-conveyor", q: "Draw the control circuit for a 400 V conveyor with start and stop push buttons", check: noSupply(400), harm: "high" },
  { id: "F-volt-460-reversing", q: "Draw a forward reverse control circuit for a 460 V conveyor", check: noSupply(460), harm: "high" },
  { id: "F-volt-460-delayed", q: "Draw a delayed start control circuit for a 460 V conveyor with a warning horn", check: noSupply(460), harm: "high" },
  { id: "F-volt-380-agitator", q: "Draw a start/stop control circuit for a 380 V agitator", check: noSupply(380), harm: "high" },
  { id: "F-volt-400-50hz-comp", q: "Draw the control circuit for a 400 V 50 Hz air compressor with a pressure switch", check: noSupply(400), harm: "high" },
  { id: "F-volt-208-fan", q: "Draw the control circuit for a 208 V single phase exhaust fan with start stop buttons", check: noSupply(208), harm: "medium" },
  { id: "F-volt-230-grinder", q: "Draw a start-stop control circuit for a 230V grinder", check: noSupply(230), harm: "medium" },
  { id: "g-volt-460-motor-ok", q: "Draw the control circuit for a 480 volt 3 phase motor with start and stop buttons", check: noSupply(480), harm: "high" },
  { id: "g-volt-120-and-480", q: "Draw the control circuit for a 120 V start stop with a 480 V conveyor", want: S("conveyor", 0, 0, ["supply \x22120 V AC\x22"]), harm: "high" },
  { id: "g-volt-460-25hp", q: "Draw the start stop control circuit for a 460 V, 25 HP pump", check: noSupply(460), harm: "high" },
  { id: "g-volt-415-mixer-motor", q: "Draw the start stop control circuit for a 415 V mixer motor", check: noSupply(415), harm: "high" },
  // ---- lights: a guess is no given --------------------------------------------------------------------------------
  { id: "F-light-plural", q: "Draw a motor starter for a conveyor with lights", check: function (ls) { return ls && ls.filter(function (l) { return /^lamp/.test(l); }).length < 2 ? "lights asked for, one light in the given (a guess at which): " + ls.join(" / ") : null; }, harm: "high" },
  { id: "F-light-pilot-plural", q: "Draw a motor starter for a conveyor with pilot lights", check: function (ls) { return ls && ls.filter(function (l) { return /^lamp/.test(l); }).length < 2 ? "pilot lights asked for, one light in the given (a guess at which): " + ls.join(" / ") : null; }, harm: "high" },
  { id: "F-light-illuminated-button", q: "Draw a motor starter for a pump with an illuminated start button", check: function (ls) { return ls && !ls.some(function (l) { return /^lamp/.test(l); }) ? "an illuminated start button asked for; the given has no light at all: " + ls.join(" / ") : null; }, harm: "medium" },
  { id: "g-light-one-plain", q: "Draw a motor starter for the exhaust fan with a pilot light", want: S("fan", 0, [RUN]), harm: "medium" },
  { id: "g-light-flashing", q: "Draw a motor starter for a pump with a flashing light while running", want: null, harm: "high" },
  // ---- forward and reverse ----------------------------------------------------------------------------------------
  { id: "g-rev-plain", q: "Show a forward/reverse motor control circuit", want: REV, harm: "high" },
  { id: "g-rev-lights", q: "Draw a forward reverse control circuit for a conveyor with pilot lights for each direction", want: REV + " / lamp LT1 M1 \x22forward\x22 green / lamp LT2 M2 \x22reverse\x22 green", harm: "high" },
  { id: "g-rev-estop", q: "Draw a reversing motor starter with forward, reverse and stop buttons and an e-stop", want: "estop ES1 / " + REV, harm: "high" },
  { id: "g-rev-must-stop", q: "Draw a forward/reverse starter for a mixer, must stop before reversing", want: REV, harm: "high" },
  { id: "g-rev-common-stop", q: "Draw a forward reverse control circuit with forward and reverse start buttons and a common stop", want: REV, harm: "high" },
  { id: "n-rev-limits", q: "Draw a forward/reverse circuit with limit switches for a gate", want: null, harm: "high" },
  { id: "n-rev-winch", q: "Draw a reversing starter for a winch", want: null, harm: "high" },
  { id: "n-rev-two-stops", q: "Draw a forward reverse control circuit with two stop buttons", want: null, harm: "high" },
  { id: "n-rev-run-light", q: "Draw a forward reverse starter for a conveyor with a run light", want: null, harm: "high" },
  { id: "n-rev-without-stop", q: "Draw a forward reverse starter where the motor can reverse without pressing stop", want: null, harm: "high" },
  { id: "F-rev-pb-interlock", q: "Draw a forward reverse motor starter with push button interlocking", check: noGiven("has only the contactors' interlock, not the push-button interlock the question asks for"), harm: "high" },
  { id: "F-rev-pb-interlocks", q: "Draw a forward reverse motor starter with pushbutton interlocks", check: noGiven("has only the contactors' interlock, not the push-button interlocks the question asks for"), harm: "high" },
  { id: "F-rev-two-overloads", q: "Draw a forward reverse starter with two overloads", check: noGiven("has one overload where the question asks for two"), harm: "medium" },
  { id: "F-rev-auto-30s", q: "Draw a forward reverse starter for a mixer that runs forward 30 seconds then reverse 30 seconds", check: noGiven("has no timers: the mixer is to change direction every 30 seconds by itself"), harm: "high" },
  { id: "F-rev-mech-interlock", q: "Draw a forward reverse starter with electrical and mechanical interlocks", check: noGiven("says nothing of the mechanical interlock asked for"), harm: "low" },
  // ---- motors in sequence -----------------------------------------------------------------------------------------
  { id: "g-seq-c1-c2", q: "Draw a sequence control circuit: conveyor 2 can only start after conveyor 1 is running", want: SEQ2("conveyor 1", "conveyor 2"), harm: "high" },
  { id: "g-seq-fan-pump", q: "Draw a control circuit where the pump must start after the fan is running", want: SEQ2("fan", "pump"), harm: "high" },
  { id: "g-seq-crusher-first", q: "Draw a motor starter control circuit where the crusher can't start until the conveyor is running", want: SEQ2("conveyor", "crusher"), harm: "high" },
  { id: "g-seq-feeds-it", q: "Draw the motor starters for a crusher and the conveyor that feeds it; the crusher must be running before the conveyor can start", want: SEQ2("crusher", "conveyor"), harm: "high" },
  { id: "g-seq-A-B", q: "Draw a sequence start control circuit: conveyor A can only start after conveyor B is running", want: SEQ2("conveyor B", "conveyor A"), harm: "high" },
  { id: "g-seq-3-chain", q: "Draw the control circuit for three conveyors that start in sequence, conveyor 3 first, then conveyor 2, then conveyor 1", want: "stop PB1 M1 \x22conveyor 3 stop\x22 / stop PB2 M2 \x22conveyor 2 stop\x22 / stop PB3 M3 \x22conveyor 1 stop\x22 / start PB4 M1 \x22conveyor 3 start\x22 / start PB5 M2 \x22conveyor 2 start\x22 / start PB6 M3 \x22conveyor 1 start\x22 / coil M1 \x22conveyor 3 starter\x22 / coil M2 M1 \x22conveyor 2 starter\x22 / coil M3 M2 \x22conveyor 1 starter\x22 / overload OL1 M1 / overload OL2 M2 / overload OL3 M3", harm: "high" },
  { id: "g-seq-overload-both", q: "Draw a sequence start: pump 2 can only start when pump 1 is running, and pump 1's overload stops both pumps", want: SEQ2("pump 1", "pump 2"), harm: "high" },
  { id: "g-seq-lights-each", q: "Draw a sequence start with motor starters where motor 2 can only start after motor 1 is running, with a run light for each", want: SEQ2("motor 1", "motor 2") + " / lamp LT1 M1 \x22motor 1 run\x22 green / lamp LT2 M2 \x22motor 2 run\x22 green", harm: "high" },
  { id: "n-seq-reverse-order", q: "Draw the control circuit for conveyors that start in reverse order", want: null, harm: "high" },
  { id: "n-seq-one-start", q: "Draw a sequence start control: conveyor 2 can only start after conveyor 1 is running, both on one start button", want: null, harm: "high" },
  { id: "F-seq-ordinal-order", q: "Draw a sequence start control circuit: the first conveyor can only start after the second conveyor is running", check: function (ls) { if (!ls) return null; var c = ls.filter(function (l) { return /^coil M2 M1/.test(l); })[0] || ""; return /conveyor 2/.test(c) ? "the given makes conveyor 2 wait for conveyor 1 (" + c + "): the question has the first conveyor wait for the second" : null; }, harm: "high" },
  { id: "F-seq-M-tags-order", q: "Draw a sequence start control circuit: M1 can only start after M2 is running", check: function (ls) { if (!ls) return null; var c = ls.filter(function (l) { return /^coil M2 M1/.test(l); })[0] || ""; return /motor 2/.test(c) ? "the given makes motor 2 wait for motor 1 (" + c + "): the question has M1 wait for M2" : null; }, harm: "high" },
  { id: "F-seq-stop-back", q: "Draw the control circuit with a motor starter: conveyor 2 must start after conveyor 1, and when conveyor 2 stops, conveyor 1 stops too", check: noGiven("stops conveyor 2 with conveyor 1 but never conveyor 1 with conveyor 2, as asked"), harm: "high" },
  { id: "F-seq-stopping-2-stops-1", q: "Draw a sequence start control circuit: conveyor 1 must be running before conveyor 2 can start, and stopping conveyor 2 stops conveyor 1", check: noGiven("never stops conveyor 1 when conveyor 2 stops, as asked"), harm: "high" },
  { id: "F-seq-one-stop", q: "Draw a sequence control circuit with motor starters: conveyor 2 can start only after conveyor 1 is running, and one stop button stops both", check: function (ls) { return ls && ls.filter(function (l) { return /^stop\b/.test(l); }).length > 1 ? "one stop button asked for, two in the given: " + ls.join(" / ") : null; }, harm: "high" },
  { id: "F-seq-common-stop", q: "Draw a sequence start control circuit: conveyor 2 can only start after conveyor 1 is running, with a common stop", check: function (ls) { return ls && ls.filter(function (l) { return /^stop\b/.test(l); }).length > 1 ? "a common stop asked for, two stops in the given: " + ls.join(" / ") : null; }, harm: "high" },
  { id: "F-seq-5s-after", q: "Draw a sequence start control circuit: conveyor 2 starts 5 seconds after conveyor 1 is running", check: noGiven("has no timer for the 5 seconds"), harm: "high" },
  { id: "F-seq-10s-after", q: "Draw a sequence start control circuit with motor starters: conveyor 2 can only start 10 seconds after conveyor 1 is running", check: noGiven("has no timer for the 10 seconds"), harm: "high" },
  // ---- delayed start ----------------------------------------------------------------------------------------------
  { id: "g-dly-horn-10s", q: "Draw a control circuit for a delayed start motor with a warning horn that sounds for 10 seconds before the conveyor starts", want: DLY("10 s", "conveyor", true), harm: "high" },
  { id: "g-dly-30s-no-horn", q: "Draw a delayed start control circuit for a pump: it starts 30 seconds after start is pressed", want: DLY("30 s", "pump", false), harm: "high" },
  { id: "g-dly-bell-15s", q: "Draw a control circuit with a start delay of 15 seconds for a mixer and a warning bell", want: DLY("15 s", "mixer", true), harm: "high" },
  { id: "g-dly-horn-then", q: "Draw a control circuit for a conveyor where a horn sounds for 5 seconds, then the conveyor starts", want: DLY("5 s", "conveyor", true), harm: "high" },
  { id: "n-dly-two-times", q: "Draw a delayed start control circuit: a horn sounds for 5 seconds and the conveyor starts 10 seconds after start is pressed", want: null, harm: "high" },
  { id: "n-dly-range", q: "Draw a delayed start control circuit with a 10-15 second delay for a conveyor", want: null, harm: "high" },
  { id: "n-dly-off-delay", q: "Draw an off delay timer control circuit for a fan", want: null, harm: "high" },
  { id: "n-dly-beacon", q: "Draw a delayed start control circuit for a conveyor with a warning horn and a flashing beacon", want: null, harm: "high" },
  { id: "F-dly-horn-keeps-sounding", q: "Draw a delayed start control circuit: a warning horn sounds for 10 seconds before the conveyor starts and keeps sounding while it runs", check: noGiven("silences the horn when the conveyor starts; the question has it keep sounding while it runs"), harm: "high" },
  // ---- air compressor ---------------------------------------------------------------------------------------------
  { id: "g-comp-125", q: "Draw the control circuit for an air compressor with a pressure switch, cut out 125 psi", want: COMP("125 psi"), harm: "high" },
  { id: "g-comp-8bar", q: "Draw the control circuit for an air compressor with a pressure switch that cuts out at 8 bar and cuts in at 6 bar", want: COMP("8 bar"), harm: "high" },
  { id: "g-comp-90-120", q: "Draw the control circuit for an air compressor with a pressure switch, cut in 90 psi, cut out 120 psi", want: COMP("120 psi"), harm: "high" },
  { id: "g-comp-estop", q: "Draw the control circuit for a shop air compressor on a pressure switch with a motor starter and an e-stop", want: COMP(null, 0, ["estop ES1"]), harm: "high" },
  { id: "g-comp-run-light", q: "Draw the control circuit for an air compressor with a pressure switch and a run light", want: COMP(null, 0, 0, [RUN]), harm: "high" },
  { id: "n-comp-refrig", q: "Draw the control circuit for a refrigeration compressor with a low pressure switch", want: null, harm: "high" },
  { id: "n-comp-two", q: "Draw the control circuit for two air compressors with pressure switches", want: null, harm: "high" },
  { id: "n-comp-drain", q: "Draw the control circuit for an air compressor with a pressure switch and an auto drain valve", want: null, harm: "high" },
  { id: "n-comp-high-temp", q: "Draw the control circuit for an air compressor with a pressure switch and a high temperature shutdown", want: null, harm: "high" },
  { id: "n-comp-walk-in", q: "Draw the control circuit for a compressor with a pressure switch in a walk-in cooler", want: null, harm: "high" },
  { id: "n-comp-hoa", q: "Draw the control circuit for an air compressor with a pressure switch and a hand-off-auto switch", want: null, harm: "high" },
  // ---- tank fill --------------------------------------------------------------------------------------------------
  { id: "g-fill-cistern", q: "Draw a contactor control circuit for a well pump that fills a cistern with a float switch", want: FILL1(), harm: "high" },
  { id: "g-fill-starter", q: "Draw the control circuit for a pump that fills a water tank with a float switch, with a motor starter", want: FILL1("starter"), harm: "high" },
  { id: "g-fill-trough", q: "Draw the control circuit with a contactor for a pump that fills a cattle trough with a float switch", want: FILL1(), harm: "high" },
  { id: "g-fill-keep-full", q: "Draw the control circuit with a contactor for a pump that keeps the tank full with a float switch", want: FILL1(), harm: "high" },
  { id: "g-fill-pump-on-light", q: "Draw the control circuit with a contactor for a pump that fills a tank with a float switch and a pump on light", want: FILL1(0, ["lamp LT1 M1 \x22pump on\x22 green"]), harm: "high" },
  { id: "g-fill2-low-high", q: "Draw the control circuit for a pump that fills a tank using a low float and a high float, with a contactor", want: FILL2(), harm: "high" },
  { id: "g-fill2-start-stop", q: "Draw the control circuit with a contactor for a pump that fills a tank with start and stop floats", want: FILL2(), harm: "high" },
  { id: "g-fill2-said-jobs", q: "Draw the control circuit with a contactor for a pump that fills a tank: the low float starts the pump and the high float stops it", want: FILL2(), harm: "high" },
  { id: "F-fill2-said-backwards", q: "Draw the control circuit with a contactor for a pump that fills a tank: the high float starts the pump and the low float stops it", check: noGiven("starts the pump on the low float and stops it on the high one: the question says the opposite"), harm: "high" },
  { id: "n-fill-from-well", q: "Draw the control circuit with a contactor for a pump that fills a tank from a well with a float switch", want: null, harm: "high" },
  { id: "n-fill-valve", q: "Draw the control circuit with a contactor for a pump that fills a tank with a float switch and a solenoid valve", want: null, harm: "high" },
  { id: "n-fill-closes-empty", q: "Draw the control circuit with a contactor for a pump that fills a tank with a float switch that closes when the tank is empty", want: null, harm: "high" },
  { id: "n-fill2-alarm", q: "Draw the control circuit with a contactor for a pump that fills a tank between a low float and a high float, and a high level alarm", want: null, harm: "high" },
  // ---- sump -------------------------------------------------------------------------------------------------------
  { id: "g-sump-plain", q: "Draw the control circuit with a motor starter for a sump pump with a float switch", want: SUMP("starter"), harm: "high" },
  { id: "g-sump-alarm-light", q: "Draw a contactor circuit for a sump pump with a float switch and a high water alarm light", want: SUMP(0, ["float FS2 \x22high level alarm\x22", "lamp LT1 FS2 \x22high water\x22 red"]), harm: "high" },
  { id: "g-sump-alarm-horn", q: "Draw a contactor circuit for a sump pump with a float and a high water alarm horn", want: SUMP(0, ["float FS2 \x22high level alarm\x22", "horn AH1 FS2 \x22high water\x22"]), harm: "high" },
  { id: "g-sump-bilge", q: "Draw the control circuit with a contactor for a bilge pump with a float switch", want: SUMP(), harm: "high" },
  { id: "g-sump-pit", q: "Draw the control circuit with a contactor for a pump that empties a pit with a float switch", want: SUMP(), harm: "high" },
  { id: "n-sump-on-off-floats", q: "Draw the control circuit with a contactor for a sump pump with an on float and an off float", want: null, harm: "high" },
  { id: "n-sump-overload-alarm", q: "Draw the control circuit with a contactor for a sump pump with a float switch and an alarm light when the overload trips", want: null, harm: "high" },
  { id: "n-sump-duplex", q: "Draw the control circuit for a duplex lift station with an alternating relay", want: null, harm: "high" },
  { id: "F-sump-red-light-alarm", q: "Draw the control circuit with a contactor for a sump pump with a float switch and a high water alarm with a red light and a horn", check: function (ls) { if (!ls) return null; return ls.some(function (l) { return /^lamp\b.*\bM1\b/.test(l) && /\bred\b/.test(l); }) ? "the alarm's red light is drawn as a light lit while the pump runs, and the alarm has the horn only: " + ls.join(" / ") : null; }, harm: "high" },
  { id: "F-sump-horn-no-alarm-word", q: "Draw the control circuit for a sump pump with a float switch and a horn when the water is high", check: needs(/^horn\b/, "the horn asked for"), harm: "medium" },
  { id: "F-sump-buzzer-rises", q: "Draw the control circuit with a contactor for a sump pump with a float switch and a buzzer that sounds when the water rises", check: needs(/^horn\b/, "the buzzer asked for"), harm: "medium" }
];
