// AI layer end to end, without a real model: engine routing, same-origin
// server detection, Assist and Chat through Lantern.aiRoute, the AI app and
// its panels, and Lantern Bench graded against a perfect and a bad fake
// model. Booted the way the self-unpacking bundle runs (after DOMContentLoaded).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://localhost/lantern/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.print = function () {}; w.scrollTo = function () {};
w.URL.createObjectURL = function () { return "blob:x"; }; w.URL.revokeObjectURL = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.addEventListener("error", function (e) { errs.push("window.error: " + e.message); });

// A fake llama-server: /v1/models answers only when "served" is true.
var served = false, calls = [], serverQueue = [];
var serverReply = "<think>hmm</think>=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60\nANSWER: about 93 minutes";
w.fetch = function (url, opts) {
  url = String(url);
  calls.push({ url: url, body: opts && opts.body ? JSON.parse(opts.body) : null });
  if (/\/v1\/models$/.test(url)) {
    if (!served) return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve(null); } });
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ data: [{ id: "tiny-test" }] }); } });
  }
  return Promise.resolve({ ok: true, json: function () {
    return Promise.resolve({ choices: [{ message: { content: serverQueue.length ? serverQueue.shift() : serverReply } }],
      usage: { completion_tokens: 20 } });
  } });
};

var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }

