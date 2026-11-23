// cases_c.js -- AI_STATION's part reader (partRole) for a part-and-wire MAKE SCHEMATIC answering a lift station's
// question: FTAG without a plain LS (Adam: "LS1 is typically a limit switch, FS1 would be float switch 1"), and the new
// FJOB2 (a switch or sensor whose whole name is a float's job words, with lead/lag/off/alarm/high/low/emergency in it, is
// a float; never a start or stop button, a selector, HOA or an e-stop).
// Each name is judged by what the part IS on a lift station's schematic -- its tag (JIC/NFPA: PB a push button, SS a
// selector, ES an e-stop, LS a limit switch; FS a float; ISA LSL/LSH a level switch), its type and its name -- written
// before Lantern was run on it. The part goes in beside four floats that already name every job (so the station is
// always read and drawn), and what Lantern made of it is read from the result: taken as a float (in the station's
// floats, or "not drawn: <id> ..." as a float the station has no room for, or sent back as a float), or not ("not
// carried ... <id> (switch)", or nowhere).
// Then whole stations whose floats or switches change what is drawn.
"use strict";
var lib = require("./lib.js");
var Q = "write a schematic for a typical lift station";
// (the base's names are none of the names tried: a float named the same as another is dropped without a word, on 1.24.34 too)
var BASE = ['part FS1 switch "All Pumps Off"', 'part FS2 switch "Lead Float On"', 'part FS3 switch "Lag Float On"', 'part FS4 switch "High High Alarm"'];
function sch(parts, title) { return "MAKE SCHEMATIC: " + (title || "Lift Station") + "\nmode electrical\npart V1 source \x22120 V\x22\n" + parts.join("\n") + "\npart M1 motor \x22Pump 1\x22\npart M2 motor \x22Pump 2\x22\nwire V1 M1\nwire M1 M2\nwire M2 V1\nEND"; }
function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
// how Lantern read part pid: "float:<job>" (drawn), "float:not drawn", "float:back", "not", or "no station"
function reading(m, pid) {
  if (!m) return "nothing built";
  var sp = m.plan && m.plan.spec, txt = (m.summary || "") + " | " + lib.probs(m) + " | " + ((m.plan && m.plan.warn) || []).join(" | ");
  if (sp) { var f = sp.floats.filter(function (x) { return x.id === pid; })[0]; if (f) return "float:" + f.job; }
  if (new RegExp("not drawn: [^|]*\\b" + esc(pid) + " \u201c").test(txt)) return "float:not drawn";
  if (new RegExp("\u201cpart " + esc(pid) + " ").test(lib.probs(m)) || new RegExp("float " + esc(pid) + " ").test(lib.probs(m))) return "float:back";
  if (m.readAs !== "STATION" && !(m.block && m.block.kind === "STATION")) return "no station";
  return "not";
}
var cases = [];
function part(id, harm, line, isFloat, right) {
  var pid = /^part\s+(\S+)/.exec(line)[1].toUpperCase();
  cases.push({ id: id, harm: harm, input: line + " (beside four floats, on: " + Q + ")", right: right || (isFloat ? "a float" : "not a float"),
    run: function () {
      return lib.boot().then(function (x) {
        var t = sch(BASE.concat([line])), a = reading(lib.build(x.N.L, t, Q), pid), b = reading(lib.build(x.O.L, t, Q), pid);
        var ok = isFloat ? /^float/.test(a) : !/^float/.test(a);
        return ok ? "" : "read as " + a + " (1.24.34: " + b + ")";
      });
    } });
}
// ---- not floats ---------------------------------------------------------------------------------------------------
part("C-onoff", "high", 'part S1 switch "On/Off"', false, "an on/off switch (a pump's or the panel's) is not a float");
part("C-pump1-onoff", "high", 'part S1 switch "Pump 1 On/Off"', false, "pump 1's on/off switch");
part("C-off-on", "medium", 'part S1 switch "Off/On"', false, "an off/on switch");
part("C-on-dash-off", "high", 'part SW1 switch "On-Off"', false, "an on-off switch");
part("C-alarm-onoff", "medium", 'part SW2 switch "Alarm On/Off"', false, "a switch that turns the alarm on and off");
part("C-ss-off", "medium", 'part SS1 switch "Off"', false, "SS is a selector switch's tag (MAKE CONTROL's own: switch SS1); \x22Off\x22 is its position");
part("C-selector-type-off", "high", 'part SS1 selector switch "Off"', false, "its type says selector: the exclusion of selectors reads only the name");
part("C-selector-type-off-s", "high", 'part S1 selector switch "Off"', false, "its type says selector");
part("C-ss-leadlag", "high", 'part SS1 switch "Lead/Lag"', false, "a lead/lag selector (which pump leads) is not the lag float");
part("C-selector-leadlag", "high", 'part SS1 selector switch "Lead/Lag"', false, "a lead/lag selector switch, so typed");
part("C-ss-pump1-lead", "medium", 'part SS1 switch "Pump 1 Lead"', false, "a lead-select switch's position (SS tag)");
part("C-ss-pump2-lead", "medium", 'part SS2 switch "Pump 2 Lead"', false, "a lead-select switch's other position");
part("C-ss-lead-pump-1-2", "medium", 'part SS1 switch "Lead Pump 1/2"', false, "a lead pump selector, 1 or 2");
part("C-pb-pump1-off", "high", 'part PB1 switch "Pump 1 Off"', false, "PB is a push button's tag: pump 1's off button");
part("C-pb-off", "medium", 'part PB1 switch "Off"', false, "an off push button");
part("C-pb-lead-start", "medium", 'part PB2 switch "Lead Pump Start"', false, "a push button (PB) that starts the lead pump by hand");
part("C-pb-lag-start", "medium", 'part PB3 switch "Lag Pump Start"', false, "a push button (PB) that starts the lag pump by hand");
part("C-pushbutton-switch-off", "high", 'part PB1 pushbutton switch "Off"', false, "its type says push button");
part("C-pushbutton-type", "medium", 'part PB1 push button "Pump 1 Off"', false, "a push button");
part("C-estop-hyphen", "high", 'part ES1 switch "Emergency-Stop"', false, "an emergency stop, hyphenated: never a float");
part("C-estop-off", "high", 'part ES1 switch "Emergency Off"', false, "an emergency off (ES tag): never a float");
part("C-estop-plain", "high", 'part ES1 switch "Emergency Stop"', false, "an emergency stop");
part("C-estop-caps", "high", 'part S9 switch "EMERGENCY STOP"', false, "an emergency stop in capitals");
part("C-estop-emergency", "medium", 'part ES1 switch "Emergency"', false, "ES1 \x22Emergency\x22: the e-stop");
part("C-estop-pb-type", "medium", 'part ES1 pushbutton "Emergency Stop"', false, "an e-stop push button");
part("C-highlow-speed", "medium", 'part SS1 switch "High/Low"', false, "a two-speed selector (SS)");
part("C-hi-lo", "medium", 'part SS1 switch "Hi-Lo"', false, "a two-speed selector (SS)");
part("C-alarm-silence", "medium", 'part S1 switch "Alarm Silence"', false, "the alarm silence button");
part("C-alarm-reset", "medium", 'part S1 switch "Alarm Reset"', false, "the alarm reset");
part("C-alarm-test", "medium", 'part S1 switch "Alarm Test"', false, "the alarm test");
part("C-alarm-ack", "medium", 'part S1 switch "Alarm Acknowledge"', false, "the alarm acknowledge button");
part("C-alarm-mute", "medium", 'part S1 switch "Alarm Mute"', false, "the alarm mute button");
part("C-horn-silence", "medium", 'part PB4 switch "Horn Silence"', false, "the horn silence button");
part("C-lamp-test", "low", 'part S1 switch "Lamp Test"', false, "the lamp test button");
part("C-high-speed", "medium", 'part S1 switch "High Speed"', false, "a speed switch");
part("C-low-speed", "medium", 'part S1 switch "Low Speed"', false, "a speed switch");
part("C-low-oil", "medium", 'part S1 switch "Low Oil"', false, "a low oil switch (an engine's or a gearbox's)");
part("C-low-oil-pressure", "medium", 'part PS1 switch "Low Oil Pressure"', false, "an oil pressure switch");
part("C-high-temp", "medium", 'part TS1 switch "High Temp"', false, "a temperature switch");
part("C-low-voltage", "low", 'part S1 switch "Low Voltage"', false, "a voltage relay's contact");
part("C-hand", "medium", 'part S1 switch "Hand"', false, "an HOA position");
part("C-auto", "medium", 'part S1 switch "Auto"', false, "an HOA position");
part("C-hoa", "medium", 'part SS1 switch "Hand/Off/Auto"', false, "a hand-off-auto switch");
part("C-off-auto", "medium", 'part SS1 switch "Off/Auto"', false, "an off-auto switch");
part("C-hoa-letters", "medium", 'part SS1 switch "H-O-A"', false, "a hand-off-auto switch");
part("C-pump1-hand", "medium", 'part S1 switch "Pump 1 Hand"', false, "pump 1's hand position");
part("C-pump1-start", "medium", 'part S2 switch "Pump 1 Start"', false, "the 35B's own start button (1.24.34's chat)");
part("C-pump1-stop", "medium", 'part S4 switch "Pump 1 Stop"', false, "the 35B's own stop button");
part("C-pump1-off-s", "low", 'part S3 switch "Pump 1 Off"', false, "beside the 35B's \x22Pump 1 Start\x22 style, pump 1's off switch (low: a float named for one pump's off is not unheard of)");
part("C-start", "medium", 'part S1 switch "Start"', false, "a start button");
part("C-stop", "medium", 'part S1 switch "Stop"', false, "a stop button");
part("C-auto-manual", "medium", 'part S1 switch "Auto/Manual"', false, "the 35B's own auto/manual selector");
part("C-ls-noname", "medium", "part LS1 switch", false, "Adam: LS1 is a limit switch");
part("C-ls-hatch-open", "medium", 'part LS1 switch "Hatch Open"', false, "a hatch limit switch");
part("C-ls-hatch-closed", "medium", 'part LS2 switch "Hatch Closed"', false, "a hatch limit switch");
part("C-ls-valve-open", "medium", 'part LS1 switch "Valve Open"', false, "a valve's position switch");
part("C-ls-gate-closed", "medium", 'part LS3 limit switch "Gate Valve Closed"', false, "a gate valve's limit switch");
part("C-ls-door", "medium", 'part LS1 switch "Door"', false, "a door switch");
part("C-ls-open", "medium", 'part LS1 switch "Open"', false, "a limit switch, open position");
part("C-ls-closed", "medium", 'part LS2 switch "Closed"', false, "a limit switch, closed position");
part("C-ls-upper-limit", "medium", 'part LS1 switch "Upper Limit"', false, "a limit switch");
part("C-lamp-pump1-off", "medium", 'part L1 lamp "Pump 1 Off"', false, "a light");
part("C-lamp-alarm", "medium", 'part L2 light "High Level Alarm"', false, "a light");
part("C-relay-lead", "medium", 'part CR1 relay "Lead Call"', false, "a relay");
part("C-relay-lag", "medium", 'part CR2 relay "Lag"', false, "a relay");
part("C-horn-alarm", "medium", 'part AH1 horn "High Level Alarm"', false, "a horn");
part("C-breaker", "medium", 'part CB1 switch "Main Breaker"', false, "a breaker");
part("C-control-power-off", "medium", 'part S1 switch "Control Power Off"', false, "a control power switch");
part("C-leadlag-select", "medium", 'part SS1 switch "Lead/Lag Select"', false, "a lead/lag selector");
part("C-leadlag-selector", "medium", 'part SS1 switch "Lead/Lag Selector"', false, "a lead/lag selector");
part("C-alternator-bypass", "medium", 'part SS1 switch "Alternator Bypass"', false, "an alternator bypass switch");
part("C-lead-pump-select", "medium", 'part SS1 switch "Lead Pump Select"', false, "a lead pump selector");
// ---- floats ---------------------------------------------------------------------------------------------------------
part("C-ls-off", "high", 'part LS1 switch "Off"', true, "an LS named only for a float's job (the author's own case)");
part("C-ls-lead-on", "high", 'part LS2 switch "Lead On"', true);
part("C-ls-lag-on", "high", 'part LS3 switch "Lag On"', true);
part("C-ls-hla", "high", 'part LS4 switch "High Level Alarm"', true);
part("C-ls-hla-unquoted", "medium", "part LS4 switch High Level Alarm", true, "the name written without quotes");
part("C-ls-stop", "medium", 'part LS1 switch "Stop"', true, "an LS on a lift station named Stop: the float that stops the pumps (Adam's probes, as switches: Stop, Start, High)");
part("C-ls-start", "medium", 'part LS2 switch "Start"', true, "an LS named Start: the float that starts the pump");
part("C-ls-on", "medium", 'part LS2 switch "On"', true, "an LS named On: the pump-on float");
part("C-ls-pump-on", "medium", 'part LS2 switch "Pump On"', true, "the pump-on float");
part("C-ls-pump1-on", "medium", 'part LS2 switch "Pump 1 On"', true, "the float that brings pump 1 on");
part("C-ls-pump2-on", "medium", 'part LS3 switch "Pump 2 On"', true, "the float that brings pump 2 on (the lag)");
part("C-ls-both-on", "medium", 'part LS3 switch "Both Pumps On"', true, "the float that runs both pumps");
part("C-ls-all-on", "medium", 'part LS3 switch "All Pumps On"', true, "the float that runs all pumps");
part("C-ls-1st-on", "medium", 'part LS2 switch "1st Pump On"', true, "the first pump's on float");
part("C-ls-second-start", "medium", 'part LS3 switch "Second Pump Start"', true, "the second pump's start float");
part("C-ls-pump1-start", "low", 'part LS2 switch "Pump 1 Start"', true, "an LS (a level switch on a lift station) that starts pump 1");
part("C-ls-pumps-off", "high", 'part LS1 switch "Pumps Off"', true);
part("C-ls-lead-start", "high", 'part LS2 switch "Lead Start"', true);
part("C-ls-high", "medium", 'part LS5 switch "High"', true);
part("C-ls-alarm", "medium", 'part LS4 switch "Alarm"', true, "a switch called Alarm among a lift station's level switches: the alarm float");
part("C-ls-emergency-high", "high", 'part LS4 switch "Emergency High"', true);
part("C-ls-hihi", "medium", 'part LS4 switch "Hi-Hi"', true);
part("C-ls-lowlow", "medium", 'part LS0 switch "Low Low"', true);
part("C-ls-redundant-off", "medium", 'part LS0 switch "Redundant Off"', true);
part("C-fs-noname", "high", "part FS5 switch", true, "an FS with no name: a float (sent back for its job)");
part("C-lsl", "high", "part LSL1 switch", true, "ISA: level switch low");
part("C-lsh", "high", "part LSH1 switch", true, "ISA: level switch high");
part("C-lshh", "high", "part LSHH1 switch", true, "ISA: level switch high high");
part("C-lsll", "high", "part LSLL1 switch", true, "ISA: level switch low low");
part("C-ls-float-type", "high", "part LS1 float switch", true, "its type says float");
part("C-ls-level-type", "high", 'part LS2 level switch "Pump On"', true, "its type says level");
part("C-ls-float-name", "high", 'part LS1 switch "Float 1"', true, "its name says float");
part("C-s-lead-pump-on", "medium", 'part S5 switch "Lead Pump On"', true, "a float's job, whatever the tag");
part("C-s-high-water", "high", 'part S6 switch "High Water"', true);
part("C-probe-stop", "high", 'part E1 probe "Stop"', true, "Adam's probes: Stop");
part("C-probe-start", "high", 'part E2 probe "Start"', true, "Adam's probes: Start");
part("C-probe-high", "high", 'part E3 probe "High"', true, "Adam's probes: High");
part("C-sensor-high-level", "high", 'part H1 sensor "High Level Float"', true, "the 35B's own");

