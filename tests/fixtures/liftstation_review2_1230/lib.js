// lib.js -- helpers the second review's cases share (the second, independent review of 1.24.30's lift station).
// H = helpers(o): o is load.js's loaded Lantern (o.L, o.script). Every helper reads Lantern only through its public
// API (Lantern.aiAct, aiParts, aiPumpStation, aiControl, CHAT).
"use strict";
var sim = require("./sim.js");

function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
// the usual floats and pumps, as the instructions' example names them
var F4 = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"'];
var PUMPS = ['coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'];
// the instructions' own example for a pump station, as a small model copies it
var EXAMPLE = ['supply "120 V AC"'].concat(F4, ["alternator AR M1 M2"], PUMPS, ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red']);
var ADAM_Q = "create a diagram for a typical 2 pump lift station control with alternating relay. Then create a plumbing schematic for the same and a drawing showing float level positioning";
var CTRL_Q = "Draw the control circuit for a typical 2 pump lift station with an alternating relay";

function helpers(o) {
  var L = o.L, H = {};
  H.L = L; H.o = o; H.blk = blk; H.F4 = F4; H.PUMPS = PUMPS; H.EXAMPLE = EXAMPLE; H.ADAM_Q = ADAM_Q; H.CTRL_Q = CTRL_Q;
  H.build = function (text, q) { return L.aiAct.build(text, q || CTRL_Q); };
  H.fix = function (r, q) { return L.aiAct.fixText(r, q || CTRL_Q); };
  H.rung = function (r, id) { return r && r.plan && r.plan.circuit ? r.plan.circuit.rungs.filter(function (g) { return g.out.id === id; })[0] : null; };
  H.circuit = function (r) { return r && r.plan && r.plan.circuit; };
  H.said = function (r) { var c = H.circuit(r); return c ? (c.added || []).concat(c.changed || []).join(" | ") : ""; };
  // the overloads Lantern drew after each pump's coil
  H.ols = function (r, pumps) {
    var m = {};
    pumps.forEach(function (p) { var g = H.rung(r, p); (g ? g.after : []).forEach(function (e) { if (e.kind === "ol" && e.nc) m[e.id] = p; }); });
    return m;
  };
  // a duplex built and simulated: "" when it fills, alternates, pumps down, runs both at the lag float, alarms, and an
  // overload takes out only its pump; else what went wrong. spec as sim.duplex's; ols found from the drawing if absent
  H.duplex = function (r, spec) {
    if (!r) return "no block was read";
    if (!r.ok) return "not drawn: " + (r.problems || []).join("; ");
    var s = {};
    Object.keys(spec).forEach(function (k) { s[k] = spec[k]; });
    if (!s.ols) s.ols = H.ols(r, s.pumps);
    // the alarm outputs, when the case names none: the lights and horns on the alarm float (one Lantern added, say)
    if (!s.alarms && s.floats.alarm) s.alarms = H.circuit(r).rungs.filter(function (g) {
      return /^(lamp|horn)$/.test(g.out.kind) && [].concat.apply(g.series, g.branches || []).some(function (e) { return e.kind === "float" && e.id === s.floats.alarm; });
    }).map(function (g) { return g.out.id; });
    if (Object.keys(s.ols).length < s.pumps.length) return "a pump has no overload in its rung (" + JSON.stringify(s.ols) + ")";
    var p = sim.duplex(H.circuit(r), s);
    return p.length ? "the circuit does not work: " + p.join("; ") : "";
  };
  // a simplex (one pump, an off float and an on float): the pump starts at the on float, holds down to the off float
  H.simplex = function (r, offId, onId, pump) {
    if (!r || !r.ok) return "not drawn: " + (r ? (r.problems || []).join("; ") : "no block");
    var at = {}; at[offId] = 1; at[onId] = 2;
    var S = sim.make(H.circuit(r), function (id) { return at[id] == null ? null : at[id]; }), out = [];
    S.set(0.5); if (S.on(pump)) out.push("runs below the off float");
    S.set(2.5); if (!S.on(pump)) out.push("does not start at the on float");
    S.set(1.5); if (!S.on(pump)) out.push("stops as soon as the water drops below the on float (the off float does nothing: it short-cycles)");
    S.set(0.5); if (S.on(pump)) out.push("does not stop at the off float");
    return out.join("; ");
  };
  // MAKE LEVELS / MAKE PIPING
  H.levels = function (body, q) { return L.aiAct.build("MAKE LEVELS: Wet well\n" + body.join("\n") + "\nEND", q || "Draw the float levels in the wet well of a duplex lift station"); };
  H.piping = function (body, q) { return L.aiAct.build("MAKE PIPING: Lift station\n" + body.join("\n") + "\nEND", q || "Draw the plumbing schematic for a duplex sewage lift station"); };
  // the heights the levels plan has, in metres (rounded to the millimetre), by float id
  H.heights = function (r) { var m = {}; ((r && r.plan && r.plan.floats) || []).forEach(function (f) { m[f.id] = f.m == null ? null : Math.round(f.m * 1000) / 1000; }); return m; };
  // where the drawing puts each float: the y of its dashed level line (the painter's own shapes), by float id order
  H.levelYs = function (r) {
    var sh = (r && r.shapes) || [], ys = [];
    sh.forEach(function (s) { if (s.t === "path" && s.d && s.d[0] === 9 && s.pts && s.pts.length === 2 && s.pts[0][1] === s.pts[1][1]) ys.push(s.pts[0][1]); });
    return ys;
  };
  // the inlet's dashed line (grey, dashes 3/5)
  H.inletY = function (r) {
    var sh = (r && r.shapes) || [], y = null;
    sh.forEach(function (s) { if (s.t === "path" && s.d && s.d[0] === 3 && s.d[1] === 5) y = s.pts[0][1]; });
    return y;
  };
  // the drawn heights checked against the heights written (metres above the floor), to scale
  H.scaleOk = function (r, want) {
    var ys = H.levelYs(r), fl = r.plan.floats;
    if (ys.length !== fl.length) return "drew " + ys.length + " level lines for " + fl.length + " floats";
    var floorY = 590;   // the well's floor in the drawing (layoutLevels' FL)
    var k = null, bad = [];
    fl.forEach(function (f, i) {
      var w = want[f.id];
      if (w == null) return;
      var kk = (floorY - ys[i]) / w;
      if (k == null) k = kk; else if (Math.abs(kk - k) / k > 0.01) bad.push(f.id + " drawn at " + Math.round(floorY - ys[i]) + " px for " + w + " m");
    });
    return bad.join("; ");
  };
  H.split = function (q) { var p = L.aiParts.split(q); return p ? p.map(function (x) { return x.kind; }) : null; };
  H.parts = function (q) { return L.aiParts.split(q); };
  function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
  // a whole Chat turn against a scripted model: replies in order (the last again if more are asked)
  H.turn = function (q, replies) {
    var i = 0, sent = [], notes = [];
    o.script = function (last) { sent.push(last); var r = replies[Math.min(i, replies.length - 1)]; i++; return r; };
    return L.CHAT.turn([], q, { note: function (t) { notes.push(String(t)); } }, {}).then(function (rec) {
      o.script = null;
      return { rec: rec, sent: sent, notes: notes, calls: i, mades: (rec.mades || []).map(function (m) { return (m.block ? String(m.block.kind).toUpperCase() : "?") + (m.ok ? "" : "(not made)"); }) };
    });
  };
  // the bench's path
  H.solve = function (q, replies) {
    var i = 0, sent = [];
    function call(msgs) { sent.push(textOf(msgs[msgs.length - 1].content)); var r = replies[Math.min(i, replies.length - 1)]; i++; return Promise.resolve(r); }
    return L.aiAct.solve(q, call).then(function (out) {
      return { out: out, sent: sent, calls: i, parts: (out.parts || []).map(function (p) { return p.kind + (p.ok ? "" : "(not made)"); }) };
    });
  };
  return H;
}
module.exports = { helpers: helpers, blk: blk, F4: F4, PUMPS: PUMPS, EXAMPLE: EXAMPLE, ADAM_Q: ADAM_Q, CTRL_Q: CTRL_Q };
