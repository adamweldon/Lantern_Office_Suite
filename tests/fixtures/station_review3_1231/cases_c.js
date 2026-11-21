// cases_c.js -- C: counts of pumps and float lines written in odd but right ways, in one MAKE STATION block. Each is
// read as written (the count, each float's job and height), or said; never a number that is not a count taken for one,
// and never the question's count laid over a right block when the question does not name one count.
"use strict";
var H = require("./lib.js");
var Q = "Design a lift station: the control circuit, the piping and the float levels";
var DQ = "Design a duplex lift station: the control circuit, the piping and the float levels";
var SQ = "Design a simplex sump pump station: the control, the piping and the float levels";
function build(lines, q) { return H.L().aiAct.build(H.st(lines), q || Q); }
function said(r) { return r && r.plan ? r.plan.said.concat(r.plan.warn || []).join(" ;; ") : ""; }
// N: the count read; F: the floats read (ids and jobs, heights where given)
function N(id, harm, lines, n, right, q) {
  return { id: id, harm: harm, input: { question: q || Q, block: lines }, right: right, run: function () { return H.boot().then(function () {
    var r = build(lines, q); if (!r.plan) return "not drawn: " + r.problems.join("; ");
    return H.pumpsOf(r) === n ? "" : "read as " + H.pumpsOf(r) + " pumps (drawn: " + H.viewsOf(r) + "; said: " + r.plan.said[0] + ")"; }); } };
}
function F(id, harm, lines, want, right, q, extra) {
  return { id: id, harm: harm, input: { question: q || Q, block: lines }, right: right, run: function () { return H.boot().then(function () {
    var r = build(lines, q); if (!r.plan) return "not drawn: " + r.problems.join("; ");
    if (H.floatsOf(r) !== want) return "floats " + H.floatsOf(r) + " (want " + want + ")" + (r.plan.unread.length ? "; not read: " + r.plan.unread.join(" | ") : "") + "; said: " + said(r);
    return extra ? extra(r) : (r.ok ? "" : "questioned: " + r.problems.join("; ")); }); } };
}
var F4 = "FS1:off,FS2:lead,FS3:lag,FS4:alarm", H4 = "FS1:off@2 ft,FS2:lead@3 ft,FS3:lag@4 ft,FS4:alarm@5 ft";
module.exports = [
  // --- pumps: right ways to write the count -----------------------------------------------------------------------
  N("C-01", "medium", ["pumps 2"], 2, "The guide's own line."),
  N("C-02", "medium", ["Pumps: 2"], 2, "A colon, a capital."),
  N("C-03", "medium", ["number of pumps: 2"], 2, "Number of pumps."),
  N("C-04", "medium", ["pumps two"], 2, "The count in a word."),
  N("C-05", "medium", ["2 pumps"], 2, "Count first."),
  N("C-06", "medium", ["two submersible pumps"], 2, "Count first, in a word, with what they are."),
  N("C-07", "medium", ["pump P1", "pump P2"], 2, "A line for each pump, by tag."),
  N("C-08", "medium", ["pump 1", "pump 2"], 2, "A line for each pump, by number."),
  N("C-09", "medium", ["pumps 2 x 7.5 HP"], 2, "Count, then the size."),
  N("C-10", "medium", ["pumps 1 duty + 1 standby"], 2, "Duty and standby: two."),
  N("C-11", "medium", ["pumps 2 duty, 1 standby"], 3, "Two duty and one standby: three."),
  N("C-12", "medium", ["duplex"], 2, "The station's kind as the line."),
  N("C-13", "medium", ["Type: duplex"], 2, "Type: duplex."),
  N("C-14", "medium", ["simplex"], 1, "Simplex.", SQ),
  N("C-15", "medium", ["pumps: 2 (duplex)"], 2, "Count with the kind in brackets."),
  // --- pumps: a rating before the count is not the count ------------------------------------------------------------
  N("C-16", "high", ["pumps 5 HP x 2"], 2, "5 HP is the size, x 2 the count: two pumps. Lantern took the first number: five pumps, so neither the control nor the piping was drawn."),
  N("C-17", "high", ["pumps 15 kW x 2"], 2, "15 kW is the size: two pumps. Read as fifteen."),
  N("C-18", "high", ["pumps 150 gpm, 2 of them"], 2, "150 gpm is the flow: two pumps. Read as 150 pumps (the levels drawn with P1 to P150)."),
  N("C-19", "high", ["pumps 480 V, 2"], 2, "480 V is the supply: two pumps. Read as 480."),
  N("C-20", "medium", ["pumps 3 phase, 2 pumps"], 2, "3 phase is the supply: two pumps. Read as three (no control drawn)."),
  N("C-21", "medium", ["pumps 10 HP each, 2 total"], 2, "10 HP each, 2 in all: two. Read as ten."),
  N("C-22", "medium", ["pumps 1 + 1"], 2, "One duty plus one standby: two. Read as one (a simplex drawn)."),
  // --- the question's count over the block's ------------------------------------------------------------------------
  // the code's own rule: the question's count overrules only when it names one count and nothing against it. Each of
  // these names “one pump” in a phrase that needs two.
  N("C-23", "high", ["pumps 2", "floats off lead lag alarm"], 2, "“With one pump out of service” is the duplex rule (each pump alone takes the peak flow): the block's two pumps stand. Lantern drew one pump and dropped the lag float: the redundancy the question asks for is gone.",
    "Design a lift station where each pump can handle the peak flow with one pump out of service: draw the control circuit, the piping and the float levels"),
  N("C-24", "high", ["pumps 2", "floats off lead lag alarm"], 2, "One running and one standby are two pumps. Drawn as one.", "Design a lift station with one pump running and one standby pump: the control, the piping and the floats"),
  N("C-25", "high", ["pumps 2", "floats off lead lag alarm"], 2, "“If one pump fails the other takes over” names two. Drawn as one.", "Draw the control circuit and the piping for a sewage lift station; if one pump fails the other takes over"),
  N("C-26", "medium", ["pumps 2", "floats off lead lag alarm"], 2, "“Runs one pump at a time” is a duplex's lead pump. Drawn as one.", "Draw the wiring and the piping for a lift station that runs one pump at a time"),
  N("C-27", "medium", ["pumps 2"], 2, "Two counts named (two and one): the block's two stands.", "Draw the control circuit, the piping and the float levels for a lift station; two pumps would be better than one pump"),
  N("C-28", "medium", ["pumps 1"], 2, "A duplex question, a block of one: two, said.", DQ),
  N("C-29", "medium", [], 1, "A simplex question with an empty block: one pump.", SQ),
  // --- float lines ---------------------------------------------------------------------------------------------------
  F("C-30", "medium", ["pumps 2", "floats off lead lag alarm"], F4, "The guide's own line."),
  F("C-31", "medium", ["pumps 2", "floats: off, lead, lag, high level alarm"], F4, "Commas and the alarm's full name."),
  F("C-32", "medium", ["pumps 2", "float switches: off, lead on, lag on, high level alarm"], F4, "Float switches."),
  F("C-33", "medium", ["pumps 2", "floats: all pumps off, lead pump on, lag pump on, high level alarm"], F4, "Long names."),
  F("C-34", "medium", ["pumps 2", "floats stop, lead start, lag start, high alarm"], F4, "Stop and start."),
  F("C-35", "medium", ["pumps 2", "floats: off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft"], H4, "Heights after the jobs."),
  F("C-36", "medium", ["pumps 2", "floats 2 ft off, 3 ft lead, 4 ft lag, 5 ft alarm"], H4, "Heights before the jobs."),
  F("C-37", "medium", ["pumps 2", "floats off=2', lead=3', lag=4', alarm=5'"], H4, "Equals signs and foot marks."),
  F("C-38", "medium", ["pumps 2", "floats: off @ 2 ft, lead @ 3 ft, lag @ 4 ft, alarm @ 5 ft"], H4, "At signs."),
  F("C-39", "medium", ["pumps 2", "floats: off (2 ft), lead (3 ft), lag (4 ft), alarm (5 ft)"], H4, "Heights in brackets."),
  F("C-40", "medium", ["pumps 2", "floats off 2.0, lead 3.0, lag 4.0, alarm 5.0 ft"], "FS1:off@2.0 ft,FS2:lead@3.0 ft,FS3:lag@4.0 ft,FS4:alarm@5.0 ft", "The unit once, at the end."),
  F("C-41", "medium", ["pumps 2", "floats off 24\x22, lead 36\x22, lag 48\x22, alarm 60\x22"], "FS1:off@24 in,FS2:lead@36 in,FS3:lag@48 in,FS4:alarm@60 in", "Inch marks."),
  F("C-42", "medium", ["pumps 2", "floats off 600 mm, lead 900 mm, lag 1200 mm, alarm 1500 mm"], "FS1:off@600 mm,FS2:lead@900 mm,FS3:lag@1200 mm,FS4:alarm@1500 mm", "Millimetres."),
  F("C-43", "medium", ["pumps 2", "float FS1 \x22off\x22 1'6\x22", "float FS2 \x22lead on\x22 2'6\x22", "float FS3 \x22lag on\x22 3'", "float FS4 \x22high level alarm\x22 3'6\x22"], "FS1:off@1 ft 6 in,FS2:lead@2 ft 6 in,FS3:lag@3 ft,FS4:alarm@3 ft 6 in", "Feet and inches."),
  F("C-44", "medium", ["pumps 2", "FS1 off 2 ft", "FS2 lead on 3 ft", "FS3 lag on 4 ft", "FS4 high level alarm 5 ft"], H4, "Tag first."),
  F("C-45", "medium", ["pumps 2", "float 1: off", "float 2: lead on", "float 3: lag on", "float 4: high level alarm"], F4, "Float 1: off."),
  F("C-46", "medium", ["pumps 2", "Float 1 (off)", "Float 2 (lead on)", "Float 3 (lag on)", "Float 4 (high level alarm)"], F4, "Float 1 (off)."),
  F("C-47", "medium", ["pumps 2", "float FS3 \x222nd pump on\x22 4 ft", "float FS1 \x22off\x22 2 ft", "float FS2 \x221st pump on\x22 3 ft", "float FS4 \x22alarm\x22 5 ft"], H4, "Out of order, and the second pump's float named so."),
  F("C-48", "medium", ["pumps 2", "floats 4"], F4, "Four floats: the usual four."),
  F("C-49", "medium", ["pumps 2", "floats 3 (off, on, alarm)"], "FS1:off,FS2:lead,FS3:alarm", "Three floats named."),
  F("C-50", "medium", ["pumps 1", "floats off, pump on, alarm"], "FS1:off,FS2:lead,FS3:alarm", "A simplex's three.", SQ),
  F("C-51", "medium", ["pumps 2", "floats low level alarm, off, lead, lag, high level alarm"], "FS1:low,FS2:off,FS3:lead,FS4:lag,FS5:alarm", "A low level alarm under the off float."),
  F("C-52", "medium", ["pumps 2", "floats off, lead, lag, high water, high high water"], "FS1:off,FS2:lead,FS3:lag,FS4:alarm,FS5:alarm", "Two alarms: high water and high high water."),
  // --- float lines misread ---------------------------------------------------------------------------------------------
  F("C-53", "medium", ["pumps 2", "Off float 2 ft", "Lead float 3 ft", "Lag float 4 ft", "Alarm float 5 ft"], H4,
    "A line for each float, job first: four floats at 2, 3, 4 and 5 ft. Lantern read only the alarm (its line begins with a word it knows), added an off and a lead float without heights, left the lag out and drew the levels not to scale; the three lines are listed as not read, and nothing goes back."),
  F("C-54", "medium", ["pumps 2", "floats: redundant off, off, lead, lag, alarm"], "FS1:off,FS2:off,FS3:lead,FS4:lag,FS5:alarm",
    "A redundant off float under the off float is a real design (MAKE CONTROL keeps two off floats): five floats, or said. Lantern merged it into the off float and said nothing."),
  F("C-55", "low", ["pumps 2", "LSL off", "LSH lead on", "LSHH alarm"], "FS1:off,FS2:lead,FS3:alarm",
    "Three level switches by their ISA letters: off, lead on, alarm. Not read (said), and the usual four drawn: a lag float the block did not have."),
  F("C-56", "low", ["pumps 2", "floats off-2ft, lead-3ft, lag-4ft, alarm-5ft"], H4,
    "A hyphen between the job and its height: 2, 3, 4, 5 ft. Read as -2, -3, -4, -5 ft and sent back as out of order, with “give FS2 a height above -2 ft” -- a line that is wrong for this block."),
  F("C-57", "low", ["pumps 1", "floats low level, high level"], "FS1:off,FS2:lead", "A sump's low and high level floats: the high one starts the pump, said.", SQ,
    function (r) { return /starts the pump/.test(said(r)) ? "" : "not said: " + said(r); }),
  F("C-58", "medium", ["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft", "floats off lead lag alarm"], H4, "The floats twice, once with heights: one set, with the heights.")
];
