# review2_xlsx_1268.py -- the second review of Excel files in Sheets (1.24.28), replayed. Another agent, which had not
# seen the first review's cases nor the code written, made 19 workbooks and 560 cases of its own after the first
# review's mends (tests/fixtures/xlsx/review2/): a guard of 156 ordinary formulas, ranges worked out cell by cell,
# other sheets, array and spilling formulas, GAMMA and the new functions, typed dates and text that is not a date,
# reading, number formats, merged cells, and Excel's grammar. On the mended draft 488 agreed and 72 did not (35 high:
# a list given to LEN, SEARCH, COUNTIF's test, ISNUMBER ... gave a wrong number without a word; 1 1/2 and (100) typed
# were saved as text, so Excel's total was another; LEN(A2:A9) and =C2:C4 saved as plain formulas; an Excel 2016
# file's =C2:C9*2 saved as an array formula, so Excel's own answer changed; ROUND(A1) and FLOOR(A1) written as Excel
# cannot read them; SQRT(-1) and LN(0) a hidden NaN to ISERROR and COUNT). After the mending, every case agrees but
# these, each kept for the reason given. A case that newly disagrees fails here.
# Usage: python3 tests/review2_xlsx_1268.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "spill-shown": "Sheets does not spill a list into the cells below (=SORT(C2:C9) shows its first value; another function takes the whole list): a spill, with #SPILL!, is in the queue.",
    "arrays-edit": "the same: an Excel array formula over D2:D5 is kept in D2, and D3:D5 keep the values Excel saved (said on opening) until the spill is done.",
    "gamma-read": "Adam, 2026-11-20 (QUESTIONS 2 answered): GAMMA is Excel's gamma function in Lantern too, and the Lorentz factor is LORE. An Excel file's GAMMA is read as GAMMA, not GAMMAFN (1.24.28's name for it, which still works); the values are Excel's (gamma-value-* agree).",
    "gamma-typed-save": "the same: =GAMMA(0.5) typed is Excel's gamma function, so it is saved as the formula _xlfn.GAMMA(0.5), as Excel writes it, with nothing to say (gamma-typed agrees).",
    "grammar-21": "the same: GAMMA(5) is Excel's own, no clash.",
    "datef-sumtimes": "16:00 + 10:00 shows 26:00 here, a length of time; Excel carries h:mm and shows 2:00. Lantern's is the more useful (low, Excel only).",
    "notdate-10": "17.11.2026 is a date here, as a person writing it means and Excel in most of Europe reads it; Excel in US English keeps it as text (low).",
    "notdate-11": "the same for 17/11/2026 (a day over 12 says which is the day).",
    "notdate-12": "March 5th is a date here; Excel keeps it as text (low).",
    "notdate-excel-dates": "Excel turns 1/2, 3-1 and 5/2026 into dates; Lantern keeps a fraction and a score as typed (low, recorded only).",
    "merge-paste-onto-merge": "a merged cell pasted over part of another: Excel refuses; Lantern pastes it and undoes the merge in its way (low).",
    "cells-shown-date": "=MAX(IF(B2:B9=\"Gadget\",E2:E9)) shows the day's number; Excel most likely shows the date (low, Excel only).",
    "grammar-32": "IF(A1) is written IF(A1,1,0), what Lantern means, as the review's own report advised; the case asked for it to be refused.",
    "grammar-36": "Lantern has no LET; an Excel file's LET keeps its _xlpm. names when it is read and saved again.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run([sys.executable, os.path.join(ROOT, "tests", "fixtures", "xlsx", "review2", "replay.py")], cwd=ROOT, capture_output=True, text=True, timeout=1800)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 560: fails.append("560 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d SECOND REVIEW 1.24.28 (EXCEL) FAILURES" % len(fails)) if fails else "ALL SECOND REVIEW 1.24.28 (EXCEL) CHECKS PASS (%s of 560 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
