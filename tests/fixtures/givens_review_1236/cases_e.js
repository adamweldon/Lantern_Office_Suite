// cases_e.js -- the rest of the change: the modules droppable (CLAUDE.md, rule 11 of the source's header), ES5, no quote
// characters in a regex literal, ASCII only; Lantern.givens as an API a user's own given goes through; a given drawn as
// written; the correction turn; the given in a question of several parts.
"use strict";
var lib = require("./lib.js"), J = require("./judge.js"), fs = require("fs"), path = require("path");
var acorn = require("acorn");
var C = [];
var STARTER_Q = "Draw the control circuit for a motor starter with start and stop push buttons and a run light";
function moduleText(name) {
  var s = fs.readFileSync(path.join(lib.ROOT, "src", "lantern.inner.html"), "utf8");
  var a = s.indexOf("// MODULE: " + name + " - START"), b = s.indexOf("// MODULE: " + name + " - END");
  return a < 0 || b < 0 ? null : s.slice(a, b);
}
// ---- droppable -------------------------------------------------------------------------------------------------
function dropCase(id, names, harm, expectGivens) {
  C.push({ id: id, harm: harm, input: "the draft with " + names.join(" and ") + " taken out",
    right: "boots with no error; act.prompt and Chat's system prompt for every bench question and the starter question do not throw" + (expectGivens ? "" : ", and the starter question gets 1.24.35's prompt (no given)") + "; make-control's ideal passes",
    run: async function () {
      var x = await lib.boot(), o = await lib.bootFile(lib.without(names)), L = o.L, bad = [];
      if (o.errs.length) bad.push("boot errors: " + o.errs.slice(0, 3).join(" | "));
      var qs = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []);
      qs.concat([{ id: "starter", q: STARTER_Q }]).forEach(function (b) {
        try { L.aiAct.prompt(b.q); } catch (e) { bad.push(b.id + ": act.prompt threw " + e); }
        try { L.CHAT.buildSystem(b.q); } catch (e) { bad.push(b.id + ": buildSystem threw " + e); }
      });
      if (!expectGivens && L.aiAct.prompt(STARTER_Q) !== lib.prompt(x.O.L, STARTER_Q)) bad.push("the starter question's prompt is not 1.24.35's");
      var mc = qs.filter(function (b) { return b.id === "make-control"; })[0];
      if (mc && L.aiAct && L.aiBench) {
        var out = await L.aiAct.solve(mc.q, lib.seq([mc.ideal])), g = L.aiBench.grade(mc, out.text, out);
        if (!g.pass) bad.push("make-control's ideal fails: " + g.why);
      }
      return bad.join("; ");
    } });
}
dropCase("E-drop-givens-control", ["GIVENS_CONTROL"], "high", false);
dropCase("E-drop-givens", ["GIVENS"], "high", false);
dropCase("E-drop-both", ["GIVENS", "GIVENS_CONTROL"], "high", false);
C.push({ id: "E-drop-ai-control", harm: "medium", input: "the draft with AI_CONTROL taken out (GIVENS and GIVENS_CONTROL left)",
  right: "boots with no error; the givens are still there (Lantern.givens), nothing asks them, and a control question's prompt does not throw",
  run: async function () {
    var o = await lib.bootFile(lib.without(["AI_CONTROL"])), bad = [];
    if (o.errs.length) bad.push("boot errors: " + o.errs.slice(0, 3).join(" | "));
    if (!o.L.givens || o.L.givens.all("CONTROL").length < 7) bad.push("the givens are not there");
    try { o.L.aiAct.prompt(STARTER_Q); o.L.CHAT.buildSystem(STARTER_Q); } catch (e) { bad.push("threw " + e); }
    return bad.join("; ");
  } });
C.push({ id: "E-isolation-test-lists", harm: "low", input: "tests/ai_isolation.js (the suite's droppability proof for the AI layer: each module removed in turn)",
  right: "GIVENS and GIVENS_CONTROL in its list, so the suite proves them droppable on every run",
  run: function () { var s = fs.readFileSync(path.join(lib.ROOT, "tests", "ai_isolation.js"), "utf8"); var miss = ["GIVENS", "GIVENS_CONTROL"].filter(function (n) { return s.indexOf("\x22" + n + "\x22") < 0; }); return Promise.resolve(miss.length ? "not in its MODS list: " + miss.join(", ") : ""); } });
