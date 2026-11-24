// cases_a.js -- questions each given fits, phrased as people and models ask them. Right: the given is shown, fitted to
// the question (its stations, lights, supply, what the motor drives), and the circuit Lantern draws from it, simulated,
// does what the question asks by US ladder practice (judge.js says how each is checked).
"use strict";
var lib = require("./lib.js"), J = require("./judge.js");
var C = [];
function st(id, q, exp, harm, right) {
  C.push({ id: id, harm: harm || "high", input: q, right: right || "the three-wire starter given, " + exp.stations + " station(s), lights [" + (exp.lights || []).join(", ") + "]" + (exp.supply !== undefined ? ", supply " + (exp.supply || "none") : "") + (exp.load ? ", a " + exp.load : "") + "; it starts, holds in, stops at every stop and drops on the overload",
    run: function () { return lib.boot().then(function (x) { return J.starter(x.N.L, q, exp); }); } });
}
st("A-st-plain", "Draw the control circuit for a motor starter with start and stop push buttons", { stations: 1, lights: [], supply: "", load: "motor" });
st("A-st-3wire-pump-run", "Draw a 3-wire control circuit for a pump starter with a run light", { stations: 1, lights: ["run"], supply: "", load: "pump" });
st("A-st-fan-green", "Draw the ladder diagram for a fan motor starter: stop button, start button with a seal-in contact, overload, and a green pilot light when the fan is running", { stations: 1, lights: ["run"], load: "fan" });
st("A-st-2loc-120", "Draw a start/stop control circuit for a conveyor that can be started and stopped from two locations, with 120 V AC control", { stations: 2, lights: [], supply: "120 V AC", load: "conveyor" });
st("A-st-local-remote", "Draw a motor starter control circuit with local and remote start/stop stations", { stations: 2, lights: [] });
st("A-st-blower-stopped", "Draw the control circuit for a blower starter with start and stop buttons and a red light that is on while the blower is stopped", { stations: 1, lights: ["stopped"], load: "blower" });
st("A-st-24vdc-contactor", "Draw a seal-in circuit for a 24 V DC motor contactor with start and stop push buttons", { stations: 1, lights: [], supply: "24 V DC" });
st("A-st-magnetic-120", "Draw a magnetic starter control circuit, 120 V, with stop and start push buttons and a run light", { stations: 1, lights: ["run"], supply: "120 V AC" });
st("A-st-230", "Draw a holding contact circuit for a pump motor starter, 230 V control", { stations: 1, lights: [], supply: "230 V AC", load: "pump" });
st("A-st-two-stations", "Draw the control circuit for a conveyor starter with start and stop buttons at two stations", { stations: 2, lights: [], load: "conveyor" });
st("A-st-howwire", "How do I wire a start stop station to a magnetic starter?", { stations: 1, lights: [] }, "medium");
st("A-st-both-lights", "Draw a motor starter control circuit with start and stop buttons, a run light and a stopped light", { stations: 1, lights: ["run", "stopped"] });
st("A-st-compressor-runs", "Draw a start-stop circuit for a 10 HP compressor motor starter with a pilot light on while it runs", { stations: 1, lights: ["run"], load: "compressor" });
st("A-st-2station-fan", "Draw a 2 station start/stop control for a fan", { stations: 2, lights: [], load: "fan" });
st("A-st-24vac-fan", "Draw the start stop circuit for a 24 V AC fan contactor", { stations: 1, lights: [], supply: "24 V AC", load: "fan" });
st("A-st-red-green-words", "Draw the control circuit for a motor starter with a red light when stopped and a green light when running", { stations: 1, lights: ["run", "stopped"] });
st("A-st-not-running-off", "Draw a start/stop pump starter with a pilot light that is on while the pump is off", { stations: 1, lights: ["stopped"], load: "pump" });
st("A-st-compressor-buttons", "Draw a motor starter for an air compressor with start and stop buttons", { stations: 1, lights: [], load: "compressor" });
st("A-st-multiple", "Draw a three wire control circuit for a mixer with start/stop push buttons at multiple locations", { stations: 2, lights: [], load: "mixer" }, "medium",
  "two stations at least (stops in series, starts in parallel); a given of two stands for several");
