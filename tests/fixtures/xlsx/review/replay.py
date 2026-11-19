# replay.py -- the first review of Excel files in Lantern (1.24.28), replayed against the Lantern of now.
#   python3 tests/fixtures/xlsx/review/replay.py [inner.html] [-v] [--only id,id] [--record]
# Runs every case in cases.json (run.js drives Lantern in jsdom), then judges what Lantern did against what Excel
# would do ("expected"), with LibreOffice (python3-uno), openpyxl and the spreadsheet schema (sml.xsd) as the oracles
# for the files Lantern saves. Prints AGREE or DISAGREE for each case and the totals. --record writes lantern_got and
# agree back into cases.json. Where LibreOffice, openpyxl or the schema is missing, the checks that need it say SKIP
# and the case is judged on the rest.
# The whole round, from nothing:  python3 make.py && python3 cases.py && python3 replay.py --record && python3 cases.py
# (cases.py carries the judgement of each disagreement, harm and why, into cases.json; a case that newly disagrees
# shows as "unjudged" in the totals until it is judged there.)
import glob, json, math, os, re, shutil, subprocess, sys, tempfile, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
FILES = os.path.join(HERE, "files")
sys.path.insert(0, HERE)
args = sys.argv[1:]
VERBOSE = "-v" in args; RECORD = "--record" in args
ONLY = None
if "--only" in args:
    ONLY = args[args.index("--only") + 1].split(","); del args[args.index("--only"):args.index("--only") + 2]
args = [a for a in args if a not in ("-v", "--record")]
INNER = args[0] if args else os.path.join(ROOT, "src", "lantern.inner.html")
CASES = json.load(open(os.path.join(HERE, "cases.json"), encoding="utf-8"))
XSD = os.environ.get("LANTERN_SML_XSD") or next(iter(glob.glob("/mnt/skills/public/*/scripts/office/schemas/ISO-IEC29500-4_2016/sml.xsd")), None)
ERRORS = ("#DIV/0!", "#N/A", "#NAME?", "#NULL!", "#NUM!", "#REF!", "#VALUE!", "#GETTING_DATA", "#SPILL!", "#CALC!")
SKIPS = set()
try:
    import lxml.etree as LX
except Exception:
    LX = None; SKIPS.add("lxml")
try:
    import openpyxl
except Exception:
    openpyxl = None; SKIPS.add("openpyxl")
try:
    import lo
    OFFICE = lo.Office() if lo.uno is not None else None
except Exception:
    OFFICE = None
if OFFICE is None: SKIPS.add("LibreOffice")
SCHEMA = None
if LX is not None and XSD and os.path.exists(XSD):
    SCHEMA = LX.XMLSchema(LX.parse(XSD))
else:
    SKIPS.add("the spreadsheet schema (set LANTERN_SML_XSD)")

tmp = tempfile.mkdtemp(prefix="xlsx_review_")
todo = [c for c in CASES if not ONLY or c["id"] in ONLY]
json.dump(todo, open(os.path.join(tmp, "cases.json"), "w", encoding="utf-8"))
r = subprocess.run(["node", os.path.join(HERE, "run.js"), os.path.join(tmp, "cases.json"), tmp, INNER], capture_output=True, text=True, cwd=ROOT)
if r.returncode:
    print(r.stdout[-2000:], r.stderr[-3000:]); sys.exit(2)
GOT = json.load(open(os.path.join(tmp, "got.json"), encoding="utf-8"))


# ---------------------------------------------------------------------------------------------------------------
def is_num(x): return isinstance(x, (int, float)) and not isinstance(x, bool)


def same(e, g, tol=1e-9):
    """Excel's value e against Lantern's (or LibreOffice's) g"""
    if isinstance(e, bool):
        return (isinstance(g, bool) and g == e) or (isinstance(g, str) and g.upper() == ("TRUE" if e else "FALSE"))
    if is_num(e):
        if isinstance(g, bool) or not is_num(g): return False
        if math.isnan(g) or math.isinf(g): return False
        return abs(e - g) <= tol * max(1.0, abs(e))
    if e is None: return g in (None, "")
    return isinstance(g, str) and g.replace("\r\n", "\n") == str(e).replace("\r\n", "\n")


def squash(s): return re.sub(r"[\s    ]+", "", s or "")


def nfnorm(s): return re.sub(r"[\"\\]", "", s or "").lower()


def short(x, n=160):
    s = json.dumps(x, ensure_ascii=False) if not isinstance(x, str) else x
    return s if len(s) <= n else s[:n] + "..."


class J:
    def __init__(self): self.fails = []; self.n = 0; self.skipped = []

    def ok(self, what, cond, exp=None, got=None):
        self.n += 1
        if not cond: self.fails.append({"check": what, "expected": exp, "got": got})

    def skip(self, what): self.skipped.append(what)


def sheet_key(d, k):
    return d.get(str(k), d.get(k))


