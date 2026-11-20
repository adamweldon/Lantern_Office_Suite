// cases_station.js -- area C: MAKE LEVELS (the wet well in section, each float at its height) and MAKE PIPING (the
// pumps, check and shutoff valves in a vault, the header and force main), every unit and wording a model or a
// tradesman uses; what Lantern says from the standards it cites; and which questions reach these two tools.
"use strict";
var FT = 0.3048, IN = 0.0254;
var CASES = [];
function near(a, b) { return a != null && b != null && Math.abs(a - b) < 0.003; }
// a levels block that must draw with these heights (metres above the floor), to scale; inlet: its height too
function lv(id, body, want, right, harm, more) {
  CASES.push({ id: id, q: "Draw the float levels in the wet well of a duplex lift station", input: "MAKE LEVELS: Wet well\n" + body.join("\n") + "\nEND", right: right, harm: harm || "high",
    run: function (H) {
      var r = H.levels(body, this.q);
      if (!r) return "no block read";
      if (!r.ok) return "sent back: " + r.problems.join(" | ");
      var got = H.heights(r), bad = [];
      Object.keys(want).forEach(function (k) { if (k !== "inlet" && !near(got[k], want[k])) bad.push(k + " at " + (got[k] == null ? "no height" : got[k] + " m") + " (written " + want[k].toFixed(3) + " m)"); });
      if (bad.length) return "heights read wrong: " + bad.join("; ") + " -- labelled " + r.plan.floats.map(function (f) { return f.id + " " + f.height; }).join(", ");
      var sc = H.scaleOk(r, want); if (sc) return "drawn out of scale: " + sc;
      if (want.inlet != null) {
        var ys = H.levelYs(r), f0 = r.plan.floats[0], k = (590 - ys[0]) / got[f0.id], iy = H.inletY(r);
        var im = iy == null ? null : (590 - iy) / k;
        if (!near(im, want.inlet) && !(im != null && Math.abs(im - want.inlet) < 0.01)) return "the inlet is drawn at " + (im == null ? "no height" : im.toFixed(3) + " m") + " above the floor; it is at " + want.inlet.toFixed(3) + " m";
      }
      return more ? more(H, r) || "" : "";
    } });
}
// a levels block that must go back; want(problems) -> "" when what goes back is right
function lvBack(id, body, want, right, harm) {
  CASES.push({ id: id, q: "Draw the float levels in the wet well of a duplex lift station", input: "MAKE LEVELS: Wet well\n" + body.join("\n") + "\nEND", right: right, harm: harm || "medium",
    run: function (H) { var r = H.levels(body, this.q); if (!r) return "no block read"; if (r.ok) return "drew it: " + r.plan.floats.map(function (f) { return f.id + " " + f.height; }).join(", "); return want(r.problems.join(" | ")) || ""; } });
}
var FS = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"'];
function withH(hs) { return FS.map(function (l, i) { return l + " " + hs[i]; }); }
function W(a, b, c, d) { return { FS1: a, FS2: b, FS3: c, FS4: d }; }
// ---- units and wordings -----------------------------------------------------------------------------------------------
lv("C-lv-feet", withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "The instructions' own heights in feet: to scale.");
lv("C-lv-feet-prime", withH(["2.0'", "3.5'", "4.5'", "5.5'"]), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "Feet written with a prime (2.0').");
lv("C-lv-feet-words", withH(["2 feet", "3 feet 6 inches", "4 feet 6 inches", "5 feet 6 inches"]), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "\"3 feet 6 inches\" is three and a half feet.");
lv("C-lv-ft-in-space", withH(["1' 6\"", "3' 0\"", "4' 6\"", "6' 0\""]), W(1.5 * FT, 3 * FT, 4.5 * FT, 6 * FT), "3' 6\" (a space between) is 3.5 ft.");
lv("C-lv-ft-in-nospace", withH(["1'6\"", "3'0\"", "4'6\"", "6'0\""]), W(1.5 * FT, 3 * FT, 4.5 * FT, 6 * FT), "3'6\" is 3.5 ft.");
lv("C-lv-ft-in-dash", withH(["1'-6\"", "3'-0\"", "4'-6\"", "6'-0\""]), W(1.5 * FT, 3 * FT, 4.5 * FT, 6 * FT),
  "3'-6\" (with the dash, as every US drawing writes feet and inches) is 3 ft 6 in. Lantern read 1'-6\" as 1 ft, 4'-6\" as 4 ft: every float drawn at the wrong height and labelled \"1 ft\", \"4 ft\", with nothing said.", "high");
lv("C-lv-ft-in-dash-and-inlet", withH(["1'-6\"", "3'-0\"", "4'-6\"", "6'-0\""]).concat(['inlet "inlet invert" 7\'-6"']), { FS1: 1.5 * FT, FS2: 3 * FT, FS3: 4.5 * FT, FS4: 6 * FT, inlet: 7.5 * FT },
  "The same with the inlet at 7'-6\": everything at its height.", "high");
lvBack("C-lv-ft-in-dash-collide", withH(["1'-6\"", "3'-0\"", "3'-6\"", "4'-6\""]), function (p) { return "sent back: " + p; },
  "1'-6\", 3'-0\", 3'-6\", 4'-6\" are in order and right: draw them. Lantern read 3'-6\" as 3 ft and sent the block back saying FS3 (lag on) at 3 ft is not above FS2 at 3 ft -- a right block spoiled, with a false reason.", "high");
