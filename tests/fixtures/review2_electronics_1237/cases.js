// cases.js -- the second review of 1.24.37's AI_ELECTRONICS mends (36965b4 against afea882 and 22b1c03).
// Written by a reviewer who had not seen the mends drafted, nor the first review's cases.
// Each case: { id, q (the question as a person asks it), reply (as a model writes it), want, harm, why }
//   want "keep"            -- a right reply that drew on 22b1c03: it must draw the same (before_22b1c03.json)
//   want { draw: [..], not: [..] }  -- it must draw, its signature holding each "draw" string and no "not" string
//   want { ask: [..], not: [..] }   -- it must be questioned, the problems holding each "ask" regex and no "not" regex
//   harm -- what a disagreement is: high, medium or low (see findings.txt)
// The signature (replay.js sig()) is each branch as: kind load(kind) pin= q= sw= r= rb= d= pull=, then | v=.
"use strict";
function M(title) { return "MAKE ELECTRONICS: " + title + "\n" + Array.prototype.slice.call(arguments, 1).join("\n") + "\nEND"; }

// the questions, as people ask them
var QR1 = "Draw a circuit in which an Arduino output pin switches a 12 V relay coil through an NPN transistor.";   // bench
var QR2 = "How do I wire a 5V relay to an Arduino with a transistor? Show me the circuit.";
var QR3 = "draw me a relay driver for an ESP32 GPIO pin";
var QR4 = "Sketch a Raspberry Pi GPIO pin driving a 12 V relay through a 2N2222 transistor, with the flyback diode.";
var QR5 = "Draw a circuit where an Arduino switches two 12 V relays through NPN transistors.";
var QR6 = "Draw a circuit where pressing a push button makes an Arduino turn on a 12 V relay through an NPN transistor.";
var QM1 = "Draw a circuit in which an Arduino output pin switches a 12 V DC motor through an NPN transistor.";   // bench set B
var QM2 = "How do I run a 6 V DC motor from an Arduino pin with a transistor? Draw it.";
var QM3 = "draw a circuit for a 12V computer fan controlled by an arduino through a TIP120";
var QM4 = "Show an ESP32 switching a 5 V fan with an NPN transistor.";
var QM5 = "Draw a circuit where an Arduino runs two 12 V DC motors through NPN transistors.";
var QL1 = "Draw a circuit where an Arduino pin turns on a 12 V lamp through a transistor.";
var QL2 = "Wire a 6 V bulb to an Arduino through an NPN transistor - draw the circuit";
var QY1 = "Draw a circuit where an Arduino switches a 12 V solenoid valve through an NPN transistor.";
var QY2 = "How do I drive a door lock solenoid from an Arduino with a transistor? show the circuit";
var QB1 = "Draw an Arduino circuit that sounds a buzzer through an NPN transistor.";
var QB2 = "draw a circuit for a 12 V buzzer switched by an Arduino pin with a transistor";
var QD1 = "Draw a circuit where an Arduino pin lights an LED.";
var QD2 = "Draw an Arduino circuit that lights a 12 V LED strip through an NPN transistor.";
var QD3 = "Draw a circuit with a push button on pin 2 and an LED on pin 13 of an Arduino.";
var QD4 = "Draw an Arduino circuit with an LDR on A0 and an LED that comes on when it gets dark.";
var QD5 = "Draw an Arduino circuit with two LEDs, one on pin 12 and one on pin 13.";
var QD6 = "Draw an Arduino circuit that lights an LED through a transistor.";
var QX1 = "Draw a circuit in which an Arduino switches a 12 V relay through an NPN transistor, with an LED that shows when the relay is on.";
var QX2 = "Draw a circuit where an Arduino drives a 12 V motor through a transistor and has a buzzer for alarms.";
var QX3 = "Draw a circuit for an Arduino with a button, an LED and a buzzer.";
var QX4 = "Draw a circuit where an Arduino pin switches a 12 V motor through an NPN transistor, and an LED shows when it runs.";
var QX5 = "Draw a circuit where an Arduino switches a 12 V LED lamp through an NPN transistor.";
var QN1 = "Draw a circuit for a push button read by an Arduino pin with a pull-down resistor.";
var QN2 = "Draw a potentiometer wired to an Arduino analog pin.";
var QN3 = "Draw a light sensor (LDR) read by an ESP32.";
var QN4 = "Draw a thermistor read by an Arduino analog input.";
var QS1 = "Draw an Arduino circuit that switches a 12 V cooling fan for my stepper motor driver through an NPN transistor.";
var QS2 = "Draw an Arduino circuit that switches a 230 V AC motor through a relay and an NPN transistor.";
var QS3 = "Draw a circuit where an Arduino turns on a 5 V relay through a transistor to cut the power to my servos.";
var QT1 = "Draw a circuit with a 12 V fan that always runs and a second fan switched by an Arduino pin through an NPN transistor.";
var QT2 = "Draw an Arduino circuit with a power LED that is always on and a second LED switched through an NPN transistor.";
var QT3 = "Draw a circuit with a pilot lamp that is always lit and a 12 V lamp switched by an Arduino pin through a transistor.";
var QT4 = "Draw a circuit where an Arduino pin switches a 12 V relay through an NPN transistor, and a second relay is worked by a toggle switch.";
var QT5 = "Draw a circuit where a pump motor runs from a float switch and a fan motor is switched by an Arduino pin through a transistor.";
var QT6 = "Draw a circuit with two solenoid valves: one always energised and one switched by an Arduino pin through an NPN transistor.";
var QT7 = "Draw an Arduino circuit where one pin lights a small LED directly and a bright LED through a transistor.";
var QP1 = "Draw a circuit where a push button switches a 12 V lamp through an NPN transistor.";
var QP2 = "Draw a circuit where an LDR read by an Arduino turns on a lamp through a transistor at night.";
var QP3 = "Draw an Arduino circuit with a thermistor that switches a fan on through a transistor when it gets hot.";

var C = [];
function k(id, q, reply, why) { C.push({ id: id, q: q, reply: reply, want: "keep", harm: "high", why: why || "a right reply that drew on 22b1c03" }); }
function d(id, q, reply, draw, not, harm, why) { C.push({ id: id, q: q, reply: reply, want: { draw: draw, not: not || [] }, harm: harm, why: why }); }
function a(id, q, reply, ask, not, harm, why) { C.push({ id: id, q: q, reply: reply, want: { ask: ask, not: not || [] }, harm: harm, why: why }); }

