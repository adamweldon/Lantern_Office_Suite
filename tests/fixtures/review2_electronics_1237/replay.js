// replay.js [file] -- the second review's cases of 1.24.37's AI_ELECTRONICS mends, built by src/lantern.inner.html
// (or the file named), each judged against what it should be:
//   keep   -- a right reply that drew on 22b1c03 (before_22b1c03.json) draws the same: same branches, no new note
//   same   -- drawn on 22b1c03: draws the same; questioned on 22b1c03: still questioned
//   draw   -- draws, its signature holding each string in want.draw and none in want.not (and want.parts, if given;
//             and what Lantern says it added or changed matching want.note, if given)
//   either -- draws with want.draw, or is questioned with want.ask and none of want.not
//   ask    -- questioned, the problems matching each regex in want.ask and none in want.not
// Prints AGREE <id> or DISAGREE <id> <seen> [high|medium|low], then "N cases: A AGREE, D DISAGREE".
"use strict";
var path = require("path"), fs = require("fs"), lib = require("./lib.js"), cases = require("./cases.js");
var file = process.argv[2] || path.join(__dirname, "..", "..", "..", "src", "lantern.inner.html");
var before = JSON.parse(fs.readFileSync(path.join(__dirname, "before_22b1c03.json"), "utf8"));
function seen(x) { return x.ok ? "drew [" + x.sig + "]" + (x.ch ? " noting [" + x.ch + "]" : "") : "questioned [" + x.problems.join(" || ") + "]"; }
lib.run(file, cases, function (out) {
  var A = 0, D = 0, by = {};
  out.forEach(function (x) { by[x.id] = x; });
  cases.forEach(function (k) {
    var x = by[k.id], b = before[k.id], bad = null, harm = k.harm || "medium";
    if (k.want === "keep" || k.want === "same") {
      if (!b) bad = "no 22b1c03 record (run make_before.js)";
      else if (b.ok) {
        if (!x.ok || x.sig !== b.sig) bad = seen(x) + " where 22b1c03 drew [" + b.sig + "]";
        else if (x.ch !== b.ch) { bad = "drew the same with a new note [" + x.ch + "]"; harm = "low"; }
      } else if (k.want === "keep") bad = "a keep case 22b1c03 did not draw";
      else if (x.ok) bad = seen(x) + " where 22b1c03 questioned it";
    } else if (k.want.either) {
      var t0 = x.problems.join(" || ");
      if (x.ok ? k.want.draw.some(function (s) { return x.sig.indexOf(s) < 0; }) :
        k.want.ask.some(function (re) { return !new RegExp(re).test(t0); }) || k.want.not.some(function (re) { return new RegExp(re).test(t0); })) bad = seen(x);
    } else if (k.want.draw) {
      if (!x.ok) bad = seen(x);
      else {
        var miss = k.want.draw.filter(function (s) { return x.sig.indexOf(s) < 0; }), extra = k.want.not.filter(function (s) { return x.sig.indexOf(s) >= 0; });
        if (miss.length || extra.length || (k.want.parts && k.want.parts !== x.parts)) bad = seen(x) + (k.want.parts && k.want.parts !== x.parts ? " parts [" + x.parts + "]" : "");
        else if (k.want.note && !new RegExp(k.want.note).test(x.said)) bad = "drew right but did not say it: [" + x.said + "]";
      }
    } else if (k.want.ask) {
      var t = x.problems.join(" || ");
      if (x.ok) bad = seen(x);
      else if (k.want.ask.some(function (re) { return !new RegExp(re).test(t); }) || k.want.not.some(function (re) { return new RegExp(re).test(t); })) bad = seen(x);
    }
    if (bad) { D++; console.log("DISAGREE " + k.id + " " + bad.replace(/\s+/g, " ") + " [" + harm + "]"); }
    else { A++; console.log("AGREE " + k.id); }
  });
  console.log(cases.length + " cases: " + A + " AGREE, " + D + " DISAGREE");
});
