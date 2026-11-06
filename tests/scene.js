// scene.js -- a landscape drawn the way the eye sees one (AI_SCENE, 1.24.7).
// Adam, with the 35B on 1.24.6: "an ocean shore with mountains in the
// distance at sunset" came back with two gray mountains whose bases were
// flat lines in the sky and the sun drawn in front of one of them, and no
// shore; "a road disappearing into the distance over a far horizon" came
// back as three upright lines side by side, the same two mountains in the
// air and the sun in front again. The model was shown each picture and said
// LOOKS RIGHT. Both blocks are replayed here as it wrote them.
//
// Lantern reads where the ground is from the block (the wide rect that
// reaches the bottom edge; its top is the horizon) and does what can be
// computed: stands a floating mountain on the horizon, puts the sun behind
// the land, draws a road narrowing to the horizon -- and says so. What it
// cannot make (a shore nobody drew, a road nobody drew) goes back once with
// the line to add.
//
// A picture that is right as written must come through untouched, so half of
// this file is pictures Lantern leaves alone: a hut with its roof, pines in
// tiers, a sailboat, snow caps, pyramids, a balloon, a fence, a kite.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
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
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list, seen) {
  var i = 0;
  return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return textOf(m.content); })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); };
}
function linesOf(text) { return text.split("\n").slice(1).filter(function (l) { return l && l !== "END"; }); }
function block(title, lines) { return "MAKE DRAWING: " + title + "\n" + lines.join("\n") + "\nEND"; }

// Adam's two blocks, as the 35B wrote them (from his screenshot of the Chat, 2026-11-06)
var SHORE_Q = "draw a picture of an ocean shore with mountains in the distance at sunset";
var SHORE = block("Ocean shore at sunset", ["rect 0 0 20 12 fill orange", "rect 0 8 20 4 fill blue", "tri 2 8 10 4 18 8 fill brown", "tri 1 5 6 2 11 5 fill gray", "tri 8 6 14 3 19 6 fill gray", "circle 16 3 2 fill yellow"]);
var ROAD_Q = "draw a picture of a road dissapearing into the distance over a far horizon. Fill other things into the picture as needed";
var ROAD = block("Road to the horizon", ["rect 0 0 20 12 fill sky", "rect 0 6 20 6 fill green", "line 10 6 10 12 fill black width 1", "line 9 6 9 12 fill black width 1", "line 11 6 11 12 fill black width 1",
  "tri 2 6 10 4 18 6 fill brown", "tri 1 4 6 2 11 4 fill gray", "tri 9 5 14 3 19 5 fill gray", "circle 16 3 2 fill yellow"]);

