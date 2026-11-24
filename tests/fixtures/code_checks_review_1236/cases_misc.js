// cases_misc.js -- the view and the saved choice, Lantern.store throwing, module drops, the bench guard, the saved
// replies, the code's form, and the references against the pages the reviewer opened. Each case: {id, harm, why,
// run(ctx) -> {agree, seen} or a Promise of it}. ctx = {file, L, o, lib, loadVariant(name) -> Promise of {L, o},
// old() -> Promise of {L, o} for 1.24.35 or null}.
"use strict";
var fs = require("fs"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, "..", "..", "..");
var RIGHT = ['estop ES1', 'stop PB1 M1', 'start PB2 M1', 'pressure PS1 M1 nc "high pressure cut-out"', 'coil M1 "compressor contactor"'];
var RQ = "Refrigeration compressor control";
var WRONG = ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'];
var X = [];
function c(id, harm, why, run) { X.push({ id: id, harm: harm, why: why, run: run }); }
function ok(b, seen) { return { agree: !!b, seen: b ? "" : seen }; }
function spanText(el) { var s = el && el.querySelector("span"); return s ? s.textContent : ""; }
function btnOf(el) { return el && el.querySelector("button"); }

// ------------------------------------------------------------------------------------------------ the view
var US_KEPT = ["PS1 opens as the pressure rises — NFPA 79, exceeding operating limits", "the overload OL1 on M1 — NEC Article 430, Part III",
  "the stop normally closed — NFPA 79, control functions in the event of failure", "the emergency stop ES1 ahead of every rung — NFPA 79, 10.7"];
var IEC_KEPT = ["PS1 opens as the pressure rises — IEC 60204-1:2016, 9.3.2", "the overload OL1 on M1 — IEC 60204-1:2016, 7.3",
  "the stop normally closed — IEC 60204-1:2016, 9.4", "the emergency stop ES1 ahead of every rung — IEC 60204-1:2016, 10.7"];
