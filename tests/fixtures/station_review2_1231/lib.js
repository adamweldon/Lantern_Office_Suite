// lib.js -- the second review of 1.24.31's MAKE STATION (and the duplex floats rule and the block grammars), by a
// reviewer who did not write them and has not seen the first review. load.js and sim.js are copies of
// ../liftstation_review3_1230's (read and checked before use: load.js runs the page's script in jsdom with a scripted
// model; sim.js scans a ladder plan over a well's fill and pump-down). Everything here reads Lantern through its
// public API only.
"use strict";
var path = require("path"), fs = require("fs");
var load = require("./load.js"), sim = require("./sim.js");
var ROOT = path.resolve(__dirname, "../../..");
var cur = null;
function L() { if (!cur) cur = load(process.env.LANTERN_SRC || path.join(ROOT, "src/lantern.inner.html")); return cur.L; }
function O() { if (!cur) L(); return cur; }
var ready = null;
function boot() { if (!ready) ready = Promise.resolve(L().ai.detect()); return ready; }

function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function sb(lines, title) { return blk("STATION", title || "Lift station", lines); }
var ADAM_Q = "create a diagram for a typical 2 pump lift station control with alternating relay. Then create a plumbing schematic for the same and a drawing showing float level positioning";
var Q_SEW = "Design a duplex sewage lift station: the control circuit, the piping and the float levels";
var Q_ANY = "Design a sewage lift station: the control circuit, the piping and the float levels";   // no count named
var Q_SIMPLEX = "Design a simplex sump pump station: the control, the piping and the float levels";
var Q_TRIPLEX = "Design a triplex lift station: the control, the piping and the float levels";
function build(text, q) { return L().aiAct.build(text, q); }

// ---- reading a station result --------------------------------------------------------------------------
function plan(r) { return r && r.plan && r.plan.mode === "station" ? r.plan : null; }
function ctl(p) { return p && p.views.control ? p.views.control.circuit : null; }
function rungOf(c, id) { return c ? c.rungs.filter(function (g) { return g.out.id === id; })[0] || null : null; }
function contactsOf(g) { return g ? g.stops.concat(g.starts, g.series, g.after, [].concat.apply([], g.branches || [])) : []; }
function floatsIn(c) { var out = {}; (c ? c.rungs : []).forEach(function (g) { contactsOf(g).forEach(function (e) { if (e.kind === "float") out[e.id] = 1; }); }); return Object.keys(out).sort(); }
function outsOf(c, kind) { return c ? c.rungs.filter(function (g) { return g.out.kind === kind; }) : []; }
function litBy(c, kind, fid) { return outsOf(c, kind).filter(function (g) { return contactsOf(g).some(function (e) { return e.kind === "float" && e.id === fid; }); }).map(function (g) { return g.out.id; }); }
function starters(c) { return c ? c.rungs.filter(function (g) { return g.out.kind === "coil" && g.out.type === "starter"; }).map(function (g) { return g.out.id; }) : []; }
function jobs(p) { return p.spec.floats.map(function (f) { return f.job; }).join(","); }
function fids(p) { return p.spec.floats.map(function (f) { return f.id; }).slice().sort().join(","); }
function partRow(p, re) { return p.parts.filter(function (x) { return re.test(x.item); }); }
function partTags(p, re) { return partRow(p, re).map(function (x) { return x.tags; }).join(", ").split(/,\s*/).filter(function (x) { return x; }).sort().join(","); }
function said(p) { return (p.said || []).join(" | "); }
function txt(p) { return (p.sequence.plain || []).join(" ") + " || " + (p.checks.run || []).join(" "); }

