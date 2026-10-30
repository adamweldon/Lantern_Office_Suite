// electronics.js -- electronic circuits made correct by construction
// (1.18.0). The AI names the parts and what drives what (MAKE ELECTRONICS):
// a pin, an LED, a relay, a transistor, a push button, a sensor. Lantern
// draws the + rail and 0 V with a branch for each thing powered or read,
// and adds and sizes what such circuits need, saying so: an LED's resistor,
// a transistor's base resistor, the diode across a coil a transistor
// switches, a transistor for a load too big for a pin, a push button's
// pull-down (or pull-up), a sensor's divider, the board's GND joined to 0 V.
// The wires are walked as a check. The part / wire schematics the AI
// already writes are checked too (AI_SCHEMATIC_CHECK): an LED with no
// resistor gets one; one sized too small, a short, an ammeter across a part
// or a voltmeter in series goes back to the AI, the drawing shown.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function fire(el, t) { var e = w.document.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }

w.eval(js);
fire(w.document, "DOMContentLoaded");
var L = w.Lantern, E = L.aiElectronics, K = L.aiSchematicCheck, act = L.aiAct;
var item = L.aiBenchQuestions.filter(function (q) { return q.id === "make-electronics"; })[0];
function make(text, q) { return act.build(text, q || item.q); }
function blk(title, lines) { return "MAKE ELECTRONICS: " + title + "\n" + lines.join("\n") + "\nEND"; }
function sch(title, lines) { return "MAKE SCHEMATIC: " + title + "\n" + lines.join("\n") + "\nEND"; }
function walk(text) { var b = act.find(text)[0], c = E.circuit(E.parse(b)); return { c: c, lay: c.problems.length ? null : E.layout(c, b.title) }; }
function br(r, kind) { return r.plan.circuit.branches.filter(function (x) { return x.load ? x.load.kind === kind : x.kind === kind; })[0]; }

// --- what the AI is told ---------------------------------------------------------------------
var pp = act.prompt(item.q), pc = act.prompt("Write Arduino code to blink an LED on pin 13"), pe = act.prompt("Draw a circuit with a 12 V battery, a switch and a lamp");
ok("an electronics question gets MAKE ELECTRONICS: parts and what drives what, never wires", /MAKE ELECTRONICS: <title>/.test(pp) && /transistor Q1 K1 P1/.test(pp) && /Never write wires or part lines/.test(pp) &&
  /For the program the board runs, write MAKE CODE/.test(pp), pp.slice(0, 600));
ok("...its example is not the bench question (no relay or transistor in it)", !/relay|transistor/.test(pp.split("For example:")[1]), pp.split("For example:")[1]);
ok("a question about code is not a circuit drawing", !E.asks("Write Arduino code to blink an LED on pin 13") && !/MAKE ELECTRONICS/.test(pc));
ok("asks(): pins, transistors, LEDs, pull-ups; not control circuits, air or oil", E.asks(item.q) && E.asks("Draw an LED with its resistor on a 9 V battery") && E.asks("show a push button with a pull-down on an ESP32 pin") &&
  !E.asks("Draw the control circuit for a motor starter with a seal-in") && !E.asks("Draw a pneumatic circuit") && !/MAKE ELECTRONICS/.test(pe));

// --- the bench question ---------------------------------------------------------------------------
var ideal = make(item.ideal), g = L.aiBench.grade(item, item.ideal, { made: ideal });
ok("the bench's model answer is MAKE ELECTRONICS, and passes", /^MAKE ELECTRONICS/.test(item.ideal) && g.pass, g.why);
var least = make(blk("Relay", ["supply \"12 V\"", "pin P1 \"D7\"", "relay K1 P1"]));
ok("...the least the AI can write (a pin naming the relay) passes: Lantern adds the transistor, its base resistor and the diode, and says why",
  least.ok && L.aiBench.grade(item, "x", { made: least }).pass && /Lantern added transistor Q1 to switch K1 \(a pin gives about 20 mA, too little for a relay\)/.test(least.summary) &&
  /the diode D1 across K1 \(its cathode to \+\), so Q1 is not killed by K1’s kick when it turns off/.test(least.summary), least.summary);
