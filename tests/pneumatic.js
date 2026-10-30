// pneumatic.js -- pneumatic circuits made correct by construction (1.18.0),
// the way hydraulic ones are (hydraulic.js). The AI names the parts and
// what each does (MAKE PNEUMATIC): cylinders, the valves working them, the
// push buttons and rollers whose air signals work those valves -- never a
// line or a port number. Lantern draws the ISO 1219 circuit: supply and
// service unit at the bottom, each valve's 1 on the supply line, 4 and 2 to
// the cylinder, 3 and 5 to exhaust, each signal to 14 or 12, two signals on
// one side through a shuttle (OR) or two-pressure (AND) valve -- never teed.
// What the AI leaves out it gets by default and is told; what cannot work
// is changed and said, or goes back to the AI with the line to write. The
// lines are walked as a check, and what each signal does is said under the
// drawing. When Lantern questions a block, the correction turn lists each
// problem and how Lantern reads that kind of block (AI_ACTIONS fixText).
// Since 1.18.1 the circuit is also set against the question (a return at the
// end of the stroke, a cycle, two hands), from a 35B's bench reply.
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
var L = w.Lantern, P = L.aiPneumatic, act = L.aiAct;
var QP = "Draw a pneumatic circuit";
function make(text, q) { return act.build(text, q || QP); }
function circ(text) { return make(text).plan.circuit; }
function blk(title, lines) { return "MAKE PNEUMATIC: " + title + "\n" + lines.join("\n") + "\nEND"; }
function walk(text) { var b = act.find(text)[0], c = P.circuit(P.parse(b)); return { c: c, lay: P.layout(c, b.title) }; }

// --- what the AI is told ---------------------------------------------------------------------
var item = L.aiBenchQuestions.filter(function (q) { return q.id === "make-pneumatic"; })[0];
var pp = act.prompt(item.q), pe = act.prompt("Draw a circuit with a 12 V battery, a switch and a lamp"), ph = act.prompt("Draw a hydraulic circuit with a pump, a valve and a cylinder");
ok("a pneumatic question gets MAKE PNEUMATIC: parts and what they do, never lines or port numbers", /MAKE PNEUMATIC: <title>/.test(pp) && /Never write lines or port numbers/.test(pp) &&
  /roller S3 C1 extended/.test(pp) && /button S1 V1/.test(pp) && !/part <ID> <type>/.test(pp) && !/MAKE HYDRAULIC/.test(pp), pp.slice(0, 500));
ok("...its example is not the bench question (the bench asks for what the example does not show)", !/roller/.test(pp.split("For example:")[1]) && /flow F1 C1 extend/.test(pp.split("For example:")[1]));
ok("an electrical question hears about neither air nor oil", /MAKE SCHEMATIC/.test(pe) && !/pneumatic|compressor|exhaust/i.test(pe) && !/hydraulic/i.test(pe), pe.slice(0, 700));
ok("a hydraulic question gets MAKE HYDRAULIC, not MAKE PNEUMATIC", /MAKE HYDRAULIC/.test(ph) && !/MAKE PNEUMATIC/.test(ph));
ok("asks(): air is pneumatic; oil is not", P.asks(item.q) && P.asks("Draw a circuit with a compressor and an air cylinder") && P.asks("show a 5/2 valve working a cylinder") &&
  !P.asks("Draw a hydraulic circuit with a pump") && !L.aiHydraulic.asks(item.q));

// --- the bench question ---------------------------------------------------------------------------
var g = L.aiBench.grade(item, item.ideal, { made: make(item.ideal, item.q) });
ok("the bench's model answer is MAKE PNEUMATIC, and passes", /^MAKE PNEUMATIC/.test(item.ideal) && g.pass, g.why);
var noRet = make(blk("Push", ["cylinder C1 double", "valve V1 C1 5/2", "button S1 V1"]), item.q);
ok("...a push button alone (nothing returns the cylinder at the end of its stroke) is drawn, but questioned against the question, with the roller line (1.18.1)",
  !noRet.ok && noRet.plan && noRet.preview && noRet.problems.length === 1 && /returns only when S1 is let go \(V1\u2019s spring\)/.test(noRet.problems[0]) && /-- roller S2 C1 extended --/.test(noRet.problems[0]) &&
  /^Lantern still questions it: the question asks for C1 to return by itself/.test(L.aiBench.grade(item, "x", { made: noRet }).why), noRet.problems);
