// lib.js -- the second review of 1.24.36's givens: a loader (jsdom, as tests/fixtures/liftstation_review1_1230/load.js,
// with localStorage set before the page's script runs), what the model is shown for a question, and a simulator of the
// ladder Lantern returns (plan.circuit) with push buttons, selector switches, floats by level, pressure switches with a
// cut-in and a cut-out, overloads that trip and reset, and on-delay timers.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs");
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }

// load(file, store) -> {w, d, L, errs}; file: a path, or {text: the page's source}; store: {key: raw string} put in
// localStorage (as "lantern." + key) first
function load(file, store) {
  var inner = typeof file === "object" && file && file.text != null ? file.text : fs.readFileSync(file, "utf8");
  var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, o = { w: w, d: w.document, errs: errs, script: null };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  Object.keys(store || {}).forEach(function (k) { w.localStorage.setItem("lantern." + k, store[k]); });
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url, opts) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-Q4_K_M.gguf" }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    var body = JSON.parse(opts.body);
    var r = o.script ? o.script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
    return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
  };
  try { w.eval(JS); } catch (e) { errs.push("eval: " + e.message); }
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
}

// shown(L, q) -> {prompt, kind: "lantern" | "user" | null, says, title, lines: [...]} -- the given in the prompt, if any
function shown(L, q) {
  var p = String(L.aiAct.prompt(q) || ""), out = { prompt: p, kind: null, says: "", title: "", lines: [] };
  var ls = p.split("\n"), at = -1;
  ls.forEach(function (l, i) { if (at < 0 && /(?:tested circuit for this|kept circuit for this)/.test(l)) at = i; });
  if (at < 0) return out;
  out.kind = /kept circuit/.test(ls[at]) ? "user" : "lantern";
  var m = /\((.*)\): write it as it stands/.exec(ls[at]);
  out.says = m ? m[1] : "";
  out.title = String(ls[at + 1] || "").replace(/^MAKE CONTROL:\s*/, "");
  for (var i = at + 2; i < ls.length && ls[i] !== "END"; i++) out.lines.push(ls[i]);
  return out;
}
// which of Lantern's givens a says text is
function givenId(L, says) {
  if (!L.givens || !L.givens.all) return null;
  var g = (L.givens.all("CONTROL") || []).filter(function (x) { return !x.user && x.says === says; })[0];
  return g ? g.id : null;
}
function blockOf(sh) { return "MAKE CONTROL: " + sh.title + "\n" + sh.lines.join("\n") + "\nEND"; }