// ---- whole stations: what is drawn ------------------------------------------------------------------------------
function station(id, harm, parts, want, right, opts) {
  opts = opts || {};
  cases.push({ id: id, harm: harm, input: parts.join(" ; ") + " (on: " + (opts.q || Q) + ")", right: right,
    run: function () {
      return lib.boot().then(function (x) {
        var q = opts.q || Q, m = lib.build(x.N.L, sch(parts), q), o = lib.build(x.O.L, sch(parts), q);
        function fl(r) { var sp = r && r.plan && r.plan.spec; return sp ? sp.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : (r && r.readAs === "STATION" ? "back: " + lib.short(lib.probs(r), 200) : "not a station" + (r && r.ok ? " (drawn as a schematic)" : ": " + lib.short(lib.probs(r), 160))); }
        var got = fl(m);
        if (typeof want === "function") { var w = want(m, got); return w ? w + " (1.24.34: " + fl(o) + ")" : ""; }
        return lib.want(got === want, "floats " + got + ", want " + want + " (1.24.34: " + fl(o) + ")");
      });
    } });
}
station("C-set-adam-probes-as-switches", "high", ['part LS1 switch "Stop"', 'part LS2 switch "Start"', 'part LS3 switch "High"'], "LS1:off,LS2:lead,LS3:lag",
  "Adam's probes written as LS switches: Stop, Start, and High starting the second pump while the first runs (Adam, 2026-11-23)");
