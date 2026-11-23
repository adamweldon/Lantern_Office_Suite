// cases_f.js -- floatJob in AI_CONTROL (1.24.34: emergency, shutdown, cutoff, "start 2", "pump 3 on", a redundant start,
// all pumps) and AI_PUMP_STATION's fallback agreeing with it; then MAKE CONTROL duplex circuits a model would write with
// these labels, simulated (sim.js of the first review of 1.23.0): which coil runs at which water level, and the alarm.
"use strict";
var lib = require("./lib.js");
var Q = "\x22";
function job(id, label, want, why, harm) {
  return { id: id, harm: harm || "medium", right: true, input: { label: label }, why: why || "",
    run: async function (x) { var g = x.N.L.aiControl.floatJob(label); return g === want ? "" : "“" + label + "” is read as " + g + ", want " + want + " (1.24.33: " + x.O.L.aiControl.floatJob(label) + ")"; } };
}
var C = [];
C.push(job("F-emergency-high", "Emergency High", "alarm", "the 35B's float in Adam's chat", "high"));
C.push(job("F-emergency-high-caps", "EMERGENCY HIGH", "alarm"));
C.push(job("F-emergency-hi", "emergency hi", "alarm"));
C.push(job("F-emergency-high-level", "Emergency High Level", "alarm"));
C.push(job("F-emergency-overflow", "emergency overflow", "alarm"));
C.push(job("F-emergency-alone", "emergency", "alarm"));
C.push(job("F-emergency-off", "emergency off", "off"));
C.push(job("F-emergency-shutdown", "emergency shutdown", "off"));
C.push(job("F-emergency-stop", "emergency stop", "off"));
C.push(job("F-emergency-low", "emergency low", "off"));
C.push(job("F-emergency-low-cutoff", "emergency low level cutoff", "off"));
C.push(job("F-emergency-start-both", "Emergency High - Start Both Pumps", "lag"));
C.push(job("F-emergency-all-on", "emergency all pumps on", "lag"));
C.push(job("F-emergency-standby", "emergency high / standby pump on", "lag"));
C.push(job("F-shutdown", "shutdown", "off"));
C.push(job("F-pump-shutoff", "pump shutoff", "off"));
C.push(job("F-low-water-cutoff", "low water cutoff", "off"));
C.push(job("F-cutout", "low level cutout", "off"));
C.push(job("F-start-2", "start 2", "lag"));
C.push(job("F-start-hash-2", "start #2", "lag"));
C.push(job("F-start-3", "start 3", "lag"));
C.push(job("F-start-1", "start 1", "lead"));
C.push(job("F-pump-3-on", "pump 3 on", "lag"));
C.push(job("F-pump-three-on", "pump three on", "lag"));
C.push(job("F-P3-start", "P3 start", "lag"));
C.push(job("F-pump-1-on", "Pump 1 Start", "lead"));
C.push(job("F-all-pumps-on", "all pumps on", "lag"));
C.push(job("F-all-pumps-start", "all pumps start", "lag"));
C.push(job("F-all-pumps-off", "all pumps off", "off"));
C.push(job("F-redundant-start", "redundant start", "lead", "a start (1.24.33 read it as an off float)"));
C.push(job("F-redundant-on", "redundant on", "lead"));
C.push(job("F-backup-start", "backup start", "lead"));
C.push(job("F-redundant-off", "redundant off", "off"));
C.push(job("F-redundant-low", "redundant low level", "off"));
C.push(job("F-redundant-high", "redundant high level", "alarm"));
C.push(job("F-high-level-start", "High Level Start", "lead"));
C.push(job("F-lag-off", "lag pump off", "off"));
C.push(job("F-low-alarm", "low level alarm", "low"));
C.push(job("F-pump-no-2", "Pump No. 2 On", "lag", "“Pump No. 2”, as nameplates and drawings write it: read as the lead (pump\\s*#?\\s*2 does not take “No.”); 1.24.33 the same", "low"));
// AI_PUMP_STATION's fallback (used when AI_CONTROL is dropped): the same jobs
C.push({ id: "F-fallback-agrees", harm: "low", right: true, input: { labels: "start 2, start #2, start 3, pump 3 on, pump #3 on, pump two on, pump three on, P2 on, P3 start, start pump 2, assist, Hi Level, Lo Level, Hi-Hi, top float, bottom float" },
  why: "AI_PUMP_STATION's floatJob, with AI_CONTROL's taken away, reads what AI_CONTROL reads (its comment: “AI_PUMP_STATION's fallback says the same” -- true of the emergency words only)",
  run: async function (x) {
    var L = x.N.L, keep = L.aiControl.floatJob, bad = [];
    var T = ["emergency high", "emergency shutdown", "emergency low", "Emergency High - Start Both Pumps", "all pumps on", "redundant start", "backup start", "shutdown", "low water cutoff",
      "start 2", "start #2", "start 3", "pump 3 on", "pump #3 on", "pump two on", "pump three on", "P2 on", "P3 start", "start pump 2", "assist", "Hi Level", "Lo Level", "Hi-Hi", "top float", "bottom float"];
    T.forEach(function (t) { var c = keep(t), fb; delete L.aiControl.floatJob; try { fb = L.aiPumpStation.floatJob(t); } finally { L.aiControl.floatJob = keep; } if (fb !== c) bad.push("“" + t + "” " + c + " / fallback " + fb); });
    return bad.length ? "AI_CONTROL / fallback differ: " + bad.join("; ") : "";
  } });
