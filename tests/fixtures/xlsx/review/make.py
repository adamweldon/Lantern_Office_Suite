# make.py -- the files of the first review of Excel files in Lantern (1.24.28). Run from anywhere:
#   python3 tests/fixtures/xlsx/review/make.py
# Each file is an ordinary workbook a person could have: a household budget, a parts list, a timesheet, a loan table,
# dates, money, merged titles, frozen panes, names, several sheets, shared and array formulas, and the rest. They are
# made four ways, as people's files are:
#   - XlsxWriter (its files look like Excel's own). Excel saves the values it worked out beside each formula, so each
#     XlsxWriter file is made twice: once bare, then LibreOffice works every formula out, and the file is made again
#     with those values saved beside the formulas (as Excel would have saved them). pythonexport_zero.xlsx is left
#     with XlsxWriter's own 0s, as a Python report writer leaves them;
#   - openpyxl (no values saved beside formulas: Excel works them out when it opens the file);
#   - by hand, in Excel's own XML (shared formulas, array formulas, dynamic arrays, booleans and errors, "" from
#     formulas, quote prefixes, numbers as Excel writes them);
#   - LibreOffice, from a flat ODF spreadsheet (.fods), from an .ods it made, and from a .csv.
# Needs: python3, xlsxwriter, openpyxl, LibreOffice with python3-uno (lo.py).
import datetime, os, re, struct, sys, zlib, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "files")
sys.path.insert(0, HERE)
import lo  # noqa: E402
import xlsxwriter  # noqa: E402
import openpyxl  # noqa: E402
from openpyxl.styles import Font, Alignment  # noqa: E402
from openpyxl.comments import Comment  # noqa: E402

os.makedirs(OUT, exist_ok=True)
OFFICE = None


def office():
    global OFFICE
    if OFFICE is None: OFFICE = lo.Office()
    return OFFICE


def P(name): return os.path.join(OUT, name)


# ---------------------------------------------------------------------------------------------------------------
# XlsxWriter, made twice (values from LibreOffice saved beside the formulas the second time)
# ---------------------------------------------------------------------------------------------------------------
# where LibreOffice 24.2 works a formula out otherwise than Excel, Excel's value (what Excel saves and shows)
EXCEL = {
    ("functions.xlsx", "Sales", "L9"): 45, ("functions.xlsx", "Sales", "L10"): "none", ("functions.xlsx", "Sales", "L22"): 6,   # XLOOKUP, XMATCH: not in LibreOffice 24.2
    ("functions.xlsx", "Sales", "I17"): "A1TRUE",          # Excel's CONCAT writes TRUE as TRUE; LibreOffice writes 1
    ("functions.xlsx", "Sales", "I24"): "($1,234.57)",     # Excel's DOLLAR in English (US) puts a negative in brackets
    ("unicode.xlsx", "Donn\u00e9es \u20ac", "B8"): 15,     # Excel counts the wrench (one character outside the BMP) as 2
    ("table.xlsx", "Paint", "B6"): 22, ("table.xlsx", "Paint", "D6"): 217.5,   # the total row: LibreOffice reads [Qty] as a name
    ("table.xlsx", "Paint", "D2"): 63, ("table.xlsx", "Paint", "D3"): 90, ("table.xlsx", "Paint", "D4"): 22.5, ("table.xlsx", "Paint", "D5"): 42,
    ("table.xlsx", "Paint", "G1"): 15.12, ("table.xlsx", "Paint", "G2"): 217.5,   # a table's own formulas, as Excel works them out
}


class XW:
    """build(b) writes the workbook with b.wb; b.f(ws, ref, formula, fmt) writes a formula with the value Excel saves"""
    def __init__(self, name, build, opts=None, values=True):
        self.name, self.build, self.opts = name, build, dict(opts or {})
        self.vals = None
        self._make()
        if values:
            got = office().read(P(name))
            self.vals = {s: {r: e for r, e in c.items() if "f" in e} for s, c in got["cells"].items()}
            self._make()

    def _make(self):
        self.wb = xlsxwriter.Workbook(P(self.name), self.opts)
        self.wb.set_properties({"title": "", "author": "Review", "created": datetime.datetime(2026, 11, 18, 9, 0, 0)})
        self.build(self)
        self.wb.close()
        # XlsxWriter saves "" from a formula as <v></v> with no type; Excel saves it as t="str"
        path = P(self.name); z = zipfile.ZipFile(path); items = [(i, z.read(i.filename)) for i in z.infolist()]; z.close()
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as out:
            for info, data in items:
                if info.filename.startswith("xl/worksheets/sheet"):
                    data = re.sub(rb'(<c r="[A-Z]+[0-9]+"(?: s="[0-9]+")?)>(<f>[^<]*</f><v></v>)', rb'\1 t="str">\2', data)
                out.writestr(info, data)

    def f(self, ws, ref, formula, fmt=None, array=None, dynamic=False):
        v = None
        if self.vals is not None or (self.name, ws.get_name(), ref) in EXCEL:
            e = (self.vals or {}).get(ws.get_name(), {}).get(ref)
            if (self.name, ws.get_name(), ref) in EXCEL: e = {"v": EXCEL[(self.name, ws.get_name(), ref)], "k": "fixed"}
            if e:
                v = e["v"]
                if e["k"] == "num" and float(v).is_integer() and abs(v) < 1e15: v = int(v)
        if array:
            if dynamic: ws.write_dynamic_array_formula(array, formula, fmt, v if v is not None else 0)
            else: ws.write_array_formula(array, formula, fmt, v if v is not None else 0)
        elif v is None: ws.write_formula(ref, formula, fmt)
        else: ws.write_formula(ref, formula, fmt, v)


def png_1x1():
    raw = b"\x00\xff\x80\x00"
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


# ---- 1. a household budget: merged title, money, per cent, red negatives, two rows frozen, widths ----
def budget(b):
    wb = b.wb; ws = wb.add_worksheet("Budget")
    title = wb.add_format({"bold": True, "font_size": 14, "align": "center", "valign": "vcenter"})
    hdr = wb.add_format({"bold": True, "bottom": 1, "align": "center", "text_wrap": True})
    money = wb.add_format({"num_format": "$#,##0.00"})
    red = wb.add_format({"num_format": "$#,##0.00;[Red]-$#,##0.00"})
    pct = wb.add_format({"num_format": "0.0%"})
    bmoney = wb.add_format({"num_format": "$#,##0.00", "bold": True, "top": 1})
    bred = wb.add_format({"num_format": "$#,##0.00;[Red]-$#,##0.00", "bold": True, "top": 1})
    bpct = wb.add_format({"num_format": "0.0%", "bold": True, "top": 1})
    bold = wb.add_format({"bold": True})
    ws.merge_range("A1:E1", "Household Budget — November 2026", title)
    for i, h in enumerate(["Category", "Budgeted", "Actual", "Difference", "Share of spending"]): ws.write(1, i, h, hdr)
    rows = [("Rent", 1200, 1200), ("Groceries", 450, 512.37), ("Utilities", 180, 164.20), ("Transport", 220, 241.85),
            ("Insurance", 135, 135), ("Phone & internet", 95, 99.99), ("Savings", 400, 400), ("Fun", 150, 87.50)]
    for i, (k, bud, act) in enumerate(rows):
        r = i + 3
        ws.write("A%d" % r, k); ws.write_number("B%d" % r, bud, money); ws.write_number("C%d" % r, act, money)
        b.f(ws, "D%d" % r, "=B%d-C%d" % (r, r), red); b.f(ws, "E%d" % r, "=C%d/$C$11" % r, pct)
    ws.write("A11", "Total", bold)
    b.f(ws, "B11", "=SUM(B3:B10)", bmoney); b.f(ws, "C11", "=SUM(C3:C10)", bmoney); b.f(ws, "D11", "=SUM(D3:D10)", bred); b.f(ws, "E11", "=SUM(E3:E10)", bpct)
    ws.write("A13", "Income"); ws.write_number("B13", 4200, money)
    ws.write("A14", "Left over", bold); b.f(ws, "B14", "=B13-C11", wb.add_format({"num_format": "$#,##0.00;[Red]-$#,##0.00", "bold": True}))
    ws.write("A15", "Savings rate"); b.f(ws, "B15", "=(C9+B14)/B13", pct)
    ws.set_column("A:A", 22); ws.set_column("B:E", 13)
    ws.freeze_panes(2, 0)


# ---- 2. a parts list: VLOOKUP exact and by bands, INDEX/MATCH, IFERROR, a number and a 0-led text part number ----
def parts(b):
    wb = b.wb; ws = wb.add_worksheet("Order")
    bold = wb.add_format({"bold": True}); money = wb.add_format({"num_format": "$#,##0.00"}); pct = wb.add_format({"num_format": "0%"})
    for i, h in enumerate(["Part no.", "Description", "Qty", "Unit price", "Line total", "Discount", "Net"]): ws.write(0, i, h, bold)
    cat = [("BRG-6204", "Deep groove ball bearing 6204-2RS", 4.85), ("BRG-6205", "Deep groove ball bearing 6205-2RS", 5.60),
           ("SEAL-35", "Oil seal 35x52x7", 2.15), (10045, "Hydraulic fitting 1/4 NPT", 3.40), ("00731", "Shim pack 0.05 mm", 7.25),
           ("VB-A42", "V-belt A42", 9.99), ("FLT-HY10", "Hydraulic filter 10 micron", 24.50)]
    for i, h in enumerate(["Part no.", "Description", "Price"]): ws.write(0, 8 + i, h, bold)
    for i, (p, dsc, pr) in enumerate(cat):
        if isinstance(p, str): ws.write_string(i + 1, 8, p)
        else: ws.write_number(i + 1, 8, p)
        ws.write_string(i + 1, 9, dsc); ws.write_number(i + 1, 10, pr, money)
    ws.write("M1", "Qty from", bold); ws.write("N1", "Discount", bold)
    for i, (q, d) in enumerate([(0, 0), (10, 0.05), (25, 0.10), (50, 0.15)]): ws.write_number(i + 1, 12, q); ws.write_number(i + 1, 13, d, pct)
    order = [("BRG-6204", 12), ("SEAL-35", 40), (10045, 25), ("00731", 3), ("vb-a42", 6), ("FLT-HY12", 2)]
    for i, (p, q) in enumerate(order):
        r = i + 2
        if isinstance(p, str): ws.write_string("A%d" % r, p)
        else: ws.write_number("A%d" % r, p)
        ws.write_number("C%d" % r, q)
        b.f(ws, "B%d" % r, '=IFERROR(VLOOKUP(A%d,$I$2:$K$8,2,FALSE),"not in catalog")' % r)
        b.f(ws, "D%d" % r, "=IFERROR(VLOOKUP(A%d,$I$2:$K$8,3,FALSE),0)" % r, money)
        b.f(ws, "E%d" % r, "=C%d*D%d" % (r, r), money)
        b.f(ws, "F%d" % r, "=VLOOKUP(C%d,$M$2:$N$5,2,TRUE)" % r, pct)
        b.f(ws, "G%d" % r, "=E%d*(1-F%d)" % (r, r), money)
    ws.write("A9", "Total", bold); b.f(ws, "E9", "=SUM(E2:E7)", money); b.f(ws, "G9", "=SUM(G2:G7)", money)
    ws.write("A10", "Price of SEAL-35"); b.f(ws, "D10", '=INDEX($K$2:$K$8,MATCH("SEAL-35",$I$2:$I$8,0))', money)
    ws.write("A11", "Parts not found"); b.f(ws, "D11", '=COUNTIF(B2:B7,"not in catalog")')
    ws.set_column("A:A", 11); ws.set_column("B:B", 34); ws.set_column("J:J", 32)


