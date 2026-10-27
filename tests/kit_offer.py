# kit_offer.py -- the kit's "bigger model" offer and model choice, end to end
# against a stand-in for Hugging Face (tests/fixtures/hfsim.py), with a fake
# llama-server. Runs setup-kit.sh / start-lantern.sh, and setup-kit.ps1 too
# when PowerShell (pwsh, or $PWSH) is installed. Memory, drive format and
# free space are pretended with LANTERN_MEM_MB / LANTERN_FS / LANTERN_FREE_GB.
import http.server, os, shutil, socket, subprocess, sys, tempfile, threading, time
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
if "--version" in sys.argv: print("version: fake"); sys.exit(0)   # setup's check that the engine starts
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
if pw:   # "Install Lantern (Windows).bat" sets LANTERN_POPUP=1; with no message box (not Windows) the window asks
    k = make_kit("ps1-popup", ["Qwen3.5-4B-Q4_K_M.gguf"])
    out = run(k, ["offer"], {"LANTERN_POPUP": "1"}, [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")])
    ok("ps1 popup: no message box here, so the question is asked in the window", "no keyboard" in out and "answered in the popup" not in out, out)

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
# 1.14.0 shelves: WikiMed beside Wikipedia, the others in their own folders, and
# iFixit only under "other" (Kiwix files some books there: find_zim looks)
zim("wikipedia_en_medicine_nopic_2026-04.zim")
def zim_in(folder, name):
    d = os.path.join(kx, "zim", folder); os.makedirs(d, exist_ok=True)
    data = b"ZIM\x04" + os.urandom(2000)
    open(os.path.join(d, name), "wb").write(data)
    open(os.path.join(d, name + ".sha256"), "w").write(hashlib.sha256(data).hexdigest() + "  " + name + "\n")
zim_in("other", "ifixit_en_all_2026-02.zim"); zim_in("wikivoyage", "wikivoyage_en_all_nopic_2026-07.zim")
zim_in("phet", "phet_en_all_2026-01.zim"); zim_in("wikibooks", "wikibooks_en_all_nopic_2026-03.zim")
# This folder's listing uses absolute links, as some mirrors do.
open(os.path.join(zw, "index.html"), "w").write("<html><body>" + "".join(
    '<a href="/zim/wikipedia/%s">%s</a><br>' % (f, f) for f in sorted(os.listdir(zw)) if f != "index.html") + "</body></html>")
# llama.cpp release stand-ins, for a whole setup run
lr = os.path.join(kx, "llama"); os.makedirs(lr)
for arch in ("x64", "arm64"):   # arm64: the tests also run on a Raspberry Pi
    with tarfile.open(os.path.join(lr, "llama-b11435-bin-ubuntu-%s.tar.gz" % arch), "w:gz") as t:
        data = b"#!/bin/sh\necho llama\n"; ti = tarfile.TarInfo("build/bin/llama-server"); ti.size = len(data); ti.mode = 0o755
        t.addfile(ti, io.BytesIO(data))
        lib = b"\x7fELF fake library"; ti = tarfile.TarInfo("build/bin/libllama.so.0.6.0"); ti.size = len(lib); t.addfile(ti, io.BytesIO(lib))
        ti = tarfile.TarInfo("build/bin/libllama.so.0"); ti.type = tarfile.SYMTYPE; ti.linkname = "libllama.so.0.6.0"; t.addfile(ti)
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
    # (1.14.0: the shelves' books are "nopic" too, and an unattended setup takes them -- only the full Wikipedia is opt-in)
    ok(label + ": an unattended setup does not fetch the full Wikipedia", not [f for f in os.listdir(os.path.join(k, "library")) if f.startswith("wikipedia_en_all_nopic")], out[-800:])
    ok(label + ": ...but it takes the practical shelf", have("library", "ifixit_en_all_2026-02.zim") and have("library", "wikipedia_en_medicine_nopic_2026-04.zim"), out[-800:])
    ok(label + ": each laptop model brings its vision part", have("models", "mmproj-Qwen3.5-4B-F16.gguf") and have("models", "mmproj-Qwen3.5-35B-A3B-F16.gguf"),
       sorted(os.listdir(os.path.join(k, "models"))))
    return k
k = whole("whole-sh", lambda k: [os.path.join(k, "setup-kit.sh")], ("engine", "linux", "llama-server"))
lib = os.path.join(k, "engine", "linux", "libllama.so.0")
ok("whole-sh: the engine's library symlinks arrive as plain files (exFAT sticks hold no symlinks)", os.path.isfile(lib) and not os.path.islink(lib), "")
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
# --- the double-click installer (1.13.1): its window asks the questions ---
# LANTERN_UI=1: questions go out as @@ lines, the window's buttons answer on stdin
def run_in(kit, args, answers, env=None, cmd=None):
    e = dict(os.environ); e.update({"HF_BASE": HF, "LANTERN_MEM_MB": "32000", "NO_BROWSER": "1", "LANTERN_NO_PAUSE": "1",
      "PORT": str(free_port()), "NO_PROXY": "127.0.0.1", "no_proxy": "127.0.0.1"}); e.update(env or {})
    r = subprocess.run((cmd or [os.path.join(kit, "setup-kit.sh")]) + args, cwd=kit, env=e, input=answers,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=300)
    return r.stdout, r.returncode
UI = {"LANTERN_UI": "1"}
k = make_kit("ui", ["Qwen3.5-4B-Q4_K_M.gguf"])
out, rc = run_in(k, ["offer"], "n\n", UI)
ok("ui: the question goes to the window, title and words", "@@ASK ask A stronger AI model" in out and
   "@@Q   This computer has 31 GB of memory: it can run Qwen3.5 35B-A3B" in out and "@@END" in out and "no keyboard" not in out, out)
ok("ui: No is remembered", os.path.exists(os.path.join(k, "models", ".skip-xl")), out)
out, rc = run_in(k, ["offer"], "\n", UI)
ok("ui: Not now downloads nothing and remembers nothing", "it can run Qwen3.5 9B" in out and
   not os.path.exists(os.path.join(k, "models", ".skip-big")) and not os.path.exists(os.path.join(k, "models", "Qwen3.5-9B-Q4_K_M.gguf")), out)
out, rc = run_in(k, ["offer"], "y\n", UI)
ok("ui: Yes downloads it", wait_file(os.path.join(k, "models", "Qwen3.5-9B-Q4_K_M.gguf")), out)
out, rc = run_in(k, ["info"], "", {"LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "40"})
info = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
ok("info: facts for the window", info.get("mem_mb") == "8000" and info.get("free_gb") == "40" and info.get("base") == "Qwen3.5 4B" and
   info.get("have_base") == "1" and info.get("engine") == "ok" and info.get("os") == "linux", out)
# One setup run as the window drives it: steps, files and curl's meter
k = make_kit("ui-whole", [])
shutil.rmtree(os.path.join(k, "engine"))
out, rc = run_in(k, [], "y\ny\nn\n", kenv({"LLAMA_BASE": LL["LLAMA_BASE"], "LANTERN_MEM_MB": "32000", "LANTERN_FREE_GB": "60", "LANTERN_UI": "1"}))
have = lambda *p: os.path.exists(os.path.join(k, *p))
ok("ui setup: steps, files and the download meter for the window", rc == 0 and "@@STEP engine" in out and "@@STEP model" in out and
   "@@GET Qwen3.5-4B-Q4_K_M.gguf" in out and "% Total" in out and "the engine starts on this computer" in out and out.rstrip().endswith("start-lantern.bat on Windows).") and
   "@@DONE" in out, out[-1500:])
ok("ui setup: yes to the 35B and the encyclopedia, no to the full Wikipedia", have("models", "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf") and
   have("library", "wikipedia_en_all_mini_2026-06.zim") and have("models", ".skip-library-full") and "@@ASK optin The full Wikipedia" in out, out[-1500:])
# Popups straight from the script (LANTERN_POPUP), here a stand-in zenity
zb = os.path.join(tmp, "zenitybin"); os.makedirs(zb); zlog = os.path.join(tmp, "zenity-calls.txt")
def fake_zenity(*replies):   # one (printed, exit code) per call; the last one repeats
    calls = os.path.join(tmp, "zenity-n.txt"); open(calls, "w").write("0")
    body = "#!/bin/sh\nn=$(cat '%s'); echo $((n + 1)) > '%s'\nprintf '%%s\\n' \"$@\" '--' >> '%s'\n" % (calls, calls, zlog)
    for i, (text, code) in enumerate(replies):
        cond = "[ $n -ge %d ]" % i if i == len(replies) - 1 else "[ $n -eq %d ]" % i
        body += "if %s; then cat <<'EOF'\n%s\nEOF\nexit %d; fi\n" % (cond, text, code)
    open(os.path.join(zb, "zenity"), "w").write(body); os.chmod(os.path.join(zb, "zenity"), 0o755)
    open(zlog, "w").close()
ZEN = {"LANTERN_POPUP": "zenity", "PATH": zb + os.pathsep + os.environ.get("PATH", "")}
k = make_kit("popup", ["Qwen3.5-4B-Q4_K_M.gguf"])
fake_zenity(("No, don't ask again", 1), ("", 1))
out, rc = run_in(k, ["offer"], "", ZEN)
za = open(zlog).read()
ok("popup: zenity asks with its own buttons and the question's words", "--extra-button=No, don't ask again" in za and "--no-markup" in za and
   "--title=A stronger AI model" in za and "--text=This computer has 31 GB of memory: it can run Qwen3.5 35B-A3B (17.5 GB download), a stronger model" in za, za)
ok("popup: No is remembered, then Not now on the next model remembers nothing", os.path.exists(os.path.join(k, "models", ".skip-xl")) and
   "it can run Qwen3.5 9B" in za and not os.path.exists(os.path.join(k, "models", ".skip-big")) and "no keyboard" not in out, (za, out))
fake_zenity(("", 0))
out, rc = run_in(k, ["offer"], "", ZEN)
ok("popup: Download it downloads", wait_file(os.path.join(k, "models", "Qwen3.5-9B-Q4_K_M.gguf")), out)
k = make_kit("popup-fallback", ["Qwen3.5-4B-Q4_K_M.gguf"])
fake_zenity(("", 5))
out, rc = run_in(k, ["offer"], "", ZEN)
ok("popup: when the dialog cannot show, the terminal question is the fallback", "no keyboard" in out, out)

# --- an engine that cannot start here (Raspberry Pi OS Bookworm: older glibc) ---
def glibc_kit(name):
    k = make_kit(name, ["Qwen3.5-4B-Q4_K_M.gguf"])
    open(os.path.join(k, "engine", "linux", "llama-server"), "w").write(
        "#!/bin/sh\necho \"./llama-server: /lib/aarch64-linux-gnu/libc.so.6: version \\`GLIBC_2.38' not found (required by ./libllama.so.0)\" >&2\nexit 1\n")
    open(os.path.join(k, "engine", "linux", "libllama.so.0"), "w").write("old")
    os.makedirs(os.path.join(k, "engine", "linux", "kiwix")); open(os.path.join(k, "engine", "linux", "kiwix", "kiwix-serve"), "w").write("keep")
    return k
k = glibc_kit("glibc")
out, rc = run_in(k, ["check"], "", {"LANTERN_MEM_MB": "8000"})
ok("check: an engine that cannot start is said, with the reason and the way out", "Engine: does not start here:" in out and
   "GLIBC_2.38' not found" in out and "build-engine" in out, out)
out, rc = run_in(k, ["engine"], "\n", UI)
ok("ui: an engine that cannot start offers the build; Not now stops setup and says how", rc != 0 and "@@ASK build Build the AI engine on this computer" in out and
   "@@Q   It was made for newer Linux systems" in out and "@@FAIL engine" in out and "./setup-kit.sh build-engine" in out, out)
cc = shutil.which("cc") and shutil.which("c++") and shutil.which("make") and shutil.which("cmake")
if cc:
    src = os.path.join(kx, "src"); os.makedirs(os.path.join(src, "llama.cpp-b11435"))
    open(os.path.join(src, "llama.cpp-b11435", "CMakeLists.txt"), "w").write(
        "cmake_minimum_required(VERSION 3.10)\nproject(fakellama C)\nset(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)\nadd_executable(llama-server server.c)\n")
    open(os.path.join(src, "llama.cpp-b11435", "server.c"), "w").write(
        '#include <stdio.h>\nint main(void) { printf("version: built here\\n"); return 0; }\n')
    with tarfile.open(os.path.join(kx, "llama-src.tar.gz"), "w:gz") as t: t.add(os.path.join(src, "llama.cpp-b11435"), "llama.cpp-b11435")
    BLD = {"LLAMA_SRC": "http://127.0.0.1:%d/llama-src.tar.gz" % kport, "LANTERN_BUILD_DIR": os.path.join(tmp, "build-cache")}
    os.makedirs(BLD["LANTERN_BUILD_DIR"]); open(os.path.join(BLD["LANTERN_BUILD_DIR"], "yours.txt"), "w").write("keep")
    e = dict(UI); e.update(BLD)
    out, rc = run_in(k, ["engine"], "y\n", e)
    eng = os.path.join(k, "engine", "linux")
    ok("ui: Build it builds the engine here, replaces the ready-made one, keeps kiwix", rc == 0 and "@@STEP build" in out and "engine built for this computer" in out and
       "built here" in open(os.path.join(eng, "llama-server"), "rb").read().decode("latin-1") and not os.path.exists(os.path.join(eng, "libllama.so.0")) and
       os.path.exists(os.path.join(eng, "BUILT-HERE.txt")) and open(os.path.join(eng, "kiwix", "kiwix-serve")).read() == "keep" and
       sorted(os.listdir(BLD["LANTERN_BUILD_DIR"])) == ["yours.txt"], out[-1500:])   # it clears only what it made
    shutil.rmtree(BLD["LANTERN_BUILD_DIR"])
    out, rc = run_in(k, ["check"], "", {"LANTERN_MEM_MB": "8000"})
    ok("check: then the engine starts (built here)", "Engine: llama.cpp starts on this computer (built here)" in out, out)
    k = glibc_kit("glibc-term")
    out, rc = run_in(k, ["build-engine"], "", BLD)
    ok("build-engine from the terminal builds too", rc == 0 and "engine built for this computer" in out, out[-1200:])
else:
    print("(no C compiler or cmake here: the engine build was not tried)")

# --- a download that breaks off is not kept as whole: setup fails, and the next run carries on
import platform
blob = b"GGUF" + os.urandom(3 << 20)
drop = {"on": True, "ranges": []}
class Drop(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        start = 0
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes="): start = int(rng[6:].split("-")[0] or 0)
        drop["ranges"].append(start)
        body = blob[start:]
        self.send_response(206 if start else 200)
        if start: self.send_header("Content-Range", "bytes %d-%d/%d" % (start, len(blob) - 1, len(blob)))
        self.send_header("Content-Length", str(len(body))); self.end_headers()
        self.wfile.write(body[:len(body) // 3] if drop["on"] else body)   # on: the line drops a third of the way in
dport = free_port()
dsrv = http.server.ThreadingHTTPServer(("127.0.0.1", dport), Drop)
threading.Thread(target=dsrv.serve_forever, daemon=True).start()
DROPHF = "http://127.0.0.1:%d/hf" % dport
k = make_kit("drop", [])
out, rc = run_in(k, ["laptop"], "", {"HF_BASE": DROPHF, "LANTERN_MEM_MB": "8000"})
f = os.path.join(k, "models", "Qwen3.5-4B-Q4_K_M.gguf")
ok("a download that breaks off: tried again from where it stopped, then setup fails and keeps the part",
   rc != 0 and not os.path.exists(f) and os.path.exists(f + ".part") and "broke off" in out and len(drop["ranges"]) == 3 and
   drop["ranges"][1] > 0, (rc, drop["ranges"], out[-800:]))
drop["on"] = False
out, rc = run_in(k, ["laptop"], "", {"HF_BASE": DROPHF, "LANTERN_MEM_MB": "8000"})
ok("the next run carries on and the file is whole", rc == 0 and os.path.exists(f) and open(f, "rb").read() == blob and
   drop["ranges"][-2] > 0, (rc, drop["ranges"][-3:], out[-600:]))
dsrv.shutdown()

# --- a stick shared by computers with different CPUs: each keeps its own engine
other = b"\x3e\x00" if platform.machine().lower() in ("aarch64", "arm64") else b"\xb7\x00"   # x86-64 on a Pi, arm64 elsewhere
k = make_kit("mixed-cpu", ["Qwen3.5-4B-Q4_K_M.gguf"])
theirs = os.path.join(k, "engine", "linux", "llama-server")
open(theirs, "wb").write(b"\x7fELF\x02\x01\x01" + b"\x00" * 11 + other + b"\x00" * 64)
out, rc = run_in(k, ["engine"], "", {"LLAMA_BASE": LL["LLAMA_BASE"]})
mine = os.path.join(k, "engine", "linux-" + platform.machine())
ok("mixed CPUs: this computer's engine goes in engine/linux-<cpu>, the other one stays", rc == 0 and
   os.path.exists(os.path.join(mine, "llama-server")) and open(theirs, "rb").read(4) == b"\x7fELF", (rc, out[-600:]))
out, rc = run_in(k, ["check"], "", {"LANTERN_MEM_MB": "8000"})
ok("mixed CPUs: check names the folder", "(engine/linux-%s)" % platform.machine() in out, out)
shutil.copy(os.path.join(k, "engine", "linux", "llama-server"), os.path.join(tmp, "elf-stub"))
fake_src = os.path.join(tmp, "pick", "engine", "linux", "llama-server")
shutil.copy(fake_src, os.path.join(mine, "llama-server"))
out = run(k, ["nodownload"], {"LANTERN_MEM_MB": "8000"}, [os.path.join(k, "start-lantern.sh")])
ok("mixed CPUs: start-lantern runs this computer's engine", "FAKE model=Qwen3.5-4B" in out, out)

# --- Lantern itself (1.13.1): fetched from GitHub when the kit has none ---
# Stand-ins for GitHub's archives of the main branch: Lantern_Office_Suite-main/{site,package.json}
def lantern_archives(version):
    d = os.path.join(kx, "lantern"); os.makedirs(d, exist_ok=True)
    files = {"Lantern_Office_Suite-main/site/index.html": '<!doctype html><title>Lantern Office</title><script>var C = { version: "%s" };</script>v%s' % (version, version),
             "Lantern_Office_Suite-main/Lantern_Office_Suite.html": "<!doctype html><title>Lantern Office</title>one file v" + version,
             "Lantern_Office_Suite-main/site/ai/wllama/x.js": "// engine",
             "Lantern_Office_Suite-main/package.json": '{\n  "name": "lantern-office-suite",\n  "version": "%s",\n  "private": true\n}\n' % version,
             "Lantern_Office_Suite-main/kit/README.txt": "the kit"}
    with tarfile.open(os.path.join(d, "main.tar.gz"), "w:gz") as t:
        for name, text in files.items():
            data = text.encode(); ti = tarfile.TarInfo(name); ti.size = len(data); t.addfile(ti, io.BytesIO(data))
    with zipfile.ZipFile(os.path.join(d, "main.zip"), "w") as z:
        for name, text in files.items(): z.writestr(name, text)
lantern_archives("9.9.1")
LAN = {"LANTERN_SRC": "http://127.0.0.1:%d/lantern/main.tar.gz" % kport, "LANTERN_AUTO_DOWNLOAD": "0", "LANTERN_MEM_MB": "8000"}
DEADLAN = {"LANTERN_SRC": "http://127.0.0.1:%d/lantern/main.tar.gz" % free_port(), "LANTERN_AUTO_DOWNLOAD": "0", "LANTERN_MEM_MB": "8000"}
def no_site(name):
    k = make_kit(name, ["Qwen3.5-4B-Q4_K_M.gguf"]); shutil.rmtree(os.path.join(k, "site")); return k
k = no_site("lantern-sh")
out, rc = run_in(k, ["check"], "", LAN)
ok("check: a kit with no Lantern says so and how to get it", "Lantern: not in the kit (./setup-kit.sh lantern downloads it)" in out, out)
out, rc = run_in(k, ["nodownload"], "", dict(LAN, LANTERN_UI="1"), [os.path.join(k, "start-lantern.sh")])
ok("start-lantern with no Lantern: says so, does not start the engine", rc != 0 and "Lantern itself is not in this folder" in out and
   "@@FAIL nosite" in out and "FAKE model" not in out, out)
out, rc = run_in(k, [], "", dict(DEADLAN, LANTERN_UI="1"))
ok("setup with no internet for Lantern: stops, says what to do, leaves nothing half-done", rc != 0 and "Could not download Lantern" in out and
   "@@FAIL net" in out and not os.path.exists(os.path.join(k, "site")) and not os.path.exists(os.path.join(k, "site.new")), out[-800:])
out, rc = run_in(k, [], "", dict(LAN, LANTERN_UI="1"))
site = os.path.join(k, "site")
ok("setup fetches Lantern itself first, into the kit", rc == 0 and out.index("@@STEP lantern") < out.index("@@STEP engine") and
   "Lantern 9.9.1 is in place (%s)" % site in out and open(os.path.join(site, "index.html")).read().endswith("v9.9.1") and
   os.path.exists(os.path.join(site, "ai", "wllama", "x.js")) and open(os.path.join(site, "lantern-version.txt")).read().startswith("9.9.1 (from"), out[-800:])
out, rc = run_in(k, [], "", DEADLAN)
ok("setup again: Lantern is there, nothing fetched", rc == 0 and "have Lantern 9.9.1 (" in out, out[-600:])
out = run(k, ["nodownload"], {"LANTERN_MEM_MB": "8000"}, [os.path.join(k, "start-lantern.sh")])
ok("start-lantern then serves the kit's Lantern", "FAKE model=Qwen3.5-4B" in out, out)
lantern_archives("9.9.2")
out, rc = run_in(k, ["lantern"], "", LAN)
ok("setup-kit lantern updates it to the newest", rc == 0 and open(os.path.join(site, "index.html")).read().endswith("v9.9.2") and
   not os.path.exists(os.path.join(k, "site.old")), out[-600:])
out, rc = run_in(k, ["lantern"], "", DEADLAN)
ok("an update that cannot download keeps the Lantern in use", rc != 0 and open(os.path.join(site, "index.html")).read().endswith("v9.9.2"), out[-600:])
# The zip from GitHub: kit/ beside the repository's site/ -- used as it is, nothing fetched
repo = os.path.join(tmp, "repo-layout"); os.makedirs(os.path.join(repo, "site"))
open(os.path.join(repo, "site", "index.html"), "w").write("<title>Lantern</title>")
open(os.path.join(repo, "package.json"), "w").write('{ "version": "1.13.1" }')
rk = make_kit("repo-kit", ["Qwen3.5-4B-Q4_K_M.gguf"]); shutil.rmtree(os.path.join(rk, "site")); shutil.move(rk, os.path.join(repo, "kit")); rk = os.path.join(repo, "kit")
out, rc = run_in(rk, [], "", DEADLAN)
ok("the repository's own site/ is used: no download", rc == 0 and "have Lantern 1.13.1 (%s)" % os.path.join(repo, "site") in out and
   not os.path.exists(os.path.join(rk, "site")), out[-600:])
out, rc = run_in(rk, ["info"], "", LAN)
ok("info: Lantern's place for the window", "have_site=1" in out and ("site=" + os.path.join(repo, "site")) in out, out)
if pw:
    ps1 = lambda k: [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")]
    WLAN = dict(LAN, LANTERN_SRC="http://127.0.0.1:%d/lantern/main.zip" % kport)
    k = no_site("lantern-ps1")
    os.makedirs(os.path.join(k, "engine", "windows")); open(os.path.join(k, "engine", "windows", "llama-server.exe"), "w").write("MZ")
    out = run(k, ["check"], WLAN, ps1(k))
    ok("ps1 check: no Lantern is said", "Lantern: not in the kit (setup-kit.bat lantern downloads it)" in out, out)
    out = run(k, [], dict(WLAN, LANTERN_SRC=DEADLAN["LANTERN_SRC"].replace(".tar.gz", ".zip")), ps1(k))
    ok("ps1: no internet for Lantern stops setup with what to do", "Could not download Lantern" in out and not os.path.exists(os.path.join(k, "site")), out[-800:])
    out = run(k, [], WLAN, ps1(k))
    ok("ps1 setup fetches Lantern itself into the kit", "Lantern 9.9.2 is in place" in out and
       open(os.path.join(k, "site", "index.html")).read().endswith("v9.9.2") and os.path.exists(os.path.join(k, "site", "ai", "wllama", "x.js")), out[-800:])
    out = run(k, ["check"], WLAN, ps1(k))
    ok("ps1 check: then it names the version", "Lantern: 9.9.2, " in out, out)
    lantern_archives("9.9.3")
    out = run(k, ["lantern"], WLAN, ps1(k))
    ok("ps1 setup-kit lantern updates it", open(os.path.join(k, "site", "index.html")).read().endswith("v9.9.3") and
       not os.path.exists(os.path.join(k, "site.old")), out[-600:])
    out = run(rk, [], dict(WLAN, LANTERN_SRC="http://127.0.0.1:%d/x.zip" % free_port()), ps1(rk) if os.path.exists(os.path.join(rk, "setup-kit.ps1")) else None)
    ok("ps1: the repository's own site/ is used", "have Lantern 1.13.1" in out, out[-600:])
# --- 1.14.0: the shelves -- more free Kiwix books for the AI to read ---
k = make_kit("shelves-sh", ["Qwen3.5-4B-Q4_K_M.gguf"])
os.makedirs(os.path.join(k, "library")); shutil.copy(os.path.join(zw, "wikipedia_en_all_mini_2026-06.zim"), os.path.join(k, "library"))
out = run(k, ["check"], kenv())
ok("check lists the shelves the kit lacks, and how to get each", "Shelf: WikiMed, Wikipedia's medicine articles -- not in the kit (./setup-kit.sh shelf-medicine" in out and
   "Shelf: iFixit repair guides -- not in the kit" in out, out)
out = run(k, ["shelves"], kenv())
lib = lambda n: os.path.exists(os.path.join(k, "library", n))
ok("shelves: the practical four, newest of each, checksums checked", lib("wikipedia_en_medicine_nopic_2026-04.zim") and lib("wikivoyage_en_all_nopic_2026-07.zim") and
   lib("phet_en_all_2026-01.zim") and "checksum OK" in out and "(CC BY-SA)" in out, out[-1500:])
ok("...iFixit found under \u201cother\u201d, with its licence said", lib("ifixit_en_all_2026-02.zim") and "iFixit repair guides (CC BY-NC-SA: free, not for sale)" in out, out[-1500:])
out = run(k, ["shelves"], kenv())
ok("shelves again: nothing downloaded twice", out.count("have ") >= 4 and "downloading" not in out, out[-800:])
out = run(k, ["shelf-words"], kenv())
ok("a shelf Kiwix does not list just now: said plainly, setup goes on", "the Wiktionary dictionary: no wiktionary_en_all_nopic file listed" in out and "Done." in out, out[-600:])
out = run(k, ["shelf-textbooks"], kenv())
ok("one shelf by name", lib("wikibooks_en_all_nopic_2026-03.zim"), out[-600:])
out = run(k, ["check"], kenv())
ok("check: in the kit now", "Shelf: iFixit repair guides -- in the kit" in out and "Shelf: Wikibooks open textbooks -- in the kit" in out, out)
out = run(k, ["zim", "ifixit_en_all"], kenv())
ok("zim NAME finds a book filed under other too", "have ifixit_en_all_2026-02.zim" in out, out[-600:])
# offered once during setup, after the encyclopedia (the window's question)
k = make_kit("shelves-ui", ["Qwen3.5-4B-Q4_K_M.gguf"])
os.makedirs(os.path.join(k, "library")); shutil.copy(os.path.join(zw, "wikipedia_en_all_mini_2026-06.zim"), os.path.join(k, "library"))
out, rc = run_in(k, [], "n\nn\n", kenv({"LLAMA_BASE": LL["LLAMA_BASE"], "LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "60", "LANTERN_UI": "1"}))
ok("setup asks once about the shelf, as a question for the window; N is remembered", "@@ASK ask More offline books" in out and
   "@@Q   iFixit repair guides, the Wikivoyage travel guide and PhET science simulations," in out and
   os.path.exists(os.path.join(k, "models", ".skip-shelves")) and not lib("ifixit_en_all_2026-02.zim"), out[-2000:])
out, rc = run_in(k, [], "n\n", kenv({"LLAMA_BASE": LL["LLAMA_BASE"], "LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "60", "LANTERN_UI": "1"}))
ok("...and not asked again", "More offline books" not in out, out[-800:])
k = make_kit("shelves-ui-yes", ["Qwen3.5-4B-Q4_K_M.gguf"])
os.makedirs(os.path.join(k, "library")); shutil.copy(os.path.join(zw, "wikipedia_en_all_mini_2026-06.zim"), os.path.join(k, "library"))
out, rc = run_in(k, [], "n\ny\n", kenv({"LLAMA_BASE": LL["LLAMA_BASE"], "LANTERN_MEM_MB": "8000", "LANTERN_FREE_GB": "60", "LANTERN_UI": "1"}))
lib = lambda n: os.path.exists(os.path.join(k, "library", n))
ok("Yes: the four come down in setup, each a step for the window", lib("wikipedia_en_medicine_nopic_2026-04.zim") and lib("ifixit_en_all_2026-02.zim") and
   "@@STEP shelves" in out, out[-2000:])
if pw:
    k = make_kit("shelves-ps1", ["Qwen3.5-4B-Q4_K_M.gguf"])
    os.makedirs(os.path.join(k, "engine", "windows")); open(os.path.join(k, "engine", "windows", "llama-server.exe"), "w").write("MZ")
    os.makedirs(os.path.join(k, "library")); shutil.copy(os.path.join(zw, "wikipedia_en_all_mini_2026-06.zim"), os.path.join(k, "library"))
    ps = lambda k: [pw, "-NoProfile", "-File", os.path.join(k, "setup-kit.ps1")]
    out = run(k, ["shelves"], kenv(), ps(k))
    lib = lambda n: os.path.exists(os.path.join(k, "library", n))
    ok("ps1 shelves: the practical four, iFixit from other", lib("wikipedia_en_medicine_nopic_2026-04.zim") and lib("ifixit_en_all_2026-02.zim") and
       lib("phet_en_all_2026-01.zim") and lib("wikivoyage_en_all_nopic_2026-07.zim"), out[-1500:])
    out = run(k, ["check"], kenv(), ps(k))
    ok("ps1 check lists the shelves", "Shelf: iFixit repair guides -- in the kit" in out and "Shelf: the Wiktionary dictionary -- not in the kit (setup-kit.bat shelf-words" in out, out)
    out = run(k, ["shelf-words"], kenv(), ps(k))
    ok("ps1: a shelf not listed just now is said plainly", "shelf-words did not finish" in out and "Done." in out, out[-600:])

# --- 1.13.2: the Lantern folder (Lantern.zip extracted, or the repository) ---
# Lantern lives in one place, Lantern/site beside kit/. An older copy in kit/site
# used to win, so a newer Lantern laid over the folder never showed (bench run 10).
def lantern_folder(name, kit_site=None, folder_site=None, stale_txt=None):
    L = os.path.join(tmp, name, "Lantern"); os.makedirs(L)
    open(os.path.join(L, "Lantern_Office_Suite.html"), "w").write("one file, old")
    open(os.path.join(L, "Start Lantern (Linux).desktop"), "w").write("[Desktop Entry]")
    k = make_kit(name + "-kit", ["Qwen3.5-4B-Q4_K_M.gguf"]); shutil.rmtree(os.path.join(k, "site"))
    shutil.move(k, os.path.join(L, "kit")); k = os.path.join(L, "kit")
    for where, v in ((os.path.join(k, "site"), kit_site), (os.path.join(L, "site"), folder_site)):
        if v:
            os.makedirs(where); open(os.path.join(where, "index.html"), "w").write('<title>Lantern</title><script>var C = { version: "%s" };</script>' % v)
    if stale_txt: open(os.path.join(L, "site", "lantern-version.txt"), "w").write(stale_txt + " (from GitHub, 2026-10-20)\n")
    return L, k
L, k = lantern_folder("lf-both", kit_site="1.12.9", folder_site="1.13.2", stale_txt="1.12.9")
out, rc = run_in(k, ["check"], "", DEADLAN)
ok("Lantern folder: check names the folder's Lantern, by its own page's version", "Lantern: 1.13.2, %s" % os.path.join(L, "site") in out, out)
out = run(k, ["nodownload"], {"LANTERN_MEM_MB": "8000"}, [os.path.join(k, "start-lantern.sh")])
ok("Lantern folder: start serves the folder's site, says kit/site is a spare copy",
   "Lantern 1.13.2 files: %s" % os.path.join(L, "site") in out and "kit/site is a second copy and is not used" in out and "FAKE model=" in out, out)
L, k = lantern_folder("lf-none")
out, rc = run_in(k, [], "", LAN)
ok("Lantern folder with no Lantern: setup puts it in the folder (site/ and the single file), not in kit/",
   rc == 0 and "is in place (%s)" % os.path.join(L, "site") in out and os.path.exists(os.path.join(L, "site", "index.html")) and
   not os.path.exists(os.path.join(k, "site")) and open(os.path.join(L, "Lantern_Office_Suite.html")).read().startswith("<!doctype") and
   not os.path.exists(os.path.join(L, "site.new")), out[-800:])
L, k = lantern_folder("lf-update", kit_site="1.12.9")
lantern_archives("9.9.4")
out, rc = run_in(k, ["lantern"], "", LAN)
ok("an update for a kit in a Lantern folder lands in the folder: then it is the one used",
   rc == 0 and open(os.path.join(L, "site", "index.html")).read().endswith("v9.9.4"), out[-800:])
out, rc = run_in(k, ["check"], "", DEADLAN)
ok("...and check says so", "Lantern: 9.9.4, %s" % os.path.join(L, "site") in out, out)
if pw:
    L, k = lantern_folder("lf-ps1", kit_site="1.12.9", folder_site="1.13.2", stale_txt="1.12.9")
    os.makedirs(os.path.join(k, "engine", "windows")); open(os.path.join(k, "engine", "windows", "llama-server.exe"), "w").write("MZ")
    out = run(k, ["check"], WLAN, ps1(k))
    ok("ps1 Lantern folder: check names the folder's Lantern, by its own page's version", "Lantern: 1.13.2, " in out and os.path.join(L, "site") in out, out)
    L, k = lantern_folder("lf-ps1-none")
    os.makedirs(os.path.join(k, "engine", "windows")); open(os.path.join(k, "engine", "windows", "llama-server.exe"), "w").write("MZ")
    open(os.path.join(L, "Start Lantern (Windows).bat"), "w").write("@echo off")
    out = run(k, [], WLAN, ps1(k))
    ok("ps1 Lantern folder with no Lantern: it goes in the folder, not kit\\site",
       os.path.exists(os.path.join(L, "site", "index.html")) and not os.path.exists(os.path.join(k, "site")) and
       open(os.path.join(L, "Lantern_Office_Suite.html")).read().startswith("<!doctype"), out[-800:])
bat = open(os.path.join(ROOT, "kit", "start-lantern.bat")).read()
ok("start-lantern.bat looks in the Lantern folder's site first", bat.index('set "SITE=%DIR%..\\site"') < bat.index('set "SITE=%DIR%site"'), "")
bat = open(os.path.join(ROOT, "kit", "start-lantern.bat")).read()
ok("start-lantern.bat stops with a clear message when Lantern is missing", 'if not exist "%SITE%\\index.html" (' in bat and
   "Lantern itself is not in this folder" in bat, "")

ksrv.terminate()
srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
print("KIT OFFER TESTS PASS" if not fails else "%d KIT OFFER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
