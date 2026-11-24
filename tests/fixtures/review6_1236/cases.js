// cases.js -- the sixth review of 1.24.36's givens, code checks and kept circuits (written without the earlier
// reviews' cases). Each case says what is right; replay.js runs it and says AGREE or DISAGREE.
//   kind "prompt": what L.aiAct.prompt(q) shows the model.
//       want: null -> no given (Lantern's or the user's) is shown
//       want: {g: id, has: [exact lines], not: [regex strings], supply: "120 V AC" | null (no supply line) | undefined}
//   kind "build": L.aiAct.build(MAKE CONTROL block, q).
//       want: {ok: true, rungs: {id: "s[..] st[..] se[..] a[..]" parts to find}, said: regex, checked: regex}
//       want: {back: regex the problems must match, line: the "Write it:" line expected, rebuild: true (the line put in
//              place of its device's line must build clean)}
//   kind "given-builds": the given Lantern shows for q, built for q: clean, nothing sent back, optional rungs/said.
//   kind "pick": L.codeChecks.pick(q) is want ("US" or "IEC").
//   kind "kept": a circuit kept for keepQ; is it shown for q? want true/false.
//   kind "guard-prompts" / "guard-fixtures": against 1.24.35 (8cb3281).
// harm: what a DISAGREE would be (high, medium, low). note: why.
"use strict";
var Q = "\x22";
function q2(s) { return Q + s + Q; }
var C = [];
function P(id, q, want, harm, note) { C.push({ id: id, kind: "prompt", q: q, want: want, harm: harm || "high", note: note || "" }); }
function B(id, q, lines, want, harm, note) { C.push({ id: id, kind: "build", q: q, lines: lines, want: want, harm: harm || "high", note: note || "" }); }
function GB(id, q, want, harm, note) { C.push({ id: id, kind: "given-builds", q: q, want: want || {}, harm: harm || "high", note: note || "" }); }
function PK(id, q, want, harm, note) { C.push({ id: id, kind: "pick", q: q, want: want, harm: harm || "medium", note: note || "" }); }
function K(id, keepQ, lines, q, want, harm, note) { C.push({ id: id, kind: "kept", keepQ: keepQ, lines: lines, q: q, want: want, harm: harm || "high", note: note || "" }); }

var ST = "control-starter", RV = "control-reversing", SQ = "control-sequence", DS = "control-delayed-start", CP = "control-compressor",
  F1 = "control-fill", F2 = "control-fill-two", SP = "control-sump";
var STARTER = ["stop PB1 M1", "start PB2 M1", "overload OL1 M1"];

