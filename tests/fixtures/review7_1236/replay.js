// node tests/fixtures/review7_1236/replay.js [lantern.inner.html]
// Replays the seventh review's cases (cases.js) against src/lantern.inner.html, or the file given. Prints, per case,
// "AGREE <id>" or "DISAGREE <id> <what was seen> [high|medium|low]", then "N cases: A AGREE, D DISAGREE".
"use strict";
var path = require("path"), fs = require("fs"), crypto = require("crypto");
var ROOT = path.join(__dirname, "..", "..", "..");
var file = process.argv[2] || path.join(ROOT, "src", "lantern.inner.html");
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var CASES = require("./cases.js");
var GUARD = JSON.parse(fs.readFileSync(path.join(__dirname, "guard_1235.json"), "utf8"));
var o = load(file), L = o.L;

// the given block shown for q: {kind: "lantern"|"kept", id, title, lines, text} or null
function shown(q) {
  var p = L.aiAct.prompt(q), a = p.indexOf("tested circuit for this"), b = p.indexOf("kept circuit for this"), at = Math.max(a, b);
  if (at < 0) return null;
  var m = /MAKE CONTROL:([^\n]*)\n([\s\S]*?)\nEND/.exec(p.slice(at));
  if (!m) return null;
  var g = L.givens ? L.givens.match("CONTROL", q, L.aiControl.isPumps(q) ? { user: true } : null) : null;
  return { kind: b > a ? "kept" : "lantern", id: g ? g.id : "?", title: m[1].trim(), lines: m[2].split("\n"), text: "MAKE CONTROL:" + m[1] + "\n" + m[2] + "\nEND" };
}
function fits(blk, w) {
  if (w.id && blk.id !== w.id) return false;
  if (w.lines && blk.lines.join("\n") !== w.lines.join("\n")) return false;
  if (w.has && !w.has.every(function (l) { return blk.lines.indexOf(l) >= 0; })) return false;
  if (w.hasRe && !w.hasRe.every(function (r) { return blk.lines.some(function (l) { return new RegExp(r).test(l); }); })) return false;
  if (w.lacks && w.lacks.some(function (r) { return blk.lines.some(function (l) { return new RegExp(r).test(l); }); })) return false;
  return true;
}
function brief(blk) { return blk ? blk.id + ": " + blk.lines.join(" | ") : "no given"; }
// a block shown, written back as it stands: it must build, nothing questioned, no code check back
function buildsClean(text, q) {
  var r = null;
  try { r = L.aiAct.build(text, q); } catch (e) { return "threw " + String(e).slice(0, 80); }
  if (!r) return "no build";
  if (!r.ok || (r.problems || []).length) return "questioned: " + (r.problems || []).join(" / ").slice(0, 200);
  if (r.codes && r.codes.back && r.codes.back.length) return "code check back: " + r.codes.back.join(" / ").slice(0, 200);
  return "";
}
function forgetAll() { if (!L.givens) return; (L.givens.mine() || []).forEach(function (g) { L.givens.forget(g.id); }); }
function h(s) { return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 16); }
// the guards' digests, as gen_guard.js makes them
function promptDigests() {
  var out = {};
  [["A", L.aiBenchQuestions], ["B", L.aiBenchQuestionsB]].forEach(function (pp) { (pp[1] || []).forEach(function (x) { out[pp[0] + ":" + x.id] = h(L.aiAct.prompt(x.q)); }); });
  return out;
}
function buildDigests() {
  var FX = path.join(ROOT, "tests", "fixtures"), out = {};
  fs.readdirSync(FX).filter(function (f) { return /^bench_run_.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d = JSON.parse(fs.readFileSync(path.join(FX, f), "utf8")), rows = Array.isArray(d) ? d : (d.rows || d.failed || []);
    if (!Array.isArray(rows)) return;
    rows.forEach(function (r, i) {
      if (!r || typeof r !== "object" || !r.q) return;
      Object.keys(r).forEach(function (kk) {
        var v = r[kk];
        if (typeof v !== "string" || !/MAKE\s+[A-Z]/.test(v)) return;
        var bb = null;
        try { bb = L.aiAct.build(v, r.q); } catch (e) { bb = { err: String(e).slice(0, 100) }; }
        var dg = bb ? { ok: !!bb.ok, problems: (bb.problems || []).join(" || ").slice(0, 600), summary: String(bb.summary || "").slice(0, 600), err: bb.err || "" } : null;
        out[f + "#" + i + "." + kk] = { q: r.q.slice(0, 80), h: h(JSON.stringify(dg)) };
      });
    });
  });
  return out;
}

