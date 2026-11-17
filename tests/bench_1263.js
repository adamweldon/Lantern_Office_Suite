// bench_1263.js -- Adam's set B run on 1.24.22 (the 35B, his laptop, library on, 2026-11-17 16:12 UTC, 96 minutes):
// 139 of 140 (136 on 1.24.20, 130 on 1.24.18). The one row that failed was 1.24.22's doing.
// "How many hours does a Hohmann transfer take from a 200 km orbit to the Moon's distance, 384400 km from Earth's
// centre?" The 35B wrote =HOHMANNT(CONVERT(200,"km","m"),CONVERT(384400,"km","m"))/3600 first, as on all four runs
// before; told "radii are from Earth's centre, so add 6371 km to an altitude", it had written CONVERT(6571,...) each
// time. 1.24.22 put the one-value functions' wording in the two-radius functions' refusal too ("given one value it
// works out Earth's ... for another planet or moon, give that body's GM as the second value"); HOHMANNT's second
// value is a radius, and the 35B wrote the same again. 1.24.23 gives HOHMANN, HOHMANNT and the rest their own words
// back. The run is tests/fixtures/bench_run_1262_35b_setb.json; this replays it.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1262_35b_setb.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window; w.HTMLCanvasElement.prototype.getContext = function () { return null; }; w.fetch = function () { return Promise.reject(new Error("no network")); };
w.HTMLElement.prototype.scrollIntoView = function () {}; w.scrollTo = function () {};
w.eval(JS);
var L = w.Lantern, A = L.assist;
function row(id) { return F.rows.filter(function (r) { return r.id === id; })[0]; }
setTimeout(async function () {
  ok("boot clean", !errs.length, errs);
  ok("the run is 1.24.22's set B, 139 of 140", F.lantern === "1.24.22" && F.set === "b" && F.summary.n === 140 && F.summary.pass === 139, [F.lantern, F.summary.pass]);
  var h = row("hohmann-moon-b");
  ok("the one failed row is the Hohmann to the Moon's distance, its reply the same twice", h && !h.pass && h.reply === h.first, h && h.reply);
  // what goes back now: the two-radius functions' own words, as on every run before 1.24.22
  var asked = [], fix = "=HOHMANNT(CONVERT(6571,\"km\",\"m\"),CONVERT(384400,\"km\",\"m\"))/3600\nANSWER: The Hohmann transfer takes {result} hours.";
  var r = await A.solve(h.q, { call: function (msgs) { asked.push(msgs[msgs.length - 1].content); return Promise.resolve(asked.length === 1 ? h.first : fix); } });
  ok("the refusal says radii are from Earth's centre: add 6371 km to an altitude", /radius 200 km is inside the Earth: radii are from Earth.s centre, so add 6371 km to an altitude\)/.test(asked[1] || ""), asked[1]);
  ok("...and says nothing of a second value or a GM", !/second value|GM/.test(asked[1] || ""), asked[1]);
  ok("...and the 35B's line of the runs before, written, gives the answer", r.run && Math.abs(r.run.value - h.expected) < 1e-6, r.run && r.run.value);
  // the one-value functions keep 1.24.22's words (the 9B's Mars and Moon rows)
  var e1 = A.run("=ESCV(PLANET(\"Mars\",\"radius\"))");
  ok("ESCV given one value still says what is true of it", /given one value it works out Earth.s, from Earth.s centre.*for another planet or moon, give that body.s GM as the second value/.test(JSON.stringify(e1)), e1);
  var e2 = A.run("=HOHMANN(CONVERT(200,\"km\",\"m\"),CONVERT(35786,\"km\",\"m\"))"), e3 = A.run("=VISVIVA(CONVERT(300,\"km\",\"m\"),CONVERT(500,\"km\",\"m\"))");
  [e2, e3].forEach(function (e, i) { ok((i ? "VISVIVA" : "HOHMANN") + ": the two-radius words", !/GM/.test(JSON.stringify(e)) && /add 6371 km to an altitude/.test(JSON.stringify(e)), e); });
  // the 139 rows that passed: the replies they ended on still run to their answers and are not questioned
  var bad = [];
  // (a place's figures come from site/places.txt, which this page without a server does not fetch: those rows are left out)
  F.rows.filter(function (x) { return x.pass && x.expected != null && /^=/.test(x.reply || "") && !/\b(BEARING|DISTANCE|PLACE)\w*\s*\x28\s*\x22/i.test(x.reply); }).forEach(function (x) {
    var p = A.parseReply(x.reply), rr = A.run(p.exprText);
    if (!(rr && typeof rr.value === "number" && Math.abs(rr.value - x.expected) <= 1e-9 * Math.max(1, Math.abs(x.expected)))) bad.push([x.id, rr && rr.value, x.expected]);
    var o = L.aiChecks.otherBodyCall(p.exprText, x.q);
    if (o && o.line) bad.push([x.id, "other body", o.line]);
  });
  ok("the rows that passed with a sum: each still runs to its answer, none given the orbit line", !bad.length, bad);
  console.log(fails ? fails + " BENCH 1.24.23 FAILURES (" + passes + " passed)" : "ALL BENCH 1.24.23 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
}, 300);
