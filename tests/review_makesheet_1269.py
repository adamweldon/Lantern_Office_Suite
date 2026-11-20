# review_makesheet_1269.py -- the review of MAKE SHEET's [B2] (1.24.29), replayed. On the GitHub run of 1.24.28 the 4B
# wrote =[B2]*[C2] for =B2*C2, and Lantern sent it back ("names [B2], which is not a column"); the draft read [B2] as the
# cell where no column has that name. A separate agent, which had not seen the rule written, made 169 replies of its own
# (tests/fixtures/makesheet_cells_1269/): right ones with column names, the new reading, and collisions (headers
# "C3PO", "B2 shelf", "Q4 sales", bins "A1" and "B2", "C20"). On the draft 130 agreed and 39 did not (18 high: row 2's
# formula copied down read as row 2's cells in every row; [AA2], [Wk1] and [CO2] read as empty cells past the table;
# [Q4] beside "Q4 sales" read as a cell); 14 of them were older than the rule (stacked summary rows counted, a row begun
# with | shifted, text formulas refused, "Celsius (C)" in brackets broken). After the mending every case agrees but
# the one kept for its reason. A case that newly disagrees fails here.
# Usage: python3 tests/review_makesheet_1269.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "ctrl-plain-copied": "a plain =B2*C2 copied down unchanged into rows 3 and 4 is sent back with the line for row 3 (=B3*C3): the second reviewer found such sheets accepted with wrong totals (its B010, B035); the first reviewer's control case had them made as written (low).",
    "back-one-row-typo": "row 3's =[B2]*[C3] (row 2's quantity by a typo) is read as written, as =B2*C3 written plainly is; a formula may well use another row's cell (a rate, the row above), and nothing tells the typo apart (the reviewer's own note: medium, a judgment call).",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(ROOT, "tests", "fixtures", "makesheet_cells_1269", "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=1800)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 169: fails.append("169 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d MAKE SHEET CELLS REVIEW 1.24.29 FAILURES" % len(fails)) if fails else "ALL MAKE SHEET CELLS REVIEW 1.24.29 CHECKS PASS (%s of 169 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
