// ai_device_proj.js -- a model's vision part is not a model (1.24.22). Adam's laptop, 2026-11-16: the AI app said
// "Answers come from: on this device: mmproj-Qwen3.5-9B-F16" -- the 9B's vision part, kept beside the model in
// kit/models, had been loaded as the on-device model at the same address (127.0.0.1:8080) some time before, and
// nothing could answer. A browser that remembers one forgets it (and "On this device" goes back to Automatic); a
// file chosen now is refused, with the file to choose.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function boot(stored) {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.HTMLElement.prototype.scrollIntoView = function () {}; w.scrollTo = function () {};
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  Object.keys(stored).forEach(function (k) { w.localStorage.setItem("lantern." + k, JSON.stringify(stored[k])); });
  w.eval(js);
  return { w: w, errs: errs };
}
(async function () {
  var b = boot({ "ai.engine": "device", "ai.device.last": { kind: "cache", names: ["local_mmproj-Qwen3.5-9B-F16.gguf"], label: "mmproj-Qwen3.5-9B-F16" } });
  await sleep(50);
  var L = b.w.Lantern;
  ok("boot clean", b.errs.length === 0, b.errs);
  ok("a vision part remembered as the on-device model is forgotten", L.store.get("ai.device.last", "x") === null, L.store.get("ai.device.last", "x"));
  ok("...and On this device, chosen with it, is Automatic again", L.store.get("ai.engine", "") === "auto", L.store.get("ai.engine", ""));
  ok("...so nothing says it answers on this device", !/mmproj/.test(L.ai.describe()), L.ai.describe());

  var b2 = boot({ "ai.engine": "device", "ai.device.last": { kind: "cache", names: ["local_Qwen3.5-2B-Q4_K_M.gguf"], label: "Qwen3.5-2B-Q4_K_M" } });
  await sleep(50);
  var L2 = b2.w.Lantern;
  ok("a real model remembered is kept, and the choice with it", L2.store.get("ai.device.last", null) && L2.store.get("ai.device.last", null).label === "Qwen3.5-2B-Q4_K_M" && L2.store.get("ai.engine", "") === "device");

  var err = null;
  try { await L.aiDevice.loadFiles([{ name: "mmproj-Qwen3.5-9B-F16.gguf", size: 918166080 }], true); } catch (e) { err = e.message; }
  ok("a vision part chosen now is refused, with the file to choose", /is the vision part of a model \(mmproj\), not a model\. Choose the model file beside it/.test(err || ""), err);
  console.log(fails ? fails + " AI DEVICE PROJ FAILURES (" + passes + " passed)" : "ALL AI DEVICE PROJ CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
