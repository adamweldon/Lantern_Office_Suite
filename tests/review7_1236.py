# review7_1236.py -- the seventh review of 1.24.36, of the sixth round's mends, replayed.
# An agent that had not seen the change written, nor the six reviews before it, made 336 cases
# (tests/fixtures/review7_1236/, findings.txt) and ran them on the sixth round (adb8fd7) and the fifth (801fe71) beside
# it, with the bench as a guard (298 prompts, 1,591 saved replies with a MAKE block, built as on 1.24.35). The sixth
# round had mended 92 of its cases and broken 46 (13 high): a motor's 460/230 V read as a control transformer's,
# "a stop button for both conveyors" stripped as each machine's own, a plain control voltage dropped beside any pair,
# "120 VAC" and "vacation" read as vacuum, a starter named with its overload relay judged no machine. 45 high in all
# (with those the earlier rounds had not reached: plurals, lights in buttons said other ways, one button that starts
# and stops, a delay timed from another machine). Now a pair is read only beside "control transformer", its lower
# voltage written with its volts; a stop button counts as the machine's own only where it stands alone; and the rest
# as said in the CHANGELOG. After the mending every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review7_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review7_1236")
KEEP = {
    "st-estop-before": "an e-stop or a run light said before \u201cat two locations\u201d in the same clause may be at both: the eighth review judged the given HIGH there, this review wanted it -- not sure, so no given (rule 7; safe, medium).",
    "st-runlight-before": "an e-stop or a run light said before \u201cat two locations\u201d in the same clause may be at both: the eighth review judged the given HIGH there, this review wanted it -- not sure, so no given (rule 7; safe, medium).",
    "st-greenlight-before": "an e-stop or a run light said before \u201cat two locations\u201d in the same clause may be at both: the eighth review judged the given HIGH there, this review wanted it -- not sure, so no given (rule 7; safe, medium).",
    "st-stop-two-start-two": "\u201ca stop button at two locations and a start button at two locations\u201d: a button of one kind said one at a time is not read as a station count -- no given, safe (medium; the seventh review's \u201ca start button and stop buttons at two locations\u201d was fitted two full stations).",
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
    if int(total.group(1)) < 336: fails.append("%s cases, fewer than 336" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL SEVENTH REVIEW 1.24.36 CHECKS PASS" if not fails else "SEVENTH REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
