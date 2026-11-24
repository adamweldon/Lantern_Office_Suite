// replay.js -- the sixth review of 1.24.36 (cases.js), run against src/lantern.inner.html or the file named.
//   node tests/fixtures/review6_1236/replay.js [path/to/lantern.inner.html]
// Prints "AGREE <id>" or "DISAGREE <id> <what was seen> [harm]" per case, then "N cases: A AGREE, D DISAGREE".
// A case says what is right; AGREE means Lantern did that. The guards compare with 1.24.35 (git 8cb3281).
"use strict";
var path = require("path"), fs = require("fs"), cp = require("child_process"), os = require("os");
var ROOT = path.join(__dirname, "..", "..", "..");
module.paths.unshift(path.join(ROOT, "node_modules"));
var load = require(path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
var CASES = require("./cases.js");
var file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src", "lantern.inner.html");
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " "); return s.length > (n || 260) ? s.slice(0, n || 260) + "…" : s; }
function ids(list) { return (list || []).map(function (e) { return e.id + (e.nc ? "/" : ""); }).join(","); }
function rungStr(r) { return "s[" + ids(r.stops) + "] st[" + ids(r.starts) + "]" + (r.seal ? "+seal" : "") + " se[" + ids(r.series) + "] a[" + ids(r.after) + "]"; }
function blk(title, lines) { return "MAKE CONTROL: " + title + "\n" + lines.join("\n") + "\nEND"; }

// the given a prompt shows: {head: "lantern"|"user", lines: [...]} or null
function givenIn(p) {
  var i = p.indexOf("tested circuit for this"), j = p.indexOf("Your own kept circuit for this");
  if (i < 0 && j < 0) return null;
  var k = i >= 0 ? i : j, s = p.slice(p.indexOf("\nMAKE CONTROL", k) + 1), e = s.indexOf("\nEND");
  var ls = s.slice(0, e).split("\n");
  return { head: i >= 0 ? "lantern" : "user", title: ls[0], lines: ls.slice(1) };
}
function forgetAll(L) { (L.givens.mine() || []).forEach(function (g) { L.givens.forget(g.id); }); }
function checkedOf(m) { return (m && m.codes && m.codes.checked || []).filter(function (x) { return x.ok; }).map(function (x) { return x.ok; }).join("; "); }
function backOf(m) { return (m && m.codes && m.codes.back) || []; }
function rungsOf(m) { var o = {}; ((m && m.plan && m.plan.circuit && m.plan.circuit.rungs) || []).forEach(function (r) { o[r.out.id] = rungStr(r); }); return o; }
function checkRungs(m, want) {
  var bad = [], rs = rungsOf(m);
  Object.keys(want || {}).forEach(function (id) { if (!rs[id] || rs[id].indexOf(want[id]) < 0) bad.push(id + " is " + (rs[id] || "not drawn") + " (want " + want[id] + ")"); });
  return bad;
}
// the line handed back put in place of its device's line (head and ID), or added where the device had none
function swapIn(lines, line) {
  var w = line.split(/\s+/), head = w[0].toLowerCase(), id = w[1], out = lines.slice(), done = false;
  // the device's own line: the one that names the ID first (a stop written "button PB1 M1" is PB1's line)
  out = out.map(function (l) {
    var lw = l.split(/\s+/);
    if (!done && lw[1] === id && (lw[0].toLowerCase() === head || !/^(coil|relay|starter|contactor|timer|lamp|horn|solenoid)$/i.test(lw[0]))) { done = true; return line; }
    return l;
  });
  if (!done) out.push(line);
  return out;
}

