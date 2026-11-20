// cases_control.js -- rule A: MAKE CONTROL's alternating relay (and plain control circuits left as they were).
// Each case: id, rule, right (the input is a RIGHT answer a model could write), why (what is right, and why), harm (if
// Lantern does otherwise), and the check (type and its data; see replay.js).
"use strict";
var path = require("path"), fs = require("fs");
var RUN = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "liftstation_1230", "run_35b.json"), "utf8"));
var BEFORE = JSON.parse(fs.readFileSync(path.join(__dirname, "plain_before.json"), "utf8"));
function lines(block) { return block.split("\n").slice(1, -1); }
var STD = { off: "FS1", lead: "FS2", lag: "FS3", alarm: "FS4" };
var F4 = ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22"];
var F3 = ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22high level alarm\x22"];
var PUMPS = ["coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"];
var OLS = { OL1: "M1", OL2: "M2" };
function dup(id, lns, sim, why, more) { var c = { id: id, rule: "A", right: true, type: "duplex", lines: lns, sim: sim, why: why, harm: "high" }; Object.keys(more || {}).forEach(function (k) { c[k] = more[k]; }); return c; }
// what a refusal must not also say: the generic lines that contradict the duplex line (a float put on the alternator,
// a start button for a pump, a coil with "nothing switching it" that Lantern would have wired itself)
var MISLEAD = ["name the coil or light it switches, like: float \\w+ AR", "start PB2 (AR|M1|M2|CR1)", "has nothing switching it"];
function ref(id, lns, want, why, more) { var c = { id: id, rule: "A", right: false, type: "refuse", lines: lns, want: want, mislead: MISLEAD, why: why, harm: "medium" }; Object.keys(more || {}).forEach(function (k) { c[k] = more[k]; }); return c; }
// lamp state against the alternator: "pump 1 lead" must be lit while pump 1 is the one that starts next
function leadLamps(map) {
  return function (m, ctx) {
    var sim = require("./sim.js"), at = { FS1: 1, FS2: 2 }, S = sim.make(m.plan.circuit, function (id) { return at[id] == null ? null : at[id]; }), bad = [];
    for (var c = 0; c < 2; c++) {
      S.set(0.5); var lit = Object.keys(map).filter(function (l) { return S.on(l); });
      S.set(2.5); var runs = ["M1", "M2"].filter(function (p) { return S.on(p); })[0];
      Object.keys(map).forEach(function (l) { if ((lit.indexOf(l) >= 0) !== (map[l] === runs)) bad.push(l + " (" + map[l] + " lead) is " + (lit.indexOf(l) >= 0 ? "lit" : "dark") + " before a cycle that " + runs + " leads"); });
      S.set(0.5);
    }
    return bad.length ? bad.join("; ") : null;
  };
}
function tripLamps(map) {
  return function (m) {
    var sim = require("./sim.js"), S = sim.make(m.plan.circuit, function () { return null; }), bad = [];
    S.set(0);
    Object.keys(map).forEach(function (l) { if (S.on(l)) bad.push(l + " (" + map[l] + " tripped) is lit with nothing tripped"); S.trip(map[l]); if (!S.on(l)) bad.push(l + " is dark with " + map[l] + " tripped"); S.trip(map[l], false); });
    return bad.length ? bad.join("; ") : null;
  };
}

