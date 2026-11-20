# replay.py -- the second grid reviewer's cases (cases.py), played in Chromium against site/index.html with the real
# mouse and keyboard, each case in a fresh page; formula moves judged against lo_expect.json (LibreOffice Calc, run
# lo_expect.py to make it again). Prints AGREE <id>, or DISAGREE <id> <what differs> [harm], per judged case, and
# a last line "<n> cases: <a> AGREE, <d> DISAGREE". A case Excel's behaviour is not sure for prints UNJUDGED and is
# not counted.
# Usage: python3 tests/fixtures/grid2_1269/replay.py [-k id-regex] [--port 8241]
import json, os, re, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, HERE)
import engine
from cases import CASES
from playwright.sync_api import sync_playwright


def main():
    args = sys.argv[1:]
    pat = args[args.index("-k") + 1] if "-k" in args else None
    port = int(args[args.index("--port") + 1]) if "--port" in args else 8241
    lo = json.load(open(os.path.join(HERE, "lo_expect.json")))
    cases = [c for c in CASES if not pat or re.search(pat, c["id"])]
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    agree = disagree = 0
    try:
        time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch()
            for c in cases:
                ctx = b.new_context(viewport={"width": 1366, "height": 768}, accept_downloads=True, has_touch=bool(c.get("touch")))
                ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://127.0.0.1:%d" % port)
                ctx.set_default_timeout(6000)
                pg = ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                try:
                    pg.goto("http://127.0.0.1:%d/index.html#sheet" % port)
                    pg.wait_for_function("() => window.Lantern && window.Lantern.sheetDocs && document.querySelector('.ws, body')")
                    pg.wait_for_timeout(500)
                    bad, st = engine.run_case(pg, c, lo)
                except Exception as e:
                    bad, st = ["could not be played: " + str(e).split("\n")[0][:200]], None
                if errs:
                    bad.append("page error: " + errs[0][:200])
                ctx.close()
                if not c.get("judged", True):
                    print("UNJUDGED %s %s" % (c["id"], "; ".join(bad).replace(", Excel ", ", a guess at Excel ") or "as guessed"))
                elif bad:
                    disagree += 1
                    print("DISAGREE %s %s [%s]" % (c["id"], "; ".join(bad), c["harm"]))
                else:
                    agree += 1
                    print("AGREE %s" % c["id"])
                sys.stdout.flush()
            b.close()
    finally:
        srv.terminate()
    print("%d cases: %d AGREE, %d DISAGREE" % (agree + disagree, agree, disagree))


if __name__ == "__main__":
    main()
