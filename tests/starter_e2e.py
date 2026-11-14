# starter_e2e.py -- the Lantern starter (tools/starter, 1.24.19) end to end on
# this computer, against stand-ins: a release server with Lantern.zip, a
# llama.cpp release with a fake llama-server, and Hugging Face (a redirect to a
# signed link, Range answered, sent slowly so progress can be seen). The kit's
# own setup-kit.sh and start-lantern.sh do the downloading and the starting.
#   - installs Lantern from the zip into ~/Lantern, copies itself in, makes a
#     menu entry;
#   - serves Lantern at once (index.html), answers the AI's paths with 404
#     until there is an engine, then passes them to it;
#   - fetches the engine, the small model, then the one the memory suits (8 GB:
#     the 4B), each with its size and progress in /lantern-setup/status;
#   - starts the AI when the small model is in, and again with the 4B;
#   - an offer chosen is queued; a second starter opens the first one's page
#     and stops; Stop Lantern stops it and the AI.
# Needs Go (to build the starter); without it the test says so and passes.
import http.server, json, os, shutil, socket, subprocess, sys, tarfile, tempfile, threading, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails, passes = [], [0]
def ok(name, cond, info=""):
    if cond: passes[0] += 1
    else: fails.append(name); print("FAIL", name, str(info)[-900:])
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

GO = shutil.which("go") or ("/usr/local/go/bin/go" if os.path.exists("/usr/local/go/bin/go") else None)
if not GO:
    print("STARTER CHECKS SKIPPED: no Go here to build tools/starter")
    sys.exit(0)

tmp = tempfile.mkdtemp(prefix="starter-e2e-")
binp = os.path.join(tmp, "Lantern-starter")
env0 = dict(os.environ, CGO_ENABLED="0", GOFLAGS="-mod=mod", GOTOOLCHAIN="local")
r = subprocess.run([GO, "build", "-o", binp, "."], cwd=os.path.join(ROOT, "tools", "starter"), env=env0, capture_output=True, text=True)
ok("the starter builds", r.returncode == 0, r.stderr)
for goos, goarch, ext in (("windows", "amd64", ".exe"), ("darwin", "arm64", ""), ("darwin", "amd64", ""), ("linux", "arm64", "")):
    rr = subprocess.run([GO, "build", "-o", os.path.join(tmp, "x-" + goos + goarch + ext), "."], cwd=os.path.join(ROOT, "tools", "starter"),
                        env=dict(env0, GOOS=goos, GOARCH=goarch), capture_output=True, text=True)
    ok("...and for %s/%s" % (goos, goarch), rr.returncode == 0, rr.stderr)

# --- the stand-ins ----------------------------------------------------------------
mirror = os.path.join(tmp, "mirror"); os.makedirs(mirror)
r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "make_lantern_zip.py"), mirror], capture_output=True, text=True)
ok("Lantern.zip made from this folder", r.returncode == 0 and os.path.exists(os.path.join(mirror, "Lantern.zip")), r.stdout + r.stderr)
MODELS = {"Qwen3.5-0.8B-GGUF": ("Qwen3.5-0.8B-Q4_K_M.gguf", 600000), "Qwen3.5-4B-GGUF": ("Qwen3.5-4B-Q4_K_M.gguf", 1500000)}
for repo, (f, n) in MODELS.items():
    d = os.path.join(mirror, "hf", "unsloth", repo, "resolve", "main"); os.makedirs(d)
    open(os.path.join(d, f), "wb").write(b"GGUF" + os.urandom(n))
    open(os.path.join(d, "mmproj-F16.gguf"), "wb").write(b"GGUF" + os.urandom(2000))