// ============================================================================================================
// A. The givens shown: right questions, in people's own words
// ============================================================================================================
// --- the three-wire starter, plain
P("p-st-run-green", "Draw a three-wire start/stop motor starter for a conveyor with a green run light", { g: ST, has: STARTER.concat(["coil M1 " + q2("conveyor starter"), "lamp LT1 M1 " + q2("run") + " green"]), supply: null });
P("p-st-magnetic-saw", "Draw a magnetic starter circuit for a table saw", { g: ST, has: STARTER.concat(["coil M1 " + q2("saw starter")]) });
P("p-st-seal-auger", "Draw a seal-in circuit for an auger", { g: ST, has: STARTER });
P("p-st-latch-blower", "Draw a latching circuit for a blower motor with start and stop buttons", { g: ST, has: STARTER.concat(["coil M1 " + q2("blower starter")]) });
P("p-st-nema1", "Draw a three-wire control circuit with a NEMA size 1 starter for a fan", { g: ST, has: STARTER });
P("p-st-lathe-estop", "Draw a motor starter for a lathe with an emergency stop", { g: ST, has: ["estop ES1"].concat(STARTER) });
P("p-st-crusher-estop", "Draw a starter circuit for a crusher with start and stop pushbuttons and an e-stop", { g: ST, has: ["estop ES1"].concat(STARTER) });
P("p-st-transfer", "Draw a start stop circuit for a transfer pump", { g: ST, has: STARTER.concat(["coil M1 " + q2("pump starter")]) });
P("p-st-barn-fan", "Draw a start stop circuit for a ventilation fan in a barn", { g: ST, has: STARTER });
P("p-st-belt", "Draw a start stop circuit for a conveyor belt", { g: ST, has: STARTER });
P("p-st-ladder", "Draw a ladder diagram for start-stop motor control", { g: ST, has: STARTER });
P("p-st-kenya", "Draw a start stop circuit for a pump in Kenya", { g: ST, has: STARTER });
P("p-st-iec", "Draw a DOL starter for a pump to IEC 60204-1", { g: ST, has: STARTER });
P("p-st-5hp", "Draw a motor starter for a 5 HP pump", { g: ST, has: STARTER });
P("p-st-halfhp", "Draw a motor starter for a 1/2 HP fan", { g: ST, has: STARTER });
P("p-st-30a", "Draw a motor starter for a pump, 30 A", { g: ST, has: STARTER });
P("p-st-belt-10m", "Draw a start stop circuit for a conveyor with a 10 m belt", { g: ST, has: STARTER });
P("p-st-2hp-dots", "Draw a motor starter for a 2 h.p. fan", { g: ST, has: STARTER }, "low", "\x222 h.p.\x22 is read as two hours (a time), so this plain question gets no given");
P("p-st-60hz", "Draw a motor starter for a fan with 2 stations, 3 phase, 60 Hz", { g: ST, has: ["stop PB1 M1 " + q2("stop, local"), "stop PB2 M1 " + q2("stop, remote"), "start PB3 M1 " + q2("start, local"), "start PB4 M1 " + q2("start, remote")] });
// --- the control voltage
P("p-v-24ctrl-480", "Draw a 3-wire motor starter for a pump with 24 V control and a 480 V motor", { g: ST, has: STARTER, supply: "24 V" });
P("p-v-ctrlvolt-120", "Draw a motor starter for a 480 V pump, control voltage 120 V", { g: ST, has: STARTER, supply: "120 V AC" });
P("p-v-coil-is", "Draw a start stop circuit for a fan; the starter coil is 120 V", { g: ST, has: STARTER, supply: "120 V AC" });
P("p-v-ctrlcircuit", "Draw a start stop circuit for a fan, control circuit, 120 V", { g: ST, has: STARTER, supply: "120 V AC" });
P("p-v-230coil", "Draw a start stop circuit for a fan with a 230 V coil", { g: ST, has: STARTER, supply: "230 V AC" });
P("p-v-230fan", "Draw a start stop circuit for a 230 V fan", { g: ST, has: STARTER, supply: null });
P("p-v-12dc", "Draw a start stop circuit for a conveyor, 12 V DC control", { g: ST, has: STARTER, supply: "12 V DC" });
P("p-v-115xfmr", "Draw a motor starter for a pump with a 115 V control transformer", { g: ST, has: STARTER, supply: "115 V AC" });
P("p-v-480-120xfmr", "Draw a motor starter for a pump with a 480/120 V control transformer", { g: ST, has: STARTER, supply: "120 V AC" });
P("p-v-480to120xfmr", "Draw a motor starter for a pump with a 480 to 120 V control transformer", { g: ST, has: STARTER, supply: "120 V AC" });
P("p-v-24dc-station", "Draw a motor starter for a 460V motor with a 24 V DC start/stop station", { g: ST, has: STARTER, supply: "24 V DC" });
P("p-v-220ctrl", "Draw a motor starter for a pump with 220 V control", { g: ST, has: STARTER, supply: "220 V AC" });
P("p-v-277ctrl", "Draw a motor starter for a pump with 277 V control", { g: ST, has: STARTER, supply: null });
P("p-v-24vac-coil", "Draw a motor starter for a pump with a coil voltage of 24 V AC", { g: ST, has: STARTER, supply: "24 V AC" });
P("p-v-400-230", "Draw a motor starter for a 3 phase 400 V pump with 230 V control", { g: ST, has: STARTER, supply: "230 V AC" });
P("p-v-24-then-240", "Draw a motor starter for a pump with 24 V control, the motor is 240 V", { g: ST, has: STARTER, supply: "24 V" });
P("p-v-120circuit", "Draw a motor starter for a fan on a 120 V circuit", { g: ST, has: STARTER, supply: null });
P("p-v-dc-contactor", "Draw a start/stop for a conveyor using a contactor with a 24 V DC coil", { g: ST, has: ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("conveyor contactor")], supply: "24 V DC" });
P("p-v-germany-230coil", "Draw a start stop circuit for a pump in Germany with a 230 V coil", { g: ST, has: STARTER, supply: "230 V AC" });
P("p-v-two-ctrl", "Draw a start stop circuit for a fan with 24 volt push buttons and 120 volt coil", { g: ST, has: STARTER, supply: null });
// the control transformer written primary / secondary: the secondary is the control's
P("p-v-xfmr-240-24", "Draw a start-stop motor starter with a control transformer 240 V / 24 V for a pump", { g: ST, has: STARTER, not: ["^supply \x22240"] }, "high", "the transformer's primary (240 V) is drawn as the control voltage; its secondary, 24 V, is the control");
P("p-v-xfmr-240-24b", "Draw a start/stop starter for a pump, control transformer 240V/24V", { g: ST, has: STARTER, not: ["^supply \x22240"] }, "high", "the primary drawn as the control voltage");
P("p-v-xfmr-208-24", "Draw a motor starter for a pump, control transformer 208 V / 24 V", { g: ST, has: STARTER, not: ["^supply \x22208"] }, "high", "the primary drawn as the control voltage");
P("p-v-xfmr-120-24", "Draw a start stop circuit for a fan with a control transformer 120 V / 24 V", { g: ST, has: STARTER, not: ["^supply \x22120"] }, "high", "the primary drawn as the control voltage");
P("p-v-xfmr-230-24", "Draw a start stop circuit for a conveyor, control transformer 230 V / 24 V", { g: ST, has: STARTER, not: ["^supply \x22230"] }, "high", "the primary drawn as the control voltage");
// --- lights
P("p-l-plain", "Draw a start stop circuit for a pump with a light", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " green"] });
P("p-l-run-stop", "Draw a start stop circuit for a pump with a run light and a stop light", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " green", "lamp LT2 M1 off " + q2("stopped") + " red"] });
P("p-l-goes-out", "Draw a start stop circuit for a pump with a light that goes out when the pump starts", { g: ST, has: ["lamp LT1 M1 off " + q2("stopped") + " red"], not: ["^lamp LT\\d M1 \x22run"] });
P("p-l-shows-stopped", "Draw a start stop circuit for a pump with a light that shows the pump is stopped", { g: ST, has: ["lamp LT1 M1 off " + q2("stopped") + " red"] });
P("p-l-comes-on-runs", "Draw a start stop circuit for a pump with a lamp which comes on when the pump runs", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " green"] });
P("p-l-green-red", "Draw a start stop circuit for a pump with a green light when running and a red light when stopped", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " green", "lamp LT2 M1 off " + q2("stopped") + " red"] });
P("p-l-red-green", "Draw a start stop circuit for a pump with a red light when running and a green light when stopped", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " red", "lamp LT2 M1 off " + q2("stopped") + " green"] });
P("p-l-on-when-off", "Draw a start stop circuit for a pump with a light that is on when the pump is off", { g: ST, has: ["lamp LT1 M1 off " + q2("stopped") + " red"] });
P("p-l-turns-off-stops", "Draw a start stop circuit for a pump with a light that turns off when the pump stops", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " green"] });
P("p-l-green-when-running", "Draw a start stop circuit for a pump with a light, green when running", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " green"] });
P("p-l-for-stopped-running", "Draw a start stop circuit for a pump with a light for stopped and a light for running", { g: ST, has: ["lamp LT1 M1 off " + q2("stopped") + " red", "lamp LT2 M1 " + q2("run") + " green"] });
P("p-l-white", "Draw a start stop circuit for a pump with a white light while the pump is running", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " white"] });
P("p-l-plural", "Draw a start stop circuit for a pump with lights", null, "high", "how many lights and which: the asker's");
P("p-l-indicators", "Draw a start stop circuit for a pump with indicator lights", null, "high");
P("p-l-illuminated", "Draw a start stop circuit for a pump with an illuminated stop button", null, "high");
P("p-l-lighted-pb", "Draw a start stop circuit for a pump with a lighted start pushbutton", null, "high");
P("p-l-in-button", "Draw a start stop circuit for a pump with a light in the start button", null, "high", "a lit start button, said another way, gets a plain run light (lamp LT1 M1 run green): a light Lantern's givens do not draw, its state guessed");
P("p-l-light-on-start-pb", "Draw a start stop circuit for a pump with a light on the start button", null, "high", "a lit start button, said another way, gets a guessed run light");
P("p-l-flash", "Draw a start stop circuit for a pump with a light that flashes when running", null, "high");
P("p-l-until-starts", "Draw a start stop circuit for a pump with a pilot light that is on until the pump starts", { g: ST, has: ["lamp LT1 M1 off " + q2("stopped") + " red"] }, "medium", "the changelog says \x22on until it starts\x22 is read; it is not (no given)");
P("p-l-overload-light", "Draw a start stop circuit for a pump with an amber light for overload", { g: ST, has: STARTER, not: ["^lamp LT\\d M1 \x22run"] });
P("p-l-trip-and-run", "Draw a start stop circuit for a pump with a run light and an overload trip light", { g: ST, has: ["lamp LT1 M1 " + q2("run") + " green"], not: ["^lamp LT2 M1"] });
P("p-l-fwd-rev-each", "Draw a forward reverse starter for a conveyor with a light for each direction", { g: RV, has: ["lamp LT1 M1 " + q2("forward") + " green", "lamp LT2 M2 " + q2("reverse") + " green"] });
P("p-l-fwd-rev-pilots", "Draw a forward reverse starter for a conveyor with forward and reverse pilot lights", { g: RV, has: ["lamp LT1 M1 " + q2("forward") + " green", "lamp LT2 M2 " + q2("reverse") + " green"] });
P("p-l-fwd-rev-one", "Draw a forward reverse starter for a conveyor with a run light", null, "high", "one run light for two directions: which contact, the asker's");
P("p-l-fwd-light-rev-light", "Draw a forward reverse starter for a fan with a forward light and a reverse light", { g: RV, has: ["coil M1 " + q2("forward"), "coil M2 " + q2("reverse")] }, "low", "a plain ask for a light each way gets no given (safe; a miss)");
// --- stations
P("p-s-both-ends", "Draw a motor starter for a conveyor with stop/start stations at both ends", { g: ST, has: ["stop PB1 M1 " + q2("stop, local"), "stop PB2 M1 " + q2("stop, remote"), "start PB3 M1 " + q2("start, local"), "start PB4 M1 " + q2("start, remote")] });
P("p-s-two-and-two", "Draw a motor starter for a conveyor with two start buttons and two stop buttons", { g: ST, has: ["stop PB2 M1 " + q2("stop, remote"), "start PB4 M1 " + q2("start, remote")] });
P("p-s-two-stops-one-start", "Draw a motor starter for a conveyor with two stop buttons and one start button", null, "high");
P("p-s-three", "Draw a motor starter for a conveyor with three start/stop stations", { g: ST, has: ["stop PB3 M1 " + q2("stop 3"), "start PB6 M1 " + q2("start 3")] });
P("p-s-two-places", "Draw a motor starter for a pump that can be started and stopped from two places", { g: ST, has: ["stop PB2 M1 " + q2("stop, remote"), "start PB4 M1 " + q2("start, remote")] });
P("p-s-local-remote", "Draw a three wire control circuit for a pump with local and remote start/stop stations", { g: ST, has: ["stop PB1 M1 " + q2("stop, local"), "start PB4 M1 " + q2("start, remote")] });
P("p-s-two-estop", "Draw a motor starter for a pump with 2 start/stop stations and an emergency stop", { g: ST, has: ["estop ES1", "stop PB2 M1 " + q2("stop, remote")] });
P("p-s-office-roof", "Draw a motor starter for a fan with start stop buttons in the office and on the roof", null, "high");
P("p-s-remote-stop", "Draw a motor starter for a conveyor with a remote stop button", null, "high");
P("p-s-estop-two-locations", "Draw a motor starter for a fan with an e-stop at two locations", null, "high", "the two locations are the e-stop's: the given draws one e-stop and two start/stop stations");
P("p-s-estop-two-places", "Draw a motor starter for a fan with an emergency stop at two places", null, "high", "one e-stop and two start/stop stations for e-stops at two places");
P("p-s-stop-two-locations", "Draw a motor starter for a pump with a stop button at 2 locations", { g: ST, hasRe: ["^stop PB1 M1", "^stop PB2 M1"], not: ["^start PB\\d M1 \x22start, remote"] }, "high", "stops at two places: the given adds a second start too");
P("p-s-stop-two-start-one", "Draw a motor starter for a pump, the stop button at two locations and the start button at one", { g: ST, hasRe: ["^stop PB1 M1", "^stop PB2 M1"], not: ["^start PB\\d M1 \x22start, remote"] }, "high", "\x22the start button at one\x22: the given draws two starts");
P("p-s-stopped-3-started-1", "Draw a motor starter for a pump that can be stopped from 3 places but started from one", { g: ST, hasRe: ["^stop PB3 M1"], not: ["^start PB\\d M1 \x22start 2"] }, "high", "\x22started from one\x22: the given draws three starts");
P("p-s-stops-at-two-places", "Draw a motor starter for a conveyor with stop buttons at two places", { g: ST, hasRe: ["^stop PB2 M1"], not: ["^start PB\\d M1 \x22start, remote"] }, "high", "stops at two places: the given adds a second start");
P("p-s-stops-2-start-panel", "Draw a motor starter for a conveyor with stops at 2 locations and the start at the panel", { g: ST, hasRe: ["^stop PB2 M1"], not: ["^start PB\\d M1 \x22start, remote"] }, "high", "\x22the start at the panel\x22: one start; the given draws two");
P("p-s-runlight-two-loc", "Draw a motor starter for a pump with a run light at two locations", null, "high", "a light at two locations is read as two start/stop stations and one light");
P("p-s-stopped-from-two", "Draw a motor starter for a pump that can be stopped from two locations", { g: ST, hasRe: ["^stop PB2 M1"], not: ["^start PB\\d M1 \x22start, remote"] }, "medium", "only stopping is said from two places; a second start is added");
P("p-s-each-end-middle", "Draw a motor starter for a conveyor with a start/stop at each end and one in the middle", null, "high");
// --- e-stop
P("p-e-mushroom-stop", "Draw a motor starter for a fan with a mushroom head stop button", { g: ST, has: ["stop PB1 M1", "start PB2 M1"], not: ["^estop"] }, "medium", "one stop button with a mushroom head: the given draws an e-stop and a stop as well");
P("p-e-no-estop", "Draw a motor starter for a fan, no e-stop needed", { g: ST, has: STARTER, not: ["^estop"] });
P("p-e-two-estops", "Draw a motor starter for a fan with two e-stops", null, "high");
// --- what the given cannot be: no given
P("p-n-explain", "Explain how a three wire start stop circuit works", null);
P("p-n-what-seal", "What is a seal-in contact in a motor starter", null);
P("p-n-why-holding", "Why does a start stop circuit need a holding contact", null);
P("p-n-wire-size", "What size wire for a motor starter control circuit", null);
P("p-n-two-wire", "Draw a two wire control circuit for a pump", null);
P("p-n-vfd", "Draw a start stop circuit for a pump with a VFD", null);
P("p-n-star-delta", "Draw a star-delta starter for a pump", null);
P("p-n-hoist", "Draw a start stop circuit for a hoist", null);
P("p-n-heater", "Draw a start stop circuit for a heater", null);
P("p-n-light-load", "Draw a contactor circuit for the lights in the barn", null);
P("p-n-two-pumps", "Draw a start stop circuit for two pumps", null);
P("p-n-pump-and-fan", "Draw a start stop circuit for a pump and a fan", null);
P("p-n-iec-tags", "Draw a start stop circuit for the pump with K1 contactor and S1 stop button", null);
P("p-n-jog", "Draw a motor starter for a pump with a jog button", null);
P("p-n-key", "Draw a motor starter for a fan with a key switch", null);
P("p-n-runs-10min", "Draw a motor starter for a fan that runs for 10 minutes", null);
P("p-n-runs-8h", "Draw a motor starter for a pump that runs 8 hours a day", null);
P("p-n-start-also-stops", "Draw a start stop circuit for a pump where the start button also stops it", null, "medium", "push-on, push-off: the three-wire starter is not that circuit");
P("p-n-garage-door", "Draw a forward reverse motor control circuit for a garage door", null);
P("p-n-rev-limits", "Draw a reversing starter for a conveyor with limit switches at each end", null);
P("p-n-rev-pb-interlock", "Draw a forward reverse starter for a pump with electrical interlocks and pushbutton interlocks", null);
P("p-n-rev-two-stations", "Draw a forward reverse starter for a conveyor with two stations", null);
P("p-n-rev-own-ol", "Draw a forward reverse circuit for a conveyor with an overload for each direction", null);
// --- reversing
P("p-r-plain", "Draw a forward reverse starter for a conveyor", { g: RV, has: ["stop PB1 all", "start PB2 M1 " + q2("forward"), "start PB3 M2 " + q2("reverse"), "interlock M1 M2", "overload OL1 M1 M2"] });
P("p-r-estop", "Draw a ladder diagram for a forward and reverse motor control with an emergency stop", { g: RV, has: ["estop ES1", "stop PB1 all"] });
P("p-r-24v", "Draw a forward-reverse control circuit for a motor with 24 V control", { g: RV, has: ["stop PB1 all"], supply: "24 V" });
P("p-r-stop-before-reverse", "Draw a forward reverse starter for a conveyor that must stop before reversing", { g: RV, has: ["stop PB1 all", "interlock M1 M2"] });
P("p-r-without-interlock", "Draw a forward reverse circuit for a conveyor without interlocks", { g: RV, has: ["interlock M1 M2"] }, "low", "kept: contrary motions are interlocked (NFPA 79, IEC 60204-1 9.3.4) and Lantern adds it anyway");
P("p-r-mech-only", "Draw a forward reverse starter for a conveyor with mechanical interlock only", { g: RV, has: ["stop PB1 all"], not: ["^interlock M1 M2$"] }, "medium", "\x22mechanical interlock only\x22: the given writes the electrical interlock as well (Lantern adds one between forward and reverse anyway)");
// --- sequence: the order read right
P("p-q-after-running", "Draw a control circuit where conveyor 2 can only start after conveyor 1 is running", { g: SQ, has: ["coil M1 " + q2("conveyor 1 starter"), "coil M2 M1 " + q2("conveyor 2 starter")] });
P("p-q-crusher-first", "Draw a control circuit for a crusher and a conveyor: the conveyor must start after the crusher is running", { g: SQ, has: ["coil M1 " + q2("crusher starter"), "coil M2 M1 " + q2("conveyor starter")] });
P("p-q-blower-before", "Draw a control circuit where the blower must be running before the pump can start", { g: SQ, has: ["coil M1 " + q2("blower starter"), "coil M2 M1 " + q2("pump starter")] });
P("p-q-unless-fan", "Draw a control circuit where the pump will not start unless the fan is running", { g: SQ, has: ["coil M1 " + q2("fan starter"), "coil M2 M1 " + q2("pump starter")] });
P("p-q-number-words", "Draw a ladder diagram for two conveyors: conveyor one must be running before conveyor two can start", { g: SQ, has: ["coil M2 M1 " + q2("conveyor 2 starter")] });
P("p-q-ordinals", "Draw a control circuit where the second pump can only start after the first pump is running", { g: SQ, has: ["coil M2 M1 " + q2("pump 2 starter")] });
P("p-q-mtags", "Draw a control circuit where M2 can only start after M1 is on", { g: SQ, has: ["coil M2 M1 " + q2("motor 2 starter")] });
P("p-q-three", "Draw a control circuit for three conveyors that start in sequence", { g: SQ, has: ["coil M2 M1 " + q2("conveyor 2 starter"), "coil M3 M2 " + q2("conveyor 3 starter")] });
P("p-q-chain", "Draw a control circuit for three conveyors: conveyor 3 starts first, then conveyor 2, then conveyor 1", { g: SQ, has: ["coil M1 " + q2("conveyor 3 starter"), "coil M3 M2 " + q2("conveyor 1 starter")] });
P("p-q-mixer-agitator", "Draw a control circuit where the mixer can only run while the agitator is running", { g: SQ, has: ["coil M1 " + q2("agitator starter"), "coil M2 M1 " + q2("mixer starter")] });
P("p-q-not-before", "Draw a control circuit: the conveyor must not start before the crusher is running", { g: SQ, has: ["coil M1 " + q2("crusher starter"), "coil M2 M1 " + q2("conveyor starter")] });
P("p-q-lights-each", "Draw a control circuit: pump 1 must be running before pump 2 starts, with a green run light for each pump", { g: SQ, has: ["lamp LT1 M1 " + q2("pump 1 run") + " green", "lamp LT2 M2 " + q2("pump 2 run") + " green"] });
P("p-q-stops-too", "Draw a control circuit where conveyor 2 can only start after conveyor 1 is running, and conveyor 1 stops conveyor 2 when it stops", null);
P("p-q-must-not-together", "Draw a control circuit where pump 2 must not run while pump 1 is running", null);
P("p-q-until-stopped", "Draw a control circuit where conveyor 2 can't start until conveyor 1 has stopped", null);
// --- sequence: the first machine's state said OFF -- the opposite of a sequence start
var SEQOFF = "the question asks that the second may start only while the first is OFF (never together); the sequence given (coil M2 M1) lets it start only while the first RUNS -- the opposite";
P("p-q-off-fan", "Draw a control circuit where fan 2 can only start when fan 1 is off", null, "high", SEQOFF);
P("p-q-off-motor-idle", "Draw a control circuit so motor 2 can only start when motor 1 is idle", null, "high", SEQOFF);
P("p-q-off-pump-not-on", "Draw a control circuit for two pumps where pump 2 can only start when pump 1 is not on", null, "high", SEQOFF);
P("p-q-off-pump-fan-not-running", "Draw a control circuit where the pump can only run when the fan is not running", null, "high", SEQOFF);
P("p-q-off-conv-not-running", "Draw a control circuit so conveyor 2 can only start when conveyor 1 is not running", null, "high", SEQOFF);
P("p-q-off-unless-off", "Draw a control circuit where conveyor 2 cannot start unless conveyor 1 is off", null, "high", SEQOFF);
P("p-q-off-while-off", "Draw a control circuit where conveyor 2 can only run while conveyor 1 is off", null, "high", SEQOFF);
P("p-q-off-pump-idle", "Draw a control circuit where pump 2 can only start when pump 1 is idle", null, "high", SEQOFF);
P("p-q-off-m-tags", "Draw a control circuit where M2 can only start when M1 is off", null, "high", SEQOFF);
P("p-q-off-ordinals", "Draw a control circuit where the second fan can only start when the first fan is off", null, "high", SEQOFF);
P("p-q-off-not-on", "Draw a ladder diagram where motor 2 can only start when motor 1 is not on", null, "high", SEQOFF);
P("p-q-off-stopped", "Draw a control circuit where conveyor 2 may only start when conveyor 1 is stopped", null);
// --- delayed start
P("p-d-5s", "Draw a control circuit for a conveyor that starts 5 seconds after the start button is pressed", { g: DS, has: ["timer TR1 " + q2("5 s") + " CR1", "coil M1 TR1 " + q2("conveyor starter"), "overload OL1 M1 CR1"], not: ["^horn"] });
P("p-d-30s-horn", "Draw a control circuit for a fan that starts 30 seconds after the start button is pressed, with a warning horn", { g: DS, has: ["timer TR1 " + q2("30 s") + " CR1", "horn AH1 CR1 TR1 off " + q2("warning")] });
P("p-d-15s-horn", "Draw a control circuit for a conveyor with a start delay of 15 seconds and a warning horn", { g: DS, has: ["timer TR1 " + q2("15 s") + " CR1"] });
P("p-d-horn-5s-then", "Draw a control circuit for a conveyor: horn sounds for 5 s then the conveyor starts", { g: DS, has: ["timer TR1 " + q2("5 s") + " CR1", "horn AH1 CR1 TR1 off " + q2("warning")] });
P("p-d-1min", "Draw a control circuit for a crusher that starts 1 minute after the start button is pressed", { g: DS, has: ["timer TR1 " + q2("1 min") + " CR1"] });
P("p-d-run-light", "Draw a control circuit for a conveyor with a delayed start relay, 10 s, with an e-stop", { g: DS, has: ["estop ES1", "timer TR1 " + q2("10 s") + " CR1"] });
P("p-d-half-second", "Draw a control circuit for a fan with a delayed start of 0.5 seconds", { g: DS, has: ["timer TR1 " + q2("0.5 s") + " CR1"] });
P("p-d-two-times", "Draw a control circuit for a conveyor with a warning horn before start, the horn sounds for 10 seconds and the conveyor starts 15 seconds after pressing start", null);
P("p-d-pre-start-no-time", "Draw a control circuit for a conveyor with a pre-start warning horn", { g: DS, has: ["horn AH1 CR1 TR1 off " + q2("warning")], not: ["^timer TR1 \x2210 s\x22"] }, "low", "no time said: Lantern writes its own 10 s into the line the model copies (CLAUDE.md: never invent a time for electrical work); a placeholder the user must set would not be copied as a setting");
P("p-d-tdr-fan", "Draw a control circuit for a fan with a time delay relay", null, "high", "what the delay does is not said (a delayed start, an off-delay run-on, a run for a time): the delayed start with Lantern's 10 s is a guess");
P("p-d-tdr-pump-starter", "Draw a motor starter for a pump with a time delay relay", null, "high", "what the delay does is not said: a delayed start is guessed");
P("p-d-tdr-blower", "Draw a control circuit for a blower with a time delay relay, start and stop buttons", null, "high", "what the delay does is not said: a delayed start is guessed");
P("p-d-tdr-stops-it", "Draw a ladder diagram for a pump with a time delay relay that stops it", null, "high", "the timer stops the pump; the given starts it late");
P("p-d-horn-also-stop", "Draw a control circuit for a conveyor where the horn sounds before start and also when it stops", null, "high", "a horn when it stops too: the given sounds it only before the start");
P("p-d-power-restored", "Draw a control circuit for a pump with a delayed start of 30 seconds after power comes on", null, "high", "a restart delay after power returns (no push buttons): the given is a push-button start");
P("p-d-on-delay-timer", "Draw a control circuit for a conveyor with an on-delay timer", null, "medium", "what the on-delay timer delays is not said");
P("p-d-keeps-running", "Draw a control circuit for a fan with a time delay relay so it keeps running after stop is pressed", null);
P("p-d-after-pump", "Draw a control circuit for a fan whose start is delayed 2 minutes after the pump starts", null);
// --- compressor
P("p-c-plain", "Draw a control circuit for an air compressor with a pressure switch", { g: CP, has: ["pressure PS1 M1 nc " + q2("opens at cut-out"), "coil M1 " + q2("compressor starter"), "overload OL1 M1"] });
P("p-c-8bar", "Draw a control circuit for an air compressor with a pressure switch that cuts out at 8 bar", { g: CP, has: ["pressure PS1 M1 nc " + q2("cut-out 8 bar")] });
P("p-c-range-light", "Draw a control circuit for an air compressor with a pressure switch, cut in at 100 psi, cut out at 125 psi, with a run light", { g: CP, has: ["pressure PS1 M1 nc " + q2("cut-out 125 psi"), "lamp LT1 M1 " + q2("run") + " green"] });
P("p-c-estop", "Draw a control circuit for an air compressor with a pressure switch and an e-stop", { g: CP, has: ["estop ES1", "pressure PS1 M1 nc " + q2("opens at cut-out")] });
P("p-c-20above", "Draw a control circuit for an air compressor with a pressure switch set to cut out 20 psi above cut in", { g: CP, has: ["pressure PS1 M1 nc " + q2("opens at cut-out")] });
P("p-c-contactor", "Draw the wiring for an air compressor contactor with a pressure switch", { g: CP, has: ["coil M1 " + q2("compressor contactor")] });
P("p-c-shop-230", "Draw a control circuit for a shop air compressor with a pressure switch, 120 psi cut-out, 230 V", { g: CP, has: ["pressure PS1 M1 nc " + q2("opens at cut-out")], supply: null });
P("p-c-refrig", "Draw a control circuit for a refrigeration compressor with a pressure switch", null);
P("p-c-low-oil", "Draw a control circuit for an air compressor with a pressure switch and a low oil pressure switch", null);
P("p-c-two", "Draw a control circuit for two air compressors with pressure switches", null);
P("p-c-well", "Draw a control circuit for a well pump with a pressure switch", null);
P("p-c-unloader", "Draw a control circuit for an air compressor with a pressure switch and an unloader valve", null);
// --- fill and sump
P("p-f-one", "Draw a control circuit for a pump that fills a water tank with a float switch", { g: F1, has: ["float FS1 M1 nc " + q2("tank full"), "coil M1 " + q2("pump starter")] });
P("p-f-trough", "Draw a control circuit for a pump to fill a cattle trough with a float switch", { g: F1, has: ["float FS1 M1 nc " + q2("tank full")] });
P("p-f-well-cistern", "Draw a control circuit for a well pump that fills a cistern with a float switch", { g: F1, has: ["float FS1 M1 nc " + q2("tank full")] });
P("p-f-tower", "Draw a control circuit for a pump that fills a water tower with a float", { g: F1, has: ["float FS1 M1 nc " + q2("tank full")] });
P("p-f-runlight", "Draw a control circuit for a pump that fills a tank with a float switch and a pump running light", { g: F1, has: ["lamp LT1 M1 " + q2("pump on") + " green"] });
P("p-f-opens-full", "Draw a control circuit for a tank fill pump with a float switch that opens when the tank is full", { g: F1, has: ["float FS1 M1 nc " + q2("tank full")] });
P("p-f-from-well", "Draw a control circuit for a pump that fills a tank from a well with a float switch", null);
P("p-f-alarm", "Draw a control circuit for a pump that fills a tank with a float switch and a high level alarm", null);
P("p-f-closes-low", "Draw a control circuit for a tank fill pump on a float, the float closes when the tank is low", null);
P("p-f2-low-high", "Draw a control circuit for a pump that fills an overhead tank, with a low float and a high float", { g: F2, has: ["float FS1 M1 nc " + q2("low level start"), "float FS2 M1 nc " + q2("high level stop")] });
P("p-f2-jobs-said", "Draw a control circuit for a pump that fills a tank: the low float starts the pump and the high float stops it", { g: F2, has: ["float FS1 M1 nc " + q2("low level start")] });
P("p-f2-start-stop-floats", "Draw a control circuit for a tank fill pump with start and stop floats", { g: F2, has: ["float FS2 M1 nc " + q2("high level stop")] });
P("p-f2-two-switches", "Draw a control circuit for a fill pump with two float switches", { g: F2, has: ["float FS2 M1 nc " + q2("high level stop")] });
P("p-f2-reversed-jobs", "Draw a control circuit for a pump that fills a tank: the high float starts the pump and the low float stops it", null);
P("p-sp-plain", "Draw the control circuit for a sump pump with a float switch", { g: SP, has: ["float FS1 M1 " + q2("pump on"), "coil M1 " + q2("pump starter")] });
P("p-sp-alarm-light", "Draw a control circuit for a sump pump with a float switch and a high water alarm light", { g: SP, has: ["float FS2 " + q2("high level alarm"), "lamp LT1 FS2 " + q2("high water") + " red"] });
P("p-sp-alarm-horn", "Draw a control circuit for a sump pump with a float switch and a high level alarm with a horn", { g: SP, has: ["float FS2 " + q2("high level alarm"), "horn AH1 FS2 " + q2("high water")] });
P("p-sp-bilge", "Draw a control circuit for a bilge pump with a float switch", { g: SP, has: ["float FS1 M1 " + q2("pump on")] });
P("p-sp-empties-pit", "Draw a control circuit for a pump that empties a pit with a float switch", { g: SP, has: ["float FS1 M1 " + q2("pump on")] });
P("p-sp-run-light", "Draw a control circuit for a sump pump with a float switch and a pump running light", { g: SP, has: ["lamp LT1 M1 " + q2("pump on") + " green"] });
P("p-sp-alarm-plain", "Draw a control circuit for a sump pump with a float switch and an alarm", null);
P("p-sp-buzzer", "Draw a control circuit for a sump pump with a float switch and a buzzer", null);
P("p-sp-overload-alarm", "Draw a control circuit for a sump pump with a float, and an alarm when the pump overloads", null);
P("p-sp-on-off-floats", "Draw a control circuit for a sump pump with an on float and an off float", null);

