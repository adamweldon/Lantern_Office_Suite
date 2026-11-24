// cases_misc.js -- the fifth review of 1.24.36 (review5_1236): which code a question is checked to, the line under a
// drawing, the user's own kept givens, and the two guards (the bench's prompts, the saved replies). Each case runs a
// function: run(ctx) -> {agree, did}. ctx: {L (the page under review), Lold (1.24.35), fresh() -> a new page of the
// file under review, blk(lines, title), S (sim.js), oldHtml}.
"use strict";
function pick(id, q, want, harm, saved) {
  return { id: id, harm: harm || "low", run: function (ctx) {
    var C = ctx.L.codeChecks, before = C.saved();
    if (saved) C.choose(saved);
    var got = C.pick(q);
    if (saved) { try { ctx.L.store.set("codes.practice", before); } catch (e) { } }
    return { agree: got === want, did: "picked " + got + " for “" + q + "” (right: " + want + ")" };
  } };
}
function given(L, q) {
  var p = L.aiControl.promptOf(q), i = -1;
  p.forEach(function (l, k) { if (i < 0 && /^(?:Lantern’s tested circuit|Your own kept circuit)/.test(l)) i = k; });
  if (i < 0) return null;
  return { head: p[i], title: p[i + 1].replace(/^MAKE CONTROL:\s*/, ""), lines: p.slice(i + 2, p.lastIndexOf("END")) };
}
var KEPTQ = "Draw a conveyor starter with start and stop buttons and a green run light";
var KEPT = ["stop PB1 M1", "start PB2 M1", "coil M1 \x22conveyor starter\x22", "overload OL1 M1", "lamp LT1 M1 \x22run\x22 green"];
// a page with KEPT kept as the user's own given; then (q) -> the given shown for q
function keptPage(ctx) {
  if (ctx.kept) return ctx.kept;
  var o = ctx.fresh(), L = o.L, m = L.aiAct.build(ctx.blk(KEPT, "Conveyor starter"), KEPTQ), g = L.givens.keep(m, KEPTQ);
  ctx.kept = { o: o, L: L, g: g, m: m };
  return ctx.kept;
}
function keptFor(id, q, wantKept, harm, why) {
  return { id: id, harm: harm || "high", run: function (ctx) {
    var k = keptPage(ctx);
    if (!k.g) return { agree: false, did: "the circuit could not be kept" };
    var g = given(k.L, q), isKept = !!(g && /^Your own kept circuit/.test(g.head));
    return { agree: isKept === wantKept, did: (isKept ? "the kept circuit (" + g.lines.join(" / ") + ") is shown" : g ? "Lantern’s own given is shown" : "no given is shown") + " for “" + q + "”" + (why ? " -- " + why : "") };
  } };
}

