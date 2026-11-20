// replay.js -- the review's cases (cases.js) run against src/lantern.inner.html.
//   node tests/fixtures/liftstation_review1_1230/replay.js [path/to/lantern.inner.html]
// Prints "AGREE <id>" or "DISAGREE <id> <detail> [harm]" per case, then "<n> cases: <a> AGREE, <d> DISAGREE".
// A case says what is right (its own check); AGREE means Lantern did that.
"use strict";
var path = require("path");
var NM = path.join(__dirname, "..", "..", "..", "node_modules");
module.paths.unshift(NM);
var load = require("./load.js"), sim = require("./sim.js"), CASES = require("./cases.js");
var file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html");
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }
function ids(list) { return (list || []).map(function (e) { return e.id + (e.nc ? "/" : ""); }).join(","); }
function rx(s) { return s instanceof RegExp ? s : new RegExp(s); }
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 220) ? s.slice(0, n || 220) + "…" : s; }

(async function () {
  var o = load(file), L = o.L;
  await sleep(80);
  try { await L.ai.detect(); } catch (e) { /* no model needed for most cases */ }
  var act = L.aiAct, PT = L.aiParts, C = L.CHAT;
  var ctx = { L: L, o: o, blk: blk };

  // ---- the checks, by type ----------------------------------------------------------------------
  var T = {};
  // a duplex control block that is right: drawn, verified, and works over the fill/pump-down cycle
  T.duplex = function (c) {
    var m = act.build(blk("CONTROL", c.title || "Duplex", c.lines), c.q || "Draw the control circuit for a duplex lift station with an alternating relay");
    if (!m) return { agree: false, did: "no block found" };
    if (!m.ok || !m.plan || !m.plan.circuit) return { agree: false, did: "refused: " + short(m.problems.join(" | "), 400) };
    var bad = sim.duplex(m.plan.circuit, c.sim);
    (c.said || []).forEach(function (s) { if (!rx(s).test(m.summary)) bad.push("summary lacks /" + s + "/"); });
    (c.notSaid || []).forEach(function (s) { if (rx(s).test(m.summary)) bad.push("summary says /" + s + "/"); });
    if (c.extra) { try { var e = c.extra(m, ctx); if (e) bad.push(e); } catch (er) { bad.push("check failed: " + er.message); } }
    return { agree: !bad.length, did: bad.length ? bad.join("; ") : "drawn and works" };
  };
  // a control block that must go back, with a useful line and nothing that contradicts it
  T.refuse = function (c) {
    var m = act.build(blk(c.kind || "CONTROL", c.title || "Block", c.lines), c.q || "Draw the control circuit for a duplex lift station with an alternating relay");
    if (!m) return { agree: false, did: "no block found" };
    if (m.ok) return { agree: false, did: "drawn without a word: " + short(m.summary, 300) };
    var p = m.problems.join(" | "), bad = [];
    (c.want || []).forEach(function (s) { if (!rx(s).test(p)) bad.push("the reply lacks /" + s + "/"); });
    (c.mislead || []).forEach(function (s) { if (rx(s).test(p)) bad.push("the reply also tells the model /" + s + "/"); });
    return { agree: !bad.length, did: bad.length ? bad.join("; ") + " -- sent: " + short(p, 500) : "went back: " + short(p, 160) };
  };
  // a plain (non-alternator) control block: rungs as the version before 1.24.30 drew them
  T.plain = function (c) {
    var m = act.build(blk("CONTROL", c.title || "Control", c.lines), c.q || "Draw the control circuit");
    if (!m) return { agree: false, did: "no block found" };
    var got = m.ok && m.plan && m.plan.circuit ? m.plan.circuit.rungs.map(function (r) {
      return r.out.id + ":" + r.out.kind + " s[" + ids(r.stops) + "] st[" + ids(r.starts) + "]" + (r.seal ? "+seal" : "") + " se[" + ids(r.series) + "] a[" + ids(r.after) + "]" + (r.branches ? " br" + JSON.stringify(r.branches.map(ids)) : "");
    }).join(" ; ") : "REFUSED " + m.problems.join(" | ");
    var bad = [], norm = function (s) { return String(s).replace(/ \(it draws: [^)]*\)/g, ""); };   // the list of what it draws now has "alternator" in it
    if (norm(got) !== norm(c.before)) bad.push("drawn differently from 1.24.29: " + short(got, 400) + " (was: " + short(c.before, 400) + ")");
    if (c.sim) { var sp = c.sim(m, sim); if (sp) bad.push(sp); }
    return { agree: !bad.length, did: bad.length ? bad.join("; ") : "as before" };
  };
  // which tools a question is offered
  T.relevant = function (c) {
    var got = act.relevant(c.q).map(function (a) { return a.id; }), bad = [];
    (c.want || []).forEach(function (x) { if (got.indexOf(x) < 0) bad.push("not offered " + x); });
    (c.not || []).forEach(function (x) { if (got.indexOf(x) >= 0) bad.push("offered " + x); });
    return { agree: !bad.length, did: (bad.length ? bad.join("; ") + " -- " : "") + "offered: " + (got.join(", ") || "nothing") };
  };
  // the control prompt a question gets
  T.prompt = function (c) {
    var p = act.prompt(c.q), bad = [];
    (c.has || []).forEach(function (s) { if (!rx(s).test(p)) bad.push("lacks /" + s + "/"); });
    (c.not || []).forEach(function (s) { if (rx(s).test(p)) bad.push("has /" + s + "/"); });
    return { agree: !bad.length, did: bad.length ? bad.join("; ") + " -- prompt: " + short(p, 300) : "as it should" };
  };
  // piping: drawn with each pump's check then shutoff valve, nothing written lost
  T.piping = function (c) {
    var m = act.build(blk("PIPING", c.title || "Lift station", c.lines), c.q || "Draw the piping for a 2 pump lift station");
    if (!m) return { agree: false, did: "no block found" };
    if (c.refuse) {
      if (m.ok) return { agree: false, did: "drawn: " + short(m.summary, 300) };
      var p = m.problems.join(" | "), bb = [];
      (c.want || []).forEach(function (s) { if (!rx(s).test(p)) bb.push("the reply lacks /" + s + "/"); });
      (c.mislead || []).forEach(function (s) { if (rx(s).test(p)) bb.push("the reply tells the model /" + s + "/"); });
      return { agree: !bb.length, did: bb.length ? bb.join("; ") + " -- sent: " + short(p, 300) : "went back: " + short(p, 160) };
    }
    if (!m.ok || !m.plan) return { agree: false, did: "refused: " + short(m.problems.join(" | "), 400) };
    var bad = [], pl = m.plan;
    if (c.pumps) {
      var got = pl.pumps.map(function (x) { return [x.id, x.check, x.valve, x.valveKind].join(" "); }).join("; ");
      if (got !== c.pumps) bad.push("pumps " + got + " (want " + c.pumps + ")");
    }
    if (pl.order.join(">") !== "pump>check>shutoff>header") bad.push("order " + pl.order.join(">"));
    // on the drawing: each pump's check valve before its shutoff valve, the check pointing to the header
    var S = m.shapes || [];
    pl.pumps.forEach(function (x) {
      var cl = S.filter(function (s) { return s.t === "text" && s.s === x.check; })[0], vl = S.filter(function (s) { return s.t === "text" && String(s.s).split(" ")[0] === x.valve; })[0];
      if (!cl || !vl) { bad.push("no label for " + x.check + " or " + x.valve); return; }
      if (Math.abs(cl.y - vl.y) > 1 || !(cl.x < vl.x)) bad.push(x.id + ": the check valve is not before the shutoff valve on the drawing");
      var tri = S.filter(function (s) { return s.t === "tri" && s.f && Math.abs(s.pts[2][1] - (cl.y + 19)) < 1 && Math.abs(s.pts[2][0] - (cl.x + 7)) < 1; })[0];
      if (!tri || !(tri.pts[2][0] > tri.pts[0][0])) bad.push(x.id + ": the check valve does not point to the header");
    });
    (c.said || []).forEach(function (s) { if (!rx(s).test(m.summary)) bad.push("summary lacks /" + s + "/"); });
    (c.notSaid || []).forEach(function (s) { if (rx(s).test(m.summary)) bad.push("summary says /" + s + "/"); });
    if (c.extra) { var e = c.extra(m, ctx); if (e) bad.push(e); }
    return { agree: !bad.length, did: bad.length ? bad.join("; ") : "drawn right" };
  };
  // levels: the floats at their heights, the drawing's order matching, the notes
  T.levels = function (c) {
    var m = act.build(blk("LEVELS", c.title || "Wet well", c.lines), c.q || "Draw the float levels in the wet well");
    if (!m) return { agree: false, did: "no block found" };
    if (c.refuse) {
      if (m.ok) return { agree: false, did: "drawn: " + short(m.summary, 300) };
      var p = m.problems.join(" | "), bb = [];
      (c.want || []).forEach(function (s) { if (!rx(s).test(p)) bb.push("the reply lacks /" + s + "/"); });
      (c.mislead || []).forEach(function (s) { if (rx(s).test(p)) bb.push("the reply tells the model /" + s + "/"); });
      return { agree: !bb.length, did: bb.length ? bb.join("; ") + " -- sent: " + short(p, 300) : "went back: " + short(p, 160) };
    }
    if (!m.ok || !m.plan) return { agree: false, did: "refused: " + short(m.problems.join(" | "), 400) };
    var bad = [], pl = m.plan;
    if (c.floats) {
      var got = pl.floats.map(function (f) { return f.id + " " + f.job + (c.metres ? " " + (f.m == null ? "-" : Math.round(f.m * 1000)) : ""); }).join("; ");
      if (got !== c.floats) bad.push("floats " + got + " (want " + c.floats + ")");
    }
    if (c.scaled != null && pl.scaled !== c.scaled) bad.push("scaled " + pl.scaled + " (want " + c.scaled + ")");
    // the drawing: each float's label higher on the page the higher it is
    var S = m.shapes || [], ys = pl.floats.map(function (f) { var t = S.filter(function (s) { return s.t === "text" && String(s.s).indexOf(f.id + "  ") === 0; })[0]; return t ? t.y : null; });
    for (var i = 1; i < ys.length; i++) if (ys[i] == null || ys[i - 1] == null || !(ys[i] < ys[i - 1])) bad.push("on the drawing " + pl.floats[i].id + " is not above " + pl.floats[i - 1].id);
      else if (ys[i - 1] - ys[i] < 11) bad.push("the labels of " + pl.floats[i - 1].id + " and " + pl.floats[i].id + " overlap (" + Math.round(ys[i - 1] - ys[i]) + " px apart, 12 px text)");
    if (pl.scaled && ys.length >= 3 && ys.every(function (y) { return y != null; })) {   // to scale: the gaps in proportion
      var h = pl.floats.map(function (f) { return f.m; }), k = (ys[0] - ys[ys.length - 1]) / (h[h.length - 1] - h[0]);
      for (var j = 1; j < ys.length; j++) if (Math.abs((ys[j - 1] - ys[j]) - k * (h[j] - h[j - 1])) > 2) bad.push("the gap below " + pl.floats[j].id + " is not to scale");
    }
    (c.said || []).forEach(function (s) { if (!rx(s).test(m.summary)) bad.push("summary lacks /" + s + "/"); });
    (c.notSaid || []).forEach(function (s) { if (rx(s).test(m.summary)) bad.push("summary says /" + s + "/"); });
    if (c.extra) { var e = c.extra(m, ctx); if (e) bad.push(e); }
    return { agree: !bad.length, did: bad.length ? bad.join("; ") : "drawn right" };
  };
  // the parts of a question
  T.split = function (c) {
    var s = PT.split(c.q);
    var got = s ? s.map(function (p) { return p.kind; }).join(",") : "";
    if (!c.kinds) return { agree: !s, did: s ? "split into " + s.map(function (p) { return p.kind + " “" + p.text + "”"; }).join(" + ") : "one part" };
    var bad = [];
    if (got !== c.kinds) bad.push("parts " + (got || "none") + (s ? " (" + s.map(function (p) { return "“" + p.text + "”"; }).join(" + ") + ")" : "") + ", want " + c.kinds);
    if (s && c.texts) c.texts.forEach(function (t, i) { if (t && s[i] && !rx(t).test(s[i].text)) bad.push("part " + (i + 1) + " text “" + s[i].text + "” lacks /" + t + "/"); });
    return { agree: !bad.length, did: bad.length ? bad.join("; ") : "parts " + got };
  };
  // the whole bench sets: none split
  T.benchGuard = function (c) {
    var qs = L[c.set] || [], hit = qs.filter(function (q) { return PT.split(q.q); });
    return { agree: qs.length > 0 && !hit.length, did: qs.length ? (hit.length ? hit.length + " split: " + hit.slice(0, 4).map(function (q) { return q.id; }).join(", ") : qs.length + " questions, none split") : "no bench set " + c.set };
  };
  // aiNoBlock for a reply in prose
  T.noblock = function (c) {
    var nb = L.aiNoBlock(c.q, c.reply), bad = [];
    if (!nb) return { agree: !c.has, did: "nothing asked" };
    (c.has || []).forEach(function (s) { if (!rx(s).test(nb.prompt)) bad.push("lacks /" + s + "/"); });
    (c.not || []).forEach(function (s) { if (rx(s).test(nb.prompt)) bad.push("has /" + s + "/"); });
    return { agree: !bad.length, did: bad.length ? bad.join("; ") + " -- " + short(nb.prompt, 300) : "asked: " + short(nb.prompt, 120) };
  };
  // a Chat turn with scripted replies: what is made, and what is sent
  T.chat = async function (c) {
    var sent = [], replies = c.replies;
    o.script = function (last) { sent.push(last); var r = replies[Math.min(sent.length - 1, replies.length - 1)]; return typeof r === "function" ? r(last, sent.length) : r; };
    var r;
    try { r = await C.turn([], c.q, {}, {}); } catch (e) { o.script = null; return { agree: false, did: "the turn threw " + e.message }; }
    o.script = null;
    var made = (r.mades || (r.made ? [r.made] : [])).map(function (m) { return m.block.kind + (m.ok ? "" : "!"); }).join(",");
    var bad = [];
    if (c.made != null && made !== c.made) bad.push("made " + (made || "nothing") + ", want " + c.made);
    if (c.calls != null && sent.length !== c.calls) bad.push(sent.length + " calls, want " + c.calls);
    (c.sent || []).forEach(function (x) { var t = sent[x[0]]; if (!t || !rx(x[1]).test(t)) bad.push("message " + (x[0] + 1) + " lacks /" + x[1] + "/" + (t ? ": " + short(t, 200) : " (not sent)")); });
    (c.notSent || []).forEach(function (x) { var t = sent[x[0]]; if (t && rx(x[1]).test(t)) bad.push("message " + (x[0] + 1) + " has /" + x[1] + "/: " + short(t, 200)); });
    if (c.extra) { var e = c.extra(r, sent, ctx); if (e) bad.push(e); }
    return { agree: !bad.length, did: bad.length ? bad.join("; ") : "made " + made + " in " + sent.length + " calls" };
  };
  // the bench's path
  T.solve = async function (c) {
    var sent = [], i = 0;
    var out = await act.solve(c.q, function (msgs) { sent.push(o.textOf(msgs[msgs.length - 1].content)); var r = c.replies[Math.min(i++, c.replies.length - 1)]; return Promise.resolve(r); });
    var parts = (out.parts || []).map(function (p) { return p.kind + (p.ok ? "" : "!"); }).join(",");
    var bad = [];
    if (c.parts != null && parts !== c.parts) bad.push("parts " + (parts || "none") + ", want " + c.parts);
    if (c.first != null && !(out.made && out.made.block && out.made.block.kind === c.first)) bad.push("out.made is " + (out.made && out.made.block ? out.made.block.kind : "none") + ", want " + c.first);
    if (c.rounds != null && out.rounds !== c.rounds) bad.push(out.rounds + " rounds, want " + c.rounds);
    (c.sent || []).forEach(function (x) { var t = sent[x[0]]; if (!t || !rx(x[1]).test(t)) bad.push("message " + (x[0] + 1) + " lacks /" + x[1] + "/" + (t ? ": " + short(t, 200) : " (not sent)")); });
    return { agree: !bad.length, did: bad.length ? bad.join("; ") : "parts " + parts + " in " + out.rounds + " rounds" };
  };
  // a standard Lantern cites: Lantern still says it, and what the source says (quoted in the case) agrees
  T.standard = function (c) {
    var text = c.lantern(ctx);
    var says = rx(c.says).test(text);
    if (!says) return { agree: false, did: "Lantern no longer says /" + c.says + "/" };
    return { agree: c.verdict === "confirmed", did: c.verdict + ": " + c.note };
  };

  var a = 0, d = 0;
  for (var k = 0; k < CASES.length; k++) {
    var c = CASES[k], r;
    try { r = await T[c.type](c); } catch (e) { r = { agree: false, did: "the check threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e) }; }
    if (r.agree) { a++; console.log("AGREE " + c.id); }
    else { d++; console.log("DISAGREE " + c.id + " " + short(r.did, 700) + " [" + (c.harm || "?") + "]"); }
  }
  console.log(CASES.length + " cases: " + a + " AGREE, " + d + " DISAGREE");
  process.exit(0);
})();
