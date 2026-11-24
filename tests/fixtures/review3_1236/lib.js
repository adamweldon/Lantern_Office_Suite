// lib.js -- the third review of 1.24.36's givens and code checks: loading the page, reading what the model is shown,
// building a block, and a ladder simulator of the plan Lantern returns. Written for this review; nothing here is taken
// from the earlier reviews' folders.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs");

function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }

// load(file, store) -> {L, w, errs}: the page's script in jsdom; store (optional) is {key: value} put in localStorage
// ("lantern." + key, as JSON; a string value is put as it stands) BEFORE the script runs
function load(file, store) {
  var inner = fs.readFileSync(file, "utf8");
  var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, o = { w: w, d: w.document, errs: errs };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-Q4_K_M.gguf" }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
    return resp(200, JSON.stringify({ choices: [{ message: { content: "ANSWER: ok" }, finish_reason: "stop" }], usage: { completion_tokens: 2 } }), "application/json");
  };
  if (store) Object.keys(store).forEach(function (k) { var v = store[k]; w.localStorage.setItem("lantern." + k, typeof v === "string" ? v : JSON.stringify(v)); });
  w.eval(JS);
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
}

// shown(L, q) -> what the model is shown in place of the example, or null: {head, says, title, lines, block, user}
var HEADS = /^(Lantern’s tested circuit for this|Your own kept circuit for this)(?: \((.*)\))?: write it as it stands, changing only what the question asks:$/;
function shown(L, q) {
  var p = String(L.aiAct.prompt(q) || ""), ls = p.split("\n"), i, m;
  for (i = 0; i < ls.length; i++) { m = HEADS.exec(ls[i]); if (m) break; }
  if (i >= ls.length) return null;
  var mk = ls[i + 1] || "", lines = [], j;
  for (j = i + 2; j < ls.length && ls[j] !== "END"; j++) lines.push(ls[j]);
  var g = { head: m[1], says: m[2] || "", title: mk.replace(/^MAKE CONTROL:\s*/, ""), lines: lines, user: /^Your own/.test(m[1]) };
  g.block = mk + "\n" + lines.join("\n") + "\nEND";
  // which of Lantern's givens it is, by what it says
  g.id = null;
  if (!g.user && L.givens) L.givens.all("CONTROL").forEach(function (x) { if (!x.user && x.says === g.says) g.id = x.id; });
  if (g.user) g.id = "user";
  return g;
}
function controlPrompt(L, q) { return /MAKE CONTROL: <title>/.test(String(L.aiAct.prompt(q) || "")); }

// build(L, block, q) -> {ok, problems, circuit, codes, res}
function build(L, block, q) {
  var r = null, err = null;
  try { r = L.aiAct.build(block, q); } catch (e) { err = String(e && e.message || e); }
  if (!r) return { ok: false, problems: [err || "no block built"], circuit: null, codes: null, res: null };
  return { ok: !!r.ok, problems: r.problems || [], circuit: r.plan && r.plan.circuit, codes: r.codes || null, res: r, notes: r.plan && r.plan.notes };
}
function block(title, lines) { return "MAKE CONTROL: " + title + "\n" + lines.join("\n") + "\nEND"; }
// the "Write it: ..." line of what went back
function writeIt(problems) { var out = []; (problems || []).forEach(function (p) { var m = /Write it: (.*)$/.exec(p); if (m) out.push(m[1]); }); return out; }

