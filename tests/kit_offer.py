# kit_offer.py -- the kit's "bigger model" offer and model choice, end to end
# against a stand-in for Hugging Face (tests/fixtures/hfsim.py), with a fake
# llama-server. Runs setup-kit.sh / start-lantern.sh, and setup-kit.ps1 too
# when PowerShell (pwsh, or $PWSH) is installed. Memory, drive format and
# free space are pretended with LANTERN_MEM_MB / LANTERN_FS / LANTERN_FREE_GB.
import os, shutil, socket, subprocess, sys, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TIERS = {"Qwen3.5-35B-A3B-GGUF": "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf", "Qwen3.5-9B-GGUF": "Qwen3.5-9B-Q4_K_M.gguf",
         "Qwen3.5-4B-GGUF": "Qwen3.5-4B-Q4_K_M.gguf", "Qwen3.5-2B-GGUF": "Qwen3.5-2B-Q4_K_M.gguf", "Qwen3.5-0.8B-GGUF": "Qwen3.5-0.8B-Q4_K_M.gguf"}
fails = []
def ok(name, cond, info=""):
    if not cond: fails.append(name); print("FAIL", name, str(info)[-600:])
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p
tmp = tempfile.mkdtemp(prefix="kit-offer-")
mirror = os.path.join(tmp, "mirror")
for repo, f in TIERS.items():
    d = os.path.join(mirror, "unsloth", repo, "resolve", "main"); os.makedirs(d)
    open(os.path.join(d, f), "wb").write(b"GGUF" + os.urandom(4000))
port = free_port()
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "tests", "fixtures", "hfsim.py"), mirror, str(port)])
time.sleep(0.8)
HF = "http://127.0.0.1:%d" % port
DEAD = "http://127.0.0.1:%d" % free_port()

def make_kit(name, models):
    k = os.path.join(tmp, name)
    os.makedirs(os.path.join(k, "models")); os.makedirs(os.path.join(k, "engine", "linux")); os.makedirs(os.path.join(k, "site"))
    for f in ("setup-kit.sh", "start-lantern.sh", "setup-kit.ps1"): shutil.copy(os.path.join(ROOT, "kit", f), k)
    open(os.path.join(k, "site", "index.html"), "w").write("x")
    for m in models:
        repo = [r for r, f in TIERS.items() if f == m][0]
        shutil.copy(os.path.join(mirror, "unsloth", repo, "resolve", "main", m), os.path.join(k, "models"))
    fake = os.path.join(k, "engine", "linux", "llama-server")
    open(fake, "w").write("#!" + sys.executable + "\n" + """import sys, http.server
port = int(sys.argv[sys.argv.index("--port") + 1]); m = sys.argv[sys.argv.index("-m") + 1]
print("FAKE model=" + m.replace(chr(92), "/").split("/")[-1], flush=True)
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"ok"}'); raise SystemExit
    def log_message(self, *a): pass
try: http.server.HTTPServer(("127.0.0.1", port), H).handle_request()
except SystemExit: pass
""")
    for f in ("setup-kit.sh", "start-lantern.sh", fake): os.chmod(os.path.join(k, f), 0o755)
    return k
def run(kit, args, env=None, cmd=None):
    e = dict(os.environ); e.update({"HF_BASE": HF, "LANTERN_MEM_MB": "32000", "NO_BROWSER": "1", "LANTERN_NO_PAUSE": "1",
      "PORT": str(free_port()), "NO_PROXY": "127.0.0.1", "no_proxy": "127.0.0.1"}); e.update(env or {})
    r = subprocess.run((cmd or [os.path.join(kit, "setup-kit.sh")]) + args, cwd=kit, env=e, stdin=subprocess.DEVNULL,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=120)
    return r.stdout
def wait_file(p, secs=20):
    t = time.time()
    while time.time() - t < secs:
        if os.path.exists(p): return True
        time.sleep(0.3)
    return False

