// givens_1236.js -- Lantern's givens (1.24.36, Adam 2026-11-24: "Lantern should contain givens for any typical, well known
// process assemblies ... in a way that makes the AI's answer being correct the path of least resistance. This does not mean
// that we get a typical drawing no matter what"). The control givens: a question that fits one gets it, fitted to the
// question, in place of the instructions' example; one that fits none gets the instructions as before.
"use strict";
var path = require("path");
var load = require(path.join(__dirname, "fixtures", "liftstation_review1_1230", "load.js"));
var SRC = process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html");
var passes = 0, fails = 0;
function ok(name, cond, info) { if (cond) { passes++; console.log("ok   " + name); } else { fails++; console.log("FAIL " + name + (info !== undefined ? "\n     " + JSON.stringify(info).slice(0, 1500) : "")); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
(async function () {
  var o = load(SRC), L = o.L;
  await sleep(80); await L.ai.detect();
  var G = L.givens, act = L.aiAct;
  ok("boot clean; the givens are there", o.errs.length === 0 && G && G.all("CONTROL").length >= 7, o.errs);
  function given(q) { var p = act.prompt(q), at = p.indexOf("Lantern’s tested circuit for this"); return at < 0 ? null : p.slice(p.indexOf("MAKE CONTROL:", at), p.indexOf("\nEND", at) + 4); }
  function made(q) { var b = given(q); return b ? act.build(b, q) : null; }
  function lines(q) { var b = given(q); return b ? b.split("\n") : []; }
  // each given, fitted, builds clean
  var CASES = [
    ["Draw the control circuit for a motor starter with start and stop push buttons and a run light", "control-starter", ["stop PB1 M1", "start PB2 M1", "coil M1 \x22motor starter\x22", "overload OL1 M1", "lamp LT1 M1 \x22run\x22 green"]],
    ["Draw a start/stop circuit for a pump contactor with a light that is on while the pump is stopped", "control-starter", ["coil M1 \x22pump contactor\x22", "lamp LT1 M1 off \x22stopped\x22 red"]],
    ["Draw a 3-wire start stop control for a conveyor that can be started and stopped from two locations, 24 V DC", "control-starter", ["supply \x2224 V DC\x22", "stop PB2 M1 \x22stop, remote\x22", "start PB4 M1 \x22start, remote\x22"]],
    ["Draw a forward/reverse motor control circuit with interlocks", "control-reversing", ["interlock M1 M2", "overload OL1 M1 M2", "start PB3 M2 \x22reverse\x22"]],
    ["Draw a ladder diagram where conveyor 2 can only start after conveyor 1 is running", "control-sequence", ["coil M2 M1 \x22conveyor 2 starter\x22", "stop PB1 M1 \x22conveyor 1 stop\x22", "stop PB2 M2 \x22conveyor 2 stop\x22"]],
    ["Draw a control circuit for a motor that starts 30 seconds after the start button is pressed, with a warning horn", "control-delayed-start", ["timer TR1 \x2230 s\x22 CR1", "coil M1 TR1 \x22motor starter\x22", "horn AH1 CR1 TR1 off \x22warning\x22"]],
    ["Draw the control circuit for an air compressor with a pressure switch that cuts out at 120 psi", "control-compressor", ["pressure PS1 M1 nc \x22cut-out 120 psi\x22"]],
    ["Draw the control circuit for a pump that fills a tank with a float switch", "control-fill", ["float FS1 M1 nc \x22tank full\x22"]],
    ["Draw the control circuit for a sump pump with a float switch", "control-sump", ["float FS1 M1 \x22pump on\x22"]]];
  CASES.forEach(function (c) {
    var g = G.match("CONTROL", c[0]), ls = lines(c[0]), m = made(c[0]);
    ok(c[1] + ": “" + c[0].slice(0, 70) + "…” gets it, fitted, and it is made clean", g && g.id === c[1] && c[2].every(function (l) { return ls.indexOf(l) >= 0; }) && m && m.ok && !(m.problems || []).length,
      [g && g.id, ls, m && m.problems]);
  });
  // a pressure switch that cuts out, and a float that stops a fill, are drawn normally closed; a sump's float normally open
  var cp = made(CASES[6][0]), fl = made(CASES[7][0]), sp = made(CASES[8][0]);
  function el(m, kind) { var out = []; (m && m.plan && m.plan.circuit ? m.plan.circuit.rungs : []).forEach(function (r) { Object.keys(r).forEach(function (k) { if (Array.isArray(r[k])) r[k].forEach(function (e) { if (e && e.kind === kind) out.push(e); }); }); }); return out; }
  ok("the compressor's pressure switch and the fill pump's float are normally closed (they open as it rises); the sump's float normally open", el(cp, "pressure").every(function (e) { return e.nc; }) && el(cp, "pressure").length &&
    el(fl, "float").every(function (e) { return e.nc; }) && el(fl, "float").length && el(sp, "float").every(function (e) { return !e.nc; }) && el(sp, "float").length);
  // no given where none fits: the instructions and their own example, as before
  ["Draw a motor starter with a jog button", "Draw a two-speed motor control circuit", "Draw a star-delta starter", "Write a PLC ladder program for a start/stop motor with a seal-in",
   "Draw the control circuit for a duplex lift station with an alternating relay", "Draw a relay circuit that turns on a light when a door opens", "Draw a pneumatic circuit with a push button and a cylinder"].forEach(function (q) {
    ok("no given: “" + q + "”", !given(q), given(q));
  });
  var base = act.prompt("Draw a relay circuit that turns on a light when a door opens"), withG = act.prompt(CASES[0][0]);
  ok("with a given the example is the given, said above it; the instructions' lines stay", /MAKE CONTROL: Sump pump/.test(base) && !/MAKE CONTROL: Sump pump/.test(withG) && /write it as it stands, changing only what the question asks:\nMAKE CONTROL: Motor starter/.test(withG) &&
    /start PB2 M1 {2,}a start push button/.test(withG), withG.slice(0, 600));
  // (the review) fitted word by word: no light where none is asked, the stopped light where it is, the stations asked for,
  // the control voltage (not the motor's), what the motor drives, an e-stop
  function has(q, l) { return lines(q).indexOf(l) >= 0; }
  ok("no light for \u201cno pilot light needed\u201d, a stopped light for one that \u201cgoes out when the motor runs\u201d, none of Lantern\u2019s for a trip light",
    !lines("Draw a start/stop motor starter circuit, no pilot light needed").some(function (l) { return /^lamp/.test(l); }) &&
    has("Draw a start/stop motor starter with a pilot light that goes out when the motor runs", "lamp LT1 M1 off \x22stopped\x22 red") &&
    !lines("Draw a start/stop motor starter circuit with an overload trip light").some(function (l) { return /^lamp/.test(l); }));
  ok("three start/stop stations: three stops and three starts; \u201cbetween two stations\u201d is one",
    has("Draw a motor starter control circuit with three start/stop stations", "stop PB3 M1 \x22stop 3\x22") && has("Draw a motor starter control circuit with three start/stop stations", "start PB6 M1 \x22start 3\x22") &&
    has("Draw a start/stop motor starter for a conveyor that carries parts between two stations", "start PB2 M1"));
  ok("a 480 V motor with a 120 V control transformer: supply 120 V AC; a 460V motor alone: no supply line; 24VDC as one word read",
    has("Draw the control circuit for a 480 V motor starter with a 120 V control transformer, start and stop buttons", "supply \x22120 V AC\x22") &&
    !lines("Draw the motor starter circuit for a 460V 3-phase motor").some(function (l) { return /^supply/.test(l); }) && has("Draw a 24VDC start stop circuit for a motor contactor", "supply \x2224 V DC\x22"));
  ok("no given for two-wire control, hand-off-auto, a drive, Y-delta, a lighting contactor, an off-delay, a refrigeration cut-out, fill and drain, or an explanation",
    ["Draw a two-wire control circuit for a motor starter with a thermostat", "Draw a motor starter with a hand-off-auto switch", "Draw the control circuit for a VFD with start/stop push buttons",
     "Draw a Y-delta motor starter control circuit", "Draw a start/stop circuit for a lighting contactor", "Draw a control circuit where a fan keeps running 5 minutes after the burner shuts off, using a time delay relay",
     "Draw the control circuit for a refrigeration compressor with a low pressure switch that cuts out at 20 psi", "Draw a control circuit that fills a tank and then drains it",
     "Explain how a three-wire start/stop circuit works"].every(function (q) { return !given(q); }));
  ok("an e-stop asked for is in the starter; a sump's high water alarm is its own float and light, not a \u201cpump on\u201d light",
    has("Draw the control circuit for a 3-phase motor starter with start/stop push buttons, an e-stop, and a run light", "estop ES1") &&
    has("Draw the control circuit for a sump pump with a high water alarm", "float FS2 \x22high level alarm\x22") && has("Draw the control circuit for a sump pump with a high water alarm", "lamp LT1 FS2 \x22high water\x22 red"));
  // the delayed start's overload drops the run relay too, so a reset never restarts the motor by itself
  var dl = made("Draw a control circuit for a motor that starts 30 seconds after the start button is pressed, with a warning horn"), crR = dl && dl.plan ? dl.plan.circuit.rungs.filter(function (r) { return r.out.id === "CR1"; })[0] : null;
  ok("the delayed start's overload is in the run relay\u2019s rung as well as the motor\u2019s", crR && crR.after.some(function (e) { return e.id === "OL1"; }), crR);
  // a fill on two floats, both normally closed: the low one starts it, the high one stops it, and it holds itself in
  var f2 = made("Draw the control circuit for a pump that fills a tank with a high and a low float"), fr = f2 && f2.plan ? f2.plan.circuit.rungs.filter(function (r) { return r.out.id === "M1"; })[0] : null;
  ok("a fill on a low and a high float: its own given, drawn held in (the low float a start, the high a stop, M1\u2019s holding contact), and said",
    fr && fr.seal && fr.starts.some(function (e) { return e.id === "FS1" && e.nc; }) && fr.stops.some(function (e) { return e.id === "FS2" && e.nc; }) && /holds itself in between/.test(f2.summary || ""), [fr, f2 && f2.summary]);
  // the reversing given's one stop for both: ahead of every rung, as written, with nothing to correct
  var rv = made(CASES[3][0]);
  ok("stop PB1 all: one stop ahead of both rungs, and no correction said under the given", rv && rv.plan && rv.plan.circuit.feed.some(function (f) { return f.id === "PB1"; }) && !/stops everything/.test(rv.summary || ""), rv && rv.summary);
  // a user's given that is not made right is not added, and cannot break the prompt
  ok("a given whose asks is not a test is refused, and the prompt still builds", G.add({ id: "x-bad", kind: "CONTROL", asks: "start stop", block: function () { return ["coil M1"]; } }) === null &&
    /MAKE CONTROL/.test(act.prompt(CASES[0][0])));
  // the bench: only its two motor starters fit a given, and their model answers pass as before
  var Q = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []), hit = Q.filter(function (x) { return given(x.q); }).map(function (x) { return x.id; }).sort().join(",");
  ok("of every bench question, the two motor starters get a given", hit === "make-control,make-control-b", hit);
  var g1 = null;
  for (var i = 0; i < Q.length; i++) if (/^make-control(-b)?$/.test(Q[i].id)) { var out = await act.solve(Q[i].q, seq([Q[i].ideal])); g1 = L.aiBench.grade(Q[i], out.text, out); if (!g1.pass) break; var gv = await act.solve(Q[i].q, seq([given(Q[i].q)])); var g2 = L.aiBench.grade(Q[i], gv.text, gv); ok(Q[i].id + ": the ideal passes, and so does the given copied as it stands", g1.pass && g2.pass, [g1, g2]); }
  console.log(fails ? fails + " GIVENS 1.24.36 FAILURES (" + passes + " passed)" : "ALL GIVENS 1.24.36 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
