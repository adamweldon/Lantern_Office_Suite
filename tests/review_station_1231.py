# review_station_1231.py -- the first review of 1.24.31 (MAKE STATION, the usual floats in a floatless duplex, the block
# grammars), replayed. A separate agent that had not seen the rules written made 303 cases of its own
# (tests/fixtures/station_review1_1231/, findings.txt): MAKE STATION blocks as models write them, each drawing judged (the
# ladder simulated, the piping's valves, the levels' order and scale, the parts list, the sequence and the checks against
# the drawings); routing with every bench question as a guard; the drawings' own blocks read as a station; the floatless
# duplex beside 1.24.30; and the grammars run through llama.cpp's own parser. On the draft 212 agreed (13 high: anything
# made about a station routed as the station; a loose word in the question, or a horsepower on the pumps line, taken
# as the count of pumps; one pump with a lag float wired wrong; heights written before their floats shifted). After the
# mending every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review_station_1231.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "station_review1_1231")
KEEP = {
    "A-105": "one pump with a duplex's floats: the lag float is left out and said ('not the FS3 (lag on) float: one pump has no lag pump to start or stop'), as the case's own 'right' allows; the judge's list of jobs still names it.",
    "A-109": "the high-high alarm FS5 now lights its own light LT4 (and FS4 its LT3), as a two-alarm panel does; the judge's simulator places one alarm float, so FS5 is never made in it and LT4 never lit.",
    "C-13": "a one-pump control for Adam's two-pump question is questioned now, with the line to write (the alternator and both pumps); the drawings that could be made are kept to show, as for any block with problems, and the judge looks only for no drawing at all.",
    "C-25": "a MAKE SCHEMATIC holding the station's piping is read as the station's piping and the station is made whole from it (the finding's own 'right'), so nothing is missing to ask for; the case was written before that, expecting the station to be asked for.",
    "E-P15": "the grammar now writes each word case-blind ([pP][uU][mM][pP][sS]) in a rule of its own, which this judge's pattern for quoted words does not read; the correction's lines (pumps, floats, float, well) are run through llama.cpp's own parser in tests/fixtures/grammar_1231 and let through.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(FX, "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=900)
out = r.stdout
if VERBOSE: print(out)
dis = [c for c in re.findall(r"^DISAGREE\s+(\S+)", out, re.M) if c != "by"]
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 303: fails.append("%s cases, not 303" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL STATION REVIEW 1.24.31 CHECKS PASS" if not fails else "STATION REVIEW 1.24.31 FAILED")
sys.exit(1 if fails else 0)
