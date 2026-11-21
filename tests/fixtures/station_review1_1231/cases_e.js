// cases_e.js -- E: the block grammars (AI_ACTIONS' grammarFor) and when they are sent.
//   G: blocks run through llama.cpp's own grammar parser (tools/gbnf_check.py, token by token with Qwen2's vocabulary):
//      a block that is right -- one Lantern reads, line for line, as the model meant it -- must be accepted; prose,
//      text before or after the block, and another kind's block held out.
//   P: Chat (CHAT.turn) and the bench's path (aiAct.solve) with a scripted model: a grammar only on a call where Lantern
//      asked for ONLY a block (its correction, the block after prose, the next part), never on a question's first
//      call, never to a server that is not llama.cpp's, dropped for good when the server refuses it; and never one
//      that holds the reply to a block other than the one Lantern's own words ask for.
// The G cases run live when LLAMA_LIB and LLAMA_VOCAB (or the defaults below) exist; else from grammar_results.json,
// written by make_grammar.js when it last ran live (and only while the grammars are the ones it ran).
"use strict";
var H = require("./lib.js"), fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
var LIB = process.env.LLAMA_LIB || "/tmp/llama/llama-b11435/libllama.so";
var VOCAB = process.env.LLAMA_VOCAB || "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad/vocab/ggml-vocab-qwen2.gguf";
var STORED = path.join(__dirname, "grammar_results.json");
function M(kind, lines, title) { return "MAKE " + kind + ": " + (title || "Lift station") + "\n" + lines.join("\n") + "\nEND"; }
// G(id, harm, kind (the grammar's), text, want (true: must be accepted), right)
var SAMPLES = [];
function G(id, harm, kind, text, want, right) { SAMPLES.push({ id: id, harm: harm, kind: kind, text: text, want: want, right: right }); }
// ---- STATION: right blocks ------------------------------------------------------------------------------------
G("E-G01", "high", "STATION", M("STATION", ["pumps 2", "floats off lead lag alarm"]), true, "The guide's example.");
G("E-G02", "high", "STATION", M("STATION", ["pumps 2", "floats off lead lag alarm", 'float FS1 "off" 1 m', 'float FS2 "lead on" 1.5 m', 'float FS3 "lag on" 1.9 m', 'float FS4 "high level alarm" 2.3 m'], "Sewage station"), true, "Set B's model answer.");
G("E-G03", "medium", "STATION", M("STATION", ["Pumps: 2", "Floats: off, lead, lag, alarm"]), true, "Capitals and colons.");
G("E-G04", "medium", "STATION", M("STATION", ["duplex"]), true, "'duplex' alone.");
G("E-G05", "medium", "STATION", M("STATION", ["pumps 2", 'well "wet well" 10 ft', 'inlet "8 in gravity sewer" 6.5 ft', 'main "4 in force main"', "valves plug", 'supply "120 V AC"', "horn", "show all"]), true, "Every line the guide shows.");
G("E-G06", "medium", "STATION", M("STATION", ["pumps 2", 'float FS2 "lead on" <height>', 'well "wet well" <depth>', 'supply "<volts>"']), true, "The guide's placeholders copied (read as nothing).");
G("E-G07", "medium", "STATION", M("STATION", ["pumps 2", "Wet well: 10 ft deep"]), true, "'Wet well: 10 ft deep' (Lantern reads it: the well, 10 ft).");
G("E-G08", "medium", "STATION", M("STATION", ["pumps 2", "force main 4 in"]), true, "'force main 4 in' (read: the force main).");
G("E-G09", "medium", "STATION", M("STATION", ["pumps 2", "control voltage 120 V AC"]), true, "'control voltage 120 V AC' (read: the supply).");
G("E-G10", "low", "STATION", M("STATION", ["pumps 2", "voltage: 230 V"]), true, "'voltage: 230 V' (read: the supply).");
G("E-G11", "medium", "STATION", M("STATION", ["Number of pumps: 2"]), true, "'Number of pumps: 2' (read: two pumps).");
G("E-G12", "medium", "STATION", M("STATION", ["- pumps 2", "- floats off lead lag alarm"]), true, "Bullets (read without them).");
G("E-G13", "low", "STATION", M("STATION", ["pumps 2", "gate valves"]), true, "'gate valves' (read: gate).");
G("E-G14", "low", "STATION", M("STATION", ["pumps 2", "alarm horn"]), true, "'alarm horn' (read: a horn).");
G("E-G15", "low", "STATION", M("STATION", ["Type: duplex"]), true, "'Type: duplex' (read: two pumps).");
G("E-G16", "low", "STATION", M("STATION", ["PUMPS 2", "FLOATS OFF LEAD LAG ALARM"]), true, "Capitals throughout (read).");
G("E-G17", "low", "STATION", M("STATION", ["pumps 2", "", "floats off lead lag alarm"]), true, "A blank line between two lines (read: skipped).");
G("E-G18", "low", "STATION", M("STATION", ["pumps 2", "sump 6 ft"]), true, "'sump 6 ft' (read: the well, 6 ft).");
// ---- STATION: held out ----------------------------------------------------------------------------------------
G("E-G19", "high", "STATION", "Here is the block:\n" + M("STATION", ["pumps 2"]), false, "Prose before the block.");
G("E-G20", "high", "STATION", M("STATION", ["The station has two pumps that take turns."]), false, "A line of prose inside.");
G("E-G21", "high", "STATION", "```\n" + M("STATION", ["pumps 2"]) + "\n```", false, "A code fence.");
G("E-G22", "medium", "STATION", M("STATION", ["pumps 2"]) + "\nLantern will draw the rest.", false, "Text after END.");
G("E-G23", "medium", "STATION", "I cannot draw diagrams, but here is a description of a lift station.", false, "A refusal.");
G("E-G24", "medium", "STATION", M("CONTROL", ['float FS1 "off"', 'float FS2 "lead on"', "alternator AR M1 M2", "coil M1", "coil M2"]), false, "Another kind's block.");
G("E-G25", "low", "STATION", "MAKE STATION:\npumps 2\nEND", false, "No title.");
// ---- CONTROL --------------------------------------------------------------------------------------------------
G("E-G26", "high", "CONTROL", M("CONTROL", ['supply "120 V AC"', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red'], "Duplex pump station"), true, "The guide's duplex.");
G("E-G27", "high", "CONTROL", M("CONTROL", ["stop PB1", "start PB2 M1", "overload OL1 M1", 'coil M1 "motor starter"', 'lamp LT1 M1 "run" green'], "Motor starter"), true, "The guide's motor starter.");
G("E-G28", "medium", "CONTROL", M("CONTROL", ["Stop PB1", "Start PB2 M1", 'Coil M1 "motor starter"'], "Starter"), true, "Capitalised words.");
G("E-G29", "medium", "CONTROL", M("CONTROL", ["stop button PB1", "start button PB2 M1", "motor starter M1", "pilot light LT1 M1 green", "level switch LS1 M1"], "Starter"), true, "Two-word names (stop button, motor starter, pilot light, level switch).");
G("E-G30", "low", "CONTROL", M("CONTROL", ["e-stop PB0", "stop PB1", "start PB2 M1", 'coil M1 "motor starter"'], "Starter"), true, "'e-stop PB0' (Lantern reads it as an emergency stop).");
G("E-G31", "low", "CONTROL", M("CONTROL", ["stop PB1", "start PB2 M1", 'coil M1 "motor starter"', "run light LT1 M1 green"], "Starter"), true, "'run light LT1 M1' (read as a lamp).");
G("E-G32", "low", "CONTROL", M("CONTROL", ["start PB2 TR1", "time delay relay TR1 5 s", 'coil M1 TR1 "motor"'], "Delay"), true, "'time delay relay' (read as a timer).");
G("E-G33", "medium", "CONTROL", M("CONTROL", ["The pumps take turns through the alternating relay."], "Duplex"), false, "Prose inside.");
G("E-G34", "medium", "CONTROL", "Sure! Here is the corrected block:\n" + M("CONTROL", ["stop PB1", "start PB2 M1", "coil M1"], "Starter"), false, "Prose before.");
// ---- PIPING ---------------------------------------------------------------------------------------------------
G("E-G35", "high", "PIPING", M("PIPING", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', "check CV1 P1", "valve V1 P1 plug", 'header "4 in force main"', "vent"]), true, "The guide's piping.");
G("E-G36", "medium", "PIPING", M("PIPING", ["Wet well", "Pump P1", "Pump P2", 'Force main "4 in"', "valve vault"]), true, "Capitals and two-word names.");
G("E-G37", "low", "PIPING", M("PIPING", ["pump P1", "pump P2", "flap check valve CV1 P1", "flap check valve CV2 P2"]), true, "'flap check valve' (read as a check valve).");
G("E-G38", "low", "PIPING", M("PIPING", ["pump P1", "pump P2", "eccentric plug valve V1 P1", "eccentric plug valve V2 P2"]), true, "'eccentric plug valve' (read: a plug valve).");
G("E-G39", "medium", "PIPING", M("PIPING", ["Each pump discharges through a check valve and a gate valve."]), false, "Prose inside.");
// ---- LEVELS ---------------------------------------------------------------------------------------------------
G("E-G40", "high", "LEVELS", M("LEVELS", ['well "wet well" 10 ft', "pump P1 P2", 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS4 "high level alarm" 5.5 ft', 'inlet "inlet invert" 6.5 ft'], "Wet well"), true, "The guide's levels.");
G("E-G41", "medium", "LEVELS", M("LEVELS", ["wet well 10 ft", "Float FS1 off 2 ft", "Float FS2 lead on 3 ft"], "Wet well"), true, "Capitals, no quotes.");
G("E-G42", "low", "LEVELS", M("LEVELS", ["FS1: off float at 2 ft", "FS2: lead on float at 3 ft"], "Wet well"), true, "'FS1: off float at 2 ft' (Lantern reads it: the third 1.24.30 review's form).");
G("E-G43", "low", "LEVELS", M("LEVELS", ['1. float FS1 "off" 2 ft', '2. float FS2 "lead on" 3 ft'], "Wet well"), true, "Numbered lines (read without the numbers).");
G("E-G44", "medium", "LEVELS", M("LEVELS", ["The off float is at 2 ft and the lead float at 3 ft."], "Wet well"), false, "Prose inside.");
// ---- a kind with no words of its own: any lines, still one block ------------------------------------------------
G("E-G45", "medium", "HYDRAULIC", M("HYDRAULIC", ["pump P1", "cylinder A1 double acting", "valve V1 4/3 A1"], "Press"), true, "A hydraulic block: any lines.");
G("E-G46", "medium", "CODE", M("CODE", ["language arduino", "void setup() {", "  pinMode(13, OUTPUT);", "}", "", "void loop() {", "}"], "Blink"), true, "A program, with a blank line in it.");
G("E-G47", "medium", "CODE", "Here is the program:\n" + M("CODE", ["language arduino", "void setup() {}", "void loop() {}"], "Blink"), false, "Prose before a program.");

// run the samples through gbnf_check.py (live) or read the stored results
var memo = null;
function grammarCases() {
  var A = H.L().aiAct, byKind = {};
  SAMPLES.forEach(function (s) { (byKind[s.kind] = byKind[s.kind] || { name: s.kind, grammar: A.grammarFor(s.kind), samples: [] }).samples.push({ text: s.text, want: s.want, id: s.id }); });
  return Object.keys(byKind).map(function (k) { return byKind[k]; });
}
function results() {
  if (memo) return memo;
  var gc = grammarCases(), live = fs.existsSync(LIB) && fs.existsSync(VOCAB), out = null, how = "";
  if (live) {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "gbnf-")), cj = path.join(dir, "cases.json"), oj = path.join(dir, "out.json");
    fs.writeFileSync(cj, JSON.stringify(gc));
    cp.spawnSync("python3", [path.join(H.ROOT, "tools/gbnf_check.py"), "--lib", LIB, "--vocab", VOCAB, cj, "--out", oj], { encoding: "utf8" });
    try { out = JSON.parse(fs.readFileSync(oj, "utf8")); how = "live"; } catch (e) { out = null; }
  }
  if (!out) { try { out = JSON.parse(fs.readFileSync(STORED, "utf8")).results; how = "stored"; } catch (e) { out = null; } }
  var map = {};
  (out || []).forEach(function (r, i) {
    var g = gc.filter(function (c) { return c.name === r.name; })[0];
    (r.samples || []).forEach(function (s, j) { var id = g && g.samples[j] && g.samples[j].text === s.text ? g.samples[j].id : null; if (id) map[id] = { parsed: r.parsed, accepted: s.accepted, at: s.heldAtToken, ends: s.ends, how: how, grammar: r.grammar }; });
    if (how === "stored" && g && r.grammar && r.grammar !== g.grammar) g.samples.forEach(function (s) { map[s.id] = { stale: true }; });
  });
  memo = { map: map, how: how, gc: gc };
  return memo;
}
var cases = SAMPLES.map(function (s) {
  return { id: s.id, harm: s.harm, input: { grammar: s.kind, text: s.text }, right: (s.want ? "Accepted: " : "Held out: ") + s.right, run: function () {
    var m = results().map[s.id];
    if (!m) return "not checked: no llama.cpp to parse with and no stored result (run make_grammar.js where LLAMA_LIB and LLAMA_VOCAB exist)";
    if (m.stale) return "the stored result is for another grammar: run make_grammar.js again";
    if (!m.parsed) return "llama.cpp could not parse the " + s.kind + " grammar";
    return m.accepted === s.want ? "" : s.want ? "held out" + (m.at != null ? " at token " + m.at : " (cannot end)") + " -- a block Lantern reads as meant, which the model then cannot write" : "accepted";
  } };
});

// ---- P: when a grammar is sent ----------------------------------------------------------------------------------
function root(g) { var m = g && /^root ::= "MAKE ([A-Z ]+): "/.exec(g); return m ? m[1] : g ? "?" : "-"; }
function roots(t) { return t.grammars.map(root).join(","); }
var Q = H.ADAM_Q, PROSE = "A lift station has two pumps in a wet well. The floats start and stop them, and an alternating relay makes them take turns.";
function P(id, harm, input, right, run) { cases.push({ id: id, harm: harm, input: input, right: right, run: run }); }
P("E-P01", "high", { question: Q, replies: ["MAKE STATION (right)"] }, "A question's first call carries no grammar.",
  function () { return H.turn(Q, [M("STATION", ["pumps 2", "floats off lead lag alarm"])]).then(function (t) { return roots(t) === "-" && t.rec.made && t.rec.made.ok ? "" : "grammars " + roots(t); }); });
P("E-P02", "high", { question: Q, replies: ["prose", "MAKE STATION"] }, "Prose, then the block asked for: that call (only) is held to MAKE STATION's grammar; the station made.",
  function () { return H.turn(Q, [PROSE, M("STATION", ["pumps 2"])]).then(function (t) { return roots(t) === "-,STATION" && t.rec.made && t.rec.made.ok ? "" : "grammars " + roots(t) + ", made " + !!(t.rec.made && t.rec.made.ok); }); });
P("E-P03", "high", { question: Q, replies: ["MAKE STATION (floats out of order)", "MAKE STATION (mended)"] }, "The correction's call is held to MAKE STATION's grammar.",
  function () { return H.turn(Q, [M("STATION", ["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]), M("STATION", ["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft"])]).then(function (t) { return roots(t) === "-,STATION" && t.rec.made.ok ? "" : "grammars " + roots(t); }); });
P("E-P04", "medium", { question: "Draw a ladder diagram for a motor starter with start and stop buttons", replies: ["MAKE CONTROL questioned", "MAKE CONTROL"] }, "A control circuit's correction: held to MAKE CONTROL.",
  function () {
    var q = this.input.question;
    return H.turn(q, [M("CONTROL", ["stop PB1", "start PB2 M9", 'coil M1 "motor starter"'], "Starter"), M("CONTROL", ["stop PB1", "start PB2 M1", 'coil M1 "motor starter"'], "Starter")]).then(function (t) {
      return t.calls === 2 ? (roots(t) === "-,CONTROL" ? "" : "grammars " + roots(t)) : "not questioned (" + t.calls + " calls): " + roots(t);
    });
  });
P("E-P05", "medium", { question: "Draw a motor starter control circuit and then make a table of its parts", replies: ["MAKE CONTROL", "MAKE SHEET"] }, "A question in parts: the next part's call is held to its kind (the first call none).",
  function () {
    var q = this.input.question;
    return H.turn(q, [M("CONTROL", ["stop PB1", "start PB2 M1", 'coil M1 "motor starter"'], "Starter"), M("SHEET", ["Tag | Part", "PB1 | stop button", "PB2 | start button", "M1 | motor starter"], "Parts")]).then(function (t) {
      return roots(t) === "-,SHEET" ? "" : "grammars " + roots(t) + " in " + t.calls + " calls";
    });
  });
P("E-P06", "high", { question: "What is 15% of 80?", replies: ["=0.15*80"] }, "A sum: no grammar.",
  function () { return H.turn("What is 15% of 80?", ["=0.15*80"]).then(function (t) { return t.grammars.every(function (g) { return !g; }) ? "" : "grammars " + roots(t); }); });
P("E-P07", "medium", { question: Q, history: "one exchange before", replies: ["prose", "MAKE STATION"] }, "A later turn of a conversation: its first call carries none; the block asked for after prose does.",
  function () {
    var hist = [{ role: "user", content: "What is a lift station?" }, { role: "assistant", content: "A pump station that lifts sewage to a higher sewer." }];
    return H.turn(Q, [PROSE, M("STATION", ["pumps 2"])], { history: hist }).then(function (t) { return roots(t) === "-,STATION" ? "" : "grammars " + roots(t); });
  });
P("E-P08", "high", { question: Q, path: "aiAct.solve", replies: ["prose", "MAKE STATION questioned", "..."] }, "The bench's path: no grammar on the first call; the block asked for after prose held to it.",
  function () {
    return H.solve(Q, [PROSE, M("STATION", ["pumps 2"])]).then(function (s) { return s.grammars.map(root).join(",") === "-,STATION" ? "" : "grammars " + s.grammars.map(root).join(","); });
  });
P("E-P09", "medium", { question: Q, path: "aiAct.solve", replies: ["MAKE STATION questioned", "MAKE STATION"] }, "The bench's path: the correction held to it.",
  function () {
    return H.solve(Q, [M("STATION", ["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]), M("STATION", ["pumps 2"])]).then(function (s) { return s.grammars.map(root).join(",") === "-,STATION" ? "" : "grammars " + s.grammars.map(root).join(","); });
  });
// a second Lantern whose server is not llama.cpp's (no /props), or refuses grammars
function other(kind) {
  var o = H.load(process.env.LANTERN_SRC || path.join(H.ROOT, "src/lantern.inner.html")), f0 = o.w.fetch, bodies = [];
  o.w.fetch = function (url, op) {
    url = String(url);
    if (kind === "notllama" && /\/props$/.test(url)) return Promise.resolve({ ok: false, status: 404, headers: { get: function () { return "text/plain"; } }, text: function () { return Promise.resolve("nf"); }, json: function () { return Promise.reject(new Error("nf")); } });
    if (/chat\/completions/.test(url)) {
      var b = JSON.parse(op.body); bodies.push(b);
      if (kind === "refuses" && b.grammar) {
        var txt = JSON.stringify({ error: { code: 400, message: "Failed to initialize samplers: failed to parse grammar", type: "invalid_request_error" } });
        return Promise.resolve({ ok: false, status: 400, statusText: "Bad Request", headers: { get: function () { return "application/json"; } }, json: function () { return Promise.resolve(JSON.parse(txt)); }, text: function () { return Promise.resolve(txt); } });
      }
      if (kind === "context" && b.grammar && !o.ctxDone) {
        o.ctxDone = true;
        var t2 = JSON.stringify({ error: { code: 400, message: "the request exceeds the available context size, try increasing it", type: "exceed_context_size_error" } });
        return Promise.resolve({ ok: false, status: 400, statusText: "Bad Request", headers: { get: function () { return "application/json"; } }, json: function () { return Promise.resolve(JSON.parse(t2)); }, text: function () { return Promise.resolve(t2); } });
      }
    }
    return f0(url, op);
  };
  o.bodies = bodies;
  return o;
}
function otherTurn(o, q, replies) {
  return Promise.resolve(o.L.ai.detect()).then(function () {
    var i = 0;
    o.script = function () { var r = replies[Math.min(i, replies.length - 1)]; i++; return r; };
    return o.L.CHAT.turn([], q, { note: function () { } }, {}).then(function (rec) { o.script = null; return rec; });
  });
}
P("E-P10", "high", { question: Q, server: "not llama.cpp (no /props)", replies: ["prose", "MAKE STATION questioned", "MAKE STATION"] }, "A server that is not llama.cpp's is never sent a grammar.",
  function () {
    var o = other("notllama");
    return otherTurn(o, Q, [PROSE, M("STATION", ["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]), M("STATION", ["pumps 2"])]).then(function (rec) {
      var g = o.bodies.filter(function (b) { return "grammar" in b; }).length;
      return o.L.ai.server.llama ? "the server was taken for llama.cpp's" : g ? g + " requests carried a grammar" : o.bodies.length < 2 ? "only " + o.bodies.length + " calls" : "";
    });
  });
P("E-P11", "high", { question: Q, server: "llama.cpp that refuses grammars", replies: ["prose", "MAKE STATION questioned", "MAKE STATION"] },
  "A server that refuses the grammar: that request made again without it, the turn goes on, and no later request carries one.",
  function () {
    var o = other("refuses");
    return otherTurn(o, Q, [PROSE, M("STATION", ["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]), M("STATION", ["pumps 2"])]).then(function (rec) {
      var w = o.bodies.map(function (b) { return b.grammar ? "G" : "-"; }).join("");
      // the first call none; the block asked for: G refused, then again without; the correction: none again
      return w === "-G--" && rec.made && rec.made.ok ? "" : "requests " + w + ", made " + !!(rec.made && rec.made.ok);
    });
  });
P("E-P12", "medium", { question: Q, server: "llama.cpp, a context-size error once", replies: ["prose", "MAKE STATION"] },
  "A request refused for another reason (the context size) does not turn grammars off for the session.",
  function () {
    var o = other("context");
    function judge() { return o.L.ai.noGrammar ? "grammars turned off: " + o.L.ai.noGrammar : o.bodies.filter(function (b) { return b.grammar; }).length ? "" : "no grammar was sent"; }
    // (the mock has no context fitting: the turn may end on the error; what matters is the session's grammar switch)
    return otherTurn(o, Q, [PROSE, M("STATION", ["pumps 2"])]).then(judge, judge);
  });
P("E-P13", "medium", { question: "Draw a pneumatic circuit: a compressor feeds a double acting cylinder through a 5/2 valve", replies: ["MAKE HYDRAULIC with a compressor", "..."] },
  "A correction whose own words tell the model to write another kind ('for compressed air write MAKE PNEUMATIC'): no grammar, or one for that kind. Not: the reply held to MAKE HYDRAULIC -- the one block the correction says is wrong -- so the model cannot do what it was told.",
  function () {
    var q = this.input.question;
    return H.turn(q, [M("HYDRAULIC", ["compressor C1", "cylinder A1 double acting", "valve V1 5/2 A1"], "Air"), M("PNEUMATIC", ["cylinder A1 double acting", "valve V1 5/2 A1"], "Air")]).then(function (t) {
      var says = /write MAKE PNEUMATIC/.test(t.sent[1] || ""), held = root(t.grammars[1]);
      return says && held === "HYDRAULIC" ? "the correction says “write MAKE PNEUMATIC” and the reply is held to MAKE HYDRAULIC" : "";
    });
  });
P("E-P14", "low", { question: "Draw a ladder diagram for a motor starter with start and stop buttons", replies: ["MAKE SCHEMATIC with part lines", "MAKE SCHEMATIC with the control's lines"] },
  "The old form ('write it as MAKE CONTROL'), held to MAKE SCHEMATIC: the control's lines written under MAKE SCHEMATIC are drawn as the control, so the grammar still lets the right answer through.",
  function () {
    var q = this.input.question;
    return H.turn(q, [M("SCHEMATIC", ["part K1 relay", "part S1 button", "wire S1 K1"], "Starter"), M("SCHEMATIC", ["stop PB1", "start PB2 M1", 'coil M1 "motor starter"'], "Starter")]).then(function (t) {
      return t.rec.made && t.rec.made.ok && t.rec.made.plan.mode === "control" ? "" : "grammars " + roots(t) + ", made " + (t.rec.made && (t.rec.made.ok ? t.rec.made.plan.mode : t.rec.made.problems));
    });
  });
P("E-P15", "medium", { question: Q, replies: ["MAKE STATION with 'Wet well: 10 ft deep' questioned", "..."] },
  "After a correction, the grammar holds the station's lines: every line the correction itself shows as the way to write is one the grammar lets through.",
  function () {
    return H.turn(Q, [M("STATION", ["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]), M("STATION", ["pumps 2"])]).then(function (t) {
      var g = t.grammars[1], fix = t.sent[1] || "", words = (/^line ::= \(([^)]*)\)/m.exec(g || "") || ["", ""])[1].match(/"([^"]+)"/g) || [];
      words = words.map(function (w) { return w.replace(/"/g, ""); });
      var shown = fix.split("\n").filter(function (l) { return /^[a-z]+ /.test(l) && !/^(Lantern|Reply|the|from|like)\b/i.test(l); }).map(function (l) { return l.split(" ")[0]; });
      var bad = shown.filter(function (w) { return words.indexOf(w) < 0; });
      return !g ? "no grammar" : bad.length ? "the correction shows lines the grammar holds out: " + bad.join(", ") : "";
    });
  });
module.exports = cases;
module.exports.grammarCases = grammarCases;
module.exports.results = results;
module.exports.STORED = STORED;
