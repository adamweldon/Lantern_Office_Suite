#!/usr/bin/env python3
"""bench_headless.py -- run Lantern Bench with nobody at the screen.

Opens Lantern in a headless Chromium at an address where a model is being
served (the kit's http://127.0.0.1:8080/), evaluates tools/bench_pane.js in
the page, starts a run, follows it, and writes what it found. It is what the
"Lantern Bench" workflow runs on GitHub with the small models, and it works
the same on any computer where Start Lantern is running.

  python3 tools/bench_headless.py [--url http://127.0.0.1:8080/] [--out bench-out]
      [--quick | --ids id,id | --match REGEX]   which questions (default: all)
      [--minutes 330]      stop asking after this long and keep what there is
      [--wait-model 900]   seconds to wait for the model to finish loading
      [--label 4b]         a name for this run in the summary

Written into --out:
  rows.json     the rows so far, rewritten as questions finish (a run that is
                cut off keeps what it had)
  report.json   the finished report, the same JSON as the AI tile's Save JSON
  failed.json   the failed rows as the model wrote them (for tests/fixtures)
  summary.md    a short table for a person: score, sets, the failed questions
The summary is also printed, and after it the failed rows (id, why, the
reply cut to --reply-chars) as one line of JSON each between the lines
"=== FAILED ROWS ..." and "=== END FAILED ROWS ===", so the job's log alone
is enough to work from.

Exit code: 0 the run finished (whatever it scored); 2 no model answered;
3 it stopped on an error or ran out of time (rows.json has what was done).
Needs Playwright with Chromium (pip install playwright; playwright install
chromium), like tests/browser/.
"""
import argparse, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def health(url, timeout=5):
    """The model server's /health: 'ok', 'loading' (503 while the model loads) or '' (nothing there)."""
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/health", timeout=timeout) as r:
            return "ok" if r.status == 200 else "loading"
    except urllib.error.HTTPError as e:
        return "loading" if e.code == 503 else ""
    except Exception:
        return ""


def wait_model(url, seconds, say):
    t0, last = time.time(), None
    while time.time() - t0 < seconds:
        h = health(url)
        if h == "ok":
            return True
        if h != last:
            say("model server: " + (h or "no answer yet"))
            last = h
        time.sleep(2)
    return False


def pct(a, b):
    return "%d%%" % round(100.0 * a / b) if b else "-"


