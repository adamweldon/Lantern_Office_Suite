// cases_b.js -- every place AI_CONTROL draws a float, pressure or temperature switch (MAKE CONTROL's ladder, and MAKE
// STATION's control view, which is the same ladder): does each contact drawn mean what the circuit does with it?
// The symbol's meaning (A cases): normally open = closes as the process rises past its setting; normally closed = opens.
// So each case runs the circuit Lantern returns through the process's rise and fall (lib.make: a float is made when the
// water is at or above it, unless drawn nc) and checks the outputs are what the circuit is for -- a pump-down, a fill,
// a low-level cutoff, a high-pressure cutout, a thermostat. Then it reads the drawing: each process switch's blade the
// way its nc says (A's geometry), its tag and label clear of every other stroke and text. And the circuit (rungs and
// each contact's nc) is the one 1.24.34 drew: the change is to the picture only.
"use strict";
var lib = require("./lib.js");
var DUP = "Draw the control circuit for a duplex lift station with an alternating relay";
var STQ = "write a schematic for a typical lift station";
function sig(c) { return c ? JSON.stringify(c.rungs.map(function (r) { function f(l) { return (l || []).map(function (e) { return e.id + "/" + e.kind + (e.nc ? "/nc" : ""); }).join(" "); } return [r.out.id, r.out.kind, f(r.stops), f(r.starts), !!r.seal, f(r.series), f(r.after), (r.branches || []).map(f).join("|")]; })) : "none"; }
// run(circuit, at, steps, outs): steps are a process value, or ["press", id] / ["let go", id]
function run(c, at, steps, outs) {
  var S = lib.make(c, function (id) { return at[id] == null ? null : at[id]; }), out = [];
  steps.forEach(function (s) {
    if (Array.isArray(s)) { S.press(s[1], s[0] === "press"); out.push(s[0] + " " + s[1] + ":" + outs.filter(function (o) { return S.on(o); }).join("+")); return; }
    S.set(s); out.push(s + ":" + outs.filter(function (o) { return S.on(o); }).join("+"));
  });
  return out.join(" ");
}
// the drawing: each process switch's blade, found from its tag (12 px text 34 above, or 30 under in a branch row);
// every place an id is drawn must show the nc the circuit gives it
function drawn(m) {
  var sh = lib.flat(lib.ladderShapes(m)), c = lib.ctl(m), want = {}, bad = [];
  lib.elements(c).forEach(function (x) { if (/^(float|pressure|temp)$/.test(x.e.kind)) (want[x.e.id] = want[x.e.id] || {})[x.e.nc ? "nc" : "no"] = 1; });
  var tags = sh.filter(function (s) { return s.t === "text" && s.fs === 12 && want[s.s]; });
  Object.keys(want).forEach(function (id) {
    var seen = [];
    tags.filter(function (t) { return t.s === id; }).forEach(function (t) {
      [t.y + 34, t.y - 30].forEach(function (cy) {
        var b = sh.filter(function (s) { return s.t === "path" && s.pts.length === 2 && Math.abs(s.pts[0][0] - (t.x - 11)) < 0.5 && Math.abs(s.pts[0][1] - cy) < 0.5; })[0];
        if (!b) return;
        var endY = b.pts[1][1], yAt = b.pts[0][1] + (b.pts[1][1] - b.pts[0][1]) * 22 / (b.pts[1][0] - b.pts[0][0]);
        seen.push(endY > cy + 4 && yAt > cy + 4 ? "no" : b.pts[1][0] > t.x + 11 && yAt <= cy - 2 && yAt >= cy - 4.5 ? "nc" : "?");
      });
    });
    if (!seen.length) bad.push(id + " is not found on the drawing");
    seen.forEach(function (k) { if (!want[id][k]) bad.push(id + " is " + Object.keys(want[id]).join("/") + " in the circuit and drawn " + k); });
  });
  return bad;
}
// texts that cross another stroke or text: the tags and labels of the process switches
function crowded(m) {
  var sh = lib.flat(lib.ladderShapes(m)), c = lib.ctl(m), ids = {}, bad = [];
  lib.elements(c).forEach(function (x) { if (/^(float|pressure|temp)$/.test(x.e.kind)) ids[x.e.id] = x.e; });
  // the tags of the process switches, and the labels drawn 34 (or 46) under one of them
  var tags = sh.filter(function (s) { return s.t === "text" && s.fs === 12 && ids[s.s]; });
  var mine = tags.slice();
  sh.forEach(function (s) { if (s.t === "text" && s.fs === 11 && tags.some(function (t) { return Math.abs(t.x - s.x) < 0.5 && (Math.abs(s.y - (t.y + 68)) < 0.5 || Math.abs(s.y - (t.y + 16)) < 0.5); })) mine.push(s); });
  mine.forEach(function (t) { var h = lib.textHits(t, sh); if (h.length) bad.push("“" + t.s + "” crosses " + h.map(function (s) { return s.t === "text" ? "“" + s.s + "”" : s.t; }).join(", ")); });
  return bad;
}
var cases = [];
// circ: build on the draft; it must be drawn; run it; read the drawing; compare the circuit with 1.24.34's
function circ(id, harm, text, q, at, steps, outs, want, right, more) {
  more = more || {};
  cases.push({ id: id, harm: harm, input: lib.short(text, 160) + " / " + q, right: right,
    run: function () {
      return lib.boot().then(function (x) {
        var m = lib.build(x.N.L, text, q), c = lib.ctl(m), o = lib.build(x.O.L, text, q), co = lib.ctl(o), bad = [];
        if (!m || !m.ok || !c) return "not drawn: " + lib.short(lib.probs(m), 400);
        var got = run(c, at, steps, outs);
        if (got !== want) bad.push("runs " + got + " (want " + want + ")");
        bad = bad.concat(drawn(m));
        if (!more.crowdOk) bad = bad.concat(crowded(m));
        if (sig(c) !== sig(co)) bad.push("the circuit differs from 1.24.34's: " + lib.short(sig(c), 300) + " / " + lib.short(sig(co), 300));
        (more.said || []).forEach(function (r) { if (!lib.rx(r).test(m.summary)) bad.push("the summary lacks /" + r + "/"); });
        if (more.extra) { var e = more.extra(m, c, x); if (e) bad.push(e); }
        return bad.join("; ");
      });
    } });
}
var F4 = { FS1: 1, FS2: 2, FS3: 3, FS4: 4 };
var PATH4 = [0, 1.5, 2.5, 1.5, 0.5, 2.5, 3.5, 2.5, 0.5, 4.5, 3.5, 0.5];
var WANT4 = "0: 1.5: 2.5:M1 1.5:M1 0.5: 2.5:M2 3.5:M1+M2 2.5:M1+M2 0.5: 4.5:M1+M2+LT3 3.5:M1+M2 0.5:";