// ---- 1. right replies that drew on 22b1c03 and must draw the same ---------------------------------------------------
// relays
k("keep-r01", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1"));
k("keep-r02", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "diode D1 K1"));
k("keep-r03", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\" P1"));
k("keep-r04", QR1, M("Arduino relay switch", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "transistor Q1 K1 P1", "relay K1 \"12 V coil\"", "note Q1 switches the relay coil to ground"));
k("keep-r05", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\" Q1", "transistor Q1 K1 P1"));
k("keep-r06", QR2, M("5V relay", "supply \"5 V\"", "pin P1 \"Arduino D8\"", "relay K1 \"5 V relay\"", "transistor Q1 K1 P1", "note D8 HIGH turns the relay on"));
k("keep-r07", QR3, M("ESP32 relay driver", "supply \"5 V\"", "pin P1 \"ESP32 GPIO23\"", "relay K1 \"5 V coil\"", "transistor Q1 K1 P1"));
k("keep-r08", QR4, M("Pi relay", "supply \"12 V\"", "pin P1 \"Raspberry Pi GPIO17\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1 \"2N2222\"", "diode D1 K1 \"1N4007\""));
k("keep-r09", QR1, M("Relay with status LED", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D13\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "led D1 P2 green"));
k("keep-r10", QR1, M("Relay with power LED", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "led D1 red", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1"));
k("keep-r11", QR6, M("Button relay", "supply \"12 V\"", "pin P1 \"D2 input\"", "pin P2 \"D7\"", "switch S1 P1", "relay K1 \"12 V coil\"", "transistor Q1 K1 P2"));
k("keep-r12", QR5, M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\"", "relay K2 \"12 V coil\"", "transistor Q1 K1 P1", "transistor Q2 K2 P2"));
k("keep-r13", QR1, M("Battery relay", "battery B1 \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1"));
k("keep-r14", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\" P1", "transistor Q1 K1 P1"));
k("keep-r15", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1 BC547"));
k("keep-r16", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "npn Q1 K1 P1"));
k("keep-r17", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\" Q1", "transistor Q1 P1"));
k("keep-r18", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "capacitor C1 \"100 uF\""));
k("keep-r19", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "coil K1 \"12 V\"", "transistor Q1 K1 P1"));
k("keep-r20", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 BC547 K1 P1"));
k("keep-r21", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 D7"), "a pin named by the board's name on the transistor line, one pin only (22b1c03 took the only pin)");
k("keep-r22", QR1, M("Relay driver", "supply \"12V\"", "pin P1 \"D7\"", "relay RL1 \"12V coil\"", "transistor Q1 RL1 P1"));
k("keep-r23", QR1, M("Relay driver", "supply 12V", "output pin P1 \"Arduino D7\"", "relay coil K1 12V", "npn transistor Q1 K1 P1", "flyback diode D1 K1"));
k("keep-r24", QR1, "Here is the circuit:\n\n" + M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1") + "\n\nLantern adds the base resistor and the flyback diode.");
k("keep-r25", QR5, M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\" Q1", "relay K2 \"12 V coil\" Q2", "transistor Q1 P1", "transistor Q2 P2"));
k("keep-r26", QR5, M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\" P1", "relay K2 \"12 V coil\" P2"));
// motors and fans
k("keep-m01", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V DC motor\"", "transistor Q1 M1 P1"));
k("keep-m02", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V DC motor\"", "transistor Q1 M1 P1", "diode D1 M1"));
k("keep-m03", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V DC motor\" P1"));
k("keep-m04", QM1, M("Arduino Motor Driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "transistor Q1 K1 P1", "motor M1 Q1", "diode D1 M1", "note Flyback diode across motor to protect transistor"), "the 35B's own reply on set B (bench_run_1256_35b_setb.json): it drew");
k("keep-m05", QM2, M("6 V motor", "battery B1 \"6 V\"", "pin P1 \"D5\"", "motor M1 \"6 V DC motor\"", "transistor Q1 M1 P1"));
k("keep-m06", QM3, M("PC fan", "supply \"12 V\"", "pin P1 \"Arduino D3\"", "fan M1 \"12 V PC fan\"", "transistor Q1 M1 P1 \"TIP120\""));
k("keep-m07", QM4, M("ESP32 fan", "supply \"5 V\"", "pin P1 \"ESP32 GPIO18\"", "motor M1 \"5 V fan\"", "transistor Q1 M1 P1"));
k("keep-m08", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V\" Q1", "transistor Q1 P1"));
k("keep-m09", QM1, M("Motor with LED", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"Arduino D13\"", "motor M1 \"12 V DC motor\"", "transistor Q1 M1 P1", "led D1 P2"));
k("keep-m10", QM1, M("Motor with power LED", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "led D1 green", "motor M1 \"12 V DC motor\"", "transistor Q1 M1 P1"));
k("keep-m11", QM1, M("Motor with button", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"D2 input\"", "switch S1 P2", "motor M1 \"12 V DC motor\"", "transistor Q1 M1 P1"));
k("keep-m12", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "dc motor M1 \"12 V\"", "npn transistor Q1 M1 P1"));
k("keep-m13", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "transistor Q1 M1 P1", "motor M1 \"12 V DC motor\""));
k("keep-m14", QM5, M("Two motors", "supply \"12 V\"", "pin P1 \"Arduino D5\"", "pin P2 \"Arduino D6\"", "motor M1", "motor M2", "transistor Q1 M1 P1", "transistor Q2 M2 P2"));
k("keep-m15", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1", "transistor Q1 TIP120 M1 P1"));
k("keep-m16", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V\"", "transistor Q1 M1 D9"), "the board's name for the pin, one pin");
k("keep-m17", QM3, M("Fan", "supply \"12 V\"", "pin P1 \"D3\"", "fan M1 \"12 V\" P1"));
k("keep-m18", QM5, M("Two motors", "supply \"12 V\"", "pin P1 \"Arduino D5\"", "pin P2 \"Arduino D6\"", "motor M1 Q1", "motor M2 Q2", "transistor Q1 P1", "transistor Q2 P2"));
k("keep-m19", QP3, M("Thermostat fan", "supply \"12 V\"", "pin P1 \"A0\"", "thermistor TH1 P1", "pin P2 \"D9\"", "motor M1 \"fan\" Q1", "transistor Q1 P2"));
k("keep-m20", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V, 400 mA\"", "transistor Q1 M1 P1"));
// lamps
k("keep-l01", QL1, M("Lamp driver", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V 5 W\"", "transistor Q1 L1 P1"));
k("keep-l02", QL1, M("Lamp driver", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V\" P1"));
k("keep-l03", QL2, M("Bulb", "battery B1 \"6 V\"", "pin P1 \"D4\"", "lamp L1 \"6 V bulb\"", "transistor Q1 L1 P1"));
k("keep-l04", QL1, M("Lamp driver", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V\" Q1", "transistor Q1 P1"));
k("keep-l05", QL1, M("Lamp with LED", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "pin P2 \"Arduino D13\"", "lamp L1 \"12 V\"", "transistor Q1 L1 P1", "led D1 P2"));
k("keep-l06", QP2, M("Night lamp", "supply \"12 V\"", "pin P1 \"A0\"", "sensor LDR1 P1", "pin P2 \"D6\"", "lamp L1 \"12 V\"", "transistor Q1 L1 P2"));
k("keep-l07", QL2, M("Bulb", "battery B1 \"6 V\"", "pin P1 \"D4\"", "bulb L1 \"6 V\"", "transistor Q1 L1 P1"));
// solenoids
k("keep-y01", QY1, M("Valve driver", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "solenoid Y1 \"12 V valve\"", "transistor Q1 Y1 P1"));
k("keep-y02", QY1, M("Valve driver", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "solenoid Y1 \"12 V valve\"", "transistor Q1 Y1 P1", "diode D1 Y1"));
k("keep-y03", QY2, M("Door lock", "supply \"12 V\"", "pin P1 \"Arduino D4\"", "solenoid Y1 \"12 V lock\" P1"));
k("keep-y04", QY1, M("Valve driver", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "solenoid Y1 \"12 V\" Q1", "transistor Q1 P1"));
k("keep-y05", QY2, M("Door lock with button", "supply \"12 V\"", "pin P1 \"D2 input\"", "switch S1 P1", "pin P2 \"D4\"", "solenoid Y1 \"12 V lock\"", "transistor Q1 Y1 P2"));
// buzzers
k("keep-b01", QB1, M("Buzzer", "pin P1 \"Arduino D8\"", "buzzer BZ1", "transistor Q1 BZ1 P1"));
k("keep-b02", QB2, M("12 V buzzer", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "buzzer BZ1 \"12 V buzzer\"", "transistor Q1 BZ1 P1"));
k("keep-b03", QB1, M("Buzzer", "pin P1 \"Arduino D8\"", "buzzer BZ1 P1"));
k("keep-b04", QB1, M("Button buzzer", "pin P1 \"D2 input\"", "switch S1 P1", "pin P2 \"D8\"", "buzzer BZ1 P2", "transistor Q1 BZ1 P2"));
k("keep-b05", QB1, M("Buzzer", "pin P1 \"Arduino D8\"", "piezo BZ1 Q1", "transistor Q1 P1"));
// LEDs
k("keep-d01", QD1, M("LED", "pin P1 \"D13\"", "led D1 P1 red"));
k("keep-d02", QD2, M("LED strip", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "led D1 \"12 V LED strip\"", "transistor Q1 D1 P1"));
k("keep-d03", QD3, M("Button and LED", "pin P1 \"D2 input\"", "pin P2 \"D13\"", "switch S1 P1", "led D1 P2 green"));
k("keep-d04", QD4, M("Dark sensor", "pin P1 \"A0\"", "sensor LDR1 P1", "pin P2 \"D9\"", "led D1 P2"));
k("keep-d05", QD5, M("Two LEDs", "pin P1 \"D12\"", "pin P2 \"D13\"", "led D1 P1 red", "led D2 P2 green"));
k("keep-d06", QD1, M("LED", "pin P1 \"D13\"", "led D1 P1 red", "resistor R1 \"220 ohm\" D1"));
k("keep-d07", QD1, M("ESP32 LED", "pin P1 \"ESP32 GPIO2\"", "led D1 P1 blue"));
k("keep-d08", QD1, M("LED and power LED", "pin P1 \"D13\"", "led D1 P1 green", "led D2 red"));
k("keep-d09", QD6, M("LED through a transistor", "pin P1 \"Arduino D7\"", "led D1 Q1", "transistor Q1 P1"));
k("keep-d10", QD3, M("Button and LED", "pin P1 \"D2 input\"", "pin P2 \"D13\"", "switch S1 P1 pullup", "led D1 P2"));
k("keep-d11", QD6, M("LED through a transistor", "supply \"9 V\"", "pin P1 \"Arduino D7\"", "led D1 white", "transistor Q1 D1 P1"));
k("keep-d12", QD1, M("Power LED", "supply \"5 V\"", "led D1 \"power on\""));
k("keep-d13", QD5, M("Two LEDs", "pin P1 \"D12\"", "pin P2 \"D13\"", "led D1 P1", "led D2 P2", "resistor R1 \"330 ohm\" D1", "resistor R2 \"330 ohm\" D2"));
k("keep-d14", QD6, M("LED through a transistor", "pin P1 \"Arduino D7\"", "led D1 Q1 \"1 W white\"", "transistor Q1 P1", "led D2 P2 \"status\"", "pin P2 \"Arduino D13\""));
// inputs, and questions that ask for no load or for two kinds
k("keep-n01", QN1, M("Button", "pin P1 \"D2\"", "switch S1 P1"));
k("keep-n02", QN2, M("Pot", "pin P1 \"A0\"", "pot RV1 P1"));
k("keep-n03", QN3, M("ESP32 LDR", "pin P1 \"ESP32 GPIO34\"", "sensor LDR1 P1"));
k("keep-n04", QN4, M("Thermistor", "pin P1 \"A1\"", "thermistor TH1 P1"));
k("keep-n05", QX3, M("Button LED buzzer", "pin P1 \"D2 input\"", "switch S1 P1", "pin P2 \"D13\"", "led D1 P2", "pin P3 \"D8\"", "buzzer BZ1 P3"));
k("keep-n06", QX1, M("Relay with LED", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D13\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "led D1 P2"));
k("keep-n07", QX2, M("Motor and buzzer", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"Arduino D8\"", "motor M1 \"12 V\"", "transistor Q1 M1 P1", "buzzer BZ1 P2"));
k("keep-n08", QS2, M("AC motor relay", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "note K1's contacts switch the 230 V motor"));
k("keep-n09", QX4, M("Motor with LED", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"Arduino D13\"", "motor M1", "transistor Q1 M1 P1", "led D1 P2"));
k("keep-n10", QX5, M("LED lamp", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V LED lamp\"", "transistor Q1 L1 P1"));
k("keep-n11", QS1, M("Fan driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V fan\"", "transistor Q1 M1 P1"));
k("keep-n12", QS3, M("Servo power relay", "supply \"5 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"5 V coil\"", "transistor Q1 K1 P1"));
k("keep-n13", QP1, M("Button lamp", "supply \"12 V\"", "lamp L1 \"12 V\"", "switch S1", "transistor Q1 L1 S1"));
k("keep-n14", QN1, M("Button", "pin P1 \"D2\"", "button S1 P1 pullup"));
k("keep-n15", QX3, M("Button LED buzzer", "pin P1 \"D2 input\"", "pin P2 \"D13\"", "pin P3 \"D8\"", "switch S1 P1", "led D1 P2", "buzzer BZ1 Q1", "transistor Q1 P3"));
// the T family: a load whose own line names its transistor ("motor M1 Q1", the 35B's way), the transistor's line naming
// no load, and another load of the same kind left on purpose: always on, on a switch, or on the pin itself
C.push({ id: "t-fan-alwayson", q: QT1, reply: M("Two fans", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V fan\" Q1", "transistor Q1 P1", "motor M2 \"cooling fan\""), want: "keep", harm: "high", why: "M2 is the fan that always runs; Q1 already switches M1 (M1's line names it)" });
C.push({ id: "t-led-power", q: QT2, reply: M("Power and status LEDs", "pin P1 \"Arduino D7\"", "led D1 red", "led D2 green Q1", "transistor Q1 P1"), want: "keep", harm: "high", why: "D1 is the power LED meant to stay on; D2's line names Q1" });
C.push({ id: "t-led-power2", q: QT2, reply: M("Power LED and status LED", "supply \"5 V\"", "pin P1 \"Arduino D7\"", "led D1 \"power\" red", "resistor R1 \"330 ohm\" D1", "led D2 \"status\" green Q1", "transistor Q1 P1"), want: "keep", harm: "high", why: "as t-led-power, with the power LED's own resistor" });
C.push({ id: "t-lamp-pilot", q: QT3, reply: M("Pilot and work lamp", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"work lamp\" Q1", "transistor Q1 P1", "lamp L2 \"pilot\""), want: "keep", harm: "high", why: "L2 the pilot lamp always lit" });
C.push({ id: "t-relay-manual", q: QT4, reply: M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\" Q1", "transistor Q1 P1", "switch S1 \"toggle\"", "relay K2 \"12 V coil\" S1"), want: "keep", harm: "high", why: "K2 is worked by the toggle switch S1" });
C.push({ id: "t-pump-float", q: QT5, reply: M("Pump and fan", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "switch S1 \"float\"", "motor M1 \"pump\" S1", "motor M2 \"fan\" Q1", "transistor Q1 P1"), want: "keep", harm: "high", why: "the pump M1 runs from the float switch S1" });
C.push({ id: "t-fan-35b", q: QT1, reply: M("Two fans", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "transistor Q1 K1 P1", "motor M1 Q1", "motor M2 \"always on\""), want: "keep", harm: "high", why: "the 35B's way (Q1 K1 P1 beside motor M1 Q1) with a second fan always on" });
C.push({ id: "t-valve-two", q: QT6, reply: M("Two valves", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "solenoid Y1 \"valve A\" Q1", "transistor Q1 P1", "solenoid Y2 \"valve B, always on\""), want: "keep", harm: "high", why: "Y2 always energised, as asked" });
C.push({ id: "t-led-direct", q: QT7, reply: M("Two LEDs", "pin P1 \"Arduino D7\"", "led D1 P1 red", "led D2 \"bright white\" Q1", "transistor Q1 P1"), want: "keep", harm: "high", why: "D1 lit straight from P1, D2 through Q1, as asked" });
C.push({ id: "t-fan-two-q", q: QT1, reply: M("Fans", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"Arduino D10\"", "motor M1 Q1", "motor M2 Q2", "transistor Q1 P1", "transistor Q2 P2", "motor M3 \"always on\""), want: "keep", harm: "high", why: "two switched fans and one always on" });
C.push({ id: "t-buzzer-sw", q: QB1, reply: M("Buzzers", "pin P1 \"Arduino D8\"", "buzzer BZ1 Q1", "transistor Q1 P1", "switch S1 \"test\"", "buzzer BZ2 S1"), want: "keep", harm: "high", why: "BZ2 sounds from its test button" });