# ---- 3. a timesheet: times, h:mm, [h]:mm over 24 hours, a night shift, decimal hours, pay ----
def timesheet(b):
    wb = b.wb; ws = wb.add_worksheet("Week 47")
    bold = wb.add_format({"bold": True}); day = wb.add_format({"num_format": "ddd m/d"}); tm = wb.add_format({"num_format": "h:mm AM/PM"})
    hm = wb.add_format({"num_format": "h:mm"}); big = wb.add_format({"num_format": "[h]:mm", "bold": True}); dec = wb.add_format({"num_format": "0.00"})
    money = wb.add_format({"num_format": "$#,##0.00"})
    for i, h in enumerate(["Day", "Start", "End", "Break", "Hours", "Decimal hours", "As text"]): ws.write(0, i, h, bold)
    T = datetime.time
    days = [(16, T(8, 30), T(17, 15), T(0, 30)), (17, T(7, 45), T(16, 30), T(0, 45)), (18, T(8, 0), T(18, 0), T(0, 30)),
            (19, T(9, 0), T(17, 30), T(1, 0)), (20, T(22, 0), T(6, 30), T(0, 30))]
    for i, (d, s, e, br) in enumerate(days):
        r = i + 2
        ws.write_datetime("A%d" % r, datetime.datetime(2026, 11, d), day)
        ws.write_datetime("B%d" % r, s, tm); ws.write_datetime("C%d" % r, e, tm); ws.write_datetime("D%d" % r, br, hm)
        b.f(ws, "E%d" % r, "=MOD(C%d-B%d,1)-D%d" % (r, r, r), hm)
        b.f(ws, "F%d" % r, "=E%d*24" % r, dec)
        b.f(ws, "G%d" % r, '=TEXT(E%d,"h:mm")' % r)
    ws.write("A7", "Total", bold); b.f(ws, "E7", "=SUM(E2:E6)", big); b.f(ws, "F7", "=SUM(F2:F6)", dec)
    ws.write("A8", "Overtime"); b.f(ws, "E8", "=MAX(0,E7-40/24)", big); b.f(ws, "F8", "=MAX(0,F7-40)", dec)
    ws.write("A9", "Pay rate"); ws.write_number("C9", 22.5, money)
    ws.write("A10", "Pay"); b.f(ws, "F10", "=F7*C9+F8*C9*0.5", money)
    ws.write("A11", "Start, typed as a sum"); b.f(ws, "B11", "=TIME(8,30,0)", tm); b.f(ws, "C11", "=HOUR(C2)"); b.f(ws, "D11", "=MINUTE(C2)")
    ws.set_column("A:A", 12); ws.set_column("B:C", 10)
    ws.freeze_panes(1, 0)


# ---- 5. dates in several formats, and date sums ----
def dates(b):
    wb = b.wb; ws = wb.add_worksheet("Dates")
    when = datetime.datetime(2026, 11, 17, 14, 30)
    forms = ["m/d/yyyy", "d-mmm-yy", "dddd, mmmm d, yyyy", "yyyy-mm-dd", "mmm-yy", "m/d/yyyy h:mm", "h:mm:ss AM/PM", "dd/mm/yyyy",
             "[$-409]mmmm d, yyyy;@", 14, "mmmm yyyy", "ddd", "d mmm yyyy"]
    ws.write("A1", "Format"); ws.write("B1", "17 Nov 2026 2:30 PM"); ws.write("C1", "Sum"); ws.write("D1", "Result")
    for i, f in enumerate(forms):
        ws.write(i + 1, 0, str(f)); ws.write_datetime(i + 1, 1, when, wb.add_format({"num_format": f}))
    md = wb.add_format({"num_format": "m/d/yyyy"}); hm = wb.add_format({"num_format": "h:mm"})
    sums = [("D2", "=B2+30", md), ("D3", "=EOMONTH(B2,0)", md), ("D4", "=WEEKDAY(B2)", None), ("D5", '=TEXT(B2,"dddd")', None),
            ("D6", '=DATEDIF(DATE(1990,5,20),B2,"y")', None), ("D7", "=NETWORKDAYS(DATE(2026,11,2),DATE(2026,11,30))", None),
            ("D8", "=EDATE(DATE(2026,1,31),1)", md), ("D9", '=YEAR(B2)&"-Q"&ROUNDUP(MONTH(B2)/3,0)', None), ("D10", "=DATE(2026,2,29)", md),
            ("D11", "=INT(B7)", md), ("D12", "=B7-INT(B7)", hm), ("D13", '=DATEVALUE("2026-11-17")', None),
            ("D14", "=_xlfn.DAYS(DATE(2026,12,25),DATE(2026,11,17))", None), ("D15", "=WORKDAY(DATE(2026,11,20),5)", md), ("D16", "=_xlfn.ISOWEEKNUM(B2)", None),
            ("D17", "=WEEKNUM(B2)", None), ("D18", "=DATE(2026,11,17)-DATE(2026,1,1)", None), ("D19", '=TEXT(B2,"yyyy-mm-dd")', None)]
    for ref, f, fm in sums:
        ws.write(ref.replace("D", "C"), f[1:]); b.f(ws, ref, f, fm)
    ws.set_column("A:A", 24); ws.set_column("B:B", 30); ws.set_column("C:C", 44); ws.set_column("D:D", 14)


# ---- 6. per cent ----
def percent(b):
    wb = b.wb; ws = wb.add_worksheet("Growth")
    p1 = wb.add_format({"num_format": "0.0%"}); money = wb.add_format({"num_format": "$#,##0.00"})
    for i, h in enumerate(["Item", "Last year", "This year", "Change", "Tax rate", "Price with tax", "Typed with %", "As a fraction"]): ws.write(0, i, h)
    data = [("Widgets", 1200, 1350, 0.075, 12.5), ("Gadgets", 800, 760, 0.08, 7.25), ("Gizmos", 0, 40, 0.0825, 100)]
    for i, (k, a, c, t, typed) in enumerate(data):
        r = i + 2
        ws.write("A%d" % r, k); ws.write_number("B%d" % r, a); ws.write_number("C%d" % r, c)
        b.f(ws, "D%d" % r, '=IFERROR((C%d-B%d)/B%d,"n/a")' % (r, r, r), p1)
        ws.write_number("E%d" % r, t, wb.add_format({"num_format": [p1.num_format, 9, 10][i] if i else "0.0%"}))
        b.f(ws, "F%d" % r, "=C%d*(1+E%d)" % (r, r), money)
        ws.write_number("G%d" % r, typed, wb.add_format({"num_format": '0.0"%"'}))
        b.f(ws, "H%d" % r, "=G%d/100" % r)
    ws.write("A6", "Average change"); b.f(ws, "D6", "=AVERAGE(D2:D3)", p1)
    ws.write("A7", "Share of last year"); b.f(ws, "B7", "=B2/SUM(B2:B4)", wb.add_format({"num_format": 10}))
    ws.write("A8", "Half of this"); b.f(ws, "B8", "=50%*C2")


# ---- 7. money: currency and accounting, negatives in brackets and red, pounds, euros, yen ----
def money(b):
    wb = b.wb; ws = wb.add_worksheet("Money")
    forms = ["$#,##0.00", 7, 8, 44, "£#,##0.00", "#,##0.00 [$€-407]", "[$¥-411]#,##0", "#,##0.00;[Red]-#,##0.00", '"$"#,##0', 5]
    ws.write("A1", "Format"); ws.write("B1", "1234.5"); ws.write("C1", "-1234.5"); ws.write("D1", "0")
    for i, f in enumerate(forms):
        fm = wb.add_format({"num_format": f})
        ws.write(i + 1, 0, str(f)); ws.write_number(i + 1, 1, 1234.5, fm); ws.write_number(i + 1, 2, -1234.5, fm); ws.write_number(i + 1, 3, 0, fm)
    ws.write("A13", "DOLLAR"); b.f(ws, "B13", "=DOLLAR(B2)"); b.f(ws, "C13", '=TEXT(C2,"$#,##0.00;($#,##0.00)")')
    ws.write("A14", "Sum"); b.f(ws, "B14", "=SUM(B2:B11)", wb.add_format({"num_format": 44}))
    ws.set_column("A:A", 30); ws.set_column("B:D", 16)


# ---- 9. frozen panes of five kinds ----
def frozen(b):
    wb = b.wb
    for name, how in [("Top row", (1, 0)), ("First column", (0, 1)), ("Both", (1, 1)), ("Two rows", (2, 0)), ("Split", None)]:
        ws = wb.add_worksheet(name)
        for r in range(30):
            ws.write(r, 0, "Row %d" % (r + 1) if r else "Name")
            for c in range(1, 8): ws.write(r, c, (r * 7 + c) if r else "Col %d" % c)
        if how: ws.freeze_panes(*how)
        else: ws.split_panes(60, 0)