c("V-01", "medium", "under a drawing checked to US practice: what was kept, each with where it stands in NEC / NFPA 79, and a button to the other code", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, RIGHT, RQ), el = x.L.codeChecks.view(r), t = spanText(el), b = btnOf(el);
  if (!el) return ok(false, "no view");
  var miss = US_KEPT.filter(function (k) { return t.indexOf(k) < 0; });
  return ok(t.indexOf("Checked to US practice (NEC and NFPA 79): ") === 0 && !miss.length && !/IEC 60204/.test(t) && b && b.textContent === "Use IEC practice", "text " + JSON.stringify(t) + " missing " + JSON.stringify(miss) + " button " + (b && b.textContent));
});
c("V-02", "high", "the button shows it checked to IEC 60204-1 and saves the choice", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, RIGHT, RQ), el = x.L.codeChecks.view(r), b = btnOf(el);
  b.click();
  var t = spanText(el), saved = x.L.store.get("codes.practice", ""), miss = IEC_KEPT.filter(function (k) { return t.indexOf(k) < 0; });
  return ok(t.indexOf("Checked to IEC practice (IEC 60204-1): ") === 0 && !miss.length && !/NFPA|NEC\b/.test(t) && b.textContent === "Use US practice" && saved === "IEC", "text " + JSON.stringify(t) + " missing " + JSON.stringify(miss) + " button " + b.textContent + " saved " + saved);
});
c("V-03", "high", "the saved choice is followed by the next question that names neither code: what goes back to the model names IEC", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, RIGHT, RQ); btnOf(x.L.codeChecks.view(r)).click();
  var r2 = x.lib.build(x.L, WRONG, RQ), cb = x.lib.ccBacks(r2), r3 = x.lib.build(x.L, RIGHT, RQ);
  return ok(cb.length === 1 && cb[0].indexOf("(IEC practice: IEC 60204-1:2016, 9.3.2)") >= 0 && r3.codes.practice === "IEC", "back " + JSON.stringify(cb) + " practice " + (r3.codes && r3.codes.practice));
});
c("V-04", "high", "a question naming US practice after IEC was saved: US", function (x) {
  x.lib.setPractice(x.L, "IEC");
  var r = x.lib.build(x.L, RIGHT, "Control circuit for a 480 V refrigeration compressor");
  return ok(r.codes && r.codes.practice === "US", "practice " + (r.codes && r.codes.practice));
});
c("V-05", "medium", "pressed again: US saved and followed", function (x) {
  x.lib.setPractice(x.L, "");
  var el = x.L.codeChecks.view(x.lib.build(x.L, RIGHT, RQ)), b = btnOf(el);
  b.click(); b.click();
  var t = spanText(el), saved = x.L.store.get("codes.practice", ""), r = x.lib.build(x.L, RIGHT, RQ);
  return ok(saved === "US" && t.indexOf("Checked to US practice") === 0 && b.textContent === "Use IEC practice" && r.codes.practice === "US", "saved " + saved + " text " + t.slice(0, 60) + " button " + b.textContent);
});
c("V-06", "medium", "a 400 V question: the view is in IEC, its button offers US", function (x) {
  x.lib.setPractice(x.L, "");
  var el = x.L.codeChecks.view(x.lib.build(x.L, RIGHT, "Control circuit for a 400 V refrigeration compressor")), t = spanText(el), b = btnOf(el);
  return ok(t.indexOf("Checked to IEC practice (IEC 60204-1): ") === 0 && b.textContent === "Use US practice", "text " + t.slice(0, 80) + " button " + (b && b.textContent));
});
c("V-07", "medium", "Chat's view of the made thing (AI_ACTIONS view, Lantern.aiViewTools) shows the line and the button", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, RIGHT, RQ), box = x.L.aiAct.view(r), cd = box.querySelector(".la-codes");
  return ok(cd && cd.textContent.indexOf("Checked to US practice") === 0 && cd.querySelector("button"), "la-codes " + (cd ? cd.textContent.slice(0, 80) : "none"));
});
c("V-08", "medium", "a made thing with no codes (a sheet) is shown as before, with no line and nothing thrown", function (x) {
  var r = x.L.aiAct.build("MAKE SHEET: Shopping\nItem | Cost\nBread | 2\nMilk | 1\nEND", "Make a shopping list sheet");
  var box, err = "";
  try { box = x.L.aiAct.view(r); } catch (e) { err = e.message; }
  return ok(!err && box && !box.querySelector(".la-codes"), "err " + err + " codes " + (box && !!box.querySelector(".la-codes")));
});
c("V-09", "low", "view(null) and view({}) are null", function (x) {
  var a, b, err = "";
  try { a = x.L.codeChecks.view(null); b = x.L.codeChecks.view({}); } catch (e) { err = e.message; }
  return ok(!err && a === null && b === null, "err " + err);
});
c("V-10", "low", "nothing kept (a light on a selector): no line", function (x) {
  var r = x.lib.build(x.L, ['switch SS1 LT1', 'lamp LT1 "on" green'], "Wire a pilot light on a selector switch");
  return ok(r.ok && x.L.codeChecks.view(r) === null, "ok " + r.ok + " " + (r.problems || []).join(" | ") + " view " + !!x.L.codeChecks.view(r));
});
c("V-11", "high", "Lantern.store throwing on get and set: the circuit builds, US is followed, the view shows and its button switches without throwing", function (x) {
  return x.fresh().then(function (y) {
    y.L.store = { get: function () { throw new Error("get"); }, set: function () { throw new Error("set"); } };
    var r = x.lib.build(y.L, RIGHT, RQ), el, t1 = "", t2 = "", err = "", r2;
    try { el = y.L.aiAct.view(r).querySelector(".la-codes"); t1 = spanText(el); btnOf(el).click(); t2 = spanText(el); r2 = x.lib.build(y.L, WRONG, RQ); } catch (e) { err = e.message; }
    return ok(!err && r.ok && r.codes.practice === "US" && t1.indexOf("Checked to US") === 0 && t2.indexOf("Checked to IEC") === 0 && r2 && x.lib.ccBacks(r2).length === 1, "err " + err + " ok " + r.ok + " " + (r.problems || []).join(" | ").slice(0, 200) + " t1 " + t1.slice(0, 30) + " t2 " + t2.slice(0, 30));
  });
});
c("V-12", "high", "Lantern.store missing: the same", function (x) {
  return x.fresh().then(function (y) {
    y.L.store = undefined;
    var r = x.lib.build(y.L, RIGHT, RQ), el, t2 = "", err = "", p = "";
    try { el = y.L.aiAct.view(r).querySelector(".la-codes"); btnOf(el).click(); t2 = spanText(el); p = y.L.codeChecks.pick("Draw a motor starter"); } catch (e) { err = e.message; }
    return ok(!err && r.ok && t2.indexOf("Checked to IEC") === 0 && p === "US", "err " + err + " ok " + r.ok + " " + (r.problems || []).join(" | ").slice(0, 200) + " p " + p);
  });
});
c("V-13", "medium", "the kept line for a low cut-out and a fill's high cut-out says which way each opens", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, ['float FS1 M1 "dry run protection"', 'float FS2 M1 nc "high level cut-off"', 'coil M1 "transfer pump"'], "Transfer pump that fills a tank from a cistern");
  var t = x.L.codeChecks.line(r.codes, "US");
  return ok(t.indexOf("FS1 opens as the water falls") >= 0 && t.indexOf("FS2 opens as the water rises") >= 0, t);
});
c("V-14", "medium", "line(result, other practice) gives the other code's references for the same kept items", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, RIGHT, RQ), a = x.L.codeChecks.line(r.codes, "US"), b = x.L.codeChecks.line(r.codes, "IEC");
  return ok(a.split(";").length === b.split(";").length && /NFPA 79/.test(a) && /IEC 60204-1:2016/.test(b), a + " || " + b);
});
c("V-15", "low", "forward and reverse: the interlock is listed once, with 9.3.4 / interlocks for contrary motions", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, ['stop PB1', 'start PB2 M1', 'start PB3 M2', 'coil M1 "forward"', 'coil M2 "reverse"'], "Forward and reverse motor starter");
  var a = x.L.codeChecks.line(r.codes, "US"), b = x.L.codeChecks.line(r.codes, "IEC"), n = (a.match(/locked out/g) || []).length;
  return ok(n === 1 && /interlocks for contrary motions/.test(a) && /9\.3\.4/.test(b), a + " || " + b);
});

