// cases_b.js -- questions a given fits, or seems to, where what is shown must be fitted right: the lights the question
// asks for (and no others), the stations it asks for, the control supply it names (not the motor's), what the motor
// drives, the cut-out, the timer, and the circuit around the motor. A small model copies the block in front of it, so a
// given fitted wrongly is worse than none: right is the given fitted right, or no given.
"use strict";
var lib = require("./lib.js"), J = require("./judge.js");
var C = [];
function st(id, q, exp, harm, right) {
  C.push({ id: id, harm: harm, input: q, right: right || "the three-wire starter given with " + exp.stations + " station(s) and lights [" + (exp.lights || []).join(", ") + "]" + (exp.supply !== undefined ? ", supply " + (exp.supply || "none") : "") + (exp.load ? ", its coil a " + exp.load + "'s" : ""),
    run: function () { return lib.boot().then(function (x) { return J.starter(x.N.L, q, exp); }); } });
}
// a check on what is shown: f(g, x) -> "" or why; g = lib.given(L, q)
function shownIs(id, q, harm, right, f) {
  C.push({ id: id, harm: harm, input: q, right: right, run: function () { return lib.boot().then(function (x) { return f(lib.given(x.N.L, q), x); }); } });
}
function noRunLight(g) {
  if (!g.s.block) return "";
  var runs = g.s.lines.filter(function (l) { return /^lamp\s+\S+\s+M\d\s+(?!off\b)/.test(l); });
  return runs.length ? "shown " + runs.join(" / ") + ": a light on while the motor runs, which the question does not ask for" : "";
}
// ---- lights ----------------------------------------------------------------------------------------------------
shownIs("B-light-trip", "Draw a start/stop motor starter circuit with an overload trip light", "high",
  "an overload trip light (lit when OL1 trips: lamp LT1 OL1 \x22overload tripped\x22) or no light; never a run light", noRunLight);
shownIs("B-light-trip-comes-on", "Draw a motor starter with start and stop push buttons and a light that comes on when the overload trips", "high",
  "a light lit when the overload trips, or no light; never a run light", noRunLight);
shownIs("B-light-fault-reversing", "Draw a forward/reverse motor control circuit with a fault light", "medium",
  "a fault (overload) light, or none; not a forward and a reverse light", function (g) { var l = g.s.lines.filter(function (x) { return /^lamp/.test(x); }); return l.length && l.every(function (x) { return /forward|reverse/.test(x); }) ? "shown " + l.join(" / ") + " for a fault light" : ""; });
st("B-light-none-needed", "Draw a start/stop motor starter circuit, no pilot light needed", { stations: 1, lights: [] }, "high");
st("B-light-without", "Draw a three-wire motor starter control without any indicator lights", { stations: 1, lights: [] }, "high");
st("B-light-not-running", "Draw a motor starter with start and stop buttons and a light that shows the motor is not running", { stations: 1, lights: ["stopped"] }, "high");
st("B-light-goes-out", "Draw a start/stop motor starter with a pilot light that goes out when the motor runs", { stations: 1, lights: ["stopped"] }, "high");
st("B-light-red-stop", "Draw a three-wire control circuit for a 5 HP pump with a green run light and a red stop light", { stations: 1, lights: ["run", "stopped"], load: "pump" }, "high");
st("B-light-stopped-pilot", "Draw a three wire control for a mixer contactor with green run and red stopped pilot lights", { stations: 1, lights: ["run", "stopped"], load: "mixer" }, "high");
st("B-light-off-light", "Draw a motor starter with start/stop buttons, an ON light and an OFF light", { stations: 1, lights: ["run", "stopped"] }, "high");
st("B-light-window-semicolon", "Draw a motor starter with a run light; the motor is stopped by the stop button or the overload", { stations: 1, lights: ["run"] }, "high",
  "one run light: \x22stopped\x22 here is what the stop button does, not a light the question asks for");
st("B-light-window-is-off", "Draw a motor starter with a pilot light, and make sure the motor is off when the overload trips", { stations: 1, lights: ["run"] }, "medium",
  "a run light (a pilot light with no state named is a run light, as the given's own rule says): \x22is off\x22 is about the overload");
