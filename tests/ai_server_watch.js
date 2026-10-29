// ai_server_watch.js -- the loading screen with Lantern Watch (1.15.0). The
// kit's watcher (kit/lantern-watch.py, .ps1) answers
// http://127.0.0.1:<port>/status while the model loads, and the start script
// adds &watch=<port> to the address. The page must take the measured
// progress and time left, say what the watcher says, put its advice on a line
// of its own (first, as a warning, when memory has run out), never move the
// bar back, remember the watcher's load time, keep its pace when the watcher
// hangs, and ask nothing when the hint is missing or the page is not on the
// kit's own computer. Statuses: tests/fixtures/watch_status_examples.json
// (the watcher's own examples).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var EX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "watch_status_examples.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function status(name, over) {
  var s = JSON.parse(JSON.stringify(EX[name]));
  Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
  s.t = Date.now();
  return s;
}
// boot(url, server, watch) -> {w, d, L, errs, asked}. server.phase: "loading"
// | "ready" | "down"; watch.mode: "answer" (watch.status) | "down" | "hang"
function boot(url, server, watch) {
  var vc = new VirtualConsole(), errs = [], asked = { watch: [], health: 0, signals: [] };
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: url, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function (u, opts) {
    u = String(u);
    if (/:8081\//.test(u)) return Promise.reject(new TypeError("no library"));
    if (/^http:\x2F\x2F127\.0\.0\.1:\d+\x2Fstatus$/.test(u) && !/:8080\x2F/.test(u)) {
      asked.watch.push(u); if (opts && opts.signal) asked.signals.push(opts.signal);
      if (watch.mode === "down") return Promise.reject(new TypeError("Failed to fetch"));
      if (watch.mode === "hang") return new Promise(function () {});
      var st = typeof watch.status === "function" ? watch.status() : watch.status;
      return resp(200, JSON.stringify(st));
    }
    if (/\/health$/.test(u)) asked.health++;
    var ph = server.phase;
    if (ph === "down") return Promise.reject(new TypeError("Failed to fetch"));
    if (ph === "loading") return resp(503, JSON.stringify({ error: { message: "Loading model", type: "unavailable_error", code: 503 } }));
    if (/\/health$/.test(u)) return resp(200, JSON.stringify({ status: "ok" }));
    if (/\/v1\/models$/.test(u)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-Q4_K_M.gguf" }] }));
    if (/\/props$/.test(u)) return resp(200, JSON.stringify({ modalities: { vision: true } }));
    return resp(404, "{}");
  };
  w.eval(js);
  if (w.Lantern.aiServerWait) { w.Lantern.aiServerWait.W.POLL = 25; w.Lantern.aiServerWait.W.SLOW = 40; }
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  return { w: w, d: w.document, L: w.Lantern, errs: errs, asked: asked };
}
function veil(d) { var v = d.querySelector(".lw-veil"); return !v ? "none" : v.style.display === "none" ? "hidden" : "shown"; }
function pill(d) { var p = d.querySelector(".lw-pill"); return p && p.style.display !== "none" ? p.textContent : ""; }
function what(d) { return d.querySelector(".lw-box > p:not(.wt-advice):not(.lw-warn)"); }
function advice(d) { return d.querySelector(".wt-advice"); }
function pct(d) { return +d.querySelector(".lw-bar").getAttribute("aria-valuenow"); }
function kitUrl(host, extra) {
  return "http://" + host + ":8080/?kit=1&model=Qwen3.5-35B-A3B-Q4_K_M.gguf&bytes=18100000000&vbytes=0" + extra + "&t=" + (Date.now() - 4000) + "#ai";
}
var all = [];

(async function () {
  // --- the kit opens the page; the watcher measures the stick -------------------------------
  var server = { phase: "loading" }, watch = { mode: "answer", status: function () { return status("reading"); } };
  var A = boot(kitUrl("127.0.0.1", "&watch=8082"), server, watch), L = A.L, d = A.d;
  all.push(A);
  await sleep(200);
  ok("boot clean, the address tidied, the watcher's port kept with the loading record", A.errs.length === 0 && A.w.location.search === "" &&
    L.store.get("ai.server.loading", {}).watch === 8082, [A.errs, A.w.location.href, L.store.get("ai.server.loading", null)]);
  ok("the watcher is asked at 127.0.0.1:8082/status, alongside /health", A.asked.watch.length >= 2 && A.asked.watch[0] === "http://127.0.0.1:8082/status" && A.asked.health >= 2,
    [A.asked.watch.slice(0, 2), A.asked.health]);
  ok("its sentence replaces the guess: what is read, from where, how fast", veil(d) === "shown" &&
    what(d).textContent === EX.reading.message, what(d).textContent);
  ok("the bar is the measured progress (42%), and the time left is the watcher's", pct(d) === 42 && /about 1 min 29 s left/.test(d.querySelector(".lw-row").textContent),
    [pct(d), d.querySelector(".lw-row").textContent]);
  var e = L.aiServerWait.estimate(Date.now());
  ok("estimate(): how “watch”, p and left measured, the status with it", e.how === "watch" && e.p === 0.4241 && e.left === 88846 && e.watchFresh === true && e.watch.code === "reading", e);
  ok("no advice: no advice line", advice(d).style.display === "none" && advice(d).textContent === "");
  ok("still asks to keep the page and the black window open", /keep this page and the black Lantern window open/.test(d.querySelector(".lw-warn").textContent));
  ok("watch() is the last status", L.aiServerWait.watch() && L.aiServerWait.watch().code === "reading");

  // --- the bar never moves back ---------------------------------------------------------------------
  watch.status = function () { return status("reading", { progress: 0.3, leftMs: 120000 }); };
  await sleep(150);
  ok("a lower measured progress does not move the bar back", pct(d) === 42 && L.aiServerWait.estimate(Date.now()).p === 0.3, pct(d));
  watch.status = function () { return status("reading", { progress: 0.6 }); };
  await sleep(150);
  ok("...and a higher one moves it on", pct(d) === 60, pct(d));

  // --- a slow stick: the advice on its own line, after the sentence -----------------------
  watch.status = function () { return status("reading-slow", { progress: 0.65 }); };
  await sleep(150);
  ok("a slow stick: the advice is shown on its own line, after the sentence, not as a warning", advice(d).style.display === "" &&
    advice(d).textContent === EX["reading-slow"].advice && what(d).nextSibling === advice(d) && !/wt-heavy/.test(advice(d).className) &&
    advice(d).getAttribute("role") === "status", [advice(d).textContent, advice(d).className]);

  // --- out of memory: the advice first, as a warning ------------------------------------------
  watch.status = function () { return status("pressure", { progress: 0.66 }); };
  await sleep(150);
  ok("heavy memory pressure: the advice comes first, as a warning (please wait, do not click)", advice(d).nextSibling === what(d) &&
    /wt-heavy/.test(advice(d).className) && advice(d).getAttribute("role") === "alert" && /do not click/.test(advice(d).textContent) &&
    what(d).textContent === EX.pressure.message, [advice(d).className, advice(d).textContent]);
  var away = Array.prototype.filter.call(d.querySelectorAll(".lw-box button"), function (b) { return /while it loads/.test(b.textContent); })[0];
  away.onclick();
  ok("the corner button says so too", /^AI loading 66% — low memory, please wait$/.test(pill(d)), pill(d));
  d.querySelector(".lw-pill").onclick();
  // the computer is too slow to answer: the progress goes stale, the warning stays a minute
  var later = L.aiServerWait.estimate(Date.now() + 8000), muchLater = L.aiServerWait.estimate(Date.now() + 70000);
  ok("no answer for 5 s: back to the size-based guess, but the out-of-memory status is kept for a minute", later.how === "size" && later.watchFresh === false &&
    later.watch && later.watch.pressure === "heavy" && !muchLater.watch, [later.how, later.watchFresh, !!muchLater.watch]);
  A.w.Lantern.aiServerWait.W.view.paint({ state: "loading", kit: true, est: later, downLong: false });
  ok("...and painted that way: the guess's sentence, the warning still first", /is being read from the drive into memory/.test(what(d).textContent) &&
    advice(d).nextSibling === what(d) && /do not click/.test(advice(d).textContent), what(d).textContent);
  var calm = L.aiServerWait.estimate(Date.now()); calm.watch = status("reading", { progress: 0.7 });
  A.w.Lantern.aiServerWait.W.view.paint({ state: "loading", kit: true, est: calm, downLong: false });
  ok("memory frees up: the warning goes and the advice line moves back under the sentence", advice(d).style.display === "none" && what(d).nextSibling === advice(d));

  // --- ready: the watcher's load time is remembered -----------------------------------------------
  watch.status = function () { return status("ready"); };
  server.phase = "ready";
  await sleep(250);
  var took = L.store.get("ai.server.loadMs", {})["Qwen3.5-35B-A3B-Q4_K_M"];
  ok("ready: connected, and the watcher's load time (2 min 30 s) is the one remembered", L.ai.server.state === "ready" && L.aiServerWait.mode() === "done" && took === 150000,
    [L.ai.server.state, L.aiServerWait.mode(), took]);
  var n = A.asked.watch.length; await sleep(150);
  ok("after ready the watcher is not asked again", A.asked.watch.length === n);

  // --- a watcher that hangs: /health keeps its pace ---------------------------------------------------
  server = { phase: "loading" };
  var H = boot(kitUrl("127.0.0.1", "&watch=8082"), server, { mode: "hang" });
  all.push(H);
  await sleep(2100);
  ok("a hung watcher: given up after 900 ms (the fetch aborted), /health still asked, the guess shown", H.asked.health >= 3 && H.asked.signals.length >= 1 &&
    H.asked.signals[0].aborted === true && H.L.aiServerWait.estimate(Date.now()).how === "size" && /is being read from the drive into memory/.test(what(H.d).textContent),
    [H.asked.health, H.asked.signals.length, H.asked.signals[0] && H.asked.signals[0].aborted]);
  ok("...and one question at a time (the hung one is not asked again on top)", H.asked.watch.length <= 3, H.asked.watch.length);
  H.w.close();

  // --- a watcher that answered, then start-lantern stopped -------------------------------------
  server = { phase: "loading" };
  var watchS = { mode: "answer", status: function () { return status("reading"); } }, S = boot(kitUrl("127.0.0.1", "&watch=8082"), server, watchS);
  all.push(S);
  await sleep(200);
  ok("(the watcher answers)", what(S.d).textContent === EX.reading.message);
  server.phase = "down"; watchS.mode = "down";
  await sleep(300);
  ok("both stop answering: waiting, for now", /Waiting for the AI server/.test(what(S.d).textContent), what(S.d).textContent);
  var skew = 6000, realNow = S.w.Date.now;
  S.w.Date.now = function () { return realNow.call(S.w.Date) + skew; };
  await sleep(150);
  ok("after 5 s with neither answering, the screen says the server has stopped (not after a minute)", /not answering\. Is the black Lantern window still open\?/.test(what(S.d).textContent) &&
    advice(S.d).style.display === "none", what(S.d).textContent);
  S.w.close();

  // --- no hint, or not on the kit's computer: nothing is asked ------------------------------------
  server = { phase: "loading" };
  var N = boot(kitUrl("127.0.0.1", ""), server, { mode: "answer", status: function () { return status("reading"); } });
  all.push(N);
  await sleep(200);
  ok("no &watch= (an older start script): the watcher is never asked, the screen is as before", N.asked.watch.length === 0 &&
    /about 2 min 40 s from a USB stick/.test(what(N.d).textContent), [N.asked.watch.length, what(N.d).textContent]);
  N.w.close();
  var P = boot(kitUrl("192.168.1.20", "&watch=8082"), server, { mode: "answer", status: function () { return status("reading"); } });
  all.push(P);
  await sleep(200);
  ok("a phone on the Wi-Fi (the page at the laptop's address): its own 127.0.0.1 is not asked", P.asked.watch.length === 0 && veil(P.d) === "shown", P.asked.watch);
  P.w.close();
  var B = boot(kitUrl("localhost", "&watch=abc"), server, { mode: "answer", status: function () { return status("reading"); } });
  all.push(B);
  await sleep(150);
  ok("a port that is not a number is no port", B.asked.watch.length === 0 && B.L.store.get("ai.server.loading", {}).watch === 0);
  B.w.close();
  var Lh = boot(kitUrl("localhost", "&watch=8099"), server, { mode: "answer", status: function () { return status("smaller-model"); } });
  all.push(Lh);
  await sleep(200);
  ok("on localhost, the port from the hint (LANTERN_WATCH_PORT); the smaller-model note is the advice", Lh.asked.watch[0] === "http://127.0.0.1:8099/status" &&
    /Using Qwen3\.5-9B-Q4_K_M because only 13\.6 GB of memory was free\./.test(advice(Lh.d).textContent) && pct(Lh.d) === 19, [Lh.asked.watch[0], advice(Lh.d).textContent, pct(Lh.d)]);
  Lh.w.close();
  // a status that is not the watcher's (another program on the port) is ignored
  var X = boot(kitUrl("127.0.0.1", "&watch=8082"), server, { mode: "answer", status: { v: 2, phase: "reading", message: "something else" } });
  all.push(X);
  await sleep(200);
  ok("an answer that is not a version-1 status is ignored", X.L.aiServerWait.watch() === null && /is being read from the drive into memory/.test(what(X.d).textContent));
  X.w.close();

  var errs = [].concat.apply([], all.map(function (b) { return b.errs; }));
  ok("no errors", errs.length === 0, errs);
  console.log(fails ? fails + " SERVER WATCH FAILURES (" + passes + " passed)" : "ALL SERVER WATCH TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
