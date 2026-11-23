// lib.js -- the review of 1.24.35's float switches (DRAW_LADDER's process switches the right way up; AI_STATION's FTAG
// without LS and its new FJOB2). Loads the draft (src/lantern.inner.html, or argv) and 1.24.34 as released (1e318a5,
// written to the system's temp folder with git show) side by side in jsdom with load.js (a copy of
// tests/fixtures/liftstation_review1_1230/load.js). Nothing here is Lantern's: the cases say what is right; lib only
// reads what Lantern did, and gives the cases a ladder simulator and the geometry of what was drawn.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var ROOT = path.join(__dirname, "..", "..", "..");
module.paths.unshift(path.join(ROOT, "node_modules"));
var load = require(path.join(__dirname, "load.js"));
var OLD = "1e318a5";
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function oldFile() {
  var f = path.join(os.tmpdir(), "lantern_" + OLD + ".inner.html");
  if (!fs.existsSync(f) || fs.statSync(f).size < 1000000) fs.writeFileSync(f, cp.execSync("git show " + OLD + ":src/lantern.inner.html", { cwd: ROOT, maxBuffer: 1 << 28 }));
  return f;
}
var booted = null;
function boot(src) {
  if (booted) return booted;
  booted = (async function () {
    var N = load(src || path.join(ROOT, "src", "lantern.inner.html"));
    var O = load(oldFile());
    await sleep(80);
    try { await N.L.ai.detect(); } catch (e) { }
    try { await O.L.ai.detect(); } catch (e) { }
    return { N: N, O: O };
  })();
  return booted;
}
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function build(L, text, q) { try { return L.aiAct.build(text, q); } catch (e) { return { error: String(e && e.stack || e), problems: ["THREW " + e], plan: null }; } }
function probs(m) { return m ? (m.problems || []).join(" | ") : "(nothing built)"; }
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 240) ? s.slice(0, n || 240) + "…" : s; }
function want(cond, why) { return cond ? "" : why; }
function all(list) { return list.filter(function (x) { return x; }).join("; "); }
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
function rx(s) { return s instanceof RegExp ? s : new RegExp(s); }
// the circuit of a MAKE CONTROL or a station's control view
function ctl(m) {
  var c = m && m.plan && (m.plan.circuit || (m.plan.views && m.plan.views.control && m.plan.views.control.circuit)) || null;
  return c && Array.isArray(c.rungs) ? c : null;   // a MAKE SCHEMATIC's plan.circuit is another thing
}
// the shapes of a result's ladder (MAKE CONTROL's, or a station's control view)
function ladderShapes(m) {
  if (!m || !m.plan) return [];
  if (m.views && m.views.control) return m.views.control.shapes || [];
  return m.shapes || [];
}
// every element of a circuit, flat: [{e, where}] (where: stops/starts/series/after/branch/feed)
function elements(c) {
  var out = [];
  (c.feed || []).forEach(function (e) { out.push({ e: e, where: "feed", out: "" }); });
  c.rungs.forEach(function (r) {
    ["stops", "starts", "series", "after"].forEach(function (k) { (r[k] || []).forEach(function (e) { out.push({ e: e, where: k, out: r.out.id }); }); });
    (r.branches || []).forEach(function (b) { b.forEach(function (e) { out.push({ e: e, where: "branch", out: r.out.id }); }); });
  });
  return out;
}
// the process switches (float, pressure, temp) of a circuit: "FS1 no, PS1 nc"
function procs(c) { return elements(c).filter(function (x) { return /^(float|pressure|temp)$/.test(x.e.kind); }).map(function (x) { return x.e.id + " " + x.e.kind + " " + (x.e.nc ? "nc" : "no"); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(", "); }

// ---- a ladder simulator with the process as a number -----------------------------------------------------------
// make(circuit, level): level(id) -> the process value at which the switch id changes over (a float's height, a
// pressure or temperature switch's setpoint). The process is one number (water, pressure or temperature). The symbol's
// meaning: normally open = closes when the process rises past its setting; normally closed = opens when it rises past.
// Push buttons are not pressed unless pressed; an overload is closed until it trips; a selector (switch) and a limit
// switch are in their run position (closed unless nc); a coil's contact follows its coil.
function make(circuit, level) {
  var rungs = circuit.rungs, on = {}, kinds = {}, alt = {};
  rungs.forEach(function (r) { on[r.out.id] = false; kinds[r.out.id] = r.out.kind; if (r.out.kind === "alternator") alt[r.out.id] = 0; });
  var st = { pv: 0, tripped: {}, pressed: {} };
  function closed(e) {
    var c;
    if (/^(float|pressure|temp)$/.test(e.kind)) { var h = level(e.id); c = h != null && st.pv >= h; return e.nc ? !c : c; }
    if (e.kind === "pb" || e.kind === "estop" || e.kind === "stop") { c = !!st.pressed[e.id]; return e.nc ? !c : c; }
    if (e.kind === "ol") return e.nc === false ? !!st.tripped[e.id] : !st.tripped[e.id];
    if (e.kind === "fuse") return true;
    if (e.kind === "contact") {
      var of = e.of || e.id;
      if (kinds[of] === "alternator") { var s1 = alt[of] === 1; return e.nc ? !s1 : s1; }
      c = !!on[of]; return e.nc ? !c : c;
    }
    return !e.nc;   // a selector or limit switch in its run position: as drawn (open if no, closed if nc) -- see each case
  }
  function allc(list) { return (list || []).every(closed); }
  function scan() {
    var feed = (circuit.feed || []).every(function (f) { return f.role === "fuse" ? true : !st.pressed[f.id]; }), next = {};
    rungs.forEach(function (r) {
      var ok = feed && allc(r.stops) && allc(r.series) && allc(r.after);
      if (ok && r.starts && r.starts.length) ok = r.starts.some(closed) || (r.seal && on[r.out.id]);
      if (ok && r.branches && r.branches.length) ok = r.branches.some(function (b) { return allc(b); });
      next[r.out.id] = ok;
    });
    var changed = false;
    Object.keys(next).forEach(function (k) { if (next[k] !== on[k]) { changed = true; if (kinds[k] === "alternator" && on[k] && !next[k]) alt[k] = 1 - alt[k]; on[k] = next[k]; } });
    return changed;
  }
  function settle() { for (var i = 0; i < 40; i++) if (!scan()) return; }
  return { set: function (v) { st.pv = v; settle(); }, press: function (id, v) { st.pressed[id] = v !== false; settle(); }, trip: function (id, v) { st.tripped[id] = v !== false; settle(); }, on: function (id) { return !!on[id]; } };
}
// trace(circuit, at, path, outs) -> "v:on,on v:on ..." the outputs on at each process value in turn
function trace(circuit, at, pathv, outs) {
  var S = make(circuit, function (id) { return at[id] == null ? null : at[id]; });
  return pathv.map(function (v) { S.set(v); return v + ":" + outs.filter(function (o) { return S.on(o); }).join("+"); }).join(" ");
}

// ---- geometry --------------------------------------------------------------------------------------------------
// flatten a shape tree; each primitive with its bounding box
function flat(sh, out) { out = out || []; (Array.isArray(sh) ? sh : [sh]).forEach(function (s) { if (!s) return; if (s.t === "group") flat(s.shapes, out); else out.push(s); }); return out; }
function bbox(s) {
  if (s.t === "circle") return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
  if (s.t === "rect") return [s.x, s.y, s.x + s.rw, s.y + s.rh];
  if (s.t === "text") { var w = String(s.s).length * (s.fs || 16) * 0.56; return [s.x - w / 2, s.y - (s.fs || 16) * 0.5, s.x + w / 2, s.y + (s.fs || 16) * 0.5]; }
  var xs = s.pts.map(function (p) { return p[0]; }), ys = s.pts.map(function (p) { return p[1]; });
  return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
}
function overlap(a, b, pad) { pad = pad || 0; return a[0] < b[2] - pad && b[0] < a[2] - pad && a[1] < b[3] - pad && b[1] < a[3] - pad; }
// segments of a path (or polygon) shape
function segs(s) {
  var p = s.pts || [], out = [];
  for (var i = 1; i < p.length; i++) out.push([p[i - 1], p[i]]);
  if (s.t === "tri") out.push([p[2], p[0]]);
  return out;
}
function distPtSeg(q, a, b) {
  var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  var x = a[0] + t * dx - q[0], y = a[1] + t * dy - q[1];
  return Math.sqrt(x * x + y * y);
}
// does a text's box cross any stroke of another shape (a line, a circle's ring) or another text? -> the shapes it crosses.
// A text is drawn bold, centred, its middle at y (DRAW's render, "bold <fs>px system-ui"): its box is taken as 0.5 em a
// character wide, 0.49 em above y and 0.42 em under it (measured in Chromium: "high level al\u2026" at 11 px is 74.5 px
// wide, its capitals 5.7 above the middle; "FS5" at 12 px, 5.4 above); a stroke counts with half its width.
function tbox(s) { var fs = s.fs || 16, w = String(s.s).length * fs * 0.5; return [s.x - w / 2, s.y - fs * 0.49, s.x + w / 2, s.y + fs * 0.42]; }
function textHits(text, shapes) {
  var b = tbox(text), hits = [];
  shapes.forEach(function (s) {
    if (s === text) return;
    if (s.t === "text") { if (overlap(b, tbox(s), 0)) hits.push(s); return; }
    var hw = (s.w || 2) / 2;
    if (s.t === "circle") {
      // the ring: any point of it inside the box (grown by half the stroke)
      for (var k = 0; k < 72; k++) { var an = k * Math.PI / 36, x = s.cx + s.r * Math.cos(an), y = s.cy + s.r * Math.sin(an); if (x > b[0] - hw && x < b[2] + hw && y > b[1] - hw && y < b[3] + hw) { hits.push(s); return; } }
      return;
    }
    if (s.pts) {
      var hit = segs(s).some(function (sg) {
        for (var k = 0; k <= 40; k++) { var x = sg[0][0] + (sg[1][0] - sg[0][0]) * k / 40, y = sg[0][1] + (sg[1][1] - sg[0][1]) * k / 40; if (x > b[0] - hw && x < b[2] + hw && y > b[1] - hw && y < b[3] + hw) return true; }
        return false;
      });
      if (hit) hits.push(s);
    }
  });
  return hits;
}
module.exports = { boot: boot, blk: blk, build: build, probs: probs, short: short, want: want, all: all, seq: seq, rx: rx, ctl: ctl, ladderShapes: ladderShapes,
  elements: elements, procs: procs, make: make, trace: trace, flat: flat, bbox: bbox, overlap: overlap, segs: segs, distPtSeg: distPtSeg, textHits: textHits, tbox: tbox, ROOT: ROOT, OLD: OLD, sleep: sleep };