shownIs("B-light-power", "Draw a start/stop motor starter with a light that is on whenever the control power is on", "medium",
  "a power light lit whenever there is power (across the rails), or none; not a run light on M1", noRunLight);
st("B-light-light-duty", "Draw a start/stop motor starter for a light-duty conveyor", { stations: 1, lights: [], load: "conveyor" }, "medium");
shownIs("B-light-sump-alarm", "Draw the control circuit for a sump pump with a high water alarm", "high",
  "a high water alarm (a second float above the pump's, lighting an alarm or sounding a horn), or the sump given with no light; never a \x22pump on\x22 light standing for the alarm",
  function (g) { var l = g.s.lines.filter(function (x) { return /^lamp\s+\S+\s+M1\b/.test(x); }); return l.length ? "shown " + l.join(" / ") + " for a high water alarm" : ""; });
shownIs("B-light-sump-alarm-light", "Draw the control circuit for a sump pump with a float switch and an alarm light for high water", "high",
  "an alarm light on a high-water float, or the sump given with no light; never a \x22pump on\x22 light on M1",
  function (g) { var l = g.s.lines.filter(function (x) { return /^lamp\s+\S+\s+M1\b/.test(x); }); return l.length ? "shown " + l.join(" / ") + " for a high water alarm light" : ""; });
// ---- stations -------------------------------------------------------------------------------------------------
st("B-sta-three", "Draw a motor starter control circuit with three start/stop stations", { stations: 3, lights: [] }, "high",
  "three stops in series and three starts in parallel (or two, said to stand for several): never one station");
st("B-sta-two-pb", "Draw a motor starter that can be started and stopped from two push-button stations", { stations: 2, lights: [] }, "high");
st("B-sta-two-startstop", "Draw a motor starter circuit with two start/stop stations", { stations: 2, lights: [] }, "high");
st("B-sta-two-buttons-each", "Draw a 3-wire control circuit with two stop buttons and two start buttons for a conveyor", { stations: 2, lights: [], load: "conveyor" }, "high");
st("B-sta-second", "Draw a 3-wire motor starter with a second start/stop station at the far end", { stations: 2, lights: [] }, "high");
st("B-sta-both-ends", "Draw a start/stop conveyor starter with push-button stations at both ends", { stations: 2, lights: [], load: "conveyor" }, "high");
st("B-sta-workstations", "Draw a start/stop motor starter for a conveyor that carries parts between two stations", { stations: 1, lights: [], load: "conveyor" }, "low",
  "one start/stop station: the two stations are where the conveyor carries parts, not push-button stations");
// ---- supply ---------------------------------------------------------------------------------------------------
st("B-sup-480-120", "Draw the control circuit for a 480 V motor starter with a 120 V control transformer, start and stop buttons", { stations: 1, lights: [], supply: "120 V AC" }, "high",
  "the control supply the question names, 120 V AC (480 V is the motor's)");
st("B-sup-208-24", "Draw a start/stop motor starter for a 208 V motor with 24 V AC control", { stations: 1, lights: [], supply: "24 V AC" }, "high",
  "the control supply the question names, 24 V AC (208 V is the motor's)");
st("B-sup-460-motor", "Draw the motor starter circuit for a 460V 3-phase motor", { stations: 1, lights: [], supply: "" }, "medium",
  "no supply line (the question names the motor's voltage, not the control's); never 460 V shown as the control supply");
st("B-sup-24vdc-joined", "Draw a 24VDC start stop circuit for a motor contactor", { stations: 1, lights: [], supply: "24 V DC" }, "medium",
  "supply 24 V DC: the module's own comment says it reads \x2224VDC\x22");