var hand = make(blk("Push", ["cylinder C1 double", "valve V1 C1 5/2 button", "roller S2 C1 extended"]), item.q);
ok("...a valve worked by its own push button, returned by the roller, passes too", hand.ok && L.aiBench.grade(item, "x", { made: hand }).pass && hand.plan.circuit.acts[0].valve.left === "button" &&
  hand.plan.circuit.acts[0].valve.right === "pilot", hand.plan && hand.plan.circuit.acts[0]);

// --- 1.18.1: the bench run on 1.18.0 (a 35B, tests/fixtures/bench_run_1180_35b.json) -- a right circuit for
// another question: hold to extend, spring return, when the question asks for a return at the end of the stroke.
// Lantern drew it and said what it does, but never set that against the question. Now it does, and the block
// goes back once, its drawing shown, with the line to add.
var RUN = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1180_35b.json"), "utf8"));
var r35 = RUN.rows.filter(function (r) { return r.id === "make-pneumatic"; })[0], m35 = make(r35.reply, item.q);
ok("the 35B's block (hold to extend, spring return) is drawn and said as what it does", m35.plan && m35.preview &&
  /C1 extends while V1\u2019s push button is held; the spring returns V1 and C1 retracts when let go/.test(m35.summary), m35.summary);
ok("...and questioned against the question: it returns when the button is let go, not at the end of its stroke; the roller line is given", !m35.ok && m35.problems.length === 1 &&
  /^the question asks for C1 to return by itself at the end of its stroke, but it returns only when V1\u2019s push button is let go \(V1\u2019s spring\): add a roller valve C1 trips when fully out -- roller S1 C1 extended --/.test(m35.problems[0]), m35.problems);
ok("...the bench fails it as questioned", /^Lantern still questions it: the question asks for C1/.test(L.aiBench.grade(item, r35.reply, { made: m35 }).why));
var fixed35 = r35.reply.replace("flow F1", "roller S1 C1 extended\nflow F1"), f35 = make(fixed35, item.q);
ok("...that one line added, it passes: V1 holds until the roller sends it back", f35.ok && L.aiBench.grade(item, fixed35, { made: f35 }).pass &&
  /S1 \(roller, C1 fully out\) switches it back: C1 retracts \(V1 stays put between signals\)/.test(f35.summary), [f35.problems, f35.summary]);
ok("...the 35B's block for a hold-to-extend question is not questioned",
  make(r35.reply, "Draw a pneumatic circuit: a push button extends a double-acting cylinder while it is held, and the cylinder retracts when the button is let go.").ok);
ok("...nor a single-acting cylinder that returns by itself on its spring",
  make(blk("Spring", ["cylinder C1 single", "valve V1 C1 3/2 button"]), "Draw a pneumatic circuit where a single-acting cylinder extends when a button is pressed and returns by itself.").ok);
var QC = "Draw a pneumatic circuit where a double-acting cylinder keeps going back and forth on its own after a start button is pressed.";
var cy1 = make(blk("Cycle", ["cylinder C1 double", "valve V1 C1 5/2 pilot", "button S1 V1", "roller S2 C1 extended"]), QC);
ok("asked to keep going back and forth: a roller at one end only is questioned, with the other end's line", !cy1.ok && cy1.problems.length === 1 &&
  /keep going back and forth, which needs a roller at each end: add roller S3 C1 retracted \(sends it out again\)$/.test(cy1.problems[0]), cy1.problems);
var cy2 = make(blk("Cycle", ["cylinder C1 double", "valve V1 C1 5/2 pilot", "button S1 V1", "roller S2 C1 extended", "roller S3 C1 retracted"]), QC);
ok("...with both, it is drawn unquestioned", cy2.ok, cy2.problems);
var QT = "Draw a two-hand safety pneumatic circuit: both push buttons must be pressed together to extend a cylinder.";
var th1 = make(blk("Two hand", ["cylinder C1 double", "valve V1 C1 5/2 pilot", "button S1 V1", "button S2 V1"]), QT);
ok("asked for both buttons together: either one working the valve (a shuttle) is questioned, with the and to write", !th1.ok &&
  /either one works the valve here: write and on the second button\u2019s line \(button S2 V1 and\)/.test(th1.problems[0]), th1.problems);
