# pptx_lo.py -- PowerPoint files (1.24.33), the half that needs other programs. Decks saved by Lantern (the test deck of
# tests/pptx.js, each fixture read and saved again, a MAKE SLIDES deck), then
#   - every part checked against the ISO/IEC 29500 schemas (pml.xsd, dml-main.xsd, the package's own) where they are on
#     this machine (LANTERN_OOXML_XSD: the folder that holds ISO-IEC29500-4_2016 and ecma, or a skill's copy), with lxml;
#   - opened by python-pptx: as many slides, each title in its title box;
#   - opened by LibreOffice: a PDF with a page a slide; and saved again by it, then read back by Lantern: the same titles.
# What a machine lacks (LibreOffice, python-pptx, lxml, the schemas) is said as SKIP, not failed.
# Usage: python3 tests/pptx_lo.py [-v]
import glob, json, os, re, shutil, subprocess, sys, tempfile, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "pptx_1233")
VERBOSE = "-v" in sys.argv
cands = [os.environ.get("LANTERN_OOXML_XSD") or ""] + glob.glob("/mnt/skills/public/*/scripts/office/schemas") + glob.glob(os.path.expanduser("~/.claude/skills/synced/*/*/scripts/office/schemas"))
XSD = next((c for c in cands if c and os.path.exists(os.path.join(c, "ISO-IEC29500-4_2016", "pml.xsd"))), None)
tmp = tempfile.mkdtemp(prefix="pptx_lo_")
fails, passes, skips = 0, 0, set()
def ok(name, cond, info=""):
    global fails, passes
    if cond: passes += 1
    else:
        fails += 1; print("FAIL", name, str(info)[:700])
    if VERBOSE and cond: print("ok  ", name)
js = r"""
var fs = require("fs"), path = require("path");
var load = require(path.join(%(root)r, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
var o = load(path.join(%(root)r, "src", "lantern.inner.html")), L = o.L, P = L.pptx, TMP = %(tmp)r, FX = %(fx)r, out = {};
function u8(b) { var a = new o.w.Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b[i]; return a; }
function save(id, deck) { fs.writeFileSync(path.join(TMP, id + ".pptx"), Buffer.from(P.write(deck).bytes)); out[id] = deck.slides.length ? deck.slides.map(function (s) { return s.h; }) : [deck.title]; }
fs.readdirSync(FX).filter(function (f) { return /\.pptx$/.test(f); }).forEach(function (f) { save(f.replace(/\.pptx$/, ""), P.read(u8(fs.readFileSync(path.join(FX, f))), f)); });
var made = L.aiAct.build("MAKE SLIDES: Lockout\n# Lockout in three steps\nA two-minute talk.\n# 1. Isolate\n- Switch off the main breaker\n- Lock it and hang your tag\n# 2. Prove zero energy\n- Try the start button\nEND", "Make a presentation on lockout");
save("make_slides", { title: "Lockout", slides: made.plan.slides });
if (fs.existsSync(path.join(TMP, "test_deck.pptx"))) out.test_deck = P.read(u8(fs.readFileSync(path.join(TMP, "test_deck.pptx")))).slides.map(function (s) { return s.h; });
var back = {};
if (fs.existsSync(path.join(TMP, "lo"))) fs.readdirSync(path.join(TMP, "lo")).filter(function (f) { return /\.pptx$/.test(f); }).forEach(function (f) {
  try { back[f] = P.read(u8(fs.readFileSync(path.join(TMP, "lo", f))), f).slides.map(function (s) { return s.h; }); } catch (e) { back[f] = String(e.message); }
});
fs.writeFileSync(path.join(TMP, "out.json"), JSON.stringify({ titles: out, back: back, errs: o.errs }));
"""
def run_js():
    with open(os.path.join(tmp, "w.js"), "w") as f: f.write(js % {"root": ROOT, "tmp": tmp, "fx": FX})
    r = subprocess.run(["node", os.path.join(tmp, "w.js")], cwd=ROOT, capture_output=True, text=True, timeout=600)
    if r.returncode: print(r.stdout[-1500:], r.stderr[-1500:])
    return json.load(open(os.path.join(tmp, "out.json")))
