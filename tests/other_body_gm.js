// other_body_gm.js -- an orbit function given another body's radius and no GM (1.24.22). Adam's quick run of set A
// with the 9B on his laptop (bench_run_1261_9b_seta_quick.json): "What is the escape velocity from Mars?" came back as
// =ESCV(PLANET("Mars","radius")). ESCV, ORBITV and ORBITT given one value use Earth's GM; Lantern refused the radius as
// "inside the Earth ... add 6371 km to an altitude", the wrong mend for Mars, and the 9B wrote the same again. Now the
// line with the body's GM goes back with it (tried first), and a radius big enough to run (Jupiter's) is questioned.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8"), js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1261_9b_seta_quick.json"), "utf8"));
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window; w.HTMLCanvasElement.prototype.getContext = function () { return null; }; w.fetch = function () { return Promise.reject(new Error("no network")); };
w.HTMLElement.prototype.scrollIntoView = function () {}; w.scrollTo = function () {};
w.eval(js);
setTimeout(async function () {
  var L = w.Lantern, A = L.assist, C = L.aiChecks;
  ok("boot clean", errs.length === 0, errs);
  var row = F.rows.filter(function (r) { return r.id === "mars-escape"; })[0];
  ok("as run: the 9B wrote =ESCV(PLANET(\"Mars\",\"radius\")) twice, and Lantern's refusal told it to add 6371 km", row && /^=ESCV\(PLANET\("Mars","radius"\)\)/.test(row.reply) && row.reply === row.first && /add 6371 km to an altitude/.test(row.rejected), row && row.rejected);
  var asked = [];
  var call = function (msgs) { asked.push(msgs[msgs.length - 1].content); return Promise.resolve(asked.length === 1 ? row.first : "=ESCV(PLANET(\"Mars\",\"radius\"),PLANET(\"Mars\",\"gm\"))\nANSWER: The escape velocity from Mars is {result} m/s."); };
  var r = await A.solve(row.q, { call: call });
  ok("now the line with Mars's GM goes back with the refusal", /ESCV given one value works out Earth.s .*PLANET\("Mars","radius"\) is Mars.s radius, not a height above Earth: give it Mars.s GM as its second value\. Write =ESCV\(PLANET\("Mars","radius"\),PLANET\("Mars","gm"\)\)/.test(asked[1] || ""), asked[1]);
  ok("...and that line, written, gives Mars's escape velocity (PLANET(\"Mars\",\"escape\"))", r.run && Math.abs(r.run.value - row.expected) < 1e-6, r.run && r.run.value);
  // which lines are given, and which are left (the review's cases, tests/fixtures/review1_1262.json, are replayed below)
  var Q = { marsT: "How long, in minutes, does a satellite 400 km above Mars take to go round once?", moonV: "How fast does a probe orbit 100 km above the Moon?",
    jup: "What is the escape velocity from Jupiter's cloud tops?", moonE: "What is the escape velocity from the Moon, in m/s?", marsE: "What is the escape velocity from Mars, in m/s?",
    iss: "How long does the space station take to orbit Earth at 420 km altitude, in minutes?", moonP: "How many days does the Moon take to orbit Earth?" };
  var cases = [
    [Q.marsT, "=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"))/60", "ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"),PLANET(\"Mars\",\"gm\"))/60"],
    [Q.marsT, "=ORBITT(PLANET(\"Mars\",\"radius\")+400*1000)/60", "ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"),PLANET(\"Mars\",\"gm\"))/60"],
    [Q.moonV, "=ORBITV(PLANET(\"the Moon\",\"radius\")+100000)", "ORBITV(PLANET(\"the Moon\",\"radius\")+CONVERT(100,\"km\",\"m\"),PLANET(\"the Moon\",\"gm\"))"],
    [Q.jup, "=ESCV(PLANET(\"Jupiter\",\"eqradius\"))", "ESCV(PLANET(\"Jupiter\",\"eqradius\"),PLANET(\"Jupiter\",\"gm\"))"],
    [Q.marsE, "=ESCV(PLANET(\"Mars\",\"radius\"),PLANET(\"Mars\",\"gm\"))", null],
    [Q.moonE, "=ESCV(PLANET(\"Earth\",\"radius\"))", null],
    [Q.moonP, "=ORBITT(PLANET(\"Moon\",\"distance\"))/86400", null],
    [Q.marsE, "=ESCV(6371000)", null],
    [Q.iss, "=ORBITT(PLANET(\"Earth\",\"radius\")+CONVERT(420,\"km\",\"m\"))/60", null],
    [Q.marsE, "=PLANET(\"Mars\",\"radius\")\n=ESCV(ANS)", null],
    // (set B, the Moon: told to add 6371 km, the 9B added it -- the line leaves it out, however it was written)
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+6371000)", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+CONVERT(6371,\"km\",\"m\"))", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+6371*1000)", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+PLANET(\"Earth\",\"radius\"))", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    // (the review) a number from nowhere, a height in the wrong unit, a body the question does not name, Earth named: no line
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+250000)", "no line"],
    ["What is the orbital speed 200 km above the Moon?", "=ORBITV(PLANET(\"Moon\",\"radius\")+200)", "no line"],
    ["What is the orbital speed 100 miles above the Moon?", "=ORBITV(PLANET(\"Moon\",\"radius\")+100000)", "no line"],
    ["What is the escape velocity from Venus?", "=ESCV(PLANET(\"Mars\",\"radius\"))", null],
    ["What would Earth's escape velocity be if it were squeezed to the Moon's size?", "=ESCV(PLANET(\"Moon\",\"radius\"))", null],
    ["How long would an orbit take at a height above Earth equal to Mars's radius, in minutes?", "=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(6371,\"km\",\"m\"))/60", null],
    ["A satellite orbits 6371 km above Mars. What is its period in hours?", "=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(6371,\"km\",\"m\"))/3600", "ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(6371,\"km\",\"m\"),PLANET(\"Mars\",\"gm\"))/3600"],
    [Q.jup, "=ESCV(PLANET(\"Jupiter\",\"radius\"))*SQRT(PLANET(\"Jupiter\",\"gm\")/PLANET(\"Earth\",\"gm\"))", null],
    ["How much faster is the escape velocity from Jupiter than from Saturn?", "=ESCV(PLANET(\"Jupiter\",\"radius\"))-ESCV(PLANET(\"Saturn\",\"radius\"))", null]];
  cases.forEach(function (c) {
    var o = C.otherBodyCall(c[1], c[0]), got = o ? (o.line || "no line") : null;
    ok("line for " + c[1].replace(/\n/g, " / ") + " (" + c[0] + "): " + (c[2] || "none"), got === c[2], o);
    if (o && o.line) { var v = A.run("=" + o.line).value; ok("...and it runs", typeof v === "number" && isFinite(v), v); }
  });
  // every line given is right when written in: worked out here from the body's own figures
  var P = L.planetData, chk = [
    [Q.marsT, "=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"))/60", 2 * Math.PI * Math.sqrt(Math.pow(P.mars[2] + 400000, 3) / P.mars[1]) / 60],
    [Q.moonV, "=ORBITV(PLANET(\"the Moon\",\"radius\")+100000)", Math.sqrt(P.moon[1] / (P.moon[2] + 100000))],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+6371*1000)", Math.sqrt(2 * P.moon[1] / P.moon[2])],
    ["A satellite orbits 6371 km above Mars. What is its period in hours?", "=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(6371,\"km\",\"m\"))/3600", 2 * Math.PI * Math.sqrt(Math.pow(P.mars[2] + 6371000, 3) / P.mars[1]) / 3600],
    ["Orbital speed 100 miles above the Moon?", "=ORBITV(PLANET(\"Moon\",\"radius\")+CONVERT(100,\"mi\",\"m\"))", Math.sqrt(P.moon[1] / (P.moon[2] + 160934.4))]];
  chk.forEach(function (c) { var o = C.otherBodyCall(c[1], c[0]), v = o && o.line ? A.run("=" + o.line).value : null; ok("written in, " + c[1] + " gives " + c[2].toFixed(3), v != null && Math.abs(v - c[2]) <= 1e-6 * c[2], [o && o.line, v]); });
  // no line: what is said instead names the GM and no number
  var hint = C.otherBodyCall("=ORBITV(PLANET(\"Moon\",\"radius\")+200)", "What is the orbital speed 200 km above the Moon?");
  ok("a height in the wrong unit: no line, but the Moon's GM named", hint && !hint.line && /give it the Moon.s GM as its second value, PLANET\("Moon","gm"\), with the distance from the Moon.s centre in metres as the first \(the Moon.s radius plus the height above it\)/.test(L.aiChecks.otherBodySay ? L.aiChecks.otherBodySay(hint) : ""), hint);
  // the review's cases: no right one questioned, no line wrong
  var RV = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review1_1262.json"), "utf8"));
  var rq = 0, rw = 0, rn = 0, rm = 0, badR = [];
  (RV.rule1 || []).forEach(function (c) {
    var o = C.otherBodyCall(c.expr, c.question), e = String(c.expected || "");
    rn++;
    var mv = /line giving\s+(-?[\d.e+]+)/i.exec(e);
    if (/^no line/i.test(e) && !mv) { if (o && o.line) { rq++; badR.push(["questioned", c.question, c.expr, o.line]); } return; }
    if (mv && !(o && o.line)) rm++;
    if (o && o.line && mv) {
      var v = A.run("=" + o.line).value, want = parseFloat(mv[1]);
      if (!(typeof v === "number" && Math.abs(v - want) <= Math.max(1e-3, 2e-3 * Math.abs(want)))) { rw++; badR.push(["wrong", c.question, c.expr, o.line, v, want]); }
    }
  });
  ok("the review's " + rn + " cases: no right formula given a line, no line wrong when written in (" + rm + " left with no line where one could be given)", rn > 100 && !rq && !rw, badR.slice(0, 12));
  console.log("review cases: " + rn + "; lines that could have been given and were not: " + rm);
  var run = A.run("=ESCV(PLANET(\"Jupiter\",\"radius\"))");
  var said = (L.assistChecks || []).map(function (f) { try { return f("What is the escape velocity from Jupiter?", "=ESCV(PLANET(\"Jupiter\",\"radius\"))", run, {}); } catch (e) { return null; } }).filter(Boolean);
  ok("Jupiter's radius, which runs as Earth's, is questioned with its line", said.some(function (x) { return /Write =ESCV\(PLANET\("Jupiter","radius"\),PLANET\("Jupiter","gm"\)\)/.test(x); }), said);
  // the run's passed rows: none questioned by it
  var bad = F.rows.filter(function (r0) { return r0.pass && /^=/.test(r0.reply || ""); }).filter(function (r0) { return C.otherBodyCall(r0.reply); });
  ok("the run's passed rows: none given the line", !bad.length, bad.map(function (b) { return b.id; }));
  console.log(fails ? fails + " OTHER BODY GM FAILURES (" + passes + " passed)" : "ALL OTHER BODY GM CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
}, 300);
