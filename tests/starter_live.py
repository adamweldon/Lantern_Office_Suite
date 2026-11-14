#!/usr/bin/env python3
"""starter_live.py -- the Lantern starter for real, on the computer this runs on
(1.24.19; GitHub's Windows, Mac and Linux computers run it, see
.github/workflows/lantern-starter.yml). Nothing stands in: the kit's own
installer fetches the real engine and the real small model from their sites.

  python3 tests/starter_live.py --exe <the starter> --zip <Lantern.zip> --home <empty folder>

The starter is run as a person's double-click runs it (with no browser and no
desktop icon, and only the small model), and this checks, from outside, what a
person would see: the page at once; the AI saying it is still coming; the
downloads' progress; the AI answering through Lantern's own address; Stop
stopping the AI too; and a second start, from the copy it left in the folder,
finding everything and starting the AI with no download. Then the starter's
log, for whoever reads the job.
"""
import argparse, json, os, socket, subprocess, sys, time, urllib.error, urllib.request

P = argparse.ArgumentParser()
P.add_argument("--exe", required=True, help="the starter program (on a Mac, Lantern.app/Contents/MacOS/Lantern)")
P.add_argument("--zip", required=True)
P.add_argument("--home", required=True, help="where Lantern goes (an empty or missing folder)")
P.add_argument("--port", type=int, default=8080)
P.add_argument("--minutes", type=float, default=45)
A = P.parse_args()
BASE = "http://127.0.0.1:%d" % A.port
WIN = os.name == "nt"
passes, fails = 0, 0
T0 = time.time()
NET = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # Lantern's own address: never through a proxy


def say(*a):
    print("[%5.0fs]" % (time.time() - T0), *a, flush=True)


def ok(name, cond, info=""):
    global passes, fails
    if cond:
        passes += 1
        say("ok  ", name)
    else:
        fails += 1
        say("FAIL", name, str(info)[:600])
    return cond