CASES[CASES.length - 1].run = function (H) { var r = H.levels(withH(["1'-6\"", "3'-0\"", "3'-6\"", "4'-6\""]), this.q); return r.ok && near(H.heights(r).FS3, 3.5 * FT) ? "" : "sent back: " + (r.ok ? "drew FS3 at " + H.heights(r).FS3 : r.problems.join(" | ")); };
lv("C-lv-ft-dash-in-words", withH(["1 ft-6 in", "3 ft-0 in", "4 ft-6 in", "6 ft-0 in"]), W(1.5 * FT, 3 * FT, 4.5 * FT, 6 * FT), "\"4 ft-6 in\" is 4.5 ft.", "high");
lv("C-lv-inches", withH(["18 in", "36 in", "42 in", "54 in"]), W(18 * IN, 36 * IN, 42 * IN, 54 * IN), "Inches; and the note that FS2 and FS3 are 6 in apart (under 12 in) is true.", "high",
  function (H, r) { return /FS2 and FS3 are 152 mm \(6 in\) apart/.test(r.plan.said.join(" ")) ? "" : "the 6 in note is missing: " + r.plan.said.join("; "); });
lv("C-lv-mm", withH(["600 mm", "1050 mm", "1350 mm", "1650 mm"]), W(0.6, 1.05, 1.35, 1.65), "Millimetres.");
lvBack("C-lv-mm-thousands-comma", withH(["600 mm", "1,050 mm", "1,350 mm", "1,650 mm"]), function (p) { return "sent back: " + p; },
  "1,050 mm is one thousand and fifty millimetres (a float is never set at 1.05 mm): draw it. Lantern read \"1,050 mm\" as 1.050 mm and sent back \"FS2 at 1.050 mm is not above FS1 at 600 mm\".", "medium");
CASES[CASES.length - 1].run = function (H) { var r = H.levels(withH(["600 mm", "1,050 mm", "1,350 mm", "1,650 mm"]), this.q); return r.ok && near(H.heights(r).FS2, 1.05) ? "" : "sent back: " + (r.ok ? "FS2 at " + H.heights(r).FS2 : r.problems.join(" | ")); };
lvBack("C-lv-mm-thousands-space", withH(["600 mm", "1 050 mm", "1 350 mm", "1 650 mm"]), function (p) { return "sent back: " + p; },
  "1 050 mm (the SI way of grouping digits) is 1050 mm: draw it at 1.05 m.", "medium");
CASES[CASES.length - 1].run = function (H) { var r = H.levels(withH(["600 mm", "1 050 mm", "1 350 mm", "1 650 mm"]), this.q); return r.ok && near(H.heights(r).FS2, 1.05) ? "" : (r.ok ? "drew FS2 at " + H.heights(r).FS2 + " m (labelled " + r.plan.floats[1].height + ")" : "sent back: " + r.problems.join(" | ")); };
lv("C-lv-cm", withH(["60 cm", "105 cm", "135 cm", "165 cm"]), W(0.6, 1.05, 1.35, 1.65), "Centimetres.");
lv("C-lv-m", withH(["0.6 m", "1.05 m", "1.35 m", "1.65 m"]), W(0.6, 1.05, 1.35, 1.65), "Metres.");
lv("C-lv-m-3-decimals", withH(["0.450 m", "0.900 m", "1.200 m", "1.500 m"]), W(0.45, 0.9, 1.2, 1.5), "0.450 m (three decimals) is 450 mm.");
lv("C-lv-m-decimal-comma", withH(["0,6 m", "1,05 m", "1,35 m", "1,65 m"]), W(0.6, 1.05, 1.35, 1.65), "A decimal comma (0,6 m).");
lv("C-lv-m-nospace", withH(["0.6m", "1.05m", "1.35m", "1.65m"]), W(0.6, 1.05, 1.35, 1.65), "1.05m with no space.");
lv("C-lv-above-floor-words", withH(["2 ft above floor", "3.5 ft above floor", "4.5 ft above floor", "5.5 ft above floor"]), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "\"2 ft above floor\".");
lv("C-lv-height-in-label", ['float FS1 "off at 2 ft"', 'float FS2 "lead on at 3.5 ft"', 'float FS3 "lag on at 4.5 ft"', 'float FS4 "alarm at 5.5 ft"'], W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "Heights written inside the label.");
lv("C-lv-job-first-lines", ["off 2 ft", "lead on 3.5 ft", "lag on 4.5 ft", "alarm 5.5 ft"], W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "Lines that begin with the job (off 2 ft).", "medium");
CASES[CASES.length - 1].run = function (H) { var r = H.levels(["off 2 ft", "lead on 3.5 ft", "lag on 4.5 ft", "alarm 5.5 ft"]); if (!r.ok) return "sent back: " + r.problems.join(" | "); var j = r.plan.floats.map(function (f) { return f.job + "@" + Math.round(f.m * 1000); }).join(","); return j === "off@610,lead@1067,lag@1372,alarm@1676" ? "" : j; };
lvBack("C-lv-unquoted-jobs", ["float FS1 off 2 ft", "float FS2 lead on 3.5 ft", "float FS3 lag on 4.5 ft", "float FS4 high level alarm 5.5 ft"], function (p) { return "sent back: " + p.slice(0, 260); },
  "float FS1 off 2 ft (the job without quotes) is as plain as it gets -- MAKE CONTROL reads the same words; draw it. Lantern sent back five problems, one of them \"there are no floats\" (there are four).", "medium");
