// cases_rules.js -- AI_CONTROL's two new pieces in 1.24.36: "stop PB1 all" ahead of every rung, said nowhere; and a fill
// on two normally closed floats held in between them. Where a rule must not act, the plan must be 1.24.35's (x.old).
// run(x) -> "" or what was seen. x: {build(text, q), buildOld(text, q), shape(made) -> a plan's rungs as text, sim, lib}
"use strict";
function blk(lines) { return "MAKE CONTROL: Test\n" + lines.join("\n") + "\nEND"; }
function same(x, lines, q) {
  var a = x.build(blk(lines), q), b = x.buildOld(blk(lines), q);
  var sa = x.shape(a), sb = x.shape(b);
  return sa === sb ? "" : "differs from 1.24.35:\n      now  " + sa + "\n      was  " + sb;
}
function feedIds(m) { return m && m.plan ? (m.plan.circuit.feed || []).map(function (f) { return f.id; }) : []; }
function notes(m) { return m && m.plan ? (m.plan.circuit.changed || []).concat(m.plan.circuit.added || []) : []; }
var FILLQ = "Draw a control circuit for a pump that fills a tank between a low and a high float";
module.exports = [
  // ---- stop ... all ---------------------------------------------------------------------------------------------------
  { id: "A-01", harm: "medium", why: "stop PB1 all with two starters: ahead of every rung, and no note telling the user to name a coil",
    run: function (x) {
      var m = x.build(blk(["stop PB1 all", "start PB2 M1", "start PB3 M2", "coil M1 \x22pump\x22", "coil M2 \x22fan\x22"]), "Draw a control circuit for a pump and a fan");
      if (!m.ok) return "not made: " + m.problems.join("; ");
      if (feedIds(m).indexOf("PB1") < 0) return "PB1 not ahead of every rung";
      var n = notes(m).filter(function (s) { return /PB1/.test(s); });
      return n.length ? "said: " + n[0] : "";
    } },
  { id: "A-02", harm: "low", why: "stop PB1 with no coil among two starters: as 1.24.35 (ahead of every rung, with the note)",
    run: function (x) { return same(x, ["stop PB1", "start PB2 M1", "start PB3 M2", "coil M1 \x22pump\x22", "coil M2 \x22fan\x22"], "Draw a control circuit for a pump and a fan"); } },
  { id: "A-03", harm: "medium", why: "stop PB1 all with one coil: pressing it stops the motor (in its rung or ahead of it, either is right)",
    run: function (x) {
      var m = x.build(blk(["stop PB1 all", "start PB2 M1", "coil M1 \x22motor starter\x22"]), "Draw a motor starter");
      if (!m.ok) return "not made: " + m.problems.join("; ");
      var S = x.sim(m); S.tap("PB2"); if (!S.on("M1")) return "M1 does not start"; S.tap("PB1");
      return S.on("M1") ? "PB1 does not stop M1" : "";
    } },
  { id: "A-04", harm: "medium", why: "STOP ALL in capitals (stop PB1 ALL): the same as all, never a device named ALL",
    run: function (x) {
      var m = x.build(blk(["stop PB1 ALL", "start PB2 M1", "start PB3 M2", "coil M1 \x22pump\x22", "coil M2 \x22fan\x22"]), "Draw a control circuit for a pump and a fan");
      if (!m.ok) return "not made: " + m.problems.join("; ");
      return feedIds(m).indexOf("PB1") >= 0 ? "" : "PB1 not ahead of every rung";
    } },
  { id: "A-05", harm: "medium", why: "stop PB1 all beside stop PB2 M2: PB1 ahead of every rung, PB2 in M2's rung only",
    run: function (x) {
      var m = x.build(blk(["stop PB1 all", "stop PB2 M2", "start PB3 M1", "start PB4 M2", "coil M1 \x22pump\x22", "coil M2 \x22fan\x22"]), "Draw a control circuit for a pump and a fan");
      if (!m.ok) return "not made: " + m.problems.join("; ");
      var S = x.sim(m); S.tap("PB3"); S.tap("PB4"); S.tap("PB2");
      if (!S.on("M1") || S.on("M2")) return "PB2 did not stop M2 alone";
      S.tap("PB4"); S.tap("PB1");
      return S.on("M1") || S.on("M2") ? "PB1 did not stop both" : "";
    } },
  { id: "A-06", harm: "low", why: "stop PB1 everything: the same as all",
    run: function (x) {
      var m = x.build(blk(["stop PB1 everything", "start PB2 M1", "start PB3 M2", "coil M1", "coil M2"]), "Draw a control circuit for two motors");
      return m.ok && feedIds(m).indexOf("PB1") >= 0 && !notes(m).some(function (s) { return /PB1/.test(s); }) ? "" : "ok " + m.ok + ", feed " + feedIds(m) + ", " + notes(m).join(" | ");
    } },
  { id: "A-07", harm: "medium", why: "stop PB1 all where only one coil has a start and another runs on its own switch: all means all, so PB1 must stop the fan too",
    run: function (x) {
      var m = x.build(blk(["stop PB1 all", "start PB2 M1", "coil M1 \x22pump\x22", "switch SS1 M2", "coil M2 \x22fan\x22"]), "Draw a control circuit for a pump and a fan");
      if (!m.ok) return "not made: " + m.problems.join("; ");
      var S = x.sim(m); S.tap("PB2");
      if (!S.on("M1") || !S.on("M2")) return "did not start";
      S.press("PB1");
      return S.on("M2") ? "pressing PB1 (\x22all\x22) leaves M2 running: PB1 drawn in " + (m.plan.circuit.rungs.filter(function (r) { return r.stops.some(function (e) { return e.id === "PB1"; }); }).map(function (r) { return r.out.id; }).join(", ") || "no rung") + "\x27s rung only" : "";
    } },
  { id: "A-08", harm: "low", why: "start PB2 all among two coils: as 1.24.35 (a start must name its coil)",
    run: function (x) { return same(x, ["stop PB1 M1", "start PB2 all", "coil M1", "coil M2 M1"], "Draw a control circuit"); } },
  { id: "A-09", harm: "medium", why: "a duplex with stop PB1 all: PB1 ahead of every rung, the station wired as before",
    run: function (x) {
      var q = "Draw a duplex sump pump control circuit with an alternating relay";
      var m = x.build(blk(["stop PB1 all", "float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]), q);
      if (!m.ok) return "not made: " + m.problems.join("; ");
      return feedIds(m).indexOf("PB1") >= 0 && m.plan.circuit.rungs.some(function (r) { return r.out.kind === "alternator"; }) ? "" : "feed " + feedIds(m);
    } },
  { id: "A-10", harm: "low", why: "\x22stop all\x22 inside quotes is a label: stop PB1 M2 \x22stop all\x22 stops M2 only, as 1.24.35",
    run: function (x) { return same(x, ["stop PB1 M2 \x22stop all\x22", "start PB2 M1", "start PB3 M2", "coil M1", "coil M2"], "Draw a control circuit"); } },
  { id: "A-11", harm: "low", why: "a float's job written unquoted with all (float FS3 all pumps on) in a duplex: as 1.24.35",
    run: function (x) {
      return same(x, ["float FS1 off", "float FS2 lead on", "float FS3 all pumps on", "alternator AR M1 M2", "coil M1 \x22pump 1\x22", "coil M2 \x22pump 2\x22"], "Draw a duplex lift station control circuit");
    } },
  { id: "A-12", harm: "low", why: "lamp LT1 M1 all: nothing changes (as 1.24.35)",
    run: function (x) { return same(x, ["stop PB1 M1", "start PB2 M1", "coil M1", "lamp LT1 M1 all"], "Draw a motor starter"); } },

  // ---- a fill on two normally closed floats: where it acts ------------------------------------------------------------
  { id: "R-01", harm: "high", why: "a make-up water pump on two nc floats (low, high): it fills, so it holds in between",
    run: function (x) {
      var m = x.build(blk(["float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22make-up pump\x22"]), "Draw a control circuit for a make-up water pump with two float switches");
      if (!m.ok) return "not made: " + m.problems.join("; ");
      return x.lib.sweep(x.sim(m, { floats: { FS1: 1, FS2: 2 } }), "M1", [[0, true], [1.5, true], [2.5, false], [1.5, false], [0.5, true]]);
    } },
  { id: "R-02", harm: "high", why: "a fill whose stop float is nc and a pressure cut-out also nc in the rung: the floats hold in, the pressure cut-out stays in series",
    run: function (x) {
      var m = x.build(blk(["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "pressure PS1 M1 nc \x22high pressure cut-out\x22", "coil M1 \x22pump starter\x22"]), FILLQ);
      if (!m.ok) return "not made: " + m.problems.join("; ");
      var r = x.lib.rung(m, "M1");
      return r && r.series.some(function (e) { return e.id === "PS1"; }) && r.starts.some(function (e) { return e.id === "FS1"; }) && r.stops.some(function (e) { return e.id === "FS2"; }) ? "" : x.shape(m);
    } },
  { id: "R-03", harm: "medium", why: "a fill pump's low-suction cut-out written nc (wrong: it should open as the water falls) is a cut-out, never a start: it goes back once (code check), not drawn as the start with a holding contact",
    run: function (x) {
      var m = x.build(blk(["float FS1 M1 nc \x22low suction cut-out\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump starter\x22"]), FILLQ);
      if (!m.ok) return "";
      var r = x.lib.rung(m, "M1");
      return r && r.starts.some(function (e) { return e.id === "FS1"; }) ? "FS1 (low suction cut-out) drawn as the start, held in by M1" : "";
    } },
  { id: "R-04", harm: "medium", why: "a well's dry-run float written nc beside the tank's high float: never made the fill's start",
    run: function (x) {
      var m = x.build(blk(["float FS1 M1 nc \x22well dry run\x22", "float FS2 M1 nc \x22tank full\x22", "coil M1 \x22well pump\x22"]), "Draw a control circuit for a well pump that fills a storage tank with a tank float and a well dry-run float");
      if (!m.ok) return "";
      var r = x.lib.rung(m, "M1");
      return r && r.starts.some(function (e) { return e.id === "FS1"; }) ? "FS1 (well dry run) drawn as the start, held in by M1" : "";
    } },

  // ---- where it must not act: the plan as 1.24.35's ------------------------------------------------------------------
  { id: "R-10", harm: "high", why: "a sump pump question with two nc floats: an emptying pump, left as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22pump\x22"], "Draw a control circuit for a sump pump with a low float and a high float"); } },
  { id: "R-11", harm: "high", why: "a duplex station with nc floats: the alternator's wiring, as 1.24.35",
    run: function (x) {
      return same(x, ["float FS1 nc \x22off\x22", "float FS2 nc \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1\x22", "coil M2 \x22pump 2\x22"], "Draw a duplex pump station control circuit that fills a reservoir");
    } },
  { id: "R-12", harm: "medium", why: "a fill with two stop buttons and its floats: as written (1.24.35)",
    run: function (x) { return same(x, ["stop PB1 M1", "stop PB2 M1", "float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22pump\x22"], FILLQ); } },
  { id: "R-13", harm: "high", why: "a fill with three nc floats: as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "float FS3 M1 nc \x22high high\x22", "coil M1 \x22pump\x22"], FILLQ); } },
  { id: "R-14", harm: "high", why: "fill and drain: as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22pump\x22"], "Draw a control circuit to fill and drain a tank with a pump, a low float and a high float"); } },
  { id: "R-15", harm: "medium", why: "a fill with two floats that both stop it (high level, high high): as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22high level stop\x22", "float FS2 M1 nc \x22high high\x22", "coil M1 \x22pump\x22"], FILLQ); } },
  { id: "R-16", harm: "medium", why: "a fill with one nc float and one normally open: as written",
    run: function (x) { return same(x, ["float FS1 M1 \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump\x22"], FILLQ); } },
  { id: "R-17", harm: "high", why: "a fill pump's alarm floats on lights, not its coil: the lights as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22tank full\x22", "coil M1 \x22pump\x22", "float FS2 nc \x22low level alarm\x22", "float FS3 nc \x22high level alarm\x22", "lamp LT1 FS2 FS3 \x22alarm\x22 red"], FILLQ + " and alarms"); } },
  { id: "R-18", harm: "high", why: "the emptying rule of 1.24.34 (on and off floats, normally open, holding in) unchanged",
    run: function (x) { return same(x, ["float FS1 M1 \x22off\x22", "float FS2 M1 \x22on\x22", "coil M1 \x22sump pump\x22"], "Draw a control circuit for a sump pump with an on float and an off float"); } },
  { id: "R-19", harm: "high", why: "fill on the question but pump out also said: as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22pump\x22"], "Draw a control circuit for a pump that fills a tank, then pumps out the tank, with a low and a high float"); } },
  { id: "R-20", harm: "medium", why: "a fill with a start button and its floats: as written",
    run: function (x) { return same(x, ["start PB2 M1", "float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22pump\x22"], FILLQ); } },
  { id: "R-21", harm: "high", why: "nc floats on a heating question (no fill): as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22heater contactor\x22"], "Draw a control circuit for a tank heater with a low water float and a high float"); } },
  { id: "R-22", harm: "medium", why: "a fill question, two nc floats on a solenoid valve (not a coil): as written",
    run: function (x) { return same(x, ["float FS1 nc \x22low\x22", "float FS2 nc \x22high\x22", "solenoid SOL1 FS1 FS2 \x22fill valve\x22"], "Draw a control circuit for a solenoid valve that fills a tank between a low and a high float"); } },
  { id: "R-23", harm: "medium", why: "a fill, floats named low and low low (both start words, no stop): as written",
    run: function (x) { return same(x, ["float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22low low\x22", "coil M1 \x22pump\x22"], FILLQ); } }
];