module.exports = [
  // ---- which code: the question's, else the user's choice, else US --------------------------------------------------
  pick("p-germany", "Draw a motor starter for a pump in Germany", "IEC"),
  pick("p-german-customer", "Draw a motor starter for a pump for a German customer", "IEC"),
  pick("p-texas", "Draw a starter for a plant in Texas", "US"),
  pick("p-400v-50hz", "Draw a 400V 50Hz motor starter", "IEC"),
  pick("p-480v-60hz", "Draw a 480V 60Hz motor starter", "US"),
  pick("p-india", "Draw a motor starter for a pump in India", "IEC"),
  pick("p-indiana", "Draw a motor starter for a pump in Indiana", "US"),
  pick("p-india-street", "Draw a motor starter for a pump on India Street", "US"),
  pick("p-uk", "Draw a motor starter for the UK", "IEC"),
  pick("p-new-zealand", "Draw a motor starter for a pump in New Zealand", "IEC"),
  pick("p-australia-415", "Draw a motor starter for a pump, 415 V, in Australia", "IEC"),
  pick("p-as-nzs", "Draw a motor starter to AS/NZS 3000", "IEC"),
  pick("p-bs7671", "Draw a motor starter to BS 7671", "IEC"),
  pick("p-redraw-to-iec", "Redraw this NEC starter to IEC", "IEC"),
  pick("p-iec-per-nfpa", "Draw this IEC starter per NFPA 79", "US"),
  pick("p-french-drain", "Draw a motor starter for a French drain pump", "US"),
  pick("p-canada", "Draw a motor starter for a pump in Canada", "US"),
  pick("p-ontario-575", "Draw a motor starter, 575 V, for a mill in Ontario", "US"),
  pick("p-chile-380", "Draw a motor starter, 380 V, for a mine in Chile", "IEC"),
  pick("p-paris-texas", "Draw a motor starter for a pump in Paris, Texas", "US"),
  pick("p-caps-us-saved-iec", "DRAW A MOTOR STARTER FOR US PLEASE", "IEC", "low", "IEC"),
  pick("p-show-us-saved-iec", "Show us a motor starter", "IEC", "low", "IEC"),
  pick("p-neutral-saved-iec", "Draw a motor starter for a pump", "IEC", "medium", "IEC"),
  pick("p-texas-saved-iec", "Draw a motor starter for a pump in Texas", "US", "medium", "IEC"),
  pick("p-neutral-default", "Draw a motor starter for a pump", "US", "medium"),
  // found by this review (low: the rules checked are the same; only the code named and its section differ)
  pick("F-p-nema-in-germany", "Draw a NEMA starter for a pump in Germany", "IEC"),
  pick("F-p-iec-contactor-ohio", "Draw a motor starter with an IEC contactor for a pump in Ohio", "US"),
  pick("F-p-kenya", "Draw a motor starter for a pump in Kenya", "IEC"),
  pick("F-p-nigeria", "Draw a motor starter for a pump in Nigeria", "IEC"),
  pick("F-p-european-market", "Draw a motor starter for a machine for the European market built in Ohio", "IEC"),
  { id: "p-choose-bad-id", harm: "low", run: function (ctx) { var C = ctx.L.codeChecks, b = C.saved(), r = C.choose("CSA"); return { agree: r === false && C.saved() === b, did: "choose(“CSA”) returned " + r + ", saved is now " + JSON.stringify(C.saved()) }; } },

  // ---- what goes back names the practice and ends with the line; the line under the drawing ----------------------
  { id: "v-back-germany", harm: "medium", run: function (ctx) {
    var m = ctx.L.aiAct.build(ctx.blk(["pressure PS1 M1 \x22opens at cut-out\x22", "coil M1 \x22compressor starter\x22"], "Air compressor"), "Draw the control circuit for an air compressor with a pressure switch in Germany");
    var p = (m && m.problems || []).join(" | ");
    return { agree: !m.ok && /\(IEC practice: IEC 60204-1:2016, 9\.3\.2\)\. Write it: pressure PS1 M1 nc \x22opens at cut-out\x22$/.test(p) && !/NFPA/.test(p), did: "sent back: " + p };
  } },
  { id: "v-back-once-each", harm: "medium", run: function (ctx) {
    var m = ctx.L.aiAct.build(ctx.blk(["pressure PS1 M1 \x22high pressure cut-out\x22", "temp TS1 M1 \x22high temp cut-out\x22", "coil M1 \x22compressor starter\x22"], "C"), "Draw an air compressor");
    var p = m.problems || [], ps = p.filter(function (x) { return /PS1/.test(x); }), ts = p.filter(function (x) { return /TS1/.test(x); });
    return { agree: ps.length === 1 && ts.length === 1 && p.every(function (x) { return /Write it: /.test(x); }), did: p.length + " problems: " + p.join(" | ") };
  } },
  { id: "v-checked-line-switch", harm: "medium", run: function (ctx) {
    var L = ctx.L, before = L.codeChecks.saved();
    var m = L.aiAct.build(ctx.blk(["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 nc \x22cut-out 125 psi\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"], "Air compressor"), "Draw the control circuit for an air compressor with a pressure switch, cut out 125 psi");
    var v = L.codeChecks.view(m);
    if (!v) { return { agree: false, did: "no line under the drawing" }; }
    var t0 = v.textContent, b = v.querySelector("button"), t1, saved1, t2;
    b.onclick(); t1 = v.textContent; saved1 = L.codeChecks.saved(); b.onclick(); t2 = v.textContent;
    try { L.store.set("codes.practice", before); } catch (e) { }
    var ok = /^Checked to US practice \(NEC and NFPA 79\): PS1 opens as the pressure rises — NFPA 79, exceeding operating limits; the overload OL1 on M1 — NEC Article 430, Part III\./.test(t0) && /Use IEC practice/.test(t0) &&
      /^Checked to IEC practice \(IEC 60204-1\): PS1 opens as the pressure rises — IEC 60204-1:2016, 9\.3\.2; the overload OL1 on M1 — IEC 60204-1:2016, 7\.3\./.test(t1) && /Use US practice/.test(t1) && saved1 === "IEC" && /^Checked to US practice/.test(t2);
    return { agree: ok, did: "first: " + t0 + " || switched: " + t1 + " (saved " + saved1 + ") || back: " + t2 };
  } },
  { id: "v-checked-interlock-estop", harm: "medium", run: function (ctx) {
    var L = ctx.L, m = L.aiAct.build(ctx.blk(["estop ES1", "stop PB1 all", "start PB2 M1 \x22forward\x22", "start PB3 M2 \x22reverse\x22", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22", "interlock M1 M2", "overload OL1 M1 M2"], "Reversing"), "Draw a reversing motor starter with an e-stop");
    var t = m && m.codes ? L.codeChecks.line(m.codes) : "";
    return { agree: /M1 and M2 locked out of each other/.test(t) && /the emergency stop ES1 ahead of every rung/.test(t) && /the overload OL1 on M1 and M2/.test(t) && /the stop normally closed/.test(t), did: t || "no line" };
  } },
  { id: "v-checked-not-open-stop", harm: "medium", run: function (ctx) {
    var L = ctx.L, m = L.aiAct.build(ctx.blk(["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1", "stop PB3 CR1 \x22test\x22", "start PB4 CR1", "coil CR1 \x22test relay\x22"], "T"), "Draw a pump starter");
    var t = m && m.codes ? L.codeChecks.line(m.codes) : "";
    return { agree: m.ok && /the stops normally closed/.test(t), did: m.ok ? t : "sent back: " + m.problems.join(" | ") };
  } },
  { id: "v-no-line-when-nothing-checked", harm: "low", run: function (ctx) {
    var L = ctx.L, m = L.aiAct.build(ctx.blk(["temp TS1 M1 nc \x22low temp\x22", "coil M1 \x22heat trace contactor\x22"], "Heat trace"), "Draw heat trace with a thermostat");
    var v = L.codeChecks.view(m);
    return { agree: m.ok && v === null, did: v ? "a line is shown: " + v.textContent : "no line (nothing was checked)" };
  } },
  { id: "v-view-has-both-tools", harm: "medium", run: function (ctx) {
    var o = ctx.fresh(), L = o.L, m = L.aiAct.build(ctx.blk(["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22", "overload OL1 M1"], "Pump starter"), "Draw a pump starter");
    var box = L.aiAct.view(m), codes = box && box.querySelector(".la-codes"), keep = box && box.querySelector(".la-keep");
    return { agree: !!codes && !!keep && /Keep as my given/.test(keep.textContent), did: "codes line " + (codes ? "shown" : "missing") + ", keep button " + (keep ? keep.textContent : "missing") };
  } },
  { id: "v-no-keep-for-drawing", harm: "low", run: function (ctx) {
    var L = ctx.L, m = L.aiAct.build("MAKE DRAWING: Hut\nrect 0 0 20 12 fill sky\nEND", "Draw a hut");
    var box = m ? L.aiAct.view(m) : null;
    return { agree: !!box && !box.querySelector(".la-keep") && !box.querySelector(".la-codes"), did: box ? (box.querySelector(".la-keep") ? "a keep button under a picture" : "no keep button, no code line") : "nothing built" };
  } },

  // ---- the user's own givens --------------------------------------------------------------------------------------
  { id: "u-keep-stores", harm: "high", run: function (ctx) {
    var k = keptPage(ctx), a = k.L.store.get("givens.user", []);
    return { agree: !!k.g && Array.isArray(a) && a.length === 1 && a[0].lines.join("|") === KEPT.join("|") && a[0].practice === "US", did: "kept: " + JSON.stringify(a).slice(0, 300) };
  } },
  keptFor("u-same-question", KEPTQ, true, "high"),
  keptFor("u-again", "Draw the conveyor starter with start and stop buttons and a green run light again", true, "medium"),
  keptFor("u-not-24vdc", "Draw a conveyor starter with start and stop buttons and a green run light, 24 V DC", false, "high"),
  keptFor("u-not-second-conveyor", "Draw a conveyor starter with start and stop buttons and a green run light for the second conveyor", false, "high"),
  keptFor("u-not-two-stations", "Draw a conveyor starter with start and stop buttons at two stations and a green run light", false, "high"),
  keptFor("u-not-delay", "Draw a conveyor starter with start and stop buttons and a green run light with a 10 second warning horn", false, "high"),
  keptFor("u-not-stopped-light", "Draw a conveyor starter with start and stop buttons and a green run light and a red stopped light", false, "high"),
  keptFor("u-not-pump", "Draw a pump starter with start and stop buttons and a green run light", false, "high"),
  keptFor("u-not-red", "Draw a conveyor starter with start and stop buttons and a red run light", false, "high"),
  keptFor("u-not-emergency-stop", "Draw a conveyor starter with start and stop buttons, a green run light and an emergency stop", false, "high"),
  keptFor("F-u-no-light-asked", "Draw a conveyor starter with start and stop buttons", false, "medium", "the question asks for no light; the kept circuit has a run light the model is told to write as it stands"),
  keptFor("F-u-e-stop", "Draw a conveyor starter with start and stop buttons, a green run light and an e-stop", false, "high", "the question asks for an e-stop the kept circuit does not have (“e-stop” is read as “e” and “stop”)"),
  keptFor("F-u-E-stop-button", "Draw a conveyor starter with start and stop buttons, a green run light and an E-stop button", false, "high", "the question asks for an e-stop the kept circuit does not have"),
  keptFor("F-u-local-remote", "Draw a conveyor starter with local and remote start and stop buttons and a green run light", false, "high", "two stations asked for; the kept circuit has one"),
  keptFor("F-u-iec", "Draw a conveyor starter with start and stop buttons and a green run light in IEC", false, "medium", "IEC asked for; the kept circuit was checked to US practice"),
  keptFor("F-u-flashes", "Draw a conveyor starter with start and stop buttons and a green run light that flashes", false, "medium", "a flashing light asked for; the kept one is steady"),
  { id: "u-bench-leaves-out", harm: "high", run: function (ctx) {
    var k = keptPage(ctx), B = k.L.aiBench, was = B.running;
    B.running = true; var g = given(k.L, KEPTQ); B.running = was;
    return { agree: !!g && !/^Your own kept circuit/.test(g.head), did: g ? g.head.slice(0, 60) : "no given while the bench runs" };
  } },
  { id: "u-bench-run-flag", harm: "high", run: function (ctx) {
    var B = ctx.L.aiBench;
    return { agree: B.running === false && typeof B.run === "function", did: "aiBench.running is " + B.running };
  } },
  { id: "u-keep-refuses-back", harm: "high", run: function (ctx) {
    var L = ctx.fresh().L, q = "Draw an air compressor";
    var m = L.aiAct.build(ctx.blk(["pressure PS1 M1 \x22opens at cut-out\x22", "coil M1 \x22compressor starter\x22"], "C"), q);
    var g = L.givens.keep(m, q), v = L.aiAct.view(m);
    return { agree: !g && !(v && v.querySelector && v.querySelector(".la-keep")), did: g ? "a circuit sent back was kept" : "not kept" };
  } },
  { id: "u-forget", harm: "medium", run: function (ctx) {
    var o = ctx.fresh(), L = o.L, m = L.aiAct.build(ctx.blk(KEPT, "Conveyor starter"), KEPTQ), g = L.givens.keep(m, KEPTQ);
    var shown = given(L, KEPTQ), f = L.givens.forget(g.id), after = given(L, KEPTQ), st = L.store.get("givens.user", []);
    return { agree: /^Your own/.test(shown.head) && f && !(after && /^Your own/.test(after.head)) && st.length === 0, did: "forget -> " + f + ", after: " + (after ? after.head.slice(0, 40) : "none") + ", store " + JSON.stringify(st) };
  } },
  { id: "u-keep-button-click", harm: "medium", run: function (ctx) {
    var o = ctx.fresh(), L = o.L, m = L.aiAct.build(ctx.blk(KEPT, "Conveyor starter"), KEPTQ);
    var box = L.aiAct.view(m), keep = box.querySelector(".la-keep"), b = keep.querySelector("button");
    b.onclick(); var t1 = keep.textContent, st = L.store.get("givens.user", []);
    var f = keep.querySelector("button"); f.onclick(); var t2 = keep.textContent, st2 = L.store.get("givens.user", []);
    return { agree: /Kept as your own given/.test(t1) && st.length === 1 && st[0].question === KEPTQ && /Keep as my given/.test(t2) && st2.length === 0, did: "after keep: " + t1 + " (" + st.length + " stored); after forget: " + t2 + " (" + st2.length + ")" };
  } },
  { id: "u-store-loads", harm: "high", run: function (ctx) {
    var o = ctx.fresh({ "givens.user": [{ id: "user-x-1", kind: "CONTROL", title: "Conveyor starter", lines: KEPT, question: KEPTQ, at: "2026-11-20T10:00:00Z", practice: "US" }] });
    var g = given(o.L, KEPTQ);
    return { agree: !!g && /^Your own kept circuit/.test(g.head) && g.lines.join("|") === KEPT.join("|") && /kept 2026-11-20, checked to US practice/.test(g.head), did: g ? g.head + " :: " + g.lines.join(" / ") : "not shown" };
  } },
  { id: "u-store-cleans", harm: "high", run: function (ctx) {
    var o = ctx.fresh({ "givens.user": [
      { id: "user-a", kind: "CONTROL", title: "Fan starter", lines: ["MAKE CONTROL: Fan starter", "1. stop PB1 M1", "- start PB2 M1", "coil M1 \x22fan starter\x22", "END"], question: "Draw a fan starter with start and stop buttons" },
      { id: "user-b", kind: "CONTROL", title: "Bad", lines: ["stop PB1 M1\nstart PB2 M1"], question: "Draw a mixer starter with start and stop buttons" },
      { id: "user-c", kind: "HYDRAULIC", title: "Press", lines: ["pump P1"], question: "Draw a press circuit" },
      { id: "user-d", kind: "CONTROL", title: "Long", lines: new Array(45).join("x,").split(",").map(function (x, i) { return "lamp LT" + i + " M1"; }), question: "Draw a blower starter with lights" }] });
    var mine = o.L.givens.mine().map(function (g) { return g.id + ":" + g.kept.lines.join("/"); });
    return { agree: mine.length === 1 && mine[0] === "user-a:stop PB1 M1/start PB2 M1/coil M1 \x22fan starter\x22", did: "loaded: " + JSON.stringify(mine) };
  } },
  { id: "u-pump-station-kept-only", harm: "high", run: function (ctx) {
    var o = ctx.fresh(), L = o.L, q = "Draw the control circuit for a duplex lift station with an alternating relay";
    var g0 = given(L, q);
    var lines = ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"];
    var m = L.aiAct.build(ctx.blk(lines, "Duplex"), q), k = L.givens.keep(m, q), g1 = given(L, q);
    var simplex = L.aiAct.build(ctx.blk(["switch SS1 M1", "float FS1 M1 \x22pump on\x22", "coil M1 \x22pump contactor\x22"], "Sump"), "Draw a contactor circuit for a sump pump with a float switch");
    var k2 = simplex && simplex.plan && simplex.plan.mode === "control" ? L.givens.keep(simplex, "Draw a contactor circuit for a sump pump with a float switch") : null;
    var g2 = given(L, "Draw the control circuit for a duplex sump pump station with an alternating relay");
    return { agree: !g0 && !!k && !!g1 && /^Your own/.test(g1.head) && !(g2 && g2.lines.join("|") === (k2 ? k2.kept.lines.join("|") : "-")), did: "before keeping: " + (g0 ? g0.head.slice(0, 30) : "none") + "; after: " + (g1 ? g1.head.slice(0, 30) : "none") + "; simplex kept " + !!k2 + ", shown for a duplex: " + (g2 ? g2.lines.join(" / ") : "none") };
  } },

  // ---- the bench's path (aiAct.solve) with a scripted model: the given is in the prompt, a broken rule goes back once --
  { id: "x-solve-back-once", harm: "high", run: async function (ctx) {
    var q = "Draw the control circuit for an air compressor with a pressure switch, cut out 125 psi", sent = [], first = "";
    var wrong = ctx.blk(["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 \x22cut-out 125 psi\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"], "Air compressor");
    var out = await ctx.L.aiAct.solve(q, function (msgs) { if (!first) first = msgs.map(function (m) { return typeof m.content === "string" ? m.content : ""; }).join("\n"); sent.push(typeof msgs[msgs.length - 1].content === "string" ? msgs[msgs.length - 1].content : ""); return Promise.resolve(wrong); });
    var ok = sent.length === 2 && /Write it: pressure PS1 M1 nc \x22cut-out 125 psi\x22/.test(sent[1]) && /tested circuit for this/.test(first) && !(out.made && out.made.ok);
    return { agree: ok, did: sent.length + " calls; the second: " + (sent[1] || "").slice(0, 300) + "; given in the first prompt: " + /tested circuit for this/.test(first) };
  } },
  { id: "x-solve-line-copied", harm: "high", run: async function (ctx) {
    var q = "Draw the control circuit for an air compressor with a pressure switch, cut out 125 psi", n = 0;
    var lines = ["switch SS1 M1 \x22on/off\x22", "pressure PS1 M1 \x22cut-out 125 psi\x22", "coil M1 \x22compressor starter\x22", "overload OL1 M1"];
    var out = await ctx.L.aiAct.solve(q, function (msgs) {
      n++; var last = typeof msgs[msgs.length - 1].content === "string" ? msgs[msgs.length - 1].content : "", m = /Write it: (.+?)\.?\n/.exec(last + "\n");
      if (m) lines = lines.map(function (l) { return /^pressure PS1/.test(l) ? m[1] : l; });
      return Promise.resolve(ctx.blk(lines, "Air compressor"));
    });
    return { agree: n === 2 && !!(out.made && out.made.ok), did: n + " calls, made " + (out.made && out.made.ok ? "ok" : "not ok: " + (out.made ? (out.made.problems || []).join(" | ") : "-")) };
  } },

  // ---- guards ------------------------------------------------------------------------------------------------------
  { id: "guard-bench-prompts", harm: "high", run: function (ctx) {
    var a = (ctx.L.aiBenchQuestions || []).concat(ctx.L.aiBenchQuestionsB || []), d = [], n = 0;
    var olds = {}; (ctx.Lold.aiBenchQuestions || []).concat(ctx.Lold.aiBenchQuestionsB || []).forEach(function (x) { olds[x.id] = String(ctx.Lold.aiAct.prompt(x.q)); });
    a.forEach(function (x) { n++; var p = String(ctx.L.aiAct.prompt(x.q)); if (!(x.id in olds)) d.push(x.id + " (new)"); else if (p !== olds[x.id] && !/^make-control(?:-b)?$/.test(x.id)) d.push(x.id); });
    return { agree: n >= 300 && !d.length, did: n + " bench prompts; differ from 1.24.35 outside make-control: " + (d.join(", ") || "none") };
  } },
  { id: "guard-saved-replies", harm: "high", run: function (ctx) {
    var fs = require("fs"), path = require("path"), dir = path.join(ctx.repo, "tests", "fixtures"), n = 0, d = [];
    fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).sort().forEach(function (f) {
      var j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
      var rows = Array.isArray(j) ? j : (j.rows || j.failed || Object.keys(j).map(function (k) { return j[k]; }));
      if (!Array.isArray(rows)) return;
      rows.forEach(function (r, i) {
        if (!r || typeof r !== "object" || typeof r.reply !== "string" || !/MAKE /.test(r.reply)) return;
        n++;
        function sig(L) { var m; try { m = L.aiAct.build(r.reply, r.q || ""); } catch (e) { return "ERR " + e.message; } return m ? JSON.stringify({ ok: !!m.ok, p: m.problems || [], s: m.summary || "" }) : "null"; }
        if (sig(ctx.L) !== sig(ctx.Lold)) d.push(f + "#" + i);
      });
    });
    return { agree: n > 800 && !d.length, did: n + " saved replies with a MAKE block; built otherwise than on 1.24.35: " + (d.join(", ") || "none") };
  } }
];
