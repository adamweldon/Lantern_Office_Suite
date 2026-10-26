// bench_run9.js -- Lantern Bench run 9 (Qwen3.5-35B-A3B on 1.12.9, 98/109),
// replayed. Each miss Lantern could do something about, with the model's
// real reply from the run's JSON:
//  - the puzzle pairs (with the tools / without) labelled in the results;
//  - the bench row keeps each puzzle block the AI wrote;
//  - two-coin cups: "put silver in Red" -- a place the puzzle describes,
//    written as a name -- goes back once; the right block passes;
//  - the queue: "person directly behind holder of ball" runs, and a block
//    that fails twice no longer stands as the answer;
//  - refrigerator: a = line that retypes an earlier result, and an ANSWER
//    that spells a result its own way, are questioned; {ANS1} {ANS2} fill;
//  - READ: page 5 at the end of an explanation is read;
//  - 3 dozen eggs: the NEED is answered by Lantern;
//  - the trip's fuel has a recipe card;
//  - a house whose door and walls are painted over, a sun inside the sea,
//    a total drawn as a fourth resistor, and a procedure without numbered
//    steps go back once; every ideal reply in the bench still builds clean;
//  - the bench's MAKE path shows a seeing model its picture, as Chat does;
//  - the warranty grader accepts a labelled "From my own knowledge".
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
var vision = false, script = null, calls = [];
function resp(status, body, type) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf" }] }), "application/json");
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: vision } }), "application/json");
  var body = JSON.parse(opts.body);
  calls.push(body);
  var r = script ? script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }

