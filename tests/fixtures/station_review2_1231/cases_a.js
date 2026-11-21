// cases_a.js -- A: MAKE STATION blocks as models write them. Each block is built for its question; the judge simulates
// the control circuit drawn (sim.js: the lead float starts one pump, the off float stops it, the pumps take turns, the
// lag float runs both, the alarm float lights the alarm, an overload drops only its pump), checks each pump's check and
// shutoff valve, the float levels' order and heights, and that the drawings and the parts list name the same floats
// and pumps (lib.js stationRight). What is right, and why, is said in each case.
"use strict";
var H = require("./lib.js");
function S(id, harm, q, lines, right, o) {
  return H.C(id, harm, { question: q, block: H.sb(lines) }, right, function () { return H.stationRight(H.build(this.input.block, q), typeof o === "function" ? o() : o); });
}
// the problem a block goes back with, and whether the line it offers, copied as written, is drawn
function back(r) { return r && !r.ok ? (r.problems || []).join("; ") : ""; }
function lineIn(p) { var m = /like:?\s+(float [^]*?)(?:$|\.$)/.exec(p); return m ? m[1] : null; }
var Q = H.ADAM_Q, QA = H.Q_ANY, QS = H.Q_SEW;
var cases = [
  // ---- the guide's way, and the ways small models vary it ---------------------------------------------------
  S("A-01", "high", Q, ["pumps 2", "floats off lead lag alarm"], "The guide's own example: two pumps taking turns, off/lead/lag/alarm, every line read.", { pumps: 2, jobs: "off,lead,lag,alarm", views: "control,piping,levels", unreadNone: true }),
  S("A-02", "medium", Q, ["pumps: two", "floats: off, lead, lag, high level alarm"], "Colons, a count in words and commas: the same station.", { pumps: 2, jobs: "off,lead,lag,alarm", unreadNone: true }),
  S("A-03", "medium", Q, ["PUMPS 2", "FLOATS OFF LEAD LAG ALARM"], "Capitals: the same station.", { pumps: 2, jobs: "off,lead,lag,alarm", unreadNone: true }),
  S("A-04", "medium", Q, ["- pumps 2", "- floats off lead lag alarm"], "A list's bullets: the same station.", { pumps: 2, jobs: "off,lead,lag,alarm", unreadNone: true }),
  S("A-05", "medium", Q, ["1. pumps 2", "2) floats off lead lag alarm"], "A list's numbers: the same station.", { pumps: 2, jobs: "off,lead,lag,alarm", unreadNone: true }),
  S("A-06", "high", Q, ["pumps 2", "float FS1 \"off\" 2 ft", "float FS2 \"lead on\" 3 ft", "float FS3 \"lag on\" 4 ft", "float FS4 \"high level alarm\" 5 ft"], "The guide's float lines with heights: drawn to scale at 2, 3, 4, 5 ft.", { jobs: "off,lead,lag,alarm", heights: "2 ft,3 ft,4 ft,5 ft", unreadNone: true }),
  S("A-07", "medium", QS, ["pumps 2", "floats off 0.6 m, lead 0.9 m, lag 1.2 m, alarm 1.5 m"], "One line of floats in metres: each height with its float.", { heights: "0.6 m,0.9 m,1.2 m,1.5 m", unreadNone: true }),
  S("A-08", "medium", QS, ["pumps 2", "floats 2 ft off, 3 ft lead, 4 ft lag, 5 ft alarm"], "Heights written before their jobs: each with the job after it.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-09", "medium", QS, ["pumps 2", "floats off 24\", lead 36\", lag 48\", alarm 60\""], "Inch marks: inches, not quotes.", { heights: "24 in,36 in,48 in,60 in" }),
  S("A-10", "medium", QS, ["pumps 2", "floats off 2'0\", lead 3'6\", lag 4'6\", alarm 5'6\""], "Feet and inches: 3 ft 6 in.", { heights: "2 ft 0 in,3 ft 6 in,4 ft 6 in,5 ft 6 in" }),
  S("A-11", "low", QS, ["pumps 2", "floats off 600 mm, lead 3 ft, lag 1.2 m, alarm 60 in"], "Mixed units (0.6, 0.91, 1.2, 1.52 m): rising, drawn to scale, each as written (the 286 mm gap said).", { heights: "600 mm,3 ft,1.2 m,60 in" }),
  S("A-12", "medium", QS, ["pumps 2", "floats all pumps off 2 ft, lead pump on 3 ft, lag pump on 4 ft, high level alarm 5 ft"],
    "A right station in a model's plain words ('lead pump on 3 ft, lag pump on 4 ft'): off 2, lead 3, lag 4, alarm 5. It must not go back: nothing in it is wrong.", { jobs: "off,lead,lag,alarm", heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-13", "low", QS, ["pumps 2", "floats lead pump on, lag pump on, all pumps off, high level alarm"], "The same words with no heights, out of order: sorted, off/lead/lag/alarm.", { jobs: "off,lead,lag,alarm" }),
  S("A-14", "medium", QS, ["pumps 2", "FS1 off 2 ft", "FS2 lead on 3 ft", "FS3 lag on 4 ft", "FS4 high level alarm 5 ft"],
    "Floats written tag first, a line each (as MAKE LEVELS and MAKE CONTROL read 'FS1: off'): the four floats at their heights. Dropping them as unread loses the heights the question's answer gave.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-15", "medium", QS, ["pumps 2", "FS1: off float at 2 ft", "FS2: lead on float at 3 ft", "FS3: lag on float at 4 ft", "FS4: high level alarm at 5 ft"],
    "MAKE LEVELS' own 'FS1: off float at 2 ft' form (the station's grammar lets a tag-first line through): read, with heights.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-16", "medium", QS, ["pumps 2", "float off FS1 2 ft", "float lead on FS2 3 ft", "float lag on FS3 4 ft", "float high level alarm FS4 5 ft"], "A float's job before its tag: the same floats.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-17", "medium", QS, ["pumps 2", "float FS1 off 2 ft", "float FS2 lead on 3 ft", "float FS3 lag on 4 ft", "float FS4 high level alarm 5 ft"], "Jobs without quotes: the same floats.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-18", "low", QS, ["pumps 2", "float FS1 = off @ 2'", "float FS2 = lead on @ 3'", "float FS3 = lag on @ 4'", "float FS4 = high level alarm @ 5'"], "'=' and '@' and feet marks: the same floats.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-19", "medium", QS, ["pumps 2", "float LSL1 \"off\"", "float LSH1 \"lead on\"", "float LSHH1 \"high level alarm\""], "ISA tags, kept: off LSL1, lead LSH1, alarm LSHH1, no lag (said).",
    function () { return { jobs: "off,lead,alarm", check: function (p) { return H.fids(p) === "LSH1,LSHH1,LSL1" ? "" : "tags " + H.fids(p); } }; }),
  S("A-20", "medium", QS, ["pumps 2", "floats stop, start, alarm"], "stop/start/alarm: off, lead on, alarm; no lag float.", { jobs: "off,lead,alarm" }),
  S("A-21", "medium", QS, ["pumps 2", "floats low level, high level, high level alarm"], "A sump's low and high level floats with an alarm: low level stops, high level starts, the alarm above.", { jobs: "off,lead,alarm" }),
  S("A-22", "medium", QS, ["pumps 2", "floats off lead lag alarm high high alarm"], "Two alarms (high level and high high): five floats, each alarm its own light (alarm at 4 lights one, high high at 5 the other).",
    { jobs: "off,lead,lag,alarm,alarm", check: function (p) {
      var c = H.ctl(p), a1 = p.spec.floats[3].id, a2 = p.spec.floats[4].id, l1 = H.litBy(c, "lamp", a1), l2 = H.litBy(c, "lamp", a2);
      return l1.length === 1 && l2.length === 1 && l1[0] !== l2[0] ? "" : "alarm lights " + l1 + " / " + l2; } }),
  S("A-23", "medium", QS, ["pumps 2", "floats low level alarm, off, lead, lag, high level alarm"], "A low level alarm under the off float: five floats; its light on while the water is below it.",
    { jobs: "low,off,lead,lag,alarm", check: function (p) { var c = H.ctl(p), lo = p.spec.floats[0].id, ll = H.outsOf(c, "lamp").filter(function (g) { return H.contactsOf(g).some(function (e) { return e.id === lo && e.nc; }); }); return ll.length ? "" : "no low level light lit below " + lo; } }),
  S("A-24", "low", QS, ["pumps 2", "floats off, lead, lag off, lag on, alarm"], "A lag pump's own off float ('lag off'), as MAKE CONTROL has it: five floats, the lag call held to it. Dropping it silently draws another station.",
    { jobs: "off,off,lead,lag,alarm" }),
  // ---- the count of pumps ------------------------------------------------------------------------------------
  S("A-25", "medium", QA, ["pumps 1 duty + 1 standby"], "One duty and one standby: two pumps.", { pumps: 2 }),
  S("A-26", "medium", QA, ["pumps 2 x 15 HP"], "Two pumps of 15 HP.", { pumps: 2 }),
  S("A-27", "medium", QA, ["pumps 2x 15 HP", "floats off lead lag alarm"], "'2x 15 HP' is two pumps of 15 HP (the way a schedule writes it). Read as 15 pumps, nothing but the float levels is drawn, for a station of 15 pumps.", { pumps: 2 }),
  S("A-27b", "high", QA, ["pumps 3x 2 HP", "floats off lead lag alarm"], "'3x 2 HP' is three pumps of 2 HP: a triplex (piping and levels, the control said to be the panel maker's). Read as 2 pumps, a duplex is drawn whole and nothing is said: a wrong station that looks right.", { pumps: 3 }),
  S("A-28", "medium", QA, ["3 pumps"], "'3 pumps' (number first, natural English) is three: a triplex (piping and levels; the control left, said). Lantern must not say 'the block did not say'.", { pumps: 3 }),
  S("A-29", "low", QA, ["Number of pumps: 2", "floats off lead lag alarm"], "'Number of pumps: 2'.", { pumps: 2, unreadNone: true }),
  S("A-30", "low", QA, ["pump P1 \"pump 1\"", "pump P2 \"pump 2\""], "A pump line each: two.", { pumps: 2 }),
  S("A-31", "low", QA, ["duplex", "floats off lead lag alarm"], "'duplex' on a line: two.", { pumps: 2 }),
  S("A-32", "low", QA, ["pumps 2 duty 1 standby"], "Two duty and one standby: three (piping and levels).", { pumps: 3, views: "piping,levels" }),
  S("A-33", "low", QA, ["pumps: 2 @ 50 gpm", "floats off lead lag alarm"], "The first number is the count; the flow is not.", { pumps: 2 }),
  S("A-34", "medium", QA, ["pumps 2 rated 200 gpm at 50 ft TDH", "floats off lead lag alarm"], "The flow and head are not the count.", { pumps: 2 }),
  H.C("A-35", "medium", { question: QA, block: "MAKE STATION: Triplex lift station\nEND" }, "An empty block titled triplex: three pumps, as the title says.",
    function () { return H.stationRight(H.build(this.input.block, QA), { pumps: 3, views: "piping,levels" }); }),
  S("A-36", "high", H.Q_SIMPLEX, [], "A simplex sump with nothing written: one pump, off/pump on/alarm; the pump starts at its on float, holds to the off float; the alarm light at the alarm float.", { pumps: 1, jobs: "off,lead,alarm" }),
  S("A-37", "medium", H.Q_SIMPLEX, ["pumps 1", "floats off lead lag alarm"], "One pump has no lag pump: the lag float left out, and said.", { pumps: 1, jobs: "off,lead,alarm", check: function (p) { return /one pump has no lag pump/.test(H.said(p)) ? "" : "not said"; } }),
  S("A-38", "medium", H.Q_TRIPLEX, ["pumps 3", "floats off lead lag alarm"], "Three pumps: piping and levels drawn, the control said to be the panel maker's.", { pumps: 3, views: "piping,levels" }),
  S("A-39", "low", QA, ["pumps 4"], "Four pumps: piping (Lantern pipes four) and levels.", { pumps: 4, views: "piping,levels" }),
  S("A-40", "low", QA, ["pumps 6"], "Six pumps: the float levels only, the rest said.", { pumps: 6, views: "levels" }),
  // ---- the well, the inlet, the main, the valves, the supply --------------------------------------------------
  S("A-41", "medium", QS, ["pumps 2", "well \"wet well\" 12 ft", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft"], "The well 12 ft deep: in the parts list and the levels.",
    { check: function (p) { return /12 ft/.test(H.partRow(p, /^Wet well/)[0].item) ? "" : "parts list: " + H.partRow(p, /^Wet well/)[0].item; } }),
  S("A-42", "low", QS, ["pumps 2", "wet well 8 ft diameter, 15 ft deep", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft"], "The depth after the diameter: 15 ft.",
    { check: function (p) { return /15 ft/.test(H.partRow(p, /^Wet well/)[0].item) ? "" : "parts list: " + H.partRow(p, /^Wet well/)[0].item; } }),
  S("A-43", "low", QS, ["pumps 2", "wet well: 8' x 8' x 12' deep", "floats off lead lag alarm"], "8' x 8' x 12' deep is 12 ft deep, not 8.",
    { check: function (p) { return /12 ft/.test(H.partRow(p, /^Wet well/)[0].item) ? "" : "parts list: " + H.partRow(p, /^Wet well/)[0].item; } }),
  S("A-44", "medium", QS, ["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft", "inlet \"8 in gravity sewer\" 6.5 ft"], "The inlet labelled, its invert at 6.5 ft above the alarm: nothing to warn of.",
    { check: function (p) { var lv = p.views.levels; return lv.inlet && lv.inlet.height === "6.5 ft" && !lv.said.length && p.views.piping.inlets.join() === "8 in gravity sewer" ? "" : JSON.stringify([lv.inlet, lv.said, p.views.piping.inlets]); } }),
  S("A-45", "medium", QS, ["pumps 2", "floats off 2', lead 3', lag 4', alarm 5'", "inlet 8\" at 6'"], "'inlet 8\" at 6’': an 8 in pipe whose invert is at 6 ft (above the alarm). Read as an invert at 8 in, the levels warn three times that the inlet fills before the pumps start, which is false.",
    { check: function (p) { var lv = p.views.levels; return lv.inlet && lv.inlet.height === "6 ft" && !lv.said.length ? "" : "inlet " + JSON.stringify(lv.inlet) + " said " + lv.said.join(" | "); } }),
  S("A-46", "low", QS, ["pumps 2", "floats off 0.6 m, lead 0.9 m, lag 1.2 m, alarm 1.5 m", "inlet 200 mm sewer at 1.8 m"], "A 200 mm sewer whose invert is at 1.8 m.",
    { check: function (p) { var lv = p.views.levels; return lv.inlet && lv.inlet.height === "1.8 m" && !lv.said.length ? "" : JSON.stringify([lv.inlet, lv.said]); } }),
  S("A-47", "low", QS, ["pumps 2", "main \"4 in force main\""], "The force main named.", { check: function (p) { return p.views.piping.main === "4 in force main" ? "" : p.views.piping.main; } }),
  S("A-48", "low", QS, ["pumps 2", "force main 4 in DIP"], "A force main by size and material: '4 in DIP force main'.", { check: function (p) { return /4 in DIP/.test(p.views.piping.main) ? "" : p.views.piping.main; } }),
  S("A-49", "low", QS, ["pumps 2", "floats off lead lag alarm", "main breaker 60 A"], "'main breaker 60 A' is the panel's breaker, not the force main: the force main stays 'force main' (the line unread, or the breaker in the parts list).",
    { check: function (p) { return /breaker/i.test(p.views.piping.main || "") ? "the force main is labelled “" + p.views.piping.main + "”" : ""; } }),
  S("A-50", "low", QS, ["pumps 2", "valves plug"], "Plug valves on each pump.", { check: function (p) { return p.views.piping.pumps.every(function (x) { return x.valveKind === "plug"; }) ? "" : "valves " + p.views.piping.pumps.map(function (x) { return x.valveKind; }); } }),
  S("A-51", "low", QS, ["pumps 2", "shut-off valves: eccentric plug"], "Eccentric plug valves.", { check: function (p) { return p.views.piping.pumps.every(function (x) { return /plug/.test(x.valveKind); }) ? "" : "valves " + p.views.piping.pumps.map(function (x) { return x.valveKind; }); } }),
  S("A-52", "low", QS, ["pumps 2", "check valves swing"], "Swing check valves, in the parts list.", { check: function (p) { return /swing/.test(H.partRow(p, /^Check valve/)[0].item) ? "" : H.partRow(p, /^Check valve/)[0].item; } }),
  S("A-53", "low", QS, ["pumps 2", "supply \"120 V AC\""], "The control voltage on the ladder.", { check: function (p) { return H.ctl(p).rails[0] === "120 V AC" ? "" : H.ctl(p).rails[0]; } }),
  S("A-54", "low", QS, ["pumps 2", "control voltage 24 V DC"], "24 V DC control.", { check: function (p) { return /24 V DC/.test(H.ctl(p).rails[0]) ? "" : H.ctl(p).rails[0]; } }),
  S("A-55", "medium", QS, ["pumps 2", "floats off lead lag alarm", "power 480 V 3 phase"],
    "'power 480 V 3 phase' is the pumps' power, not the control circuit's: the ladder must not be labelled 480 V 3 phase (a control circuit is not three phase). Unread, or a part of its own, is right.",
    { check: function (p) { return /480|phase/i.test(H.ctl(p).rails[0]) ? "the ladder's rails are labelled “" + H.ctl(p).rails[0] + "”" : ""; } }),
  S("A-56", "low", QS, ["pumps 2", "floats off lead lag alarm", "voltage: 480 V 3 phase, control 120 V"], "The control voltage is the 120 V named as control.",
    { check: function (p) { return H.ctl(p).rails[0] === "120 V" || /^120 V/.test(H.ctl(p).rails[0]) ? "" : "rails “" + H.ctl(p).rails[0] + "”"; } }),
  // ---- the alarm, the lights, the horn ------------------------------------------------------------------------
  S("A-57", "medium", QS, ["pumps 2", "floats off lead lag alarm", "alarm horn"], "A horn on the high level alarm, as well as its light.",
    { check: function (p) { var c = H.ctl(p); return H.litBy(c, "horn", p.spec.floats[3].id).length ? "" : "no horn"; } }),
  S("A-58", "low", QS, ["pumps 2", "floats off lead lag alarm", "high level alarm horn and light"], "'high level alarm horn and light': a horn on the alarm float (the line names one).",
    { check: function (p) { var c = H.ctl(p); return H.litBy(c, "horn", p.spec.floats[3].id).length ? "" : "no horn drawn; the line unread: " + p.unread.join(" / "); } }),
  S("A-59", "medium", QS, ["pumps 2", "floats off lead lag", "alarm high level float"], "The alarm written on a line of its own: a high level alarm float. Lantern must not draw none and say 'the block has none'.",
    { jobs: "off,lead,lag,alarm" }),
  S("A-60", "low", QS, ["pumps 2", "floats off lead lag alarm", "low level alarm float 1 ft"], "A low level alarm float on its own line: drawn under the off float (or, unread, at least not said to be absent).",
    { jobs: "low,off,lead,lag,alarm" }),
  S("A-61", "low", QS, ["pumps 2", "floats off lead lag alarm", "lights none"], "No pilot lights asked for: no run lights, and not said to be added.",
    { check: function (p) { var c = H.ctl(p); return H.outsOf(c, "lamp").some(function (g) { return /run/.test(g.out.label); }) || /run light/.test(H.said(p)) ? "run lights drawn or said" : ""; } }),
  S("A-62", "medium", QS, ["floats pumps off, pump 1 on, pump 2 on, high level alarm"], "'pump 2 on' is the second pump's float, the lag (as MAKE CONTROL reads it): off/lead/lag/alarm. Read as a second lead float, the lag is lost silently and both pumps never run together.",
    { jobs: "off,lead,lag,alarm" }),
  // ---- prose, guides and odd lines ------------------------------------------------------------------------
  S("A-63", "medium", QS, ["This is a duplex lift station with two pumps.", "pumps 2", "floats off lead lag alarm"], "A sentence of prose in the block: said as unread, the station drawn.", { pumps: 2, jobs: "off,lead,lag,alarm" }),
  S("A-64", "low", QS, ["pumps 2", "Pumps alternate on each cycle so they wear evenly.", "floats off lead lag alarm"], "Prose that begins with a line's word: still two pumps.", { pumps: 2 }),
  S("A-65", "low", QS, ["pumps 2", "floats off lead lag alarm", "note Pumps are 10 HP each"], "A note kept.", { check: function (p) { return p.notes.join() === "Pumps are 10 HP each" ? "" : JSON.stringify(p.notes); } }),
  S("A-66", "low", QS, ["pumps 2", "show: control circuit, plumbing, float levels"], "A show line naming all three: all three.", { views: "control,piping,levels" }),
  S("A-67", "low", QA, ["pumps 2", "show float levels"], "A show line naming one: that one.", { views: "levels" }),
  S("A-68", "medium", QS, ["pumps 2", "floats off el. 100.0 ft, lead el. 101.0 ft, lag el. 102.0 ft, alarm el. 103.0 ft"], "Elevations: drawn as elevations, the floor placed and said.", { heights: "el. 100.0 ft,el. 101.0 ft,el. 102.0 ft,el. 103.0 ft" }),
  S("A-69", "medium", QS, ["pumps 2", "well \"wet well\" 12 ft deep", "floats off 10 ft below grade, lead 9 ft below grade, lag 8 ft below grade, alarm 7 ft below grade"], "Depths below grade: the off float deepest.", { jobs: "off,lead,lag,alarm" }),
  S("A-70", "low", QS, ["pumps 2", "floats: off (2 ft), lead (3 ft), lag (4 ft), alarm (5 ft)"], "Heights in brackets.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  S("A-71", "low", QS, ["pumps 2", "floats off=2ft lead=3ft lag=4ft alarm=5ft"], "Heights with '=' and no space.", { heights: "2 ft,3 ft,4 ft,5 ft" }),
  // ---- what goes back, and the line it goes back with (rule 3: the line for THIS question, which, copied, is drawn) ----
  H.C("A-72", "medium", { question: QS, block: H.sb(["pumps 2", "floats off 2 ft, lead, lag, alarm 5 ft"]) },
    "Heights for two floats of four: back once (heights for all or none), with a line that, copied as written, is drawn (lead and lag at different heights between 2 and 5 ft).",
    function () {
      var r = H.build(this.input.block, QS), pr = back(r);
      if (!pr) return "not sent back";
      var ln = lineIn(pr); if (!ln) return "no line to write: " + pr;
      var r2 = H.build(H.sb(["pumps 2"].concat(ln.split(/,\s*(?=float )/))), QS);
      return r2.ok ? "" : "the line offered (" + ln + "), copied, goes back again: " + back(r2);
    }),
  H.C("A-73", "medium", { question: QS, block: H.sb(["pumps 2", "floats off 2.0, lead 3.0, lag 4.0, alarm 5.0 ft"]) },
    "Numbers with the unit once at the end ('2.0, 3.0, 4.0, 5.0 ft'): read as feet, or back once with a line that gives each its unit. A line that leaves three heights out sends it back again.",
    function () {
      var r = H.build(this.input.block, QS);
      if (r.ok) { var lv = H.plan(r).views.levels; return lv && lv.scaled ? "" : "drawn without the heights"; }
      var pr = back(r), ln = lineIn(pr);
      if (!ln) return "no line to write: " + pr;
      var r2 = H.build(H.sb(["pumps 2"].concat(ln.split(/,\s*(?=float )/))), QS);
      return r2.ok && H.plan(r2).views.levels.scaled ? "" : "the line offered (" + ln + "), copied, is not drawn to scale: " + back(r2);
    }),
  H.C("A-74", "low", { question: QS, block: H.sb(["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft", "float FS2 \"lead on\" 3.5 ft"]) },
    "Two heights for the lead float (3 and 3.5 ft): back once naming the lead float by its own tag (FS2), not FS1, the off float's.",
    function () { var pr = back(H.build(this.input.block, QS)); return !pr ? "not sent back" : /FS1 \x22lead on\x22/.test(pr) ? "the line to write tags the lead float FS1 (the off float's tag): " + pr : ""; }),
  H.C("A-75", "medium", { question: QS, block: H.sb(["pumps 2", "floats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft"]) },
    "Off above lead: back once, naming FS2 at 3 ft against FS1 at 4 ft, with a height to give.",
    function () { var pr = back(H.build(this.input.block, QS)); return /FS2 \(lead on\) at 3 ft is not above FS1 \(off\) at 4 ft/.test(pr) ? "" : "problem: " + pr; }),
  H.C("A-76", "medium", { question: QS, block: H.sb(["pumps 2", "float FS1 \"off\"", "float FS2 \"pump\""]) },
    "A float that says no job: back once with a line naming its job (lead on: the off float is there and no other starts the pumps).",
    function () { var pr = back(H.build(this.input.block, QS)); return /float FS2 \x22lead on\x22/.test(pr) ? "" : "problem: " + pr; }),
  S("A-78", "low", QS, ["pumps 2", "floats off lead lag alarm", "Power: if the power fails the alarm dials out on a 12 V battery"],
    "A sentence that begins 'Power:' (the grammar lets it through, GS-36) is not the control voltage: the ladder's rails must not carry the sentence.",
    { check: function (p) { return /power fails|battery/.test(H.ctl(p).rails[0]) ? "the ladder's rails are labelled \u201c" + H.ctl(p).rails[0] + "\u201d" : ""; } }),
  S("A-79", "medium", QS, ["pumps 2", "float FS1 \x22pump stop\x22", "float FS2 \x22pump start\x22", "float FS3 \x222nd pump start\x22", "float FS4 \x22high water\x22"],
    "Floats named the plain way ('pump stop', 'pump start', '2nd pump start', 'high water'), no heights: off/lead/lag/alarm, drawn in order. Nothing in it is wrong; it must not go back for heights it never gave.",
    { jobs: "off,lead,lag,alarm" }),
  H.C("A-80", "low", { question: QS, block: H.sb(["pumps 2", "float FS1 \x22bottom\x22", "float FS2 \x22middle\x22", "float FS3 \x22top\x22"]) },
    "Bottom, middle and top floats of a duplex: off, lead, lag from the bottom up. If 'middle' must go back, the line offered must keep the floats in the order written: 'middle' made the lag above a 'top' read as the lead turns the two over.",
    function () {
      var r = H.build(this.input.block, QS);
      if (r.ok) { var lv = H.plan(r).views.levels.floats.map(function (f) { return f.id; }).join(); return lv === "FS1,FS2,FS3" ? "" : "drawn from the bottom up " + lv; }
      var m = /like: float FS2 \x22([^\x22]+)\x22/.exec(back(r)); if (!m) return "no line: " + back(r);
      var r2 = H.build(H.sb(["pumps 2", "float FS1 \x22bottom\x22", "float FS2 \x22" + m[1] + "\x22", "float FS3 \x22top\x22"]), QS);
      var lv2 = r2.ok ? H.plan(r2).views.levels.floats.map(function (f) { return f.id; }).join() : "";
      return lv2 === "FS1,FS2,FS3" ? "" : "the line offered (float FS2 \x22" + m[1] + "\x22), copied, draws from the bottom up " + (lv2 || back(r2)) + ": the top float below the middle one";
    }),
  S("A-81", "high", QA, ["pumps one duty, one standby", "floats off lead lag alarm"],
    "'one duty, one standby' is two pumps. Read as one, a simplex is drawn (its lag float dropped 'one pump has no lag pump'): a wrong station that looks deliberate.", { pumps: 2 }),
  S("A-77", "low", QS, ["pumps 2", "floats: off, lead, lag, alarm", "float FS3 \"lag on\" ", ""], "Blank and trailing-space lines: nothing changes.", { jobs: "off,lead,lag,alarm" })
];
module.exports = cases;