st("A-st-bench-a", "Draw the control circuit for a motor starter: a stop push button, a start push button with a holding contact so the motor keeps running after start is let go, the overload contact, the starter coil, and a pilot light that is on while the motor runs.", { stations: 1, lights: ["run"] });
st("A-st-bench-b", "Draw the control circuit for a pump starter: a stop push button, a start push button with a holding contact, the overload contact, the contactor coil, and a pilot light that is on while the pump is stopped.", { stations: 1, lights: ["stopped"], load: "pump" });

st("A-st-2loc-run-light", "Draw a motor starter control circuit for a pump, started and stopped from two locations, with a pilot light while the pump runs", { stations: 2, lights: ["run"], load: "pump" });
function rv(id, q, exp, harm) {
  C.push({ id: id, harm: harm || "high", input: q, right: "the forward/reverse given: forward and reverse each start, neither pulls in while the other runs, one stop and the overload drop both" + (exp && exp.lights !== undefined ? ", " + exp.lights + " lights" : ""),
    run: function () { return lib.boot().then(function (x) { return J.reversing(x.N.L, q, exp); }); } });
}
rv("A-rv-interlocks", "Draw a forward/reverse motor control circuit with interlocks", { lights: 0 });
rv("A-rv-three-buttons", "Draw a reversing starter control circuit with forward, reverse and stop push buttons", { lights: 0 });
rv("A-rv-lights", "Draw a forward and reverse control for a conveyor with pilot lights for each direction", { lights: 2 });
rv("A-rv-24vdc", "Draw the control circuit for a reversing motor, 24 V DC", { supply: "24 V DC" });
rv("A-rv-both-directions", "Draw the control circuit for a hoist motor that can run in both directions", { lights: 0 });
rv("A-rv-fwd-rev", "Draw a fwd/rev ladder diagram for a 3 phase motor", { lights: 0 });
rv("A-rv-rev-fwd-120", "Draw a ladder diagram for reverse/forward control of a motor, 120 V AC, with electrical interlocks", { lights: 0, supply: "120 V AC" });

function sq(id, q, exp, harm) {
  C.push({ id: id, harm: harm || "high", input: q, right: "the sequence given: M2 cannot start until M1 runs, M1's overload or the stop drops both" + (exp && exp.labels ? ", M1 the first and M2 the one that waits" : ""),
    run: function () { return lib.boot().then(function (x) { return J.sequence(x.N.L, q, exp); }); } });
}
sq("A-sq-conveyors", "Draw a ladder diagram where conveyor 2 can only start after conveyor 1 is running", { motors: 2, labels: [/conveyor 1/, /conveyor 2/] });
sq("A-sq-motor-unless", "Draw a control circuit where motor 2 cannot start unless motor 1 is running", { motors: 2, labels: [/motor 1/, /motor 2/] });
sq("A-sq-two-in-sequence", "Draw the control circuit for two conveyors that start in sequence", { motors: 2 });
sq("A-sq-pumps-cant", "Draw a sequential start control circuit for two pumps: pump 2 can't run until pump 1 runs", { motors: 2, labels: [/pump 1/, /pump 2/] });
sq("A-sq-m1-m2", "Draw a control circuit where M2 can only start while M1 is running", { motors: 2 });

C.push({ id: "A-sq-lights", harm: "high", input: "Draw the control circuit for two conveyors that start in sequence, with a run light for each",
  right: "the sequence given with two run lights, one lit while M1 runs and one while M2 runs",
  run: function () { return lib.boot().then(function (x) { var q = "Draw the control circuit for two conveyors that start in sequence, with a run light for each", why = J.sequence(x.N.L, q, { motors: 2 }); if (why) return why; var g = lib.given(x.N.L, q), S = lib.make(g.c, {}), ls = lib.lamps(g.c); if (ls.length !== 2) return ls.length + " lights"; var m1 = lib.rungOf(g.c, "M1"), m2 = lib.rungOf(g.c, "M2"); S.tap(m1.starts[0].id); var a = ls.map(function (r) { return S.on(r.out.id); }); S.tap(m2.starts[0].id); var b = ls.map(function (r) { return S.on(r.out.id); }); return a.join() === "true,false" && b.join() === "true,true" ? "" : "lights " + a + " with M1, " + b + " with both"; }); } });
