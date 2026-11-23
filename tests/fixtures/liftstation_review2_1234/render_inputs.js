// render_inputs.js -- the station results and circuits the second review looked at in Chromium (replay_browser.py).
// node render_inputs.js prints them as JSON: [{id, q, text, note}].
"use strict";
var fs = require("fs"), path = require("path");
var CHAT = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "liftstation_1234", "chat_35b.json"), "utf8"));
var R1 = CHAT.replies[0].reply, SQ = "write a schematic for a typical lift station";
function S(title, lines) { return "MAKE SCHEMATIC: " + title + "\n" + lines.join("\n") + "\nEND"; }
var WIRE = ["wire V1 F1", "wire F1 M1", "wire M1 V1"];
function ctl(floats, pumps, extra) { return S("Lift station control", ['part V1 source "120 V"'].concat(floats, pumps || ['part M1 motor "Pump 1"', 'part M2 motor "Pump 2"'], extra || [], WIRE)); }
var EL = ctl(['part F1 float "Pumps Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On"', 'part F4 float "High Level Alarm"']);
var C = "draw a circuit with a battery, a switch, lamps, a motor, a resistor, a diode, a capacitor and a ground";
var out = [
  { id: "R-35b-adam", q: CHAT.question, text: R1, note: "the 35B's two blocks, Adam's question" },
  { id: "R-35b-piping-alone", q: CHAT.question, text: R1.slice(R1.indexOf("MAKE SCHEMATIC: Lift Station Piping")), note: "the piping block alone" },
  { id: "R-triplex-pump3on", q: "write a schematic for a triplex lift station", text: S("Triplex", ['part V1 source "480 V"', 'part F1 float "Pumps Off"', 'part F2 float "Pump 1 On"', 'part F3 float "Pump 2 On"', 'part F4 float "Pump 3 On"', 'part F5 float "High Level Alarm"', 'part M1 motor "Pump 1"', 'part M2 motor "Pump 2"', 'part M3 motor "Pump 3"', "wire V1 F1", "wire F1 M1", "wire M1 V1"]), note: "B-triplex-pump3on" },
  { id: "R-start-start2", q: SQ, text: ctl(['part F1 float "Stop"', 'part F2 float "Start"', 'part F3 float "Start 2"', 'part F4 float "Alarm"']), note: "B-duplex-start-start2" },
  { id: "R-lag-and-alarm", q: SQ, text: ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "Lag On / High Alarm"']), note: "B-duplex-lag-and-alarm-one-float" },
  { id: "R-relay-contact", q: SQ, text: ctl(['part F1 float "Off"', 'part F2 float "Lead On"', 'part F3 float "High Level Alarm"'], null, ['part CR1 contact "High Level"', 'part K1 relay "High Level Relay"']), note: "B-relay-contact-not-float" },
  { id: "R-schematic-then-station", q: SQ, text: EL + "\n\nAs one block:\n\nMAKE STATION: Lift station\npumps 3\nfloats off lead lag alarm\nwell \"wet well\" 12 ft\nEND", note: "B-schematic-then-station" },
  { id: "R-british", q: "write a schematic for a sewage pumping station", text: S("Pumping station", ["mode hydraulic", 'part W1 tank "Wet Well"', 'part P1 pump "Duty Pump"', 'part P2 pump "Standby Pump"', 'part V1 valve "Non-return Valve 1"', 'part V2 valve "Non-return Valve 2"', 'part V3 valve "Sluice Valve 1"', 'part V4 valve "Sluice Valve 2"', 'part R1 pipe "Rising Main"', "wire W1 P1", "wire W1 P2", "wire P1 V1", "wire V1 V3", "wire P2 V2", "wire V2 V4", "wire V3 R1", "wire V4 R1"]), note: "B-piping-british" },
  { id: "R-short-line-written", q: C, text: "MAKE SCHEMATIC: Circuit\npart B1 battery \"9 V\"\npart S1 switch\npart L1 lamp\npart G1 ground\nwire B1 S1\nwire S1 G1\nwire S1 L1\nwire G1 B1\nEND", note: "D-short-through-switch, Lantern's line written" },
  { id: "R-port-line-written", q: C, text: "MAKE SCHEMATIC: Circuit\npart B1 battery \"9 V\"\npart S1 switch\npart L1 lamp\npart G1 ground\nwire B1+ S1\nwire S1 L1\nwire L1 G1\nwire G1 B1\nEND", note: "D-port-named-line, Lantern's line written" },
  { id: "R-35b-second-try-line-written", q: "draw a circuit with a source, switches, two motors and three lamps", text: CHAT.replies[1].reply.replace("wire L3 G1\n", "wire L3 G1\nwire G1 V1\n"), note: "D-35b-second-try, Lantern's line written" }
];
if (require.main === module) process.stdout.write(JSON.stringify(out));
module.exports = out;
