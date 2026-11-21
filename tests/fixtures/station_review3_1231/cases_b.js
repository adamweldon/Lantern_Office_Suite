// cases_b.js -- B: questions in parts that mix a station with other things. The split (AI_PARTS), the words each part
// is asked with (what a small model copies), and whole turns in Chat and on the bench's path with a scripted model:
// what was made, in what order, and the grammar each call carried.
"use strict";
var H = require("./lib.js");
var ST = H.st(["pumps 2", "floats off lead lag alarm"]);
var SLIDES = "MAKE SLIDES: Lift station\n# Lift station\n- Two pumps take turns\nEND";
var SHEET = "MAKE SHEET: Run hours\nPump | Hours\nP1 | 0\nP2 | 0\nEND";
function parts(q) { var p = H.L().aiParts.split(q); return p ? p.map(function (x) { return { kind: x.kind, text: x.text }; }) : null; }
function S(id, harm, q, want, right, extra) {
  return { id: id, harm: harm, input: { question: q }, right: right, run: function () { return H.boot().then(function () {
    var got = H.split(q); if (got !== want) return "split " + got + " (want " + want + "; 1.24.30: " + H.split(q, "old") + ")";
    return extra ? extra(parts(q), q) : ""; }); } };
}
// the station part's words: what the model is shown for it (the instructions' list, and a stray block's request)
function wordsOf(p, bad) { var t = p.filter(function (x) { return x.kind === "STATION"; })[0]; return t && bad.test(t.text) ? "the STATION part is asked for as “" + t.text + "”" : ""; }
function T(id, harm, q, replies, right, judge) {
  return { id: id, harm: harm, input: { question: q, replies: replies }, right: right, run: function () { return H.boot().then(function () { return H.turn(q, replies).then(function (t) { return t.error ? "threw: " + t.error : judge(t); }); }); } };
}
function V(id, harm, q, replies, right, judge) {
  return { id: id, harm: harm, input: { question: q, replies: replies, path: "solve" }, right: right, run: function () { return H.boot().then(function () { return H.solve(q, replies).then(judge); }); } };
}
function g(t) { return t.grammars.map(function (x) { var m = x && /^root ::= "MAKE ([A-Z ]+): "/.exec(x); return m ? m[1] : "-"; }).join(","); }

