// review8_1236/cases.js -- the eighth review of 1.24.36's givens and code checks: what the seventh round of mends
// (ca567b7) broke against the round before it (adb8fd7). Written by a reviewer who had not seen the mends drafted,
// from the diff alone. Each case says what is RIGHT for its question, not what either version does.
//
// Case kinds:
//   t: "given"  q          -> want: the block's lines Lantern shows the model ("write it as it stands"), or null for
//                             none; accept: other answers that are also right (null where giving nothing is safe)
//   t: "build"  q, text    -> want: {code: 0} a right circuit no code check sends back; {code: /re/} one that must go
//                             back with a line matching re; okHas: a "kept" line that must be shown
//   t: "keep"   q1, text, q2 -> want: true where the circuit kept under q1 must be shown for q2, false where it must not
//   t: "pick"   q          -> want: "US" or "IEC"
//   t: "guard"             -> every bench prompt equals 1.24.35's (guard_1235.json) except make-control(-b)
// harm (optional): the harm when the case disagrees, where replay.js cannot tell it (else: a wrong given shown, a right
// circuit sent back, a kept circuit shown for another question -- high; a right given or check missed -- medium)
"use strict";
function Q(s) { return "\x22" + s + "\x22"; }
function pre(o) { var a = []; if (o && o.supply) a.push("supply " + Q(o.supply)); if (o && o.estop) a.push("estop ES1"); return a; }
// a three-wire starter
function st(o) {
  o = o || {};
  var n = o.n || 1, c = "M1", a = pre(o), i;
  if (n <= 1) a.push("stop PB1 M1", "start PB2 M1");
  else {
    for (i = 1; i <= n; i++) a.push("stop PB" + i + " M1 " + Q(n === 2 ? (i === 1 ? "stop, local" : "stop, remote") : "stop " + i));
    for (i = 1; i <= n; i++) a.push("start PB" + (n + i) + " M1 " + Q(n === 2 ? (i === 1 ? "start, local" : "start, remote") : "start " + i));
  }
  a.push("coil " + c + " " + Q((o.load || "motor") + " " + (o.dev || "starter")), "overload OL1 M1");
  return a.concat(o.lamps || []);
}
var RUN = "lamp LT1 M1 " + Q("run") + " green", STOPPED = "lamp LT1 M1 off " + Q("stopped") + " red";
// motors in sequence, names in the order they run
function sq(names, o) {
  var n = names.length, a = pre(o), i;
  for (i = 1; i <= n; i++) a.push("stop PB" + i + " M" + i + " " + Q(names[i - 1] + " stop"));
  for (i = 1; i <= n; i++) a.push("start PB" + (n + i) + " M" + i + " " + Q(names[i - 1] + " start"));
  for (i = 1; i <= n; i++) a.push("coil M" + i + (i > 1 ? " M" + (i - 1) : "") + " " + Q(names[i - 1] + " starter"));
  for (i = 1; i <= n; i++) a.push("overload OL" + i + " M" + i);
  if (o && o.lamps) for (i = 1; i <= n; i++) a.push("lamp LT" + i + " M" + i + " " + Q(names[i - 1] + " run") + " green");
  return a;
}
// a delayed start
function dl(t, load, o) {
  o = o || {};
  var a = pre(o).concat(["stop PB1 CR1", "start PB2 CR1", "relay CR1 " + Q("run"), "timer TR1 " + Q(t) + " CR1", "coil M1 TR1 " + Q(load + " " + (o.dev || "starter")), "overload OL1 M1 CR1"], o.lamps || []);
  if (o.horn) a.push("horn AH1 CR1 TR1 off " + Q("warning"));
  return a;
}
// a sump pump; o.run a run light, o.alarm the high water float, o.light its light, o.horn its horn
function sp(o) {
  o = o || {};
  var a = pre(o).concat(["switch SS1 M1 " + Q("on/off"), "float FS1 M1 " + Q("pump on"), "coil M1 " + Q("pump starter"), "overload OL1 M1"]);
  if (o.run) a.push("lamp LT1 M1 " + Q("pump on") + " green");
  if (o.alarm) {
    a.push("float FS2 " + Q("high level alarm"));
    if (o.light) a.push("lamp LT" + (o.run ? 2 : 1) + " FS2 " + Q("high water") + " red");
    if (o.horn) a.push("horn AH1 FS2 " + Q("high water"));
  }
  return a;
}
function rv(o) {
  return pre(o).concat(["stop PB1 all", "start PB2 M1 " + Q("forward"), "start PB3 M2 " + Q("reverse"), "coil M1 " + Q("forward"), "coil M2 " + Q("reverse"), "interlock M1 M2", "overload OL1 M1 M2"], (o && o.lamps) ? ["lamp LT1 M1 " + Q("forward") + " green", "lamp LT2 M2 " + Q("reverse") + " green"] : []);
}
function cp(o) {
  o = o || {};
  return pre(o).concat(["switch SS1 M1 " + Q("on/off"), "pressure PS1 M1 nc " + Q(o.co ? "cut-out " + o.co : "opens at cut-out"), "coil M1 " + Q("compressor starter"), "overload OL1 M1"], o.lamps || []);
}
function fl(o) {
  o = o || {};
  return pre(o).concat(["switch SS1 M1 " + Q("on/off")], o.two ? ["float FS1 M1 nc " + Q("low level start"), "float FS2 M1 nc " + Q("high level stop")] : ["float FS1 M1 nc " + Q("tank full")],
    ["coil M1 " + Q("pump starter"), "overload OL1 M1"], o.run ? ["lamp LT1 M1 " + Q("pump on") + " green"] : []);
}
var SM = "Draw a motor starter with start and stop buttons";
var SQ = "Draw a control circuit for two conveyors: conveyor 2 can only start after conveyor 1 is running";
var C12 = ["conveyor 1", "conveyor 2"];
function mk(lines) { return "MAKE CONTROL: " + lines[0] + "\n" + lines.slice(1).join("\n") + "\nEND"; }

