// replay.js -- runs the second review's cases of the library catalog (1.24.38) against src/lantern.inner.html, or the
// file named as the first argument (for example the old file, 1.24.37, to see what it did).
//
//   node tests/fixtures/review2_library_1238/replay.js [file.html]
//
// Prints "AGREE <id>" or "DISAGREE <id> <what was seen> [severity]" for each case, then "N cases: A AGREE, D DISAGREE".
// The kinds of case (cases.js):
//   handed     what Chat hands the model for a question: the safety rule (L.ai.guard), a question about Lantern
//              (Lantern.chatAbout), one about the model itself, then Lantern.chatContext's providers in their order,
//              the first that gives passages -- as ASSIST_CHAT's turn does
//   openOf     whether a reply is read as OPEN <shelf> (Lantern.chatCommands, id "open"); null when it is not
//   open       what OPEN <shelf> sends for a question (Lantern.catalog.open)
//   offerOpen  the shelf the library prompt names or offers for a question, then what OPEN of it sends -- the path a
//              model that copies the header's "OPEN 6.2" takes
//   turn       a whole Chat turn (Lantern.CHAT.converse) with a stand-in model whose replies are given
//   header     the shelf the library prompt claims ("on shelf", "most likely on shelf", "about Lantern itself") or
//              offers ("may be on shelf"), judged against the shelves a librarian would rightly send it to
//   band       of the claims made on questions.json, the share that is right, against the band's promise
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..", "..", "..");
var load = require(path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
var FILE = process.argv[2] || path.join(ROOT, "src", "lantern.inner.html");
var CASES = require("./cases.js");
var QUESTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf8"));

var o = load(FILE), L = null;
function setMode(m) { if (L.aiPrompt && L.aiPrompt.setMode) L.aiPrompt.setMode(m || "auto"); }

// --- what Chat hands the model ---------------------------------------------------------------------------------------
async function handed(q, mode) {
  setMode(mode);
  var g = null;
  try { g = L.ai && L.ai.guard ? L.ai.guard(q) : null; } catch (e) { g = null; }
  if (g) return { via: "guard:" + (g.id || "?"), keys: [], apps: [] };
  var A = L.assist, nolib = !!(A.noLibrary && A.noLibrary(q)), self = !!(A.aboutSelf && A.aboutSelf(q)), i;
  if (!nolib) {
    var AB = L.chatAbout || [];
    for (i = 0; i < AB.length; i++) {
      var a = null;
      try { a = await AB[i].provide(q, []); } catch (e) { a = null; }
      if (a && a.prompt) return { via: "about:" + (a.id || AB[i].id), keys: [], apps: [] };
    }
  }
  if (self || nolib) return { via: "self", keys: [], apps: [] };
  var CTX = L.chatContext || [];
  for (i = 0; i < CTX.length; i++) {
    var d = null;
    try { d = await CTX[i].provide(q, [], { wantsDetail: false }); } catch (e) { d = null; }
    if (d && d.sources && d.sources.length) return { via: CTX[i].id, keys: d.sources.map(function (s) { return s.key; }), apps: d.sources.map(function (s) { return s.app || ""; }) };
  }
  return { via: "-", keys: [], apps: [] };
}
function openCmd() { return (L.chatCommands || []).filter(function (c) { return c && c.id === "open"; })[0] || null; }
function openOf(reply, mode) {
  setMode(mode || "library");
  var c = openCmd();
  if (!c) return null;
  var v = null;
  try { v = c.test(reply); } catch (e) { v = null; }
  return v == null ? null : String(v);
}
function opened(shelf, q) {
  setMode("library");
  if (!L.catalog || !L.catalog.open) return { keys: [], apps: [], prompt: "", none: true };
  var r = L.catalog.open(shelf, q) || {};
  return { keys: (r.sources || []).map(function (s) { return s.key; }), apps: (r.sources || []).map(function (s) { return s.app || ""; }), prompt: r.prompt || "" };
}
// the shelf lines of the library prompt for a question (what Chat's system message says)
function claimOf(q) {
  setMode("library");
  var s = "";
  try { s = L.CHAT.buildSystem(q); } catch (e) { s = ""; }
  var m, out = { sys: s, claim: null, band: null, offer: null };
  if ((m = /^This question is on shelf (\d\.\d)\b/m.exec(s))) { out.claim = m[1]; out.band = "sure"; }
  else if ((m = /^This question is most likely on shelf (\d\.\d)\b/m.exec(s))) { out.claim = m[1]; out.band = "likely"; }
  else if ((m = /^This question is about Lantern itself \(shelf (\d\.\d)\b/m.exec(s))) { out.claim = m[1]; out.band = "about"; }
  if ((m = /^This question may be on shelf (\d\.\d)\b/m.exec(s))) out.offer = m[1];
  return out;
}
function rightShelf(shelf, right) { return right.indexOf(shelf) >= 0 || (shelf === "0.2" && right.indexOf("none") >= 0); }

// --- judging ---------------------------------------------------------------------------------------------------------
function judgeSources(got, ex) {
  var bad = [];
  if (ex.nothing && got.keys.length) bad.push("handed " + got.keys.join(","));
  if (ex.via && got.via !== ex.via) bad.push("via " + got.via + " (" + (got.keys.join(",") || "nothing") + "), not " + ex.via);
  if (ex.anyOf && !got.keys.some(function (k) { return ex.anyOf.indexOf(k) >= 0; })) bad.push("handed " + (got.keys.join(",") || "nothing") + ", none of " + ex.anyOf.join("/"));
  if (ex.noneOf) { var hit = got.keys.filter(function (k) { return ex.noneOf.indexOf(k) >= 0; }); if (hit.length) bad.push("handed " + hit.join(",")); }
  if (ex.noApp) { var ha = got.keys.filter(function (k, i) { return ex.noApp.indexOf(got.apps[i]) >= 0; }); if (ha.length) bad.push("handed " + ha.join(",") + " (" + ex.noApp.join("/") + " tile)"); }
  if (ex.onlyKeys) { var out = got.keys.filter(function (k) { return ex.onlyKeys.indexOf(k) < 0; }); if (out.length) bad.push("handed " + out.join(",")); }
  if (ex.noLessons && got.keys.length) bad.push("sent lessons " + got.keys.join(","));
  if (ex.promptHas && !new RegExp(ex.promptHas).test(got.prompt || "")) bad.push("prompt lacks /" + ex.promptHas + "/: " + String(got.prompt || "").split("\n")[0].slice(0, 80));
  return bad.join("; ");
}
var claimCache = {};
function claim(q) { if (!(q in claimCache)) claimCache[q] = claimOf(q); return claimCache[q]; }
async function run(c) {
  var x = c.input, ex = c.expect, got;
  if (x.kind === "handed") { got = await handed(x.q, x.mode); return judgeSources(got, ex); }
  if (x.kind === "openOf") {
    var v = openOf(x.reply, x.mode);
    return v === ex.open ? "" : "read as " + JSON.stringify(v) + ", not " + JSON.stringify(ex.open);
  }
  if (x.kind === "open") {
    got = opened(x.shelf, x.q);
    if (got.none && (ex.anyOf || ex.promptHas)) return "no OPEN in this file";
    return judgeSources(got, ex);
  }
  if (x.kind === "offerOpen") {
    var h = claim(x.q), sh = h.claim || h.offer;
    if (!sh) return ex.offered || ex.anyOf ? "no shelf named or offered" : "";
    got = opened(sh, x.q);
    var b = judgeSources(got, ex);
    return b ? "the prompt " + (h.claim ? "names" : "offers") + " shelf " + sh + "; OPEN " + sh + " " + b : "";
  }
  if (x.kind === "turn") {
    setMode(x.mode || "library");
    var n = 0, replies = x.replies;
    var call = function () { var r = replies[Math.min(n, replies.length - 1)]; n++; return Promise.resolve(r); };
    var res = await L.CHAT.converse([x.q], { call: call }), t = res.turns[0];
    var cmds = (t.commands || []).map(function (k) { return k.verb + " " + k.arg; });
    var keys = (t.sources || []).map(function (s) { return s.key; }), bad = [];
    if (ex.commands !== undefined && cmds.join("|") !== ex.commands.join("|")) bad.push("commands run: " + (cmds.join(", ") || "none"));
    var jb = judgeSources({ keys: keys, apps: (t.sources || []).map(function (s) { return s.app || ""; }), via: "turn" }, { noneOf: ex.noneOf, anyOf: ex.anyOf });
    if (jb) bad.push(jb);
    if (ex.finalHas && !new RegExp(ex.finalHas).test(String(t.final || ""))) bad.push("the answer shown: " + JSON.stringify(String(t.final || "").slice(0, 80)));
    return bad.join("; ");
  }
  if (x.kind === "header") {
    var hh = claim(x.q);
    if (x.check === "offer") return hh.offer && !rightShelf(hh.offer, ex.right) ? "offered shelf " + hh.offer + " (right: " + ex.right.join("/") + ")" : "";
    return hh.claim && !rightShelf(hh.claim, ex.right) ? "claimed " + hh.band + " shelf " + hh.claim + " (right: " + ex.right.join("/") + ")" : "";
  }
  if (x.kind === "band") {
    var tally = [0, 0], wrong = [];
    QUESTIONS.forEach(function (qq) {
      var hb = claim(qq.q);
      if (!hb.claim) return;
      var band = hb.band === "about" ? "likely" : hb.band;
      if (band !== x.band) return;
      var ev = L.catalog && L.catalog.route ? L.catalog.route(qq.q).ev : "";
      var isLesson = /^lesson-|^health$/.test(ev);
      if (x.ev === "lessons" && !isLesson) return;
      if (x.ev === "tools" && isLesson) return;
      tally[1]++;
      if (rightShelf(hb.claim, qq.shelf)) tally[0]++; else wrong.push(hb.claim + " for \u201c" + qq.q.slice(0, 40) + "\u201d");
    });
    if (!tally[1]) return "";
    var share = tally[0] / tally[1];
    return share >= x.min ? "" : tally[0] + " of " + tally[1] + " right (" + Math.round(100 * share) + "%, under " + Math.round(100 * x.min) + "%): " + wrong.join("; ");
  }
  return "unknown kind " + x.kind;
}

setTimeout(async function () {
  L = o.L;
  var agree = 0, disagree = 0;
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i], bad;
    try { bad = await run(c); } catch (e) { bad = "threw " + String(e && e.message || e).slice(0, 120); }
    if (bad) { disagree++; console.log("DISAGREE " + c.id + " " + bad.replace(/[^\x20-\x7e]/g, function (ch) { return ch === "\u201c" || ch === "\u201d" ? "\x22" : ch === "\u2019" ? "\x27" : "?"; }) + " [" + c.severity + "]"); }
    else { agree++; console.log("AGREE " + c.id); }
  }
  setMode("auto");
  console.log(CASES.length + " cases: " + agree + " AGREE, " + disagree + " DISAGREE");
  process.exit(0);
}, 200);
