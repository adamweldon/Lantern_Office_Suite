// cases_circuits.js -- control circuits written by the reviewer, as trades write them.
// expect "pass": built with no problem (nothing sent back); nc: {ID: drawn normally closed?}; kept: words the
//   "Checked to ..." line must hold.
// expect "back": the code checks send back exactly the devices in dev (and nothing else); line: the exact line to
//   write, where one is sure; practice: the practice named; fixNc: after each "Write it" line is put in place of the
//   device's own line, the block builds with no problem and the device is drawn so.
// harm: how bad it is if the build does otherwise; why: what is right, and why.
// Lantern's convention: a process switch written without nc closes as the quantity rises; written nc it opens as it
// rises.
"use strict";
var C = [];
function pass(id, q, lines, o) { o = o || {}; C.push({ id: id, expect: "pass", q: q, lines: lines, nc: o.nc, kept: o.kept, saved: o.saved, harm: o.harm || "high", why: o.why || "" }); }
function back(id, q, lines, o) { C.push({ id: id, expect: "back", q: q, lines: lines, dev: o.dev, line: o.line, practice: o.practice, fixNc: o.fixNc, saved: o.saved, harm: o.harm || "medium", why: o.why || "" }); }
var SS = ["stop PB1 M1", "start PB2 M1"];

// ---------------------------------------------------------------- alarms on high switches (an alarm closes on rise)
pass("R-alarm-01", "Draw the control circuit for a pump with a high pressure alarm horn",
  SS.concat(['coil M1 "pump starter"', 'pressure PS1 CR1 "high pressure alarm"', 'coil CR1 "alarm relay"', 'horn AH1 CR1']), { nc: { PS1: false }, why: "an alarm relay pulled in as the pressure rises past the switch: normally open is right" });
pass("R-alarm-02", "Draw the control circuit for a pump with a high pressure alarm horn",
  SS.concat(['coil M1 "pump starter"', 'pressure PS1 CR1 "high pressure trip alarm"', 'coil CR1 "alarm relay"', 'horn AH1 CR1']), { nc: { PS1: false }, why: "the trip's alarm: the relay is the alarm relay and only sounds the horn; it closes on rise. The word trip does not make the alarm a cut-out" });
pass("R-alarm-03", "Wire an over temperature alarm light and relay for a panel",
  ['temp TS1 CR1 "over temperature alarm"', 'coil CR1 "alarm relay"', 'lamp LT1 CR1 "over temp" red'], { nc: { TS1: false }, why: "an alarm relay on an over-temperature switch: pulled in as the temperature rises; normally open is right" });
pass("R-alarm-04", "Wire a high temperature warning light",
  ['temp TS1 LT1 "high temperature"', 'lamp LT1 "high temp" red'], { nc: { TS1: false }, why: "a light on a high switch" });
pass("R-alarm-05", "Draw a high level alarm for a tank",
  ['float FS1 CR1 "high level alarm"', 'coil CR1 "alarm relay"', 'horn AH1 CR1'], { nc: { FS1: false }, why: "an alarm relay on a high level float closes on rise" });
pass("R-alarm-06", "Draw an overfill alarm for a tank",
  ['float FS1 CR1 "overfill alarm"', 'coil CR1 "alarm relay"', 'horn AH1 CR1'], { nc: { FS1: false }, why: "an overfill ALARM relay: it must pull in as the level rises, normally open is right" });
pass("R-alarm-07", "Draw a delayed high pressure alarm: a horn after 10 seconds of high pressure",
  ['pressure PS1 TR1 "high pressure safety alarm"', 'timer TR1 "10 s"', 'horn AH1 TR1'], { nc: { PS1: false }, why: "the alarm timer starts as the pressure rises past the switch: normally open is right" });
pass("R-alarm-08", "Draw a boiler low water cut-off with an alarm relay and horn",
  ['float FS1 M1 "low water cut-off"', 'coil M1 "burner"', 'float FS2 CR2 nc "low water cut-off alarm"', 'coil CR2 "alarm relay"', 'horn AH1 CR2'], { nc: { FS1: false, FS2: true }, why: "the alarm contact of a low water cut-off closes as the water FALLS (written nc): the alarm relay is pulled in when the water is low, which is the alarm. FS1, the cut-off, is written open and is right" });
pass("R-alarm-09", "Wire an overheat warning lamp",
  ['temp TS1 LT1 "high temperature cut-out"', 'lamp LT1 "overheat" red'], { nc: { TS1: false }, why: "a light on a high switch closes on rise" });
pass("R-alarm-10", "Wire a horn for high pressure",
  ['pressure PS1 AH1 "high pressure trip"', 'horn AH1 "alarm"'], { nc: { PS1: false }, why: "a horn on a high switch closes on rise" });

// ---------------------------------------------------------------- cooling fans on thermostats that close on rise
pass("R-fan-01", "Wire a cooling fan on a thermostat", ['temp TS1 M1 "fan thermostat"', 'coil M1 "cooling fan"'], { nc: { TS1: false } });
pass("R-fan-02", "Wire a panel cooling fan on a thermostat", ['temp TS1 M1 "high temperature"', 'coil M1 "panel cooling fan"'], { nc: { TS1: false } });
pass("R-fan-03", "Wire a cabinet cooling fan that runs on over temperature",
  ['temp TS1 M1 "over temperature"', 'coil M1 "cabinet cooling fan"'], { nc: { TS1: false }, why: "a cooling fan runs as the temperature rises: normally open (closes on rise) is right. Sent back, the model is told to write nc, and the fan would run only when cold" });
pass("R-fan-04", "Wire an exhaust fan that comes on when the room overheats",
  ['temp TS1 M1 "overheat"', 'coil M1 "exhaust fan"'], { nc: { TS1: false }, why: "an exhaust fan on overheat closes on rise; nc would run it only while cool" });
pass("R-fan-05", "Wire a cooling fan thermostat, on at 30 C and off at 25 C",
  ['temp TS1 M1 "cut-in 30 cut-out 25"', 'coil M1 "cooling fan"'], { nc: { TS1: false }, why: "cooling: cut-in above cut-out, closes on rise" });