st("B-sup-24vac-joined", "Draw a start/stop circuit for a 24 VAC contactor", { stations: 1, lights: [], supply: "24 V AC" }, "medium");
st("B-sup-120vac-joined", "Draw the control circuit for a motor starter with start and stop push buttons, 120 VAC control", { stations: 1, lights: [], supply: "120 V AC" }, "medium");
shownIs("B-sup-24v-no-kind", "Draw the control circuit for a sump pump with a float switch, 24 V", "low",
  "the supply as the question says it (24 V), not 24 V DC: 24 V control is as often AC (a class 2 transformer) as DC",
  function (g) { var s = g.s.lines.filter(function (l) { return /^supply/.test(l); })[0] || ""; return /DC/.test(s) ? "shown " + s + " where the question says 24 V" : ""; });
// ---- what the motor drives ------------------------------------------------------------------------------------
st("B-load-press-verb", "Draw a motor starter circuit: press start to run, press stop to stop", { stations: 1, lights: [], load: "motor" }, "medium",
  "a motor starter (\x22press\x22 is the verb, not a press)");
st("B-load-saw-verb", "Draw a motor starter as I saw in the manual", { stations: 1, lights: [], load: "motor" }, "low",
  "a motor starter (\x22saw\x22 is the verb)");
st("B-load-fan-pumphouse", "Draw a motor starter for a fan in the pump house with start and stop buttons", { stations: 1, lights: [], load: "fan" }, "medium",
  "a fan starter: the pump house is where the fan is");
C.push({ id: "B-load-seq-crusher", harm: "medium", input: "Draw a ladder diagram where the conveyor must start after the crusher is running",
  right: "M1 the crusher, M2 the conveyor that waits for it (or neutral names): not \x22conveyor 1\x22 for the crusher",
  run: function () { return lib.boot().then(function (x) { return J.sequence(x.N.L, "Draw a ladder diagram where the conveyor must start after the crusher is running", { motors: 2, labels: [/crusher|motor 1|M1\b/, /conveyor/] }); }); } });
C.push({ id: "B-load-seq-fan-pump", harm: "medium", input: "Draw a ladder diagram: the pump can only run when the cooling fan is running",
  right: "M1 the cooling fan, M2 the pump that waits for it (or neutral names): not \x22pump 1\x22 for the fan",
  run: function () { return lib.boot().then(function (x) { return J.sequence(x.N.L, "Draw a ladder diagram: the pump can only run when the cooling fan is running", { motors: 2, labels: [/fan|motor 1/, /pump/] }); }); } });
// ---- the compressor's cut-out ----------------------------------------------------------------------------------
shownIs("B-cp-30-above", "Draw the control circuit for an air compressor with a pressure switch where the cut-out is 30 psi above the cut-in of 90 psi", "medium",
  "the cut-out as the question gives it (120 psi), or none; never \x22cut-out 30 psi\x22 (30 psi is the differential)",
  function (g) { var l = g.s.lines.filter(function (x) { return /^pressure/.test(x); })[0] || ""; return /cut-out 30 psi/.test(l) ? "shown " + l : ""; });
shownIs("B-cp-low-pressure-refrig", "Draw the control circuit for a refrigeration compressor with a low pressure switch that cuts out at 20 psi", "high",
  "no air-compressor given: a low-pressure cut-out opens as the pressure FALLS to it (drawn normally open, held closed by pressure); the given's \x22nc, opens as the pressure rises to the cut-out\x22 is the other way",
  function (g) { return g.s.block ? "shown " + g.s.id + ": " + lib.short(g.s.lines.join(" / "), 200) + " -- " + lib.short(g.s.says, 200) : ""; });
shownIs("B-cp-low-oil", "Draw the control circuit for an air compressor with a pressure switch and a low oil pressure switch", "low",
  "the compressor given with both switches (the oil one closed while the oil pressure is up), or no given; one pressure switch shown \x22as it stands\x22 leaves the oil switch to the model",
  function (g) { return g.s.block && g.s.lines.filter(function (x) { return /^pressure/.test(x); }).length < 2 ? "shown one pressure switch: " + lib.short(g.s.lines.join(" / "), 200) : ""; });
