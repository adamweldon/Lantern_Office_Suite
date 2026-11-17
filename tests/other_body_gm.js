// other_body_gm.js -- an orbit function given another body's radius and no GM (1.24.22). Adam's quick run of set A
// with the 9B on his laptop (bench_run_1261_9b_seta_quick.json): "What is the escape velocity from Mars?" came back as
// =ESCV(PLANET("Mars","radius")). ESCV, ORBITV and ORBITT given one value use Earth's GM; Lantern refused the radius as
// "inside the Earth ... add 6371 km to an altitude", the wrong mend for Mars, and the 9B wrote the same again. Three
// reviews later (review1_1262.json, review2_1262.json, review3_1262.json): a refusal carries only what is true of the
// function whatever the question, and the line to write goes only to the plainest escape question; a formula that
// runs is questioned only with that line.
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
  ok("now what is true of ESCV goes back with the refusal, and the line for the plainest question", /ESCV given one value works out Earth.s \(it uses Earth.s GM\)\. For an orbit round Mars, or to escape from Mars, give Mars.s GM, PLANET\("Mars","gm"\), as its second value\. Write =ESCV\(PLANET\("Mars","radius"\),PLANET\("Mars","gm"\)\)/.test(asked[1] || ""), asked[1]);
  ok("...and the refusal itself names another body's GM", /for another planet or moon, give that body.s GM as the second value/.test(asked[1] || ""), asked[1]);
  ok("...and that line, written, gives Mars's escape velocity (PLANET(\"Mars\",\"escape\"))", r.run && Math.abs(r.run.value - row.expected) < 1e-6, r.run && r.run.value);
  // (three reviews) the line only for the plainest escape question; everything else: what is true of the function, no line
  var Q = { moonE: "What is the escape velocity from the Moon, in m/s?", marsE: "What is the escape velocity from Mars, in m/s?" };
  var cases = [
    [Q.marsE, "=ESCV(PLANET(\"Mars\",\"radius\"))", "ESCV(PLANET(\"Mars\",\"radius\"),PLANET(\"Mars\",\"gm\"))"],
    ["What's Mars's escape velocity?", "=ESCV(PLANET(\"Mars\",\"radius\"))", "ESCV(PLANET(\"Mars\",\"radius\"),PLANET(\"Mars\",\"gm\"))"],
    ["What is the escape velocity from the surface of Jupiter, in km/s?", "=ESCV(PLANET(\"Jupiter\",\"radius\"))/1000", "ESCV(PLANET(\"Jupiter\",\"radius\"),PLANET(\"Jupiter\",\"gm\"))/1000"],
    ["What is the escape speed from the Sun?", "=ESCV(PLANET(\"Sun\",\"radius\"))", "ESCV(PLANET(\"Sun\",\"radius\"),PLANET(\"Sun\",\"gm\"))"],
    // (set B, the Moon: told to add 6371 km, the 9B added it -- the line leaves it out, however it was written)
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+6371000)", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+CONVERT(6371,\"km\",\"m\"))", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+6371*1000)", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+PLANET(\"Earth\",\"radius\"))", "ESCV(PLANET(\"Moon\",\"radius\"),PLANET(\"Moon\",\"gm\"))"],
    // right ones, and Earth's: nothing
    [Q.marsE, "=ESCV(PLANET(\"Mars\",\"radius\"),PLANET(\"Mars\",\"gm\"))", null],
    [Q.moonE, "=ESCV(PLANET(\"Earth\",\"radius\"))", null],
    ["How many days does the Moon take to orbit Earth?", "=ORBITT(PLANET(\"Moon\",\"distance\"))/86400", null],
    [Q.marsE, "=ESCV(6371000)", null],
    ["How long does the space station take to orbit Earth at 420 km altitude, in minutes?", "=ORBITT(PLANET(\"Earth\",\"radius\")+CONVERT(420,\"km\",\"m\"))/60", null],
    [Q.marsE, "=PLANET(\"Mars\",\"radius\")\n=ESCV(ANS)", null],
    ["How much faster is the escape velocity from Jupiter than from Saturn?", "=ESCV(PLANET(\"Jupiter\",\"radius\"))-ESCV(PLANET(\"Saturn\",\"radius\"))", null],
    // not the plainest question: no line (what is said is only what is true of the function)
    ["How long, in minutes, does a satellite 400 km above Mars take to go round once?", "=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"))/60", "no line"],
    ["How fast does a probe orbit 100 km above the Moon?", "=ORBITV(PLANET(\"the Moon\",\"radius\")+100000)", "no line"],
    ["What is the escape velocity from Jupiter's cloud tops?", "=ESCV(PLANET(\"Jupiter\",\"eqradius\"))", "no line"],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+250000)", "no line"],
    ["What is the escape velocity from Mars in km per second?", "=ESCV(PLANET(\"Mars\",\"radius\"))/1000", "no line"],
    ["What is half the escape velocity from Mars?", "=ESCV(PLANET(\"Mars\",\"radius\"))/2", "no line"],
    ["What is the escape velocity from Venus?", "=ESCV(PLANET(\"Mars\",\"radius\"))", "no line"],
    ["What would Earth's escape velocity be if it were squeezed to the Moon's size?", "=ESCV(PLANET(\"Moon\",\"radius\"))", "no line"],
    ["What is the escape velocity from Phobos, one of Mars's moons?", "=ESCV(PLANET(\"Mars\",\"radius\"))", "no line"],
    ["What is the escape velocity from Mars?", "=ESCV(PLANET(\"Mars\",\"radius\"))*0.327789478360", "no line"]];
  cases.forEach(function (c) {
    var o = C.otherBodyCall(c[1], c[0]), got = o ? (o.line || "no line") : null;
    ok("line for " + c[1].replace(/\n/g, " / ") + " (" + c[0] + "): " + (c[2] || "none"), got === c[2], o);
  });
  // every line given is right when written in: worked out here from the body's own figures
  var P = L.planetData, chk = [
    [Q.marsE, "=ESCV(PLANET(\"Mars\",\"radius\"))", Math.sqrt(2 * P.mars[1] / P.mars[2])],
    [Q.moonE, "=ESCV(PLANET(\"Moon\",\"radius\")+6371*1000)", Math.sqrt(2 * P.moon[1] / P.moon[2])],
    ["What is the escape velocity from the surface of Jupiter, in km/s?", "=ESCV(PLANET(\"Jupiter\",\"radius\"))/1000", Math.sqrt(2 * P.jupiter[1] / P.jupiter[2]) / 1000]];
  chk.forEach(function (c) { var o = C.otherBodyCall(c[1], c[0]), v = o && o.line ? A.run("=" + o.line).value : null; ok("written in, " + c[1] + " gives " + c[2].toFixed(3), v != null && Math.abs(v - c[2]) <= 1e-6 * c[2], [o && o.line, v]); });
  // no line: what is said is true whatever the question
  var hint = C.otherBodyCall("=ORBITV(PLANET(\"Moon\",\"radius\")+200)", "What is the orbital speed 200 km above the Moon?");
  ok("no line: only what is true of the function, with no number of the question's", hint && !hint.line && L.aiChecks.otherBodySay(hint) === "ORBITV given one value works out Earth’s (it uses Earth’s GM). For an orbit round the Moon, or to escape from the Moon, give the Moon’s GM, PLANET(\"Moon\",\"gm\"), as its second value.", L.aiChecks.otherBodySay(hint));
  var runs = A.run("=ORBITV(PLANET(\"Jupiter\",\"radius\")+CONVERT(1000,\"km\",\"m\"))");
  var said0 = (L.assistChecks || []).map(function (f) { try { return f("A probe orbits 1000 km above the globe's biggest neighbour, Jupiter. How fast?", "=ORBITV(PLANET(\"Jupiter\",\"radius\")+CONVERT(1000,\"km\",\"m\"))", runs, {}); } catch (e) { return null; } }).filter(function (x) { return x && /GM/.test(x); });
  ok("a formula that runs is not questioned without the line", !said0.length, said0);
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
  // the second review's cases (tests/fixtures/review2_1262.json): no line wrong; a right formula given a line only when
  // Lantern cannot run it as written (Earth's ESCV refuses a radius inside the Earth), and then the line gives what it meant
  var R2 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review2_1262.json"), "utf8"));
  var n2 = 0, wrong2 = [], right2 = 0;
  (R2.rule1 || []).filter(function (c) { return c.cls; }).forEach(function (c) {
    var o = C.otherBodyCall(c.expr, c.question), mv = /giving\s+(-?[\d.e+]+)/i.exec(c.expected || "");
    n2++;
    if (!(o && o.line)) return;
    var v = A.run("=" + o.line).value;
    if (mv) { if (!(typeof v === "number" && Math.abs(v - parseFloat(mv[1])) <= Math.max(1e-6, 1e-6 * Math.abs(parseFloat(mv[1]))))) wrong2.push([c.question, c.expr, o.line, v, mv[1]]); return; }
    if (c.cls === "right") {
      right2++;
      var meant = A.run(c.expr.replace(/\b(ESCV|ORBITV|ORBITT)\s*\x28([^\x28\x29]*(?:\x28[^\x28\x29]*\x29[^\x28\x29]*)*)\x29/i, "$1($2,PLANET(\"Earth\",\"gm\"))")).value, ran = A.run(c.expr).value;
      if (ran != null || !(typeof meant === "number" && Math.abs(v - meant) <= 1e-6 * Math.abs(meant))) wrong2.push(["right formula given a line", c.question, c.expr, o.line, v, meant, ran]);
      return;
    }
    if (/^no line$|^null|line null/i.test(c.expected || "")) wrong2.push(["a line where none was meant", c.question, c.expr, o.line]);
  });
  console.log("second review: " + n2 + " cases, " + right2 + " right but unrunnable given a line");
  ok("the second review.s " + n2 + " cases: no line wrong; " + right2 + " right formulas Lantern cannot run as written given the line they mean", n2 > 3000 && !wrong2.length, wrong2.slice(0, 8));
  var lc = (R2.rule2 || []).filter(function (c) { return c.raw; }), thrown = [], cut = [];
  lc.forEach(function (c) {
    var p2; try { p2 = L.aiCode.parse({ raw: c.raw.slice() }); } catch (e) { thrown.push([c.raw[0], String(e.message)]); return; }
    if (c.kind === "keep" && c.raw.filter(function (l) { return /\S/.test(l); }).length > 1 && p2.text.replace(/\s+$/, "") !== c.raw.join("\n").replace(/^\s+|\s+$/g, "")) cut.push(c.raw[0]);
    if (c.kind === "meant" && !(p2.lang && p2.text.split("\n")[0] === c.raw[1])) cut.push("meant: " + c.raw[0]);
  });
  ok("the second review's " + lc.length + " code blocks: none throws, every program kept whole, every lone name read", !thrown.length && !cut.length, [thrown, cut]);
  // the third review's cases (tests/fixtures/review3_1262.json, a share of its 28,133): no line wrong, no right formula
  // that runs given a line
  var R3 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "review3_1262.json"), "utf8")), w3 = [], n3 = 0, l3 = 0;
  R3.rule1.forEach(function (c) {
    var o = C.otherBodyCall(c.expr, c.question);
    n3++;
    if (!(o && o.line)) return;
    l3++;
    var v = A.run("=" + o.line).value;
    if (typeof c.expected === "number" && !(typeof v === "number" && Math.abs(v - c.expected) <= 0.005 * Math.abs(c.expected))) w3.push(["wrong", c.question, c.expr, o.line, v, c.expected]);
    if (c.exprRight && c.exprValue != null) w3.push(["a right formula that runs given a line", c.question, c.expr, o.line]);
  });
  ok("the third review's " + n3 + " cases: " + l3 + " lines given, none wrong; no right formula that runs given one", n3 > 1000 && !w3.length, w3.slice(0, 8));
  var run = A.run("=ESCV(PLANET(\"Jupiter\",\"radius\"))");
  var said = (L.assistChecks || []).map(function (f) { try { return f("What is the escape velocity from Jupiter?", "=ESCV(PLANET(\"Jupiter\",\"radius\"))", run, {}); } catch (e) { return null; } }).filter(Boolean);
  ok("Jupiter's radius, which runs as Earth's, is questioned with its line", said.some(function (x) { return /Write =ESCV\(PLANET\("Jupiter","radius"\),PLANET\("Jupiter","gm"\)\)/.test(x); }), said);
  // the run's passed rows: none questioned by it
  var bad = F.rows.filter(function (r0) { return r0.pass && /^=/.test(r0.reply || ""); }).filter(function (r0) { var o = C.otherBodyCall(r0.reply, r0.q); return o && o.line; });
  ok("the run's passed rows: none given the line", !bad.length, bad.map(function (b) { return b.id; }));
  console.log(fails ? fails + " OTHER BODY GM FAILURES (" + passes + " passed)" : "ALL OTHER BODY GM CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
}, 300);
