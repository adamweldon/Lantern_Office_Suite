// liftstation.js -- Adam's lift station (1.24.30): "create a diagram for a typical 2 pump lift station control with
// alternating relay. Then create a plumbing schematic for the same and a drawing showing float level positioning".
// The 35B on his laptop said it could not draw and described all three; asked for the block, it wrote
// "alternating AR M1 M2", which Lantern did not know, and then a block with pump 2 and the relay switched by nothing,
// and nothing was made (tests/fixtures/liftstation_1230/run_35b.json, transcribed from his screenshot). Now:
//  - MAKE CONTROL has the alternating relay: the 35B's own two blocks are drawn as written, the floats read by what
//    each is for, the call relays, the alternating relay and the pumps wired by Lantern, and what it moved said;
//  - MAKE PIPING and MAKE LEVELS (AI_PUMP_STATION) draw the station's piping and its floats' levels;
//  - a question that asks for several things is made one at a time (AI_PARTS): the instructions carry the first
//    part's tool and the list, the block is asked for with the list, and each next part with its own instructions,
//    in Chat and on the bench's path;
//  - without the new modules, Lantern boots clean and does what it did.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var RUN = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "liftstation_1230", "run_35b.json"), "utf8"));
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
function load(strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, o = { w: w, d: w.document, errs: errs, script: null };
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  function resp(status, body, type) {
    return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
      text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
  }
  w.fetch = function (url, opts) {
    url = String(url);
    if (/:8081\//.test(url)) return Promise.reject(new Error("no library"));
    if (/places\.txt$/.test(url)) return resp(404, "nf", "text/plain");
    if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-Q4_K_M.gguf" }] }), "application/json");
    if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
    var body = JSON.parse(opts.body);
    var r = o.script ? o.script(textOf(body.messages[body.messages.length - 1].content), body) : "ANSWER: ok";
    return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }), "application/json");
  };
  w.eval(js);
  var e = o.d.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); o.d.dispatchEvent(e);
  o.L = w.Lantern;
  return o;
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list, seen) { var i = 0; return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return { role: m.role, content: textOf(m.content) }; })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }

