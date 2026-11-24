# review_electronics_1237.py -- the review of a transistor's load read in (1.24.37), replayed.
# An agent that had not seen the change written made 184 cases of its own and 20 guards from the saved bench replies
# (tests/fixtures/review_electronics_1237/, findings.txt), with every prompt and the 56 right replies as guards. On the
# draft it found 20 high, all from one cause: a part added beside a load the reply already had (drawn always on, or two
# transistors on one pin) or on a transistor that already named its load; and the lines handed back naming the first
# load of any kind, a pin line without the LED or button it may be for, a "P1" where the reply's pin was P3, a stepper's
# or a servo's question read as a DC motor's. Now a part is added only where no load is left unswitched but a light
# meant to stay on, and the transistor names no load; the one free load is read only of the one kind asked; the board's
# name for a pin ("transistor Q1 D9") is that pin; what goes back names a load of the kind asked, on the reply's own pin,
# a transistor that switches nothing yet, and a spare pin as spare. After the mending every case agrees but these.
# Usage: python3 tests/review_electronics_1237.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review_electronics_1237")
KEEP = {
    "two-refs-relay-question-motor": "as on 22b1c03: a transistor whose line names a declared motor and an unknown K1 switches the motor, in a relay question too (pre-existing; this change reads nothing in where the line names a load).",
    "free-led-question": "\u201can LED switched by an Arduino pin through a transistor\u201d with \u201cled D1\u201d and the guide's \u201ctransistor Q1 K1 P1\u201d: the one free load is the one kind asked, so Q1 switches D1 from P1, said -- the same reading as the motor's (rule 2: correct by construction, and said).",
    "free-D9-and-M1-undeclared": "\u201ctransistor Q1 M1 D9\u201d beside pin P1 \u201cD9\u201d in a motor question: D9 is P1, M1 the motor asked for -- drawn and said, where the case wanted it sent back (low).",
    "free-LDR1-tag": "a sensor's tag on the transistor's line is not read; what goes back names the motor asked for, not the sensor (low).",
    "free-diode-also-K1": "the guide's K1 on the diode's line too is not read: one more round, with \u201cdiode D1 M1\u201d to write (low).",
    "grade-two-motors-typo": "\u201cmotor M1\u201d and \u201ctransistor Q1 M2 P1\u201d: M1 is the one motor for Q1 to switch, said; the bench passes the drawing it is (low).",
    "back-led-question-fan-word": "as on 22b1c03: in a question naming an LED and a fan, a spare pin's line offers the LED, a transistor or a switch (pre-existing).",
    "fix-motor-guide-K1": "the guide sent back with a correction keeps its own example, the relay K1 (pre-existing, not this change; open in the report).",
    "back-mosfet-npn-line-names-K1": "a MOSFET's line is told a switching transistor is an NPN, \u201ctransistor Q1 K1 P1\u201d, from parse(), which has no question (pre-existing; copied in a motor question it now builds right through the free-load reading).",
    "guard:bench_run_1.24.31_2b/make-electronics/first": "a saved relay-driver reply with a pin left over: what goes back now says the relay is driven already and to leave that pin's line out (or use it for an LED or a button), where it offered \u201ctransistor Q1 K1 Pn\u201d -- which, copied, put Q1 on two pins.",
    "guard:bench_run_1245_2b/make-electronics/first": "a saved relay-driver reply with a pin left over: what goes back now says the relay is driven already and to leave that pin's line out (or use it for an LED or a button), where it offered \u201ctransistor Q1 K1 Pn\u201d -- which, copied, put Q1 on two pins.",
    "guard:bench_run_1246_2b/make-electronics/reply": "a saved relay-driver reply with a pin left over: what goes back now says the relay is driven already and to leave that pin's line out (or use it for an LED or a button), where it offered \u201ctransistor Q1 K1 Pn\u201d -- which, copied, put Q1 on two pins.",
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
    if int(total.group(1)) < 204: fails.append("%s cases, fewer than 204" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL ELECTRONICS REVIEW 1.24.37 CHECKS PASS" if not fails else "ELECTRONICS REVIEW 1.24.37 FAILED")
sys.exit(1 if fails else 0)
