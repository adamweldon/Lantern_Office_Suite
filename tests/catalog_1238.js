// catalog_1238.js -- Lantern as a library: the catalog, its shelves, its measured surety, OPEN (LIBRARY_CATALOG, 1.24.38).
//
// Adam, 2026-11-24: "a reasoning engine doing the reasoning with calculators and tools that present the easy button to
// the reasoning engine whenever possible and still provide a way to get to the goal". The library prompt (AI tile,
// Prompt size: Library) starts every question with the same words -- who does what, "do your homework", the ten classes
// of shelves -- then names the shelf Lantern opened when it is sure or nearly, then the short instructions that kind of
// question has always had. Where a question in words has no shelf Lantern is sure of, the model may choose one: OPEN
// and its number. What is checked:
//  - the start is the same for every question, in Chat and in Assist; the other prompts do not change;
//  - the shelf named is right for the bench's questions, and the surety in the source is what the labelled questions
//    give (tools/calibrate_catalog.js) -- a change to the router that moves a count fails here until it is counted again;
//  - OPEN runs only with the library prompt; a shelf of lessons comes back as passages (checked as passages are), a
//    shelf of functions as the functions, a class as its shelves;
//  - the cooked-rice row of Adam's laptop (1.24.36, set B): its Food lesson is given in every prompt now;
//  - without the module (rule 11) Lantern boots, "library" is "auto", and nothing else changes.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var FILE = process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html");
var inner = fs.readFileSync(FILE, "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load(strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new TypeError("no model in this test")); };
  w.eval(js);
  return { w: w, L: w.Lantern, errs: errs };
}
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x && x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
var fails = 0, n = 0;
function ok(name, cond, info) { n++; if (cond) console.log("ok   " + name); else { fails++; console.log("FAIL " + name); if (info !== undefined) console.log("     " + JSON.stringify(info).slice(0, 900)); } }

