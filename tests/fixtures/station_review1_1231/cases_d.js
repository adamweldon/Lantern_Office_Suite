// cases_d.js -- D: AI_CONTROL's new rule: a duplex MAKE CONTROL (an alternating relay between two pumps) written with
// NO floats gets the usual four (off, lead on, lag on, high level alarm), added and said. Checked: the circuit it makes
// works (simulated), the addition is said; right circuits that have floats, pressure or temperature switches, or that
// are not pumps in a wet well are left as 1.24.30 left them (ad0d654, built beside it), or at least not given a wet
// well's floats. Rule 7: an alternator between two motors can be compressors, fans, boosters, chilled-water or boiler
// pumps; the rule acts only when it can be nothing but a wet well's pumps.
"use strict";
var H = require("./lib.js");
function ctl(lines, t) { return H.blk("CONTROL", t || "Duplex", lines); }
var LQ = "Draw the control circuit for a duplex lift station with an alternating relay";
var P2 = ["alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'];
function now(c) { return H.build(ctl(c.lines), c.q); }
function before(c) { return H.OLD().aiAct.build(ctl(c.lines), c.q); }
function floatsAdded(r) { return !!(r && r.plan && r.plan.circuit && (r.plan.circuit.added || []).some(function (s) { return /^the floats FS1 \(off\), FS2 \(lead on\), FS3 \(lag on\) and FS4 \(high level alarm\)/.test(s); })); }
// the duplex with the four added floats works (sim.duplex), and the addition is said in the summary
function works(r, extra) {
  if (!r || !r.ok) return "not drawn: " + (r ? (r.problems || []).join("; ") : "");
  if (!floatsAdded(r) || !/Lantern added the floats FS1 \(off\), FS2 \(lead on\), FS3 \(lag on\) and FS4 \(high level alarm\)/.test(r.summary)) return "the four floats not added, or not said";
  var c = r.plan.circuit, al = H.alarmLamps(c, ["FS4"]);
  var out = H.sim.duplex(c, { floats: { off: "FS1", lead: "FS2", lag: "FS3", alarm: "FS4" }, pumps: ["M1", "M2"], alarms: al, runLamps: H.runLamps(c), ols: H.olsOf(c) });
  return out.join("; ") || (extra ? extra(r) : "");
}
function D(id, harm, q, lines, right, judge) {
  return { id: id, harm: harm, input: { question: q, block: lines }, q: q, lines: lines, right: right, run: function () { return judge(now(this), this); } };
}
// as 1.24.30 drew it (or sent it back with the same words)
function same(r, c) { var a = H.sig(r), b = H.sig(before(c)); return a === b ? "" : "differs from 1.24.30: " + a.replace(/\n/g, " / ").slice(0, 300) + " (1.24.30: " + b.replace(/\n/g, " / ").slice(0, 300) + ")"; }
// not given a wet well's floats
function noFloats(r) { return floatsAdded(r) ? "a wet well's four floats added to it: " + r.plan.circuit.added.filter(function (s) { return /^the floats FS1/.test(s); })[0].slice(0, 200) : ""; }
var cases = [
  // ---- the rule's own case: it must work ------------------------------------------------------------------------
  D("D-01", "high", LQ, P2, "The 2B's duplex with no floats: the four added, from the bottom up, wired (a lead call held in to the off float, the pumps taking turns, the lag running both, the alarm light at FS4), and said.", function (r) { return works(r); }),
  D("D-02", "high", LQ, ["alternator AR M1 M2", "coil M1", "coil M2"], "Coils with no labels.", function (r) { return works(r); }),
  D("D-03", "medium", LQ, P2.concat(['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green']), "With run lights: they follow their pumps.", function (r) { return works(r); }),
  D("D-04", "medium", LQ, ['supply "24 V AC"'].concat(P2), "With a control voltage.", function (r) { return works(r, function (x) { return x.plan.circuit.rails[0] === "24 V AC" ? "" : "rails " + x.plan.circuit.rails; }); }),
  D("D-05", "medium", LQ, P2.concat(['horn AH1 "high level"']), "A horn written with no float: it sounds at the added alarm float FS4, not all the time and not never.",
    function (r) { return works(r, function (x) { var c = x.plan.circuit, g = c.rungs.filter(function (k) { return k.out.id === "AH1"; })[0]; if (!g) return "no horn"; return g.series.concat(g.starts).some(function (e) { return e.id === "FS4"; }) ? "" : "AH1 is not on FS4: " + H.sig({ ok: true, plan: { circuit: { rungs: [g] } } }); }); }),
  D("D-06", "low", LQ, P2.concat(['lamp LT3 AR "pump 1 leading"']), "A light on the alternating relay: lit while pump 1 leads.", function (r) { return works(r); }),
  D("D-07", "medium", "Draw the control circuit for a duplex sump pump with an alternating relay", P2, "A duplex sump: the same four floats.", function (r) { return works(r); }),
  D("D-08", "medium", "Draw the ladder diagram for a duplex sewage pump station", ["alternating AR M1 M2", 'starter M1 "pump 1"', 'starter M2 "pump 2"'], "'alternating' and 'starter' lines (the 35B's words).", function (r) { return works(r); }),
  // ---- circuits with floats: as 1.24.30 -----------------------------------------------------------------------
  D("D-09", "high", LQ, ['float FS1 "off"', 'float FS2 "lead on"'].concat(P2), "Two floats: nothing added, as 1.24.30.", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-10", "high", LQ, ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"'].concat(P2), "The four written: as 1.24.30.", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-11", "medium", LQ, ['level LS1 "off"', 'level LS2 "lead on"'].concat(P2), "Floats written 'level': nothing added, as 1.24.30.", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-12", "medium", LQ, ['float FS1 "off"'].concat(P2), "One float (no start float): still asked for the start float, nothing added.",
    function (r, c) { return noFloats(r) || (!r.ok && /need a float to start them/.test(r.problems.join(" ")) ? "" : "not asked for the start float: " + (r.problems || []).join("; ")); }),
  D("D-13", "medium", LQ, ['float FS1 "high level alarm"'].concat(P2), "Only an alarm float: asked for the off and lead floats, nothing added.", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-14", "medium", LQ, ["start PB1 M1"].concat(P2), "A start button on a pump: questioned as 1.24.30.", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-15", "medium", LQ, ["alternator AR M1 M2 M3", "coil M1", "coil M2", "coil M3"], "Three pumps on one alternator: questioned as 1.24.30.", function (r, c) { return noFloats(r) || same(r, c); }),
  // ---- pressure and temperature: as 1.24.30 -----------------------------------------------------------------------
  D("D-16", "high", "Draw the control circuit for a duplex air compressor with an alternating relay", ["pressure PS1 M1", "alternator AR M1 M2", 'coil M1 "compressor 1 starter"', 'coil M2 "compressor 2 starter"'],
    "Compressors on a pressure switch: questioned as 1.24.30 (no floats).", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-17", "high", "Draw the control circuit for two boiler pumps that alternate", ['temp TS1 "thermostat"', "alternator AR M1 M2", "coil M1", "coil M2"], "Thermostat: as 1.24.30.",
    function (r, c) { return noFloats(r) || same(r, c); }),
  // ---- an alternator that is not a wet well's: no floats -----------------------------------------------------------
  D("D-18", "medium", "Draw the control circuit for two air compressors that alternate using an alternating relay", ["alternator AR M1 M2", 'coil M1 "compressor 1"', 'coil M2 "compressor 2"'],
    "Two air compressors and an alternator, no switch written: not a wet well, so not its floats -- questioned (a pressure switch to start them), as for the pressure switch. Not: the four floats of a wet well (off, lead on, lag on, high level alarm) added to two air compressors.", function (r) { return noFloats(r); }),
  D("D-19", "medium", "Draw the control circuit for a duplex booster pump set with an alternating relay", ["alternator AR M1 M2", 'coil M1 "booster pump 1"', 'coil M2 "booster pump 2"'],
    "Booster pumps run on pressure: no wet well floats added.", function (r) { return noFloats(r); }),
  D("D-20", "medium", "Draw the control for two chilled water pumps that take turns each week", ["alternator AR M1 M2", 'coil M1 "chilled water pump 1"', 'coil M2 "chilled water pump 2"'],
    "Chilled water pumps: no wet well floats.", function (r) { return noFloats(r); }),
  D("D-21", "medium", "Draw a control circuit for two exhaust fans that take turns, switched by a timer", ['timer TR1 "24 h"', "alternator AR M1 M2", 'coil M1 "fan 1 starter"', 'coil M2 "fan 2 starter"'],
    "Two fans on a timer: no wet well floats (the timer questioned is right; the floats behind it are not).", function (r, c) {
      // the floats are added before the timer is questioned: build again with the timer wired, to see what is drawn
      var r2 = H.build(ctl(['timer TR1 "24 h"', "start PB1 TR1", "alternator AR M1 M2", 'coil M1 "fan 1 starter"', 'coil M2 "fan 2 starter"']), c.q);
      return noFloats(r) || noFloats(r2);
    }),
  D("D-22", "low", "Draw the control circuit for a duplex air compressor with an alternating relay", ['switch PS1 "pressure switch"', "alternator AR M1 M2", 'coil M1 "compressor 1 starter"', 'coil M2 "compressor 2 starter"'],
    "A pressure switch written as 'switch PS1 \"pressure switch\"': a pressure switch, so no floats (as for 'pressure PS1').", function (r, c) {
      var r2 = H.build(ctl(['switch PS1 CR9 "pressure switch"', "alternator AR M1 M2", 'coil M1 "compressor 1 starter"', 'coil M2 "compressor 2 starter"']), c.q);
      return noFloats(r) || noFloats(r2);
    }),
  D("D-23", "low", "Draw a control circuit for two vacuum pumps that alternate", ['vacuum VS1 "vacuum switch"', "alternator AR M1 M2", 'coil M1 "vacuum pump 1"', 'coil M2 "vacuum pump 2"'],
    "Vacuum pumps on a vacuum switch Lantern does not draw: the switch questioned, and no wet well floats behind it.", function (r, c) {
      var r2 = H.build(ctl(["alternator AR M1 M2", 'coil M1 "vacuum pump 1"', 'coil M2 "vacuum pump 2"']), c.q);
      return noFloats(r) || noFloats(r2);
    }),
  // ---- plain circuits with no alternator: as 1.24.30 ---------------------------------------------------------------
  D("D-24", "high", "Draw a ladder diagram for a motor starter with start and stop buttons", ["stop PB1 M1", "start PB2 M1", 'coil M1 "motor starter"'], "A motor starter: as 1.24.30.", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-25", "high", "Draw the control for two pumps, each with its own start and stop buttons", ["stop PB1 M1", "start PB2 M1", "stop PB3 M2", "start PB4 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'],
    "Two pumps with their own buttons: as 1.24.30, no floats.", function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-26", "medium", "Draw a forward reverse motor control circuit with interlocks", ["stop PB1", "start PB2 M1", "start PB3 M2", 'coil M1 "forward"', 'coil M2 "reverse"'], "Forward and reverse: as 1.24.30.",
    function (r, c) { return noFloats(r) || same(r, c); }),
  D("D-27", "medium", "Draw a control circuit for a sump pump with a float switch", ['float FS1 M1', 'coil M1 "sump pump"'], "One float, one pump: as 1.24.30.", function (r, c) { return noFloats(r) || same(r, c); }),
  // ---- the 2B's own rows of 1.24.30 --------------------------------------------------------------------------------
  { id: "D-28", harm: "high", input: { question: H.ADAM_Q, path: "aiAct.solve", replies: ["the 2B's floatless duplex, as it wrote it"] },
    right: "The bench's lift station answered with a floatless duplex: drawn with the four floats, and (a station question) read as the station: passes.",
    run: function () {
      var item = H.L().aiBenchQuestions.filter(function (x) { return x.id === "make-liftstation"; })[0];
      return H.solve(item.q, [ctl(["alternator AR M1 M2", 'coil M1 "Pump 1"', 'coil M2 "Pump 2"', 'lamp LT1 M1 "Pump 1 Running"', 'lamp LT2 M2 "Pump 2 Running"'], "2 Pump Lift Station")]).then(function (s) {
        var g = H.L().aiBench.grade(item, s.out.text, s.out); return g.pass ? "" : g.why;
      });
    } }
];
module.exports = cases;
