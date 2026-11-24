# review_givens_1236.py -- the review of 1.24.36's givens (GIVENS, GIVENS_CONTROL, AI_CONTROL's promptOf), replayed. An
# agent that had not seen the givens written made 235 cases (tests/fixtures/givens_review_1236/, findings.txt) with
# 1.24.35 beside the draft: 54 questions each given fits (each simulated on the ladder Lantern draws), 79 where what is
# shown must be fitted right (lights, stations, supply, load, cut-out, timer, floats) or a near miss its words catch, 51
# near misses that must get 1.24.35's prompt byte for byte, the bench as a guard (every prompt, Chat's system prompt,
# 1,221 saved replies, 944 graded rows, 66 ideals), the modules dropped, and the givens changed the way a model changes
# them. On the draft 148 agreed (47 high: any light word gave a run light; one station for "two push-button stations";
# the motor's voltage as the control's; the three-wire starter shown for two-wire, hand-off-auto, drives, starting
# methods and loads with no motor; "sequence of operation" taken as a sequence start; off-delays as the delayed start,
# whose overload let the motor restart by itself when reset; a refrigeration low-pressure cut-out shown as an air
# compressor's; fill and drain together as a fill). The givens were made surer (a given only where it is sure to fit;
# lights read word by word; stations, the control voltage and the load from the question's own words; the delayed
# start's overload in the run relay's rung too); a fill on two floats now holds itself in (found through the givens, as
# on 1.24.35), with a given of its own. A second review (givens_review2_1236) found the fitting still too loose, and a
# given is now shown only where every word of the question is one it knows. After the mending every case agrees but
# these, each kept for the reason given.
# Usage: python3 tests/review_givens_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "givens_review_1236")
KEEP = {
    "A-rv-both-directions": "a hoist that runs both ways gets no given now: a hoist, a winch or a crane is held to run (its pendant's buttons "
                            "momentary, nothing sealed in), with limits of travel, which a three-wire reversing starter is not -- the second "
                            "review's H3. The question gets the instructions as 1.24.35 gave them.",
    "E-reversing-one-overload-twice": "a reversing starter's one overload contact is drawn in each coil's rung (overload OL1 M1 M2), "
                                      "as every Lantern ladder has drawn a shared overload since 1.18.0; NEMA/JIC diagrams draw it once, in "
                                      "the common line. Both open together, so the circuit is right; drawing it once is DRAW_LADDER's work, in the queue.",
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
    if int(total.group(1)) != 235: fails.append("%s cases, not 235" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL GIVENS REVIEW 1.24.36 CHECKS PASS" if not fails else "GIVENS REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