station("C-set-pump-on", "high", ['part LS1 switch "Pumps Off"', 'part LS2 switch "Pump 1 On"', 'part LS3 switch "Pump 2 On"', 'part LS4 switch "High Water Alarm"'], "LS1:off,LS2:lead,LS3:lag,LS4:alarm",
  "LS floats named by the pump each brings on: off, lead (pump 1 on), lag (pump 2 on), alarm -- a lag float, so both pumps run when one cannot keep up");
station("C-set-on-both", "high", ['part LS1 switch "Off"', 'part LS2 switch "On"', 'part LS3 switch "Both On"', 'part LS4 switch "Alarm"'], "LS1:off,LS2:lead,LS3:lag,LS4:alarm",
  "LS floats named Off, On, Both On, Alarm");
station("C-set-start-stop", "high", ['part LS1 switch "Stop"', 'part LS2 switch "Start"', 'part LS3 switch "Lag Start"', 'part LS4 switch "High Alarm"'], "LS1:off,LS2:lead,LS3:lag,LS4:alarm",
  "LS floats named Stop, Start, Lag Start, High Alarm");
station("C-set-pump-off-on", "high", ['part LS1 switch "Pump Off"', 'part LS2 switch "Pump On"', 'part LS3 switch "Both Pumps On"', 'part LS4 switch "High Level"'], function (m, got) {
  return /LS1:off/.test(got) && /LS2:lead/.test(got) && /LS3:lag/.test(got) && /LS4:(alarm|lag)/.test(got) ? "" : "floats " + got;
}, "LS floats named Pump Off, Pump On, Both Pumps On, High Level: LS2 starts the lead pump (not the high level float LS4)");
station("C-set-onoff-is-not-the-off-float", "high", ['part S1 switch "On/Off"', 'part LS2 switch "Lead On"', 'part LS3 switch "Lag On"', 'part LS4 switch "High Level Alarm"'], function (m, got) {
  return /\bS1:/.test(got) ? "the on/off switch S1 is drawn as a float: " + got : "";
}, "an on/off switch beside three floats is not the off float (Lantern adds the usual off float and says so, or asks for it)");
station("C-set-estop-is-not-the-off-float", "high", ['part ES1 switch "Emergency-Stop"', 'part LS2 switch "Lead On"', 'part LS3 switch "Lag On"', 'part LS4 switch "High Level Alarm"'], function (m, got) {
  return /\bES1:/.test(got) ? "the emergency stop ES1 is drawn as a float: " + got : "";
}, "an emergency stop is never drawn as the off float");
station("C-set-leadlag-selector-is-not-the-lag", "high", ['part SS1 selector switch "Lead/Lag"', 'part FS1 switch "Off"', 'part FS2 switch "Lead On"', 'part FS4 switch "High Level Alarm"'], function (m, got) {
  return /\bSS1:/.test(got) ? "the lead/lag selector SS1 is drawn as a float: " + got : "";
}, "a lead/lag selector is not the lag float: with no lag float, one pump runs at a time, and that is said");
station("C-set-no-floats-onoff-estop", "high", ['part S1 switch "On/Off"', 'part S2 switch "Emergency Stop"'], function (m, got) {
  return /\bS1:/.test(got) ? "the on/off switch S1 becomes the station's off float: " + got : "";
}, "a schematic of pumps with an on/off switch and an e-stop, no floats: the on/off switch is not taken as a float");
station("C-set-ls-noname", "medium", ["part LS1 switch", "part LS2 switch", "part LS3 switch", "part LS4 switch"], function (m, got) {
  return /LS\d:/.test(got) ? "LS switches with no names are taken as floats: " + got : "";
}, "four LS switches with no names: limit switches (Adam), not floats");
station("C-set-fs-noname-back", "high", ["part FS1 switch", "part FS2 switch", "part FS3 switch", "part FS4 switch"], function (m, got) {
  return m && m.fixKind === "STATION" && /part FS1 switch/.test(lib.probs(m)) ? "" : "not sent back for the floats' jobs: " + got;
}, "four FS switches with no names: floats, sent back once to name their jobs");
station("C-set-isa", "high", ["part LSL1 switch", "part LSH1 switch", "part LSHH1 switch"], "LSL1:off,LSH1:lead,LSHH1:alarm",
  "ISA level switches with no names: low (off), high (lead), high high (alarm)");
station("C-set-mixed-limits-and-floats", "high", ['part FS1 switch "Off"', 'part FS2 switch "Lead On"', 'part FS3 switch "Lag On"', 'part FS4 switch "High Level Alarm"', 'part LS1 switch "Hatch"', 'part LS2 switch "Valve Open"'],
  "FS1:off,FS2:lead,FS3:lag,FS4:alarm", "floats and limit switches side by side: the floats drawn, the limit switches not");
station("C-set-35b-chat", "high", ['part S1 switch "Auto/Manual"', 'part S2 switch "Pump 1 Start"', 'part S3 switch "Pump 2 Start"', 'part S4 switch "Pump 1 Stop"', 'part S5 switch "Pump 2 Stop"', 'part H1 sensor "High Level Float"', 'part H2 sensor "Low Level Float"', 'part H3 sensor "Emergency High"'],
  function (m, got) { return /\bS\d:/.test(got) ? "a button or selector drawn as a float: " + got : /H1/.test(got) && /H2/.test(got) && /H3/.test(got) ? "" : "floats " + got; },
  "the 35B's own parts (1.24.34's chat): its buttons and selector are not floats; its three sensors are");
module.exports = cases;
