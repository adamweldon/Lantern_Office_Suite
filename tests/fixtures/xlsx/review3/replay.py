# replay.py -- the third Excel review of Lantern (1.24.28), replayed against the Lantern of the repository it sits in.
#   python3 tests/fixtures/xlsx/review3/replay.py [inner.html] [-v] [--only id,id] [--record]
# run.js drives Lantern in jsdom case by case; this judges what Lantern did against what Excel does ("expected" in
# cases.json). The files Lantern saves are opened in LibreOffice (python3-uno) and worked out again, read with openpyxl,
# and their sheets checked against the ISO 29500 schema (sml.xsd). Prints AGREE or DISAGREE <id> <reason> for each case
# and the totals.  --record writes lantern_got, agree, harm and why back into cases.json.
# Where LibreOffice, openpyxl or the schema is missing, the checks that need them are skipped and said.
import glob, json, math, os, re, subprocess, sys, tempfile, zipfile
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, HERE)
args = sys.argv[1:]
VERBOSE = "-v" in args; RECORD = "--record" in args
ONLY = None
if "--only" in args:
    k = args.index("--only"); ONLY = set(args[k + 1].split(",")); del args[k:k + 2]
args = [a for a in args if not a.startswith("-")]
INNER = args[0] if args else os.path.join(ROOT, "src", "lantern.inner.html")
CASES_PATH = os.path.join(HERE, "cases.json")
CASES = json.load(open(CASES_PATH, encoding="utf-8"))
XSD = os.environ.get("LANTERN_SML_XSD") or next(iter(glob.glob("/mnt/skills/public/*/scripts/office/schemas/ISO-IEC29500-4_2016/sml.xsd")), None)
SKIPS = []
try:
    import lxml.etree as LX
except Exception:
    LX = None; SKIPS.append("lxml")
try:
    import openpyxl
except Exception:
    openpyxl = None; SKIPS.append("openpyxl")
SCHEMA = None
if LX is not None and XSD and os.path.exists(XSD):
    try: SCHEMA = LX.XMLSchema(LX.parse(XSD))
    except Exception as e: SKIPS.append("the schema (%s)" % e)
else:
    SKIPS.append("the schema (set LANTERN_SML_XSD to sml.xsd)")
try:
    import lo
    OFFICE = lo.Office() if lo.uno is not None else None
except Exception:
    OFFICE = None
if OFFICE is None: SKIPS.append("LibreOffice")

tmp = tempfile.mkdtemp(prefix="xlsx_review3_")
todo = [c for c in CASES if not ONLY or c["id"] in ONLY]
json.dump(todo, open(os.path.join(tmp, "cases.json"), "w", encoding="utf-8"))
r = subprocess.run(["node", os.path.join(HERE, "run.js"), os.path.join(tmp, "cases.json"), tmp, INNER], capture_output=True, text=True, cwd=ROOT)
if r.returncode:
    print(r.stdout[-2000:], r.stderr[-3000:]); sys.exit(2)
GOT = json.load(open(os.path.join(tmp, "got.json"), encoding="utf-8"))

ERRS = ("#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A")
def is_num(x): return isinstance(x, (int, float)) and not isinstance(x, bool)
def same(e, g, tol=1e-9):
    """Excel's value e against what was got (Lantern's 1 for TRUE, LibreOffice's 1.0 or "TRUE")"""
    if isinstance(e, bool):
        return (is_num(g) and g == (1 if e else 0)) or g is e or (isinstance(g, str) and g.upper() == ("TRUE" if e else "FALSE"))
    if is_num(e):
        if not is_num(g) or math.isnan(g) or math.isinf(g): return False
        return abs(e - g) <= tol * max(1.0, abs(e))
    if e is None: return g in (None, "")
    return isinstance(g, str) and g == str(e)
def short(x, n=90):
    s = x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[:n] + "..."
def lo_value(o):
    if o is None or "missing_sheet" in o: return None
    if o.get("err"):
        s = o.get("s") or ""
        return s if s.startswith("#") else "Err:%s" % o["err"]
    if o["kind"] == "FORMULA" and isinstance(o["v"], float) and o["s"] in ("TRUE", "FALSE"): return o["s"] == "TRUE"
    return o["v"]
def ws_text(s): return re.sub(r"\s+", " ", s or "").strip()

# ---- the saved workbook's parts
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
def sheet_parts(path):
    """{sheet name: part path} in the order of the workbook"""
    z = zipfile.ZipFile(path)
    wb = LX.fromstring(z.read("xl/workbook.xml")); rels = LX.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    tgt = {x.get("Id"): x.get("Target") for x in rels}
    out = []
    for s in wb.find("m:sheets", NS):
        t = tgt[s.get("{%s}id" % RNS)].lstrip("/")
        out.append((s.get("name"), t if t.startswith("xl/") else "xl/" + t))
    return out
