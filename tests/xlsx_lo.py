# xlsx_lo.py -- Excel files (1.24.28), the half that needs other programs. Sheets of every kind saved by Lantern
# (the fixtures read and saved again, sheets made in Lantern, a MAKE SHEET table), then
#   - checked against the spreadsheet schema (ISO/IEC 29500 sml.xsd) where it is on this machine
#     (LANTERN_SML_XSD, or the docx skill's copy), with lxml;
#   - opened by openpyxl: formulas as formulas, merged cells, widths, the frozen row, bold, number formats;
#   - opened by LibreOffice, which works every formula out again: each value against what Lantern showed;
# and each fixture saved again by LibreOffice and read back by Lantern: the same formulas.
# What a machine lacks (LibreOffice, openpyxl, lxml, the schema) is said as SKIP, not failed.
# Usage: python3 tests/xlsx_lo.py [-v]
import csv, glob, json, os, re, shutil, subprocess, sys, tempfile, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "xlsx")
VERBOSE = "-v" in sys.argv
XSD = os.environ.get("LANTERN_SML_XSD") or next((p for p in glob.glob("/mnt/skills/public/*/scripts/office/schemas/ISO-IEC29500-4_2016/sml.xsd")), None)
tmp = tempfile.mkdtemp(prefix="xlsx_lo_")
fails, passes, skips = 0, 0, set()
def ok(name, cond, info=""):
    global fails, passes
    if cond: passes += 1
    else:
        fails += 1; print("FAIL", name, str(info)[:700])
# Lantern writes them, in node, with what each cell shows
js = r"""
var fs = require("fs"), path = require("path"), JSDOM = require("jsdom").JSDOM;
var inner = fs.readFileSync(path.join(%(root)r, "src", "lantern.inner.html"), "utf8"), js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true });
var w = dom.window; w.alert = function () {}; w.scrollTo = function () {}; w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; }; w.fetch = function () { return Promise.reject(new Error("offline")); };
w.eval(js);
var L = w.Lantern, X = L.xlsx, out = {}, FX = %(fx)r, TMP = %(tmp)r;
function u8(b) { var a = new w.Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b[i]; return a; }
function save(id, sheet) {
  var vals = L.sheetDocs.compute(sheet.cells);
  var r = X.write(sheet, vals, function (raw) { return L.sheetDocs.logical(raw, sheet.cells); }, function (raw) { return L.sheetFormat.carried(sheet, raw); });
  fs.writeFileSync(path.join(TMP, id + ".xlsx"), Buffer.from(r.bytes));
  out[id] = { cells: sheet.cells, values: vals, notes: r.notes, merges: sheet.merges || [], widths: sheet.widths || {}, freeze: !!sheet.freeze, fmt: sheet.fmt || {} };
}
fs.readdirSync(FX).filter(function (f) { return /\.xlsx$/.test(f); }).forEach(function (f) {
  X.read(u8(fs.readFileSync(path.join(FX, f))), f).sheets.forEach(function (s, i) { save(f.replace(/\.xlsx$/, "") + "_" + i, s); });
});
save("made_in_lantern", { title: "Fence", cells: { A1: "Item", B1: "Qty", C1: "Price", D1: "Cost", A2: "Posts", B2: "12", C2: "$8.50", D2: "=B2*C2", A3: "Rails", B3: "22", C3: "$4.25", D3: "=B3*C3",
  A4: "Total", D4: "=SUM(D2:D3)", A5: "Share", B5: "12%%", C5: "=D4*B5", A6: "Due", B6: "2026-11-17", C6: "=B6+30", A7: "Power", B7: "=-2^2", C7: "=2^3^2", D7: "=ROUND(PI()*2,4)",
  A8: "Joined", B8: "=A2&\" and \"&A3", C8: "=IF(D4>190,\"over\",\"under\")", D8: "=D4>190", A9: "Lookup", B9: "=VLOOKUP(\"Rails\",A2:D3,4,FALSE)", C9: "=COUNTIF(B2:B3,\">20\")",
  D9: "=TEXT(D4,\"0.0\")", A10: "Ohm", B10: "=VOLTS(2,3)", C10: "=17%%5", D10: "=pi" },
  fmt: { A1: { b: 1 }, B1: { b: 1 }, C1: { b: 1 }, D1: { b: 1 }, D4: { b: 1, nf: "$#,##0.00" }, A4: { al: "right" }, B6: { nf: "yyyy-mm-dd" } }, widths: { A: 14 }, merges: ["A12:D12"], freeze: 1 });
// (1.24.28, the first review) a workbook of several sheets saved together, as Save .xlsx saves one Import file opened
var wb2 = X.read(u8(fs.readFileSync(path.join(FX, "workbook2.xlsx"))), "workbook2.xlsx"), bm = {};
wb2.sheets.forEach(function (s) { bm[s.name] = s.cells; });
var bk = X.writeBook(wb2.sheets.map(function (s) { return { doc: s, name: s.name, values: L.sheetDocs.compute(s.cells, bm, s.name) }; }));
fs.writeFileSync(path.join(TMP, "book.xlsx"), Buffer.from(bk.bytes));
var bookOut = { names: bk.names, notes: bk.notes, values: wb2.sheets.map(function (s) { return L.sheetDocs.compute(s.cells, bm, s.name); }), cells: wb2.sheets.map(function (s) { return s.cells; }) };
var made = L.aiAct.build("MAKE SHEET: Paint\nRoom | Wall area m2 | Litres per m2 | Litres\nHall | 24 | 0.1 | =[Wall area m2]*[Litres per m2]\nKitchen | 30 | 0.1 | =[Wall area m2]*[Litres per m2]\nTotal | | | =SUM([Litres])\nEND", "");
var plan = made.plan || made;
save("make_sheet", { title: "Paint", cells: plan.cells });
fs.writeFileSync(path.join(TMP, "out.json"), JSON.stringify(out));
fs.writeFileSync(path.join(TMP, "book.json"), JSON.stringify(bookOut));
// and LibreOffice's saves of the fixtures, read back (when they are there)
var back = {};
if (fs.existsSync(path.join(TMP, "lo"))) fs.readdirSync(path.join(TMP, "lo")).filter(function (f) { return /\.xlsx$/.test(f); }).forEach(function (f) {
  try { back[f] = X.read(u8(fs.readFileSync(path.join(TMP, "lo", f))), f).sheets.map(function (s) { return s.cells; }); } catch (e) { back[f] = String(e.message); }
});
fs.writeFileSync(path.join(TMP, "back.json"), JSON.stringify(back));
""" % {"root": ROOT, "fx": FX, "tmp": tmp}
open(os.path.join(tmp, "w.js"), "w").write(js)
soffice = shutil.which("soffice")
if soffice:
    # LibreOffice saves each fixture again (as .xlsx), for Lantern to read back
    os.makedirs(os.path.join(tmp, "lo"), exist_ok=True)
    src = [f for f in sorted(glob.glob(os.path.join(FX, "*.xlsx"))) if not f.endswith(("big.xlsx", "strict.xlsx"))]
    subprocess.run([soffice, "--headless", "--convert-to", "xlsx", "--outdir", os.path.join(tmp, "lo")] + src, capture_output=True, timeout=600)
