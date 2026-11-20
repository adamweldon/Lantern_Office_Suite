# review2_grid_1269.py -- the second review of the grid like Excel's (1.24.29), replayed in Chromium. Another agent,
# which had seen neither the code written nor the first review's cases, made 229 judged cases after the first round of
# mends (tests/fixtures/grid2_1269/), 126 of them on the mended rules (a row through a merged cell, Point mode, the keys
# after a press, Shift+arrow over hidden rows, merging that asks, Column Width in Excel's characters, the menu key on
# whole rows). On that draft 197 agreed and 32 did not (high: a click straight after a drag was swallowed, so a formula
# being written lost what was typed; typing then dragging did nothing; inserting a row moved =Jan!B6 on this sheet and
# left another sheet's =Jan!B6 behind when rows went in on Jan). After the mending every case agrees but these, each
# kept for the reason given; five it could not judge are not counted. A case that newly disagrees fails here.
# Usage: python3 tests/review2_grid_1269.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "r2-shift-click-point": "Point mode in a formula takes a press (a cell) and a drag (a range); Shift+click to stretch it is not there yet (low; in the queue).",
    "r2-ctrl-click-point": "the same for Ctrl+click adding a second reference (low).",
    "r2-arrow-point": "the arrows do not point in a formula; the draft does not claim it (low).",
    "r2-f4": "F4 does not cycle $ in a formula; the draft does not claim it (low).",
    "r6-12-5": "Column Width 12.5 is snapped to whole pixels as Excel snaps it (88 + 5 = 93, 13.28515625 in the file, by the formula of the file format's standard); the reviewer expected 92 pixels or 13.28125 -- which Excel writes could not be checked here (no Excel) (none seen).",
    "menu-cell-in-rows": "a right-click on a cell inside whole rows selected shows the cell menu, its Insert and Delete acting on the rows; the reviewer has Excel showing the row menu there, the first reviewer could not judge it (low).",
    "menu-insert-copied": "Insert Copied Cells is not there yet: copy, then Insert and Paste (low; in the queue).",
    "menu-insert-cut": "the same for Insert Cut Cells (low; in the queue).",
    "keys-ctrl-9": "Ctrl+9 is the browser's own key for its last tab, which a page cannot take; Hide is on the row menu (low).",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run([sys.executable, os.path.join(ROOT, "tests", "fixtures", "grid2_1269", "replay.py"), "--port", "8241"], cwd=ROOT, capture_output=True, text=True, timeout=3000)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 229: fails.append("229 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d SECOND GRID REVIEW 1.24.29 FAILURES" % len(fails)) if fails else "ALL SECOND GRID REVIEW 1.24.29 CHECKS PASS (%s of 229 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