(async function () {
  var o = load(), L = o.L;
  await sleep(80);
  await L.ai.detect();
  var act = L.aiAct, C = L.CHAT, PT = L.aiParts, PS = L.aiPumpStation, CT = L.aiControl, Q = RUN.question;
  ok("boot clean, with the new parts", o.errs.length === 0 && PT && PS && CT.floatJob && act.relevant(Q).length, o.errs);
  function rungs(m) { var out = {}; m.plan.circuit.rungs.forEach(function (r) { out[r.out.id] = r; }); return out; }
  function ids(list, nc) { return (list || []).map(function (e) { return e.id + (e.nc ? "/" : ""); }).join(","); }

  // --- the 35B's own two blocks, as it wrote them ------------------------------------------------------
  var b1 = act.build(RUN.replies[1].reply, Q), r1 = b1.plan ? rungs(b1) : {};
  ok("the 35B's first block (“alternating AR M1 M2”) is drawn", b1.ok && b1.plan && b1.plan.circuit.verified, b1.problems);
  ok("...a lead call relay sealed in from the start float until the stop float opens", r1.CR1 && ids(r1.CR1.stops) === "FS2" && ids(r1.CR1.starts) === "FS1" && r1.CR1.seal && r1.CR1.out.label === "lead call", r1.CR1);
  ok("...the alternating relay AR fed by it, and the pumps on it in turn (M1 while AR is off, M2 while it is on)", r1.AR && r1.AR.out.kind === "alternator" && ids(r1.AR.series) === "CR1" &&
    ids(r1.M1.series) === "CR1,AR/,SS1" && ids(r1.M2.series) === "CR1,AR" && ids(r1.M1.after) === "OL1/" && ids(r1.M2.after) === "OL2/", [r1.AR, r1.M1, r1.M2]);
  ok("...the alarm light on the alarm float, not on AR, and said", ids(r1.LT3.series) === "FS3" && /LT3 \(alarm\) is lit by the alarm float FS3, not by AR/.test(b1.summary), b1.summary);
  ok("...the floats written on M1 said to call the pumps through CR1 and AR (the alarm float FS3 none), and no lag float said", /The floats FS1 and FS2 call the pumps through CR1 and the alternating relay AR, not straight/.test(b1.summary) && /FS3 is the alarm float: it sets off the alarm and runs no pump/.test(b1.summary) &&
    /There is no lag float, so one pump runs at a time/.test(b1.summary), b1.summary);
  ok("...what each rung does: the call, the change-over, the pumps taking turns", /When FS1 \(start high\) makes, CR1 \(lead call\) pulls in, and its own contact holds it in while FS2 \(stop low\) is made/.test(b1.summary) &&
    /AR \(alternating relay\) is fed while CR1 is on, and changes over each time it is let go: M1 and M2 take turns to lead/.test(b1.summary) && /M1 \(pump 1 starter\) is on while CR1 is on, AR has M1 leading/.test(b1.summary), b1.summary);
  var b2 = act.build(RUN.replies[2].reply, Q), r2 = b2.plan ? rungs(b2) : {};
  ok("the 35B's second block (coil CR1 “alternating relay”, switched by nothing) is drawn too, CR1 read as the alternating relay",
    b2.ok && r2.CR1 && r2.CR1.out.kind === "alternator" && r2.CR2 && r2.CR2.out.label === "lead call" && ids(r2.M2.series) === "CR2,CR1" && /CR1 \(alternating relay\) is drawn as an alternating relay/.test(b2.summary), [b2.problems, b2.summary]);

  // --- the usual duplex, with a lag float ---------------------------------------------------------------
  var DUPLEX = blk("CONTROL", "Duplex", ["supply \x22120 V AC\x22", "float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22lag on\x22", "float FS4 \x22high level alarm\x22",
    "alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22", "lamp LT1 M1 \x22pump 1 run\x22 green", "lamp LT2 M2 \x22pump 2 run\x22 green", "horn AH1 FS4 \x22high level\x22"]);
  var d = act.build(DUPLEX, "Draw the control for a duplex lift station"), rd = d.plan ? rungs(d) : {};
  ok("the usual duplex: lead and lag calls, each pump on (lead call and its turn) or the lag call, the horn on the alarm float",
    d.ok && ids(rd.CR1.starts) === "FS2" && ids(rd.CR2.starts) === "FS3" && ids(rd.CR2.stops) === "FS1" && JSON.stringify(rd.M1.branches.map(function (b) { return ids(b); })) === JSON.stringify(["CR1,AR/", "CR2"]) &&
    JSON.stringify(rd.M2.branches.map(function (b) { return ids(b); })) === JSON.stringify(["CR1,AR", "CR2"]) && ids(rd.AH1.series) === "FS4" && !/no lag float/.test(d.summary), [d.problems, rd.M1, rd.M2]);
  ok("...said as an either/or", /M1 \(pump 1 starter\) is on while either CR1 is on and AR has M1 leading, or CR2 is on; and the overload OL1 has not tripped/.test(d.summary), d.summary);
  var dLay = CT.layout(CT.circuit(CT.parse(act.find(DUPLEX)[0])), "Duplex");
  ok("...walked: no short, every coil between the rails, each branch's two contacts in a row", CT.verify(CT.circuit(CT.parse(act.find(DUPLEX)[0])), dLay).length === 0 &&
    dLay.els.filter(function (e) { return e.kind === "contact" && e.of === "AR"; }).length === 2, CT.verify(CT.circuit(CT.parse(act.find(DUPLEX)[0])), dLay));
  var noAlarmOut = act.build(blk("CONTROL", "D", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22high level alarm\x22", "alternator AR M1 M2", "coil M1", "coil M2"]), "duplex pumps");
  ok("an alarm float with no light or horn gets a high level alarm light, said", noAlarmOut.ok && /the high level alarm light LT1 on FS3/.test(noAlarmOut.summary), [noAlarmOut.problems, noAlarmOut.summary]);
  var lowAlarm = act.build(blk("CONTROL", "D", ["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS5 LT5 \x22low level alarm\x22", "lamp LT5 \x22low level\x22", "alternator AR M1 M2", "coil M1", "coil M2"]), "duplex pumps");
  ok("a low-level alarm float is left as written", lowAlarm.ok && ids(rungs(lowAlarm).LT5.series) === "FS5", lowAlarm.problems);
  function probs(lines) { var m = act.build(blk("CONTROL", "D", lines), "duplex pumps with an alternator"); return m.ok ? [] : m.problems; }
  ok("floats with no job named go back with the lines to write", /say what each float is for -- FS1 and FS2 do not -- like: float FS1 \x22off\x22, float FS2 \x22lead on\x22/.test(probs(["float FS1", "float FS2", "alternator AR M1 M2", "coil M1", "coil M2"]).join("|")),
    probs(["float FS1", "float FS2", "alternator AR M1 M2", "coil M1", "coil M2"]));
  ok("two lead floats, no stop float, an alternator for one pump: each goes back with what to write",
    /two floats for one job \(lead\)/.test(probs(["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22start\x22", "alternator AR M1 M2", "coil M1", "coil M2"]).join("|")) &&
    /the pumps need a float to stop them/.test(probs(["float FS2 \x22lead on\x22", "alternator AR M1 M2", "coil M1", "coil M2"]).join("|")) &&
    /alternator AR: name the two pump starters/.test(probs(["float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "alternator AR M1", "coil M1", "coil CR5"]).join("|")));
  ok("floatJob reads the 35B's names and the usual ones", ["stop low", "start high", "alarm high high", "off", "lead on", "lag on", "high level alarm", "pumps off", "lag pump start", "low level alarm"].map(CT.floatJob).join(",") ===
    "off,lead,alarm,off,lead,lag,alarm,off,lag,low");
  var plain = act.build(blk("CONTROL", "Starter", ["stop PB1", "start PB2 M1", "coil M1", "lamp LT1 M1"]), "Draw a motor starter with a seal-in contact");
  ok("a control circuit without an alternator is as before", plain.ok && /Press PB2/.test(plain.summary) && /M1’s holding contact across PB2/.test(plain.summary), plain.summary);
  ok("a pump station's control question is offered the alternator and the duplex example; a starter question is not",
    /alternator AR M1 M2 +an alternating relay/.test(act.prompt("Draw the control circuit for a duplex lift station")) && /MAKE CONTROL: Duplex pump station/.test(act.prompt("Draw the control circuit for a duplex lift station")) &&
    !/alternator/.test(act.prompt("Draw a motor starter with a seal-in contact")) && CT.asks("Draw the control for a duplex pump station") && CT.asks("Show the lead/lag pump control"));

  // --- MAKE PIPING ------------------------------------------------------------------------------------------
  var PIPE = blk("PIPING", "Lift station", ["well \x22wet well\x22", "inlet \x228 in gravity sewer\x22", "pump P1 \x22pump 1\x22", "pump P2 \x22pump 2\x22", "check CV1 P1", "valve V1 P1 plug", "header \x224 in force main\x22", "vent"]);
  var pp = act.build(PIPE, "Draw the piping for a 2 pump lift station");
  ok("MAKE PIPING draws the station: each pump through its check valve and then its shutoff valve, into the header", pp.ok && pp.plan.mode === "piping" &&
    JSON.stringify(pp.plan.pumps.map(function (p) { return [p.id, p.check, p.valve, p.valveKind]; })) === JSON.stringify([["P1", "CV1", "V1", "plug"], ["P2", "CV2", "V2", ""]]) && pp.plan.order.join(">") === "pump>check>shutoff>header", [pp.problems, pp.plan]);
  ok("...the valves left out are added and said, with the reason; the order and the vault are said with their source",
    /Lantern added the check valve CV2 on P2 \(each pump needs one/.test(pp.summary) && /the shutoff valve V2 on P2/.test(pp.summary) &&
    /The check valve sits between the pump and the shutoff valve, and the valves are in a vault of their own, out of the wet well \(Recommended Standards for Wastewater Facilities, 2014: 42\.52, 44\.4\)/.test(pp.summary), pp.summary);
  var least = act.build(blk("PIPING", "Station", ["pump P1", "pump P2"]), "Draw the piping for a 2 pump lift station");
  ok("...the least: two pumps; the well, inlet, header, vent and every valve added and said", least.ok && least.plan.pumps.length === 2 && /the wet well; the header and force main the pumps join; the inlet; an inverted J vent/.test(least.summary), least.summary);
  var pumps2 = act.build(blk("PIPING", "Station", ["pumps 2", "check CV1", "check CV2", "valve gate GV1 P2"]), "pump station piping");
  ok("...“pumps 2”, checks with no pump named go to the pumps in turn, a gate valve named on P2", pumps2.ok && JSON.stringify(pumps2.plan.pumps.map(function (p) { return [p.id, p.check, p.valve, p.valveKind]; })) === JSON.stringify([["P1", "CV1", "V1", ""], ["P2", "CV2", "GV1", "gate"]]), pumps2.plan || pumps2.problems);
  function pprobs(lines) { var m = act.build(blk("PIPING", "S", lines), "pump station piping"); return m.ok ? [] : m.problems; }
  ok("...what cannot be drawn goes back: a part it does not draw, a check on no pump, one valve too many, two checks on a pump",
    /“flange F1” is not a part Lantern draws in a pump station’s piping \(it draws: well, inlet, pump, check, valve, header, force main, vent, vault/.test(pprobs(["pump P1", "flange F1"]).join("|")) &&
    /CV1 names P9, which is not a pump here: name the pump it is on, like: check CV1 P1/.test(pprobs(["pump P1", "check CV1 P9"]).join("|")) &&
    // (the first review) a check valve more than the pumps is the force main's, and said
    /CV2 is on the force main, after the vault/.test(act.build(blk("PIPING", "S", ["pump P1", "check CV1", "check CV2"]), "pump station piping").summary) &&
    /P1 has two check valves \(CV1 and CV2\)/.test(pprobs(["pump P1", "pump P2", "check CV1 P1", "check CV2 P1"]).join("|")), [pprobs(["pump P1", "flange F1"]), pprobs(["pump P1", "check CV1 P9"])]);
  ok("...floats in a PIPING block are said to belong to MAKE LEVELS", /the floats are drawn by MAKE LEVELS/.test(act.build(blk("PIPING", "S", ["pump P1", "float FS1 \x22off\x22"]), "pump station piping").summary));

  // --- MAKE LEVELS ------------------------------------------------------------------------------------------
  var LEV = blk("LEVELS", "Wet well", ["well \x22wet well\x22 10 ft", "pump P1 P2", "float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22 3.5 ft", "float FS3 \x22lag on\x22 4.5 ft", "float FS4 \x22high level alarm\x22 5.5 ft", "inlet \x22inlet invert\x22 6.5 ft"]);
  var lv = act.build(LEV, "Draw the float levels in the wet well");
  ok("MAKE LEVELS draws the floats at their heights, from the bottom up, to scale", lv.ok && lv.plan.scaled && lv.plan.floats.map(function (f) { return f.id + " " + f.job + " " + f.height; }).join("; ") ===
    "FS1 off 2 ft; FS2 lead 3.5 ft; FS3 lag 4.5 ft; FS4 alarm 5.5 ft" && /From the bottom up: FS1 off at 2 ft, FS2 lead on at 3\.5 ft, FS3 lag on at 4\.5 ft and FS4 high level alarm at 5\.5 ft; the inlet’s invert at 6\.5 ft above them/.test(lv.summary), [lv.problems, lv.summary]);
  ok("...and says what it does not know: the off level is the pump maker's submergence", /Set the off level by the pump maker’s minimum submergence/.test(lv.summary) && !/Not to scale/.test(lv.summary), lv.summary);
  var lv2 = act.build(blk("LEVELS", "Floats", ["pump P1 P2", "float FS1 \x22stop low\x22", "float FS2 \x22start high\x22", "float FS3 \x22alarm high high\x22"]), "float level positions");
  ok("...with no heights, the order, said to be not to scale", lv2.ok && !lv2.plan.scaled && /Not to scale: give each float its height above the floor/.test(lv2.summary) && lv2.plan.floats.map(function (f) { return f.job; }).join(",") === "off,lead,alarm", lv2.summary);
  function lprobs(lines) { var m = act.build(blk("LEVELS", "W", lines), "float level positions"); return m.ok ? m.summary : "PROBLEMS " + m.problems.join("|"); }
  ok("...floats out of order go back with what to write", /PROBLEMS FS3 \(lag on\) at 3 ft is not above FS2 \(lead on\) at 3\.5 ft: from the bottom up the floats are off, lead on, lag on, high level alarm -- give FS3 a height above 3\.5 ft/.test(
    lprobs(["float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22 3.5 ft", "float FS3 \x22lag on\x22 3 ft"])), lprobs(["float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22 3.5 ft", "float FS3 \x22lag on\x22 3 ft"]));
  ok("...some heights and not others go back; a float with no job goes back", /PROBLEMS give every float its height above the floor, or none \(FS2 has none\)/.test(lprobs(["float FS1 \x22off\x22 2 ft", "float FS2 \x22lead on\x22"])) &&
    /PROBLEMS FS1: say what it is for/.test(lprobs(["float FS1 2 ft"])));
  ok("...floats closer than 300 mm and an alarm above the inlet's invert are said, in mm and inches", /FS1 and FS2 are 200 mm \(7\.9 in\) apart; Ontario’s design guidelines keep floats at least 300 mm \(12 in\) apart/.test(lprobs(["float FS1 \x22off\x22 0.5 m", "float FS2 \x22lead on\x22 0.7 m"])) &&
    /the alarm \(2 m\) is at or above the inlet’s invert \(1\.8 m\): the inlet sewer fills before it sounds/.test(lprobs(["float FS1 \x22off\x22 0.5 m", "float FS2 \x22lead on\x22 1 m", "float FS3 \x22high level alarm\x22 2 m", "inlet 1.8 m"])));
  ok("heightOf reads feet, inches, metres, centimetres and millimetres", ["3.5 ft", "42 in", "1.2 m", "35 cm", "300 mm", "6'"].map(function (t) { var h = PS.heightOf(t); return h ? Math.round(h.m * 1000) : null; }).join(",") === "1067,1067,1200,350,300,1829");

  // --- which tool: the plumbing is not the wiring, the levels not a picture ------------------------------
  function idsOf(q) { return act.relevant(q).map(function (a) { return a.id; }).sort().join(","); }
  ok("the tools each question is offered", idsOf("Draw the piping for a 2 pump lift station") === "piping" && idsOf("Draw a plumbing schematic of the wet well and pumps") === "piping" &&
    idsOf("Draw the float levels in the wet well") === "levels" && idsOf("Draw a drawing showing float level positioning in a lift station") === "levels" &&
    idsOf("Draw a circuit with a battery and a lamp") === "schematic" && idsOf("Draw a house with a red roof") === "drawing",
    [idsOf("Draw the piping for a 2 pump lift station"), idsOf("Draw the float levels in the wet well"), idsOf("Draw a drawing showing float level positioning in a lift station")]);

  // --- the parts of Adam's question ------------------------------------------------------------------------
  var parts = PT.split(Q);
  ok("Adam's question is three parts: the control, the piping (“for the same”: the lift station), the float levels", parts && parts.map(function (p) { return p.kind; }).join(",") === "CONTROL,PIPING,LEVELS" &&
    parts[1].text === "create a plumbing schematic for the same" && parts[1].back && parts[2].text === "a drawing showing float level positioning", parts && parts.map(function (p) { return [p.kind, p.text]; }));
  var pr = act.prompt(Q);
  ok("...the instructions list the three and carry the first one's tool only (with the alternator)", /This question asks for 3 things, and Lantern makes them one at a time: 1\. create a diagram for a typical 2 pump lift station control with alternating relay \(MAKE CONTROL\); 2\. create a plumbing schematic for the same \(MAKE PIPING\); 3\. a drawing showing float level positioning \(MAKE LEVELS\)\. Now write ONLY the first one’s block, MAKE CONTROL/.test(pr) &&
    /alternator AR M1 M2/.test(pr) && !/MAKE PIPING: <title>/.test(pr) && !/MAKE LEVELS: <title>/.test(pr), pr.slice(0, 900));
  var nb = L.aiNoBlock(Q, RUN.replies[0].reply);
  ok("...the 35B's explanation: the first block is asked for, with the three named", nb && nb.kind === "CONTROL" && /Lantern can make all 3 things the question asks for, one at a time \(MAKE CONTROL, then MAKE PIPING, then MAKE LEVELS\); this is the first\./.test(nb.prompt), nb);
  ok("single questions are not split: a sentence's details, “and the oil returns”, the total on the picture",
    !PT.split("Draw a hydraulic circuit: a pump takes oil from a tank and feeds a cylinder through a valve, and the oil returns to the tank.") &&
    !PT.split("Draw a parallel circuit: a 12 V battery with 4, 6 and 12 ohm resistors in parallel, and show the total resistance on the picture") &&
    !PT.split("Draw a circuit with a 9 V battery and a lamp. Show the current.") && !PT.split("Draw a lamp circuit and a battery") &&
    (L.aiBenchQuestions || []).concat(L.aiBenchQuestionsB || []).every(function (q) { return !PT.split(q.q) === !q.parts; }));
  var two = PT.split("Write an Arduino sketch that blinks an LED and draw the circuit for it");
  ok("two different things are two parts: a sketch and its circuit", two && two.map(function (p) { return p.kind; }).join(",") === "CODE,SCHEMATIC", two && two.map(function (p) { return p.kind; }));

  // --- Chat: the 35B's run, replayed with the blocks a model would write next ------------------------
  var PIPE2 = blk("PIPING", "Lift station", ["well \x22wet well\x22", "inlet \x228 in gravity sewer\x22", "pump P1 \x22pump 1\x22", "pump P2 \x22pump 2\x22", "header \x224 in force main\x22", "vent"]);
  var LEV2 = blk("LEVELS", "Floats", ["pump P1 P2", "float FS1 \x22stop low\x22", "float FS2 \x22start high\x22", "float FS3 \x22alarm high high\x22"]);
  async function chat(replies) { var sent = []; o.script = function (last) { sent.push(last); return replies[Math.min(sent.length - 1, replies.length - 1)]; }; var r = await C.turn([], Q, {}, {}); return { r: r, sent: sent }; }
  function kinds(r) { return (r.mades || []).map(function (m) { return m.block.kind + (m.ok ? "" : "!"); }).join(","); }
  var c1 = await chat([RUN.replies[0].reply, RUN.replies[1].reply, PIPE2, LEV2]);
  ok("Chat: the explanation, then the control block asked for and drawn, then the piping and the levels each asked for and drawn",
    c1.sent.length === 4 && /^Lantern found no MAKE block/.test(c1.sent[1]) && /^Lantern made your MAKE CONTROL block\. The question also asks for: create a plumbing schematic for the same \(“the same” is what the question asked for first: create a diagram for a typical 2 pump lift station control with alternating relay\)\. That is the second of 3\./.test(c1.sent[2]) &&
    /MAKE PIPING: <title>/.test(c1.sent[2]) && /^Lantern made your MAKE PIPING block\. The question also asks for: a drawing showing float level positioning\. That is the third of 3\./.test(c1.sent[3]) && /MAKE LEVELS: <title>/.test(c1.sent[3]) &&
    kinds(c1.r) === "CONTROL,PIPING,LEVELS" && c1.r.made && c1.r.made.block.kind === "CONTROL" && !c1.r.notes.some(function (n) { return /From the AI’s own knowledge/.test(n); }), [c1.sent.map(function (s) { return s.slice(0, 160); }), kinds(c1.r), c1.r.notes]);
  var c2 = await chat([RUN.replies[1].reply + "\n\n" + PIPE2 + "\n\n" + LEV2]);
  ok("...all three written at once are all drawn, and nothing more is asked", c2.sent.length === 1 && kinds(c2.r) === "CONTROL,PIPING,LEVELS", [c2.sent.length, kinds(c2.r)]);
  var c3 = await chat([RUN.replies[1].reply, "The piping has two pumps, each with a check valve and a gate valve.", PIPE2, LEV2]);
  ok("...a part answered with prose is asked for once, with its first line", c3.sent.length === 4 && /^Lantern found no MAKE PIPING block in your reply, so the second part \(create a plumbing schematic for the same\) was not made\./.test(c3.sent[2]) && kinds(c3.r) === "CONTROL,PIPING,LEVELS", [c3.sent.length, kinds(c3.r)]);
  var c4 = await chat([RUN.replies[1].reply, PIPE2.replace("vent", "flange F1"), PIPE2, LEV2]);
  ok("...a part's block with a problem goes back once, as any block does", c4.sent.length === 4 && /^Lantern checked your MAKE PIPING block: “flange F1” is not a part/.test(c4.sent[2]) && kinds(c4.r) === "CONTROL,PIPING,LEVELS", [c4.sent.length, kinds(c4.r), c4.sent[2] && c4.sent[2].slice(0, 120)]);
  var c5 = await chat([RUN.replies[1].reply, "I cannot draw piping.", "Still no.", "No."]);
  ok("...a part never written leaves the next part asked for, and the turn ends", kinds(c5.r) === "CONTROL" && c5.sent.length <= 6 && c5.r.made && c5.r.made.block.kind === "CONTROL", [c5.sent.length, kinds(c5.r)]);

  // --- the bench's path ---------------------------------------------------------------------------------
  var seen = [], out = await act.solve(Q, seq([RUN.replies[0].reply, RUN.replies[1].reply, PIPE2, LEV2], seen));
  ok("the bench's path: the block asked for, then each part, and all three made; out.made is the first", out.made && out.made.block.kind === "CONTROL" && out.made.ok &&
    JSON.stringify((out.parts || []).map(function (p) { return [p.kind, p.ok]; })) === JSON.stringify([["CONTROL", true], ["PIPING", true], ["LEVELS", true]]) && out.rounds === 4, [out.rounds, out.parts && out.parts.map(function (p) { return [p.kind, p.ok]; })]);

  var bq = L.aiBenchQuestions.filter(function (q) { return q.id === "make-liftstation"; })[0], bo = await act.solve(bq.q, seq([bq.ideal]));
  ok("the bench has Adam's question; its model answer (all three blocks in one reply) passes, and a missing part fails it", bq && L.aiBench.grade(bq, bo.text, bo).pass &&
    /the MAKE LEVELS part was not made/.test(L.aiBench.grade(bq, "x", { made: bo.made, parts: bo.parts.slice(0, 2) }).why), bq && L.aiBench.grade(bq, bo.text, bo));
  // --- without the new modules ----------------------------------------------------------------------------
  var o2 = load(["AI_PARTS", "AI_PUMP_STATION"]), L2 = o2.L;
  await sleep(80);
  ok("without AI_PARTS and AI_PUMP_STATION: boot clean, no parts, the control still has its alternator", o2.errs.length === 0 && !L2.aiParts && !L2.aiPumpStation &&
    !/This question asks for/.test(L2.aiAct.prompt(Q)) && L2.aiAct.build(RUN.replies[1].reply, Q).ok, o2.errs);

  console.log(fails ? fails + " LIFT STATION FAILURES (" + passes + " passed)" : "ALL LIFT STATION TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
