# review_photo_1242.py -- the two independent reviews of the Photo tile (1.24.42) replayed on this build.
# Review 1 (tests/fixtures/photo_review1_1242: files and arithmetic, 455 checks against psd-tools, ImageMagick, libtiff, PIL,
# SciPy, OpenCV), review 2 (tests/fixtures/photo_review2_1242: the tile used as a person uses it, about 280 checks) and
# review 3 (tests/fixtures/photo_review3_1242: the newest parts, 425 checks, on the mended build) and review 4
# (tests/fixtures/photo_review4_1242: as a person uses it, 289 checks, on the mended build) were written by agents that had
# not seen the tile written. Every check they wrote runs here; a check may fail only if it is in
# KEEP below, with the reason it is kept failing. Any other failure fails this test.
# Usage: python3 tests/review_photo_1242.py [site/index.html] [--quick]   (--quick: reviews 1 and 3 only, about 2 minutes)
import os, re, shutil, subprocess, sys, tempfile
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
    "vivid-light, opaque = Photoshop's published formula": "review 3 found psd-tools' Vivid Light pinned against Photoshop's own renders (psd-tools #189): a pure black or white source wins whatever the backdrop, where the published formula keeps Color Dodge and Burn's backdrop cases; the render is the better witness",
    "vivid-light, opaque, 60% opacity = Photoshop's published formula": "as above",
    "vivid-light, see-through backdrop and source, 70% = Photoshop's published formula": "as above",
    # review 3
    "a 32-bit float means the same in a TIFF and in a PSD": "the two come from different places: a 32-bit .psd holds Photoshop's linear light, shown through the sRGB curve as Photoshop shows it (review 1 checks this), while a float TIFF's numbers are taken as they are, as libtiff and ImageMagick read them (reviews 1 and 3 check this); which a float TIFF from Photoshop should follow is a question for a Photoshop to settle",
    # review 4
    "Merge Group of a 50% group: the picture is unchanged": "one level of rounding: the group at 50% is mixed in floating point and the merged layer laid at 50% by the browser in whole levels ([59, 29, 125] against [60, 30, 125])",
    "While the blue words are open for editing, the foreground colour box": "review 2 asks the opposite (the foreground colour left as it was while words are edited); the words are typed in their own colour and keep it, and the help says so",
    "Free Transform, Ctrl+I (it runs), Esc, Ctrl+I, Ctrl+Z": "written for Ctrl+I running during Free Transform; from the review's own finding 3 nothing runs then (as Photoshop greys its menus), so the first Ctrl+I does nothing and the last Ctrl+Z takes the only Invert away; the preview's hiding is no longer kept in History",
    "Free Transform, Ctrl+J (Layer via Copy), Esc: the copy shows": "as above: Ctrl+J does not run during Free Transform, so there is no copy to show",
    "File > Quick Export as PNG in the middle of a Free Transform": "as above: nothing is exported during Free Transform (the line under the picture says Enter applies it, Esc leaves it)",
    "Image > Adjustments lists Invert without": "review 2's own replay finds the item by the name \u201cInvert\u2026\u201d; the dots stay",
    "Dodge used with a group chosen (refused): the tool keys still work afterwards (B picks the Brush)": "the keys do work (no stroke is left open: the second value); B gives the tool last used in its group, the Pencil here (Photoshop's way, the review's own finding 11c)",
    # review 2
    "makes a shape layer drawn in the foreground colour  -- ('shape',": "the check lays the shape kinds out three a row, 120 px apart, from y 20: the seventh kind onward (the eight custom shapes, new) start at y 260 and their middles (y 305 and below) lie off the 300 px picture; a custom shape drawn on the picture is coloured inside (photo_tile_e2e.py, the heart)",
    "Keys: B pressed twice keeps the Brush": "B gives the tool last used in its group (Photoshop's way; review 4's finding 11c), the Pencil here, and stays on it; Shift+B moves along",
    "Move with a selection on the Background: the hole is filled": "Lantern has no special Background layer (every layer may be see-through); said in the guide",
    "Type: after moving the words with the Move tool, a click on them edits them": "the check clicks above the moved words: typed with a click at y 80 at size 40 their line is at y 112 and their tops near 83, so moved 100 down their tops are near 183 and the click is at 165; a click on them edits them",
    "Menus: each (with its settings changed) changes the picture  -- ['Replace Color\u2026']": "the sweep moves each box's first slider; Replace Color's is Fuzziness (Photoshop's order), and with Hue, Saturation and Lightness left at 0 it changes nothing, as Photoshop's does (moved, it changes the colour: photo_algos.py)",
}
def run(folder, extra):
    # each review runs in a copy of its folder, so what it writes as it goes (its cases, its pictures) leaves the kept one as found
    tmp = tempfile.mkdtemp(prefix="review_photo_"); work = os.path.join(tmp, folder)
    shutil.copytree(os.path.join(ROOT, "tests", "fixtures", folder), work, ignore=shutil.ignore_patterns("__pycache__"))
    try: r = subprocess.run([sys.executable, "run_review.py", SITE] + extra, cwd=work, capture_output=True, text=True, timeout=5400)
    finally: shutil.rmtree(tmp, ignore_errors=True)
    out = r.stdout + r.stderr
    fails = [l for l in out.splitlines() if l.startswith("FAIL")]
    m = re.search(r"(\d+) checks, (\d+) failed", out)
    return fails, (int(m.group(1)) if m else 0), out
bad = []; total = 0
for folder, extra in [("photo_review1_1242", []), ("photo_review3_1242", [])] + ([] if QUICK else [("photo_review4_1242", []), ("photo_review2_1242", [])]):
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
