# review3_pdf_1240.py -- the third review of the PDF tools (1.24.40), on the second review's mends, replayed in Chromium.
# A third agent, that had not seen the tools or the mends written, made 25 PDFs of its own (tests/fixtures/pdf_review3_1240/:
# REPORT.txt; cases_found.json is its run as found) -- pdfTeX in three columns with names broken at line ends, LibreOffice
# and xelatex letters in Turkish, Greek and Cyrillic capitals, Chromium's letter-spacing from 0.05 to 0.9 em and soft hyphens,
# a page stamped ten times by qpdf (forms ten deep), ligatures and accents written as letters of their own, a comb field
# flattened by another program, links, named places and bookmarks holding a name -- and redacted words on page 1 of every
# PDF under tests/fixtures: 4,335 checks, 278 failed. Mended (CHANGELOG 1.24.40); every check now agrees but these, kept
# with the reasons the reviewer gave or this session found.
# Usage: python3 tests/review3_pdf_1240.py [build.html] [1.24.39 index.html]
#   (default site/index.html; the 1.24.39 page from git, lantern-1.24.39:site/index.html)
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pdf_review3_1240")
SITE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = tempfile.mkdtemp(prefix="review3_1240_")
OLD = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(OUT, "old_1239.html")
if not os.path.exists(OLD):
    old = subprocess.run(["git", "show", "lantern-1.24.39:site/index.html"], cwd=ROOT, capture_output=True)
    if old.returncode != 0: old = subprocess.run(["git", "show", "origin/lantern-1.24.39:site/index.html"], cwd=ROOT, capture_output=True)
    open(OLD, "wb").write(old.stdout)
