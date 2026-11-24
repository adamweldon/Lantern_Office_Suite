// judge.js -- what a given shown for a question must be, checked on the circuit Lantern draws from it (act.build for
// that question) with lib's simulator. Each judge returns "" when the given is right for the question, else why.
// Written from US ladder practice (NEMA/JIC): stops normally closed and in series ahead of the starts, starts in parallel
// with the coil's own holding contact, the overload contact after the coil, forward and reverse locked out by each
// other's closed contact, a compressor's pressure switch opening as the pressure rises to the cut-out, a fill float
// opening as the level rises, a sump float closing as the level rises.
"use strict";
var lib = require("./lib.js");
function all(list) { return list.filter(function (x) { return x; }).join("; "); }
// the given shown, its id, and that Lantern drew it clean
function shownOk(g, id) {
  if (!g.s.block) return "no given shown (the instructions' own example instead)";
  if (id && g.s.id !== id) return "the given shown is " + g.s.id + ", not " + id;
  if (!g.m || !g.m.ok || !g.c) return "the given, built for its own question, does not draw clean: " + lib.probs(g.m);
  return "";
}
// what a lamp rung does: "run" (lit while coil on), "stopped" (lit while off), or "?"; S: a simulator, coil id, on/off setters
function lampKinds(c, S, coil, setOn, setOff) {
  var out = [];
  setOff(); var off = lib.lamps(c).map(function (r) { return S.on(r.out.id); });
  setOn(); var on = lib.lamps(c).map(function (r) { return S.on(r.out.id); });
  setOff();
  lib.lamps(c).forEach(function (r, i) { out.push(on[i] && !off[i] ? "run" : !on[i] && off[i] ? "stopped" : on[i] && off[i] ? "always" : "never"); });
  return out.sort();
}
function supplyIs(g, want) {
  var got = g.c && g.c.rails ? String(g.c.rails[0] || "") : "";
  return got === (want || "") ? "" : "the given's supply is " + (got ? "“" + got + "”" : "none") + ", the question's control supply " + (want ? "“" + want + "”" : "none named");
}
// a three-wire starter: exp {stations, lights: [...], supply, load}
function starter(L, q, exp) {
  var g = lib.given(L, q), bad = shownOk(g, "control-starter");
  if (bad) return bad;
  var c = g.c, r = c.rungs.filter(function (x) { return x.out.kind === "coil" && x.starts.length; })[0], why = [];
  if (!r) return "no coil with a start in the given";
  var stops = r.stops.filter(function (e) { return e.kind === "pb" && e.nc; }).concat(c.feed.filter(function (f) { return f.kind === "stop"; }));
  if (stops.length !== exp.stations) why.push(stops.length + " stop(s) where the question asks for " + exp.stations + " station(s)");
  if (r.starts.length !== exp.stations) why.push(r.starts.length + " start(s) where the question asks for " + exp.stations + " station(s)");
  if (!r.seal) why.push("no holding contact across the start");
  if (!r.after.some(function (e) { return e.kind === "ol"; })) why.push("no overload after the coil");
  var id = r.out.id, S = lib.make(c, {});
  r.starts.forEach(function (st) {
    r.stops.concat([]).forEach(function (sp) {
      S.tap(st.id); if (!S.on(id)) why.push("start " + st.id + " does not start " + id);
      S.tap(sp.id); if (S.on(id)) why.push("stop " + sp.id + " does not stop " + id);
    });
    S.tap(st.id); if (!S.on(id)) why.push(id + " does not hold in after " + st.id + " is let go");
    S.trip(r.after[0] ? r.after[0].id : "OL1"); if (S.on(id)) why.push("the overload does not drop " + id);
    S.trip(r.after[0] ? r.after[0].id : "OL1", false); if (S.on(id)) why.push(id + " restarts on its own when the overload is reset");
  });
  var lk = lampKinds(c, S, id, function () { S.tap(r.starts[0].id); }, function () { S.tap(r.stops[0] ? r.stops[0].id : "PB1"); });
  var want = (exp.lights || []).slice().sort();
  if (lk.join(",") !== want.join(",")) why.push("its lights are [" + lk.join(", ") + "] where the question asks for [" + want.join(", ") + "]");
  if (exp.supply !== undefined) { var sp = supplyIs(g, exp.supply); if (sp) why.push(sp); }
  if (exp.load) { var lb = (g.s.lines.filter(function (l) { return /^coil\s/.test(l); })[0] || ""); if (!new RegExp("\\b" + exp.load + "\\b", "i").test(lb)) why.push("its coil is " + lb + ", the question's is a " + exp.load); }
  return all(why);
}
// forward and reverse
function reversing(L, q, exp) {
  var g = lib.given(L, q), bad = shownOk(g, "control-reversing");
  if (bad) return bad;
  var c = g.c, why = [], coils = c.rungs.filter(function (x) { return x.out.kind === "coil"; });
  if (coils.length !== 2) return coils.length + " coils";
  var starts = {}; coils.forEach(function (r) { r.starts.forEach(function (s) { starts[r.out.id] = s.id; }); });
  var f = coils[0].out.id, rv = coils[1].out.id, stop = (c.feed.filter(function (x) { return x.kind === "stop"; })[0] || {}).id || (coils[0].stops[0] || {}).id;
  var S = lib.make(c, {});
  S.tap(starts[f]); if (!S.on(f)) why.push("forward does not start");
  S.tap(starts[rv]); if (S.on(rv)) why.push("reverse pulls in while forward runs (no interlock)");
  if (S.on(f) && S.on(rv)) why.push("both on together");
  S.tap(stop); if (S.on(f) || S.on(rv)) why.push("the stop does not stop it");
  S.tap(starts[rv]); if (!S.on(rv)) why.push("reverse does not start");
  S.tap(starts[f]); if (S.on(f)) why.push("forward pulls in while reverse runs");
  var ol = (coils[0].after[0] || {}).id; S.trip(ol); if (S.on(f) || S.on(rv)) why.push("the overload does not drop it"); S.trip(ol, false);
  if (S.on(f) || S.on(rv)) why.push("it restarts when the overload is reset");
  if (exp && exp.lights !== undefined && lib.lamps(c).length !== exp.lights) why.push(lib.lamps(c).length + " lights where the question asks for " + exp.lights);
  if (exp && exp.supply !== undefined) { var sp = supplyIs(g, exp.supply); if (sp) why.push(sp); }
  return all(why);
}
// M2 only while M1 runs
function sequence(L, q, exp) {
  var g = lib.given(L, q), bad = shownOk(g, "control-sequence");
  if (bad) return bad;
  var c = g.c, why = [], coils = c.rungs.filter(function (x) { return x.out.kind === "coil"; });
  if (exp && exp.motors && coils.length !== exp.motors) why.push(coils.length + " motors where the question has " + exp.motors);
  var m1 = lib.rungOf(c, "M1"), m2 = lib.rungOf(c, "M2");
  if (!m1 || !m2) return all(why.concat(["no M1 and M2"]));
  var S = lib.make(c, {}), s1 = m1.starts[0].id, s2 = m2.starts[0].id, stop = (m1.stops[0] || {}).id;
  S.tap(s2); if (S.on("M2")) why.push("M2 starts while M1 is stopped");
  S.tap(s1); if (!S.on("M1")) why.push("M1 does not start");
  S.tap(s2); if (!S.on("M2")) why.push("M2 does not start once M1 runs");
  S.trip(m1.after[0].id); if (S.on("M2") || S.on("M1")) why.push("M1's overload does not drop both"); S.trip(m1.after[0].id, false);
  if (S.on("M1") || S.on("M2")) why.push("a motor restarts when M1's overload is reset");
  S.tap(s1); S.tap(s2); S.tap(stop); if (S.on("M1") || S.on("M2")) why.push("the stop does not stop both");
  if (exp && exp.labels) { var l1 = (g.s.lines.filter(function (l) { return /^coil M1\b/.test(l); })[0] || ""), l2 = (g.s.lines.filter(function (l) { return /^coil M2\b/.test(l); })[0] || "");
    l1 = (/\x22([^\x22]*)\x22/.exec(l1) || ["", l1])[1]; l2 = (/\x22([^\x22]*)\x22/.exec(l2) || ["", l2])[1];
    if (!exp.labels[0].test(l1) || !exp.labels[1].test(l2)) why.push("its coils are " + l1 + " and " + l2 + "; the question's first is " + exp.labels[0] + ", the one that waits " + exp.labels[1]); }
  return all(why);
}
// a delayed start: exp {time: "30 s", horn: bool}
function delayed(L, q, exp) {
  var g = lib.given(L, q), bad = shownOk(g, "control-delayed-start");
  if (bad) return bad;
  var c = g.c, why = [], tm = c.rungs.filter(function (x) { return x.out.kind === "timer"; })[0], m = c.rungs.filter(function (x) { return x.out.kind === "coil" && x.out.id !== "CR1" && x.series.some(function (e) { return e.timed; }); })[0];
  if (!tm || !m) return "no timer, or no motor on the timer's contact";
  var cr = c.rungs.filter(function (x) { return x.starts.length; })[0], horn = c.rungs.filter(function (x) { return x.out.kind === "horn"; })[0];
  var S = lib.make(c, {});
  S.tap(cr.starts[0].id);
  if (S.on(m.out.id)) why.push("the motor starts at once");
  if (!S.on(tm.out.id)) why.push("the timer is not timing");
  if (horn && !S.on(horn.out.id)) why.push("the warning is silent while it times");
  S.elapse(); if (!S.on(m.out.id)) why.push("the motor does not start when the timer times out");
  if (horn && S.on(horn.out.id)) why.push("the warning still sounds once the motor runs");
  S.tap(cr.stops[0].id); if (S.on(m.out.id) || S.on(tm.out.id)) why.push("the stop does not stop it");
  if (exp && exp.time && !g.s.lines.some(function (l) { return l.indexOf("\x22" + exp.time + "\x22") >= 0; })) why.push("its timer is " + (g.s.lines.filter(function (l) { return /^timer/.test(l); })[0] || "none") + ", the question's " + exp.time);
  if (exp && exp.horn !== undefined && !!horn !== exp.horn) why.push(horn ? "a warning horn the question does not ask for" : "no warning horn where the question asks for one");
  if (exp && exp.supply !== undefined) { var sp = supplyIs(g, exp.supply); if (sp) why.push(sp); }
  return all(why);
}
// a process switch: exp {id: given id, kind: "pressure"|"float", rise: "opens"|"closes", lights: n, label: RegExp, supply}
function process(L, q, exp) {
  var g = lib.given(L, q), bad = shownOk(g, exp.id);
  if (bad) return bad;
  var c = g.c, why = [], sw = lib.elements(c).filter(function (x) { return x.e.kind === exp.kind; });
  if (sw.length !== 1) return sw.length + " " + exp.kind + " switches";
  var m = c.rungs.filter(function (x) { return x.out.kind === "coil"; })[0], at = {}; at[sw[0].e.id] = 10;
  var S = lib.make(c, at);
  S.set(0); var low = S.on(m.out.id); S.set(20); var high = S.on(m.out.id);
  if (exp.rise === "opens" && !(low && !high)) why.push("the motor is " + (low ? "on" : "off") + " below the switch and " + (high ? "on" : "off") + " above it: the switch must open as the " + (exp.kind === "pressure" ? "pressure" : "level") + " rises");
  if (exp.rise === "closes" && !(!low && high)) why.push("the pump is " + (low ? "on" : "off") + " below the float and " + (high ? "on" : "off") + " above it: the float must close as the level rises");
  S.set(exp.rise === "opens" ? 0 : 20); var ol = (m.after[0] || {}).id; S.trip(ol); if (S.on(m.out.id)) why.push("the overload does not drop it"); S.trip(ol, false);
  if (exp.lights !== undefined && lib.lamps(c).length !== exp.lights) why.push(lib.lamps(c).length + " light(s) where the question asks for " + exp.lights);
  if (exp.lampRun !== undefined) lib.lamps(c).forEach(function (r) { var lab = r.out.label || ""; if (!exp.lampRun.test(lab)) why.push("its light is “" + lab + "” where the question asks for " + exp.lampRun); });
  if (exp.label && !g.s.lines.some(function (l) { return exp.label.test(l); })) why.push("no line like " + exp.label + " in " + lib.short(g.s.lines.join(" / "), 200));
  if (exp.supply !== undefined) { var sp = supplyIs(g, exp.supply); if (sp) why.push(sp); }
  return all(why);
}
// no given: the prompt exactly as 1.24.35 gave it for this question
function none(x, q) {
  var a = lib.shown(x.N.L, q), pn = a.prompt, po = lib.prompt(x.O.L, q);
  if (a.block) return "shown the given " + a.id + ": " + lib.short(a.lines.join(" / "), 260);
  return pn === po ? "" : "no given, but the prompt differs from 1.24.35's";
}
module.exports = { starter: starter, reversing: reversing, sequence: sequence, delayed: delayed, process: process, none: none, shownOk: shownOk, all: all };
