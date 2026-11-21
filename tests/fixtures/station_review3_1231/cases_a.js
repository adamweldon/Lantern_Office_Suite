// cases_a.js -- A: over-reach. Plain questions and right blocks that must not change: every bench question, every
// bench ideal and every model reply kept in the bench runs, beside 1.24.30 (ad0d654); questions about a station that ask
// for nothing to be made; machines that are not a wet well's pumps but are named beside sewage or storm water; right
// MAKE CONTROL circuits (the floatless duplex mend must ask what else the circuit can be); MAKE PIPING and MAKE LEVELS
// for one drawing, and the small mends there.
"use strict";
var H = require("./lib.js");

// a question's tool, split and prompt as 1.24.30 had them
function sameRoute(q) {
  var a = H.ids(q), b = H.ids(q, "old"), c = H.split(q), d = H.split(q, "old");
  var pa = H.L().aiAct.prompt(q), pb = H.L0().aiAct.prompt(q);
  if (a !== b || c !== d) return "tools " + a + " (1.24.30: " + b + "), split " + c + " (1.24.30: " + d + ")";
  if (pa !== pb) return "the prompt differs from 1.24.30's";
  return "";
}
function notStation(q) { return H.L().aiStation.asks(q) ? "read as a station: offered " + H.ids(q) + " (1.24.30: " + (H.ids(q, "old") || "none") + ")" : ""; }
function Q(id, harm, q, right, judge) { return { id: id, harm: harm, input: { question: q }, right: right, run: function () { return H.boot().then(function () { return judge(q); }); } }; }
// a block built in both versions: the same circuit (sig)
function same(q, text) {
  var a = H.sig(H.L().aiAct.build(text, q)), b = H.sig(H.L0().aiAct.build(text, q));
  return a === b ? "" : "drawn differently from 1.24.30:\n NOW " + a.replace(/\n/g, " / ") + "\n 1.24.30 " + b.replace(/\n/g, " / ");
}
function B(id, harm, q, text, right, judge) { return { id: id, harm: harm, input: { question: q, reply: text }, right: right, run: function () { return H.boot().then(function () { return judge ? judge(H.L().aiAct.build(text, q), q, text) : same(q, text); }); } }; }
function added(r) { var c = r && r.plan && (r.plan.circuit || (r.plan.views && r.plan.views.control && r.plan.views.control.circuit)); return c ? (c.added || []).join(" | ") : ""; }
var LIFT = "Draw the control circuit for a duplex lift station with an alternating relay";
var P2 = ['alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'];

