// bench_1255.js -- the runs of 1.24.14, replayed (1.24.15).
// Adam's run of the 35B on 1.24.14 with the library (2026-11-12, tests/fixtures/bench_run_1254_35b_library.json): 137
// of 140 (135 on 1.24.13). The two coins and the shore pass now. Three rows fail: the iPhone and Nairobi, as before,
// and the road to the horizon: the 35B drew its gray tri on the horizon again and no road, as on 1.24.8, 1.24.9 and
// 1.24.13, and wrote its own lines again when 1.24.14 named the tri with the line to write in its place. And Adam,
// looking at the pictures: "The door to the house overlaps the ground. The tree is not seperated from the house other
// than the color. There is no road in the mountain picture where the road should be."
//  - the road: when a road going away is asked for and nothing is on the ground, Lantern draws it, after the ground,
//    and says so; the 35B's tri stays as it drew it (a mountain, to a person);
//  - the door: "rect 8 7 4 2 fill dark green" on the wall "rect 4 6 12 2 fill tan" -- the door of the guide's hut,
//    2 high at y 7, on a wall 2 high -- hung a cell below the wall's foot onto the grass: it goes up onto the wall;
//  - the tree: the guide's tree, "rect 10 5 2 4 fill brown" and "circle 11 4 2 fill dark green", drawn against the
//    wall of a hut made wider and over its roof: it goes to the side, clear of the house.
// The small models' run of 1.24.14 (42881151985, all on an AMD EPYC 7763, tests/fixtures/bench_run_1254_{4b,2b,08b}.json):
// the 4B 108 of 114 (its road, moved from under the ground, passes), the 2B 74, the 0.8B 54.
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
  var B = L.aiBench, Q = L.aiBenchQuestions, act = L.aiAct;
  var F = fixture("bench_run_1254_35b_library.json"), G = fixture("bench_run_1253_35b_library.json");
  function item(id) { return Q.filter(function (q) { return q.id === id; })[0]; }
  function row(X, id) { return (X.rows || []).concat(X.seen || []).filter(function (r) { return r.id === id; })[0]; }
  function ids(X) { return X.rows.map(function (r) { return r.id; }).sort(); }
  function made(id, text, q) { var it = item(id), m = act.fromReply(text, q || it.q); return { m: m, said: (m && m.plan && m.plan.said) || [], g: m ? B.grade(it, text, { made: m }) : null }; }
  function shapes(m) { return m.plan.shapes.map(function (s) { return s.kind + " " + s.nums.join(" "); }); }
  ok("boot clean; Adam's run of 1.24.14: 137 of 140, six rows that did not pass (three of them puzzles without the tools, not scored), and the two houses he pointed at",
    o.errs.length === 0 && F.lantern === "1.24.14" && F.summary.pass === 137 && F.summary.n === 140 && F.rows.length === 6 && F.seen.length === 2, [o.errs, F.summary.pass]);
  ok("against 1.24.13: the two coins and the shore pass now; nothing fails that passed",
    ids(G).filter(function (i) { return ids(F).indexOf(i) < 0; }).join() === "cups-two-coins,make-shore-sunset" && ids(F).filter(function (i) { return ids(G).indexOf(i) < 0; }).length === 0, [ids(F), ids(G)]);

  // --- the road ---
  var rd = row(F, "make-road-horizon");
  ok("the road: the 35B's gray tri on the horizon again, and no road; Lantern named the tri, and its retry wrote the same lines",
    /^Lantern still questions it: the question asks for a road going into the distance, and nothing is drawn on the ground: if \u201ctri 0 6 20 6 10 0 fill gray\u201d is the road/.test(rd.why) &&
    (rd.reply.match(/tri 0 6 20 6 10 0 fill gray/g) || []).length === 26);
  var r1 = made("make-road-horizon", rd.reply);
  ok("1.24.15: Lantern draws the road after the ground and says so; the 35B's tri stays as it drew it; the bench passes it",
    r1.m.ok && r1.g.pass && r1.said.some(function (x) { return x === "drew the road the question asks for, tri 7 12 13 12 10 6 fill gray, after the ground: nothing was drawn on the ground (a road going away is wide at the bottom edge and comes to a point on the horizon, y 6)"; }) &&
    shapes(r1.m).join("|") === "rect 0 0 20 12|circle 18 2 1.5|rect 0 6 20 6|tri 7 12 13 12 10 6|tri 0 6 20 6 10 0", shapes(r1.m));
  var r2 = act.fromReply("MAKE DRAWING: x\nrect 0 0 20 12 fill sky\nrect 0 7 20 5 fill gray\nEND", "Draw a road disappearing into the distance.");
  var r3 = act.fromReply("MAKE DRAWING: x\nrect 0 0 20 12 fill sky\nrect 0 7 20 5 fill green\nEND", "Draw a river flowing off into the distance.");
  ok("...on gray ground the road is tan, a river is blue, each on the picture's own horizon",
    r2.ok && (r2.plan.said || []).join().indexOf("tri 7 12 13 12 10 7 fill tan") >= 0 && r3.ok && (r3.plan.said || []).join().indexOf("drew the river the question asks for, tri 7 12 13 12 10 7 fill blue") >= 0, [r2.plan.said, r3.plan.said]);
  var r4 = act.fromReply("MAKE DRAWING: x\nrect 0 0 20 12 fill sky\nrect 0 6 20 6 fill green\nline 6 12 9.5 6 color black width 2\nline 14 12 10.5 6 color black width 2\nEND", "Draw a road going into the distance.");
  var r5 = act.fromReply("MAKE DRAWING: x\nrect 0 0 20 12 fill sky\nrect 0 6 20 6 fill green\nEND", "Draw a river with mountains in the distance.");
  ok("...a road of the model's own (two edges that come together) is left as drawn; a question that does not say the road itself goes away gets none",
    r4.ok && !(r4.plan.said || []).length && r5.ok && !(r5.plan.said || []).some(function (x) { return /drew the/.test(x); }), [r4.plan.said, r5.plan.said]);

  // --- the door ---
  var hs = row(F, "make-house"), h1 = made("make-house", hs.reply);
  ok("the door: \u201crect 8 7 4 2\u201d on the wall \u201crect 4 6 12 2\u201d hung below its foot (y 9, the wall's at 8): it goes up onto the wall, shortened to fit, and is said",
    h1.m.ok && h1.g.pass && h1.said.join() === "moved the door, \u201crect 8 7 4 2 fill dark green\u201d, up onto its wall: its foot was at y 9, below the wall's (y 8), on the ground, and shortened it to 1.5 high: it was 2, and the wall is 2 -- rect 8 6.5 4 1.5 fill dark green" &&
    shapes(h1.m).indexOf("rect 8 6.5 4 1.5") >= 0, [h1.m.problems, h1.said]);
  var HQ = "Draw a simple house with a red roof and a door.", Wall = ["rect 0 0 20 12 fill sky", "rect 0 9 20 3 fill green", "rect 5 5 10 4 fill tan", "tri 4 5 10 1 16 5 fill red"];
  function said(lines, q) { var m = act.fromReply("MAKE DRAWING: x\n" + lines.join("\n") + "\nEND", q || HQ); return (m.plan && m.plan.said) || []; }
  ok("...a door on its wall's foot, a window in the wall, steps or a path below the door: left as drawn",
    !said(Wall.concat(["rect 9 6 2 3 fill brown"])).length && !said(Wall.concat(["rect 6 6 2 1.5 fill white", "rect 9 6 2 3 fill brown"])).length &&
    !said(Wall.concat(["rect 9 6 2 3 fill brown", "rect 8.5 9 3 0.5 fill gray"])).length && !said(Wall.concat(["rect 9 6 2 3 fill brown", "rect 9.5 9 1 3 fill tan"])).length);

  // --- the tree ---
  var ss = row(F, "make-sunset-house"), t1 = made("make-sunset-house", ss.reply);
  ok("the tree: the trunk against the wall and the crown over the roof: the tree goes 2.5 to the right, clear of the house, and is said",
    t1.m.ok && t1.g.pass && t1.said.join() === "moved the tree, \u201crect 10 5 2 4 fill brown\u201d and \u201ccircle 11 4 2 fill dark green\u201d, 2.5 to the right, clear of the house: it stood against the house, in front of it" &&
    shapes(t1.m).indexOf("rect 12.5 5 2 4") >= 0 && shapes(t1.m).indexOf("circle 13.5 4 2") >= 0, [t1.m.problems, t1.said]);
  var hut = act.fromReply(L.aiActions.filter(function (a) { return a.id === "drawing"; })[0].prompt.join("\n").split("For example:\n")[1], "Draw a hut by a tree.");
  ok("...the guide's own hut by a tree is left as it is", hut && hut.ok && !(hut.plan.said || []).length, hut && [hut.problems, hut.plan && hut.plan.said]);
  ok("...a tree behind the house (drawn first), or one the question puts in front of it, is left as drawn",
    !said(Wall.concat(["rect 13 5 1 4 fill brown", "circle 13.5 4 2 fill dark green"]), "Draw a house with a tree in front of it.").length &&
    !said(["rect 0 0 20 12 fill sky", "rect 0 9 20 3 fill green", "rect 13 3 1 6 fill brown", "circle 13.5 3 2 fill dark green", "rect 5 5 10 4 fill tan", "tri 4 5 10 1 16 5 fill red"], "Draw a house with a tree.").length);

  // --- the small models' run of 1.24.14 ---
  var S4 = fixture("bench_run_1254_4b.json"), S2 = fixture("bench_run_1254_2b.json"), S0 = fixture("bench_run_1254_08b.json");
  ok("the small models on 1.24.14, all on an AMD EPYC 7763: the 4B 108 of 114, the 2B 74, the 0.8B 54",
    S4.summary.pass === 108 && S2.summary.pass === 74 && S0.summary.pass === 54 && [S4, S2, S0].every(function (X) { return X.lantern === "1.24.14" && /EPYC 7763/.test(X.processor); }));
  var P4 = fixture("bench_run_1253_4b.json");
  ok("the 4B: its road passes (moved from under the ground), nothing new fails", ids(P4).filter(function (i) { return ids(S4).indexOf(i) < 0; }).join() === "make-road-horizon" && ids(S4).filter(function (i) { return ids(P4).indexOf(i) < 0; }).length === 0, [ids(S4), ids(P4)]);

  console.log(fails ? fails + " BENCH 1.24.15 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.15 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
