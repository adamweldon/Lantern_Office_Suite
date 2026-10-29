// hydraulic.js -- hydraulic circuits made correct by construction (1.17.0).
// The AI names the parts and what each does (MAKE HYDRAULIC), never a pipe;
// Lantern pipes them the one right way (each valve's P to the pump line, T
// to a tank, A to the cap end and B to the rod end), adds what is missing
// and says so, changes what cannot work and says so, and walks the pipes as
// a check. The older MAKE SCHEMATIC hydraulic form (the 35B's pump -> valve
// -> cylinder -> tank, drawn before with the return teed straight to tank)
// is piped the same way. The bench checks the circuit, not just its parts.
// The new ISO symbols are in Draw's Hydraulics palette; pilot lines dashed.
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
var L = w.Lantern, H = L.aiHydraulic, act = L.aiAct;
function make(text, q) { return act.build(text, q || "Draw a hydraulic circuit"); }
function circ(text) { return make(text).plan.circuit; }
var Q = "Draw a hydraulic circuit: a pump takes oil from a tank and feeds a cylinder through a valve, and the oil returns to the tank.";

// --- what the AI is told ---------------------------------------------------------------------
var ph = act.prompt(Q), pe = act.prompt("Draw a circuit with a 12 V battery, a switch and a lamp");
ok("a hydraulic question gets MAKE HYDRAULIC: parts and what they do, never pipes", /MAKE HYDRAULIC: <title>/.test(ph) && /Never write pipes or ports/.test(ph) &&
  /valve V1 C1 4\/3/.test(ph) && !/part <ID> <type>/.test(ph), ph.slice(0, 400));
ok("an electrical question does not hear about hydraulics", /MAKE SCHEMATIC/.test(pe) && !/MAKE HYDRAULIC/.test(pe) && !/Hydraulic:/.test(pe) && !/hydraulic/i.test(pe), pe.slice(0, 600));
ok("pneumatics are not hydraulics", !H.asks("Draw a pneumatic circuit with a compressor, a valve and a cylinder") && H.asks(Q) && H.asks("Draw a ram with a pump and a valve"));

// --- the bench question ---------------------------------------------------------------------------
var item = L.aiBenchQuestions.filter(function (q) { return q.id === "make-hydraulic"; })[0];
var g = L.aiBench.grade(item, item.ideal, { made: make(item.ideal, item.q) });
ok("the bench's model answer is MAKE HYDRAULIC, and passes", /^MAKE HYDRAULIC/.test(item.ideal) && g.pass, g.why);
var r35 = make("MAKE SCHEMATIC: Hydraulic Pump and Cylinder Circuit\nmode hydraulic\npart P1 pump \"Hydraulic Pump\"\npart V1 valve \"Directional Control Valve\"\n" +
  "part C1 cylinder \"Hydraulic Cylinder\"\npart T1 tank \"Oil Tank\"\nwire T1 P1\nwire P1 V1\nwire V1 C1\nwire C1 T1\nEND", item.q);
ok("the 35B's old block (pump -> valve -> cylinder -> tank) is piped by Lantern: a 4/3 working C1, both ports", r35.ok && r35.plan.circuit.verified &&
  r35.plan.circuit.acts[0].id === "C1" && r35.plan.circuit.acts[0].valve.id === "V1" && r35.plan.circuit.acts[0].valve.way === "4/3", [r35.problems, r35.plan && r35.plan.circuit]);
ok("...the bench passes it, and Chat says Lantern added the relief valve", L.aiBench.grade(item, "x", { made: r35 }).pass && /Lantern added the relief valve R1/.test(r35.summary), r35.summary);
var old = make("MAKE SCHEMATIC: Pump, valve and cylinder\nmode hydraulic\npart T1 tank\npart P1 pump\npart V1 valve\npart C1 cylinder\nwire T1 P1\nwire P1 V1\nwire V1 C1\nwire V1 T1\nEND");
ok("the old model answer (the tank wired to a two-port valve) is piped right too", old.ok && old.plan.circuit.verified, old.problems);
ok("an older test's block still builds as a hydraulic circuit", make("MAKE SCHEMATIC: Press\npart P1 pump\npart V1 valve\npart C1 cylinder\npart T1 tank\nwire T1 P1\nwire P1 V1\nwire V1 C1\nwire V1 T1\nEND", "").plan.mode === "hydraulic");
ok("a schematic of pneumatics or electrics is left to the schematic builder", make("MAKE SCHEMATIC: Air\npart K1 compressor\npart V1 valve\npart C1 cylinder\nwire K1 V1\nwire V1 C1\nEND", "").plan.mode === "pneumatic" &&
  make("MAKE SCHEMATIC: Lamp\npart B1 battery\npart L1 lamp\nwire B1 L1\nwire L1 B1\nEND", "").plan.mode === "electrical");

