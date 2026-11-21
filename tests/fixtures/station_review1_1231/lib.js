// lib.js -- the first review of 1.24.31 (MAKE STATION, the floatless duplex, the block grammars), by a reviewer that
// did not write them. load.js and sim.js are copies of the third 1.24.30 review's harness (read before use: load.js
// runs the page's script in jsdom with a scripted model; sim.js scans a ladder over a well's fill and pump-down).
// Everything here reads Lantern through its public API only.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var load = require("./load.js"), sim = require("./sim.js");
var ROOT = path.resolve(__dirname, "../../..");
var cur = null, old = null, detected = null;
function O() { if (!cur) cur = load(process.env.LANTERN_SRC || path.join(ROOT, "src/lantern.inner.html")); return cur; }
function L() { return O().L; }
// 1.24.30 as it was before this work (commit ad0d654), for the cases that compare
function OLD() {
  if (old) return old.L;
  var tmp = path.join(os.tmpdir(), "lantern-ad0d654.inner.html");
  if (!fs.existsSync(tmp)) fs.writeFileSync(tmp, cp.execFileSync("git", ["show", "ad0d654:src/lantern.inner.html"], { cwd: ROOT, maxBuffer: 64 << 20 }));
  old = load(tmp);
  return old.L;
}
// the server found once (the mock answers /props, so it is llama.cpp's)
function ready() { if (!detected) detected = Promise.resolve(L().ai.detect()); return detected; }

function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function st(lines, title) { return blk("STATION", title || "Lift station", lines); }
var ADAM_Q = "create a diagram for a typical 2 pump lift station control with alternating relay. Then create a plumbing schematic for the same and a drawing showing float level positioning";
var Q_B = "Draw the ladder diagram for a duplex sewage pump station whose two pumps take turns through an alternating relay, with a lag float that runs both. Then draw the piping of the station, and a drawing of the float levels in its wet well.";
var Q_DESIGN = "Design a duplex lift station: its control circuit, its piping and its float levels";
var Q_PLAIN = "Design a lift station: draw its control circuit, its piping and its float levels";   // no count of pumps
var Q_SIMPLEX = "Design a simplex sump pump station: the control, the piping and the float levels";

function build(text, q) { return L().aiAct.build(text, q); }
function plan(r) { return r && r.plan && r.plan.mode === "station" ? r.plan : null; }
function said(r) { var p = plan(r); return p ? p.said.join(" | ") : ""; }
function ctlOf(r) { var p = plan(r); return p && p.views.control ? p.views.control.circuit : null; }
function byJob(r) { var p = plan(r), m = {}; (p ? p.spec.floats : []).forEach(function (f) { if (!m[f.job]) m[f.job] = f.id; }); return m; }
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }

