// replay.js -- the fourth review of 1.24.36 (review4_1236): runs cases.js against src/lantern.inner.html (or argv[2])
// and, for the prompts and builds that must not change, against 1.24.35 (git show 8cb3281, read into memory).
// Prints AGREE <id> or DISAGREE <id> <what was seen> [harm] per case, then "N cases: A AGREE, D DISAGREE".
//   node tests/fixtures/review4_1236/replay.js [file]
"use strict";
var fs = require("fs"), path = require("path"), cp = require("child_process");
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var ROOT = path.resolve(__dirname, "..", "..", "..");
var FILE = process.argv[2] || path.join(ROOT, "src", "lantern.inner.html");
var CASES = require("./cases.js");

// the page in jsdom, as tests/fixtures/liftstation_review1_1230/load.js loads it, from the file's text
function page(inner) {
  var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  var vc = new VirtualConsole();
  vc.on("jsdomError", function () {});
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-Q4_K_M.gguf" }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    return resp(404, "nf", "text/plain");
  };
  w.eval(JS);
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  return { w: w, L: w.Lantern };
}
var oldText = null;
try { oldText = cp.execSync("git show 8cb3281:src/lantern.inner.html", { cwd: ROOT, maxBuffer: 1 << 28 }).toString(); } catch (e) { oldText = null; }
var newText = fs.readFileSync(FILE, "utf8");
var A = page(newText), U = page(newText), V = page(newText), P = page(newText), O = oldText ? page(oldText) : null;

var out = [], agree = 0, dis = 0;
function ok(id) { out.push("AGREE " + id); agree++; }
function bad(id, what, harm) { out.push("DISAGREE " + id + " " + String(what).replace(/\s+/g, " ").slice(0, 900) + " [" + (harm || "medium") + "]"); dis++; }
function re(s) { return new RegExp(s); }

var SHOWN = /\n(?:Lantern’s tested circuit for this|Your own kept circuit for this)[^\n]*\n(MAKE CONTROL:[^\n]*\n(?:[^\n]*\n)*?END)(?:\n|$)/;
function shownOf(p) { var m = SHOWN.exec(String(p || "")); return m ? m[1] : null; }
function linesOf(block) { return block.split("\n").slice(1, -1); }
function stepsOf(r) { return r && r.plan && r.plan.circuit && r.plan.circuit.steps ? r.plan.circuit.steps : []; }
function codesLine(L, r) { return r && r.codes && L.codeChecks ? L.codeChecks.line(r.codes) : ""; }

function runGiven(c) {
  var L = A.L, p = L.aiAct.prompt(c.q), block = shownOf(p), g = null;
  try { g = L.givens.match("CONTROL", c.q, L.aiControl.isPumps(c.q) ? { user: true } : null); } catch (e) { g = null; }
  if (!block) {
    if (O && O.L.aiAct.prompt(c.q) !== p) return bad(c.id, "no given shown, but the prompt is not 1.24.35's", "medium");
    if (c.expect === "fit") return bad(c.id, "no given shown (refused" + (g ? "; " + g.id + " matched but gave no block" : "") + "), where " + c.given + " fits", c.missHarm || "medium");
    return ok(c.id);
  }
  var ls = linesOf(block), seen = (g ? g.id : "a given") + ": " + ls.join(" / ");
  if (c.expect === "none") return bad(c.id, seen + " -- shown for a question it does not fit", c.harm || "high");
  if (c.given && g && g.id !== c.given) return bad(c.id, seen + " -- not " + c.given, c.harm || "high");
  var miss = (c.has || []).filter(function (h) { return ls.indexOf(h) < 0; }), extra = ls.filter(function (l) { return (c.lacks || []).some(function (x) { return re(x).test(l); }); });
  if (miss.length || extra.length) return bad(c.id, seen + " -- " + (miss.length ? "lacks " + miss.join(" / ") : "") + (extra.length ? (miss.length ? "; " : "") + "has " + extra.join(" / ") : ""), c.harm || "high");
  var r = L.aiAct.build(block, c.q);
  if (!r || !r.ok) return bad(c.id, seen + " -- Lantern's own given does not build clean: " + (r && r.problems || []).join("; "), "high");
  return ok(c.id);
}