function run(c) {
  var blk, why;
  if (c.t === "given") {
    blk = shown(c.q);
    if (c.want === "none") {
      if (!blk) return null;
      if (c.okIf && fits(blk, c.okIf)) return buildsClean(blk.text, c.q) ? "the block shown does not build clean: " + buildsClean(blk.text, c.q) : null;
      return "a given shown: " + brief(blk);
    }
    if (!blk) return c.orNone ? null : "no given (wanted " + c.want.id + (c.want.lines ? ": " + c.want.lines.join(" | ") : "") + ")";
    if (!fits(blk, c.want)) return "given fitted otherwise: " + brief(blk);
    why = buildsClean(blk.text, c.q);
    return why ? "the given shown does not build clean: " + why : null;
  }
  if (c.t === "kept") {
    if (!L.givens) return "no GIVENS module";
    forgetAll();
    var made = L.aiAct.build("MAKE CONTROL: My circuit\n" + c.block.join("\n") + "\nEND", c.q1), kept = L.givens.keep(made, c.q1);
    if (!kept) return "could not keep the circuit (" + (made && made.problems ? made.problems.join(" / ").slice(0, 120) : "no build") + ")";
    blk = shown(c.q2);
    var was = blk && blk.kind === "kept" ? "shown" : "hidden";
    forgetAll();
    if (c.want === "either" || c.want === was) return null;
    return "the kept circuit is " + was + " for “" + c.q2 + "”" + (was === "hidden" && blk ? " (Lantern's own " + blk.id + " instead)" : "");
  }
  if (c.t === "build") {
    var r = L.aiAct.build("MAKE CONTROL: t\n" + c.block.join("\n") + "\nEND", c.q), probs = r ? r.problems || [] : ["no build"];
    if (c.want === "clean") return r && r.ok && !probs.length ? null : "sent back: " + probs.join(" / ").slice(0, 220);
    if (!probs.length) return "not sent back" + (r && r.codes ? " (checked: " + r.codes.checked.filter(function (x) { return x.ok; }).map(function (x) { return x.ok; }).join("; ") + ")" : "");
    if (c.line && !probs.some(function (x) { return x.indexOf(c.line) >= 0; })) return "sent back without “" + c.line + "”: " + probs.join(" / ").slice(0, 220);
    return null;
  }
  if (c.t === "pick") {
    if (!L.codeChecks) return "no CODE_CHECKS module";
    var pk = L.codeChecks.pick(c.q);
    return pk === c.want ? null : "follows " + pk;
  }
  if (c.t === "guard-prompts") {
    var now = promptDigests(), bad = Object.keys(GUARD.prompts).filter(function (id) { return !/^[AB]:make-control(?:-b)?$/.test(id) && now[id] !== GUARD.prompts[id]; });
    return bad.length ? bad.length + " bench prompts differ from 1.24.35's: " + bad.slice(0, 8).join(", ") : null;
  }
  if (c.t === "guard-builds") {
    var nb = buildDigests(), bad2 = Object.keys(GUARD.builds).filter(function (kk) { return !nb[kk] || nb[kk].h !== GUARD.builds[kk].h; });
    return bad2.length ? bad2.length + " saved replies build otherwise than on 1.24.35: " + bad2.slice(0, 6).map(function (kk) { return kk + " (" + GUARD.builds[kk].q + ")"; }).join("; ") : null;
  }
  return "unknown case type " + c.t;
}

setTimeout(function () {
  var A = 0, D = 0, by = { high: 0, medium: 0, low: 0 };
  try { L.store.set("codes.practice", ""); } catch (e) { }
  forgetAll();
  CASES.forEach(function (c) {
    var why;
    try { why = run(c); } catch (e) { why = "the case threw: " + String(e && e.stack || e).slice(0, 200); }
    if (why) { D++; by[c.harm] = (by[c.harm] || 0) + 1; console.log("DISAGREE " + c.id + " " + why.replace(/\s+/g, " ") + " [" + c.harm + "]"); }
    else { A++; console.log("AGREE " + c.id); }
  });
  console.log("(disagreements by harm: " + by.high + " high, " + by.medium + " medium, " + by.low + " low; file " + path.relative(ROOT, file) + ")");
  console.log(CASES.length + " cases: " + A + " AGREE, " + D + " DISAGREE");
  process.exit(0);
}, 80);
