// plain_sig.js -- what a built control block comes to, as a string to compare between versions: ok, the problems, the
// summary, and each rung (its output, stops, starts, holding contact, series, overloads, branches).
module.exports = function sig(r) {
  if (!r) return "NULL";
  var s = { ok: !!r.ok, problems: r.problems || [], summary: r.summary || "" };
  if (r.plan && r.plan.circuit) s.rungs = r.plan.circuit.rungs.map(function (g) { return JSON.stringify([g.out, g.stops, g.starts, g.seal, g.series, g.after, g.branches || null]); });
  return JSON.stringify(s);
};