CASES[CASES.length - 1].run = function (H) { var r = H.levels(["float FS1 off 2 ft", "float FS2 lead on 3.5 ft", "float FS3 lag on 4.5 ft", "float FS4 high level alarm 5.5 ft"]); if (r.ok) return ""; return "sent back: " + r.problems.slice(-1)[0].slice(0, 80) + " (and " + (r.problems.length - 1) + " more)"; };
lv("C-lv-35b-words-metres", ['well "Wet Well" 3 m', "pump P1 P2", 'float FS1 "Stop (Low)" 0.5 m', 'float FS2 "Start (High)" 1.2 m', 'float FS3 "Alarm (High-High)" 1.6 m', 'inlet "Inlet pipe" 2.0 m'],
  { FS1: 0.5, FS2: 1.2, FS3: 1.6, inlet: 2.0 }, "The 35B's own float words with metres and an inlet.");
lv("C-lv-lines-reversed", withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]).reverse(), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "Written top down: drawn bottom up, the same heights.");
// ---- elevations and depths -------------------------------------------------------------------------------------------
lv("C-lv-elevations", ["floor el. 95.0 ft"].concat(withH(["el. 97.0 ft", "el. 98.5 ft", "el. 99.5 ft", "el. 100.5 ft"]), ['inlet "inlet invert" el. 101.5 ft']), { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT, inlet: 6.5 * FT },
  "Elevations with the floor's: each float its elevation above the floor's; the inlet too.");
lv("C-lv-elevations-EL-caps", withH(["EL 97.0'", "EL 98.5'", "EL 99.5'", "EL 100.5'"]), { FS1: 0.427, FS2: 0.884, FS3: 1.189, FS4: 1.494 }, "EL 97.0' without a floor: drawn relative (the order and spacing right).", "medium");
lv("C-lv-elevations-word", ["floor elevation 95.0 ft"].concat(withH(["elevation 97.0 ft", "elevation 98.5 ft", "elevation 99.5 ft", "elevation 100.5 ft"])), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "\"elevation 97.0 ft\".");
lv("C-lv-elevations-4-digits", ["floor el. 1045.0 ft"].concat(withH(["el. 1047.0 ft", "el. 1048.5 ft", "el. 1049.5 ft", "el. 1050.5 ft"])), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "Elevations over 1000 ft (most of inland America).");
lv("C-lv-elevations-thousands-comma", ["floor el. 1,045.0 ft"].concat(withH(["el. 1,047.0 ft", "el. 1,048.5 ft", "el. 1,049.5 ft", "el. 1,050.5 ft"])), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT),
  "el. 1,047.0 ft (a thousands comma, as survey drawings write it): drawn and labelled as written. Lantern drew the right spacing but labelled the floats \"el. 047.0 ft\", \"el. 048.5 ft\" -- elevations that are not there.", "medium",
  function (H, r) { var t = r.plan.floats.map(function (f) { return f.height; }).join(", "); return /1,?047/.test(t) ? "" : "labelled " + t; });
lv("C-lv-elevations-negative-m", ["floor el. -3.5 m"].concat(withH(["el. -2.9 m", "el. -2.4 m", "el. -2.0 m", "el. -1.6 m"])), W(0.6, 1.1, 1.5, 1.9), "Negative elevations in metres (below datum).");
lv("C-lv-depths", ['well "wet well" 15 ft deep'].concat(withH(["13 ft below grade", "11.5 ft below grade", "10.5 ft below grade", "9.5 ft below grade"])), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT),
  "Depths below grade in a 15 ft well: 13 ft below grade is 2 ft above the floor.");
lv("C-lv-depths-inlet", ['well "wet well" 20 ft deep'].concat(withH(["18 ft below grade", "16 ft below grade", "15 ft below grade", "14 ft below grade"]), ['inlet "inlet invert" 12 ft below grade']),
  { FS1: 2 * FT, FS2: 4 * FT, FS3: 5 * FT, FS4: 6 * FT, inlet: 8 * FT },
  "With depths, the inlet's depth is turned into a height the same way: 12 ft below grade in a 20 ft well is 8 ft above the floor. Lantern turned the floats' depths and not the inlet's: the inlet drawn 12 ft above the floor, 4 ft too high, above everything.", "high");
lv("C-lv-depths-alarm-above-inlet", ['well "wet well" 20 ft deep'].concat(withH(["18 ft below grade", "16 ft below grade", "15 ft below grade", "13 ft below grade"]), ['inlet "inlet invert" 14 ft below grade']),
  { FS1: 2 * FT, FS2: 4 * FT, FS3: 5 * FT, FS4: 7 * FT },
  "Alarm 13 ft below grade, inlet invert 14 ft below grade: the alarm is a foot ABOVE the invert -- the sewer backs up before it sounds, and Lantern's own rule says so. It said nothing (it compared the alarm's height with the inlet's depth).", "high",
  function (H, r) { return /alarm[^;]*at or above the inlet/.test(r.plan.said.join("; ")) ? "" : "no note that the alarm is above the inlet's invert (notes: " + (r.plan.said.join("; ") || "none") + ")"; });
lv("C-lv-depths-false-inlet-notes", ['well "wet well" 20 ft deep'].concat(withH(["18 ft below grade", "16 ft below grade", "15 ft below grade", "14 ft below grade"]), ['inlet "inlet invert" 4 ft below grade']),
  { FS1: 2 * FT, FS2: 4 * FT, FS3: 5 * FT, FS4: 6 * FT },
  "The inlet 4 ft below grade is 16 ft above the floor, far above every float: no note may say a float is above it. Lantern said the alarm and the pump-on floats are at or above the inlet's invert -- false.", "medium",
  function (H, r) { var s = r.plan.said.join("; "); return /inlet/.test(s) ? "said: " + s.slice(0, 220) : ""; });
lv("C-lv-depth-word-no-well", withH(["depth 12 ft", "depth 10.5 ft", "depth 9.5 ft", "depth 8.5 ft"]), { FS1: 0.549, FS2: 1.006, FS3: 1.311, FS4: 1.615 },
  "Depths with no well depth: drawn in order with the spacing written (the floor is unknown).", "low");