// the control circuit of a station, simulated: a duplex takes turns, holds in, the lag runs both, the alarm lights only
// at the alarm float, an overload drops only its own pump; a simplex pumps down and holds in
function contactsOf(g) { return g.starts.concat(g.stops, g.series, g.after, [].concat.apply([], g.branches || [])); }
function alarmLamps(c, alarmIds) {
  return c.rungs.filter(function (g) { return (g.out.kind === "lamp" || g.out.kind === "horn") && g.series.concat(g.starts).some(function (e) { return alarmIds.indexOf(e.id) >= 0; }); }).map(function (g) { return g.out.id; });
}
function runLamps(c) {
  var m = {};
  c.rungs.forEach(function (g) { if (g.out.kind === "lamp") g.series.forEach(function (e) { if (e.kind === "contact" && !e.nc && /^M\d/.test(e.of || e.id)) m[g.out.id] = e.of || e.id; }); });
  return m;
}
function olsOf(c) { var m = {}; c.rungs.forEach(function (g) { g.after.concat(g.series).forEach(function (e) { if (e.kind === "ol" && e.nc !== false && /^M\d/.test(g.out.id)) m[e.id] = g.out.id; }); }); return m; }
function controlRight(r) {
  var p = plan(r), c = ctlOf(r);
  if (!p) return "not a station: " + (r ? (r.problems || []).join("; ") : "no block");
  var n = p.spec.pumps.length, j = byJob(r);
  if (n > 2) return c ? "a control circuit drawn for " + n + " pumps" : "";
  if (!c) return "no control circuit drawn";
  var alarms = p.spec.floats.filter(function (f) { return f.job === "alarm"; }).map(function (f) { return f.id; });
  var al = alarmLamps(c, alarms);
  if (alarms.length && !al.length) return "no light on the alarm float";
  // every float of the station is in the circuit, and no other float is
  var inC = {};
  c.rungs.forEach(function (g) { contactsOf(g).forEach(function (e) { if (e.kind === "float") inC[e.id] = 1; }); });
  var want = p.spec.floats.map(function (f) { return f.id; }).sort().join(","), got = Object.keys(inC).sort().join(",");
  if (want !== got) return "the circuit's floats " + got + " are not the station's " + want;
  if (n === 2) {
    var out = sim.duplex(c, { floats: { off: j.off, lead: j.lead, lag: j.lag || null, alarm: j.alarm || null }, pumps: ["M1", "M2"], alarms: al, runLamps: runLamps(c), ols: olsOf(c),
      otherFloats: j.low ? [[j.low, 0.5]] : [] });
    return out.join("; ");
  }
  // a simplex: on at the lead float, held in to the off float, the alarm light at the alarm float only
  var at = {}; at[j.off] = 1; at[j.lead] = 2; if (j.alarm) at[j.alarm] = 3;
  var S = sim.make(c, function (id) { return at[id] == null ? null : at[id]; }), seq = [];
  [0, 1.5, 2.5, 1.5, 0.5, 1.5].forEach(function (w) { S.set(w); seq.push(S.on("M1") ? 1 : 0); });
  if (seq.join("") !== "001100") return "the simplex pump-down " + seq.join("") + " (want 001100)";
  if (al.length) { S.set(2.5); if (al.some(function (a) { return S.on(a); })) return "the alarm light is on below the alarm float"; S.set(3.5); if (!al.every(function (a) { return S.on(a); })) return "the alarm float does not light the alarm"; }
  return "";
}
// the piping: each pump with its check valve and then its shutoff valve
function pipingRight(r, n, valve) {
  var p = plan(r);
  if (!p) return "not a station";
  var pp = p.views.piping;
  if (!pp) return "no piping drawn";
  if (pp.pumps.length !== n) return pp.pumps.length + " pumps piped (want " + n + ")";
  var bad = pp.pumps.filter(function (x) { return !x.check || !x.valve; });
  if (bad.length) return "a pump without its check or shutoff valve: " + bad.map(function (x) { return x.id; }).join(",");
  if (valve != null && pp.pumps.some(function (x) { return (x.valveKind || "") !== valve; })) return "valve kind " + pp.pumps.map(function (x) { return x.valveKind || "-"; }).join(",") + " (want " + (valve || "none said") + ")";
  return "";
}
// the levels: the station's floats in order from the bottom, the heights written, to scale when all are given
var FLOOR = 590;
function levelYs(v) { var ys = []; (v && v.shapes || []).forEach(function (s) { if (s.t === "path" && s.d && s.d[0] === 9 && s.d[1] === 6 && s.pts && s.pts.length === 2 && s.pts[0][1] === s.pts[1][1]) ys.push(s.pts[0][1]); }); return ys; }
function levelsRight(r, heights) {
  var p = plan(r);
  if (!p) return "not a station";
  var lv = p.views.levels;
  if (!lv) return "no float levels drawn";
  var ORD = { low: 0, off: 1, lead: 2, lag: 3, alarm: 4 };
  var ids = lv.floats.map(function (f) { return f.id + ":" + f.job; }).join(","), want = p.spec.floats.map(function (f) { return f.id + ":" + f.job; }).join(",");
  if (ids !== want) return "the levels' floats " + ids + " are not the station's " + want;
  for (var i = 1; i < lv.floats.length; i++) if (ORD[lv.floats[i].job] < ORD[lv.floats[i - 1].job]) return "out of order: " + ids;
  if (heights) {
    var got = lv.floats.map(function (f) { return f.height; }).join(","), w = p.spec.floats.map(function (f) { return heights[f.job] || null; }).join(",");
    if (got !== w) return "heights " + got + " (want " + w + ")";
    if (lv.floats.every(function (f) { return f.m != null; })) {
      if (!lv.scaled) return "every height given and not drawn to scale";
      var ys = levelYs(r.views && r.views.levels), ks = [];
      if (ys.length === lv.floats.length) {
        lv.floats.forEach(function (f, k) { ks.push((FLOOR - ys[k]) / f.m); });
        if (ks.some(function (k) { return Math.abs(k - ks[0]) / ks[0] > 0.01; })) return "not to scale: " + ks.map(function (k) { return k.toFixed(1); }).join(",") + " px a metre";
      }
    }
  }
  return "";
}
// the parts list against the drawings: every float, the pumps, the starters, the alternating relay, the lights, the
// valves; and no tag in it that no drawing has
function partsRight(r) {
  var p = plan(r);
  if (!p) return "not a station";
  var tags = {}, out = [];
  p.parts.forEach(function (x) { String(x.tags).split(/,\s*/).forEach(function (t) { if (t) tags[t] = x.item; }); });
  var n = p.spec.pumps.length;
  p.spec.floats.forEach(function (f) { if (!tags[f.id]) out.push("float " + f.id + " not in the parts list"); });
  if (p.views.control) {
    var c = p.views.control.circuit;
    c.rungs.forEach(function (g) { if (!tags[g.out.id]) out.push(g.out.id + " (" + g.out.kind + ") not in the parts list"); });
  }
  if (p.views.piping) p.views.piping.pumps.forEach(function (x) { [x.id, x.check, x.valve].forEach(function (t) { if (!tags[t]) out.push(t + " not in the parts list"); }); });
  // the pumps are parts whatever is drawn
  p.spec.pumps.forEach(function (id) { if (!tags[id]) out.push("pump " + id + " not in the parts list"); });
  var known = {};
  p.spec.floats.forEach(function (f) { known[f.id] = 1; }); p.spec.pumps.forEach(function (id) { known[id] = 1; });
  if (p.views.control) p.views.control.circuit.rungs.forEach(function (g) { known[g.out.id] = 1; contactsOf(g).forEach(function (e) { known[e.id] = 1; }); });
  if (p.views.piping) p.views.piping.pumps.forEach(function (x) { known[x.id] = known[x.check] = known[x.valve] = 1; });
  if (p.views.piping) (p.views.piping.mainValves || []).forEach(function (v) { known[v.id] = 1; });
  Object.keys(tags).forEach(function (t) { if (!known[t]) out.push("the parts list has " + t + " (" + tags[t] + "), in no drawing"); });
  return out.join("; ");
}
// what is said of how it works and the checks: the floats the drawings have, with their jobs
function wordsRight(r) {
  var p = plan(r);
  if (!p) return "not a station";
  var j = byJob(r), lab = {}, out = [], n = p.spec.pumps.length, seq = p.sequence.plain.join(" "), chk = p.checks.run.join(" ");
  p.spec.floats.forEach(function (f) { lab[f.id] = f.label; });
  if (j.lead && seq.indexOf(j.lead + " (" + lab[j.lead] + ")") < 0) out.push("the sequence does not name the lead float " + j.lead);
  if (j.off && seq.indexOf(j.off + " (" + lab[j.off] + ")") < 0) out.push("the sequence does not name the off float " + j.off);
  if (n === 2 && !/alternating relay/.test(seq)) out.push("the sequence does not say the pumps take turns");
  if (n === 1 && /alternating|both pumps|other pump/.test(seq + " " + chk)) out.push("a simplex is said to alternate or run both");
  if (j.lag && n >= 2 && seq.indexOf(j.lag) < 0) out.push("the lag float is not in the sequence");
  if (!j.lag && /both run|both pumps run/.test(seq + " " + chk)) out.push("both pumps said to run with no lag float");
  p.spec.floats.filter(function (f) { return f.job === "alarm"; }).forEach(function (f) { if (seq.indexOf(f.id) < 0 || chk.indexOf(f.id) < 0) out.push("the alarm float " + f.id + " is not in the sequence and the checks"); });
  if (n > 2 && /\bboth pumps\b/.test(chk)) out.push("the checks say 'both pumps' for a station of " + n);
  if (n > 2 && !p.views.control && /alarm light comes on/.test(chk + " " + seq)) out.push("an alarm light is promised with no control circuit drawn");
  return out.join("; ");
}
// the whole station as right: exp = {pumps, jobs (bottom up), heights {job: text}, valve, supply, main, views, said [re],
// notSaid [re]}
function stationRight(r, exp) {
  var p = plan(r);
  if (!r || !r.ok || !p) return "not drawn: " + (r ? (r.problems || []).join("; ") : "no block");
  var out = [];
  if (p.spec.pumps.length !== exp.pumps) out.push(p.spec.pumps.length + " pumps (want " + exp.pumps + ")");
  var jobs = p.spec.floats.map(function (f) { return f.job; }).join(",");
  if (exp.jobs && jobs !== exp.jobs.join(",")) out.push("floats " + jobs + " (want " + exp.jobs.join(",") + ")");
  var views = Object.keys(p.views).join(","), wv = (exp.views || (exp.pumps > 2 ? ["piping", "levels"] : ["control", "piping", "levels"])).join(",");
  if (views !== wv) out.push("drew " + views + " (want " + wv + ")");
  if (out.length) return out.join("; ");
  var has = function (v) { return !!p.views[v]; };
  var w = (has("control") || exp.pumps <= 2 && wv.indexOf("control") >= 0 ? controlRight(r) : "") || (has("piping") ? pipingRight(r, exp.pumps, exp.valve) : "") ||
    (has("levels") ? levelsRight(r, exp.heights) : "") || partsRight(r) || wordsRight(r);
  if (w) return w;
  var c = ctlOf(r);
  if (exp.supply != null && c && (c.rails[0] || "") !== exp.supply) return "the control supply " + JSON.stringify(c.rails[0]) + " (want " + JSON.stringify(exp.supply) + ")";
  if (exp.main && p.views.piping && p.views.piping.main.indexOf(exp.main) < 0) return "the force main " + JSON.stringify(p.views.piping.main) + " (want it to say " + exp.main + ")";
  var s = said(r);
  (exp.said || []).forEach(function (re) { if (!re.test(s)) out.push("not said: " + re); });
  (exp.notSaid || []).forEach(function (re) { if (re.test(s)) out.push("said: " + s.match(re)[0]); });
  if (exp.unread === 0 && p.unread.length) out.push("did not read: " + p.unread.join(" / "));
  return out.join("; ");
}

