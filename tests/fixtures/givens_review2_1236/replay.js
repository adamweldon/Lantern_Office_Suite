// replay.js -- the second review of 1.24.36's givens, replayed.
// Usage: node tests/fixtures/givens_review2_1236/replay.js [path/to/lantern.inner.html] [--only <id regex>]
// Loads the page (default src/lantern.inner.html) and 1.24.35 as released (git show 8cb3281) in jsdom, and runs every
// case: cases_fit.js (what the model is shown), cases_sim.js (the givens built and simulated, and as a small model
// copies them), cases_rules.js ("stop ... all", a fill held in on two nc floats), cases_user.js (the user's own givens,
// each on a page of its own). One line per case: AGREE <id>, or DISAGREE <id> <what was seen> [harm].
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var lib = require("./lib.js");
var ROOT = path.resolve(__dirname, "..", "..", "..");
var args = process.argv.slice(2), only = null, file = path.join(ROOT, "src", "lantern.inner.html");
for (var i = 0; i < args.length; i++) { if (args[i] === "--only") only = new RegExp(args[++i]); else file = path.resolve(args[i]); }
var OLDREV = "8cb3281", oldFile = path.join(os.tmpdir(), "givens_review2_1236_" + OLDREV + ".html");
if (!fs.existsSync(oldFile)) fs.writeFileSync(oldFile, cp.execSync("git show " + OLDREV + ":src/lantern.inner.html", { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
var FIT = require("./cases_fit.js"), SIM = require("./cases_sim.js"), RULES = require("./cases_rules.js"), USER = require("./cases_user.js");
var counts = { AGREE: 0, DISAGREE: 0 }, byHarm = { high: 0, medium: 0, low: 0 };
function say(id, seen, harm) {
  if (!seen) { counts.AGREE++; console.log("AGREE " + id); return; }
  counts.DISAGREE++; byHarm[harm] = (byHarm[harm] || 0) + 1;
  console.log("DISAGREE " + id + " " + String(seen).replace(/\s*\n\s*/g, " / ") + " [" + harm + "]");
}
function wanted(c) { return !only || only.test(c.id); }
function shape(m) {
  if (!m) return "nothing built";
  if (!m.plan || !m.plan.circuit) return "not made: " + (m.problems || []).join("; ");
  var c = m.plan.circuit;
  function e(x) { return x.id + (x.nc ? "/" : "") + (x.timed ? "t" : ""); }
  function l(xs) { return "[" + (xs || []).map(e).join(" ") + "]"; }
  return "feed" + l(c.feed) + " " + c.rungs.map(function (r) {
    return r.out.id + ":S" + l(r.stops) + "T" + l(r.starts) + (r.seal ? "+seal" : "") + "C" + l(r.series) + "A" + l(r.after) + (r.branches ? "B[" + r.branches.map(l).join("|") + "]" : "");
  }).join(" ");
}
var o = lib.load(file), oo = lib.load(oldFile);
setTimeout(function () {
  var L = o.L, LO = oo.L;
  if (o.errs.length) console.log("# page errors: " + o.errs.join("; "));
  function gid(s) { return s.kind === "lantern" ? lib.givenId(L, s.says) : s.kind; }
  // ---- fit cases ---------------------------------------------------------------------------------------------------
  FIT.filter(wanted).forEach(function (c) {
    var s = lib.shown(L, c.q), id = gid(s), seen = "", oldP = LO.aiAct.prompt(c.q);
    var desc = s.kind ? "given " + id + ": " + s.lines.join(" | ") : "no given";
    function lines() {
      var out = [];
      (c.has || []).forEach(function (h) { if (s.lines.indexOf(h) < 0) out.push("no line \x22" + h + "\x22"); });
      (c.hasRe || []).forEach(function (h) { if (!s.lines.some(function (l) { return new RegExp(h).test(l); })) out.push("no line like /" + h + "/"); });
      (c.lacks || []).forEach(function (h) { var b = s.lines.filter(function (l) { return new RegExp(h).test(l); }); if (b.length) out.push("has \x22" + b[0] + "\x22"); });
      Object.keys(c.count || {}).forEach(function (h) { var n = s.lines.filter(function (l) { return new RegExp(h).test(l); }).length; if (n !== c.count[h]) out.push(n + " lines like /" + h + "/, want " + c.count[h]); });
      return out;
    }
    if (c.want === "none") {
      if (s.kind) seen = desc;
      else if (s.prompt !== oldP) seen = "no given, but the prompt differs from 1.24.35's";
    } else if (typeof c.want === "string") {
      if (!s.kind) seen = "no given (want " + c.want + ")";
      else if (id !== c.want) seen = desc + " (want " + c.want + ")";
      else { var bad = lines(); if (bad.length) seen = bad.join("; ") + " -- " + desc; }
    } else {
      if (!s.kind) { if (s.prompt !== oldP) seen = "no given, but the prompt differs from 1.24.35's"; }
      else if ((c.want.notGiven || []).indexOf(id) >= 0) seen = desc;
      else { var bad2 = lines(); if (bad2.length) seen = bad2.join("; ") + " -- " + desc; }
    }
    say(c.id, seen, c.harm);
  });
  // ---- built and simulated -------------------------------------------------------------------------------------------
  var X = { L: L, lib: lib, shape: shape,
    given: function (q) { var s = lib.shown(L, q); return s.kind ? lib.blockOf(s) : null; },
    build: function (t, q) { return L.aiAct.build(t, q); },
    buildOld: function (t, q) { return LO.aiAct.build(t, q); },
    sim: function (m, env) { return lib.sim(m.plan.circuit, env); } };
  SIM.concat(RULES).filter(wanted).forEach(function (c) {
    var seen;
    try { seen = c.run(X); } catch (e) { seen = "threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e); }
    say(c.id, seen, c.harm);
  });
  // ---- the user's own givens: a page each ------------------------------------------------------------------------------
  var base = lib.load(file);
  setTimeout(function () {
    var users = USER.filter(wanted), k = 0;
    function next() {
      if (k >= users.length) return done();
      var c = users[k++], p = lib.load(file, c.store);
      setTimeout(function () {
        var x = { L: p.L, w: p.w, errs: p.errs, lib: lib,
          build: function (t, q) { return p.L.aiAct.build(t, q); },
          shown: function (q) { return lib.shown(p.L, q); },
          gid: function (s) { return s.kind === "lantern" ? lib.givenId(p.L, s.says) : s.kind; },
          base: function (q) { return base.L.aiAct.prompt(q); },
          old: function (q) { return LO.aiAct.prompt(q); },
          stored: function () { var r = p.w.localStorage.getItem("lantern.givens.user"); try { return r ? JSON.parse(r) : []; } catch (e) { return "unparsed: " + r; } },
          buttons: function (v) { return Array.prototype.slice.call(v.querySelectorAll("button")).map(function (b) { return b.textContent; }); },
          buttonEl: function (v, t) { return Array.prototype.slice.call(v.querySelectorAll("button")).filter(function (b) { return b.textContent === t; })[0] || null; },
          keepBtn: function (m) { var v = p.L.aiAct.view(m), b = x.buttonEl(v, "Keep as my given"); if (!b) return null; b.click(); return v; } };
        var seen;
        try { seen = c.run(x); } catch (e) { seen = "threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e); }
        say(c.id, seen, c.harm);
        try { p.w.close(); } catch (e) { }
        next();
      }, 90);
    }
    next();
  }, 90);
  function done() {
    console.log("disagreements by harm: high " + (byHarm.high || 0) + ", medium " + (byHarm.medium || 0) + ", low " + (byHarm.low || 0));
    console.log((counts.AGREE + counts.DISAGREE) + " cases: " + counts.AGREE + " AGREE, " + counts.DISAGREE + " DISAGREE");
    process.exit(0);
  }
}, 120);
