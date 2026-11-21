// station.js -- MAKE STATION (1.24.31): a pump station from one short block. Adam, after the lift station of 1.24.30:
// "Can we design a system so it automatically does what is necessary in most instances for such things as the lift
// station?" The AI says what the station is (pumps 2, floats off lead lag alarm); Lantern draws the control, the
// piping and the float levels from it, and writes the parts list, how it works, the checks and what it does not know.
// Also here: the usual four floats added to a duplex MAKE CONTROL written with none (the 2B's, 1.24.30), and the
// grammar that holds a reply to the block Lantern asked for (AI_ACTIONS' grammarFor, checked against llama.cpp's own
// parser in tests/fixtures/grammar_1231).
"use strict";
var fs = require("fs"), path = require("path");
var load = require(path.join(__dirname, "fixtures", "liftstation_review1_1230", "load.js"));
var SRC = process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html");
var RUN = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "liftstation_1230", "run_35b.json"), "utf8"));
var CASES = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "grammar_1231", "cases.json"), "utf8"));
var CHECKED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "grammar_1231", "results_b11435.json"), "utf8"));
var passes = 0, fails = 0;
function ok(name, cond, info) {
  if (cond) { passes++; console.log("ok   " + name); }
  else { fails++; console.log("FAIL " + name + (info !== undefined ? "\n     " + JSON.stringify(info).slice(0, 1500) : "")); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
function strip(src, mods) {
  mods.forEach(function (m) {
    var a = src.indexOf("// MODULE: " + m + " - START"), b = src.indexOf("// MODULE: " + m + " - END");
    if (a < 0 || b < 0) throw new Error("no module " + m);
    src = src.slice(0, a) + src.slice(b);
  });
  return src;
}
var Q = RUN.question;
var OLD_IDEAL = "MAKE CONTROL: Duplex lift station\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22high level alarm\x22\nalternator AR M1 M2\ncoil M1 \x22pump 1 starter\x22\ncoil M2 \x22pump 2 starter\x22\nEND\n\n" +
  "MAKE PIPING: Lift station\npump P1\npump P2\nEND\n\nMAKE LEVELS: Wet well\npump P1 P2\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22high level alarm\x22\nEND";

(async function () {
  var o = load(SRC), L = o.L;
  await sleep(80);
  await L.ai.detect();
  var act = L.aiAct, S = L.aiStation, C = L.CHAT;
  ok("boot clean, with MAKE STATION", o.errs.length === 0 && S && S.build && act.grammarFor, o.errs);

  // --- which tool --------------------------------------------------------------------------------------
  function ids(q) { return act.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
  ok("Adam's question is one MAKE STATION block: the station alone is offered, and it is not split", ids(Q) === "station" && !L.aiParts.split(Q), [ids(Q), L.aiParts.split(Q)]);
  var pr = act.prompt(Q);
  ok("...its instructions are the station's, short, with no other tool's and no list of parts", /MAKE STATION: <title>/.test(pr) && /pumps 2\nfloats off lead lag alarm\nEND/.test(pr) &&
    !/MAKE CONTROL: <title>/.test(pr) && !/This question asks for/.test(pr) && pr.split("\n").length < 30, pr);
  ok("...what each line is, is said above it, never after it (1.24.6)", S.PROMPT.every(function (l) { return !/^(float|well|inlet|main|valves|supply) .*\S\s{3,}\S/.test(l); }), S.PROMPT);
  ok("a station asked for whole, or two of its drawings or more, is MAKE STATION", ["Design a duplex lift station", "Draw a 2 pump lift station: the control, the plumbing and the float positions",
    "make a parts list and sequence of operation for a duplex sewage pump station", "Draw the wiring and the piping of a sewage pump station",
    "Draw the ladder diagram for a duplex sewage pump station whose two pumps take turns through an alternating relay, with a lag float that runs both. Then draw the piping of the station, and a drawing of the float levels in its wet well."]
    .every(function (q) { return ids(q) === "station"; }));
  ok("one drawing of a station is still its own tool; a house, a PLC program and a fire pump are not a station", ids("Draw the control circuit for a duplex lift station with an alternating relay") === "schematic" &&
    ids("draw the plumbing for a lift station") === "piping" && ids("draw a section of the wet well showing where the floats go") === "levels" &&
    ids("draw the control circuit for a duplex lift station: floats off, lead, lag and high level alarm, with an alternating relay") === "schematic" &&
    ids("Draw a house with a red roof") === "drawing" && !/station/.test(ids("Write a PLC program for a duplex lift station's control and piping")) &&
    !/station/.test(ids("Design the fire pump station: its control and piping")), [ids("Write a PLC program for a duplex lift station's control and piping"), ids("Design the fire pump station: its control and piping")]);
  var dk = "Draw the control circuit and the piping for a duplex lift station, then make a slide deck about it for the city council", dkp = L.aiParts.split(dk);
  ok("a station's drawings beside a slide deck about it: two parts, the station whole and then the deck (the first review)", dkp && dkp.map(function (p) { return p.kind; }).join(",") === "STATION,SLIDES" &&
    ["Make a slide deck about lift stations for a city council meeting", "Make a spreadsheet of lift station pump run hours", "Make flashcards about lift station parts", "Plan a maintenance schedule for our lift station",
      "Draw the plumbing and wiring for my duplex (a two-family house)", "Design a duplex air compressor station: its control and piping"].every(function (q) { return !S.asks(q); }), dkp && dkp.map(function (p) { return p.kind; }));
  var benchSt = (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).filter(function (q) { return S.asks(q.q); }).map(function (q) { return q.id; }).sort().join(",");
  ok("of every bench question, only the two lift stations are a station", benchSt === "make-liftstation,make-liftstation-b", benchSt);

  // --- the station from one block ---------------------------------------------------------------------
  var B = L.aiBench, item = (L.aiBenchQuestions || []).filter(function (q) { return q.id === "make-liftstation"; })[0];
  var r1 = act.build("MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND", Q), p1 = r1.plan;
  ok("the guide's own example: drawn whole, nothing questioned", r1.ok && p1 && p1.mode === "station" && Object.keys(p1.views).join(",") === "control,piping,levels", r1.problems);
  ok("...the control: the alternating relay takes the two pumps in turn, a float starts them (the bench's own check)", item && item.check(p1.views.control) === "", item && item.check(p1.views.control));
  var cr = p1.views.control.circuit, outs = cr.rungs.map(function (r) { return r.out.id; }).join(",");
  ok("...the four floats, the lead and lag calls, both pumps and a light each, the alarm light", outs === "CR1,AR,CR2,M1,M2,LT1,LT2,LT3", outs);
  ok("...the piping: two pumps, each with its check and shutoff valve; the levels off, lead on, lag on, high level alarm", item.partCheck.PIPING(p1.views.piping) === "" &&
    p1.views.levels.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") === "FS1:off,FS2:lead,FS3:lag,FS4:alarm", p1.views.levels.floats);
  ok("...one set of floats for all three: the control's are the levels'", ["FS1", "FS2", "FS3", "FS4"].every(function (id) { return cr.rungs.some(function (r) { return r.starts.concat(r.stops, r.series).some(function (e) { return e.id === id; }); }); }));
  var tags = p1.parts.map(function (r) { return r.tags; }).join(",");
  ok("...the parts list, read off the drawings: pumps, valves, floats, starters, overloads, relays, lights", ["P1, P2", "CV1, CV2", "V1, V2", "FS1", "FS4", "M1, M2", "OL1, OL2", "CR1", "CR2", "AR", "LT3"].every(function (t) { return tags.indexOf(t) >= 0; }) &&
    p1.parts.some(function (r) { return /^Wet well/.test(r.item); }) && p1.parts.some(function (r) { return /Valve vault/.test(r.item); }), p1.parts);
  ok("...how it works, in the order it happens, and the circuit's own steps", p1.sequence.plain.length === 4 && /^As the water rises to FS2 \(lead on\), the lead pump starts; it pumps the well down to FS1 \(off\) and stops\.$/.test(p1.sequence.plain[0]) &&
    /alternating relay changes over/.test(p1.sequence.plain[1]) && p1.sequence.rungs.length === cr.steps.length, p1.sequence);
  ok("...the checks: an electrician, never into the wet well (OSHA 1910.146), lock out; each float, the alternation, the lag, the alarm, the check valves", /licensed electrician/.test(p1.checks.before[0]) &&
    /confined space/.test(p1.checks.before[1]) && /1910\.146/.test(p1.checks.before[1]) && /Lock out/.test(p1.checks.before[2]) &&
    /lift FS2 \(lead on\)/.test(p1.checks.run.join(" ")) && /the other pump starts/.test(p1.checks.run.join(" ")) && /Lift FS3 \(lag on\) with FS2 up: both pumps run/.test(p1.checks.run.join(" ")) &&
    /Lift FS4 \(high level alarm\): the alarm light comes on/.test(p1.checks.run.join(" ")) && /check valve closes/.test(p1.checks.run.join(" ")), p1.checks);
  ok("...the checks as the fact check found them on their pages: no one goes in after a collapsed worker, the power on only with everyone clear (1910.147), the valves opened before any pump runs, the alarm on backup power",
    /do not go in after them: call for rescue/.test(p1.checks.before[1]) && /1926 Subpart AA/.test(p1.checks.before[1]) && /1910\.147/.test(p1.checks.before[2]) && !/touches a pump, a float/.test(p1.checks.before[2]) &&
    /^Before any pump runs: each shutoff valve/.test(p1.checks.run[0]) && /backup power of its own/.test(p1.checks.run.join(" ")) && /may still sound normal/.test(p1.checks.run.join(" ")) &&
    /450 mm \(18 in\) side to side/.test(p1.checks.run.join(" ")), p1.checks);
  ok("...what a station needs that is not drawn, in the parts list (the alarm on backup power, gas-rated equipment, a blower)", p1.parts.filter(function (r) { return /^Not drawn: /.test(r.item); }).length === 3, p1.parts);
  ok("...what Lantern does not know, and what it assumed, said", p1.unknown.length === 6 && /minimum submergence/.test(p1.unknown[0]) && /one pump out of service/.test(p1.unknown[2]) && /power fails/.test(p1.unknown[3]) &&
    p1.said.join("; ") === "no control voltage: the ladder is drawn between L1 and L2; a run light for each pump and a red light on the high level alarm", p1.said);
  ok("...the summary says what was drawn and what was assumed", /^Lantern drew the control circuit, the piping and the float levels from one description/.test(r1.summary) && /Lantern assumed: no control voltage/.test(r1.summary), r1.summary);

  var r2 = act.build("MAKE STATION: Lift station\nEND", Q);
  ok("an empty block: the question's two pumps and the usual four floats, said", r2.ok && r2.plan.spec.pumps.join(",") === "P1,P2" && r2.plan.spec.floats.length === 4 &&
    /^2 pumps \(the question asks for a duplex\)$/.test(r2.plan.said[0]) && /^the usual floats for 2 pumps, from the bottom up: off, lead on, lag on and high level alarm$/.test(r2.plan.said[1]), r2.plan.said);
  var copied = "MAKE STATION: Copied\n" + S.PROMPT.slice(1).filter(function (l) { return !/^(MAKE STATION|END)/.test(l); }).join("\n") + "\nEND";
  var r3 = act.build(copied, Q);
  ok("the whole guide copied into the block (the 0.8B's way): the usual station, the guide's prose read as nothing, its placeholders as no value", r3.ok && !r3.plan.unread.length &&
    r3.plan.spec.floats.map(function (f) { return f.label; }).join(",") === "off,lead on,lag on,high level alarm" && r3.plan.spec.valve === "" && r3.plan.spec.supply === "" &&
    r3.plan.spec.floats.every(function (f) { return !f.height; }), r3.plan && [r3.plan.unread, r3.plan.spec]);
  var r4 = act.build("MAKE STATION: Heights\npumps 2\nfloats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft\nwell \x22wet well\x22 10 ft\ninlet \x228 in gravity sewer\x22 6.5 ft\nmain \x224 in force main\x22\nvalves plug\nsupply \x22120 V AC\x22\nEND", Q);
  ok("heights, the well, the inlet, the force main, plug valves and the control voltage: each where it goes", r4.ok && r4.plan.views.levels.scaled && r4.plan.views.levels.floats.map(function (f) { return f.height; }).join(",") === "2 ft,3 ft,4 ft,5 ft" &&
    r4.plan.views.levels.inlet.height === "6.5 ft" && r4.plan.views.piping.pumps.every(function (p) { return p.valveKind === "plug"; }) && r4.plan.views.piping.main === "4 in force main" &&
    r4.plan.views.control.circuit.rails[0] === "120 V AC" && !/no control voltage/.test(r4.summary), r4.plan && [r4.plan.views.levels, r4.plan.views.piping.main]);
  var r5 = act.build("MAKE STATION: Bad\npumps 2\nfloats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft\nEND", Q);
  ok("floats out of order: the drawings that can be are, and the levels go back with what to write", !r5.ok && r5.plan && r5.plan.views.control && !r5.plan.views.levels &&
    /^the float levels: FS2 \(lead on\) at 3 ft is not above FS1 \(off\) at 4 ft/.test(r5.problems[0]), r5.problems);
  var fix = act.fixText(r5, Q);
  ok("...and the correction shows the station's own lines", /Lantern reads a MAKE STATION block line by line/.test(fix) && /floats off lead lag alarm/.test(fix), fix);
  var r6 = act.build("MAKE STATION: Floats\npumps 2\nfloat FS1 \x22off\x22\nfloat FS2 \x22float two\x22\nEND", Q);
  ok("a float that does not say what it is for goes back with the line to write", !r6.ok && /^“float FS2 \x22float two\x22” does not say what the float is for: name its job, like: float FS2 \x22lead on\x22$/.test(r6.problems[0]), r6.problems);
  var r7 = act.build("MAKE STATION: Three\npumps 3\nEND", Q);
  ok("the question's two pumps over the block's three, said", r7.ok && r7.plan.spec.pumps.length === 2 && /^2 pumps: the question asks for 2 \(the block said 3\)$/.test(r7.plan.said[0]), r7.plan.said);
  var sq = "Design a simplex sump pump station: the control, the piping and the float levels";
  var r8 = act.build("MAKE STATION: Sump\npumps 1\nEND", sq), c8 = r8.plan && r8.plan.views.control.circuit, m8 = c8 && c8.rungs.filter(function (r) { return r.out.id === "M1"; })[0];
  ok("one pump: no alternating relay; the pump on float FS2 (pump on), held in until FS1 (off), and the alarm light", r8.ok && m8 && m8.seal && m8.starts.map(function (e) { return e.id; }).join() === "FS2" &&
    m8.stops.map(function (e) { return e.id; }).join() === "FS1" && !c8.rungs.some(function (r) { return r.out.kind === "alternator"; }) && c8.rungs.some(function (r) { return r.out.kind === "lamp" && r.series.some(function (e) { return e.id === "FS3"; }); }) &&
    r8.plan.sequence.plain.length === 2 && !/alternating/.test(r8.plan.checks.run.join(" ")), c8 && c8.rungs);
  var r9 = act.build("MAKE STATION: Triplex\npumps 3\nEND", "Design a triplex lift station");
  ok("three pumps: piping and levels drawn; the control not, and said why", r9.ok && !r9.plan.views.control && r9.plan.views.piping.pumps.length === 3 && r9.plan.views.levels &&
    /^the control circuit: Lantern’s alternating relay takes two pumps in turn/.test(r9.plan.left[0]) && /Not drawn: the control circuit/.test(r9.summary), r9.plan && r9.plan.left);
  var r10 = act.build("MAKE STATION: Two views\npumps 2\nshow control piping\nEND", Q);
  ok("a show line draws the drawings it names", r10.ok && Object.keys(r10.plan.views).join(",") === "control,piping", Object.keys(r10.plan.views));

  // --- the drawings' own blocks, for a station question -------------------------------------------------
  var r11 = act.build(RUN.replies[1].reply, Q);
  ok("the 35B's own MAKE CONTROL, for Adam's question: read as the station, its control as written, the piping and the levels made from it", r11.ok && r11.readAs === "STATION" &&
    r11.plan.given.join() === "control" && r11.plan.views.control.circuit.rungs.some(function (r) { return r.out.id === "AR"; }) && r11.plan.views.piping.pumps.length === 2 &&
    r11.plan.views.levels.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") === "FS2:off,FS1:lead,FS3:alarm" && /^Read as MAKE STATION, a pump station: the control circuit as written/.test(r11.summary),
    r11.plan && [r11.plan.given, r11.plan.views.levels && r11.plan.views.levels.floats, r11.summary]);
  var r12 = act.build(OLD_IDEAL, Q);
  ok("...all three written at once: each drawn as written, one station", r12.ok && r12.readAs === "STATION" && r12.plan.given.join() === "control,piping,levels", r12.plan && r12.plan.given);
  ok("...a drawing's block for a question about that drawing alone stays that drawing", !act.build(RUN.replies[1].reply, "Draw the control circuit for a duplex lift station with an alternating relay").readAs);

  // --- the bench's path ------------------------------------------------------------------------------
  var itemB = (L.aiBenchQuestionsB || []).filter(function (q) { return q.id === "make-liftstation-b"; })[0];
  var bo = await act.solve(item.q, seq([item.ideal])), boB = await act.solve(itemB.q, seq([itemB.ideal]));
  ok("the bench: both lift stations' model answers (one MAKE STATION each) pass, in one round", B.grade(item, bo.text, bo).pass && B.grade(itemB, boB.text, boB).pass && bo.rounds === 1,
    [B.grade(item, bo.text, bo).why, B.grade(itemB, boB.text, boB).why]);
  var bo2 = await act.solve(item.q, seq(["MAKE STATION: Lift station\npumps 2\nshow control piping\nEND"]));
  ok("...a station without its float levels fails, as a missing part did", /the MAKE LEVELS part was not made/.test(B.grade(item, bo2.text, bo2).why), B.grade(item, bo2.text, bo2).why);
  var bo3 = await act.solve(item.q, seq([OLD_IDEAL]));
  ok("...the 1.24.30 answer (the three blocks) passes too: read as the station", B.grade(item, bo3.text, bo3).pass, B.grade(item, bo3.text, bo3).why);
  var bo4 = await act.solve(itemB.q, seq(["MAKE STATION: Station\npumps 2\nfloats off lead alarm\nEND"]));
  ok("...set B's lag float is checked: a station without one fails it", /no lag float/.test(B.grade(itemB, bo4.text, bo4).why), B.grade(itemB, bo4.text, bo4).why);

  // --- Chat --------------------------------------------------------------------------------------------
  var bodies = [];
  async function chat(q, replies) {
    var sent = [];
    bodies = [];
    o.script = function (last, body) { sent.push(last); bodies.push(body); return replies[Math.min(sent.length - 1, replies.length - 1)]; };
    var r = await C.turn([], q, {}, {});
    return { r: r, sent: sent };
  }
  var c1 = await chat(Q, ["MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND"]);
  ok("Chat: one block, one turn, all of it made", c1.sent.length === 1 && c1.r.made && c1.r.made.ok && c1.r.made.plan.mode === "station" && !bodies[0].grammar, [c1.sent.length, c1.r.made && c1.r.made.problems]);
  var v1 = act.view(c1.r.made);
  ok("...shown as a pump station: the three drawings, the parts list, how it works, the checks, and its buttons", /^Lantern made a pump station: Lift station/.test(v1.textContent) &&
    /Control circuit/.test(v1.textContent) && /Piping/.test(v1.textContent) && /Float levels/.test(v1.textContent) && v1.querySelectorAll("table tr").length === c1.r.made.plan.parts.length + 1 &&
    /Checks when it is set to work/.test(v1.textContent) && /What Lantern does not know/.test(v1.textContent) &&
    Array.prototype.map.call(v1.querySelectorAll("button"), function (b) { return b.textContent; }).join("|") === "Open in Writer|Control circuit in Draw|Piping in Draw|Float levels in Draw|Save .pdf",
    Array.prototype.map.call(v1.querySelectorAll("button"), function (b) { return b.textContent; }));
  var made1 = null, cr0 = L.writerDocs.create;
  L.writerDocs.create = function (t, h) { made1 = { t: t, h: h }; return cr0.call(L.writerDocs, t, h); };
  try { c1.r.made.open(); } catch (e) { }
  L.writerDocs.create = cr0;
  ok("...Open in Writer: one document with each drawing, the parts list, how it works, the checks and the sources", made1 && made1.t === "Lift station" && /<h2>Parts list<\/h2>/.test(made1.h) &&
    /<h2>Checks when it is set to work<\/h2>/.test(made1.h) && !/ALARM /.test(made1.h) && /The alarm Lantern draws is on the control circuit/.test(made1.h) && /Ten States Standards/.test(made1.h) && /1910\.146/.test(made1.h) && /<h2>Control circuit<\/h2>/.test(made1.h), made1 && made1.h.slice(0, 300));
  var c2 = await chat(Q, [RUN.replies[0].reply, "MAKE STATION: Lift station\npumps 2\nEND"]);
  ok("Chat: prose first, the station's block asked for -- and the reply held to its grammar", c2.sent.length === 2 && /MAKE STATION: <a short title>/.test(c2.sent[1]) &&
    bodies[1].grammar && /^root ::= "MAKE STATION: " title/.test(bodies[1].grammar) && !bodies[0].grammar && c2.r.made && c2.r.made.ok && c2.r.grammar === 1, [c2.sent, bodies.map(function (b) { return !!b.grammar; })]);
  var c3 = await chat(Q, ["MAKE STATION: Bad\npumps 2\nfloats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft\nEND", "MAKE STATION: Good\npumps 2\nfloats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft\nEND"]);
  ok("Chat: a station Lantern questions goes back once, the correction held to the grammar", c3.sent.length === 2 && /^Lantern checked your MAKE STATION block/.test(c3.sent[1]) && bodies[1].grammar && c3.r.made.ok, [c3.sent, c3.r.made && c3.r.made.problems]);
  var bo5 = await (async function () { var got = []; var r = await act.solve(Q, function (m, op) { got.push(op || null); return Promise.resolve(got.length === 1 ? "I cannot draw." : "MAKE STATION: S\npumps 2\nEND"); }); return { r: r, got: got }; })();
  ok("the bench's path: the block asked for after prose carries the grammar too", bo5.got.length === 2 && !bo5.got[0] && bo5.got[1] && /^root ::= "MAKE STATION: "/.test(bo5.got[1].grammar) && bo5.r.made.ok, bo5.got);

  // --- the grammar ----------------------------------------------------------------------------------------
  ok("each grammar is the one llama.cpp's own parser read and ran the blocks through (tests/fixtures/grammar_1231)", CASES.every(function (c) { return act.grammarFor(c.name) === c.grammar; }) &&
    CHECKED.length === CASES.length && CHECKED.every(function (c) { return c.parsed && c.samples.every(function (s) { return s.agree; }); }), CASES.filter(function (c) { return act.grammarFor(c.name) !== c.grammar; }).map(function (c) { return c.name; }));
  ok("...no grammar for a kind Lantern has no tool for", act.grammarFor("SPACESHIP") === null && act.grammarFor("") === null);
  // (1.24.32) 1.24.31's run: a grammar that went on to END forbade the end of a reply, and the small models ran on to their
  // limit (the replies in tests/fixtures/bench_run_1.24.31_*.json, each now a sample the grammar lets stop: grammar_1231)
  var gEnd = CASES.map(function (c) { return c.grammar; });
  ok("(1.24.32) every grammar lets a reply stop without END, and takes nothing after END", gEnd.every(function (g) { return /^root ::= "MAKE [A-Z ]+: " title "\\n" \(line "\\n"\)\* \("END" \| line\)\?$/m.test(g); }) &&
    CHECKED.some(function (c) { return c.samples.some(function (s) { return s.want && !/\nEND\s*$/.test(s.text) && s.agree; }); }), gEnd.filter(function (g) { return !/\("END" \| line\)\?$/m.test(g); }).slice(0, 2));
  ok("...the replies of 1.24.31 that ran to their limit, cut at a whole line, are each a place the model may now stop", CHECKED.filter(function (c) { return c.samples.length && c.samples.every(function (s) { return s.want; }) && c.samples.some(function (s) { return s.text.length > 400; }); }).length >= 5);
  var ne = act.build("MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm", Q);
  ok("...and a block that stops without END is read whole (a station, two pumps, four floats)", ne && ne.ok && ne.plan && ne.plan.mode === "station", ne && ne.problems);
  // (1.24.33) 1.24.32's run: whole replies that stopped without END were questioned as "cut off before END"
  // (tests/fixtures/bench_run_1.24.32_0.8b.json); the server's finish says which ended themselves
  var R32 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1.24.32_0.8b.json"), "utf8"));
  var oil = R32.filter(function (r) { return r.id === "make-doc-oil-change"; })[0], AIx = L.ai;
  function asIf(fin, rep) { var a = AIx.lastFinish, b = AIx.lastReply; AIx.lastFinish = fin; AIx.lastReply = rep; try { return act.build(oil.reply, oil.question || ""); } finally { AIx.lastFinish = a; AIx.lastReply = b; } }
  var mStop = asIf("stop", oil.reply), mLen = asIf("length", oil.reply), mOther = asIf("stop", "MAKE DOC: another reply\nEND"), mNone = asIf(null, null);
  ok("(1.24.33) a reply the model ended itself without END (1.24.32's 0.8B: an oil change in three steps) is read whole, not \u201ccut off\u201d", mStop && mStop.ok && !/cut off/.test((mStop.problems || []).join()), mStop && mStop.problems);
  ok("...one the server cut at its length, or not the reply the server gave last, or with no finish known, is still cut off", [mLen, mOther, mNone].every(function (m) { return m && /cut off before END/.test((m.problems || []).join()); }));
  ok("...a control block's other names hold to CONTROL's lines; SCHEMATIC and ELECTRONICS take any line but END itself (the third review's F-26)", (function () {
    var tail = function (k) { return (act.grammarFor(k) || "").split("\n").slice(1).join("\n"); }, c = tail("CONTROL");
    return tail("LADDER DIAGRAM") === c && tail("CONTROL CIRCUIT") === c && /^line ::= \(\[\^E\\n\]/m.test(act.grammarFor("SCHEMATIC")) && /^line ::= \(\[\^E\\n\]/m.test(act.grammarFor("ELECTRONICS")) && !/^first ::=/m.test(act.grammarFor("SCHEMATIC"));
  })());
  // the server call: only to a llama.cpp server; refused once, never sent again
  var A = L.ai, sent2 = [], status = 200, fetch0 = o.w.fetch;
  o.w.fetch = function (url, op) {
    if (!/chat\/completions/.test(String(url))) return fetch0(url, op);
    var b = JSON.parse(op.body); sent2.push(b);
    var st = b.grammar && status === 400 ? 400 : 200, txt = st === 400 ? JSON.stringify({ error: { message: "failed to parse grammar", type: "invalid_request_error" } }) : JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: {} });
    return Promise.resolve({ ok: st < 400, status: st, statusText: "", headers: { get: function () { return "application/json"; } }, json: function () { return Promise.resolve(JSON.parse(txt)); }, text: function () { return Promise.resolve(txt); } });
  };
  var llama0 = A.server.llama;
  A.server.llama = false; await A.callServer([{ role: "user", content: "x" }], { grammar: "root ::= \x22x\x22" });
  A.server.llama = true; await A.callServer([{ role: "user", content: "x" }], { grammar: "root ::= \x22x\x22" });
  status = 400; var said400 = await A.callServer([{ role: "user", content: "x" }], { grammar: "root ::= \x22x\x22" });
  await A.callServer([{ role: "user", content: "x" }], { grammar: "root ::= \x22x\x22" });
  ok("the server call: no grammar to a server that is not llama.cpp's; sent to one that is; refused, the request made again without it, and never sent again",
    !sent2[0].grammar && sent2[1].grammar === "root ::= \x22x\x22" && sent2[2].grammar && !sent2[3].grammar && said400 === "ok" && !sent2[4].grammar && /failed to parse grammar/.test(A.noGrammar), sent2.map(function (b) { return !!b.grammar; }));
  o.w.fetch = fetch0; A.server.llama = llama0; A.noGrammar = null;

  // --- the usual four floats in a duplex written with none (the 2B's, 1.24.30) -----------------------------
  var dq = "draw the control circuit for a duplex lift station with an alternating relay";
  var d1 = act.build("MAKE CONTROL: Duplex\nalternator AR M1 M2\ncoil M1 \x22pump 1 starter\x22\ncoil M2 \x22pump 2 starter\x22\nEND", dq);
  ok("a duplex with no floats: the usual four added, from the bottom up, said, and wired", d1.ok && /Lantern added the floats FS1 \(off\), FS2 \(lead on\), FS3 \(lag on\) and FS4 \(high level alarm\), from the bottom up/.test(d1.summary) &&
    item.check(d1.plan) === "" && d1.plan.circuit.rungs.some(function (r) { return r.out.kind === "lamp" && r.series.some(function (e) { return e.id === "FS4"; }); }), d1.summary);
  var d2 = act.build("MAKE CONTROL: Duplex\nfloat FS1 \x22off\x22\nalternator AR M1 M2\ncoil M1\ncoil M2\nEND", dq);
  ok("...a duplex with a float but no start float is still asked for it (nothing added over what was written)", !d2.ok && /the pumps need a float to start them/.test(d2.problems.join(" ")), d2.problems);

  // --- without AI_STATION -----------------------------------------------------------------------------------
  var NOST = path.join(require("os").tmpdir(), "lantern_no_station_" + process.pid + ".html");
  fs.writeFileSync(NOST, strip(fs.readFileSync(SRC, "utf8"), ["AI_STATION"]));
  var o2 = load(NOST), L2 = o2.L;
  fs.unlinkSync(NOST);
  await sleep(50);
  ok("without AI_STATION: boot clean, Adam's question made one drawing at a time, as in 1.24.30", o2.errs.length === 0 && !L2.aiStation && L2.aiParts.split(Q) && L2.aiParts.split(Q).length === 3, o2.errs);

  console.log(fails ? fails + " STATION FAILURES (" + passes + " passed)" : "ALL STATION TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