// ---- ES5, regex literals, ASCII ------------------------------------------------------------------------------------
["GIVENS", "GIVENS_CONTROL", "AI_CONTROL"].forEach(function (name) {
  C.push({ id: "E-es5-" + name, harm: "high", input: "the module " + name + "'s text", right: "parses as ES5 (acorn, ecmaVersion 5)",
    run: function () {
      var t = moduleText(name);
      if (!t) return Promise.resolve("module not found");
      try { acorn.parse(t, { ecmaVersion: 5 }); return Promise.resolve(""); } catch (e) { return Promise.resolve("not ES5: " + e.message); }
    } });
  C.push({ id: "E-regex-quotes-" + name, harm: "medium", input: "every regex literal in " + name, right: "no \x27 or \x22 character inside one (written \\x27, \\x22)",
    run: function () {
      var t = moduleText(name), bad = [];
      try { for (var tok of acorn.tokenizer(t, { ecmaVersion: 5 })) { if (tok.type.label === "regexp" && /[\x27\x22]/.test(t.slice(tok.start, tok.end))) bad.push(t.slice(tok.start, tok.end).slice(0, 80)); } } catch (e) { return Promise.resolve("could not read: " + e.message); }
      return Promise.resolve(bad.join(" | "));
    } });
});
C.push({ id: "E-ascii", harm: "medium", input: "the text of GIVENS and GIVENS_CONTROL", right: "ASCII only (non-ASCII written as escapes)",
  run: function () { var t = moduleText("GIVENS") + moduleText("GIVENS_CONTROL"), m = /[^\x00-\x7f]/.exec(t); return Promise.resolve(m ? "non-ASCII " + JSON.stringify(m[0]) + " at " + JSON.stringify(t.slice(Math.max(0, m.index - 40), m.index + 10)) : ""); } });
C.push({ id: "E-depends-header", harm: "low", input: "the Depends: and Exports: headers", right: "GIVENS_CONTROL names GIVENS; GIVENS names nothing; AI_CONTROL's promptOf feature-detects Lantern.givens; no circle",
  run: function () {
    var g = moduleText("GIVENS"), gc = moduleText("GIVENS_CONTROL"), ac = moduleText("AI_CONTROL"), bad = [];
    if (!/Depends: GIVENS\b/.test(gc)) bad.push("GIVENS_CONTROL does not name GIVENS");
    if (/Depends:\s*(?!\(none\))[A-Z]/.test(g)) bad.push("GIVENS names a module");
    if (!/L\.givens && L\.givens\.prompt/.test(ac)) bad.push("AI_CONTROL does not feature-detect Lantern.givens");
    return Promise.resolve(bad.join("; "));
  } });
// ---- the API a user's own given goes through ----------------------------------------------------------------------
C.push({ id: "E-api-user-given", harm: "medium", input: "Lantern.givens.add a user's own given (kind CONTROL, asks /widget press/, rank 9)",
  right: "a widget press question is shown it; a second add with the same id replaces it; the starter question still gets the starter",
  run: async function () {
    var o = await lib.bootFile(lib.without([])), G = o.L.givens, bad = [];
    G.add({ id: "user-widget", kind: "CONTROL", rank: 9, title: "Widget press", asks: /\bwidget\s+press\b/i, says: "the shop\x27s own", block: function () { return ["stop PB1 M1", "start PB2 M1", "coil M1 \x22press starter\x22", "overload OL1 M1"]; } });
    var q = "Draw the control circuit for the widget press with start and stop buttons", s = lib.shown(o.L, q);
    if (s.id !== "user-widget") bad.push("not shown the user's given (" + s.id + ")");
    G.add({ id: "user-widget", kind: "CONTROL", rank: 9, title: "Widget press 2", asks: /\bwidget\s+press\b/i, block: function () { return ["stop PB1 M1", "start PB2 M1", "coil M1 \x22press starter\x22"]; } });
    if (G.all("CONTROL").filter(function (g) { return g.id === "user-widget"; }).length !== 1 || lib.shown(o.L, q).title !== "Widget press 2") bad.push("the second add did not replace the first");
    if (lib.shown(o.L, STARTER_Q).id !== "control-starter") bad.push("the starter question lost its given");
    return bad.join("; ");
  } });
