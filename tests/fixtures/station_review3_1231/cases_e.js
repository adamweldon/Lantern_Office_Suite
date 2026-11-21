// cases_e.js -- E: every sentence of the parts list, how it works and the checks matches what was drawn for THAT
// station. The control circuit is simulated (sim.js: floats at 1, 2, 3 ... from the bottom up) and each sentence that
// says what happens at a float is held to the simulation; each tag in the parts list is a drawn part, and each drawn part
// is in the parts list.
"use strict";
var H = require("./lib.js");
var RUN = require("../liftstation_1230/run_35b.json");
var Q = "Design a lift station: the control circuit, the piping and the float levels";
var SQ = "Design a simplex sump pump station: the control, the piping and the float levels";
function build(lines, q) { return H.L().aiAct.build(H.st(lines), q || Q); }
function E(id, harm, lines, right, judge, q) { return { id: id, harm: harm, input: { question: q || Q, block: lines }, right: right, run: function () { return H.boot().then(function () { var r = build(lines, q); return r.plan ? judge(r, r.plan) : "not drawn: " + r.problems.join("; "); }); } }; }
function ctlOf(p) { return p.views.control ? p.views.control.circuit : null; }
function at(p) { var m = {}; p.spec.floats.forEach(function (f, i) { m[f.id] = i + 1; }); return m; }
function sim(p) { var c = ctlOf(p), h = at(p); return H.sim.make(c, function (id) { return h[id] == null ? null : h[id]; }); }
function running(S, ids) { return ids.filter(function (x) { return S.on(x); }); }
function fid(p, job, n) { return p.spec.floats.filter(function (f) { return f.job === job; })[n || 0]; }
// the tags drawn: every output, contact, float and overload of the control; pumps, check and shutoff valves of the piping; floats of the levels
function drawnTags(p) {
  var t = {}, c = ctlOf(p);
  if (c) (c.feed || []).forEach(function (f) { t[f.id] = 1; });
  if (c) c.rungs.forEach(function (g) { t[g.out.id] = 1; g.stops.concat(g.starts, g.series, g.after, [].concat.apply([], g.branches || [])).forEach(function (e) { if (e.kind !== "contact") t[e.id] = 1; }); });
  if (p.views.piping) p.views.piping.pumps.forEach(function (x) { t[x.id] = 1; if (x.check) t[x.check] = 1; if (x.valve) t[x.valve] = 1; });
  if (p.views.levels) p.views.levels.floats.forEach(function (f) { t[f.id] = 1; });
  return t;
}
function listedTags(p) { var t = {}; p.parts.forEach(function (r) { String(r.tags).split(/,\s*/).forEach(function (x) { if (x) t[x] = 1; }); }); return t; }
function tagsAgree(p) {
  var d = drawnTags(p), l = listedTags(p), out = [];
  Object.keys(l).forEach(function (x) { if (!d[x]) out.push(x + " is listed and not drawn"); });
  Object.keys(d).forEach(function (x) { if (!l[x]) out.push(x + " is drawn and not listed"); });
  return out.join("; ");
}
module.exports = [
  E("E-01", "high", ["pumps 2", "floats off lead lag alarm"], "The usual duplex's control works: lead held to the off float, the pumps take turns, the lag float runs both, the alarm lights at its float, an overload drops only its pump (sim.duplex).",
    function (r, p) { var c = ctlOf(p); var out = H.sim.duplex(c, { floats: { off: "FS1", lead: "FS2", lag: "FS3", alarm: "FS4" }, pumps: ["M1", "M2"], alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" }, ols: { OL1: "M1", OL2: "M2" } }); return out.join("; "); }),
  E("E-02", "high", ["pumps 2", "floats off lead lag alarm"], "How it works, sentence by sentence, is what the simulated control does: one pump at FS2 held down to FS1; the other leads next time; both at FS3 down to FS1; the alarm light at FS4.",
    function (r, p) {
      var S = sim(p), P = ["M1", "M2"], s = p.sequence.plain, bad = [];
      S.set(2.5); var first = running(S, P); S.set(1.5); var held = running(S, P); S.set(0.5); var stop = running(S, P);
      if (!(/rises to FS2 .*down to FS1/.test(s[0]) && first.length === 1 && held.join() === first.join() && !stop.length)) bad.push("lead: " + s[0] + " / sim " + first + "," + held + "," + stop);
      S.set(2.5); var second = running(S, P); S.set(0.5);
      if (!(/alternating relay changes over/.test(s[1]) && second.length === 1 && second[0] !== first[0])) bad.push("alternation: sim " + first + " then " + second);
      S.set(2.5); S.set(3.5); var both = running(S, P); S.set(1.5); var both2 = running(S, P); S.set(0.5);
      if (!(/FS3 \(lag on\), the other pump starts too, and both run until the water is down to FS1/.test(s[2]) && both.length === 2 && both2.length === 2)) bad.push("lag: " + s[2] + " / sim " + both + ";" + both2);
      S.set(4.5); var lamp = S.on("LT3"); S.set(0.5);
      if (!(/FS4 \(high level alarm\), the alarm light comes on/.test(s[3]) && lamp)) bad.push("alarm: " + s[3]);
      return bad.join("; "); }),
  E("E-03", "high", ["pumps 2", "floats off lead lag alarm"], "Each check of the circuit is true of it: lift FS2 and one pump runs to FS1; again, the other; FS3 with FS2 up, both; FS4, the alarm light.",
    function (r, p) {
      var k = p.checks.run.join(" "), S = sim(p), P = ["M1", "M2"];
      S.set(2.5); var a = running(S, P); S.set(0.5); S.set(2.5); var b = running(S, P); S.set(3.5); var c = running(S, P); S.set(4.5); var l = S.on("LT3");
      var ok = /lift FS2 \(lead on\) and let it go: one pump starts, and runs until the water is down to FS1/.test(k) && a.length === 1 && /this time the other pump starts/.test(k) && b.length === 1 && b[0] !== a[0] &&
        /Lift FS3 \(lag on\) with FS2 up: both pumps run/.test(k) && c.length === 2 && /Lift FS4 \(high level alarm\): the alarm light comes on/.test(k) && l;
      return ok ? "" : "checks: " + k.slice(0, 300) + " / sim " + [a, b, c, l].join(" | "); }),
  E("E-04", "high", ["pumps 2", "floats off lead lag alarm"], "The parts list's tags are the drawn parts, and every drawn part is in the parts list.", function (r, p) { return tagsAgree(p); }),
  E("E-05", "high", ["pumps 2", "floats low level alarm, off, lead, lag, high level alarm"], "With a low level alarm: the tags agree, its amber light is on while the water is below FS1 and off above it, and the sentences say so.",
    function (r, p) { var S = sim(p), lt = ctlOf(p).rungs.filter(function (g) { return g.out.kind === "lamp" && /low/.test(g.out.label || ""); })[0]; if (!lt) return "no low level light drawn";
      S.set(0.5); var a = S.on(lt.out.id); S.set(1.5); var b = S.on(lt.out.id);
      return tagsAgree(p) || (a && !b && /falls below FS1 \(low level alarm\), its alarm comes on/.test(p.sequence.plain.join(" ")) && /fall below FS1 \(low level alarm\).*its light comes on/.test(p.checks.run.join(" ")) ? "" : "low light at 0.5: " + a + ", at 1.5: " + b); }),
  E("E-06", "high", ["pumps 2", "floats off, lag off, lead, lag, high level alarm, high high alarm", "horn"],
    "A lag pump's own off float, two alarms and a horn: the lag pump stops at FS2 and the lead at FS1 (sim); FS5's light alone, FS6's light and the horn; each sentence as simulated; the tags agree.",
    function (r, p) {
      var S = sim(p), P = ["M1", "M2"], out = [], s = p.sequence.plain.join(" ");
      S.set(4.5); var both = running(S, P).length; S.set(2.5); var between = running(S, P).length; S.set(1.5); var lead = running(S, P).length; S.set(0.5); var none = running(S, P).length;
      if (!(both === 2 && between === 2 && lead === 1 && none === 0)) out.push("lag off: both " + both + ", at 2.5 " + between + ", at 1.5 " + lead + ", at 0.5 " + none);
      if (!/the lag pump stops at FS2 \(lag off\) and the lead pump at FS1 \(off\)/.test(s)) out.push("sequence: " + s);
      var horn = ctlOf(p).rungs.filter(function (g) { return g.out.kind === "horn"; })[0];
      S.set(5.5); var h5 = horn && S.on(horn.out.id); S.set(6.5); var h6 = horn && S.on(horn.out.id); S.set(0.5);
      if (!(!h5 && h6 && /FS5 \(high level alarm\), the alarm light comes on/.test(s) && /FS6 \(high high alarm\), the alarm light and horn come on/.test(s))) out.push("horn at FS5 " + h5 + ", FS6 " + h6);
      return out.concat(tagsAgree(p) ? [tagsAgree(p)] : []).join("; "); }),
  E("E-07", "high", ["pumps 1", "floats off lead alarm", "horn"], "A simplex: the pump starts at FS2 and holds to FS1 (sim); no alternation in any sentence; “the pump starts”; the horn and light at FS3; the tags agree.",
    function (r, p) { var S = sim(p); S.set(2.5); var a = S.on("M1"); S.set(1.5); var b = S.on("M1"); S.set(0.5); var c = S.on("M1"); S.set(3.5); var h = ctlOf(p).rungs.some(function (g) { return g.out.kind === "horn" && S.on(g.out.id); });
      var all = p.sequence.plain.concat(p.checks.run).join(" ");
      return a && b && !c && h && !/alternat|other pump|both pumps/.test(all) && /FS2 \(pump on\) and let it go: the pump starts/.test(all) ? tagsAgree(p) : "sim " + [a, b, c, h] + "; " + all.slice(0, 200); }, SQ),
  E("E-08", "low", ["pumps 1", "floats off lead alarm"], "A simplex's alarm sentence speaks of its one pump. It says “the pumps are not keeping up. One may have failed”.",
    function (r, p) { var s = p.sequence.plain.filter(function (x) { return /alarm/.test(x); })[0] || ""; return /the pumps are not keeping up\. One may have failed/.test(s) ? s : ""; }, SQ),
  E("E-09", "medium", ["pumps 2", "show piping levels"], "Piping and levels only: no control circuit and no alternating relay drawn or listed, so how it works does not tell of one. It says “Each time the pumps stop, the alternating relay changes over”.",
    function (r, p) { return p.views.control ? "a control was drawn" : /alternating relay/.test(p.sequence.plain.join(" ")) && !p.parts.some(function (x) { return /Alternating relay/.test(x.item); }) ? "how it works names an alternating relay that is neither drawn nor listed: " + p.sequence.plain[1] : ""; }),
  E("E-10", "medium", ["pumps 2", "lights none"], "No run lights: none drawn, none listed, none said; the alarm light stays (drawn, listed).",
    function (r, p) { var lamps = ctlOf(p).rungs.filter(function (g) { return g.out.kind === "lamp"; }).map(function (g) { return g.out.label; }); return lamps.join() === "high level" && !/run light/.test(p.said.join(" ")) ? tagsAgree(p) : "lamps " + lamps + "; said " + p.said.join("; "); }),
  E("E-11", "medium", ["pumps 2", "valves plug"], "Plug valves: drawn as plug valves and listed so.",
    function (r, p) { return p.views.piping.pumps.every(function (x) { return x.valveKind === "plug"; }) && p.parts.some(function (x) { return /^Shutoff valve \(plug\)/.test(x.item); }) ? "" : "valves " + p.views.piping.pumps.map(function (x) { return x.valveKind; }); }),
  E("E-12", "medium", ["pumps 2", "supply \x2224 V DC\x22"], "A 24 V DC control: the ladder's rail says it, the parts list lists it, and nothing says “no control voltage”.",
    function (r, p) { return ctlOf(p).rails.join() === "24 V DC" && p.parts.some(function (x) { return x.item === "Control supply: 24 V DC"; }) && !/no control voltage/.test(p.said.join(" ")) ? "" : "rails " + ctlOf(p).rails + "; said " + p.said.join("; "); }),
  E("E-13", "medium", ["pumps 3"], "Three pumps: no control drawn, said why; no sentence tells of an alternating relay; the float checks send the reader to the controller's manual; the tags agree.",
    function (r, p) { var all = p.sequence.plain.concat(p.checks.run).join(" "); return !p.views.control && /needs a controller made for it/.test(p.left.join(" ")) && !/alternating relay/.test(all) && /manual of the controller made for this station/.test(all) ? tagsAgree(p) : "control " + !!p.views.control + "; " + all.slice(0, 200); }),
  E("E-14", "medium", ["pumps 5"], "Five pumps: the levels only, said; the parts list has five pumps.",
    function (r, p) { var pumps = p.parts.filter(function (x) { return /^Pump/.test(x.item); })[0]; return Object.keys(p.views).join() === "levels" && pumps && pumps.qty === 5 && p.left.length === 2 ? "" : Object.keys(p.views) + " " + JSON.stringify(pumps); }),
  E("E-15", "medium", ["pumps 2", "show control piping"], "Control and piping only: the Writer document has a section for each drawn and none for the levels; the float check does not send the reader to a drawing of the levels.",
    function (r, p) { var L = H.L(), o = null, cr0 = L.writerDocs.create; L.writerDocs.create = function (t, h) { o = { t: t, h: h }; return cr0.call(L.writerDocs, t, h); }; try { r.open(); } catch (e) { } L.writerDocs.create = cr0;
      if (!o) return "no document"; var h2 = (o.h.match(/<h2>[^<]*<\/h2>/g) || []).join(" ");
      return /Control circuit/.test(h2) && /Piping/.test(h2) && !/Float levels/.test(h2) && !/on the drawing of the float levels/.test(p.checks.run.join(" ")) ? "" : h2; }),
  E("E-16", "medium", ["pumps 2", "floats off lead lag"], "No alarm float: said, and what Lantern does not know begins “This station has no high level alarm”.",
    function (r, p) { return /no high level alarm float/.test(p.said.join(" ")) && p.unknown.some(function (u) { return /^This station has no high level alarm\./.test(u); }) ? "" : p.unknown.join(" | "); }),
  E("E-17", "low", ["pumps 2"], "The summary's count of parts-list lines is the parts list's.",
    function (r, p) { var m = /parts list \((\d+) lines\)/.exec(r.summary); return m && +m[1] === p.parts.length ? "" : r.summary; }),
  E("E-18", "medium", ["pumps 2", "floats off lead alarm"], "No lag float: no sentence or check of a lag; at high water one pump runs (sim).",
    function (r, p) { var S = sim(p); S.set(2.5); S.set(3.5); var n = running(S, ["M1", "M2"]).length; var all = p.sequence.plain.concat(p.checks.run).join(" "); return n === 1 && !/both pumps run|both run|lag on/.test(all) ? "" : "pumps at high water " + n + "; " + all.slice(0, 200); }),
  E("E-19", "medium", ["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft", "well \x22wet well\x22 10 ft", "inlet \x228 in gravity sewer\x22 6.5 ft"],
    "Heights: the levels drawn to scale at the heights written, the inlet at 6.5 ft; the parts list's well is 10 ft deep.",
    function (r, p) { var lv = p.views.levels; return lv.scaled && lv.floats.map(function (f) { return f.height; }).join() === "2 ft,3 ft,4 ft,5 ft" && lv.inlet && lv.inlet.height === "6.5 ft" && /^Wet well, 10 ft deep$/.test(p.parts[0].item) ? "" : JSON.stringify([lv.floats.map(function (f) { return f.height; }), lv.inlet, p.parts[0].item]); }),
  { id: "E-20", harm: "medium", input: { question: RUN.question, reply: "the 35B's own MAKE CONTROL of 1.24.30 (tests/fixtures/liftstation_1230/run_35b.json, reply 2)" },
    right: "Read as the station, its control as written: the sentences name its own floats (FS1 start high, FS2 stop low, FS3 alarm high high) and are true of it (sim), and the parts list has every part of it. The sentences hold; the parts list leaves out its selector switch SS1 (the parts list reads only starters, overloads, relays, the alternator, lights and horns off a control).",
    run: function () { return H.boot().then(function () {
      var r = H.L().aiAct.build(RUN.replies[1].reply, RUN.question), p = r.plan; if (!p) return "not drawn";
      var S = sim(p), P = ["M1", "M2"]; S.set(2.5); var a = running(S, P); S.set(1.5); var b = running(S, P); S.set(0.5); var c = running(S, P); S.set(3.5);
      var alarm = ctlOf(p).rungs.some(function (g) { return g.out.kind === "lamp" && g.series.some(function (e) { return e.id === "FS3"; }) && S.on(g.out.id); });
      return /rises to FS1 \(start high\).*down to FS2 \(stop low\)/.test(p.sequence.plain[0]) && a.length === 1 && b.join() === a.join() && !c.length && alarm ? tagsAgree(p) : "sim " + [a, b, c, alarm] + "; " + p.sequence.plain[0]; }); } },
  { id: "E-24", harm: "medium", input: { question: "Design a duplex lift station: draw the control circuit, the piping and the float levels", reply: "MAKE CONTROL with a control fuse, an E-stop, a hand-off-auto selector per pump and a test button" },
    right: "Every part of a control the model wrote is in the station's parts list (a fuse, an E-stop, selector switches, a button are parts to buy). They are drawn and not listed.",
    run: function () { return H.boot().then(function () {
      var t = H.ctl(['supply "120 V AC"', 'fuse FU1', 'estop ES1', 'float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"', 'switch SS1 M1 "pump 1 auto"', 'switch SS2 M2 "pump 2 auto"', 'lamp LT1 FS4 "high level" red', 'button PB1 LT1 "lamp test"'], "Duplex");
      var r = H.L().aiAct.build(t, "Design a duplex lift station: draw the control circuit, the piping and the float levels");
      return r.plan ? tagsAgree(r.plan) : "not drawn: " + r.problems.join("; "); }); } },
  E("E-21", "medium", ["pumps 2"], "Said “a run light for each pump and a red light on the high level alarm”: each pump's light is on with its pump, the red light at the alarm float (sim).",
    function (r, p) { var S = sim(p); S.set(2.5); var ok1 = ["M1", "M2"].every(function (m, i) { return S.on("LT" + (i + 1)) === S.on(m); }); S.set(4.5); var red = ctlOf(p).rungs.filter(function (g) { return g.out.kind === "lamp" && g.out.colour !== "G"; }); S.set(0.5);
      return /a run light for each pump and a red light on the high level alarm/.test(p.said.join(" ")) && ok1 ? "" : "run lights follow pumps: " + ok1; }),
  E("E-22", "medium", ["pumps 2", "show control piping"], "No levels drawn: the checks do not point to a drawing of the levels; the piping's checks are there.",
    function (r, p) { var k = p.checks.run.join(" "); return !/drawing of the float levels/.test(k) && /^Before any pump runs/.test(p.checks.run[0]) ? "" : k.slice(0, 200); }),
  E("E-23", "medium", ["pumps 2", "show control levels"], "No piping drawn: no check of the shutoff valves or the check valves (they are not drawn), and the pumps still listed.",
    function (r, p) { var k = p.checks.run.join(" "); return !/shutoff valve|check valve closes/.test(k) && p.parts.some(function (x) { return /^Pump/.test(x.item) && x.qty === 2; }) ? "" : k.slice(0, 200); })
];
