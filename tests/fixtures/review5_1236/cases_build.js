// cases_build.js -- the fifth review of 1.24.36 (review5_1236): control circuits as a model writes them, and what Lantern
// should do with them. Right circuits from many trades must be drawn with nothing sent back; wrong ones must go back once
// with a line that, written in place of its device's line, draws a right circuit.
//   expect: "ok" (drawn, nothing sent back) | "back" (sent back)
//   want / not: patterns the problems sent back must / must not have
//   fix: true -- each "Write it: <line>" goes in place of the line of the device it names, and the block is built again:
//        it must be drawn, and sim (if any) must pass on the new drawing
//   sim(circuit, S) -> what is wrong with the drawing, or null (S is sim.js)
//   harm: how bad it is when Lantern does otherwise
"use strict";
var FILLQ = "Draw the control circuit for a pump that fills a tank with a float switch";
var FILL2Q = "Draw the control circuit for a pump that fills a tank between a low float and a high float";
// the pump M1 (or out) runs to fill between the floats at 3 and 8
function fills(out, at, at2) { return function (c, S) { var b = S.fillCycle(c, out || "M1", at || { FS1: 3, FS2: 8 }, at2 ? { at2: at2 } : null); return b.length ? b.join("; ") : null; }; }
function sumps(out, at) { return function (c, S) { var b = S.sumpCycle(c, out || "M1", at || { FS1: 8, FS2: 3 }); return b.length ? b.join("; ") : null; }; }
// a three-wire start: start pressed then let go, it holds; stop pressed, it drops; an overload trip drops it
function threeWire(out, start, stop, ol) {
  return function (c, S) {
    var r = S.run(c, [{}, { pressed: mk(start) }, {}, { pressed: mk(stop) }, {}, { pressed: mk(start) }, {}, { tripped: mk(ol || "OL1") }]);
    var o = out || "M1", bad = [];
    if (r[0][o]) bad.push(o + " on before start");
    if (!r[1][o] || !r[2][o]) bad.push(o + " does not start and hold");
    if (r[3][o] || r[4][o]) bad.push(o + " does not stop");
    if (ol !== false && r[7][o]) bad.push(o + " runs with its overload tripped");
    return bad.length ? bad.join("; ") : null;
  };
}
function mk(id) { var o = {}; if (id) o[id] = 1; return o; }
// a pressure switch: out runs below `set` and not above it
function pressure(out, ps, set) {
  return function (c, S) {
    var at = {}; at[ps] = set;
    var lo = S.settle(c, { p: set - 20, setp: at }, {}), hi = S.settle(c, { p: set + 20, setp: at }, {});
    return lo[out] && !hi[out] ? null : (out + (lo[out] ? "" : " does not run below " + set) + (hi[out] ? " runs above " + set : ""));
  };
}
// a temperature switch: out runs (wantBelow ? below : above) set
function temperature(out, ts, set, wantBelow) {
  return function (c, S) {
    var at = {}; at[ts] = set;
    var lo = S.settle(c, { t: set - 10, sett: at }, {}), hi = S.settle(c, { t: set + 10, sett: at }, {});
    var ok = wantBelow ? lo[out] && !hi[out] : hi[out] && !lo[out];
    return ok ? null : out + " runs " + (lo[out] ? "below " : "") + (hi[out] ? "above " : "") + set + (lo[out] || hi[out] ? "" : " never") + " (wanted " + (wantBelow ? "below" : "above") + ")";
  };
}
// a float: out on while the level is (wantAbove ? above : below) its height
function level(out, fs, h, wantAbove) {
  return function (c, S) {
    var at = {}; at[fs] = h;
    var lo = S.settle(c, { level: h - 1, at: at }, {}), hi = S.settle(c, { level: h + 1, at: at }, {});
    var ok = wantAbove ? hi[out] && !lo[out] : lo[out] && !hi[out];
    return ok ? null : out + (lo[out] ? " on below " : "") + (hi[out] ? " on above " : "") + h + (lo[out] || hi[out] ? "" : " never on") + " (wanted " + (wantAbove ? "above" : "below") + ")";
  };
}
function both() { var fs = [].slice.call(arguments); return function (c, S) { var b = fs.map(function (f) { return f(c, S); }).filter(function (x) { return x; }); return b.length ? b.join("; ") : null; }; }

