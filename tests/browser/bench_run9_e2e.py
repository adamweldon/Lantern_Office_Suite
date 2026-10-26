#!/usr/bin/env python3
"""bench_run9_e2e.py -- Lantern Bench in a real browser, against a stand-in
llama-server that sees images and answers with replies from bench run 9
(not part of npm test; needs Playwright with Chromium).

Checks, in Chromium (a real canvas, so the look turn sends a real PNG):
  - each puzzle row says whether it had Lantern's puzzle tools, or was the
    same puzzle with them switched off (not scored);
  - the two-coin cups: "put silver in Red" goes back, the block written the
    way the steps say it runs, the row passes and keeps both blocks;
  - the sun and sea: the sea filling the picture goes back, the corrected
    drawing is shown to the model as a PNG, and it says LOOKS RIGHT;
  - the queue block with "directly behind" runs;
  - 3 dozen eggs: Lantern answers the NEED, the row passes.
Usage: python3 tests/browser/bench_run9_e2e.py [outdir for the screenshot and JSON]
"""
import base64, io, json, os, re, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGE = open(os.path.join(ROOT, "src", "lantern.inner.html"), "rb").read()
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="lantern-bench9-")
os.makedirs(OUT, exist_ok=True)
SEEN = {"png": 0}

CUPS_NAMED = ("TRACK: Cups\nrow Red Blue Green Yellow White\nput gold in Green\nput silver in White\nswap Blue and White\n"
              "swap holder of gold and 2 left of holder of gold\nshift right 1\ntake silver from holder of silver\nput silver in Red\n"
              "swap first and last\nswap middle and holder of silver\nEND")
CUPS_GOOD = CUPS_NAMED.replace("put silver in Red", "put silver in left of holder of gold")
QUEUE = ("TRACK: Queue\nrow Ann Ben Cal Dee Eve\nput ball in Ben\nmove last to first\n"
         "swap holder of ball and person directly behind holder of ball\ngive ball to holder of first\nswap second and fourth\nEND")
SEA_BAD = "MAKE DRAWING: Yellow sun above blue sea\nrect 0 0 20 12 fill blue\ncircle 10 3 3 fill yellow\nEND"
SEA_GOOD = "MAKE DRAWING: Sun over the sea\nrect 0 0 20 8 fill sky\nrect 0 8 20 4 fill blue\ncircle 10 4 2 fill yellow\nEND"

def text_of(c):
    return c if isinstance(c, str) else "\n".join(x.get("text", "") for x in c if x.get("type") == "text")

def reply(body):
    msgs = body["messages"]
    last = msgs[-1]
    t = text_of(last.get("content"))
    allt = "\n".join(text_of(m.get("content")) for m in msgs if m.get("role") == "user")
    if isinstance(last.get("content"), list) and any(x.get("type") == "image_url" for x in last["content"]):
        url = [x for x in last["content"] if x.get("type") == "image_url"][0]["image_url"]["url"]
        if url.startswith("data:image/png;base64,") and len(url) > 2000:
            SEEN["png"] += 1
        return "LOOKS RIGHT: a yellow sun above a blue sea under a light blue sky."
    if t.startswith("PUZZLE RESULTS"):
        m = re.search(r"Final order[^:]*: ([\s\S]*)", t)
        return "ANSWER: " + (m.group(1).replace("\n", " ") if m else "done")
    if "Five cups stand in a row" in allt and "two coin" not in allt and "silver coin" in allt:
        return CUPS_GOOD if "Lantern ran your TRACK block" in t else CUPS_NAMED
    if "Five people stand in a queue" in allt:
        return QUEUE
    if "yellow sun above a blue sea" in allt:
        return SEA_GOOD if "Lantern checked your MAKE" in t else SEA_BAD
    if "3 dozen eggs" in allt:
        return "=12*36\nANSWER: 3 dozen eggs cost {result} shillings." if "dozen is 12" in t else "NEED: How many eggs are in 3 dozen?"
    return "ANSWER: Not in my library."

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype):
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        p = self.path.split("?")[0]
        if p in ("/", "/index.html"): return self.send(200, PAGE, "text/html; charset=utf-8")
        if p == "/v1/models": return self.send(200, json.dumps({"data": [{"id": "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf"}]}).encode(), "application/json")
        if p == "/props": return self.send(200, json.dumps({"modalities": {"vision": True}}).encode(), "application/json")
        if p == "/health": return self.send(200, b'{"status":"ok"}', "application/json")
        self.send(404, b"nf", "text/plain")
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        out = {"choices": [{"message": {"content": reply(body)}, "finish_reason": "stop"}], "usage": {"completion_tokens": 30}}
        self.send(200, json.dumps(out).encode(), "application/json")

srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/" % srv.server_address[1]
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:500]))
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1000, "height": 1200}, accept_downloads=True)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("() => window.Lantern && Lantern.ai && Lantern.ai.server.checked && Lantern.ai.canSee()", timeout=20000)
    pg.evaluate("() => { location.hash = 'ai'; }")
    pg.wait_for_selector("button:has-text('Full run')", timeout=10000)
    pg.click("button:has-text('Full run')")
    pg.wait_for_selector("button:has-text('Save results (JSON)')", timeout=600000)
    with pg.expect_download() as dl:
        pg.click("button:has-text('Save results (JSON)')")
    path = os.path.join(OUT, "bench.json"); dl.value.save_as(path)
    rep = json.load(open(path))
    R = {r["id"]: r for r in rep["rows"]}
    rows = pg.locator(".la-tbl tbody tr")
    texts = [rows.nth(i).inner_text() for i in range(rows.count())]
    tagged = [t for t in texts if "Five cups stand in a row" in t and "silver coin" in t]
    ok("the two cup rows are labelled: with the tools, and switched off (not scored)", len(tagged) == 2 and any("with Lantern’s puzzle tools" in t for t in tagged) and any("switched off" in t and "not scored" in t for t in tagged), tagged)
    c = R.get("cups-two-coins", {})
    blocks = (c.get("chat") or [{}])[0].get("blocks") or []
    ok("cups: questioned, corrected, passed; both blocks kept", c.get("pass") and len(blocks) == 2 and "put silver in Red" in blocks[0]["lines"] and blocks[1]["ok"], [c.get("why"), blocks])
    s = R.get("make-sun-sea", {})
    ok("sun and sea: the full-picture sea went back, the corrected drawing passed", s.get("pass") and s.get("rounds", 0) >= 3, [s.get("why"), s.get("rounds"), s.get("rejected")])
    ok("...and the model was shown it as a real PNG and kept it", s.get("looked") == "kept it" and SEEN["png"] >= 1, [s.get("looked"), SEEN])
    q = R.get("queue-ball", {})
    ok("queue: the block with “directly behind” ran", q.get("pass"), [q.get("why"), (q.get("chat") or [{}])[0].get("blocks")])
    e = R.get("egg-dozens", {})
    ok("3 dozen eggs: Lantern answered the NEED, 432", e.get("pass") and e.get("value") == 432 and "dozen is 12" in (e.get("needAnswered") or ""), [e.get("why"), e.get("value"), e.get("needAnswered")])
    ok("no page errors", not errors, errors)
    rows.first.scroll_into_view_if_needed()
    idx = [i for i, t in enumerate(texts) if "Five cups stand in a row" in t]
    if idx:
        rows.nth(idx[0] - 1 if idx[0] > 0 else 0).scroll_into_view_if_needed()
        pg.screenshot(path=os.path.join(OUT, "bench_table.png"))
    b.close()
srv.shutdown()
print("results in " + OUT)
print("BENCH RUN 9 E2E FAILED (%d)" % len(fails) if fails else "ALL BENCH RUN 9 E2E CHECKS PASS")
sys.exit(1 if fails else 0)
