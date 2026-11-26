# review2_pdf_1239.py -- the second review of PDF reading (1.24.39), replayed in Chromium.
# An agent that had not seen the code written, nor the first review's drafting, made 115 PDFs of its own after the first
# review's 14 mends (tests/fixtures/pdf_review2_1239/, REPORT.txt; cases_found.json is its run as found): 376 checks,
# 26 failed, 9 of them regressions from 1.24.38 -- a scanned page with a note or a filled field no longer read by Text
# Reader; the trailer gathered from every "trailer" word in the file (a page that shows one refused as locked); Screen,
# Lighten and Difference wrong over the white page; a visibility expression that names itself freezing the tab; damaged
# layer lists making a page unreadable; a clip set before a hidden part and ended inside it blanking the page; a page's
# clip or blend reaching its annotations. Mended (CHANGELOG 1.24.39); every check now agrees but this one, kept with its
# reason. (A PDF carrying another, locked PDF as an attachment left unpacked was read as the attachment until the third
# review's mend: objects are now read where the cross-reference sections say.)
# Usage: python3 tests/review2_pdf_1239.py   (LANTERN_OLD=<1.24.38 index.html> adds the before/after checks)
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pdf_review2_1239")
KEEP = {
    "ord_extgstate_normal.pdf": "its words are drawn with a fill see-through of 0.6 (/ca 0.6): drawn now at 60%, as poppler draws them (darkest 102 of 255 both); 1.24.38 drew them solid. The second review's own failure 9, mended for every font the PDF does not carry.",
}
r = subprocess.run([sys.executable, os.path.join(FX, "run_review.py")], cwd=FX, capture_output=True, text=True, timeout=3000)
out = r.stdout
total = re.search(r"^(\d+) cases: (\d+) pass, (\d+) fail", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
bad = re.findall(r"^FAIL  (\S+?):", out, re.M)
new = [b for b in bad if b not in KEEP]
if new: fails.append("fail, not kept: " + ", ".join(sorted(set(new))))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s pass, %d kept" % (total.group(1), total.group(2), len([b for b in bad if b in KEEP])))
print("ALL SECOND PDF REVIEW 1.24.39 CHECKS PASS" if not fails else "SECOND PDF REVIEW 1.24.39 FAILED")
sys.exit(1 if fails else 0)