// simulate the station's control circuit over a well's fill and pump-down: floats at off 1, lead 2, lag 3, alarm 4
// (a low level alarm at 0.5, a lag pump's own off at 1.5, a second alarm at 5)
function simStation(p) {
  var c = ctl(p);
  if (!c) return "";
  var byJob = {}, other = [];
  p.spec.floats.forEach(function (f) {
    var j = f.job;
    if (j === "alarm" && byJob.alarm) { other.push([f.id, 5]); return; }
    if (j === "off" && byJob.off) { other.push([f.id, 1.5]); return; }
    if (j === "low") { other.push([f.id, 0.5]); return; }
    if (!byJob[j]) byJob[j] = f.id;
  });
  var st = starters(c);
  if (st.length === 2) {
    var runL = {}, ols = {};
    outsOf(c, "lamp").forEach(function (g) { contactsOf(g).forEach(function (e) { if (e.kind === "contact" && st.indexOf(e.of) >= 0 && !e.nc) runL[g.out.id] = e.of; }); });
    c.rungs.forEach(function (g) { if (st.indexOf(g.out.id) >= 0) contactsOf(g).forEach(function (e) { if (e.kind === "ol") ols[e.id] = g.out.id; }); });
    var alarms = byJob.alarm ? litBy(c, "lamp", byJob.alarm).concat(litBy(c, "horn", byJob.alarm)) : [];
    var probs = sim.duplex(c, { floats: { off: byJob.off, lead: byJob.lead, lag: byJob.lag, alarm: byJob.alarm }, otherFloats: other, pumps: st, alarms: alarms, runLamps: runL, ols: ols });
    return probs.join("; ");
  }
  if (st.length === 1) {
    var at = {}; at[byJob.off] = 1; at[byJob.lead] = 2; if (byJob.alarm) at[byJob.alarm] = 4;
    other.forEach(function (o) { at[o[0]] = o[1]; });
    var S = sim.make(c, function (id) { return at[id] == null ? null : at[id]; }), got = [0, 1.5, 2.5, 1.5, 0.5, 1.5, 2.5, 0.5].map(function (w) { S.set(w); return S.on(st[0]) ? 1 : 0; }).join("");
    if (got !== "00110010") return "simplex pump-down " + got + " (want 00110010)";
    if (byJob.alarm) {
      var al = litBy(c, "lamp", byJob.alarm);
      S.set(3.5); if (al.some(function (a) { return S.on(a); })) return "alarm light on below the alarm float";
      S.set(4.5); if (!al.length || !al.every(function (a) { return S.on(a); })) return "alarm float lights no alarm light";
    }
    return "";
  }
  return "the control circuit has " + st.length + " starters";
}
// the piping: every pump with its check valve and then its shutoff valve
function pipingOk(p, n) {
  var pp = p.views.piping;
  if (!pp) return "no piping drawn";
  if (n != null && pp.pumps.length !== n) return "the piping has " + pp.pumps.length + " pumps (want " + n + ")";
  for (var i = 0; i < pp.pumps.length; i++) if (!pp.pumps[i].check || !pp.pumps[i].valve) return pp.pumps[i].id + " lacks a valve";
  return pp.order.join(",") === "pump,check,shutoff,header" ? "" : "valve order " + pp.order.join(",");
}
// the levels: in the order of their jobs, heights rising when given
var ORD = { low: 0, off: 1, lead: 2, lag: 3, alarm: 4 };
function levelsOk(p, jobsWant, heightsWant) {
  var lv = p.views.levels;
  if (!lv) return "no float levels drawn";
  var js = lv.floats.map(function (f) { return f.job; }).join(",");
  if (jobsWant && js !== jobsWant) return "levels jobs " + js + " (want " + jobsWant + ")";
  for (var i = 1; i < lv.floats.length; i++) {
    if (ORD[lv.floats[i].job] < ORD[lv.floats[i - 1].job]) return "levels out of order: " + js;
    if (lv.scaled && lv.floats[i].m <= lv.floats[i - 1].m && lv.floats[i].job !== lv.floats[i - 1].job) return "levels heights not rising";
  }
  if (heightsWant !== undefined) { var hs = lv.floats.map(function (f) { return f.height; }).join(","); if (hs !== heightsWant) return "levels heights " + hs + " (want " + heightsWant + ")"; }
  return "";
}
// the three drawings and the parts list agree with the station's own floats and pumps
function agree(p) {
  var out = [], c = ctl(p), want = fids(p);
  if (p.views.levels) { var lf = p.views.levels.floats.map(function (f) { return f.id; }).sort().join(","); if (lf !== want) out.push("levels floats " + lf + " vs station " + want); }
  if (c && p.given.indexOf("control") < 0) { var cf = floatsIn(c).join(","); if (cf !== want) out.push("control floats " + cf + " vs station " + want); }
  var pf = partTags(p, /^Float switch/); if (pf !== want) out.push("parts list floats " + pf + " vs station " + want);
  var np = p.spec.pumps.length;
  if (p.views.piping && p.views.piping.pumps.length !== np) out.push("piping has " + p.views.piping.pumps.length + " pumps, the station " + np);
  var pp = partTags(p, /^Pump/).split(",").filter(function (x) { return x; }).length;
  if (pp !== np) out.push("parts list has " + pp + " pumps, the station " + np);
  if (c && starters(c).length !== Math.min(np, 2) && np <= 2) out.push("control has " + starters(c).length + " starters, the station " + np + " pumps");
  return out.join("; ");
}
// what is written (how it works, the checks, what is not known, what was assumed) says only what was drawn
function textOk(p) {
  var out = [], c = ctl(p), seq = (p.sequence.plain || []).join(" "), run = (p.checks.run || []).join(" ");
  var f = {}; p.spec.floats.forEach(function (x) { if (!f[x.job]) f[x.job] = x; });
  if (c) {
    var ar = c.rungs.some(function (g) { return g.out.kind === "alternator"; });
    if (/alternating relay changes over/.test(seq) !== ar) out.push("how it works " + (ar ? "omits" : "claims") + " the alternation");
    if (/the other pump starts \(the alternating relay changed over\)/.test(run) !== ar) out.push("the checks " + (ar ? "omit" : "claim") + " the alternation");
    var lagWired = f.lag && c.rungs.some(function (g) { return g.starts.some(function (e) { return e.id === f.lag.id; }); });
    if (/the other pump starts too|another pump starts too/.test(seq) && !lagWired) out.push("how it works says the lag float starts another pump; the circuit drawn has no lag call");
    if (/both pumps run/.test(run) && !lagWired) out.push("the checks say both pumps run on the lag float; the circuit drawn has no lag call");
    p.spec.floats.filter(function (x) { return x.job === "alarm"; }).forEach(function (x) {
      var lamps = litBy(c, "lamp", x.id), horns = litBy(c, "horn", x.id);
      var re = new RegExp(x.id + " \\(" + x.label.replace(/[()]/g, ".") + "\\)[^.]*?alarm (light and horn come|light comes)");
      var m = re.exec(seq + " " + run);
      if (m && /horn/.test(m[1]) && !horns.length) out.push(x.id + ": the text says its horn sounds; no horn is wired to it");
      if (m && !lamps.length) out.push(x.id + ": the text says its light comes on; no light is wired to it");
      if (!m && lamps.length) out.push(x.id + ": its alarm is drawn and the text does not say how to check it");
    });
    var lows = p.spec.floats.filter(function (x) { return x.job === "low"; });
    lows.forEach(function (x) { if (run.indexOf(x.id) < 0) out.push(x.id + " (" + x.label + "): drawn, and the checks never test it"); });
  }
  var alarmLamp = c && outsOf(c, "lamp").some(function (g) { return contactsOf(g).some(function (e) { return e.kind === "float" && p.spec.floats.some(function (x) { return x.id === e.id && x.job === "alarm"; }); }); });
  if (/The alarm Lantern draws is a light/.test(p.unknown.join(" ")) && !alarmLamp) out.push("what Lantern does not know says “The alarm Lantern draws is a light”, and no alarm light is drawn");
  if (/a red light on the high level alarm/.test(said(p)) && !alarmLamp) out.push("said: a red light on the high level alarm; none drawn");
  if (/a run light for each pump/.test(said(p)) && c && outsOf(c, "lamp").filter(function (g) { return contactsOf(g).some(function (e) { return e.kind === "contact" && /^M\d/.test(e.of || ""); }); }).length < starters(c).length) out.push("said: a run light for each pump; not drawn");
  return out.join("; ");
}
// the judge for a station that should be drawn whole and right
function stationRight(r, o) {
  o = o || {};
  if (!r) return "no block";
  if (!r.ok) return "not drawn: " + (r.problems || []).join("; ");
  var p = plan(r);
  if (!p) return "not a station: " + (r.plan ? r.plan.mode : "no plan");
  if (o.pumps != null && p.spec.pumps.length !== o.pumps) return "pumps " + p.spec.pumps.length + " (want " + o.pumps + ")";
  if (o.jobs != null && jobs(p) !== o.jobs) return "floats " + jobs(p) + " (want " + o.jobs + ")";
  if (o.views != null && Object.keys(p.views).join(",") !== o.views) return "views " + Object.keys(p.views).join(",") + " (want " + o.views + ")";
  var s = simStation(p); if (s) return "control: " + s;
  if (p.views.piping) { s = pipingOk(p, o.pipingPumps != null ? o.pipingPumps : p.spec.pumps.length); if (s) return "piping: " + s; }
  if (p.views.levels) { s = levelsOk(p, o.levelJobs, o.heights); if (s) return s; }
  s = agree(p); if (s) return s;
  if (o.unreadNone && p.unread.length) return "Lantern did not read: " + p.unread.join(" / ");
  if (o.check) { s = o.check(p, r); if (s) return s; }
  return "";
}
// a signature of a control circuit drawn (to compare two versions): every rung with its parts in order
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
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
// a whole Chat turn against a scripted model: replies in order; what each call was sent (last user text, whole body)
function turn(q, replies) {
  var o = O(), i = 0, sent = [], bodies = [], notes = [];
  o.script = function (last, body) { sent.push(last); bodies.push(body); var r = typeof replies === "function" ? replies(last, i) : replies[Math.min(i, replies.length - 1)]; i++; return r; };
  return boot().then(function () { return L().CHAT.turn([], q, { note: function (t) { notes.push(String(t)); } }, {}); }).then(function (rec) {
    o.script = null;
    return { rec: rec, sent: sent, bodies: bodies, notes: notes, calls: i, grammars: bodies.map(function (b) { return b.grammar ? (/^root ::= "MAKE ([A-Z ]+): "/.exec(b.grammar) || ["", "?"])[1] : ""; }) };
  }, function (e) { o.script = null; return { error: String(e && e.stack || e), notes: notes, sent: sent, calls: i, grammars: [] }; });
}
// the bench's path: opts of each call kept (the grammar)
function solve(q, replies) {
  var i = 0, sent = [], ops = [];
  function call(msgs, op) { sent.push(textOf(msgs[msgs.length - 1].content)); ops.push(op || null); var r = typeof replies === "function" ? replies(textOf(msgs[msgs.length - 1].content), i) : replies[Math.min(i, replies.length - 1)]; i++; return Promise.resolve(r); }
  return boot().then(function () { return L().aiAct.solve(q, call); }).then(function (out) {
    return { out: out, sent: sent, calls: i, grammars: ops.map(function (op) { return op && op.grammar ? (/^root ::= "MAKE ([A-Z ]+): "/.exec(op.grammar) || ["", "?"])[1] : ""; }) };
  });
}
function ids(q) { return L().aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
function split(q) { var p = L().aiParts.split(q); return p ? p.map(function (x) { return x.kind; }).join("+") : null; }
function bench() { return (L().aiBenchQuestions || []).concat(L().aiBenchQuestionsB || []); }
var BEFORE = null;
function before(key) {
  if (!BEFORE) { try { BEFORE = JSON.parse(fs.readFileSync(path.join(__dirname, "before.json"), "utf8")); } catch (e) { BEFORE = {}; } }
  return BEFORE[key];
}
// a case: id, harm, input, right (what is right and why), and run() -> "" when Lantern is right, else the reason
function C(id, harm, input, right, run) { return { id: id, harm: harm, input: input, right: right, run: run }; }
module.exports = { L: L, O: O, boot: boot, blk: blk, sb: sb, ADAM_Q: ADAM_Q, Q_SEW: Q_SEW, Q_ANY: Q_ANY, Q_SIMPLEX: Q_SIMPLEX, Q_TRIPLEX: Q_TRIPLEX, build: build,
  plan: plan, ctl: ctl, rungOf: rungOf, contactsOf: contactsOf, floatsIn: floatsIn, outsOf: outsOf, litBy: litBy, starters: starters, jobs: jobs, fids: fids, partRow: partRow, partTags: partTags,
  said: said, txt: txt, simStation: simStation, pipingOk: pipingOk, levelsOk: levelsOk, agree: agree, textOk: textOk, stationRight: stationRight, sim: sim,
  sig: sig, turn: turn, solve: solve, ids: ids, split: split, bench: bench, before: before, C: C, textOf: textOf, ROOT: ROOT };
