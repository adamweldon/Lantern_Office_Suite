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
    # (1.24.31)
    "A-no-floats": "a duplex for a lift station written with no floats at all (the 2B's, on 1.24.30) gets the usual four floats, from the bottom up, said and wired (tests/station.js); this case was written to expect the block back asking for them.",
    "D-bench-grade-ideal": "the bench item's own model answer is one MAKE STATION block now; this replay runs on Lantern without AI_STATION, where it cannot be made. tests/station.js grades it on the whole Lantern, with the 1.24.30 answer (the three blocks) too.",
    "D-bench-b-grade-ideal": "set B's twin, the same: its model answer is one MAKE STATION block now, graded in tests/station.js.",
    "D-turn-control-again-for-piping": "a second MAKE CONTROL when the piping is asked for is no longer taken for the piping: Lantern asks for the MAKE PIPING block again with its own instructions, and never says the piping was made. The scripted model's replies stay CONTROL then LEVELS, so no piping block is ever written, and the case's check (PIPING among the blocks made) cannot pass.",
    "D-turn-schematic-then-obeys": "the MAKE SCHEMATIC written for the piping now goes back asking for MAKE PIPING, not MAKE CONTROL; the scripted model then writes MAKE CONTROL, which it was not told, and never a piping block.",
    "D-solve-control-again": "on the bench's path the piping is asked for again and recorded as not made (PIPING(not made)); the scripted model never writes a piping block.",
    "E-ctl-long-float-labels": "the floats' labels now keep their own words (all pumps off, lead pump on, lag pump on); the two cut alike are the alarm float FS4 and the light LT1 it lights, both 'high level alarm', told apart by their tags.",
}
# (1.24.31) A station asked for whole is one MAKE STATION block now (AI_STATION; tests/station.js,
# tests/review_station_1231.py). This review was of the 1.24.30 path -- the three drawings made one at a time -- which a
# Lantern without AI_STATION still takes, so its cases replay on the source without that module (no_station()); its
# drawings in Chromium read a station's own drawing of the block's kind.
def no_station():
    src = open(os.path.join(ROOT, "src", "lantern.inner.html"), encoding="utf-8").read()
    a, b = src.index("// MODULE: AI_STATION - START"), src.index("// MODULE: AI_STATION - END")
    f = tempfile.NamedTemporaryFile("w", suffix=".html", prefix="lantern_no_station_", delete=False, encoding="utf-8")
    f.write(src[:a] + src[b:]); f.close()
    return f.name
NOST = no_station()
RUNS = [
    ("cases", ["node", os.path.join(FX, "replay.js"), NOST], 607, 900),
    ("drawings", [sys.executable, os.path.join(FX, "replay_browser.py")], 17, 900),
]
VERBOSE = "-v" in sys.argv
fails, agree_n, dis_n, total_n = [], 0, 0, 0
for name, cmd, n, limit in RUNS:
    env = dict(os.environ, LANTERN_SRC=NOST, LANTERN_PNG_OUT=tempfile.mkdtemp(prefix="lantern_ls_png_"))  # the kept PNGs are the review's; a replay does not rewrite them
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