def get(path, timeout=10):
    """(status, body text); status 0 when nothing answers"""
    try:
        with NET.open(BASE + path, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


def post(path, body, timeout=10, headers=None):
    h = {"Content-Type": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=h, method="POST")
    try:
        with NET.open(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


def status():
    c, b = get("/lantern-setup/status")
    try:
        return json.loads(b) if c == 200 else None
    except ValueError:
        return None


def port_open(port):
    s = socket.socket()
    s.settimeout(2)
    try:
        s.connect(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def start(exe):
    args = [exe, "--zip", A.zip, "--home", A.home, "--no-browser", "--no-shortcuts", "--plan", "small", "--port", str(A.port)]
    if exe.endswith(".sh") or (not WIN and open(exe, "rb").read(2) == b"#!"):
        args = ["sh"] + args   # the Mac's launcher script, as the .app runs it
    say("starting:", " ".join(args))
    return subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def wait_page(secs):
    end = time.time() + secs
    while time.time() < end:
        c, b = get("/")
        if c == 200:
            return b
        time.sleep(0.5)
    return ""


def wait_ready(secs, watch_progress=False):
    """until the AI is ready; prints the corner button's sentence as it changes"""
    end, last, seen_progress, st = time.time() + secs, "", False, None
    while time.time() < end:
        st = status()
        if st:
            msg = st.get("message", "")
            if msg != last:
                say("  status:", msg, "| AI:", json.dumps(st.get("ai")))
                last = msg
            for j in st.get("jobs", []):
                if j.get("state") == "running" and j.get("total", 0) > 0 and 0 < j.get("bytes", 0) < j["total"]:
                    seen_progress = True
            if st.get("ai", {}).get("state") == "ready":
                return st, seen_progress
            failed = [j for j in st.get("jobs", []) if j.get("state") == "failed"]
            if failed:
                return st, seen_progress
        time.sleep(2)
    return st, seen_progress


def ask():
    body = {"messages": [{"role": "user", "content": "What is 2 + 2? Answer with the number only."}], "max_tokens": 400, "temperature": 0}
    c, b = post("/v1/chat/completions", body, timeout=600)
    try:
        m = json.loads(b)["choices"][0]["message"]
        return c, (m.get("content") or "").strip(), (m.get("reasoning_content") or "").strip()
    except (ValueError, KeyError, IndexError, TypeError):
        return c, "", b[:400]


def stop(proc, engine_port=8090):
    c, b = post("/lantern-setup/stop", {})
    ok("Stop Lantern is answered", c == 200, (c, b))
    try:
        proc.wait(timeout=90)
        exited = True
    except subprocess.TimeoutExpired:
        exited = False
    ok("...the starter has stopped", exited)
    end = time.time() + 30
    while time.time() < end and (port_open(engine_port) or port_open(A.port)):
        time.sleep(1)
    ok("...and the AI with it (nothing left on its ports)", not port_open(engine_port) and not port_open(A.port))
    if not exited:
        proc.kill()


def show_logs():
    root = A.home
    print("=== STARTER LOG", flush=True)
    for name in ("starter.log",):
        p = os.path.join(root, "kit", "logs", name)
        if os.path.exists(p):
            print(open(p, encoding="utf-8", errors="replace").read()[-20000:])
    d = os.path.join(root, "kit", "logs")
    if os.path.isdir(d):
        print("--- kit/logs:", sorted(os.listdir(d)))
        for n in sorted(os.listdir(d)):
            if n != "starter.log" and os.path.isfile(os.path.join(d, n)):
                txt = open(os.path.join(d, n), encoding="utf-8", errors="replace").read()
                print("--- %s (last 40 lines)" % n)
                print("\n".join(txt.splitlines()[-40:]))
    print("=== END STARTER LOG", flush=True)


def main():
    if os.path.exists(os.path.join(A.home, "site")):
        sys.exit("starter_live: --home must not hold a Lantern already")
    ok("nothing on Lantern's address before", not port_open(A.port))

    # 1. the first double-click: installs, serves the page, fetches the AI in the background
    proc = start(A.exe)
    page = wait_page(120)
    ok("the page is there at once (from the Lantern.zip it set up)", "Lantern" in page, page[:200])
    ok("Lantern is set up in the folder, with the starter's own copy beside it",
       os.path.isfile(os.path.join(A.home, "site", "index.html")) and os.path.isfile(os.path.join(A.home, "Lantern.exe" if WIN else "Lantern")))
    c, b = get("/v1/models")
    st = status() or {}
    if st.get("ai", {}).get("state") in ("downloading", "none", None):
        ok("the AI, asked before it is here, says it is still being downloaded", c == 404 and "still being downloaded" in b, (c, b[:200]))
    ok("the plan: the engine and the small model", [j.get("id") for j in st.get("jobs", [])] == ["engine", "0.8b"], st.get("jobs"))
    st, progress = wait_ready(A.minutes * 60, True)
    ok("the downloads said how far they had got (bytes of a known size)", progress)
    ready = ok("the AI is ready", st and st.get("ai", {}).get("state") == "ready", st)
    if ready:
        ok("...with the small model", "0.8B" in (st["ai"].get("model") or ""), st["ai"])
        ok("...both downloads done", all(j.get("state") == "done" for j in st.get("jobs", [])), st.get("jobs"))
        t = time.time()
        c, content, thought = ask()
        say("  the reply (%.0fs): %r" % (time.time() - t, content[:300] or thought[:300]))
        ok("the AI answers through Lantern's own address", c == 200 and (content or thought), (c, content, thought))
        ok("the offers are there (the encyclopedia, the shelves)", {"library", "shelves"} <= {f.get("id") for f in st.get("offers", [])}, st.get("offers"))
        c, b = post("/lantern-setup/choose", {"id": "nothing-of-the-sort"})
        ok("an unknown choice is refused", c == 400, (c, b[:200]))
        c, b = post("/lantern-setup/stop", {}, headers={"Origin": "https://example.com"})
        time.sleep(1)
        ok("another site's page may not stop Lantern", c == 403 and proc.poll() is None, (c, proc.poll()))
    stop(proc)

    # 2. the second double-click, on the copy it left: everything is there, no downloads
    exe2 = os.path.join(A.home, "Lantern.exe" if WIN else "Lantern")
    if ready and os.path.isfile(exe2):
        proc = start(exe2)
        ok("started again: the page", "Lantern" in wait_page(60))
        st = status() or {}
        ok("...nothing to download", not st.get("jobs"), st.get("jobs"))
        st, _ = wait_ready(600)
        ok("...and the AI ready again", st and st.get("ai", {}).get("state") == "ready", st)
        c, content, thought = ask()
        ok("...and answering", c == 200 and (content or thought), (c, content, thought))
        stop(proc)

    show_logs()
    print(("ALL LIVE STARTER CHECKS PASS (%d)" % passes) if not fails else ("%d LIVE STARTER FAILURES (%d passed)" % (fails, passes)), flush=True)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        show_logs()
        raise
