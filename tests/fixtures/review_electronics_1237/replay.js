// replay.js -- the review's cases (cases.js), and every saved electronics reply of tests/fixtures/bench_run*.json
// (guard.js; guard_before.json is 22b1c03's result), run against src/lantern.inner.html or argv[2].
//   node tests/fixtures/review_electronics_1237/replay.js [path/to/lantern.inner.html]
// Prints "AGREE <id>" or "DISAGREE <id> <what was seen> [high|medium|low]" per case, then "N cases: A AGREE, D DISAGREE".
// before.json (22b1c03's results for the "same" and "prompt" cases) is written by make_before.js.
"use strict";
var path = require("path"), fs = require("fs");
module.paths.unshift(path.join(__dirname, "..", "..", "..", "node_modules"));
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var CASES = require("./cases.js"), guard = require("./guard.js"), JUDGED = require("./guard_judged.js");
var file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html");
var BEFORE = JSON.parse(fs.readFileSync(path.join(__dirname, "before.json"), "utf8"));
var GBEFORE = JSON.parse(fs.readFileSync(path.join(__dirname, "guard_before.json"), "utf8"));
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 240) ? s.slice(0, n || 240) + "…" : s; }
function text(c, lines) { return "MAKE " + (c.kind || "ELECTRONICS") + ": " + (c.title || "Circuit") + "\n" + (lines || c.lines).join("\n") + "\nEND"; }
function bstr(b) {
  if (b.kind === "load") return b.load.id + "/" + b.load.kind + (b.q ? " q=" + b.q : "") + (b.pin ? " pin=" + b.pin : "") + (b.sw ? " sw=" + b.sw : "") + (b.diode ? " d=" + b.diode.id : "");
  if (b.kind === "cap") return "cap";
  return b.kind + ":" + (b.sw || b.sensor) + (b.pin ? " pin=" + b.pin : "");
}
function branches(m) { return m && m.ok && m.plan && m.plan.circuit ? m.plan.circuit.branches.map(bstr) : null; }
function sameSet(want, got) {
  if (!got || want.length !== got.length) return false;
  var left = got.slice();
  return want.every(function (w) {
    var i = left.findIndex(function (g) { return g === w || (/ d$/.test(w) && g.replace(/ d=\w+$/, " d") === w); });
    if (i < 0) return false;
    left.splice(i, 1); return true;
  });
}
function sig(m) { var c = m && m.plan && m.plan.circuit; return { ok: !!(m && m.ok), problems: m ? (m.problems || []).slice() : null, branches: c && c.branches ? JSON.stringify(c.branches) : null, summary: m && m.summary ? String(m.summary) : "" }; }
function rx(s) { return new RegExp(s); }
module.exports = { sig: sig, text: text };

