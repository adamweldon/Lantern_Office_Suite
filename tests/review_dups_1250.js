// review_dups_1250.js -- the review of 1.24.10's rule for a line written three times or more, replayed.
// Adam's run of the 35B on 1.24.8 (tests/fixtures/bench_run_1248_35b_library.json): its road into the distance was
// "tri 0 6 20 6 10 0 fill gray" written 29 times, and nothing asked for the road -- AI_SCENE left a block with a line
// written three times to AI_DRAW, and AI_DRAW, since 1.24.8, does not ask about a shape under its own copy. 1.24.10
// leaves out the earlier copies where nothing lies across them in between, says so, and arranges the picture. An
// agent that had not seen it written drew 142 pictures of its own (tests/fixtures/review1_1250_dups.json: 128 right,
// 11 wrong, 3 neutral) and found: lines across a copy not seen (a clock's hands between two faces), a run of squares
// half off the grid left out whole once the sun between them went, a run-away report lost, two of three copies kept
// and one moved by the landscape's rules. Each was mended; this replays them.
// A second agent, that had seen neither, drew 211 more (tests/fixtures/review2_1250_dups.json: 39 right, 5 wrong,
// 167 neutral) and found: "with nothing between across it" said where a curve's drawn line swung onto the copy, or a
// line or outline reached it by its width; a railway whose sleepers are wider than its rails redrawn going away with
// its sleepers spoiled (the road rule, 1.24.9's too, now reached through copies); every drawing built twice. Mended;
// this replays them too.
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
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 2000)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// the colour seen at a point, from a list of shape lines ("rect 0 0 20 12 fill #7dd3fc"): the last filled shape there
function seen(shapes, x, y) {
  var c = "", i;
  for (i = 0; i < shapes.length; i++) {
    var t = String(shapes[i]).split(/\s+/), k = t[0], n = [], f = null, j;
    for (j = 1; j < t.length && /^-?[\d.]+$/.test(t[j]); j++) n.push(+t[j]);
    j = t.indexOf("fill"); if (j > 0) f = t[j + 1];
    if (!f) continue;
    var inside = k === "rect" ? x >= n[0] && x < n[0] + n[2] && y >= n[1] && y < n[1] + n[3] :
      k === "square" ? x >= n[0] && x < n[0] + n[2] && y >= n[1] && y < n[1] + n[2] :
      k === "circle" ? (x - n[0]) * (x - n[0]) + (y - n[1]) * (y - n[1]) <= n[2] * n[2] :
      (k === "oval" || k === "ellipse") ? Math.pow((x - n[0] - n[2] / 2) / (n[2] / 2), 2) + Math.pow((y - n[1] - n[3] / 2) / (n[3] / 2), 2) <= 1 :
      k === "tri" ? (function () { var d1 = (x - n[2]) * (n[1] - n[3]) - (n[0] - n[2]) * (y - n[3]), d2 = (x - n[4]) * (n[3] - n[5]) - (n[2] - n[4]) * (y - n[5]), d3 = (x - n[0]) * (n[5] - n[1]) - (n[4] - n[0]) * (y - n[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); })() : false;
    if (inside) c = f;
  }
  return c;
}
function picture(shapes) { var out = [], x, y; for (x = 0.05; x < 20; x += 0.1) for (y = 0.05; y < 12; y += 0.1) out.push(seen(shapes, x, y)); return out.join(","); }
(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var act = L.aiAct, F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1250_dups.json"), "utf8"));
  var R35 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1248_35b_library.json"), "utf8")).rows.filter(function (r) { return r.id === "make-road-horizon"; })[0];
  var b35 = act.build(R35.reply, R35.q);
  ok("boot clean; the 35B\u2019s road on 1.24.8 (the triangle 29 times) now gets the road asked for, with the line to write, and the copies left out said",
    o.errs.length === 0 && /no road that narrows/.test(R35.why) && b35.ok === false &&
    /^the question asks for a road going into the distance, and nothing is drawn on the ground: add tri 7 12 13 12 10 6 fill gray after the ground/.test(b35.problems[0]) &&
    b35.plan.said.some(function (t) { return /^left out 25 earlier copies of \u201ctri 0 6 20 6 10 0 fill gray\u201d/.test(t); }), [o.errs, b35.problems, b35.plan.said]);
  function shp(b) { return (b.plan && b.plan.shapes || []).map(function (s) { return s.kind + " " + s.nums.join(" ") + (s.fill ? " fill " + s.fill : ""); }); }
  var rows = F.map(function (d) { var b = act.build(d.text, d.q); return { d: d, b: b, said: (b.plan && b.plan.said) || [], shapes: shp(b) }; });
  ok("the review\u2019s 142 drawings (128 right, 11 wrong, 3 neutral), each built without an error", F.length === 142 && rows.every(function (r) { return r.b; }));
  // where Lantern says only that it left out copies, the picture is the one 1.24.9 drew, point for point
  var only = rows.filter(function (r) { return r.said.length && r.said.every(function (t) { return /earlier cop|background line/.test(t); }) && r.said.some(function (t) { return /earlier cop/.test(t); }); });
  var changed = only.filter(function (r) { return picture(r.shapes) !== picture(r.d.old.shapes); });
  ok("where only the copies are left out (" + only.length + " drawings), the picture is the same as 1.24.9\u2019s, every tenth of a cell", only.length >= 40 && changed.length === 0, changed.map(function (r) { return r.d.name; }));
  function asOld(name) { var r = rows.filter(function (x) { return x.d.name === name; })[0]; return r && JSON.stringify(r.b.problems) === JSON.stringify(r.d.old.problems) && !r.said.some(function (t) { return /earlier cop/.test(t); }); }
  var lines = ["clock-hands-hidden", "face-mouth-only-line-hidden", "window-cross-hidden", "house-level-line-hidden", "mount-horizon-line-between", "road-tri-copies-dash-lines", "fence-rail-x3-posts-between", "edge-vertical-line-copies-rect-between"];
  ok("a line across a copy in between (a clock\u2019s hands, a mouth, a window\u2019s cross, a stripe, fence posts across a rail) keeps the copies, and the block is asked about as on 1.24.9",
    lines.every(asOld), lines.filter(function (n) { return !asOld(n); }));
  ok("a block AI_DRAW reports as run away is reported so still (nine copies off the grid; two lines in turn; 31 copies; a block cut off)",
    ["run-9-off-grid-closed", "run-alternate-off-grid", "run-31-closed", "cut-road-block-x3"].every(function (n) { var r = rows.filter(function (x) { return x.d.name === n; })[0]; return asOld(n) && /^the reply ran away/.test(r.b.problems[0]); }));
  ok("a run of squares with a sun written between each keeps its sun copies, and its squares on the grid", asOld("stepping-row-off-edge-sun-between"));
  ok("two copies kept and one left out does not happen: all of a line\u2019s earlier copies go, or none (the mountain over a cloud, three times, is asked about as on 1.24.9)", asOld("two-floating-copies-kept"));
  // --- the second review
  var G = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review2_1250_dups.json"), "utf8"));
  function gname(n) { return G.filter(function (d) { return d.name.split(" ")[0] === n; })[0]; }
  var g = G.map(function (d) { var b = act.build(d.text, d.q); return { d: d, b: b, said: (b.plan && b.plan.said) || [], shapes: shp(b) }; });
  function grow(n) { return g.filter(function (r) { return r.d.name.split(" ")[0] === n; })[0]; }
  ok("the second review\u2019s 211 drawings (39 right, 5 wrong, 167 neutral), each built without an error", G.length === 211 && g.every(function (r) { return r.b; }) &&
    G.filter(function (d) { return d.verdict === "right"; }).length === 39 && G.filter(function (d) { return d.verdict === "wrong"; }).length === 5);
  ok("no copy is left out across which something reaches: a curve's drawn line (C13), a line 30 wide (C14), an outline 20 wide (N4)",
    ["C13", "C14", "N4"].every(function (n) { var r = grow(n); return r && !r.said.some(function (x) { return /earlier cop/.test(x); }); }), ["C13", "C14", "N4"].map(function (n) { return grow(n).said; }));
  ok("a railway whose sleepers are wider than its rails is left as drawn, written once or with copies (P8, P20, P21): no road redrawn under its sleepers",
    ["P8", "P20", "P21"].every(function (n) { var r = grow(n); return r && !r.said.some(function (x) { return /going away/.test(x); }) && r.shapes.filter(function (x) { return /^line 8 (7|8\.5|10|11\.5) 12 /.test(x); }).length === 4; }),
    ["P8", "P20", "P21"].map(function (n) { return [grow(n).said, grow(n).shapes]; }));
  var lostAway = g.filter(function (r) { return (r.d.old.problems || []).some(function (p) { return /ran away/.test(p); }) && !(r.b.problems || []).some(function (p) { return /ran away/.test(p); }); });
  ok("no run-away report of 1.24.9 is lost", lostAway.length === 0, lostAway.map(function (r) { return r.d.name; }));
  // (what the wip gave the review, kept: where nothing above touched it, the same said and asked, in the same words)
  var mendedNames = ["C8", "C9", "C13", "C14", "N4", "N5", "P8", "P20", "P21"];
  var moved = g.filter(function (r) { return mendedNames.indexOf(r.d.name.split(" ")[0]) < 0; }).filter(function (r) {
    var was = (r.d.now.said || []).map(function (x) { return x.replace("with nothing between across it", "with nothing drawn between across it"); });
    return JSON.stringify(r.said) !== JSON.stringify(was) || JSON.stringify(r.b.problems || []) !== JSON.stringify(r.d.now.problems || []);
  });
  ok("every other drawing is said and asked about as the review found it (" + (G.length - mendedNames.length) + ")", moved.length === 0, moved.map(function (r) { return r.d.name; }));
  // (leaving out copies is the same as the block written without them: built again with the earlier copies taken
  // out by hand, each drawing gives the same shapes and the same questions)
  var notSame = g.filter(function (r) { return r.said.some(function (x) { return /earlier cop/.test(x); }); }).filter(function (r) {
    var ls = r.d.text.split("\n"), cnt = {}, seenAt = {}, keep;
    ls.forEach(function (l, i) { var k = l.replace(/\s+/g, " ").trim(); cnt[k] = (cnt[k] || 0) + 1; seenAt[k] = i; });
    var names2 = (r.said.filter(function (x) { return /earlier cop/.test(x); })[0].match(/\u201c[^\u201d]+\u201d/g) || []).map(function (x) { return x.slice(1, -1); });
    if (/ and \d+ more:/.test(r.said.join())) return false;
    keep = ls.filter(function (l, i) { var k = l.replace(/\s+/g, " ").trim(); return names2.indexOf(k) < 0 || seenAt[k] === i; });
    var b2 = act.build(keep.join("\n"), r.d.q), s2 = (b2.plan && b2.plan.said) || [];
    return shp(b2).join() !== r.shapes.join() || JSON.stringify(b2.problems) !== JSON.stringify(r.b.problems) ||
      JSON.stringify(s2) !== JSON.stringify(r.said.filter(function (x) { return !/earlier cop/.test(x); }));
  });
  var withCopies = g.filter(function (r) { return r.said.some(function (x) { return /earlier cop/.test(x); }); }).length;
  ok("...and where copies are left out (" + withCopies + " drawings), the drawing is what the block gives written without them", withCopies >= 120 && notSame.length === 0, notSame.map(function (r) { return r.d.name; }));
  console.log(fails ? fails + " DUPS REVIEW FAILURES (" + passes + " passed)" : "ALL DUPS REVIEW CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
