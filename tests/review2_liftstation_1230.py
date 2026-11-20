# review2_liftstation_1230.py -- the second review of 1.24.30 (the lift station), replayed. A second agent, which had
# seen neither the rules written nor the first review's cases, made 624 cases after the first review's mends
# (tests/fixtures/liftstation_review2_1230/, FINDINGS.md): the duplex control as models write it, simulated over four
# fill and pump-down cycles; 22 plain circuits set beside 1.24.29; MAKE PIPING and MAKE LEVELS in every unit and
# wording, the standards opened and read; questions in parts, whole Chat turns and the bench's path with a scripted
# model; all 300 bench questions as a guard; and 17 drawings in Chromium. On that draft 555 agreed (10 high: ft-in
# with a dash read as feet alone; depths below grade turning the floats and not the inlet; alternator ar m1 m2 in
# lower case sent back with a wrong line). After the mending every case agrees but these, each kept for the reason
# given.
# Usage: python3 tests/review2_liftstation_1230.py [-v]
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "liftstation_review2_1230")
KEEP = {
    "D-turn-control-again-for-piping": "a second MAKE CONTROL when the piping is asked for is no longer taken for the piping: Lantern asks for the MAKE PIPING block again with its own instructions, and never says the piping was made. The scripted model's replies stay CONTROL then LEVELS, so no piping block is ever written, and the case's check (PIPING among the blocks made) cannot pass.",
    "D-turn-schematic-then-obeys": "the MAKE SCHEMATIC written for the piping now goes back asking for MAKE PIPING, not MAKE CONTROL; the scripted model then writes MAKE CONTROL, which it was not told, and never a piping block.",
    "D-solve-control-again": "on the bench's path the piping is asked for again and recorded as not made (PIPING(not made)); the scripted model never writes a piping block.",
    "E-ctl-long-float-labels": "the floats' labels now keep their own words (all pumps off, lead pump on, lag pump on); the two cut alike are the alarm float FS4 and the light LT1 it lights, both 'high level alarm', told apart by their tags.",
}
RUNS = [
    ("cases", ["node", os.path.join(FX, "replay.js")], 607, 900),
    ("drawings", [sys.executable, os.path.join(FX, "replay_browser.py")], 17, 900),
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
print(("%d SECOND LIFT STATION REVIEW 1.24.30 FAILURES" % len(fails)) if fails else "ALL SECOND LIFT STATION REVIEW 1.24.30 CHECKS PASS (%d of %d agree, %d kept)" % (agree_n, total_n, dis_n))
sys.exit(1 if fails else 0)