var th2 = make(blk("Two hand", ["cylinder C1 double", "valve V1 C1 5/2 pilot", "button S1 V1", "button S2 V1 and"]), QT);
ok("...with and, the two-pressure valve is drawn, unquestioned", th2.ok && /two-pressure valve V2/.test(th2.summary), th2.summary);
var oldForm = make("MAKE SCHEMATIC: Air\nmode pneumatic\npart K1 compressor \"6 bar\"\npart V1 valve \"5/2 solenoid\"\npart C1 cylinder\npart E1 exhaust\nwire K1 V1\nwire V1 C1\nwire V1 E1\nEND", QP);
ok("the older MAKE SCHEMATIC pneumatic form is piped by Lantern: a 5/2 solenoid valve working C1", oldForm.ok && oldForm.plan.mode === "pneumatic" && oldForm.plan.circuit.verified &&
  oldForm.plan.circuit.acts[0].valve.way === "5/2" && oldForm.plan.circuit.acts[0].valve.left === "solenoid", oldForm.problems);
ok("...the test of 1.12 (compressor, valve, cylinder) still makes a pneumatic plan", make("MAKE SCHEMATIC: Air\npart K1 compressor\npart V1 valve\npart C1 cylinder\nwire K1 V1\nwire V1 C1\nEND", "").plan.mode === "pneumatic");
var roles = make("MAKE SCHEMATIC: Air clamp\ncylinder C1 double\nvalve V1 C1 5/2 button\nEND", QP);
ok("role lines in a MAKE SCHEMATIC block, asked about air, are pneumatic", roles.ok && roles.plan.mode === "pneumatic", roles.problems);

// --- the lines, walked ------------------------------------------------------------------------------------
var CIRCUITS = {
  semi: blk("Push to extend, automatic return", ["cylinder C1 double", "valve V1 C1 5/2", "button S1 V1", "roller S2 C1 extended"]),
  or: blk("Two places", ["cylinder C1 double", "valve V1 C1 5/2", "button S1 V1", "button S2 V1"]),
  and: blk("Two hands", ["cylinder C1 double", "valve V1 C1 5/2", "button S1 V1 \"left hand\"", "button S2 V1 and \"right hand\""]),
  home: blk("Home and end", ["cylinder C1 double", "valve V1 C1 5/2", "button S1 V1", "roller S2 C1 retracted", "roller S3 C1 extended", "flow F1 C1 extend", "flow F2 C1 retract"]),
  twelve: blk("Two returns", ["cylinder C1 double", "valve V1 C1 5/2", "button S1 V1", "button S2 V1 return", "roller S3 C1 extended"]),
  seq: blk("Clamp then drill", ["cylinder A1 double \"clamp\"", "cylinder B1 double \"drill\"", "valve V1 A1 5/2", "valve V2 B1 5/2", "button S1 V1", "roller S2 A1 extended V2", "roller S3 B1 extended"]),
  single: blk("Punch", ["cylinder C1 single \"punch\"", "button S1 C1", "flow F1 C1 extend"]),
  sol53: blk("Lift", ["supply \"6 bar\"", "cylinder C1 double \"lift\"", "valve V1 C1 5/3 closed solenoid"]),
  motor: blk("Winch", ["motor M1 \"winch\"", "valve V1 M1 lever"]),
  festo: blk("ISO names", ["cylinder 1A1 double", "valve 1V1 1A1 5/2", "push button valve 1S1 1V1", "roller valve 1S2 1A1 extended"])
};
Object.keys(CIRCUITS).forEach(function (k) {
  var x = walk(CIRCUITS[k]), bad = P.verify(x.c, x.lay), r = make(CIRCUITS[k]);
  ok("verified, and made: " + k, !x.c.problems.length && !bad.length && r.ok && r.plan.circuit.verified, [x.c.problems, bad, r.problems]);
});
var semi = walk(CIRCUITS.semi);
function without(lay, a, b) { return { shapes: lay.shapes, parts: lay.parts, pipes: lay.pipes.filter(function (p) { return !(p[0] === a && p[1] === b); }) }; }
function plus(lay, a, b) { return { shapes: lay.shapes, parts: lay.parts, pipes: lay.pipes.concat([[a, b]]) }; }
ok("the walk catches a signal that does not reach its pilot port", P.verify(semi.c, without(semi.lay, "S1.2", "V1.14")).some(function (p) { return /S1 does not signal V1’s 14/.test(p); }), P.verify(semi.c, without(semi.lay, "S1.2", "V1.14")));
ok("...a valve's 1 off the supply line", P.verify(semi.c, without(semi.lay, "V1.1", "SL")).some(function (p) { return /V1’s 1 is not on the supply line/.test(p); }));
ok("...a cylinder port teed to the supply", P.verify(semi.c, plus(semi.lay, "C1.A", "SL")).some(function (p) { return /V1’s 4 runs straight to the supply or to exhaust/.test(p); }));
ok("...a pilot port on the supply line (always signalled)", P.verify(semi.c, plus(semi.lay, "V1.12", "SL")).some(function (p) { return /V1’s 12 is on the supply line/.test(p); }));
ok("...an exhaust blocked", P.verify(semi.c, { shapes: semi.lay.shapes, parts: semi.lay.parts, pipes: semi.lay.pipes.filter(function (p) { return p[0] !== "V1.3"; }) }).some(function (p) { return /V1’s 3 does not exhaust/.test(p); }));
ok("...two signals teed together", P.verify(semi.c, plus(semi.lay, "S1.2", "S2.2")).some(function (p) { return /teed together/.test(p); }));
var ports = semi.lay.pipes.map(function (p) { return p.join(">"); });
ok("the pipes: 4 to the cap end, 2 to the rod end, 3 and 5 to the air, the button to 14 and the roller to 12", ports.indexOf("V1.4>C1.A") >= 0 && ports.indexOf("V1.2>C1.B") >= 0 &&
  ports.indexOf("S1.2>V1.14") >= 0 && ports.indexOf("S2.2>V1.12") >= 0 && semi.lay.pipes.filter(function (p) { return /^V1\.[35]$/.test(p[0]) && /^EX/.test(p[1]); }).length === 2, ports);