def notes_check(j, notes, exp, label="notes"):
    notes = notes or []
    for rx in exp.get("notes_contain", []):
        j.ok("%s say /%s/" % (label, rx), any(re.search(rx, n) for n in notes), rx, notes)
    for rx in exp.get("notes_not_contain", []):
        bad = [n for n in notes if re.search(rx, n)]
        j.ok("%s do not say /%s/" % (label, rx), not bad, "no note matching " + rx, bad)


# ---------------------------------------------------------------------------------------------------------------
def judge_read(c, g, j):
    e = c["expected"]
    if "error_contains" in e:
        j.ok("refused, in plain words", "error" in g and all(re.search(rx, g["error"]) for rx in e["error_contains"]), e["error_contains"], g.get("error") or "opened")
        if "alert_contains" in e:
            al = " ".join(g.get("import_alerts") or [])
            j.ok("Import file says so", all(re.search(rx, al) for rx in e["alert_contains"]), e["alert_contains"], al)
        return
    if "max_ms" in e: j.ok("read within %d ms" % e["max_ms"], (g.get("ms") or 1e9) <= e["max_ms"], e["max_ms"], g.get("ms"))
    if "error" in g or "crash" in g:
        j.ok("the file opens", False, "opens", g.get("error") or g.get("crash")); return
    sh = g["sheets"]
    if "sheets" in e: j.ok("number of sheets", len(sh) == e["sheets"], e["sheets"], len(sh))
    if "names" in e: j.ok("sheet names", [s["name"] for s in sh] == e["names"], e["names"], [s["name"] for s in sh])
    for k, want in e.get("cells", {}).items():
        cells = sh[int(k)]["cells"]
        for ref, raw in want.items(): j.ok("cell %s as typed" % ref, cells.get(ref) == raw, raw, cells.get(ref))
    for k, want in e.get("values", {}).items():
        vals = g["values"][int(k)]; vs = (g.get("vshown") or {}).get(str(k)) or {}
        for ref, v in want.items():
            if isinstance(v, bool):    # Sheets keeps TRUE as 1 and shows TRUE: judged by what it shows
                j.ok("%s shows %s" % (ref, "TRUE" if v else "FALSE"), squash(vs.get(ref)) == ("TRUE" if v else "FALSE"), "TRUE" if v else "FALSE", vs.get(ref) if ref in vs else vals.get(ref))
            else: j.ok("value of %s" % ref, same(v, vals.get(ref)), v, vals.get(ref))
    for k, want in e.get("values_abs", {}).items():
        vals = g["values"][int(k)]
        for ref, (v, tol) in want.items():
            gv = vals.get(ref); j.ok("value of %s" % ref, is_num(gv) and abs(gv - v) <= tol, v, gv)
    for k, want in e.get("fmt", {}).items():
        fmt = sh[int(k)]["fmt"] or {}
        for ref, f in want.items():
            gf = fmt.get(ref) or {}
            for key, v in f.items():
                if key == "nf": j.ok("number format of %s" % ref, nfnorm(gf.get("nf")) == nfnorm(v), v, gf.get("nf"))
                elif key in ("b", "i"): j.ok(("bold " if key == "b" else "italic ") + ref, bool(gf.get(key)) == bool(v), v, gf.get(key))
                else: j.ok("%s of %s" % (key, ref), gf.get(key) == v, v, gf.get(key))
    for k, want in e.get("merges", {}).items():
        got = sh[int(k)]["merges"] or []; j.ok("merged cells", sorted(got) == sorted(want), sorted(want), sorted(got))
    for k, want in e.get("widths", {}).items():
        got = sh[int(k)]["widths"] or {}
        for col, wv in want.items(): j.ok("width of %s" % col, is_num(got.get(col)) and abs(got[col] - wv) <= 0.01, wv, got.get(col))
    for k, want in e.get("freeze", {}).items():
        got = sh[int(k)]["freeze"] or 0; j.ok("frozen rows on sheet %s" % k, got == want, want, got)
    for k, want in e.get("rows_at_least", {}).items():
        got = sh[int(k)]["rows"] or 0; j.ok("rows on sheet %s" % k, got >= want, want, got)
    for k, want in e.get("shown", {}).items():
        got = (g.get("shown") or {}).get(str(k)) or {}
        for ref, t in want.items(): j.ok("%s shows" % ref, squash(got.get(ref)) == squash(t), t, got.get(ref))
    for k, want in e.get("grid", {}).items():
        got = (g.get("grid") or {}).get(str(k)) or {}
        for ref, props in want.items():
            gi = got.get(ref) or {}
            for p, v in props.items(): j.ok("%s %s" % (ref, p), gi.get(p) == v, v, gi.get(p))
    nd = e.get("notes_name_differences")
    if nd:
        vals = g["values"][int(nd["sheet"])]
        loose = lambda v, gv: same(v, gv) or (isinstance(v, bool) and is_num(gv) and gv == int(v))
        differ = sorted(ref for ref, v in nd["values"].items() if not loose(v, vals.get(ref)))
        text = " ".join(n for n in (g.get("notes") or []) if "differently" in n)
        named = set(re.findall(r"\b([A-Z]{1,2}[0-9]+) \(Excel", text))
        more = re.search(r"and ([0-9]+) more", text)
        missing = [r_ for r_ in differ if r_ not in named]
        j.ok("the note names each cell Lantern works out differently from Excel", not missing or (more and len(missing) <= int(more.group(1))), differ, sorted(named))
        wrong = sorted(r_ for r_ in named if r_ in nd["values"] and r_ not in differ)
        j.ok("the note names no cell Lantern works out as Excel did", not wrong, [], wrong)
    notes_check(j, g.get("notes"), e)


