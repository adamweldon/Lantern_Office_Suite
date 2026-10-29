#!/usr/bin/env python3
"""Lantern Watch tests: replays every fixture through lantern-watch.py and,
when PowerShell is available (PWSH=/path/to/pwsh, or pwsh on PATH), through
lantern-watch.ps1 too, checks each scenario tells the right story, and checks
both watchers agree sample by sample (same phases, codes, numbers).

    python3 tests/lantern_watch/run_tests.py [path/to/Lantern/kit]

With no path it tests this repository's kit folder. npm test runs it.
"""
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..", "kit")
PY = os.path.join(KIT, "lantern-watch.py")
PS = os.path.join(KIT, "lantern-watch.ps1")
FIX = os.path.join(HERE, "fixtures")
PWSH = os.environ.get("PWSH") or shutil.which("pwsh")

fails = []
checks = 0


def check(cond, what):
    global checks
    checks += 1
    if not cond:
        fails.append(what)
        print("  FAIL " + what)


def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300)
    return p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")


def py_watch(fx, model):
    rc, out, err = run([sys.executable, "-I", PY, "watch", "--model", "/kit/models/" + model, "--simulate", fx, "--fast"])
    if rc != 0:
        print(err)
    return json.loads(out.strip().splitlines()[-1])


def ps_watch(fx, model):
    rc, out, err = run([PWSH, "-NoProfile", "-File", PS, "watch", "-Model", "/kit/models/" + model, "-Simulate", fx, "-Fast"])
    if rc != 0:
        print(err)
    return json.loads(out.strip().splitlines()[-1])


def py_plan(fx, data):
    cmd = [sys.executable, "-I", PY, "plan", "--model", "/kit/models/" + data["model"], "--models", "/kit/models", "--simulate", fx]
    if data.get("forced"):
        cmd.append("--forced")
    if data.get("novision"):
        cmd.append("--no-vision")
    rc, out, err = run(cmd)
    return [l for l in out.splitlines() if "=" in l], err


def ps_plan(fx, data):
    cmd = [PWSH, "-NoProfile", "-File", PS, "plan", "-Model", "/kit/models/" + data["model"], "-Models", "/kit/models", "-Simulate", fx]
    if data.get("forced"):
        cmd.append("-Forced")
    if data.get("novision"):
        cmd.append("-NoVision")
    rc, out, err = run(cmd)
    return [l for l in out.splitlines() if "=" in l], err


def model_of(name, data):
    if "smaller" in name:
        return data["planResult"]["picked"]
    return data["models"][0]["name"]


def phases(snaps):
    seq = []
    for s in snaps:
        if not seq or seq[-1] != s["phase"]:
            seq.append(s["phase"])
    return seq


