// bench_1247.js -- the small models' rows on 1.24.7, replayed (1.24.8).
// GitHub run 42456738734: the 4B 106 of 114, the 2B 74, the 0.8B 56 (on
// 1.24.6: 107, 57 and 51 of 112). What the rows show:
//  - the 2B wrote no arrow after a sum (21 of its failed rows had one on
//    1.24.6, copied from the short prompt, which showed "-> volts" after a
//    recipe's line); its sums went from 6 of 21 to 14;
//  - the 0.8B and the 2B passed "a road disappearing into the distance" with
//    the landscape example's eight lines, word for word, and the 4B's shore
//    at sunset was six of them: the example had a road to the mountains in
//    it. 1.24.8 gives the guide another example (tests/scene.js);
//  - the 4B's house and the 0.8B's sun over the sea were questioned to the
//    end for a shape that lay only under shapes of its own colour (the same
//    line written twice, a wall of three green rects). Drawn first or last,
//    the picture is the same, so nothing the model could change answered
//    it. The 2B's house was questioned the same way on 1.24.4, 1.24.5 and
//    1.24.6. 1.24.8 does not ask it;
//  - left for the next version, and written here as they are so that a
//    change shows: the 4B's tank of water goes back with two findings and
//    "ask with NEED" last, and the 4B asks a NEED (word for word as on
//    1.24.5); the 4B's backwards letters, worked out right by Lantern and
//    typed wrong in its sentence, are not questioned.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load(strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(js);
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
  var A = L.assist, B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct, R = L.aiRead;
  var F08 = fixture("bench_run_1247_08b.json"), F2 = fixture("bench_run_1247_2b.json"), F4 = fixture("bench_run_1247_4b.json"), F2old = fixture("bench_run_1246_2b.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(F, id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
  function drawing(F, id) { return F.drawings.filter(function (d) { return d.id === id; })[0]; }
  ok("boot clean; the fixtures are the run\u2019s failed rows and its drawings (the 0.8B 58 rows, the 2B 40, the 4B 8; five drawings each)",
    o.errs.length === 0 && F08.rows.length === 58 && F2.rows.length === 40 && F4.rows.length === 8 && F08.summary.pass === 56 && F2.summary.pass === 74 && F4.summary.pass === 106 &&
    [F08, F2, F4].every(function (F) { return F.lantern === "1.24.7" && F.summary.n === 114 && F.drawings.length === 5; }), [o.errs, F08.rows.length, F2.rows.length, F4.rows.length]);

  // --- the arrows ---
  function arrowRows(F) { return F.rows.filter(function (r) { return [r.first, r.reply].some(function (t) { return t && /^\s*=[^\n]*(->|\u2192)/m.test(t); }); }).length; }
  ok("the 2B wrote no arrow after a sum on 1.24.7 (21 of its failed rows had one on 1.24.6, where the short prompt showed \u201c-> volts\u201d after a recipe\u2019s line); nor did the 0.8B",
    arrowRows(F2old) === 21 && arrowRows(F2) === 0 && arrowRows(F08) === 0, [arrowRows(F2old), arrowRows(F2), arrowRows(F08)]);

  // --- the sums, replayed as written ---
  async function replay(F) {
    var pass = [], left = [];
    for (var i = 0; i < F.rows.length; i++) {
      var r = F.rows[i];
      if (!/^(tool|multi)$/.test(r.cat)) continue;
      var it = item(r.id), k = 0, first = r.first || r.reply;
      var out = await A.solve(it.q, { call: function () { k++; return Promise.resolve(R(k === 1 ? first : r.reply, it.q).text); } });
      (B.grade(it, out.text, out).pass ? pass : left).push(r.id);
    }
    return { pass: pass, left: left };
  }
  var r08 = await replay(F08), r2 = await replay(F2), r4 = await replay(F4);
  ok("the failed sums, replayed with the replies as the models wrote them: none passes (the 0.8B 18, the 2B 12, the 4B 1) -- 1.24.8 does not change how a sum is read",
    r08.pass.length === 0 && r08.left.length === 18 && r2.pass.length === 0 && r2.left.length === 12 && r4.pass.length === 0 && r4.left.length === 1, [r08, r2, r4]);

  // --- the landscape example, copied ---
  var OLD = ["rect 0 0 20 12 fill sky", "circle 16 3 1.5 fill yellow", "tri 1 7 6 3 11 7 fill gray", "tri 8 7 14 4 20 7 fill gray", "rect 0 7 20 5 fill green", "tri 7 12 13 12 10 7 fill tan", "rect 15 8 1 2 fill brown", "circle 15.5 7.5 1.2 fill dark green"];
  function fromOld(t) { return String(t || "").split("\n").map(function (l) { return l.replace(/^\s+|\s+$/g, ""); }).filter(function (l) { return OLD.indexOf(l) >= 0; }).length; }
  ok("1.24.7\u2019s landscape example was copied: the 0.8B\u2019s and the 2B\u2019s roads into the distance are its eight lines, and they passed; the 4B\u2019s shore at sunset is six of them",
    fromOld(drawing(F08, "make-road-horizon").reply) === 8 && drawing(F08, "make-road-horizon").pass === true && fromOld(drawing(F2, "make-road-horizon").reply) === 8 && drawing(F2, "make-road-horizon").pass === true &&
    fromOld(drawing(F4, "make-shore-sunset").reply) === 6);
  var DR = L.aiActions.filter(function (a) { return a.id === "drawing"; })[0], pr = DR.promptFor(item("make-road-horizon").q).join("\n");
  ok("...1.24.8 shows another: of 1.24.7\u2019s example only the sky and the ground are in the prompt for a landscape (the road is in the guide\u2019s words)",
    fromOld(pr.split("For example:")[1]) === 2 && pr.split("For example:")[1].indexOf("rect 0 0 20 12 fill sky\n") > 0 && pr.split("For example:")[1].indexOf("rect 0 7 20 5 fill green\n") > 0 && /A road or river going away is a tri/.test(pr) && pr.indexOf("MAKE DRAWING: Hills and a tree") > 0, pr.split("For example:")[1]);

  // --- a shape under shapes of its own colour ---
  var h4 = drawing(F4, "make-house"), s08 = drawing(F08, "make-sun-sea");
  var m4 = act.build(h4.reply, h4.q), m08 = act.build(s08.reply, s08.q), m08f = act.build(s08.first, s08.q);
  ok("the 4B\u2019s house (a wall of three green rects, one of them wholly under the other two) is made as written and passes; on 1.24.7 it was questioned to the end",
    /hidden under shapes drawn after it/.test(h4.why) && m4.ok === true && !m4.problems.length && B.grade(item("make-house"), h4.reply, { made: m4, text: h4.reply }).pass === true, [m4.problems]);
  // (the first review of 1.24.8: a shape is spared only where nothing of another look lies over it before its copy.
  // Between the 0.8B's two suns it drew "rect 18 2 18 4 fill dark green" across the first; which it meant to show,
  // Lantern cannot tell)
  ok("...the 0.8B\u2019s sun over the sea (the same circle written twice, a dark green rect across the first in between) is asked about as on 1.24.7",
    /hidden under shapes drawn after it/.test(s08.why) && m08.ok === false && /the circle 18 2 1 \(yellow\) is hidden/.test(m08.problems.join("\n")), [m08.problems]);
  var sh2 = drawing(F2, "make-shore-sunset"), msh2 = act.build(sh2.reply, sh2.q);
  ok("...a shape under shapes of another colour is questioned as before: the 2B\u2019s sea, drawn and then covered by the green ground",
    msh2.ok === false && /the rect 0 8 20 4 \(blue\) is hidden under shapes drawn after it/.test(msh2.problems.join("\n")), msh2.problems);
  var Q_ = "Draw a simple house with a red roof and a door.";
  function hid(lines) { var b = act.build("MAKE DRAWING: T\n" + lines.join("\n") + "\nEND", Q_); return b.problems.filter(function (p) { return /hidden under shapes drawn after it/.test(p); }); }
  var base = ["rect 0 0 20 12 fill sky", "rect 0 9 20 3 fill green", "rect 6 5 8 4 fill tan", "tri 5 5 10 2 15 5 fill red"];
  ok("...the rule: a door drawn before its wall is asked about; the same door written twice, or under a door of its own colour, is not; under its own colour with an outline on either, it is asked about (an outline is drawn in another colour), unless it is the same line twice",
    hid(["rect 0 0 20 12 fill sky", "rect 0 9 20 3 fill green", "rect 9 6 2 3 fill brown", "rect 6 5 8 4 fill tan", "tri 5 5 10 2 15 5 fill red"]).length === 1 &&
    hid(base.concat(["rect 9 6 2 3 fill brown", "rect 9 6 2 3 fill brown"])).length === 0 &&
    hid(base.concat(["rect 9 6 1 3 fill brown", "rect 8.5 6 2.5 3 fill brown"])).length === 0 &&
    hid(base.concat(["rect 9 6 2 3 fill brown color black", "rect 9 6 2 3 fill brown"])).length === 1 &&
    hid(base.concat(["rect 9 6 2 3 fill brown", "rect 9 6 2 3 fill brown color black"])).length === 1 &&
    hid(base.concat(["rect 9 6 2 3 fill brown color black", "rect 9 6 2 3 fill brown color black"])).length === 0 &&
    hid(base.concat(["rect 9 6 2 3 fill brown", "rect 9 6 1 3 fill brown", "rect 10 6 1 3 fill gray"])).length === 1,
    [hid(base.concat(["rect 9 6 2 3 fill brown", "rect 9 6 1 3 fill brown", "rect 10 6 1 3 fill gray"]))]);
  // (the first review: 120 drawings of its own, tests/fixtures/review1_1248_hidden.json)
  ok("...a colour is what it is (#fff is white, sky is light blue); a shape written twice with its window on top is not asked about; a wall written twice with the window between is, and so is the window",
    hid(base.concat(["rect 9 6 2 3 fill #fff", "rect 9 6 2 3 fill white"])).length === 0 && hid(["rect 0 0 20 8 fill light blue", "rect 0 8 20 4 fill green", "rect 0 0 20 8 fill sky", "circle 5 3 1 fill white"]).length === 0 &&
    hid(["rect 0 0 20 12 fill sky", "rect 5 5 10 4 fill tan", "rect 5 5 10 4 fill tan", "rect 6 6 2 2 fill white"]).length === 0 &&
    hid(["rect 0 0 20 12 fill sky", "rect 5 5 10 4 fill tan", "rect 6 6 2 2 fill white", "rect 5 5 10 4 fill tan"]).length === 2);
  var PZ = "Draw a pepperoni pizza.";
  function hidQ(q, lines) { var b = act.build("MAKE DRAWING: T\n" + lines.join("\n") + "\nEND", q); return b.problems.filter(function (p) { return /hidden under shapes drawn after it/.test(p); }); }
  ok("...anything of another colour over it before its own colour comes, and it is asked about: a bull\u2019s-eye drawn from the inside out (the centre and the white ring), a pepperoni under the sauce and partly under the cheese; a clock\u2019s hands drawn between two copies of its face (the first face is asked about: nothing reads lines)",
    hidQ("Draw a target.", ["rect 0 0 20 12 fill white", "circle 10 6 1 fill red", "circle 10 6 2 fill white", "circle 10 6 3 fill red"]).length === 2 &&
    hidQ(PZ, ["circle 10 6 5 fill tan", "circle 13.6 6 0.6 fill red", "circle 10 6 4.4 fill red", "circle 10 6 3.6 fill yellow"]).length === 1 &&
    hidQ("Draw a clock.", ["circle 10 6 5 fill white", "line 10 6 10 2.5 color black width 5", "line 10 6 13 6 color black width 5", "circle 10 6 5 fill white"]).length === 1);
  ok("...an oval is read as the box it is drawn in: a pond, oval 4 7 8 3, wholly under the grass is asked about (until 1.24.8 it was read as a centre and two radii, and not seen)",
    hidQ("Draw a pond in a field.", ["rect 0 0 20 12 fill sky", "oval 4 7 8 3 fill blue", "rect 0 6 20 6 fill green"]).length === 1 &&
    hidQ("Draw a pond in a field.", ["rect 0 0 20 12 fill sky", "rect 0 6 20 6 fill green", "oval 4 7 8 3 fill blue"]).length === 0);
  var R1 = fixture("review1_1248_hidden.json"), lost = [], asked = 0;
  R1.forEach(function (d) {
    var b = act.build("MAKE DRAWING: T\n" + d.lines.join("\n") + "\nEND", d.q), now = L.aiMakeLayout.hidden(b.plan.shapes).map(function (sh) { return sh.kind + " " + sh.nums.join(" "); });
    asked += now.length;
    (d.should || (d.helps ? d.old : [])).forEach(function (l) { var t = l.split(/\s+/), k = t[0], n = []; for (var i = 1; i < t.length && /^-?[\d.]+$/.test(t[i]); i++) n.push(parseFloat(t[i])); if (now.indexOf(k + " " + n.join(" ")) < 0) lost.push(d.name + ": " + l); });
  });
  ok("the first review\u2019s 120 drawings: no question it judged useful is lost (1.24.7 missed two, both ovals); 89 shapes found hidden, where 1.24.7 found 125",
    R1.length === 120 && lost.length === 0 && asked === 89, [lost, asked]);

  // --- left for the next version, as they are ---
  var wd = row(F4, "water-days"), pw = A.parseReply(wd.first), said = L.assistChecks.map(function (c) { try { return c(item("water-days").q, pw.exprText, A.run(pw.exprText), { parsed: pw }); } catch (e) { return null; } }).filter(Boolean);
  ok("left for the next version: the 4B\u2019s tank of water (=5*40, =2000/800) goes back with two findings, the last \u201cask with NEED\u201d, and the 4B asked a NEED, as on 1.24.5 (the line to write is not given)",
    wd.reply === "NEED: total daily water consumption in litres" && said.length === 2 && /^=5\*40 \(200\) is worked out but never used afterwards/.test(said[0]) && /ask with NEED$/.test(said[1]), said);
  var lr = row(F4, "letters-refrigerator"), pl = A.parseReply(lr.reply), rl = A.run(pl.exprText), RC = L.assistChecks.filter(function (c) { return c.id === "results"; })[0];
  ok("...and the 4B\u2019s backwards letters: Lantern works out \u201cotaegife\u201d, the sentence types \u201cefrgefao\u201d, and nothing asks about it (too unlike the word for the check of a word retyped with slips)",
    rl.steps[1].value === "otaegife" && rl.value === 8 && /efrgefao/.test(pl.answer) && RC(item("letters-refrigerator").q, pl.exprText, rl, { parsed: pl }) === null);

  console.log(fails ? fails + " BENCH 1.24.7 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.7 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
