// bench_1254.js -- the runs of 1.24.13, replayed (1.24.14).
// Adam's run of the 35B on 1.24.13 with the library (2026-11-10, tests/fixtures/bench_run_1253_35b_library.json): 135 of
// 140, the P1AM seal-in passing now. Five rows fail, four of them with the reply they had before:
//  - the two coins under the cups, the 35B's reply of 1.24.11 word for word: its TRACK block was right -- "swap holder of
//    gold and left of left of holder of gold" is two places to the left -- and Lantern's check counted one place and told
//    it to write "2 left of left of holder of gold" (three places, off the row). The check now counts a chain as the
//    runner reads it, and when a line moves the wrong number of places it rewrites the whole chain;
//  - the iPhone's battery and Nairobi's transport, word for word as on 1.24.11 (and on 1.24.9): a cited [3] with no
//    QUOTE [3] line, a QUOTE [3] in no passage. The send-back may now end with the line to write -- only when sure
//    (three reviews, tests/review_1254.js); the 35B's own answers still go back as before: the iPhone's other parts
//    paraphrase their quotes, and Nairobi's part is in no sentence by itself;
//  - the shore at sunset, on "dark gray": the dark and light shades of the table's colours are read now, and a band of
//    water the beach line would cover is named, the beach written in its place;
//  - the road to the horizon, "tri 0 6 20 6 10 0 fill gray" again and again: the road drawn going up from the horizon
//    is named, with the line to write in its place.
// The small models' run of 1.24.13 (42740634844, tests/fixtures/bench_run_1253_{4b,2b,08b}.json): the 4B 107 of 114,
// the 2B 74, the 0.8B 54. The 4B drew its road and then the ground over it, with the same reply on 1.24.10, 1.24.11,
// 1.24.12 and 1.24.13, and kept that order when asked: Lantern now moves a shape that a band drawn after it covers all
// of to just after the band, and says so.
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
  var B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct, PZ = L.aiPuzzle;
  var F = fixture("bench_run_1253_35b_library.json"), G = fixture("bench_run_1251_35b_library.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  function ids(X) { return X.rows.map(function (r) { return r.id; }).sort(); }
  function srcs(r) { return r.library.passages.map(function (t, i) { return { n: i + 1, title: r.library.sources[i], text: t }; }); }
  ok("boot clean; Adam's run of 1.24.13: 135 of 140, the eight rows that did not pass (three of them puzzles without the tools, not scored)",
    o.errs.length === 0 && F.lantern === "1.24.13" && F.summary.pass === 135 && F.summary.n === 140 && F.rows.length === 8, [o.errs, F.summary]);
  ok("against 1.24.11: the P1AM seal-in passes now; nothing fails that passed", ids(G).filter(function (i) { return ids(F).indexOf(i) < 0; }).join() === "code-p1am-seal-in" &&
    ids(F).filter(function (i) { return ids(G).indexOf(i) < 0; }).length === 0, [ids(F), ids(G)]);
  ok("the iPhone, Nairobi and the two coins: the 35B's replies of 1.24.11 word for word (the same rows twice, and the same replies)",
    ["shelf-iphone-battery", "shelf-nairobi-transport", "cups-two-coins"].every(function (id) { return row(F, id).reply === row(G, id).reply; }));

  // --- the two coins: a right TRACK block questioned ---
  var cq = item("cups-two-coins"), cr = row(F, "cups-two-coins"), blocks = cr.chat[0].blocks;
  ok("on 1.24.13 Lantern ran the 35B's first block to the right order, then questioned it as moving 1 place, and its advice went off the row",
    blocks.length === 2 && /Yellow, 2 Green, 3 Blue, 4 Red, 5 White/.test(blocks[0].final) && /moves 1 place: write \u201c2 left of left of holder of gold\u201d/.test(blocks[0].problems[0]) &&
    /is off the row/.test(blocks[1].problems[0]));
  function track(lines, q) { return PZ.run("TRACK: cups\n" + lines.join("\n") + "\nEND", q); }
  var r1 = track(blocks[0].lines, cq.q);
  ok("1.24.14: the 35B's block runs with nothing questioned: \u201cleft of left of holder of gold\u201d is two places",
    r1 && r1.ok && !r1.problems.length && r1.block.lines[4] === "swap holder of gold and left of left of holder of gold", r1 && r1.problems);
  ok("...and its result is the bench's answer", cq.check(PZ.resultText(r1)) === "", PZ.resultText(r1).slice(-300));
  var one = blocks[0].lines.slice(); one[4] = "swap holder of gold and left of holder of gold";
  var r2 = track(one, cq.q);
  ok("one place for \u201ctwo places to its left\u201d still goes back, with the line as before", !r2.ok &&
    r2.problems[0] === "the steps say \u201ctwo places to its left\u201d, but its line, \u201cswap holder of gold and left of holder of gold\u201d, moves 1 place: write \u201c2 left of holder of gold\u201d in that line, and leave the other lines as they are", r2.problems);
  var seven = "Seven cups stand in a row, left to right: A, B, C, D, E, F, G. A coin is under F. 1. The cup holding the coin swaps with the cup two places to its left. 2. The cup on the far left moves to the far right. Where is the coin?";
  var r3 = track(["row A B C D E F G", "put coin in F", "swap holder of coin and left of left of left of holder of coin", "move first to last"], seven);
  ok("three places for two goes back with the chain written as one: \u201c2 left of holder of coin\u201d (not \u201c2 left of left of left of ...\u201d)", !r3.ok &&
    /moves 3 places: write \u201c2 left of holder of coin\u201d in that line/.test(r3.problems[0]), r3.problems);
  var r4 = track(["row A B C D E F G", "put coin in F", "swap holder of coin and 2 left of holder of coin", "move first to last"], seven);
  var r5 = track(["row A B C D E F G", "put coin in F", "swap holder of coin and left of left of holder of coin", "move first to last"], seven);
  ok("\u201c2 left of\u201d and \u201cleft of left of\u201d run alike, with nothing questioned", r4.ok && r5.ok && PZ.resultText(r4).split("\n").pop() === PZ.resultText(r5).split("\n").pop(), [r4.problems, r5.problems]);
  var C = L.aiPuzzleCheck;
  ok("chain(): left of left of X is 2, 2 left of left of X is 3; \u201cbehind behind\u201d and \u201c2 seats left of\u201d are not read as chains (the runner does not)",
    C.chain("left of left of X").n === 2 && C.chain("2 left of left of X").n === 3 && C.chain("behind behind X").links === 0 && C.chain("2 seats left of X").links === 0 && C.chain("X").n === 0);

  // --- the library: the line to write ---
  var ip = row(F, "shelf-iphone-battery"), ips = srcs(ip), iq = item("shelf-iphone-battery");
  // (the bench keeps 600 characters of a reply: the ANSWER line is whole, the QUOTE [2] lines after the first are cut.
  // They are written here as the 35B's own were -- 1.24.13 found nothing wrong with [2] -- each a sentence of passage 2)
  var q2 = ["Step 1: The iPhone's battery is secured by four pieces of stretch-release adhesive\u2014two at the top, and two at the bottom.",
    "Step 3: Slowly pull one battery adhesive tab away from the battery, towards the bottom of the iPhone.",
    "Step 4: Be sure to hold onto the battery as you remove the final strip, or it may fling out of the iPhone unexpectedly.",
    "Step 5: If you choose to use pry tools to lift the battery out of the iPhone, use extreme caution or you may damage the ribbon cables or the wireless charging coil directly underneath the battery.",
    "Don't overheat the iPhone, or you may accidentally ignite the battery.", "Step 6: Remove the battery from the iPhone.",
    "Step 6: If your replacement battery came in a plastic sleeve, slide off and remove the sleeve before installation."];
  ok("the quotes for [2] are passage 2's own sentences", q2.every(function (s) { return ips[1].text.indexOf(s) >= 0; }));
  var it1 = ip.reply.split("\n")[0] + "\n" + q2.map(function (s) { return "QUOTE [2]: " + s; }).join("\n");
  var v1 = L.libraryVerify(L.libraryRenumber(it1, ips).text, ips, ip.q);
  // (the first draft handed the 35B's own answer its line. Three reviews made the rule ask, of every other part of the
  // answer, that its words come in its own quote in order, but one in four: the 35B's [2] parts are its paraphrases --
  // "remove the four adhesive strips securing it" beside "secured by four pieces of stretch-release adhesive",
  // "Finally, remove the battery" -- and it goes back as on 1.24.13)
  ok("the 35B's iPhone answer goes back as on 1.24.13: its other parts are paraphrases of their quotes",
    !v1.ok && v1.problems.length === 1 && v1.problems[0] === "there is no QUOTE [3] line", v1.problems);
  var ia = "ANSWER: To replace the battery, discharge the battery below 25% [3], then pull one battery adhesive tab away from the battery [2], and remove the battery from the iPhone [2].\n" +
    "QUOTE [2]: Step 3: Slowly pull one battery adhesive tab away from the battery, towards the bottom of the iPhone.\nQUOTE [2]: Step 6: Remove the battery from the iPhone.";
  var va = L.libraryVerify(L.libraryRenumber(ia, ips).text, ips, ip.q);
  ok("...one whose other parts are their quotes' own words is handed the line for [3]: QUOTE [3]: Step 1: Before you begin, discharge your iPhone battery below 25%.",
    !va.ok && va.problems.length === 1 && va.problems[0] === "there is no QUOTE [3] line: for \u201cTo replace the battery, discharge the battery below 25%\u201d write QUOTE [3]: Step 1: Before you begin, discharge your iPhone battery below 25%.", va.problems);
  var it2 = ia + "\nQUOTE [3]: Step 1: Before you begin, discharge your iPhone battery below 25%.", v2 = L.libraryVerify(L.libraryRenumber(it2, ips).text, ips, ip.q);
  ok("...that line written, it is verified, and its answer is what the bench wants", v2.ok && new RegExp(iq.want, "i").test(it2.split("\n")[0]), v2.problems);
  var nr = row(F, "shelf-nairobi-transport"), ns = srcs(nr), nq = item("shelf-nairobi-transport");
  var nt = nr.reply.split("\n")[0] + "\nQUOTE [1]: Walking around Nairobi is fairly easy since the city is small and places are easy to get to.\n" +
    "QUOTE [1]: There is a commuter rail service from the Central Nairobi Railway Station going to Syokimau Railway Station, also known as Nairobi Terminus.\n" +
    "QUOTE [2]: From the Nairobi CBD (around Commercial/Koja roundabout), take Route 100 matatus to get to Kiambu Town.\n" +
    "QUOTE [2]: Hiring a car or using a ride-hailing app is the most convenient way to reach Kiambu from Nairobi.\n" +
    "QUOTE [3]: Ride-hailing apps such as Bolt and Uber work in Nairobi.\n" +
    "QUOTE [1]: Prices should always be negotiated before the trip, and paid afterwards (only cash is accepted, often with limited change available).";
  var nv = L.libraryVerify(L.libraryRenumber(nt, ns).text, ns, nr.q);
  // (the first draft handed it "Hiring a car or using a ride-hailing app is the most convenient way to reach Kiambu from
  // Nairobi" for its "ride-hailing apps [3]": a sentence about another town, that says more than the part. The review
  // made the rule ask for the whole sentence: Nairobi goes back as before)
  ok("Nairobi (its QUOTE [3] in no passage) goes back as before: no sentence is its part and nothing more",
    !nv.ok && nv.problems.length === 1 && nv.problems[0] === "QUOTE [3] is not in passage 3: copy the sentence exactly", nv.problems);
  var mv = [{ n: 1, title: "Kampala", text: "Kampala is the capital of Uganda. Boda-bodas are fast but dangerous." }, { n: 2, title: "Mombasa", text: "Mombasa is on an island. Matatus run on fixed routes across the island." }];
  var mvv = L.libraryVerify("ANSWER: Matatus run on fixed routes across the island [1].\nQUOTE [1]: Matatus are minibuses.", mv, "How do I get around Mombasa?");
  // (a draft moved such a part to the passage that has it; the third review moved K2's facts to Everest's passage
  // and a paracetamol limit to ibuprofen's: a line is handed only from the passage the answer cites)
  ok("a part in another passage than the one it cites is not moved there", mvv.problems[0] === "QUOTE [1] is not in passage 1: copy the sentence exactly", mvv.problems);
  // what the line is not handed to
  var gold = [{ n: 1, title: "Burns", text: "Cool the burn under cool running water for 20 minutes. Do not put butter, oil or ice on a burn. Cover it loosely with cling film." }];
  function lines(t, q) { return L.libraryVerify(t, gold, q).problems.join(" | "); }
  ok("no line for a part that is not a sentence's own words (\u201cfor 2 hours\u201d), nor for an answer with a part from memory, nor with a sentence that cites nothing",
    !/write QUOTE/.test(lines("ANSWER: Cool the burn under running water for 2 hours [1].", "How do I treat a burn?")) &&
    lines("ANSWER: Cool the burn under cool running water for 20 minutes [1], and put butter on it [1].", "How do I treat a burn?") === "there is no QUOTE [1] line" &&
    lines("ANSWER: Put butter on it. Cool the burn under cool running water for 20 minutes [1].", "How do I treat a burn?") === "there is no QUOTE [1] line" &&
    lines("ANSWER: Put butter, oil or ice on a burn [1].", "How do I treat a burn?") === "there is no QUOTE [1] line",
    [lines("ANSWER: Cool the burn under running water for 2 hours [1].", "How do I treat a burn?"), lines("ANSWER: Put butter, oil or ice on a burn [1].", "How do I treat a burn?")]);
  ok("...and a line for one that is", lines("ANSWER: Cool the burn under cool running water for 20 minutes [1].", "How do I treat a burn?") ===
    "there is no QUOTE [1] line: for \u201cCool the burn under cool running water for 20 minutes\u201d write QUOTE [1]: Cool the burn under cool running water for 20 minutes.");
  // the review of 1.24.11: of its 339 answers, a wrong one is verified once the handed line is written only where the
  // part is literally in the passage it is moved to (the iPhone 8 Plus guide's step 1 for the iPhone 8)
  var R = fixture("review1_1251_quote.json"), handed = 0, rightNow = 0, wrongNow = [];
  R.forEach(function (c) {
    var t = L.libraryRenumber(c.reply, c.sources).text, v = L.libraryVerify(t, c.sources, c.q), add = 0;
    if (v.ok) return;
    v.problems.forEach(function (p) {
      var m = /: for \u201c[\s\S]*?\u201d write QUOTE \[(\d+)\]: ([\s\S]*)$/.exec(p), mv = /: \u201c([\s\S]*?)\u201d is in passage \[(\d+)\], not \[(\d+)\] \u2014 write \[\d+\] after it in place of \[\d+\], and QUOTE \[\d+\]: ([\s\S]*?)( \u2014 and leave out your QUOTE \[\d+\] line)?$/.exec(p);
      if (m) { t += "\nQUOTE [" + m[1] + "]: " + m[2]; add++; }
      else if (mv) {
        t = t.replace(mv[1] + " [" + mv[3] + "]", mv[1] + " [" + mv[2] + "]");
        if (mv[5]) t = t.split("\n").filter(function (l) { return !new RegExp("^\\s*QUOTE\\s*\\[?\\s*" + mv[3] + "\\b").test(l); }).join("\n");
        t += "\nQUOTE [" + mv[2] + "]: " + mv[4]; add++;
      }
    });
    if (!add) return;
    handed++;
    if (L.libraryVerify(L.libraryRenumber(t, c.sources).text, c.sources, c.q).ok) { if (c.truth === "right") rightNow++; else wrongNow.push(c.name); }
  });
  ok("the 1.24.11 review's answers: lines handed to some thirty, 25 right answers verified once written, none not right",
    handed >= 28 && rightNow >= 24 && wrongNow.length === 0, [handed, rightNow, wrongNow]);

  // --- the drawings ---
  function made(id, text) { var it = item(id), m = act.fromReply(text, it.q); return { m: m, g: m ? B.grade(it, text, { made: m }) : null }; }
  var sh = row(F, "make-shore-sunset"), s1 = made("make-shore-sunset", sh.first);
  ok("the shore: \u201cdark gray\u201d is read now (a shade of the table's gray), and the beach is asked for in place of the band of water it would cover",
    s1.m && !s1.m.ok && s1.m.problems.length === 1 && s1.m.problems[0] === "the question asks for a shore, but below the horizon (y 6) the picture is all water: write rect 0 9.5 20 2.5 fill sand in place of \u201crect 0 10 20 2 fill sky\u201d (the beach, at the front of the picture)" &&
    act.fromReply("MAKE DRAWING: x\nrect 0 0 20 12 fill dark gray\nEND", "Draw a gray square.").ok && !act.fromReply("MAKE DRAWING: x\nrect 0 0 20 12 fill dark\nEND", "Draw a gray square.").ok, s1.m && s1.m.problems);
  var s2 = made("make-shore-sunset", sh.first.replace("rect 0 10 20 2 fill sky", "rect 0 9.5 20 2.5 fill sand"));
  ok("...written so, it passes the bench", s2.m.ok && s2.g.pass, [s2.m.problems, s2.g.why]);
  var s3 = made("make-shore-sunset", sh.reply);
  ok("(its retry of 1.24.13, the sand written after its own band, is asked about as hidden: the band was not named then)", !s3.m.ok && /rect 0 10 20 2 \(blue\) is hidden/.test(s3.m.problems[0]), s3.m.problems);
  var rd = row(F, "make-road-horizon"), d1 = made("make-road-horizon", rd.reply);
  // (1.24.14 named its tri, with the line to write in its place; the 35B wrote its own lines again on 1.24.14, and
  // since 1.24.15 Lantern draws the road itself, after the ground, and says so -- tests/bench_1255.js)
  ok("the road: since 1.24.15 Lantern draws it, after the ground, and the 35B's picture passes",
    d1.m.ok && d1.g.pass && JSON.stringify(d1.m.plan.said).indexOf("drew the road the question asks for, tri 7 12 13 12 10 6 fill gray, after the ground") >= 0, [d1.m.problems, d1.m.plan && d1.m.plan.said]);
  var d2 = made("make-road-horizon", "MAKE DRAWING: Road to the Horizon\nrect 0 0 20 12 fill sky\ncircle 18 2 1.5 fill yellow\nrect 0 6 20 6 fill green\ntri 7 12 13 12 10 6 fill gray\nEND");
  ok("...a road the model draws itself passes, left as it is", d2.m.ok && d2.g.pass && !(d2.m.plan.said || []).length, [d2.m.problems, d2.g.why]);
  var F4 = fixture("bench_run_1253_4b.json"), r4b = row(F4, "make-road-horizon"), e1 = made("make-road-horizon", r4b.first);
  ok("the 4B's road drawn under the ground: moved just after it and said, and the bench passes it",
    e1.m.ok && e1.g.pass && e1.m.plan && JSON.stringify(e1.m).indexOf("moved \u201ctri 0 12 10 6 20 12 fill gray\u201d after \u201crect 0 6 20 6 fill green\u201d: drawn before it, it was hidden under it") >= 0, [e1.m.problems, e1.g.why]);

  // --- the small models' run of 1.24.13 ---
  var S4 = fixture("bench_run_1253_4b.json"), S2 = fixture("bench_run_1253_2b.json"), S0 = fixture("bench_run_1253_08b.json");
  ok("the small models on 1.24.13, all on an AMD EPYC 7763: the 4B 107 of 114, the 2B 74, the 0.8B 54, every failed row kept",
    S4.summary.pass === 107 && S2.summary.pass === 74 && S0.summary.pass === 54 && S4.rows.length === 7 && S2.rows.length === 40 && S0.rows.length === 60 &&
    [S4, S2, S0].every(function (X) { return X.lantern === "1.24.13" && /EPYC 7763/.test(X.processor); }));
  var P4 = fixture("bench_run_1252_4b.json");
  ok("the 4B failed the same seven rows on 1.24.12", ids(S4).join() === ids(P4).join(), [ids(S4), ids(P4)]);
  ok("...its road with the same first reply on 1.24.10, 1.24.11, 1.24.12 and 1.24.13 (the ground drawn over it), each passing now",
    ["1250", "1251", "1252", "1253"].every(function (v) {
      var x = row(fixture("bench_run_" + v + "_4b.json"), "make-road-horizon"), y = x && made("make-road-horizon", x.first);
      return x && x.first === r4b.first && y.m.ok && y.g.pass;
    }));

  console.log(fails ? fails + " BENCH 1.24.14 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.14 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