// pictures that are right as written: [what, question, block]
var RIGHT = [
    ["example landscape", "Draw a road going to the mountains.", "MAKE DRAWING: Road to the mountains\nrect 0 0 20 12 fill sky\ncircle 16 3 1.5 fill yellow\ntri 1 7 6 3 11 7 fill gray\ntri 8 7 14 4 20 7 fill gray\nrect 0 7 20 5 fill green\ntri 7 12 13 12 10 7 fill tan\nrect 15 8 1 2 fill brown\ncircle 15.5 7.5 1.2 fill dark green\nEND"],
    ["hut by a tree", "Draw a hut by a tree.", "MAKE DRAWING: Hut by a tree\nrect 0 0 20 12 fill sky\ncircle 18 2 1 fill yellow\nrect 0 9 20 3 fill green\nrect 3 6 4 3 fill tan\ntri 2 6 5 3 8 6 fill brown\nrect 4 7 1 2 fill dark green\nrect 13 5 2 4 fill brown\ncircle 14 4 2 fill dark green\nEND"],
    ["pines", "Draw a forest of pine trees on a hill.", "MAKE DRAWING: Pines\nrect 0 0 20 12 fill sky\nrect 0 9 20 3 fill green\nrect 4.5 8 1 2 fill brown\ntri 2 8 5 5 8 8 fill dark green\ntri 3 6 5 3 7 6 fill dark green\nrect 13.5 8 1 2 fill brown\ntri 11 8 14 5 17 8 fill dark green\ntri 12 6 14 3 16 6 fill dark green\nEND"],
    ["sailboat", "Draw a sailboat on the sea.", "MAKE DRAWING: Sailboat\nrect 0 0 20 7 fill sky\nrect 0 7 20 5 fill blue\nrect 7 6.5 6 1 fill brown\ntri 9 1.5 9 6 14 6 fill white\nline 9 1 9 6.5 color black width 2\nEND"],
    ["snow caps", "Draw two snowy mountains above a green valley.", "MAKE DRAWING: Snowy mountains\nrect 0 0 20 12 fill sky\ntri 0 8 6 2 12 8 fill gray\ntri 8 8 14 3 20 8 fill gray\ntri 4.5 3.5 6 2 7.5 3.5 fill white\ntri 12.8 4.2 14 3 15.2 4.2 fill white\nrect 0 8 20 4 fill green\nEND"],
    ["pyramids", "Draw the pyramids in the desert.", "MAKE DRAWING: Pyramids\nrect 0 0 20 12 fill sky\ncircle 3 2 1 fill yellow\nrect 0 8 20 4 fill sand\ntri 2 9 7 3 12 9 fill tan\ntri 10 9 14 5 18 9 fill gold\nEND"],
    ["sunset sea (ideal)", "Draw a yellow sun above a blue sea.", "MAKE DRAWING: Sun over the sea\nrect 0 8 20 4 fill blue\ncircle 10 4 2 fill yellow\nEND"],
    ["balloon over hills", "Draw a yellow balloon floating over the hills.", "MAKE DRAWING: Balloon\nrect 0 0 20 12 fill sky\ntri 0 8 6 4 12 8 fill green\ntri 8 8 14 5 20 8 fill green\nrect 0 8 20 4 fill green\ncircle 10 4 1.5 fill yellow\nline 10 5.5 10 7 color black width 1\nEND"],
    ["fence in a field", "Draw a fence across a field.", "MAKE DRAWING: Fence\nrect 0 0 20 12 fill sky\nrect 0 6 20 6 fill green\nline 4 6 4 12 color brown width 3\nline 8 6 8 12 color brown width 3\nline 12 6 12 12 color brown width 3\nline 16 6 16 12 color brown width 3\nEND"],
    ["road side view", "Draw a car on a road.", "MAKE DRAWING: Car on a road\nrect 0 0 20 12 fill sky\nrect 0 8 20 4 fill green\nrect 0 9 20 2 fill gray\nrect 7 7.5 5 1.5 fill red\ncircle 8 9.2 0.6 fill black\ncircle 11 9.2 0.6 fill black\nEND"],
    ["road already narrowing", "Draw a road disappearing into the distance.", "MAKE DRAWING: Road\nrect 0 0 20 6 fill sky\nrect 0 6 20 6 fill green\ntri 6 12 14 12 10 6 fill gray\nline 10 12 10 6 color white width 2\nEND"],
    ["kite and birds", "Draw a kite flying over a beach.", "MAKE DRAWING: Kite\nrect 0 0 20 12 fill sky\nrect 0 7 20 5 fill blue\nrect 0 10 20 2 fill sand\ntri 12 3 14 1 16 3 fill red\ntri 12 3 14 5 16 3 fill red\nline 14 5 9 10 color black width 1\nEND"]
];

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var S = L.aiScene, act = L.aiAct, B = L.aiBench, Q = L.aiBenchQuestions, DR = L.aiActions.filter(function (a) { return a.id === "drawing"; })[0];
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function grade(id, text, AA, BB, QQ) { var it = (QQ || Q).filter(function (q) { return q.id === id; })[0], made = (AA || act).build(text, it.q); return (BB || B).grade(it, text, { made: made }); }
  ok("boot clean", o.errs.length === 0 && !!S, o.errs);

  // --- Adam's shore ---
  var ms = S.mend(linesOf(SHORE), SHORE_Q);
  ok("the shore: the two gray mountains stand on the horizon (their sides carried down to y 8, their peaks where the model put them), behind the brown hill that was already on the ground; the sun comes straight after the sky",
    ms.lines.join("\n") === ["rect 0 0 20 12 fill orange", "circle 16 3 2 fill yellow", "tri 1 8 6 2 11 8 fill gray", "tri 8 8 14 3 19 8 fill gray", "rect 0 8 20 4 fill blue", "tri 2 8 10 4 18 8 fill brown"].join("\n"), ms.lines);
  ok("...and Lantern says what it did, in plain words", ms.said.length === 2 &&
    ms.said[0] === "stood the 2 gray mountains on the horizon (y 8), behind what was already on the ground: their bases were in the sky" &&
    ms.said[1] === "put the sun behind the mountain: it was drawn in front", ms.said);
  ok("...a shore nobody drew goes back, with the line to add for this picture (its horizon is at 8)", ms.problems.length === 1 &&
    ms.problems[0] === "the question asks for a shore, but below the horizon (y 8) the picture is all water: add rect 0 10.5 20 1.5 fill sand after the water (the beach, at the front of the picture)", ms.problems);
  var seenS = [], SHORE2 = SHORE.replace("rect 0 8 20 4 fill blue\n", "rect 0 8 20 4 fill blue\nrect 0 10.5 20 1.5 fill sand\n");
  var outS = await act.solve(SHORE_Q, seq([SHORE, SHORE2], seenS)), madeS = act.build(outS.text, SHORE_Q);
  ok("...the block goes back once with that line; the model\u2019s second block (the same mountains in the air again, and the sand) is mended the same way and is kept",
    outS.rounds === 2 && outS.fixed === true && /add rect 0 10\.5 20 1\.5 fill sand after the water/.test(seenS[1][seenS[1].length - 1]) && madeS.ok === true && madeS.plan.shapes.length === 7 &&
    /^7 shapes\. Lantern stood the 2 gray mountains on the horizon \(y 8\)/.test(madeS.summary) && madeS.plan.said.length === 2, [outS.rounds, outS.fixed, madeS.summary, madeS.problems]);
  ok("...and the picture passes the bench\u2019s shore question; as the model wrote it, with Lantern\u2019s scene module taken out, it does not",
    grade("make-shore-sunset", SHORE2).pass === true && grade("make-shore-sunset", item("make-shore-sunset").ideal).pass === true, grade("make-shore-sunset", SHORE2));

  // --- Adam's road ---
  var mr = S.mend(linesOf(ROAD), ROAD_Q);
  ok("the road: three upright lines side by side become a road going away -- a gray tri from the bottom edge to a point on the horizon, the three lines along its edges and its middle; the mountains stand on the horizon, the sun behind them",
    mr.lines.join("\n") === ["rect 0 0 20 12 fill sky", "circle 16 3 2 fill yellow", "tri 1 6 6 2 11 6 fill gray", "tri 9 6 14 3 19 6 fill gray", "rect 0 6 20 6 fill green", "tri 7 12 13 12 10 6 fill gray",
      "line 10 12 10 6 fill black width 1", "line 7 12 10 6 fill black width 1", "line 13 12 10 6 fill black width 1", "tri 2 6 10 4 18 6 fill brown"].join("\n"), mr.lines);
  ok("...said, and nothing sent back", mr.problems.length === 0 && mr.said.length === 3 &&
    mr.said[2] === "drew the road as it looks going away: wide at the bottom edge, a point on the horizon (its 3 lines were side by side, the same distance apart all the way; what is far looks smaller)", [mr.said, mr.problems]);
  var madeR = act.build(ROAD, ROAD_Q);
  ok("...the block is made in one go (no round trip), with what Lantern did in its summary and its plan; it passes the bench\u2019s road question",
    madeR.ok === true && madeR.plan.shapes.length === 10 && madeR.plan.said.length === 3 && /^10 shapes\. Lantern stood the 2 gray mountains/.test(madeR.summary) && grade("make-road-horizon", ROAD).pass === true &&
    grade("make-road-horizon", item("make-road-horizon").ideal).pass === true, [madeR.ok, madeR.summary, madeR.problems]);

  // --- right as written: untouched ---
  var touched = RIGHT.filter(function (c) { var m = S.mend(linesOf(c[2]), c[1]); return m.said.length || m.problems.length || m.lines.join("\n") !== linesOf(c[2]).join("\n"); });
  ok("twelve pictures that are right as written come through untouched (the guide\u2019s two examples, pines in tiers, a sailboat, snow caps, pyramids, a sun over the sea, a balloon over hills, a fence, a road seen from the side, a road that narrows already, a kite)",
    RIGHT.length === 12 && touched.length === 0, touched.map(function (c) { return [c[0], S.mend(linesOf(c[2]), c[1])]; }));
  var FX = fs.readdirSync(path.join(__dirname, "fixtures")).filter(function (f) { return /^bench_run_.*\.json$/.test(f); }), blocks = 0, moved = [];
  FX.forEach(function (f) {
    var d = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8"));
    (d.rows || []).forEach(function (r) {
      [r.reply, r.first].forEach(function (t) {
        if (!/^MAKE DRAWING/m.test(String(t || ""))) return;
        var b = act.find(String(t))[0];
        if (!b) return;
        blocks++;
        var m = S.mend(b.lines, r.q);
        if (m.said.some(function (x) { return !/^left out /.test(x); }) || (m.problems.length && !/shore|road/.test(r.q))) moved.push([f, r.id, m.said, m.problems]);
      });
    });
  });
  ok("the models\u2019 drawings in the bench fixtures (houses, a sun over the sea): nothing in them is moved (" + blocks + " blocks)", blocks >= 20 && moved.length === 0, moved);

  // --- each rule on its own ---
  function mend(q, lines) { return S.mend(lines, q); }
  var m1 = mend("Draw a road leading to the horizon across a green plain.", ["rect 0 0 20 12 fill sky", "rect 0 7 20 5 fill green", "rect 9 7 2 5 fill gray"]);
  ok("a road as a strip of one width (a narrow rect from the horizon to the bottom edge): one tri, three times as wide at the bottom, its point on the horizon", m1.lines[2] === "tri 7 12 13 12 10 7 fill gray" && m1.lines.length === 3 && /it was a strip of one width/.test(m1.said[0]), m1);
  var m2 = mend("Draw a road going into the distance.", ["rect 0 0 20 5 fill sky", "rect 0 5 20 7 fill green", "line 6 12 9.5 5 color black width 2", "line 14 12 10.5 5 color black width 2"]);
  ok("two edges that come together already, with only the ground between them: the road is filled (it was the colour of the ground), the edges stay", m2.lines.join("|") ===
    "rect 0 0 20 5 fill sky|rect 0 5 20 7 fill green|tri 6 12 14 12 9.5 5 fill gray|tri 14 12 10.5 5 9.5 5 fill gray|line 6 12 9.5 5 color black width 2|line 14 12 10.5 5 color black width 2" &&
    m2.said[0] === "filled the road between its two edges (gray): it was the colour of the ground", m2);
  var m3 = mend("Draw a river flowing away to the horizon between green banks.", ["rect 0 0 20 12 fill sky", "rect 0 6 20 6 fill green", "rect 8 6 4 6 fill blue", "circle 4 2 1.2 fill yellow"]);
  ok("a river as a strip: the same, in its own blue, and called a river", m3.lines[2] === "tri 5 12 15 12 10 6 fill blue" && /^drew the river as it looks going away/.test(m3.said[0]), m3);
  var m4 = mend("Draw a railway track disappearing into the distance.", ["rect 0 0 20 12 fill sky", "rect 0 5 20 7 fill green", "line 9 5 9 12 color black width 2", "line 11 5 11 12 color black width 2",
    "line 9 6 11 6 color brown width 2", "line 9 9 11 9 color brown width 2", "line 9 11.8 11 11.8 color brown width 2"]);
  ok("a railway: the two rails meet on the horizon, and each sleeper drawn across them is as wide as the track is at its distance (short far away, long near)",
    m4.lines.slice(2).join("|") === "tri 7 12 13 12 10 5 fill gray|line 7 12 10 5 color black width 2|line 13 12 10 5 color black width 2|line 9.57 6 10.43 6 color brown width 2|line 8.29 9 11.71 9 color brown width 2|line 7.09 11.8 12.91 11.8 color brown width 2", m4.lines);
  var m5 = mend("Draw a road disappearing into the distance through fields.", ["rect 0 0 20 12 fill sky", "rect 0 6 20 6 fill green", "rect 0 8 20 1 fill yellow", "circle 16 2 1 fill yellow"]);
  ok("a road asked for and none drawn: nothing is made up; it goes back with the line to add, for this picture\u2019s horizon", m5.said.length === 0 && m5.lines.length === 4 &&
    m5.problems[0] === "the question asks for a road going into the distance, but nothing in the picture narrows towards the horizon: add tri 7 12 13 12 10 6 fill gray after the ground (a road going away is wide at the bottom edge and comes to a point on the horizon, y 6)", m5);
  var m6 = mend("Draw the sun setting over the sea.", ["rect 0 0 20 12 fill orange", "rect 0 8 20 4 fill blue", "circle 10 8 2.5 fill yellow"]);
  ok("a setting sun drawn over the sea: it goes behind the water, so half of it shows", m6.lines.join("|") === "rect 0 0 20 12 fill orange|circle 10 8 2.5 fill yellow|rect 0 8 20 4 fill blue" && m6.said[0] === "put the sun behind the water: it was drawn in front", m6);
  var m7 = mend("Draw the moon over the mountains at night.", ["rect 0 0 20 12 fill dark blue", "tri 0 9 5 4 10 9 fill gray", "tri 7 9 13 3 20 9 fill gray", "rect 0 9 20 3 fill dark green", "circle 12 4 1.5 fill white"]);
  ok("the moon drawn last, over a mountain: behind it, and called the moon", m7.lines[1] === "circle 12 4 1.5 fill white" && m7.said[0] === "put the moon behind the mountain: it was drawn in front", m7);
  var m8 = mend("Draw mountains.", ["rect 0 0 20 12 fill sky", "rect 0 9 20 3 fill green", "tri 3 3 5 1 7 3 fill gray", "tri 9 4 14 2 19 4 fill gray"]);
  ok("a small peak high in the sky is set down whole (its sides carried down would make a needle); a wide one has its sides carried down", m8.lines.join("|") === "rect 0 0 20 12 fill sky|tri 3 9 5 7 7 9 fill gray|tri 9 9 14 2 19 9 fill gray|rect 0 9 20 3 fill green", m8.lines);
  var m9 = mend("Draw rolling hills under a blue sky.", ["rect 0 0 20 12 fill sky", "rect 0 9 20 3 fill green", "tri 0 7 5 4 10 7 fill green", "tri 8 8 14 5 20 8 fill dark green"]);
  ok("...hills are called hills", m9.said[0] === "stood the 2 hills on the horizon (y 9), behind what was already on the ground: their bases were in the sky", m9.said);
  var m10 = mend("Draw a tent by a lake with mountains behind.", ["rect 0 0 20 12 fill sky", "rect 0 7 20 5 fill green", "rect 0 7 20 2 fill blue", "tri 2 5 6 2 10 5 fill gray", "tri 9 5 14 1 19 5 fill gray", "tri 12 11 14 8 16 11 fill orange"]);
  ok("...and a tent on the ground is left where it is", m10.lines.join("|") === "rect 0 0 20 12 fill sky|tri 2 7 6 2 10 7 fill gray|tri 9 7 14 1 19 7 fill gray|rect 0 7 20 5 fill green|rect 0 7 20 2 fill blue|tri 12 11 14 8 16 11 fill orange", m10.lines);
  var m11 = mend("Draw a simple house with a red roof and a door.", ["rect 0 0 20 12 fill sky", "rect 0 10 20 2 fill green", "rect 9 5 2 5 fill brown", "tri 8 5 10 3 12 5 fill red", "rect 0 10 20 2 fill green", "rect 9 5 2 5 fill brown"]);
  ok("a background written a second time further down (the 2B\u2019s house on 1.24.4: the grass again, after the roof) is left out, and said; the roof on its wall is not a mountain",
    m11.lines.join("|") === "rect 0 0 20 12 fill sky|rect 0 10 20 2 fill green|rect 9 5 2 5 fill brown|tri 8 5 10 3 12 5 fill red|rect 9 5 2 5 fill brown" &&
    /^left out a background line that was written a second time \(\u201crect 0 10 20 2 fill green\u201d\)/.test(m11.said[0]) && m11.said.length === 1, m11);
  var loop = ["rect 0 0 20 12 fill sky", "rect 0 8 20 4 fill green"], k;
  for (k = 0; k < 14; k++) loop.push("rect " + (3 + k) + " 6 1 1 fill blue");
  var madeL = act.build(block("Loop", loop.concat(["tri 2 5 6 2 10 5 fill gray"])).replace(/\nEND$/, ""), "Draw mountains by a lake.");
  ok("a reply that ran away (one line counting up, cut off) is AI_DRAW\u2019s to cut down: the scene is not arranged", !!madeL && !!madeL.runaway && !/Lantern stood/.test(madeL.summary || ""), madeL && [madeL.summary, madeL.problems]);

  // --- the guide for a landscape ---
  var pl = DR.promptFor(SHORE_Q), ph = DR.promptFor("Draw a simple house with a red roof and a door."), phh = DR.promptFor("Draw a house on a hill at sunset.");
  ok("a landscape question is given three more lines of guide (the ground and its horizon, mountains on it, the sun straight after the sky, a road as a tri) and a landscape as its example",
    S.landscape(SHORE_Q) && S.landscape(ROAD_Q) && pl.join("\n").indexOf("A landscape: the ground is ONE wide rect that reaches the bottom edge; its top is the horizon.") > 0 &&
    pl.indexOf("MAKE DRAWING: Road to the mountains") > pl.indexOf("END") && pl.indexOf("tri 7 12 13 12 10 7 fill tan") > 0 && pl.indexOf("MAKE DRAWING: Hut by a tree") < 0 && pl.join("\n").length < 1800, pl.join("\n").length);
  ok("...a house keeps the hut (its roof is the example a small model needs), on a hill too; so does any other picture", !S.landscape("Draw a house on a hill at sunset.") && ph.indexOf("MAKE DRAWING: Hut by a tree") > 0 &&
    phh.indexOf("MAKE DRAWING: Hut by a tree") > 0 && ph.join("\n").indexOf("A landscape:") < 0 && DR.promptFor("Draw a yellow sun above a blue sea.").indexOf("MAKE DRAWING: Hut by a tree") > 0 &&
    !S.landscape("Draw the magnetic field of a bar magnet.") && !S.landscape("Draw a plain red square.") && S.landscape("Draw a river running through a valley."));
  var eg = pl.slice(pl.indexOf("For example:") + 1).join("\n"), madeE = act.build(eg, "Draw a road going to the mountains.");
  ok("the landscape example is a picture Lantern changes nothing in and questions nothing in", madeE.ok === true && madeE.plan.shapes.length === 8 && !madeE.plan.said && madeE.summary === "8 shapes", [madeE.summary, madeE.problems]);

  // --- rule 11 ---
  var o2 = load(["AI_SCENE"]);
  await sleep(40);
  var made2 = o2.L.aiAct.build(ROAD, ROAD_Q), g2 = grade("make-road-horizon", ROAD, o2.L.aiAct, o2.L.aiBench, o2.L.aiBenchQuestions), g2s = grade("make-shore-sunset", SHORE2, o2.L.aiAct, o2.L.aiBench, o2.L.aiBenchQuestions);
  ok("without AI_SCENE: the drawing is made as the model wrote it (9 shapes, nothing said), the guide is the hut for every question -- and the bench\u2019s two scene questions fail on what the eye sees: no road that narrows, a mountain in the air",
    o2.errs.length === 0 && !o2.L.aiScene && made2.ok === true && made2.summary === "9 shapes" && g2.pass === false && g2.why === "no road that narrows towards the horizon" &&
    g2s.pass === false && g2s.why === "a mountain floats above the horizon" && o2.L.aiActions.filter(function (a) { return a.id === "drawing"; })[0].prompt.indexOf("MAKE DRAWING: Hut by a tree") > 0, [made2.summary, g2, g2s, o2.errs]);
  var o3 = load(["AI_MAKE_LAYOUT"]), o4 = load(["AI_DRAW_CHECK"]), o5 = load(["AI_DRAW"]);
  await sleep(40);
  ok("without AI_MAKE_LAYOUT, or without AI_DRAW_CHECK: the scene is mended all the same; without AI_DRAW there is no drawing action and nothing breaks",
    o3.errs.length === 0 && o3.L.aiAct.build(ROAD, ROAD_Q).plan.said.length === 3 && o4.errs.length === 0 && o4.L.aiAct.build(ROAD, ROAD_Q).plan.said.length === 3 &&
    o5.errs.length === 0 && !!o5.L.aiScene && o5.L.aiScene.mend(linesOf(ROAD), ROAD_Q).said.length === 3, [o3.errs, o4.errs, o5.errs]);

  console.log(fails ? fails + " SCENE FAILURES (" + passes + " passed)" : "ALL SCENE TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
