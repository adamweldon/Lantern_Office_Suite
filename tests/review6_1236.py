# review6_1236.py -- the sixth review of 1.24.36 (the givens, the user's own givens, the code checks), replayed.
# An agent that had not seen the change written, nor the five reviews before it, made 391 cases
# (tests/fixtures/review6_1236/, findings.txt), with the bench as a guard (300 prompts, 1,139 saved replies with a MAKE
# block, built as on 1.24.35). On its draft 313 agreed (51 high: a control transformer's primary as the control's
# voltage, "may start only while the other is off" as a sequence, "two locations" counted as stations whatever it was
# said of, a delay relay whose job is not said, a light in a button, an alarm's light as a run light, a vacuum switch
# sent back, an overload alarm relay judged as the motor, kept circuits matched on most words). Now: a transformer's
# lower voltage only where it is a control transformer's; a sequence's "off", "idle" or "not running" read as no given;
# a station count only where its own clause says the start and the stop; no time of Lantern's own; a lit button, a
# light as a verb, an alarm's plain light: no given; vacuum switches and overload relays left alone; a kept circuit
# only for the same question. After the mending every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review6_1236.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review6_1236")
KEEP = {
    "p-l-until-starts": "\u201ca pilot light that is on until the pump starts\u201d is not one of the few light forms read (since the fourth review): no given, a safe miss; the changelog no longer says it is read.",
    "p-l-fwd-light-rev-light": "\u201ca forward light and a reverse light\u201d: two light words with no state each -- no given, a safe miss (low).",
    "p-s-stop-two-locations": "no given now, where the draft fitted one wrong: a count said of the stops alone is not the start and stop stations the given draws; Lantern does not yet draw two stops and one start.",
    "p-s-stop-two-start-one": "no given now, where the draft fitted one wrong: \u201cthe start button at one\u201d -- two stops and one start is not a given Lantern has.",
    "p-s-stopped-3-started-1": "no given now, where the draft fitted one wrong: \u201cstarted from one\u201d -- three stops and one start is not a given Lantern has.",
    "p-s-stops-at-two-places": "no given now, where the draft fitted one wrong: a count said of the stops alone.",
    "p-s-stops-2-start-panel": "no given now, where the draft fitted one wrong: \u201cthe start at the panel\u201d.",
    "p-s-stopped-from-two": "no given now, where the draft fitted one wrong: only stopping is said from two places.",
    "p-e-mushroom-stop": "no given now, where the draft fitted one wrong: \u201ca mushroom head stop button\u201d may be the stop or an emergency stop: not sure.",
    "p-r-mech-only": "no given now, where the draft fitted one wrong: \u201cmechanical interlock only\u201d.",
    "p-q-chain": "\u201cconveyor 3 starts first, then conveyor 2, then conveyor 1\u201d does not say whether each later one starts by itself or by its button (this review's own M7): no given.",
    "p-d-pre-start-no-time": "a pre-start warning with no time said gets no given: Lantern no longer writes a time of its own into the line copied (this review's L4).",
    "b-back-fill-empty-open": "a fill's single float named for the empty tank, written open, is drawn as written and nothing goes back -- as on 1.24.35; only a stop float written open is caught. Open, listed in the report.",
    "c-latin": "\u201ca Latin American customer\u201d picks IEC, as the earlier reviews wanted; the region is mixed, and the user sees both codes and one button (low).",
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
    if int(total.group(1)) < 391: fails.append("%s cases, fewer than 391" % total.group(1))   # saved bench runs added later add guard cases
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL SIXTH REVIEW 1.24.36 CHECKS PASS" if not fails else "SIXTH REVIEW 1.24.36 FAILED")
sys.exit(1 if fails else 0)
