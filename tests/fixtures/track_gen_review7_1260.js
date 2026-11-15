// Random TRACK scripts with my own simulator (independent of Lantern's code).
// Each script: { lines, exp: {row, held}, kinds: [phrase kinds used] }
function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
var PEOPLE = ["Ann", "Bo", "Cy", "Di", "Ed", "Fay", "Gus", "Hal", "Ivy", "Jo", "Kim", "Lou"];
var CUPS = ["Red", "Blue", "Green", "Yellow", "Pink", "White", "Black", "Grey", "Gold", "Teal"];
var TOKS = ["coin", "ring", "key", "ball", "flag", "hat", "pea", "shell"];
var ORDW = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
var NUMW = ["zero", "one", "two", "three", "four", "five", "six"];
function sfx(k) { return k + (k % 10 === 1 && k !== 11 ? "st" : k % 10 === 2 && k !== 12 ? "nd" : k % 10 === 3 && k !== 13 ? "rd" : "th"); }
function gen(seed, opts) {
  opts = opts || {};
  var R = rng(seed), pick = function (a) { return a[Math.floor(R() * a.length)]; }, ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var queue = R() < 0.5, pool = queue ? PEOPLE.slice() : CUPS.slice();
  var n0 = ri(3, 7), row = [], i;
  while (row.length < n0) { var nm = pick(pool); if (row.indexOf(nm) < 0) row.push(nm); }
  var spare = pool.filter(function (x) { return row.indexOf(x) < 0; });
  var held = {}, tokens = [], lines = ["row " + row.join(" ")], kinds = [];
  var noun = queue ? pick(["person", "one", "child"]) : pick(["cup", "one"]);
  function heldToks() { return tokens.filter(function (t) { return held[t]; }); }
  function idxOf(nm) { return row.indexOf(nm); }
  // place(depth) -> {t, i} for the current row
  function place(depth, avoidRel) {
    var n = row.length, c = [], j, k;
    c.push(function () { j = ri(0, n - 1); return { t: row[j], i: j, k: "name" }; });
    c.push(function () { return R() < 0.5 ? { t: pick(["the first", queue ? "the front" : "the far left", "the first " + noun]), i: 0, k: "first" } : { t: pick(["the last", queue ? "the back" : "the far right", "the last " + noun]), i: n - 1, k: "last" }; });
    if (n % 2) c.push(function () { return { t: pick(["the middle", "the middle " + noun, "the " + noun + " in the middle"]), i: (n - 1) / 2, k: "middle" }; });
    c.push(function () { j = ri(1, n); return { t: "position " + j, i: j - 1, k: "position" }; });
    if (n >= 2) c.push(function () { j = ri(2, Math.min(n, 10)); return { t: pick(["the " + ORDW[j], "the " + ORDW[j] + " " + noun, "the " + sfx(j)]), i: j - 1, k: "ordinal" }; });
    if (n >= 3) c.push(function () { return { t: pick(["the second to last", "the last but one", "the next to last", "the penultimate", "the second to last " + noun]), i: n - 2, k: "second-to-last" }; });
    if (n >= 3) c.push(function () {
      j = ri(2, Math.min(n, 5)); var endw = pick(queue ? ["end", "back", "front"] : ["end", "right", "left"]), fromEnd = /end|back|right/.test(endw);
      return { t: pick(["the " + ORDW[j] + " from the " + endw, "the " + ORDW[j] + " " + noun + " from the " + endw, "the " + sfx(j) + " from the " + endw]), i: fromEnd ? n - j : j - 1, k: "from-end" };
    });
    if (depth < 2 && !avoidRel) c.push(function () {
      var p = place(depth + 1, false), dir = R() < 0.5 ? -1 : 1, kk = R() < 0.6 ? 1 : ri(2, 3), to = p.i + dir * kk;
      if (to < 0 || to >= n) return null;
      var t;
      if (queue && R() < 0.5) t = kk === 1 ? pick(["the " + noun + " ", "the " + noun + " just ", ""]) + (dir < 0 ? "in front of " : "behind ") + p.t : "the " + noun + " " + NUMW[kk] + " places " + (dir < 0 ? "in front of " : "behind ") + p.t;
      else t = kk === 1 ? pick(["the " + noun + " to the ", "the " + noun + " ", ""]) + (dir < 0 ? "left" : "right") + " of " + p.t : pick(["the " + noun + " " + kk + " places to the ", kk + " "]) + (dir < 0 ? "left" : "right") + " of " + p.t;
      return { t: t, i: to, k: "relative" };
    });
    if (n >= 3 && depth < 2) c.push(function () { j = ri(1, n - 2); return { t: "the " + noun + " between " + row[j - 1] + " and " + row[j + 1], i: j, k: "between" }; });
    var hs = heldToks();
    if (hs.length && depth < 2) c.push(function () { var tk = pick(hs); return { t: pick(["the " + noun + " holding the " + tk, "the " + noun + " with the " + tk, "holder of " + tk, "the " + noun + " that has the " + tk]), i: idxOf(held[tk]), k: "holder" }; });
    if (n >= 3) c.push(function () { var e = R() < 0.5 ? 0 : n - 1; return { t: "the " + noun + " next to " + row[e], i: e === 0 ? 1 : n - 2, k: "next-to-end" }; });
    if (opts.hard) {
      c.push(function () { return R() < 0.5 ? { t: "the " + noun + " at the " + (queue ? "front" : pick(["far left", "left end"])), i: 0, k: "at-end" } : { t: "the " + noun + " at the " + (queue ? "back" : pick(["far right", "right end"])), i: n - 1, k: "at-end" }; });
      if (depth < 2) c.push(function () { var p = place(depth + 1, false), kk = ri(1, 3), dir = R() < 0.5 ? -1 : 1, to = p.i + dir * kk; if (to < 0 || to >= n) return null;
        return { t: "the one " + (kk === 1 ? pick(["", "one place "]) : kk + " places ") + "to the " + (dir < 0 ? "left" : "right") + " of " + p.t, i: to, k: "one-rel" }; });
      if (depth < 2 && queue) c.push(function () { var p = place(depth + 1, false), dir = R() < 0.5 ? -1 : 1, to = p.i + dir; if (to < 0 || to >= n) return null;
        return { t: "the " + noun + " " + (dir < 0 ? pick(["in front of ", "ahead of "]) : pick(["behind ", "just behind "])) + p.t, i: to, k: "q-rel" }; });
    }
    for (var tries = 0; tries < 20; tries++) { var r = pick(c)(); if (r) return r; }
    j = ri(0, n - 1); return { t: row[j], i: j, k: "name" };
  }
  function simple() {
    var n = row.length, ops = [], a, b, t;
    ops.push(function () {   // swap
      a = place(0); b = place(0); if (a.i === b.i) return null;
      var x = row[a.i]; row[a.i] = row[b.i]; row[b.i] = x; kinds.push("swap:" + a.k + "/" + b.k);
      return pick(["swap ", "switch "]) + a.t + " and " + b.t;
    });
    ops.push(function () {   // give/put a thing
      var tk = pick(TOKS), p = place(0), verb = queue ? pick(["give", "hand"]) : pick(["put", "hide"]), prep = queue ? "to" : pick(["in", "under"]);
      if (tokens.indexOf(tk) < 0) tokens.push(tk);
      held[tk] = row[p.i]; kinds.push("give:" + p.k);
      return verb + " the " + tk + " " + prep + " " + p.t;
    });
    ops.push(function () {   // pass
      var hs = heldToks(); if (!hs.length || !queue) return null;
      var tk = pick(hs), h = idxOf(held[tk]), dir = R() < 0.5 ? -1 : 1, kk = R() < 0.6 ? 1 : ri(2, 3), to = h + dir * kk;
      if (to < 0 || to >= n) return null;
      held[tk] = row[to]; kinds.push("pass");
      var it = hs.length === 1 && R() < 0.4 ? "it" : "the " + tk;
      return "pass " + it + (kk === 1 ? " to the " : " " + NUMW[kk] + " places to the ") + (dir < 0 ? "left" : "right");
    });
    ops.push(function () {   // swap contents
      var hs = heldToks(); if (!hs.length) return null;
      a = place(0); b = place(0); if (a.i === b.i) return null;
      var A = row[a.i], B = row[b.i]; tokens.forEach(function (k) { if (held[k] === A) held[k] = B; else if (held[k] === B) held[k] = A; });
      kinds.push("contents:" + a.k + "/" + b.k);
      return "swap contents of " + a.t + " and " + b.t;
    });
    ops.push(function () {   // move to a fixed place
      var w = ri(0, n - 1), who = row[w], form = ri(0, 3), k, txt;
      if (form === 0) { k = 1; txt = pick(["first", "the front", "the start"]); }
      else if (form === 1) { k = n; txt = pick(["last", "the back", "the end"]); }
      else if (form === 2) { k = ri(1, n); txt = "position " + k; }
      else { if (n < 3) return null; k = n - 1; txt = pick(["second to last", "the next to last place", "the second to last place"]); }
      row.splice(w, 1); row.splice(k - 1, 0, who); kinds.push("move-to");
      return "move " + who + " to " + txt;
    });
    ops.push(function () {   // move before/after a place
      var w = ri(0, n - 1), who = row[w], p = place(0); if (p.i === w) return null;
      var target = row[p.i], before = R() < 0.5, word = before ? pick(queue ? ["before", "in front of"] : opts.hard ? ["before"] : ["before", "left of"]) : pick(queue ? ["after", "behind"] : opts.hard ? ["after"] : ["after", "right of"]);
      row.splice(w, 1); var ti = row.indexOf(target); row.splice(before ? ti : ti + 1, 0, who); kinds.push("move-rel:" + p.k);
      return "move " + who + " " + word + " " + p.t;
    });
    ops.push(function () {   // move N places
      var w = ri(0, n - 1), who = row[w], dir = R() < 0.5 ? -1 : 1, kk = ri(1, 2), to = w + dir * kk;
      if (to < 0 || to >= n) return null;
      row.splice(w, 1); row.splice(to, 0, who); kinds.push("move-n");
      return "move " + who + " " + NUMW[kk] + " place" + (kk > 1 ? "s" : "") + " to the " + (dir < 0 ? "left" : "right");
    });
    ops.push(function () {   // shift
      var kk = ri(1, 3), dir = R() < 0.5 ? "left" : "right";
      for (var z = 0; z < kk % n; z++) { if (dir === "right") row.unshift(row.pop()); else row.push(row.shift()); }
      kinds.push("shift");
      return pick(["shift " + dir + " " + kk, "shift everything " + kk + " place" + (kk > 1 ? "s" : "") + " to the " + dir, "rotate " + dir + " " + kk]);
    });
    ops.push(function () { row.reverse(); kinds.push("reverse"); return pick(["reverse", "reverse the row"]); });
    ops.push(function () {   // add
      if (!spare.length || n >= 9) return null;
      var nw = spare.splice(ri(0, spare.length - 1), 1)[0], form = ri(0, 4), txt;
      if (form === 0) { row.unshift(nw); txt = "at the front"; }
      else if (form === 1) { row.push(nw); txt = pick(["at the end", "at the back"]); }
      else if (form === 2) { var k = ri(1, n + 1); row.splice(k - 1, 0, nw); txt = "at position " + k; }
      else if (form === 3) { var p = place(0), before = R() < 0.5, tg = row[p.i]; row.splice(before ? p.i : p.i + 1, 0, nw); txt = (before ? pick(["before ", "in front of "]) : pick(["after ", "behind "])) + p.t; kinds.push("add-rel:" + p.k); }
      else { if (n < 2) return null; var j = ri(0, n - 2); txt = "between " + row[j] + " and " + row[j + 1]; row.splice(j + 1, 0, nw); }
      kinds.push("add");
      return "add " + nw + " " + txt;
    });
    ops.push(function () {   // remove
      if (n <= 3) return null;
      var p = place(0), gone = row[p.i]; row.splice(p.i, 1);
      tokens.forEach(function (k) { if (held[k] === gone) delete held[k]; });
      kinds.push("remove:" + p.k);
      return "remove " + p.t;
    });
    ops.push(function () {   // take from
      var hs = heldToks(); if (!hs.length) return null;
      var tk = pick(hs), from = held[tk]; delete held[tk]; kinds.push("take");
      return "take the " + tk + " from " + from;
    });
    ops.push(function () {   // swap two held things
      var hs = heldToks(); if (hs.length < 2) return null;
      var x = pick(hs), y = pick(hs); if (x === y || held[x] === held[y]) return null;
      var tmp = held[x]; held[x] = held[y]; held[y] = tmp; kinds.push("swap-held");
      return "swap the " + x + " and the " + y;
    });
    if (opts.hard) {
      ops.push(function () {   // move the holder before/after a place
        var hs = heldToks(); if (!hs.length) return null;
        var tk = pick(hs), w = idxOf(held[tk]), who = row[w], p = place(0); if (p.i === w) return null;
        var target = row[p.i], before = R() < 0.5, word = before ? pick(queue ? ["before", "in front of"] : ["before"]) : pick(queue ? ["after", "behind"] : ["after"]);
        row.splice(w, 1); var ti = row.indexOf(target); row.splice(before ? ti : ti + 1, 0, who); kinds.push("move-holder:" + p.k);
        return "move " + pick(["the " + noun + " holding the " + tk, "the " + noun + " with the " + tk, "the one that has the " + tk]) + " " + word + " " + p.t;
      });
      ops.push(function () {   // swap X and its neighbour
        var w = ri(0, n - 1), dir = R() < 0.5 ? -1 : 1, to = w + dir; if (to < 0 || to >= n) return null;
        var X = row[w], t = pick(["the one to its " + (dir < 0 ? "left" : "right"), "the one on its " + (dir < 0 ? "left" : "right"), "the one to the " + (dir < 0 ? "left" : "right")]);
        row[w] = row[to]; row[to] = X; kinds.push("swap-its");
        return "swap " + X + " and " + t;
      });
      ops.push(function () {   // give from the holder
        var hs = heldToks(); if (!hs.length || !queue) return null;
        var tk = pick(hs), h = idxOf(held[tk]), q = place(0); if (q.i === h) return null;
        var from = R() < 0.5 ? row[h] : (h === 0 ? "the front" : h === n - 1 ? "the back" : row[h]);
        held[tk] = row[q.i]; kinds.push("give-from:" + q.k);
        return "give the " + tk + " from " + from + " to " + q.t;
      });
      ops.push(function () {   // pass to the one behind/in front of the holder
        var hs = heldToks(); if (hs.length !== 1 || !queue) return null;
        var tk = hs[0], h = idxOf(held[tk]), dir = R() < 0.5 ? -1 : 1, to = h + dir; if (to < 0 || to >= n) return null;
        held[tk] = row[to]; kinds.push("pass-holder");
        return "pass it to the " + noun + " " + (dir < 0 ? "in front of" : "behind") + " the " + noun + " holding it";
      });
    }
    for (var tries = 0; tries < 30; tries++) {
      var snap = { row: row.slice(), held: JSON.parse(JSON.stringify(held)), tokens: tokens.slice(), spare: spare.slice(), kl: kinds.length };
      var op = pick(ops), line = op();
      if (line) return line;
      row = snap.row; held = snap.held; tokens = snap.tokens; spare = snap.spare; kinds.length = snap.kl;
    }
    return null;
  }
  var states = [null];
  function snapState() { var h = {}; tokens.forEach(function (k) { if (held[k]) h[k] = held[k]; }); return { row: row.slice(), held: h }; }
  var steps = ri(2, 7);
  for (var s = 0; s < steps; s++) {
    var r = R(), line;
    if (r < 0.15 && !opts.noThen) {   // two steps with then
      var l1 = simple(), l2 = simple();
      if (!l1 || !l2) continue;
      line = l1 + pick([", then ", " then ", "; then ", " and then ", ", and then "]) + l2; kinds.push("then");
    } else if (r < 0.27 && !opts.noTimes) {   // a step repeated
      var snapR = row.slice(), snapH = JSON.parse(JSON.stringify(held));
      var times = ri(2, 3), base = simple();
      if (!base) continue;
      if (!/^(swap |switch |shift |rotate |reverse|pass )/.test(base) || /^swap contents/.test(base) || /between/.test(base) && false) { lines.push(base); states.push(snapState()); continue; }
      // the generated step was applied once already; re-derive: undo and apply k times by replaying via a second line set
      // simpler: since swap/shift/reverse of fixed names are deterministic only when the places are names or fixed, keep only lines whose places are names
      if (/^(swap |switch )/.test(base) && !/^(swap|switch) [A-Z][a-z]+ and [A-Z][a-z]+$/.test(base)) { lines.push(base); states.push(snapState()); continue; }
      if (/^pass /.test(base) && !/^pass (it|the (\w+))( (\w+) places)? to the (left|right)$/.test(base)) { lines.push(base); states.push(snapState()); continue; }
      if (/^pass /.test(base)) {   // a pass repeated: recompute from the snapshot
        row = snapR; held = snapH;
        var m = /^pass (it|the (\w+))( (\w+) places)? to the (left|right)$/.exec(base);
        var tk2 = m[2] || heldToks()[0], kk2 = m[4] ? NUMW.indexOf(m[4]) : 1, d2 = m[5] === "left" ? -1 : 1, h2 = idxOf(held[tk2]), to2 = h2 + d2 * kk2 * times;
        if (to2 < 0 || to2 >= row.length) { held[tk2] = row[h2 + d2 * kk2]; lines.push(base); states.push(snapState()); continue; }
        held[tk2] = row[to2];
      } else {
        row = snapR; held = snapH;
        for (var q = 0; q < times; q++) applyName(base);
      }
      line = base + " " + (times === 2 ? pick(["twice", "2 times", "two times"]) : pick(["3 times", "three times", "thrice"])); kinds.push("times");
    } else line = simple();
    if (line) { lines.push(line); states.push(snapState()); }
  }
  function applyName(base) {   // swap A and B (names), shift, rotate, reverse
    var m;
    if ((m = /^(?:swap|switch) (\w+) and (\w+)$/.exec(base))) { var a = row.indexOf(m[1]), b = row.indexOf(m[2]), x = row[a]; row[a] = row[b]; row[b] = x; return; }
    if (/^reverse/.test(base)) { row.reverse(); return; }
    if ((m = /^(?:shift|rotate)(?: everything)? (left|right) (\d+)$/.exec(base)) || (m = /^shift everything (\d+) places? to the (left|right)$/.exec(base))) {
      var dir = /left|right/.test(m[1]) ? m[1] : m[2], kk = +(/\d/.test(m[1]) ? m[1] : m[2]);
      for (var z = 0; z < kk % row.length; z++) { if (dir === "right") row.unshift(row.pop()); else row.push(row.shift()); }
      return;
    }
    throw new Error("cannot repeat " + base);
  }
  var h = {}; tokens.forEach(function (k) { if (held[k]) h[k] = held[k]; });
  return { lines: lines, exp: { row: row.slice(), held: h }, kinds: kinds, states: states };
}
module.exports = gen;
