// tests/review_1255.js -- the reviews of 1.24.15's picture rules, replayed (CLAUDE.md: a new rule is tried by
// someone who did not write it; what it wrote stays in tests/fixtures/).
//
// 1.24.15 mends three things in a picture of Adam's run of 1.24.14 (lantern-bench-202611121449.json): a door hung
// below its wall onto the ground, a tree drawn over the house, and no road at all where the question asks for one
// going away (tests/bench_1255.js). Each case is {name, q, text, want, verdict, got, on1254, finding}: the
// reviewer's own picture, what it wanted, whether the picture was right as the model drew it, and what 1.24.14 did.
//
// The first review (review1_1255_draw.json, 196 pictures) on the first draft found: the door rule lifted a child's
// body off her legs, a car off its wheels, a lamp post, a mailbox post, a porch post, a step, a gatepost, a tree
// trunk in front of the wall, and doors that rightly reach through a foundation to the ground (29 right pictures
// changed, 24 of them spoiled); the tree rule moved a bush and a potted plant from the door, trees with their
// apples, swing or birdhouse left behind, a tree on a hill into the air, one onto the road, and trees by a lake or a
// mountain taken for a house; the road was drawn the colour of grey ground, across the sea, as a "river" in gray
// for a river and a road, and as a plain gray tri for a railway.
//
// The second review (review2_1255_draw.json, 188 pictures, another agent) on the mended draft: 34 right pictures
// changed -- a girl's body, a trash can, a postbox, a phone box, a cactus, a gnome, a broom taken for the door where
// the wall had none (or one in outline, in lines, in its own colour); a door's round green window, a lamp post, a
// mailbox moved as a tree; a hammock, a washing line, a dog's lead left in the air; trees put on a driveway, a bench,
// a road; shapes sharing an edge not seen to touch; a road drawn under a path up a hill, a road over a hill and a
// river between mountains (an hourglass), and rising out of water at the front. Mended: the house rules act only on
// a house asked for in plain words; shapes that share an edge, and lines, touch; anything on the wall that may be a
// door stops the door rule; a crown must be much wider than its trunk; the road is asked for, as on 1.24.14, at any
// doubt. Each check below is what Lantern does now; a change shows here.
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
  for (var t = 0; t < 50 && !(L && L.aiAct && L.aiScene); t++) await sleep(100);
  ok("Lantern loads with no errors", L && L.aiAct && !o.errs.length, o.errs);
  function run(c) {
    var m = L.aiAct.fromReply(c.text, c.q);
    return { ok: !!(m && m.ok), problems: (m && m.problems) || [], said: (m && m.plan && m.plan.said) || [],
      shapes: ((m && m.plan && m.plan.shapes) || []).map(function (s) { return s.kind + " " + s.nums.join(" "); }) };
  }
  function same(a, b) { return JSON.stringify([a.problems, a.said]) === JSON.stringify([b.problems || [], b.said || []]); }

  // review(file, n, accept): every right picture is asked and told what 1.24.14 asked and told it, but those named in
  // accept, whose change its reviewer's want allows ("drawn as written, or the whole tree moved clear")
  function review(file, n, accept) {
    var D = fixture(file), now = {}, changed = [];
    ok(file + ": " + n + " pictures", D.length === n, D.length);
    D.forEach(function (c) {
      now[c.name] = run(c);
      if (c.verdict === "right" && !same(now[c.name], c.on1254) && accept.indexOf(c.name) < 0) changed.push(c.name);
    });
    ok(file + ": no right picture asked or changed in a way 1.24.14 did not" + (accept.length ? " (but " + accept.join(", ") + ": their want allows it)" : ""), !changed.length,
      changed.map(function (k) { return [k, now[k].problems, now[k].said]; }));
    accept.forEach(function (k) { ok(file + ": " + k + " is changed, as accepted", !same(now[k], D.filter(function (c) { return c.name === k; })[0].on1254), now[k]); });
    return { D: D, now: now };
  }
  function all(r, k) { return r.now[k].problems.concat(r.now[k].said).join(" | "); }

  // --- the first review ---
  var r1 = review("review1_1255_draw.json", 196, ["t-oak-in-front-small-crown"]);
  var doors = ["h-35b-hut-door-hangs", "h-door-hangs", "h-door-hangs-knob", "h-door-hangs-frame", "h-door-hangs-window-in-door", "h-door-too-tall", "h-door-hangs-house-floats",
    "h-cabin-door-hangs-wide-low", "t-tree-and-door-hangs-both"];
  ok("a door hung below its wall goes up onto it, and is said", doors.every(function (k) { return /^moved the door, /.test(r1.now[k].said.join("\n")); }), doors.filter(function (k) { return !/moved the door/.test(all(r1, k)); }));
  ok("...what lies on the door goes with it, and is said: its knob, its outline, its window",
    r1.now["h-door-hangs-knob"].shapes.indexOf("circle 10.6 7.6 0.15") >= 0 && /with it, \u201ccircle 10.6 8.6 0.15 fill yellow\u201d -- circle 10.6 7.6 0.15 fill yellow/.test(all(r1, "h-door-hangs-knob")) &&
    r1.now["h-door-hangs-frame"].shapes.filter(function (s) { return s === "rect 9 6 2 3"; }).length === 2 && r1.now["h-door-hangs-window-in-door"].shapes.indexOf("rect 9.5 6.4 1 0.8") >= 0,
    [r1.now["h-door-hangs-knob"].shapes, r1.now["h-door-hangs-frame"].shapes]);
  ok("...a door taller than the wall is shortened to four fifths of it, and that is said",
    /and shortened it to 3 high: it was 4, and the wall is 4 -- rect 9 6 2 3 fill brown/.test(all(r1, "h-door-too-tall")) && /shortened it to 1.5 high/.test(all(r1, "h-cabin-door-hangs-wide-low")));
  ok("...but not on a street: \u201cstreet\u201d is not a word of a house asked in plain words (the second review)", same(r1.now["h-three-houses-singular-q"], r1.D.filter(function (c) { return c.name === "h-three-houses-singular-q"; })[0].on1254));
  var tree = ["t-35b-house-hill-tree", "t-two-trees-front", "t-tree-front-door-q-trunk-in-wall"];
  ok("a tree drawn over the house goes to the side clear of it, whole, and is said: Adam's picture among them", tree.every(function (k) { return /moved the tree, /.test(all(r1, k)); }) &&
    (all(r1, "t-two-trees-front").match(/moved the tree/g) || []).length === 2, tree.map(function (k) { return all(r1, k); }));
  ok("...a tree a hair clear, touching, or with its crown just over the eave is the model's: left",
    ["t-tree-just-touching", "t-tree-gap-0.3", "t-tree-crown-over-roof-corner", "t-tree-towering-above", "t-tree-gap-0.6-from-eave"].every(function (k) { return !r1.now[k].said.length; }));
  ok("...nor moved onto the sun (the tall tree's oval crown; the trees whose way to the right is the sun's)",
    ["t-tree-oval-crown", "t-tree-hex-colours", "t-tree-dark-brown"].every(function (k) { return !/moved the tree/.test(all(r1, k)); }) && !/moved the tree/.test(all(r1, "t-tree-over-sun")));
  ok("...nor onto the road", !/moved the tree/.test(all(r1, "t-house-road-tree")));
  var tan = ["r-bare-grey-ground", "r-bare-light-gray-ground", "r-bare-hex-gray-ground", "r-bare-gray-ground", "r-bare-night-black"];
  ok("the road drawn on gray, grey, light gray, #808080 or dark gray ground is tan, so it shows", tan.every(function (k) { return /drew the road the question asks for, tri 7 12 13 12 10 8 fill tan/.test(all(r1, k)); }),
    tan.map(function (k) { return all(r1, k); }));
  ok("...a river on light blue ground is blue; on blue ground, water down to the bottom edge, it is asked for in light blue, as on 1.24.14 (no land to draw it on)",
    /10 8 fill blue, after the ground/.test(all(r1, "r-bare-light-blue-ground-river")) && !/drew the/.test(all(r1, "r-bare-blue-ground-river")) && /add tri 7 12 13 12 10 8 fill light blue after the ground/.test(all(r1, "r-bare-blue-ground-river")));
  ok("...with the sea or a lake behind the land, the road and the river come to their point at the shore, y 8, not across the water",
    /tri 7 12 13 12 10 8 fill gray, after the ground: .* where the land meets the water, y 8/.test(all(r1, "r-bare-sea-behind")) && /tri 7 12 13 12 10 8 fill blue, after the ground: .* where the land meets the water, y 8/.test(all(r1, "r-bare-lake-behind-river")));
  ok("...a railway, and a river and a road in one question, are not drawn as one gray tri: asked for, as on 1.24.14",
    ["r-bare-railway", "r-bare-river-and-road", "r-bare-road-and-river"].every(function (k) { return !/drew the/.test(all(r1, k)) && /the question asks for a \w+ going into the distance, and nothing is drawn on the ground: add/.test(all(r1, k)); }),
    ["r-bare-railway", "r-bare-river-and-road"].map(function (k) { return all(r1, k); }));
  var left = ["r-river-drawn-road-missing", "r-tree-no-road", "r-house-question", "r-road-mts-in-distance-not-away", "r-pond-on-ground", "r-two-sky-bands", "r-bare-sun-on-ground", "r-canal-not-plain", "r-footpath-not-plain"];
  ok("...nothing drawn where something is on the ground, the road is not said to go away, or the horizon is not sure", left.every(function (k) { return r1.now[k] && !/drew the/.test(all(r1, k)) && same(r1.now[k], r1.D.filter(function (c) { return c.name === k; })[0].on1254); }),
    left.filter(function (k) { return !r1.now[k] || /drew the/.test(all(r1, k)); }));

  // --- the second review (on the draft mended after the first) ---
  var r2 = review("review2_1255_draw.json", 188, []);
  var part = r2.D.filter(function (c) { return c.verdict !== "wrong" && !same(r2.now[c.name], c.on1254); }).map(function (c) { return c.name; });
  ok("review2: nor any picture it called partly right", !part.length, part);
  var mended = r2.D.filter(function (c) { return c.verdict === "wrong" && !same(r2.now[c.name], c.on1254); }).map(function (c) { return c.name; }).sort();
  ok("review2: the 24 wrong pictures mended, and only those",
    mended.join() === ["d-hut-0p8b-shape-door", "dw-door-hangs-door-q-wide", "dw-door-hangs-tangent-knob", "dw-door-hangs-wide-hut-no-q", "dw-house-floats-door-hangs", "dw-hut-example-wider",
      "r-desert-road", "r-far-band-hills", "r-night-road-black", "r-path-snow-bare", "r-river-lake-oval-at-horizon", "r-road-in-sky-35b-shape", "r-road-teal-ground-river", "r-sea-behind-river",
      "r-snow-road", "r-trees-at-horizon", "tw-35b-sunset-window", "tw-barn-tree", "tw-beside-left", "tw-crown-first-trunk-after", "tw-dark-brown-trunk-oval", "tw-hex-trunk", "tw-next-to-overlap",
      "tw-tree-trunk-foot-on-horizon"].join(), mended);
  ok("review2: a girl, a trash can, a postbox, a phone box, a cactus, a gnome, a broom are not moved as the door; a door's round green window, a lamp post, a mailbox are not moved as a tree",
    ["d-girl-no-door", "d-trash-can", "d-pillar-box", "d-phone-box", "d-cactus", "d-gnome", "d-ladder-one-rail-shadow", "t-door-green-fanlight", "t-green-lamp", "t-green-mailbox"].every(function (k) { return !/moved the (door|tree)/.test(all(r2, k)); }));
  ok("review2: no tree leaves its hammock, washing line, bird or dog behind, nor lands on a driveway, a bench or a road",
    ["t-hammock", "t-clothesline", "t-bird-lines-in-tree", "t-dog-tied", "t-driveway-thick-line", "t-bench-lines-right", "t-road-lines-right"].every(function (k) { return !/moved the tree/.test(all(r2, k)); }));
  ok("review2: no road under a path up a hill, a road over it, a river between mountains, nor out of water at the front, nor one for two roads or for tracks: asked as on 1.24.14",
    ["r-path-up-hill", "r-road-over-hill-tri-on-hill", "r-river-valley-above-horizon", "r-road-to-horizon-water-front", "r-two-roads", "r-tracks", "r-bare-highway-dashes-band"].every(function (k) { return !/drew the/.test(all(r2, k)); }));
  ok("review2: a house above the grass: its door's foot is not said to be on the ground", /below the wall's \(y 6\) -- /.test(all(r2, "dw-house-floats-door-hangs")));
  ok("review2: a tree with its foot on the horizon, as the guide's example stands one, is moved; a barn is called a barn",
    /moved the tree, /.test(all(r2, "tw-tree-trunk-foot-on-horizon")) && /clear of the barn: it stood against the barn/.test(all(r2, "tw-barn-tree")));
  ok("review2: a river to the sea comes to its point at the shore, y 8.5", /where the land meets the water, y 8.5/.test(all(r2, "r-sea-behind-river")));

  console.log(fails ? fails + " REVIEW 1.24.15 FAILURES (" + passes + " passed)" : "ALL REVIEW 1.24.15 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
