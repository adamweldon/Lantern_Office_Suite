// cases_f.js -- a given as the base the model changes (rule 8: "custom changes ... as long as they are code approved"):
// the given shown for a question, with the lines a model adds for what the question asks beyond it, built through
// act.build for that question and simulated. Right: drawn clean, and it does what the added lines say. And the lines a
// mend would give (the delayed start's overload, a sump's alarm float): drawn clean and right, so the fix is one line.
"use strict";
var lib = require("./lib.js");
var C = [];
// mod(id, q, add, drop, check): the given for q, without the lines matching drop, with add; check(c, S) -> "" or why
function mod(id, q, add, drop, harm, right, check) {
  C.push({ id: id, harm: harm, input: q + " -- the given, with: " + add.join(" / ") + (drop ? " (without " + drop + ")" : ""), right: right,
    run: function () {
      return lib.boot().then(function (x) {
        var s = lib.shown(x.N.L, q);
        if (!s.block) return "no given shown";
        var lines = s.lines.filter(function (l) { return !(drop && drop.test(l)); }).concat(add);
        var m = lib.build(x.N.L, lib.blk("CONTROL", s.title, lines), q), c = lib.ctl(m);
        if (!c) return "not drawn: " + lib.probs(m);
        return check(c, lib.make(c, { FS1: 10, FS2: 20, PS1: 10 }), m);
      });
    } });
}
var ST = "Draw the control circuit for a motor starter with start and stop push buttons and a run light";
mod("F-starter-estop", ST, ["estop ES1"], null, "high", "the e-stop stops the motor, and the motor stays stopped when it is released",
  function (c, S) { S.tap("PB2"); if (!S.on("M1")) return "does not start"; S.press("ES1"); if (S.on("M1")) return "the e-stop does not stop it"; S.press("ES1", false); return S.on("M1") ? "restarts when the e-stop is released" : ""; });
mod("F-starter-stopped-light", ST, ["lamp LT2 M1 off \x22stopped\x22 red"], null, "medium", "LT1 lit while running, LT2 while stopped",
  function (c, S) { if (S.on("LT1") || !S.on("LT2")) return "stopped: LT1 " + S.on("LT1") + ", LT2 " + S.on("LT2"); S.tap("PB2"); return !S.on("LT1") || S.on("LT2") ? "running: LT1 " + S.on("LT1") + ", LT2 " + S.on("LT2") : ""; });
mod("F-starter-third-station", "Draw a 3-wire start stop control for a conveyor that can be started and stopped from two locations, 24 V DC", ["stop PB5 M1 \x22stop, third\x22", "start PB6 M1 \x22start, third\x22"], null, "medium",
  "three stops in series, three starts in parallel: each start starts it, each stop stops it",
  function (c, S) { var bad = []; ["PB3", "PB4", "PB6"].forEach(function (st) { ["PB1", "PB2", "PB5"].forEach(function (sp) { S.tap(st); if (!S.on("M1")) bad.push(st + " does not start"); S.tap(sp); if (S.on("M1")) bad.push(sp + " does not stop"); }); }); return bad.join("; "); });
mod("F-starter-overload-light", ST, ["lamp LT2 OL1 \x22overload tripped\x22 amber"], null, "medium", "LT2 dark until the overload trips, lit when it has",
  function (c, S) { if (S.on("LT2")) return "lit with nothing tripped"; S.trip("OL1"); return S.on("LT2") ? "" : "dark with OL1 tripped"; });
mod("F-reversing-limits", "Draw a forward/reverse motor control circuit with interlocks", ["limit LS1 M1 nc \x22forward end\x22", "limit LS2 M2 nc \x22reverse end\x22"], null, "medium",
  "the forward end limit stops forward (and not reverse), the reverse end limit stops reverse",
  function (c, S) { S.tap("PB2"); if (!S.on("M1")) return "forward does not start"; S.force("LS1", false); if (S.on("M1")) return "LS1 does not stop forward"; S.tap("PB3"); if (!S.on("M2")) return "reverse does not start off the forward end"; S.force("LS1", null); S.force("LS2", false); return S.on("M2") ? "LS2 does not stop reverse" : ""; });
