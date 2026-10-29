#!/usr/bin/env python3
"""The Windows watcher (kit/lantern-watch.ps1) for real, under PowerShell 7
(pwsh, or $PWSH): a stand-in llama-server answers /health 503 and then 200,
and the watcher runs its real loop against it, the way start-lantern.bat
starts it. Skipped when PowerShell is not installed.

From Adam's first Windows run (2026-10-29, the 35B from a USB stick): the
watcher's start-up asked Windows' storage tools about the drive and wrote its
log file on the stick before its first reading, and with the stick busy
reading the model that took 125 s: no progress until the model was ready.
Checks: the first status within a few seconds; nothing written to the kit's
log folder while the model loads (rows go to the temp folder); at ready the
load's log, last-load.json (with firstSampleMs) and loads.csv in the kit's log
folder, with a log left in the temp folder by a cut-off load moved there too;
the engine stopping ends the watcher.

    python3 tests/lantern_watch/live_ps.py [path/to/kit]
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..", "kit")
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")
ENGINE = r'''
import http.server, os, sys
port = int(sys.argv[1]); flag = sys.argv[2]
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if os.path.exists(flag) else 503); self.end_headers(); self.wfile.write(b"{}")
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
'''
fails = []


def ok(cond, what, info=""):
    print(("PASS  " if cond else "FAIL  ") + what + ("" if cond else "  " + str(info)[:600]))
    if not cond:
        fails.append(what)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def status(port):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/status" % port, timeout=1) as r:
            return json.load(r)
    except Exception:
        return None


def main():
    if not PWSH:
        print("LIVE PS WATCH SKIPPED (no pwsh)")
        return 0
    tmp = tempfile.mkdtemp(prefix="lw-live-ps-")
    eng = w = None
    try:
        # the stand-in engine runs as a process named llama-server, which is
        # how the Windows watcher finds the engine
        os.makedirs(os.path.join(tmp, "eng"))
        exe = os.path.join(tmp, "eng", "llama-server")
        shutil.copy(os.path.realpath(sys.executable), exe)
        open(os.path.join(tmp, "engine.py"), "w").write(ENGINE)
        model = os.path.join(tmp, "Live-Test-Q4_K_M.gguf")
        open(model, "wb").write(b"\0" * 4000000)
        logs, tlogs = os.path.join(tmp, "logs"), os.path.join(tmp, "tmp", "Lantern-logs")
        os.makedirs(logs)
        os.makedirs(tlogs)
        open(os.path.join(tlogs, "load-20200101-000000.csv"), "w").write("elapsed_s,phase\n1.0,reading\n")   # a load cut off earlier
        P, Q = free_port(), free_port()
        flag = os.path.join(tmp, "ready.flag")
        eng = subprocess.Popen([exe, "-I", os.path.join(tmp, "engine.py"), str(P), flag])
        env = dict(os.environ, TMPDIR=os.path.join(tmp, "tmp"), POWERSHELL_TELEMETRY_OPTOUT="1")
        t0 = time.time()
        w = subprocess.Popen([PWSH, "-NoProfile", "-File", os.path.join(KIT, "lantern-watch.ps1"), "watch", "-Model", model,
                              "-Port", str(P), "-StatusPort", str(Q), "-LogDir", logs],
                             env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        first = None
        while time.time() - t0 < 20 and first is None:
            j = status(Q)
            if j and j.get("v") == 1:
                first = (time.time() - t0, j)
            else:
                time.sleep(0.2)
        ok(first is not None and first[0] < 8, "the first status comes within a few seconds of the watcher starting",
           first and round(first[0], 1))
        ok(first is not None and first[1].get("phase") in ("starting", "reading", "preparing"), "...and it is a loading status", first and first[1].get("phase"))
        time.sleep(2.5)
        ok(os.listdir(logs) == [], "while the model loads, nothing is written to the kit's log folder", os.listdir(logs))
        try:
            cwd = os.readlink("/proc/%d/cwd" % w.pid)
        except OSError:
            cwd = None
        ok(cwd is None or os.path.realpath(cwd) == os.path.realpath(os.path.join(tmp, "tmp")),
           "the watcher's working directory is the temp folder, not start-lantern's on the stick (1.1)", cwd)
        # past the old 30 s flush: still nothing written anywhere, and still answering
        time.sleep(31)
        j = status(Q)
        ok(os.listdir(logs) == [] and sorted(os.listdir(tlogs)) == ["load-20200101-000000.csv"],
           "35 s into the load: nothing written to the kit's log folder or the temp folder (1.1: the first write stopped the watcher for 14 min)",
           [os.listdir(logs), os.listdir(tlogs)])
        ok(j is not None and j.get("phase") in ("reading", "preparing", "starting") and time.time() * 1000 - j.get("t", 0) < 5000,
           "...and the watcher is still answering with fresh readings", j and (j.get("phase"), j.get("t")))
        open(flag, "w").write("1")
        t1, ph = time.time(), None
        while time.time() - t1 < 20 and ph != "ready":
            j = status(Q)
            ph = j and j.get("phase")
            time.sleep(0.3)
        time.sleep(1.5)
        ok(ph == "ready", "ready is seen", ph)
        have = sorted(os.listdir(logs))
        mine = [f for f in have if f.startswith("load-") and "20200101" not in f]
        ok(len(mine) == 1 and "last-load.json" in have and "loads.csv" in have and "load-20200101-000000.csv" in have and os.listdir(tlogs) == [],
           "at ready: this load's log, last-load.json and loads.csv in the kit's log folder, the cut-off load's log moved there, the temp folder empty",
           [have, os.listdir(tlogs)])
        rows = open(os.path.join(logs, mine[0])).read().splitlines() if mine else []
        ok(len(rows) >= 3 and rows[0].startswith("elapsed_s,phase,health,read_mb"), "the load's log has its header and the loading rows", rows[:3])
        el = [float(r.split(",")[0]) for r in rows[1:] if r and r.split(",")[1] != "ready"]
        gaps = [round(b - a, 1) for a, b in zip(el, el[1:]) if b - a > 5]
        ok(len(el) >= 25 and not gaps, "...a row every second or two all through the load, no gap (the home log had none from 30 s to 14 min)", [len(el), gaps])
        ll = json.load(open(os.path.join(logs, "last-load.json"))) if "last-load.json" in have else {}
        ok(ll.get("outcome") == "ready" and isinstance(ll.get("firstSampleMs"), int) and ll["firstSampleMs"] < 8000,
           "last-load.json says how soon the first reading came (firstSampleMs)", ll)
        eng.kill()
        eng.wait()
        out = w.communicate(timeout=30)[0]
        ok(w.returncode == 0 and "[Lantern] Lantern's AI engine has stopped." in out, "the engine stopping ends the watcher", out[-400:])
    finally:
        for p in (eng, w):
            if p and p.poll() is None:
                p.kill()
                p.wait()
        shutil.rmtree(tmp, ignore_errors=True)
    print("LIVE PS WATCH FAILED (%d)" % len(fails) if fails else "LIVE PS WATCH TESTS PASS")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
