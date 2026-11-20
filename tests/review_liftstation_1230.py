# review_liftstation_1230.py -- the first review of 1.24.30 (the lift station), replayed. An agent that had not seen
# the rules written made 351 judged cases (tests/fixtures/liftstation_review1_1230/): the duplex control circuit
# written every way a model might (the 35B's own two blocks, ISA tags, K contactors, 24 V DC, HOA and select
# switches, overloads, lights on the alternator), each worked over a fill and pump-down cycle by a simulator of its
# own; MAKE PIPING and MAKE LEVELS in every unit, checked against Ten States Standards 42.52, 44.4, 42.64 and
# Ontario 7.2.5; questions split into parts and the bench's questions left whole; and 14 drawings in Chromium, for
# text on text and text cut off. On the draft 248 agreed. After the mending every case agrees but these, each kept
# for the reason given.
# Usage: python3 tests/review_liftstation_1230.py [-v]
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230")
KEEP = {
    "A-35b-select-switch": "SS1 (lead/lag select) in the 35B's block is drawn as written, in M1's rung, and the notes say so and that a selector that fixes the lead pump is not drawn yet. Lantern does not move a switch it cannot place surely (CLAUDE.md, rule 7).",
    "A-isa-tags": "the alarm float now keeps its tag LSHH1, as the case's own 'right' asks, and lights the high level alarm light Lantern adds; the case's map still names it FS1 (written for the draft that renamed it).",
    "A-ref-alt-4letter-tag": "ALTR is now read as the alternator's tag and the circuit is drawn and said, which is the case's own 'right'; the case was written to expect the block back.",
    "B-pipe-ref-extra-check": "a check valve more than there are pumps is drawn on the force main after the vault and said, not sent back.",
    "B-pipe-ref-air-release-words": "an air release valve is drawn on the force main (a box marked A) and said, not sent back as a part Lantern does not draw.",
    "B-pipe-ref-check-on-force-main": "a check valve written 'on the force main' is drawn there and said; nothing goes back, so no line can give P1 two checks.",
    "C-plan-and-sheet": "'a sheet of the seed costs' does not bring the sheet tool, as on 1.24.29; the planting plan is made, and the question is answered as one thing.",
    "C-guard-bench-A": "make-liftstation, Adam's own question of three drawings, is split by design and graded part by part; every other question of set A is left whole.",
    "C-guard-bench-B": "make-liftstation-b, its twin in set B, is split by design; every other question of set B is left whole.",
}
RUNS = [
    ("cases", ["node", os.path.join(FX, "replay.js")], 351, 900),
    ("drawings", [sys.executable, os.path.join(FX, "replay_browser.py"), "8337"], 14, 900),
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
print(("%d LIFT STATION REVIEW 1.24.30 FAILURES" % len(fails)) if fails else "ALL LIFT STATION REVIEW 1.24.30 CHECKS PASS (%d of %d agree, %d kept)" % (agree_n, total_n, dis_n))
sys.exit(1 if fails else 0)
