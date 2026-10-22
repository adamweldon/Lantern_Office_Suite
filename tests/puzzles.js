// puzzles.js -- Lantern's puzzle bookkeeping (AI_PUZZLE, AI_PUZZLE_TRACK,
// AI_PUZZLE_TURN, AI_PUZZLE_SOLVE), the text functions (TEXT_FUNCS), Chat
// handing a puzzle to Lantern (block -> results -> answer, one correction,
// PUZZLE TOOLS on request, tools off for the bench's "alone" runs), and the
// reasoning bench (AI_PUZZLE_BENCH_DATA) -- graded against a perfect model
// and against the real answers a 35B model gave without the tools
// (fixtures/puzzles_35b_alone.json, from a 1.9.8 Chat). Scripted model.
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
var modelReplies = [], modelCalls = [];
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new TypeError("no library"));
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf" }] }));
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }));
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var r = modelReplies.length ? modelReplies.shift() : "ANSWER: ok";
  if (typeof r === "function") r = r(body);
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }));
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function lastUser(body) { var m = body.messages[body.messages.length - 1]; return typeof m.content === "string" ? m.content : ""; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, PZ = L.aiPuzzle, F = L.formula;
  ok("boot clean", errs.length === 0, errs);
  ok("three solvers registered", L.aiSolvers.map(function (s) { return s.kind; }).join() === "TRACK,TURN,SOLVE");
  function ev(x) { return F.evaluate(x, { deg: false, ans: 0 }); }
  function run(t) { return PZ.run(t); }

  // --- letters, exactly (TEXT_FUNCS) ---
  ok("REVERSE, REMOVE, LEN: the refrigerator puzzle", ev("REMOVE(REVERSE(\"refrigerator\"),\"r\")") === "otaegife" && ev("LEN(REMOVE(REVERSE(\"refrigerator\"),\"r\"))") === 8);
  ok("letter sets ignore case; SUBSTITUTE and FIND are exact", ev("REMOVE(\"Oklahoma\",\"aeiou\")") === "klhm" && ev("COUNTCHARS(\"Mississippi\",\"S\")") === 4 &&
    ev("SUBSTITUTE(\"banana\",\"an\",\"o\")") === "booa" && ev("FIND(\"ss\",\"Mississippi\")") === 3 && ev("MID(\"lantern\",3,4)") === "ntern".slice(0, 4) &&
    ev("LEFT(\"lantern\",3)") === "lan" && ev("RIGHT(\"lantern\",4)") === "tern" && ev("UPPER(\"abc\")") === "ABC" && ev("WORDS(\" a bb  ccc \")") === 3 &&
    ev("SORTLETTERS(\"Listen\")") === ev("SORTLETTERS(\"Silent\")"));
  var tr = L.assist.run("=REMOVE(REVERSE(\"refrigerator\"),\"r\")\n=LEN(ANS)");
  ok("a text result flows through = lines and into the answer", tr.steps[0].value === "otaegife" && tr.value === 8 &&
    L.assist.finalAnswer("Left: {result}", "otaegife").text === "Left: otaegife" && /“otaegife”/.test(L.CHAT.toolText(tr)));
  ok("text functions are in the AI's function list", /REVERSE\(/.test(L.assist.toolCard()) && /REMOVE\(/.test(L.assist.toolCard()));

  // --- TRACK ---
  var two = run("TRACK: Two coins\nrow Red Blue Green Yellow White\nput gold in Green\nput silver in White\nswap Blue and White\n" +
    "swap the cup holding the gold coin with the cup two places to its left\nshift right 1\nput silver under the cup directly left of the cup holding gold\n" +
    "swap first and last\nswap middle and holder of silver\nEND");
  ok("TRACK: the two-coin shuffle, written the way the question says it", two.ok && two.row.join() === "Yellow,Green,Blue,Red,White" &&
    two.held.gold === "Green" && two.held.silver === "Blue" && /silver is with Blue \(position 3\)/.test(two.final) && two.steps.length === 9, two.problems || two.final);
  var four = run("TRACK: Cups\nrow Red Blue Green Yellow\nput coin in Blue\nswap Red and Green\nswap far left and far right\nswap holder of coin and right of holder of coin\nEND");
  ok("TRACK: the four-cup puzzle (the one Gemini's key got wrong)", four.ok && four.row.join() === "Yellow,Red,Blue,Green" && four.held.coin === "Blue", four.problems);
  var q = run("TRACK: Queue\nrow Ann Ben Cal Dee Eve\nput ball with Ben\nmove last to first\nswap holder of ball and right of holder of ball\ngive ball to first\nswap position 2 and position 4\nEND");
  ok("TRACK: a queue, a ball handed on, a move to the front", q.ok && q.row.join() === "Eve,Ben,Cal,Ann,Dee" && q.held.ball === "Eve", q.problems || q.final);
  var more = run("TRACK: t\nrow \"Mrs Smith\" Bo Cy Di\nput key with Bo\nput pen with Cy\nswap key and pen\nswap contents of Bo and Di\nreverse\nshift left 1\nadd Ed after Cy\nremove Di\nmove \"Mrs Smith\" to position 2\nEND");
  ok("TRACK: quoted names, held things swapping, contents, reverse, shift, add, remove, move", more.ok &&
    more.row.join() === "Cy,Mrs Smith,Ed,Bo" && more.held.key === "Cy" && more.held.pen === undefined, more.problems || [more.row, more.held]);
  // 1.12.3: the same puzzle as a 35B wrote it in Adam's Chat -- "take silver
  // from ...", "holder of middle" -- and as the question words it
  var t35 = run("TRACK: Coin Puzzle\nrow Red Blue Green Yellow White\nput gold in Green\nput silver in White\nswap Blue and White\n" +
    "swap holder of gold and left of left of holder of gold\nshift right 1\ntake silver from holder of silver\nput silver in left of holder of gold\n" +
    "swap first and last\nswap holder of middle and holder of silver\nEND");
  ok("TRACK: take silver from its cup, put it under another; holder of middle is the middle", t35.ok && t35.row.join() === "Yellow,Green,Blue,Red,White" &&
    t35.held.gold === "Green" && t35.held.silver === "Blue", t35.problems || t35.final);
  var said = run("TRACK: Two coins\nrow Red Blue Green Yellow White\nput gold in Green\nput silver in White\nBlue and White swap\n" +
    "swap holder of gold and 2 left of holder of gold\nshift right 1\ntake silver out of White\nput silver under left of holder of gold\n" +
    "the two end cups swap\nswap middle and holder of silver\nEND");
  ok("TRACK: \u201cthe two end cups swap\u201d and \u201ctake silver out of White\u201d", said.ok && said.row.join() === "Yellow,Green,Blue,Red,White" && said.held.silver === "Blue", said.problems || said.final);
  function tprobs(lines) { var r = run("TRACK: t\n" + lines.join("\n") + "\nEND"); return r.problems.join(" | "); }
  ok("TRACK: taking a coin from the wrong cup is caught", /silver is with Blue, not White/.test(tprobs(["row Red Blue White", "put silver in Blue", "take silver from White"])));
  ok("TRACK: the AI is told to write places, not the names it thinks are there", /never the name you think is there/.test(L.aiSolvers[0].prompt.join("\n")) && /take silver from White/.test(L.aiSolvers[0].prompt.join("\n")));
  ok("TRACK says what is wrong", /Purple is not in the row \(Red, Blue\)/.test(tprobs(["row Red Blue", "swap Red and Purple"])) &&
    /3 left of Blue is off the row \(Blue is at position 2 of 2\)/.test(tprobs(["row Red Blue", "swap Red and 3 left of Blue"])) &&
    /nothing called gold is held/.test(tprobs(["row Red Blue", "swap Red and holder of gold"])) &&
    /start with: row/.test(tprobs(["swap Red and Blue"])) && /has no single middle/.test(tprobs(["row A B C D", "swap middle and A"])) &&
    /Lantern reads row, put, swap/.test(tprobs(["row A B", "juggle A"])));
  ok("TRACK stops at the first problem and shows the steps before it", (function () {
    var r = run("TRACK: t\nrow A B C\nswap A and B\nswap A and Q\nswap B and C\nEND"); return !r.ok && r.steps.length === 2 && r.problems.length === 1; })());

  // --- TURN ---
  var die = run("TURN: Die\ncube top 1 front 2 right 3\ntip away\ntip right\nturn clockwise\ntip toward\nEND");
  ok("TURN: the die after four moves is 5 on top, 4 facing, 1 right", die.ok && die.faces.top === "5" && die.faces.front === "4" && die.faces.right === "1" &&
    /^Now: top 5, facing me \(front\) 4, right 1/.test(die.final), die.problems || die.final);
  ok("TURN: the 35B's three slips cannot happen -- each move is checked against its definition", (function () {
    var M = L.aiTurn.MOVES, c = { top: 1, bottom: 6, front: 2, back: 5, left: 4, right: 3 };
    function apply(m, x) { var o = {}; Object.keys(M[m]).forEach(function (f) { o[f] = x[M[m][f]]; }); return o; }
    var a = apply("away", c), cw = apply("cw", c);
    return a.back === 1 && a.top === 2 && cw.left === 2 && cw.front === 3 && apply("toward", apply("away", c)).top === 1 && apply("ccw", cw).front === 2;
  })());
  var box = run("TURN: Box\ncube top red bottom orange front white back yellow left green right blue\ntip left 2 times\nturn around\nEND");
  ok("TURN: any labels, repeats and a half turn", box.ok && box.faces.top === "orange" && box.faces.front === "yellow" && box.faces.right === "blue", box.problems || box.faces);
  ok("TURN says what is missing or impossible", /for labels other than a 1-6 die, give all six/.test(run("TURN: t\ncube top red front blue right green\nEND").problems.join()) &&
    /opposite faces add to 7/.test(run("TURN: t\ncube top 1 bottom 2 front 3 back 4 left 5 right 6\nEND").problems.join()) &&
    /Lantern reads tip away/.test(run("TURN: t\ncube top 1 front 2 right 3\nwobble it\nEND").problems.join()));
  var walk = run("TURN: Robot\nwalker at 0 0 facing north\nforward 3\nturn right\nforward 2\nturn right\nforward 5\nturn left\nback 1\nEND");
  ok("TURN: a walker -- position, facing, distance", walk.ok && walk.pos.x === 1 && walk.pos.y === -2 && walk.pos.facing === "east" && /2\.236068 in a straight line/.test(walk.final), walk.problems || walk.final);
  ok("TURN: go north and face east", (function () { var r = run("TURN: w\nwalker at 2 2 facing south\ngo north 3\nface east\nforward 1\nEND"); return r.ok && r.pos.x === 3 && r.pos.y === 5 && r.pos.facing === "east"; })());

  // --- SOLVE ---
  var houses = run("SOLVE: Houses\nperson Ana Ben Cara Dev\nhouse 1 2 3 4\njob pilot nurse chef teacher\npet cat dog fish bird\nrule pilot directly left of cat\nrule Ana in 1, 4\n" +
    "rule Ben != chef and Ben != dog\nrule nurse right of Dev\nrule Cara = fish and not Cara next to Ana\nrule teacher = bird\nrule chef = 3\nEND");
  ok("SOLVE: the four houses -- exactly one arrangement", houses.ok && houses.solutions === 1 && /house 1: Ben -- job teacher, pet bird/.test(houses.final) &&
    /house 4: Ana -- job nurse, pet dog/.test(houses.final), houses.problems || houses.final);
  var plain = run("SOLVE: Houses in words\nperson Ana Ben Cara Dev\nhouse 1 2 3 4\njob pilot nurse chef teacher\npet cat dog fish bird\nThe pilot lives directly to the left of the person with the cat\n" +
    "Ana = 1 or 4\nBen is not the chef\nBen does not own the dog\nThe nurse lives somewhere to the right of Dev\nCara owns the fish\nCara is not next to Ana\nThe teacher owns the bird\nThe chef lives in house 3\nEND");
  ok("SOLVE: the same clues in plain words", plain.ok && plain.solutions === 1 && /house 2: Cara -- job pilot, pet fish/.test(plain.final), plain.problems);
  var kn = run("SOLVE: Knights\nperson A B C\nkind knight liar (repeat)\nrule A = knight iff B = liar\nrule B = knight iff (A = knight and C = knight)\nrule C = knight iff B = knight\nEND");
  ok("SOLVE: knights and liars (repeating values; A is a name, not an article)", kn.ok && /A -- kind knight\nB -- kind liar\nC -- kind liar/.test(kn.final), kn.problems || kn.final);
  var race = run("SOLVE: Race\nrunner Ana Ben Cy Di Ed\nplace 1 2 3 4 5\nrule Ben before Ana\nrule Cy directly after Ana\nrule Di before Ben\nrule Ed before Di\nEND");
  ok("SOLVE: an order with before, after, directly after", race.ok && /place 1: Ed\nplace 2: Di\nplace 3: Ben\nplace 4: Ana\nplace 5: Cy/.test(race.final), race.problems || race.final);
  var gap = run("SOLVE: Race\nrunner Ana Ben Cy Di Ed\nplace 1 2 3 4 5\nrule Ben before Ana\nrule Cy directly after Ana\nrule Di before Ben\nEND");
  ok("SOLVE: a clue left out -- how many fit, and where they differ", !gap.ok && /^4 arrangements fit all the clues; they differ in Ana’s place \(3 or 4\)/.test(gap.problems[0]) &&
    /Check that every clue of the question is written/.test(gap.problems[0]) && /The first 3:/.test(gap.text), gap.problems);
  var bad = run("SOLVE: t\nperson Ana Ben Cara Dev\nhouse 1 2 3 4\npet cat dog fish bird\nrule Ana = cat\nrule Ana = dog\nrule Ben = 1\nEND");
  ok("SOLVE: clues that contradict -- which one to look at", !bad.ok && /^no arrangement fits all 3 clues: without clue 1 \(“Ana = cat”\) 10 or more fit; without clue 2/.test(bad.problems[0]), bad.problems);
  function sprobs(lines) { return run("SOLVE: t\n" + lines.join("\n") + "\nEND").problems.join(" | "); }
  ok("SOLVE says what is wrong", /Zed is not a name in the puzzle/.test(sprobs(["person Ana Ben", "pet cat dog", "rule Zed = cat"])) &&
    /pet has 3 values but there are 2 person/.test(sprobs(["person Ana Ben", "pet cat dog fish", "rule Ana = cat"])) &&
    /need an order: mark a category \(order\)/.test(sprobs(["person Ana Ben", "pet cat dog", "rule Ana next to Ben"])) &&
    /there are no rules/.test(sprobs(["person Ana Ben", "pet cat dog"])) &&
    /is a value of floor and room: write floor:2/.test(sprobs(["person Ana Ben", "floor 1 2", "room 2 3", "rule Ana = 2"])));
  ok("SOLVE: an order that is not numbers, and if-then", (function () {
    var r = run("SOLVE: Seats\nperson Ana Ben Cy\nseat left middle right (order)\nrule if Ana = left then Ben = right\nrule Cy = middle\nrule Ana left of Ben\nEND");
    return r.ok && /seat left: Ana\nseat middle: Cy\nseat right: Ben/.test(r.final);
  })());
  var t0 = Date.now(), zebra = run("SOLVE: Einstein's puzzle\nperson Brit Swede Dane Norwegian German\nhouse 1 2 3 4 5\ncolor red green white yellow blue\n" +
    "drink tea coffee milk beer water\nsmoke PallMall Dunhill Blends BlueMaster Prince\npet dogs birds cats horses fish\n" +
    "rule Brit = red\nrule Swede = dogs\nrule Dane = tea\nrule green directly left of white\nrule green = coffee\nrule PallMall = birds\nrule yellow = Dunhill\n" +
    "rule milk = 3\nrule Norwegian = 1\nrule Blends next to cats\nrule horses next to Dunhill\nrule BlueMaster = beer\nrule German = Prince\n" +
    "rule Norwegian next to blue\nrule Blends next to water\nEND"), zt = Date.now() - t0;
  ok("SOLVE: Einstein's five-house puzzle -- one answer (the German has the fish), quickly", zebra.ok && /house 4: German -- color green, drink coffee, smoke Prince, pet fish/.test(zebra.final) &&
    zt < 5000, { ms: zt, p: zebra.problems, f: zebra.final });

  // --- the block contract and the prompt ---
  ok("find: TRACK/TURN/SOLVE blocks, code fences and list marks ignored", PZ.find("Sure.\n```\nTRACK: x\n- row A B\n1. swap A and B\nEND\n```").length === 1 &&
    PZ.find("TRACK: x\n- row A B\n1. swap A and B\nEND")[0].lines.join("|") === "row A B|swap A and B");
  var sys1 = L.CHAT.buildSystem("Three cups stand in a row; the red cup and the blue cup swap. Where is the coin?"), sys2 = L.CHAT.buildSystem("What is 12 times 7?");
  ok("Chat: a puzzle question gets the tools' syntax; any other gets one line offering them", /TRACK: <title>/.test(sys1) && /Do not work the puzzle out yourself/.test(sys1) &&
    !/TRACK: <title>/.test(sys2) && /reply PUZZLE TOOLS and it sends you the tools/.test(sys2));
  ok("each bench puzzle is offered the right tool; everyday questions are offered none", (function () {
    var want = { "cups-four": "TRACK", "cups-two-coins": "TRACK", "die-four-moves": "TURN", "houses-four": "SOLVE", "doors-host-guesses": "", "letters-refrigerator": "",
      "queue-ball": "TRACK", "robot-walk": "TURN", "knights-three": "SOLVE", "race-order": "SOLVE" }, bad = [];
    L.aiBenchQuestions.filter(function (x) { return x.cat === "reason"; }).forEach(function (x) {
      var got = PZ.relevant(x.q).map(function (z) { return z.kind; }).join(); if (got !== want[x.id]) bad.push(x.id + ": " + got); });
    ["Who has the largest population in Africa?", "How much flour is 2 cups?", "How many people die of malaria each year?", "Explain how large language models work.",
      "What gives the sky its colour?", "Convert 26 miles to kilometres."].forEach(function (q2) { if (PZ.relevant(q2).length) bad.push(q2); });
    return !bad.length || console.log(bad);
  })());
  ok("each solver's prompt example runs as written", L.aiSolvers.every(function (s) {
    var ex = s.prompt.join("\n"), i = ex.lastIndexOf(s.kind + ": "); if (i < 0) return true;
    var r = PZ.run(ex.slice(i)); return r && r.ok;
  }));

  // --- Chat: the block runs, the results go back, the answer is shown ---
  await L.ai.detect();
  go("chat"); await sleep(40);
  function chatAsk(text) { var cin = d.querySelector("input[aria-label=\"Message\"]"); cin.value = text; modelCalls = []; btn(d, "Send").click(); }
  function logText() { return d.querySelector("[aria-label=\"Conversation\"]").textContent; }
  var B = L.aiBenchQuestions.filter(function (x) { return x.cat === "reason"; }), item = B.filter(function (x) { return x.id === "cups-two-coins"; })[0];
  modelReplies = [item.ideal, function (body) { return /^PUZZLE RESULTS/.test(lastUser(body)) && /silver is with Blue/.test(lastUser(body)) ? item.idealAnswer : "?"; }];
  var before = logText().length;
  chatAsk(item.q); await sleep(300);
  var t = logText().slice(before);
  ok("Chat: the AI's TRACK block is run, its steps shown, the results sent back, the answer shown", modelCalls.length === 2 && /Lantern ran the TRACK block: Two coins — 9 steps/.test(t) &&
    /silver is with Blue \(position 3\)/.test(t) && /the silver coin is under Blue/.test(t) && !/Lantern computed nothing/.test(t), { calls: modelCalls.length, t: t.slice(-700) });
  modelReplies = ["TRACK: Cups\nrow Red Blue Green\nput coin in Blue\nswap Red and Purple\nEND",
    function (body) { return /Lantern ran your TRACK block: “swap Red and Purple”: Purple is not in the row/.test(lastUser(body)) ? "TRACK: Cups\nrow Red Blue Green\nput coin in Blue\nswap Red and Green\nEND" : "?"; },
    function (body) { return /^PUZZLE RESULTS/.test(lastUser(body)) ? "ANSWER: The order is Green, Blue, Red and the coin is under Blue." : "?"; }];
  before = logText().length;
  chatAsk("Three cups stand in a row: Red, Blue, Green. A coin is under Blue. Red and Green swap. What is the order?"); await sleep(300);
  t = logText().slice(before);
  ok("Chat: a block Lantern cannot finish goes back once with the reason, and the fix runs", modelCalls.length === 3 && /Lantern could not finish the TRACK block/.test(t) &&
    /Lantern ran the TRACK block: Cups/.test(t) && /Green, Blue, Red/.test(t), { calls: modelCalls.length, t: t.slice(-600) });
  modelReplies = ["PUZZLE TOOLS", function (body) { return /Lantern tracks and solves puzzles exactly/.test(lastUser(body)) && /SOLVE: <title>/.test(lastUser(body)) && /QUESTION: Who sits where/.test(lastUser(body)) ?
      "SOLVE: Seats\nperson Ana Ben\nseat 1 2\nrule Ana = 2\nEND" : "?"; }, "ANSWER: Ben sits in seat 1 and Ana in seat 2."];
  before = logText().length;
  chatAsk("Who sits where, if Ana does not sit first?"); await sleep(300);
  t = logText().slice(before);
  ok("Chat: the AI can ask for the tools when Lantern did not see a puzzle", modelCalls.length === 3 && /asked for Lantern’s puzzle tools/.test(t) && /Lantern ran the SOLVE block: Seats/.test(t) && /Ben sits in seat 1/.test(t), t.slice(-500));

  // --- the bench: with the tools (a perfect model) and without (the 35B's real answers) ---
  ok("bench: 10 puzzles with the tools, 6 of them also without, 2 quick", B.length === 10 && L.aiBenchQuestions.filter(function (x) { return x.cat === "alone"; }).length === 6 &&
    B.filter(function (x) { return x.quick; }).length === 2);
  var allPass = true, why = [];
  for (var i = 0; i < B.length; i++) {
    var it = B[i];
    modelReplies = [it.ideal, function (body) { var u = lastUser(body); return /^(PUZZLE|TOOL) RESULTS/.test(u) ? (B[i].idealAnswer || "ANSWER: ?") : "?"; }];
    if (!it.idealAnswer) modelReplies = [it.ideal];
    var res = await L.CHAT.converse([it.q], {});
    var g = L.aiBench.grade(it, res.text, res);
    if (!g.pass) { allPass = false; why.push(it.id + ": " + g.why + " | " + (res.turns[0].answerText || res.turns[0].final)); }
  }
  ok("bench: a model that hands each puzzle to Lantern passes all ten", allPass, why);
  var real = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "puzzles_35b_alone.json"), "utf8")), verdict = {};
  Object.keys(real.answers).forEach(function (id) {
    var it2 = L.aiBenchQuestions.filter(function (x) { return x.id === id + "-alone"; })[0];
    verdict[id] = L.aiBench.grade(it2, "", { turns: [{ final: real.answers[id] }] });
  });
  ok("bench: the 35B's real answers without the tools -- 4 right, the two coins and the die wrong, for the right reasons",
    verdict["cups-four"].pass && verdict["houses-four"].pass && verdict["doors-host-guesses"].pass && verdict["letters-refrigerator"].pass &&
    !verdict["cups-two-coins"].pass && /silver is not with Blue/.test(verdict["cups-two-coins"].why) &&
    !verdict["die-four-moves"].pass && /top is not 5/.test(verdict["die-four-moves"].why), verdict);
  ok("bench: wrong answers are caught -- the classic door answer, a wrong knight, a wrong walk", (function () {
    function gr(id, txt) { return L.aiBench.grade(L.aiBenchQuestions.filter(function (x) { return x.id === id; })[0], "", { turns: [{ final: txt }] }).pass; }
    return !gr("doors-host-guesses", "ANSWER: Yes, switch: door 2 wins 2/3 of the time.") && gr("doors-host-guesses", "ANSWER: It makes no difference; each door is 50%.") &&
      !gr("knights-three", "ANSWER: A is a liar, B is a knight, C is a knight.") && gr("knights-three", "ANSWER: A is a knight; B and C are liars.") &&
      !gr("robot-walk", "ANSWER: It is at (2, -2) facing south.") && !gr("race-order", "ANSWER: Di, Ed, Ben, Ana, Cy.");
  })());
  modelReplies = [function (body) { return /PUZZLE TOOLS|TRACK: <title>/.test(body.messages[0].content) ? "TRACK: x\nrow A B\nEND" : "ANSWER: The coin is under Blue; Yellow, Red, Blue, Green."; }];
  var al = await L.CHAT.converse([B[0].q], { noPuzzle: true, max_tokens: 3000 });
  ok("bench “alone” runs: no puzzle tools in the prompt, no block run, longer replies allowed", modelCalls.length >= 1 &&
    !/PUZZLE TOOLS|TRACK: <title>/.test(modelCalls[modelCalls.length - 1].messages[0].content) && modelCalls[modelCalls.length - 1].max_tokens === 3000 &&
    !al.turns[0].puzzles.length && /coin is under Blue/.test(al.text), { prompt: modelCalls.length && modelCalls[modelCalls.length - 1].max_tokens });
  ok("after an alone run the tools are back", /PUZZLE TOOLS|TRACK: <title>/.test(L.CHAT.buildSystem("What is 2+2?")));
  var sm = L.aiBench.summary([{ cat: "reason", pass: true, ms: 1 }, { cat: "alone", pass: false, ms: 1 }, { cat: "tool", pass: true, ms: 1 }]);
  ok("bench summary: puzzles scored, the alone runs reported apart", sm.n === 2 && sm.pass === 2 && sm.score === 100 && sm.reason.n === 1 && sm.alone.n === 1 && sm.alone.pass === 0);
  ok("no errors after all that", errs.length === 0, errs);
  console.log(fails ? fails + " PUZZLE FAILURES (" + passes + " passed)" : "ALL PUZZLE TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack || e); process.exit(1); });