// the run's own words
var CUPS_Q = "Five cups stand in a row, left to right: Red, Blue, Green, Yellow, White. A gold coin is under Green and a silver coin is under White. Coins move with their cups unless I say otherwise. 1. Blue and White swap places. 2. The cup holding the gold coin swaps with the cup two places to its left. 3. Every cup moves one place to the right, and the cup on the far right moves to the far left. 4. I take the silver coin out of its cup and put it under the cup directly to the left of the cup holding the gold coin. 5. The two end cups swap. 6. The middle cup swaps with the cup holding the silver coin. What is the final order, and which cup holds each coin?";
var CUPS_NAMED = "TRACK: Cups\nrow Red Blue Green Yellow White\nput gold in Green\nput silver in White\nswap Blue and White\nswap holder of gold and 2 left of holder of gold\nshift right 1\ntake silver from holder of silver\nput silver in Red\nswap first and last\nswap middle and holder of silver\nEND";
var CUPS_GOOD = CUPS_NAMED.replace("put silver in Red", "put silver in left of holder of gold");
var QUEUE_Q = "Five people stand in a queue, front to back: Ann, Ben, Cal, Dee, Eve. Ben holds a ball. 1. The person at the back moves to the front. 2. The person holding the ball swaps places with the person directly behind them. 3. Whoever holds the ball gives it to the person at the front. 4. The second and fourth people in the queue swap places. What is the order of the queue from front to back, and who holds the ball?";
var QUEUE_BLOCK = "TRACK: Queue\nrow Ann Ben Cal Dee Eve\nput ball in Ben\nmove last to first\nswap holder of ball and person directly behind holder of ball\ngive ball to holder of first\nswap second and fourth\nEND";
var LETTERS_Q = "Spell \x22refrigerator\x22 backwards, then remove every letter r. What is left, and how many letters is that?";
var LETTERS_TOOLS = "=REVERSE(\x22refrigerator\x22)\n=REMOVE(\x22rotarigerfer\x22,\x22r\x22)\n=LEN(\x22otagiferfer\x22)\nANSWER: The word \x22refrigerator\x22 spelled backwards is \x22rotarigerfer\x22. After removing every letter 'r', the remaining text is \x22otagiferfer\x22, which has 10 letters.";
var LETTERS_ALONE = "=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS,\x22r\x22)\n=LEN(ANS1)\nANSWER: The word \x22refrigerator\x22 spelled backwards is \x22rotaregirfer\x22. After removing every letter 'r', the remaining text is \x22otaeigef\x22, which has 8 letters.";
var LETTERS_FIXED = "=REVERSE(\x22refrigerator\x22)\n=REMOVE(ANS,\x22r\x22)\n=LEN(ANS)\nANSWER: Backwards it is {ANS1}; without the r's it is {ANS2}, which has {result} letters.";
var HOUSE = "MAKE DRAWING: Simple house with red roof and door\nrect 0 0 20 12 fill sky\nrect 4 6 12 6 fill white\nrect 8 6 4 6 fill brown\nrect 9 7 2 4 fill black\nrect 4 6 12 3 fill red\nrect 4 9 12 3 fill white\nEND";
var SUNSEA = "MAKE DRAWING: Yellow sun above blue sea\nrect 0 0 20 12 fill blue\ncircle 10 3 3 fill yellow\nEND";
var RTOTAL = "MAKE SCHEMATIC: Parallel Resistor Lesson\nmode electrical\npart V1 source \x2212 V\x22\npart R1 resistor \x224 ohm\x22\npart R2 resistor \x226 ohm\x22\npart R3 resistor \x2212 ohm\x22\npart R_total resistor \x22{=1/(1/4+1/6+1/12)} ohm\x22\nwire V1 R1\nwire V1 R2\nwire V1 R3\nwire V1 R_total\nwire R1 V1\nwire R2 V1\nwire R3 V1\nwire R_total V1\nnote Rt = 1 / (1/R1 + 1/R2 + 1/R3) = {=1/(1/4+1/6+1/12)} ohm\nEND";
var OIL = "MAKE DOC: Changing the Oil in a Lawn Mower Engine\n## Safety First\nPark the mower on a level surface and engage the parking brake.\nTurn off the engine and let it cool for at least 15 minutes.\nDisconnect the spark plug wire to prevent accidental starting.\n## Draining the Old Oil\nPlace the drain pan underneath the drain plug or the oil fill area.\nRemove the drain plug carefully and allow the oil to flow into the pan.\n## Refilling with New Oil\nReplace the drain plug and tighten it securely.\nUse the funnel to pour the recommended amount of new oil into the fill hole.\nInsert the dipstick to check the level.\nEND";

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(80);
  var L = w.Lantern, C = L.CHAT, A = L.assist, Q = L.aiBenchQuestions;
  await L.ai.detect();
  ok("boot clean", errs.length === 0, errs);
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }

  // --- the puzzle pairs, labelled -------------------------------------------
  var real = L.aiBench.run;
  L.aiBench.run = function (o) {
    [{ id: "cups-two-coins", cat: "reason", q: "Five cups ...", pass: false, why: "x", ms: 1000 }, { id: "cups-two-coins-alone", cat: "alone", q: "Five cups ...", pass: true, why: "", ms: 2000 }]
      .forEach(function (r, i) { o.onItem(i + 1, 2, r); });
    return new Promise(function () {});
  };
  w.location.hash = "ai"; fire(w, "hashchange"); await sleep(20);
  var run = Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return /^(Full run|Run all|Run the full)/i.test(b.textContent); })[0] ||
    Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return /^Quick run/.test(b.textContent); })[0];
  if (run) run.click();
  await sleep(20);
  var rowsText = Array.prototype.map.call(d.querySelectorAll(".la-tbl tbody tr"), function (tr) { return tr.textContent; });
  ok("results say which puzzle row had the tools and which was without them (not scored)", rowsText.length === 2 && /with Lantern’s puzzle tools/.test(rowsText[0]) &&
    /switched off — not scored/.test(rowsText[1]), rowsText);
  L.aiBench.run = real;
  w.location.hash = ""; fire(w, "hashchange");

  // --- two-coin cups: a described place written as a name -------------------
  var PZ = L.aiPuzzle;
  var named = PZ.run(CUPS_NAMED, CUPS_Q), good = PZ.run(CUPS_GOOD, CUPS_Q);
  ok("cups: “put silver in Red” is questioned (the steps never name Red)", named && !named.ok && /names Red/.test(named.problems.join(" ")), named && named.problems);
  ok("cups: the block written the way the steps say it passes, with the right answer", good && good.ok && good.row.join(",") === "Yellow,Green,Blue,Red,White" &&
    good.held.silver === "Blue" && good.held.gold === "Green", good && (good.problems || good.row));
  ok("cups: the set-up lines and steps that name their cups are not questioned", PZ.run("TRACK: c\nrow Red Blue Green Yellow White\nput gold in Green\nswap Blue and White\nEND", CUPS_Q).ok);
  ok("without the question (tests, the Track tool) nothing changes", PZ.run(CUPS_NAMED).ok);
  // in Chat: corrected once, then answered from Lantern's results
  var turn = 0;
  script = function (last) {
    turn++;
    if (/^PUZZLE RESULTS/.test(last)) return "ANSWER: The final order is Yellow, Green, Blue, Red, White; gold is under Green and silver under Blue.";
    if (/Lantern ran your TRACK block/.test(last)) return CUPS_GOOD;
    return CUPS_NAMED;
  };
  var conv = await C.converse([CUPS_Q], {});
  var t0 = conv.turns[0];
  ok("cups in Chat: questioned, corrected, answered right", t0.puzzles.length === 2 && !t0.puzzles[0].ok && t0.puzzles[1].ok && /Blue, Red, White/.test(t0.final), t0.puzzles);
  ok("each block the AI wrote is kept with its lines", t0.puzzles[0].lines && t0.puzzles[0].lines.indexOf("put silver in Red") >= 0);
  ok("the bench grades it a pass", L.aiBench.grade(item("cups-two-coins"), t0.final, { turns: conv.turns }).pass, L.aiBench.grade(item("cups-two-coins"), t0.final, { turns: conv.turns }));

  // --- the queue: directly behind; two failed blocks are not the answer ------
  var qr = L.aiTrack.run({ lines: QUEUE_BLOCK.split("\n").slice(1, -1) });
  ok("queue: the run's own block now runs: Eve, Ben, Cal, Ann, Dee, the ball with Eve", !qr.problems.length && qr.row.join(",") === "Eve,Ben,Cal,Ann,Dee" && qr.held.ball === "Eve", qr.problems.length ? qr.problems : qr.row);
  var tq = L.aiTrack.run({ lines: ["row Ann Ben Cal", "put key in Ann", "swap Ann and person in front of Cal", "swap Cal and the one ahead of Ann"] });
  ok("in front of / ahead of count toward the front", !tq.problems.length && tq.row.join(",") === "Ben,Cal,Ann", tq.problems.length ? tq.problems : tq.row);
  script = function (last) {
    if (/Work the puzzle out yourself/.test(last)) return "Step by step ... ANSWER: Eve, Ben, Cal, Ann, Dee; Eve holds the ball.";
    return "TRACK: Queue\nrow Ann Ben Cal Dee Eve\nfrobnicate the queue\nEND";
  };
  conv = await C.converse([QUEUE_Q], {});
  t0 = conv.turns[0];
  ok("a block that fails twice: the AI is asked to work it out itself, and its answer stands", t0.puzzles.length === 2 && /ANSWER: Eve, Ben/.test(t0.final) && !/^TRACK/.test(t0.final), t0.final);

  // --- refrigerator: retyped results, an answer in its own spelling -----------
  var RC = L.aiResultChecks;
  function why(reply) { var p = A.parseReply(reply), r = A.run(p.exprText); return RC.check(LETTERS_Q, p.exprText, r, { parsed: p, text: reply }) || ""; }
  ok("letters (tools on): line 2 retypes line 1's result with mistakes", /line 2 types “rotarigerfer”, but line 1 gave “rotaregirfer”: write ANS1/.test(why(LETTERS_TOOLS)), why(LETTERS_TOOLS));
  ok("letters (tools off): the ANSWER's own spelling and count are questioned", /spells “otaeigef”, but Lantern worked out “otaegife”/.test(why(LETTERS_ALONE)) && /says 8/.test(why(LETTERS_ALONE)), why(LETTERS_ALONE));
  ok("a reply with ANS and {ANS1} {ANS2} {result} is not questioned, and fills in", why(LETTERS_FIXED) === "" &&
    A.finalAnswer(A.parseReply(LETTERS_FIXED).answer, 8, A.run(A.parseReply(LETTERS_FIXED).exprText).steps).text === "Backwards it is rotaregirfer; without the r's it is otaegife, which has 8 letters.");
  ok("a right answer stated without {result} is left alone", why("=12*5\nANSWER: It uses 60 W.") === "" && why("=REVERSE(\x22stressed\x22)\nANSWER: Backwards, stressed is desserts.") === "");
  script = function (last) { return /Lantern questioned that/.test(last) ? LETTERS_FIXED : LETTERS_TOOLS; };
  conv = await C.converse([LETTERS_Q], {});
  var g = L.aiBench.grade(item("letters-refrigerator"), conv.turns[0].final, { turns: conv.turns });
  ok("letters in Chat: questioned once, then right -- the bench passes it", g.pass, [g.why, conv.turns[0].answerText]);
  ok("the AI is told about {ANS1} {ANS2}", /\x7BANS1\x7D, \x7BANS2\x7D/.test(C.buildSystem("x")));

  // --- READ at the end of an explanation --------------------------------------
  var TR = L.textReader;
  TR.attached = { kind: "doc", title: "PX-2200 compressor manual", pages: [{ n: 1, done: true }], per: 10 };
  ok("READ: page 5 after an explanation is read", TR.readCommand.test("The provided passages (pages 1–3) mention the table of contents includes a \x22Warranty and service\x22 section on page 5, but the content of that section is not included in the current reading. Therefore, I need to read page 5 to find the guarantee duration.\n\nREAD: page 5") === "page 5");
  TR.attached = null;
  ok("LESSON, MODULES and EXAMPLE lines at the end of a reply count too", L.chatCommands.filter(function (c) { return c.verb === "LESSON"; }).every(function (c) { return c.test(new Array(70).join("words ") + "\nLESSON: goats") === "goats"; }) &&
    L.chatCommands.filter(function (c) { return c.verb === "EXAMPLE"; }).every(function (c) { return c.test(new Array(70).join("words ") + "\nEXAMPLE: blink") === "blink"; }));

  // --- 3 dozen eggs: Lantern answers the NEED -----------------------------------
  var NA = L.aiNeedAnswer;
  ok("NEEDs Lantern knows: 3 dozen, a gross, metres in a mile", NA("How many eggs are in 3 dozen?", "") === "Lantern: a dozen is 12, so 3 dozen is 36." &&
    /144/.test(NA("How many is a gross?", "")) && /1,?609\.344/.test(NA("How many metres are in a mile?", "") || ""), [NA("How many eggs are in 3 dozen?", ""), NA("How many metres are in a mile?", "")]);
  ok("NEEDs only the person knows are left alone", NA("How many goats do you have?", "") === null && NA("How many pairs of shoes do you own?", "") === null &&
    NA("How many amp-hours does the battery hold, and what is its voltage?", "") === null);
  var eggs = item("egg-dozens"), seen = [];
  var res = await A.solve(eggs.q, { call: function (m) { seen.push(textOf(m[m.length - 1].content)); return Promise.resolve(seen.length === 1 ? "NEED: How many eggs are in 3 dozen?" : "=12*36\nANSWER: 3 dozen eggs cost {result} shillings."); } });
  g = L.aiBench.grade(eggs, res.text, res);
  ok("egg-dozens in Assist: Lantern answers the NEED, the AI computes 432", g.pass && /3 dozen is 36/.test(seen[1] || ""), [g.why, seen]);
  script = function (last) { return /Lantern: a dozen is 12/.test(last) ? "=12*36\nANSWER: They cost {result} shillings." : "NEED: How many eggs are in 3 dozen?"; };
  conv = await C.converse([eggs.q], {});
  ok("...and in Chat", conv.turns[0].value === 432 && /dozen is 12/.test(conv.turns[0].needAnswered || ""), conv.turns[0]);

  // --- the trip's fuel -----------------------------------------------------------
  var fuel = A.match("A car goes 150 km on 10 litres of fuel. How many litres does a 420 km trip need?").filter(function (c) { return c.id === "trip-fuel"; })[0];
  ok("car-fuel: a recipe card matches and works it out (28 L)", fuel && A.run(fuel.compose.replace("{trip_km}", 420).replace("{litres}", 10).replace("{km}", 150)).value === 28);

  // --- things the AI makes -------------------------------------------------------
  var act = L.aiAct;
  var h = act.build(HOUSE, item("make-house").q);
  ok("house: the walls, door and window painted over are questioned", !h.ok && h.problems.filter(function (p) { return /hidden under shapes drawn after it/.test(p); }).length === 3, h.problems);
  var ss = act.build(SUNSEA, item("make-sun-sea").q);
  ok("sun and sea: a sea that fills the picture is questioned", !ss.ok && /puts the yellow sun above the blue sea/.test(ss.problems.join(" ")), ss.problems);
  var rt = act.build(RTOTAL, item("make-parallel-ohm").q);
  ok("parallel resistors: the total drawn as a part is questioned", !rt.ok && /R_TOTAL is the circuit’s total, not a part/.test(rt.problems.join(" ")), rt.problems);
  var oil = act.build(OIL, item("make-doc-oil-change").q);
  ok("procedure: steps as plain lines are questioned", !oil.ok && /numbered list/.test(oil.problems.join(" ")), oil.problems);
  var ideals = Q.filter(function (x) { return x.cat === "make" && x.ideal; }), bad = [];
  ideals.forEach(function (x) { var m = act.build(x.ideal, x.q); if (!m || !m.ok) bad.push(x.id + ": " + (m ? m.problems.join("; ") : "no block")); });
  ok("every ideal reply in the bench still builds without a problem (" + ideals.length + ")", !bad.length && ideals.length >= 10, bad);
  ok("the drawing instructions say what covers what, and where things above and below go", /Shapes drawn later cover earlier ones/.test(act.prompt("Draw a house")) && /a roof is a tri/.test(act.prompt("Draw a house")));
  // the bench's MAKE path: a model that sees is shown its picture, as in Chat
  var drawAct = L.aiActions.filter(function (a) { return a.id === "drawing"; })[0], b0 = drawAct.build, canSee = L.ai.canSee;
  drawAct.build = function (bl, ctx) { var r = b0.call(drawAct, bl, ctx); r.png = function () { return "data:image/png;base64,AAAA"; }; return r; };
  L.ai.canSee = function () { return true; };
  var looks = 0, sent = [];
  var out = await act.solve(item("make-sun-sea").q, function (m) { sent.push(m[m.length - 1]); looks++; return Promise.resolve(looks === 1 ? item("make-sun-sea").ideal : "LOOKS RIGHT: a yellow sun over a blue sea."); });
  ok("bench MAKE path: a seeing model is shown its picture once and may keep it", out.looked && !out.changedOnLook && Array.isArray(sent[1].content) && sent[1].content[1].type === "image_url" && out.made.ok);
  looks = 0;
  out = await act.solve(item("make-house").q, function () { looks++; return Promise.resolve(looks === 1 ? "MAKE DRAWING: House\nrect 5 6 10 5 fill tan\nrect 9 8 2 3 fill brown\nEND" : item("make-house").ideal); });
  ok("...or send a corrected block, which is kept", out.looked && out.changedOnLook && L.aiBench.grade(item("make-house"), out.text, out).pass, [out.text, out.made && out.made.problems]);
  drawAct.build = b0; L.ai.canSee = canSee;

  // --- the warranty grader -----------------------------------------------------------
  var wq = item("doc-not-covered");
  function wGrade(text, declined) { return wq.check([{ final: text, declined: !!declined, searches: [{ query: "", how: "document" }] }]); }
  ok("warranty: “Not in the document. From my own knowledge: ... 1 to 5 years ...” passes", wGrade("ANSWER: Not in the document. From my own knowledge: Compressor warranties typically range from 1 to 5 years depending on the manufacturer and model, but the specific warranty period for the PX-2200 is not provided in the available manual excerpts.") === "");
  ok("...a warranty for this compressor, from the AI's own knowledge, fails", /this compressor/.test(wGrade("Not in the document. From my own knowledge: the PX-2200 comes with a 2 year warranty.")) &&
    /does not state/.test(wGrade("The warranty is 3 years.")));

  // --- the bench row keeps the blocks --------------------------------------------------
  script = function (last) { return /^PUZZLE RESULTS/.test(last) ? "ANSWER: done" : "TRACK: t\nrow A B C\nswap A and C\nEND"; };
  var rep = await L.aiBench.run({ quick: false, skip: ["tool", "multi", "need", "unknown", "safety", "fact", "make", "chat", "alone", "code"] });
  var withBlocks = rep.rows.filter(function (r) { return r.chat && r.chat[0].blocks && r.chat[0].blocks[0].lines; });
  ok("bench rows keep each puzzle block's lines", withBlocks.length >= 1 && withBlocks[0].chat[0].blocks[0].lines.indexOf("swap A and C") >= 0, rep.rows.slice(0, 2));

  ok("no errors", errs.length === 0, errs);
  console.log(fails ? fails + " BENCH RUN 9 FAILURES (" + passes + " passed)" : "ALL BENCH RUN 9 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
