// cases_f.js -- F: truth. Every statement Lantern makes in a summary must be true of what it drew: the ladder simulated
// against what the notes say each rung does; the levels drawing's heights measured against what was written; the
// piping's valves against the summary; the notes' numbers worked out again.
"use strict";
var H = require("./lib.js");
var run35 = require("../liftstation_1230/run_35b.json");
var CQ = "Draw the control circuit for a typical 2 pump lift station with an alternating relay";
var LQ = "Draw the float level positions in the wet well of a duplex lift station";
var PQ = "Draw the plumbing schematic for a duplex sewage lift station";
var F4 = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"'];
var P2 = ['alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'];
var FT = 0.3048;
function ctl(lines, q) { return H.L().aiAct.build(H.ctl(lines, "Duplex pump station"), q || CQ); }
function lev(lines, q) { return H.L().aiAct.build(H.blk("LEVELS", "Wet well", lines), q || LQ); }
function pipe(lines, q) { return H.L().aiAct.build(H.blk("PIPING", "Lift station", lines), q || PQ); }
// the levels drawing measured: each float's dashed level line (dashes 9/6), in the plan's order; the floor is at y 590
function levelYs(r) { var ys = []; (r.shapes || []).forEach(function (s) { if (s.t === "path" && s.d && s.d[0] === 9 && s.d[1] === 6 && s.pts && s.pts.length === 2 && s.pts[0][1] === s.pts[1][1]) ys.push(s.pts[0][1]); }); return ys; }
function inletY(r) { var y = null; (r.shapes || []).forEach(function (s) { if (s.t === "path" && s.d && s.d[0] === 3 && s.d[1] === 5) y = s.pts[0][1]; }); return y; }
// to scale: the drawn height above the floor over the height written (metres above the floor, by id) is one number
// for every float
function toScale(r, want) {
  if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "");
  var ys = levelYs(r), fl = r.plan.floats, FLOOR = 590, ks = [], out = [];
  if (ys.length !== fl.length) return "drew " + ys.length + " level lines for " + fl.length + " floats";
  fl.forEach(function (f, i) { if (want[f.id] != null) ks.push({ id: f.id, k: (FLOOR - ys[i]) / want[f.id], px: FLOOR - ys[i] }); });
  ks.forEach(function (x) { if (Math.abs(x.k - ks[0].k) / ks[0].k > 0.01) out.push(x.id + " drawn " + Math.round(x.px) + " px up for " + want[x.id].toFixed(3) + " m"); });
  return out.join("; ");
}
// the summary's statements of a duplex checked by simulation
function duplexTruth(r, fl, pumps, alarmLamp) {
  if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "");
  var at = {}; at[fl.off] = 1; at[fl.lead] = 2; if (fl.lag) at[fl.lag] = 3; if (fl.alarm) at[fl.alarm] = 4;
  var S = H.sim.make(r.plan.circuit, function (id) { return at[id] == null ? null : at[id]; }), out = [];
  var cr = r.plan.circuit.added.join(" | "), m = /lead call relay (\w+): (\w+) \([^)]*\) pulls it in, and its own contact holds it in until (\w+)/.exec(cr);
  if (!m) return "no lead call said: " + cr;
  var c1 = m[1];
  S.set(1.5); if (S.on(c1)) out.push(c1 + " in before " + m[2] + " makes");
  S.set(2.5); if (!S.on(c1)) out.push(c1 + " not pulled in by " + m[2]);
  S.set(1.5); if (!S.on(c1)) out.push(c1 + " not held in");
  S.set(0.5); if (S.on(c1)) out.push(c1 + " not dropped when " + m[3] + " opens");
  // the leads from power-up: a fresh scan (the checks above have cycled the relay once)
  var lead = [], S0 = H.sim.make(r.plan.circuit, function (id) { return at[id] == null ? null : at[id]; });
  for (var i = 0; i < 4; i++) { S0.set(2.5); lead.push(pumps.filter(function (p) { return S0.on(p); }).join("+")); S0.set(0.5); }
  if (!(lead[0] && lead[0] !== lead[1] && lead[0] === lead[2])) out.push("'take turns to lead' but the leads were " + lead.join(", "));
  // "M1 on CR1 while AR has M1 leading": the first lead is the pump said first
  if (lead[0] !== pumps[0]) out.push("the first cycle's lead is " + lead[0] + "; the steps say AR's closed contact (its rest) has " + pumps[0] + " leading");
  if (fl.lag && /runs both pumps/.test(cr)) { S.set(3.5); if (pumps.some(function (p) { return !S.on(p); })) out.push("'it runs both pumps' but at the lag float " + pumps.filter(function (p) { return S.on(p); }).join("+") + " run"); S.set(0.5); }
  if (!fl.lag && /one pump runs at a time/.test(r.plan.circuit.changed.join(" "))) { S.set(4.5); if (pumps.filter(function (p) { return S.on(p); }).length !== 1) out.push("'one pump runs at a time' but not so"); S.set(0.5); }
  if (alarmLamp) { S.set(3.5); if (S.on(alarmLamp)) out.push(alarmLamp + " lit below the alarm float"); S.set(4.5); if (!S.on(alarmLamp)) out.push(alarmLamp + " not lit at the alarm float"); }
  // every overload said added is after its pump
  (r.plan.circuit.added.join(" | ").match(/the overload contact (\w+) in (\w+)’s rung/g) || []).forEach(function (s) { var mm = /contact (\w+) in (\w+)’s/.exec(s), g = H.rung(r, mm[2]); if (!g || !g.after.some(function (e) { return e.id === mm[1]; })) out.push(s + ": not drawn so"); });
  return out.join("; ");
}
var cases = [
  { id: "F-01", harm: "high", input: { question: CQ, block: ['supply "120 V AC"'].concat(F4, P2, ['lamp LT3 FS4 "high level" red']) },
    right: "What the summary says the example does (the lead call pulled in by FS2 and held until FS1; AR changing over so M1 and M2 take turns, M1 first; the lag call running both; LT3 at the alarm float; the overloads in their pumps' rungs) is what the drawn ladder does.",
    run: function () { return duplexTruth(ctl(this.input.block), { off: "FS1", lead: "FS2", lag: "FS3", alarm: "FS4" }, ["M1", "M2"], "LT3"); } },
  { id: "F-02", harm: "high", input: { question: CQ, block: ['float FS1 "off"', 'float FS2 "on"'].concat(P2) },
    right: "No lag float: 'one pump runs at a time' is true; the pumps take turns.", run: function () { return duplexTruth(ctl(this.input.block), { off: "FS1", lead: "FS2" }, ["M1", "M2"]); } },
  { id: "F-03", harm: "high", input: { question: H.ADAM_Q, reply: "the 35B's second reply" },
    right: "The 35B's block: every statement of its summary true of the ladder (FS1 'start high' leads, FS2 'stop low' stops, LT3 on FS3).",
    run: function () { return duplexTruth(H.L().aiAct.build(run35.replies[1].reply, H.ADAM_Q), { off: "FS2", lead: "FS1", alarm: "FS3" }, ["M1", "M2"], "LT3"); } },
  { id: "F-04", harm: "low", input: { question: CQ, block: ['float FS1 "off" nc'].concat(F4.slice(1), P2) },
    right: "The model wrote the off float nc; Lantern draws it open (made above the off level), which is right for the call's holding circuit -- and says so (rule 2: what it changed is said).",
    run: function () { var r = ctl(this.input.block); if (!r.ok) return "not drawn"; var g = H.rung(r, H.rungs(r)[0].out.id), e = g.stops.filter(function (x) { return x.id === "FS1"; })[0]; return e && !e.nc && !/FS1[^|]*\bnc\b|normally closed|drawn open/.test(H.said(r)) ? "FS1 written nc is drawn open, unsaid" : ""; } },
  { id: "F-05", harm: "medium", input: { question: "Draw a ladder diagram for a sump pump with on and off floats", block: ['float FS1 M1 "off"', 'float FS2 M1 "on"', 'coil M1 "sump pump"'] },
    right: "'FS2 (on) starts M1 and FS1 (off) stops it: M1 holds itself in between' is what the ladder does.",
    run: function () { var r = H.L().aiAct.build(H.ctl(this.input.block), this.input.question); return H.pumpDown(r, "FS1", "FS2", "M1") || (/FS2 \(on\) starts M1 and FS1 \(off\) stops it/.test(H.said(r)) ? "" : "said: " + H.said(r)); } },

  { id: "F-10", harm: "high", input: { question: LQ, block: ['well "wet well" 10 ft', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS4 "high level alarm" 5.5 ft', 'inlet "inlet invert" 6.5 ft'] },
    right: "Drawn to scale: each float's line at its height, the inlet's invert at 6.5 ft on the same scale.",
    run: function () { var r = lev(this.input.block), s = toScale(r, { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT }); if (s) return s; var k = (590 - levelYs(r)[0]) / (2 * FT), iy = inletY(r); return Math.abs((590 - iy) / (6.5 * FT) - k) / k < 0.01 ? "" : "the inlet drawn at " + Math.round(590 - iy) + " px for 6.5 ft"; } },
  { id: "F-11", harm: "high", input: { question: LQ, block: ['float FS1 "off" 0.6 m', 'float FS2 "lead on" 1.0 m', 'float FS3 "lag on" 1.3 m', 'float FS4 "high level alarm" 1.6 m'] },
    right: "Metres, to scale.", run: function () { return toScale(lev(this.input.block), { FS1: 0.6, FS2: 1, FS3: 1.3, FS4: 1.6 }); } },
  { id: "F-12", harm: "high", input: { question: LQ, block: ['well "wet well" 20 ft deep', 'float FS1 "off" 18 ft below grade', 'float FS2 "lead on" 16.5 ft below grade', 'float FS3 "lag on" 15.5 ft below grade', 'float FS4 "high level alarm" 14.5 ft below grade'] },
    right: "Depths in a 20 ft well: drawn at 2, 3.5, 4.5, 5.5 ft above the floor, to scale.",
    run: function () { return toScale(lev(this.input.block), { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT }); } },
  { id: "F-13", harm: "high", input: { question: LQ, block: ['floor el. 100.0 ft', 'float FS1 "off" el. 101.5 ft', 'float FS2 "lead on" el. 102.5 ft', 'float FS3 "lag on" el. 103.5 ft', 'float FS4 "high level alarm" el. 104.5 ft'] },
    right: "Elevations with the floor's: to scale above the floor.", run: function () { return toScale(lev(this.input.block), { FS1: 1.5 * FT, FS2: 2.5 * FT, FS3: 3.5 * FT, FS4: 4.5 * FT }); } },
  { id: "F-14", harm: "medium", input: { question: LQ, block: ['well "wet well" rim el. 110.0 ft', 'float FS1 "off" el. 101.5 ft', 'float FS2 "lead on" el. 102.5 ft', 'float FS3 "lag on" el. 103.5 ft', 'float FS4 "high level alarm" el. 104.5 ft'] },
    right: "Elevations with the well's rim elevation: the rim is at el. 110.0 ft, so the floats are drawn in the well's lower part on the same scale (or back for the floor's elevation). Not: the rim's elevation (110 ft) taken as the well's depth above a floor Lantern placed at about el. 100.3 ft, which squashes all four floats into the bottom 18 px, under the pumps.",
    run: function () { var r = lev(this.input.block); if (!r.ok) return ""; var ys = levelYs(r); var top = 590 - Math.min.apply(null, ys); return top < 80 ? "the four floats drawn " + ys.map(function (y) { return Math.round(590 - y); }).join(", ") + " px above the floor of a 460 px well (the pumps stand 46 px high): the rim elevation was read as a 110 ft depth" : ""; } },
  { id: "F-15", harm: "medium", input: { question: LQ, block: ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft', 'inlet "8 in gravity sewer at 4.5 ft"'] },
    right: "The inlet's invert at 4.5 ft (written in its quotes after the pipe's size): read, drawn at 4.5 ft, and the note that the alarm (5 ft) is above the invert given. Not: the height dropped, the inlet drawn above every float and the summary saying 'the inlet's invert above them'.",
    run: function () { var r = lev(this.input.block); if (!r.ok) return "not drawn"; return r.plan.inlet && r.plan.inlet.height ? "" : "the invert height was dropped; the summary says: '" + (/[^.]*the inlet’s invert[^.]*\./.exec(r.summary) || [""])[0] + "' and nothing about the alarm (5 ft) above the 4.5 ft invert"; } },
  { id: "F-16", harm: "high", input: { question: LQ, block: ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft', 'inlet "inlet invert" 4.5 ft'] },
    right: "The alarm (5 ft) above the inlet's invert (4.5 ft): said, with both heights.", run: function () { var r = lev(this.input.block); return /the alarm \(5 ft\) is at or above the inlet’s invert \(4\.5 ft\)/.test(r.summary) ? "" : "not said: " + r.summary.slice(-300); } },
  { id: "F-17", harm: "medium", input: { question: LQ, block: ['float FS1 "off" 2 ft', 'float FS2 "lead on" 2.5 ft', 'float FS3 "lag on" 3.5 ft', 'float FS4 "high level alarm" 4.5 ft'] },
    right: "Floats 6 in apart: '152 mm (6 in) apart' -- the figures right -- and only for that pair (the others are 12 in apart).",
    run: function () { var r = lev(this.input.block); var m = r.summary.match(/(\w+) and (\w+) are (\d+) mm \(([\d.]+) in\) apart/g) || []; return m.length === 1 && /FS1 and FS2 are 152 mm \(6 in\) apart/.test(m[0]) ? "" : "said: " + m.join(" | "); } },
  { id: "F-18", harm: "medium", input: { question: LQ, block: ['float FS1 "off" 0.6 m', 'float FS2 "lead on" 0.9 m', 'float FS3 "lag on" 1.2 m', 'float FS4 "high level alarm" 1.5 m'] },
    right: "Floats exactly 300 mm apart meet Ontario's 300 mm: no note.", run: function () { var r = lev(this.input.block); return /apart/.test(r.summary) ? "said: " + (/[^;.]*apart[^;.]*/.exec(r.summary) || [""])[0] : ""; } },
  { id: "F-19", harm: "medium", input: { question: LQ, block: ['float FS1 "off" 600 mm', 'float FS2 "lead on" 899 mm', 'float FS3 "lag on" 1200 mm', 'float FS4 "high level alarm" 1500 mm'] },
    right: "299 mm apart: said (299 mm, 11.8 in).", run: function () { var r = lev(this.input.block); return /FS1 and FS2 are 299 mm \(11\.8 in\) apart/.test(r.summary) ? "" : "said: " + r.summary.slice(-260); } },
  { id: "F-20", harm: "low", input: { question: LQ, block: ['float FS1 "off" el. 101.5 ft', 'float FS2 "lead on" el. 102.5 ft', 'float FS3 "lag on" el. 103.5 ft', 'float FS4 "high level alarm" el. 104.5 ft'] },
    right: "Elevations with no floor given: the floor is placed by Lantern (1.2 ft under the off float) and labelled '(0)'; that it is assumed is said.",
    run: function () { var r = lev(this.input.block); if (!r.ok) return "not drawn"; var floor = (r.shapes || []).filter(function (s) { return s.t === "text" && /floor/.test(s.s); }).map(function (s) { return s.s; })[0]; return /floor/i.test(r.summary) ? "" : "the floor is drawn as '" + floor + "' at an elevation Lantern chose (about el. 100.3 ft), and nothing says it was not given"; } },
  { id: "F-21", harm: "low", input: { question: LQ, block: ['float FS1 "off" 18 ft below grade', 'float FS2 "lead on" 16.5 ft below grade', 'float FS3 "lag on" 15.5 ft below grade', 'float FS4 "high level alarm" 14.5 ft below grade'] },
    right: "Depths with no well depth: the floor is placed by Lantern (15% under the deepest float, 20.7 ft below grade) and labelled '(0)'; that it is assumed is said.",
    run: function () { var r = lev(this.input.block); if (!r.ok) return "not drawn"; return /floor/i.test(r.summary) ? "" : "the floor is drawn at a depth Lantern chose (20.7 ft below grade), unsaid"; } },
  { id: "F-24", harm: "low", input: { question: LQ, block: ['floor el. 100.0 ft', 'float FS1 "off" el. 101.5 ft', 'float FS2 "lead on" el. 102.5 ft'] },
    right: "The floor's elevation given (el. 100.0 ft): the floor is labelled with it, the way the floats are, not '(0)'.",
    run: function () { var r = lev(this.input.block); if (!r.ok) return "not drawn"; var floor = (r.shapes || []).filter(function (s) { return s.t === "text" && /floor/.test(s.s); }).map(function (s) { return s.s; })[0]; return /100/.test(floor) ? "" : "the floor is labelled '" + floor + "' beside floats labelled 'el. 101.5 ft'"; } },
  { id: "F-22", harm: "high", input: { question: LQ, block: ['float FS1 "off" 1.5 ft', 'float FS2 "lead pump on" 3 ft', 'float FS3 "lag pump on" 4 ft', 'float FS4 "high water alarm" 5 ft', 'float FS5 "low water alarm" 1 ft'] },
    right: "A low water alarm under the off float: drawn at the bottom, 'From the bottom up: FS5 low water alarm at 1 ft, FS1 off ...' true.",
    run: function () { var r = lev(this.input.block); return /From the bottom up: FS5 low water alarm at 1 ft, FS1 off at 1\.5 ft/.test(r.summary) ? toScale(r, { FS5: FT, FS1: 1.5 * FT, FS2: 3 * FT, FS3: 4 * FT, FS4: 5 * FT }) : "said: " + r.summary.slice(0, 200); } },
  { id: "F-23", harm: "medium", input: { question: LQ, block: ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS4 "high level alarm" 5 ft'] },
    right: "No lag float: the summary does not say 'the lag float starts the other pump'.", run: function () { var r = lev(this.input.block); return /lag float starts/.test(r.summary) ? "says the lag float starts the other pump" : ""; } },

  { id: "F-30", harm: "high", input: { question: PQ, block: ['well "wet well"', 'pump P1', 'pump P2', 'check CV1 P1', 'check CV2 P2', 'valve V1 P1 plug', 'valve V2 P2 plug', 'header "4 in force main"'] },
    right: "The summary's 'P1 to CV1 then V1 and P2 to CV2 then V2' is the plan's; on the drawing each pump's check valve is before its shutoff valve along the flow.",
    run: function () {
      var r = pipe(this.input.block); if (!r.ok) return "not drawn";
      var bad = r.plan.pumps.filter(function (p) { return r.summary.indexOf(p.id + " to " + p.check + " then " + p.valve) < 0; }).map(function (p) { return p.id; });
      if (bad.length) return "summary disagrees with the plan for " + bad.join(", ");
      var xs = {}; (r.shapes || []).forEach(function (s) { if (s.t === "text" && /^(CV\d|V\d)/.test(s.s)) xs[s.s.split(" ")[0]] = s.x; });
      return xs.CV1 < xs.V1 && xs.CV2 < xs.V2 ? "" : "on the drawing: " + JSON.stringify(xs);
    } },
  { id: "F-31", harm: "medium", input: { question: PQ, block: ['well "wet well"', 'pump P1', 'pump P2', 'header "4 in force main"', 'vent'] },
    right: "'Lantern added the check valves CV1 on P1 and CV2 on P2 ...; the shutoff valves V1 on P1 and V2 on P2 ...; the inlet' -- each true of the plan and drawn.",
    run: function () { var r = pipe(this.input.block); var p = r.plan.pumps; return p[0].check === "CV1" && p[1].check === "CV2" && p[0].valve === "V1" && p[1].valve === "V2" && /added the check valves CV1 on P1 and CV2 on P2/.test(r.summary) && /the inlet/.test(r.summary) ? "" : r.summary; } },
  { id: "F-32", harm: "medium", input: { question: PQ, block: ['well "wet well"', 'pump P1', 'pump P2', 'header "4 in force main"'] },
    right: "The standards the summary names are named as the Recommended Standards for Wastewater Facilities 2014 (Ten States) 42.52 and 44.4 (each pump's check valve before its shutoff valve; a submersible station's valves in a chamber of their own). Checked by this reviewer on 2026-11-20 against the 2014 text (Ohio EPA's copy, dam.assets.ohio.gov .../10wastewaterstandards-2014.pdf): 42.52 'Suitable shutoff and check valves shall be placed on the discharge line of each pump ... The check valve shall be located between the shutoff valve and the pump.'; 44.4 'Valves required under Paragraph 42.5 shall be located in a separate valve chamber.'; 42.64 'Covered wet wells shall have provisions for air displacement to the atmosphere, such as an inverted \"j\" tube'. Ontario's Design Guidelines for Sewage Works 7.2.5 Controls (ontario.ca): 'Float controls should be at least 300 mm (12 in) vertically and 450 mm (18 in) horizontally apart'.",
    run: function () { var r = pipe(this.input.block); return /Recommended Standards for Wastewater Facilities, 2014: 42\.52, 44\.4/.test(r.summary) ? "" : r.summary; } },
  { id: "F-33", harm: "low", input: { question: "Draw the plumbing for the sump pump in my basement", block: ['well "sump pit"', 'pump P1 "sump pump"', 'header "1.5 in discharge"'] },
    right: "A basement sump pump is not a wastewater pumping station: Lantern does not tell the person its valves belong in 'a vault of their own, out of the wet well (Recommended Standards for Wastewater Facilities, 2014: 42.52, 44.4)' -- or MAKE PIPING is not offered for it.",
    run: function () {
      var q = this.input.question, offered = H.L().aiAct.relevant(q).map(function (a) { return a.id; });
      if (offered.indexOf("piping") < 0) return "";
      var r = pipe(this.input.block, q); return r.ok && /vault of their own/.test(r.summary) ? "MAKE PIPING is offered, and the house sump is drawn with a valve vault beside the pit and told the wastewater standard (42.52, 44.4)" : "";
    } }
];
module.exports = cases;