C.push({ id: "E-api-bad-user-given", harm: "medium", input: "Lantern.givens.add a malformed given (asks a string, not a RegExp), then a control question",
  right: "the malformed given is refused at add, or skipped; every control question's prompt (and Chat's system prompt) still built -- a user's given must not break Chat",
  run: async function () {
    var o = await lib.bootFile(lib.without([])), bad = [];
    try { o.L.givens.add({ id: "user-bad", kind: "CONTROL", asks: "pump", block: function () { return ["coil M1"]; } }); } catch (e) { return ""; }
    try { o.L.aiAct.prompt(STARTER_Q); } catch (e) { bad.push("act.prompt throws: " + e.message); }
    try { o.L.CHAT.buildSystem(STARTER_Q); } catch (e) { bad.push("Chat's system prompt throws: " + e.message); }
    return bad.join("; ");
  } });
C.push({ id: "E-api-throwing-block", harm: "medium", input: "a given whose block() throws, or gives no lines",
  right: "the instructions as before (their own example), no error",
  run: async function () {
    var o = await lib.bootFile(lib.without([])), x = await lib.boot(), bad = [], q = "Draw the control circuit for a gizmo press with start and stop buttons";
    o.L.givens.add({ id: "user-throws", kind: "CONTROL", rank: 99, title: "T", asks: /\bgizmo\b/i, block: function () { throw new Error("no"); } });
    var p1; try { p1 = o.L.aiAct.prompt(q); } catch (e) { bad.push("threw " + e); }
    if (p1 && /tested circuit/.test(p1)) bad.push("a given was shown");
    if (p1 && p1 !== lib.prompt(x.O.L, q)) bad.push("not 1.24.35's prompt");
    o.L.givens.add({ id: "user-throws", kind: "CONTROL", rank: 99, title: "T", asks: /\bgizmo\b/i, block: function () { return []; } });
    try { if (/tested circuit/.test(o.L.aiAct.prompt(q))) bad.push("an empty given was shown"); } catch (e) { bad.push("threw " + e); }
    return bad.join("; ");
  } });
C.push({ id: "E-api-kept", harm: "low", input: "CLAUDE.md rule 8: \x22a custom version that passes them can be kept as the user’s own given (Lantern.givens)\x22",
  right: "a way to keep a user's given across a reload (Lantern.store), or the rule says it is not there yet",
  run: function () { var t = moduleText("GIVENS"); return Promise.resolve(/\bL\.store\b|\bstore\.(get|set)\b/.test(t) ? "" : "Lantern.givens.add keeps a given in memory only: nothing saves one, nothing loads one, and no Chat or app path calls add -- the user's own given of rule 8 is not there yet"); } });
// ---- each given drawn as written -----------------------------------------------------------------------------------
var EACH = [["starter", STARTER_Q], ["starter, two stations", "Draw a 3-wire start stop control for a conveyor that can be started and stopped from two locations, 24 V DC"],
  ["reversing", "Draw a forward/reverse motor control circuit with interlocks"], ["sequence", "Draw a ladder diagram where conveyor 2 can only start after conveyor 1 is running"],
  ["delayed", "Draw a control circuit for a motor that starts 30 seconds after the start button is pressed, with a warning horn"],
  ["compressor", "Draw the control circuit for an air compressor with a pressure switch that cuts out at 120 psi"],
  ["fill", "Draw the control circuit for a pump that fills a tank with a float switch"], ["sump", "Draw the control circuit for a sump pump with a float switch"]];