// ------------------------------------------------------------------------------------------------ module drops
function dropCase(id, names, expectCC) {
  c(id, "high", "the page without " + names.join(" and ") + ": loads, draws a control circuit as 1.24.35 did (a high cut-out written open is drawn as written), and Chat's view shows it", function (x) {
    return x.variant(names).then(function (y) {
      var errs = y.o.errs.slice(), r = x.lib.build(y.L, WRONG, RQ), box, err = "";
      try { box = y.L.aiAct.view(r); } catch (e) { err = e.message; }
      var hasCC = !!y.L.codeChecks;
      return ok(!errs.length && !err && r.ok && box && !box.querySelector(".la-codes") && hasCC === expectCC && x.lib.drawn(r, "PS1").length === 1, "errs " + JSON.stringify(errs) + " err " + err + " ok " + r.ok + " " + (r.problems || []).join(" | ").slice(0, 200) + " codeChecks " + hasCC);
    });
  });
}
dropCase("D-01", ["CODE_CHECKS_CONTROL"], true);
dropCase("D-02", ["CODE_CHECKS_CONTROL", "CODE_CHECKS"], false);
dropCase("D-03", ["CODE_CHECKS"], false);
c("D-04", "high", "a right circuit is drawn exactly as without the code checks (the checks never change a drawing): every right case of cases_circuits.js that builds", function (x) {
  var cases = require("./cases_circuits.js").filter(function (k) { return k.expect === "pass"; });
  return x.variant(["CODE_CHECKS_CONTROL", "CODE_CHECKS"]).then(function (y) {
    var diff = [];
    cases.forEach(function (k) {
      x.lib.setPractice(x.L, "");
      var a = x.lib.build(x.L, k.lines, k.q), b = x.lib.build(y.L, k.lines, k.q);
      if (!a.ok) return;   // sent back: judged in its own case
      if (JSON.stringify(a.plan.circuit) !== JSON.stringify(b.plan.circuit) || a.summary !== b.summary) diff.push(k.id);
    });
    return ok(!diff.length, "drawn otherwise: " + diff.join(", "));
  });
});

