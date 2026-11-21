// cases_c.js -- C: a station question answered with the drawings' own blocks (MAKE CONTROL, PIPING, LEVELS) is read as
// MAKE STATION: each block written drawn as written, the rest made from what they say -- one station, its drawings
// agreeing with each other (the same floats, the same pumps), and what does not agree said. The same blocks for a
// question about one drawing stay that drawing. In Chat and on the bench's path: a station question answered with a
// block that is not a station's drawing is not left as the whole answer without a word (1.24.30 asked for the parts).
"use strict";
var H = require("./lib.js");
var R = require("../liftstation_1230/run_35b.json").replies.map(function (r) { return r.reply; });
var Q = H.ADAM_Q, F4 = ["off", "lead", "lag", "alarm"];
function ctl(lines, t) { return H.blk("CONTROL", t || "Duplex", lines); }
var P2 = ["alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'];
var CF4 = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"'];
var PIPE = H.blk("PIPING", "Lift station", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', 'valve V1 P1 plug', 'valve V2 P2 plug', 'header "4 in force main"', "vent"]);
var LEV = H.blk("LEVELS", "Wet well", ['well "wet well" 10 ft', "pump P1 P2", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS4 "high level alarm" 5.5 ft', 'inlet "inlet invert" 6.5 ft']);
// read as the station, and the station right
function asStation(r, exp) { if (!r || r.readAs !== "STATION") return "not read as a station: " + (r ? (r.readAs || (r.plan && r.plan.mode) || "") + " " + (r.problems || []).join("; ") : "no block"); return H.stationRight(r, exp); }
function K(id, harm, q, text, right, judge) {
  return { id: id, harm: harm, input: { question: q, reply: text }, right: right, run: function () { return judge(H.build(text, q)); } };
}
var cases = [
  K("C-01", "high", Q, R[1], "The 35B's own MAKE CONTROL: read as the station; its control as written; the levels and the parts list with ITS floats (FS2 off, FS1 lead, FS3 alarm).",
    function (r) { return asStation(r, { pumps: 2, jobs: ["off", "lead", "alarm"] }); }),
  K("C-02", "high", Q, R[2], "The 35B's second control (a coil named 'alternating relay'): the same.", function (r) { return asStation(r, { pumps: 2, jobs: ["off", "lead", "alarm"] }); }),
  K("C-03", "high", Q, ctl(P2), "The 2B's duplex with no floats: the usual four added to the control, and the same four in the levels and the parts list.",
    function (r) { return asStation(r, { pumps: 2, jobs: F4 }); }),
  K("C-04", "high", H.Q_B, ctl(CF4.concat(P2)), "Set B's question, a full control block: the station from it.", function (r) { return asStation(r, { pumps: 2, jobs: F4 }); }),
  K("C-05", "high", Q, ctl(CF4.concat(P2)) + "\n\n" + PIPE + "\n\n" + LEV, "All three blocks: each as written, one station (the levels' heights kept, the piping's plug valves kept).",
    function (r) { var w = asStation(r, { pumps: 2, jobs: F4, valve: "plug", heights: { off: "2 ft", lead: "3.5 ft", lag: "4.5 ft", alarm: "5.5 ft" } }); return w || (r.plan.given.join() === "control,piping,levels" ? "" : "given " + r.plan.given); }),
  K("C-06", "medium", Q, PIPE, "The piping alone: as written; the control and the levels made (the usual floats, said).",
    function (r) { return asStation(r, { pumps: 2, jobs: F4, valve: "plug", said: [/the usual floats/] }); }),
  K("C-07", "medium", Q, LEV, "The levels alone: as written; the control and the piping made from its floats.",
    function (r) { return asStation(r, { pumps: 2, jobs: F4, heights: { off: "2 ft", lead: "3.5 ft", lag: "4.5 ft", alarm: "5.5 ft" } }); }),
  K("C-08", "medium", Q, ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "high level alarm"'].concat(P2)) + "\n\n" + LEV.replace(/float FS3 "lag on" 4.5 ft\nfloat FS4 "high level alarm" 5.5 ft/, 'float FS3 "high level alarm" 4.5 ft'),
    "The control and the levels (three floats each, agreeing): the piping made; one station.", function (r) { return asStation(r, { pumps: 2, jobs: ["off", "lead", "alarm"] }); }),
  K("C-09", "medium", Q, H.blk("SCHEMATIC", "Duplex", CF4.concat(P2)), "MAKE SCHEMATIC with the control's lines: read as the station's control.", function (r) { return asStation(r, { pumps: 2, jobs: F4 }); }),
  K("C-10", "low", Q, H.st(["pumps 2"]) + "\n\n" + ctl(CF4.concat(P2)), "MAKE STATION and then a control block: the station (the first block).",
    function (r) { return H.plan(r) && !r.readAs ? H.stationRight(r, { pumps: 2, jobs: F4 }) : "not the station block: " + r.readAs; }),
  // ---- the drawings must agree ----------------------------------------------------------------------------------
  K("C-11", "high", Q, ctl(['level LS1 "off"', 'level LS2 "lead on"', 'level LS3 "high level alarm"'].concat(P2)),
    "A control block whose floats are written 'level LS1 ...' (MAKE CONTROL reads 'level' as a float): the levels drawing and the parts list have LS1, LS2, LS3. Not: the control with LS1-LS3 beside a levels drawing and parts list of four other floats FS1-FS4 ('the usual floats'), which no circuit has.",
    function (r) { return asStation(r, { pumps: 2, jobs: ["off", "lead", "alarm"] }); }),
  K("C-12", "high", Q, ctl(['fs FS1 "off"', 'fs FS2 "lead on"'].concat(P2)),
    "Floats written 'fs FS1 ...' (MAKE CONTROL's word for a float): the levels have FS1 and FS2 as the control does. Not: FS3 and FS4 in the levels and the parts list, in no circuit.",
    function (r) { return asStation(r, { pumps: 2, jobs: ["off", "lead"] }); }),
  K("C-13", "medium", Q, ctl(['float FS1 "off"', 'float FS2 "pump on"', 'coil M1 "pump starter"'], "Simplex"),
    "A one-pump control for a two-pump question: either the station is one pump throughout, or the control is questioned. Not: a control of one pump beside a piping of two, with the sequence saying the alternating relay takes them in turn, and 'the block said 1' said as if the control had been made for two.",
    function (r) { var p = H.plan(r); if (!p) return ""; var nC = p.views.control ? p.views.control.circuit.rungs.filter(function (g) { return /^M\d/.test(g.out.id); }).length : 0, nP = p.views.piping ? p.views.piping.pumps.length : 0; return nC && nP && nC !== nP ? "the control has " + nC + " pump, the piping " + nP + "; the sequence: " + p.sequence.plain[1] : ""; }),
  K("C-14", "medium", Q, ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "high level alarm"'].concat(P2)) + "\n\n" + LEV,
    "A control of three floats (no lag) and a levels drawing of four (with a lag float): each drawn as written, but the disagreement said (the lag float FS3 of the levels is in no circuit, and FS3 is the alarm in the control). Not: drawn and listed as one station without a word, the sequence promising that the lag float runs both pumps.",
    function (r) { var p = H.plan(r); if (!p) return "not drawn: " + r.problems.join("; "); return /disagree|not the same|differ|does not have|is not in/i.test(r.summary + p.said.join(" ")) ? "" : "drawn as one station; sequence: " + p.sequence.plain.join(" ").slice(0, 200); }),
  // ---- one drawing asked: it stays that drawing ----------------------------------------------------------------
  K("C-15", "high", "Draw the control circuit for a duplex lift station with an alternating relay", ctl(CF4.concat(P2)), "One drawing asked: the control only, not read as a station.",
    function (r) { return !r.readAs && r.plan && r.plan.mode === "control" ? "" : "read as " + r.readAs; }),
  K("C-16", "high", "draw the plumbing for a lift station", PIPE, "One drawing asked: the piping only.", function (r) { return !r.readAs && r.plan && r.plan.mode === "piping" ? "" : "read as " + r.readAs; }),
  K("C-17", "high", "draw a section of the wet well showing where the floats go", LEV, "One drawing asked: the levels only.", function (r) { return !r.readAs && r.plan && r.plan.mode === "levels" ? "" : "read as " + r.readAs; }),
  K("C-18", "medium", "Draw the control circuit for a duplex lift station with an alternating relay", ctl(P2), "One drawing asked, the 2B's floatless duplex: the control with the four floats added, not a station.",
    function (r) { return !r.readAs && r.ok && r.plan.mode === "control" && /Lantern added the floats FS1/.test(r.summary) ? "" : "read as " + r.readAs + " / " + (r.problems || []).join("; "); }),
  K("C-19", "low", "Draw the control circuit for a duplex lift station with an alternating relay", H.st(["pumps 2"]),
    "One drawing asked and MAKE STATION written: the control drawn (the question's one drawing), the rest offered or left. Not: all three drawings and a whole station's papers for a question about the control circuit.",
    function (r) { var p = H.plan(r); return p && Object.keys(p.views).length > 1 ? "drew " + Object.keys(p.views).join(", ") + " for a question about the control alone" : ""; }),
  // ---- in Chat and on the bench --------------------------------------------------------------------------------------
  { id: "C-20", harm: "high", input: { question: Q, replies: ["the 35B's MAKE CONTROL"] }, right: "Chat: one call, the station made from the control block, nothing more asked.",
    run: function () { return H.turn(Q, [R[1]]).then(function (t) { var m = t.rec.made; return t.calls === 1 && m && m.ok && m.readAs === "STATION" ? "" : t.calls + " calls, made " + (m && m.readAs) + " " + (m && m.problems); }); } },
  { id: "C-21", harm: "medium", input: { question: Q, replies: ["MAKE SCHEMATIC with the piping's lines", "MAKE STATION"] },
    right: "A plumbing block written as MAKE SCHEMATIC for the whole station: read as the station (its piping as written, the rest made), or the station asked for. Not: only the piping drawn and the turn ended, the control and the float levels neither made nor said to be missing (1.24.30 asked for each missing part).",
    run: function () {
      var SCHP = H.blk("SCHEMATIC", "Lift station", ['well "wet well"', "pump P1", "pump P2", "check CV1 P1", "check CV2 P2", 'header "force main"']);
      return H.turn(Q, [SCHP, H.st(["pumps 2"])]).then(function (t) { var m = t.rec.made; return m && m.plan && m.plan.mode === "station" ? "" : "made " + (m ? (m.readAs || m.plan && m.plan.mode) : "nothing") + " in " + t.calls + " call(s); notes: " + (t.notes.join(" / ") || "none"); });
    } },
  { id: "C-22", harm: "medium", input: { question: Q, replies: ["MAKE DRAWING (a grid picture)", "MAKE STATION"] },
    right: "A picture on the grid for the station's drawings: the station asked for once (1.24.30 asked again for the part, as its second review made it). Not: the picture shown as the answer and the turn ended.",
    run: function () {
      var DRW = H.blk("DRAWING", "Lift station", ['rect 2 2 6 8 "wet well"', 'circle 4 6 1 "pump"']);
      return H.turn(Q, [DRW, H.st(["pumps 2"])]).then(function (t) { var m = t.rec.made; return m && m.plan && m.plan.mode === "station" ? "" : "made " + (m ? (m.action && m.action.id) : "nothing") + " in " + t.calls + " call(s); notes: " + (t.notes.join(" / ") || "none"); });
    } },
  { id: "C-23", harm: "high", input: { question: Q, path: "aiAct.solve", replies: ["the three 1.24.30 blocks"] }, right: "The bench: the three blocks of 1.24.30 pass, read as the station.",
    run: function () {
      var item = H.L().aiBenchQuestions.filter(function (x) { return x.id === "make-liftstation"; })[0];
      return H.solve(Q, [ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "high level alarm"'].concat(P2)) + "\n\n" + PIPE + "\n\n" + LEV.replace(/float FS3 "lag on" 4.5 ft\nfloat FS4 "high level alarm" 5.5 ft/, 'float FS3 "high level alarm" 4.5 ft')]).then(function (s) {
        var g = H.L().aiBench.grade(item, s.out.text, s.out); return g.pass ? "" : g.why;
      });
    } },
  { id: "C-24", harm: "high", input: { question: H.Q_B, path: "aiAct.solve", replies: ["the 2B's floatless control"] }, right: "The bench, set B: the 2B's floatless duplex read as the station (four floats, a lag among them): it passes.",
    run: function () {
      var item = H.L().aiBenchQuestionsB.filter(function (x) { return x.id === "make-liftstation-b"; })[0];
      return H.solve(item.q, [ctl(P2)]).then(function (s) { var g = H.L().aiBench.grade(item, s.out.text, s.out); return g.pass ? "" : g.why; });
    } },
  { id: "C-25", harm: "medium", input: { question: Q, path: "aiAct.solve", replies: ["MAKE SCHEMATIC with the piping's lines"] },
    right: "The bench: a plumbing block written as MAKE SCHEMATIC is not graded as the station (it is not one) -- and the bench asks for what is missing, as Chat should.",
    run: function () {
      var item = H.L().aiBenchQuestions.filter(function (x) { return x.id === "make-liftstation"; })[0];
      var SCHP = H.blk("SCHEMATIC", "Lift station", ['well "wet well"', "pump P1", "pump P2", "check CV1 P1", "check CV2 P2", 'header "force main"']);
      return H.solve(Q, [SCHP, H.st(["pumps 2", "floats off lead alarm"])]).then(function (s) { return s.calls > 1 ? "" : "one call; graded: " + H.L().aiBench.grade(item, s.out.text, s.out).why + " (nothing more asked)"; });
    } }
];
module.exports = cases;
