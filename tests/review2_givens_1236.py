# review2_givens_1236.py -- the second review of 1.24.36's givens and the user's own givens, replayed.
# An agent that had not seen the givens written, nor the first review's cases, made 293 cases
# (tests/fixtures/givens_review2_1236/, findings.txt) on the draft mended after the first review, with 1.24.35 beside
# it: 174 questions (what the model is shown), 39 builds simulated, 30 of "stop PB1 all" and the fill on two floats, 17
# saved replies, 33 of the user's own givens. On that draft 209 agreed (37 high: sequences the wrong way round or for
# machines the given lacks, Lantern's own "10 s" for a time said in words, the starter for two machines, street lights,
# a kiln and hoists, the fill for a booster or a well's dry-run float, a kept circuit shown on two shared words above
# everything). The givens now refuse a question with a word they do not know, read the order a sequence is said in,
# times in words and hours, and a kept circuit is shown only for the same circuit. After the mending every case agrees
# but these, each kept for the reason given.
# Usage: python3 tests/review2_givens_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "givens_review2_1236")
KEEP = {
    "R-16": "a fill with its start float written normally open and its stop float nc is now sent back once with the start float's nc line (the fourth review's rp-fill2-mixed: as drawn the pump runs only between the floats and never starts on an empty tank). The case guarded the rule as first drafted.",
    "F-fl-07": "AI_PARTS cuts \u201c... with a float, 24 V DC control, and a pump running light\u201d into two parts and the given is fitted to the first (no supply, no light); fitted to the whole question it has both. The cut is AI_PARTS\" (older): in the queue.",
    "F-sp-13": "the same AI_PARTS cut for a sump pump with 24 V control and a running light: in the queue.",
    "S-dl-02": "the delayed start's one overload contact is drawn in the run relay's rung and the motor's (overload OL1 M1 CR1): both open together, so the circuit is right, and the reset never restarts the motor; drawing one contact once is DRAW_LADDER's work, in the queue.",
    "S-rv-04": "the reversing starter's one overload contact drawn in each coil's rung, as every Lantern ladder has drawn a shared overload since 1.18.0: right, but drawn twice; in the queue.",
    "R-12": "a fill with two stop buttons and its low and high nc floats is now held in between: the review's own H5 asked for the hold-in beside a stop button (in series the pump short-cycles at the low float). The case guarded the rule as first drafted.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(FX, "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=900)
out = r.stdout
if VERBOSE: print(out)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) < 293: fails.append("%s cases, fewer than 293" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL SECOND GIVENS REVIEW 1.24.36 CHECKS PASS" if not fails else "SECOND GIVENS REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
