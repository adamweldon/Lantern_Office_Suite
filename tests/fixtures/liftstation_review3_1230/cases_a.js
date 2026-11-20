// cases_a.js -- A: over-reach (rule 7). Plain control circuits that are not pump stations, or pump circuits that are
// right as written, built by 1.24.30 and compared with 1.24.29 (before.json, made by make_before.js). Each case says
// what is right and why; the judge simulates the drawn ladder where it can (lib.js / sim.js) and says how it differs
// from 1.24.29. Every difference is judged: better, worse or the same.
"use strict";
var H = require("./lib.js"), fs = require("fs"), path = require("path");
var BEFORE = null;
function before(id) {
  if (!BEFORE) { try { BEFORE = JSON.parse(fs.readFileSync(path.join(__dirname, "before.json"), "utf8")); } catch (e) { BEFORE = {}; } }
  return BEFORE[id];
}
function build(c) { return H.L().aiAct.build(H.ctl(c.lines), c.q); }
// press start, let go, press stop: a three-wire starter
function starter(r, start, stop, coil) {
  if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "no block");
  var S = H.sim.make(r.plan.circuit, function () { return null; }), out = [];
  if (S.on(coil)) out.push(coil + " on at rest");
  S.press(start); if (!S.on(coil)) out.push("start does not pull " + coil + " in");
  S.press(start, false); if (!S.on(coil)) out.push(coil + " does not hold in");
  S.press(stop); if (S.on(coil)) out.push("stop does not drop " + coil);
  S.press(stop, false); if (S.on(coil)) out.push(coil + " restarts by itself");
  return out.join("; ");
}
// the same as 1.24.29 whatever it was (drawn, or sent back with the same words)
// (the list of what Lantern draws now ends ", alternator": that difference is the feature's, and benign)
function sameAny(c, r) { var b = before(c.id); return b == null || H.sig(r).replace(/, alternator\)/g, ")") === b ? "" : "differs from 1.24.29: " + H.sig(r).replace(/\n/g, " / ") + " (1.24.29: " + String(b).replace(/\n/g, " / ") + ")"; }
function same(c, r) { var b = before(c.id); return b == null ? "" : H.sig(r) === b ? "" : "differs from 1.24.29"; }
function judgeSame(c, r) {
  if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "no block");
  var d = same(c, r);
  return d ? d + ": " + H.sig(r).replace(/\n/g, " / ") + " (1.24.29: " + String(before(c.id)).replace(/\n/g, " / ") + ")" : "";
}
// the case runs: the circuit is drawn, its behaviour is right (judge), and any difference from 1.24.29 is reported
function C(id, harm, q, lines, right, judge) {
  return { id: id, harm: harm, input: { question: q, block: lines }, q: q, lines: lines, right: right,
    run: function () { var c = this, r = build(c); return judge ? judge(c, r) : judgeSame(c, r); } };
}
var Q_MOTOR = "Draw a ladder diagram for a motor starter with start and stop buttons";
var cases = [
  C("A-01", "high", Q_MOTOR, ["stop PB1 M1", "start PB2 M1", "coil M1 \"motor starter\""],
    "As 1.24.29: start PB2 with M1's holding contact across it, stop PB1 in series, OL added; press start -> runs, holds, stop drops it.",
    function (c, r) { return starter(r, "PB2", "PB1", "M1") || judgeSame(c, r); }),
  C("A-02", "high", "Draw a forward reverse motor control circuit with interlocks",
    ["stop PB1", "start PB2 M1", "start PB3 M2", "coil M1 \"forward\"", "coil M2 \"reverse\""],
    "As 1.24.29: forward and reverse each sealed, each with the other's NC interlock; nothing about floats or pumps."),
  C("A-03", "medium", "Draw a control circuit where motor 2 can only start after motor 1 is running",
    ["stop PB1 M1", "start PB2 M1", "stop PB3 M2", "start PB4 M2", "coil M1 \"motor 1\"", "coil M2 M1 \"motor 2\""],
    "As 1.24.29: M2's rung has M1's NO contact in series."),
  C("A-04", "high", "Draw the control for two pumps, each with its own start and stop buttons",
    ["stop PB1 M1", "start PB2 M1", "stop PB3 M2", "start PB4 M2", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "As 1.24.29: two independent three-wire starters; no alternator asked for or added.",
    function (c, r) { return starter(r, "PB2", "PB1", "M1") || starter(r, "PB4", "PB3", "M2") || judgeSame(c, r); }),
  C("A-05", "high", "Draw the control for a duplex pump set where each pump has its own start and stop buttons",
    ["stop PB1 M1", "start PB2 M1", "stop PB3 M2", "start PB4 M2", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "'duplex' gives the pump-station prompt, but the block is two plain starters and the question asks for no alternating relay: drawn as written.",
    function (c, r) { return starter(r, "PB2", "PB1", "M1") || starter(r, "PB4", "PB3", "M2") || judgeSame(c, r); }),
  C("A-06", "medium", "Draw a control circuit for a sump pump with a float switch",
    ["float FS1 M1", "coil M1 \"sump pump\""], "One float in series, OL added: as 1.24.29."),
  C("A-07", "medium", "Draw a control circuit for a sump pump with a float switch and a run light",
    ["float FS1 M1 \"pump on\"", "coil M1 \"sump pump\"", "lamp LT1 M1 \"run\" green"], "One float only: nothing to pair; as 1.24.29."),
  C("A-08", "high", "Draw a ladder diagram for a sump pump with on and off floats",
    ["float FS1 M1 \"off\"", "float FS2 M1 \"on\"", "coil M1 \"sump pump\""],
    "Better than 1.24.29 (which had both in series: short-cycling): FS2 starts, FS1 stops, M1 holds in between, said.",
    function (c, r) { return H.pumpDown(r, "FS1", "FS2", "M1") || (/short-cycling/.test(H.said(r)) ? "" : "the change is not said"); }),
  C("A-09", "high", "Draw a ladder diagram for a sump pump with low and high level floats",
    ["float FS1 M1 \"low level\"", "float FS2 M1 \"high level\"", "coil M1 \"sump pump\""],
    "A sump empties: FS2 (high level) starts, FS1 (low level) stops, held in between.",
    function (c, r) { return H.pumpDown(r, "FS1", "FS2", "M1"); }),
  C("A-10", "medium", "Draw a ladder diagram for a sump pump with start and stop floats",
    ["float FS1 M1 \"pump stop\"", "float FS2 M1 \"pump start\"", "coil M1 \"sump pump\"", "lamp LT1 M1 \"running\" green"],
    "Pump-down, held in; the run light follows M1.",
    function (c, r) { return H.pumpDown(r, "FS1", "FS2", "M1"); }),
  C("A-11", "medium", "Draw the control circuit for a pump that fills a water tank, starting at low level and stopping at high level",
    ["float FS1 M1 \"low level\"", "float FS2 M1 \"high level\"", "coil M1 \"pump starter\""],
    "The question says the pump FILLS the tank. As written (two NO floats in series) the fill is wrong, and 1.24.29 left it as the model drew it. Lantern must not rewire it as a pump that empties (FS2 high starts it, FS1 low stops it) and call the series floats 'short-cycling ... as the water fell': that is a pump-down drawn and explained for a fill. Right: left as written (or back once with NC floats for a fill).",
    function (c, r) {
      if (!r || !r.ok) return "";
      var g = H.rung(r, "M1");
      return g && g.starts.length && /short-cycling/.test(H.said(r)) ? "rewired the fill pump as a pump that empties: " + H.said(r).split(" | ").filter(function (s) { return /short-cycling/.test(s); })[0] : "";
    }),
  C("A-12", "high", "Draw the control circuit for a pump that fills a water tank, starting at low level and stopping at high level",
    ["float FS1 M1 \"low level start\" nc", "float FS2 M1 \"high level stop\" nc", "coil M1 \"pump starter\""],
    "NC floats for a fill: left as written, as 1.24.29."),
  C("A-13", "medium", "Draw the control circuit for a pump that fills a water tank",
    ["float FS1 M1 \"low level start\"", "float FS2 M1 \"high level stop\"", "coil M1 \"pump starter\""],
    "'low level start' and 'high level stop' are a fill's: left as written (the rule's own exception)."),
  C("A-14", "medium", "Draw the control circuit for a tank fill pump with two floats",
    ["float FS1 M1 \"low\"", "float FS2 M1 \"high\"", "coil M1 \"tank fill pump\""],
    "The coil says fill: left as written."),
  C("A-15", "medium", "Draw the control circuit for a well pump that fills a storage tank",
    ["float FS1 M1 \"low\"", "float FS2 M1 \"high\"", "coil M1 \"well pump\""],
    "The question says the well pump fills the storage tank: not rewired as a pump that empties it (same as A-11).",
    function (c, r) { var g = H.rung(r, "M1"); return g && g.starts.length && /short-cycling/.test(H.said(r)) ? "rewired the well pump that fills a storage tank as one that empties it" : ""; }),
  C("A-16", "medium", "Draw a ladder diagram for a transfer pump that fills tank B from tank A, with floats in tank B",
    ["float FS1 M1 \"tank B low\"", "float FS2 M1 \"tank B high\"", "coil M1 \"transfer pump\""],
    "Floats in the tank being filled: not rewired as a pump-down (same as A-11).",
    function (c, r) { var g = H.rung(r, "M1"); return g && g.starts.length && /short-cycling/.test(H.said(r)) ? "rewired a fill (floats in the tank it fills) as a pump-down" : ""; }),
  C("A-17", "high", "Draw a ladder diagram for a transfer pump that empties tank A into tank B, with floats in tank A",
    ["float FS1 M1 \"tank A low\"", "float FS2 M1 \"tank A high\"", "coil M1 \"transfer pump\""],
    "Floats in the tank being emptied: pump-down, held in. Better than 1.24.29.",
    function (c, r) { return H.pumpDown(r, "FS1", "FS2", "M1"); }),
  C("A-18", "medium", "Draw a control circuit for a cistern refill pump",
    ["float FS1 M1 \"empty\"", "float FS2 M1 \"full\"", "coil M1 \"pump\""], "No job words Lantern reads: left as written, as 1.24.29."),
  C("A-19", "medium", "Draw the control circuit for a boiler make-up water pump",
    ["float FS1 M1 \"low\"", "float FS2 M1 \"high\"", "coil M1 \"make-up pump\""], "A make-up pump fills: left as written."),
  C("A-20", "high", "Draw a control circuit for an air compressor with a pressure switch",
    ["pressure PS1 M1 \"cut-in/cut-out\"", "coil M1 \"compressor starter\"", "overload OL1 M1"], "As 1.24.29."),
  C("A-21", "medium", "Draw the control circuit for a duplex air compressor with an alternating relay",
    ["pressure PS1 M1", "pressure PS2 M2", "alternator AR M1 M2", "coil M1 \"compressor 1\"", "coil M2 \"compressor 2\""],
    "Not drawn, said plainly with the line to write (each compressor on its own pressure switch); never a float line.",
    function (c, r) { if (r && r.ok) return "drawn"; var p = r.problems.join(" "); return /pressure switches it is not drawn yet/.test(p) && /pressure PS1 M1, pressure PS2 M2/.test(p) && !/float FS/.test(p) ? "" : "said: " + p; }),
  C("A-22", "high", "Draw a control circuit for a heater with a thermostat",
    ["temp TS1 M1", "coil M1 \"heater contactor\"", "lamp LT1 M1 \"heat on\" amber"], "As 1.24.29."),
  C("A-23", "medium", "Draw a control circuit for a furnace with a thermostat and a high limit",
    ["temp TS1 M1 \"thermostat\"", "temp TS2 M1 \"high limit\" nc", "coil M1 \"burner relay\""], "Two temperature switches in series: as 1.24.29."),
  C("A-24", "high", "Draw a conveyor control with start and stop buttons and an end limit switch",
    ["stop PB1 M1", "start PB2 M1", "limit LS1 M1 nc \"end of travel\"", "coil M1 \"conveyor starter\""], "As 1.24.29.",
    function (c, r) { return starter(r, "PB2", "PB1", "M1") || judgeSame(c, r); }),
  C("A-25", "high", "Draw a high level alarm circuit for a tank",
    ["float FS1 LT1 \"high level\"", "lamp LT1 \"high level alarm\" red"], "An alarm alone: as 1.24.29 (no pump, no float added)."),
  C("A-26", "medium", "Draw a high level alarm with a horn and a light for a tank",
    ["float FS1 LT1 \"high level\"", "float FS1 AH1", "lamp LT1 \"high level alarm\" red", "horn AH1 \"alarm horn\""], "As 1.24.29."),
  C("A-27", "medium", "Draw the control circuit for a pump with a float",
    ["float FS1 M1 \"tank empty\"", "coil M1 \"pump\""], "One oddly labelled float: as 1.24.29."),
  C("A-28", "medium", "Draw the control circuit for a pump with two floats",
    ["float FS1 M1 \"tank empty\"", "float FS2 M1 \"tank full\""].concat(["coil M1 \"pump\""]), "Neither label is a job Lantern reads: as 1.24.29."),
  C("A-29", "high", "Draw a pump control circuit with start and stop buttons and a low water cutoff float",
    ["stop PB1 M1", "start PB2 M1", "float FS1 M1 \"low water cutoff\"", "coil M1 \"pump starter\""],
    "Buttons start and stop it; the cutoff float in series: as 1.24.29.",
    function (c, r) { return judgeSame(c, r); }),
  C("A-30", "medium", "Draw a sump pump control with a hand-off-auto switch and on and off floats",
    ["switch SS1 M1 \"auto\"", "float FS1 M1 \"off\"", "float FS2 M1 \"on\"", "coil M1 \"sump pump\""],
    "Pump-down held in; the switch in series.",
    function (c, r) { return H.pumpDown(r, "FS1", "FS2", "M1"); }),
  C("A-31", "medium", "Draw a sump pump control with on and off floats and a high level alarm light",
    ["float FS1 M1 \"off\"", "float FS2 M1 \"on\"", "float FS3 LT1 \"high level alarm\"", "coil M1 \"sump pump\"", "lamp LT1 \"high level alarm\" red"],
    "Pump-down held in; the alarm light on FS3 alone.",
    function (c, r) {
      var p = H.pumpDown(r, "FS1", "FS2", "M1"); if (p) return p;
      var g = H.rung(r, "LT1"); return g && g.series.length === 1 && g.series[0].id === "FS3" && !g.starts.length ? "" : "the alarm light's rung changed: " + H.sig(r);
    }),
  C("A-32", "high", "Draw the control circuit for a two pump station without an alternating relay: pump 1 leads, pump 2 lags",
    ["float FS1 M1 M2 \"off\"", "float FS2 M1 \"lead on\"", "float FS3 M2 \"lag on\"", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "No alternator asked for ('without'): each pump starts on its own float and holds down to the off float.",
    function (c, r) {
      if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "");
      var got = H.run(r, { FS1: 1, FS2: 2, FS3: 3 }, [0, 1.5, 2.5, 3.5, 2.5, 1.5, 0.5], ["M1", "M2"]).join(" ");
      return got === "00 00 10 11 11 11 00" ? "" : "fill and drain gave " + got + " (want 00 00 10 11 11 11 00)";
    }),
  C("A-33", "medium", "Draw two sump pumps that alternate by a manual selector switch, each pump with its own float",
    ["switch SS1 M1 \"pump 1 select\"", "switch SS2 M2 \"pump 2 select\"", "float FS1 M1 \"pump 1 on\"", "float FS2 M2 \"pump 2 on\"", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "The person alternates the pumps by hand with a selector switch; no alternating relay is asked for. Drawn as written (1.24.29 did), not sent back for an 'alternator AR M1 M2' line.",
    function (c, r) { return r && !r.ok && /asks for an alternating relay/.test(r.problems.join(" ")) ? "sent back: " + r.problems.join("; ") : ""; }),
  C("A-34", "medium", "Draw the control circuit for two sump pumps with floats and an alternate power source",
    ["float FS1 M1 \"pump 1 float\"", "float FS2 M2 \"pump 2 float\"", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "'an alternate power source' is not an alternating relay: drawn as written (as 1.24.29), not sent back for one.",
    function (c, r) { return r && !r.ok && /asks for an alternating relay/.test(r.problems.join(" ")) ? "sent back: " + r.problems.join("; ") : ""; }),
  C("A-35", "medium", "Draw the control for two sump pumps run on alternate weeks by a selector switch, each on its own float",
    ["switch SS1 M1 \"week A\"", "switch SS2 M2 \"week B\"", "float FS1 M1", "float FS2 M2", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "Alternate weeks by a selector: no alternating relay asked for.",
    function (c, r) { return r && !r.ok && /asks for an alternating relay/.test(r.problems.join(" ")) ? "sent back: " + r.problems.join("; ") : ""; }),
  C("A-36", "medium", "Draw a control circuit for a pump that fills a tank, using a relay with low and high level floats",
    ["float FS1 CR1 \"low level\"", "float FS2 CR1 \"high level\"", "coil CR1 \"level relay\"", "coil M1 CR1 \"pump starter\""],
    "The question says fill: the relay is not rewired to latch on the high float (a pump-down) (same root as A-11).",
    function (c, r) { var g = H.rung(r, "CR1"); return g && g.starts.length && /short-cycling/.test(H.said(r)) ? "rewired the fill relay as a pump-down: " + H.said(r).split(" | ").filter(function (s) { return /short-cycling/.test(s); })[0] : ""; }),
  C("A-37", "medium", "Draw a control circuit for a solenoid valve that fills a tank between two floats",
    ["float FS1 SOL1 \"low\"", "float FS2 SOL1 \"high\"", "solenoid SOL1 \"fill valve\""], "A solenoid is not a coil of the rule: as 1.24.29."),
  C("A-38", "high", "Draw a motor control circuit with two start stations and two stop stations",
    ["stop PB1 M1", "stop PB3 M1", "start PB2 M1", "start PB4 M1", "coil M1 \"motor starter\""], "As 1.24.29."),
  C("A-39", "high", "Draw a motor starter with an emergency stop",
    ["estop ES1", "stop PB1 M1", "start PB2 M1", "coil M1 \"motor starter\""], "As 1.24.29."),
  C("A-40", "medium", "Draw a star-delta starter control circuit",
    ["stop PB1", "start PB2 KM1", "star-delta KM1", "coil KM1 \"main\""], "Not drawn yet, said: as 1.24.29.", sameAny),
  C("A-41", "medium", "Draw a 24 V DC control circuit for a sump pump relay with a float",
    ["supply \"24 V DC\"", "float FS1 CR1", "coil CR1 \"pump relay\"", "coil M1 CR1 \"pump starter\""], "As 1.24.29."),
  C("A-42", "medium", "Draw a duplex booster pump control with lead/lag pressure switches",
    ["pressure PS1 M1 \"lead\"", "pressure PS2 M2 \"lag\"", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "No alternator asked for or written; pressure switches as written.",
    function (c, r) { return judgeSame(c, r); }),
  C("A-43", "medium", "Draw a duplex booster pump control with an alternating relay and pressure switches",
    ["pressure PS1 M1", "pressure PS2 M2", "alternator AR M1 M2", "coil M1 \"pump 1 starter\"", "coil M2 \"pump 2 starter\""],
    "An alternator on pressure switches is not drawn yet: said, with each pump on its own switch; never told to add floats.",
    function (c, r) { if (r && r.ok) return "drawn"; var p = r.problems.join(" "); return /not drawn yet/.test(p) && !/float FS/.test(p) ? "" : "said: " + p; }),
  C("A-44", "medium", "Draw a control circuit for a fan with a thermostat and a hand-off switch",
    ["switch SS1 M1 \"hand\"", "temp TS1 M1", "coil M1 \"fan starter\""], "As 1.24.29."),
  C("A-45", "low", "Draw a control circuit for a pump with a float and a pressure switch",
    ["float FS1 M1 \"low level cutoff\"", "pressure PS1 M1 \"high pressure cutout\" nc", "coil M1 \"pump\""],
    "One float only: nothing to pair; as 1.24.29."),
  C("A-46", "medium", "Draw a ladder for a sump pump whose float is normally closed for the off level",
    ["float FS1 M1 \"off\" nc", "float FS2 M1 \"on\"", "coil M1 \"sump pump\""],
    "An NC float is not paired (the rule takes NO floats only): left as the model wrote it."),
  C("A-47", "medium", "Draw a control circuit for a timer that runs a pump for 5 minutes after a float makes",
    ["float FS1 TR1 \"high level\"", "timer TR1 \"5 min\"", "coil M1 TR1 \"pump starter\""], "As 1.24.29."),
  C("A-48", "medium", "Draw a control circuit for a pump that empties a pit, with a stop float and a start float, and a selector switch",
    ["switch SS1 M1", "float FS1 M1 \"stop\"", "float FS2 M1 \"start\"", "coil M1 \"pit pump\""],
    "Pump-down held in.",
    function (c, r) { return H.pumpDown(r, "FS1", "FS2", "M1"); }),
  C("A-49", "low", "Draw a control circuit for a drain pump with floats",
    ["float FS1 M1 \"low\"", "float FS2 M1 \"high\"", "coil M1 \"drain pump\""],
    "A drain pump empties: pump-down held in.",
    function (c, r) { return H.pumpDown(r, "FS1", "FS2", "M1"); }),
  C("A-50", "medium", "Draw a control circuit for a pump that keeps a tank between low and high level by filling it",
    ["float FS1 CR1 \"low level\"", "float FS2 CR1 \"high level\"", "coil CR1 \"fill relay\"", "coil M1 CR1 \"pump starter\""],
    "The relay says fill: left as written."),
  C("A-51", "medium", "Draw the control circuit for a duplex sewage pump station with an alternate (standby) pump that starts on a high float",
    ["float FS1 M1 M2 \"off\"", "float FS2 M1 \"duty on\"", "float FS3 M2 \"standby on\"", "coil M1 \"duty pump starter\"", "coil M2 \"standby pump starter\""],
    "'an alternate (standby) pump' is not an alternating relay: drawn as written (each pump on its float), not sent back for an alternator.",
    function (c, r) { return r && !r.ok && /asks for an alternating relay/.test(r.problems.join(" ")) ? "sent back: " + r.problems.join("; ") : ""; }),
  C("A-52", "high", "Draw a ladder diagram for a jogging motor with start and stop",
    ["stop PB1 M1", "start PB2 M1", "coil M1 \"motor starter\"", "lamp LT1 M1 \"run\" green", "lamp LT2 M1 off \"stopped\" red"],
    "As 1.24.29 (run light on M1, stopped light on M1's NC contact)."),
  C("A-53", "medium", "Draw a control circuit for two lights that alternate on a flasher relay",
    ["timer TR1 \"1 s\"", "coil CR1 TR1 \"flasher\"", "lamp LT1 CR1 \"left\" amber", "lamp LT2 CR1 off \"right\" amber"],
    "Not a pump at all (the model's flasher is incomplete, TR1 switched by nothing): sent back with the same words as 1.24.29, never for an alternator.", sameAny),
  C("A-54", "medium", "Draw a control circuit for a pump with an alternate start button at the tank",
    ["stop PB1 M1", "start PB2 M1", "start PB3 M1 \"tank start\"", "coil M1 \"pump starter\""],
    "One pump, an alternate start station: as 1.24.29.")
];
module.exports = cases;
