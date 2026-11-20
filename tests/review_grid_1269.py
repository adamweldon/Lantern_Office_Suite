# review_grid_1269.py -- the review of the grid like Excel's (1.24.29), replayed in Chromium. Adam (2026-11-20): "for
# sheets clicking and dragging across cells should select a range like excel does. right clicking should give a
# dropdown with the same options excel does". A separate agent, which had not seen the code written, made 304 cases of
# its own (tests/fixtures/grid_1269/): drags over cells and headers, every menu and dialog, Insert and Delete with
# shifting (57 of them set beside LibreOffice's insertCells and removeRange), Format Cells, heights, widths, hidden
# rows, SUBTOTAL and AGGREGATE over them, .xlsx both ways, undo, and a phone's long press. On the draft 279 agreed and
# 25 did not (high: a row number through a merged cell selected all its rows, so Delete took out rows 3 to 5 for
# row 4; "=" then a click did not point; keys went nowhere after a drag on a sheet just opened; typing over a range).
# After the mending every case agrees but these, each kept for the reason given. A case that newly disagrees fails.
# Usage: python3 tests/review_grid_1269.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "D25": "Sheets has the columns A to Z: Insert with \"Shift cells right\" while Z holds something is refused, and said (\"Columns up to Z are in use ...\"); Excel moves it into AA. Columns past Z are in the queue.",
    "R34": "the same for Insert column.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run([sys.executable, os.path.join(ROOT, "tests", "fixtures", "grid_1269", "replay.py")], cwd=ROOT, capture_output=True, text=True, timeout=3600)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 304: fails.append("304 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d GRID REVIEW 1.24.29 FAILURES" % len(fails)) if fails else "ALL GRID REVIEW 1.24.29 CHECKS PASS (%s of 304 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
