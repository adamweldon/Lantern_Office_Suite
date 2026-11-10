// bench_1254.js -- 1.24.14: point, don't copy. Adam's 35B run of 1.24.12 with the library (136 of 140) failed the
// iPhone and Nairobi questions on their citations, as on 1.24.9 and 1.24.11: "there is no QUOTE [3] line", "QUOTE [3]
// is not in passage 3". Now the library's passages go to the model with each sentence numbered, [2.3], the model cites
// the number, and Lantern writes the QUOTE line itself, word for word (the research thread's brief of 2026-11-09,
// agent/briefs/2026-11-09-model-lantern-boundary.txt, change 1). What the answer says is still checked against the
// sentence it names. Also replayed: the small models' run of 1.24.13 (GitHub 42740634844).
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
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8")); }
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var V = L.libraryVerify, LIB = L.library, act = L.aiAct, B = L.aiBench;
  ok("boot clean; 1.24.14; the sentences and the pointers are there", o.errs.length === 0 && L.version === "1.24.14" && typeof L.librarySentences === "function" && typeof L.libraryPointers === "function", o.errs);

  // --- Adam's run of 1.24.12 ---
  var A = fixture("bench_run_1252_35b_library.json");
  function row(id) { return A.rows.filter(function (r) { return r.id === id; })[0]; }
  ok("Adam's 35B run of 1.24.12 with the library: 136 of 140, the four that failed the same four as on 1.24.9 and 1.24.11", A.lantern === "1.24.12" && A.summary.pass === 136 && A.summary.n === 140 &&
    ["shelf-iphone-battery", "shelf-nairobi-transport", "make-shore-sunset", "make-road-horizon"].every(function (id) { return row(id) && !row(id).pass; }));
  ok("what each kind cost on it (the brief's 'before'): a formula 27 tokens and one round, a library answer 169 and 2.17, a made thing 250 and 1.6",
    Math.round(A.costs.tool.tokens / A.costs.tool.pass) === 27 && A.costs.tool.rounds === A.costs.tool.n && Math.round(A.costs.fact.tokens / A.costs.fact.pass) === 169 &&
    Math.round(A.costs.fact.rounds / A.costs.fact.n * 100) === 217 && Math.round(A.costs.make.tokens / A.costs.make.pass) === 250, A.costs);
  var p1 = row("code-p1am-seal-in"), sq = L.aiBenchQuestions.filter(function (q) { return q.id === "code-p1am-seal-in"; })[0];
  ok("its P1AM program was right this time (stopNotPressed, && stopNotPressed), and 1.24.13's run of it agrees", p1.pass && /bool stopNotPressed = P1\.readDiscrete\(inSlot, stopPin\);/.test(p1.reply) &&
    B.grade(sq, p1.reply, { made: act.fromReply(p1.reply, sq.q) }).why === "");

  // --- the two library rows, with numbered sentences ---
  function sourcesOf(r) { return r.library.sources.map(function (t, i) { return { n: i + 1, title: t, text: r.library.passages[i] }; }); }
  var ip = row("shelf-iphone-battery"), nb = row("shelf-nairobi-transport"), si = sourcesOf(ip), sn = sourcesOf(nb);
  var pi = LIB.prompt(ip.q, si, ip.library.query), pn = LIB.prompt(nb.q, sn, nb.library.query);
  ok("the passages go to the model with each sentence numbered, and it is asked for the number, not a copy",
    /^\[2\] iPhone 8 Battery Replacement\n\[2\.1\] This is a prerequisite-only guide to replace the battery in an iPhone 8\. \[2\.2\] Opening the iPhone 8 will damage/m.test(pi) &&
    /\[3\.3\] Step 1: Before you begin, discharge your iPhone battery below 25%\./.test(pi) && /like \[4\.2\]/.test(pi) && /do not copy them/.test(pi) && !/QUOTE/.test(pi) &&
    /\[1\.7\] Walking around Nairobi is fairly easy since the city is small and places are easy to get to\./.test(pn) && si.every(function (s) { return s.pointers; }), pi.slice(0, 900));
  var oi = V(ip.reply, si, ip.q), on = V(nb.reply, sn, nb.q);
  ok("the 35B's replies (written to the old instructions) are still refused, and told what to write now: the sentence's number",
    !oi.ok && /\[3\] names no sentence: write \[3\.m\]/.test(oi.problems.join(" ")) && !on.ok && /names no sentence: write \[3\.m\]/.test(on.problems.join(" ")), [oi.problems, on.problems]);
  // the same answers, the facts pointed at their sentences, as the instructions now ask
  var ri = "ANSWER: Discharge the battery below 25% first [3.3]. It is held by four stretch-release adhesive strips [2.3]; pull each tab slowly away from the battery [2.5], " +
    "hold the battery as the last strip comes off or it may fling out [2.6], then remove the battery [2.9].";
  var rn = "ANSWER: Walking is easy since the city is small [1.7], but avoid walking at night [1.8]. There is a commuter rail service from the Central Nairobi Railway Station [1.5]; " +
    "agree taxi prices before the trip [1.4]. Hiring a car or using a ride-hailing app is the most convenient way to reach Kiambu [2.6].";
  var vi = V(ri, si, ip.q), vn = V(rn, sn, nb.q);
  ok("written with pointers, both verify, each quote word for word from its passage", vi.ok && vn.ok && vi.quotes.length === 5 && vi.quotes.every(function (q) { return q.ok; }) &&
    vn.quotes.length === 5, [vi.problems, vn.problems]);
  var shown = L.libraryRenumber(ri, si).text;
  ok("what is shown: the answer with [n], and the quotes Lantern wrote under it", /^ANSWER: Discharge the battery below 25% first \[3\]\./.test(shown) &&
    /\nQUOTE \[3\]: Step 1: Before you begin, discharge your iPhone battery below 25%\./.test(shown) && /\nQUOTE \[2\]: Step 6: Remove the battery from the iPhone\./.test(shown), shown);
  // a pointer that does not say the fact goes back with the one that does
  var wi = V("ANSWER: Discharge the battery below 25% [3.1].", si, ip.q);
  ok("a pointer to a sentence that does not say the fact is refused, with the number of the one that does", !wi.ok &&
    /no sentence it cites says discharge, below: \[3\.3\] says it/.test(wi.problems.join(" ")) && /cite \[3\.3\]/.test(wi.problems.join(" ")), wi.problems);
  var bi = V("ANSWER: Discharge the battery below 25% [3.40].", si, ip.q);
  ok("a pointer to no sentence is named, with the numbers there are", !bi.ok && /\[3\.40\] names no sentence: passage 3 has \d+ sentences, \[3\.1\] to \[3\.\d+\]/.test(bi.problems.join(" ")) &&
    !/says 3\.40/.test(bi.problems.join(" ")), bi.problems);
  ok("the old form, [n] and a QUOTE line copied from the passage, still verifies",
    V("ANSWER: Discharge the battery below 25% [3].\nQUOTE [3]: Step 1: Before you begin, discharge your iPhone battery below 25%.", si, ip.q).ok);

  // --- the seventh review: 22 passages and 191 answers of a reviewer's own (tests/fixtures/review7_1254_*.json) ---
  // On the first draft it got 47 of 89 wrong answers through and 10 of 102 right ones refused; 8 of 22 passages were
  // split otherwise than a reader splits them. Every passage is now split as a reader does. Six right answers were
  // written to the first draft's sentence numbers, which now name another sentence: they go back with the number of
  // the sentence that says it, and with that number they pass. Eight wrong answers still pass, each named here: a
  // check that knew them would have to understand the sentence (yes and no, a fact of the same sentence given for
  // another, a title that names both countries).
  var RP = fixture("review7_1254_passages.json").passages, RA = fixture("review7_1254_answers.json").items;
  var splitOff = RP.filter(function (p) { return JSON.stringify(L.librarySentences(p.text)) !== JSON.stringify(p.reader); }).map(function (p) { return p.id; });
  ok("review 7: all 22 passages split as a reader splits them (initials, Gen., Ft., U.S. Navy and the U.S. Today, 330 m., 5 p.m., No., a list's 1. 2.)",
    RP.length === 22 && !splitOff.length, splitOff);
  var renum = { "ei-r2": ["[1.3]", "[1.4]"], "fw-r2": ["[1.3-4]", "[1.2]"], "fw-r3": ["[1.5]", "[1.3]"], "mu-r1": ["[1.3]", "[1.4]"], "mu-r3": ["[1.1]", "[1.2]"], "fu-r1": ["[1.3]", "[1.4]"] };
  var still = { "ev-w18": "No to a sentence that says yes", "oc-w3": "yes, though the sentence says rather than acidic", "na-w2": "a title naming both Austria and Australia",
    "na-w8": "the same title", "tu-w2": "the year of the warning for the Underground's opening", "ph-w2": "lemon's pH for bleach, one sentence",
    "py-w2": "a version written as a pointer", "co-w8": "the sea-level time for above 2,000 m, one sentence" };
  var r7 = { right: 0, wrong: 0, refused: [], through: [], renum: [] };
  RA.forEach(function (it) {
    var src = JSON.parse(JSON.stringify(it.sources)), got;
    LIB.prompt(it.question, src, "", it.mode === "ground");
    function run(reply) {
      if (it.mode === "ground") return !L.libraryGround(reply, src, it.question).problems.length;
      return V(reply, src, it.question).ok;
    }
    got = run(it.reply);
    if (renum[it.id]) {
      var v0 = V(it.reply, src, it.question);
      if (got || v0.problems.join(" ").indexOf("cite " + renum[it.id][1]) < 0 || !run(it.reply.replace(renum[it.id][0], renum[it.id][1]))) r7.renum.push(it.id);
      return;
    }
    if (it.expect === "ok") { r7.right++; if (!got) r7.refused.push(it.id); }
    else { r7.wrong++; if (got && !still[it.id]) r7.through.push(it.id); if (!got && still[it.id]) r7.through.push(it.id + " (now caught: take it off the list)"); }
  });
  ok("review 7's 191 answers: none of its 96 other right answers refused; of 89 wrong ones only the eight named still pass (was 47); the six written to the old numbers go back with the right number and pass with it",
    RA.length === 191 && r7.right === 96 && !r7.refused.length && r7.wrong === 89 && !r7.through.length && !r7.renum.length, r7);
  // what the reviewer found, one by one
  var ev = [{ n: 1, title: "Mount Everest", text: RP.filter(function (p) { return p.id === "everest"; })[0].text }];
  LIB.prompt("How tall is Mount Everest?", ev, "");
  var e7 = V("ANSWER: Mount Everest is 2020 m tall [1.2].", ev, "How tall is Mount Everest?"), e9 = V("ANSWER: Mount Everest is 8,848.86 m tall [1.3].", ev, "How tall is Mount Everest?");
  ok("a number checked against the sentence named, not the passage, and in its unit: 8,848.86 m citing the border sentence goes back to [1.2]; 2020 m citing the year 2020 is refused",
    !e9.ok && /cite \[1\.2\]/.test(e9.problems.join(" ")) && !e7.ok && /2020 m, and no sentence it cites gives 2020 in length/.test(e7.problems.join(" ")), [e7.problems, e9.problems]);
  ok("a name the sentence does not say (George Mallory) is refused, though its numbers are right",
    !V("ANSWER: It is 8,848.86 m tall and was first climbed by George Mallory [1.2].", ev, "How tall is Everest and who first climbed it?").ok);
  ok("a value in brackets is a value, not a pointer: about [1.5] bar; is [2.5]",
    L.libraryPointers("The pressure should be about [1.5] bar [1.2].", ev).text.indexOf("about 1.5 bar") >= 0 && L.libraryPointers("The pH of lemon juice is [1.5] [1.2].", ev).values === 1);
  var mx = V("ANSWER: It was first climbed in 1953 [7.1].", ev, "When was Everest first climbed?");
  ok("a pointer to no passage is named: [7.1] with one passage", !mx.ok && /\[7\.1\] names no passage: the passages are \[1\] to \[1\]/.test(mx.problems.join(" ")), mx.problems);
  ok("every thousands comma: 47,564,296 is one number", V("ANSWER: 47,564,296 people [1.3].", [{ n: 1, title: "Kenya", text: "Kenya is a country in East Africa. Facts from the infobox: Capital: Nairobi. Population: 47,564,296. Area: 580,367 km2.", pointers: true }], "What is the population of Kenya?").ok &&
    !V("ANSWER: About 47,564 people [1.3].", [{ n: 1, title: "Kenya", text: "Kenya is a country in East Africa. Facts from the infobox: Capital: Nairobi. Population: 47,564,296. Area: 580,367 km2.", pointers: true }], "What is the population of Kenya?").ok);
  var to = [{ n: 1, title: "J. R. R. Tolkien", text: RP.filter(function (p) { return p.id === "tolkien"; })[0].text }];
  LIB.prompt("Where was Tolkien born?", to, "");
  var t3 = V("ANSWER: He was born in Bournemouth [1.4].", to, "Where was Tolkien born?"), t4 = V("ANSWER: In Bournemouth [1.5].", to, "Where was Tolkien born?");
  ok("Lantern does not steer a model to a sentence of another fact: born in Bournemouth citing the birth is told what the birth says; Bournemouth citing the death goes back to the birth",
    !t3.ok && /\[1\.4\] says \u201cTolkien was born in Bloemfontein/.test(t3.problems.join(" ")) && !/cite \[1\.5\]/.test(t3.problems.join(" ")) &&
    !t4.ok && /the question asks about born, and no sentence it cites says it: \[1\.4\]/.test(t4.problems.join(" ")), [t3.problems, t4.problems]);
  ok("a pronoun's sentence lends its name: J. R. R. Tolkien citing He wrote The Hobbit; C. S. Lewis citing his friend goes back to [1.2]",
    V("ANSWER: J. R. R. Tolkien [1.2].", to, "Who wrote The Hobbit?").ok && /\[1\.2\]/.test(V("ANSWER: C. S. Lewis [1.3].", to, "Who wrote The Hobbit?").problems.join(" ")));

  // --- the small models' run of 1.24.13 ---
  var R08 = fixture("bench_run_1253_08b.json"), R2 = fixture("bench_run_1253_2b.json"), R4 = fixture("bench_run_1253_4b.json"), P4 = fixture("bench_run_1252_4b.json");
  function ids(X) { return X.rows.map(function (r) { return r.id; }).sort().join(); }
  ok("1.24.13 on GitHub: the 0.8B 54, the 2B 74, the 4B 107 of 114; the 4B on the same AMD EPYC 7763 failed the same seven rows as on 1.24.12; the table now gives tokens per right answer",
    R08.summary.pass === 54 && R2.summary.pass === 74 && R4.summary.pass === 107 && R4.processor === P4.processor && ids(R4) === ids(P4) &&
    R4.summary.byCat.tool.tokensPerPass === 28 && R4.summary.byCat.tool.roundsPer === 1, [R08.summary.pass, R2.summary.pass, R4.summary.pass, ids(R4)]);
  console.log(fails ? fails + " 1.24.14 FAILURES (" + passes + " passed)" : "ALL 1.24.14 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
