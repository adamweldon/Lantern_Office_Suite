// make_before.js <22b1c03's src/lantern.inner.html> -- writes before_22b1c03.json: each case as 22b1c03 built it.
//   git show 22b1c03:src/lantern.inner.html > /some/where/22b1c03.html; node make_before.js /some/where/22b1c03.html
"use strict";
var fs = require("fs"), path = require("path"), lib = require("./lib.js"), cases = require("./cases.js");
lib.run(process.argv[2], cases, function (out) {
  var m = {};
  out.forEach(function (x) { m[x.id] = x; });
  fs.writeFileSync(path.join(__dirname, "before_22b1c03.json"), JSON.stringify(m, null, 1) + "\n");
  var bad = cases.filter(function (k) { return k.want === "keep" && !m[k.id].ok; });
  bad.forEach(function (k) { console.log("NOT DRAWN ON 22b1c03 (a keep case must have drawn): " + k.id + " " + m[k.id].problems.join(" || ")); });
  console.log(out.length + " cases written");
});