var fake = JSON.parse(JSON.stringify(ideal.plan)); fake.circuit.branches[0].diode = null;
ok("...a plan without the diode fails, and says why", /no diode across the relay coil/.test(item.check(fake)));
var roles = make(sch("Relay driver", ["supply \"12 V\"", "pin P1 \"Arduino D7\"", "relay K1", "transistor Q1 K1 P1"]));
ok("the same lines in a MAKE SCHEMATIC block are electronics", roles.ok && roles.plan.mode === "electronics" && L.aiBench.grade(item, "x", { made: roles }).pass, roles.problems);
var r1 = br(ideal, "relay");
ok("the relay's branch: P1 drives Q1 through R1 (1 kΩ, ~4 mA for a ~40 mA coil); D1 across K1, cathode to +", r1.q === "Q1" && r1.pin === "P1" && r1.rb.ohms === 1000 && r1.diode.id === "D1" &&
  /R1 \(1 kΩ\) into Q1’s base \(about 4 mA, enough to switch K1’s ~40 mA\)/.test(ideal.summary), [r1, ideal.summary]);
ok("what the circuit does is said", /P1 \(Arduino D7\) high turns Q1 on: K1 \(12 V coil\) pulls in; D1 catches its kick when Q1 turns off/.test(ideal.summary) &&
  /The board’s GND is joined to 0 V/.test(ideal.summary), ideal.summary);

// --- sizes worked out ------------------------------------------------------------------------------------
var led = make(blk("Power light", ["battery B1 \"9 V\"", "led D1 red"]));
ok("an LED on 9 V gets 470 Ω ((9 - 2) / 15 mA = 467, the next E12 value up), said", br(led, "led").r.ohms === 470 && /R1 \(470 Ω\) for D1 \(\(9 V - 2 V\) \/ 15 mA\)/.test(led.summary), led.summary);
var led33 = make(blk("Blue", ["pin P1 \"ESP32 GPIO2\"", "led D1 P1 blue"]));
ok("a blue LED on an ESP32 pin: 3.3 V, about 3.1 V across it -> 15 Ω", led33.plan.circuit.pins[0].v === 3.3 && br(led33, "led").r.ohms === 15, led33.summary);
var ledq = make(blk("Strip", ["supply \"12 V\"", "pin P1", "led D1 white", "transistor Q1 D1 P1"]));
ok("an LED a transistor switches from 12 V: (12 - 3.1 - 0.2) / 15 mA -> 680 Ω", br(ledq, "led").r.ohms === 680, ledq.summary);
var small = make(blk("LED", ["supply \"9 V\"", "led D1", "resistor R1 \"100 ohm\" D1"]));
ok("an LED resistor sized too small goes back with the value to use", !small.ok && /R1 \(100 Ω\) lets about 70 mA through D1: an LED takes about 20 mA at most -- use 470 Ω or more/.test(small.problems[0]), small.problems);
var mine = make(blk("LED", ["supply \"5 V\"", "led D1", "resistor R1 \"330 ohm\" D1"]));
ok("...one sized well is kept as written", mine.ok && br(mine, "led").r.id === "R1" && br(mine, "led").r.ohms === 330 && !/added R/.test(mine.summary), mine.summary);
var fan = make(blk("Fan", ["supply \"12 V\"", "pin P1 \"ESP32 GPIO4\"", "motor M1 \"fan\"", "transistor Q1 M1 P1", "sensor LDR1 P2", "pin P2 \"GPIO34\""]));
ok("a motor on an ESP32: a 220 Ω base resistor, the diode, and the light sensor read from the board's 3.3 V, not the 12 V rail", fan.ok && br(fan, "motor").rb.ohms === 220 && br(fan, "motor").diode &&
  fan.plan.circuit.pins.every(function (p) { return p.v === 3.3; }) && /LDR1 and R2 \(10 kΩ\) divide 3\.3 V/.test(fan.summary), fan.summary);
var x = walk(blk("Fan", ["supply \"12 V\"", "pin P1 \"ESP32 GPIO4\"", "motor M1", "transistor Q1 M1 P1", "sensor LDR1 P2", "pin P2"]));
ok("...the sensor's branch hangs from the board's 3.3 V tag", x.lay.shapes.some(function (s) { return s.t === "group" && s.shapes.some(function (k) { return k.t === "text" && k.s === "board 3.3 V"; }); }));
var btn = make(blk("Button and LED", ["pin P1 \"D2 input\"", "pin P2 \"D13\"", "switch S1 P1", "led D1 P2 green"]));
ok("a push button read by a pin gets its pull-down, said, and what the pin reads", btn.ok && br(btn, "input").pull === "down" &&
  /the pull-down resistor R2 \(10 kΩ\) on P1, so it reads 0 V -- not a floating pin -- while S1 is open/.test(btn.summary) && /P1 \(D2 input\) reads 5 V while S1 is pressed, 0 V when it is let go/.test(btn.summary), btn.summary);