def cell_xml(path, ref, sheet=None):
    """(formula text or None, t of <f> or None, t of <c>, the cell's element) of one cell"""
    parts = sheet_parts(path); z = zipfile.ZipFile(path)
    part = next((p for n, p in parts if n == sheet), parts[0][1]) if sheet else parts[0][1]
    root = LX.fromstring(z.read(part))
    for c in root.iter("{%s}c" % NS["m"]):
        if c.get("r") == ref:
            f = c.find("m:f", NS)
            return (f.text if f is not None else None, f.get("t") if f is not None else None, c.get("t"), c)
    return (None, None, None, None)
def schema_problems(path):
    if SCHEMA is None: return []
    out = []
    z = zipfile.ZipFile(path)
    for n, p in sheet_parts(path):
        doc = LX.fromstring(z.read(p))
        if not SCHEMA.validate(doc): out.append("%s: %s" % (p, short(str(SCHEMA.error_log.last_error), 120)))
    return out
def sheet_for(path, sheet):
    names = [n for n, p in sheet_parts(path)]
    return sheet if sheet in names else names[0]
LO_CACHE = {}
def lo_cells(path, refs):
    if OFFICE is None: return None
    key = (path, tuple(sorted(refs)))
    if key not in LO_CACHE: LO_CACHE[key] = OFFICE.cells(path, list(refs))
    return LO_CACHE[key]
def qref(sheet, ref): return "'%s'!%s" % (sheet.replace("'", "''"), ref)

# ---- judging, kind by kind; each returns a list of reasons it disagrees (empty: it agrees)
def j_compute(c, g):
    why = []
    for ref, e in c["expected"].get("values", {}).items():
        v = g.get("values", {}).get(ref)
        if not same(e, v): why.append("%s is %s, Excel %s" % (ref, short(v, 40), short(e, 40)))
    for ref, e in c["expected"].get("shown", {}).items():
        v = (g.get("shown") or {}).get(ref)
        if v != e: why.append("%s shows %s, Excel %s" % (ref, short(v, 30), e))
    return why
def j_read(c, g):
    if g.get("error"): return ["the file was refused: " + g["error"]]
    why = []
    for ref, e in c["expected"]["cells"].items():
        raw, v = g["raw"].get(ref), g["values"].get(ref)
        if "value" in e and not same(e["value"], v): why.append("%s is %s, Excel %s (Lantern holds %s)" % (ref, short(v, 30), short(e["value"], 30), short(raw, 70)))
        if e.get("at") is True and "@" not in str(raw or ""): why.append("%s: no @, Excel 365 shows one (%s)" % (ref, short(raw, 60)))
        if e.get("at") is False and "@" in str(raw or ""): why.append("%s: Lantern put an @ (%s), Excel has none" % (ref, short(raw, 70)))
        if e.get("raw") and raw != e["raw"]: why.append("%s reads %s, Excel 365 shows %s" % (ref, short(raw, 50), e["raw"]))
    return why
def j_saved(c, g, cells, sheet=None):
    """the file Lantern saved: each cell's formula and kind, and LibreOffice's answer after working it out again"""
    why = []
    if not g.get("file"): return ["nothing was saved" + (" (%s)" % short(g.get("save_note"), 80) if g.get("save_note") else "")]
    path = os.path.join(tmp, g["file"])
    if openpyxl is not None:
        try: openpyxl.load_workbook(path)
        except Exception as e: why.append("openpyxl cannot open the file: %s" % short(str(e), 80))
    why += ["the schema: " + p for p in schema_problems(path)]
    sh = sheet_for(path, sheet) if sheet else sheet_for(path, None)
    need = [ref for ref, e in cells.items() if any(k in e for k in ("value", "shown", "number_or_error", "number"))]
    loc = lo_cells(path, [qref(sh, r) for r in need]) if need else {}
    wbv = openpyxl.load_workbook(path)[sh] if openpyxl is not None else None
    for ref, e in cells.items():
        f, ft, ct, el = cell_xml(path, ref, sh)
        if "array" in e and e["array"] is not None:
            if e["array"] and ft != "array": why.append("%s is not an array formula in the file (%s)" % (ref, short(f, 50)))
            if not e["array"] and ft == "array": why.append("%s is an array formula in the file (%s), which Excel then works out otherwise" % (ref, short(f, 50)))
        for h in e.get("has", []):
            if f is None or h not in f: why.append("%s: the file's formula is %s, not with %s" % (ref, short(f, 60), h))
        for h in e.get("not", []):
            if f is not None and h in f: why.append("%s: the file's formula %s holds %s" % (ref, short(f, 60), h))
        if e.get("text") is True and f is not None: why.append("%s is saved as a formula Excel cannot read (%s)" % (ref, short(f, 50)))
        cv = wbv[ref].value if wbv is not None else None
        if isinstance(e.get("text"), str) and cv != e["text"]: why.append("%s is saved as %r, Excel keeps the text %r" % (ref, cv, e["text"]))
        if "number" in e and (not is_num(cv) or abs(cv - e["number"]) > 1e-9):
            lv = lo_value((loc or {}).get(qref(sh, ref))) if loc else None
            if not (f is not None and is_num(lv) and abs(lv - e["number"]) < 1e-9):
                why.append("%s is saved as %r, Excel the number %s" % (ref, cv, e["number"]))
        if "fmt" in e and wbv is not None and wbv[ref].number_format not in e["fmt"]:
            why.append("%s has the format %r, Excel %s" % (ref, wbv[ref].number_format, " or ".join(e["fmt"])))
        if "date_or_text" in e and not (isinstance(cv, str) or (is_num(cv) and abs(cv - e["date_or_text"]) < 1e-9) or
                                        (hasattr(cv, "year") and abs((cv - __import__("datetime").datetime(1899, 12, 30)).days - e["date_or_text"]) < 1e-9)):
            why.append("%s is saved as %r, Excel the date %s or the text" % (ref, cv, e["date_or_text"]))
        if loc is None: continue
        o = (loc or {}).get(qref(sh, ref))
        if "value" in e:
            v = lo_value(o)
            if not same(e["value"], v): why.append("%s works out in a spreadsheet as %s, Excel %s (the file holds %s)" % (ref, short(v, 30), short(e["value"], 30), short(f, 60)))
        if "shown" in e and o is not None and ws_text(o.get("s")) not in [ws_text(x) for x in e["shown"]]:
            why.append("%s shows %r in a spreadsheet, Excel %s" % (ref, o.get("s"), " or ".join(repr(x) for x in e["shown"])))
        if "number_or_error" in e:
            v = lo_value(o)
            if not (same(e["number_or_error"], v) or (isinstance(v, str) and v.startswith("#"))):
                why.append("%s works out as %s, Excel %s (or #VALUE! where the date is text)" % (ref, short(v, 30), e["number_or_error"]))
    return why