// --- more: alarms beside lights, sequences named otherwise, lights on the other givens
P("p-sp-horn-and-red-light", "Draw a control circuit for a sump pump with a float switch and a high water alarm that sounds a horn and lights a red light", null, "high", "the alarm's red light is drawn as a pump-running light (lamp LT1 M1 \x22pump on\x22 red) and the alarm gets only the horn");
P("p-sp-horn-and-alarm-light", "Draw a control circuit for a sump pump with a float switch, a high water alarm horn and a high water alarm light", { g: SP, has: ["horn AH1 FS2 " + q2("high water")], hasRe: ["^lamp LT\\d FS2"] }, "medium", "a horn and a light asked for the alarm: the given has the horn only, and is shown \x22as it stands\x22");
P("p-sp-alarm-red", "Draw a control circuit for a sump pump with a float switch and a high water alarm, the alarm light is red", { g: SP, has: ["lamp LT1 FS2 " + q2("high water") + " red"] });
P("p-sp-alarm-buzzer", "Draw a control circuit for a sump pump with a float switch and a high water alarm buzzer", { g: SP, has: ["horn AH1 FS2 " + q2("high water")], not: ["^lamp"] });
P("p-sp-run-and-alarm", "Draw a control circuit for a sump pump with a float switch, a high water alarm light and a pump running light", { g: SP, has: ["lamp LT1 M1 " + q2("pump on") + " green", "lamp LT2 FS2 " + q2("high water") + " red"] });
P("p-sp-alarm-for-high", "Draw a control circuit for a sump pump with a float switch and an alarm for high water", { g: SP, has: ["float FS2 " + q2("high level alarm")] });
P("p-sp-24v", "Draw a control circuit for a sump pump with a float switch, 24 V control", { g: SP, has: ["float FS1 M1 " + q2("pump on")], supply: "24 V" });
P("p-sp-beacon", "Draw a control circuit for a sump pump with a float switch and a high water alarm beacon", null);
P("p-sp-low-alarm-too", "Draw a control circuit for a sump pump with a float switch and a high water alarm and a low water alarm", null);
P("p-q-numbers-reversed", "Draw a control circuit where conveyor 1 must start after conveyor 2 is running", { g: SQ, has: ["coil M1 " + q2("conveyor 2 starter"), "coil M2 M1 " + q2("conveyor 1 starter")] });
P("p-q-letters", "Draw a control circuit where conveyor B can only start after conveyor A is running", { g: SQ, has: ["coil M1 " + q2("conveyor A starter"), "coil M2 M1 " + q2("conveyor B starter")] });
P("p-q-number-and-ordinal", "Draw a control circuit where pump 2 can only start after the first pump is running", { g: SQ, has: ["coil M2 M1 " + q2("pump 2 starter")] });
P("p-q-estop", "Draw a control circuit where M2 can only start after M1 is running, with an emergency stop", { g: SQ, has: ["estop ES1", "coil M2 M1 " + q2("motor 2 starter")] });
P("p-q-estop-stops-both", "Draw a control circuit where M2 can only start after M1 is running, with an e-stop that stops both", null);
P("p-f2-runlight", "Draw a control circuit for a pump that fills a tank with a low float and a high float and a run light", { g: F2, has: ["lamp LT1 M1 " + q2("pump on") + " green"] });
P("p-f-light-full", "Draw a control circuit for a pump that fills a tank with a float switch and a light that is on when the tank is full", null);
P("p-f-off-light", "Draw a control circuit for a pump that fills a tank with a float switch and a light when the pump is off", { g: F1, has: ["lamp LT1 M1 off " + q2("stopped") + " red"] });
P("p-c-runlight", "Draw a control circuit for an air compressor with a pressure switch and a pilot light that is on while the compressor runs", { g: CP, has: ["lamp LT1 M1 " + q2("run") + " green"] });
P("p-c-stopped-light", "Draw a control circuit for an air compressor with a pressure switch and a red light when it is stopped", { g: CP, has: ["lamp LT1 M1 off " + q2("stopped") + " red"] });
P("p-q-starts-once", "Draw a control circuit where conveyor 2 starts once conveyor 1 is running", null, "medium", "\x22starts once\x22 may be an automatic sequence (one start, the second by the first's contact): which, the asker's; the given has a start for each");
P("p-q-starts-first-then", "Draw a control circuit where the fan starts first and then the pump starts", null, "medium", "manual or automatic sequence is not said; the given has a start for each");
P("p-q-m1-first-then-m2", "Draw a control circuit where M1 starts first, then M2", null, "medium", "manual or automatic sequence is not said");
P("p-l-green-and-red", "Draw a start stop circuit for a fan with a green light and a red light", null);
P("p-st-everything", "Draw a motor starter for a pump with a green light on when running, 24 V DC control, e-stop and two stations", { g: ST, has: ["estop ES1", "stop PB2 M1 " + q2("stop, remote"), "lamp LT1 M1 " + q2("run") + " green"], supply: "24 V DC" });

