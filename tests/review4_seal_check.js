// review4_seal_check.js -- the fourth reviewer's check of the lines Lantern's Start-wins rule hands back (1.24.12,
// tests/fixtures/review4_1252_startwins.json), made a module for tests/review_1252.js. Each line to write is run
// against the model's own logic over every input and the old output state: (a) any stop on -> the output off;
// (b) every stop off -> as the model wrote it; (c) valid code with the program's own names. Not a suite of its own.
"use strict";

function toJS(code, lang) {
  var s = String(code);
  if (lang === "st") {
    s = s.replace(/\bELSIF\b([\s\S]*?)\bTHEN\b/gi, "\u0001($1) {").replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi, "if ($1) {")
      .replace(/\bEND_IF\b\s*;?/gi, "}").replace(/\bELSE\b/gi, "} else {").replace(/\u0001/g, "} else if ")
      .replace(/<>/g, "!=").replace(/([^:<>!=])=(?!=)/g, "$1==").replace(/:=/g, "=").replace(/\bAND\b/gi, "&&").replace(/\bXOR\b/gi, "^").replace(/\bOR\b/gi, "||").replace(/\bNOT\b/gi, "!")
      .replace(/\bTRUE\b/gi, "true").replace(/\bFALSE\b/gi, "false");
  } else {
    s = s.replace(/\bdigitalRead\s*\(\s*(\w+)\s*\)/g, "dr_$1").replace(/\bHIGH\b/g, "1").replace(/\bLOW\b/g, "0").replace(/\bbool\s+/g, "");
  }
  return s;
}
var JSKW = /^(if|else|true|false|var|return)$/;
function vars(js) { var seen = {}, o = []; (js.match(/[A-Za-z_]\w*/g) || []).forEach(function (w) { if (!JSKW.test(w) && !seen[w]) { seen[w] = 1; o.push(w); } }); return o; }
function compile(code, lang) { var js = toJS(code, lang); try { return { fn: new Function("env", "with (env) { " + js + " }"), vars: vars(js), js: js }; } catch (e) { return { err: String(e.message), js: js }; } }
function run(c, env, t) { var e = {}; for (var k in env) e[k] = env[k]; c.fn(e); return !!e[t]; }
function idsOf(code, lang) { return vars(toJS(code, lang)); }

// checks a line to write against the model's logic: (a) any stop on -> off, (b) all stops off -> as the model, (c) valid, own names
function check(lc, fixText, lang, prog, expectFix) {
  var probs = [];
  var o = compile(lc.logic, lang), f = compile(fixText, lang);
  if (f.err) return ["(c) does not parse: " + f.err + " [" + f.js + "]"];
  if (o.err) return ["(runner) original does not compile: " + o.err];
  // (c) style and names
  if (lang === "st" && (/&&|\|\||!(?!=)/.test(fixText) || !/:=/.test(fixText) || !/;\s*$/.test(fixText))) probs.push("(c) not Structured Text syntax");
  if (lang === "arduino" && (/:=|\bAND\b|\bOR\b|\bNOT\b/.test(fixText) || !/;\s*$/.test(fixText) && !/\}\s*$/.test(fixText))) probs.push("(c) not C syntax");
  var progIds = {}; idsOf(prog, lang).forEach(function (w) { progIds[w] = 1; });
  idsOf(fixText, lang).forEach(function (w) { if (!progIds[w] && !/^dr_/.test(w)) probs.push("(c) name not in the program: " + w); });
  var all = {}; o.vars.concat(f.vars).forEach(function (w) { all[w] = 1; }); var vs = Object.keys(all);
  var e = expectFix ? compile(expectFix, lang) : null;
  if (e && !e.err) e.vars.forEach(function (w) { if (vs.indexOf(w) < 0) vs.push(w); });
  var t = lc.t, stops = lc.stopOn, hold = lc.hold || {}, aBad = null, bBad = null, eBad = null;
  for (var m = 0; m < (1 << vs.length); m++) {
    var env = {}; vs.forEach(function (v, i) { env[v] = (m >> i) & 1; });
    env.Serial = { println: function () {}, print: function () {} }; env.digitalWrite = function () {};
    var on = Object.keys(stops).some(function (s) { return env[s] === stops[s]; });
    var held = Object.keys(hold).every(function (h) { return env[h] === hold[h]; });
    var O = run(o, env, t), F = run(f, env, t);
    if (on && held && F && !aBad) aBad = JSON.stringify(strip(env)) + " -> " + t + " stays ON";
    if (!on && O !== F && !bBad) bBad = JSON.stringify(strip(env)) + " model " + O + ", fix " + F;
    if (e && !e.err && run(e, env, t) !== F && !eBad) eBad = JSON.stringify(strip(env)) + " expected " + run(e, env, t) + ", fix " + F;
  }
  if (aBad) probs.push("(a) Stop does not win: " + aBad);
  if (bBad) probs.push("(b) differs from the model with Stop off: " + bBad);
  if (eBad) probs.push("(info) differs from my expected fix: " + eBad);
  return probs;
}
function strip(env) { var o = {}; for (var k in env) if (typeof env[k] === "number") o[k] = env[k]; return o; }
function tOf(logic) { var m = /([A-Za-z_]\w*)\s*:?=\s*(TRUE|true)\b/.exec(logic); if (m) return m[1]; return /^\s*([A-Za-z_]\w*)\s*:?=/.exec(logic)[1]; }
function fixOf(msg) { var m = /(?:Write: |every branch kept: |Put the Stop test last: )([\s\S]+)$/.exec(msg); return m ? m[1] : null; }
function tOfMsg(msg) { var m = /^Start wins over Stop: ([A-Za-z_]\w*) :?= /.exec(msg) || / turns ([A-Za-z_]\w*)(?: and \w+)* on/.exec(msg); return m ? m[1] : null; }

module.exports = function (L, cases) {
var res = { right: 0, rightSpoken: [], wrong: 0, found: 0, missed: [], linesChecked: 0, badLines: [], extra: [] };
cases.forEach(function (c) {
  var out = L.aiCode.startWins(c.lang, c.text, c.q);
  c.got = out;
  if (c.expect === "silent") { res.right++; if (out.length) res.rightSpoken.push({ id: c.id, why: c.why, got: out }); return; }
  res.wrong++;
  if (!out.length) { res.missed.push({ id: c.id, why: c.why }); return; }
  res.found++;
  var lcs = [];
  if (c.logic) lcs.push({ logic: c.logic, stopOn: c.stopOn, hold: c.hold, t: tOf(c.logic), fix: c.fix });
  if (c.logic2) lcs.push({ logic: c.logic2, stopOn: c.stopOn2, hold: c.hold, t: tOf(c.logic2) });
  if ((c.count || 1) !== out.length) res.extra.push({ id: c.id, want: c.count || 1, got: out.length, msgs: out });
  out.forEach(function (msg) {
    var fx = fixOf(msg), t = tOfMsg(msg), lc = lcs.filter(function (x) { return x.t === t; })[0];
    if (!fx) { res.badLines.push({ id: c.id, msg: msg, probs: ["no line to write found in message"] }); return; }
    if (!lc) { res.badLines.push({ id: c.id, msg: msg, probs: ["message about an output not expected: " + t] }); return; }
    res.linesChecked++;
    var p = check(lc, fx, c.lang, c.text, lc.fix);
    var real = p.filter(function (x) { return !/^\(info\)/.test(x); });
    if (real.length) res.badLines.push({ id: c.id, fix: fx, probs: p });
    else if (p.length) res.extra.push({ id: c.id, note: p, fix: fx });
  });
});
  return res;
};