def j_roundtrip(c, g):
    why = []
    if g.get("crash"): return ["crash: " + short(g["crash"], 100)]
    return why + j_saved(c, g, c["expected"]["cells"], c["input"].get("sheet"))
def j_save(c, g):
    return j_saved(c, g, c["expected"]["cells"])
def j_typed(c, g):
    why = ["%s: %s" % (t["at"], t["crash"]) for t in g.get("trace", [])]
    return why + j_saved(c, g, c["expected"]["cells"])
def j_grammar(c, g):
    e, why = c["expected"], []
    if g.get("crash"): return ["crash: " + g["crash"]]
    if "ok" in e and bool(g.get("ok")) != e["ok"]:
        why.append(("refused (%s), Excel reads it" % short(g.get("why"), 70)) if e["ok"] else ("written as %s, which Excel cannot read" % short(g.get("f"), 60)))
    if e.get("ok") and g.get("ok"):
        if "f" in e and g.get("f") != e["f"]: why.append("written %s, Excel needs %s" % (short(g.get("f"), 60), short(e["f"], 60)))
        if "array" in e and bool(g.get("array")) != e["array"]: why.append("array=%s, should be %s" % (g.get("array"), e["array"]))
    return why
def j_grid(c, g):
    tr = [t for t in g.get("trace", []) if "active" in t or "crash" in t]
    if not tr: return ["no check was made"]
    t = tr[-1]
    if t.get("crash"): return ["crash: " + t["crash"]]
    return [] if t.get("active") == c["expected"]["active"] else ["the selection is %s (%s), Excel's %s" % (t.get("active"), t.get("range"), c["expected"]["active"])]
JUDGE = {"compute": j_compute, "read": j_read, "roundtrip": j_roundtrip, "save": j_save, "typed": j_typed, "grammar": j_grammar, "grid": j_grid}

agree = disagree = 0
lines = []
for c in todo:
    g = GOT.get(c["id"], {})
    if g.get("crash"): why = ["crash: " + short(g["crash"], 200)]
    else:
        try: why = JUDGE[c["kind"]](c, g)
        except Exception as ex: why = ["the judge failed: %s" % short(str(ex), 120)]
    if g.get("page_errors"): why.append("page errors: " + short(g["page_errors"], 100))
    ok = not why
    if ok: agree += 1
    else: disagree += 1
    print(("AGREE %s" % c["id"]) if ok else ("DISAGREE %s %s" % (c["id"], "; ".join(why))))
    if VERBOSE and not ok: print("    ", c["what"], "|", short(g, 300))
    if RECORD:
        rec = {k: v for k, v in g.items() if k not in ("page_errors",)}
        c["lantern_got"] = rec; c["agree"] = ok
        c["harm"] = None if ok else c.get("harm_if_disagree")
        c["why"] = "Lantern does what Excel does here" if ok else (c.get("why_if_disagree") or "") + (" -- " if c.get("why_if_disagree") else "") + "; ".join(why)
if OFFICE is not None: OFFICE.close()
if SKIPS: print("skipped (not installed here): " + ", ".join(SKIPS))
if RECORD:
    ids = {c["id"] for c in todo}
    json.dump(CASES, open(CASES_PATH, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("%d cases: %d AGREE, %d DISAGREE" % (agree + disagree, agree, disagree))
