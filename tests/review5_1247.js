// review5_1247.js -- the fifth independent review of 1.24.7, replayed (2026-11-07).
// After the fourth review's findings were mended, another agent that had not
// seen the rules written tried the mends on 113 replies of everyday sums
// (money, cooking, farming, building, fluids, units, percentages, averages),
// 36 recipe questions and 30 pictures. It found 70 breaks: 30 right replies
// whose last step was done in the head and that no rule told from a slip
// ("=80*25/100", "=60" for a coat at 25% off); a test against 0 cut as a
// sum ("=MOD(391,17)=0"); a next step after an arrow taken for a label
// ("-> divide by 60 = 2.22"); "MAKE SURE THE UNITS MATCH" read as a block;
// "What do I enter on the oven for 180 C in Fahrenheit?" given the formula
// and no number; the climb to orbit given the orbit's recipe; a white disc
// at night taken for the moon where it was a snow cap or a cloud; a bright
// star taken for a cloud. What could not be made sure was taken back: a
// number the model typed stands, as on 1.24.6, unless it has ten digits or
// more. Its inputs are the fixture; what 1.24.6 gave and what this version
// gives are written beside each.
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
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review5_1247.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function near(a, b) { return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.01); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var S = L.aiScene, A = L.assist;
  ok("boot clean; the review\u2019s inputs: 113 replies, 36 recipe questions, 30 pictures", o.errs.length === 0 && F.replies.length === 113 && F.recipes.length === 36 && F.scenes.length === 30, o.errs);
  function outcome(reply, q) { var t = L.aiRead(reply, q).text, p = A.parseReply(t), run = null; try { run = p.exprText ? A.run(p.exprText) : null; } catch (e) { run = null; } return { text: t, value: run ? run.value : null }; }
  var rNow = F.replies.filter(function (r) { var b = outcome(r.reply, r.q); return !(b.value === r.value || near(b.value, r.value)); });
  ok("the 113 replies: each read as the fixture has it", rNow.length === 0, rNow.map(function (r) { return [r.q, r.reply, outcome(r.reply, r.q)]; }));
  var lost = F.replies.filter(function (r) { return r.kind === "right" && r.expect !== null && near(r.v1246, r.expect) && !near(r.value, r.expect); });
  ok("...no right reply that 1.24.6 read right is read wrong: a last step done in the head stands (\u201c=80*25/100\u201d, \u201c=60\u201d; \u201c=100-60\u201d ...), a test against 0 is a test, a next step after an arrow is not cut away",
    lost.length === 0, lost.map(function (r) { return [r.q, r.v1246, r.value, r.expect]; }));
  var worse = F.replies.filter(function (r) { return r.kind === "wrong" && !(r.value === r.v1246 || near(r.value, r.v1246) || near(r.value, r.expect)); });
  ok("...and no wrong reply is turned into another wrong number: each is as 1.24.6 read it, or right", worse.length === 0, worse.map(function (r) { return [r.q, r.v1246, r.value]; }));
  var RDc = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function speaks(r) { var m = null; try { m = RDc(r.q, r.sum, A.run(r.sum), {}); } catch (e) { m = null; } return !!m; }
  var cNow = F.recipes.filter(function (r) { return speaks(r) !== r.speaks; });
  ok("the 36 recipe questions: as the fixture has them; none that is not the card\u2019s own plain question is given the recipe\u2019s line (the climb to orbit, how long the station stays in orbit, a lift going up, a 145 MHz aerial)",
    cNow.length === 0 && F.recipes.every(function (r) { return !r.speaks || r.own !== false; }), cNow.map(function (r) { return r.q; }));
  function mend(c) { return S.mend(c.lines.slice(), c.q); }
  var sNow = F.scenes.filter(function (c) { var m = mend(c); return m.lines.join("\n") !== c.after.join("\n") || m.said.join("|") !== c.said.join("|") || m.problems.join("|") !== c.problems.join("|"); });
  ok("the 30 pictures: each drawn as the fixture has it (looked at, as written and as drawn); every right one as written -- a white disc at night on a peak, a round cloud on a hill, a snowy crown, a bright star under the moon",
    sNow.length === 0 && F.scenes.filter(function (c) { return c.kind === "right"; }).every(function (c) { return c.after.join("|") === c.lines.join("|") && !c.said.length && !c.problems.length; }), sNow.map(function (c) { return [c.name, mend(c)]; }));
  console.log(fails ? fails + " REVIEW 5 FAILURES (" + passes + " passed)" : "ALL REVIEW 5 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
