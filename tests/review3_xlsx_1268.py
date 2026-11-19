# review3_xlsx_1268.py -- the third review of Excel files in Sheets (1.24.28), replayed. A third agent, which had seen
# neither the code written nor the other reviews' cases, tried the second review's new rules (tests/fixtures/xlsx/
# review3/): 628 cases, among them a guard of 252 everyday formulas that pass a range in ordinary ways (250 gave
# Excel's answer) and 84 plain-formula files for Excel's @. On that draft 560 agreed and 68 did not (14 high: names of
# whole columns of data, =Qty*Price filled down, showed the first row's product in every row, and were saved so;
# ISBLANK over a list never found a blank; AGGREGATE's list given a wrong @; ROW of a range gave its first row only).
# After the mending, every case agrees but these, each kept for the reason given. A case that newly disagrees fails.
# Usage: python3 tests/review3_xlsx_1268.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "guard-188": "ISLOGICAL: Lantern keeps TRUE and FALSE as 1 and 0, so it cannot say which a value is (in the queue with TRUE and FALSE as values of their own); #NAME?, not a wrong answer.",
    "guard-190": "TYPE: the same root.",
    "read-op-index0": "a plain formula whose answer is a range from INDEX(...,0,n) alone in a cell: Excel meets it at the formula's row, Sheets shows its first value (low; =@INDEX(...) is met).",
    "read-op-offset": "the same for OFFSET alone in a cell (low).",
    "read-op-range-index": "C2:INDEX(C2:C9,3), a range that ends where INDEX points: Sheets' : joins two cells only (in the queue).",
    "newfn-22": "the same, typed in a sheet.",
    "newfn-23": "INDEX(...):INDEX(...), the same.",
    "read-op-intersect": "Excel's space between two ranges (where they meet) is not in Sheets (low, rare).",
    "read-hx-match-expr": "MATCH(1,(A2:A9=\"South\")*(B2:B9=\"Widget\"),0) in a plain formula: Lantern gives the answer meant; Excel 2019 without Ctrl+Shift+Enter would show an error (only Excel can say).",
    "read-hx-match-true": "the same for MATCH(TRUE,C2:C9>6,0).",
    "round-hx-single-sheet": "written _xlfn.SINGLE(C2:C9)*D2:D9, Excel 365's own form; LibreOffice, standing in, has no SINGLE (only Excel can say).",
    "write-grammar-47": "MID(\"abcd\",2) is written MID(\"abcd\",2,1), what Lantern means, as the review's own report advised; the case asked for it to be refused.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run([sys.executable, os.path.join(ROOT, "tests", "fixtures", "xlsx", "review3", "replay.py")], cwd=ROOT, capture_output=True, text=True, timeout=1800)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 628: fails.append("628 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d THIRD REVIEW 1.24.28 (EXCEL) FAILURES" % len(fails)) if fails else "ALL THIRD REVIEW 1.24.28 (EXCEL) CHECKS PASS (%s of 628 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
