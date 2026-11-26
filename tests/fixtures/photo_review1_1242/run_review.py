# run_review.py -- an independent review of the Photo tile (1.24.42): files and arithmetic.
# Usage: python3 run_review.py [path/to/index.html] [--only psd,tiff,...] [--json cases.json]
# Each check prints "PASS  ..." or "FAIL  ..."; the last line is "N checks, M failed".
# Inputs are made by PIL, numpy, psd-tools, ImageMagick, libtiff tools and by hand from published specifications
# (never by Lantern); the small ones are kept in inputs/, the big ones are made at run time.
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from review_core import *
from playwright.sync_api import sync_playwright

SECTIONS = ["psd", "tiff", "export", "adjust", "filter", "blend", "select", "inpaint"]

def main():
    args = sys.argv[1:]
    build = DEFAULT_BUILD; only = None; jout = None
    i = 0
    while i < len(args):
        if args[i] == "--only": only = args[i + 1].split(","); i += 2; continue
        if args[i] == "--json": jout = args[i + 1]; i += 2; continue
        build = args[i]; i += 1
    B = Book(); t0 = time.time()
    with sync_playwright() as pw:
        pg = Page(pw, build)
        for s in SECTIONS:
            if only and s not in only: continue
            mod = __import__("sec_" + s)
            try:
                mod.run(pg, B)
            except Exception as e:
                import traceback; traceback.print_exc()
                B.check(s, "the section ran to its end", False, repr(e)[:300], "no exception")
        if pg.errors: B.info("page", "errors in the page", pg.errors[:5])
    n = len([r for r in B.rows if r["pass"] is not None]); m = len([r for r in B.rows if r["pass"] is False])
    if jout:
        with open(jout if os.path.isabs(jout) else os.path.join(HERE, jout), "w") as f:
            json.dump({"build": build, "seconds": round(time.time() - t0), "checks": n, "failed": m, "rows": B.rows}, f, indent=1, ensure_ascii=False)
    print("%d checks, %d failed" % (n, m))

if __name__ == "__main__":
    main()
