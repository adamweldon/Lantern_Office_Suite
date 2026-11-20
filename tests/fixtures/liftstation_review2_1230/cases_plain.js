// cases_plain.js -- area B: control circuits that are not pump stations must draw as they did on 1.24.29 (the new
// rules for floats, alternators and alarms must not touch them), and their questions must be shown what they were.
"use strict";
var circuits = require("./plain_circuits.js"), before = require("./plain_1229.json"), sig = require("./plain_sig.js");
var CASES = [];
circuits.forEach(function (c) {
  CASES.push({ id: c.id, q: c.q, input: c.b, harm: "high",
    right: "Not a pump station: drawn exactly as 1.24.29 drew it (the same rungs, problems and summary), with the same tools offered" +
      (c.id === "B-overload-trip-light" ? " -- except that 1.24.29 lit the trip light while the overload had NOT tripped; lit when it trips is right" :
        /not-drawn/.test(c.id) ? " (the list of what Lantern draws now names the alternator; nothing else may change)" : "") + ".",
    run: function (H) {
      var r = H.build(c.b, c.q), now = sig(r), was = before[c.id];
      if (!was) return "no 1.24.29 result recorded";
      var tools = H.L.aiAct.relevant(c.q).map(function (a) { return a.id; });
      if (tools.join() !== was.tools.join()) return "tools offered " + tools.join(",") + " (1.24.29: " + was.tools.join(",") + ")";
      if (c.id === "B-overload-trip-light") {
        var g = H.rung(r, "LT1");
        return g && g.after.some(function (e) { return e.id === "OL1" && !e.nc; }) && /LT1[^.]*lights while the overload OL1 has tripped/.test(r.summary) ? "" : "the trip light is not on OL1's trip contact";
      }
      if (/not-drawn/.test(c.id)) now = now.replace(/, interlock, alternator\)/g, ", interlock)");
      return now === was.sig ? "" : "drawn differently from 1.24.29: " + now.slice(0, 300);
    } });
});
function noPumpPrompt(id, q, right, harm) {
  return { id: id, q: q, input: "(the instructions)", right: right, harm: harm || "medium",
    run: function (H) { var p = H.L.aiAct.prompt(q); return /MAKE CONTROL: Duplex pump station/.test(p) ? "shown the duplex pump station's example (floats, an alternator)" : ""; } };
}
CASES.push(noPumpPrompt("B-prompt-two-pumps-own-buttons", "Draw a control circuit for two pumps, each with its own start and stop buttons.",
  "Two pumps each started by hand are not a duplex station: the instructions' example should be the motor starter's, not the duplex with floats and an alternator (a small model writes the example it is shown).", "medium"));
CASES.push(noPumpPrompt("B-prompt-car-alternator", "Draw the wiring of a car alternator, battery and ignition switch.", "A car's alternator is not an alternating relay: no pump station example.", "low"));
CASES.push(noPumpPrompt("B-prompt-sump-one-float", "Draw a control circuit for a sump pump switched by one float switch.", "A one-float sump pump: the plain guide (its own example is a sump pump).", "low"));
CASES.push(noPumpPrompt("B-prompt-starter-interlock", "Draw a forward/reverse motor control circuit with interlocks.", "Forward/reverse: the plain guide.", "low"));
CASES.push({ id: "B-prompt-two-sump-pumps-alternate", q: "Draw the control circuit for two sump pumps that alternate.", input: "(the instructions)", harm: "medium",
  right: "Two sump pumps that alternate are a duplex: the pump station's lines and example.",
  run: function (H) { return /alternator AR M1 M2/.test(H.L.aiAct.prompt(this.q)) ? "" : "not shown the alternator line"; } });
CASES.push({ id: "B-motor-starter-still-works", q: circuits[0].q, input: circuits[0].b, harm: "high",
  right: "The plain motor starter still works when simulated: start pulls in M1 and it holds; stop drops it; the overload Lantern adds drops it.",
  run: function (H) {
    var r = H.build(this.input, this.q), S = require("./sim.js").make(H.circuit(r), function () { return null; });
    S.set(0); S.press("PB2"); S.press("PB2", false); if (!S.on("M1")) return "M1 does not hold"; if (!S.on("LT1")) return "LT1 not lit";
    S.press("PB1"); S.press("PB1", false); if (S.on("M1")) return "stop does not drop M1";
    S.press("PB2"); S.press("PB2", false); var ol = H.rung(r, "M1").after[0]; S.trip(ol.id); return S.on("M1") ? "the overload does not drop M1" : "";
  } });
CASES.push({ id: "B-flasher-not-an-alternator", q: "Draw a control circuit with an alternating flasher for two warning lamps.", input: circuits.filter(function (c) { return c.id === "B-alternating-flasher"; })[0].b, harm: "medium",
  right: "An \"alternating flasher\" is not a pump's alternating relay: no duplex wiring, nothing said about pumps.",
  run: function (H) { var r = H.build(this.input, this.q); return r.ok && !/alternating relay|take turns|lead call/.test(r.summary) ? "" : "read as a pump alternator: " + (r.summary || r.problems.join("; ")).slice(0, 200); } });
module.exports = CASES;