// ---- MAKE STATION's control view ------------------------------------------------------------------------------
circ("B-station-typical", "high", "MAKE STATION: Typical Lift Station\npumps 2\nfloats off lead lag alarm\nEND", STQ, F4, PATH4, ["M1", "M2", "LT3"], WANT4,
  "Adam's station: every float normally open, drawn under the line; the pumps take turns, the lag float runs both, the alarm light at the top");
circ("B-station-24vdc-horn", "high", "MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nsupply \x2224 V DC\x22\nhorn\nEND", STQ, F4, PATH4, ["M1", "M2", "LT3"], WANT4,
  "the same station on 24 V DC with a horn: the floats drawn the same way", { extra: function (m, c) { return /horn|AH/i.test(c.rungs.map(function (r) { return r.out.id + r.out.kind; }).join(" ")) ? "" : "no horn rung"; } });
circ("B-station-no-lag", "high", "MAKE STATION: Lift station\npumps 2\nfloats off lead alarm\nEND", STQ, { FS1: 1, FS2: 2, FS3: 4 },
  [0, 2.5, 1.5, 0.5, 2.5, 4.5, 0.5], ["M1", "M2", "LT3"], "0: 2.5:M1 1.5:M1 0.5: 2.5:M2 4.5:M2+LT3 0.5:",
  "three floats (off, lead, high level alarm): one pump at a time, taking turns; the alarm float only lights the alarm");