def summary_md(label, st, rows, report):
    """A short Markdown table a person can read: the score, the sets, what failed and why."""
    scored = [r for r in rows if r.get("cat") != "alone"]
    passed = [r for r in scored if r.get("pass")]
    alone = [r for r in rows if r.get("cat") == "alone"]
    second = [r for r in passed if (r.get("rounds") or 1) > 1]
    out = []
    model = (report or {}).get("model") or st.get("model") or "?"
    out.append("## Lantern Bench: %s" % (label or model))
    out.append("")
    out.append("Lantern %s, model `%s`, %s run, %s." % (st.get("lantern", "?"), model, st.get("kind", "?"),
               "finished" if st.get("state") == "done" else "NOT finished (%s)" % (st.get("error") or st.get("state"))))
    out.append("")
    out.append("**%d of %d scored questions passed (%s)** in %.0f minutes; %d passed only on the second try."
               % (len(passed), len(scored), pct(len(passed), len(scored)), st.get("minutes") or 0, len(second)))
    if alone:
        out.append("Puzzles without Lantern's tools (not scored): %d of %d." % (len([r for r in alone if r.get("pass")]), len(alone)))
    if report and report.get("summary") and report["summary"].get("medianTps"):
        out.append("Median speed: %s tokens a second." % report["summary"]["medianTps"])
    if report and not report.get("library"):
        out.append("No offline library was attached, so the encyclopedia questions were left out.")
    out.append("")
    cats = {}
    for r in scored:
        c = cats.setdefault(r.get("cat") or "?", [0, 0])
        c[0] += 1
        c[1] += 1 if r.get("pass") else 0
    out.append("| Kind of question | Passed | Of |")
    out.append("|---|---|---|")
    for k in sorted(cats):
        out.append("| %s | %d | %d |" % (k, cats[k][1], cats[k][0]))
    failed = [r for r in scored if not r.get("pass")]
    if failed:
        out.append("")
        out.append("| Failed | Why |")
        out.append("|---|---|")
        for r in failed:
            why = str(r.get("why") or "").replace("|", "/").replace("\n", " ")[:160]
            out.append("| `%s` | %s |" % (r.get("id"), why))
    out.append("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="Run Lantern Bench in a headless browser.")
    ap.add_argument("--url", default="http://127.0.0.1:8080/")
    ap.add_argument("--out", default="bench-out")
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--ids", default="")
    ap.add_argument("--match", default="")
    ap.add_argument("--minutes", type=float, default=330)
    ap.add_argument("--wait-model", type=float, default=900)
    ap.add_argument("--label", default="")
    ap.add_argument("--poll", type=float, default=15, help="seconds between looks at the run")
    ap.add_argument("--reply-chars", type=int, default=700, help="how much of each failed reply to print in the log")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    def say(msg):
        print("[bench %s] %s" % (time.strftime("%H:%M:%S"), msg), flush=True)

    def keep(name, val):
        with open(os.path.join(a.out, name), "w", encoding="utf-8") as f:
            if name.endswith(".md"):
                f.write(val)
            else:
                json.dump(val, f, indent=1, ensure_ascii=False)

    if not wait_model(a.url, a.wait_model, say):
        say("no model answered at %s within %d seconds" % (a.url, a.wait_model))
        keep("summary.md", "## Lantern Bench: %s\n\nNo model answered at %s.\n" % (a.label or "?", a.url))
        return 2
    say("model server: ok")

    from playwright.sync_api import sync_playwright
    pane = open(os.path.join(ROOT, "tools", "bench_pane.js"), encoding="utf-8").read()
    opts = {}
    if a.quick:
        opts["quick"] = True
    if a.ids:
        opts["ids"] = [s.strip() for s in a.ids.split(",") if s.strip()]
    if a.match:
        opts["match"] = a.match

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(a.url, wait_until="load")
        page.wait_for_function("() => window.Lantern && window.Lantern.aiBench && window.Lantern.aiBench.run", timeout=60000)
        page.evaluate(pane)
        started = page.evaluate("(o) => window.lanternBench.start(o)", opts)
        say("started: " + json.dumps(started)[:400])
        if not started.get("started"):
            keep("summary.md", "## Lantern Bench: %s\n\nThe run did not start: %s\n" % (a.label or "?", json.dumps(started)))
            browser.close()
            return 3
        deadline, done, st, stopping = time.time() + a.minutes * 60, -1, {}, False
        while True:
            time.sleep(a.poll)
            try:
                st = page.evaluate("() => window.lanternBench.status(1)")
            except Exception as e:   # the page went away: keep what was saved and stop
                say("the page stopped answering: %s" % e)
                st = {"state": "error", "error": "the page stopped answering", "lantern": started.get("lantern"), "kind": started.get("kind")}
                break
            if st.get("done") != done:
                done = st.get("done")
                say("%s of %s, %.1f min, failed so far %d; last %s" % (done, st.get("total"), st.get("minutes") or 0, len(st.get("fails") or []), (st.get("last") or [""])[-1]))
                keep("rows.json", page.evaluate("() => window.lanternBench.rows('all')"))
            if st.get("state") != "running":
                break
            if time.time() > deadline and not stopping:
                say("out of time after %.0f minutes: stopping after the question in hand" % a.minutes)
                page.evaluate("() => window.lanternBench.stop()")
                stopping, deadline = True, time.time() + 600
            elif time.time() > deadline and stopping:
                st["state"], st["error"] = "error", "ran out of time"
                break
        rows, report = [], None
        try:
            rows = page.evaluate("() => window.lanternBench.rows('all')")
            report = page.evaluate("() => window.lanternBench.report()")
        except Exception:
            try:
                rows = json.load(open(os.path.join(a.out, "rows.json"), encoding="utf-8"))
            except Exception:
                rows = []
        browser.close()

    st["model"] = started.get("model")
    cut = stopping or st.get("state") != "done"
    if cut and st.get("state") == "done":
        st["state"], st["error"] = "stopped", "ran out of time after %.0f minutes" % a.minutes
    keep("rows.json", rows)
    keep("failed.json", [r for r in rows if not r.get("pass") and r.get("cat") != "alone"])
    if report:
        keep("report.json", report)
    md = summary_md(a.label, st, rows, report)
    if errors:
        md += "\nPage errors seen during the run: %d (first: %s)\n" % (len(errors), errors[0][:200])
    keep("summary.md", md)
    print(md, flush=True)
    # The failed rows as the model wrote them, one line of JSON each, between
    # two marker lines: a session that can read this log but not the
    # artifact (the artifact store is another site) still gets them.
    print("=== FAILED ROWS (one JSON object a line) ===", flush=True)
    for r in rows:
        if r.get("pass") or r.get("cat") == "alone":
            continue
        slim = dict((k, r.get(k)) for k in ("id", "cat", "q", "why", "value", "expected", "rounds", "retry", "rejected", "flags", "tokens", "ms") if r.get(k) not in (None, "", [], False))
        for k in ("reply", "first"):
            if r.get(k):
                slim[k] = str(r[k])[:a.reply_chars]
        if r.get("chat"):
            slim["chat"] = [dict((k, (str(t[k])[:a.reply_chars] if k == "reply" else t[k])) for k in ("q", "searches", "declined", "reply") if t.get(k) not in (None, "", [], False)) for t in r["chat"]]
        print(json.dumps(slim, ensure_ascii=False), flush=True)
    print("=== END FAILED ROWS ===", flush=True)
    return 3 if cut else 0


if __name__ == "__main__":
    sys.exit(main())
