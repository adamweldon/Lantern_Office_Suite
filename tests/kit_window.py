# kit_window.py -- the double-click installer's window (kit/lantern-kit.py), end
# to end: Install (engine, model, the questions as popups, shortcuts) and Start
# (loading, ready, share with phones, stop), against stand-ins for Hugging Face,
# GitHub and download.kiwix.org, on a virtual screen (Xvfb). Also the launchers:
# "Install Lantern (Linux).desktop" opened the way Raspberry Pi OS's file
# manager (libfm) and GLib open it. Skips when there is no Tk or no Xvfb.
# KIT_WINDOW_SHOTS=dir saves a screenshot of each page and question there;
# KIT_WINDOW_ON_SCREEN=1 runs it on this desktop instead of Xvfb (it clicks by itself).
import hashlib, http.server, io, os, shutil, socket, subprocess, sys, tarfile, tempfile, threading, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get("KIT_WINDOW_SHOTS", "")
fails = []
def ok(name, cond, info=""):
    if not cond: fails.append(name); print("FAIL", name, str(info)[-900:])
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

def tk_python():
    for py in (sys.executable, "python3", "python3.13", "python3.12", "python3.11", "python3.10", "python3.9"):
        exe = shutil.which(py) if not os.path.isabs(py) else py
        if exe and subprocess.run([exe, "-c", "import tkinter"], stderr=subprocess.DEVNULL).returncode == 0:
            return exe
    return None
PY = tk_python()
XVFB = shutil.which("Xvfb")
ON_SCREEN = os.environ.get("KIT_WINDOW_ON_SCREEN") and os.environ.get("DISPLAY")   # watch it on this desktop instead
if not PY or not (XVFB or ON_SCREEN):
    print("(no Python Tk or no Xvfb here: the kit window was not tried; sudo apt install xvfb, or KIT_WINDOW_ON_SCREEN=1)")
    print("KIT WINDOW TESTS PASS"); sys.exit(0)

