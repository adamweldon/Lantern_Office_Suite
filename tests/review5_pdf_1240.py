# review5_pdf_1240.py -- the fifth review of the PDF tools (1.24.40), on the fourth review's mends, replayed in Chromium.
# A fifth agent, that had not seen the tools or the mends written, made 17 PDFs of its own (tests/fixtures/pdf_review5_1240/:
# REPORT.txt; cases.json is its run as found) -- 225 names broken by Chromium in columns, lists, indents, tables and centred
# blocks; a Word-like document set by LibreOffice (a one-column part over a two-column one); reportlab pages with headings,
# tables and footnotes under columns, two-column parts one over another, lists of prefixes; letter-spacing in serif and
# monospace, inside sentences, with kerned pairs, beside rows of single letters; standard fonts with every encoding;
# kept words on turned and slanted lines; links, named places in a tree with kids; forms over two pages, fields no page
# shows; forms 256 and 257 deep -- 1,855 checks, 100 failed. Mended (CHANGELOG 1.24.40); every check now agrees but these,
# kept with the reasons the reviewer gave or this session found. Its "as before" rows compare with the build one round
# earlier (r4: site/index.html at 35d11bf).
# Usage: python3 tests/review5_pdf_1240.py [build.html] [r4 index.html]
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pdf_review5_1240")
SITE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = tempfile.mkdtemp(prefix="review5_1240_")
OLD = sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT, "r4.html")
if not os.path.exists(OLD):
    old = subprocess.run(["git", "show", "35d11bf:site/index.html"], cwd=ROOT, capture_output=True)
    open(OLD, "wb").write(old.stdout)
KEEP = [
    ("[hyph] hy_rl.pdf: p1 'Pemberton': place 1 (broken) has all its pieces marked", "the oracle placed the second half at the upper part's 'ton' (Thorn-/ton, y 706); the page's own design (two-column parts, one over the other) puts 'Pember-' at the foot of the lower part's first column and 'ton' at the head of its second (y 621), where Lantern marks it"),
    ("[hyph] hy_rl.pdf: p1 'Pemberton': every mark sits on the word (no stray marks)", "the same: the mark at y 618-631 is the lower part's 'ton'"),
    ("[hyph] lo_word.pdf: 'Mardenholm' found by poppler (fixture check)", "the fixture's own check of poppler (poppler orders the heading after column 1's foot; the reviewer's note)"),
    ("[ls] ls_chrome2.pdf: (oracle) poppler reads", "poppler's own reading, a second opinion only (the reviewer's note: Lantern passes both)"),
    ("[enc] enc_std.pdf: p8 Helvetica /Encoding << /Differences >> (no /BaseEncoding): read as before (r4)", "changed on purpose: the codes /Differences leaves are now the font's StandardEncoding, as poppler and pdfminer read them (the reviewer's finding 10b)"),
    ("[enc] enc_std.pdf: p13 Helvetica /StandardEncoding: read as before (r4)", "changed on purpose: /StandardEncoding named is now read as such (finding 10a)"),
    ("[enc] enc_std.pdf: p10 Times-Roman /MacRomanEncoding: read as before (r4)", "changed on purpose: Mac Roman's codes above 127 are now read (finding 10e)"),
    ("[kept] kept.pdf: poppler reads every kept word in the copy as it reads it in the original", "poppler reads the 30-degree line in fragments that differ between the original and the copy ('w', 'es', 'kir' ...); every kept word is in the copy (pypdf and pdfminer read 'Penrith Keswick' whole; the reviewer's note)"),
    ("[kept] kept.pdf: poppler puts each kept word where it was", "the same fragments of the 30-degree line"),
    ("[sweep] pdf_review1_1239/cert_pubsec.pdf: read by both", "a certificate lock: refused by both builds with their message, as meant"),
    ("[sweep] pdf_review1_1239/damaged_lock_no_OU.pdf: read by both", "a damaged lock: refused by both, as meant"),
    ("[sweep] pdf_review1_1239/damaged_lock_r6_no_UE.pdf: read by both", "a damaged lock: refused by both, as meant"),
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
print("ALL FIFTH PDF TOOLS REVIEW 1.24.40 CHECKS PASS" if not fails else "FIFTH PDF TOOLS REVIEW 1.24.40 FAILED")
sys.exit(1 if fails else 0)
