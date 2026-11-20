# review2_makesheet_1269.py -- the second review of MAKE SHEET's reading (1.24.29), replayed. Another agent, which had seen neither the code written nor the first review's cases, made 168 replies after the first round of mends (tests/fixtures/makesheet2_1269/), most of them right ones a small model would write. On that draft 147 agreed and 21 did not (a formula copied down unchanged beside a fixed $ cell, or plainly as =B2*C2, accepted with wrong totals; an invoice's total counting its subtotal twice; VAT under a total told to write a line that reads its own cell; a running balance that adds to the row two up; **bold** totals; MEDIAN, COUNTIF and SUMPRODUCT of columns read as their own cell; text functions refused). After the mending every case agrees.
# Usage: python3 tests/review2_makesheet_1269.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(ROOT, "tests", "fixtures", "makesheet2_1269", "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=1800)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = [d for d in re.findall(r"^DISAGREE\s+(\S+)", out, re.M) if d != "by"]
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 168: fails.append("168 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d SECOND MAKE SHEET REVIEW 1.24.29 FAILURES" % len(fails)) if fails else "ALL SECOND MAKE SHEET REVIEW 1.24.29 CHECKS PASS (%s of 168 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