pass("R-fan-06", "Wire a cooling fan thermostat", ['temp TS1 M1 "on at 35 C, max 60 C"', 'coil M1 "cooling fan"'], { nc: { TS1: false } });
pass("R-fan-07", "Wire a furnace blower on its fan limit control",
  ['temp TS1 M1 "fan limit"', 'coil M1 "furnace blower"'], { nc: { TS1: false }, why: "the fan switch of a fan limit control closes on rise" });
pass("R-fan-08", "Wire an attic fan on a thermostat", ['temp TS1 M1 "excess heat"', 'coil M1 "attic fan"'], { nc: { TS1: false } });
pass("R-fan-09", "Wire an exhaust fan relay that pulls in when the room overheats",
  ['temp TS1 CR1 "overheat"', 'coil CR1 "fan relay"', 'coil M1 CR1 "exhaust fan"'], { nc: { TS1: false }, why: "the fan's relay pulls in on overheat: closes on rise" });
pass("R-fan-10", "Transformer cooling fans on a winding temperature switch",
  ['temp TS1 M1 "winding temperature high"', 'coil M1 "cooling fans"'], { nc: { TS1: false } });

// ---------------------------------------------------------------- heaters, boilers, high limits (open on rise: nc)
pass("R-heat-01", "Wire a heater on a thermostat", ['temp TS1 M1 nc "heater thermostat"', 'coil M1 "heater contactor"'], { nc: { TS1: true } });
pass("R-heat-02", "Draw a boiler burner control with a high limit", ['temp TS1 M1 nc "high limit"', 'coil M1 "burner"'], { nc: { TS1: true }, kept: ["TS1 opens as the temperature rises"] });
pass("R-heat-03", "Draw a boiler burner control", ['temp TS1 M1 nc "operating control"', 'temp TS2 M1 nc "high limit"', 'coil M1 "burner"'], { nc: { TS1: true, TS2: true } });
pass("R-heat-04", "Draw a boiler burner control", ['temp TS1 M1 nc "manual reset high limit"', 'coil M1 "burner"'], { nc: { TS1: true } });
pass("R-heat-05", "Wire a heating thermostat, on at 60 off at 70", ['temp TS1 M1 nc "cut-in 60 cut-out 70"', 'coil M1 "heater"'], { nc: { TS1: true } });
pass("R-heat-06", "Draw a boiler burner control", ['temp TS1 M1 N.C. "high limit"', 'coil M1 "burner"'], { nc: { TS1: true } });
pass("R-heat-07", "Draw a boiler burner control", ['temp TS1 M1 normally closed "high limit"', 'coil M1 "burner"'], { nc: { TS1: true } });
pass("R-heat-08", "Draw a boiler burner control", ['temp TS1 M1 "high limit" nc', 'coil M1 "burner"'], { nc: { TS1: true } });
pass("R-heat-09", "Wire an oven heater with an over-temperature cut-out", ['temp TS1 M1 nc "over-temperature cut-out"', 'coil M1 "oven heater"'], { nc: { TS1: true } });
pass("R-heat-10", "Wire a frost thermostat to bring on the boiler in a UK house",
  ['temp TS1 M1 nc "frost stat"', 'coil M1 "boiler relay"'], { nc: { TS1: true }, why: "a frost thermostat brings the heating ON as the temperature falls (BS EN 60730 frost stats close on fall): it opens as the temperature rises, so nc under Lantern's convention. Sent back, the model is told to take nc off, and the boiler would fire only when warm" });
pass("R-heat-11", "Heat trace on a pipe, turned on by a thermostat when it gets cold",
  ['temp TS1 M1 nc "freeze protection"', 'coil M1 "heat trace contactor"'], { nc: { TS1: true }, why: "freeze-protection heat trace runs as the temperature falls: the stat opens on rise (nc). Sent back, the heat trace would run only above the setting" });
pass("R-heat-12", "Defrost heater control for a walk-in freezer",
  ['switch SS1 M2 "defrost timer"', 'temp TS2 M2 nc "freezer defrost termination"', 'coil M2 "defrost heaters"'], { nc: { TS2: true }, why: "a defrost termination stat in series with the heaters opens as the coil warms: nc is right. The word freezer is not a freeze cut-out" });
pass("R-heat-13", "Draw a boiler with a low water cut-off and a high limit", ['float FS1 M1 "low water cut-off"', 'temp TS1 M1 nc "high limit"', 'coil M1 "burner"'], { nc: { FS1: false, TS1: true }, kept: ["FS1 opens as the water falls", "TS1 opens as the temperature rises"] });
pass("R-heat-14", "Wire a water heater element with its high temperature cut-off", ['temp TS1 M1 nc "high temperature cut-off"', 'coil M1 "element contactor"'], { nc: { TS1: true } });
pass("R-heat-15", "Electric heater with a thermostat and an overheat cut-out", ['temp TS1 M1 nc "thermostat"', 'temp TS2 M1 nc "overheat cut-out"', 'coil M1 "heater"'], { nc: { TS1: true, TS2: true } });
pass("R-heat-16", "Tank heater with frost protection",
  ['temp TS1 M1 nc "frost protection"', 'coil M1 "tank heater"'], { nc: { TS1: true }, why: "frost protection turns a heater ON as it cools: opens on rise, nc" });
pass("R-heat-17", "Wire a heater on a low temperature thermostat", ['temp TS1 M1 nc "low temperature"', 'coil M1 "heater"'], { nc: { TS1: true } });

// ---------------------------------------------------------------- low water cut-offs (open as the water falls: no nc)
pass("R-lwco-01", "Boiler low water cut-off", ['float FS1 M1 "low water cut-off"', 'coil M1 "burner"'], { nc: { FS1: false }, kept: ["FS1 opens as the water falls"] });
pass("R-lwco-02", "Boiler low water cut-off", ['float FS1 M1 "LWCO"', 'coil M1 "burner"'], { nc: { FS1: false } });
pass("R-lwco-03", "Boiler low water cutoff", ['float FS1 M1 "low water cutoff"', 'coil M1 "burner"'], { nc: { FS1: false } });
pass("R-lwco-04", "Boiler low water cut off", ['float FS1 M1 "low-water cut off"', 'coil M1 "burner"'], { nc: { FS1: false } });
pass("R-lwco-05", "Boiler low water cut-off on a permit relay", ['float FS1 CR1 "low water cut-off"', 'coil CR1 "burner permit"', 'coil M1 CR1 "burner"'], { nc: { FS1: false } });
pass("R-lwco-06", "Boiler low water cut-off", ['float FS1 M1 "loss of water cut-out"', 'coil M1 "burner"'], { nc: { FS1: false } });