// ---- the timer -------------------------------------------------------------------------------------------------
function noGiven(id, q, harm, right) { shownIs(id, q, harm, right, function (g, x) { return J.none(x, q); }); }
noGiven("B-dl-off-delay-fan", "Draw a control circuit where a fan keeps running 5 minutes after the burner shuts off, using a time delay relay", "high",
  "no delayed-start given: the question is an off-delay (the fan runs on after the burner stops); the given starts a motor after an on-delay");
noGiven("B-dl-off-delay-light", "Draw a time delay relay circuit that turns off a light 30 seconds after the push button is released", "high",
  "no delayed-start given (an off-delay, and a light, not a motor)");
shownIs("B-dl-two-motors", "Draw a control circuit where motor 2 starts 10 seconds after motor 1", "high",
  "two motors, M2 on a timer started by M1 (or no given): not a one-motor delayed start",
  function (g) { var coils = g.s.lines.filter(function (l) { return /^coil\s+M\d/.test(l); }); return g.s.block && coils.length < 2 ? "shown " + g.s.id + " with one motor: " + lib.short(g.s.lines.join(" / "), 220) : ""; });
noGiven("B-dl-ondelay-light", "Draw a control circuit with an on-delay timer that turns on a light 5 seconds after a switch is closed", "high",
  "no motor-starter given: the question's timer lights a lamp from a switch (no push buttons, no starter, no overload)");
shownIs("B-dl-float-starts", "Draw a control circuit where a pump starts 5 minutes after a float switch closes", "medium",
  "the float starts the timer (or no given): not start and stop push buttons",
  function (g) { return g.s.block && g.s.lines.some(function (l) { return /^start\s/.test(l); }) && !g.s.lines.some(function (l) { return /^float/.test(l); }) ? "shown " + g.s.id + " with push buttons and no float: " + lib.short(g.s.lines.join(" / "), 220) : ""; });
C.push({ id: "B-dl-overload-restart", harm: "high", input: "Draw a control circuit for a motor that starts 30 seconds after the start button is pressed, with a warning horn",
  right: "after the overload trips and is reset, the motor stays stopped until start is pressed again (and the warning sounds again): NEC 430.43, and a three-wire circuit's whole point; the given's overload is in M1's rung only, so CR1 stays sealed in and the timer timed out",
  run: function () {
    return lib.boot().then(function (x) {
      var q = "Draw a control circuit for a motor that starts 30 seconds after the start button is pressed, with a warning horn", g = lib.given(x.N.L, q);
      if (!g.c) return "no given drawn";
      var c = g.c, m = c.rungs.filter(function (r) { return r.out.kind === "coil" && r.series.some(function (e) { return e.timed; }); })[0], cr = c.rungs.filter(function (r) { return r.starts.length; })[0];
      var horn = c.rungs.filter(function (r) { return r.out.kind === "horn"; })[0], S = lib.make(c, {});
      S.elapse(); S.tap(cr.starts[0].id);
      if (!S.on(m.out.id)) return "the motor did not start";
      var ol = m.after[0].id; S.trip(ol); S.trip(ol, false);
      return S.on(m.out.id) ? m.out.id + " restarts the moment " + ol + " is reset, with nobody pressing start" + (horn ? " and no warning (" + horn.out.id + " is " + (S.on(horn.out.id) ? "on" : "silent") + ")" : "") + ": " + ol + " drops " + m.out.id + " only, and " + cr.out.id + " stays sealed in" : "";
    });
  } });
// ---- sequence ----------------------------------------------------------------------------------------------------
shownIs("B-sq-sequence-of-operation", "Draw a motor starter and explain its sequence of operation", "high",
  "the starter given (one motor) or none: \x22sequence of operation\x22 is how a circuit works, not a sequence start",
  function (g) { return g.s.id === "control-sequence" ? "shown the two-motor sequence given for one motor starter" : ""; });
shownIs("B-sq-number-rungs", "Draw a start/stop circuit for a pump starter and number the rungs in sequence", "high",
  "the starter given or none, not a two-motor sequence",
  function (g) { return g.s.id === "control-sequence" ? "shown the two-motor sequence given for one pump starter" : ""; });
