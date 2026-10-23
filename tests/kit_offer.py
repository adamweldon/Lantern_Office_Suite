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
    open(os.path.join(d, "mmproj-F16.gguf"), "wb").write(b"GGUF" + os.urandom(1000))   # the model's vision part
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
mm = sys.argv[sys.argv.index("--mmproj") + 1].replace(chr(92), "/").split("/")[-1] if "--mmproj" in sys.argv else "none"
print("FAKE model=" + m.replace(chr(92), "/").split("/")[-1] + " mmproj=" + mm, flush=True)
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
    ok(label + ": then no other model is offered", "will offer Qwen3.5" not in out and "will offer the encyclopedia" in out, out)
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
# 1.12.8: the browser opens as soon as the server answers, and the page is
# told the model's name and size and when the server started (its progress
# bar while the model loads)
fb = os.path.join(tmp, "fakebin"); os.makedirs(fb, exist_ok=True); opened = os.path.join(tmp, "opened.txt")
open(os.path.join(fb, "xdg-open"), "w").write("#!/bin/sh\necho \"$1\" > '%s'\n" % opened); os.chmod(os.path.join(fb, "xdg-open"), 0o755)
t_before = int(time.time()) * 1000
out = run(k, ["9b"], {"NO_BROWSER": "", "PATH": fb + os.pathsep + os.environ.get("PATH", "")}, [os.path.join(k, "start-lantern.sh")])
url = open(opened).read().strip() if wait_file(opened, 5) else ""
q = dict(x.split("=", 1) for x in url.split("?", 1)[-1].split("&")) if "?" in url else {}
ok("start-lantern opens Lantern with the model's name, size and start time", url.startswith("http://127.0.0.1:") and q.get("kit") == "1" and
   q.get("model") == "Qwen3.5-9B-Q4_K_M.gguf" and q.get("bytes") == "4004" and q.get("vbytes") == "0" and t_before - 2000 <= int(q.get("t", "0")) <= t_before + 60000, url)
ok("start-lantern says the model takes a while and the page shows a progress bar", "shows a progress bar" in out and "Keep this window open" in out, out)
bat = open(os.path.join(ROOT, "kit", "start-lantern.bat")).read()
ok("start-lantern.bat passes the same hints, opening as soon as the server listens", "?kit=1&model=!MNAME!&bytes=!MBYTES!&vbytes=!VBYTES!&t=" in bat and
   "TcpClient" in bat and "timeout /t 8" not in bat, "")
# --- the offline library: kiwix-tools + a Kiwix file, from a stand-in for
# download.kiwix.org (plain directory listings, as its mirrors serve them)
import hashlib, io, tarfile, zipfile
kx = os.path.join(tmp, "kiwix"); rel = os.path.join(kx, "release", "kiwix-tools"); zw = os.path.join(kx, "zim", "wikipedia")
os.makedirs(rel); os.makedirs(zw)
fake_kiwix = "#!" + sys.executable + "\nimport sys, os, time\nopen(os.environ.get('KIWIX_ARGS_OUT', '/dev/null'), 'w').write(' '.join(sys.argv[1:]))\ntime.sleep(20)\n"
for ver in ("3.7.0-2", "3.8.1"):
    with tarfile.open(os.path.join(rel, "kiwix-tools_linux-x86_64-%s.tar.gz" % ver), "w:gz") as t:
        data = fake_kiwix.encode() if ver == "3.8.1" else b"#!/bin/sh\necho OLD\n"
        ti = tarfile.TarInfo("kiwix-tools_linux-x86_64-%s/kiwix-serve" % ver); ti.size = len(data); ti.mode = 0o755
        t.addfile(ti, io.BytesIO(data))
    with zipfile.ZipFile(os.path.join(rel, "kiwix-tools_win-x86_64-%s.zip" % ver), "w") as z:
        z.writestr("kiwix-tools_win-x86_64-%s/kiwix-serve.exe" % ver, "MZ" + ver)
def zim(name, good=True):
    data = b"ZIM\x04" + os.urandom(3000)
    open(os.path.join(zw, name), "wb").write(data)
    h = hashlib.sha256(data if good else b"other").hexdigest()
    open(os.path.join(zw, name + ".sha256"), "w").write(h + "  " + name + "\n")
