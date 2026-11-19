# cases.py -- writes cases.json, the review's cases, with what Excel would do (the "expected" of each case).
#   python3 tests/fixtures/xlsx/review/cases.py        (after make.py; then replay.py --record fills lantern_got and agree)
# Where a value is Excel's, it comes from the values saved in the file beside each formula (Excel's own, as make.py
# saved them: LibreOffice's working-out, put right by hand where LibreOffice 24.2 differs from Excel), or, for a file
# with no saved values (openpyxl's), from LibreOffice working every formula out again. What a cell shows is written
# here by hand, as Excel (English, United States) shows it. The judgement of each case after it was run (harm, why)
# is in JUDGE at the end, and is carried into cases.json.
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET
HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "files")
sys.path.insert(0, HERE)
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
CASES = []


def case(id, group, what, input, expected, excel_only=False):
    CASES.append({"id": id, "group": group, "what": what, "input": input, "expected": expected, "excel_only": excel_only})


# ---- the values a file has saved beside its formulas (Excel's) ----
_cache = {}
def saved(fname):
    if fname in _cache: return _cache[fname]
    z = zipfile.ZipFile(os.path.join(FILES, fname))
    sst = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si"):
            sst.append("".join(t.text or "" for t in si.iter(M + "t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    out = []
    for sh in wb.find(M + "sheets"):
        tgt = rels[sh.get(RID)]
        tgt = tgt.lstrip("/") if tgt.startswith("/") else "xl/" + tgt
        cells = {}
        for c in ET.fromstring(z.read(tgt)).iter(M + "c"):
            t, v = c.get("t"), c.find(M + "v")
            f = c.find(M + "f")
            if t == "inlineStr":
                cells[c.get("r")] = "".join(x.text or "" for x in c.iter(M + "t")); continue
            if v is None:
                if t == "str" and f is not None: cells[c.get("r")] = ""
                continue
            s = v.text or ""
            if t == "s": cells[c.get("r")] = sst[int(s)]
            elif t == "b": cells[c.get("r")] = s == "1"
            elif t in ("e", "str"): cells[c.get("r")] = s
            else: cells[c.get("r")] = float(s) if s != "" else ""
        out.append(cells)
    _cache[fname] = out
    return out


def vals(fname, refs, sheet=0, extra=None):
    c = saved(fname)[sheet]
    d = {r: c[r] for r in refs}
    d.update(extra or {})
    return {str(sheet): d}


def rng(col, a, b): return ["%s%d" % (col, i) for i in range(a, b + 1)]


LO_VALUES = {}
def lo_vals(fname, refs, sheet=0):
    """for a file with no values saved (openpyxl's): LibreOffice works it out"""
    import lo
    if fname not in LO_VALUES:
        o = lo.Office(); LO_VALUES[fname] = o.read(os.path.join(FILES, fname)); o.close()
    d = LO_VALUES[fname]; cells = d["cells"][d["sheets"][sheet]]
    return {str(sheet): {r: cells[r]["v"] for r in refs}}


def widths(fname, sheet=0):
    import openpyxl
    ws = openpyxl.load_workbook(os.path.join(FILES, fname)).worksheets[sheet]
    out = {}
    for k, cd in ws.column_dimensions.items():
        if cd.width and cd.customWidth:
            for i in range(cd.min, cd.max + 1):
                if i <= 26: out[chr(64 + i)] = cd.width
    return {str(sheet): out}


def BIGSUM(r): return float(sum((r * 31 + c * 7) % 97 + 0.5 for c in range(25)))


# =================================================================================================================
# 1. read
# =================================================================================================================
B = "budget.xlsx"
case("read-budget-values", "read", "a household budget: differences, shares, totals and what is left, as Excel worked them out", B, {
    "cells": {"0": {"D3": "=B3-C3", "E3": "=C3/$C$11", "B11": "=SUM(B3:B10)", "B14": "=B13-C11", "B15": "=(C9+B14)/B13", "C4": "512.37", "A8": "Phone & internet"}},
    "values": vals(B, rng("D", 3, 11) + rng("E", 3, 11) + ["B11", "C11", "B14", "B15"]),
    "notes_not_contain": ["differently"]})
case("read-budget-looks", "read", "the budget's looks: money, red negatives, per cent, bold headings, merged title, widths", B, {
    "fmt": {"0": {"B3": {"nf": "$#,##0.00"}, "D3": {"nf": "$#,##0.00;[Red]-$#,##0.00"}, "E3": {"nf": "0.0%"}, "A2": {"b": 1, "al": "center"},
                  "A11": {"b": 1}, "A1": {"b": 1, "al": "center"}}},
    "merges": {"0": ["A1:E1"]}, "widths": widths(B),
    "shown": {"0": {"C4": "$512.37", "D4": "-$62.37", "E3": "42.2%", "B11": "$2,830.00", "D11": "-$10.91", "B14": "$1,359.09", "B15": "41.9%", "A1": "Household Budget — November 2026"}}})
P_ = "parts.xlsx"
case("read-parts-lookup", "read", "a parts list: VLOOKUP exact (a number, a 0-led text code, lower case) and by bands, INDEX/MATCH, IFERROR", P_, {
    "values": vals(P_, rng("B", 2, 7) + rng("D", 2, 7) + rng("F", 2, 7) + rng("G", 2, 7) + ["E9", "G9", "D10", "D11", "A4", "A5", "I6"]),
    "shown": {"0": {"D2": "$4.85", "F3": "10%", "B7": "not in catalog", "G9": "$290.88", "A5": "00731"}},
    "notes_not_contain": ["differently"]})
T = "timesheet.xlsx"
case("read-timesheet", "read", "a timesheet: times, h:mm, [h]:mm past 24 hours, a night shift through MOD, decimal hours, pay", T, {
    "values": vals(T, rng("E", 2, 8) + rng("F", 2, 8) + rng("G", 2, 6) + ["F10", "B11", "C11", "D11", "B2", "C6"]),
    "fmt": {"0": {"E7": {"nf": "[h]:mm"}, "B2": {"nf": "h:mm AM/PM"}, "E2": {"nf": "h:mm"}}},
    "shown": {"0": {"A2": "Mon 11/16", "B2": "8:30 AM", "C6": "6:30 AM", "D2": "0:30", "E2": "8:15", "E6": "8:00", "E7": "41:15", "E8": "1:15",
                    "F7": "41.25", "F10": "$942.19", "B11": "8:30 AM"}}})
case("read-loan-openpyxl", "read", "a loan table from openpyxl (no values saved): PMT, IPMT, a 60-month schedule paid down to nothing", "loan.xlsx", {
    "values": lo_vals("loan.xlsx", ["B4", "B5", "B6", "E10", "C10", "D10", "A69", "C69", "C70", "D70"]),
    "values_abs": {"0": {"E69": [0, 1e-6]}},
    "shown": {"0": {"B4": "$489.15", "B2": "6.50%", "E10": "$24,646.26", "C70": "$4,349.22"}},
    "notes_not_contain": ["differently"]})
DT = "dates.xlsx"
case("read-dates-shown", "read", "one date and time in thirteen formats, as Excel (English, US) shows each", DT, {
    "values": vals(DT, ["B2", "B7"]),
    "fmt": {"0": {"B11": {"nf": "m/d/yyyy"}, "B4": {"nf": "dddd, mmmm d, yyyy"}}},
    "shown": {"0": {"B2": "11/17/2026", "B3": "17-Nov-26", "B4": "Tuesday, November 17, 2026", "B5": "2026-11-17", "B6": "Nov-26", "B7": "11/17/2026 14:30",
                    "B8": "2:30:00 PM", "B9": "17/11/2026", "B10": "November 17, 2026", "B11": "11/17/2026", "B12": "November 2026", "B13": "Tue", "B14": "17 Nov 2026"}}})
case("read-dates-sums", "read", "date sums: +30, EOMONTH, WEEKDAY, TEXT, DATEDIF, NETWORKDAYS, EDATE, DATE(2026,2,29), INT of a date-time, DATEVALUE, WORKDAY, ISOWEEKNUM", DT, {
    "values": vals(DT, rng("D", 2, 19)),
    "shown": {"0": {"D2": "12/17/2026", "D3": "11/30/2026", "D8": "2/28/2026", "D10": "3/1/2026", "D11": "11/17/2026", "D12": "14:30", "D15": "11/27/2026", "D5": "Tuesday"}},
    "notes_not_contain": ["differently"]})
PC = "percent.xlsx"
case("read-percent", "read", "per cent: growth with IFERROR, tax, Excel's built-in 0% and 0.00%, a number shown with a typed % sign", PC, {
    "values": vals(PC, rng("D", 2, 4) + rng("F", 2, 4) + rng("H", 2, 4) + ["D6", "B7", "B8", "E2", "G2"]),
    "fmt": {"0": {"E2": {"nf": "0.0%"}, "E3": {"nf": "0%"}, "E4": {"nf": "0.00%"}, "G2": {"nf": "0.0\"%\""}}},
    "shown": {"0": {"D2": "12.5%", "D3": "-5.0%", "D4": "n/a", "E2": "7.5%", "E3": "8%", "E4": "8.25%", "G2": "12.5%", "B7": "60.00%", "H2": "0.125", "D6": "3.8%"}}})
MN = "money.xlsx"
case("read-money-currency", "read", "money: $ with minus, Excel's built-in bracketed and red formats, pounds, yen, whole dollars", MN, {
    "fmt": {"0": {"B3": {"nf": "$#,##0.00_);($#,##0.00)"}, "B11": {"nf": "$#,##0_);($#,##0)"}}},
    "shown": {"0": {"B2": "$1,234.50", "C2": "-$1,234.50", "D2": "$0.00", "B3": "$1,234.50", "C3": "($1,234.50)", "C4": "($1,234.50)", "B6": "£1,234.50",
                    "C6": "-£1,234.50", "B8": "¥1,235", "C8": "-¥1,235", "B9": "1,234.50", "C9": "-1,234.50", "B10": "$1,235", "C10": "-$1,235",
                    "B11": "$1,235", "C11": "($1,235)", "B13": "$1,234.50", "C13": "($1,234.50)"}}})
case("read-money-accounting", "read", "money: Excel's Accounting format (the $ button), a euro format with a locale, an accounting total", MN, {
    "fmt": {"0": {"B5": {"nf": "_(\"$\"* #,##0.00_);_(\"$\"* \\(#,##0.00\\);_(\"$\"* \"-\"??_);_(@_)"}}},
    "values": vals(MN, ["B14"]),
    "shown": {"0": {"B5": "$1,234.50", "C5": "$(1,234.50)", "D5": "$-", "B7": "1,234.50€", "C7": "-1,234.50€", "B14": "$12,345.00"}}}, excel_only=True)
MG = "merged.xlsx"
case("read-merged-form", "read", "merged cells as a report has them: title, subtitle, cells down three rows, a total over three rows, a notes box", MG, {
    "merges": {"0": ["A1:F1", "A2:F2", "A5:A7", "A8:A10", "E5:E7", "E8:E10", "B12:F14"]},
    "fmt": {"0": {"A1": {"b": 1, "al": "center"}, "A2": {"i": 1, "al": "center"}}},
    "values": vals(MG, ["E5", "E8", "E11", "C11", "F5"]),
    "grid": {"0": {"A1": {"colSpan": 6}, "B1": {"hidden": True}, "A5": {"rowSpan": 3}, "A6": {"hidden": True}, "E5": {"rowSpan": 3}, "E7": {"hidden": True},
                   "B12": {"colSpan": 5, "rowSpan": 3}, "F14": {"hidden": True}}},
    "notes_not_contain": ["differently"]})
case("read-frozen-kinds", "read", "five sheets frozen five ways: top row, first column, both, two rows, a split that is not frozen", "frozen.xlsx", {
    "sheets": 5, "freeze": {"0": 1, "1": 0, "2": 1, "3": 1, "4": 0},
    "notes_contain": ["(?i)(?=.*first column)(?=.*(froz|column))", "(?i)(?=.*two rows)(?=.*(froz|row))"]})
H = "hidden_rows.xlsx"
case("read-hidden-rows", "read", "two hidden rows and SUBTOTAL(109)/AGGREGATE that leave them out; a hidden column", H, {
    "values": vals(H, ["B11", "B12", "B13", "B14", "B15"]),
    "notes_contain": ["(?i)hidden"]})
case("read-hidden-rows-said", "read", "...and where Lantern's total differs from Excel's because the rows are shown, the note says which cells", H, {
    "notes_contain": ["(?i)(?=.*B13)", "(?i)(?=.*B14)"]})
case("read-wrapped", "read", "wrapped text with line breaks typed in the cell (Alt+Enter)", "wrapped.xlsx", {
    "values": vals("wrapped.xlsx", ["B2", "B3", "C2", "C3", "D2"]),
    "notes_contain": ["(?i)wrap"]})
case("read-comments", "read", "two comments on prices", "comments.xlsx", {
    "values": vals("comments.xlsx", ["B4"]), "notes_contain": ["(?i)comment"]})
case("read-comments-where", "read", "...the note says which cells had comments", "comments.xlsx", {
    "notes_contain": ["(?i)(?=.*comment)(?=.*B2)"]})
case("read-chart-picture", "read", "a column chart and a picture on the sheet", "chart.xlsx", {
    "values": vals("chart.xlsx", ["B8"]), "notes_contain": ["(?i)chart", "(?i)(picture|image)"]})
case("read-conditional-formatting", "read", "colours by rule (over 90 green, under 60 red, data bars, a colour scale, late rows)", "condfmt.xlsx", {
    "values": vals("condfmt.xlsx", ["B7"]), "notes_contain": ["(?i)(conditional|by rule|rules)"]})
case("read-data-validation", "read", "drop-down lists and a whole-number rule", "validation.xlsx", {
    "values": vals("validation.xlsx", ["B6"]), "notes_contain": ["(?i)(drop-?down|validation|list of choices|allowed)"]})
NM = "names.xlsx"
case("read-names", "read", "names in formulas: a cell (TaxRate), a range (Amounts), a constant (Discount =0.1), a sheet's own (Shipping)", NM, {
    "values": vals(NM, rng("B", 10, 17)),
    "notes_not_contain": ["differently"]})
CS = "crosssheet.xlsx"
case("read-crosssheet", "read", "three months and a summary that adds them up from the other sheets (Jan!B6, Jan:Mar!B2, 'Bob''s rates'!B1)", CS, {
    "sheets": 5, "names": ["Jan", "Feb", "Mar", "Bob's rates", "Summary"],
    "values": vals(CS, rng("B", 2, 9), sheet=4)})
case("read-crosssheet-said", "read", "...the note names the summary's cells that cannot be worked out here", CS, {
    "notes_contain": ["(?i)another sheet|other sheet", "(?i)(?=.*Summary)(?=.*B2)"]})
SH = "shared.xlsx"
case("read-shared-formulas", "read", "shared formulas as Excel writes them: down a column, a running total, across a row, over a times table, a hole in the block", SH, {
    "cells": {"0": {"C5": "=A5*B5", "D5": "=SUM(C$2:C5)", "E5": "=C5/$C$11", "C10": "=A10*B10", "C12": "=MAX(C2:C10)", "E12": "=MAX(E2:E10)",
                    "F19": "=$A19*F$14", "J23": "=$A23*J$14", "G20": "=0*$A20", "B15": "=$A15*B$14"}},
    "values": vals(SH, rng("C", 2, 11) + rng("D", 2, 10) + rng("E", 2, 10) + ["B12", "C12", "D12", "E12", "F19", "J23", "G20"]),
    "notes_not_contain": ["differently"]})
AR = "arrays.xlsx"
case("read-array-formulas", "read", "array formulas: {=SUM(B2:B5*C2:C5)}, a four-cell {=B2:B5*C2:C5}, SUM(IF(...)), MAX of a product", AR, {
    "cells": {"0": {"C7": "=SUM(B2:B5*C2:C5)"}},
    "values": vals(AR, ["C7", "C8", "C9", "C10"] + rng("D", 2, 5))})
case("read-dynamic-arrays", "read", "Excel 365's spilling formulas: UNIQUE and SORT spill down", AR, {
    "values": vals(AR, rng("F", 2, 4) + rng("G", 2, 5))})
case("read-long-text", "read", "a paragraph of 3,000 characters and a cell at Excel's limit of 32,767", "longtext.xlsx", {
    "values": vals("longtext.xlsx", ["A1", "A2", "B1", "B2", "C1", "C2"])})
U = "unicode.xlsx"
case("read-unicode", "read", "names in many scripts, an emoji, a combining accent, a tab; a sheet named Données €", U, {
    "names": ["Données €"],
    "values": vals(U, rng("A", 2, 11) + rng("B", 2, 11) + ["C2", "C3", "D2", "D3"])})
TN = "text_numbers.xlsx"
case("read-text-kept-text", "read", "numbers and other things stored as text (zip codes, 1,500, 12%, TRUE, =5+5, 1/2, 2026-11-17, #N/A, 'quoted) stay text", TN, {
    "values": vals(TN, rng("A", 2, 22))})
case("read-text-numbers-sums", "read", "sums over numbers stored as text: SUM leaves them out, + turns them into numbers, COUNT is 0", TN, {
    "values": vals(TN, rng("D", 2, 17))})
BE = "bool_err.xlsx"
case("read-booleans", "read", "TRUE and FALSE: typed, summed (SUM leaves them out, + counts them), AND/OR over a range, COUNTIF", BE, {
    "values": vals(BE, rng("A", 2, 4) + rng("B", 2, 14))})
case("read-errors", "read", "errors typed and worked out: #N/A, #DIV/0!, #VALUE!, #REF!, #NAME?, #NUM!, #NULL!, IFERROR, IFNA, ERROR.TYPE, ISERR", BE, {
    "values": vals(BE, rng("C", 2, 8) + rng("D", 2, 16))})
ES = "empty_strings.xlsx"
case("read-empty-strings", "read", "\"\" from IF: COUNTA counts it, COUNTBLANK counts it as blank, \"\"+1 is #VALUE!, a blank cell is 0 and \"\"", ES, {
    "values": vals(ES, rng("B", 2, 6) + rng("C", 2, 17))})
D4 = "date1904_mac.xlsx"
case("read-1904-dates", "read", "a Mac workbook in the 1904 date system: dates, a start time, a 36-hour duration, DATE(), date + time", D4, {
    "values": {"0": {"A2": 46343.0, "A3": 46381.0, "B2": 0.3541666666666667, "C2": 1.5, "D2": 38.0, "E2": 2026.0, "F2": 46343.0, "G2": 8.5,
                     "H2": 46343.354166666664, "I2": "2026-11-17", "J2": 36.0, "K2": 0.00087962962962963, "L2": 0.25, "M2": 76.0}},
    "shown": {"0": {"A2": "11/17/2026", "B2": "8:30 AM", "C2": "36:00", "F2": "11/17/2026", "H2": "11/17/2026 8:30", "K2": "01:16.0", "L2": "6:00:00"}},
    "notes_not_contain": ["differently"]})
case("read-lo-trip", "read", "LibreOffice's file (from a flat ODF sheet): merged title, money in LibreOffice's [$$-409] form, per cent, a date, ROUND/IF/CEILING", "lo_trip.xlsx", {
    "values": vals("lo_trip.xlsx", rng("D", 3, 7) + ["B7", "B9", "B11", "B12", "B13", "B14"]),
    "merges": {"0": ["A1:D1"]}, "fmt": {"0": {"A1": {"b": 1, "al": "center"}, "B7": {"b": 1, "i": 1}}},
    "shown": {"0": {"B3": "$96.00", "B10": "November 20, 2026", "B13": "18.5%", "D7": "$80.29"}},
    "notes_not_contain": ["differently"]})
case("read-lo-grades", "read", "LibreOffice's file from an .ods: averages, pass/fail, RANK, COUNTIF, STDEV, AVERAGEIF", "lo_grades.xlsx", {
    "values": vals("lo_grades.xlsx", rng("E", 2, 7) + rng("F", 2, 8) + rng("G", 2, 7) + ["B9", "E9", "B10", "D10", "E11"]),
    "notes_not_contain": ["differently"]})
case("read-lo-csv", "read", "LibreOffice's file from a .csv: dates as dates, 00731 made a number, TRUE kept as text", "lo_orders.xlsx", {
    "values": vals("lo_orders.xlsx", ["A2", "E2", "F2", "F3", "E5", "B3", "D5"]),
    "shown": {"0": {"A2": "2026-11-02", "F2": "TRUE", "E2": "731"}}})
TB = "table.xlsx"
case("read-table", "read", "an Excel table: a worked-out column [@Qty]*[@Price], a total row, SUMIF and SUM over the table's columns", TB, {
    "values": vals(TB, rng("D", 2, 6) + ["B6", "G1", "G2"])})
case("read-table-said", "read", "...and if the table's formulas cannot be kept, the note says so", TB, {
    "notes_contain": ["(?i)table"]})
GN = "general_numbers.xlsx"
case("read-numbers-as-saved", "read", "numbers Excel saved with 17 digits (1.1000000000000001) show and edit as Excel shows them (1.1)", GN, {
    "cells": {"0": {"A2": "1.1", "A3": "0.3", "A4": "0.004", "A5": "0.09", "A8": "-0.1"}},
    "shown": {"0": {"A2": "1.1", "A3": "0.3", "B2": "3.3", "B3": "0.9", "A5": "0.09", "B8": "-0.3"}}})
case("read-quote-prefix", "read", "text typed with a leading apostrophe in Excel (=not a formula, 00123, TRUE, 1/2) and text-format cells stay text", GN, {
    "values": vals(GN, rng("C", 2, 9))})
FM = "formats.xlsx"
FORMS_SHOWN = ["3/4", "1 1/2", "1.23E+04", "02134", "(555) 123-4567", "123-45-6789", "12.5M", "-", "(42)", "3.142", "1,235", "12:00", "45 kg", "Qty: 7", "1.23",
               "1.2", "-3.5", "1.23E-04", "1,048,576", "1/16", "3", "-3", "12.50%"]
case("read-number-formats", "read", "other number formats: fractions, scientific, zip code, phone, SSN, millions, dash for zero, units, Qty: label", FM, {
    "shown": {"0": {"B%d" % (i + 2): s for i, s in enumerate(FORMS_SHOWN)}}})
FN = "functions.xlsx"
case("read-fn-rounding", "read", "rounding as Excel rounds: ROUND(2.675,2) 2.68, ROUND(1.005,2) 1.01, ROUND(-2.5) -3, MOD(-7,3) 2, 0.1+0.2=0.3 TRUE", FN, {
    "values": vals(FN, [r for r in rng("F", 2, 23) if r != "F23"]),
    "shown": {"0": {"F21": "0.1"}}})
case("read-fn-text", "read", "text functions: TRIM, PROPER, SUBSTITUTE, TEXT with $ % dates and times, TEXTJOIN, CONCAT, 1/3&\"\", FIXED, DOLLAR", FN, {
    "values": vals(FN, rng("I", 2, 26))})
case("read-fn-lookup", "read", "lookups and sums with conditions: SUMIF(S), COUNTIF(S) with wildcards, MAXIFS, XLOOKUP, INDEX/MATCH, HLOOKUP, IFS, SWITCH", FN, {
    "values": vals(FN, rng("L", 2, 26))})
case("read-fn-stats-money", "read", "statistics and money: AVERAGE, MEDIAN, STDEV, RANK, PERCENTILE, FV, NPV, IRR, RATE, NPER, PV, PMT, CUMIPMT", FN, {
    "values": vals(FN, rng("O", 2, 25))})
case("read-fn-notes", "read", "...the note names every cell Lantern works out otherwise than Excel, and no other", FN, {
    "notes_name_differences": {"sheet": 0, "values": vals(FN, [r for r in rng("F", 2, 23) + rng("I", 2, 26) + rng("L", 2, 26) + rng("O", 2, 25) if r != "F23"])["0"]}})
WD = "wide.xlsx"
case("read-wide", "read", "a month across 30 columns (to AE) with totals in column B; a log of 1,500 rows and its total", WD, {
    "values": {"0": {"B6": 385.0, "B7": 535.0, "B8": 685.0, "B9": 11.0, "B10": 30.0}, "1": {"B1503": 9730.0}},
    "rows_at_least": {"1": 1503}})
case("read-wide-said", "read", "...the note says the cells past Z are left out and names the totals that now differ", WD, {
    "notes_contain": ["(?i)past column Z|past Z", "(?i)(?=.*B6)"]})
case("read-whole-columns", "read", "whole columns in formulas: SUM(B:B), VLOOKUP over A:B, SUMIF(A:A,..,B:B), COUNTA(A:A), MATCH in A:A, SUM(3:3)",
     "whole_columns.xlsx", {"values": vals("whole_columns.xlsx", rng("E", 1, 8))})
OR = "openpyxl_report.xlsx"
case("read-openpyxl-report", "read", "a report written by a Python script (openpyxl): dates, #,##0.00, per cent, bold centred headings, frozen row, widths, a filter", OR, {
    "sheets": 2, "values": lo_vals(OR, rng("E", 2, 6) + rng("F", 2, 5)),
    "fmt": {"0": {"A2": {"nf": "yyyy-mm-dd"}, "D2": {"nf": "#,##0.00"}, "F2": {"nf": "0.0%"}, "A1": {"b": 1, "al": "center"}, "E6": {"b": 1, "al": "right"}, "A6": {"b": 1, "i": 1}}},
    "freeze": {"0": 1}, "widths": {"0": {"A": 12, "B": 20.5}},
    "shown": {"0": {"A2": "2026-11-02", "E5": "454.93", "F2": "22.3%", "E6": "1,163.93"}},
    "notes_not_contain": ["differently"], "notes_contain": ["(?i)comment"]})
case("read-filter-said", "read", "...the report's filter (the drop-down arrows on its headings) is not kept, and the note says so", OR, {
    "notes_contain": ["(?i)filter"]})
case("read-old-xls", "read", "an old Excel file (.xls): refused in plain words that say to save it as .xlsx", "old_format.xls", {
    "error_contains": ["(?i)\\.xlsx"], "alert_contains": ["(?i)\\.xlsx"]})
case("read-ods", "read", "a LibreOffice .ods given to Import file: refused in plain words (or opened)", "libreoffice_own.ods", {
    "error_contains": ["(?i)(ods|LibreOffice|OpenDocument|xlsx)"]})
case("read-password", "read", "a workbook locked with a password in Excel: refused in plain words that say it is locked", "password.xlsx", {
    "error_contains": ["(?i)(password|locked|encrypt)"], "alert_contains": ["(?i)(password|locked|encrypt)"]})
case("read-big", "read", "2,000 rows of 26 columns with a SUM in each row: opened in good time, every row there", "big_2000.xlsx", {
    "max_ms": 8000, "rows_at_least": {"0": 2000}, "values": {"0": {"Z1": BIGSUM(0), "Z1000": BIGSUM(999), "Z2000": BIGSUM(1999)}}})
case("read-python-zeros", "read", "a Python report with XlsxWriter's 0 saved beside every formula (Excel works them out on opening)", "pythonexport_zero.xlsx", {
    "values": {"0": {"D2": 375.0, "D3": 400.0, "D4": 114.0, "D5": 889.0}},
    "notes_not_contain": ["differently"]})


# =================================================================================================================
# 2. write: sheets as a person makes them in Lantern
# =================================================================================================================
def sheet(title, cells, **more):
    s = {"title": title, "cells": cells}
    s.update(more)
    return {"sheet": s}


TYPED = {"A1": "Item", "B1": "Typed", "A2": "Coffee", "B2": "$3.50", "A3": "Share", "B3": "12%", "A4": "Bolts", "B4": "1,500", "A5": "Due", "B5": "2026-11-17",
         "A6": "Paid", "B6": "11/17/2026", "A7": "Start", "B7": "3:30 PM", "A8": "Refund", "B8": "-$5.00", "A9": "Big", "B9": "1e3", "A10": "Euro", "B10": "€4.20",
         "A11": "Half", "B11": "50%", "A12": "Zip", "B12": "'02134", "A13": "Yes", "B13": "TRUE", "A14": "Pound", "B14": "£12.00", "A15": "Thousands", "B15": "12,345.67",
         "A16": "Tenth", "B16": "0.1", "A17": "Minus", "B17": "-42"}
case("write-typed-dates", "write", "dates and times typed as people type them (2026-11-17, 11/17/2026, 17 Nov 2026, 3:30 PM, 14:30) are dates and times in Excel, not text",
     sheet("When", {"A1": "Due", "B1": "2026-11-17", "A2": "Paid", "B2": "11/17/2026", "A3": "Met", "B3": "17 Nov 2026", "A4": "Start", "B4": "3:30 PM", "A5": "End", "B5": "14:30",
                    "A6": "In a month", "B6": "=B1+30"}), {
    "openpyxl": {"values": {"B1": {"date": "2026-11-17"}, "B2": {"date": "2026-11-17"}, "B3": {"date": "2026-11-17"}, "B4": {"time": "15:30"}, "B5": {"time": "14:30"}}},
    "lo_shown_same_as_lantern": ["B6"]})
case("write-typed-values", "write", "numbers typed as people type them: $3.50, 12%, 1,500, 1e3, -$5.00, €4.20, £12.00, '02134, TRUE (the dates in it are judged by write-typed-dates)", sheet("Typed", TYPED), {
    "schema_ok": True, "cell_values_ok": True,
    "openpyxl": {"values": {"B2": 3.5, "B3": 0.12, "B4": 1500, "B8": -5, "B9": 1000, "B10": 4.2,
                            "B11": 0.5, "B12": {"text": "02134"}, "B13": True, "B14": 12, "B15": 12345.67, "B16": 0.1, "B17": -42},
                 "nf_contains": {"B2": "$", "B3": "%", "B4": "#,##0", "B10": "€", "B11": "%", "B14": "£", "B8": "$"}},
    "lo_shown_same_as_lantern": ["B%d" % i for i in range(2, 18)]})
ARITH = {"A1": "Qty", "B1": "Price", "A2": "4", "B2": "2.5", "A3": "10", "B3": "0.75", "A4": "3", "B4": "19.99",
         "D1": "=SUM(A2:A4)", "D2": "=AVERAGE(B2:B4)", "D3": "=MIN(B2:B4)", "D4": "=MAX(B2:B4)", "D5": "=COUNT(A1:B4)", "D6": "=COUNTA(A1:B4)",
         "D7": "=SUMPRODUCT(A2:A4,B2:B4)", "D8": "=ROUND(B4*1.0825,2)", "D9": "=INT(-2.5)", "D10": "=MOD(-7,3)", "D11": "=ABS(-3)*SQRT(16)", "D12": "=POWER(2,10)",
         "D13": "=-2^2", "D14": "=2^3^2", "D15": "=A2/3", "D16": "=ROUND(2.675,2)", "D17": "=ROUND(1.005,2)", "D18": "=ROUNDUP(B2,0)+ROUNDDOWN(B4,1)",
         "D19": "=PRODUCT(A2:A4)", "D20": "=B3*100%", "D21": "=A3-A2*B2", "D22": "=(A3-A2)*B2", "D23": "=MEDIAN(A2:A4)", "D24": "=ROUND(0.285,2)",
         "D25": "=SUM(A2:A4)/COUNT(A2:A4)", "D26": "=TRUNC(-2.7)", "D27": "=CEILING(4.1,0.5)", "D28": "=FLOOR(4.9,0.5)", "D29": "=MROUND(17,5)", "D30": "=QUOTIENT(-7,2)"}
case("write-arithmetic", "write", "sums people make: SUM, AVERAGE, MIN/MAX, COUNT(A), SUMPRODUCT, ROUND (2.675, 1.005, 0.285), MOD, -2^2, 2^3^2", sheet("Arithmetic", ARITH), {
    "schema_ok": True, "cell_values_ok": True, "openpyxl": {"formulas_kept": True},
    "lo_same_as_lantern": True,
    "lo_values": {"D13": 4, "D14": 64, "D9": -3, "D10": 2, "D16": 2.68, "D17": 1.01, "D24": 0.29, "D21": 0, "D22": 15, "D30": -3}})
TEXTF = {"A1": "pump  seal", "A2": "o'neil", "A3": "Hydraulic", "A4": "Ann", "A5": "Bob", "B1": "3.5",
         "C1": '=A1&" kit"', "C2": "=CONCATENATE(A4,\" & \",A5)", "C3": "=LEFT(A3,5)", "C4": "=RIGHT(A3,3)", "C5": "=MID(A3,3,4)", "C6": "=LEN(A3)", "C7": "=UPPER(A4)",
         "C8": "=LOWER(A3)", "C9": "=PROPER(A2)", "C10": "=TRIM(\"  a   b  \")", "C11": '=SUBSTITUTE(A1,"  "," ")', "C12": '=TEXT(B1,"$#,##0.00")', "C13": '=REPT("-",4)',
         "C14": '=FIND("d",A3)', "C15": '=SEARCH("R",A3)', "C16": '=VALUE("1,234.5")', "C17": '=TEXTJOIN(", ",TRUE,A4:A5)', "C18": "=EXACT(A4,\"ann\")",
         "C19": '=CONCAT(A4,"-",A5)', "C20": '=TEXT(0.256,"0.0%")', "C21": '=A4&B1', "C22": '="Total: "&TEXT(1234.5,"#,##0")', "C23": "=1/3&\"\"", "C24": '=TEXT(46343,"yyyy-mm-dd")'}
case("write-text-functions", "write", "text: &, CONCATENATE, LEFT/RIGHT/MID, LEN, UPPER/LOWER/PROPER, TRIM, SUBSTITUTE, TEXT, FIND/SEARCH, VALUE, TEXTJOIN, CONCAT", sheet("Text", TEXTF), {
    "schema_ok": True, "cell_values_ok": True, "openpyxl": {"formulas_kept": True}, "lo_same_as_lantern": True,
    "lo_values": {"C10": "a b", "C9": "O'Neil", "C12": "$3.50", "C21": "Ann3.5", "C23": "0.333333333333333", "C24": "2026-11-17"}})
LOOK = {"A1": "Part", "B1": "Price", "C1": "Region", "A2": "BRG-6204", "B2": "4.85", "C2": "North", "A3": "SEAL-35", "B3": "2.15", "C3": "South", "A4": "VB-A42", "B4": "9.99", "C4": "North",
        "E1": '=VLOOKUP("SEAL-35",A2:B4,2,FALSE)', "E2": '=VLOOKUP("vb-a42",A2:B4,2,FALSE)', "E3": "=INDEX(B2:B4,MATCH(\"VB-A42\",A2:A4,0))", "E4": '=HLOOKUP("Price",A1:C4,2,FALSE)',
        "E5": '=SUMIF(C2:C4,"North",B2:B4)', "E6": '=COUNTIF(B2:B4,">3")', "E7": '=AVERAGEIF(C2:C4,"North",B2:B4)', "E8": '=SUMIFS(B2:B4,C2:C4,"North",B2:B4,">5")',
        "E9": '=COUNTIFS(C2:C4,"North",B2:B4,"<5")', "E10": '=IFERROR(VLOOKUP("XX",A2:B4,2,FALSE),"none")', "E11": '=IFNA(MATCH("XX",A2:A4,0),0)', "E12": '=CHOOSE(2,"a","b","c")',
        "E13": "=VLOOKUP(5,{0,\"low\";5,\"mid\";10,\"high\"},2,TRUE)", "E14": '=MATCH("S*",A2:A4,0)', "E15": "=LOOKUP(3,{1,2,3},{\"x\",\"y\",\"z\"})", "E16": '=COUNTIF(A2:A4,"*-*")'}
case("write-lookups", "write", "lookups: VLOOKUP (any case), INDEX/MATCH, HLOOKUP, SUMIF(S), COUNTIF(S), AVERAGEIF, IFERROR, IFNA, CHOOSE, wildcards", sheet("Lookup", LOOK), {
    "schema_ok": True, "cell_values_ok": True, "openpyxl": {"formulas_kept": True}, "lo_same_as_lantern": True,
    "lo_values": {"E1": 2.15, "E2": 9.99, "E5": 14.84, "E6": 2, "E8": 9.99, "E9": 1, "E10": "none", "E11": 0, "E13": "mid", "E14": 2, "E16": 3}})
LOGIC = {"A1": "7", "A2": "", "A3": "abc", "A4": "TRUE",
         "C1": '=IF(A1>5,"big","small")', "C2": "=AND(A1>5,A1<10)", "C3": "=OR(A1<0,A1=7)", "C4": "=NOT(A1=7)", "C5": "=A1>=7", "C6": "=A1<>7", "C7": "=ISBLANK(A2)",
         "C8": "=ISNUMBER(A1)", "C9": "=ISTEXT(A3)", "C10": '="abc"="ABC"', "C11": "=A4+1", "C12": "=IF(A4,1,0)", "C13": '=IFS(A1>10,"x",A1>5,"y",TRUE,"z")',
         "C14": '=SWITCH(A1,1,"one",7,"seven","other")', "C15": "=XOR(TRUE,FALSE)", "C16": '=IF(A2="","empty","full")', "C17": "=A2=0", "C18": "=COUNTBLANK(A1:A3)"}
case("write-logic", "write", "IF, AND/OR/NOT, comparisons, IS functions, IFS, SWITCH, XOR: TRUE and FALSE saved as Excel's booleans", sheet("Logic", LOGIC), {
    "schema_ok": True, "cell_values_ok": True, "openpyxl": {"formulas_kept": True}, "lo_same_as_lantern": True,
    "lo_values": {"C1": "big", "C2": True, "C3": True, "C4": False, "C10": True, "C11": 2, "C13": "y", "C14": "seven", "C15": True, "C17": True}})
DATES = {"A1": "Start", "B1": "2026-11-17", "A2": "End", "B2": "2026-12-25", "A3": "Born", "B3": "1990-05-20",
         "D1": "=B2-B1", "D2": "=B1+30", "D3": "=DATE(2026,2,29)", "D4": "=EDATE(B1,3)", "D5": "=EOMONTH(B1,0)", "D6": '=DATEDIF(B3,B1,"y")', "D7": "=NETWORKDAYS(B1,B2)",
         "D8": "=WORKDAY(B1,10)", "D9": "=WEEKDAY(B1)", "D10": "=YEAR(B1)*100+MONTH(B1)", "D11": "=DAY(B2)", "D12": '=TEXT(B1,"dddd")', "D13": "=DAYS(B2,B1)",
         "D14": "=ISOWEEKNUM(B1)", "D15": '=DATEVALUE("2026-11-17")', "D16": "=TIME(14,30,0)", "D17": "=HOUR(D16)", "D18": "=YEARFRAC(B1,B2)", "D19": "=TODAY()-TODAY()"}
case("write-dates", "write", "date sums on typed dates: subtraction, +30, DATE, EDATE, EOMONTH, DATEDIF, NETWORKDAYS, WORKDAY, DAYS, TIME: worked out and shown as Lantern showed them", sheet("Dates", DATES), {
    "schema_ok": True, "cell_values_ok": True, "openpyxl": {"formulas_kept": True}, "lo_same_as_lantern": True,
    "lo_values": {"D1": 38, "D2": 46373, "D3": 46082, "D4": 46435, "D5": 46356, "D6": 36, "D7": 29, "D9": 3, "D13": 38, "D14": 47},
    "lo_shown_same_as_lantern": ["B1", "D2", "D3", "D4", "D5", "D8", "D16"]})
MONEYF = {"A1": "Loan", "B1": "$25,000", "A2": "Rate", "B2": "6.5%", "A3": "Years", "B3": "5",
          "D1": "=PMT(B2/12,B3*12,-B1)", "D2": "=FV(0.05/12,120,-200)", "D3": "=PV(0.05,10,-1000)", "D4": "=NPV(0.08,-1000,300,400,500)", "D5": "=IRR({-1000,300,400,500})",
          "D6": "=RATE(60,-489.15,25000)", "D7": "=NPER(B2/12,-489.15,B1)", "D8": "=IPMT(B2/12,1,B3*12,-B1)", "D9": "=PPMT(B2/12,1,B3*12,-B1)", "D10": "=SLN(10000,1000,5)",
          "D11": "=EFFECT(0.065,12)", "D12": "=CUMIPMT(B2/12,B3*12,B1,1,12,0)"}
case("write-money-functions", "write", "money sums: a typed $25,000 and 6.5%, PMT, FV, PV, NPV, IRR, RATE, NPER, IPMT, PPMT, SLN, EFFECT, CUMIPMT", sheet("Loan", MONEYF), {
    "schema_ok": True, "cell_values_ok": True, "openpyxl": {"formulas_kept": True}, "lo_same_as_lantern": True,
    "lo_values": {"D1": 489.1537054682137, "D3": 7721.734929184818, "D10": 1800}})
NEWER = {"A1": "Ann", "A2": "Bob", "A3": "Cy", "B1": "120", "B2": "80", "B3": "45",
         "C1": '=CONCAT(A1,A2)', "C2": '=TEXTJOIN("/",TRUE,A1:A3)', "C3": '=IFS(B1>100,"hi",TRUE,"lo")', "C4": '=SWITCH(A2,"Bob",2,0)', "C5": '=MAXIFS(B1:B3,A1:A3,"<>Ann")',
         "C6": '=MINIFS(B1:B3,B1:B3,">50")', "C7": '=XLOOKUP("Cy",A1:A3,B1:B3)', "C8": "=XMATCH(80,B1:B3)", "C9": '=IFNA(NA(),"n/a")', "C10": "=XOR(B1>100,B2>100)",
         "C11": "=DAYS(46381,46343)", "C12": "=ISOWEEKNUM(46343)", "C13": "=STDEV.S(B1:B3)", "C14": "=CEILING.MATH(4.1)", "C15": "=FLOOR.MATH(4.9)",
         "C16": "=NORM.DIST(1,0,1,TRUE)", "C17": "=PERCENTILE.INC(B1:B3,0.5)", "C18": "=RANK.EQ(80,B1:B3)", "C19": "=AGGREGATE(9,6,B1:B3)", "C20": '=NUMBERVALUE("1.234,5",",",".")',
         "C21": '=TEXTBEFORE("a-b","-")', "C22": "=ISFORMULA(C1)", "C23": "=MODE.SNGL(1,2,2)", "C24": "=COVARIANCE.S(B1:B3,{1;2;3})", "C25": "=UNICHAR(9731)",
         "C26": "=NETWORKDAYS.INTL(46343,46381,1)", "C27": "=BASE(10,2)", "C28": "=GAMMA(5)", "C29": "=ARABIC(\"XIV\")", "C30": "=FORECAST.LINEAR(4,B1:B3,{1;2;3})"}
PREFIX = {"C1": "_xlfn.CONCAT(", "C2": "_xlfn.TEXTJOIN(", "C3": "_xlfn.IFS(", "C4": "_xlfn.SWITCH(", "C5": "_xlfn.MAXIFS(", "C6": "_xlfn.MINIFS(", "C7": "_xlfn.XLOOKUP(",
          "C8": "_xlfn.XMATCH(", "C9": "_xlfn.IFNA(", "C10": "_xlfn.XOR(", "C11": "_xlfn.DAYS(", "C12": "_xlfn.ISOWEEKNUM(", "C13": "_xlfn.STDEV.S(", "C14": "_xlfn.CEILING.MATH(",
          "C15": "_xlfn.FLOOR.MATH(", "C16": "_xlfn.NORM.DIST(", "C17": "_xlfn.PERCENTILE.INC(", "C18": "_xlfn.RANK.EQ(", "C19": "_xlfn.AGGREGATE(", "C20": "_xlfn.NUMBERVALUE(",
          "C21": "_xlfn.TEXTBEFORE(", "C22": "_xlfn.ISFORMULA(", "C23": "_xlfn.MODE.SNGL(", "C24": "_xlfn.COVARIANCE.S(", "C25": "_xlfn.UNICHAR(", "C26": "NETWORKDAYS.INTL(",
          "C27": "_xlfn.BASE(", "C28": "_xlfn.GAMMA(", "C29": "_xlfn.ARABIC(", "C30": "_xlfn.FORECAST.LINEAR("}
case("write-newer-functions", "write", "Excel 2010-365 functions saved with the _xlfn. Excel needs (else #NAME? in Excel): CONCAT ... FORECAST.LINEAR", sheet("Newer", NEWER), {
    "schema_ok": True, "xml_f_prefix": PREFIX, "notes_not_contain": ["(?i)does not have"]}, excel_only=True)
case("write-newer-functions-values", "write", "...and LibreOffice, reading those names, works them out as Lantern does", sheet("Newer", NEWER), {
    "lo_same_as_lantern": True, "lo_skip": ["C7", "C8", "C21"]})
XF = ["ABS(-3.5)", "ACOS(0.5)", "ADDRESS(2,3)", "ADDRESS(2,3,4)", "AND(A1>1,B1>1)", "ASIN(0.5)", "ATAN(1)", "ATAN2(1,2)", "AVEDEV(A1:A6)", "AVERAGE(A1:A6)",
      "AVERAGEA(A1:A6)", "AVERAGEIF(A1:A6,\">3\")", "BASE(10,2)", "BASE(255,16,4)", "BIN2DEC(\"1010\")", "BINOM.DIST(3,10,0.5,FALSE)", "BINOMDIST(3,10,0.5,TRUE)",
      "CEILING(4.1,0.5)", "CEILING.MATH(-4.1)", "CEILING.PRECISE(4.1)", "CHAR(65)", "CHOOSE(2,\"a\",\"b\")", "CLEAN(\"a\"&CHAR(7)&\"b\")", "CODE(\"A\")", "COLUMN(C5)",
      "COLUMNS(A1:C1)", "COMBIN(5,2)", "CONCATENATE(\"a\",1)", "CONFIDENCE(0.05,1,30)", "CONFIDENCE.NORM(0.05,1,30)", "CONVERT(1,\"in\",\"cm\")", "CONVERT(100,\"F\",\"C\")",
      "CONVERT(1,\"lbm\",\"kg\")", "CORREL(A1:A6,B1:B6)", "COS(PI())", "COUNT(A1:A6)", "COUNTA(A1:C6)", "COUNTBLANK(A1:C6)", "COUNTIF(A1:A6,\">3\")", "COVAR(A1:A6,B1:B6)",
      "COVARIANCE.P(A1:A6,B1:B6)", "COVARIANCE.S(A1:A6,B1:B6)", "CUMIPMT(0.01,12,1000,1,12,0)", "CUMPRINC(0.01,12,1000,1,12,0)", "DATE(2026,11,17)",
      "DATEDIF(DATE(2020,1,1),DATE(2026,11,17),\"m\")", "DATEVALUE(\"11/17/2026\")", "DAY(46343)", "DAYS(46381,46343)", "DAYS360(DATE(2026,1,31),DATE(2026,3,31))",
      "DB(10000,1000,5,1)", "DDB(10000,1000,5,1)", "DEC2BIN(10)", "DEC2HEX(255)", "DEC2OCT(8)", "DEGREES(PI())", "DEVSQ(A1:A6)", "DOLLAR(1234.567,1)", "EDATE(46343,1)",
      "EFFECT(0.05,4)", "EOMONTH(46343,1)", "EVEN(1.5)", "EXACT(\"a\",\"A\")", "EXP(1)", "FACT(5)", "FIND(\"o\",\"Hello\")", "FIXED(1234.567,1,TRUE)", "FLOOR(4.9,2)",
      "FLOOR.MATH(-4.1)", "FLOOR.PRECISE(4.9)", "FORECAST(4,A1:A3,B1:B3)", "FV(0.01,12,-100)", "GAMMA(5)", "GCD(12,18)", "GEOMEAN(A1:A6)", "HARMEAN(A1:A6)",
      "HEX2DEC(\"FF\")", "HLOOKUP(3,A1:B6,2,FALSE)", "HOUR(0.75)", "INDEX(A1:B6,2,2)", "INT(-3.5)", "INTERCEPT(A1:A6,B1:B6)", "IPMT(0.01,1,12,1000)", "ISEVEN(4)", "ISODD(3)",
      "ISOWEEKNUM(46343)", "LARGE(A1:A6,2)", "LCM(4,6)", "LEFT(\"Hello\",2)", "LEN(\"Hello\")", "LN(10)", "LOG(100)", "LOG(8,2)", "LOG10(1000)", "LOWER(\"ABC\")",
      "MATCH(9,A1:A6,0)", "MAX(A1:A6)", "MAXA(A1:A6)", "MAXIFS(A1:A6,B1:B6,\">2\")", "MEDIAN(A1:A6)", "MID(\"Hello\",2,3)", "MIN(A1:A6)", "MINA(A1:A6)",
      "MINIFS(A1:A6,B1:B6,\">2\")", "MINUTE(0.75)", "MOD(10,3)", "MODE(1,2,2,3)", "MODE.SNGL(1,2,2,3)", "MONTH(46343)", "MROUND(10,3)", "N(5)", "NETWORKDAYS(46343,46381)",
      "NOMINAL(0.05,4)", "NORM.DIST(1,0,1,TRUE)", "NORM.INV(0.9,0,1)", "NORM.S.DIST(1,TRUE)", "NORM.S.INV(0.9)", "NORMDIST(1,0,1,TRUE)", "NORMINV(0.9,0,1)", "NORMSDIST(1)",
      "NORMSINV(0.9)", "NOT(TRUE)", "NPER(0.01,-100,1000)", "NPV(0.1,100,200)", "OCT2DEC(\"17\")", "ODD(2)", "OR(FALSE,TRUE)", "PEARSON(A1:A6,B1:B6)",
      "PERCENTILE(A1:A6,0.3)", "PERCENTILE.EXC(A1:A6,0.3)", "PERCENTILE.INC(A1:A6,0.3)", "PERCENTRANK(A1:A6,4)", "PERCENTRANK.INC(A1:A6,4)", "PERMUT(5,2)", "PMT(0.01,12,1000)",
      "POWER(2,0.5)", "PPMT(0.01,1,12,1000)", "PRODUCT(A1:A3)", "PROPER(\"hello world\")", "PV(0.01,12,-100)", "QUARTILE(A1:A6,1)", "QUARTILE.EXC(A1:A6,1)", "QUARTILE.INC(A1:A6,3)",
      "QUOTIENT(10,3)", "RADIANS(180)", "RANK(4,A1:A6)", "RANK.AVG(4,A1:A6)", "RANK.EQ(4,A1:A6)", "RATE(12,-100,1000)", "REPLACE(\"Hello\",1,1,\"J\")", "REPT(\"ab\",2)",
      "RIGHT(\"Hello\",2)", "ROMAN(1999)", "ROUND(2.5,0)", "ROUNDDOWN(2.9,0)", "ROUNDUP(2.1,0)", "ROW(C5)", "ROWS(A1:A6)", "RSQ(A1:A6,B1:B6)", "SEARCH(\"l\",\"Hello\")",
      "SECOND(0.75+5/86400)", "SIGN(-3)", "SIN(PI()/2)", "SLN(1000,100,5)", "SLOPE(A1:A6,B1:B6)", "SMALL(A1:A6,2)", "SQRT(16)", "SQRTPI(2)", "STANDARDIZE(1,0,2)",
      "STDEV(A1:A6)", "STDEV.P(A1:A6)", "STDEV.S(A1:A6)", "STDEVP(A1:A6)", "STEYX(A1:A6,B1:B6)", "SUBSTITUTE(\"aaa\",\"a\",\"b\",2)", "SUBTOTAL(9,A1:A6)", "SUBTOTAL(1,A1:A6)",
      "SUM(A1:A6)", "SUMIF(A1:A6,\">3\")", "SUMIFS(A1:A6,B1:B6,\">2\")", "SUMPRODUCT(A1:A6,B1:B6)", "SUMSQ(A1:A3)", "SWITCH(2,1,\"a\",2,\"b\")", "SYD(1000,100,5,1)",
      "T(\"abc\")", "T(5)", "TAN(PI()/4)", "TEXT(1234.5,\"0.0\")", "TEXTJOIN(\"-\",TRUE,\"a\",\"b\")", "TIME(12,30,0)", "TIMEVALUE(\"12:30\")", "TRIM(\" a  b \")",
      "TRUNC(-2.7)", "UNICHAR(65)", "UNICODE(\"A\")", "UPPER(\"abc\")", "VALUE(\"12.5\")", "VAR(A1:A6)", "VAR.P(A1:A6)", "VAR.S(A1:A6)", "VARP(A1:A6)",
      "VLOOKUP(9,A1:B6,2,FALSE)", "WEEKDAY(46343,2)", "WEEKNUM(46343)", "WORKDAY(46343,10)", "WORKDAY.INTL(46343,10,11)", "NETWORKDAYS.INTL(46343,46381,11)", "XOR(TRUE,TRUE)",
      "YEAR(46343)", "YEARFRAC(46343,46381,1)", "CEILING(-4.1,-1)", "FLOOR(-4.1,-1)", "ROUND(-1.5,0)", "MOD(-1,4)", "ODD(-1.5)", "EVEN(-1.5)", "TRUNC(1.999,2)", "LOG(0.001)",
      "COMBIN(10,0)", "FACT(0)", "GCD(0,5)", "STDEV(5,5)", "ISOWEEKNUM(DATE(2027,1,1))", "WEEKNUM(DATE(2027,1,1),2)", "WEEKDAY(DATE(2026,11,22))", "DATEDIF(DATE(2026,1,31),DATE(2026,3,1),\"md\")"]
XFC = {"A%d" % (i + 1): str(v) for i, v in enumerate([3, 7, 1, 9, 4, 6])}
XFC.update({"B%d" % (i + 1): str(v) for i, v in enumerate([2, 5, 1, 8, 3, 7])})
XFC["C1"] = "Hello World"
for i, f in enumerate(XF): XFC["E%d" % (i + 1)] = "=" + f
case("write-excel-functions", "write", "%d calls of the Excel functions Lantern has (ABS ... YEARFRAC), saved: LibreOffice works each out as Lantern showed it" % len(XF), sheet("Functions", XFC), {
    "schema_ok": True, "lo_same_as_lantern": True})
case("write-big", "write", "a sheet of 2,000 rows and 26 columns, a SUM in each row: saved in good time, as the schema has it, LibreOffice works it out",
     {"sheet": {"title": "Big", "cells": {}}, "fill": {"rows": 2000}}, {"max_ms": 8000, "schema_ok": True, "lo_values": {"Z1": BIGSUM(1), "Z2000": BIGSUM(2000)}, "lo_same_as_lantern": True})
case("write-gamma-name-clash", "write", "Lantern's GAMMA (the Lorentz factor) saved: Excel's GAMMA is another function (the gamma function), so it is named in the notes, not saved as Excel's",
     sheet("Relativity", {"A1": "Speed", "B1": "=0.5*299792458", "A2": "Lorentz factor", "B2": "=GAMMA(B1)"}), {
    "notes_contain": ["(?i)GAMMA"], "lo_same_as_lantern": True})
LANT = {"A1": "2", "A2": "3", "B1": "=17%5", "B2": "=pi*2", "B3": "=e^2", "B4": "=VOLTS(2,3)", "B5": "=sqrt(16)", "B6": "=round(2.5,0)", "B7": "=sum(a1:a2)",
        "B8": "=POW(2,3)", "B9": "=CEIL(2.1)", "B10": "=PI*A1", "B11": "=A1(A2)"}
case("write-lantern-only", "write", "Lantern's own: 17%5, pi, e, VOLTS, lower-case sqrt/round/sum, POW and CEIL (not Excel's), PI without ()", sheet("Mine", LANT), {
    "schema_ok": True,
    "openpyxl": {"formulas_any_case": True, "formulas": {"B2": "=PI()*2", "B3": "=EXP(1)^2", "B5": "=SQRT(16)", "B6": "=ROUND(2.5,0)", "B7": "=SUM(A1:A2)", "B10": "=PI()*A1"}},
    "notes_contain": ["(?i)(?=.*17%5|.*B1)(?=.*text)", "(?i)VOLTS", "(?i)POW", "(?i)CEIL"],
    "lo_values": {"B2": 6.283185307179586, "B3": 7.38905609893065, "B5": 4, "B6": 3, "B7": 5, "B10": 6.283185307179586}})
ERRV = {"A1": "0", "B1": "=1/A1", "B2": "=SQRT(-1)", "B3": "=10^400", "B4": "=LN(0)", "B5": "=NA()", "B6": "=FACT(200)", "B7": "=2^1024", "B8": "=EXP(1000)",
        "B9": '=VLOOKUP("zz",A1:A1,1,FALSE)', "B10": '="a"+1', "B11": "=-10^400", "B12": "=0/0"}
case("write-error-values", "write", "sums that overflow or fail (1/0, SQRT(-1), 10^400, LN(0), FACT(200), 2^1024): no Infinity or NaN saved where Excel wants a number", sheet("Errors", ERRV), {
    "schema_ok": True, "cell_values_ok": True,
    "lo_values": {"B1": "#DIV/0!", "B5": "#N/A", "B9": "#N/A", "B10": "#VALUE!"}}, excel_only=True)
LAY = {"A1": "Fence materials", "A2": "Item", "B2": "Qty", "C2": "Price", "D2": "Cost", "A3": "Posts", "B3": "12", "C3": "$8.50", "D3": "=B3*C3",
       "A4": "Rails", "B4": "22", "C4": "$4.25", "D4": "=B4*C4", "A5": "Total", "D5": "=SUM(D3:D4)", "A6": "note", "B6": "12.5%", "C6": "=D5*B6"}
LAYFMT = {"A1": {"b": 1, "al": "center"}, "A2": {"b": 1}, "B2": {"b": 1, "al": "center"}, "C2": {"b": 1, "al": "right"}, "D2": {"b": 1, "al": "right"},
          "A5": {"b": 1, "i": 1}, "A6": {"i": 1}, "D5": {"b": 1, "nf": "$#,##0.00"}, "D3": {"nf": "$#,##0.00"}, "B6": {"nf": "0.0%"}, "C6": {"nf": "#,##0.00"}}
case("write-layout", "write", "a merged title, column widths, the top row frozen, bold, italic, alignment, number formats", sheet("Fence", LAY, fmt=LAYFMT, widths={"A": 20, "B": 8.5, "D": 14.25}, merges=["A1:D1"], freeze=1), {
    "schema_ok": True,
    "openpyxl": {"merges": ["A1:D1"], "widths": {"A": 20, "B": 8.5, "D": 14.25}, "freeze": "A2", "bold": ["A1", "A2", "B2", "D5", "A5"], "italic": ["A5", "A6"],
                 "align": {"A1": "center", "B2": "center", "C2": "right"}, "nf": {"D5": "$#,##0.00", "B6": "0.0%", "C6": "#,##0.00", "D3": "$#,##0.00", "C3": "$#,##0.00"}},
    "lo_same_as_lantern": True, "lo_shown_same_as_lantern": ["C3", "D3", "D5", "B6", "C6"]})
case("write-sheet-name-chars", "write", "a sheet titled with characters Excel forbids in a sheet name: Q1/Q2 [draft]: costs?*", sheet("Q1/Q2 [draft]: costs?*", {"A1": "x", "B1": "=1+1"}), {
    "schema_ok": True, "sheet_name_valid": True, "lo_opens": True})
case("write-sheet-name-long", "write", "a sheet titled longer than Excel's 31 characters", sheet("Household budget for the whole of 2026 including taxes", {"A1": "x"}), {
    "sheet_name_valid": True, "lo_opens": True}, excel_only=True)
case("write-sheet-name-quote", "write", "a sheet titled with an apostrophe at each end ('Draft')", sheet("'Draft'", {"A1": "x"}), {
    "sheet_name_valid": True}, excel_only=True)
case("write-sheet-name-history", "write", "a sheet titled History (a name Excel keeps for itself)", sheet("History", {"A1": "1900", "B1": "Coal"}), {
    "sheet_name_valid": True}, excel_only=True)
case("write-sheet-name-empty", "write", "a sheet with no title", sheet("", {"A1": "x"}), {"sheet_name_valid": True, "schema_ok": True})
case("write-control-chars", "write", "text pasted from Word or a PDF with a vertical tab, a form feed and a bell in it (XML cannot hold them as they are)",
     sheet("Pasted", {"A1": "Line\x0bbreak from Word", "A2": "Page\x0cbreak", "A3": "Bell\x07", "A4": "plain"}), {
    "xml_well_formed": True, "lo_opens": True, "lo_values_contain": {"A1": "break from Word", "A2": "break", "A4": "plain"}}, excel_only=True)
case("write-x-escape-literal", "write", "text that happens to read like Excel's escape (_x0041_) comes back as typed, not as A",
     sheet("Escape", {"A1": "_x0041_ is how Excel writes A", "A2": "file_x000D_name"}), {
    "lo_values": {"A1": "_x0041_ is how Excel writes A", "A2": "file_x000D_name"}})
case("write-long-text", "write", "a cell longer than Excel's 32,767 characters (a pasted log): cut to the limit, and said",
     sheet("Log", {"A1": ("Pump 3 tripped on overload; reset and logged. " * 900)[:40000], "A2": "end"}), {
    "max_text_len": 32767, "notes_contain": ["(?i)(32,?767|too long|cut|shortened)"]}, excel_only=True)
case("write-empty", "write", "an empty sheet", sheet("Empty", {}), {"schema_ok": True, "lo_opens": True, "openpyxl": {"opens": True}})
case("write-old-dates", "write", "dates before 1900 typed in a family history (1888-03-12): Excel keeps them as text, not as a date it cannot show",
     sheet("Family", {"A1": "Born", "B1": "1888-03-12", "A2": "Died", "B2": "1951-07-04"}), {
    "openpyxl": {"values": {"B1": {"text": "1888-03-12"}}}, "lo_shown_same_as_lantern": ["B1"]})
case("write-spaces-breaks", "write", "text with spaces at the ends, a line break and a tab comes back exactly",
     sheet("Spaces", {"A1": "  indented", "A2": "trailing  ", "A3": "Line one\nLine two", "A4": "a\tb", "A5": "  both  "}), {
    "lo_values": {"A1": "  indented", "A2": "trailing  ", "A3": "Line one\nLine two", "A4": "a\tb", "A5": "  both  "}})
case("write-spaces-preserve", "write", "...and is marked xml:space=\"preserve\" as Excel marks it (Excel drops the spaces at the ends otherwise)",
     sheet("Spaces", {"A1": "  indented", "A2": "trailing  ", "A3": "Line one\nLine two", "A4": "a\tb", "A5": "  both  "}), {"xml_space_preserve": ["A1", "A2", "A5"]}, excel_only=True)
case("write-apostrophe-text", "write", "text typed with an apostrophe ('=not a formula, '00123, 'TRUE, '1/2) is saved as text",
     sheet("Quoted", {"A1": "'=not a formula", "A2": "'00123", "A3": "'TRUE", "A4": "'1/2", "A5": "'12%"}), {
    "lo_values": {"A1": "=not a formula", "A2": "00123", "A3": "TRUE", "A4": "1/2", "A5": "12%"}, "openpyxl": {"data_type": {"A1": "s", "A2": "s", "A3": "s", "A4": "s", "A5": "s"}}})
case("write-make-sheet", "write", "MAKE SHEET's table saved with Save .xlsx: formulas by column name become cell formulas Excel works out",
     {"make_sheet": "MAKE SHEET: Paint\nRoom | Wall area m2 | Litres per m2 | Litres\nHall | 24 | 0.1 | =[Wall area m2]*[Litres per m2]\nKitchen | 30 | 0.1 | =[Wall area m2]*[Litres per m2]\nTotal | | | =SUM([Litres])\nEND"}, {
    "schema_ok": True, "openpyxl": {"formulas_kept": True}, "lo_values": {"D2": 2.4, "D3": 3, "D4": 5.4}, "name": "Paint.xlsx"})
case("write-ui-toolbar", "write", "Save .xlsx in the sheet's toolbar: the file named after the sheet, LibreOffice opens it with the same values",
     {"ui": True, "sheet": {"title": "Shed costs", "cells": {"A1": "Item", "B1": "Cost", "A2": "Timber", "B2": "$412.80", "A3": "Roofing", "B3": "$189.99", "A4": "Total", "B4": "=SUM(B2:B3)", "A5": "Each of 3", "B5": "=B4/3"}}}, {
    "schema_ok": True, "name": "Shed costs.xlsx", "lo_same_as_lantern": True, "lo_values": {"B4": 602.79, "B5": 200.93}})
case("write-typed-out-of-order", "write", "cells typed in no order (C1, then A1, B10, B2, A10, A2): rows and cells saved in the order Excel requires",
     sheet("Order", {"C1": "c", "A1": "a", "B10": "10", "B2": "2", "A10": "=B10*2", "A2": "x", "Z3": "z", "B1": "b"}), {
    "schema_ok": True, "excel_rules": True, "lo_values": {"A10": 20, "C1": "c", "Z3": "z"}}, excel_only=True)
case("write-broken-formulas", "write", "formulas left unfinished (=, =SUM(, =A1+, =(1+2, ==A1): saved as their text, said, and the file opens",
     sheet("Unfinished", {"A1": "5", "B1": "=", "B2": "=SUM(", "B3": "=A1+", "B4": "=(1+2", "B5": "==A1", "B6": "=A1*2"}), {
    "schema_ok": True, "excel_rules": True, "lo_values": {"B1": "=", "B2": "=SUM(", "B3": "=A1+", "B4": "=(1+2", "B6": 10},
    "notes_contain": ["(?i)saved as text"]})
FMTS = {"A1": "1.5", "A2": "0.000123", "A3": "1.520833", "A4": "0.6041667", "A5": "0.6041667", "A6": "46343", "A7": "46343", "A8": "46343", "A9": "46343",
        "A10": "1234.5", "A11": "1234.5", "A12": "1234.5", "A13": "0.125", "A14": "0.125", "A15": "-1234.5", "A16": "1234.5"}
FMTF = {"A1": {"nf": "# ?/?"}, "A2": {"nf": "0.00E+00"}, "A3": {"nf": "[h]:mm"}, "A4": {"nf": "hh:mm"}, "A5": {"nf": "h:mm AM/PM"}, "A6": {"nf": "yyyy-mm-dd"},
        "A7": {"nf": "d mmm yyyy"}, "A8": {"nf": "mm/dd/yyyy"}, "A9": {"nf": "dd/mm/yyyy"}, "A10": {"nf": "\u20ac#,##0.00"}, "A11": {"nf": "\u00a3#,##0.00"},
        "A12": {"nf": "#,##0"}, "A13": {"nf": "0%"}, "A14": {"nf": "0.0%"}, "A15": {"nf": "$#,##0.00"}, "A16": {"nf": "#,##0.00"}}
case("write-format-menu", "write", "every number format in Sheets' own list, saved: LibreOffice shows each cell as Lantern showed it",
     sheet("Formats", FMTS, fmt=FMTF), {"schema_ok": True, "lo_shown_same_as_lantern": ["A%d" % i for i in range(1, 17)]})
case("write-precision", "write", "numbers as typed: 0.1, 1234567.891, 1E-10, 123456789012345, 3.0, -0.5; a sum 0.1+0.2",
     sheet("Numbers", {"A1": "0.1", "A2": "1234567.891", "A3": "1E-10", "A4": "123456789012345", "A5": "3.0", "A6": "-0.5", "B1": "=A1+0.2", "B2": "=A2*2"}), {
    "openpyxl": {"values": {"A1": 0.1, "A2": 1234567.891, "A3": 1e-10, "A4": 123456789012345, "A5": 3, "A6": -0.5}}, "lo_same_as_lantern": True})


# =================================================================================================================
# 3. round: read a file, save it from Lantern, open it in LibreOffice
# =================================================================================================================
def rnd(id, file, what, expected, sheet=0, excel_only=False):
    case(id, "round", what, {"file": file, "sheet": sheet}, expected, excel_only)


rnd("round-budget", B, "the budget saved again: money, red negatives, per cent, merged title, widths, bold, the sums as Excel had them", {
    "schema_ok": True,
    "openpyxl": {"nf": {"B3": "$#,##0.00", "D3": "$#,##0.00;[Red]-$#,##0.00", "E3": "0.0%"}, "merges": ["A1:E1"], "bold": ["A2", "A11"], "widths": {"A": 22.7109375, "B": 13.7109375}},
    "lo_values": {k: v for k, v in vals(B, ["D11", "E3", "B14", "B15", "C11"])["0"].items()},
    "lo_shown": {"D4": "-$62.37", "E3": "42.2%", "B11": "$2,830.00"}})
rnd("round-names", NM, "names (TaxRate, Amounts, Discount=0.1, Shipping) saved again: the totals as Excel had them", {
    "schema_ok": True, "lo_values": vals(NM, rng("B", 10, 17))["0"]})
rnd("round-timesheet", T, "the timesheet saved again: times, [h]:mm past 24 hours, the pay", {
    "lo_shown": {"B2": "8:30 AM", "E2": "8:15", "E7": "41:15", "A2": "Mon 11/16", "F10": "$942.19"}, "lo_values": {"F10": 942.1875, "F7": 41.25}})
rnd("round-dates", DT, "thirteen date formats saved again: LibreOffice shows each as it showed the first file", {
    "lo_shown_same_as_original": rng("B", 2, 14) + ["D2", "D3", "D8", "D10", "D11", "D12", "D15"]})
rnd("round-shared", SH, "shared formulas saved again: formulas kept as formulas, the same values", {
    "schema_ok": True, "openpyxl": {"formulas": {"C5": "=A5*B5", "D5": "=SUM(C$2:C5)", "E12": "=MAX(E2:E10)", "F19": "=$A19*F$14"}},
    "lo_values": vals(SH, ["C11", "D10", "E5", "E12", "F19", "J23", "G20"])["0"]})
rnd("round-arrays", AR, "array formulas saved again: {=SUM(B2:B5*C2:C5)} still 7.25 in a spreadsheet, the four-cell array still its values", {
    "lo_values": vals(AR, ["C7", "C8", "C10"] + rng("D", 2, 5))["0"]})
rnd("round-dynamic-arrays", AR, "UNIQUE and SORT saved again: still Excel 365's spilling formulas (not =@UNIQUE, one cell, with the rest typed in)", {
    "openpyxl": {"values": {"F3": "Nuts", "F4": "Washers", "G3": 10, "G5": 30}}, "xml_dynamic": ["F2", "G2"]}, excel_only=True)
rnd("round-text-numbers", TN, "numbers stored as text saved again: still text, and the sums over them as Excel had them", {
    "lo_values": vals(TN, rng("A", 2, 22) + rng("D", 2, 17))["0"]})
rnd("round-bool-err", BE, "TRUE/FALSE and typed errors saved again: still booleans and errors", {
    "schema_ok": True, "openpyxl": {"data_type": {"A2": "b", "A3": "b", "C2": "e", "C3": "e", "C7": "e"}},
    "lo_values": vals(BE, rng("A", 2, 4) + rng("C", 2, 8) + ["B6", "B11", "D6", "D8", "D14"])["0"]})
rnd("round-unicode", U, "text in many scripts saved again: every character kept", {
    "lo_values": vals(U, rng("A", 2, 11))["0"], "schema_ok": True})
rnd("round-long-text", "longtext.xlsx", "3,000 and 32,767 characters saved again", {
    "lo_values": vals("longtext.xlsx", ["A1", "A2", "B2"])["0"], "max_text_len": 32767})
rnd("round-sheet-name", CS, "the Summary sheet saved again keeps its tab name Summary", {
    "openpyxl": {"sheet_title": "Summary"}}, sheet=4)
rnd("round-crosssheet", CS, "the Summary sheet saved alone: formulas that use sheets not in the file are not left for Excel to repair, and the note says so", {
    "no_formula_names_missing_sheet": True, "notes_contain": ["(?i)(sheet).*(not in|isn.t in|missing|other|another)"]}, sheet=4, excel_only=True)
rnd("round-1904", D4, "the Mac workbook saved again: the same dates, the start time, the 36 hours", {
    "lo_shown": {"A2": "11/17/2026", "B2": "8:30 AM", "C2": "36:00", "F2": "11/17/2026", "H2": "11/17/2026 8:30"}, "lo_values": {"G2": 8.5, "J2": 36, "D2": 38}})
rnd("round-lo-trip", "lo_trip.xlsx", "LibreOffice's trip sheet saved again: merged title, money, date, per cent", {
    "openpyxl": {"merges": ["A1:D1"]}, "lo_shown_same_as_original": ["B3", "B7", "B10", "B13", "D7", "B14"]})
rnd("round-money", MN, "money formats saved again: LibreOffice shows each amount as it showed the first file", {
    "lo_shown_same_as_original": [c + str(r) for r in range(2, 12) for c in "BCD"] + ["B14"]})
rnd("round-merged", MG, "the report's merged cells saved again: every merge, the totals", {
    "openpyxl": {"merges": ["A1:F1", "A2:F2", "A5:A7", "A8:A10", "E5:E7", "E8:E10", "B12:F14"]}, "lo_values": vals(MG, ["E5", "E8", "E11"])["0"]})
rnd("round-table", TB, "an Excel table saved again: the worked-out column and total still worked out, no formula naming a table the file has not got", {
    "lo_values": vals(TB, rng("D", 2, 5) + ["G2"])["0"], "no_structured_refs": True}, excel_only=True)
rnd("round-wide", WD, "the 30-column month saved again: its totals are not quietly the totals of A to Z only", {
    "lo_values": {"B6": 385.0, "B7": 535.0, "B9": 11.0}})
rnd("round-hidden", H, "the stock sheet with hidden rows saved again: SUBTOTAL(109) as Excel had it", {
    "lo_values": {"B13": 270.0, "B14": 270.0}})
rnd("round-quote-prefix", GN, "text typed with an apostrophe in Excel saved again: still text; the numbers still numbers", {
    "lo_values": dict(vals(GN, rng("C", 2, 9))["0"], A2=1.1, A3=0.3)})
rnd("round-lo-csv", "lo_orders.xlsx", "LibreOffice's sheet from a .csv saved again: TRUE still text, dates still dates", {
    "lo_values": vals("lo_orders.xlsx", ["F2", "F3", "A2", "E2"])["0"], "lo_shown": {"A2": "2026-11-02"}})
rnd("round-percent", PC, "per cent saved again, and the number shown with a typed % sign (12.5 as 12.5%) still 12.5", {
    "lo_values": {"G2": 12.5, "H2": 0.125, "D2": 0.125}, "lo_shown": {"G2": "12.5%", "E3": "8%", "E4": "8.25%", "D2": "12.5%"}})
rnd("round-functions", FN, "the functions sheet saved again: every value as Excel had it (LibreOffice 24.2 lacks XLOOKUP and XMATCH)", {
    "lo_values": {k: v for k, v in vals(FN, [r for r in rng("F", 2, 22) + rng("I", 2, 26) + rng("L", 2, 26) + rng("O", 2, 25)
                                             if r not in ("L9", "L10", "L22", "I17", "I24")])["0"].items()}})


# =================================================================================================================
# 4. grid: merged cells and widths in the Sheets app
# =================================================================================================================
TITLE_DOC = {"title": "Grid test", "cells": {"A1": "Left", "B1": "Name", "C1": "Title", "F1": "Right", "A2": "a2", "B2": "b2", "C2": "c2", "D2": "d2", "E2": "e2", "F2": "f2",
                                            "A3": "a3", "C3": "c3"}, "merges": ["C1:E1"], "widths": {"A": 20, "C": 30, "F": 12}}
TALL_DOC = {"title": "Tall", "cells": {"A1": "Shift", "B1": "Machine", "C1": "Count", "A2": "Day", "B2": "Press 1", "C2": "5", "B3": "Press 2", "C3": "7", "B4": "Lathe", "C4": "2",
                                      "A5": "Night", "B5": "Press 1", "C5": "3", "B6": "Press 2", "C6": "9", "A7": "Total", "C7": "=SUM(C2:C6)"}, "merges": ["A2:A4", "A5:A6"]}


def grid(id, what, inp, trace, excel_only=False):
    case(id, "grid", what, inp, {"trace": trace}, excel_only)


grid("grid-arrow-right-through", "ArrowRight into a merged title and on past the cells it covers; ArrowLeft back", {"doc": TITLE_DOC, "steps": [
    {"click": "B1"}, {"key": "ArrowRight"}, {"check": {}}, {"key": "ArrowRight"}, {"check": {}}, {"key": "ArrowLeft"}, {"check": {}}, {"key": "ArrowLeft"}, {"check": {}}]},
    [{"name": "C1"}, {"name": "F1"}, {"name": "C1"}, {"name": "B1"}])
grid("grid-tab-through", "Tab and Shift+Tab over a merged title", {"doc": TITLE_DOC, "steps": [
    {"click": "B1"}, {"key": "Tab"}, {"check": {}}, {"key": "Tab"}, {"check": {}}, {"key": "Tab", "shift": True}, {"check": {}}]},
    [{"name": "C1"}, {"name": "F1"}, {"name": "C1"}])
grid("grid-arrow-down-tall", "ArrowDown into cells merged down three rows, on past them, and up again", {"doc": TALL_DOC, "steps": [
    {"click": "A1"}, {"key": "ArrowDown"}, {"check": {}}, {"key": "ArrowDown"}, {"check": {}}, {"key": "ArrowDown"}, {"check": {}}, {"key": "ArrowUp"}, {"check": {}}, {"key": "ArrowUp"}, {"check": {}}]},
    [{"name": "A2"}, {"name": "A5"}, {"name": "A7"}, {"name": "A5"}, {"name": "A2"}])
grid("grid-left-into-tall", "ArrowLeft from beside the middle of a tall merge goes to the merged cell", {"doc": TALL_DOC, "steps": [
    {"click": "B3"}, {"key": "ArrowLeft"}, {"check": {}}]}, [{"name": "A2"}])
grid("grid-enter-past", "typing into a tall merged cell and pressing Enter moves below it, as Excel does", {"doc": TALL_DOC, "steps": [
    {"type": "Day shift", "at": "A2"}, {"check": {"cells": ["A2"]}}]}, [{"name": "A5", "cells": {"A2": "Day shift"}}])
grid("grid-type-over", "typing over a merged title: the words change, the merge stays", {"doc": TITLE_DOC, "steps": [
    {"type": "Fence quote", "at": "C1"}, {"check": {"cells": ["C1", "D1"], "td": ["C1", "D1"]}}]},
    [{"merges": ["C1:E1"], "cells": {"C1": "Fence quote", "D1": None}, "td": {"C1": {"colSpan": 3, "text": "Fence quote"}, "D1": {"hidden": True}}}])
grid("grid-shift-select", "Shift+ArrowRight from beside a merged cell takes in the whole merged cell (B1:E1)", {"doc": TITLE_DOC, "steps": [
    {"click": "B1"}, {"key": "ArrowRight", "shift": True}, {"check": {}}]}, [{"name": "B1:E1"}])
grid("grid-col-delete-inside", "a column taken out from inside a merged title: the title narrows (C1:D1), widths move with their columns", {"doc": TITLE_DOC, "steps": [
    {"click": "D2"}, {"act": "colDel"}, {"check": {"cells": ["C1"]}}, {"undo": 1}, {"check": {}}, {"redo": 1}, {"check": {}}]},
    [{"merges": ["C1:D1"], "cells": {"C1": "Title"}, "widths": {"A": 20, "C": 30, "E": 12}}, {"merges": ["C1:E1"], "widths": {"A": 20, "C": 30, "F": 12}},
     {"merges": ["C1:D1"], "widths": {"A": 20, "C": 30, "E": 12}}])
grid("grid-col-insert-inside", "a column put in inside a merged title: the title widens (C1:F1)", {"doc": TITLE_DOC, "steps": [
    {"click": "D2"}, {"act": "colLeft"}, {"check": {"td": ["C1"]}}]}, [{"merges": ["C1:F1"], "td": {"C1": {"colSpan": 4}}, "widths_any": [{"A": 20, "C": 30, "G": 12}, {"A": 20, "C": 30, "D": 30, "G": 12}]}])
grid("grid-col-delete-first", "the first column of a merged title taken out: the merge narrows or goes, never points past its cells", {"doc": TITLE_DOC, "steps": [
    {"click": "C2"}, {"act": "colDel"}, {"check": {}}]}, [{"merges_any": [["C1:D1"], []]}], excel_only=True)
grid("grid-row-insert-tall", "a row put in inside cells merged down: the merge grows, the ones below move down", {"doc": TALL_DOC, "steps": [
    {"click": "B3"}, {"act": "rowAbove"}, {"check": {"td": ["A2"]}}, {"undo": 1}, {"check": {}}]},
    [{"merges": ["A2:A5", "A6:A7"], "td": {"A2": {"rowSpan": 4}}}, {"merges": ["A2:A4", "A5:A6"]}])
grid("grid-row-delete-tall", "a row taken out of cells merged down: the merge shrinks, the sum still adds what is left", {"doc": TALL_DOC, "steps": [
    {"click": "B3"}, {"act": "rowDel"}, {"check": {"cells": ["C6"]}}]}, [{"merges": ["A2:A3", "A4:A5"], "cells": {"C6": "=SUM(C2:C5)"}}])
grid("grid-row-delete-whole", "the row of a one-row merged title taken out: the merge goes with it", {"doc": TITLE_DOC, "steps": [
    {"click": "C1"}, {"act": "rowDel"}, {"check": {"cells": ["C1"]}}]}, [{"merges": [], "cells": {"C1": "c2"}}])
grid("grid-widths-insert", "a column put in at A: every width moves right with its column", {"doc": TITLE_DOC, "steps": [
    {"click": "A2"}, {"act": "colLeft"}, {"check": {}}]}, [{"widths_any": [{"B": 20, "D": 30, "G": 12}, {"A": 20, "B": 20, "D": 30, "G": 12}], "merges": ["D1:F1"]}])
grid("grid-sort-refused", "sorting rows that hold cells merged down is refused, as Excel refuses it, and nothing moves", {"doc": TALL_DOC, "steps": [
    {"click": "C3"}, {"act": "za"}, {"check": {"cells": ["B2", "C2", "C6"]}}]}, [{"merges": ["A2:A4", "A5:A6"], "cells": {"B2": "Press 1", "C2": "5", "C6": "9"}}])
grid("grid-sort-message", "...and the sheet says why, without asking for something Sheets cannot do (it has no Unmerge)", {"doc": TALL_DOC, "steps": [
    {"click": "C3"}, {"act": "za"}, {"check": {}}]}, [{"status_contains": ["(?i)merged"], "status_not_contains": ["(?i)unmerge"]}])
grid("grid-copy-paste-merged", "a merged title copied and pasted lower down comes as a merged title (Excel pastes the merge)", {"doc": TITLE_DOC, "steps": [
    {"click": "C1"}, {"copy": 1}, {"click": "C6"}, {"paste": "Title"}, {"check": {"cells": ["C6"]}}]}, [{"cells": {"C6": "Title"}, "merges_include": ["C6:E6"]}])
grid("grid-freeze-save", "Freeze top row ticked, then Save .xlsx: the file has its top row frozen", {"doc": {"title": "Freeze me", "cells": {"A1": "Head", "A2": "1"}}, "steps": [
    {"freeze": True}, {"check": {}}, {"save": 1}]}, [{"freeze": 1}])
case("grid-freeze-save-file", "grid", "...and the saved file, opened by openpyxl, has A2 as its frozen pane", {"doc": {"title": "Freeze me", "cells": {"A1": "Head", "A2": "1"}}, "steps": [
    {"freeze": True}, {"save": 1}]}, {"trace": [], "file_openpyxl": {"freeze": "A2"}})


# =================================================================================================================
# 5. grammar: Lantern.xlsx.excelFormula
# =================================================================================================================
def gram(id, what, ok=None, not_ok=None, lantern=None, excel_only=False, ok_any=None):
    fs = list((ok or {}).keys()) + list(not_ok or []) + list((lantern or {}).keys()) + list((ok_any or {}).keys())
    e = {}
    if ok: e["ok"] = ok
    if ok_any: e["ok_any"] = ok_any
    if not_ok: e["not_ok"] = not_ok
    if lantern: e["lantern"] = lantern
    case(id, "grammar", what, {"formulas": fs}, e, excel_only)


gram("grammar-xlfn-2010", "Excel 2010's dotted functions carry _xlfn. in the file", ok={
    "STDEV.S(A1:A9)": "_xlfn.STDEV.S(A1:A9)", "STDEV.P(A1:A9)": "_xlfn.STDEV.P(A1:A9)", "VAR.S(A1:A9)": "_xlfn.VAR.S(A1:A9)", "MODE.SNGL(A1:A9)": "_xlfn.MODE.SNGL(A1:A9)",
    "PERCENTILE.INC(A1:A9,0.9)": "_xlfn.PERCENTILE.INC(A1:A9,0.9)", "QUARTILE.INC(A1:A9,1)": "_xlfn.QUARTILE.INC(A1:A9,1)", "RANK.EQ(A1,A1:A9)": "_xlfn.RANK.EQ(A1,A1:A9)",
    "NORM.DIST(1,0,1,TRUE)": "_xlfn.NORM.DIST(1,0,1,TRUE)", "NORM.S.INV(0.9)": "_xlfn.NORM.S.INV(0.9)", "BINOM.DIST(3,10,0.5,FALSE)": "_xlfn.BINOM.DIST(3,10,0.5,FALSE)",
    "COVARIANCE.S(A1:A3,B1:B3)": "_xlfn.COVARIANCE.S(A1:A3,B1:B3)", "CONFIDENCE.NORM(0.05,1,30)": "_xlfn.CONFIDENCE.NORM(0.05,1,30)",
    "AGGREGATE(9,6,A1:A9)": "_xlfn.AGGREGATE(9,6,A1:A9)",
    "CEILING.PRECISE(4.1)": "_xlfn.CEILING.PRECISE(4.1)", "FLOOR.PRECISE(4.9)": "_xlfn.FLOOR.PRECISE(4.9)", "PERCENTRANK.INC(A1:A9,3)": "_xlfn.PERCENTRANK.INC(A1:A9,3)"})
gram("grammar-xlfn-2013", "Excel 2013-2019 functions carry _xlfn. in the file", ok={
    "IFNA(A1,0)": "_xlfn.IFNA(A1,0)", "DAYS(B1,A1)": "_xlfn.DAYS(B1,A1)", "ISOWEEKNUM(A1)": "_xlfn.ISOWEEKNUM(A1)", "XOR(A1,B1)": "_xlfn.XOR(A1,B1)",
    "NUMBERVALUE(A1)": "_xlfn.NUMBERVALUE(A1)", "ISFORMULA(A1)": "_xlfn.ISFORMULA(A1)", "ARABIC(\"XIV\")": "_xlfn.ARABIC(\"XIV\")", "CEILING.MATH(4.1)": "_xlfn.CEILING.MATH(4.1)",
    "FLOOR.MATH(4.9)": "_xlfn.FLOOR.MATH(4.9)", "UNICHAR(65)": "_xlfn.UNICHAR(65)", "UNICODE(\"A\")": "_xlfn.UNICODE(\"A\")", "GAMMA(5)": "_xlfn.GAMMA(5)",
    "BASE(10,2)": "_xlfn.BASE(10,2)", "CONCAT(A1,B1)": "_xlfn.CONCAT(A1,B1)", "TEXTJOIN(\",\",TRUE,A1:A3)": "_xlfn.TEXTJOIN(\",\",TRUE,A1:A3)",
    "IFS(A1>1,1,TRUE,0)": "_xlfn.IFS(A1>1,1,TRUE,0)", "SWITCH(A1,1,\"a\",\"b\")": "_xlfn.SWITCH(A1,1,\"a\",\"b\")", "MAXIFS(A1:A9,B1:B9,\"x\")": "_xlfn.MAXIFS(A1:A9,B1:B9,\"x\")",
    "MINIFS(A1:A9,B1:B9,\"x\")": "_xlfn.MINIFS(A1:A9,B1:B9,\"x\")", "FORECAST.LINEAR(4,A1:A3,B1:B3)": "_xlfn.FORECAST.LINEAR(4,A1:A3,B1:B3)"})
gram("grammar-xlfn-365", "Excel 365 functions: _xlfn. and, for FILTER and SORT, _xlws. too", ok={
    "XLOOKUP(A1,B1:B9,C1:C9)": "_xlfn.XLOOKUP(A1,B1:B9,C1:C9)", "XMATCH(A1,B1:B9)": "_xlfn.XMATCH(A1,B1:B9)", "UNIQUE(A1:A9)": "_xlfn.UNIQUE(A1:A9)",
    "SORT(A1:A9)": "_xlfn._xlws.SORT(A1:A9)", "FILTER(A1:A9,B1:B9>1)": "_xlfn._xlws.FILTER(A1:A9,B1:B9>1)", "SEQUENCE(5)": "_xlfn.SEQUENCE(5)",
    "TEXTBEFORE(A1,\"-\")": "_xlfn.TEXTBEFORE(A1,\"-\")", "TEXTAFTER(A1,\"-\")": "_xlfn.TEXTAFTER(A1,\"-\")", "SORTBY(A1:A9,B1:B9)": "_xlfn.SORTBY(A1:A9,B1:B9)"})
gram("grammar-let", "LET's names carry _xlpm. in the file (=LET(x,2,x*3) saved as _xlfn.LET(_xlpm.x,2,_xlpm.x*3))", ok={
    "LET(x,2,x*3)": "_xlfn.LET(_xlpm.x,2,_xlpm.x*3)"}, excel_only=True)
gram("grammar-classics", "functions in the standard's own list (Excel 2007's, and NETWORKDAYS.INTL and WORKDAY.INTL, which ISO 29500 added) are written without a prefix", ok={
    "SUMIFS(A1:A9,B1:B9,\"x\")": "SUMIFS(A1:A9,B1:B9,\"x\")", "COUNTIFS(A1:A9,\">1\")": "COUNTIFS(A1:A9,\">1\")", "AVERAGEIFS(A1:A9,B1:B9,1)": "AVERAGEIFS(A1:A9,B1:B9,1)",
    "IFERROR(A1,0)": "IFERROR(A1,0)", "NETWORKDAYS(A1,B1)": "NETWORKDAYS(A1,B1)", "WORKDAY(A1,5)": "WORKDAY(A1,5)", "EDATE(A1,1)": "EDATE(A1,1)", "EOMONTH(A1,0)": "EOMONTH(A1,0)",
    "DATEDIF(A1,B1,\"y\")": "DATEDIF(A1,B1,\"y\")", "MROUND(A1,5)": "MROUND(A1,5)", "QUOTIENT(7,2)": "QUOTIENT(7,2)", "YEARFRAC(A1,B1)": "YEARFRAC(A1,B1)",
    "STDEV(A1:A9)": "STDEV(A1:A9)", "RANK(A1,A1:A9)": "RANK(A1,A1:A9)", "CONCATENATE(A1,B1)": "CONCATENATE(A1,B1)", "SUBTOTAL(109,A1:A9)": "SUBTOTAL(109,A1:A9)",
    "SUMPRODUCT(A1:A3,B1:B3)": "SUMPRODUCT(A1:A3,B1:B3)", "WEEKNUM(A1)": "WEEKNUM(A1)", "SQRTPI(2)": "SQRTPI(2)", "DEC2HEX(255)": "DEC2HEX(255)", "CONVERT(1,\"in\",\"cm\")": "CONVERT(1,\"in\",\"cm\")",
    "NETWORKDAYS.INTL(A1,B1,1)": "NETWORKDAYS.INTL(A1,B1,1)", "WORKDAY.INTL(A1,5,1)": "WORKDAY.INTL(A1,5,1)"})
gram("grammar-lowercase", "lower-case function names and references (as people type them) are written as Excel writes them", ok={
    "sum(a1:a3)": "SUM(A1:A3)", "round(b2*1.1,2)": "ROUND(B2*1.1,2)", "vlookup(a1,b1:c9,2,false)": "VLOOKUP(A1,B1:C9,2,FALSE)", "if(a1>0,true,false)": "IF(A1>0,TRUE,FALSE)",
    "$a$1*2": "$A$1*2"}, excel_only=True)
gram("grammar-sheet-refs", "references to other sheets Excel reads: quotes, an apostrophe doubled, accents, a 3-D range", ok={
    "'O''Brien'!A1*2": "'O''Brien'!A1*2", "'Données €'!B2": "'Données €'!B2", "SUM(Jan:Mar!B2)": "SUM(Jan:Mar!B2)", "Sheet2!$A$1:$B$3": "Sheet2!$A$1:$B$3"})
gram("grammar-operators-ok", "operators and literals Excel reads: --, +, %%, ^-2, &, <>, .5, 1E+3, empty arguments, TRUE(), errors", ok_any={
    "--A1": ["--A1"], "+A1": ["+A1", "A1"], "A1%%": ["A1%%"], "A1^-2": ["A1^-2"], "A1&\"\"": ["A1&\"\""], "A1<>B1": ["A1<>B1"], ".5*A1": [".5*A1", "0.5*A1"],
    "1E+3": ["1E+3", "1000", "1E3"], "SUM(A1,)": ["SUM(A1,)"], "IF(A1,,)": ["IF(A1,,)"], "TRUE()": ["TRUE()"], "IFERROR(A1,#N/A)": ["IFERROR(A1,#N/A)"],
    "ISERROR(#REF!)": ["ISERROR(#REF!)"], "\"He said \"\"hi\"\"\"": ["\"He said \"\"hi\"\"\""], "-(A1)": ["-(A1)"], "2^-1": ["2^-1"], "A1*-1": ["A1*-1"], "--TRUE": ["--TRUE"]})
gram("grammar-refs-ok", "references Excel reads, past Lantern's Z and row 2000 too", ok={
    "AA1*2": "AA1*2", "SUM(A1:AD1)": "SUM(A1:AD1)", "XFD1048576": "XFD1048576", "A2001+1": "A2001+1", "SUM(1:1)": "SUM(1:1)", "A$1:$B2": "A$1:$B2"})
gram("grammar-name-clash", "a Lantern function whose name Excel uses for another function (GAMMA: Lorentz factor here, gamma function in Excel) is named", lantern={
    "GAMMA(0.5*299792458)": ["GAMMA"]})
gram("grammar-cannot-read", "what Excel cannot read is not ok, with a reason", not_ok=[
    "A1**2", "A1^^2", "A1×2", "A1÷2", "√4", "5!", "SUM(A1:A3))", "IF(A1>1;2;3)", "=A1", "A1=<2", "A1+*2", "\"abc\"\"", "#VALUE", "SUM(A1 A3", "π*2", "2pi", "A1 >="])
gram("grammar-lantern-names", "functions Excel has not got (Lantern's own) are named; ones Excel has are not", lantern={
    "POW(2,3)": ["POW"], "CEIL(2.5)": ["CEIL"], "OHMS(12,2)": ["OHMS"], "SHA256(\"a\")": ["SHA256"], "WORDS(A1)": ["WORDS"], "REVERSE(A1)": ["REVERSE"], "ROT13(A1)": ["ROT13"],
    "HEX(255)": ["HEX"], "SORTLETTERS(A1)": ["SORTLETTERS"], "ROMAN(4)": [], "CLEAN(A1)": [], "DOLLAR(5)": [], "FIXED(1.5)": [], "INDIRECT(\"A1\")": [], "OFFSET(A1,1,1)": [],
    "ADDRESS(1,1)": [], "HYPERLINK(\"https://example.org\")": [], "XIRR(A1:A3,B1:B3)": [], "DAYS360(A1,B1)": [], "FREQUENCY(A1:A9,B1:B3)": [], "T(A1)": []})


# =================================================================================================================
# 6. order: Excel's order of operations in a sheet, the order on paper in the Calculator
# =================================================================================================================
def order(id, what, sheet_vals, calc_vals=None, cells=None, excel_only=False):
    fs = list(sheet_vals.keys())
    inp = {"formulas": fs, "calculator": bool(calc_vals)}
    if cells: inp["cells"] = cells
    e = {"sheet": sheet_vals}
    if calc_vals: e["calculator"] = calc_vals
    case(id, "order", what, inp, e, excel_only)


order("order-minus-power", "a minus sign before a power: Excel squares the negative number; the Calculator does the power first, as on paper",
      {"=-2^2": 4, "=-3^2*2": 18, "=3*-2^2": 12, "=-2^0.5": "#NUM!", "=0-2^2": -4, "=10-2^2": 6, "=-(2^2)": -4, "=-(2)^2": 4},
      {"=-2^2": -4, "=-3^2*2": -18, "=3*-2^2": -12, "=-2^0.5": -1.4142135623730951, "=0-2^2": -4, "=10-2^2": 6, "=-(2^2)": -4, "=-(2)^2": -4})
order("order-power-chain", "powers in a row: Excel works left to right (2^3^2 is 64); the Calculator right to left (512)",
      {"=2^3^2": 64, "=4^0.5^2": 4, "=(2^3)^2": 64, "=2^(3^2)": 512, "=2^-1": 0.5, "=-2^-2": 0.25},
      {"=2^3^2": 512, "=4^0.5^2": 1.4142135623730951, "=(2^3)^2": 64, "=2^(3^2)": 512, "=2^-1": 0.5, "=-2^-2": -0.25})
order("order-percent", "% comes before ^ in Excel: 50%^2 is 0.25, 2^300% is 8, -5%^2 is 0.0025, 50%% is 0.005",
      {"=50%^2": 0.25, "=2^300%": 8, "=-5%^2": 0.0025, "=50%%": 0.005, "=200%*3": 6, "=10+5%": 10.05})
order("order-concat", "& comes after + and * in Excel: 1+2&3 is \"33\", 1&2+3 is \"15\", 1&2=12 is FALSE (text against a number)",
      {"=1+2&3": "33", "=1&2+3": "15", '="a"&1+2': "a3", "=2*3&4": "64", '="x"&-1': "x-1", "=1&2=12": False, '="A"&2^2': "A4", "=-1&2": "-12"})
order("order-compare", "comparisons last; TRUE above every number; text above every number; text compared without case",
      {"=1+2=3": True, "=2*3>5": True, "=1=1=TRUE": True, "=1<2<3": False, '="10">5': True, '="abc"="ABC"': True, '="a"<"B"': True, "=TRUE>1": True,
       '=""=0': False, "=A99=0": True, '=A99=""': True, "=FALSE<TRUE": True, '="Z"<"a"': False}, excel_only=True)
order("order-text-coerced", "text turned into numbers by arithmetic as Excel turns it: \"3\"+2, \"1,000\"+1, \"$5\"+1, \"50%\"*2; \"abc\"+1 is #VALUE!",
      {'="3"+2': 5, '="3"*"4"': 12, '=--"5"': 5, '="1,000"+1': 1001, '="$5"+1': 6, '="50%"*2': 1, '="abc"+1': "#VALUE!", "=TRUE+1": 2, '="TRUE"+1': "#VALUE!"}, excel_only=True)
order("order-cell-minus", "a minus before a cell's value and a power: -A1^2 is 9 when A1 is 3, and when A1 is -3",
      {"=-A1^2": 9, "=A2^2": 9, "=-A2^2": 9, "=0-A1^2": -9, "=-A1^-1": -0.3333333333333333, "=2*-A1": -6, "=A3%": 2, "=-A3%^2": 4, "=A3*10%": 20},
      cells={"A1": "3", "A2": "-3", "A3": "200"})
order("order-float-equal", "equality as Excel judges it (to 15 figures): 0.1+0.2=0.3, 1-0.9=0.1, (0.1+0.2)*10=3 are TRUE",
      {"=0.1+0.2=0.3": True, "=1-0.9=0.1": True, "=0.1*3=0.3": True, "=1/3*3=1": True, "=(0.1+0.2)*10=3": True, "=0.3-0.1=0.2": True})

# =================================================================================================================
# the judgement of each case, after it was run (harm when it disagrees, and why)
# =================================================================================================================
for c in CASES:
    if c["group"] in ("write", "round") and not c["input"].get("make_sheet") and "excel_rules" not in c["expected"]:
        c["expected"]["excel_rules"] = True

JUDGE = {
    # ---- high: wrong numbers shown or saved without a word, or a file other programs cannot work out ----
    "read-1904-dates": {"harm": "high", "why": "In a 1904-date workbook Lantern moves every number with a date-or-time look by 1,462 days, and that takes in a duration in [h]:mm: a 36-hour shift (1.5, shown 36:00) becomes 1463.5 and shows 35124:00, and =C2*24 shows 35124 instead of 36. The note names J2 but not C2, the typed value itself. Dates, h:mm times and mm:ss lap times are moved or left as they should be. Lantern should leave elapsed-time formats ([h], [m], [s]) unmoved."},
    "round-1904": {"harm": "high", "why": "The shifted duration is saved: Excel and LibreOffice show 35124:00 hours and =C2*24 is 35124. Nothing is said on saving."},
    "round-arrays": {"harm": "high", "why": "Array formulas read from Excel ({=SUM(B2:B5*C2:C5)}, SUM(IF(...)), MAX(range*range)) are saved as ordinary formulas with no t=\"array\", so Excel and LibreOffice work them out by implicit intersection: #VALUE! where the person's file showed 7.25, 15 and 2.5. The save says nothing. Lantern knows they were arrays (it says so on reading): it should write them back with t=\"array\" and their ref."},
    "round-crosssheet": {"harm": "high", "why": "A sheet saved alone keeps formulas that name sheets not in the file (Jan!B6, AVERAGE(Jan!B6,...), 'Bob''s rates'!B1). LibreOffice shows errors; Excel cannot resolve a sheet that is not in the workbook and would ask to repair it (or treat it as a link to another file). The save's only note is about B6 and gives a false reason. Lantern should save such cells as their value or as text and say which use sheets not in this file. (excel_only: what Excel does with them.)"},
    "round-table": {"harm": "high", "why": "Formulas with an Excel table's names (Orders[[#This Row],[Qty]], SUMIF(Orders[Item],...)) are saved into a file that has no table: LibreOffice shows Err:507/Err:508 and Excel would have to repair the file. Only the total row (B6, D6) is saved as text and said. Lantern should rewrite structured references as ranges (the table's ref is in the file, as it does for names) or save them as text and say so. (excel_only: Excel's repair.)"},
    "write-gamma-name-clash": {"harm": "high", "why": "Lantern's GAMMA is the Lorentz factor; Excel's GAMMA is the gamma function. excelFormula writes Lantern's as _xlfn.GAMMA, so Excel works out a different number (LibreOffice: #NUM! for GAMMA(1.5E8); for small speeds a plausible but wrong value), and the notes say nothing. Read the other way, an Excel GAMMA(5) shows 1 here instead of 24. GAMMA should be in excelFormula's list of Lantern's own (named in the notes, saved as text), and read as Lantern's only when the file came from Lantern."},
    # ---- medium ----
    "read-hidden-rows": {"harm": "medium", "why": "SUBTOTAL(109), AGGREGATE(9,5) and SUBTOTAL(103) leave hidden rows out in Excel (270, 270, 6); Sheets shows the hidden rows and works out 360, 360, 8. The note names all three cells, so it is not silent. Lantern could keep which rows were hidden for these functions, or say in the note that these totals now count rows Excel hid."},
    "round-hidden": {"harm": "medium", "why": "Saved again, the rows are no longer hidden, so Excel shows 360 where the person's file showed 270. The import note said hidden rows are shown; the save says nothing about the totals."},
    "read-crosssheet": {"harm": "medium", "why": "Formulas that use another sheet show #ERR (by design, and said in the notes, which list the cells). B9 =COUNTIF(B2:B4,\">700\") over those errors shows 0, a plausible number, not an error (it is in the note's \"2 more\"). All five sheets are imported together, so Lantern could work out Jan!B6 from the sheet it made from Jan, or at least show Excel's saved value."},
    "read-array-formulas": {"harm": "medium", "why": "{=SUM(B2:B5*C2:C5)}, {=SUM(IF(...))} and {=MAX(B2:B5*C2:C5)} show #ERR, and the four-cell array's first cell #VALUE!; the note names each cell. Lantern should work out a range times a range inside an array formula, element by element, as Excel does."},
    "read-text-numbers-sums": {"harm": "medium", "why": "Excel's COUNT(A2:A22) over cells that are all text is 0; Lantern's is 4, because text that reads as a date, time or fraction (1/2, 2026-11-17, 3:30, 1 1/2) is read without an apostrophe and Sheets then counts it as a number. The note names D5. The reader should put the apostrophe before every text Sheets would read as a number, date, time or fraction, not only before plain numbers."},
    "read-booleans": {"harm": "medium", "why": "SUMPRODUCT(--A2:A4) is #VALUE! here (Excel 2): the -- idiom over a range (SUMPRODUCT(--(A2:A10=\"x\"))) is common in older workbooks. And =A2=1 with A2 TRUE is FALSE in Excel (a logical is not the number 1) but TRUE here. Both are named in the note."},
    "read-table": {"harm": "medium", "why": "Every formula that uses the table's names shows #ERR (said in the notes). Lantern should rewrite Orders[Qty] and [@Qty] as the ranges they stand for, as it already does for defined names."},
    "read-fn-lookup": {"harm": "medium", "why": "SUMPRODUCT((A2:A8=\"North\")*(D2:D8)) is #VALUE! (Excel 225) - the conditional SUMPRODUCT is the classic pre-SUMIFS idiom; LOOKUP and VLOOKUP over an array constant {..} show #ERR. All named in the note. Lantern should do element-wise arithmetic and comparisons on ranges inside SUMPRODUCT, and accept array constants."},
    "read-wide": {"harm": "medium", "why": "Totals over B:AE show the sum of B:Z only (319, not 385) and =AE2 shows 0: wrong numbers on the screen, though the note says cells past Z are left out and names each of these cells. Sheets has columns A to Z only."},
    "round-wide": {"harm": "medium", "why": "Saved again, the file has no AA:AE values but keeps =SUM(B2:AE2) and =AE2, so Excel shows 319 and 0 where the person's file showed 385 and 11. The import note told; the save does not."},
    "write-typed-dates": {"harm": "medium", "why": "Dates and times typed in Sheets (2026-11-17, 11/17/2026, 17 Nov 2026, 3:30 PM, 14:30) are saved as text. In Excel they sit left-aligned as text: they do not sort or filter as dates and Excel's date formats do nothing to them (sums on them still work, by Excel's own turning of text into dates). The brief says dates typed 2026-11-17 are written as dates. They should be saved as date serials with a date or time format, as $3.50 is saved as 3.5 with a money format."},
    "write-dates": {"harm": "medium", "why": "Date sums that Lantern shows as dates (=B1+30 shown 2026-12-17, EDATE, EOMONTH, WORKDAY) are saved with no date format, so Excel shows 46373, 46435, 46356, 46357. DATE() and TIME() get formats other than the ones Lantern showed (LibreOffice 03/01/26 and 02:30:00 PM for 2026-03-01 and 14:30). The look Lantern shows a date sum in should go into the file."},
    "write-newer-functions": {"harm": "medium", "why": "NETWORKDAYS.INTL is written as _xlfn.NETWORKDAYS.INTL. It is in the standard's own list (openpyxl's FORMULAE has it, XlsxWriter does not prefix it, LibreOffice shows #NAME? for the prefixed name). Every other prefix is right. (excel_only: whether Excel itself would also show #NAME?.)"},
    "write-newer-functions-values": {"harm": "medium", "why": "LibreOffice shows #NAME? for the _xlfn.NETWORKDAYS.INTL Lantern wrote; and Lantern's own sheet shows #NAME? for BASE(10,2) (it lists BASE among its functions) and #ERR for COVARIANCE.S and FORECAST.LINEAR given an array constant, which Excel works out."},
    "write-excel-functions": {"harm": "medium", "why": "220 of 226 calls agree. The six that do not: GAMMA(5) is 1.0000000000000002 here and 24 in Excel (Lantern's GAMMA is another function, see write-gamma-name-clash); BASE(10,2) and BASE(255,16,4) are #NAME? here; CONVERT(1,\"lbm\",\"kg\") is #ERR here (Excel 0.4536); WORKDAY.INTL and NETWORKDAYS.INTL are #NAME? in LibreOffice because of the _xlfn. prefix."},
    "grammar-name-clash": {"harm": "medium", "why": "excelFormula does not name GAMMA as Lantern's own although it means something else in Excel (see write-gamma-name-clash)."},
    "grammar-classics": {"harm": "medium", "why": "NETWORKDAYS.INTL and WORKDAY.INTL are given _xlfn., which they must not have (they are in ISO 29500's list; LibreOffice reads the prefixed names as unknown, #NAME?)."},
    "write-long-text": {"harm": "medium", "why": "A cell of 40,000 characters is saved whole. Excel holds at most 32,767 characters in a cell, and a file with more is one Excel must repair or cut. Lantern should cut the text at 32,767 and say which cell. (excel_only: Excel's repair; rare in practice - a pasted log.)"},
    # ---- low: looks, wording, and Lantern's own sheet where the saved file is right ----
    "read-money-currency": {"harm": "low", "why": "[$\u00a5-411]#,##0 shows 1,235 here, \u00a51,235 in Excel: a currency symbol written in Excel's [$symbol-locale] form is dropped. Numbers right."},
    "read-money-accounting": {"harm": "low", "why": "#,##0.00 [$\u20ac-407] shows 1,234.50 here, 1,234.50 \u20ac in Excel (English, US): the [$\u20ac-407] symbol is dropped. The Accounting format (the $ button) is right. (excel_only: the locale's effect on Excel's own display.)"},
    "read-lo-trip": {"harm": "low", "why": "LibreOffice writes every currency format as [$$-409]#,##0.00, so every money cell in a LibreOffice workbook shows 96.00 here instead of $96.00. A look, but in every LibreOffice file with money. Same root as read-money-currency: keep the symbol inside [$...-...]."},
    "read-number-formats": {"harm": "low", "why": "A format with a condition ([<=9999999]###-####;(###) ###-####, Excel's Phone Number) is shown by its first section: 555123-4567 instead of (555) 123-4567. The other 22 formats are right."},
    "read-numbers-as-saved": {"harm": "low", "why": "A constant Excel saved as 0.30000000000000004 is kept with all 17 digits in the cell (and its editor) where Excel shows 0.3; 1.1000000000000001 is read as 1.1. Constants should be read to Excel's 15 significant digits."},
    "read-comments-where": {"harm": "low", "why": "The note says comments are not kept, but not on which cells (B2, B3) or what they said, so a person cannot get them back from the file. It should name the cells, or put the comments' words in the note."},
    "read-filter-said": {"harm": "low", "why": "The report's AutoFilter (drop-down arrows on its headings) is dropped without a word."},
    "read-python-zeros": {"harm": "low", "why": "A Python report (XlsxWriter) saves 0 beside every formula and asks Excel to work them out on opening (fullCalcOnLoad). The note says Lantern works out all four differently from Excel (Excel 0, here 375), which is not so and would make a person doubt right numbers. When the file asks for a full recalculation, the saved values should not be compared (or the note should say the file carried no worked-out values)."},
    "read-errors": {"harm": "low", "why": "ERROR.TYPE is not in Lantern; the note says such a cell \"shows #NAME? here\" but it shows #DIV/0! (the error passed through)."},
    "read-fn-text": {"harm": "low", "why": "CONCAT(\"A\",1,TRUE) is A11 here, A1TRUE in Excel (TRUE turned into 1, not TRUE). Named in the note."},
    "read-fn-stats-money": {"harm": "low", "why": "IRR({-1000,300,400,500}) and CORREL(range,{1;2;...}) show #ERR: array constants are not read. Named in the note."},
    "read-dynamic-arrays": {"harm": "low", "why": "UNIQUE and SORT are not in Lantern: their first cells show #NAME? (said), the spilled cells keep Excel's values. The note's \"works again in Excel\" is only half so (see round-dynamic-arrays)."},
    "read-password": {"harm": "low", "why": "A workbook locked with a password is called \"an older Office file (.doc, .xls or .ppt)\"; the person is sent to look for the wrong cause. It should say the file is locked with a password and to save a copy without one."},
    "round-dynamic-arrays": {"harm": "low", "why": "UNIQUE and SORT are saved as ordinary formulas with the spilled values typed in below: Excel 365 shows them as =@UNIQUE(...) (one value) with constants that no longer follow the data. Lantern should write them back as Excel 365 does (t=\"array\", cm=\"1\", metadata.xml) or say they no longer spill. (excel_only.)"},
    "round-sheet-name": {"harm": "low", "why": "The sheet named Summary is saved with the tab name \"crosssheet \u2014 Summary\" (Lantern's title); Excel showed Summary. The read result has the sheet's own name, which could be used."},
    "write-lookups": {"harm": "low", "why": "The saved file is right; Lantern's own sheet shows #ERR for VLOOKUP and LOOKUP over an array constant ({0,\"low\";5,\"mid\";10,\"high\"}), which Excel and LibreOffice work out (mid, z)."},
    "write-money-functions": {"harm": "low", "why": "The saved file is right; Lantern's own sheet shows #ERR for IRR({-1000,300,400,500}) (array constant)."},
    "grid-shift-select": {"harm": "low", "why": "Shift+ArrowRight from B1 beside the merged C1:E1 selects B1:C1 (half the merged cell); Excel widens the selection to B1:E1."},
    "grid-copy-paste-merged": {"harm": "low", "why": "A merged title copied and pasted comes as its text only; Excel pastes the merge with it."},
    "grid-sort-message": {"harm": "low", "why": "The refusal says \"unmerge them first (as in Excel)\", but Sheets has no Unmerge: the person is told to do something they cannot. It could say to sort the rows below the merged cells, or to unmerge in Excel or LibreOffice."},
    "grammar-let": {"harm": "low", "why": "LET's names need _xlpm. in the file (_xlfn.LET(_xlpm.x,2,_xlpm.x*3)); without it Excel shows #NAME?. Lantern has no LET, so this only matters for a formula carried through. (excel_only.)"},
    "grammar-lowercase": {"harm": "low", "why": "Lower-case names and references are written as typed (sum(a1:a3)); Excel always writes them upper case and other readers expect that. LibreOffice reads them; Excel very likely does too. (excel_only.)"},
    "grammar-sheet-refs": {"harm": "low", "why": "A 3-D reference SUM(Jan:Mar!B2), which Excel reads, is called unreadable (\"! is not one of Excel's signs\"), so it is saved as text with a false reason."},
    "order-percent": {"harm": "low", "why": "% then ^: =50%^2 and =-5%^2 are #ERR, and =2^300% is 2^300/100 (2.04E+88) instead of 2^3 = 8. Rare in real sheets, but the last is a wrong number without a word."},
    "order-compare": {"harm": "low", "why": "TRUE and FALSE against numbers: =1<2<3 is TRUE here (Excel FALSE: TRUE is above every number), =TRUE>1 is FALSE here (Excel TRUE). Rare. (excel_only: LibreOffice has no TRUE apart from 1 and compares text with case by default, so it cannot judge these.)"},
    "order-cell-minus": {"harm": "low", "why": "=-A3%^2 is #ERR (Excel 4); the other minus-and-power cases are right."},
    # ---- agreements worth a word ----
    "read-fn-notes": {"why": "The note names exactly the six cells Lantern works out differently (O10, L13, L16, I17, O21, L26) and no other."},
    "read-hidden-rows-said": {"why": "The note names B13, B14 and B15 with Excel's values."},
    "read-wide-said": {"why": "The note says 20 cells past Z are left out and names B6:B10 with Excel's values."},
    "write-excel-functions": {"harm": "medium", "why": "220 of 226 calls agree. The six that do not: GAMMA(5) is 1.0000000000000002 here and 24 in Excel (Lantern's GAMMA is another function, see write-gamma-name-clash); BASE(10,2) and BASE(255,16,4) are #NAME? here; CONVERT(1,\"lbm\",\"kg\") is #ERR here (Excel 0.4536); WORKDAY.INTL and NETWORKDAYS.INTL are #NAME? in LibreOffice because of the _xlfn. prefix."},
    "grid-col-delete-first": {"why": "Taking out column C (where the title lives) leaves C1:D1 merged and the title gone; LibreOffice drops the merge and the title too. Either is accepted."},
    "write-control-chars": {"why": "The vertical tab, form feed and bell are dropped, so the file is good XML; the words either side of a dropped vertical tab run together (Linebreak), which is a small loss."},
    "write-x-escape-literal": {"why": "Text that reads like Excel's _xHHHH_ escape is escaped as _x005F_, as Excel does, and comes back as typed."},
    "read-big": {"why": "2,000 rows by 26 columns read in about 2.4 s in jsdom."},
    "order-text-coerced": {"why": "Text turned into numbers as Excel turns it. (excel_only: LibreOffice 24.2 refuses \"1,000\"+1 and takes \"TRUE\"+1 as 2, unlike Excel.)"},
    "write-big": {"why": "Saved in about 0.4 s, schema-valid; LibreOffice's sums match."},
}

old = {}
p = os.path.join(HERE, "cases.json")
if os.path.exists(p):
    for c in json.load(open(p, encoding="utf-8")): old[c["id"]] = c
ids = set()
for c in CASES:
    assert c["id"] not in ids, c["id"]; ids.add(c["id"])
    o = old.get(c["id"], {})
    c["lantern_got"] = o.get("lantern_got"); c["agree"] = o.get("agree")
    j = JUDGE.get(c["id"], {})
    c["harm"] = j.get("harm") if c["agree"] is False else None
    c["why"] = j.get("why") or ("Lantern does as Excel does here." if c["agree"] else "")
json.dump(CASES, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(len(CASES), "cases written to", p, {g: sum(1 for c in CASES if c["group"] == g) for g in ["read", "write", "round", "grid", "grammar", "order"]})
