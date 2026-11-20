// cases_c.js -- C: Chat end to end (Lantern.CHAT.turn) and the bench's path (Lantern.aiAct.solve) with a scripted
// model, for Adam's question and its variants: the 35B's own replies, each part's block, prose, the wrong kind, a part
// wrong twice, all blocks at once, blocks in the wrong order. Checked: the notes the person sees and what the model is
// sent -- each part made once, never said made when it was not, a part not made is said, the turn ends, nothing asked
// for more than twice.
"use strict";
var H = require("./lib.js");
var run35 = require("../liftstation_1230/run_35b.json");
var R = run35.replies.map(function (r) { return r.reply; });
var Q = H.ADAM_Q;
var PIPE = H.blk("PIPING", "Lift station", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', 'header "4 in force main"', 'vent']);
var LEV = H.blk("LEVELS", "Wet well", ['well "wet well" 10 ft', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS4 "high level alarm" 5.5 ft', 'inlet "inlet invert" 6.5 ft']);
var CTL = H.ctl(['supply "120 V AC"', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'], "Duplex pump station");
var DRW = H.blk("DRAWING", "Floats", ['rect 10 10 100 200 "wet well"', 'circle 50 150 10 "float"']);
var BADP = H.blk("PIPING", "Lift station", ['pump P1 P9 zz', 'blah blah']);
var PROSE = "The piping has a check valve and a gate valve on each pump, joined into a header that leaves as the force main.";
// the kinds a note says Lantern made ("Lantern made MAKE CONTROL and MAKE PIPING; now ...")
function saidMade(notes) {
  var k = {};
  notes.forEach(function (n) { var m = /Lantern made ((?:MAKE [A-Z]+(?:, | and )?)+)/.exec(n); if (m) m[1].replace(/MAKE ([A-Z]+)/g, function (s, x) { k[x] = 1; }); });
  return Object.keys(k);
}
// e: {made: [kinds made, in any order], notMade: [kinds a note must say were not made], maxCalls}
function check(t, e) {
  if (t.error) return "the turn threw: " + t.error.slice(0, 300);
  var out = [], ok = t.mades.filter(function (m) { return !/not made/.test(m); });
  var want = e.made.slice().sort().join(","), got = ok.slice().sort().join(",");
  if (got !== want) out.push("made " + (ok.join(", ") || "nothing") + " (want " + e.made.join(", ") + ")");
  saidMade(t.notes).forEach(function (k) { if (e.made.indexOf(k) < 0) out.push("a note says MAKE " + k + " was made"); });
  (e.notMade || []).forEach(function (k) { if (!t.notes.some(function (n) { return new RegExp("MAKE " + k + "\\)? (block for the \\w+ part, (so it|and that part) )?was not made|\\(MAKE " + k + "\\) was not made").test(n); })) out.push("nothing says MAKE " + k + " was not made"); });
  if (e.maxCalls && t.calls > e.maxCalls) out.push(t.calls + " calls (at most " + e.maxCalls + ")");
  // nothing asked for more than twice: the prompts that ask for each kind
  var asks = {};
  t.sent.slice(1).forEach(function (s) { var m = /(?:Reply with ONLY its MAKE ([A-Z]+) block|Lantern reads it like this:\nMAKE ([A-Z]+):|Its first line is:\nMAKE ([A-Z]+):)/.exec(s); if (m) { var k = m[1] || m[2] || m[3]; asks[k] = (asks[k] || 0) + 1; } });
  Object.keys(asks).forEach(function (k) { if (asks[k] > 2) out.push("MAKE " + k + " asked for " + asks[k] + " times"); });
  return out.join("; ");
}
function T(id, harm, q, replies, e, right, more) {
  return { id: id, harm: harm, input: { question: q, replies: replies.map(function (r) { return r.slice(0, 60).replace(/\n/g, " / ") + (r.length > 60 ? "..." : ""); }) }, right: right,
    run: function () { return H.turn(q, replies).then(function (t) { return check(t, e) || (more ? more(t) : ""); }); } };
}
function S(id, harm, q, replies, parts, right) {
  return { id: id, harm: harm, input: { question: q, path: "aiAct.solve", replies: replies.map(function (r) { return r.slice(0, 60).replace(/\n/g, " / "); }) }, right: right,
    run: function () { return H.solve(q, replies).then(function (s) { return s.parts.join(",") === parts.join(",") ? "" : "parts " + (s.parts.join(", ") || "none") + " (want " + parts.join(", ") + ") in " + s.calls + " calls"; }); } };
}
var cases = [
  T("C-01", "high", Q, [R[0], R[1], R[2], PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 5 },
    "The 35B's own replies: prose (asked for the block), its control block (made), its second control block when the piping is asked for (asked again, not shown), then the piping and the levels: all three made once."),
  T("C-02", "high", Q, [R[0], R[1], PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 4 }, "Prose, then each part's block in turn."),
  T("C-03", "high", Q, [R[1] + "\n\n" + PIPE + "\n\n" + LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 1 }, "All three blocks in one reply: all made, no more calls."),
  T("C-04", "high", Q, [LEV, PIPE, R[1]], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 3 }, "Blocks in the wrong order (levels, piping, control): each taken for its part."),
  T("C-05", "high", Q, [R[1], PROSE, PROSE + " Really.", LEV], { made: ["CONTROL", "LEVELS"], notMade: ["PIPING"], maxCalls: 4 }, "Prose twice for the piping: left and said; the levels asked for and made."),
  T("C-06", "high", Q, [R[1], BADP, BADP, LEV], { made: ["CONTROL", "LEVELS"], notMade: ["PIPING"], maxCalls: 4 }, "The piping block wrong twice: not made, said; the levels asked for."),
  T("C-07", "high", Q, [R[1], R[1], R[1], R[1], R[1], R[1]], { made: ["CONTROL"], notMade: ["PIPING", "LEVELS"], maxCalls: 5 }, "The control block again and again: each later part asked for once more, then left and said; the turn ends."),
  T("C-08", "medium", Q, [R[0], R[0], PIPE, LEV], { made: ["PIPING", "LEVELS"], notMade: ["CONTROL"], maxCalls: 4 },
    "The first part answered with prose twice (the 35B's first reply, twice): the control is left and said, and the piping and levels are asked for, as for any later part. Not: the turn ends after two calls with nothing made and nothing asked for the other two parts."),
  T("C-09", "high", Q, [H.ctl(['float FS1 "off"', 'alternator AR M1 M2 M3', 'coil M1', 'coil M2', 'coil M3']), H.ctl(['float FS1 "off"', 'alternator AR M1 M2 M3', 'coil M1', 'coil M2', 'coil M3']), PIPE, LEV],
    { made: ["PIPING", "LEVELS"], notMade: ["CONTROL"], maxCalls: 4 }, "The control block wrong twice (three pumps on one alternator): left and said; the piping and levels made."),
  T("C-10", "low", Q, [R[0] + "\n\n" + PIPE, PIPE, R[1], LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 4 },
    "Prose and the piping block first (taken for the piping); the piping again when the control is asked for: asked again for the control, and the second piping not shown or counted as made (it is shown again and listed twice in rec.mades: the person sees the piping drawn twice).",
    function (t) { var n = t.mades.filter(function (m) { return m === "PIPING"; }).length; return n > 1 ? "the piping is shown and counted " + n + " times (rec.mades: " + t.mades.join(", ") + ")" : ""; }),
  T("C-11", "low", Q, [PIPE + "\n\n" + LEV, R[1], LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 2 },
    "The piping and the levels in the first reply, then the control: all three made in two calls (the levels block already written is built). Lantern drops it and asks for it again (three calls).",
    function (t) { return ""; }),
  T("C-12", "high", Q, [R[1] + "\n" + R[1].replace("MAKE CONTROL", "MAKE SCHEMATIC"), PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 3 }, "The control twice in one reply (CONTROL and SCHEMATIC): one control made."),
  T("C-13", "high", Q, [R[1], PIPE, DRW, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 4 }, "A picture on the grid (MAKE DRAWING) for the float levels: asked again for MAKE LEVELS, then made; the picture not shown as the part."),
  T("C-14", "high", Q, [R[1], PIPE, DRW, DRW], { made: ["CONTROL", "PIPING"], notMade: ["LEVELS"], maxCalls: 4 }, "MAKE DRAWING twice for the levels: left and said."),
  { id: "C-15", harm: "high", input: { question: Q, replies: ["R0", "R1", "PIPE", "LEV"] },
    right: "What the model is sent: the first instructions carry the list of the three parts and only MAKE CONTROL's guide (with the pump lines); the piping part's request carries MAKE PIPING's guide and the station it is for; the levels part's MAKE LEVELS's guide; never another tool's.",
    run: function () {
      return H.turn(Q, [R[0], R[1], PIPE, LEV]).then(function (t) {
        var first = t.bodies[0].messages.map(function (m) { return H.textOf(m.content); }).join("\n"), out = [];
        if (!/This question asks for 3 things/.test(first)) out.push("no list of the parts in the instructions");
        if (/MAKE PIPING:|MAKE LEVELS:/.test(first)) out.push("the first instructions carry the piping or levels guide");
        if (!/alternator AR M1 M2/.test(first)) out.push("the first instructions lack the alternator line");
        var p2 = t.sent[2] || "", p3 = t.sent[3] || "";
        if (!/MAKE PIPING:/.test(p2) || /MAKE LEVELS:|MAKE CONTROL:/.test(p2)) out.push("the piping request: " + p2.slice(0, 200));
        if (!/lift station/.test(p2)) out.push("the piping request does not say what it is for");
        if (!/MAKE LEVELS:/.test(p3) || /MAKE PIPING:|MAKE CONTROL:/.test(p3)) out.push("the levels request: " + p3.slice(0, 200));
        return out.join("; ");
      });
    } },
  T("C-16", "low", "Draw a 2 pump lift station: the control, the plumbing and the float positions", [CTL, PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 3 }, "A heading and a list: three parts, each made.",
    function (t) { return /2 pump lift station/.test(t.sent[1] || "") ? "" : "the piping request does not carry the station: " + (t.sent[1] || "").slice(0, 160); }),
  T("C-17", "high", "1) draw the control circuit for a duplex pump station 2) draw its piping 3) draw the float levels", [CTL, PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 3 }, "A numbered list."),
  T("C-18", "high", "Draw the control circuit for a duplex lift station, and draw the float levels in its wet well", [CTL, LEV], { made: ["CONTROL", "LEVELS"], maxCalls: 2 }, "Two parts."),
  T("C-19", "high", "Draw the control circuit for a typical 2 pump lift station with an alternating relay", ["Here it is.\n" + CTL], { made: [], maxCalls: 1 },
    "One thing: made in one call; no part notes (rec.mades is for a question in parts).",
    function (t) { return t.rec.made && t.rec.made.ok && !t.notes.some(function (n) { return /of the \d things/.test(n); }) ? "" : "rec.made " + (t.rec.made && t.rec.made.ok) + "; notes " + t.notes.join(" | "); }),
  { id: "C-20", harm: "high", input: { question: "Draw the control circuit for a typical 2 pump lift station with an alternating relay", replies: ["floats and starters, no alternator", "the example"] },
    right: "One thing, answered without the alternating relay: back once with the alternator line; the next block made.",
    run: function () {
      var noAlt = H.ctl(['float FS1 M1 "off"', 'float FS2 M1 "lead on"', 'float FS3 M2 "lag on"', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']);
      return H.turn(this.input.question, [noAlt, CTL]).then(function (t) {
        if (t.error) return t.error;
        return /alternator AR M1 M2/.test(t.sent[1] || "") && t.rec.made && t.rec.made.ok && t.calls === 2 ? "" : "calls " + t.calls + "; sent back: " + (t.sent[1] || "").slice(0, 300);
      });
    } },
  T("C-21", "high", Q, ["Here is the first part.\n\n" + R[1] + "\n\nNext I will draw the piping.", "Now the piping:\n" + PIPE, "And the levels:\n" + LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 3 }, "Prose around each block."),
  T("C-22", "high", Q, [H.ctl(['float FS1 "off"', 'alternator AR M1 M2 M3', 'coil M1', 'coil M2', 'coil M3']), CTL, PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 4 }, "The control wrong once, then right: one correction, then on."),
  T("C-23", "high", Q, [R[1], BADP, PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 4 }, "The piping wrong once, then right."),
  T("C-24", "medium", Q, [R[1], LEV, PIPE], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 3 }, "The levels written when the piping is asked for (a part still to make): taken, and the piping asked for."),
  T("C-25", "high", "Draw the plumbing schematic and the float level drawing for a duplex lift station", [PIPE, LEV], { made: ["PIPING", "LEVELS"], maxCalls: 2 }, "Piping and levels."),
  T("C-26", "medium", Q, [R[0], R[1], PROSE, PIPE, LEV], { made: ["CONTROL", "PIPING", "LEVELS"], maxCalls: 5 }, "Prose once for the piping, then its block: made."),

  S("C-30", "high", Q, [R[0], R[1], PIPE, LEV], ["CONTROL", "PIPING", "LEVELS"], "The bench's path: the 35B's prose, its block, then the piping and levels."),
  S("C-31", "high", Q, [R[1] + "\n\n" + PIPE + "\n\n" + LEV], ["CONTROL", "PIPING", "LEVELS"], "The bench's path: all at once."),
  S("C-32", "high", Q, [R[1], PROSE, PROSE, LEV], ["CONTROL", "PIPING(not made)", "LEVELS"], "The bench's path: prose twice for the piping."),
  S("C-33", "high", Q, [R[1], R[1], R[1], R[1], R[1]], ["CONTROL", "PIPING(not made)", "LEVELS(not made)"], "The bench's path: the control again and again."),
  S("C-34", "medium", Q, [R[0], R[0], PIPE, LEV], ["CONTROL(not made)", "PIPING", "LEVELS"], "The bench's path, the first part prose twice: the control left, the other two asked for and made (as C-08)."),
  S("C-35", "high", Q, [LEV, PIPE, R[1]], ["LEVELS", "PIPING", "CONTROL"], "The bench's path, blocks in the wrong order."),
  S("C-36", "high", Q, [R[1], BADP, BADP, LEV], ["CONTROL", "PIPING(not made)", "LEVELS"], "The bench's path, the piping wrong twice.")
];
module.exports = cases;
