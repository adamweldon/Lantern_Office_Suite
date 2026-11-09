// review_stsim.js -- a tiny boolean Structured Text interpreter written by the third reviewer of 1.24.12 (tests/fixtures/review3_1252_startwins.json),
// used by tests/review_1252.js to check the lines Lantern's Start-wins rule hands back. Not a suite of its own.
// stsim.js -- a tiny boolean Structured Text interpreter, to check the lines startWins hands back.
// Statements: x := expr;  IF e THEN ... ELSIF e THEN ... ELSE ... END_IF;
// Expressions: NOT (highest), AND / &, XOR, OR (lowest); TRUE FALSE 1 0; brackets. Names are case-insensitive.
// C lines (Arduino) are turned into ST first: || && ! = if/else if/else with braces.
"use strict";
function lex(s) {
  var t = [], i = 0, m;
  while (i < s.length) {
    var r = s.slice(i);
    if ((m = /^\s+/.exec(r))) { i += m[0].length; continue; }
    if ((m = /^:=/.exec(r))) { t.push(":="); i += 2; continue; }
    if ((m = /^[;()&]/.exec(r))) { t.push(m[0] === "&" ? "AND" : m[0]); i++; continue; }
    if ((m = /^[A-Za-z_][\w]*/.exec(r))) {
      var w = m[0], u = w.toUpperCase();
      t.push(/^(AND|OR|XOR|NOT|TRUE|FALSE|IF|THEN|ELSIF|ELSE|END_IF)$/.test(u) ? u : "$" + w.toLowerCase());
      i += w.length; continue;
    }
    if ((m = /^[01]\b/.exec(r))) { t.push(m[0] === "1" ? "TRUE" : "FALSE"); i++; continue; }
    throw new Error("cannot read at: " + r.slice(0, 30));
  }
  return t;
}
function parse(src) {
  var t = lex(src), p = 0;
  function peek() { return t[p]; }
  function eat(x) { if (t[p] !== x) throw new Error("expected " + x + " got " + t[p] + " at " + p); p++; }
  function expr() { return orE(); }
  function orE() { var a = xorE(); while (peek() === "OR") { p++; a = { op: "OR", a: a, b: xorE() }; } return a; }
  function xorE() { var a = andE(); while (peek() === "XOR") { p++; a = { op: "XOR", a: a, b: andE() }; } return a; }
  function andE() { var a = notE(); while (peek() === "AND") { p++; a = { op: "AND", a: a, b: notE() }; } return a; }
  function notE() { if (peek() === "NOT") { p++; return { op: "NOT", a: notE() }; } return prim(); }
  function prim() {
    var x = peek();
    if (x === "(") { p++; var e = expr(); eat(")"); return e; }
    if (x === "TRUE" || x === "FALSE") { p++; return { op: "K", v: x === "TRUE" }; }
    if (x && x.charAt(0) === "$") { p++; return { op: "V", n: x.slice(1) }; }
    throw new Error("bad primary " + x);
  }
  function stmts(ends) {
    var out = [];
    while (p < t.length && ends.indexOf(peek()) < 0) {
      if (peek() === ";") { p++; continue; }
      if (peek() === "IF") {
        p++; var brs = [], els = null, c = expr(); eat("THEN");
        brs.push({ c: c, s: stmts(["ELSIF", "ELSE", "END_IF"]) });
        while (peek() === "ELSIF") { p++; c = expr(); eat("THEN"); brs.push({ c: c, s: stmts(["ELSIF", "ELSE", "END_IF"]) }); }
        if (peek() === "ELSE") { p++; els = stmts(["END_IF"]); }
        eat("END_IF"); if (peek() === ";") p++;
        out.push({ k: "if", brs: brs, els: els });
        continue;
      }
      var v = peek(); if (!v || v.charAt(0) !== "$") throw new Error("bad statement at " + v);
      p++; eat(":="); var e = expr(); if (peek() === ";") p++;
      out.push({ k: "set", n: v.slice(1), e: e });
    }
    return out;
  }
  var prog = stmts([]);
  if (p < t.length) throw new Error("left over " + t.slice(p).join(" "));
  return prog;
}
function ev(e, env) {
  switch (e.op) {
    case "K": return e.v;
    case "V": return !!env[e.n];
    case "NOT": return !ev(e.a, env);
    case "AND": return ev(e.a, env) && ev(e.b, env);
    case "OR": return ev(e.a, env) || ev(e.b, env);
    case "XOR": return ev(e.a, env) !== ev(e.b, env);
  }
}
function run(prog, env) {
  prog.forEach(function (s) {
    if (s.k === "set") env[s.n] = ev(s.e, env);
    else {
      var done = false;
      s.brs.forEach(function (b) { if (!done && ev(b.c, env)) { done = true; run(b.s, env); } });
      if (!done && s.els) run(s.els, env);
    }
  });
  return env;
}
function names(prog, acc) {
  acc = acc || {};
  function en(e) { if (!e) return; if (e.op === "V") acc[e.n] = 1; en(e.a); en(e.b); }
  prog.forEach(function (s) { if (s.k === "set") { acc[s.n] = 1; en(s.e); } else { s.brs.forEach(function (b) { en(b.c); names(b.s, acc); }); if (s.els) names(s.els, acc); } });
  return acc;
}
function assigned(prog, acc) {
  acc = acc || {};
  prog.forEach(function (s) { if (s.k === "set") acc[s.n] = 1; else { s.brs.forEach(function (b) { assigned(b.s, acc); }); if (s.els) assigned(s.els, acc); } });
  return acc;
}
// C to ST, for the simple Arduino lines here
function c2st(s) {
  return String(s).replace(/\|\|/g, " OR ").replace(/&&/g, " AND ").replace(/!(?!=)/g, " NOT ")
    .replace(/\belse\s+if\s*\(/g, "ELSIF (").replace(/\bif\s*\(/g, "IF (").replace(/\belse\b/g, "ELSE")
    .replace(/\)\s*\{/g, ") THEN ").replace(/\}\s*(?=ELSIF|ELSE)/g, " ").replace(/\}/g, " END_IF;")
    .replace(/([A-Za-z_]\w*)\s*=(?!=)/g, "$1 :=").replace(/\btrue\b/g, "TRUE").replace(/\bfalse\b/g, "FALSE")
    .replace(/\bHIGH\b/g, "TRUE").replace(/\bLOW\b/g, "FALSE");
}
// same(a, b, outs): the two programs give the same final value of each name in outs for every input and old state
function same(a, b, outs) {
  var pa = parse(a), pb = parse(b), ns = Object.keys(names(pa, names(pb))), bad = [];
  outs = outs || Object.keys(assigned(pa));
  for (var k = 0; k < (1 << ns.length) && bad.length < 3; k++) {
    var env = {}; ns.forEach(function (n, i) { env[n] = !!(k & (1 << i)); });
    var ea = run(pa, Object.assign({}, env)), eb = run(pb, Object.assign({}, env));
    outs.forEach(function (o) { o = o.toLowerCase(); if (!!ea[o] !== !!eb[o]) bad.push({ out: o, inputs: Object.keys(env).filter(function (n) { return env[n]; }).join("+") || "(all off)", ref: !!ea[o], got: !!eb[o] }); });
  }
  return bad;
}
module.exports = { parse: parse, run: run, same: same, names: names, assigned: assigned, c2st: c2st };