// ---- 2. replies 22b1c03 questioned that the mends mean to draw -------------------------------------------------------
d("mend-m01", QM1, M("Arduino Motor Driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 P1", "transistor Q1 K1 P1"), ["load M1(motor) pin=P1 q=Q1"], ["q=Q2"], "medium", "the 35B's first try on Adam's laptop: the guide's K1 beside its motor on the same pin");
d("mend-m02", QM1, M("Arduino Motor Driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "transistor Q1 M1 P1", "diode D1 M1", "note Flyback diode across motor to protect transistor"), ["load M1(motor) pin=P1 q=Q1", "d=D1"], [], "medium", "the 35B's second try (bench_run_1258_35b_setb.json): the motor named only on the transistor's line");
d("mend-m03", QM3, M("PC fan", "supply \"12 V\"", "pin P1 \"Arduino D3\"", "fan M1 \"12 V PC fan\"", "transistor Q1 K1 P1"), ["load M1(motor) pin=P1 q=Q1"], [], "medium", "the guide's K1 for the one fan");
d("mend-m04", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1", "transistor Q1 P1"), ["load M1(motor) pin=P1 q=Q1"], [], "medium", "a transistor naming only its pin, one motor on no pin");
d("mend-m05", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1", "transistor Q1 TIP120 P1"), ["load M1(motor) pin=P1 q=Q1"], [], "medium", "a part number on the transistor's line");
a("mend-m06", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V\"", "transistor Q1 K1 P1", "diode D1 K1"), ["diode D1 M1"], ["transistor Q1 switches nothing"], "low", "the guide's K1 on the transistor's and the diode's line: Q1 is read as switching M1; the diode goes back once with its line");
d("mend-m07", QM2, M("6 V motor", "battery B1 \"6 V\"", "pin P1 \"D5\"", "transistor Q1 M1 P1"), ["load M1(motor) pin=P1 q=Q1"], [], "medium", "the motor named only on the transistor's line");
d("mend-l01", QL1, M("Lamp driver", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V\"", "transistor Q1 K1 P1"), ["load L1(lamp) pin=P1 q=Q1"], [], "medium", "the guide's K1 for the one lamp");
d("mend-l02", QL1, M("Lamp driver", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "transistor Q1 L1 P1"), ["load L1(lamp) pin=P1 q=Q1"], [], "medium", "the lamp named only on the transistor's line");
d("mend-y01", QY1, M("Valve", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "solenoid Y1 \"12 V valve\"", "transistor Q1 K1 P1"), ["load Y1(solenoid) pin=P1 q=Q1"], [], "medium", "the guide's K1 for the one solenoid");
d("mend-y02", QY2, M("Door lock", "supply \"12 V\"", "pin P1 \"Arduino D4\"", "transistor Q1 Y1 P1"), ["load Y1(solenoid) pin=P1 q=Q1"], [], "medium", "the solenoid named only on the transistor's line");
d("mend-b01", QB1, M("Buzzer", "pin P1 \"Arduino D8\"", "buzzer BZ1", "transistor Q1 K1 P1"), ["load BZ1(buzzer) pin=P1 q=Q1"], [], "medium", "the guide's K1 for the one buzzer");
d("mend-b02", QB2, M("12 V buzzer", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "transistor Q1 BZ1 P1"), ["load BZ1(buzzer) pin=P1 q=Q1"], [], "medium", "the buzzer named only on the transistor's line");
d("mend-d01", QD2, M("LED strip", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "led D1 \"12 V LED strip\"", "transistor Q1 K1 P1"), ["load D1(led) pin=P1 q=Q1"], [], "medium", "the guide's K1 for the one LED");
d("mend-d02", QD6, M("LED", "pin P1 \"Arduino D7\"", "led D1 P1 red", "transistor Q1 P1"), ["load D1(led) pin=P1 q=Q1"], [], "medium", "the transistor naming only the LED's own pin");
d("mend-r01", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "transistor Q1 K1 P1"), ["load K1(relay) pin=P1 q=Q1"], [], "medium", "the relay named only on the transistor's line");
d("mend-r02", QR1, M("Relay with power LED", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "led D1 red", "transistor Q1 K1 P1"), ["load K1(relay) pin=P1 q=Q1", "load D1(led) r="], [], "medium", "the relay named only on the transistor's line, a power LED beside it");
d("mend-r03", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 P1"), ["load K1(relay) pin=P1 q=Q1"], [], "medium", "a transistor naming only its pin");
d("mend-r04", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1"), ["load K1(relay) pin=P1 q=Q1"], [], "medium", "a bare transistor line, one pin");
d("mend-r05", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 RLY1 P1"), ["load K1(relay) pin=P1 q=Q1"], [], "medium", "another name for the relay on the transistor's line");
d("mend-r06", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\" P1", "transistor Q1 P1"), ["load K1(relay) pin=P1 q=Q1"], ["q=Q2"], "medium", "the relay and a bare transistor on the same pin");
d("mend-r07", QR5, M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "transistor Q2 K2 P2"), ["load K1(relay) pin=P1 q=Q1", "load K2(relay) pin=P2 q=Q2"], [], "medium", "the second relay named only on its transistor's line");
d("mend-p01", QP1, M("Button lamp", "supply \"12 V\"", "lamp L1 \"12 V\"", "switch S1", "transistor Q1 S1"), ["load L1(lamp) q=Q1 sw=S1"], [], "medium", "a button driving a bare transistor, one lamp");
C.push({ id: "mend-p02", q: QP1, reply: M("Button lamp", "supply \"12 V\"", "lamp L1 \"12 V\"", "switch S1 L1", "transistor Q1 S1"), want: { draw: ["load L1(lamp) q=Q1 sw=S1"], not: [], parts: "L1:lamp Q1:transistor R1:resistor S1:switch" }, harm: "high",
  why: "S1 names the lamp it works (as the guide's switch S1 D1 says) and drives Q1's base: one push button. It must be drawn once, at the base" });
// the board's name for a pin on the transistor's line
d("pin-01", QR6, M("Relay with button", "supply \"12 V\"", "pin P1 \"D2 input\"", "switch S1 P1", "pin P2 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 D7"), ["load K1(relay) pin=P2 q=Q1", "input pin=P1 sw=S1"], [], "medium", "D7 is P2's name on the board");
d("pin-02", QR1, M("Pico relay", "supply \"12 V\"", "pin P1 \"Pico GP15\"", "pin P2 \"Pico GP14\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 GP15", "led D1 P2"), ["load K1(relay) pin=P1 q=Q1", "load D1(led) pin=P2"], [], "medium", "a Pico's GP15");
d("pin-03", QR3, M("ESP32 relay", "supply \"5 V\"", "pin P1 \"ESP32 IO5\"", "pin P2 \"ESP32 IO4\"", "relay K1 \"5 V coil\"", "transistor Q1 K1 IO5", "switch S1 P2"), ["load K1(relay) pin=P1 q=Q1", "input pin=P2 sw=S1"], [], "medium", "an ESP32's IO5");
d("pin-04", QM1, M("Motor with button", "supply \"12 V\"", "pin P1 \"Arduino D2 input\"", "pin P2 \"Arduino D9\"", "switch S1 P1", "motor M1 \"12 V\"", "transistor Q1 M1 D9"), ["load M1(motor) pin=P2 q=Q1", "input pin=P1 sw=S1"], [], "medium", "the board's D9 for P2");
d("pin-05", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"arduino d7\"", "pin P2 \"arduino d8\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 D7", "led D1 P2"), ["load K1(relay) pin=P1 q=Q1"], [], "medium", "the board's name in small letters");
d("pin-06", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"D7 to K1\"", "transistor Q1 K1 P1"), ["load K1(relay) pin=P1 q=Q1"], [], "medium", "the pin's label says where it goes (to K1); K1 is the relay named on Q1's line, and the pin is already on it");
d("pin-07", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7 for relay K1\"", "pin P2 \"Arduino D13\"", "led D1 P2", "transistor Q1 K1 P1"), ["load K1(relay) pin=P1 q=Q1", "load D1(led) pin=P2"], [], "medium", "a label ending in the relay's name, beside an LED on its own pin");
a("pin-08", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 D7"), ["."], [], "low", "two pins with the same board name: not sure which, so questioned");

// ---- 3. what goes back -------------------------------------------------------------------------------------------------
a("ask-two-leds", QD5, M("Two LEDs", "pin P1 \"D12\"", "pin P2 \"D13\"", "led D1 P1 red"), ["P2"], ["leave P2\u2019s line out"], "high", "the question asks for two LEDs: P2 is the second LED's pin, not spare -- left out as told, one LED is drawn for two");
a("ask-two-leds-dup", QD5, M("Two LEDs", "pin P1 \"D12\"", "pin P2 \"D13\"", "led D1 P1 red"), ["P2"], ["\\(led D1 P2"], "low", "led D1 P2 names the first LED again: copied, D1 has two pins and P2 still drives nothing (the line is led D2 P2)");
a("ask-two-relays", QR5, M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1"), ["P2"], ["leave P2\u2019s line out"], "high", "the question asks for two relays: P2 is the second relay's pin, not spare -- left out as told, one relay is drawn for two");
a("ask-two-relays-line", QR5, M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1"), ["K2 P2"], [], "medium", "the line for P2 is the second relay's (transistor Q2 K2 P2); no version gives it");
a("ask-two-motors", QM5, M("Two motors", "supply \"12 V\"", "pin P1 \"Arduino D5\"", "pin P2 \"Arduino D6\"", "motor M1", "transistor Q1 M1 P1"), ["P2"], ["leave P2\u2019s line out"], "high", "two motors asked: P2 is the second motor's pin, not spare");
a("ask-button-spare", QR6, M("Button relay", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D2\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1"), ["switch S1 P2"], ["leave P2\u2019s line out"], "medium", "the question asks for a push button: P2 is its pin, not spare");
a("ask-idle-q2", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "transistor Q2 P2"), ["Q2"], ["transistor Q2 K1 P1"], "medium", "Q2 has nothing to switch: naming K1 on P1 puts two transistors on one relay and one pin (copied, Q2 still switches nothing)");
d("own-line-led", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D13\"", "led D1 P2 green", "transistor Q1 K1 P1"), ["load K1(relay) pin=P1 q=Q1", "load D1(led) pin=P2"], [], "medium", "afea882 drew this right: the relay named only on the transistor's line, the LED on its own pin P2, nothing drawn always on");
C.push({ id: "own-line-led-msg", q: QR1, reply: M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D13\"", "led D1 P2 green", "transistor Q1 K1 P1"), want: { either: true, draw: ["load K1(relay) pin=P1 q=Q1"], ask: ["relay K1"], not: ["like: transistor Q1 K1 P1(?!\\S)", "\\(transistor Q1 K1 P1\\)"] }, harm: "medium", why: "drawn, or questioned with a line that is not the reply's own (rule 3: the model's own line handed back changes nothing)" });
a("ask-own-line-buzzer", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "buzzer BZ1", "transistor Q1 K1 P1"), ["relay K1"], ["like: transistor Q1 K1 P1(?!\\S)"], "medium", "the relay asked for has no line; the line handed back is the reply's own transistor line, which changes nothing");
a("ask-own-line-ledk", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "led D1 K1", "transistor Q1 K1 P1"), ["relay K1"], ["like: transistor Q1 K1 P1(?!\\S)"], "medium", "an LED to show the relay, the relay's own line left out: afea882 added K1");
a("ask-nothing-relay", QR1, M("Relay", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "transistor Q1 P1"), ["relay K1"], ["led D1 \x22power on\x22"], "low", "nothing to power: the relay asked for");
a("ask-nothing-led", QD1, M("LED", "pin P1 \"Arduino D13\""), ["led D1 P1"], [], "low", "an LED lit by the pin: the line is led D1 P1 (led D1 alone is always on)");
a("ask-nothing-motor", QM1, M("Motor", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "transistor Q1 P1"), ["motor M1"], [], "low", "nothing to power: the motor asked for");
a("ask-ldr-input", QD4, M("Dark sensor", "pin P1 \"A0 input\"", "pin P2 \"D9\"", "led D1 P2"), ["P1"], ["\\(switch S1 P1\\)"], "high", "the question asks for an LDR on A0: switch S1 P1, the one line handed back, copied, draws a push button where the LDR goes");
a("ask-ldr-line", QD4, M("Dark sensor", "pin P1 \"A0 input\"", "pin P2 \"D9\"", "led D1 P2"), ["sensor LDR1 P1"], [], "low", "the line for an LDR on A0 is sensor LDR1 P1; no version gives it");
a("ask-pot-input", "Draw a potentiometer on A0 that sets how bright an LED on pin 9 of an Arduino is.", M("Dimmer", "pin P1 \"A0 input\"", "pin P2 \"D9\"", "led D1 P2"), ["P1"], ["\\(switch S1 P1\\)"], "high", "the question asks for a pot on A0: switch S1 P1, the one line handed back, copied, draws a button");
a("ask-therm-read", QP3, M("Thermostat fan", "supply \"12 V\"", "pin P1 \"A0 read\"", "pin P2 \"D9\"", "motor M1 \"fan\"", "transistor Q1 M1 P2"), ["P1"], ["\\(switch S1 P1\\)"], "high", "a thermistor asked for on A0: switch S1 P1, the one line handed back, copied, draws a button");
a("ask-switch-dup", QN1, M("Two buttons", "pin P1 \"D2 input\"", "pin P2 \"D3 input\"", "switch S1 P1"), ["S2 P2"], ["\\(switch S1 P2\\)"], "low", "S1 is on P1 already: switch S1 P2 gives S1 two pins (old: the same S1)");
a("ask-base-p1", QR6, M("Relay with button", "supply \"12 V\"", "pin P1 \"D2 input\"", "switch S1 P1", "pin P2 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1"), ["K1 P2"], ["transistor Q1 K1 P1"], "low", "P1 reads the button; the line for the transistor is on P2");
a("ask-diode-motor", QM1, M("Motor", "supply \"12 V\"", "motor M1 \"12 V\"", "diode D1"), ["diode D1 M1"], [], "low", "a diode with no coil named: name the motor");
a("ask-led-k1", QD3, M("Button and LED", "pin P1 \"D2 input\"", "pin P2 \"D13\"", "switch S1 P1", "led D1 P2 green", "transistor Q1 K1 P1"), ["Q1"], ["transistor Q1 D1 P1"], "low", "the guide's transistor line copied into a button-and-LED circuit: the line handed back puts the LED's transistor on the button's pin");
a("ask-base-r", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "resistor R1 \"1 kohm\" Q1"), ["R1"], ["resistor R1 \x221 kohm\x22 K1"], "low", "a base resistor the model sized: resistor R1 ... K1, copied, is never used for a relay and comes back the same");
a("ask-led-spare-dup", QD1, M("LED", "pin P1 \"D13\"", "pin P2 \"D12\"", "led D1 P1"), ["P2"], ["\\(led D1 P2"], "low", "led D1 P2 names D1 again (old)");
a("ask-relay-other-pin", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 \"12 V coil\" P2", "transistor Q1 K1b P1"), ["."], [], "low", "a relay on P2 and a transistor on P1 naming nothing known: questioned");
// ---- 4. questions that ask for two kinds, or for a motor this does not draw ------------------------------------------
d("two-relay-led", QX1, M("Relay with LED", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D13\"", "transistor Q1 K1 P1", "led D1 P2 green"), ["load K1(relay) pin=P1 q=Q1", "load D1(led) pin=P2"], [], "medium", "afea882 drew it: the relay named only on the transistor's line, the LED on its own pin (an LED in the question is not a reason to stop)");
d("two-motor-led", QX4, M("Motor with LED", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"Arduino D13\"", "transistor Q1 M1 P1", "led D1 P2"), ["load M1(motor) pin=P1 q=Q1", "load D1(led) pin=P2"], [], "medium", "afea882 drew it");
d("two-led-lamp", QX5, M("LED lamp", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V LED lamp\"", "transistor Q1 K1 P1"), ["load L1(lamp) pin=P1 q=Q1"], [], "medium", "an LED lamp is one lamp: afea882 drew it");
d("two-led-lamp2", QX5, M("LED lamp", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "transistor Q1 L1 P1"), ["load L1(lamp) pin=P1 q=Q1"], [], "medium", "an LED lamp named only on the transistor's line: afea882 drew it");
d("stepper-fan", QS1, M("Fan driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V fan\" P1", "transistor Q1 K1 P1"), ["load M1(motor) pin=P1 q=Q1"], [], "medium", "the fan is the load; the stepper is only where the fan is used: afea882 drew it");
d("servo-relay", QS3, M("Servo power relay", "supply \"5 V\"", "pin P1 \"Arduino D7\"", "transistor Q1 K1 P1"), ["load K1(relay) pin=P1 q=Q1"], [], "medium", "the relay is the load; the servos are what it cuts: afea882 drew it");
a("ac-motor", QS2, M("AC motor relay", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "transistor Q1 K1 P1", "note K1 switches the 230 V motor"), ["."], ["load K1"], "low", "an AC motor question: no kind is read, so the relay is not added (afea882 the same)");
a("ac-motor-m", QS2, M("AC motor", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "motor M1 \"230 V AC\"", "transistor Q1 P1"), ["."], [], "high", "a 230 V AC motor must not be put under a 12 V NPN transistor");
d("two-motor-buzzer", QX2, M("Motor and buzzer", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"Arduino D8\"", "motor M1 \"12 V\"", "transistor Q1 M1 P1", "buzzer BZ1 P2"), ["load M1(motor) pin=P1 q=Q1", "load BZ1(buzzer) pin=P2"], [], "high", "right reply");

