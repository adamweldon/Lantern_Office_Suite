# review3_pdf_1239.py -- the third review of PDF reading (1.24.39), replayed in Chromium.
# An agent that had not seen the code written, nor the first two reviews' drafting, made 73 PDFs of its own after the
# second review's mends (tests/fixtures/pdf_review3_1239/, REPORT.txt; cases_found.json is its run as found): 182 checks,
# 20 failed, 3 of them regressions from 1.24.38 -- a LibreOffice page with see-through shapes taking 10 to 30 seconds to
# draw (one shared resource list followed again from every form); a blend mode four forms deep, or in a Type 3 font,
# wiping its drawing off the paper; a page leaving a clip and an open q drawn see-through, its comments cut off. Also
# mended: LaTeX letters drawn torn (the flex end point read as y, x), a small logo making Text Reader read a page at 72 dots
# an inch, an update without document details keeping the old title, a PDF attached unpacked inside another read as the
# document (objects now read where the cross-reference sections say), words either side of a hidden part read as one,
# outlined letters ignoring the stroke's see-through. Every check now agrees but these, kept with reasons.
# Usage: python3 tests/review3_pdf_1239.py   (the sweep of every fixture against 1.24.38 needs LANTERN_OLD; left out)
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pdf_review3_1239")
KEEP = {
    "ord_pdftex.pdf": "drawn as 1.24.38 drew it, pixel for pixel: not now, by the review's own finding 9 (LaTeX's letters were torn; drawn whole now, as poppler)",
    "tr_scan150_note.pdf": "a 150-dpi scan read at its own sharpness: now at no less than 2.5 dots a point (180 dpi), the review's own fix for finding 4",
    "tr_scan150_fields.pdf": "the same",
    "tr_scan150_rot90_note.pdf": "the same",
}
r = subprocess.run([sys.executable, os.path.join(FX, "run_review.py"), "trailer", "hidden", "blend", "textreader", "forms"], cwd=FX, capture_output=True, text=True, timeout=3000)
out = r.stdout
total = re.search(r"^(\d+) checks: (\d+) pass, (\d+) FAIL", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
bad = re.findall(r"^FAIL  (\S+?):", out, re.M)
new = [b for b in bad if b not in KEEP]
if new: fails.append("fail, not kept: " + ", ".join(sorted(set(new))))
if "page errors: {'new': []" not in out: fails.append("errors in the page: " + (re.search(r"page errors:.*", out) or [""])[0][:500])
for f in fails: print("FAIL " + f)
if total: print("%s checks: %s pass, %d kept" % (total.group(1), total.group(2), len([b for b in bad if b in KEEP])))
print("ALL THIRD PDF REVIEW 1.24.39 CHECKS PASS" if not fails else "THIRD PDF REVIEW 1.24.39 FAILED")
sys.exit(1 if fails else 0)