C.push({ id: "B-sq-three-conveyors", harm: "high", input: "Draw the control circuit for three conveyors that start in sequence",
  right: "three conveyors in sequence (M2 on M1, M3 on M2), or no given: never two shown \x22as it stands\x22",
  run: function () { return lib.boot().then(function (x) { return J.sequence(x.N.L, "Draw the control circuit for three conveyors that start in sequence", { motors: 3 }); }); } });
// ---- floats ----------------------------------------------------------------------------------------------------
noGiven("B-fl-fill-then-drain", "Draw a control circuit that fills a tank and then drains it", "high", "no given: a fill and a drain together are neither the fill given nor the sump given");
noGiven("B-fl-fill-and-empty", "Draw the control circuit for a pump that fills a tank and a pump that empties it", "high", "no given: two pumps, one filling and one emptying");
noGiven("B-fl-filling-draining", "Draw the control circuit for filling and draining a tank with pumps and float switches", "high", "no given (fill and drain)");
shownIs("B-fl-two-floats", "Draw the control circuit for a pump that fills a tank with a high and a low float", "high",
  "two floats (the low one starts the pump, the high one stops it, the pump held in between) or no given: not one float shown \x22as it stands\x22",
  function (g) { return g.s.block && g.s.lines.filter(function (l) { return /^float/.test(l); }).length < 2 ? "shown one float: " + lib.short(g.s.lines.join(" / "), 200) : ""; });
shownIs("B-fl-solenoid-valve", "Draw the control circuit for a solenoid valve that fills a tank with a float switch", "medium",
  "a solenoid valve on the float (solenoid SOL1 ...), or no given: not a pump starter with an overload",
  function (g) { return g.s.block && g.s.lines.some(function (l) { return /^coil M1 .*pump/.test(l); }) ? "shown " + lib.short(g.s.lines.join(" / "), 200) : ""; });
shownIs("B-fl-alarm-only", "Draw the control circuit for a high level alarm light on a tank filling line", "medium",
  "an alarm light on a high-level float, or no given: not a fill pump",
  function (g) { return g.s.id === "control-fill" ? "shown the fill pump given: " + lib.short(g.s.lines.join(" / "), 200) : ""; });
shownIs("B-sp-on-off-floats", "Draw the control circuit for a sump pump with on and off floats", "high",
  "two floats (on above off, the pump held in between) or no given: not one float shown \x22as it stands\x22",
  function (g) { return g.s.block && g.s.lines.filter(function (l) { return /^float/.test(l); }).length < 2 ? "shown one float: " + lib.short(g.s.lines.join(" / "), 200) : ""; });
shownIs("B-sp-three-floats", "Draw the control circuit for a sump pump with off, on and high level alarm floats", "high",
  "three floats (off, on, alarm) or no given: not one float and a \x22pump on\x22 light",
  function (g) { return g.s.block && g.s.lines.filter(function (l) { return /^float/.test(l); }).length < 2 ? "shown one float: " + lib.short(g.s.lines.join(" / "), 200) : ""; });
noGiven("B-sp-refrigeration-pumpdown", "Draw the control circuit for a refrigeration pump-down cycle", "high",
  "no given: a refrigeration pump-down is a liquid-line solenoid and a low-pressure switch, not a sump pump on a float");
noGiven("B-sp-pumpdown-solenoid", "Draw the control circuit for a pump down system with a liquid line solenoid and a low pressure control", "high",
  "no given (refrigeration pump-down)");