module.exports = [
  S("B-01", "medium", "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council", "STATION+SLIDES",
    "Two parts: the station whole (its control and piping in one MAKE STATION) and then the deck."),
  S("B-02", "low", "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council", "STATION+SLIDES",
    "The station part is asked for in the question's words. The merge joined the first part's ask (to which the list's last words, “for the city council”, were glued) into the text the model is shown: “1. Draw the control circuit for the city council, the piping for a duplex lift station (MAKE STATION)”. 1.24.30 showed “Draw the control circuit”.",
    function (p) { return wordsOf(p, /control circuit for the city council/); }),
  S("B-03", "medium", "Draw a duplex lift station's control circuit and piping, then make a spreadsheet of the pump run hours", "STATION+SHEET", "The station whole, then the sheet."),
  S("B-04", "low", "Draw a duplex lift station's control circuit and piping, then make a spreadsheet of the pump run hours", "STATION+SHEET",
    "The station part's words are the station's; shown as “Draw a duplex lift station's control circuit of the pump run hours, piping”.",
    function (p) { return wordsOf(p, /control circuit of the pump run hours/); }),
  S("B-05", "medium", "Design a duplex lift station and write an Arduino sketch for its controller", "STATION+CODE", "The station, then the sketch (1.24.30 made the sketch alone)."),
  S("B-06", "medium", "Draw a house with a red roof and a duplex lift station's control circuit and piping", "DRAWING+STATION", "A house first, then the station whole."),
  S("B-07", "medium", "Draw the control circuit and piping for a duplex lift station, then make flashcards about its parts", "STATION+CARDS", "The station whole, then the cards."),
  S("B-08", "medium", "Draw the control circuit for a lift station. Then draw the piping. Then make a slide deck about it", "STATION+SLIDES", "Three sentences: the two drawings are one station part, then the deck."),
  S("B-09", "low", "Draw the control circuit and the piping for a duplex lift station and the control circuit for a conveyor motor starter", "STATION+CONTROL",
    "The station's two drawings are one STATION part, as beside a house or a deck, and the conveyor's starter its own MAKE CONTROL. Lantern made three parts (CONTROL, PIPING, CONTROL) as 1.24.30 did: no station, its parts list and checks, for this question."),
  S("B-10", "medium", "Draw the control circuit and piping for a duplex lift station, then make a table of the float heights", "STATION+SHEET",
    "A table of the float heights is a sheet (1.24.30 made CONTROL+PIPING+SHEET). Read whole as the station, the table is not made and nothing says so."),
  { id: "B-11", harm: "low", input: { question: "Draw the control circuit and piping for a duplex lift station and for a simplex sump pump station", reply: ST },
    right: "Two stations asked for: two STATION parts, or one station that says the other was not made. Lantern makes one duplex station and says nothing of the simplex (1.24.30 made one control and one piping, also saying nothing).",
    run: function () { return H.boot().then(function () {
      var q = "Draw the control circuit and piping for a duplex lift station and for a simplex sump pump station", sp = H.split(q);
      if (sp === "STATION+STATION") return "";
      var r = H.L().aiAct.build(ST, q), said = r.plan ? r.plan.said.concat(r.plan.warn, r.plan.left).join(" ") : "";
      return /simplex|sump|second station|1 pump|names 1/i.test(said) ? "" : "split " + sp + "; one station of " + H.pumpsOf(r) + " pumps made, and nothing said of the simplex: " + said; }); } },
  S("B-12", "medium", "1) Draw the control circuit for a duplex lift station 2) draw its piping 3) draw the float levels", "-", "A numbered list of the station's three drawings: one MAKE STATION, not split."),
  S("B-13", "medium", "Draw a 2 pump lift station: the control, the plumbing and the float positions", "-", "The station's three drawings under a heading: one block, not split."),
  // --- whole turns ------------------------------------------------------------------------------------------------
  T("B-14", "medium", "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council", [ST, SLIDES],
    "Chat: the station made, then the deck asked for with its own instructions and held to the SLIDES grammar; two calls.",
    function (t) { return t.mades.join("+") === "STATION+SLIDES" && g(t) === "-,SLIDES" && t.calls === 2 ? "" : "made " + t.mades.join("+") + ", grammars " + g(t) + ", calls " + t.calls; }),
  T("B-15", "medium", "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council",
    [H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'alternator AR M1 M2', 'coil M1', 'coil M2']), H.st(["pumps 2"]), SLIDES],
    "Chat: a MAKE CONTROL for the station part is not the part: MAKE STATION asked for once (held to its grammar), then the deck.",
    function (t) { return /MAKE STATION/.test(t.sent[1] || "") && g(t) === "-,STATION,SLIDES" && t.mades.slice(-2).join("+") === "STATION+SLIDES" ? "" : "made " + t.mades.join("+") + ", grammars " + g(t); }),
  T("B-16", "medium", "Design a duplex lift station and write an Arduino sketch for its controller", [ST, "MAKE CODE: Controller\nlanguage arduino\nvoid setup() {}\nvoid loop() {}\nEND"],
    "Chat: the station, then the sketch held to the CODE grammar.",
    function (t) { return t.mades.join("+") === "STATION+CODE" && g(t) === "-,CODE" ? "" : "made " + t.mades.join("+") + ", grammars " + g(t); }),
  T("B-17", "medium", "Draw a house with a red roof and a duplex lift station's control circuit and piping",
    ["MAKE DRAWING: House\nrect 7 6 6 4 fill tan\ntri 6 6 10 3 14 6 fill red\nEND", ST],
    "Chat: the house, then the station asked for and held to the STATION grammar.",
    function (t) { return t.mades.join("+") === "DRAWING+STATION" && g(t) === "-,STATION" ? "" : "made " + t.mades.join("+") + ", grammars " + g(t) + " notes " + t.notes.join(" | ").slice(0, 300); }),
  T("B-18", "medium", "Draw a duplex lift station's control circuit and piping, then make a spreadsheet of the pump run hours", [ST + "\n\n" + SHEET],
    "Chat: both blocks written at once: both made in one call.",
    function (t) { return t.mades.join("+") === "STATION+SHEET" && t.calls === 1 ? "" : "made " + t.mades.join("+") + " in " + t.calls + " calls"; }),
  T("B-19", "medium", "Draw a duplex lift station's control circuit and piping, then make a spreadsheet of the pump run hours", [ST, "Here are the run hours: P1 0 h, P2 0 h.", SHEET],
    "Chat: the sheet answered with prose is asked for once (its first line), then made.",
    function (t) { return t.mades.join("+") === "STATION+SHEET" && t.calls === 3 ? "" : "made " + t.mades.join("+") + " in " + t.calls + " calls; grammars " + g(t); }),
  V("B-20", "medium", "Draw a duplex lift station's control circuit and piping, then make a spreadsheet of the pump run hours", [ST, SHEET],
    "The bench's path: the station first (out.made), then the sheet as the second part, its call held to the SHEET grammar.",
    function (s) { var ps = (s.out.parts || []).map(function (p) { return p.kind + (p.ok ? "" : "(not made)"); }).join("+"); var gs = s.opts.map(function (o) { return o && o.grammar ? (/MAKE ([A-Z]+)/.exec(o.grammar) || [])[1] : "-"; }).join(","); return ps === "STATION+SHEET" && gs === "-,SHEET" ? "" : "parts " + ps + ", grammars " + gs; }),
  V("B-21", "medium", "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council", [H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'alternator AR M1 M2', 'coil M1', 'coil M2']), ST, SLIDES],
    "The bench's path: a MAKE CONTROL for the station part, then MAKE STATION asked for (held), then the deck: the station is made.",
    function (s) { var ps = (s.out.parts || []).map(function (p) { return p.kind + (p.ok ? "" : "(not made)"); }).join("+"); return /STATION\+SLIDES$/.test(ps) && !/STATION\(not made\)/.test(ps) ? "" : "parts " + ps; }),
  // --- a whole station question answered with another block: the station asked for once ----------------------------
  T("B-22", "medium", "Design a duplex lift station: draw the control circuit, the piping and the float levels", ["MAKE DRAWING: Lift station\nrect 2 2 6 6 fill grey\nEND", H.st(["pumps 2"])],
    "Chat: a picture on the grid for a station question: MAKE STATION asked for once, held to its grammar, and made.",
    function (t) { return t.mades.join() === "STATION" && g(t) === "-,STATION" ? "" : "made " + t.mades + ", grammars " + g(t); }),
  T("B-23", "medium", "Design a duplex lift station: draw the control circuit, the piping and the float levels", ["MAKE CODE: PLC\nlanguage st\nIF FS2 THEN M1 := TRUE; END_IF;\nEND", H.st(["pumps 2"])],
    "Chat: a program for a station question that asks for drawings: MAKE STATION asked for once.",
    function (t) { return t.mades.join() === "STATION" && g(t) === "-,STATION" ? "" : "made " + t.mades + ", grammars " + g(t); }),
  T("B-24", "medium", "Design a duplex lift station: draw the control circuit, the piping and the float levels", ["MAKE DRAWING: Lift station\nrect 2 2 6 6 fill grey\nEND"],
    "Chat: the picture again after the station was asked for: asked once only, the picture kept, two calls.",
    function (t) { return t.calls === 2 && t.mades.join() === "DRAWING" ? "" : "calls " + t.calls + ", made " + t.mades; })
];
