// bench_1260.js -- Adam's third run of set B, replayed (CLAUDE.md: a bench run's failed rows go in tests/fixtures and
// tests replay them), and what 1.24.20 changed for it.
//
// Adam ran the 35B on set B of 1.24.18 with the library on his laptop (2026-11-14, 00:06 UTC, 96 minutes): 130 of 140
// (129 on 1.24.17, 122 on 1.24.16). bench_run_1258_35b_setb.json: the 13 rows that did not pass (three puzzles tried
// without Lantern's tools, not scored) as the model wrote them, and the 133 that passed, kept as a guard of right
// replies. Nine of the 13 failed on both earlier runs too -- the same row three times. Read:
//  - Lantern's own doing: the line puzzle's TRACK block said "give flag from last to front of last"; "front of" was not
//    a place, and in the next block "give flag from last to position before last" made a NEW held thing called "flag
//    from last", gave it to Fin and left the flag with Dot -- Lantern reported both, the 35B said Dot (three runs);
//    a snake that "bit" found no lesson ("bit" is not "bite"; three runs); a colour wheel written as its groups,
//    Primary: Red | Yellow | Blue and Secondary: Orange | Green | Violet, drawn as two wedges (three runs, word for word);
//    a count of the reversed word, LEN(ANS1), after REMOVE had changed it, put into the sentence as 14 letters for an
//    11-letter word; a robot's TURN block written without its first line, answered "Lantern found no TURN block".
//  - a tune Lantern did not know: Amazing Grace (the 35B wrote its own, three runs).
//  - left as they are: the Galaxy S7 (its guide was sent and the 35B still declined: what the guide's passage holds
//    needs the iFixit book itself), the path across a field (the model's picture), the motor circuit and the amp-hours
//    (once each: one row moving is not a finding).
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function fx(n) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", n), "utf8")); }
var F = fx("bench_run_1258_35b_setb.json"), F2 = fx("bench_run_1257_35b_setb.json"), F1 = fx("bench_run_1256_35b_setb.json");
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("no network")); };
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  w.eval(JS);
  var ev = w.document.createEvent("Event"); ev.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(ev);
  await sleep(400);
  var L = w.Lantern, QB = L.aiBenchQuestionsB, C = L.CHAT, A = L.assist;
  function item(id) { return QB.filter(function (x) { return x.id === id; })[0]; }
  function row(id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  function rowIn(G, id) { return G.rows.concat(G.passed).filter(function (r) { return r.id === id; })[0]; }
  function fake(replies) { var i = 0, seen = []; var f = function (m) { seen.push(m); return Promise.resolve(replies[Math.min(i++, replies.length - 1)]); }; f.seen = seen; return f; }
  function said(m) { return typeof m.content === "string" ? m.content : ""; }
  function lastSaid(f, k) { var m = f.seen[k]; return m ? said(m[m.length - 1]) : ""; }
  ok("boot clean; Adam's third run of set B: 130 of 140 on 1.24.18, 13 rows that did not pass, 133 that passed",
    errs.length === 0 && F.set === "b" && F.lantern === "1.24.18" && F.summary.pass === 130 && F.summary.n === 140 && F.rows.length === 13 && F.passed.length === 133, [errs, F.summary.pass]);
  var thrice = ["die-four-moves-b-alone", "health-b-snakebite", "letters-photosynthesis-b", "letters-photosynthesis-b-alone", "line-flag-b", "make-colour-wheel-b", "make-music-brass-b", "make-path-field-b", "shelf-galaxy-battery-b"];
  ok("nine of the 13 failed on 1.24.16 and 1.24.17 too: the same row three times",
    thrice.every(function (id) { var a = rowIn(F1, id), b = rowIn(F2, id); return row(id) && a && !a.pass && b && !b.pass; }), thrice.filter(function (id) { var b = rowIn(F2, id); return !b || b.pass; }));
  ok("four that failed there pass here (the chickens, Ghana, D minor, the float switches: 1.24.18's mends and one row moving)",
    ["need-chickens-b", "ghana-capital-b", "make-music-minor-b", "code-b-p1am-floats"].every(function (id) { return F.passed.some(function (r) { return r.id === id; }) && !rowIn(F2, id).pass; }));

  // --- the line puzzle: the flag given from the last child ------------------------------------------------------------
  var lf = row("line-flag-b"), blocks = lf.chat[0].blocks;
  ok("as run (three times): block 1 stopped at “give flag from last to front of last”; block 2 made a thing called “flag from last” and left the flag with Dot",
    /front of last is not in the row/.test(blocks[0].problems[0]) && /flag is with Dot \(position 6\); flag from last is with Fin/.test(blocks[1].final) &&
    /Dot holds the flag/.test(lf.reply) && /flag is held by Dot/.test(rowIn(F2, "line-flag-b").reply), [blocks[1].final]);
  function track(lines) { return L.aiTrack.run({ kind: "TRACK", title: "Line", lines: lines }); }
  var b1 = track(blocks[0].lines), b2 = track(blocks[1].lines);
  ok("now: both blocks run, and the flag is with Fin, the child who was in front of the last; no thing called “flag from last”",
    !b1.problems.length && !b2.problems.length && b1.held.flag === "Fin" && b2.held.flag === "Fin" && b1.row.join() === "Bo,Ada,Fin,Eli,Cy,Dot" && Object.keys(b2.held).join() === "flag", [b1.problems, b2.held]);
  var bad = track(["row Ada Bo Cy", "put flag in Cy", "give flag from first to Bo"]), never = track(["row Ada Bo Cy Dot", "give flag from last to front of last"]);
  var pole = track(["row Ada Bo Cy", "put flag in Cy", "put flag pole in Ada"]), cards = track(["row Ann Bo Cy", "put ace of spades in Ann", "give ace of spades from Ann to Cy"]);
  ok("a give from someone who does not hold it is said; so is a flag never put (not a new thing called \u201cflag from last\u201d); a flag pole beside a flag, an ace of spades, read as before (its review)",
    /flag is with Cy, not Ada/.test(bad.problems.join()) && /nothing called flag is held/.test(never.problems.join()) && pole.held["flag pole"] === "Ada" && pole.held.flag === "Cy" &&
    cards.held["ace of spades"] === "Cy", [bad.problems, never.problems, pole.held, cards.problems]);
  var nb = track(["row A B C D E", "put coin in C", "give coin to the one to the left", "swap B and the one to the right"]);
  ok("(its review) \u201cthe one to the left\u201d is the neighbour of the one who has it, never the first from the left; said with nothing, it goes back",
    !nb.problems.length && nb.held.coin === "B" && nb.row.join("") === "ACBDE" && /say from which thing/.test(track(["row A B C D E", "put coin in one to the right"]).problems.join()), [nb.problems, nb.held, nb.row]);
  var ends = track(["row A B C D E F", "put ball in A", "give ball to second to last", "pass ball to third from the end", "hand ball to last but one", "give ball to second from the front"]);
  ok("places counted from the end, and from the front", !ends.problems.length && ends.held.ball === "B" &&
    track(["row A B C D E F", "put ball in A", "give ball to third from the end"]).held.ball === "D" && track(["row A B C D E F", "put ball in A", "give ball to next to last"]).held.ball === "E", ends.problems);
  var fl = fake([["TRACK: Line"].concat(blocks[0].lines, ["END"]).join("\n"), "ANSWER: Bo, Ada, Fin, Eli, Cy, Dot; Fin holds the flag."]);
  var cl = await C.converse([lf.q], { call: fl, max_tokens: 1536 }), clt = (cl.turns || cl)[0] || {};
  ok("in Chat the results the AI is sent say Fin has the flag, and the answer passes", /flag is with Fin/.test(lastSaid(fl, 1)) && L.aiBench.grade(item("line-flag-b"), cl.text, cl).pass, [lastSaid(fl, 1).slice(0, 300)]);

  // --- the robot: a TURN block without its first line ----------------------------------------------------------------
  var rw = row("robot-walk-b");
  ok("as run: the block began “walker at 0 0 facing east” with no “TURN:” line, and no puzzle was run", /^walker at 0 0 facing east/.test(rw.reply) && !(rw.chat[0].puzzles || []).length);
  var fr = fake([rw.reply, "ANSWER: It is at (-2, 2), facing north, 2.83 squares from the start."]);
  var cr = await C.converse([rw.q], { call: fr, max_tokens: 1536 }), crt = (cr.turns || cr)[0] || {};
  ok("now the lines up to END are read as the TURN block, Lantern says so, and the AI is sent (-2, 2) facing north",
    (crt.puzzles || []).length === 1 && crt.puzzles[0].ok && /Now at \(-2, 2\) facing north/.test(lastSaid(fr, 1)) && /its first line, TURN: <title>, was not there/.test(lastSaid(fr, 1)) &&
    L.aiBench.grade(item("robot-walk-b"), cr.text, cr).pass, [lastSaid(fr, 1).slice(0, 300)]);
  var P = L.aiPuzzle;
  ok("...but not prose that starts the same way, nor lines with no END, nor the same words after something else",
    !P.find("walker at 0 0 facing east, then it goes forward 4 and turns left.").length && !P.find("walker at 0 0 facing east\nforward 4\nturn left").length &&
    !P.find("Let me set it up.\nwalker at 0 0 facing east\nforward 4\nEND").length && !P.find("walker at 0 0 facing east\nforward 4\nANSWER: (4, 0)\nEND").length &&
    P.find("row Red Blue Green\nput coin in Blue\nswap Red and Green\nEND")[0].kind === "TRACK" && P.find("cube top 1 front 2 right 3\ntip right\nEND")[0].kind === "TURN");
  ok("a block with its first line is read as before", P.find("TURN: Robot\nwalker at 0 0 facing east\nforward 4\nEND")[0].title === "Robot" && !P.find("TURN: Robot\nwalker at 0 0 facing east\nforward 4\nEND")[0].headless);

  // --- the colour wheel written as its groups --------------------------------------------------------------------------
  var cw = row("make-colour-wheel-b"), mw = L.aiAct.build(cw.reply, cw.q);
  ok("as run (three times, word for word): Primary: Red | Yellow | Blue and Secondary: Orange | Green | Violet",
    /^MAKE WHEEL: Primary and Secondary Colours\nPrimary: Red \| Yellow \| Blue\nSecondary: Orange \| Green \| Violet/.test(cw.reply) && rowIn(F2, "make-colour-wheel-b").reply === cw.reply && rowIn(F1, "make-colour-wheel-b").reply === cw.reply);
  var pw = L.aiWheel.parse({ title: "t", lines: cw.reply.split("\n").slice(1, -1) }, cw.q);
  ok("now each colour is a part of its own, round the wheel: Red, Orange, Yellow, Green, Blue, Violet, each with its group in its ring, and Lantern says so",
    pw.parts.map(function (p) { return p.name + ":" + p.items.join(); }).join(" ") === "Red:primary Orange:secondary Yellow:primary Green:secondary Blue:primary Violet:secondary" &&
    /drew each colour as a part of its own/.test(pw.said.join()) && mw.ok, [pw.parts, mw.problems]);
  var sj = JSON.stringify(mw.shapes);
  ok("...painted the colours they are named", ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6"].every(function (c) { return sj.indexOf(c) >= 0; }));
  var gw = await L.aiAct.solve(cw.q, fake([cw.reply]));
  ok("...and the row passes", L.aiBench.grade(item("make-colour-wheel-b"), gw.text, gw).pass, L.aiBench.grade(item("make-colour-wheel-b"), gw.text, gw).why);
  function parts(lines, q) { return L.aiWheel.parse({ title: "t", lines: lines }, q || "Draw a colour wheel").parts.map(function (p) { return p.name; }).join(","); }
  ok("light's wheel too (yellow between red and green); twelve, too narrow for \u201cRed-Orange\u201d, stay in their groups (its review)",
    parts(["Primary: Red | Green | Blue", "Secondary: Cyan | Magenta | Yellow"]) === "Red,Yellow,Green,Cyan,Blue,Magenta" &&
    parts(["Primary: Red | Yellow | Blue", "Secondary: Orange | Green | Violet", "Tertiary: Red-Orange | Yellow-Orange | Yellow-Green | Blue-Green | Blue-Violet | Red-Violet"]) === "Primary,Secondary,Tertiary");
  var halves = L.aiAct.build(cw.reply, "Make a wheel cut into two halves: the three primary colours in one half and the three secondary colours in the other.");
  ok("(its review) a wheel asked for in halves stays in its halves; a tertiary named the other way round is painted its colour",
    halves.plan.parts.map(function (p) { return p.name; }).join() === "Primary,Secondary" && L.aiWheelColours.forItem("Orange-Red") === L.aiWheelColours.forItem("Red-Orange"));
  ok("...not a wheel of teams, of seasons, nor groups with a colour that has no place on the wheel",
    parts(["Team A: Red | Blue", "Team B: Green | Yellow"]) === "Team A,Team B" && parts(["Primary: Red | Yellow | Blue", "Neutral: Black | White | Gray"]) === "Primary,Neutral" &&
    parts(["Spring: March | April | May", "Summer: June | July | August"]) === "Spring,Summer" && parts(["Primary: Red | Yellow | Brown", "Secondary: Orange | Green | Violet"]) === "Primary,Secondary");

  // --- photosynthesis: the count of the word before REMOVE changed it ----------------------------------------------
  var ph = row("letters-photosynthesis-b"), pq = ph.q, pp = A.parseReply(ph.reply), pr = A.run(pp.exprText);
  ok("as run: =REVERSE, =REMOVE(ANS,“s”), =LEN(ANS1) -- and the sentence was filled in with 14 letters for iehtnyotohp",
    /=LEN\(ANS1\)/.test(ph.reply) && ph.chat[0].repaired.join() === "noitohpyto -> iehtnyotohp,10 -> 14" && pr.steps[2].value === 14);
  var chk = L.aiResultChecks.check(pq, pp.exprText, pr, { parsed: pp });
  ok("now line 3 is questioned, with the line to write", /line 3 counts line 1’s word \(“sisehtnysotohp”\), but line 2 changed it to “iehtnyotohp”: to count that, write =LEN\(ANS2\)/.test(chk), chk);
  var first = rowIn(F2, "letters-photosynthesis-b").reply, fp = fake([first, ph.reply, ph.reply]);
  var cp = await C.converse([pq], { call: fp, max_tokens: 1536 }), cpt = (cp.turns || cp)[0] || {};
  ok("...and when the AI keeps it, Chat counts line 2’s word, says so, and the sentence says 11 letters",
    (cpt.rechained || []).join() === "line 3: ANS1 -> ANS2 (“iehtnyotohp”)" && /iehtnyotohp\W+, which has 11 letters/.test(cpt.answerText || "") && cpt.value === 11, [cpt.rechained, cpt.answerText]);
  var keep = A.parseReply("=REVERSE(\x22photosynthesis\x22)\n=REMOVE(ANS,\x22s\x22)\n=LEN(ANS1)\nANSWER: The reversed word {ANS1} has {ANS3} letters; without its s it is {ANS2}.");
  ok("a count of the first word that the ANSWER is about stands", L.aiResultChecks.countsOld(A.run(keep.exprText).steps, keep.answer).length === 0);

  // --- the snake bite ----------------------------------------------------------------------------------------------
  var sb = item("health-b-snakebite");
  ok("as run (three times): Chat went to the library and not to its lessons", row("health-b-snakebite").chat[0].searches.every(function (s) { return s.how !== "lessons"; }));
  ok("now “a snake bit my uncle” gets the lesson Bites and stings; so do a dog that bit, a scorpion that just bit, a spider that has bit",
    L.healthLessons(sb.turns[0]).map(function (x) { return x.key; })[0] === "health_bites" &&
    ["A dog bit my daughter on the leg", "a scorpion just bit him", "A spider has bit my son"].every(function (q) { return (L.healthLessons(q)[0] || {}).key === "health_bites"; }));
  var fs2 = fake(["ANSWER: Keep him still and calm and carry him to help; do not let him walk [1].\nQUOTE [1]: keep the person still and calm"]);
  var cs = await C.converse(sb.turns, { call: fs2 }), cst = (cs.turns || cs)[0] || {};
  ok("...and Chat sends it", (cst.searches || []).some(function (s) { return s.how === "lessons"; }) && (cst.sources || []).some(function (s) { return s.key === "health_bites"; }), cst.searches);

  // --- Amazing Grace -------------------------------------------------------------------------------------------------
  var SB = L.musicSongbook, ag = SB.asksFor(item("make-music-brass-b").q);
  ok("as run (three times): the 35B wrote a tune of its own", /melody G G A C B A/.test(row("make-music-brass-b").reply) && /note 2 of the tune is wrong/.test(row("make-music-brass-b").why));
  ok("now Lantern knows the tune: the brass band question is given its lines, and they make a song with nothing to say about them",
    ag && ag.id === "amazing-grace" && SB.prompt(item("make-music-brass-b").q).length > 0 && SB.plan(ag) && L.musicSong.make({ title: ag.title, lines: SB.lines(ag).split("\n") }).problems.length === 0);
  var agp = SB.plan(ag), mids = agp.melody.map(function (n) { return n.midi; });
  ok("...whose first notes are the opening Lantern already knew Amazing Grace by (MUSIC_TUNES), and which ends on the key’s home note",
    L.musicTunes.find(mids).title === "Amazing Grace" && mids[mids.length - 1] % 12 === 0);
  var fa = fake([row("make-music-brass-b").first, "MAKE MUSIC: Amazing Grace\n" + SB.lines(ag) + "\narrange brass\nEND"]), ma = await L.aiAct.solve(item("make-music-brass-b").q, fa);
  ok("...the run’s reply goes back with the lines, and the tune written as given passes", /the melody is not Amazing Grace as Lantern knows it/.test(lastSaid(fa, 1)) && L.aiBench.grade(item("make-music-brass-b"), ma.text, ma).pass,
    lastSaid(fa, 1).slice(0, 300));

  // --- the first review of 1.24.20's rules (fixtures/review1_1260.json, 333 cases of its own), replayed -------------
  var RV = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1260.json"), "utf8")).cases;
  function of(r) { return RV.filter(function (c) { return c.rule === r; }); }
  // 1: every case whose expected state is written out (the row | what is held), and every one that should go back
  function state(o) { if (o.problems.length) return "ERR"; var h = {}; Object.keys(o.held).forEach(function (k) { if (o.held[k]) h[k] = o.held[k]; }); return o.row.join(" ") + "|" + JSON.stringify(h); }
  function want(e) {
    var m = /^([^|]+?)(?:\s*\|\s*(\{.*?\}))?(?:\s+--|$)/.exec(e);
    if (/^an error/.test(e)) return "ERR";
    if (!m || /\|/.test(m[1])) return null;
    var h = m[2] ? JSON.parse(m[2]) : {}, k2 = {};
    Object.keys(h).forEach(function (k) { k2[k.split("|").pop()] = h[k]; });   // "gold coin|gold": the name Lantern keeps
    return m[1].trim() + "|" + JSON.stringify(k2);
  }
  var t1 = [], n1 = 0;
  of(1).forEach(function (c) {
    var w0 = want(String(c.expected)); if (w0 == null || /^r1-(40|65)$/.test(c.id)) return;   // gold coin / key ring beside gold / key: as in 1.24.19
    n1++;
    var got = state(track(c.input.split(" / ")));
    var same = got === w0 || (w0 !== "ERR" && got !== "ERR" && got.split("|")[0] === w0.split("|")[0] && JSON.stringify(JSON.parse(got.split("|")[1])) === JSON.stringify(JSON.parse(w0.split("|")[1])));
    if (!same) { var a = got.split("|"), b = w0.split("|"); if (!(a[0] === b[0] && a[1] && b[1] && JSON.stringify(sortObj(JSON.parse(a[1]))) === JSON.stringify(sortObj(JSON.parse(b[1]))))) t1.push([c.id, c.input, w0, got]); }
  });
  function sortObj(o) { var r = {}; Object.keys(o).sort().forEach(function (k) { r[k] = o[k]; }); return r; }
  ok("(its review) the TRACK cases with a state written out (" + n1 + "): each as the reviewer worked it out by hand, or sent back where it should be", n1 >= 60 && !t1.length, [n1, t1.slice(0, 6)]);
  // 2: a block only where it is one
  var t2 = [];
  of(2).forEach(function (c) {
    if (/^Chat/.test(c.input)) return;
    var bs = P.find(String(c.input).replace(/ \/ /g, "\n")), e = String(c.expected);
    if (/^no block/.test(e) && bs.some(function (b) { return b.headless; })) t2.push([c.id, "read"]);
    if (/^read as a (TURN|TRACK) block/.test(e) && !bs.length) t2.push([c.id, "not read"]);
  });
  ok("(its review) no knitting row, theatre row, car at 60 km/h or End position: read as a block; every headless block it wrote read", !t2.length, t2);
  // 4: no right chain questioned; the wrong ones it wrote caught (one missed, as with the first draft)
  var t4 = [], caught = 0;
  of(4).forEach(function (c) {
    var p0 = A.parseReply(String(c.input).replace(/^Q: [^\n]*\n/, "")), co = p0.exprText ? L.aiResultChecks.countsOld(A.run(p0.exprText).steps, p0.answer) : [];
    if (/^right chain/.test(c.expected) && co.length) t4.push(c.id);
    if (/^wrong count/.test(c.expected) && co.length) caught++;
  });
  ok("(its review) none of its 41 right chains questioned (15 were, by the first draft), and 10 of its 11 wrong counts caught", !t4.length && caught === 10, [t4, caught]);
  // 5: the bite rewrite adds the bites lesson only for a bite to a person
  var t5 = [];
  of(5).forEach(function (c) {
    var keys = L.healthLessons(c.input).map(function (x) { return x.key; }), was = String(c.lantern_1_24_19 || "");
    if (/^no health lesson|^not the bites lesson/.test(c.expected) && keys.indexOf("health_bites") >= 0 && was.indexOf("health_bites") < 0) t5.push([c.id, c.input]);
    if (/^the bites lesson$|^the bites lesson --/.test(c.expected) && keys.indexOf("health_bites") < 0 && was.indexOf("health_bites") >= 0) t5.push([c.id, "lost", c.input]);
  });
  ok("(its review) no horse's bit, cable, goat, apple or furniture given the bites lesson that 1.24.19 did not give it; no bite that had it lost it", !t5.length, t5);

  // --- the second review (fixtures/review2_1260.json, 265 cases of its own), replayed --------------------------------
  // Each case comes out as the reviewer worked it out, or is one of these, each with its reason
  var LEFT2 = {
    T32: "\u201cthe one on the right\u201d: goes back, as in 1.24.19 (in a row of cups it may be the right-hand one)", T74: "the same",
    T35: "\u201cgive a ball from Ann to Bo\u201d with no ball put: goes back (the reviewer: a problem is acceptable)",
    T71: "gold coin and gold ring: as in 1.24.19 (a coin's word is dropped from its name)",
    T75: "\u201cthe person next in line\u201d: goes back, as in 1.24.19", T77: "throw is not a TRACK word: goes back, as in 1.24.19",
    H14: "\u201cStart at 0 0\u201d: not read without its first line, as in 1.24.19", H15: "\u201cAnn and Bo swap\u201d as a second line: the same",
    H27: "\u201cdrive north 5\u201d as a second line: the same", H45: "every line in bold: the same",
    W04: "a wheel of warm and cool colours, not asked for as a colour wheel: left in its two parts (either is right, the reviewer says)",
    W30: "\u201cmy art group\u201d: \u201cgroup\u201d keeps the groups (as 1.24.19 drew it)", W41: "not asked for as a colour wheel: as 1.24.19 drew it",
    C26: "a count in the next sentence: not asked about (the rule asks only of a count put on the word)", C27: "a count before the word: the same",
    C31: "a dash between word and count: the same", C32: "a colon: the same", C33: "two changes later: the same", C35: "a second line on ANS1: the same",
    B09: "\u201csomething bit me\u201d: no animal named", B19: "\u201cgot bit by a big dog\u201d: a need, but the search ranks bleeding first",
    B22: "\u201cbit Tom\u201d: a name", B25: "mosquitoes: the malaria lesson comes first", B26: "the same", B30: "a general question about rabies"
  };
  var R2 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review2_1260.json"), "utf8")).cases, off2 = [], n2 = 0;
  R2.forEach(function (c) {
    var e = c.expected, bad = null;
    if (c.rule === 1) {
      var o = track(c.input.split(" / "));
      if (e === "problem") bad = o.problems.length ? null : "no problem";
      else if (o.problems.length) bad = "problem";
      else {
        if (e.held) Object.keys(e.held).forEach(function (k) { if (o.held[k] !== e.held[k]) bad = "held " + JSON.stringify(o.held); });
        if (e.held && Object.keys(o.held).some(function (k) { return o.held[k] && !(k in e.held); })) bad = "extra " + JSON.stringify(o.held);
        if (e.row && o.row.join() !== e.row.join()) bad = "row " + o.row.join(" ");
      }
    } else if (c.rule === 2) {
      if (typeof e === "string") return;
      var bs = P.find(c.input);
      bad = e === null ? (bs.some(function (b) { return b.headless; }) ? "read" : null) : (bs.length ? null : "not read");
    } else if (c.rule === 3) {
      var b = L.aiAct.build(c.input.block, c.input.question), ps = (b.plan && b.plan.parts || []).map(function (p) { return p.name; });
      bad = e === "groups" ? (ps.length === L.aiWheel.parse({ title: "t", lines: c.input.block.split("\n").slice(1, -1) }).parts.length ? null : "split") : (ps.join() === e.split.join() ? null : "not split");
      if (/Green-Yellow/.test(c.input.block) && L.aiWheelColours.forItem("Green-Yellow")) bad = "a striped earth painted";
    } else if (c.rule === 4) {
      var p2 = A.parseReply(c.input.reply), co2 = L.aiResultChecks.countsOld(A.run(p2.exprText).steps, p2.answer);
      bad = e === "kept" && co2.length ? "questioned" : e === "questioned" && !co2.length ? "missed" : null;
    } else if (c.rule === 5) {
      var ks = L.healthLessons(c.input).map(function (x) { return x.key; }), nd = L.healthNeed(c.input), was = c.lantern_1_24_19 || {};
      if (/^not a bite/.test(e) && ks.indexOf("health_bites") >= 0 && (was.lessons || []).indexOf("health_bites") < 0) bad = "the bites lesson";
      if (/^not a bite/.test(e) && nd && !was.need) bad = "a need";
      if (/^a bite/.test(e) && ks.indexOf("health_bites") < 0) bad = "no bites lesson";
    }
    n2++;
    if (bad && !LEFT2[c.id]) off2.push([c.id, bad]);
  });
  ok("(its second review) " + n2 + " cases: each as the reviewer worked it out, or one of the " + Object.keys(LEFT2).length + " left with their reasons (most as 1.24.19 did them)", n2 >= 250 && !off2.length, off2);

  // --- a guard of right replies: every passed row of the three runs ------------------------------------------------
  var guard = F.passed.concat(F2.passed, F1.passed), counted = [], headless = [];
  guard.forEach(function (r) {
    var t = String(r.reply || ""), p0 = A.parseReply(t);
    if (p0.exprText) { var co = L.aiResultChecks.countsOld(A.run(p0.exprText).steps, p0.answer); if (co.length) counted.push(r.id); }
    var bs = P.find(t);
    if (bs.some(function (b) { return b.headless; })) headless.push(r.id);
    (r.chat || []).forEach(function (tn) { (tn.blocks || []).forEach(function (b) { if (b.kind === "TRACK" && b.ok) { var again = track(b.lines); if (again.problems.length) headless.push(r.id + " (TRACK)"); } }); });
  });
  ok("the passed rows of all three runs (" + guard.length + "): no count questioned, no block read that was not there, every TRACK block still runs",
    !counted.length && !headless.length, [counted, headless]);

  console.log(fails ? fails + " BENCH 1.24.20 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.20 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
