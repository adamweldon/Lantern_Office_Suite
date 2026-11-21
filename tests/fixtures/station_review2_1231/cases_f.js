// cases_f.js -- F: what is written with the drawings (the parts list, how it works, the commissioning checks, what Lantern
// does not know, what it assumed) says what was drawn for THIS station: simplex, duplex, triplex, no alarm, two alarms, a
// low level alarm, a horn, no lights, heights or none, one drawing or two. People will act on these with nobody to ask.
"use strict";
var H = require("./lib.js");
var QS = H.Q_SEW;
function F(id, harm, q, lines, right, judge) {
  return H.C(id, harm, { question: q, block: H.sb(lines) }, right, function () {
    var r = H.build(this.input.block, q), p = H.plan(r);
    if (!p) return "not drawn: " + (r.problems || []).join("; ");
    return judge ? judge(p, r) : (H.agree(p) || H.textOk(p));
  });
}
function both(p) { return H.agree(p) || H.textOk(p); }
var cases = [
  F("F-01", "high", QS, ["pumps 2", "floats off lead lag alarm"], "The usual duplex: every sentence matches the circuit drawn (alternation, the lag runs both, the alarm light)."),
  F("F-02", "high", H.Q_SIMPLEX, [], "A simplex: 'the pump starts', no alternation, no lag, its alarm light."),
  F("F-03", "medium", QS, ["pumps 2", "floats off lead lag"], "No alarm float: no sentence about an alarm light Lantern drew (what Lantern does not know must not say 'The alarm Lantern draws is a light' when none is drawn; that no alarm was drawn is said)."),
  F("F-04", "medium", QS, ["pumps 2", "floats off lead alarm"], "No lag float: no 'both pumps run', no 'the other pump starts too'."),
  F("F-05", "medium", QS, ["pumps 2", "floats off lead lag alarm high high alarm", "alarm horn"],
    "Two alarms and a horn: the horn is drawn on the high high float only, so the checks must not say lifting the high level float sounds the horn."),
  F("F-06", "low", QS, ["pumps 2", "floats off lead lag alarm high high alarm", "alarm horn"], "The horn on the high high alarm float is labelled as such, not 'high level'.",
    function (p) { var c = H.ctl(p), h = H.outsOf(c, "horn")[0]; if (!h) return "no horn"; var f = p.spec.floats.filter(function (x) { return H.contactsOf(h).some(function (e) { return e.id === x.id; }); })[0]; return f && /high high/.test(f.label) && !/high high/.test(h.out.label) ? "the horn on " + f.id + " (" + f.label + ") is labelled “" + h.out.label + "”" : ""; }),
  F("F-07", "low", QS, ["pumps 2", "floats low level alarm, off, lead, lag, high level alarm"], "A low level alarm drawn: the checks test it too (lower the water, or lift... -- some check of its light)."),
  F("F-08", "low", QS, ["pumps 2", "floats off lead lag alarm", "lights none"], "No run lights: none said; the alarm light (still drawn) checked."),
  F("F-09", "medium", H.Q_TRIPLEX, ["pumps 3"], "Three pumps, no control drawn: no sentence about an alarm light 'Lantern draws'; the checks point to the controller's maker."),
  F("F-10", "low", H.Q_ANY, ["pumps 6"], "Six pumps, the float levels only: nothing written about a light or a valve that is not drawn as if it were.",
    function (p) { return H.textOk(p); }),
  F("F-11", "medium", QS, ["pumps 2", "floats off lead lag alarm", "alarm horn"], "One alarm and a horn: 'the alarm light and horn come on' -- both drawn on it."),
  F("F-12", "low", QS, ["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft", "show control piping"],
    "No float levels drawn: the checks must not send the reader to 'the drawing of the float levels' for each float's height.",
    function (p) { return !p.views.levels && /on the drawing of the float levels/.test(p.checks.run.join(" ")) ? "the checks refer to the drawing of the float levels, which was not drawn" : ""; }),
  F("F-13", "low", QS, ["pumps 2", "floats off lead lag alarm", "show control"],
    "The control only: the checks of valves (each shutoff valve, the check valve closing) name parts that are neither drawn nor in the parts list.",
    function (p) { var run = p.checks.run.join(" "); return !p.views.piping && /shutoff valve|check valve closes/.test(run) && !H.partRow(p, /valve/i).length ? "the checks test valves that are not drawn or listed" : ""; }),
  F("F-14", "low", QS, ["pumps 2", "floats off lead lag alarm", "show piping"],
    "The piping only: the checks describe an alternating relay changing over, and a light, that Lantern did not draw (the control should be said to be the panel's, as for three pumps).",
    function (p) { var run = p.checks.run.join(" "); return !p.views.control && /alternating relay changed over|alarm light comes on/.test(run) ? "the checks describe an alternating relay and an alarm light that were not drawn" : ""; }),
  F("F-15", "medium", QS, ["pumps 2", "float FS1 \x22off\x22", "float FS2 \x22lag off\x22", "float FS3 \x22lead on\x22", "float FS4 \x22lag on\x22", "float FS5 \x22high level alarm\x22"],
    "The lag pump's own off float (FS2): drawn so, and how it works says both run until the lag pump's off float stops it, then the lead pump on to FS1 -- not 'both run until the water is down to FS1'.",
    function (p) {
      var c = H.ctl(p); if (!c) return "no control";
      var lagCall = c.rungs.filter(function (g) { return g.starts.some(function (e) { return e.id === "FS4"; }); })[0];
      var stopsAt = lagCall ? lagCall.stops.map(function (e) { return e.id; }).join() : "";
      var said = /both run until the water is down to FS1/.test(p.sequence.plain.join(" "));
      return stopsAt === "FS2" && said ? "the lag call stops at FS2 (lag off), and how it works says both run until the water is down to FS1" : stopsAt !== "FS2" ? "the lag call stops at " + stopsAt : "";
    }),
  H.C("F-16", "medium", { question: QS, reply: H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22", "horn AH1 FS3 \x22high level\x22"]) },
    "Read as a station: the control written has a horn on the alarm and no light. The checks must say the horn sounds, and not that a light comes on.",
    function () { var r = H.build(this.input.reply, QS), p = H.plan(r); if (!p) return "not drawn"; return H.textOk(p); }),
  H.C("F-17", "low", { question: QS, block: H.sb(["pumps 2", "note <b>Call</b> & \x22check\x22 the pumps", "floats off lead lag alarm"]) }, "The Writer document escapes what the block wrote (a note with < and &).",
    function () {
      var r = H.build(this.input.block, QS), L = H.L(), got = null, cr0 = L.writerDocs && L.writerDocs.create;
      if (!cr0) return "no Writer";
      L.writerDocs.create = function (t, h) { got = h; return cr0.call(L.writerDocs, t, h); };
      try { r.open(); } catch (e) { } L.writerDocs.create = cr0;
      if (!got) return "nothing opened";
      return /<b>Call<\/b>/.test(got) ? "the note's markup is in the document unescaped" : /undefined|null/.test(got.replace(/<[^>]*>/g, "")) ? "the document says undefined or null" : "";
    }),
  H.C("F-18", "medium", { question: QS, block: H.sb(["pumps 2", "floats off lead lag alarm"]) }, "The Writer document holds each drawing's section, the parts table (one row each), how it works, the checks, what is not known, and the sources.",
    function () {
      var r = H.build(this.input.block, QS), L = H.L(), got = null, cr0 = L.writerDocs.create, p = H.plan(r);
      L.writerDocs.create = function (t, h) { got = h; return cr0.call(L.writerDocs, t, h); };
      try { r.open(); } catch (e) { } L.writerDocs.create = cr0;
      if (!got) return "nothing opened";
      var rows = (got.match(/<tr>/g) || []).length - 1;
      return /<h2>Control circuit<\/h2>/.test(got) && /<h2>Piping<\/h2>/.test(got) && /<h2>Float levels<\/h2>/.test(got) && rows === p.parts.length && /<h2>Checks when it is set to work<\/h2>/.test(got) && /Sources:/.test(got) ? "" : "rows " + rows + " of " + p.parts.length;
    }),
  F("F-19", "medium", QS, ["pumps 2", "floats off lead lag alarm"], "The parts list: each drawn device once with its tag -- 2 pumps, 2 check valves, 2 shutoff valves, 4 floats, 2 starters, 2 overloads, 2 call relays, the alternating relay, 3 lights -- and the quantities match the tags.",
    function (p) {
      var want = { "^Pump": 2, "^Check valve": 2, "^Shutoff valve": 2, "^Float switch": 4, "^Motor starter": 2, "^Overload": 2, "^Control relay": 2, "^Alternating relay": 1, "^Pilot light": 3 }, bad = [];
      Object.keys(want).forEach(function (k) { var rows = H.partRow(p, new RegExp(k)), n = rows.reduce(function (a, x) { return a + x.qty; }, 0); if (n !== want[k]) bad.push(k.slice(1) + " " + n); });
      p.parts.forEach(function (x) { var nt = x.tags ? x.tags.split(/,\s*/).length : 0; if (nt && nt !== x.qty) bad.push(x.item.slice(0, 30) + " qty " + x.qty + " tags " + nt); });
      return bad.join("; ");
    }),
  F("F-20", "low", H.Q_SIMPLEX, ["pumps 1", "floats off lead alarm"], "A simplex's parts list: one pump, one check, one shutoff, one starter, one overload, no alternating relay, no call relay.",
    function (p) { return H.partRow(p, /^Alternating relay|^Control relay/).length ? "an alternating or call relay listed" : H.partTags(p, /^Motor starter/) === "M1" ? "" : "starters " + H.partTags(p, /^Motor starter/); }),
  F("F-21", "medium", QS, ["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft", "well \x22wet well\x22 10 ft", "inlet \x228 in gravity sewer\x22 6.5 ft", "supply \x22120 V AC\x22", "valves plug", "main \x224 in force main\x22"], "Everything given: every sentence true of the drawings.", both),
  F("F-22", "low", QS, ["pumps 2", "floats off lead lag alarm", "supply \x2224 V DC\x22"], "The control supply in the parts list as given.", function (p) { return H.partRow(p, /^Control supply: 24 V DC/).length ? "" : "no control supply row"; }),
  F("F-23", "medium", QS, ["pumps 2", "floats off lead lag alarm", "lights none", "alarm horn"], "No lights and a horn: the alarm light still drawn and the horn; the checks say both.", both),
  F("F-24", "low", QS, ["pumps 2", "floats low level alarm, off, lead, alarm"], "A low level alarm and no lag: how it works says the low level alarm comes on below its float.",
    function (p) { return /falls below FS1 \(low level alarm\), its alarm comes on/.test(p.sequence.plain.join(" ")) ? "" : JSON.stringify(p.sequence.plain); }),
  F("F-25", "high", H.ADAM_Q, ["pumps 2", "floats off lead lag alarm"], "Adam's question: the checks begin with the electrician, never going into the wet well (OSHA 1910.146), lockout (1910.147), in that order; and every line is about this station.",
    function (p) { var b = p.checks.before; return /licensed electrician/.test(b[0]) && /1910\.146/.test(b[1]) && /1910\.147/.test(b[2]) ? both(p) : "the first checks are not as they should be"; })
];
module.exports = cases;
