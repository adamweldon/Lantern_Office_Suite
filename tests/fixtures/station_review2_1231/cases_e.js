// cases_e.js -- E: the grammars that hold a reply to one MAKE block (AI_ACTIONS' grammarFor), read and run by llama.cpp's
// own parser (grammar_results.json, from tools/gbnf_check.py over grammar_cases.json, which make_grammar.js wrote from
// grammar_samples.js), and when Chat, solve and AI.callServer send them.
// A sample Lantern's parser reads (want true) must get through; prose, or another block, must be held out (want false).
"use strict";
var H = require("./lib.js"), fs = require("fs"), path = require("path");
var RES = null;
// the results, each with the grammar it was run with (grammar_cases.json, in the same order)
function res() {
  if (!RES) {
    try {
      RES = JSON.parse(fs.readFileSync(path.join(__dirname, "grammar_results.json"), "utf8"));
      var gc = JSON.parse(fs.readFileSync(path.join(__dirname, "grammar_cases.json"), "utf8"));
      RES.forEach(function (c, i) { c.grammar = gc[i] && gc[i].name === c.name ? gc[i].grammar : null; });
    } catch (e) { RES = []; }
  }
  return RES;
}
function resultOf(text) { var out = null; res().forEach(function (c) { c.samples.forEach(function (s) { if (s.text === text) out = { c: c, s: s }; }); }); return out; }
// the parser reads every line of a want-true sample (else the sample's own claim is wrong)
function readsAll(kind, text) {
  var q = "Design a duplex sewage lift station: the control circuit, the piping and the float levels", r = H.build(text, q);
  if (!r || !r.block) return "no block found";
  var p = r.plan;
  if (p && p.mode === "station") return p.unread.length ? "the station's parser leaves unread: " + p.unread.join(" / ") : "";
  return (r.problems || []).filter(function (x) { return !/the question asks for a pump station|whole/i.test(x); }).length ? "" : "";
}
var cases = [];
var L = H.L(), samples = require("./grammar_samples.js")(L), byId = {};
samples.forEach(function (s) { byId[s.id] = s; });
// one sample against its llama.cpp result: "" when the grammar does what the sample wants
function judgeSample(s) {
  var g = resultOf(s.text);
  if (!g) return s.id + ": not run through llama.cpp (make_grammar.js, then tools/gbnf_check.py)";
  if (g.c.grammar !== H.L().aiAct.grammarFor(s.kind)) return s.id + ": grammar_results.json is stale (the grammar for " + s.kind + " has changed since it was run)";
  if (!g.c.parsed) return s.id + ": llama.cpp could not parse the " + s.kind + " grammar";
  if (s.want && s.kind === "STATION") { var rd = readsAll(s.kind, s.text); if (rd) return s.id + ": (the sample's own claim) " + rd; }
  if (g.s.accepted === s.want) return "";
  return s.id + (s.want ? ": held out at token " + g.s.heldAtToken + " (in \u201c" + s.text.split("\n").slice(1, -1).join(" / ") + "\u201d, which the parser reads)" : ": let through (" + (s.id === "GS-36" ? "the parser then reads the sentence as the control voltage" : "prose") + ")");
}
// the samples, one case for each, or one for a family that says one thing
var GROUPS = [
  ["E-GS-01", ["GS-01"]], ["E-GS-03", ["GS-03"]], ["E-GS-04", ["GS-04"]],
  ["E-GS-words", ["GS-02", "GS-14", "GS-15", "GS-16", "GS-17", "GS-18", "GS-19", "GS-20", "GS-21"], "The station's own words in their usual forms (capitals, colons, the count's words, horn, lights, voltage, valves, list numbers, blank lines, float switches, levels): all let through."],
  ["E-GS-22", ["GS-22"]],
  ["E-GS-leads", ["GS-05", "GS-06", "GS-07", "GS-08", "GS-09", "GS-10", "GS-13"], "Lines the station's parser reads by its LEADS (shut-off valves, swing and flap check valves, wet-well, force-main, the wet well, high-level light): the grammar's words are said to be 'every word a LEADS line begins with', so each must get through. Held out, the model is pushed to another spelling (harmless when it finds one the parser reads)."],
  ["E-GS-layout", ["GS-11", "GS-12"], "A round bullet and indented lines, both of which the parser reads: let through."],
  ["E-GS-prose", ["GS-30", "GS-31", "GS-32", "GS-33", "GS-34", "GS-35", "GS-38"], "Prose before, inside or after the block, a code fence, no END, another kind: all held out."],
  ["E-GS-36", ["GS-36"]], ["E-GS-37", ["GS-37"]],
  ["E-GC-right", ["GC-01", "GC-02", "GC-03", "GC-05"], "The control Lantern writes for a station, the 35B's own control, the guide's duplex, devices by two-word names: let through."],
  ["E-GC-04", ["GC-04"]], ["E-GC-prose", ["GC-06", "GC-07"], "Prose and a wire line in a control block: held out."],
  ["E-GP-right", ["GP-01", "GP-02"], "The piping Lantern writes for a station and valves by their names: let through."], ["E-GP-03", ["GP-03"]], ["E-GP-04", ["GP-04"]],
  ["E-GL-right", ["GL-01", "GL-02"], "The levels Lantern writes for a station, tags first, the floor, a job first: let through."], ["E-GL-03", ["GL-03"]]
];
var HARM = { high: 3, medium: 2, low: 1 };
GROUPS.forEach(function (g) {
  var ss = g[1].map(function (id) { return byId[id]; }), one = ss.length === 1 ? ss[0] : null;
  var harm = ss.reduce(function (h, s) { return HARM[s.harm] > HARM[h] ? s.harm : h; }, "low");
  // a family's harm is that of the member that would cost most if it failed
  var right = g[2] || (one.right + (one.want ? " The parser reads it: the grammar must let it through." : " Not one block of the kind: the grammar must hold it out."));
  cases.push(H.C(g[0], harm, { samples: ss.map(function (s) { return { id: s.id, kind: s.kind, want: s.want ? "let through" : "held out", reply: s.text }; }) }, right,
    function () { return ss.map(judgeSample).filter(function (x) { return x; }).join("; "); }));
});
cases.push(H.C("E-kinds", "high", { kinds: "every kind of every action" }, "Every kind Lantern can be asked for has a grammar llama.cpp parses, and an empty block of the kind gets through (a refused grammar drops all grammars for the session).",
  function () {
    var bad = res().filter(function (c) { return /^kind /.test(c.name) && (!c.parsed || !c.samples.every(function (s) { return s.agree; })); }).map(function (c) { return c.name; });
    var n = res().filter(function (c) { return /^kind /.test(c.name); }).length;
    return !n ? "not run" : bad.join(", ");
  }));
