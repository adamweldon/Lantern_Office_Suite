// cases_fill.js -- AI_CONTROL's new pieces: "stop PB1 all" (one stop ahead of every rung), a fill pump on two normally
// closed floats holding itself in (in simulation as the level rises and falls), the two floats written normally open
// going back once, and a float guarding the source never taken as the fill's start.
"use strict";
var lib = require("./lib.js");
function B(id, q, lines, o) { o = o || {}; o.id = id; o.kind = "build"; o.q = q; o.lines = lines; o.expect = "clean"; return o; }
function steps(map, coil, seq, pre) {
  return function (c) {
    var S = lib.sim(c, map);
    if (pre) pre(S);
    for (var i = 0; i < seq.length; i++) {
      var s = seq[i];
      if (typeof s[0] === "number") S.level(s[0]); else S[s[0]](s[1]);
      if (s.length > 2 || typeof s[0] === "number") { var want = typeof s[0] === "number" ? s[1] : s[2]; if (S.on(coil) !== want) return coil + (want ? " off" : " on") + " at step " + (i + 1) + " (" + JSON.stringify(s) + ")"; }
    }
    return "";
  };
}
var RISE_FALL = [[0, true], [0.5, true], [1.5, true], [2.5, true], [3, false], [4, false], [2.5, false], [1.5, false], [1, false], [0.9, true], [2, true], [3.2, false]];
function feedHas(id) { return function (b) { return (b.circuit.feed || []).some(function (f) { return f.id === id; }) ? "" : id + " is not ahead of every rung (feed " + JSON.stringify(b.circuit.feed) + ")"; }; }
module.exports = [
  // ---- stop PB1 all
  B("a-stopall-two-coils", "Draw two conveyors with one stop for both", ["stop PB1 all", "start PB2 M1", "start PB3 M2", "coil M1 \x22conveyor 1 starter\x22", "coil M2 \x22conveyor 2 starter\x22"], { after: feedHas("PB1"), sim: function (c) { var S = lib.sim(c); S.tap("PB2"); S.tap("PB3"); if (!S.on("M1") || !S.on("M2")) return "do not start"; S.tap("PB1"); return S.on("M1") || S.on("M2") ? "PB1 does not stop both" : ""; } }),
  B("a-stopall-everything", "Draw two fans with one stop for both", ["stop PB1 everything", "start PB2 M1", "start PB3 M2", "coil M1 \x22fan 1 starter\x22", "coil M2 \x22fan 2 starter\x22"], { after: feedHas("PB1") }),
  B("a-stopall-with-estop", "Draw a reversing starter with an e-stop", ["estop ES1", "stop PB1 all", "start PB2 M1 \x22forward\x22", "start PB3 M2 \x22reverse\x22", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22", "interlock M1 M2", "overload OL1 M1 M2"], { after: function (b) { return feedHas("PB1")(b) || feedHas("ES1")(b); } }),
  B("a-stopall-one-coil-lamp", "Draw a conveyor starter with a stopped light", ["stop PB1 all", "start PB2 M1", "coil M1 \x22conveyor starter\x22", "overload OL1 M1", "lamp LT1 M1 off \x22stopped\x22 red"], { sim: function (c) { var S = lib.sim(c); S.tap("PB2"); if (!S.on("M1") || S.on("LT1")) return "M1 or LT1 wrong when running"; S.tap("PB1"); return !S.on("M1") && S.on("LT1") ? "" : "PB1 does not stop M1, or LT1 not lit after"; } }),
  B("a-stop-named-plus-all", "Draw a conveyor and a fan, the stop for the conveyor only", ["stop PB1 M1 all", "start PB2 M1", "start PB3 M2", "coil M1 \x22conveyor starter\x22", "coil M2 \x22fan starter\x22"], { after: function (b) { return (b.circuit.feed || []).some(function (f) { return f.id === "PB1"; }) ? "PB1 written for M1 is put ahead of every rung" : ""; } }),
  B("a-stopall-sequence", "Draw two conveyors that start in sequence with one stop for both", ["stop PB1 all", "start PB2 M1", "start PB3 M2", "coil M1 \x22conveyor 1 starter\x22", "coil M2 M1 \x22conveyor 2 starter\x22", "overload OL1 M1", "overload OL2 M2"], { sim: function (c) { var S = lib.sim(c); S.tap("PB3"); if (S.on("M2")) return "M2 starts first"; S.tap("PB2"); S.tap("PB3"); if (!S.on("M2")) return "M2 does not start after M1"; S.tap("PB1"); return S.on("M1") || S.on("M2") ? "PB1 does not stop both" : ""; } }),
  { id: "a-stopall-no-coil", kind: "fn", harm: "low", run: function (env) {
    var r = env.L.aiAct.build("MAKE CONTROL: L\nstop PB1 all\nlamp LT1 \x22power\x22 white\nEND", "Draw a lamp circuit with a stop");
    return r && r.problems && r.problems.length ? "" : "a stop for all with no coil built without a word";
  } },
  // ---- a fill on two normally closed floats: holds in between, in simulation
  B("a-fill2-basic", "Draw the control circuit for a pump that fills a tank between a low and a high float", ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { sim: steps({ FS1: 1, FS2: 3 }, "M1", RISE_FALL) }),
  B("a-fill2-reversed-lines", "Draw the control circuit for a pump that fills a tank between a low and a high float", ["float FS2 M1 nc \x22high level stop\x22", "float FS1 M1 nc \x22low level start\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { sim: steps({ FS1: 1, FS2: 3 }, "M1", RISE_FALL) }),
  B("a-fill2-on-off", "Draw the control circuit for a tank fill pump on two floats", ["float FS1 M1 nc \x22pump on\x22", "float FS2 M1 nc \x22pump off\x22", "coil M1 \x22fill pump starter\x22", "overload OL1 M1"], { sim: steps({ FS1: 1, FS2: 3 }, "M1", RISE_FALL) }),
  B("a-fill2-refill-full", "Draw the control circuit for a pump that refills a cistern on two floats", ["float FS1 M1 nc \x22refill\x22", "float FS2 M1 nc \x22full\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { sim: steps({ FS1: 1, FS2: 3 }, "M1", RISE_FALL) }),
  B("a-fill2-with-stop-button", "Draw the control circuit for a pump that fills a tank between a low and a high float, with a stop button", ["stop PB1 M1", "float FS1 M1 nc \x22low level\x22", "float FS2 M1 nc \x22high level\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { sim: function (c) { var r = steps({ FS1: 1, FS2: 3 }, "M1", RISE_FALL)(c); if (r) return r; var S = lib.sim(c, { FS1: 1, FS2: 3 }); S.level(0); S.level(2); S.tap("PB1"); return S.on("M1") ? "PB1 does not stop the fill between the floats" : ""; } }),
  B("a-fill2-hoa-selector", "Draw the control circuit for a pump that fills a water tower between two floats, with an on/off selector", ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22low\x22", "float FS2 M1 nc \x22high\x22", "coil M1 \x22pump contactor\x22", "overload OL1 M1"], { sim: steps({ FS1: 1, FS2: 3 }, "M1", RISE_FALL) }),
  B("a-fill2-relay", "Draw the control circuit for a pump that fills a tank between two floats, through a fill relay", ["float FS1 CR1 nc \x22low level start\x22", "float FS2 CR1 nc \x22high level stop\x22", "coil CR1 \x22fill relay\x22", "coil M1 CR1 \x22pump starter\x22", "overload OL1 M1"], { sim: steps({ FS1: 1, FS2: 3 }, "M1", RISE_FALL) }),
  B("a-fill2-trip-reset", "Draw the control circuit for a pump that fills a tank between a low and a high float", ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { sim: function (c) { var S = lib.sim(c, { FS1: 1, FS2: 3 }); S.level(0); S.level(2); S.trip("OL1"); if (S.on("M1")) return "OL1 does not stop it"; S.reset("OL1"); if (S.on("M1")) return "restarts between the floats after the overload is reset (should wait for the low float)"; S.level(0.5); return S.on("M1") ? "" : "does not restart at the low float"; } }),
  B("a-fill2-steps-say", "Draw the control circuit for a pump that fills a tank between a low and a high float", ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { harm: "low", after: function (b) { var t = (b.circuit.added || []).concat(b.circuit.changed || []).join(" "); return /as the water rises above FS1/.test(t) && /starts M1 as the water falls below it/.test(t) ? "" : "what Lantern says it did is not as drawn: " + t; } }),
  // ---- a source guard
  { id: "a-fill2-dry-run-nc-back", kind: "build", harmMiss: "medium", q: "Draw the control circuit for a well pump that fills a tank, with a dry run float in the well", lines: ["float FS1 M1 nc \x22well dry run\x22", "float FS2 M1 nc \x22tank full\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], expect: { back: "low cut-out drawn normally closed", line: "float FS1 M1 \x22well dry run\x22" } },
  B("a-fill3-guard", "Draw the control circuit for a well pump that fills a tank between a low and a high float, with a dry run float in the well", ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "float FS3 M1 \x22well dry run cut-out\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { harm: "medium", sim: steps({ FS1: 1, FS2: 3, FS3: -1 }, "M1", RISE_FALL) }),
  B("a-fill2-suction-guard", "Draw the control circuit for a pump that fills a tank from a suction tank", ["float FS1 M1 \x22suction tank low level\x22", "float FS2 M1 nc \x22tank full\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { after: function (b) { var r = b.circuit.rungs[0]; return r.starts.some(function (e) { return e.id === "FS1"; }) ? "the suction float is taken as the fill's start" : ""; } }),
  B("a-fill2-sump-q", "Draw the control circuit for a sump pump with a high and a low float", ["float FS1 M1 \x22high level start\x22", "float FS2 M1 \x22low level stop\x22", "coil M1 \x22sump pump starter\x22", "overload OL1 M1"], { sim: steps({ FS1: 3, FS2: 1 }, "M1", [[0, false], [2, false], [3.5, true], [2, true], [0.5, false]]) }),
  B("a-fill2-both-high", "Draw the control circuit for a pump that fills a tank with a high level and a high high level cut-off", ["float FS1 M1 nc \x22high level\x22", "float FS2 M1 nc \x22high high level cut-off\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"], { after: function (b) { var r = b.circuit.rungs[0]; return r.starts.length ? "two high floats taken as a start and a stop" : ""; } })
];