def story_checks(name, snaps):
    ph = phases(snaps)
    codes = set(s["code"] for s in snaps)
    if name == "watch_usb_normal":
        check(ph == ["starting", "reading", "preparing", "ready", "stopped"], name + ": phases " + str(ph))
        rd = [s for s in snaps if s["phase"] == "reading" and s["mbps"] is not None]
        check(rd and abs(rd[len(rd) // 2]["mbps"] - 120) < 1, name + ": reads at 120 MB/s")
        mid = rd[len(rd) // 2]
        check("USB stick" in mid["message"] and "MB/s" in mid["message"] and "left" in mid["message"], name + ": message says stick, speed, time left: " + mid["message"])
        prog = [s["progress"] for s in snaps if s["phase"] == "reading"]
        check(all(b >= a for a, b in zip(prog, prog[1:])), name + ": progress never goes back")
        lefts = [s["leftMs"] for s in rd]
        check(lefts[5] > lefts[-1], name + ": time left falls")
        check(all(s["pressure"] == "ok" for s in snaps), name + ": no memory pressure")
        check("reading-slow" not in codes, name + ": not called slow")
        check(snaps[-2]["loadMs"] is not None and 145000 <= snaps[-2]["loadMs"] <= 160000, name + ": load time ~2.5 min: %s" % snaps[-2]["loadMs"])
        check(snaps[-2]["progress"] == 1, name + ": ready is 100%")
    elif name == "watch_usb_slow":
        check("reading-slow" in codes, name + ": called slow")
        first = next(i for i, s in enumerate(snaps) if s["code"] == "reading-slow")
        check(10 <= first <= 13, name + ": slow only after ~10 s (at %d)" % first)
        check(any("reading slowly (35 MB/s)" in s["advice"] for s in snaps), name + ": advice names the speed")
        check(ph[-1] == "stopped", name + ": stops when the engine goes")
    elif name == "watch_pressure":
        check("pressure" in codes, name + ": memory pressure told")
        hv = next(s for s in snaps if s["pressure"] == "heavy")
        check("run out of free memory" in hv["advice"] and "do not click" in hv["advice"] and "still loading" in hv["advice"], name + ": tells the person to wait: " + hv["advice"])
        check(any(s["pressure"] == "tight" for s in snaps), name + ": tight before/after")
        ps = [s["pressure"] for s in snaps]
        flips = sum(1 for a, b in zip(ps, ps[1:]) if a != b)
        check(flips <= 6, name + ": pressure does not flicker (%d changes)" % flips)
        check("ready" in ph and ph[-1] == "stopped", name + ": still gets to ready " + str(ph))
    elif name in ("watch_work_prefetch", "watch_free_paging"):
        # real laptops that were fine: no warning (1.1)
        check(all(s["pressure"] == "ok" for s in snaps), name + ": no memory warning: " + str(sorted(set(s["pressure"] for s in snaps))))
        check("pressure" not in codes and "reading-tight" not in codes, name + ": no pressure codes " + str(sorted(codes)))
        check(ph[:4] == ["starting", "reading", "preparing", "ready"], name + ": phases " + str(ph))
    elif name == "watch_cached":
        r = next(i for i, s in enumerate(snaps) if s["phase"] == "ready")
        check(r <= 8, name + ": ready within 8 s")
        check(any(s["progress"] and s["progress"] > 0.5 for s in snaps[:r]), name + ": progress from the engine's memory when nothing is read")
    elif name == "watch_never_starts":
        check("reading" not in ph and ph[-1] == "stopped", name + ": " + str(ph))
        check(30000 < snaps[-1]["t"] - snaps[-1]["started"] <= 32000, name + ": gives up after 30 s")
    elif name == "watch_other_server":
        check("ready" not in ph, name + ": another Lantern's server is never taken for ours " + str(ph))
        check(ph == ["starting", "stopped"], name + ": " + str(ph))
    elif name == "watch_smaller_plan":
        rd = next(s for s in snaps if s["phase"] == "reading")
        check(rd["advice"].startswith("Using Qwen3.5-9B-Q4_K_M because only 13.6 GB"), name + ": says why the smaller model: " + rd["advice"])
        check(rd["plan"]["choice"] == "smaller", name + ": plan in status")


def same(a, b, path=""):
    keys = ["phase", "code", "pressure", "progress", "leftMs", "mbps", "read", "loadMs", "bytes"]
    for k in keys:
        x, y = a.get(k), b.get(k)
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            tol = 1.5 if k == "leftMs" else (0.11 if k == "mbps" else (1e-3 if k == "progress" else 1))
            if abs(x - y) > tol:
                return "%s%s %r vs %r" % (path, k, x, y)
        elif x != y:
            return "%s%s %r vs %r" % (path, k, x, y)
    for k in ["availMb", "pagingPs"]:
        if a["mem"].get(k) != b["mem"].get(k):
            return "%smem.%s %r vs %r" % (path, k, a["mem"].get(k), b["mem"].get(k))
    if a["drive"]["slow"] != b["drive"]["slow"]:
        return path + "drive.slow"
    if bool(a["advice"]) != bool(b["advice"]):
        return "%sadvice presence: %r vs %r" % (path, a["advice"], b["advice"])
    return None


def main():
    subprocess.run([sys.executable, os.path.join(HERE, "make_fixtures.py"), FIX], check=True, stdout=subprocess.DEVNULL)
    names = sorted(f[:-5] for f in os.listdir(FIX) if f.endswith(".json"))
    print("Lantern Watch tests (%s)" % ("Python and PowerShell" if PWSH else "Python only: no pwsh found"))
    for name in names:
        fx = os.path.join(FIX, name + ".json")
        with open(fx) as fh:
            data = json.load(fh)
        print("- " + name)
        if name.startswith("plan_"):
            got, err = py_plan(fx, data)
            check(got == data["expect"], name + " (py): %s, expected %s" % (got, data["expect"]))
            if PWSH:
                pgot, perr = ps_plan(fx, data)
                # Windows passes no --prio (llama.cpp's LOW keeps Windows 11 power throttling on)
                pexp = [e for e in data["expect"] if not e.startswith("ARGS=")]
                check(pgot == pexp, name + " (ps): %s, expected %s. %s" % (pgot, pexp, perr[-300:]))
            continue
        m = model_of(name, data)
        snaps = py_watch(fx, m)
        story_checks(name, snaps)
        for k in ("v", "phase", "code", "message", "advice", "progress", "leftMs", "pressure", "mem", "drive", "plan"):
            check(all(k in s for s in snaps), name + ": every status has " + k)
        if PWSH:
            psn = ps_watch(fx, m)
            check(len(psn) == len(snaps), name + ": same number of samples (%d py, %d ps)" % (len(snaps), len(psn)))
            story_checks(name + "", psn) if False else None
            for i, (a, b) in enumerate(zip(snaps, psn)):
                d = same(a, b, "sample %d: " % i)
                if d:
                    check(False, name + " parity: " + d)
                    break
            else:
                check(True, name + " parity")
            story_checks(name, psn)
    print("%d checks, %d failed" % (checks, len(fails)))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
