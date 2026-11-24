// code_checks_1236.js -- code checks and the user's own givens (1.24.36). Adam, 2026-11-24: "There should be a way for the
// AI to make modifications that do apply in a way where the AI and user can work to make custom changes as long as they
// are code approved"; on which code: "there should be a reference to both that the user can see presented and choose
// which code section to follow as applicable". A control circuit the AI writes is checked (CODE_CHECKS_CONTROL): a rule
// broken goes back once, with the rule in the practice followed and the line to write; what was kept is shown under the
// drawing with where it stands, US or IEC, a tap apart. A circuit made clean can be kept as the user's own given.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os");
var load = require(path.join(__dirname, "fixtures", "liftstation_review1_1230", "load.js"));
var SRC = process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html");
var passes = 0, fails = 0;
function ok(name, cond, info) { if (cond) { passes++; console.log("ok   " + name); } else { fails++; console.log("FAIL " + name + (info !== undefined ? "\n     " + JSON.stringify(info).slice(0, 1500) : "")); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function strip(src, names) { names.forEach(function (n) { var a = src.indexOf("// MODULE: " + n + " - START"), b = src.indexOf("// MODULE: " + n + " - END"); if (a > 0 && b > a) src = src.slice(0, a) + src.slice(b); }); return src; }
(async function () {
  var o = load(SRC), L = o.L;
  await sleep(80);
  var C = L.codeChecks, G = L.givens, act = L.aiAct;
  ok("boot clean; the code checks are there, and the Morse codes (Lantern.codes) are as they were", o.errs.length === 0 && C && C.all("CONTROL").length >= 3 && L.codes && typeof L.codes.morse === "function", o.errs);
  function made(q, ls) { return act.build("MAKE CONTROL: Test\n" + ls.join("\n") + "\nEND", q); }
  // what goes back once, with the rule and the line
  var m1 = made("Draw a compressor control circuit", ["pressure PS1 M1 \x22high pressure cutout\x22", "coil M1 \x22compressor starter\x22"]);
  ok("a high pressure cut-out written normally open: back once, with the reason, the US rule and the line with nc", m1 && !m1.ok && !m1.plan && /PS1 .*high cut-out drawn normally open: M1 would run only while the pressure is above it.*\(US practice: NFPA 79, exceeding operating limits\)\. Write it: pressure PS1 M1 nc \x22high pressure cutout\x22$/.test(m1.problems[0] || ""), m1 && m1.problems);
  var m2 = made("Draw a refrigeration compressor control", ["pressure PS1 M1 nc \x22low pressure cut-out\x22", "coil M1 \x22compressor contactor\x22"]);
  ok("a low pressure cut-out written normally closed: back once, the line without nc", m2 && !m2.ok && /Write it: pressure PS1 M1 \x22low pressure cut-out\x22$/.test(m2.problems[0] || ""), m2 && m2.problems);
  var m3 = made("Draw the control circuit for an air compressor with a pressure switch", ["stop PB1 M1", "start PB2 M1", "pressure PS1 M1 \x22cut-out 120 psi\x22", "coil M1 \x22compressor starter\x22"]);
  ok("an air compressor's pressure switch named for its cut-out alone, written normally open: back with nc", m3 && !m3.ok && /Write it: pressure PS1 M1 nc \x22cut-out 120 psi\x22$/.test(m3.problems[0] || ""), m3 && m3.problems);
  var m4 = made("Draw a motor starter", ["button PB1 M1 \x22stop\x22", "start PB2 M1", "coil M1 \x22motor starter\x22"]);
  ok("a stop written as a normally open button beside a start: back with the stop's line", m4 && !m4.ok && /Write it: stop PB1 M1$/.test(m4.problems[0] || ""), m4 && m4.problems);
  // what is left as written: not sure which way it cuts out, an alarm on a high switch, a fill's low start float
  [["Draw a refrigeration compressor control", ["pressure PS1 M1 \x22cut-out 20 psi\x22", "coil M1 \x22compressor contactor\x22"]],
   ["Draw a high pressure alarm", ["pressure PS1 LT1 \x22high pressure cutout\x22", "lamp LT1 PS1 \x22high pressure\x22 red"]],
   ["Draw a boiler control", ["temp TS1 M1 \x22thermostat\x22", "coil M1 \x22burner relay\x22"]],
   ["Draw the control circuit for a pump that fills a tank with a high and a low float", ["switch SS1 M1 \x22on/off\x22", "float FS1 M1 nc \x22low level start\x22", "float FS2 M1 nc \x22high level stop\x22", "coil M1 \x22pump starter\x22", "overload OL1 M1"]],
   ["Draw the control circuit for a duplex lift station", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]],
   ["Draw a high/low pressure switch", ["pressure PS1 M1 \x22high/low pressure cut-out\x22", "coil M1 \x22compressor contactor\x22"]]].forEach(function (c) {
    var m = made(c[0], c[1]);
    ok("left as written: " + c[1][0], m && m.ok, m && m.problems);
  });
  // a rule kept is shown with where it stands, in the practice followed, and the other a tap away
  var rv = made("Draw a forward/reverse motor control circuit", ["estop ES1", "stop PB1 all", "start PB2 M1 \x22forward\x22", "start PB3 M2 \x22reverse\x22", "coil M1 \x22forward\x22", "coil M2 \x22reverse\x22", "interlock M1 M2", "overload OL1 M1 M2"]);
  var us = rv && rv.codes ? C.line(rv.codes, "US") : "", iec = rv && rv.codes ? C.line(rv.codes, "IEC") : "";
  ok("checked to US practice: the overload (NEC Article 430, Part III), the stop, the interlock, the e-stop (NFPA 79, 10.7)", rv && rv.ok && rv.codes.practice === "US" && /NEC Article 430, Part III/.test(us) && /M1 and M2 locked out of each other — NFPA 79, interlocks for contrary motions/.test(us) && /ES1 ahead of every rung — NFPA 79, 10\.7/.test(us), us);
  ok("the same, to IEC practice: IEC 60204-1:2016 7.3, 9.4, 9.3.4, 10.7", /7\.3/.test(iec) && /9\.4\b/.test(iec) && /9\.3\.4/.test(iec) && /10\.7/.test(iec) && !/NFPA|NEC/.test(iec), iec);
  var v = act.view(rv), btn = Array.prototype.slice.call(v.querySelectorAll("button")).filter(function (b) { return /^Use IEC practice$/.test(b.textContent); })[0];
  ok("under the drawing: what it was checked to, and a button for the other code", btn && /Checked to US practice \(NEC and NFPA 79\)/.test(v.textContent), v.textContent.slice(-500));
  btn.onclick();
  ok("the button shows it checked to IEC and keeps IEC for questions that name neither", /Checked to IEC practice \(IEC 60204-1\)/.test(v.textContent) && C.saved() === "IEC" && C.pick("Draw a motor starter") === "IEC" && /Use US practice/.test(btn.textContent));
  var m5 = made("Draw a compressor control circuit", ["pressure PS1 M1 \x22high pressure cutout\x22", "coil M1 \x22compressor starter\x22"]);
  ok("chosen IEC: the line sent back names IEC 60204-1 only", /\(IEC practice: IEC 60204-1:2016, 9\.3\.2\)/.test(m5.problems[0] || "") && !/NFPA/.test(m5.problems[0] || ""), m5.problems);
  C.choose("US");
  ok("the question's own words win: IEC, 400 V or 50 Hz is IEC; NEC, 120 V or 60 Hz is US; a French drain is no country", C.pick("Draw an IEC motor starter") === "IEC" && C.pick("Draw a 400 V motor starter for Germany") === "IEC" && C.pick("Draw a starter, 50 Hz") === "IEC" &&
    C.pick("Draw a starter to NEC") === "US" && C.pick("Draw a 120 V starter") === "US" && C.pick("Draw the pump control for a French drain") === "US" && C.pick("Draw a starter for us please") === "US");
  // keep as my given
  var q = "Draw a start/stop circuit for a 24 VAC fan contactor with a green run light";
  var fan = made(q, ["supply \x2224 V AC\x22", "stop PB1 M1", "start PB2 M1", "coil M1 \x22fan contactor\x22", "overload OL1 M1", "lamp LT1 M1 \x22fan on\x22 green"]);
  var fv = act.view(fan), kb = Array.prototype.slice.call(fv.querySelectorAll("button")).filter(function (b) { return /^Keep as my given$/.test(b.textContent); })[0];
  ok("a control circuit made clean and checked: “Keep as my given” under it, after the code line", kb && fv.textContent.indexOf("Checked to") < fv.textContent.indexOf("Keep as my given"), fv.textContent.slice(-300));
  ok("nothing to keep under a circuit sent back", !/Keep as my given/.test(act.view(m1).textContent));
  kb.onclick();
  var mine = G.mine();
  ok("kept: the block as written, the question's words, stored", mine.length === 1 && mine[0].kept.lines.join("|") === fan.block.lines.join("|") && /Forget it/.test(fv.textContent) && (L.store.get("givens.user", []) || []).length === 1, mine.map(function (g) { return g.kept; }));
  var p = act.prompt("Draw a start stop circuit for a fan contactor, 24 VAC, with a green run light");
  ok("a question like it is shown the user's own, above Lantern's given", /Your own kept circuit for this \(kept \d{4}-\d\d-\d\d, checked to US practice\): write it as it stands, changing only what the question asks:\nMAKE CONTROL: Test\nsupply \x2224 V AC\x22/.test(p) && !/Lantern’s tested circuit/.test(p), p.slice(-500));
  ok("a question unlike it is not", !/Your own kept circuit/.test(act.prompt("Draw a forward/reverse motor control circuit with interlocks")) && !/Your own kept circuit/.test(act.prompt("Draw a start/stop motor starter")));
  // (the fifth review) kept from a question that asked a run light: not for one that asks none, nor one with an e-stop
  ok("not for the same circuit asked without its light, nor with an e-stop it lacks", !/Your own kept circuit/.test(act.prompt("Draw a start stop circuit for a fan contactor, 24 VAC")) && !/Your own kept circuit/.test(act.prompt("Draw a start stop circuit for a fan contactor, 24 VAC, with a green run light and an e-stop")));
  // loaded at start
  var keptStore = L.store.get("givens.user", []);
  var src2 = fs.readFileSync(SRC, "utf8").replace("Lantern.store = (function () {", "try { localStorage.setItem(\x22lantern.givens.user\x22, " + JSON.stringify(JSON.stringify(keptStore)) + "); } catch (e) {}\nLantern.store = (function () {");
  var tmp = path.join(os.tmpdir(), "givens_kept_1236.html"); fs.writeFileSync(tmp, src2);
  var o3 = load(tmp), L3 = o3.L; await sleep(60);
  ok("a kept given is loaded at start, from the store", keptStore.length === 1 && o3.errs.length === 0 && L3.givens.mine().length === 1 && /Your own kept circuit/.test(L3.aiAct.prompt("Draw a start stop circuit for a fan contactor, 24 VAC, with a green run light")), [keptStore.length, L3.givens.mine().length, o3.errs]);
  // forget
  var fb = Array.prototype.slice.call(fv.querySelectorAll("button")).filter(function (b) { return /^Forget it$/.test(b.textContent); })[0];
  fb.onclick();
  ok("“Forget it” takes it out, from the store too", G.mine().length === 0 && (L.store.get("givens.user", []) || []).length === 0 && /Keep as my given/.test(fv.textContent) && !/Your own kept circuit/.test(act.prompt("Draw a start stop circuit for a fan contactor, 24 VAC")));
  // a lift station's question is shown a kept duplex, never Lantern's single-circuit givens
  var dq = "Draw the control circuit for the Main Street duplex lift station";
  var dx = made(dq, ["supply \x22120 V AC\x22", "float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22", "lamp LT3 FS4 \x22high level\x22 red"]);
  var kept = G.keep(dx, dq);
  ok("a duplex lift station kept is shown for that station's question; Lantern's own givens never for a pump station", kept && /Your own kept circuit[^\n]*\nMAKE CONTROL: Test\nsupply/.test(act.prompt("Draw the control circuit for the Main Street duplex lift station again")) &&
    !/tested circuit|Your own kept/.test(act.prompt("Draw the control circuit for a duplex lift station with an alternating relay")), act.prompt("Draw the control circuit for the Main Street duplex lift station again").slice(-400));
  G.forget(kept.id);
  // droppable
  var full = fs.readFileSync(SRC, "utf8");
  [["CODE_CHECKS_CONTROL"], ["CODE_CHECKS", "CODE_CHECKS_CONTROL"], ["GIVENS", "GIVENS_CONTROL"]].forEach(function (names) {
    var f = path.join(os.tmpdir(), "cc_drop_" + names.join("_") + ".html"); fs.writeFileSync(f, strip(full, names));
    var od = load(f); var md = od.L.aiAct.build("MAKE CONTROL: T\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\nEND", "Draw a motor starter");
    ok("without " + names.join(" and ") + ": boots clean, a starter is made and shown", od.errs.length === 0 && md && md.ok && od.L.aiAct.view(md), od.errs);
  });
  console.log(fails ? fails + " CODE CHECKS 1.24.36 FAILURES (" + passes + " passed)" : "ALL CODE CHECKS 1.24.36 PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
