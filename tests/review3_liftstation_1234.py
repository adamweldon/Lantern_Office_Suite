# review3_liftstation_1234.py -- the third review of 1.24.34 (a lift station's schematic and the drawings it needs),
# replayed. A third agent, that had seen neither the rules written nor the two reviews before it, made 282 cases after
# the second round of mends (tests/fixtures/liftstation_review3_1234/, findings.txt), pressing on what that round added:
# a part wired on one side only and parts apart from the source's circuit questioned in every schematic (47 right
# circuits and every saved bench reply as a guard), a second float of one job, a MAKE STATION beside a schematic. On that
# draft 242 agreed (2 high: "write the electrical schematic for a typical lift station" still sent to the hobby
# circuit, and the 35B's reply under it sent back). After the mending every case agrees but these, each kept for the
# reason given.
# Usage: python3 tests/review3_liftstation_1234.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "liftstation_review3_1234")
KEEP = {
    "G-bench-build": "1.24.37 changes how the saved transistor replies (make-electronics, make-electronics-b) and Adam's parallel lesson (make-parallel-ohm-b, saved with his laptop run of 1.24.36) build, and only those, by design: ANS in a drawing's notes is the sum just before it, so the lesson draws \u201cIt = 1.8 A\u201d and passes; the 35B's motor driver is read in where sure and passes; what goes back to a transistor reply names the question's kind of load in place of the guide's relay K1. Each judged by its own review (tests/review_notes_ans_1237.py, review_electronics_1237.py, review2_electronics_1237.py).",
    "G-bench-grade": "1.24.37 changes how the saved transistor replies (make-electronics, make-electronics-b) and Adam's parallel lesson (make-parallel-ohm-b, saved with his laptop run of 1.24.36) build, and only those, by design: ANS in a drawing's notes is the sum just before it, so the lesson draws \u201cIt = 1.8 A\u201d and passes; the 35B's motor driver is read in where sure and passes; what goes back to a transistor reply names the question's kind of load in place of the guide's relay K1. Each judged by its own review (tests/review_notes_ans_1237.py, review_electronics_1237.py, review2_electronics_1237.py).",
    # (1.24.36) by design: the two motor-starter questions are shown Lantern's given for them (GIVENS_CONTROL) in place of
    # the instructions' example; every other bench prompt is as it was (tests/review_givens_1236.py, cases D)
    "E-bench-300": "make-control and make-control-b are shown the three-wire starter given (1.24.36), by design; every other bench prompt is unchanged.",
    "C-jobless-top-down-copied": "the block is the line Lantern handed back on the second draft (FS4 “off” at 5 ft ...), which it no "
                                 "longer hands back: the floats with no job now get their jobs from the bottom up (C-jobless-top-down "
                                 "agrees). That old line, copied, is rightly questioned.",
    "D-station-then-levels": "the note says what the MAKE LEVELS block gives that the station does not -- the floats' heights -- as the same "
                             "review's D-levels-then-station asked (“the heights dropped and nothing says so”); this case wants "
                             "the note without it.",
    "D-held-self-fix-twice": "the AI's own fix written after its first block, and its corrected block after Lantern asked, are both shown: "
                             "Lantern cannot tell a fix from a second circuit in the same reply (D-two-schematics-made shows both) "
                             "unless they are the same lines.",
    "B-vm-in-series": "a voltmeter in the chain: the line closes the loop through it and the meters' own check then questions a "
                      "voltmeter in series (it goes across what it measures). Low; the line is not wrong about where the way ends.",
    "B-fuse-alone": "a fuse written as a resistor (there is no fuse part) is a load to the rule; the circuit asked for (a battery and a "
                    "fuse) has nothing else to be. Low.",
    "B-ladder-no-return": "a ladder whose rungs meet at a junction with more than one wire: two or more places the way could go back "
                          "from, so no line is guessed (the place is the model's to say).",
    "B-two-ground-symbols": "two ground symbols are two parts to the loop check (older than 1.24.34); no line is guessed where there are two.",
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
    if int(total.group(1)) != 282: fails.append("%s cases, not 282" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL THIRD LIFT STATION SCHEMATIC REVIEW 1.24.34 CHECKS PASS" if not fails else "THIRD LIFT STATION SCHEMATIC REVIEW 1.24.34 FAILED")
sys.exit(1 if fails else 0)