// a whole Chat turn against a scripted model; each call's grammar (body.grammar) is kept
function turn(q, replies, opts) {
  var o = O();
  return ready().then(function () {
    var i = 0, sent = [], bodies = [], notes = [];
    o.script = function (last, body) { sent.push(last); bodies.push(body); var r = typeof replies === "function" ? replies(last, i) : replies[Math.min(i, replies.length - 1)]; i++; return r; };
    return L().CHAT.turn((opts && opts.history) || [], q, { note: function (t) { notes.push(String(t)); } }, {}).then(function (rec) {
      o.script = null;
      return { rec: rec, sent: sent, bodies: bodies, notes: notes, calls: i, grammars: bodies.map(function (b) { return b.grammar || null; }),
        mades: (rec.mades || []).map(function (m) { return (m.block ? String(m.block.kind).toUpperCase() : "?") + (m.ok ? "" : "(not made)"); }) };
    }, function (e) { o.script = null; return { error: String(e && e.stack || e), notes: notes, sent: sent, calls: i, grammars: bodies.map(function (b) { return b.grammar || null; }), mades: [] }; });
  });
}
// the bench's path; each call's second argument (the grammar) is kept
function solve(q, replies) {
  var i = 0, sent = [], ops = [];
  function call(msgs, op) { sent.push(textOf(msgs[msgs.length - 1].content)); ops.push(op || null); var r = typeof replies === "function" ? replies(textOf(msgs[msgs.length - 1].content), i) : replies[Math.min(i, replies.length - 1)]; i++; return Promise.resolve(r); }
  return L().aiAct.solve(q, call).then(function (out) {
    return { out: out, sent: sent, calls: i, grammars: ops.map(function (x) { return x && x.grammar || null; }), parts: (out.parts || []).map(function (p) { return p.kind + (p.ok ? "" : "(not made)"); }) };
  });
}
function ids(q, Lx) { return (Lx || L()).aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
function split(q, Lx) { var p = (Lx || L()).aiParts.split(q); return p ? p.map(function (x) { return x.kind; }).join(",") : ""; }
// a ladder's signature (to compare two versions): every rung with its parts in order
function sig(r) {
  if (!r) return "null";
  if (!r.ok) return "PROBLEMS: " + (r.problems || []).join(" ;; ");
  if (!r.plan || !r.plan.circuit) return "drawn, not a ladder: " + (r.plan && r.plan.mode);
  function e(x) { return x.id + (x.of && x.of !== x.id ? "<" + x.of : "") + (x.nc ? "/" : "") + ":" + x.kind; }
  var c = r.plan.circuit;
  return (c.feed || []).map(function (f) { return "feed " + f.id + ":" + f.kind; }).concat(c.rungs.map(function (g) {
    return g.out.id + "[" + g.out.kind + "/" + g.out.type + "] stops(" + g.stops.map(e) + ") starts(" + g.starts.map(e) + ")" + (g.seal ? " seal" : "") +
      " series(" + g.series.map(e) + ") after(" + g.after.map(e) + ")" + (g.branches ? " br(" + g.branches.map(function (b) { return b.map(e).join("&"); }).join(" | ") + ")" : "");
  })).join("\n");
}
module.exports = { L: L, O: O, OLD: OLD, ready: ready, blk: blk, st: st, build: build, plan: plan, said: said, ctlOf: ctlOf, byJob: byJob, textOf: textOf,
  controlRight: controlRight, pipingRight: pipingRight, levelsRight: levelsRight, partsRight: partsRight, wordsRight: wordsRight, stationRight: stationRight,
  alarmLamps: alarmLamps, runLamps: runLamps, olsOf: olsOf, levelYs: levelYs, turn: turn, solve: solve, ids: ids, split: split, sig: sig, sim: sim, load: load, ROOT: ROOT,
  ADAM_Q: ADAM_Q, Q_B: Q_B, Q_DESIGN: Q_DESIGN, Q_PLAIN: Q_PLAIN, Q_SIMPLEX: Q_SIMPLEX };
