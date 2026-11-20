# review2_excelnames_1269.py -- the second review of Excel's names (1.24.29), replayed. Another agent, which had seen neither the code written nor the first review's cases, made 480 cases after the first round of mends (tests/fixtures/excelnames2_1269/): 324 everyday conversions (cooking, fuel, tyre pressure, shipping weights, energy bills) each in Chat, in a sheet and saved (LibreOffice recalculating the files), 40 with units in other cells, 124 on the mended functions. On that draft 463 agreed and 17 did not (8 imperial pints in gallons had lost the imperial reading, 1.2 for 1; a first argument with brackets in it, CONVERT(SUM(A1:A2),"lb","kg"), was saved with Lantern's unit and Excel showed #N/A; wrong notes for units in cells). After the mending every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review2_excelnames_1269.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "q22": "a unit made by a formula (\"l\"&\"b\") is left as written on saving, and Excel shows #N/A there; Lantern reads only units written whole, in quotes or in a cell (rare).",
    "R11": "Lantern keeps TRUE and FALSE as 1 and 0, so ROMAN(1999,TRUE) is form 1; Excel's TRUE is the classic form (LibreOffice does as Lantern). TRUE and FALSE as values of their own are in the queue.",
    "R12": "the same: ROMAN(1999,FALSE) is form 0 here, Excel's simplified form 4.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(ROOT, "tests", "fixtures", "excelnames2_1269", "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=1800)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = [d for d in re.findall(r"^DISAGREE\s+(\S+)", out, re.M) if d != "by"]
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 480: fails.append("480 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d SECOND EXCEL NAMES REVIEW 1.24.29 FAILURES" % len(fails)) if fails else "ALL SECOND EXCEL NAMES REVIEW 1.24.29 CHECKS PASS (%s of 480 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
