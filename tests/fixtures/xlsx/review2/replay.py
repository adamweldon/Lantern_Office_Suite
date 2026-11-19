# replay.py -- the second Excel review of Lantern (1.24.28), replayed against the Lantern of now.
#   python3 tests/fixtures/xlsx/review2/replay.py [inner.html] [-v] [--only id,id] [--record] [--oracle]
# Runs every case in cases.json (run.js drives Lantern in jsdom), then judges what Lantern did against what Excel does
# ("expected"). The files Lantern saves are judged with LibreOffice (python3-uno: opened, worked out again, each
# cell's value and shown text read), openpyxl, the ISO 29500 schema (sml.xsd) and the rules Excel keeps that the
# schema does not (rows and cells in order, merges not overlapping, style and text indexes in range, a content type
# and a relationship for every part, metadata.xml for cm="1"). Prints AGREE or DISAGREE for each case and the totals.
#   --record   writes lantern_got and agree back into cases.json
#   --oracle   also asks LibreOffice whether it agrees with the values expected for the guard sheet (files/guard_lo.xlsx)
# Where LibreOffice, openpyxl or the schema is missing, the checks that need them are skipped and said.
import glob, json, math, os, re, subprocess, sys, tempfile, zipfile
sys.dont_write_bytecode = True   # no Python caches in the repository
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
FILES = os.path.join(HERE, "files")
sys.path.insert(0, HERE)
args = sys.argv[1:]
VERBOSE = "-v" in args; RECORD = "--record" in args; ORACLE = "--oracle" in args
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
except Exception as e:
    OFFICE = None
if OFFICE is None: SKIPS.append("LibreOffice")

tmp = tempfile.mkdtemp(prefix="xlsx_review2_")
todo = [c for c in CASES if not ONLY or c["id"] in ONLY]
json.dump(todo, open(os.path.join(tmp, "cases.json"), "w", encoding="utf-8"))
r = subprocess.run(["node", os.path.join(HERE, "run.js"), os.path.join(tmp, "cases.json"), tmp, INNER], capture_output=True, text=True, cwd=ROOT)
if r.returncode:
    print(r.stdout[-2000:], r.stderr[-3000:]); sys.exit(2)
GOT = json.load(open(os.path.join(tmp, "got.json"), encoding="utf-8"))
ERRORS = ("#DIV/0!", "#N/A", "#NAME?", "#NULL!", "#NUM!", "#REF!", "#VALUE!", "#SPILL!", "#CALC!")
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


# ---------------------------------------------------------------------------------------------------------------
def is_num(x): return isinstance(x, (int, float)) and not isinstance(x, bool)


def same(e, g, tol=1e-9):
    """Excel's value e against what was got, g (Lantern's 1 for TRUE, LibreOffice's 1.0, "TRUE")"""
    if isinstance(e, bool):
        return (is_num(g) and g == (1 if e else 0)) or g is e or (isinstance(g, str) and g.upper() == ("TRUE" if e else "FALSE"))
    if is_num(e):
        if isinstance(g, str):
            try: g = float(g)
            except ValueError: return False
        if not is_num(g) or math.isnan(g) or math.isinf(g): return False
        return abs(e - g) <= tol * max(1.0, abs(e))
    if e is None: return g in (None, "")
    return isinstance(g, str) and g == str(e)


def short(x, n=110):
    s = x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[:n] + "..."


def col_num(s):
    n = 0
    for ch in s: n = n * 26 + ord(ch) - 64
    return n - 1


def cell_rc(ref):
    m = re.match(r"^\$?([A-Z]+)\$?([0-9]+)$", ref)
    return (int(m.group(2)) - 1, col_num(m.group(1))) if m else None


def box(ref):
    a, _, b = ref.partition(":")
    p, q = cell_rc(a), cell_rc(b or a)
    return (min(p[0], q[0]), min(p[1], q[1]), max(p[0], q[0]), max(p[1], q[1]))


