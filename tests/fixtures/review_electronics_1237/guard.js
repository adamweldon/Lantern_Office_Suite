// guard.js -- builds every saved reply harvest.js finds, and gives each one's result as it came out:
//   node guard.js [lantern.inner.html] > out.json      (guard_before.json is this run on 22b1c03)
// Each key: {el: the reply has a block read as electronics, ok, problems, branches, summary, rest: [the same, for the
// reply's other blocks]}.
"use strict";
var path = require("path");
module.paths.unshift(path.join(__dirname, "..", "..", "..", "node_modules"));
var load = require(path.join(__dirname, "..", "liftstation_review1_1230", "load.js")), harvest = require("./harvest.js");

function sig(m, L, q) {
  if (!m) return null;
  var b = m.block || {}, el = false;
  try { el = !!(L.aiElectronics && b.action && b.action.id === "schematic" && L.aiElectronics.isElectronics(b, q)); } catch (e) { el = false; }
  var c = m.plan && m.plan.circuit;
  return { el: el, kind: String(b.kind || ""), ok: !!m.ok, problems: (m.problems || []).slice(), branches: c && c.branches ? JSON.stringify(c.branches) : null,
    summary: m.summary ? String(m.summary) : "" };
}
async function run(file) {
  var o = load(file), L = o.L, out = {};
  await new Promise(function (r) { setTimeout(r, 80); });
  harvest().forEach(function (h) {
    var m = null, r = [];
    try { m = L.aiAct.build(h.text, h.q); } catch (e) { out[h.key] = { error: String(e && e.message || e) }; return; }
    try { r = m && L.aiAct.rest ? L.aiAct.rest(h.text, h.q, m) : []; } catch (e) { r = []; }
    var s = sig(m, L, h.q);
    if (!s) return;
    s.rest = (r || []).map(function (x) { return sig(x, L, h.q); });
    s.anyEl = s.el || s.rest.some(function (x) { return x && x.el; });
    out[h.key] = s;
  });
  return out;
}
module.exports = run;
if (require.main === module) {
  var file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html");
  run(file).then(function (res) { process.stdout.write(JSON.stringify(res, null, 1) + "\n"); });
}
