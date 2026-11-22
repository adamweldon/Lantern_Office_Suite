# review2_pptx_1233.py -- the second review of 1.24.33 (PowerPoint files in Slides, EMF pictures, and the rule that a
# reply the model ended itself is ended), replayed. An agent that had seen neither the code written nor the first review
# made 210 cases of its own after the first round of mends (tests/fixtures/pptx_review2_1233/, findings.txt): 40 decks
# read (grids, timelines, comparisons, charts with percents, dates and two levels, SmartArt, pictures put together,
# turned and cropped in Chromium, damaged and wrong files), EMF pictures of its own drawn in Chromium and by LibreOffice,
# decks saved and checked against the schemas, in python-pptx and LibreOffice, read back and measured with a font of
# Georgia's widths, and the stop rule tried with prose, <think>, two blocks and older replies. On that draft 174 agreed
# (7 high: a sentence after an open block put on a slide, in a table and in a program; an EMF path's lines starting a
# figure each; a percent sign written as text multiplying by 100). After the mending every case agrees but these, each
# kept for the reason given.
# Usage: python3 tests/review2_pptx_1233.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pptx_review2_1233")
KEEP = {
    "read-timeline-two-rows": "Years over what happened, in two rows of alike boxes, read as a grid, row by row (the years, then the words): "
                              "the case wants each year with its words, and a grid of steps 1 to 6 wants rows; nothing in the file says which.",
    "read-lo-boxes": "LibreOffice's save of the same deck reads as PowerPoint's but for that timeline: LibreOffice shrinks each box to its "
                     "words, so the years and the words are no longer alike and are read by their columns, as the case wants.",
    "write-num-restart-shown": "LibreOffice numbers a second list on from the first (3, 4) where PowerPoint starts it again: writing startAt=1 "
                               "did not change LibreOffice (tried), and the review's own write-num-types asks for none where a list starts at 1.",
    "write-text-after-table": "A line after a table is saved in the text box above it: a slide's text box holds paragraphs and a table is a "
                              "frame of its own (the first review's w-table-in-li-order). Low, as the review says.",
    "write-fit-thirty-said": "Both slides are stored shrunk to fit (the review's write-fit cases agree); Lantern's estimate puts slide 1 just "
                             "over 60%, the review's measure with Gelasio just under: only whether it is said differs.",
    "ai-two-blocks-first-open": "A block ended by the next MAKE block is called cut off, as before 1.24.33: the stop rule is about where the "
                                "reply ends.",
    "emf-xor-twice": "A shape drawn twice with a XOR pen is drawn as a difference, which is XOR exactly for black and white only; "
                     "LibreOffice differs as well (220, 30, 30).",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(FX, "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=1500)
out = r.stdout
if VERBOSE: print(out)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 210: fails.append("%s cases, not 210" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL SECOND PPTX REVIEW 1.24.33 CHECKS PASS" if not fails else "SECOND PPTX REVIEW 1.24.33 FAILED")
sys.exit(1 if fails else 0)
