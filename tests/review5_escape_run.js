// review5_escape_run.js -- run by tests/bench_1253.js in a child process with a time limit: every sketch of the fifth
// review's escape cases (tests/fixtures/review5_1253_escape.json) through Lantern's sketch runner, the bench's P1AM
// grade and Lantern's send-back, with the page's own functions watched. Prints one line of JSON. Not a suite of its own.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
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
  var f = w[n];
  w[n] = function () { reached.push(n); return typeof f === "function" && /^(setTimeout|setInterval)$/.test(n) ? 0 : undefined; };
});
var href = w.location.href, name0 = w.name;
var items = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review5_1253_escape.json"), "utf8")).items;
var q = L.aiBenchQuestions.filter(function (x) { return x.id === "code-p1am-seal-in"; })[0], out = [];
items.forEach(function (c) {
  var t0 = Date.now(), before = reached.length;
  try {
    var s = L.codeScan.sketch(c.text);
    if (s) { s.scan({ "1:1": 1, "1:2": 1 }); }
    L.codeScan.startStop(c.text, L.codeScan.wiring(q.q));
    L.aiCode.stopScan("arduino", c.text, q.q);
    L.aiAct.fromReply("MAKE CODE: t\nlanguage arduino\n" + c.text + "\nEND", q.q);
  } catch (e) { /* an error is not an escape */ }
  out.push({ id: c.id, ms: Date.now() - t0, reached: reached.slice(before) });
});
console.log(JSON.stringify({ cases: out, navigated: w.location.href !== href || noted.length > 0, name: w.name !== name0 }));
