// load.js -- loads src/lantern.inner.html's script in jsdom (as tests/liftstation.js does), with a scripted model.
// o.script(lastUserText, body) -> the model's reply; set it before a Chat turn.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs");
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
module.exports = function load(file) {
  var inner = fs.readFileSync(file, "utf8");
  var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, o = { w: w, d: w.document, errs: errs, script: null, textOf: textOf };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url, opts) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-Q4_K_M.gguf" }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    var body = JSON.parse(opts.body);
    var r = o.script ? o.script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
    return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
  };
  w.eval(JS);
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
};
