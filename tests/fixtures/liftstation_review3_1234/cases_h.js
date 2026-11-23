// cases_h.js -- a part-and-wire MAKE SCHEMATIC read as the station (fromParts), what the second round added: ISA tags with
// no name, the station's name taken from the block's title, a problem that quotes the AI's own line, a dry well's pump,
// a sensor that is not a float.
"use strict";
var lib = require("./lib.js");
var Q = "write a schematic for a typical lift station";
function S(title, lines) { return lib.sch(title, ["mode electrical"].concat(lines)); }
var P = ["part V1 source \x22240 V\x22", "part M1 motor \x22Pump 1\x22", "part M2 motor \x22Pump 2\x22"], W = ["wire V1 M1", "wire M1 V1"];
function ps(id, title, extra, want, why, harm) {
  return { id: id, harm: harm || "medium", right: true, input: { q: Q, block: S(title, P.concat(extra, W)) }, why: why,
    run: async function (x) { var m = lib.build(x.N.L, S(title, P.concat(extra, W)), Q); if (!m || m.readAs !== "STATION") return "not read as the station: " + lib.probs(m); return want(m) || ""; } };
}
function fl(want) { return function (m) { if (!m.ok) return "not made: " + lib.probs(m); var g = m.plan.spec.floats.map(function (z) { return z.id + ":" + z.job; }).join(", "); return g === want ? "" : "floats " + g + ", want " + want; }; }
var C = [];
C.push(ps("H-isa-no-names", "Lift Station", ["part LSL1 float", "part LSH1 float", "part LSHH1 float"], fl("LSL1:off, LSH1:lead, LSHH1:alarm"), "ISA tags alone: low, high (the start, said), high high"));
C.push(ps("H-float-switch-types", "LS", ["part S1 float switch \x22Pumps Off\x22", "part S2 float switch \x22Lead Pump On\x22", "part S3 float switch \x22Lag Pump On\x22", "part S4 float switch \x22High Water Alarm\x22"], fl("S1:off, S2:lead, S3:lag, S4:alarm"), "float switches by name"));
C.push(ps("H-dry-well-pump", "LS", ["part M3 motor \x22Dry well sump pump\x22", "part F1 float \x22Off\x22", "part F2 float \x22Lead On\x22"], function (m) { return m.ok && m.plan.spec.pumps.length === 2 && /M3 \(dry well\)/.test(m.summary) ? "" : "pumps " + (m.plan && m.plan.spec.pumps.length) + ": " + (m.summary || "").slice(0, 300); }, "the dry well's sump pump is not a lift pump, and said"));
C.push(ps("H-pressure-sensor", "LS", ["part X1 sensor \x22Discharge Pressure\x22", "part F1 float \x22Off\x22", "part F2 float \x22Lead On\x22"], function (m) { return m.ok && m.plan.spec.floats.length >= 2 && !m.plan.spec.floats.some(function (z) { return z.id === "X1"; }) && /X1 \(sensor\)/.test(m.summary) ? "" : lib.floats(m) + " " + (m.summary || "").slice(0, 300); }, "a pressure sensor is not a float, and said"));
C.push(ps("H-jobless-quoted-line", "LS", ["part F1 float \x22Float 1\x22", "part F2 float \x22Float 2\x22"], function (m) {
  var p = lib.probs(m);
  if (m.ok) return "made: " + lib.floats(m);
  return /“part F1 float \x22Float 1\x22” does not say what the float is for: name its job, like: float F1 \x22off\x22 \| “part F2 float \x22Float 2\x22” does not say what the float is for: name its job, like: float F2 \x22lead on\x22$/.test(p) ? "" : p;
}, "jobless floats: each problem quotes the AI's own part line, the lines distinct, no height made of the name's number"));
C.push(ps("H-level-switch-unnamed", "LS", ["part S1 level switch", "part S2 level switch"], function (m) { var p = lib.probs(m); return !m.ok && /float S1 \x22off\x22/.test(p) && /float S2 \x22lead on\x22/.test(p) ? "" : p; }, "two level switches with no names: back once, a job each"));
C.push(ps("H-title-dash", "Control Wiring Diagram - Elm Avenue Lift Station", ["part F1 float \x22Off\x22", "part F2 float \x22Lead On\x22", "part F3 float \x22Lag On\x22", "part F4 float \x22High Level Alarm\x22"], function (m) { return m.plan && m.plan.title === "Elm Avenue Lift Station" ? "" : "titled “" + (m.plan && m.plan.title) + "”"; }, "the view's words before the station's name taken off"));
C.push(ps("H-title-after", "Dual Pump Lift Station Electrical", ["part F1 float \x22Off\x22", "part F2 float \x22Lead On\x22"], function (m) { return m.plan && m.plan.title === "Dual Pump Lift Station" ? "" : "titled “" + (m.plan && m.plan.title) + "”"; }, "the view's words after the name taken off"));
C.push(ps("H-title-power-street", "Power Street Lift Station Electrical", ["part F1 float \x22Off\x22", "part F2 float \x22Lead On\x22"], function (m) { return m.plan && m.plan.title === "Power Street Lift Station" ? "" : "titled “" + (m.plan && m.plan.title) + "”: a station named for its street loses its whole name to the view-word rule (“power” ... to the end)"; }, "a station whose name has a view's word in it", "low"));
C.push(ps("H-title-control-road", "Control Road Lift Station", ["part F1 float \x22Off\x22", "part F2 float \x22Lead On\x22"], function (m) { return m.plan && m.plan.title === "Control Road Lift Station" ? "" : "titled “" + (m.plan && m.plan.title) + "”"; }, "the same with “Control Road”", "low"));
module.exports = C;
