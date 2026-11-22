# check_saved.py -- what other programs make of the decks Lantern saved (the second review, 1.24.33):
#   python3 check_saved.py <folder of .pptx> <out.json> [png]
# For each deck: every XML part against the ISO/IEC 29500 schemas (lxml; the schemas of a pptx skill, or
# LANTERN_OOXML_XSD), python-pptx's reading (each slide's title, its shapes, its notes, autofit), and LibreOffice's
# (a PDF: its pages and their text, in order, with where each line sits; with "png", each page drawn as a PNG beside it).
# Writes {deck: {schema: [problems], pptx: {...} | error, lo: {pages, text: [[{t, x, y, size}]]} | null}}; a program
# that is missing is said in "missing".
import glob, json, os, re, shutil, subprocess, sys, tempfile, zipfile
folder, out = sys.argv[1], sys.argv[2]
want_png = len(sys.argv) > 3 and sys.argv[3] == "png"
res, missing = {}, []
decks = sorted(glob.glob(os.path.join(folder, "*.pptx")))
cands = [os.environ.get("LANTERN_OOXML_XSD") or ""] + glob.glob("/mnt/skills/public/*/scripts/office/schemas") + glob.glob(os.path.expanduser("~/.claude/skills/synced/*/*/scripts/office/schemas"))
XSD = next((c for c in cands if c and os.path.exists(os.path.join(c, "ISO-IEC29500-4_2016", "pml.xsd"))), None)
try:
    import lxml.etree as ET
except ImportError:
    ET = None
cache = {}
def schema(p):
    if p not in cache: cache[p] = ET.XMLSchema(ET.parse(p))
    return cache[p]
for f in decks:
    k = os.path.basename(f)[:-5]; r = res[k] = {}
    if ET is not None and XSD:
        ISO, OPC = os.path.join(XSD, "ISO-IEC29500-4_2016"), os.path.join(XSD, "ecma", "fouth-edition")
        bad = []
        z = zipfile.ZipFile(f)
        for n in z.namelist():
            if not re.search(r"\.(xml|rels)$", n) or n == "docProps/core.xml": continue
            root = ET.fromstring(z.read(n)); tag = ET.QName(root).localname
            p = (os.path.join(OPC, "opc-contentTypes.xsd") if n == "[Content_Types].xml" else os.path.join(OPC, "opc-relationships.xsd") if n.endswith(".rels")
                 else os.path.join(ISO, "shared-documentPropertiesExtended.xsd") if n == "docProps/app.xml" else os.path.join(ISO, "dml-main.xsd") if tag in ("theme", "tblStyleLst") else os.path.join(ISO, "pml.xsd"))
            s = schema(p)
            if not s.validate(ET.ElementTree(root)): bad.append("%s: %s" % (n, s.error_log.last_error.message[:240]))
        r["schema"] = bad
    elif "schemas" not in missing: missing.append("schemas")
    try:
        from pptx import Presentation
        pr = Presentation(f); sl = []
        for s in pr.slides:
            d = {"title": s.shapes.title.text if s.shapes.title is not None else None, "shapes": [], "notes": s.notes_slide.notes_text_frame.text if s.has_notes_slide else None}
            for sh in s.shapes:
                e = {"name": sh.name, "kind": str(sh.shape_type), "x": sh.left, "y": sh.top, "w": sh.width, "h": sh.height}
                if sh.has_text_frame: e["text"] = sh.text_frame.text
                if getattr(sh, "has_table", False) and sh.has_table: e["rows"] = [[c.text for c in row.cells] for row in sh.table.rows]
                sp = sh._element.find(".//{http://schemas.openxmlformats.org/drawingml/2006/main}normAutofit")
                if sp is not None and sp.get("fontScale"): e["fontScale"] = int(sp.get("fontScale"))
                d["shapes"].append(e)
            sl.append(d)
        r["pptx"] = {"slides": sl, "w": pr.slide_width, "h": pr.slide_height}
    except ImportError:
        if "python-pptx" not in missing: missing.append("python-pptx")
    except Exception as e:
        r["pptx"] = {"error": str(e)[:300]}
so = shutil.which("soffice") or shutil.which("libreoffice")
if so and decks:
    tmp = tempfile.mkdtemp(prefix="pptx_r2c_"); env = dict(os.environ, HOME=tmp)
    subprocess.run([so, "--headless", "--convert-to", "pdf", "--outdir", tmp] + decks, capture_output=True, timeout=600, env=env)
    for f in decks:
        k = os.path.basename(f)[:-5]; pdf = os.path.join(tmp, k + ".pdf")
        if not os.path.exists(pdf): res[k]["lo"] = None; continue
        pages = []
        if shutil.which("pdftotext"):
            x = subprocess.run(["pdftotext", "-enc", "UTF-8", "-bbox", pdf, "-"], capture_output=True).stdout.decode("utf-8", "replace")
            for pg in re.findall(r"<page[^>]*>(.*?)</page>", x, re.S):
                words = [{"t": m.group(5), "x": float(m.group(1)), "y": float(m.group(2)), "size": round(float(m.group(4)) - float(m.group(2)), 1)} for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', pg)]
                pages.append(words)
        lo = {"pages": len(re.findall(rb"/Type\s*/Page[^s]", open(pdf, "rb").read())), "text": pages}
        # each page's colours: its background (a corner) and the ink of its first word and of its last word (the
        # title and the text), as LibreOffice draws them
        if shutil.which("pdftoppm"):
            try:
                from PIL import Image
                pre = os.path.join(tmp, k + "_c")
                subprocess.run(["pdftoppm", "-png", "-r", "72", pdf, pre], capture_output=True)
                cols = []
                for i, words in enumerate(pages):
                    cands = sorted(glob.glob(pre + "-*.png"))
                    if i >= len(cands): break
                    im = Image.open(cands[i]).convert("RGB"); bg = im.getpixel((3, 3))
                    def ink(w):
                        best, bd = None, -1
                        for yy in range(int(w["y"]), int(w["y"] + w["size"])):
                            for xx in range(int(w["x"]), int(w["x"] + max(4, w["size"] * len(w["t"]) * 0.4))):
                                if 0 <= xx < im.width and 0 <= yy < im.height:
                                    c = im.getpixel((xx, yy)); dd = sum(abs(c[j] - bg[j]) for j in range(3))
                                    if dd > bd: best, bd = c, dd
                        return list(best) if best else None
                    cols.append({"bg": list(bg), "first": ink(words[0]) if words else None, "last": ink(words[-1]) if words else None})
                lo["colours"] = cols
            except ImportError:
                pass
        if want_png and shutil.which("pdftoppm"):
            subprocess.run(["pdftoppm", "-png", "-r", "40", pdf, os.path.join(folder, k)], capture_output=True)
        res[k]["lo"] = lo
    shutil.rmtree(tmp, ignore_errors=True)
elif not so:
    missing.append("LibreOffice")
json.dump({"decks": res, "missing": missing}, open(out, "w"), indent=1)
print("checked %d decks%s" % (len(decks), (", missing: " + ", ".join(missing)) if missing else ""))
