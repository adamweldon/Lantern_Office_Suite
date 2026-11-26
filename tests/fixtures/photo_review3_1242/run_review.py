# run_review.py -- an independent review of the Photo tile's newest parts (Lantern 1.24.42): layer groups, the PSD
# reader and writer (16/32-bit, Lr16/Lr32, ZIP prediction, merged picture, Mac Roman names, Curves, Selective Color),
# TIFF predictors, resolution in PNG/JPEG/BMP, the new adjustments, blend modes, Expand/Contract/Border, layer styles.
# Usage: python3 run_review.py [path/to/index.html] [section ...] [--json cases.json]
#   sections: groups psd tiff dpi adjust blend select fx   (all when none is named)
# Prints one "PASS  ..." or "FAIL  ..." line a check and ends with "N checks, M failed".
# Judged only against independent programs (psd-tools 1.27, PIL, tifffile, ImageMagick/libtiff, scipy, numpy) and
# published rules (Adobe's Photoshop File Format Specification, TIFF 6.0 and Adobe's TIFF Technical Note 3, the PNG and
# JFIF specifications, W3C Compositing and Blending Level 1), never against the code's own comments.
import os, sys, json, time, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import *
from playwright.sync_api import sync_playwright

SECTIONS = ["groups", "psd", "tiff", "dpi", "adjust", "blend", "select", "fx"]


def main():
    args = sys.argv[1:]
    build = DEFAULT_BUILD; only = []; jout = None; i = 0
    while i < len(args):
        a = args[i]
        if a == "--json":
            jout = args[i + 1]; i += 2; continue
        if a in SECTIONS:
            only.append(a)
        else:
            build = a
        i += 1
    B = Book(); t0 = time.time()
    with sync_playwright() as pw:
        pg = Page(pw, build)
        B.info("page", "build", "%s (Lantern.version %s)" % (build, pg.version))
        for s in SECTIONS:
            if only and s not in only:
                continue
            mod = __import__("sec_" + s)
            try:
                mod.run(pg, B)
            except Exception as e:
                traceback.print_exc()
                B.check(s, "the section ran to its end", False, repr(e)[:400], "no exception in the review itself")
        if pg.errors:
            B.info("page", "errors in the page", pg.errors[:8])
        pg.close()
    n = len([r for r in B.rows if r["pass"] is not None]); m = len([r for r in B.rows if r["pass"] is False])
    if jout:
        with open(jout if os.path.isabs(jout) else os.path.join(HERE, jout), "w") as f:
            json.dump({"build": build, "seconds": round(time.time() - t0), "checks": n, "failed": m, "rows": B.rows}, f, indent=1, ensure_ascii=False)
    print("%d checks, %d failed" % (n, m))


if __name__ == "__main__":
    main()
