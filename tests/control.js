// control.js -- control circuits (relays, contactors, push buttons, pilot
// lights) made correct by construction (1.18.0). The AI names each device
// and what it switches (MAKE CONTROL); Lantern draws the US ladder: a rung
// per coil or light between L1 and L2, stops in series, starts in parallel
// with the coil's holding contact (added and said), the coil at the right
// and its overload after it, numbered rungs and each coil's contacts listed
// by rung. A stop for a self-holding circuit, a starter's overload, the
// interlocks between forward and reverse and a coil a start names are added
// and said; what cannot be placed goes back with the line to write. The
// wires are walked: no rung can join L1 to L2 through contacts alone, every
// coil and light sits between the rails, every contact has its coil.
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
var L = w.Lantern, C = L.aiControl, act = L.aiAct;
var item = L.aiBenchQuestions.filter(function (q) { return q.id === "make-control"; })[0];
function make(text, q) { return act.build(text, q || item.q); }
function blk(title, lines) { return "MAKE CONTROL: " + title + "\n" + lines.join("\n") + "\nEND"; }
function walk(text) { var b = act.find(text)[0], c = C.circuit(C.parse(b)); return { c: c, lay: c.problems.length ? null : C.layout(c, b.title) }; }
function rung(r, id) { return r.plan.circuit.rungs.filter(function (x) { return x.out.id === id; })[0]; }

// --- what the AI is told ---------------------------------------------------------------------
var pc = act.prompt(item.q), pl = act.prompt("Write a PLC ladder program for a start/stop motor with a seal-in"), pe = act.prompt("Draw a circuit with a 12 V battery, a switch and a lamp");
ok("a control question gets MAKE CONTROL: devices and what they switch, never wires", /MAKE CONTROL: <title>/.test(pc) && /start PB2 M1/.test(pc) && /Never write wires/.test(pc) &&
  /For a PLC program write MAKE CODE instead/.test(pc) && !/part <ID> <type>/.test(pc), pc.slice(0, 600));
ok("...its example is not the bench question (no start, stop or holding contact in it)", !/\b(start|stop)\b/.test(pc.split("For example:")[1]), pc.split("For example:")[1]);
ok("a PLC program question is not a drawing of one", !C.asks("Write a PLC ladder program for a start/stop motor with a seal-in") && /MAKE CODE/.test(pl) && !/MAKE CONTROL/.test(pl));
ok("asks(): starters, relays, seal-ins and pilot lights; not air, oil, programs or electronics", C.asks(item.q) && C.asks("Show the wiring for a forward/reverse contactor with interlocks") &&
  !C.asks("Draw a pneumatic circuit with a push button") && !C.asks("Draw an Arduino driving a relay through a transistor") && !/MAKE CONTROL/.test(pe));
ok("the schematic action is offered for a control question that does not say draw", act.relevant("wiring for a motor starter with a seal-in contact").some(function (a) { return a.id === "schematic"; }));

// --- the bench question ---------------------------------------------------------------------------
var ideal = make(item.ideal), g = L.aiBench.grade(item, item.ideal, { made: ideal });
ok("the bench's model answer is MAKE CONTROL, and passes", /^MAKE CONTROL/.test(item.ideal) && g.pass, g.why);
var least = make(blk("Starter", ["start PB2 M1", "lamp LT1 M1"]));
ok("...the least the AI can write (a start and a light) passes too: Lantern adds the coil, the holding contact, a stop and the overload, and says so",
  least.ok && L.aiBench.grade(item, "x", { made: least }).pass && /Lantern added the starter coil M1 that PB2 switches; M1’s holding contact across PB2/.test(least.summary) &&
  /a stop PB1 for M1 \(a circuit that holds itself in needs one\); the overload contact OL1 in M1’s rung/.test(least.summary), least.summary);