# ---- 10. hidden rows and a hidden column, and the sums that leave hidden rows out ----
def hidden(b):
    wb = b.wb; ws = wb.add_worksheet("Stock")
    ws.write("A1", "Item"); ws.write("B1", "Amount"); ws.write("C1", "Bin")
    for i, (k, v) in enumerate([("Bolts", 10), ("Nuts", 20), ("Washers", 30), ("Old stock A", 40), ("Old stock B", 50), ("Pins", 60), ("Clips", 70), ("Rivets", 80)]):
        ws.write(i + 1, 0, k); ws.write_number(i + 1, 1, v); ws.write(i + 1, 2, "B%02d" % (i + 1))
    ws.set_row(4, None, None, {"hidden": True}); ws.set_row(5, None, None, {"hidden": True})
    ws.set_column("C:C", None, None, {"hidden": True})
    ws.write("A11", "SUM"); b.f(ws, "B11", "=SUM(B2:B9)")
    ws.write("A12", "SUBTOTAL 9 (every row)"); b.f(ws, "B12", "=SUBTOTAL(9,B2:B9)")
    ws.write("A13", "SUBTOTAL 109 (rows shown)"); b.f(ws, "B13", "=SUBTOTAL(109,B2:B9)")
    ws.write("A14", "AGGREGATE (rows shown)"); b.f(ws, "B14", "=_xlfn.AGGREGATE(9,5,B2:B9)")
    ws.write("A15", "Rows shown"); b.f(ws, "B15", "=SUBTOTAL(103,A2:A9)")


# ---- 11. wrapped text with line breaks ----
def wrapped(b):
    wb = b.wb; ws = wb.add_worksheet("Steps")
    wrap = wb.add_format({"text_wrap": True, "valign": "top"}); bold = wb.add_format({"bold": True})
    ws.write("A1", "Task", bold); ws.write("B1", "Instructions", bold); ws.write("C1", "Characters", bold)
    ws.write("A2", "Lock out"); ws.write("B2", "Isolate power at the main panel.\nLock out and tag.\nTest for absence of voltage.", wrap)
    ws.write("A3", "Filter"); ws.write("B3", "Change the hydraulic return filter when the gauge reads in the red band, or every 500 hours, whichever comes first.", wrap)
    b.f(ws, "C2", "=LEN(B2)"); b.f(ws, "C3", "=LEN(B3)")
    b.f(ws, "D2", '=LEFT(B2,FIND(CHAR(10),B2)-1)')
    ws.set_column("B:B", 40)


# ---- 12. comments ----
def comments(b):
    wb = b.wb; ws = wb.add_worksheet("Quote")
    ws.write("A1", "Item"); ws.write("B1", "Price"); ws.write("A2", "Pump seal kit"); ws.write_number("B2", 48.9)
    ws.write("A3", "Labour (hours)"); ws.write_number("B3", 3.5); ws.write("A4", "Total"); b.f(ws, "B4", "=B2+B3*65")
    ws.write_comment("B2", "Price from the supplier's quote of 2 October 2026; valid 30 days.")
    ws.write_comment("B3", "Ask Sam if the seal needs the press.")


# ---- 13. a chart and a picture ----
def chart(b):
    wb = b.wb; ws = wb.add_worksheet("Power")
    ws.write("A1", "Month"); ws.write("B1", "kWh")
    for i, (m, v) in enumerate([("Jun", 412), ("Jul", 530), ("Aug", 566), ("Sep", 444), ("Oct", 380), ("Nov", 402)]):
        ws.write(i + 1, 0, m); ws.write_number(i + 1, 1, v)
    ws.write("A8", "Total"); b.f(ws, "B8", "=SUM(B2:B7)")
    ch = wb.add_chart({"type": "column"})
    ch.add_series({"name": "kWh", "categories": "=Power!$A$2:$A$7", "values": "=Power!$B$2:$B$7"})
    ws.insert_chart("D2", ch)
    img = os.path.join(OUT, "_pixel.png")
    open(img, "wb").write(png_1x1())
    ws.insert_image("D20", img)


# ---- 14. conditional formatting ----
def condfmt(b):
    wb = b.wb; ws = wb.add_worksheet("Scores")
    ws.write_row(0, 0, ["Name", "Score", "Hours", "Rating", "Status"])
    rows = [("Ana", 95, 12, 4, "On time"), ("Ben", 58, 30, 2, "Late"), ("Cai", 77, 18, 3, "On time"), ("Dee", 88, 25, 5, "Late")]
    for i, r in enumerate(rows): ws.write_row(i + 1, 0, r)
    ws.write("A7", "Average"); b.f(ws, "B7", "=AVERAGE(B2:B5)")
    green = wb.add_format({"bg_color": "#C6EFCE"}); red = wb.add_format({"bg_color": "#FFC7CE"})
    ws.conditional_format("B2:B5", {"type": "cell", "criteria": ">", "value": 90, "format": green})
    ws.conditional_format("B2:B5", {"type": "cell", "criteria": "<", "value": 60, "format": red})
    ws.conditional_format("C2:C5", {"type": "data_bar"})
    ws.conditional_format("D2:D5", {"type": "3_color_scale"})
    ws.conditional_format("A2:E5", {"type": "formula", "criteria": '=$E2="Late"', "format": red})


# ---- 15. data validation (drop-down lists, whole numbers) ----
def validation(b):
    wb = b.wb; ws = wb.add_worksheet("Jobs")
    ws.write_row(0, 0, ["Job", "Status", "Priority (1-5)"])
    for i, r in enumerate([("Replace belt", "Open", 2), ("Bleed brakes", "Done", 1), ("Check relief valve", "In progress", 4)]): ws.write_row(i + 1, 0, r)
    ws.data_validation("B2:B20", {"validate": "list", "source": ["Open", "In progress", "Done"]})
    ws.data_validation("C2:C20", {"validate": "integer", "criteria": "between", "minimum": 1, "maximum": 5, "input_message": "1 is most urgent"})
    ws.write("A6", "Open jobs"); b.f(ws, "B6", '=COUNTIF(B2:B20,"Open")')


# ---- 16. names used in formulas: a cell, a range, a constant, a sheet's own ----
def names(b):
    wb = b.wb; ws = wb.add_worksheet("Invoice")
    pct = wb.add_format({"num_format": "0.00%"}); money = wb.add_format({"num_format": "$#,##0.00"})
    ws.write("A1", "Tax rate"); ws.write_number("B1", 0.0825, pct)
    ws.write("A2", "Shipping"); ws.write_number("B2", 12.5, money)
    ws.write("A4", "Item"); ws.write("B4", "Amount")
    for i, (k, v) in enumerate([("Gasket set", 120), ("Grease, 5 kg", 45.5), ("Labour", 300), ("Shop supplies", 18.25)]):
        ws.write(i + 4, 0, k); ws.write_number(i + 4, 1, v, money)
    wb.define_name("TaxRate", "=Invoice!$B$1")
    wb.define_name("Amounts", "=Invoice!$B$5:$B$8")
    wb.define_name("Discount", "=0.1")
    wb.define_name("Invoice!Shipping", "=Invoice!$B$2")
    for ref, lab, f in [("B10", "Subtotal", "=SUM(Amounts)"), ("B11", "Discount", "=B10*Discount"), ("B12", "Tax", "=(B10-B11)*TaxRate"),
                        ("B13", "Shipping", "=Shipping"), ("B14", "Total", "=B10-B11+B12+B13"), ("B15", "Total, rounded", "=ROUND(B14,2)"),
                        ("B16", "Lines", "=COUNT(Amounts)"), ("B17", "Largest", "=MAX(Amounts)")]:
        ws.write(ref.replace("B", "A"), lab); b.f(ws, ref, f, money if ref not in ("B16",) else None)


# ---- 17. several sheets that use each other ----
def crosssheet(b):
    wb = b.wb; money = wb.add_format({"num_format": "$#,##0.00"})
    for m, vals in [("Jan", [210, 95.5, 400, 32]), ("Feb", [180, 0, 360, 48.75]), ("Mar", [240, 130, 420, 0])]:
        ws = wb.add_worksheet(m); ws.write_row(0, 0, ["Expense", "Amount"])
        for i, (k, v) in enumerate(zip(["Fuel", "Parts", "Labour", "Tools"], vals)): ws.write(i + 1, 0, k); ws.write_number(i + 1, 1, v, money)
        ws.write("A6", "Total"); b.f(ws, "B6", "=SUM(B2:B5)", money)
    rs = wb.add_worksheet("Bob's rates"); rs.write("A1", "Markup"); rs.write_number("B1", 1.2)
    s = wb.add_worksheet("Summary"); s.write_row(0, 0, ["Month", "Spent"])
    for i, m in enumerate(["Jan", "Feb", "Mar"]): s.write(i + 1, 0, m); b.f(s, "B%d" % (i + 2), "=%s!B6" % m, money)
    s.write("A5", "Quarter"); b.f(s, "B5", "=SUM(B2:B4)", money)
    s.write("A6", "Fuel, quarter"); b.f(s, "B6", "=SUM(Jan:Mar!B2)", money)
    s.write("A7", "Average month"); b.f(s, "B7", "=AVERAGE(Jan!B6,Feb!B6,Mar!B6)", money)
    s.write("A8", "Jan billed"); b.f(s, "B8", "=Jan!B6*'Bob''s rates'!B1", money)
    s.write("A9", "Months over 700"); b.f(s, "B9", '=COUNTIF(B2:B4,">700")')
    s.activate()


# ---- 20. very long text ----
SENT = "Check the oil level with the engine off and the machine level; top up to the upper mark with the grade on the cap. "
def longtext(b):
    wb = b.wb; ws = wb.add_worksheet("Notes")
    a1 = (SENT * 40)[:3000]
    a2 = (SENT * 300)[:32767]
    ws.write_string("A1", a1); ws.write_string("A2", a2)
    b.f(ws, "B1", "=LEN(A1)"); b.f(ws, "B2", "=LEN(A2)"); b.f(ws, "C1", "=LEFT(A1,13)"); b.f(ws, "C2", "=RIGHT(A2,5)")


# ---- 21. text in many scripts, a sheet name with an accent and a euro ----
UNI = ["José Müller", "Zoë Ångström", "北京市朝阳区", "Ελληνικά",
       "עברית", "مرحبا بالعالم", "\U0001F527 Wrench 13 mm", "été",
       "Tab\there", "Café — “quoted” ½ °C ≤ Ω"]
def unicode_(b):
    wb = b.wb; ws = wb.add_worksheet("Données €")
    ws.write("A1", "Name"); ws.write("B1", "Length"); ws.write("C1", "Upper")
    for i, t in enumerate(UNI):
        ws.write_string(i + 1, 0, t); b.f(ws, "B%d" % (i + 2), "=LEN(A%d)" % (i + 2))
    b.f(ws, "C2", "=UPPER(A2)"); b.f(ws, "C3", "=LOWER(A3)"); b.f(ws, "D2", '=A2&" ✓"'); b.f(ws, "D3", '=IF(A4="北京市朝阳区","是","no")')


