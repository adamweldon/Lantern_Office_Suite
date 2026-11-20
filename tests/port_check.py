# port_check.py -- Start Lantern finds its address taken (1.24.30). Adam's laptop, 2026-11-20: the desktop Lantern (the
# one-link starter) was still running at 127.0.0.1:8080 when Start Lantern was started from the USB stick; on Windows
# both took the address, and the page showed the desktop one's downloads beside the stick's AI. Now the start scripts
# ask the desktop Lantern to stop, or move to a spare address when another program has it.
#   - kit/lantern-port.ps1 (start-lantern.bat's check; run here with pwsh when there is one): FREE, STOPPED, PORT=<n>;
#   - start-lantern.sh's own check, run on its own: the same, and PORT changed.
# Stand-ins: a "desktop Lantern" answering /lantern-setup/status and stopping on POST /lantern-setup/stop, and a
# program that is not Lantern.
import http.server, json, os, re, shutil, socket, subprocess, sys, threading, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails, passes = [], [0]
def ok(name, cond, info=""):
    if cond: passes[0] += 1
    else: fails.append(name); print("FAIL", name, str(info)[-900:])
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

class Starter(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith("/lantern-setup/status"):
            b = json.dumps({"v": 1, "starter": "1.24.19", "busy": True, "ai": {"state": "downloading"}, "jobs": []}).encode()
        else:
            b = b"<title>Lantern</title>"
        self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); self.rfile.read(n)
        if self.path == "/lantern-setup/stop":
            self.server.stopped = True
            b = b'{"ok":true}'; self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
            threading.Thread(target=lambda srv=self.server: (srv.shutdown(), srv.server_close())).start()   # as the desktop Lantern does: it lets the address go
            return
        self.send_response(404); self.end_headers()
class Other(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        b = b"not Lantern"; self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

def serve(handler, port):
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler); srv.stopped = False
    t = threading.Thread(target=srv.serve_forever, daemon=True); t.start()
    return srv

def close(srv):
    try: srv.shutdown()
    except Exception: pass
    srv.server_close()

# --- start-lantern.sh's check, on its own ---------------------------------------------------------------------------
sh = open(os.path.join(ROOT, "kit", "start-lantern.sh"), encoding="utf-8").read()
m = re.search(r"(# \(1\.24\.30\) Another Lantern at this address\?.*?\nfi\n)", sh, re.S)
ok("start-lantern.sh has the check", m is not None)
def run_sh(port):
    script = (m.group(1) if m else "") + 'echo "PORT=$PORT"\n'
    r = subprocess.run(["sh", "-c", script], env=dict(os.environ, PORT=str(port)), capture_output=True, text=True, timeout=60)
    return r.stdout + r.stderr
p = free_port()
out = run_sh(p)
ok("sh: a free address is kept", out.strip().endswith("PORT=%d" % p), out)
srv = serve(Starter, p)
out = run_sh(p)
ok("sh: the desktop Lantern at the address is asked to stop, says so, and the address is kept", srv.stopped and "has been asked to stop" in out and out.strip().endswith("PORT=%d" % p), out)
close(srv)
srv = serve(Other, p)
out = run_sh(p)
mm = re.search(r"PORT=(\d+)\s*$", out)
ok("sh: another program at the address: the next spare one, said", mm and mm.group(1) != str(p) and "so Lantern uses" in out, out)
close(srv)

# --- kit/lantern-port.ps1 (start-lantern.bat's check) ------------------------------------------------------------------
PS = shutil.which("pwsh") or shutil.which("powershell")
if PS:
    def run_ps(port):
        r = subprocess.run([PS, "-NoProfile", "-File", os.path.join(ROOT, "kit", "lantern-port.ps1"), "-Port", str(port)], capture_output=True, text=True, timeout=90)
        return (r.stdout + r.stderr).strip()
    p = free_port()
    out = run_ps(p)
    ok("ps1: a free address", out == "FREE", out)
    srv = serve(Starter, p)
    out = run_ps(p)
    ok("ps1: the desktop Lantern is asked to stop, and does", out == "STOPPED" and srv.stopped, out)
    close(srv)
    srv = serve(Other, p)
    out = run_ps(p)
    ok("ps1: another program: a spare address", re.match(r"^PORT=(808[3-9]|809[1-3])$", out) is not None, out)
    close(srv)
else:
    print("(no PowerShell here: lantern-port.ps1 not run)")
bat = open(os.path.join(ROOT, "kit", "start-lantern.bat"), encoding="utf-8").read()
ok("start-lantern.bat runs the check before the address is printed, not under the desktop Lantern", bat.index("lantern-port.ps1") < bat.index("echo Open http://127.0.0.1:%PORT%/") and "if not defined LANTERN_UI if exist" in bat)
print(("%d PORT CHECK FAILURES" % len(fails)) if fails else "ALL PORT CHECKS PASS (%d)" % passes[0])
sys.exit(1 if fails else 0)
