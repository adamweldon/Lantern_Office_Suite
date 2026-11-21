// cases_f.js -- F: the grammars (AI_ACTIONS' grammarFor), read with llama.cpp's own grammar parser (tools/gbnf_check.py,
// libllama b11435, a vocabulary-only Qwen2 model): right blocks let through -- Lantern's own, the lines its parsers read,
// the lines it hands back in a correction -- and replies that are not a block held out. grammar_cases.json is written by
// make_grammar.js, grammar_results.json by gbnf_check.py (see make_grammar.js); F-01 checks the grammars there are still
// the ones Lantern writes, so a stale result is not read as a pass. Then when a grammar is sent: only after Lantern asked
// for only a block, only to llama.cpp, held to the kind the correction asks for.
"use strict";
var H = require("./lib.js");
var fs = require("fs"), path = require("path");
var CASES = JSON.parse(fs.readFileSync(path.join(__dirname, "grammar_cases.json"), "utf8"));
var RES = JSON.parse(fs.readFileSync(path.join(__dirname, "grammar_results.json"), "utf8"));
function res(name) { return RES.filter(function (r) { return r.name === name; })[0]; }
// a group of samples: each does what the reviewer wants (accepted when right, held when not)
function G(id, harm, name, right) {
  return { id: id, harm: harm, input: { grammar: name, samples: (CASES.filter(function (c) { return c.name === name; })[0] || { samples: [] }).samples.map(function (s) { return (s.want ? "+ " : "- ") + s.text.replace(/\n/g, " | ").slice(0, 120); }) }, right: right,
    run: function () { var r = res(name); if (!r) return "no result for " + name; if (!r.parsed) return "llama.cpp did not parse the grammar";
      var bad = r.samples.filter(function (s) { return !s.agree; }); return bad.map(function (s) { return (s.want ? "held out (token " + s.heldAtToken + "): " : "let through: ") + s.text.replace(/\n/g, " | ").slice(0, 100); }).join(" ;; "); } };
}
var Q = "Design a duplex lift station: draw the control circuit, the piping and the float levels";
function gk(x) { var m = x && /^root ::= "MAKE ([A-Z ]+): "/.exec(x); return m ? m[1] : "-"; }
module.exports = [
  { id: "F-01", harm: "high", input: { file: "grammar_cases.json" }, right: "The grammars read with llama.cpp are the ones Lantern writes now (else the results below are stale).",
    run: function () { return H.boot().then(function () { var bad = CASES.filter(function (c) { return H.L().aiAct.grammarFor(c.kind) !== c.grammar; }).map(function (c) { return c.name; }); return bad.length ? "stale: " + bad.join(", ") + " (rerun make_grammar.js and gbnf_check.py)" : ""; }); } },
  { id: "F-02", harm: "high", input: { file: "grammar_results.json" }, right: "llama.cpp's parser reads every grammar (a grammar it refuses is a request the server refuses).",
    run: function () { var bad = RES.filter(function (r) { return !r.parsed; }).map(function (r) { return r.name; }); return RES.length !== CASES.length ? "results for " + RES.length + " of " + CASES.length : bad.length ? "not parsed: " + bad.join(", ") : ""; } },
  G("F-03", "high", "own CONTROL blocks", "Every MAKE CONTROL block Lantern itself writes for a station (eight stations) passes the CONTROL grammar."),
  G("F-04", "high", "own PIPING blocks", "Every MAKE PIPING block Lantern writes for a station passes the PIPING grammar."),
  G("F-05", "high", "own LEVELS blocks", "Every MAKE LEVELS block Lantern writes for a station passes the LEVELS grammar."),
  G("F-06", "high", "STATION right", "Right MAKE STATION blocks pass: the guide's own lines; heights; colons, capitals, bullets, numbers, indents, a blank line; curly quotes; a tag first; LSHH1; duplex; the alarm and low level floats by name; valve and check kinds; show and note; inch marks; shut-off; rising main."),
  G("F-07", "high", "STATION right", "Replies that are not one MAKE STATION block are held: a preface, a code fence round it or in it, **bold**, a sentence as a line, text after END, no title, a second block, a wiring sentence. (Same group as F-06: every sample agrees.)"),
  G("F-08", "low", "STATION read but held", "“2 pumps” and “Two submersible pumps” are lines the parser reads (LEADS); the grammar holds them out (its first words take no number and no “two”), so a model that would write them is steered elsewhere."),
  G("F-09", "low", "STATION prose on a role word", "Prose is held out. A sentence that begins with a word the grammar takes (“Pump 1 and pump 2 take turns ...”, “Floats are set ...”) is let through -- and the first is read as a count of one pump (C cases: the first number on a pumps line)."),
  { id: "F-10", harm: "low", input: { line: "Pump 1 and pump 2 take turns, so they wear evenly." }, right: "The prose line F-09 lets through, in a block for a question with no count: two pumps, or not read. Read as one pump: a simplex drawn.",
    run: function () { return H.boot().then(function () { var r = H.L().aiAct.build(H.st(["Pump 1 and pump 2 take turns, so they wear evenly."]), "Design a lift station: the control circuit, the piping and the float levels"); return H.pumpsOf(r) === 2 ? "" : "read as " + H.pumpsOf(r) + " pump"; }); } },
  G("F-11", "medium", "LIFT STATION", "A block kind's other name holds to that name: MAKE LIFT STATION."),
  G("F-12", "high", "CONTROL right", "Right MAKE CONTROL lines pass (supply, floats, alternator, coils, lamps, horn, stop/start, overload, fuse, estop, interlock, note, level, alternating, contactor, light, switch, relay, timer, solenoid, limit, pressure, temp, motor starter, push button, emergency stop, pilot light); a rung in words, a wire line and text after END are held."),
  G("F-13", "high", "PIPING right", "Right MAKE PIPING lines pass; a sentence is held."),
  G("F-14", "high", "LEVELS right", "Right MAKE LEVELS lines pass (job-first lines, floor, LSHH1, FS1: off at 2 ft); a sentence is held."),
  G("F-15", "medium", "SLIDES", "A kind with no words of its own: any lines, but the block first."),
  G("F-16", "medium", "SHEET", "A sheet: its rows; text after END cannot end the reply."),
  G("F-17", "high", "CONTROL fix lines", "The lines Lantern hands back in a MAKE CONTROL correction (“like: ...”), written as they stand, pass the CONTROL grammar the correction is held to."),
  G("F-18", "high", "LEVELS fix lines", "The line handed back for heights left out (spread evenly) passes the LEVELS grammar."),
  G("F-19", "high", "STATION fix lines", "The station's fix hint, the disagreement's line and the duplex line handed back in a MAKE STATION correction pass the STATION grammar (they pass; whether they are right lines is D-02 and D-11)."),
  G("F-20", "medium", "STATION guide copied", "The whole guide copied into a block (the 0.8B's way) is held out by the grammar: the model has to write lines."),
  { id: "F-27", harm: "high", input: { grammar: "bench ideals <KIND>", samples: "every bench ideal's MAKE block (sets A and B), under its own kind's grammar" },
    right: "Since 1.24.31 every tool's correction on llama.cpp is held to its kind's grammar (MUSIC, DRAWING, CODE, CARDS, DOC, WHEEL ... -- A-56), so each kind's grammar must let its right block through: every bench ideal passes its own kind's grammar.",
    run: function () { var rs = RES.filter(function (r) { return /^bench ideals /.test(r.name); }); if (rs.length < 10) return "only " + rs.length + " kinds";
      var bad = []; rs.forEach(function (r) { if (!r.parsed) bad.push(r.name + " not parsed"); r.samples.forEach(function (x) { if (!x.agree) bad.push(r.name + ": " + x.text.slice(0, 60)); }); }); return bad.join(" ;; "); } },
  // --- when a grammar is sent -------------------------------------------------------------------------------------
  { id: "F-21", harm: "high", input: { question: Q, replies: ["MAKE STATION with floats out of order", "MAKE STATION corrected"] },
    right: "Chat: the first call never carries a grammar; the correction carries the STATION grammar.",
    run: function () { return H.boot().then(function () { return H.turn(Q, [H.st(["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]), H.st(["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft"])]).then(function (t) {
      var gs = t.grammars.map(gk).join(","); return gs === "-,STATION" && t.rec.made && t.rec.made.ok ? "" : "grammars " + gs; }); }); } },
  { id: "F-22", harm: "high", input: { question: Q, server: "not llama.cpp (no /props)", replies: ["MAKE STATION with floats out of order", "corrected"] },
    right: "Chat with a server that is not llama.cpp: no grammar on any call.",
    run: function () { return H.boot().then(function () { var A = H.L().ai, l0 = A.server.llama; A.server.llama = false;
      return H.turn(Q, [H.st(["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]), H.st(["pumps 2"])]).then(function (t) { A.server.llama = l0; var gs = t.grammars.map(gk).join(","); return gs === "-,-" ? "" : "grammars " + gs; }); }); } },
  { id: "F-23", harm: "high", input: { question: "Draw a start/stop motor starter circuit with a run light", replies: ["MAKE CONTROL with a coil nothing switches", "the line handed back, written"] },
    right: "Another tool's correction (not a station): held to that block's grammar (CONTROL), and the reply written with the line handed back is drawn.",
    run: function () { return H.boot().then(function () { var q = "Draw a start/stop motor starter circuit with a run light";
      return H.turn(q, function (last, i) { if (!i) return H.ctl(['coil M1 "motor starter"', 'lamp LT1 M1 "run" green']); var m = /like: ([^,;\n]*)/.exec(last); return H.ctl(['stop PB1', m ? m[1] : 'start PB2 M1', 'coil M1 "motor starter"', 'lamp LT1 M1 "run" green']); }).then(function (t) {
        var gs = t.grammars.map(gk).join(","); return gs === "-,CONTROL" && t.rec.made && t.rec.made.ok ? "" : "grammars " + gs + ", made " + (t.rec.made && t.rec.made.ok) + " " + t.notes.join(" | ").slice(0, 300); }); }); } },
  { id: "F-24", harm: "medium", input: { question: "Draw the plumbing schematic for a duplex sewage lift station", reply: "MAKE PIPING with a float line" },
    right: "A correction that tells the model to write another kind (“the floats go in MAKE LEVELS”) is not held to the block's own grammar: no grammar.",
    run: function () { return H.boot().then(function () { var q = "Draw the plumbing schematic for a duplex sewage lift station";
      var r = H.L().aiAct.build(H.blk("PIPING", "Lift station", ['pump P1', 'pump P2', 'float FS1 off', 'gizmo X1']), q);
      return !r.ok && H.L().aiAct.fixKind(r) === null ? "" : "ok " + r.ok + ", fixKind " + H.L().aiAct.fixKind(r) + ": " + (r.problems || []).join("; "); }); } },
  { id: "F-25", harm: "medium", input: { question: Q, path: "solve", replies: ["MAKE DRAWING: a picture", "MAKE STATION"] },
    right: "The bench's path: a station question answered with a picture is asked once for MAKE STATION, that call held to the STATION grammar, and the station is made.",
    run: function () { return H.boot().then(function () { return H.solve(Q, ["MAKE DRAWING: Lift station\nrect 2 2 6 6 fill grey\nEND", H.st(["pumps 2"])]).then(function (s) {
      var gs = s.opts.map(function (o) { return o && o.grammar ? gk(o.grammar) : "-"; }).join(","); return gs === "-,STATION" && s.out.made && s.out.made.ok && s.out.made.plan.mode === "station" ? "" : "grammars " + gs + ", made " + (s.out.made && s.out.made.plan && s.out.made.plan.mode); }); }); } },
  { id: "F-26", harm: "medium", input: { kinds: ["LADDER DIAGRAM", "CONTROL CIRCUIT", "SCHEMATIC", "ELECTRONICS"] },
    right: "A control block's other names get the CONTROL words; SCHEMATIC and ELECTRONICS (parts and wires, any line) get none.",
    run: function () { return H.boot().then(function () { var G = H.L().aiAct.grammarFor; var c = G("CONTROL").split("\n").slice(1).join("\n");
      var ok = G("LADDER DIAGRAM").split("\n").slice(1).join("\n") === c && G("CONTROL CIRCUIT").split("\n").slice(1).join("\n") === c && /line ::= \[\^\\n\]\*/.test(G("SCHEMATIC")) && /line ::= \[\^\\n\]\*/.test(G("ELECTRONICS"));
      return ok ? "" : "LADDER " + (G("LADDER DIAGRAM") || "").slice(0, 80) + " / SCHEMATIC " + (G("SCHEMATIC") || "").slice(-40); }); } }
];
