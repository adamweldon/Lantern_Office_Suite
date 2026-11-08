// review6_1247.js -- the sixth independent review of 1.24.7, replayed (2026-11-08).
// After the fifth review's findings were mended, another agent that had not
// seen the rules written tried them on 78 replies, 43 recipe questions and 19
// pictures of its own. It found 91 breaks: a number of ten digits or more typed
// under a sum that was the model's next step ("=1024^3", "=10737418240" for 10
// GiB; "=2.222222222" for hours); a yes/no asked after a colon or with its
// numbers in words ("Find out: is twelve squared one hundred and forty-four?");
// a step after an arrow ("-> bags, rounded up", "-> percent", "-> squared") and
// a unit the ANSWER does not use ("-> minutes" over an ANSWER in hours, "=
// 2275 pence" over one in pounds); an older QUESTION line in a Chat
// conversation taken for the newest question; an ANSWER line after a MAKE
// block with no END, which AI_ACTIONS reads as the answer; the recipe for a
// whole weight given for an axle's share, a diver underwater, a mass in orbit,
// the wavelength of radio given for ultrasound and sonar, the bleach dose for
// water to drink given for cleaning a tank; a snow cap, a cloud, a pale rock on
// a peak at night taken for the moon. What could not be made sure was taken
// back: a typed number stands, whatever its length; an arrow is cut only before
// a unit the ANSWER gives the result in; the moon is left where it was drawn;
// a recipe is held to only for a question made of its own words. Its inputs
// are the fixture; what 1.24.6 and this version give are written beside each.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load() {
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
  return { L: w.Lantern, errs: errs };
}
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review6_1247.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function near(a, b) { return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.01); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var S = L.aiScene, A = L.assist;
  ok("boot clean; the review\u2019s inputs: 78 replies, 43 recipe questions, 19 pictures", o.errs.length === 0 && F.replies.length === 78 && F.recipes.length === 43 && F.scenes.length === 19, o.errs);
  function outcome(reply, q) { var t = L.aiRead(reply, q).text, p = A.parseReply(t), run = null; try { run = p.exprText ? A.run(p.exprText) : null; } catch (e) { run = null; } return { text: t, value: run ? run.value : null }; }
  var rNow = F.replies.filter(function (r) { var b = outcome(r.reply, r.msgs || r.q); return !(b.value === r.value || near(b.value, r.value)); });
  ok("the 78 replies: each read as the fixture has it (seven of them the last turn of a Chat conversation)", rNow.length === 0, rNow.map(function (r) { return [r.q, r.reply, outcome(r.reply, r.msgs || r.q)]; }));
  var lost = F.replies.filter(function (r) { return r.kind === "right" && r.expect !== null && near(r.v1246, r.expect) && !near(r.value, r.expect); });
  ok("...no right reply that 1.24.6 read right is read wrong: a long number typed under a sum stands (\u201c=1024^3\u201d, \u201c=10737418240\u201d), a yes/no after a colon or in words is a test, the newest question in a conversation is the question, an ANSWER line after a MAKE TABLE is the answer",
    lost.length === 0, lost.map(function (r) { return [r.q, r.v1246, r.value, r.expect]; }));
  var worse = F.replies.filter(function (r) { return r.kind === "wrong" && !(r.value === r.v1246 || near(r.value, r.v1246) || near(r.value, r.expect)); });
  ok("...and no wrong reply is turned into another wrong number: each is as 1.24.6 read it, or right (\u201c-> bags, rounded up\u201d, \u201c-> percent\u201d, \u201c-> minutes\u201d over an ANSWER in hours, \u201c= 2275 pence\u201d over one in pounds go back to the model as on 1.24.6)", worse.length === 0, worse.map(function (r) { return [r.q, r.v1246, r.value]; }));
  var RDc = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function speaks(r) { var m = null; try { m = RDc(r.q, r.sum, A.run(r.sum), {}); } catch (e) { m = null; } return !!m; }
  var cNow = F.recipes.filter(function (r) { return speaks(r) !== r.speaks; });
  ok("the 43 recipe questions: as the fixture has them; none that is not the card\u2019s own plain question is given the recipe\u2019s line (the front axle, a diver underwater, a mass in orbit, ultrasound, sonar, a wavelength in km, one orbit\u2019s length in km, drops of bleach to clean a tank), and no right sum for its own question is told to be the recipe\u2019s",
    cNow.length === 0 && F.recipes.every(function (r) { return !r.speaks || (r.own === true && !r.sumRight); }), cNow.map(function (r) { return r.q; }));
  function mend(c) { return S.mend(c.lines.slice(), c.q); }
  var sNow = F.scenes.filter(function (c) { var m = mend(c); return m.lines.join("\n") !== c.after.join("\n") || m.said.join("|") !== c.said.join("|") || m.problems.join("|") !== c.problems.join("|"); });
  ok("the 19 pictures: each drawn as the fixture has it (looked at, as written and as drawn); every right one as written -- a snow cap, a pale rock, a cloud on a peak in the moonlight, with the moon drawn small, as an oval, rising behind the land, or not at all",
    sNow.length === 0 && F.scenes.filter(function (c) { return c.kind === "right"; }).every(function (c) { return c.after.join("|") === c.lines.join("|") && !c.said.length && !c.problems.length; }), sNow.map(function (c) { return [c.name, mend(c)]; }));
  console.log(fails ? fails + " REVIEW 6 FAILURES (" + passes + " passed)" : "ALL REVIEW 6 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
