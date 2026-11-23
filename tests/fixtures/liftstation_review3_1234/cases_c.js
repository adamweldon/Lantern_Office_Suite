// cases_c.js -- AI_STATION spec() (1.24.34, the second review): a second float of one job with a tag of its own becomes
// the lag (a second start) or a triplex's own lag float, else "not drawn" is said; "lag on / high alarm" is the lag;
// key()'s lag numbers only for 3+ pumps; jobless floats get distinct jobs in the line handed back. Tried with MAKE
// STATION blocks a model would write, and MAKE CONTROL / MAKE LEVELS blocks for a station's question. Each drawing and
// sentence is checked against what a lift station is: the off float lowest, the lead start above it, the lag start above
// that, the high level alarm on top; one off float stops both pumps unless the lag has its own; the alarm checked.
"use strict";
var lib = require("./lib.js");
var Q = "\x22";
var QD = "Draw a duplex lift station: the control circuit, the piping and the float levels";
var QT = "Draw a triplex lift station";
var QS = "Draw a sump pump station with one pump";
function f(id, label, h) { return "float " + id + " " + Q + label + Q + (h ? " " + h : ""); }
// the duplex's control, run over a fill and pump-down (sim.duplex of the first review of 1.23.0): [] when right
function duplexRuns(m) {
  var c = lib.ctl(m), sp = m.plan.spec, by = {};
  if (!c) return ["no control circuit drawn"];
  sp.floats.forEach(function (x) { if (!by[x.job]) by[x.job] = x.id; });
  var other = sp.floats.filter(function (x) { return by[x.job] !== x.id; }).map(function (x) { return [x.id, x.job === "off" ? 0.9 : x.job === "lag" ? 3.2 : x.job === "alarm" ? 4.8 : x.job === "low" ? 0.2 : 2.2]; });
  return lib.sim.duplex(c, { floats: { off: by.off, lead: by.lead, lag: by.lag, alarm: by.alarm }, pumps: ["M1", "M2"], alarms: by.alarm ? lib.alarmsOn(c, by.alarm) : [], otherFloats: other });
}
// st(id, q, kind, lines, want(m) -> "" | why, why, harm)
function st(id, q, kind, lines, want, why, harm) {
  return { id: id, harm: harm || "high", right: true, input: { q: q, block: lib.sch(id, lines, kind) }, why: why,
    run: async function (x) { var m = lib.build(x.N.L, lib.sch(id, lines, kind), q); return want(m, x) || ""; } };
}
function made(fl, extra) {   // made, ok, these floats (id:job[@height], in order), the duplex control right where drawn
  return function (m, x) {
    if (!(m && m.ok)) return "not made: " + lib.probs(m);
    var got = m.plan.spec.floats.map(function (z) { return z.id + ":" + z.job + (z.height ? "@" + z.height : ""); }).join(", ");
    if (fl && got !== fl) return "floats " + got + ", want " + fl + " -- " + (m.summary || "").replace(/^.*?(Lantern notes|Lantern assumed)/, "$1").slice(0, 400);
    if (m.plan.spec.pumps.length === 2 && lib.ctl(m)) { var r = duplexRuns(m); if (r.length) return "the control drawn does not run as a duplex: " + r.join("; "); }
    return extra ? extra(m, x) || "" : "";
  };
}
function says(re, not) { return function (m) { var s = m.summary || ""; if (re && !re.test(s)) return "the summary does not say " + re + ": " + s.slice(0, 600); if (not && not.test(s)) return "the summary says " + not + ": " + s.slice(0, 600); return ""; }; }
var C = [];
// ---- the usual, as before ------------------------------------------------------------------------------------------
C.push(st("C-std", QD, "STATION", ["pumps 2", "floats off lead lag alarm"], made("FS1:off, FS2:lead, FS3:lag, FS4:alarm"), "the guide's own block"));
C.push(st("C-tags-heights", QD, "STATION", ["pumps 2", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag on", "4 ft"), f("FS4", "high level alarm", "5 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:alarm@5 ft"), "four tagged floats with heights"));
C.push(st("C-isa-tags", QD, "STATION", ["pumps 2", f("LSL1", "off", "2 ft"), f("LSH1", "lead on", "3 ft"), f("LSH2", "lag on", "4 ft"), f("LSHH1", "high level alarm", "5 ft")], made("LSL1:off@2 ft, LSH1:lead@3 ft, LSH2:lag@4 ft, LSHH1:alarm@5 ft"), "ISA tags"));
C.push(st("C-two-alarms", QD, "STATION", ["pumps 2", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag on", "4 ft"), f("FS4", "high level alarm", "5 ft"), f("FS5", "high high level alarm", "6 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:alarm@5 ft, FS5:alarm@6 ft"), "high level and high high alarms"));
C.push(st("C-redundant-off", QD, "STATION", ["pumps 2", f("FS0", "redundant off", "1.5 ft"), f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag on", "4 ft"), f("FS4", "high level alarm", "5 ft")], made("FS0:off@1.5 ft, FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:alarm@5 ft"), "a redundant off below the off"));
C.push(st("C-lead-lag-off", QD, "STATION", ["pumps 2", f("FS1", "lead off", "2 ft"), f("FS2", "lag off", "2.5 ft"), f("FS3", "lead on", "3 ft"), f("FS4", "lag on", "4 ft"), f("FS5", "high level alarm", "5 ft")], made("FS1:off@2 ft, FS2:off@2.5 ft, FS3:lead@3 ft, FS4:lag@4 ft, FS5:alarm@5 ft"), "the lag pump's own off float"));
C.push(st("C-pump-n-on", QD, "STATION", ["pumps 2", f("FS1", "pumps off", "2 ft"), f("FS2", "pump 1 on", "3 ft"), f("FS3", "pump 2 on", "4 ft"), f("FS4", "high level alarm", "5 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:alarm@5 ft"), "pump 1 on / pump 2 on"));
C.push(st("C-emergency-high", QD, "STATION", ["pumps 2", f("FS1", "off"), f("FS2", "lead on"), f("FS3", "lag on"), f("FS4", "emergency high")], made("FS1:off, FS2:lead, FS3:lag, FS4:alarm"), "the 35B's emergency high is the alarm (1.24.33 dropped it)"));
C.push(st("C-alarm-and-emergency", QD, "STATION", ["pumps 2", f("FS1", "off"), f("FS2", "lead on"), f("FS3", "lag on"), f("FS4", "high level alarm"), f("FS5", "emergency high")], made("FS1:off, FS2:lead, FS3:lag, FS4:alarm, FS5:alarm"), "a high level alarm and an emergency high: two alarms"));
C.push(st("C-sump", QS, "STATION", ["pumps 1", f("FS1", "pump off", "1 ft"), f("FS2", "pump on", "2 ft"), f("FS3", "high level alarm", "3 ft")], made("FS1:off@1 ft, FS2:lead@2 ft, FS3:alarm@3 ft"), "a simplex sump"));
C.push(st("C-sump-low-high", QS, "STATION", ["pumps 1", f("FS1", "low level"), f("FS2", "high level")], made("FS1:off, FS2:lead"), "a sump's low and high level floats: the high level one starts the pump"));
// ---- a second float of one job with a tag of its own -------------------------------------------------------------
C.push(st("C-second-lead-is-lag", QD, "STATION", ["pumps 2", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lead on", "4 ft"), f("FS4", "high level alarm", "5 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:alarm@5 ft", says(/FS3 “lead on” is the lag float/)), "a second start float above the first: the lag, and said"));
C.push(st("C-second-lead-lower", QD, "STATION", ["pumps 2", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3.5 ft"), f("FS3", "lead on", "3 ft"), f("FS4", "high level alarm", "5 ft")],
  made("FS1:off@2 ft, FS3:lead@3 ft, FS2:lag@3.5 ft, FS4:alarm@5 ft"), "Two start floats, the second written lower: the lower one is the lead and the higher the lag. The rule makes the second written the lag whatever its height, then sends the block back because its lag (labelled \u201clead on (lag on)\u201d, words the model never wrote) is below the lead.", "low"));
C.push(st("C-second-lead-above-alarm", QD, "STATION", ["pumps 2", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "high level alarm", "5 ft"), f("FS4", "pump on", "6 ft")],
  function (m) { if (m && m.ok && m.plan.spec.floats.some(function (z) { return z.id === "FS4" && z.job === "lag"; })) return "FS4, a start float above the high level alarm, is drawn as the lag float (" + lib.floats(m) + "); a lag start above the alarm is not a station's -- said or sent back, not drawn as written"; return ""; },
  "A start float written above the alarm: made the lag float with no word on its height.", "low"));
C.push(st("C-redundant-start", QD, "STATION", ["pumps 2", f("FS1", "off"), f("FS2", "lead on"), f("FS3", "redundant start"), f("FS4", "high level alarm")], made("FS1:off, FS2:lead, FS3:lag, FS4:alarm", says(/FS3 “redundant start” is the lag float/)), "a redundant start (1.24.33 read it as an off float): the lag, said"));
C.push(st("C-second-lead-with-lag", QD, "STATION", ["pumps 2", f("FS1", "off"), f("FS2", "lead on"), f("FS3", "lag on"), f("FS5", "lead on"), f("FS4", "high level alarm")], made("FS1:off, FS2:lead, FS3:lag, FS4:alarm", says(/not drawn: FS5 “lead on”/)), "a third start float in a duplex: not drawn, said"));
C.push(st("C-duplex-lag1-lag2", QD, "STATION", ["pumps 2", f("FS1", "off"), f("FS2", "lead on"), f("FS3", "lag 1 on"), f("FS4", "lag 2 on"), f("FS5", "high level alarm")], made("FS1:off, FS2:lead, FS3:lag, FS5:alarm", says(/not drawn: FS4 “lag 2 on”/)), "lag numbers in a duplex are not lag1/lag2 keys: one lag drawn, the other said"));
C.push(st("C-sump-two-on", QS, "STATION", ["pumps 1", f("FS1", "off"), f("FS2", "pump on"), f("FS3", "pump on"), f("FS4", "high level alarm")], made("FS1:off, FS2:lead, FS4:alarm", says(/not drawn: FS3 “pump on”/)), "one pump, two start floats: the second said"));
// two off floats, both called off: the higher is the pumps' off and the lower the redundant one (as off2 sits below off)
C.push(st("C-two-offs-tagged", QD, "STATION", ["pumps 2", f("FS5", "off", "1.5 ft"), f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag on", "4 ft"), f("FS4", "high level alarm", "5 ft")],
  function (m) {
    if (!(m && m.ok)) return "not made: " + lib.probs(m);
    var off = m.plan.spec.floats.filter(function (z) { return z.job === "off"; });
    if (off.length === 1 && off[0].id === "FS5") return "the off float drawn is FS5 at 1.5 ft and FS1 “off” at 2 ft is dropped (“not drawn”): the pumps now stop 6 in lower than the model's off float, set by the pumps' submergence. The first written wins; the higher off float is the pumps' off and the lower a redundant one (" + lib.floats(m) + ")";
    return "";
  }, "Two off floats with tags and heights, the lower written first.", "medium"));
C.push(st("C-pump2-off", QD, "STATION", ["pumps 2", f("FS1", "pump 1 off", "2 ft"), f("FS2", "pump 2 off", "2.5 ft"), f("FS3", "pump 1 on", "3 ft"), f("FS4", "pump 2 on", "4 ft"), f("FS5", "high level alarm", "5 ft")],
  made("FS1:off@2 ft, FS2:off@2.5 ft, FS3:lead@3 ft, FS4:lag@4 ft, FS5:alarm@5 ft"), "“pump 2 on” is read as the lag's start; “pump 2 off”, the same pump's stop, is not drawn (said: “both pumps stop on it”) where “lag off” would be the lag pump's own off float.", "low"));
// ---- a triplex's lag floats ----------------------------------------------------------------------------------------
C.push(st("C-tri-lag1-lag2", QT, "STATION", ["pumps 3", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag 1 on", "4 ft"), f("FS4", "lag 2 on", "5 ft"), f("FS5", "high level alarm", "6 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:lag@5 ft, FS5:alarm@6 ft"), "a triplex's two lag floats"));
C.push(st("C-tri-lag-labels-straight", QT, "STATION", ["pumps 3", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "Lag 1", "4 ft"), f("FS4", "Lag 2", "5 ft"), f("FS5", "high level alarm", "6 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:lag@5 ft, FS5:alarm@6 ft"), "“Lag 1” and “Lag 2” in straight quotes, heights after"));
C.push(st("C-tri-lag-same-label", QT, "STATION", ["pumps 3", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag on", "4 ft"), f("FS4", "lag on", "5 ft"), f("FS5", "high level alarm", "6 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:lag@5 ft, FS5:alarm@6 ft"), "two “lag on” floats with their own tags and heights"));
C.push(st("C-tri-pump-n-on", QT, "STATION", ["pumps 3", f("FS1", "all pumps off", "2 ft"), f("FS2", "pump 1 on", "3 ft"), f("FS3", "pump 2 on", "4 ft"), f("FS4", "pump 3 on", "5 ft"), f("FS5", "high level alarm", "6 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:lag@5 ft, FS5:alarm@6 ft"), "pump 1/2/3 on"));
C.push(st("C-tri-start-n", QT, "STATION", ["pumps 3", f("FS1", "stop", "2 ft"), f("FS2", "start 1", "3 ft"), f("FS3", "start 2", "4 ft"), f("FS4", "start 3", "5 ft"), f("FS5", "alarm", "6 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:lag@5 ft, FS5:alarm@6 ft"), "start 1/2/3"));
C.push(st("C-tri-heights-line", QT, "STATION", ["pumps 3", "floats off 2 ft, lead on 3 ft, lag on 4 ft, lag on 5 ft, alarm 6 ft"], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:lag@5 ft, FS5:alarm@6 ft"), "one floats line with heights"));
C.push(st("C-quad-pump-n-on", "Draw a lift station with four pumps", "STATION", ["pumps 4", f("FS1", "all pumps off", "2 ft"), f("FS2", "pump 1 on", "3 ft"), f("FS3", "pump 2 on", "4 ft"), f("FS4", "pump 3 on", "5 ft"), f("FS5", "pump 4 on", "6 ft"), f("FS6", "high level alarm", "7 ft")], made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:lag@5 ft, FS5:lag@6 ft, FS6:alarm@7 ft"), "four pumps, four starts"));
C.push(st("C-tri-floats-word-line", QT, "STATION", ["pumps 3", "floats off lead lag lag alarm"],
  function (m) { if (!(m && m.ok)) return "not made: " + lib.probs(m); var lags = m.plan.spec.floats.filter(function (z) { return z.job === "lag"; }); if (lags.length < 2 && !/lag/.test((m.summary || "").replace(/lag on float/g, ""))) return "a triplex written “floats off lead lag lag alarm” is drawn with one lag float and nothing said: the third pump's start float is dropped (" + lib.floats(m) + ")"; return ""; },
  "The guide's own floats line with a second lag for the third pump (no tags, no heights): the second lag merged into the first without a word.", "medium"));
C.push(st("C-dup-floats-lead-lead", QD, "STATION", ["pumps 2", "floats off lead lead alarm"],
  function (m) { if (!(m && m.ok)) return "not made: " + lib.probs(m); if (m.plan.spec.floats.length === 3 && !/lead/.test((m.summary || "").replace(/lead on float|lead pump/g, ""))) return "“floats off lead lead alarm”: the second start float dropped without a word (" + lib.floats(m) + ")"; return ""; },
  "A duplex's floats line with two leads (a lag meant): dropped silently (1.24.33 the same); a tagged second lead is now the lag, an untagged one says nothing.", "low"));
// ---- "lag on / high alarm" ---------------------------------------------------------------------------------------
C.push(st("C-lag-alarm-one-float", QD, "STATION", ["pumps 2", f("FS1", "off"), f("FS2", "lead on"), f("FS3", "lag on / high level alarm")],
  function (m) {
    if (!(m && m.ok)) return "not made: " + lib.probs(m);
    var c = lib.ctl(m), lit = c ? lib.alarmsOn(c, "FS3") : [], s = m.summary || "", unk = (m.plan.unknown || []).join(" "), chk = (m.plan.checks.run || []).join(" ");
    var bad = [];
    if (lit.length && /no high level alarm float/.test(s)) bad.push("the summary says “no high level alarm float: the block has none”");
    if (lit.length && /This station has no high level alarm/.test(unk)) bad.push("“What Lantern does not know” says “This station has no high level alarm”");
    if (lit.length && !/Lift FS3 \([^)]*\): [^.]*alarm/.test(chk)) bad.push("the checks never lift FS3 to see the alarm light");
    if (!/the other pump starts too/.test((m.plan.sequence.plain || []).join(" "))) bad.push("how it works does not say the other pump starts at FS3");
    return bad.length ? "the control drawn lights " + lit.join(", ") + " on FS3 (lag on / high level alarm), but " + bad.join("; ") : "";
  }, "One float for the lag and the alarm (a small panel's): now the lag, which is right, but the station's papers then say it has no alarm while its control circuit lights one on that float -- 1.24.33 said the alarm and not the lag.", "medium"));
C.push(st("C-lag-alarm-plus-hh", QD, "STATION", ["pumps 2", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag on / high level alarm", "4 ft"), f("FS4", "high high alarm", "5 ft")],
  function (m) {
    if (!(m && m.ok)) return "not made: " + lib.probs(m);
    var c = lib.ctl(m), chk = (m.plan.checks.run || []).join(" ");
    if (c && lib.alarmsOn(c, "FS3").length && !/Lift FS3 \([^)]*\): [^.]*alarm/.test(chk)) return "FS3 lights " + lib.alarmsOn(c, "FS3").join(", ") + " in the control drawn, and the checks lift FS3 only for the pumps (1.24.33 drew a light for each alarm float and checked both)";
    return "";
  }, "A lag/alarm float under a high high alarm.", "low"));
C.push(st("C-lag-alarm-plus-alarm", QD, "STATION", ["pumps 2", f("FS1", "off"), f("FS2", "lead on"), f("FS3", "lag on / high alarm"), f("FS4", "high level alarm")],
  function (m) {
    if (!(m && m.ok)) return "not made: " + lib.probs(m);
    var got = m.plan.spec.floats.map(function (z) { return z.id + ":" + z.job; }).join(", ");
    if (got !== "FS1:off, FS2:lead, FS3:lag, FS4:alarm") return "floats " + got;
    var c = lib.ctl(m), al = lib.alarmsOn(c, "FS4"), r = lib.runs(c, { FS1: 1, FS2: 2, FS3: 3, FS4: 4 }, [0, 2.5, 3.5, 4.5, 0.5], al);
    // both run at FS3, the alarm by FS4 (FS3 may light it too: the model named it an alarm)
    return /3\.5:M1\+M2/.test(r) && /4\.5:M1\+M2!/.test(r) && /0\.5:$/.test(r) ? "" : "the control drawn runs " + r;
  }, "a lag/alarm float and an alarm float above it: both pumps at FS3, the alarm by FS4"));
C.push(st("C-floats-line-lag-alarm", QD, "STATION", ["pumps 2", "floats off lead " + Q + "lag on / high alarm" + Q], made(null, function (m) { return m.plan.spec.floats.some(function (z) { return z.job === "lag"; }) ? "" : "no lag float: " + lib.floats(m); }), "the combined float in a floats line"));
// ---- floats with no job: the lines handed back ------------------------------------------------------------------
function jobless(id, lines, want, why, harm) {
  return { id: id, harm: harm || "medium", right: false, input: { q: QD, block: lib.sch(id, lines, "STATION") }, why: why,
    run: async function (x) {
      var m = lib.build(x.N.L, lib.sch(id, lines, "STATION"), QD);
      if (m && m.ok) return "made: " + lib.floats(m);
      var got = (m.problems || []).map(lib.lineOf).join(" | ");
      if (typeof want === "function") { var w = want(got); return w ? w + ": “" + got + "”" : ""; }
      return got === want ? "" : "the lines handed back are “" + got + "”, want “" + want + "”";
    } };
}
C.push(jobless("C-jobless-letters", ["pumps 2", f("FS1", "Float A"), f("FS2", "Float B"), f("FS3", "Float C"), f("FS4", "Float D")], "float FS1 \x22off\x22 | float FS2 \x22lead on\x22 | float FS3 \x22lag on\x22 | float FS4 \x22high level alarm\x22", "four floats, no jobs, bottom up: distinct jobs (1.24.33 handed \x22off\x22 to all four)"));
C.push(jobless("C-jobless-numbered", ["pumps 2", f("FS1", "Float 1"), f("FS2", "Float 2"), f("FS3", "Float 3"), f("FS4", "Float 4")], "float FS1 \x22off\x22 | float FS2 \x22lead on\x22 | float FS3 \x22lag on\x22 | float FS4 \x22high level alarm\x22",
  "Floats named “Float 1” .. “Float 4” in straight quotes: the float line's inch-mark rule reads 1\x22 as 1 inch, so each line handed back carries a height the model never wrote (float FS1 \x22off\x22 1 in, ... 4 in: four floats an inch apart). The rule is 1.24.33's; the distinct jobs now make the copied lines pass."));
C.push(jobless("C-jobless-top-down", ["pumps 2", f("FS4", "float 4", "5 ft"), f("FS3", "float 3", "4 ft"), f("FS2", "float 2", "3 ft"), f("FS1", "float 1", "2 ft")], "float FS4 \x22high level alarm\x22 5 ft | float FS3 \x22lag on\x22 4 ft | float FS2 \x22lead on\x22 3 ft | float FS1 \x22off\x22 2 ft",
  "Four floats with heights, written from the top down: the jobs go out in the order written, so the 5 ft float is handed \x22off\x22 and the 2 ft one \x22high level alarm\x22 -- the order of a station upside down. With heights, the jobs go by height."));
C.push(jobless("C-jobless-below-off", ["pumps 2", f("FS1", "off", "2 ft"), f("FS2", "float B", "1 ft"), f("FS3", "float C", "4 ft")], function (got) { return /FS2 \x22(lead on|lag on)\x22 1 ft/.test(got) ? "a start handed to the float under the off float" : ""; },
  "A float with no job at 1 ft, under the off float at 2 ft, is handed \x22lead on\x22 1 ft: a start below the stop. (A float under the off float is a redundant off or a low level alarm; any line that keeps the order would do.)", "medium"));
// ---- a station question answered with the drawings' own blocks (MAKE LEVELS, MAKE CONTROL) ------------------------
C.push(st("C-levels-emergency", QD, "LEVELS", ["well " + Q + "wet well" + Q + " 10 ft", "pump P1 P2", f("FS1", "off", "2 ft"), f("FS2", "lead on", "3 ft"), f("FS3", "lag on", "4 ft"), f("FS4", "emergency high", "5 ft")],
  made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:alarm@5 ft", function (m) { return m.readAs === "STATION" ? "" : "not read as the station"; }), "MAKE LEVELS with an emergency high float (1.24.33: two floats for lead on)"));
C.push(st("C-levels-start-n", QD, "LEVELS", ["well " + Q + "wet well" + Q + " 10 ft", "pump P1 P2", f("FS1", "stop", "2 ft"), f("FS2", "start 1", "3 ft"), f("FS3", "start 2", "4 ft"), f("FS4", "alarm", "5 ft")],
  made("FS1:off@2 ft, FS2:lead@3 ft, FS3:lag@4 ft, FS4:alarm@5 ft"), "MAKE LEVELS with start 1 / start 2"));
C.push(st("C-control-pump-n-on", QD, "CONTROL", [f("FS1", "pumps off"), f("FS2", "pump 1 on"), f("FS3", "pump 2 on"), f("FS4", "emergency high"), "alternator AR M1 M2", "coil M1 " + Q + "pump 1 starter" + Q, "coil M2 " + Q + "pump 2 starter" + Q, "lamp LT1 FS4 " + Q + "emergency high" + Q + " red"],
  made("FS1:off, FS2:lead, FS3:lag, FS4:alarm"), "MAKE CONTROL for a station's question: pump 1 on / pump 2 on / emergency high, drawn as written and run as a duplex"));
C.push(st("C-control-all-pumps-on", QD, "CONTROL", [f("FS1", "all pumps off"), f("FS2", "lead pump on"), f("FS3", "all pumps on"), f("FS4", "high water alarm"), "alternator AR M1 M2", "coil M1 " + Q + "pump 1 starter" + Q, "coil M2 " + Q + "pump 2 starter" + Q, "horn AH1 FS4 " + Q + "high water" + Q],
  made("FS1:off, FS2:lead, FS3:lag, FS4:alarm"), "all pumps on: the lag (1.24.33 sent it back as two leads)"));
// the line handed back for C-jobless-top-down, copied: Lantern then sends the block back again (the levels upside down)
C.push({ id: "C-jobless-top-down-copied", harm: "medium", right: false, input: { q: QD },
  why: "What the model writes if it copies C-jobless-top-down's lines: a second round the bench does not have.",
  run: async function (x) {
    var m = lib.build(x.N.L, lib.sch("LS", ["pumps 2", f("FS4", "off", "5 ft"), f("FS3", "lead on", "4 ft"), f("FS2", "lag on", "3 ft"), f("FS1", "high level alarm", "2 ft")], "STATION"), QD);
    return m && !m.ok && /is not above/.test(lib.probs(m)) ? "the lines Lantern handed back, copied, are sent back again: " + lib.probs(m).slice(0, 300) : "";
  } });
module.exports = C;
