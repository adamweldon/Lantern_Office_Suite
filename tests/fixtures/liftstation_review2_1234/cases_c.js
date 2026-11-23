// cases_c.js -- rule 3: what a float is for. AI_CONTROL floatJob ("emergency" the alarm only where nothing in the name
// starts, runs, stops or cuts off a pump; shutdown and cutoff are off), AI_PUMP_STATION's fallback floatJob (used when
// AI_CONTROL is dropped: rule 2 of the header, every module droppable), AI_STATION spec()'s key() (a low water cutoff a
// redundant off; "Lag 1" and "Lag 2" two floats), the jobless-float lines, and MAKE LEVELS' lag float for each pump
// after the lead when there are three or more.
// What is right: a float that starts a pump is never read as one that stops it; the third pump's start is a lag float.
"use strict";
var lib = require("./lib.js");

function job(id, label, want, harm, why) {
  return { id: id, harm: harm || "medium", input: "floatJob(“" + label + "”)", right: want + (why ? " -- " + why : ""),
    run: function () { var got = lib.D.L.aiControl.floatJob(label); return Promise.resolve(lib.want(got === want, "read as " + got + " (1.24.33: " + lib.P.L.aiControl.floatJob(label) + ")")); } };
}
// AI_PUMP_STATION alone (AI_CONTROL dropped): the same job as AI_CONTROL gives
function fallback(id, label, harm) {
  return { id: id, harm: harm || "low", input: "AI_PUMP_STATION's floatJob(“" + label + "”) with AI_CONTROL dropped", right: "the job AI_CONTROL gives it",
    run: function () {
      var L = lib.D.L, ctl = L.aiControl.floatJob(label), save = L.aiControl, got;
      L.aiControl = null; try { got = L.aiPumpStation.floatJob(label); } finally { L.aiControl = save; }
      return Promise.resolve(lib.want(got === ctl, "the fallback reads it " + got + ", AI_CONTROL " + ctl));
    } };
}
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
// MAKE LEVELS: drawn with these floats bottom up, or sent back with a line that is right
function levels(id, harm, lines, q, e) {
  return { id: id, harm: harm, input: blk("LEVELS", "Wet well", lines) + "  /  " + q, right: e.right,
    run: function () {
      var m = lib.build(lib.D, blk("LEVELS", "Wet well", lines), q);
      if (e.back) {
        if (m.ok) return Promise.resolve("drawn: " + m.plan.floats.map(function (f) { return f.id + ":" + f.job; }).join(","));
        var p = m.problems.join(" | "), bad = [];
        (e.problems || []).forEach(function (r) { if (!lib.rx(r).test(p)) bad.push("what goes back lacks /" + r + "/"); });
        (e.notProblems || []).forEach(function (r) { if (lib.rx(r).test(p)) bad.push("what goes back has /" + r + "/"); });
        return Promise.resolve(bad.length ? bad.join("; ") + " -- " + lib.short(p, 400) : "");
      }
      if (!m.ok) return Promise.resolve("sent back: " + lib.short(m.problems.join(" | "), 400));
      var got = m.plan.floats.map(function (f) { return f.id + ":" + f.job; }).join(",");
      return Promise.resolve(lib.want(got === e.floats, "drawn " + got + ", want " + e.floats));
    } };
}

