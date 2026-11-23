// cases_c.js -- C: floatJob (AI_CONTROL, and AI_PUMP_STATION's own when AI_CONTROL is dropped): "emergency" now the
// alarm word unless with off/stop/shut. A float's label is what the model (or a person) wrote; Lantern moves it to
// another job only when nothing else can be meant (rule 7). Where two readings are possible, the safer one is the one
// that keeps the pumps protected: a float that may stop the pumps is not made a light.
"use strict";
var path = require("path"), fs = require("fs"), os = require("os");
var H = require("./lib.js");
var load = require("./load.js");
function FJ(l) { return H.L().aiControl.floatJob(l); }
function FJ0(l) { return H.L0().aiControl.floatJob(l); }
function J(id, harm, label, want, right) {
  return { id: id, harm: harm, input: { label: label }, right: right || ("\x22" + label + "\x22 is the " + want + " float"),
    run: function () { return H.boot().then(function () { var a = FJ(label); return a === want ? "" : "read as " + a + " (1.24.33: " + FJ0(label) + ")"; }); } };
}
function e(x) { return x.id + (x.of && x.of !== x.id ? "<" + x.of : "") + (x.nc ? "/" : "") + ":" + x.kind; }
function rungs(r) { var c = r && r.plan && (r.plan.circuit || (r.plan.views && r.plan.views.control && r.plan.views.control.circuit)); return c ? c.rungs : []; }
function sig(r) {
  if (!r) return "null"; if (!r.ok) return "PROBLEMS: " + (r.problems || []).join(" ;; ");
  return rungs(r).map(function (g) { return g.out.id + "[" + g.out.kind + "] stops(" + g.stops.map(e) + ") starts(" + g.starts.map(e) + ") series(" + g.series.map(e) + ")" + (g.branches ? " br(" + g.branches.map(function (b) { return b.map(e).join("&"); }).join("|") + ")" : ""); }).join(" / ");
}
var LIFT = "Draw the control circuit for a duplex lift station with an alternating relay";
var TAIL = ["alternator AR M1 M2", "coil M1 \x22pump 1 starter\x22", "coil M2 \x22pump 2 starter\x22"];
function ctl(floats) { return H.blk("CONTROL", "Duplex", floats.map(function (f) { return "float " + f; }).concat(TAIL)); }
function CC(id, harm, floats, right, judge) {
  var t = ctl(floats);
  return { id: id, harm: harm, input: { question: LIFT, reply: t }, right: right, run: function () { return H.boot().then(function () { var r = H.L().aiAct.build(t, LIFT), r0 = H.L0().aiAct.build(t, LIFT); return judge(r, r0); }); } };
}
// a page with AI_CONTROL dropped (rule: every module droppable): AI_PUMP_STATION's own floatJob
var noCtl = null;
function pumpStationAlone() {
  if (noCtl) return noCtl;
  var src = fs.readFileSync(path.join(H.ROOT, "src/lantern.inner.html"), "utf8");
  var a = src.indexOf("// MODULE: AI_CONTROL - START"), b = src.indexOf("// MODULE: AI_CONTROL - END");
  var cut = src.slice(0, src.lastIndexOf("\n", a)) + "\n" + src.slice(src.indexOf("\n", b) + 1);
  var f = path.join(os.tmpdir(), "lantern-1234-review-no-ai-control.inner.html");
  fs.writeFileSync(f, cut);
  noCtl = load(f);
  return noCtl;
}

