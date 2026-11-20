// (the third review: a copy of ../liftstation_review2_1230/sim.js, read and checked before use -- its alternating relay
// changes over each time it is let go, so a test of the first lead must start from a fresh scan)
// sim.js -- a state simulator of the ladder Lantern returns (plan.circuit), run over a wet well's fill and pump-down.
// Each scan: every rung's output is on when its feed (fuses, stops in L1), its stops, its starts-or-holding contact,
// its series contacts, one of its branches (all of a branch's contacts) and its after (overloads) are closed.
// Contacts: a float is made when the water is at or above it (nc: the other way); a push button is not pressed; an
// overload is closed until it trips; a selector or other switch is in its run position (closed unless nc); a coil's
// contact follows the coil (nc: the other way); an alternating relay's contact follows its STATE, which changes over
// each time the relay is de-energised (state 0: its closed contact "/" is made, state 1: its open contact is made).
"use strict";
function make(circuit, floatAt) {
  var rungs = circuit.rungs, on = {}, alt = {}, altFed = {}, kinds = {};
  rungs.forEach(function (r) { on[r.out.id] = false; kinds[r.out.id] = r.out.kind; if (r.out.kind === "alternator") { alt[r.out.id] = 0; altFed[r.out.id] = false; } });
  var st = { water: 0, tripped: {}, pressed: {}, on: on, alt: alt };
  function closed(e) {
    var c;
    if (e.kind === "float") { var h = floatAt(e.id); c = h != null && st.water >= h; return e.nc ? !c : c; }
    if (e.kind === "pb" || e.kind === "estop" || e.kind === "stop") { c = !!st.pressed[e.id]; return e.nc ? !c : c; }   // pressed: an NO closes, an NC opens
    // (1.24.30, after the review) an overload's open auxiliary contact (nc false: a trip light's) closes when it trips
    if (e.kind === "ol") return e.nc === false ? !!st.tripped[e.id] : !st.tripped[e.id];
    if (e.kind === "fuse") return true;
    if (e.kind === "contact") {
      var of = e.of || e.id;
      if (kinds[of] === "alternator") { var s1 = alt[of] === 1; return e.nc ? !s1 : s1; }
      c = !!on[of]; return e.nc ? !c : c;
    }
    // a switch, limit, pressure, temp: in its run position (an NO made, an NC made)
    return true;
  }
  function all(list) { return (list || []).every(closed); }
  function scan() {
    var feed = (circuit.feed || []).every(function (f) { return closed({ id: f.id, kind: f.kind === "estop" ? "pb" : f.kind === "fuse" ? "fuse" : "pb", nc: f.kind !== "fuse" }); });
    var next = {};
    rungs.forEach(function (r) {
      var ok = feed && all(r.stops) && all(r.series) && all(r.after);
      if (ok && r.starts && r.starts.length) {
        var any = r.starts.some(closed) || (r.seal && on[r.out.id]);
        // one start and no seal: in series
        ok = any;
      }
      if (ok && r.branches && r.branches.length) ok = r.branches.some(function (b) { return all(b); });
      next[r.out.id] = ok;
    });
    var changed = false;
    Object.keys(next).forEach(function (k) {
      if (next[k] !== on[k]) {
        changed = true;
        if (kinds[k] === "alternator" && on[k] && !next[k]) alt[k] = 1 - alt[k];   // let go: changes over
        on[k] = next[k];
      }
    });
    return changed;
  }
  function settle() { for (var i = 0; i < 30; i++) if (!scan()) return true; return false; }
  return {
    st: st,
    set: function (w) { st.water = w; return settle(); },
    trip: function (id, v) { st.tripped[id] = v !== false; return settle(); },
    press: function (id, v) { st.pressed[id] = v !== false; return settle(); },
    on: function (id) { return !!on[id]; }
  };
}
// duplex(circuit, spec) -> [problems]: spec = {floats: {off, lead, lag, alarm}: ids, pumps: [id, id], alarms: [ids],
// runLamps: {lamp: pump}, ols: {ol: pump}}
function duplex(circuit, spec) {
  var lv = { off: 1, lead: 2, lag: 3, alarm: 4 }, at = {}, out = [];
  Object.keys(spec.floats).forEach(function (j) { if (spec.floats[j]) at[spec.floats[j]] = lv[j]; });
  (spec.otherFloats || []).forEach(function (f) { at[f[0]] = f[1]; });
  var S = make(circuit, function (id) { return at[id] == null ? null : at[id]; }), P = spec.pumps, A = spec.alarms || [];
  function running() { return P.filter(function (p) { return S.on(p); }); }
  function want(cond, msg) { if (!cond) out.push(msg); }
  function lampsOk(where) {
    Object.keys(spec.runLamps || {}).forEach(function (l) { want(S.on(l) === S.on(spec.runLamps[l]), l + " does not follow " + spec.runLamps[l] + " " + where); });
  }
  S.set(0); want(!running().length, "a pump runs in an empty well");
  S.set(1.5); want(!running().length, "a pump starts below the lead float");
  var leads = [];
  for (var c = 0; c < 4; c++) {
    S.set(2.5); var r = running();
    want(r.length === 1, "cycle " + (c + 1) + ": " + r.length + " pumps run at the lead float (want 1)"); leads.push(r.join("+"));
    lampsOk("at the lead float, cycle " + (c + 1));
    S.set(1.5); want(running().join() === r.join(), "cycle " + (c + 1) + ": the pump does not hold in between the off and lead floats");
    S.set(0.5); want(!running().length, "cycle " + (c + 1) + ": the off float does not stop the pump");
    lampsOk("after the off float");
  }
  want(leads[0] !== leads[1] && leads[0] === leads[2] && leads[1] === leads[3], "the pumps do not take turns: " + leads.join(", "));
  if (spec.floats.lag) {
    S.set(2.5); S.set(3.5); want(running().length === 2, "the lag float does not run both (" + running().join("+") + ")");
    S.set(2.5); want(running().length === 2, "both do not hold in below the lag float");
    S.set(1.5); want(running().length === 2, "both do not hold in down to the off float");
    S.set(0.5); want(!running().length, "the off float does not stop both");
  } else {
    S.set(2.5); S.set(3.5); want(running().length === 1, "without a lag float, " + running().length + " pumps run above the lead");
    S.set(0.5);
  }
  if (spec.floats.alarm) {
    S.set(3.5); want(A.every(function (a) { return !S.on(a); }), "an alarm is on below the alarm float");
    S.set(4.5); want(A.length && A.every(function (a) { return S.on(a); }), "the alarm float does not light " + A.join(", "));
    S.set(0.5); want(A.every(function (a) { return !S.on(a); }), "the alarm stays on after the well is pumped down");
  }
  // an overload drops its pump, and only its pump
  Object.keys(spec.ols || {}).forEach(function (ol) {
    var p = spec.ols[ol], q = P.filter(function (x) { return x !== p; })[0];
    S.set(0.5); S.trip(ol);
    for (var k = 0; k < 2; k++) { S.set(2.5); want(!S.on(p), ol + " tripped and " + p + " runs"); S.set(0.5); }
    if (spec.floats.lag) { S.set(3.5); want(!S.on(p) && S.on(q), ol + " tripped: at the lag float " + q + " should run and " + p + " not"); S.set(0.5); }
    S.trip(ol, false);
  });
  return out;
}
module.exports = { make: make, duplex: duplex };