var cases = [
  // ---- the emergency float ------------------------------------------------------------------------------------------
  job("C-emergency-high", "Emergency High", "alarm", "high", "the 35B's float: the high level alarm, above the lead"),
  job("C-emergency-high-level", "Emergency High Level", "alarm"),
  job("C-emergency-high-water", "Emergency High Water", "alarm"),
  job("C-emergency-high-float", "Emergency High Float", "alarm"),
  job("C-emergency-high-hyphen", "emergency-high", "alarm"),
  job("C-emergency-hi", "emergency hi", "alarm"),
  job("C-emergency-high-alarm", "Emergency High Alarm", "alarm"),
  job("C-emergency-overflow", "emergency overflow", "alarm"),
  job("C-emergency-off", "Emergency Off", "off", "high", "an off float never the alarm"),
  job("C-emergency-stop", "Emergency Stop Float", "off", "high"),
  job("C-emergency-low", "Emergency Low", "off", "high"),
  job("C-emergency-low-cutoff", "emergency low level cutoff", "off", "high"),
  job("C-emergency-shutdown", "Emergency Shutdown", "off", "medium"),
  job("C-emergency-low-level-alarm", "emergency low level alarm", "low", "medium"),
  job("C-emergency-start-both", "Emergency High - Start Both Pumps", "lag", "high", "it starts the second pump"),
  job("C-emergency-high-lag-start", "Emergency High Lag Start", "lag", "high"),
  job("C-emergency-lag-on", "Emergency Lag On", "lag", "medium"),
  job("C-emergency-both-run", "emergency high level both pumps run", "lag", "medium"),
  job("C-emergency-redundant-start", "Emergency High (Redundant Start)", "lead", "medium", "a redundant start float starts the pumps (lead, or lag): never off, which wires it to stop them"),
  job("C-emergency-all-pumps-on", "Emergency High / All Pumps On", "lag", "low", "all pumps on is the lag float's job"),
  job("C-emergency-cut-out", "Emergency Cut Out", "off", "low", "a cut out stops the pumps, as cutout does"),
  // ---- shutdown and cutoff ------------------------------------------------------------------------------------------
  job("C-low-water-cutoff", "Low Water Cutoff", "off"),
  job("C-low-water-cut-off-hyphen", "low water cut-off", "off"),
  job("C-low-level-cutout", "Low Level Cutout", "off"),
  job("C-pump-cut-out", "Pump Cut Out", "off", "low"),
  job("C-shutdown", "Shutdown", "off"),
  job("C-pump-shutdown", "Pump Shutdown", "off"),
  job("C-shutoff", "Shutoff", "off"),
  job("C-high-level-shutdown", "High Level Shutdown", "alarm", "low", "a high level shutdown float is the high level alarm's (it is high in the well), never the pumps' off"),
  // ---- the rest, as before -------------------------------------------------------------------------------------------
  job("C-lag-1", "Lag 1", "lag"),
  job("C-lag-2-on", "Lag 2 On", "lag"),
  job("C-pump-2-on", "Pump 2 On", "lag"),
  job("C-high-high", "High High", "alarm"),
  job("C-lead-lag-off", "Lead/Lag Off", "off"),
  job("C-high-level", "high level", "alarm"),
  job("C-lead-on", "lead on", "lead"),
  job("C-start-2", "Start 2", "lag", "medium", "the second start float is the lag pump's"),
  job("C-pump-3-on", "Pump 3 On", "lag", "medium", "the third pump's start is a lag float (a triplex has two)"),
  job("C-start-pump-3", "Start Pump 3", "lag", "medium"),
  // ---- the fallback, when AI_CONTROL is dropped -------------------------------------------------------------------------
  fallback("C-fallback-emergency-high", "Emergency High", "medium"),
  fallback("C-fallback-emergency-off", "Emergency Off", "medium"),
  fallback("C-fallback-emergency-start-both", "Emergency High - Start Both Pumps", "medium"),
  fallback("C-fallback-shutdown", "Emergency Shutdown"),
  fallback("C-fallback-pump-shutdown", "Pump Shutdown"),
  fallback("C-fallback-both-run", "emergency high level both pumps run"),
  fallback("C-fallback-lag-off", "Lag Off"),
  // ---- MAKE LEVELS: a lag float for each pump after the lead ------------------------------------------------------------
  levels("C-levels-triplex-two-lags", "high", ["pump P1 P2 P3", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag 1 on" 4 ft', 'float FS4 "lag 2 on" 5 ft', 'float FS5 "high level alarm" 6 ft'],
    "Draw the float levels in the wet well of a triplex lift station", { right: "a triplex's two lag floats drawn", floats: "FS1:off,FS2:lead,FS3:lag,FS4:lag,FS5:alarm" }),
  levels("C-levels-triplex-lag-order", "medium", ["pump P1 P2 P3", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag 2 on" 5 ft', 'float FS4 "lag 1 on" 4 ft', 'float FS5 "high level alarm" 6 ft'],
    "Draw the float levels in the wet well of a triplex lift station", { right: "the two lag floats by their heights", floats: "FS1:off,FS2:lead,FS4:lag,FS3:lag,FS5:alarm" }),
  levels("C-levels-quadplex-three-lags", "medium", ["pump P1 P2 P3 P4", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag 1 on" 4 ft', 'float FS4 "lag 2 on" 5 ft', 'float FS5 "lag 3 on" 6 ft', 'float FS6 "high level alarm" 7 ft'],
    "Draw the float levels in the wet well of a four pump lift station", { right: "four pumps, three lag floats", floats: "FS1:off,FS2:lead,FS3:lag,FS4:lag,FS5:lag,FS6:alarm" }),
  levels("C-levels-duplex-two-lags-back", "high", ["pump P1 P2", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag 1 on" 4 ft', 'float FS4 "lag 2 on" 5 ft', 'float FS5 "high level alarm" 6 ft'],
    "Draw the float levels in the wet well of a duplex lift station", { right: "two pumps have one lag pump: two lag floats go back", back: true, problems: ["two floats for lag on"] }),
  levels("C-levels-triplex-three-lags-back", "medium", ["pump P1 P2 P3", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "lag on" 4.5 ft', 'float FS5 "lag on" 5 ft', 'float FS6 "high level alarm" 6 ft'],
    "Draw the float levels in the wet well of a triplex lift station", { right: "three pumps have two lag pumps: a third lag float goes back, and the line to write is not the model's own floats again (three lag floats in it come back the same)", back: true, problems: ["two floats for lag on"], notProblems: ["float FS3 \x22lag on\x22 4 ft, float FS4 \x22lag on\x22 4.5 ft, float FS5 \x22lag on\x22 5 ft"] }),
  levels("C-levels-triplex-missing-height-line", "medium", ["pump P1 P2 P3", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag 1 on" 4 ft', 'float FS4 "lag 2 on"', 'float FS5 "high level alarm" 6 ft'],
    "Draw the float levels in the wet well of a triplex lift station", { right: "back for FS4's height, the line keeping it a lag float between FS3 and FS5", back: true, problems: ["FS4 has none", "float FS4 \x22lag[^\x22]*\x22 5 ft"] }),
  // ---- MAKE STATION's spec: the same floats ----------------------------------------------------------------------------
  { id: "C-station-triplex-lag-on-twice", harm: "medium", input: "MAKE STATION pumps 3, float FS3 \"lag on\" 4 ft, float FS4 \"lag on\" 5 ft",
    right: "a triplex's two lag floats, as MAKE LEVELS now draws them; never 'two heights for the lag on float ... write it once', a line that drops the second lag pump's float",
    run: function () { return Promise.resolve(lib.station(blk("STATION", "Triplex", ["pumps 3", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "lag on" 5 ft', 'float FS5 "high level alarm" 6 ft']), "write a schematic for a typical lift station", { count: 3, floats: "FS1:off,FS2:lead,FS3:lag,FS4:lag,FS5:alarm" })); } },
  { id: "C-station-triplex-lag12", harm: "high", input: "MAKE STATION pumps 3 with lag 1 on and lag 2 on", right: "both lag floats drawn",
    run: function () { return Promise.resolve(lib.station(blk("STATION", "Triplex", ["pumps 3", 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag 1 on"', 'float FS4 "lag 2 on"', 'float FS5 "high level alarm"']), "write a schematic for a typical lift station", { count: 3, floats: "FS1:off,FS2:lead,FS3:lag,FS4:lag,FS5:alarm" })); } },
  { id: "C-station-duplex-lag12", harm: "medium", input: "MAKE STATION pumps 2 with lag 1 on and lag 2 on",
    right: "a duplex has one lag pump: Lantern says it, or sends it back with a line that has one lag float; never the drawings' own refusals with a line that repeats both lag floats",
    run: function () {
      var m = lib.build(lib.D, blk("STATION", "Duplex", ["pumps 2", 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag 1 on"', 'float FS4 "lag 2 on"', 'float FS5 "high level alarm"']), "write a schematic for a typical lift station");
      if (m.ok) return Promise.resolve(lib.want(/FS4|lag 2/.test(m.summary), "drawn and FS4 not mentioned"));
      var p = m.problems.join(" | ");
      return Promise.resolve(lib.want(!/float FS3 \x22lag on\x22, float FS4 \x22lag on\x22/.test(p), "back with a line that repeats both lag floats: " + lib.short(p, 400)));
    } },
  { id: "C-station-low-water-cutoff", harm: "medium", input: "MAKE STATION with low water cutoff and off",
    right: "the cutoff drawn under the off float",
    run: function () { return Promise.resolve(lib.station(blk("STATION", "Duplex", ["pumps 2", 'float FS0 "low water cutoff"', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"']), "write a schematic for a typical lift station", { floats: "FS0:off,FS1:off,FS2:lead,FS3:lag,FS4:alarm" })); } },
  { id: "C-station-emergency-high-35b-heights", harm: "high", input: "MAKE STATION with float H3 \"Emergency High\" 6 ft above H1 \"High Level\" 4 ft",
    right: "Emergency High the alarm, the high level float the lead (said); drawn to scale in order",
    run: function () { return Promise.resolve(lib.station(blk("STATION", "Duplex", ["pumps 2", 'float H2 "Low Level" 2 ft', 'float H1 "High Level" 4 ft', 'float H3 "Emergency High" 6 ft']), "write a schematic for a typical lift station", { floats: "H2:off,H1:lead,H3:alarm", levels: "H2:off,H1:lead,H3:alarm" })); } },
  { id: "C-control-fs4-emergency-high", harm: "high", input: "MAKE CONTROL duplex with FS4 \"emergency high\" and a horn on FS4",
    right: "FS4 works the alarm light and horn, not a third start",
    run: function () {
      var m = lib.build(lib.D, blk("CONTROL", "Duplex", ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "emergency high"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'horn AH1 FS4 "high level"']), "draw the control circuit for a duplex lift station with an alternating relay");
      if (!m.ok) return Promise.resolve("refused: " + m.problems.join(" | "));
      var rs = m.plan.circuit.rungs, starts = rs.filter(function (r) { return (r.starts || []).some(function (e) { return e.id === "FS4"; }); }), horn = rs.some(function (r) { return r.out.kind === "horn" && r.series.concat(r.starts || []).some(function (e) { return e.id === "FS4"; }); });
      return Promise.resolve(lib.want(!starts.length && horn, "FS4 starts " + starts.length + " rung(s); horn on FS4 " + horn));
    } }
];
module.exports = cases;
