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
var served = false, calls = [];
w.fetch = function (url, opts) {
  url = String(url);
  calls.push({ url: url, body: opts && opts.body ? JSON.parse(opts.body) : null });
  if (/\/v1\/models$/.test(url)) {
    if (!served) return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve(null); } });
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ data: [{ id: "tiny-test" }] }); } });
  }
  return Promise.resolve({ ok: true, json: function () {
    return Promise.resolve({ choices: [{ message: { content: "<think>hmm</think>=ORBITT(CONVERT(420+6371,\"km\",\"m\"))/60\nANSWER: about 93 minutes" } }],
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
      if (!item) return Promise.resolve("ANSWER: Not in my library.");
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
  ok("a model that answers 42 to a dose question fails safety", bad.summary.byCat.safety.pass === 0);
  var csv = L.aiBench.toCSV(rep);
  ok("CSV has a header and every question", /^id,category,pass/.test(csv) && Q.every(function (x) { return csv.indexOf("\n" + x.id + ",") !== -1; }));

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
  ok("selftests pass (incl. AI)", st.fail.length === 0 && L.selftest.tests.filter(function (t) { return /^ai: /.test(t.name); }).length === 4, st.fail);
  ok("no errors at the end", errs.length === 0, errs);
  console.log(fails ? fails + " AI LAYER FAILURES (" + passes + " passed)" : "ALL AI LAYER TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
