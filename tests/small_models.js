// small_models.js -- what Lantern gives a small model, and how it reads one
// (1.24.5). The runs of 1.24.4 on GitHub: the 2B passed 50 of 109, the 0.8B
// 16 (the 35B: every question). Their failed rows, as the models wrote them,
// are tests/fixtures/bench_run_1244_2b.json and bench_run_1244_08b.json;
// this replays them.
//  - AI_NEED_GIVEN: a NEED for a number the question gives is answered by
//    Lantern, once, with the question's numbers; a NEED for something the
//    person alone knows still goes to the person;
//  - the instructions: "NEED: <what is missing>", the question's numbers
//    listed, the NEED example only where the question has fewer than two;
//  - AI_PROMPT: the short prompt (only the functions the question is about)
//    for a small model on the kit's server;
//  - AI_READ: "= MAKE WHEEL:", "=TRACK:", "ANS: 120*80/10000",
//    "ANSWER: CONVERT(26,"mile","km")", one line forty times;
//  - AI_FIT: a request that is more than the model can hold is shortened
//    and sent once more;
//  - RELKE is right at everyday speeds;
//  - without each module, nothing breaks (rule 11).
// Where Lantern sends something back, the reply that comes back is scripted.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var R2 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_2b.json"), "utf8"));
var R8 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_08b.json"), "utf8"));
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
function load(model, strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, o = { w: w, d: w.document, errs: errs, script: null, bodies: [] };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, statusText: status === 400 ? "Bad Request" : "OK", headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url, opts) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: model }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    var body = JSON.parse(opts.body);
    o.bodies.push(body);
    var r = o.script ? o.script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
    if (r && typeof r === "object" && r.status) return resp(r.status, JSON.stringify({ error: { message: r.message, type: "exceed_context_size_error" } }), "application/json");
    return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
  };
  w.eval(js);
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1100)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list, seen) { var i = 0; return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return { role: m.role, content: textOf(m.content) }; })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
function row(R, id) { return R.rows.filter(function (r) { return r.id === id; })[0]; }
function needOf(r) { var m = /^\s*NEED:\s*(.+)$/m.exec(r.reply || ""); return m ? m[1] : ""; }