// sim(circuit, at) -> a simulator of the ladder as drawn. at: {id: height} for floats, pressure and temperature
// switches (actuated at or above it). A float, pressure or temperature switch is made when actuated (nc: the other
// way); a push button when pressed (nc: the other way); a feed stop or e-stop is closed until pressed; an overload is
// closed until tripped (one written open: closed only when tripped); a selector, limit or other switch is in its run
// position (open[id] = true holds it open); a coil's contact follows the coil, a timer's timed contact follows its
// "done" (set by advance() while the timer is energised, cleared when it drops out).
function sim(c, at) {
  at = at || {};
  var on = {}, done = {}, kinds = {}, st = { level: 0, pressure: 0, temp: 0, pressed: {}, tripped: {}, open: {} };
  c.rungs.forEach(function (r) { on[r.out.id] = false; kinds[r.out.id] = r.out.kind; });
  function act(e) {
    var h = at[e.id];
    if (e.kind === "float") return h != null && st.level >= h;
    if (e.kind === "pressure") return h != null && st.pressure >= h;
    if (e.kind === "temp") return h != null && st.temp >= h;
    return false;
  }
  function closed(e) {
    var k = e.kind;
    if (k === "float" || k === "pressure" || k === "temp") return e.nc ? !act(e) : act(e);
    if (k === "pb" || k === "stop" || k === "start" || k === "button" || k === "estop") { var p = !!st.pressed[e.id]; return e.nc ? !p : p; }
    if (k === "ol") return e.nc ? !st.tripped[e.id] : !!st.tripped[e.id];
    if (k === "contact") { var of = e.of || e.id, v = e.timed ? !!done[of] : !!on[of]; return e.nc ? !v : v; }
    if (k === "fuse") return true;
    // switch, limit, other: in its run position
    var o = !st.open[e.id];
    return e.nc ? o : o;
  }
  function all(l) { return (l || []).every(closed); }
  function feedOk() { return (c.feed || []).every(function (f) { if (f.kind === "fuse") return true; return !st.pressed[f.id]; }); }
  function scan() {
    var nx = {}, fd = feedOk();
    c.rungs.forEach(function (r) {
      var ok = fd && all(r.stops) && all(r.series) && all(r.after);
      if (ok && r.starts && r.starts.length) ok = r.starts.some(closed) || (r.seal && on[r.out.id]);
      if (ok && r.branches && r.branches.length) ok = r.branches.some(all);
      nx[r.out.id] = ok;
    });
    var ch = false;
    Object.keys(nx).forEach(function (k) { if (nx[k] !== on[k]) { ch = true; on[k] = nx[k]; if (!nx[k]) done[k] = false; } });
    return ch;
  }
  function settle() { for (var i = 0; i < 40; i++) if (!scan()) return true; return false; }
  settle();
  var S = {
    st: st, on: function (id) { return !!on[id]; }, done: done,
    level: function (v) { st.level = v; settle(); return S; },
    pressure: function (v) { st.pressure = v; settle(); return S; },
    temp: function (v) { st.temp = v; settle(); return S; },
    press: function (id) { st.pressed[id] = true; settle(); return S; },
    release: function (id) { st.pressed[id] = false; settle(); return S; },
    tap: function (id) { S.press(id); S.release(id); return S; },
    trip: function (id) { st.tripped[id] = true; settle(); return S; },
    reset: function (id) { st.tripped[id] = false; settle(); return S; },
    advance: function () { Object.keys(on).forEach(function (k) { if (kinds[k] === "timer" && on[k]) done[k] = true; }); settle(); return S; },
    stable: settle
  };
  return S;
}
// the ids in a circuit, by what they are
function ids(c) {
  var out = { coils: [], lamps: [], horns: [], timers: [], floats: [], pbs: [], ols: [], feed: (c.feed || []).map(function (f) { return f.id; }) };
  c.rungs.forEach(function (r) {
    if (r.out.kind === "coil") out.coils.push(r.out.id); else if (r.out.kind === "lamp") out.lamps.push(r.out.id); else if (r.out.kind === "horn") out.horns.push(r.out.id); else if (r.out.kind === "timer") out.timers.push(r.out.id);
    [].concat(r.stops, r.starts, r.series, r.after).concat.apply([], r.branches || []).forEach(function (e) {
      if (e.kind === "float" && out.floats.indexOf(e.id) < 0) out.floats.push(e.id);
      if (e.kind === "pb" && out.pbs.indexOf(e.id) < 0) out.pbs.push(e.id);
      if (e.kind === "ol" && out.ols.indexOf(e.id) < 0) out.ols.push(e.id);
    });
    [].concat(r.stops, r.starts, r.series, r.after).forEach(function (e) {
      if (e.kind === "float" && out.floats.indexOf(e.id) < 0) out.floats.push(e.id);
      if (e.kind === "pb" && out.pbs.indexOf(e.id) < 0) out.pbs.push(e.id);
      if (e.kind === "ol" && out.ols.indexOf(e.id) < 0) out.ols.push(e.id);
    });
  });
  return out;
}

module.exports = { load: load, shown: shown, controlPrompt: controlPrompt, build: build, block: block, writeIt: writeIt, sim: sim, ids: ids, textOf: textOf };

