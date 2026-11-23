// lib.js -- the third review of 1.24.34's lift station change: the draft (src/lantern.inner.html, or argv's) and 1.24.33
// (git show 0dfc9d8:src/lantern.inner.html, written to the system's temp folder) loaded side by side in jsdom.
//   var lib = require("./lib.js"); lib.boot().then(function (x) { x.N.L ... x.O.L ... });
// Helpers for the cases: sch(lines) a MAKE SCHEMATIC block's text; build(L, text, q); probs(m); sim (the first review of
// 1.23.0's ladder simulator, tests/fixtures/liftstation_review1_1230/sim.js).
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var load = require(path.join(__dirname, "load.js"));
var ROOT = path.join(__dirname, "..", "..", "..");
var booted = null;
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function oldFile() {
  var f = path.join(os.tmpdir(), "lantern_0dfc9d8.inner.html");
  if (!fs.existsSync(f)) fs.writeFileSync(f, cp.execSync("git show 0dfc9d8:src/lantern.inner.html", { cwd: ROOT, maxBuffer: 1 << 28 }));
  return f;
}
function boot(src) {
  if (booted) return booted;
  booted = (async function () {
    var N = load(src || process.env.LANTERN_SRC || path.join(ROOT, "src", "lantern.inner.html"));
    var O = load(oldFile());
    await sleep(80);
    await N.L.ai.detect(); await O.L.ai.detect();
    return { N: N, O: O };
  })();
  return booted;
}
function sch(title, lines, kind) { return "MAKE " + (kind || "SCHEMATIC") + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function build(L, text, q) { try { return L.aiAct.build(text, q); } catch (e) { return { error: String(e && e.stack || e), problems: ["THREW " + e], plan: null }; } }
function probs(m) { return m ? (m.problems || []).join(" | ") : "(nothing built)"; }
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
var sim = require(path.join(__dirname, "..", "liftstation_review1_1230", "sim.js"));
// chat(V, q, replies) -> {r, sent, notes}: one Chat turn, the model scripted (a reply per call, the last repeated)
async function chat(V, q, replies) {
  var sent = [];
  V.script = function (last) { sent.push(last); return replies[Math.min(sent.length - 1, replies.length - 1)]; };
  var r = null;
  try { r = await V.L.CHAT.turn([], q, {}, {}); } catch (e) { r = { err: String(e && e.stack || e) }; }
  V.script = null;
  return { r: r || {}, sent: sent, notes: ((r && r.notes) || []).map(function (n) { return typeof n === "string" ? n : JSON.stringify(n); }).join(" || ") };
}
function ids(L, q) { try { return L.aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); } catch (e) { return "THREW " + e; } }
// the line a problem hands back: the text after its last "like: "
function lineOf(p) { var i = String(p || "").lastIndexOf("like: "); return i < 0 ? "" : String(p).slice(i + 6); }
// a station result's floats as "FS1:off:off@2 ft, ..."
function floats(m) { var sp = m && m.plan && m.plan.spec; return sp ? sp.floats.map(function (f) { return f.id + ":" + f.job + ":" + f.label + (f.height ? "@" + f.height : ""); }).join(", ") : ""; }
function ctl(m) { return m && m.plan && (m.plan.circuit || (m.plan.views && m.plan.views.control && m.plan.views.control.circuit)) || null; }
// runs(circuit, at, levels) -> "level:pumps(!alarm)" for each water level in turn
function runs(circuit, at, levels, alarmIds) {
  var S = sim.make(circuit, function (id) { return at[id] == null ? null : at[id]; });
  return levels.map(function (w) { S.set(w); return w + ":" + ["M1", "M2", "M3"].filter(function (p) { return S.on(p); }).join("+") + ((alarmIds || []).some(function (a) { return S.on(a); }) ? "!" : ""); }).join(" ");
}
// the lights and horns a float works (in series, as a start or on a branch)
function alarmsOn(circuit, fid) {
  return circuit.rungs.filter(function (r) { return /^(lamp|horn)$/.test(r.out.kind) && r.series.concat(r.starts || []).concat([].concat.apply([], r.branches || [])).some(function (e) { return e.id === fid && !e.nc; }); }).map(function (r) { return r.out.id; });
}
module.exports = { boot: boot, sch: sch, build: build, probs: probs, seq: seq, sim: sim, sleep: sleep, ROOT: ROOT, chat: chat, ids: ids, lineOf: lineOf, floats: floats, ctl: ctl, runs: runs, alarmsOn: alarmsOn };