// ------------------------------------------------------------------------------------------------ the bench guard
function benchQs(L) { return (L.aiBenchQuestions || []).map(function (q) { return ["A", q.id, q.q]; }).concat((L.aiBenchQuestionsB || []).map(function (q) { return ["B", q.id, q.q]; })); }
function promptsCase(id, set) {
  c(id, "high", "no bench prompt of set " + set + " changes because of the code checks (L.aiAct.prompt(q) with and without the two modules)", function (x) {
    return x.variant(["CODE_CHECKS_CONTROL", "CODE_CHECKS"]).then(function (y) {
      var qs = benchQs(x.L).filter(function (t) { return t[0] === set; }), d = [];
      qs.forEach(function (t) { if (x.L.aiAct.prompt(t[2]) !== y.L.aiAct.prompt(t[2])) d.push(t[1]); });
      return ok(qs.length > 100 && !d.length, qs.length + " questions; differ: " + d.join(", "));
    });
  });
}
promptsCase("G-01", "A");
promptsCase("G-02", "B");
c("G-03", "low", "(for the record) the bench prompts that differ from 1.24.35 differ only by GIVENS: with GIVENS, GIVENS_CONTROL and the code checks taken out, every prompt is 1.24.35's", function (x) {
  return x.old().then(function (old) {
    if (!old) return ok(false, "1.24.35 could not be loaded (git show 8cb3281 failed): not run");
    return x.variant(["CODE_CHECKS_CONTROL", "CODE_CHECKS", "GIVENS_CONTROL", "GIVENS"]).then(function (y) {
      var qs = benchQs(x.L), d = [], dg = [];
      qs.forEach(function (t) { var po = old.L.aiAct.prompt(t[2]); if (y.L.aiAct.prompt(t[2]) !== po) d.push(t[1]); if (x.L.aiAct.prompt(t[2]) !== po) dg.push(t[1]); });
      x.note("G-03: prompts that differ from 1.24.35 on this build: " + (dg.join(", ") || "none") + "; without GIVENS too: " + (d.join(", ") || "none"));
      return ok(!d.length, "differ without GIVENS: " + d.join(", "));
    });
  });
});
// every saved model reply (bench_run*.json, and the 35B's own control replies kept elsewhere): any now questioned by a
// code check is listed and judged
function savedReplies() {
  var dir = path.join(ROOT, "tests", "fixtures"), out = [];
  function walk(v, file, at, q, ids) {
    if (Array.isArray(v)) { v.forEach(function (y, i) { walk(y, file, at + "[" + i + "]", q, ids); }); return; }
    if (!v || typeof v !== "object") return;
    var qq = typeof v.q === "string" ? v.q : typeof v.question === "string" ? v.question : (v.id && ids[v.id]) || q;
    ["reply", "first"].forEach(function (k) { if (typeof v[k] === "string" && /MAKE\s/i.test(v[k]) && qq) out.push({ file: file, at: at + "." + k, id: v.id || "", q: qq, text: v[k] }); });
    Object.keys(v).forEach(function (k) { if (k !== "reply" && k !== "first" && v[k] && typeof v[k] === "object") walk(v[k], file, at + "." + k, qq, ids); });
  }
  return function (L) {
    var ids = {};
    benchQs(L).forEach(function (t) { ids[t[1]] = t[2]; });
    var files = fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).concat(["liftstation_1230/run_35b.json", "review1_1256_setb.json"]);
    files.forEach(function (f) { try { walk(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), f, "", "", ids); } catch (e) { } });
    return out;
  };
}
var SAVED = savedReplies();
c("G-04", "high", "no saved model reply that built on 1.24.35 is now questioned by a code check (the replies of 83 bench runs and the 35B's lift station and set B replies)", function (x) {
  return x.old().then(function (old) {
    var rows = SAVED(x.L), q = [], ctl = 0;
    rows.forEach(function (r) {
      var b = null, a = null;
      try { b = x.L.aiAct.fromReply(r.text, r.q); } catch (e) { b = null; }
      if (!b) return;
      if (b.codes) ctl++;
      var cb = x.lib.ccBacks(b);
      if (!cb.length) return;
      if (old) { try { a = old.L.aiAct.fromReply(r.text, r.q); } catch (e) { a = null; } }
      q.push(r.file + r.at + " (" + r.id + ") built on 1.24.35: " + (a ? a.ok : "not run") + "; " + cb.join(" | "));
    });
    x.note("G-04: " + rows.length + " saved replies with a MAKE block; " + ctl + " made a control circuit and were checked; " + q.length + " questioned by a code check");
    return ok(!q.length, q.join(" || "));
  });
});
c("G-05", "high", "the saved control replies are drawn as without the code checks, and each shows a kept line that is true of its drawing", function (x) {
  return x.variant(["CODE_CHECKS_CONTROL", "CODE_CHECKS"]).then(function (y) {
    var rows = SAVED(x.L), bad = [], n = 0;
    rows.forEach(function (r) {
      var a = null, b = null;
      try { a = x.L.aiAct.fromReply(r.text, r.q); b = y.L.aiAct.fromReply(r.text, r.q); } catch (e) { return; }
      if (!a || !a.codes || !b) return;
      n++;
      if (!!a.ok !== !!b.ok || (a.plan && b.plan && JSON.stringify(a.plan.circuit) !== JSON.stringify(b.plan.circuit))) bad.push(r.file + r.at);
      var t = x.L.codeChecks.line(a.codes, "US");
      // the overload named in the kept line is drawn on that starter
      (t.match(/OL\d+ on [A-Z]+\d+/g) || []).forEach(function (s) { var m = /^(OL\d+) on (\S+)$/.exec(s), d = x.lib.drawn(a, m[1]); if (!d.some(function (e) { return e.out === m[2]; })) bad.push(r.file + r.at + " " + s); });
    });
    return ok(n > 0 && !bad.length, n + " checked; " + bad.join(", "));
  });
});

