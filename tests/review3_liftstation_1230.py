# review3_liftstation_1230.py -- the third review of 1.24.30 (the lift station), replayed. A third agent, which had seen
# neither the rules written nor the first two reviews' cases, made 288 cases after the second round of mends
# (tests/fixtures/liftstation_review3_1230/, findings.txt): 54 plain circuits set beside 1.24.29 for over-reach; small
# models' replies; whole Chat turns and the bench's path; one-thing and many-thing questions with every bench question
# as a guard; 16 drawings in Chromium; and every statement Lantern makes checked against what it drew. On that draft 238
# agreed (1 high: a low-level alarm light wired to the high-level alarm float, never to light). After the mending every
# case agrees.
# Usage: python3 tests/review3_liftstation_1230.py [-v]
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "liftstation_review3_1230")
KEEP = {
}
RUNS = [
    ("cases", ["node", os.path.join(FX, "replay.js")], 272, 900),
    ("drawings", [sys.executable, os.path.join(FX, "replay_browser.py")], 16, 900),
]
VERBOSE = "-v" in sys.argv
fails, agree_n, dis_n, total_n = [], 0, 0, 0
for name, cmd, n, limit in RUNS:
    env = dict(os.environ, LANTERN_PNG_OUT=tempfile.mkdtemp(prefix="lantern_ls_png_"))  # the kept PNGs are the review's; a replay does not rewrite them
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=limit, env=env)
    out = r.stdout
    if VERBOSE: print(out)
    agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
    dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
    total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
    if not total: fails.append(name + ": the replay did not finish: " + (r.stderr or out)[-1500:]); continue
    if int(total.group(1)) != n: fails.append("%s: %s cases, not %d" % (name, total.group(1), n))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append(name + ": disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
    agree_n += len(agree); dis_n += len(dis); total_n += int(total.group(1))
for f in fails: print("FAIL", f)
print(("%d THIRD LIFT STATION REVIEW 1.24.30 FAILURES" % len(fails)) if fails else "ALL THIRD LIFT STATION REVIEW 1.24.30 CHECKS PASS (%d of %d agree, %d kept)" % (agree_n, total_n, dis_n))
sys.exit(1 if fails else 0)