# ---- 22. numbers and other things stored as text ----
TEXTS = ["02134", "00731", "1,500", "3.50", "12%", "$5.00", "1e5", "TRUE", "-", "=5+5", "+44 20 7946 0958", "1/2", "2026-11-17", "3:30",
         "#N/A", "  42 ", "'quoted", "-5", "(42)", "50 %", "1 1/2"]
def textnums(b):
    wb = b.wb; ws = wb.add_worksheet("Codes")
    txt = wb.add_format({"num_format": "@"})
    ws.write("A1", "As text"); ws.write("C1", "Sum"); ws.write("D1", "Result")
    for i, t in enumerate(TEXTS): ws.write_string(i + 1, 0, t, txt)
    sums = [("=SUM(A2:A3)"), ("=A2+A3"), ("=VALUE(A4)"), ("=COUNT(A2:A22)"), ("=COUNTA(A2:A22)"), ("=ISTEXT(A2)"), ("=ISNUMBER(A5)"),
            ("=A5*2"), ("=LEN(A2)"), ("=A2=2134"), ("=A9=TRUE"), ("=A6*1"), ("=A7*1"), ("=A14+1"), ("=N(A2)"), ("=A2&A3")]
    for i, f in enumerate(sums):
        ws.write_string(i + 1, 2, f[1:]); b.f(ws, "D%d" % (i + 2), f)


# ---- 29. a table (ListObject) with a worked-out column and a total row ----
def table(b):
    wb = b.wb; ws = wb.add_worksheet("Paint")
    money = wb.add_format({"num_format": "$#,##0.00"})
    data = [["Primer", 2, 31.5], ["Wall paint", 4, 22.5], ["Brushes", 6, 3.75], ["Tape", 10, 4.2]]
    tv = {"B6": {"v": EXCEL[("table.xlsx", "Paint", "B6")]}, "D6": {"v": EXCEL[("table.xlsx", "Paint", "D6")]}}
    ws.add_table("A1:D6", {"name": "Orders", "data": data, "total_row": True, "columns": [
        {"header": "Item", "total_string": "Total"}, {"header": "Qty", "total_function": "sum", "total_value": tv.get("B6", {}).get("v", 0)}, {"header": "Price", "format": money},
        {"header": "Cost", "formula": "=[@Qty]*[@Price]", "format": money, "total_function": "sum", "total_value": tv.get("D6", {}).get("v", 0)}]})
    ws.write("F1", "Paint, litres"); b.f(ws, "G1", "=SUMIF(Orders[Item],\"*paint*\",Orders[Qty])*3.78")
    ws.write("F2", "All costs"); b.f(ws, "G2", "=SUM(Orders[Cost])", money)
    # XlsxWriter writes the column's formula in each row from the table; give each its value too (Excel's)
    for r in range(2, 6): b.f(ws, "D%d" % r, "=Orders[[#This Row],[Qty]]*Orders[[#This Row],[Price]]", money)


# ---- 31. number formats of other kinds ----
FORMS = [(0.75, "# ?/?", "3/4"), (1.5, "# ?/?", "1 1/2"), (12345, "0.00E+00", "1.23E+04"), (2134, "00000", "02134"),
         (5551234567, "[<=9999999]###-####;(###) ###-####", "(555) 123-4567"), (123456789, "000-00-0000", "123-45-6789"),
         (12500000, '#,##0.0,,"M"', "12.5M"), (0, '#,##0;(#,##0);"-"', "-"), (-42, '#,##0;(#,##0);"-"', "(42)"), (3.14159, "0.000", "3.142"),
         (1234.5, "#,##0", "1,235"), (0.5, "h:mm", "12:00"), (45, '0" kg"', "45 kg"), (7, '"Qty: "0', "Qty: 7"), (1.234, "0.0#", "1.23"),
         (1.2, "0.0#", "1.2"), (-3.5, "0.0;[Red]-0.0", "-3.5"), (0.000123, "0.00E+00", "1.23E-04"), (1048576, "#,##0", "1,048,576"),
         (0.0625, "# ??/??", "1/16"), (2.5, "0", "3"), (-2.5, "0", "-3"), (0.125, "0.00%", "12.50%")]
def formats(b):
    wb = b.wb; ws = wb.add_worksheet("Formats")
    ws.write("A1", "Code"); ws.write("B1", "Shown"); ws.write("C1", "Excel shows")
    for i, (v, f, shown) in enumerate(FORMS):
        ws.write_string(i + 1, 0, f); ws.write_number(i + 1, 1, v, wb.add_format({"num_format": f})); ws.write_string(i + 1, 2, shown)
    ws.set_column("A:A", 36); ws.set_column("B:C", 16)


# ---- 32. functions people use (math, text, lookups, sums with conditions, statistics, money) ----
FN_DATA = [("North", "Ann", "Bolts", 120), ("South", "Bob", "Nuts", 80), ("North", "Cy", "Nuts", 45), ("East", "Ann", "Bolts", 200),
           ("South", "Ann", "Washers", 15), ("North", "Bob", "Bolts", 60), ("East", "Cy", "Washers", 30)]
FN = {
    "F": ["=ROUND(2.675,2)", "=ROUND(1.005,2)", "=ROUND(-2.5,0)", "=ROUNDUP(3.2,0)", "=ROUNDDOWN(-3.7,0)", "=INT(-2.5)", "=TRUNC(-2.5)",
          "=MOD(-7,3)", "=MOD(7,-3)", "=MROUND(17,5)", "=CEILING(4.1,0.5)", "=FLOOR(4.9,0.5)", "=0.1+0.2=0.3", "=POWER(2,10)", "=SQRT(2)^2=2",
          "=QUOTIENT(-7,2)", "=ROUND(1234.5678,-2)", "=EVEN(3)", "=ODD(-2)", "=1-0.9", "=ROUND(0.285,2)", "=ROUNDUP(1.1-1,1)"],
    "I": ['=TRIM("  pump   seal  kit ")', "=PROPER(\"o'neil mcdonald-smith\")", '=SUBSTITUTE("a-b-c","-","/",2)', '=FIND("b","abcb",3)',
          '=SEARCH("B","abc")', '=MID("Hydraulic",3,4)', '=TEXT(1234.5,"$#,##0.00")', '=TEXT(0.256,"0.0%")', '=TEXT(DATE(2026,11,17),"mmm d, yyyy")',
          '=VALUE("1,234.5")', '=REPT("*",5)', '=EXACT("Bolt","bolt")', '="Bolt"="bolt"', '=LEFT("Washer",0)', '=_xlfn.TEXTJOIN(", ",TRUE,B2:B4)',
          '=_xlfn.CONCAT("A",1,TRUE)', '=1/3&""', '=CHAR(65)&CODE("a")', "=FIXED(1234.567,1)", '=LEN(" a ")', '=TEXT(-5,"0;(0)")',
          '=TEXT(46343.75,"h:mm AM/PM")', "=DOLLAR(-1234.567)", '=TEXT(1234.5,"#,##0")', '="Total: "&D2'],
    "L": ['=SUMIF(A2:A8,"North",D2:D8)', '=SUMIFS(D2:D8,A2:A8,"North",C2:C8,"Bolts")', '=COUNTIF(D2:D8,">=60")', '=COUNTIFS(B2:B8,"Ann",D2:D8,">100")',
          '=AVERAGEIF(C2:C8,"Nuts",D2:D8)', '=_xlfn.MAXIFS(D2:D8,A2:A8,"South")', '=_xlfn.MINIFS(D2:D8,B2:B8,"Ann")', '=_xlfn.XLOOKUP("Cy",B2:B8,D2:D8)',
          '=_xlfn.XLOOKUP("Zed",B2:B8,D2:D8,"none")', "=INDEX(A2:A8,MATCH(MAX(D2:D8),D2:D8,0))", '=HLOOKUP("Sales",A1:D8,3,FALSE)',
          '=LOOKUP(2,{1,2,3},{"one","two","three"})', '=COUNTIF(B2:B8,"a*")', '=SUMIF(C2:C8,"<>Nuts",D2:D8)', '=SUMPRODUCT((A2:A8="North")*(D2:D8))',
          '=_xlfn.IFS(L2>200,"high",L2>100,"mid",TRUE,"low")', '=_xlfn.SWITCH(B2,"Ann","A","Bob","B","?")', '=VLOOKUP("bob",B2:D8,3,FALSE)',
          '=MATCH("N*",A2:A8,0)', '=COUNTIF(A2:A8,"north")', "=_xlfn.XMATCH(60,D2:D8)", '=CHOOSE(2,"a","b","c")', '=COUNTIF(D2:D8,"<"&D3)',
          '=SUMIF(D2:D8,">100")', '=VLOOKUP(100,{0,"low";50,"mid";150,"high"},2,TRUE)'],
    "O": ["=AVERAGE(D2:D8)", "=MEDIAN(D2:D8)", "=STDEV(D2:D8)", "=LARGE(D2:D8,2)", "=RANK(80,D2:D8)", "=PERCENTILE(D2:D8,0.25)",
          "=FV(0.05/12,120,-200)", "=NPV(0.08,-1000,300,400,500)", "=IRR({-1000,300,400,500})", "=RATE(60,-489.15,25000)",
          "=NPER(0.065/12,-489.15,25000)", "=PV(0.05,10,-1000)", "=SLN(10000,1000,5)", "=EFFECT(0.065,12)", "=MODE(1,2,2,3)", "=VAR(D2:D8)",
          "=QUARTILE(D2:D8,1)", "=PMT(0.065/12,60,-25000)", "=_xlfn.STDEV.S(D2:D8)", "=CORREL(D2:D8,{1;2;3;4;5;6;7})", "=MAX(D2:D8)-MIN(D2:D8)",
          "=AVERAGE(D2:D8,1000)", "=CUMIPMT(0.065/12,60,25000,1,12,0)", "=SMALL(D2:D8,1)"],
}
def fn(b):
    wb = b.wb; ws = wb.add_worksheet("Sales")
    ws.write_row(0, 0, ["Region", "Rep", "Product", "Sales"])
    for i, r in enumerate(FN_DATA): ws.write_row(i + 1, 0, r)
    for col, fs in FN.items():
        lab = chr(ord(col) - 1)
        for i, f in enumerate(fs):
            ws.write_string("%s%d" % (lab, i + 2), f[1:]); b.f(ws, "%s%d" % (col, i + 2), f)
    ws.set_column("E:E", 26); ws.set_column("H:H", 36); ws.set_column("K:K", 40); ws.set_column("N:N", 30)


