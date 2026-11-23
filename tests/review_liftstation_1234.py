# review_liftstation_1234.py -- the first review of 1.24.34 (a lift station's schematic and the drawings it needs),
# replayed. An agent that had not seen the rules written made 221 cases of its own (tests/fixtures/
# liftstation_review1_1234/, findings.txt), with 1.24.33 loaded beside the draft: which questions go to MAKE STATION
# (every bench question as a guard), part-and-wire MAKE SCHEMATIC blocks read as a station, "emergency" floats, the
# open circuit's line, a reply's other blocks in Chat, the failure's advice. On the draft 125 agreed (28 high: plans and
# overviews sent to the station; floats named "Stop Float" or tagged FS1 dropped; "Incoming Power" drawn as the sewer
# inlet; "Float 1" read as 1 inch; "emergency start both pumps" made an alarm; the ground line laying a second wire
# beside the battery's only one; a piping read and not drawn). After the mending every case agrees but these, each
# kept for the reason given.
# Usage: python3 tests/review_liftstation_1234.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "liftstation_review1_1234")
BENCH = ("Adam's question is not added to the bench: set A's guard (“set A is as it was”), set B's parity of kinds and "
         "the 1.24.30-31 reviews' bench guards keep the bench as it was, so runs compare from version to version. It is replayed "
         "in tests/liftstation_1234.js instead, graded by make-liftstation's own checks (the 35B's reply and MAKE STATION both pass).")
KEEP = {
    "F-20": BENCH, "F-21": BENCH, "F-22": BENCH, "F-23": BENCH, "F-24": BENCH, "F-25": BENCH, "F-26": BENCH, "F-27": BENCH, "F-28": BENCH,
    "D-25": "the ground line is given with the other part on one wire named before it (“L2 is on one wire too: say where it goes "
            "on; join the ground back to B1, like: wire G1 B1”): the ground is where the way from the source ends, and the part on a "
            "side branch is the model's to place. The case wanted no line at all.",
    "D-26": "the same as D-25 (L1 on one wire, named before the line).",
    "D-28": "the same as D-25 (L2 on one wire, named before the line).",
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
    if int(total.group(1)) != 221: fails.append("%s cases, not 221" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL LIFT STATION SCHEMATIC REVIEW 1.24.34 CHECKS PASS" if not fails else "LIFT STATION SCHEMATIC REVIEW 1.24.34 FAILED")
sys.exit(1 if fails else 0)