FAKE = "#!" + sys.executable + "\n" + r'''import sys, json, time, http.server
if "--version" in sys.argv: print("version: fake"); sys.exit(0)
port = int(sys.argv[sys.argv.index("--port") + 1]); m = sys.argv[sys.argv.index("-m") + 1].replace(chr(92), "/").split("/")[-1]
t0 = time.time()
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if time.time() - t0 < 1.5: return self.send(503, {"error": {"code": 503, "message": "Loading model"}})
        if self.path.startswith("/v1/models"): return self.send(200, {"data": [{"id": m}]})
        if self.path.startswith("/health"): return self.send(200, {"status": "ok"})
        if self.path.startswith("/props"): return self.send(200, {"modalities": {"vision": False}})
        self.send(404, {})
    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0")); self.rfile.read(n)
        self.send(200, {"choices": [{"message": {"role": "assistant", "content": "Hello from " + m}}]})
print("FAKE engine " + m, flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
'''
os.makedirs(os.path.join(mirror, "llama"))
with tarfile.open(os.path.join(mirror, "llama", "llama-b11435-bin-ubuntu-x64.tar.gz"), "w:gz") as t:
    data = FAKE.encode(); ti = tarfile.TarInfo("build/bin/llama-server"); ti.size = len(data); ti.mode = 0o755
    import io; t.addfile(ti, io.BytesIO(data))