// ------------------------------------------------------------------------------------------------ what the model sees
// fixText is what goes back to the model; a single problem gets a full stop after it. The model copies the text after
// "Write it: " to the end of its line, full stop and all.
function copyCase(id, q, lines, devLine, wantNc, dev, practice) {
  c(id, "high", "the line in Lantern's correction (fixText), copied with what stands after it on its line, builds and is drawn right", function (x) {
    x.lib.setPractice(x.L, "");
    var r = x.lib.build(x.L, lines, q), t = x.L.aiAct.fixText(r, q), ls = t.split("\n").filter(function (l) { return /Write it: /.test(l); });
    if (!ls.length) return ok(false, "no Write it line in: " + t.slice(0, 300));
    var nl = lines.slice();
    ls.forEach(function (l, k) { nl[devLine[k]] = l.replace(/^.*Write it: /, ""); });
    var r2 = x.lib.build(x.L, nl, q), bad = [];
    Object.keys(wantNc).forEach(function (d) { x.lib.drawn(r2, d).forEach(function (e) { if (e.nc !== wantNc[d]) bad.push(d + " " + (e.nc ? "nc" : "no")); }); });
    var pr = practice ? ls.every(function (l) { return l.indexOf("(" + practice + " practice:") >= 0; }) : true;
    return ok(r2.ok && !bad.length && pr, "copied " + JSON.stringify(nl) + " -> " + (r2.problems || []).join(" | ").slice(0, 200) + " " + bad.join(","));
  });
}
copyCase("T-01", "Refrigeration compressor control", ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'], [0], { PS1: true });
copyCase("T-02", "Motor starter", ['button PB1 M1 "stop"', 'start PB2 M1', 'coil M1 "motor starter"'], [0], { PB1: true });
copyCase("T-03", "Boiler low water cut-off", ['float FS1 M1 nc "low water cut-off"', 'coil M1 "burner"'], [0], { FS1: false });
copyCase("T-04", "Refrigeration compressor control", ['pressure PS1 M1 "high pressure cut-out"', 'pressure PS2 M1 nc "low pressure cut-out"', 'coil M1 "compressor contactor"'], [0, 1], { PS1: true, PS2: false });
copyCase("T-05", "Control circuit for a 400 V refrigeration compressor", ['pressure PS1 M1 "high pressure cut-out"', 'coil M1 "compressor contactor"'], [0], { PS1: true }, null, "IEC");
copyCase("T-06", "Pump to fill a tank", ['float FS1 M1 "high level cut-off"', 'coil M1 "fill pump"'], [0], { FS1: true });
c("T-07", "medium", "the correction names the practice once and gives one line: never the other code's rules beside it", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, WRONG, RQ), t = x.L.aiAct.fixText(r, RQ);
  return ok((t.match(/practice:/g) || []).length === 1 && !/IEC 60204/.test(t) && (t.match(/Write it:/g) || []).length === 1, t.slice(0, 400));
});

