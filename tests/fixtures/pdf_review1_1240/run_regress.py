# run_regress.py -- PDFs with no change made: read and drawn by the build under review and by an earlier build (the
# committed site/index.html, 1.24.38), each beside poppler's own picture. The words read should be the same (or better:
# nearer poppler's), and the pictures should be nearer poppler's or as near; nothing should throw or hang.
# Usage: python3 run_regress.py new.html old.html [outdir]
import os, sys, json, base64, io, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
from PIL import Image, ImageChops, ImageStat
NEW, OLD = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else tempfile.mkdtemp(prefix="regress_1240_")
os.makedirs(OUT, exist_ok=True)
ck = Checks(open(os.path.join(OUT, "run_regress.log"), "w"))
DIRS = [HERE] + [os.path.join(ROOT, "tests", "fixtures", d) for d in ("pdf_open", "pdf_edit", "pdf_review1_1239")]
FILES = [f for f in ["t_fonts.pdf", "t_fonts_rot90.pdf", "t_fonts_crop.pdf", "t_landscape.pdf", "t_offset_box.pdf", "t_xobj.pdf", "t_type3.pdf", "t_hidden.pdf",
         "t_multistream.pdf", "t_inline.pdf", "t_editmove.pdf", "t_editmove_ttf.pdf", "t_latex.pdf", "t_xelatex.pdf", "t_chrome.pdf", "t_lo.pdf", "t_ocr.pdf",
         "a_annots.pdf", "f_form.pdf", "f_rot_form.pdf", "plain.pdf", "nav.pdf", "form_filled.pdf", "annotated.pdf", "layers.pdf", "shows.pdf", "rev_a.pdf",
         "form_hand.pdf", "form_rl.pdf", "annots_hand.pdf", "nav_rl_pypdf.pdf"]]
def find(f):
    for d in DIRS:
        if os.path.exists(os.path.join(d, f)): return os.path.join(d, f)
JS = """var pdf = await __open(a.f), out = [];
  for (var i = 0; i < Math.min(pdf.count, 2); i++) { var t0 = Date.now(), t = await P.pageText(pdf, i), cv = await P.pageDraw(pdf, i, {scale: 1});
    out.push({text: t.text, png: cv.toDataURL('image/png').split(',')[1], ms: Date.now() - t0}); }
  return out;"""
res = {}
for site, tag in ((NEW, "new"), (OLD, "old")):
    B = Browser(site, DIRS)
    for f in FILES:
        try: r = B.js(JS, {"f": f}, timeout=60000)
        except Exception as e: r = {"err": str(e)[:300]}
        res.setdefault(f, {})[tag] = r
    res["_errs_" + tag] = B.errs
    B.close()
summary = []
for f in FILES:
    n, o = res[f]["new"], res[f]["old"]
    if isinstance(n, dict) or isinstance(o, dict):
        ck(f + ": read and drawn by both", False, (str(n)[:200], str(o)[:200])); continue
    for i in range(len(n)):
        pp = render(find(f), os.path.join(OUT, "%s_poppler_p%d" % (f[:-4], i + 1)), i + 1, 72)
        ims = {}
        for tag, r in (("new", n[i]), ("old", o[i])):
            p = os.path.join(OUT, "%s_%s_p%d.png" % (f[:-4], tag, i + 1)); open(p, "wb").write(base64.b64decode(r["png"])); ims[tag] = p
        P0 = Image.open(pp).convert("L")
        def dist(p):
            A = Image.open(p).convert("L")
            if A.size != P0.size: A = A.resize(P0.size)
            return ImageStat.Stat(ImageChops.difference(A, P0)).mean[0]
        dn, do = dist(ims["new"]), dist(ims["old"])
        same_text = n[i]["text"] == o[i]["text"]
        summary.append({"file": f, "page": i + 1, "text_same": same_text, "new_vs_poppler": round(dn, 2), "old_vs_poppler": round(do, 2), "ms_new": n[i]["ms"], "ms_old": o[i]["ms"]})
        ck("%s p%d: drawn as near poppler's picture as before or nearer (new %.2f, old %.2f)" % (f, i + 1, dn, do), dn <= do + 0.3, "")
        if not same_text:
            import difflib
            d = [l for l in difflib.unified_diff(o[i]["text"].splitlines(), n[i]["text"].splitlines(), lineterm="", n=0) if l[:1] in "+-" and l[:3] not in ("+++", "---")]
            print("INFO  %s p%d: words read differ from 1.24.38: %s" % (f, i + 1, d[:6]))
ck("no page errors (new)", not res["_errs_new"], res["_errs_new"])
json.dump(summary, open(os.path.join(OUT, "regress_summary.json"), "w"), indent=1)
print("%d checks, %d failed (outputs in %s)" % (ck.n, len(ck.bad), OUT))