function runBuild(c) {
  var L = A.L, r = L.aiAct.build(c.reply, c.q), r0 = O ? O.L.aiAct.build(c.reply, c.q) : null;
  var probs = (r && r.problems) || [], st = stepsOf(r), cl = codesLine(L, r), why = [];
  var said = "ok " + !!(r && r.ok) + (probs.length ? "; back: " + probs.join(" || ") : "") + (st.length ? "; steps: " + st.join(" | ") : "") + (cl ? "; " + cl : "");
  if (c.ok != null && !!(r && r.ok) !== c.ok) why.push(c.ok ? "sent back" : "not sent back");
  (c.back || []).forEach(function (x) { if (!probs.some(function (p) { return re(x).test(p); })) why.push("no problem matching /" + x + "/"); });
  (c.notBack || []).forEach(function (x) { if (probs.some(function (p) { return re(x).test(p); })) why.push("a line handed back matching /" + x + "/"); });
  (c.steps || []).forEach(function (x) { if (!re(x).test(st.join(" | "))) why.push("steps lack /" + x + "/"); });
  (c.notSteps || []).forEach(function (x) { if (re(x).test(st.join(" | "))) why.push("steps have /" + x + "/"); });
  if (c.codes && !re(c.codes).test(cl)) why.push("checked line lacks /" + c.codes + "/");
  if (c.notCodes && re(c.notCodes).test(cl)) why.push("checked line has /" + c.notCodes + "/");
  if (c.noBack && r && r.codes && r.codes.back.length) why.push("code checks sent it back");
  if (c.same && r0) {
    var a = JSON.stringify([!!(r && r.ok), probs, st]), b = JSON.stringify([!!(r0 && r0.ok), (r0 && r0.problems) || [], stepsOf(r0)]);
    if (a !== b) why.push("not built as on 1.24.35 (" + JSON.stringify(b).slice(0, 300) + ")");
  }
  if (!why.length) return ok(c.id);
  var harm = c.harm || (c.ok === true ? "high" : c.ok === false ? "medium" : "medium");
  return bad(c.id, why.join("; ") + " -- seen: " + said, harm);
}

