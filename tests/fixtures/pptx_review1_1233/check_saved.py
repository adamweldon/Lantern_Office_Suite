# check_saved.py <dir> [--lo] -- each .pptx in <dir>, as review 1 of 1.24.33 checks a deck Lantern saved:
#   every XML part against the ISO/IEC 29500 schemas (where they are on this machine), python-pptx's titles and
#   whether each slide's title box is there, and (with --lo) LibreOffice's PDF of it: the number of pages.
# Prints one JSON object {file: {schema: [errors] | null, titles: [..] | null, pages: n | null, why: ".."}}.
import glob, json, os, re, shutil, subprocess, sys, tempfile, zipfile
D = sys.argv[1]; LO = "--lo" in sys.argv
cands = [os.environ.get("LANTERN_OOXML_XSD") or ""] + glob.glob("/mnt/skills/public/*/scripts/office/schemas") + glob.glob(os.path.expanduser("~/.claude/skills/synced/*/*/scripts/office/schemas"))
XSD = next((c for c in cands if c and os.path.exists(os.path.join(c, "ISO-IEC29500-4_2016", "pml.xsd"))), None)
try:
    import lxml.etree as ET
except ImportError:
    ET = None
try:
    from pptx import Presentation
except ImportError:
    Presentation = None
res = {}
files = sorted(glob.glob(os.path.join(D, "*.pptx")))
cache = {}
def schema(p):
    if p not in cache: cache[p] = ET.XMLSchema(ET.parse(p))
    return cache[p]
for f in files:
    r = res[os.path.basename(f)] = {"schema": None, "titles": None, "pages": None}
    if ET is not None and XSD:
        ISO, OPC = os.path.join(XSD, "ISO-IEC29500-4_2016"), os.path.join(XSD, "ecma", "fouth-edition")
        z = zipfile.ZipFile(f); bad = []
        for n in z.namelist():
            if not re.search(r"\.(xml|rels)$", n) or n == "docProps/core.xml": continue
            try: root = ET.fromstring(z.read(n))
            except Exception as e: bad.append("%s: not XML: %s" % (n, str(e)[:120])); continue
            tag = ET.QName(root).localname
            p = (os.path.join(OPC, "opc-contentTypes.xsd") if n == "[Content_Types].xml" else os.path.join(OPC, "opc-relationships.xsd") if n.endswith(".rels")
                 else os.path.join(ISO, "shared-documentPropertiesExtended.xsd") if n == "docProps/app.xml" else os.path.join(ISO, "dml-main.xsd") if tag in ("theme", "tblStyleLst") else os.path.join(ISO, "pml.xsd"))
            s = schema(p)
            if not s.validate(ET.ElementTree(root)): bad.append("%s: %s" % (n, s.error_log.last_error.message[:200]))
        r["schema"] = bad
    if Presentation:
        try:
            p = Presentation(f)
            r["titles"] = [(s.shapes.title.text if s.shapes.title is not None else None) for s in p.slides]
        except Exception as e:
            r["titles"] = "python-pptx could not open it: " + str(e)[:200]
so = shutil.which("soffice") or shutil.which("libreoffice")
if LO and so and files:
    t = tempfile.mkdtemp()
    subprocess.run([so, "--headless", "--convert-to", "pdf", "--outdir", t] + files, capture_output=True, timeout=1200, env=dict(os.environ, HOME=t))
    for f in files:
        pdf = os.path.join(t, os.path.basename(f)[:-5] + ".pdf")
        res[os.path.basename(f)]["pages"] = len(re.findall(rb"/Type\s*/Page[^s]", open(pdf, "rb").read())) if os.path.exists(pdf) else 0
        if os.environ.get("KEEP_PDF"): shutil.copy(pdf, os.path.join(os.environ["KEEP_PDF"], os.path.basename(pdf))) if os.path.exists(pdf) else None
    shutil.rmtree(t, ignore_errors=True)
print(json.dumps({"have": {"schemas": bool(ET is not None and XSD), "pptx": bool(Presentation), "lo": bool(LO and so)}, "files": res}))
