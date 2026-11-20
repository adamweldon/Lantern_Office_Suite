# review_excelnames_1269.py -- the review of Excel's names in Lantern (1.24.29), replayed. Adam (2026-11-20): "Excel
# functions should all match excel for compatibility so yes we could use LORE for LORENTZ factor". A separate agent,
# which had not seen the change written, made 1,015 cases from Microsoft's documentation and the exact unit definitions
# (tests/fixtures/excelnames_1269/): GAMMA as Excel's gamma function and LORE the Lorentz factor; CONVERT in a sheet
# (253 everyday conversions as a guard, Excel's prefixes, squares and cubes, and names Excel lacks); the Chat
# calculator; Save .xlsx; and an audit of the 254 function names Lantern shares with Excel. On the draft 926 agreed and
# 89 did not (13 high: "ton" was Excel's short ton beside "kg" but the tonne beside "kilograms", and Save .xlsx wrote
# it as "Mg"; FIXED and DOLLAR put commas in the decimals; TEXTBEFORE with a value left out; FREQUENCY gave one count;
# ROMAN's forms; ADDRESS in R1C1; #ERR where Excel gives #N/A). After the mending every case agrees but these, each
# kept for the reason given. A case that newly disagrees fails here.
# Usage: python3 tests/review_excelnames_1269.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = {
    "ga-009": "GAMMA(170.5) differs from the reviewer's figure in the 13th digit; Excel's own last digits near the top of its range could not be checked here (low).",
    "ga-017": "the same for GAMMA(171.6) (low).",
    "ch-008": "the reviewer's case asked for the draft's design (plain \"ton\" the tonne in Chat); its own report advised one meaning everywhere, and so it is now: CONVERT's \"ton\" is Excel's short ton in Chat as in a sheet (a tonne is \"t\", \"tonne\" or \"Mg\").",
    "xl-037": "\"pond\" is not on Microsoft's CONVERT page, so Lantern no longer has it (the reviewer marked the case unjudged).",
    "au-460": "Lantern keeps TRUE and FALSE as 1 and 0 (it has no yes-or-no type of its own): IF(FALSE,1) shows 0, not FALSE; in the queue with the other TRUE and FALSE cases (low).",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(ROOT, "tests", "fixtures", "excelnames_1269", "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=1800)
out = r.stdout
if VERBOSE: print(out)
agree = re.findall(r"^AGREE\s+(\S+)", out, re.M)
dis = [d for d in re.findall(r"^DISAGREE\s+(\S+)", out, re.M) if d != "by"]   # "DISAGREE by harm: ..." is the count
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 1015: fails.append("1015 cases, not %s" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new) + "\n" + "\n".join(l for l in out.splitlines() if l.startswith("DISAGREE") and l.split()[1] in new))
    mended = [c for c in KEEP if c in agree]
    if mended: print("NOW AGREE (take them out of KEEP):", ", ".join(mended))
for f in fails: print("FAIL", f)
print(("%d EXCEL NAMES REVIEW 1.24.29 FAILURES" % len(fails)) if fails else "ALL EXCEL NAMES REVIEW 1.24.29 CHECKS PASS (%s of 1015 agree, %d kept)" % (len(agree), len(dis)))
sys.exit(1 if fails else 0)
