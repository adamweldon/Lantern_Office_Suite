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
  ok("version 1.8", /^1\.8\./.test(L.version), L.version);
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
  var Q = L.aiBenchQuestions, byQ = {};
  Q.forEach(function (x) { byQ[x.q] = x; });
  var mode = "perfect";
  AI.register("device", { available: function () { return true; }, chosen: function () { return true; },
    label: function () { return "fake " + mode; },
    complete: function (msgs) {
      var m = /QUESTION: (.+)$/m.exec(msgs[msgs.length - 1].content), item = m && byQ[m[1]];
      if (mode === "bad") return Promise.resolve("ANSWER: 42");
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
  var rep = await L.aiBench.run({ quick: false });
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
  var sl = await L.aiBench.run({ quick: false });
  var hrow = sl.rows.filter(function (r) { return r.id === "hohmann-geo"; })[0];
  ok("bench records a formula fixed on the second turn", hrow.pass && hrow.rounds === 2 && hrow.fixed && /inside the Earth/.test(hrow.rejected) &&
    sl.summary.retried === 1 && sl.summary.fixedOnRetry === 1, hrow);
  mode = "perfect";
  var csv = L.aiBench.toCSV(rep);
  ok("CSV has a header and every question", /^id,category,set,pass/.test(csv) && Q.every(function (x) { return csv.indexOf("\n" + x.id + ",") !== -1; }));

  // 1.8.2: fixes from the first real bench run (Qwen3.5 4B on a laptop, 18/30)
  ok("report keeps earlier, fresh and hard questions apart", rep.summary.core.n + rep.summary.fresh.n + rep.summary.hard.n === Q.length &&
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
  var sv1 = await A.solve("x", { call: function () { return Promise.resolve("=2*3\nANSWER: {result}"); } });
  var sv2 = await A.solve("x", { call: function () { return Promise.resolve("NEED: the battery size"); } });
  var sv3 = await A.solve("x", { call: function () { return Promise.resolve("=FOO(1)\nANSWER: x"); }, retries: 0 });
  ok("solve does not retry a good reply, a NEED, or when told not to", sv1.rounds === 1 && sv2.rounds === 1 && sv3.rounds === 1);
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
  ok("bench panel lists results", d.querySelectorAll(".la-tbl tbody tr").length === Q.filter(function (x) { return x.quick; }).length);
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
  ok("selftests pass (incl. AI)", st.fail.length === 0 && L.selftest.tests.filter(function (t) { return /^ai: /.test(t.name); }).length === 6, st.fail);
  ok("no errors at the end", errs.length === 0, errs);
  console.log(fails ? fails + " AI LAYER FAILURES (" + passes + " passed)" : "ALL AI LAYER TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
