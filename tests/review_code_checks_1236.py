# review_code_checks_1236.py -- the review of 1.24.36's code checks (US and IEC practice), replayed.
# An agent that had not seen the checks written made 338 cases (tests/fixtures/code_checks_review_1236/, findings.txt):
# 202 control circuits (145 right ones that must pass, 49 wrong ones that must go back with a line that works copied),
# 70 questions for which practice to follow, 66 others (the view, the saved choice, the store failing, modules dropped,
# every bench prompt, 2,105 saved replies, Lantern's own givens), and the references read on their pages. On the first
# draft 276 agreed (29 high: alarms, fans, relief valves, unloaders, frost stats and trip timers sent back, a minus sign
# dropped, "min" read as minimum, the contact judged by the switch's line not as drawn). The checks now ask what the
# switch stops (a machine, never an alarm, a fan, a valve or a timer) and judge the contact as drawn. After the mending
# every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review_code_checks_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "code_checks_review_1236")
KEEP = {
    "W-fz-04": "a freeze stat written nc on a supply fan is left as written: a frost stat brings a boiler ON as it cools and a freeze stat stops a fan, and the name alone cannot say which (rule 7; the review's own H2).",
    "W-lowlimit-47": "the same for an air handler's \u201clow limit\u201d: a boiler's low limit fires the burner as the water cools (the review's R-heat-19).",
    "W-sol-49": "a solenoid valve is never judged: a relief or dump valve opens as the pressure or level rises (the review's H1); a fill valve's cut-off is left to the model.",
    "W-coilnc-22b": "the case copies the line the first draft handed back for a right circuit; that circuit (W-coilnc-22) is no longer sent back, and this one, drawn normally closed as the coil's nc says, is right and kept.",
    "M-hp-01": "\u201cHP cut-out\u201d is not read as high: HP is as often horsepower (rule 7).",
    "M-start-03": "a start button named \u201cstop\u201d is drawn as a start, as written (rule 7).",
    "P-43": "\u201ca house in Indiana\u201d is US practice: Indiana is a US state (the case guarded against reading it as India).",
    "P-44": "a UK house with a US-made compressor names both places: the saved choice, else US.",
    "F-09": "IEC 60204-1 and NFPA 79 are for machines; Lantern names them for any control circuit (a house's well pump, a boiler). The rule holds; which code governs that equipment is not judged. In the report.",
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
    if int(total.group(1)) != 338: fails.append("%s cases, not 338" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL CODE CHECKS REVIEW 1.24.36 CHECKS PASS" if not fails else "CODE CHECKS REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