(async function () {
  var o = load(file), L = o.L;
  await sleep(80);
  var act = L.aiAct, ITEMS = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []);
  function build(c, lines) { return act.build(text(c, lines), c.q); }
  function describe(m) { return !m ? "no block found" : m.ok ? "drawn: " + (branches(m) || []).join(" ; ") : "went back: " + short(m.problems.join(" | "), 400); }
  // checks one result against a case (or a case's `then`), -> [what is wrong]
  function check(c, m) {
    var bad = [];
    if (!m) return ["no block found"];
    if (c.t === "draw") {
      if (!m.ok) return ["went back: " + short(m.problems.join(" | "), 400)];
      if (!sameSet(c.br, branches(m))) bad.push("drawn as " + branches(m).join(" ; ") + " (right: " + c.br.join(" ; ") + ")");
      (c.said || []).forEach(function (s) { if (!rx(s).test(m.summary)) bad.push("summary lacks /" + s + "/"); });
      (c.notSaid || []).forEach(function (s) { if (rx(s).test(m.summary)) bad.push("summary says /" + s + "/"); });
      if (c.extra === "pins33" && !m.plan.circuit.pins.every(function (p) { return p.v === 3.3; })) bad.push("pins not 3.3 V: " + JSON.stringify(m.plan.circuit.pins));
      return bad;
    }
    if (c.t === "back") {
      if (m.ok) return ["drawn: " + branches(m).join(" ; ") + " -- " + short(m.summary, 300)];
      var p = m.problems.join(" | ");
      (c.want || []).forEach(function (s) { if (!rx(s).test(p)) bad.push("lacks /" + s + "/"); });
      (c.mislead || []).forEach(function (s) { if (rx(s).test(p)) bad.push("says /" + s + "/"); });
      if (bad.length) bad.push("sent: " + short(p, 420));
      return bad;
    }
    if (c.t === "either") {
      if (!m.ok) {
        var pe = m.problems.join(" | ");
        (c.want || []).forEach(function (s) { if (!rx(s).test(pe)) bad.push("went back without /" + s + "/"); });
        (c.mislead || []).forEach(function (s) { if (rx(s).test(pe)) bad.push("went back saying /" + s + "/"); });
        if (bad.length) bad.push("sent: " + short(pe, 420));
        return bad;
      }
      return sameSet(c.br, branches(m)) ? [] : ["drawn as " + branches(m).join(" ; ") + " (right: go back, or " + c.br.join(" ; ") + ")"];
    }
    return ["unknown case type " + c.t];
  }
  function copyThen(c, m) {   // the model copies the line(s) handed back: they are added to its reply
    var p = (m.problems || []).join(" | "), add = [];
    for (var i = 0; i < c.then.take.length; i++) {
      var mm = rx(c.then.take[i]).exec(p);
      if (!mm) return { bad: ["no line to copy matching /" + c.then.take[i] + "/ in: " + short(p, 300)] };
      add.push(mm[1]);
    }
    var lines = c.lines.filter(function (l, k) { return (c.then.drop || []).indexOf(k) < 0; }).concat(add), m2 = build(c, lines), t = { t: c.then.t, br: c.then.br, want: c.then.want, mislead: c.then.mislead, said: c.then.said };
    var b2 = check(t, m2);
    return { bad: b2.length ? ["copied “" + add.join(" / ") + "”: " + b2.join("; ")] : [] };
  }
  var out = [], nA = 0, nD = 0;
  function say(id, bad, sev) {
    if (!bad.length) { nA++; out.push("AGREE " + id); }
    else { nD++; out.push("DISAGREE " + id + " " + bad.join("; ") + " [" + (sev || "high") + "]"); }
  }
  CASES.forEach(function (c) {
    var bad = [], m;
    try {
      if (c.t === "same") {
        m = build(c);
        var now = sig(m), was = BEFORE.cases[c.id];
        if (!was) bad.push("no 22b1c03 result in before.json");
        else {
          if (now.ok !== was.ok) bad.push((was.ok ? "drew on 22b1c03, now " : "went back on 22b1c03, now ") + describe(m));
          else if (JSON.stringify(now.problems) !== JSON.stringify(was.problems)) bad.push("went back otherwise: " + short(now.problems.join(" | "), 300) + " (was: " + short(was.problems.join(" | "), 300) + ")");
          else if (now.branches !== was.branches) bad.push("drawn otherwise: " + now.branches + " (was " + was.branches + ")");
          else if (now.summary !== was.summary) bad.push("said otherwise: " + short(now.summary, 300) + " (was " + short(was.summary, 300) + ")");
        }
      } else if (c.t === "grade") {
        var item = ITEMS.filter(function (x) { return x.id === c.item; })[0];
        if (!item) bad.push("no bench item " + c.item);
        else {
          var reply = c.ideal ? item.ideal : text(c);
          m = act.build(reply, c.q || item.q);
          var g = L.aiBench.grade(item, reply, { made: m });
          if (!!g.pass !== !!c.pass) bad.push("graded " + (g.pass ? "pass" : "fail: " + g.why) + " -- " + describe(m));
        }
      } else if (c.t === "fix") {
        m = build(c);
        if (m.ok) bad.push("drawn: " + branches(m).join(" ; "));
        else {
          var ft = act.fixText(m, c.q);
          (c.want || []).forEach(function (s) { if (!rx(s).test(ft)) bad.push("the correction turn lacks /" + s + "/"); });
          (c.mislead || []).forEach(function (s) { if (rx(s).test(ft)) bad.push("the correction turn says /" + s + "/ (" + short(ft.split("\n").filter(function (l) { return rx(s).test(l); })[0], 160) + ")"); });
        }
      } else if (c.t === "prompt") {
        var P = BEFORE.prompts;
        if (c.guide) {
          var E = L.aiElectronics;
          if (JSON.stringify(E.PROMPT) !== JSON.stringify(P.guide.PROMPT)) bad.push("AI_ELECTRONICS.PROMPT changed");
          if (JSON.stringify(E.HINT) !== JSON.stringify(P.guide.HINT)) bad.push("AI_ELECTRONICS.HINT changed");
        } else if (c.all) {
          ITEMS.forEach(function (it) {
            var w = P.all[it.id], q = it.q || "";
            if (!w) { bad.push("no 22b1c03 prompt for " + it.id); return; }
            if (act.prompt(q) !== w.prompt) bad.push(it.id + ": prompt changed");
            if (act.relevant(q).map(function (a) { return a.id; }).join(",") !== w.relevant) bad.push(it.id + ": tools offered changed");
          });
        } else {
          var w2 = P.q[c.id];
          if (act.prompt(c.q) !== w2.prompt) bad.push("prompt changed");
          if (act.relevant(c.q).map(function (a) { return a.id; }).join(",") !== w2.relevant) bad.push("tools offered changed");
        }
      } else {
        m = build(c);
        bad = check(c, m);
        if (!bad.length && c.then) bad = copyThen(c, m).bad;
        if (process.env.VERBOSE) out.push("  " + c.id + ": " + describe(m));
      }
    } catch (e) { bad.push("threw: " + ((e && e.stack) || e).toString().slice(0, 300)); }
    say(c.id, bad, c.sev);
  });

  // ---- the saved replies: as on 22b1c03, apart from the changes judged in guard_judged.js -------------------------------
  var now = await guard(file);
  Object.keys(GBEFORE).filter(function (k) { return GBEFORE[k].anyEl; }).forEach(function (k) {
    var a = GBEFORE[k], b = now[k], id = "guard:" + k;
    if (!b) { say(id, ["not built now"], "high"); return; }
    if (JSON.stringify(a) === JSON.stringify(b)) { say(id, [], ""); return; }
    var j = JUDGED[k];
    if (!j) { say(id, ["differs from 22b1c03 and no judgment: " + short(JSON.stringify(b), 400)], "high"); return; }
    var bb = [];
    try { bb = j.check(a, b) || []; } catch (e) { bb = ["judgment threw: " + e.message]; }
    say(id, bb, j.sev);
  });
  // electronics replies the harvest sees now but did not on 22b1c03 (a block newly read as electronics)
  Object.keys(now).filter(function (k) { return now[k].anyEl && !(GBEFORE[k] && GBEFORE[k].anyEl); }).forEach(function (k) { say("guard:" + k, ["read as electronics now, not on 22b1c03"], "high"); });

  out.forEach(function (l) { console.log(l); });
  console.log((nA + nD) + " cases: " + nA + " AGREE, " + nD + " DISAGREE");
  if (o.errs.length) console.log("page errors: " + o.errs.join(" | "));
})();
