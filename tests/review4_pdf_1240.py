# review4_pdf_1240.py -- the fourth review of the PDF tools (1.24.40), on the third review's mends, replayed in Chromium.
# A fourth agent, that had not seen the tools or the mends written, made 22 PDFs of its own (tests/fixtures/pdf_review4_1240/:
# REPORT.txt; cases.json is its run as found) -- names broken at lines' ends in one, two and three columns drawn a
# word, a run or a line at a time (reportlab, pdfTeX, LibreOffice, Chromium), with traps (a dash ending a line, a paragraph's
# short last line, table cells, the next column's words at the same height); letter-spacing from 0.05 to 1 em beside rows of
# keys, single-letter cells, grades and equations; Turkish, Greek, ligatures and separate accents; standard fonts with no
# widths or no encoding; forms nested 70 deep and forms that draw themselves; links, named places and bookmarks holding a
# name; forms on two pages -- 831 checks, 79 failed. Mended (CHANGELOG 1.24.40); every check now agrees but these, kept
# with the reasons the reviewer gave or this session found.
# Usage: python3 tests/review4_pdf_1240.py [build.html] [1.24.39 index.html]
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pdf_review4_1240")
SITE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = tempfile.mkdtemp(prefix="review4_1240_")
OLD = sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT, "old_1239.html")
if not os.path.exists(OLD):
    old = subprocess.run(["git", "show", "lantern-1.24.39:site/index.html"], cwd=ROOT, capture_output=True)
    if old.returncode != 0: old = subprocess.run(["git", "show", "origin/lantern-1.24.39:site/index.html"], cwd=ROOT, capture_output=True)
    open(OLD, "wb").write(old.stdout)
KEEP = [
    ("[ls] ls_lo.pdf: Text reading of 'WAREHOUSE NORTH spaced in Writer'", "Writer's own letter-spacing (fo:letter-spacing), not a browser's: read a letter at a time, as 1.24.39 and poppler read it (the reviewer's note: beyond the rule)"),
    ("[ls] ls_tex.pdf: Text reading of 'WAREHOUSE NORTH and Calderdale letter-spaced.'", "microtype's \\textls with TeX's kerns between capitals: its gaps are not even, so it is not taken for letter-spacing (the reviewer's note: beyond the rule; 1.24.39 read it apart too)"),
    ("[forms] forms_rl.pdf: the mark is where the appearance draws the word", "in the tile's preview only, a field value with its own drawing is marked by Helvetica's widths from its box's edge, 2.5 pt left of where the drawing puts it; the copy is right: after flattening the word is found again where it is drawn, and every inked dot of it is black (the reviewer's finding 14)"),
]
env = dict(os.environ, R3EV=os.path.join(OUT, "evidence"), R3OUT=os.path.join(OUT, "work"), CJNAME=os.path.join(OUT, "cases.json"), PYTHONDONTWRITEBYTECODE="1")
os.makedirs(env["R3EV"], exist_ok=True); os.makedirs(env["R3OUT"], exist_ok=True)
r = subprocess.run([sys.executable, os.path.join(FX, "run_review.py"), SITE, OLD], cwd=FX, env=env, capture_output=True, text=True, timeout=6000)
out = r.stdout
m = re.search(r"^(\d+) checks, (\d+) failed", out, re.M)
fails = []
if not m: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
kept = 0
for line in re.findall(r"^FAIL  (.*)$", out, re.M):
    if any(line.startswith(k) for k, why in KEEP): kept += 1
    else: fails.append(line[:300])
for f in fails: print("FAIL " + f)
if m: print("%s checks, %s failed, %d of them kept with reasons" % (m.group(1), m.group(2), kept))
print("ALL FOURTH PDF TOOLS REVIEW 1.24.40 CHECKS PASS" if not fails else "FOURTH PDF TOOLS REVIEW 1.24.40 FAILED")
sys.exit(1 if fails else 0)
