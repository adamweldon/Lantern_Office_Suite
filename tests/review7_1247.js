// review7_1247.js -- the seventh independent review of 1.24.7, replayed (2026-11-08).
// After the sixth review's findings were mended, another agent that had not seen the rules written tried them on 162
// replies, 50 recipe questions and 28 pictures of its own, and ran six of them through the whole of Chat and Assist
// with a scripted model. It found 38 replies broken: a chain with an arrow on each line where one arrow was cut and
// the next line's ANS was 0 ("=2*60 -> minutes", "=30*ANS -> litres": 0 litres); a count rounded after the arrow or
// the second = ("=7/2 -> 4": 3.5 cars); a chain to a per cent ("=12/80 = 0.15 = 15%": 0.15%); an arrow's unit that
// is not the CONVERT's own; an arrow that meant "change it into" ("=3 -> minutes": 3 minutes); "pounds" a weight or a
// price; yes/no asked after a full stop or with "or not"; a message in a conversation taken for the question. And
// five recipe questions with a right sum in another unit told to write the recipe's, and the sun asked to be in front
// of the clouds put behind them. What could not be made sure was taken back: an arrow is read only before a recipe's
// own label or the sum's own value, and only where every arrow of the reply is one of these; a second = only for a
// question Lantern gave itself, with no yes/no in any part of it and no number in words; a line that uses ANS of a
// line that could not be worked out cannot be worked out either; a recipe is held to only where the question asks in
// its unit; the sun asked for in front of something stays there. Its inputs are the fixture; what 1.24.6 and this
// version give are written beside each.
// (After the eighth review the readers for the arrow and the second = were taken out: such lines go back to the
// model as on 1.24.6. The fixture's values are this version's.)
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
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review7_1247.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function near(a, b) { return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.01); }
(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var S = L.aiScene, A = L.assist;
  ok("boot clean; the review\u2019s inputs: 162 replies, 50 recipe questions, 28 pictures", o.errs.length === 0 && F.replies.length === 162 && F.recipes.length === 50 && F.scenes.length === 28, o.errs);
  function outcome(reply, q) { var t = L.aiRead(reply, q).text, p = A.parseReply(t), run = null; try { run = p.exprText ? A.run(p.exprText) : null; } catch (e) { run = null; } return { text: t, value: run && typeof run.value === "number" && isFinite(run.value) ? run.value : null }; }
  var rNow = F.replies.filter(function (r) { var b = outcome(r.reply, r.q); return !(b.value === r.value || near(b.value, r.value)); });
  ok("the 162 replies: each read as the fixture has it (twelve of them the last turn of a conversation)", rNow.length === 0, rNow.map(function (r) { return [r.q, r.reply, outcome(r.reply, r.q)]; }));
  var num = F.replies.filter(function (r) { return typeof r.expect === "number"; });
  // (one is left as AI_ACTIONS reads it: an ANSWER that is a MAKE DOC's first line is the document's)
  var lost = num.filter(function (r) { return r.kind === "right" && near(r.v1246, r.expect) && !near(r.value, r.expect) && !/^MAKE DOC: Conversions\nANSWER:/.test(r.reply); });
  ok("...no right reply that 1.24.6 read right is read wrong (an ANSWER that is a MAKE DOC\u2019s first line is the document\u2019s, as AI_ACTIONS makes it)", lost.length === 0, lost.map(function (r) { return [r.q, r.v1246, r.value]; }));
  // (where 1.24.6 had no number -- the reply went back, or Chat showed ? -- this version gives none, or the right one:
  // never "0 litres", "3.5 cars", "0.15%", "3 minutes")
  var handed = num.filter(function (r) { return r.v1246 === null && r.value !== null && !near(r.value, r.expect); });
  ok("...where 1.24.6 worked out no number (the reply went back), none is handed over that is wrong: not \u201c0 litres\u201d for a chain with an arrow on each line, \u201c3.5 cars\u201d for \u201c=7/2 -> 4\u201d, \u201c3 minutes\u201d for \u201c=3 -> minutes\u201d, \u201c3.1069 km\u201d for a CONVERT the other way",
    handed.length === 0, handed.map(function (r) { return [r.q, r.reply, r.value]; }));
  var worse = num.filter(function (r) { return r.kind === "wrong" && r.value !== null && !(near(r.value, r.v1246) || near(r.value, r.expect)) && r.v1246 === null; });
  ok("...and no wrong reply that went back on 1.24.6 is turned into a number", worse.length === 0, worse.map(function (r) { return [r.q, r.v1246, r.value]; }));
  ok("a line that uses ANS of a line that could not be worked out cannot be worked out either (it was the line before that, or 0)",
    A.run("=2*60 -> minutes\n=30*ANS").value === null && A.run("=foo(3)\n=ANS*2").value === null && A.run("=2*60\n=30*ANS").value === 3600 && A.run("=5\n=foo(1)\n=ANS1*2").value === 10);
  var RDc = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function speaks(r) { var m = null; try { m = RDc(r.q, r.sum, A.run(r.sum), {}); } catch (e) { m = null; } return !!m; }
  var cNow = F.recipes.filter(function (r) { return speaks(r) !== r.speaks; });
  ok("the 50 recipe questions: as the fixture has them; the recipe\u2019s line is given only where it should be -- its own question, asked in its unit, with a wrong sum -- not for a right sum in hours, seconds, km/s or cm to a question that names no unit, nor where the drops of bleach are what is drunk",
    cNow.length === 0 && F.recipes.every(function (r) { return !r.speaks || r.shouldSpeak; }), cNow.map(function (r) { return r.q; }));
  function mend(c) { return S.mend(c.lines.slice(), c.q); }
  var sNow = F.scenes.filter(function (c) { var m = mend(c); return m.lines.join("\n") !== c.after.join("\n") || m.said.join("|") !== c.said.join("|") || m.problems.join("|") !== c.problems.join("|"); });
  ok("the 28 pictures: each drawn as the fixture has it; every right one as written -- the sun asked to be in front of the clouds, a dark cloud, the mountains, a tall tree stays in front (\u201cthe sun shining over the clouds\u201d can be read either way)",
    sNow.length === 0 && F.scenes.filter(function (c) { return c.kind === "right" && !c.ambiguous; }).every(function (c) { return c.after.join("|") === c.lines.join("|") && !c.said.length && !c.problems.length; }), sNow.map(function (c) { return [c.name, mend(c)]; }));
  console.log(fails ? fails + " REVIEW 7 FAILURES (" + passes + " passed)" : "ALL REVIEW 7 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
