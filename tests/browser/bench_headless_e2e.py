#!/usr/bin/env python3
"""bench_headless_e2e.py -- tools/bench_headless.py against a stand-in model
server (not part of npm test; needs Playwright with Chromium).

The stand-in serves the built site/index.html the way the kit's llama-server
does, answers /health, and replies to three chosen bench questions: one right
formula, one wrong one (twice), one decline. Checks:
  - the run finishes and the tool exits 0, whatever it scored;
  - report.json is the bench's own report (bench, lantern, model, rows);
  - rows.json has the three rows; failed.json has only the failed one, with
    the reply as the model wrote it;
  - summary.md names the score and the failed question;
  - with no server at the address the tool gives up and exits 2;
  - a run that is out of time is stopped, keeps its rows, and exits 3.
Usage: python3 tests/browser/bench_headless_e2e.py [outdir]
"""
import json, os, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGE = open(os.path.join(ROOT, "site", "index.html"), "rb").read()
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="lantern-bench-headless-")
os.makedirs(OUT, exist_ok=True)
SLOW = {"s": 0.0}
FAILS = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok or not detail else " -- " + str(detail)[:300]))
    if not ok:
        FAILS.append(name)


def text_of(c):
    return c if isinstance(c, str) else "\n".join(x.get("text", "") for x in c if x.get("type") == "text")


def reply(body):
    allt = "\n".join(text_of(m.get("content")) for m in body["messages"] if m.get("role") == "user")
    if "12 hens" in allt:
        return "=EGGS(12,5)\nANSWER: {result} eggs a week."
    if "26 miles" in allt:
        return "=26*2\nANSWER: {result} km."          # wrong, both tries
    return "ANSWER: Not in my library."


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype):
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
        except (BrokenPipeError, ConnectionResetError):
            return
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):   # the browser closed while a reply was on its way (the cut-off run)
            pass

    def do_GET(self):
        p = self.path.split("?")[0]
        if p in ("/", "/index.html"):
            return self.send(200, PAGE, "text/html; charset=utf-8")
        if p == "/v1/models":
            return self.send(200, json.dumps({"data": [{"id": "Stand-in-0.8B-Q4_K_M.gguf"}]}).encode(), "application/json")
        if p == "/props":
            return self.send(200, json.dumps({"modalities": {"vision": False}}).encode(), "application/json")
        if p == "/health":
            return self.send(200, b'{"status":"ok"}', "application/json")
        self.send(404, b"nf", "text/plain")

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        if SLOW["s"]:
            time.sleep(SLOW["s"])
        out = {"choices": [{"message": {"content": reply(body)}, "finish_reason": "stop"}], "usage": {"completion_tokens": 12}}
        self.send(200, json.dumps(out).encode(), "application/json")


srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/" % srv.server_address[1]
TOOL = os.path.join(ROOT, "tools", "bench_headless.py")


def run(out, *args):
    r = subprocess.run([sys.executable, TOOL, "--url", URL, "--out", out, "--poll", "0.5"] + list(args),
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=300)
    return r.returncode, r.stdout


def load(out, name):
    with open(os.path.join(out, name), encoding="utf-8") as f:
        return f.read() if name.endswith(".md") else json.load(f)


# 1. three chosen questions: one right, one wrong, one declined
o1 = os.path.join(OUT, "chosen")
code, log = run(o1, "--ids", "eggs,miles-km,mayor", "--label", "stand-in")
check("the run finishes and the tool exits 0", code == 0, log[-600:])
rep, rows, failed, md = load(o1, "report.json"), load(o1, "rows.json"), load(o1, "failed.json"), load(o1, "summary.md")
want = 3
check("report.json is the bench's report", rep.get("bench", "").startswith("Lantern Bench") and rep.get("lantern") and len(rep.get("rows", [])) == want, json.dumps(rep)[:300])
check("the report names the model the server gave", "Stand-in-0.8B" in json.dumps(rep.get("model")), rep.get("model"))
check("rows.json has every row", sorted(r["id"] for r in rows) == ["eggs", "mayor", "miles-km"], [r["id"] for r in rows])
by = dict((r["id"], r) for r in rows)
check("the right formula passes", by["eggs"]["pass"] is True and by["eggs"]["value"] == 60, by["eggs"])
check("the wrong formula fails with its value", by["miles-km"]["pass"] is False and by["miles-km"]["value"] == 52, by["miles-km"])
check("the decline passes", by["mayor"]["pass"] is True, by["mayor"])
check("failed.json has only the failed row, as the model wrote it", [r["id"] for r in failed] == ["miles-km"] and "=26*2" in failed[0]["reply"], failed)
check("summary.md gives the score", ("**%d of %d scored questions passed" % (want - 1, want)) in md, md[:400])
check("summary.md names the failed question and why", "`miles-km`" in md and "wrong value" in md, md)
check("summary.md says no library was attached", "No offline library" in md, md)
check("the log follows the run", ("%d of %d" % (want, want)) in log and "started:" in log, log[-400:])

# 2. the quick run uses the bench's own quick list
o2 = os.path.join(OUT, "quick")
code, log = run(o2, "--quick")
rep2 = load(o2, "report.json")
check("the quick run finishes", code == 0 and rep2.get("quick") is True and len(rep2["rows"]) >= 10, log[-300:])

# 3. out of time: stopped after the question in hand, rows kept, exit 3
SLOW["s"] = 1.5
o3 = os.path.join(OUT, "cut")
code, log = run(o3, "--minutes", "0.05")
SLOW["s"] = 0.0
rows3 = load(o3, "rows.json")
md3 = load(o3, "summary.md")
check("a run out of time exits 3 and keeps its rows", code == 3 and 1 <= len(rows3) < 60, (code, len(rows3), log[-300:]))
check("its summary says it did not finish", "NOT finished" in md3, md3[:300])

# 4. nothing at the address: exit 2
srv.shutdown()
srv.server_close()
o4 = os.path.join(OUT, "nobody")
r = subprocess.run([sys.executable, TOOL, "--url", URL, "--out", o4, "--wait-model", "3"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=120)
check("no model at the address: exit 2 and a summary that says so", r.returncode == 2 and "No model answered" in load(o4, "summary.md"), r.stdout[-300:])

print("")
if FAILS:
    print("%d FAILED: %s" % (len(FAILS), ", ".join(FAILS)))
    sys.exit(1)
print("ALL BENCH HEADLESS BROWSER TESTS PASS  (" + OUT + ")")
