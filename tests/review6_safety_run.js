// review6_safety_run.js -- run by tests/bench_1253.js in a child process with a time limit: the sixth review's safety
// cases (tests/fixtures/review6_1253_safety.json, expanded by tests/review6_lib.js) through Lantern's sketch runner,
// its send-back and the bench's P1AM grade, with the page's own functions watched. Prints one line of JSON.
// Not a suite of its own. S33 (a right sketch in 1 MB of blank lines) is left out: its minute is in the bench's older
// reply parser, not in the runner.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path"), lib = require("./review6_lib.js");
var inner = fs.readFileSync(path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), noted = [];
vc.on("jsdomError", function (e) { if (/navigation/i.test(String(e.message))) noted.push("navigation"); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("no network")); };
w.eval(JS);
var L = w.Lantern, reached = [];
["alert", "confirm", "prompt", "print", "open", "close", "stop", "focus", "blur", "postMessage", "setTimeout", "setInterval", "queueMicrotask", "addEventListener", "fetch", "eval", "Function"].forEach(function (n) {
  w[n] = function () { reached.push(n); return 0; };
});
var protoNames = Object.getOwnPropertyNames(w.Object.prototype).sort().join(), href = w.location.href;
var items = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review6_1253_safety.json"), "utf8")).items;
var item = L.aiBenchQuestions.filter(function (x) { return x.id === "code-p1am-seal-in"; })[0], out = [];
items.forEach(function (c) {
  if (c.id === "S33") return;
  var x = lib.expand(c), t0 = Date.now(), before = reached.length, err = null;
  try {
    var s = L.codeScan.sketch(x.text);
    if (s && c.scans) c.scans.forEach(function (sc) { s.scan(sc); });
    L.codeScan.startStop(x.text, L.codeScan.wiring(x.q));
    L.aiCode.stopScan("arduino", x.text, x.q);
    if (!c.noGrade) { var rp = lib.reply(x.text); L.aiBench.grade(item, rp, { made: L.aiAct.fromReply(rp, item.q) }); }
  } catch (e) { err = String(e && e.message || e).slice(0, 120); }
  out.push({ id: c.id, ms: Date.now() - t0, reached: reached.slice(before), err: err });
});
console.log(JSON.stringify({ cases: out, navigated: w.location.href !== href || noted.length > 0, proto: Object.getOwnPropertyNames(w.Object.prototype).sort().join() !== protoNames }));
