# review_video_1243.py -- the independent reviews of the Video tile (1.24.43) replayed on this build.
# Review 1 (tests/fixtures/video_review1_1243: files and arithmetic, against ffprobe and ffmpeg, NumPy and SciPy, and the
# standards' own formulas) and review 2 (tests/fixtures/video_review2_1243: the tile used as a person uses it, in Chromium,
# by mouse and keys, its exported files decoded by ffmpeg) were written by agents that had not seen the tile written.
# Every check they wrote runs here; a check may fail only if it is in KEEP below, with the reason it is kept failing.
# Any other failure fails this test.
# The second round, on the mended build: review 3 (tests/fixtures/video_review3_1243: the newest parts' arithmetic, Time
# Remapping, Maintain Audio Pitch, masks, Warp Stabilizer, a fuzz of every edit, EDL and XML read by OpenTimelineIO) and
# review 4 (tests/fixtures/video_review4_1243: the tile as a person uses it again, in Chromium), by two more agents.
# Usage: python3 tests/review_video_1243.py [site/index.html] [--quick]   (--quick: reviews 1 and 3, no browser)
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
    # review 3
    "Maintain Audio Pitch keeps the level of white noise at 133%": "white noise comes out 1.1 dB under the part of the source played (ffmpeg's atempo 0.5 dB under): windows of noise do not line up, so where two overlap their power adds, not their amplitude; tones and speech keep their level (the chord and the beeps in tests/video_algos.py)",
    "channels as ffmpeg's '4.0' WAV": "the review's harness gives the mixer the WAV's samples without its channel mask (sound(p, 'm1', rate, data)); Lantern's WAV reader now returns the mask and the mixer folds by it as ffmpeg does (tests/video_algos.py: 4.0, 2.1 and 5.1(side) within 1e-4 of ffmpeg -ac 2)",
    "channels as ffmpeg's '2.1' WAV": "as the 4.0 above: the harness leaves out the mask that Lantern's reader now gives the mixer",
    "keyed Lowpass: half way between the keys": "a judgement, as the review says: a keyed filter is worked out at each key's settings and the two results mixed between the keys, so a filter's state is never broken mid-sound; a true sweep of the setting is in the queue",
    "fuzz, a plain trim of either edge (partners trimmed by what the clip got": "the fuzz copies the Timeline's way before this review (each partner trimmed by what the clip got); the Timeline now calls E.trimLinked, which tries each clip on a copy and trims all by the least: 6,000 such edits in tests/video_algos.py, on tracks whose neighbours differ, part none",
    "fuzz, a rolling edit (every linked pair rolled by the least)": "as the plain trim: the fuzz copies the old Timeline; the Timeline now calls E.rollLinked (a partner beside a gap trimmed, the linked clips of the clips beside the cuts trimmed with them): 6,000 such edits in tests/video_algos.py part none",
    "fuzz, a slide (gaps beside it allowed)": "as the plain trim: the fuzz copies the old Timeline; the Timeline now calls E.slideLinked (the linked clips of the clips beside it trimmed as those are): 6,000 such edits in tests/video_algos.py part none",
    "fuzz: linked clips are never parted by an edit that a sync-locked track cannot take": "a judgement, as the review says: a ripple that a sync-locked track cannot take leaves that track as it is and says so (review 1 asked for that); Q and W now take the same frames out of such a track, as Adobe's trimming page says",
    # review 4
    "a dissolve's Duration typed as 300 frames between clips of 180 and 120": "held to 240, twice the shorter clip, so a centred dissolve lies within both clips; frame 60, where it begins, is the first clip alone (28 76 80, as the check asks); the check's 120 is the review's own reading, and Premiere's limit (by the media beyond each cut) was not tried",
    "Ripple Delete of the clip before a dissolve: the clip left starts at 0 at full strength": "the dissolve is gone: frames 0 to 40 all show the clip alike, (85, 40, 80) as this browser decodes the file's 80 32 80; the check allows 8 levels and the green is 8 off",
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
for folder, extra in [("video_review1_1243", []), ("video_review3_1243", [])] + ([] if QUICK else [("video_review2_1243", [SITE]), ("video_review4_1243", [SITE])]):
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
