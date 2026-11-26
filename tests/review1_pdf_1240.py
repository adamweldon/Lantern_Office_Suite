# review1_pdf_1240.py -- the first review of the PDF tile and its tools (1.24.40), replayed in Chromium.
# An agent that had not seen the tools written made 32 PDFs with programs that are not Lantern (reportlab, pikepdf,
# qpdf, pdfTeX, xelatex, LibreOffice, Chromium, tesseract) and read every result with qpdf, poppler, pypdf, pdftk and
# tesseract (tests/fixtures/pdf_review1_1240/: REPORT.txt; cases.json is its run as found): 923 checks, 125 failed.
# Worst, a leak: Redact left words readable, or in the file, when they were not drawn level (a vertical label, a raised
# word, upside down, a landscape page, Chromium's sideways text, a Type 3 font). Then: a PDF with more than one object
# stream opened as no pages; Edit text on a turned page took out lines nobody touched; Combine dropped every form but the
# first; a second stamp made the first solid; comments and filled fields on a turned page drawn sideways. Mended
# (CHANGELOG 1.24.40); every check now agrees but these, kept with the reasons the reviewer gave or found here.
# Usage: python3 tests/review1_pdf_1240.py [build.html]   (default site/index.html)
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pdf_review1_1240")
SITE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
KEEP = [
    ("latex_area: tesseract does not read 'offices'", "the oracle reads 'office' back, which the page keeps in 'confidential office' (not marked in this case): the reviewer's own note"),
    ("annots_find: 'ESMERALDA' nowhere else in the file", "the oracle counts the unmarked page 2's own comment twice (its words and its drawing): page 2 keeps its comment, as it should"),
    ("annots_rot_find: 'ESMERALDA' nowhere else in the file", "the same, on a turned page"),
    ("annots_find_flatfirst: page 2 (not marked) drawn as before", "the case flattens every page's comments itself before redacting: by design (the reviewer's note)"),
    ("prot_long: poppler opens it with that password", "poppler's command-line tools keep only 32 letters of a password: pdftotext cannot open qpdf's own copy with this 140-letter password either; qpdf and pypdf open Lantern's"),
    ("tile stamp twice: DRAFT and Page 1 of 2 both on page 1", "poppler reads a word turned 45 degrees a letter at a time (D, R, A, F, T apart); the watermark is there, and the next check finds its faintness kept"),
]
fails, total = [], 0
for runner, limit in (("run_redact.py", 1800), ("run_tools.py", 1800), ("run_tile.py", 1200)):
    out_dir = tempfile.mkdtemp(prefix="review1_1240_")
    r = subprocess.run([sys.executable, os.path.join(FX, runner), SITE, out_dir], cwd=FX, capture_output=True, text=True, timeout=limit)
    m = re.search(r"^(\d+) checks, (\d+) failed", r.stdout, re.M)
    if not m: fails.append(runner + " did not finish: " + (r.stderr or r.stdout)[-1200:]); continue
    total += int(m.group(1))
    for line in re.findall(r"^FAIL  (.*)$", r.stdout, re.M):
        if not any(line.startswith(k) for k, why in KEEP): fails.append(runner + ": " + line[:300])
    print("%s: %s checks, %s failed" % (runner, m.group(1), m.group(2)))
for f in fails: print("FAIL " + f)
print("%d checks; %d kept with reasons" % (total, len(KEEP)))
print("ALL FIRST PDF TOOLS REVIEW 1.24.40 CHECKS PASS" if not fails else "FIRST PDF TOOLS REVIEW 1.24.40 FAILED")
sys.exit(1 if fails else 0)