// ---------------------------------------------------------------- freeze stats (open as the air cools: no nc)
pass("R-fz-01", "Air handler freeze stat", ['temp TS1 M1 "freeze stat"', 'coil M1 "supply fan"'], { nc: { TS1: false } });
pass("R-fz-02", "Air handler freezestat", ['temp TS1 M1 "freezestat"', 'coil M1 "supply fan"'], { nc: { TS1: false } });
pass("R-fz-03", "Air handler low limit", ['temp TS1 M1 "low limit"', 'coil M1 "supply fan"'], { nc: { TS1: false } });
pass("R-fz-04", "Air handler low temperature cut-out", ['temp TS1 M1 "low temperature cut-out"', 'coil M1 "supply fan"'], { nc: { TS1: false } });
pass("R-fz-05", "Air handler freeze stat on a fan permit relay", ['temp TS1 CR1 "freeze stat"', 'coil CR1 "fan permit"', 'coil M1 CR1 "supply fan"'], { nc: { TS1: false } });
pass("R-fz-06", "Air handler low temp limit", ['temp TS1 M1 "low temp limit"', 'coil M1 "supply fan"'], { nc: { TS1: false } });

// ---------------------------------------------------------------- refrigeration
pass("R-ref-01", "Refrigeration compressor with high and low pressure controls", ['pressure PS1 M1 nc "high pressure cut-out"', 'pressure PS2 M1 "low pressure cut-out"', 'coil M1 "compressor contactor"'], { nc: { PS1: true, PS2: false }, kept: ["PS1 opens as the pressure rises", "PS2 opens as the pressure falls"] });
pass("R-ref-02", "Refrigeration compressor", ['pressure PS1 M1 nc "HP cut-out"', 'coil M1 "compressor contactor"'], { nc: { PS1: true } });
pass("R-ref-03", "Refrigeration compressor with a dual pressure control", ['pressure PS1 M1 "dual high/low pressure control"', 'coil M1 "compressor contactor"'], { nc: { PS1: false }, why: "a dual control is closed between its two settings: neither way is sure, so it is left as written" });
pass("R-ref-04", "Refrigeration compressor with a dual pressure control", ['pressure PS1 M1 nc "high/low pressure control"', 'coil M1 "compressor contactor"'], { nc: { PS1: true } });
pass("R-ref-05", "Refrigeration compressor low pressure control", ['pressure PS2 M1 "cut-in 40 cut-out 20"', 'coil M1 "compressor contactor"'], { nc: { PS2: false }, why: "a low pressure control cuts in above its cut-out: it closes on rise" });
pass("R-ref-06", "Refrigeration compressor low pressure control", ['pressure PS2 M1 "cut-out 20 psig, cut-in 40 psig"', 'coil M1 "compressor contactor"'], { nc: { PS2: false } });
pass("R-ref-07", "Refrigeration compressor high pressure control", ['pressure PS1 M1 nc "cut-in 300 cut-out 400"', 'coil M1 "compressor contactor"'], { nc: { PS1: true } });
pass("R-ref-08", "Refrigeration compressor", ['pressure PS1 M1 nc "high pressure cut-out 400 psig"', 'pressure PS2 M1 "low pressure cut-out 20 psig"', 'coil M1 "compressor contactor"'], { nc: { PS1: true, PS2: false } });
pass("R-ref-09", "Refrigeration pump down control",
  ['temp TS1 SOL1 "cooling thermostat"', 'solenoid SOL1 "liquid line"', 'pressure PS2 M1 "low pressure control cut-in 35 cut-out 10"', 'coil M1 "compressor"'], { nc: { TS1: false, PS2: false } });
pass("R-ref-10", "Freezer thermostat for the compressor, cut-in -12 C, cut-out -18 C",
  ['temp TS1 M1 "cut-in -12 C cut-out -18 C"', 'coil M1 "freezer compressor"'], { nc: { TS1: false }, why: "a freezer's cut-out (-18) is BELOW its cut-in (-12): it closes on rise, written without nc. Lantern reads the numbers without their minus signs (18 > 12) and calls it a high cut-out" });
pass("R-ref-11", "Freezer thermostat", ['temp TS1 M1 "cut-in 5 F, cut-out -10 F"', 'coil M1 "freezer compressor"'], { nc: { TS1: false }, why: "cut-out -10 F is below cut-in 5 F: a cooling stat, closes on rise" });
pass("R-ref-12", "Walk-in cooler thermostat", ['temp TS1 M1 "cut-in 40 F cut-out 34 F"', 'coil M1 "compressor"'], { nc: { TS1: false } });
pass("R-ref-13", "Refrigeration compressor with an oil pressure safety switch and its 90 second timer",
  SS.concat(['pressure PS3 TR1 nc "loss of oil pressure"', 'timer TR1 "90 s"', 'coil M1 TR1 off "compressor"']), { nc: { PS3: true }, why: "the oil safety's contact is closed while the oil pressure is low and opens as it rises (nc): it runs the trip TIMER while the pressure is lost, and the timer's closed contact drops the compressor after 90 s. That is right; sent back, the model is told to take nc off and the timer would run while the oil pressure is good" });
pass("R-ref-14", "Refrigeration compressor with a low oil pressure safety timer",
  SS.concat(['pressure PS3 TR1 nc "low oil pressure safety"', 'timer TR1 "120 s"', 'coil M1 TR1 off "compressor"']), { nc: { PS3: true }, why: "as R-ref-13" });
pass("R-ref-15", "Condenser fan cycling on head pressure, on at 250 off at 200",
  ['pressure PS2 M2 "fan cycling, cut-in 250 cut-out 200"', 'coil M2 "condenser fan"'], { nc: { PS2: false } });
pass("R-ref-16", "Head pressure fan control", ['pressure PS2 M2 "high pressure fan control"', 'coil M2 "condenser fan"'], { nc: { PS2: false } });

