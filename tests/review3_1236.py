# review3_1236.py -- the third review of 1.24.36 (the givens, the user's own givens, the code checks), replayed.
# An agent that had not seen the change written, nor the two reviews before it, made 481 cases
# (tests/fixtures/review3_1236/, findings.txt) on the draft mended after the second round: 214 questions and what each
# is shown, the code checks on many trades' circuits, which practice, the fill rules simulated, kept circuits, and the
# bench as a guard (300 prompts, 1,099 saved replies). On that draft 408 agreed (38 high: a sequence given for "must not
# run together", three machines put in number order whatever was said, "forty-five seconds" read as 5 s, lights fitted
# the wrong way, two stations fitted as one, the barn's lights as a motor, a fill between two tanks, a pit pump's float
# sent back, a trip light's overload sent back, a kept circuit for a different circuit). Lights and stations are now
# read only where Lantern is sure, else no given; never-together, chains and times in words read; two vessels refused;
# the checks ask whether the pump empties and whether the overload's line is a motor's. After the mending every case
# agrees but these, each kept for the reason given.
# Usage: python3 tests/review3_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review3_1236")
KEEP = {
    "g-st-415-motor": "a question with a 415 V motor and a 24 V DC control read as two control-side voltages: no supply line in the given (left out, not wrong); the model writes the one asked.",
    "g-rv-interlocking-parts": "AI_PARTS cuts \u201ca forward and reverse motor control circuit with interlocking\u201d into a drawing and a control circuit, as on 1.24.35: not this change's, in the queue.",
    "c-ok-trip-lamp-ol-line": "\u201coverload OL1 LT2 no\u201d (a trip light on the overload's open contact) is drawn with OL1 closed, as 1.24.35 drew it; Lantern no longer questions it or hands a wrong line back. Drawing an overload's open contact for a trip light is in the queue.",
    "c-w-transfer-guard-both-no": "a fill between two tanks with both floats written normally open is left as written: the source tank's float is right as written and the day tank's is not, and Lantern cannot be sure which is which (rule 7; the review's own H10 allows nothing).",
    "p-not-iec": "\u201cNot to IEC ... per NEC\u201d names both codes and reads \u201cto IEC\u201d as the one drawn to: a negation before the code is not read (low).",
    "p-american-in-germany": "an American plant in Germany names both places: the saved choice, else US (low).",
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
    if int(total.group(1)) != 481: fails.append("%s cases, not 481" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL THIRD REVIEW 1.24.36 CHECKS PASS" if not fails else "THIRD REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
