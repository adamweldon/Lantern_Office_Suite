// review8_1247.js -- the eighth independent review of 1.24.7, replayed (2026-11-08).
// After the seventh review's findings were mended, another agent that had not seen the rules written tried them on
// 199 replies, 46 recipe questions and 18 pictures of its own, and ran ten of them through the whole of Chat and
// Assist. It found 21 replies broken: a recipe's own line with its own label read where the ANSWER used another
// unit ("=KE(1000,20) -> joules" under kJ: 200000 kJ; "=VOLTS(0.02,470) -> volts" under mV), a recipe copied for a
// question it did not fit (Earth's weight for the Moon), a value after the arrow or the second = in a unit the
// question did not ask ("=20/60 -> 0.33 hours" for minutes), a tag question ("2,275, isn't it?"), blocks of kinds
// Lantern does not make swallowing the ANS lines 1.24.6 read, lowercase "ans" after a failed line; and the sun put
// behind clouds the question put behind it in other words. So the readers for the arrow and the second = were taken
// out: those lines go back to the model as on 1.24.6, with what is wrong said plainly. A line that uses ANS where no
// line before it was worked out cannot be worked out either; a puzzle tool's block ends at an ANS line; the sun asked
// for in front, or with clouds behind it, stays. Its inputs are the fixture; what 1.24.6 and this version give are
// written beside each.
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
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review8_1247.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function near(a, b) { return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.01); }
(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var S = L.aiScene, A = L.assist;
  ok("boot clean; the review\u2019s inputs: 199 replies, 46 recipe questions, 18 pictures", o.errs.length === 0 && F.replies.length === 199 && F.recipes.length === 46 && F.scenes.length === 18, o.errs);
  function outcome(reply, q) { var t = L.aiRead(reply, q).text, p = A.parseReply(t), run = null; try { run = p.exprText ? A.run(p.exprText) : null; } catch (e) { run = null; } return { text: t, value: run && typeof run.value === "number" && isFinite(run.value) ? run.value : null }; }
  var rNow = F.replies.filter(function (r) { var b = outcome(r.reply, r.q); return !(b.value === r.value || near(b.value, r.value)); });
  ok("the 199 replies: each read as the fixture has it (four of them the last turn of a conversation)", rNow.length === 0, rNow.map(function (r) { return [r.q, r.reply, outcome(r.reply, r.q)]; }));
  var num = F.replies.filter(function (r) { return typeof r.expect === "number"; });
  var lost = num.filter(function (r) { return r.kind === "right" && near(r.v1246, r.expect) && !near(r.value, r.expect); });
  ok("...no right reply that 1.24.6 read right is read wrong (an ANS line after \u201cSOLVE: the cost\u201d is a sum; \u201cMAKE A NOTE:\u201d opens no block)", lost.length === 0, lost.map(function (r) { return [r.q, r.v1246, r.value]; }));
  // (where 1.24.6 had no number -- the reply went back, or Chat showed ? -- this version gives none, or the right one:
  // never "200000 kJ", "9.4 mV", "0.33" minutes)
  var handed = num.filter(function (r) { return r.v1246 === null && r.value !== null && !near(r.value, r.expect); });
  ok("...where 1.24.6 worked out no number (the reply went back), none is handed over that is wrong: not \u201c200000 kJ\u201d for \u201c=KE(1000,20) -> joules\u201d under kJ, \u201c9.4 mV\u201d, \u201c0.33\u201d for minutes",
    handed.length === 0, handed.map(function (r) { return [r.q, r.reply, r.value]; }));
  var worse = num.filter(function (r) { return r.kind === "wrong" && r.value !== null && !(near(r.value, r.v1246) || near(r.value, r.expect)) && r.v1246 === null; });
  ok("...and no wrong reply that went back on 1.24.6 is turned into a number", worse.length === 0, worse.map(function (r) { return [r.q, r.v1246, r.value]; }));
  ok("a line that uses ANS (or ans) where no line before it was worked out cannot be worked out; after a line that was, ANS is that line\u2019s, as on 1.24.6 (\u201c=2*60\u201d, \u201c=ANS minutes\u201d, \u201c=ANS*30\u201d is 3600)",
    A.run("=2*60 -> minutes\n=30*ans").value === null && A.run("=2*60\n=ANS minutes\n=ANS*30").value === 3600);
  var RDc = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function speaks(r) { var m = null; try { m = RDc(r.q, r.sum, A.run(r.sum), {}); } catch (e) { m = null; } return !!m; }
  var cNow = F.recipes.filter(function (r) { return speaks(r) !== r.speaks; });
  ok("the 46 recipe questions: as the fixture has them; the recipe\u2019s line is given only where it should be -- its own question, in its own words and unit, with a wrong sum",
    cNow.length === 0 && F.recipes.every(function (r) { return !r.speaks || r.shouldSpeak; }), cNow.map(function (r) { return r.q; }));
  function mend(c) { return S.mend(c.lines.slice(), c.q); }
  var sNow = F.scenes.filter(function (c) { var m = mend(c); return m.lines.join("\n") !== c.after.join("\n") || m.said.join("|") !== c.said.join("|") || m.problems.join("|") !== c.problems.join("|"); });
  ok("the 18 pictures: each drawn as the fixture has it; every right one as written -- clouds behind the sun, the sun with clouds behind it, the sun in the foreground, clouds at the back (\u201cthe sun above the clouds\u201d and \u201cthe clouds under the sun\u201d can be read either way)",
    sNow.length === 0 && F.scenes.filter(function (c) { return c.kind === "right" && !c.ambiguous; }).every(function (c) { return c.after.join("|") === c.lines.join("|") && !c.said.length && !c.problems.length; }), sNow.map(function (c) { return [c.name, mend(c)]; }));
  console.log(fails ? fails + " REVIEW 8 FAILURES (" + passes + " passed)" : "ALL REVIEW 8 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