# ---------------------------------------------------------------------------------------------------------------
# a saved workbook: its parts, its sheets by name, and the rules Excel keeps
class Book:
    def __init__(self, path):
        self.path = path; self.problems = []; self.sheets = {}; self.order = []; self.z = None
        try: self.z = zipfile.ZipFile(path)
        except Exception as e: self.problems.append("not a zip: %s" % e); return
        self.names = set(self.z.namelist())
        try: self.read()
        except Exception as e: self.problems.append("could not be read: %s" % e)

    def xml(self, name): return LX.fromstring(self.z.read(name))

    def read(self):
        ct = self.xml("[Content_Types].xml")
        over = {o.get("PartName").lstrip("/"): o.get("ContentType") for o in ct if o.tag.endswith("Override")}
        dflt = {o.get("Extension"): o.get("ContentType") for o in ct if o.tag.endswith("Default")}
        if "rels" not in dflt: self.problems.append("no content type for .rels")
        rels = self.rels("_rels/.rels", "")
        wbp = next((t for t, ty in rels.values() if ty.endswith("/officeDocument")), None)
        if not wbp or wbp not in self.names: self.problems.append("no workbook part"); return
        want = {"/worksheet": "spreadsheetml.worksheet+xml", "/styles": "spreadsheetml.styles+xml", "/sharedStrings": "spreadsheetml.sharedStrings+xml",
                "/sheetMetadata": "spreadsheetml.sheetMetadata+xml"}
        if not over.get(wbp, "").endswith("spreadsheetml.sheet.main+xml"): self.problems.append("the workbook has no content type")
        wrels = self.rels(self.rels_name(wbp), wbp)
        for rid, (t, ty) in wrels.items():
            if t not in self.names: self.problems.append("the workbook names a part that is not there: " + t); continue
            for k, v in want.items():
                if ty.endswith(k) and not over.get(t, "").endswith(v): self.problems.append("%s has no %s content type" % (t, v))
        for n in self.names:
            if n.endswith(".xml") and n not in over and n != "[Content_Types].xml": self.problems.append("no content type for " + n)
        self.parts = {ty.rsplit("/", 1)[-1]: t for t, ty in wrels.values()}
        wb = self.xml(wbp)
        self.wb = wb; self.wbp = wbp
        for sh in wb.iter(M + "sheet"):
            t = wrels.get(sh.get(RNS + "id"), (None, ""))[0]
            self.order.append(sh.get("name")); self.sheets[sh.get("name")] = t
        self.sst = []
        if self.parts.get("sharedStrings") in self.names:
            for si in self.xml(self.parts["sharedStrings"]).iter(M + "si"): self.sst.append("".join(t.text or "" for t in si.iter(M + "t")))
        self.nxf = 0
        if self.parts.get("styles") in self.names:
            xfs = self.xml(self.parts["styles"]).find(M + "cellXfs")
            self.nxf = len(xfs) if xfs is not None else 0
        self.ncm = 0
        if self.parts.get("sheetMetadata") in self.names:
            cm = self.xml(self.parts["sheetMetadata"]).find(M + "cellMetadata")
            self.ncm = int(cm.get("count") or len(cm)) if cm is not None else 0
        elif "xl/metadata.xml" in self.names: self.problems.append("xl/metadata.xml is not tied to the workbook")
        if SCHEMA is not None:
            for p in [wbp] + [t for t in self.sheets.values() if t] + [self.parts.get(k) for k in ("styles", "sharedStrings", "sheetMetadata") if self.parts.get(k)]:
                try:
                    # the schema here types <t> as a plain string, so it refuses the xml:space="preserve" Excel itself writes
                    doc = self.xml(p)
                    for el in doc.iter():
                        el.attrib.pop("{http://www.w3.org/XML/1998/namespace}space", None)
                    if not SCHEMA.validate(doc): self.problems.append("schema: %s: %s" % (p, short(str(SCHEMA.error_log.last_error), 160)))
                except Exception as e: self.problems.append("schema could not read %s: %s" % (p, e))
        for name, p in self.sheets.items(): self.check_sheet(name, p)

    def rels_name(self, part):
        d, _, f = part.rpartition("/")
        return (d + "/" if d else "") + "_rels/" + f + ".rels"

    def rels(self, name, base):
        out = {}
        if name not in self.names: return out
        d = base.rpartition("/")[0]
        for r in self.xml(name):
            t = r.get("Target")
            if r.get("TargetMode") == "External": continue
            t = t.lstrip("/") if t.startswith("/") else os.path.normpath(os.path.join(d, t)).replace("\\", "/")
            out[r.get("Id")] = (t, r.get("Type"))
        return out

    def check_sheet(self, name, p):
        if p not in self.names: self.problems.append("sheet %s is missing" % name); return
        ws = self.xml(p); last_r = 0; cells = {}
        for row in ws.iter(M + "row"):
            rn = int(row.get("r")); last_c = -1
            if rn <= last_r: self.problems.append("%s: row %d out of order" % (name, rn))
            last_r = rn
            for c in row.iter(M + "c"):
                rc = cell_rc(c.get("r"))
                if rc[0] + 1 != rn: self.problems.append("%s: %s is in row %d" % (name, c.get("r"), rn))
                if rc[1] <= last_c: self.problems.append("%s: %s out of order" % (name, c.get("r")))
                last_c = rc[1]
                s = int(c.get("s") or 0)
                if s >= max(self.nxf, 1): self.problems.append("%s: %s style %d of %d" % (name, c.get("r"), s, self.nxf))
                v = c.find(M + "v")
                if c.get("t") == "s" and v is not None and not (0 <= int(v.text) < len(self.sst)): self.problems.append("%s: %s text %s out of range" % (name, c.get("r"), v.text))
                f = c.find(M + "f")
                if f is not None and f.get("t") == "array":
                    b = box(f.get("ref") or c.get("r"))
                    if (b[0], b[1]) != rc: self.problems.append("%s: %s array ref %s does not start there" % (name, c.get("r"), f.get("ref")))
                if c.get("cm") is not None and not (1 <= int(c.get("cm")) <= self.ncm): self.problems.append("%s: %s cm=%s with %d cell metadata" % (name, c.get("r"), c.get("cm"), self.ncm))
                cells[c.get("r")] = c
        merges = [m.get("ref") for m in ws.iter(M + "mergeCell")]
        boxes = []
        for m in merges:
            b = box(m)
            if b[0] == b[2] and b[1] == b[3]: self.problems.append("%s: merge %s is one cell" % (name, m))
            for o, ob in boxes:
                if not (b[2] < ob[0] or ob[2] < b[0] or b[3] < ob[1] or ob[3] < b[1]): self.problems.append("%s: merges %s and %s overlap" % (name, o, m))
            boxes.append((m, b))
        self.sheets_cells = getattr(self, "sheets_cells", {}); self.sheets_cells[name] = cells
        self.merges = getattr(self, "merges", {}); self.merges[name] = merges

    def cell(self, ref, sheet=None):
        name = sheet or (self.order[0] if self.order else None)
        return (getattr(self, "sheets_cells", {}).get(name) or {}).get(ref)

    def cached(self, c):
        v = c.find(M + "v"); t = c.get("t") or "n"
        if t == "inlineStr": return "".join(x.text or "" for x in c.iter(M + "t"))
        if v is None or v.text is None: return None
        if t == "s": return self.sst[int(v.text)]
        if t in ("str", "e"): return v.text
        if t == "b": return v.text in ("1", "true")
        try: return float(v.text)
        except ValueError: return v.text


