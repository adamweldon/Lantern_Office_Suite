// cases_control.js -- area A: MAKE CONTROL for a pump station, as models really write it (the 35B's own blocks, what a
// 2B or 4B writes after the instructions' example, and the ways a tradesman names things). Each case: id, q (the
// question), input (the block), right (what is right, and why), harm (if Lantern does otherwise), run(H) -> "" when
// Lantern does what is right, else what it did.
"use strict";
var lib = require("./lib.js"), blk = lib.blk, F4 = lib.F4, PUMPS = lib.PUMPS, EXAMPLE = lib.EXAMPLE;
var RUN = require("../liftstation_1230/run_35b.json");
var Q = lib.CTRL_Q;
var STD = { floats: { off: "FS1", lead: "FS2", lag: "FS3", alarm: "FS4" }, pumps: ["M1", "M2"] };
function spec(extra) { var s = { floats: STD.floats, pumps: STD.pumps }; Object.keys(extra || {}).forEach(function (k) { s[k] = extra[k]; }); return s; }
function drawn(id, q, lines, sp, right, harm, more) {
  return { id: id, q: q || Q, input: blk("CONTROL", "Duplex lift station", lines), right: right, harm: harm || "high",
    run: function (H) { var r = H.build(this.input, this.q), w = H.duplex(r, sp); if (w) return w; return more ? more(H, r) || "" : ""; } };
}
function back(id, q, lines, want, right, harm) {
  // goes back once; want(problems text, fixText) -> "" when the line sent back is right for this block
  return { id: id, q: q || Q, input: blk("CONTROL", "Duplex lift station", lines), right: right, harm: harm || "medium",
    run: function (H) { var r = H.build(this.input, this.q); if (!r) return "no block read"; if (r.ok) return "drew it (want it back with the line to write)"; return want(r.problems.join(" | "), H.fix(r, this.q)) || ""; } };
}
var CASES = [];
// ---- the 35B's own blocks (Adam's Chat on 1.24.29) ---------------------------------------------------------------------
var B1 = RUN.replies[1].reply, B2 = RUN.replies[2].reply;
CASES.push({ id: "A-35b-block1-draws", q: RUN.question, input: B1, harm: "high",
  right: "The 35B's first block (alternating AR M1 M2, floats \"start high\", \"stop low\", \"alarm high high\" written on M1, the alarm light on AR) is a right duplex as written: draw it, the lead float starting a pump, the pumps taking turns, the off float stopping it, the alarm light on the alarm float, each overload taking out only its own pump.",
  run: function (H) { return H.duplex(H.build(this.input, this.q), { floats: { off: "FS2", lead: "FS1", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" } }); } });
CASES.push({ id: "A-35b-block2-draws", q: RUN.question, input: B2, harm: "high",
  right: "The 35B's second block (the alternating relay written as coil CR1 \"alternating relay\") is the same duplex: draw it so.",
  run: function (H) { return H.duplex(H.build(this.input, this.q), { floats: { off: "FS2", lead: "FS1", alarm: "FS3" }, pumps: ["M1", "M2"], alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" } }); } });
CASES.push({ id: "A-35b-block1-says-ss1", q: RUN.question, input: B1, harm: "medium",
  right: "SS1 \"lead/lag select\" written in M1's rung is drawn as written; Lantern must say that pump 1 then runs only while SS1 is closed, and that the alternating relay picks the lead pump.",
  run: function (H) { var s = H.said(H.build(this.input, this.q)); return /SS1[^|]*runs only while the switch is closed/.test(s) && /alternating relay AR picks the lead pump/.test(s) ? "" : "did not say what SS1 does: " + s.slice(0, 300); } });
CASES.push({ id: "A-35b-block1-alarm-float-not-a-call", q: RUN.question, input: B1, harm: "low",
  right: "What Lantern says must be true. FS3 (\"alarm high high\") lights the alarm LT3; it calls no pump. Saying \"The floats FS1, FS2 and FS3 call the pumps through CR1 and the alternating relay AR\" is false for FS3 (it was written on M1, and is moved to the alarm).",
  run: function (H) { var s = H.said(H.build(this.input, this.q)); var m = /The floats ([^|]*?) call the pumps/.exec(s); return m && /FS3/.test(m[1]) ? "said “The floats " + m[1] + " call the pumps through CR1 and the alternating relay AR” -- FS3 is the alarm float, it calls no pump" : ""; } });
CASES.push({ id: "A-35b-block2-alarm-float-not-a-call", q: RUN.question, input: B2, harm: "low",
  right: "As for block 1: FS3 is the alarm float and calls no pump; the summary must not say it does.",
  run: function (H) { var s = H.said(H.build(this.input, this.q)); var m = /The floats ([^|]*?) call the pumps/.exec(s); return m && /FS3/.test(m[1]) ? "said “The floats " + m[1] + " call the pumps” -- FS3 is the alarm float" : ""; } });
CASES.push({ id: "A-35b-block1-no-lag-said", q: RUN.question, input: B1, harm: "low",
  right: "The 35B wrote no lag float: Lantern must say one pump runs at a time, and offer a lag float line whose tag is free (FS4: FS1-FS3 are taken).",
  run: function (H) { var s = H.said(H.build(this.input, this.q)); return /no lag float[^|]*float FS4 \x22lag on\x22/.test(s) ? "" : "said: " + s.slice(0, 200); } });
// ---- the instructions' own example, as a small model copies it ---------------------------------------------------------
CASES.push(drawn("A-example-verbatim", null, EXAMPLE, spec({ alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" } }),
  "The instructions' example copied word for word is the usual duplex: draw it and it must work (lead, alternation, lag runs both, alarm, overloads)."));
CASES.push(drawn("A-example-no-lag", null, EXAMPLE.filter(function (l) { return !/FS3/.test(l); }), { floats: { off: "FS1", lead: "FS2", alarm: "FS4" }, pumps: ["M1", "M2"], alarms: ["LT3"] },
  "The example without its lag float: one pump at a time, alternating; said.", "high",
  function (H, r) { return /no lag float, so one pump runs at a time/.test(H.said(r)) ? "" : "did not say there is no lag float"; }));
CASES.push(drawn("A-example-no-END", null, EXAMPLE, spec({ alarms: ["LT3"] }), "A block cut off before END (the reply stopped) is read to its last line: the same circuit.", "medium"));
CASES[CASES.length - 1].input = CASES[CASES.length - 1].input.replace(/\nEND$/, "");
CASES.push(drawn("A-example-lines-reversed", null, EXAMPLE.slice().reverse(), spec({ alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" } }),
  "Lines in any order (coils first, floats last) are the same circuit."));
CASES.push(drawn("A-example-coils-first", null, PUMPS.concat(["alternator AR M1 M2"], F4), spec({}), "Coils, then the alternator, then the floats: the same duplex (the alarm light Lantern adds)."));
CASES.push(drawn("A-example-plus-hoa", null, EXAMPLE.concat(['switch SS1 M1 "pump 1 HOA"', 'switch SS2 M2 "pump 2 HOA"']), spec({ alarms: ["LT3"] }),
  "The example plus a selector per pump: drawn in each pump's rung (in AUTO it is closed); Lantern says it draws the HOA as on/off.", "medium",
  function (H, r) { return /HAND position/.test(H.said(r)) ? "" : "did not say the HOA's HAND position is not drawn"; }));
CASES.push(drawn("A-example-plus-ol-trip-lights", null, EXAMPLE.concat(["overload OL1 M1", "overload OL2 M2", 'lamp LT4 OL1 "pump 1 overload trip" amber', 'lamp LT5 OL2 "pump 2 overload trip" amber']),
  spec({ alarms: ["LT3"], ols: { OL1: "M1", OL2: "M2" } }), "Overload trip lights: lit when their overload trips (its open auxiliary contact); the trip takes out only its own pump.", "high",
  function (H, r) {
    var S = require("./sim.js").make(H.circuit(r), function (id) { return { FS1: 1, FS2: 2, FS3: 3, FS4: 4 }[id]; });
    S.set(0.5); if (S.on("LT4") || S.on("LT5")) return "a trip light is lit with no overload tripped";
    S.trip("OL1"); if (!S.on("LT4") || S.on("LT5")) return "OL1 tripped: LT4 " + S.on("LT4") + ", LT5 " + S.on("LT5");
    return "";
  }));
CASES.push(drawn("A-example-plus-fail-light-words", null, EXAMPLE.concat(['lamp LT4 OL1 "pump 1 fail" amber', "overload OL1 M1", "overload OL2 M2"]), spec({ alarms: ["LT3"], ols: { OL1: "M1", OL2: "M2" } }),
  "\"pump 1 fail\" on OL1 is a trip light (lit when OL1 trips).", "medium",
  function (H, r) { var g = H.rung(r, "LT4"); return g && g.after.some(function (e) { return e.id === "OL1" && !e.nc; }) ? "" : "LT4 is not on OL1's open (trip) contact"; }));
CASES.push(drawn("A-example-plus-horn", null, EXAMPLE.concat(['horn AH1 FS4 "high level alarm"']), spec({ alarms: ["LT3", "AH1"] }), "A horn on the alarm float sounds with the light."));
CASES.push(drawn("A-example-horn-instead-of-light", null, EXAMPLE.filter(function (l) { return !/LT3/.test(l); }).concat(['horn AH1 FS4 "high level alarm"']), spec({ alarms: ["AH1"] }),
  "A horn instead of the light: on the alarm float; Lantern adds no light (the horn is the alarm).", "medium",
  function (H, r) { return /alarm light/.test(H.said(r)) ? "added an alarm light where the horn was the alarm" : ""; }));
CASES.push(drawn("A-horn-silence-button", null, F4.concat(["alternator AR M1 M2"], PUMPS, ['horn AH1 FS4 "high level alarm"', 'stop PB1 AH1 "alarm silence"']), spec({ alarms: ["AH1"] }),
  "A silence button (NC) in the horn's rung: the horn sounds at the alarm float, and stops while silence is pressed.", "medium",
  function (H, r) {
    var S = require("./sim.js").make(H.circuit(r), function (id) { return { FS1: 1, FS2: 2, FS3: 3, FS4: 4 }[id]; });
    S.set(4.5); if (!S.on("AH1")) return "horn silent at the alarm level"; S.press("PB1"); return S.on("AH1") ? "silence does not silence the horn" : "";
  }));
CASES.push(drawn("A-run-lights-on-alternator", null, F4.concat(["alternator AR M1 M2"], PUMPS, ['lamp LT1 AR "pump 1 lead" white', 'lamp LT2 AR "pump 2 lead" white']), spec({}),
  "Lights on the alternating relay that name pump 1 and pump 2 show which pump leads: LT1 lit while AR has M1 leading, LT2 while M2 leads.", "medium",
  function (H, r) {
    var a = H.rung(r, "LT1"), b = H.rung(r, "LT2");
    var ea = a && a.series.filter(function (e) { return e.of === "AR"; })[0], eb = b && b.series.filter(function (e) { return e.of === "AR"; })[0];
    var p1 = H.rung(r, "M1").branches[0].filter(function (e) { return e.of === "AR"; })[0];
    return ea && eb && p1 && ea.nc === p1.nc && eb.nc !== p1.nc ? "" : "the lead lights do not follow the pump that leads";
  }));
CASES.push(drawn("A-alarm-light-on-M1-moved", null, F4.concat(["alternator AR M1 M2"], PUMPS, ['lamp LT3 M1 "high level alarm" red']), spec({ alarms: ["LT3"] }),
  "An alarm light written on M1 is the alarm: on the alarm float, and said.", "medium",
  function (H, r) { return /LT3[^|]*lit by the alarm float FS4, not by M1/.test(H.said(r)) ? "" : "not said: " + H.said(r).slice(0, 200); }));
CASES.push(drawn("A-alarm-horn-no-alarm-float", null, ['float FS1 "off"', 'float FS2 "lead on"', "alternator AR M1 M2"].concat(PUMPS, ['horn AH1 "high level alarm"']),
  { floats: { off: "FS1", lead: "FS2" }, pumps: ["M1", "M2"] },
  "A horn called the high level alarm with no alarm float: Lantern adds the float (FS3) and says so.", "medium",
  function (H, r) { return /alarm float FS3 for AH1/.test(H.said(r)) ? "" : "not said: " + H.said(r).slice(0, 200); }));
CASES.push({ id: "A-no-lag-line-names-free-tag", q: Q, harm: "low", input: blk("CONTROL", "Duplex", ['float FS1 "off"', 'float FS2 "lead on"', "alternator AR M1 M2"].concat(PUMPS, ['horn AH1 "high level alarm"'])),
  right: "When Lantern adds the alarm float FS3 itself, the lag float line it offers must not reuse FS3 (it offered float FS3 \"lag on\" -- FS3 is now the alarm float): float FS4 \"lag on\".",
  run: function (H) { var s = H.said(H.build(this.input, this.q)); return /alarm float FS3/.test(s) && /float FS3 \x22lag on\x22/.test(s) ? "offered “float FS3 \x22lag on\x22” while FS3 is the alarm float it added" : ""; } });
// ---- tags and wordings ------------------------------------------------------------------------------------------------
CASES.push(drawn("A-lowercase-floats-coils", null, ['float fs1 "off"', 'float fs2 "lead on"', 'float fs3 "lag on"', 'float fs4 "high level alarm"', "alternator AR m1 m2", 'coil m1 "pump 1 starter"', 'coil m2 "pump 2 starter"'], spec({}),
  "Lower-case tags (fs1, m1) are the same devices."));
CASES.push(back("A-lowercase-everything", null, ['float fs1 "off"', 'float fs2 "lead on"', 'float fs3 "lag on"', 'float fs4 "high level alarm"', "alternator ar m1 m2", 'coil m1 "pump 1 starter"', 'coil m2 "pump 2 starter"'],
  function () { return "sent it back"; },
  "A block written all in lower case (alternator ar m1 m2) is right: draw it, as the floats and coils in lower case are drawn. If it went back, the line must not be wrong -- Lantern sent “alternator M1 M1 M2” (it took m1 as the relay's tag and dropped ar).", "high"));
CASES[CASES.length - 1].run = function (H) { var r = H.build(this.input, this.q); if (r && r.ok) return H.duplex(r, spec({})); return "sent back: " + (r ? r.problems.join(" | ") : "nothing read"); };
CASES.push({ id: "A-mixedcase-Ar", q: Q, harm: "high", input: blk("CONTROL", "Duplex", F4.concat(["alternator Ar M1 M2"], PUMPS)),
  right: "\"alternator Ar M1 M2\" is the same as AR: draw it.",
  run: function (H) { var r = H.build(this.input, this.q); if (r && r.ok) return H.duplex(r, spec({})); return "sent back: " + (r ? r.problems.join(" | ") : "nothing read"); } });
CASES.push(drawn("A-float-switch-n", null, ['float switch 1 "off"', 'float switch 2 "lead on"', 'float switch 3 "lag on"', 'float switch 4 "high level alarm"', "alternator AR M1 M2"].concat(PUMPS), spec({}),
  "\"float switch 1 \\\"off\\\"\" (a number, not a tag): Lantern tags them FS1-FS4 in order and wires them by their jobs.", "medium"));
CASES.push(drawn("A-float-switch-label", null, ['float FS1 "Float Switch 1 - off"', 'float FS2 "Float Switch 2 - lead on"', 'float FS3 "Float Switch 3 - lag on"', 'float FS4 "Float Switch 4 - high level alarm"', "alternator AR M1 M2"].concat(PUMPS), spec({}),
  "Labels that begin \"Float Switch 2 -\" are still read by their job (lead on), not as pump 2.", "high"));
CASES.push(drawn("A-isa-tags-labelled", null, ['float LSL1 "pumps off"', 'float LSH1 "lead pump start"', 'float LSH2 "lag pump start"', 'float LSHH1 "high high level alarm"', "alternator AR M1 M2"].concat(PUMPS, ['horn AH1 LSHH1 "high level"']),
  { floats: { off: "LSL1", lead: "LSH1", lag: "LSH2", alarm: "LSHH1" }, pumps: ["M1", "M2"], alarms: ["AH1"] }, "ISA tags (LSL1, LSH1, LSHH1, four letters) with their jobs: the usual duplex."));
CASES.push(back("A-isa-tags-no-labels", null, ["float LSL1 M1", "float LSH1 M1", "float LSH2 M2", "float LSHH1 AH1", "alternator AR M1 M2"].concat(PUMPS, ['horn AH1 LSHH1 "high level"']),
  function (p) { return /float LSL1 \x22off\x22/.test(p) ? "" : "the line sent back names other tags: " + (/like: ([^|]*)/.exec(p) || ["", p])[1].slice(0, 160); },
  "ISA tags with no jobs written: back once, and (rule 3) the line to write is for THIS block's floats -- float LSL1 \"off\", float LSH1 \"lead on\", float LSH2 \"lag on\", float LSHH1 \"high level alarm\" -- not FS1-FS4, tags it does not have.", "low"));
CASES.push(drawn("A-K-contactors", null, F4.concat(["alternator AR K1 K2", 'coil K1 "pump 1 contactor"', 'coil K2 "pump 2 contactor"']), { floats: STD.floats, pumps: ["K1", "K2"] },
  "K1/K2 contactors for the pumps: starters, each with its overload added and said."));
CASES.push(drawn("A-KM-contactors-IEC", null, F4.concat(["alternator AR KM1 KM2", 'coil KM1 "pump 1 contactor"', 'coil KM2 "pump 2 contactor"']), { floats: STD.floats, pumps: ["KM1", "KM2"] },
  "KM1/KM2 (IEC 81346's tag for a motor contactor) driving the two pumps the alternating relay takes in turn: motor contactors -- each pump's overload in its rung, as for M1/K1. Lantern drew them as relays with no overloads, and said nothing.", "medium"));
CASES.push(drawn("A-P-coils-starters", null, F4.concat(["alternator AR P1 P2", 'coil P1 "pump 1 starter"', 'coil P2 "pump 2 starter"']), { floats: STD.floats, pumps: ["P1", "P2"] },
  "Coils tagged P1/P2 and called \"pump 1 starter\": they are the pumps' starters (the alternating relay takes them in turn) and need their overloads; Lantern drew relays without.", "medium"));
CASES.push(drawn("A-contactor-lines", null, F4.concat(["alternator AR C1 C2", 'contactor C1 "pump 1"', 'contactor C2 "pump 2"']), { floats: STD.floats, pumps: ["C1", "C2"] },
  "\"contactor C1\" lines: starters (the line says contactor), overloads added."));
CASES.push(drawn("A-starter-lines", null, F4.concat(["alternator AR M1 M2", 'starter M1 "pump 1"', 'starter M2 "pump 2"']), spec({}), "\"starter M1\" lines: the usual duplex."));
CASES.push(drawn("A-24VDC", null, ['supply "24 V DC"'].concat(F4, ["alternator AR K1 K2", 'coil K1 "pump 1 contactor"', 'coil K2 "pump 2 contactor"']), { floats: STD.floats, pumps: ["K1", "K2"] },
  "A 24 V DC control supply: the rails are + and 0 V, and the summary says so.", "medium",
  function (H, r) { return /between \+ and 0 V/.test(r.summary) ? "" : "summary does not say + and 0 V"; }));
CASES.push(drawn("A-supply-24VAC", null, ['supply "24 V AC"'].concat(F4, ["alternator AR M1 M2"], PUMPS), spec({}), "24 V AC: L1 and L2, the usual duplex.", "low",
  function (H, r) { return /between L1 and L2/.test(r.summary) ? "" : "summary rails wrong"; }));
CASES.push(drawn("A-alternating-relay-words", null, F4.concat(["alternating relay AR M1 M2"], PUMPS), spec({}), "\"alternating relay AR M1 M2\" is the alternator line."));
CASES.push(drawn("A-alternating-35b-word", null, F4.concat(["alternating AR M1 M2"], PUMPS), spec({}), "\"alternating AR M1 M2\" (the 35B's word) is the alternator line."));
CASES.push(drawn("A-relay-labelled-alternating", null, F4.concat(['relay AR "alternating relay"'], PUMPS), spec({}), "A relay called \"alternating relay\" with two starters and floats is the alternator."));
CASES.push(drawn("A-alternator-names-other-ids", null, F4.concat(["alternator AR P1 P2"], PUMPS), spec({}), "An alternator naming P1 P2 while the starters are M1 M2: the circuit's two starters are the pumps."));
CASES.push(drawn("A-alternator-bare", null, F4.concat(["alternator AR"], PUMPS), spec({}), "\"alternator AR\" alone: the circuit's two starters."));
CASES.push(drawn("A-own-call-relays", null, ['float FS1 CR1 "off"', 'float FS2 CR1 "lead on"', 'float FS3 CR2 "lag on"', 'float FS4 LT1 "high level alarm"', 'coil CR1 "lead call"', 'coil CR2 "lag call"', "alternator AR CR1",
  'coil M1 CR1 AR "pump 1 starter"', 'coil M2 CR1 AR "pump 2 starter"', 'lamp LT1 FS4 "alarm" red'], spec({ alarms: ["LT1"] }), "A model that wires its own lead and lag call relays: used as they are; the duplex works."));
CASES.push(drawn("A-floats-named-on-M1-M2", null, ['float FS1 M1 "off"', 'float FS2 M1 "lead on"', 'float FS3 M2 "lag on"', 'float FS4 M1 "high level alarm"', "alternator AR M1 M2"].concat(PUMPS), spec({}),
  "Floats written on M1/M2 (as the guide's \"float FS1 M1\" shows) with an alternator: wired through the calls, and said.", "high",
  function (H, r) { return /call the pumps through/.test(H.said(r)) ? "" : "not said that the floats call the pumps through the relays"; }));
CASES.push(drawn("A-seal-written-on-pumps", null, F4.concat(["alternator AR M1 M2", 'coil M1 M1 "pump 1 starter"', 'coil M2 M2 "pump 2 starter"']), spec({}), "A pump coil naming itself (its own contact): ignored; the usual duplex."));
CASES.push(drawn("A-redundant-off", null, ['float FS0 "redundant off"'].concat(F4, ["alternator AR M1 M2"], PUMPS), spec({ otherFloats: [["FS0", 0.8]] }),
  "A redundant (backup) off float under the off float: in series with it in the hold, so either one opening stops the pumps; said.", "high",
  function (H, r) { return /FS0 \(redundant off\) or FS1 \(off\) opens|FS1 \(off\) or FS0 \(redundant off\) opens/.test(H.said(r)) ? "" : "not said"; }));
CASES.push(drawn("A-lag-off-float", null, F4.concat(['float FS5 "lag off"', "alternator AR M1 M2"], PUMPS), spec({ otherFloats: [["FS5", 1.5]] }),
  "A lag pump's own off float (FS5 \"lag off\", above the off float): the lag call holds down to it, the lead call down to the off float.", "medium",
  function (H, r) { var g = H.rung(r, "CR2"); return g && g.stops.some(function (e) { return e.id === "FS5"; }) && !g.stops.some(function (e) { return e.id === "FS1"; }) ? "" : "the lag call is not held to FS5"; }));
CASES.push(drawn("A-two-alarms", null, F4.concat(['float FS5 "high high alarm"', "alternator AR M1 M2"], PUMPS, ['lamp LT1 FS4 "high level" red', 'horn AH1 FS5 "high high level"']),
  { floats: STD.floats, pumps: ["M1", "M2"], otherFloats: [["FS5", 5]] }, "High level and high-high alarm floats: two alarms are a real design; each alarm output on either float, or as written.", "medium",
  function (H, r) {
    var S = require("./sim.js").make(H.circuit(r), function (id) { return { FS1: 1, FS2: 2, FS3: 3, FS4: 4, FS5: 5 }[id]; });
    S.set(4.5); if (!S.on("LT1")) return "LT1 not lit at the high level"; S.set(5.5); return S.on("AH1") ? "" : "AH1 not on at high-high";
  }));
CASES.push(drawn("A-lag-and-alarm-one-float", null, ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on / high level alarm"', "alternator AR M1 M2"].concat(PUMPS, ['lamp LT1 FS3 "high level" red']),
  { floats: { off: "FS1", lead: "FS2", lag: "FS3" }, pumps: ["M1", "M2"] }, "One float for the lag pump and the alarm (a small panel's): it starts both and lights the alarm.", "medium",
  function (H, r) { var S = require("./sim.js").make(H.circuit(r), function (id) { return { FS1: 1, FS2: 2, FS3: 3 }[id]; }); S.set(3.5); return S.on("LT1") && S.on("M1") && S.on("M2") ? "" : "at FS3 the alarm and both pumps are not on"; }));
CASES.push(drawn("A-high-level-start-high-high", null, ['float FS1 "low level stop"', 'float FS2 "high level start"', 'float FS3 "high high level"', "alternator AR M1 M2"].concat(PUMPS),
  { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"] }, "\"high level start\" is the lead float (it says start); \"high high level\" the alarm."));
CASES.push(back("A-low-high-highhigh", null, ['float FS1 "low level"', 'float FS2 "high level"', 'float FS3 "high high level"', "alternator AR M1 M2"].concat(PUMPS),
  function (p) { return /float FS2 \x22lead on\x22/.test(p) && !/float FS3 \x22lag on\x22/.test(p) ? "" : "the line sent back is the example's (" + (/like: ([^|]*)/.exec(p) || ["", ""])[1].slice(0, 140) + "), not this block's: FS3 here is the high-high alarm"; },
  "Floats \"low level\", \"high level\", \"high high level\": with a high-high float present the \"high level\" one is the pump start. Drawing it so would be best; at least the line sent back must be this block's (float FS2 \"lead on\"), not the example's four floats, which name this block's alarm float FS3 \"lag on\".", "low"));
CASES[CASES.length - 1].run = function (H) { var r = H.build(this.input, this.q); if (r && r.ok) return H.duplex(r, { floats: { off: "FS1", lead: "FS2", alarm: "FS3" }, pumps: ["M1", "M2"] }); var p = r.problems.join(" | "); return /float FS2 \x22lead on\x22/.test(p) && !/float FS3 \x22lag on\x22/.test(p) ? "" : "sent back with the example's line (" + (/like: ([^|]*)/.exec(p) || ["", ""])[1].slice(0, 140) + ") -- in this block FS3 is the high-high alarm"; };
// float jobs by their wording, each in the usual duplex (off, lead, lag, alarm in that order)
[["pump off", "lead pump on", "lag pump on", "high water alarm"], ["stop", "start lead", "start lag", "alarm"], ["pumps off", "pump 1 on", "pump 2 on", "high level alarm"],
  ["Stop (Low)", "Start (High)", "Lag start", "Alarm (High-High)"], ["duty stop", "duty start", "standby start", "high level"], ["all pumps off", "first pump on", "second pump on", "overflow alarm"],
  ["low water cutoff", "lead start", "assist start", "flood alarm"], ["off (both pumps)", "lead", "lag", "high-high"], ["pump stop level", "pump start level", "both pumps on", "emergency high level"],
  ["low level cut-out", "1st pump on", "2nd pump on", "high level alarm (horn)"]].forEach(function (w, k) {
  CASES.push(drawn("A-float-words-" + (k + 1), null, ['float FS1 "' + w[0] + '"', 'float FS2 "' + w[1] + '"', 'float FS3 "' + w[2] + '"', 'float FS4 "' + w[3] + '"', "alternator AR M1 M2"].concat(PUMPS), spec({}),
    "Floats called " + w.map(function (x) { return "“" + x + "”"; }).join(", ") + ": off, lead on, lag on and alarm by their words; the usual duplex.", "high"));
});
CASES.push(drawn("A-float-jobs-unquoted", null, ["float FS1 off", "float FS2 lead on", "float FS3 lag on", "float FS4 high level alarm", "alternator AR M1 M2"].concat(PUMPS), spec({}),
  "Jobs written without quotes are the floats' labels (float FS1 off)."));
CASES.push(back("A-float-no-jobs", null, ["float FS1 M1", "float FS2 M1", "alternator AR M1 M2"].concat(PUMPS),
  function (p) { return /FS1 and FS2 do not/.test(p) && /float FS1 \x22off\x22, float FS2 \x22lead on\x22/.test(p) ? "" : "line: " + p.slice(0, 200); },
  "Two floats named on M1 with no jobs, with an alternator: back once, naming FS1 and FS2 and the line to write (float FS1 \"off\", float FS2 \"lead on\").", "medium"));
CASES.push(back("A-float-level-numbers", null, ['float FS1 "level 1"', 'float FS2 "level 2"', 'float FS3 "level 3"', "alternator AR M1 M2"].concat(PUMPS),
  function (p) { return /say what each float is for/.test(p) ? "" : p.slice(0, 200); }, "\"level 1\", \"level 2\": no job -- back once with the jobs to write.", "low"));
CASES.push(back("A-no-floats", null, ["alternator AR M1 M2"].concat(PUMPS),
  function (p) { return /need a float to start them and one to stop them, like: float FS1 \x22off\x22/.test(p) ? "" : p.slice(0, 200); }, "No floats at all: back with the float lines.", "medium"));
CASES.push(back("A-only-on-float", null, ['float FS1 "on"', "alternator AR M1 M2"].concat(PUMPS),
  function (p) { return /need a float to stop them/.test(p) ? "" : p.slice(0, 200); }, "Only an on float: back -- the pumps need a float to stop them.", "medium"));
CASES.push(back("A-two-lead-floats", null, ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lead on"', "alternator AR M1 M2"].concat(PUMPS),
  function (p) { return /two floats for one job \(lead\)/.test(p) ? "" : p.slice(0, 200); }, "Two lead floats: back, one float each for lead and lag.", "low"));
CASES.push(back("A-two-alternators", null, F4.concat(["alternator AR1 M1 M2", "alternator AR2 M1 M2"], PUMPS),
  function (p) { return /write one alternator line, like: alternator AR M1 M2/.test(p) ? "" : p.slice(0, 200); }, "Two alternator lines for two pumps: back -- one alternating relay.", "low"));
CASES.push(back("A-triplex", "Draw the control circuit for a triplex lift station with three pumps and an alternator", ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "lag 2 on"', 'float FS5 "high level alarm"', "alternator AR M1 M2 M3", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'coil M3 "pump 3 starter"'],
  function (p) { return /alternator AR M1 M2,/.test(p) && !/M3/.test(p.split("like:")[1] || "") ? "sent back “" + p.slice(0, 220) + "” -- for three pumps that line leaves pump 3 out" : ""; },
  "A triplex question (three pumps, one alternator): Lantern's alternating relay takes two pumps in turn. What goes back must not be a line that is wrong for this question: “alternator AR M1 M2, coil M1, coil M2” drops pump 3. Right: say a triplex alternator is not drawn yet (or draw two pumps and say the third is not), not hand over a two-pump line as the fix.", "medium"));
CASES.push(back("A-overloads-no-coil", null, F4.concat(["alternator AR M1 M2"], PUMPS, ["overload OL1", "overload OL2"]),
  function (p) { return /overload OL1 CR\d/.test(p) ? "sent back “" + (/overload OL1: [^|]*/.exec(p) || [p])[0] + "” -- CR1 is the lead call relay Lantern adds, not a motor; the line is overload OL1 M1" : ""; },
  "\"overload OL1\" and \"overload OL2\" with two pump starters: OL1 M1 and OL2 M2 (in order) -- or back with that line. The line sent back named CR1, the lead call relay: an overload on a relay coil is wrong.", "medium"));
CASES[CASES.length - 1].run = function (H) { var r = H.build(this.input, this.q); if (r.ok) return H.duplex(r, spec({ ols: { OL1: "M1", OL2: "M2" } })); var p = r.problems.join(" | "); return /overload OL1 CR\d/.test(p) ? "sent back “" + (/overload OL1: [^|]*/.exec(p) || [p])[0] + "” -- CR1 is the lead call relay, not a motor; the line is overload OL1 M1" : (/overload OL1 M1/.test(p) ? "" : p.slice(0, 200)); };
CASES.push(back("A-hoa-line", null, F4.concat(["alternator AR M1 M2", "hoa SS1 M1", "hoa SS2 M2"], PUMPS),
  function (p) { return /switch SS1 M1/.test(p) ? "" : "sent back with the list of what Lantern draws, no line to write (" + p.slice(0, 120) + "...)"; },
  "\"hoa SS1 M1\": Lantern draws a selector switch (it draws the HOA as on/off, and says so). If it goes back, the line to write is switch SS1 M1 \"hand-off-auto\" -- not the list of everything Lantern draws (rule 3).", "low"));
CASES.push(drawn("A-estop-in-duplex", null, ["estop ES1"].concat(F4, ["alternator AR M1 M2"], PUMPS), spec({}), "An emergency stop: in L1 ahead of every rung (not pressed: the duplex works)."));
CASES.push(drawn("A-lag-delay-timer-as-written", null, F4.concat(["alternator AR M1 M2"], PUMPS, ['timer TR1 FS3 "lag delay 10 s"']), spec({}),
  "A timer on the lag float whose contact is used nowhere: drawn as written (it times; nothing waits on it); the duplex works.", "low"));
// ---- the duplex question answered without an alternating relay; a simplex ----------------------------------------------
CASES.push({ id: "A-duplex-question-no-alternator", q: Q, harm: "medium",
  input: blk("CONTROL", "Duplex", ['float FS1 M1 "off"', 'float FS2 M1 "lead on"', 'float FS3 M2 "lag on"', 'float FS4 LT1 "high level alarm"'].concat(PUMPS, ['lamp LT1 FS4 "alarm" red'])),
  right: "The question asks for an alternating relay and the block has none, its \"off\" and \"lead on\" floats in series on M1 (the pump stops as soon as the water drops below the lead float: the off float does nothing) and pump 2 alone on the lag float. What cannot be right goes back once with the line to write (alternator AR M1 M2) -- Lantern knows the floats' jobs and that the question asks for one.",
  run: function (H) { var r = H.build(this.input, this.q); if (!r.ok) return /alternator AR M1 M2/.test(r.problems.join(" ")) ? "" : "back, but not with the alternator line"; return "drawn as written, said nothing: " + (H.simplex(r, "FS1", "FS2", "M1") || "M1 holds"); } });
CASES.push({ id: "A-simplex-off-on-floats", q: "Draw the control circuit for a simplex sump pump with an on float and an off float", harm: "medium",
  input: blk("CONTROL", "Simplex sump", ['float FS1 M1 "off"', 'float FS2 M1 "on"', 'coil M1 "pump starter"']),
  right: "A one-pump station with an \"off\" and an \"on\" float: the pump starts at the on float and runs down to the off float (held in). Two floats in series do nothing of the kind -- the off float can never stop it first (it is lower) -- so the pump short-cycles at the on float. Lantern reads float jobs for the duplex; here it drew the series and said nothing (as 1.24.29 did).",
  run: function (H) { return H.simplex(H.build(this.input, this.q), "FS1", "FS2", "M1"); } });
// ---- air compressors and boilers take turns too ------------------------------------------------------------------------
CASES.push(back("A-compressors-pressure-switches", "Draw the control circuit for a duplex air compressor with an alternating relay", ['pressure PS1 "lead start"', 'pressure PS2 "lag start"', "alternator AR M1 M2", 'coil M1 "compressor 1 starter"', 'coil M2 "compressor 2 starter"'],
  function (p) { return /float FS1/.test(p) ? "told to add floats to an air compressor: “" + p.slice(0, 160) + "”" : ""; },
  "Duplex air compressors take turns through an alternating relay too, on pressure switches. Lantern's duplex wiring wants floats; it may say it draws only a pump's duplex, but the line sent back must not tell the model to put level floats in an air compressor (“the pumps need a float ... float FS1 \\\"off\\\"”).", "medium"));
CASES.push({ id: "A-compressor-prompt", q: "Draw the control circuit for a duplex air compressor with an alternating relay", harm: "low", input: "(the instructions)",
  right: "The instructions for an air compressor's duplex should not show a wet well's floats as the example (a small model copies the example: floats on an air compressor).",
  run: function (H) { var p = H.L.aiAct.prompt(this.q); return /float FS1 \x22off\x22/.test(p) && /MAKE CONTROL: Duplex pump station/.test(p) ? "showed the duplex pump station's floats as the example" : ""; } });
CASES.push({ id: "A-boilers-lead-lag-prompt", q: "Draw the lead/lag control circuit for two boilers", harm: "low", input: "(the instructions)",
  right: "Lead/lag boilers have no floats or pumps to alternate: the instructions should not be the pump station's (floats, an alternator, a wet well's alarm).",
  run: function (H) { var p = H.L.aiAct.prompt(this.q); return /float FS1 \x22off\x22/.test(p) ? "showed the duplex pump station's floats as the example" : ""; } });
// ---- what the AI is shown ----------------------------------------------------------------------------------------------
CASES.push({ id: "A-prompt-pump-question", q: lib.ADAM_Q, harm: "high", input: "(the instructions)",
  right: "Adam's question: the instructions carry MAKE CONTROL with the alternator line, the float jobs and the duplex example.",
  run: function (H) { var p = H.L.aiAct.prompt(this.q); return /alternator AR M1 M2/.test(p) && /MAKE CONTROL: Duplex pump station/.test(p) ? "" : "the pump lines are not shown"; } });
CASES.push({ id: "A-prompt-starter-question", q: "Draw a motor starter control circuit with start and stop buttons", harm: "medium", input: "(the instructions)",
  right: "A motor starter's question is shown the old guide and example, not the pump station's.",
  run: function (H) { var p = H.L.aiAct.prompt(this.q); return !/alternator AR M1 M2/.test(p) ? "" : "shown the pump station's lines"; } });
CASES.push({ id: "A-fix-hint-for-pump-block", q: Q, harm: "low", input: blk("CONTROL", "Duplex", ["float FS1", "float FS2", "alternator AR M1 M2"].concat(PUMPS)),
  right: "When a pump station's block goes back, the guide repeated under the problems should be the one the model was shown (with the alternator and the float jobs), not the motor starter's (start PB2 M1, stop PB1 M1 ...), which a small model then copies.",
  run: function (H) { var r = H.build(this.input, this.q), t = H.fix(r, this.q); return /alternator AR M1 M2\s+an alternating relay/.test(t) ? "" : "the guide sent back is the motor starter's (no alternator or float-job lines)"; } });
CASES.push({ id: "A-35b-prose-is-asked-for-block", q: RUN.question, harm: "high", input: RUN.replies[0].reply.slice(0, 120) + "...",
  right: "The 35B's prose reply (\"I cannot create visual diagrams\") makes nothing; in Chat Lantern asks for the block (see D-turn-prose-first).",
  run: function (H) { return H.build(RUN.replies[0].reply, this.q) ? "read a block in prose" : ""; } });
module.exports = CASES;
