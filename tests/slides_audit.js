// slides_audit.js -- Slides after the app audit (1.16.0), the parts a DOM
// without layout can check: one show at a time (Space or Enter on Present
// started more), the X ends it, a heading-only slide shows no bare bullet,
// an exported outline imports back as the same deck (with its notes),
// "1 slide", opening a deck does not change it, Ctrl+Z outside the text is
// not the browser's (it emptied the deck title), thumbnails by keyboard, a
// pasted body keeps no styling.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, inserted = [];
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
d.execCommand = function (c, u, v) { inserted.push([c, v]); return true; };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 500)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function btn(re) { return Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return re.test(b.textContent); })[0]; }
function key(el, k, o) { var opts = { key: k, bubbles: true, cancelable: true }; Object.keys(o || {}).forEach(function (x) { opts[x] = o[x]; }); var e = new w.KeyboardEvent("keydown", opts); el.dispatchEvent(e); return e; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, col = L.store.collection("slides.docs"), downloads = [];
  L.download = function (name, text) { downloads.push(String(text)); };
  w.location.hash = "slides"; fire(w, "hashchange"); await sleep(60);
  var id = L.slideDocs.create("Pump care", [{ h: "Why", body: "<ul><li>Fewer breakdowns</li></ul>" }, { h: "Questions?", body: "<ul><li></li></ul>" }]);
  var d0 = col.get(id); d0.slides[0].notes = "Start with the last breakdown"; col.put(d0);
  var upd = col.get(id).updated;
  await sleep(15);
  L.slideDocs.open(id); await sleep(40);

  // --- the show ---------------------------------------------------------------------------
  var pres = btn(/Present$/);
  pres.click(); pres.click();
  ok("Present twice: one show", d.querySelectorAll(".present").length === 1);
  key(d, "ArrowRight");
  ok("a heading-only slide shows no bare bullet", d.querySelector(".present .st").textContent === "Questions?" && !d.querySelector(".present .sb"));
  d.querySelector(".present .pclose").click();
  ok("the X ends the show", d.querySelectorAll(".present").length === 0);

  // --- Ctrl+Z, thumbnails, paste ----------------------------------------------------------
  var z = key(d.body, "z", { ctrlKey: true });
  ok("Ctrl+Z with no text field focused is not the browser's (it emptied the deck title)", z.defaultPrevented);
  var th = d.querySelectorAll(".sthumb");
  ok("thumbnails can be reached and chosen by keyboard", th[1].getAttribute("tabindex") === "0" && th[1].getAttribute("role") === "button");
  key(th[1], "Enter");
  ok("...Enter on slide 2 chooses it", d.querySelectorAll(".sthumb")[1].className.indexOf("sel") >= 0);
  var body = d.querySelector(".smain .sb"), ev = d.createEvent("Event");
  ev.initEvent("paste", true, true);
  ev.clipboardData = { getData: function (t) { return t === "text/html" ? '<p style="color:#000;font:17px Georgia">Pasted <b style="color:black">words</b></p>' : "Pasted words"; } };
  body.dispatchEvent(ev);
  var last = inserted.filter(function (x) { return x[0] === "insertHTML"; }).pop();
  ok("a pasted body keeps its words and bold, not the source's colours and fonts", last && last[1] === "<p>Pasted <b>words</b></p>", last);

  // --- leaving without a change; outline round trip; "1 slide" ------------------------------
  btn(/Decks$/).click(); await sleep(20);
  ok("opening a deck and going back does not change it (no new date)", col.get(id).updated === upd);
  L.slideDocs.open(id); await sleep(30);
  btn(/Outline \.txt/).click();
  var outline = downloads.pop();
  btn(/Decks$/).click(); await sleep(20);
  btn(/Import outline/).click(); await sleep(10);
  d.querySelector("textarea[aria-label='Outline text']").value = outline;
  btn(/Create deck/).click(); await sleep(30);
  var back = col.all()[0];
  ok("Outline .txt imports back as the same deck: titles without their numbers, the notes as notes",
    back.title === "Pump care" && back.slides.length === 2 && back.slides[0].h === "Why" && back.slides[1].h === "Questions?" &&
    back.slides[0].notes === "Start with the last breakdown" && /Fewer breakdowns/.test(back.slides[0].body), back.slides);
  btn(/Decks$/).click(); await sleep(20);
  L.slideDocs.create("One", [{ h: "Only", body: "<p>x</p>" }]);
  btn(/Decks$/) ? btn(/Decks$/).click() : null;
  w.location.hash = "home"; fire(w, "hashchange"); await sleep(20); w.location.hash = "slides"; fire(w, "hashchange"); await sleep(40);
  ok("the library says “1 slide”", Array.prototype.some.call(d.querySelectorAll(".list .item .s"), function (x) { return /^1 slide ·/.test(x.textContent); }));

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? "SLIDES AUDIT FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL SLIDES AUDIT TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