var noLamp = make(blk("Starter", ["stop PB1", "start PB2 M1", "coil M1"]));
ok("...without the pilot light it fails, and says what is missing", /no pilot light/.test(L.aiBench.grade(item, "x", { made: noLamp }).why), L.aiBench.grade(item, "x", { made: noLamp }).why);
var lampOff = make(blk("Starter", ["stop PB1", "start PB2 M1", "coil M1", "lamp LT1 M1 off"]));
ok("...a light on while the motor is off fails", /no pilot light/.test(L.aiBench.grade(item, "x", { made: lampOff }).why));
var roles = make("MAKE SCHEMATIC: Starter\nstop PB1\nstart PB2 M1\ncoil M1 \"motor starter\"\nlamp LT1 M1\nEND");
ok("device lines in a MAKE SCHEMATIC block are a control circuit", roles.ok && roles.plan.mode === "control" && L.aiBench.grade(item, "x", { made: roles }).pass, roles.problems);
var old = make("MAKE SCHEMATIC: Motor control\npart PB1 switch \"stop\"\npart PB2 switch \"start\"\npart M1 inductor \"coil\"\nwire PB1 PB2\nwire PB2 M1\nEND");
ok("the part / wire form for a control question goes back: write MAKE CONTROL, and how", !old.ok && /this is a control circuit: write it as MAKE CONTROL/.test(old.problems[0]), old.problems);
ok("...while a lamp circuit in part / wire form is still a schematic", make("MAKE SCHEMATIC: Lamp\npart B1 battery\npart S1 switch\npart L1 lamp\nwire B1 S1\nwire S1 L1\nwire L1 B1\nEND", "Draw a lamp circuit").ok);

// --- the rungs ------------------------------------------------------------------------------------------
var r1 = rung(ideal, "M1");
ok("rung 1: the stop in series, the start with M1's holding contact across it, the coil, the overload after it", r1.n === 1 && r1.stops[0].id === "PB1" && r1.stops[0].nc &&
  r1.starts[0].id === "PB2" && !r1.starts[0].nc && r1.seal && r1.after[0].kind === "ol" && r1.after[0].nc, r1);
var l1 = rung(ideal, "LT1");
ok("rung 2: the pilot light through M1's open contact", l1.n === 2 && l1.series[0].kind === "contact" && l1.series[0].of === "M1" && !l1.series[0].nc, l1);
ok("what each rung does is said", /Press PB2 \(start\): M1 \(motor starter\) pulls in and its own contact holds it in; PB1 \(stop\) or OL1 \(overload\) drops it out/.test(ideal.summary) &&
  /LT1 \(run\) lights while M1 is on/.test(ideal.summary), ideal.summary);
var x = walk(item.ideal), bad = C.verify(x.c, x.lay);
ok("the wires walked: no short, every coil and light between the rails, the holding contact across the start", !bad.length, bad);
function swap(lay, f) { return { shapes: lay.shapes, parts: lay.parts, els: lay.els.map(function (e) { var c = {}; Object.keys(e).forEach(function (k) { c[k] = e[k]; }); return f(c) || c; }) }; }
ok("the walk catches a rung that shorts L1 to L2 (its coil taken out of the walk)", C.verify(x.c, swap(x.lay, function (e) { if (e.id === "LT1") e.load = false; })).some(function (p) { return /joins L1 to L2 through contacts alone/.test(p); }));
ok("...a coil in series with a light", C.verify(x.c, swap(x.lay, function (e) { if (e.id === "LT1") { e.a = "L1"; e.b = x.lay.els.filter(function (k) { return k.id === "M1" && k.load; })[0].a; } })).some(function (p) { return /is not between L1 and L2/.test(p); }));
ok("...a holding contact not across its start", C.verify(x.c, swap(x.lay, function (e) { if (e.kind === "contact" && e.of === "M1" && !e.nc && e.b !== x.lay.els.filter(function (k) { return k.id === "LT1"; })[0].a) e.b = "nX"; })).some(function (p) { return /holding contact is not across its start/.test(p); }));
var labels = x.lay.shapes.filter(function (s) { return s.t === "text"; }).map(function (s) { return s.s; });
ok("the rails are L1 and L2, the rungs numbered, M1's contacts listed by rung", labels.indexOf("L1") >= 0 && labels.indexOf("L2") >= 0 && labels.indexOf("1") >= 0 && labels.indexOf("2") >= 0 && labels.indexOf("NO 1, 2") >= 0, labels);
var dcx = walk(blk("DC", ["supply \"24 V DC\"", "start PB2 CR1", "relay CR1"])), dl = dcx.lay.shapes.filter(function (s) { return s.t === "text"; }).map(function (s) { return s.s; });
ok("24 V DC: the rails are + and 0 V, the supply said above them", dl.indexOf("+") >= 0 && dl.indexOf("0 V") >= 0 && dl.indexOf("24 V DC") >= 0, dl);