lvBack("C-lv-well-diameter-and-depth", ['well "wet well" 6 ft diameter, 12 ft deep'].concat(withH(["2 ft", "4 ft", "7 ft", "9 ft"])), function (p) { return "sent back: " + p; },
  "\"6 ft diameter, 12 ft deep\": the well is 12 ft deep; the floats (up to 9 ft) fit. Lantern took the diameter as the depth and sent back \"the floats go higher than the well (6 ft below grade) is deep\".", "medium");
CASES[CASES.length - 1].run = function (H) { var r = H.levels(['well "wet well" 6 ft diameter, 12 ft deep'].concat(withH(["2 ft", "4 ft", "7 ft", "9 ft"]))); return r.ok ? "" : "sent back: " + r.problems.join(" | "); };
lv("C-lv-well-diameter-in-quotes", ['well "6 ft dia wet well" 12 ft'].concat(withH(["2 ft", "4 ft", "7 ft", "9 ft"])), W(2 * FT, 4 * FT, 7 * FT, 9 * FT), "A diameter inside the label is the label's.");
lv("C-lv-well-deep-in-label", ['well "deep wet well" 20 ft'].concat(withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"])), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "\"deep\" in the label does not make the floats depths.");
lv("C-lv-inlet-pipe-size-quoted", withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]).concat(['inlet "8 in gravity sewer" 6.5 ft']), { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT, inlet: 6.5 * FT }, "The pipe's size in quotes is not its height.");
lv("C-lv-inlet-pipe-size-unquoted", withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]).concat(["inlet 8 in sewer at 6.5 ft"]), { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT, inlet: 6.5 * FT },
  "\"inlet 8 in sewer at 6.5 ft\": the invert is at 6.5 ft (8 in is the pipe). Lantern put the invert at 8 in and noted the alarm and both pump-on floats are above it.", "low");
lv("C-lv-unicode-primes", withH(["1′-6″", "3′-0″", "4′-6″", "6′-0″"]), W(1.5 * FT, 3 * FT, 4.5 * FT, 6 * FT),
  "Typographic primes (1′-6″), as some models write them: feet and inches. Lantern found no heights, drew the order not to scale and asked for the heights the block already has.", "low");
lv("C-lv-mixed-inlet-elevation", withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]).concat(['inlet "inlet invert" el. 101.5 ft']), { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT },
  "Floats above the floor and the inlet as an elevation cannot be put together: back (as floats given two ways go back), not the inlet drawn 101.5 ft above the floor with the floats squeezed at the bottom.", "low",
  function (H, r) { var iy = H.inletY(r), ys = H.levelYs(r); return iy != null && iy < ys[ys.length - 1] - 200 ? "the inlet drawn 101.5 ft above the floor (y " + iy + "), the floats squeezed under it" : ""; });
CASES[CASES.length - 1].run = (function (base) { return function (H) { var r = H.levels(withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]).concat(['inlet "inlet invert" el. 101.5 ft'])); if (!r.ok) return ""; return base.call(this, H); }; })(CASES[CASES.length - 1].run);
// ---- order, spacing, the well, the jobs -------------------------------------------------------------------------------
lvBack("C-lv-out-of-order", withH(["2 ft", "4.5 ft", "3.5 ft", "5.5 ft"]), function (p) { return /FS3 \(lag on\) at 3\.5 ft is not above FS2 \(lead on\) at 4\.5 ft/.test(p) && /give FS3 a height above 4\.5 ft/.test(p) ? "" : p; },
  "Lead at 4.5 ft and lag at 3.5 ft: back, naming the place and what to write (give FS3 a height above 4.5 ft).");