// ---- MAKE CONTROL --------------------------------------------------------------------------------------------
var DUPL = ['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', "alternator AR M1 M2", 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'];
circ("B-control-prompt-example", "high", lib.blk("CONTROL", "Duplex pump station", ['supply "120 V AC"'].concat(DUPL, ['lamp LT1 M1 "pump 1 run" green', 'lamp LT2 M2 "pump 2 run" green', 'lamp LT3 FS4 "high level" red'])), DUP,
  F4, PATH4, ["M1", "M2", "LT3"], WANT4, "the prompt's own example: as the station");
circ("B-control-two-alarm-lamps", "medium", lib.blk("CONTROL", "Duplex", DUPL.concat(['float FS5 "high high level alarm"', 'lamp LT1 FS4 "high level" red', 'lamp LT2 FS5 "high high level" red'])), DUP,
  { FS1: 1, FS2: 2, FS3: 3, FS4: 4, FS5: 5 }, [0, 4.5, 5.5, 0.5], ["M1", "M2", "LT1", "LT2"], "0: 4.5:M1+M2+LT1 5.5:M1+M2+LT1+LT2 0.5:",
  "two alarm floats, a light each: each light on its own float as the water rises past it");
circ("B-control-two-alarms-one-horn", "low", lib.blk("CONTROL", "Duplex", DUPL.concat(['float FS5 "high high alarm"', 'horn AH1 "alarm"'])), DUP,
  { FS1: 1, FS2: 2, FS3: 3, FS4: 4, FS5: 5 }, [0, 4.5, 3.5, 5.5, 0.5], ["M1", "M2", "AH1"], "0: 4.5:M1+M2+AH1 3.5:M1+M2 5.5:M1+M2+AH1 0.5:",
  "two alarm floats on one horn, side by side (the second in a branch row under the first): either sounds it; the branch row's float drawn normally open, its tag and label clear of it (the tag under a branch row's float touched it on 1.24.34 too)");
circ("B-control-low-level-alarm", "high", lib.blk("CONTROL", "Duplex", DUPL.concat(['float FS0 "low level alarm"'])), DUP,
  { FS0: 0.5, FS1: 1, FS2: 2, FS3: 3, FS4: 4 }, [0, 0.7, 2.5, 0.7, 0.2], ["M1", "M2", "LT2"], "0:LT2 0.7: 2.5:M1 0.7: 0.2:LT2",
  "a low level alarm float: Lantern's light on it is lit while the water is below it -- the float drawn normally closed (rising lifts it off), the one nc float of a lift station",
  { said: ["low level alarm light LT2 on FS0 \\(lit when the water falls below it\\)"] });
circ("B-control-sump-simplex", "high", lib.blk("CONTROL", "Sump", ['float FS1 M1 "pump off"', 'float FS2 M1 "pump on"', 'coil M1 "sump pump starter"']), "Draw the control circuit for a sump pump with an on float and an off float",
  { FS1: 1, FS2: 2 }, [0, 1.5, 2.5, 1.5, 0.5, 1.5], ["M1"], "0: 1.5: 2.5:M1 1.5:M1 0.5: 1.5:",
  "a sump pump on two floats: on at the on float, held in until the water falls below the off float; both normally open");
circ("B-control-sump-prompt-example", "medium", lib.blk("CONTROL", "Sump pump", ['switch SS1 M1 "hand"', "float FS1 M1", 'coil M1 "pump starter"', 'lamp LT1 M1 "pump on" green']), "Draw the control circuit for a sump pump",
  { FS1: 2 }, [0, 2.5, 1], ["M1", "LT1"], "0: 2.5:M1+LT1 1:",
  "the prompt's general example (a sump pump on one float): the pump runs while the water is above the float -- the float normally open");
circ("B-control-fill-nc", "high", lib.blk("CONTROL", "Fill", ['float FS1 M1 nc "tank full"', 'coil M1 "well pump starter"']), "Draw the control circuit for a well pump that fills a storage tank and stops when the tank is full",
  { FS1: 3 }, [0, 2, 3.5, 2], ["M1"], "0:M1 2:M1 3.5: 2:M1",
  "a fill: the float opens as the water rises to it -- written nc, drawn normally closed (resting on the terminal, the float under to lift it off)");
circ("B-control-booster-low-cutoff", "high", lib.blk("CONTROL", "Booster", ["stop PB1 M1", "start PB2 M1", 'float FS1 M1 "low level cutoff"', 'coil M1 "booster pump starter"']),
  "Draw the control circuit for a booster pump with start and stop buttons and a low level cutoff float in the supply tank",
  { FS1: 1 }, [2, ["press", "PB2"], ["let go", "PB2"], 0.5, 2, ["press", "PB2"], ["let go", "PB2"], ["press", "PB1"]], ["M1"],
  "2: press PB2:M1 let go PB2:M1 0.5: 2: press PB2:M1 let go PB2:M1 press PB1:",
  "a low level cutoff: made while the water is above it (normally open, drawn under the line); the pump drops out when the tank runs low and needs its start again");
circ("B-control-compressor-cutout", "high", lib.blk("CONTROL", "Compressor", ['pressure PS1 M1 nc "high pressure cutout"', 'coil M1 "compressor starter"']),
  "Draw the control circuit for an air compressor starter with a pressure switch that stops it at the cut-out pressure",
  { PS1: 5 }, [0, 4, 6, 4], ["M1"], "0:M1 4:M1 6: 4:M1",
  "a high pressure cutout: opens as the pressure rises to it -- nc, drawn resting on the terminal with the diaphragm under it");
circ("B-control-compressor-buttons-oil", "medium", lib.blk("CONTROL", "Compressor", ["stop PB1 M1", "start PB2 M1", 'pressure PS1 M1 nc "high pressure cutout"', 'coil M1 "compressor starter"']),
  "Draw the control circuit for an air compressor starter with start and stop buttons and a high pressure cutout",
  { PS1: 5 }, [0, ["press", "PB2"], ["let go", "PB2"], 6, 4, ["press", "PB2"], ["let go", "PB2"]], ["M1"], "0: press PB2:M1 let go PB2:M1 6: 4: press PB2:M1 let go PB2:M1",
  "start and stop with a high pressure cutout in series: the cutout drops it out and it waits for its start");
circ("B-control-low-suction-cutout", "medium", lib.blk("CONTROL", "Pump", ['pressure PS1 M1 "low suction pressure cutout"', 'coil M1 "pump starter"']),
  "Draw the control circuit for a pump with a low suction pressure cutout switch",
  { PS1: 1 }, [0, 2, 0.5], ["M1"], "0: 2:M1 0.5:",
  "a low suction pressure cutout: made while there is pressure (normally open: it closes as the pressure rises)");
circ("B-control-heater-thermostat", "high", lib.blk("CONTROL", "Heater", ['temp TS1 C1 nc "thermostat"', 'temp TS2 C1 nc "high limit"', 'coil C1 "heater contactor"']),
  "Draw the control circuit for an electric heater contactor switched by a thermostat with a high limit",
  { TS1: 20, TS2: 60 }, [10, 25, 15, 70], ["C1"], "10:C1 25: 15:C1 70:",
  "a heating thermostat and a high limit: both open as it gets hotter -- nc, the bulb under the blade lifting it off");
circ("B-control-fan-thermostat", "medium", lib.blk("CONTROL", "Fan", ['temp TS1 M1 "fan thermostat"', 'coil M1 "fan starter"']),
  "Draw the control circuit for an exhaust fan started by a thermostat when the room gets hot",
  { TS1: 30 }, [20, 35, 25], ["M1"], "20: 35:M1 25:",
  "a cooling thermostat: closes as it gets hotter -- normally open, drawn under the line");
circ("B-control-motor-overtemp", "medium", lib.blk("CONTROL", "Pump", ["stop PB1 M1", "start PB2 M1", 'temp TS1 M1 nc "motor overtemperature"', 'coil M1 "pump starter"']),
  "Draw the control circuit for a pump starter with start and stop and a motor overtemperature switch",
  { TS1: 120 }, [40, ["press", "PB2"], ["let go", "PB2"], 130, 40], ["M1"], "40: press PB2:M1 let go PB2:M1 130: 40:",
  "a motor's overtemperature switch: opens when the winding gets too hot (nc)");
circ("B-control-many-on-one-rung", "medium", lib.blk("CONTROL", "Tank", ['float FS1 M1 "low level cutoff"', 'pressure PS1 M1 nc "high pressure"', 'temp TS1 M1 nc "motor overtemp"', 'float FS2 M1 nc "tank full"', 'coil M1 "transfer pump starter"']),
  "Draw the control circuit for a transfer pump that fills a tank, with a low level cutoff, a high pressure switch and a motor overtemperature switch",
  { FS1: 1, PS1: 5, TS1: 100, FS2: 3 }, [0, 2, 3.5], ["M1"], "0: 2:M1 3.5:",
  "four process switches side by side, two ways round: each drawn as its nc says, the labels clear of the floats and of each other (one process value stands in for all four: 0 dry, 2 running, 3.5 the tank full)");
// ---- what a model writes wrong, which the picture now shows (not this change's doing) -------------------------------
circ("B-cutout-written-without-nc", "medium", lib.blk("CONTROL", "Compressor", ['pressure PS1 M1 "high pressure cutout"', 'coil M1 "compressor starter"']),
  "Draw the control circuit for an air compressor starter with a high pressure cutout switch",
  { PS1: 5 }, [0, 4, 6, 4], ["M1"], "0:M1 4:M1 6: 4:M1",
  "a pressure switch named a cutout opens as the pressure rises: drawn nc and said, or sent back once with: pressure PS1 M1 nc \x22high pressure cutout\x22 -- " +
  "drawn as written (normally open) the compressor never starts, and the new symbol now shows a switch that closes on rising pressure under the word cutout");
circ("B-thermostat-heater-written-without-nc", "low", lib.blk("CONTROL", "Heater", ['temp TS1 C1 "thermostat"', 'coil C1 "heater contactor"']),
  "Draw the control circuit for an electric heater contactor switched by a thermostat",
  { TS1: 20 }, [10, 25], ["C1"], "10:C1 25:",
  "a heater's thermostat opens as it warms: written without nc, drawn normally open the heater runs only when it is already warm (a heating thermostat is nc; Lantern can tell a heater from its coil's label)");
// the drawing at the size Chat shows it (AI_DRAW's preview: 640 px wide at most)
cases.push({ id: "B-nc-lean-at-preview-size", harm: "low", input: "the station's ladder and a compressor's, at the preview's scale",
  right: "at the size Chat shows it, a normally closed process switch's blade still leans clear of the line (at least 2 px at its end) -- or Adam judges the sheet",
  run: function () {
    return lib.boot().then(function (x) {
      var m = lib.build(x.N.L, lib.blk("CONTROL", "Compressor", ['pressure PS1 M1 nc "high pressure cutout"', 'coil M1 "compressor starter"']), "Draw the control circuit for an air compressor starter with a pressure switch");
      var sh = lib.flat(m.shapes), w = Math.max(720, Math.max.apply(null, sh.map(function (s) { return lib.bbox(s)[2] + 20; }))), k = Math.min(1, 640 / w);
      return lib.want(4 * k >= 2, "the nc blade rises 4 px over 26 at full size; at the preview's scale " + k.toFixed(2) + " that is " + (4 * k).toFixed(1) + " px");
    });
  } });
module.exports = cases;
