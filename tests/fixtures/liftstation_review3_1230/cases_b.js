// cases_b.js -- B: what small models write after seeing the instructions (the example copied with one change, missing
// quotes, prose around the block, wrong block kind, "float FS1 = off", "FS1: off float", "Float 1 (off)", "2ft", "2'",
// "el 101.5" ...). Each is drawn right (simulated, or its heights checked), or goes back once with a line that is right
// for THIS block.
"use strict";
var H = require("./lib.js");
var run35 = require("../liftstation_1230/run_35b.json");
var CQ = "Draw the control circuit for a typical 2 pump lift station with an alternating relay";
var LQ = "Draw the float level positions in the wet well of a duplex lift station";
var PQ = "Draw the plumbing schematic for a duplex sewage lift station";
var F4 = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"'];
var P2 = ['alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'];
var EX = ['supply "120 V AC"'].concat(F4, P2, ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red']);
var STD = { floats: { off: "FS1", lead: "FS2", lag: "FS3", alarm: "FS4" }, pumps: ["M1", "M2"] };
function spec(o) { var s = JSON.parse(JSON.stringify(STD)); Object.keys(o || {}).forEach(function (k) { s[k] = o[k]; }); return s; }
function alarmsOf(r, fl) {
  return H.rungs(r).filter(function (g) { return /^(lamp|horn)$/.test(g.out.kind) && [].concat.apply(g.series, g.branches || []).some(function (e) { return e.kind === "float" && e.id === fl; }); }).map(function (g) { return g.out.id; });
}
function olsOf(r, pumps) { var m = {}; pumps.forEach(function (p) { var g = H.rung(r, p); (g ? g.after : []).forEach(function (e) { if (e.kind === "ol" && e.nc) m[e.id] = p; }); }); return m; }
// a duplex drawn and simulated
function duplex(r, s) {
  if (!r) return "no block read";
  if (!r.ok) return "not drawn: " + r.problems.join("; ");
  s = s || spec();
  if (!s.alarms && s.floats.alarm) s.alarms = alarmsOf(r, s.floats.alarm);
  if (!s.ols) s.ols = olsOf(r, s.pumps);
  var p = H.sim.duplex(r.plan.circuit, s);
  return p.length ? "the circuit does not work: " + p.join("; ") : "";
}
function ctl(lines, q) { return H.L().aiAct.build(H.ctl(lines, "Duplex pump station"), q || CQ); }
function D(id, harm, lines, right, extra, s) {
  return { id: id, harm: harm, input: { question: CQ, block: lines }, right: right,
    run: function () { var r = ctl(lines); return duplex(r, s) || (extra ? extra(r) : ""); } };
}
// back once: not drawn, and the problems hold a line that is right for this block (want: a regex the problems must match;
// never: a regex they must not match)
function back(r, want, never) {
  if (!r) return "no block read";
  if (r.ok) return "drawn: " + H.sig(r).replace(/\n/g, " / ");
  var p = r.problems.join(" ;; ");
  if (never && never.test(p)) return "went back with a line that is wrong for this block: " + p;
  if (want && !want.test(p)) return "went back without the line for this block: " + p;
  return "";
}
function lev(lines, q) { return H.L().aiAct.build(H.blk("LEVELS", "Wet well", lines), q || LQ); }
function pipe(lines, q) { return H.L().aiAct.build(H.blk("PIPING", "Lift station", lines), q || PQ); }
// the levels plan's heights, in metres, by float id
function hs(r) { var m = {}; (r && r.plan && r.plan.floats || []).forEach(function (f) { m[f.id] = f.m == null ? null : Math.round(f.m * 1000) / 1000; }); return m; }
function heights(r, want) {
  if (!r) return "no block read";
  if (!r.ok) return "not drawn: " + r.problems.join("; ");
  if (!r.plan.scaled) return "drawn not to scale (the heights written were not read)";
  var h = hs(r), bad = Object.keys(want).filter(function (k) { return h[k] == null || Math.abs(h[k] - want[k]) > 0.002; });
  return bad.length ? "heights read: " + JSON.stringify(h) + " (want " + JSON.stringify(want) + ")" : "";
}
var FT = function (x) { return Math.round(x * 0.3048 * 1000) / 1000; };
var W2345 = { FS1: FT(2), FS2: FT(3), FS3: FT(4), FS4: FT(5) };
function L(id, harm, lines, right, judge) { return { id: id, harm: harm, input: { question: LQ, block: lines }, right: right, run: function () { return judge(lev(lines)); } }; }
function P(id, harm, lines, right, judge, q) { return { id: id, harm: harm, input: { question: q || PQ, block: lines }, right: right, run: function () { return judge(pipe(lines, q)); } }; }
function labelsClean(r) {
  // the floats' labels as drawn carry no list numbers or stray height digits
  var said = H.said(r), m = said.match(/FS\d \((?:off|lead on|lag on|high level alarm) \d+\)/g);
  return m ? "the floats' labels carry a number from outside the quotes: " + m.join(", ") : "";
}

var cases = [
  D("B-01", "high", EX, "The instructions' example as it stands: drawn, alternates, lag runs both, alarm, overloads."),
  { id: "B-02", harm: "medium", input: { question: CQ, block: EX.filter(function (l) { return !/^float FS4/.test(l); }) },
    right: "The example with the alarm float's line left out, its light kept (lamp LT3 FS4 \"high level\"): FS4 is plainly the high level alarm float. Right: Lantern adds it and says so, or the line back is float FS4 \"high level alarm\" -- never \"coil FS4\" or \"limit FS4 LT3\".",
    run: function () { var r = ctl(this.input.block); if (r && r.ok) return duplex(r); return back(r, /float FS4/, /coil FS4|limit FS4/); } },
  D("B-03", "high", ['float FS1 off', 'float FS2 lead on', 'float FS3 lag on', 'float FS4 high level alarm'].concat(P2), "No quotes: the jobs read from the words."),
  D("B-04", "high", ['float FS1 = off', 'float FS2 = lead on', 'float FS3 = lag on', 'float FS4 = high level alarm'].concat(P2), "\"float FS1 = off\": read."),
  D("B-05", "high", ['FS1: off float', 'FS2: lead on float', 'FS3: lag on float', 'FS4: high level alarm float'].concat(P2), "\"FS1: off float\": read."),
  { id: "B-06", harm: "medium", input: { question: CQ, block: ['Float 1 (off)', 'Float 2 (lead on)', 'Float 3 (lag on)', 'Float 4 (high level alarm)'].concat(P2) },
    right: "\"Float 1 (off)\": drawn, or back once with the line naming FS1..FS4 by these jobs in this order.",
    run: function () { var r = ctl(this.input.block); if (r && r.ok) return duplex(r); return back(r, /float FS1 "off", float FS2 "lead on", float FS3 "lag on", float FS4 "high level alarm"/); } },
  D("B-07", "medium", ['float FS1 "pumps off" 2ft', 'float FS2 "lead pump on" 3ft', 'float FS3 "lag pump on" 4ft', 'float FS4 "high water alarm" 5ft'].concat(P2), "Heights in a control block: ignored for the wiring; drawn."),
  D("B-08", "medium", ['- float FS1 "off"', '- float FS2 "lead on"', '- float FS3 "lag on"', '- float FS4 "high level alarm"', '- alternator AR M1 M2', '- coil M1 "pump 1 starter"', '- coil M2 "pump 2 starter"'], "Bulleted lines: read."),
  D("B-09", "low", ['1. float FS1 "off"', '2. float FS2 "lead on"', '3. float FS3 "lag on"', '4. float FS4 "high level alarm"', '5. alternator AR M1 M2', '6. coil M1 "pump 1 starter"', '7. coil M2 "pump 2 starter"'],
    "Numbered lines: drawn, and the list's numbers are not taken into the floats' labels (\"FS2 (lead on 2)\" is drawn under the float and said).", labelsClean),
  D("B-10", "high", F4.concat(['alternator AR P1 P2', 'coil P1 "pump 1 starter"', 'coil P2 "pump 2 starter"']), "Pumps tagged P1 P2: drawn.", null, spec({ pumps: ["P1", "P2"] })),
  D("B-11", "high", F4.concat(['alternator AR', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']), "An alternator naming no pumps: the two starters."),
  D("B-12", "high", ['float FS1 "stop"', 'float FS2 "start"', 'float FS3 "alarm"', 'alternator AR M1 M2', 'starter M1 "pump 1"', 'starter M2 "pump 2"'],
    "stop/start/alarm floats, no lag: one pump at a time, alternating, and the missing lag float said.",
    function (r) { return /no lag float/.test(H.said(r)) ? "" : "no lag float not said"; }, spec({ floats: { off: "FS1", lead: "FS2", alarm: "FS3" } })),
  { id: "B-13", harm: "high", input: { question: CQ, reply: "Sure! Here is the control circuit:\n\n" + H.ctl(EX, "Duplex") + "\n\nThe alternating relay swaps the lead pump each cycle." },
    right: "Prose before and after the block: the block is drawn.", run: function () { return duplex(H.L().aiAct.build(this.input.reply, CQ)); } },
  { id: "B-14", harm: "medium", input: { question: CQ, reply: "```\n" + H.ctl(EX, "Duplex") + "\n```" }, right: "The block in a code fence: drawn.",
    run: function () { return duplex(H.L().aiAct.build(this.input.reply, CQ)); } },
  { id: "B-15", harm: "high", input: { question: CQ, reply: H.blk("SCHEMATIC", "Duplex", EX) }, right: "MAKE SCHEMATIC with the control lines: drawn as the ladder.",
    run: function () { return duplex(H.L().aiAct.build(this.input.reply, CQ)); } },
  { id: "B-16", harm: "high", input: { question: CQ, reply: H.blk("CONTROL", "Duplex", F4.concat(['alternating AR M1 M2'], P2.slice(1))) }, right: "\"alternating AR M1 M2\" (the 35B's word): drawn.",
    run: function () { return duplex(H.L().aiAct.build(this.input.reply, CQ)); } },
  D("B-17", "high", F4.concat(['alternator relay AR M1 M2'], P2.slice(1)), "\"alternator relay AR M1 M2\": drawn."),
  D("B-18", "high", ['float fs1 "off"', 'float fs2 "lead on"', 'float fs3 "lag on"', 'float fs4 "high level alarm"', 'alternator ar m1 m2', 'coil m1 "pump 1 starter"', 'coil m2 "pump 2 starter"'], "Lower-case tags: drawn."),
  D("B-19", "medium", ['float FS1 "off" nc'].concat(F4.slice(1), P2), "The off float written nc: the usual duplex is drawn (the off float holds the call in while made)."),
  D("B-20", "high", F4.concat(['alternator AR K1 K2', 'contactor K1 "pump 1"', 'contactor K2 "pump 2"']), "IEC contactors K1 K2: drawn.", null, spec({ pumps: ["K1", "K2"] })),
  D("B-21", "medium", ['float FS1 "Float Switch 1 - pumps off"', 'float FS2 "Float Switch 2 - lead pump on"', 'float FS3 "Float Switch 3 - lag pump on"', 'float FS4 "Float Switch 4 - high water alarm"'].concat(P2), "Long labels: jobs read."),
  D("B-22", "high", ['float FS1 M1 M2 "off"', 'float FS2 M1 "lead on"', 'float FS3 M2 "lag on"', 'float FS4 "high level alarm"'].concat(P2), "Floats written on the pumps: wired through the calls, said.",
    function (r) { return /call the pumps through/.test(H.said(r)) ? "" : "not said"; }),
  D("B-23", "high", ['float FS1 "off"', 'float FS2 "lead"', 'float FS3 "lag"', 'float FS4 "alarm"', 'alternator AR M1 M2', 'coil M1', 'coil M2'], "One-word jobs, coils with no labels: drawn."),
  D("B-24", "high", ['float FS1 "stop pumps"', 'float FS2 "start lead pump"', 'float FS3 "start lag pump"', 'float FS4 "high water alarm"'].concat(P2), "Verb-first labels: drawn."),
  D("B-25", "high", ['float FS1 "all pumps off"', 'float FS2 "pump 1 on"', 'float FS3 "pump 2 on"', 'float FS4 "overflow alarm"'].concat(P2), "\"pump 1 on\"/\"pump 2 on\": lead and lag."),
  D("B-26", "high", F4.concat(P2, ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 AR "alarm" red']),
    "An alarm light written on the alternator: moved to the alarm float, said.", function (r) { return /LT3 \(alarm\) is lit by the alarm float FS4, not by AR/.test(H.said(r)) ? "" : "the move is not said"; },
    spec({ runLamps: { LT1: "M1", LT2: "M2" } })),
  D("B-27", "high", F4.concat(P2, ['overload OL1 M1', 'overload OL2 M2', 'lamp LT4 OL1 "pump 1 fault" red', 'lamp LT5 OL2 "pump 2 fault" red']),
    "Fault lights on the overloads: lit when each trips.", function (r) {
      var S = H.sim.make(r.plan.circuit, function () { return null; }); if (S.on("LT4")) return "LT4 lit before OL1 trips"; S.trip("OL1"); return S.on("LT4") && !S.on("LT5") ? "" : "LT4 not lit by OL1 tripping";
    }),
  { id: "B-28", harm: "high", input: { question: CQ, block: ['float FS0 LT4 nc "low level alarm"'].concat(F4, P2, ['lamp LT4 "low level alarm" amber', 'lamp LT3 FS4 "high level alarm" red']) },
    right: "A right low-level alarm (its NC float lights LT4 when the water falls below FS0) beside the duplex: left as written. LT4 must light below FS0 and never be put on the high level alarm float.",
    run: function () {
      var r = ctl(this.input.block); if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "");
      var g = H.rung(r, "LT4"), on = H.run(r, { FS0: 0.5, FS1: 1, FS2: 2, FS3: 3, FS4: 4 }, [0.2, 1.5, 4.5], ["LT4"]).join("");
      return on === "100" ? "" : "LT4 (low level alarm) lit " + on + " at 0.2/1.5/4.5 (want 100): its rung is " + g.series.map(function (e) { return e.id + (e.nc ? "/" : ""); }).join(" ") + " -- the high level alarm float FS4 was put in series with it, unsaid";
    } },
  { id: "B-29", harm: "medium", input: { question: CQ, block: ['float FS1 "low level alarm"', 'float FS2 "off"', 'float FS3 "lead on"', 'float FS4 "lag on"', 'float FS5 "high level alarm"'].concat(P2) },
    right: "A low-level alarm float with no light: Lantern adds its light (said), or the line back gives it one (lamp LT1 FS1 nc \"low level alarm\") -- never \"float FS1 CR1\", which puts it on the lead call relay Lantern makes.",
    run: function () { var r = ctl(this.input.block); if (r && r.ok) return ""; return back(r, /lamp/, /float FS1 CR1/); } },
  { id: "B-30", harm: "medium", input: { question: CQ, block: F4.concat(['coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"']) },
    right: "The question asks for an alternating relay; floats and two starters, no alternator: back once with the alternator line (Lantern wires the rest). Not with lines that put each float on M1 and start buttons on the pumps, which with the alternator give a block Lantern itself cannot draw (B-31).",
    run: function () { var r = ctl(this.input.block); if (r && r.ok) return "drawn"; var p = r.problems.join(" ;; "); return /alternator AR M1 M2/.test(p) && !/float FS\d: name the coil|start PB2 M/.test(p) ? "" : "went back with " + r.problems.length + " problems: " + p; } },
  { id: "B-31", harm: "medium", input: { question: CQ, block: ['supply "120 V AC"', 'stop PB1 M1', 'start PB2 M1'].concat(F4, P2) },
    right: "The example with the hint's own first two lines (stop PB1 M1, start PB2 M1) copied in: drawn (a manual start beside the duplex) or back once with the line to write (leave them out: with an alternator the floats start the pumps). Never Lantern's own failure with no line.",
    run: function () { var r = ctl(this.input.block); if (r && r.ok) return ""; var p = r.problems.join(" ;; "); return /could not draw this circuit correctly/.test(p) ? "went back with Lantern's own failure and no line to write: " + p : /PB2/.test(p) ? "" : "back: " + p; } },
  { id: "B-32", harm: "high", input: { question: CQ, reply: run35.replies[1].reply }, right: "The 35B's second reply (alternating AR M1 M2 \"alternating relay\", coil AR, LT3 AR \"alarm\"): drawn, alternates, alarm on FS3.",
    run: function () { return duplex(H.L().aiAct.build(this.input.reply, H.ADAM_Q), spec({ floats: { off: "FS2", lead: "FS1", alarm: "FS3" }, alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" } })); } },
  { id: "B-33", harm: "high", input: { question: CQ, reply: run35.replies[2].reply }, right: "The 35B's third reply (coil CR1 \"alternating relay\" switched by nothing): drawn as an alternating relay, said.",
    run: function () { var r = H.L().aiAct.build(this.input.reply, H.ADAM_Q); return duplex(r, spec({ floats: { off: "FS2", lead: "FS1", alarm: "FS3" }, alarms: ["LT3"], runLamps: { LT1: "M1", LT2: "M2" } })) || (/is drawn as an alternating relay/.test(H.said(r)) ? "" : "not said"); } },
  { id: "B-34", harm: "low", input: { question: CQ, block: ['float LSL "off"', 'float LSH "lead on"', 'float LSHH "high level alarm"'].concat(P2) },
    right: "ISA tags LSL, LSH, LSHH: drawn and working, under those tags (or the rename said). Four letters with no number (LSHH) are not taken as a tag.",
    run: function () {
      var r = ctl(this.input.block), d = duplex(r, spec({ floats: { off: "LSL", lead: "LSH", alarm: /\bLSHH\b/.test(H.sig(r)) ? "LSHH" : "FS1" } }));
      if (d) return d;
      return /\bLSHH\b/.test(H.sig(r)) || /LSHH/.test(H.said(r)) ? "" : "works, but LSHH is drawn and named FS1 ('" + H.said(r).split(" | ").filter(function (s) { return /alarm light/.test(s); })[0] + "'), with nothing said";
    } },
  D("B-35", "low", ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft'].concat(P2),
    "Heights copied from MAKE LEVELS into the control block: drawn; the label is not \"off 2\" (the number without its unit).", labelsClean),
  D("B-36", "low", F4.concat(P2, ['lamp LT3 FS4 "high level" red', 'horn AH1 "alarm horn"']),
    "A horn written with nothing switching it beside the alarm light: put on the alarm float -- and said.",
    function (r) { return /AH1/.test(H.said(r)) ? "" : "AH1 was wired to FS4 and nothing was said"; }),
  D("B-37", "high", F4.concat(P2, ['switch SS1 M1 "pump 1 auto"', 'switch SS2 M2 "pump 2 auto"', 'temp TS1 M1 nc "pump 1 high temp"', 'temp TS2 M2 nc "pump 2 high temp"']), "Auto switches and thermal cut-outs in each pump's rung: drawn."),
  { id: "B-38", harm: "high", input: { question: CQ, block: ['stop PB1', 'start PB2 CR9', 'coil CR9 "system on"'].concat(F4, ['alternator AR M1 M2', 'coil M1 CR9 "pump 1 starter"', 'coil M2 CR9 "pump 2 starter"']) },
    right: "A system on/off relay (start PB2, stop PB1) in each pump's rung: with the system on, the pumps alternate; off, none runs.",
    run: function () {
      var r = ctl(this.input.block); if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : "");
      var at = { FS1: 1, FS2: 2, FS3: 3, FS4: 4 }, S = H.sim.make(r.plan.circuit, function (id) { return at[id] == null ? null : at[id]; }), seq = [];
      function pumps() { return (S.on("M1") ? "1" : "") + (S.on("M2") ? "2" : "") || "-"; }
      S.set(2.5); seq.push(pumps());            // system off: none
      S.set(0.5); S.press("PB2"); S.press("PB2", false);
      [2.5, 0.5, 2.5, 0.5, 3.5, 0.5].forEach(function (w) { S.set(w); seq.push(pumps()); });
      var got = seq.join(" ");
      return /^- (1|2) - (2|1) - 12 -$/.test(got) && got.split(" ")[1] !== got.split(" ")[3] ? "" : "system off then on, fill and drain: " + got + " (want - 1 - 2 - 12 -)";
    } },

  // ---- MAKE LEVELS
  L("B-40", "high", ['well "wet well" 10 ft', 'pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS4 "high level alarm" 5.5 ft', 'inlet "inlet invert" 6.5 ft'],
    "The instructions' example: to scale.", function (r) { return heights(r, { FS1: FT(2), FS2: FT(3.5), FS3: FT(4.5), FS4: FT(5.5) }); }),
  L("B-41", "high", ['float FS1 off 2ft', 'float FS2 lead on 3ft', 'float FS3 lag on 4ft', 'float FS4 alarm 5ft'], "No quotes, \"2ft\": to scale.", function (r) { return heights(r, W2345); }),
  L("B-42", "high", ['float FS1 "off" 2\'', 'float FS2 "lead on" 3\'', 'float FS3 "lag on" 4\'', 'float FS4 "high level alarm" 5\''], "Feet as 2': to scale.", function (r) { return heights(r, W2345); }),
  L("B-43", "low", ['float FS1 "off" 2', 'float FS2 "lead on" 3', 'float FS3 "lag on" 4', 'float FS4 "high level alarm" 5'],
    "Heights with no unit: back once for the unit (float FS1 \"off\" 2 ft ...), or drawn in order with the numbers said to be unread. Not dropped while the note asks for heights the model gave.",
    function (r) { if (r && !r.ok) return /\b2 (ft|m)\b/.test(r.problems.join(" ")) ? "" : "back: " + r.problems.join("; "); return r.plan.scaled ? "" : /unit/.test(r.summary) ? "" : "the heights 2, 3, 4, 5 were dropped; the drawing says only 'Not to scale: give each float its height above the floor'"; }),
  L("B-44", "low", ['float FS1 "off" el 101.5', 'float FS2 "lead on" el 102.5', 'float FS3 "lag on" el 103.5', 'float FS4 "high level alarm" el 104.5'],
    "Elevations with no unit (el 101.5): back once for the unit, or said unread -- not dropped silently.",
    function (r) { if (r && !r.ok) return ""; return r.plan.scaled ? "" : /101\.5|unit|elevation/.test(r.summary) ? "" : "the elevations were dropped; drawn not to scale with 'give each float its height above the floor'"; }),
  L("B-45", "high", ['floor el. 100.0 ft', 'float FS1 "off" el. 101.5 ft', 'float FS2 "lead on" el. 102.5 ft', 'float FS3 "lag on" el. 103.5 ft', 'float FS4 "high level alarm" el. 104.5 ft'],
    "Elevations with the floor's: heights above the floor.", function (r) { return heights(r, { FS1: FT(1.5), FS2: FT(2.5), FS3: FT(3.5), FS4: FT(4.5) }); }),
  L("B-46", "high", ['float FS1 = off, 2 ft', 'float FS2 = lead on, 3 ft', 'float FS3 = lag on, 4 ft', 'float FS4 = high level alarm, 5 ft'], "\"= off, 2 ft\": to scale.", function (r) { return heights(r, W2345); }),
  L("B-47", "medium", ['FS1: off float at 2 ft', 'FS2: lead on float at 3 ft', 'FS3: lag on float at 4 ft', 'FS4: alarm float at 5 ft'],
    "\"FS1: off float at 2 ft\" (MAKE CONTROL reads this form): drawn, or back once with THIS block's numbers (float FS1 \"off\" 2 ft, float FS2 \"lead on\" 3 ft ...). Not the instructions' example heights 3.5, 4.5, 5.5 ft.",
    function (r) { if (r && r.ok) return heights(r, W2345); return back(r, /float FS2 "lead on" 3 ft/, /3\.5 ft/); }),
  L("B-48", "medium", ['Float 1 (off) 2 ft', 'Float 2 (lead on) 3 ft', 'Float 3 (lag on) 4 ft', 'Float 4 (high level alarm) 5 ft'], "\"Float 1 (off) 2 ft\": to scale.", function (r) { return heights(r, W2345); }),
  L("B-49", "medium", ['float FS1 "off" 0.6 m', 'float FS2 "lead on" 1.0 m', 'float FS3 "lag on"', 'float FS4 "high level alarm" 1.6 m'],
    "One height left out: back once naming FS3, with THIS block's heights and unit (metres) -- not the example's 2 ft, 3.5 ft, 4.5 ft, 5.5 ft, which a small model copies.",
    function (r) { return back(r, /FS3/, /3\.5 ft|5\.5 ft/); }),
  L("B-50", "medium", ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "lead on" 4 ft', 'float FS4 "high level alarm" 5 ft'],
    "Two lead floats (the upper one is the lag): back once with THIS block's heights (float FS3 \"lag on\" 4 ft), not the example's 3.5/4.5/5.5 ft.",
    function (r) { return back(r, /FS3 "lag on" 4 ft/, /3\.5 ft|4\.5 ft|5\.5 ft/); }),
  L("B-51", "high", ['float FS1 "off" 2 ft', 'float FS2 "lead on" 1.5 ft', 'float FS3 "lag on" 4 ft', 'float FS4 "high level alarm" 5 ft'],
    "Lead under off: back once, naming FS2 and the height it must be above.", function (r) { return back(r, /FS2.*above 2 ft/); }),
  L("B-52", "high", ['float FS4 "high level alarm" 5.5 ft', 'float FS3 "lag on" 4.5 ft', 'float FS2 "lead on" 3.5 ft', 'float FS1 "off" 2 ft'], "Written top first: drawn in place.",
    function (r) { return heights(r, { FS1: FT(2), FS2: FT(3.5), FS3: FT(4.5), FS4: FT(5.5) }); }),
  L("B-53", "high", ['well "wet well" 20 ft deep', 'float FS1 "off" 18 ft below grade', 'float FS2 "lead on" 16.5 ft below grade', 'float FS3 "lag on" 15.5 ft below grade', 'float FS4 "high level alarm" 14.5 ft below grade', 'inlet "inlet invert" 13 ft below grade'],
    "Depths below grade in a 20 ft well: heights above the floor 2, 3.5, 4.5, 5.5 ft.", function (r) { return heights(r, { FS1: FT(2), FS2: FT(3.5), FS3: FT(4.5), FS4: FT(5.5) }); }),
  L("B-54", "high", ['float FS1 "off" 600 mm', 'float FS2 "lead on" 1,000 mm', 'float FS3 "lag on" 1,300 mm', 'float FS4 "high level alarm" 1,600 mm'], "Millimetres with thousands separators.",
    function (r) { return heights(r, { FS1: 0.6, FS2: 1, FS3: 1.3, FS4: 1.6 }); }),
  L("B-55", "high", ['float FS1 "off" 2 ft 6 in', 'float FS2 "lead on" 3\'-6"', 'float FS3 "lag on" 4 ft-6 in', 'float FS4 "high level alarm" 5\'6"'], "Feet and inches four ways.",
    function (r) { return heights(r, { FS1: FT(2.5), FS2: FT(3.5), FS3: FT(4.5), FS4: FT(5.5) }); }),
  { id: "B-56", harm: "medium", input: { question: LQ, reply: H.blk("FLOATS", "Wet well", ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft']) }, right: "MAKE FLOATS: read as MAKE LEVELS.",
    run: function () { return heights(H.L().aiAct.build(this.input.reply, LQ), { FS1: FT(2), FS2: FT(3) }); } },
  L("B-57", "medium", ['level switch LS1 "off" 2 ft', 'level switch LS2 "lead on" 3 ft', 'level switch LS3 "lag on" 4 ft', 'level switch LS4 "high level alarm" 5 ft'], "\"level switch LS1\": floats.",
    function (r) { return heights(r, { LS1: FT(2), LS2: FT(3), LS3: FT(4), LS4: FT(5) }); }),
  L("B-58", "medium", ['float FS1 "off" 2 ft above floor', 'float FS2 "lead on" 3 ft above floor', 'float FS3 "lag on" 4 ft above floor', 'float FS4 "high level alarm" 5 ft above floor'], "\"2 ft above floor\".",
    function (r) { return heights(r, W2345); }),
  L("B-59", "medium", ['float FS1 "off" 0,6 m', 'float FS2 "lead on" 1,0 m', 'float FS3 "lag on" 1,3 m', 'float FS4 "high level alarm" 1,6 m'], "Decimal commas.",
    function (r) { return heights(r, { FS1: 0.6, FS2: 1, FS3: 1.3, FS4: 1.6 }); }),
  L("B-60", "medium", ['float FS1 "off" 60 cm', 'float FS2 "lead on" 100 cm', 'float FS3 "lag on" 130 cm', 'float FS4 "high level alarm" 160 cm'], "Centimetres.",
    function (r) { return heights(r, { FS1: 0.6, FS2: 1, FS3: 1.3, FS4: 1.6 }); }),

  // ---- MAKE PIPING
  P("B-70", "high", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', 'header "4 in force main"', 'vent'], "The example: each pump's check then shutoff valve.",
    function (r) { if (!r || !r.ok) return "not drawn"; return r.plan.pumps.length === 2 && r.plan.pumps.every(function (p) { return p.check && p.valve; }) ? "" : JSON.stringify(r.plan.pumps); }),
  P("B-71", "high", ['wet well', 'inlet', 'pump P1', 'pump P2', 'check valve CV1 P1', 'check valve CV2 P2', 'gate valve V1 P1', 'gate valve V2 P2', 'force main "4 in force main"', 'vent'], "Names as first words (wet well, check valve, gate valve, force main).",
    function (r) { if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : ""); var p = r.plan.pumps; return p[0].check === "CV1" && p[1].check === "CV2" && p[0].valveKind === "gate" && p[1].valve === "V2" ? "" : JSON.stringify(p); }),
  P("B-72", "low", ['Wet Well: 6 ft diameter', 'Pump 1: P1', 'Pump 2: P2', 'Force main: 4 in'], "\"Force main: 4 in\": drawn; the summary does not say the water goes \"away along the 4 in\" (its size taken for its name).",
    function (r) { if (!r || !r.ok) return "not drawn: " + (r ? r.problems.join("; ") : ""); return /away along the 4 in\./.test(r.summary) ? "the summary says: '... then into the header and away along the 4 in.'" : ""; }),
  P("B-73", "low", ['well "wet well"', 'pump P1', 'pump P2', 'inlet gate valve', 'header "4 in force main"'], "\"inlet gate valve\" (a valve on the inlet): said not drawn, as \"valve ... inlet\" is -- not drawn as an inlet pipe named \"gate valve\".",
    function (r) { if (!r || !r.ok) return ""; return r.plan.inlets.indexOf("gate valve") >= 0 ? "drawn as an inlet labelled 'inlet: gate valve' (no valve), unsaid" : ""; }),
  P("B-74", "high", ['well "wet well"', 'pumps 2', 'header "4 in force main"'], "\"pumps 2\": two pumps.", function (r) { return r && r.ok && r.plan.pumps.length === 2 ? "" : "pumps: " + (r && r.plan ? r.plan.pumps.length : "none"); }),
  P("B-75", "high", ['well "wet well"', 'pump P1 P2', 'header "4 in force main"'], "\"pump P1 P2\": two pumps.", function (r) { return r && r.ok && r.plan.pumps.length === 2 ? "" : "pumps: " + (r && r.plan ? r.plan.pumps.length : "none"); }),
  P("B-76", "high", ['well "wet well"', 'pump P1 "pump 1"', 'header "4 in force main"'], "A duplex with one pump written: the second added and said.",
    function (r) { return r && r.ok && r.plan.pumps.length === 2 && /the question asks for 2 pumps/.test(r.summary) ? "" : "pumps " + (r && r.plan ? r.plan.pumps.length : 0); }),
  P("B-77", "high", ['well "wet well"', 'pump P1', 'pump P2', 'valve V1 P1', 'check CV1 P1', 'valve V2 P2', 'check CV2 P2', 'header "4 in force main"'], "Valves before checks in the lines: drawn check first.",
    function (r) { if (!r || !r.ok) return "not drawn"; return r.plan.order.join() === "pump,check,shutoff,header" && r.plan.pumps[0].check === "CV1" && r.plan.pumps[0].valve === "V1" ? "" : JSON.stringify(r.plan.pumps); }),
  P("B-78", "medium", ['well "wet well"', 'pump P1 P2', 'header "4 in force main"', 'float FS1 "off"', 'float FS2 "lead on"'], "Floats in the piping: left to MAKE LEVELS, said.",
    function (r) { return r && r.ok && /MAKE LEVELS/.test(r.summary) ? "" : "not said"; }),
  P("B-79", "medium", ['well "wet well"', 'pump P1', 'pump P2', 'check CV1 P1 "swing check"', 'check CV2 P2 "ball check"', 'valve V1 P1 plug', 'valve V2 P2 ball', 'header "4 in force main"'], "Kinds of check and shutoff valves.",
    function (r) { if (!r || !r.ok) return "not drawn"; var p = r.plan.pumps; return p[0].valveKind === "plug" && p[1].valveKind === "ball" && p[0].check === "CV1" ? "" : JSON.stringify(p); }),
  { id: "B-80", harm: "medium", input: { question: PQ, reply: H.blk("PLUMBING", "Lift station", ['well "wet well"', 'pump P1', 'pump P2', 'header "4 in force main"']) }, right: "MAKE PLUMBING: read as MAKE PIPING.",
    run: function () { var r = H.L().aiAct.build(this.input.reply, PQ); return r && r.ok && r.plan.mode === "piping" ? "" : "not drawn as piping: " + (r ? (r.problems || []).join("; ") : "null"); } },
  { id: "B-81", harm: "medium", input: { question: PQ, reply: H.blk("SCHEMATIC", "Lift station", ['well "wet well"', 'pump P1', 'pump P2', 'check CV1 P1', 'check CV2 P2', 'header "4 in force main"']) },
    right: "MAKE SCHEMATIC holding piping lines for a plumbing question: drawn as the piping, or back once saying to write MAKE PIPING.",
    run: function () { var r = H.L().aiAct.build(this.input.reply, PQ); if (r && r.ok) return r.plan.mode === "piping" ? "" : "drawn as " + r.plan.mode; var t = H.L().aiAct.fixText(r, PQ); return /MAKE PIPING/.test(t) ? "" : "back without MAKE PIPING: " + r.problems.join("; ").slice(0, 300); } },
  P("B-82", "high", ['well "wet well"', 'pump P1', 'pump P2', 'header "discharge header"', 'main "force main"', 'valve ARV1 "air release"', 'vent'], "An air release valve: on the force main, said.",
    function (r) { return r && r.ok && r.plan.mainValves.length === 1 && r.plan.mainValves[0].kind === "air release" ? "" : JSON.stringify(r && r.plan && r.plan.mainValves); }),
  P("B-83", "medium", ['well "wet well"', 'pump P1', 'pump P2', 'check CV1 P3', 'header "4 in force main"'], "A check on a pump not drawn: back naming CV1, with a pump of this block.",
    function (r) { return back(r, /check CV1 P[12]/); }),
  P("B-84", "medium", ['well "wet well"', 'pump P1', 'pump P2', 'pump P3', 'pump P4', 'pump P5', 'header "12 in force main"'], "Five pumps: back once (four at most).", function (r) { return back(r, /4 pumps or fewer/); }, "Draw the piping for a lift station with five pumps")
];
module.exports = cases;
