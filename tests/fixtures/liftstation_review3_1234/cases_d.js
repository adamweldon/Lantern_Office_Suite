// cases_d.js -- a MAKE STATION block anywhere in a reply is the station, what the other block says otherwise is said
// (differs()); Chat's note for blocks beside a station; rec.moreMade; held blocks across a correction (1.24.34, the
// second review). Whole Chat turns with a scripted model, beside 1.24.33.
"use strict";
var lib = require("./lib.js");
var Q = "write a schematic for a typical lift station. Include any other drawings a lift station would need";
var STN = "MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND";
var STN3 = "MAKE STATION: Lift station\npumps 3\nfloats off lead lag alarm\nEND";
var CTL = "MAKE CONTROL: Duplex control\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22lag on\x22\nfloat FS4 \x22high level alarm\x22\nalternator AR M1 M2\ncoil M1 \x22pump 1 starter\x22\ncoil M2 \x22pump 2 starter\x22\nEND";
var CTLH = CTL.replace("END", "horn AH1 FS4 \x22high level\x22\nEND");
var PIP = "MAKE PIPING: Piping\npump P1\npump P2\ncheck CV1 P1\ncheck CV2 P2\nvalve V1 P1 plug\nvalve V2 P2 plug\nEND";
var LEV = "MAKE LEVELS: Levels\nwell \x22wet well\x22 10 ft\npump P1 P2\nfloat FS1 \x22off\x22 2 ft\nfloat FS2 \x22lead on\x22 3 ft\nfloat FS3 \x22lag on\x22 4 ft\nfloat FS4 \x22high level alarm\x22 5 ft\nEND";
var SCH3 = "MAKE SCHEMATIC: Lift Station Electrical\nmode electrical\npart V1 source \x22240 V\x22\npart F1 float \x22Low Level\x22\npart F2 float \x22Lead On\x22\npart F3 float \x22Lag On\x22\npart F4 float \x22High Level Alarm\x22\npart M1 motor \x22Pump 1\x22\npart M2 motor \x22Pump 2\x22\npart M3 motor \x22Pump 3\x22\nwire V1 F1\nwire F1 M1\nwire M1 V1\nEND";
var TBL = "MAKE SHEET: Pump data\n| Pump | HP |\n| P1 | 5 |\n| P2 | 5 |\nEND";
var LAMP_BAD = "MAKE SCHEMATIC: Lamp\nmode electrical\npart B1 battery \x229 V\x22\npart S1 switch\npart L1 lamp\nwire B1 S1\nwire S1 L1\nEND";
var LAMP = LAMP_BAD.replace("END", "wire L1 B1\nEND");
var LAMP2 = LAMP.replace("MAKE SCHEMATIC: Lamp", "MAKE SCHEMATIC: Lamp circuit").replace("part S1 switch", "part S1 switch \x22on/off\x22");
function kinds(xs) { return (xs || []).map(function (m) { return m.block && m.block.kind; }).join(","); }
function turn(id, q, replies, want, why, harm) {
  return { id: id, harm: harm || "medium", right: true, input: { q: q, replies: replies }, why: why,
    run: async function (x) { var t = await lib.chat(x.N, q, replies); if (t.r.err) return "THREW " + t.r.err; return want(t, x) || ""; } };
}
var C = [];
C.push(turn("D-sch-then-station", Q, [SCH3 + "\n\n" + STN], function (t) {
  var m = t.r.made;
  if (!(m && m.ok && m.readAs === "STATION" && m.plan.spec.pumps.length === 2)) return "not the station of the MAKE STATION block: " + (m && lib.probs(m));
  if (t.sent.length !== 1 || (t.r.moreMade || []).length) return "asked again or made more: sent " + t.sent.length + ", moreMade " + kinds(t.r.moreMade);
  return /MAKE SCHEMATIC block before it has 3 pumps \(the station 2\)/.test(m.summary) ? "" : "the schematic's three pumps are not said: " + m.summary;
}, "a part-and-wire schematic, then MAKE STATION: the station, the schematic's difference said", "high"));
C.push(turn("D-station-then-control-horn", Q, [STN + "\n\nThe control:\n\n" + CTLH], function (t) {
  return t.r.made && t.r.made.ok && /The AI also wrote MAKE CONTROL: Duplex control \(it has a horn \(the station has none\)\); Lantern made the station from its MAKE STATION block and did not read it\./.test(t.notes) ? "" : "note: " + t.notes;
}, "MAKE STATION then MAKE CONTROL with a horn: the control not read, its horn said"));
C.push(turn("D-station-then-station3", Q, [STN + "\n\n" + STN3], function (t) {
  return t.r.made && t.r.made.plan.spec.pumps.length === 2 && /MAKE STATION: Lift station \(it has 3 pumps \(the station 2\)\)/.test(t.notes) && !(t.r.moreMade || []).length ? "" : "notes: " + t.notes + " moreMade " + kinds(t.r.moreMade);
}, "two MAKE STATION blocks: the first made, the second's count said, not a second station"));
C.push(turn("D-station-then-sheet", Q, [STN + "\n\nAnd the pumps:\n\n" + TBL], function (t) {
  return t.r.made && t.r.made.ok && kinds(t.r.moreMade) === "SHEET" && t.r.moreMade[0].ok ? "" : "moreMade " + kinds(t.r.moreMade);
}, "a table beside the station: made and shown"));
C.push(turn("D-control-then-station", Q, [CTLH + "\n\n" + STN], function (t) {
  var m = t.r.made;
  return m && m.ok && m.readAs === "STATION" && /MAKE CONTROL block before it has a horn/.test(m.summary) ? "" : "summary: " + (m && m.summary);
}, "MAKE CONTROL then MAKE STATION: the station, the horn said"));
C.push(turn("D-ctl-pip-station-note", Q, [CTL + "\n\n" + PIP + "\n\n" + STN], function (t) {
  if (!(t.r.made && t.r.made.readAs === "STATION")) return "not the station";
  if (/made the station from the block before it/.test(t.notes)) return "the note says the station was made “from the block before it” -- the MAKE CONTROL block -- when it was made from the MAKE STATION block after both: " + t.notes;
  return "";
}, "MAKE CONTROL, MAKE PIPING, MAKE STATION: Chat's note on the piping names the wrong block (made.block is the control block, whose action is not whole)", "low"));
C.push(turn("D-levels-then-station", Q, [LEV + "\n\n" + STN], function (t) {
  var m = t.r.made;
  if (!(m && m.ok)) return "not made";
  var said = (m.summary || "") + " " + t.notes;
  if (m.plan.spec.floats.every(function (z) { return !z.height; }) && !/MAKE LEVELS/.test(said)) return "the MAKE LEVELS block's heights (well 10 ft, floats at 2, 3, 4, 5 ft) are dropped and nothing says so: no note, no word in the summary (differs() compares pumps, float jobs and a horn only)";
  return "";
}, "MAKE LEVELS with every height, then a bare MAKE STATION: the station from the STATION block, and the heights the AI wrote lost without a word. (In the other order Chat says it did not read the levels.)", "medium"));
C.push(turn("D-station-then-levels", Q, [STN + "\n\n" + LEV], function (t) {
  return /The AI also wrote MAKE LEVELS: Levels; Lantern made the station from its MAKE STATION block and did not read it\./.test(t.notes) ? "" : "note: " + t.notes;
}, "MAKE STATION then MAKE LEVELS: not read, and said", "low"));
C.push(turn("D-two-schematics-made", "draw a series circuit with two lamps and a parallel circuit with two lamps", ["MAKE SCHEMATIC: Series\nmode electrical\npart B1 battery \x229 V\x22\npart L1 lamp\npart L2 lamp\nwire B1 L1\nwire L1 L2\nwire L2 B1\nEND\n\nMAKE SCHEMATIC: Parallel\nmode electrical\npart B1 battery \x229 V\x22\npart L1 lamp\npart L2 lamp\nwire B1 L1\nwire L1 B1\nwire B1 L2\nwire L2 B1\nEND"], function (t) {
  var all = (t.r.mades || []).concat(t.r.made ? [t.r.made] : []).concat(t.r.moreMade || []).filter(function (m, i, a) { return a.indexOf(m) === i; });
  var titles = all.map(function (m) { return m.block.title; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort().join(",");
  return titles === "Parallel,Series" ? "" : "made " + titles;
}, "two circuits in two blocks: both made (1.24.33 made the first only)", "medium"));
C.push(turn("D-held-table-kept", "Draw a circuit with a battery, a switch and a lamp", [LAMP_BAD + "\n\nThe values:\n\n" + TBL, LAMP], function (t) {
  return t.sent.length === 2 && t.r.made && t.r.made.ok && kinds(t.r.moreMade) === "SHEET" ? "" : "sent " + t.sent.length + " moreMade " + kinds(t.r.moreMade);
}, "the table beside a circuit sent back is kept and shown after the corrected circuit"));
C.push(turn("D-held-table-rewritten", "Draw a circuit with a battery, a switch and a lamp", [LAMP_BAD + "\n\n" + TBL, LAMP + "\n\n" + TBL.replace("Pump data", "Pump values")], function (t) {
  return kinds(t.r.moreMade) === "SHEET" ? "" : "the table shown " + (t.r.moreMade || []).length + " times";
}, "the corrected reply writes the table again under another title: shown once"));
C.push(turn("D-held-station-sheet", Q, ["MAKE STATION: LS\npumps 2\nfloat FS1 \x22Float A\x22\nEND\n\n" + TBL, STN], function (t) {
  return t.sent.length === 2 && t.r.made && t.r.made.ok && kinds(t.r.moreMade) === "SHEET" ? "" : "sent " + t.sent.length + " moreMade " + kinds(t.r.moreMade);
}, "a station sent back for a jobless float, the table beside it kept"));
// the AI corrected its own circuit in the reply ("Wait ... here it is fixed"), and Lantern asked again all the same: the
// held copy (the AI's own fix) is shown beside the corrected one -- the same circuit twice
C.push(turn("D-held-self-fix-twice", "draw a battery, a switch and a lamp", [LAMP_BAD + "\n\nWait, that is not closed. Here it is fixed:\n\n" + LAMP, LAMP2], function (t) {
  var all = (t.r.made ? [t.r.made] : []).concat(t.r.moreMade || []);
  return all.length > 1 ? "the same lamp circuit is shown " + all.length + " times (" + all.map(function (m) { return m.block.title; }).join(", ") + "): the held block was the AI's own fix of the first, and only a byte-identical correction is dropped" : "";
}, "a reply whose first block is broken and whose second is the AI's own fix", "low"));
// a question that is not a station's, answered with MAKE CONTROL and a MAKE STATION: both shown
C.push(turn("D-not-station-q-both", "draw the control circuit for a duplex lift station with an alternating relay", [CTL + "\n\nAnd the whole station:\n\n" + STN], function (t) {
  return t.r.made && t.r.made.ok && kinds(t.r.moreMade) === "STATION" ? "" : "made " + (t.r.made && t.r.made.block.kind) + " moreMade " + kinds(t.r.moreMade) + " notes " + t.notes;
}, "a control circuit asked for, the station written too: both made", "low"));
// differs() directly
C.push({ id: "D-differs-lag", harm: "low", right: true, input: { q: Q },
  why: "differs(): a schematic with a lag float beside a station of three floats says the lag",
  run: async function (x) {
    var S = x.N.L.aiStation, m = x.N.L.aiAct.build("MAKE STATION: LS\npumps 2\nfloats off lead alarm\nEND", Q);
    var b = x.N.L.aiAct.find(SCH3)[0], d = S.differs(m, b, Q).join("; ");
    return /has 3 pumps \(the station 2\)/.test(d) && /has a lag on float \(the station has none\)/.test(d) ? "" : "differs: " + d;
  } });
// Adam's own chat, as the test has it, beside 1.24.33 (nothing asked again, the station made from both blocks)
C.push({ id: "D-adam-chat", harm: "high", right: true, input: { file: "tests/fixtures/liftstation_1234/chat_35b.json" },
  why: "Adam's question and the 35B's reply: the station, nothing asked again (1.24.33 sent it back)",
  run: async function (x) {
    var CH = JSON.parse(require("fs").readFileSync(require("path").join(lib.ROOT, "tests/fixtures/liftstation_1234/chat_35b.json"), "utf8"));
    var t = await lib.chat(x.N, CH.question, [CH.replies[0].reply]);
    return t.sent.length === 1 && t.r.made && t.r.made.ok && t.r.made.readAs === "STATION" ? "" : "sent " + t.sent.length + " " + (t.r.made && lib.probs(t.r.made));
  } });
module.exports = C;
