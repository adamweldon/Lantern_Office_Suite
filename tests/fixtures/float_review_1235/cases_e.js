// cases_e.js -- the rest: tags FTAG no longer takes besides LS (LSHL, LSA, LSW: dropped without a word in the change's
// comment), names FJOB2 joins with & or #, a sensor FJOB2 now reads, and a station's low level alarm float -- the one
// float a lift station draws normally closed -- through MAKE STATION.
"use strict";
var lib = require("./lib.js");
var Q = "write a schematic for a typical lift station";
function sch(parts) { return "MAKE SCHEMATIC: Lift Station\nmode electrical\npart V1 source \x22120 V\x22\n" + parts.join("\n") + "\npart M1 motor \x22Pump 1\x22\npart M2 motor \x22Pump 2\x22\nwire V1 M1\nwire M1 M2\nwire M2 V1\nEND"; }
function fl(m) { var sp = m && m.plan && m.plan.spec; return sp ? sp.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : (m && m.readAs === "STATION" ? "back: " + lib.short(lib.probs(m), 160) : "not a station"); }
var cases = [];
function st(id, harm, parts, check, right) {
  cases.push({ id: id, harm: harm, input: parts.join(" ; ") + " (on: " + Q + ")", right: right,
    run: function () { return lib.boot().then(function (x) { var m = lib.build(x.N.L, sch(parts), Q), o = lib.build(x.O.L, sch(parts), Q), w = check(m, fl(m)); return w ? w + " (1.24.34: " + fl(o) + ")" : ""; }); } });
}
function taken(id) { return function (m, got) { return new RegExp("\\b" + id + ":").test(got) || new RegExp("part " + id + " ").test(lib.probs(m)) ? "" : id + " is not taken as a float: " + got; }; }
function notTaken(id) { return function (m, got) { return new RegExp("\\b" + id + ":").test(got) ? id + " is drawn as a float: " + got : ""; }; }
st("E-isa-lshl", "low", ["part LSHL1 switch", "part LSL1 switch", "part LSH1 switch"], taken("LSHL1"),
  "LSHL is ISA's level switch high-low: a float (1.24.34 took it and asked its job; FTAG now drops it, and the change's comment names only LSL, LSH, LSLL, LSHH)");
st("E-isa-lsa", "low", ["part LSA1 switch", "part LSL1 switch", "part LSH1 switch"], taken("LSA1"),
  "LSA (a level switch with an alarm) on a lift station's schematic: a float (1.24.34 took it)");
st("E-lead-and-lag", "high", ['part SS1 switch "Lead & Lag"'], notTaken("SS1"), "a lead-and-lag selector (SS) is not the lag float");
st("E-pump-hash-off", "low", ['part S1 switch "Pump #2 Off"'], notTaken("S1"), "pump 2's off switch, beside no float at all, is not the station's off float");
st("E-sensor-pump1-off", "low", ['part S1 sensor "Pump 1 Off"'], notTaken("S1"), "a sensor named for one pump's off (a run-status sensor, a current switch): not the station's off float");
st("E-probes-stop-start-high", "high", ['part E1 probe "Stop"', 'part E2 probe "Start"', 'part E3 probe "High"'], function (m, got) { return got === "E1:off,E2:lead,E3:lag" ? "" : "floats " + got; },
  "Adam's probes: High starts the second pump (the lag)");
st("E-fs-stop-start-high", "high", ['part FS1 switch "Stop"', 'part FS2 switch "Start"', 'part FS3 switch "High"'], function (m, got) { return got === "FS1:off,FS2:lead,FS3:lag" ? "" : "floats " + got; },
  "the same as FS switches");
// a station's low level alarm: normally closed, through MAKE STATION
cases.push({ id: "E-station-low-alarm-nc", harm: "high", input: "MAKE STATION with float FS0 \x22low level alarm\x22 and the usual four",
  right: "the low level alarm float drawn normally closed (it opens as the water rises off it), its light lit only while the water is under it",
  run: function () {
    return lib.boot().then(function (x) {
      var m = lib.build(x.N.L, "MAKE STATION: Lift station\npumps 2\nfloat FS0 \x22low level alarm\x22\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22lag on\x22\nfloat FS4 \x22high level alarm\x22\nEND", "Draw the drawings for a duplex lift station with a low level alarm");
      var c = lib.ctl(m); if (!c) return "no ladder: " + lib.probs(m);
      var lamp = c.rungs.filter(function (r) { return r.out.kind === "lamp" && r.series.some(function (e) { return e.id === "FS0"; }); })[0];
      if (!lamp) return "no light on FS0: " + lib.procs(c);
      var at = { FS0: 0.5, FS1: 1, FS2: 2, FS3: 3, FS4: 4 }, S = lib.make(c, function (id) { return at[id] == null ? null : at[id]; }), seen = [];
      [0, 0.7, 2.5, 0.2].forEach(function (v) { S.set(v); seen.push(v + ":" + (S.on(lamp.out.id) ? "lit" : "dark")); });
      var sh = lib.flat(lib.ladderShapes(m)), t = sh.filter(function (s) { return s.t === "text" && s.fs === 12 && s.s === "FS0"; })[0];
      var b = t && sh.filter(function (s) { return s.t === "path" && s.pts.length === 2 && Math.abs(s.pts[0][0] - (t.x - 11)) < 0.5 && Math.abs(s.pts[0][1] - (t.y + 34)) < 0.5; })[0];
      return lib.all([lib.want(seen.join(" ") === "0:lit 0.7:dark 2.5:dark 0.2:lit", "the light: " + seen.join(" ")), lib.want(b && b.pts[1][1] < t.y + 34, "FS0's blade is not drawn resting from above: " + JSON.stringify(b && b.pts))]);
    });
  } });
cases.push({ id: "E-station-floats-low-shorthand", harm: "low", input: "MAKE STATION: ... floats low off lead lag alarm",
  right: "the shorthand's \x22low\x22 (a low level alarm float) is drawn as the long form is, or said not drawn -- never dropped without a word (not this change's doing)",
  run: function () {
    return lib.boot().then(function (x) {
      var m = lib.build(x.N.L, "MAKE STATION: Lift station\npumps 2\nfloats low off lead lag alarm\nEND", "Draw the drawings for a duplex lift station with a low level alarm");
      var got = fl(m);
      return /:low\b/.test(got) || /\blow\b/i.test((m.plan && m.plan.warn || []).join(" ") + " " + (m.summary || "").replace(/low level alarm light/g, "")) ? "" : "floats " + got + "; the summary says nothing of the low float";
    });
  } });
module.exports = cases;
