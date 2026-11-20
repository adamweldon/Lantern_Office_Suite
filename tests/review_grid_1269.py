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
# the cases in two halves at once, each in its own Chromium on its own port (a case opens a fresh page: the whole run
# took about half an hour in one)
HERE = os.path.join(ROOT, "tests", "fixtures", "grid_1269")
sys.path.insert(0, HERE)
import cases as CASES
ids = [c["id"] for c in CASES.CASES]
procs = [subprocess.Popen([sys.executable, os.path.join(HERE, "replay.py"), "--only", ",".join(ids[k::2]), "--port", str(8269 + k)], cwd=ROOT,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for k in range(2)]
outs = [p.communicate(timeout=3600) for p in procs]
out = "\n".join(o[0] for o in outs)
class R: pass
r = R(); r.stderr = "\n".join(o[1] for o in outs)
sums = [re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", o[0], re.M) for o in outs]
if all(sums): out += "\n%d cases: %d AGREE, %d DISAGREE\n" % tuple(sum(int(m.group(i)) for m in sums) for i in (1, 2, 3))
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.findall(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
total = re.match(r"(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", "%s cases: %s AGREE, %s DISAGREE" % total[-1]) if len(total) == 3 else None
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
