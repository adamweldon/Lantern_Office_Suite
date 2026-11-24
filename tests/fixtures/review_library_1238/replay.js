// replay.js -- runs the review's cases (cases.js) against src/lantern.inner.html, or the file named in argv[2].
//   node tests/fixtures/review_library_1238/replay.js [path/to/lantern.inner.html]
// Prints "AGREE <id>" or "DISAGREE <id> <what was seen> [severity]" per case, then "N cases: A AGREE, D DISAGREE".
// It reads Lantern; it changes nothing. Exit code 0 whatever the count (the cases record what is right, and some
// disagree on purpose until Lantern is mended).
"use strict";
var path = require("path");
var ROOT = path.join(__dirname, "..", "..", "..");
module.paths.unshift(path.join(ROOT, "node_modules"));
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var CASES = require("./cases.js");
var file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src", "lantern.inner.html");
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 200) ? s.slice(0, n || 200) + "..." : s; }
function ascii(s) { return String(s).replace(/[^\x20-\x7e]/g, function (c) { return "\\u" + ("000" + c.charCodeAt(0).toString(16)).slice(-4); }); }

// Chat's lessons for a question, as ASSIST_CHAT gets them: the safety rule first, then each Lantern.chatContext provider
// in its order; the first that gives passages is what the model is given.
async function given(L, q) {
  var g = null;
  try { g = L.ai && L.ai.guard ? L.ai.guard(q) : null; } catch (e) { g = null; }
  if (g) return { first: "(guard)", keys: [], by: "guard:" + g.id };
  var C = L.chatContext || [];
  for (var i = 0; i < C.length; i++) {
    var r = null;
    try { r = await C[i].provide(q, [], { wantsDetail: false }); } catch (e) { r = null; }
    if (r && r.sources && r.sources.length) return { first: r.sources[0].key || "?", keys: r.sources.map(function (s) { return s.key; }), by: C[i].id };
  }
  return { first: "(none)", keys: [], by: "" };
}
// the claim a header makes: {type: "sure"|"likely"|"about"|"may"|"none", shelf}
function claimOf(h) {
  var m;
  if ((m = /This question is on shelf (\d(?:\.\d)?)\b/.exec(h))) return { type: "sure", shelf: m[1] };
  if ((m = /most likely on shelf (\d(?:\.\d)?)\b/.exec(h))) return { type: "likely", shelf: m[1] };
  if ((m = /about Lantern itself \(shelf (\d(?:\.\d)?)\b/.exec(h))) return { type: "about", shelf: m[1] };
  if ((m = /may be on shelf (\d(?:\.\d)?)\b/.exec(h))) return { type: "may", shelf: m[1] };
  return { type: "none", shelf: "" };
}
function shortBody(s, assist) {
  if (assist) return s.split("\n").slice(1).join("\n").replace(/^\s+/, "");
  return s.split("\n").filter(function (l) { return !/^You are\b|^Lantern computes and checks\.$/.test(l); }).join("\n").replace(/^\s+/, "");
}

async function run(L, c) {
  var P = L.aiPrompt, CAT = L.catalog, A = L.assist, seen = "", ok = false;
  if (c.part === "keeps") {
    P.setMode("auto");
    var gv = await given(L, c.input), exp = c.expect;
    var nothing = gv.first === "(none)" || gv.first === "(guard)";
    if (!exp.length) ok = nothing;
    else ok = exp.indexOf(gv.first) >= 0 || (nothing && exp.indexOf("(none)") >= 0 && gv.first === "(none)") || (gv.first === "(guard)" && (exp.indexOf("(guard)") >= 0 || exp.indexOf("(none)") >= 0));
    var bad = (c.never || []).filter(function (k) { return gv.keys.indexOf(k) >= 0; });
    if (bad.length) ok = false;
    seen = (gv.by ? gv.by + ":" : "") + (gv.keys.length ? gv.keys.join(",") : gv.first) + (bad.length ? " (never: " + bad.join(",") + ")" : "");
  } else if (c.part === "open") {
    P.setMode(c.mode || "library");
    var OPEN = (L.chatCommands || []).filter(function (x) { return x && x.id === "open"; })[0];
    var got = OPEN ? OPEN.test(c.input) : "(no OPEN command)";
    var want = Array.isArray(c.expect) ? c.expect : [c.expect];
    ok = want.some(function (w) { return w === got; });
    seen = "read " + JSON.stringify(got);
  } else if (c.part === "header") {
    P.setMode("library");
    var r = CAT.route(c.input), h = CAT.header(r), cl = claimOf(h);
    if (cl.type === "sure" || cl.type === "likely" || cl.type === "about") ok = Array.isArray(c.expect) && c.expect.indexOf(cl.shelf) >= 0;
    else if (cl.type === "may") ok = Array.isArray(c.may) ? c.may.indexOf(cl.shelf) >= 0 : Array.isArray(c.expect) ? c.expect.indexOf(cl.shelf) >= 0 : true;
    else ok = !c.mustClaim;
    seen = cl.type + (cl.shelf ? " " + cl.shelf : "") + " [" + r.kind + " " + r.ev + " " + Math.round((r.pct || 0) * 100) + "%] \"" + short(h, 110) + "\"";
  } else if (c.part === "prompt") {
    var q = c.input.q, ck = c.input.check, pre = CAT.prefix() + "\n\n";
    if (ck === "chat-body" || ck === "assist-body") {
      var asst = ck === "assist-body";
      P.setMode("short");
      var s = asst ? A.buildPrompt(q, A.match(q)) : L.CHAT.buildSystem(q);
      P.setMode("library");
      var lib = asst ? A.buildPrompt(q, A.match(q)) : L.CHAT.buildSystem(q), body = shortBody(s, asst);
      var hd = CAT.header(CAT.route(q)), whole = pre + (hd ? hd + "\n\n" : "") + body;
      ok = lib === whole;
      seen = ok ? "kept" : "library prompt is not start + header + short body (" + lib.length + " vs " + whole.length + " chars)";
    } else if (ck === "assist-offers") {
      P.setMode("library");
      var ap = A.buildPrompt(q, A.match(q)), off = [];
      if (/reply with only one line: OPEN/.test(ap)) off.push("asks for OPEN");
      if (/(lessons|catalog) comes? with the question/.test(ap)) off.push("promises " + (/catalog comes/.test(ap) ? "the catalog" : "lessons"));
      ok = !off.length;
      seen = off.length ? "Assist's prompt " + off.join(" and ") + ": \"" + short(CAT.header(CAT.route(q)), 120) + "\"" : "nothing offered";
    } else if (ck === "consistent") {
      P.setMode("library");
      var h2 = CAT.header(CAT.route(q)), gv2 = await given(L, q);
      var gives = gv2.keys.length > 0, promises = /its lessons come with the question/.test(h2), denies = /no lesson it is sure of/.test(h2);
      ok = !(promises && !gives) && !(denies && gives);
      seen = (promises ? "header promises lessons" : denies ? "header says no lesson" : "header: \"" + short(h2, 80) + "\"") + "; Chat gives " + (gives ? gv2.by + ":" + gv2.keys.join(",") : "nothing");
    } else if (ck === "open-run") {
      P.setMode("library");
      var res = await CAT.open(c.input.shelf, q), first = res && res.sources && res.sources.length ? res.sources[0].key : "(none)";
      ok = c.input.first.indexOf(first) >= 0;
      seen = "OPEN " + c.input.shelf + " sends " + (res && res.sources ? res.sources.map(function (x) { return x.key; }).join(",") : "\"" + short(res && res.prompt, 90) + "\"");
    } else seen = "unknown check " + ck;
  } else seen = "unknown part " + c.part;
  P.setMode("auto");
  return { ok: ok, seen: seen };
}

var o = load(file);
setTimeout(async function () {
  var L = o.L, a = 0, d = 0, bySev = { high: 0, medium: 0, low: 0 };
  if (!L || !L.catalog) { console.log("Lantern has no catalog (LIBRARY_CATALOG) in " + file); }
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i], r;
    try { r = L && L.catalog ? await run(L, c) : { ok: false, seen: "no catalog" }; } catch (e) { r = { ok: false, seen: "threw " + (e && e.message) }; }
    if (r.ok) { a++; console.log("AGREE " + c.id); }
    else { d++; bySev[c.severity] = (bySev[c.severity] || 0) + 1; console.log(ascii("DISAGREE " + c.id + " " + r.seen + " [" + c.severity + "]")); }
  }
  if (o.errs.length) console.log("page errors: " + ascii(o.errs.join(" | ")));
  console.log("(disagree by severity: high " + bySev.high + ", medium " + bySev.medium + ", low " + bySev.low + ")");
  console.log(CASES.length + " cases: " + a + " AGREE, " + d + " DISAGREE");
  process.exit(0);
}, 200);
