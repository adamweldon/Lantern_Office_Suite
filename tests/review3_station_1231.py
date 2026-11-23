# review3_station_1231.py -- the third review of 1.24.31 (MAKE STATION, the duplex floats rule, the block grammars),
# replayed. An agent that had seen neither the rules written nor the other reviews made 211 cases after the second round
# of mends (tests/fixtures/station_review3_1231/, findings.txt), pressing hardest on over-reach with 1.24.30 beside it and
# every bench question as a guard. On that draft 154 agreed (14 high: "with one pump out of service" read as one pump; a
# rating ("5 HP x 2", "480 V, 2") read as the count; a sewage works' blower, generator or vacuum station drawn as a pump
# station; one alarm float worded two ways made two; the four floats added where a controller or a button already starts
# the pumps). After the mending every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review3_station_1231.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "station_review3_1231")
KEEP = {
    "A-04": "(1.24.33) One bench reply reads otherwise, by design: the 2B's make-sheet-excel (bench_run_1268_2b) ends, after a blank line, "
            "in a sentence of prose (\u201cYou can copy the table above and paste it into Excel ...\u201d) that was a row of the table; since "
            "1.24.33 an open table or program leaves such a sentence outside it (the second review of 1.24.33).",
    "A-56": "(1.24.33) Twelve bench replies make other Chat turns, by design: the case's server says every reply stopped (finish "
            "\u201cstop\u201d), and since 1.24.33 a reply the model ended itself closes its block (1.24.32's run: a whole oil change in "
            "three steps was asked to be shorter) -- so the 0.8B's oil changes and the decks and drawings that had no END are made "
            "where they were questioned as cut off. A reply cut at its length (\u201clength\u201d) is read as before (tests/station.js).",
    "A-55": "(1.24.34) One bench reply reads otherwise, by design: the 2B's make-parallel-lamps of 1.24.4 (a failed row then and now) "
            "has its lamp L2 wired to the battery on one side only, and is now questioned for that (it never lights), where it was "
            "questioned only for the LED's resistor (the second review of 1.24.34).",
    "B-02": "the merged STATION part's own words carry the tail the question's list gave it ('for the city council'), as AI_PARTS gives a list's last words to each part (1.24.30); the station drawn is the one asked for.",
    "B-04": "the same: the list's tail ('of the pump run hours') carried into the station part's words; what is drawn is the station.",
    "B-09": "a station beside a conveyor's starter: CONTROL (the conveyor) then STATION, in the order the question names them; the case wanted the station first.",
    "B-11": "two stations in one question (a duplex and a simplex): one is made; Lantern makes one station a block, and the question in parts is not split by station.",
    "D-02": "the line handed back names the station's pumps first ('pumps 2, float FS1 ...'), the levels' floats each with its height and the control's supply and horn after them; this judge looks for a line that begins with float FS1.",
    "D-12": "a levels problem beside a right control: the correction now asks for all the blocks again, the levels mended and the control as it was (the model's 24 V DC and horn kept); the case's scripted reply sends the levels alone, so the control is made from them.",
    "D-13": "the same as D-12.",
    "D-19": "a control block of two pumps with 'pump 1 on' and 'pump 2 on' floats and no alternator: MAKE CONTROL's own line for pump 2's float (1.24.30's), unchanged here.",
    "F-26": "(1.24.32) SCHEMATIC's and ELECTRONICS' grammars still hold no word, but a free line is no longer written [^\\n]*: it is any line but END itself, since a reply may now stop without END and must stop after it (1.24.31's run, tests/fixtures/bench_run_1.24.31_*.json). What the case says is checked in tests/station.js with the new form.",
    "F-09": "a sentence that begins with a line's word ('Pump 1 and pump 2 take turns ...', 'Floats are set by ...') gets through a grammar that holds each line to its first word; the parser reads no new count or float from them.",
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
    if int(total.group(1)) != 211: fails.append("%s cases, not 211" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL THIRD STATION REVIEW 1.24.31 CHECKS PASS" if not fails else "THIRD STATION REVIEW 1.24.31 FAILED")
sys.exit(1 if fails else 0)