c("T-08", "low", "a float in a diesel day tank: the correction speaks of the level, not of water", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, ['float FS1 M1 "high level cut-off"', 'coil M1 "fuel transfer pump"'], "Fuel transfer pump filling a diesel day tank"), cb = x.lib.ccBacks(r);
  return ok(cb.length === 1 && !/\bwater\b/.test(cb[0]), cb.join(" | "));
});

// ------------------------------------------------------------------------------------------------ Lantern's own blocks
// A given (GIVENS_CONTROL) is what the model is shown to copy; a station's control block is Lantern's own. Neither may be
// sent back by the code checks.
var GIVEN_QS = ["Draw a motor starter with start and stop buttons", "Draw a forward and reverse motor starter", "Draw a 480 V motor starter with a run light",
  "Draw the control circuit for an air compressor on its pressure switch, cut-out 125 psi", "Draw the control circuit for a compressor with a pressure switch",
  "Draw the control circuit for a 400 V air compressor on a pressure switch that cuts out at 8 bar", "Wire a pump to fill a tank with a float switch",
  "Draw a pump that fills a tank between a low float and a high float", "Draw the control circuit for a sump pump", "Draw a sump pump with a high water alarm horn",
  "Draw a conveyor where motor 2 can only start after motor 1 is running", "Draw a motor that starts 10 seconds after the start button is pressed",
  "Draw a motor starter with an emergency stop", "Draw a pump to keep a tank full with a float switch, 230/400 V"];
GIVEN_QS.forEach(function (q, k) {
  c("K-" + (k < 9 ? "0" : "") + (k + 1), "high", "the given Lantern shows for \"" + q + "\", written as it stands, passes the code checks", function (x) {
    x.lib.setPractice(x.L, "");
    var g = x.L.givens && x.L.givens.match("CONTROL", q), ls = g ? g.block(q) : null;
    if (!ls) return ok(true, "");   // no given for it: nothing to copy (the prompt has the example)
    var r = x.lib.build(x.L, ls, q), cb = x.lib.ccBacks(r);
    return ok(!cb.length && r.ok, (g ? g.id : "") + " " + JSON.stringify(ls) + " -> " + (r.problems || []).join(" | ").slice(0, 300));
  });
});
[["ST-01", "Draw a duplex lift station", "pumps 2\nfloats off lead lag alarm"], ["ST-02", "Draw a simplex lift station with one pump", "pumps 1\nfloats off lead alarm"],
 ["ST-03", "Draw a lift station with three pumps", "pumps 3\nfloats off lead lag alarm"], ["ST-04", "Draw a 400 V duplex sewage lift station", "pumps 2\nfloats off lead lag alarm\nsupply \"230 V AC\""],
 ["ST-05", "Draw a duplex storm water pump station", "pumps 2\nfloats off lead lag high alarm"]].forEach(function (s) {
  c(s[0], "high", "a station Lantern draws itself (\"" + s[1] + "\") is not sent back by the code checks", function (x) {
    x.lib.setPractice(x.L, "");
    var r = x.L.aiAct.build("MAKE STATION: Lift station\n" + s[2] + "\nEND", s[1]), ps = (r && r.problems) || [];
    return ok(r && !ps.some(function (p) { return x.lib.CC_RE.test(p); }), "problems: " + ps.join(" | ").slice(0, 300));
  });
});