// ---------------------------------------------------------------- well, booster, jet and vacuum pumps
pass("R-pump-01", "Well pump with a pressure switch", ['pressure PS1 M1 nc "pressure switch 30/50"', 'coil M1 "well pump"'], { nc: { PS1: true } });
pass("R-pump-02", "Well pump with a pressure switch", ['pressure PS1 M1 nc "cut-in 30 cut-out 50"', 'coil M1 "well pump"'], { nc: { PS1: true } });
pass("R-pump-03", "Well pump with a pressure switch", ['pressure PS1 M1 nc "cut-out 50 psi"', 'coil M1 "well pump"'], { nc: { PS1: true } });
pass("R-pump-04", "Well pump with a pressure switch and a low pressure cut-off", ['pressure PS1 M1 nc "pressure switch"', 'pressure PS2 M1 "low pressure cut-off"', 'coil M1 "well pump"'], { nc: { PS1: true, PS2: false } });
pass("R-pump-05", "Well pump with a pressure switch and a dry well cut-off",
  ['pressure PS1 M1 nc "cut-out 50"', 'pressure PS2 M1 "dry well cut-off"', 'coil M1 "well pump"'], { nc: { PS1: true, PS2: false }, why: "a dry well cut-off is a LOW pressure cut-off (it stops the pump when the pressure is lost): written without nc, it opens as the pressure falls. Lantern reads any well pump's cut-out as the high one" });
pass("R-pump-06", "Booster pump control",
  ['pressure PS1 M1 nc "discharge cut-out 80 psi"', 'pressure PS2 M1 "suction cut-out"', 'coil M1 "booster pump"'], { nc: { PS1: true, PS2: false }, why: "a booster's suction cut-out stops it on low suction pressure: closed while there is suction pressure, written without nc. Lantern reads it as a high cut-out because the question says booster pump" });
pass("R-pump-07", "Booster pump control", ['pressure PS2 M1 "low suction pressure cut-out"', 'pressure PS1 M1 nc "high discharge pressure cut-out"', 'coil M1 "booster pump"'], { nc: { PS1: true, PS2: false } });
pass("R-pump-08", "Vacuum pump control", ['pressure PS1 M1 nc "high vacuum cut-out"', 'coil M1 "vacuum pump"'], { nc: { PS1: true } });
pass("R-pump-09", "Vacuum pump control", ['pressure PS1 M1 "vacuum switch cut-out"', 'coil M1 "vacuum pump"'], { nc: { PS1: false }, why: "which way a vacuum switch cuts out is not sure: left as written" });
pass("R-pump-10", "Shallow well jet pump", ['pressure PS1 M1 nc "cut-out 40"', 'coil M1 "jet pump"'], { nc: { PS1: true } });
pass("R-pump-11", "Well pump with a pump protection cut-out",
  ['pressure PS1 M1 nc "cut-out 50"', 'pressure PS2 M1 "pump protection cut-out"', 'coil M1 "well pump"'], { nc: { PS2: false }, harm: "medium", why: "a well pump's protection cut-out (a pump saver) stops it on LOW pressure; which way it cuts out is not sure from its name, so it should be left as written" });
pass("R-pump-12", "Well pump with a loss of prime cut-out", ['pressure PS1 M1 nc "cut-out 50"', 'pressure PS2 M1 "loss of prime cut-out"', 'coil M1 "well pump"'], { nc: { PS1: true, PS2: false } });
pass("R-pump-13", "Booster pump from a break tank", ['float FS1 M1 "low level cut-off"', 'pressure PS1 M1 nc "cut-out 70 psi"', 'coil M1 "booster pump"'], { nc: { FS1: false, PS1: true } });
pass("R-pump-14", "Well pump filling a storage tank", ['float FS1 M1 nc "high level cut-off"', 'pressure PS2 M1 "low pressure cut-off"', 'coil M1 "well pump"'], { nc: { FS1: true, PS2: false } });

// ---------------------------------------------------------------- air compressors and unloaders
pass("R-air-01", "Air compressor control", ['pressure PS1 M1 nc "cut-out 125 psi"', 'coil M1 "compressor motor"'], { nc: { PS1: true }, kept: ["PS1 opens as the pressure rises"] });
pass("R-air-02", "Air compressor control", ['pressure PS1 M1 nc "cut-in 95 cut-out 125"', 'coil M1 "compressor motor"'], { nc: { PS1: true } });
pass("R-air-03", "Air compressor with an unloader solenoid that dumps the head when the pressure reaches cut-out",
  ['pressure PS1 M1 nc "cut-in 95 cut-out 125"', 'coil M1 "compressor motor"', 'pressure PS2 SOL1 "unloads at cut-out"', 'solenoid SOL1 "unloader"'], { nc: { PS1: true, PS2: false }, why: "the unloader's switch energises the unloader as the pressure reaches cut-out: it closes on rise, written without nc. It is not the motor's cut-out" });
pass("R-air-04", "Air compressor control",
  ['pressure PS1 M1 nc "cut-out, restart after 3 min"', 'coil M1 "compressor motor"'], { nc: { PS1: true }, why: "a compressor's cut-out written nc is right; min here is minutes, not minimum. Lantern reads it as a LOW cut-out and tells the model to take the nc off" });
pass("R-air-05", "Two air compressors, lead and lag", ['pressure PS1 M1 nc "lead cut-out 120"', 'pressure PS2 M2 nc "lag cut-in 100 cut-out 115"', 'coil M1 "compressor 1"', 'coil M2 "compressor 2"'], { nc: { PS1: true, PS2: true } });
pass("R-air-06", "Air compressor control with an oil pressure cut-out",
  ['pressure PS1 M1 nc "cut-out 125"', 'pressure PS2 M1 "oil pressure cut-out"', 'coil M1 "compressor motor"'], { nc: { PS1: true, PS2: false }, why: "an oil pressure cut-out stops the compressor when the OIL pressure is low: closed while there is oil pressure (no nc). Lantern reads every cut-out on an air compressor as its high one" });
pass("R-air-07", "Air compressor control", ['pressure PS1 M1 nc "cut-out 125"', 'temp TS1 M1 nc "high discharge temperature cut-out"', 'coil M1 "compressor motor"'], { nc: { PS1: true, TS1: true } });
pass("R-air-08", "Air compressor with an unloader", ['pressure PS1 M1 nc "cut-out 125"', 'coil M1 "compressor motor"', 'pressure PS2 SOL1 "high pressure unload"', 'solenoid SOL1 "unloader"'], { nc: { PS2: false } });
pass("R-air-09", "Shop compressor control", ['pressure PS1 M1 nc "cut-out"', 'coil M1 "compressor motor"'], { nc: { PS1: true } });

