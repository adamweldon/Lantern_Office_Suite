// starter_page_fresh.js -- Lantern under its starter hears that its AI has come (1.24.22). Adam's laptop, 2026-11-16:
// the page was opened while the starter was still fetching the AI. The offline worker kept the starter's first status
// ("downloading") and gave it back to every later ask, so the page never heard the AI had come, never asked its own
// address again, and Automatic chose the in-page AI: every bench question failed with "still arriving: downloading".
//  - the offline worker never keeps /lantern-setup/ nor anything its server marks no-store;
//  - a question asked with no server known asks Lantern's own address again first.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path"), vm = require("vm");
var ROOT = path.join(__dirname, "..");
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  // --- the offline worker -------------------------------------------------------------------------------------------
  var sw = fs.readFileSync(path.join(ROOT, "site", "lantern-sw.js"), "utf8"), handlers = {}, puts = [];
  function Resp(body, headers) { this.ok = true; this.status = 200; this.type = "basic"; this.body = body; this.headers = { get: function (h) { return (headers || {})[h] || null; } }; }
  Resp.prototype.clone = function () { return this; };
  var box = {
    self: { location: { href: "http://127.0.0.1:8080/lantern-sw.js", origin: "http://127.0.0.1:8080" }, addEventListener: function (t, f) { handlers[t] = f; }, skipWaiting: function () {}, clients: { claim: function () {} } },
    caches: { match: function () { return Promise.resolve(null); }, open: function () { return Promise.resolve({ put: function (req) { puts.push(String(req.url)); }, add: function () { return Promise.resolve(); } }); }, keys: function () { return Promise.resolve([]); } },
    fetch: function (req) { return Promise.resolve(/lantern-setup|nostore/.test(req.url) ? new Resp("{}", { "Cache-Control": "no-store" }) : new Resp("x")); },
    URL: URL, Headers: function () {}, Response: function () {}, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout
  };
  vm.createContext(box); vm.runInContext(sw, box);
  function ask(u) {
    var said = null;
    handlers.fetch({ request: { url: u, method: "GET", mode: "cors" }, respondWith: function (p) { said = p; } });
    return said;
  }
  ok("the offline worker does not answer for the starter's status: the starter is asked itself", ask("http://127.0.0.1:8080/lantern-setup/status") === null);
  ok("...nor for the AI's own address", ask("http://127.0.0.1:8080/v1/models") === null);
  var p1 = ask("http://127.0.0.1:8080/ai/wllama/index.js"), p2 = ask("http://127.0.0.1:8080/nostore.json");
  await p1; await p2; await sleep(20);
  ok("a file of Lantern's is kept, as before", puts.indexOf("http://127.0.0.1:8080/ai/wllama/index.js") >= 0, puts);
  ok("...and what its server marks no-store is not", puts.indexOf("http://127.0.0.1:8080/nostore.json") < 0, puts);

  // --- the page: asks its own address again before a question --------------------------------------------------------
  var inner = fs.readFileSync(path.join(ROOT, "src", "lantern.inner.html"), "utf8"), js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, engine = false, calls = [];
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.HTMLElement.prototype.scrollIntoView = function () {}; w.scrollTo = function () {};
  w.fetch = function (u, o) {
    u = String(u); calls.push(u);
    if (/\/v1\/models$/.test(u)) return Promise.resolve(engine ? { ok: true, status: 200, json: function () { return Promise.resolve({ data: [{ id: "Qwen3.5-9B-Q4_K_M.gguf" }] }); } } :
      { ok: false, status: 404, json: function () { return Promise.resolve(null); } });
    if (/\/props$/.test(u)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ modalities: { vision: true } }); } });
    if (/chat\/completions$/.test(u)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ choices: [{ message: { content: "ANSWER: hello" } }], usage: { completion_tokens: 3 } }); } });
    // the starter's status, as the offline worker of 1.24.21 kept it: the engine still downloading
    if (/\/lantern-setup\/status$/.test(u)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ v: 1, starter: "1.24.21", lantern: "1.24.21", ai: { state: "none" },
      jobs: [{ id: "engine", state: "running", total: 0, done: 0 }], offers: [] }); } });
    return Promise.reject(new Error("no network"));
  };
  w.eval(js);
  await sleep(60);
  var AI = w.Lantern.ai;
  ok("boot clean; opened before the AI came: no server known, and the starter's status (as kept) says it is downloading", errs.length === 0 && !AI.server.sameOrigin &&
     w.Lantern.lanternSetup.active() && /still arriving: downloading/.test(w.Lantern.aiWaitNote()), [errs, AI.server, w.Lantern.aiWaitNote()]);
  engine = true; calls = [];
  var out = await AI.complete([{ role: "user", content: "hi" }], { noGuard: true });
  ok("a question then asks Lantern's own address again, finds the AI, and asks it there", out === "ANSWER: hello" && AI.server.sameOrigin &&
     calls.indexOf("http://127.0.0.1:8080/v1/chat/completions") >= 0 && !calls.some(function (c) { return /11434/.test(c); }), calls);
  ok("...and says so", /the Lantern server on this computer \(Qwen3\.5-9B-Q4_K_M, sees images\)/.test(AI.describe()), AI.describe());
  console.log(fails ? fails + " STARTER PAGE FRESH FAILURES (" + passes + " passed)" : "ALL STARTER PAGE FRESH CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