ok("signal lines are dashed; working lines are not", semi.lay.shapes.some(function (s) { return s.t === "path" && s.d && s.w === 2; }) &&
  semi.lay.shapes.filter(function (s) { return s.t === "path" && s.w === 3; }).every(function (s) { return !s.d; }));
var oneA = semi.lay.parts.filter(function (p) { return p.id === "V1"; })[0];
ok("the valve's ports are numbered the ISO 5599 way: 4 above left, 2 above right; 5, 1, 3 below; 14 left, 12 right", oneA.ports["4"][0] < oneA.ports["2"][0] && oneA.ports["4"][1] < oneA.ports["1"][1] &&
  oneA.ports["5"][0] < oneA.ports["1"][0] && oneA.ports["1"][0] < oneA.ports["3"][0] && oneA.ports["14"][0] < oneA.ports["12"][0], oneA.ports);

// --- what Lantern adds, changes, and says ------------------------------------------------------------
var c = circ(CIRCUITS.semi);
ok("button to 14, the roller fully out to 12: a double-pilot valve, its spring left out", c.acts[0].valve.left === "pilot" && c.acts[0].valve.right === "pilot" && c.acts[0].valve.bistable &&
  c.acts[0].signals.some(function (s) { return s.id === "S2" && s.side === "12" && s.pos === "out"; }), c.acts[0]);
