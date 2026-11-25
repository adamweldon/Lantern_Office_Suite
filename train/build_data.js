// build_data.js -- training data for a model fitted to Lantern: good transcripts only, checked by Lantern itself.
//
//   node train/build_data.js --runs <dir of lantern-bench-*.json> [--mode short|library] [--out train/data]
//
// Adam, 2026-11-24 (CLAUDE.md, "The combined system, and then a model trained to it"): train each small model, with a
// LoRA, on what works best for Lantern and the model together. Hinton's lesson, which Adam brought: train on good
// behaviour first, and never on an answer known to be wrong (a model trained on wrong sums it could see were wrong
// learned that lying is fine). So an example goes in only when:
//  - it is a reply a model wrote to a bench question and Lantern passed it (a saved run's row, pass: true);
//  - it passes again NOW: the question is put to today's Lantern, in the prompt mode asked for, with the saved reply as
//    the model's -- and Lantern asks nothing more (one round), and grades it right;
//  - every function the reply calls is one the prompt showed (a reply that used a function the short prompt leaves out
//    would teach a small model to call functions from memory);
//  - its question is of set A. Set B (the same kinds asking for other things, 1.24.16) is never trained on: it is what
//    a trained model is tested on, questions it never saw.
// What it writes (train/data/):
//   lantern_<mode>_train.jsonl  one example a line: {"messages": [system?, user, assistant], "meta": {...}} -- the
//                               messages exactly as Lantern sent them, and the reply as the model wrote it
//   lantern_<mode>_heldout.jsonl  set B's questions (no replies): the trained model is asked these by the bench
//   summary.txt                 what went in and what was left out, and why
// Right answers that use no tool are part of it: a NEED for a missing number, a decline for what nobody offline can know,
// a refusal of a dose -- each passes the bench only when said so.
// Two more kinds, each checked the same way:
//  - a reply Lantern sent back once and the model then got right (a row of two rounds): the example is the whole
//    exchange, and only the last reply is trained on ("train": "last") -- the model learns to follow the line Lantern
//    hands back (CLAUDE.md rule 3), never the slip that came before it;
//  - the same sum with other numbers (--variants n): each number of the question changed, the same change made in the
//    reply and in the question's own ground truth (the bench's x), and kept only when Lantern, grading the new question
//    by that truth, passes the new reply. None may be a question of set B.
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var load = require(path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
var args = process.argv.slice(2), opt = { runs: "", mode: "short", out: path.join(ROOT, "train", "data"), src: path.join(ROOT, "src", "lantern.inner.html"), limit: 0, variants: 4, seed: 1238 };
for (var ai = 0; ai < args.length; ai++) { var k = args[ai].replace(/^--/, ""); if (k in opt) opt[k] = args[++ai]; }
if (!opt.runs) { console.log("usage: node train/build_data.js --runs <dir of lantern-bench-*.json> [--mode short|library] [--out dir]"); process.exit(2); }

function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x && x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }

// every passing row of every saved run: {set, id, cat, reply, version, file}
function candidates(dir) {
  var out = [], seen = {};
  fs.readdirSync(dir).filter(function (f) { return /lantern-bench-.*\.json$|^bench_run_.*\.json$/.test(f); }).sort().forEach(function (f) {
    var d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { return; }
    var set = String(d.set || "a").toLowerCase();
    (d.rows || []).forEach(function (r) {
      if (!r || !r.pass || !r.id) return;
      // the reply the model wrote: a chat row keeps it per turn; a one-turn conversation only
      var reply = r.chat ? (r.chat.length === 1 ? r.chat[0].reply : null) : r.reply;
      var rounds = r.chat ? (r.chat.length === 1 ? r.chat[0].rounds : 9) : r.rounds;
      // two rounds: the first reply and the one that passed (a chat row does not keep the first)
      var first = rounds === 2 && !r.chat && r.first ? r.first : null;
      if (!reply || !(rounds === 1 || first) || r.by === "rule") return;
      if (first && first.length >= (r.cat === "make" ? 1500 : 600)) return;
      // a reply cut where the bench stored it is not whole
      if ((r.cat === "make" && reply.length >= 1500) || (r.cat !== "make" && reply.length >= 600 && !r.chat) || (r.chat && reply.length >= 500)) return;
      var key = set + "|" + r.id + "|" + (first || "") + "|" + reply;
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ set: set, id: r.id, cat: r.cat, reply: reply, first: first, version: d.lantern || "?", file: f });
    });
  });
  return out;
}