# ---- 35. a month across 30 columns (past Z) and a log of 1,500 rows ----
def wide(b):
    wb = b.wb; ws = wb.add_worksheet("November")
    ws.write("A1", "Meter")
    for d in range(30): ws.write_number(0, d + 1, d + 1)
    for m in range(3):
        ws.write(m + 1, 0, "Meter %d" % (m + 1))
        for d in range(30): ws.write_number(m + 1, d + 1, 10 + m * 5 + (d % 7))
    for m in range(3):
        ws.write(m + 5, 0, "Total, meter %d" % (m + 1)); b.f(ws, "B%d" % (m + 6), "=SUM(B%d:AE%d)" % (m + 2, m + 2))
    ws.write("A9", "Last day, meter 1"); b.f(ws, "B9", "=AE2")
    ws.write("A10", "Days counted"); b.f(ws, "B10", "=COUNT(B1:AE1)")
    lg = wb.add_worksheet("Log")
    lg.write_row(0, 0, ["Reading", "kWh"])
    for r in range(1500): lg.write_number(r + 1, 0, r + 1); lg.write_number(r + 1, 1, (r % 13) + 0.5)
    lg.write("A1503", "Total"); b.f(lg, "B1503", "=SUM(B2:B1501)")


# ---- whole columns in formulas ----
def wholecol(b):
    wb = b.wb; ws = wb.add_worksheet("Hours")
    ws.write_row(0, 0, ["Name", "Hours"])
    for i, r in enumerate([("Ann", 7.5), ("Bob", 8), ("Cy", 6.25), ("Ann", 4), ("Dee", 9), ("Bob", 3.5)]): ws.write_row(i + 1, 0, r)
    for ref, lab, f in [("E1", "Total", "=SUM(B:B)"), ("E2", "Cy", '=VLOOKUP("Cy",A:B,2,FALSE)'), ("E3", "Ann", '=SUMIF(A:A,"Ann",B:B)'),
                        ("E4", "Filled in column A", "=COUNTA(A:A)"), ("E5", "Average", "=AVERAGE(B:B)"), ("E6", "Bob's row", '=MATCH("Bob",A:A,0)'),
                        ("E7", "Most", "=MAX(B2:B1000)"), ("E8", "Row 3", "=SUM(3:3)")]:
        ws.write(ref.replace("E", "D"), lab); b.f(ws, ref, f)


# ---- a Python report left with XlsxWriter's own 0s beside the formulas ----
def pyexport(b):
    wb = b.wb; ws = wb.add_worksheet("Report")
    ws.write_row(0, 0, ["Line", "Units", "Rate", "Amount"])
    for i, r in enumerate([("Install", 3, 125), ("Service", 5, 80), ("Parts", 12, 9.5)]):
        ws.write_row(i + 1, 0, r); ws.write_formula("D%d" % (i + 2), "=B%d*C%d" % (i + 2, i + 2))
    ws.write("A5", "Total"); ws.write_formula("D5", "=SUM(D2:D4)")


# ---- the 1904 date system, with times and durations ----
def d1904(b):
    wb = b.wb; ws = wb.add_worksheet("Mac")
    md = wb.add_format({"num_format": "m/d/yyyy"}); tm = wb.add_format({"num_format": "h:mm AM/PM"}); dur = wb.add_format({"num_format": "[h]:mm"})
    mdt = wb.add_format({"num_format": "m/d/yyyy h:mm"})
    ws.write_row(0, 0, ["Date", "Start", "Shift length", "Days to Christmas", "Year", "Typed as a sum", "Hours", "With start", "As text"])
    ws.write_datetime("A2", datetime.datetime(2026, 11, 17), md); ws.write_datetime("A3", datetime.datetime(2026, 12, 25), md)
    ws.write_datetime("B2", datetime.time(8, 30), tm); ws.write_number("C2", 1.5, dur)
    b.f(ws, "D2", "=A3-A2"); b.f(ws, "E2", "=YEAR(A2)"); b.f(ws, "F2", "=DATE(2026,11,17)", md); b.f(ws, "G2", "=B2*24")
    b.f(ws, "H2", "=A2+B2", mdt); b.f(ws, "I2", '=TEXT(A2,"yyyy-mm-dd")'); b.f(ws, "J2", "=C2*24")
    ws.write("K1", "Lap"); ws.write_number("K2", 0.00087962962962963, wb.add_format({"num_format": "mm:ss.0"}))       # 1:16.0
    ws.write("L1", "Alarm"); ws.write_number("L2", 0.25, wb.add_format({"num_format": "h:mm:ss"}))                     # 6:00:00
    ws.write("M1", "Lap seconds"); b.f(ws, "M2", "=K2*86400")


XW("budget.xlsx", budget)
XW("parts.xlsx", parts)
XW("timesheet.xlsx", timesheet)
XW("dates.xlsx", dates)
XW("percent.xlsx", percent)
XW("money.xlsx", money)
XW("frozen.xlsx", frozen)
XW("hidden_rows.xlsx", hidden)
XW("wrapped.xlsx", wrapped)
XW("comments.xlsx", comments)
XW("chart.xlsx", chart)
XW("condfmt.xlsx", condfmt)
XW("validation.xlsx", validation)
XW("names.xlsx", names)
XW("crosssheet.xlsx", crosssheet)
XW("longtext.xlsx", longtext)
XW("unicode.xlsx", unicode_)
XW("text_numbers.xlsx", textnums)
XW("table.xlsx", table)
XW("formats.xlsx", formats)
XW("functions.xlsx", fn)
XW("wide.xlsx", wide)
XW("whole_columns.xlsx", wholecol)
XW("pythonexport_zero.xlsx", pyexport, values=False)
XW("date1904_mac.xlsx", d1904, {"date_1904": True})
os.remove(os.path.join(OUT, "_pixel.png"))


# ---------------------------------------------------------------------------------------------------------------
# openpyxl (no values saved beside the formulas)
# ---------------------------------------------------------------------------------------------------------------
def loan():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Loan"
    money = '"$"#,##0.00'
    for r, (k, v, nf) in enumerate([("Loan amount", 25000, money), ("Annual rate", 0.065, "0.00%"), ("Years", 5, "General"),
                                     ("Monthly payment", "=PMT(B2/12,B3*12,-B1)", money), ("Total interest", "=B4*B3*12-B1", money),
                                     ("First month's interest", "=IPMT(B2/12,1,B3*12,-B1)", money)], start=1):
        ws.cell(r, 1, k); c = ws.cell(r, 2, v); c.number_format = nf
    for i, h in enumerate(["Month", "Payment", "Interest", "Principal", "Balance"], start=1):
        ws.cell(8, i, h).font = Font(bold=True)
    ws["A9"] = 0; ws["E9"] = "=B1"; ws["E9"].number_format = money
    for r in range(10, 70):
        ws["A%d" % r] = "=A%d+1" % (r - 1)
        ws["B%d" % r] = "=$B$4"; ws["C%d" % r] = "=E%d*$B$2/12" % (r - 1); ws["D%d" % r] = "=B%d-C%d" % (r, r); ws["E%d" % r] = "=E%d-D%d" % (r - 1, r)
        for c in "BCDE": ws["%s%d" % (c, r)].number_format = money
    ws["A70"] = "Total"; ws["C70"] = "=SUM(C10:C69)"; ws["C70"].number_format = money; ws["D70"] = "=SUM(D10:D69)"; ws["D70"].number_format = money
    ws.column_dimensions["A"].width = 22
    ws.freeze_panes = "A9"
    wb.save(P("loan.xlsx"))


def report():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Sales"
    ws.append(["Date", "Customer", "Units", "Price", "Amount", "Share"])
    for c in ws[1]: c.font = Font(bold=True); c.alignment = Alignment(horizontal="center")
    rows = [(datetime.datetime(2026, 11, 2), "Acme Tool", 14, 18.5), (datetime.datetime(2026, 11, 5), "Birch & Co", 3, 120),
            (datetime.datetime(2026, 11, 9), "C. Diaz", 40, 2.25), (datetime.datetime(2026, 11, 12), "Delta Farm Supply", 7, 64.99)]
    for i, (d, cu, u, p) in enumerate(rows, start=2):
        ws.cell(i, 1, d).number_format = "yyyy-mm-dd"; ws.cell(i, 2, cu); ws.cell(i, 3, u)
        ws.cell(i, 4, p).number_format = "#,##0.00"; ws.cell(i, 5, "=C%d*D%d" % (i, i)).number_format = "#,##0.00"
        ws.cell(i, 6, "=E%d/$E$6" % i).number_format = "0.0%"
    ws["A6"] = "Total"; ws["A6"].font = Font(bold=True, italic=True); ws["E6"] = "=SUM(E2:E5)"; ws["E6"].number_format = "#,##0.00"; ws["E6"].font = Font(bold=True)
    ws["E6"].alignment = Alignment(horizontal="right")
    ws.column_dimensions["A"].width = 12; ws.column_dimensions["B"].width = 20.5
    ws.freeze_panes = "A2"; ws.auto_filter.ref = "A1:F5"
    ws2 = wb.create_sheet("Comments"); ws2["A1"] = "Checked"; ws2["A1"].comment = Comment("Checked against the bank statement", "Review")
    wb.save(P("openpyxl_report.xlsx"))


loan()
report()


# ---------------------------------------------------------------------------------------------------------------
# by hand, in Excel's own XML
# ---------------------------------------------------------------------------------------------------------------
M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PRNS = "http://schemas.openxmlformats.org/package/2006/relationships"
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
OD = "application/vnd.openxmlformats-officedocument."
WSNS = ('xmlns="%s" xmlns:r="%s" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" '
        'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" '
        'xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"') % (M, RNS)


def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