lvBack("C-lv-alarm-under-lag", withH(["2 ft", "3.5 ft", "5 ft", "4.5 ft"]), function (p) { return /FS4 \(high level alarm\) at 4\.5 ft is not above FS3/.test(p) ? "" : p; }, "The alarm under the lag float: back.");
lvBack("C-lv-two-at-one-height", withH(["2 ft", "3.5 ft", "4.5 ft", "4.5 ft"]), function (p) { return /not above/.test(p) ? "" : p; }, "Lag and alarm at one height: back.", "low");
lvBack("C-lv-well-too-shallow", ['well "wet well" 5 ft'].concat(withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"])), function (p) { return /higher than the well/.test(p) ? "" : p; }, "An alarm float above the top of a 5 ft well: back.", "low");
lvBack("C-lv-some-heights", withH(["2 ft", "3.5 ft", "", ""]), function (p) { return /give every float its height above the floor, or none/.test(p) ? "" : p; }, "Two floats with heights and two without: back -- all or none.", "low");
lvBack("C-lv-mixed-kinds", withH(["2 ft", "el. 98.5 ft", "4.5 ft", "5.5 ft"]), function (p) { return /the same way/.test(p) ? "" : p; }, "Heights given two ways (above the floor, elevation): back.", "low");
lvBack("C-lv-no-floats", ['well "wet well" 10 ft', "pump P1 P2"], function (p) { return /there are no floats/.test(p) ? "" : p; }, "No floats: back with the float lines.", "low");
lv("C-lv-no-heights", ["pump P1 P2"].concat(FS), {}, "No heights: the order drawn and said to be not to scale.", "medium",
  function (H, r) { var ys = H.levelYs(r); return !r.plan.scaled && /Not to scale/.test(r.summary) && ys[0] > ys[1] && ys[1] > ys[2] && ys[2] > ys[3] ? "" : "not drawn in order, or not said to be not to scale"; });
lv("C-lv-close-floats-note", withH(["2 ft", "2.5 ft", "3.5 ft", "4.5 ft"]), W(2 * FT, 2.5 * FT, 3.5 * FT, 4.5 * FT), "Off and lead 6 in apart: drawn, and the note (Ontario: at least 300 mm, 12 in) given.", "medium",
  function (H, r) { return /FS1 and FS2 are 152 mm \(6 in\) apart; Ontario/.test(r.plan.said.join(" ")) ? "" : "no note"; });
lv("C-lv-12in-apart-no-note", withH(["2 ft", "3 ft", "4 ft", "5 ft"]), W(2 * FT, 3 * FT, 4 * FT, 5 * FT), "Floats exactly 12 in (304.8 mm) apart meet the 300 mm: no spacing note.", "low",
  function (H, r) { return /apart/.test(r.plan.said.join(" ")) ? "noted: " + r.plan.said.join("; ") : ""; });
lv("C-lv-two-alarms", withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]).concat(['float FS5 "high high alarm" 6.5 ft']), { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT, FS5: 6.5 * FT }, "A high level and a high-high alarm.");
lv("C-lv-redundant-off", ['float FS0 "redundant off" 1.5 ft'].concat(withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"])), { FS0: 1.5 * FT, FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT, FS4: 5.5 * FT }, "A redundant off under the off float.");
lv("C-lv-low-level-alarm", ['float FS0 "low level alarm" 1.5 ft', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS4 "high level alarm" 5.5 ft'], { FS0: 1.5 * FT, FS1: 2 * FT, FS2: 3.5 * FT, FS4: 5.5 * FT }, "A low level alarm under the off float.");
lv("C-lv-lag-and-alarm-one-float", ['float FS1 "off" 2 ft', 'float FS2 "lead on" 3.5 ft', 'float FS3 "lag on / high level alarm" 4.5 ft'], { FS1: 2 * FT, FS2: 3.5 * FT, FS3: 4.5 * FT }, "One float for lag and alarm.");
lv("C-lv-pump-on-off-alarm", ['float FS1 "pump off" 600 mm', 'float FS2 "pump on" 1000 mm', 'float FS3 "high water alarm" 1400 mm'], { FS1: 0.6, FS2: 1.0, FS3: 1.4 }, "A simplex's three floats.");
lv("C-lv-alarm-above-inlet-note", ["floor el. 95.0 ft"].concat(withH(["el. 97.0 ft", "el. 98.5 ft", "el. 99.5 ft", "el. 100.5 ft"]), ['inlet "inlet invert" el. 99.0 ft']), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT),
  "The alarm and the lag float above the inlet's invert: drawn, and both noted (the sewer backs up first).", "medium",
  function (H, r) { var s = r.plan.said.join("; "); return /alarm[^;]*at or above the inlet/.test(s) && /FS3 \(lag on[^;]*at or above the inlet/.test(s) ? "" : "notes: " + s; });
lv("C-lv-pumps-three", ["pump P1 P2 P3"].concat(withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"])), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "Three pumps on the floor.", "low",
  function (H, r) { return r.plan.pumps === 3 ? "" : r.plan.pumps + " pumps drawn"; });
lv("C-lv-says-submergence", withH(["2 ft", "3.5 ft", "4.5 ft", "5.5 ft"]), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT), "It says the off level is set by the pump maker's minimum submergence, which Lantern does not know.", "medium",
  function (H, r) { return /minimum submergence/.test(r.summary) && /Lantern does not know/.test(r.summary) ? "" : "not said"; });
// ---- piping ------------------------------------------------------------------------------------------------------------
function pp(id, body, right, harm, check, q) {
  CASES.push({ id: id, q: q || "Draw the plumbing schematic for a duplex sewage lift station", input: "MAKE PIPING: Lift station\n" + body.join("\n") + "\nEND", right: right, harm: harm || "high",
    run: function (H) { var r = H.piping(body, this.q); if (!r) return "no block read"; return check(r, H) || ""; } });
}
function pumpsOk(n, kinds) {
  return function (r) {
    if (!r.ok) return "sent back: " + r.problems.join(" | ");
    var p = r.plan.pumps;
    if (p.length !== n) return p.length + " pumps drawn (want " + n + ")";
    if (!p.every(function (x) { return x.check && x.valve; })) return "a pump without its check or shutoff valve";
    if (r.plan.order.join() !== "pump,check,shutoff,header") return "valves in the wrong order";
    if (kinds && p.map(function (x) { return x.valveKind; }).join() !== kinds) return "shutoff kinds " + p.map(function (x) { return x.valveKind; }).join();
    return "";
  };
}
pp("C-pp-full-duplex", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', "check CV1 P1", "check CV2 P2", "valve V1 P1 plug", "valve V2 P2 plug", 'header "4 in force main"', "vent"],
  "A full duplex: each pump through its check valve then its plug valve in the vault, to the force main; nothing added.", "high", function (r) { return pumpsOk(2, "plug,plug")(r) || (r.plan.added.length ? "added: " + r.plan.added.join("; ") : ""); });
pp("C-pp-example-copied", ['well "wet well"', 'inlet "8 in gravity sewer"', 'pump P1 "pump 1"', "check CV1 P1", "valve V1 P1 plug", 'header "4 in force main"', "vent"],
  "The instructions' piping example copied as it stands has ONE pump (\"pump P1\"). For a duplex station's question a small model copies it, and gets a one-pump station: the example should show the station asked about (two pumps), as MAKE LEVELS' shows \"pump P1 P2\" (rule 1: what the model most likely writes should come out right).", "medium",
  function (r) { return r.ok && r.plan.pumps.length === 2 ? "" : "the copied example draws " + (r.plan ? r.plan.pumps.length : 0) + " pump for a two-pump station's question"; });
pp("C-pp-pumps-only", ["pump P1", "pump P2"], "Two pumps and nothing else: Lantern adds the well, inlet, check and shutoff valves, header and force main and vent, and says so with why.", "high",
  function (r) { var e = pumpsOk(2)(r); if (e) return e; var a = r.plan.added.join("; "); return /check valves CV1 on P1 and CV2 on P2 \(each pump needs one/.test(a) && /shutoff valves V1 on P1 and V2 on P2/.test(a) && /inverted J vent/.test(a) ? "" : "added said: " + a; });
pp("C-pp-pumps-2-line", ['well "wet well"', "pumps 2", 'header "force main"'], "\"pumps 2\": two pumps.", "medium", pumpsOk(2));
pp("C-pp-pump-P1-P2-line", ["pump P1 P2", 'header "force main"'], "\"pump P1 P2\": two pumps.", "medium", pumpsOk(2));
pp("C-pp-35b-words", ['well "Wet well"', 'inlet pipe "8 in"', 'pump P1 "Pump 1"', 'pump P2 "Pump 2"', "discharge pipe P1", "discharge pipe P2", "check valve CV1 P1", "check valve CV2 P2", "gate valve GV1 P1", "gate valve GV2 P2", 'discharge header "4 in"', "vent pipe"],
  "The 35B's own words (gate valve, check valve, discharge header, vent pipe): its gate valves AFTER the check valves (the 35B's prose had them before: drawn right by construction).", "high", function (r) { return pumpsOk(2, "gate,gate")(r); });
pp("C-pp-valve-lines-first", ["pump P1", "pump P2", "valve V1 P1 gate", "valve V2 P2 gate", "check CV1 P1", "check CV2 P2", 'header "force main"'], "Shutoff lines written before the checks: still drawn check first.", "high", pumpsOk(2, "gate,gate"));
pp("C-pp-swing-check", ['well "wet well"', 'pump P1 "pump 1"', 'pump P2 "pump 2"', "swing check valve CV1 P1", "swing check valve CV2 P2", "gate valve GV1 P1", "gate valve GV2 P2", 'force main "4 in DIP"', "vent"],
  "\"swing check valve CV1 P1\": a swing check is the commonest check valve on a sewage pump's discharge (Ten States 42.52 even recommends outside levers on swing checks). Draw it as the check valve. Lantern sent it back as \"not a part Lantern draws\" with a list of parts -- a right block spoiled.", "medium", pumpsOk(2, "gate,gate"));
pp("C-pp-ball-check", ["pump P1", "pump P2", "ball check valve CV1 P1", "ball check valve CV2 P2", "plug valve PV1 P1", "plug valve PV2 P2", 'header "6 in force main"'],
  "\"ball check valve CV1 P1\": a ball check is a check valve (Ten States 42.52 names ball checks). Lantern read it as a ball (shutoff) valve and sent back \"P1 has two shutoff valves (CV1 and PV1)\" -- false, and a right block spoiled.", "medium", pumpsOk(2, "plug,plug"));
pp("C-pp-check-tagged-cv-as-valve", ["pump P1", "pump P2", 'valve CV1 P1 "check"', 'valve CV2 P2 "check"', "valve GV1 P1 gate", "valve GV2 P2 gate", 'header "force main"'],
  "valve CV1 P1 \"check\": the label and the tag say check valve; not a second shutoff valve.", "low", pumpsOk(2, "gate,gate"));
pp("C-pp-non-return-rising-main", ["pump P1", "pump P2", "non-return valve NRV1 P1", "non-return valve NRV2 P2", "isolating valve IV1 P1", "isolating valve IV2 P2", 'rising main "100 mm rising main"'],
  "British words (non-return valve, isolating valve, rising main): drawn; the force main labelled as written (\"100 mm rising main\"), not \"main 100 mm rising main\".", "low",
  function (r) { var e = pumpsOk(2)(r); if (e) return e; return r.plan.main === "100 mm rising main" ? "" : "the main labelled “" + r.plan.main + "”"; }, "Draw the pipework for a two pump sewage pumping station");
pp("C-pp-butterfly", ["pump P1", "pump P2", "check CV1 P1", "check CV2 P2", "butterfly valve BV1 P1", "butterfly valve BV2 P2", 'header "force main"'], "Butterfly shutoff valves.", "medium", pumpsOk(2, "butterfly,butterfly"));
pp("C-pp-eccentric-plug", ["pump P1", "pump P2", "eccentric plug valve PV1 P1", "eccentric plug valve PV2 P2", 'header "force main"'], "Eccentric plug valves (check valves added).", "medium", pumpsOk(2, "plug,plug"));
pp("C-pp-check-on-pump-id", ["pump P1", "pump P2", "check P1", "check P2", "valve P1", "valve P2", 'header "force main"'], "\"check P1\" (the pump's tag only): the check valve on P1.", "medium", pumpsOk(2));
pp("C-pp-unnamed-valves", ["pump P1", "pump P2", "check valve", "check valve", "gate valve", "gate valve", 'header "force main"'], "Valves with no tags: one of each on each pump, and said.", "medium",
  function (r) { return pumpsOk(2, "gate,gate")(r) || (/is on P1’s discharge/.test(r.summary) ? "" : "not said which pump each is on"); });
pp("C-pp-lowercase", ['well "wet well"', "pump p1", "pump p2", "check cv1 p1", "check cv2 p2", "valve v1 p1 plug", "valve v2 p2 plug", 'header "force main"'], "Lower-case tags.", "medium", pumpsOk(2, "plug,plug"));
pp("C-pp-three-pumps", ["pump P1", "pump P2", "pump P3", 'header "8 in force main"'], "A triplex: three pumps, each with its valves.", "medium", pumpsOk(3), "Draw the piping of a triplex lift station");
pp("C-pp-simplex", ['well "sump"', "pump P1", "check CV1 P1", "valve V1 P1 ball", 'header "2 in discharge"'], "A simplex sump: one pump, its check then ball valve.", "medium", pumpsOk(1, "ball"), "Draw the piping for a simplex sump pump station");
pp("C-pp-five-pumps", ["pump P1", "pump P2", "pump P3", "pump P4", "pump P5"], "Five pumps: back (four at most).", "low", function (r) { return !r.ok && /4 pumps or fewer/.test(r.problems.join(" ")) ? "" : "drawn or other problem"; });
pp("C-pp-no-pump", ['well "wet well"', 'header "force main"'], "No pump: back with the pump line.", "low", function (r) { return !r.ok && /pump P1/.test(r.problems.join(" ")) ? "" : r.problems.join(" | "); });
pp("C-pp-two-checks-one-pump", ["pump P1", "pump P2", "check CV1 P1", "check CV2 P1", 'header "force main"'], "Two check valves named on P1: back, one each.", "low", function (r) { return !r.ok && /P1 has two check valves/.test(r.problems.join(" ")) ? "" : "drawn"; });
pp("C-pp-air-release-and-main-check", ["pump P1", "pump P2", "check CV1 P1", "check CV2 P2", "valve V1 P1 plug", "valve V2 P2 plug", 'header "4 in force main"', "air release valve ARV1", 'check CV3 "force main check"'],
  "An air release valve and a check on the force main: drawn on the main after the vault, said.", "medium",
  function (r) { var e = pumpsOk(2, "plug,plug")(r); if (e) return e; var m = r.plan.mainValves.map(function (v) { return v.id + ":" + v.kind; }).join(); return /ARV1:air release/.test(m) && /CV3/.test(m) && /on the force main, after the vault/.test(r.summary) ? "" : "main valves " + m; });
pp("C-pp-bypass", ["pump P1", "pump P2", 'valve BP1 "bypass connection" plug', 'header "force main"'], "A bypass connection valve: on the main, not a pump's.", "low",
  function (r) { return r.ok && r.plan.mainValves.some(function (v) { return v.id === "BP1"; }) ? "" : "BP1 not on the main"; });
pp("C-pp-inlet-isolation-valve", ['inlet "8 in sewer"', 'valve V0 "inlet isolation gate"', "pump P1", "pump P2", 'header "force main"'],
  "\"valve V0 \\\"inlet isolation gate\\\"\" is a gate on the inlet sewer, not pump 1's discharge shutoff. Lantern put it on P1's discharge (and said so); right is the inlet's, or left out and said.", "low",
  function (r) { return r.ok && r.plan.pumps[0].valve === "V0" ? "drew the inlet's gate V0 as pump P1's discharge shutoff valve" : ""; });
pp("C-pp-header-and-force-main", ["pump P1", "pump P2", 'header "6 in header"', 'force main "6 in force main to manhole 4"'], "A header and the force main both named.", "low",
  function (r) { return r.ok && r.plan.header === "6 in header" && r.plan.main === "6 in force main to manhole 4" ? "" : JSON.stringify([r.plan && r.plan.header, r.plan && r.plan.main]); });
pp("C-pp-floats-in-piping", ['well "wet well"', "pump P1", "pump P2", 'float FS1 "off"', 'float FS2 "lead on"', 'header "force main"'], "Floats in the piping: left to MAKE LEVELS, said.", "low",
  function (r) { return r.ok && /floats are drawn by MAKE LEVELS/.test(r.summary) ? "" : "not said"; });
pp("C-pp-vault-named", ['well "wet well"', 'vault "valve chamber"', "pump P1", "pump P2", 'header "force main"'], "The vault named \"valve chamber\".", "low", pumpsOk(2));
pp("C-pp-inlet-from-manhole", ['inlet "8 in PVC from MH-3"', "pump P1", "pump P2", 'header "force main"'], "An inlet label with a manhole's name.", "low",
  function (r) { return r.ok && r.plan.inlets[0] === "8 in PVC from MH-3" ? "" : "inlet " + (r.plan && r.plan.inlets[0]); });
// ---- what Lantern says from the standards (opened 2026-11-20: the 2014 edition at extapps.dec.ny.gov, the 2004 at
// floridadep.gov, Ontario's chapter 7 at ontario.ca; through WebFetch's reader, which quotes up to 125 characters) ----
pp("C-std-42.52-check-before-shutoff", ["pump P1", "pump P2"],
  "Ten States (2014) 42.52: \"Suitable shutoff and check valves shall be placed on the discharge line of each pump\"; the check valve between the shutoff valve and the pump (both the 2014 and 2004 copies, read through WebFetch). Lantern's \"The check valve sits between the pump and the shutoff valve ... (42.52, 44.4)\" agrees.", "high",
  function (r) { return /The check valve sits between the pump and the shutoff valve/.test(r.summary) && /Recommended Standards for Wastewater Facilities, 2014: 42\.52, 44\.4/.test(r.summary) ? "" : "the statement changed: " + r.summary.slice(0, 200); });
pp("C-std-44.4-valves-in-vault", ["pump P1", "pump P2"],
  "Ten States (2014) 44.4, submersible stations: \"Valves required under Paragraph 42.5 shall be located in a separate valve chamber.\" Lantern draws the valves in a vault beside the well and says they are \"in a vault of their own, out of the wet well\": agrees.", "high",
  function (r) { return /valves are in a vault of their own, out of the wet well/.test(r.summary) ? "" : "not said"; });
pp("C-std-42.64-vent", ["pump P1", "pump P2"],
  "Ten States (2014) 42.64: covered wet wells shall have provisions for air displacement to the atmosphere, such as an inverted \"j\" tube. Lantern adds \"an inverted J vent (a covered wet well needs a way for air in and out)\": agrees.", "medium",
  function (r) { return /inverted J vent \(a covered wet well needs a way for air in and out\)/.test(r.summary) ? "" : "not said"; });
lv("C-std-ontario-7.2.5-300mm", withH(["2 ft", "2.5 ft", "3.5 ft", "4.5 ft"]), W(2 * FT, 2.5 * FT, 3.5 * FT, 4.5 * FT),
  "Ontario's Design Guidelines for Sewage Works (2008) 7.2.5: \"Float controls should be at least 300 mm (12 in) vertically and 450 mm (18 in) horizontally apart\". Lantern's note \"Ontario's design guidelines keep floats at least 300 mm (12 in) apart\" agrees (vertically).", "medium",
  function (H, r) { return /Ontario’s design guidelines keep floats at least 300 mm \(12 in\) apart/.test(r.plan.said.join(" ")) ? "" : "not said"; });
lv("C-std-lag-above-inlet-not-forbidden", ["floor el. 95.0 ft"].concat(withH(["el. 97.0 ft", "el. 98.5 ft", "el. 99.5 ft", "el. 100.5 ft"]), ['inlet "inlet invert" el. 99.25 ft']), W(2 * FT, 3.5 * FT, 4.5 * FT, 5.5 * FT),
  "Ontario 7.2.5 lets the lag pump start be above the inlet's invert where no basement flooding or solids deposition follow. Lantern's note on it says what happens (the sewer fills first) and does not call it forbidden or cite a standard for it: agrees.", "low",
  function (H, r) { var s = r.plan.said.join(" "); return /lag on[^;]*at or above the inlet/.test(s) && !/must|shall|not allowed|forbid|Ontario[^;]*inlet/i.test(s) ? "" : "said: " + s; });
// ---- which questions reach the piping and the levels --------------------------------------------------------------------
function route(id, q, want, right, harm) {
  CASES.push({ id: id, q: q, input: "(the question)", right: right, harm: harm || "medium",
    run: function (H) { var t = H.L.aiAct.relevant(q).map(function (a) { return a.id; }); var has = function (x) { return t.indexOf(x) >= 0; };
      if (want === "piping") return has("piping") ? "" : "offered " + (t.join(", ") || "nothing") + ", not the piping";
      if (want === "levels") return has("levels") ? "" : "offered " + (t.join(", ") || "nothing") + ", not the float levels";
      return !has("piping") && !has("levels") ? "" : "offered " + t.join(", "); } });
}
route("C-route-plumbing-schematic", "Draw the plumbing schematic for a lift station", "piping", "Plumbing of a lift station: the piping tool.", "high");
route("C-route-pipework-pumping-station", "Draw the pipework of a sewage pumping station", "piping", "Pipework: piping.");
route("C-route-discharge-piping", "Draw the discharge piping of a duplex lift station", "piping", "Discharge piping: piping.");
route("C-route-valves-and-pipes", "Draw a diagram of the valves and pipes in a sewage pump station", "piping", "\"the valves and pipes in a sewage pump station\" is its piping (Lantern matches \"pipes and valves\" only in that order).", "low");
route("C-route-force-main-and-valves", "Draw the force main and valves for a lift station", "piping", "The force main and valves of a lift station: piping.", "low");
route("C-route-float-levels", "Show me the float levels in the wet well of a duplex lift station", "levels", "Float levels: the levels tool.", "high");
route("C-route-on-off-levels", "Draw the pump on and off levels of a lift station", "levels", "Pump on and off levels: levels.");
route("C-route-wet-well-elevation", "Draw a wet well elevation showing pump start and stop levels for a sewage lift station", "levels", "A wet well elevation with start and stop levels: levels.");
route("C-route-float-settings", "Draw the float settings of a storm water pump station", "levels", "Float settings: levels.");
route("C-route-sump-float-levels", "Draw the float switch levels for a sump", "levels", "A sump's float levels: levels.", "low");
route("C-route-section-with-floats", "Draw a section of the wet well with the float switches for a lift station", "levels",
  "\"a section of the wet well with the float switches\" is exactly MAKE LEVELS' drawing; Lantern offered only the picture on the grid.", "medium");
route("C-route-where-floats-go", "Draw where the floats go in a lift station", "levels", "Where the floats go in a lift station: the levels; Lantern offered only the picture on the grid.", "medium");
route("C-route-floats-be-set", "Where should the floats be set in a lift station wet well? Draw it.", "levels", "Where the floats are set, drawn: levels; Lantern offered the picture on the grid.", "low");
route("C-route-bathroom-plumbing", "Draw the plumbing for a bathroom", "neither", "A bathroom's plumbing is not a pump station's.", "medium");
route("C-route-septic", "Draw a septic tank plumbing layout", "neither", "A septic tank: not a pump station's piping.", "low");
route("C-route-hydraulic-power-unit", "Draw the piping of a hydraulic power unit", "neither", "Hydraulic: not a pump station.", "medium");
route("C-route-fire-pump", "Draw a fire pump piping diagram", "neither", "A fire pump: not a sewage station.", "low");
route("C-route-boiler-levels", "Draw the water levels in a boiler's sight glass", "neither", "A boiler's levels: not a wet well.", "low");
module.exports = CASES;
