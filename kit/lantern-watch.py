#!/usr/bin/env python3
"""lantern-watch.py -- Lantern Watch for Linux, the Raspberry Pi and Mac (Lantern's kit).

Keeps the person at the computer told the truth while the AI model loads,
and keeps the load from freezing the computer. Same contract as
lantern-watch.ps1 (Windows): same phases, codes, numbers and status JSON.

  plan   before the engine starts: is there room in FREE memory (not just
         total) for the model start-lantern picked? If not, asks (zenity on
         Linux, a dialog on a Mac) whether to use a smaller model, load
         anyway, or stop; with no way to ask, it takes the smaller model and
         says why. Prints KEY=VALUE lines for start-lantern.sh:
           PICK=<file name in models/>   use this model instead
           ARGS=--prio -1   (nice 5, and SCHED_BATCH threads on Linux; the
                            Windows watcher does not pass it: there it keeps
                            Windows 11 power throttling on for the threads)
           STOP=1                        the person chose to stop
  watch  while the engine runs: bytes read from the model's drive, free
         memory, swapping and memory stalls (PSI) -- told plainly in the
         terminal and as JSON at http://127.0.0.1:<status-port>/status for
         Lantern's loading screen; a one-line-per-second log in kit/logs.
  selftest  prints what this computer lets the watcher read, then exits.

Python 3.7+ standard library only. No root. Nothing changes on the computer
apart from the log files; if anything fails, Lantern starts as before.

  --simulate <fixture.json> --fast   replays recorded readings (tests)
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LW_VERSION = "1.0"
MB = 1048576.0
GB = 1e9           # file sizes in decimal GB, as Lantern's page shows them (memory stays in binary MB/GB, as Task Manager shows it)

# ---- tuning (first guesses; the load logs are there to refine them) ----------
ENGINE_OVERHEAD_MB = 1200  # KV cache for -c 8192 plus compute buffers
PUSH_OUT_OK_MB = 1500      # the system may push out this much of idle programs without a freeze worth asking about
CHOICE_SECONDS = 60        # the question answers itself after this
SLOW_MBPS = 45             # below this the drive or port is called slow
TIGHT_AVAIL_MB = 1200
HEAVY_AVAIL_MB = 500
TIGHT_PAGING_PS = 250      # pages a second swapped out or in
HEAVY_PAGING_PS = 1000
HEAVY_COMMIT_PCT = 97
PREPARE_TAIL_MS = 6000     # after the last byte is read, until it answers
KEEP_LOGS = 20
READY_INTERVAL_S = 10.0    # after ready: a reading every 10 s (the engine needs the computer)
NO_ENGINE_MS = 30000       # no engine process by then: give up
LOG_FLUSH_S = 30.0         # log rows go to the drive every 30 s, not every second

IS_MAC = sys.platform == "darwin"
OS_NAME = "mac" if IS_MAC else "linux"
SYSTEM_WORD = "macOS" if IS_MAC else "the system"


def say(text):
    try:
        sys.stderr.write(text + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def out_key(k, v):
    sys.stdout.write("%s=%s\n" % (k, v))
    sys.stdout.flush()


def f1(x):
    return "%.1f" % x


def f0(x):
    return "%.0f" % round(x)


def gb(mb):
    return f1(mb / 1024.0) + " GB"


def nice_name(path):
    n = os.path.basename(path or "")
    return n[:-5] if n.lower().endswith(".gguf") else n


def now_ms():
    return int(time.time() * 1000)


def clock(ms):
    s = max(0, int(round(ms / 1000.0)))
    if s < 60:
        return "%d s" % s
    m, r = divmod(s, 60)
    if m < 60:
        return "%d min %02d s" % (m, r)
    return "%d h %d min" % (m // 60, m % 60)


def rnd(x, n=0):
    if x is None:
        return None
    return round(x, n) if n else int(round(x))


def run(cmd, timeout=3):
    try:
        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              timeout=timeout, check=False).stdout.decode("utf-8", "replace")
    except Exception:
        return ""


# ---- where the logs go -----------------------------------------------------------
def get_log_dir(arg):
    d = arg or os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
    for cand in (d, os.path.join(os.environ.get("TMPDIR", "/tmp"), "lantern-logs")):
        try:
            os.makedirs(cand, exist_ok=True)
            probe = os.path.join(cand, ".write-test")
            with open(probe, "w") as fh:
                fh.write("ok")
            os.remove(probe)
            return cand
        except Exception:
            continue
    return None


# ---- the model and its vision part -------------------------------------------------
# Same rule as start-lantern: mmproj-<base>[-F16|-BF16|-F32].gguf belongs to a
# model whose file name starts with "<base>-".
def find_mmproj(model_path, d, no_vision):
    if no_vision or not d or not os.path.isdir(d):
        return None
    mn = os.path.basename(model_path).lower()
    hit = None
    for v in sorted(os.listdir(d)):
        if not (v.startswith("mmproj-") and v.endswith(".gguf")):
            continue
        b = re.sub(r"^mmproj-", "", v[:-5])
        b = re.sub(r"-BF16$", "", b)
        b = re.sub(r"-F16$", "", b)
        b = re.sub(r"-F32$", "", b)
        if mn.startswith(b.lower() + "-"):
            hit = os.path.join(d, v)
    return hit


def file_bytes(p, sim=None):
    if sim is not None:
        n = os.path.basename(p or "")
        for m in sim.get("models", []):
            if m.get("name") == n:
                return float(m.get("bytes", 0))
        return 0.0
    try:
        return float(os.path.getsize(p)) if p else 0.0
    except OSError:
        return 0.0


def sim_vbytes(sim, model):
    n = os.path.basename(model)
    for m in sim.get("models", []):
        if m.get("name") == n:
            return float(m.get("vbytes", 0))
    return 0.0


def need_mb(model_bytes, vision_bytes):
    return (model_bytes + vision_bytes) / MB + ENGINE_OVERHEAD_MB


def fits(need, avail):
    # fits when the system needs to push out no more than PUSH_OUT_OK_MB to make room
    return need - avail <= PUSH_OUT_OK_MB


def candidates(d, no_vision, sim=None):
    out = []
    if sim is not None:
        for m in sim.get("models", []):
            if "mmproj" not in m["name"]:
                out.append({"name": m["name"], "bytes": float(m["bytes"]), "vision": float(m.get("vbytes", 0))})
    elif d and os.path.isdir(d):
        for f in os.listdir(d):
            if not f.endswith(".gguf") or "mmproj" in f.lower():
                continue
            p = os.path.join(d, f)
            out.append({"name": f, "bytes": file_bytes(p), "vision": file_bytes(find_mmproj(p, d, no_vision))})
    out.sort(key=lambda c: -c["bytes"])
    return out


# ---- memory right now -----------------------------------------------------------------
def meminfo():
    vals = {}
    try:
        with open("/proc/meminfo") as fh:
            for line in fh:
                k, _, rest = line.partition(":")
                parts = rest.split()
                if parts:
                    vals[k] = float(parts[0]) / 1024.0  # kB -> MB
    except Exception:
        pass
    return vals


def mac_vm():
    txt = run(["vm_stat"])
    page = 4096.0
    m = re.search(r"page size of (\d+) bytes", txt)
    if m:
        page = float(m.group(1))
    vals = {}
    for line in txt.splitlines():
        mm = re.match(r'^"?([^":]+)"?:\s+(\d+)\.?$', line.strip())
        if mm:
            vals[mm.group(1).strip()] = float(mm.group(2))
    return vals, page


def memory_now(sim=None):
    if sim is not None:
        p = sim.get("plan", {})
        return float(p.get("totalMb", 0)), float(p.get("availMb", 0))
    total = avail = 0.0
    if IS_MAC:
        try:
            total = float(run(["sysctl", "-n", "hw.memsize"]).strip() or 0) / MB
        except ValueError:
            total = 0.0
        vals, page = mac_vm()
        avail = sum(vals.get(k, 0.0) for k in ("Pages free", "Pages inactive", "Pages speculative", "Pages purgeable")) * page / MB
    else:
        mi = meminfo()
        total = mi.get("MemTotal", 0.0)
        avail = mi.get("MemAvailable", mi.get("MemFree", 0.0))
    if os.environ.get("LANTERN_AVAIL_MB"):  # pretend, for testing
        avail = float(os.environ["LANTERN_AVAIL_MB"])
    if os.environ.get("LANTERN_MEM_MB"):
        total = float(os.environ["LANTERN_MEM_MB"])
    return total, avail


# ---- the question ---------------------------------------------------------------------
def ask_choice(title, text, labels, default, sim=None):
    if sim is not None:
        a = sim.get("plan", {}).get("answer")
        return default if a is None else int(a)
    mode = os.environ.get("LANTERN_POPUP", "")
    try:
        if IS_MAC or mode == "osascript":
            def q(s):
                return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
            btns = list(reversed(labels))  # the dialog lists right-to-left; the default sits on the right
            script = ("display dialog %s with title %s buttons {%s} default button %s giving up after %d with icon caution"
                      % (q(text), q(title), ", ".join(q(b) for b in btns), q(labels[default]), CHOICE_SECONDS))
            res = run(["osascript", "-e", script], timeout=CHOICE_SECONDS + 15)
            if "gave up:true" in res or not res:
                return default
            m = re.search(r"button returned:(.*?)(, gave up|$)", res.strip())
            if m and m.group(1).strip() in labels:
                return labels.index(m.group(1).strip())
            return default
        if shutil.which("zenity") and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
            cmd = ["zenity", "--question", "--title=" + title, "--text=" + text, "--width=560",
                   "--timeout=%d" % CHOICE_SECONDS, "--ok-label=" + labels[0]]
            if len(labels) > 1:
                cmd.append("--cancel-label=" + labels[1])
            if len(labels) > 2:
                cmd.append("--extra-button=" + labels[2])
            p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=CHOICE_SECONDS + 15, check=False)
            outp = p.stdout.decode("utf-8", "replace").strip()
            if p.returncode == 0:
                return 0
            if len(labels) > 2 and outp == labels[2]:
                return 2
            if p.returncode == 1 and len(labels) > 1:
                return 1
            return default
    except Exception as e:  # no way to ask: the safe choice
        say("  (Lantern could not ask: %s)" % e)
    say("  (no way to ask here, so Lantern takes the first choice: %s)" % labels[default])
    return default


# =============================================================================
# plan
# =============================================================================
def save_plan(log_dir, plan):
    if not log_dir:
        return
    try:
        with open(os.path.join(log_dir, "last-plan.json"), "w") as fh:
            json.dump(plan, fh)
    except Exception:
        pass


def do_plan(a, sim):
    extra = "--prio -1"
    if os.environ.get("LANTERN_PRIO") == "0":
        extra = ""
    if extra:
        out_key("ARGS", extra)
    if not a.model:
        return
    d = a.models or os.path.dirname(a.model)
    total, avail = memory_now(sim)
    if avail <= 0:
        say("  Lantern Watch: could not read free memory; starting as before.")
        return
    mb = file_bytes(a.model, sim)
    vb = file_bytes(find_mmproj(a.model, d, a.no_vision), sim) if sim is None else sim_vbytes(sim, a.model)
    if a.no_vision:
        vb = 0.0
    need = need_mb(mb, vb)
    name = nice_name(a.model)
    plan = {"v": 1, "t": now_ms(), "wanted": os.path.basename(a.model), "picked": os.path.basename(a.model),
            "totalMb": rnd(total), "availMb": rnd(avail), "needMb": rnd(need), "choice": "fits", "reason": ""}
    log_dir = get_log_dir(a.log_dir) if sim is None else None
    say("Lantern Watch: %s of %s memory is free; %s needs about %s." % (gb(avail), gb(total), name, gb(need)))
    if fits(need, avail):
        if avail < need:
            say("  A little short: %s will make room by moving idle programs out. Please do not open other programs while it loads." % SYSTEM_WORD)
        save_plan(log_dir, plan)
        return
    ever_need = need > (total - 2500)
    cands = candidates(d, a.no_vision, sim)
    alt = None
    for c in cands:
        if c["bytes"] >= mb:
            continue
        if fits(need_mb(c["bytes"], 0.0 if a.no_vision else c["vision"]), avail):
            alt = c
            break
    alt_tight = False
    if alt is None:
        smaller = [c for c in cands if c["bytes"] < mb]
        if smaller:
            alt = smaller[-1]
            alt_tight = True
    used = max(0.0, total - avail)
    if a.forced:
        say("  Free memory is short for %s (asked for by name). Loading it anyway; the computer may be slow while it loads." % name)
        plan.update(choice="forced", reason="short")
        save_plan(log_dir, plan)
        return
    why = "Lantern was about to load %s, which needs about %s of free memory.\n\n" % (name, gb(need))
    if ever_need:
        why += "This computer has %s in all, which is not enough for that model even with every other program closed." % gb(total)
    else:
        why += ("This computer has %s, but only %s is free right now: other programs are using about %s. "
                "Closing some of them (browser tabs especially) frees memory." % (gb(total), gb(avail), gb(used)))
    why += ("\n\nLoading it now makes %s push other programs out to the disk, and the whole computer can freeze "
            "or crawl for several minutes." % SYSTEM_WORD)
    reason = "total" if ever_need else "busy"
    if alt is not None:
        an = nice_name(alt["name"])
        first = "Use %s now (fits in free memory) - recommended" % an
        if alt_tight:
            first = "Use %s now (the smallest model here; still a tight fit)" % an
        labels = [first, "Load %s anyway (the computer may freeze for a few minutes)" % name]
        if not ever_need:
            labels.append("Stop, so I can close other programs, then start Lantern again")
        r = ask_choice("Lantern: not enough free memory right now", why + "\n\nWhat should Lantern do?", labels, 0, sim)
        if r == 0:
            say("  Using %s instead (free memory)." % an)
            out_key("PICK", alt["name"])
            plan.update(picked=alt["name"], choice="smaller", reason=reason)
        elif r == 2:
            say("  Stopped, so other programs can be closed first.")
            out_key("STOP", "1")
            plan.update(choice="stop", reason="busy")
        else:
            say("  Loading %s anyway. The computer may be slow until it has loaded: please wait and do not open other programs meanwhile." % name)
            plan.update(choice="anyway", reason=reason)
    else:
        labels = ["Load %s anyway (the computer may be slow for a few minutes)" % name]
        if not ever_need:
            labels.append("Stop, so I can close other programs, then start Lantern again")
        r = ask_choice("Lantern: memory is tight", why + "\n\nThere is no smaller model in the kit. What should Lantern do?", labels, 0, sim)
        if r == 1:
            say("  Stopped, so other programs can be closed first.")
            out_key("STOP", "1")
            plan["choice"] = "stop"
        else:
            say("  Loading %s anyway; please wait and do not open other programs meanwhile." % name)
            plan["choice"] = "anyway"
        plan["reason"] = reason
    save_plan(log_dir, plan)


# =============================================================================
# readings (Linux / Mac, or the --simulate fixture)
# =============================================================================
class Reader:
    """Normalised sample: t (ms since start), engine (bool), health
    (0/200/503/..), readBytes (cumulative from the model's drive, or None),
    availMb, totalMb, commitPct, pagingPs (pages/s swapped), psiSome, psiFull,
    cpuPct, engineCpuPct, engineWsMb, enginePrivMb."""

    def __init__(self, a, sim):
        self.a = a
        self.sim = sim
        self.i = 0
        self.t0 = time.time()
        self.prev = None
        self.read_base = None
        self.pid = a.engine_pid or None
        self.dev = None
        self.mac_disk = None
        self.sources = {"memory": False, "drive": False, "paging": False, "psi": False, "cpu": False, "engine": False}
        self.ncpu = os.cpu_count() or 1
        self.tick = os.sysconf("SC_CLK_TCK") if hasattr(os, "sysconf") else 100
        if sim is None and a.model:
            if IS_MAC:
                self.mac_disk = self._mac_disk(a.model)
            else:
                self.dev = self._linux_dev(a.model)

    # ---- which drive holds the model
    def _linux_dev(self, path):
        try:
            st = os.stat(path)
            maj, mi = os.major(st.st_dev), os.minor(st.st_dev)
            if maj == 0:  # btrfs, overlay...: look the mount's device up
                best = None
                rp = os.path.realpath(path)
                with open("/proc/self/mountinfo") as fh:
                    for line in fh:
                        parts = line.split()
                        mnt = parts[4]
                        src = parts[parts.index("-") + 2] if "-" in parts else ""
                        if (rp == mnt or rp.startswith(mnt.rstrip("/") + "/")) and src.startswith("/dev/"):
                            if best is None or len(mnt) > len(best[0]):
                                best = (mnt, src)
                if best:
                    rd = os.stat(best[1]).st_rdev
                    maj, mi = os.major(rd), os.minor(rd)
            return (maj, mi)
        except Exception:
            return None

    def _mac_disk(self, path):
        out = run(["df", "-P", path]).splitlines()
        if len(out) >= 2:
            m = re.match(r"/dev/(disk\d+)", out[1].split()[0])
            if m:
                return m.group(1)
        return None

    def drive_info(self):
        info = {"name": None, "kind": "drive", "word": "this computer's drive"}
        if self.sim is not None:
            k = self.sim.get("drive", "")
            info["name"] = "sdb1"
            if k == "usb":
                info.update(kind="usb", word="the USB stick")
            elif k == "sd":
                info.update(kind="sd", word="the memory card")
            elif k == "network":
                info.update(kind="network", word="the network drive")
            return info
        try:
            if IS_MAC and self.mac_disk:
                info["name"] = self.mac_disk
                txt = run(["diskutil", "info", self.mac_disk])
                if re.search(r"Protocol:\s+USB", txt) or re.search(r"Removable Media:\s+(Removable|Yes)", txt):
                    info.update(kind="usb", word="the USB stick")
            elif self.dev:
                link = os.path.realpath("/sys/dev/block/%d:%d" % self.dev)
                info["name"] = os.path.basename(link)
                if "/usb" in link:
                    info.update(kind="usb", word="the USB stick")
                elif "mmcblk" in link:
                    info.update(kind="sd", word="the memory card")
                elif "/nfs" in link or self.dev[0] == 0:
                    info.update(kind="network", word="the network drive")
        except Exception:
            pass
        return info

    def _find_engine(self):
        if self.pid:
            return self.pid
        best = None
        try:
            for d in os.listdir("/proc"):
                if not d.isdigit():
                    continue
                try:
                    with open("/proc/%s/comm" % d) as fh:
                        if fh.read().strip() != "llama-server":
                            continue
                    st = os.stat("/proc/" + d).st_mtime
                    if best is None or st > best[1]:
                        best = (int(d), st)
                except Exception:
                    continue
        except Exception:
            pass
        if best:
            self.pid = best[0]
        return self.pid

    def health(self):
        try:
            req = urllib.request.Request("http://127.0.0.1:%d/health" % self.a.port)
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(req, timeout=1.5) as r:
                return int(r.status)
        except urllib.error.HTTPError as e:
            return int(e.code)
        except Exception:
            return 0

    def sample(self):
        if self.sim is not None:
            arr = self.sim.get("samples", [])
            if self.i >= len(arr):
                return None
            x = arr[self.i]
            self.i += 1
            s = {"t": self.i * 1000.0 - 1000.0, "engine": True, "health": 0, "readBytes": None, "availMb": None,
                 "totalMb": float(self.sim.get("plan", {}).get("totalMb", 0)), "commitPct": None, "pagingPs": None,
                 "psiSome": None, "psiFull": None, "cpuPct": None, "engineCpuPct": None, "engineWsMb": None, "enginePrivMb": None}
            s.update(x)
            return s
        now = time.time()
        s = {"t": (now - self.t0) * 1000.0, "engine": False, "health": 0, "readBytes": None, "availMb": None,
             "totalMb": None, "commitPct": None, "pagingPs": None, "psiSome": None, "psiFull": None,
             "cpuPct": None, "engineCpuPct": None, "engineWsMb": None, "enginePrivMb": None}
        raw = {"ts": now}
        if IS_MAC:
            self._mac(s, raw)
        else:
            self._linux(s, raw)
        s["health"] = self.health()
        p = self.prev
        if p:
            dt = now - p["ts"]
            if dt > 0:
                if raw.get("swap") is not None and p.get("swap") is not None:
                    s["pagingPs"] = max(0.0, (raw["swap"] - p["swap"]) / dt)
                    self.sources["paging"] = True
                if raw.get("cpuT") is not None and p.get("cpuT") is not None and raw["cpuT"] > p["cpuT"]:
                    s["cpuPct"] = max(0.0, 100.0 * (1.0 - (raw["cpuI"] - p["cpuI"]) / float(raw["cpuT"] - p["cpuT"])))
                    self.sources["cpu"] = True
                if raw.get("eng") is not None and p.get("eng") is not None:
                    s["engineCpuPct"] = max(0.0, 100.0 * (raw["eng"] - p["eng"]) / dt / self.ncpu)
        if raw.get("read") is not None:
            if self.read_base is None:
                self.read_base = raw["read"]
            s["readBytes"] = max(0.0, raw["read"] - self.read_base)
            self.sources["drive"] = True
        self.prev = raw
        return s

    def _linux(self, s, raw):
        mi = meminfo()
        if mi:
            s["totalMb"] = mi.get("MemTotal")
            s["availMb"] = mi.get("MemAvailable", mi.get("MemFree"))
            self.sources["memory"] = True
        try:
            with open("/proc/vmstat") as fh:
                v = dict(line.split() for line in fh if line.startswith(("pswpin ", "pswpout ")))
            raw["swap"] = float(v.get("pswpin", 0)) + float(v.get("pswpout", 0))
        except Exception:
            pass
        try:
            with open("/proc/pressure/memory") as fh:
                for line in fh:
                    m = re.match(r"(some|full) avg10=([\d.]+)", line)
                    if m:
                        s["psiSome" if m.group(1) == "some" else "psiFull"] = float(m.group(2))
            self.sources["psi"] = True
        except Exception:
            pass
        try:
            with open("/proc/stat") as fh:
                f = [float(x) for x in fh.readline().split()[1:]]
            raw["cpuT"] = sum(f[:8])
            raw["cpuI"] = f[3] + (f[4] if len(f) > 4 else 0.0)
        except Exception:
            pass
        if self.dev:
            try:
                with open("/proc/diskstats") as fh:
                    for line in fh:
                        p = line.split()
                        if int(p[0]) == self.dev[0] and int(p[1]) == self.dev[1]:
                            raw["read"] = float(p[5]) * 512.0
                            break
            except Exception:
                pass
        pid = self._find_engine()
        if pid:
            try:
                with open("/proc/%d/stat" % pid) as fh:
                    st = fh.read()
                f = st[st.rindex(")") + 2:].split()
                raw["eng"] = (float(f[11]) + float(f[12])) / self.tick
                s["engine"] = True
                self.sources["engine"] = True
                with open("/proc/%d/status" % pid) as fh:
                    for line in fh:
                        if line.startswith("VmRSS:"):
                            s["engineWsMb"] = float(line.split()[1]) / 1024.0
                        elif line.startswith("RssAnon:"):
                            s["enginePrivMb"] = float(line.split()[1]) / 1024.0
            except Exception:
                s["engine"] = False

    def _mac(self, s, raw):
        try:
            s["totalMb"] = float(run(["sysctl", "-n", "hw.memsize"]).strip() or 0) / MB
            vals, page = mac_vm()
            s["availMb"] = sum(vals.get(k, 0.0) for k in ("Pages free", "Pages inactive", "Pages speculative", "Pages purgeable")) * page / MB
            raw["swap"] = vals.get("Swapins", 0.0) + vals.get("Swapouts", 0.0)
            self.sources["memory"] = True
        except Exception:
            pass
        if self.mac_disk:
            txt = run(["iostat", "-Id", self.mac_disk]).strip().splitlines()
            try:
                nums = txt[-1].split()
                raw["read"] = float(nums[2]) * MB  # MB moved since boot (reads and writes)
            except Exception:
                pass
        pid = self.pid
        if pid:
            out = run(["ps", "-o", "rss=,time=", "-p", str(pid)]).split()
            if len(out) >= 2:
                s["engine"] = True
                self.sources["engine"] = True
                s["engineWsMb"] = float(out[0]) / 1024.0
                parts = [float(x) for x in re.split(r"[:]", out[1].replace("-", ":"))]
                sec = 0.0
                for x in parts:
                    sec = sec * 60.0 + x
                raw["eng"] = sec


# =============================================================================
# watch: the story
# =============================================================================
def rank(p):
    return {"heavy": 2, "tight": 1}.get(p, 0)


class Watch:
    def __init__(self, model, mmproj, total_bytes, drive, plan):
        self.model = os.path.basename(model)
        self.bytes = total_bytes
        self.started = now_ms()
        self.phase = "starting"
        self.pressure = "ok"
        self.up = self.down = 0
        self.paging = []
        self.history = []
        self.first_read_t = None
        self.ready_t = None
        self.low_rate = 0
        self.slow = 0
        self.refused = 0
        self.seen_engine = False
        self.seen_health = False
        self.min_avail = None
        self.max_paging = 0.0
        self.worst = "ok"
        self.peak_ws = 0.0
        self.peak_priv = 0.0
        self.last = None
        self.drive = drive
        self.plan = plan

    def step(self, s):
        self.last = s
        if s["engine"]:
            self.seen_engine = True
        if s["health"] > 0:
            self.seen_health = True
        self.history.append(s)
        if len(self.history) > 900:
            self.history.pop(0)
        rate = None
        if s["readBytes"] is not None:
            k = min(5, len(self.history) - 1)
            if k >= 1:
                a = self.history[-1 - k]
                if a["readBytes"] is not None and s["t"] > a["t"]:
                    rate = (s["readBytes"] - a["readBytes"]) / ((s["t"] - a["t"]) / 1000.0) / MB
            if self.first_read_t is None and s["readBytes"] > 16 * MB:
                self.first_read_t = s["t"]
        # memory pressure: up after 2 samples in a row, down after 5 (no flicker)
        if s["pagingPs"] is not None:
            self.paging.append(float(s["pagingPs"]))
            if len(self.paging) > 3:
                self.paging.pop(0)
        pg = sum(self.paging) / len(self.paging) if self.paging else None
        av = s["availMb"]
        level = 0
        if av is not None and av < TIGHT_AVAIL_MB:
            level = 1
        if pg is not None and pg >= TIGHT_PAGING_PS:
            level = 1
        if s["psiSome"] is not None and s["psiSome"] >= 10:
            level = 1
        if av is not None and av < HEAVY_AVAIL_MB and (pg is None or pg >= TIGHT_PAGING_PS):
            level = 2
        if pg is not None and pg >= HEAVY_PAGING_PS and av is not None and av < TIGHT_AVAIL_MB:
            level = 2
        if s["commitPct"] is not None and s["commitPct"] >= HEAVY_COMMIT_PCT:
            level = 2
        if s["psiFull"] is not None and s["psiFull"] >= 10:
            level = 2
        cur = rank(self.pressure)
        if level > cur:
            self.up += 1
            self.down = 0
            if self.up >= 2:
                cur = level
                self.up = 0
        elif level < cur:
            self.down += 1
            self.up = 0
            if self.down >= 5:
                cur = level
                self.down = 0
        else:
            self.up = self.down = 0
        self.pressure = ("ok", "tight", "heavy")[cur]
        if cur > rank(self.worst):
            self.worst = self.pressure
        if av is not None and (self.min_avail is None or av < self.min_avail):
            self.min_avail = av
        if pg is not None and pg > self.max_paging:
            self.max_paging = pg
        if s["engineWsMb"] is not None and s["engineWsMb"] > self.peak_ws:
            self.peak_ws = s["engineWsMb"]
        if s["enginePrivMb"] is not None and s["enginePrivMb"] > self.peak_priv:
            self.peak_priv = s["enginePrivMb"]
        # progress: bytes read from the model's drive, or what the engine holds
        prog = None
        if self.bytes > 0:
            x = 0.0
            if s["readBytes"] is not None:
                x = float(s["readBytes"]) / self.bytes
            if s["engineWsMb"] is not None:
                x = max(x, float(s["engineWsMb"]) * MB / self.bytes)
            if s["readBytes"] is not None or s["engineWsMb"] is not None:
                prog = min(0.99, x)
        # phase. The engine counts as running when its process is there or its
        # address answers (in case the process cannot be looked at).
        if rate is not None and rate < 2 and prog is not None and prog >= 0.5:
            self.low_rate += 1
        else:
            self.low_rate = 0
        if s["health"] > 0:
            self.refused = 0
        else:
            self.refused += 1
        h = s["health"]
        # /health counts only once this start's engine has been seen: an engine
        # that failed to open the port must not make an older server look like ours
        if self.seen_engine and not s["engine"]:
            self.phase = "stopped"
        elif not self.seen_engine:
            self.phase = "stopped" if s["t"] > NO_ENGINE_MS else "starting"
        elif h == 200:
            if self.ready_t is None:
                self.ready_t = s["t"]
            self.phase = "ready"
        elif h == 503:
            self.phase = "preparing" if (prog is not None and (prog >= 0.97 or self.low_rate >= 5)) else "reading"
        elif h == 0:
            if self.phase == "starting" and s["readBytes"] is not None and s["readBytes"] > 64 * MB:
                self.phase = "reading"
        else:
            self.phase = "other"
        # time left
        left = None
        if self.phase == "reading" and rate is not None and rate >= 1 and s["readBytes"] is not None:
            left = (max(0.0, self.bytes - s["readBytes"]) / MB) / rate * 1000.0 + PREPARE_TAIL_MS
        elif self.phase == "preparing":
            left = float(PREPARE_TAIL_MS)
        if self.phase == "reading" and rate is not None and 0.5 <= rate < SLOW_MBPS:
            self.slow += 1
        elif rate is not None and rate >= SLOW_MBPS:
            self.slow = 0
        code, msg, adv = self.tell(s, prog, rate, left)
        return {
            "v": 1, "watcher": "lantern-watch.py " + LW_VERSION, "os": OS_NAME,
            "t": self.started + rnd(s["t"]), "started": self.started,
            "phase": self.phase, "code": code, "message": msg, "advice": adv,
            "model": self.model, "bytes": rnd(self.bytes),
            "read": rnd(s["readBytes"]),
            "progress": 1 if self.phase == "ready" else (round(prog, 4) if prog is not None else None),
            "mbps": round(rate, 1) if rate is not None and self.phase in ("reading", "preparing") else None,
            "leftMs": rnd(left),
            "loadMs": rnd(self.ready_t),
            "pressure": self.pressure,
            "mem": {"totalMb": rnd(s["totalMb"]), "availMb": rnd(av), "commitPct": rnd(s["commitPct"], 1),
                    "pagingPs": rnd(pg), "psiSome": s["psiSome"], "psiFull": s["psiFull"]},
            "cpu": {"totalPct": rnd(s["cpuPct"]), "enginePct": rnd(s["engineCpuPct"])},
            "engine": {"wsMb": rnd(s["engineWsMb"]), "privMb": rnd(s["enginePrivMb"])},
            "drive": {"name": self.drive.get("name"), "kind": self.drive.get("kind"), "slow": self.slow >= 10},
            "plan": self.plan,
        }

    def tell(self, s, prog, rate, left):
        code = self.phase
        msg = adv = ""
        done = None
        if s["readBytes"] is not None:
            done = f1(min(s["readBytes"], self.bytes) / GB)
        whole = f1(self.bytes / GB)
        if self.phase == "starting":
            msg = "Starting Lantern's AI engine."
        elif self.phase == "reading":
            if done is not None and rate is not None and rate >= 1:
                msg = "Reading the AI model from %s: %s of %s GB at %s MB/s" % (self.drive["word"], done, whole, f0(rate))
                msg += (", about %s left." % clock(left)) if left is not None else "."
            elif prog is not None:
                msg = "Loading the AI model (%s%%)." % f0(100 * prog)
            else:
                msg = "Loading the AI model."
            if self.slow >= 10:
                code = "reading-slow"
                adv = ("This drive or USB port is reading slowly (%s MB/s). A USB 3 port (often blue) or a faster "
                       "stick loads it much sooner." % f0(rate))
        elif self.phase == "preparing":
            msg = "The model is read. Getting it ready to answer: a few more seconds."
        elif self.phase == "ready":
            msg = "Lantern's AI is ready."
            if self.ready_t is not None:
                msg = "Lantern's AI is ready (loaded in %s)." % clock(self.ready_t)
        elif self.phase == "stopped":
            msg = "Lantern's AI engine has stopped."
        else:
            msg = "Lantern's AI engine answered unexpectedly."
        if self.phase != "stopped":
            if self.pressure == "heavy":
                code = "pressure"
                adv = ("This computer has run out of free memory, so %s is moving other programs to the disk. It can "
                       "look frozen for a minute or two. Please wait, and do not click or open anything: that makes "
                       "it take longer." % SYSTEM_WORD)
                if self.phase == "ready":
                    adv = "Free memory has run out, so the computer and the AI may be slow. Closing other programs helps."
            elif self.pressure == "tight" and self.phase != "ready":
                if not adv:
                    adv = "Memory is nearly full, so the computer may respond slowly until this finishes. Please do not open other programs meanwhile."
                if code == "reading":
                    code = "reading-tight"
        if self.plan and self.plan.get("choice") == "smaller" and self.phase != "stopped":
            note = "Using %s because only %s of memory was free." % (nice_name(self.plan.get("picked")), gb(float(self.plan.get("availMb") or 0)))
            adv = note if not adv else note + " " + adv
        return code, msg, adv


# ---- the status address for Lantern's loading screen -----------------------------------
class Shared:
    lock = threading.Lock()
    snap = {}
    history = []
    port = 8080


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, body):
        b = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        origin = self.headers.get("Origin", "")
        if origin in ("http://127.0.0.1:%d" % Shared.port, "http://localhost:%d" % Shared.port):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        if b:
            self.wfile.write(b)

    def do_OPTIONS(self):
        self._send(204, "")

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        with Shared.lock:
            if path == "/status":
                body = json.dumps(Shared.snap)
            elif path == "/history":
                body = json.dumps([{"t": int(h["t"]), "read": h["readBytes"], "availMb": h["availMb"],
                                    "pagingPs": h["pagingPs"], "cpuPct": h["cpuPct"], "engineCpuPct": h["engineCpuPct"],
                                    "engineWsMb": h["engineWsMb"], "health": h["health"]} for h in Shared.history[-300:]])
            else:
                body = None
        if body is None:
            self._send(404, '{"error":"not found"}')
        else:
            self._send(200, body)


def start_status(port, page_port):
    Shared.port = page_port
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError:
        say("  Lantern Watch: port %d is busy, so the loading screen will estimate instead." % port)
        return None
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# ---- the terminal ----------------------------------------------------------------------------
class Console:
    def __init__(self):
        self.key = ""
        self.last_line = -99999.0
        self.tty = sys.stdout.isatty()

    def show(self, w, snap):
        if self.tty:
            t = "Lantern AI: "
            if w.phase == "reading":
                t += ("loading %s%%" % f0(100 * snap["progress"])) if snap["progress"] is not None else "loading"
                if snap["leftMs"] is not None:
                    t += ", about %s left" % clock(snap["leftMs"])
            elif w.phase == "preparing":
                t += "almost ready"
            elif w.phase == "ready":
                t += "ready - keep this window open"
            elif w.phase == "stopped":
                t += "stopped"
            else:
                t += "starting"
            if w.pressure == "heavy":
                t += " - low memory, please wait"
            sys.stdout.write("\033]0;%s\007" % t)
        key = "%s|%s|%s" % (w.phase, snap["code"], w.pressure)
        tnow = w.last["t"]
        due = w.phase == "reading" and tnow - self.last_line >= 15000
        if key != self.key or due:
            line = "[Lantern] " + snap["message"]
            if snap["advice"]:
                line += " " + snap["advice"]
            sys.stdout.write(line + "\n")
            sys.stdout.flush()
            self.key = key
            self.last_line = tnow


# ---- the log ---------------------------------------------------------------------------------
def v(x, fmt):
    return "" if x is None else (fmt % x)


def open_log(d):
    if not d:
        return None
    p = os.path.join(d, "load-%s.csv" % time.strftime("%Y%m%d-%H%M%S"))
    try:
        with open(p, "w") as fh:
            fh.write("elapsed_s,phase,health,read_mb,progress,mbps,avail_mb,commit_pct,paging_ps,psi_some,psi_full,"
                     "cpu_pct,engine_cpu_pct,engine_ws_mb,engine_priv_mb,pressure,code\n")
        logs = sorted((f for f in os.listdir(d) if f.startswith("load-") and f.endswith(".csv")),
                      key=lambda f: os.path.getmtime(os.path.join(d, f)), reverse=True)
        for f in logs[KEEP_LOGS:]:
            try:
                os.remove(os.path.join(d, f))
            except OSError:
                pass
        return p
    except Exception:
        return None


class LogBuf:
    rows = []
    flushed = time.time()


def flush_log(path):
    LogBuf.flushed = time.time()
    if not path or not LogBuf.rows:
        return
    try:
        with open(path, "a") as fh:
            fh.write("".join(LogBuf.rows))
    except Exception:
        pass
    LogBuf.rows = []


def write_line(path, s, snap, w):
    # rows are kept in memory and written every LOG_FLUSH_S (and at ready and
    # stop): a write a second to a USB stick with no write cache slows its reads
    if not path:
        return
    rm = s["readBytes"] / MB if s["readBytes"] is not None else None
    cols = [v(s["t"] / 1000.0, "%.1f"), w.phase, str(s["health"]), v(rm, "%.0f"), v(snap["progress"], "%.3f"),
            v(snap["mbps"], "%.1f"), v(s["availMb"], "%.0f"), v(s["commitPct"], "%.1f"), v(snap["mem"]["pagingPs"], "%.0f"),
            v(s["psiSome"], "%.2f"), v(s["psiFull"], "%.2f"), v(s["cpuPct"], "%.0f"), v(s["engineCpuPct"], "%.0f"),
            v(s["engineWsMb"], "%.0f"), v(s["enginePrivMb"], "%.0f"), w.pressure, snap["code"]]
    LogBuf.rows.append(",".join(cols) + "\n")
    if time.time() - LogBuf.flushed >= LOG_FLUSH_S:
        flush_log(path)


def write_summary(d, w, sources):
    if not d:
        return
    read = None
    for h in w.history:
        if h["readBytes"] is not None:
            read = h["readBytes"]
    s = w.last or {}
    avg = None
    if read is not None and w.first_read_t is not None and w.ready_t is not None and w.ready_t > w.first_read_t:
        avg = round(read / MB / ((w.ready_t - w.first_read_t) / 1000.0), 1)
    summ = {
        "v": 1, "when": time.strftime("%Y-%m-%dT%H:%M:%S"), "os": OS_NAME, "model": w.model, "bytes": int(w.bytes),
        "loadMs": int(w.ready_t) if w.ready_t is not None else None,
        "outcome": "ready" if w.ready_t is not None else w.phase,
        "readBytes": int(read) if read is not None else None,
        "readRatio": round(read / w.bytes, 2) if read is not None and w.bytes > 0 else None,
        "avgMbps": avg, "totalMb": rnd(s.get("totalMb")), "minAvailMb": rnd(w.min_avail),
        "maxPagingPs": rnd(w.max_paging), "worstPressure": w.worst,
        "enginePeakWsMb": rnd(w.peak_ws), "enginePeakPrivMb": rnd(w.peak_priv),
        "drive": w.drive.get("kind"), "sources": sources, "plan": w.plan, "watcher": LW_VERSION,
    }
    try:
        with open(os.path.join(d, "last-load.json"), "w") as fh:
            json.dump(summ, fh)
        hist = os.path.join(d, "loads.csv")
        if not os.path.exists(hist):
            with open(hist, "w") as fh:
                fh.write("when,model,gb,outcome,load_s,avg_mbps,read_ratio,total_mb,min_avail_mb,worst_pressure,drive,plan\n")
        row = [summ["when"], summ["model"], "%.1f" % (w.bytes / GB), summ["outcome"],
               v(summ["loadMs"] / 1000.0 if summ["loadMs"] is not None else None, "%.0f"), v(avg, "%.1f"),
               v(summ["readRatio"], "%.2f"), v(summ["totalMb"], "%d"), v(summ["minAvailMb"], "%d"),
               w.worst, str(w.drive.get("kind")), (w.plan or {}).get("choice", "")]
        with open(hist, "a") as fh:
            fh.write(",".join(row) + "\n")
    except Exception:
        pass


def read_plan(d, model_name):
    if not d:
        return None
    try:
        with open(os.path.join(d, "last-plan.json")) as fh:
            j = json.load(fh)
        if now_ms() - float(j.get("t", 0)) > 300000 or j.get("picked") != model_name:
            return None
        return j
    except Exception:
        return None


def do_watch(a, sim):
    if not a.model:
        say("Lantern Watch: no --model given.")
        return
    log_dir = None if sim is not None else get_log_dir(a.log_dir)
    rd = Reader(a, sim)
    drive = rd.drive_info()
    if sim is not None:
        plan = sim.get("planResult")
        total_bytes = file_bytes(a.model, sim) + sim_vbytes(sim, a.model)
    else:
        plan = read_plan(log_dir, os.path.basename(a.model))
        total_bytes = file_bytes(a.model) + (file_bytes(a.mmproj) if a.mmproj else 0.0)
    w = Watch(a.model, a.mmproj, total_bytes, drive, plan)
    log = open_log(log_dir) if sim is None else None
    srv = start_status(a.status_port, a.port) if sim is None else None
    con = Console() if sim is None else None
    snaps = []
    ready_at = None
    summary_done = False
    quit_ = False
    parent = os.getppid()
    total_mb = memory_now(sim)[0]

    def alive(pid):
        if not pid:
            return True
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    try:
        while True:
            s = rd.sample()
            if s is None:
                break
            if s.get("totalMb") is None:
                s["totalMb"] = total_mb
            snap = w.step(s)
            with Shared.lock:
                Shared.snap = snap
                Shared.history = w.history
            if sim is not None:
                snaps.append(snap)
            else:
                con.show(w, snap)
            if w.phase == "ready" and ready_at is None:
                ready_at = time.time()
            if ready_at is None or time.time() - ready_at < 600:
                write_line(log, s, snap, w)
            if w.phase == "ready" and not summary_done:
                summary_done = True
                flush_log(log)
                write_summary(log_dir, w, rd.sources)
            if w.phase == "stopped" or quit_:
                flush_log(log)
                if not summary_done:
                    summary_done = True
                    write_summary(log_dir, w, rd.sources)
                break
            if sim is not None and a.fast:
                continue
            interval = READY_INTERVAL_S if w.phase == "ready" else 1.0
            end = time.time() + interval
            while time.time() < end:
                time.sleep(min(1.0, max(0.0, end - time.time())))
                if os.getppid() != parent:   # start-lantern has gone
                    quit_ = True
                    break
                if rd.pid and not alive(rd.pid):   # read again now: the engine stopped
                    break
    except KeyboardInterrupt:
        pass
    finally:
        flush_log(log)
        if srv:
            srv.shutdown()
        if con and con.tty:
            sys.stdout.write("\033]0;Lantern\007")
            sys.stdout.flush()
    if sim is not None:
        sys.stdout.write(json.dumps(snaps) + "\n")


def do_selftest(a):
    say("Lantern Watch %s self-test (Python %s, %s)" % (LW_VERSION, sys.version.split()[0], OS_NAME))
    total, avail = memory_now()
    say("  memory: %s free of %s" % (gb(avail), gb(total)))
    if a.model:
        rd = Reader(a, None)
        d = rd.drive_info()
        say("  model: %s (%s) on %s [%s]" % (a.model, gb(file_bytes(a.model) / MB), d["name"], d["kind"]))
        rd.sample()
        time.sleep(1.1)
        b = rd.sample()
        say("  readings: " + " ".join("%s=%s" % (k, "yes" if x else "no") for k, x in rd.sources.items()))
        say("  sample: avail %s MB, paging %s/s, psi some %s full %s, cpu %s%%, health %s"
            % (v(b["availMb"], "%.0f"), v(b["pagingPs"], "%.0f"), b["psiSome"], b["psiFull"], v(b["cpuPct"], "%.0f"), b["health"]))
    srv = start_status(a.status_port, a.port)
    if srv:
        say("  status address 127.0.0.1:%d can be opened" % a.status_port)
        srv.shutdown()
    say("  logs: %s" % get_log_dir(a.log_dir))


def main():
    ap = argparse.ArgumentParser(description="Lantern Watch")
    ap.add_argument("mode", nargs="?", default="watch", choices=["plan", "watch", "selftest"])
    ap.add_argument("--model", default="")
    ap.add_argument("--mmproj", default="")
    ap.add_argument("--models", default="")
    ap.add_argument("--no-vision", action="store_true")
    ap.add_argument("--forced", action="store_true")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--status-port", type=int, default=8082)
    ap.add_argument("--engine-pid", type=int, default=0)
    ap.add_argument("--log-dir", default="")
    ap.add_argument("--simulate", default="")
    ap.add_argument("--fast", action="store_true")
    a = ap.parse_args()
    sim = None
    if a.simulate:
        with open(a.simulate) as fh:
            sim = json.load(fh)
    try:
        if a.mode == "plan":
            do_plan(a, sim)
        elif a.mode == "watch":
            do_watch(a, sim)
        else:
            do_selftest(a)
    except Exception as e:
        say("  Lantern Watch stopped (%s); Lantern carries on without it." % e)
        if sim is not None:
            raise
    return 0


if __name__ == "__main__":
    sys.exit(main())