// ------------------------------------------------------------------------------------------------ the code's form
function mods(x) { var src = fs.readFileSync(x.file, "utf8"); return ["CODE_CHECKS", "CODE_CHECKS_CONTROL"].map(function (n) { return { n: n, t: x.lib.moduleSpan(src, n).text }; }); }
c("S-01", "medium", "the two modules are ASCII only (non-ASCII written as escapes)", function (x) {
  var bad = []; mods(x).forEach(function (m) { var k = m.t.search(/[^\x00-\x7f]/); if (k >= 0) bad.push(m.n + " at " + k + ": " + JSON.stringify(m.t.slice(k - 20, k + 5))); });
  return ok(!bad.length, bad.join("; "));
});
c("S-02", "medium", "ES5: the two modules parse as ECMAScript 5 (no arrow functions, let, const, template literals)", function (x) {
  var acorn = require(path.join(ROOT, "node_modules", "acorn")), bad = [];
  mods(x).forEach(function (m) { try { acorn.parse(m.t, { ecmaVersion: 5 }); } catch (e) { bad.push(m.n + ": " + e.message); } });
  return ok(!bad.length, bad.join("; "));
});
c("S-03", "medium", "no quote character inside a regex literal in the two modules", function (x) {
  var acorn = require(path.join(ROOT, "node_modules", "acorn")), bad = [];
  mods(x).forEach(function (m) { acorn.parse(m.t, { ecmaVersion: 5, onToken: function (t) { if (t.type.label === "regexp" && /["']/.test(m.t.slice(t.start, t.end))) bad.push(m.n + ": " + m.t.slice(t.start, t.end)); } }); });
  return ok(!bad.length, bad.join("; "));
});
function runTest(name) {
  return function (x) {
    var r = cp.spawnSync(process.execPath, [path.join(ROOT, "tests", name), x.file], { encoding: "utf8", timeout: 120000 });
    var tail = String(r.stdout || "").trim().split("\n").slice(-2).join(" / ");
    return ok(r.status === 0, "exit " + r.status + ": " + tail + " " + String(r.stderr || "").slice(0, 200));
  };
}
c("S-04", "medium", "tests/regex_quotes.js passes on this build", runTest("regex_quotes.js"));
c("S-05", "medium", "tests/pc_compat.js passes on this build", runTest("pc_compat.js"));
c("S-06", "medium", "the hooks are feature-detected: AI_CONTROL asks Lantern.codeChecks only if it is there, in a try; AI_ACTIONS' view runs each view tool in a try", function (x) {
  var src = fs.readFileSync(x.file, "utf8"), ac = x.lib.moduleSpan(src, "AI_CONTROL").text, aa = x.lib.moduleSpan(src, "AI_ACTIONS").text;
  var a = /if \(L\.codeChecks && L\.codeChecks\.run\) \{ try \{ cc = L\.codeChecks\.run\(/.test(ac), b = /\(window\.Lantern\.aiViewTools \|\| \[\]\)[^\n]*try \{ n = f\(res\); \} catch \(e\) \{ n = null; \}/.test(aa);
  var dep = /\/\/ Depends: CODE_CHECKS \(Lantern\.codeChecks\)/.test(x.lib.moduleSpan(src, "CODE_CHECKS_CONTROL").text) && !/Depends:[^\n]*CODE_CHECKS/.test(ac.split("\n").slice(0, 6).join("\n"));
  return ok(a && b && dep, "AI_CONTROL hook " + a + ", AI_ACTIONS hook " + b + ", Depends without a circle " + dep);
});

// ------------------------------------------------------------------------------------------------ the references
// What the reviewer read on the pages (2026-11-24), word for word where quoted:
var READ = {
  "IEC 60204-1:2016, 7.3": "7.3 Protection of motors against overheating",
  "IEC 60204-1:2016, 9.3.2": "9.3.2 Exceeding operating limits",
  "IEC 60204-1:2016, 9.3.4": "9.3.4 Interlocks between different operations and for contrary motions",
  "IEC 60204-1:2016, 9.4": "9.4 Control functions in the event of failure",
  "IEC 60204-1:2016, 10.7": "10.7 Emergency stop devices",
  "NEC Article 430, Part III": "Art. 430, Part III provides the requirements for motor and branch-circuit overload protection.",
  "NFPA 79, 10.7": "10.7.3 Emergency Stop Actuators. Actuators of emergency stop devices shall be colored RED. / 10.7.4.3 ... shall also be permitted to serve the function of emergency stop."
};
// each reference Lantern shows, what it is shown for, and the words of the page it must fit
var SHOWN = [
  ["F-01", "IEC 60204-1:2016, 9.3.2", "a high or low cut-out", /operating limits/],
  ["F-02", "IEC 60204-1:2016, 7.3", "the overload on a motor starter", /motors against overheating/],
  ["F-03", "IEC 60204-1:2016, 9.4", "stops normally closed / a stop written open", /event of failure/],
  ["F-04", "IEC 60204-1:2016, 9.3.4", "two coils locked out of each other", /Interlocks .* contrary motions/],
  ["F-05", "IEC 60204-1:2016, 10.7", "the emergency stop ahead of every rung", /Emergency stop devices/],
  ["F-06", "NEC Article 430, Part III", "the overload on a motor starter", /overload protection/],
  ["F-07", "NFPA 79, 10.7", "the emergency stop ahead of every rung", /emergency stop/i]
];
SHOWN.forEach(function (s) {
  c(s[0], "high", "the reference " + s[1] + ", shown for " + s[2] + ", fits what its page says: " + READ[s[1]], function (x) {
    x.lib.setPractice(x.L, "");
    var r = x.lib.build(x.L, RIGHT.concat(['start PB3 M2', 'coil M2 "reverse"']).map(function (l) { return l === 'coil M1 "compressor contactor"' ? 'coil M1 "forward"' : l; }), RQ);
    var t = x.L.codeChecks.line(r.codes, "US") + " " + x.L.codeChecks.line(r.codes, "IEC");
    return ok(t.indexOf(s[1]) >= 0 && s[3].test(READ[s[1]]), "shown " + (t.indexOf(s[1]) >= 0) + ": " + t.slice(0, 200));
  });
});
c("F-08", "high", "the US references named by subject only are not given a section number (NFPA 79's 9.3.2, 9.3.4, 9.4 were not on any page read)", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, RIGHT.concat(['start PB3 M2', 'coil M2 "reverse"']).map(function (l) { return l === 'coil M1 "compressor contactor"' ? 'coil M1 "forward"' : l; }), RQ);
  var t = x.L.codeChecks.line(r.codes, "US"), w = x.lib.ccBacks(x.lib.build(x.L, WRONG, RQ)).join(" ") + " " + x.lib.ccBacks(x.lib.build(x.L, ['button PB1 M1 "stop"', 'start PB2 M1', 'coil M1 "motor"'], "Motor starter")).join(" ");
  var nums = (t + " " + w).match(/NFPA 79,? (?:section )?\d+(?:\.\d+)*/g) || [];
  return ok(nums.every(function (n) { return /10\.7$/.test(n); }) && /NFPA 79, exceeding operating limits/.test(w) && /NFPA 79, control functions in the event of failure/.test(w), "numbers " + JSON.stringify(nums) + " / " + w.slice(0, 300));
});
c("F-09", "low", "IEC 60204-1's scope, on the page read: \"applies to electrical, electronic and programmable electronic equipment and systems to machines not portable by hand while working\". Lantern cites it, and NFPA 79 (industrial machinery), for any circuit, a house's frost stat, a boiler's high limit and a domestic well pump's pressure switch among them; the rule (which way a cut-out opens) holds, the code named may not be the one that governs that equipment", function (x) {
  x.lib.setPractice(x.L, "");
  var r = x.lib.build(x.L, ['pressure PS1 M1 "cut-out 50 psi"', 'coil M1 "well pump"'], "Domestic well pump with a pressure switch");
  var cb = x.lib.ccBacks(r).join(" ");
  return ok(!/NFPA 79|IEC 60204/.test(cb), cb);
});

module.exports = X;