function forgetAll(L) { (L.givens.mine() || []).forEach(function (g) { L.givens.forget(g.id); }); }
function keepVia(L, q, reply) {
  var r = L.aiAct.build(reply, q);
  if (!r || !r.ok) return { r: r, kept: false };
  var v = L.aiAct.view(r), b = v ? [].slice.call(v.querySelectorAll(".la-keep button")).filter(function (x) { return /Keep as my given/.test(x.textContent); })[0] : null;
  if (!b) return { r: r, kept: false, v: v };
  b.onclick();
  return { r: r, kept: L.givens.mine().length > 0, v: v };
}
function runUser(c) {
  var L = U.L;
  forgetAll(L);
  var k = keepVia(L, c.keep.q, c.keep.reply);
  if (c.keepFails) {
    var p0 = L.aiAct.prompt(c.q);
    forgetAll(L);
    return !k.kept && !/Your own kept circuit/.test(p0) ? ok(c.id) : bad(c.id, "a circuit that was sent back was kept", "medium");
  }
  if (!k.kept) { forgetAll(L); return bad(c.id, "could not keep the circuit: " + ((k.r && k.r.problems) || []).join("; "), "medium"); }
  L.aiBench = L.aiBench || {};
  var was = L.aiBench.running;
  L.aiBench.running = !!c.bench;
  var p = L.aiAct.prompt(c.q);
  L.aiBench.running = was;
  var shown = /Your own kept circuit for this/.test(p);
  forgetAll(L);
  if (shown === c.shown) return ok(c.id);
  return bad(c.id, shown ? "the kept circuit (asked “" + c.keep.q + "”) is shown for “" + c.q + "”" : "the kept circuit is not shown for “" + c.q + "”", c.harm || (c.shown ? "medium" : "high"));
}
function runForget(c) {
  var L = U.L;
  forgetAll(L);
  var k = keepVia(L, c.keep.q, c.keep.reply);
  if (!k.kept) return bad(c.id, "could not keep", "medium");
  var v = L.aiAct.view(k.r), box = v && v.querySelector(".la-keep"), f = box && box.querySelector("button");
  if (!f || !/Forget it/.test(f.textContent)) { forgetAll(L); return bad(c.id, "no Forget it under a kept circuit: " + (box && box.textContent), "low"); }
  f.onclick();
  var st = U.w.localStorage.getItem("lantern.givens.user"), p = L.aiAct.prompt(c.keep.q);
  forgetAll(L);
  if (L.givens.mine().length || /Your own kept circuit/.test(p) || (st && JSON.parse(st).length)) return bad(c.id, "still kept after Forget it: " + st, "medium");
  return ok(c.id);
}
function runView(c) {
  var L = V.L, why = [];
  try { V.w.localStorage.removeItem("lantern.codes.practice"); } catch (e) {}
  forgetAll(L);
  var r = L.aiAct.build(c.reply, c.q), v = L.aiAct.view(r), codes = v && v.querySelector(".la-codes"), keepBox = v && v.querySelector(".la-keep");
  if (c.noTools) { if (codes || keepBox) why.push("a code line or a keep button under a circuit that was sent back"); }
  if (c.codes && !(codes && re(c.codes).test(codes.textContent))) why.push("code line: " + (codes ? codes.textContent : "(none)"));
  if (c.keep && !keepBox) why.push("no keep button");
  if (c.switchTo) {
    var b = codes && codes.querySelector("button");
    if (!b) why.push("no switch button"); else {
      b.onclick();
      if (c.codesAfter && !re(c.codesAfter).test(codes.textContent)) why.push("after switching: " + codes.textContent);
      if (L.codeChecks.saved() !== c.switchTo) why.push("choice not kept: " + L.codeChecks.saved());
      if (c.pickAfter && L.codeChecks.pick(c.pickAfter[0]) !== c.pickAfter[1]) why.push("a question naming neither code is not checked to the choice");
    }
  }
  if (c.keepWorks && keepBox) {
    var kb = keepBox.querySelector("button");
    if (kb) { kb.onclick(); if (!L.givens.mine().length) why.push("“Keep as my given” is shown under it and keeps nothing (" + keepBox.textContent + ")"); }
  }
  forgetAll(L);
  try { V.w.localStorage.removeItem("lantern.codes.practice"); } catch (e) {}
  return why.length ? bad(c.id, why.join("; "), c.harm || "medium") : ok(c.id);
}
// the prompt with a given: the instructions kept up to their example, the example out, the given in its place
function runShape(c) {
  var L = A.L, p = L.aiAct.prompt(c.q), why = [];
  if (c.pumps) {
    if (!O || O.L.aiAct.prompt(c.q) !== p) why.push("a pump station's prompt differs from 1.24.35's with no kept circuit");
    return why.length ? bad(c.id, why.join("; "), "high") : ok(c.id);
  }
  var base = L.aiControl.PROMPT, at = -1;
  base.forEach(function (l, i) { if (at < 0 && /For example:\s*$/.test(l)) at = i; });
  base.slice(0, at).forEach(function (l) { if (l && p.indexOf(l) < 0) why.push("lost the instructions' line “" + l.slice(0, 60) + "”"); });
  if (/For example:/.test(p)) why.push("still says For example:");
  if (p.indexOf("MAKE CONTROL: Sump pump") >= 0) why.push("still shows the instructions' own example");
  if (!/Lantern’s tested circuit for this \([^)]*\): write it as it stands, changing only what the question asks:\nMAKE CONTROL: /.test(p)) why.push("no given header before its block");
  if ((p.match(/\nEND(?:\n|$)/g) || []).length !== 2) why.push("not two END lines (the instructions' and the given's)");
  return why.length ? bad(c.id, why.join("; "), "medium") : ok(c.id);
}
function runPick(c) {
  var p = P.L.codeChecks.pick(c.q);
  return p === c.expect ? ok(c.id) : bad(c.id, "followed " + p + " practice for “" + c.q + "”", c.harm || "low");
}
function runGuard(c) {
  if (!O) return bad(c.id, "1.24.35 could not be read from git: not run", "low");
  if (c.what === "bench") {
    var qs = A.L.aiBenchQuestions.concat(A.L.aiBenchQuestionsB), diff = [];
    qs.forEach(function (x) { if (A.L.aiAct.prompt(x.q) !== O.L.aiAct.prompt(x.q)) diff.push(x.id); });
    var other = diff.filter(function (id) { return id !== "make-control" && id !== "make-control-b"; });
    return other.length ? bad(c.id, qs.length + " bench prompts; differ from 1.24.35: " + other.join(", "), "high") : ok(c.id);
  }
  var dir = path.join(ROOT, "tests", "fixtures"), rows = [], diff2 = [];
  fs.readdirSync(dir).filter(function (f) { return /^bench_run_.*\.json$/.test(f); }).forEach(function (f) {
    var d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), rs = [];
    if (Array.isArray(d)) rs = d; else Object.keys(d).forEach(function (k) { if (Array.isArray(d[k])) rs = rs.concat(d[k]); });
    rs.forEach(function (r) { ["reply", "first"].forEach(function (k) { if (r && typeof r[k] === "string" && /MAKE\s/.test(r[k])) rows.push({ f: f, id: r.id, q: r.q, t: r[k] }); }); });
  });
  function sum(r) { return r ? JSON.stringify([!!r.ok, r.problems || [], r.summary || "", stepsOf(r)]) : "null"; }
  rows.forEach(function (x) {
    var a, b;
    try { a = sum(A.L.aiAct.build(x.t, x.q)); } catch (e) { a = "ERR " + e.message; }
    try { b = sum(O.L.aiAct.build(x.t, x.q)); } catch (e) { b = "ERR " + e.message; }
    if (a !== b) diff2.push(x.f + ":" + x.id);
  });
  return diff2.length ? bad(c.id, rows.length + " saved replies with a MAKE block; build otherwise than on 1.24.35: " + diff2.join(", "), "medium") : ok(c.id);
}

setTimeout(function () {
  CASES.forEach(function (c) {
    try {
      if (c.kind === "given") runGiven(c);
      else if (c.kind === "build") runBuild(c);
      else if (c.kind === "user") runUser(c);
      else if (c.kind === "userforget") runForget(c);
      else if (c.kind === "view") runView(c);
      else if (c.kind === "pick") runPick(c);
      else if (c.kind === "guard") runGuard(c);
      else if (c.kind === "shape") runShape(c);
      else bad(c.id, "unknown kind " + c.kind, "low");
    } catch (e) { bad(c.id, "threw: " + e.message, "medium"); }
  });
  out.forEach(function (l) { console.log(l); });
  console.log(CASES.length + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
}, 150);
