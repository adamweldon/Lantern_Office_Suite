# build.py -- the second Excel review of Lantern 1.24.28: the workbooks it opens (files/) and the cases (cases.json).
#   python3 tests/fixtures/xlsx/review2/build.py      (needs XlsxWriter, openpyxl, msoffcrypto-tool; LibreOffice for two files)
# Each case says what Excel does (expected), so replay.py can judge what Lantern does. The cases and their judgements
# are in cases.py; this file makes the workbooks and writes cases.json from cases.py. The guard sheet's formulas are
# also written to files/guard_lo.xlsx so LibreOffice can be asked whether it agrees with the values expected here
# (replay.py --oracle).
import io, json, os, re, sys, zipfile, datetime as dt
sys.dont_write_bytecode = True   # no Python caches in the repository
HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "files")
sys.path.insert(0, HERE)
os.makedirs(FILES, exist_ok=True)
import xlsxwriter, openpyxl
from openpyxl.comments import Comment
import cases as C


def F(name): return os.path.join(FILES, name)


def serial(y, m, d): return (dt.date(y, m, d) - dt.date(1899, 12, 30)).days


# ---- 1. the workbook with several sheets, as Excel writes it (values given as Excel works them out) ----
def multi_sheet():
    wb = xlsxwriter.Workbook(F("multi_sheet.xlsx"))
    items = ["Paper", "Pens", "Ink", "Tape"]
    for name, nums in (("Jan", [10, 20, 30, 40]), ("Feb", [1, 2, 3, 4]), ("Mar", [100, 200, 300, 400])):
        ws = wb.add_worksheet(name)
        ws.write("A1", "Item"); ws.write("B1", "Amount")
        for i, (it, n) in enumerate(zip(items, nums)):
            ws.write(i + 1, 0, it); ws.write(i + 1, 1, n)
        ws.write("A6", "Total"); ws.write_formula("B6", "=SUM(B2:B5)", None, sum(nums))
    ws = wb.add_worksheet("Bob's rates")
    ws.write("A1", "Rate"); ws.write("B1", 0.08); ws.write("A2", "Fee"); ws.write_formula("B2", "=B1*100", None, 8)
    ws = wb.add_worksheet("Q1 2026")
    ws.write_formula("A1", "=Jan!B6+Feb!B6+Mar!B6", None, 1110)
    ws = wb.add_worksheet("R&D")
    ws.write("A1", "Hours"); ws.write("B1", 7)
    ws = wb.add_worksheet("Summary")
    for row, (label, f, v) in enumerate(C.SUMMARY):
        ws.write(row, 0, label)
        ws.write_formula(row, 1, f, None, v)
    wb.close()


# ---- 2. legacy array formulas (Ctrl+Shift+Enter), written as Excel 2016 writes them ----
SHEET_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