module.exports = [
  // --- every bench question, ideal and reply ----------------------------------------------------------------------
  { id: "A-01", harm: "high", input: { question: "every bench question (sets A and B)" },
    right: "Every bench question but the two lift stations is offered the tools, split and prompt 1.24.30 gave it: MAKE STATION is new, and nothing else asked for changes.",
    run: function () { return H.boot().then(function () {
      var bad = H.bench().filter(function (it) { return !/^make-liftstation/.test(it.id) && sameRoute(it.q); }).map(function (it) { return it.id + ": " + sameRoute(it.q); });
      return bad.length ? bad.length + " differ: " + bad.slice(0, 5).join(" ;; ") : ""; }); } },
  { id: "A-02", harm: "high", input: { question: "every bench question" },
    right: "Of all the bench questions only the two lift stations read as a station (asks).",
    run: function () { return H.boot().then(function () { var st = H.bench().filter(function (it) { return H.L().aiStation.asks(it.q); }).map(function (it) { return it.id; }).sort().join(","); return st === "make-liftstation,make-liftstation-b" ? "" : st; }); } },
  { id: "A-03", harm: "high", input: { question: "every bench question with a model answer (ideal)" },
    right: "Every bench ideal but the lift stations' solves as on 1.24.30: the same grade, rounds, summary and problems (the bench's path, AI_ACTIONS.solve).",
    run: function () { return H.boot().then(async function () {
      var by0 = {}, bad = []; H.bench0().forEach(function (it) { by0[it.id] = it; });
      function seq(t) { return function () { return Promise.resolve(t); }; }
      for (var i = 0; i < H.bench().length; i++) {
        var it = H.bench()[i], it0 = by0[it.id];
        if (!it.ideal || /^make-liftstation/.test(it.id)) continue;
        var r1 = await H.L().aiAct.solve(it.q, seq(it.ideal)), r0 = await H.L0().aiAct.solve(it0.q, seq(it0.ideal));
        var g1 = H.L().aiBench.grade(it, r1.text, r1), g0 = H.L0().aiBench.grade(it0, r0.text, r0);
        var s1 = JSON.stringify([g1.pass, r1.rounds, r1.made && r1.made.summary, r1.made && r1.made.problems]), s0 = JSON.stringify([g0.pass, r0.rounds, r0.made && r0.made.summary, r0.made && r0.made.problems]);
        if (s1 !== s0) bad.push(it.id);
      }
      return bad.length ? bad.join(", ") : ""; }); } },
  { id: "A-04", harm: "high", input: { question: "every model reply with a MAKE block kept in tests/fixtures/bench_run_*.json (284 distinct)" },
    right: "Every reply the 35B, 9B, 4B, 2B and 0.8B wrote on the bench is read and drawn as 1.24.30 drew it (ok, problems, summary).",
    run: function () { return H.boot().then(function () {
      var rows = H.benchReplies(), bad = [];
      function s(r) { return r ? JSON.stringify([r.ok, r.readAs || "", (r.problems || []).join(";"), r.summary || ""]) : "null"; }
      rows.forEach(function (r) { var a, b; try { a = s(H.L().aiAct.build(r.reply, r.q)); } catch (e) { a = "threw " + e; } try { b = s(H.L0().aiAct.build(r.reply, r.q)); } catch (e) { b = "threw " + e; } if (a !== b) bad.push(r.f + " " + r.id); });
      return rows.length < 200 ? "only " + rows.length + " replies found" : bad.length ? bad.length + " differ: " + bad.slice(0, 6).join(", ") : ""; }); } },

  { id: "A-55", harm: "high", input: { question: "every bench reply kept in tests/fixtures/bench_run_*.json, on the bench's path (the reply repeated for any further call)" },
    right: "Each graded as 1.24.30 graded it: the same pass, reason and rounds.",
    run: function () { return H.boot().then(async function () {
      var by = {}, by0 = {}, bad = [], rows = H.benchReplies(); H.bench().forEach(function (i) { by[i.id] = i; }); H.bench0().forEach(function (i) { by0[i.id] = i; });
      for (var k = 0; k < rows.length; k++) { var r = rows[k], it = by[r.id], it0 = by0[r.id]; if (!it || !it0) continue;
        var f = function () { return Promise.resolve(r.reply); };
        var a = await H.L().aiAct.solve(it.q, f), b = await H.L0().aiAct.solve(it0.q, f), ga = H.L().aiBench.grade(it, a.text, a), gb = H.L0().aiBench.grade(it0, b.text, b);
        if (ga.pass !== gb.pass || ga.why !== gb.why || a.rounds !== b.rounds) bad.push(r.f + " " + r.id); }
      return bad.length ? bad.length + " differ: " + bad.slice(0, 6).join(", ") : ""; }); } },
  { id: "A-56", harm: "high", input: { question: "every bench reply kept in tests/fixtures/bench_run_*.json, as a whole Chat turn (the reply repeated for any further call)" },
    right: "Each Chat turn as on 1.24.30: the same number of calls, the same things made, the same number of notes. (The one change: a correction's call now carries its kind's grammar on llama.cpp -- 39 of these turns, MUSIC, DRAWING, CODE, CARDS, DOC, WHEEL; F-27 checks those grammars let the right blocks through.)",
    run: function () { return H.boot().then(async function () {
      var rows = H.benchReplies(), bad = [];
      for (var k = 0; k < rows.length; k++) { var r = rows[k], a = await H.turn(r.q, [r.reply]), b = await H.turn(r.q, [r.reply], "old");
        if (JSON.stringify([a.calls, a.mades, a.notes.length, a.error || ""]) !== JSON.stringify([b.calls, b.mades, b.notes.length, b.error || ""])) bad.push(r.f + " " + r.id); }
      return bad.length ? bad.length + " differ: " + bad.slice(0, 6).join(", ") : ""; }); } },

  // --- questions about a station that ask for nothing to be made ---------------------------------------------------
  Q("A-05", "medium", "What is a lift station?", "A question of what, answered in words: no tool.", notStation),
  Q("A-06", "medium", "How does a duplex lift station's alternating relay work?", "Explained in words: no tool.", notStation),
  Q("A-07", "medium", "Why does my lift station's high level alarm keep going off?", "Trouble-shooting in words: no tool.", notStation),
  Q("A-08", "medium", "Explain the float levels in a wet well", "Explained in words: no tool (and not a station).", notStation),
  Q("A-09", "medium", "How deep should a wet well be for a lift station?", "A design question answered in words.", notStation),
  Q("A-10", "medium", "What parts do I need for a duplex lift station?", "Answered in words; not a station to draw (this one held).", notStation),
  Q("A-11", "medium", "How do I design a lift station?",
    "A question of how, answered in words. MAKE STATION offered alone, under instructions that say “Reply with ONE block”, is what a small model copies: the person asked how, and would be handed drawings.", notStation),
  Q("A-12", "medium", "Should I design my lift station with two pumps or three?", "A choice to be explained (the case for two and for three), not a station to draw.", notStation),
  Q("A-13", "low", "What does a lift station parts list usually include?", "A question about parts lists in general; not a station to draw.", notStation),
  Q("A-14", "low", "Can you explain the sequence of operation of a duplex lift station?", "Explain, in words; “sequence of operation” alone must not make it a station.", notStation),
  Q("A-15", "low", "Why would someone design a sewage lift station with a high level alarm?", "A question of why.", notStation),
  Q("A-16", "low", "Explain how to make a lift station's alarm reliable", "Explain, in words (backup power, telemetry): not a station to draw.", notStation),

  // --- machines beside sewage or storm water that are not a wet well's pumps ---------------------------------------
  // What else can it be (rule 7)? Each of these is a sewage works' or a storm station's other machine. 1.24.30 offered the
  // control circuit and the piping tools; offered MAKE STATION alone, the person gets a duplex pump station's drawings.
  Q("A-17", "high", "Draw the control circuit and the piping for a sewage treatment plant's aeration blower", "A blower's starter and air piping: not a pump station.", notStation),
  Q("A-18", "medium", "Draw the control circuit and the piping for a wastewater sampler", "A sampler: not a pump station.", notStation),
  Q("A-19", "medium", "Draw the wiring and piping of a wastewater treatment plant's chlorine contact tank", "A contact tank: not a pump station.", notStation),
  Q("A-20", "high", "Draw the control circuit and piping for a vacuum sewer station", "A vacuum station runs vacuum pumps and a collection tank, not floats and an alternating relay.", notStation),
  Q("A-21", "high", "Draw the control circuit and the piping for a sewage pump station's standby generator", "The generator's transfer and fuel: not the pumps' station drawings.", notStation),
  Q("A-22", "medium", "Draw the control circuit and piping for a sewer jetting truck", "A truck: not a pump station.", notStation),
  Q("A-23", "medium", "Draw the control wiring and piping for a storm water detention pond's sluice gate", "A gate's actuator: not a pump station.", notStation),
  Q("A-24", "medium", "Draw the control circuit and the piping for a sewage sludge belt press", "A press: not a pump station.", notStation),
  Q("A-25", "medium", "Draw the control circuit and piping for a wastewater UV disinfection system", "UV lamps: not a pump station.", notStation),
  Q("A-26", "medium", "Draw the control circuit and the piping for a storm water pump station's trash rake", "The rake's starter: not the station's pumps.", notStation),
  Q("A-27", "medium", "Draw the electrical and piping for the sewage plant's digester mixing pumps", "Mixing pumps in a digester: not a wet well's lift pumps on floats.", notStation),
  { id: "A-57", harm: "high", input: { question: "Draw the control circuit and the piping for a sewage treatment plant's aeration blower", replies: ["MAKE CONTROL: a blower's start/stop starter with its overload and run light", "MAKE STATION (what a model writes when told to)"] },
    right: "Chat: the model's right blower starter is kept (and the piping asked for, as 1.24.30 did). Lantern told the model “the question asks for a pump station”, held the next call to the STATION grammar, and the turn ends with a duplex pump station: the blower's circuit is not what is shown.",
    run: function () { return H.boot().then(function () { var q = "Draw the control circuit and the piping for a sewage treatment plant's aeration blower";
      return H.turn(q, [H.ctl(['stop PB1', 'start PB2 M1', 'overload OL1 M1', 'coil M1 "blower starter"', 'lamp LT1 M1 "blower run" green'], "Aeration blower"), H.st(["pumps 2"])]).then(function (t) {
        var m = t.rec.made; return m && m.plan && m.plan.mode === "station" ? "the turn ends with a pump station: " + t.notes.join(" | ").slice(0, 200) : ""; }); }); } },
  // --- and ones that held
  Q("A-28", "medium", "Draw the control circuit and piping for a duplex booster pump station", "A booster station: not a wet well's (held).", notStation),
  Q("A-29", "medium", "Draw the control circuit and piping for a duplex water well pump", "A water well: not a sewage station (held).", notStation),
  Q("A-30", "medium", "Draw the piping and wiring for my basement sump pump", "A house's sump pump: 1.24.30's tools, as before (held).", function (q) { return notStation(q) || sameRoute(q); }),
  Q("A-31", "medium", "Draw the wiring and piping for a septic tank pump", "A septic pump: as before (held).", function (q) { return notStation(q) || sameRoute(q); }),
  Q("A-32", "low", "Draw the float levels for a duplex lift station", "One drawing: MAKE LEVELS, as before.", function (q) { return H.ids(q) === "levels" ? sameRoute(q) : "offered " + H.ids(q); }),
  Q("A-33", "low", "Draw the control circuit for a duplex lift station with an alternating relay", "One drawing: the control circuit, as before.", function (q) { return H.ids(q) === "schematic" ? sameRoute(q) : "offered " + H.ids(q); }),

  // --- right MAKE CONTROL circuits ----------------------------------------------------------------------------------
  B("A-34", "high", "Draw a start/stop motor starter circuit with a run light", H.ctl(['stop PB1', 'start PB2 M1', 'coil M1 "motor starter"', 'lamp LT1 M1 "run" green']),
    "A motor starter: drawn exactly as 1.24.30 drew it."),
  B("A-35", "high", LIFT, H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"'].concat(P2, ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red'])),
    "The instructions' own duplex: drawn exactly as 1.24.30 drew it."),
  B("A-36", "medium", "Draw the control circuit for duplex air compressors that take turns on pressure switches", H.ctl(['pressure PS1 M1', 'pressure PS2 M2', 'coil M1 "compressor 1 starter"', 'coil M2 "compressor 2 starter"']),
    "Compressors on pressure switches, no alternator: as 1.24.30 drew them."),
  B("A-37", "medium", "Draw the control circuit for a simplex sump pump on floats", H.ctl(['float FS1 "off"', 'float FS2 "pump on"', 'coil M1 "pump starter"']),
    "A simplex sump: as 1.24.30 drew it."),
  B("A-38", "medium", "Draw a forward/reverse motor control circuit", H.ctl(['stop PB1', 'start PB2 M1', 'start PB3 M2', 'coil M1 "forward"', 'coil M2 "reverse"', 'interlock M1 M2']),
    "Forward and reverse with interlocks: as 1.24.30 drew it."),
  B("A-39", "medium", LIFT, H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'float FS5 "high high alarm"'].concat(P2, ['lamp LT3 FS4 "high level alarm" red', 'lamp LT4 FS5 "high high alarm" red'])),
    "Two alarm floats, a light each (the second review's mend): LT3 on FS4 only and LT4 on FS5 only, not each at either float.",
    function (r) {
      if (!r.ok) return "not drawn: " + r.problems.join("; ");
      var c = r.plan.circuit, on = function (id) { var g = c.rungs.filter(function (x) { return x.out.id === id; })[0]; return g ? g.series.concat(g.starts, [].concat.apply([], g.branches || [])).filter(function (e) { return e.kind === "float"; }).map(function (e) { return e.id; }).sort().join("+") : "none"; };
      return on("LT3") === "FS4" && on("LT4") === "FS5" ? "" : "LT3 on " + on("LT3") + ", LT4 on " + on("LT4");
    }),
  B("A-40", "medium", LIFT, H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "high level alarm"', 'float FS4 "high high alarm"'].concat(P2, ['lamp LT3 FS3 "alarm" red'])),
    "Two alarm floats, one light naming one of them: the light is the station's alarm (on at either), as 1.24.30 drew it -- the mend acts only where each alarm has its own."),

  // --- the floatless duplex (AI_CONTROL's mend): only where nothing else starts the pumps ------------------------------
  B("A-41", "medium", LIFT, H.ctl(P2.concat(['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green'])),
    "The 2B's duplex with no floats at all: the usual four added, said, and wired (the mend's own case).",
    function (r) { return r.ok && /the floats FS1 \(off\), FS2 \(lead on\), FS3 \(lag on\) and FS4 \(high level alarm\)/.test(added(r)) ? "" : "not added: " + (r.problems || []).join("; ") + added(r); }),
  B("A-42", "high", "Draw the control circuit for a duplex lift station with an alternating relay; a level controller's contacts call the pumps",
    H.ctl(['switch SS1 CR1 "level controller lead contact"', 'switch SS2 CR2 "level controller lag contact"', 'coil CR1 "lead call"', 'coil CR2 "lag call"', 'alternator AR M1 M2 CR1', 'coil M1 "pump 1 starter" CR1', 'coil M2 "pump 2 starter" CR1']),
    "A duplex whose calls come from a level controller's contacts (a transducer panel): something already starts the pumps, so floats are not added on top -- drawn as written, or asked once. Lantern added FS1-FS4 in series and beside the controller's contacts, and a second lag relay.",
    function (r) { return /the floats FS1 \(off\)/.test(added(r)) ? "four floats added to a circuit the controller already starts: " + H.sig(r).replace(/\n/g, " / ") : ""; }),
  B("A-43", "medium", "Draw the control circuit for a duplex sewage lift station with an alternating relay, started by a push button for testing",
    H.ctl(['stop PB1 CR1', 'start PB2 CR1', 'coil CR1 "pump call"', 'alternator AR M1 M2 CR1', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']),
    "A hand-started duplex (start and stop buttons on the call relay): the buttons start it, so no floats are added -- or it goes back once. Lantern put FS1 (off) in series with the stop: the start button now does nothing in a dry well.",
    function (r) { return /the floats FS1 \(off\)/.test(added(r)) ? "floats added beside the start button: " + H.sig(r).replace(/\n/g, " / ") : ""; }),
  B("A-44", "medium", LIFT, H.ctl(['button PB1 CR1 "call"', 'coil CR1 "pump call"', 'alternator AR M1 M2 CR1', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']),
    "A call button on the call relay is a start: floats are not added beside it.",
    function (r) { return /the floats FS1 \(off\)/.test(added(r)) ? "floats added beside a call button: " + H.sig(r).replace(/\n/g, " / ") : ""; }),
  B("A-45", "medium", "Draw the control circuit for two alternating supply fans in a lift station's dry well", H.ctl(['alternator AR M1 M2', 'coil M1 "fan 1 starter"', 'coil M2 "fan 2 starter"']),
    "Fans on an alternator in a lift station: not pumps, no floats added (held).",
    function (r) { return /the floats FS1/.test(added(r)) ? "floats added to fans" : ""; }),
  B("A-46", "medium", "Draw the control circuit for the two sewage plant aeration blowers that alternate", H.ctl(['alternator AR M1 M2', 'coil M1 "starter"', 'coil M2 "starter"']),
    "Blowers on an alternator at a sewage plant: no floats added (held).",
    function (r) { return /the floats FS1/.test(added(r)) ? "floats added to blowers" : ""; }),
  B("A-47", "medium", "Draw the control circuit for a duplex lift station with an alternating relay and a pressure transducer",
    H.ctl(['pressure PS1 "lead on"', 'pressure PS2 "off"'].concat(P2)), "Pressure switches with an alternator: back once as 1.24.30 sent it (no floats added).", null),

  // --- MAKE PIPING and MAKE LEVELS for one drawing, and the small mends ------------------------------------------------
  B("A-48", "medium", "Draw the plumbing schematic for a duplex sewage lift station",
    H.blk("PIPING", "Lift station", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', 'valve V1 P1 plug', 'valve V2 P2 plug', 'header "4 in force main"', 'vent']),
    "One piping drawing for a piping question: as 1.24.30 drew it (not read as a station).",
    function (r, q, t) { var b = H.L0().aiAct.build(t, q); return r.readAs ? "read as " + r.readAs : JSON.stringify([r.ok, r.summary]) === JSON.stringify([b.ok, b.summary]) ? "" : "differs: " + r.summary + " || " + b.summary; }),
  B("A-49", "medium", "Draw the float level positions in the wet well of a duplex lift station",
    H.blk("LEVELS", "Wet well", ['well "wet well" 10 ft', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft']),
    "One levels drawing for a levels question: as 1.24.30 drew it (not read as a station).",
    function (r, q, t) { var b = H.L0().aiAct.build(t, q); return r.readAs ? "read as " + r.readAs : JSON.stringify([r.ok, r.summary, r.plan && r.plan.floats.map(function (f) { return f.height; })]) === JSON.stringify([b.ok, b.summary, b.plan && b.plan.floats.map(function (f) { return f.height; })]) ? "" : "differs"; }),
  B("A-50", "low", "Draw where the floats go in a wet well", H.blk("LEVELS", "Wet well", ['well "wet well" 8 ft diameter 12 ft deep', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft']),
    "A depth after a diameter is the depth (the mend): drawn; the 8 ft is not a height.",
    function (r) { return r.ok && r.plan.scaled ? "" : "not drawn to scale: " + (r.problems || []).join("; "); }),
  B("A-51", "low", "Draw where the floats go in a wet well", H.blk("LEVELS", "Wet well", ['well "wet well" 6 ft diameter', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft']),
    "A diameter alone is not a depth: the floats drawn at 2 and 3 ft, no depth problem.",
    function (r) { return r.ok ? "" : "not drawn: " + r.problems.join("; "); }),
  B("A-52", "low", "Draw where the floats go in a wet well", H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm" 6 ft']),
    "Two heights left out between 2 and 6 ft: the line handed back spreads them evenly (3.3 and 4.7 ft), in order (the mend; 1.24.30 wrote 4 and 4).",
    function (r) { var p = (r.problems || []).join(" "); return !r.ok && /FS2 "lead on" 3\.3 ft, float FS3 "lag on" 4\.7 ft/.test(p) ? "" : "handed back: " + p; }),
  B("A-53", "low", "Draw where the floats go in a wet well", H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "3rd float, lag on" 4 ft']),
    "A digit in a tag before a quote (FS3 \x22) is not 3 inches; the label's “3rd” is not a height either: FS3 at 4 ft.",
    function (r) { if (!r.ok) return r.problems.join("; "); var f = r.plan.floats.filter(function (x) { return x.id === "FS3"; })[0]; return f && f.height === "4 ft" ? "" : "FS3 at " + (f && f.height); }),
  B("A-54", "low", "Draw where the floats go in a wet well", H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float LSHH1 "high high alarm" 7 ft', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS4 "high level alarm" 6 ft']),
    "An ISA tag LSHH1 is kept as written (1.24.30 renamed it FS3).",
    function (r) { return r.ok && r.plan.floats.some(function (f) { return f.id === "LSHH1"; }) ? "" : "LSHH1 not kept: " + JSON.stringify(r.plan && r.plan.floats.map(function (f) { return f.id; })); }),
  B("A-58", "low", "Draw where the floats go in a wet well", H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 24\x22 "off"', 'float FS2 36\x22 "lead on"']),
    "Heights in inch marks before the label: 24 and 36 in, as 1.24.30 read them. The mend that reads a height from the label only (the tag's digit before a quote) now reads none: drawn not to scale, a right line spoiled.",
    function (r) { return r.ok && r.plan.scaled && r.plan.floats.map(function (f) { return f.height; }).join() === "24 in,36 in" ? "" : r.ok ? "heights " + r.plan.floats.map(function (f) { return f.height; }).join() + (r.plan.scaled ? "" : ", not to scale") : r.problems.join("; "); }),
  B("A-59", "low", "Draw where the floats go in a wet well", H.blk("LEVELS", "Wet well", ['well "wet well" 6 ft diameter 4 ft high', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "high level alarm" 5 ft']),
    "A well 4 ft high (after its diameter) with an alarm float at 5 ft cannot be: back once (1.24.30 drew it, the 4 ft unread). The mend is right here.",
    function (r) { return !r.ok && /higher than the well is deep \(4 ft\)/.test(r.problems.join(" ")) ? "" : "ok " + r.ok; })
];
