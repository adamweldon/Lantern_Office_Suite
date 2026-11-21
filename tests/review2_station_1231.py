# review2_station_1231.py -- the second review of 1.24.31 (MAKE STATION, the duplex floats rule and two alarms' lights, the
# block grammars), replayed. An agent that had seen neither the rules written nor the first review made 242 cases of its
# own after the first round of mends (tests/fixtures/station_review2_1231/, findings.txt): blocks as models write them,
# each drawing judged; routing with every bench question as a guard; read-as-station with blocks that disagree; the
# duplex floats rule against right circuits; the grammars through llama.cpp's parser, and when they are sent; and the
# parts list, how it works and the checks against what was drawn for each station. On that draft 175 agreed (5 high: a
# motor starter asked beside a station lost; the count of pumps misread from words, "3x" and horsepower; the text
# following the levels where the control drawn disagreed). After the mending every case agrees but these, each kept for
# the reason given.
# Usage: python3 tests/review2_station_1231.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "station_review2_1231")
AS_1230 = " -- as 1.24.30 had it (the second review's own note): a station's drawings beside another thing are split as before, the merge of the station's parts not reaching across a part that carries the other thing's words."
KEEP = {
    "A-80": "bottom, middle and top floats: 'top' is read as the lead and 'middle' goes back as 'lag on', whose line copied puts the top float below the middle one. Not mended: a float named only by where it hangs says no job, and the line to write cannot know which is meant.",
    "B-33": "'Draw a house with a red roof, then the control circuit and piping of a duplex lift station': the station's control and piping are made as parts; the house is lost" + AS_1230,
    "B-39": "a sheet beside the station's drawings: SHEET, CONTROL and PIPING, each its own part" + AS_1230,
    "B-40": "an e-mail after the station's drawings: the piping and the levels as two parts" + AS_1230,
    "B-41": "a quiz beside the station's drawings: the quiz folded into the levels part" + AS_1230,
    "B-42": "'Design a lift station and give me a budget': the sheet offered alone" + AS_1230,
    "B-48": "a flow chart beside the station's drawings: SCHEMATIC and PIPING" + AS_1230,
    "B-49": "a control panel with no drawing named: no tool, as 1.24.30.",
    "C-13": "the one-pump control's correction gives MAKE CONTROL's own line for the alternator on one line with commas, 1.24.30's style for every line it hands back (AI_CONTROL); unchanged here.",
    "E-GS-leads": "'the wet well 12 ft deep' is held out: 'the' is not a line's first word in the station's grammar, because with it every sentence beginning 'The station ...' would get through; the grammar then lets 'well' and 'wet well' through.",
    "E-GS-36": "a sentence that begins with a line's word ('Power: if the power fails ...') gets through a grammar that holds each line to its first word; the station's parser now reads it as nothing and says so (not a control voltage), so it cannot reach the rails.",
    "E-GS-37": "the same: 'Pumps alternate on each cycle ...' begins with a line's word; the parser reads no count from it and the station keeps its own.",
    "E-GS-prose": "(1.24.32) GS-35, a station block with no END, is let through: 1.24.31's run showed a grammar that goes on to END forbids the end of a reply, and the small models ran on to their limit (tests/fixtures/bench_run_1.24.31_*.json). The parser reads the block whole without END (tests/station.js). Every other sample here (prose before, inside or after, a fence, another kind) is still held out: ONLY below.",
    "E-s09": "MAKE LIFT STATION with a height for FS2 only: the floats around it cannot be set between known heights, so the station is drawn in order, not to scale, and says so -- nothing goes back, so there is no correction to hold to a grammar.",
}
# a kept case that groups several samples is kept only for what it names: any other sample in it that disagrees fails
ONLY = {"E-GS-prose": r"GS-35: let through \(prose\) \[high\]"}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(FX, "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=900)
out = r.stdout
if VERBOSE: print(out)
dis = [c for c in re.findall(r"^DISAGREE\s+(\S+)", out, re.M) if c != "by"]
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 242: fails.append("%s cases, not 242" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    for c, pat in ONLY.items():
        for d in re.findall(r"^DISAGREE\s+" + re.escape(c) + r"\s+(.*)$", out, re.M):
            if not re.fullmatch(pat, d.strip()): fails.append("%s kept only for %s, but: %s" % (c, pat, d.strip()[:300]))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL SECOND STATION REVIEW 1.24.31 CHECKS PASS" if not fails else "SECOND STATION REVIEW 1.24.31 FAILED")
sys.exit(1 if fails else 0)
