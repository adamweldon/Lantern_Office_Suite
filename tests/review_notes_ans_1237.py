# review_notes_ans_1237.py -- the review of ANS in a drawing's notes (1.24.37), replayed.
# An agent that had not seen the change written made 145 cases of its own and 60 guard cases
# (tests/fixtures/review_notes_ans_1237/, findings.txt), with every saved reply with a MAKE block (578 after Adam's run of 1.24.36 was saved; the guard was remade from 50f9ceb with it) and the 300 bench
# prompts as guards, all unchanged by this change. It found two high: ANS1, ANS2 counted by sums in the notes where the
# prompt counts them by lines ("It = {=9/ANS2} A" took another note's value), and a wrong total carried through ANS
# ("{=100*200/(100+200)}" then "Rt = {=ANS} ohm") drawn beside Lantern's own. Now a note reads only ANS, and says what
# to write in place of ANS1, ANS2; and a sum that takes ANS carries the numbers of the sum before it into the total's
# check. The guard cases on the transistor replies changed with the other change of 1.24.37 (a transistor's load read
# in, tests/review_electronics_1237.py) and are judged there. After the mending every case agrees but these.
# Usage: python3 tests/review_notes_ans_1237.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review_notes_ans_1237")
KEEP = {
    "guard-bench_run_1.24.31_2b-26": "a saved transistor reply (an Arduino pin switching a 12 V relay or motor) that the other change of 1.24.37 reads differently -- the kind the question asks for named in what goes back in place of the guide's K1; judged by its own reviews, tests/review_electronics_1237.py and review2_electronics_1237.py.",
    "guard-bench_run_1.24.35_0.8b-29": "a saved transistor reply (an Arduino pin switching a 12 V relay or motor) that the other change of 1.24.37 reads differently -- the kind the question asks for named in what goes back in place of the guide's K1; judged by its own reviews, tests/review_electronics_1237.py and review2_electronics_1237.py.",
    "guard-bench_run_1.24.36_35b_setb-37": "Adam's laptop's own reply (bench_run_1.24.36_35b_setb.json, the parallel lesson): drawn now with \u201cTotal current It = 1.8 A\u201d -- the change itself.",
    "guard-bench_run_1244_08b-18": "a saved transistor reply (an Arduino pin switching a 12 V relay or motor) that the other change of 1.24.37 reads differently -- the kind the question asks for named in what goes back in place of the guide's K1; judged by its own reviews, tests/review_electronics_1237.py and review2_electronics_1237.py.",
    "guard-bench_run_1246_2b-12": "a saved transistor reply (an Arduino pin switching a 12 V relay or motor) that the other change of 1.24.37 reads differently -- the kind the question asks for named in what goes back in place of the guide's K1; judged by its own reviews, tests/review_electronics_1237.py and review2_electronics_1237.py.",
    "guard-bench_run_1247_08b-30": "a saved transistor reply (an Arduino pin switching a 12 V relay or motor) that the other change of 1.24.37 reads differently -- the kind the question asks for named in what goes back in place of the guide's K1; judged by its own reviews, tests/review_electronics_1237.py and review2_electronics_1237.py.",
    "n-ans1-later": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "n-ans1-ans2-sum": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "n-ans1-same-note": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "n-ans1-and-ans": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "n-ans2-failed": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "n-ansn-one-sum-a-line": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "b-ansn-digit-total-shown": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "m-hyd-ans1": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "s-total-then-draw-ansn": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "e-ansn-out-of-range-words": "ANS1, ANS2 ... are no longer read in a note (this review's own high finding: the prompt counts them by lines, the notes by sums, and they part as soon as a note has no sum); the note is questioned with what to write in place of ANSn.",
    "n-ans-crosses-typed-value": "ANS is the previous result, as the calculator and the full prompt define it: the sum just before. A model that meant another note's number wrote a sum that gives this one; Lantern shows the model's sum as written (before, ANS was 0 and the note went back as divide by zero).",
    "n-ans-branch-currents": "ANS is the previous result, as the calculator and the full prompt define it: the sum just before. A model that meant another note's number wrote a sum that gives this one; Lantern shows the model's sum as written (before, ANS was 0 and the note went back as divide by zero).",
    "n-ans-after-later-sum-same-note": "ANS is the previous result, as the calculator and the full prompt define it: the sum just before. A model that meant another note's number wrote a sum that gives this one; Lantern shows the model's sum as written (before, ANS was 0 and the note went back as divide by zero).",
    "n-ans-hidden-by-cut": "a note is cut at 120 characters after its sums are worked out, as before; the sum ANS takes is the model's own (low).",
    "b-missing-resistor-via-ans": "a total named in ohms that is not the circuit's, made only of the circuit's own numbers, is drawn as written beside Lantern's total -- as when written straight on 1.24.36 (b-missing-resistor-direct). Open, in the report: the label alone is not yet read as the total (rule 7).",
    "b-missing-resistor-direct": "as on 1.24.36: a total of the circuit's own numbers that comes out wrong is drawn beside Lantern's (open, in the report).",
    "b-reciprocal-as-total-via-ans": "as b-missing-resistor-via-ans: \u201cRt = {=ANS} ohm\u201d after \u201c1/Rt = {=...}\u201d shows the model's sum (0.2) beside Lantern's 5 ohm; before, ANS was 0. Open, in the report.",
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
    if int(total.group(1)) < 205: fails.append("%s cases, fewer than 205" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL NOTES ANS REVIEW 1.24.37 CHECKS PASS" if not fails else "NOTES ANS REVIEW 1.24.37 FAILED")
sys.exit(1 if fails else 0)