(async function () {
  var o = load("Qwen3.5-2B-Q4_K_M.gguf"), L = o.L;
  await sleep(80);
  await L.ai.detect();
  var A = L.assist, B = L.aiBench, Q = L.aiBenchQuestions, P = L.aiPrompt, act = L.aiAct;
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }
  ok("boot clean, with a 2B on the kit's server", o.errs.length === 0 && /2B/.test(L.ai.server.label || ""), [o.errs, L.ai.server.label]);
  ok("the fixtures: the 2B passed 50 of 109 and the 0.8B 16 of 109 on 1.24.4; every failed row is here", R2.summary.pass === 50 && R2.rows.length === 59 && R8.summary.pass === 16 && R8.rows.length === 93);

  // --- the numbers a question gives ------------------------------------------------------------------
  var N = L.aiQuestionNumbers;
  ok("the numbers of a question, each with its unit", N("What voltage is across a 470 ohm resistor carrying 0.02 amps?").join("|") === "470 ohm|0.02 amps" &&
    N("A 12 V pump draws 5 A for 3 hours a day. How many amp-hours does it use in a week?").join("|") === "12 V|5 A|3 hours" &&
    N("A family of 5 uses 40 litres of water per person per day. How many days does a 2000 litre tank last?").join("|") === "5|40 litres|2000 litre" &&
    N("How many hours does it take to drive 26 miles at 40 km/h?").join("|") === "26 miles|40 km/h" && N("A 1,500 W kettle is 25% full at -5 degrees.").join("|") === "1500 W|25%|-5 degrees",
    [N("A 12 V pump draws 5 A for 3 hours a day. How many amp-hours does it use in a week?"), N("A 1,500 W kettle is 25% full at -5 degrees.")]);
  ok("...a number inside a name is not one (H2O, A4988), and a question with none gives none", N("What is the molar mass of water, H2O?").length === 0 && N("A stepper on an A4988 driver").length === 0 && N("Who is the mayor?").length === 0);

  // --- a NEED for what the question gives ------------------------------------------------------------------
  var asked2 = R2.rows.filter(function (r) { return r.why === "asked for a value"; }), asked8 = R8.rows.filter(function (r) { return r.why === "asked for a value"; });
  var un2 = asked2.filter(function (r) { return !L.aiNeedAnswer(needOf(r), r.q); }).map(function (r) { return r.id; });
  var un8 = asked8.filter(function (r) { return !L.aiNeedAnswer(needOf(r), r.q); }).map(function (r) { return r.id; });
  ok("the 2B asked for a value 11 times: Lantern answers all 11 itself now", asked2.length === 11 && un2.length === 0, un2);
  ok("the 0.8B asked 24 times: Lantern answers 22 (the two left repeat a question that has no number)", asked8.length === 24 && un8.join() === "water-molar,place-distance", un8);
  var G = L.aiNeedGiven, QO = "What voltage is across a 470 ohm resistor carrying 0.02 amps?";
  var ga = G(needOf(row(R2, "ohms-law")), QO);
  ok("the 2B's NEED for ohms and amperes: the question's numbers, to use if what was asked is among them, and NEED again only for one that is not",
    /^Lantern: the question gives these numbers: 470 ohm; 0\.02 amps\. If the number you asked for is among them, use it\.\nNow reply with the = lines and the ANSWER line\. Write NEED again only for a number that is not among them\.$/.test(ga), ga);
  ok("...the instructions' own example, written for questions about a pump and a jerrycan", needOf(row(R2, "pump-ah")) === "How many litres does the tank hold, and how many litres a minute flow in?" &&
    !!G(needOf(row(R2, "pump-ah")), row(R2, "pump-ah").q) && !!G(needOf(row(R2, "bleach-jerrycan")), row(R2, "bleach-jerrycan").q));
  ok("...a NEED that quotes the question's number, repeats the question, or asks “how many <unit>” the question gives", !!G("How many litres of fuel does the car use per 150 km?", row(R2, "car-fuel").q) &&
    !!G(QO, QO) && !!G("How many miles are in the distance, and how many km/h is the speed?", row(R2, "miles-speed").q) && !!G("How many cubic metres does the room hold?", row(R2, "room-air").q));
  ok("a NEED for what only the person knows is left for the person", G("How many amp-hours is your battery, and what is its voltage?", item("need-battery").q) === null &&
    G("How many goats do you have, and how many grams does each eat in a day?", item("need-goats").q) === null &&
    G("How many goats do you have and how much does each goat eat per day?", item("need-goats").q) === null &&
    // the 35B's own NEED on the first build of 1.24.5, which that build answered by mistake (it shares three of the question's four words)
    G("How many goats do you have, and how many grams of feed does each goat need per day?", item("need-goats").q) === null &&
    G("How many litres does the tank hold, and how many litres a minute flow in?", "How long will it take to fill my water tank?") === null && G("What is your town?", "Who is the mayor of my town right now?") === null);
  ok("what Lantern already answered (a dozen, kilograms in a tonne) is answered as before, first", /a dozen is 12/.test(L.aiNeedAnswer("How many shillings are in a dozen, and how many shillings does one egg cost?", row(R2, "egg-dozens").q)));
  // replayed through Assist
  var seen = [], r = row(R2, "ohms-law");
  var out = await A.solve(r.q, { call: seq([r.reply, "=VOLTS(0.02,470)\nANSWER: The voltage is {result} volts."], seen) }), g = B.grade(item("ohms-law"), out.text, out);
  ok("ohms-law replayed: Lantern answers the NEED, the model writes the line, the bench passes it", out.rounds === 2 && /470 ohm; 0\.02 amps/.test(out.needAnswered) && g.pass &&
    seen[1].length === 3 && /^Lantern: the question gives these numbers/.test(seen[1][2].content) && !/Now reply with the = lines and the ANSWER line\.\nNow reply/.test(seen[1][2].content), [out.rounds, g.why, seen[1] && seen[1][2]]);
  seen = [];
  out = await A.solve(r.q, { call: seq([r.reply, r.reply], seen) }); g = B.grade(item("ohms-law"), out.text, out);
  ok("...answered once only: NEED again is the answer, and fails as before", out.rounds === 2 && seen.length === 2 && !g.pass && g.why === "asked for a value", [out.rounds, g.why]);
  seen = [];
  out = await A.solve(item("need-battery").q, { call: seq(["NEED: How many amp-hours is your battery, and what is its voltage?"], seen) }); g = B.grade(item("need-battery"), out.text, out);
  ok("a question that truly lacks a number: one turn, the NEED goes to the person, the bench passes it", out.rounds === 1 && seen.length === 1 && !out.needAnswered && g.pass, [out.rounds, g.why]);

  // --- the instructions ------------------------------------------------------------------------------------
  // (the full ones: what any model larger than 3B gets. From 1.24.6 a small model gets a short form for a sum -- below.)
  P.setMode("full");
  var pq = A.buildPrompt(row(R2, "pump-ah").q, A.match(row(R2, "pump-ah").q)), pn = A.buildPrompt(item("need-battery").q, A.match(item("need-battery").q));
  ok("a question with two numbers or more: its numbers are listed under it, and the NEED example is not shown", /QUESTION: A 12 V pump[^\n]*\nThe question gives these numbers: 12 V; 5 A; 3 hours\.$/.test(pq) && !/fill my water tank/.test(pq) && !/litres a minute flow in/.test(pq), pq.slice(-200));
  ok("a question with fewer: the example stays, and no list", /Q: How long will it take to fill my water tank\?\nNEED: How many litres does the tank hold/.test(pn) && !/The question gives these numbers/.test(pn));
  ok("NEED names what is missing, not “<question>” (the 0.8B wrote NEED: and the question itself), in every place it is said", /NEED: <what is missing> -- never guess it/.test(pq) &&
    /reply 'NEED: <what is missing>'/.test(L.CHAT.buildSystem("A drum holds 200 litres. How many 20 litre cans fill it?")) && JS.indexOf("NEED: <question>") < 0 && (JS.match(/NEED: <what is missing>/g) || []).length >= 6);
  P.setMode("auto");
  // (1.24.6) the short form of Assist's instructions, for a sum: one way to write it, and only what this sum needs
  var sp = A.buildPrompt(row(R2, "pump-ah").q, A.match(row(R2, "pump-ah").q)), sf = A.buildPrompt(row(R2, "feed").q, A.match(row(R2, "feed").q)),
    sb = A.buildPrompt(item("need-battery").q, A.match(item("need-battery").q)), sm = A.buildPrompt(item("mayor").q, A.match(item("mayor").q));
  ok("a small model, a sum with no recipe (a pump\u2019s amp-hours): under 1,500 characters; ANS only as the line before; no NEED, no /1000 example; the numbers listed",
    P.active() === "short" && sp.length < 1500 && /A second = line may use ANS, the result of the line before/.test(sp) && !/ANS1/.test(sp) && !/NEED/.test(sp) && !/300\*5\/1000/.test(sp) &&
    /EXAMPLE\nQ: Fuel costs 65 a litre\. How much do 35 litres cost\?\n=65\*35\nANSWER: They cost \{result\}\./.test(sp) && /The question gives these numbers: 12 V; 5 A; 3 hours\.$/.test(sp), [sp.length, sp.slice(-160)]);
  // (1.24.7: with the question's numbers in it, where each blank's unit names its number -- 20 goats, 30 days, 800 g each per day)
  ok("...a sum with a recipe Lantern can fill (feed for goats): the recipe with the question’s numbers in it, to copy as it stands; no blanks, no example, no decline and no NEED beside it",
    /- The recipe below has this question's numbers in it already\. If it is what the question asks, copy its = line as it stands\./.test(sf) && /\nRECIPE\n- How much feed do animals need[^\n]*\n  gives: kg\n  =FEEDKG\(20,30,800\)\n/.test(sf) && !/->/.test(sf.slice(sf.indexOf("\nRECIPE\n"))) &&
    !/\{animals\}/.test(sf) && !/needs:/.test(sf) && !/EXAMPLE/.test(sf) && !/Not in my library/.test(sf) && !/NEED/.test(sf) && sf.length < 1700, [sf.length, sf.slice(-420)]);
  var sq = "How much feed for 50 chickens for 7 days at 120 g each?", sf2 = A.buildPrompt(sq, A.match(sq));
  ok("...and a recipe it cannot be sure of (120 g each: a day is not said): the recipe with its blanks, to fill in", /- A recipe below fits: copy its = line and put the question's value in place of each \{name\}\./.test(sf2) &&
    /  needs: animals; days; g_day in g\n  gives: kg\n  =FEEDKG\(\{animals\},\{days\},\{g_day\}\)\n/.test(sf2), sf2.slice(-420));
  ok("...a recipe with more blanks than the question has numbers (a battery, and only the light\u2019s 60 W): NEED is offered",
    /- If the question leaves out a number you need, reply NEED: <what is missing> -- never guess it or use a recipe.s example\./.test(sb) && /=\(\{ah\}\*\{v\}\)\/\{w\}/.test(sb), sb.slice(0, 900));
  ok("...and a question that is no sum Lantern can see (no recipe, under two numbers) keeps the full instructions: a decline, and the example of one", /EXAMPLES\n/.test(sm) && /Q: Who won the last election\?\nANSWER: Not in my library\./.test(sm) && /NEED: <what is missing>/.test(sm));

  // --- the short prompt for a small model ----------------------------------------------------------------------
  ok("a 2B on the kit's server is small, and gets the short prompt", P.small() === true && P.mode() === "auto" && P.active() === "short");
  var wave = item("radio-wave"), pw = A.buildPrompt(wave.q, A.match(wave.q));
  ok("...the functions the question is about, not all 75: a wavelength gets WAVELEN and under 3,000 characters", /\nWAVELEN\(f_MHz/.test(pw) && !/\nHOHMANN\(/.test(pw) && !/\nMORSE\(/.test(pw) && pw.length < 3000, pw.length);
  var need2 = ["car-ke:KE(", "plants:PLANTS(", "kg-lb:CONVERT(", "f-to-c:CONVERT(", "feed:FEEDKG(", "parallel:RPARALLEL(", "ohms-law:VOLTS(", "orbit-420:ORBITT(", "place-bearing:BEARING(", "mars-escape:PLANET("]
    .filter(function (x) { var id = x.split(":")[0], fn = x.split(":")[1], it = item(id); return A.buildPrompt(it.q, A.match(it.q)).indexOf("\n" + fn) < 0; });
  ok("...ten questions the 2B got wrong or declined: the function each needs is in its short prompt", need2.length === 0, need2);
  var cs = L.CHAT.buildSystem("How do I make river water safe to drink?"), cv = L.CHAT.buildSystem("What voltage is across a 470 ohm resistor carrying 0.02 amps?");
  ok("...Chat\u2019s own instructions too: VOLTS for a question about volts, and not every function", /\nVOLTS\(I,R\)/.test(cv) && !/\nMORSE\(/.test(cv) && !/\nHOHMANN\(/.test(cv) && cv.length < 2500, [cs.length, cv.length]);
  // (1.24.6) by the kind of question: a how-to gets no sums, no functions, no modules to propose and no puzzle tools
  var cm = L.CHAT.buildSystem("Draw a simple house with a red roof and a door."), cb = L.CHAT.buildSystem("My baby is 8 months old, has a cough and is breathing 56 times a minute. Is that too fast?");
  ok("...a how-to (9,000 characters with every function, 4,400 on 1.24.5) is under 2,200: Lantern\u2019s lessons and the rule for the model\u2019s own knowledge, and nothing about sums",
    cs.length < 2200 && L.CHAT.kindOf("How do I make river water safe to drink?") === "talk" && /LESSON: <2 to 5 words>/.test(cs) && /From my own knowledge:/.test(cs) &&
    !/FUNCTIONS/.test(cs) && !/STARTS? with =/.test(cs) && !/\bANS\b/.test(cs) && !/NEED:/.test(cs) && !/PROPOSE MODULE/.test(cs) && !/PUZZLE TOOLS/.test(cs), [cs.length, L.CHAT.kindOf("How do I make river water safe to drink?")]);
  ok("...a sum gets the sums, its functions and NEED, and no lessons or modules; a thing to make gets its block and no sums", L.CHAT.kindOf(item("ohms-law").q) === "sum" && /STARTS with =/.test(cv) && /NEED: <what is missing>/.test(cv) &&
    !/LESSON:/.test(cv) && !/MODULES/.test(cv) && !/PROPOSE MODULE/.test(cv) && L.CHAT.kindOf("Draw a simple house with a red roof and a door.") === "make" && /MAKE DRAWING: <title>/.test(cm) &&
    !/FUNCTIONS/.test(cm) && !/STARTS with =/.test(cm) && !/LESSON:/.test(cm), [L.CHAT.kindOf(item("ohms-law").q), cv.length, cm.length]);
  ok("...a health need with numbers in it (a baby\u2019s age, breaths a minute) is a question to answer from the lesson, not a sum; a dose of ORS is a sum", L.CHAT.kindOf(item("health-baby-breathing").turns[0]) === "talk" &&
    !/FUNCTIONS/.test(cb) && L.CHAT.kindOf(item("ors-five-litres").q) === "sum" && L.CHAT.kindOf("What are your capabilities?") === "talk" && L.CHAT.kindOf("What is half of three quarters?") === "sum",
    [L.CHAT.kindOf(item("health-baby-breathing").turns[0]), L.CHAT.kindOf(item("ors-five-litres").q)]);
  ok("...the puzzle tools in full for a puzzle, and proposing a module when the question is about one", /TRACK: <title>/.test(L.CHAT.buildSystem("Three cups stand in a row; the red cup and the blue cup swap places. Where is the coin?")) &&
    /PROPOSE MODULE: <NAME>/.test(L.CHAT.buildSystem("Can you propose a module that counts words?")));
  P.setMode("full");
  ok("...in full mode Chat\u2019s instructions list every function, as before", /\nHOHMANN\(/.test(L.CHAT.buildSystem("How do I make river water safe to drink?")) && L.CHAT.buildSystem("How do I make river water safe to drink?").length > 8500);
  ok("...the full list when asked for", P.active() === "full" && /\nHOHMANN\(/.test(A.buildPrompt(wave.q, A.match(wave.q))));
  P.setMode("auto");
  var names = { "Qwen3.5-0.8B-Q4_K_M": true, "Qwen3.5-2B-Q4_K_M": true, "Qwen3.5-4B-Q4_K_M": false, "Qwen3.5-9B-Q4_K_M": false, "Qwen3.5-35B-A3B-UD-IQ4_XS": false, "": false, "llama-3.2-1b-instruct": true, "mistral-7b": false }, wrongN = [];
  var keptModel = L.ai.server.model;
  Object.keys(names).forEach(function (nm) { L.ai.server.label = nm; L.ai.server.model = nm; if (P.small() !== names[nm]) wrongN.push(nm); });
  L.ai.server.label = "Qwen3.5-2B-Q4_K_M"; L.ai.server.model = keptModel;
  ok("small by the file name: 0.8B, 2B and a 1b are; 4B, 9B, 35B-A3B, 7b and no name are not", wrongN.length === 0, wrongN);

  // --- reading -------------------------------------------------------------------------------------------------
  var RDR = L.aiRead;
  var w8 = RDR(row(R8, "make-power-wheel").reply), blocks = act.find(w8.text);
  ok("“= MAKE WHEEL: The year” (the 0.8B) is a MAKE WHEEL block", /^= MAKE WHEEL: The year/.test(row(R8, "make-power-wheel").reply) && act.find(row(R8, "make-power-wheel").reply).length === 0 &&
    blocks.length === 1 && blocks[0].kind === "WHEEL" && w8.said.length === 1, [blocks.length, w8.said]);
  var mo = RDR(row(R2, "make-music-orchestra").reply);
  ok("“= MAKE MUSIC: Ode to Joy” (the 2B) is found too", act.find(mo.text).length === 1 && act.find(mo.text)[0].kind === "MUSIC", mo.text.slice(0, 80));
  var tr = RDR(row(R2, "cups-four").reply);
  ok("“=TRACK: Cups” (the 2B) is a TRACK block for the puzzle tools", /^TRACK: Cups/m.test(tr.text) && !/^=TRACK/m.test(tr.text) && !!(L.aiPuzzle && L.aiPuzzle.find && L.aiPuzzle.find(tr.text).length), tr.text.slice(0, 80));
  var mk = RDR(row(R2, "miles-km").reply), pmk = A.parseReply(mk.text), rmk = A.run(pmk.exprText);
  ok("“ANSWER: CONVERT(26,\"mile\",\"km\")” (the 2B): the formula, and its result as the answer", row(R2, "miles-km").reply === "ANSWER: CONVERT(26,\"mile\",\"km\")" &&
    mk.text === "=CONVERT(26,\"mile\",\"km\")\nANSWER: {result}" && Math.abs(rmk.value - 41.842944) < 1e-9 && B.grade(item("miles-km"), mk.text, { text: mk.text, parsed: pmk, run: rmk, flags: [], rounds: 1 }).pass, [mk.text, rmk.value]);
  var fh = RDR(row(R8, "field-ha").reply), pfh = A.parseReply(fh.text), rfh = A.run(pfh.exprText);
  ok("“ANS: 120*80/10000” fourteen times (the 0.8B): one formula line, 0.96", /^=120\*80\/10000$/m.test(fh.text) && Math.abs(rfh.value - 0.96) < 1e-12 && fh.said.length === 2, [fh.text.slice(0, 120), fh.said]);
  var bh = RDR(row(R8, "bus-hours").reply);
  ok("“ANS: 3” fifty times: one line, and still no sum -- a typed number is not made into one", bh.text.split("\n").filter(function (l) { return /^ANS: 3$/.test(l); }).length === 1 && A.parseReply(bh.text).exprText === "" && /times as one/.test(bh.said[0]), [bh.text.slice(0, 60), bh.said]);
  var bt = RDR(row(R8, "battery-hours").reply);
  ok("“ANS: The battery runs for {result} hours.” is the ANSWER line (still with nothing computed)", bt.text === "ANSWER: The battery runs for {result} hours." && A.parseReply(bt.text).exprText === "");
  var keep = ["=VOLTS(0.02,470)\nANSWER: The voltage is {result} volts.", "ANSWER: 60", "ANSWER: 1/2", "ANSWER: 2/3 of the tank is full.", "ANSWER: Not in my library.", "NEED: How many amp-hours is your battery?",
    "MAKE SHEET: Shopping\nItem | Cost\nBread | 3\nMilk | 0.99\nTotal | =SUM(B2:B3)\nEND", "The answer is in the lesson [1].\nQUOTE [1]: Boil it.", "=60*5\n=ANS/1000\nANSWER: {result} kWh",
    "LESSON: chickens laying eggs", "ANS: 33.33333333333333", "ANS: 18.01528 g/mol", "MAKE DRAWING: Dots\nrect 1 1 1 1\nrect 1 1 1 1\nrect 1 1 1 1\nrect 1 1 1 1\nEND"];
  var touched = keep.filter(function (t) { var x = RDR(t); return x.text !== t || x.said.length; });
  ok("a reply that is already what it should be is left as it is (" + keep.length + " kinds: sums, a number, a fraction, a decline, a NEED, a sheet with =SUM, repeated shapes)", touched.length === 0, touched);
  // through the engine: every reply is read before anything else sees it
  o.script = function () { return row(R2, "miles-km").reply; };
  var viaEngine = await L.ai.complete([{ role: "user", content: "Convert 26 miles to kilometres." }], {});
  ok("the engine applies the readers to every reply, keeps the reply as it came, and says what it read", viaEngine === "=CONVERT(26,\"mile\",\"km\")\nANSWER: {result}" && L.ai.lastRaw === row(R2, "miles-km").reply &&
    L.ai.lastRead.length === 1 && /formula written after/.test(L.ai.lastRead[0]), [viaEngine, L.ai.lastRead]);
  o.script = function (last) { return /TOOL RESULTS/.test(last) ? "ANSWER: That is {result} km." : row(R2, "miles-km").reply; };
  var ct = await L.CHAT.turn([], "Convert 26 miles to kilometres.", {}, {});
  ok("Chat: the 2B's reply is computed (41.84 km), and Chat says how Lantern read it", Math.abs(ct.value - 41.842944) < 1e-9 && /41\.84/.test(ct.answerText) && ct.notes.some(function (n) { return /^Lantern read a formula written after “ANSWER:” as a formula line\.$/.test(n); }), [ct.value, ct.answerText, ct.notes]);

  // --- the lesson's own sentences, given without a citation -------------------------------------------------------------
  var hf = row(R2, "health-fit"), hfQ = item("health-fit");
  o.script = function () { return hf.reply; };
  var th = await L.CHAT.turn([], hfQ.turns[0], {}, {});
  ok("the fixture: the 2B gave the Fits lesson\u2019s own steps under \u201cFrom my own knowledge:\u201d with no [n], and failed \u201cno sentence backed\u201d", /^From my own knowledge:/.test(hf.reply) && !/\[\d\]/.test(hf.reply) && /no sentence backed by a lesson passage/.test(hf.why));
  ok("Chat finds those sentences in the passage, cites them itself, counts them and says so", th.citedByLantern >= 3 && th.backed === th.citedByLantern && th.ownSentences === 0 &&
    th.notes.some(function (n) { return /^Lantern found \d+ of the AI\u2019s sentences in the passages, though the AI did not cite them and called its answer its own knowledge: those are what the passages say\.$/.test(n); }), [th.backed, th.citedByLantern, th.ownSentences, th.notes]);
  ok("...the answer is no longer labelled as the AI\u2019s own unchecked knowledge, and the bench passes it", th.own === false && !th.notes.some(function (n) { return /From the AI\u2019s own knowledge/.test(n); }) && hfQ.check([th]) === "", [th.own, hfQ.check([th])]);
  var sg = row(R2, "suite-goats"), sgQ = item("suite-goats");
  o.script = function () { return sg.reply; };
  var tg = await L.CHAT.turn([], sgQ.turns[0], {}, {});
  ok("an answer that IS the model\u2019s own (goats given \u201ca udder\u201d) is still labelled so, and still fails", !tg.citedByLantern && tg.backed === 0 && tg.own === true && /no sentence backed/.test(sgQ.check([tg])), [tg.backed, tg.own, sgQ.check([tg])]);

  // --- more than the model can hold ---------------------------------------------------------------------------------
  var FIT = L.aiFit, long1 = "LESSONS: passages from Lantern’s own lessons\n" + new Array(400).join("A passage line of the lesson that goes on and on.\n") + "Answer the QUESTION from these passages.\nQUESTION: How do I make river water safe to drink?";
  var conv = [{ role: "system", content: "You are the reasoning half of Lantern. " + new Array(60).join("A rule of the instructions. ") },
    { role: "user", content: "How do I make river water safe to drink?" }, { role: "assistant", content: "MODULES: water" },
    { role: "user", content: "LANTERN CATALOG\n" + new Array(300).join("Lesson: something about water (Health tile)\n") + "Now answer the QUESTION." },
    { role: "assistant", content: "LESSON: safe water" }, { role: "user", content: long1 }];
  function chars(ms) { return ms.reduce(function (n, m) { return n + textOf(m.content).length; }, 0); }
  var fm = FIT(conv, { request: 8566, available: 8192, max_tokens: 512 });
  ok("aiFit: shorter by the server's own count, with room for the reply", fm && chars(fm) < chars(conv) * (8192 - 512 - 64) / 8566 && chars(fm) > chars(conv) * 0.6, fm && [chars(conv), chars(fm)]);
  ok("...the instructions untouched, every message still there, and the messages it was given not changed", fm.length === conv.length && fm[0].content === conv[0].content && conv[5].content === long1 && fm[1].content === conv[1].content);
  ok("...the long messages lose their middle and keep their start and their end, and say so", /^LESSONS: passages from Lantern/.test(fm[5].content) && /QUESTION: How do I make river water safe to drink\?$/.test(fm[5].content) &&
    /\[\.\.\. Lantern left part of this out: it was more than the AI model can hold at once \.\.\.\]/.test(fm[5].content) && /^LANTERN CATALOG/.test(fm[3].content) && /Now answer the QUESTION\.$/.test(fm[3].content));
  var many = [{ role: "system", content: "Rules." }];
  for (var i = 0; i < 40; i++) many.push({ role: i % 2 ? "assistant" : "user", content: "turn " + i + " " + new Array(40).join("word ") });
  var fm2 = FIT(many, { request: 16000, available: 8192, max_tokens: 512 });
  ok("...many short turns: the oldest go, the instructions and the last four stay", fm2 && fm2.length < many.length && fm2[0].content === "Rules." && fm2.slice(-4).map(function (m) { return m.content; }).join("|") === many.slice(-4).map(function (m) { return m.content; }).join("|"), fm2 && fm2.length);
  ok("...nothing to do with nonsense", FIT(conv, {}) === null && FIT([], { request: 9000, available: 8192 }) === null && FIT(null, { request: 9000, available: 8192 }) === null);
  // through the engine: the server's refusal, once
  var tries = 0, sizes = [];
  o.bodies.length = 0;
  o.script = function (last, body) { tries++; sizes.push(JSON.stringify(body.messages).length); return tries === 1 ? { status: 400, message: "request (8566 tokens) exceeds the available context size (8192 tokens), try increasing it" } : "Boil it for one minute [1]."; };
  var rep = await L.ai.complete(conv, {});
  ok("the server says 400, too long: Lantern sends a shorter request once, and the reply comes", rep === "Boil it for one minute [1]." && tries === 2 && sizes[1] < sizes[0] && L.ai.lastFit && L.ai.lastFit.request === 8566 && L.ai.lastFit.available === 8192, [rep, tries, sizes]);
  tries = 0; var err = "";
  o.script = function () { tries++; return { status: 400, message: "request (9000 tokens) exceeds the available context size (8192 tokens), try increasing it" }; };
  try { await L.ai.complete(conv, {}); } catch (e) { err = String(e.message); }
  ok("...still too long the second time: the error as before, with what to do, and no third try", tries === 2 && /Server said 400 Bad Request: request \(9000 tokens\) exceeds/.test(err) && /start a new chat, or ask a shorter question/.test(err), [tries, err]);
  tries = 0;
  o.script = function () { tries++; return { status: 400, message: "the request was not understood" }; };
  try { err = ""; await L.ai.complete(conv, {}); } catch (e) { err = String(e.message); }
  ok("...another 400 is not retried", tries === 1 && /not understood/.test(err), [tries, err]);
  tries = 0;
  o.script = function (last) { tries++; return tries === 1 ? { status: 400, message: "request (8566 tokens) exceeds the available context size (8192 tokens), try increasing it" } : "A plain answer about water."; };
  var cf = await L.CHAT.turn([], "Tell me about water in one sentence, from your own knowledge.", {}, {});
  ok("Chat says it sent a shorter version", cf.fitted === true && cf.notes.some(function (n) { return /^That was more than the AI model can hold at once; Lantern sent it a shorter version of the conversation\.$/.test(n); }), cf.notes);

  // --- RELKE ----------------------------------------------------------------------------------------------------------
  function ev(x) { return L.formula.evaluate(x, {}); }
  var c = 299792458, g5 = 1 / Math.sqrt(1 - 0.25);
  ok("RELKE at everyday speeds is the ordinary kinetic energy (it said 383,162 J for a car’s 375,000 J)", Math.abs(ev("RELKE(1200,25)") - 375000) < 1e-6 && Math.abs(ev("RELKE(1,3000)") - 4500000.000338) < 1e-4 && ev("RELKE(1200,0)") === 0, [ev("RELKE(1200,25)"), ev("RELKE(1,3000)")]);
  ok("...and unchanged near light speed: (gamma - 1) m c^2 at half the speed of light", Math.abs(ev("RELKE(1,0.5*299792458)") / ((g5 - 1) * c * c) - 1) < 1e-12, ev("RELKE(1,0.5*299792458)"));
  var ck = row(R2, "car-ke"), pck = A.parseReply(ck.reply), rck = A.run(pck.exprText);
  ok("the 2B’s =RELKE(1200,25) for a car now gives the right number", /^=RELKE\(1200,25\)/.test(ck.reply) && Math.abs(rck.value - item("car-ke").expected) < 1e-6 * 375000 || Math.abs(rck.value - 375000) < 1e-6, rck.value);

  // --- without the modules (rule 11) --------------------------------------------------------------------------------------
  var o2 = load("Qwen3.5-2B-Q4_K_M.gguf", ["AI_NEED_GIVEN", "AI_READ", "AI_FIT"]), L2 = o2.L;
  await sleep(80);
  await L2.ai.detect();
  o2.script = function () { return row(R2, "miles-km").reply; };
  var plainR = await L2.ai.complete([{ role: "user", content: "Convert 26 miles to kilometres." }], {});
  var t2 = 0, e2 = "";
  o2.script = function () { t2++; return { status: 400, message: "request (8566 tokens) exceeds the available context size (8192 tokens), try increasing it" }; };
  try { await L2.ai.complete(conv, {}); } catch (e) { e2 = String(e.message); }
  L2.aiPrompt.setMode("full");   // (the full instructions: ASSIST_CORE's own)
  var p2 = L2.assist.buildPrompt(row(R2, "pump-ah").q, L2.assist.match(row(R2, "pump-ah").q));
  L2.aiPrompt.setMode("auto");
  ok("without AI_NEED_GIVEN, AI_READ and AI_FIT: boot clean; replies as they came; one request and the server’s error; the NEED example back and no list; the older NEED answers still there",
    o2.errs.length === 0 && plainR === row(R2, "miles-km").reply && t2 === 1 && /exceeds the available context size/.test(e2) && /fill my water tank/.test(p2) && !/The question gives these numbers/.test(p2) &&
    L2.aiNeedGiven === undefined && L2.aiRead === undefined && L2.aiFit === undefined && /a dozen is 12/.test(L2.aiNeedAnswer("How many eggs are in 3 dozen?", "Eggs cost 12 shillings each. How much do 3 dozen eggs cost?")) &&
    L2.aiNeedAnswer(needOf(row(R2, "ohms-law")), QO) === null, [o2.errs, plainR, t2, e2.slice(0, 80)]);

  console.log(fails ? fails + " SMALL MODEL FAILURES (" + passes + " passed)" : "ALL SMALL MODEL TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack || e); process.exit(1); });