var up = make(blk("Up", ["pin P1 \"D3\"", "switch S1 P1 pullup"]));
ok("...pullup: the resistor to +, the button to 0 V", br(up, "input").pull === "up" && /reads 0 V while S1 is pressed, 5 V when it is let go/.test(up.summary), up.summary);
var torch = make(blk("Torch", ["battery B1 \"6 V\"", "switch S1 L1", "lamp L1"]));
ok("a switch naming a lamp is in the lamp's line", torch.ok && br(torch, "lamp").sw === "S1" && /S1 pressed: L1 lights/.test(torch.summary), torch.summary);
var none = make(blk("Pot", ["pin P1 \"A0\"", "pot RV1 P1"]));
ok("no supply said: 5 V, and said how to change it", none.ok && /The supply is drawn as 5 V \(write supply \x229 V\x22 for another\)/.test(none.summary), none.summary);

// --- the wires, walked -------------------------------------------------------------------------------------
var wr = walk(item.ideal), bad = E.verify(wr.c, wr.lay);
ok("verified: K1 fed from +, Q1 switching its lower end to 0 V, the base through R1, D1 across K1 cathode up", !bad.length, bad);
function swap(lay, f) { return { shapes: lay.shapes, els: lay.els.map(function (e) { var c = {}; Object.keys(e).forEach(function (k) { c[k] = e[k]; }); return f(c) || c; }) }; }
ok("the walk catches a diode the wrong way round", E.verify(wr.c, swap(wr.lay, function (e) { if (e.kind === "diode") { var t = e.a; e.a = e.b; e.b = t; } })).some(function (p) { return /D1 is not across K1 with its cathode to \+/.test(p); }));
ok("...a base with no resistor", E.verify(wr.c, swap(wr.lay, function (e) { if (e.base && e.kind === "resistor") e.b = "nZ"; })).some(function (p) { return /Q1’s base is not driven through a resistor/.test(p); }));
var lw = walk(blk("LED", ["supply \"9 V\"", "led D1"]));
ok("...an LED with no resistor in series", E.verify(lw.c, swap(lw.lay, function (e) { if (e.kind === "resistor") { e.kind = "wire"; e.load = false; e.id = ""; } })).some(function (p) { return /D1 has no resistor in series/.test(p); }));
ok("...+ reaching 0 V through wire alone", E.verify(lw.c, swap(lw.lay, function (e) { if (e.kind === "led") e.load = false; if (e.kind === "resistor") e.load = false; })).some(function (p) { return /\+ reaches 0 V through switches and wire alone/.test(p); }));

// --- what goes back to the AI ------------------------------------------------------------------------------
var r = make(blk("X", ["relay K1", "transistor Q1 K1"]));
ok("a transistor nothing drives goes back, with the lines to add", !r.ok && /Q1 needs something driving its base: add pin P1 \x22Arduino D7\x22 and write transistor Q1 K1 P1/.test(r.problems[0]), r.problems);
r = make(blk("X", ["mosfet Q1 M1 P1", "motor M1", "pin P1"]));
ok("a part Lantern does not draw yet is said so, with what to write instead", !r.ok && /is not something Lantern draws yet .* a switching transistor is an NPN: transistor Q1 K1 P1/.test(r.problems[0]), r.problems);
r = make(blk("X", ["wire P1 D1", "led D1 P1", "pin P1"]));
ok("a wire line goes back: Lantern wires it", !r.ok && /never write wires -- name what drives what/.test(r.problems[0]), r.problems);
r = make(blk("X", ["pin P1", "pin P2", "led D1 P1"]));
ok("a pin that drives or reads nothing goes back", !r.ok && /pin P2 drives or reads nothing/.test(r.problems.join("|")), r.problems);
r = make(blk("X", ["supply \"9 V\"", "led D1", "resistor R2 \"1k\""]));
ok("a resistor that names nothing goes back (Lantern sizes the usual ones itself)", !r.ok && /resistor R2: name the part it is in series with/.test(r.problems.join("|")), r.problems);
r = make(blk("X", ["supply \"3 V\"", "led D1 blue"]));
ok("an LED the supply cannot light goes back", !r.ok && /D1 \(blue LED, about 3\.1 V\) will not light from 3 V/.test(r.problems[0]), r.problems);
var ft = act.fixText(make(blk("Two wrongs", ["wire P1 D1", "relay K1", "transistor Q1 K1"])), item.q);
ok("the correction turn: numbered problems and the MAKE ELECTRONICS lines", /^Lantern checked your MAKE ELECTRONICS block and found \d things to fix:\n1\. /.test(ft) && /Lantern reads a MAKE ELECTRONICS block line by line/.test(ft), ft);