(async function main() {
  var o = load(opt.src);
  await new Promise(function (r) { setTimeout(r, 200); });
  var L = o.L, B = L.aiBench, w = o.w;
  if (!B || !B.run) { console.log("this Lantern has no bench"); process.exit(1); }
  L.aiPrompt.setMode(opt.mode);
  var A = window_items(L), cands = candidates(opt.runs), kept = [], left = {}, i;
  if (opt.limit) cands = cands.slice(0, +opt.limit);
  function leave(why) { left[why] = (left[why] || 0) + 1; }
  // replay(item, replies) -> an example, or why not: the item put to today's Lantern, the model's replies given in turn;
  // kept only when it passes, Lantern asked exactly as many times as there are replies, and the last reply calls no
  // function the prompt did not show
  async function replay(item, replies) {
    var reqs = [];
    o.script = function (last, body) { reqs.push(body); return reqs.length <= replies.length ? replies[reqs.length - 1] : "ANSWER: Not in my library."; };
    var keepQ = w.Lantern.aiBenchQuestions, rep = null;
    w.Lantern.aiBenchQuestions = [item];
    try { rep = await B.run({}); } catch (e) { rep = null; }
    w.Lantern.aiBenchQuestions = keepQ;
    var row = rep && rep.rows && rep.rows[0];
    if (!row) return "did not run";
    if (!row.pass) return "fails on today\u2019s Lantern";
    if (reqs.length !== replies.length) return reqs.length > replies.length ? "Lantern asked again" : "Lantern asked fewer times than the saved run";
    var lastReq = reqs[reqs.length - 1], reply = replies[replies.length - 1];
    var msgs = (lastReq.messages || []).map(function (m) { return { role: m.role, content: textOf(m.content) }; });
    var shown = msgs.map(function (m) { return m.content; }).join("\n");
    var calls = (reply.match(/\b[A-Z][A-Z0-9]{2,}(?=\s*\()/g) || []).filter(function (f) { return (L.assistCatalog || []).some(function (x) { return x.n === f; }); });
    var unseen = calls.filter(function (f) { return shown.indexOf(f + "(") < 0 && shown.indexOf(f + " ") < 0 && shown.indexOf("\n" + f) < 0; });
    if (unseen.length) return "calls a function the prompt did not show";
    msgs.push({ role: "assistant", content: reply });
    return { messages: msgs, train: "last" };
  }
  // variant(item, reply) -> {item, reply} with every number of the question changed, the same change in the reply and
  // in the ground truth; null when a number cannot be changed safely (a formula's subscript, a year, a word's digit)
  var rnd = (function (s) { return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })(+opt.seed);
  function variant(item, reply) {
    var q = String(item.q), re = /(^|[^A-Za-z0-9.])(\d+(?:\.\d+)?)(?![\d.]*[A-Za-z]\d)(?=[^0-9A-Za-z]|\s|$|[a-zA-Z])/g, m, nums = [];
    while ((m = re.exec(q))) { var s = m[2], before = q.slice(Math.max(0, m.index - 2), m.index + m[1].length); if (/[A-Z]$/.test(before)) return null; nums.push(s); }
    nums = nums.filter(function (s, i) { return nums.indexOf(s) === i; });
    if (!nums.length) return null;
    var map = {};
    nums.forEach(function (s) {
      var dp = (s.split(".")[1] || "").length, x = parseFloat(s), y;
      for (var k = 0; k < 20; k++) { y = x * (0.5 + 1.5 * rnd()); y = dp ? +y.toFixed(dp) : Math.max(1, Math.round(y)); if (String(y) !== s && y > 0) break; }
      map[s] = dp ? y.toFixed(dp) : String(y);
    });
    function sub(text) { return String(text).replace(/(^|[^A-Za-z0-9.])(\d+(?:\.\d+)?)(?![\d.])/g, function (all, pre, n) { return map[n] != null ? pre + map[n] : all; }); }
    var item2 = {}; Object.keys(item).forEach(function (k) { item2[k] = item[k]; });
    item2.q = sub(q); item2.x = sub(item.x); item2.id = item.id + "~v";
    if (item2.q === q) return null;
    return { item: item2, reply: sub(reply) };
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/^ | $/g, ""); }
  var heldQ = {}, varSeen = {};
  (L.aiBenchQuestionsB || []).concat(L.aiBenchQuestions || []).forEach(function (q) { if (q.q) heldQ[norm(q.q)] = 1; });
  for (i = 0; i < cands.length; i++) {
    var c = cands[i];
    if (c.set !== "a") { leave("set B: held out"); continue; }
    var item = A[c.id];
    if (!item) { leave("no such question now"); continue; }
    if (item.doc) { leave("a document handed over (not rebuilt here)"); continue; }
    if (item.cat === "alone" || item.cat === "fact") { leave(item.cat === "alone" ? "a puzzle without Lantern\u2019s tools" : "needs the encyclopedia"); continue; }
    var ex = await replay(item, c.first ? [c.first, c.reply] : [c.reply]);
    if (typeof ex === "string") { leave(ex); continue; }
    ex.meta = { id: c.id, cat: c.cat, set: c.set, mode: opt.mode, lantern: L.version, from: c.file, wrote_on: c.version, rounds: c.first ? 2 : 1 };
    kept.push(ex);
    // the same sum with other numbers
    if (opt.variants > 0 && !c.first && (item.cat === "tool" || item.cat === "multi") && item.x) {
      var made = 0, tries;
      for (tries = 0; tries < opt.variants * 3 && made < opt.variants; tries++) {
        var v = variant(item, c.reply);
        if (!v || heldQ[norm(v.item.q)] || varSeen[norm(v.item.q)]) continue;
        varSeen[norm(v.item.q)] = 1;
        var vx = await replay(v.item, [v.reply]);
        if (typeof vx === "string") { leave("variant: " + vx); continue; }
        vx.meta = { id: c.id + "~" + (made + 1), cat: c.cat, set: "a-variant", mode: opt.mode, lantern: L.version, from: c.file, wrote_on: c.version, rounds: 1, variantOf: c.id };
        kept.push(vx); made++;
      }
    }
  }
  fs.mkdirSync(opt.out, { recursive: true });
  var base = path.join(opt.out, "lantern_" + opt.mode);
  fs.writeFileSync(base + "_train.jsonl", kept.map(function (x) { return JSON.stringify(x); }).join("\n") + (kept.length ? "\n" : ""));
  var held = (L.aiBenchQuestionsB || []).map(function (q) { return JSON.stringify({ id: q.id, cat: q.cat, q: q.q || null, turns: q.turns || null }); });
  fs.writeFileSync(base + "_heldout.jsonl", held.join("\n") + "\n");
  var byCat = {}, byId = {};
  kept.forEach(function (x) { byCat[x.meta.cat] = (byCat[x.meta.cat] || 0) + 1; byId[x.meta.id] = 1; });
  var lines = ["Training data for Lantern " + L.version + ", prompt mode " + opt.mode + ", from " + cands.length + " passing replies in " + opt.runs,
    "kept " + kept.length + " examples of " + Object.keys(byId).length + " questions: " + JSON.stringify(byCat),
    "left out: " + JSON.stringify(left), "held out (set B, never trained on): " + held.length + " questions"];
  fs.writeFileSync(path.join(opt.out, "summary_" + opt.mode + ".txt"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  process.exit(0);
})().catch(function (e) { console.log("FAILED: " + (e && e.stack || e)); process.exit(1); });

function window_items(L) {
  var m = {};
  (L.aiBenchQuestions || []).forEach(function (q) { m[q.id] = q; });
  return m;
}