def suite(label, cmd_for):
    k = make_kit(label + "-a", ["Qwen3.5-4B-Q4_K_M.gguf"])
    out = run(k, ["check"], cmd=cmd_for(k))
    ok(label + ": 32 GB with the 4B offers the 35B-A3B (redirect + HEAD-refusing link counts as online)", "will offer Qwen3.5 35B-A3B" in out, out)
    out = run(k, ["offer"], {"HF_BASE": DEAD}, cmd_for(k))
    ok(label + ": no connection is said, not silent", "could not check for Qwen3.5 35B-A3B: no connection" in out, out)
    out = run(k, ["offer"], {"HF_BASE": HF + "/elsewhere"}, cmd_for(k))
    ok(label + ": a missing file is reported with the status", "answered 404" in out, out)
    out = run(k, ["offer"], {"LANTERN_FS": "FAT32" if label == "ps1" else "msdos"}, cmd_for(k))
    ok(label + ": FAT32 passes over 35B and 9B and says why", out.count("cannot hold files over 4 GB") == 2 and "35B-A3B would suit" in out, out)
    out = run(k, ["offer"], {"LANTERN_FREE_GB": "10"}, cmd_for(k))
    ok(label + ": too little room for the 35B offers the 9B", "needs 18.5 GB free" in out and "it can run Qwen3.5 9B" in out, out)
    out = run(k, ["offer"], {}, cmd_for(k))
    ok(label + ": with no keyboard nothing is downloaded or remembered", "no keyboard" in out and not os.path.exists(os.path.join(k, "models", ".skip-xl")), out)
    open(os.path.join(k, "models", ".skip-xl"), "w").close()
    out = run(k, ["check"], cmd=cmd_for(k))
    ok(label + ": N is remembered and the 9B is offered next", "answered N before" in out and "will offer Qwen3.5 9B" in out, out)
    os.remove(os.path.join(k, "models", ".skip-xl"))
    out = run(k, ["offer"], {"LANTERN_AUTO_DOWNLOAD": "1"}, cmd_for(k))
    got = wait_file(os.path.join(k, "models", "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf"))
    ok(label + ": yes downloads the 35B-A3B through the redirect", got, out)
    time.sleep(1)
    out = run(k, ["check"], cmd=cmd_for(k))
    ok(label + ": then nothing more is offered", "already has Qwen3.5 35B-A3B" in out, out)
    out = run(k, ["offer"], {"LANTERN_AUTO_DOWNLOAD": "0", "LANTERN_MEM_MB": "8000"}, cmd_for(k))
    ok(label + ": AUTO_DOWNLOAD=0 is silent", out.strip() == "", out)

suite("sh", lambda k: [os.path.join(k, "setup-kit.sh")])
pw = os.environ.get("PWSH") or shutil.which("pwsh")
if pw: suite("ps1", lambda k: [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")])
else: print("(PowerShell not installed: setup-kit.ps1 not run)")

# start-lantern.sh picks the best model for the memory, never the biggest on a small computer
k = make_kit("pick", ["Qwen3.5-35B-A3B-UD-IQ4_XS.gguf", "Qwen3.5-9B-Q4_K_M.gguf", "Qwen3.5-4B-Q4_K_M.gguf"])
for mem, want in (("32000", "35B-A3B"), ("16000", "9B"), ("8000", "4B"), ("4000", "4B")):
    out = run(k, ["nodownload"], {"LANTERN_MEM_MB": mem}, [os.path.join(k, "start-lantern.sh")])
    ok("start-lantern %s MB uses the %s" % (mem, want), "FAKE model=Qwen3.5-%s" % want in out, out)
out = run(k, ["9b"], {}, [os.path.join(k, "start-lantern.sh")])
ok("start-lantern 9b picks by hand", "FAKE model=Qwen3.5-9B" in out, out)
srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print("KIT OFFER TESTS PASS" if not fails else "%d KIT OFFER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