(async function () {
  var o = load(), L = o.L, C = L.catalog, P = L.aiPrompt, A = L.assist;
  ok("boot clean", o.errs.length === 0, o.errs);
  ok("the catalog: ten classes, every shelf in one of them, every shelf number once", C.classes.length === 10 &&
    C.shelves.every(function (s) { return /^\d\.\d$/.test(s.id) && C.classes.some(function (c) { return c[0] === s.id.charAt(0); }); }) &&
    C.shelves.map(function (s) { return s.id; }).filter(function (x, i, a) { return a.indexOf(x) !== i; }).length === 0);
  var es = L.suite.entries(), lessons = es.filter(function (e) { return e.kind === "lesson"; });
  ok("every lesson is on a shelf, and every function but CONVERT\u2019s helpers", lessons.every(function (e) { return C.shelfOf(e); }) &&
    (L.assistCatalog || []).every(function (f) { return C.shelfOf({ kind: "function", id: f.n }); }), lessons.filter(function (e) { return !C.shelfOf(e); }).map(function (e) { return e.id; }));
  ok("every recipe card is on a shelf", es.filter(function (e) { return e.kind === "recipe"; }).every(function (e) { return C.shelfOf(e); }),
    es.filter(function (e) { return e.kind === "recipe" && !C.shelfOf(e); }).map(function (e) { return e.id; }));

  // --- the prompts ------------------------------------------------------------------------------------------------
  var QS = ["How long can cooked rice be left out on the table before it is unsafe to eat?", "A 100 Ah 12 V battery runs a 60 W light. How many hours will it last?",
    "Draw a circuit in which an Arduino output pin switches a 12 V DC motor through an NPN transistor.", "Is this how you work?", "What will the price of rice be next month?",
    "A robot starts at the point (0, 0) facing east. It moves forward 4 squares, turns left, moves forward 3. Where is it now?", "What causes malaria?"];
  P.setMode("auto");
  var before = QS.map(function (q) { return [L.CHAT.buildSystem(q), A.buildPrompt(q, A.match(q))]; });
  ok("with the usual prompt, nothing of the library", before.every(function (b) { return b[0].indexOf(C.prefix()) < 0 && b[1].indexOf(C.prefix()) < 0; }) && !C.active());
  P.setMode("short");
  var shorts = QS.map(function (q) { return [L.CHAT.buildSystem(q), A.buildPrompt(q, A.match(q))]; });
  P.setMode("library");
  ok("Prompt size: Library", P.active() === "library" && C.active());
  var libs = QS.map(function (q) { return [L.CHAT.buildSystem(q), A.buildPrompt(q, A.match(q))]; });
  ok("every library prompt starts with the same words, in Chat and in Assist (the server reads them once a run)",
    libs.every(function (b) { return b[0].indexOf(C.prefix() + "\n\n") === 0 && b[1].indexOf(C.prefix() + "\n\n") === 0; }), libs.map(function (b) { return b[0].slice(0, 60); }));
  ok("...and the start holds no reply line to copy (=, ANSWER, MAKE, OPEN, NEED) and no number but the classes\u2019",
    !/(^|\n)\s*(=|ANSWER|MAKE|OPEN|NEED)\b/.test(C.prefix()) && (C.prefix().match(/\d/g) || []).length === 10, C.prefix());
  ok("under it, the short instructions each kind of question has always had, whole but for their first line",
    libs.every(function (b, i) { var s = shorts[i][0].split("\n").filter(function (l) { return !/^You are\b|^Lantern computes and checks\.$/.test(l); }).join("\n").replace(/^\s+/, "");
      return b[0].slice(-s.length) === s; }) &&
    libs.every(function (b, i) { var s = shorts[i][1].split("\n").slice(1).join("\n").replace(/^\s+/, ""); return b[1].slice(-s.length) === s; }));
  function head(q) { return C.header(C.route(q)); }
  // (lessons Chat gives are said as found, not claimed: the second review found such claims under their bands)
  ok("the rice question: lessons found on shelf 6.2, given, no surety claimed", /^Lantern found lessons near this question, on shelf 6\.2 food/.test(head(QS[0])) && /they come with the question/.test(head(QS[0])), head(QS[0]));
  // (a recipe card on the electrical shelf: right 20 times in 26 of the labelled questions, drawn toward a card\u2019s 158 in
  // 177 -- named as its band says, or not at all)
  var bb = C.band(C.pct("card-one", "7.1"));
  ok("the battery: shelf 7.1 named as its measured band says (" + bb + "), its recipe and functions below as ever", (bb === "likely" ? /^This question is most likely on shelf 7\.1/.test(head(QS[1])) : bb === "sure" ? /^This question is on shelf 7\.1/.test(head(QS[1])) : head(QS[1]) === "") &&
    /RECIPE/.test(libs[1][1]) && /RUNTIME/.test(libs[1][1]), head(QS[1]));
  ok("a hydraulic circuit: shelf 8.1, sure", /^This question is on shelf 8\.1 hydraulic/.test(head("Draw a hydraulic circuit: a pump feeds a cylinder through a valve.")), head("Draw a hydraulic circuit: a pump feeds a cylinder through a valve."));
  ok("the transistor and motor: most likely shelf 7.2", /most likely on shelf 7\.2 circuits/.test(head(QS[2])), head(QS[2]));
  ok("a question about the model itself: no shelf named", head(QS[3]) === "", head(QS[3]));
  ok("a question Lantern has nothing for: no shelf named, and the model may choose one", /no lesson it is sure of/.test(head(QS[4])) && /OPEN and the shelf\x27s number/.test(head(QS[4])) && !/\d\.\d/.test(head(QS[4])), head(QS[4]));
  ok("the robot: the puzzle shelf, opened", /on shelf 1\.1 puzzles/.test(head(QS[5])), head(QS[5]));
  // (a lesson found for a fact asked as a fact is right about two times in three: no shelf is offered by name; the model
  // may choose one -- the reviews: offers at that rate were mostly wrong)
  ok("malaria: no shelf offered by name; the model may choose one", /not sure which shelf/.test(head(QS[6])) && /OPEN and the shelf\x27s number/.test(head(QS[6])) && !/\d\.\d/.test(head(QS[6])), head(QS[6]));
  var dose = C.route("How many paracetamol tablets can I give my 2 year old?");
  ok("a medicine dose: Lantern\u2019s rule, no shelf named", dose.ev === "guard" && C.header(dose) === "", dose);

  // --- the surety is what the labelled questions give ---------------------------------------------------------------
  var CAL = require(path.join(__dirname, "..", "tools", "calibrate_catalog.js")), items = [];
  CAL.files.forEach(function (f) { JSON.parse(fs.readFileSync(f, "utf8")).forEach(function (x) { items.push(x); }); });
  var got = CAL.counts(L, items).by, stored = C.surety, diff = [];
  Object.keys(got).concat(Object.keys(stored)).forEach(function (k) { var a = got[k] || [0, 0], b = stored[k] || [0, 0]; if (a[0] !== b[0] || a[1] !== b[1]) diff.push([k, a, b]); });
  ok("SURETY is what " + items.length + " labelled questions give now (else: node tools/calibrate_catalog.js --write)", diff.length === 0, diff);
  // (on the bench\u2019s questions alone a MAKE tool that fits was right 62 times in 63; on the first reviewer\u2019s 360 questions,
  // 50 in 65 -- "who painted the Mona Lisa" is not a drawing to make; a recipe card 74 in 78 on the bench, 21 in 28 on the
  // second reviewer\u2019s 300, written to catch the router out -- "how do I find north at night" is not a bearing between
  // two towns. Counted on all three, each is likely, not sure)
  ok("...a kind of evidence seen often and right is sure; one right less often is likely; a guess is neither", C.band(C.pct("card-one")) === "likely" && C.band(C.pct("puzzle")) === "sure" &&
    C.band(C.pct("make-one")) === "likely" && C.band(C.pct("lesson-other")) === "unsure" && C.band(C.pct("func")) === "unsure" &&
    C.band(C.pct("card-one", "9.3")) === "unsure" && C.band(C.pct("card-one", "5.2")) === "sure", [C.pct("card-one"), C.pct("puzzle"), C.pct("make-one"), C.pct("lesson-other"), C.pct("func"), C.pct("card-one", "9.3"), C.pct("card-one", "5.2")]);
  var right = items.filter(function (x) { var r = C.route(x.q); return r.band === "sure" && r.shelf; }), wrongSure = right.filter(function (x) { return x.shelf.indexOf(C.route(x.q).shelf) < 0; });
  ok("where Lantern says it is sure, it is right at least 9 times in 10 (" + (right.length - wrongSure.length) + " of " + right.length + ")", right.length >= 15 && wrongSure.length * 10 <= right.length,
    wrongSure.map(function (x) { return [x.q.slice(0, 60), C.route(x.q).shelf, x.shelf]; }));

  // --- OPEN ----------------------------------------------------------------------------------------------------------
  var OPEN = (L.chatCommands || []).filter(function (c) { return c.id === "open"; })[0];
  ok("OPEN is a Chat command", !!OPEN && OPEN.verb === "OPEN");
  ok("...read on a line of its own: OPEN 6.2, OPEN: 6.2, **OPEN 6.2**, OPEN shelf 6.2, OPEN 6", OPEN.test("OPEN 6.2") === "6.2" && OPEN.test("OPEN: 6.2") === "6.2" &&
    OPEN.test("**OPEN 6.2**") === "6.2" && OPEN.test("OPEN shelf 6.2") === "6.2" && OPEN.test("OPEN 6") === "6" && OPEN.test("Let me look.\nOPEN 6.1") === "6.1");
  ok("...not in a sentence, nor a longer number, nor a step that opens something", OPEN.test("I would open 6.2 first") === null && OPEN.test("OPEN 6.21") === null && OPEN.test("OPEN 12") === null &&
    OPEN.test("Open 2 windows to let the air in.") === null && OPEN.test("1. OPEN 3 valves slowly") === null && OPEN.test("OPEN 6.2 and read the lesson") === null);
  P.setMode("auto");
  ok("...and only with the library prompt", OPEN.test("OPEN 6.2") === null);
  P.setMode("library");
  var r1 = await OPEN.run("6.1", "What causes malaria?");
  ok("OPEN 6.1: the shelf\u2019s lessons nearest the question, as passages Chat checks", r1.how === "lessons" && r1.sources.length >= 1 && r1.sources[0].key === "health_malaria" &&
    r1.sources.every(function (s) { return C.shelfOf({ kind: "lesson", id: s.key, app: s.app }) === "6.1"; }) && /QUESTION: What causes malaria\?/.test(r1.prompt), r1.sources && r1.sources.map(function (s) { return s.key; }));
  var r2 = await OPEN.run("7.1", "How many hours will my battery run my fridge?");
  ok("OPEN 7.1 for a sum: its lessons first when it has them for the question", r2.how === "lessons" && r2.sources[0].key === "eng_battery", r2.sources && r2.sources.map(function (s) { return s.key; }));
  var r3 = await OPEN.run("7.3", "What length should my antenna be?");
  ok("OPEN 7.3: a shelf of functions gives them, with how to write a sum", /FUNCTIONS\nCONVERT/.test(r3.prompt) && /\nWAVELEN\(/.test(r3.prompt) && /STARTS with =/.test(r3.prompt) && !r3.sources, r3.prompt.slice(0, 300));
  var r4 = await OPEN.run("6", "Is it safe to eat eggs with cracked shells?");
  ok("OPEN 6: the class\u2019s shelves, each with what it holds, and how to choose", /^CLASS 6 health, food, water and farming/.test(r4.prompt) && /\n6\.2 food: cooking, keeping and eating well: /.test(r4.prompt) &&
    /Reply with only one line: OPEN and the number/.test(r4.prompt), r4.prompt.slice(0, 500));
  var r5 = await OPEN.run("9.9", "x"), r6 = await OPEN.run("0.2", "Who wrote Things Fall Apart?");
  ok("OPEN 9.9: no such shelf, said; OPEN 0.2 without the encyclopedia: the model\u2019s own knowledge, said so", /no shelf 9\.9/.test(r5.prompt) && /not on this computer/.test(r6.prompt), [r5.prompt.slice(0, 80), r6.prompt.slice(0, 120)]);

  // --- through Chat, with a stand-in model ------------------------------------------------------------------------------
  function item(id) { return (L.aiBenchQuestionsB || []).concat(L.aiBenchQuestions || []).filter(function (q) { return q.id === id; })[0]; }
  var sent = [];
  function model(msgs) {
    var last = textOf(msgs[msgs.length - 1].content);
    // (Chat puts its instructions in front of the messages itself, in callChat: the stand-in reads them as the server would)
    var sys = L.CHAT.buildSystem(curQ);
    sent.push({ sys: sys, last: last });
    if (/LESSONS: passages/.test(last)) {
      var m = /\[(\d)\][^\n]*\n[\s\S]*?(Never leave food that spoils out for more than 2 hours[^.]*\.)/.exec(last) || /\[(\d)\][^\n]*\n[\s\S]*?(Malaria[^.]{20,}\.)/.exec(last);
      return Promise.resolve(m ? m[2].replace(/\.$/, "") + " [" + m[1] + "].\nQUOTE [" + m[1] + "]: " + m[2] : "ANSWER: Not in my library.");
    }
    if (/you may reply with only one line: OPEN/.test(sys) && /malaria/.test(curQ) && !/LESSONS/.test(last)) return Promise.resolve("OPEN 6.1");
    return Promise.resolve("ANSWER: Not in my library.");
  }
  var rice = item("food-b-rice-left-out"), curQ = rice.turns[0];
  for (var mode of ["auto", "library"]) {
    P.setMode(mode); sent = [];
    var conv = await L.CHAT.converse(rice.turns, { call: model }), t = conv.turns[0], why = rice.check(conv.turns);
    ok("the cooked-rice row (" + mode + " prompt): the Food lesson goes with the question, and an answer from it passes", why === "" && t.searches.some(function (s) { return s.how === "lessons"; }) &&
      (t.sources || []).some(function (s) { return /^food_/.test(s.key); }) && sent.length === 1, { why: why, searches: t.searches, final: t.final, sent: sent.length });
  }
  // how long a food keeps: the Food tile\u2019s lesson, in every prompt; never a medicine, fuel, or a person going without
  var LS = (L.chatContext || []).filter(function (c) { return c.id === "lessons"; })[0];
  P.setMode("auto");
  var kq = { "How long can cooked rice be left out on the table before it is unsafe to eat?": /^food_/, "How long does cooked chicken keep without a fridge?": null,
    "How long can medicine be kept after the expiry date?": null, "How long does diesel keep in a tank?": null, "How long can you last without food?": null,
    "Is it safe to drink bleach?": null, "Is it safe to eat wild mushrooms?": null, "How long can ORS be kept after mixing?": null }, kbad = [];
  Object.keys(kq).forEach(function (q) { var r = LS.provide(q), first = r && r.sources[0].key; if (kq[q] ? !(first && kq[q].test(first)) : first && !/^food_/.test(first)) kbad.push([q, first]); });
  ok("how long a food keeps: a Food lesson or nothing; a medicine, diesel, a person without food, \u201csafe to drink bleach\u201d: nothing", kbad.length === 0 &&
    !L.suite.chat.howTo("How long can medicine be kept after the expiry date?") && !L.suite.chat.keeps("How long can medicine be kept after the expiry date?"), kbad);
  P.setMode("library"); sent = []; curQ = "What causes malaria?";
  var cm = await L.CHAT.converse(["What causes malaria?"], { call: model }), tm = cm.turns[0];
  ok("a model that chooses a shelf itself (OPEN 6.1 for malaria) gets the lesson Chat\u2019s sure reading finds on it, and its answer is checked against it",
    (tm.commands || []).some(function (c) { return c.verb === "OPEN" && c.arg === "6.1"; }) && tm.searches.some(function (s) { return s.how === "lessons"; }) && tm.backed >= 1 && /Malaria/.test(tm.final) && sent.length === 2,
    { commands: tm.commands, searches: tm.searches, final: tm.final, backed: tm.backed });
  // the library\u2019s own lesson provider: only where Lantern is sure
  var LP = (L.chatContext || []).filter(function (c) { return c.id === "library-shelf"; })[0];
  ok("the library\u2019s lesson provider gives nothing where Lantern is not sure (malaria is likely, not sure)", !!LP && LP.provide("What causes malaria?") === null);
  var keep = C.surety["lesson-other"], keep2 = C.surety["lesson-other@6.1"]; C.surety["lesson-other"] = [200, 200]; C.surety["lesson-other@6.1"] = [200, 200];
  var lp = LP.provide("What causes malaria?");
  ok("...and the shelf\u2019s lessons where it is (a surety of 200 in 200, for this test)", lp && lp.how === "lessons" && lp.sources[0].key === "health_malaria" && /opened shelf 6\.1/.test(lp.note) && /% of questions like this/.test(lp.note), lp && lp.note);
  C.surety["lesson-other"] = keep; C.surety["lesson-other@6.1"] = keep2;
  P.setMode("auto");
  ok("...and nothing with the usual prompt", LP.provide("What causes malaria?") === null);
  ok("no page errors", o.errs.length === 0, o.errs);

  // --- rule 11: the module dropped --------------------------------------------------------------------------------------
  var o2 = load(["LIBRARY_CATALOG"]), L2 = o2.L;
  L2.aiPrompt.setMode("library");
  ok("without LIBRARY_CATALOG: boot clean, no catalog, \u201clibrary\u201d is the automatic prompt, and Chat\u2019s and Assist\u2019s prompts are the automatic ones",
    o2.errs.length === 0 && !L2.catalog && L2.aiPrompt.active() !== "library" && !(L2.chatCommands || []).some(function (c) { return c.id === "open"; }) &&
    QS.every(function (q, i) { var b = L2.CHAT.buildSystem(q); return b === before[i][0]; }), o2.errs);

  console.log(fails ? fails + " CATALOG 1.24.38 FAILURES (" + (n - fails) + " passed)" : "ALL CATALOG 1.24.38 CHECKS PASS (" + n + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL threw: " + (e && e.stack || e)); process.exit(1); });