// check(id, circuit, opts) -> "" or what the drawing does wrong, for each of Lantern's givens as it behaves
// opts: {stations: n (stops and starts expected), order: [coil ids in the order they may start]}
function check(gid, c, opts) {
  opts = opts || {};
  var I = ids(c), bad = [];
  function want(x, msg) { if (!x) bad.push(msg); }
  function rungOf(id) { return c.rungs.filter(function (r) { return r.out.id === id; })[0]; }
  function lampsFollow(S, where) {
    c.rungs.filter(function (r) { return r.out.kind === "lamp"; }).forEach(function (r) {
      var k = r.series.filter(function (e) { return e.kind === "contact"; })[0];
      if (!k) return;
      var v = S.on(k.of) !== !!k.nc;
      want(S.on(r.out.id) === v, r.out.id + " does not follow " + k.of + " " + where);
    });
  }
  if (gid === "control-starter") {
    var M = I.coils[0], r = rungOf(M), stops = r.stops.map(function (e) { return e.id; }).concat(I.feed.filter(function (f) { return /^PB/.test(f); })), starts = r.starts.map(function (e) { return e.id; });
    if (opts.stations) want(stops.length === opts.stations && starts.length === opts.stations, opts.stations + " stations asked, " + stops.length + " stops and " + starts.length + " starts drawn");
    starts.forEach(function (s) {
      var S = sim(c);
      S.tap(s); want(S.on(M), M + " does not start from " + s); want(S.on(M), M + " does not hold in after " + s);
      lampsFollow(S, "while running");
      stops.forEach(function (p) { var S2 = sim(c); S2.tap(s); S2.tap(p); want(!S2.on(M), p + " does not stop " + M); lampsFollow(S2, "stopped"); });
      I.ols.forEach(function (o) { var S3 = sim(c); S3.tap(s); S3.trip(o); want(!S3.on(M), o + " does not stop " + M); S3.reset(o); want(!S3.on(M), M + " restarts by itself when " + o + " is reset"); });
    });
    (c.feed || []).forEach(function (f) { if (f.kind === "estop") { var S4 = sim(c); S4.tap(starts[0]); S4.press(f.id); want(!S4.on(M), f.id + " does not stop " + M); S4.release(f.id); want(!S4.on(M), M + " restarts when " + f.id + " is released"); } });
  } else if (gid === "control-reversing") {
    var F = c.rungs[0].out.id, R = c.rungs[1].out.id, sf = c.rungs[0].starts[0].id, sr = c.rungs[1].starts[0].id, stp = (c.feed || []).filter(function (f) { return f.kind === "stop"; })[0];
    var S = sim(c); S.tap(sf); want(S.on(F) && !S.on(R), "forward does not start alone");
    S.tap(sr); want(S.on(F) && !S.on(R), "reverse starts while forward runs");
    want(!!stp, "no stop ahead of both"); if (stp) { S.tap(stp.id); want(!S.on(F) && !S.on(R), "the stop does not stop forward"); }
    S.tap(sr); want(S.on(R) && !S.on(F), "reverse does not start after stop");
    S.tap(sf); want(S.on(R) && !S.on(F), "forward starts while reverse runs");
    I.ols.forEach(function (o) { var S2 = sim(c); S2.tap(sr); S2.trip(o); want(!S2.on(R), o + " does not stop reverse"); });
    lampsFollow(S, "in reverse");
  } else if (gid === "control-sequence") {
    var ord = opts.order || I.coils, startOf = {}, stopOf = {};
    c.rungs.forEach(function (rr) { if (rr.starts[0]) startOf[rr.out.id] = rr.starts[0].id; if (rr.stops[0]) stopOf[rr.out.id] = rr.stops[0].id; });
    var S = sim(c);
    for (var i = ord.length - 1; i >= 1; i--) { S.tap(startOf[ord[i]]); want(!S.on(ord[i]), ord[i] + " starts before " + ord[i - 1] + " runs"); }
    ord.forEach(function (m) { S.tap(startOf[m]); want(S.on(m), m + " does not start in its turn"); });
    S.tap(stopOf[ord[0]]); ord.forEach(function (m) { want(!S.on(m), "stopping " + ord[0] + " leaves " + m + " running"); });
  } else if (gid === "control-delayed-start") {
    var M = I.coils.filter(function (x) { return /^M/.test(x); })[0], CR = I.coils.filter(function (x) { return /^CR/.test(x); })[0], T = I.timers[0], st = rungOf(CR).starts[0].id, sp = rungOf(CR).stops[0] ? rungOf(CR).stops[0].id : null;
    var S = sim(c); S.tap(st); want(S.on(CR) && S.on(T) && !S.on(M), "pressing start does not start the timer alone");
    I.horns.forEach(function (h) { want(S.on(h), h + " does not sound while timing"); });
    S.advance(); want(S.on(M), M + " does not start when timed out");
    I.horns.forEach(function (h) { want(!S.on(h), h + " still sounds when the motor runs"); });
    if (sp) { S.tap(sp); want(!S.on(M) && !S.on(CR), "stop does not stop it"); }
    var S2 = sim(c); S2.tap(st); S2.advance(); I.ols.forEach(function (o) { S2.trip(o); want(!S2.on(M) && !S2.on(CR), o + " does not drop the run relay"); S2.reset(o); S2.advance(); want(!S2.on(M), M + " restarts after " + o + " is reset"); });
  } else if (gid === "control-compressor") {
    var M = I.coils[0], ps = null;
    c.rungs.forEach(function (rr) { rr.series.forEach(function (e) { if (e.kind === "pressure") ps = e.id; }); });
    var at = {}; at[ps] = 100;
    var S = sim(c, at); S.pressure(50); want(S.on(M), M + " does not run below the cut-out"); S.pressure(120); want(!S.on(M), M + " runs above the cut-out"); S.pressure(60); want(S.on(M), M + " does not restart as the pressure falls");
    lampsFollow(S, "at cut-in");
  } else if (gid === "control-fill") {
    var M = I.coils[0], at = {}; at[I.floats[0]] = 5;
    var S = sim(c, at); S.level(0); want(S.on(M), "the pump does not run in an empty tank"); S.level(6); want(!S.on(M), "the pump runs in a full tank"); S.level(3); want(S.on(M), "the pump does not refill");
  } else if (gid === "control-fill-two") {
    var M = I.coils[0], r = rungOf(M), lo = (r.starts[0] || {}).id, hi = (r.stops.filter(function (e) { return e.kind === "float"; })[0] || {}).id, at = {};
    want(lo && hi, "the floats are not drawn as a start and a stop");
    at[lo] = 1; at[hi] = 3;
    var S = sim(c, at); S.level(0); want(S.on(M), "not running below the low float"); S.level(2); want(S.on(M), "stops between the floats as the water rises"); S.level(3.5); want(!S.on(M), "runs at the high float");
    S.level(2); want(!S.on(M), "restarts between the floats as the water falls"); S.level(0.5); want(S.on(M), "does not restart below the low float");
  } else if (gid === "control-sump") {
    var M = I.coils[0], r = rungOf(M), fl = r.series.filter(function (e) { return e.kind === "float"; })[0], at = {};
    at[fl.id] = 2; I.floats.forEach(function (f) { if (f !== fl.id) at[f] = 4; });
    var S = sim(c, at); S.level(0); want(!S.on(M), "runs in an empty sump"); S.level(3); want(S.on(M), "does not run as the water rises");
    c.rungs.forEach(function (rr) { if (rr.out.kind === "horn" || (rr.out.kind === "lamp" && rr.series.some(function (e) { return e.kind === "float"; }))) { want(!S.on(rr.out.id), rr.out.id + " alarms below the alarm float"); S.level(5); want(S.on(rr.out.id), rr.out.id + " does not alarm at high water"); S.level(3); } });
  }
  return bad.join("; ");
}
module.exports.check = check;

// loadAt(rev, store): load() from src/lantern.inner.html at a git revision (the release before), written nowhere
module.exports.loadAt = function (rev, store) {
  var os = require("os"), path = require("path"), cp = require("child_process");
  var txt = cp.execSync("git show " + rev + ":src/lantern.inner.html", { cwd: path.resolve(__dirname, "../../.."), maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
  var JS = txt;
  var tmp = { readFileSync: fs.readFileSync };
  fs.readFileSync = function (f, enc) { if (f === "@rev:" + rev) return JS; return tmp.readFileSync.apply(fs, arguments); };
  try { return load("@rev:" + rev, store); } finally { fs.readFileSync = tmp.readFileSync; }
};
