# review2_liftstation_1234.py -- the second review of 1.24.34 (a lift station's schematic and the drawings it needs),
# replayed. An agent that had seen neither the rules written nor the first review (it read it only after writing its
# own) made 249 cases after the first round of mends (tests/fixtures/liftstation_review2_1234/, findings.txt), with
# 1.24.33 beside the draft and eleven results drawn in Chromium. On that draft 184 agreed (11 high: a second start
# float, a triplex's third start and a probe dropped while the summary said they were taken; the ground line closing a
# dead short through a switch; a MAKE STATION block after a schematic not read; "write a lift station schematic", the
# station before the drawing word, still sent to the hobby circuit). After the mending every case agrees but these,
# each kept for the reason given. The cases read Chat's other blocks from rec.moreMade (renamed from rec.more, the
# library's titles since 1.24.18, as the review's own observation asked).
# Usage: python3 tests/review2_liftstation_1234.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "liftstation_review2_1234")
KEEP = {
    "B-isa-tags-no-names": "the ISA tags with no names are read from the tag (LSL1 low level: off; LSH1 high level: the lead, said; "
                           "LSHH1 high high level: the alarm) and the station made -- the first of the two right answers the case gives "
                           "(\\u201cread from the tag, or sent back with lines that follow it\\u201d); its judge accepts only the second.",
    "B-no-job-floats-back": "what goes back quotes the line the AI wrote (\\u201cpart LS1 switch \\x22Level Switch 1\\x22\\u201d), as the "
                            "same review's finding 6 asked, then the line to write (\\u201clike: float LS1 \\x22off\\x22\\u201d); the "
                            "judge looks for \\u201cfloat LS1 ... name its job\\u201d in Lantern's own float line, which is no longer quoted.",
    "B-spanish-back": "the same as B-no-job-floats-back: \\u201cpart F1 float \\x22Paro\\x22\\u201d is quoted as the AI wrote it.",
    "B-probes-stop-start-high": "the probe \\u201cHigh\\u201d beside \\u201cStart\\u201d is read as a second start, the lag float (said), so "
                                "\\u201cno high level alarm float: the block has none\\u201d is true of the station drawn. Adam (2026-11-23): "
                                "\\u201cshould be high level to start second pump while first is already running and alarm level float "
                                "at highest for alarm indication\\u201d -- High is the lag start, as Lantern reads it.",
    "A-miss-list-and-draw": "\\u201cList the drawings a lift station needs and draw them\\u201d: \\u201clist\\u201d is read as a "
                            "document's word (OTHER_DOC, since 1.24.31), as on 1.24.33.",
    "D-port-short-unseen": "older than 1.24.34: \\u201cwire B1+ S1, wire S1 B1\\u201d puts a named and an unnamed terminal on one side "
                           "in the netlist and the short is not seen. Lantern's own line never writes a named terminal.",
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
    if int(total.group(1)) != 249: fails.append("%s cases, not 249" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL SECOND LIFT STATION SCHEMATIC REVIEW 1.24.34 CHECKS PASS" if not fails else "SECOND LIFT STATION SCHEMATIC REVIEW 1.24.34 FAILED")
sys.exit(1 if fails else 0)