# Excel's least number of arguments, for the functions Lantern lets a person leave short (read from Excel's own
# function help); a formula with fewer is one Excel cannot read
EXCEL_MIN_ARGS = {"ROUND": 2, "ROUNDUP": 2, "ROUNDDOWN": 2, "FLOOR": 2, "CEILING": 2, "IF": 2, "SUM": 1, "POWER": 2, "MOD": 2, "MAX": 1, "MIN": 1, "AND": 1}
NOT_EXCEL = {"GAMMAFN"}   # a function Excel does not have is read (it shows #NAME?); Lantern's own name for Excel's GAMMA is not


def readable(f):
    """why Excel could not read formula f, or None"""
    for m in re.finditer(r"([A-Z][A-Z0-9.]*)\(", f):
        name = m.group(1); i = m.end(); depth = 1; n = 0; seen = False; q = False
        while i < len(f) and depth:
            ch = f[i]
            if ch == '"': q = not q
            elif not q:
                if ch in "({": depth += 1
                elif ch in ")}": depth -= 1
                elif ch == "," and depth == 1: n += 1
            if depth and not ch.isspace(): seen = True
            i += 1
        argc = n + 1 if seen or n else 0
        if name in NOT_EXCEL: return name + " is not Excel's"
        if name in EXCEL_MIN_ARGS and argc < EXCEL_MIN_ARGS[name]: return "%s with %d argument%s" % (name, argc, "" if argc == 1 else "s")
    return None


# ---------------------------------------------------------------------------------------------------------------
LO_NEED = {}   # file -> set of refs


