// lib.js -- the first review of 1.24.34 (a lift station's schematic and the drawings it needs): helpers. load.js is a
// copy of ../liftstation_review1_1230/load.js (read and checked before use: it runs the page's script in jsdom with a
// scripted model). Everything here reads Lantern through its public API only. OLD is 1.24.33 as released
// (git show 0dfc9d8:src/lantern.inner.html), loaded beside the draft for comparisons.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var load = require("./load.js");
var ROOT = path.resolve(__dirname, "../../..");
var OLD_REV = "0dfc9d8";
var cur = null, old = null, ready = null;
function srcNew() { return process.env.LANTERN_SRC || path.join(ROOT, "src/lantern.inner.html"); }
function srcOld() {
  var f = path.join(os.tmpdir(), "lantern-1.24.33-" + OLD_REV + ".inner.html");
  if (!fs.existsSync(f)) fs.writeFileSync(f, cp.execFileSync("git", ["show", OLD_REV + ":src/lantern.inner.html"], { cwd: ROOT, maxBuffer: 64 << 20 }));
  return f;
}
function O() { if (!cur) cur = load(srcNew()); return cur; }
function L() { return O().L; }
function OO() { if (!old) old = load(srcOld()); return old; }
function L0() { return OO().L; }
function boot() {
  if (!ready) ready = Promise.all([L().ai.detect(), L0().ai.detect()]).then(function () { return null; });
  return ready;
}
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function sch(title, lines) { return blk("SCHEMATIC", title, lines); }
function q2(s) { return "\x22" + s + "\x22"; }
// part lines: [["M1", "motor", "Pump 1"], ...] -> "part M1 motor \x22Pump 1\x22"
function parts(list) { return list.map(function (p) { return "part " + p[0] + " " + p[1] + (p[2] != null ? " " + q2(p[2]) : ""); }); }
function wires(list) { return list.map(function (w) { return "wire " + w; }); }
function floatsOf(r) { return r && r.plan && r.plan.spec ? r.plan.spec.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : "none"; }
function pumpsOf(r) { return r && r.plan && r.plan.spec ? r.plan.spec.pumps.length : 0; }
function viewsOf(r) { return r && r.plan && r.plan.views ? Object.keys(r.plan.views).sort().join(",") : ""; }
function short(r) { return r ? { ok: r.ok, readAs: r.readAs || "", problems: r.problems, summary: String(r.summary || "").slice(0, 600), floats: floatsOf(r), pumps: pumpsOf(r) } : null; }
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
// a whole Chat turn against a scripted model: replies in order (the last again if more are asked)
function turn(q, replies, which) {
  var o = which === "old" ? OO() : O(), LL = o.L, i = 0, sent = [], grammars = [], notes = [];
  o.script = function (last, body) { sent.push(last); grammars.push(body.grammar || null); var r = typeof replies === "function" ? replies(last, i) : replies[Math.min(i, replies.length - 1)]; i++; return r; };
  return LL.CHAT.turn([], q, { note: function (t) { notes.push(String(t)); } }, {}).then(function (rec) {
    o.script = null;
    return { rec: rec, sent: sent, grammars: grammars, notes: notes, calls: i, more: (rec.more || []).map(function (m) { return (m.block ? String(m.block.kind).toUpperCase() + ":" + m.block.title : "?") + (m.readAs ? ">" + m.readAs : "") + (m.ok ? "" : "(not made)"); }),
      made: rec.made ? (rec.made.block ? String(rec.made.block.kind).toUpperCase() + ":" + rec.made.block.title : "?") + (rec.made.readAs ? ">" + rec.made.readAs : "") + (rec.made.ok ? "" : "(not made)") : "none" };
  }, function (e) { o.script = null; return { error: String(e && e.stack || e), notes: notes, sent: sent, grammars: grammars, calls: i, more: [], made: "error" }; });
}
function ids(q, which) { return (which === "old" ? L0() : L()).aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
function split(q, which) { var p = (which === "old" ? L0() : L()).aiParts.split(q); return p ? p.map(function (x) { return x.kind; }).join("+") : "-"; }
function bench() { return (L().aiBenchQuestions || []).concat(L().aiBenchQuestionsB || []); }
function bench0() { return (L0().aiBenchQuestions || []).concat(L0().aiBenchQuestionsB || []); }
// every model reply with a MAKE block in the bench runs kept in tests/fixtures (deduplicated by question and reply)
function benchReplies() {
  var dir = path.join(ROOT, "tests/fixtures"), rows = [], seen = {};
  fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d = null;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
    var rs = Array.isArray(d) ? d : d.rows || [];
    rs.forEach(function (r) { if (!r || !r.reply || !/MAKE [A-Z]/.test(r.reply)) return; var k = r.q + "\u0000" + r.reply; if (seen[k]) return; seen[k] = 1; rows.push({ f: f, id: r.id, q: r.q, reply: r.reply }); });
  });
  return rows;
}
// the view Chat shows for a result, as text
function viewText(r, which) { var LL = which === "old" ? L0() : L(); try { return LL.aiAct.view(r).textContent; } catch (e) { return "view threw " + e; } }
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
module.exports = { L: L, L0: L0, O: O, OO: OO, boot: boot, blk: blk, sch: sch, q2: q2, parts: parts, wires: wires, floatsOf: floatsOf, pumpsOf: pumpsOf, viewsOf: viewsOf, short: short,
  turn: turn, ids: ids, split: split, bench: bench, bench0: bench0, benchReplies: benchReplies, viewText: viewText, seq: seq, textOf: textOf, ROOT: ROOT };
