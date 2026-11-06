// bench_pane.js -- run Lantern Bench from outside the page, with nobody
// clicking: paste (or evaluate) this file in a page that has Lantern open and
// a model connected, then call window.lanternBench.
//
// Written for a Claude chat linked to a computer through the Claude desktop
// app: Lantern is opened in the app's browser pane at the kit's address
// (http://127.0.0.1:8080/), this file is evaluated there, and the run is
// started and read with short calls. It works the same in any browser's
// console, for a person. (1.24.2; see CLAUDE.md, "The bench on the laptop".)
//
//   lanternBench.start()                     the full run
//   lanternBench.start({ quick: true })      the quick run
//   lanternBench.start({ ids: ["doc-fault-code", "code-ladder-start-stop"] })
//                                            only these questions, in bench order
//   lanternBench.start({ match: "^make-music" })   ids that match
//   lanternBench.status()                    where it is: state, done, total,
//                                            minutes, the failed ids, the last rows
//   lanternBench.rows(["id", ...] | "failed" | "all")   rows as the bench keeps them
//   lanternBench.report()                    the finished report (bench JSON)
//   lanternBench.stop()                      stop after the question in hand
//
// The rows are also kept in localStorage as they finish (lanternBench.rows /
// lanternBench.report), so a page that is reloaded does not lose a long run.
// A run of chosen questions puts the bench's whole list back when it ends.
// ES5 only, like Lantern; it changes nothing in Lantern itself.
(function () {
  "use strict";
  var w = window, L = w.Lantern, KEY_ROWS = "lanternBench.rows", KEY_REP = "lanternBench.report";
  if (!L || !L.aiBench || !L.aiBench.run) { w.lanternBench = { error: "Lantern Bench is not in this page" }; return; }
  var S = null;
  function keep(key, val) { try { w.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { if (S) S.saveError = String((e && e.message) || e); } }
  function slim(r) { return r.id + ":" + (r.pass ? "ok" : "FAIL") + ":" + Math.round((r.ms || 0) / 1000) + "s" + (r.first ? ":2nd-try" : "") + (r.pass || !r.why ? "" : " (" + String(r.why).slice(0, 110) + ")"); }
  function start(opts) {
    opts = opts || {};
    if (S && S.state === "running") return { busy: true, done: S.done, total: S.total };
    var all = L.aiBenchQuestions || [], re = opts.match ? new RegExp(opts.match) : null, ids = opts.ids || null;
    var sub = ids || re ? all.filter(function (q) { return (ids && ids.indexOf(q.id) >= 0) || (re && re.test(q.id)); }) : null;
    var missing = ids ? ids.filter(function (id) { return !all.some(function (q) { return q.id === id; }); }) : [];
    if (missing.length) return { error: "no such question", missing: missing };
    if (sub && !sub.length) return { error: "no question matches" };
    S = { state: "running", kind: sub ? "chosen" : opts.quick ? "quick" : "full", lantern: L.version, t0: Date.now(), done: 0, total: null, rows: [], fails: [], report: null, error: null,
      stopper: typeof w.AbortController === "function" ? new w.AbortController() : null };
    try { w.localStorage.removeItem(KEY_ROWS); w.localStorage.removeItem(KEY_REP); } catch (e) { }
    if (sub) L.aiBenchQuestions = sub;
    var done = function () { if (sub) L.aiBenchQuestions = all; };
    L.aiBench.run({ quick: !sub && !!opts.quick, signal: S.stopper ? S.stopper.signal : undefined, onItem: function (i, total, row) {
      S.done = i; S.total = total; S.rows.push(row);
      if (!row.pass) S.fails.push(row.id);
      keep(KEY_ROWS, S.rows);
    } }).then(function (rep) { S.report = rep; S.state = "done"; keep(KEY_REP, rep); done(); },
      function (e) { S.error = String((e && e.message) || e); S.state = "error"; done(); });
    return { started: true, kind: S.kind, lantern: L.version, model: L.ai && L.ai.describe ? L.ai.describe() : null, questions: sub ? sub.map(function (q) { return q.id; }) : (opts.quick ? "quick" : all.length + " in the bench") };
  }
  function status(last) {
    if (!S) {
      var saved = null;
      try { saved = JSON.parse(w.localStorage.getItem(KEY_ROWS) || "null"); } catch (e) { saved = null; }
      return { state: "none", lantern: L.version, saved: saved ? saved.map(slim) : null };
    }
    var secs = (Date.now() - S.t0) / 1000, out = { state: S.state, kind: S.kind, lantern: S.lantern, done: S.done, total: S.total, minutes: Math.round(secs / 6) / 10, fails: S.fails.slice(),
      last: S.rows.slice(-(last || 6)).map(slim), error: S.error, saveError: S.saveError || null, hidden: !!(w.document && w.document.hidden) };
    if (S.report) { out.seconds = S.report.seconds; out.summary = S.report.summary; out.when = S.report.when; }
    return out;
  }
  function rows(which) {
    var rs = S ? S.rows : [];
    if (!rs.length) { try { rs = JSON.parse(w.localStorage.getItem(KEY_ROWS) || "[]"); } catch (e) { rs = []; } }
    if (which === "failed") return rs.filter(function (r) { return !r.pass; });
    if (which && which !== "all") return rs.filter(function (r) { return which.indexOf(r.id) >= 0; });
    return rs;
  }
  function report() {
    if (S && S.report) return S.report;
    try { return JSON.parse(w.localStorage.getItem(KEY_REP) || "null"); } catch (e) { return null; }
  }
  function stop() { if (S && S.stopper && S.state === "running") { S.stopper.abort(); return true; } return false; }
  w.lanternBench = { start: start, status: status, rows: rows, report: report, stop: stop, slim: slim };
})();