// ---- 5. the bench's own electronics replies (tests/fixtures/bench_run_*.json), as the models wrote them ---------------
var QBENCH = QR1, QBENCHB = QM1;
C.push({ id: "bench-1244-2b", q: QBENCH, reply: "MAKE ELECTRONICS: Arduino Relay Switch\nsupply \"12 V\"\npin P1 \"Arduino D7\"\nrelay K1 \"12 V coil\"\ntransistor Q1 K1 P1\nswitch S1 P2\nnote <Arduino D7 switches 12 V relay coil via NPN transistor Q1>\nEND", want: "same", harm: "medium", why: "bench_run_1244_2b.json" });
C.push({ id: "bench-1245-2b", q: QBENCH, reply: "MAKE ELECTRONICS: Arduino Relay Switch\npin P1 \"D2 input\"\npin P2 \"D13\"\nswitch S1 P2\nrelay K1 \"12 V coil\"\ntransistor Q1 K1 P2\ndiode D1 P1 K1\nnote <Arduino D2 pin switches 12V relay coil via NPN transistor Q1, with diode D1 protecting the transistor from back-EMF.>", want: "same", harm: "medium", why: "bench_run_1245_2b.json" });
C.push({ id: "bench-1231-2b", q: QBENCH, reply: "MAKE ELECTRONICS: Button and LED\npin P1 \"D2 output\"\npin P2 \"D13\"\nswitch S1 P1\nrelay K1 \"12 V coil\"\ntransistor Q1 K1 P1\nled D1 P2 green\nEND", want: "same", harm: "medium", why: "bench_run_1.24.31_2b.json" });
C.push({ id: "bench-1256-35b", q: QBENCHB, reply: "MAKE ELECTRONICS: Arduino Motor Driver\nsupply \"12 V\"\npin P1 \"Arduino D9\"\ntransistor Q1 K1 P1\nmotor M1 Q1\ndiode D1 M1\nnote Flyback diode across motor to protect transistor\nEND", want: "keep", harm: "high", why: "bench_run_1256_35b_setb.json" });
C.push({ id: "bench-1258-35b", q: QBENCHB, reply: "MAKE ELECTRONICS: Arduino Motor Driver\nsupply \"12 V\"\npin P1 \"Arduino D9\"\ntransistor Q1 M1 P1\ndiode D1 M1\nnote Flyback diode across motor to protect transistor\nEND", want: { draw: ["load M1(motor) pin=P1 q=Q1", "d=D1"], not: [] }, harm: "medium", why: "bench_run_1258_35b_setb.json: the motor named only on the transistor's line" });
C.push({ id: "bench-1244-08b-code", q: "Write an Arduino sketch for a stepper motor on an A4988 driver (STEP on pin 3, DIR on pin 2) that moves 800 steps forward and back again, over and over, with smooth acceleration.", reply: "MAKE ELECTRONICS:\npin P1 \"D2 input\"\npin P2 \"D13\"\nswitch S1 P1\nled D1 P2 green\nEND", want: "same", harm: "medium", why: "bench_run_1244_08b.json: the guide's example under a stepper question" });
C.push({ id: "bench-1247-2b-cols", q: QBENCH, reply: "MAKE ELECTRONICS:\n<title>Relay Switch Circuit</title>\nsupply \"12 V\"                  the + rail and 0 V (GND); battery B1 \"9 V\" draws a battery\npin P1 \"Arduino D7\"            a microcontroller pin (5 V; write 3.3V for an ESP32 or a Pi); its board's GND is joined to 0 V\nled D1 P1 red                  an LED lit by pin P1 (led D1 alone: from + to 0 V). Lantern adds and sizes its resistor\nrelay K1 \"12 V coil\"           a relay coil; also lamp L1, motor M1, buzzer BZ1, solenoid Y1\ntransistor Q1 K1 P1            an NPN transistor switching K1, its base driven by P1\nswitch S1 P2                   a push button read by pin P2 (Lantern adds the pull-down; write pullup for a pull-up)\ndiode D2 K1 P1                a diode across the coil\nEND", want: "same", harm: "medium", why: "bench_run_1247_2b.json, the guide copied with its second column" });