// ============================================================================================================
// B. The givens as shown, built for their own question: clean, nothing sent back
// ============================================================================================================
GB("gb-starter-lights", "Draw a motor starter for a pump, control voltage 120 V, with a green run light and a red stop light", { checked: "the overload OL1 on M1" });
GB("gb-starter-two-stations-estop", "Draw a motor starter for a pump with 2 start/stop stations and an emergency stop", { checked: "the emergency stop ES1 ahead of every rung" });
GB("gb-reversing", "Draw a ladder diagram for a forward and reverse motor control with an emergency stop", { checked: "M1 and M2 locked out of each other" });
GB("gb-sequence", "Draw a control circuit for a crusher and a conveyor: the conveyor must start after the crusher is running", { rungs: { M2: "se[M1]" } });
GB("gb-sequence-three", "Draw a control circuit for three conveyors that start in sequence", { rungs: { M2: "se[M1]", M3: "se[M2]" } });
GB("gb-delayed", "Draw a control circuit for a fan that starts 30 seconds after the start button is pressed, with a warning horn", { rungs: { CR1: "a[OL1/]", M1: "a[OL1/]" }, said: "AH1 \\(warning\\) is on while CR1 is on and TR1 has not timed out" });
GB("gb-compressor", "Draw a control circuit for an air compressor with a pressure switch, cut in at 100 psi, cut out at 125 psi, with a run light", { checked: "PS1 opens as the pressure rises" });
GB("gb-fill", "Draw a control circuit for a pump that fills a water tank with a float switch", { rungs: { M1: "se[SS1,FS1/]" } });
GB("gb-fill-two", "Draw a control circuit for a pump that fills an overhead tank, with a low float and a high float", { rungs: { M1: "s[FS2/] st[FS1/]+seal" } });
GB("gb-sump-alarm", "Draw a control circuit for a sump pump with a float switch and a high water alarm light", { rungs: { LT1: "se[FS2]" } });
GB("gb-starter-24dc", "Draw a start/stop for a conveyor using a contactor with a 24 V DC coil", { said: "between \\+ and 0 V" });