// --- what Lantern adds, changes, and says ---------------------------------------------------------------
var fr = make(blk("Forward and reverse", ["stop PB1", "start PB2 M1", "start PB3 M2", "coil M1 \"forward\"", "coil M2 \"reverse\""]));
ok("forward and reverse: each coil gets the other's closed contact, said", fr.ok && rung(fr, "M1").series.some(function (e) { return e.of === "M2" && e.nc; }) &&
  rung(fr, "M2").series.some(function (e) { return e.of === "M1" && e.nc; }) && /Lantern added the interlocks: M2’s closed contact in M1’s rung/.test(fr.summary), fr.summary);
ok("...one stop for two motors is drawn in L1 ahead of every rung, said, with how to stop just one", fr.plan.circuit.feed.some(function (f) { return f.id === "PB1"; }) &&
  /PB1 stops everything: it is drawn in L1 ahead of every rung \(name a coil to stop just one: stop PB1 M1\)/.test(fr.summary), fr.summary);
var il = make(blk("Hoist", ["start PB2 M1", "start PB3 M2", "stop PB1 M1", "stop PB4 M2", "coil M1", "coil M2", "interlock M1 M2"]));
ok("an interlock written is drawn both ways", rung(il, "M1").series.some(function (e) { return e.of === "M2" && e.nc; }) && rung(il, "M2").series.some(function (e) { return e.of === "M1" && e.nc; }));
var es = make(blk("Two motors", ["estop ES1", "fuse FU1", "start PB2 M1", "stop PB1 M1", "start PB4 M2", "stop PB3 M2", "coil M1 \"pump\"", "coil M2 \"fan\""]));
ok("an emergency stop and a fuse are drawn in L1 ahead of every rung; the e-stop drops every coil out", es.ok && es.plan.circuit.feed.map(function (f) { return f.id; }).join() === "ES1,FU1" &&
  /ES1 \(emergency stop, in L1\), PB1 \(stop\) or OL1 \(overload\) drops it out/.test(es.summary) && /ES1 \(emergency stop, in L1\), PB3 \(stop\) or OL2 \(overload\) drops it out/.test(es.summary), es.summary);
var two = make(blk("Two stations", ["stop PB1 M1", "stop PB3 M1", "start PB2 M1", "start PB4 M1", "coil M1 \"conveyor\""]));
ok("two stations: the stops in series, the starts side by side with the holding contact", rung(two, "M1").stops.length === 2 && rung(two, "M1").starts.length === 2 &&
  /Press PB2 \(start\) or PB4 \(start\)/.test(two.summary) && /PB1 \(stop\), PB3 \(stop\) or OL1 \(overload\) drops it out/.test(two.summary), two.summary);
var tm = make(blk("Delayed start", ["supply \"24 V DC\"", "stop PB1 CR1", "start PB2 CR1", "relay CR1 \"run\"", "timer TR1 \"5 s\" CR1", "coil M1 TR1 \"conveyor\"", "horn AH1 CR1 TR1 off \"warning\""]));
ok("a timer: its coil on a rung, its timed contacts where they are named (open, and closed with off)", tm.ok && rung(tm, "M1").series[0].timed && !rung(tm, "M1").series[0].nc &&
  rung(tm, "AH1").series.some(function (e) { return e.of === "TR1" && e.timed && e.nc; }) && /M1 \(conveyor\) is on while TR1 has timed out \(5 s\)/.test(tm.summary) &&
  /AH1 \(warning\) is on while CR1 is on and TR1 has not timed out/.test(tm.summary), tm.summary);
var lp = make(blk("Pressure", ["pressure PS1 nc", "relay CR1 PS1", "limit LS1 SOL1", "solenoid SOL1 CR1"]));
ok("switches named either way round, closed when said, once each", lp.ok && rung(lp, "CR1").series.length === 1 && rung(lp, "CR1").series[0].nc &&
  rung(lp, "SOL1").series.map(function (e) { return e.id; }).join() === "LS1,CR1", lp.plan && lp.plan.circuit.rungs);
