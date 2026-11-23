// lib.js -- the second review of 1.24.34 (a lift station's schematic and the drawings it needs).
// Loads the draft (src/lantern.inner.html, or argv) and 1.24.33 as released (0dfc9d8, written to a temp file with
// git show) in jsdom with load.js, and gives the cases their helpers. Nothing here is Lantern's: the cases say what
// is right; lib only reads what Lantern did.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var ROOT = path.join(__dirname, "..", "..", "..");
module.paths.unshift(path.join(ROOT, "node_modules"));
var load = require("./load.js");
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var Q35 = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "liftstation_1234", "chat_35b.json"), "utf8"));

function prevFile() {
  var f = path.join(os.tmpdir(), "lantern_1.24.33_0dfc9d8.inner.html");
  if (!fs.existsSync(f) || fs.statSync(f).size < 1000000) fs.writeFileSync(f, cp.execSync("git show 0dfc9d8:src/lantern.inner.html", { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
  return f;
}
async function boot(file) {
  var o = load(file);
  await sleep(80);
  try { await o.L.ai.detect(); } catch (e) { /* no model needed */ }
  return o;
}
var D = null, P = null;
async function init(draftFile) {
  if (D) return { D: D, P: P };
  D = await boot(draftFile || path.join(ROOT, "src", "lantern.inner.html"));
  P = await boot(prevFile());
  return { D: D, P: P };
}

function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 240) ? s.slice(0, n || 240) + "…" : s; }
function ids(o, q) { return o.L.aiAct.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
function asks(o, q) { return !!(o.L.aiStation && o.L.aiStation.asks(q)); }

// a built result, summed up: what the station is (pumps, floats bottom up with their jobs, valves, views)
function sum(m) {
  if (!m) return { none: true };
  var s = { ok: !!m.ok, readAs: m.readAs || "", kind: m.block ? String(m.block.kind) : "", problems: (m.problems || []).slice(), summary: m.summary || "", fixKind: m.fixKind || "" };
  var sp = m.plan && m.plan.spec;
  if (sp) {
    s.count = (sp.pumps || []).length;
    s.floats = sp.floats.map(function (f) { return f.id + ":" + f.job; }).join(",");
    s.labels = sp.floats.map(function (f) { return f.id + "=" + f.label; }).join(" | ");
    s.show = (m.plan.show || []).join(",");
    s.views = Object.keys(m.plan.views || {}).sort().join(",");
    s.valve = sp.valve || ""; s.horn = !!sp.horn; s.well = sp.well || "";
    s.main = sp.main || ""; s.inlet = sp.inlet || "";
    var ckRow = (m.plan.parts || []).filter(function (r) { return /^Check valve/.test(r.item); })[0], ck = ckRow ? /^Check valve \(([^)]*)\)/.exec(ckRow.item) : null;
    s.check = ck ? ck[1] : "";
    var pv = m.plan.views && m.plan.views.piping;
    if (pv && pv.pumps) s.piping = pv.pumps.map(function (p) { return [p.id, p.check || "-", p.valve || "-", p.valveKind || ""].join(" "); }).join("; ");
    var lv = m.plan.views && m.plan.views.levels;
    if (lv && lv.floats) s.levels = lv.floats.map(function (f) { return f.id + ":" + f.job; }).join(",");
    s.blocks = m.plan.blocks || {};
  }
  return s;
}
function build(o, text, q) { return o.L.aiAct.build(text, q); }

// one Chat turn with scripted replies (each a string, or a function of the last message and the call number)
async function chat(o, q, replies, hist) {
  var sent = [], C = o.L.CHAT;
  o.script = function (last) { sent.push(last); var r = replies[Math.min(sent.length - 1, replies.length - 1)]; return typeof r === "function" ? r(last, sent.length) : r; };
  var r;
  try { r = await C.turn(hist || [], q, {}, {}); } finally { o.script = null; }
  return { r: r, sent: sent };
}
// the bench's path
async function solve(o, q, replies) {
  var sent = [], i = 0;
  var out = await o.L.aiAct.solve(q, function (msgs) { sent.push(o.textOf(msgs[msgs.length - 1].content)); return Promise.resolve(replies[Math.min(i++, replies.length - 1)]); });
  return { out: out, sent: sent };
}
function rx(s) { return s instanceof RegExp ? s : new RegExp(s); }
// checks: each returns "" or why
function want(cond, why) { return cond ? "" : why; }
function all(list) { return list.filter(function (x) { return x; }).join("; "); }

// the floats the summary says it took ("the floats F1 “...”, F2 “...” and F3 “...”"), by tag
function tookFloats(summary) {
  var m = /\bthe floats? (.*?)(?:, the wet well|, the check valves|, the shutoff valves|, the header|\. Lantern drew|$)/.exec(String(summary || ""));
  if (!m) return [];
  var out = [], re = /(?:^|,\s*|\band\s+)([A-Z]{1,5}\d{1,3}) “/g, k;
  while ((k = re.exec(m[1]))) out.push(k[1]);
  return out;
}
// station(text, q, e) -> "" when the station Lantern made is e:
//   e.read: true (read as MAKE STATION and made), false (not read as a station), "back" (sent back as MAKE STATION)
//   e.count, e.floats ("F1:off,F2:lead" bottom up), e.levels (the levels drawing's floats, same form), e.views, e.valve,
//   e.check, e.horn, e.well (true/false), e.piping ("check+shutoff" each pump), e.said / e.notSaid (regexes on the
//   summary), e.problems (regexes on what goes back), e.truth (every float the summary says it took is drawn)
function station(text, q, e) {
  var m = build(D, text, q), s = sum(m), bad = [];
  var isSt = s.readAs === "STATION" || s.kind === "STATION";
  if (e.read === false) return want(!isSt, "read as a station: " + short(s.summary, 300));
  if (e.read === "back") {
    if (s.ok || s.fixKind !== "STATION") bad.push("not sent back as MAKE STATION (ok=" + s.ok + ", fixKind=" + s.fixKind + ") " + short(s.summary || s.problems.join(" | "), 300));
    (e.problems || []).forEach(function (r) { if (!rx(r).test(s.problems.join(" | "))) bad.push("what goes back lacks /" + r + "/: " + short(s.problems.join(" | "), 400)); });
    (e.notProblems || []).forEach(function (r) { if (rx(r).test(s.problems.join(" | "))) bad.push("what goes back has /" + r + "/: " + short(s.problems.join(" | "), 400)); });
    return all(bad);
  }
  if (!s.ok || !isSt) return "not made as a station: ok=" + s.ok + " readAs=" + s.readAs + " " + short(s.problems.join(" | ") || s.summary, 400);
  if (e.count != null && s.count !== e.count) bad.push(s.count + " pumps, want " + e.count);
  if (e.floats != null && s.floats !== e.floats) bad.push("floats " + s.floats + ", want " + e.floats + " (" + s.labels + ")");
  if (e.levels != null && s.levels !== e.levels) bad.push("the levels drawing's floats " + s.levels + ", want " + e.levels);
  if (e.views != null && s.views !== e.views) bad.push("views " + s.views + ", want " + e.views);
  if (e.valve != null && s.valve !== e.valve) bad.push("shutoff valve kind “" + s.valve + "”, want “" + e.valve + "”");
  if (e.check != null && s.check !== e.check) bad.push("check kind “" + s.check + "”, want “" + e.check + "”");
  if (e.horn != null && s.horn !== e.horn) bad.push("horn " + s.horn + ", want " + e.horn);
  if (e.well != null && !!s.well !== e.well) bad.push("wet well " + (s.well || "none") + ", want " + (e.well ? "one" : "none"));
  if (e.piping && s.piping && !s.piping.split("; ").every(function (p) { var w = p.split(" "); return w[1] !== "-" && w[2] !== "-"; })) bad.push("a pump without its check or shutoff valve: " + s.piping);
  (e.said || []).forEach(function (r) { if (!rx(r).test(s.summary)) bad.push("the summary lacks /" + r + "/"); });
  (e.notSaid || []).forEach(function (r) { if (rx(r).test(s.summary)) bad.push("the summary says /" + r + "/"); });
  if (e.truth !== false) {
    var drawn = (s.floats || "").split(",").map(function (x) { return x.split(":")[0]; }), lost = tookFloats(s.summary).filter(function (id) { return drawn.indexOf(id) < 0; });
    if (lost.length) bad.push("the summary says it took " + lost.join(", ") + " but no drawing has " + (lost.length > 1 ? "them" : "it") + " (drawn: " + s.floats + ")");
  }
  if (e.extra) { var x = e.extra(m, s); if (x) bad.push(x); }
  return all(bad);
}

module.exports = { init: init, blk: blk, short: short, ids: ids, asks: asks, sum: sum, build: build, chat: chat, solve: solve, rx: rx, want: want, all: all, Q35: Q35, ROOT: ROOT,
  station: station, tookFloats: tookFloats,
  get D() { return D; }, get P() { return P; } };