tmp = tempfile.mkdtemp(prefix="kit-window-")
xproc = None
if XVFB and not ON_SCREEN:
    disp = ":%d" % (90 + os.getpid() % 500)
    xproc = subprocess.Popen([XVFB, disp, "-screen", "0", "1100x760x24", "-nolisten", "tcp"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    os.environ["DISPLAY"] = disp
shot_n = [0]
def shot(label):
    if not SHOTS or not shutil.which("import"): return
    os.makedirs(SHOTS, exist_ok=True); shot_n[0] += 1
    subprocess.run(["import", "-display", os.environ["DISPLAY"], "-window", "root", os.path.join(SHOTS, "%02d-%s.png" % (shot_n[0], label))],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# --- stand-ins: Hugging Face (302 to a signed link that refuses HEAD), the llama.cpp
# release, kiwix-tools and the Kiwix files; big files come at about 12 MB/s.
web = os.path.join(tmp, "web")
def put(rel, data):
    p = os.path.join(web, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "wb").write(data)
put("hf/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf", b"GGUF" + os.urandom(36 << 20))
put("hf/unsloth/Qwen3.5-4B-GGUF/resolve/main/mmproj-F16.gguf", b"GGUF" + os.urandom(6 << 20))
put("hf/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q4_K_M.gguf", b"GGUF" + os.urandom(4000))
FAKE_SERVER = "#!" + PY + r'''
import sys, time, http.server, os
if "--version" in sys.argv: print("version: stand-in"); sys.exit(0)
a = sys.argv; port = int(a[a.index("--port") + 1]); host = a[a.index("--host") + 1]
open(os.environ.get("FAKE_ARGS_OUT", "/dev/null"), "a").write(" ".join(a[1:]) + "\n")
t0 = time.time()
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *x): pass
    def do_GET(self):
        code = 503 if self.path.startswith("/health") and time.time() - t0 < 3 else 200
        self.send_response(code); self.end_headers(); self.wfile.write(b'{"status":"ok"}')
print("main: server is listening on http://%s:%d" % (host, port), flush=True)
http.server.ThreadingHTTPServer((host, port), H).serve_forever()
'''
def tgz(rel, files):
    b = io.BytesIO()
    with tarfile.open(fileobj=b, mode="w:gz") as t:
        for name, data in files:
            ti = tarfile.TarInfo(name); ti.size = len(data); ti.mode = 0o755; t.addfile(ti, io.BytesIO(data))
    put(rel, b.getvalue())
for arch in ("x64", "arm64"):
    tgz("llama/llama-b11435-bin-ubuntu-%s.tar.gz" % arch, [("build/bin/llama-server", FAKE_SERVER.encode())])
# (it listens on its port, as kiwix-serve does: start-lantern waits for the
# library to answer before it starts the AI model, 1.17.0)
kiwix_fake = ("#!" + PY + "\nimport sys, socket, time\ntry:\n    s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)\n"
              "    s.bind(('127.0.0.1', int(sys.argv[sys.argv.index('--port') + 1]))); s.listen(5)\nexcept Exception:\n    pass\ntime.sleep(3600)\n").encode()
for plat in ("linux-x86_64", "linux-aarch64"):
    tgz("kiwix/release/kiwix-tools/kiwix-tools_%s-3.8.1.tar.gz" % plat, [("kiwix-tools_%s-3.8.1/kiwix-serve" % plat, kiwix_fake)])
for name, size in (("wikipedia_en_all_mini_2026-06.zim", 24 << 20), ("wikipedia_en_all_nopic_2026-09.zim", 3000)):
    data = b"ZIM\x04" + os.urandom(size); put("kiwix/zim/wikipedia/" + name, data)
    put("kiwix/zim/wikipedia/" + name + ".sha256", (hashlib.sha256(data).hexdigest() + "  " + name + "\n").encode())
def listing(d):
    names = sorted(n for n in os.listdir(os.path.join(web, d)) if not n.endswith(".html"))
    put(d + "/index.html", ("<html><body>" + "".join('<a href="%s">%s</a><br>' % (n, n) for n in names) + "</body></html>").encode())
listing("kiwix/release/kiwix-tools"); listing("kiwix/zim/wikipedia")
# Lantern itself, as GitHub's archive of the main branch holds it
tgz("lantern/main.tar.gz", [("Lantern_Office_Suite-main/site/index.html", b"<!doctype html><title>Lantern Office</title>"),
                            ("Lantern_Office_Suite-main/site/icons/icon-192.png", open(os.path.join(ROOT, "site", "icons", "icon-192.png"), "rb").read()),
                            ("Lantern_Office_Suite-main/package.json", b'{ "version": "1.13.1" }')])

class Web(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_file(self, f, head):
        size = os.path.getsize(f)
        self.send_response(200); self.send_header("Content-Length", str(size)); self.end_headers()
        if head: return
        with open(f, "rb") as fh:
            while True:
                chunk = fh.read(256 << 10)
                if not chunk: break
                try: self.wfile.write(chunk)
                except OSError: return
                if size > (4 << 20): time.sleep(0.05 if SHOTS else 0.02)   # slower for the screenshots
    def route(self, head):
        p = self.path.split("?")[0]
        if p.startswith("/signed/"):
            if head: self.send_response(403); self.send_header("Content-Length", "0"); self.end_headers(); return
            return self.send_file(os.path.join(web, "hf", p[len("/signed/"):]), head)
        if p.startswith("/hf/") and "/resolve/main/" in p:
            f = os.path.join(web, p.lstrip("/"))
            if os.path.isfile(f):
                self.send_response(302); self.send_header("Location", "/signed/" + p[len("/hf/"):] + "?X-Amz-Signature=x")
                self.send_header("Content-Length", "0"); self.end_headers(); return
        f = os.path.join(web, p.lstrip("/"))
        if os.path.isdir(f): f = os.path.join(f, "index.html")
        if os.path.isfile(f): return self.send_file(f, head)
        self.send_response(404); self.send_header("Content-Length", "0"); self.end_headers()
    def do_HEAD(self): self.route(True)
    def do_GET(self): self.route(False)
wport = free_port()
srv = http.server.ThreadingHTTPServer(("127.0.0.1", wport), Web)
threading.Thread(target=srv.serve_forever, daemon=True).start()
W = "http://127.0.0.1:%d" % wport

# --- a fresh copy of what the zip from GitHub holds (the parts the kit uses)
def fresh(name):
    d = os.path.join(tmp, name)
    shutil.copytree(os.path.join(ROOT, "kit"), os.path.join(d, "kit"), ignore=shutil.ignore_patterns("engine", "models", "library", "__pycache__", ".lantern-kit.lock"))
    os.makedirs(os.path.join(d, "site", "icons"))
    shutil.copy(os.path.join(ROOT, "site", "icons", "icon-192.png"), os.path.join(d, "site", "icons"))
    open(os.path.join(d, "site", "index.html"), "w").write("<title>Lantern</title>")
    for f in os.listdir(ROOT):
        if f.endswith(".desktop"): shutil.copy(os.path.join(ROOT, f), d)
    home = os.path.join(d, "home"); os.makedirs(os.path.join(home, "Desktop"))
    return d, home
def env_for(home, extra):
    e = dict(os.environ)
    e.update({"HOME": home, "HF_BASE": W + "/hf", "LLAMA_BASE": W + "/llama", "KIWIX_BASE": W + "/kiwix", "LANTERN_SRC": W + "/lantern/main.tar.gz",
              "LANTERN_MEM_MB": "16000", "LANTERN_FREE_GB": "60", "NO_PROXY": "127.0.0.1", "no_proxy": "127.0.0.1",
              "NO_BROWSER": "1", "PORT": str(free_port()), "LANTERN_KIT_AUTO_DELAY": "2600" if SHOTS else "900"})
    e.update(extra)
    return e
def run_window(d, mode, env, timeout=240, shots=""):
    trace = os.path.join(d, "trace-%s.txt" % mode); open(trace, "w").close()
    env = dict(env); env["LANTERN_KIT_TRACE"] = trace
    p = subprocess.Popen([PY, os.path.join(d, "kit", "lantern-kit.py"), mode], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    seen, t0, last_shot = 0, time.time(), 0
    while p.poll() is None and time.time() - t0 < timeout:
        time.sleep(0.25)
        lines = open(trace).read().splitlines()
        while seen < len(lines):
            seen += 1
            if shots: time.sleep(1.0); shot(shots + "-" + lines[seen - 1].replace(" ", "_").replace("?", "")[:40])
        if shots and lines and lines[-1] == "page work" and time.time() - last_shot > 2.5:
            last_shot = time.time(); shot(shots + "-progress")
    if p.poll() is None:
        p.kill(); ok("%s: the window finished in time" % mode, False, open(trace).read())
    out = p.stdout.read().decode("utf-8", "replace")
    return open(trace).read().splitlines(), out

# 1. Install: Install, No to the 9B, Yes to the encyclopedia, Not now to the full Wikipedia,
#    No to the shelf of more books (1.14.0), Close
d, home = fresh("install")
tr, out = run_window(d, "install", env_for(home, {"LANTERN_KIT_AUTO": "install,never,yes,notnow,never,close"}), shots="install")
have = lambda *p: os.path.exists(os.path.join(d, "kit", *p))
ok("install: the pages and questions in order", tr[:2] == ["page welcome", "page work"] and
   [l for l in tr if l.startswith("ask ")] == ["ask A stronger AI model", "ask Offline encyclopedia", "ask The full Wikipedia", "ask More offline books"] and
   "page done" in tr and tr[-1] == "shortcuts menu,desktop", (tr, out))
ok("install: engine, model and its vision part, the encyclopedia; the answers kept", have("engine", "linux", "llama-server") and
   have("models", "Qwen3.5-4B-Q4_K_M.gguf") and have("models", "mmproj-Qwen3.5-4B-F16.gguf") and have("models", ".skip-big") and
   have("library", "wikipedia_en_all_mini_2026-06.zim") and not have("library", "wikipedia_en_all_nopic_2026-09.zim") and
   not have("models", ".skip-library-full") and have("models", ".skip-shelves"), sorted(os.listdir(os.path.join(d, "kit", "models"))))
menu = os.path.join(home, ".local", "share", "applications", "lantern-kit.desktop")
desk = os.path.join(home, "Desktop", "Lantern.desktop")
ok("install: a menu entry and a desktop icon that start Lantern from this folder", os.path.exists(menu) and os.path.exists(desk) and
   ('Exec=sh "%s/kit/lantern-kit.sh" start' % d) in open(menu).read() and os.access(desk, os.X_OK) and
   ("Icon=%s/site/icons/icon-192.png" % d) in open(menu).read(), open(menu).read() if os.path.exists(menu) else "")
if shutil.which("desktop-file-validate"):
    r = subprocess.run(["desktop-file-validate", menu], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    ok("install: the menu entry is a valid desktop entry", r.returncode == 0 and "error" not in r.stdout, r.stdout)

# 2. Install again: it is installed -- the welcome page says so and offers Start
tr, out = run_window(d, "install", env_for(home, {"LANTERN_KIT_AUTO": "close"}), shots="again")
ok("install again: says it is installed", tr == ["page welcome"], (tr, out))

# 3. Start: loading, ready, share with phones (restarts on 0.0.0.0), stop, close
args = os.path.join(d, "server-args.txt")
# (each start offers the full Wikipedia again until it is answered No: Not now here)
tr, out = run_window(d, "start", env_for(home, {"LANTERN_KIT_AUTO": "notnow,share,yes,notnow,stop,close", "FAKE_ARGS_OUT": args,
                                                 "LANTERN_KIT_AUTO_DELAY": "6000"}), shots="start")
srv_args = open(args).read().splitlines() if os.path.exists(args) else []
ok("start: the offer as a popup, ready, then shared, then stopped", tr == ["page run", "ask The full Wikipedia", "ready",
   "confirm Share with phones?", "page run", "ask The full Wikipedia", "ready", "page stopped"], (tr, out))
ok("start: the model and site are passed, then the phones' address", len(srv_args) == 2 and "--host 127.0.0.1" in srv_args[0] and
   "--host 0.0.0.0" in srv_args[1] and "Qwen3.5-4B-Q4_K_M.gguf" in srv_args[0] and "--mmproj" in srv_args[0] and
   "--path %s/site" % d in srv_args[0].replace("/kit/../site", "/site"), srv_args)

# 3b. Start with nobody at the keyboard: the question answers Not now by itself and Lantern starts
tr, out = run_window(d, "start", env_for(home, {"LANTERN_KIT_AUTO": "stop,close", "LANTERN_KIT_ASK_TIMEOUT": "3",
                                                 "LANTERN_KIT_AUTO_DELAY": "11000"}), shots="unattended")
ok("start unattended: the question times out to Not now, then ready", tr == ["page run", "ask The full Wikipedia",
   "timeout The full Wikipedia", "ready", "page stopped"], (tr, out))

# 4. Start while Lantern already runs
busy = free_port()
class Quiet(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
bs = http.server.ThreadingHTTPServer(("127.0.0.1", busy), Quiet)
threading.Thread(target=bs.serve_forever, daemon=True).start()
tr, out = run_window(d, "start", env_for(home, {"LANTERN_KIT_AUTO": "close", "PORT": str(busy)}), shots="busy")
ok("start: Lantern already running is said, nothing started", tr == ["page already"], (tr, out))
bs.shutdown()

# 4b. A second window for the same folder is turned away (two installers would fetch into the same files)
first = subprocess.Popen([PY, os.path.join(d, "kit", "lantern-kit.py"), "install"], env=env_for(home, {}), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2.5)
tr, out = run_window(d, "install", env_for(home, {"LANTERN_KIT_AUTO": "ok"}), timeout=40, shots="second")
first.kill(); first.wait()
ok("a second window for the same folder says the first is open", tr == ["page busy-window"], (tr, out))

# 5. Install with no internet: the failure page says so
d2, home2 = fresh("offline")
dead = "http://127.0.0.1:%d" % free_port()
tr, out = run_window(d2, "install", env_for(home2, {"LANTERN_KIT_AUTO": "install,close", "LLAMA_BASE": dead + "/llama"}), shots="offline")
ok("install offline: the failure page", tr == ["page welcome", "page work", "page failed"], (tr, out))

# 5b. A Lantern folder without Lantern itself (site/ gone): Install fetches Lantern first,
# into the folder's site/ (one place, 1.13.2), not kit/site; then Start serves it
d4, home4 = fresh("kit-only"); shutil.rmtree(os.path.join(d4, "site"))
tr, out = run_window(d4, "start", env_for(home4, {"LANTERN_KIT_AUTO": "close"}))
ok("start with no Lantern: says so and offers Install", tr == ["page run", "page failed"], (tr, out))
tr, out = run_window(d4, "install", env_for(home4, {"LANTERN_KIT_AUTO": "install,close", "LANTERN_AUTO_DOWNLOAD": "0"}), shots="kitonly")
ok("install in a Lantern folder with no Lantern: Lantern fetched into the folder, then the AI", tr == ["page welcome", "page work", "page done", "shortcuts menu,desktop"] and
   os.path.exists(os.path.join(d4, "site", "index.html")) and not os.path.exists(os.path.join(d4, "kit", "site")) and
   os.path.exists(os.path.join(d4, "kit", "models", "Qwen3.5-4B-Q4_K_M.gguf")), (tr, out))
tr, out = run_window(d4, "start", env_for(home4, {"LANTERN_KIT_AUTO": "stop,close", "LANTERN_AUTO_DOWNLOAD": "0", "LANTERN_KIT_AUTO_DELAY": "6000"}))
ok("then Start serves that Lantern", tr == ["page run", "ready", "page stopped"], (tr, out))

# 6. Start with nothing installed: points to Install
tr, out = run_window(d2, "start", env_for(home2, {"LANTERN_KIT_AUTO": "close"}))
ok("start before install: says to install first", tr == ["page run", "page failed"], (tr, out))

# 7. Start with an engine that cannot start here (Bookworm's glibc): said at once, and Install offered
d3, home3 = fresh("glibc")
os.makedirs(os.path.join(d3, "kit", "engine", "linux")); os.makedirs(os.path.join(d3, "kit", "models"))
eng = os.path.join(d3, "kit", "engine", "linux", "llama-server")
open(eng, "w").write("#!/bin/sh\necho \"./llama-server: /lib/aarch64-linux-gnu/libc.so.6: version \\`GLIBC_2.38' not found\" >&2\nexit 1\n")
os.chmod(eng, 0o755)
shutil.copy(os.path.join(web, "hf", "unsloth", "Qwen3.5-4B-GGUF", "resolve", "main", "Qwen3.5-4B-Q4_K_M.gguf"), os.path.join(d3, "kit", "models"))
t0 = time.time()
tr, out = run_window(d3, "start", env_for(home3, {"LANTERN_KIT_AUTO": "close", "LANTERN_AUTO_DOWNLOAD": "0"}), shots="glibc")
ok("start with an engine that cannot start: the failure page at once, pointing to Install", tr == ["page run", "page failed"] and
   time.time() - t0 < 25, (tr, round(time.time() - t0), out))

# --- the launchers: what the file managers run when they are double-clicked
stub, called = os.path.join(tmp, "stub"), os.path.join(tmp, "called.txt")
for folder in ("Lantern Office Suite-main", "Lantern_Office_Suite-main"):   # with and without a space
    lk = os.path.join(stub, folder, "kit"); os.makedirs(lk)
    open(os.path.join(lk, "lantern-kit.sh"), "w").write('#!/bin/sh\necho "$(cd "$(dirname "$0")/.." && pwd) $1" > "%s"\n' % called)
    for f in ("Install Lantern (Linux).desktop", "Start Lantern (Linux).desktop"):
        shutil.copy(os.path.join(ROOT, f), os.path.join(stub, folder))
# GLib itself (through its Python bindings, run with a Python that has them):
# libfm reads Exec as GLib does, puts the launcher's FOLDER, unquoted, for %k and
# splits with g_shell_parse_argv; GLib's own launcher puts the launcher's path.
GI = next((py for py in ("python3", "python3.12", "python3.11", PY) if shutil.which(py) and subprocess.run(
    [shutil.which(py), "-c", "import gi; gi.require_version('Gio', '2.0'); from gi.repository import Gio"], stderr=subprocess.DEVNULL).returncode == 0), None)
LAUNCH = r"""
import sys, os, subprocess, time
import gi; gi.require_version("Gio", "2.0"); from gi.repository import Gio, GLib
how, path = sys.argv[1], sys.argv[2]
if how == "libfm":
    kf = GLib.KeyFile(); kf.load_from_file(path, GLib.KeyFileFlags.NONE)
    cmd = kf.get_string("Desktop Entry", "Exec").replace("%k", os.path.dirname(path))
    ok, argv = GLib.shell_parse_argv(cmd); subprocess.run(argv, timeout=20)
else:
    Gio.DesktopAppInfo.new_from_filename(path).launch([], None)
"""
if GI:
    for folder in ("Lantern Office Suite-main", "Lantern_Office_Suite-main"):
        base = os.path.join(stub, folder)
        for f, mode in (("Install Lantern (Linux).desktop", "install"), ("Start Lantern (Linux).desktop", "start")):
            for how in ("libfm", "glib"):
                if os.path.exists(called): os.remove(called)
                subprocess.run([shutil.which(GI), "-c", LAUNCH, how, os.path.join(base, f)], timeout=30)
                t = time.time()
                while not os.path.exists(called) and time.time() - t < 5: time.sleep(0.1)
                time.sleep(0.2)
                got = open(called).read().strip() if os.path.exists(called) else ""
                ok("%s opens %s in '%s'" % (how, f, folder), got == "%s %s" % (base, mode), got)
else:
    print("(no GLib Python bindings here: the launchers were not opened the file managers' way)")
if shutil.which("desktop-file-validate"):
    for f in ("Install Lantern (Linux).desktop", "Start Lantern (Linux).desktop"):
        r = subprocess.run(["desktop-file-validate", os.path.join(ROOT, f)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        ok("%s is a valid desktop entry" % f, r.returncode == 0 and "error" not in r.stdout.lower(), r.stdout)

srv.shutdown()
if xproc: xproc.terminate()
shutil.rmtree(tmp, ignore_errors=True)
print("KIT WINDOW TESTS PASS" if not fails else "%d KIT WINDOW FAILURES" % len(fails))
sys.exit(1 if fails else 0)
