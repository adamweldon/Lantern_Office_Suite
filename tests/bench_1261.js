// bench_1261.js -- Adam's fourth run of set B, replayed (CLAUDE.md: a bench run's failed rows go in tests/fixtures and
// tests replay them), and what 1.24.21 changed for it.
//
// Adam ran the 35B on set B of 1.24.20 with the library on his laptop (2026-11-16, 13:58 UTC, 92 minutes): 136 of 140
// (130 on 1.24.18, 129 on 1.24.17, 122 on 1.24.16). bench_run_1261_35b_setb.json: the 6 rows that did not pass (two
// puzzles tried without Lantern's tools, not scored) as the model wrote them, and every row that passed. Read:
//  - photosynthesis: the lines right this time, =REVERSE("photosynthesis"), =REMOVE(ANS1,"s"), =LEN(ANS2), and the
//    sentence's word typed from memory -- "noituciohp" for "iehtnyotohp" -- which Lantern left, putting in only its 11.
//    Adam: "appears to be correct but is marked as failed": the count was right, the letters were not. Lantern's.
//  - the float switches (1.24.16, 1.24.17 and here): the low float's start checked first, so while it is on the high
//    float cannot stop the pump -- Adam: "would take the first true statement ... is the reason this keeps failing".
//    Lantern ran nothing for it: its start/stop runs knew buttons, not floats.
//  - the A minor tune: F# over Dm, asked about with "change the chord, or change the note" and no line, and sent back
//    the same, where bar 2's question, which gave the chords line, was taken word for word.
//  - the path across a field (four runs, word for word): the field drawn as half a band, "tri 0 6 20 6 20 12 fill
//    green", so Lantern found no ground, and none of what it does for a landscape (the path) could be done.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function fx(n) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", n), "utf8")); }
var F = fx("bench_run_1261_35b_setb.json"), F3 = fx("bench_run_1258_35b_setb.json"), F2 = fx("bench_run_1257_35b_setb.json"), F1 = fx("bench_run_1256_35b_setb.json");
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("no network")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  w.eval(JS);
  var ev = w.document.createEvent("Event"); ev.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(ev);
  await sleep(400);
  var L = w.Lantern, QB = L.aiBenchQuestionsB, C = L.CHAT, A = L.assist, RC = L.aiResultChecks;
  function item(id) { return QB.filter(function (x) { return x.id === id; })[0]; }
  function row(id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  function rowIn(G, id) { return G.rows.concat(G.passed).filter(function (r) { return r.id === id; })[0]; }
  function fake(replies) { var i = 0, seen = []; var f = function (m) { seen.push(m); return Promise.resolve(replies[Math.min(i++, replies.length - 1)]); }; f.seen = seen; return f; }
  function block(reply, kind) { var m = new RegExp("MAKE " + kind + ":[^\\n]*\\n([\\s\\S]*?)\\nEND").exec(reply); return m ? m[1] : null; }
  ok("boot clean; Adam's fourth run of set B: 136 of 140 on 1.24.20, 6 rows that did not pass",
    errs.length === 0 && F.set === "b" && F.lantern === "1.24.20" && F.summary.pass === 136 && F.summary.n === 140 && F.rows.length === 6, [errs, F.summary.pass]);

  // --- photosynthesis: the chain's last word typed from memory ------------------------------------------------------
  var ph = row("letters-photosynthesis-b"), pp = A.parseReply(ph.reply), pr = A.run(pp.exprText);
  ok("as run: the lines right (=REVERSE, =REMOVE(ANS1,“s”), =LEN(ANS2) = 11), the sentence “noituciohp”, and only 10 -> 11 put in",
    pr.steps[1].value === "iehtnyotohp" && pr.steps[2].value === 11 && /noituciohp/.test(ph.answer) && ph.chat[0].repaired.join() === "10 -> 11");
  var chk = RC.check(ph.q, pp.exprText, pr, { parsed: pp });
  ok("now the word is questioned, with Lantern's word and the placeholder to write", /the ANSWER spells “noituciohp”, but Lantern worked out “iehtnyotohp” \(line 2\): put \{ANS2\}/.test(chk || ""), chk);
  var cp = await C.converse([ph.q], { call: fake([ph.reply, ph.reply]), max_tokens: 1536 }), cpt = (cp.turns || cp)[0] || {};
  ok("...and when the AI sends it back the same, Lantern puts its word in, and its count, and says so",
    /["“]iehtnyotohp["”], which has 11 letters/.test(cpt.answerText || "") && (cpt.repaired || []).join() === "noituciohp -> iehtnyotohp,10 -> 11", [cpt.answerText, cpt.repaired]);
  var right = ph.reply.replace("\"noituciohp\", which has 10", "\"iehtnyotohp\", which has 11"), pr2 = A.parseReply(right);
  ok("the same reply with the right word and count: nothing asked", RC.check(ph.q, pr2.exprText, A.run(pr2.exprText), { parsed: pr2 }) === null);
  var alone = row("letters-photosynthesis-b-alone");
  ok("the run without Lantern's tools: its own lines typed the word, and that is the model alone (not scored)", alone && /REMOVE\("noitisysohtop"/.test(alone.reply));
  var keep = [
    ["Spell \"photosynthesis\" backwards.", "=REVERSE(\"photosynthesis\")\nANSWER: Backwards it is \"sisehtnysotohp\"."],
    ["Spell \"photosynthesis\" backwards, then remove every s.", "=REVERSE(\"photosynthesis\")\n=REMOVE(ANS1,\"s\")\nANSWER: Backwards it is {ANS1}; without the s it is {ANS2}."],
    ["Reverse \"planet\", then make it upper case.", "=REVERSE(\"planet\")\n=UPPER(ANS1)\nANSWER: Reversed it is \"tenalp\", and in capitals \"TENALP\"."],
    ["What is \"stressed\" backwards?", "=REVERSE(\"stressed\")\nANSWER: \"stressed\" backwards is \"desserts\"."]];
  ok("right sentences are left alone: the word itself, its {ANSn}, the question's own word, another word said beside the result",
    keep.every(function (k) { var p0 = A.parseReply(k[1]), r0 = A.run(p0.exprText), c0 = RC.check(k[0], p0.exprText, r0, { parsed: p0 }); return !/the ANSWER spells/.test(c0 || ""); }),
    keep.map(function (k) { var p0 = A.parseReply(k[1]); return RC.check(k[0], p0.exprText, A.run(p0.exprText), { parsed: p0 }); }));

  // --- the float switches ------------------------------------------------------------------------------------------
  var fr = row("code-b-p1am-floats"), fw = L.codeScan.floatWiring(fr.q);
  ok("the question read: the low float switch on input 1 starts, the high float switch on input 2 stops, slot 1, the pump on output 1",
    fw && fw.start.ch === 1 && fw.stop.ch === 2 && fw.inSlot === 1 && fw.out && fw.out.ch === 1 && fw.machine === "pump", fw);
  function build(reply, q) { var b = block(reply, "CODE"); return b ? L.aiCode.build({ title: "T", raw: b.split("\n") }, { question: q }) : null; }
  var fb = build(fr.reply, fr.q);
  ok("as run: “if (lowFloat) pumpRunning = true; else if (highFloat) pumpRunning = false;” -- now sent back: the high float cannot stop the pump while the low float is on, with the line to write",
    fb.problems.length === 1 && /^Start wins over Stop/.test(fb.problems[0]) && /Write: if \(highFloat\) pumpRunning = false; on the line before P1\.writeDiscrete\(pumpRunning, outSlot, pumpPin\);$/.test(fb.problems[0]), fb.problems);
  var fixedF = fr.reply.replace("  // Write output: Turn pump contactor ON or OFF.", "  if (highFloat) pumpRunning = false;\n  // Write output: Turn pump contactor ON or OFF.");
  var fb2 = build(fixedF, fr.q), ideal = build(item("code-b-p1am-floats").ideal, fr.q);
  ok("...with the line written in, nothing is asked and the bench passes it; the bench's own right sketch is not asked about",
    fb2.problems.length === 0 && item("code-b-p1am-floats").check({ text: fixedF, code: fixedF, lang: "arduino" }) === "" && ideal.problems.length === 0, [fb2.problems, ideal.problems]);
  var before = [F1, F2, F3].map(function (G) { var r = rowIn(G, "code-b-p1am-floats"); var b = build(r.reply, r.q); return [r.pass, b ? b.problems.length : -1]; });
  ok("the same row on 1.24.16 and 1.24.17 (failed: asked now) and on 1.24.18 (passed: not asked)", JSON.stringify(before) === "[[false,1],[false,1],[true,0]]", before);

  // --- the A minor tune ----------------------------------------------------------------------------------------------
  var mr = row("make-music-minor-b");
  function song(reply) { var b = block(reply, "MUSIC"); return L.aiAct.build("MAKE MUSIC: Calm A Minor\n" + b + "\nEND", mr.q); }
  var s1 = song(mr.first), s2 = song(mr.reply);
  ok("as run: bar 2 asked with the chords line to write (taken word for word), bar 5's F# over Dm with none (sent back the same)",
    /chords Am \| Am \| E7/.test(mr.rejected) && /bar 5: the melody holds F# over Dm/.test(mr.why) && /change the chord, or change the note$/.test(mr.why));
  ok("now bar 5 is asked with the bar written out: F for F# (Dm has F)",
    s2.problems.length === 1 && /bar 5: the melody holds F# over Dm \(D F A\), a half step from a note of the chord: write F there \(Dm has F\) -- bar 5 of the melody as F - G A -- or change the chord/.test(s2.problems[0]) &&
    s1.problems.length === 2 && /write Am or E there/.test(s1.problems[0]), [s1.problems, s2.problems]);
  ok("...and with that line written, nothing is asked", song(mr.reply.replace("| F# - G A | E - G A | F# - G A | E - - - r", "| F - G A | E - G A | F# - G A | E - - - r")).problems.length === 0);

  // --- the path across a field ---------------------------------------------------------------------------------------
  var pf = row("make-path-field-b"), pb1 = L.aiAct.build(pf.first, pf.q), body2 = block(pf.reply, "DRAWING");
  var pb2 = L.aiAct.build("MAKE DRAWING: Path to the horizon\n" + body2 + "\nEND", pf.q);
  var same = [F1, F2].every(function (G) { return block(rowIn(G, "make-path-field-b").reply, "DRAWING") === body2; }) && rowIn(F3, "make-path-field-b").reply.indexOf(body2.split("\n").slice(0, 6).join("\n")) >= 0;
  ok("four runs: the same picture (1.24.16, 1.24.17 and here word for word; 1.24.18 the same six lines, then a run), the field as \u201ctri 0 6 20 6 20 12 fill green\u201d", same && /tri 0 6 20 6 20 12 fill green/.test(body2));
  ok("now the run-away question also asks, of what is left, for the ground as one band and for the path, with the lines",
    pb1.problems.length === 1 && /^the reply ran away/.test(pb1.problems[0]) && /In what is left, the ground is drawn as a triangle: .* write rect 0 6 20 6 fill green in its place\. Then the question asks for a path going into the distance.*add tri 7 12 13 12 10 6 fill gray after the ground/.test(pb1.problems[0]), pb1.problems);
  ok("...and so does the picture sent back without the run", pb2.problems.length === 1 && /^the ground is drawn as a triangle/.test(pb2.problems[0]), pb2.problems);
  var both = body2.replace("tri 0 6 20 6 20 12 fill green", "rect 0 6 20 6 fill green") + "\ntri 7 12 13 12 10 6 fill gray", pb3 = L.aiAct.build("MAKE DRAWING: Path to the horizon\n" + both + "\nEND", pf.q);
  ok("...with both lines written, nothing is asked and the bench passes the picture", pb3.problems.length === 0 && item("make-path-field-b").check(pb3.plan, pb3) === "", [pb3.problems, item("make-path-field-b").check(pb3.plan, pb3)]);

  // --- a guard: every row that passed in the four runs, through the new rules -----------------------------------------
  var bad = [];
  [F, F3, F2, F1].forEach(function (G) {
    G.passed.forEach(function (r) {
      var t = String(r.reply || ""), p0 = A.parseReply(t);
      if (p0.exprText && p0.answer) { var c0 = RC.check(r.q, p0.exprText, A.run(p0.exprText), { parsed: p0 }) || ""; if (/the ANSWER spells/.test(c0) && RC.madeWord(p0.answer, A.run(p0.exprText).steps, String(r.q).toLowerCase(), p0.exprText.toLowerCase())) bad.push([G.lantern, r.id, c0]); }
      var cb = block(t, "CODE");
      if (cb) { var b = L.aiCode.build({ title: "T", raw: cb.split("\n") }, { question: r.q }); if (b.problems.some(function (x) { return /^Start wins over Stop: the question says to stop/.test(x); })) bad.push([G.lantern, r.id, b.problems]); }
      var db = block(t, "DRAWING");
      if (db) { var d = L.aiAct.build("MAKE DRAWING: x\n" + db + "\nEND", r.q); if (d.problems.some(function (x) { return /the ground is drawn as a triangle/.test(x); })) bad.push([G.lantern, r.id, d.problems]); }
      var sb = block(t, "MUSIC");
      if (sb) { var s = L.aiAct.build("MAKE MUSIC: x\n" + sb + "\nEND", r.q); if (s.problems.some(function (x) { return /-- bar \d+ of the melody as .* -- or change the chord/.test(x); })) bad.push([G.lantern, r.id, s.problems]); }
    });
  });
  ok("the rows that passed in the four runs (" + [F, F3, F2, F1].reduce(function (n, G) { return n + G.passed.length; }, 0) + "): none of the new questions asked of any", !bad.length, bad);

  console.log(fails ? fails + " BENCH 1.24.21 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.21 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
