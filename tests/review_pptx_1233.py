# review_pptx_1233.py -- the first review of 1.24.33 (PowerPoint files in Slides), replayed. An agent that had not seen the
# reader and writer written made 301 cases of its own (tests/fixtures/pptx_review1_1233/, findings.txt): 41 decks read
# (PowerPoint's layouts, tables, charts, pictures, reading order, text, notes, PowerPoint's own parts, Google Slides',
# Keynote's and LibreOffice's files, Strict, 4:3, sixty slides, damaged and wrong files), 49 decks saved (each checked
# against the schemas, in python-pptx and LibreOffice, read back, and judged as PowerPoint would show it), and Open
# .pptx, Save .pptx and Chat's Save .pptx. On the first draft 263 agreed (5 high: boxes side by side and a comparison's
# columns read across; too much text saved at a size PowerPoint draws off the slide, unsaid). After the mending every
# case agrees but these, each kept for the reason given.
# Usage: python3 tests/review_pptx_1233.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pptx_review1_1233")
THEME = (" -- the case reads Light 1 as the background and Dark 1 as the text, as a light theme maps them; Lantern now keeps "
         "Dark 1 dark and maps a dark deck's background to it (clrMap bg1=dk1), as the review's own w-theme-dark-scheme asks. "
         "tests/pptx.js reads each theme through the colour map: the background is the deck's, text 4.5:1, titles and links 3:1.")
KEEP = {
    "d07-group": "A box beside the lower of two boxes (a group's), its top 0.4 in above that box's: read after the column it stands "
                 "beside -- top, bottom, then it -- which is the order PowerPoint keeps them in (the file's, a screen reader's). "
                 "The case reads by tops alone; a column's boxes stay together for the comparison and before-and-after cases.",
    "w-notes-blank-back": "Two cases share this name: the review's own w-notes-blank-back (the blank line kept, as d09-blank-line asks) "
                          "agrees; the general read-back check of the same deck drops blank lines from what it expects. ONLY below.",
    "w-table-in-li-order": "A table inside a list item is saved under the slide's text, not between its points: a slide's text box "
                           "holds paragraphs, and a table is a frame of its own. Low, as the review says.",
    "w-theme-night-readable": "Night" + THEME,
    "w-theme-chalkboard-readable": "Chalkboard" + THEME,
    "w-theme-ocean-readable": "Ocean" + THEME,
    "w-theme-sunset-readable": "Sunset" + THEME,
}
ONLY = {"w-notes-blank-back": r"slide 1 notes \"Line one\\nLine two\\n\\nAfter a blank line\" \[medium\]"}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(FX, "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=1200)
out = r.stdout
if VERBOSE: print(out)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) != 301: fails.append("%s cases, not 301" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    for c, pat in ONLY.items():
        for d in re.findall(r"^DISAGREE\s+" + re.escape(c) + r"\s+(.*)$", out, re.M):
            if not re.fullmatch(pat, d.strip()): fails.append("%s kept only for %s, but: %s" % (c, pat, d.strip()[:300]))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL PPTX REVIEW 1.24.33 CHECKS PASS" if not fails else "PPTX REVIEW 1.24.33 FAILED")
sys.exit(1 if fails else 0)
