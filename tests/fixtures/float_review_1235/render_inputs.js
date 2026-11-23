// render_inputs.js -- the blocks replay_browser.py draws in Chromium: ladders with float, pressure and temperature
// switches (normally open and closed, on the rung and in a branch under it), each with the question it answers.
// Prints them as JSON.
"use strict";
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
var DUP = "Draw the control circuit for a duplex lift station with an alternating relay";
var IN = [
  { id: "station-typical", text: "MAKE STATION: Typical Lift Station\npumps 2\nfloats off lead lag alarm\nEND", q: "write a schematic for a typical lift station" },
  { id: "duplex-two-alarms-lamps", text: blk("CONTROL", "Duplex", ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'float FS5 "high high level alarm"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'lamp LT1 FS4 "high level" red', 'lamp LT2 FS5 "high high level" red']), q: DUP },
  { id: "duplex-two-alarms-horn", text: blk("CONTROL", "Duplex", ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'float FS5 "high high alarm"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'horn AH1 "alarm"']), q: DUP },
  { id: "duplex-low-alarm", text: blk("CONTROL", "Duplex", ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'float FS0 "low level alarm"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']), q: DUP },
  { id: "sump-simplex", text: blk("CONTROL", "Sump", ['float FS1 M1 "pump off"', 'float FS2 M1 "pump on"', 'coil M1 "sump pump starter"']), q: "Draw the control circuit for a sump pump with an on float and an off float" },
  { id: "fill-nc", text: blk("CONTROL", "Fill", ['float FS1 M1 nc "tank full"', 'coil M1 "well pump starter"']), q: "Draw the control circuit for a well pump that fills a storage tank and stops when the tank is full" },
  { id: "booster-low-cutoff", text: blk("CONTROL", "Booster", ["stop PB1 M1", "start PB2 M1", 'float FS1 M1 "low level cutoff"', 'coil M1 "booster pump starter"']), q: "Draw the control circuit for a booster pump with start and stop buttons and a low level cutoff float in the supply tank" },
  { id: "compressor-hp-cutout", text: blk("CONTROL", "Compressor", ["stop PB1 M1", "start PB2 M1", 'pressure PS1 M1 nc "high pressure cutout"', 'pressure PS2 M1 "low oil pressure"', 'coil M1 "compressor starter"']), q: "Draw the control circuit for an air compressor starter with a high pressure cutout and an oil pressure switch" },
  { id: "heater-thermostat", text: blk("CONTROL", "Heater", ['temp TS1 C1 nc "thermostat"', 'temp TS2 C1 nc "high limit"', 'coil C1 "heater contactor"', 'lamp LT1 C1 "heating" amber']), q: "Draw the control circuit for an electric heater contactor switched by a thermostat with a high limit" },
  { id: "fan-thermostat", text: blk("CONTROL", "Fan", ['temp TS1 M1 "fan thermostat"', 'coil M1 "fan starter"']), q: "Draw the control circuit for an exhaust fan started by a thermostat when the room gets hot" },
  { id: "limits-and-selector", text: blk("CONTROL", "Door", ["stop PB1 M1", "start PB2 M1", "limit LS1 M1 nc \x22open limit\x22", "switch SS1 M1 \x22auto\x22", 'coil M1 "door motor"']), q: "Draw the control circuit for a door motor with a stop, a start, an open limit switch and a selector" },
  { id: "two-floats-on-one-row", text: blk("CONTROL", "Tank", ['float FS1 M1 "low level cutoff"', 'pressure PS1 M1 nc "high pressure"', 'temp TS1 M1 nc "motor overtemp"', 'float FS2 M1 nc "tank full"', 'coil M1 "transfer pump starter"']), q: "Draw the control circuit for a transfer pump that fills a tank, with a low level cutoff, a high pressure switch and a motor overtemperature switch" }
];
if (require.main === module) process.stdout.write(JSON.stringify(IN));
module.exports = IN;