function dl(id, q, exp, harm) {
  C.push({ id: id, harm: harm || "high", input: q, right: "the delayed-start given: start pulls in the run relay and the timer, the motor starts when it times out" + (exp && exp.time ? " (" + exp.time + ")" : "") + (exp && exp.horn ? ", the warning sounds while it times" : ""),
    run: function () { return lib.boot().then(function (x) { return J.delayed(x.N.L, q, exp); }); } });
}
dl("A-dl-30s-horn", "Draw a control circuit for a motor that starts 30 seconds after the start button is pressed, with a warning horn", { time: "30 s", horn: true });
dl("A-dl-conveyor-10s", "Draw a delayed start control circuit for a conveyor, 10 second delay, with a warning horn while it waits", { time: "10 s", horn: true });
dl("A-dl-fan-2min", "Draw a time delay start control circuit for a fan, 2 minutes", { time: "2 min", horn: false });
dl("A-dl-ondelay-pump", "Draw a control circuit with an on-delay timer: press start, and the pump starts after 5 s", { time: "5 s", horn: false });
dl("A-dl-15s-24vdc", "Draw a ladder diagram for a motor that starts 15 seconds after the start push button, 24 V DC control", { time: "15 s", horn: false, supply: "24 V DC" });

function pr(id, q, exp, harm) {
  var what = exp.id === "control-compressor" ? "the compressor given: its pressure switch opens as the pressure rises to the cut-out" : exp.id === "control-fill" ? "the fill given: the float opens as the tank fills" : "the sump given: the float closes as the water rises";
  C.push({ id: id, harm: harm || "high", input: q, right: what + (exp.lights !== undefined ? ", " + exp.lights + " light(s)" : "") + (exp.label ? ", " + exp.label : "") + (exp.supply !== undefined ? ", supply " + (exp.supply || "none") : ""),
    run: function () { return lib.boot().then(function (x) { return J.process(x.N.L, q, exp); }); } });
}
var CP = { id: "control-compressor", kind: "pressure", rise: "opens" }, FL = { id: "control-fill", kind: "float", rise: "opens" }, SP = { id: "control-sump", kind: "float", rise: "closes" };
function w(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { o[k] = b[k]; }); return o; }
pr("A-cp-120psi", "Draw the control circuit for an air compressor with a pressure switch that cuts out at 120 psi", w(CP, { lights: 0, label: /cut-out 120 psi/ }));
pr("A-cp-cutin-cutout-light", "Draw the control circuit for a 5 HP air compressor with a pressure switch, cut-in 90 psi and cut-out 125 psi, and a run light", w(CP, { lights: 1, label: /cut-out 125 psi/ }));
pr("A-cp-starter-wiring", "Draw the wiring diagram for a compressor starter with a pressure switch", w(CP, { lights: 0 }));
pr("A-cp-8bar", "Draw the control circuit for an air compressor whose pressure switch cuts out at 8 bar", w(CP, { lights: 0, label: /cut-out 8 bar/ }));
pr("A-cp-240", "Draw the control circuit for an air compressor on a pressure switch, 240 V", w(CP, { lights: 0, supply: "240 V AC" }));
pr("A-fl-float", "Draw the control circuit for a pump that fills a tank with a float switch", w(FL, { lights: 0 }));
pr("A-fl-cistern-light", "Draw the control circuit for a pump filling the cistern, with a float switch and a pilot light", w(FL, { lights: 1 }));
pr("A-fl-24vdc", "Draw a tank fill pump control circuit with a float switch, 24 V DC", w(FL, { lights: 0, supply: "24 V DC" }));
pr("A-fl-reservoir", "Draw the control circuit for a pump that fills the reservoir, with a float switch", w(FL, { lights: 0 }));
pr("A-sp-float", "Draw the control circuit for a sump pump with a float switch", w(SP, { lights: 0 }));
pr("A-sp-empty-24vdc", "Draw the control circuit for a pump to empty a sump with a float switch, 24 V DC", w(SP, { lights: 0, supply: "24 V DC" }));
pr("A-sp-run-light", "Draw the control circuit for a sump pump with a float switch and a pump running light", w(SP, { lights: 1, lampRun: /pump on|run/ }));
pr("A-sp-basement-starter", "Draw a ladder diagram for a basement sump pump starter on a float", w(SP, { lights: 0 }));
pr("A-sp-drain-pit", "Draw the control circuit to drain a pit with a pump and a float switch", w(SP, { lights: 0 }));
module.exports = C;
