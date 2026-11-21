// cases_d.js -- D: AI_CONTROL's new rules (1.24.31). A duplex (an alternator with two pumps) written with no floats gets
// the usual four only for a wet well's pumps (a lift station, sewage, a sump, storm water named in the question or on the
// coils); two alarm floats each keep their own light. Right circuits must not change: each is compared with 1.24.30
// (before.json, made by make_before.js from commit ad0d654) and simulated (sim.js).
"use strict";
var H = require("./lib.js");
function ctl(lines) { return H.blk("CONTROL", "Duplex", lines); }
var DUP = ["alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"];
// a duplex simulated with its floats found by label: the block's own (MAKE CONTROL's parse) and those Lantern added (its
// "added" text names each, FS2 (lead on))
function duplexSim(r, block, extra) {
  if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "no block");
  var c = r.plan.circuit, lab = {}, J = H.L().aiControl.floatJob, m, re = /\b((?:FS|LS)[A-Z]{0,2}\d+) \(([^)]+)\)/g, t = (c.added || []).join(" | ");
  while ((m = re.exec(t))) if (!lab[m[1]]) lab[m[1]] = m[2];
  (H.L().aiControl.parse({ lines: block.split("\n").slice(1, -1) }).items || []).forEach(function (it) { if (it.role === "float" && it.id) lab[it.id] = it.label || lab[it.id] || ""; });
  var used = {}, job = {}, other = [];
  c.rungs.forEach(function (g) { H.contactsOf(g).forEach(function (e) { if (e.kind === "float") used[e.id] = 1; }); });
  Object.keys(used).forEach(function (id) { var j = J(lab[id] || ""); if (j === "alarm" && /\blag\b/i.test(lab[id] || "")) j = "lag"; if (j === "alarm" && job.alarm) other.push([id, 5]); else if (j && !job[j]) job[j] = id; });
  var st = H.starters(c);
  var alarms = job.alarm ? H.litBy(c, "lamp", job.alarm).concat(H.litBy(c, "horn", job.alarm)) : [];
  var runL = {}, ols = {};
  H.outsOf(c, "lamp").forEach(function (g) { H.contactsOf(g).forEach(function (e) { if (e.kind === "contact" && st.indexOf(e.of) >= 0 && !e.nc) runL[g.out.id] = e.of; }); });
  c.rungs.forEach(function (g) { if (st.indexOf(g.out.id) >= 0) H.contactsOf(g).forEach(function (e) { if (e.kind === "ol") ols[e.id] = g.out.id; }); });
  var p = H.sim.duplex(c, { floats: { off: job.off, lead: job.lead, lag: job.lag, alarm: job.alarm }, otherFloats: other, pumps: st, alarms: alarms, runLamps: runL, ols: ols });
  return p.concat(extra ? [extra(c, job, other)] : []).filter(function (x) { return x; }).join("; ");
}
function added(r) { return r && r.plan && r.plan.circuit ? (r.plan.circuit.added || []).join(" | ") : ""; }
function floatsAdded(r) { return /from the bottom up: the pumps need a float to start them and one to stop them, and these are a duplex/.test(added(r)); }
function sameAsBefore(id, r) { var b = H.before("ctl:" + id); return b === undefined || H.sig(r) === b ? "" : "differs from 1.24.30: " + H.sig(r).replace(/\n/g, " / ") + " (1.24.30: " + String(b).replace(/\n/g, " / ") + ")"; }
function D(id, harm, q, lines, right, judge) {
  return H.C(id, harm, { question: q, block: ctl(lines) }, right, function () { var r = H.build(this.input.block, q); return judge(r, id, this.input.block); });
}
// the usual four added and the duplex works
function four(r, id, block) { return !floatsAdded(r) ? "no floats added (" + (r.ok ? added(r) : r.problems.join("; ")) + ")" : duplexSim(r, block); }
// nothing added: goes back for floats as in 1.24.30
function none(r, id) { return floatsAdded(r) ? "the usual floats were added: " + added(r) : sameAsBefore(id, r); }
var LS = "draw the control circuit for a duplex lift station with an alternating relay";
var cases = [
  D("D-01", "high", LS, DUP, "A lift station's duplex with no floats: the four added (off, lead on, lag on, high level alarm), said, and it works.", four),
  D("D-02", "high", "Draw the ladder diagram for a duplex sewage pump station with an alternator", DUP, "Sewage named: the four added.", four),
  D("D-03", "medium", "Draw the control circuit for two storm water pumps that alternate", DUP, "Storm water named: the four added.", four),
  D("D-04", "medium", "Draw the control circuit for a duplex sump pump system with an alternating relay", DUP, "A sump: the four added.", four),
  D("D-05", "medium", "Draw an alternator circuit for two pumps", ["alternator AR M1 M2", "coil M1 \x22sewage pump 1\x22", "coil M2 \x22sewage pump 2\x22"], "Sewage named on the coils: the four added.", four),
  D("D-06", "high", "Draw a control circuit with an alternating relay for two pumps", DUP, "Nothing says a wet well (a booster, a fountain, a cooling loop?): no floats added; back as in 1.24.30.", none),
  D("D-07", "high", "Draw the control for a duplex booster pump station with an alternating relay", DUP, "Booster pumps: no floats.", none),
  D("D-08", "high", "Draw the control for duplex air compressors with an alternator", ["alternator AR M1 M2", "coil M1 \x22compressor 1\x22", "coil M2 \x22compressor 2\x22"], "Compressors: no floats.", none),
  D("D-09", "medium", "Draw a duplex pump control with an alternating relay for the cooling tower sump", DUP, "A cooling tower's basin: unsure, so no floats.", none),
  D("D-10", "medium", "Draw the control for the lift station's two ventilation fans, alternating with an alternator relay", ["alternator AR M1 M2", "coil M1 \x22fan 1 starter\x22", "coil M2 \x22fan 2 starter\x22"], "Fans at a lift station: no floats.", none),
  D("D-11", "medium", "Draw an alternator circuit for the two standby generators at the lift station", ["alternator AR M1 M2", "coil M1 \x22generator 1 start\x22", "coil M2 \x22generator 2 start\x22"],
    "Generators at a lift station alternate for wear; they are not a wet well's pumps. Floats must not be added (rule 7: what else can it be -- the question names generators).", none),
  D("D-12", "medium", "Draw the alternating control for the lift station's two odor control units", ["alternator AR M1 M2", "coil M1 \x22odor unit 1\x22", "coil M2 \x22odor unit 2\x22"],
    "Odor control units at a lift station: not pumps; floats must not be added.", none),
  D("D-13", "medium", "Draw the alternating relay circuit for the two heaters in the lift station's control building", ["alternator AR M1 M2", "coil M1 \x22heater 1 contactor\x22", "coil M2 \x22heater 2 contactor\x22"],
    "Heaters: not a wet well's pumps; no floats.", none),
  D("D-14", "medium", LS, DUP.concat(["lamp LT3 \x22high level alarm\x22 red"]), "An alarm light with no float: the four added, the light on the alarm float (FS4), no second alarm light.",
    function (r, id, b) { var s = four(r, id, b); if (s) return s; var lt = H.outsOf(r.plan.circuit, "lamp").filter(function (g) { return /alarm|high/.test(g.out.label); }); return lt.length === 1 ? "" : lt.length + " alarm lights"; }),
  D("D-15", "medium", LS, DUP.concat(["lamp LT3 FS4 \x22high level\x22 red"]), "An alarm light naming FS4, not written: the four added with FS4 the alarm, lit by it.",
    function (r, id, b) { var s = four(r, id, b); if (s) return s; return H.litBy(r.plan.circuit, "lamp", "FS4").join() === "LT3" ? "" : "LT3 not lit by FS4"; }),
  D("D-16", "medium", LS, DUP.concat(["pressure PS1 M1", "pressure PS2 M2"]), "Pressure switches (a bubbler): not floats; nothing added, back as 1.24.30.", none),
  D("D-17", "high", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22"].concat(DUP), "Floats written (no lag, no alarm): nothing added; as 1.24.30.", function (r, id, b) { return none(r, id) || duplexSim(r, b); }),
  D("D-18", "medium", LS, ["float FS2 \x22lead on\x22"].concat(DUP), "A lead float and no off float: back for the off float, nothing added (as 1.24.30).", none),
  D("D-19", "high", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22"].concat(DUP, ["lamp LT1 M1 \x22pump 1 run\x22 green", "lamp LT2 M2 \x22pump 2 run\x22 green", "lamp LT3 FS4 \x22high level\x22 red"]),
    "The guide's own duplex: as 1.24.30, and it works.", function (r, id, b) { return sameAsBefore(id, r) || duplexSim(r, b); }),
  D("D-20", "medium", "Draw the control circuit for two sump pumps that take turns, for the basement", DUP, "Two sump pumps that take turns: a sump: the four added.", four),
  // ---- two alarm floats, each its own light -------------------------------------------------------------------
  D("D-21", "medium", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "float FS5 \x22high high alarm\x22"].concat(DUP, ["lamp LT3 FS4 \x22high level\x22 red", "lamp LT4 FS5 \x22high high level\x22 red"]),
    "Two alarms, a light each: LT3 at FS4 only, LT4 at FS5 only.",
    function (r, id, b) { if (!r.ok) return r.problems.join("; "); var c = r.plan.circuit; return H.litBy(c, "lamp", "FS4").join() === "LT3" && H.litBy(c, "lamp", "FS5").join() === "LT4" ? duplexSim(r, b) : "LT3 by FS4: " + H.litBy(c, "lamp", "FS4") + ", by FS5: " + H.litBy(c, "lamp", "FS5"); }),
  D("D-22", "low", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS4 \x22high level alarm\x22", "float FS5 \x22high high alarm\x22"].concat(DUP, ["lamp LT3 FS4 FS5 \x22alarm\x22 red"]),
    "One light naming both alarms: lit by either.", function (r) { if (!r.ok) return r.problems.join("; "); var g = H.rungOf(r.plan.circuit, "LT3"); return g && g.branches && g.branches.length === 2 ? "" : "LT3 " + JSON.stringify(g && (g.branches || g.series)); }),
  D("D-23", "medium", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS4 \x22high level alarm\x22", "float FS5 \x22high high alarm\x22"].concat(DUP, ["lamp LT3 FS4 \x22high level\x22 red", "horn AH1 FS5 \x22high high\x22"]),
    "A light on the high level alarm, a horn on the high high: each its own.", function (r) { if (!r.ok) return r.problems.join("; "); var c = r.plan.circuit; return H.litBy(c, "lamp", "FS4").join() === "LT3" && H.litBy(c, "horn", "FS5").join() === "AH1" && !H.litBy(c, "horn", "FS4").length ? "" : "horn on " + H.litBy(c, "horn", "FS4") + "/" + H.litBy(c, "horn", "FS5"); }),
  D("D-24", "medium", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on / alarm\x22", "float FS4 \x22high level alarm\x22"].concat(DUP, ["lamp LT3 FS4 \x22high level\x22 red"]),
    "FS3 is the lag float and an alarm ('lag on / alarm', a small panel's): as 1.24.30, a light it names (LT3) is lit by either alarm float; with the new rule LT3 is FS4's alone, and FS3's alarm lights nothing.",
    function (r) { if (!r.ok) return r.problems.join("; "); var c = r.plan.circuit; return H.litBy(c, "lamp", "FS3").length || H.litBy(c, "horn", "FS3").length ? "" : "FS3 (lag on / alarm) lights no alarm: " + H.sig(r).replace(/\n/g, " / "); }),
  D("D-25", "low", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS4 \x22high level alarm\x22", "float FS5 \x22high high alarm\x22"].concat(DUP, ["lamp LT3 \x22high level alarm\x22 red"]),
    "Two alarms and a light naming neither: either sets it off, said (as 1.24.30).", function (r, id) { return sameAsBefore(id, r); }),
  D("D-26", "low", LS, ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22high level alarm\x22"].concat(DUP, ["lamp LT3 FS3 \x22high level\x22 red"]), "One alarm and its light: as 1.24.30.", function (r, id, b) { return sameAsBefore(id, r) || duplexSim(r, b); }),
  // ---- circuits that are not duplexes, in a lift station's question: as 1.24.30 -------------------------------------
  D("D-27", "medium", "Draw the control circuit for the lift station's sump pump with a float", ["float FS1 M1", "coil M1 \x22sump pump\x22"], "A simplex on one float: as 1.24.30.", function (r, id) { return sameAsBefore(id, r); }),
  D("D-28", "medium", "Draw a motor starter for the lift station's grit conveyor", ["stop PB1 M1", "start PB2 M1", "coil M1 \x22conveyor starter\x22"], "A motor starter: as 1.24.30.", function (r, id) { return sameAsBefore(id, r); }),
  D("D-29", "medium", "Draw the control for the lift station's two pumps, each with its own hand start and stop", ["stop PB1 M1", "start PB2 M1", "stop PB3 M2", "start PB4 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"], "Two hand starters, no alternator: as 1.24.30.", function (r, id) { return sameAsBefore(id, r); }),
  D("D-30", "medium", LS, ["alternator AR", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22", "coil M3 \x22pump 3 starter\x22"], "Three starters on one alternator: said not drawn yet; no floats added over it.", function (r) { return !r.ok && /takes turns between 3 pumps/.test(r.problems.join(" ")) ? "" : "problems: " + (r.problems || []).join("; "); })
];
module.exports = cases;
