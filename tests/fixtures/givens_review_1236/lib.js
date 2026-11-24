// lib.js -- the review of 1.24.36's givens (GIVENS, GIVENS_CONTROL, and AI_CONTROL's promptOf asking them). Loads the
// draft (src/lantern.inner.html, or argv) and 1.24.35 as released (8cb3281, written to the system's temp folder with
// git show) side by side in jsdom with load.js (a copy of tests/fixtures/liftstation_review1_1230/load.js). Nothing here
// is Lantern's: the cases say what is right; lib only reads what Lantern did, and gives the cases a ladder simulator.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var ROOT = path.join(__dirname, "..", "..", "..");
module.paths.unshift(path.join(ROOT, "node_modules"));
var load = require(path.join(__dirname, "load.js"));
var OLD = "8cb3281";
var MARK = "Lantern’s tested circuit for this";
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function tmp(name) { return path.join(os.tmpdir(), name); }
function oldFile() {
  var f = tmp("lantern_" + OLD + ".inner.html");
  if (!fs.existsSync(f) || fs.statSync(f).size < 1000000) fs.writeFileSync(f, cp.execSync("git show " + OLD + ":src/lantern.inner.html", { cwd: ROOT, maxBuffer: 1 << 28 }));
  return f;
}
var SRC = null;
function srcFile() { return SRC || path.join(ROOT, "src", "lantern.inner.html"); }
// the draft with modules taken out (as tests/ai_isolation.js does), written to the temp folder
function without(names) {
  var s = fs.readFileSync(srcFile(), "utf8");
  names.forEach(function (n) {
    var a = s.indexOf("// MODULE: " + n + " - START"), b = s.indexOf("// MODULE: " + n + " - END");
    if (a < 0 || b < 0) throw new Error("missing module " + n);
    s = s.slice(0, a) + "// (removed " + n + ")\n" + s.slice(b + ("// MODULE: " + n + " - END").length);
  });
  var f = tmp("lantern_givens_review_without_" + names.join("_") + ".inner.html");
  fs.writeFileSync(f, s);
  return f;
}
var booted = null;
function boot(src) {
  if (src) SRC = src;
  if (booted) return booted;
  booted = (async function () {
    var N = load(srcFile());
    var O = load(oldFile());
    await sleep(80);
    try { await N.L.ai.detect(); } catch (e) { }
    try { await O.L.ai.detect(); } catch (e) { }
    return { N: N, O: O };
  })();
  return booted;
}
async function bootFile(f) {
  var o = load(f);
  await sleep(80);
  try { await o.L.ai.detect(); } catch (e) { }
  return o;
}
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function build(L, text, q) { try { return L.aiAct.build(text, q); } catch (e) { return { error: String(e && e.stack || e), problems: ["THREW " + e], plan: null }; } }
function probs(m) { return m ? (m.problems || []).join(" | ") : "(nothing built)"; }
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 240) ? s.slice(0, n || 240) + "…" : s; }
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
function rx(s) { return s instanceof RegExp ? s : new RegExp(s); }
function prompt(L, q) { try { return L.aiAct.prompt(q); } catch (e) { return "THREW " + e; } }
// what the model is shown for a question: {id (the given's, or null), block (the MAKE ... END text shown under the
// given's line, or null), lines (its device lines), prompt (the whole action prompt)}
function shown(L, q) {
  var p = prompt(L, q), at = p.indexOf(MARK), g = null;
  try { g = L.givens ? L.givens.match("CONTROL", q) : null; } catch (e) { g = null; }
  if (at < 0) return { id: null, matched: g ? g.id : null, block: null, lines: [], prompt: p };
  var b = p.slice(p.indexOf("MAKE CONTROL:", at), p.indexOf("\nEND", at) + 4);
  return { id: g ? g.id : "?", matched: g ? g.id : null, block: b, lines: b.split("\n").slice(1, -1), title: b.split("\n")[0].replace(/^MAKE CONTROL:\s*/, ""), prompt: p, says: p.slice(at, p.indexOf("\n", at)) };
}
// the circuit of a MAKE CONTROL
function ctl(m) { var c = m && m.plan && m.plan.circuit; return c && Array.isArray(c.rungs) ? c : null; }
function elements(c) {
  var out = [];
  (c.feed || []).forEach(function (e) { out.push({ e: e, where: "feed", out: "" }); });
  c.rungs.forEach(function (r) {
    ["stops", "starts", "series", "after"].forEach(function (k) { (r[k] || []).forEach(function (e) { out.push({ e: e, where: k, out: r.out.id }); }); });
    (r.branches || []).forEach(function (b) { b.forEach(function (e) { out.push({ e: e, where: "branch", out: r.out.id }); }); });
  });
  return out;
}
// ---- a ladder simulator ---------------------------------------------------------------------------------------
// make(circuit, at): at[id] -> the process value at which a process switch (float, pressure, temp) changes over. The
// process is one number (level or pressure). The symbol's meaning (NEMA/JIC): normally open = closes as the process
// rises past its setting; normally closed = opens as it rises past it. A push button is not pressed unless pressed (an
// NO open, an NC closed); a selector, limit or other switch is in its run position (made); an overload is closed until it
// trips; a coil's contact follows the coil (nc: the other way). A timer's contact closes when it has timed out: the
// simulator times it out at once when it is fed ("elapse"), or holds it timing.
function make(circuit, at) {
  at = at || {};
  var rungs = circuit.rungs, on = {}, kinds = {}, timedOut = {};
  rungs.forEach(function (r) { on[r.out.id] = false; kinds[r.out.id] = r.out.kind; });
  var st = { pv: 0, tripped: {}, pressed: {}, elapse: false, force: {} };
  function closed(e) {
    var c;
    if (/^(float|pressure|temp)$/.test(e.kind)) { var h = at[e.id]; c = h != null && st.pv >= h; return e.nc ? !c : c; }
    if (e.kind === "pb" || e.kind === "estop" || e.kind === "stop") { c = !!st.pressed[e.id]; return e.nc ? !c : c; }
    if (e.kind === "ol") return e.nc === false ? !!st.tripped[e.id] : !st.tripped[e.id];
    if (e.kind === "fuse") return true;
    if (e.kind === "contact") {
      var of = e.of || e.id;
      if (e.timed || kinds[of] === "timer") { c = !!on[of] && !!timedOut[of]; return e.nc ? !c : c; }
      c = !!on[of]; return e.nc ? !c : c;
    }
    if (st.force[e.id] != null) return !!st.force[e.id];   // a switch set by the case: made (true) or open (false)
    return true;   // a selector, limit or other switch in its run position
  }
  function allc(list) { return (list || []).every(closed); }
  function scan() {
    var feed = (circuit.feed || []).every(function (f) { return f.kind === "fuse" ? true : !st.pressed[f.id]; }), next = {};
    rungs.forEach(function (r) {
      var ok = feed && allc(r.stops) && allc(r.series) && allc(r.after);
      if (ok && r.starts && r.starts.length) ok = r.starts.some(closed) || (r.seal && on[r.out.id]);
      if (ok && r.branches && r.branches.length) ok = r.branches.some(function (b) { return allc(b); });
      next[r.out.id] = ok;
    });
    var changed = false;
    Object.keys(next).forEach(function (k) {
      if (next[k] !== on[k]) { changed = true; on[k] = next[k]; if (!next[k]) timedOut[k] = false; }
      if (kinds[k] === "timer" && on[k] && st.elapse && !timedOut[k]) { timedOut[k] = true; changed = true; }
    });
    return changed;
  }
  function settle() { for (var i = 0; i < 60; i++) if (!scan()) return; }
  settle();
  return {
    set: function (v) { st.pv = v; settle(); return this; },
    press: function (id, v) { st.pressed[id] = v !== false; settle(); return this; },
    tap: function (id) { st.pressed[id] = true; settle(); st.pressed[id] = false; settle(); return this; },
    trip: function (id, v) { st.tripped[id] = v !== false; settle(); return this; },
    elapse: function (v) { st.elapse = v !== false; settle(); return this; },
    force: function (id, made) { if (made == null) delete st.force[id]; else st.force[id] = !!made; settle(); return this; },
    on: function (id) { return !!on[id]; },
    onList: function () { return Object.keys(on).filter(function (k) { return on[k]; }).sort().join("+"); }
  };
}
// the given a question is shown, built through act.build for that question; -> {s: shown, m: made, c: circuit}
function given(L, q) {
  var s = shown(L, q), m = s.block ? build(L, s.block, q) : null;
  return { s: s, m: m, c: ctl(m) };
}
// the device lines of a block by their first word: {stop: [...], start: [...], ...}
function heads(lines) {
  var out = {};
  (lines || []).forEach(function (l) { var w = (/^\s*(\S+)/.exec(l) || [])[1]; if (w) (out[w] = out[w] || []).push(l); });
  return out;
}
function rungOf(c, id) { return c ? c.rungs.filter(function (r) { return r.out.id === id; })[0] || null : null; }
function lamps(c) { return c ? c.rungs.filter(function (r) { return r.out.kind === "lamp"; }) : []; }
module.exports = { boot: boot, bootFile: bootFile, without: without, blk: blk, build: build, probs: probs, short: short, seq: seq, rx: rx, prompt: prompt,
  shown: shown, ctl: ctl, elements: elements, make: make, given: given, heads: heads, rungOf: rungOf, lamps: lamps, ROOT: ROOT, OLD: OLD, MARK: MARK, sleep: sleep, oldFile: oldFile };
