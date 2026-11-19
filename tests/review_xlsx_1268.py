# review_xlsx_1268.py -- the first review of Excel files in Sheets (1.24.28), replayed. A separate agent, which had not
# seen the code written, made 38 workbooks and 155 cases of its own (tests/fixtures/xlsx/review/), each judged against
# what Excel does, with LibreOffice, openpyxl and the spreadsheet schema standing in for Excel. On the first draft 105
# agreed and 50 did not (6 of them high: a 1904 workbook's durations moved by 1,462 days; array formulas saved as
# plain ones; Lantern's GAMMA, the Lorentz factor, saved as Excel's gamma function; a sheet saved alone naming sheets
# not in its file; a table's names saved into a file with no table). After the mending, every case agrees but these,
# each kept for the reason given. A case that newly disagrees fails here.
# The replay drives Lantern in jsdom (run.js) and needs LibreOffice, openpyxl and lxml for the files it saves; where
# one is missing, the cases that need it are judged on the rest (and say SKIP).
# Usage: python3 tests/review_xlsx_1268.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "read-hidden-rows": "Sheets shows the rows Excel hid (a sheet here cannot hide a row), so SUBTOTAL(109) and AGGREGATE count them; the note says so and names each cell. Hiding rows in the grid is in the queue.",
    "round-hidden": "the same, saved: the rows are shown in the file too, so Excel's totals are the ones Lantern showed.",
    "read-wide": "Sheets has the columns A to Z: the cells past Z are left out, and the note says how many and names each total that used them.",
    "round-wide": "the same, saved; Save .xlsx names each formula that reaches past Z.",
    "read-booleans": "Lantern keeps TRUE and FALSE as 1 and 0 (it has no yes-or-no type of its own), so =A2=1 of a TRUE is TRUE here; the note names the cell.",
    "read-fn-text": "the same root: CONCAT(\"A\",1,TRUE) joins 1, not TRUE; the note names the cell.",
    "order-compare": "the same root: =1<2<3 and =TRUE>1 (rare).",
    "read-crosssheet-said": "the review asked for a note naming Summary!B2, which showed #REF!; it is now worked out from the workbook's other sheets, as Excel does, so there is nothing to say (read-crosssheet agrees).",
    "write-newer-functions": "C28 is Lantern's GAMMA, the Lorentz factor: saved as its value and said, since Excel's GAMMA is the gamma function (the review's own write-gamma-name-clash agrees).",
    "grammar-lantern-names": "the review expected POW and CEIL named as Lantern's own; since the second review they are written as Excel's POWER and CEILING(x,1), which work out the same in Excel, and the note says so.",
    "grammar-let": "Lantern has no LET; an Excel file's LET keeps its _xlpm. names when it is read and saved again.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run([sys.executable, os.path.join(ROOT, "tests", "fixtures", "xlsx", "review", "replay.py")], cwd=ROOT, capture_output=True, text=True, timeout=1800)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 155: fails.append("155 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d REVIEW 1.24.28 (EXCEL) FAILURES" % len(fails)) if fails else "ALL REVIEW 1.24.28 (EXCEL) CHECKS PASS (%s of 155 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
