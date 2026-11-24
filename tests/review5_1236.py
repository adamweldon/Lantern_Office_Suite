# review5_1236.py -- the fifth review of 1.24.36 (the givens, the user's own givens, the code checks), replayed.
# An agent that had not seen the change written, nor the four reviews before it, made 350 cases
# (tests/fixtures/review5_1236/, findings.txt, its own ladder simulator sim.js), with the bench as a guard (300 prompts,
# 894 saved replies with a MAKE block, built as on 1.24.35). On its draft 289 agreed (41 high: the machine's voltage
# drawn as the control's, a starter or sequence given for a question that says a time, a sequence's stop said otherwise
# or its machines named by ordinal or tag read backwards, push-button interlocks, a horn that keeps sounding, an alarm's
# light drawn as a run light, plural lights guessed, a fill's floats said the other way round, a freeze-protection or
# standby switch sent back as a cut-out, a fault relay judged as the motor, a fill's tank-full, alarm or valve relay
# judged as the pump, a kept circuit shown for an e-stop or a second station it lacks). The control voltage is now read
# only where the question says so of the control; a time, a stop said otherwise, plural lights with no state, a light
# beside an alarm's words, the floats' jobs said otherwise give no given; the checks leave a switch that starts or calls
# and a fault relay; the fill rule reads only the pump's own rung. After the mending every case agrees but these, each
# kept for the reason given.
# Usage: python3 tests/review5_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review5_1236")
KEEP = {
    "F-rev-mech-interlock": "a mechanical interlock is a part on the contactors that Lantern's ladder does not draw, nor could the model's: the given's electrical interlock is right and stands (low; the third review's g-rv-interlocks-estop wants the given here).",
    "g-seq-overload-both": "\u201cpump 1's overload stops both pumps\u201d: a stop said any way but each machine's own start and stop is not read (this review's own H3: \u201cone stop button stops both\u201d, \u201cwhen conveyor 2 stops, conveyor 1 stops too\u201d), so no given -- never a wrong one.",
    "F-r-day-tank": "a fuel day tank is filled from a bulk tank: two vessels, which the fill rule leaves as written, as 1.24.35 drew them, since Lantern cannot be sure which float guards which (the third review's H7 and H10). Open: listed in the report.",
    "F-r-two-vessel-fill": "a well and the tank it fills are two vessels: left as written, as 1.24.35 drew them (the third review's H7 and H10: which float guards which is not sure). Open: listed in the report.",
    "F-w-estop-no": "an emergency stop written normally open is drawn closed, as Lantern draws every one, and the drawing's text says so: \u201cES1 is drawn normally closed: written normally open, the circuit would run only while it was held\u201d (rule 2, correct by construction and said); the case wanted it sent back.",
    "F-p-european-market": "\u201cfor the European market built in Ohio\u201d names both: the user's choice decides, else US, and both codes are shown with one button to switch (low).",
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
    if int(total.group(1)) < 350: fails.append("%s cases, fewer than 350" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL FIFTH REVIEW 1.24.36 CHECKS PASS" if not fails else "FIFTH REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