class Hand:
    """an Excel 365 workbook written as Excel writes it: shared strings, styles by number, rows with spans"""
    def __init__(self):
        self.strings = []; self.sheets = []

    def s(self, text):
        if text not in self.strings: self.strings.append(text)
        return self.strings.index(text)

    def sheet(self, name, rows, cols="", merges=(), views='<sheetView workbookViewId="0"/>', extra_tail="", fmtpr='<sheetFormatPr defaultRowHeight="15" x14ac:dyDescent="0.25"/>'):
        self.sheets.append((name, rows, cols, merges, views, extra_tail, fmtpr))

    def save(self, name, styles, metadata=None, date1904=False):
        parts = []
        ws = []
        for i, (sn, rows, cols, merges, views, tail, fmtpr) in enumerate(self.sheets):
            body = "".join(rows)
            ws.append(("xl/worksheets/sheet%d.xml" % (i + 1), HEAD + '<worksheet %s xr:uid="{00000000-0001-0000-0000-00000000000%d}"><dimension ref="A1"/><sheetViews>%s</sheetViews>%s%s<sheetData>%s</sheetData>%s'
                       '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>%s</worksheet>'
                       % (WSNS, i, views, fmtpr, ("<cols>%s</cols>" % cols) if cols else "", body,
                          ('<mergeCells count="%d">%s</mergeCells>' % (len(merges), "".join('<mergeCell ref="%s"/>' % m for m in merges))) if merges else "", tail)))
        ct = HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' \
            '<Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="%sspreadsheetml.sheet.main+xml"/>' % OD + \
            "".join('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="%sspreadsheetml.worksheet+xml"/>' % (i + 1, OD) for i in range(len(ws))) + \
            '<Override PartName="/xl/styles.xml" ContentType="%sspreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="%sspreadsheetml.sharedStrings+xml"/>' % (OD, OD) + \
            ('<Override PartName="/xl/metadata.xml" ContentType="%sspreadsheetml.sheetMetadata+xml"/>' % OD if metadata else "") + \
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="%sextended-properties+xml"/></Types>' % OD
        rels = HEAD + '<Relationships xmlns="%s">' % PRNS + "".join('<Relationship Id="rId%d" Type="%s/worksheet" Target="worksheets/sheet%d.xml"/>' % (i + 1, RNS, i + 1) for i in range(len(ws))) + \
            '<Relationship Id="rId%d" Type="%s/styles" Target="styles.xml"/><Relationship Id="rId%d" Type="%s/sharedStrings" Target="sharedStrings.xml"/>' % (len(ws) + 1, RNS, len(ws) + 2, RNS) + \
            ('<Relationship Id="rId%d" Type="%s/sheetMetadata" Target="metadata.xml"/>' % (len(ws) + 3, RNS) if metadata else "") + "</Relationships>"
        wbx = HEAD + '<workbook xmlns="%s" xmlns:r="%s"><fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="28429"/><workbookPr%s defaultThemeVersion="202300"/>' \
            '<bookViews><workbookView xWindow="-120" yWindow="-120" windowWidth="29040" windowHeight="15720"/></bookViews><sheets>%s</sheets><calcPr calcId="191029"/></workbook>' % (
                M, RNS, ' date1904="1"' if date1904 else "", "".join('<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (esc(s[0]), i + 1, i + 1) for i, s in enumerate(self.sheets)))
        sst = HEAD + '<sst xmlns="%s" count="%d" uniqueCount="%d">%s</sst>' % (M, len(self.strings), len(self.strings), "".join(
            '<si><t%s>%s</t></si>' % (' xml:space="preserve"' if t != t.strip() else "", esc(t)) for t in self.strings))
        app = HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application><AppVersion>16.0300</AppVersion></Properties>'
        core = HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Review</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-11-18T09:00:00Z</dcterms:created></cp:coreProperties>'
        parts = [("[Content_Types].xml", ct), ("_rels/.rels", HEAD + '<Relationships xmlns="%s"><Relationship Id="rId3" Type="%s/extended-properties" Target="docProps/app.xml"/>'
                  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
                  '<Relationship Id="rId1" Type="%s/officeDocument" Target="xl/workbook.xml"/></Relationships>' % (PRNS, RNS, RNS)),
                 ("xl/workbook.xml", wbx), ("xl/_rels/workbook.xml.rels", rels)] + ws + [("xl/styles.xml", styles), ("xl/sharedStrings.xml", sst), ("docProps/app.xml", app), ("docProps/core.xml", core)]
        if metadata: parts.append(("xl/metadata.xml", metadata))
        with zipfile.ZipFile(P(name), "w", zipfile.ZIP_DEFLATED) as z:
            for k, v in parts: z.writestr(zipfile.ZipInfo(k, (1980, 1, 1, 0, 0, 0)), v, zipfile.ZIP_DEFLATED)


def styles(xfs, numfmts=(), fonts=('<font><sz val="11"/><color theme="1"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font>',
                                    '<font><b/><sz val="11"/><color theme="1"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font>',
                                    '<font><i/><sz val="11"/><color theme="1"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font>')):
    nf = ('<numFmts count="%d">%s</numFmts>' % (len(numfmts), "".join('<numFmt numFmtId="%d" formatCode="%s"/>' % (i, esc(c)) for i, c in numfmts))) if numfmts else ""
    return HEAD + ('<styleSheet xmlns="%s" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac x16r2 xr" '
                   'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">%s<fonts count="%d" x14ac:knownFonts="1">%s</fonts>'
                   '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
                   '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="%d">%s</cellXfs>'
                   '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>'
                   % (M, nf, len(fonts), "".join(fonts), len(xfs), "".join(xfs)))


def row(r, cells, attrs=""):
    return '<row r="%d"%s>%s</row>' % (r, attrs, "".join(cells))


def C(ref, v=None, f=None, t=None, s=None, fa="", ca=""):
    a = ' r="%s"' % ref + (' s="%d"' % s if s else "") + (' t="%s"' % t if t else "") + ca
    inner = ("<f%s>%s</f>" % (fa, esc(f)) if f is not None else "") + ("<v>%s</v>" % (esc(str(v)) if v is not None else "") if (v is not None or t == "str") else "")
    return "<c%s>%s</c>" % (a, inner) if inner else "<c%s/>" % a


# ---- 8. merged cells as a form has them: a title, a subtitle, cells down two rows, a total over three rows, a notes box ----
def merged():
    h = Hand()
    st = styles(['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
                 '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>',
                 '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>',
                 '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
                 '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
                 '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'])
    S = h.s
    rows = [row(1, [C("A1", S("Weekly Production Report"), t="s", s=1)] + [C(c + "1", s=1) for c in "BCDEF"]),
            row(2, [C("A2", S("Line 3 — week 47"), t="s", s=2)] + [C(c + "2", s=2) for c in "BCDEF"]),
            row(4, [C(c + "4", S(t), t="s", s=5) for c, t in zip("ABCDEF", ["Shift", "Machine", "Parts made", "Scrap", "Shift total", "Scrap %"])])]
    data = {5: ("Shift A", "Press 1", 410, 6), 6: (None, "Press 2", 385, 4), 7: (None, "Lathe", 120, 1), 8: ("Shift B", "Press 1", 398, 9), 9: (None, "Press 2", 402, 3), 10: (None, "Lathe", 131, 2)}
    tot = {5: 915, 8: 931}
    for r, (sh, m, n, sc) in data.items():
        cells = [C("A%d" % r, S(sh), t="s", s=3) if sh else C("A%d" % r, s=3), C("B%d" % r, S(m), t="s"), C("C%d" % r, n), C("D%d" % r, sc)]
        if r in tot: cells.append(C("E%d" % r, tot[r], f="SUM(C%d:C%d)" % (r, r + 2), s=3))
        else: cells.append(C("E%d" % r, s=3))
        cells.append(C("F%d" % r, round(sc / n, 15), f="D%d/C%d" % (r, r)))
        rows.append(row(r, cells))
    rows.append(row(11, [C("A11", S("Week"), t="s", s=5), C("C11", 1846, f="SUM(C5:C10)"), C("D11", 25, f="SUM(D5:D10)"), C("E11", 1846, f="SUM(E5:E10)")]))
    rows.append(row(12, [C("A12", S("Notes"), t="s", s=5), C("B12", S("Press 1 die changed on Wednesday; scrap up on shift B while it was set."), t="s", s=4)] + [C(c + "12", s=4) for c in "CDEF"]))
    rows.append(row(13, [C(c + "13", s=4) for c in "BCDEF"])); rows.append(row(14, [C(c + "14", s=4) for c in "BCDEF"]))
    h.sheet("Report", rows, cols='<col min="1" max="1" width="11.7109375" customWidth="1"/><col min="2" max="2" width="13.42578125" customWidth="1"/>',
            merges=["A1:F1", "A2:F2", "A5:A7", "A8:A10", "E5:E7", "E8:E10", "B12:F14"])
    h.save("merged.xlsx", st)


# ---- 18. shared formulas down rows, across columns, and over a block (a times table) ----
def shared():
    h = Hand(); S = h.s
    st = styles(['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
                 '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'])
    qty = [4, 10, 2, 7, 1, 12, 3, 5, 8]; price = [2.5, 0.75, 19.99, 3.2, 120, 0.4, 7.5, 11, 1.25]
    cost = [q * p for q, p in zip(qty, price)]; total = sum(cost)
    rows = [row(1, [C(c + "1", S(t), t="s", s=1) for c, t in zip("ABCDE", ["Qty", "Price", "Cost", "Running", "Share"])])]
    run = 0
    for i in range(9):
        r = i + 2; run += cost[i]
        fC = dict(f="A2*B2", fa=' t="shared" ref="C2:C10" si="0"') if i == 0 else dict(f="", fa=' t="shared" si="0"')
        fD = dict(f="SUM(C$2:C2)", fa=' t="shared" ref="D2:D10" si="1"') if i == 0 else dict(f="", fa=' t="shared" si="1"')
        fE = dict(f="C2/$C$11", fa=' t="shared" ref="E2:E10" si="2"') if i == 0 else dict(f="", fa=' t="shared" si="2"')
        rows.append(row(r, [C("A%d" % r, qty[i]), C("B%d" % r, price[i]), C("C%d" % r, repr(cost[i]), **fC), C("D%d" % r, repr(run), **fD), C("E%d" % r, repr(cost[i] / total), s=2, **fE)]))
    rows.append(row(11, [C("A11", S("Total"), t="s", s=1), C("C11", repr(total), f="SUM(C2:C10)")]))
    mx = [max(qty), max(price), max(cost), run, max(cost) / total]
    rows.append(row(12, [C("A12", S("Most"), t="s", s=1)] + [C("%s12" % c, repr(mx[j]), f=("MAX(B2:B10)" if j == 1 else ""), fa=(' t="shared" ref="B12:E12" si="3"' if j == 1 else ' t="shared" si="3"'))
                                                         for j, c in enumerate("ABCDE") if j >= 1]))
    rows.append(row(14, [C("A14", S("×"), t="s", s=1)] + [C("%s14" % chr(66 + j), j + 1, s=1) for j in range(9)]))
    for i in range(9):
        r = 15 + i
        cells = [C("A%d" % r, i + 1, s=1)]
        for j in range(9):
            ref = "%s%d" % (chr(66 + j), r)
            if i == 0 and j == 0: cells.append(C(ref, 1, f="$A15*B$14", fa=' t="shared" ref="B15:J23" si="4"'))
            elif (i, j) == (5, 5): cells.append(C(ref, 0, f="0*$A20"))            # one cell in the block with a formula of its own
            else: cells.append(C(ref, (i + 1) * (j + 1), f="", fa=' t="shared" si="4"'))
        rows.append(row(r, cells))
    h.sheet("Costs", rows)
    h.save("shared.xlsx", st)


# ---- 19. array formulas: Ctrl+Shift+Enter (one cell and four), and Excel 365's spilling ones ----
def arrays():
    h = Hand(); S = h.s
    st = styles(['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'])
    items = ["Bolts", "Nuts", "Washers", "Bolts"]; qty = [10, 20, 30, 5]; price = [0.25, 0.1, 0.05, 0.25]; val = [q * p for q, p in zip(qty, price)]
    uniq = ["Bolts", "Nuts", "Washers"]; srt = sorted(qty)
    rows = [row(1, [C(c + "1", S(t), t="s", s=1) for c, t in zip("ABCDFG", ["Item", "Qty", "Price", "Value", "Items", "Sorted qty"])])]
    for i in range(4):
        r = i + 2
        cells = [C("A%d" % r, S(items[i]), t="s"), C("B%d" % r, qty[i]), C("C%d" % r, price[i])]
        cells.append(C("D%d" % r, repr(val[i]), f="B2:B5*C2:C5", fa=' t="array" ref="D2:D5"') if i == 0 else C("D%d" % r, repr(val[i])))
        if i < 3: cells.append(C("F%d" % r, uniq[i], f="_xlfn.UNIQUE(A2:A5)", t="str", fa=' t="array" ref="F2:F4"', ca=' cm="1"') if i == 0 else C("F%d" % r, uniq[i], t="str"))
        cells.append(C("G%d" % r, srt[i], f="_xlfn._xlws.SORT(B2:B5)", fa=' t="array" ref="G2:G5"', ca=' cm="1"') if i == 0 else C("G%d" % r, srt[i]))
        rows.append(row(r, cells))
    rows.append(row(7, [C("A7", S("Total value"), t="s"), C("C7", repr(sum(val)), f="SUM(B2:B5*C2:C5)", fa=' t="array" ref="C7"')]))
    rows.append(row(8, [C("A8", S("Bolts counted"), t="s"), C("C8", 15, f='SUM(IF(A2:A5="Bolts",B2:B5))', fa=' t="array" ref="C8"')]))
    rows.append(row(9, [C("A9", S("Total, SUMPRODUCT"), t="s"), C("C9", repr(sum(val)), f="SUMPRODUCT(B2:B5,C2:C5)")]))
    rows.append(row(10, [C("A10", S("Largest value"), t="s"), C("C10", repr(max(val)), f="MAX(B2:B5*C2:C5)", fa=' t="array" ref="C10"')]))
    h.sheet("Stock", rows)
    meta = HEAD + ('<metadata xmlns="%s" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray"><metadataTypes count="1"><metadataType name="XLDAPR" '
                   'minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" '
                   'coerce="1" cellMeta="1"/></metadataTypes><futureMetadata name="XLDAPR" count="1"><bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}">'
                   '<xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk></futureMetadata><cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata></metadata>' % M)
    h.save("arrays.xlsx", st, metadata=meta)


# ---- 23. booleans and errors, as constants and as results ----
def boolerr():
    h = Hand(); S = h.s
    st = styles(['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'])
    B = [("B2", "A2*1", 1, None), ("B3", "TRUE+TRUE", 2, None), ("B4", "SUM(A2:A4)", 0, None), ("B5", "COUNT(A2:A4)", 0, None), ("B6", "COUNTIF(A2:A4,TRUE)", 2, None),
         ("B7", "AND(A2:A4)", 0, "b"), ("B8", "OR(A2:A4)", 1, "b"), ("B9", 'IF(A3,"yes","no")', "no", "str"), ("B10", "N(A2)", 1, None),
         ("B11", "SUMPRODUCT(--A2:A4)", 2, None), ("B12", "5>3", 1, "b"), ("B13", "COUNTA(A2:A4)", 3, None), ("B14", "A2=1", 0, "b")]
    D = [("D2", "1/0", "#DIV/0!", "e"), ("D3", "NA()", "#N/A", "e"), ("D4", "SQRT(-1)", "#NUM!", "e"), ("D5", '"a"+1', "#VALUE!", "e"),
         ("D6", 'IFERROR(1/0,"none")', "none", "str"), ("D7", "ISERROR(C2)", 1, "b"), ("D8", '_xlfn.IFNA(C2,"missing")', "missing", "str"),
         ("D9", "ERROR.TYPE(C3)", 2, None), ("D10", "SUM(C2:C3)", "#N/A", "e"), ("D11", "#REF!*2", "#REF!", "e"), ("D12", "ISNA(C2)", 1, "b"),
         ("D13", "COUNT(C2:C8)", 0, None), ("D14", "COUNTA(C2:C8)", 7, None), ("D15", "ISERR(C2)", 0, "b"), ("D16", "IFERROR(C4*2,-1)", -1, None)]
    errs = ["#N/A", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#NULL!"]
    rows = [row(1, [C("A1", S("Done?"), t="s", s=1), C("B1", S("Sum"), t="s", s=1), C("C1", S("Error typed"), t="s", s=1), C("D1", S("Sum"), t="s", s=1)])]
    for r in range(2, 17):
        cells = []
        if r <= 4: cells.append(C("A%d" % r, [1, 0, 1][r - 2], t="b"))
        for ref, f, v, t in B:
            if int(ref[1:]) == r: cells.append(C(ref, v, f=f, t=t))
        if r - 2 < len(errs): cells.append(C("C%d" % r, errs[r - 2], t="e"))
        for ref, f, v, t in D:
            if int(ref[1:]) == r: cells.append(C(ref, v, f=f, t=t))
        rows.append(row(r, cells))
    h.sheet("Checks", rows)
    h.save("bool_err.xlsx", st)


# ---- 24. "" from formulas, and blank cells ----
def emptystr():
    h = Hand(); S = h.s
    st = styles(['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'])
    A = {2: 12, 4: 7, 6: 0}
    Bv = {2: 24, 3: "", 4: 14, 5: "", 6: 0}
    Cf = [("C2", "COUNTA(B2:B6)", 5, None), ("C3", "COUNTBLANK(B2:B6)", 2, None), ("C4", "ISBLANK(B3)", 0, "b"), ("C5", 'B3=""', 1, "b"),
          ("C6", "B3+1", "#VALUE!", "e"), ("C7", "SUM(B2:B6)", 38, None), ("C8", "LEN(B3)", 0, None), ("C9", "COUNT(B2:B6)", 3, None),
          ("C10", "AVERAGE(B2:B6)", repr(38 / 3), None), ("C11", "ISBLANK(A3)", 1, "b"), ("C12", "A3=0", 1, "b"), ("C13", 'A3=""', 1, "b"),
          ("C14", "A3+1", 1, None), ("C15", "COUNTA(A2:A6)", 3, None), ("C16", 'B3&"|"', "|", "str"), ("C17", 'IF(B3="","none",B3)', "none", "str")]
    rows = [row(1, [C("A1", S("Reading"), t="s"), C("B1", S("Doubled"), t="s"), C("C1", S("Check"), t="s")])]
    for r in range(2, 18):
        cells = []
        if r in A: cells.append(C("A%d" % r, A[r]))
        if r in Bv:
            v = Bv[r]
            cells.append(C("B%d" % r, v, f='IF(A%d="","",A%d*2)' % (r, r), t="str" if v == "" else None))
        for ref, f, v, t in Cf:
            if int(ref[1:]) == r: cells.append(C(ref, v, f=f, t=t))
        rows.append(row(r, cells))
    h.sheet("Readings", rows)
    h.save("empty_strings.xlsx", st)


# ---- 30. numbers as Excel writes them: 17 digits where a sum left them, and a quote prefix on text ----
def general():
    h = Hand(); S = h.s
    st = styles(['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
                 '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" quotePrefix="1"/>',
                 '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'])
    rows = [row(1, [C("A1", S("Pasted as values"), t="s"), C("B1", S("Times 3"), t="s"), C("C1", S("Typed with a quote"), t="s")]),
            row(2, [C("A2", "1.1000000000000001"), C("B2", "3.3000000000000003", f="A2*3"), C("C2", S("=not a formula"), t="s", s=1)]),
            row(3, [C("A3", "0.30000000000000004"), C("B3", "0.90000000000000013", f="A3*3"), C("C3", S("00123"), t="s", s=1)]),
            row(4, [C("A4", "4.0000000000000001E-3"), C("B4", "1.2E-2", f="A4*3"), C("C4", S("TRUE"), t="s", s=1)]),
            row(5, [C("A5", "8.9999999999999997E-2"), C("B5", "0.27", f="A5*3"), C("C5", S("1/2"), t="s", s=1)]),
            row(6, [C("A6", "123456789012345"), C("B6", "370370367037035", f="A6*3"), C("C6", S("-"), t="s", s=2)]),
            row(7, [C("A7", "1.2345678901234568E+18"), C("C7", S("'quoted"), t="s", s=1)]),
            row(8, [C("A8", "-0.1"), C("B8", "-0.30000000000000004", f="A8*3"), C("C8", S("+1"), t="s", s=2)]),
            row(9, [C("A9", "2.2204460492503131E-16"), C("C9", S("=A2"), t="s", s=2)])]
    h.sheet("Numbers", rows)
    h.save("general_numbers.xlsx", st)


merged()
shared()
arrays()
boolerr()
emptystr()
general()


# ---------------------------------------------------------------------------------------------------------------
# LibreOffice: from a flat ODF spreadsheet, from an .ods, and from a .csv
# ---------------------------------------------------------------------------------------------------------------
FODS_HEAD = ('<?xml version="1.0" encoding="UTF-8"?>\n<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
             'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
             'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" '
             'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" '
             'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">')


def fods_freeze(sheet):
    ci = lambda n, t, v: '<config:config-item config:name="%s" config:type="%s">%s</config:config-item>' % (n, t, v)
    return ('<office:settings><config:config-item-set config:name="ooo:view-settings"><config:config-item-map-indexed config:name="Views"><config:config-item-map-entry>'
            + ci("ViewId", "string", "view1") + '<config:config-item-map-named config:name="Tables"><config:config-item-map-entry config:name="%s">' % sheet
            + ci("HorizontalSplitMode", "short", 0) + ci("VerticalSplitMode", "short", 2) + ci("HorizontalSplitPosition", "int", 0) + ci("VerticalSplitPosition", "int", 1)
            + ci("ActiveSplitRange", "short", 2) + ci("PositionLeft", "int", 0) + ci("PositionRight", "int", 0) + ci("PositionTop", "int", 0) + ci("PositionBottom", "int", 1)
            + '</config:config-item-map-entry></config:config-item-map-named>' + ci("ActiveTable", "string", sheet)
            + '</config:config-item-map-entry></config:config-item-map-indexed></config:config-item-set></office:settings>')


def tc(v=None, f=None, style=None, kind=None, span=None, text=None, date=None):
    a = ""
    if style: a += ' table:style-name="%s"' % style
    if span: a += ' table:number-columns-spanned="%d" table:number-rows-spanned="%d"' % span
    if f: a += ' table:formula="of:%s"' % esc(f)
    if date: a += ' office:value-type="date" office:date-value="%s"' % date
    elif kind == "percentage": a += ' office:value-type="percentage" office:value="%s"' % v
    elif kind == "currency": a += ' office:value-type="currency" office:currency="USD" office:value="%s"' % v
    elif isinstance(v, (int, float)) and not isinstance(v, bool): a += ' office:value-type="float" office:value="%s"' % v
    elif v is not None or text is not None: a += ' office:value-type="string"'
    body = "<text:p>%s</text:p>" % esc(text if text is not None else str(v)) if (v is not None or text is not None) and f is None and not date else ""
    return "<table:table-cell%s>%s</table:table-cell>" % (a, body)


def trip_fods():
    st = ('<office:automatic-styles>'
          '<number:currency-style style:name="N1P0" style:volatile="true"><number:currency-symbol number:language="en" number:country="US">$</number:currency-symbol>'
          '<number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true"/></number:currency-style>'
          '<number:currency-style style:name="N1"><style:text-properties fo:color="#ff0000"/><number:text>-</number:text><number:currency-symbol number:language="en" number:country="US">$</number:currency-symbol>'
          '<number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true"/><style:map style:condition="value()&gt;=0" style:apply-style-name="N1P0"/></number:currency-style>'
          '<number:percentage-style style:name="N2"><number:number number:decimal-places="1" number:min-decimal-places="1" number:min-integer-digits="1"/><number:text>%</number:text></number:percentage-style>'
          '<number:date-style style:name="N3"><number:month number:style="long" number:textual="true"/><number:text> </number:text><number:day/><number:text>, </number:text><number:year number:style="long"/></number:date-style>'
          '<style:style style:name="co1" style:family="table-column"><style:table-column-properties style:column-width="4.2cm"/></style:style>'
          '<style:style style:name="co2" style:family="table-column"><style:table-column-properties style:column-width="2.6cm"/></style:style>'
          '<style:style style:name="ce1" style:family="table-cell" style:parent-style-name="Default"><style:table-cell-properties style:vertical-align="middle"/>'
          '<style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-weight="bold" fo:font-size="14pt"/></style:style>'
          '<style:style style:name="ce2" style:family="table-cell" style:parent-style-name="Default"><style:text-properties fo:font-weight="bold"/></style:style>'
          '<style:style style:name="ce3" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="N1"/>'
          '<style:style style:name="ce4" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="N2"/>'
          '<style:style style:name="ce5" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="N3"/>'
          '<style:style style:name="ce6" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="N1"><style:text-properties fo:font-weight="bold" fo:font-style="italic"/></style:style>'
          '<style:style style:name="ce7" style:family="table-cell" style:parent-style-name="Default"><style:paragraph-properties fo:text-align="end"/></style:style>'
          '</office:automatic-styles>')
    R = lambda cells: "<table:table-row>%s</table:table-row>" % "".join(cells)
    rows = [R([tc("Camping trip — costs", style="ce1", span=(4, 1)), "<table:covered-table-cell/>" * 3]),
            R([tc(t, style="ce2") for t in ["Item", "Cost", "People", "Each"]]),
            R([tc("Campsite, 3 nights"), tc(96, style="ce3", kind="currency"), tc(4), tc(f="ROUND([.B3]/[.C3];2)", style="ce3")]),
            R([tc("Fuel"), tc(58.4, style="ce3", kind="currency"), tc(4), tc(f="ROUND([.B4]/[.C4];2)", style="ce3")]),
            R([tc("Food"), tc(142.75, style="ce3", kind="currency"), tc(4), tc(f="ROUND([.B5]/[.C5];2)", style="ce3")]),
            R([tc("Firewood"), tc(18, style="ce3", kind="currency"), tc(3), tc(f="ROUND([.B6]/[.C6];2)", style="ce3")]),
            R([tc("Total", style="ce7"), tc(f="SUM([.B3:.B6])", style="ce6"), tc(), tc(f="SUM([.D3:.D6])", style="ce6")]),
            R([tc("Deposit paid"), tc(50, style="ce3", kind="currency")]),
            R([tc("Still to pay"), tc(f="[.B7]-[.B8]", style="ce3")]),
            R([tc("Leaving"), tc(date="2026-11-20", style="ce5")]),
            R([tc("Days to go"), tc(f="[.B10]-DATE(2026;11;17)")]),
            R([tc("Over 300?"), tc(f='IF([.B7]&gt;300;"yes";"no")'.replace("&gt;", ">"))]),
            R([tc("Fuel share"), tc(f="[.B4]/[.B7]", style="ce4")]),
            R([tc("Fuel each, rounded up"), tc(f="CEILING([.B4]/[.C4];1)", style="ce3")])]
    body = ('<office:body><office:spreadsheet><table:table table:name="Trip"><table:table-column table:style-name="co1"/>'
            '<table:table-column table:style-name="co2" table:number-columns-repeated="3"/>%s</table:table></office:spreadsheet></office:body></office:document>' % "".join(rows))
    return FODS_HEAD + fods_freeze("Trip") + st + body


def grades_fods():
    R = lambda cells: "<table:table-row>%s</table:table-row>" % "".join(cells)
    rows = [R([tc(t) for t in ["Student", "Test 1", "Test 2", "Test 3", "Average", "Result", "Rank"]])]
    data = [("Amina", 78, 85, 91), ("Ben", 55, 61, 48), ("Carlos", 92, 88, 95), ("Dana", 67, 59, 72), ("Eli", 40, 52, 58), ("Fern", 88, 90, 79)]
    for i, (n, a, b2, c) in enumerate(data):
        r = i + 2
        rows.append(R([tc(n), tc(a), tc(b2), tc(c), tc(f="ROUND(AVERAGE([.B%d:.D%d]);1)" % (r, r)), tc(f='IF([.E%d]>=60;"Pass";"Fail")' % r),
                       tc(f="RANK([.E%d];[.E$2:.E$7])" % r)]))
    rows.append(R([tc("Passed"), tc(), tc(), tc(), tc(), tc(f='COUNTIF([.F2:.F7];"Pass")')]))
    rows.append(R([tc("Best"), tc(f="MAX([.B2:.B7])"), tc(f="MAX([.C2:.C7])"), tc(f="MAX([.D2:.D7])"), tc(f="MAX([.E2:.E7])")]))
    rows.append(R([tc("Spread"), tc(f="ROUND(STDEV([.B2:.B7]);2)"), tc(f="ROUND(STDEV([.C2:.C7]);2)"), tc(f="ROUND(STDEV([.D2:.D7]);2)")]))
    rows.append(R([tc("Class average"), tc(), tc(), tc(), tc(f="AVERAGEIF([.F2:.F7];\"Pass\";[.E2:.E7])")]))
    body = '<office:body><office:spreadsheet><table:table table:name="Grades">%s</table:table></office:spreadsheet></office:body></office:document>' % "".join(rows)
    return FODS_HEAD + body


def lo_files():
    o = office()
    open(P("lo_trip.fods"), "w", encoding="utf-8").write(trip_fods())
    o.convert(P("lo_trip.fods"), P("lo_trip.xlsx"), "Calc MS Excel 2007 XML")
    open(P("lo_grades.fods"), "w", encoding="utf-8").write(grades_fods())
    o.convert(P("lo_grades.fods"), P("lo_grades.ods"), "calc8")
    o.convert(P("lo_grades.ods"), P("lo_grades.xlsx"), "Calc MS Excel 2007 XML")
    open(P("lo_orders.csv"), "w", encoding="utf-8", newline="").write(
        "Date,Item,Qty,Price,Code,Paid\r\n2026-11-02,Bolts M8,100,0.12,00731,TRUE\r\n2026-11-03,\"Nuts, M8\",100,0.05,00732,FALSE\r\n"
        "2026-11-05,Washers M8,250,0.02,01200,TRUE\r\n2026-11-09,Threadlock 10 ml,2,6.95,A-17,TRUE\r\n")
    o.convert(P("lo_orders.csv"), P("lo_orders.xlsx"), "Calc MS Excel 2007 XML")


lo_files()


# ---- files Sheets cannot open as they are: an old .xls, an .ods, a workbook locked with a password ----
def other_files():
    o = office()
    o.convert(P("budget.xlsx"), P("old_format.xls"), "MS Excel 97")
    o.convert(P("budget.xlsx"), P("libreoffice_own.ods"), "calc8")
    try:
        import io
        from msoffcrypto.format.ooxml import OOXMLFile
        src = open(P("budget.xlsx"), "rb"); out = io.BytesIO()
        f = OOXMLFile(src); f.encrypt("lantern", out)
        open(P("password.xlsx"), "wb").write(out.getvalue())
    except Exception as ex:
        print("password.xlsx not made:", ex)


# ---- a big sheet: 2,000 rows of 26 columns, a sum in every row ----
def big(b):
    ws = b.wb.add_worksheet("Readings")
    for r in range(2000):
        for c in range(25): ws.write_number(r, c, (r * 31 + c * 7) % 97 + 0.5)
        b.f(ws, "Z%d" % (r + 1), "=SUM(A%d:Y%d)" % (r + 1, r + 1))


other_files()
XW("big_2000.xlsx", big, values=False)
if OFFICE: OFFICE.close()
print("made", len([f for f in os.listdir(OUT) if f.endswith(".xlsx")]), "workbooks in", OUT)
