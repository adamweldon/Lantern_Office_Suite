# review_docx_1266_lo.py -- the first review of Word files (1.24.26), the half that needs other programs: every Writer
# document of the review (tests/fixtures/review_docx_1266.json, "write") saved by Lantern, then
#   - checked against the OOXML schema (ISO/IEC 29500) where the validator is on this machine,
#   - opened in LibreOffice (as text and as HTML) and looked for what the review says must be there or not,
#   - read by python-docx for its styles, tables and highlighted words.
# What a machine lacks (LibreOffice, python-docx, the validator) is said as SKIP, not failed.
# --second: the second review (tests/fixtures/review2_docx_1266.json) instead.
# Usage: python3 tests/review_docx_1266_lo.py [-v] [--second]
import json, os, re, shutil, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECOND = "--second" in sys.argv
FIX = os.path.join(ROOT, "tests", "fixtures", "review2_docx_1266.json" if SECOND else "review_docx_1266.json")
R = json.load(open(FIX, encoding="utf-8"))
VERBOSE = "-v" in sys.argv
VALIDATOR = "/mnt/skills/public/docx/scripts/office/validate.py"
# left as they are, with the reason (the same as tests/review_docx_1266.js)
KEEP = {
} if SECOND else {
    "hand-link-odd": "Word's bookmark names hold letters, digits and _ only: #section-2 is written as #section_2, with its bookmark",
}
# (1.24.27) a list in a list is 1. a. i. on Writer's page, as in Word and Google Docs (Adam, 2026-11-19): the first
# review's three cases kept for showing it 1, 2, 3 agree now. This case of the second expected 1., 2. "as the page is
# today", and said Word's a., b. would be right "if Writer's page is made to show nested lists the same way": it is.
NOW = {"hand2-ol-in-ul": {"lo_text_contains": ["a. Wrench", "b. Socket"], "lo_text_not_contains": ["1. Wrench"]}} if SECOND else {}
tmp = tempfile.mkdtemp(prefix="docx_review_")
cases = [c for c in R["write"]]
# Lantern writes every case, in node
js = r"""
var fs = require("fs"), path = require("path"), JSDOM = require("jsdom").JSDOM;
var inner = fs.readFileSync(path.join(%(root)r, "src", "lantern.inner.html"), "utf8"), js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true });
var w = dom.window; w.alert = function () {}; w.scrollTo = function () {}; w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; }; w.fetch = function () { return Promise.reject(new Error("offline")); };
w.eval(js);
var cases = JSON.parse(fs.readFileSync(%(json)r, "utf8")).write;
cases.forEach(function (c) { try { fs.writeFileSync(path.join(%(tmp)r, c.id + ".docx"), Buffer.from(w.Lantern.docx.write(c.title || c.id, c.html, c.paper || null).bytes)); } catch (e) { console.error(c.id + ": " + e.message); } });
console.log(cases.length);
""" % {"root": ROOT, "json": FIX, "tmp": tmp}
open(os.path.join(tmp, "w.js"), "w").write(js)
subprocess.run(["node", os.path.join(tmp, "w.js")], cwd=ROOT, check=True, capture_output=True, env=dict(os.environ, NODE_PATH=os.path.join(ROOT, "node_modules")))
fails, passes, kept, skips = 0, 0, [], set()
def result(cid, bad):
    global fails, passes
    if not bad: passes += 1; return
    if cid in KEEP: kept.append(cid); return
    fails += 1
    print("FAIL  write %s: %s" % (cid, "; ".join(bad)[:700]))
soffice = shutil.which("soffice")
if soffice:
    files = [os.path.join(tmp, c["id"] + ".docx") for c in cases]
    for fmt, ext in (("txt:Text (encoded):UTF8", "txt"), ("html", "html")):
        os.makedirs(os.path.join(tmp, ext), exist_ok=True)
        subprocess.run([soffice, "--headless", "--convert-to", fmt, "--outdir", os.path.join(tmp, ext)] + files, capture_output=True, timeout=900)
else:
    skips.add("LibreOffice")
try:
    import docx
except Exception:
    docx = None; skips.add("python-docx")
if not os.path.exists(VALIDATOR): skips.add("the OOXML schema validator")
for c in cases:
    e, bad, f = dict(c["expect"], **NOW.get(c["id"], {})), [], os.path.join(tmp, c["id"] + ".docx")
    if not os.path.exists(f):
        result(c["id"], ["Lantern made no file"]); continue
    if e.get("valid") and os.path.exists(VALIDATOR):
        r = subprocess.run([sys.executable, "validate.py", f], cwd=os.path.dirname(VALIDATOR), capture_output=True, text=True, timeout=300)
        if "All validations PASSED" not in r.stdout + r.stderr: bad.append("not valid OOXML: " + (r.stdout + r.stderr)[-300:])
    if soffice:
        tp, hp = os.path.join(tmp, "txt", c["id"] + ".txt"), os.path.join(tmp, "html", c["id"] + ".html")
        if not os.path.exists(tp) or not os.path.exists(hp): bad.append("LibreOffice did not open it")
        else:
            t = open(tp, encoding="utf-8", errors="replace").read().replace("\r\n", "\n").lstrip("﻿")
            h = open(hp, encoding="utf-8", errors="replace").read()
            h1 = re.sub(r"\s+", " ", h)
            for x in e.get("lo_text_contains", []):
                if x not in t: bad.append("LibreOffice's text lacks %r" % x)
            for x in e.get("lo_text_not_contains", []):
                if x in t: bad.append("LibreOffice's text has %r" % x)
            for x in e.get("lo_html_contains", []):
                if x not in h and re.sub(r"\s+", " ", x) not in h1: bad.append("LibreOffice's HTML lacks %r" % x)
            for x in e.get("lo_html_not_contains", []):
                if x in h: bad.append("LibreOffice's HTML has %r" % x)
    if docx:
        try:
            d = docx.Document(f)
            names = set(p.style.name for p in d.paragraphs)
            for t in d.tables:
                for row in t.rows:
                    for cell in row.cells:
                        names |= set(p.style.name for p in cell.paragraphs)
            for x in e.get("py_styles", []):
                if x not in names: bad.append("python-docx finds no %r style" % x)
            if "py_tables" in e and len(d.tables) != e["py_tables"]: bad.append("python-docx finds %d tables" % len(d.tables))
            hl = "".join(r.text for p in d.paragraphs for r in p.runs if r.font.highlight_color is not None)
            for x in e.get("py_highlight", []):
                if x not in hl: bad.append("python-docx finds %r not highlighted" % x)
        except Exception as ex:
            bad.append("python-docx could not read it: %s" % ex)
    result(c["id"], bad)
shutil.rmtree(tmp, ignore_errors=True)
if skips: print("SKIP  " + ", ".join(sorted(skips)) + " not on this machine")
print(("%d FAILED" % fails) if fails else ("ALL SECOND DOCX REVIEW CHECKS WITH LIBREOFFICE PASS" if SECOND else "ALL DOCX REVIEW CHECKS WITH LIBREOFFICE PASS"), "(%d agree, %d kept as they are)" % (passes, len(kept)))
sys.exit(1 if fails else 0)
