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
    ["Draw a ladder diagram where conveyor 2 can only start after conveyor 1 is running", "control-sequence", ["coil M2 M1 \x22conveyor 2 starter\x22", "stop PB1 M1 M2"]],
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
  // the bench: only its two motor starters fit a given, and their model answers pass as before
  var Q = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []), hit = Q.filter(function (x) { return given(x.q); }).map(function (x) { return x.id; }).sort().join(",");
  ok("of every bench question, the two motor starters get a given", hit === "make-control,make-control-b", hit);
  var g1 = null;
  for (var i = 0; i < Q.length; i++) if (/^make-control(-b)?$/.test(Q[i].id)) { var out = await act.solve(Q[i].q, seq([Q[i].ideal])); g1 = L.aiBench.grade(Q[i], out.text, out); if (!g1.pass) break; var gv = await act.solve(Q[i].q, seq([given(Q[i].q)])); var g2 = L.aiBench.grade(Q[i], gv.text, gv); ok(Q[i].id + ": the ideal passes, and so does the given copied as it stands", g1.pass && g2.pass, [g1, g2]); }
  console.log(fails ? fails + " GIVENS 1.24.36 FAILURES (" + passes + " passed)" : "ALL GIVENS 1.24.36 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