zim("wikipedia_en_all_mini_2026-03.zim"); zim("wikipedia_en_all_mini_2026-06.zim"); zim("wikipedia_en_simple_all_maxi_2026-01.zim")
zim("wikipedia_en_medicine_maxi_2026-05.zim", good=False)
zim("wikipedia_en_all_nopic_2026-06.zim"); zim("wikipedia_en_all_nopic_2026-09.zim")
# This folder's listing uses absolute links, as some mirrors do.
open(os.path.join(zw, "index.html"), "w").write("<html><body>" + "".join(
    '<a href="/zim/wikipedia/%s">%s</a><br>' % (f, f) for f in sorted(os.listdir(zw)) if f != "index.html") + "</body></html>")
# llama.cpp release stand-ins, for a whole setup run
lr = os.path.join(kx, "llama"); os.makedirs(lr)
with tarfile.open(os.path.join(lr, "llama-b11435-bin-ubuntu-x64.tar.gz"), "w:gz") as t:
    data = b"#!/bin/sh\necho llama\n"; ti = tarfile.TarInfo("build/bin/llama-server"); ti.size = len(data); ti.mode = 0o755
    t.addfile(ti, io.BytesIO(data))
with zipfile.ZipFile(os.path.join(lr, "llama-b11435-bin-win-cpu-x64.zip"), "w") as z:
    z.writestr("llama-server.exe", "MZ llama")
