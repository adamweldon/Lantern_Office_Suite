// lib.js -- the third review's helpers (1.24.30's lift station, tried by a reviewer who did not write it).
// load.js and sim.js are copies of the second review's harness (read and checked before use: load.js runs the
// page's script in jsdom with a scripted model; sim.js scans a ladder plan over a well's fill and pump-down).
// Everything here reads Lantern through its public API only.
"use strict";
var path = require("path"), fs = require("fs");
var load = require("./load.js"), sim = require("./sim.js");
var ROOT = path.resolve(__dirname, "../../..");
var cur = null, old = null;
function L() { if (!cur) cur = load(path.join(ROOT, "src/lantern.inner.html")); return cur.L; }
function O() { if (!cur) L(); return cur; }

function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function ctl(lines, title) { return blk("CONTROL", title || "Circuit", lines); }
var ADAM_Q = "create a diagram for a typical 2 pump lift station control with alternating relay. Then create a plumbing schematic for the same and a drawing showing float level positioning";

// a build's control circuit as plain data
function rungs(r) { return r && r.plan && r.plan.circuit ? r.plan.circuit.rungs : null; }
function rung(r, id) { var rs = rungs(r) || []; return rs.filter(function (g) { return g.out.id === id; })[0] || null; }
function said(r) { var c = r && r.plan && r.plan.circuit; return c ? (c.added || []).concat(c.changed || []).join(" | ") : ""; }
// a signature of the circuit drawn (to compare two versions): every rung with its parts in order
function sig(r) {
  if (!r) return "null";
  if (!r.ok) return "PROBLEMS: " + (r.problems || []).join(" ;; ");
  function e(x) { return x.id + (x.of && x.of !== x.id ? "<" + x.of : "") + (x.nc ? "/" : "") + ":" + x.kind; }
  var c = r.plan.circuit;
  return (c.feed || []).map(function (f) { return "feed " + f.id + ":" + f.kind; }).concat(c.rungs.map(function (g) {
    return g.out.id + "[" + g.out.kind + "/" + g.out.type + "] stops(" + g.stops.map(e) + ") starts(" + g.starts.map(e) + ")" + (g.seal ? " seal" : "") +
      " series(" + g.series.map(e) + ") after(" + g.after.map(e) + ")" + (g.branches ? " br(" + g.branches.map(function (b) { return b.map(e).join("&"); }).join(" | ") + ")" : "");
  })).join("\n");
}
// simulate a circuit: levels at which each float is made (water at or above), and a schedule of water levels;
// returns the list of the named outputs' states at each level
function run(r, at, levels, outs, opts) {
  var S = sim.make(r.plan.circuit, function (id) { return at[id] == null ? null : at[id]; });
  opts = opts || {};
  if (opts.press) Object.keys(opts.press).forEach(function (k) { S.press(k, opts.press[k]); });
  return levels.map(function (w) { S.set(w); return outs.map(function (o) { return S.on(o) ? 1 : 0; }).join(""); });
}
// a pump that empties: starts at the on float, holds down to the off float, stops below it; fill and drain twice
function pumpDown(r, offId, onId, pump) {
  if (!r || !r.ok) return "not drawn: " + (r ? (r.problems || []).join("; ") : "no block");
  var at = {}; at[offId] = 1; at[onId] = 2;
  var got = run(r, at, [0, 1.5, 2.5, 1.5, 0.5, 1.5, 2.5, 0.5], [pump]).join("");
  return got === "00110010" ? "" : "pump-down sequence " + got + " (want 00110010: off empty, off rising to the on float, on at it, holds falling, off below the off float)";
}
// a pump that fills: on below the low float, holds while rising, off at the high float, stays off falling to the low one
// lowNc/highNc: the floats are drawn as written (nc); low at 1, high at 2
function fill(r, lowId, highId, pump) {
  if (!r || !r.ok) return "not drawn: " + (r ? (r.problems || []).join("; ") : "no block");
  var at = {}; at[lowId] = 1; at[highId] = 2;
  var got = run(r, at, [0, 1.5, 2.5, 1.5, 0.5, 1.5, 2.5], [pump]).join("");
  return got;
}
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
// a whole Chat turn against a scripted model: replies in order (the last again if more are asked); returns what the
// person saw (notes), what the model was sent (the last user message of each call, and the first call's whole body)
function turn(q, replies) {
  var o = O(), i = 0, sent = [], bodies = [], notes = [];
  o.script = function (last, body) { sent.push(last); bodies.push(body); var r = typeof replies === "function" ? replies(last, i) : replies[Math.min(i, replies.length - 1)]; i++; return r; };
  return L().CHAT.turn([], q, { note: function (t) { notes.push(String(t)); } }, {}).then(function (rec) {
    o.script = null;
    return { rec: rec, sent: sent, bodies: bodies, notes: notes, calls: i,
      mades: (rec.mades || []).map(function (m) { return (m.block ? String(m.block.kind).toUpperCase() : "?") + (m.ok ? "" : "(not made)"); }) };
  }, function (e) { o.script = null; return { error: String(e && e.stack || e), notes: notes, sent: sent, calls: i, mades: [] }; });
}
// the bench's path
function solve(q, replies) {
  var i = 0, sent = [];
  function call(msgs) { sent.push(textOf(msgs[msgs.length - 1].content)); var r = typeof replies === "function" ? replies(textOf(msgs[msgs.length - 1].content), i) : replies[Math.min(i, replies.length - 1)]; i++; return Promise.resolve(r); }
  return L().aiAct.solve(q, call).then(function (out) {
    return { out: out, sent: sent, calls: i, parts: (out.parts || []).map(function (p) { return p.kind + (p.ok ? "" : "(not made)"); }) };
  });
}
function split(q) { var p = L().aiParts.split(q); return p ? p.map(function (x) { return x.kind; }) : null; }
module.exports = { L: L, O: O, blk: blk, ctl: ctl, ADAM_Q: ADAM_Q, rungs: rungs, rung: rung, said: said, sig: sig, run: run, pumpDown: pumpDown, fill: fill, sim: sim,
  turn: turn, solve: solve, split: split, textOf: textOf, ROOT: ROOT, load: load };
