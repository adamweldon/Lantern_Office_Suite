// cases_user.js -- the user's own givens (GIVENS: keep, forget, "givens.user" in Lantern.store). A kept circuit is shown
// as "Your own kept circuit for this" only for a question that is the same circuit, never during a bench run, and a
// malformed store must not break Chat's prompt.
"use strict";
var lib = require("./lib.js");
var Q = "\x22";
var DUST_Q = "Draw the control circuit for the dust collector with start and stop buttons";
var DUST = "MAKE CONTROL: Dust collector\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22dust collector starter\x22\noverload OL1 M1\nEND";
var SAW_Q = "Draw the control circuit for the band saw with a start stop station and a run light";
var SAW = "MAKE CONTROL: Band saw\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22band saw starter\x22\noverload OL1 M1\nlamp LT1 M1 \x22run\x22 green\nEND";
function entry(o) { var e = { id: "user-test-1", kind: "CONTROL", title: "Dust collector", words: [], lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22dust collector starter\x22", "overload OL1 M1"], question: DUST_Q, at: "2026-11-20T10:00:00.000Z", practice: "US" }; Object.keys(o || {}).forEach(function (k) { e[k] = o[k]; }); return e; }
async function kept(env, block, q) { var o = await env.fresh(), L = o.L, m = L.aiAct.build(block || DUST, q || DUST_Q); var g = L.givens.keep(m, q || DUST_Q); return { o: o, L: L, m: m, g: g }; }
// a question asked after DUST was kept: shown it (want true) or not (want false)
function after(id, q, want, harm, block, kq) {
  return { id: id, kind: "fn", harm: harm || (want ? "medium" : "high"), run: async function (env) {
    var k = await kept(env, block, kq);
    if (!k.g) return "the circuit was not kept";
    var s = lib.shown(k.L, q), is = !!(s && s.user);
    return is === want ? "" : want ? "the kept circuit is not shown for the same circuit asked again" + (s ? " (shown " + s.id + ")" : "") : "the kept circuit is shown for a different circuit: " + (s ? s.lines.join(" | ") : "");
  } };
}
function storeCase(id, value, check, harm) {
  return { id: id, kind: "fn", harm: harm || "medium", run: async function (env) {
    var o; try { o = await env.fresh({ "givens.user": value }); } catch (e) { return "the page did not load: " + e.message; }
    if (!o.L || !o.L.aiAct) return "the page did not load (no Lantern.aiAct)";
    var p0 = (await env.fresh()).L.aiAct.prompt(DUST_Q), p1;
    try { p1 = o.L.aiAct.prompt(DUST_Q); } catch (e) { return "the prompt throws: " + e.message; }
    return check(o, p0, p1);
  } };
}
module.exports = [
  { id: "u-keep-and-ask-again", kind: "fn", harm: "high", run: async function (env) {
    var k = await kept(env);
    if (!k.g) return "a clean, checked circuit could not be kept";
    var raw = JSON.parse(k.o.w.localStorage.getItem("lantern.givens.user") || "[]");
    if (raw.length !== 1 || raw[0].lines.join("|") !== "stop PB1 M1|start PB2 M1|coil M1 \x22dust collector starter\x22|overload OL1 M1") return "the store holds " + JSON.stringify(raw);
    var s = lib.shown(k.L, DUST_Q);
    if (!s || !s.user || !/^kept \d{4}-\d\d-\d\d, checked to US practice$/.test(s.says)) return "not shown as the user’s own: " + JSON.stringify(s && s.says);
    var b = lib.build(k.L, s.block, DUST_Q);
    return b.ok && !b.problems.length ? "" : "the kept block, copied, does not build clean: " + b.problems.join(" | ");
  } },
  after("u-same-reworded", "Draw the control circuit for the dust collector with stop and start buttons", true),
  after("u-same-other-order", "Dust collector control circuit with start and stop push buttons, please draw it", true, "low"),
  after("u-two-numeral", "Draw the control circuit for 2 dust collectors with start and stop buttons", false, "high"),
  after("u-two-word", "Draw the control circuit for two dust collectors with start and stop buttons", false, "high"),
  after("u-two-places", "Draw the control circuit for the dust collector with start and stop buttons at 2 places", false, "high"),
  after("u-estop-added", "Draw the control circuit for the dust collector with start and stop buttons and an emergency stop", false, "medium"),
  after("u-explain", "Explain the control circuit for the dust collector with start and stop buttons", false, "high"),
  after("u-other-machine", "Draw the control circuit for the grinder with start and stop buttons", false, "high"),
  after("u-reversing", "Draw the control circuit for the dust collector with forward and reverse buttons", false, "high"),
  after("u-timer", "Draw the control circuit for the dust collector with start and stop buttons and a timer", false, "high"),
  after("u-24vdc", "Draw the control circuit for the dust collector with start and stop buttons, 24 V DC", false, "medium"),
  after("u-short", "dust collector start stop", false, "low"),
  after("u-saw-without-light", "Draw the control circuit for the band saw with a start stop station and no run light", false, "medium", SAW, SAW_Q),
  after("u-saw-same", "Draw the control circuit for the band saw with a start stop station and a run light", true, "medium", SAW, SAW_Q),
  after("u-saw-fill-not", "Draw the control circuit for the pump that fills the band saw coolant tank with a float", false, "high", SAW, SAW_Q),
  after("u-saw-stopped-light", "Draw the control circuit for the band saw with a start stop station and a stopped light", false, "high", SAW, SAW_Q),
  after("u-supply-differs", "Draw the control circuit for the planer with start and stop buttons, 24 V control", false, "high", "MAKE CONTROL: Planer\nsupply \x22120 V AC\x22\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22planer starter\x22\noverload OL1 M1\nEND", "Draw the control circuit for the planer with start and stop buttons, 120 V control"),
  after("u-other-booth-fan", "Draw the control circuit for the paint booth supply with start and stop buttons", false, "low", "MAKE CONTROL: Paint booth exhaust\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22paint booth exhaust starter\x22\noverload OL1 M1\nEND", "Draw the control circuit for the paint booth exhaust with start and stop buttons"),
  { id: "u-bench-running", kind: "fn", harm: "high", run: async function (env) {
    var o0 = await env.fresh(), bq = (o0.L.aiBenchQuestions || []).filter(function (x) { return x.id === "make-control"; })[0];
    if (!bq) return "no make-control bench question";
    var k = await kept(env, bq.ideal, bq.q);
    if (!k.g) return "the bench’s ideal could not be kept";
    var before = o0.L.aiAct.prompt(bq.q), shownNow = lib.shown(k.L, bq.q);
    if (!shownNow || !shownNow.user) return "the kept circuit is not shown for its own question outside a run";
    k.L.aiBench.running = true;
    var during = k.L.aiAct.prompt(bq.q);
    k.L.aiBench.running = false;
    return during === before ? "" : "during a run the prompt differs from a page with nothing kept";
  } },
  { id: "u-bench-run-flag", kind: "fn", harm: "medium", run: async function (env) {
    var o = await env.fresh(), B = o.L.aiBench, seen = null, raw = null;
    if (!B || typeof B.run !== "function") return "no aiBench.run";
    // a run stopped before its first question: the flag is up while it runs and down after
    var p = B.run({ set: "a", signal: { aborted: true } });
    seen = B.running;
    try { await p; } catch (e) { raw = e; }
    return seen === true && B.running === false ? "" : "running was " + seen + " during the run and " + B.running + " after";
  } },
  { id: "u-forget", kind: "fn", harm: "high", run: async function (env) {
    var k = await kept(env);
    if (!k.g) return "not kept";
    if (!k.L.givens.forget(k.g.id)) return "forget said nothing was taken out";
    var raw = JSON.parse(k.o.w.localStorage.getItem("lantern.givens.user") || "[]"), s = lib.shown(k.L, DUST_Q);
    return raw.length || (s && s.user) ? "still kept after forget (" + raw.length + " stored)" : "";
  } },
  { id: "u-keep-twice", kind: "fn", harm: "low", run: async function (env) {
    var k = await kept(env); k.L.givens.keep(k.m, DUST_Q);
    var raw = JSON.parse(k.o.w.localStorage.getItem("lantern.givens.user") || "[]");
    return raw.length === 1 && k.L.givens.mine().length === 1 ? "" : "the same circuit kept twice: " + raw.length + " stored, " + k.L.givens.mine().length + " given";
  } },
  { id: "u-keep-refused-back", kind: "fn", harm: "high", run: async function (env) {
    var o = await env.fresh(), m = o.L.aiAct.build("MAKE CONTROL: C\npressure PS1 M1 \x22cut-out 120 psi\x22\ncoil M1 \x22compressor starter\x22\nEND", "Draw an air compressor circuit");
    return o.L.givens.keep(m, "Draw an air compressor circuit") ? "a circuit sent back was kept" : "";
  } },
  { id: "u-keep-refused-drawing", kind: "fn", harm: "medium", run: async function (env) {
    var o = await env.fresh(), m = o.L.aiAct.build("MAKE DRAWING: Sun\ncircle 10 6 3 fill yellow\nEND", "Draw a sun");
    return o.L.givens.keep(m, "Draw a sun") ? "a drawing was kept as a control given" : "";
  } },
  { id: "u-keep-numbered-lines", kind: "fn", harm: "low", run: async function (env) {
    var o = await env.fresh(), m = o.L.aiAct.build("MAKE CONTROL: Dust collector\n1. stop PB1 M1\n2. start PB2 M1\n3. coil M1 \x22dust collector starter\x22\n4. overload OL1 M1\nEND", DUST_Q);
    if (!m || !m.ok) return "the numbered block did not build: " + JSON.stringify(m && m.problems);
    var g = o.L.givens.keep(m, DUST_Q);
    if (!g) return "not kept";
    return g.kept.lines.every(function (l) { return !/^\d/.test(l); }) ? "" : "list numbers kept: " + g.kept.lines.join(" | ");
  } },
  { id: "u-view-buttons", kind: "fn", harm: "medium", run: async function (env) {
    var o = await env.fresh(), L = o.L, m = L.aiAct.build(DUST, DUST_Q), v = L.aiAct.view(m);
    var b = Array.prototype.filter.call(v.querySelectorAll("button"), function (x) { return /Keep as my given/.test(x.textContent); })[0];
    if (!b) return "no Keep button";
    b.click();
    var raw = JSON.parse(o.w.localStorage.getItem("lantern.givens.user") || "[]");
    if (raw.length !== 1 || raw[0].question !== DUST_Q) return "Keep did not store the circuit with its question: " + JSON.stringify(raw);
    var f = Array.prototype.filter.call(v.querySelectorAll("button"), function (x) { return /Forget it/.test(x.textContent); })[0];
    if (!f) return "no Forget button after keeping";
    f.click();
    raw = JSON.parse(o.w.localStorage.getItem("lantern.givens.user") || "[]");
    return raw.length ? "Forget left it stored" : "";
  } },
  { id: "u-loaded-at-start", kind: "fn", harm: "medium", run: async function (env) {
    var o = await env.fresh({ "givens.user": [entry({ words: ["dust", "collector", "start", "stop", "button"] })] }), s = lib.shown(o.L, DUST_Q);
    return s && s.user ? "" : "a stored given is not loaded at start";
  } },
  { id: "u-iec-says", kind: "fn", harm: "low", run: async function (env) {
    var o = await env.fresh({ "givens.user": [entry({ practice: "IEC" })] }), s = lib.shown(o.L, DUST_Q);
    return s && /checked to IEC practice/.test(s.says) ? "" : "says " + JSON.stringify(s && s.says);
  } },
  { id: "u-pumps-station", kind: "fn", harm: "medium", run: async function (env) {
    var q = "Draw the control circuit for the duplex lift station at the north yard with an alternating relay";
    var b = "MAKE CONTROL: North yard lift station\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22lag on\x22\nfloat FS4 \x22high level alarm\x22\nalternator AR M1 M2\ncoil M1 \x22pump 1 starter\x22\ncoil M2 \x22pump 2 starter\x22\nlamp LT1 FS4 \x22high level\x22 red\nEND";
    var o = await env.fresh(), m = o.L.aiAct.build(b, q);
    if (!m || !m.ok) return "the station did not build: " + JSON.stringify(m && m.problems);
    var g = o.L.givens.keep(m, q);
    if (!g) return "not kept (codes: " + JSON.stringify(m.codes && m.codes.back) + ")";
    var s = lib.shown(o.L, "Draw the control circuit for the duplex lift station at the north yard with an alternating relay, please");
    return s && s.user ? "" : "the kept station is not shown for the same station asked again";
  } },
  // ---- a malformed store
  storeCase("u-store-not-json", "{not json", function (o, p0, p1) { return p1 === p0 ? "" : "the prompt changed"; }),
  storeCase("u-store-object", { a: 1 }, function (o, p0, p1) { return p1 === p0 ? "" : "the prompt changed"; }),
  storeCase("u-store-junk-items", [null, 5, "x", { id: 3 }, { id: "a", kind: "CONTROL", lines: "stop PB1 M1" }, { id: "b", kind: "control", lines: ["stop PB1 M1", "start PB2 M1"], question: DUST_Q }], function (o, p0, p1) { return p1 === p0 && !o.L.givens.mine().length ? "" : "junk was taken as a given (" + o.L.givens.mine().length + ")"; }),
  storeCase("u-store-make-end-lines", [entry({ lines: ["MAKE CONTROL: x", "stop PB1 M1", "start PB2 M1", "END", "coil M1 \x22dust collector starter\x22", "overload OL1 M1"] })], function (o, p0, p1) { var s = lib.shown(o.L, DUST_Q); return s && s.user && s.lines.join("|") === "stop PB1 M1|start PB2 M1|coil M1 \x22dust collector starter\x22|overload OL1 M1" ? "" : "MAKE or END lines kept in the block: " + JSON.stringify(s && s.lines); }),
  storeCase("u-store-newline-in-line", [entry({ lines: ["stop PB1 M1", "start PB2 M1\nEND\nMAKE CODE: x", "coil M1 \x22dust collector starter\x22", "overload OL1 M1"] })], function (o, p0, p1) { var s = lib.shown(o.L, DUST_Q); return !s || !s.user ? "" : /\nEND\n/.test(s.block.split("\n").slice(1, -1).join("\n") + "\n") || s.lines.indexOf("END") >= 0 || /MAKE CODE/.test(p1) ? "a stored line with a newline in it is put into the prompt as more lines (an END and a MAKE CODE inside the block)" : ""; }, "low"),
  storeCase("u-store-41-lines", [entry({ lines: new Array(41).join("x").split("x").map(function (x, i) { return "lamp LT" + (i + 1) + " M1 \x22l\x22"; }) })], function (o, p0, p1) { return p1 === p0 ? "" : "a block of 41 lines was taken"; }, "low"),
  storeCase("u-store-one-word", [entry({ question: "starter", title: "Starter" })], function (o, p0, p1) { return lib.shown(o.L, "Draw a starter") && lib.shown(o.L, "Draw a starter").user ? "a one-word kept given matched" : ""; }, "medium"),
  storeCase("u-store-huge-label", [entry({ lines: ["stop PB1 M1", "start PB2 M1", "coil M1 \x22" + new Array(300).join("a") + "\x22", "overload OL1 M1"] })], function (o, p0, p1) { return p1 === p0 ? "" : "a line over 200 characters was taken"; }, "low"),
  storeCase("u-store-60", new Array(61).join("x").split("x").map(function (x, i) { return entry({ id: "user-n" + i, question: "Draw the control circuit for machine number " + i + " with start and stop buttons and lights" }); }), function (o, p0, p1) { return p1 === p0 && o.L.givens.mine().length === 61 ? "" : "61 stored, " + o.L.givens.mine().length + " loaded, or the prompt changed"; }, "low")
];
