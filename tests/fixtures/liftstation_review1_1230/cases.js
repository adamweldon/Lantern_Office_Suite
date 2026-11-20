// cases.js -- the review's cases (review 1 of 1.24.30, the lift station), in four files by rule:
//   A cases_control.js  (MAKE CONTROL's alternating relay; plain control circuits as before; what the model is told)
//   B cases_station.js  (MAKE PIPING and MAKE LEVELS)
//   C cases_parts.js    (a question in parts: the split, the guard, the instructions, Chat, the bench's path)
//   E cases_standards.js (the standards Lantern cites, against the documents)
// Each case: {id, rule, right (a RIGHT input), why (what is right and why), harm (if Lantern does otherwise), type, ...}.
"use strict";
module.exports = [].concat(require("./cases_control.js"), require("./cases_station.js"), require("./cases_parts.js"), require("./cases_standards.js"));
