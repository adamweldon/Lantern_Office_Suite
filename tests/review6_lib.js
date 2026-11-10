// review6_lib.js -- the sixth reviewer of 1.24.13's own helper: expands its safety cases (tests/fixtures/review6_1253_safety.json),
// which are kept as templates (one is 1 MB of blank lines). Used by tests/review6_safety_run.js. Not a suite of its own.
// shared helpers for the review6 runners
var BENCH_Q = "Write a P1AM-100 sketch: a Start button on input 1 and a normally closed Stop button on input 2 of the discrete input module in slot 1, and a motor contactor on output 1 of the output module in slot 2, with a seal-in.";
var TPL = {
  // Stop read the wrong way round (NC stop): runs only while Stop is held -> sure verdict "Stop turns the motor on"
  wrong: "#include <P1AM.h>\n{G}\nbool running = false;\n{F}\nvoid setup() {\n  while (!P1.init()) {\n    ;\n  }\n}\n\nvoid loop() {\n  bool start = P1.readDiscrete(1, 1);\n  bool stopPressed = !P1.readDiscrete(1, 2);\n{L}\n  running = (start || running) && stopPressed;\n  P1.writeDiscrete(running, 2, 1);\n}\n",
  right: "#include <P1AM.h>\n{G}\nbool running = false;\n{F}\nvoid setup() {\n  while (!P1.init()) {\n    ;\n  }\n}\n\nvoid loop() {\n  bool start = P1.readDiscrete(1, 1);\n  bool stopOk = P1.readDiscrete(1, 2);\n{L}\n  running = (start || running) && stopOk;\n  P1.writeDiscrete(running, 2, 1);\n}\n"
};
function rep(unit, n, sep) { var a = []; for (var i = 0; i < n; i++) a.push(String(unit).replace(/\{i\}/g, i).replace(/\{i1\}/g, i + 1)); return a.join(sep || ""); }
function part(p) {
  if (typeof p === "string") return p;
  if (p.rep !== undefined) return rep(p.rep, p.n, p.sep);
  if (p.nest) return rep(p.nest[0], p.nest[3]) + p.nest[1] + rep(p.nest[2], p.nest[3]);
  if (p.tpl) { var parts = p.parts || {}; return TPL[p.tpl].replace("{G}", expandParts(parts.g)).replace("{F}", expandParts(parts.f)).replace("{L}", expandParts(parts.l)); }
  throw new Error("bad part " + JSON.stringify(p));
}
function expandParts(x) { if (x == null) return ""; if (typeof x === "string") return x; if (Array.isArray(x)) return x.map(part).join(""); return part(x); }
function expand(c) { return { text: expandParts(c.sketch), q: c.q == null ? BENCH_Q : expandParts(c.q) }; }
function reply(text) { return "MAKE CODE: t\nlanguage arduino\n" + text + "\nEND"; }
module.exports = { BENCH_Q: BENCH_Q, TPL: TPL, expand: expand, rep: rep, reply: reply };
