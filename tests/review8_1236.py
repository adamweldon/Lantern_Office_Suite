# review8_1236.py -- the eighth review of 1.24.36, of the seventh round's mends, replayed.
# An agent that had not seen the change written, nor the reviews before it, made 288 cases (tests/fixtures/review8_1236/,
# findings.txt) aimed at each line the seventh round changed, and ran them on that round (ca567b7) and the one before
# (adb8fd7) side by side, with the bench as a guard. The seventh round had mended 34 and broken 64 (49 high, in 8
# faults): a control transformer's DC side read as AC, "an e-stop and start and stop buttons at two locations" fitted,
# "the stop button stops the conveyors" taken for each one's own, "conveyors that start in sequence" taken for two,
# "after the supply comes on" fitted with the push-button delayed start, a pump light beside an alarm horn drawing a
# high water light, "vac pump" and "negative-pressure" cut-outs sent back, a stop relay energised to stop sent back.
# Each mended. After the mending every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review8_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review8_1236")
KEEP = {
    "sta-09": "a button of one kind said one at a time (\u201ca stop button and start button at two locations\u201d) is not read as a station count: no given, safe (medium; the seventh review's \u201ca start button and stop buttons at two locations\u201d was fitted two full stations).",
    "sta-10": "a button of one kind said one at a time (\u201ca stop button and start button at two locations\u201d) is not read as a station count: no given, safe (medium; the seventh review's \u201ca start button and stop buttons at two locations\u201d was fitted two full stations).",
    "lit-26": "machines in the plural with no count (\u201cmotors over 5 hp\u201d) are more than one: no given, safe (medium; the seventh review found Lantern's starter shown for \u201cthe pumps\u201d).",
    "lit-29": "\u201cone of the pump starters\u201d: a plural, so no given, safe (medium).",
    "lit-45": "\u201cthe start button is not illuminated\u201d: a lit button is read by its words alone, so no given, safe (medium; the seventh review found \u201ca light-up start button\u201d fitted the starter).",
    "keep-03": "a kept circuit is shown only for the same question, its words as said: \u201cbutton\u201d is not \u201cbuttons\u201d (the seventh review found stems showing a circuit kept for \u201cthe pump\u201d to \u201cthe pumps\u201d; safe).",
    "keep-05": "as keep-03: the same question only, its words as said (safe).",
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
    if int(total.group(1)) < 288: fails.append("%s cases, fewer than 288" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL EIGHTH REVIEW 1.24.36 CHECKS PASS" if not fails else "EIGHTH REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
