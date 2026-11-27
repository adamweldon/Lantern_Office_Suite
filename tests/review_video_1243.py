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