// --- the pipes, walked ------------------------------------------------------------------------------------
var press = "MAKE HYDRAULIC: Press\npump P1 \"20 L/min\"\nrelief R1 \"150 bar\"\ncylinder C1 double \"press ram\"\nvalve V1 C1 4/3 tandem solenoid\nflow F1 C1 extend meter-out\ngauge G1\nEND";
var b = act.find(press)[0], cc = H.circuit(H.parse(b)), lay = H.layout(cc, "Press");
ok("the press: verified -- P on the pump line, T to tank, A and B to the cylinder, no line to tank but the relief", H.verify(cc, lay).length === 0, H.verify(cc, lay));
function has(pairs, a, z) { return pairs.some(function (p) { return (p[0] === a && p[1] === z) || (p[0] === z && p[1] === a); }); }
ok("...V1.P to the pressure line, V1.T to a tank of its own, C1.A from V1.A, the relief between the line and a tank", has(lay.pipes, "V1.P", "PL") &&
  lay.pipes.some(function (p) { return p[0] === "V1.T" && /^TK\d+\.P$/.test(p[1]); }) && has(lay.pipes, "V1.A", "C1.A") && has(lay.pipes, "PL", "R1.in") &&
  lay.pipes.some(function (p) { return p[0] === "R1.out" && /^TK/.test(p[1]); }), lay.pipes);
ok("...the flow control meters C1's extend stroke on the rod side (B), letting oil back freely", has(lay.pipes, "V1.B", "F1.a") && has(lay.pipes, "F1.b", "C1.B"), lay.pipes);
var bad1 = { pipes: lay.pipes.concat([["C1.A", "TK1.P"]]), parts: lay.parts };
ok("verify catches a cylinder line run straight to tank (what the old drawing did)", H.verify(cc, bad1).some(function (s) { return /C1’s A line runs straight to tank/.test(s); }), H.verify(cc, bad1));
var bad2 = { pipes: lay.pipes.filter(function (p) { return p[0] !== "V1.P"; }), parts: lay.parts };
ok("...and a valve whose P is not on the pump line", H.verify(cc, bad2).some(function (s) { return /V1’s P is not on the pressure line/.test(s); }));
var bad3 = { pipes: lay.pipes.concat([["PL", "TK1.P"]]), parts: lay.parts };
ok("...and the pump's outlet to tank", H.verify(cc, bad3).some(function (s) { return /pump’s outlet runs straight to tank/.test(s); }));
ok("the drawing has dashed pilot lines (relief, solenoid-free) and dots where lines join", JSON.stringify(lay.shapes).indexOf("\"d\":[6,4]") >= 0 &&
  lay.shapes.some(function (s) { return s.t === "circle" && s.f; }));

// --- defaults, changes, problems --------------------------------------------------------------------------------
var c1 = circ("MAKE HYDRAULIC: Bare\ncylinder C1\nEND");
ok("only a cylinder: Lantern adds the pump, the relief valve and a 4/3 for it (a tandem centre: one valve unloads the pump at rest)",
  c1.acts[0].valve.way === "4/3" && c1.acts[0].valve.centre === "tandem" && /valve V1 for C1/.test(c1.added.join()) && /relief valve/.test(c1.added.join()), c1);
var c2 = circ("MAKE HYDRAULIC: Lift\ncylinder C1 single \"lift\"\nvalve V1 C1 4/3 lever\nEND");
ok("a single-acting cylinder gets a 3/2, and Lantern says why", c2.acts[0].single && c2.acts[0].valve.way === "3/2" && /V1 is a 3\/2/.test(c2.changed.join()), c2);
var c3 = circ("MAKE HYDRAULIC: Two\ncylinder C1 double\ncylinder C2 double\nvalve V1 C1 4/3 tandem\nvalve V2 C2 4/3 open\nEND");
ok("two valves on one pump line: tandem and open centres become closed, and Lantern says why", c3.acts.every(function (a) { return a.valve.centre === "closed"; }) &&
  /would send all the pump’s oil to tank/.test(c3.changed.join()), c3);