var T = {};
T.prompt = function (c, L) {
  var p = L.aiAct.prompt(c.q), g = givenIn(p), m = g ? L.givens.match("CONTROL", c.q) : null, gid = g ? (g.head === "user" ? "user" : m && m.id) : null;
  if (c.want === null) return g ? { agree: false, did: "a given is shown (" + gid + "): " + g.lines.join(" | ") } : { agree: true };
  if (!g) return { agree: false, did: "no given is shown" };
  var bad = [];
  if (c.want.g && gid !== c.want.g) bad.push("the given is " + gid + ", not " + c.want.g);
  (c.want.has || []).forEach(function (l) { if (g.lines.indexOf(l) < 0) bad.push("lacks “" + l + "”"); });
  (c.want.hasRe || []).forEach(function (r) { var re = new RegExp(r); if (!g.lines.some(function (l) { return re.test(l); })) bad.push("lacks a line /" + r + "/"); });
  (c.want.not || []).forEach(function (r) { var re = new RegExp(r); g.lines.forEach(function (l) { if (re.test(l)) bad.push("has “" + l + "”"); }); });
  if (c.want.supply !== undefined) {
    var sl = g.lines.filter(function (l) { return /^supply\b/.test(l); });
    if (c.want.supply === null && sl.length) bad.push("has “" + sl[0] + "” (no supply line is right)");
    if (c.want.supply !== null && sl[0] !== "supply \x22" + c.want.supply + "\x22") bad.push("supply is “" + (sl[0] || "none") + "”, want supply \x22" + c.want.supply + "\x22");
  }
  return bad.length ? { agree: false, did: bad.join("; ") + " -- block: " + g.lines.join(" | ") } : { agree: true };
};
T["given-builds"] = function (c, L) {
  var p = L.aiAct.prompt(c.q), g = givenIn(p);
  if (!g) return { agree: false, did: "no given is shown" };
  var m = L.aiAct.build(blk(g.title.replace(/^MAKE CONTROL:\s*/, ""), g.lines), c.q);
  if (!m || !m.ok) return { agree: false, did: "the given does not build: " + short((m && m.problems || []).join(" | "), 400) };
  if (backOf(m).length) return { agree: false, did: "the given is sent back: " + short(backOf(m).join(" | "), 400) };
  var bad = checkRungs(m, c.want.rungs);
  if (c.want.said && !new RegExp(c.want.said).test(m.summary)) bad.push("summary lacks /" + c.want.said + "/");
  if (c.want.checked && checkedOf(m).indexOf(c.want.checked) < 0) bad.push("checked lacks “" + c.want.checked + "” (" + checkedOf(m) + ")");
  return bad.length ? { agree: false, did: bad.join("; ") } : { agree: true };
};
T.build = function (c, L) {
  var m = L.aiAct.build(blk("Circuit", c.lines), c.q);
  if (!m) return { agree: false, did: "no block found" };
  if (c.want.ok) {
    if (!m.ok) return { agree: false, did: "sent back: " + short((m.problems || []).join(" | "), 500) };
    var bad = checkRungs(m, c.want.rungs);
    if (c.want.said && !new RegExp(c.want.said).test(m.summary)) bad.push("summary lacks /" + c.want.said + "/");
    if (c.want.checked && checkedOf(m).indexOf(c.want.checked) < 0) bad.push("checked lacks “" + c.want.checked + "” (" + checkedOf(m) + ")");
    return bad.length ? { agree: false, did: bad.join("; ") } : { agree: true };
  }
  if (m.ok) return { agree: false, did: "drawn, nothing sent back: " + JSON.stringify(rungsOf(m)) };
  var ps = (m.problems || []).join(" | ");
  if (!new RegExp(c.want.back).test(ps)) return { agree: false, did: "sent back for something else: " + short(ps, 400) };
  var wl = "Write it: " + c.want.line, has = (m.problems || []).some(function (x) { return x.slice(-wl.length) === wl; });
  if (!has) return { agree: false, did: "the line handed back is not “" + c.want.line + "”: " + short(ps, 400) };
  if (c.want.rebuild) {
    var m2 = L.aiAct.build(blk("Circuit", swapIn(c.lines, c.want.line)), c.q);
    if (!m2 || !m2.ok) return { agree: false, did: "the line handed back, copied, is sent back again: " + short((m2 && m2.problems || []).join(" | "), 400) };
  }
  return { agree: true };
};
T.pick = function (c, L) { var p = L.codeChecks.pick(c.q); return p === c.want ? { agree: true } : { agree: false, did: "picks " + p }; };
T.kept = function (c, L) {
  forgetAll(L);
  var m = L.aiAct.build(blk("My circuit", c.lines), c.keepQ), u = L.givens.keep(m, c.keepQ);
  if (!u) return { agree: false, did: "could not keep the circuit (" + short((m && m.problems || []).join(" | ")) + ")" };
  var p = L.aiAct.prompt(c.q), shown = p.indexOf("Your own kept circuit for this") >= 0;
  forgetAll(L);
  return shown === c.want ? { agree: true } : { agree: false, did: shown ? "the kept circuit (" + c.lines.join(" | ") + ") is shown" : "the kept circuit is not shown" };
};
T["kept-bench"] = function (c, L) {
  forgetAll(L);
  var m = L.aiAct.build(blk("My circuit", c.lines), c.keepQ), u = L.givens.keep(m, c.keepQ);
  if (!u) return { agree: false, did: "could not keep the circuit" };
  var was = L.aiBench.running; L.aiBench.running = true;
  var shown = L.aiAct.prompt(c.q).indexOf("Your own kept circuit for this") >= 0;
  L.aiBench.running = was; forgetAll(L);
  return shown === c.want ? { agree: true } : { agree: false, did: shown ? "shown while the bench runs" : "not shown" };
};
T["pick-saved"] = function (c, L) {
  var was = L.codeChecks.saved();
  L.codeChecks.choose(c.choose);
  var p = L.codeChecks.pick(c.q);
  try { L.store.set("codes.practice", was || ""); } catch (e) { /* none */ }
  return p === c.want ? { agree: true } : { agree: false, did: "picks " + p };
};
T["codes-line"] = function (c, L) {
  var m = L.aiAct.build(blk("Circuit", c.lines), c.q);
  if (!m || !m.ok || !m.codes) return { agree: false, did: "not drawn or not checked" };
  var ln = L.codeChecks.line(m.codes, c.practice), miss = c.want.filter(function (w) { return ln.indexOf(w) < 0; });
  return miss.length ? { agree: false, did: "the line lacks " + miss.join(", ") + ": " + ln } : { agree: true };
};
T["kept-refused"] = function (c, L) {
  forgetAll(L);
  var m = L.aiAct.build(blk("My circuit", c.lines), c.keepQ), u = L.givens.keep(m, c.keepQ);
  forgetAll(L);
  return !u ? { agree: true } : { agree: false, did: "kept a circuit that was sent back" };
};

