# review_float_1235.py -- the review of 1.24.35 (float switches the right way up; LS a limit switch), replayed. An agent
# that had not seen the change written made 192 cases (tests/fixtures/float_review_1235/, findings.txt), with 1.24.34
# beside the draft: every float, pressure and temperature contact in 21 simulated circuits, 12 ladders drawn in
# Chromium, every bench question and 1,221 saved replies as a guard. On the draft 138 agreed (21 high: a name rule meant
# to keep LS-tagged floats made an e-stop, an On/Off switch and a Lead/Lag selector into floats, and lost LS floats
# named "Pump 1 On", "Stop", "High"). The name rule was taken out: a plain LS is a limit switch only when it has no
# name or a name that says what a limit switch is on. After the mending every case agrees but these, each kept for the
# reason given. (One judge's offset was widened for the branch row's tag, moved clear of its float as the review asked.)
# Usage: python3 tests/review_float_1235.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "float_review_1235")
OLDER = "as on 1.24.34, not this change's doing; in the queue."
KEEP = {
    "B-cutout-written-without-nc": "a high pressure cutout written without nc is drawn as written (closing as the pressure rises): " + OLDER +
                                   " Sending it back once with its nc line is a rule of its own, to be reviewed (a low pressure cutout is normally open).",
    "B-thermostat-heater-written-without-nc": "the same for a heater's thermostat written without nc: " + OLDER,
    "C-s-lead-pump-on": "a switch tagged S named “Lead Pump On” is not read as a float (a selector's position may be named so): " + OLDER,
    "E-station-floats-low-shorthand": "MAKE STATION's “floats low ...” shorthand drops the low float without a word: " + OLDER,
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
    if int(total.group(1)) != 192: fails.append("%s cases, not 192" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL FLOAT REVIEW 1.24.35 CHECKS PASS" if not fails else "FLOAT REVIEW 1.24.35 FAILED")
sys.exit(1 if fails else 0)
