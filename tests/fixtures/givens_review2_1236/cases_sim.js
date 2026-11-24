// cases_sim.js -- each given as shown for a question, built by Lantern and run on the ladder it draws (lib.sim); and
// the givens as a small model copies them (no END, a code fence, numbered lines, a line changed as the question asks).
// run(x) -> "" when right, else what was seen. x: {L, lib, given(q) -> the shown block text, build(text, q), sim(made, env)}
"use strict";
function step(S, list) {
  // list: [action, arg, {id: want}] ... ; returns "" or the first disagreement
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (a[0] === "level") S.level(a[1]); else if (a[0] === "p") S.pressure(a[1]); else if (a[0] === "tap") S.tap(a[1]);
    else if (a[0] === "press") S.press(a[1]); else if (a[0] === "release") S.release(a[1]); else if (a[0] === "trip") S.trip(a[1]);
    else if (a[0] === "reset") S.reset(a[1]); else if (a[0] === "wait") S.wait(a[1]); else if (a[0] === "sw") S.sw(a[1], a[3]);
    var want = a[2] || {};
    for (var k in want) if (S.on(k) !== want[k]) return "after " + a[0] + " " + a[1] + " (step " + (i + 1) + "): " + k + " is " + (S.on(k) ? "on" : "off") + ", want " + (want[k] ? "on" : "off");
  }
  return "";
}
function made(x, text, q) {
  var m = x.build(text, q);
  if (!m) return { err: "nothing built" };
  if (!m.ok || !m.plan) return { err: "not made: " + (m.problems || []).join("; ") };
  return { m: m };
}
function fromGiven(x, q) {
  var t = x.given(q);
  if (!t) return { err: "no given shown for the question" };
  return made(x, t, q);
}
var FILL2 = "Draw a control circuit for a pump that fills a tank between a low and a high float";
var FILL2_BLOCK = ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"];
// a fill between floats at 1 and 2: on below 1, holds in to 2, off at 2, stays off down to 1, on again below 1
var FILL_SWEEP = [[0, true], [1.5, true], [2.5, false], [1.5, false], [0.5, true], [1.9, true], [2.1, false], [0.9, true]];
function fill2(x, text, q, floats) {
  var r = made(x, text, q || FILL2);
  if (r.err) return r.err;
  return x.lib.sweep(x.sim(r.m, { floats: floats || { FS1: 1, FS2: 2 } }), "M1", FILL_SWEEP);
}
module.exports = [
  // ---- the givens as shown, simulated ------------------------------------------------------------------------------
  { id: "S-st-01", harm: "high", why: "a three-wire starter: start latches, stop drops, an overload drops it and after reset it stays off; the run light follows the starter, the stopped light the other way",
    run: function (x) {
      var r = fromGiven(x, "Draw a motor starter with run and stop indicator lamps"); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB2", { M1: true, LT1: true, LT2: false }], ["tap", "PB1", { M1: false, LT1: false, LT2: true }], ["tap", "PB2", { M1: true }],
        ["trip", "OL1", { M1: false }], ["reset", "OL1", { M1: false }], ["tap", "PB2", { M1: true }]]);
    } },
  { id: "S-st-02", harm: "high", why: "two stations: either start starts, either stop stops",
    run: function (x) {
      var r = fromGiven(x, "Draw a ladder diagram for a pump starter with start and stop at two locations and a green run light"); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB3", { M1: true }], ["tap", "PB2", { M1: false }], ["tap", "PB4", { M1: true, LT1: true }], ["tap", "PB1", { M1: false }]]);
    } },
  { id: "S-st-03", harm: "high", why: "three stations: each start and each stop works",
    run: function (x) {
      var r = fromGiven(x, "Draw a motor starter for a conveyor with three start/stop stations"); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB6", { M1: true }], ["tap", "PB2", { M1: false }], ["tap", "PB4", { M1: true }], ["tap", "PB3", { M1: false }], ["tap", "PB5", { M1: true }], ["tap", "PB1", { M1: false }]]);
    } },
  { id: "S-st-04", harm: "high", why: "an e-stop ahead of every rung: pressed it stops the motor, and let go the motor stays stopped",
    run: function (x) {
      var r = fromGiven(x, "Draw a motor starter control circuit with an e-stop, two stations and a run light"); if (r.err) return r.err;
      var S = x.sim(r.m);
      if (!(r.m.plan.circuit.feed || []).some(function (f) { return f.id === "ES1"; })) return "ES1 is not ahead of every rung";
      return step(S, [["tap", "PB3", { M1: true }], ["press", "ES1", { M1: false }], ["release", "ES1", { M1: false }], ["tap", "PB4", { M1: true }]]);
    } },
  { id: "S-st-05", harm: "medium", why: "24 V DC control: the rails are + and 0 V, and the supply is carried",
    run: function (x) {
      var r = fromGiven(x, "Draw a ladder diagram for a motor starter with a green running light and a red stopped light, 24 V DC control"); if (r.err) return r.err;
      var rails = r.m.plan.circuit.rails.join(" ");
      return /24 V DC/.test(rails) && /\+ and 0 V/.test(r.m.summary || "") ? "" : "rails " + rails + "; summary " + String(r.m.summary).slice(0, 60);
    } },
  { id: "S-rv-01", harm: "high", why: "reversing: forward starts M1; reverse does nothing while forward runs; the one stop stops either; the overload stops either; never both",
    run: function (x) {
      var q = "Draw a reversing starter control circuit for a conveyor with forward and reverse lights", r = fromGiven(x, q); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB2", { M1: true, M2: false, LT1: true }], ["tap", "PB3", { M1: true, M2: false }], ["tap", "PB1", { M1: false, M2: false }],
        ["tap", "PB3", { M1: false, M2: true, LT2: true }], ["tap", "PB2", { M1: false, M2: true }], ["trip", "OL1", { M1: false, M2: false }], ["reset", "OL1", { M2: false }], ["tap", "PB2", { M1: true }]]);
    } },
  { id: "S-rv-02", harm: "medium", why: "the given's own stop (stop PB1 all) is drawn ahead of both rungs with no correction note under the drawing",
    run: function (x) {
      var r = fromGiven(x, "Draw a forward/reverse motor starter control circuit"); if (r.err) return r.err;
      var c = r.m.plan.circuit;
      if (!(c.feed || []).some(function (f) { return f.id === "PB1"; })) return "PB1 is not ahead of every rung";
      var note = (c.changed || []).concat(c.added || []).filter(function (s) { return /PB1/.test(s); });
      return note.length ? "a note about PB1: " + note[0] : "";
    } },
  { id: "S-rv-03", harm: "high", why: "reversing with an e-stop: the e-stop stops either direction",
    run: function (x) {
      var r = fromGiven(x, "Draw a control circuit for a motor that can run in both directions with an e-stop"); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB3", { M2: true }], ["press", "ES1", { M2: false }], ["release", "ES1", { M2: false }]]);
    } },
  { id: "S-dl-02", harm: "low", why: "the delayed start's overload: an overload relay has one normally closed contact; in the run relay's rung it already drops the timer and the motor, so it is drawn once (the given names it on M1 and CR1: two contacts of OL1)",
    run: function (x) {
      var r = fromGiven(x, "Draw a delayed start control circuit for a conveyor with a 30 second warning horn"); if (r.err) return r.err;
      var n = r.m.plan.circuit.rungs.filter(function (g) { return g.after.some(function (e) { return e.id === "OL1"; }); }).map(function (g) { return g.out.id; });
      return n.length === 1 ? "" : "OL1's normally closed contact drawn in " + n.length + " rungs (" + n.join(", ") + ")";
    } },
  { id: "S-rv-04", harm: "low", why: "the reversing starter's one overload: its one normally closed contact in the common line of both coils, drawn once (the given names it on M1 and M2: drawn as two contacts)",
    run: function (x) {
      var r = fromGiven(x, "Draw a forward/reverse motor starter control circuit"); if (r.err) return r.err;
      var n = r.m.plan.circuit.rungs.filter(function (g) { return g.after.some(function (e) { return e.id === "OL1"; }); }).map(function (g) { return g.out.id; });
      return n.length === 1 ? "" : "OL1's normally closed contact drawn in " + n.length + " rungs (" + n.join(", ") + ")";
    } },
  { id: "S-sq-01", harm: "high", why: "sequence: M2's start does nothing until M1 runs; M2's stop stops M2 alone; M1's stop or overload stops both",
    run: function (x) {
      var r = fromGiven(x, "Draw a control circuit for two conveyors: conveyor 2 can only start after conveyor 1 is running"); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB4", { M1: false, M2: false }], ["tap", "PB3", { M1: true, M2: false }], ["tap", "PB4", { M2: true }], ["tap", "PB2", { M1: true, M2: false }],
        ["tap", "PB4", { M2: true }], ["tap", "PB1", { M1: false, M2: false }], ["tap", "PB3", { M1: true }], ["tap", "PB4", { M2: true }], ["trip", "OL1", { M1: false, M2: false }]]);
    } },
  { id: "S-sq-02", harm: "high", why: "three in sequence: M3 needs M2, M2 needs M1; stopping M2 stops M3 too",
    run: function (x) {
      var r = fromGiven(x, "Draw a control circuit for three conveyors that start in sequence"); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB6", { M3: false }], ["tap", "PB4", { M1: true }], ["tap", "PB6", { M3: false }], ["tap", "PB5", { M2: true }], ["tap", "PB6", { M3: true }],
        ["tap", "PB2", { M1: true, M2: false, M3: false }]]);
    } },
  { id: "S-dl-01", harm: "high", why: "a delayed start: start pulls in the run relay, the horn sounds while the timer times, the motor starts when it has timed out (and the horn stops); stop drops all; an overload drops all, and reset does not restart it",
    run: function (x) {
      var r = fromGiven(x, "Draw a ladder diagram for a conveyor that starts 5 seconds after the start button is pressed, with a warning horn while it waits"); if (r.err) return r.err;
      var S = x.sim(r.m);
      return step(S, [["tap", "PB2", { CR1: true, M1: false, AH1: true }], ["wait", 3, { M1: false, AH1: true }], ["wait", 3, { M1: true, AH1: false }], ["tap", "PB1", { CR1: false, M1: false, AH1: false }],
        ["tap", "PB2", { CR1: true }], ["wait", 6, { M1: true }], ["trip", "OL1", { CR1: false, M1: false, AH1: false }], ["reset", "OL1", { CR1: false, M1: false }], ["wait", 10, { M1: false, AH1: false }]]);
    } },
  { id: "S-cp-01", harm: "high", why: "a compressor: runs below the cut-out, stops at it, stays stopped down to the cut-in, runs again below it; the on/off switch and the overload stop it",
    run: function (x) {
      var r = fromGiven(x, "Draw a ladder diagram for an air compressor with a pressure switch, cut-out 125 psi, cut-in 95 psi"); if (r.err) return r.err;
      var S = x.sim(r.m, { ps: { PS1: { cutin: 95, cutout: 125 } } });
      return step(S, [["p", 0, { M1: true }], ["p", 110, { M1: true }], ["p", 125, { M1: false }], ["p", 110, { M1: false }], ["p", 95, { M1: true }], ["sw", "SS1", { M1: false }, false], ["sw", "SS1", { M1: true }, true], ["trip", "OL1", { M1: false }]]);
    } },
  { id: "S-cp-02", harm: "high", why: "the compressor given passes its own code check, sure of the cut-out's way: one checked note for PS1",
    run: function (x) {
      var r = fromGiven(x, "Draw a control circuit for an air compressor with a pressure switch"); if (r.err) return r.err;
      var ok = (r.m.codes && r.m.codes.checked || []).filter(function (c) { return c.ok && /PS1/.test(c.ok); });
      return ok.length ? "" : "no check on PS1 (codes: " + JSON.stringify(r.m.codes && r.m.codes.checked.map(function (c) { return c.ok || c.back; })) + ")";
    } },
  { id: "S-fl-01", harm: "high", why: "fill on one float: runs while the water is below the float, stops at it",
    run: function (x) {
      var r = fromGiven(x, "Draw a ladder diagram for a pump that fills a tank with a float switch"); if (r.err) return r.err;
      return x.lib.sweep(x.sim(r.m, { floats: { FS1: 2 } }), "M1", [[0, true], [1.5, true], [2.5, false], [1.5, true]]);
    } },
  { id: "S-f2-01", harm: "high", why: "fill between two floats: holds in from the low float up to the high one, and stays off down to the low one",
    run: function (x) { var t = x.given(FILL2); return t ? fill2(x, t) : "no given shown"; } },
  { id: "S-f2-02", harm: "high", why: "the fill-two given with an overload trip: the pump stops, and after reset runs again only if the water is below the high float (no seal held through a trip)",
    run: function (x) {
      var r = fromGiven(x, FILL2); if (r.err) return r.err;
      var S = x.sim(r.m, { floats: { FS1: 1, FS2: 2 } });
      return step(S, [["level", 0, { M1: true }], ["level", 1.5, { M1: true }], ["trip", "OL1", { M1: false }], ["reset", "OL1", { M1: false }], ["level", 0.5, { M1: true }]]);
    } },
  { id: "S-sp-01", harm: "high", why: "a sump on one float: off while the water is below it, on above it; the alarm light lit above the alarm float only",
    run: function (x) {
      var r = fromGiven(x, "Draw a control circuit for a sump pump with a float switch and a high water alarm"); if (r.err) return r.err;
      var S = x.sim(r.m, { floats: { FS1: 1, FS2: 3 } });
      return step(S, [["level", 0, { M1: false, LT1: false }], ["level", 1.5, { M1: true, LT1: false }], ["level", 3.5, { M1: true, LT1: true }], ["level", 0.5, { M1: false, LT1: false }]]);
    } },
  { id: "S-sp-02", harm: "high", why: "the sump's horn on the alarm float",
    run: function (x) {
      var r = fromGiven(x, "Draw a control circuit for a sump pump with a run light and a high water alarm horn"); if (r.err) return r.err;
      var S = x.sim(r.m, { floats: { FS1: 1, FS2: 3 } });
      return step(S, [["level", 2, { M1: true, LT1: true, AH1: false }], ["level", 3.5, { AH1: true }], ["level", 0, { M1: false, AH1: false, LT1: false }]]);
    } },

  // ---- the givens as a small model copies them --------------------------------------------------------------------
  { id: "S-cp-03", harm: "medium", why: "the compressor given copied with its nc left out: a high cut-out written normally open goes back once with the nc line",
    run: function (x) {
      var q = "Draw a control circuit for an air compressor with a pressure switch";
      var m = x.build("MAKE CONTROL: Air compressor\nswitch SS1 M1 \x22on/off\x22\npressure PS1 M1 \x22opens at cut-out\x22\ncoil M1 \x22compressor starter\x22\noverload OL1 M1\nEND", q);
      return !m.ok && (m.problems || []).some(function (p) { return /PS1/.test(p) && /pressure PS1 M1 nc/.test(p); }) ? "" : "not sent back: ok " + m.ok + " " + (m.problems || []).join("; ");
    } },
  { id: "S-cp-04", harm: "medium", why: "the same with the question saying only \x22compressor\x22 (the given is shown for it): its copy without nc runs the compressor only above its cut-out, and must go back as the air compressor's does",
    run: function (x) {
      var q = "Draw a control circuit for a compressor with a pressure switch";
      if (!x.given(q)) return "";   // no given shown: nothing to copy
      var m = x.build("MAKE CONTROL: Air compressor\nswitch SS1 M1 \x22on/off\x22\npressure PS1 M1 \x22opens at cut-out\x22\ncoil M1 \x22compressor starter\x22\noverload OL1 M1\nEND", q);
      return !m.ok && (m.problems || []).some(function (p) { return /PS1/.test(p); }) ? "" : "drawn as written (ok " + m.ok + "): PS1 normally open, the compressor runs only above its cut-out";
    } },
  { id: "S-f2-fence", harm: "high", why: "the fill-two given in a code fence with no END: built the same and holds in",
    run: function (x) { return fill2(x, "```\nMAKE CONTROL: Tank fill pump, two floats\n" + FILL2_BLOCK.join("\n") + "\n```"); } },
  { id: "S-f2-numbered", harm: "high", why: "numbered lines",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill pump, two floats\n" + FILL2_BLOCK.map(function (l, i) { return (i + 1) + ". " + l; }).join("\n") + "\nEND"); } },
  { id: "S-f2-order", harm: "high", why: "the high float written first",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nfloat FS2 M1 nc \x22high level stop\x22\nfloat FS1 M1 nc \x22low level start\x22\ncoil M1 \x22pump starter\x22\nEND"); } },
  { id: "S-f2-unquoted", harm: "high", why: "the floats' jobs without quotes (float FS1 M1 nc low)",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nfloat FS1 M1 nc low\nfloat FS2 M1 nc high\ncoil M1 \x22pump starter\x22\noverload OL1 M1\nEND"); } },
  { id: "S-f2-onoff", harm: "high", why: "named pump on / pump off",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nfloat FS1 M1 nc \x22pump on\x22\nfloat FS2 M1 nc \x22pump off\x22\ncoil M1 \x22pump starter\x22\nEND"); } },
  { id: "S-f2-emptyfull", harm: "high", why: "named tank empty / tank full",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nfloat FS1 M1 nc \x22tank empty\x22\nfloat FS2 M1 nc \x22tank full\x22\ncoil M1 \x22pump starter\x22\nEND"); } },
  { id: "S-f2-startstop", harm: "high", why: "named start / stop",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nfloat FS1 M1 nc \x22start\x22\nfloat FS2 M1 nc \x22stop\x22\ncoil M1 \x22pump starter\x22\nEND"); } },
  { id: "S-f2-estop", harm: "high", why: "the given with an e-stop added (as a question with an e-stop asks): still holds in, and the e-stop stops it",
    run: function (x) {
      var e = fill2(x, "MAKE CONTROL: Tank fill\nestop ES1\n" + FILL2_BLOCK.join("\n") + "\nEND", FILL2 + ", with an e-stop");
      return e;
    } },
  { id: "S-f2-light", harm: "high", why: "the given with a pump running light added: holds in, the light follows",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\n" + FILL2_BLOCK.join("\n") + "\nlamp LT1 M1 \x22pump on\x22 green\nEND", FILL2 + " and a pump running light"); } },
  { id: "S-f2-stopbutton", harm: "high", why: "the given with a stop button added, as \x22... with a stop button\x22 asks: the pump must still hold in from the low float to the high one (drawn in series, it short-cycles at the low float and never fills the tank)",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nstop PB1 M1\n" + FILL2_BLOCK.join("\n") + "\nEND", FILL2 + ", with a stop button"); } },
  { id: "S-f2-startstopbuttons", harm: "medium", why: "the given with start and stop buttons added (a manual start beside the floats): the floats must still stop it at the high float, and never be drawn so the tank overflows",
    run: function (x) {
      var r = made(x, "MAKE CONTROL: Tank fill\nstop PB1 M1\nstart PB2 M1\n" + FILL2_BLOCK.join("\n") + "\nEND", FILL2 + ", with start and stop buttons"); if (r.err) return r.err;
      var S = x.sim(r.m, { floats: { FS1: 1, FS2: 2 } });
      S.level(1.5); S.tap("PB2"); S.level(2.5);
      return S.on("M1") ? "M1 runs above the high float" : "";
    } },
  { id: "S-f2-noNc", harm: "medium", why: "the given copied with nc left out of both floats: drawn in series, the pump runs only when the tank is above the high float -- the tank overflows; it should go back once with the nc lines (a fill's floats open as the water rises)",
    run: function (x) {
      var m = x.build("MAKE CONTROL: Tank fill\nswitch SS1 M1 \x22on/off\x22\nfloat FS1 M1 \x22low level start\x22\nfloat FS2 M1 \x22high level stop\x22\ncoil M1 \x22pump starter\x22\noverload OL1 M1\nEND", FILL2);
      if (!m.ok) return "";
      var e = x.lib.sweep(x.sim(m, { floats: { FS1: 1, FS2: 2 } }), "M1", FILL_SWEEP);
      return e ? "drawn as written and not questioned: " + e : "";
    } },
  { id: "S-f2-topbottom", harm: "medium", why: "named top / bottom: the same two jobs",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nfloat FS1 M1 nc \x22bottom float\x22\nfloat FS2 M1 nc \x22top float\x22\ncoil M1 \x22pump starter\x22\nEND"); } },
  { id: "S-f2-upperlower", harm: "medium", why: "named lower level / upper level: the same two jobs",
    run: function (x) { return fill2(x, "MAKE CONTROL: Tank fill\nfloat FS1 M1 nc \x22lower level\x22\nfloat FS2 M1 nc \x22upper level\x22\ncoil M1 \x22pump starter\x22\nEND"); } },
  { id: "S-f2-cr", harm: "high", why: "the floats on a run relay that drives the pump (float FS1 CR1 nc ...): the relay holds in, so the pump does",
    run: function (x) {
      var r = made(x, "MAKE CONTROL: Tank fill\nfloat FS1 CR1 nc \x22low level start\x22\nfloat FS2 CR1 nc \x22high level stop\x22\nrelay CR1 \x22fill call\x22\ncoil M1 CR1 \x22pump starter\x22\nEND", FILL2); if (r.err) return r.err;
      return x.lib.sweep(x.sim(r.m, { floats: { FS1: 1, FS2: 2 } }), "M1", FILL_SWEEP);
    } },
  { id: "S-st-copy-labels", harm: "low", why: "the starter given copied with the question's stations named in its own words: two stops and two starts drawn",
    run: function (x) {
      var r = made(x, "MAKE CONTROL: Conveyor starter\nstop PB1 M1 \x22stop, head end\x22\nstop PB2 M1 \x22stop, tail end\x22\nstart PB3 M1 \x22start, head end\x22\nstart PB4 M1 \x22start, tail end\x22\ncoil M1 \x22conveyor starter\x22\noverload OL1 M1\nEND", "Draw a motor starter with start/stop from either end of the conveyor"); if (r.err) return r.err;
      return step(x.sim(r.m), [["tap", "PB4", { M1: true }], ["tap", "PB1", { M1: false }]]);
    } },
  { id: "S-dl-copy-fence", harm: "high", why: "the delayed-start given in a fence with numbered lines: the same circuit",
    run: function (x) {
      var t = x.given("Draw a ladder diagram for a conveyor that starts 5 seconds after the start button is pressed, with a warning horn while it waits");
      if (!t) return "no given";
      var ls = t.split("\n"), body = ls.slice(1, -1).map(function (l, i) { return (i + 1) + ". " + l; });
      var r = made(x, "```text\n" + ls[0] + "\n" + body.join("\n") + "\nEND\n```", "Draw a ladder diagram for a conveyor that starts 5 seconds after the start button is pressed, with a warning horn while it waits"); if (r.err) return r.err;
      return step(x.sim(r.m), [["tap", "PB2", { AH1: true, M1: false }], ["wait", 6, { M1: true, AH1: false }]]);
    } }
];