# ---- the files Lantern saves ----
def parts(path):
    z = zipfile.ZipFile(path); return z, z.namelist()


def first_sheet_xml(z):
    import xml.etree.ElementTree as ET
    M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {x.get("Id"): x.get("Target") for x in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    s = wb.find(M + "sheets")[0]
    t = rels[s.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
    t = t.lstrip("/") if t.startswith("/") else "xl/" + t
    return z.read(t).decode("utf-8", "replace"), [x.get("name") for x in wb.find(M + "sheets")]


def strings_of(z):
    import xml.etree.ElementTree as ET
    M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    if "xl/sharedStrings.xml" not in z.namelist(): return []
    return ["".join(t.text or "" for t in si.iter(M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")]


def cell_f(xml, ref):
    m = re.search(r'<c r="%s"[^>]*>(.*?)</c>' % ref, xml, re.S)
    if not m: return None
    f = re.search(r"<f[^>]*>(.*?)</f>", m.group(1), re.S)
    return f and f.group(1).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'")


def col_num(letters):
    n = 0
    for ch in letters: n = n * 26 + ord(ch) - 64
    return n


def excel_rules(z, xml):
    """what Excel repairs that the schema lets through"""
    bad = []
    names = z.namelist()
    ct = z.read("[Content_Types].xml").decode("utf-8")
    defaults = set(x.lower() for x in re.findall(r'<Default Extension="([^"]+)"', ct))
    overrides = set(x.lstrip("/") for x in re.findall(r'<Override PartName="([^"]+)"', ct))
    for n in names:
        if n == "[Content_Types].xml" or n.endswith("/"): continue
        if n not in overrides and n.rsplit(".", 1)[-1].lower() not in defaults: bad.append("no content type for " + n)
    for o in overrides:
        if o not in names: bad.append("a content type for a part that is not there: " + o)
    for rel in [n for n in names if n.endswith(".rels")]:
        base = rel.replace("_rels/", "").rsplit(".rels", 1)[0]
        folder = base.rsplit("/", 1)[0] if "/" in base else ""
        for tgt, mode in re.findall(r'Target="([^"]+)"(?:\s+TargetMode="(\w+)")?', z.read(rel).decode("utf-8")):
            if mode == "External": continue
            path = tgt.lstrip("/") if tgt.startswith("/") else (folder + "/" + tgt if folder else tgt)
            parts_ = []
            for seg in path.split("/"):
                if seg == "..": parts_ = parts_[:-1]
                elif seg and seg != ".": parts_.append(seg)
            if "/".join(parts_) not in names: bad.append("%s points at %s, which is not there" % (rel, tgt))
    last_r = 0
    for m in re.finditer(r'<row r="(\d+)"[^>]*?(?:/>|>(.*?)</row>)', xml, re.S):
        r = int(m.group(1))
        if r <= last_r: bad.append("row %d after row %d" % (r, last_r))
        last_r = r; last_c = 0
        for cm in re.finditer(r'<c r="([A-Z]+)(\d+)"', m.group(2) or ""):
            if int(cm.group(2)) != r: bad.append("cell %s%s in row %d" % (cm.group(1), cm.group(2), r))
            c = col_num(cm.group(1))
            if c <= last_c: bad.append("cell %s%s after column %d in its row" % (cm.group(1), cm.group(2), last_c))
            last_c = c
    last = 0
    for cm in re.finditer(r'<col min="(\d+)" max="(\d+)"', xml):
        a, b = int(cm.group(1)), int(cm.group(2))
        if a <= last or b < a: bad.append("column %d-%d overlaps or is out of order" % (a, b))
        last = b
    boxes = []
    for mm in re.findall(r'<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"', xml):
        bx = (col_num(mm[0]), int(mm[1]), col_num(mm[2]), int(mm[3]))
        if bx[0] == bx[2] and bx[1] == bx[3]: bad.append("a merge of one cell")
        for o in boxes:
            if not (bx[2] < o[0] or o[2] < bx[0] or bx[3] < o[1] or o[3] < bx[1]): bad.append("merges overlap")
        boxes.append(bx)
    st = z.read("xl/styles.xml").decode("utf-8") if "xl/styles.xml" in z.namelist() else ""
    xfs = re.search(r"<cellXfs[^>]*>(.*?)</cellXfs>", st, re.S)
    nxf = len(re.findall(r"<xf\b", xfs.group(1))) if xfs else 0
    for sm in re.findall(r'<c r="[A-Z]+\d+" s="(\d+)"', xml):
        if int(sm) >= max(nxf, 1): bad.append("style %s of %d" % (sm, nxf))
    defined = set(int(x) for x in re.findall(r'<numFmt numFmtId="(\d+)"', st))
    for nf in re.findall(r'<xf [^>]*numFmtId="(\d+)"', xfs.group(1) if xfs else ""):
        if int(nf) >= 164 and int(nf) not in defined: bad.append("number format %s not defined" % nf)
    fills = re.search(r"<fills[^>]*>(.*?)</fills>", st, re.S)
    if fills and not re.match(r'\s*<fill>\s*<patternFill patternType="none"\s*/>\s*</fill>\s*<fill>\s*<patternFill patternType="gray125"\s*/>', fills.group(1)):
        bad.append("the first two fills are not none and gray125")
    nss = len(strings_of(z))
    for sv in re.findall(r'<c r="[A-Z]+\d+"[^>]*t="s"[^>]*><v>(\d+)</v>', xml):
        if int(sv) >= nss: bad.append("shared string %s of %d" % (sv, nss))
    for m in re.finditer(r'<c r="([A-Z]+\d+)"([^>]*?)(?:/>|>(.*?)</c>)', xml, re.S):
        ref, attrs, inner = m.group(1), m.group(2), m.group(3) or ""
        t = re.search(r'\bt="(\w+)"', attrs); t = t.group(1) if t else "n"
        v = re.search(r"<v>(.*?)</v>", inner, re.S)
        if v is None: continue
        v = v.group(1)
        if t == "n":
            try:
                fv = float(v)
                if math.isnan(fv) or math.isinf(fv): bad.append("%s: %s saved as a number" % (ref, v))
            except Exception: bad.append("%s: %r saved as a number" % (ref, v[:20]))
        elif t == "b" and v not in ("0", "1"): bad.append("%s: %r saved as TRUE/FALSE" % (ref, v[:20]))
        elif t == "e" and v not in ERRORS: bad.append("%s: %r saved as an Excel error" % (ref, v[:20]))
    return bad


def lo_read(path):
    if OFFICE is None: return None
    try:
        d = OFFICE.read(path)
    except Exception as ex:
        return {"error": str(ex)}
    if d is None: return {"error": "LibreOffice could not open it"}
    return d


LO_ORIG = {}


def judge_file(c, g, j, path, sheet_cells, lantern_values, notes):
    e = c["expected"]
    if not os.path.exists(path):
        j.ok("a file was saved", False, "a file", g.get("error") or "none"); return
    z, names = parts(path)
    if e.get("xml_well_formed") or e.get("schema_ok"):
        bad = []
        if LX is not None:
            for n in names:
                if n.endswith(".xml") or n.endswith(".rels"):
                    try: LX.fromstring(z.read(n))
                    except Exception as ex: bad.append("%s: %s" % (n, str(ex)[:120]))
            j.ok("every part is well-formed XML", not bad, "well-formed", bad)
        else: j.skip("well-formed (lxml)")
    if e.get("schema_ok"):
        if SCHEMA is not None:
            errs = []
            for n in names:
                if n.startswith("xl/") and n.endswith(".xml") and "/theme/" not in n:
                    try: doc = LX.fromstring(z.read(n))
                    except Exception: continue
                    if not SCHEMA.validate(doc):
                        errs += ["%s: %s" % (n, str(x)[:200]) for x in SCHEMA.error_log if "}t', attribute '{http://www.w3.org/XML/1998/namespace}space'" not in str(x)]
            j.ok("as the spreadsheet schema has it", not errs, "valid", errs[:4])
        else: j.skip("schema")
    xml, sheetnames = first_sheet_xml(z)
    if e.get("cell_values_ok"):
        bad = []
        for m in re.finditer(r'<c r="([A-Z]+\d+)"([^>]*?)(?:/>|>(.*?)</c>)', xml, re.S):
            ref, attrs, inner = m.group(1), m.group(2), m.group(3) or ""
            t = re.search(r'\bt="(\w+)"', attrs); t = t.group(1) if t else "n"
            v = re.search(r"<v>(.*?)</v>", inner, re.S)
            if v is None: continue
            v = v.group(1)
            if t == "n":
                try:
                    fv = float(v)
                    if math.isnan(fv) or math.isinf(fv): bad.append((ref, t, v))
                except Exception: bad.append((ref, t, v))
            elif t == "b" and v not in ("0", "1"): bad.append((ref, t, v))
            elif t == "e" and v not in ERRORS: bad.append((ref, t, v))
        j.ok("each saved value is of the kind its cell says (no NaN, Infinity or text where Excel reads a number)", not bad, "numbers, 0/1, Excel's errors", bad[:6])
    if e.get("excel_rules"):
        j.ok("the rules Excel checks beyond the schema (rows and cells in order, columns and merged cells not overlapping, styles and strings that exist)", not excel_rules(z, xml), "none broken", excel_rules(z, xml)[:5])
    if "sheet_name_valid" in e:
        n = sheetnames[0] if sheetnames else ""
        n = n.replace("&apos;", "'").replace("&amp;", "&")
        valid = 1 <= len(n) <= 31 and not re.search(r"[\[\]:*?/\\]", n) and not n.startswith("'") and not n.endswith("'") and n.lower() != "history"
        j.ok("the sheet's name is one Excel accepts", valid, "1-31 characters, none of []:*?/\\, no ' at the ends, not History", n)
    if "max_text_len" in e:
        longest = max([len(s) for s in strings_of(z)] + [len(m) for m in re.findall(r"<is><t[^>]*>(.*?)</t></is>", xml, re.S)] + [0])
        j.ok("no text longer than %d characters" % e["max_text_len"], longest <= e["max_text_len"], e["max_text_len"], longest)
    if "xml_space_preserve" in e:
        ss = z.read("xl/sharedStrings.xml").decode("utf-8") if "xl/sharedStrings.xml" in names else ""
        ok_ = True; seen = []
        for ref in e["xml_space_preserve"]:
            text = sheet_cells.get(ref, "")
            esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            hit = re.search(r'<t xml:space="preserve">%s</t>' % re.escape(esc), ss + xml)
            seen.append((ref, bool(hit))); ok_ = ok_ and bool(hit)
        j.ok("text with spaces at its ends is marked xml:space=\"preserve\" (Excel trims it otherwise)", ok_, True, seen)
    if "xml_f_prefix" in e:
        bad = []
        for ref, pre in e["xml_f_prefix"].items():
            f = cell_f(xml, ref)
            if not f or not f.startswith(pre): bad.append((ref, pre, f))
        j.ok("each newer function written with Excel's prefix", not bad, "prefixes", bad[:8])
    if "xml_dynamic" in e:
        bad = [ref for ref in e["xml_dynamic"] if not re.search(r'<c r="%s"[^>]*\bcm="1"[^>]*>\s*<f[^>]*t="array"' % ref, xml)]
        j.ok("each spilling formula saved as Excel 365 saves one (t=\"array\", cm=\"1\")", not bad, e["xml_dynamic"], bad)
    if e.get("no_formula_names_missing_sheet"):
        bad = []
        for f in re.findall(r"<f[^>]*>(.*?)</f>", xml, re.S):
            f2 = re.sub(r'&quot;.*?&quot;|"[^"]*"', "", f.replace("&apos;", "'"))
            for m in re.finditer(r"(?:'((?:[^']|'')+)'|([A-Za-z_À-￿][\w.À-￿]*))(?::[A-Za-z_][\w.]*)?!", f2):
                nm = (m.group(1) or m.group(2)).replace("''", "'")
                if nm not in sheetnames: bad.append((nm, f))
        j.ok("no formula names a sheet that is not in the file", not bad, "none", bad[:5])
    if e.get("no_structured_refs"):
        has_tables = any("/tables/" in n for n in names)
        bad = [f for f in re.findall(r"<f[^>]*>(.*?)</f>", xml, re.S) if re.search(r"\w\[", re.sub(r'&quot;.*?&quot;', "", f))]
        j.ok("no formula names an Excel table the file has not got", has_tables or not bad, "none", bad[:4])
    if "name" in e: j.ok("the file's name", g.get("name") == e["name"], e["name"], g.get("name"))
    # openpyxl
    op = e.get("openpyxl") or {}
    if op or e.get("file_openpyxl"):
        op = dict(op, **(e.get("file_openpyxl") or {}))
        if openpyxl is None: j.skip("openpyxl")
        else:
            try:
                wb = openpyxl.load_workbook(path); ws = wb.worksheets[0]
            except Exception as ex:
                j.ok("openpyxl opens it", False, "opens", str(ex)[:200]); wb = None
            if wb is not None:
                if op.get("opens"): j.ok("openpyxl opens it", True)
                import datetime as DT
                for ref, v in (op.get("values") or {}).items():
                    gv = ws[ref].value
                    if isinstance(v, dict) and "date" in v:     # a date Excel can sort and add to, not text that looks like one
                        okv = isinstance(gv, (DT.date, DT.datetime)) and gv.isoformat()[:10] == v["date"]
                    elif isinstance(v, dict) and "time" in v:
                        hh, mm = v["time"].split(":")
                        okv = (isinstance(gv, DT.time) and gv.hour == int(hh) and gv.minute == int(mm)) or (isinstance(gv, DT.datetime) and gv.hour == int(hh) and gv.minute == int(mm))
                    elif isinstance(v, dict) and "text" in v: okv = gv == v["text"]
                    else: okv = same(v, gv)
                    j.ok("openpyxl: %s is %s" % (ref, json.dumps(v, ensure_ascii=False)), okv, v, "%s (%s)" % (gv, type(gv).__name__))
                for ref, sub in (op.get("nf_contains") or {}).items():
                    j.ok("openpyxl: %s's format has %s" % (ref, sub), sub in (ws[ref].number_format or ""), sub, ws[ref].number_format)
                for ref, code in (op.get("nf") or {}).items():
                    j.ok("openpyxl: %s's format" % ref, nfnorm(ws[ref].number_format) == nfnorm(code), code, ws[ref].number_format)
                if op.get("formulas_kept"):
                    bad = []
                    for ref, raw in sheet_cells.items():
                        if isinstance(raw, str) and raw.startswith("=") and not any(n.startswith("Saved as text") and ref + " (" in n for n in (notes or [])):
                            gv = ws[ref].value
                            if not (isinstance(gv, str) and gv.startswith("=")) and type(gv).__name__ != "ArrayFormula": bad.append((ref, raw, str(gv)))
                    j.ok("openpyxl: every formula is a formula", not bad, "formulas", bad[:5])
                for ref, f in (op.get("formulas") or {}).items():
                    gv = ws[ref].value
                    norm = (lambda x: x.replace(" ", "").upper()) if op.get("formulas_any_case") else (lambda x: x.replace(" ", ""))
                    j.ok("openpyxl: %s is %s" % (ref, f), isinstance(gv, str) and norm(gv) == norm(f), f, str(gv))
                if "merges" in op:
                    got = sorted(str(m) for m in ws.merged_cells.ranges); j.ok("openpyxl: merged cells", got == sorted(op["merges"]), sorted(op["merges"]), got)
                for col, wv in (op.get("widths") or {}).items():
                    gw = ws.column_dimensions[col].width; j.ok("openpyxl: width of %s" % col, gw is not None and abs(gw - wv) <= 0.01, wv, gw)
                if "freeze" in op: j.ok("openpyxl: frozen pane", ws.freeze_panes == op["freeze"], op["freeze"], ws.freeze_panes)
                for ref in op.get("bold") or []: j.ok("openpyxl: %s bold" % ref, bool(ws[ref].font.b), True, ws[ref].font.b)
                for ref in op.get("italic") or []: j.ok("openpyxl: %s italic" % ref, bool(ws[ref].font.i), True, ws[ref].font.i)
                for ref, al in (op.get("align") or {}).items(): j.ok("openpyxl: %s aligned %s" % (ref, al), ws[ref].alignment.horizontal == al, al, ws[ref].alignment.horizontal)
                for ref, dt in (op.get("data_type") or {}).items(): j.ok("openpyxl: %s is of kind %s" % (ref, dt), ws[ref].data_type == dt, dt, ws[ref].data_type)
                if "sheet_title" in op: j.ok("openpyxl: the sheet's name", ws.title == op["sheet_title"], op["sheet_title"], ws.title)
    # LibreOffice
    need_lo = any(k in e for k in ("lo_values", "lo_values_contain", "lo_same_as_lantern", "lo_shown", "lo_shown_same_as_lantern", "lo_shown_same_as_original", "lo_opens"))
    if need_lo:
        if OFFICE is None: j.skip("LibreOffice"); return
        d = lo_read(path)
        if not d or "error" in d:
            j.ok("LibreOffice opens it", False, "opens", d and d.get("error")); return
        if e.get("lo_opens"): j.ok("LibreOffice opens it", True)
        cells = d["cells"][d["sheets"][0]]
        lv = lambda ref: (cells.get(ref) or {}).get("v")
        ls = lambda ref: (cells.get(ref) or {}).get("s", "")
        for ref, v in (e.get("lo_values") or {}).items(): j.ok("LibreOffice: %s is %r" % (ref, v), same(v, lv(ref)), v, lv(ref))
        for ref, sub in (e.get("lo_values_contain") or {}).items(): j.ok("LibreOffice: %s has %r" % (ref, sub), sub in str(lv(ref) or ""), sub, lv(ref))
        if e.get("lo_same_as_lantern"):
            bad = []; skip = set(e.get("lo_skip") or [])
            for ref, raw in sheet_cells.items():
                if ref in skip or not (isinstance(raw, str) and raw.startswith("=")): continue
                if any(n.startswith("Saved as text") and ref + " (" in n for n in (notes or [])): continue
                if re.search(r"(?i)\b(TODAY|NOW|RAND|RANDBETWEEN)\(", raw): continue
                mine, theirs = (lantern_values or {}).get(ref), lv(ref)
                if isinstance(theirs, bool): okv = squash((g.get("shown") or {}).get(ref)) == ("TRUE" if theirs else "FALSE") if g.get("shown") else same(theirs, mine)
                elif is_num(mine): okv = same(mine, theirs, 1e-7)
                elif isinstance(mine, bool): okv = same(mine, theirs)
                elif mine is None: okv = theirs in (None, "")
                else: okv = isinstance(theirs, str) and theirs.replace("\r\n", "\n") == mine.replace("\r\n", "\n")
                if not okv: bad.append((ref, raw, mine, theirs))
            j.ok("LibreOffice works out every formula as Lantern showed it", not bad, "the same", bad[:8])
        for ref, t in (e.get("lo_shown") or {}).items(): j.ok("LibreOffice shows %s as %s" % (ref, t), squash(ls(ref)) == squash(t), t, ls(ref))
        for ref in e.get("lo_shown_same_as_lantern") or []:
            mine = (g.get("shown") or {}).get(ref)
            j.ok("LibreOffice shows %s as Lantern did" % ref, squash(ls(ref)) == squash(mine), mine, ls(ref))
        if e.get("lo_shown_same_as_original"):
            src = os.path.join(FILES, c["input"]["file"])
            if src not in LO_ORIG: LO_ORIG[src] = lo_read(src)
            od = LO_ORIG[src]; oc = od["cells"][od["sheets"][c["input"].get("sheet", 0)]]
            bad = [(ref, oc.get(ref, {}).get("s"), ls(ref)) for ref in e["lo_shown_same_as_original"] if squash(oc.get(ref, {}).get("s")) != squash(ls(ref))]
            j.ok("LibreOffice shows every cell as it showed the first file", not bad, "the same", bad[:8])


def judge_write(c, g, j):
    e = c["expected"]
    if "max_ms" in e: j.ok("saved within %d ms" % e["max_ms"], (g.get("ms") or 1e9) <= e["max_ms"], e["max_ms"], g.get("ms"))
    if "error" in g or "crash" in g:
        j.ok("it saves", False, "a file", g.get("error") or g.get("crash")); return
    path = os.path.join(tmp, g["file"])
    cells = (c["input"].get("sheet") or {}).get("cells") or g.get("cells") or {}
    notes_check(j, g.get("notes") or ([g["ui_note"]] if g.get("ui_note") else []), e)
    judge_file(c, g, j, path, cells, g.get("values"), g.get("notes"))


def judge_round(c, g, j):
    e = c["expected"]
    if "crash" in g:
        j.ok("it reads and saves", False, "a file", g["crash"]); return
    notes_check(j, g.get("notes"), e, "the save's notes")
    for rx in e.get("read_notes_contain", []): j.ok("the read's notes say /%s/" % rx, any(re.search(rx, n) for n in g.get("read_notes") or []), rx, g.get("read_notes"))
    judge_file(c, g, j, os.path.join(tmp, g["file"]), g["cells"], g.get("values"), g.get("notes"))


def judge_grid(c, g, j):
    if "error" in g or "crash" in g:
        j.ok("the grid works", False, "no error", g.get("error") or g.get("crash")); return
    checks = [t for t in g["trace"] if "merges" in t or "crash" in t]
    want = c["expected"]["trace"]
    j.ok("every step ran", not any("crash" in t for t in g["trace"]), "no crash", [t for t in g["trace"] if "crash" in t])
    for i, w in enumerate(want):
        t = checks[i] if i < len(checks) else {}
        for k, v in w.items():
            if k == "name": j.ok("check %d: the cell is %s" % (i + 1, v), t.get("name") == v, v, t.get("name"))
            elif k == "merges": j.ok("check %d: merged cells" % (i + 1), sorted(t.get("merges") or []) == sorted(v), sorted(v), t.get("merges"))
            elif k == "merges_any": j.ok("check %d: merged cells" % (i + 1), any(sorted(t.get("merges") or []) == sorted(x) for x in v), v, t.get("merges"))
            elif k == "merges_include": j.ok("check %d: merged cells include %s" % (i + 1, v), all(m in (t.get("merges") or []) for m in v), v, t.get("merges"))
            elif k == "widths":
                gw = t.get("widths") or {}
                okw = set(gw) == set(v) and all(abs(gw[x] - v[x]) <= 0.01 for x in v)
                j.ok("check %d: widths" % (i + 1), okw, v, gw)
            elif k == "widths_any":
                gw = t.get("widths") or {}
                okw = any(set(gw) == set(x) and all(abs(gw[y] - x[y]) <= 0.01 for y in x) for x in v)
                j.ok("check %d: widths" % (i + 1), okw, v, gw)
            elif k == "freeze": j.ok("check %d: frozen" % (i + 1), (t.get("freeze") or 0) == v, v, t.get("freeze"))
            elif k == "status_contains":
                for rx in v: j.ok("check %d: the sheet says /%s/" % (i + 1, rx), bool(re.search(rx, (t.get("status") or "") + " " + " ".join(t.get("alerts") or []))), rx, t.get("status"))
            elif k == "status_not_contains":
                for rx in v: j.ok("check %d: the sheet does not say /%s/" % (i + 1, rx), not re.search(rx, t.get("status") or ""), "not " + rx, t.get("status"))
            elif k == "cells":
                for ref, raw in v.items(): j.ok("check %d: %s" % (i + 1, ref), (t.get("cells") or {}).get(ref) == raw, raw, (t.get("cells") or {}).get(ref))
            elif k == "td":
                for ref, props in v.items():
                    gi = (t.get("td") or {}).get(ref) or {}
                    for p, pv in props.items(): j.ok("check %d: %s %s" % (i + 1, ref, p), gi.get(p) == pv, pv, gi.get(p))
    if c["expected"].get("file_openpyxl"):
        saved = [t for t in g["trace"] if t.get("saved")]
        if not saved: j.ok("a file was saved", False, "a file", None)
        else: judge_file(c, g, j, os.path.join(tmp, saved[0]["saved"]), {}, {}, [])


def judge_grammar(c, g, j):
    res = g.get("results") or {}
    e = c["expected"]
    for f, want in (e.get("ok") or {}).items():
        r_ = res.get(f) or {}; j.ok("Excel reads %s as %s" % (f, want), bool(r_.get("ok")) and r_.get("f") == want, want, r_)
    for f, opts in (e.get("ok_any") or {}).items():
        r_ = res.get(f) or {}; j.ok("Excel reads %s" % f, bool(r_.get("ok")) and r_.get("f") in opts, opts, r_)
    for f in e.get("not_ok") or []:
        r_ = res.get(f) or {}; j.ok("Excel cannot read %s" % f, r_.get("ok") is False and bool(r_.get("why")), "not ok, with a reason", r_)
    for f, names in (e.get("lantern") or {}).items():
        r_ = res.get(f) or {}; j.ok("Lantern's own in %s: %s" % (f, names or "none"), sorted(r_.get("lantern") or []) == sorted(names), names, r_.get("lantern"))


def judge_order(c, g, j):
    e = c["expected"]
    for f, v in e["sheet"].items():
        if isinstance(v, bool): j.ok("in a sheet %s shows %s" % (f, "TRUE" if v else "FALSE"), squash((g.get("shown") or {}).get(f)) == ("TRUE" if v else "FALSE"), "TRUE" if v else "FALSE", (g.get("shown") or {}).get(f))
        else: j.ok("in a sheet %s is %r" % (f, v), same(v, g["sheet"].get(f)), v, g["sheet"].get(f))
    for f, v in (e.get("calculator") or {}).items(): j.ok("in the Calculator %s is %r" % (f, v), same(v, g["calculator"].get(f)), v, g["calculator"].get(f))


JUDGES = {"read": judge_read, "write": judge_write, "round": judge_round, "grid": judge_grid, "grammar": judge_grammar, "order": judge_order}
agree = 0; results = {}
for c in todo:
    g = GOT.get(c["id"]) or {"crash": "no result"}
    j = J()
    try:
        JUDGES[c["group"]](c, g, j)
    except Exception as ex:
        import traceback
        j.ok("the judging ran", False, "", traceback.format_exc()[-400:])
    if g.get("page_errors"): j.ok("no errors on the page", False, "none", g["page_errors"][:3])
    good = not j.fails
    agree += good
    results[c["id"]] = {"agree": good, "fails": j.fails, "n": j.n, "skipped": j.skipped}
    print("%-9s %-34s %s" % ("AGREE" if good else "DISAGREE", c["id"], "" if good else "; ".join("%s: expected %s, got %s" % (f["check"], short(f["expected"], 60), short(f["got"], 90)) for f in j.fails[:3 if not VERBOSE else 99])))
    if VERBOSE and j.skipped: print("          skipped:", ", ".join(j.skipped))
print("SKIP: " + ", ".join(sorted(SKIPS)) if SKIPS else "", end="\n" if SKIPS else "")
dis = len(todo) - agree
by = {}
for c in todo:
    if not results[c["id"]]["agree"]: by[c.get("harm") or "unjudged"] = by.get(c.get("harm") or "unjudged", 0) + 1
print("%d cases: %d AGREE, %d DISAGREE %s" % (len(todo), agree, dis, ("(" + ", ".join("%s %d" % (k, by[k]) for k in ("high", "medium", "low", "unjudged") if k in by) + ")") if dis else ""))
if RECORD:
    for c in CASES:
        if c["id"] not in results: continue
        res = results[c["id"]]
        c["agree"] = res["agree"]
        c["lantern_got"] = ("as expected (%d checks)" % res["n"]) if res["agree"] else [{"check": f["check"], "expected": f["expected"], "got": f["got"]} for f in res["fails"][:12]]
        if res["agree"]: c["harm"] = None
    json.dump(CASES, open(os.path.join(HERE, "cases.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
if OFFICE is not None: OFFICE.close()
shutil.rmtree(tmp, ignore_errors=True)
sys.exit(0)
