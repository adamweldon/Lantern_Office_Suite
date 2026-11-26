# confirm.py -- confirms two causes named in REPORT.txt by drawing with COPIES of src/lantern.inner.html changed in one
# place each (written to a temporary folder; src itself is never touched):
#   A. PDF_DRAW blends(): each resource dictionary visited once (a list of those seen) -> LibreOffice pages draw in ~30 ms
#      again, pixel for pixel the same (finding 1);
#   B. PDF_DRAW type1(): the flex end point handed back as [x, y] instead of [y, x] -> pdfTeX's Computer Modern letters
#      drawn whole (finding 9, pre-existing).
#   python3 confirm.py
import os, sys, tempfile, base64, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness
src = open(os.path.join(harness.ROOT, "src", "lantern.inner.html")).read()
tmp = tempfile.mkdtemp()
A0 = '''    function blends(res, depth) {
      res = R(res);
      if (!res || typeof res !== "object" || depth > 3) return false;'''
A1 = '''    var seenRes = [];
    function blends(res, depth) {
      res = R(res);
      if (!res || typeof res !== "object" || depth > 3 || seenRes.indexOf(res) >= 0) return false;
      seenRes.push(res);'''
B0 = "                ps = [y, x];\n"; B1 = "                ps = [x, y];\n"
assert src.count(A0) == 1 and src.count(B0) == 1
open(os.path.join(tmp, "a.html"), "w").write(src.replace(A0, A1))
open(os.path.join(tmp, "b.html"), "w").write(src.replace(B0, B1))
for label, page in [("1.24.39 as it is", None), ("A: blends() visits each resource once", os.path.join(tmp, "a.html"))]:
    if page: harness.PAGES["new"] = page
    B = harness.Browser(("new",))
    for f in ["lo_transp_60.pdf", "lo_transp_90.pdf"]:
        r = B.probe(f, text=False, timeout=300000); print(label, f, "%d ms" % r["draw"]["0"]["ms"], r["draw"]["0"]["hash"])
    B.close()
RG = [[150, 703, 215, 716], [240, 703, 330, 716], [346, 703, 454, 716]]
for label, page in [("1.24.39 as it is", os.path.join(harness.ROOT, "src", "lantern.inner.html")), ("B: flex end point [x, y]", os.path.join(tmp, "b.html"))]:
    harness.PAGES["new"] = page
    B = harness.Browser(("new",))
    r = B.probe("ord_pdftex_ocgx2.pdf", regions={0: RG}, text=False)
    print(label, "ord_pdftex_ocgx2.pdf ink (before / hidden layer / after):", [x["dark"] for x in r["draw"]["0"]["regions"]], "(poppler 5.3 / 0 / 4.2)")
    B.close()