var c4 = circ("MAKE HYDRAULIC: Meter in\ncylinder C1 double\nvalve V1 C1\nflow F1 C1 extend meter-in\ncheck K1 C1\nEND");
ok("meter-in on extend sits on the cap side (A), the pilot-operated check nearest the cylinder", c4.acts[0].inline.A.join() === "check K1,flow F1" && !c4.acts[0].inline.B.length, c4.acts[0].inline);
var c5 = circ("MAKE HYDRAULIC: Words\ndouble acting cylinder C1 \"ram\"\npilot operated check valve K1 C1\nhydraulic motor M1\ndirectional valve V2 M1 4/3 float pilot\nvalve C1 4/2 solenoid\nelectric motor E1\ntank T1\nEND");
ok("names people use: double acting cylinder, pilot operated check valve, hydraulic motor, directional valve, a valve named by its cylinder only",
  c5.acts.length === 2 && c5.acts[0].valve.way === "4/2" && c5.acts[0].valve.act === "solenoid" && c5.acts[1].type === "motor" && c5.acts[1].valve.centre === "float" &&
  c5.acts[0].inline.A[0] === "check K1", c5);
function probs(text) { return make(text).problems.join(" | "); }
ok("two valves for one cylinder is a problem for the AI to fix", /C1 has two valves/.test(probs("MAKE HYDRAULIC: x\ncylinder C1\nvalve V1 C1\nvalve V2 C1\nEND")));
ok("a valve for a cylinder that is not there", /names C9, which is not a cylinder or motor/.test(probs("MAKE HYDRAULIC: x\ncylinder C1\nvalve V1 C9\nEND")));
ok("no cylinder or motor at all", /there is no cylinder or motor/.test(probs("MAKE HYDRAULIC: x\npump P1\nEND")));
ok("a part Lantern does not draw yet is named, with what it draws", /sequence valve S1.*not a part Lantern draws yet.*it draws: pump, relief/.test(probs("MAKE HYDRAULIC: x\ncylinder C1\nsequence valve S1 C1\nEND")),
  probs("MAKE HYDRAULIC: x\ncylinder C1\nsequence valve S1 C1\nEND"));
ok("MAKE SCHEMATIC with the new lines and no mode is hydraulic too", make("MAKE SCHEMATIC: x\npump P1\ncylinder C1 double\nvalve V1 C1\nEND").plan.circuit.verified);

// --- Draw: the palette, dashed lines -------------------------------------------------------------------------------
var hm = L.drawModes.filter(function (m) { return m.id === "hydraulic"; })[0], labels = hm.symbols.map(function (s) { return s.label; });
ok("Draw's Hydraulics palette has the ISO valves and the rest, Label still last", ["Valve 4/3", "Valve 4/3 tandem", "Valve 4/2", "Valve 3/2", "Cylinder, spring return", "Motor, two ways",
  "Relief valve", "Check valve", "Flow control", "Electric motor", "Accumulator"].every(function (x) { return labels.indexOf(x) >= 0; }) && labels[labels.length - 1] === "Label", labels);
var NEW = /^(Valve \d|Cylinder, spring|Motor, two|Relief|Check|Flow control|Electric|Accumulator)/;
ok("each new symbol makes a shape group", hm.symbols.filter(function (s) { return NEW.test(s.label); }).length === 11 && hm.symbols.filter(function (s) { return NEW.test(s.label); }).every(function (s) { var o = s.make(100, 100, "#000"); return o && o.t === "group" && o.shapes.length; }));
var dashes = [], ctx = new Proxy({}, { get: function (t, k) { if (k === "setLineDash") return function (d) { dashes.push(d.join(",")); }; if (k in t) return t[k]; return function () {}; }, set: function (t, k, v) { t[k] = v; return true; } });
L.drawShapes.render(ctx, { t: "group", shapes: [{ t: "path", c: "#000", w: 2, pts: [[0, 0], [10, 0]], d: [6, 4] }, { t: "path", c: "#000", w: 2, pts: [[0, 0], [10, 0]] }] });
ok("Draw draws a dashed line dashed, and the next one solid again", dashes.join("|") === "6,4|", dashes);

ok("no page errors", errs.length === 0, errs);
console.log(fails ? "HYDRAULIC FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL HYDRAULIC TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
