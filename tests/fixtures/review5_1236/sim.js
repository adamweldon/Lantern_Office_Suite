// sim.js -- the review's own ladder simulator (review5_1236): steps a built control circuit (plan.circuit) through a
// sequence of inputs and says which outputs are on. Written for this review from what a ladder diagram means, not from
// Lantern's code: a rung is on while every stop, series element and overload is closed and, where it has starts, one
// start is closed or (sealed) its own output is already on; with branches, one branch closed.
// env: {pressed: {PB1: 1}, level: n, at: {FS1: height}, p: n, setp: {PS1: n}, t: n, sett: {TS1: n}, off: {SS1: 1},
//       tripped: {OL1: 1}, done: {TR1: 1} (a timer that has timed out), act: {LS1: 1}}
"use strict";
function closed(e, env, on) {
  var k = e.kind, nc = !!e.nc, x;
  if (k === "pb" || k === "estop" || k === "stop" || k === "button") x = !!(env.pressed || {})[e.id];
  else if (k === "ol") x = !!(env.tripped || {})[e.id];
  else if (k === "contact") { x = !!on[e.of]; if (e.timed) x = x && !!(env.done || {})[e.of]; }
  else if (k === "float") x = (env.level || 0) > ((env.at || {})[e.id] != null ? env.at[e.id] : 5);
  else if (k === "pressure") x = (env.p || 0) > ((env.setp || {})[e.id] != null ? env.setp[e.id] : 100);
  else if (k === "temp") x = (env.t || 0) > ((env.sett || {})[e.id] != null ? env.sett[e.id] : 50);
  else if (k === "switch") x = !(env.off || {})[e.id];
  else if (k === "limit") x = !!(env.act || {})[e.id];
  else if (k === "fuse") return true;
  else x = false;
  return nc ? !x : x;
}
// the floats' heights: those that bound the cycle, and others (base.at2: a guard float, an alarm float) beside them
function merge(a, b) { var o = {}, k; for (k in (a || {})) o[k] = a[k]; for (k in (b || {})) o[k] = b[k]; return o; }
// one settled state from the last one
function settle(c, env, prev) {
  var on = {}, k, i;
  for (k in prev) on[k] = prev[k];
  var feedOk = (c.feed || []).every(function (f) {
    if (f.kind === "fuse") return true;
    return !(env.pressed || {})[f.id];   // a stop or e-stop in L1: closed unless pressed (drawn closed)
  });
  for (i = 0; i < 30; i++) {
    var next = {}, changed = false;
    c.rungs.forEach(function (r) {
      var id = r.out.id;
      if (!feedOk) { next[id] = false; return; }
      var ok = (r.stops || []).every(function (e) { return closed(e, env, on); }) && (r.series || []).every(function (e) { return closed(e, env, on); }) && (r.after || []).every(function (e) { return closed(e, env, on); });
      var st = r.starts || [];
      if (ok && st.length) {
        if (r.seal) ok = st.some(function (e) { return closed(e, env, on); }) || !!on[id];
        else if (st.length > 1) ok = st.some(function (e) { return closed(e, env, on); });
        else ok = closed(st[0], env, on);
      }
      if (ok && r.branches) ok = r.branches.some(function (b) { return b.every(function (e) { return closed(e, env, on); }); });
      next[id] = !!ok;
    });
    for (k in next) if (next[k] !== on[k]) changed = true;
    on = next;
    if (!changed) break;
  }
  return on;
}
// run(c, [env...]) -> the states after each step (each env is the inputs at that step; a step carries the outputs on)
function run(c, steps) {
  var on = {}, out = [];
  steps.forEach(function (env) { on = settle(c, env, on); out.push(on); });
  return out;
}
// a tank filled by output `pump` from `start` (low) to `stop` (high): the water falls 1 a step while the pump is off and
// rises 1 while it runs. Returns problems: never started below the low float, stopped before the high one, ran above it
function fillCycle(c, pump, at, base) {
  var lo = Math.min.apply(null, Object.keys(at).map(function (k) { return at[k]; })), hi = Math.max.apply(null, Object.keys(at).map(function (k) { return at[k]; }));
  var level = hi + 1, on = {}, bad = [], ranBelow = false, stoppedMid = false, ranAbove = false, cycles = 0, was = false;
  for (var s = 0; s < 60; s++) {
    var env = {}; for (var b in (base || {})) env[b] = base[b];
    env.level = level; env.at = merge((base || {}).at2, at);
    on = settle(c, env, on);
    var p = !!on[pump];
    if (p && level > hi) ranAbove = true;
    if (!p && level < lo) ranBelow = true;   // below the low float and not running (after one step to react)
    if (was && !p && level < hi) stoppedMid = true;
    if (!was && p) cycles++;
    was = p;
    level += p ? 1 : -1;
  }
  if (cycles === 0) bad.push("never started");
  if (ranAbove) bad.push("ran with the water above the high float");
  if (stoppedMid) bad.push("stopped before the water reached the high float (short-cycling)");
  if (ranBelow && cycles === 0) bad.push("stayed off below the low float");
  return bad;
}
// a sump emptied by output `pump`: the water rises 1 a step while it is off and falls 1 while it runs
function sumpCycle(c, pump, at, base) {
  var lo = Math.min.apply(null, Object.keys(at).map(function (k) { return at[k]; })), hi = Math.max.apply(null, Object.keys(at).map(function (k) { return at[k]; }));
  var level = 0, on = {}, bad = [], cycles = 0, ranDry = false, overflow = false, was = false;
  for (var s = 0; s < 60; s++) {
    var env = {}; for (var b in (base || {})) env[b] = base[b];
    env.level = level; env.at = merge((base || {}).at2, at);
    on = settle(c, env, on);
    var p = !!on[pump];
    if (p && level < lo - 1) ranDry = true;
    if (level > hi + 2) overflow = true;
    if (!was && p) cycles++;
    was = p;
    level += p ? -1 : 1;
  }
  if (!cycles) bad.push("never started");
  if (ranDry) bad.push("ran with the water below its float");
  if (overflow) bad.push("let the water rise past its float");
  return bad;
}
module.exports = { closed: closed, settle: settle, run: run, fillCycle: fillCycle, sumpCycle: sumpCycle };
