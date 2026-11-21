// cases_c.js -- C: a station question answered with the drawings' own blocks (read as STATION), and the turns of Chat and
// of the bench's solve around it: what is asked for once, what is sent back, and the grammar each call carries.
"use strict";
var H = require("./lib.js");
var fs = require("fs"), path = require("path");
var RUN = JSON.parse(fs.readFileSync(path.join(H.ROOT, "tests/fixtures/liftstation_1230/run_35b.json"), "utf8"));
var Q = H.ADAM_Q;
var C3 = H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]);
var C4 = H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]);
var LV4 = H.blk("LEVELS", "Wet well", ["pump P1 P2", "float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22 3 ft", "float FS3 \x22lag on\x22 4 ft", "float FS4 \x22high level alarm\x22 5 ft"]);
var LV3 = H.blk("LEVELS", "Wet well", ["pump P1 P2", "float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22 3 ft", "float FS3 \x22high level alarm\x22 5 ft"]);
var P2 = H.blk("PIPING", "Lift station", ["well \x22wet well\x22", "pump P1 \x22pump 1\x22", "pump P2 \x22pump 2\x22", "valve V1 P1 plug", "valve V2 P2 plug", "header \x224 in force main\x22", "vent"]);
var P3 = H.blk("PIPING", "Lift station", ["pump P1", "pump P2", "pump P3"]);
function readAs(r) { return r && r.readAs === "STATION" ? "" : "not read as the station (" + (r ? (r.readAs || (r.plan && r.plan.mode) || "") + " " + (r.problems || []).join("; ") : "no block") + ")"; }
function RS(id, harm, q, text, right, o) { return H.C(id, harm, { question: q, reply: text }, right, function () { var r = H.build(text, q); return readAs(r) || H.stationRight(r, typeof o === "function" ? o() : o); }); }
var cases = [
  RS("C-01", "high", Q, RUN.replies[1].reply, "The 35B's own MAKE CONTROL (floats 'start high', 'stop low', 'alarm high high'; a lead/lag switch): read as the station; the piping and levels from its floats.",
    { pumps: 2, jobs: "off,lead,alarm" }),
  RS("C-02", "high", Q, C3, "A duplex control alone: the station, its levels the control's three floats.", { pumps: 2, jobs: "off,lead,alarm" }),
  RS("C-03", "medium", Q, P2, "The piping alone (plug valves, a 4 in force main): the station, its control and levels made, the piping as written.",
    { pumps: 2, check: function (p) { return p.views.piping.pumps.every(function (x) { return x.valveKind === "plug"; }) ? "" : "valves"; } }),
  RS("C-04", "medium", Q, LV4, "The levels alone with heights: the station; the levels as written (2, 3, 4, 5 ft) and the control from the same floats.", { pumps: 2, jobs: "off,lead,lag,alarm", heights: "2 ft,3 ft,4 ft,5 ft" }),
  RS("C-05", "medium", Q, H.blk("SCHEMATIC", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"]),
    "The control's lines under MAKE SCHEMATIC: read as the control, and the station.", { pumps: 2, jobs: "off,lead,alarm" }),
  RS("C-06", "medium", Q, H.blk("SCHEMATIC", "Plumbing", ["well \x22wet well\x22", "pump P1", "pump P2", "check CV1 P1", "check CV2 P2", "header \x22force main\x22"]),
    "The piping's lines under MAKE SCHEMATIC: read as the piping, and the station.", { pumps: 2 }),
  RS("C-07", "medium", Q, C4 + "\n\n" + P2 + "\n\n" + LV4, "All three blocks, agreeing: each as written, one station.", { pumps: 2, jobs: "off,lead,lag,alarm", heights: "2 ft,3 ft,4 ft,5 ft" }),
  H.C("C-08", "high", { question: Q, reply: C3 + "\n\n" + LV4 }, "A control of three floats (no lag) and levels of four (a lag float): they disagree, which is said; and nothing written about the station may claim what the control drawn does not do -- 'If the water still rises to FS3 (lag on), the other pump starts too' is false for a circuit with no lag call.",
    function () { var r = H.build(this.input.reply, Q), p = H.plan(r); if (!p) return "not drawn: " + (r.problems || []).join("; "); return (p.warn.length ? "" : "the disagreement is not said; ") + H.textOk(p); }),
  H.C("C-09", "medium", { question: Q, reply: C3 + "\n\n" + P3 }, "A duplex control and piping of three pumps: drawn as written they disagree (3 pumps piped, 2 started); that must be said, and the station must not say 2 pumps over a piping of 3 without it.",
    function () { var r = H.build(this.input.reply, Q), p = H.plan(r); if (!p) return "not drawn: " + (r.problems || []).join("; "); var a = H.agree(p); return a && !p.warn.some(function (w) { return /pump/.test(w); }) ? a + " -- and nothing is said (warn: " + p.warn.join(" | ") + ")" : ""; }),
  H.C("C-10", "medium", { question: Q, reply: P3 }, "The piping alone, of three pumps, for a 2 pump question: the station says 2 pumps (the question's) but the piping is drawn with 3 and the parts list lists 3 pumps and 2 starters; the disagreement must be said or the piping sent back.",
    function () { var r = H.build(this.input.reply, Q), p = H.plan(r); if (!p) return r.problems.length ? "" : "nothing drawn"; var a = H.agree(p); return a && !p.warn.length ? a + " -- nothing said" : ""; }),
  H.C("C-11", "medium", { question: Q, reply: C3 + "\n\n" + H.blk("LEVELS", "Wet well", ["pump P1 P2", "float FS1 \x22off\x22 4 ft", "float FS2 \x22lead on\x22 3 ft", "float FS3 \x22high level alarm\x22 5 ft"]) },
    "The control right, the levels' heights out of order: back once naming the block that is wrong (MAKE LEVELS), so the model can mend it. Sent back as 'your MAKE CONTROL block' with the control's guide and the control's grammar, the model cannot fix the heights in it.",
    function () {
      var r = H.build(this.input.reply, Q);
      if (r.ok) return "not sent back";
      var ft = H.L().aiAct.fixText(r, Q), fk = H.L().aiAct.fixKind(r);
      return /MAKE LEVELS|MAKE STATION/.test(ft.split("\n")[0]) && fk !== "CONTROL" ? "" : "the correction says “" + ft.split("\n")[0].slice(0, 90) + "…”, shows the control's guide, and is held to the " + fk + " grammar";
    }),
  H.C("C-12", "medium", { question: Q, reply: C3 + "\n\n" + LV4 },
    "The same tag FS3 for two floats (the control's high level alarm, the levels' lag on): each drawing as written, and then the parts list and the checks must name each float as its drawing does, or say plainly which tag differs. Lantern's parts list calls FS3 the lag float while the control drawn has FS3 as the alarm.",
    function () {
      var r = H.build(this.input.reply, Q), p = H.plan(r); if (!p) return "not drawn";
      var J = H.L().aiControl.floatJob, bad = [];
      (H.L().aiControl.parse({ lines: C3.split("\n").slice(1, -1) }).items || []).forEach(function (it) {
        if (it.role !== "float") return;
        var sf = p.spec.floats.filter(function (f) { return f.id === it.id; })[0];
        if (sf && sf.job !== J(it.label)) bad.push(it.id + " is the " + J(it.label) + " float on the control drawn, the " + sf.job + " float in the parts list and checks");
      });
      return bad.length && !p.warn.some(function (w) { return /FS3|tag/.test(w); }) ? bad.join("; ") + " (said only: " + p.warn.join(" | ") + ")" : "";
    }),
  H.C("C-13", "low", { question: Q, reply: H.blk("CONTROL", "Simplex", ["float FS1 M1 \x22off\x22", "float FS2 M1 \x22on\x22", "coil M1 \x22pump starter\x22"]) },
    "A one-pump control for a 2 pump question: back once with the line for two pumps; that line, copied as the model is shown it (on one line, commas and all) or a line each, is drawn.",
    function () {
      var r = H.build(this.input.reply, Q); if (r.ok) return "not sent back";
      var m = /like: (alternator [^]*)$/.exec(r.problems.join("; ")); if (!m) return "no line: " + r.problems.join("; ");
      var one = H.build(H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", m[1]]), Q), each = H.build(H.blk("CONTROL", "Duplex", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22"].concat(m[1].split(/,\s*/))), Q);
      return each.ok && one.ok ? "" : (each.ok ? "" : "a line each: " + each.problems.join("; ") + "; ") + (one.ok ? "" : "copied on one line as shown: " + one.problems.join("; "));
    }),
  H.C("C-14", "low", { question: "Draw the control circuit for a duplex lift station with an alternating relay", reply: C3 }, "One drawing asked for: the control as written, not read as the station.",
    function () { var r = H.build(this.input.reply, this.input.question); return !r.readAs && r.plan && r.plan.mode === "control" ? "" : "readAs " + r.readAs; }),
  H.C("C-15", "low", { question: "Draw the plumbing for a lift station", reply: P2 }, "The piping asked for alone: the piping, not the station.",
    function () { var r = H.build(this.input.reply, this.input.question); return !r.readAs && r.plan && r.plan.mode === "piping" ? "" : "readAs " + r.readAs; }),
  // ---- Chat ----------------------------------------------------------------------------------------------------
  H.C("C-16", "high", { question: Q, replies: [C4 + "\n\n" + P2 + "\n\n" + LV4] }, "Chat: the three drawings' blocks in one reply: one turn, read as the station, nothing asked again, no grammar.",
    function () { return H.turn(Q, this.input.replies).then(function (t) { var m = t.rec && t.rec.made; return t.calls === 1 && m && m.ok && m.readAs === "STATION" && !t.grammars.join("") ? "" : "calls " + t.calls + ", made " + (m && (m.readAs || m.block.kind)) + " ok " + (m && m.ok) + ", grammars " + t.grammars + (t.error ? " " + t.error : ""); }); }),
  H.C("C-17", "high", { question: Q, replies: ["MAKE DRAWING: Lift station\nrect 0 0 10 10\nEND", "MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND"] },
    "Chat: a picture on the grid for a station question: the station asked for once, held to its grammar, then made.",
    function () { return H.turn(Q, this.input.replies).then(function (t) { var m = t.rec && t.rec.made; return t.calls === 2 && t.grammars.join() === ",STATION" && m && m.ok && m.plan.mode === "station" ? "" : "calls " + t.calls + " grammars " + t.grammars + " made " + (m && m.block.kind) + (t.error ? " " + t.error : ""); }); }),
  H.C("C-18", "medium", { question: Q, replies: [H.blk("CONTROL", "Starter", ["stop PB1 M1", "start PB2 M1", "coil M1 \x22pump starter\x22"]), "MAKE STATION: Lift station\npumps 2\nEND"] },
    "Chat: a plain motor starter for a station question (no float, no alternator): the station asked for once, with its grammar.",
    function () { return H.turn(Q, this.input.replies).then(function (t) { var m = t.rec && t.rec.made; return t.calls === 2 && t.grammars.join() === ",STATION" && m && m.ok && m.plan.mode === "station" ? "" : "calls " + t.calls + " grammars " + t.grammars + " made " + (m && m.block.kind) + (t.error ? " " + t.error : ""); }); }),
  H.C("C-19", "medium", { question: Q, replies: ["MAKE STATION: Bad\npumps 2\nfloats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft\nEND", "MAKE STATION: Bad\npumps 2\nfloats off 4 ft, lead 3 ft, lag 5 ft, alarm 6 ft\nEND"] },
    "Chat: a station sent back and written wrong again: asked once (one correction), then shown as it can be drawn with what is wrong said; never a third call.",
    function () { return H.turn(Q, this.input.replies).then(function (t) { return t.calls === 2 && t.grammars.join() === ",STATION" ? "" : "calls " + t.calls + " grammars " + t.grammars + (t.error ? " " + t.error : ""); }); }),
  H.C("C-20", "medium", { question: Q, replies: [C3 + "\n\n" + H.blk("LEVELS", "Wet well", ["pump P1 P2", "float FS1 \x22off\x22 4 ft", "float FS2 \x22lead on\x22 3 ft", "float FS3 \x22high level alarm\x22 5 ft"]), C3 + "\n\n" + H.blk("LEVELS", "Wet well", ["pump P1 P2", "float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22 3 ft", "float FS3 \x22high level alarm\x22 5 ft"])] },
    "Chat: the levels block wrong beside a right control: the correction must let the model send the mended levels (the levels' block, or the station). Held to the control's grammar, a reply of two blocks (the control and the mended levels) cannot be written, and the heights are lost.",
    function () { return H.turn(Q, this.input.replies).then(function (t) { return t.grammars[1] === "CONTROL" ? "the correction is held to the CONTROL grammar (one MAKE CONTROL block): the mended MAKE LEVELS cannot be sent" : ""; }); }),
  // ---- the bench's path -------------------------------------------------------------------------------------
  H.C("C-21", "high", { question: "make-liftstation", replies: [C3] }, "solve: the control alone for the bench's lift station: read as the station, graded as passing, in one round.",
    function () { var it = H.bench().filter(function (x) { return x.id === "make-liftstation"; })[0]; return H.solve(it.q, this.input.replies).then(function (s) { var g = H.L().aiBench.grade(it, s.out.text, s.out); return g.pass && s.calls === 1 ? "" : "calls " + s.calls + " " + g.why; }); }),
  H.C("C-22", "medium", { question: "make-liftstation", replies: ["MAKE SHEET: Pumps\nPump | HP\nP1 | 5\nEND", "MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND"] },
    "solve: a sheet for the station question: the station asked for once, with the STATION grammar, then graded on it.",
    function () { var it = H.bench().filter(function (x) { return x.id === "make-liftstation"; })[0]; return H.solve(it.q, this.input.replies).then(function (s) { var g = H.L().aiBench.grade(it, s.out.text, s.out); return g.pass && s.grammars.join() === ",STATION" ? "" : "grammars " + s.grammars + " " + g.why; }); }),
  H.C("C-23", "medium", { question: "make-liftstation-b", replies: ["MAKE STATION: Station\npumps 2\nfloats off 1 m, lead 1.5 m, alarm 2.3 m\nEND"] },
    "solve: set B's lift station (a lag float that runs both) answered without a lag float: not a pass.",
    function () { var it = H.bench().filter(function (x) { return x.id === "make-liftstation-b"; })[0]; return H.solve(it.q, this.input.replies).then(function (s) { var g = H.L().aiBench.grade(it, s.out.text, s.out); return !g.pass ? "" : "passed with no lag float"; }); }),
  H.C("C-24", "medium", { question: "make-liftstation-b", replies: [RUN.replies[1].reply] },
    "solve: the 35B's own control (no lag float) for set B: read as the station (no lag), and not a pass, since set B asks for a lag float that runs both.",
    function () { var it = H.bench().filter(function (x) { return x.id === "make-liftstation-b"; })[0]; return H.solve(it.q, this.input.replies).then(function (s) { var g = H.L().aiBench.grade(it, s.out.text, s.out); return !g.pass ? "" : "passed with no lag float"; }); }),
  H.C("C-26", "medium", { question: "Draw a house with a red roof, then the control circuit and piping of a duplex lift station", replies: ["MAKE STATION: Lift station\npumps 2\nshow control piping\nEND", "MAKE DRAWING: House\nrect 0 0 10 10\nEND"] },
    "Chat, B-33's question: the station made, and the house asked for and made too. Taken whole, the turn ends with the station and the house is never asked for (1.24.30 lost it as well, in a CONTROL+PIPING split).",
    function () { return H.turn(this.input.question, this.input.replies).then(function (t) { var ks = (t.rec.mades || []).map(function (m) { return m.block && m.block.kind; }); if (!ks.length && t.rec.made) ks = [t.rec.made.block.kind]; return ks.indexOf("DRAWING") >= 0 ? "" : "made " + ks.join(", ") + " in " + t.calls + " call(s); the house was never asked for"; }); }),
  H.C("C-27", "high", { question: "Draw a motor starter circuit, then the piping and the float levels of a duplex lift station", replies: ["MAKE STATION: Lift station\npumps 2\nshow piping levels\nEND", "MAKE CONTROL: Motor starter\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\nEND"] },
    "Chat, B-34's question: the motor starter asked for and drawn, and the station's piping and levels. Taken whole, only the station is offered and made; the starter is never asked for (1.24.30 made it, as the question's CONTROL part).",
    function () { return H.turn(this.input.question, this.input.replies).then(function (t) { var ks = (t.rec.mades || []).map(function (m) { return m.block && m.block.kind; }); if (!ks.length && t.rec.made) ks = [t.rec.made.block.kind]; return ks.indexOf("CONTROL") >= 0 ? "" : "made " + ks.join(", ") + " in " + t.calls + " call(s); the motor starter was never asked for"; }); }),
  H.C("C-25", "low", { question: Q, replies: [LV4 + "\n\n" + P2] }, "The levels and the piping in one reply: one station, both as written, the control made.",
    function () { var r = H.build(this.input.replies[0], Q); return readAs(r) || (H.plan(r).given.sort().join() === "levels,piping" ? H.stationRight(r, { pumps: 2, heights: "2 ft,3 ft,4 ft,5 ft" }) : "given " + H.plan(r).given); })
];
module.exports = cases;
