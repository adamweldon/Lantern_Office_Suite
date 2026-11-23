// liftstation_1234.js -- Adam's chat of 2026-11-23 (1.24.34). "write a schematic for a typical lift station. Include any
// other drawings a lift station would need": the question went to MAKE SCHEMATIC, whose parts are a hobby circuit's. The
// 35B wrote two MAKE SCHEMATIC blocks -- a breaker, a transformer, relays with a "Coil" wired, float "sensors", 21 parts;
// then a wet well as a tank, pumps and valves, "mode fluid". Lantern sent the first back; the 35B took the floats out to
// fit, its circuit was not closed, and nothing was made. The second block was never made nor mentioned, and the failure
// ended "fewer, bigger shapes or rows help".
// Now: the question is MAKE STATION's; a station question's part-and-wire schematics are read as the station (its pumps,
// its floats by name, its wet well and valves), the rest of their parts named; "emergency high" is the high level
// alarm; a reply's other blocks are made and shown (kept across a correction); an open circuit gets its line; and the
// failure's advice is the action's own. tests/fixtures/liftstation_1234/chat_35b.json is the chat, from the screenshot.
"use strict";
var fs = require("fs"), path = require("path");
var load = require(path.join(__dirname, "fixtures", "liftstation_review1_1230", "load.js"));
var SRC = process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html");
var CHAT = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "liftstation_1234", "chat_35b.json"), "utf8"));
var passes = 0, fails = 0;
function ok(name, cond, info) {
  if (cond) { passes++; console.log("ok   " + name); }
  else { fails++; console.log("FAIL " + name + (info !== undefined ? "\n     " + JSON.stringify(info).slice(0, 1500) : "")); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list) { var i = 0; return function () { return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
var Q = CHAT.question, R1 = CHAT.replies[0].reply, R2 = CHAT.replies[1].reply;
var PIPE = R1.slice(R1.indexOf("MAKE SCHEMATIC: Lift Station Piping"));

(async function () {
  var o = load(SRC), L = o.L;
  await sleep(80);
  await L.ai.detect();
  var act = L.aiAct, S = L.aiStation, C = L.CHAT;
  ok("boot clean", o.errs.length === 0 && S && act.rest, o.errs);
  function ids(q) { return act.relevant(q).map(function (a) { return a.id; }).sort().join(","); }

  // --- which tool ------------------------------------------------------------------------------------------
  ok("Adam's question is MAKE STATION's, whole, with the station's instructions", ids(Q) === "station" && !L.aiParts.split(Q) && /MAKE STATION: <title>/.test(act.prompt(Q)) && !/MAKE SCHEMATIC/.test(act.prompt(Q)), [ids(Q), act.prompt(Q).slice(0, 200)]);
  ok("a station's schematic written, given or produced is the station, as drawn was", ["write a schematic for a typical lift station", "Give me a schematic of a duplex lift station", "produce the drawings for a sewage lift station",
    "Draw the schematic of a lift station and any other drawings it needs", "What drawings does a lift station need? Draw them", "Write up the full drawing set for a lift station"].every(function (q) { return ids(q) === "station"; }),
    ["write a schematic for a typical lift station", "Give me a schematic of a duplex lift station", "produce the drawings for a sewage lift station", "Draw the schematic of a lift station and any other drawings it needs",
      "What drawings does a lift station need? Draw them", "Write up the full drawing set for a lift station"].map(ids));
  ok("...not a document, a program, a deck, a question asked in words, or another station", ["write a report about a lift station", "write an essay about lift stations", "Write a PLC program for a lift station",
    "What drawings does a lift station need?", "write a schematic for a fire pump station", "Make a slide deck about lift stations for the council", "write a schematic for a booster pump station"].every(function (q) { return !S.asks(q); }),
    ["write a report about a lift station", "write an essay about lift stations", "Write a PLC program for a lift station", "What drawings does a lift station need?", "write a schematic for a fire pump station",
      "Make a slide deck about lift stations for the council", "write a schematic for a booster pump station"].map(S.asks));

  // --- the 35B's blocks, read as the station ------------------------------------------------------------------
  var m1 = act.build(R1, Q);
  var sp = m1 && m1.plan && m1.plan.spec, fl = sp ? sp.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : "";
  ok("the 35B's two MAKE SCHEMATIC blocks make the station: its control, piping and float levels, nothing sent back", m1 && m1.ok && m1.readAs === "STATION" && m1.plan && Object.keys(m1.plan.views).sort().join(",") === "control,levels,piping",
    m1 && { ok: m1.ok, problems: m1.problems, readAs: m1.readAs });
  ok("...two pumps; its floats by their names, from the bottom up: Low Level off, High Level the lead (said), Emergency High the alarm", sp && sp.pumps.length === 2 && fl === "H2:off,H1:lead,H3:alarm" &&
    /the “High Level Float \(lead on\)” float starts the pumps/.test(m1.summary), [fl, m1 && m1.summary]);
  ok("...what it took and what it did not are said: the pumps, the floats, the well and valves; the breakers, transformer, relays, switches, lamps and the suction piping not carried",
    /^Read as MAKE STATION \(the question asks for a pump station’s drawings\), from the AI’s MAKE SCHEMATIC blocks: 2 pumps \(M1, M2 and P1, P2\), the floats H1 “High Level Float”, H2 “Low Level Float” and H3 “Emergency High”, the wet well \(W1\), the check valves \(V1, V2\) and the shutoff valves \(V3, V4\)\./.test(m1.summary) &&
    /not carried from the AI’s schematics: V1 \(source\); Q1, Q2 \(breaker\); T1 \(transformer\); L1–L4 \(lamp\); S1–S5 \(switch\); K1–K3 \(relay\); V5, V6 \(suction valve\); P3 \(pipe\); P4 \(suction pipe\)/.test(m1.summary) &&
    /no suction piping/.test(m1.summary), m1 && m1.summary);
  ok("...the gate valves are the shutoff valves drawn; the piping is two pumps each with its check and shutoff valve", m1.plan.spec.valve === "gate" && m1.plan.views.piping.pumps.length === 2 && m1.plan.views.piping.pumps.every(function (p) { return p.check && p.valve; }), m1.plan.spec);
  ok("...both blocks are the station's: Chat makes neither again on its own", (m1.reads || []).length === 2 && act.rest(R1, Q, m1).length === 0, [(m1.reads || []).length, act.rest(R1, Q, m1).length]);
  var mp = act.build(PIPE, Q);
  ok("the piping block alone: the station, with the usual floats said", mp && mp.ok && mp.readAs === "STATION" && /the usual floats for 2 pumps/.test(mp.summary) && /from the AI’s MAKE SCHEMATIC block: 2 pumps \(P1, P2\), the wet well \(W1\)/.test(mp.summary), mp && mp.summary);
  // the same blocks for a question that is not a station's: MAKE SCHEMATIC's own checks, as before
  var mx = act.build(R1, "draw an electrical schematic with a breaker and a transformer");
  ok("not a station's question: the block is MAKE SCHEMATIC's, checked as before", mx && !mx.ok && mx.readAs !== "STATION" && mx.problems.some(function (p) { return /no electrical part called “breaker”/.test(p); }), mx && mx.problems);
  // a part-and-wire block with no pump, float, well or valve in it is not read as a station
  var toy = "MAKE SCHEMATIC: Panel light\nmode electrical\npart V1 source \x22120 V\x22\npart S1 switch \x22Panel\x22\npart L1 lamp \x22Panel light\x22\nwire V1 S1\nwire S1 L1\nwire L1 V1\nEND";
  var mt = act.build(toy, Q);
  ok("a block that names no pump, float, well or valve is not read as the station (Chat asks for MAKE STATION once, as before)", mt && mt.readAs !== "STATION" && mt.ok, mt && { ok: mt.ok, readAs: mt.readAs, problems: mt.problems });
  // a float named with no job: back once as one MAKE STATION block, with the line
  var odd = "MAKE SCHEMATIC: LS\nmode electrical\npart V1 source \x22120 V\x22\npart F1 float \x22Float 1\x22\npart F2 float \x22Float 2\x22\npart M1 motor \x22Pump 1\x22\npart M2 motor \x22Pump 2\x22\nwire V1 F1\nwire F1 M1\nwire M1 V1\nEND";
  var mo = act.build(odd, Q);
  ok("floats named with no job: back once as a MAKE STATION block, the line to write in the problem", mo && !mo.ok && mo.fixKind === "STATION" && mo.problems.some(function (p) { return /does not say what the float is for: name its job, like: float F1 \x22/.test(p); }), mo && { problems: mo.problems, fixKind: mo.fixKind });

  // --- floats called emergency ----------------------------------------------------------------------------
  var FJ = L.aiControl.floatJob;
  ok("an emergency high float is the high level alarm; an emergency off or stop float is an off float; emergency low is the low alarm", FJ("Emergency High") === "alarm" && FJ("emergency high level") === "alarm" &&
    FJ("emergency off") === "off" && FJ("Emergency Stop Float") === "off" && FJ("emergency low") === "low" && FJ("high level") === "alarm" && FJ("lead on") === "lead",
    ["Emergency High", "emergency high level", "emergency off", "Emergency Stop Float", "emergency low", "high level", "lead on"].map(FJ));
  var mc = act.build("MAKE CONTROL: Duplex\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22lag on\x22\nfloat FS4 \x22emergency high\x22\nalternator AR M1 M2\ncoil M1 \x22pump 1 starter\x22\ncoil M2 \x22pump 2 starter\x22\nEND", "draw the control circuit for a duplex lift station with an alternating relay");
  var al = mc && mc.plan && mc.plan.circuit && mc.plan.circuit.rungs.filter(function (r) { return r.out.kind === "lamp" || r.out.kind === "horn"; }).some(function (r) { return r.series.concat(r.starts || []).some(function (e) { return e.id === "FS4"; }); });
  ok("...in MAKE CONTROL too: FS4 “emergency high” works the alarm, not a third start", mc && mc.ok && al, mc && { ok: mc.ok, problems: mc.problems });

  // --- a circuit that is not closed: the line to write ------------------------------------------------------
  var m2 = act.build(R2, "draw a circuit with a source, switches, two motors and three lamps");
  ok("the 35B's second try: it reaches the ground G1 and goes no further -- the line is wire G1 V1", m2 && !m2.ok && m2.problems.length === 1 && /the current reaches the ground G1 and goes no further: join it back to V1, like: wire G1 V1$/.test(m2.problems[0]), m2 && m2.problems);
  var m2b = act.build(R2.replace("wire L3 G1\n", "wire L3 G1\nwire G1 V1\n"), "draw a circuit with a source, switches, two motors and three lamps");
  ok("...written, it is made", m2b && m2b.ok, m2b && m2b.problems);
  var sm = act.build("MAKE SCHEMATIC: Lamp\npart B1 battery \x229 V\x22\npart S1 switch\npart L1 lamp\nwire B1 S1\nwire S1 L1\nEND", "draw a battery, a switch and a lamp");
  ok("a chain that stops at one part: wire L1 B1", sm && /the current stops at L1: add the wire from it back to B1, like: wire L1 B1$/.test(sm.problems[0]), sm && sm.problems);
  var two = act.build("MAKE SCHEMATIC: Two\npart B1 battery \x229 V\x22\npart J1 junction\npart L1 lamp\npart L2 lamp\nwire B1 J1\nwire J1 L1\nwire J1 L2\nEND", "draw a battery and two lamps");
  ok("two places it could go back from: the place is the model's to say (no line guessed)", two && /\(add the wire that returns to it\)$/.test(two.problems[0]), two && two.problems);

  // --- what Chat says when nothing was made ------------------------------------------------------------------
  var vs = act.view(m2), vd = act.view({ action: act.relevant("draw a house")[0], block: { title: "House" }, problems: ["40 lines are off the grid"], plan: null });
  ok("a circuit that could not be made does not say “fewer, bigger shapes or rows”; a drawing still says fewer, bigger shapes", !/shapes|rows/.test(vs.textContent) && /Ask again\.$/.test(vs.textContent) &&
    /Ask again — fewer, bigger shapes help\.$/.test(vd.textContent), [vs.textContent, vd.textContent]);

  // --- a reply's other blocks --------------------------------------------------------------------------------
  var QD = "Draw a circuit with a battery and a lamp, and make a table of its values";
  var BL = "MAKE SCHEMATIC: Lamp\nmode electrical\npart B1 battery \x229 V\x22\npart L1 lamp\nwire B1 L1\nwire L1 B1\nEND";
  var TB = "MAKE SHEET: Values\n| Part | Value |\n| Battery | 9 V |\n| Lamp | 0.5 A |\nEND";
  var mm = act.build(BL + "\n\n" + TB, "Draw a circuit with a battery and a lamp");
  var rr = act.rest(BL + "\n\nAnd the table:\n\n" + TB, "Draw a circuit with a battery and a lamp", mm);
  ok("rest(): a reply's second block is made (a table after a circuit)", rr.length === 1 && rr[0].block.kind === "SHEET" && rr[0].ok, rr.map(function (x) { return [x.block.kind, x.ok, x.problems]; }));
  var ex = act.prompt("draw a circuit with a battery and a lamp").split("\n"), exAt = ex.indexOf("For example:"), exBlock = exAt >= 0 ? ex.slice(exAt + 1).join("\n") : "";
  ok("rest(): the instructions' own example copied after the block is not made, nor the same block twice", exBlock && act.rest(BL + "\n\n" + exBlock, "draw a circuit with a battery and a lamp", mm).length === 0 &&
    act.rest(BL + "\n\n" + BL, "draw a circuit with a battery and a lamp", mm).length === 0, exBlock.slice(0, 200));

  // --- whole Chat turns -----------------------------------------------------------------------------------------
  async function chat(q, replies) { var sent = []; o.script = function (last) { sent.push(last); return replies[Math.min(sent.length - 1, replies.length - 1)]; }; var r = await C.turn([], q, {}, {}); return { r: r, sent: sent }; }
  var c1 = await chat(Q, [R1]);
  ok("Chat, Adam's question answered as the 35B did: the station made from its two blocks, nothing asked again", c1.sent.length === 1 && c1.r.made && c1.r.made.ok && c1.r.made.readAs === "STATION" && !(c1.r.more || []).length,
    [c1.sent.length, c1.r.made && c1.r.made.problems, (c1.r.more || []).length, c1.r.notes]);
  var c2 = await chat("Draw a circuit with a battery and a lamp", [BL + "\n\nHere are its values too:\n\n" + TB]);
  ok("Chat: a circuit and a table in one reply are both made and shown", c2.r.made && c2.r.made.block.kind === "SCHEMATIC" && (c2.r.more || []).length === 1 && c2.r.more[0].block.kind === "SHEET" && c2.sent.length === 1,
    [c2.r.made && c2.r.made.block.kind, (c2.r.more || []).map(function (m) { return m.block.kind; }), c2.sent.length]);
  var c2b = await chat(QD, [BL + "\n\n" + TB]);
  ok("...a question in parts keeps its own way (AI_PARTS): both made as its parts, none twice", (c2b.r.mades || []).map(function (m) { return m.block.kind; }).join(",") === "SCHEMATIC,SHEET" && !(c2b.r.more || []).length,
    [(c2b.r.mades || []).map(function (m) { return m.block.kind; }), (c2b.r.more || []).length]);
  var BAD = BL.replace("wire L1 B1\n", "");
  var c3 = await chat("Draw a circuit with a battery and a lamp", [BAD + "\n\n" + TB, BL]);
  ok("Chat: the first block sent back for its correction, the table written beside it is kept and shown after the corrected one", c3.sent.length === 2 && /wire L1 B1/.test(c3.sent[1]) && c3.r.made && c3.r.made.ok &&
    (c3.r.more || []).length === 1 && c3.r.more[0].block.kind === "SHEET", [c3.sent.length, c3.sent[1] && c3.sent[1].slice(0, 200), (c3.r.more || []).map(function (m) { return m.block.kind; })]);

  // --- the bench -----------------------------------------------------------------------------------------------
  var bq = L.aiBenchQuestions.filter(function (x) { return x.id === "make-liftstation-drawings"; })[0];
  var bo = bq ? await act.solve(bq.q, seq([bq.ideal])) : null;
  ok("the bench has Adam's question; its ideal passes", bq && bq.q === Q && bo && L.aiBench.grade(bq, bo.text, bo).pass, bq && bo && L.aiBench.grade(bq, bo.text, bo));
  var bo2 = bq ? await act.solve(bq.q, seq([R1])) : null;
  ok("...and so does the 35B's own reply, read as the station", bo2 && L.aiBench.grade(bq, bo2.text, bo2).pass, bo2 && L.aiBench.grade(bq, bo2.text, bo2));

  console.log(fails ? fails + " LIFT STATION 1.24.34 FAILURES (" + passes + " passed)" : "ALL LIFT STATION 1.24.34 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