// ---------------------------------------------------------------- fill and sump floats
pass("R-fill-01", "Pump to fill a tank", ['float FS1 M1 nc "high level cut-off"', 'coil M1 "fill pump"'], { nc: { FS1: true } });
pass("R-fill-02", "Pump to fill a tank", ['float FS1 M1 nc "low level start"', 'float FS2 M1 nc "high level stop"', 'coil M1 "fill pump"'], { nc: { FS1: true, FS2: true } });
pass("R-fill-03", "Pump to fill a tank", ['float FS1 M1 nc "max level cut-off"', 'coil M1 "fill pump"'], { nc: { FS1: true } });
pass("R-fill-04", "Fill valve for a tank", ['float FS1 SOL1 nc "high level cut-off"', 'solenoid SOL1 "fill valve"'], { nc: { FS1: true } });
pass("R-fill-05", "Pump to fill a tank", ['float FS1 M1 nc "overfill cut-off"', 'coil M1 "fill pump"'], { nc: { FS1: true } });
pass("R-fill-06", "Transfer pump that fills a tank from a cistern", ['float FS1 M1 "dry run protection"', 'float FS2 M1 nc "high level cut-off"', 'coil M1 "transfer pump"'], { nc: { FS1: false, FS2: true } });
pass("R-fill-07", "Open a dump valve when the tank overfills",
  ['float FS1 SOL1 "overfill"', 'solenoid SOL1 "dump valve"'], { nc: { FS1: false }, why: "a dump valve opened as the level rises past the overfill float: closes on rise, no nc" });
pass("R-sump-01", "Sump pump", ['float FS1 M1 "high level"', 'float FS2 M1 "low level cut-out"', 'coil M1 "sump pump"'], { nc: { FS1: false, FS2: false } });
pass("R-sump-02", "Sump pump", ['float FS1 M1 "pump on"', 'float FS2 M1 "pump off"', 'coil M1 "sump pump"'], { nc: { FS1: false, FS2: false } });
pass("R-sump-03", "Sump pump", ['float FS1 M1', 'coil M1 "sump pump"'], { nc: { FS1: false } });
pass("R-sump-04", "Sump pump with a high level safety float that starts it",
  ['float FS2 M1 "low level cut-out"', 'float FS1 M1 "high level safety"', 'coil M1 "sump pump"'], { nc: { FS1: false, FS2: false }, harm: "medium", why: "in a sump the high float STARTS the pump (closes on rise); the question says so. Lantern reads safety as a cut word and sends it back to be written nc" });
pass("R-sump-05", "Sump pump", ['float FS1 M1 "low level cut-off"', 'float FS2 M1 "high level start"', 'coil M1 "sump pump"'], { nc: { FS1: false, FS2: false } });
pass("R-sump-06", "Sump low level alarm relay", ['float FS1 CR1 nc "low level alarm"', 'coil CR1 "alarm relay"', 'horn AH1 CR1'], { nc: { FS1: true } });
pass("R-sump-07", "Sump pump with dry run protection", ['float FS1 M1 "dry run cut-out"', 'float FS2 M1 "start"', 'coil M1 "sump pump"'], { nc: { FS1: false, FS2: false } });
pass("R-sump-08", "Sewage ejector pump with a high level alarm",
  ['float FS1 M1 "off"', 'float FS2 M1 "on"', 'coil M1 "ejector pump"', 'float FS3 CR1 "high level alarm"', 'coil CR1 "alarm relay"', 'horn AH1 CR1'], { nc: { FS3: false } });

