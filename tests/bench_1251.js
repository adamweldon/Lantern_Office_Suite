// bench_1251.js -- the small models' rows on 1.24.11, replayed (1.24.12).
// GitHub run 42543507663: the 0.8B 59 of 114 (the replies of 1.24.10, word for word, on the same processor), the 2B
// 72 (73 on 1.24.10, now on another processor), the 4B 106 (the same eight rows as on 1.24.10, on the same AMD EPYC
// 7763; seven with the same reply).
// Two programs that went unread, each on two versions with the same reply, are read now:
//  - the 2B writes the MAKE CODE block without its first line: "<title>ST: Tank Fill Valve Control</title>",
//    "language st", the program, END (the tank fill), or the sketch between <title> and </title> (Blink) -- the
//    instructions' placeholder <title> taken for a tag. Lantern said "no MAKE block"; now it reads the program and
//    sends back what is wrong with it (delay() in a sketch asked not to use it; LOOP in Structured Text);
//  - the 4B's tank fill: its first reply was "LESSON: Tank fill/stop logic" until its 1,000 tokens ran out, twice,
//    and its last reply stopped half-way through the program, inside its fence. Now: the request stays in the
//    conversation once (not 1,000 tokens of it), the lessons come with the block's first line instead of "answer
//    and QUOTE", and a program cut off inside its fence is read and sent back as cut off.
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
function textOf(c) { return typeof c === "string" ? c : (c || []).map(function (x) { return x && x.type === "text" ? x.text : ""; }).join("\n"); }
function seq(list, seen) { var i = 0; return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return { role: m.role, content: textOf(m.content) }; })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var act = L.aiAct, B = L.aiBench, Q = L.aiBenchQuestions;
  var A08 = fixture("bench_run_1251_08b.json"), A2 = fixture("bench_run_1251_2b.json"), A4 = fixture("bench_run_1251_4b.json");
  var P08 = fixture("bench_run_1250_08b.json"), P2 = fixture("bench_run_1250_2b.json"), P4 = fixture("bench_run_1250_4b.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(X, id) { return X.rows.filter(function (r) { return r.id === id; })[0]; }
  function ids(X) { return X.rows.map(function (r) { return r.id; }).sort().join(); }
  ok("boot clean; the run: 0.8B 59, 2B 72, 4B 106 of 114", o.errs.length === 0 && A08.summary.pass === 59 && A2.summary.pass === 72 && A4.summary.pass === 106 &&
    A08.lantern === "1.24.11" && A4.processor === "AMD EPYC 7763" && A2.processor === "AMD EPYC 9V74", o.errs);
  ok("the 0.8B, on the same processor as on 1.24.10, wrote the same replies to the same 55 rows", ids(A08) === ids(P08) &&
    A08.rows.every(function (r) { return row(P08, r.id).reply === r.reply; }));
  ok("the 4B, on the same processor, failed the same eight rows; seven with the same reply (the orchestra\u2019s strings were mended in 1.24.11, its brass is short)",
    ids(A4) === ids(P4) && A4.rows.filter(function (r) { return row(P4, r.id).reply === r.reply; }).length === 7 && row(A4, "make-music-orchestra").reply !== row(P4, "make-music-orchestra").reply);

  // --- the 2B: the MAKE CODE block without its first line ---
  var tq = item("code-st-tank-fill"), bq = item("code-blink-millis");
  [[A2, "1.24.11"], [P2, "1.24.10"]].forEach(function (x) {
    var tr = row(x[0], "code-st-tank-fill"), br = row(x[0], "code-blink-millis");
    ok("the 2B on " + x[1] + ": a <title> line and a language line, no MAKE CODE line; Lantern said \u201cno MAKE block\u201d", tr.why === "no MAKE block" && br.why === "no MAKE block" &&
      /^<title>ST: Tank Fill Valve Control<\/title>\nlanguage st$/m.test(tr.reply) && !/MAKE CODE/.test(tr.reply) && /^<title>$/m.test(br.reply) && /^<\/title>$/m.test(br.reply));
    var tm = act.fromReply(tr.reply, tq.q), bm = act.fromReply(br.reply, bq.q);
    ok("...1.24.12 reads both programs, with the title the 2B gave one", tm && tm.plan && tm.plan.lang === "st" && tm.block.title === "ST: Tank Fill Valve Control" && /^PROGRAM Tank/m.test(tm.plan.text) &&
      !/<title>|language st|^END$|>>>/m.test(tm.plan.text) && bm && bm.plan && bm.plan.lang === "arduino" && !/<\/?title>/.test(bm.plan.text) && /void loop\(\)/.test(bm.plan.text), [tm && tm.plan, bm && bm.plan]);
    var bb = act.replyCode(br.reply, bq.q), tb = act.replyCode(tr.reply, tq.q);
    ok("...and sends each back once, with what is wrong: delay() where the question said without it, with the millis() lines; the Structured Text\u2019s own problem",
      bb && /calls delay\(\), and the question says without delay\(\).*millis\(\) - last >= 500/.test(bb.problems.join("; ")) && tb && tb.problems.length >= 1, [bb && bb.problems, tb && tb.problems]);
  });
  ok("the 1.24.10 tank fill: LOOP ... END_LOOP is not Structured Text, and Lantern says so", /END_LOOP closes the PROGRAM/.test(act.fromReply(row(P2, "code-st-tank-fill").reply, tq.q).problems.join("; ")));

  // --- the 4B: a program cut off inside its fence ---
  var cr = row(A4, "code-st-tank-fill");
  ok("the 4B: \u201cLESSON: Tank fill/stop logic\u201d until its tokens ran out, then prose and a program that stops inside its fence", cr.why === "no MAKE block" &&
    (cr.first.match(/LESSON: Tank fill\/stop logic/g) || []).length > 100 && /\x60\x60\x60st\n/.test(cr.reply) && (cr.reply.match(/\x60\x60\x60/g) || []).length === 1);
  var cm = act.fromReply(cr.reply, tq.q), cb = act.replyCode(cr.reply, tq.q);
  ok("1.24.12 reads what there is and says it was cut off, at its line, and that is the one problem it sends back",
    cm && cm.plan && cm.plan.lang === "st" && cm.problems.length === 1 && /^the program stops at line 10, inside its \x60\x60\x60 fence: the reply was cut off/.test(cm.problems[0]) && cb, cm && cm.problems);
  ok("Chat shows the code under the reply as cut off", L.chatCode.blocks(cr.reply)[0].cut === true && L.chatCode.blocks(cr.reply.replace(/\(\* Logic: Open valve if low float$/, "END_PROGRAM\n\x60\x60\x60\n"))[0].cut !== true);

  // --- the 4B's request, kept once ---
  var seen = [], lessonReply = row(A4, "code-st-tank-fill").first;
  var out = await act.solve(tq.q, seq([lessonReply, tq.ideal], seen));
  var sec = seen[1] || [], asked = sec.filter(function (m) { return m.role === "assistant"; }).pop(), lp = sec[sec.length - 1];
  ok("the request the 4B wrote over and over stays in the conversation once", out.commands && out.commands[0] === "LESSON: Tank fill/stop logic" && asked &&
    asked.content === "LESSON: Tank fill/stop logic" && lessonReply.length > 3000, asked && asked.content.slice(0, 200));
  ok("the lessons come with the block\u2019s first line, not \u201canswer and QUOTE\u201d; the block that follows is made",
    lp && /^LESSONS: passages/.test(lp.content) && /reply with ONLY the block, with no \[n\]/.test(lp.content) && /^MAKE CODE: <a short title>$/m.test(lp.content) && !/QUOTE \[n\]/.test(lp.content) &&
    out.made && out.made.ok && B.grade(tq, out.text, out).pass === true, lp && lp.content.slice(-700));
  var hq = "How do I check the oil in a car engine?", hp = L.chatCommands.filter(function (c) { return c.verb === "LESSON"; })[0].run("oil check", hq);
  ok("a question that asks for no block gets the lessons as before, to answer and QUOTE", hp && hp.prompt && /QUOTE \[n\]/.test(hp.prompt) && !/ONLY the block/.test(hp.prompt));
  var short = "LESSON: Stepper motor wiring";
  seen = [];
  await act.solve(item("code-accelstepper").q, seq([short, item("code-accelstepper").ideal], seen));
  ok("a short request stays as it was written", (seen[1] || []).filter(function (m) { return m.role === "assistant"; }).pop().content === short);
  console.log(fails ? fails + " BENCH 1.24.11 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.11 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
