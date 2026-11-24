// lib.js -- loads a version of src/lantern.inner.html and builds each case's reply with its question.
// run(file, cases, cb): cb([{id, ok, sig, ch (what Lantern changed), said (what it added and changed), problems, parts}])
"use strict";
var path = require("path");
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js"));
function sigOf(r) {
  var c = r && r.plan && r.plan.circuit;
  if (!r) return { ok: false, sig: "NULL", ch: "", said: "", problems: [], parts: "" };
  if (!r.ok || !c) return { ok: false, sig: "", ch: "", said: "", problems: (r.problems || []).slice(), parts: "" };
  var s = c.branches.map(function (b) {
    return [b.kind, b.load ? b.load.id + "(" + b.load.kind + ")" : b.sensor, b.pin ? "pin=" + b.pin : "", b.q ? "q=" + b.q : "", b.sw ? "sw=" + b.sw : "",
      b.r ? "r=" + b.r.id + ":" + b.r.ohms : "", b.rb ? "rb=" + b.rb.id + ":" + b.rb.ohms : "", b.diode ? "d=" + b.diode.id : "", b.pull ? "pull=" + b.pull : ""].filter(Boolean).join(" ");
  }).join("; ") + " | v=" + c.v;
  var parts = (r.plan.parts || []).map(function (p) { return p.id + ":" + p.kind; }).sort().join(" ");
  return { ok: true, sig: s, ch: (c.changed || []).join(" / "), said: (c.added || []).concat(c.changed || []).join(" / "), problems: (r.problems || []).slice(), parts: parts };
}
function run(file, cases, cb) {
  var o = load(file);
  setTimeout(function () {
    var out = cases.map(function (k) {
      var r;
      try { r = o.L.aiAct.build(k.reply, k.q); } catch (e) { return { id: k.id, ok: false, sig: "", ch: "", said: "", problems: ["THROW " + e.message], parts: "" }; }
      var s = sigOf(r); s.id = k.id; return s;
    });
    cb(out, o);
  }, 80);
}
module.exports = { run: run, sigOf: sigOf };