cases.push(H.C("E-names", "medium", { kinds: "SPACESHIP, '', a kind with a quote" }, "No grammar for a kind Lantern has no tool for, an empty kind, or one that is not a plain name (it would be refused by the server).",
  function () { var G = H.L().aiAct.grammarFor; return G("SPACESHIP") === null && G("") === null && G("STATION\x22 ::=") === null && G("PIPING\nroot") === null ? "" : "a grammar was made"; }));
// ---- when the grammar is sent -----------------------------------------------------------------------------------
var Q = H.ADAM_Q;
cases.push(H.C("E-s01", "high", { question: "five questions, first call" }, "The first call of a turn never carries a grammar (the model may answer in prose, or with any tool).",
  function () {
    var qs = [Q, "Draw a ladder diagram for a motor starter with start and stop buttons", "Make a slide deck about lift stations for a city council meeting", "What is 2+2?", "Draw the plumbing for a lift station"], i = 0, bad = [];
    function next() { if (i >= qs.length) return Promise.resolve(bad.join("; ")); var q = qs[i++]; return H.turn(q, ["ANSWER: ok"]).then(function (t) { if (t.grammars[0]) bad.push(q + ": " + t.grammars[0]); return next(); }); }
    return next();
  }));
cases.push(H.C("E-s02", "medium", { question: "Draw a ladder diagram for a motor starter with start and stop buttons", replies: ["MAKE CONTROL: Starter\nstart PB2 M1\ncoil M1\nwire L1 PB2\nEND", "MAKE CONTROL: Starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\nEND"] },
  "A control block sent back (a wire written): the correction held to the CONTROL grammar, and the corrected block drawn.",
  function () { return H.turn(this.input.question, this.input.replies).then(function (t) { var m = t.rec && t.rec.made; return t.grammars.join() === ",CONTROL" && m && m.ok ? "" : "grammars " + t.grammars + " made " + (m && m.ok) + (t.error ? " " + t.error : ""); }); }));
cases.push(H.C("E-s03", "medium", { question: "Draw a ladder diagram for a motor starter with start and stop buttons", replies: ["MAKE SCHEMATIC: Starter\npart PB1 pushbutton\npart M1 coil\nwire L1 PB1\nEND", "MAKE CONTROL: Starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\nEND"] },
  "A correction that tells the model to write another kind (the old part/wire form: 'write it as MAKE CONTROL'): no grammar, so it can.",
  function () { return H.turn(this.input.question, this.input.replies).then(function (t) { return t.calls === 2 && !t.grammars[1] ? "" : "calls " + t.calls + " grammars " + t.grammars; }); }));
cases.push(H.C("E-s04", "medium", { question: Q, replies: ["I cannot draw, but here is how it works: the pumps take turns.", "MAKE STATION: Lift station\npumps 2\nEND"] },
  "solve: prose first, the block asked for with the STATION grammar.",
  function () { return H.solve(Q, this.input.replies).then(function (s) { return s.grammars.join() === ",STATION" && s.out.made && s.out.made.ok ? "" : "grammars " + s.grammars; }); }));