EACH.forEach(function (e) {
  C.push({ id: "E-as-written-" + e[0].replace(/[^a-z]+/g, "-"), harm: "low", input: e[1] + " (its given, built)",
    right: "a tested given is drawn as written: Lantern adds only the holding contacts, and changes and moves nothing (a note under every such drawing is noise a person reads as a mistake)",
    run: function () {
      return lib.boot().then(function (x) {
        var g = lib.given(x.N.L, e[1]);
        if (!g.c) return "no given drawn: " + lib.probs(g.m);
        var add = (g.c.added || []).filter(function (a) { return !/holding contact across/.test(a); }), ch = g.c.changed || [];
        return add.concat(ch).length ? "Lantern says: " + lib.short(add.concat(ch).join(" | "), 300) : "";
      });
    } });
});
C.push({ id: "E-reversing-one-overload-twice", harm: "low", input: "Draw a forward/reverse motor control circuit with interlocks (its given, drawn)",
  right: "one overload relay's contact drawn once, in the line common to both coils (NEMA/JIC reversing diagrams): its overload has one normally closed contact, and two OL1 contacts in two rungs read as a device with two",
  run: function () {
    return lib.boot().then(function (x) {
      var g = lib.given(x.N.L, "Draw a forward/reverse motor control circuit with interlocks");
      if (!g.c) return "no given drawn";
      var n = lib.elements(g.c).filter(function (y) { return y.e.kind === "ol"; }).length;
      return n > 1 ? "OL1 is drawn " + n + " times (once in each coil's rung), from the given's line \x22overload OL1 M1 M2\x22" : "";
    });
  } });
// ---- the correction turn, and a question of several parts ----------------------------------------------------------
C.push({ id: "E-correction-turn", harm: "low", input: STARTER_Q + " -- answered with a block Lantern sends back (a wire line), then the given",
  right: "the correction turn as 1.24.35 sent it (the problem, the line to write, how Lantern reads the block), and the second reply made",
  run: async function () {
    var x = await lib.boot(), bad = [], txt = [], made = [];
    var broken = "MAKE CONTROL: Motor starter\nwire L1 PB1\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\nEND";
    for (var k = 0; k < 2; k++) {
      var L = k ? x.O.L : x.N.L, sent = null, n = 0, good = lib.shown(x.N.L, STARTER_Q).block;
      var out = await L.aiAct.solve(STARTER_Q, function (msgs) { n++; if (n === 2) sent = msgs[msgs.length - 1].content; return Promise.resolve(n === 1 ? broken : good); });
      txt.push(sent); made.push(out && out.made ? !!out.made.ok : out && out.fixed);
    }
    if (txt[0] !== txt[1]) bad.push("the correction differs from 1.24.35's: " + lib.short(txt[0], 300));
    return bad.join("; ");
  } });
C.push({ id: "E-parts-first-part", harm: "medium", input: "Draw a parts list for a motor starter and the control circuit for it with start and stop buttons",
  right: "when the control circuit is the part asked for, its given fitted to that part (no light, one station)",
  run: function () {
    return lib.boot().then(function (x) {
      var q = "Draw a parts list for a motor starter and the control circuit for it with start and stop buttons", s = lib.shown(x.N.L, q);
      if (!s.block) return "";
      var lamps = s.lines.filter(function (l) { return /^lamp/.test(l); }), starts = s.lines.filter(function (l) { return /^start/.test(l); });
      return lamps.length || starts.length !== 1 ? "shown " + lib.short(s.lines.join(" / "), 200) : "";
    });
  } });
C.push({ id: "E-says-above", harm: "low", input: "every given's prompt (one question each)",
  right: "what the given is, said ABOVE the block (CLAUDE.md, 1.24.6: what stands after a line to copy is copied with it); no comment after a device line",
  run: function () {
    return lib.boot().then(function (x) {
      var bad = [];
      EACH.forEach(function (e) {
        var s = lib.shown(x.N.L, e[1]);
        if (!s.block) { bad.push(e[0] + ": no given"); return; }
        var after = s.prompt.slice(s.prompt.indexOf(s.block) + s.block.length);
        // (another tool's instructions may follow after a blank line, as before: a ladder diagram is also offered MAKE CODE)
        if (/\S/.test(after) && !/^\n\nMAKE [A-Z]+: /.test(after)) bad.push(e[0] + ": text after the block: " + lib.short(after, 80));
        s.lines.forEach(function (l) { if (/\s{2,}\S|--|->/.test(l.replace(/\x22[^\x22]*\x22/g, "\x22\x22"))) bad.push(e[0] + ": a comment after a line: " + l); });
      });
      return bad.join("; ");
    });
  } });
module.exports = C;