// --- the part / wire schematics checked (AI_SCHEMATIC_CHECK) ------------------------------------------------
ok("ohms(): 220 ohm, 4.7 k, 4k7, 1 M, 330R, 10 kΩ", K.ohms("220 ohm") === 220 && K.ohms("4.7 k") === 4700 && K.ohms("4k7") === 4700 && K.ohms("1 M") === 1e6 && K.ohms("330R") === 330 && K.ohms("10 kΩ") === 10000);
ok("e12(): the next value up", K.e12(467) === 470 && K.e12(100) === 100 && K.e12(101) === 120 && K.e12(8.6) === 10 && Math.abs(K.e12(1075) - 1200) < 1e-9);
var pl = make(sch("LED", ["part B1 battery \"9 V\"", "part D1 diode \"red LED\"", "wire B1 D1", "wire D1 B1"]), "Draw an LED on a 9 V battery");
ok("a part / wire LED with no resistor gets one, sized and said, and drawn", pl.ok && pl.plan.parts.some(function (p) { return p.type === "resistor"; }) &&
  /Lantern added R1 \(470 Ω\) in series with D1: an LED needs a resistor to limit its current/.test(pl.summary) && pl.plan.said.length === 1, pl.summary);
var ps = make(sch("LED", ["part B1 battery \"9 V\"", "part R1 resistor \"100 ohm\"", "part D1 led", "wire B1 R1", "wire R1 D1", "wire D1 B1"]), "Draw an LED circuit");
ok("...its resistor sized too small goes back, the drawing shown", !ps.ok && ps.plan && /R1 \(100 Ω\) lets about 70 mA through D1 from 9 V/.test(ps.problems[0]), ps.problems);
var sh = make(sch("Short", ["part B1 battery \"12 V\"", "part S1 switch", "part L1 lamp", "wire B1 S1", "wire S1 B1", "wire B1 L1", "wire L1 B1"]), "Draw a lamp circuit");
ok("a switch across the battery is a short: it goes back, saying which part and why", !sh.ok && sh.plan && /B1 is shorted: current can go from one end of B1 back to the other through S1 alone/.test(sh.problems[0]), sh.problems);
var am = make(sch("Meter", ["part B1 battery \"12 V\"", "part R1 resistor \"6 ohm\"", "part A1 ammeter", "wire B1 R1", "wire R1 B1", "wire R1 A1", "wire A1 R1"]), "Draw a circuit with an ammeter");
ok("an ammeter across a resistor goes back: it goes in series", !am.ok && am.problems.some(function (p) { return /A1 is across .*R1: an ammeter goes in series/.test(p); }), am.problems);
var vm = make(sch("Meter", ["part B1 battery \"12 V\"", "part R1 resistor \"6 ohm\"", "part V2 voltmeter", "wire B1 R1", "wire R1 V2", "wire V2 B1"]), "Draw a circuit with a voltmeter");
ok("a voltmeter in series goes back: it goes across", !vm.ok && /V2 is in series with the circuit: a voltmeter goes across what it measures/.test(vm.problems[0]), vm.problems);
var good = make(sch("Meters", ["part V1 battery \"12 V\"", "part A1 ammeter", "part R1 resistor \"6 ohm\"", "part M1 volt meter", "wire V1 A1", "wire A1 R1", "wire R1 V1", "wire R1 M1", "wire M1 R1"]), "");
ok("an ammeter in series and a voltmeter across the resistor pass", good.ok, good.problems);
var loose = make(sch("Lamp", ["part B1 battery", "part S1 switch", "part L1 lamp", "wire B1 S1", "wire L1 S1", "wire L1 B1"]), "Draw a lamp circuit");
ok("a loop written with one wire backwards (each part with two wires) is no short", loose.ok, loose.problems);

ok("no page errors", !errs.length, errs);
console.log(fails ? fails + " ELECTRONICS TESTS FAILED (" + passes + " passed)" : "ALL ELECTRONICS TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
