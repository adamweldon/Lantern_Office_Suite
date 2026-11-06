// bench_1245_small.js -- the small models' runs of 1.24.5 on GitHub, replayed
// (1.24.6). The 2B passed 63 of 112 (56%, 102 minutes), the 4B 102 of 112
// (91%, 106 minutes) and the 0.8B 28 of 112 (25%, 64 minutes); their failed
// rows, as the models wrote them, are tests/fixtures/bench_run_1245_2b.json,
// _4b.json and _08b.json.
//
// What the rows showed, and what is replayed here:
//  - the 2B answered "ANSWER: Not in my library." to eleven sums Lantern has
//    a function or a recipe for (its instructions showed a decline, and how
//    to write one): the recipe's line goes back, or the question's numbers
//    (AI_NO_FORMULA), and the short instructions for a sum show no decline;
//  - a change of unit left out (grams asked in kg, a flow per minute asked
//    in hours) or put in where none belonged (kW x hours / 1000): the check
//    names it, with the line to write (AI_UNITS);
//  - "NEED: What is the radius of Earth in kilometres?" for a satellite's
//    period, with the recipe ({alt_km}+6371) in front of it: the answer is
//    the recipe's line, in the unit asked for (AI_NEED_RECIPE, and the
//    card fitted to the question);
//  - "from a 300 km orbit to a 35786 km orbit" (the 2B, the 4B; the 4B on
//    run 3 too): both heights put in as radii, then one mended. The card
//    given is the one for two heights, and what goes back says both, with
//    the line; HOHMANN (a speed) for a time is named too;
//  - a line that is a sentence ("= Molar mass of water is ...") is sent
//    back with the recipe;
//  - blocks Lantern can mend and say so: parts nobody wired or asked for in
//    a circuit, cards written "front: back", a column named by its symbol;
//  - "My hens have stopped laying eggs. What could be wrong?": Chat reads
//    the lesson itself, and shows it when the AI's answer does not use it;
//  - the 4B: "LESSON: <a title>" as a heading over an answer, a wheel
//    written "Part: name | item | item", LESSON for a tune (nothing is found,
//    and the block is asked for), a part that doubles the tune;
//  - the 0.8B: thirty replies that copied the instructions' own words ("=
//    (evaluated in order; ANS ...", "ANS1"): what it is shown now has
//    neither.
// Left failing, and said so below: a puzzle the model got wrong, a roof
// drawn as a square, a program whose logic is wrong, formulas on the wheel
// that are wrong, and the 0.8B's "NEED:" followed by a sum of its own.
// Where Lantern sends something back, the reply that comes back is
// SCRIPTED: no model has run these changes.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8")); }
var R2 = fixture("bench_run_1245_2b.json"), R4 = fixture("bench_run_1245_4b.json"), R8 = fixture("bench_run_1245_08b.json");
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
    return Promise.resolve({ ok: status < 400, status: status, statusText: "OK", headers: { get: function () { return type; } },
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
    return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
  };
  w.eval(js);
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1600)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function row(R, id) { return R.rows.filter(function (r) { return r.id === id; })[0]; }
// a model that replies with each of list in turn (the last again after it); seen gets what it was sent
function seq(list, seen) {
  var i = 0;
  return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return textOf(m.content); })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); };
}
function lastOf(seen, k) { var s = seen[k]; return s ? s[s.length - 1] : ""; }

