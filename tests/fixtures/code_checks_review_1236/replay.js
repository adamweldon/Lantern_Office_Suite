// replay.js [inner.html] -- the code checks review of 1.24.36, replayed against src/lantern.inner.html (or argv[2]).
// Prints AGREE <id> or DISAGREE <id> <what was seen> [harm] per case, NOTE lines for the record, and ends with
// "N cases: A AGREE, D DISAGREE". Needs jsdom (as tests/liftstation.js) and git for 1.24.35 (G-03, G-04 say so if not).
"use strict";
var fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
var lib = require("./lib.js");
var ROOT = path.join(__dirname, "..", "..", "..");
var FILE = path.resolve(process.argv[2] || path.join(ROOT, "src", "lantern.inner.html"));
var circuits = require("./cases_circuits.js"), picks = require("./cases_pick.js"), misc = require("./cases_misc.js");
var runCircuits = require("./run_circuits.js");
var notes = [], variants = {}, oldP = null;
function variant(names) {
  var k = names.slice().sort().join("+");
  if (!variants[k]) variants[k] = lib.load(lib.strip(FILE, names, k.replace(/\W+/g, "_")));
  return variants[k];
}
function old() {
  if (oldP) return oldP;
  var f = path.join(os.tmpdir(), "ccr1236_1235_" + process.pid + ".html");
  try { fs.writeFileSync(f, cp.execSync("git show 8cb3281:src/lantern.inner.html", { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 })); oldP = lib.load(f); }
  catch (e) { oldP = Promise.resolve(null); }
  return oldP;
}
var results = [];
function put(id, j, harm) { results.push({ id: id, agree: j.agree, seen: j.seen, harm: j.harm || harm }); }
lib.load(FILE).then(function (main) {
  var L = main.L;
  // the circuits
  runCircuits(L, circuits).forEach(function (j) { put(j.id, j, j.harm); });
  // which practice
  picks.forEach(function (c) {
    lib.setPractice(L, c.saved);
    var got; try { got = L.codeChecks.pick(c.q); } catch (e) { got = "THREW " + e.message; }
    put(c.id, { agree: got === c.expect, seen: "pick(" + JSON.stringify(c.q) + ") with " + (c.saved || "nothing") + " saved: " + got + " (right: " + c.expect + ")" }, c.harm);
  });
  lib.setPractice(L, "");
  // the rest, one after another
  var ctx = { file: FILE, L: L, o: main.o, lib: lib, variant: variant, old: old, note: function (s) { notes.push(s); }, fresh: function () { return lib.load(FILE); } };
  return misc.reduce(function (p, c) {
    return p.then(function () {
      lib.setPractice(L, "");
      return Promise.resolve().then(function () { return c.run(ctx); }).then(function (j) { put(c.id, j, c.harm); }, function (e) { put(c.id, { agree: false, seen: "THREW " + (e && e.message) }, c.harm); });
    });
  }, Promise.resolve());
}).then(function () {
  results.forEach(function (r) { console.log(r.agree ? "AGREE " + r.id : "DISAGREE " + r.id + " " + String(r.seen).replace(/\s+/g, " ") + " [" + (r.harm || "medium") + "]"); });
  notes.forEach(function (n) { console.log("NOTE " + n); });
  var a = results.filter(function (r) { return r.agree; }).length;
  console.log(results.length + " cases: " + a + " AGREE, " + (results.length - a) + " DISAGREE");
  process.exit(0);
}, function (e) { console.log("replay failed: " + (e && e.stack)); process.exit(2); });