// sim(circuit, env) -- env: {floats: {id: height}, ps: {id: {cutin, cutout}}, timers: {id: seconds}}
// state: level, pressure, pressed{}, sw{} (selector on unless set false), tripped{}, limit{} (actuated), dt
function sim(circuit, env) {
  env = env || {};
  var rungs = circuit.rungs, on = {}, kinds = {}, acc = {}, preset = {}, psAct = {};
  rungs.forEach(function (r) {
    on[r.out.id] = false; kinds[r.out.id] = r.out.kind;
    if (r.out.kind === "timer") {
      var m = /(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|min|mins|minutes?|h|hours?)\b/i.exec(r.out.label || "");
      preset[r.out.id] = env.timers && env.timers[r.out.id] != null ? env.timers[r.out.id] : m ? +m[1] * (/^m/i.test(m[2]) ? 60 : /^h/i.test(m[2]) ? 3600 : 1) : 5;
      acc[r.out.id] = 0;
    }
  });
  var st = { level: 0, pressure: 0, temp: 0, pressed: {}, sw: {}, tripped: {}, limit: {}, t: 0 };
  function psState(e) {
    var sp = (env.ps || {})[e.id] || { cutin: 90, cutout: 120 };
    if (psAct[e.id] == null) psAct[e.id] = st.pressure >= sp.cutout;
    if (st.pressure >= sp.cutout) psAct[e.id] = true; else if (st.pressure <= sp.cutin) psAct[e.id] = false;
    return psAct[e.id];
  }
  function closed(e) {
    var c;
    if (e.kind === "float") { var h = (env.floats || {})[e.id]; c = h != null && st.level >= h; return e.nc ? !c : c; }
    if (e.kind === "pressure") { c = psState(e); return e.nc ? !c : c; }
    if (e.kind === "temp") { var ts = (env.ts || {})[e.id] || 100; c = st.temp >= ts; return e.nc ? !c : c; }
    if (e.kind === "limit") { c = !!st.limit[e.id]; return e.nc ? !c : c; }
    if (e.kind === "pb" || e.kind === "estop" || e.kind === "stop") { c = !!st.pressed[e.id]; return e.nc ? !c : c; }
    if (e.kind === "ol") return e.nc === false ? !!st.tripped[e.id] : !st.tripped[e.id];
    if (e.kind === "fuse") return true;
    if (e.kind === "switch") { c = st.sw[e.id] !== false; return e.nc ? !c : c; }
    if (e.kind === "contact") {
      var of = e.of || e.id;
      c = e.timed ? !!on[of] && acc[of] >= preset[of] : !!on[of];
      return e.nc ? !c : c;
    }
    return true;
  }
  function all(list) { return (list || []).every(closed); }
  function scan() {
    var feed = (circuit.feed || []).every(function (f) { return f.kind === "fuse" ? true : !st.pressed[f.id]; });
    var next = {};
    rungs.forEach(function (r) {
      var ok = feed && all(r.stops) && all(r.series) && all(r.after);
      if (ok && r.starts && r.starts.length) ok = r.starts.some(closed) || (r.seal && on[r.out.id]);
      if (ok && r.branches && r.branches.length) ok = r.branches.some(function (b) { return all(b); });
      next[r.out.id] = ok;
    });
    var changed = false;
    Object.keys(next).forEach(function (k) {
      if (next[k] !== on[k]) { changed = true; on[k] = next[k]; if (kinds[k] === "timer" && !next[k]) acc[k] = 0; }
    });
    return changed;
  }
  function settle() { for (var i = 0; i < 40; i++) if (!scan()) return true; return false; }
  var S = {
    st: st,
    on: function (id) { return !!on[id]; },
    level: function (x) { st.level = x; settle(); return S; },
    pressure: function (x) { st.pressure = x; settle(); return S; },
    press: function (id) { st.pressed[id] = true; settle(); return S; },
    release: function (id) { st.pressed[id] = false; settle(); return S; },
    tap: function (id) { S.press(id); S.release(id); return S; },
    sw: function (id, v) { st.sw[id] = v; settle(); return S; },
    trip: function (id) { st.tripped[id] = true; settle(); return S; },
    reset: function (id) { st.tripped[id] = false; settle(); return S; },
    limit: function (id, v) { st.limit[id] = v; settle(); return S; },
    wait: function (sec) {
      for (var t = 0; t < sec; t += 0.5) { Object.keys(acc).forEach(function (k) { if (on[k]) acc[k] += 0.5; }); settle(); }
      st.t += sec; return S;
    },
    settle: settle
  };
  settle();
  return S;
}
// a level sweep for a pump: [level, want on] pairs; returns the first that disagrees, or ""
function sweep(S, id, steps) {
  for (var i = 0; i < steps.length; i++) {
    S.level(steps[i][0]);
    if (S.on(id) !== steps[i][1]) return id + " is " + (S.on(id) ? "on" : "off") + " at level " + steps[i][0] + " (step " + (i + 1) + ", want " + (steps[i][1] ? "on" : "off") + ")";
  }
  return "";
}
// rung of an output in plan.circuit
function rung(made, id) { return made && made.plan && made.plan.circuit ? made.plan.circuit.rungs.filter(function (r) { return r.out.id === id; })[0] || null : null; }
function ids(list) { return (list || []).map(function (e) { return e.id; }); }
module.exports = { load: load, shown: shown, givenId: givenId, blockOf: blockOf, sim: sim, sweep: sweep, rung: rung, ids: ids };