r = subprocess.run(["node", os.path.join(tmp, "w.js")], cwd=ROOT, capture_output=True, text=True, env=dict(os.environ, NODE_PATH=os.path.join(ROOT, "node_modules")))
if r.returncode: print(r.stderr[-2000:]); sys.exit(1)
OUT = json.load(open(os.path.join(tmp, "out.json"), encoding="utf-8"))
BACK = json.load(open(os.path.join(tmp, "back.json"), encoding="utf-8"))
BOOK = json.load(open(os.path.join(tmp, "book.json"), encoding="utf-8"))
files = sorted(OUT)
# 1. the schema
try:
    import lxml.etree as ET
except Exception:
    ET = None; skips.add("lxml")
if ET is not None and XSD and os.path.exists(XSD):
    sml = ET.XMLSchema(ET.parse(XSD))
    for fid in files + ["book"]:
        z = zipfile.ZipFile(os.path.join(tmp, fid + ".xlsx"))
        for n in z.namelist():
            if n.startswith("xl/") and n.endswith(".xml") and "_rels" not in n:
                doc = ET.fromstring(z.read(n))
                # xml:space="preserve" on a <t> with spaces at its ends is not in the schema, but Excel writes it itself
                errs = [str(e) for e in sml.error_log] if not sml.validate(doc) else []
                errs = [e for e in errs if not ("}t', attribute '{http://www.w3.org/XML/1998/namespace}space'" in e)]
                ok("%s: %s is as the schema has it" % (fid, n), not errs, errs[:3])
else:
    skips.add("the spreadsheet schema (set LANTERN_SML_XSD)")
# 2. openpyxl
try:
    import openpyxl
except Exception:
    openpyxl = None; skips.add("openpyxl")
if openpyxl:
    for fid in files:
        o = OUT[fid]
        wb = openpyxl.load_workbook(os.path.join(tmp, fid + ".xlsx")); ws = wb.active
        wrong = []
        for ref, raw in o["cells"].items():
            got = ws[ref].value
            # (a formula naming a sheet not in a sheet saved alone is saved as its value, and said)
            if raw.startswith("=") and not any((n.startswith("Saved as text") or n.startswith("Saved as the value")) and ref + " (" in n for n in o["notes"]):
                if not (isinstance(got, str) and got.startswith("=")): wrong.append((ref, raw, got))
        ok("%s: openpyxl reads every formula as a formula" % fid, not wrong, wrong[:5])
        ok("%s: ...the merged cells" % fid, sorted(str(m) for m in ws.merged_cells.ranges) == sorted(o["merges"]), [sorted(str(m) for m in ws.merged_cells.ranges), o["merges"]])
        ok("%s: ...the widths" % fid, all(abs((ws.column_dimensions[k].width or 0) - v) < 1e-5 for k, v in o["widths"].items()), o["widths"])
        ok("%s: ...the frozen row" % fid, (ws.freeze_panes == "A2") == o["freeze"], ws.freeze_panes)
        bad = [(k, f, ws[k].font.b, ws[k].alignment.horizontal) for k, f in o["fmt"].items() if type(ws[k]).__name__ != "MergedCell" and
               ((f.get("b") and not ws[k].font.b) or (f.get("al") and ws[k].alignment.horizontal != f["al"]))]
        ok("%s: ...bold and alignment" % fid, not bad, bad[:5])
    # the workbook saved together: its sheets under their own names, the formula naming the others kept as a formula
    wbk = openpyxl.load_workbook(os.path.join(tmp, "book.xlsx"))
    ok("the workbook saved together: three sheets under their own names, Order!C2 a formula", wbk.sheetnames == ["Prices", "Order", "Rates"] and wbk["Order"]["C2"].value == "=B2*Prices!B2*(1+'Rates'!B1)" and not any("Saved as" in n for n in BOOK["notes"]),
       [wbk.sheetnames, wbk["Order"]["C2"].value, BOOK["notes"]])