ok("...and what each signal does is said", /S1 \(push button\) switches V1: C1 extends; S2 \(roller, C1 fully out\) switches it back: C1 retracts/.test(c.steps[0]), c.steps);
var r = make(CIRCUITS.or);
ok("two buttons on one side: Lantern adds a shuttle valve and says so (and how to ask for both)", r.plan.circuit.acts[0].logic[0].kind === "or" && /Lantern added a shuttle valve V2 so S1 or S2 signals V1 \(write and on S2/.test(r.summary), r.summary);
ok("...never teed: each reaches one side of the shuttle", r.plan.wires.some(function (x) { return x[0] === "S1" && x[1] === "V2"; }) && r.plan.wires.some(function (x) { return x[0] === "S2" && x[1] === "V2"; }) &&
  r.plan.wires.some(function (x) { return x[0] === "V2" && x[1] === "V1"; }));
r = make(CIRCUITS.and);
ok("and on the second button: a two-pressure valve, both held", r.plan.circuit.acts[0].logic[0].kind === "and" && /while S1 \(push button\) and S2 \(push button\) are held/.test(r.summary), r.summary);
r = make(CIRCUITS.home);
ok("a start button with the home roller: AND (start only from home), said", r.plan.circuit.acts[0].logic[0].kind === "and" && /two-pressure valve V2 so V1 is signalled only with S1 and S2 together/.test(r.summary), r.summary);
ok("...meter-out flow controls: extend on the rod-end line, retract on the cap-end line", /flow F1 extend meter-out/.test(r.plan.circuit.acts[0].inline.B[0]) && /flow F2 retract meter-out/.test(r.plan.circuit.acts[0].inline.A[0]), r.plan.circuit.acts[0].inline);
r = make(CIRCUITS.single);
ok("single-acting: a 3/2 added and said; its signal port is 12; the extend speed metered in, said", r.ok && r.plan.circuit.acts[0].valve.way === "3/2" && /Lantern added a valve V1 for C1/.test(r.summary) &&
  /flow F1 extend meter-in/.test(r.plan.circuit.acts[0].inline.A[0]) && r.plan.wires.some(function (x) { return x[0] === "S1" && x[1] === "V1"; }), r.summary);
r = make(blk("Punch", ["cylinder C1 single", "valve V1 C1 3/2 button", "flow F1 C1 extend meter-out"]));
ok("...a meter-out flow control asked for a single-acting extend is metered in, and said why", /F1 meters the air going in \(meter-in\): C1 is single-acting/.test(r.summary), r.summary);
r = make(blk("Clamp", ["cylinder C1 double", "valve V1 C1 4/2 lever"]));
ok("a 4/2 for air is drawn as a 5/2, said", r.plan.circuit.acts[0].valve.way === "5/2" && /V1 is drawn as a 5\/2/.test(r.summary), r.summary);
r = make(blk("Clamp", ["cylinder C1 double", "valve V1 C1 3/2"]));
ok("a 3/2 on a double-acting cylinder is a 5/2, said", r.plan.circuit.acts[0].valve.way === "5/2" && /V1 is a 5\/2: C1 has two ports/.test(r.summary), r.summary);
r = make(blk("Lift", ["cylinder C1 double", "valve V1 C1 5/3 exhaust solenoid"]));
ok("a 5/3 solenoid valve: Y1 and Y2, spring centred, its centre said", r.plan.circuit.acts[0].valve.right === "solenoid" && /solenoid Y2 shifts it the other way: C1 retracts; at rest the springs centre V1 and C1 is free/.test(r.summary), r.summary);
r = make(blk("Winch", ["motor M1", "valve V1 M1 lever"]));
ok("an air motor gets a 5/3 (it can stop); its lever works both ways", r.plan.circuit.acts[0].valve.way === "5/3" && /V1’s lever one way: M1 turns one way; the other way: M1 turns the other way/.test(r.summary), r.summary);
r = make(blk("Seq", ["cylinder A1 double", "cylinder B1 double", "valve V1 A1 5/2", "valve V2 B1 5/2", "button S1 V1", "roller S2 A1 extended V2", "roller S3 B1 extended"]));
ok("a roller naming another valve starts it (14): a sequence", r.plan.circuit.acts[1].signals.some(function (s) { return s.id === "S2" && s.side === "14" && s.at === "A1"; }) &&
  r.plan.circuit.acts[1].signals.some(function (s) { return s.id === "S3" && s.side === "12"; }), r.plan.circuit.acts[1]);
r = make(blk("Push", ["cylinder C1 double", "roller S2 C1"]));
ok("a roller with no end named sits fully out, and Lantern says how to put it at the other end", /S2 sits where C1 is fully out \(write retracted/.test(r.summary), r.summary);
r = make(CIRCUITS.festo);
ok("ISO-style names (1A1, 1V1, 1S1) are kept", r.ok && r.plan.circuit.acts[0].id === "1A1" && r.plan.circuit.acts[0].valve.id === "1V1", r.problems);

// --- what goes back to the AI ------------------------------------------------------------------------------
r = make(blk("Wrong", ["pump P1", "cylinder C1 double"]));
ok("a pump in an air circuit goes back: it is hydraulic, and what to write instead", !r.ok && /a pump is hydraulic .* write MAKE HYDRAULIC/.test(r.problems[0]), r.problems);
r = L.aiAct.build("MAKE HYDRAULIC: Wrong\ncompressor K1\ncylinder C1 double\nEND", "Draw a hydraulic circuit");
ok("...and a compressor in an oil circuit: it is pneumatic, write MAKE PNEUMATIC", !r.ok && /a compressor is pneumatic .* write MAKE PNEUMATIC/.test(r.problems[0]), r.problems);
r = make(blk("No return", ["cylinder C1 double", "valve V1 C1 5/2 double pilot", "button S1 V1"]));
ok("a double-pilot valve nothing returns goes back, with lines to add", !r.ok && /V1 keeps its position \(double pilot\), but nothing returns it: add a signal, like: roller S2 C1 extended/.test(r.problems[0]), r.problems);
r = make(blk("Too many", ["cylinder C1 double", "valve V1 C1 5/2", "button S1 V1", "button S2 V1", "button S3 V1"]));
ok("three signals on one side go back", !r.ok && /V1’s 14 side has 3 signals/.test(r.problems[0]), r.problems);
r = make(blk("Who", ["cylinder C1 double", "cylinder C2 double", "button S1"]));
ok("a button that names no valve, with two to choose from, goes back with the line to write", !r.ok && /button S1: name the valve it works, like: button S1 V1/.test(r.problems.join("|")), r.problems);
r = make(blk("Single", ["cylinder C1 single", "button S1 V1", "button S2 V1 return"]));
ok("a return signal to a single-acting cylinder's valve goes back: its spring returns it", !r.ok && /S2 returns V1, but C1 is single-acting/.test(r.problems.join("|")), r.problems);
r = make(blk("Timer", ["cylinder C1 double", "timer T1 5 s"]));
ok("a part Lantern does not draw yet is said so, with what it does draw", !r.ok && /is not a part Lantern draws yet \(it draws: supply, cylinder/.test(r.problems[0]), r.problems);

// --- the correction turn: each problem, and how Lantern reads the block ---------------------------------------
var bad = make(blk("Two wrongs", ["pump P1", "cylinder C1 double", "button S1", "cylinder C2 double"]), item.q), ft = act.fixText(bad, item.q);
ok("fixText: numbered problems, the MAKE PNEUMATIC lines, the reply asked for", /^Lantern checked your MAKE PNEUMATIC block and found 2 things to fix:\n1\. /.test(ft) && /\n2\. /.test(ft) &&
  /Lantern reads a MAKE PNEUMATIC block line by line/.test(ft) && /roller S3 C1 extended/.test(ft) && /Reply with the corrected block only \(MAKE PNEUMATIC: Two wrongs \.\.\. END\)\.$/.test(ft), ft);
var hb = L.aiAct.build("MAKE HYDRAULIC: H\ncylinder C1 double\nvalve V1 C9 4/3\nEND", "Draw a hydraulic circuit"), ht = act.fixText(hb, "Draw a hydraulic circuit");
ok("...a hydraulic block gets the MAKE HYDRAULIC lines", /^Lantern checked your MAKE HYDRAULIC block: valve V1 names C9/.test(ht) && /Lantern reads a MAKE HYDRAULIC block/.test(ht) && /valve V1 C1 4\/3 tandem lever/.test(ht), ht);
var eb = L.aiAct.build("MAKE SCHEMATIC: Lamp\npart B1 battery\npart L1 lamp\nwire B1 L1\nEND", "Draw a lamp circuit"), et = act.fixText(eb, "Draw a lamp circuit");
ok("...an electrical schematic gets the part and wire lines", /Lantern reads a MAKE SCHEMATIC block/.test(et) && /wire <ID> <ID>/.test(et) && /Electrical types: battery/.test(et), et);
var db = L.aiAct.build("MAKE DRAWING: x\nrect 1 1\nEND", "draw a house"), dt = act.fixText(db, "draw a house");
ok("...a kind with no hint of its own gets its instruction lines (up to END)", /^Lantern checked your MAKE DRAWING block: /.test(dt) && /Lantern reads a MAKE DRAWING block like this:\nMAKE DRAWING: <title>/.test(dt) &&
  /rect X Y W H/.test(dt) && !/For example/.test(dt), dt);
(async function () {
  var sent = [], replies = [blk("Push to extend", ["pump P1", "cylinder C1 double", "valve V1 C1 5/2", "button S1 V1"]), item.ideal];
  var out = await act.solve(item.q, function (msgs) { sent.push(msgs.slice()); return Promise.resolve(replies.shift()); });
  var last = sent[1][sent[1].length - 1].content;
  ok("the bench's correction turn is fixText, and the corrected block passes", /a pump is hydraulic/.test(last) && /Lantern reads a MAKE PNEUMATIC block/.test(last) && out.fixed &&
    L.aiBench.grade(item, out.text, out).pass, last);
  sent = []; replies = [r35.reply, fixed35];
  var o35 = await act.solve(item.q, function (msgs) { sent.push(msgs.slice()); return Promise.resolve(replies.shift()); });
  var back35 = sent[1] ? sent[1][sent[1].length - 1].content : "";
  ok("bench: the 35B's block goes back once with the roller line, and the corrected one passes", o35.rounds === 2 && o35.fixed && /roller S1 C1 extended/.test(back35) &&
    /Lantern reads a MAKE PNEUMATIC block/.test(back35) && L.aiBench.grade(item, o35.text, o35).pass, [o35.rounds, o35.kind, back35.slice(0, 400)]);

  // --- Draw: the ISO pneumatic symbols in the palette ----------------------------------------------------
  var pm = L.drawModes.filter(function (m) { return m.id === "pneumatic"; })[0], labels = pm.symbols.map(function (s) { return s.label; });
  ok("Draw's Pneumatics palette has the ISO valves, supply, service unit, shuttle and two-pressure valves", ["Valve 5/2 button", "Valve 5/2 double pilot", "Valve 5/3 closed centre",
    "Valve 3/2 roller", "Air supply", "Service unit (FRL)", "Shuttle valve (OR)", "Two-pressure valve (AND)", "Air motor"].every(function (l) { return labels.indexOf(l) >= 0; }) &&
    labels[labels.length - 1] === "Label", labels);
  ok("...each stamps a shape", pm.symbols.filter(function (s) { return /^(Valve 5|Valve 3\/2 r|Air|Service|Shuttle|Two-)/.test(s.label); }).every(function (s) { var g = s.make(100, 100, "#000"); return g && g.t === "group" && g.shapes.length > 2; }));
  var sv = L.pneuSym.valve(0, 0, "#000", { way: "5/2", left: "pilot", right: "pilot" });
  ok("air pilots are open triangles (hydraulics fills them)", sv.g.shapes.some(function (s) { return s.t === "tri" && !s.f; }) && !sv.g.shapes.some(function (s) { return s.t === "tri" && s.f && s.pts[0][0] < -40; }));

  // --- hydraulics: a single-acting cylinder's extend speed is metered in (1.18.0) ----------------------------
  var hy = L.aiAct.build("MAKE HYDRAULIC: Jack\npump P1\ncylinder C1 single\nflow F1 C1 extend\nEND", "Draw a hydraulic circuit");
  ok("hydraulics: a single-acting cylinder's extend flow control meters in (free flow back down)", hy.ok && /flow F1/.test(hy.plan.circuit.acts[0].inline.A[0]) &&
    hy.plan.parts.some(function (p) { return p.id === "F1"; }), hy.problems);
  var hc = L.aiHydraulic.circuit(L.aiHydraulic.parse(act.find("MAKE HYDRAULIC: Jack\npump P1\ncylinder C1 single\nflow F1 C1 extend meter-out\nEND")[0]));
  ok("...a meter-out asked for there is changed and said", hc.acts[0].inline.A[0].free === "down" && hc.changed.some(function (x) { return /F1 meters the oil going in \(meter-in\)/.test(x); }), hc.changed);

  ok("no page errors", !errs.length, errs);
  console.log(fails ? fails + " PNEUMATIC TESTS FAILED (" + passes + " passed)" : "ALL PNEUMATIC TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
