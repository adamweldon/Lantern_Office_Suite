// storage_full.js -- Lantern started with the browser's storage already full
// (1.16.0): the test write at start is refused, but what is saved must still
// be read (Lantern used to start as if nothing had been saved: every
// document seemed gone); a save then says it failed. A browser that refuses
// every write and holds nothing still runs in memory, as before.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 400)); } }
function boot(prefill) {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
    { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error("offline")); };
  Object.keys(prefill).forEach(function (k) { w.localStorage.setItem(k, prefill[k]); });
  w.Storage.prototype.setItem = function () { var e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; };
  w.eval(js);
  return { w: w, L: w.Lantern, errs: errs };
}
var saved = { "lantern.writer.docs": JSON.stringify({ d1: { id: "d1", title: "My letter", html: "<p>Dear Sir</p>", updated: 1 } }) };
var a = boot(saved);
ok("storage full at start: Lantern still reads what was saved", a.L.store.persistent === true && a.L.writerDocs.list().length === 1 && a.L.writerDocs.list()[0].title === "My letter", a.L.writerDocs.list());
ok("...knows it is full", a.L.store.ok() === false);
ok("...a save says it failed and keeps the change for this session", a.L.store.set("writer.docs", { d1: { id: "d1", title: "Changed", html: "<p>x</p>", updated: 2 } }) === false && a.L.writerDocs.list()[0].title === "Changed");
ok("...and a bar says Not saved", /Not saved/.test((a.w.document.querySelector("[role=alert]") || {}).textContent || ""));
var b = boot({});
ok("a browser that refuses every write and holds nothing runs in memory, as before", b.L.store.persistent === false && b.L.store.set("x", 1) === true && b.L.store.get("x") === 1);
ok("no page errors", !a.errs.length && !b.errs.length, a.errs.concat(b.errs));
console.log(fails ? "STORAGE FULL FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL STORAGE FULL TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