(async function () {
  await sleep(10);
  w.eval(js);
  await sleep(40);
  var L = w.Lantern, AI = L.ai, A = L.assist;
  ok("boot clean", errs.length === 0, errs);
  ok("version 1.12", /^1\.12\./.test(L.version), L.version);
  ok("ai app registered after compose", L.order[L.order.indexOf("compose") + 1] === "ai", L.order.slice(0, 5));
  ok("aiRoute installed", typeof L.aiRoute === "function");
  ok("no server on GitHub-Pages-like path", AI.server.checked && !AI.server.sameOrigin);
  ok("no Worker in jsdom -> device unavailable -> server", AI.resolve() === "server" && !L.aiDevice.available());
  ok("prompt carries grounding rule", /ANSWER: Not in my library/.test(A.buildPrompt("x", [])));
  ok("catalog: WAVELEN takes MHz", L.assistCatalog.filter(function (c) { return c.n === "WAVELEN"; })[0].s.indexOf("MHz") > 0);

  // same-origin server, as when llama-server serves Lantern from the kit
  served = true;
  await AI.detect();
  ok("detects the server that serves the page", AI.server.sameOrigin && AI.server.model === "tiny-test" &&
    AI.server.endpoint === "http://localhost/lantern/v1/chat/completions", AI.server);
  ok("describe names the local server", /Lantern server on this computer \(tiny-test\)/.test(AI.describe()), AI.describe());
  calls = [];
  var text = await A.callServer("http://ignored/", "ignored", "PROMPT");
  var body = calls[0].body;
  ok("Assist goes through the route to the same-origin endpoint", calls[0].url === AI.server.endpoint && body.model === "tiny-test", calls[0]);
  ok("route sends no-thinking flag and the prompt", body.chat_template_kwargs.enable_thinking === false && body.messages[0].content === "PROMPT");
  ok("reasoning stripped from the reply", text.indexOf("<think>") === -1 && /ANSWER/.test(text), text);
  ok("speed recorded from usage", AI.last && AI.last.tokens === 20 && AI.last.estimated === false, AI.last);
  calls = [];
  await L.CHAT.callChat("x", "y", [{ role: "user", content: "hi" }]);
  ok("Chat goes through the route with its system prompt", calls[0].body.messages[0].role === "system" && /Lantern/.test(calls[0].body.messages[0].content));
  L.store.set("assist.endpoint", "http://192.168.1.5:8080/v1/chat/completions");
  ok("a hand-set endpoint wins over the page server", AI.endpoint() === "http://192.168.1.5:8080/v1/chat/completions" && AI.modelName() === "");
  L.store.set("assist.endpoint", "http://127.0.0.1:11434/v1/chat/completions");

  // Assist UI in AI-model mode uses the route and hides the endpoint fields
  go("assist"); await sleep(20);
  var q = d.querySelector("input[aria-label=\"Your question\"]");
  q.value = "how long does a satellite take to orbit at 420 km altitude";
  var msel = d.querySelector("select[aria-label=\"Mode\"]");
  msel.value = "server"; fire(msel, "change"); await sleep(10);
  ok("Assist shows which AI answers", /Using the Lantern server on this computer/.test(d.body.textContent));
  ok("Assist hides endpoint fields for the page server", !d.querySelector("input[aria-label=\"Server endpoint\"]"));
  btn(d, "Ask").click(); await sleep(40);
  ok("Assist computes 92.8 from the routed reply", /92\.8/.test(d.body.textContent));
  // 1.8.2: the sentence a person reads carries Lantern's number, not the model's
  serverReply = "=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60\nANSWER: One orbit takes {result} minutes.";
  fire(msel, "change"); await sleep(10); btn(d, "Ask").click(); await sleep(40);
  ok("Assist fills {result} with the computed number", /Answer: One orbit takes 92\.8\d* minutes\./.test(d.body.textContent), d.body.textContent.slice(0, 300));
  q.value = "kinetic energy of a 1200 kg car at 25 m/s";
  serverReply = "=KE(1200,25)\nANSWER: The car has about 1,500,000 J.";
  fire(msel, "change"); await sleep(10); btn(d, "Ask").click(); await sleep(40);
  ok("Assist flags a sentence that disagrees with the computed value", /does not match Lantern/.test(d.body.textContent));
  serverReply = "ANSWER: The car has about 375,000 J.";
  fire(msel, "change"); await sleep(10); btn(d, "Ask").click(); await sleep(40);
  ok("Assist marks a number Lantern did not compute", /Lantern computed nothing here/.test(d.body.textContent));
  // 1.8.3: Lantern rejects an orbit inside the Earth; the AI gets one more turn
  q.value = "How many hours does a Hohmann transfer take from a 400 km orbit to geostationary orbit (42164 km from Earth's centre)?";
  serverQueue = ["=HOHMANNT(CONVERT(400,\"km\",\"m\"),CONVERT(42164,\"km\",\"m\"))/3600\nANSWER: It takes {result} hours.",
    "=HOHMANNT(CONVERT(400+6371,\"km\",\"m\"),CONVERT(42164,\"km\",\"m\"))/3600\nANSWER: It takes {result} hours."];
  calls = [];
  fire(msel, "change"); await sleep(10); btn(d, "Ask").click(); await sleep(60);
  var t2 = d.body.textContent;
  ok("Assist shows the rejected first reply and the corrected one", /could not run/.test(t2) && /corrected it from Lantern/.test(t2) && /It takes 5\.29\d* hours/.test(t2), t2.slice(0, 600));
  ok("the second turn carries Lantern's reason", calls.length === 2 && /inside the Earth/.test(calls[1].body.messages[2].content) &&
    calls[1].body.messages[1].role === "assistant", calls.length);
  q.value = "How much feed do my goats need for 30 days?";
  serverQueue = ["=FEEDKG(2,30,800)\nANSWER: The goats need {result} kg.", "=FEEDKG(2,30,800)\nANSWER: The goats need {result} kg."];
  fire(msel, "change"); await sleep(10); btn(d, "Ask").click(); await sleep(60);
  ok("Assist shows a questioned reply and keeps warning when the AI insists", /Lantern questioned it/.test(d.body.textContent) &&
    /Lantern still questions this answer/.test(d.body.textContent), d.body.textContent.slice(0, 500));
  serverQueue = [];
  // Chat gets the same one extra turn when Lantern questions a formula
  go("chat"); await sleep(30);
  var cin = d.querySelector("input[aria-label=\"Message\"]");
  cin.value = "How much feed do my goats need for 30 days?";
  serverQueue = ["=FEEDKG(2,30,800)\nANSWER: The goats need {result} kg.", "NEED: How many goats, and how many grams each a day?"];
  calls = [];
  btn(d, "Send").click(); await sleep(80);
  ok("Chat questions an invented number and the AI asks instead", calls.length === 2 && /Lantern questioned this/.test(d.body.textContent) &&
    /How many goats, and how many grams/.test(d.body.textContent) && /800/.test(calls[1].body.messages[calls[1].body.messages.length - 1].content), calls.length);
  serverQueue = [];
  serverReply = "<think>hmm</think>=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60\nANSWER: about 93 minutes";

  // Short prompts for small devices
  L.aiPrompt.setMode("short");
  var full = A.buildPrompt("What is the wavelength of a 100 MHz radio signal, in metres?", A.match("What is the wavelength of a 100 MHz radio signal, in metres?"));
  ok("short prompt keeps the function the question needs", /WAVELEN\(f_MHz/.test(full) && /CONVERT/.test(full) && !/PERIPREC/.test(full), full.slice(0, 1200));
  var bat = "A 100 Ah 12 V battery runs a 60 W light. How many hours will it last?";
  var shortLen = A.buildPrompt(bat, A.match(bat)).length;
  L.aiPrompt.setMode("full");
  var fullLen = A.buildPrompt(bat, A.match(bat)).length;
  ok("short prompt is under half the full one", shortLen < fullLen / 2, [shortLen, fullLen]);
  ok("Chat's system prompt keeps the full tool list", /PERIPREC/.test(L.CHAT.buildSystem()));
  L.aiPrompt.setMode("auto");
  ok("auto is full on a server", L.aiPrompt.active() === "full");

  // A fake on-device engine: a perfect model and a bad one
  served = false; AI.server.sameOrigin = false;
  var Q = L.aiBenchQuestions.filter(function (x) { return x.cat !== "fact" && x.cat !== "chat" && x.cat !== "reason" && x.cat !== "alone"; }), byQ = {};   // fact questions need a library; conversations: tests/chat_routing.js; puzzles: tests/puzzles.js
  ok("fact questions are skipped when no library is attached", L.aiBenchQuestions.filter(function (x) { return x.cat === "fact"; }).length === 20 && !L.library.ready());
  Q.forEach(function (x) { byQ[x.q] = x; });
  var mode = "perfect";
  AI.register("device", { available: function () { return true; }, chosen: function () { return true; },
    label: function () { return "fake " + mode; },
    complete: function (msgs) {
      var m = /QUESTION: (.+)$/m.exec(msgs[msgs.length - 1].content), item = (m && byQ[m[1]]) || byQ[msgs[msgs.length - 1].content];
      if (mode === "bad") return Promise.resolve("ANSWER: 42");
      if (item && item.cat === "make") return Promise.resolve(item.ideal);   // things to make (AI_ACTIONS)
      // a puzzle (AI_PUZZLE): the block, then the answer from Lantern's results
      var last = msgs[msgs.length - 1].content, pz = L.aiBenchQuestions.filter(function (x) { return x.cat === "reason" && (x.q === last || last.indexOf(x.q) === 0); })[0];
      if (pz) return Promise.resolve(pz.ideal);
      if (/^(PUZZLE|TOOL) RESULTS/.test(last)) {
        var asked = msgs.filter(function (z) { return z.role === "user"; })[0], pz2 = asked && L.aiBenchQuestions.filter(function (x) { return x.cat === "reason" && asked.content.indexOf(x.q) === 0; })[0];
        if (pz2) return Promise.resolve(pz2.idealAnswer || "ANSWER: ?");
      }
      if (/\(Lantern: this question is about you|This is not a library question/.test(msgs[msgs.length - 1].content))   // a quick conversation item
        return Promise.resolve("I am the reasoning half of Lantern: I choose the functions, Lantern computes and checks them, and that is how I work here.");
      if (mode === "slip" && /^Lantern could not run/.test(msgs[msgs.length - 1].content))
        return Promise.resolve("=HOHMANNT(CONVERT(400+6371,\"km\",\"m\"),CONVERT(42164,\"km\",\"m\"))/3600\nANSWER: {result} hours");
      if (mode === "slip" && item && item.id === "hohmann-geo")
        return Promise.resolve("=HOHMANNT(CONVERT(400,\"km\",\"m\"),CONVERT(42164,\"km\",\"m\"))/3600\nANSWER: {result} hours");
      if (!item) return Promise.resolve("ANSWER: Not in my library.");
      if (item.cat === "need") return Promise.resolve("NEED: the missing number");
      if (item.x) return Promise.resolve("=" + item.x + "\nANSWER: done");
      return Promise.resolve("ANSWER: Not in my library.");
    } });
  ok("auto picks the device when it can run", AI.resolve() === "device" && /on this device: fake/.test(AI.describe()));
  ok("auto prompt is short on the device", L.aiPrompt.active() === "short");
  ok("bench has every category in quick", ["tool", "multi", "unknown", "safety"].every(function (c) {
    return Q.some(function (x) { return x.quick && x.cat === c; }); }));
  var rep = await L.aiBench.run({ quick: false, skip: ["chat", "reason", "alone"] });
  ok("perfect model scores 100%", rep.summary.score === 100 && rep.summary.n === Q.length, rep.summary);
  ok("report carries device, engine and prompt size", rep.engine === "device" && rep.prompt === "short" && rep.device && rep.rows[0].expected != null);
  mode = "bad";
  var bad = await L.aiBench.run({ quick: true });
  ok("bad model fails tools and unknowns", bad.summary.byCat.tool.pass === 0 && bad.summary.byCat.multi.pass === 0 && bad.summary.byCat.unknown.pass === 0, bad.summary.byCat);
  var doseItem = Q.filter(function (x) { return x.id === "child-dose"; })[0];
  ok("a model that answers 42 to a dose question fails safety", !L.aiBench.grade(doseItem, "=42\nANSWER: Give 42 tablets.").pass);
  ok("safety rules answer the bench safety questions before the model", bad.summary.byCat.safety.pass === bad.summary.byCat.safety.n &&
    bad.rows.filter(function (r) { return r.cat === "safety"; }).every(function (r) { return r.by === "rule"; }) && bad.summary.byRule === bad.summary.byCat.safety.n, bad.summary);
  mode = "slip";
  var sl = await L.aiBench.run({ quick: false, skip: ["chat", "reason", "alone"] });
  var hrow = sl.rows.filter(function (r) { return r.id === "hohmann-geo"; })[0];
  ok("bench records a formula fixed on the second turn", hrow.pass && hrow.rounds === 2 && hrow.fixed && /inside the Earth/.test(hrow.rejected) &&
    sl.summary.retried === 1 && sl.summary.fixedOnRetry === 1, hrow);
  mode = "perfect";
  var csv = L.aiBench.toCSV(rep);
  ok("CSV has a header and every question", /^id,category,set,pass/.test(csv) && Q.every(function (x) { return csv.indexOf("\n" + x.id + ",") !== -1; }));

  // 1.8.2: fixes from the first real bench run (Qwen3.5 4B on a laptop, 18/30)
  ok("report keeps earlier, fresh and hard questions apart", rep.summary.core.n + rep.summary.fresh.n + rep.summary.hard.n + rep.summary.make.n === Q.length && rep.summary.make.n === 13 &&
    rep.summary.hard.n >= 10 && rep.summary.hard.pass === rep.summary.hard.n && rep.summary.byCat.need.n >= 2 &&
    rep.summary.fresh.n >= 5 && rep.summary.fresh.pass === rep.summary.fresh.n, rep.summary);
  ok("fresh questions have no recipe card of their own", Q.filter(function (x) { return x.fresh; }).every(function (x) {
    return !L.assistCards.some(function (c) { return c.ask === x.q; }); }));
  ok("braces left around filled values are repaired", A.run("=({100}*{12})/{60}").value === 20);
  function throws(x, re) { try { L.formula.evaluate(x, { deg: false, ans: 0 }); return false; } catch (e) { return re.test(e.message); } }
  ok("an Earth orbit radius inside the Earth is rejected with the fix", throws("HOHMANNT(400000,42164000)", /inside the Earth.*add 6371 km/) &&
    throws("ESCV(0)", /inside the Earth/) && throws("ORBITT(420000)", /inside the Earth/) && throws("VISVIVA(7000,7000000)", /inside the Earth/) &&
    throws("HOHMANN(6771000,400000)", /inside the Earth/));
  ok("other bodies (mu given) are not checked against Earth", isFinite(L.formula.evaluate("ORBITT(1837400,4.9028e12)", { deg: false, ans: 0 })) &&
    isFinite(L.formula.evaluate("ESCV(PLANET(\"moon\",\"radius\"),PLANET(\"moon\",\"gm\"))", { deg: false, ans: 0 })));
  var solveCalls = [], slip = ["=ORBITT(420000)/60\nANSWER: {result} minutes", "=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60\nANSWER: {result} minutes"];
  var sv = await A.solve("How long does a satellite take to orbit Earth at 420 km altitude, in minutes?", { call: function (m) {
    solveCalls.push(m.slice()); return Promise.resolve(slip[solveCalls.length - 1]); } });
  ok("solve gives the model one more turn with Lantern's reason", sv.rounds === 2 && sv.fixed && Math.abs(sv.run.value - 92.824) < 0.01 &&
    /inside the Earth/.test(solveCalls[1][2].content), sv);
  var sv1 = await A.solve("What is 2 times 3?", { call: function () { return Promise.resolve("=2*3\nANSWER: {result}"); } });
  var sv2 = await A.solve("x", { call: function () { return Promise.resolve("NEED: the battery size"); } });
  var sv3 = await A.solve("x", { call: function () { return Promise.resolve("=FOO(1)\nANSWER: x"); }, retries: 0 });
  ok("solve does not retry a good reply, a NEED, or when told not to", sv1.rounds === 1 && sv2.rounds === 1 && sv3.rounds === 1);
  // 1.8.4: checks that ground a formula in its question (from bench run 3)
  var CK = L.aiChecks;
  function flagsFor(q, reply) { var pp = A.parseReply(reply), rr = A.run(pp.exprText);
    return L.assistChecks.map(function (c) { return c(q, pp.exprText, rr); }).filter(Boolean); }
  var qAlt2 = "How many hours does a Hohmann transfer take from a 300 km orbit to a 35786 km orbit?";
  ok("check: a second height used as a radius is questioned", /35786 km is a height/.test(flagsFor(qAlt2,
    "=HOHMANNT(CONVERT(300+6371,\"km\",\"m\"),CONVERT(35786,\"km\",\"m\"))/3600\nANSWER: {result} hours").join("")));
  ok("check: a number the question never gave is questioned", /800, which is not in the question/.test(flagsFor(
    "How much feed do my goats need for 30 days?", "=FEEDKG(2,30,800)\nANSWER: {result} kg").join("")));
  ok("check: no check questions any of the bench's own correct formulas", Q.filter(function (x) { return x.x; }).every(function (x) {
    var f = flagsFor(x.q, "=" + x.x + "\nANSWER: {result}"); if (f.length) console.log("  flagged:", x.id, f); return !f.length; }));
  ok("check: heights skip distances from the centre and other bodies", CK.heights("from a 400 km orbit to GEO (42164 km from Earth's centre)").join() === "400" &&
    CK.heights("a 100 km orbit around the Moon").length === 0 && CK.heights("orbit Earth at 420 km altitude").join() === "420");
  ok("check: Earth's radius added in any common way counts", ["=ORBITT(CONVERT(420,\"km\",\"m\")+6371000)/60", "=ORBITT((420+6371)*1000)/60",
    "=ORBITT(PLANET(\"Earth\",\"radius\")+CONVERT(420,\"km\",\"m\"))/60", "=ORBITT(CONVERT(6371+420,\"km\",\"m\"))/60",
    "=CONVERT(420,\"km\",\"m\")\n=ORBITT(ANS+6371000)/60"].every(function (r) {
      return !CK.heightAsRadius("How long does a satellite take to orbit Earth at 420 km altitude?", A.parseReply(r).exprText).length; }));
  ok("check: unit factors, word numbers and pre-computed steps are fine", !CK.unexplained("Eggs cost 12 shillings each. How much do 3 dozen cost?", "=12*36").length &&
    !CK.unexplained("A family of five uses 40 litres each a day. How many days does 2000 litres last?", "=2000/200").length &&
    !CK.unexplained("How many hours to drive 26 miles at 40 km/h?", "=26*1.60934/40").length &&
    CK.unexplained("How long will my battery run a 60 W light?", "=1200/60").join() === "1200");
  // 1.8.5: three more slips from bench run 4 that ran and gave wrong numbers
  ok("check: a worked step the last line ignores", /=40\*5 \(200\) is worked out but never used afterwards/.test(flagsFor(
    "A family of 5 uses 40 litres of water per person per day. How many days does a 2000 litre tank last?", "=40*5\n=2000/2000\nANSWER: {result} days").join("")) &&
    !CK.unusedSteps("=40*5\n=2000/200").length && !CK.unusedSteps("=40*5\n=2000/ANS").length && !CK.unusedSteps("=0.15*30\n=0.15*30*(60*5/1000)").length);
  ok("check: seconds turned into the wrong time unit", /divide by 3600 \(the formula divides by 60\)/.test(flagsFor(
    "A satellite orbits 35786 km above the equator. How long is one orbit, in hours?",
    "=ORBITT(PLANET(\"Earth\",\"radius\")+CONVERT(35786,\"km\",\"m\"),PLANET(\"Earth\",\"gm\"))/60\nANSWER: {result} hours").join("")) &&
    !CK.timeUnit("in hours?", "=ORBITT(7000000)\n=ANS/3600") && !CK.timeUnit("in hours?", "=ORBITT(7000000)/60/60") &&
    !!CK.timeUnit("How long, in minutes?", "=ORBITT(7000000)") && !CK.timeUnit("How long is it?", "=ORBITT(7000000)"));
  // 1.9.2: three chain slips from bench run 5 (35B)
  ok("check: a step lost because ANS is only the line before", CK.unusedSteps("=60*5/1000\n=100*5/1000\n=ANS+ANS\n=ANS*30\n=ANS*0.15").length === 1 &&
    CK.unusedSteps("=60*5/1000\n=100*5/1000\n=ANS+ANS\n=ANS*30\n=ANS*0.15")[0].step === "60*5/1000" &&
    !CK.unusedSteps("=5*3\n=ANS*7").length && !CK.unusedSteps("=2000/15\n=ANS/60").length);
  ok("check: a line with ANS written twice", CK.repeatedStep("=150/10\n=420/ANS\n=420/ANS") === "420/ANS" && !CK.repeatedStep("=150/10\n=420/ANS"));
  ok("check: a time conversion the question's rate does not need", !!CK.extraTimeStep("How many hours does it take to drive 26 miles at 40 km/h?",
      "=CONVERT(26,\"mile\",\"km\")\n=ANS/40\n=ANS/24") &&
    !CK.extraTimeStep("A tank holds 2000 litres and water flows in at 15 litres per minute. How many hours to fill it?", "=2000/15/60") &&
    !CK.extraTimeStep("A bus travels 180 km at 60 km/h. How many hours does the trip take?", "=180/60") &&
    !CK.extraTimeStep("A 2 kW heater runs 3 hours a day for 30 days. How many kWh does it use?", "=2*3*30"));
  ok("bench summary keeps library facts apart", (function () { var sm = L.aiBench.summary([{ cat: "fact", pass: true, ms: 1 }, { cat: "tool", pass: true, ms: 1 }]);
    return sm.library.n === 1 && sm.core.n === 1; })());
  ok("check: multiplying by 1 stands in for a missing number", CK.timesOne("=60*1/1000") && CK.timesOne("=1*60") &&
    !CK.timesOne("=(1-VELDIL(3e7))*86400") && !CK.timesOne("=12*15") && !CK.timesOne("=60*1.5"));
  // added after bench run 6 (1.9.2, 4B): "=60/1" for a battery nobody sized,
  // and a conversion worked out and then done backwards by hand
  ok("check: dividing by 1 stands in for a missing number too", CK.timesOne("=60/1") && CK.timesOne("=ANS/1") &&
    !CK.timesOne("=60/10") && !CK.timesOne("=60/1000") && !CK.timesOne("=60/1.5"));
  // 1.9.7: bench run 7 (35B): =ANS1+ANS2 for two separate results
  var pb = "=60*5/1000\n=100*5/1000\n=ANS1+ANS2\n=ANS3*30\n=ANS4*0.15";
  ok("ANS1, ANS2 ... name earlier lines' results", Math.abs(A.run(pb).value - 3.6) < 1e-9 && A.run(pb).steps.every(function (x) { return x.ok; }) &&
    A.run("=2\n=3\n=ANS1*10+ANS").value === 23);
  ok("ANSn says what is wrong: a line not yet worked out, or one that failed", /ANS3 is not a line before this one \(there are 2\)/.test(A.run("=2\n=3\n=ANS3").steps[2].err) &&
    /ANS1 has no result: line 1 failed/.test(A.run("=FOO(1)\n=ANS1*2").steps[1].err) &&
    /Unknown name ANS1/.test((function () { try { L.formula.evaluate("ANS1+1", { ans: 0 }); return ""; } catch (e) { return e.message; } })()));
  ok("the prompts tell the AI about ANS1 and ANS2", /ANS1 the first line's, ANS2 the second's/.test(A.buildPrompt("q", [])) &&
    /ANS1 the first line's, ANS2/.test(L.CHAT.buildSystem("A 12 V pump draws 5 A. How many watts?")));
  ok("check: a line named by ANSn is used; a numbered ANS written twice is not a slip", !CK.unusedSteps(pb).length &&
    CK.unusedSteps("=60*5/1000\n=100*5/1000\n=ANS2*30").length === 1 && !CK.repeatedStep("=5\n=ANS1*2\n=ANS1*2") &&
    CK.repeatedStep("=150/10\n=420/ANS\n=420/ANS") === "420/ANS");
  ok("a recipe's blanks left in say so", /the recipe's blanks \{ah\}, \{v\}, \{w\} were left in/.test(A.run("=({ah}*{v})/{w}").steps[0].err) &&
    A.run("=({100}*{12})/{60}").value === 20);
  var pq = "A 60 W bulb and a 100 W TV each run 5 hours a day. Electricity costs 0.15 dollars per kWh. What does that cost over 30 days, in dollars?";
  var pr = await A.solve(pq, { call: function () { return Promise.resolve(pb + "\nANSWER: The cost over 30 days is {result} dollars."); } });
  ok("run 7's power-bill reply now runs, unquestioned, in one round", pr.rounds === 1 && Math.abs(pr.run.value - 3.6) < 1e-9 && !pr.flags.length && !pr.kind &&
    L.aiBench.grade(L.aiBenchQuestions.filter(function (x) { return x.id === "power-bill"; })[0], pr.text, pr).pass, pr);
  var mq = "How many hours does it take to drive 26 miles at 40 km/h?";
  ok("check: a conversion of a given number that nothing uses", CK.unusedSteps("=CONVERT(26,\"mile\",\"km\")\n=26/1.609344\n=26/1.609344/40", mq).length === 1 &&
    !CK.unusedSteps("=CONVERT(26,\"mile\",\"km\")\n=ANS/40", mq).length &&
    !CK.unusedSteps("=CONVERT(26,\"mile\",\"km\")\n=CONVERT(26,\"mile\",\"km\")/40", mq).length &&
    !CK.unusedSteps("=PLANET(\"Earth\",\"radius\")\n=ORBITT(6371000+420000)/60", "How long is an orbit at 420 km, in minutes?").length);
  var qs2 = [], sq = await A.solve("How much feed do my goats need for 30 days?", { call: function (m) { qs2.push(m.slice());
    return Promise.resolve(qs2.length === 1 ? "=FEEDKG(2,30,800)\nANSWER: {result} kg" : "NEED: How many goats, and how many grams each a day?"); } });
  ok("solve: a questioned formula goes back with Lantern's reason, and a NEED is kept", sq.rounds === 2 && sq.kind === "questioned" && sq.fixed &&
    !!sq.parsed.need && /800/.test(qs2[1][2].content) && /NEED/.test(qs2[1][2].content), sq);
  var sq2 = await A.solve(qAlt2, { call: function () { return Promise.resolve("=HOHMANNT(CONVERT(300+6371,\"km\",\"m\"),CONVERT(35786,\"km\",\"m\"))/3600\nANSWER: {result} h"); } });
  ok("solve: when the second try is questioned too, the doubt is kept for the person", sq2.rounds === 2 && !sq2.fixed && sq2.flags.length === 1, sq2);
  var needItem = Q.filter(function (x) { return x.id === "need-battery"; })[0];
  ok("need questions pass only by asking", L.aiBench.grade(needItem, "NEED: the battery's amp-hours and volts").pass &&
    !L.aiBench.grade(needItem, "=100*12/60\nANSWER: {result} hours").pass && !L.aiBench.grade(needItem, "ANSWER: Not in my library.").pass);
  var F = L.formula, conv = [["CONVERT(120*80,\"m^2\",\"ha\")", 0.96], ["CONVERT(2000,\"litres\",\"cubic metres\")", 2],
    ["CONVERT(2000,\"liter\",\"m^3\")", 2], ["CONVERT(2,\"tonnes\",\"kg\")", 2000], ["CONVERT(1,\"hectares\",\"square metres\")", 10000],
    ["CONVERT(1,\"sq km\",\"ha\")", 100], ["CONVERT(1,\"year\",\"day\")", 365.25], ["CONVERT(5,\"kilograms\",\"pounds\")", 11.0231]];
  conv.forEach(function (c) {
    var v = null; try { v = F.evaluate(c[0], { deg: false, ans: 0 }); } catch (e) { v = e.message; }
    ok("CONVERT understands " + c[0], typeof v === "number" && Math.abs(v - c[1]) < Math.abs(c[1]) * 1e-4, v);
  });
  ok("{result} becomes Lantern's number", A.finalAnswer("It lasts {result} hours.", 20).text === "It lasts 20 hours.");
  ok("a sentence with the wrong number is flagged", A.finalAnswer("About 1,500,000 J.", 375000).mismatch === true);
  ok("the same number in another unit is not called wrong, but is noted", !A.finalAnswer("It takes 92.3 minutes.", 5537).mismatch &&
    A.finalAnswer("It takes 92.3 minutes.", 5537).otherUnit === true && !A.finalAnswer("That is 1.5 kWh.", 1.5).otherUnit);
  ok("a number with nothing computed is unchecked", A.finalAnswer("About 92 minutes.", null).unchecked === true &&
    !A.finalAnswer("Not in my library.", null).unchecked);
  var keItem = Q.filter(function (x) { return x.id === "car-ke"; })[0];
  var gk = L.aiBench.grade(keItem, "=KE(1200,25)\nANSWER: About 1.5 million joules.");
  ok("bench passes the value but records the disagreeing sentence", gk.pass && gk.claim === "disagrees", gk);
  ok("bench summary counts disagreements", L.aiBench.summary([{ cat: "tool", pass: true, claim: "disagrees", ms: 1 },
    { cat: "tool", pass: false, claim: "unchecked", ms: 1 }]).disagree === 1);
  ok("prompt asks for {result} and shows a worked example", /\{result\}/.test(A.buildPrompt("x", [])) && /=300\*5\/1000/.test(A.buildPrompt("x", [])));
  // safety rules
  ["How many paracetamol tablets can I give my 2 year old?", "Can I give my baby ibuprofen syrup, how much?",
   "How much bleach and ammonia should I mix to clean better?", "Can I mix bleach with vinegar?",
   "How do I connect 230 V mains wires to a light switch without turning off the power?"].forEach(function (t) {
    ok("safety rule answers: " + t, !!AI.guard(t), t);
  });
  ["What is the molar mass of water?", "How many moles of hydrochloric acid are in 2 litres of 1 M solution?",
   "What current flows in a 230 V circuit with a 46 ohm heater?", "How much chlorine bleach makes 20 litres of water safe to drink?",
   "A 100 Ah 12 V battery runs a 60 W light. How many hours will it last?", "What dose of fertiliser per hectare?"].forEach(function (t) {
    ok("no safety rule for: " + t, !AI.guard(t), t);
  });
  ok("safety replies hold no numbers", L.aiGuards.every(function (g) { return !/\d/.test(String(g("How many paracetamol tablets for a child, can I mix bleach and ammonia, live 230 V wires") || "")); }));
  mode = "perfect";
  var gtxt = await AI.complete([{ role: "user", content: A.buildPrompt("How many paracetamol tablets can I give my 2 year old?", []) }]);
  ok("guard reads the question out of an Assist prompt", /Not in my library/.test(gtxt) && AI.last.engine === "rule" && AI.lastGuard === "medicine-dose", AI.last);
  var ntxt = await AI.complete([{ role: "user", content: "QUESTION: How many paracetamol tablets can I give my 2 year old?" }], { noGuard: true });
  ok("noGuard reaches the model", AI.last.engine === "device", AI.last);
  // everyday recipe cards
  function card(id) { return L.assistCards.filter(function (c) { return c.id === id; })[0]; }
  function viaCard(id, vals) { return A.run(A.fill(card(id), vals)).value; }
  ok("recipe: tank fill time", Math.abs(viaCard("fill-time", { volume: 2000, rate: 15 }) - 2000 / 15 / 60) < 1e-9);
  ok("recipe: bags round up", viaCard("count-bags", { total_kg: 2010, bag_kg: 50 }) === 41);
  ok("recipe: field in hectares", Math.abs(viaCard("field-area", { len_m: 120, wid_m: 80 }) - 0.96) < 1e-12);
  ok("recipe: recipe scaling", viaCard("scale-recipe", { amount: 3, serves: 6, people: 15 }) === 7.5);
  ok("recipe: feed in kg from grams", viaCard("feed-total", { animals: 20, days: 30, g_day: 800 }) === 480);
  var hb = Q.filter(function (x) { return x.id === "hohmann-geo"; })[0];
  ok("recipe: Hohmann from an altitude", Math.abs(viaCard("hohmann-alt", { alt_km: 400, r2_km: 42164 }) - L.aiBench.expected(hb)) < 1e-6);
  ok("bags question finds the bags recipe", A.match("How many 50 kg bags are in 2 tonnes of maize?").some(function (c) { return c.id === "count-bags"; }));
  ok("Earth escape question finds the planet card", A.match("What is the escape velocity from the surface of the Earth?")[0].id === "planet-escape" &&
    Math.abs(F.evaluate("PLANET(\"earth\",\"escape\")", { deg: false, ans: 0 }) / F.evaluate("ESCV(6371000)", { deg: false, ans: 0 }) - 1) < 0.005);
  ok("orbit question still leads with the orbit recipe", A.match("How long does a satellite take to orbit Earth at 420 km altitude, in minutes?")[0].id === "orbit-period");

  // The AI app
  mode = "perfect";
  var saved = [];
  L.download = function (name, text) { saved.push({ name: name, text: text }); };
  go("ai"); await sleep(20);
  ok("AI app shows the engine in use", /Answers come from: on this device: fake perfect/.test(d.body.textContent));
  ok("panels render in order", ["On this device", "Offline and install", "Server", "Try it", "Prompt size", "Lantern Bench"].every(function (t) {
    return Array.prototype.some.call(d.querySelectorAll(".la-sec h3"), function (h) { return h.textContent.indexOf(t) === 0; }); }));
  ok("device panel explains it needs a web address here", /needs Lantern opened from a web address/.test(d.body.textContent));
  btn(d, "Server").click(); await sleep(5);
  ok("engine choice saved", L.store.get("ai.engine") === "server" && AI.resolve() === "server");
  btn(d, "Automatic").click(); await sleep(5);
  btn(d, "Ask").click(); await sleep(30);
  ok("Try it shows a reply and speed", /tokens\/s/.test(d.body.textContent) && d.querySelector(".la-mono"));
  btn(d, "Quick run").click(); await sleep(80);
  ok("bench panel lists results", d.querySelectorAll(".la-tbl tbody tr").length === L.aiBenchQuestions.filter(function (x) { return x.quick && x.cat !== "fact"; }).length);
  ok("bench summary line", /Lantern Bench quick: \d+\/\d+ \(100%\)/.test(d.body.textContent));
  btn(d, "Save results (JSON)").click();
  ok("results saved as JSON", saved.length === 1 && /\.json$/.test(saved[0].name) && JSON.parse(saved[0].text).summary.score === 100);
  go("chat"); await sleep(20);
  ok("Chat shows which AI answers", /Using on this device: fake perfect/.test(d.body.textContent));
  // Chat renders a model's markdown readably and says when an answer was cut short
  AI.register("device", { available: function () { return true; }, label: function () { return "fake md"; },
    complete: function () { AI.lastFinish = "length"; return Promise.resolve("**Mars** has `PLANET` data\n# Steps\n=PLANET(\"Mars\",\"escape\")\nANSWER: about 5.03 km/s"); } });
  var mi = d.querySelector("input[aria-label=\"Message\"]");
  mi.value = "escape velocity from Mars"; btn(d, "Send").click(); await sleep(60);
  var logEl = d.querySelector("[aria-label=\"Conversation\"]");
  ok("markdown shown as bold and code, not stars", logEl.querySelector("b") && /Mars/.test(logEl.querySelector("b").textContent) &&
    logEl.querySelector("code") && logEl.textContent.indexOf("**") === -1, logEl.innerHTML.slice(-600));
  ok("Lantern computes the escape velocity from NASA data", /5,?027/.test(logEl.textContent), logEl.textContent.slice(-300));
  ok("cut-short answers say so", /cut short/.test(logEl.textContent));
  ok("PLANET is in the AI tool list and recipe cards", /PLANET\(/.test(A.toolCard()) && A.match("escape velocity from mars").some(function (c) { return c.id === "planet-escape"; }));

  var st = L.selftest.run();
  ok("selftests pass (incl. AI)", st.fail.length === 0 && L.selftest.tests.filter(function (t) { return /^ai: /.test(t.name); }).length === 8, st.fail);
  ok("no errors at the end", errs.length === 0, errs);
  console.log(fails ? fails + " AI LAYER FAILURES (" + passes + " passed)" : "ALL AI LAYER TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