module.exports = [
  // ---- each given's block as a small model would copy it, built under its question --------------------------------
  { id: "b-given-starter", q: "Draw a 3-wire start/stop control for a pump motor with a green run light", lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1", "lamp LT1 M1 \x22run\x22 green"], expect: "ok",
    sim: both(threeWire("M1", "PB2", "PB1"), function (c, S) { var r = S.run(c, [{}, { pressed: { PB2: 1 } }]); return r[0].LT1 || !r[1].LT1 ? "the run light is not lit with the pump" : null; }), harm: "high" },
  { id: "b-given-stopped-light", q: "Draw the control circuit for a pump starter: a stop push button, a start push button with a holding contact, the overload contact, the contactor coil, and a pilot light that is on while the pump is stopped.",
    lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1", "lamp LT1 M1 off \x22stopped\x22 red"], expect: "ok",
    sim: function (c, S) { var r = S.run(c, [{}, { pressed: { PB2: 1 } }]); return !r[0].LT1 || r[1].LT1 ? "the stopped light is not lit only while the pump is stopped" : null; }, harm: "high" },
  { id: "b-given-reversing", q: "Draw a forward reverse starter for a conveyor with pilot lights for each direction",
    lines: ["stop PB1 all", "start PB2 M1 \x22forward\x22", "start PB3 M2 \x22reverse\x22", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22", "interlock M1 M2", "overload OL1 M1 M2", "lamp LT1 M1 \x22forward\x22 green", "lamp LT2 M2 \x22reverse\x22 green"], expect: "ok",
    sim: function (c, S) {
      var r = S.run(c, [{ pressed: { PB2: 1 } }, {}, { pressed: { PB3: 1 } }, {}, { pressed: { PB1: 1 } }, {}, { pressed: { PB3: 1 } }, {}, { tripped: { OL1: 1 } }]), bad = [];
      if (!r[1].M1) bad.push("forward does not hold"); if (r[2].M2 || r[3].M2) bad.push("reverse starts while forward runs"); if (r[5].M1) bad.push("stop does not stop forward");
      if (!r[7].M2) bad.push("reverse does not start after stop"); if (r[8].M2) bad.push("the overload does not stop reverse"); if (!r[7].LT2 || r[7].LT1) bad.push("the direction lights are wrong");
      return bad.length ? bad.join("; ") : null; }, harm: "high" },
  { id: "b-given-sequence", q: "Draw a sequence control circuit: conveyor 2 can only start after conveyor 1 is running",
    lines: ["stop PB1 M1 \x22conveyor 1 stop\x22", "stop PB2 M2 \x22conveyor 2 stop\x22", "start PB3 M1 \x22conveyor 1 start\x22", "start PB4 M2 \x22conveyor 2 start\x22", "coil M1 \x22conveyor 1 starter\x22", "coil M2 M1 \x22conveyor 2 starter\x22", "overload OL1 M1", "overload OL2 M2"], expect: "ok",
    sim: function (c, S) {
      var r = S.run(c, [{ pressed: { PB4: 1 } }, {}, { pressed: { PB3: 1 } }, {}, { pressed: { PB4: 1 } }, {}, { pressed: { PB1: 1 } }, {}]), bad = [];
      if (r[0].M2 || r[1].M2) bad.push("conveyor 2 starts alone"); if (!r[3].M1) bad.push("conveyor 1 does not hold"); if (!r[5].M2) bad.push("conveyor 2 does not start after conveyor 1");
      if (r[7].M2 || r[7].M1) bad.push("stopping conveyor 1 does not stop both");
      return bad.length ? bad.join("; ") : null; }, harm: "high" },
  { id: "b-given-delayed", q: "Draw a control circuit for a delayed start motor with a warning horn that sounds for 10 seconds before the conveyor starts",
    lines: ["stop PB1 CR1", "start PB2 CR1", "relay CR1 \x22run\x22", "timer TR1 \x2210 s\x22 CR1", "coil M1 TR1 \x22conveyor starter\x22", "overload OL1 M1 CR1", "horn AH1 CR1 TR1 off \x22warning\x22"], expect: "ok",
    sim: function (c, S) {
      var r = S.run(c, [{ pressed: { PB2: 1 } }, {}, { done: { TR1: 1 } }, { done: { TR1: 1 }, tripped: { OL1: 1 } }, { done: { TR1: 1 } }]), bad = [];
      if (!r[1].AH1 || r[1].M1) bad.push("no warning before the start"); if (!r[2].M1 || r[2].AH1) bad.push("the conveyor does not start (or the horn keeps on) when the timer is done");
      if (r[3].M1 || r[3].CR1) bad.push("the overload does not drop the run relay"); if (r[4].M1) bad.push("the conveyor restarts by itself when the overload is reset");
      return bad.length ? bad.join("; ") : null; }, harm: "high" },
  { id: "b-given-compressor", q: "Draw the control circuit for an air compressor with a pressure switch, cut out 125 psi",
    lines: ["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 nc \x22cut-out 125 psi\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"], expect: "ok", sim: pressure("M1", "PS1", 125), harm: "high" },
  { id: "b-given-fill1", q: "Draw a contactor control circuit for a well pump that fills a cistern with a float switch",
    lines: ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22tank full\x22", "coil M1 \x22pump contactor\x22", "overload OL1 M1"], expect: "ok", sim: level("M1", "FS1", 8, false), harm: "high" },
  { id: "b-given-fill2", q: "Draw the control circuit for a pump that fills a tank using a low float and a high float, with a contactor",
    lines: ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump contactor\x22", "overload OL1 M1"], expect: "ok", sim: fills(), harm: "high" },
  { id: "b-given-sump-alarm", q: "Draw a contactor circuit for a sump pump with a float switch and a high water alarm light",
    lines: ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 \x22pump on\x22", "coil M1 \x22pump contactor\x22", "overload OL1 M1", "float FS2 \x22high level alarm\x22", "lamp LT1 FS2 \x22high water\x22 red"], expect: "ok",
    sim: both(level("M1", "FS1", 5, true), function (c, S) { var a = S.settle(c, { level: 9, at: { FS1: 5, FS2: 8 } }, {}), b = S.settle(c, { level: 6, at: { FS1: 5, FS2: 8 } }, {}); return a.LT1 && !b.LT1 ? null : "the alarm light is not lit only above the alarm float"; }), harm: "high" },

  // ---- right circuits from many trades: drawn as written, nothing sent back -----------------------------------------
  { id: "r-boiler-burner", q: "Draw the burner control circuit for a steam boiler with a high limit, a low water cut-off and a high pressure limit",
    lines: ["switch SS1 CR1 \x22burner on/off\x22", "temp TS1 CR1 nc \x22high limit\x22", "float FS1 CR1 \x22low water cut-off\x22", "pressure PS1 CR1 nc \x22high pressure limit\x22", "coil CR1 \x22burner relay\x22", "lamp LT1 CR1 \x22burner on\x22 green"], expect: "ok", harm: "high" },
  { id: "r-refrig-lp-hp", q: "Draw the control circuit for a refrigeration compressor with a low pressure switch and a high pressure switch and a thermostat",
    lines: ["temp TS1 M1 \x22thermostat\x22", "pressure PS1 M1 \x22low pressure cut-out\x22", "pressure PS2 M1 nc \x22high pressure cut-out\x22", "coil M1 \x22compressor contactor\x22", "overload OL1 M1"], expect: "ok", harm: "high" },
  { id: "r-refrig-lp-cutin-cutout", q: "Draw the control circuit for a walk-in cooler compressor with a low pressure control",
    lines: ["pressure PS1 M1 \x22cut-in 35 psi, cut-out 15 psi\x22", "pressure PS2 M1 nc \x22cut-out 400 psi, cut-in 300 psi\x22", "coil M1 \x22compressor contactor\x22"], expect: "ok",
    sim: function (c, S) { var lo = S.settle(c, { p: 5, setp: { PS1: 15, PS2: 400 } }, {}), hi = S.settle(c, { p: 60, setp: { PS1: 15, PS2: 400 } }, {}), hp = S.settle(c, { p: 450, setp: { PS1: 15, PS2: 400 } }, {}); return hi.M1 && !lo.M1 && !hp.M1 ? null : "the compressor does not run between its low and high cut-outs only"; }, harm: "high" },
  { id: "r-well-pump", q: "Draw the control circuit for a well pump with a pressure switch", lines: ["pressure PS1 M1 nc \x22cut-in 40 psi, cut-out 60 psi\x22", "coil M1 \x22well pump contactor\x22", "overload OL1 M1"], expect: "ok", sim: pressure("M1", "PS1", 60), harm: "high" },
  { id: "r-booster", q: "Draw the control circuit for a booster pump with low suction and high discharge pressure cut-outs",
    lines: ["switch SS1 M1", "pressure PS1 M1 \x22low suction pressure cut-out\x22", "pressure PS2 M1 nc \x22high discharge pressure cut-out\x22", "coil M1 \x22booster pump starter\x22"], expect: "ok", harm: "high" },
  { id: "r-comp-hightemp", q: "Draw the control circuit for an air compressor with a pressure switch and a high temperature shutdown",
    lines: ["switch SS1 M1", "pressure PS1 M1 nc \x22cut-out 125 psi\x22", "temp TS1 M1 nc \x22high discharge temp shutdown\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"], expect: "ok", harm: "high" },
  { id: "r-hpu", q: "Draw the control circuit for a hydraulic power unit with a low oil level switch and a high oil temperature switch",
    lines: ["stop PB1 M1", "start PB2 M1", "float FS1 M1 \x22low oil level shutdown\x22", "temp TS1 M1 nc \x22high oil temperature shutdown\x22", "coil M1 \x22HPU pump starter\x22", "overload OL1 M1"], expect: "ok", harm: "high" },
  { id: "r-cooling-fan", q: "Draw the control circuit for a cooling fan that starts on high temperature", lines: ["temp TS1 M1 \x22high temp\x22", "coil M1 \x22cooling fan contactor\x22", "overload OL1 M1"], expect: "ok", sim: temperature("M1", "TS1", 40, false), harm: "high" },
  { id: "r-heat-trace", q: "Draw the control circuit for heat trace with a low temperature thermostat", lines: ["temp TS1 M1 nc \x22low temp\x22", "coil M1 \x22heat trace contactor\x22"], expect: "ok", sim: temperature("M1", "TS1", 5, true), harm: "high" },
  { id: "r-freeze-heater", q: "Draw the control circuit for a freeze protection heater", lines: ["temp TS1 M1 nc \x22low temperature cut-in\x22", "coil M1 \x22heater contactor\x22"], expect: "ok", harm: "high" },
  { id: "r-kiln", q: "Draw the control circuit for a kiln with a high limit", lines: ["switch SS1 CR1", "temp TS1 CR1 nc \x22high limit\x22", "coil CR1 \x22kiln element contactor\x22"], expect: "ok", harm: "high" },
  { id: "r-water-heater", q: "Draw the control circuit for a water heater with a thermostat and a high limit", lines: ["temp TS1 M1 nc \x22thermostat\x22", "temp TS2 M1 nc \x22high limit cut-out\x22", "coil M1 \x22heater contactor\x22"], expect: "ok", harm: "high" },
  { id: "r-freeze-stat", q: "Draw the control circuit for a chiller compressor with a freeze stat", lines: ["temp TS1 M1 \x22low chilled water temp cut-out\x22", "coil M1 \x22compressor contactor\x22", "overload OL1 M1"], expect: "ok", harm: "high" },
  { id: "r-vacuum-bar", q: "Draw the control circuit for a vacuum pump with a vacuum switch", lines: ["pressure PS1 M1 \x22cut-in -0.6 bar, cut-out -0.8 bar\x22", "coil M1 \x22vacuum pump contactor\x22"], expect: "ok", harm: "high" },
  { id: "r-unloader", q: "Draw the control circuit for an air compressor unloader valve", lines: ["pressure PS1 SOL1 \x22high pressure unload\x22", "solenoid SOL1 PS1 \x22unloader\x22"], expect: "ok", harm: "high" },
  { id: "r-hp-alarm-relay", q: "Draw the control circuit for a compressor with a high pressure alarm",
    lines: ["pressure PS1 M1 nc \x22cut-out 120 psi\x22", "coil M1 \x22compressor starter\x22", "pressure PS2 CR2 \x22high pressure alarm\x22", "coil CR2 \x22alarm relay\x22", "horn AH1 CR2"], expect: "ok", harm: "high" },
  { id: "r-winding-stat", q: "Draw the control circuit for a motor with a winding thermostat", lines: ["stop PB1 M1", "start PB2 M1", "temp TS1 M1 nc \x22motor high temp trip\x22", "coil M1 \x22motor starter\x22", "overload OL1 M1"], expect: "ok", sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "r-gas-burner", q: "Draw the control circuit for a gas burner with low and high gas pressure switches",
    lines: ["pressure PS1 CR1 \x22low gas pressure cut-off\x22", "pressure PS2 CR1 nc \x22high gas pressure cut-off\x22", "temp TS1 CR1 \x22call for heat\x22", "coil CR1 \x22burner relay\x22"], expect: "ok", harm: "high" },
  { id: "r-jockey", q: "Draw the control circuit for a jockey pump with a pressure switch", lines: ["pressure PS1 M1 nc \x22cut-in 100 psi cut-out 110 psi\x22", "coil M1 \x22jockey pump starter\x22", "overload OL1 M1"], expect: "ok", sim: pressure("M1", "PS1", 110), harm: "high" },
  { id: "F-r-day-tank", note: "\u201cday tank\u201d is read as a second vessel, so the fill's two nc floats are left in series and the pump short-cycles at the low float", q: "Draw the control circuit for a fuel day tank fill pump with a high level shutoff",
    lines: ["float FS1 M1 nc \x22high level shutoff\x22", "float FS2 M1 nc \x22low level start\x22", "coil M1 \x22fill pump starter\x22"], expect: "ok", sim: fills("M1", { FS2: 3, FS1: 8 }), harm: "medium" },
  { id: "r-overload-light", q: "Draw the control circuit for a pump with an overload alarm", lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1", "lamp LT1 OL1 \x22overload tripped\x22 amber"], expect: "ok", sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "r-lighting-onoff", q: "Draw a lighting contactor with on and off push buttons", lines: ["button PB1 CR1 nc \x22off\x22", "button PB2 CR1 \x22on\x22", "coil CR1 \x22lighting contactor\x22"], expect: "ok", sim: threeWire("CR1", "PB2", "PB1", false), harm: "high" },
  { id: "r-jog", q: "Draw a motor starter with a jog button", lines: ["stop PB1 M1", "start PB2 CR1", "coil CR1 \x22run relay\x22", "coil M1 CR1 \x22motor starter\x22", "button PB3 M1 \x22jog\x22"], expect: "ok", harm: "high" },
  { id: "r-oil-pressure", q: "Draw the control circuit for a compressor with a low oil pressure safety", lines: ["switch SS1 M1", "pressure PS1 M1 nc \x22cut-out 150 psi\x22", "pressure PS2 M1 \x22low oil pressure safety\x22", "coil M1 \x22compressor starter\x22"], expect: "ok", harm: "high" },
  { id: "r-exhaust-overtemp", q: "Draw the control circuit for an exhaust fan on an over temperature thermostat", lines: ["temp TS1 M1 \x22over temperature\x22", "coil M1 \x22exhaust fan starter\x22"], expect: "ok", harm: "high" },
  { id: "r-dp-alarm", q: "Draw a dust collector with a high differential pressure alarm", lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22dust collector fan starter\x22", "pressure PS1 LT1 \x22high dp\x22", "lamp LT1 PS1 \x22filter dirty\x22 amber"], expect: "ok", harm: "high" },
  { id: "r-well-cistern-lp", q: "Draw a well pump that fills a cistern with a float and a low pressure cut-off on the pump", lines: ["float FS1 M1 nc \x22cistern full\x22", "pressure PS1 M1 \x22low pressure cut-off\x22", "coil M1 \x22well pump contactor\x22"], expect: "ok", harm: "high" },
  { id: "r-boiler-feed", q: "Draw the control circuit for a boiler feed pump that fills the boiler, with a low water float and a high water float",
    lines: ["float FS1 M1 nc \x22low water - pump on\x22", "float FS2 M1 nc \x22high water - pump off\x22", "coil M1 \x22feed pump starter\x22"], expect: "ok", sim: fills(), harm: "high" },
  { id: "r-empty-to-drain", q: "Draw a pump that empties the tank into the drain, with a high float and a low float", lines: ["float FS1 M1 \x22high level start\x22", "float FS2 M1 \x22low level stop\x22", "coil M1 \x22pump contactor\x22"], expect: "ok", sim: sumps(), harm: "high" },
  { id: "r-sump-on-off", q: "Draw a sump pump with on and off floats", lines: ["float FS1 M1 \x22pump on\x22", "float FS2 M1 \x22pump off\x22", "coil M1 \x22sump pump contactor\x22"], expect: "ok", sim: sumps(), harm: "high" },
  { id: "r-fill-backup-cutoff", q: "Draw a fill pump with high level stop and high high cut-off floats", lines: ["float FS1 M1 nc \x22high level stop\x22", "float FS2 M1 nc \x22high high level cut-off\x22", "coil M1 \x22fill pump contactor\x22"], expect: "ok", harm: "high" },
  { id: "r-fill-alarm-horn", q: "Draw a fill pump with low and high floats and a high high alarm horn",
    lines: ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "float FS3 AH1 \x22high high alarm\x22", "horn AH1 FS3", "coil M1 \x22fill pump contactor\x22"], expect: "ok", sim: fills("M1", { FS1: 3, FS2: 8 }, { FS3: 9 }), harm: "high" },
  { id: "r-fill-low-cutoff-guard", q: "Draw a fill pump control circuit for a tank with a low float, a high float and a low cut-off float",
    lines: ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "float FS3 M1 \x22low level cut-off\x22", "coil M1 \x22pump contactor\x22"], expect: "ok",
    sim: function (c, S) { var r = c.rungs.filter(function (x) { return x.out.id === "M1"; })[0]; return r && r.series.some(function (e) { return e.id === "FS3"; }) ? null : "the guard float FS3 is not left in series"; }, harm: "high" },
  { id: "r-iec-tags", q: "Draw a DOL starter to IEC 60204-1 with S1 stop, S2 start, contactor K1 and overload F1", lines: ["stop S1 K1", "start S2 K1", "coil K1 \x22motor contactor\x22", "overload F1 K1"], expect: "ok", sim: threeWire("K1", "S2", "S1", "F1"), harm: "high" },
  { id: "r-24vdc-relays", q: "Draw a 24 V DC relay circuit for a conveyor starter", lines: ["supply \x2224 V DC\x22", "stop PB1 CR1", "start PB2 CR1", "relay CR1 \x22run\x22", "coil M1 CR1 \x22conveyor contactor\x22", "overload OL1 M1"], expect: "ok", harm: "high" },
  { id: "r-comp-both-cuts", q: "Draw an air compressor control", lines: ["pressure PS1 M1 nc \x22cut-out 120 psi, cut-in 90 psi\x22", "coil M1 \x22compressor starter\x22"], expect: "ok", sim: pressure("M1", "PS1", 120), harm: "high" },
  { id: "r-button-nc-stop", q: "Draw a motor starter", lines: ["button PB1 M1 nc \x22stop\x22", "button PB2 M1 \x22start\x22", "coil M1 \x22motor starter\x22"], expect: "ok", sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "r-overtravel-limit", q: "Draw a conveyor with an overtravel limit", lines: ["stop PB1 M1", "start PB2 M1", "limit LS1 M1 nc \x22overtravel\x22", "coil M1 \x22conveyor starter\x22"], expect: "ok", harm: "high" },
  { id: "r-backup-comp-cutin", q: "Draw the control circuit for a backup compressor that starts on low air pressure", lines: ["pressure PS1 M2 nc \x22low pressure cut-in, backup\x22", "coil M2 \x22backup compressor starter\x22"], expect: "ok", harm: "high" },
  { id: "r-boiler-circ-pump", q: "Draw the control circuit for a boiler circulating pump that runs only when the boiler is hot", lines: ["temp TS1 M1 \x22low temp cut-out\x22", "coil M1 \x22circulating pump contactor\x22"], expect: "ok", sim: temperature("M1", "TS1", 60, false), harm: "high" },
  // found by this review: right circuits sent back, with a line that builds wrong
  { id: "F-r-freeze-protect-pump", q: "Draw the control circuit for a pool pump with freeze protection",
    lines: ["switch SS1 M1", "temp TS1 M1 nc \x22low temp freeze protection\x22", "coil M1 \x22pool pump starter\x22", "overload OL1 M1"], expect: "ok", sim: temperature("M1", "TS1", 3, true), harm: "high" },
  { id: "F-r-standby-loss-of-pressure", q: "Draw the control circuit for a standby pump that starts on loss of pressure",
    lines: ["pressure PS1 M2 nc \x22loss of pressure - start standby\x22", "coil M2 \x22standby pump starter\x22", "overload OL2 M2"], expect: "ok", sim: pressure("M2", "PS1", 40), harm: "high" },
  { id: "F-r-fault-relay", q: "Draw a control circuit for a pump with a fault relay and reset",
    lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1", "stop PB3 CR5 \x22fault reset\x22", "overload OL2 CR5 no", "coil CR5 \x22pump fault relay\x22", "lamp LT1 CR5 \x22pump fault\x22 amber"], expect: "ok",
    sim: function (c, S) { var a = S.settle(c, {}, {}), b = S.settle(c, { tripped: { OL2: 1 } }, {}); return !a.CR5 && b.CR5 ? null : "the fault relay is " + (a.CR5 ? "on with the overload not tripped" : "off when it trips"); }, harm: "high" },
  { id: "F-r-fill-full-relay", q: FILLQ, lines: ["switch SS1 M1", "float FS1 CR1 \x22high level\x22", "coil CR1 \x22tank full relay\x22", "coil M1 CR1 off \x22pump starter\x22", "overload OL1 M1"], expect: "ok", sim: level("M1", "FS1", 8, false), harm: "high" },
  { id: "F-r-fill-alarm-relay", q: FILLQ, lines: ["switch SS1 M1", "float FS1 M1 nc \x22tank full\x22", "coil M1 \x22pump starter\x22", "float FS2 CR2 \x22high water\x22", "coil CR2 \x22overflow alarm relay\x22", "horn AH1 CR2"], expect: "ok", sim: level("CR2", "FS2", 9, true), harm: "high" },
  { id: "F-r-fill-highhigh-relay", q: FILLQ, lines: ["switch SS1 M1", "float FS1 M1 nc \x22tank full\x22", "coil M1 \x22pump starter\x22", "float FS2 CR2 \x22high high level\x22", "coil CR2 \x22alarm relay\x22", "lamp LT1 CR2 \x22overflow\x22 red"], expect: "ok", sim: level("CR2", "FS2", 9, true), harm: "high" },
  { id: "F-r-fill-valve-relay", q: "Draw the control circuit for a solenoid valve that fills a tank with a float switch", lines: ["float FS1 CR1 \x22high level\x22", "coil CR1", "solenoid SOL1 CR1 off \x22fill valve\x22"], expect: "ok", sim: level("SOL1", "FS1", 8, false), harm: "high" },
  { id: "F-r-two-vessel-fill", q: "Draw a well pump that fills a tank with low and high floats and a dry run float in the well",
    lines: ["float FS1 M1 nc \x22tank low level start\x22", "float FS2 M1 nc \x22tank high level stop\x22", "float FS3 M1 \x22well dry run\x22", "coil M1 \x22well pump contactor\x22", "overload OL1 M1"], expect: "ok",
    sim: fills("M1", { FS1: 3, FS2: 8 }, { FS3: -100 }), harm: "medium", note: "the source's guard float is left in series, but the fill's own two floats are left in series too: the pump short-cycles at the low float" },

  // ---- wrong circuits: back once, with the line to write ----------------------------------------------------------
  { id: "w-comp-no", q: "Draw the control circuit for an air compressor with a pressure switch", lines: ["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 \x22opens at cut-out\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"],
    expect: "back", want: ["US practice", "Write it: pressure PS1 M1 nc \x22opens at cut-out\x22$"], fix: true, sim: pressure("M1", "PS1", 120), harm: "high" },
  { id: "w-comp-cutin-cutout", q: "Draw the control circuit for an air compressor", lines: ["pressure PS1 M1 \x22cut-in 90 psi, cut-out 120 psi\x22", "coil M1 \x22compressor starter\x22"], expect: "back", want: ["high cut-out", "Write it: pressure PS1 M1 nc"], fix: true, sim: pressure("M1", "PS1", 120), harm: "high" },
  { id: "w-well-cutin-cutout", q: "Draw the control circuit for a well pump with a pressure switch", lines: ["pressure PS1 M1 \x22cut-in 40 psi, cut-out 60 psi\x22", "coil M1 \x22well pump contactor\x22"], expect: "back", fix: true, sim: pressure("M1", "PS1", 60), harm: "high" },
  { id: "w-boiler-highlimit", q: "Draw the burner control for a boiler with a high limit", lines: ["temp TS1 CR1 \x22high limit\x22", "coil CR1 \x22burner relay\x22"], expect: "back", fix: true, sim: temperature("CR1", "TS1", 90, true), harm: "high" },
  { id: "w-boiler-lwco-nc", q: "Draw the burner control for a boiler with a low water cut-off", lines: ["float FS1 CR1 nc \x22low water cut-off\x22", "coil CR1 \x22burner relay\x22"], expect: "back", want: ["low cut-out", "Write it: float FS1 CR1 \x22low water cut-off\x22$"], fix: true, sim: level("CR1", "FS1", 4, true), harm: "high" },
  { id: "w-fill-one-no", q: FILLQ, lines: ["float FS1 M1 \x22tank full\x22", "coil M1 \x22pump contactor\x22"], expect: "back", want: ["Write it: float FS1 M1 nc \x22tank full\x22$"], fix: true, sim: level("M1", "FS1", 8, false), harm: "high" },
  { id: "w-fill-two-no", q: FILL2Q, lines: ["float FS1 M1 \x22low level start\x22", "float FS2 M1 \x22high level stop\x22", "coil M1 \x22pump contactor\x22"], expect: "back", want: ["Write it: float FS1 M1 nc \x22low level start\x22$", "Write it: float FS2 M1 nc \x22high level stop\x22$"], fix: true, sim: fills(), harm: "high" },
  { id: "w-fill-start-no", q: FILL2Q, lines: ["float FS1 M1 \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump contactor\x22"], expect: "back", want: ["Write it: float FS1 M1 nc \x22low level start\x22$"], not: ["FS2 \\("], fix: true, sim: fills(), harm: "high" },
  { id: "w-fill-stop-no", q: FILL2Q, lines: ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 \x22high level stop\x22", "coil M1 \x22pump contactor\x22"], expect: "back", want: ["Write it: float FS2 M1 nc \x22high level stop\x22$"], not: ["FS1 \\("], fix: true, sim: fills(), harm: "high" },
  { id: "w-fill-relay-stop-no", q: "Draw a fill pump with a run relay", lines: ["float FS1 CR1 nc \x22low level start\x22", "float FS2 CR1 \x22high level stop\x22", "coil CR1 \x22pump run relay\x22", "coil M1 CR1 \x22pump starter\x22"], expect: "back", fix: true, sim: fills("M1"), harm: "high" },
  { id: "w-fill-no-word-n.o.", q: FILLQ, lines: ["float FS1 M1 N.O. \x22high level\x22", "coil M1 \x22pump contactor\x22"], expect: "back", want: ["Write it: float FS1 M1 nc \x22high level\x22$"], fix: true, sim: level("M1", "FS1", 8, false), harm: "high" },
  { id: "w-stop-button-no", q: "Draw a motor starter", lines: ["button PB1 M1 \x22stop\x22", "button PB2 M1 \x22start\x22", "coil M1 \x22motor starter\x22"], expect: "back", want: ["Write it: stop PB1 M1"], fix: true, sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "w-estop-button-no", q: "Draw a motor starter", lines: ["button PB1 M1 \x22e-stop\x22", "start PB2 M1", "coil M1 \x22motor starter\x22"], expect: "back", want: ["emergency", "Write it: estop PB1$"], fix: true, harm: "high" },
  { id: "w-stop-written-no", q: "Draw a motor starter", lines: ["stop PB1 M1 no", "start PB2 M1", "coil M1 \x22motor starter\x22"], expect: "back", want: ["Write it: stop PB1 M1$"], fix: true, sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "w-stop-normally-open", q: "Draw a motor starter", lines: ["stop PB1 M1 normally open \x22stop\x22", "start PB2 M1", "coil M1 \x22motor starter\x22"], expect: "back", fix: true, sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "w-overload-no", q: "Draw a motor starter", lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22motor starter\x22", "overload OL1 M1 no"], expect: "back", want: ["Write it: overload OL1 M1$"], fix: true, sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "w-rev-stop-button", q: "Draw a reversing starter", lines: ["button PB1 M1 M2 \x22stop\x22", "start PB2 M1", "start PB3 M2", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22"], expect: "back", want: ["Write it: stop PB1 M1 M2$"], fix: true, harm: "high" },
  { id: "w-rev-overload-no", q: "Draw a reversing starter", lines: ["stop PB1 M1 M2", "start PB2 M1", "start PB3 M2", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22", "overload OL1 M1 M2 no"], expect: "back", want: ["Write it: overload OL1 M1 M2$"], fix: true, harm: "high" },
  { id: "w-suction-nc", q: "Draw the control circuit for a booster pump", lines: ["pressure PS1 M1 nc \x22low suction cut-out\x22", "coil M1 \x22booster pump starter\x22"], expect: "back", want: ["Write it: pressure PS1 M1 \x22low suction cut-out\x22$"], fix: true, sim: function (c, S) { var lo = S.settle(c, { p: 0, setp: { PS1: 10 } }, {}), hi = S.settle(c, { p: 30, setp: { PS1: 10 } }, {}); return hi.M1 && !lo.M1 ? null : "the pump does not stop on low suction"; }, harm: "high" },
  { id: "w-refrig-hp-no", q: "Draw the control circuit for a refrigeration compressor", lines: ["pressure PS1 M1 \x22high pressure cut-out\x22", "coil M1 \x22compressor contactor\x22"], expect: "back", fix: true, sim: pressure("M1", "PS1", 400), harm: "high" },
  { id: "w-coil-names-switch", q: "Draw an air compressor control", lines: ["coil M1 PS1 \x22compressor starter\x22", "pressure PS1 \x22cut-out 120 psi, cut-in 90 psi\x22"], expect: "back", want: ["Write it: pressure PS1 M1 nc"], fix: true, sim: pressure("M1", "PS1", 120), harm: "high" },
  { id: "w-list-numbers", q: "Draw an air compressor control", lines: ["1. pressure PS1 M1 \x22high pressure cut-out\x22", "2. coil M1 \x22compressor starter\x22"], expect: "back", fix: true, sim: pressure("M1", "PS1", 120), harm: "high" },
  { id: "w-smart-quotes", q: "Draw an air compressor control", lines: ["pressure PS1 M1 “high pressure cut-out”", "coil M1 \x22compressor starter\x22"], expect: "back", fix: true, sim: pressure("M1", "PS1", 120), harm: "high" },
  { id: "w-kiln-no", q: "Draw the control circuit for a kiln", lines: ["temp TS1 CR1 \x22high limit\x22", "coil CR1 \x22kiln element contactor\x22"], expect: "back", fix: true, sim: temperature("CR1", "TS1", 900, true), harm: "high" },
  { id: "w-iec-practice-named", q: "Draw the control circuit for an air compressor with a pressure switch, to IEC 60204-1", lines: ["pressure PS1 M1 \x22opens at cut-out\x22", "coil M1 \x22compressor starter\x22"], expect: "back", want: ["IEC practice: IEC 60204-1:2016, 9.3.2"], not: ["NFPA"], fix: true, harm: "medium" },
  { id: "F-w-estop-no", q: "Draw a motor starter with an e-stop", lines: ["estop ES1 no", "stop PB1 M1", "start PB2 M1", "coil M1 \x22motor starter\x22"], expect: "back", want: ["ES1"], harm: "medium", note: "an emergency stop written no is drawn open in L1: the circuit works only while it is pressed" },

  // ---- what small models write back from a given: quotes dropped, list marks, capitals ---------------------------
  { id: "c-fill2-unquoted", q: "Draw the control circuit for a pump that fills a tank using a low float and a high float, with a contactor",
    lines: ["switch SS1 M1", "float FS1 M1 nc low level start", "float FS2 M1 nc high level stop", "coil M1 pump contactor", "overload OL1 M1"], expect: "ok", sim: fills(), harm: "high" },
  { id: "c-comp-unquoted", q: "Draw the control circuit for an air compressor with a pressure switch", lines: ["switch SS1 M1 on/off", "pressure PS1 M1 nc opens at cut-out", "coil M1 compressor starter", "overload OL1 M1"], expect: "ok", sim: pressure("M1", "PS1", 120), harm: "high" },
  { id: "c-rev-ALL", q: "Show a forward/reverse motor control circuit", lines: ["stop PB1 ALL", "start PB2 M1 \x22forward\x22", "start PB3 M2 \x22reverse\x22", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22", "interlock M1 M2", "overload OL1 M1 M2"], expect: "ok",
    sim: function (c, S) { return c.feed.some(function (f) { return f.id === "PB1"; }) ? null : "PB1 (ALL) is not drawn ahead of both"; }, harm: "high" },
  { id: "c-seq-arrow", q: "Draw a sequence control circuit: conveyor 2 can only start after conveyor 1 is running",
    lines: ["stop PB1 M1", "stop PB2 M2", "start PB3 M1", "start PB4 M2", "coil M1 \x22conveyor 1 starter\x22", "coil M2 M1 \x22conveyor 2 starter\x22 -> only after M1", "overload OL1 M1", "overload OL2 M2"], expect: "ok",
    sim: function (c, S) { var r = S.run(c, [{ pressed: { PB4: 1 } }, { pressed: { PB3: 1 } }, { pressed: { PB4: 1 } }, {}]); return !r[0].M2 && r[3].M2 ? null : "conveyor 2 does not wait for conveyor 1"; }, harm: "high" },
  { id: "c-delay-unquoted", q: "Draw a delayed start control circuit for a pump: it starts 30 seconds after start is pressed",
    lines: ["stop PB1 CR1", "start PB2 CR1", "relay CR1 run", "timer TR1 30 s CR1", "coil M1 TR1 pump starter", "overload OL1 M1 CR1"], expect: "ok",
    sim: function (c, S) { var r = S.run(c, [{ pressed: { PB2: 1 } }, {}, { done: { TR1: 1 } }]); return !r[1].M1 && r[2].M1 ? null : "the pump does not start when the timer is done"; }, harm: "high" },
  { id: "c-starter-numbered", q: "Draw a 3-wire start/stop control for a pump motor with a green run light", lines: ["1. stop PB1 M1", "2. start PB2 M1", "3. coil M1 \x22pump starter\x22", "4. overload OL1 M1", "5. lamp LT1 M1 \x22run\x22 green"], expect: "ok", sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "c-sump-bullets", q: "Draw the control circuit with a motor starter for a sump pump with a float switch", lines: ["- switch SS1 M1 \x22on/off\x22", "- float FS1 M1 \x22pump on\x22", "- coil M1 \x22pump starter\x22", "- overload OL1 M1"], expect: "ok", sim: level("M1", "FS1", 5, true), harm: "high" },
  // ---- more trades: right ones drawn, wrong ones sent back ----------------------------------------------------------
  { id: "r-greenhouse-heater", q: "Draw the control circuit for a greenhouse heater on a thermostat", lines: ["temp TS1 M1 nc \x22low temp\x22", "coil M1 \x22heater contactor\x22"], expect: "ok", sim: temperature("M1", "TS1", 10, true), harm: "high" },
  { id: "r-greenhouse-fan", q: "Draw the control circuit for a greenhouse exhaust fan on a thermostat", lines: ["temp TS1 M1 \x22high temp\x22", "coil M1 \x22exhaust fan contactor\x22"], expect: "ok", sim: temperature("M1", "TS1", 30, false), harm: "high" },
  { id: "r-irrigation-lwco", q: "Draw the control circuit for an irrigation pump drawing from a pond, with a low water cut-off", lines: ["stop PB1 M1", "start PB2 M1", "float FS1 M1 \x22low water cut-off\x22", "coil M1 \x22irrigation pump starter\x22", "overload OL1 M1"], expect: "ok", sim: function (c, S) { var r = S.run(c, [{ level: 5, at: { FS1: 2 }, pressed: { PB2: 1 } }, { level: 5, at: { FS1: 2 } }, { level: 1, at: { FS1: 2 } }]); return r[1].M1 && !r[2].M1 ? null : "the pump does not stop at low water"; }, harm: "high" },
  { id: "r-ejector", q: "Draw the control circuit for a sewage ejector pump with on and off floats", lines: ["float FS1 M1 \x22pump on\x22", "float FS2 M1 \x22pump off\x22", "coil M1 \x22ejector pump contactor\x22"], expect: "ok", sim: sumps(), harm: "high" },
  { id: "r-waterer-heater", q: "Draw the control circuit for a livestock waterer heater", lines: ["temp TS1 M1 nc \x22low temp\x22", "coil M1 \x22waterer heater contactor\x22"], expect: "ok", harm: "high" },
  { id: "r-well-lp-cutoff", q: "Draw the control circuit for a well pump with a pressure switch and a low pressure cut-off", lines: ["pressure PS1 M1 nc \x22cut-in 40 psi, cut-out 60 psi\x22", "pressure PS2 M1 \x22low pressure cut-off\x22", "coil M1 \x22well pump contactor\x22"], expect: "ok", harm: "high" },
  { id: "w-pump-hightemp-no", q: "Draw the control circuit for a pump with a high temperature cut-out", lines: ["stop PB1 M1", "start PB2 M1", "temp TS1 M1 \x22high temp cut-out\x22", "coil M1 \x22pump starter\x22"], expect: "back", want: ["Write it: temp TS1 M1 nc \x22high temp cut-out\x22$"], fix: true, sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "w-pond-lwco-nc", q: "Draw the control circuit for an irrigation pump drawing from a pond, with a low water cut-off", lines: ["stop PB1 M1", "start PB2 M1", "float FS1 M1 nc \x22low water cut-off\x22", "coil M1 \x22irrigation pump starter\x22"], expect: "back", want: ["Write it: float FS1 M1 \x22low water cut-off\x22$"], fix: true, harm: "high" },
  { id: "w-suction-cutoff-nc", q: "Draw the control circuit for a transfer pump with a low suction pressure cut-off", lines: ["pressure PS1 M1 nc \x22low suction cut-off\x22", "coil M1 \x22transfer pump starter\x22"], expect: "back", fix: true, harm: "high" },
  // ---- what a cut-out check must leave alone: a relay used closed, an alarm, a valve, a timer ------------------------
  { id: "r-relay-used-closed", q: "Draw a pump with a high pressure trip through a relay", lines: ["pressure PS1 CR1 \x22high pressure cut-out\x22", "coil CR1 \x22pressure relay\x22", "stop PB1 M1", "start PB2 M1", "coil M1 CR1 off \x22pump starter\x22"], expect: "ok",
    sim: function (c, S) { var r = S.run(c, [{ p: 50, setp: { PS1: 100 }, pressed: { PB2: 1 } }, { p: 50, setp: { PS1: 100 } }, { p: 150, setp: { PS1: 100 } }]); return r[1].M1 && !r[2].M1 ? null : "the pump does not stop on high pressure"; }, harm: "high" },
  { id: "r-alarm-horn-high", q: "Draw a compressor with a high pressure alarm horn", lines: ["pressure PS1 M1 nc \x22cut-out 120 psi\x22", "coil M1 \x22compressor starter\x22", "pressure PS2 AH1 \x22high pressure cut-out alarm\x22", "horn AH1 PS2"], expect: "ok", harm: "high" },
  { id: "r-relief-valve", q: "Draw a relief solenoid on high pressure", lines: ["pressure PS1 SOL1 \x22high pressure cut-out\x22", "solenoid SOL1 PS1 \x22dump valve\x22"], expect: "ok", harm: "high" },
  { id: "r-timer-high-temp", q: "Draw a pump that stops 5 seconds after a high temperature", lines: ["temp TS1 TR1 \x22high temp cut-out\x22", "timer TR1 \x225 s\x22", "stop PB1 M1", "start PB2 M1", "coil M1 TR1 off \x22pump starter\x22"], expect: "ok", harm: "high" },
  { id: "r-fill-suction-guard", q: "Draw a fill pump for a tank with low and high floats and a suction low level float",
    lines: ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "float FS3 M1 \x22suction low level\x22", "coil M1 \x22fill pump contactor\x22"], expect: "ok", sim: fills("M1", { FS1: 3, FS2: 8 }, { FS3: -100 }), harm: "high" },
  // ---- stop PB1 all -------------------------------------------------------------------------------------------------
  { id: "s-all-one-coil", q: "Draw a motor starter", lines: ["stop PB1 all", "start PB2 M1", "coil M1 \x22motor starter\x22"], expect: "ok", sim: threeWire("M1", "PB2", "PB1"), harm: "high" },
  { id: "s-all-two-seq", q: "Draw two motors", lines: ["stop PB1 all", "start PB2 M1", "start PB3 M2", "coil M1 \x22motor 1 starter\x22", "coil M2 M1 \x22motor 2 starter\x22"], expect: "ok",
    sim: function (c, S) { var r = S.run(c, [{ pressed: { PB2: 1 } }, { pressed: { PB3: 1 } }, {}, { pressed: { PB1: 1 } }, {}]); return r[2].M1 && r[2].M2 && !r[4].M1 && !r[4].M2 ? null : "stop all does not stop both"; }, harm: "high" },
  { id: "s-all-lamp-off", q: "Draw a motor starter", lines: ["stop PB1 all", "start PB2 M1", "coil M1 \x22motor starter\x22", "lamp LT1 M1 \x22run\x22 green"], expect: "ok",
    sim: function (c, S) { return c.feed.some(function (f) { return f.id === "PB1"; }) ? null : "PB1 is not drawn in L1"; }, harm: "medium" },
  { id: "s-named-not-all", q: "Draw a motor starter", lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22motor starter\x22", "coil CR1 M1 \x22aux relay\x22"], expect: "ok",
    sim: function (c, S) { return c.feed.some(function (f) { return f.id === "PB1"; }) ? "PB1 named M1 moved into L1" : null; }, harm: "high" },
  { id: "s-all-label-quoted", q: "Draw a motor starter", lines: ["stop PB1 M1 \x22all stop\x22", "start PB2 M1", "coil M1 \x22motor starter\x22"], expect: "ok",
    sim: function (c, S) { return c.feed.some(function (f) { return f.id === "PB1"; }) ? "a stop named M1 with the label all stop moved into L1" : null; }, harm: "high" }
];
