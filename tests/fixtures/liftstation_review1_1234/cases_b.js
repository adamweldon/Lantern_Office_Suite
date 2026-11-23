// cases_b.js -- B: a station question's part-and-wire MAKE SCHEMATIC read as the station (AI_STATION partsOf, partRole,
// fromParts, tookText, the build wrapper). Each block is one a model could write for a lift station; each drawing is
// judged against what a duplex (or simplex, triplex) lift station is: Ten States Standards 42/44/46 and common duplex
// practice (off, lead on, lag on, high level alarm floats; a check valve then a shutoff valve on each discharge).
"use strict";
var fs = require("fs"), path = require("path");
var H = require("./lib.js");
var P = H.parts, W = H.wires;
var Q = "write a schematic for a typical lift station. Include any other drawings a lift station would need";
var CHAT = JSON.parse(fs.readFileSync(path.join(H.ROOT, "tests/fixtures/liftstation_1234/chat_35b.json"), "utf8"));
var R1 = CHAT.replies[0].reply, PIPE = R1.slice(R1.indexOf("MAKE SCHEMATIC: Lift Station Piping"));
var DUP = [["V1", "source", "120 V"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"]];
var FL4 = [["F1", "float", "Off"], ["F2", "float", "Lead On"], ["F3", "float", "Lag On"], ["F4", "float", "High Level Alarm"]];
function blkOf(list, title, mode) { return H.sch(title || "Lift Station", (mode ? [mode] : []).concat(P(list)).concat(W(["V1 M1", "M1 V1"]))); }
function rd(text, q) {
  var r = H.L().aiAct.build(text, q || Q), sp = r && r.plan && r.plan.spec;
  return { r: r, ok: !!(r && r.ok), readAs: r && r.readAs || "", jobs: sp ? sp.floats.map(function (f) { return f.job; }).join(",") : "", fl: sp ? sp.floats.map(function (f) { return f.id + ":" + f.job + (f.height ? "@" + f.height : ""); }).join(",") : "",
    pumps: sp ? sp.pumps.length : 0, well: sp ? sp.well : "", inlet: sp ? sp.inlet : "", main: sp ? sp.main : "", valve: sp ? sp.valve : "", horn: sp ? sp.horn : false,
    summary: String(r && r.summary || ""), problems: (r && r.problems || []).join(" ;; "), views: H.viewsOf(r), title: r && r.plan ? r.plan.title : "" };
}
function brief(x) { return "ok " + x.ok + " " + x.readAs + " floats " + x.fl + " pumps " + x.pumps + (x.problems ? " PROBLEMS " + x.problems : "") + (x.inlet ? " inlet " + x.inlet : "") + (x.well ? " well " + x.well : ""); }
function C(id, harm, text, right, judge, q) {
  return { id: id, harm: harm, input: { question: q || Q, reply: text }, right: right, run: function () { return H.boot().then(function () { return judge(rd(text, q)); }); } };
}
function want(x, jobs, pumps) { return x.ok && x.readAs === "STATION" && x.jobs === jobs && (pumps == null || x.pumps === pumps) ? "" : brief(x); }

module.exports = [
  // --- the guard: blocks read right ---------------------------------------------------------------------------------
  C("B-01", "high", R1, "The 35B's two blocks (Adam's chat): the station, 2 pumps, floats off (H2), lead (H1, said), alarm (H3); the wet well, gate valves; three drawings.",
    function (x) { return x.ok && x.readAs === "STATION" && x.fl === "H2:off,H1:lead,H3:alarm" && x.pumps === 2 && x.valve === "gate" && x.views === "control,levels,piping" ? "" : brief(x); }),
  C("B-02", "medium", PIPE, "The piping block alone: the station, the usual floats said.",
    function (x) { return x.ok && x.readAs === "STATION" && x.jobs === "off,lead,lag,alarm" && /the usual floats for 2 pumps/.test(x.summary) ? "" : brief(x); }),
  C("B-03", "medium", blkOf(DUP.concat(FL4).concat([["H1", "horn", "Alarm Horn"]])), "float parts by their jobs, and the horn: all four floats, a horn.",
    function (x) { return want(x, "off,lead,lag,alarm", 2) || (x.horn ? "" : "no horn"); }),
  C("B-04", "medium", blkOf(DUP.concat([["LS1", "sensor", "Off"], ["LS2", "sensor", "Lead On"], ["LS3", "sensor", "Lag On"], ["LSH1", "sensor", "High Alarm"]])), "level sensors tagged LS: four floats.",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-05", "medium", blkOf(DUP.concat([["S1", "switch", "Float - Off"], ["S2", "switch", "Float - Lead"], ["S3", "switch", "Float - Lag"], ["S4", "switch", "Float - High Alarm"]])), "switches named Float - <job>: four floats.",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-06", "medium", H.sch("Lift Station Piping", ["mode hydraulic"].concat(P([["WW", "tank", "Wet Well"], ["P1", "pump", "Pump No. 1"], ["P2", "pump", "Pump No. 2"], ["CV1", "valve", "Swing Check"], ["CV2", "valve", "Swing Check"], ["PV1", "valve", "Plug Valve"], ["PV2", "valve", "Plug Valve"], ["FM", "pipe", "6 in Force Main"], ["IN", "pipe", "8 in Gravity Inlet"]])).concat(W(["IN WW", "WW P1", "WW P2", "P1 CV1", "CV1 PV1", "PV1 FM", "P2 CV2", "CV2 PV2", "PV2 FM"]))),
    "a piping block: 2 pumps, the wet well, swing checks, plug valves, the force main and the gravity inlet.",
    function (x) { var pl = x.r.plan ? x.r.plan.parts.map(function (p) { return p.item; }).join(" | ") : ""; return x.ok && x.pumps === 2 && x.valve === "plug" && /Force Main/.test(x.main) && /Gravity Inlet/.test(x.inlet) && /Check valve \(swing\)/.test(pl) ? "" : brief(x) + " parts " + pl.slice(0, 300); }),
  C("B-07", "low", blkOf(DUP.concat([["E1", "probe", "Low Level Probe"], ["E2", "probe", "Lead Probe"], ["E3", "probe", "Lag Probe"], ["E4", "probe", "High Level Probe"]])), "level probes: four floats (probes do the same jobs).",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-08", "low", blkOf(DUP.concat([["LSL", "switch", "Level Switch Low"], ["LSH", "switch", "Level Switch High"], ["LSHH", "switch", "Level Switch High High"]])), "LSL, LSH, LSHH: off, lead (said), alarm.",
    function (x) { return want(x, "off,lead,alarm", 2); }),
  C("B-09", "low", blkOf(DUP.concat([["H1", "sensor", "High Level"], ["L1", "sensor", "Low Level"]])), "a high and a low level sensor: off and lead (said), no alarm said.",
    function (x) { return want(x, "off,lead", 2) || (/no high level alarm float/.test(x.summary) ? "" : "the missing alarm is not said"); }),
  C("B-10", "medium", H.sch("Lift Station", ["part V1 source \x22120 V\x22", "part FS1 float switch \x22Off\x22", "part FS2 float switch \x22Lead Start\x22", "part FS3 float switch \x22Lag Start\x22", "part FS4 float switch \x22Alarm\x22", "part M1 motor \x22Pump 1\x22", "part M2 motor \x22Pump 2\x22", "wire V1 M1", "wire M1 V1"]),
    "type \x22float switch\x22 with Start in the names: four floats (the type says float).", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-11", "high", blkOf(DUP.concat(FL4).concat([["S5", "sensor", "Seal Leak"], ["S6", "sensor", "Pump 1 Moisture"], ["S7", "sensor", "Discharge Pressure"], ["S8", "sensor", "Motor Temperature"], ["S9", "sensor", "Gas Detector"], ["S10", "detector", "Intrusion"]])),
    "sensors that are not levels (seal, moisture, pressure, temperature, gas, intrusion): none taken as a float, each not carried.",
    function (x) { return want(x, "off,lead,lag,alarm", 2) || (/S5–S9 \(sensor\)|S5.*S9/.test(x.summary) ? "" : "the sensors are not said as not carried: " + x.summary.slice(0, 300)); }),
  C("B-12", "medium", blkOf(DUP.concat(FL4).concat([["L1", "lamp", "High Level Alarm"], ["L2", "lamp", "Pump 1 Running"], ["L3", "lamp", "Pump 2 Running"]])), "lamps named for levels and pumps: neither floats nor pumps.",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-13", "medium", blkOf(DUP.concat(FL4).concat([["S5", "switch", "Pump 1 Start"], ["S6", "switch", "Pump 1 Stop"], ["S7", "switch", "Pump 1 HOA"], ["S8", "switch", "Lead/Lag Selector"], ["S9", "switch", "Alarm Silence"], ["S10", "switch", "Alarm Test"]])),
    "push buttons, HOA, selector, silence, test: not floats.", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-14", "medium", blkOf(DUP.concat(FL4).concat([["K1", "relay", "Pump 1 Contactor"], ["K2", "relay", "Pump 2 Contactor"], ["M3", "motor", "Exhaust Fan"]])), "contactors and a fan motor: not pumps (2 pumps).",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-15", "low", blkOf(DUP.concat(FL4).concat([["M3", "motor", "Pump 3"], ["M4", "motor", "Pump 4"]])), "four pumps: 4, the control left to a controller maker (said).",
    function (x) { return x.ok && x.pumps === 4 && /needs a controller made for it/.test(x.summary) ? "" : brief(x); }),
  C("B-16", "medium", H.sch("Sump", P([["B1", "battery", "12 V"], ["F1", "float", "Pump Off"], ["F2", "float", "Pump On"], ["F3", "float", "High Water Alarm"], ["M1", "motor", "Sump Pump"]]).concat(W(["B1 F2", "F2 M1", "M1 B1"]))),
    "a one-pump sump station: 1 pump, off, on, alarm.", function (x) { return want(x, "off,lead,alarm", 1); }, "write a schematic for a sump pump station"),
  C("B-17", "medium", H.sch("Dry Pit Lift Station Piping", ["mode fluid"].concat(P([["W1", "tank", "Wet Well"], ["P1", "pump", "Pump 1"], ["P2", "pump", "Pump 2"], ["V1", "valve", "Suction Gate Valve 1"], ["V2", "valve", "Suction Gate Valve 2"], ["V3", "valve", "Check Valve 1"], ["V4", "valve", "Check Valve 2"], ["V5", "valve", "Discharge Gate Valve 1"], ["V6", "valve", "Discharge Gate Valve 2"]])).concat(W(["W1 V1", "V1 P1", "W1 V2", "V2 P2", "P1 V3", "V3 V5", "P2 V4", "V4 V6"]))),
    "suction valves are not the shutoff valves; said as not carried, and that the station is drawn submersible.",
    function (x) { return x.ok && /V1, V2 \(suction valve\)/.test(x.summary) && /no suction piping/.test(x.summary) && /shutoff valves \(V5, V6\)/.test(x.summary) ? "" : brief(x); }),
  C("B-18", "medium", blkOf(DUP.concat(FL4).concat([["V7", "valve", "Vent Valve"], ["V8", "valve", "Air Release Valve"], ["V9", "valve", "Ball Valve Drain"], ["V10", "valve", "Vacuum Relief Valve"]])), "vent, air release, drain and vacuum valves: not the shutoff valves.",
    function (x) { return want(x, "off,lead,lag,alarm", 2) || (x.valve ? "shutoff valve kind " + x.valve : ""); }),
  C("B-19", "medium", blkOf(DUP.concat([["F0", "float", "Redundant Off"]]).concat(FL4)), "a redundant off float below the off float: kept (two off floats).",
    function (x) { return want(x, "off,off,lead,lag,alarm", 2); }),
  C("B-20", "medium", R1, "not a station's question (an electrical schematic with a breaker): MAKE SCHEMATIC's own checks.",
    function (x) { return !x.ok && x.readAs !== "STATION" && /no electrical part called “breaker”/.test(x.problems) ? "" : brief(x); }, "draw an electrical schematic with a breaker and a transformer"),
  C("B-21", "medium", H.sch("Panel light", ["mode electrical", "part V1 source \x22120 V\x22", "part S1 switch \x22Panel\x22", "part L1 lamp \x22Panel light\x22", "wire V1 S1", "wire S1 L1", "wire L1 V1"]),
    "a block naming no pump, float, well or valve is not read as the station.", function (x) { return x.readAs !== "STATION" ? "" : brief(x); }),
  C("B-22", "low", H.sch("Sump", P([["B1", "battery", "12 V"], ["S1", "switch", "Float switch"], ["M1", "motor", "Pump"]]).concat(W(["B1 S1", "S1 M1", "M1 B1"]))),
    "not a station's question (\x22a schematic of a sump pump\x22): the circuit made as written.", function (x) { return x.ok && x.readAs !== "STATION" ? "" : brief(x); }, "Write a schematic of a sump pump"),

  C("B-23", "low", blkOf(DUP.concat([["ls1", "sensor", "low level"], ["ls2", "sensor", "lead on"], ["ls3", "sensor", "lag on"], ["ls4", "sensor", "high high level"]])), "lowercase tags and names: four floats.",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-24", "low", H.sch("Lift Station", P([["V1", "source", "240 V"], ["P1", "pump", "Lift Pump 1"], ["P2", "pump", "Lift Pump 2"]].concat(FL4)).concat(W(["V1 P1", "P1 V1"]))), "pumps written as type pump, no mode line: 2 pumps, four floats.",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-25", "low", H.sch("Lift Station Piping", ["mode fluid"].concat(P([["W1", "wetwell", "Wet Well"], ["P1", "pump", "Pump 1"], ["P2", "pump", "Pump 2"], ["V1", "valve", "Ball Check Valve"], ["V2", "valve", "Ball Check Valve"], ["V3", "valve", "Gate Valve"], ["V4", "valve", "Gate Valve"]])).concat(W(["W1 P1", "W1 P2", "P1 V1", "V1 V3", "P2 V2", "V2 V4"]))),
    "ball check valves are check valves (not ball shutoff valves); the gate valves the shutoff valves.",
    function (x) { return x.ok && x.valve === "gate" && /check valves \(V1, V2\)/.test(x.summary) ? "" : brief(x) + " valve " + x.valve; }),
  C("B-26", "low", blkOf(DUP.concat(FL4).concat([["B9", "buzzer", "Alarm Buzzer"]])), "an alarm buzzer: the horn.", function (x) { return want(x, "off,lead,lag,alarm", 2) || (x.horn ? "" : "no horn"); }),
  C("B-27", "low", blkOf(DUP.concat([["H1", "sensor", "Low Level Float"], ["H2", "sensor", "High Level Float"], ["H3", "sensor", "Emergency High"]])), "the 35B's floats in one block: off, lead (said), alarm.",
    function (x) { return want(x, "off,lead,alarm", 2); }),
  // --- floats lost, or things that are not floats taken ---------------------------------------------------------------
  C("B-30", "high", H.sch("Duplex Lift Station Control", ["mode electrical"].concat(P([["V1", "source", "120 VAC"], ["LS1", "sensor", "Low Level - Pumps Off"], ["LS2", "sensor", "Lead Pump Start"], ["LS3", "sensor", "Lag Pump Start"], ["LS4", "sensor", "High Level Alarm"], ["K1", "relay", "Pump 1 Contactor"], ["K2", "relay", "Pump 2 Contactor"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"]])).concat(W(["V1 LS1", "LS1 LS2", "LS2 K1", "K1 M1", "M1 V1", "LS3 K2", "K2 M2", "M2 V1"]))),
    "level sensors LS1-LS4 named Pumps Off, Lead Pump Start, Lag Pump Start, High Level Alarm: the four floats. (A sensor tagged LS that says start is a start float, not a start button.)",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-31", "high", blkOf(DUP.concat([["S1", "switch", "Stop Float"], ["S2", "switch", "Lead Start Float"], ["S3", "switch", "Lag Start Float"], ["S4", "switch", "High Level Alarm Float"]])),
    "switches whose names say Float (Stop Float, Lead Start Float, Lag Start Float): floats; NOT_LV's start/stop must not outrank the word float.",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-32", "high", blkOf(DUP.concat([["FS1", "switch", "Pumps Off"], ["FS2", "switch", "Lead Pump On"], ["FS3", "switch", "Lag Pump On"], ["FS4", "switch", "High Level Alarm"]])),
    "float switches tagged FS1-FS4 (AI_STATION's own parse takes FS/LS tags as floats): all four, the lag float kept; never \x22not carried: FS1-FS3\x22 beside a drawing with FS1 and FS2 in it.",
    function (x) { return want(x, "off,lead,lag,alarm", 2) || (/FS1–FS3 \(switch\)/.test(x.summary) ? "FS1-FS3 said not carried, FS1 and FS2 drawn" : ""); }),
  C("B-33", "high", blkOf(DUP.concat(FL4).concat([["Q1", "breaker", "Incoming Power"]]), "Lift Station Electrical"), "an incoming power breaker is not the sewer coming in: no inlet \x22Incoming Power\x22 in the piping or the parts list.",
    function (x) { return x.inlet ? "the piping's inlet is drawn \x22" + x.inlet + "\x22" : want(x, "off,lead,lag,alarm", 2); }),
  C("B-34", "high", blkOf(DUP.concat(FL4).concat([["T1", "transformer", "Incoming 480V"]]), "Lift Station Electrical"), "an incoming transformer: not the inlet.",
    function (x) { return x.inlet ? "the piping's inlet is drawn \x22" + x.inlet + "\x22" : ""; }),
  C("B-35", "high", blkOf(DUP.concat(FL4).concat([["Q1", "breaker", "Incoming Service"]]), "Lift Station Electrical"), "an incoming service breaker: not the inlet.",
    function (x) { return x.inlet ? "the piping's inlet is drawn \x22" + x.inlet + "\x22" : ""; }),
  C("B-36", "high", blkOf(DUP.concat([["F1", "float", "Float 1"], ["F2", "float", "Float 2"], ["F3", "float", "Float 3"], ["F4", "float", "Float 4"]])),
    "floats named Float 1-4 (no jobs): sent back without a height nobody gave (\x22Float 1\x22 is not 1 in), and not all four told \x22off\x22.",
    function (x) { return /\d in\b/.test(x.problems) || /off.*off.*off/.test(x.problems) ? x.problems : x.ok ? "" : ""; }),
  C("B-37", "high", blkOf([["V1", "source", "480 V"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"], ["M3", "motor", "Pump 3"], ["F1", "float", "Off"], ["F2", "float", "Lead"], ["F3", "float", "Lag 1"], ["F4", "float", "Lag 2"], ["F5", "float", "High Level Alarm"]], "Triplex"),
    "a triplex with Lag 1 and Lag 2 floats: both lag floats kept (the third pump's start); no height invented from the 1 and 2.",
    function (x) { return /\d in\b/.test(x.problems + x.fl + x.summary) ? "a height invented: " + (x.problems || x.fl) : x.ok && x.jobs === "off,lead,lag,lag,alarm" ? "" : brief(x); }, "write a schematic for a triplex lift station"),
  C("B-38", "medium", blkOf(DUP.concat([["FA", "float", "Off"], ["FB", "float", "Lead On"], ["F4", "float", "Lag 2"], ["F5", "float", "High Level Alarm"]])),
    "a float named \x22Lag 2\x22: no height said (\x22heights were given for F4 (2 in)\x22 is untrue).",
    function (x) { return /heights were given/.test(x.summary) ? x.summary.match(/the float levels in order[^;.]*/)[0] : want(x, "off,lead,lag,alarm", 2); }),
  C("B-39", "medium", blkOf(DUP.concat([["LT1", "sensor", "Level Transducer"]])), "a level transducer (continuous) is not a float: never sent back as \x22float LT1 off\x22.",
    function (x) { return /float LT1 \x22off\x22/.test(x.problems) ? x.problems : ""; }),
  C("B-40", "medium", blkOf(DUP.concat([["US1", "sensor", "Ultrasonic Level"], ["V2", "valve", "Check Valve"]])), "an ultrasonic level sensor: not a float to be given a job.",
    function (x) { return /float US1/.test(x.problems) ? x.problems : ""; }),
  C("B-41", "medium", blkOf(DUP.concat(FL4).concat([["S9", "switch", "Wet Well Light"]])), "a wet well light switch: not a float; the station is made from the four floats.",
    function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-42", "medium", blkOf(DUP.concat(FL4).concat([["S9", "switch", "Wet Well Vent Fan"]])), "a wet well vent fan switch: not a float.", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-43", "medium", blkOf(DUP.concat(FL4).concat([["S9", "switch", "Wet Well Hatch"]])), "a wet well hatch (intrusion) switch: not a float.", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-44", "medium", blkOf(DUP.concat(FL4).concat([["S9", "switch", "Float Bypass"]])), "a float bypass selector: not a float.", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-45", "medium", blkOf(DUP.concat(FL4).concat([["S9", "sensor", "Pump Fail Alarm"]])), "a pump fail alarm input: not a second high level alarm float.", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-46", "medium", blkOf(DUP.concat(FL4).concat([["S9", "sensor", "Overtemp Alarm"]])), "a motor overtemperature alarm: not a float.", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-47", "low", blkOf(DUP.concat(FL4).concat([["S9", "sensor", "Hatch Alarm"]])), "a hatch alarm: not a float.", function (x) { return want(x, "off,lead,lag,alarm", 2); }),
  C("B-48", "medium", blkOf(DUP.concat(FL4).concat([["S9", "sensor", "Low Battery"]])), "a low battery input: never said to be a float taken (the summary names S9 \x22Low Battery\x22 among the floats).",
    function (x) { return /S9 “Low Battery”/.test(x.summary) ? "said as a float taken" : ""; }),
  C("B-49", "low", blkOf(DUP.concat(FL4).concat([["CS1", "sensor", "Pump 1 On"], ["CS2", "sensor", "Pump 2 On"]])), "run status inputs (Pump 1 On, Pump 2 On): not floats.",
    function (x) { return /CS1 “Pump 1 On”/.test(x.summary) ? "said as floats taken" : ""; }),
  C("B-50", "medium", blkOf(DUP.concat(FL4).concat([["T1", "tank", "Dry Well"], ["T2", "tank", "Wet Well"]])), "a dry well and a wet well: the station's wet well is the wet well, not \x22Dry Well\x22.",
    function (x) { return /dry/i.test(x.well) ? "the wet well drawn as \x22" + x.well + "\x22" : ""; }),
  C("B-51", "medium", blkOf(DUP.concat(FL4).concat([["M3", "motor", null]])), "an unnamed motor beside Pump 1 and Pump 2 (a fan, a mixer): not a third pump (the station stays a duplex with its control drawn).",
    function (x) { return x.pumps === 2 && /control/.test(x.views) ? "" : brief(x) + " views " + x.views; }),
  C("B-52", "medium", H.sch("Lift station", ["part V1 source 120 V", "part LS1 float switch off", "part LS2 float switch lead on", "part LS3 float switch lag on", "part LS4 float switch high level alarm", "part M1 motor pump 1", "part M2 motor pump 2", "wire V1 LS1", "wire LS1 M1", "wire M1 V1"]),
    "labels without quotes (part M1 motor pump 1): the two pumps are read, never \x22not carried: M1 (motor pump 1)\x22 and \x222 pumps: the block did not say\x22.",
    function (x) { return /block did not say/.test(x.summary) || /M1 \(motor pump 1\)/.test(x.summary) ? "pumps not read: " + (x.summary.match(/not carried[^(]*\([^)]*\)[^(]*\([^)]*\)/) || [""])[0] : ""; }),
  C("B-53", "medium", H.sch("Sump Pump", P([["B1", "battery", "12 V"], ["FS1", "switch", "Float Switch"], ["M1", "motor", "Sump Pump"], ["L1", "lamp", "High Water Alarm"], ["FS2", "switch", "High Water Float"]]).concat(W(["B1 FS1", "FS1 M1", "M1 B1", "B1 FS2", "FS2 L1", "L1 B1"]))),
    "a sump's one float in series with its pump starts and stops it: never sent back as \x22float FS1 off\x22 (the float that runs the pump made the off float).",
    function (x) { return /float FS1 \x22off\x22/.test(x.problems) ? x.problems : ""; }, "write a schematic for a sump pump station"),
  C("B-54", "low", blkOf(DUP.concat(FL4).concat([["G9", "gate", "Influent Gate"]])), "an influent sluice gate does not make the pumps' shutoff valves gate valves.",
    function (x) { return x.valve === "gate" ? "shutoff valves drawn as gate from the influent gate" : ""; }),
  C("B-55", "low", blkOf(DUP.concat(FL4), "Lift Station Pumps and Valves"), "the title: \x22Lift Station\x22, never \x22Lift Station Pumps and\x22.",
    function (x) { return /\band$/.test(x.title) ? "title \x22" + x.title + "\x22" : ""; }),
  C("B-56", "low", blkOf(DUP.concat([["FA", "float", "Off"], ["FB", "float", "Lead On"], ["FC", "float", "Lag On"], ["FD", "float", "High Level Alarm"]])),
    "floats tagged FA-FD: the tags said as taken are the tags drawn.", function (x) { return /FA “Off”/.test(x.summary) && !/FA:/.test(x.fl) ? "said FA-FD, drawn " + x.fl : ""; }),
  C("B-57", "medium", blkOf(DUP.concat([["F0", "float", "Low Water Cutoff"], ["F1", "float", "Pumps Off"], ["F2", "float", "Lead On"], ["F3", "float", "Lag On"], ["F4", "float", "High Water Alarm"]])),
    "a low water cutoff below the off float: both kept, or the one dropped said (the summary says F1 \x22Pumps Off\x22 was taken; it is not drawn).",
    function (x) { return /F1 “Pumps Off”/.test(x.summary) && x.fl.indexOf("F1:") < 0 ? "F1 said taken, drawn " + x.fl : ""; }),
  C("B-58", "medium", H.sch("Lift Station Electrical", P([["V1", "source", "480 V"], ["M1", "motor", "Pump 1"], ["M2", "motor", "Pump 2"], ["F1", "float", "Off"], ["F2", "float", "Lead On"], ["F3", "float", "Lag On"], ["F4", "float", "High Level Alarm"]]).concat(W(["V1 M1", "M1 V1"]))) + "\n\n" +
    H.sch("Lift Station Piping", ["mode fluid"].concat(P([["W1", "tank", "Wet Well"], ["P1", "pump", "Pump 1"], ["P2", "pump", "Pump 2"], ["P3", "pump", "Pump 3"], ["V1", "valve", "Check Valve 1"], ["V2", "valve", "Check Valve 2"], ["V3", "valve", "Check Valve 3"]])).concat(W(["W1 P1", "W1 P2", "W1 P3"]))),
    "the electrical has 2 pumps and the piping 3: the disagreement is said (as for MAKE CONTROL beside MAKE PIPING).",
    function (x) { return /check which is meant|disagree/.test(x.summary) ? "" : "drawn with " + x.pumps + " pumps, nothing said: " + x.summary.slice(0, 200); }),
  C("B-59", "low", R1, "the 35B's note says Pump 2 starts when the level rises further; the drawing has no lag float: say that the second pump never runs with the first (or add the usual lag float, said).",
    function (x) { return /lag/i.test(x.summary) ? "" : "no lag float, nothing said"; })
  ,
  C("B-60", "low", R1, "what is said as not carried is not drawn: the 35B's \x22Discharge Header\x22 (P3) is the header the piping draws; the vent valve V7 is the vent drawn (taken, and so said).",
    function (x) { return /P3 \(pipe\)/.test(x.summary) ? "P3 Discharge Header said not carried; the piping draws a discharge header" : ""; })
  ,
  C("B-61", "high", H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]) + "\n\n" + PIPE,
    "Adam's question answered with a MAKE CONTROL and the 35B's part-and-wire piping: the piping is drawn (the question asks for every drawing; the piping block is taken in, so Chat does not make it on its own).",
    function (x) { return /piping/.test(x.views) ? "" : "drawn: " + x.views + " only; the piping block was read (" + (x.summary.match(/from the AI’s MAKE SCHEMATIC block: [^.]*/) || [""])[0] + ") and not drawn"; })
];