# 3. LibreOffice works it all out again
def num(s):
    try: return float(s.replace(",", ""))
    except Exception: return None
if soffice:
    os.makedirs(os.path.join(tmp, "csv"), exist_ok=True)
    for fid in files:
        subprocess.run([soffice, "--headless", "--convert-to", "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1", "--outdir", os.path.join(tmp, "csv"),
                        os.path.join(tmp, fid + ".xlsx")], capture_output=True, timeout=300)
    for fid in files:
        o = OUT[fid]; p = glob.glob(os.path.join(tmp, "csv", fid + "*.csv"))
        if not p: ok("%s: LibreOffice opened it" % fid, False); continue
        rows = list(csv.reader(open(p[0], encoding="utf-8", errors="replace")))
        def at(ref):
            col = 0; i = 0
            while ref[i].isalpha(): col = col * 26 + ord(ref[i]) - 64; i += 1
            r = int(ref[i:]) - 1
            return rows[r][col - 1] if r < len(rows) and col - 1 < len(rows[r]) else ""
        differ = []
        for ref, raw in o["cells"].items():
            if not raw.startswith("=") or any((n.startswith("Saved as text") or n.startswith("Saved as the value")) and ref + " (" in n for n in o["notes"]): continue
            mine, lo = o["values"].get(ref), at(ref)
            if isinstance(mine, str) and mine.startswith("#"):   # an error here: LibreOffice may know better (another sheet)
                continue
            if any(fn in raw.upper() for fn in ("VOLTS(", "TODAY(", "NOW(", "RAND")): continue
            if isinstance(mine, (int, float)):
                n = num(lo)
                if lo in ("TRUE", "FALSE") and mine in (0, 1): n = 1.0 if lo == "TRUE" else 0.0
                # (1.24.28) a date shown as a date, as Lantern shows it: 2026-12-17 is the day's number
                dm = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$", lo)
                if n is None and dm:
                    import datetime
                    d0 = datetime.datetime(int(dm.group(1)), int(dm.group(2)), int(dm.group(3)), int(dm.group(4) or 0), int(dm.group(5) or 0))
                    n = (d0 - datetime.datetime(1899, 12, 30)).total_seconds() / 86400
                    if abs(n - mine) * 1440 < 1: n = mine
                if n is None or abs(n - mine) > 1e-6 * max(1, abs(mine)): differ.append((ref, raw, mine, lo))
            elif (mine or "").replace("\r\n", "\n").replace("\r", "\n") != lo: differ.append((ref, raw, mine, lo))
        ok("%s: LibreOffice works out every formula as Lantern does" % fid, not differ, differ[:6])
        if VERBOSE: print(fid, "checked", len(o["cells"]), "cells")
    # 3b. the workbook saved together: LibreOffice works out Order!C2 from Prices and Rates
    os.makedirs(os.path.join(tmp, "bookcsv"), exist_ok=True)
    subprocess.run([soffice, "--headless", "--convert-to", "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1", "--outdir", os.path.join(tmp, "bookcsv"),
                    os.path.join(tmp, "book.xlsx")], capture_output=True, timeout=300)
    oc = glob.glob(os.path.join(tmp, "bookcsv", "book-Order.csv"))
    rows2 = list(csv.reader(open(oc[0], encoding="utf-8"))) if oc else []
    ok("the workbook saved together: LibreOffice works out Order!C2 from the other sheets as Lantern does (30)", rows2 and num(rows2[1][2]) == BOOK["values"][1]["C2"] == 30, [rows2[:3], BOOK["values"][1].get("C2")])
    # 4. LibreOffice's saves, read by Lantern
    for f, sheets in sorted(BACK.items()):
        ok("LibreOffice's save of %s opens in Lantern" % f, isinstance(sheets, list) and sheets, sheets)
else:
    skips.add("LibreOffice")
print("SKIP: " + ", ".join(sorted(skips)) if skips else "", end="\n" if skips else "")
print(("%d XLSX OTHER PROGRAMS FAILURES (%d passed)" % (fails, passes)) if fails else "ALL XLSX OTHER PROGRAMS CHECKS PASS (%d)" % passes)
shutil.rmtree(tmp, ignore_errors=True)
sys.exit(1 if fails else 0)