var C = [];
// ---- the 35B's own blocks --------------------------------------------------------------------------------------
C.push(dup("A-35b-block1", lines(RUN.replies[1].reply), { floats: { off: "FS2", lead: "FS1", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" }, ols: OLS },
  "The 35B's first block (alternating AR M1 M2; floats start high / stop low / alarm high high written on M1; LT3 \x22alarm\x22 on AR) is a right duplex in what it names: drawn as the usual duplex, LT3 on the alarm float, the move said.",
  { said: ["LT3 \\(alarm\\) is lit by the alarm float FS3, not by AR"] }));
C.push(dup("A-35b-block2", lines(RUN.replies[2].reply), { floats: { off: "FS2", lead: "FS1", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" }, ols: OLS },
  "The 35B's second block (coil CR1 \x22alternating relay\x22 switched by nothing): CR1 is the alternating relay; drawn as the duplex.",
  { said: ["CR1 \\(alternating relay\\) is drawn as an alternating relay"] }));
C.push(dup("A-35b-select-switch", lines(RUN.replies[1].reply), { floats: { off: "FS2", lead: "FS1", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT3"], ols: OLS },
  "SS1 \x22lead/lag select\x22 is a selector that picks which pump leads (or alternate). Drawn as an on/off contact in pump 1's rung only, opening it stops pump 1 from ever running, even on the lag call or with the alarm up. Right: leave it out and say so, or draw it so it does not lock out pump 1.",
  { harm: "low", extra: function (m) { var r = m.plan.circuit.rungs.filter(function (x) { return x.out.id === "M1"; })[0]; return r && r.series.some(function (e) { return e.id === "SS1"; }) ? "SS1 (lead/lag select) is a plain contact in series with M1 only: with it open pump 1 never runs" : null; } }));
// ---- the prompt's own example, and the usual ways of writing it ------------------------------------------------
C.push(dup("A-prompt-example", F4.concat(["alternator AR M1 M2"], PUMPS, ["lamp LT1 M1 \x22pump 1 run\x22 green", "lamp LT2 M2 \x22pump 2 run\x22 green", "lamp LT3 FS4 \x22high level\x22 red"]),
  { floats: STD, pumps: ["M1", "M2"], alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" }, ols: OLS }, "The example Lantern gives the model, as written."));
C.push(dup("A-supply-120", ["supply \x22120 V AC\x22"].concat(F4, ["alternator AR M1 M2"], PUMPS, ["horn AH1 FS4 \x22high level\x22"]), { floats: STD, pumps: ["M1", "M2"], alarms: ["AH1"], ols: OLS }, "The usual duplex with a horn on the alarm float."));
C.push(dup("A-alt1-starters-horn", ["float LS1 \x22pumps off\x22", "float LS2 \x22lead pump on\x22", "float LS3 \x22lag pump on\x22", "float LS4 \x22high water alarm\x22", "alternator ALT1 M1 M2", "starter M1 \x22P1\x22", "starter M2 \x22P2\x22", "horn AH1 \x22high water alarm\x22"],
  { floats: { off: "LS1", lead: "LS2", lag: "LS3", alarm: "LS4" }, pumps: ["M1", "M2"], alarms: ["AH1"], ols: OLS }, "ALT1 as the alternator's tag, LS floats, starters, a horn labelled alarm with nothing named: the horn goes on the alarm float."));
C.push(dup("A-k-contactors-24vdc", ["supply \x2224 V DC\x22", "float FS1 \x22stop\x22", "float FS2 \x22start\x22", "float FS3 \x22alarm\x22", "alternator AR K1 K2", "coil K1 \x22pump 1 contactor\x22", "coil K2 \x22pump 2 contactor\x22"],
  { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["K1", "K2"], alarms: ["LT1"], ols: { OL1: "K1", OL2: "K2" } }, "24 V DC, K contactors, three floats stop/start/alarm: drawn between + and 0 V, an alarm light added and said.",
  { said: ["between \\+ and 0 V", "the high level alarm light LT1 on FS3", "There is no lag float"] }));
C.push(dup("A-auto-switches", ["switch SS1 M1 \x22pump 1 auto\x22", "switch SS2 M2 \x22pump 2 auto\x22"].concat(F4, ["alternator AR M1 M2", "coil M1", "coil M2", "overload OL1 M1", "overload OL2 M2"]),
  { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "An auto/off switch for each pump, in series: in auto the duplex works."));
C.push(dup("A-hoa-switch", ["switch SS1 M1 \x22HOA pump 1\x22", "switch SS2 M2 \x22HOA pump 2\x22"].concat(F4, ["alternator AR M1 M2", "coil M1", "coil M2"]),
  { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "A hand-off-auto switch's HAND position runs its pump whatever the floats say (through its overload); drawn as one on/off contact in series with the float logic, HAND does nothing. Right: say HOA is drawn as auto/off only (or draw the hand branch).",
  { harm: "low", extra: function (m) { return /HOA/.test(m.summary) && !/hand/i.test(m.summary.replace(/HOA pump/g, "")) ? "the HOA switch is drawn as a plain on/off contact and nothing says HAND is not drawn" : null; } }));
C.push(dup("A-overloads-written", F4.concat(["alternator AR M1 M2"], PUMPS, ["overload OL1 M1", "overload OL2 M2", "lamp LT4 FS4 \x22high level alarm\x22 red"]), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT4"], ols: OLS }, "Overloads written: each drops its own pump; the lag call runs the other."));
C.push(dup("A-floats-on-pumps", ["float FS1 M1 M2 \x22off\x22", "float FS2 M1 \x22lead on\x22", "float FS3 M2 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS),
  { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "Floats written on the pumps (as the 35B did): read by their labels, wired through the call relays, the move said.",
  { said: ["call the pumps through CR1 and CR2 and the alternating relay AR, not straight"] }));
C.push(dup("A-alternating-relay-words", F4.concat(["alternating relay AR M1 M2"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "\x22alternating relay AR M1 M2\x22 is the alternator line."));
C.push(dup("A-alternating-35b-word", F4.concat(["alternating AR M1 M2"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "\x22alternating AR M1 M2\x22 (the 35B's word) is the alternator line."));
C.push(dup("A-alt-tag", F4.concat(["alternator ALT M1 M2"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "ALT as the tag."));
C.push(dup("A-cr5-tag", F4.concat(["alternator CR5 M1 M2"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "The alternating relay tagged as a relay, CR5."));
C.push(dup("A-relay-labelled", F4.concat(["relay CR3 \x22alternating relay\x22"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "No alternator line, a relay labelled alternating relay: it is the alternator.",
  { said: ["CR3 \\(alternating relay\\) is drawn as an alternating relay"] }));
C.push(dup("A-coil-and-alternator", F3.concat(["alternator AR M1 M2", "coil AR \x22alternating relay\x22"], PUMPS), { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "Both an alternator line and a coil line for AR: one alternating relay."));
C.push(dup("A-start-stop-lag-start", ["float FS1 \x22stop\x22", "float FS2 \x22start\x22", "float FS3 \x22lag start\x22", "float FS4 \x22alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "stop / start / lag start / alarm."));
C.push(dup("A-low-high-highhigh", ["float FS1 \x22low\x22", "float FS2 \x22high\x22", "float FS3 \x22high high\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "low / high / high high (the usual three-float duplex)."));
C.push(dup("A-pump-off-on-second", ["float FS1 \x22pump off\x22", "float FS2 \x22pump on\x22", "float FS3 \x22second pump on\x22", "float FS4 \x22high water\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "pump off / pump on / second pump on / high water."));
C.push(dup("A-standby-start", ["float FS1 \x22pumps stop\x22", "float FS2 \x22duty pump start\x22", "float FS3 \x22standby pump start\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "duty / standby wording (UK)."));
C.push(dup("A-run-lamps", F4.concat(["alternator AR M1 M2"], PUMPS, ["lamp LT1 M1 \x22pump 1 running\x22 green", "lamp LT2 M2 \x22pump 2 running\x22 green", "lamp LT3 FS4 \x22high level alarm\x22 red"]), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" }, ols: OLS }, "Run lamps on each starter."));
C.push(dup("A-alarm-lamp-on-AR", F4.concat(["alternator AR M1 M2"], PUMPS, ["lamp LT3 AR \x22high level alarm\x22 red"]), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT3"], ols: OLS }, "An alarm light written on the alternator is moved to the alarm float, and said.",
  { said: ["LT3 \\(high level alarm\\) is lit by the alarm float FS4, not by AR"] }));
C.push(dup("A-alarm-lamp-and-horn", F4.concat(["alternator AR M1 M2"], PUMPS, ["lamp LT3 \x22high level alarm\x22 red", "horn AH1 \x22alarm horn\x22"]), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT3", "AH1"], ols: OLS }, "An alarm light and horn named by nothing: both on the alarm float."));
C.push(dup("A-alarm-silence", F4.concat(["alternator AR M1 M2"], PUMPS, ["lamp LT3 FS4 \x22high level alarm\x22 red", "horn AH1 FS4 \x22alarm horn\x22", "button PB1 AH1 nc \x22silence\x22"]), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT3", "AH1"], ols: OLS }, "A silence button (normally closed) in the horn's rung, as written."));
C.push(dup("A-230v", ["supply \x22230 V\x22"].concat(F4, ["alternator AR M1 M2"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "230 V: drawn between L and N."));
C.push(dup("A-estop-fuse", ["fuse FU1", "estop ES1"].concat(F4, ["alternator AR M1 M2"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "A fuse and an emergency stop in L1 ahead of every rung."));
C.push(dup("A-p-coils", F4.concat(["alternator AR P1 P2", "coil P1 \x22pump 1\x22", "coil P2 \x22pump 2\x22"]), { floats: STD, pumps: ["P1", "P2"], alarms: ["LT1"] }, "Pump coils tagged P1 and P2."));
C.push(dup("A-lag-alarm-combined", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on / alarm\x22", "alternator AR M1 M2"].concat(PUMPS, ["lamp LT3 FS3 \x22high level alarm\x22 red"]),
  { floats: { off: "FS1", lead: "FS2", lag: "FS3" }, pumps: ["M1", "M2"], ols: OLS }, "Three floats, the top one lag and alarm together (common in small panels): the lag call and the alarm light both on it.",
  { extra: function (m) { var sim = require("./sim.js"), S = sim.make(m.plan.circuit, function (id) { return { FS1: 1, FS2: 2, FS3: 3 }[id]; }); S.set(2.5); var a = S.on("LT3"); S.set(3.5); var b = S.on("LT3"); return !a && b ? null : "LT3 does not light at the lag/alarm float"; } }));
C.push(dup("A-low-level-alarm", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS5 LT5 \x22low level alarm\x22", "lamp LT5 \x22low level\x22 amber", "alternator AR M1 M2"].concat(PUMPS),
  { floats: { off: "FS1", lead: "FS2" }, pumps: ["M1", "M2"], ols: OLS, otherFloats: [["FS5", 0.2]] }, "A low level alarm float is left as written."));
C.push(dup("A-level-switch-words", ["level switch LS1 \x22off\x22", "level switch LS2 \x22lead on\x22", "level switch LS3 \x22lag on\x22", "level switch LS4 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: { off: "LS1", lead: "LS2", lag: "LS3", alarm: "LS4" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "\x22level switch\x22 for float."));
C.push(dup("A-float-switch-words", ["float switch FS1 \x22off\x22", "float switch FS2 \x22lead on\x22", "float switch FS3 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "\x22float switch\x22."));
C.push(dup("A-top-down", ["float FS4 \x22high level alarm\x22", "float FS3 \x22lag on\x22", "float FS2 \x22lead on\x22", "float FS1 \x22off\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "Floats listed from the top down."));
C.push(dup("A-alternator-last", PUMPS.concat(F4, ["alternator AR M1 M2"]), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "The alternator line last."));
C.push(dup("A-pumps-reversed", F4.concat(["alternator AR M2 M1"], PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "alternator AR M2 M1."));
C.push(dup("A-no-lag-two-pumps", F3.concat(["alternator AR M1 M2"], PUMPS), { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS }, "No lag float: one pump at a time, said.",
  { said: ["There is no lag float, so one pump runs at a time"] }));
C.push(dup("A-unquoted-labels", ["float FS1 off", "float FS2 lead on", "float FS3 lag on", "float FS4 alarm", "alternator AR M1 M2", "coil M1", "coil M2"], { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "The labels written without quotes still say plainly what each float is for (off, lead on, lag on, alarm). Right: read them; at least do not say they name no job.", { harm: "low" }));
C.push(dup("A-both-pumps-off", ["float FS1 \x22both pumps off\x22", "float FS2 \x22lead pump on\x22", "float FS3 \x22lag pump on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "\x22both pumps off\x22 is the off float (it stops both). Lantern reads \x22both\x22 as lag, finds two lag floats and no off float, and sends the block back."));
C.push(dup("A-stop-both", ["float FS1 \x22stop both pumps\x22", "float FS2 \x22start lead\x22", "float FS3 \x22start lag\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: { off: "FS1", lead: "FS2", lag: "FS3" }, pumps: ["M1", "M2"], ols: OLS },
  "\x22stop both pumps\x22 is the off float."));
C.push(dup("A-lead-lag-off", ["float FS1 \x22lead/lag off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "\x22lead/lag off\x22 is the common off float."));
C.push(dup("A-alarm-on", ["float FS1 \x22pumps off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22alarm on\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "\x22alarm on\x22 is the alarm float (it turns the alarm on); Lantern reads \x22on\x22 as lead."));
C.push(dup("A-high-level-alarm-on", ["float FS1 \x22off\x22", "float FS2 \x22lead pump on\x22", "float FS3 \x22high level alarm on\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "\x22high level alarm on\x22 is the alarm float."));
C.push(dup("A-pump1-pump2-on", ["float FS1 \x22pumps off\x22", "float FS2 \x22pump 1 on\x22", "float FS3 \x22pump 2 on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "With an alternator, \x22pump 1 on\x22 / \x22pump 2 on\x22 are the first and second pump-on levels (lead and lag); Lantern reads both as lead and sends it back. Ambiguous enough that going back is defensible, but the reading is plain.", { harm: "low" }));
C.push(dup("A-model-wires-calls", ["float FS1 CR1 \x22off\x22", "float FS2 CR1 \x22lead on\x22", "coil CR1 \x22lead call\x22", "alternator AR CR1 M1 M2", "coil M1 CR1 AR off \x22pump 1\x22", "coil M2 CR1 AR \x22pump 2\x22", "float FS3 \x22high level alarm\x22", "lamp LT1 FS3 \x22high level alarm\x22 red"],
  { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "A model that knows ladder logic wires the lead call relay CR1 itself (floats on CR1, the alternator fed by CR1, each pump on CR1 and its side of AR). That is right. Lantern makes its own call relay, strips the floats from CR1, and refuses \x22CR1 has nothing switching it\x22, telling the model to add a start button."));
C.push(dup("A-isa-tags", ["float LSL1 \x22pumps off\x22", "float LSH1 \x22lead pump on\x22", "float LSHH1 \x22high high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: { off: "LSL1", lead: "LSH1", alarm: "FS1" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "ISA tags (LSL1, LSH1, LSHH1): the alarm float keeps its tag. Lantern reads LSHH1 (four letters) as part of the label and renames the float FS1 (the circuit works).", { harm: "low",
    extra: function (m) { return /FS1 \(LSHH1/.test(m.summary) ? "LSHH1 is renamed FS1, its tag put in the label" : null; } }));
C.push(dup("A-redundant-off", ["float FS0 \x22redundant off\x22", "float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22high level alarm\x22", "alternator AR M1 M2"].concat(PUMPS), { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS, otherFloats: [["FS0", 0.8]] },
  "A redundant off float (a backup low-level cut-out in series with the off float) is a real design; Lantern refuses it as \x22two floats for one job\x22 and tells the model to drop it. Low: its one circuit has no place for it, and it says so.", { harm: "low" }));
C.push(dup("A-alarm-light-no-float", F3.slice(0, 2).concat(["alternator AR M1 M2"], PUMPS, ["lamp LT3 \x22high level alarm\x22 red"]), { floats: { off: "FS1", lead: "FS2" }, pumps: ["M1", "M2"], ols: OLS },
  "A high level alarm light with no alarm float: Lantern draws it lit \x22whenever there is power\x22. Right: send it back with the line to add (float FS3 \x22high level alarm\x22), or add the float and say so.",
  { harm: "medium", extra: function (m) { return /LT3 \(high level alarm, red\) lights whenever there is power/.test(m.summary) ? "LT3 (high level alarm) is drawn lit whenever there is power" : null; } }));
C.push(dup("A-lead-lamps-on-AR", F3.slice(0, 2).concat(["alternator AR M1 M2"], PUMPS, ["lamp LT1 AR \x22pump 1 lead\x22", "lamp LT2 AR off \x22pump 2 lead\x22"]), { floats: { off: "FS1", lead: "FS2" }, pumps: ["M1", "M2"], ols: OLS },
  "\x22pump 1 lead\x22 / \x22pump 2 lead\x22 lights on the alternator: Lantern knows which side of AR has which pump leading, so each light should be on that side. As written, LT1 \x22pump 1 lead\x22 lights while pump 2 leads (said in the steps, under a label that says the opposite).",
  { harm: "medium", extra: leadLamps({ LT1: "M1", LT2: "M2" }) }));
C.push(dup("A-overload-trip-lamps", F4.concat(["alternator AR M1 M2"], PUMPS, ["overload OL1 M1", "overload OL2 M2", "lamp LT5 OL1 \x22pump 1 overload\x22 amber", "lamp LT6 OL2 \x22pump 2 overload\x22 amber"]),
  { floats: STD, pumps: ["M1", "M2"], alarms: ["LT1"], ols: OLS },
  "A pump-fail light on its overload lights when the overload trips (its NO auxiliary contact). Lantern draws the overload's closed contact, so \x22pump 1 overload\x22 is lit while nothing has tripped and goes dark when it trips (said in the steps). This is MAKE CONTROL as it was, met in a duplex.",
  { harm: "medium", extra: tripLamps({ LT5: "OL1", LT6: "OL2" }) }));
// ---- duplex blocks that must go back, with a line and nothing contradicting it ---------------------------------
C.push(ref("A-ref-no-jobs", ["float FS1", "float FS2", "alternator AR M1 M2", "coil M1", "coil M2"], ["say what each float is for -- FS1 and FS2 do not -- like: float FS1 \x22off\x22"], "Floats with no job: back with the line to write, and only that."));
C.push(ref("A-ref-two-leads", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22start\x22", "alternator AR M1 M2", "coil M1", "coil M2"], ["two floats for one job \\(lead\\)"], "Two lead floats."));
C.push(ref("A-ref-no-off", ["float FS2 \x22lead on\x22", "alternator AR M1 M2", "coil M1", "coil M2"], ["the pumps need a float to stop them"], "No off float."));
C.push(ref("A-ref-no-lead", ["float FS1 \x22off\x22", "float FS3 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1", "coil M2"], ["the pumps need a float to start them"], "No lead float."));
C.push(ref("A-ref-no-floats", ["alternator AR M1 M2", "coil M1", "coil M2"], ["a float to start them and one to stop them"], "No floats at all."));
C.push(ref("A-ref-one-pump", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "alternator AR M1", "coil M1", "coil CR5"], ["alternator AR: name the two pump starters"], "An alternator that names one pump."));
C.push(ref("A-ref-triplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "alternator AR M1 M2 M3", "coil M1", "coil M2", "coil M3"], ["name the two pump starters"], "Three pumps on one alternator: Lantern draws two; back with the line.", { harm: "low" }));
C.push(ref("A-ref-two-alternators", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "alternator AR M1 M2", "alternator AR2 M1 M2", "coil M1", "coil M2"], ["write one alternator line"], "Two alternator lines."));
C.push(ref("A-ref-no-coils", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "alternator AR M1 M2"], ["name the two pump starters it takes turns between, and write a coil for each"], "No pump coils written.", { mislead: MISLEAD.concat(["limit M1 AR"]) }));
C.push(ref("A-ref-alt-4letter-tag", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "alternator ALTR M1 M2", "coil M1", "coil M2"], ["alternator AR M1 M2|alternator ALTR M1 M2"],
  "A four-letter tag (ALTR) is not read as an ID, so M1 becomes the alternator; the line back says \x22alternator M1 M1 M2\x22. Right: read ALTR as the tag, or say the tag is too long.", { harm: "low", mislead: MISLEAD.concat(["alternator M1 M1 M2"]) }));
C.push(ref("A-ref-mid-float", ["float FS1 \x22off\x22", "float FS2 \x22mid\x22", "float FS3 \x22lead on\x22", "alternator AR M1 M2", "coil M1", "coil M2"], ["say what each float is for -- FS2 does not"], "A float called \x22mid\x22 names no job."));
// ---- plain control circuits (no alternator): drawn as 1.24.29 drew them ------------------------------------
var PLAIN = require("./plain_cases.js");
PLAIN.forEach(function (p) {
  C.push({ id: p.id, rule: "A", right: p.right !== false, type: "plain", lines: p.lines, q: p.q, before: BEFORE[p.id], why: p.why, harm: p.harm || "high", sim: p.sim });
});
// ---- what the model is told ------------------------------------------------------------------------------------
function pr(id, q, has, not, why, harm) { return { id: id, rule: "A", right: true, type: "prompt", q: q, has: has, not: not, why: why, harm: harm || "medium" }; }
C.push(pr("A-prompt-duplex", "Draw the control circuit for a duplex lift station", ["alternator AR M1 M2", "MAKE CONTROL: Duplex pump station"], [], "A duplex question is offered the alternator line and the duplex example."));
C.push(pr("A-prompt-lead-lag", "Draw a lead/lag pump control circuit", ["alternator AR M1 M2"], [], "lead/lag pump control."));
C.push(pr("A-prompt-alternating", "Draw a ladder diagram for two sewage pumps with an alternating relay", ["alternator AR M1 M2"], [], "two pumps with an alternating relay."));
C.push(pr("A-prompt-starter", "Draw a motor starter with a seal-in contact", ["MAKE CONTROL"], ["alternator"], "A starter question is not offered the alternator."));
C.push(pr("A-prompt-simplex-sump", "Draw the control circuit for a sump pump with a float and a high water alarm", ["MAKE CONTROL"], ["alternator AR M1 M2"], "One sump pump: no alternator."));
C.push(pr("A-prompt-transfer", "Draw the control circuit for an automatic transfer between normal and alternate power", ["MAKE CONTROL"], ["alternator AR M1 M2", "Duplex pump station"],
  "A transfer switch's \x22alternate power\x22 is not a pump alternator; offering a small model the duplex pump example invites it to copy pumps and floats into a transfer circuit.", "low"));
C.push(pr("A-prompt-genset", "Draw the control circuit for a generator with an alternator charge warning light", ["MAKE CONTROL"], ["alternator AR M1 M2", "Duplex pump station"],
  "A generator's alternator is not an alternating relay.", "low"));
module.exports = C;