// ---- MAKE CONTROL duplex circuits, simulated ---------------------------------------------------------------------
var QC = "draw the control circuit for a duplex lift station with an alternating relay";
var TAIL = ["alternator AR M1 M2", "coil M1 " + Q + "pump 1 starter" + Q, "coil M2 " + Q + "pump 2 starter" + Q];
// fl: [[id, label, level]]; the alarm: the float whose job is alarm; want: the duplex runs (sim.duplex), the alarm lit
function dup(id, fl, more, why, harm, wantFail) {
  return { id: id, harm: harm || "high", right: !wantFail, input: { q: QC, lines: fl.map(function (z) { return "float " + z[0] + " " + Q + z[1] + Q; }).concat(TAIL, more) }, why: why,
    run: async function (x) {
      var t = lib.sch(id, fl.map(function (z) { return "float " + z[0] + " " + Q + z[1] + Q; }).concat(TAIL, more), "CONTROL"), m = lib.build(x.N.L, t, QC);
      if (wantFail) return wantFail(m) || "";
      if (!(m && m.ok)) return "sent back: " + lib.probs(m);
      var fj = x.N.L.aiControl.floatJob, by = {}, other = [];
      fl.forEach(function (z) { var j = fj(z[1]); if (j === "alarm" && /\blag\b/i.test(z[1])) j = "lag"; if (!by[j]) by[j] = z[0]; else other.push([z[0], z[2]]); });
      var lv = { off: 1, lead: 2, lag: 3, alarm: 4 };
      fl.forEach(function (z) { var j = fj(z[1]); if (by[j] === z[0] && z[2] !== lv[j]) other.push([z[0], z[2]]); });
      var r = lib.sim.duplex(m.plan.circuit, { floats: { off: by.off, lead: by.lead, lag: by.lag, alarm: by.alarm }, pumps: ["M1", "M2"], alarms: by.alarm ? lib.alarmsOn(m.plan.circuit, by.alarm) : [], otherFloats: other });
      return r.length ? r.join("; ") : "";
    } };
}
C.push(dup("F-c-std", [["FS1", "off", 1], ["FS2", "lead on", 2], ["FS3", "lag on", 3], ["FS4", "high level alarm", 4]], ["lamp LT1 FS4 " + Q + "high level" + Q + " red"], "the guide's duplex"));
C.push(dup("F-c-pump-n-emergency", [["FS1", "pumps off", 1], ["FS2", "pump 1 on", 2], ["FS3", "pump 2 on", 3], ["FS4", "emergency high", 4]], ["lamp LT1 FS4 " + Q + "high level" + Q + " red"], "pump 1/2 on and an emergency high (1.24.33: two lead floats, sent back)"));
C.push(dup("F-c-start-n", [["FS1", "stop", 1], ["FS2", "start 1", 2], ["FS3", "start 2", 3], ["FS4", "high level alarm", 4]], ["lamp LT1 FS4 " + Q + "high level" + Q + " red"], "stop / start 1 / start 2"));
C.push(dup("F-c-all-pumps-on", [["FS1", "all pumps off", 1], ["FS2", "lead pump on", 2], ["FS3", "all pumps on", 3], ["FS4", "high water alarm", 4]], ["horn AH1 FS4 " + Q + "high water" + Q], "all pumps on as the lag, a horn on the alarm"));
C.push(dup("F-c-emergency-shutdown", [["FS0", "emergency shutdown", 0.5], ["FS1", "off", 1], ["FS2", "lead on", 2], ["FS3", "lag on", 3], ["FS4", "emergency high", 4]], ["lamp LT1 FS4 " + Q + "emergency high" + Q + " red"], "a redundant low cutoff, called emergency shutdown, under the off float"));
C.push(dup("F-c-low-water-cutoff", [["FS0", "low water cutoff", 0.5], ["FS1", "pumps off", 1], ["FS2", "lead on", 2], ["FS3", "lag on", 3], ["FS4", "high level alarm", 4]], ["lamp LT1 FS4 " + Q + "high level" + Q + " red"], "a low water cutoff"));
C.push(dup("F-c-shutdown", [["FS1", "shutdown", 1], ["FS2", "lead start", 2], ["FS3", "lag start", 3], ["FS4", "alarm", 4]], ["lamp LT1 FS4 " + Q + "alarm" + Q + " red"], "shutdown as the off float (1.24.33: no job, sent back)"));
C.push(dup("F-c-P1-P2", [["FS1", "P1/P2 off", 1], ["FS2", "P1 on", 2], ["FS3", "P2 on", 3], ["FS4", "high level", 4]], ["lamp LT1 FS4 " + Q + "high level" + Q + " red"], "P1 on / P2 on"));
C.push(dup("F-c-ls-tags", [["LS1", "stop all", 1], ["LS2", "start #1", 2], ["LS3", "start #2", 3], ["LS4", "emergency high level", 4]], ["lamp LT1 LS4 " + Q + "high level" + Q + " red"], "LS tags, start #1 / start #2"));
C.push(dup("F-c-two-alarms", [["FS1", "off", 1], ["FS2", "lead on", 2], ["FS3", "lag on", 3], ["FS4", "emergency high", 4], ["FS5", "high high alarm", 5]], ["lamp LT1 FS4 " + Q + "emergency high" + Q + " red", "lamp LT2 FS5 " + Q + "high high" + Q + " red"], "an emergency high and a high high alarm"));
C.push(dup("F-c-emergency-start-both", [["FS1", "off", 1], ["FS2", "lead on", 2], ["FS3", "emergency high - start both pumps", 3]], [], "an emergency high that starts both pumps: the lag"));
C.push(dup("F-c-redundant-start", [["FS1", "off", 1], ["FS2", "lead on", 2], ["FS3", "redundant start", 3], ["FS4", "high level alarm", 4]], ["lamp LT1 FS4 " + Q + "high level" + Q + " red"],
  "a redundant start beside the lead: back once, with the line that writes it as the lag (1.24.33 drew it as a second off float in series, and the pumps started only at FS3)", "medium",
  function (m) { if (m && m.ok) return "drawn as it stands"; var ln = lib.lineOf((m.problems || []).join(" ")); return /float FS3 \x22lag on\x22/.test(ln) ? "" : "the line: " + ln; }));