SLOW = {"on": True}
class M(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass
    def empty(self, code, extra=None):
        self.send_response(code)
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.send_header("Content-Length", "0"); self.end_headers()
    def do_HEAD(self): self.empty(403)
    def do_GET(self):
        p = self.path.split("?")[0]
        if "/resolve/main/" in p and not p.startswith("/signed/"):
            return self.empty(302, {"Location": "http://127.0.0.1:%d/signed%s?sig=x" % (self.server.server_port, p)})
        f = os.path.join(mirror, p[len("/signed/"):] if p.startswith("/signed/") else p.lstrip("/"))
        if not os.path.isfile(f): return self.empty(404)
        data = open(f, "rb").read(); start = 0
        rg = self.headers.get("Range", "")
        if rg.startswith("bytes="):
            a, _, b = rg[6:].partition("-"); start = int(a or 0); end = int(b) if b else len(data) - 1
            if start >= len(data): return self.empty(416, {"Content-Range": "bytes */%d" % len(data)})
            body = data[start:end + 1]
            self.send_response(206); self.send_header("Content-Range", "bytes %d-%d/%d" % (start, start + len(body) - 1, len(data)))
        else:
            body = data; self.send_response(200)
        self.send_header("Content-Length", str(len(body))); self.end_headers()
        slow = SLOW["on"] and p.endswith(".gguf") and len(body) > 100000
        for i in range(0, len(body), 65536):
            try: self.wfile.write(body[i:i + 65536])
            except Exception: return
            if slow: time.sleep(0.25)
mp = free_port()
srv = http.server.ThreadingHTTPServer(("127.0.0.1", mp), M); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d" % mp

home = os.path.join(tmp, "home"); os.makedirs(home)
port, eport, wport = free_port(), free_port(), free_port()
env = dict(os.environ, HOME=home, HF_BASE=BASE + "/hf", LLAMA_BASE=BASE + "/llama", KIWIX_BASE="http://127.0.0.1:%d" % free_port(),
           LANTERN_MEM_MB="8000", NO_PROXY="127.0.0.1", no_proxy="127.0.0.1", LANTERN_FREE_GB="200")
for k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "all_proxy"): env.pop(k, None)
args = [binp, "--zip", BASE + "/Lantern.zip", "--no-browser", "--port", str(port), "--engine-port", str(eport), "--watch-port", str(wport), "--idle", "10m"]
log = open(os.path.join(tmp, "starter.out"), "w")
proc = subprocess.Popen(args, env=env, stdout=log, stderr=subprocess.STDOUT)
U = "http://127.0.0.1:%d" % port
def get(path, data=None, timeout=5):
    req = urllib.request.Request(U + path, data=data, method="POST" if data is not None else "GET", headers={"Content-Type": "application/json"} if data is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, e.read()
    except Exception as e: return 0, str(e).encode()
def status():
    c, b = get("/lantern-setup/status")
    return json.loads(b) if c == 200 else None

t = time.time(); st = None
while time.time() - t < 30:
    st = status()
    if st: break
    time.sleep(0.3)
ok("it serves Lantern within seconds of starting, before any AI is there", st is not None and time.time() - t < 30, open(os.path.join(tmp, "starter.out")).read())
inst = os.path.join(home, "Lantern")
ok("Lantern is installed in ~/Lantern from the release's zip, with the starter copied in", os.path.isfile(os.path.join(inst, "site", "index.html")) and
   os.path.isfile(os.path.join(inst, "kit", "setup-kit.sh")) and os.access(os.path.join(inst, "Lantern"), os.X_OK), os.listdir(inst) if os.path.isdir(inst) else "none")
ok("...and a menu entry that runs it", "Exec=\"%s\"" % os.path.join(inst, "Lantern") in (open(os.path.join(home, ".local", "share", "applications", "lantern.desktop")).read()
   if os.path.exists(os.path.join(home, ".local", "share", "applications", "lantern.desktop")) else ""))
c, b = get("/")
ok("Lantern's page is served at once", c == 200 and b"Lantern" in b[:20000], c)
c, b = get("/v1/models")
st = status()
ok("the AI's paths answer 404 while the AI is still coming (the page then waits for nothing), the status says it is downloading",
   c == 404 and st and st["ai"]["state"] in ("downloading", "none"), [c, st and st["ai"]])
ok("the plan: the engine, the small model, then the 4B for 8 GB of memory; the 35B not offered at 8 GB",
   st and [j["id"] for j in st["jobs"]] == ["engine", "0.8b", "laptop"] and [o["id"] for o in st["offers"]] == ["library", "shelves"], st and (st["jobs"], st["offers"]))
# progress of the small model: a size and a growing count
seen, msgs = [], set()
t = time.time()
while time.time() - t < 60:
    st = status() or {}
    for j in st.get("jobs", []):
        if j["state"] == "running" and j["id"] in ("0.8b", "laptop") and j["total"] > 0: seen.append((j["id"], j["bytes"], j["total"], j["leftMs"]))
    if st.get("message"): msgs.add(st["message"])
    if st.get("ai", {}).get("state") == "ready": break
    time.sleep(0.4)
small = [x for x in seen if x[0] == "0.8b"]
ok("the small model's download is seen growing, against its whole size", len(small) >= 2 and small[-1][1] > small[0][1] and small[0][2] == 600004, small[:3] + small[-2:])
ok("...with a sentence for the page", any(m.startswith("Getting a small AI model") and "%" in m for m in msgs), sorted(msgs)[:6])
ok("the AI starts as soon as the small model is in", st.get("ai", {}).get("state") == "ready", st.get("ai"))
c, b = get("/v1/models")
ok("...and the AI's paths reach it through Lantern's own address", c == 200 and b"Qwen3.5-0.8B" in b, [c, b[:200]])
c, b = get("/v1/chat/completions", json.dumps({"messages": [{"role": "user", "content": "hi"}]}).encode())
ok("...a reply comes back", c == 200 and b"Hello from Qwen3.5-0.8B" in b, [c, b[:200]])
# the 4B arrives, the AI is started again with it
t = time.time()
while time.time() - t < 90:
    st = status() or {}
    for j in st.get("jobs", []):
        if j["state"] == "running" and j["id"] == "laptop" and j["total"] > 0: seen.append((j["id"], j["bytes"], j["total"], j["leftMs"]))
    if st.get("ai", {}).get("state") == "ready" and "4B" in (st.get("ai", {}).get("model") or ""): break
    time.sleep(0.5)
big = [x for x in seen if x[0] == "laptop"]
ok("the 4B's download too, with the time left once two seconds of it are measured", len(big) >= 2 and any(x[3] > 0 for x in big), big[-4:])
ok("when the 4B is in, the AI is started again with it", "Qwen3.5-4B" in (st.get("ai", {}).get("model") or "") and
   all(j["state"] == "done" for j in st["jobs"]) and not st["busy"], st.get("ai"))
c, b = get("/v1/models")
ok("...and answers with it", c == 200 and b"Qwen3.5-4B" in b, b[:200])
ok("the files are in the kit, the vision part with the 4B", os.path.isfile(os.path.join(inst, "kit", "models", "Qwen3.5-4B-Q4_K_M.gguf")) and
   os.path.isfile(os.path.join(inst, "kit", "models", "mmproj-Qwen3.5-4B-F16.gguf")) and os.path.isfile(os.path.join(inst, "kit", "engine", "linux", "llama-server")))
ok("the message says everything is here", st.get("message") == "Everything Lantern needs is here.", st.get("message"))
# an offer chosen: queued, tried (the library's server here is not there: it waits and says so)
c, b = get("/lantern-setup/choose", json.dumps({"id": "library"}).encode())
st2 = json.loads(b) if c == 200 else {}
ok("an offer chosen is queued and no longer offered", c == 200 and any(j["id"] == "library" for j in st2.get("jobs", [])) and
   "library" not in [o["id"] for o in st2.get("offers", [])], [c, b[:300]])
t = time.time()
while time.time() - t < 30:
    st = status() or {}
    lj = [j for j in st.get("jobs", []) if j["id"] == "library"]
    if lj and lj[0]["state"] in ("waiting", "failed", "done"): break
    time.sleep(0.5)
ok("...with no library server to reach it waits, and says Lantern tries again", lj and lj[0]["state"] == "waiting" and "tries again" in st.get("message", ""), [lj, st.get("message")])
c, b = get("/lantern-setup/choose", json.dumps({"id": "nonsense"}).encode())
ok("an offer that is not one is refused", c == 400, c)
# another site's page in the browser may not stop Lantern, start a download, or reach it by another name
import http.client
def raw(method, path, headers, body=None):
    cn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        cn.request(method, path, body=body, headers=headers); rr = cn.getresponse(); return rr.status, rr.read()
    finally:
        cn.close()
jobs0 = [j["id"] for j in (status() or {}).get("jobs", [])]
c1, _ = raw("POST", "/lantern-setup/stop", {"Origin": "https://example.com", "Content-Type": "text/plain"}, b"{}")
c2, _ = raw("POST", "/lantern-setup/choose", {"Origin": "https://example.com", "Content-Type": "text/plain"}, b'{"id":"library"}')
c3, _ = raw("GET", "/v1/models", {"Host": "lantern.example.com:%d" % port})
c4, _ = raw("POST", "/lantern-setup/choose", {"Origin": "http://localhost:%d" % port, "Host": "localhost:%d" % port, "Content-Type": "application/json"}, b'{"id":"nothing"}')
time.sleep(0.8)   # a stop would come 0.3 s after its answer
ok("another site's page may not stop Lantern or start a download; another name for 127.0.0.1 is refused; Lantern's own page by localhost is heard",
   c1 == 403 and c2 == 403 and c3 == 403 and c4 == 400 and proc.poll() is None and [j["id"] for j in (status() or {}).get("jobs", [])] == jobs0, [c1, c2, c3, c4, proc.poll(), jobs0])
# a second starter: opens the first one's page and stops
t0 = time.time()
r = subprocess.run(args, env=env, capture_output=True, text=True, timeout=30)
ok("a second starter sees the first and stops at once", r.returncode == 0 and time.time() - t0 < 10, r.stderr[-400:])
# Stop Lantern
c, b = get("/lantern-setup/stop", b"{}")
try: rc = proc.wait(timeout=20)
except subprocess.TimeoutExpired: rc = None; proc.kill()
ok("Stop Lantern, from the page, stops it", c == 200 and rc == 0, [c, rc])
time.sleep(1.5)
def up(p):
    try: socket.create_connection(("127.0.0.1", p), timeout=1).close(); return True
    except Exception: return False
ok("...and the AI with it", not up(eport) and not up(port), [up(eport), up(port)])
logtxt = open(os.path.join(inst, "kit", "logs", "starter.log")).read() if os.path.exists(os.path.join(inst, "kit", "logs", "starter.log")) else ""
ok("its log is in the kit", "Lantern starter 1.24.19" in logtxt and "AI ready" in logtxt, logtxt[-600:])

# started again from the copy in the Lantern folder: nothing to download, the AI starts at once
port2 = free_port()
args2 = [os.path.join(inst, "Lantern"), "--no-browser", "--port", str(port2), "--engine-port", str(free_port()), "--watch-port", str(free_port())]
U = "http://127.0.0.1:%d" % port2
p2 = subprocess.Popen(args2, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
t = time.time(); st = None
while time.time() - t < 30:
    st = status()
    if st and st["ai"]["state"] == "ready": break
    time.sleep(0.4)
ok("run again from the Lantern folder: no downloads, the 4B started", st and st["jobs"] == [] and "4B" in (st["ai"]["model"] or ""), st)
get("/lantern-setup/stop", b"{}")
try: p2.wait(timeout=20)
except subprocess.TimeoutExpired: p2.kill()

srv.shutdown()
shutil.rmtree(tmp, ignore_errors=True)
print(("%d STARTER FAILURES" % len(fails)) if fails else "ALL STARTER CHECKS PASS (%d)" % passes[0])
sys.exit(1 if fails else 0)
