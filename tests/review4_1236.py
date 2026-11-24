# review4_1236.py -- the fourth review of 1.24.36 (the givens, the user's own givens, the code checks), replayed.
# An agent that had not seen the change written, nor the three reviews before it, made 351 cases
# (tests/fixtures/review4_1236/, findings.txt) as a plumber, an HVAC tech, a farmer, a millwright, a panel builder or a
# student would ask, with the bench as a guard (300 prompts, 1,460 saved replies). On its draft 297 agreed (26 high: one
# light read as two lamps, a station count read wrong, "at each end" read as two stations, a sequence's own order or
# stop clause ignored, a horn that sounds while running, any "alarm" as a high water alarm, a booster's break-tank floats
# as a fill, an energise-to-trip relay and an overload alarm relay handed wrong lines, a low suction cut-out sent back,
# kept circuits for a second machine). A light, a station count, an e-stop, a horn and an alarm are now read only in a
# few plain forms, else no given; the checks leave a relay used closed elsewhere and a booster alone. After the mending
# every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review4_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review4_1236")
KEEP = {
    "us-duplex-sewage": "a kept circuit is now shown only for the same question, its words in the same order (the asking words -- draw, please, again -- aside): the sixth review found it shown, on most words alike, for the opposite light, the reversed order, \u201cwithout a horn\u201d, swapped floats and a refrigeration compressor (rule 7: when unsure, the instructions as before).",
    "rp-fill2-no-floats": "the same two nc lines go back, now one problem a float, each with its own \u201cWrite it:\u201d line (the third review's copy test: a line handed back is one line, and copied in place of the float's line it builds clean); the case matched both lines joined in one problem, as first drafted.",
    "rp-fill2-no-said-no": "the same two nc lines go back, now one problem a float, each with its own \u201cWrite it:\u201d line (the third review's copy test: a line handed back is one line, and copied in place of the float's line it builds clean); the case matched both lines joined in one problem, as first drafted.",
    "rp-fill2-unquoted": "the same two nc lines go back, now one problem a float, each with its own \u201cWrite it:\u201d line (the third review's copy test: a line handed back is one line, and copied in place of the float's line it builds clean); the case matched both lines joined in one problem, as first drafted.",
    "rp-hopper-levels": "the same two nc lines go back, now one problem a float, each with its own \u201cWrite it:\u201d line (the third review's copy test: a line handed back is one line, and copied in place of the float's line it builds clean); the case matched both lines joined in one problem, as first drafted.",
    "rv-driving": "\u201ca 3 phase motor driving a conveyor belt\u201d gets no given: \u201cdriving\u201d is not a word the givens know (low; the same question as \u201ca 3 phase conveyor belt motor\u201d fits).",
    "rp-fill2-two-vessels": "a fill from a cistern into a house tank, both floats named for the tank, is left as written: a question naming two vessels is not this rule's, as Lantern cannot be sure which float guards which (rule 7; the third review's H7 and H10).",
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
    if int(total.group(1)) < 351: fails.append("%s cases, fewer than 351" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL FOURTH REVIEW 1.24.36 CHECKS PASS" if not fails else "FOURTH REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