def hand_book(path, sheets, strings=(), styles=None, calc="", extra_parts=None, workbook_pr="", defined=""):
    """a workbook written by hand: sheets [(name, sheetData xml, extra after sheetData)]"""
    ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
          '<Default Extension="xml" ContentType="application/xml"/>',
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
          '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>']
    rels = []
    for i, _ in enumerate(sheets):
        ct.append('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % (i + 1))
        rels.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>' % (i + 1, i + 1))
    n = len(sheets)
    rels.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' % (n + 1))
    rels.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' % (n + 2))
    if styles is None:
        styles = ('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
                  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
                  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                  '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
    wbx = (SHEET_HEAD + '<workbook %s>%s<sheets>%s</sheets>%s%s</workbook>' % (NS, workbook_pr, "".join(
        '<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (nm, i + 1, i + 1) for i, (nm, _, _) in enumerate(sheets)), defined, calc))
    sst = SHEET_HEAD + '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="%d" uniqueCount="%d">%s</sst>' % (
        len(strings), len(strings), "".join("<si><t>%s</t></si>" % s for s in strings))
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", SHEET_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">%s</Types>' % "".join(ct))
        z.writestr("_rels/.rels", SHEET_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr("xl/workbook.xml", wbx)
        z.writestr("xl/_rels/workbook.xml.rels", SHEET_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">%s</Relationships>' % "".join(rels))
        z.writestr("xl/styles.xml", SHEET_HEAD + styles)
        z.writestr("xl/sharedStrings.xml", sst)
        for i, (nm, data, after) in enumerate(sheets):
            z.writestr("xl/worksheets/sheet%d.xml" % (i + 1), SHEET_HEAD + '<worksheet %s><sheetData>%s</sheetData>%s</worksheet>' % (NS, data, after))


def array_legacy():
    # A Item, B Qty, C Price; D2:D5 {=B2:B5*C2:C5}; E2 {=SUM(B2:B5*C2:C5)}; F2:F4 {=TRANSPOSE(A1:C1)}; G2 {=MAX(IF(B2:B5>2,C2:C5))}
    s = ["Item", "Qty", "Price", "Line", "Bolts", "Nuts", "Pins", "Rods"]
    rows = ['<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>']
    q, p = [2, 3, 4, 5], [10, 20, 30, 40]
    for i in range(4):
        r = i + 2
        cells = '<c r="A%d" t="s"><v>%d</v></c><c r="B%d"><v>%d</v></c><c r="C%d"><v>%d</v></c>' % (r, 4 + i, r, q[i], r, p[i])
        cells += ('<c r="D%d"><f t="array" ref="D2:D5">B2:B5*C2:C5</f><v>%d</v></c>' % (r, q[i] * p[i])) if r == 2 else '<c r="D%d"><v>%d</v></c>' % (r, q[i] * p[i])
        if r == 2:
            cells += '<c r="E2"><f t="array" ref="E2">SUM(B2:B5*C2:C5)</f><v>400</v></c>'
            cells += '<c r="F2" t="str"><f t="array" ref="F2:F4">TRANSPOSE(A1:C1)</f><v>Item</v></c>'
            cells += '<c r="G2"><f t="array" ref="G2">MAX(IF(B2:B5&gt;2,C2:C5))</f><v>40</v></c>'
        if r == 3: cells += '<c r="F3" t="str"><v>Qty</v></c>'
        if r == 4: cells += '<c r="F4" t="str"><v>Price</v></c>'
        rows.append('<row r="%d">%s</row>' % (r, cells))
    hand_book(F("array_legacy.xlsx"), [("Sheet1", "".join(rows), "")], s, calc='<calcPr calcId="191029"/>')


# ---- 3. Excel 365's spilling formulas, as XlsxWriter writes them (cm="1", xl/metadata.xml) ----
def dynamic365():
    wb = xlsxwriter.Workbook(F("dynamic365.xlsx"))
    ws = wb.add_worksheet("Sheet1")
    ws.write("A1", "Region"); ws.write("C1", "Qty")
    for i, (r, q) in enumerate(C.DATA_RQ):
        ws.write(i + 1, 0, r); ws.write(i + 1, 2, q)
    ws.write_dynamic_array_formula("E2:E5", "=_xlfn.UNIQUE(A2:A9)", None, "North")
    for i, v in enumerate(["South", "East", "West"]): ws.write_string(2 + i, 4, v)   # the spilled values Excel saves
    srt = sorted(q for _, q in C.DATA_RQ)
    ws.write_dynamic_array_formula("F2:F9", "=_xlfn._xlws.SORT(C2:C9)", None, srt[0])
    for i, v in enumerate(srt[1:]): ws.write_number(2 + i, 5, v)
    ws.write_dynamic_array_formula("G2:G4", "=_xlfn._xlws.FILTER(A2:A9,C2:C9>5)", None, "East")
    ws.write_string(2, 6, "South"); ws.write_string(3, 6, "East")
    ws.write_dynamic_array_formula("H2:H4", "=_xlfn.SEQUENCE(3)", None, 1)
    ws.write_number(2, 7, 2); ws.write_number(3, 7, 3)
    ws.write_dynamic_array_formula("I2", "=COUNTA(_xlfn.UNIQUE(A2:A9))", None, 4)
    ws.write_formula("J2", "=SUM(C2:C9)", None, sum(q for _, q in C.DATA_RQ))
    wb.close()


# ---- 4. Excel's GAMMA and the other new functions, with Excel's values ----
def gamma():
    wb = xlsxwriter.Workbook(F("gamma.xlsx"), {"use_future_functions": True})
    ws = wb.add_worksheet("Sheet1")
    for row, (f, v) in enumerate(C.GAMMA_FILE):
        ws.write(row, 0, f)
        if isinstance(v, str) and v.startswith("#"): ws.write_formula(row, 1, f, None, v)
        else: ws.write_formula(row, 1, f, None, v)
    wb.close()


# ---- 5. a 1904 workbook (an old Mac's) with dates, lengths of time and times of day ----
def date1904():
    wb = xlsxwriter.Workbook(F("date1904.xlsx"), {"date_1904": True})
    ws = wb.add_worksheet("Shifts")
    fd = wb.add_format({"num_format": "yyyy-mm-dd"}); fh = wb.add_format({"num_format": "[h]:mm"})
    ft = wb.add_format({"num_format": "h:mm"}); fdt = wb.add_format({"num_format": "m/d/yyyy h:mm"})
    off = 1462
    ws.write("A1", "Start"); ws.write_number("B1", serial(2026, 11, 17) - off, fd)
    ws.write("A2", "End"); ws.write_number("B2", serial(2026, 12, 25) - off, fd)
    ws.write("A3", "Days"); ws.write_formula("B3", "=B2-B1", None, 38)
    ws.write("A4", "Due"); ws.write_formula("B4", "=B1+30", fd, serial(2026, 12, 17) - off)
    ws.write("C1", 1.5, fh); ws.write("C2", 0.75, fh); ws.write_formula("C3", "=SUM(C1:C2)", fh, 2.25)
    ws.write("D1", 0.5, ft)
    ws.write("E1", serial(2026, 11, 17) - off + 14.5 / 24, fdt)
    ws.write("F1", 42)
    wb.close()


# ---- 6. text that looks like a number, a date or a time, kept as text in Excel ----
def text_numbers():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Codes"
    for i, t in enumerate(C.TEXTLIKE):
        ws.cell(row=i + 1, column=1).value = t
        ws.cell(row=i + 1, column=1).data_type = "s"
    n = len(C.TEXTLIKE)
    ws["B1"] = "=COUNT(A1:A%d)" % n
    ws["B2"] = "=SUM(A1:A%d)" % n
    ws["B3"] = "=COUNTA(A1:A%d)" % n
    wb.save(F("text_numbers.xlsx"))


# ---- 7. numbers stored with more digits than Excel shows ----
def constants():
    rows = "".join('<row r="%d"><c r="A%d"><v>%s</v></c></row>' % (i + 1, i + 1, v) for i, (v, _) in enumerate(C.CONSTANTS))
    hand_book(F("constants.xlsx"), [("Sheet1", rows, "")], calc='<calcPr calcId="191029"/>')


# ---- 8. an Excel table (Insert, Table) and formulas that name its parts ----
def tables():
    wb = xlsxwriter.Workbook(F("tables.xlsx"))
    ws = wb.add_worksheet("Data")
    data = [["Paper", 4, 2.5], ["Pens", 10, 1.25], ["Ink", 2, 18], ["Tape", 6, 3], ["Glue", 3, 4.5]]
    ws.add_table("A1:D7", {"name": "Orders", "data": data, "total_row": True, "columns": [
        {"header": "Item", "total_string": "Total"},
        {"header": "Qty", "total_function": "sum", "total_value": 25},
        {"header": "Unit Price"},
        {"header": "Line Total", "formula": "=[@Qty]*[@[Unit Price]]", "total_function": "sum", "total_value": 90}]})
    # the line totals' values as Excel saves them
    for i, d in enumerate(data): ws.write_formula(i + 1, 3, "=Orders[[#This Row],[Qty]]*Orders[[#This Row],[Unit Price]]", None, d[1] * d[2])
    ss = wb.add_worksheet("Summary")
    for row, (label, f, v) in enumerate(C.TABLE_SUMMARY):
        ss.write(row, 0, label); ss.write_formula(row, 1, f, None, v)
    wb.close()


# ---- 9. comments and the filter buttons ----
def comments_filter():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Stock"
    ws.append(["Part", "Qty", "Bin", "Price"])
    for r in [["Bolt", 40, "A1", 0.2], ["Nut", 55, "A2", 0.1], ["Washer", 12, "B1", 0.05], ["Pin", 7, "B2", 0.4]]: ws.append(r)
    ws["B2"].comment = Comment("Check this count with the supplier", "Dee")
    ws["D5"].comment = Comment("Price rises in March", "Ann")
    ws.auto_filter.ref = "A1:D5"
    wb.save(F("comments_filter.xlsx"))


# ---- 10. a workbook locked with a password ----
def locked():
    import msoffcrypto, msoffcrypto.format.ooxml
    wb = openpyxl.Workbook(); wb.active["A1"] = "secret"; buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    plain = F("_plain_for_locked.xlsx")
    open(plain, "wb").write(buf.getvalue())
    with open(plain, "rb") as fi, open(F("locked.xlsx"), "wb") as fo:
        msoffcrypto.format.ooxml.OOXMLFile(fi).encrypt("lantern", fo)
    os.remove(plain)


# ---- 11. a Python report's workbook (full recalculation asked; 0 saved beside formulas) and one that is not ----
def recalc_files():
    wb = xlsxwriter.Workbook(F("fullcalc.xlsx"))
    ws = wb.add_worksheet("Sheet1")
    for i, v in enumerate([1, 2, 3]): ws.write(i, 0, v)
    ws.write_formula("B1", "=SUM(A1:A3)")             # saved as 0: Excel works it out on opening
    ws.write_formula("B2", "=A1*10")                  # saved as 0
    ws.write_formula("B3", "=SUM(A1:A3)*2", None, 99)  # saved wrong (12 is right): still worth saying
    wb.close()
    rows = ('<row r="1"><c r="A1"><v>1</v></c><c r="B1"><f>SUM(A1:A3)</f><v>0</v></c></row>'
            '<row r="2"><c r="A2"><v>2</v></c><c r="B2"><f>A1-1</f><v>0</v></c></row>'
            '<row r="3"><c r="A3"><v>3</v></c></row>')
    hand_book(F("nocalc_zero.xlsx"), [("Sheet1", rows, "")], calc='<calcPr calcId="191029"/>')


# ---- 12. number formats: another country's money, a phone number's two sections, K and M ----
def numfmt():
    wb = xlsxwriter.Workbook(F("numfmt.xlsx"))
    ws = wb.add_worksheet("Formats")
    for row, (v, code, _) in enumerate(C.NUMFMT_FILE):
        ws.write_number(row, 0, v, wb.add_format({"num_format": code}))
        ws.write_string(row, 1, code)
    wb.close()


def lo_currency(office):
    fods = F("_lo_currency.fods")
    open(fods, "w").write(C.LO_FODS)
    office.convert(fods, F("lo_currency.xlsx"))
    os.remove(fods)


# ---- 13. names: one for a cell on another sheet, one for a number, one for this sheet only ----
def names():
    wb = xlsxwriter.Workbook(F("names_sheet.xlsx"))
    rs = wb.add_worksheet("Rates"); rs.write("A1", "Tax"); rs.write("B1", 0.0825)
    sm = wb.add_worksheet("Summary")
    sm.write("A1", "Price"); sm.write("B1", 100)
    wb.define_name("TaxRate", "=Rates!$B$1")
    wb.define_name("Discount", "=0.1")
    wb.define_name("Summary!Local", "=Summary!$B$1")
    sm.write("A2", "Tax"); sm.write_formula("B2", "=B1*TaxRate", None, 8.25)
    sm.write("A3", "Sale"); sm.write_formula("B3", "=B1*(1-Discount)", None, 90)
    sm.write("A4", "Double"); sm.write_formula("B4", "=Local*2", None, 200)
    sm.write("A5", "Gross"); sm.write_formula("B5", "=B1+B1*TaxRate", None, 108.25)
    wb.close()


# ---- 14. a shared formula across a block, with $ ----
def shared():
    rows = ['<row r="1"><c r="B1"><v>1</v></c><c r="C1"><v>2</v></c><c r="D1"><v>3</v></c></row>']
    for r in (2, 3, 4):
        cells = '<c r="A%d"><v>%d</v></c>' % (r, r * 10)
        for ci, col in enumerate("BCD"):
            v = r * 10 * (ci + 1)
            if r == 2 and col == "B": cells += '<c r="B2"><f t="shared" ref="B2:D4" si="0">$A2*B$1</f><v>%d</v></c>' % v
            else: cells += '<c r="%s%d"><f t="shared" si="0"/><v>%d</v></c>' % (col, r, v)
        rows.append('<row r="%d">%s</row>' % (r, cells))
    hand_book(F("shared.xlsx"), [("Sheet1", "".join(rows), "")], calc='<calcPr calcId="191029"/>')


# ---- 16. Excel 2016's implicit intersection: =C2:C9*2 typed in row 5 (no Ctrl+Shift+Enter) is C5*2; Excel 365 shows
# it as =@C2:C9*2 and writes an explicit @ as _xlfn.SINGLE ----
def implicit():
    s = ["Qty"]
    rows = ['<row r="1"><c r="C1" t="s"><v>0</v></c></row>']
    q = [5, 3, 2, 7, 1, 4, 6, 8]
    for i, v in enumerate(q):
        r = i + 2; cells = '<c r="C%d"><v>%d</v></c>' % (r, v)
        if r == 5: cells += '<c r="J5"><f>C2:C9*2</f><v>14</v></c><c r="K5"><f>_xlfn.SINGLE(C2:C9)*2</f><v>14</v></c><c r="L5"><f>SUM(C2:C9)</f><v>36</v></c>'
        rows.append('<row r="%d">%s</row>' % (r, cells))
    hand_book(F("implicit.xlsx"), [("Sheet1", "".join(rows), "")], s, calc='<calcPr calcId="191029"/>')


# ---- 17. a table of 200 rows with a formula column, as a stock list kept in Excel ----
def table200():
    wb = xlsxwriter.Workbook(F("table200.xlsx"))
    ws = wb.add_worksheet("Stock")
    data = [["Part %d" % i, i, 3] for i in range(1, 201)]
    ws.add_table("A1:D201", {"name": "Stock", "data": data, "columns": [{"header": "Part"}, {"header": "Qty"}, {"header": "Price"},
                                                                         {"header": "Value", "formula": "=[@Qty]*[@Price]"}]})
    for i, d in enumerate(data): ws.write_formula(i + 1, 3, "=Stock[[#This Row],[Qty]]*Stock[[#This Row],[Price]]", None, d[1] * d[2])
    wb.close()


# ---- 15. the guard sheet with its formulas, for LibreOffice to check the values expected here ----
def guard_lo():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Guard"
    for ref, raw in C.GUARD_DATA.items():
        if isinstance(raw, str) and len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
            y, m, d = map(int, raw.split("-")); ws[ref] = dt.datetime(y, m, d); ws[ref].number_format = "yyyy-mm-dd"
        else:
            try: ws[ref] = float(raw) if "." in raw else int(raw)
            except ValueError: ws[ref] = raw
    from openpyxl.worksheet.formula import ArrayFormula
    for c in C.CASES:
        cell = c.get("guard_cell")
        if not cell or c.get("lo_skip"): continue
        f = c["input"]["cells"][cell]
        # LibreOffice reads Excel's newer functions with the _xlfn. Excel writes before them
        f = re.sub(r"\b(TEXTJOIN|CONCAT|DAYS|IFS|SWITCH|MAXIFS|MINIFS|IFNA)\(", r"_xlfn.\1(", f)
        ws[cell] = ArrayFormula(cell, f) if c.get("guard_array") else f
    wb.save(F("guard_lo.xlsx"))


if __name__ == "__main__":
    multi_sheet(); array_legacy(); dynamic365(); gamma(); date1904(); text_numbers(); constants(); tables()
    comments_filter(); locked(); recalc_files(); numfmt(); names(); shared(); implicit(); table200(); guard_lo()
    try:
        import lo
        with lo.Office() as o: lo_currency(o)
    except Exception as e:
        print("LibreOffice not used (%s): files/lo_currency.xlsx not made" % e)
    json.dump(C.CASES, open(os.path.join(HERE, "cases.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(len(C.CASES), "cases written; files in", FILES)