// ============================================================================================================
// C. What the AI wrote, built and checked
// ============================================================================================================
// --- right circuits from many trades: drawn, nothing sent back
B("b-ok-boiler", "Draw a boiler burner control circuit with a high limit and low water cut-off", ["switch SS1 CR1 " + q2("burner on/off"), "temp TS1 CR1 nc " + q2("high limit"), "float FS1 CR1 " + q2("low water cut-off"), "coil CR1 " + q2("burner relay")], { ok: true, checked: "TS1 opens as the temperature rises" });
B("b-ok-jockey", "Draw the control circuit for a fire sprinkler jockey pump on a pressure switch", ["switch SS1 M1 " + q2("auto"), "pressure PS1 M1 nc " + q2("cut-in 140 psi, cut-out 150 psi"), "coil M1 " + q2("jockey pump starter")], { ok: true });
B("b-ok-cooler", "Draw the control for a walk-in cooler compressor with a thermostat", ["temp TS1 M1 " + q2("cut-in 5 C, cut-out 2 C"), "coil M1 " + q2("compressor contactor")], { ok: true });
B("b-ok-heater-stat", "Draw the control for an electric heater with a thermostat", ["temp TS1 M1 nc " + q2("cut-in 18 C, cut-out 21 C"), "coil M1 " + q2("heater contactor")], { ok: true });
B("b-ok-hpu", "Draw the control circuit for a hydraulic power unit pump motor with a high pressure cut-out", ["stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + q2("high pressure cut-out"), "coil M1 " + q2("pump motor starter")], { ok: true });
B("b-ok-oil-level", "Draw the control circuit for a hydraulic power unit pump with a low oil level switch", ["stop PB1 M1", "start PB2 M1", "float FS1 M1 " + q2("low oil level cut-out"), "coil M1 " + q2("pump starter")], { ok: true });
B("b-ok-vacuum-negative", "Draw a control circuit for a vacuum pump", ["switch SS1 M1", "pressure PS1 M1 " + q2("cut-in -15 inHg, cut-out -22 inHg"), "coil M1 " + q2("vacuum pump starter")], { ok: true });
B("b-ok-vacuum-inhg", "Draw a control circuit for a vacuum pump with a vacuum switch, cut-in 15 inHg, cut-out 22 inHg", ["stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + q2("cut-in 15 inHg, cut-out 22 inHg"), "coil M1 " + q2("vacuum pump starter")], { ok: true },
  "high", "vacuum read as gauge vacuum (15 then 22 inHg): the pump runs while the vacuum is weak, so the switch closes as the absolute pressure rises -- written without nc it is right; the check reads the numbers as pressure and sends back nc, a line that would run the pump only once the vacuum is deep. A vacuum's numbers can be read either way: rule 7, nothing");
B("b-ok-vacuum-kpa", "Draw a vacuum pump control with a vacuum switch: cut-in at 60 kPa vacuum, cut-out at 80 kPa vacuum", ["switch SS1 M1", "pressure PS1 M1 " + q2("cut-in 60 kPa, cut-out 80 kPa"), "coil M1 " + q2("vacuum pump starter")], { ok: true },
  "high", "kPa of vacuum read as pressure: the right line is sent back with nc");
B("b-ok-fan-stat", "Draw the control circuit for an attic exhaust fan on a thermostat", ["temp TS1 M1 " + q2("high temperature on"), "coil M1 " + q2("exhaust fan contactor")], { ok: true });
B("b-ok-well", "Draw a control circuit for a well pump with a pressure switch", ["pressure PS1 M1 nc " + q2("cut-in 40 psi, cut-out 60 psi"), "coil M1 " + q2("well pump contactor")], { ok: true });
B("b-ok-well-lwco", "Draw a control circuit for a well pump with a pressure switch and a low water cut-off", ["pressure PS1 M1 nc " + q2("cut-in 40 psi, cut-out 60 psi"), "float FS1 M1 " + q2("low water cut-off"), "coil M1 " + q2("well pump starter")], { ok: true });
B("b-ok-refrig", "Draw a control circuit for a refrigeration compressor with a low pressure cut-out", ["temp TS1 SOL1 " + q2("thermostat"), "solenoid SOL1 " + q2("liquid line"), "pressure PS1 M1 " + q2("low pressure, cut-in 25 psi, cut-out 10 psi"), "pressure PS2 M1 nc " + q2("high pressure cut-out"), "coil M1 " + q2("compressor contactor")], { ok: true });
B("b-ok-fire-pump", "Draw the control circuit for a fire pump that starts on low pressure", ["pressure PS1 M1 nc " + q2("low pressure start"), "coil M1 " + q2("fire pump starter")], { ok: true });
B("b-ok-standby", "Draw the control circuit for a duty and standby pump", ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("duty pump"), "pressure PS2 M2 nc " + q2("standby pump low pressure"), "coil M2 " + q2("standby pump")], { ok: true });
B("b-ok-pool-freeze", "Draw the control for a pool pump with freeze protection", ["switch SS1 M1", "temp TS1 M1 nc " + q2("freeze protection low temperature"), "coil M1 " + q2("pool pump")], { ok: true });
B("b-ok-heat-trace", "Draw the control for heat trace on a pipe", ["temp TS1 M1 nc " + q2("heat trace low temperature on"), "coil M1 " + q2("heat trace contactor")], { ok: true });
B("b-ok-run-relay", "Draw a control circuit for a pump with a run relay and a high pressure cut-out", ["stop PB1 CR1", "start PB2 CR1", "pressure PS1 CR1 nc " + q2("high pressure cut-out"), "coil CR1 " + q2("run relay"), "coil M1 CR1 " + q2("pump starter")], { ok: true });
B("b-ok-kiln", "Draw the control for an electric kiln with a high limit", ["switch SS1 M1", "temp TS1 M1 nc " + q2("high limit"), "coil M1 " + q2("kiln element contactor")], { ok: true });
B("b-ok-gas", "Draw a burner control with low and high gas pressure switches", ["switch SS1 CR1", "pressure PS1 CR1 " + q2("low gas pressure cut-off"), "pressure PS2 CR1 nc " + q2("high gas pressure cut-off"), "coil CR1 " + q2("burner")], { ok: true });
B("b-ok-chiller", "Draw the control for a chiller compressor with a low water temperature cut-out", ["temp TS1 M1 " + q2("low chilled water temperature cut-out"), "coil M1 " + q2("chiller compressor")], { ok: true });
B("b-ok-heat-pump", "Draw the control for a heat pump compressor with a low ambient cut-out", ["temp TS1 M1 " + q2("low ambient cut-out"), "coil M1 " + q2("heat pump compressor")], { ok: true });
B("b-ok-coil-line-nc", "Draw a hydraulic pump control with a high pressure cut-out", ["stop PB1 M1", "start PB2 M1", "pressure PS1 " + q2("high pressure cut-out"), "coil M1 PS1 nc " + q2("pump starter")], { ok: true });
B("b-ok-fill-relay", "Draw a control circuit for a pump that fills a tank with a low float and a high float", ["switch SS1 CR1", "float FS1 CR1 nc " + q2("low level start"), "float FS2 CR1 nc " + q2("high level stop"), "coil CR1 " + q2("fill relay"), "coil M1 CR1 " + q2("pump starter")], { ok: true, rungs: { CR1: "s[FS2/] st[FS1/]+seal" } });
B("b-ok-fill-full-relay", "Draw a control circuit for a pump that fills a tank with a float switch and a tank full relay", ["switch SS1 M1", "float FS1 CR1 " + q2("tank full"), "coil CR1 " + q2("tank full relay"), "coil M1 CR1 off " + q2("pump starter")], { ok: true, rungs: { CR1: "se[FS1]", M1: "se[SS1,CR1/]" } });
B("b-ok-fill-stop-button", "Draw a control circuit for a pump that fills a tank with a low float and a high float", ["stop PB1 M1", "float FS1 M1 nc " + q2("low level start"), "float FS2 M1 nc " + q2("high level stop"), "coil M1 " + q2("pump starter")], { ok: true, rungs: { M1: "st[FS1/]+seal" } });
B("b-ok-fill-dryrun", "Draw a control circuit for a pump that fills a storage tank from a well, with a dry run float in the well and a high level float in the tank", ["switch SS1 M1", "float FS1 M1 " + q2("well low level cut-off"), "float FS2 M1 nc " + q2("tank high level stop"), "coil M1 " + q2("well pump starter")], { ok: true, rungs: { M1: "se[SS1,FS1,FS2/]" } });
B("b-ok-fill-alarm-relay", "Draw a control circuit for a pump that fills a tank with a low float and a high float", ["switch SS1 M1", "float FS1 M1 nc " + q2("low level start"), "float FS2 M1 nc " + q2("high level stop"), "coil M1 " + q2("pump starter"), "float FS3 CR2 " + q2("high high level"), "coil CR2 " + q2("high level alarm relay"), "lamp LT1 CR2 " + q2("alarm") + " red"], { ok: true, rungs: { CR2: "se[FS3]" } });
B("b-ok-sump-hi", "Draw a control circuit for a sump pump", ["switch SS1 M1", "float FS1 M1 " + q2("high level safety cut-out"), "coil M1 " + q2("sump pump starter")], { ok: true });
B("b-ok-stop-all", "Draw a control circuit where conveyor 2 can only start after conveyor 1 is running", ["stop PB1 all", "start PB2 M1", "start PB3 M2", "coil M1 " + q2("conveyor 1"), "coil M2 M1 " + q2("conveyor 2")], { ok: true, said: "PB1 \\(stop, in L1\\) or OL2" });
B("b-ok-estop-open", "Draw a start stop circuit for a pump with an e-stop", ["estop ES1 no", "stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter")], { ok: true, said: "ES1 is drawn normally closed", checked: "the emergency stop ES1 ahead of every rung" });
B("b-ok-overload-light", "Draw a start stop circuit for a pump with an overload trip light", ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1", "lamp LT1 OL1 " + q2("overload trip") + " amber"], { ok: true, rungs: { LT1: "a[OL1]" } });
B("b-ok-overload-aux-relay", "Draw a start stop circuit for a pump with an overload alarm relay", ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1", "switch SS2 CR5 " + q2("alarm on"), "overload OL2 CR5 no", "coil CR5 " + q2("motor overload relay"), "horn AH1 CR5 " + q2("overload alarm")], { ok: true },
  "high", "a relay pulled in by the overload's open contact when it trips (an alarm relay named for the overload) is sent back as if it were the motor, with the line overload OL2 CR5 -- copied, the alarm relay is on whenever the motor is healthy");
B("b-ok-energise-stop-relay", "Draw a start stop circuit for a pump", ["stop PB1 CR2 no", "coil CR2 " + q2("stop relay"), "start PB2 M1", "coil M1 CR2 off " + q2("pump starter")], { ok: true },
  "medium", "a stop written open energising a relay whose closed contact drops the pump: not fail-safe, but working; the line sent back (stop PB1 CR2) pulls CR2 in whenever the stop is not pressed, so the pump can never run -- the line builds wrong. Better: say why, and the whole change (stop PB1 M1), or nothing");
B("b-ok-fault-relay", "Draw a control circuit for a pump with a low suction pressure trip", ["stop PB1 M1", "start PB2 M1", "pressure PS1 CR2 " + q2("low suction trip"), "coil CR2 " + q2("pump fault relay"), "coil M1 CR2 off " + q2("pump starter")], { ok: true });
B("b-ok-ol-aux-lamp", "Draw a start stop circuit for a pump with an overload trip light", ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1", "overload OL2 LT1 no", "lamp LT1 " + q2("overload") + " amber"], { ok: true });
B("b-ok-sump-two-floats-held", "Draw a control circuit for a sump pump with an on float and an off float", ["switch SS1 M1", "float FS1 M1 " + q2("pump off"), "float FS2 M1 " + q2("pump on"), "coil M1 " + q2("sump pump starter")], { ok: true, rungs: { M1: "s[FS1] st[FS2]+seal" } });
// --- wrong ones: back once, with the line, and the line builds right
B("b-back-boiler-hl", "Draw a boiler burner control circuit with a high limit and low water cut-off", ["switch SS1 CR1 " + q2("burner on/off"), "temp TS1 CR1 " + q2("high limit"), "float FS1 CR1 " + q2("low water cut-off"), "coil CR1 " + q2("burner relay")], { back: "high cut-out drawn normally open", line: "temp TS1 CR1 nc " + q2("high limit"), rebuild: true });
B("b-back-lwco-nc", "Draw a boiler burner control circuit with a low water cut-off", ["switch SS1 CR1 " + q2("burner on/off"), "float FS1 CR1 nc " + q2("low water cut-off"), "coil CR1 " + q2("burner relay")], { back: "low cut-out drawn normally closed", line: "float FS1 CR1 " + q2("low water cut-off"), rebuild: true });
B("b-back-jockey", "Draw the control circuit for a fire sprinkler jockey pump on a pressure switch", ["switch SS1 M1 " + q2("auto"), "pressure PS1 M1 " + q2("cut-in 140 psi, cut-out 150 psi"), "coil M1 " + q2("jockey pump starter")], { back: "high cut-out", line: "pressure PS1 M1 nc " + q2("cut-in 140 psi, cut-out 150 psi"), rebuild: true });
B("b-back-cooler-nc", "Draw the control for a walk-in cooler compressor with a thermostat", ["temp TS1 M1 nc " + q2("cut-in 5 C, cut-out 2 C"), "coil M1 " + q2("compressor contactor")], { back: "low cut-out", line: "temp TS1 M1 " + q2("cut-in 5 C, cut-out 2 C"), rebuild: true });
B("b-back-heater-open", "Draw the control for an electric heater with a thermostat", ["temp TS1 M1 " + q2("cut-in 18 C, cut-out 21 C"), "coil M1 " + q2("heater contactor")], { back: "high cut-out", line: "temp TS1 M1 nc " + q2("cut-in 18 C, cut-out 21 C"), rebuild: true });
B("b-back-hpu-open", "Draw the control circuit for a hydraulic power unit pump motor with a high pressure cut-out", ["stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + q2("high pressure cut-out"), "coil M1 " + q2("pump motor starter")], { back: "high cut-out", line: "pressure PS1 M1 nc " + q2("high pressure cut-out"), rebuild: true });
B("b-back-run-relay-open", "Draw a control circuit for a pump with a run relay and a high pressure cut-out", ["stop PB1 CR1", "start PB2 CR1", "pressure PS1 CR1 " + q2("high pressure cut-out"), "coil CR1 " + q2("run relay"), "coil M1 CR1 " + q2("pump starter")], { back: "high cut-out", line: "pressure PS1 CR1 nc " + q2("high pressure cut-out"), rebuild: true });
B("b-back-coil-line", "Draw a hydraulic pump control with a high pressure cut-out", ["stop PB1 M1", "start PB2 M1", "pressure PS1 " + q2("high pressure cut-out"), "coil M1 PS1 " + q2("pump starter")], { back: "high cut-out", line: "pressure PS1 M1 nc " + q2("high pressure cut-out"), rebuild: true });
B("b-back-compressor-range", "Draw a control circuit for an air compressor with a pressure switch", ["switch SS1 M1", "pressure PS1 M1 " + q2("cut-in 90 psi, cut-out 120 psi"), "coil M1 " + q2("compressor starter")], { back: "high cut-out", line: "pressure PS1 M1 nc " + q2("cut-in 90 psi, cut-out 120 psi"), rebuild: true });
B("b-back-compressor-bare", "Draw a control circuit for an air compressor with a pressure switch", ["switch SS1 M1", "pressure PS1 M1 " + q2("cut-out"), "coil M1 " + q2("compressor starter")], { back: "high cut-out", line: "pressure PS1 M1 nc " + q2("cut-out"), rebuild: true });
B("b-back-well-range", "Draw a control circuit for a well pump with a pressure switch", ["pressure PS1 M1 " + q2("cut-in 40 psi, cut-out 60 psi"), "coil M1 " + q2("well pump contactor")], { back: "high cut-out", line: "pressure PS1 M1 nc " + q2("cut-in 40 psi, cut-out 60 psi"), rebuild: true });
B("b-back-refrig-lp-nc", "Draw a control circuit for a refrigeration compressor with a low pressure cut-out", ["pressure PS1 M1 nc " + q2("low pressure cut-out"), "pressure PS2 M1 nc " + q2("high pressure cut-out"), "coil M1 " + q2("compressor contactor")], { back: "low cut-out", line: "pressure PS1 M1 " + q2("low pressure cut-out"), rebuild: true });
B("b-back-gas-low-nc", "Draw a burner control with low and high gas pressure switches", ["switch SS1 CR1", "pressure PS1 CR1 nc " + q2("low gas pressure cut-off"), "pressure PS2 CR1 nc " + q2("high gas pressure cut-off"), "coil CR1 " + q2("burner")], { back: "low cut-out", line: "pressure PS1 CR1 " + q2("low gas pressure cut-off"), rebuild: true });
B("b-back-stop-no", "Draw a start stop circuit for a pump", ["stop PB1 M1 no", "start PB2 M1", "coil M1 " + q2("pump starter")], { back: "stop written normally open", line: "stop PB1 M1", rebuild: true });
B("b-back-ol-no", "Draw a start stop circuit for a pump", ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1 no"], { back: "overload contact written normally open", line: "overload OL1 M1", rebuild: true });
B("b-back-stop-button", "Draw a start stop circuit for a pump", ["button PB1 M1 " + q2("stop"), "start PB2 M1", "coil M1 " + q2("pump starter")], { back: "stop written as a normally open button", line: "stop PB1 M1", rebuild: true });
B("b-back-off-on", "Draw a start stop circuit for a pump", ["button PB1 M1 " + q2("off"), "button PB2 M1 " + q2("on"), "coil M1 " + q2("pump starter")], { back: "stop written as a normally open button", line: "stop PB1 M1 " + q2("off"), rebuild: true });
B("b-back-estop-button", "Draw a start stop circuit for a pump with an e-stop", ["button PB0 M1 " + q2("e-stop"), "stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter")], { back: "emergency stop written as a normally open button", line: "estop PB0", rebuild: true });
B("b-back-fill-one-open", "Draw a control circuit for a pump that fills a tank with a float switch", ["switch SS1 M1", "float FS1 M1 " + q2("tank full"), "coil M1 " + q2("pump starter")], { back: "written normally open", line: "float FS1 M1 nc " + q2("tank full"), rebuild: true });
B("b-back-fill-two-open", "Draw a control circuit for a pump that fills a tank with a low float and a high float", ["switch SS1 M1", "float FS1 M1 " + q2("low level start"), "float FS2 M1 " + q2("high level stop"), "coil M1 " + q2("pump starter")], { back: "written normally open", line: "float FS2 M1 nc " + q2("high level stop") });
B("b-back-fill-start-open", "Draw a control circuit for a pump that fills a tank with a low float and a high float", ["switch SS1 M1", "float FS1 M1 " + q2("low level start"), "float FS2 M1 nc " + q2("high level stop"), "coil M1 " + q2("pump starter")], { back: "written normally open", line: "float FS1 M1 nc " + q2("low level start"), rebuild: true });
B("b-back-fill-hi-cutoff", "Draw a control circuit for a pump that fills a tank, with a high level cut-off float", ["stop PB1 M1", "start PB2 M1", "float FS1 M1 " + q2("high level cut-off"), "coil M1 " + q2("pump starter")], { back: "high cut-out", line: "float FS1 M1 nc " + q2("high level cut-off"), rebuild: true });
B("b-back-iec", "Draw a boiler burner control in Germany with a high limit", ["switch SS1 CR1", "temp TS1 CR1 " + q2("high limit"), "coil CR1 " + q2("burner relay")], { back: "IEC practice: IEC 60204-1:2016, 9\\.3\\.2", line: "temp TS1 CR1 nc " + q2("high limit"), rebuild: true });
B("b-back-fill-empty-open", "Draw a control circuit for a pump that fills a tank with a float switch", ["switch SS1 M1", "float FS1 M1 " + q2("tank empty"), "coil M1 " + q2("pump starter")], { back: "written normally open", line: "float FS1 M1 nc " + q2("tank empty"), rebuild: true },
  "medium", "a fill's one float named for the empty tank, written open, is drawn to run the pump only while the water is above it (it overflows); only a stop float written open goes back");

// ============================================================================================================
// D. Which code: US or IEC practice
// ============================================================================================================
PK("c-kenya", "Draw a motor starter for a pump in Kenya", "IEC");
PK("c-nigeria", "Draw a motor starter for a pump for a mine in Nigeria", "IEC");
PK("c-south-korea", "Draw a motor starter for a pump in South Korea", "IEC");
PK("c-lagos", "Draw a motor starter for a pump for a factory in Lagos, Nigeria", "IEC", "medium", "\x22in Nigeria\x22 is IEC, \x22Lagos, Nigeria\x22 falls to US: the comma form lists other countries but not the three just added");
PK("c-nairobi", "Draw a motor starter for a pump for a farm near Nairobi, Kenya", "IEC", "medium", "\x22, Kenya\x22 is not read");
PK("c-seoul", "Draw a motor starter for a pump for a plant in Seoul, South Korea", "IEC", "medium", "\x22, South Korea\x22 is not read");
PK("c-mexico-comma", "Draw a motor starter for a pump in Monterrey, Mexico", "US", "medium", "Mexico's NOM-001-SEDE is drawn from the NEC; \x22, Mexico\x22 picks IEC while \x22in Mexico\x22 picks US");
PK("c-ghana", "Draw a motor starter for a pump in Ghana", "IEC", "medium", "an IEC / BS 7671 country unlisted falls to US (as Ghana, Uganda, Tanzania, Zambia, Pakistan, Egypt, Dubai ...)");
PK("c-uganda", "Draw a motor starter for a pump in Uganda", "IEC", "medium", "an IEC country unlisted falls to US");
PK("c-pakistan", "Draw a motor starter for a pump in Pakistan", "IEC", "medium", "an IEC country unlisted falls to US");
PK("c-egypt", "Draw a motor starter for a pump in Egypt", "IEC", "medium", "an IEC country unlisted falls to US");
PK("c-latin", "Draw a motor starter for a pump for a Latin American customer", "US", "low", "Latin America is mixed (Mexico, Colombia, Venezuela and Central America follow NEC-based codes): IEC is not sure; the user's choice or US");
PK("c-nema-germany", "Draw a motor starter with a NEMA starter in Germany", "IEC");
PK("c-iec-ohio", "Draw a motor starter with an IEC contactor in Ohio", "US");
PK("c-iec-480-60", "Draw a motor starter with an IEC contactor, 480 V 60 Hz", "US", "medium", "an IEC-rated contactor is what most US panels use; 480 V 60 Hz says North America. The part's rating outranks it");
PK("c-nema-to-iec", "Draw a motor starter with a NEMA starter, to IEC 60204-1", "IEC");
PK("c-iec-per-nec", "Draw a motor starter with an IEC contactor per the NEC", "US");
PK("c-indiana", "Draw a motor starter for a pump in Indiana", "US");
PK("c-indian-river", "Draw a motor starter for a pump in Indian River County, Florida", "US");
PK("c-indian-market", "Draw a motor starter for a pump for the Indian market", "IEC");
PK("c-ce-us", "Draw a motor starter for a pump, CE marked, for a US customer", "IEC");
PK("c-nsw", "Draw a motor starter for a pump in New South Wales", "IEC");
PK("c-ontario", "Draw a motor starter for a pump in Ontario", "US");
PK("c-toronto", "Draw a motor starter for a pump in Toronto, Canada", "US");
PK("c-sydney", "Draw a motor starter for a pump in Sydney, Australia", "IEC");
PK("c-230-50", "Draw a motor starter for a pump, 230 V 50 Hz", "IEC");
PK("c-415", "Draw a motor starter for a pump, 415 V", "IEC");
PK("c-brazil", "Draw a motor starter for a pump in Brazil", "IEC");
PK("c-iec947-texas", "Draw a motor starter for a pump with an IEC 947 contactor in Texas", "US");
PK("c-nema4x-uk", "Draw a motor starter for a pump, NEMA 4X enclosure, in the UK", "IEC");
PK("c-nec-canada", "Draw a motor starter for a pump to NEC in Canada", "US");
PK("c-uk-nema", "Draw a motor starter for a pump in the UK using a NEMA starter", "IEC");
PK("c-philippines", "Draw a motor starter for a pump in the Philippines", "US");
PK("c-120ctrl-400", "Draw a motor starter for a pump with 120 V control on a 400 V motor", "US");

C.push({ id: "c-saved-iec", kind: "pick-saved", choose: "IEC", q: "Draw a motor starter for a pump", want: "IEC", harm: "medium", note: "the user's choice decides where the question names neither" });
C.push({ id: "c-saved-iec-but-us-place", kind: "pick-saved", choose: "IEC", q: "Draw a motor starter for a pump in Texas", want: "US", harm: "medium", note: "a place named outranks the user's choice" });
C.push({ id: "c-line-iec-sections", kind: "codes-line", q: "Draw a motor starter for a pump", lines: ["estop ES1", "stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1"], practice: "IEC", want: ["IEC 60204-1:2016, 7.3", "IEC 60204-1:2016, 10.7", "IEC 60204-1:2016, 9.4"], harm: "medium", note: "the line under the drawing in IEC practice names the sections read" });
C.push({ id: "c-line-us", kind: "codes-line", q: "Draw a motor starter for a pump", lines: ["estop ES1", "stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1"], practice: "US", want: ["NEC Article 430, Part III", "NFPA 79, 10.7"], harm: "medium" });

// ============================================================================================================
// E. The user's own kept circuits
// ============================================================================================================
var KRUN = ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("conveyor starter"), "overload OL1 M1", "lamp LT1 M1 " + q2("run") + " green"], KRUNQ = "Draw a start stop circuit for a conveyor with a green run light";
K("k-run-same", KRUNQ, KRUN, KRUNQ, true);
K("k-run-off-light", KRUNQ, KRUN, "Draw a conveyor start stop with a green off light", false, "high", "the kept run light (lit while it runs) is shown for a light lit while it is off");
K("k-run-idle-light", KRUNQ, KRUN, "Draw a conveyor start stop, green idle light", false, "high", "the kept run light is shown for an idle light");
K("k-run-estop", KRUNQ, KRUN, "Draw a start stop circuit for a conveyor with a green run light and an e-stop", false);
K("k-run-nolight", KRUNQ, KRUN, "Draw a start stop circuit for a conveyor", false);
var KSTOP = ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1", "lamp LT1 M1 off " + q2("stopped") + " red"], KSTOPQ = "Draw a motor starter for a pump with a red stop light";
K("k-run-stop-light", KRUNQ, KRUN, "Draw a start stop circuit for a conveyor with a green stop light", false, "high", "the kept run light is shown for a stop light");
K("k-stop-same", KSTOPQ, KSTOP, KSTOPQ, true);
K("k-stop-run", KSTOPQ, KSTOP, "Draw a motor starter for a pump with a red run light", false, "high", "the kept stopped light is shown for a run light");
K("k-stop-running", KSTOPQ, KSTOP, "Draw a motor starter for a pump with a red running light", false, "high", "the kept stopped light is shown for a running light");
var KSEQ = ["stop PB1 M1 " + q2("conveyor 1 stop"), "stop PB2 M2 " + q2("conveyor 2 stop"), "start PB3 M1 " + q2("conveyor 1 start"), "start PB4 M2 " + q2("conveyor 2 start"), "coil M1 " + q2("conveyor 1 starter"), "coil M2 M1 " + q2("conveyor 2 starter"), "overload OL1 M1", "overload OL2 M2"],
  KSEQQ = "Draw a control circuit where conveyor 2 can only start after conveyor 1 is running";
K("k-seq-same", KSEQQ, KSEQ, KSEQQ, true);
K("k-seq-reversed", KSEQQ, KSEQ, "Draw a control circuit where conveyor 1 can only start after conveyor 2 is running", false, "high", "the same words in the other order: the kept circuit holds conveyor 2 on conveyor 1, the question asks the opposite");
K("k-seq-stopped", KSEQQ, KSEQ, "Draw a control circuit where conveyor 2 can only start after conveyor 1 is stopped", false);
var KHORN = ["stop PB1 CR1", "start PB2 CR1", "relay CR1 " + q2("run"), "timer TR1 " + q2("10 s") + " CR1", "coil M1 TR1 " + q2("conveyor starter"), "overload OL1 M1 CR1", "horn AH1 CR1 TR1 off " + q2("warning")],
  KHORNQ = "Draw a control circuit for a conveyor that starts 10 seconds after the start button is pressed, with a warning horn";
K("k-horn-same", KHORNQ, KHORN, KHORNQ, true);
K("k-horn-without", KHORNQ, KHORN, "Draw a control circuit for a conveyor that starts 10 seconds after the start button is pressed, without a warning horn", false, "high", "\x22without a warning horn\x22 is shown the kept circuit with its horn");
K("k-horn-no", KHORNQ, KHORN, "Draw a control circuit for a conveyor that starts 10 seconds after the start button is pressed, no warning horn", false, "high", "\x22no warning horn\x22 is shown the kept circuit with its horn");
var KES = ["estop ES1", "stop PB1 M1", "start PB2 M1", "coil M1 " + q2("fan starter"), "overload OL1 M1"], KESQ = "Draw a motor starter for a fan with an e-stop";
K("k-estop-same", KESQ, KES, KESQ, true);
K("k-estop-without", KESQ, KES, "Draw a motor starter for a fan without an e-stop", false, "medium", "\x22without an e-stop\x22 is shown the kept circuit with its e-stop");
K("k-estop-plain", KESQ, KES, "Draw a motor starter for a fan", false);
var KFWD = ["stop PB1 all", "start PB2 M1 " + q2("forward"), "start PB3 M2 " + q2("reverse"), "coil M1 " + q2("forward"), "coil M2 " + q2("reverse"), "interlock M1 M2", "overload OL1 M1 M2"], KFWDQ = "Draw a forward reverse starter for a conveyor";
K("k-fwd-same", KFWDQ, KFWD, KFWDQ, true);
K("k-fwd-two-stations", KFWDQ, KFWD, "Draw a forward reverse starter for a conveyor with two stations", false);
K("k-fwd-iec", KFWDQ, KFWD, "Draw a forward reverse starter for a conveyor, IEC", false);
K("k-fwd-flashing", KFWDQ, KFWD, "Draw a forward reverse starter for a conveyor with flashing lights", false);
K("k-fwd-jog", KFWDQ, KFWD, "Draw a forward reverse starter for a conveyor with a jog button", false);
K("k-fwd-plugging", KFWDQ, KFWD, "Draw a forward reverse starter for a conveyor with plugging", false, "high", "plug braking (reverse to stop, with a zero-speed switch) is more than the kept circuit; one new word passes the 75% match");
var KFILL = ["switch SS1 M1 " + q2("on/off"), "float FS1 M1 nc " + q2("low level start"), "float FS2 M1 nc " + q2("high level stop"), "coil M1 " + q2("pump starter"), "overload OL1 M1"], KFILLQ = "Draw a control circuit for a pump that fills a tank with a low float and a high float";
K("k-fill-same", KFILLQ, KFILL, KFILLQ, true);
K("k-fill-empty", KFILLQ, KFILL, "Draw a control circuit for a pump that empties a tank with a low float and a high float", false);
K("k-fill-drain", KFILLQ, KFILL, "Draw a control circuit for a pump that drains a tank with a low float and a high float", false);
K("k-fill-jobs-swapped", KFILLQ, KFILL, "Draw a control circuit for a pump that fills a tank with a low float and a high float, the high float starts it", false, "high", "the floats given other jobs (Lantern's own fill given refuses this) are shown the kept low-start, high-stop circuit");
var KCOMP = ["switch SS1 M1 " + q2("on/off"), "pressure PS1 M1 nc " + q2("cut-out 120 psi"), "coil M1 " + q2("compressor starter"), "overload OL1 M1"], KCOMPQ = "Draw a control circuit for an air compressor with a pressure switch, cut-out 120 psi";
K("k-comp-same", KCOMPQ, KCOMP, KCOMPQ, true);
K("k-comp-refrig", KCOMPQ, KCOMP, "Draw a control circuit for a refrigeration compressor with a pressure switch, cut-out 120 psi", false, "high", "an air compressor's cut-out shown for a refrigeration compressor, whose switch Lantern's own givens refuse (a low-pressure switch opens as it falls)");
K("k-comp-low", KCOMPQ, KCOMP, "Draw a control circuit for an air compressor with a low pressure switch, cut-out 120 psi", false, "high", "a low-pressure switch opens as the pressure falls: the kept nc high cut-out is the opposite");
K("k-comp-vacuum", KCOMPQ, KCOMP, "Draw a control circuit for a vacuum compressor with a pressure switch, cut-out 120 psi", false, "high", "a vacuum machine shown an air compressor's cut-out");
K("k-comp-cutin", KCOMPQ, KCOMP, "Draw a control circuit for an air compressor with a pressure switch, cut-in 120 psi", false, "medium", "\x22cut-in 120 psi\x22 shown a switch labelled cut-out 120 psi");
var KST = ["stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1"], KSTQ = "Draw a motor starter for a pump";
K("k-st-same", KSTQ, KST, KSTQ, true);
K("k-st-local-remote", KSTQ, KST, "Draw a motor starter for a pump with local and remote stations", false);
K("k-st-remote", KSTQ, KST, "Draw a motor starter for a pump with a remote station", false);
K("k-st-both-ends", KSTQ, KST, "Draw a motor starter for a pump with stations at both ends", false);
K("k-st-second", KSTQ, KST, "Draw a motor starter for a pump with a second station", false);
K("k-st-hoa", KSTQ, KST, "Draw a motor starter for a pump with a hand-off-auto switch", false);
K("k-st-float", KSTQ, KST, "Draw a motor starter for a pump with a float switch", false);
K("k-st-timer", KSTQ, KST, "Draw a motor starter for a pump with a time delay", false);
K("k-st-24v", KSTQ, KST, "Draw a motor starter for a pump with a 24 V coil", false);
K("k-st-light", KSTQ, KST, "Draw a motor starter for a pump with a run light", false);
K("k-st-thermostat", KSTQ, KST, "Draw a motor starter for a pump with a thermostat", false);
K("k-st-fan", KSTQ, KST, "Draw a motor starter for a fan", false);
var K24 = ["supply " + q2("24 V DC"), "stop PB1 M1", "start PB2 M1", "coil M1 " + q2("pump starter"), "overload OL1 M1"], K24Q = "Draw a motor starter for a pump with 24 V DC control";
K("k-24dc-same", K24Q, K24, K24Q, true);
K("k-24dc-vs-ac", K24Q, K24, "Draw a motor starter for a pump with 24 V AC control", false, "high", "a kept 24 V DC circuit (drawn on + and 0 V) shown for 24 V AC control");
var KSUMP = ["switch SS1 M1 " + q2("on/off"), "float FS1 M1 " + q2("pump on"), "coil M1 " + q2("pump starter"), "overload OL1 M1"], KSUMPQ = "Draw a control circuit for a sump pump with a float switch";
K("k-sump-same", KSUMPQ, KSUMP, KSUMPQ, true);
K("k-sump-on-off-floats", KSUMPQ, KSUMP, "Draw a control circuit for a sump pump with an on float and an off float", false, "high", "the kept one-float sump shown for two floats (an on and an off)");
K("k-sump-alarm", KSUMPQ, KSUMP, "Draw a control circuit for a sump pump with a float switch and an alarm", false, "high", "the kept sump with no alarm shown for a question asking an alarm");
K("k-sump-fill", KSUMPQ, KSUMP, "Draw a control circuit for a pump that fills a tank with a float switch", false);
C.push({ id: "k-bench-running", kind: "kept-bench", keepQ: KSTQ, lines: KST, q: KSTQ, want: false, harm: "high", note: "while the bench runs the user's own are left out" });
C.push({ id: "k-not-kept-when-back", kind: "kept-refused", keepQ: "Draw a start stop circuit for a pump", lines: ["stop PB1 M1 no", "start PB2 M1", "coil M1 " + q2("pump starter")], want: false, harm: "high", note: "a circuit with a rule sent back is not kept" });

// ============================================================================================================
// F. Guards against 1.24.35
// ============================================================================================================
C.push({ id: "g-bench-prompts", kind: "guard-prompts", harm: "high", note: "every bench prompt but make-control and make-control-b equals 1.24.35's" });
C.push({ id: "g-fixture-replies", kind: "guard-fixtures", harm: "high", note: "every saved reply with a MAKE block builds as on 1.24.35" });

module.exports = C;
