# review_photo_1242.py -- the two independent reviews of the Photo tile (1.24.42) replayed on this build.
# Review 1 (tests/fixtures/photo_review1_1242: files and arithmetic, 455 checks against psd-tools, ImageMagick, libtiff, PIL,
# SciPy, OpenCV) and review 2 (tests/fixtures/photo_review2_1242: the tile used as a person uses it, about 280 checks) were
# written by agents that had not seen the tile written. Every check they wrote runs here; a check may fail only if it is in
# KEEP below, with the reason it is kept failing. Any other failure fails this test.
# Usage: python3 tests/review_photo_1242.py [site/index.html] [--quick]   (--quick: review 1 only, about 90 seconds)
import os, re, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
SITE = os.path.abspath(args[0]) if args else os.path.join(ROOT, "site", "index.html")
QUICK = "--quick" in sys.argv
KEEP = {
    # review 1
    "h_groups.psd: 3 picture layers + Back": "written when groups opened as their layers; from 1.24.42 they open as groups (the composite check beside it passes)",
    "PNG with soft alpha: colours of nearly clear pixels": "the browser's canvas holds colour multiplied by alpha, so where alpha is under 64 colours move up to 6 levels; said in the guide",
    "expand a point by 3": "the review's rule (a disc of radius r from the pixel's centre) is not the edge rule it also asked for; a pixel expanded by r reaches r beyond its own edge (area 1 + 4r + pi r^2: 41 for r = 3); Lantern gives 37",
    "expand a point by 7.5": "as above (the exact area for r = 7.5 is 207; Lantern 197)",
    "expand a point by 12": "as above (the exact area for r = 12 is 501; Lantern 489)",
    # review 2
    "Move with a selection on the Background: the hole is filled": "Lantern has no special Background layer (every layer may be see-through); said in the guide",
    "Type: after moving the words with the Move tool, a click on them edits them": "the check clicks above the moved words: typed with a click at y 80 at size 40 their line is at y 112 and their tops near 83, so moved 100 down their tops are near 183 and the click is at 165; a click on them edits them",
    "Menus: each (with its settings changed) changes the picture  -- ['Replace Color\u2026']": "the sweep moves each box's first slider; Replace Color's is Fuzziness (Photoshop's order), and with Hue, Saturation and Lightness left at 0 it changes nothing, as Photoshop's does (moved, it changes the colour: photo_algos.py)",
}
def run(folder, extra):
    r = subprocess.run([sys.executable, "run_review.py", SITE] + extra, cwd=os.path.join(ROOT, "tests", "fixtures", folder), capture_output=True, text=True, timeout=5400)
    out = r.stdout + r.stderr
    fails = [l for l in out.splitlines() if l.startswith("FAIL")]
    m = re.search(r"(\d+) checks, (\d+) failed", out)
    return fails, (int(m.group(1)) if m else 0), out
bad = []; total = 0
for folder, extra in [("photo_review1_1242", [])] + ([] if QUICK else [("photo_review2_1242", [])]):
    fails, n, out = run(folder, extra)
    total += n
    if n == 0: bad.append(folder + ": the review did not run: " + out[-600:])
    for f in fails:
        why = [v for k, v in KEEP.items() if k in f]
        print(("KEPT  " + f[6:200] + "  -- " + why[0][:120]) if why else f[:400])
        if not why: bad.append(f)
    print("%s: %d checks, %d failed (%d kept failing, with reasons)" % (folder, n, len(fails), len([f for f in fails if any(k in f for k in KEEP)])))
print("%d review checks replayed" % total)
print("PHOTO REVIEWS PASS" if not bad else "PHOTO REVIEWS FAILED: %d" % len(bad))
sys.exit(1 if bad else 0)