kport = free_port()
ksrv = subprocess.Popen([sys.executable, "-m", "http.server", str(kport), "--bind", "127.0.0.1", "--directory", kx],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
KX = {"KIWIX_BASE": "http://127.0.0.1:%d" % kport}
def kenv(extra=None):
    e = dict(KX); e.update(extra or {}); return e

k = make_kit("lib-sh", ["Qwen3.5-4B-Q4_K_M.gguf"])
out = run(k, ["library"], kenv({"LANTERN_FREE_GB": "50"}))
ks = os.path.join(k, "engine", "linux", "kiwix", "kiwix-serve")
ok("library: newest kiwix-tools installed", os.path.exists(ks) and "OLD" not in open(ks).read() and "3.8.1" in out, out)
ok("library: newest English Wikipedia file, checksum checked", os.path.exists(os.path.join(k, "library", "wikipedia_en_all_mini_2026-06.zim")) and
   not os.path.exists(os.path.join(k, "library", "wikipedia_en_all_mini_2026-03.zim")) and "checksum OK" in out, out)
out = run(k, ["check"], kenv({"LANTERN_MEM_MB": "8000"}))
ok("check lists the library", "Library: wikipedia_en_all_mini_2026-06.zim" in out and "kiwix-serve missing" not in out, out)
out = run(k, ["zim", "wikipedia_en_medicine_maxi"], kenv())
ok("zim NAME: a damaged file is deleted, not kept", "damaged" in out and not os.path.exists(os.path.join(k, "library", "wikipedia_en_medicine_maxi_2026-05.zim")), out)
argsf = os.path.join(tmp, "kiwix-args.txt")
out = run(k, ["nodownload"], {"LANTERN_MEM_MB": "8000", "KIWIX_ARGS_OUT": argsf}, [os.path.join(k, "start-lantern.sh")])
time.sleep(0.5)
got = open(argsf).read() if os.path.exists(argsf) else ""
ok("start-lantern starts kiwix-serve on 8081 with the library", "--port 8081 --address 127.0.0.1 -z " in got and got.endswith("wikipedia_en_all_mini_2026-06.zim") and
   "Library: wikipedia_en_all_mini_2026-06.zim" in out, (got, out))
out = run(k, ["share", "nodownload"], {"LANTERN_MEM_MB": "8000", "KIWIX_ARGS_OUT": argsf}, [os.path.join(k, "start-lantern.sh")])
time.sleep(0.5)
ok("share: the library listens for phones too", "--address 0.0.0.0" in open(argsf).read())

k = make_kit("lib-fat", ["Qwen3.5-4B-Q4_K_M.gguf"])
out = run(k, ["library"], kenv({"LANTERN_FS": "msdos"}))
ok("library on FAT32: Simple English instead (under 4 GB)", os.path.exists(os.path.join(k, "library", "wikipedia_en_simple_all_maxi_2026-01.zim")), out)
k = make_kit("lib-offer", ["Qwen3.5-4B-Q4_K_M.gguf"])
out = run(k, ["check"], kenv({"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "50"}))
ok("with the right model, the next start offers the encyclopedia", "will offer the encyclopedia (English Wikipedia" in out, out)
out = run(k, ["offer"], kenv({"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "50"}))
ok("library offer with no keyboard downloads nothing", "offline encyclopedia" in out and "no keyboard" in out and not os.path.exists(os.path.join(k, "library")), out)
out = run(k, ["offer"], kenv({"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "50", "LANTERN_AUTO_DOWNLOAD": "1"}))
ok("library offer yes: downloads in the background", wait_file(os.path.join(k, "library", "wikipedia_en_all_mini_2026-06.zim")), out)
time.sleep(1)
ok("then the library is not offered again", "library: the kit has a library" in run(k, ["check"], kenv({"LANTERN_MEM_MB": "8000"})))

# --- vision (1.9.5): the model's mmproj, loaded by start-lantern ---
k = make_kit("vision", ["Qwen3.5-4B-Q4_K_M.gguf"])
out = run(k, ["check"], {"LANTERN_MEM_MB": "8000"})
ok("check: a model without its vision part says how to get it", "no vision part (./setup-kit.sh vision)" in out, out)
out = run(k, ["vision"])
ok("setup-kit vision fetches the 4B's vision part", os.path.exists(os.path.join(k, "models", "mmproj-Qwen3.5-4B-F16.gguf")) and
   not os.path.exists(os.path.join(k, "models", "mmproj-Qwen3.5-35B-A3B-F16.gguf")), out)
ok("check: then it sees images", "sees images" in run(k, ["check"], {"LANTERN_MEM_MB": "8000"}))
out = run(k, ["nodownload"], {"LANTERN_MEM_MB": "8000"}, [os.path.join(k, "start-lantern.sh")])
ok("start-lantern loads the vision part with its model", "mmproj=mmproj-Qwen3.5-4B-F16.gguf" in out and "Vision: mmproj-Qwen3.5-4B-F16.gguf" in out, out)
shutil.copy(os.path.join(mirror, "unsloth", "Qwen3.5-35B-A3B-GGUF", "resolve", "main", "mmproj-F16.gguf"), os.path.join(k, "models", "mmproj-Qwen3.5-35B-A3B-F16.gguf"))
out = run(k, ["nodownload"], {"LANTERN_MEM_MB": "8000"}, [os.path.join(k, "start-lantern.sh")])
ok("a vision part for another model is not loaded with this one", "mmproj=mmproj-Qwen3.5-4B-F16.gguf" in out, out)
out = run(k, ["novision", "nodownload"], {"LANTERN_MEM_MB": "8000"}, [os.path.join(k, "start-lantern.sh")])
ok("novision starts without it", "mmproj=none" in out and "Vision:" not in out, out)
if pw:
    k = make_kit("vision-ps1", ["Qwen3.5-4B-Q4_K_M.gguf"])
    out = run(k, ["vision"], None, [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")])
    ok("ps1 vision fetches the 4B's vision part", os.path.exists(os.path.join(k, "models", "mmproj-Qwen3.5-4B-F16.gguf")), out)
    out = run(k, ["check"], {"LANTERN_MEM_MB": "8000"}, [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")])
    ok("ps1 check: sees images", "sees images" in out, out)

# --- the full Wikipedia (1.9.4): opt-in only, after the small one ---
k = make_kit("lib-full", ["Qwen3.5-4B-Q4_K_M.gguf"])
os.makedirs(os.path.join(k, "library")); shutil.copy(os.path.join(zw, "wikipedia_en_all_mini_2026-06.zim"), os.path.join(k, "library"))
out = run(k, ["check"], kenv({"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "50"}))
ok("check: the full Wikipedia is named, with room", "Full Wikipedia: not in the kit; about" in out and "library-full" in out, out)
out = run(k, ["offer"], kenv({"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "50", "LANTERN_AUTO_DOWNLOAD": "1"}))
time.sleep(1)
ok("the full Wikipedia is never downloaded unasked", not [f for f in os.listdir(os.path.join(k, "library")) if "nopic" in f], out)
out = run(k, ["offer"], kenv({"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "50"}))
ok("offer with no keyboard: mentions it, downloads nothing", "FULL English Wikipedia" in out and "no keyboard" in out and
   not [f for f in os.listdir(os.path.join(k, "library")) if "nopic" in f], out)
out = run(k, ["library-full"], kenv({"LANTERN_FREE_GB": "0.5"}))
ok("library-full: no room is said, nothing fetched", "would not fit" in out and not [f for f in os.listdir(os.path.join(k, "library")) if "nopic" in f], out)
out = run(k, ["library-full"], kenv({"LANTERN_FREE_GB": "50"}))
ok("library-full: the newest full file, checksum checked, next to the small one", os.path.exists(os.path.join(k, "library", "wikipedia_en_all_nopic_2026-09.zim")) and
   not os.path.exists(os.path.join(k, "library", "wikipedia_en_all_nopic_2026-06.zim")) and "checksum OK" in out and
   os.path.exists(os.path.join(k, "library", "wikipedia_en_all_mini_2026-06.zim")), out)
out = run(k, ["check"], kenv({"LANTERN_MEM_MB": "8000"}))
ok("check lists both files and offers nothing more", "Library: wikipedia_en_all_nopic_2026-09.zim" in out and "Full Wikipedia: not in" not in out, out)
out = run(k, ["nodownload"], {"LANTERN_MEM_MB": "8000", "KIWIX_ARGS_OUT": argsf}, [os.path.join(k, "start-lantern.sh")])
time.sleep(0.5)
got = open(argsf).read() if os.path.exists(argsf) else ""
ok("start-lantern serves both files", "wikipedia_en_all_mini_2026-06.zim" in got and "wikipedia_en_all_nopic_2026-09.zim" in got, got)

# One double-click of setup on an empty stick: engine, 4B, the bigger model, the library
LL = {"LLAMA_BASE": "http://127.0.0.1:%d/llama" % kport, "LANTERN_AUTO_DOWNLOAD": "1", "LANTERN_MEM_MB": "32000", "LANTERN_FREE_GB": "60"}
def whole(label, cmd_for, engine_file):
    k = make_kit(label, [])
    shutil.rmtree(os.path.join(k, "engine"))
    out = run(k, [], kenv(LL), cmd_for(k))
    have = lambda *p: os.path.exists(os.path.join(k, *p))
    ok(label + ": one setup run fetches the engine, the 4B, the 35B-A3B and the encyclopedia",
       have(*engine_file) and have("models", "Qwen3.5-4B-Q4_K_M.gguf") and have("models", "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf") and
       have("library", "wikipedia_en_all_mini_2026-06.zim"), out[-1500:])
    ok(label + ": an unattended setup does not fetch the full Wikipedia", not [f for f in os.listdir(os.path.join(k, "library")) if "nopic" in f], out[-800:])
    ok(label + ": each laptop model brings its vision part", have("models", "mmproj-Qwen3.5-4B-F16.gguf") and have("models", "mmproj-Qwen3.5-35B-A3B-F16.gguf"),
       sorted(os.listdir(os.path.join(k, "models"))))
    return k
whole("whole-sh", lambda k: [os.path.join(k, "setup-kit.sh")], ("engine", "linux", "llama-server"))
if pw:
    whole("whole-ps1", lambda k: [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")], ("engine", "windows", "llama-server.exe"))

if pw:
    k = make_kit("lib-ps1", ["Qwen3.5-4B-Q4_K_M.gguf"])
    out = run(k, ["library"], kenv({"LANTERN_FREE_GB": "50"}), [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")])
    exe = [os.path.join(r, f) for r, ds, fs in os.walk(os.path.join(k)) for f in fs if f == "kiwix-serve.exe"]
    ok("ps1 library: newest Windows kiwix-tools and the newest file, checked", exe and "3.8.1" in open(exe[0]).read() and
       os.path.exists(os.path.join(k, "library", "wikipedia_en_all_mini_2026-06.zim")) and "checksum OK" in out, out)
    out = run(k, ["zim", "wikipedia_en_medicine_maxi"], kenv(), [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")])
    ok("ps1 zim NAME: a damaged file is deleted", "damaged" in out and not os.path.exists(os.path.join(k, "library", "wikipedia_en_medicine_maxi_2026-05.zim")), out)
    out = run(k, ["check"], kenv({"LANTERN_MEM_MB": "8000"}), [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")])
    ok("ps1 check lists the library", "Library: wikipedia_en_all_mini_2026-06.zim" in out, out)
    ok("ps1 check: the full Wikipedia is named", "Full Wikipedia: not in the kit; about" in out and "library-full" in out, out)
    ps1 = [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")]
    out = run(k, ["offer"], kenv({"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "50", "LANTERN_AUTO_DOWNLOAD": "1"}), ps1)
    ok("ps1: the full Wikipedia is never downloaded unasked", not [f for f in os.listdir(os.path.join(k, "library")) if "nopic" in f], out)
    out = run(k, ["library-full"], kenv({"LANTERN_FREE_GB": "0.5"}), ps1)
    ok("ps1 library-full: no room is said, nothing fetched", "would not fit" in out and not [f for f in os.listdir(os.path.join(k, "library")) if "nopic" in f], out)
    out = run(k, ["library-full"], kenv({"LANTERN_FREE_GB": "50"}), ps1)
    ok("ps1 library-full: the newest full file, checksum checked", os.path.exists(os.path.join(k, "library", "wikipedia_en_all_nopic_2026-09.zim")) and
       "checksum OK" in out, out)
ksrv.terminate()
srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print("KIT OFFER TESTS PASS" if not fails else "%d KIT OFFER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
