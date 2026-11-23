// float_switch_1235.js -- Adam, 2026-11-23, on 1.24.34's lift station ladder: "the float switch should be open under the
// line as in float raises to close circuit -- you have them drawn as float lowers to close circuit -- they would open the
// circuit when the float level got higher stopping the pumps from running"; "LS1 is typically a limit switch, FS1 would
// be float switch 1"; and, of probes Stop, Start, High: "should be high level to start second pump while first is already
// running and alarm level float at highest for alarm indication". (1.24.35)
"use strict";
var path = require("path");
var load = require(path.join(__dirname, "fixtures", "liftstation_review1_1230", "load.js"));
var SRC = process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html");
var passes = 0, fails = 0;
function ok(name, cond, info) { if (cond) { passes++; console.log("ok   " + name); } else { fails++; console.log("FAIL " + name + (info !== undefined ? "\n     " + JSON.stringify(info).slice(0, 1200) : "")); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
(async function () {
  var o = load(SRC), L = o.L;
  await sleep(80); await L.ai.detect();
  ok("boot clean", o.errs.length === 0, o.errs);
  var S = L.ladderSym;
  // the blade: the shape that starts at the left terminal (x-11, y) and is not a terminal circle or a lead
  function blade(sym, nc) {
    var g = S[sym](100, 100, "#000", { nc: nc }).g, sh = g.shapes || g.items || g.children || [];
    var b = sh.filter(function (x) { var p = x.pts || (x.x1 != null ? [[x.x1, x.y1], [x.x2, x.y2]] : null); return p && p.length === 2 && Math.abs(p[0][0] - 89) < 0.5 && Math.abs(p[0][1] - 100) < 0.5; })[0];
    var p = b && (b.pts || [[b.x1, b.y1], [b.x2, b.y2]]);
    return p ? p[1] : null;
  }
  ["float", "pressure", "temp"].forEach(function (k) {
    var no = blade(k, false), nc = blade(k, true);
    ok(k + ": normally open, the blade under the line and clear of the right terminal (rising closes it); normally closed, resting on it from above (rising opens it)",
      no && nc && no[1] > 104 && no[0] < 111 + 3 && nc[1] < 100 && nc[0] >= 111, [no, nc]);
  });
  var tg = blade("toggle", false), lm = blade("limit", false);
  ok("a selector and a limit switch are drawn as before (the blade up and clear when open)", tg && tg[1] < 100 && lm && lm[1] < 100, [tg, lm]);
  // the station's ladder: its floats are normally open, so every float is drawn under the line
  var act = L.aiAct, Q = "write a schematic for a typical lift station. Include any other drawings a lift station would need";
  var m = act.build("MAKE STATION: Typical Lift Station\npumps 2\nfloats off lead lag alarm\nEND", Q);
  var circ = m && m.plan && m.plan.views && m.plan.views.control && m.plan.views.control.circuit;
  var fl = [];
  (circ ? circ.rungs : []).forEach(function (r) { Object.keys(r).forEach(function (k) { if (Array.isArray(r[k])) r[k].forEach(function (e) { if (e && e.kind === "float") fl.push(e); }); }); });
  var fids = fl.map(function (e) { return e.id; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort().join(",");
  ok("the station's floats are all normally open (each closes as the water rises to it)", fids === "FS1,FS2,FS3,FS4" && fl.every(function (e) { return !e.nc; }), fl.map(function (e) { return e.id + (e.nc ? " nc" : ""); }));
  // LS and FS
  function sch(parts) { return "MAKE SCHEMATIC: Duplex\nmode electrical\npart V1 source \x22120 V\x22\n" + parts.join("\n") + "\npart M1 motor \x22Pump 1\x22\npart M2 motor \x22Pump 2\x22\nwire V1 M1\nwire M1 M2\nwire M2 V1\nEND"; }
  var q2 = "write a schematic for a duplex lift station";
  var a = act.build(sch(["part FS1 switch", "part FS2 switch", "part FS3 switch", "part FS4 switch", "part LS1 switch", "part LS2 switch"]), q2);
  var ap = a ? (a.problems || []).join(" | ") : "";
  ok("FS1-FS4 with no names are floats (sent back once to name their jobs); LS1 and LS2 with no names are limit switches, not floats", a && a.readAs === "STATION" && a.fixKind === "STATION" &&
    /part FS1 switch/.test(ap) && /part FS4 switch/.test(ap) && !/LS1|LS2/.test(ap), ap);
  var b = act.build(sch(['part LS1 switch "Off"', 'part LS2 switch "Lead On"', 'part LS3 switch "Lag On"', 'part LS4 switch "High Level Alarm"', 'part S1 switch "Pump 1 Start"', 'part S2 switch "Emergency Stop"']), q2);
  var bf = b && b.plan ? b.plan.spec.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : "";
  ok("an LS named for a float's job is a float by its name; a start button and an e-stop are not", bf === "LS1:off,LS2:lead,LS3:lag,LS4:alarm" && /S1, S2 \(switch\)/.test(b.summary), [bf, b && b.summary]);
  // (the review) an LS named for a float's work is still its float; named for a hatch or a valve, a limit switch; an e-stop, an
  // On/Off switch and a Lead/Lag selector are never floats
  var c = act.build(sch(['part LS1 switch "Stop"', 'part LS2 switch "Pump 1 On"', 'part LS3 switch "Pump 2 On"', 'part LS4 switch "High Level Alarm"', 'part LS5 switch "Hatch Open"',
    'part ES1 switch "Emergency-Stop"', 'part S1 switch "On/Off"', 'part SS1 selector switch "Lead/Lag"']), q2);
  var cf = c && c.plan ? c.plan.spec.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : "";
  ok("LS floats named Stop, Pump 1 On, Pump 2 On, High Level Alarm kept; LS5 Hatch Open a limit switch; the e-stop, On/Off and Lead/Lag not floats", cf === "LS1:off,LS2:lead,LS3:lag,LS4:alarm" &&
    /LS5, ES1, S1 \(switch\); SS1 \(selector switch\)/.test(c.summary), [cf, c && (c.summary || c.problems)]);
  // probes Stop, Start, High: High starts the second pump; the alarm is a float of its own, highest
  var p = act.build(sch(['part E1 probe "Stop"', 'part E2 probe "Start"', 'part E3 probe "High"', 'part E4 probe "High Level Alarm"']), q2);
  var pf = p && p.plan ? p.plan.spec.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : "";
  ok("probes Stop, Start, High and High Level Alarm: off, lead, the lag (High starts the second pump), and the alarm highest", pf === "E1:off,E2:lead,E3:lag,E4:alarm", [pf, p && (p.summary || p.problems)]);
  console.log(fails ? fails + " FLOAT SWITCH 1.24.35 FAILURES (" + passes + " passed)" : "ALL FLOAT SWITCH 1.24.35 CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
