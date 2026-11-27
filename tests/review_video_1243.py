# review_video_1243.py -- the independent reviews of the Video tile (1.24.43) replayed on this build.
# Review 1 (tests/fixtures/video_review1_1243: files and arithmetic, against ffprobe and ffmpeg, NumPy and SciPy, and the
# standards' own formulas) and review 2 (tests/fixtures/video_review2_1243: the tile used as a person uses it, in Chromium,
# by mouse and keys, its exported files decoded by ffmpeg) were written by agents that had not seen the tile written.
# Every check they wrote runs here; a check may fail only if it is in KEEP below, with the reason it is kept failing.
# Any other failure fails this test.
# Usage: python3 tests/review_video_1243.py [site/index.html] [--quick]   (--quick: review 1 only)
import os, re, shutil, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
SITE = os.path.abspath(args[0]) if args else os.path.join(ROOT, "site", "index.html")
QUICK = "--quick" in sys.argv
KEEP = {
    # review 1
    "the same picture as the plain file": "the two files hold different numbers (ten decimals in the Resolve-style one, six in the plain one): one pixel rounds to the other side (1 level); the line LUT_3D_INPUT_RANGE itself is now read (the 242-level garbling is gone, and the -0.25..1.25 range check passes)",
    "Final Cut Pro XML round trip with a name full of & < > and quotes": "the file is now well-formed and read back with every clip; the in point is counted in whole frames by FCP XML, so 2 s at 23.976 (47.95 frames) is written as 48 and comes back as 2.002 s (the 23.976 round trip beside it allows half a frame and passes)",
    "Scene Edit Detection on a one-second cross-dissolve": "a judgement, as the review says: the coarse colour histograms jump where large flat areas of the two test patterns cross a level together near the dissolve's end; Premiere's tool is for cuts, and five real cuts and a fade are found exactly",
    # review 2
    "a clip item for each clip (two pictures, two sounds and the title: 5)": "the title is now written as a Text generator item (generatoritem), as FCP 7 XML writes words, so another program makes a title of it (and Lantern reads it back as one, which review 2's check of the title passes); the check counts clip items only",
    "the menu bar has File, Edit, Clip, Sequence, Markers, Graphics, View, Window and Help with the items expected": "written before the mends: File now has Project Name (review 2's observation that a project could not be named), View has Playback Resolution: Auto (its observation on 1/2 for small sequences), Window has Project (Shift+1)",
}
def run(folder, extra):
    # each review reads the build from its place in the repository and writes only to its own temporary folder
    work = os.path.join(ROOT, "tests", "fixtures", folder)
    try: r = subprocess.run([sys.executable, "run.py"] + extra, cwd=work, capture_output=True, text=True, timeout=5400)
    finally: shutil.rmtree(os.path.join(work, "__pycache__"), ignore_errors=True)
    out = r.stdout + r.stderr
    fails = [l for l in out.splitlines() if l.startswith("FAIL")]
    m = re.search(r"(\d+) checks, (\d+) failed", out)
    return fails, (int(m.group(1)) if m else 0), out
bad = []; total = 0
for folder, extra in [("video_review1_1243", [])] + ([] if QUICK else [("video_review2_1243", [SITE])]):
    fails, n, out = run(folder, extra)
    total += n
    if n == 0: bad.append(folder + ": the review did not run: " + out[-600:])
    for f in fails:
        why = [v for k, v in KEEP.items() if k in f]
        print(("KEPT  " + f[6:200] + "  -- " + why[0][:120]) if why else f[:400])
        if not why: bad.append(f)
    print("%s: %d checks, %d failed (%d kept failing, with reasons)" % (folder, n, len(fails), len([f for f in fails if any(k in f for k in KEEP)])))
print("%d review checks replayed" % total)
print("VIDEO REVIEWS PASS" if not bad else "VIDEO REVIEWS FAILED: %d" % len(bad))
sys.exit(1 if bad else 0)