mod("F-sump-alarm-float", "Draw the control circuit for a sump pump with a float switch", ["float FS2 \x22high level alarm\x22", "lamp LT1 FS2 \x22high water\x22 red"], null, "high",
  "the pump runs above FS1; the alarm light only above FS2",
  function (c, S) { S.set(5); if (S.on("M1") || S.on("LT1")) return "on below both floats"; S.set(15); if (!S.on("M1") || S.on("LT1")) return "between the floats: M1 " + S.on("M1") + ", LT1 " + S.on("LT1"); S.set(25); return !S.on("M1") || !S.on("LT1") ? "above both: M1 " + S.on("M1") + ", LT1 " + S.on("LT1") : ""; });
mod("F-sump-on-off-floats", "Draw the control circuit for a sump pump with a float switch", ["float FS1 M1 \x22pump off\x22", "float FS2 M1 \x22pump on\x22"], /^float/, "high",
  "on at FS2, held in down to FS1 (no short-cycling): off below FS1, on above FS2, still on between them on the way down",
  function (c, S) { S.set(5); if (S.on("M1")) return "on below the off float"; S.set(15); if (S.on("M1")) return "starts between the floats on the way up"; S.set(25); if (!S.on("M1")) return "does not start above the on float"; S.set(15); if (!S.on("M1")) return "drops out between the floats on the way down (short-cycling)"; S.set(5); return S.on("M1") ? "does not stop below the off float" : ""; });
mod("F-fill-two-floats", "Draw the control circuit for a pump that fills a tank with a float switch", ["float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22"], /^float/, "medium",
  "a fill pump on two floats (both open as the level rises): on below FS1, held in up to FS2, off above it and not restarted on the way down until below FS1 -- what a model that adds the second float the question asks for to the fill given should get",
  function (c, S) {
    var path = [5, 15, 25, 15, 5], want = [true, true, false, false, true], got = path.map(function (v) { S.set(v); return S.on("M1"); });
    return got.join() === want.join() ? "" : "rising 5, 15, 25 then falling 15, 5 the pump is " + got.map(function (v) { return v ? "on" : "off"; }).join(", ") + " (right: on, on, off, off, on): Lantern leaves a fill\u2019s floats in series as written, so no fill can be drawn with the hold-in a two-float fill needs (it short-cycles at FS1 and never fills to FS2)";
  });
// the mend for the delayed start's overload (B-dl-overload-restart): the overload in the run relay's rung too
var DL = "Draw a control circuit for a motor that starts 30 seconds after the start button is pressed, with a warning horn";
mod("F-delayed-overload-mend", DL, ["overload OL1 M1 CR1"], /^overload/, "high",
  "with \x22overload OL1 M1 CR1\x22 (OL1 in the run relay's rung too) the trip drops CR1: after the reset the motor stays stopped until start is pressed, and the warning sounds again",
  function (c, S) { S.elapse(); S.tap("PB2"); if (!S.on("M1")) return "does not start"; S.trip("OL1"); S.trip("OL1", false); if (S.on("M1")) return "restarts on the reset"; S.elapse(false); S.tap("PB2"); return S.on("AH1") && !S.on("M1") ? "" : "on a new start the warning does not sound first (AH1 " + S.on("AH1") + ", M1 " + S.on("M1") + ")"; });
mod("F-compressor-start-stop", "Draw the control circuit for an air compressor with a pressure switch that cuts out at 120 psi", ["stop PB1 M1", "start PB2 M1"], /^switch/, "medium",
  "a three-wire compressor: start held in, the pressure switch in series stops it at the cut-out (and it waits for a start after)",
  function (c, S) { S.set(5); S.tap("PB2"); if (!S.on("M1")) return "does not start below the cut-out"; S.set(15); return S.on("M1") ? "the pressure switch does not stop it at the cut-out" : ""; });
module.exports = C;