subprocess.run(["node", os.path.join(ROOT, "tests", "pptx.js"), "--write-deck", os.path.join(tmp, "test_deck.pptx")], cwd=ROOT, capture_output=True, timeout=300)
res = run_js()
ok("Lantern wrote every deck without an error", not res["errs"] and os.path.exists(os.path.join(tmp, "test_deck.pptx")), res["errs"])
saved = sorted(glob.glob(os.path.join(tmp, "*.pptx")))
# the schemas
try:
    import lxml.etree as ET
except ImportError:
    ET = None; skips.add("lxml")
if ET is not None and XSD:
    ISO, OPC, cache = os.path.join(XSD, "ISO-IEC29500-4_2016"), os.path.join(XSD, "ecma", "fouth-edition"), {}
    def schema(p):
        if p not in cache: cache[p] = ET.XMLSchema(ET.parse(p))
        return cache[p]
    for f in saved:
        z = zipfile.ZipFile(f); bad = []
        for n in z.namelist():
            if not re.search(r"\.(xml|rels)$", n) or n == "docProps/core.xml": continue   # core.xml's schema needs the Dublin Core ones, not in the folder
            root = ET.fromstring(z.read(n)); tag = ET.QName(root).localname
            p = (os.path.join(OPC, "opc-contentTypes.xsd") if n == "[Content_Types].xml" else os.path.join(OPC, "opc-relationships.xsd") if n.endswith(".rels")
                 else os.path.join(ISO, "shared-documentPropertiesExtended.xsd") if n == "docProps/app.xml" else os.path.join(ISO, "dml-main.xsd") if tag in ("theme", "tblStyleLst") else os.path.join(ISO, "pml.xsd"))
            s = schema(p)
            if not s.validate(ET.ElementTree(root)): bad.append("%s: %s" % (n, s.error_log.last_error.message[:200]))
        ok("%s: every part valid against the ISO/IEC 29500 schemas" % os.path.basename(f), not bad, bad[:4])
else:
    skips.add("the OOXML schemas (set LANTERN_OOXML_XSD)" if ET is not None else "lxml")
# python-pptx
try:
    from pptx import Presentation
except ImportError:
    Presentation = None; skips.add("python-pptx")
if Presentation:
    for f in saved:
        id = os.path.basename(f)[:-5]
        if id not in res["titles"]: continue
        p = Presentation(f)
        titles = [(s.shapes.title.text if s.shapes.title is not None else None) for s in p.slides]
        ok("%s: python-pptx opens it, each slide's title in its title box" % id, titles == res["titles"][id], (titles, res["titles"][id]))
# LibreOffice
so = shutil.which("soffice") or shutil.which("libreoffice")
if so:
    os.makedirs(os.path.join(tmp, "pdf"), exist_ok=True); os.makedirs(os.path.join(tmp, "lo"), exist_ok=True)
    env = dict(os.environ, HOME=tmp)
    subprocess.run([so, "--headless", "--convert-to", "pdf", "--outdir", os.path.join(tmp, "pdf")] + saved, capture_output=True, timeout=600, env=env)
    subprocess.run([so, "--headless", "--convert-to", "pptx:Impress Office Open XML", "--outdir", os.path.join(tmp, "lo")] + saved, capture_output=True, timeout=600, env=env)
    for f in saved:
        id = os.path.basename(f)[:-5]
        if id not in res["titles"]: continue
        pdf = os.path.join(tmp, "pdf", id + ".pdf")
        pages = len(re.findall(rb"/Type\s*/Page[^s]", open(pdf, "rb").read())) if os.path.exists(pdf) else -1
        ok("%s: LibreOffice opens it, a page a slide" % id, pages == len(res["titles"][id]), (pages, len(res["titles"][id])))
    back = run_js()["back"]
    for id, titles in res["titles"].items():
        got = back.get(id + ".pptx")
        ok("%s: saved again by LibreOffice, Lantern reads the same titles" % id, got == [t if t else "" for t in titles], (got, titles))
else:
    skips.add("LibreOffice")
shutil.rmtree(tmp, ignore_errors=True)
for s in sorted(skips): print("SKIP", s)
print("%d checks, %d failed" % (passes + fails, fails))
print("ALL PPTX OTHER PROGRAMS CHECKS PASS" if not fails else "PPTX OTHER PROGRAMS CHECKS FAILED")
sys.exit(1 if fails else 0)