module.exports = [
  // --- the guard: what the change is for ---------------------------------------------------------------------------
  J("C-01", "high", "Emergency High", "alarm", "the 35B's \x22Emergency High\x22 is the high level alarm (Adam's chat)"),
  J("C-02", "medium", "emergency high level", "alarm"),
  J("C-03", "medium", "EMERGENCY HIGH", "alarm"),
  J("C-04", "medium", "Emergency High Alarm", "alarm"),
  J("C-05", "medium", "emergency high water", "alarm"),
  J("C-06", "low", "High-High Emergency", "alarm"),
  J("C-07", "low", "Emergency Overflow", "alarm"),
  J("C-08", "low", "Emergency", "alarm", "a float called only Emergency: the alarm (1.24.33 read nothing)"),
  J("C-09", "medium", "emergency off", "off"),
  J("C-10", "medium", "Emergency Stop Float", "off"),
  J("C-11", "medium", "Emergency Low Level Off", "off"),
  J("C-12", "low", "high level alarm", "alarm", "no emergency word: as before"),
  J("C-13", "low", "lead on", "lead"),
  J("C-14", "low", "lag on", "lag"),
  J("C-15", "low", "pumps off", "off"),
  // --- a float that starts or stops the pumps, made a light --------------------------------------------------------
  J("C-16", "high", "Emergency Low Level Cutoff", "off", "a low level cutoff stops the pumps (pump protection), as 1.24.33 read it; read as a low level alarm light the pumps run past it"),
  J("C-17", "high", "Emergency High - Start Both Pumps", "lag", "it starts both pumps (the lag call), as 1.24.33 read it"),
  J("C-18", "high", "Emergency Lag On", "lag", "it says lag on"),
  J("C-19", "medium", "Emergency Pump Start", "lead", "a start float (1.24.33: lead), not only a light"),
  J("C-20", "medium", "Emergency Start", "lead", "a start float (1.24.33: lead)"),
  J("C-21", "medium", "Emergency High Level Pump On", "lead", "it turns a pump on (1.24.33: lead)"),
  J("C-22", "medium", "Emergency Run", "lead", "it runs a pump (1.24.33: lead)"),
  J("C-23", "medium", "Emergency Shutdown", "off", "it shuts the pumps down: the off float"),
  J("C-24", "medium", "emergency low", "off", "ambiguous (a redundant off or a low alarm): the safer reading, the one that keeps the pumps from running dry, is off, as 1.24.33 read it"),
  J("C-25", "low", "Emergency Lead", "lead"),
  { id: "C-26", harm: "medium", input: { labels: ["Emergency Start", "Emergency Lag On", "Emergency High - Start Both Pumps", "Emergency High", "emergency off"] },
    right: "AI_PUMP_STATION's own floatJob (used when AI_CONTROL is dropped) reads these as AI_CONTROL's does: one station, one reading of a float.",
    run: function () { return H.boot().then(function () {
      var o = pumpStationAlone(), PSF = o.L.aiPumpStation && o.L.aiPumpStation.floatJob;
      if (!PSF) return "AI_PUMP_STATION did not load without AI_CONTROL";
      var bad = ["Emergency Start", "Emergency Lag On", "Emergency High - Start Both Pumps", "Emergency High", "emergency off", "Emergency Low Level Cutoff"].filter(function (l) { return PSF(l) !== FJ(l); });
      return bad.length ? bad.map(function (l) { return l + ": AI_CONTROL " + FJ(l) + ", AI_PUMP_STATION " + PSF(l); }).join("; ") : ""; }); } },
  // --- in MAKE CONTROL: what the circuit does ------------------------------------------------------------------------
  CC("C-30", "high", ["FS0 \x22emergency low level cutoff\x22", "FS1 \x22off\x22", "FS2 \x22lead on\x22", "FS3 \x22lag on\x22", "FS4 \x22high level alarm\x22"],
    "the cutoff float FS0 stops the pumps (in the call relays' stops, as on 1.24.33), not a low level light",
    function (r, r0) { var st = rungs(r).filter(function (g) { return g.out.kind === "coil" && /^CR/.test(g.out.id); }).every(function (g) { return g.stops.some(function (x) { return x.id === "FS0"; }); }); return r.ok && st ? "" : "NOW " + sig(r) + " || 1.24.33 " + sig(r0); }),
  CC("C-31", "high", ["FS1 \x22off\x22", "FS2 \x22lead on\x22", "FS3 \x22emergency high - start both pumps\x22", "FS4 \x22high level alarm\x22"],
    "FS3 starts both pumps (a lag call relay), as on 1.24.33",
    function (r, r0) { var lag = rungs(r).some(function (g) { return g.starts.some(function (x) { return x.id === "FS3"; }); }); return r.ok && lag ? "" : "NOW " + sig(r) + " || 1.24.33 " + sig(r0); }),
  CC("C-32", "high", ["FS1 \x22off\x22", "FS2 \x22lead on\x22", "FS3 \x22lag on\x22", "FS4 \x22emergency high\x22"],
    "FS4 emergency high lights the alarm, not a third start (the change's aim)",
    function (r) { var al = rungs(r).filter(function (g) { return g.out.kind === "lamp" || g.out.kind === "horn"; }).some(function (g) { return g.series.concat(g.starts).some(function (x) { return x.id === "FS4"; }); }); return r.ok && al ? "" : sig(r); }),
  CC("C-33", "medium", ["FS0 \x22emergency off\x22", "FS1 \x22off\x22", "FS2 \x22lead on\x22", "FS3 \x22lag on\x22", "FS4 \x22high level alarm\x22"],
    "an emergency off float stops the pumps, as on 1.24.33", function (r, r0) { return sig(r) === sig(r0) ? "" : "NOW " + sig(r) + " || 1.24.33 " + sig(r0); }),
  CC("C-34", "medium", ["FS1 \x22off\x22", "FS2 \x22lead on\x22", "FS3 \x22lag on\x22", "FS4 \x22high level alarm\x22"],
    "the usual duplex: drawn as on 1.24.33", function (r, r0) { return sig(r) === sig(r0) ? "" : "NOW " + sig(r) + " || 1.24.33 " + sig(r0); }),
  { id: "C-35", harm: "medium", input: { question: "Draw a motor starter with an emergency stop", reply: "MAKE CONTROL: Starter / estop ES1 \x22emergency stop\x22 / stop PB1 / start PB2 / coil M1 \x22motor starter\x22 / lamp LT1 M1 \x22run\x22 green" },
    right: "an emergency stop push button is not a float: the starter as on 1.24.33",
    run: function () { return H.boot().then(function () { var q = "Draw a motor starter with an emergency stop", t = H.blk("CONTROL", "Starter", ["estop ES1 \x22emergency stop\x22", "stop PB1 \x22stop\x22", "start PB2 \x22start\x22", "coil M1 \x22motor starter\x22", "lamp LT1 M1 \x22run\x22 green"]);
      var a = sig(H.L().aiAct.build(t, q)), b = sig(H.L0().aiAct.build(t, q)); return a === b ? "" : "NOW " + a + " || 1.24.33 " + b; }); } },
  { id: "C-36", harm: "medium", input: { question: "Draw the control for a sump pump with a high water alarm", reply: "MAKE CONTROL: Sump / float FS1 \x22pump off\x22 / float FS2 \x22pump on\x22 / float FS3 \x22emergency high water alarm\x22 / coil M1 \x22pump starter\x22" },
    right: "a sump's emergency high water alarm float lights the alarm, as on 1.24.33",
    run: function () { return H.boot().then(function () { var q = "Draw the control for a sump pump with a high water alarm", t = H.blk("CONTROL", "Sump", ["float FS1 \x22pump off\x22", "float FS2 \x22pump on\x22", "float FS3 \x22emergency high water alarm\x22", "coil M1 \x22pump starter\x22"]);
      var a = sig(H.L().aiAct.build(t, q)), b = sig(H.L0().aiAct.build(t, q)); return a === b ? "" : "NOW " + a + " || 1.24.33 " + b; }); } },
  { id: "C-37", harm: "high", input: { question: "write a schematic for a typical lift station", reply: "MAKE STATION with float FS3 \x22emergency high - start both pumps\x22" },
    right: "MAKE STATION: the float that starts both pumps is the lag float; the station has its lag call",
    run: function () { return H.boot().then(function () { var q = "write a schematic for a typical lift station", t = H.blk("STATION", "Lift station", ["pumps 2", "float FS1 \x22off\x22", "float FS2 \x22lead on\x22", "float FS3 \x22emergency high - start both pumps\x22", "float FS4 \x22high level alarm\x22"]);
      var r = H.L().aiAct.build(t, q), fl = r.plan ? r.plan.spec.floats.map(function (f) { return f.id + ":" + f.job; }).join(",") : (r.problems || []).join(";"); return /FS3:lag/.test(fl) ? "" : "floats " + fl; }); } }
];