// ---------------------------------------------------------------- duplex lift stations (Lantern wires the floats)
pass("R-dup-01", "Draw the control circuit for a duplex lift station",
  ['supply "120 V AC"', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red']);
pass("R-dup-02", "Draw the control circuit for a duplex lift station",
  ['float FS1 nc "low level cut-off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']);
pass("R-dup-03", "Draw the control circuit for a duplex lift station",
  ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level trip"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']);
pass("R-dup-04", "Two sump pumps, each on its own floats",
  ['float FS1 M1 "pump 1 on"', 'float FS2 M1 "pump 1 off"', 'float FS3 M2 "pump 2 on"', 'float FS4 M2 "pump 2 off"', 'coil M1 "pump 1"', 'coil M2 "pump 2"'], { nc: { FS1: false, FS2: false, FS3: false, FS4: false } });
pass("R-dup-05", "Draw the control circuit for a duplex sewage lift station with an overflow alarm",
  ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "overflow alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']);

// ---------------------------------------------------------------- stops, e-stops, stop buttons written several ways
var M = ['coil M1 "motor starter"'];
pass("R-stop-01", "Motor starter with two stop stations", ['stop PB1 M1', 'stop PB3 M1', 'start PB2 M1'].concat(M), { nc: { PB1: true, PB3: true }, kept: ["the stops normally closed"] });
pass("R-stop-02", "Motor starter", ['button PB1 M1 nc "stop"', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-03", "Motor starter", ['button PB1 M1 "stop" nc', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-04", "Motor starter", ['button PB1 M1 normally closed "stop"', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-05", "Motor starter", ['button PB1 M1 N.C. "stop"', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-06", "Motor starter", ['button PB1 M1 "stop" N.C.', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-07", "Motor starter", ['stop button PB1 M1', 'start button PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-08", "Motor starter with an emergency stop", ['emergency stop ES1', 'stop PB1 M1', 'start PB2 M1'].concat(M), { nc: { ES1: true }, kept: ["the emergency stop ES1 ahead of every rung"] });
pass("R-stop-09", "Motor starter with an e-stop", ['e-stop ES1', 'stop PB1 M1', 'start PB2 M1'].concat(M), { nc: { ES1: true } });
pass("R-stop-10", "Motor starter with an e-stop", ['estop ES1 M1', 'stop PB1 M1', 'start PB2 M1'].concat(M), { nc: { ES1: true } });
pass("R-stop-11", "Motor starter", ['button PB1 M1 "Stop" closed', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-12", "Motor starter", ['pushbutton PB1 M1 nc "STOP"', 'pushbutton PB2 M1 "START"'].concat(M), { nc: { PB1: true } });
pass("R-stop-13", "Motor starter with two start/stop stations", ['stop PB1 M1', 'stop PB3 M1', 'start PB2 M1', 'start PB4 M1'].concat(M), { nc: { PB1: true, PB3: true } });
pass("R-stop-14", "Motor starter with a stop relay", ['button PB1 CR1 "stop"', 'coil CR1 "stop relay"', 'coil M1 CR1 off "motor"', 'start PB2 M1'], { why: "a stop button that pulls in a stop relay is a normally open button, and no start is on CR1" });
pass("R-stop-15", "Motor starter", ['button PB1 M1 "stop" n.c.', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-16", "Motor starter", ['stop PB1', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-17", "Two motors with one stop for both", ['stop PB1 all', 'start PB2 M1', 'start PB3 M2', 'coil M1 "motor 1"', 'coil M2 "motor 2"'], { nc: { PB1: true } });
pass("R-stop-18", "Motor starter", ['push button PB1 M1 nc "stop"', 'push button PB2 M1 "start"'].concat(M), { nc: { PB1: true } });
pass("R-stop-19", "Motor starter", ['switch SS1 M1 "on/off"'].concat(M), {});
pass("R-stop-20", "Motor starter", ['button PB1 M1 "stop" normally-closed', 'start PB2 M1'].concat(M), { nc: { PB1: true } });
pass("R-stop-21", "Motor starter with an emergency stop button", ['emergency stop button ES1', 'stop PB1 M1', 'start PB2 M1'].concat(M), { nc: { ES1: true } });
pass("R-stop-22", "Motor starter with a local and a remote stop", ['stop PB1 M1 "stop"', 'stop PB3 M1 "remote stop"', 'start PB2 M1'].concat(M), { nc: { PB1: true, PB3: true } });
pass("R-stop-23", "Motor starter", ['button PB1 M1 "stop/reset" nc', 'start PB2 M1'].concat(M), { nc: { PB1: true } });

// ---------------------------------------------------------------- interlocks kept
pass("R-il-01", "Forward and reverse motor starter", ['stop PB1', 'start PB2 M1', 'start PB3 M2', 'coil M1 "forward"', 'coil M2 "reverse"'], { kept: ["M1 and M2 locked out of each other"] });
pass("R-il-02", "Two pumps that must never run together", ['stop PB1', 'start PB2 M1', 'start PB3 M2', 'coil M1 "pump 1"', 'coil M2 "pump 2"', 'interlock M1 M2'], { kept: ["locked out of each other"] });

// ---------------------------------------------------------------- wrong circuits the checks should send back
back("W-hp-01", "Refrigeration compressor control", ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], line: 'pressure PS1 M1 nc "high pressure cut-out"', practice: "US", fixNc: { PS1: true } });
back("W-hl-02", "Boiler burner control", ['temp TS1 M1 "high limit"', 'coil M1 "burner"'], { dev: ["TS1"], line: 'temp TS1 M1 nc "high limit"', fixNc: { TS1: true } });
back("W-lwco-03", "Boiler low water cut-off", ['float FS1 M1 nc "low water cut-off"', 'coil M1 "burner"'], { dev: ["FS1"], line: 'float FS1 M1 "low water cut-off"', fixNc: { FS1: false } });
back("W-fz-04", "Air handler freeze stat", ['temp TS1 M1 nc "freeze stat"', 'coil M1 "supply fan"'], { dev: ["TS1"], line: 'temp TS1 M1 "freeze stat"', fixNc: { TS1: false } });
back("W-fill-05", "Pump to fill a tank", ['float FS1 M1 "high level cut-off"', 'coil M1 "fill pump"'], { dev: ["FS1"], line: 'float FS1 M1 nc "high level cut-off"', fixNc: { FS1: true } });
back("W-air-06", "Air compressor control", ['pressure PS1 M1 "cut-out 125 psi"', 'coil M1 "compressor motor"'], { dev: ["PS1"], line: 'pressure PS1 M1 nc "cut-out 125 psi"', fixNc: { PS1: true } });
back("W-air-07", "Air compressor control", ['pressure PS1 M1 "cut-in 95 cut-out 125"', 'coil M1 "compressor motor"'], { dev: ["PS1"], fixNc: { PS1: true } });
back("W-well-08", "Well pump with a pressure switch", ['pressure PS1 M1 "cut-out 50 psi"', 'coil M1 "well pump"'], { dev: ["PS1"], fixNc: { PS1: true } });
back("W-stop-09", "Motor starter", ['button PB1 M1 "stop"', 'start PB2 M1'].concat(M), { dev: ["PB1"], line: "stop PB1 M1", fixNc: { PB1: true } });
back("W-stop-10", "Motor starter", ['button PB1 M1 "Stop button"', 'start PB2 M1'].concat(M), { dev: ["PB1"], line: 'stop PB1 M1 "Stop button"', fixNc: { PB1: true } });
back("W-stop-11", "Motor starter with an emergency stop", ['button PB1 M1 "emergency stop"', 'start PB2 M1'].concat(M), { dev: ["PB1"], line: "estop PB1", fixNc: { PB1: true }, harm: "medium",
  why: "an emergency stop handed back as an ordinary stop on M1 (stop PB1 M1 \"emergency stop\") is drawn as a stop of M1's rung only; Lantern's own line for one is estop PB1, drawn in L1 ahead of every rung (IEC 60204-1 10.7 / NFPA 79 10.7: an emergency stop stops the machine)" });
back("W-curly-12", "Refrigeration compressor control", ['pressure PS1 M1 “high pressure cut-out”', 'coil M1 "compressor contactor"'], { dev: ["PS1"], fixNc: { PS1: true } });
back("W-order-13", "Refrigeration compressor control", ['pressure "high limit" PS1 M1', 'coil M1 "compressor contactor"'], { dev: ["PS1"], fixNc: { PS1: true } });
back("W-list-14", "Refrigeration compressor control", ['1. pressure PS1 M1 "high pressure cut-out"', '2. coil M1 "compressor contactor"'], { dev: ["PS1"], line: 'pressure PS1 M1 nc "high pressure cut-out"', fixNc: { PS1: true } });
back("W-no-15", "Refrigeration compressor control", ['pressure PS1 M1 no "high limit"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], line: 'pressure PS1 M1 nc "high limit"', fixNc: { PS1: true } });
back("W-normopen-16", "Refrigeration compressor control", ['pressure PS1 M1 normally open "high limit"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], line: 'pressure PS1 M1 nc "high limit"', fixNc: { PS1: true } });
back("W-NO-17", "Refrigeration compressor control", ['pressure PS1 M1 N.O. "high limit"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], line: 'pressure PS1 M1 nc "high limit"', fixNc: { PS1: true } });
back("W-nc-18", "Boiler low water cut-off", ['float FS1 M1 normally closed "low water cut-off"', 'coil M1 "burner"'], { dev: ["FS1"], line: 'float FS1 M1 "low water cut-off"', fixNc: { FS1: false } });
back("W-NC-19", "Boiler low water cut-off", ['float FS1 M1 N.C. "low water cut-off"', 'coil M1 "burner"'], { dev: ["FS1"], line: 'float FS1 M1 "low water cut-off"', fixNc: { FS1: false } });
back("W-ncafter-20", "Boiler low water cut-off", ['float FS1 M1 "low water cut-off" nc', 'coil M1 "burner"'], { dev: ["FS1"], line: 'float FS1 M1 "low water cut-off"', fixNc: { FS1: false } });
back("W-noafter-21", "Refrigeration compressor control", ['pressure PS1 M1 "high pressure cut-out" no', 'coil M1 "compressor contactor"'], { dev: ["PS1"], fixNc: { PS1: true } });
pass("W-coilnc-22", "Refrigeration compressor control",
  SS.concat(['pressure PS1 "high pressure cut-out"', 'coil M1 PS1 nc "compressor contactor"']), { nc: { PS1: true }, why: "the coil's line names PS1's contact nc (the HINT's own form: coil CR3 M1 off), so PS1 is DRAWN normally closed and opens on rise: right. The check reads only PS1's own line and sends it back; the line it hands over (pressure PS1 nc ...) with the coil's nc would draw it OPEN" });
back("W-coilno-23", "Refrigeration compressor control", SS.concat(['pressure PS1 "high pressure cut-out"', 'coil M1 PS1 "compressor contactor"']), { dev: ["PS1"], fixNc: { PS1: true } });
pass("W-coiloff-24", "Boiler burner control",
  SS.concat(['temp TS1 "high limit"', 'coil M1 TS1 off "burner"']), { nc: { TS1: true }, why: "as W-coilnc-22, with off: TS1 is drawn nc (opens on rise), right, and sent back" });
back("W-merge-25", "Refrigeration compressor control", ['pressure PS1 M1', 'pressure PS1 nc "high limit"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], fixNc: { PS1: true }, harm: "medium",
  why: "PS1 is drawn as its first line wrote it, normally open (the second line's nc is not carried), labelled high limit: a high cut-out drawn open. The check reads the second line, finds nc, and lists PS1 as kept: \"PS1 opens as the pressure rises\" under a drawing where it closes on rise" });
back("W-estop-26", "Motor starter with an e-stop", ['button ES1 M1 "e-stop"', 'start PB2 M1'].concat(M), { dev: ["ES1"], line: "estop ES1", fixNc: { ES1: true }, harm: "medium", why: "as W-stop-11" });
back("W-stop2-27", "Two motor starters with one stop button", ['button PB1 M1 M2 "stop"', 'start PB2 M1', 'start PB3 M2', 'coil M1 "motor 1"', 'coil M2 "motor 2"'], { dev: ["PB1"], line: "stop PB1 M1 M2", fixNc: { PB1: true } });
back("W-lp-28", "Refrigeration compressor control", ['pressure PS2 M1 nc "low pressure cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS2"], line: 'pressure PS2 M1 "low pressure cut-out"', fixNc: { PS2: false } });
back("W-lppair-29", "Refrigeration compressor low pressure control", ['pressure PS2 M1 nc "cut-in 40 cut-out 20"', 'coil M1 "compressor contactor"'], { dev: ["PS2"], fixNc: { PS2: false } });
back("W-heatpair-30", "Heating thermostat, on at 60 off at 70", ['temp TS1 M1 "cut-in 60 cut-out 70"', 'coil M1 "heater"'], { dev: ["TS1"], fixNc: { TS1: true } });
back("W-overtemp-31", "Oven heater with an over-temperature cut-out", ['temp TS1 M1 "over-temperature cut-out"', 'coil M1 "oven heater"'], { dev: ["TS1"], fixNc: { TS1: true } });
back("W-overfill-32", "Pump to fill a tank", ['float FS1 M1 "overfill protection"', 'coil M1 "fill pump"'], { dev: ["FS1"], fixNc: { FS1: true } });
back("W-relay-34", "Refrigeration compressor control on a run relay", ['pressure PS1 CR1 "high pressure cut-out"', 'coil CR1 "run relay"', 'coil M1 CR1 "compressor contactor"'], { dev: ["PS1"], fixNc: { PS1: true } });
back("W-two-36", "Refrigeration compressor control", ['pressure PS1 M1 "high pressure cut-out"', 'pressure PS2 M1 nc "low pressure cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS1", "PS2"], fixNc: { PS1: true, PS2: false } });
back("W-stop3-37", "Motor starter with a local and a remote stop", ['stop PB1 M1', 'button PB3 M1 "stop"', 'start PB2 M1'].concat(M), { dev: ["PB3"], line: "stop PB3 M1", fixNc: { PB3: true } });
back("W-offon-38", "Motor starter", ['button PB1 M1 "off"', 'button PB2 M1 "on"'].concat(M), { dev: ["PB1"], line: 'stop PB1 M1 "off"', fixNc: { PB1: true } });
back("W-iec-39", "Control circuit for a 400 V refrigeration compressor", ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], practice: "IEC", fixNc: { PS1: true } });
back("W-us-40", "Control circuit for a 480 V refrigeration compressor", ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], practice: "US", fixNc: { PS1: true } });
back("W-saved-41", "Refrigeration compressor control", ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], practice: "IEC", saved: "IEC", fixNc: { PS1: true } });
back("W-saved-42", "Refrigeration compressor control, 60 Hz", ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], practice: "US", saved: "IEC", fixNc: { PS1: true } });
back("W-hilimit-43", "Boiler burner control", ['temp TS1 M1 "hi-limit"', 'coil M1 "burner"'], { dev: ["TS1"], fixNc: { TS1: true } });
back("W-hyph-44", "Refrigeration compressor control", ['pressure PS1 M1 "high-pressure cutout"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], fixNc: { PS1: true } });
back("W-maxtrip-45", "Pump to fill a tank", ['float FS1 M1 "max level trip"', 'coil M1 "fill pump"'], { dev: ["FS1"], fixNc: { FS1: true } });
back("W-safety-46", "Air compressor control", ['pressure PS1 M1 "high pressure safety"', 'coil M1 "compressor motor"'], { dev: ["PS1"], fixNc: { PS1: true } });
back("W-lowlimit-47", "Air handler low limit", ['temp TS1 M1 nc "low limit"', 'coil M1 "supply fan"'], { dev: ["TS1"], fixNc: { TS1: false } });
back("W-dryrun-48", "Transfer pump with dry run protection", ['float FS1 M1 nc "dry run protection"', 'coil M1 "transfer pump"'], { dev: ["FS1"], fixNc: { FS1: false } });
back("W-sol-49", "Fill valve for a tank", ['float FS1 SOL1 "high level cut-off"', 'solenoid SOL1 "fill valve"'], { dev: ["FS1"], fixNc: { FS1: true } });
back("W-tag-50", "Pump to fill a tank", ['float LSHH M1 "high high level cut-off"', 'coil M1 "fill pump"'], { dev: ["LSHH"], fixNc: { LSHH: true } });
back("W-ncoff-51", "Boiler burner control", ['temp TS1 M1 off "high limit"', 'coil M1 "burner"'], { dev: ["TS1"], fixNc: { TS1: true } });
back("W-saveddown-52", "Boiler low water cut-off in a 400 V plant room", ['float FS1 M1 nc "low water cut-off"', 'coil M1 "burner"'], { dev: ["FS1"], practice: "IEC", saved: "US", fixNc: { FS1: false } });

back("W-coilnc-22b", "Refrigeration compressor control", SS.concat(['pressure PS1 "high pressure cut-out"', 'coil M1 PS1 nc "compressor contactor"']), { dev: ["PS1"], fixNc: { PS1: true }, harm: "high",
  why: "W-coilnc-22 (a right circuit) is sent back; this case takes the back as given and copies the line handed over, as a small model does: the coil's nc then turns PS1 over, and the circuit is drawn with the high cut-out OPEN and listed as kept" });

// ---------------------------------------------------------------- more right circuits: other trades' switches
pass("R-heat-18", "Steam boiler with an operating pressure control and a high limit", ['pressure PS1 M1 nc "operating pressure control"', 'pressure PS2 M1 nc "high limit pressure"', 'coil M1 "burner"'], { nc: { PS1: true, PS2: true } });
pass("R-heat-19", "Boiler aquastat with a high limit and a low limit that keeps the water warm",
  ['temp TS1 M1 nc "high limit"', 'temp TS2 CR1 nc "low limit"', 'coil CR1 "low limit call"', 'coil M1 CR1 "burner"'], { nc: { TS1: true, TS2: true }, why: "a boiler's low limit (as on a triple-action aquastat) fires the burner as the water COOLS below it: it opens on rise, nc. An air handler's low limit is the opposite (a freeze stat); the name alone does not say which, so by rule 7 it should be left as written" });
pass("R-gas-01", "Gas valve with a low gas pressure switch", ['pressure PS1 SOL1 "low gas pressure cut-off"', 'solenoid SOL1 "gas valve"'], { nc: { PS1: false } });
pass("R-gas-02", "Gas valve with a high gas pressure switch", ['pressure PS2 SOL1 nc "high gas pressure cut-off"', 'solenoid SOL1 "gas valve"'], { nc: { PS2: true } });
pass("R-gas-03", "Burner with a combustion air proving switch", ['pressure PS3 SOL1 "air proving"', 'solenoid SOL1 "gas valve"'], { nc: { PS3: false } });
pass("R-sol-01", "Dump solenoid that opens on over pressure",
  ['pressure PS1 SOL1 "over pressure relief"', 'solenoid SOL1 "relief valve"'], { nc: { PS1: false }, why: "a relief solenoid opened as the pressure rises past the switch: closes on rise, no nc" });
pass("R-fan-11", "Wire a cooling fan thermostat", ['temp TS1 M1 "high temperature cut-in"', 'coil M1 "cooling fan"'], { nc: { TS1: false } });
pass("R-fill-08", "Pump to fill a tank", ['float FS1 M1 nc "upper limit"', 'coil M1 "fill pump"'], { nc: { FS1: true } });

// ---------------------------------------------------------------- misses: wrong circuits not caught
back("M-hp-01", "Refrigeration compressor control", ['pressure PS1 M1 "HP cut-out"', 'coil M1 "compressor contactor"'], { dev: ["PS1"], fixNc: { PS1: true }, harm: "low", why: "HP cut-out is the refrigeration trade's high pressure cut-out; written open it runs the compressor only above it. A miss (rule 7 lets it be), low" });
back("M-stop-02", "Motor starter", ['button PB1 M1 stop', 'start PB2 M1'].concat(M), { dev: ["PB1"], fixNc: { PB1: true }, harm: "medium", why: "a stop button written with its name unquoted is drawn as a second start, as in 1.24.35; the check reads only a quoted label" });
back("M-start-03", "Motor starter", ['start PB1 M1 "stop"', 'start PB2 M1'].concat(M), { dev: ["PB1"], fixNc: { PB1: true }, harm: "low", why: "a start button named stop: drawn as a start" });
back("M-dblnc-04", "Refrigeration compressor control", SS.concat(['pressure PS1 nc "high pressure cut-out"', 'coil M1 PS1 nc "compressor contactor"']), { dev: ["PS1"], fixNc: { PS1: true }, harm: "medium",
  why: "nc on both lines: drawn OPEN (the coil's nc turns PS1's own over), a high cut-out closing on rise; the check reads PS1's own nc and lists it as kept (\"PS1 opens as the pressure rises\")" });

module.exports = C;
