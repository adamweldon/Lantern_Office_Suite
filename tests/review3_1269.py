# review3_1269.py -- the third review of 1.24.29 (the grid, CONVERT, MAKE SHEET), replayed. A third agent, which had
# seen neither the code written nor the earlier reviews' cases, made 353 judged cases after the second round of mends
# (tests/fixtures/round3_1269/): 122 on the grid in Chromium (rows and columns in a workbook whose sheets have accented,
# Cyrillic and quoted names; undo across sheets; the mouse while a formula is written; AGGREGATE and SUBTOTAL over
# subtotals, set beside LibreOffice), 159 on CONVERT (a sheet, Chat and Save .xlsx, from the units' exact definitions)
# and 72 MAKE SHEET replies. On that draft 300 agreed and 53 did not (high: =SUMIF([Item],"Milk",[Cost]) read both
# columns as the row's cells and showed 0; a VAT line =SUM([Cost])*0.2 was taken for a total; Feb's total took in
# Jan's; =Março26!B6 had its sheet's name broken by a row put in; one Ctrl+Z took back typing on one sheet and a
# row's move on another). After the mending every case agrees but these, each kept for the reason given.
# Usage: python3 tests/review3_1269.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "round3_1269")
KEEP = {
    "W40-undo-on-summary-after-rows-on-jan": "one Ctrl+Z on Summary now takes back the row put in on Jan (the last thing done in the workbook) and leaves the x typed before it, as Excel does; Lantern then shows Jan, as Excel shows the sheet it took a change back on, so the case reads Jan's H1 where it looked for Summary's (none).",
    "B31-pond-N": "\"pond\" is not among the units of CONVERT on Microsoft's page (Force: N, dyn or dy, lbf), checked 2026-11-20; LibreOffice has it. Lantern follows Excel's list (none).",
}
RUNS = [
    ("grid", [sys.executable, os.path.join(FX, "replay_grid.py")], 122, 2400),
    ("CONVERT", ["node", os.path.join(FX, "replay_convert.js")], 159, 900),
    ("MAKE SHEET", ["node", os.path.join(FX, "replay_makesheet.js")], 72, 900),
]
VERBOSE = "-v" in sys.argv
fails, agree_n, dis_n = [], 0, 0
for name, cmd, n, limit in RUNS:
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=limit)
    out = r.stdout
    if VERBOSE: print(out)
    agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
    dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
    total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
    if not total: fails.append(name + ": the replay did not finish: " + (r.stderr or out)[-1500:]); continue
    if int(total.group(1)) != n: fails.append("%s: %d cases, not %s" % (name, n, total.group(1)))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append(name + ": disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
    agree_n += len(agree); dis_n += len(dis)
for f in fails: print("FAIL", f)
print(("%d THIRD REVIEW 1.24.29 FAILURES" % len(fails)) if fails else "ALL THIRD REVIEW 1.24.29 CHECKS PASS (%d of 353 agree, %d kept)" % (agree_n, dis_n))
sys.exit(1 if fails else 0)
