// load.js -- Lantern's script from src/lantern.inner.html in jsdom (as tests/bench_1268.js lines 1-30 do), for the
// third reviewer's replays of CONVERT (B) and MAKE SHEET (C). load(cb) calls cb({L, errs}) once the page has settled.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
function load(cb, file) {
  var inner = fs.readFileSync(file || path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html"), "utf8");
  var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(JS);
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  setTimeout(function () { cb({ L: w.Lantern, errs: errs, window: w }); }, 60);
}
module.exports = { load: load };
