// review5_p1am_check.js -- the fifth reviewer of 1.24.13 (tests/fixtures/review5_1253_p1am.json): its own evaluator (a C-to-JS
// translation run in a Node vm context, presses of 300 ms -- not Lantern's) and its check of every case: wiring, the bench,
// stopScan, and each line to write run in the changed sketch. Made a module for tests/bench_1253.js; not a suite of its own.
"use strict";
var E = (function () { var module = { exports: {} }, exports = module.exports;
// my own evaluator for the review's P1AM sketches (not Lantern's): a C-to-JS translation of the small C these
// sketches use, run in a separate Node vm context, with presses that last 30 scans of 10 ms (300 ms)
var vm = require("vm");
function callsTo0(s, nameRe) {   // replace NAME(...) (balanced) by 0
  var out = "", i = 0, m, re = new RegExp(nameRe, "g");
  while ((m = re.exec(s))) {
    var j = m.index + m[0].length, d = 1;
    while (j < s.length && d) { if (s[j] === "(") d++; else if (s[j] === ")") d--; j++; }
    out += s.slice(i, m.index) + "0"; i = j; re.lastIndex = j;
  }
  return out + s.slice(i);
}
function translate(src) {
  var s = String(src);
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");
  s = s.replace(/"(?:[^"\\\n]|\\.)*"/g, "0").replace(/'(?:[^'\\\n]|\\.)'/g, "0");
  s = s.replace(/^[ \t]*#[ \t]*include[^\n]*$/gm, "");
  var defs = [];
  s = s.replace(/^[ \t]*#[ \t]*define[ \t]+(\w+)[ \t]+([^\n]*)$/gm, function (m, n, v) { defs.push([n, v.trim()]); return ""; });
  for (var k = 0; k < 4; k++) defs.forEach(function (d) { s = s.replace(new RegExp("\\b" + d[0] + "\\b", "g"), "(" + d[1] + ")"); });
  s = callsTo0(s, "\\bSerial\\s*\\.\\s*\\w+\\s*\\(");
  s = callsTo0(s, "\\b(?:delay|delayMicroseconds|pinMode)\\s*\\(");
  s = s.replace(/\bP1\s*\.\s*init\s*\(\s*\)/g, "1").replace(/\bP1\s*\.\s*readDiscrete\s*\(/g, "rd(").replace(/\bP1\s*\.\s*writeDiscrete\s*\(/g, "wr(");
  var T = "(?:const\\s+)?(?:unsigned\\s+long|unsigned\\s+int|unsigned|long|int|bool|boolean|byte|uint8_t|uint16_t|uint32_t|int16_t|int32_t|void)";
  // prototypes out, definitions to function
  s = s.replace(new RegExp("^[ \\t]*" + T + "\\s+\\w+\\s*\\([^()]*\\)\\s*;", "gm"), "");
  s = s.replace(new RegExp("^([ \\t]*)" + T + "\\s+(\\w+)\\s*\\(([^()]*)\\)\\s*\\{", "gm"), function (m, ind, n, ps) {
    var names = ps.trim() === "void" ? [] : ps.split(",").map(function (p) { var w = p.trim().match(/(\w+)\s*$/); return w ? w[1] : ""; }).filter(Boolean);
    return ind + "function " + n + "(" + names.join(", ") + ") {";
  });
  s = s.replace(new RegExp("\\b" + T.replace("|void", "") + "\\s+(?=[A-Za-z_])", "g"), "var ");
  // globals declared with no value are zero in C
  var depth = 0, out = "";
  s.split("\n").forEach(function (line) {
    if (depth === 0) line = line.replace(/\bvar\s+([^;=]+);/, function (m, names) { return "var " + names.split(",").map(function (n) { return n.trim() + " = 0"; }).join(", ") + ";"; });
    for (var i = 0; i < line.length; i++) { if (line[i] === "{") depth++; else if (line[i] === "}") depth--; }
    out += line + "\n";
  });
  return out;
}
function load(src) {
  var st = { ins: {}, outs: {}, clock: 0 };
  var ctx = { HIGH: 1, LOW: 0, Serial: 1,
    rd: function (s, c) { if (c === undefined) { var m = 0; for (var k = 1; k <= 16; k++) if (st.ins[s + ":" + k]) m |= 1 << (k - 1); return m; } return st.ins[s + ":" + c] ? 1 : 0; },
    wr: function (v, s, c) { if (c === undefined) { for (var k = 1; k <= 16; k++) st.outs[s + ":" + k] = !!((v >> (k - 1)) & 1); } else st.outs[s + ":" + c] = !!v; },
    millis: function () { return st.clock; } };
  vm.createContext(ctx);
  var js = translate(src);
  var api = vm.runInContext(js + "\n;({ setup: typeof setup === 'function' ? setup : null, loop: loop });", ctx, { timeout: 2000 });
  if (api.setup) api.setup();
  return { st: st, api: api, js: js };
}
// sim(src, spec): spec {start:[slot,ch], stop:[slot,ch,nc], motor:"s:c", extras:{"s:c":healthy}, lamps:[{key, is:"stop"|"run"|"notrun"}], scans}
function sim(src, spec) {
  var N = spec.scans || 30, lampBad = [];
  function inputs(start, stop) {
    var o = {};
    for (var k in (spec.extras || {})) o[k] = spec.extras[k];
    o[spec.start[0] + ":" + spec.start[1]] = start ? 1 : 0;
    o[spec.stop[0] + ":" + spec.stop[1]] = spec.stop[2] ? (stop ? 0 : 1) : (stop ? 1 : 0);
    if (spec.also) spec.also.forEach(function (a) { o[a.key] = a.v(start, stop); });
    return o;
  }
  function run(seq) {
    var e = load(src), on = false;
    seq.forEach(function (p) {
      for (var i = 0; i < N; i++) { e.st.ins = inputs(p[0], p[1]); e.st.clock += 10; e.api.loop(); }
      on = !!e.st.outs[spec.motor];
      (spec.lamps || []).forEach(function (l) {
        var want = l.is === "stop" ? !!p[1] : l.is === "notstop" ? !p[1] : l.is === "run" ? on : !on, got = !!e.st.outs[l.key];
        if (want !== got) lampBad.push(l.key + " should be " + l.is + " after " + JSON.stringify(seq));
      });
    });
    return on;
  }
  var r = { idle: run([[0, 0]]), started: run([[1, 0]]), sealed: run([[1, 0], [0, 0]]), stopped: run([[1, 0], [0, 0], [0, 1]]),
    after: run([[1, 0], [0, 0], [0, 1], [0, 0]]), both: run([[1, 1]]), bothRunning: run([[1, 0], [0, 0], [1, 1]]), stopFirst: run([[0, 1], [1, 1]]) };
  r.verdict = r.idle ? "the motor runs with nothing pressed" : !r.started && (r.both || r.stopFirst) ? "Stop turns the motor on" : !r.started ? "Start does not start the motor" :
    !r.sealed ? "no seal-in" : r.stopped ? "Stop does not stop the motor" : r.after ? "the motor starts again when Stop is let go" : r.both || r.bothRunning ? "Start wins over Stop" : "";
  r.lamps = lampBad.filter(function (x, i, a) { return a.indexOf(x) === i; });
  return r;
}
module.exports = { translate: translate, load: load, sim: sim };

return module.exports; })();
module.exports = function (L, items) {
  var item = L.aiBenchQuestions.filter(function (x) { return x.id === "code-p1am-seal-in"; })[0];
  var out = [], findings = [], misses = [];
function sameW(a, b) { return !!a && !!b && a.start.ch === b.start && a.stop.ch === b.stop && a.stop.nc === b.nc && (a.out ? a.out.ch : null) === b.out; }
function toW(b) { return b ? { start: { ch: b.start, nc: false }, stop: { ch: b.stop, nc: b.nc }, out: { ch: b.out } } : null; }
// the changed sketch: each original line replaced by the variant (the stop name toggled at some uses) that the Write text holds
function applyWrite(text, write, v) {
  var rest = write.trim(), lines = text.split("\n"), used = 0;
  var re = new RegExp("(!\\s*)?\\b" + v + "\\b", "g");
  for (var i = 0; i < lines.length && rest; i++) {
    var L0 = lines[i], occ = [], m;
    re.lastIndex = 0;
    while ((m = re.exec(L0))) occ.push({ at: m.index, len: m[0].length, neg: !!m[1] });
    if (!occ.length) continue;
    for (var mask = 1; mask < (1 << occ.length); mask++) {
      var nl = "", from = 0;
      occ.forEach(function (x, k) { nl += L0.slice(from, x.at) + ((mask >> k) & 1 ? (x.neg ? v : "!" + v) : L0.slice(x.at, x.at + x.len)); from = x.at + x.len; });
      nl += L0.slice(from);
      var t = nl.trim(), t2 = t + " (in place of " + L0.trim() + ")";
      var hit = rest.indexOf(t2) === 0 ? t2 : rest.indexOf(t) === 0 ? t : null;
      if (hit) { lines[i] = nl; rest = rest.slice(hit.length).trim(); used++; break; }
    }
  }
  return { text: lines.join("\n"), left: rest, used: used };
}
items.forEach(function (c) {
  var right = /^R/.test(c.id), r = { id: c.id, right: right };
  var lw = L.codeScan.wiring(c.q);
  r.wiring = lw;
  r.wiringOk = c.wiring ? (lw === null ? "not read" : sameW(lw, c.wiring) ? "ok" : "WRONG") : (lw === null ? "ok" : "WRONG (should be null)");
  var ss = lw ? L.codeScan.startStop(c.text, lw) : null;
  r.verdicts = ss ? ss.verdicts : null; r.motor = ss ? ss.motor : null;
  var si = c.wiring || (c.sim && c.sim.manual ? null : null);
  var ssI = L.codeScan.startStop(c.text, toW(c.wiring || { start: c.sim.start[1], stop: c.sim.stop[1], nc: c.sim.stop[2], out: +c.sim.motor.split(":")[1] }));
  r.verdictsIntended = ssI ? ssI.verdicts : null;
  r.stopScan = L.aiCode.stopScan("arduino", c.text, c.q);
  var reply = "MAKE CODE: Start stop\nlanguage arduino\n" + c.text + "END";
  var made = L.aiAct.fromReply(reply, c.q);
  r.problems = made ? made.problems : ["no MAKE block"];
  if (c.expect.bench !== undefined) r.bench = L.aiBench.grade(item, reply, { made: made }).why;
  // the line to write
  var msg = r.stopScan[0] || "", wm = /Write: ([\s\S]*)$/.exec(msg), vm2 = /Use (\w+) the other way round/.exec(msg);
  if (wm && vm2) {
    var ap = applyWrite(c.text, wm[1], vm2[1]);
    r.write = wm[1];
    if (ap.left) r.writeCheck = "could not place: " + ap.left;
    else {
      var sv = E.sim(ap.text, c.sim);
      r.writeCheck = sv.verdict === "" && !sv.lamps.length ? "works" : "WRONG: " + (sv.verdict || sv.lamps.join("; "));
      r.writeLines = ap.used;
    }
  }
  // what is a finding
  var said = r.stopScan.length > 0;
  if (right && said) findings.push([c.id, "message on a right program", msg]);
  if (right && r.bench) findings.push([c.id, "bench fails a right program", r.bench]);
  if (!right && c.expect.bench !== undefined && !r.bench) findings.push([c.id, "bench passes a wrong program", "why = \"\" ; verdicts " + JSON.stringify(r.verdicts)]);
  if (/WRONG/.test(r.wiringOk)) findings.push([c.id, "wiring read wrong", JSON.stringify(lw)]);
  if (r.writeCheck && r.writeCheck !== "works") findings.push([c.id, "line to write", r.write + "  -> " + r.writeCheck]);
  if (!right && c.expect.stopScan === "silent" && said) findings.push([c.id, "message where the spec says silent", msg]);
  if (!right && c.expect.stopScan === "speak" && !said) misses.push([c.id, r.wiringOk === "not read" ? "wiring words not read" : "silent", JSON.stringify(r.verdicts)]);
  out.push(r);
});
  return { out: out, findings: findings, misses: misses };
};
