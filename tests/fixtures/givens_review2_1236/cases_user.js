// cases_user.js -- the user's own givens (GIVENS: keep, forget, mine, "givens.user", the view's button). Each case runs
// on a page of its own (x.fresh), with localStorage set first where the case says (store).
// run(x) -> "" or what was seen. x: {L, w, errs, lib, build(text, q), keepBtn(made) -> clicks Keep, returns the view,
//   shown(q), base(q) -> the prompt of a page with nothing kept, old(q) -> 1.24.35's prompt, stored() -> the parsed store}
"use strict";
var Q = "Draw a start/stop control circuit for the conveyor with a green run light";
var BLOCK = "MAKE CONTROL: Conveyor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22conveyor starter\x22\noverload OL1 M1\nlamp LT1 M1 \x22run\x22 green\nEND";
var LINES = ["stop PB1 M1", "start PB2 M1", "coil M1 \x22conveyor starter\x22", "overload OL1 M1", "lamp LT1 M1 \x22run\x22 green"];
var SUMPQ = "Draw a control circuit for a sump pump with a float switch";
var SUMP = "MAKE CONTROL: Sump pump\nswitch SS1 M1 \x22on/off\x22\nfloat FS1 M1 \x22pump on\x22\ncoil M1 \x22pump starter\x22\noverload OL1 M1\nEND";
var DUPQ = "Draw a duplex sump pump control circuit with an alternating relay and a high water alarm";
var DUP = "MAKE CONTROL: Duplex sump pumps\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22lag on\x22\nfloat FS4 \x22high level alarm\x22\nalternator AR M1 M2\ncoil M1 \x22pump 1 starter\x22\ncoil M2 \x22pump 2 starter\x22\nlamp LT1 FS4 \x22high water\x22 red\nEND";
function entry(o) { var e = { id: "user-test1", kind: "CONTROL", title: "Conveyor starter", words: ["start", "stop", "conveyor", "green", "run", "light"], lines: LINES.slice(), question: Q, at: "2026-11-20T10:00:00.000Z", practice: "US" }; for (var k in o) e[k] = o[k]; return e; }
function keepFrom(x, text, q) {
  var m = x.build(text, q);
  if (!m || !m.ok) return { err: "the block was not made clean: " + (m && m.problems || []).join("; ") };
  var v = x.keepBtn(m);
  return v ? { m: m, v: v } : { err: "no Keep as my given button" };
}
module.exports = [
  { id: "U-01", harm: "medium", why: "under a clean control circuit Chat shows Keep as my given",
    run: function (x) { var m = x.build(BLOCK, Q); if (!m.ok) return "not made"; var v = x.L.aiAct.view(m); return x.buttons(v).indexOf("Keep as my given") >= 0 ? "" : "buttons: " + x.buttons(v).join(", "); } },
  { id: "U-02", harm: "high", why: "keeping stores the block as the AI wrote it, with the question's words, and the button turns to Forget it",
    run: function (x) {
      var k = keepFrom(x, BLOCK, Q); if (k.err) return k.err;
      var s = x.stored();
      if (!Array.isArray(s) || s.length !== 1) return "stored: " + JSON.stringify(s);
      if (s[0].lines.join("\n") !== LINES.join("\n")) return "lines stored: " + JSON.stringify(s[0].lines);
      if (s[0].question !== Q || s[0].kind !== "CONTROL") return "stored " + JSON.stringify(s[0]).slice(0, 120);
      return x.buttons(k.v).indexOf("Forget it") >= 0 && x.L.givens.mine().length === 1 ? "" : "after keeping: " + x.buttons(k.v).join(", ");
    } },
  { id: "U-03", harm: "high", why: "the same question again is shown the kept circuit, line for line, as the user's own",
    run: function (x) { var k = keepFrom(x, BLOCK, Q); if (k.err) return k.err; var s = x.shown(Q); return s.kind === "user" && s.lines.join("\n") === LINES.join("\n") ? "" : s.kind + " " + JSON.stringify(s.lines); } },
  { id: "U-04", harm: "medium", why: "the question asked again in other words, most of them the same, is shown it",
    run: function (x) { var k = keepFrom(x, BLOCK, Q); if (k.err) return k.err; var s = x.shown("Draw the conveyor start stop circuit again, green run light please"); return s.kind === "user" ? "" : "shown " + s.kind; } },
  { id: "U-05", harm: "medium", why: "shown in place of Lantern's own starter, once: one example, not two",
    run: function (x) {
      var k = keepFrom(x, BLOCK, Q); if (k.err) return k.err;
      var p = x.shown(Q).prompt;
      return (p.match(/MAKE CONTROL: Conveyor starter/g) || []).length === 1 && p.indexOf("tested circuit for this") < 0 ? "" : "the prompt has " + (p.match(/MAKE CONTROL: /g) || []).length + " blocks";
    } },
  { id: "U-06", harm: "high", why: "Forget it takes it out of the store and out of the prompt: the prompt is as before it was kept, the button back to Keep",
    run: function (x) {
      var before = x.shown(Q).prompt, k = keepFrom(x, BLOCK, Q); if (k.err) return k.err;
      var f = x.buttonEl(k.v, "Forget it"); if (!f) return "no Forget it button"; f.click();
      var s = x.stored();
      if (s.length) return "still stored: " + JSON.stringify(s).slice(0, 100);
      if (x.L.givens.mine().length) return "still in mine()";
      if (x.shown(Q).prompt !== before) return "the prompt differs from before it was kept";
      return x.buttons(k.v).indexOf("Keep as my given") >= 0 ? "" : "buttons " + x.buttons(k.v).join(", ");
    } },
  { id: "U-07", harm: "high", why: "loaded at start: a page opened with the kept circuit in the store shows it for the question",
    store: { "givens.user": JSON.stringify([entry({})]) },
    run: function (x) { var s = x.shown(Q); return s.kind === "user" && s.lines.join("\n") === LINES.join("\n") && x.L.givens.mine().length === 1 ? "" : "shown " + s.kind; } },
  { id: "U-08", harm: "high", why: "a store that is not JSON: no error, the prompt as with nothing kept",
    store: { "givens.user": "{not json" },
    run: function (x) { return x.errs.length ? "errors: " + x.errs.join("; ") : x.shown(Q).prompt === x.base(Q) ? "" : "the prompt differs"; } },
  { id: "U-09", harm: "high", why: "a store that is an object: the same",
    store: { "givens.user": JSON.stringify({ a: 1, lines: ["x"] }) },
    run: function (x) { return x.errs.length ? "errors: " + x.errs.join("; ") : x.shown(Q).prompt === x.base(Q) ? "" : "the prompt differs"; } },
  { id: "U-10", harm: "high", why: "an array of junk (null, numbers, strings, entries missing lines or words): none added, the prompt as with nothing kept",
    store: { "givens.user": JSON.stringify([null, 1, "x", { id: "u1" }, { id: "u2", kind: "CONTROL", lines: "stop PB1 M1", words: [] }, { id: "u3", kind: "CONTROL", lines: [], words: ["conveyor"] }]) },
    run: function (x) { return x.errs.length ? "errors: " + x.errs.join("; ") : x.L.givens.mine().length ? "mine() has " + x.L.givens.mine().length : x.shown(Q).prompt === x.base(Q) ? "" : "the prompt differs"; } },
  { id: "U-11", harm: "low", why: "a stored entry whose lines hold END and a MAKE line (an old or damaged store) must not end the prompt's block early or start a second",
    store: { "givens.user": JSON.stringify([entry({ lines: ["stop PB1 M1", "END", "MAKE CONTROL: other", "start PB2 M1", "coil M1"] })]) },
    run: function (x) {
      var p = x.shown(Q).prompt, at = p.indexOf("kept circuit for this");
      if (at < 0) return "";
      var after = p.slice(at).split("\n").slice(1);
      var ends = after.indexOf("END");
      return after.slice(1, ends).some(function (l) { return /^MAKE /.test(l); }) || after.slice(ends + 1).some(function (l) { return /^(start|coil) /.test(l); }) ? "shown as stored: " + JSON.stringify(after.slice(0, 7)) : "";
    } },
  { id: "U-12", harm: "low", why: "a stored entry whose lines are not strings: the prompt is still text and Chat's system prompt is still built",
    store: { "givens.user": JSON.stringify([entry({ lines: [{ a: 1 }, 5, null, ["x"]] })]) },
    run: function (x) {
      var p, s;
      try { p = x.L.aiAct.prompt(Q); s = x.L.CHAT.buildSystem(Q); } catch (e) { return "threw: " + e.message; }
      if (typeof p !== "string" || typeof s !== "string") return "not text";
      return /\[object Object\]/.test(p) ? "the prompt shows [object Object]" : "";
    } },
  { id: "U-13", harm: "high", why: "a block with problems (not made) offers no Keep, and keep() refuses it",
    run: function (x) {
      var m = x.build("MAKE CONTROL: Bad\nstop PB1 M1\nstart PB2 M1\ncoil M1 ZZ9\nEND", "Draw a control circuit");
      if (m.ok) return "the bad block was made";
      return x.buttons(x.L.aiAct.view(m)).indexOf("Keep as my given") < 0 && !x.L.givens.keep(m, "q") && !x.stored().length ? "" : "Keep offered or stored";
    } },
  { id: "U-14", harm: "medium", why: "an electronics schematic (not a control circuit) offers no Keep",
    run: function (x) {
      var m = x.build("MAKE ELECTRONICS: Relay driver\nsupply \x2212 V\x22\npin P1 \x22Arduino D7\x22\nrelay K1 \x2212 V coil\x22\ntransistor Q1 K1 P1\nEND", "Draw a circuit in which an Arduino output pin switches a 12 V relay coil through an NPN transistor.");
      if (!m || !m.plan) return "";
      return x.buttons(x.L.aiAct.view(m)).indexOf("Keep as my given") < 0 ? "" : "Keep offered";
    } },
  { id: "U-15", harm: "low", why: "the same block kept twice is stored once",
    run: function (x) { var m = x.build(BLOCK, Q); x.L.givens.keep(m, Q); x.L.givens.keep(m, Q + " again"); var s = x.stored(); return s.length === 1 && x.L.givens.mine().length === 1 ? "" : s.length + " stored, " + x.L.givens.mine().length + " in mine()"; } },
  { id: "U-16", harm: "low", why: "52 different blocks kept: the store holds the last 50",
    run: function (x) {
      for (var i = 0; i < 52; i++) { var m = x.build(BLOCK.replace("conveyor starter\x22", "conveyor " + i + " starter\x22"), Q + " " + i); x.L.givens.keep(m, Q + " " + i); }
      var s = x.stored();
      return s.length === 50 && /conveyor 51 starter/.test(s[49].lines.join(" ")) ? "" : s.length + " stored";
    } },
  { id: "U-17", harm: "high", why: "a kept three-wire conveyor starter is not a reversing starter: a reversing question is shown Lantern's reversing given",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Conveyor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22conveyor starter\x22\noverload OL1 M1\nEND", "Draw a conveyor starter control circuit"); if (k.err) return k.err;
      var s = x.shown("Draw a reversing starter control circuit for a conveyor");
      return s.kind === "lantern" && x.gid(s) === "control-reversing" ? "" : "shown " + s.kind + " " + s.title + ": " + s.lines.join(" | ");
    } },
  { id: "U-18", harm: "high", why: "a kept conveyor starter for a star-delta question: no block (star-delta is not a three-wire starter)",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Conveyor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22conveyor starter\x22\noverload OL1 M1\nEND", "Draw a conveyor starter control circuit"); if (k.err) return k.err;
      var q = "Draw a star-delta conveyor starter control circuit", s = x.shown(q);
      return s.kind ? "shown " + s.kind + " " + s.title : x.shown(q).prompt === x.old(q) ? "" : "the prompt differs from 1.24.35";
    } },
  { id: "U-19", harm: "high", why: "a kept one-pump sump circuit is not a duplex station: the duplex question keeps 1.24.35's prompt (its duplex example)",
    run: function (x) {
      var k = keepFrom(x, SUMP, SUMPQ); if (k.err) return k.err;
      var s = x.shown(DUPQ);
      return !s.kind && s.prompt === x.old(DUPQ) ? "" : "shown " + s.kind + " \x22" + s.title + "\x22 (" + s.lines.length + " lines, no alternator) in place of the duplex example";
    } },
  { id: "U-20", harm: "high", why: "a kept sump (the float closes as the water rises: it empties) is not a fill: a fill question is shown Lantern's fill given",
    run: function (x) {
      var k = keepFrom(x, SUMP, SUMPQ); if (k.err) return k.err;
      var s = x.shown("Draw a control circuit for a pump that fills a tank with a float switch");
      return s.kind === "lantern" && x.gid(s) === "control-fill" ? "" : "shown " + s.kind + " \x22" + s.title + "\x22: " + s.lines.join(" | ");
    } },
  { id: "U-21", harm: "medium", why: "a kept conveyor starter for a pump's start/stop question: the pump's starter (Lantern's), not the conveyor's",
    run: function (x) {
      var k = keepFrom(x, BLOCK, Q); if (k.err) return k.err;
      var s = x.shown("Draw a start stop control circuit for a pump with a green run light");
      return s.kind === "user" ? "shown the kept \x22" + s.title + "\x22 (coil M1 \x22conveyor starter\x22) for a pump" : "";
    } },
  { id: "U-22", harm: "high", why: "a kept duplex is shown for the same station question (pump stations get the user's own)",
    run: function (x) { var k = keepFrom(x, DUP, DUPQ); if (k.err) return k.err; var s = x.shown(DUPQ); return s.kind === "user" && /^alternator AR M1 M2$/m.test(s.lines.join("\n")) ? "" : "shown " + s.kind; } },
  { id: "U-23", harm: "low", why: "an explanation question is not shown a block to write as it stands, the user's or Lantern's",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Conveyor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22conveyor starter\x22\noverload OL1 M1\nEND", "Draw a conveyor starter control circuit"); if (k.err) return k.err;
      var s = x.shown("Explain how a conveyor starter control circuit works");
      return s.kind ? "shown " + s.kind + " \x22" + s.title + "\x22" : "";
    } },
  { id: "U-24", harm: "low", why: "a block written with numbered lines is kept and shown without the numbers (they are the list's, not the circuit's)",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Conveyor starter\n" + LINES.map(function (l, i) { return (i + 1) + ". " + l; }).join("\n") + "\nEND", Q); if (k.err) return k.err;
      var s = x.shown(Q);
      return s.lines.some(function (l) { return /^\d+\.\s/.test(l); }) ? "shown with numbers: " + s.lines[0] : "";
    } },
  { id: "U-25", harm: "low", why: "two different circuits kept in the same millisecond (the page\x27s clock held still) are both kept, and forgetting one leaves the other",
    run: function (x) {
      // the page's clock held still for the two keeps (two clicks in one millisecond, made sure of)
      var D = x.w.Date, now0 = D.now; D.now = function () { return 1764000000000; };
      var a = x.build(BLOCK, Q), b = x.build(SUMP, SUMPQ), ga, gb;
      try { ga = x.L.givens.keep(a, Q); gb = x.L.givens.keep(b, SUMPQ); } finally { D.now = now0; }
      if (!ga || !gb) return "not kept";
      if (x.L.givens.mine().length !== 2) return x.L.givens.mine().length + " in mine() (ids " + ga.id + ", " + gb.id + ")";
      x.L.givens.forget(ga.id);
      return x.stored().length === 1 && x.L.givens.mine().length === 1 ? "" : "after forgetting one: " + x.stored().length + " stored, " + x.L.givens.mine().length + " in mine() (ids " + ga.id + ", " + gb.id + ")";
    } },
  { id: "U-26", harm: "low", why: "the kept circuit is said to be the user's, with the day it was kept and the practice it was checked to",
    store: { "givens.user": JSON.stringify([entry({})]) },
    run: function (x) { var s = x.shown(Q); return /kept 2026-11-20, checked to US practice/.test(s.says) ? "" : "says: " + s.says; } },
  { id: "U-27", harm: "low", why: "kept after the user chose IEC practice: checked to IEC practice",
    store: { "codes.practice": JSON.stringify("IEC") },
    run: function (x) { var k = keepFrom(x, BLOCK, Q); if (k.err) return k.err; var s = x.shown(Q); return /checked to IEC practice/.test(s.says) ? "" : "says: " + s.says; } },
  { id: "U-28", harm: "low", why: "a kept conveyor starter asked for again in the plural (the conveyors' starter) is shown it",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Conveyor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22conveyor starter\x22\noverload OL1 M1\nEND", "Draw a conveyor starter control circuit"); if (k.err) return k.err;
      var s = x.shown("Draw the conveyors starter control circuit");
      return s.kind === "user" ? "" : "shown " + s.kind;
    } },
  { id: "U-29", harm: "medium", why: "the user's own compressor, kept, is shown above Lantern's compressor given for the same question",
    run: function (x) {
      var q = "Draw a control circuit for an air compressor with a pressure switch, cut-out 125 psi";
      var k = keepFrom(x, "MAKE CONTROL: Shop compressor\nswitch SS1 M1 \x22on/off\x22\npressure PS1 M1 nc \x22cut-out 125 psi\x22\ncoil M1 \x22compressor starter\x22\noverload OL1 M1\nlamp LT1 M1 \x22run\x22 green\nEND", q); if (k.err) return k.err;
      var s = x.shown(q);
      return s.kind === "user" && /lamp LT1/.test(s.lines.join("\n")) ? "" : "shown " + s.kind;
    } },
  { id: "U-30", harm: "high", why: "a kept motor starter (title Motor starter) is not shown for a two-speed motor starter question",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Motor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\noverload OL1 M1\nEND", "Draw a motor starter control circuit"); if (k.err) return k.err;
      var s = x.shown("Draw a two-speed motor starter control circuit");
      return s.kind ? "shown " + s.kind + " \x22" + s.title + "\x22 for a two-speed starter" : "";
    } },
  { id: "U-31", harm: "high", why: "a kept fill (low start, high stop, nc floats) is not shown for a sump question: Lantern's sump given",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Tank fill pump\nfloat FS1 M1 nc \x22low level start\x22\nfloat FS2 M1 nc \x22high level stop\x22\ncoil M1 \x22pump starter\x22\noverload OL1 M1\nEND", "Draw a control circuit for a pump with a low float and a high float to fill the tank"); if (k.err) return k.err;
      var s = x.shown("Draw a control circuit for a sump pump with a low float and a high float");
      return s.kind === "user" ? "shown the kept fill \x22" + s.title + "\x22 (floats nc, opening on rise) for a sump" : "";
    } },
  { id: "U-32", harm: "high", why: "a kept one-pump starter (title Pump starter) is not shown for a duplex lift station's question: 1.24.35's prompt with its duplex example",
    run: function (x) {
      var k = keepFrom(x, "MAKE CONTROL: Pump starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22pump starter\x22\noverload OL1 M1\nEND", "Draw a pump starter control circuit"); if (k.err) return k.err;
      var q = "Draw a pump starter for a duplex lift station with an alternating relay", s = x.shown(q);
      return !s.kind && s.prompt === x.old(q) ? "" : "shown " + s.kind + " \x22" + s.title + "\x22 in place of the duplex example";
    } },
  { id: "U-33", harm: "medium", why: "the bench measures Lantern's prompts: a circuit the user kept on that page should not change what the bench's make-control question is shown (the bench's make questions are built by aiAct.solve with Chat's system prompt)",
    run: function (x) {
      var q = "Draw the control circuit for a motor starter: a stop push button, a start push button with a holding contact so the motor keeps running after start is let go, the overload contact, the starter coil, and a pilot light that is on while the motor runs.";
      var before = x.shown(q);
      var k = keepFrom(x, "MAKE CONTROL: Motor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\noverload OL1 M1\nEND", "Draw a motor starter control circuit"); if (k.err) return k.err;
      var after = x.shown(q);
      return after.kind === before.kind && after.lines.join("\n") === before.lines.join("\n") ? "" : "the bench question is now shown the user\x27s kept " + after.title + " (" + after.lines.length + " lines, no pilot light) in place of Lantern\x27s";
    } }
];
