// cases_b.js -- rule 2: a station question's part-and-wire MAKE SCHEMATIC read as the station (AI_STATION partsOf,
// partRole, fromParts, tookText and the wrapper around the schematic action's build).
// Each block is one a model would really write: electrical and piping, simplex, duplex, triplex, sumps; tags (LS1, LSH,
// FS3, E1, H1, F1); labels with numbers, lowercase, unquoted, Spanish or British; mode lines or none; MAKE CONTROL or
// MAKE PIPING beside a part-and-wire block. What is right is what a lift station is (Recommended Standards for
// Wastewater Facilities 2014, 42.x; common duplex practice): from the bottom up the off float, the lead (pump on), the
// lag, the high level alarm; a check valve then a shutoff valve on each pump's discharge; and nothing said that is
// untrue -- every float the summary says it took is drawn, nothing is called what it is not.
"use strict";
var lib = require("./lib.js");
var SQ = "write a schematic for a typical lift station";
function S(title, lines) { return "MAKE SCHEMATIC: " + title + "\n" + lines.join("\n") + "\nEND"; }
function B(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
var Q35 = lib.Q35.question, R1 = lib.Q35.replies[0].reply;
var EL1 = R1.slice(R1.indexOf("MAKE SCHEMATIC: Dual Pump"), R1.indexOf("For the **Piping")), PI1 = R1.slice(R1.indexOf("MAKE SCHEMATIC: Lift Station Piping"));
var WIRE = ["wire V1 F1", "wire F1 M1", "wire M1 V1"];
function ctl(floats, pumps, extra) { return S("Lift station control", ['part V1 source "120 V"'].concat(floats, pumps || ['part M1 motor "Pump 1"', 'part M2 motor "Pump 2"'], extra || [], WIRE)); }
var PIPE2 = S("Lift station piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part CV1 valve "Check Valve 1"', 'part CV2 valve "Check Valve 2"', 'part GV1 valve "Gate Valve 1"', 'part GV2 valve "Gate Valve 2"', "wire W1 P1", "wire W1 P2", "wire P1 CV1", "wire CV1 GV1", "wire P2 CV2", "wire CV2 GV2"]);

function c(id, harm, input, right, q, e) {
  return { id: id, harm: harm, input: input, right: right, run: function () { return Promise.resolve(lib.station(input, q || SQ, e)); } };
}
var cases = [
  // ---- the 35B's own blocks ------------------------------------------------------------------------------------
  c("B-35b-both", "high", R1, "two pumps; H2 Low Level off, H1 High Level the lead (said), H3 Emergency High the alarm; each pump a check then a gate valve; all three drawings", Q35,
    { count: 2, floats: "H2:off,H1:lead,H3:alarm", levels: "H2:off,H1:lead,H3:alarm", views: "control,levels,piping", valve: "gate", piping: true, well: true, said: ["starts the pumps", "not carried"] }),
  c("B-35b-electrical-alone", "medium", EL1, "the electrical block alone: the same floats and pumps", Q35, { count: 2, floats: "H2:off,H1:lead,H3:alarm", views: "control,levels,piping" }),
  c("B-35b-piping-alone", "medium", PI1, "the piping block alone: two pumps, the gate valves, the usual floats said", Q35, { count: 2, valve: "gate", well: true, said: ["the usual floats for 2 pumps"] }),
  c("B-35b-valve-tags", "medium", R1, "the summary names each valve by the tag the drawing gives it: the piping drawing labels the check valves CV1, CV2 and the gate valves V1, V2, so the summary does not call V1, V2 the check valves (nor V1 the source)", Q35,
    { extra: function (m, s) { var pv = m.plan.views.piping, gate = pv.pumps.map(function (p) { return p.valve; }); return gate.indexOf("V1") >= 0 && /the check valves \(V1, V2\)/.test(s.summary) ? "the summary says \u201cthe check valves (V1, V2)\u201d and the piping drawn labels V1, V2 the shutoff (gate) valves, CV1, CV2 the checks; it also lists \u201cV1 (source)\u201d as not carried" : ""; } }),
  c("B-35b-plain-question", "medium", R1, "Adam's blocks for the question without 'any other drawings': still the station, all three drawn", SQ, { count: 2, floats: "H2:off,H1:lead,H3:alarm", views: "control,levels,piping" }),
  // ---- duplex, simplex, triplex ---------------------------------------------------------------------------------
  c("B-duplex-classic", "high", ctl(['part F1 float "Pumps Off"', 'part F2 float "Lead Pump On"', 'part F3 float "Lag Pump On"', 'part F4 float "High Water Alarm"'], null, ['part H1 horn "Alarm"']),
    "the four floats in order, a horn", SQ, { count: 2, floats: "F1:off,F2:lead,F3:lag,F4:alarm", horn: true, notSaid: ["no lag float"] }),
  c("B-duplex-unquoted", "medium", ctl(["part F1 float off", "part F2 float lead on", "part F3 float lag on", "part F4 float high level alarm"], ["part M1 motor pump 1", "part M2 motor pump 2"]),
    "a small model's unquoted names read as names", SQ, { count: 2, floats: "F1:off,F2:lead,F3:lag,F4:alarm" }),
  c("B-duplex-switch-named-float", "medium", ctl(['part S1 switch "Float Switch - Off"', 'part S2 switch "Float Switch - Lead"', 'part S3 switch "Float Switch - Lag"', 'part S4 switch "High Water"', 'part S5 switch "Hand-Off-Auto"']),
    "switches named float or high water are the floats; the HOA selector is not", SQ, { count: 2, floats: "S1:off,S2:lead,S3:lag,S4:alarm", said: ["S5 \\(switch\\)"] }),
  c("B-duplex-start12", "medium", ctl(['part F1 float "Pump Stop"', 'part F2 float "Pump 1 Start"', 'part F3 float "Pump 2 Start"', 'part F4 float "Alarm"']),
    "Pump 2 Start is the lag float", SQ, { floats: "F1:off,F2:lead,F3:lag,F4:alarm" }),
  c("B-duplex-start-start2", "high", ctl(['part F1 float "Stop"', 'part F2 float "Start"', 'part F3 float "Start 2"', 'part F4 float "Alarm"']),
    "Start 2 is the second pump's start (the lag float): drawn, and never 'no lag float in the AI's schematic'", SQ, { floats: "F1:off,F2:lead,F3:lag,F4:alarm", notSaid: ["no lag float in the AI"] }),
  c("B-duplex-pump1off-pump2off", "medium", ctl(['part F1 float "Pump 1 Off"', 'part F2 float "Pump 2 Off"', 'part F3 float "Lead On"', 'part F4 float "Lag On"', 'part F5 float "High Level Alarm"']),
    "each pump's own off float: both drawn (or the second said), never listed as taken and then dropped", SQ, { count: 2 }),
  c("B-duplex-lead-lag-pumps", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead"', 'part F3 float "Lag"', 'part F4 float "High Water"'], ['part PA pump "Lead Pump"', 'part PB pump "Lag Pump"']),
    "two pumps tagged PA, PB", SQ, { count: 2, floats: "F1:off,F2:lead,F3:lag,F4:alarm" }),
  c("B-duplex-fan-motor", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "Alarm"'], ['part M1 motor "Pump A"', 'part M2 motor "Pump B"', 'part M3 motor "Exhaust Fan"']),
    "the fan is not a pump: two pumps, M3 not carried", SQ, { count: 2, floats: "F1:off,F2:lead,F3:lag,F4:alarm", said: ["M3 \\(motor\\)"] }),
  c("B-duplex-motor-labels", "low", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Level Alarm"'], ['part M1 motor "Motor 1"', 'part M2 motor "Motor 2"']),
    "two motors beside a lead and a lag float are the two pumps: taken, not 'not carried', and not 'the block did not say'", SQ, { count: 2, notSaid: ["M1, M2 \\(motor\\)", "the block did not say"] }),
  c("B-duplex-six-floats", "medium", ctl(['part F0 float "Low Level Alarm"', 'part F1 float "Redundant Off"', 'part F2 float "Pumps Off"', 'part F3 float "Lead On"', 'part F4 float "Lag On"', 'part F5 float "High Level Alarm"', 'part F6 float "High High Alarm"']),
    "low level alarm lowest, the redundant off under the off, two alarms on top", SQ, { floats: "F0:low,F1:off,F2:off,F3:lead,F4:lag,F5:alarm,F6:alarm" }),
  c("B-duplex-low-water-cutoff", "medium", ctl(['part F0 float "Low Water Cutoff"', 'part F1 float "Pumps Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Level Alarm"']),
    "the low water cutoff under the off float", SQ, { floats: "F0:off,F1:off,F2:lead,F3:lag,F4:alarm" }),
  c("B-duplex-emergency-high-estop", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "Emergency High"'], null, ['part S1 switch "Emergency Stop"', 'part S2 switch "Emergency High Level Reset"']),
    "the emergency high float is the alarm; the e-stop and the reset button are not floats", SQ, { floats: "F1:off,F2:lead,F3:lag,F4:alarm", said: ["S1, S2 \\(switch\\)"] }),
  c("B-duplex-lag-and-alarm-one-float", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On / High Alarm"']),
    "one float for the lag pump and the alarm: the control drawn runs both pumps on it (CR2 lag call) and the levels drawing shows it as the lag float, so the summary never says 'no lag float in the AI's schematic: one pump runs at a time'", SQ, { levels: "F1:off,F2:lead,F3:lag", notSaid: ["no lag float in the AI"] }),
  c("B-simplex-one-float", "medium", S("Sump pump", ['part B1 source "120 V"', 'part S1 switch "Float Switch"', 'part M1 motor "Sump Pump"', "wire B1 S1", "wire S1 M1", "wire M1 B1"]),
    "a sump's one float starts and stops the pump: read as the pump-on float, the off float added and said", "write a schematic for a simplex sump pump station", { count: 1, said: ["read as the float that starts the pump", "the off float"] }),
  c("B-simplex-motor-no-name", "medium", S("Sump", ['part V1 source "120 V"', 'part S1 switch "Float"', "part M1 motor", "wire V1 S1", "wire S1 M1", "wire M1 V1"]),
    "an unnamed motor beside the float is the pump", "write a schematic for a sump pump station", { count: 1 }),
  c("B-simplex-high-low", "medium", S("Sump", ['part V1 source "120 V"', 'part FS1 float "High"', 'part FS2 float "Low"', 'part M1 motor "Sump Pump"', "wire V1 FS1", "wire FS1 M1", "wire M1 V1"]),
    "a sump's high float starts, its low float stops", "write a schematic for a sump pump station", { count: 1, floats: "FS2:off,FS1:lead" }),
  c("B-simplex-lowercase-bullets", "medium", S("lift station", ["- mode electrical", '- part v1 source "240 v"', '- part fs1 float "stop"', '- part fs2 float "start"', '- part fs3 float "alarm"', '- part m1 motor "pump"', "- wire v1 fs1", "- wire fs1 m1", "- wire m1 v1"]),
    "lowercase tags and bullets", "write a schematic for a simplex lift station", { count: 1, floats: "FS1:off,FS2:lead,FS3:alarm" }),
  c("B-triplex-lag1-lag2", "high", S("Triplex", ['part V1 source "480 V"', 'part LS1 switch "Off"', 'part LS2 switch "Lead On"', 'part LS3 switch "Lag 1 On"', 'part LS4 switch "Lag 2 On"', 'part LS5 switch "High Level Alarm"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', 'part M3 motor "Pump 3"', "wire V1 LS1", "wire LS1 M1", "wire M1 V1"]),
    "three pumps, two lag floats, the control circuit not drawn and said", "write a schematic for a triplex lift station", { count: 3, floats: "LS1:off,LS2:lead,LS3:lag,LS4:lag,LS5:alarm", said: ["station of 3 pumps needs a controller"] }),
  c("B-triplex-pump3on", "high", S("Triplex", ['part V1 source "480 V"', 'part F1 float "Pumps Off"', 'part F2 float "Pump 1 On"', 'part F3 float "Pump 2 On"', 'part F4 float "Pump 3 On"', 'part F5 float "High Level Alarm"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', 'part M3 motor "Pump 3"', "wire V1 F1", "wire F1 M1", "wire M1 V1"]),
    "Pump 3 On is the third pump's start (the second lag float): drawn above Pump 2 On", "write a schematic for a triplex lift station", { count: 3, floats: "F1:off,F2:lead,F3:lag,F4:lag,F5:alarm" }),
  // ---- tags, sensors, probes --------------------------------------------------------------------------------------
  c("B-isa-tags", "medium", S("Duplex", ['part V1 source "120 VAC"', 'part LSLL sensor "Low Low"', 'part LSL1 sensor "Low"', 'part LSH1 sensor "High"', 'part LSHH1 sensor "High High"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', "wire V1 LSL1", "wire LSL1 P1", "wire P1 V1"]),
    "ISA level switches: low-low the redundant off, low the off, high the lead, high-high the alarm", SQ, { count: 2, floats: "FS1:off,LSL1:off,LSH1:lead,LSHH1:alarm", said: ["no lag float"] }),
  c("B-probes-stop-start-high", "high", S("Duplex", ['part V1 source "120 V"', 'part E1 sensor "Stop"', 'part E2 sensor "Start"', 'part E3 sensor "High"', 'part E4 probe "Common"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', "wire V1 E1", "wire E1 M1", "wire M1 V1"]),
    "electrode probes: stop, start, high (the high level probe above start: the alarm, or the lag); E3 is drawn, never listed as taken and dropped", SQ, { count: 2, notSaid: ["no high level alarm float: the block has none"] }),
  c("B-relay-contact-not-float", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "High Level Alarm"'], null, ['part CR1 contact "High Level"', 'part K1 relay "High Level Relay"']),
    "a relay's contact named High Level is the relay's, not a float: three floats drawn", SQ, { floats: "F1:off,F2:lead,F3:alarm" }),
  c("B-limit-switch-not-float", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Alarm"'], null, ['part LS1 switch "Hatch Limit Switch"', 'part LS2 switch "Limit Switch"']),
    "LS on a ladder is a limit switch too: a switch named Limit Switch is not a float, and is never sent back to be named a high level alarm", SQ, { floats: "F1:off,F2:lead,F3:lag,F4:alarm" }),
  c("B-limit-switch-type", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Alarm"'], null, ["part LS1 limit switch"]),
    "a part whose type is limit switch is not a float", SQ, { floats: "F1:off,F2:lead,F3:lag,F4:alarm" }),
  c("B-push-buttons-not-floats", "medium", ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "Alarm"'], null, ['part PB1 switch "Start"', 'part PB2 switch "Stop"']),
    "switches named Start and Stop are push buttons, not floats", SQ, { floats: "F1:off,F2:lead,F3:lag,F4:alarm", said: ["PB1, PB2 \\(switch\\)"] }),
  c("B-isa-tags-no-names", "medium", S("Duplex", ['part V1 source "120 V"', "part LSL1 switch", "part LSH1 switch", "part LSHH1 switch", 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', "wire V1 LSL1", "wire LSL1 P1", "wire P1 V1"]),
    "ISA tags say the job (LSL low: off, LSH high: lead, LSHH high-high: the alarm): read from the tag, or sent back with lines that follow it -- never LSHH1 told to be \u201clag on\u201d", SQ,
    { read: "back", problems: ["LSHH1"], notProblems: ["float LSHH1 \x22lag on\x22"] }),
  c("B-back-quotes-the-models-line", "low", ctl(['part LS1 switch "Level Switch 1"', 'part LS2 switch "Level Switch 2"']),
    "what goes back names the line the model wrote (part LS1 switch ...), not a float line Lantern made of it that is nowhere in the reply", SQ,
    { read: "back", problems: ["part LS1 switch"] }),
  c("B-transducer-backup-floats", "low", ctl(['part LT1 sensor "Level Transducer"', 'part PS1 sensor "Discharge Pressure"', 'part F1 float "High Level Backup"', 'part F2 float "Low Level Backup"']),
    "the transducer and pressure sensor not carried and said; the backup floats read", SQ, { said: ["LT1, PS1 \\(sensor\\)"] }),
  c("B-no-job-floats-back", "medium", ctl(['part LS1 switch "Level Switch 1"', 'part LS2 switch "Level Switch 2"', 'part LS3 switch "Level Switch 3"', 'part LS4 switch "Level Switch 4"']),
    "floats with no job: back once as one MAKE STATION block, each named with its line", SQ, { read: "back", problems: ["float LS1 .*name its job", "float LS4 .*name its job"] }),
  c("B-spanish-back", "low", S("Estacion de bombeo", ['part V1 source "120 V"', 'part F1 float "Paro"', 'part F2 float "Arranque bomba 1"', 'part F3 float "Arranque bomba 2"', 'part F4 float "Alarma de nivel alto"', 'part B1 pump "Bomba 1"', 'part B2 pump "Bomba 2"', "wire V1 F1", "wire F1 B1", "wire B1 V1"]),
    "Spanish float names Lantern cannot read go back once with the line; the alarm is read", "write a schematic for a sewage lift station", { read: "back", problems: ["float F1 .*Paro"], notProblems: ["Alarma de nivel alto"] }),
  // ---- piping ---------------------------------------------------------------------------------------------------
  c("B-piping-plug-inlet-main", "medium", S("Piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part CV1 valve "Check Valve 1"', 'part CV2 valve "Check Valve 2"', 'part PV1 valve "Plug Valve 1"', 'part PV2 valve "Plug Valve 2"', 'part FM1 pipe "Force Main"', 'part IN1 pipe "Gravity Inlet"', "wire IN1 W1", "wire W1 P1", "wire W1 P2", "wire P1 CV1", "wire CV1 PV1", "wire P2 CV2", "wire CV2 PV2", "wire PV1 FM1", "wire PV2 FM1"]),
    "plug valves kept, the inlet and force main drawn, the usual floats said", SQ, { count: 2, valve: "plug", well: true, piping: true, said: ["the usual floats for 2 pumps"], extra: function (m, s) { return lib.want(s.main === "Force Main" && s.inlet === "Gravity Inlet", "main " + s.main + ", inlet " + s.inlet); } }),
  c("B-piping-swing-check", "low", S("Piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part CV1 check "Swing Check 1"', 'part CV2 check "Swing Check 2"', "wire W1 P1", "wire W1 P2", "wire P1 CV1", "wire P2 CV2"]),
    "a check typed 'check' and named swing: the check valves, swing", SQ, { count: 2, check: "swing" }),
  c("B-piping-british", "low", S("Pumping station", ["mode hydraulic", 'part W1 tank "Wet Well"', 'part P1 pump "Duty Pump"', 'part P2 pump "Standby Pump"', 'part V1 valve "Non-return Valve 1"', 'part V2 valve "Non-return Valve 2"', 'part V3 valve "Sluice Valve 1"', 'part V4 valve "Sluice Valve 2"', 'part R1 pipe "Rising Main"', "wire W1 P1", "wire W1 P2", "wire P1 V1", "wire V1 V3", "wire P2 V2", "wire V2 V4", "wire V3 R1", "wire V4 R1"]),
    "British: non-return valves are the checks, a sluice valve on a pump's discharge is its gate (shutoff) valve, the rising main the force main", "write a schematic for a sewage pumping station", { count: 2, valve: "gate", notSaid: ["V3, V4 \\(valve\\)"] }),
  c("B-piping-mixed-valves", "medium", S("Piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part V1 check "Pump 1"', 'part V2 check "Pump 2"', 'part V3 valve "Plug Valve"', 'part V4 valve "Gate Valve"', 'part V5 valve "Air Release Valve"', 'part V6 valve "Bypass Valve"', "wire W1 P1", "wire W1 P2", "wire P1 V1", "wire P2 V2"]),
    "two kinds of shutoff valve: no kind drawn; the air release and bypass valves not carried, said", SQ, { count: 2, valve: "", said: ["V5, V6 \\(valve\\)"] }),
  c("B-piping-dry-well", "medium", S("Piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part DW1 tank "Dry Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part CV1 valve "Check Valve 1"', 'part CV2 valve "Check Valve 2"', "wire W1 P1", "wire W1 P2"]),
    "the dry well is not the wet well; said, with the submersible note", SQ, { count: 2, said: ["DW1 \\(dry well\\)", "no suction piping or dry well"], extra: function (m, s) { return lib.want(/wet well \(W1\)/.test(s.summary), "the wet well is not W1: " + lib.short(s.summary, 200)); } }),
  c("B-piping-valve-pit", "low", S("Piping", ["mode fluid", 'part VP1 pit "Valve Pit"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part CV1 valve "Check Valve 1"', 'part CV2 valve "Check Valve 2"', "wire P1 CV1", "wire P2 CV2", "wire CV1 VP1", "wire CV2 VP1"]),
    "a valve pit is the valves' vault, not the wet well: never 'the wet well (VP1)'", SQ, { count: 2, notSaid: ["wet well \\(VP1\\)"] }),
  c("B-piping-holding-tank", "low", S("Piping", ["mode fluid", 'part T1 tank "Holding Tank"', 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part CV1 valve "Check Valve 1"', 'part CV2 valve "Check Valve 2"', "wire W1 P1", "wire W1 P2"]),
    "the wet well is W1, the holding tank not carried", SQ, { count: 2, said: ["wet well \\(W1\\)", "T1 \\(tank\\)"] }),
  c("B-piping-dry-well-sump-pump", "medium", S("Piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part P3 pump "Dry Well Sump Pump"', 'part CV1 valve "Check Valve"', 'part CV2 valve "Check Valve"', "wire W1 P1", "wire W1 P2", "wire P1 CV1", "wire P2 CV2"]),
    "the dry well's own sump pump is not a third lift pump: a duplex", SQ, { count: 2 }),
  c("B-count-clash", "medium", ctl(['part F1 float "Pumps Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Level Alarm"']) + "\n\n" + S("Piping", ["mode fluid", 'part W1 tank "Wet Well"', 'part P1 pump "Pump 1"', 'part P2 pump "Pump 2"', 'part P3 pump "Pump 3"', 'part V1 valve "Check Valve"', 'part V2 valve "Check Valve"', 'part V3 valve "Check Valve"', "wire W1 P1", "wire W1 P2", "wire W1 P3"]),
    "the blocks disagree on the pumps (2 and 3): said", SQ, { said: ["have 2 and 3 pumps"] }),
  // ---- a part-and-wire block beside the drawings' own blocks, or beside MAKE STATION -----------------------------------
  c("B-control-plus-piping-schematic", "medium", B("CONTROL", "Duplex control", ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']) + "\n\n" + PIPE2,
    "MAKE CONTROL drawn as written, the piping from the schematic (gate valves)", SQ, { count: 2, floats: "FS1:off,FS2:lead,FS3:lag,FS4:alarm", valve: "gate", well: true }),
  c("B-piping-plus-electrical-schematic", "medium", B("PIPING", "Duplex piping", ['well "wet well"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', "valve V1 P1 plug", "valve V2 P2 plug"]) + "\n\n" + ctl(['part F1 float "Pumps Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Level Alarm"']),
    "MAKE PIPING drawn as written (plug), the floats from the schematic", SQ, { count: 2, floats: "F1:off,F2:lead,F3:lag,F4:alarm", valve: "plug" }),
  c("B-schematic-then-station", "high", ctl(['part F1 float "Pumps Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Level Alarm"']) + "\n\nAs one block:\n\n" + B("STATION", "Lift station", ["pumps 3", "floats off lead lag alarm", 'well "wet well" 12 ft']),
    "the MAKE STATION block (what the instructions ask for) is the station: 3 pumps, a 12 ft wet well; or the disagreement said -- never the schematic's 2 pumps with MAKE STATION's lines dropped unsaid", SQ,
    { extra: function (m, s) { return s.count === 3 || /3 pumps|MAKE STATION block/.test(s.summary) ? "" : "drawn with " + s.count + " pumps from the schematic; MAKE STATION's pumps 3 and well 12 ft are not used or mentioned"; } }),
  // ---- what is not a station --------------------------------------------------------------------------------------
  c("B-not-a-station-panel-light", "medium", S("Panel light", ["mode electrical", 'part V1 source "120 V"', 'part S1 switch "Panel"', 'part L1 lamp "Panel light"', "wire V1 S1", "wire S1 L1", "wire L1 V1"]),
    "no pump, float, well or valve: not read as a station", SQ, { read: false }),
  c("B-not-a-station-hoa-only", "medium", S("Pump wiring", ['part V1 source "480 V"', 'part S1 switch "Main Breaker"', 'part S2 switch "Pump 1 Start"', 'part S3 switch "Pump 1 Stop"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', "wire V1 S1", "wire S1 S2", "wire S2 M1", "wire M1 V1"]),
    "pumps with start and stop buttons and no float, well or valve: not read as a station (MAKE SCHEMATIC's checks)", SQ, { read: false }),
  { id: "B-not-station-question", harm: "high", input: "the 35B's blocks for \"draw a circuit with a pump motor and a float switch\"",
    right: "not a station's question: MAKE SCHEMATIC's own checks, as 1.24.33",
    run: function () { var q = "draw a circuit with a pump motor and a float switch", a = lib.build(lib.D, R1, q), b = lib.build(lib.P, R1, q); return Promise.resolve(lib.want(a.readAs !== "STATION" && JSON.stringify(a.problems) === JSON.stringify(b.problems), "draft " + a.readAs + " " + lib.short(a.problems.join(" | "), 200))); } },
  { id: "B-hydraulic-not-station", harm: "medium", input: "a hydraulic press circuit (pump, tank, valve, cylinder) for \"draw a hydraulic circuit for a press\"",
    right: "MAKE SCHEMATIC as 1.24.33",
    run: function () { var q = "draw a hydraulic circuit for a press", t = S("Press", ["mode hydraulic", "part P1 pump", "part T1 tank", "part V1 valve", "part C1 cylinder", "wire T1 P1", "wire P1 V1", "wire V1 C1", "wire C1 T1"]); var a = lib.sum(lib.build(lib.D, t, q)), b = lib.sum(lib.build(lib.P, t, q)); return Promise.resolve(lib.want(a.readAs === b.readAs && a.ok === b.ok && a.summary === b.summary, "draft " + a.readAs + " " + a.summary + " / was " + b.summary)); } },
  // ---- the station's name ---------------------------------------------------------------------------------------------
  c("B-title-keeps-name", "low", S("Electrical Schematic - Main Street Lift Station", ['part V1 source "120 V"', 'part F1 float "Off"', 'part F2 float "Lead On"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', "wire V1 F1", "wire F1 M1", "wire M1 V1"]),
    "the station is named Main Street Lift Station, not Pump station", SQ, { extra: function (m) { return lib.want(/Main Street Lift Station/.test(m.plan.title), "named " + m.plan.title); } }),
  c("B-title-35b", "low", R1, "Dual Pump Lift Station Electrical is named Dual Pump Lift Station", Q35, { extra: function (m) { return lib.want(m.plan.title === "Dual Pump Lift Station", "named " + m.plan.title); } })
];
module.exports = cases;