KEEP = [
    # -- poppler cannot see what the check asks of it
    ("[redact] e_drawing.pdf: drawing:", "a word on a 30-degree slant: poppler cuts it into fragments ('Ra', 'v', 'en', 's', 'wo', 'rth'), on the original and otherwise on the copy, and counts them as other words; the marks are a box a letter on the word (pdfplumber's letters, and by eye: evidence/drawing_copy_30deg_ravensworth.png), the first touching the 'A,' before it (the reviewer's item 11: upright boxes round slanted letters)"),
    ("[redact] e_drawing_rot90.pdf: drawing_rot90:", "the same slanted word on the page turned 90: poppler's fragments"),
    ("[area] e_drawing_rot90.pdf: area_drawing_rot90:", "the same slanted word: poppler's fragments"),
    ("[redact] e_textops.pdf: textops_p2:", "page 2's 30-degree Goathland: poppler's fragments ('gre', 'de')"),
    ("[redact] e_textops.pdf: textops: p1 the mark [237.2, 285.2, 285.6, 299.4] lies over a word looked for", "'Ashworth-', the first half of Ashworth-Bramley broken at its own hyphen, marked on purpose: poppler does not join the halves in its word boxes"),
    ("[redact] e_textops.pdf: textops: p1 the mark [71.3, 298.2, 110.5, 312.4] lies over a word looked for", "'Bramley', the second half (the mark's top grazes the line above by 0.2 pt)"),
    ("[redact] l_manual3.pdf: manual3: p1 the mark", "the halves of names broken at a line's end in three columns ('Win-' / 'terbourne;', 'Feath-' / 'erstonehaugh,', 'Ra-' / 'venscroft.'), marked on purpose: poppler joins some such halves in its text and none in its word boxes; and the halves of Featherstone- / haugh's beside Ravens- / croft, that the size check takes for Ravenscroft's"),
    ("[redact] l_manual3.pdf: manual3: p1 no word that is not looked for is cut", "the same halves, counted by poppler as other words"),
    ("[redact] c_styles.pdf: chrome: p1 the mark", "poppler keeps Chromium's soft hyphens inside its words ('Feather\\xadstone\\xadhaugh'), and reads 'ΠΑΠΑΔΟΠΟΥΛΟΣ' (capitals, written without accents) as another word than the 'Παπαδόπουλος' looked for, and the turned label's 'Quenby-' / 'Ashton' as two words: the marks are on the names (the reviewer's own note)"),
    ("[redact] c_styles.pdf: chrome: p1 no word that is not looked for is cut", "the same: the names themselves, with poppler's soft hyphens, and the Greek capitals"),
    ("[redact] c_styles.pdf: chrome: p1 every word not marked is still found", "the copy has the soft-hyphened words without their soft hyphens, Chromium's letter-spaced '(0.2em)' as one word, and the header's dashes as Lantern reads them (the reviewer's item 12: Chromium's header font maps them to private-use letters, as 1.24.39 read them)"),
    ("[redact] x_intl.pdf: intl: p1 the mark", "'οδος' looked for now finds 'οδός' too (accents folded, as the reviewer's item 2 asks); its locator compares with accents and calls that mark stray beside ΠΑΠΑΔΟΠΟΥΛΟΣ"),
    ("[redact] x_intl.pdf: intl: p1 no word that is not looked for is cut", "'οδός', found by 'οδος' as above"),
    ("[redact] lo_letter.pdf: lo_letter: p1 the mark", "'ΠΑΠΑΔΟΠΟΥΛΟΣ' looked for finds 'Παπαδόπουλος' in the table (accents folded, as item 2 asks), next to Şahin's cell"),
    ("[redact] lo_letter.pdf: lo_letter: p1 no word that is not looked for is cut", "'Παπαδόπουλος', found by 'ΠΑΠΑΔΟΠΟΥΛΟΣ' as above"),
    ("[redact] r_invoice.pdf: stamped10:", "the reviewer's own stamps were drawn over the invoice's header, 7 pt apart at 8 pt: the words under the stamped words are covered by any mark over them (the reviewer's note)"),
    ("[redact] e_textops.pdf: textops: p1 every word not marked is still found", "the glyph-name line (u1F600 ... on a Helvetica not embedded): poppler gives those names no width, so its words there sit elsewhere (the reviewer's note: left out of its check)"),
    # -- limits, said in the tile
    ("[redact] f_acro_qflat.pdf: acro_qflat:", "a comb field flattened by another program: its digits are drawn one a 20 pt cell, 1.1 em apart, and read as separate digits (by poppler too); Redact's search does not find them, and 'Not found' says to drag over letters set far apart (the reviewer's item 9: a limit)"),
    ("[fold] f_acro_qflat.pdf: a comb field flattened by another program", "the same limit"),
    ("[form] f_acro.pdf: a filled comb", "the same: a comb flattened, then searched (the reviewer's note: a limit, not a regression)"),
    # -- the oracle's own
    ("[fold] e_textops.pdf: Clifford finds", "the page draws 'Cli' + the fi ligature + 'ord' (its Differences name the code /fi): it says Clifiord, not Clifford"),
    ("[tile] x_intl.pdf: Redact (tile): Mark them all finds 'Şahin' in 1 places (a person sees 2)", "x_intl.pdf has the name once (ŞAHİN, in its page's one Turkish line); the reviewer's own redact and fold rows count 1"),
    ("[read] c_styles.pdf: p1: words as near poppler's", "poppler spells Chromium's letter-spaced capitals letter by letter ('P R I VAT E C A L D E R B A N K'); Lantern reads them as words (the reviewer's note)"),
]
env = dict(os.environ, R3EV=os.path.join(OUT, "evidence"), R3OUT=os.path.join(OUT, "work"), CJNAME=os.path.join(OUT, "cases.json"), PYTHONDONTWRITEBYTECODE="1")
os.makedirs(env["R3EV"], exist_ok=True); os.makedirs(env["R3OUT"], exist_ok=True)
r = subprocess.run([sys.executable, os.path.join(FX, "run_review.py"), SITE, OLD, "redact", "area", "read", "form", "tile", "misc", "fold"], cwd=FX, env=env, capture_output=True, text=True, timeout=7000)
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
print("ALL THIRD PDF TOOLS REVIEW 1.24.40 CHECKS PASS" if not fails else "THIRD PDF TOOLS REVIEW 1.24.40 FAILED")
sys.exit(1 if fails else 0)
