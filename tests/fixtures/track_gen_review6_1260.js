// A generator of TRACK scripts with my own simulator as the oracle (written from the puzzle's meaning, not from Lantern's code).
var ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
var ORDN = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
var NUMW = ["zero", "one", "two", "three", "four", "five", "six"];
function R(rng, n) { return Math.floor(rng() * n); }
function pick(rng, a) { return a[R(rng, a.length)]; }
function mk(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gen(seed) {
  var rng = mk(seed), people = rng() < 0.5;
  var pool = people ? ["Ann", "Bo", "Cy", "Di", "Ed", "Fay", "Gus", "Hal"] : ["Red", "Blue", "Green", "Yellow", "Pink", "White", "Black", "Gray"];
  var noun = people ? pick(rng, ["person", "child", "one"]) : pick(rng, ["cup", "one"]);
  var n = 3 + R(rng, 5), row = pool.slice(0, n), extra = pool.slice(n);
  var held = {}, tokens = [], lines = ["row " + row.join(" ")], toks = people ? ["ball", "flag", "key"] : ["coin", "ring", "pea"];
  function name(i) { return row[i]; }
  // place(i, depth, it) -> a phrase for index i, or null
  function place(i, depth, itIdx) {
    var N = row.length, f = [], j = N - i, k;
    f.push(function () { return name(i); });
    f.push(function () { return "position " + (i + 1); });
    if (i < 10) f.push(function () { return "the " + ORD[i] + " " + noun; });
    if (i > 0 && i < 10) f.push(function () { return ORD[i]; });
    if (i === 0) f.push(function () { return pick(rng, ["first", "the first " + noun, people ? "the front" : "the leftmost cup", people ? "the front of the queue" : "the cup on the far left", people ? "the " + noun + " at the front" : "the cup at the far left"]); });
    if (i === N - 1) f.push(function () { return pick(rng, ["last", "the last " + noun, people ? "the back of the queue" : "the rightmost cup", people ? "the " + noun + " at the back" : "the cup on the far right", people ? "the last " + noun + " in line" : "the end"]); });
    if (N % 2 === 1 && i === (N - 1) / 2) f.push(function () { return pick(rng, ["middle", "the middle " + noun, "the " + noun + " in the middle"]); });
    if (j === 2) f.push(function () { return pick(rng, ["second to last", "next to last", "the last but one", "the penultimate " + noun, "the second to last " + noun, "the " + noun + " second from the end"]); });
    if (j <= 10 && j >= 2) f.push(function () { return pick(rng, [ORD[j - 1] + " from the end", ORD[j - 1] + " from the right", "the " + ORD[j - 1] + " " + noun + " from the right", "the " + noun + " " + ORD[j - 1] + " from the right", ORDN[j - 1] + " from the end"]); });
    if (i >= 1 && i < 10) f.push(function () { return pick(rng, [ORD[i] + " from the left", "the " + noun + " " + ORD[i] + " from the left", "the " + ORD[i] + " " + noun + " from the left"]); });
    if (depth < 2) {
      for (var d = -3; d <= 3; d++) {
        if (!d) continue;
        (function (d) {
          var a = i - d; if (a < 0 || a >= N) return;
          f.push(function () {
            var X = place(a, depth + 1, itIdx); if (!X) return null;
            var L = d < 0 ? "left" : "right", ad = Math.abs(d);
            if (ad === 1) return pick(rng, [L + " of " + X, "the " + noun + " to the " + L + " of " + X, "the " + noun + " on the " + L + " of " + X, "the " + noun + " immediately to the " + L + " of " + X, people ? (d < 0 ? "in front of " + X : "behind " + X) : "the " + noun + " directly " + L + " of " + X, people ? (d < 0 ? "the " + noun + " in front of " + X : "the " + noun + " behind " + X) : L + " of " + X]);
            return pick(rng, [ad + " " + L + " of " + X, "the " + noun + " " + NUMW[ad] + " places to the " + L + " of " + X, "the " + noun + " " + ad + " places to the " + L + " of " + X, people ? NUMW[ad] + " places " + (d < 0 ? "in front of " : "behind ") + X : ad + " " + L + " of " + X]);
          });
        })(d);
      }
    }
    tokens.forEach(function (t) { if (held[t] === row[i]) f.push(function () { return pick(rng, ["holder of the " + t, "the " + noun + " holding the " + t, "the " + noun + " with the " + t, "the " + noun + " that has the " + t]); }); });
    if (i > 0 && i < N - 1 && depth < 1) f.push(function () { var a = rng() < 0.5; return "the " + noun + " between " + row[a ? i - 1 : i + 1] + " and " + row[a ? i + 1 : i - 1]; });
    if (N > 2 && depth < 1 && i === 1) f.push(function () { return "the " + noun + " next to " + row[0]; });
    if (N > 2 && depth < 1 && i === N - 2) f.push(function () { return "the " + noun + " next to " + row[N - 1]; });
    for (var t = 0; t < 6; t++) { var x = pick(rng, f)(); if (x) return x; }
    return name(i);
  }
  function opSwap() {
    var N = row.length, a = R(rng, N), b = R(rng, N); if (a === b) return null;
    var A = place(a, 0), Bp = place(b, 0);
    var form = R(rng, 4), line = form === 0 ? "swap " + A + " and " + Bp : form === 1 ? "swap " + A + " with " + Bp : form === 2 ? "switch " + A + " and " + Bp : "exchange " + A + " and " + Bp;
    var reps = 1;
    if (rng() < 0.25) { reps = pick(rng, [2, 3, 4]); line += " " + (reps === 2 ? pick(rng, ["twice", "two times", "2 times"]) : reps === 3 ? pick(rng, ["thrice", "three times", "3 times"]) : "4 times"); if (reps > 1 && /holding|with the|has the|holder/.test(A + Bp)) return null; if (reps > 1 && /(left|right|front|behind) of|between|next to|from the|last|first|middle|second|third|position|end|back|front|penultimate/.test(A + Bp)) return null; }
    for (var r = 0; r < reps; r++) { var t = row[a]; row[a] = row[b]; row[b] = t; }
    return line;
  }
  function opPut() {
    var t; if (tokens.length < 2 && (rng() < 0.6 || !tokens.length)) { t = pick(rng, toks.filter(function (x) { return tokens.indexOf(x) < 0; })); tokens.push(t); } else t = pick(rng, tokens);
    var i = R(rng, row.length), P = place(i, 0);
    var v = people ? pick(rng, ["give the " + t + " to ", "hand the " + t + " to "]) : pick(rng, ["put the " + t + " under ", "put the " + t + " in ", "hide the " + t + " under "]);
    held[t] = row[i]; return v + P;
  }
  function opPass() {
    var live = tokens.filter(function (t) { return held[t]; }); if (!live.length || !people) return null;
    var t = pick(rng, live), h = row.indexOf(held[t]), d = (rng() < 0.5 ? -1 : 1) * (1 + R(rng, 2)), reps = rng() < 0.3 ? 2 : 1;
    if (h + d * reps < 0 || h + d * reps >= row.length) return null;
    var L = d < 0 ? "left" : "right", ad = Math.abs(d), line;
    if (ad === 1) line = pick(rng, ["pass the " + t + " to the " + L, "pass the " + t + " to the " + noun + " on its " + L, "pass the " + t + " one place to the " + L]);
    else line = "pass the " + t + " " + pick(rng, ["two places to the " + L, "2 places to the " + L]);
    if (reps === 2) line = rng() < 0.5 ? line + " twice" : line.replace(/^pass the (\w+)/, "pass the $1 twice");
    held[t] = row[h + d * reps]; return line;
  }
  function opMove() {
    var N = row.length, i = R(rng, N), who = row[i];
    var X = pick(rng, [who, who, place(i, 1)]);
    if (/\s(to|in|at|into)\s/.test(" " + X + " ") && X !== who && rng() < 0.7) X = who;
    var rest = row.slice(0, i).concat(row.slice(i + 1)), M = rest.length, f = [];
    f.push(function () { return [pick(rng, ["the front", "first", people ? "the front of the queue" : "the far left", "position 1"]), 0]; });
    f.push(function () { return [pick(rng, ["the end", "last", people ? "the back of the queue" : "the far right", people ? "the back" : "the end of the row"]), M]; });
    f.push(function () { var k = R(rng, M + 1); return ["position " + (k + 1), k]; });
    f.push(function () { var k = R(rng, Math.min(M + 1, 10)); return ["the " + ORD[k] + " place", k]; });
    f.push(function () { return [pick(rng, ["second to last", "the second to last place", "next to last", "the penultimate place"]), M - 1]; });
    f.push(function () { var y = R(rng, M); return ["before " + rest[y], y]; });
    f.push(function () { var y = R(rng, M); return ["after " + rest[y], y + 1]; });
    if (people) f.push(function () { var y = R(rng, M); return [rng() < 0.5 ? "in front of " + rest[y] : "behind " + rest[y], -1, y]; });
    var c = pick(rng, f)(), k = c[1];
    if (k === -1) { k = /^in front/.test(c[0]) ? c[2] : c[2] + 1; }
    if (k < 0 || k > M) return null;
    var line = pick(rng, ["move " + X + " to " + c[0], /^(before|after|in front|behind)/.test(c[0]) ? "move " + X + " " + c[0] : "move " + X + " to " + c[0]]);
    rest.splice(k, 0, who); row.length = 0; Array.prototype.push.apply(row, rest);
    return line;
  }
  function opShift() {
    var k = 1 + R(rng, 4), L = rng() < 0.5 ? "left" : "right", reps = rng() < 0.3 ? 2 : 1, line = pick(rng, ["shift " + L + " " + k, "shift everything " + k + " places to the " + L, "rotate " + L + " by " + k]);
    if (reps === 2) line += " twice";
    for (var r = 0; r < k * reps; r++) { if (L === "right") row.unshift(row.pop()); else row.push(row.shift()); }
    return line;
  }
  function opReverse() { row.reverse(); return "reverse"; }
  function opAdd() {
    if (!extra.length) return null; var nm = extra.shift(), N = row.length, f = [];
    f.push(function () { return ["at the end", N]; }); f.push(function () { return ["at the front", 0]; });
    f.push(function () { var k = R(rng, N + 1); return ["at position " + (k + 1), k]; });
    f.push(function () { var y = R(rng, N); return ["before " + row[y], y]; });
    f.push(function () { var y = R(rng, N); return ["after " + row[y], y + 1]; });
    f.push(function () { return [pick(rng, ["second to last", "at second to last", "in the penultimate place"]), N - 1]; });
    f.push(function () { return ["", N]; });
    var c = pick(rng, f)();
    if (rng() < 0.3 && extra.length) {   // two names
      var nm2 = extra.shift(); row.splice(c[1], 0, nm, nm2);
      return "add " + nm + pick(rng, [" and ", ", ", " & "]) + nm2 + (c[0] ? " " + c[0] : "");
    }
    row.splice(c[1], 0, nm);
    return pick(rng, ["add ", "insert "]) + nm + (c[0] ? " " + c[0] : "");
  }
  function opRemove() {
    if (row.length < 4) return null; var i = R(rng, row.length), P = place(i, 1), gone = row[i];
    row.splice(i, 1); tokens.forEach(function (t) { if (held[t] === gone) delete held[t]; });
    return rng() < 0.5 ? "remove " + P : P + " leaves";
  }
  function opContents() {
    var N = row.length, a = R(rng, N), b = R(rng, N); if (a === b || !tokens.length) return null;
    var A = row[a], Bn = row[b], line = "swap contents of " + place(a, 1) + " and " + place(b, 1);
    tokens.forEach(function (t) { if (held[t] === A) held[t] = Bn; else if (held[t] === Bn) held[t] = A; });
    return line;
  }
  var ops = [opSwap, opSwap, opPut, opPut, opPass, opPass, opMove, opShift, opReverse, opAdd, opRemove, opContents];
  var steps = 2 + R(rng, 5);
  for (var s = 0; s < steps; s++) {
    var snapR = row.slice(), snapH = JSON.parse(JSON.stringify(held)), snapT = tokens.slice(), snapE = extra.slice(), line = null;
    try { line = pick(rng, ops)(); } catch (e) { line = null; }
    if (!line) { row.length = 0; Array.prototype.push.apply(row, snapR); held = snapH; tokens.length = 0; Array.prototype.push.apply(tokens, snapT); extra = snapE; continue; }
    lines.push(line);
  }
  var h = {}; tokens.forEach(function (t) { if (held[t]) h[t] = held[t]; });
  return { lines: lines, row: row.slice(), held: h };
}
module.exports = gen;