(async function () {
  var o = load(file), L = o.L;
  await sleep(100);
  var old = null;
  async function oldL() {
    if (old) return old;
    var tmp = path.join(os.tmpdir(), "lantern_1.24.35_review6.html");
    fs.writeFileSync(tmp, cp.execSync("git show 8cb3281:src/lantern.inner.html", { cwd: ROOT, maxBuffer: 1 << 28 }));
    old = load(tmp); await sleep(100);
    return old;
  }
  T["guard-prompts"] = async function (c, L) {
    forgetAll(L);
    var O = (await oldL()).L, diff = [];
    ["aiBenchQuestions", "aiBenchQuestionsB"].forEach(function (k) {
      (L[k] || []).forEach(function (x) {
        var y = (O[k] || []).filter(function (z) { return z.id === x.id; })[0];
        if (!y) { diff.push(x.id + " (new)"); return; }
        if (/^make-control(?:-b)?$/.test(x.id)) return;
        if (L.aiAct.prompt(x.q) !== O.aiAct.prompt(y.q)) diff.push(x.id);
      });
    });
    return diff.length ? { agree: false, did: "prompts differ: " + diff.join(", ") } : { agree: true };
  };
  T["guard-fixtures"] = async function (c, L) {
    forgetAll(L);
    var O = (await oldL()).L, dir = path.join(ROOT, "tests", "fixtures"), n = 0, diff = [];
    function rows(j) { if (Array.isArray(j)) return j; var out = []; Object.keys(j).forEach(function (k) { var v = j[k]; if (Array.isArray(v)) v.forEach(function (x) { if (x && typeof x === "object") out.push(x); }); else if (v && typeof v === "object" && (v.reply || v.q)) out.push(Object.assign({ id: k }, v)); }); return out; }
    function sig(LL, r) { var m; try { m = LL.aiAct.fromReply ? LL.aiAct.fromReply(r.reply, r.q) : LL.aiAct.build(r.reply, r.q); } catch (e) { return "THROW " + e.message; } return m ? JSON.stringify({ ok: !!m.ok, p: m.problems || [], s: m.summary || "" }) : "null"; }
    fs.readdirSync(dir).filter(function (f) { return /^bench_run.*\.json$/.test(f); }).forEach(function (f) {
      var j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
      rows(j).forEach(function (r) {
        if (!r || typeof r.reply !== "string" || !/MAKE\s/.test(r.reply)) return;
        n++;
        if (sig(L, r) !== sig(O, r)) diff.push(f + ":" + r.id);
      });
    });
    return diff.length ? { agree: false, did: diff.length + " of " + n + " saved replies build otherwise: " + diff.slice(0, 8).join(", ") } : { agree: true, n: n };
  };

  var agree = 0, dis = 0;
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i], r;
    try { r = await T[c.kind](c, L); } catch (e) { r = { agree: false, did: "the check threw: " + e.message }; }
    if (r.agree) { agree++; console.log("AGREE " + c.id + (r.n ? " (" + r.n + " replies)" : "")); }
    else { dis++; console.log("DISAGREE " + c.id + " " + short(r.did, 700) + (c.note ? " -- " + c.note : "") + " [" + (c.harm || "medium") + "]"); }
  }
  console.log(CASES.length + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
  process.exit(0);
})();