var lab = make(blk("Labels", ["coil M1 \"motor starter\" CR1", "relay CR1 SS1", "switch SS1"]));
ok("words in quotes are kept as written (“motor starter” is not read as a device)", lab.ok && /M1 \(motor starter\)/.test(lab.summary), lab.summary);

// --- what goes back to the AI ------------------------------------------------------------------------------
var r = make(blk("Wires", ["wire PB1 M1", "start PB2 M1"]));
ok("a wire line goes back: Lantern wires the rungs", !r.ok && /never write wires -- Lantern wires each rung/.test(r.problems[0]), r.problems);
r = make(blk("Lonely", ["coil CR1 \"relay\""]));
ok("a coil nothing switches goes back, with the lines to write", !r.ok && /CR1 has nothing switching it, so it would be on whenever there is power: add what turns it on, like: start PB2 CR1, or a contact of another coil on its line: coil CR1 M1/.test(r.problems[0]), r.problems);
r = make(blk("Who", ["start PB2", "coil M1", "coil M2"]));
ok("a start that names no coil, with two to choose from, goes back with the line to write", !r.ok && /start PB2: name the coil or light it switches, like: start PB2 M1/.test(r.problems.join("|")), r.problems);
r = make(blk("Lamp contact", ["lamp LT1", "coil M1 LT1"]));
ok("a contact of a light (lights have none) goes back", !r.ok && /a lamp has no contacts -- name the coil that switches it/.test(r.problems.join("|")), r.problems);
r = make(blk("Missing", ["lamp LT1 CR7"]));
ok("a contact of a coil that is not drawn goes back", !r.ok && /LT1 names CR7, which is not drawn: add a line for it/.test(r.problems.join("|")), r.problems);
r = make(blk("Jog", ["jog PB5 M1", "coil M1"]));
ok("something Lantern does not draw yet is said so, with what it draws", !r.ok && /is not something Lantern draws yet \(it draws: stop, start/.test(r.problems[0]), r.problems);
var ft = act.fixText(make(blk("Two wrongs", ["wire PB1 M1", "lamp LT1 CR7"])), item.q);
ok("the correction turn: numbered problems and the MAKE CONTROL lines", /^Lantern checked your MAKE CONTROL block and found \d things to fix:\n1\. /.test(ft) && /Lantern reads a MAKE CONTROL block line by line/.test(ft) &&
  /start PB2 M1 {5,}a start push button/.test(ft), ft);

// --- Draw: the ladder symbols in the Electrical palette ----------------------------------------------------
var em = L.drawModes.filter(function (m) { return m.id === "electrical"; })[0], names = em.symbols.map(function (s) { return s.label; });
ok("Draw's Electrical palette has the ladder symbols, before Label", ["Contact NO", "Contact NC", "Push button NO", "Push button NC", "E-stop", "Limit switch NO", "Overload contact", "Relay coil", "Pilot light"].every(function (l) {
  return names.indexOf(l) >= 0 && names.indexOf(l) < names.indexOf("Label"); }), names);
ok("...each stamps a shape 60 px wide end to end", ["contact", "button", "toggle", "limit", "overload", "coil", "lamp", "solenoid", "horn", "fuse"].every(function (k) {
  var s = L.ladderSym[k](100, 100, "#000", {}); return s.g.t === "group" && s.ports.a[0] === 70 && s.ports.b[0] === 130; }));
var no = L.ladderSym.button(0, 0, "#000", {}), nc = L.ladderSym.button(0, 0, "#000", { nc: true });
ok("a push button's bridge is above its terminals when open, below when closed", no.g.shapes.some(function (s) { return s.t === "path" && s.pts[0][1] === -9 && s.pts[1][1] === -9; }) &&
  nc.g.shapes.some(function (s) { return s.t === "path" && s.pts[0][1] === 5 && s.pts[1][1] === 5; }));

ok("no page errors", !errs.length, errs);
console.log(fails ? fails + " CONTROL TESTS FAILED (" + passes + " passed)" : "ALL CONTROL TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