C.push({ id: "F-c-redundant-start-copied", harm: "medium", right: true, input: { q: QC },
  why: "the line handed back for a redundant start, copied: a duplex that runs",
  run: async function (x) {
    var t = lib.sch("Duplex", ["float FS1 " + Q + "off" + Q, "float FS2 " + Q + "lead on" + Q, "float FS3 " + Q + "lag on" + Q, "float FS4 " + Q + "high level alarm" + Q].concat(TAIL, ["lamp LT1 FS4 " + Q + "high level" + Q + " red"]), "CONTROL"), m = lib.build(x.N.L, t, QC);
    if (!(m && m.ok)) return "sent back: " + lib.probs(m);
    var r = lib.sim.duplex(m.plan.circuit, { floats: { off: "FS1", lead: "FS2", lag: "FS3", alarm: "FS4" }, pumps: ["M1", "M2"], alarms: lib.alarmsOn(m.plan.circuit, "FS4") });
    return r.join("; ");
  } });
// a simplex sump, its floats in series with the pump: "shutdown" now an off float, so the pair is made a hold-in
C.push({ id: "F-c-simplex-shutdown", harm: "medium", right: true, input: { q: "draw the control circuit for a sump pump: a float switch starts the pump and another stops it" },
  why: "a simplex pump-down with floats “shutdown” and “high level” in series: the pump starts at the high level, holds in, stops at the shutdown float",
  run: async function (x) {
    var q = "draw the control circuit for a sump pump: a float switch starts the pump and another stops it";
    var t = lib.sch("Sump", ["coil M1 " + Q + "pump starter" + Q + " FS1 FS2", "float FS1 " + Q + "shutdown" + Q, "float FS2 " + Q + "high level" + Q], "CONTROL"), m = lib.build(x.N.L, t, q);
    if (!(m && m.ok)) return "sent back: " + lib.probs(m);
    var r = lib.runs(m.plan.circuit, { FS1: 1, FS2: 2 }, [0, 1.5, 2.5, 1.5, 0.5, 1.5], []);
    return r === "0: 1.5: 2.5:M1 1.5:M1 0.5: 1.5:" ? "" : "the pump runs " + r;
  } });
module.exports = C;
