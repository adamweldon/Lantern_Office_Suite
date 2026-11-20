// make_before.js -- writes plain_before.json: how 1.24.29 (commit 4ebee3c, the version before 1.24.30) drew each
// plain control case. Run once: git show 4ebee3c:src/lantern.inner.html > /tmp/prev.html; node make_before.js /tmp/prev.html
"use strict";
var path = require("path"), fs = require("fs");
module.paths.unshift(path.join(__dirname, "..", "..", "..", "node_modules"));
var load = require("./load.js"), PLAIN = require("./plain_cases.js");
function ids(list) { return (list || []).map(function (e) { return e.id + (e.nc ? "/" : ""); }).join(","); }
var o = load(path.resolve(process.argv[2])), L = o.L, out = {};
setTimeout(function () {
  PLAIN.forEach(function (p) {
    var m = L.aiAct.build("MAKE CONTROL: Control\n" + p.lines.join("\n") + "\nEND", p.q || "Draw the control circuit");
    out[p.id] = m.ok && m.plan && m.plan.circuit ? m.plan.circuit.rungs.map(function (r) {
      return r.out.id + ":" + r.out.kind + " s[" + ids(r.stops) + "] st[" + ids(r.starts) + "]" + (r.seal ? "+seal" : "") + " se[" + ids(r.series) + "] a[" + ids(r.after) + "]" + (r.branches ? " br" + JSON.stringify(r.branches.map(ids)) : "");
    }).join(" ; ") : "REFUSED " + m.problems.join(" | ");
  });
  fs.writeFileSync(path.join(__dirname, "plain_before.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(Object.keys(out).length + " written");
  process.exit(0);
}, 80);
