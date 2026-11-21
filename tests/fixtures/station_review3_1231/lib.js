// lib.js -- the third review of 1.24.31's MAKE STATION: helpers. load.js and sim.js are copies of
// ../liftstation_review3_1230/ (read and checked before use: load.js runs the page's script in jsdom with a scripted
// model; sim.js scans a ladder plan over a well's fill and pump-down). Everything here reads Lantern through its public
// API only. OLD is 1.24.30 (git show ad0d654:src/lantern.inner.html), loaded beside the snapshot for comparisons.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var load = require("./load.js"), sim = require("./sim.js");
var ROOT = path.resolve(__dirname, "../../..");
var OLD_REV = "ad0d654";
var cur = null, old = null, ready = null;
function srcNew() { return process.env.LANTERN_SRC || path.join(ROOT, "src/lantern.inner.html"); }
function srcOld() {
  var f = path.join(os.tmpdir(), "lantern-1.24.30-" + OLD_REV + ".inner.html");
  if (!fs.existsSync(f)) fs.writeFileSync(f, cp.execFileSync("git", ["show", OLD_REV + ":src/lantern.inner.html"], { cwd: ROOT, maxBuffer: 64 << 20 }));
  return f;
}
function O() { if (!cur) cur = load(srcNew()); return cur; }
function L() { return O().L; }
function OO() { if (!old) old = load(srcOld()); return old; }
function L0() { return OO().L; }
// both pages loaded and their servers detected (Chat needs it); every case awaits this first
function boot() {
  if (!ready) ready = Promise.all([L().ai.detect(), L0().ai.detect()]).then(function () { return null; });
  return ready;
}
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function st(lines, title) { return blk("STATION", title || "Lift station", lines); }
function ctl(lines, title) { return blk("CONTROL", title || "Circuit", lines); }
// the drawings of a station's result (plan.views) and its spec, as short strings
function floatsOf(r) { return r && r.plan && r.plan.spec ? r.plan.spec.floats.map(function (f) { return f.id + ":" + f.job + (f.height ? "@" + f.height : ""); }).join(",") : "none"; }
function pumpsOf(r) { return r && r.plan && r.plan.spec ? r.plan.spec.pumps.length : 0; }
function viewsOf(r) { return r && r.plan && r.plan.views ? Object.keys(r.plan.views).join(",") : ""; }
// a circuit's signature (to compare two versions): every rung with its parts in order
function sig(r) {
  if (!r) return "null";
  if (!r.ok) return "PROBLEMS: " + (r.problems || []).join(" ;; ");
  function e(x) { return x.id + (x.of && x.of !== x.id ? "<" + x.of : "") + (x.nc ? "/" : "") + ":" + x.kind; }
  var c = r.plan.circuit || (r.plan.views && r.plan.views.control && r.plan.views.control.circuit);
  if (!c) return "MODE " + r.plan.mode + (r.readAs ? " readAs " + r.readAs : "");
  return (r.readAs ? "readAs " + r.readAs + "\n" : "") + (c.feed || []).map(function (f) { return "feed " + f.id + ":" + f.kind; }).concat(c.rungs.map(function (g) {
    return g.out.id + "[" + g.out.kind + "/" + g.out.type + "] stops(" + g.stops.map(e) + ") starts(" + g.starts.map(e) + ")" + (g.seal ? " seal" : "") +
      " series(" + g.series.map(e) + ") after(" + g.after.map(e) + ")" + (g.branches ? " br(" + g.branches.map(function (b) { return b.map(e).join("&"); }).join(" | ") + ")" : "");
  })).join("\n");
}
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
// a whole Chat turn against a scripted model: replies in order (the last again if more are asked); what the person saw
// (notes), what the model was sent (the last user message of each call) and the grammar of each call
function turn(q, replies, which) {
  var o = which === "old" ? OO() : O(), LL = o.L, i = 0, sent = [], grammars = [], notes = [];
  o.script = function (last, body) { sent.push(last); grammars.push(body.grammar || null); var r = typeof replies === "function" ? replies(last, i) : replies[Math.min(i, replies.length - 1)]; i++; return r; };
  return LL.CHAT.turn([], q, { note: function (t) { notes.push(String(t)); } }, {}).then(function (rec) {
    o.script = null;
    return { rec: rec, sent: sent, grammars: grammars, notes: notes, calls: i,
      mades: (rec.mades || (rec.made ? [rec.made] : [])).map(function (m) { return (m.block ? String(m.block.kind).toUpperCase() : "?") + (m.readAs ? ">" + m.readAs : "") + (m.ok ? "" : "(not made)"); }) };
  }, function (e) { o.script = null; return { error: String(e && e.stack || e), notes: notes, sent: sent, grammars: grammars, calls: i, mades: [] }; });
}
// the bench's path: replies in order; each call's options (the grammar) kept
function solve(q, replies, which) {
  var LL = which === "old" ? L0() : L(), i = 0, sent = [], opts = [];
  function call(msgs, op) { sent.push(textOf(msgs[msgs.length - 1].content)); opts.push(op || null); var r = typeof replies === "function" ? replies(textOf(msgs[msgs.length - 1].content), i) : replies[Math.min(i, replies.length - 1)]; i++; return Promise.resolve(r); }
  return LL.aiAct.solve(q, call).then(function (out) { return { out: out, sent: sent, opts: opts, calls: i }; });
}
function split(q, which) { var p = (which === "old" ? L0() : L()).aiParts.split(q); return p ? p.map(function (x) { return x.kind; }).join("+") : "-"; }
function ids(q, which) { return (which === "old" ? L0() : L()).aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
function bench() { return (L().aiBenchQuestions || []).concat(L().aiBenchQuestionsB || []); }
function bench0() { return (L0().aiBenchQuestions || []).concat(L0().aiBenchQuestionsB || []); }
// every model reply with a MAKE block in the bench runs kept in tests/fixtures (deduplicated by question and reply)
function benchReplies() {
  var dir = path.join(ROOT, "tests/fixtures"), rows = [], seen = {};
  fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d = null;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
    (d.rows || []).forEach(function (r) { if (!r.reply || !/MAKE [A-Z]/.test(r.reply)) return; var k = r.q + "\u0000" + r.reply; if (seen[k]) return; seen[k] = 1; rows.push({ f: f, id: r.id, q: r.q, reply: r.reply }); });
  });
  return rows;
}
// the station's simulated control: fill and empty the well, at the heights 1, 2, 3, 4 ... in the order of the floats
function simStation(r, levels, outs) {
  var c = r.plan.views.control.circuit, at = {};
  r.plan.spec.floats.forEach(function (f, i) { at[f.id] = i + 1; });
  var S = sim.make(c, function (id) { return at[id] == null ? null : at[id]; });
  return levels.map(function (w) { S.set(w); return outs.map(function (o) { return S.on(o) ? 1 : 0; }).join(""); });
}
module.exports = { L: L, L0: L0, O: O, OO: OO, boot: boot, blk: blk, st: st, ctl: ctl, floatsOf: floatsOf, pumpsOf: pumpsOf, viewsOf: viewsOf, sig: sig,
  turn: turn, solve: solve, split: split, ids: ids, bench: bench, bench0: bench0, benchReplies: benchReplies, sim: sim, simStation: simStation, textOf: textOf, ROOT: ROOT };
