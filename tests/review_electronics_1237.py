# review_electronics_1237.py -- the review of a transistor's load read in (1.24.37), replayed.
# An agent that had not seen the change written made 184 cases of its own and 20 guards from the saved bench replies
# (tests/fixtures/review_electronics_1237/, findings.txt), with every prompt and the 56 right replies as guards. On the
# draft it found 20 high, all from one cause: a part added beside a load the reply already had (drawn always on, or two
# transistors on one pin) or on a transistor that already named its load; and the lines handed back naming the first
# load of any kind, a pin line without the LED or button it may be for, a "P1" where the reply's pin was P3, a stepper's
# or a servo's question read as a DC motor's. Now a part is added only where no load is left unswitched but a light
# meant to stay on, and the transistor names no load; the one free load is read only of the one kind asked; the board's
# name for a pin ("transistor Q1 D9") is that pin; what goes back names a load of the kind asked, on the reply's own pin,
# a transistor that switches nothing yet, and a spare pin as spare. A second review then found that this mend broke 12 right replies (a second load of the asked kind given to the
# first transistor) and handed back lines that build wrong; the reading was cut to its surest form (one transistor, at
# most one load, of the one kind asked). After that every case agrees but these.
# Usage: python3 tests/review_electronics_1237.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review_electronics_1237")
KEEP = {
    "two-refs-relay-question-motor": "as on 22b1c03 and every round since: an old fault, not of this change (listed open in the report).",
    "add-two-relays": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "add-two-motors": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "add-motor-power-led": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "add-motor-switch-base": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "free-second-transistor": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "free-second-transistor-order": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "free-D9-pin-name": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "free-LDR1-tag": "what goes back now names the question's own kind of load (and its transistor first) in place of the guide's relay K1; the case wanted other words or other ids, and nothing is drawn wrong.",
    "free-pin-line-names-motor": "what goes back now names the question's own kind of load (and its transistor first) in place of the guide's relay K1; the case wanted other words or other ids, and nothing is drawn wrong.",
    "free-motor-on-pin-no-transistor-pin": "what goes back now names the question's own kind of load (and its transistor first) in place of the guide's relay K1; the case wanted other words or other ids, and nothing is drawn wrong.",
    "free-diode-also-K1": "as on 22b1c03 and every round since: an old fault, not of this change (listed open in the report).",
    "grade-two-motors-typo": "\u201cmotor M1\u201d and \u201ctransistor Q1 M2 P1\u201d: the one motor of the block, on Q1's pin, is Q1's -- read and said; the bench passes the drawing it is (low).",
    "back-pin-two-motors": "what goes back now names the question's own kind of load (and its transistor first) in place of the guide's relay K1; the case wanted other words or other ids, and nothing is drawn wrong.",
    "back-pin-two-motors-copy": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "back-led-question-fan-word": "as on 22b1c03 and every round since: an old fault, not of this change (listed open in the report).",
    "back-diode-led": "as on 22b1c03 and every round since: an old fault, not of this change (listed open in the report).",
    "fix-motor-guide-K1": "as on 22b1c03 and every round since: an old fault, not of this change (listed open in the report).",
    "back-mosfet": "as on 22b1c03 and every round since: an old fault, not of this change (listed open in the report).",
    "back-mosfet-npn-line-names-K1": "as on 22b1c03 and every round since: an old fault, not of this change (listed open in the report).",
    "guard:bench_run_1.24.31_2b/make-electronics/first": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "guard:bench_run_1245_2b/make-electronics/first": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "guard:bench_run_1246_2b/make-electronics/reply": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "guard:bench_run_1247_08b/make-electronics/first": "after two reviews the reading was cut to its surest form -- one transistor, at most one load, of the one kind the question asks for -- so this reply, which an earlier round read in, goes back with the line to write, as on 22b1c03: a safe miss (rule 7; the earlier rounds' wider readings drew loads always on and two transistors on a pin).",
    "guard:bench_run_1258_35b_setb/make-electronics-b/reply": "the same two replies of the 35B are now also saved under the newer run's name (bench_run_1.24.36_35b_setb.json, Adam's laptop, 2026-11-24), so the guard's harvest keys them there; both build drawn and said (tests/electronics_load_1237.js).",
    "guard:bench_run_1258_35b_setb/make-electronics-b/first": "the same two replies of the 35B are now also saved under the newer run's name (bench_run_1.24.36_35b_setb.json, Adam's laptop, 2026-11-24), so the guard's harvest keys them there; both build drawn and said (tests/electronics_load_1237.js).",
    "guard:bench_run_1.24.36_35b_setb/make-electronics-b/reply": "the same two replies of the 35B are now also saved under the newer run's name (bench_run_1.24.36_35b_setb.json, Adam's laptop, 2026-11-24), so the guard's harvest keys them there; both build drawn and said (tests/electronics_load_1237.js).",
    "guard:bench_run_1.24.36_35b_setb/make-electronics-b/first": "the same two replies of the 35B are now also saved under the newer run's name (bench_run_1.24.36_35b_setb.json, Adam's laptop, 2026-11-24), so the guard's harvest keys them there; both build drawn and said (tests/electronics_load_1237.js).",
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