cases.push(H.C("E-s05", "low", { question: Q, server: "not llama.cpp (no /props)" }, "A server that is not llama.cpp's is never sent a grammar; what the bench row and Chat record as held calls is what was sent.",
  function () {
    var A = H.L().ai, l0 = A.server.llama, sentG = [];
    var o = H.O(), s0 = o.script;
    A.server.llama = false;
    return H.turn(Q, function (last, i) { return i === 0 ? "I cannot draw." : "MAKE STATION: S\npumps 2\nEND"; }).then(function (t) {
      A.server.llama = l0;
      var bodyG = t.bodies.some(function (b) { return !!b.grammar; });
      return bodyG ? "a grammar was sent to a server that is not llama.cpp's" : t.rec && t.rec.grammar ? "no grammar was sent, and the turn records " + t.rec.grammar + " call(s) held to a grammar" : "";
    });
  }));
cases.push(H.C("E-s06", "medium", { question: Q, server: "llama.cpp refuses the grammar (400 failed to parse grammar)" }, "Refused once: the same request made again without it, the turn goes on, and no grammar is sent again this session.",
  function () {
    var o = H.O(), A = H.L().ai, f0 = o.w.fetch, n = 0, bodies = [];
    o.w.fetch = function (url, op) {
      if (!/chat\/completions/.test(String(url))) return f0(url, op);
      var b = JSON.parse(op.body); bodies.push(!!b.grammar); n++;
      var bad = !!b.grammar, txt = bad ? JSON.stringify({ error: { message: "failed to parse grammar", type: "invalid_request_error" } }) : JSON.stringify({ choices: [{ message: { content: n === 1 ? "I cannot draw." : "MAKE STATION: S\npumps 2\nEND" }, finish_reason: "stop" }], usage: {} });
      return Promise.resolve({ ok: !bad, status: bad ? 400 : 200, statusText: "", headers: { get: function () { return "application/json"; } }, json: function () { return Promise.resolve(JSON.parse(txt)); }, text: function () { return Promise.resolve(txt); } });
    };
    A.noGrammar = null;
    return H.L().CHAT.turn([], Q, {}, {}).then(function (rec) {
      o.w.fetch = f0; var ng = A.noGrammar; A.noGrammar = null;
      return rec.made && rec.made.ok && bodies.join() === "false,true,false" && ng ? "" : "bodies " + bodies + " made " + (rec.made && rec.made.ok) + " noGrammar " + ng;
    }, function (e) { o.w.fetch = f0; A.noGrammar = null; return "threw " + e; });
  }));
cases.push(H.C("E-s07", "medium", { question: Q, server: "llama.cpp fails mid-reply (500 Unexpected empty grammar stack)" }, "A grammar that fails as the reply is made (llama.cpp's 500): dropped, the request made again without it.",
  function () {
    var o = H.O(), A = H.L().ai, f0 = o.w.fetch, bodies = [];
    o.w.fetch = function (url, op) {
      if (!/chat\/completions/.test(String(url))) return f0(url, op);
      var b = JSON.parse(op.body); bodies.push(!!b.grammar);
      var bad = !!b.grammar, txt = bad ? JSON.stringify({ error: { message: "Unexpected empty grammar stack after accepting piece: END", type: "server_error" } }) : JSON.stringify({ choices: [{ message: { content: bodies.length === 1 ? "I cannot draw." : "MAKE STATION: S\npumps 2\nEND" }, finish_reason: "stop" }], usage: {} });
      return Promise.resolve({ ok: !bad, status: bad ? 500 : 200, statusText: "", headers: { get: function () { return "application/json"; } }, json: function () { return Promise.resolve(JSON.parse(txt)); }, text: function () { return Promise.resolve(txt); } });
    };
    A.noGrammar = null;
    return H.L().CHAT.turn([], Q, {}, {}).then(function (rec) { o.w.fetch = f0; A.noGrammar = null; return rec.made && rec.made.ok ? "" : "made " + (rec.made && rec.made.ok) + " bodies " + bodies; }, function (e) { o.w.fetch = f0; A.noGrammar = null; return "threw " + e; });
  }));
cases.push(H.C("E-s08", "medium", { question: "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council", replies: ["MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND", "MAKE SLIDES: Lift station\n# Our lift station\n- two pumps take turns\nEND"] },
  "A question in parts (the station, then slides): the station first, then the slides asked for with the SLIDES grammar, and both made.",
  function () { return H.turn(this.input.question, this.input.replies).then(function (t) { var ks = (t.rec.mades || []).map(function (m) { return m.block && m.block.kind; }).join(","); return t.grammars[1] === "SLIDES" && /STATION/.test(ks) && /SLIDES/.test(ks) ? "" : "grammars " + t.grammars + " made " + ks + (t.error ? " " + t.error : ""); }); }));
cases.push(H.C("E-s09", "low", { question: Q, replies: ["MAKE LIFT STATION: Lift station\npumps 2\nfloats off lead lag alarm\nfloat FS2 \x22lead on\x22 1 ft\nEND", "MAKE LIFT STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND"] },
  "A station written as MAKE LIFT STATION and sent back: the correction held to its own kind's grammar (MAKE LIFT STATION), which llama.cpp parses (GS-22).",
  function () { return H.turn(Q, this.input.replies).then(function (t) { return t.grammars[1] === "LIFT STATION" || t.grammars[1] === "STATION" ? "" : "grammars " + t.grammars + " calls " + t.calls; }); }));
module.exports = cases;
