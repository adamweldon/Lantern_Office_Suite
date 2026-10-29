// ai_server_watch_live.js -- the real kit/lantern-watch.py and the page
// together (1.15.0). A small stand-in for llama-server answers /health 503
// ("Loading model") and then 200; the watcher runs for real against it (this
// process is the "engine" it watches) and serves its status address; the
// page, in jsdom, is opened the way start-lantern opens it (&watch=<port>)
// and reaches the watcher over real HTTP, with the browser's Origin header
// and CORS enforced here the way a browser does. Checks: the page shows the
// watcher's own sentence; another site's origin is refused; ready is found;
// the watcher writes its load summary to the log folder.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), cp = require("child_process");
var root = path.join(__dirname, "..");
var inner = fs.readFileSync(process.argv[2] || path.join(root, "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() {
  return new Promise(function (res, rej) { var s = http.createServer(); s.on("error", rej); s.listen(0, "127.0.0.1", function () { var p = s.address().port; s.close(function () { res(p); }); }); });
}
async function until(fn, ms) { var end = Date.now() + ms; while (Date.now() < end) { var v = await fn(); if (v) return v; await sleep(100); } return null; }

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lantern-watch-live-")), child = null, engine = null, out = "";
(async function () {
  var P = await freePort(), Q = await freePort(), phase = "loading";
  if (Q === P) Q = await freePort();
  var model = path.join(tmp, "Live-Test-Q4_K_M.gguf"), logs = path.join(tmp, "logs");
  fs.writeFileSync(model, Buffer.alloc(8 * 1024 * 1024, 1));
  engine = http.createServer(function (req, res) {
    var u = req.url.split("?")[0];
    function send(code, obj) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); }
    if (phase === "loading") return send(503, { error: { message: "Loading model", type: "unavailable_error", code: 503 } });
    if (u === "/health") return send(200, { status: "ok" });
    if (u === "/v1/models") return send(200, { data: [{ id: "Live-Test-Q4_K_M.gguf" }] });
    if (u === "/props") return send(200, { modalities: { vision: false } });
    send(404, {});
  });
  await new Promise(function (r) { engine.listen(P, "127.0.0.1", r); });
  child = cp.spawn("python3", ["-I", path.join(root, "kit", "lantern-watch.py"), "watch", "--model", model, "--port", String(P), "--status-port", String(Q),
    "--engine-pid", String(process.pid), "--log-dir", logs], { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", function (b) { out += b; }); child.stderr.on("data", function (b) { out += b; });
  var first = await until(function () {
    return fetch("http://127.0.0.1:" + Q + "/status").then(function (r) { return r.json(); }).then(function (j) { return j && j.v === 1 && j.phase !== "starting" ? j : null; }, function () { return null; });
  }, 8000);
  ok("the watcher serves a version-1 status and sees the engine loading", first && first.v === 1 && /^(reading|preparing)$/.test(first.phase) && typeof first.message === "string",
    [first, out.slice(-600)]);
  // CORS: only the page's own address may read it
  var mine = await fetch("http://127.0.0.1:" + Q + "/status", { headers: { Origin: "http://127.0.0.1:" + P } });
  var theirs = await fetch("http://127.0.0.1:" + Q + "/status", { headers: { Origin: "https://example.com" } });
  ok("CORS: Lantern's own address may read the status, another site may not", mine.headers.get("access-control-allow-origin") === "http://127.0.0.1:" + P &&
    theirs.headers.get("access-control-allow-origin") === null, [mine.headers.get("access-control-allow-origin"), theirs.headers.get("access-control-allow-origin")]);

  // the page, opened the way start-lantern opens it
  var vc = new VirtualConsole(), errs = [], refused = 0;
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var url = "http://127.0.0.1:" + P + "/?kit=1&model=Live-Test-Q4_K_M.gguf&bytes=" + fs.statSync(model).size + "&vbytes=0&watch=" + Q + "&t=" + Date.now() + "#ai";
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: url, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, d = w.document, origin = "http://127.0.0.1:" + P;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function (u, opts) {
    u = String(u);
    var at = new URL(u, origin), same = at.origin === origin, ctl = new AbortController();
    if (!same && at.origin !== "http://127.0.0.1:" + Q) return Promise.reject(new w.TypeError("Failed to fetch"));
    if (opts && opts.signal) { if (opts.signal.aborted) ctl.abort(); else opts.signal.addEventListener("abort", function () { ctl.abort(); }); }
    var h = same ? {} : { Origin: origin };
    return fetch(at.href, { method: (opts && opts.method) || "GET", headers: Object.assign(h, (opts && opts.headers) || {}), body: opts && opts.body, signal: ctl.signal }).then(function (r) {
      // what a browser does with a cross-origin answer that does not allow this page
      if (!same && r.headers.get("access-control-allow-origin") !== origin) { refused++; throw new w.TypeError("Failed to fetch (CORS)"); }
      return r;
    });
  };
  w.eval(js);
  w.Lantern.aiServerWait.W.POLL = 200;
  var ev = d.createEvent("Event"); ev.initEvent("DOMContentLoaded", true, true); d.dispatchEvent(ev);
  var L = w.Lantern;
  var got = await until(function () { return L.aiServerWait.watch(); }, 6000);
  await sleep(450);
  var sentence = d.querySelector(".lw-box > p:not(.wt-advice):not(.lw-warn)"), st = L.aiServerWait.watch();
  ok("the page reads the real watcher through CORS and shows its sentence", got && refused === 0 && st && sentence && sentence.textContent === st.message &&
    L.aiServerWait.estimate(Date.now()).watchFresh === true, [refused, st && st.message, sentence && sentence.textContent]);

  // the model is ready
  phase = "ready";
  var done = await until(function () { return L.aiServerWait.mode() === "done"; }, 6000);
  var took = (L.store.get("ai.server.loadMs", {}) || {})["Live-Test-Q4_K_M"];
  ok("ready: the page connects and remembers a load time", done && L.ai.server.state === "ready" && took > 0, [L.aiServerWait.mode(), L.ai.server.state, took]);
  var fin = await until(function () {
    return fetch("http://127.0.0.1:" + Q + "/status").then(function (r) { return r.json(); }).then(function (j) { return j.phase === "ready" ? j : null; }, function () { return null; });
  }, 6000);
  ok("the watcher says ready, with its load time", fin && fin.loadMs > 0 && /is ready/.test(fin.message), fin);
  var summary = await until(function () { return fs.existsSync(path.join(logs, "loads.csv")) && fs.existsSync(path.join(logs, "last-load.json")); }, 4000);
  ok("the load summary is in the log folder (loads.csv, last-load.json)", !!summary, fs.existsSync(logs) ? fs.readdirSync(logs) : "no folder");
  ok("no page errors", errs.length === 0, errs);
  w.close();
})().catch(function (e) { fails++; console.log("FAIL crashed", e && e.stack, out.slice(-600)); }).then(function () {
  try { if (child) child.kill("SIGTERM"); } catch (e) { /* gone */ }
  try { if (engine) engine.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* left in the temp folder */ }
    console.log(fails ? fails + " LIVE WATCH FAILURES (" + passes + " passed)" : "ALL LIVE WATCH TESTS PASS (" + passes + ")");
    process.exit(fails ? 1 : 0);
  }, 300);
});
