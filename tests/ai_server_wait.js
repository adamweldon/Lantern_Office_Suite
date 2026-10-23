// ai_server_wait.js -- Lantern opened by the kit while its model is still
// loading (1.12.8): llama-server answers only the page and 503 "Loading
// model" for everything else until the model is read. The page must show a
// progress bar, connect by itself the moment the model is ready, remember
// how long it took, and show nothing on a host with no model server.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
// boot(url, server, storage) -> {w, d, L, errs}. server.phase: "loading" |
// "ready" | "down" | "plain"
function boot(url, server, storage) {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: url, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  Object.keys(storage || {}).forEach(function (k) { w.localStorage.setItem(k, storage[k]); });
  w.fetch = function (u, opts) {
    u = String(u);
    if (/:8081\//.test(u)) return Promise.reject(new TypeError("no library"));
    var ph = server.phase;
    if (ph === "down") return Promise.reject(new TypeError("Failed to fetch"));
    if (ph === "plain") return resp(404, "{}");
    if (ph === "loading") return resp(503, JSON.stringify({ error: { message: "Loading model", type: "unavailable_error", code: 503 } }));
    if (/\/health$/.test(u)) return resp(200, JSON.stringify({ status: "ok" }));
    if (/\/v1\/models$/.test(u)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf" }] }));
    if (/\/props$/.test(u)) return resp(200, JSON.stringify({ modalities: { vision: true } }));
    if (/chat\/completions$/.test(u)) return resp(200, JSON.stringify({ choices: [{ message: { content: "ANSWER: 4" }, finish_reason: "stop" }] }));
    return resp(404, "{}");
  };
  w.eval(js);
  if (w.Lantern.aiServerWait) { w.Lantern.aiServerWait.W.POLL = 25; w.Lantern.aiServerWait.W.SLOW = 40; }
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  return { w: w, d: w.document, L: w.Lantern, errs: errs, dom: dom };
}
function veil(d) { var v = d.querySelector(".lw-veil"); return !v ? "none" : v.style.display === "none" ? "hidden" : "shown"; }
function pill(d) { var p = d.querySelector(".lw-pill"); return p && p.style.display !== "none" ? p.textContent : ""; }

(async function () {
  // --- the kit opens the page while the 35B loads --------------------------
  var server = { phase: "loading" }, t0 = Date.now() - 5000;
  var A = boot("http://127.0.0.1:8080/?kit=1&model=Qwen3.5-35B-A3B-UD-IQ4_XS.gguf&bytes=17400000000&vbytes=903000000&t=" + t0 + "#ai", server);
  await sleep(150);
  var L = A.L, d = A.d;
  ok("boot clean", A.errs.length === 0, A.errs);
  ok("the start script's hints are read and the address tidied", A.w.location.search === "" && A.w.location.hash === "#ai", A.w.location.href);
  ok("a 503 from the server is a model still loading, not no server", L.ai.server.state === "loading" && L.ai.resolve() === "server" &&
    /still loading/.test(L.ai.describe()), { st: L.ai.server.state, r: L.ai.resolve(), d: L.ai.describe() });
  var bar = d.querySelector(".lw-bar"), what = (d.querySelector(".lw-box p") || {}).textContent || "";
  ok("a screen over the apps: title, the model and its size, a progress bar that has started", veil(d) === "shown" &&
    d.querySelector(".lw-veil").getAttribute("role") === "dialog" && /Lantern’s AI is loading/.test(d.querySelector("#lw-title").textContent) &&
    /Qwen3\.5-35B-A3B-UD-IQ4_XS \(18\.3 GB\)/.test(what) && /about 2 min 40 s from a USB stick/.test(what) &&
    bar.getAttribute("role") === "progressbar" && +bar.getAttribute("aria-valuenow") >= 2 && +bar.getAttribute("aria-valuenow") < 10, { what: what, now: bar && bar.getAttribute("aria-valuenow") });
  ok("it asks people to keep the page and the black window open", /keep this page and the black Lantern window open/i.test(d.querySelector(".lw-warn").textContent));
  var late = L.aiServerWait.estimate(Date.now() + 3600000);
  ok("past the estimate the bar slows and never reaches the end before the model answers", late.p <= 0.99 && late.p > 0.95 && late.left < 0, late);
  var err = null;
  try { await L.ai.callServer([{ role: "user", content: "2+2" }], {}); } catch (e) { err = e.message; }
  ok("asking while it loads says so (no talk of endpoints)", /still loading/.test(err || ""), err);
  var away = Array.prototype.filter.call(d.querySelectorAll(".lw-box button"), function (b) { return /while it loads/.test(b.textContent); })[0];
  away.onclick();
  ok("“Use the other apps while it loads” moves it to a corner button", veil(d) === "hidden" && /^AI loading \d+% — details$/.test(pill(d)), pill(d));
  d.querySelector(".lw-pill").onclick();
  ok("the corner button brings the screen back", veil(d) === "shown");
  // the model finishes loading: no reload needed
  server.phase = "ready";
  await sleep(200);
  ok("ready: connected by itself, the model named, vision found", L.ai.server.state === "ready" && L.aiServerWait.mode() === "done" &&
    /Qwen3\.5-35B-A3B-UD-IQ4_XS, sees images/.test(L.ai.describe()) && L.ai.canSee(), { st: L.ai.server.state, m: L.aiServerWait.mode(), d: L.ai.describe() });
  ok("the bar fills and says ready", d.querySelector(".lw-bar").getAttribute("aria-valuenow") === "100" && /is ready/.test(d.querySelector("#lw-title").textContent));
  var took = L.store.get("ai.server.loadMs", {})["Qwen3.5-35B-A3B-UD-IQ4_XS"];
  ok("how long this model took is remembered, timed from the server's start", took >= 5000 && took < 9000 && L.store.get("ai.server.lastModel", "") === "Qwen3.5-35B-A3B-UD-IQ4_XS" &&
    !L.store.get("ai.server.loading", null) && L.store.get("ai.server.seen", false) === true, took);
  await sleep(1400);
  ok("the screen goes", veil(d) === "none");
  var reply = await L.ai.complete([{ role: "user", content: "what is 2 + 2" }], {});
  ok("and the AI answers", /4/.test(reply), reply);
  var keep = {};
  for (var i = 0; i < A.w.localStorage.length; i++) { var k = A.w.localStorage.key(i); keep[k] = A.w.localStorage.getItem(k); }
  A.w.close();

  // --- the next start, opened by hand (a phone on the Wi-Fi) ------------------
  server.phase = "loading";
  var B = boot("http://127.0.0.1:8080/#home", server, keep);
  await sleep(150);
  var bwhat = (B.d.querySelector(".lw-box p") || {}).textContent || "";
  ok("the next start says how long it took last time", veil(B.d) === "shown" && /Last time this took [5-8] s\./.test(bwhat), bwhat);
  server.phase = "ready"; await sleep(200);
  ok("and connects when ready", B.L.ai.server.state === "ready" && B.L.aiServerWait.mode() === "done");
  B.w.close();

  // --- the server is not running: the page opened from the browser's copy ---
  server.phase = "down";
  var C = boot("http://127.0.0.1:8080/#home", server, keep);
  await sleep(150);
  ok("this address had a model: a quiet corner button, not a screen over the apps", C.L.ai.server.state === "down" && veil(C.d) === "hidden" &&
    pill(C.d) === "AI server not answering", { v: veil(C.d), p: pill(C.d) });
  server.phase = "loading"; await sleep(150);
  ok("the server starts: the loading screen comes up", C.L.ai.server.state === "loading" && veil(C.d) === "shown", { st: C.L.ai.server.state, v: veil(C.d) });
  server.phase = "ready"; await sleep(200);
  ok("and goes when the model is ready", C.L.ai.server.state === "ready" && C.L.aiServerWait.mode() === "done");
  C.w.close();
  server.phase = "down";
  var C2 = boot("http://127.0.0.1:8080/#home", server, {});
  await sleep(150);
  ok("no model was ever here and the kit did not open it: nothing shows", veil(C2.d) === "none" && pill(C2.d) === "" && C2.L.aiServerWait.mode() === "", C2.L.aiServerWait.mode());
  C2.w.close();

  // --- a web host with no model server (GitHub Pages) -------------------------
  server.phase = "plain";
  var D = boot("https://adamweldon.github.io/Lantern_Office_Suite/#home", server, {});
  await sleep(150);
  ok("GitHub Pages: no server, nothing shows", D.L.ai.server.state === "none" && veil(D.d) === "none" && D.L.aiServerWait.mode() === "", D.L.ai.server.state);
  ok("no errors", A.errs.concat(B.errs, C.errs, C2.errs, D.errs).length === 0, A.errs.concat(B.errs, C.errs, C2.errs, D.errs));
  D.w.close();

  console.log(fails ? fails + " SERVER WAIT FAILURES (" + passes + " passed)" : "ALL SERVER WAIT TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