(async function () {
  // =====================================================================================================
  // The 2B
  // =====================================================================================================
  var o = load("Qwen3.5-2B-Q4_K_M.gguf"), L = o.L;
  await sleep(80);
  await L.ai.detect();
  var B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct, A = L.assist, P = L.aiPrompt;
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }
  function right(it) { return "=" + it.x + "\nANSWER: It is {result}."; }
  ok("boot clean, with a 2B on the kit\u2019s server (a small model: the short prompt)", o.errs.length === 0 && /2B/.test(L.ai.server.label || "") && P.active() === "short", [o.errs, L.ai.server.label, P.active()]);
  ok("the fixtures: the 2B passed 63 of 112 on 1.24.5 (49 failed rows), the 4B 102 (10), the 0.8B 28 (84)", R2.summary.pass === 63 && R2.summary.n === 112 && R2.rows.length === 49 &&
    R4.summary.pass === 102 && R4.summary.n === 112 && R4.rows.length === 10 && R8.summary.pass === 28 && R8.summary.n === 112 && R8.rows.length === 84);

  // --- a decline where Lantern has the sum -----------------------------------------------------------------
  var declined = R2.rows.filter(function (r) { return /^(tool|multi)$/.test(r.cat) && r.why === "no formula"; });
  ok("the fixture: eleven sums answered \u201cANSWER: Not in my library.\u201d and nothing else", declined.length === 11 && declined.every(function (r) { return r.reply === "ANSWER: Not in my library."; }),
    declined.map(function (r) { return r.id; }));
  var sums = R2.rows.filter(function (r) { return /^(tool|multi)$/.test(r.cat); }), kinds = {}, notFixed = [], i;
  for (i = 0; i < sums.length; i++) {
    var r = sums[i], it = item(r.id), seen = [];
    var out = await A.solve(it.q, { call: seq([r.first || r.reply, right(it)], seen) }), g = B.grade(it, out.text, out);
    kinds[r.id] = out.noFormula || out.kind || (out.needAnswered ? "need" : "-");
    if (!g.pass || out.rounds !== 2) notFixed.push([r.id, out.rounds, g.why]);
  }
  ok("each of the 2B\u2019s twenty failed sums now gets something back, and passes with a right second reply (scripted)", sums.length === 20 && notFixed.length === 0, notFixed);
  var cardBack = declined.filter(function (r) { return kinds[r.id] === "card"; }).map(function (r) { return r.id; });
  ok("ten of the declines get the recipe\u2019s line, and the pump\u2019s amp-hours (no recipe) the question\u2019s numbers", cardBack.join() === "mars-escape,miles-km,f-to-c,escape,plants,kg-lb,maize-bags,jerrycans,egg-dozens,place-bearing" &&
    kinds["pump-ah"] === "numbers", kinds);
  var pl = item("plants"), seenP = [];
  await A.solve(pl.q, { call: seq(["ANSWER: Not in my library.", right(pl)], seenP) });
  // (1.24.7: with the question's numbers in it, where each blank's unit names its number; with its blanks where it does not)
  var mzq = item("maize-bags").q, seenM = [];
  await A.solve(mzq, { call: seq(["ANSWER: Not in my library.", right(item("maize-bags"))], seenM) });
  var edq = item("egg-dozens").q, seenE = [];
  await A.solve(edq, { call: seq(["ANSWER: Not in my library.", right(item("egg-dozens"))], seenE) });
  ok("...the recipe as it goes back: what it is for and its line -- with the question\u2019s numbers in it where Lantern can be sure which goes where (10 m, 1.2 m, 30 cm; 2 tonnes in 50 kg bags), with its blanks and what goes in each where it cannot (3 dozen: a number in words)",
    lastOf(seenP, 1).indexOf("Lantern can work this out: it has a recipe for it.\n") === 0 &&
    /\n=PLANTS\x2810,1\.2,30\x29\nThat is the recipe with the question\u2019s numbers in it\. Reply with that = line as it stands, then a line ANSWER: /.test(lastOf(seenP, 1)) &&
    /\n=CEIL\x282000\/50\x29\nThat is the recipe with the question\u2019s numbers in it\. Reply with that = line as it stands, then a line ANSWER: /.test(lastOf(seenM, 1)) &&
    /\n=\{price\}\*\{qty\}\nReply with that = line, with the question\u2019s values in place of each \{name\} \x28price; qty\x29, then a line ANSWER: /.test(lastOf(seenE, 1)),
    [lastOf(seenP, 1), lastOf(seenM, 1), lastOf(seenE, 1)]);
  var pa = item("pump-ah"), seenA = [];
  await A.solve(pa.q, { call: seq(["ANSWER: Not in my library.", right(pa)], seenA) });
  ok("...and the numbers: \u201cThe question gives numbers (12 V; 5 A; 3 hours): if they make a sum, Lantern works it out\u201d, with NEED still open", /^The question gives numbers \x2812 V; 5 A; 3 hours\x29: if they make a sum, Lantern works it out\.\n/.test(lastOf(seenA, 1)) &&
    /If a number the sum needs is missing, reply NEED: /.test(lastOf(seenA, 1)), lastOf(seenA, 1));
  var shown = declined.map(function (r) { var q = item(r.id).q; return [r.id, A.buildPrompt(q, A.match(q))]; });
  ok("what the 2B is shown for those eleven questions has no decline in it, and no NEED where the question fills the recipe", shown.every(function (x) { return !/Not in my library/.test(x[1]); }) &&
    shown.filter(function (x) { return /NEED/.test(x[1]); }).map(function (x) { return x[0]; }).join() === "", shown.filter(function (x) { return /Not in my library|NEED/.test(x[1]); }).map(function (x) { return x[0]; }));
  ok("...a question that is not a sum is still shown how to decline, and a decline of it is left alone", /Not in my library/.test(A.buildPrompt("Who is the mayor of my town right now?", [])) &&
    L.aiNoFormula("What will the price of rice be next month?", "ANSWER: Not in my library.", A.parseReply("ANSWER: Not in my library."), []) === null);

  // --- a change of unit ------------------------------------------------------------------------------------
  var fd = row(R2, "feed"), tf = row(R2, "tank-fill"), hk = row(R2, "heater-kwh");
  ok("the fixture: =800*30*20 for kg, =2000/15 for hours, =2*3*30/1000 for a heater in kW", /^=800\*30\*20\n/.test(fd.reply) && /^=2000\/15\n/.test(fd.reply.replace(/[\s\S]*/, tf.reply)) && /^=2\*3\*30\/1000\n/.test(hk.reply));
  async function back(id, first) { var it2 = item(id), s2 = []; var o2 = await A.solve(it2.q, { call: seq([first, right(it2)], s2) }); return { out: o2, text: lastOf(s2, 1), g: B.grade(it2, o2.text, o2) }; }
  var b1 = await back("feed", fd.reply), b2 = await back("tank-fill", tf.reply), b3 = await back("heater-kwh", hk.reply);
  ok("grams asked in kg: named, with the line to write", /the question gives g and asks for kg \x281000 g = 1 kg\x29, but the sum has no change of unit: divide by 1000 \x28=800\*30\*20\/1000\x29/.test(b1.text) && b1.g.pass, b1.text);
  ok("a flow per minute asked in hours: named, with the line", /the question gives a rate per minute and asks for hours \x2860 minutes = 1 hour\x29, but the sum has no change of unit: divide by 60 \x28=2000\/15\/60\x29/.test(b2.text) && b2.g.pass, b2.text);
  ok("kW x hours divided by 1000: named, with the line", /the question gives kW and asks for kWh: kW x hours is kWh already, but the sum uses 1000: write =2\*3\*30/.test(b3.text) && b3.g.pass, b3.text);
  var hq = item("heater-kwh").q;
  ok("...and said with the question, before any reply: \u201cno change of unit is needed (no /1000)\u201d", /\nUnits: the question gives kW and asks for kWh: kW x hours is kWh already, so no change of unit is needed \x28no \/1000\x29\.$/.test(A.buildPrompt(hq, A.match(hq))), A.buildPrompt(hq, A.match(hq)).slice(-260));

  // --- a NEED for a number the recipe has in it ------------------------------------------------------------
  var o420 = row(R2, "orbit-420"), geo = row(R2, "geo-period"), i420 = item("orbit-420"), igeo = item("geo-period");
  ok("the fixture: \u201cNEED: What is the radius of (the) Earth in kilometres?\u201d, twice each", o420.first === "NEED: What is the radius of Earth in kilometres?" && o420.reply === o420.first &&
    geo.first === "NEED: What is the radius of the Earth in kilometres?" && geo.reply === geo.first);
  var s420 = [], out420 = await A.solve(i420.q, { call: seq([o420.first, "=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60\nANSWER: One orbit takes {result} minutes."], s420) });
  ok("the answer is the recipe\u2019s line and what goes in its blank; with it filled in, the question passes", /^Lantern has that number, and the recipe for this question has it in already\.\n/.test(lastOf(s420, 1)) &&
    /\n=ORBITT\x28CONVERT\x28420\+6371,\x22km\x22,\x22m\x22\x29\x29\/60\nNow reply with that = line as it stands \x28it is the recipe with the question\u2019s numbers in it\x29/.test(lastOf(s420, 1)) &&
    B.grade(i420, out420.text, out420).pass && out420.rounds === 2, [lastOf(s420, 1), out420.rounds]);
  var sgeo = [], outgeo = await A.solve(igeo.q, { call: seq([geo.first, "=ORBITT(CONVERT(35786+6371,\"km\",\"m\"))/3600\nANSWER: One orbit takes {result} hours."], sgeo) });
  ok("...in hours where hours are asked: the recipe ends /3600 there, not /60 (the card fitted to the question)", /\n=ORBITT\x28CONVERT\x2835786\+6371,\x22km\x22,\x22m\x22\x29\x29\/3600\n/.test(lastOf(sgeo, 1)) &&
    B.grade(igeo, outgeo.text, outgeo).pass && A.match(igeo.q)[0].out === "hours per orbit" && A.match(i420.q)[0].out === "minutes per orbit" &&
    /\x2F86400$/.test(A.match("How many days does the ISS take to orbit Earth at 420 km altitude?")[0].compose), [lastOf(sgeo, 1), A.match(igeo.q)[0]]);
  ok("...the card on Lantern\u2019s own list is not changed by that", L.assistCards.filter(function (c) { return c.id === "orbit-period"; })[0].compose === "=ORBITT(CONVERT({alt_km}+6371,\"km\",\"m\"))/60");
  ok("a NEED for a figure no recipe of the question has is answered with the figure, as before; one for the person\u2019s own number goes to the person",
    /^Lantern: Earth\u2019s radius is 6\.371e6 m: =PLANET/.test(L.aiNeedAnswer("What is the radius of the Earth?", "How deep is a well that reaches the centre of the Earth?") || "") &&
    L.aiNeedAnswer("How many amp-hours does your battery hold?", "How many hours will my battery run a 60 W light?") === null && L.aiNeedRecipe("How many goats do you have?", item("feed").q) === null);

  // --- two heights -----------------------------------------------------------------------------------------
  var h2 = row(R2, "hohmann-alt2"), h4 = row(R4, "hohmann-alt2"), ih = item("hohmann-alt2");
  var LINE = "=HOHMANNT(CONVERT(300+6371,\"km\",\"m\"),CONVERT(35786+6371,\"km\",\"m\"))/3600";
  ok("the fixture: both models put both heights in as radii, were told 300 km is inside the Earth, and mended the 300 only (the 2B with HOHMANN, a speed)",
    h4.first === "=HOHMANNT(CONVERT(300,\"km\",\"m\"),CONVERT(35786,\"km\",\"m\"))/3600\nANSWER: The Hohmann transfer takes {result} hours." &&
    /^=HOHMANNT\x28CONVERT\x28300\+6371,\x22km\x22,\x22m\x22\x29,CONVERT\x2835786,\x22km\x22,\x22m\x22\x29\x29\/3600\n/.test(h4.reply) && /^=HOHMANN\x28CONVERT\x28300,/.test(h2.first) && /^=HOHMANN\x28CONVERT\x28300\+6371,\x22km\x22,\x22m\x22\x29,CONVERT\x2835786,/.test(h2.reply));
  function ids(q) { return A.match(q).map(function (c) { return c.id; }).join(); }
  ok("the recipe given is the one whose blanks are what the question has: two heights, one height and a radius, two radii",
    ids(ih.q) === "hohmann-alts" && ids(item("hohmann-geo").q) === "hohmann-alt" && ids("How long does a transfer take from an orbit of radius 7000 km to one of radius 42164 km?") === "hohmann-time" &&
    ids("How much delta-v does a Hohmann transfer need from a 300 km orbit to a 35786 km orbit?") === "hohmann-dv-alts" &&
    ids("How much delta-v to raise an orbit from 400 km altitude to geostationary (42164 km radius)?") === "hohmann-dv-alt" &&
    ids("What delta-v is needed to go from a radius of 6771 km to a radius of 42164 km?") === "hohmann-dv",
    [ids(ih.q), ids(item("hohmann-geo").q), ids("How long does a transfer take from an orbit of radius 7000 km to one of radius 42164 km?"), ids("How much delta-v does a Hohmann transfer need from a 300 km orbit to a 35786 km orbit?")]);
  var hp = A.buildPrompt(ih.q, A.match(ih.q));
  ok("...so what there is to copy is right: {alt1_km}+6371 and {alt2_km}+6371", /\nRECIPE\n- [^\n]+\n  needs: alt1_km in km; alt2_km in km\n  =HOHMANNT\x28CONVERT\x28\{alt1_km\}\+6371,\x22km\x22,\x22m\x22\x29,CONVERT\x28\{alt2_km\}\+6371,\x22km\x22,\x22m\x22\x29\x29\/3600 /.test(hp) &&
    !/\{r2_km\}/.test(hp), hp.slice(-700));
  var s4 = [], out4 = await A.solve(ih.q, { call: seq([h4.first, LINE + "\nANSWER: The transfer takes {result} hours."], s4) });
  ok("the 4B\u2019s first line as it wrote it: what goes back says it of both heights, with the line; with that line the question passes",
    /radius 300 km is inside the Earth[^\n]*\x29\. Each of 300 km and 35786 km is a height above the surface: add 6371 km to every one\. Write =HOHMANNT\x28CONVERT\x28300\+6371,\x22km\x22,\x22m\x22\x29,CONVERT\x2835786\+6371,\x22km\x22,\x22m\x22\x29\x29\/3600\n/.test(lastOf(s4, 1)) &&
    out4.kind === "rejected" && B.grade(ih, out4.text, out4).pass, [lastOf(s4, 1), B.grade(ih, out4.text, out4).why]);
  var s2b = [], out2b = await A.solve(ih.q, { call: seq([h2.first, LINE + "\nANSWER: The transfer takes {result} hours."], s2b) });
  ok("the 2B\u2019s (HOHMANN): the same, and that HOHMANN gives a speed where a time is asked: one line to write, HOHMANNT with both heights mended",
    /Each of 300 km and 35786 km is a height above the surface: add 6371 km to every one\. HOHMANN gives a speed and the question asks how long: the time is HOHMANNT\. Write =HOHMANNT\x28CONVERT\x28300\+6371,/.test(lastOf(s2b, 1)) &&
    (lastOf(s2b, 1).match(/Write =/g) || []).length === 1 && B.grade(ih, out2b.text, out2b).pass, lastOf(s2b, 1));
  var s2c = [], out2c = await A.solve(ih.q, { call: seq([h2.reply, LINE + "\nANSWER: The transfer takes {result} hours."], s2c) });
  ok("a line that runs and is wrong (the 2B\u2019s second, the 4B\u2019s second) is questioned: the height left as a radius, and the speed, with the one line",
    /35786 km is a height above the surface in the question, but the formula uses it as a radius[^;]*; HOHMANN gives a speed in m\/s \x28the delta-v of the transfer\x29 and the question asks how long: the time is HOHMANNT, in seconds: write =HOHMANNT\x28CONVERT\x28300\+6371,\x22km\x22,\x22m\x22\x29,CONVERT\x2835786\+6371,/.test(lastOf(s2c, 1)) &&
    (lastOf(s2c, 1).match(/write =/g) || []).length === 1 && out2c.kind === "questioned" &&
    /35786 km is a height[\s\S]*: write =HOHMANNT\x28CONVERT\x28300\+6371,\x22km\x22,\x22m\x22\x29,CONVERT\x2835786\+6371,\x22km\x22,\x22m\x22\x29\x29\/3600/.test(L.assistChecks.map(function (c) { return c(ih.q, A.parseReply(h4.reply).exprText, A.run(A.parseReply(h4.reply).exprText), {}); }).filter(Boolean).join("; ")),
    lastOf(s2c, 1));
  var K = L.aiChecks;
  ok("a speed is questioned only where the whole line is the speed: a period worked out from ORBITV, a speed asked for, and delta-v are left alone",
    K.speedForTime("How long does a satellite take to orbit Earth at 420 km altitude, in minutes?", "=ORBITV(CONVERT(420+6371,\"km\",\"m\"))/60").want === "ORBITT" &&
    K.speedForTime("How long does a satellite take to orbit Earth at 420 km altitude, in minutes?", "=2*PI()*CONVERT(420+6371,\"km\",\"m\")/ORBITV(CONVERT(420+6371,\"km\",\"m\"))/60") === null &&
    K.speedForTime("How fast does a satellite move at 420 km altitude?", "=ORBITV(CONVERT(420+6371,\"km\",\"m\"))") === null &&
    K.speedForTime("How much delta-v does a Hohmann transfer need from a 300 km orbit to a 35786 km orbit?", "=HOHMANN(CONVERT(300+6371,\"km\",\"m\"),CONVERT(35786+6371,\"km\",\"m\"))") === null &&
    K.mended(ih.q, LINE) === "");

  // --- a sentence where the sum goes -----------------------------------------------------------------------
  var wm = row(R2, "water-molar"), sw = [], iw = item("water-molar");
  var outw = await A.solve(iw.q, { call: seq([wm.first, right(iw)], sw) });
  ok("\u201c= Molar mass of water is 18.01528 g/mol\u201d: sent back with the recipe\u2019s line", wm.first.indexOf("= Molar mass of water is 18.01528 g/mol\n") === 0 &&
    /Lantern could not run = Molar mass of water is 18\.01528 g\/mol \x28[^\x29]+\x29\. Lantern has a recipe for this question, here with its numbers in: write =MOLARMASS\x28\x22H2O\x22\x29\n/.test(lastOf(sw, 1)) &&
    B.grade(iw, outw.text, outw).pass, lastOf(sw, 1));
  var rp = row(R2, "rice-price"), irp = item("rice-price"), srp = [], outrp = await A.solve(irp.q, { call: seq([rp.reply, "ANSWER: Not in my library."], srp) });
  ok("left as it is: a NEED where the question is not a sum at all (the price of rice next month) goes to the person, and the bench fails it", srp.length === 1 && !B.grade(irp, outrp.text, outrp).pass, [srp.length, outrp.text]);

  // --- blocks Lantern mends, and says so -------------------------------------------------------------------
  async function make(R, id, list) { var it3 = item(id), s3 = []; var o3 = await act.solve(it3.q, seq(list || [row(R, id).first || row(R, id).reply, row(R, id).reply], s3)); return { out: o3, g: B.grade(it3, o3.text, o3), seen: s3 }; }
  var m1 = await make(R2, "make-lamp-circuit"), m2 = await make(R2, "make-control"), m3 = await make(R2, "make-temperatures"), m4 = await make(R2, "make-cards-si-units");
  ok("a lamp circuit with a resistor, a capacitor, an inductor and a diode nobody wired or asked for: they are left out, and said; it passes the first time",
    m1.g.pass && m1.out.rounds === 1 && /Lantern left out R1 \x28resistor\x29, C1 \x28capacitor\x29, L2 \x28inductor\x29, D1 \x28diode\x29: nothing is wired to them and the question does not ask for them/.test(m1.out.made.summary), [m1.g.why, m1.out.made && m1.out.made.summary]);
  ok("the sump pump\u2019s control circuit passes the first time", m2.g.pass && m2.out.rounds === 1, [m2.g.why, m2.out.made && m2.out.made.summary]);
  ok("=C*1.8+32 under a header \u201cCelsius (C)\u201d: C is read as that column, and said", m3.g.pass && m3.out.rounds === 1 && /Lantern read C in the formulas as the column \u201cCelsius \x28C\x29\u201d/.test(m3.out.made.summary), [m3.g.why, m3.out.made && m3.out.made.summary]);
  ok("cards written \u201cfront: back\u201d: read as cards, and said", m4.g.pass && m4.out.rounds === 1 && /Lantern read 7 lines written \u201cfront: back\u201d as cards/.test(m4.out.made.summary), [m4.g.why, m4.out.made && m4.out.made.summary]);
  var ode = row(R2, "make-music-ode"), bs = act.find(ode.reply);
  ok("the guide\u2019s own explanations copied after the lines (\u201ckey C major   the key; a plain ...\u201d) are taken off before the block is read",
    /^key C major {3,}the key; /m.test(ode.reply) && bs.length === 1 && bs[0].uncommented >= 3 && bs[0].lines.some(function (l) { return l === "key C major"; }), [bs[0] && bs[0].lines.slice(0, 5), bs[0] && bs[0].uncommented]);
  var m5 = await make(R2, "make-sunset-house", [row(R2, "make-sunset-house").reply, row(R2, "make-sunset-house").reply.replace("rect 0 0 20 12 fill sky", "rect 0 0 20 12 fill orange")]);
  ok("a sunset under \u201cfill sky\u201d goes back with the line to write", /the question says sunset, and the sky \x28\u201crect 0 0 20 12 fill sky\u201d\x29 is the blue of day: write rect 0 0 20 12 fill orange/.test(lastOf(m5.seen, 1)), lastOf(m5.seen, 1).slice(0, 400));
  var po = row(R2, "make-parallel-ohm"), ipo = item("make-parallel-ohm");
  var mp = await make(R2, "make-parallel-ohm", [po.reply, po.reply.replace(/note [^\n]*\n/, "note 1/Rt = 1/R1 + 1/R2 + 1/R3 = 1/4 + 1/6 + 1/12, so Rt = 2 ohm\n")]);
  ok("a note copied from Lantern\u2019s own request for one (\u201c{=100*200/(100+200)} ohm\u201d under 4, 6 and 12 ohm): it goes back with the circuit\u2019s total and the line to write, and that line passes",
    /note Rt = R1 x R2 \/ \x28R1 \+ R2\x29 = \{=100\*200\/\x28100\+200\x29\} ohm/.test(po.reply) && mp.out.rounds === 2 && mp.g.pass &&
    /the note\u2019s sum uses 100 and 200, which are not values of this circuit, and shows 66\.67 ohm: its resistors \x284, 6 and 12 ohm in parallel\x29 come to 2 ohm\. Write the note line as: note 1\/Rt = 1\/R1 \+ 1\/R2 \+ 1\/R3 = 1\/4 \+ 1\/6 \+ 1\/12, so Rt = 2 ohm/.test(lastOf(mp.seen, 1)),
    [mp.out.rounds, mp.g.why, lastOf(mp.seen, 1).slice(0, 500)]);
  var mp1 = await make(R2, "make-parallel-ohm", [po.reply.replace(/note [^\n]*\n/, "")]);
  ok("the same circuit with no note at all: Lantern works the total out from the values on the parts, adds the note, and says so; it passes the first time",
    mp1.out.rounds === 1 && mp1.g.pass && /Lantern added the note with the total \x284, 6 and 12 ohm in parallel make 2 ohm\x29, worked out from the values on the parts/.test(mp1.out.made.summary) &&
    mp1.out.made.plan.notes[0] === "1/Rt = 1/R1 + 1/R2 + 1/R3 = 1/4 + 1/6 + 1/12, so Rt = 2 ohm",
    [mp1.out.rounds, mp1.g.why, mp1.out.made && mp1.out.made.summary]);
  function sch(block, q) { var m0 = act.fromReply(block, q); return m0 ? (m0.ok ? "OK " + (m0.plan.notes || []).join(" / ") : m0.problems.join("; ")) : "no block"; }
  var SER = "MAKE SCHEMATIC: Series\npart B1 battery \"9 V\"\npart S1 switch\npart R1 resistor \"100 ohm\"\npart R2 resistor \"220 ohm\"\npart R3 resistor \"4.7k\"\nwire B1 S1\nwire S1 R1\nwire R1 R2\nwire R2 R3\nwire R3 B1\nEND";
  ok("...in series too, a switch in the line counting as wire (100 + 220 + 4700 = 5020 ohm); nothing is added where no total is asked for, where the note has it, or where the circuit is more than Lantern can add up",
    sch(SER, "Draw three resistors in series with a switch and a 9 V battery, and show the total resistance.") === "OK Rt = R1 + R2 + R3 = 100 + 220 + 4700 = 5020 ohm" &&
    sch(SER, "Draw three resistors in series with a switch and a 9 V battery.") === "OK " &&
    sch(ipo.ideal, ipo.q) === "OK 1/Rt = 1/4 + 1/6 + 1/12, so Rt = 2 ohm" &&
    /^the person asked for the formula on the drawing: add a note line/.test(sch(SER.replace("wire R3 B1", "part R4 resistor \"1k\"\nwire R3 B1\nwire R2 R4\nwire R4 B1"), "Draw the circuit and show the total resistance.")) &&
    !/100\*200/.test(sch(SER.replace("wire R3 B1", "part R4 resistor \"1k\"\nwire R3 B1\nwire R2 R4\nwire R4 B1"), "Draw the circuit and show the total resistance.")),
    [sch(SER, "Draw three resistors in series with a switch and a 9 V battery, and show the total resistance."), sch(SER, "Draw three resistors in series with a switch and a 9 V battery."), sch(ipo.ideal, ipo.q),
      sch(SER.replace("wire R3 B1", "part R4 resistor \"1k\"\nwire R3 B1\nwire R2 R4\nwire R4 B1"), "Draw the circuit and show the total resistance.")]);
  var el5 = row(R2, "make-electronics"), el4 = row(fixture("bench_run_1244_2b.json"), "make-electronics"), iel = item("make-electronics");
  var me = await make(R2, "make-electronics", [el5.first, el5.first.replace("switch S1 P1", "switch S1 P2")]);
  ok("the guide\u2019s two pins and its button copied into a relay driver, the button and the transistor both on P1: the pin with two jobs is named, with the line to write (the button on the pin that is free); with that line the circuit passes",
    /pin P1 \x22D2 input\x22\npin P2 \x22D13\x22\nswitch S1 P1\n/.test(el5.first) && /transistor Q1 K1 P1/.test(el5.first) && me.out.rounds === 2 && me.g.pass &&
    /P1 both drives Q1 and reads S1: a pin is an output or an input, not both\. P2 has nothing on it: write switch S1 P2/.test(lastOf(me.seen, 1)) && !/P2 drives or reads nothing/.test(lastOf(me.seen, 1)),
    [me.out.rounds, me.g.why, lastOf(me.seen, 1).slice(0, 400)]);
  ok("...told only that P2 had nothing on it, the 2B had moved both to P2: that goes back the same way; with no pin free, the button is given a pin of its own or left out",
    /P2 both drives Q1 and reads S1: [^\n]* P1 has nothing on it: write switch S1 P1/.test((act.fromReply(el5.reply + "\nEND", iel.q).problems || []).join("\n")) &&
    /P1 both drives D1 and reads S1: a pin is an output or an input, not both\. Give S1 a pin of its own \x28pin P2 \x22Arduino D2\x22 and switch S1 P2\x29, or leave S1\u2019s line out/.test(
      (act.fromReply("MAKE ELECTRONICS: X\npin P1 \"D7\"\nswitch S1 P1\nled D1 P1\nEND", "Draw a button and an LED on an Arduino.").problems || []).join("\n")),
    [act.fromReply(el5.reply + "\nEND", iel.q).problems]);
  var me4 = await make(R2, "make-electronics", [el4.first]);
  ok("\u201cswitch S1 P2\u201d with only P1 declared (the 2B on 1.24.4, told to \u201cname the pin that reads it\u201d): the pin is added, and said; the button on a 5 V pin reads 5 V, whatever the supply",
    /\nswitch S1 P2\n/.test(el4.first) && !/pin P2/.test(el4.first) && me4.out.rounds === 1 && me4.g.pass && /Lantern added pin P2, which S1\u2019s line names/.test(me4.out.made.summary) &&
    /P2 reads 5 V while S1 is pressed, 0 V when it is let go/.test(me4.out.made.summary) && !/reads 12 V/.test(me4.out.made.summary), [me4.out.rounds, me4.g.why, me4.out.made && me4.out.made.summary]);
  var bl = row(R2, "code-blink-millis"), ibl = item("code-blink-millis"), gbl = act.prompt(ibl.q);
  ok("\u201c... blinks the LED on pin 13 every half second without using delay()\u201d: the tested example given to start from is Blink without delay (it was Blink -- delay(1000), twice -- which the 2B turned into delayMicroseconds(500)); a plain blink still gets Blink",
    /delayMicroseconds\x28500\x29;/.test(bl.reply) && /\nTested example 1: Blink without delay \x28millis timing\x29 /.test(gbl) && /millis\x28\x29/.test(gbl) &&
    /\nTested example 1: Blink \x28Arduino/.test(act.prompt("Write an Arduino sketch that blinks the LED on pin 13 every second.")), gbl.slice(gbl.indexOf("Tested example"), gbl.indexOf("Tested example") + 200));
  var mb = await make(R2, "code-blink-millis", [bl.reply, ibl.ideal]);
  ok("...and a sketch that waits in a delay where the question says without goes back, with the lines that time it with millis() and the half second as 500",
    mb.out.rounds === 2 && mb.g.pass && /line 8 calls delayMicroseconds\x28\x29, and the question says without delay\x28\x29: the sketch stands still there\. Time it with millis\x28\x29 instead: unsigned long last = 0; above setup\x28\x29, and in loop\x28\x29: if \x28millis\x28\x29 - last >= 500\x29/.test(lastOf(mb.seen, 1)) &&
    act.fromReply("MAKE CODE: Blink\nlanguage arduino\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\nEND", "Write an Arduino sketch that blinks the LED on pin 13 every second.").ok === true,
    [mb.out.rounds, mb.g.why, lastOf(mb.seen, 1).slice(0, 500)]);
  var tk = row(R2, "code-st-tank-fill"), itk = item("code-st-tank-fill");
  var mt = await make(R2, "code-st-tank-fill", [tk.reply, tk.reply.replace("FillValve := LowFloat;\n", "").replace("FillValve := NOT HighFloat;", "FillValve := (LowFloat OR FillValve) AND NOT HighFloat;")]);
  ok("\u201cFillValve := LowFloat;\u201d and then \u201cFillValve := NOT HighFloat;\u201d: the second replaces the first, so nothing holds the valve open between the floats -- it goes back with the one line that does, and passes with it",
    /FillValve := LowFloat;\n/.test(tk.reply) && /FillValve := NOT HighFloat;/.test(tk.reply) && mt.out.rounds === 2 && mt.g.pass &&
    /FillValve is given a value twice \x28:= LowFloat, then := NOT HighFloat\x29: each := replaces the one before on every scan[^\n]*Write one line in their place: FillValve := \x28LowFloat OR FillValve\x29 AND NOT HighFloat;/.test(lastOf(mt.seen, 1)),
    [mt.out.rounds, mt.g.why, lastOf(mt.seen, 1).slice(0, 600)]);
  var left = [];
  for (i = 0; i < R2.rows.length; i++) {
    var rr = R2.rows[i];
    if (rr.cat !== "make" || /^(make-lamp-circuit|make-control|make-temperatures|make-cards-si-units|make-sunset-house)$/.test(rr.id)) continue;
    var mm = await make(R2, rr.id);
    if (!mm.g.pass) left.push(rr.id);
  }
  ok("left failing, as the 2B wrote them (wrong formulas on the wheel, no 2 ohm total, a pin that drives nothing, a drawing that ran away, programs, a song with no notes)",
    left.join() === "make-power-wheel,make-parallel-ohm,make-electronics,make-house,code-blink-millis,code-p1am-seal-in,code-st-tank-fill,make-music-ode,make-music-orchestra", left);

  // --- what could be wrong? --------------------------------------------------------------------------------
  var hens = row(R2, "suite-asks-for-lesson"), ihens = item("suite-asks-for-lesson"), S = L.suite;
  ok("the fixture: no lesson was read for \u201cMy hens have stopped laying eggs. What could be wrong?\u201d, and the 2B answered from its own knowledge", !hens.chat[0].searches && /^From my own knowledge:/.test(hens.reply));
  function read(q) { return S.chat.howTo(q) ? S.passages(q, q, { detail: true, max: 3, strong: true }).map(function (x) { return x.title; }) : []; }
  var TROUBLES = ["My hens have stopped laying eggs. What could be wrong?", "My goat is limping. What could be wrong?", "Why are my tomato leaves turning yellow?", "Why won\u2019t my engine start?", "My bicycle chain keeps slipping. What could be wrong?"];
  var NOT = ["Why is the sky blue?", "Why did the Roman Empire fall?", "Why is my brother angry with me?", "What could be wrong with the government?", "Why don\u2019t my friends call me?"];
  ok("a question about what is wrong with the person\u2019s own things is one Lantern looks in its lessons for, by itself (the hens get Chickens & eggs); a why about the world or about people is given no lesson",
    TROUBLES.every(function (q) { return S.chat.howTo(q); }) && /^Chickens & eggs/.test(read(TROUBLES[0])[0] || "") && !S.chat.howTo(NOT[0]) && !S.chat.howTo(NOT[1]) &&
    NOT.every(function (q) { return read(q).length === 0; }), [TROUBLES.map(function (q) { return [S.chat.howTo(q), read(q)]; }), NOT.map(function (q) { return read(q); })]);
  var nodes = [], ui = { node: function (fn) { var e = fn(); if (e) nodes.push(e); } };
  o.script = function () { return hens.reply; };
  var th = await L.CHAT.turn([], ihens.turns[0], ui, {});
  var box = nodes.filter(function (n) { return /la-lesson-shown/.test(n.className || ""); })[0];
  ok("Chat reads Chickens & eggs itself; the 2B\u2019s answer as it wrote it does not use it, so the lesson\u2019s own words are shown under it (the bench still fails the answer)",
    (th.sources || []).some(function (s) { return /^Chickens & eggs/.test(s.title); }) && th.lessonShown && !!box &&
    /^The AI\u2019s answer does not use the lesson Lantern gave it\. This is what Lantern\u2019s own lesson says:/.test(box.textContent) && /Chickens & eggs/.test(box.textContent) &&
    !!ihens.check([th]), [th.sources && th.sources.map(function (s) { return s.title; }), th.lessonShown, box && box.textContent.slice(0, 200), ihens.check([th])]);
  var p1 = th.sources[0].text.split("\n").filter(function (l) { return /[.]$/.test(l) && l.length > 40; })[0], s1 = p1.split(/(?<=[.])\s/)[0];
  nodes = [];
  o.script = function () { return s1 + " [1]\nQUOTE [1]: " + s1; };
  var th2 = await L.CHAT.turn([], ihens.turns[0], ui, {});
  ok("an answer that uses the lesson gets no such box, and passes", th2.backed >= 1 && !th2.lessonShown && !nodes.some(function (n) { return /la-lesson-shown/.test(n.className || ""); }) && ihens.check([th2]) === "",
    [th2.backed, th2.lessonShown, ihens.check([th2])]);
  var talk = L.CHAT.buildSystem(item("food-chicken-done").turns[0]);
  ok("what the 2B is shown for a question to answer in words has no sum in it (it wrote \u201c= 74 / ANSWER: 74 \u00b0C\u201d under \u201cFrom my own knowledge:\u201d) and no block guide",
    /^= 74$/m.test(row(R2, "food-chicken-done").reply) && L.CHAT.kindOf(item("food-chicken-done").turns[0]) === "talk" && !/\{result\}/.test(talk) && !/MAKE [A-Z]+:/.test(talk) && talk.length < 2600, [talk.length, talk.slice(0, 300)]);

  // --- puzzles ---------------------------------------------------------------------------------------------
  var pz = R2.rows.filter(function (r) { return r.cat === "reason"; }), PZ = L.aiPuzzle, PL = L.aiPuzzleLike;
  ok("the fixture: the 2B failed nine puzzles of ten, and wrote a TRACK, TURN or SOLVE block for none of them", pz.length === 9 && pz.every(function (r) { return PZ.find(r.reply).length === 0; }),
    pz.map(function (r) { return [r.id, PZ.find(r.reply).length]; }));
  ok("which questions are puzzles of several steps or clues: the cups, the queue, the die, the robot, the houses, the race -- not a sum that has a queue, a swap, a die or a turn in it",
    PL(item("cups-four").q) === "TRACK" && PL(item("cups-two-coins").q) === "TRACK" && PL(item("queue-ball").q) === "TRACK" && PL(item("die-four-moves").q) === "TURN" && PL(item("robot-walk").q) === "TURN" &&
    PL(item("houses-four").q) === "SOLVE" && PL(item("race-order").q) === "SOLVE" && PL(item("doors-host-guesses").q) === "" && PL(item("letters-refrigerator").q) === "" &&
    ["A queue of 5 people each buy 3 tickets at 2 dollars. What is the total?", "I swap my 2 goats for 30 chickens. How many chickens per goat?", "A car turns left then right. How far has it gone after 3 km and 4 km?",
      "Roll a die 3 times. What is the chance of three sixes?", "There is a queue at the well. Each person takes 20 litres. There are 12 people. How long does the queue take at 2 minutes each?",
      "Who lives in house number 4 on my street?"].every(function (t) { return PL(t) === "" && L.CHAT.kindOf(t) !== "puzzle"; }),
    Q.filter(function (x) { return x.cat === "reason"; }).map(function (x) { return [x.id, PL(x.q)]; }));
  var cupSys = L.CHAT.buildSystem(item("cups-four").q), dieSys = L.CHAT.buildSystem(item("die-four-moves").q);
  ok("what the 2B is shown for the cups is the TRACK tool and nothing else (1,900 characters; it was 4,000, the tool last, after sums, a missing number and the distance between towns); for the die, TURN",
    L.CHAT.kindOf(item("cups-four").q) === "puzzle" && /\nTRACK: <title>/.test(cupSys) && /\nTRACK: Cups\nrow Red Blue Green Yellow\n/.test(cupSys) && !/FUNCTIONS|NEED:|\{result\}|DISTKM|From my own knowledge/.test(cupSys) && cupSys.length < 2000 &&
    /\nTURN: <title>/.test(dieSys) && !/TRACK: <title>|FUNCTIONS/.test(dieSys) && dieSys.length < 1200, [cupSys.length, dieSys.length]);
  // the 2B's reply as it wrote it, then (scripted) the block, then an answer read off Lantern's results
  async function puzzle(id, answer) {
    var it9 = item(id), r9 = row(R2, id), k9 = 0, sent9 = [];
    o.script = function (last) { sent9.push(last); k9++; return k9 === 1 ? r9.reply : k9 === 2 ? it9.ideal : answer(last); };
    var conv9 = await L.CHAT.converse([it9.q], {});
    return { g: B.grade(it9, conv9.turns[0].final, { turns: conv9.turns, text: conv9.turns[0].final }), calls: k9, sent: sent9, turn: conv9.turns[0] };
  }
  function readOff(last) { return "ANSWER: " + last.replace(/^PUZZLE RESULTS[^\n]*\n/, "").replace(/\nNow answer[\s\S]*$/, "").split("\n").filter(function (l) { return !/^\d+\. |^Step by step/.test(l); }).join("; "); }
  var asked = [], notAsked = [];
  for (i = 0; i < 5; i++) {
    var pid = ["cups-four", "cups-two-coins", "queue-ball", "die-four-moves", "robot-walk"][i], pr = await puzzle(pid, readOff);
    if (pr.g.pass && pr.calls === 3 && new RegExp("^Lantern found no " + PL(item(pid).q) + " block in your reply\\. Do not work the puzzle out yourself: Lantern does that exactly, from the block\\. Reply with ONLY the block, as the instructions above describe it\\. Its first line is:\\n" +
        PL(item(pid).q) + ": <a short title>\\nthen a line for each thing the question says, in order, then END\\.$").test(pr.sent[1])) asked.push(pid);
    else notAsked.push([pid, pr.calls, pr.g.why, (pr.sent[1] || "").slice(0, 200)]);
  }
  ok("an answer to such a puzzle with no block in it (\u201cThe coin is with the Blue cup, and the final order ... is Red, Blue, Green, Yellow\u201d; \u201cNot in my library\u201d) is asked for the block, once, with its first line; with the block, Lantern tracks it and the answer read off its results passes (five puzzles)",
    asked.length === 5, notAsked);
  var kb = 0, sentB = [];
  o.script = function (last) { sentB.push(last); kb++; return kb === 1 ? item("cups-four").ideal : readOff(last); };
  var convB = await L.CHAT.converse([item("cups-four").q], {});
  var kn = 0;
  o.script = function () { kn++; return row(R2, "cups-four").reply; };
  var convN = await L.CHAT.converse([item("cups-four").q], { noPuzzle: true });
  var ks = 0;
  o.script = function () { ks++; return "=5*3*2\nANSWER: The total is {result} dollars."; };
  await L.CHAT.converse(["A queue of 5 people each buy 3 tickets at 2 dollars. What is the total?"], {});
  ok("a block written the first time is run and nothing is asked; with the puzzle tools off (the model on its own) nothing is asked; a sum with a queue in it is a sum",
    kb === 2 && /^PUZZLE RESULTS/.test(sentB[1]) && kn === 1 && convN.turns[0].puzzles.length === 0 && ks <= 2 &&
    L.aiPuzzleAsk(item("cups-four").q, "ANSWER: Blue.", { msgs: [], chat: true, noPuzzle: true }) === null && L.aiPuzzleAsk(item("cups-four").q, "ANSWER: Blue.", { msgs: [] }) === null, [kb, kn, ks, (sentB[1] || "").slice(0, 80)]);
  var letQ = item("letters-refrigerator").q, letSys = L.CHAT.buildSystem(letQ);
  ok("the letters of a word are a sum for Lantern\u2019s text functions: REVERSE, REMOVE and LEN are in what the 2B is shown (the question has no number and no recipe, and was taken for one to answer in words)",
    L.CHAT.kindOf(letQ) === "sum" && /\nREVERSE\x28/.test(letSys) && /\nREMOVE\x28/.test(letSys) && /\nLEN\x28/.test(letSys) && L.textFuncsAbout("How many vowels are in the word encyclopedia?") &&
    !L.textFuncsAbout("What does the word ubiquitous mean?") && L.CHAT.kindOf("What does the word ubiquitous mean?") === "talk", [L.CHAT.kindOf(letQ), letSys.length]);

  // =====================================================================================================
  // The 4B
  // =====================================================================================================
  o = load("Qwen3.5-4B-Q4_K_M.gguf"); L = o.L;
  await sleep(80);
  await L.ai.detect();
  B = L.aiBench; Q = L.aiBenchQuestions; act = L.aiAct; A = L.assist; P = L.aiPrompt;
  ok("boot clean, with a 4B (the full prompt)", o.errs.length === 0 && P.active() === "full", [o.errs, P.active()]);
  var LCM = (L.chatCommands || []).filter(function (c) { return c.id === "lessons"; })[0];
  var acc = row(R4, "code-accelstepper"), wh = row(R4, "make-power-wheel");
  ok("the fixture: \u201cLESSON: <a title>\u201d over a whole answer (a program; a wheel), which Lantern took for a request and answered with passages",
    /^LESSON: Stepper motor control with AccelStepper\n\nHere is the Arduino sketch/.test(acc.first) && /^LESSON: Ohm\x27s Law Power Wheel\n\nHere is the wheel layout/.test(wh.first) && /^Based on the provided passages/.test(acc.reply));
  ok("such a line is a heading now: nothing is looked up, and the answer under it is read", LCM.test(acc.first) === null && LCM.test(wh.first) === null &&
    LCM.test("LESSON: Stepper motor control with AccelStepper") === "Stepper motor control with AccelStepper");
  var w1 = await make(R4, "make-power-wheel", [wh.first, wh.reply]);
  ok("the wheel under the heading, written \u201cPart: P (Power) | P = VI | ...\u201d, is read as a wheel: its two wrong formulas go back by name, each part with them written out, and the corrected wheel passes",
    w1.out.rounds === 2 && w1.g.pass && /^Lantern checked your MAKE WHEEL block and found 4 things to fix:\n1\. \u201cV = \u221a\x28PI\x29\u201d is not right: with P = 36, V = 12, I = 3, R = 4 it gives 10\.392, not 12\n2\. \u201cI = P\/R\u201d is not right/.test(lastOf(w1.seen, 1)) &&
    /\n3\. write the V \x28Voltage\x29 part\u2019s items as: V = P\/I \| V = \u221a\x28PR\x29 \| V = I \* R\n4\. write the I \x28Current\x29 part\u2019s items as: I = P\/V \| I = V \/ R \| I = \u221a\x28P\/R\x29\n/.test(lastOf(w1.seen, 1)),
    [w1.out.rounds, w1.g.why, lastOf(w1.seen, 1).slice(0, 600)]);
  var w2r = row(R2, "make-power-wheel");
  var w2 = await make(R2, "make-power-wheel", [w2r.reply, w2r.reply.replace("I: I = P / V | I = V / R | I = sqrt(P * V)", "I: I = P / V | I = V / R | I = sqrt(P / R)").replace("R: R = P / I | R = V^2 / P | R = V^2 / P", "R: R = P / I^2 | R = V^2 / P | R = V / I")]);
  ok("the 2B\u2019s wheel (ten formulas right, \u201cI = sqrt(P * V)\u201d, \u201cR = P / I\u201d, and \u201cR = V^2 / P\u201d twice): the two parts go back written out -- what was right as the 2B wrote it, the rest from the pairs of letters the part lacks -- and the wheel with those lines passes",
    /I: I = P \/ V \| I = V \/ R \| I = sqrt\x28P \* V\x29 fill green\nR: R = P \/ I \| R = V\^2 \/ P \| R = V\^2 \/ P fill orange/.test(w2r.reply) && w2.out.rounds === 2 && w2.g.pass &&
    /\n4\. write the I part\u2019s items as: I = P \/ V \| I = V \/ R \| I = sqrt\x28P \/ R\x29\n5\. write the R part\u2019s items as: R = P \/ I\^2 \| R = V\^2 \/ P \| R = V \/ I\n/.test(lastOf(w2.seen, 1)), [w2.out.rounds, w2.g.why, lastOf(w2.seen, 1).slice(0, 700)]);
  var WF = L.aiWheelCheck.from;
  ok("...each worked out by Lantern from the two letters (against two sets of values that obey Ohm\u2019s law), in the letters the wheel uses; a wheel that is right is told nothing",
    WF("I", "P", "R") === "sqrt(P / R)" && WF("R", "P", "I") === "P / I^2" && WF("R", "I", "P") === "P / I^2" && WF("P", "V", "R") === "V^2 / R" && WF("W", "E", "I") === "E * I" && WF("V", "P", "R") === "sqrt(P * R)" &&
    act.fromReply(item("make-power-wheel").ideal, item("make-power-wheel").q).ok === true, [WF("I", "P", "R"), WF("R", "P", "I"), WF("W", "E", "I")]);
  var mo = row(R4, "make-music-original"), imo = item("make-music-original"), smo = [];
  var outmo = await act.solve(imo.q, seq([mo.first, imo.ideal], smo));
  ok("\u201cLESSON: Compose a tune in G major\u201d for a tune to compose: Lantern\u2019s lessons have nothing on it and none is needed -- the block is asked for, with its first line; the tune passes",
    /^LESSON: Compose a tune in G major\n/.test(mo.first) && outmo.rounds === 2 && B.grade(imo, outmo.text, outmo).pass &&
    /^Lantern\u2019s own lessons have nothing on \u201cCompose a tune in G major\u201d, and none is needed: what was asked is made from a block\. Reply with ONLY the block, as the instructions above describe it\. Its first line is:\nMAKE MUSIC: <a short title>\nthen its lines, then END\./.test(lastOf(smo, 1)),
    [outmo.rounds, B.grade(imo, outmo.text, outmo).why, lastOf(smo, 1).slice(0, 300)]);
  var orc = row(R4, "make-music-orchestra"), iorc = item("make-music-orchestra"), sorc = [];
  var outorc = await act.solve(iorc.q, seq([orc.first, iorc.ideal], sorc));
  ok("the same line written fourteen times is one request, answered the same way", (orc.first.match(/LESSON: Ode to Joy Orchestra Arrangement/g) || []).length >= 10 && outorc.rounds === 2 && B.grade(iorc, outorc.text, outorc).pass &&
    /^Lantern\u2019s own lessons have nothing on \u201cOde to Joy Orchestra Arrangement\u201d, and none is needed/.test(lastOf(sorc, 1)), [outorc.rounds, lastOf(sorc, 1).slice(0, 200)]);
  var madeO = act.fromReply(orc.reply, iorc.q);
  ok("the 4B\u2019s own arrangement: a part that plays the tune\u2019s note (F over C in bar 1, as the tune has it) is not a clash; what is still wrong with it is said, and it is left failing",
    /part violins, bar 1: F over C/.test(orc.why) && madeO && !madeO.ok && !madeO.problems.some(function (p) { return /part violins, bar 1: F over C/.test(p); }), madeO && madeO.problems);
  var su4 = row(R4, "make-sunset-house"), isu = item("make-sunset-house");
  var m6 = await make(R4, "make-sunset-house", [su4.reply, su4.reply.replace("rect 0 0 20 12 fill sky", "rect 0 0 20 12 fill orange")]);
  ok("the 4B\u2019s sunset under \u201cfill sky\u201d: the line to write goes back, and the picture with it passes", m6.g.pass && m6.out.rounds === 2 &&
    /is the blue of day: write rect 0 0 20 12 fill orange/.test(lastOf(m6.seen, 1)), [m6.g.why, lastOf(m6.seen, 1).slice(0, 300)]);
  var m7 = await make(R4, "make-house"), wd = row(R4, "water-days"), iwd = item("water-days"), swd = [];
  var outwd = await A.solve(iwd.q, { call: seq([wd.first, wd.reply], swd) });
  ok("left failing: a roof drawn as a red square; =2000/8000 where =2000/ANS was meant (questioned, and the 4B then asked for a number: one row, once)",
    !m7.g.pass && /no red roof/.test(m7.g.why) && !B.grade(iwd, outwd.text, outwd).pass && /=5\*40 \x28200\x29 is worked out but never used afterwards/.test(lastOf(swd, 1)), [m7.g.why, lastOf(swd, 1).slice(0, 200)]);

  // =====================================================================================================
  // The 0.8B
  // =====================================================================================================
  o = load("Qwen3.5-0.8B-Q4_K_M.gguf"); L = o.L;
  await sleep(80);
  await L.ai.detect();
  B = L.aiBench; Q = L.aiBenchQuestions; act = L.aiAct; A = L.assist; P = L.aiPrompt;
  ok("boot clean, with a 0.8B (the short prompt)", o.errs.length === 0 && P.active() === "short", [o.errs, P.active()]);
  var echoed = R8.rows.filter(function (r) { return /evaluated in order|ANS1/.test((r.first || "") + "\n" + (r.reply || "")) && item(r.id); });
  function shownFor(it) { var q = it.turns ? it.turns[0] : it.q; return /^(tool|multi|need|unknown|safety)$/.test(it.cat) ? A.buildPrompt(q, A.match(q)) : L.CHAT.buildSystem(q); }
  var still = echoed.filter(function (r) { return /evaluated in order|ANS1/.test(shownFor(item(r.id))); }).map(function (r) { return r.id; });
  var sizes = echoed.map(function (r) { return shownFor(item(r.id)).length; }).sort(function (a, b) { return a - b; });
  ok("the fixture: thirty replies copied the instructions\u2019 own words (\u201c= (evaluated in order; ANS ...\u201d, \u201cANS1\u201d); what the 0.8B is shown for those questions now has neither, and is at most 4,000 characters",
    echoed.length === 30 && still.length === 0 && sizes[sizes.length - 1] <= 4000, [echoed.length, still, sizes]);
  var codeQ = Q.filter(function (x) { return x.kind === "CODE"; });
  ok("a program asked for is offered MAKE CODE and no other block", codeQ.length >= 5 && codeQ.every(function (x) { var g2 = act.prompt(x.q); return /MAKE CODE:/.test(g2) && !/MAKE (DRAWING|SCHEMATIC|WHEEL|MUSIC|SLIDES):/.test(g2); }),
    codeQ.filter(function (x) { var g2 = act.prompt(x.q); return !/MAKE CODE:/.test(g2) || /MAKE (DRAWING|SCHEMATIC|WHEEL|MUSIC|SLIDES):/.test(g2); }).map(function (x) { return x.id; }));
  var fit = row(R8, "health-fit"), ifit = item("health-fit");
  nodes = []; ui = { node: function (fn) { var e = fn(); if (e) nodes.push(e); } };
  o.script = function () { return fit.chat && fit.chat[0] && fit.chat[0].reply || fit.reply; };
  var tf8 = await L.CHAT.turn([], ifit.turns[0], ui, {});
  box = nodes.filter(function (n) { return /la-lesson-shown/.test(n.className || ""); })[0];
  ok("\u201cMy brother is having a fit. What do I do?\u201d, answered by the 0.8B with lines of its own: the person is shown what Lantern\u2019s lesson says (the bench still fails the answer)",
    !!box && tf8.lessonShown && /This is what Lantern\u2019s own lesson says:/.test(box.textContent) && /fit|seizure|convuls/i.test(box.textContent) && !!ifit.check([tf8]), [box && box.textContent.slice(0, 300), ifit.check([tf8])]);
  var s8 = R8.rows.filter(function (r) { return /^(tool|multi|need)$/.test(r.cat) && item(r.id); }), fixed8 = 0, nothing = [];
  for (i = 0; i < s8.length; i++) {
    var r8 = s8[i], it8 = item(r8.id), sn = [];
    var o8 = await A.solve(it8.q, { call: seq([r8.first || r8.reply, it8.x ? right(it8) : "NEED: what is missing?"], sn) });
    if (B.grade(it8, o8.text, o8).pass) fixed8++;
    if (sn.length === 1) nothing.push(r8.id);
  }
  ok("of the 0.8B\u2019s 33 failed sums, 32 now get something back and pass with a right second reply (scripted); one is left (a battery nobody gave, assumed)",
    s8.length === 33 && fixed8 === 32 && nothing.join() === "need-battery", [s8.length, fixed8, nothing]);
  async function back8(id) { var it2 = item(id), r2 = row(R8, id), s2 = []; var o2 = await A.solve(it2.q, { call: seq([r2.first || r2.reply, it2.x ? right(it2) : "NEED: x"], s2) }); return { out: o2, text: lastOf(s2, 1), first: r2.first || r2.reply }; }
  var wm8 = await back8("water-molar"), pb8 = await back8("place-bearing"), sk8 = await back8("sack-weight"), rw8 = await back8("radio-wave"), pa8 = await back8("pump-ah"), hk8 = await back8("heater-kwh");
  ok("a NEED and then its own answer under it (\u201cNEED: What is the formula for water? / ANS: H2O / ANS: 18.01528 g/mol\u201d), or a NEED and a decline: the recipe goes back, where the question fills it",
    /^NEED: What is the formula for water\?\nANS: H2O\n/.test(wm8.first) && wm8.out.noFormula === "card" && /\n=MOLARMASS\x28\x22H2O\x22\x29\nThat is the recipe/.test(wm8.text) &&
    /^NEED: What is the latitude and longitude of Tulsa/.test(pb8.first) && /Not in my library/.test(pb8.first) && pb8.out.noFormula === "card" && /\n=BEARING\x28\x22Tulsa\x22,\x22Dallas\x22\x29\nThat is the recipe/.test(pb8.text),
    [wm8.out.noFormula, wm8.text.slice(0, 200), pb8.out.noFormula]);
  var NFn = L.aiNoFormula, pn = function (t) { return A.parseReply(t); }, bq = "How many hours will my 100 Ah battery run a 60 W light?";
  ok("...a NEED on its own is a NEED, and so is one with a guess under it where the question does not fill a recipe (a battery\u2019s voltage)",
    NFn(item("water-molar").q, "NEED: Which water?", pn("NEED: Which water?"), A.match(item("water-molar").q)) === null &&
    NFn(bq, "NEED: What is the battery\u2019s voltage?\nANS: 12", pn("NEED: What is the battery\u2019s voltage?\nANS: 12"), A.match(bq)) === null);
  ok("a NEED for a number the question gives, with the sum already under it (\u201cNEED: What is the value of 50? / =WEIGHT(50,\"kg\")\u201d): the sum is read, and what is wrong with it goes back with the recipe",
    /^NEED: What is the value of 50\?\n=WEIGHT\x2850,\x22kg\x22\x29/.test(sk8.first) && sk8.out.needVoid === "What is the value of 50?" && sk8.out.kind === "rejected" &&
    /Lantern could not run =WEIGHT\x2850,\x22kg\x22\x29 \x28[^\x29]+\x29\. Lantern has a recipe for this question, here with its numbers in: write =WEIGHT\x2850\x29/.test(sk8.text), [sk8.out.needVoid, sk8.out.kind, sk8.text.slice(0, 300)]);
  ok("a sum that runs and gives another number than the recipe Lantern can fill itself (one blank, one number, the same unit): =100*10^6/299792458 for a wavelength goes back with the recipe\u2019s line",
    /=100\*10\^6\/299792458/.test(rw8.first) && /Lantern\u2019s recipe for this question gives 2\.9979 \x28metres\x29, and this sum gives 0\.33356: write =WAVELEN\x28100\x29/.test(rw8.text) &&
    L.aiNoFormula.filled(A.match(item("orbit-420").q)[0], item("orbit-420").q) === "=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60" &&
    L.aiNoFormula.filled(A.match(item("feed").q)[0], item("feed").q) === "=FEEDKG(20,30,800)" && L.aiNoFormula.filled(A.match("What is the wavelength of a 100 kHz signal?")[0], "What is the wavelength of a 100 kHz signal?") === "",
    [rw8.text.slice(0, 300), L.aiNoFormula.filled(A.match(item("orbit-420").q)[0], item("orbit-420").q)]);
  var RD = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0], S35 = fixture("bench_run_1244_35b_sums.json"), touched35 = [];
  S35.rows.forEach(function (r35) { var p35 = A.parseReply(r35.reply), run35 = A.run(p35.exprText), why35 = RD(r35.q, p35.exprText, run35, {}); if (why35) touched35.push([r35.id, why35]); });
  ok("...a sum that agrees with the recipe is left alone: none of the 35B\u2019s 45 right sums is questioned by it, nor a question with two recipes (sugar and salt)",
    S35.rows.length === 45 && touched35.length === 0 && RD("How much sugar and salt for 5 litres of ORS?", "=6*5\n=0.5*5", A.run("=6*5\n=0.5*5"), {}) === null, touched35);
  ok("amp-hours the QUESTION asks for (the sentence was only \u201c{result}\u201d): 12 V x 5 A x 3 h x 7 is watt-hours, and the line to write counts the week",
    /^=12\*5\*3\n/.test(pa8.first) && /the question asks for amp-hours, but 1260 is volts \u00d7 amps \u00d7 hours \x2812 V \u00d7 5 A \u00d7 3 h \u00d7 7 days\x29, which is watt-hours; amp-hours are amps \u00d7 hours: =5\*3\*7/.test(pa8.text), pa8.text.slice(0, 300));
  ok("working written into the sentence (\u201c2000 W * 90 h = 180,000 kWh\u201d) with no = line: the sum itself is asked for, with the question\u2019s numbers",
    /^ANSWER: 2 kW = 2000 W;/.test(hk8.first) && hk8.out.noFormula === "sum" && /write the sum itself, not its result\.\nReply with one line that starts with = and uses the question\u2019s numbers \x282 kW; 3 hours; 30 days\x29/.test(hk8.text), [hk8.out.noFormula, hk8.text.slice(0, 200)]);

  // =====================================================================================================
  // Rule 11
  // =====================================================================================================
  var bare = load("Qwen3.5-2B-Q4_K_M.gguf", ["AI_NEED_RECIPE", "AI_NO_FORMULA", "AI_UNITS", "CHAT_LESSON_SHOWN", "AI_ACT_SENSE", "AI_PUZZLE_ASK", "AI_SCHEMATIC_TOTAL"]), LB = bare.L;
  await sleep(80);
  await LB.ai.detect();
  var sb = [], ob = await LB.assist.solve(i420.q, { call: seq([o420.first, "=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60\nANSWER: {result} minutes."], sb) });
  ok("rule 11: without AI_NEED_RECIPE, AI_NO_FORMULA, AI_UNITS, CHAT_LESSON_SHOWN, AI_ACT_SENSE, AI_PUZZLE_ASK and AI_SCHEMATIC_TOTAL Lantern boots clean; a NEED for Earth\u2019s radius gets the figure; a puzzle is given the tools after everything else, as before",
    bare.errs.length === 0 && !LB.aiNeedRecipe && !LB.aiNoFormula && !LB.aiUnits && !LB.chatLessonShown && !LB.aiPuzzleLike && !LB.aiSchematicTotal && /^Lantern: Earth\u2019s radius is 6\.371e6 m/.test(lastOf(sb, 1)) &&
    LB.aiBench.grade(i420, ob.text, ob).pass && LB.CHAT.kindOf(item("cups-four").q) !== "puzzle" && /\nTRACK: <title>/.test(LB.CHAT.buildSystem(item("cups-four").q)), [bare.errs, lastOf(sb, 1)]);
  var bare2 = load("Qwen3.5-2B-Q4_K_M.gguf", ["AI_CHECKS"]), LC = bare2.L;
  await sleep(80);
  ok("...and without AI_CHECKS the Hohmann cards are given as they were (nothing says which numbers are heights), and no card is fitted",
    bare2.errs.length === 0 && LC.assist.match(ih.q).map(function (c) { return c.id; }).join() === "hohmann-time,hohmann-alt" &&
    LC.assist.match(igeo.q)[0].compose === "=ORBITT(CONVERT({alt_km}+6371,\"km\",\"m\"))/60", [bare2.errs, LC.assist.match(ih.q).map(function (c) { return c.id; })]);

  console.log(fails ? fails + " BENCH 1.24.5 SMALL MODEL FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.5 SMALL MODEL CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL (threw)", e && e.stack || e); process.exit(1); });