def lo_refs(c):
    e = c["expected"]
    return set(e.get("lo", {})) | set(e.get("lo_shown", {})) | set(e.get("lo_shown_re", {})) | set(e.get("lo_kind", {}))


for c in todo:
    g = GOT.get(c["id"]) or {}
    if g.get("file"):
        LO_NEED[g["file"]] = lo_refs(c) | {"A1"}
LO = {}
if OFFICE is not None:
    for f, refs in LO_NEED.items():
        try: LO[f] = OFFICE.cells(os.path.join(tmp, f), sorted(refs))
        except Exception as e: LO[f] = {"__error__": str(e)}


def judge(c, g):
    """-> list of reasons it disagrees ([] agrees), list of notes"""
    e = c["expected"]; why = []; info = []
    if g is None: return ["not run"], info
    if g.get("crash"): return ["crashed: " + short(g["crash"])], info
    if g.get("page_errors"): info.append("page errors: " + short(g["page_errors"]))
    tol = e.get("tol", 1e-9)
    k = c["kind"]
    if k == "calc":
        if not same(e["value"], g.get("value"), tol): why.append("calculator gives %s, wants %s" % (short(g.get("value")), short(e["value"])))
    if k == "shown":
        if g.get("text") != e["text"]: why.append("shows %s, Excel %s" % (short(g.get("text")), short(e["text"])))
    if k == "grammar":
        if g.get("crash"): why.append("crashed")
        elif "ok_or_fixed" in e:
            if g.get("ok") and g.get("f") != e["ok_or_fixed"]: why.append("passed as %s, which Excel cannot read (wants %s, or refused)" % (short(g.get("f")), e["ok_or_fixed"]))
        else:
            if "ok" in e and bool(g.get("ok")) != e["ok"]: why.append("ok=%s, wants %s%s" % (g.get("ok"), e["ok"], (" (" + short(g.get("f"), 60) + ")") if g.get("ok") else " (" + str(g.get("why")) + ")"))
            if e.get("ok") and g.get("ok"):
                if "f" in e and g.get("f") != e["f"]: why.append("writes %s, wants %s" % (short(g.get("f")), short(e["f"])))
                for fl in ("wide", "array"):
                    if fl in e and bool(g.get(fl)) != e[fl]: why.append("%s=%s" % (fl, g.get(fl)))
                if "sheets" in e and g.get("sheets") != e["sheets"]: why.append("sheets %s" % g.get("sheets"))
                if "clash" in e and g.get("clash") != e["clash"]: why.append("clash %s" % g.get("clash"))
    # values worked out (compute, read)
    for ref, want in (e.get("values") or {}).items():
        have = (g.get("values") or {}).get(ref, "MISSING")
        if not same(want, have, tol): why.append("%s is %s, Excel %s" % (ref, short(have, 40), short(want, 40)))
    for ref, want in (e.get("raw") or {}).items():
        have = (g.get("raw") or {}).get(ref, "MISSING")
        if have != want: why.append("%s reads as %s, wants %s" % (ref, short(have, 50), short(want, 50)))
    for ref, want in (e.get("arrays") or {}).items():
        have = (g.get("arrays") or {}).get(ref)
        if have != want: why.append("%s kept as array %s, wants %s" % (ref, have, want))
    for ref, want in (e.get("shown") or {}).items():
        have = (g.get("shown") or {}).get(ref, "MISSING")
        if have != want: why.append("the grid shows %s as %s, Excel %s" % (ref, short(have, 40), short(want, 40)))
    for ref, want in (e.get("shown_re") or {}).items():
        have = (g.get("shown") or {}).get(ref) or ""
        if not re.search(want, have): why.append("the grid shows %s as %s" % (ref, short(have, 40)))
    if "sheet_names" in e and g.get("sheet_names") != e["sheet_names"]: why.append("sheets %s" % g.get("sheet_names"))
    notes = " | ".join([" | ".join(g.get("notes") or []), g.get("note") or "", g.get("save_note") or "", " | ".join(g.get("alerts") or []), g.get("error") or ""])
    for rx in e.get("notes_has", []):
        if not re.search(rx, notes): why.append("no note matching /%s/" % rx)
    for rx in e.get("notes_not", []):
        m = re.search(rx, notes)
        if m: why.append("a note says %s" % short(notes[max(0, m.start() - 60):m.end() + 80], 160))
    if "notes_count_max" in e and len(g.get("notes") or []) > e["notes_count_max"]:
        why.append("%d notes (%s ...)" % (len(g.get("notes") or []), short((g.get("notes") or [""])[-1], 90)))
    for rx in e.get("alert_has", []):
        if not re.search(rx, " ".join(g.get("alerts") or []) + " " + (g.get("error") or "")): why.append("no message matching /%s/ (alerts %s)" % (rx, short(g.get("alerts"))))
    if k == "read" and g.get("error") and not e.get("alert_has"): why.append("could not read: " + short(g["error"]))
    if k == "import" and not g.get("made") and not e.get("alert_has"): why.append("nothing opened: " + short(g.get("alerts")))
    for t in g.get("trace") or []:
        if t.get("crash"): why.append("step %s crashed: %s" % (t.get("step"), short(t["crash"])))
    # the grid's steps
    for chk in e.get("checks", []):
        t = next((x for x in g.get("trace") or [] if x.get("step") == chk["step"]), None)
        if t is None: why.append("no check at step %d" % chk["step"]); continue
        if "range" in chk and t.get("range") != chk["range"]: why.append("selection %s, Excel %s" % (t.get("range"), chk["range"]))
        if "active" in chk and t.get("active") != chk["active"]: why.append("active cell %s, Excel %s" % (t.get("active"), chk["active"]))
        for m in chk.get("merges_has", []):
            if m not in (t.get("merges") or []): why.append("no merge %s (merges %s)" % (m, t.get("merges")))
        for m in chk.get("merges_not", []):
            if m in (t.get("merges") or []): why.append("merge %s still there" % m)
        for ref, want in (chk.get("cells") or {}).items():
            if (t.get("cells") or {}).get(ref) != want: why.append("%s holds %s, wants %s" % (ref, short((t.get("cells") or {}).get(ref), 30), short(want, 30)))
        if chk.get("no_overlap"):
            bs = [(m, box(m)) for m in t.get("merges") or []]
            for i in range(len(bs)):
                for j in range(i):
                    a, b = bs[i][1], bs[j][1]
                    if not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1]): why.append("merges %s and %s overlap" % (bs[i][0], bs[j][0]))
    # the saved file
    f = g.get("file")
    needs_file = any(x in e for x in ("lo", "lo_shown", "lo_shown_re", "lo_kind", "xml", "parts", "cached", "file_sheets", "merges_file", "xml_readable"))
    if needs_file and not f: why.append("no file was saved"); return why, info
    if f:
        bk = Book(os.path.join(tmp, f))
        for p in bk.problems: why.append("file: " + p)
        if openpyxl is not None:
            try: openpyxl.load_workbook(os.path.join(tmp, f))
            except Exception as ex: why.append("file: openpyxl cannot open it: %s" % short(str(ex)))
        lv = LO.get(f)
        if OFFICE is not None and (lv is None or lv.get("__error__")): why.append("file: LibreOffice cannot open it: %s" % (lv or {}).get("__error__"))
        if "file_sheets" in e and bk.order != e["file_sheets"]: why.append("the file's sheets are %s" % bk.order)
        for x in e.get("xml", []):
            ce = bk.cell(x["cell"], x.get("sheet"))
            where = (x.get("sheet") + "!" if x.get("sheet") else "") + x["cell"]
            if ce is None: why.append("%s is not in the file" % where); continue
            fe = ce.find(M + "f")
            if x.get("no_f") and fe is not None: why.append("%s saved as the formula %s" % (where, short(fe.text, 50)))
            if "f" in x and (fe is None or (fe.text or "") != x["f"]): why.append("%s saved as %s, wants %s" % (where, short(fe.text if fe is not None else "no formula", 60), short(x["f"], 60)))
            for a, v in (x.get("attrs") or {}).items():
                have = ce.get(a) if a == "cm" else (fe.get(a) if fe is not None else None)
                if have != v: why.append("%s %s=%s, wants %s" % (where, a, have, v))
            for a in x.get("attrs_not", []):
                if (ce.get(a) if a == "cm" else (fe.get(a) if fe is not None else None)) is not None: why.append("%s has %s" % (where, a))
        for p in e.get("parts", []):
            if p not in bk.names: why.append("no part %s" % p)
        for ref, want in (e.get("cached") or {}).items():
            ce = bk.cell(ref)
            have = bk.cached(ce) if ce is not None else "MISSING"
            if not same(want, have, tol): why.append("%s saved beside its formula as %s, Excel %s" % (ref, short(have, 30), short(want, 30)))
        for ref in e.get("xml_readable", []):
            ce = bk.cell(ref); fe = ce.find(M + "f") if ce is not None else None
            if fe is not None and readable(fe.text or ""): why.append("%s saved as %s: %s, which Excel cannot read" % (ref, fe.text, readable(fe.text)))
        if "merges_file" in e:
            have = sorted((getattr(bk, "merges", {}) or {}).get(bk.order[0] if bk.order else "", []))
            if have != sorted(e["merges_file"]): why.append("the file's merges are %s" % have)
        if lv and not lv.get("__error__"):
            for ref, want in (e.get("lo") or {}).items():
                o = lv.get(ref) or {}
                if not same(want, o.get("v"), tol): why.append("in LibreOffice %s is %s, Excel %s" % (ref, short(o.get("v"), 30), short(want, 30)))
            for ref, want in (e.get("lo_shown") or {}).items():
                o = lv.get(ref) or {}
                if o.get("s") != want: why.append("LibreOffice shows %s as %s, Excel %s" % (ref, short(o.get("s"), 30), short(want, 30)))
            for ref, want in (e.get("lo_shown_re") or {}).items():
                o = lv.get(ref) or {}
                if not re.search(want, o.get("s") or ""): why.append("LibreOffice shows %s as %s" % (ref, short(o.get("s"), 30)))
            for ref, want in (e.get("lo_kind") or {}).items():
                o = lv.get(ref) or {}
                if o.get("kind") != want: why.append("%s is %s in the file, Excel %s" % (ref, (o.get("kind") or "?").lower(), want.lower()))
    return why, info