// ---- starters that are not three-wire starters --------------------------------------------------------------------
noGiven("B-nt-two-wire-thermostat", "Draw a two-wire control circuit for a motor starter with a thermostat", "high", "no three-wire given: two-wire control (a thermostat closes the coil circuit) has no start button and no seal-in");
noGiven("B-nt-fan-thermostat", "Draw a fan contactor control circuit controlled by a thermostat", "high", "no three-wire given (a thermostat, two-wire)");
noGiven("B-nt-two-wire-toggle", "Draw a magnetic starter with two-wire control from a toggle switch", "high", "no three-wire given (two-wire control)");
noGiven("B-nt-hoa", "Draw a motor starter with a hand-off-auto switch", "high", "no three-wire given: a hand-off-auto starter (Lantern does not draw HOA yet; the line it sends back is its own)");
noGiven("B-nt-vfd", "Draw the control circuit for a VFD with start/stop push buttons", "high", "no motor-starter given: a drive's run command is a relay or the drive's own input, not a starter coil with an overload");
noGiven("B-nt-y-delta", "Draw a Y-delta motor starter control circuit", "high", "no given (a wye-delta starter, as star-delta is excluded)");
noGiven("B-nt-star-slash-delta", "Draw a star/delta motor starter with start and stop buttons", "high", "no given (star/delta)");
noGiven("B-nt-2-speed", "Draw a 2-speed motor starter control circuit", "high", "no given (as two-speed is excluded)");
noGiven("B-nt-dual-speed", "Draw a dual speed motor starter with start and stop buttons", "high", "no given (a two-speed starter)");
noGiven("B-nt-soft-starter", "Draw the control circuit for a soft starter with start/stop push buttons", "medium", "no motor-starter given (a soft starter's own run input)");
noGiven("B-nt-inch", "Draw a motor starter with start, stop and inch buttons", "medium", "no given (inching is jogging, which is excluded)");
noGiven("B-nt-autotransformer", "Draw a reduced voltage autotransformer motor starter control circuit", "high", "no given (a reduced-voltage starter)");
noGiven("B-nt-part-winding", "Draw a part winding motor starter control circuit with start and stop buttons", "high", "no given (a part-winding starter: two contactors and a timer)");
noGiven("B-nt-lighting-contactor", "Draw a start/stop circuit for a lighting contactor", "medium", "no motor-starter given (no motor, no overload)");
noGiven("B-nt-latch-light", "Draw a start/stop latching relay circuit for a light", "medium", "no motor-starter given (a relay latching a light)");
noGiven("B-nt-solenoid-seal", "Draw a start/stop circuit with a seal-in for a solenoid valve", "medium", "no motor-starter given (a solenoid valve)");
noGiven("B-nt-heater-contactor", "Draw a start/stop circuit for a heater contactor", "medium", "no motor-starter given (a heater has no motor overload)");
noGiven("B-nt-programmable-relay", "Draw a start/stop seal-in for a motor using a programmable relay", "medium", "no given (a programmable relay's program, as PLC is excluded)");
shownIs("B-nt-warning-horn", "Draw the control circuit for a conveyor with start and stop buttons where a warning horn sounds for 10 seconds before the conveyor starts", "medium",
  "the delayed start with its warning horn, or no given: not the plain starter shown \x22as it stands\x22",
  function (g) { return g.s.id === "control-starter" ? "shown the plain starter: " + lib.short(g.s.lines.join(" / "), 200) : ""; });
shownIs("B-nt-estop", "Draw the control circuit for a 3-phase motor starter with start/stop push buttons, an e-stop, and a run light", "low",
  "the starter fitted with the e-stop the question asks for (estop ES1), since the model is told to write it as it stands",
  function (g) { return g.s.block && !g.s.lines.some(function (l) { return /^estop/.test(l); }) ? "shown without the e-stop: " + lib.short(g.s.lines.join(" / "), 200) : ""; });
shownIs("B-sup-compressor-230-24", "Draw the control circuit for a 230 V air compressor with a pressure switch and 24 V AC control", "high",
  "supply 24 V AC (the control's), not 230 V", function (g) { var l = g.s.lines.filter(function (x) { return /^supply/.test(x); })[0] || ""; return /24 V AC/.test(l) ? "" : "shown " + (l || "no supply"); });
shownIs("B-dl-two-times", "Draw a control circuit: a 5 second warning horn, then the conveyor starts 20 seconds after the start button is pressed", "medium",
  "the timer at 20 s (the start delay), not 5 s (the horn), or no given",
  function (g) { var l = g.s.lines.filter(function (x) { return /^timer/.test(x); })[0] || ""; return g.s.block && !/20 s/.test(l) ? "shown " + l : ""; });
module.exports = C;
