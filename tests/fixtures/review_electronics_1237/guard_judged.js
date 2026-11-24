// guard_judged.js -- the saved electronics replies that build otherwise on afea882 than on 22b1c03, each judged by the
// reviewer. check(before, now) -> [what is wrong] ([] = the change is right). Any other difference is a DISAGREE (high).
"use strict";
function diffProblems(a, b) {
  return { gone: a.problems.filter(function (p) { return b.problems.indexOf(p) < 0; }), added: b.problems.filter(function (p) { return a.problems.indexOf(p) < 0; }) };
}
function onlyPinHint(a, b, want) {   // the same problems but one pin line, whose handed-back line is now `want`
  var d = diffProblems(a, b);
  if (b.ok !== a.ok || d.gone.length !== 1 || d.added.length !== 1) return null;
  return want.test(d.added[0]) ? d.added[0] : null;
}
function mainOrRest(s, i) { return i == null ? s : s.rest[i]; }
module.exports = {
  // the 35B's two tries on Adam's laptop (bench set B, the motor question): now drawn, as the reply means
  "bench_run_1258_35b_setb/make-electronics-b/reply": { sev: "high", check: function (a, b) {
    return b.ok && /"load":\{"id":"M1","kind":"motor"\},"pin":"P1","q":"Q1"/.test(b.branches) && /"diode":\{"id":"D1"/.test(b.branches) && /Lantern added motor M1, which Q1’s line names/.test(b.summary) ? [] : ["not drawn as Q1 switching M1 from P1 with the model's D1: " + JSON.stringify(b).slice(0, 300)]; } },
  "bench_run_1258_35b_setb/make-electronics-b/first": { sev: "high", check: function (a, b) {
    return b.ok && /"load":\{"id":"M1","kind":"motor"\},"pin":"P1","q":"Q1"/.test(b.branches) && /"diode":\{"id":"D1"/.test(b.branches) && /Q1’s line names K1, which no line has/.test(b.summary) ? [] : ["not drawn as Q1 switching M1 from P1: " + JSON.stringify(b).slice(0, 300)]; } },
  // no load at all, the relay question: "add the relay the question asks for, like: relay K1" is the right part (was an LED)
  "bench_run_1244_08b/make-electronics/reply": { sev: "medium", check: function (a, b) {
    var d = diffProblems(a, b);
    return !b.ok && d.added.length === 1 && /add the relay the question asks for, like: relay K1/.test(d.added[0]) ? [] : ["went back otherwise: " + b.problems.join(" | ")]; } },
  "bench_run_1.24.35_0.8b/make-electronics/reply": { sev: "medium", check: function (a, b) {
    var d = diffProblems(a, b);
    return !b.ok && d.added.length === 1 && /add the relay the question asks for, like: relay K1/.test(d.added[0]) ? [] : ["went back otherwise: " + b.problems.join(" | ")]; } },
  // the 2B's copies of the guide's button example in the relay question: the spare pin's line is now only
  // "transistor Q1 K1 Pn" -- Q1 already switches K1 from the other pin, so the copy gives Q1 a second pin and the
  // same problem comes back. The old list's "switch S1 Pn" (what the guide's leftover pin is) is gone.
  "bench_run_1.24.31_2b/make-electronics/first": { sev: "low", check: function (a, b) {
    var h = onlyPinHint(a, b, /\(transistor Q1 K1 P\d\)$/);
    return h ? ["the spare pin's line is now only “" + h.replace(/^.*\(/, "").replace(/\)$/, "") + "”, though Q1 already switches K1 from another pin (was: led, transistor or switch)"] : ["went back otherwise: " + b.problems.join(" | ")]; } },
  "bench_run_1245_2b/make-electronics/first": { sev: "low", check: function (a, b) {
    var x = mainOrRest(a, 1), y = mainOrRest(b, 1);
    if (JSON.stringify(Object.assign({}, a, { rest: null })) !== JSON.stringify(Object.assign({}, b, { rest: null }))) return ["the first block builds otherwise"];
    var h = onlyPinHint(x, y, /\(transistor Q1 K1 P\d\)$/);
    return h ? ["(second block) the spare pin's line is now only “" + h.replace(/^.*\(/, "").replace(/\)$/, "") + "”, though Q1 already switches K1 from another pin"] : ["went back otherwise: " + y.problems.join(" | ")]; } },
  "bench_run_1246_2b/make-electronics/reply": { sev: "low", check: function (a, b) {
    var h = onlyPinHint(a, b, /\(transistor Q1 K1 P\d\)$/);
    return h ? ["the spare pin's line is now only “" + h.replace(/^.*\(/, "").replace(/\)$/, "") + "”, though Q1 already switches K1 from another pin"] : ["went back otherwise: " + b.problems.join(" | ")]; } },
  // the 0.8B copying the guide's text: in the relay question the spare pin's line now names the LED D1 (was K1)
  "bench_run_1247_08b/make-electronics/first": { sev: "medium", check: function (a, b) {
    var h = onlyPinHint(a, b, /\(transistor Q1 \w+ P\d\)$/);
    if (!h) return ["went back otherwise: " + b.problems.join(" | ")];
    return /transistor Q1 K1 /.test(h) ? [] : ["a relay question: the spare pin's line now names “" + h.replace(/^.*\(/, "").replace(/\)$/, "") + "”, an LED (was transistor Q1 K1 P3)"]; } }
};