// ---- 6. more right replies: other words people and models use -------------------------------------------------------
k("keep-x01", QR1, M("Relay", "supply \"12 V\"", "gpio P1 \"Arduino D7\"", "relay K1 \"12 V\"", "bjt Q1 K1 P1"));
k("keep-x02", QM1, M("Motor", "power supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1", "transistor Q1 M1 P1", "note The diode protects Q1"));
k("keep-x03", QR1, M("Relay", "supply \"12 V\"", "pin P1 \"Arduino pin 7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1"));
k("keep-x04", QY1, M("Valve", "supply \"24 V\"", "pin P1 \"Arduino D8\"", "solenoid Y1 \"24 V valve\"", "transistor Q1 Y1 P1"));
k("keep-x05", QL1, M("Lamp", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V 21 W\"", "transistor Q1 L1 P1"));
k("keep-x06", QM4, M("ESP32 fan", "supply \"5 V\"", "pin P1 \"ESP32 3.3V GPIO18\"", "fan M1 Q1", "transistor Q1 P1"));
k("keep-x07", QB1, M("Buzzer", "supply \"5 V\"", "pin P1 \"Arduino D8\"", "buzzer BZ1 \"5 V\"", "transistor Q1 BZ1 P1", "note D8 HIGH sounds it"));
k("keep-x08", QD2, M("LED strip", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "led D1 \"strip\" Q1", "transistor Q1 P1"));
k("keep-x09", QR2, M("5V relay", "pin P1 \"Arduino D8\"", "relay K1 \"5 V\"", "transistor Q1 K1 P1"));
k("keep-x10", QR1, M("Relay with indicator", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "led D1 \"power\""));
k("keep-x11", QY1, M("Valve with power LED", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "led D1 \"power\" red", "solenoid Y1", "transistor Q1 Y1 P1"));
k("keep-x12", QM1, M("Motor and switch", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1", "transistor Q1 M1 P1", "switch S1 \"stop\" P2", "pin P2 \"D2 input\""));
k("keep-x13", QL1, M("Lamp", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "transistor Q1 L1 P1", "lamp L1 \"12 V\""));
k("keep-x14", QB2, M("Buzzer", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "buzzer BZ1 \"12 V\" Q1", "transistor Q1 P1"));
k("keep-x15", QD6, M("LED through a transistor", "pin P1 \"Arduino D7\"", "led D1 Q1", "transistor Q1 P1", "led D2 P2", "pin P2 \"D13\""));
k("keep-x16", QR5, M("Two relays", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D8\"", "relay K1 Q1", "transistor Q1 P1", "relay K2", "transistor Q2 K2 P2"));
k("keep-x17", QM1, M("Motor", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V\"", "transistor Q1 M1 P1", "capacitor C1 \"0.1 uF\""));
k("keep-x18", QP2, M("Night lamp", "supply \"12 V\"", "pin P1 \"A0\"", "ldr LDR1 P1", "pin P2 \"D6\"", "lamp L1 Q1", "transistor Q1 P2"));
k("keep-x19", QY2, M("Door lock", "supply \"12 V\"", "pin P1 \"Arduino D4\"", "solenoid Y1 \"12 V lock\"", "transistor Q1 Y1 P1", "diode D1 Y1", "note D1 catches the coil's kick"));
k("keep-x20", QM2, M("Motor", "battery B1 \"6 V\"", "pin P1 \"D5\"", "motor M1 Q1", "transistor Q1 P1", "diode D1 M1"));