var cases = [
  // ---------------------------------------------------------------- supply(): a pair is the control's only beside
  // "control transformer", its lower written in volts; any other pair set aside
  { id: "sup-01", t: "given", q: SM + " and a 480/120 V control transformer", want: st({ supply: "120 V AC" }) },
  { id: "sup-02", t: "given", q: SM + " and a 480 V / 120 V control transformer", want: st({ supply: "120 V AC" }), accept: [st()] },
  { id: "sup-03", t: "given", q: SM + ", 120 V to 24 V control transformer", want: st({ supply: "24 V AC" }), accept: [st()] },
  { id: "sup-04", t: "given", q: "Draw a starter for a 460/230 V motor with start and stop buttons and 24 V control", want: st({ supply: "24 V" }), accept: [st()] },
  { id: "sup-05", t: "given", q: SM + " and a 480 V/24 V DC control transformer", want: st(), accept: [st({ supply: "24 V DC" }), null], why: "the question says 24 V DC: an AC supply is not what it asks" },
  { id: "sup-06", t: "given", q: SM + " and a 120 V AC / 24 V DC control transformer", want: st(), accept: [st({ supply: "24 V DC" }), null], why: "24 V DC asked, 24 V AC handed over" },
  { id: "sup-07", t: "given", q: SM + "; control transformer 120/24 V DC", want: st({ supply: "24 V DC" }), accept: [st(), null] },
  { id: "sup-08", t: "given", q: SM + " and a 230 V / 24 V DC control transformer", want: st(), accept: [st({ supply: "24 V DC" }), null], why: "24 V DC asked, 24 V AC handed over" },
  { id: "sup-09", t: "given", q: SM + ", control transformer 230 V / 24 V DC", want: st(), accept: [st({ supply: "24 V DC" }), null], why: "24 V DC asked, 24 V AC handed over" },
  { id: "sup-10", t: "given", q: SM + ", control transformer 480 V to 24 V dc", want: st(), accept: [st({ supply: "24 V DC" }), null], why: "24 V DC asked, 24 V AC handed over" },
  { id: "sup-11", t: "given", q: "Draw a pump starter with start and stop buttons for a 208-230 V pump with 24 V control", want: st({ supply: "24 V", load: "pump" }), accept: [st({ load: "pump" })] },
  { id: "sup-12", t: "given", q: SM + " and a control transformer, 480/240 V motor", want: st(), accept: [null], why: "480/240 V is the motor's: no control voltage is said" },
  { id: "sup-13", t: "given", q: SM + " and a 24 V control transformer (480 V to 24 V)", want: st({ supply: "24 V AC" }), accept: [st()] },
  { id: "sup-14", t: "given", q: SM + " for a 230/460 V motor", want: st() },
  { id: "sup-15", t: "given", q: SM + ", 120 V/60 Hz control", want: st(), accept: [st({ supply: "120 V AC" })] },
  { id: "sup-16", t: "given", q: SM + ", control transformer 120 V/24", want: st(), accept: [st({ supply: "24 V AC" })] },
  { id: "sup-17", t: "given", q: SM + ", 24 V DC control", want: st({ supply: "24 V DC" }) },
  { id: "sup-18", t: "given", q: SM + ", 120 V control transformer, 480 V motor", want: st({ supply: "120 V AC" }) },
  { id: "sup-19", t: "given", q: SM + ", 480-120 V control transformer", want: st({ supply: "120 V AC" }) },
  { id: "sup-20", t: "given", q: SM + ", 480 to 120 volt control transformer", want: st({ supply: "120 V AC" }) },
  { id: "sup-21", t: "given", q: SM + " and a 120 V coil, motor 460/230 V", want: st({ supply: "120 V AC" }), accept: [st()] },
  { id: "sup-22", t: "given", q: SM + ", control transformer: 480 V / 120 V", want: st({ supply: "120 V AC" }), accept: [st()] },
  { id: "sup-23", t: "given", q: "Draw a conveyor starter with start and stop buttons and a 480 V : 120 V control transformer", want: st({ supply: "120 V AC", load: "conveyor" }), accept: [st({ load: "conveyor" })] },
  { id: "sup-24", t: "given", q: SM + " with 24 V control for a 120 - 240 V motor", want: st({ supply: "24 V" }), accept: [st()] },
  { id: "sup-25", t: "given", q: SM + ", 24 V control, 230 V-400 V motor", want: st({ supply: "24 V" }), accept: [st()] },
  { id: "sup-26", t: "given", q: SM + ", 24 V - 10 A control", want: st(), accept: [st({ supply: "24 V" })] },
  { id: "sup-27", t: "given", q: "Draw a forward/reverse starter for a 460/230 V motor with 120 V control", want: rv({ supply: "120 V AC" }), accept: [rv()] },
  { id: "sup-28", t: "given", q: "Draw a forward and reverse starter with a 480/120 V control transformer", want: rv({ supply: "120 V AC" }) },
  { id: "sup-29", t: "given", q: "Draw a sump pump control circuit with a 24 V DC control", want: sp({ supply: "24 V DC" }) },
  { id: "sup-30", t: "given", q: "Draw a tank fill pump control circuit with two floats, 24 V control", want: fl({ supply: "24 V", two: true }) },
  { id: "sup-31", t: "given", q: "Draw a pump starter with start and stop buttons for a 480 V pump with a 480/120 V control transformer", want: st({ supply: "120 V AC", load: "pump" }), accept: [st({ load: "pump" })] },
  { id: "sup-32", t: "given", q: SM + ", 480 V motor, 120 V control", want: st({ supply: "120 V AC" }) },
  { id: "sup-33", t: "given", q: SM + ", 230/400 V supply, control transformer 24 V", want: st({ supply: "24 V" }), accept: [st(), st({ supply: "24 V AC" })] },
  { id: "sup-34", t: "given", q: "Draw a pump starter with start and stop buttons and a 120 V/24 V control transformer", want: st({ supply: "24 V AC", load: "pump" }), accept: [st({ load: "pump" })] },
  { id: "sup-35", t: "given", q: "Draw a fan starter with start and stop buttons and a 600 V to 120 V control transformer", want: st({ supply: "120 V AC", load: "fan" }), accept: [st({ load: "fan" })] },
  { id: "sup-36", t: "given", q: "Draw a fan starter with start and stop buttons and a 480/277 V control transformer", want: st({ load: "fan" }), accept: [null] },
  { id: "sup-37", t: "given", q: SM + ", 24 V AC control transformer", want: st({ supply: "24 V AC" }) },
  { id: "sup-38", t: "given", q: SM + ", control voltage 24 V AC", want: st({ supply: "24 V AC" }) },
  { id: "sup-39", t: "given", q: SM + ", an e-stop and 24 V DC control", want: st({ supply: "24 V DC", estop: true }) },
  { id: "sup-40", t: "given", q: "Draw a 3-wire control circuit for a fan with a 120 V coil", want: st({ supply: "120 V AC", load: "fan" }) },

  // ---------------------------------------------------------------- stations(): cut at "and" before start or stop
  { id: "sta-01", t: "given", q: SM + " at two locations", want: st({ n: 2 }) },
  { id: "sta-02", t: "given", q: "Draw a pump starter with an e-stop and start and stop buttons at two locations", want: null, why: "an e-stop at each of the two places is as likely (NFPA 79 puts one at each operator station): one e-stop drawn is a guess" },
  { id: "sta-03", t: "given", q: "Draw a pump starter with an emergency stop and start/stop buttons at two places", want: null, why: "as sta-02" },
  { id: "sta-04", t: "given", q: "Draw a pump starter with an E stop and start and stop buttons at two locations", want: null },
  { id: "sta-05", t: "given", q: "Draw a pump starter with an estop and start and stop buttons at two locations", want: null, why: "as sta-02" },
  { id: "sta-06", t: "given", q: "Draw a conveyor starter with a run light and push buttons at two locations", want: null, why: "a run light at each station is as likely: one light drawn is a guess" },
  { id: "sta-07", t: "given", q: "Draw a conveyor starter with a green run light and start and stop buttons at two locations", want: null, why: "as sta-06" },
  { id: "sta-08", t: "given", q: "Draw a motor starter with stop buttons and start buttons at two locations", want: st({ n: 2 }), harm: "medium", why: "plain: two stops and two starts" },
  { id: "sta-09", t: "given", q: "Draw a motor starter with a stop button and start button at two locations", want: st({ n: 2 }), harm: "medium" },
  { id: "sta-10", t: "given", q: "Draw a motor starter with a start and a stop button at two locations", want: st({ n: 2 }), harm: "medium" },
  { id: "sta-11", t: "given", q: "Draw a motor starter with start/stop push buttons at three stations", want: st({ n: 3 }) },
  { id: "sta-12", t: "given", q: "Draw a motor starter with two start/stop stations", want: st({ n: 2 }) },
  { id: "sta-13", t: "given", q: "Draw a motor starter with stop and start buttons at two locations", want: st({ n: 2 }) },
  { id: "sta-14", t: "given", q: "Draw a motor starter with a start button and stop buttons at two locations", want: null, why: "one start, stops at two places: not the given's stations" },
  { id: "sta-15", t: "given", q: "Draw a motor starter with stop buttons at two places and a start button", want: null },
  { id: "sta-16", t: "given", q: "Draw a motor starter with start and stop at two locations and a single start at the panel", want: null },
  { id: "sta-17", t: "given", q: "Draw a motor starter with an e-stop and start/stop stations at two locations", want: null, why: "as sta-02" },
  { id: "sta-18", t: "given", q: "Draw a fan starter with a red stop and a green start button at two locations", want: st({ n: 2, load: "fan" }), accept: [null] },
  { id: "sta-19", t: "given", q: "Draw a motor starter with start and stop push buttons at both ends", want: st({ n: 2 }) },
  { id: "sta-20", t: "given", q: "Draw a conveyor starter with start and stop buttons at both ends and an e-stop", want: st({ n: 2, estop: true, load: "conveyor" }), accept: [null] },
  { id: "sta-21", t: "given", q: "Draw a motor starter with local and remote start/stop stations", want: st({ n: 2 }) },
  { id: "sta-22", t: "given", q: "Draw a motor starter with a run light and local and remote start/stop stations", want: st({ n: 2, lamps: [RUN] }), accept: [null] },
  { id: "sta-23", t: "given", q: SM + " at two locations and a run light", want: st({ n: 2, lamps: [RUN] }), accept: [null] },
  { id: "sta-24", t: "given", q: "Draw a motor starter, an e-stop, and start and stop at two locations", want: st({ n: 2, estop: true }), accept: [null] },
  { id: "sta-25", t: "given", q: "Draw a motor starter with an e-stop and stop and start buttons at two locations", want: null, why: "as sta-02" },
  { id: "sta-26", t: "given", q: "Draw a motor starter with an e-stop and push buttons at two locations", want: null, why: "as sta-02" },
  { id: "sta-27", t: "given", q: "Draw a motor starter with a stop and start at two locations", want: st({ n: 2 }) },
  { id: "sta-28", t: "given", q: "Draw a motor starter with start-stop push buttons at 2 locations", want: st({ n: 2 }) },
  { id: "sta-29", t: "given", q: "Draw a conveyor starter with start and stop buttons at two locations and an e-stop at each", want: null },
  { id: "sta-30", t: "given", q: SM + " at two locations and a run light at each", want: null },
  { id: "sta-31", t: "given", q: SM + " at two locations with an e-stop at each location", want: null },
  { id: "sta-32", t: "given", q: "Draw a conveyor starter with an e-stop at each station and start and stop buttons at two locations", want: null },
  { id: "sta-33", t: "given", q: "Draw a motor starter with a horn and start and stop buttons at two locations", want: null },
  { id: "sta-34", t: "given", q: "Draw a starter with one start button and stop buttons at two locations", want: null },

  // ---------------------------------------------------------------- the sequence: stopSaid(), offPart(), machines()
  { id: "seq-01", t: "given", q: SQ, want: sq(C12) },
  { id: "seq-02", t: "given", q: SQ + ". Both stop when the stop button is pressed.", want: null },
  { id: "seq-03", t: "given", q: SQ + "; the stop button stops the conveyors", want: null, why: "one stop button for both: the given draws a stop for each" },
  { id: "seq-04", t: "given", q: SQ + "; the stop button stops the first conveyor and the second", want: null, why: "one stop for both" },
  { id: "seq-05", t: "given", q: SQ + "; pressing the stop button stops the two conveyors", want: null },
  { id: "seq-06", t: "given", q: SQ + "; the stop button stops both", want: null },
  { id: "seq-07", t: "given", q: "Draw a control circuit for two pumps: pump 2 can only start after pump 1 is running; the stop button stops the pumps", want: null, why: "one stop for both" },
  { id: "seq-08", t: "given", q: "Draw a control circuit for two fans: fan 2 can only start after fan 1 is running; a stop button stops the fans", want: null, why: "one stop for both" },
  { id: "seq-09", t: "given", q: SQ + "; the stop button stops the motors", want: null, why: "one stop for both" },
  { id: "seq-10", t: "given", q: SQ + ", and the stop button stops it", want: null, why: "one stop button, and which it stops not sure" },
  { id: "seq-11", t: "given", q: SQ + "; conveyor 1 has start, stop and conveyor 2 has start only", want: null, why: "conveyor 2 has no stop: the given gives it one" },
  { id: "seq-12", t: "given", q: SQ + ", each with a start button and a stop button", want: sq(C12) },
  { id: "seq-13", t: "given", q: SQ + ", each with a start button and a stop button at the panel", want: sq(C12), harm: "medium" },
  { id: "seq-14", t: "given", q: SQ + ", each with a stop button for it and a start button", want: sq(C12), harm: "medium" },
  { id: "seq-15", t: "given", q: SQ + ", each with a stop button on the conveyor", want: sq(C12), harm: "medium" },
  { id: "seq-16", t: "given", q: SQ + ", each has start, stop buttons", want: sq(C12), accept: [null] },
  { id: "seq-17", t: "given", q: SQ + ", with a start, stop for each", want: sq(C12), accept: [null] },
  { id: "seq-18", t: "given", q: SQ + "; the stop button stops the conveyor it is on", want: sq(C12), accept: [null] },
  { id: "seq-19", t: "given", q: SQ + ", each with a red stop button", want: sq(C12) },
  { id: "seq-20", t: "given", q: "Draw a control circuit for two conveyors: conveyor 2 can only start after conveyor 1, the feed conveyor, is running", want: sq(C12) },
  { id: "seq-21", t: "given", q: "Draw a control circuit for two pumps: pump 2 can only start when pump 1, the lead pump, is off", want: null },
  { id: "seq-22", t: "given", q: "Draw a control circuit for two conveyors: conveyor 2 can only start after conveyor 1, which feeds it, has stopped", want: null, why: "after conveyor 1 has stopped: not a sequence start" },
  { id: "seq-23", t: "given", q: "Draw a control circuit for two conveyors: conveyor 2 can only start after conveyor 1, with its stop and start, is running", want: sq(C12), accept: [null] },
  { id: "seq-24", t: "given", q: "Draw a control circuit for two conveyors: conveyor 2 can only start after conveyor 1, the first one, is running", want: sq(C12) },
  { id: "seq-25", t: "given", q: "Draw a sequence start control circuit for the conveyors, each with a start and stop button", want: null, why: "how many conveyors is not said: two are invented" },
  { id: "seq-26", t: "given", q: "Draw a control circuit so the fans must start in order, each with a start and stop button", want: null, why: "how many fans is not said" },
  { id: "seq-27", t: "given", q: "Draw an interlocked start control circuit for the conveyors", want: null, why: "how many conveyors is not said" },
  { id: "seq-28", t: "given", q: "Draw a control circuit for conveyors that start in sequence", want: null, why: "how many conveyors is not said" },
  { id: "seq-29", t: "given", q: "Draw a control circuit for pumps that must start in sequence", want: null, why: "how many pumps is not said" },
  { id: "seq-30", t: "given", q: "Draw a sequential start control circuit for the motor starters", want: null, why: "how many motors is not said" },
  { id: "seq-31", t: "given", q: "Draw a control circuit for compressors that start in sequence", want: null, why: "how many compressors is not said" },
  { id: "seq-32", t: "given", q: "Draw a control circuit where the pump can only start after the fan is running", want: sq(["fan", "pump"]) },
  { id: "seq-33", t: "given", q: "Draw a control circuit for the motors in sequence: motor 2 can only start after motor 1 is running", want: sq(["motor 1", "motor 2"]) },
  { id: "seq-34", t: "given", q: "Draw a control circuit for the conveyor and the crusher: the conveyor can only start after the crusher is running", want: sq(["crusher", "conveyor"]) },
  { id: "seq-35", t: "given", q: "Draw a control circuit for two conveyors: conveyor 2 must not start until conveyor 1 is running", want: sq(C12) },
  { id: "seq-36", t: "given", q: "Draw a control circuit so the conveyors can only start after the crusher is running", want: null, why: "the conveyors: more than one, how many not said; one is drawn" },
  { id: "seq-37", t: "given", q: "Draw a control circuit for two pumps: pump 2 can only start after pump 1 is running, each with a stop button and a start button", want: sq(["pump 1", "pump 2"]) },
  { id: "seq-38", t: "given", q: "Draw a control circuit for two fans: fan 2 can only start after fan 1 is running", want: sq(["fan 1", "fan 2"]) },
  { id: "seq-39", t: "given", q: "Draw a control circuit for three conveyors that start in sequence", want: sq(["conveyor 1", "conveyor 2", "conveyor 3"]) },
  { id: "seq-40", t: "given", q: SQ + ", with an e-stop", want: sq(C12, { estop: true }) },
  { id: "seq-41", t: "given", q: SQ + ", 24 V control", want: sq(C12, { supply: "24 V" }) },
  { id: "seq-42", t: "given", q: SQ + ", with green run lights for each", want: sq(C12, { lamps: true }) },
  { id: "seq-43", t: "given", q: SQ + "; M1 and M2 stop when the stop button is pushed", want: null },
  { id: "seq-44", t: "given", q: SQ + "; everything stops when the stop button is pressed", want: null },
  { id: "seq-45", t: "given", q: SQ + "; the stop button stops conveyor 2 only", want: null },
  { id: "seq-46", t: "given", q: "Draw a control circuit for conveyor 1 and conveyor 2, conveyor 2 can only start after conveyor 1 is running, stop conveyor 1 stops both", want: null },

  // ---------------------------------------------------------------- the delayed start
  { id: "del-01", t: "given", q: "Draw a delayed start control circuit: the pump starts 30 seconds after the supply comes on", want: null, why: "timed from the supply coming on, not from a start button" },
  { id: "del-02", t: "given", q: "Draw a delayed start control circuit: the pump starts 30 seconds after the transformer comes on", want: null, why: "timed from power on" },
  { id: "del-03", t: "given", q: "Draw a delayed start control circuit: the fan starts 30 seconds after the control comes on", want: null, why: "timed from power on" },
  { id: "del-04", t: "given", q: "Draw a delayed start control circuit: the fan starts 30 seconds after the panel comes on", want: null, why: "timed from power on" },
  { id: "del-05", t: "given", q: "Draw a delayed start control circuit: the fan starts 30 seconds after the machine comes on", want: null, why: "timed from another machine" },
  { id: "del-06", t: "given", q: "Draw a delayed start control circuit: the pump starts 30 seconds after the control voltage comes on", want: null, why: "timed from power on" },
  { id: "del-07", t: "given", q: "Draw a delayed start control circuit: the pump starts 30 seconds after the starter comes on", want: null, why: "timed from another starter" },
  { id: "del-08", t: "given", q: "Draw a delayed start control circuit: the compressor starts 30 seconds after the contactor comes on", want: null, why: "timed from another contactor" },
  { id: "del-09", t: "given", q: "Draw a delayed start control circuit: the fan starts 30 seconds after the machine starts", want: null, why: "timed from another machine" },
  { id: "del-10", t: "given", q: "Draw a delayed start control circuit: the fan starts 30 seconds after the supply is on", want: null, why: "timed from power on" },
  { id: "del-11", t: "given", q: "Draw a delayed start control circuit: the conveyor starts 10 seconds after the pump starts", want: null },
  { id: "del-12", t: "given", q: "Draw a delayed start control circuit: the pump starts 30 seconds after power comes on", want: null },
  { id: "del-13", t: "given", q: "Draw a delayed start control circuit: the pump starts 30 seconds after the power comes back on", want: null },
  { id: "del-14", t: "given", q: "Draw a delayed start control circuit: a horn comes on for 10 seconds, then the conveyor starts", want: dl("10 s", "conveyor", { horn: true }), accept: [null] },
  { id: "del-15", t: "given", q: "Draw a delayed start control circuit: the conveyor starts 10 seconds after the start button is pressed", want: dl("10 s", "conveyor") },
  { id: "del-16", t: "given", q: "Draw a control circuit for a conveyor that starts 10 seconds after start is pressed, with a warning horn while it waits", want: dl("10 s", "conveyor", { horn: true }) },
  { id: "del-17", t: "given", q: "Draw a control circuit where the motor starts 5 seconds after the start button is pressed", want: dl("5 s", "motor") },
  { id: "del-18", t: "given", q: "Draw a delayed start control circuit for a pump: it starts 20 seconds after the start button is pressed, with a stop button", want: dl("20 s", "pump") },
  { id: "del-19", t: "given", q: "Draw a delayed start control circuit for a pump: it starts 20 seconds after the start button is pressed, with a stop button at the panel", want: dl("20 s", "pump"), harm: "medium" },
  { id: "del-20", t: "given", q: "Draw a delayed start control circuit for a pump: it starts 20 seconds after the start button is pressed; it stops when the stop button is pressed", want: dl("20 s", "pump"), accept: [null] },
  { id: "del-21", t: "given", q: "Draw a delayed start control circuit for a pump: it starts 20 seconds after the start button is pressed; the stop button stops it", want: dl("20 s", "pump"), accept: [null] },
  { id: "del-22", t: "given", q: "Draw a delayed start control circuit for a fan: it starts 20 seconds after the start button is pressed, and the stop button stops the fan", want: dl("20 s", "fan"), accept: [null] },
  { id: "del-23", t: "given", q: "Draw a delayed start control circuit for a fan: it starts 20 seconds after the start button is pressed, and the stop button stops the fan and the pump", want: null },
  { id: "del-24", t: "given", q: "Draw a delayed start control circuit for the pumps: they start 20 seconds after the start button is pressed", want: null, why: "the pumps: more than one" },
  { id: "del-25", t: "given", q: "Draw a delayed start control circuit: the conveyor starts 15 seconds after the start button is pressed and the horn comes on while it waits", want: dl("15 s", "conveyor", { horn: true }), accept: [null] },
  { id: "del-26", t: "given", q: "Draw a delayed start control circuit: the conveyor starts 10 seconds after the crusher is running", want: null },
  { id: "del-27", t: "given", q: "Draw a delayed start control circuit for a conveyor: it starts 10 seconds after start is pressed; it stops 5 minutes after the stop button is pressed", want: null },
  { id: "del-28", t: "given", q: "Draw a delayed start control circuit: the conveyor starts 10 seconds after the start button is pressed, 24 V DC control", want: dl("10 s", "conveyor", { supply: "24 V DC" }) },
  { id: "del-29", t: "given", q: "Draw a delayed start control circuit: the conveyor starts 10 seconds after the start button is pressed, with an e-stop", want: dl("10 s", "conveyor", { estop: true }) },
  { id: "del-30", t: "given", q: "Draw a delayed start control circuit: the conveyor starts 10 seconds after the start button is pressed, with a green run light", want: dl("10 s", "conveyor", { lamps: [RUN] }) },
  { id: "del-31", t: "given", q: "Draw a delayed start control circuit: the pump starts 30 seconds after the main switch comes on", want: null },

  // ---------------------------------------------------------------- the starter: read(), its not-list, plurals
  { id: "lit-01", t: "given", q: "Draw a motor starter with a start/stop push button station and a green run light", want: st({ lamps: [RUN] }), harm: "medium", why: "a start-stop station is two buttons" },
  { id: "lit-02", t: "given", q: "Draw a motor starter with a start-stop pushbutton station", want: st(), harm: "medium" },
  { id: "lit-03", t: "given", q: "Draw a motor starter with a start/stop button", want: null, why: "one button that starts and stops is not sure" },
  { id: "lit-04", t: "given", q: "Draw a motor starter with a start stop button station", want: st(), harm: "medium" },
  { id: "lit-05", t: "given", q: "Draw a motor starter with start/stop push buttons", want: st() },
  { id: "lit-06", t: "given", q: "Draw a motor starter with a start and stop push button", want: st() },
  { id: "lit-07", t: "given", q: "Draw a 3-wire motor starter with a start-stop station", want: st() },
  { id: "lit-08", t: "given", q: "Draw a motor starter with one start/stop button that starts it and stops it", want: null },
  { id: "lit-09", t: "given", q: "Draw a motor starter with a latching push button", want: null },
  { id: "lit-10", t: "given", q: SM + "; push it again to stop", want: null },
  { id: "lit-11", t: "given", q: SM + ", also a stop button at the panel", want: null },
  { id: "lit-12", t: "given", q: "Draw a motor starter with push to start, push to stop", want: null },
  { id: "lit-13", t: "given", q: "Draw a motor starter with the same push button for start and stop", want: null },
  { id: "lit-14", t: "given", q: "Draw a motor starter with start and stop push buttons, the start is a latching type", want: null, why: "a latching (maintained) start is not the given's momentary start" },
  { id: "lit-15", t: "given", q: "Draw a motor starter with a stop button that has a red light in it and a start button", want: null },
  { id: "lit-16", t: "given", q: SM + " and a lit-up start button", want: null },
  { id: "lit-17", t: "given", q: SM + ", start button illuminated", want: null },
  { id: "lit-18", t: "given", q: SM + " and a green run light", want: st({ lamps: [RUN] }) },
  { id: "lit-19", t: "given", q: SM + " and a red stopped light", want: st({ lamps: [STOPPED] }) },
  { id: "lit-20", t: "given", q: SM + ", a green run light and a red stopped light", want: st({ lamps: [RUN, "lamp LT2 M1 off " + Q("stopped") + " red"] }) },
  { id: "lit-21", t: "given", q: "Draw a motor starter with start and stop pushbuttons and a pilot light that is on while the motor runs", want: st({ lamps: [RUN] }) },
  { id: "lit-22", t: "given", q: SM + " and a run light; no lights in the buttons", want: st({ lamps: [RUN] }), accept: [null], why: "a run light is asked for: a block without it drops it" },
  { id: "lit-23", t: "given", q: SM + " and a green run light that glows when running", want: null },
  { id: "lit-24", t: "given", q: "Draw a starter for the pumps with start and stop buttons", want: null },
  { id: "lit-25", t: "given", q: SM + " for motors up to 10 hp", want: st() },
  { id: "lit-26", t: "given", q: SM + " for motors over 5 hp", want: st(), harm: "medium" },
  { id: "lit-27", t: "given", q: "Draw a fan starter with start and stop buttons for the exhaust fans", want: null },
  { id: "lit-28", t: "given", q: SM + "; the motors are 3 phase", want: null },
  { id: "lit-29", t: "given", q: "Draw one of the pump starters with start and stop buttons", want: st({ load: "pump" }), harm: "medium" },
  { id: "lit-30", t: "given", q: "Draw a conveyor starter with start and stop buttons, the conveyors carry boxes", want: null },
  { id: "lit-31", t: "given", q: "Draw a pump motor starter with start and stop buttons", want: st({ load: "pump" }) },
  { id: "lit-32", t: "given", q: "Draw a fan starter with start and stop buttons, it fans air", want: st({ load: "fan" }), accept: [null] },
  { id: "lit-33", t: "given", q: SM + ", an e-stop and a green run light", want: st({ estop: true, lamps: [RUN] }) },
  { id: "lit-34", t: "given", q: "Draw a pump starter with start/stop buttons and a pump running light", want: st({ load: "pump", lamps: [RUN] }) },
  { id: "lit-35", t: "given", q: SM + " and a light that goes out when the motor starts", want: st({ lamps: [STOPPED] }) },
  { id: "lit-36", t: "given", q: SM + " and a red light when stopped", want: st({ lamps: [STOPPED] }) },
  { id: "lit-37", t: "given", q: "Draw a magnetic motor starter with a holding contact", want: st() },
  { id: "lit-38", t: "given", q: "Draw a DOL starter for a pump with start and stop push buttons", want: st({ load: "pump" }) },
  { id: "lit-39", t: "given", q: "Draw a seal-in circuit for a blower with start and stop buttons", want: st({ load: "blower" }) },
  { id: "lit-40", t: "given", q: "Draw a mixer starter with start and stop buttons and a red stopped light", want: st({ load: "mixer", lamps: [STOPPED] }) },
  { id: "lit-41", t: "given", q: "Draw a grinder contactor with start and stop buttons", want: st({ load: "grinder", dev: "contactor" }) },
  { id: "lit-42", t: "given", q: SM + " and an e-stop", want: st({ estop: true }) },
  { id: "lit-43", t: "given", q: SM + " and a run light that lights up when it runs", want: null },
  { id: "lit-44", t: "given", q: "Draw a pump starter with start and stop buttons; the pump pumps water", want: st({ load: "pump" }), accept: [null] },
  { id: "lit-45", t: "given", q: SM + " and a pilot light, the start button is not illuminated", want: st({ lamps: [RUN] }), harm: "medium" },
  { id: "lit-46", t: "given", q: "Draw a motor starter with a stop push button and a start push button", want: st() },
  { id: "lit-47", t: "given", q: "Draw a motor starter with stop and start pushbuttons and a red run light", want: st({ lamps: ["lamp LT1 M1 " + Q("run") + " red"] }) },
  { id: "lit-48", t: "given", q: "Draw a pump starter with start and stop buttons and a run light, 120 V control, 3 phase 480 V motor", want: st({ supply: "120 V AC", load: "pump", lamps: [RUN] }) },

  // ---------------------------------------------------------------- reversing, compressor, fill (unchanged paths)
  { id: "rev-01", t: "given", q: "Draw a reversing motor starter with forward and reverse buttons", want: rv() },
  { id: "rev-02", t: "given", q: "Draw a forward reverse control circuit for a conveyor with an e-stop", want: rv({ estop: true }) },
  { id: "rev-03", t: "given", q: "Draw a forward/reverse starter with pilot lights for each direction", want: rv({ lamps: true }) },
  { id: "cmp-01", t: "given", q: "Draw an air compressor control circuit with a pressure switch", want: cp() },
  { id: "cmp-02", t: "given", q: "Draw an air compressor control circuit with a pressure switch that cuts out at 125 psi", want: cp({ co: "125 psi" }) },
  { id: "cmp-03", t: "given", q: "Draw an air compressor control circuit with a pressure switch and a green run light", want: cp({ lamps: [RUN] }) },
  { id: "cmp-04", t: "given", q: "Draw an air compressor control circuit with a pressure switch and an e-stop", want: cp({ estop: true }) },
  { id: "fill-01", t: "given", q: "Draw a tank fill pump control circuit with a float switch", want: fl() },
  { id: "fill-02", t: "given", q: "Draw a tank fill pump control circuit with a float switch and a pump on light", want: fl({ run: true }) },
  { id: "fill-03", t: "given", q: "Draw a tank fill pump control circuit with a high and a low float", want: fl({ two: true }) },

  { id: "rev-04", t: "given", q: "Draw a forward/reverse starter with forward, reverse and stop push buttons", want: rv() },
  { id: "fill-04", t: "given", q: "Draw a tank fill pump control circuit with a float switch; the pump pumps into the tank", want: fl() },
  { id: "fill-05", t: "given", q: "Draw a cistern fill pump control circuit with a float switch", want: fl() },
  { id: "fill-06", t: "given", q: "Draw a stock tank fill pump control circuit with a float switch and a green pump on light", want: fl({ run: true }) },
  { id: "sta-35", t: "given", q: "Draw a conveyor starter with start and stop at both ends of the conveyor", want: st({ n: 2, load: "conveyor" }) },
  { id: "sta-36", t: "given", q: "Draw a motor starter with start/stop at two places, 24 V DC control", want: st({ n: 2, supply: "24 V DC" }) },
  { id: "sta-37", t: "given", q: "Draw a motor starter with three start/stop stations and an e-stop", want: st({ n: 3, estop: true }), accept: [null] },

  // ---------------------------------------------------------------- the sump: an alarm light beside a horn
  { id: "sump-01", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn", want: sp({ alarm: true, horn: true }) },
  { id: "sump-02", t: "given", q: "Draw a sump pump control circuit with a high water alarm light", want: sp({ alarm: true, light: true }) },
  { id: "sump-03", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn and light", want: sp({ alarm: true, light: true, horn: true }), accept: [sp({ alarm: true, horn: true }), null] },
  { id: "sump-04", t: "given", q: "Draw a sump pump control circuit with a high water alarm with a horn and a light for high water", want: sp({ alarm: true, light: true, horn: true }), accept: [null] },
  { id: "sump-05", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn and a run light", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "the run light is the pump's: no alarm light is asked" },
  { id: "sump-06", t: "given", q: "Draw a sump pump control circuit with a pump running light and a high water alarm horn", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "as sump-05" },
  { id: "sump-07", t: "given", q: "Draw a sump pump control circuit with a green pump running light and a high water alarm horn", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "as sump-05" },
  { id: "sump-08", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn and a green light while the pump runs", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "as sump-05" },
  { id: "sump-09", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn and a red alarm light", want: sp({ alarm: true, light: true, horn: true }) },
  { id: "sump-10", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn, and a pump run light", want: sp({ run: true, alarm: true, horn: true }), accept: [null] },
  { id: "sump-11", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn and a light that shows the pump is running", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "as sump-05" },
  { id: "sump-12", t: "given", q: "Draw a sump pump control circuit with a run light and a high water alarm bell", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "as sump-05" },
  { id: "sump-13", t: "given", q: "Draw a sump pump control circuit with a high level alarm horn and an indicator for high level", want: sp({ alarm: true, light: true, horn: true }), accept: [null] },
  { id: "sump-14", t: "given", q: "Draw a sump pump control circuit with a high water alarm horn and a run lamp", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "as sump-05" },
  { id: "sump-15", t: "given", q: "Draw a sump pump control circuit with a pump on light and a horn for the high water alarm", want: sp({ run: true, alarm: true, horn: true }), accept: [null], why: "as sump-05" },
  { id: "sump-16", t: "given", q: "Draw a sump pump control circuit", want: sp() },
  { id: "sump-17", t: "given", q: "Draw a sump pump control circuit with a float switch and a green run light", want: sp({ run: true }) },
  { id: "sump-18", t: "given", q: "Draw a sump pump control circuit with a high water alarm", want: sp({ alarm: true, light: true }) },
  { id: "sump-19", t: "given", q: "Draw a bilge pump control circuit with a float switch", want: sp() },
  { id: "sump-20", t: "given", q: "Draw a basement sump pump control circuit with a float switch and a run light", want: sp({ run: true }) },
  { id: "sump-21", t: "given", q: "Draw a sump pump control circuit with a float switch for the pumps", want: null },

  { id: "sump-22", t: "given", q: "Draw a sump pump control circuit with a float switch; the pump pumps the pit down", want: sp() },
  { id: "sump-23", t: "given", q: "Draw a sump pump control circuit with a float switch; it pumps water out", want: sp() },

  // ---------------------------------------------------------------- kept circuits: exact words
  { id: "keep-01", t: "keep", q1: "Draw a control circuit for my dust collector fan with start and stop buttons", q2: "Draw a control circuit for my dust collector fan with start and stop buttons", text: mk(["Dust collector fan", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1"]), want: true },
  { id: "keep-02", t: "keep", q1: "Draw a control circuit for my dust collector fan with start and stop buttons", q2: "please draw the control circuit for my dust collector fan with start and stop buttons again", text: mk(["Dust collector fan", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1"]), want: true },
  { id: "keep-03", t: "keep", q1: "Draw a control circuit for my dust collector fan with start and stop buttons", q2: "Draw a control circuit for my dust collector fan with start and stop button", text: mk(["Dust collector fan", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1"]), want: true, harm: "medium", why: "button and buttons: the same circuit" },
  { id: "keep-04", t: "keep", q1: "Draw a control circuit for my dust collector fans with start and stop buttons", q2: "Draw a control circuit for my dust collector fan with start and stop buttons", text: mk(["Dust collector fans", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1"]), want: false, why: "fans kept, one fan asked" },
  { id: "keep-05", t: "keep", q1: "Draw a control circuit for my dust collector fan with start and stop pushbuttons", q2: "Draw a control circuit for my dust collector fan with start and stop pushbutton", text: mk(["Dust collector fan", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1"]), want: true, harm: "medium" },
  { id: "keep-06", t: "keep", q1: "Draw a control circuit for my dust collector fan with start and stop buttons and a green run light", q2: "Draw a control circuit for my dust collector fan with start and stop buttons and a red run light", text: mk(["Dust collector fan", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1", "lamp LT1 M1 " + Q("run") + " green"]), want: false },
  { id: "keep-07", t: "keep", q1: "Draw a control circuit for my dust collector fan with start and stop buttons, 24 V control", q2: "Draw a control circuit for my dust collector fan with start and stop buttons, 120 V control", text: mk(["Dust collector fan", "supply " + Q("24 V"), "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1"]), want: false },
  { id: "keep-08", t: "keep", q1: "Draw a control circuit for my dust collector fan with start and stop buttons", q2: "Draw a control circuit for my dust collector fan with start and stop buttons at two locations", text: mk(["Dust collector fan", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("fan starter"), "overload OL1 M1"]), want: false },
  { id: "keep-09", t: "keep", q1: "Draw a control circuit for the shop air compressor with start and stop buttons", q2: "Draw the control circuit for the shop air compressor with start and stop buttons", text: mk(["Shop compressor", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("compressor starter"), "overload OL1 M1"]), want: true },
  { id: "keep-10", t: "keep", q1: "Draw a control circuit for the shop air compressor with start and stop buttons", q2: "Draw a control circuit for the shop air compressors with start and stop buttons", text: mk(["Shop compressor", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("compressor starter"), "overload OL1 M1"]), want: false },

  // ---------------------------------------------------------------- code checks on what the model wrote
  { id: "chk-01", t: "build", q: "Draw a control circuit for a vac pump with a high vac cut-out switch", text: mk(["Vac pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + Q("high vac cut-out"), "coil M1 " + Q("vac pump starter"), "overload OL1 M1"]), want: { code: 0 }, why: "a vacuum switch: which way it cuts out is not sure (the sixth review); \x27vac\x27 is vacuum" },
  { id: "chk-02", t: "build", q: "Draw a control circuit for a vacuum pump with a high vacuum cut-out switch", text: mk(["Vacuum pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + Q("high vacuum cut-out"), "coil M1 " + Q("vacuum pump starter"), "overload OL1 M1"]), want: { code: 0 } },
  { id: "chk-03", t: "build", q: "Draw a control circuit for a blower holding a negative-pressure room, with a high pressure cut-out", text: mk(["Blower", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + Q("high pressure cut-out"), "coil M1 " + Q("blower starter"), "overload OL1 M1"]), want: { code: 0 }, why: "negative pressure written with a hyphen: as chk-04" },
  { id: "chk-04", t: "build", q: "Draw a control circuit for a blower holding a negative pressure room, with a high pressure cut-out", text: mk(["Blower", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + Q("high pressure cut-out"), "coil M1 " + Q("blower starter"), "overload OL1 M1"]), want: { code: 0 } },
  { id: "chk-05", t: "build", q: "Draw a 120 VAC control circuit for an air compressor with a high pressure cut-out switch", text: mk(["Air compressor", "supply " + Q("120 V AC"), "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + Q("high pressure cut-out"), "coil M1 " + Q("compressor starter"), "overload OL1 M1"]), want: { code: /PS1[\s\S]*high cut-out drawn normally open[\s\S]*pressure PS1 M1 nc/ }, why: "120 VAC is no vacuum: a high cut-out drawn open goes back" },
  { id: "chk-06", t: "build", q: "Draw a 120 VAC control circuit for an air compressor with a high pressure cut-out switch", text: mk(["Air compressor", "supply " + Q("120 V AC"), "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + Q("high pressure cut-out"), "coil M1 " + Q("compressor starter"), "overload OL1 M1"]), want: { code: 0 }, okHas: "PS1 opens as the pressure rises" },
  { id: "chk-07", t: "build", q: "Draw a motor starter with start and stop buttons and a stop relay", text: mk(["Motor starter", "stop PB1 CR1 no", "relay CR1 " + Q("stop relay"), "start PB2 M1", "coil M1 CR1 off " + Q("motor starter"), "overload OL1 M1"]), want: { code: 0 } },
  { id: "chk-08", t: "build", q: "Draw a motor starter with start and stop buttons and a stop relay", text: mk(["Motor starter", "stop PB1 CR1 no", "relay CR1 " + Q("stop relay"), "start PB2 CR2", "relay CR2 CR1 off " + Q("run relay"), "coil M1 CR2 " + Q("motor starter"), "overload OL1 M1"]), want: { code: 0 }, why: "a stop relay energised to stop (the fourth review's rule), dropping a run relay that holds the starter: the line back says it 'runs only while held', which it does not" },
  { id: "chk-09", t: "build", q: "Draw a run relay with start and stop buttons and a stopped light", text: mk(["Run relay", "stop PB1 CR1 no", "start PB2 CR1", "relay CR1 " + Q("run"), "coil M1 CR1 " + Q("motor starter"), "overload OL1 M1", "lamp LT1 CR1 off " + Q("stopped") + " red"]), want: { code: /PB1[\s\S]*stop written normally open[\s\S]*stop PB1 CR1/ } },
  { id: "chk-10", t: "build", q: SM, text: mk(["Motor starter", "stop PB1 M1 no", "start PB2 M1", "coil M1 " + Q("motor starter"), "overload OL1 M1"]), want: { code: /stop written normally open[\s\S]*stop PB1 M1/ } },
  { id: "chk-11", t: "build", q: "Draw a compressor control circuit with a pressure switch and a high pressure cut-out", text: mk(["Compressor", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + Q("high pressure cut-out"), "coil M1 " + Q("compressor starter, overload relay OL1"), "overload OL1 M1"]), want: { code: /high cut-out drawn normally open/ } },
  { id: "chk-12", t: "build", q: "Draw a compressor control circuit with a pressure switch and a high pressure cut-out", text: mk(["Compressor", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 " + Q("high pressure cut-out"), "coil M1 " + Q("compressor with overload"), "overload OL1 M1"]), want: { code: /high cut-out drawn normally open/ } },
  { id: "chk-13", t: "build", q: "Draw a compressor control circuit with a pressure switch and a high pressure cut-out", text: mk(["Compressor", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + Q("high pressure cut-out"), "coil M1 " + Q("compressor with overload"), "overload OL1 M1"]), want: { code: 0 }, okHas: "PS1 opens as the pressure rises" },
  { id: "chk-14", t: "build", q: "Draw a pump starter with a red light when the overload trips", text: mk(["Pump starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("pump starter"), "overload OL1 M1", "overload OL1 CR2 no", "relay CR2 " + Q("pump overload"), "lamp LT1 CR2 " + Q("overload") + " red"]), want: { code: 0 }, harm: "low", why: "an overload's open contact to an alarm relay is no motor's overload; the circuit is questioned anyway (CR2 has nothing switching it), so the extra line is low" },
  { id: "chk-15", t: "build", q: "Draw a pump starter with a red light when the overload trips", text: mk(["Pump starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("pump starter"), "overload OL1 M1", "overload OL1 CR2 no", "coil CR2 " + Q("overload alarm relay"), "lamp LT1 CR2 " + Q("overload") + " red"]), want: { code: 0 } },
  { id: "chk-16", t: "build", q: "Draw a control circuit for a vacuum pump with a low vacuum cut-out at 10 inHg", text: mk(["Vacuum pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + Q("low vacuum cut-out 10 inHg"), "coil M1 " + Q("pump starter"), "overload OL1 M1"]), want: { code: 0 } },
  { id: "chk-17", t: "build", q: SM, text: mk(["Motor starter", "stop PB1 M1", "start PB2 M1", "coil M1 " + Q("motor starter"), "overload OL1 M1"]), want: { code: 0 }, okHas: "the overload OL1 on M1" },
  { id: "chk-18", t: "build", q: "Draw a reversing motor starter with forward and reverse buttons", text: mk(["Reversing motor starter"].concat(rv())), want: { code: 0 }, okHas: "locked out of each other" },
  { id: "chk-19", t: "build", q: "Draw a well pump control circuit with a pressure switch and a low pressure cut-out", text: mk(["Well pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + Q("low pressure cut-out"), "coil M1 " + Q("pump starter"), "overload OL1 M1"]), want: { code: /low cut-out drawn normally closed/ } },
  { id: "chk-20", t: "build", q: "Draw a motor starter for a mine in Lusaka, Zambia with start and stop buttons", text: mk(["Motor starter", "stop PB1 M1 no", "start PB2 M1", "coil M1 " + Q("motor starter"), "overload OL1 M1"]), want: { code: /IEC practice: IEC 60204-1:2016, 9\.4/ } },
  { id: "chk-21", t: "build", q: "Draw a control circuit for a vac pump with a low vac cut-out", text: mk(["Vac pump", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + Q("low vac cut-out"), "coil M1 " + Q("vac pump starter"), "overload OL1 M1"]), want: { code: 0 }, why: "as chk-01" },
  { id: "chk-22", t: "build", q: "Draw a control circuit for a blower that holds a room at negative-pressure, with a low pressure cut-out", text: mk(["Blower", "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + Q("low pressure cut-out"), "coil M1 " + Q("blower starter"), "overload OL1 M1"]), want: { code: 0 }, why: "as chk-03" },
  { id: "chk-23", t: "build", q: "Draw a 24 VDC control circuit for an air compressor with a high pressure cut-out switch", text: mk(["Air compressor", "supply " + Q("24 V DC"), "stop PB1 M1", "start PB2 M1", "pressure PS1 M1 nc " + Q("high pressure cut-out"), "coil M1 " + Q("compressor starter"), "overload OL1 M1"]), want: { code: 0 }, okHas: "PS1 opens as the pressure rises" },

  { id: "chk-24", t: "build", q: "Draw a delayed start with a stop relay", text: mk(["Delayed start", "stop PB1 CR3 no", "relay CR3 " + Q("stop relay"), "start PB2 CR1", "relay CR1 CR3 off " + Q("run"), "timer TR1 " + Q("10 s") + " CR1", "coil M1 TR1 " + Q("motor starter"), "overload OL1 M1 CR1"]), want: { code: 0 }, why: "as chk-08: the stop relay drops the run relay, not a starter" },
  { id: "chk-25", t: "build", q: "Draw a motor starter with start and stop buttons and a stop relay", text: mk(["Motor starter", "stop PB1 CR1 no", "relay CR1 " + Q("stop relay"), "start PB2 M1", "coil M1 CR1 off " + Q("motor starter"), "overload OL1 M1", "lamp LT1 CR1 off " + Q("ready") + " white"]), want: { code: 0 } },
  { id: "chk-26", t: "build", q: "Draw a motor contactor with start and stop buttons and a stop relay, IEC", text: mk(["Motor contactor", "stop S1 KA1 no", "relay KA1 " + Q("stop relay"), "start S2 K1", "coil K1 KA1 off " + Q("motor contactor"), "overload F1 K1"]), want: { code: 0 } },

  // ---------------------------------------------------------------- the code a question names
  { id: "pick-01", t: "pick", q: "Draw a motor starter for a mine in Lusaka, Zambia", want: "IEC" },
  { id: "pick-02", t: "pick", q: "Draw a motor starter for a farm near Harare, Zimbabwe", want: "IEC" },
  { id: "pick-03", t: "pick", q: "Draw a motor starter for a farm in Zimbabwe", want: "IEC" },
  { id: "pick-04", t: "pick", q: "Draw a motor starter, Zambia", want: "IEC" },
  { id: "pick-05", t: "pick", q: "Draw a motor starter for Zambia Street, Tulsa", want: "US" },
  { id: "pick-06", t: "pick", q: "Draw a motor starter for a plant in Kitwe, Zambia to NEC", want: "US" },
  { id: "pick-07", t: "pick", q: "Draw a motor starter for a shop in Tulsa, Oklahoma", want: "US" },
  { id: "pick-08", t: "pick", q: "Draw a motor starter, 400 V 50 Hz", want: "IEC" },
  { id: "pick-09", t: "pick", q: "Draw a motor starter for Nairobi, Kenya", want: "IEC" },
  { id: "pick-10", t: "pick", q: "Draw a motor starter", want: "US" },
  { id: "pick-11", t: "pick", q: "Draw a motor starter for a customer in Bulawayo, zimbabwe", want: "IEC" },
  { id: "pick-12", t: "pick", q: "Draw a motor starter for the Zambian mine", want: "IEC", harm: "low" },

  // ---------------------------------------------------------------- the bench prompts
  { id: "guard-bench", t: "guard" }
];
module.exports = cases;