def compact(g):
    if not isinstance(g, dict): return g
    out = {}
    for k, v in g.items():
        if k in ("ms",): continue
        if isinstance(v, str) and len(v) > 400: v = v[:400] + "..."
        if k == "notes" and isinstance(v, list): v = [x[:300] for x in v[:12]]
        out[k] = v
    return out


agree = disagree = 0
lines = []
for c in todo:
    g = GOT.get(c["id"])
    why, info = judge(c, g)
    ok = not why
    if ok: agree += 1
    else: disagree += 1
    c["agree"] = ok
    c["lantern_got"] = compact(g)
    if ok: lines.append("AGREE %s%s" % (c["id"], " (judged %s on 1.24.28; now agrees)" % c["harm"] if c.get("harm") else ""))
    else: lines.append("DISAGREE %s %s%s [%s]" % (c["id"], "; ".join(why[:3]), " (+%d)" % (len(why) - 3) if len(why) > 3 else "", c.get("harm") or "unjudged"))
    if VERBOSE and (why or info): lines.append("    %s | %s" % (c["what"], "; ".join(why + info)))
print("\n".join(lines))

if ORACLE and OFFICE is not None:
    refs = [c["guard_cell"] for c in CASES if c.get("guard_cell") and not c.get("lo_skip")]
    vals = OFFICE.cells(os.path.join(FILES, "guard_lo.xlsx"), refs)
    off = []
    for c in CASES:
        if not c.get("guard_cell") or c.get("lo_skip"): continue
        want = c["expected"]["values"][c["guard_cell"]]; o = vals.get(c["guard_cell"]) or {}
        if not same(want, o.get("v"), 1e-9):
            off.append("%s %s: LibreOffice %s, expected %s%s" % (c["id"], c["input"]["cells"][c["guard_cell"]], o.get("v"), want, " -- known: " + c["lo_differs"] if c.get("lo_differs") else ""))
    print("ORACLE: LibreOffice agrees with %d of %d guard values expected here" % (len(refs) - len(off), len(refs)))
    for x in off: print("ORACLE-DIFFERS " + x)

if SKIPS: print("SKIPPED (not here): " + ", ".join(SKIPS))
print("%d cases: %d AGREE, %d DISAGREE" % (len(todo), agree, disagree))
by = {}
for c in todo:
    a = by.setdefault(c["group"], [0, 0]); a[0 if c["agree"] else 1] += 1
for gname in sorted(by, key=lambda s: int(s.split()[0])): print("  %-90s %3d agree, %3d disagree" % (gname, by[gname][0], by[gname][1]))
if RECORD:
    keep = {c["id"]: c for c in todo}
    full = [keep.get(c["id"], c) for c in CASES]
    json.dump(full, open(CASES_PATH, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
if OFFICE is not None: OFFICE.close()