// ---- 7. added after the first run -------------------------------------------------------------------------------------
C.push({ id: "t-led-button", q: "Draw an Arduino circuit with an LED lit by a push button and another LED driven through a transistor.", reply: M("Two LEDs", "pin P1 \"Arduino D7\"", "switch S1", "led D1 S1 red", "led D2 green Q1", "transistor Q1 P1"), want: "keep", harm: "high", why: "D1 is lit by its button S1, D2 through Q1, as asked" });
C.push({ id: "old-sw-double", q: QP1, reply: M("Button lamp", "supply \"12 V\"", "lamp L1 \"12 V\"", "switch S1 L1", "transistor Q1 L1 S1"), want: { draw: ["load L1(lamp) q=Q1 sw=S1"], not: [], parts: "L1:lamp Q1:transistor R1:resistor S1:switch" }, harm: "high", why: "old (22b1c03 the same): one push button drawn twice, in the lamp's line and at the base" });
a("add-second-same-pin", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1", "transistor Q2 K2 P1"), ["."], [], "low", "one relay asked; Q2 names K2, which no line has, on Q1's pin: not sure enough to add a second relay and a second transistor on one pin");
C.push({ id: "pin-01-said", q: QR6, reply: M("Relay with button", "supply \"12 V\"", "pin P1 \"D2 input\"", "switch S1 P1", "pin P2 \"Arduino D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 D7"), want: { draw: ["load K1(relay) pin=P2 q=Q1"], not: [], note: "D7" }, harm: "low", why: "rule 2: reading D7 on Q1's line as P2 changes what the model wrote, and is not said" });
k("keep-x21", QR6, M("Button relay", "supply \"12 V\"", "pin P1 \"D2 input\"", "switch S1 P1", "pin P2 \"D8\"", "relay K1 \"12 V coil\" P2", "transistor Q1 K1 D8"), "the board's name on the transistor's line, the relay's own line naming the pin");
k("keep-x22", QD6, M("LED through a transistor", "pin P1 \"Arduino D7\"", "led D1 white", "transistor Q1 BC547 D1 P1"));
k("keep-x23", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"D7\"", "relay K1 \"12 V coil\"", "transistor Q1 K1 P1 D7"));
k("keep-x24", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "pin P2 \"Arduino D13\"", "motor M1 Q1", "transistor Q1 P1", "led D1 P2 \"running\""));
k("keep-x25", QY1, M("Valve", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "pin P2 \"D2 input\"", "switch S1 P2", "solenoid Y1 Q1", "transistor Q1 P1"));
a("ask-nothing-pin", QR6, M("Button relay", "supply \"12 V\"", "pin P1 \"D2 input\"", "pin P2 \"D7\"", "transistor Q1 P2"), ["relay K1"], ["transistor Q1 K1 P1"], "low", "Q1 is on P2; the line handed back moves it to P1, the input pin");
d("pin-09", QR1, M("Relay driver", "supply \"12 V\"", "pin P1 \"Arduino D7\"", "pin P2 \"Arduino D13\"", "relay K1 \"12 V coil\" Q1", "transistor Q1 D7", "led D1 P2"), ["load K1(relay) pin=P1 q=Q1", "load D1(led) pin=P2"], [], "medium", "the relay's line names Q1, Q1's line the board's D7 (two pins: 22b1c03 could not tell which drove Q1)");
k("keep-x27", QL1, M("Lamp", "supply \"12 V\"", "pin P1 \"Arduino D6\"", "lamp L1 \"12 V\" Q1", "transistor Q1 P1 BD139"));
k("keep-x28", QB2, M("Buzzer and LED", "supply \"12 V\"", "pin P1 \"Arduino D8\"", "pin P2 \"Arduino D13\"", "buzzer BZ1 \"12 V\"", "transistor Q1 BZ1 P1", "led D1 P2", "led D2 \"power\""));
k("keep-x29", QM1, M("Motor driver", "supply \"12 V\"", "pin P1 \"Arduino D9\"", "motor M1 \"12 V\" P1", "diode D1 M1"));

module.exports = C;
