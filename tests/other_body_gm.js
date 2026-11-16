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
  // which lines are given, and which are left
  var cases = [
    ["=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"))/60", "ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"),PLANET(\"Mars\",\"gm\"))/60"],
    ["=ORBITV(PLANET(\"the Moon\",\"radius\")+100000)", "ORBITV(PLANET(\"the Moon\",\"radius\")+100000,PLANET(\"the Moon\",\"gm\"))"],
    ["=ESCV(PLANET(\"Jupiter\",\"eqradius\"))", "ESCV(PLANET(\"Jupiter\",\"eqradius\"),PLANET(\"Jupiter\",\"gm\"))"],
    ["=ESCV(PLANET(\"Mars\",\"radius\"),PLANET(\"Mars\",\"gm\"))", null],
    ["=ESCV(PLANET(\"Earth\",\"radius\"))", null],
    ["=ORBITT(PLANET(\"Moon\",\"distance\"))/86400", null],
    ["=ESCV(6371000)", null],
    ["=ORBITT(PLANET(\"Earth\",\"radius\")+CONVERT(420,\"km\",\"m\"))/60", null],
    ["=PLANET(\"Mars\",\"radius\")\n=ESCV(ANS)", null],
    ["=ESCV(PLANET(\"Mars\",\"radius\")+PLANET(\"Earth\",\"radius\"))", null],
    // (set B, the Moon: told to add 6371 km, the 9B added it -- the line leaves it out; a number from nowhere: no line)
    ["=ESCV(PLANET(\"Moon\",\"radius\")+6371000)", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    ["=ESCV(PLANET(\"Moon\",\"radius\")+CONVERT(6371,\"km\",\"m\"))", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    ["=ESCV(PLANET(\"Moon\",\"radius\")+250000)", null]];
  cases.forEach(function (c) { var o = C.otherBodyCall(c[0], "What is the escape velocity, or the orbit, at 400 km or 100 km?"); ok("line for " + c[0].replace(/\n/g, " / ") + ": " + (c[1] || "none"), (o ? o.line : null) === c[1], o); });
  var run = A.run("=ESCV(PLANET(\"Jupiter\",\"radius\"))");
  var said = (L.assistChecks || []).map(function (f) { try { return f("What is the escape velocity from Jupiter?", "=ESCV(PLANET(\"Jupiter\",\"radius\"))", run, {}); } catch (e) { return null; } }).filter(Boolean);
  ok("Jupiter's radius, which runs as Earth's, is questioned with its line", said.some(function (x) { return /Write =ESCV\(PLANET\("Jupiter","radius"\),PLANET\("Jupiter","gm"\)\)/.test(x); }), said);
  // the run's passed rows: none questioned by it
  var bad = F.rows.filter(function (r0) { return r0.pass && /^=/.test(r0.reply || ""); }).filter(function (r0) { return C.otherBodyCall(r0.reply); });
  ok("the run's passed rows: none given the line", !bad.length, bad.map(function (b) { return b.id; }));
  console.log(fails ? fails + " OTHER BODY GM FAILURES (" + passes + " passed)" : "ALL OTHER BODY GM CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
}, 300);
