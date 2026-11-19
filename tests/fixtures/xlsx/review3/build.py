# build.py -- the third Excel review of Lantern (1.24.28): writes the input workbooks (files/) and cases.json.
#   python3 tests/fixtures/xlsx/review3/build.py            (needs XlsxWriter, openpyxl and LibreOffice's python3-uno)
# Each case says what Excel does ("expected"). For the guard of everyday formulas (group 1), LibreOffice works the
# formulas out from a workbook of the same cells (files/guard_oracle.xlsx), and its answers are frozen here; where
# LibreOffice is not Excel (it has no XLOOKUP; COUNT of a typed "5"), the answer is written by hand (OVERRIDE). For
# every other group the answer is written by hand from what Excel does, and LibreOffice is asked only to cross-check
# (printed, not used). Nothing here comes from Lantern's code.
import datetime, json, os, re, sys, zipfile
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "files")
os.makedirs(FILES, exist_ok=True)
sys.path.insert(0, HERE)
import openpyxl, xlsxwriter
from openpyxl.workbook.defined_name import DefinedName

CASES = []
def add(cid, kind, group, what, inp, expected, excel_only=False, harm="medium", why_bad="", source="by hand, from what Excel does"):
    CASES.append({"id": cid, "kind": kind, "group": group, "what": what, "input": inp, "expected": expected, "excel_only": excel_only,
                  "expected_source": source, "harm_if_disagree": harm, "why_if_disagree": why_bad,
                  "lantern_got": None, "agree": None, "harm": None, "why": None})

# ---------------------------------------------------------------------------------------------------------------
# the everyday sheet: an order list (A:K), a lookup table (M:O) and a few settings (M6:N12)
DATA = {"A1": "Region", "B1": "Item", "C1": "Qty", "D1": "Price", "E1": "Date", "F1": "Rep", "G1": "Status", "H1": "Notes", "I1": "Code", "J1": "Mixed", "K1": "Total",
        "M1": "Item", "N1": "Category", "O1": "Weight", "M2": "Widget", "N2": "Tools", "O2": "0.5", "M3": "Gadget", "N3": "Electronics", "O3": "1.2",
        "M4": "Gizmo", "N4": "Toys", "O4": "0.8", "M6": "Tax", "N6": "0.0825", "M7": "Region", "N7": "North", "M8": "Item", "N8": "Widget",
        "M9": "Min", "N9": "5", "M10": "From", "N10": "2026-03-01", "M11": "Rep", "N11": "Ann", "M12": "Code", "N12": "W-1*"}
ROWS = [("North", "Widget", 5, 2.5, "2026-01-15", "Ann", "Paid", "rush order", "W-100", 10),
        ("South", "Gadget", 3, 10, "2026-02-03", "Bob", "Due", None, "G-200", "n/a"),
        ("North", "Gadget", 2, 10, "2026-02-20", "Cy", "Paid", "Call back", "G-201", 20),
        ("East", "Widget", 7, 2.5, "2026-03-05", "Ann", "Due", "gift wrap", "W-101", None),
        ("West", "Gizmo", 1, 25, "2026-03-18", "Bob", "Paid", None, "Z-300", 30),
        ("North", "Gizmo", 4, 25, "2026-04-01", "Cy", "Due", "RUSH", "Z-301", "-"),
        ("South", "Widget", 6, 2.5, "2026-04-22", "Ann", "Paid", "Fragile items", "W-102", 5),
        ("East", "Gadget", 8, 10, "2026-05-10", "Dee", "Paid", None, "G-202", None),
        ("West", "Widget", 0, 2.5, "2026-05-31", "Bob", None, "rush", "W-103", 40),
        ("North", "Gizmo", 9, 25, "2026-06-15", "Ann", "Paid", "  extra  spaces  ", "Z-302", 2)]
def typed(v):
    if v is None: return None
    if isinstance(v, float) and v == int(v): return str(int(v))
    return str(v)
for i, row in enumerate(ROWS):
    r = i + 2
    for col, v in zip("ABCDEFGHIJ", row):
        t = typed(v)
        if t is not None: DATA["%s%d" % (col, r)] = t
    DATA["K%d" % r] = "=C%d*D%d" % (r, r)

def iso(s): return datetime.datetime.strptime(s, "%Y-%m-%d")
def serial(s): return (iso(s) - datetime.datetime(1899, 12, 30)).days

# ---------------------------------------------------------------------------------------------------------------
# 1. the guard: everyday formulas that name a range in an ordinary way, each in its own cell (Q2, Q3, ...)
GUARD = r'''
=SUM(C2:C11)
=SUM(K2:K11)
=AVERAGE(C2:C11)
=COUNT(C2:C11)
=COUNTA(A2:A11)
=MAX(K2:K11)
=MIN(C2:C11)
=ROUND(SUM(K2:K11)*N6,2)
=ROUND(AVERAGE(D2:D11),2)
=COUNTIF(A2:A11,"North")
=COUNTIF(A2:A11,N7)
=COUNTIF(C2:C11,">5")
=COUNTIF(C2:C11,">"&N9)
=COUNTIF(H2:H11,"*rush*")
=COUNTIF(B2:B11,"?izmo")
=COUNTIF(I2:I11,N12)
=COUNTIF(G2:G11,"<>Paid")
=COUNTIF(G2:G11,"")
=COUNTIF(J2:J11,"*")
=COUNTIF(D2:D11,2.5)
=COUNTIF(F2:F11,F2)
=SUMIF(A2:A11,"North",K2:K11)
=SUMIF(A2:A11,N7,K2:K11)
=SUMIF(C2:C11,">"&AVERAGE(C2:C11))
=SUMIF(B2:B11,"G*",C2:C11)
=SUMIF(F2:F11,"<>Ann",C2:C11)
=SUMIF(E2:E11,"<"&DATE(2026,3,1),C2:C11)
=SUMIF(E2:E11,">="&N10,K2:K11)
=SUMIF(C2:C11,"<5")
=AVERAGEIF(B2:B11,"Gizmo",C2:C11)
=AVERAGEIF(J2:J11,">5")
=AVERAGEIF(C2:C11,"<>0")
=SUMIFS(K2:K11,A2:A11,"North",B2:B11,"Widget")
=SUMIFS(C2:C11,E2:E11,">="&DATE(2026,2,1),E2:E11,"<"&DATE(2026,3,1))
=SUMIFS(K2:K11,F2:F11,N11,G2:G11,"Paid")
=COUNTIFS(A2:A11,"North",C2:C11,">3")
=COUNTIFS(E2:E11,">="&N10,G2:G11,"Paid")
=COUNTIFS(B2:B11,M2,A2:A11,N7)
=AVERAGEIFS(D2:D11,B2:B11,"Widget")
=AVERAGEIFS(C2:C11,A2:A11,"<>North",G2:G11,"Paid")
=MAXIFS(K2:K11,A2:A11,"North")
=MINIFS(C2:C11,B2:B11,"Gadget")
=VLOOKUP(N8,M2:O4,2,FALSE)
=VLOOKUP("Gizmo",M2:O4,3,FALSE)
=VLOOKUP("Gad*",M2:O4,3,FALSE)
=VLOOKUP(7,C2:D11,2,FALSE)
=VLOOKUP(4.5,{0,"Low";5,"High"},2,TRUE)
=VLOOKUP(B5,$M$2:$O$4,3,0)
=IFERROR(VLOOKUP("Nope",M2:O4,2,FALSE),"")
=IFNA(VLOOKUP("Zed",M2:O4,2,FALSE),"none")
=VLOOKUP(N8,M:O,2,FALSE)
=HLOOKUP("Qty",A1:K11,3,FALSE)
=HLOOKUP("Price",A1:K11,11,FALSE)
=INDEX(K2:K11,MATCH("Dee",F2:F11,0))
=INDEX(M2:O4,MATCH("Gizmo",M2:M4,0),3)
=INDEX(A2:K11,3,2)
=INDEX(A2:K11,MATCH("Dee",F2:F11,0),MATCH("Qty",A1:K1,0))
=INDEX(B2:B11,MATCH(MAX(C2:C11),C2:C11,0))
=INDEX(A1:K1,1,3)
=INDEX(F:F,9)
=MATCH("Price",A1:K1,0)
=MATCH(MAX(K2:K11),K2:K11,0)
=MATCH("G*",B2:B11,0)
=MATCH(15,{0,10,20,30},1)
=MATCH(2.5,D2:D11,0)
=MATCH("Dee",F:F,0)
=ISNUMBER(MATCH("Dee",F2:F11,0))
=ISNA(MATCH("Zed",F2:F11,0))
=IFERROR(INDEX(F2:F11,MATCH("East",A2:A11,0)),"-")
=XLOOKUP("Gizmo",M2:M4,O2:O4)
=XLOOKUP("Zed",M2:M4,O2:O4,"none")
=LOOKUP(2,1/(F2:F11="Bob"),C2:C11)
=LOOKUP(17,{0,10,20},{"a","b","c"})
=LOOKUP(2,1/(H2:H11<>""),H2:H11)
=CHOOSE(2,"a","b","c")
=CHOOSE(WEEKDAY(E2),"Sun","Mon","Tue","Wed","Thu","Fri","Sat")
=SUMPRODUCT(C2:C11,D2:D11)
=SUMPRODUCT(--(A2:A11="North"),C2:C11)
=SUMPRODUCT((A2:A11="North")*(B2:B11="Gizmo")*K2:K11)
=SUMPRODUCT(1/COUNTIF(B2:B11,B2:B11))
=SUMPRODUCT((MONTH(E2:E11)=2)*K2:K11)
=SUMPRODUCT(ISNUMBER(SEARCH("rush",H2:H11))*1)
=SUMPRODUCT(--(LEFT(I2:I11,1)="W"),C2:C11)
=SUMPRODUCT(LEN(F2:F11))
=SUMPRODUCT(--(LEN(H2:H11)>0))
=SUMPRODUCT((G2:G11="Paid")*K2:K11)
=SUMPRODUCT(--(YEAR(E2:E11)=2026))
=SUMPRODUCT(--(WEEKDAY(E2:E11,2)>5))
=SUMPRODUCT(--EXACT(A2:A11,"North"))
=SUMPRODUCT(SUMIF(A2:A11,{"North","East"},C2:C11))
=SUMPRODUCT(COUNTIF(M2:M4,B2:B11))
=SUMPRODUCT(--ISNUMBER(J2:J11))
=SUMPRODUCT(--ISTEXT(J2:J11))
=SUMPRODUCT(MAX((A2:A11="South")*K2:K11))
=MAX(INDEX((A2:A11="North")*K2:K11,0))
=SUMPRODUCT(--(TEXT(E2:E11,"mmm")="Feb"))
=SUMPRODUCT(--(MOD(C2:C11,2)=0))
=SUMPRODUCT(INT(D2:D11))
=SUMPRODUCT(--(DAY(E2:E11)>15))
=SUMPRODUCT(--(VALUE(MID(I2:I11,3,3))>200))
=SUMPRODUCT(ROUND(D2:D11*1.1,0))
=SUMPRODUCT(ABS(C2:C11-5))
=SUMPRODUCT(--(TRIM(H2:H11)="extra spaces"))
=SUMPRODUCT(--(UPPER(H2:H11)="RUSH"))
=SUMPRODUCT(--ISNA(MATCH(B2:B11,M2:M3,0)))
=SUMPRODUCT(--ISNUMBER(MATCH(F2:F11,{"Ann","Dee"},0)))
=ROUND(K2*N6,2)
=ROUND(1.005,2)
=ROUND(-2.5,0)
=ROUND(1234.5678,-2)
=ROUNDUP(K2*N6,2)
=ROUNDDOWN(K9/3,1)
=INT(-2.5)
=TRUNC(-2.5)
=MOD(-7,3)
=ABS(SUM(C2:C11)-50)
=CEILING(2.1,0.5)
=FLOOR(2.9,0.5)
=MROUND(7,3)
=SQRT(SUM(C2:C11)+4)
=POWER(2,10)
=LN(EXP(2))
=LOG10(1000)
=SIGN(C10-C2)
=LEN(H11)
=LEN(TRIM(H11))
=TRIM(H11)
=PROPER(H8)
=UPPER(F2)&" "&LOWER(A2)
=A2&"-"&B2
=CONCATENATE(A2," ",B2)
=LEFT(I2,1)
=RIGHT(I3,3)
=MID(I2,3,3)
=VALUE(MID(I2,3,3))+1
=FIND("-",I2)
=SEARCH("ru",H2)
=IFERROR(SEARCH("x",H2),0)
=SUBSTITUTE(I2,"-","")
=SUBSTITUTE(H11," ","")
=REPT("*",C2)
=TEXT(K2,"$#,##0.00")
=TEXT(N6,"0.0%")
=TEXT(1234.5,"#,##0")
=TEXT(E2,"dddd")
=TEXT(E2,"mm/dd/yyyy")
=TEXT(MAX(E2:E11),"mmm d")
=TEXT(-5,"0;(0)")
=TEXT(3,"00")
=FIXED(1234.567,1)
=DOLLAR(1234.5)
=TEXTJOIN(",",TRUE,F2:F5)
=TEXTJOIN(", ",TRUE,H2:H5)
=CONCAT(F2:F4)
=EXACT(A2,"north")
=A2="north"
=YEAR(E2)
=MONTH(E5)
=DAY(E10)
=WEEKDAY(E2)
=WEEKNUM(E2)
=EOMONTH(E2,0)
=EDATE(E2,1)
=DATEDIF(E2,E11,"m")
=E3-E2
=DAYS(E3,E2)
=NETWORKDAYS(E2,E3)
=WORKDAY(E2,10)
=DATE(YEAR(E2),MONTH(E2)+1,1)
=DAY(EOMONTH(E3,0))
=MAX(E2:E11)-MIN(E2:E11)
=DATEVALUE("2026-03-01")
=TIME(14,30,0)
=HOUR(0.75)
=YEAR(TODAY())>=2026
=TEXT(TODAY(),"yyyy")=TEXT(NOW(),"yyyy")
=ISBLANK(G10)
=ISBLANK(A1)
=NOT(ISBLANK(H3))
=IF(ISBLANK(G10),"missing",G10)
=ISTEXT(J3)
=ISNUMBER(J2)
=ISERROR(J3*1)
=IFERROR(J3*2,"bad")
=IF(ISERROR(J3*1),0,J3*1)
=ISEVEN(C2)
=ISODD(C2)
=ISLOGICAL(TRUE)
=ISNONTEXT(C2)
=TYPE(A2)
=N(C2)
=IF(C2>5,"High",IF(C2>2,"Mid","Low"))
=IF(AND(C2>0,D2<5),"cheap","dear")
=IF(OR(A2="East",A2="West"),"coast","inland")
=IFS(C5>6,"big",C5>3,"mid",TRUE,"small")
=IF(COUNTIF(F2:F11,"Dee")>0,"yes","no")
=IF(COUNTIF($F$2:$F$11,F2)>1,"dup","")
=IF(K2>20,"big",IF(K2>10,"mid","small"))
=SWITCH(A5,"North",1,"East",2,0)
=RANK(K2,K2:K11)
=LARGE(K2:K11,2)
=SMALL(C2:C11,3)
=MEDIAN(C2:C11)
=MODE(D2:D11)
=ROUND(STDEV(C2:C11),4)
=ROUND(VAR(C2:C11),4)
=PERCENTILE(C2:C11,0.9)
=QUARTILE(C2:C11,1)
=SUBTOTAL(9,K2:K11)
=SUBTOTAL(1,C2:C11)
=ROUND(CORREL(C2:C11,D2:D11),6)
=ROWS(A2:A11)
=COLUMNS(A1:K1)
=ROW(A5)
=OFFSET(A1,2,2)
=SUM(OFFSET(C1,1,0,3,1))
=INDIRECT("C"&5)
=SUM(INDIRECT("C2:C4"))
=ADDRESS(2,3)
=COUNTBLANK(G2:G11)
=COUNT(J2:J11)
=COUNTA(J2:J11)
=AVERAGE(J2:J11)
=SUM(J2,J3,J4)
=J2+J3
=COUNT(C2:C11,"5")
=SUM(C:C)
=SUMIF(A:A,"North",K:K)
=COUNTA(A:A)
=MAX(C:C)
=ROUND(PMT(0.05/12,360,-200000),2)
=ROUND(FV(0.05/12,120,-100),2)
=ROUND(NPV(0.1,K2:K4),4)
=ROUND(PV(0.08,10,-1000),2)
=COUNTIF(K2:K11,">="&LARGE(K2:K11,3))
=SUMIF($A$2:$A$11,A2,$K$2:$K$11)/SUM($K$2:$K$11)
=AVERAGE(C2:C11,D2)
=INDEX(C2:C11,COUNTA(C2:C11))
=0.1+0.2=0.3
=CODE("A")
=CHAR(65)
=ROMAN(2026)
=DEC2HEX(255)
=NUMBERVALUE("1.234,5",",",".")
=FACT(5)
=COMBIN(5,2)
=GCD(12,18)
=QUOTIENT(7,2)
=TEXT(1/3,"0.000")
=ROUND(SUMPRODUCT(C2:C11,D2:D11)/SUM(C2:C11),2)
=MAX(C2:C11)-MIN(C2:C11)
=SUM(C2:C11)/COUNT(C2:C11)
'''.strip().splitlines()
# where LibreOffice is not Excel: written by hand
OVERRIDE = {
    '=XLOOKUP("Gizmo",M2:M4,O2:O4)': (0.8, "LibreOffice 24.2 has no XLOOKUP; Excel finds Gizmo and gives its weight, 0.8"),
    '=XLOOKUP("Zed",M2:M4,O2:O4,"none")': ("none", "LibreOffice 24.2 has no XLOOKUP; Excel gives the if_not_found value"),
    '=COUNT(C2:C11,"5")': (11, "Excel counts a number typed in quotes as an argument (its help: a text representation of numbers is counted)"),
    '=COUNTIF(J2:J11,"*")': (2, "Excel's * matches text only, so the two texts (n/a and -); LibreOffice also counts the numbers (8)"),
    '=MAX(INDEX((A2:A11="North")*K2:K11,0))': (225, "Excel's INDEX(...,0) takes the list whole without Ctrl+Shift+Enter (the usual way round it); LibreOffice gives #VALUE!"),
}
FUTURE = "XLOOKUP IFS SWITCH MAXIFS MINIFS TEXTJOIN CONCAT DAYS IFNA NUMBERVALUE AGGREGATE STDEV.S GAMMA.DIST".split()
def xlfn(f):
    for fn in FUTURE: f = re.sub(r'(?<![A-Za-z0-9_.])' + re.escape(fn) + r'\(', "_xlfn." + fn + "(", f)
    return f

def oracle_book(path, data, formulas):
    """the everyday sheet as an Excel file (numbers as numbers, dates as dates) with each formula in its cell"""
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Data"
    for ref, v in data.items():
        if v.startswith("="): ws[ref] = v
        elif re.match(r"^\d{4}-\d\d-\d\d$", v): ws[ref] = iso(v); ws[ref].number_format = "yyyy-mm-dd"
        elif re.match(r"^-?\d+(\.\d+)?$", v): ws[ref] = float(v) if "." in v else int(v)
        else: ws[ref] = v
    for ref, f in formulas.items(): ws[ref] = xlfn(f)
    wb.save(path)

def lo_value(o):
    """LibreOffice's answer as Excel would show it: TRUE/FALSE, a number, a text, or an error"""
    if o is None or "missing_sheet" in o: return None
    if o.get("err"):
        s = o.get("s") or ""
        return s if s.startswith("#") else None   # Err:5xx: LibreOffice's own, not Excel's
    if o["kind"] == "FORMULA" and isinstance(o["v"], float) and o["s"] in ("TRUE", "FALSE"): return o["s"] == "TRUE"
    v = o["v"]
    if isinstance(v, float) and v == int(v) and abs(v) < 1e15: return int(v)
    return v

guard_cells = {}
for i, f in enumerate(GUARD):
    guard_cells["Q%d" % (i + 2)] = f

# ---------------------------------------------------------------------------------------------------------------
# lists worked out cell by cell, as Excel 365 does when a formula is typed (rule 1's own cases)
LIFT = [
    ("=SUMPRODUCT(--ISBLANK(G2:G11))", 1, "ISBLANK of each cell: G10 is the one blank", "high"),
    ("=SUMPRODUCT(--ISBLANK(H2:H11))", 3, "ISBLANK of each cell: H3, H6 and H9 are blank", "high"),
    ("=SUMPRODUCT(--NOT(ISBLANK(G2:G11)))", 9, "the cells that are filled in", "high"),
    ("=SUMPRODUCT(--ISBLANK(J2:J11))", 2, "J5 and J9 are blank", "high"),
    ("=SUM(--ISBLANK(H2:H11))", 3, "ISBLANK of each cell, added", "high"),
    ("=SUM(ROW(A2:A11))", 65, "ROW of a range is the list of its rows (2..11)", "medium"),
    ("=SUMPRODUCT((A2:A11=\"North\")*ROW(A2:A11))", 24, "the rows of North (2+4+7+11)", "medium"),
    ("=INDEX($B$2:$B$11,SMALL(IF($A$2:$A$11=\"North\",ROW($A$2:$A$11)-1),2))", "Gadget", "the second North order's item (the classic extraction)", "high"),
    ("=INDEX(B2:B11,AGGREGATE(15,6,(ROW(A2:A11)-1)/(A2:A11=\"North\"),2))", "Gadget", "the same with AGGREGATE", "high"),
    ("=MAX(IF(A2:A11=\"North\",ROW(A2:A11)))", 11, "the last North row", "medium"),
    ("=SUM(COLUMN(C1:E1))", 12, "COLUMN of a range is the list of its columns (3+4+5)", "low"),
    ("=SUM(LARGE(K2:K11,{1,2,3}))", 405, "the three largest totals (225+100+80)", "medium"),
    ("=SUMPRODUCT(LARGE(K2:K11,{1,2,3}))", 405, "the same in SUMPRODUCT", "medium"),
    ("=SUM(SMALL(C2:C11,{1,2}))", 1, "the two smallest quantities (0+1)", "medium"),
    ("=SUM(LEN(H2:H11))", 66, "LEN of each note", "medium"),
    ("=MAX(LEN(F2:F11))", 3, "the longest name", "medium"),
    ("=SUM(IFERROR(J2:J11*1,0))", 107, "IFERROR of each cell", "medium"),
    ("=COUNT(1/C2:C11)", 9, "C10 is 0, so one cell is #DIV/0!; COUNT counts the rest", "medium"),
    ("=SUM(J2:J11*1)", "#VALUE!", "a text in J makes one cell #VALUE!; SUM shows it", "medium"),
    ("=MAX(1/C2:C11)", "#DIV/0!", "MAX shows the cell's #DIV/0!", "medium"),
    ("=IFERROR(MAX(1/C2:C11),\"err\")", "err", "IFERROR around it", "medium"),
    ("=SUMPRODUCT(--ISERROR(J2:J11*1))", 2, "ISERROR of each cell", "medium"),
    ("=COUNT(J2:J11*1)", 8, "blank*1 is 0, a number; the two texts are #VALUE!", "medium"),
    ("=SUM(IF(A2:A11=\"North\",C2:C11))", 20, "SUM(IF(...)) typed in Excel 365", "medium"),
    ("=MAX(IF(A2:A11=\"North\",K2:K11))", 225, "MAX(IF(...))", "medium"),
    ("=SUM(--(A2:A11=\"North\"))", 4, "a comparison of each cell", "medium"),
    ("=INDEX(F2:F11,MATCH(1,(A2:A11=\"South\")*(B2:B11=\"Widget\"),0))", "Ann", "INDEX/MATCH with two conditions", "high"),
    ("=SUM(COUNTIF(A2:A11,{\"North\",\"South\"}))", 6, "COUNTIF with a list of things to look for", "medium"),
    ("=SUM(VLOOKUP(B2:B11,M2:O4,3,FALSE)*C2:C11)", 35.8, "VLOOKUP of each item", "medium"),
    ("=SUM(ROUND(D2:D11*1.1,0))", 129, "ROUND of each price", "medium"),
    ("=SUM(ABS(C2:C11-5))", 25, "ABS of each difference", "medium"),
    ("=SUMPRODUCT(--(TEXT(E2:E11,\"mmm\")=\"May\"))", 2, "TEXT of each date", "medium"),
    ("=SUMPRODUCT(--ISNUMBER(MATCH(F2:F11,{\"Ann\",\"Dee\"},0)))", 5, "MATCH of each name", "medium"),
    ("=SUM(INDEX(C2:C11,{1,3,5}))", 8, "INDEX with a list of rows (5+2+1)", "low"),
    ("=SUMPRODUCT(COUNTIFS(A2:A11,{\"North\";\"South\"},B2:B11,\"Widget\"))", 2, "COUNTIFS with a list", "low"),
    ("=SUM(SUMIFS(C2:C11,A2:A11,\"North\",B2:B11,{\"Widget\",\"Gizmo\"}))", 18, "SUMIFS with a list (5+4+9)", "low"),
    ("=SUM(--ISODD(C2:C11))", 5, "ISODD of each quantity", "medium"),
    ("=SUMPRODUCT(IFERROR(SEARCH(\"z\",B2:B11),0))", 9, "SEARCH of each item, errors as 0 (Gizmo x3, position 3)", "medium"),
    ("=AVERAGE(IF(ISNUMBER(J2:J11),J2:J11))", 107 / 6.0, "the average of J's numbers", "medium"),
    ("=MONTH(E2:E11)", 1, "a list in one cell: Excel 365 spills it; the cell itself shows the first value", "low"),
    ("=ROUND(K2:K11,0)", 13, "the first of the list (12.5 rounds to 13)", "low"),
    ("=ISBLANK(G9:G10)", False, "the first of the list: G9 is not blank", "low"),
    ("=SUMPRODUCT(LEN(G2:G11))", 33, "LEN of each status; LEN of a blank is 0", "medium"),
    ("=SUMPRODUCT(--(G2:G11=\"\"))", 1, "a blank equals \"\"", "medium"),
]
for i, (f, want, what, harm) in enumerate(LIFT):
    cells = dict(DATA); cells["Q2"] = f
    add("lift-%02d" % (i + 1), "compute", "1 a list where one value belongs, worked out cell by cell (Excel 365, typed)", "%s: %s" % (f, what),
        {"cells": cells}, {"values": {"Q2": want}}, harm=harm, why_bad="Excel 365 works the list out cell by cell; Lantern's answer differs")

# what the grid shows for a TRUE, a count and a list's first value
for i, (f, shown) in enumerate([("=ISBLANK(G10)", "TRUE"), ("=COUNTIF(A2:A11,\"North\")", "4"), ("=ISNUMBER(J3)", "FALSE"), ("=SUMPRODUCT(--ISBLANK(G2:G11))", "1")]):
    cells = dict(DATA); cells["Q2"] = f
    add("shown-%02d" % (i + 1), "compute", "1 a list where one value belongs, worked out cell by cell (Excel 365, typed)", "the grid shows %s as Excel shows it (%s)" % (f, shown),
        {"cells": cells, "grid": True}, {"values": {}, "shown": {"Q2": shown}}, harm="medium", why_bad="the cell shows another answer than Excel's")

# ---------------------------------------------------------------------------------------------------------------
# 2. functions with no real answer: #NUM! at once, and what looks at it
ERRS = [
    ("=SQRT(-1)", "#NUM!"), ("=LN(0)", "#NUM!"), ("=ACOS(2)", "#NUM!"), ("=ISERROR(SQRT(-1))", True), ("=IFERROR(LN(0),\"none\")", "none"),
    ("=COUNT(1,SQRT(-1),2)", 2), ("=COUNT(1,1/0,\"x\",2)", 2), ("=ERROR.TYPE(1/0)", 2), ("=ERROR.TYPE(SQRT(-1))", 6), ("=ERROR.TYPE(NA())", 7),
    ("=ERROR.TYPE(5)", "#N/A"), ("=LOG(10,1)", "#DIV/0!"), ("=POWER(0,-1)", "#DIV/0!"), ("=0^-1", "#DIV/0!"), ("=0^0", "#NUM!"),
    ("=FACT(171)", "#NUM!"), ("=EXP(1000)", "#NUM!"), ("=10^400", "#NUM!"), ("=STDEV(5)", "#DIV/0!"), ("=ATAN2(0,0)", "#DIV/0!"),
    ("=MOD(5,0)", "#DIV/0!"), ("=ISNUMBER(LOG(-1))", False), ("=IFERROR(ASIN(2),\"bad\")", "bad"), ("=SUM(1,SQRT(-1))", "#NUM!"),
    ("=AVERAGE(SQRT(4),SQRT(-4))", "#NUM!"), ("=IF(ISERR(SQRT(-1)),\"err\",\"ok\")", "err"), ("=COUNT(SQRT(-1))", 0), ("=ISNA(SQRT(-1))", False),
    ("=ACOSH(0.5)", "#NUM!"), ("=ATANH(1)", "#NUM!"), ("=VAR(5)", "#DIV/0!"), ("=SQRT(16)+LN(1)", 4), ("=1E308*10", "#NUM!"),
    ("=ROUND(TAN(PI()/4),9)", 1), ("=COMBIN(3,5)", "#NUM!"), ("=LOG10(0)", "#NUM!"), ("=ROUND(SQRT(-1),2)", "#NUM!"),
    ("=ERROR.TYPE(#REF!)", 4), ("=ERROR.TYPE(\"a\"+1)", 3), ("=COUNT(A1:A3)", 2),
]
EWHY = {"=ACOSH(0.5)": "low", "=ATANH(1)": "low", "=LOG(10,1)": "low", "=POWER(0,-1)": "low", "=0^-1": "low", "=0^0": "low", "=STDEV(5)": "medium", "=VAR(5)": "medium", "=ATAN2(0,0)": "low", "=1E308*10": "low", "=10^400": "low"}
for i, (f, want) in enumerate(ERRS):
    cells = {"A1": "5", "A2": "=1/0", "A3": "7", "Q2": f}
    add("err-%02d" % (i + 1), "compute", "2 no real answer: #NUM! at once; COUNT, ISERROR, ERROR.TYPE", f, {"cells": cells}, {"values": {"Q2": want}},
        harm=EWHY.get(f, "medium"), why_bad="Excel gives another error or value here")

# ---------------------------------------------------------------------------------------------------------------
# 3. Excel files read: plain formulas (no t="array", no cm) and the @ Excel 365 shows
SMALL = [("North", "Widget", 5, 2.5, "2026-01-15"), ("South", "Gadget", 3, 10, "2026-02-03"), ("North", "Gadget", 2, 10, "2026-02-20"),
         ("East", "Widget", 7, 2.5, "2026-03-05"), ("West", "Gizmo", 1, 25, "2026-03-18"), ("North", "Gizmo", 4, 25, "2026-04-01"),
         ("South", "Widget", 6, 2.5, "2026-04-22"), ("East", "Gadget", 8, 10, "2026-05-10")]
LOOK = [("Widget", 0.5), ("Gadget", 1.2), ("Gizmo", 0.8)]

def xw_file(name, formulas):
    wb = xlsxwriter.Workbook(os.path.join(FILES, name)); ws = wb.add_worksheet("Data")
    dfmt = wb.add_format({"num_format": "yyyy-mm-dd"})
    for c, h in enumerate(("Region", "Item", "Qty", "Price", "Date")): ws.write(0, c, h)
    for r, row in enumerate(SMALL, start=1):
        for c, v in enumerate(row[:4]): ws.write(r, c, v)
        ws.write_datetime(r, 4, iso(row[4]), dfmt)
    for r, (k, v) in enumerate(LOOK, start=1): ws.write(r, 10, k); ws.write(r, 11, v)
    for ref, f in formulas.items(): ws.write_formula(ref, f)
    wb.close()

def op_file(name, formulas, names=None):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Data"
    ws.append(("Region", "Item", "Qty", "Price", "Date"))
    for row in SMALL: ws.append(row[:4] + (iso(row[4]),))
    for r, (k, v) in enumerate(LOOK, start=2): ws.cell(r, 11, k); ws.cell(r, 12, v)
    o = wb.create_sheet("Other")
    for i in range(1, 10): o.cell(i, 1, i * 10)
    for n, ref in (names or {}).items(): wb.defined_names[n] = DefinedName(n, attr_text=ref)
    for ref, f in formulas.items(): ws[ref] = f
    wb.save(os.path.join(FILES, name))

def col_num(s):
    n = 0
    for ch in s: n = n * 26 + ord(ch) - 64
    return n

def hx_file(name, fcells, meta=False):
    """a workbook written by hand: the small data and the formula cells given as <c> XML (row -> list of xml)"""
    rows = {1: ['<c r="A1" t="inlineStr"><is><t>Region</t></is></c>', '<c r="B1" t="inlineStr"><is><t>Item</t></is></c>',
                '<c r="C1" t="inlineStr"><is><t>Qty</t></is></c>', '<c r="D1" t="inlineStr"><is><t>Price</t></is></c>']}
    for r, row in enumerate(SMALL, start=2):
        rows[r] = ['<c r="A%d" t="inlineStr"><is><t>%s</t></is></c>' % (r, row[0]), '<c r="B%d" t="inlineStr"><is><t>%s</t></is></c>' % (r, row[1]),
                   '<c r="C%d"><v>%s</v></c>' % (r, row[2]), '<c r="D%d"><v>%s</v></c>' % (r, row[3])]
    for ref, xml in fcells:
        r = int(re.sub(r"[A-Z]", "", ref)); rows.setdefault(r, []).append(xml)
    body = "".join('<row r="%d">%s</row>' % (r, "".join(sorted(rows[r], key=lambda x: col_num(re.search(r'r="([A-Z]+)', x).group(1))))) for r in sorted(rows))
    S = "http://schemas.openxmlformats.org/"
    sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="%sspreadsheetml/2006/main" '
             'xmlns:r="%sofficeDocument/2006/relationships"><sheetData>%s</sheetData></worksheet>' % (S, S, body))
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="%spackage/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
          + ('<Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/>' if meta else "")
          + '</Types>') % S
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="%spackage/2006/relationships">'
            '<Relationship Id="rId1" Type="%sofficeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') % (S, S)
    wbx = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="%sspreadsheetml/2006/main" xmlns:r="%sofficeDocument/2006/relationships">'
           '<sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>') % (S, S)
    wrels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="%spackage/2006/relationships">'
             '<Relationship Id="rId1" Type="%sofficeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
             '<Relationship Id="rId2" Type="%sofficeDocument/2006/relationships/styles" Target="styles.xml"/>'
             + ('<Relationship Id="rId3" Type="%sofficeDocument/2006/relationships/sheetMetadata" Target="metadata.xml"/>' % S if meta else "")
             + '</Relationships>') % (S, S, S)
    styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="%sspreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
              '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
              '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
              '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>') % S
    metadata = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<metadata xmlns="%sspreadsheetml/2006/main" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray">'
                '<metadataTypes count="1"><metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/></metadataTypes>'
                '<futureMetadata name="XLDAPR" count="1"><bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}"><xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk></futureMetadata>'
                '<cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata></metadata>') % S
    with zipfile.ZipFile(os.path.join(FILES, name), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct); z.writestr("_rels/.rels", rels); z.writestr("xl/workbook.xml", wbx)
        z.writestr("xl/_rels/workbook.xml.rels", wrels); z.writestr("xl/worksheets/sheet1.xml", sheet); z.writestr("xl/styles.xml", styles)
        if meta: z.writestr("xl/metadata.xml", metadata)

def esc(f): return f.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
READ_LO = {}   # file -> refs to cross-check with LibreOffice

def read_case(cid, file, cells, what, harm="medium", excel_only=False, why_bad="", group="3 Excel files read: a plain formula and Excel 365's @"):
    """cells: {ref: {"value": v, "at": True/False/None, "raw": exact or None}}"""
    add(cid, "read", group, what, {"file": file}, {"cells": cells}, excel_only=excel_only, harm=harm,
        why_bad=why_bad or "Excel works this plain formula out otherwise (its @ goes elsewhere, or its value differs)")
    READ_LO.setdefault(file, []).extend(cells.keys())

# XlsxWriter's write_formula (a plain formula, as Python reports are written)
XW = [
    ("G1", "=SUM(C2:C9)", False, 36, None), ("G5", "=C2:C9*2", True, 14, "=@C2:C9*2"), ("G12", "=C2:C9*2", True, "#VALUE!", "=@C2:C9*2"),
    ("G3", "=LEN(A2:A9)", True, 5, "=LEN(@A2:A9)"), ("G1", "=SUMPRODUCT(C2:C9,D2:D9)", False, 300, None), ("G1", "=SUMPRODUCT(LEN(A2:A9))", False, 37, None),
    ("G1", "=SUMPRODUCT((A2:A9=\"North\")*C2:C9)", False, 11, None), ("G1", "=SUMPRODUCT(1/COUNTIF(B2:B9,B2:B9))", False, 3, None),
    ("G1", "=INDEX(B2:B9,MATCH(\"East\",A2:A9,0))", False, "Widget", None), ("G1", "=VLOOKUP(\"West\",A2:D9,3,FALSE)", False, 1, None),
    ("G1", "=COUNTIF(A2:A9,\"North\")", False, 3, None), ("G1", "=SUMIF(A2:A9,\"North\",C2:C9)", False, 11, None),
    ("G1", "=SUMIFS(C2:C9,A2:A9,\"North\",B2:B9,\"Gizmo\")", False, 4, None), ("G1", "=COUNTIFS(A2:A9,\"North\",C2:C9,\">2\")", False, 2, None),
    ("G1", "=AVERAGEIF(B2:B9,\"Widget\",D2:D9)", False, 2.5, None), ("G1", "=LOOKUP(2,1/(A2:A9=\"North\"),C2:C9)", False, 4, None),
    ("G1", "=MAX(INDEX((A2:A9=\"North\")*C2:C9,0))", False, 5, None), ("G1", "=INDEX(C2:C9,MATCH(1,INDEX((A2:A9=\"South\")*(B2:B9=\"Widget\"),0,1),0))", False, 6, None),
    ("G1", "=MATCH(MAX(C2:C9),C2:C9,0)", False, 8, None), ("G1", "=ISNUMBER(MATCH(\"West\",A2:A9,0))", False, True, None),
    ("G1", "=IFERROR(VLOOKUP(\"Nope\",A2:D9,2,FALSE),\"none\")", False, "none", None), ("G1", "=ROUND(AVERAGE(D2:D9),1)", False, 10.9, None),
    ("G1", "=ROUND(CORREL(C2:C9,D2:D9),6)", False, -0.584885, None), ("G1", "=SUM(C2:C9)/COUNT(C2:C9)", False, 4.5, None),
    ("G1", "=_xlfn.TEXTJOIN(\", \",TRUE,A2:A4)", False, "North, South, North", None), ("G4", "=A2:A9", True, "North", "=@A2:A9"),
    ("G14", "=A2:A9", True, "#VALUE!", "=@A2:A9"), ("G7", "=IF(A2:A9=\"North\",\"N\",\"other\")", True, "N", "=IF(@A2:A9=\"North\",\"N\",\"other\")"),
    ("G20", "=AND(C2:C9>0)", True, "#VALUE!", None), ("G6", "=SUM(C2:C9*D2:D9)", True, 25, "=SUM(@C2:C9*@D2:D9)"),
    ("G1", "=INDEX(A2:D9,MATCH(\"West\",A2:A9,0),MATCH(\"Price\",A1:D1,0))", False, 25, None), ("G1", "=HLOOKUP(\"Qty\",A1:D9,4,FALSE)", False, 2, None),
    ("G1", "=LARGE(C2:C9,2)", False, 7, None), ("G1", "=IF(COUNTIF(A2:A9,\"West\"),\"yes\",\"no\")", False, "yes", None),
    ("G1", "=CONCATENATE(A2,\"-\",B2)", False, "North-Widget", None), ("G1", "=SUMIF(A:A,\"North\",C:C)", False, 11, None),
    ("G1", "=VLOOKUP(\"East\",A:D,4,FALSE)", False, 2.5, None), ("G1", "=COUNTA(A:A)-1", False, 8, None), ("G1", "=MAX(C:C)", False, 8, None),
    ("G1", "=IFERROR(INDEX(B:B,MATCH(\"West\",A:A,0)),\"\")", False, "Gizmo", None), ("G1", "=TEXT(D2,\"$0.00\")", False, "$2.50", None),
    ("G3", "=LEFT(A2:A9,1)", True, "S", "=LEFT(@A2:A9,1)"), ("G5", "=ROUND(D2:D9*1.1,1)", True, 2.8, "=ROUND(@D2:D9*1.1,1)"),
    ("G1", "=SUMPRODUCT(ROUND(D2:D9*1.1,0))", False, 98, None), ("G1", "=SUMPRODUCT(--(MONTH(E2:E9)=2))", False, 2, None),
    ("G1", "=ROUND(_xlfn.STDEV.S(C2:C9),6)", False, 2.44949, None), ("G1", "=ROUND(NPV(0.1,C2:C9),4)", False, None, None),
    ("G1", "=_xlfn.XLOOKUP(\"Gizmo\",B2:B9,C2:C9)", False, 1, None), ("G1", "=_xlfn.CONCAT(A2:A4)", False, "NorthSouthNorth", None),
    ("G1", "=SUMPRODUCT(LARGE(C2:C9,{1,2,3}))", False, 21, None), ("G1", "=_xlfn.GAMMA.DIST(2,3,2,FALSE)", False, 0.0919698602928605, None),
]
for i, (ref, f, at, want, raw) in enumerate(XW):
    name = "xw_%02d.xlsx" % (i + 1)
    xw_file(name, {ref: f})
    cell = {"value": want, "at": at}
    if raw: cell["raw"] = raw
    harm = "medium" if (not at and "{" in f) else "high" if not at and want is not None else "medium"   # LARGE(...,{1,2,3}): the root of lift-12
    read_case("read-xw-%02d" % (i + 1), name, {ref: cell}, "XlsxWriter's write_formula: %s in %s" % (f, ref), harm=harm,
              excel_only=(f.startswith("=MAX(INDEX(")))
# formulas filled down a column (each its own row)
xw_file("xw_fill.xlsx", dict([("G%d" % r, "=VLOOKUP(B%d,$K$2:$L$4,2,FALSE)" % r) for r in range(2, 10)] + [("H%d" % r, "=COUNTIF($A$2:A%d,A%d)" % (r, r)) for r in range(2, 10)]
                             + [("I%d" % r, "=SUM($C$2:C%d)" % r) for r in range(2, 10)] + [("J%d" % r, "=RANK(C%d,$C$2:$C$9)" % r) for r in range(2, 10)]))
read_case("read-xw-fill-1", "xw_fill.xlsx", {"G5": {"value": 0.5, "at": False}, "G6": {"value": 0.8, "at": False}}, "VLOOKUP filled down (no @)", harm="high")
read_case("read-xw-fill-2", "xw_fill.xlsx", {"H7": {"value": 3, "at": False}, "H9": {"value": 2, "at": False}}, "a running COUNTIF($A$2:A7,A7) filled down", harm="high")
read_case("read-xw-fill-3", "xw_fill.xlsx", {"I5": {"value": 17, "at": False}, "I9": {"value": 36, "at": False}}, "a running total SUM($C$2:C5) filled down", harm="high")
read_case("read-xw-fill-4", "xw_fill.xlsx", {"J6": {"value": 8, "at": False}, "J9": {"value": 1, "at": False}}, "RANK(C6,$C$2:$C$9) filled down", harm="high")

# openpyxl, with names and a second sheet
OPN = {"Qty": "Data!$C$2:$C$9", "Price": "Data!$D$2:$D$9", "Region": "Data!$A$2:$A$9", "Items": "Data!$B$2:$B$9", "Rate": "Other!$A$1", "Lookup": "Data!$K$2:$L$4"}
op_file("op_names.xlsx", dict([("E%d" % r, "=Qty*Price") for r in range(2, 10)] + [("F%d" % r, "=$C$2:$C$9*2") for r in range(2, 10)] +
                              [("H2", "=SUMPRODUCT(Qty,Price)"), ("H3", "=SUM(Qty*Price)"), ("I6", "=Price"), ("H11", "=Rate*2"), ("H13", "=VLOOKUP(\"Gizmo\",Lookup,2,FALSE)"),
                               ("H14", "=SUMPRODUCT(--(Region=\"North\"),Qty)"), ("H15", "=COUNTIF(Region,\"North\")"), ("H16", "=INDEX(Items,MATCH(\"East\",Region,0))"),
                               ("H17", "=MAX(Qty)-MIN(Qty)"), ("H18", "=Qty")]), OPN)
read_case("read-op-names-row", "op_names.xlsx", {"E3": {"value": 30}, "E5": {"value": 17.5}, "E9": {"value": 80}},
          "=Qty*Price filled down E2:E9, Qty and Price naming whole columns (Excel 2007-2019's row-by-row names)", harm="high",
          why_bad="every row shows the first row's product: Excel gives each row its own (implicit intersection with the names)")
read_case("read-op-names-alone", "op_names.xlsx", {"I6": {"value": 25}}, "=Price in row 6 (a name for D2:D9): D6", harm="medium")
read_case("read-op-names-alone2", "op_names.xlsx", {"H18": {"value": "#VALUE!"}}, "=Qty in row 18 (outside the name's rows): #VALUE!", harm="low")
read_case("read-op-names-sum", "op_names.xlsx", {"H3": {"value": 30}}, "=SUM(Qty*Price) in row 3, not an array formula: Excel 2019 works it out at row 3", harm="medium", excel_only=False)
read_case("read-op-names-sumproduct", "op_names.xlsx", {"H2": {"value": 300, "at": False}}, "=SUMPRODUCT(Qty,Price)", harm="high")
read_case("read-op-names-rate", "op_names.xlsx", {"H11": {"value": 20, "at": False}}, "=Rate*2, Rate naming Other!$A$1", harm="high")
read_case("read-op-names-lookup", "op_names.xlsx", {"H13": {"value": 0.8, "at": False}}, "=VLOOKUP(\"Gizmo\",Lookup,2,FALSE) with a name for the table", harm="high")
read_case("read-op-names-sp", "op_names.xlsx", {"H14": {"value": 11, "at": False}}, "=SUMPRODUCT(--(Region=\"North\"),Qty)", harm="high")
read_case("read-op-names-countif", "op_names.xlsx", {"H15": {"value": 3, "at": False}}, "=COUNTIF(Region,\"North\")", harm="high")
read_case("read-op-names-index", "op_names.xlsx", {"H16": {"value": "Widget", "at": False}}, "=INDEX(Items,MATCH(\"East\",Region,0))", harm="high")
read_case("read-op-names-maxmin", "op_names.xlsx", {"H17": {"value": 7, "at": False}}, "=MAX(Qty)-MIN(Qty)", harm="high")
read_case("read-op-range-row", "op_names.xlsx", {"F3": {"value": 6, "at": True}, "F5": {"value": 14, "at": True}, "F9": {"value": 16, "at": True}},
          "=$C$2:$C$9*2 filled down F2:F9 (each row its own C)", harm="high")

op_file("op_misc.xlsx", {"G5": "=Other!A2:A9+0", "I5": "=C:C*10", "H4": "=(C2:C9)", "H5": "=IF(A2=\"North\",C2:C9,0)", "H6": "=INDEX(C2:D9,0,2)",
                         "H7": "=CHOOSE(2,C2:C9,D2:D9)", "H8": "=_xlfn.AGGREGATE(14,6,C2:C9/(A2:A9=\"North\"),1)", "H9": "=OFFSET(C2,0,0,8,1)",
                         "H10": "=SUM(C2:INDEX(C2:C9,3))", "H12": "=SUM(Data!C2:C9)", "H19": "=_xlfn.AGGREGATE(15,6,C2:C9/(A2:A9=\"East\"),1)",
                         "H20": "=SUMPRODUCT(--(Other!A1:A9>40))", "H21": "=SUM(C2:C9 A5:D5)", "H22": "=COUNT(C2:C9)*2", "H23": "=C5*D5"})
read_case("read-op-other-sheet", "op_misc.xlsx", {"G5": {"value": 50, "at": True}}, "=Other!A2:A9+0 in row 5: Other!A5", harm="medium")
read_case("read-op-whole-col", "op_misc.xlsx", {"I5": {"value": 70, "at": True}}, "=C:C*10 in row 5: C5*10", harm="medium")
read_case("read-op-paren", "op_misc.xlsx", {"H4": {"value": 2}}, "=(C2:C9) in row 4: C4", harm="low")
read_case("read-op-if-range", "op_misc.xlsx", {"H5": {"value": 7}}, "=IF(A2=\"North\",C2:C9,0) in row 5: IF gives C2:C9, which Excel meets at row 5 (C5)", harm="low")
read_case("read-op-index0", "op_misc.xlsx", {"H6": {"value": 25}}, "=INDEX(C2:D9,0,2) alone in row 6: column D, met at row 6 (D6)", harm="low")
read_case("read-op-choose", "op_misc.xlsx", {"H7": {"value": 25}}, "=CHOOSE(2,C2:C9,D2:D9) alone in row 7: D7", harm="low")
read_case("read-op-aggregate", "op_misc.xlsx", {"H8": {"value": 5, "at": False}},
          "=AGGREGATE(14,6,C2:C9/(A2:A9=\"North\"),1): AGGREGATE's array form takes the list whole without Ctrl+Shift+Enter", harm="high",
          why_bad="a right formula gets a wrong @: AGGREGATE's third value in its array form (14 to 19) is a whole list in Excel 2010 and later")
read_case("read-op-aggregate2", "op_misc.xlsx", {"H19": {"value": 7, "at": False}}, "=AGGREGATE(15,6,C2:C9/(A2:A9=\"East\"),1): the smallest East quantity", harm="high",
          why_bad="a right formula gets a wrong @: AGGREGATE's array form takes the whole list")
read_case("read-op-offset", "op_misc.xlsx", {"H9": {"value": 8}}, "=OFFSET(C2,0,0,8,1) alone in row 9: C9", harm="low")
read_case("read-op-range-index", "op_misc.xlsx", {"H10": {"value": 10, "at": False}}, "=SUM(C2:INDEX(C2:C9,3)): a range that ends where INDEX says (5+3+2)", harm="medium",
          why_bad="a right, common formula (a range up to INDEX) gives an error")
read_case("read-op-own-sheet", "op_misc.xlsx", {"H12": {"value": 36, "at": False}}, "=SUM(Data!C2:C9) naming its own sheet", harm="high")
read_case("read-op-other-sp", "op_misc.xlsx", {"H20": {"value": 5, "at": False}}, "=SUMPRODUCT(--(Other!A1:A9>40))", harm="high")
read_case("read-op-intersect", "op_misc.xlsx", {"H21": {"value": 7, "at": False}}, "=SUM(C2:C9 A5:D5): the space between two ranges is where they meet (C5, 7)", harm="low")
read_case("read-op-count", "op_misc.xlsx", {"H22": {"value": 16, "at": False}}, "=COUNT(C2:C9)*2", harm="high")
read_case("read-op-cell", "op_misc.xlsx", {"H23": {"value": 17.5, "at": False}}, "=C5*D5", harm="high")

# more names: whole-column names, and IF with names filled down (the same legacy idiom)
op_file("op_names2.xlsx", dict([("E%d" % r, "=IF(Region=\"North\",Qty,0)") for r in range(2, 10)] + [("F%d" % r, "=QtyCol*PriceCol") for r in range(2, 10)] +
                               [("G%d" % r, "=LEN(Items)") for r in range(2, 10)] + [("H2", "=SUM(QtyCol)"), ("H3", "=SUMPRODUCT(QtyCol,PriceCol)"), ("H4", "=COUNTIF(Region,\"East\")*2")]),
        dict(OPN, QtyCol="Data!$C:$C", PriceCol="Data!$D:$D"))
read_case("read-op-names-if", "op_names2.xlsx", {"E3": {"value": 0}, "E4": {"value": 2}, "E7": {"value": 4}}, "=IF(Region=\"North\",Qty,0) filled down: each row's own (North rows keep their Qty)", harm="high",
          why_bad="every row is worked out from the first row (A2 North, C2 5): Excel meets the names at each row")
read_case("read-op-names-col", "op_names2.xlsx", {"F3": {"value": 30}, "F6": {"value": 25}}, "=QtyCol*PriceCol filled down, the names on whole columns ($C:$C, $D:$D)", harm="medium",
          why_bad="every row shows the first row's product, or the headers' (Qty*Price is #VALUE!)")
read_case("read-op-names-len", "op_names2.xlsx", {"G4": {"value": 6}, "G6": {"value": 5}}, "=LEN(Items) filled down: each row's item's length", harm="high")
read_case("read-op-names-colsum", "op_names2.xlsx", {"H2": {"value": 36, "at": False}}, "=SUM(QtyCol) over a whole-column name", harm="medium")
read_case("read-op-names-colsp", "op_names2.xlsx", {"H3": {"value": 300, "at": False}}, "=SUMPRODUCT(QtyCol,PriceCol) over whole-column names", harm="medium")
read_case("read-op-names-countif2", "op_names2.xlsx", {"H4": {"value": 4, "at": False}}, "=COUNTIF(Region,\"East\")*2", harm="high")
# a range met at the formula's column, a 2-D range, a whole row; functions that take a range in another argument
XW2 = [
    ("D12", "=C2:D2*2", True, 5, "the row C2:D2 met at column D: D2*2"), ("F12", "=C2:D2*2", True, "#VALUE!", "the row C2:D2 from column F: no meeting, #VALUE!"),
    ("H9", "=C2:C9*1", True, 8, "C2:C9*1 in row 9, the range's last row: C9"), ("G5", "=C2:D9", True, "#VALUE!", "the block C2:D9 in G5: its column is not G, #VALUE!"),
    ("C12", "=2:2*1", True, 5, "the whole row 2:2 in column C: C2"),
    ("G1", "=NETWORKDAYS(E2,E9,E3:E4)", False, 80, "NETWORKDAYS with two holidays (a range in its third value)"),
    ("G1", "=WORKDAY(E2,10,E3:E4)", False, 46051, "WORKDAY with holidays that are not in its days"),
    ("G1", "=ROUND(_xlfn.FORECAST.LINEAR(10,D2:D9,C2:C9),6)", False, None, "FORECAST.LINEAR over two ranges"),
    ("G1", "=ROUND(SLOPE(D2:D9,C2:C9),6)", False, None, "SLOPE"), ("G1", "=ROUND(XNPV(0.1,C2:C9,E2:E9),4)", False, None, "XNPV with dates"),
    ("G1", "=PERCENTRANK(C2:C9,4)", False, 0.428, "PERCENTRANK (Excel cuts 3/7 to three digits, 0.428, as its help's own example 0.666 shows; LibreOffice rounds)"), ("G1", "=SUBTOTAL(109,C2:C9)", False, 36, "SUBTOTAL(109,...)"),
    ("G1", "=COUNTBLANK(A2:D9)", False, 0, "COUNTBLANK"), ("G1", "=SUM(OFFSET(C1,1,0,COUNT(C2:C9),1))", False, 36, "OFFSET sized by COUNT"),
    ("G1", "=INDEX(C2:C9,COUNT(C2:C9))", False, 8, "INDEX of the last"), ("G1", "=VLOOKUP(MAX(C2:C9),C2:D9,2,FALSE)", False, 10, "VLOOKUP of the MAX"),
    ("G1", "=SUMPRODUCT((A2:A9=\"North\")+(A2:A9=\"East\"),C2:C9)", False, 26, "SUMPRODUCT with an OR of two lists"),
    ("G1", "=MEDIAN(C2:C9)*COUNT(C2:C9)", False, 36, "MEDIAN times COUNT"),
    ("G10", "=_xlfn.TEXTJOIN(\",\",TRUE,IF(A2:A9=\"North\",B2:B9,\"\"))", True, "#VALUE!", "TEXTJOIN of an IF over a list, NOT Ctrl+Shift+Enter, in row 10: Excel 2019 meets A2:A9 at row 10, which it cannot"),
]
for i, (ref, f, at, want, what) in enumerate(XW2):
    name = "xw2_%02d.xlsx" % (i + 1)
    xw_file(name, {ref: f})
    read_case("read-xw2-%02d" % (i + 1), name, {ref: {"value": want, "at": at}}, "%s: %s in %s" % (what, f, ref), harm="high" if not at else "medium")

# written by hand: shared formulas, array formulas, Excel 365's spilling formula and its _xlfn.SINGLE
def fx(ref, f): return (ref, '<c r="%s"><f>%s</f></c>' % (ref, esc(f)))
hx_file("hx_shared_range.xlsx", [("G2", '<c r="G2"><f t="shared" ref="G2:G9" si="0">$C$2:$C$9*2</f></c>')] + [("G%d" % r, '<c r="G%d"><f t="shared" si="0"/></c>' % r) for r in range(3, 10)])
read_case("read-hx-shared-range", "hx_shared_range.xlsx", {"G5": {"value": 14, "at": True}, "G9": {"value": 16, "at": True}}, "a shared formula $C$2:$C$9*2 over G2:G9 (Excel's own way of filling down)", harm="high")
hx_file("hx_shared_cell.xlsx", [("G2", '<c r="G2"><f t="shared" ref="G2:G9" si="0">C2*D2</f></c>')] + [("G%d" % r, '<c r="G%d"><f t="shared" si="0"/></c>' % r) for r in range(3, 10)])
read_case("read-hx-shared-cell", "hx_shared_cell.xlsx", {"G6": {"value": 25, "at": False}, "G9": {"value": 80, "at": False}}, "a shared formula C2*D2 over G2:G9", harm="high")
hx_file("hx_array1.xlsx", [("G2", '<c r="G2"><f t="array" ref="G2">SUM(C2:C9*D2:D9)</f></c>')])
read_case("read-hx-array1", "hx_array1.xlsx", {"G2": {"value": 300, "at": False}}, "{=SUM(C2:C9*D2:D9)} (Ctrl+Shift+Enter): no @", harm="high")
hx_file("hx_array8.xlsx", [("G2", '<c r="G2"><f t="array" ref="G2:G9">C2:C9*2</f></c>')] + [("G%d" % r, '<c r="G%d"><v>0</v></c>' % r) for r in range(3, 10)])
read_case("read-hx-array8", "hx_array8.xlsx", {"G2": {"value": 10, "at": False}}, "{=C2:C9*2} over G2:G9: no @", harm="high")
hx_file("hx_dyn_sort.xlsx", [("G2", '<c r="G2" cm="1"><f t="array" ref="G2:G9">_xlfn._xlws.SORT(C2:C9)</f></c>')], meta=True)
read_case("read-hx-dyn-sort", "hx_dyn_sort.xlsx", {"G2": {"value": 1, "at": False}}, "Excel 365's =SORT(C2:C9), spilling (cm=\"1\"): no @", harm="high")
hx_file("hx_single_plain.xlsx", [fx("G5", "_xlfn.SINGLE(C2:C9)*2")])
read_case("read-hx-single-plain", "hx_single_plain.xlsx", {"G5": {"value": 14, "at": True, "raw": "=@C2:C9*2"}}, "_xlfn.SINGLE(C2:C9)*2 in a plain formula in row 5", harm="medium")
hx_file("hx_single_dyn.xlsx", [("G5", '<c r="G5" cm="1"><f t="array" ref="G5:G12">_xlfn.SINGLE(C2:C9)*D2:D9</f></c>')], meta=True)
read_case("read-hx-single-dyn", "hx_single_dyn.xlsx", {"G5": {"value": 17.5, "at": True, "raw": "=@C2:C9*D2:D9"}}, "Excel 365's =@C2:C9*D2:D9 spilling from G5 (C5 times each price; the first is 7*2.5)", harm="medium")
hx_file("hx_single_sheet.xlsx", [("G5", '<c r="G5" cm="1"><f t="array" ref="G5:G12">_xlfn.SINGLE(Data!C2:C9)*D2:D9</f></c>')], meta=True)
read_case("read-hx-single-sheet", "hx_single_sheet.xlsx", {"G5": {"value": 17.5, "at": True}}, "Excel 365's =@Data!C2:C9*D2:D9 spilling from G5 (the range named with its sheet): C5 times each price, first 17.5", harm="medium")
hx_file("hx_single_index.xlsx", [("G6", '<c r="G6" cm="1"><f t="array" ref="G6:H6">_xlfn.SINGLE(INDEX(C2:D9,0,2))*{1,2}</f></c>')], meta=True)
read_case("read-hx-single-index", "hx_single_index.xlsx", {"G6": {"value": 25, "at": True}}, "Excel 365's =@INDEX(C2:D9,0,2)*{1,2} spilling from G6: INDEX's column met at row 6 (D6, 25), then 25 and 50", harm="medium",
          why_bad="Lantern's @ before INDEX takes the column's first value (D2), not the one at the formula's row")
hx_file("hx_match_expr.xlsx", [fx("G14", "INDEX(C2:C9,MATCH(1,(A2:A9=\"South\")*(B2:B9=\"Widget\"),0))"), fx("G8", "MATCH(TRUE,C2:C9>6,0)"), fx("G12", "SUM(IF(A2:A9=\"North\",C2:C9))"),
                                 fx("G15", "SUMPRODUCT((A2:A9=\"North\")*(C2:C9>3))"), fx("G16", "MAX(C2:C9)-MIN(C2:C9)"), fx("G17", "SUM( C2:C9 )"), fx("G5", "C2:C9 *2"), fx("G6", "-C2:C9")])
read_case("read-hx-match-expr", "hx_match_expr.xlsx", {"G14": {"value": "#VALUE!"}}, "INDEX/MATCH with two conditions saved WITHOUT Ctrl+Shift+Enter, in row 14: Excel 2019 meets (A2:A9=...) at row 14, which it cannot",
          harm="medium", excel_only=True, why_bad="Lantern works the list out whole; Excel (2019, and 365 for this legacy formula) needs Ctrl+Shift+Enter for it and shows an error, so the sheet and Excel disagree")
read_case("read-hx-match-true", "hx_match_expr.xlsx", {"G8": {"value": "#N/A"}}, "MATCH(TRUE,C2:C9>6,0) without Ctrl+Shift+Enter in row 8: Excel 2019 looks at C8>6 only (FALSE), so #N/A",
          harm="medium", excel_only=True, why_bad="Lantern works the list out whole; Excel works MATCH's lookup list out at the formula's row when it is not an array formula")
read_case("read-hx-sumif-plain", "hx_match_expr.xlsx", {"G12": {"value": "#VALUE!", "at": True}}, "SUM(IF(A2:A9=\"North\",C2:C9)) without Ctrl+Shift+Enter in row 12: #VALUE!", harm="medium")
read_case("read-hx-sumproduct2", "hx_match_expr.xlsx", {"G15": {"value": 2, "at": False}}, "SUMPRODUCT((A2:A9=\"North\")*(C2:C9>3))", harm="high")
read_case("read-hx-maxmin", "hx_match_expr.xlsx", {"G16": {"value": 7, "at": False}}, "MAX(C2:C9)-MIN(C2:C9)", harm="high")
read_case("read-hx-spaces", "hx_match_expr.xlsx", {"G17": {"value": 36, "at": False}}, "SUM( C2:C9 ) with spaces", harm="high")
read_case("read-hx-space-op", "hx_match_expr.xlsx", {"G5": {"value": 14, "at": True}}, "C2:C9 *2 (a space before the sign) in row 5", harm="medium")
read_case("read-hx-minus", "hx_match_expr.xlsx", {"G6": {"value": -1, "at": True}}, "-C2:C9 in row 6: -C6", harm="medium")

# ---------------------------------------------------------------------------------------------------------------
# 3b. the same files saved again (Import file, then Save .xlsx): the formula as Excel then works it out
def rt_case(cid, file, cells, what, harm="medium", excel_only=False, why_bad="", sheet=None):
    """cells: {ref: {"value": what Excel shows after the round trip, "array": True/False/None, "has": [text the saved formula holds], "not": [...]}}"""
    add(cid, "roundtrip", "3 Excel files saved again: the @ goes, or becomes _xlfn.SINGLE", what, {"file": file, "sheet": sheet}, {"cells": cells}, excel_only=excel_only,
        harm=harm, why_bad=why_bad or "after Lantern saves it again, Excel works the formula out otherwise than the file it came from")
rt_case("round-xw-op", "xw_02.xlsx", {"G5": {"value": 14, "array": False, "has": ["C2:C9*2"], "not": ["SINGLE", "@"]}}, "=@C2:C9*2 (row 5) saved again: a plain formula, 14 in Excel")
rt_case("round-xw-len", "xw_04.xlsx", {"G3": {"value": 5, "array": False, "has": ["LEN(A2:A9)"], "not": ["SINGLE", "@"]}}, "=LEN(@A2:A9) (row 3) saved again: plain, 5")
rt_case("round-xw-outside", "xw_03.xlsx", {"G12": {"value": "#VALUE!", "array": False}}, "=@C2:C9*2 in row 12 saved again: still #VALUE! in Excel")
rt_case("round-xw-sp", "xw_06.xlsx", {"G1": {"value": 37, "has": ["SUMPRODUCT(LEN(A2:A9))"], "not": ["SINGLE", "@"]}}, "=SUMPRODUCT(LEN(A2:A9)) saved again: 37")
rt_case("round-xw-sum-op", "xw_30.xlsx", {"G6": {"value": 25, "array": False}}, "=SUM(@C2:C9*@D2:D9) (row 6) saved again: still 25 in Excel")
rt_case("round-op-names-row", "op_names.xlsx", {"E3": {"value": 30}, "E9": {"value": 80}}, "=Qty*Price filled down, saved again: each row still its own product in Excel",
        harm="high", sheet="Data", why_bad="the saved formula is an array formula of the whole columns, so Excel shows the first row's product in every row")
rt_case("round-op-names-sum", "op_names.xlsx", {"H3": {"value": 30}}, "=SUM(Qty*Price) in row 3, saved again: Excel showed 30 before and should after", sheet="Data")
rt_case("round-op-names-alone", "op_names.xlsx", {"I6": {"value": 25}}, "=Price in row 6, saved again: D6 (25)", sheet="Data")
rt_case("round-op-names-if", "op_names2.xlsx", {"E4": {"value": 2}, "E7": {"value": 4}}, "=IF(Region=\"North\",Qty,0) filled down, saved again: each row its own", harm="high", sheet="Data")
rt_case("round-xw2-col", "xw2_01.xlsx", {"D12": {"value": 5, "array": False}}, "=@C2:D2*2 (met at column D) saved again: still 5")
rt_case("round-op-aggregate", "op_misc.xlsx", {"H8": {"value": 5, "not": ["SINGLE", "@"]}}, "=AGGREGATE(14,6,...) saved again: still 5 in Excel", sheet="Data")
rt_case("round-op-other", "op_misc.xlsx", {"G5": {"value": 50, "array": False}}, "=@Other!A2:A9+0 (row 5) saved again with its workbook: 50", sheet="Data")
rt_case("round-hx-single-plain", "hx_single_plain.xlsx", {"G5": {"value": 14, "array": False, "not": ["SINGLE"]}}, "_xlfn.SINGLE(C2:C9)*2 (plain) saved again: plain C2:C9*2")
rt_case("round-hx-single-dyn", "hx_single_dyn.xlsx", {"G5": {"array": True, "has": ["_xlfn.SINGLE(C2:C9)"]}}, "Excel 365's =@C2:C9*D2:D9 (spilling) saved again: an array formula with _xlfn.SINGLE")
rt_case("round-hx-single-sheet", "hx_single_sheet.xlsx", {"G5": {"value": 17.5, "array": True, "has": ["_xlfn.SINGLE("]}}, "=@Data!C2:C9*D2:D9 (spilling) saved again: the @ kept as _xlfn.SINGLE, 17.5 in Excel",
        why_bad="the @ is dropped from an array formula, so Excel multiplies the whole column C (the first, 5*2.5)")
rt_case("round-hx-single-index", "hx_single_index.xlsx", {"G6": {"array": True, "has": ["_xlfn.SINGLE("]}}, "=@INDEX(C2:D9,0,2)*{1,2} (spilling) saved again: the @ kept as _xlfn.SINGLE",
        why_bad="the @ is dropped from an array formula: Excel then works out INDEX's whole column")
rt_case("round-hx-shared", "hx_shared_range.xlsx", {"G5": {"value": 14, "array": False}, "G9": {"value": 16, "array": False}}, "the shared $C$2:$C$9*2 saved again: each row its own C*2")
rt_case("round-xw-fill", "xw_fill.xlsx", {"G5": {"value": 0.5, "array": False}, "H7": {"value": 3, "array": False}, "I9": {"value": 36, "array": False}}, "VLOOKUP, a running COUNTIF and a running SUM saved again: no array formulas", harm="medium")

# ---------------------------------------------------------------------------------------------------------------
# 4. the writer: Excel's grammar
GR = [
    ("ROUND(A1)", {"ok": True, "f": "ROUND(A1,0)"}, "medium"), ("ROUND(SUM(A1,A2))", {"ok": True, "f": "ROUND(SUM(A1,A2),0)"}, "medium"),
    ("ROUND(ROUND(A1),2)", {"ok": True, "f": "ROUND(ROUND(A1,0),2)"}, "medium"), ("ROUNDUP(A1)", {"ok": True, "f": "ROUNDUP(A1,0)"}, "medium"),
    ("ROUNDDOWN(-2.9)", {"ok": True, "f": "ROUNDDOWN(-2.9,0)"}, "medium"), ("FLOOR(A1)", {"ok": True, "f": "FLOOR(A1,1)"}, "medium"),
    ("CEILING(A1)", {"ok": True, "f": "CEILING(A1,1)"}, "medium"), ("CEIL(A1)", {"ok": True, "f": "CEILING(A1,1)"}, "medium"),
    ("CEIL(A1,2)", {"ok": True, "f": "CEILING(A1,2)"}, "medium"), ("POW(2,3)", {"ok": True, "f": "POWER(2,3)"}, "medium"),
    ("IF(A1)", {"ok": True, "f": "IF(A1,1,0)"}, "medium"), ("IF(AND(A1,B1))", {"ok": True, "f": "IF(AND(A1,B1),1,0)"}, "medium"),
    ("IF(A1,\"x\")", {"ok": True, "f": "IF(A1,\"x\")"}, "high"), ("IF(A1>0,\"ROUND(A1)\",\"POW(2)\")", {"ok": True, "f": "IF(A1>0,\"ROUND(A1)\",\"POW(2)\")"}, "high"),
    ("ROUND(A1,)", {"ok": True}, "medium"), ("IF(A1,,0)", {"ok": True, "f": "IF(A1,,0)"}, "medium"), ("SUM()", {"ok": False}, "medium"),
    ("AVERAGE()", {"ok": False}, "medium"), ("MAX()", {"ok": False}, "medium"), ("ROW()", {"ok": True, "f": "ROW()"}, "high"), ("COLUMN()", {"ok": True, "f": "COLUMN()"}, "high"),
    ("TODAY()-A1", {"ok": True, "f": "TODAY()-A1"}, "high"), ("PI()*2", {"ok": True, "f": "PI()*2"}, "high"), ("NA()", {"ok": True, "f": "NA()"}, "high"),
    ("RAND()", {"ok": True, "f": "RAND()"}, "high"), ("NOW()", {"ok": True, "f": "NOW()"}, "high"),
    ("LEN(A2:A9)", {"ok": True, "array": True}, "medium"), ("A2:A9", {"ok": True, "array": True}, "medium"),
    ("COUNTIF(A2:A9,\"x\")", {"ok": True, "array": False}, "medium"), ("VLOOKUP(E2,A2:C9,3,FALSE)", {"ok": True, "array": False}, "medium"),
    ("INDEX(B2:B9,MATCH(E2,A2:A9,0))", {"ok": True, "array": False}, "medium"), ("SUMIF(A2:A9,D1,B2:B9)", {"ok": True, "array": False}, "medium"),
    ("ROUND(SUM(B2:B9),2)", {"ok": True, "array": False}, "medium"), ("MATCH(MAX(B2:B9),B2:B9,0)", {"ok": True, "array": False}, "medium"),
    ("IFERROR(VLOOKUP(E2,A2:C9,3,FALSE),\"\")", {"ok": True, "array": False}, "medium"), ("TEXT(TODAY(),\"yyyy\")", {"ok": True, "array": False}, "medium"),
    ("SUM(A:A)", {"ok": True, "array": False}, "medium"), ("COUNTIFS(A2:A9,\"x\",B2:B9,\">\"&D1)", {"ok": True, "array": False}, "medium"),
    ("ISBLANK(A1)", {"ok": True, "array": False}, "medium"), ("LEN(A1)", {"ok": True, "array": False}, "medium"),
    ("@A2:A9*2", {"ok": True, "array": False, "f": "A2:A9*2"}, "medium"), ("SUM(@A2:A9*B2:B9)", {"ok": True, "array": True, "f": "SUM(_xlfn.SINGLE(A2:A9)*B2:B9)"}, "medium"),
    ("LEN(\"" + "x" * 255 + "\")", {"ok": True}, "medium"), ("LEN(\"" + "x" * 256 + "\")", {"ok": False}, "medium"),
    ("SUM(" + "+".join(["A1"] * 2600) + ")", {"ok": True}, "medium"), ("SUM(" + "+".join(["A1"] * 2800) + ")", {"ok": False}, "medium"),
    ("MID(\"abcd\",2)", {"ok": False}, "medium"), ("ROUND()", {"ok": False}, "low"), ("LEN()", {"ok": False}, "low"), ("IF()", {"ok": False}, "low"),
    ("SUBSTITUTE(\"aba\",\"a\")", {"ok": False}, "low"), ("DATE(2026,1)", {"ok": False}, "low"),
]
GR_EXCEL_ONLY = {"MID(\"abcd\",2)", "ROUND()", "LEN()", "IF()", "SUBSTITUTE(\"aba\",\"a\")", "DATE(2026,1)"}
for i, (f, want, harm) in enumerate(GR):
    w = f if len(f) < 70 else f[:40] + "... (%d characters)" % len(f)
    add("write-grammar-%02d" % (i + 1), "grammar", "4 the writer: a formula as Excel's grammar takes it", "Save .xlsx writes %s" % w, {"f": f}, want,
        excel_only=f in GR_EXCEL_ONLY, harm=harm,
        why_bad="Excel cannot read the formula as written (it asks to repair the file and drops it)" if want.get("ok") is False else "the formula in the file is not what Excel needs here")
gq = "LEN(\"" + "x" * 253 + "\"\"" + "\")"   # 253 x's and one doubled quote: a text of 254 characters
add("write-grammar-quote", "grammar", "4 the writer: a formula as Excel's grammar takes it", "a 254-character text with a doubled quote in it is not refused", {"f": gq}, {"ok": True}, excel_only=True, harm="low")

# saved sheets, opened in LibreOffice (worked out again) and read with openpyxl and the schema
def sv_case(cid, cells, checks, what, harm="medium", excel_only=False, why_bad=""):
    add(cid, "save", "4 the writer: what Excel finds in the file", what, {"cells": cells}, {"cells": checks}, excel_only=excel_only, harm=harm,
        why_bad=why_bad or "the saved file does not give Excel's answer")
NAMES8 = {"A1": "Name", "A2": "North", "A3": "South", "A4": "North", "A5": "East", "A6": "West", "A7": "North", "A8": "South", "A9": "East",
          "B2": "5", "B3": "3", "B4": "2", "B5": "7", "B6": "1", "B7": "4", "B8": "6", "B9": "8", "C1": "2.5", "E2": "West"}
sv_case("save-len-array", dict(NAMES8, D1="=SUM(LEN(A2:A9))"), {"D1": {"value": 37, "array": True}}, "=SUM(LEN(A2:A9)) is saved as an array formula; Excel: 37")
sv_case("save-round1", dict(NAMES8, D1="=ROUND(C1)"), {"D1": {"value": 3, "has": ["ROUND(C1,0)"]}}, "=ROUND(C1) (C1 2.5): ROUND(C1,0) in the file, 3 in Excel")
sv_case("save-floor1", dict(NAMES8, D1="=FLOOR(C1)"), {"D1": {"value": 2, "has": ["FLOOR(C1,1)"]}}, "=FLOOR(C1): FLOOR(C1,1), 2")
sv_case("save-pow", dict(NAMES8, D1="=POW(2,10)"), {"D1": {"value": 1024, "has": ["POWER(2,10)"]}}, "=POW(2,10): POWER, 1024")
sv_case("save-ceil", dict(NAMES8, D1="=CEIL(2.1)"), {"D1": {"value": 3, "has": ["CEILING(2.1,1)"]}}, "=CEIL(2.1): CEILING(2.1,1), 3")
sv_case("save-if1", dict(NAMES8, D1="=IF(B2>4)"), {"D1": {"value": 1, "has": ["IF(B2>4,1,0)"]}}, "=IF(B2>4): IF(B2>4,1,0); Excel 1 (Lantern's 1 for TRUE)")
sv_case("save-sum-empty", dict(NAMES8, D1="=SUM()"), {"D1": {"text": True}}, "=SUM() is saved as its text, with a note", harm="medium")
sv_case("save-long-text", dict(NAMES8, D1="=LEN(\"" + "y" * 300 + "\")"), {"D1": {"text": True}}, "a 300-character text in a formula is saved as text, with a note")
for i, (f, want) in enumerate([("=COUNTIF(A2:A9,\"North\")", 3), ("=SUMIF(A2:A9,\"North\",B2:B9)", 11), ("=VLOOKUP(\"West\",A2:B9,2,FALSE)", 1),
                                ("=INDEX(B2:B9,MATCH(E2,A2:A9,0))", 1), ("=ROUND(SUM(B2:B9)/3,2)", 12), ("=ISBLANK(E3)", True), ("=IFERROR(VLOOKUP(\"Zed\",A2:B9,2,FALSE),\"\")", ""),
                                ("=MATCH(MAX(B2:B9),B2:B9,0)", 8), ("=LEN(A2)", 5), ("=TEXT(B2,\"0.00\")", "5.00"), ("=SUMPRODUCT((A2:A9=\"North\")*B2:B9)", 11),
                                ("=COUNTIFS(A2:A9,\"North\",B2:B9,\">3\")", 2), ("=AVERAGEIF(A2:A9,\"South\",B2:B9)", 4.5), ("=MAX(B2:B9)-MIN(B2:B9)", 7)]):
    arr = None if "SUMPRODUCT" in f else False
    sv_case("save-guard-%02d" % (i + 1), dict(NAMES8, D1=f), {"D1": {"value": want, "array": arr}}, "an ordinary formula saved: %s (no array formula; Excel's answer)" % f, harm="medium")
sv_case("save-range-alone", dict(NAMES8, D5="=A2:A9"), {"D5": {"value": "North", "array": True}}, "=A2:A9 typed in D5 (Excel 365 spills it from North): an array formula, so Excel shows North and not A5")

# ---------------------------------------------------------------------------------------------------------------
# 5. typed values, cross-sheet formulas, INDEX(range,0), TRANSPOSE, GAMMA.DIST, a click inside a merged cell
def ty_case(cid, cells, checks, what, harm="medium", excel_only=False, why_bad=""):
    add(cid, "typed", "5 typed values saved", what, {"cells": cells}, {"cells": checks}, excel_only=excel_only, harm=harm, why_bad=why_bad or "Excel keeps the typed value otherwise")
ty_case("typed-fraction", {"A1": "1 1/2"}, {"A1": {"number": 1.5, "fmt": ["# ?/?"], "shown": ["1 1/2"]}}, "typed 1 1/2: the number 1.5 shown as 1 1/2 (# ?/?)")
ty_case("typed-fraction16", {"A1": "1 1/16"}, {"A1": {"number": 1.0625, "shown": ["1 1/16"]}}, "typed 1 1/16: 1.0625 shown as 1 1/16 (Excel takes # ??/??)")
ty_case("typed-half", {"A1": "0 1/2"}, {"A1": {"number": 0.5, "shown": ["1/2"]}}, "typed 0 1/2 (the way to type a half): 0.5 shown 1/2")
ty_case("typed-fraction-sum", {"A1": "2 3/4", "A2": "=A1*4"}, {"A2": {"number": 11}}, "typed 2 3/4, and =A1*4: 11")
ty_case("typed-bracket", {"A1": "(100)"}, {"A1": {"number": -100, "shown": ["-100", "(100)"]}}, "typed (100): the number -100", excel_only=True)
ty_case("typed-bracket-money", {"A1": "($1,200.50)"}, {"A1": {"number": -1200.5, "fmt": ['"$"#,##0.00_);("$"#,##0.00)', '"$"#,##0.00_);[Red]("$"#,##0.00)', '$#,##0.00_);($#,##0.00)', '"$"#,##0.00_);\\("$"#,##0.00\\)'], "shown": ["($1,200.50)"]}},
        "typed ($1,200.50): -1200.5 in Excel's $ format with brackets, shown ($1,200.50) as typed", harm="low", excel_only=True,
        why_bad="the number is right, but the format saved with it has no brackets, so Excel shows -$1,200.50")
ty_case("typed-bracket-comma", {"A1": "(1,200)"}, {"A1": {"number": -1200, "shown": ["(1,200)", "-1,200"]}}, "typed (1,200): -1200", excel_only=True)
ty_case("typed-bracket-percent", {"A1": "(5%)"}, {"A1": {"number": -0.05, "shown": ["-5%", "(5%)"]}}, "typed (5%): -0.05, shown as a per cent",
        harm="medium", why_bad="the number is right but the format saved with it shows it as (0) in Excel and LibreOffice")
ty_case("typed-bracket-minus", {"A1": "(-100)"}, {"A1": {"text": "(-100)"}}, "typed (-100): Excel keeps it as text (a bracket and a minus together are not a number)",
        excel_only=True, harm="medium", why_bad="Lantern saves +100: the two minus signs cancel, and a typed (-100) becomes a positive number")
ty_case("typed-dots-short", {"A1": "1.2.10"}, {"A1": {"text": "1.2.10"}}, "typed 1.2.10: text (a version number, not a date)")
ty_case("typed-dots-long", {"A1": "17.11.2026"}, {"A1": {"date_or_text": serial("2026-11-17")}}, "typed 17.11.2026: Excel (English US) keeps text; Excel (German) a date 17 Nov 2026", excel_only=True, harm="low")
ty_case("typed-dots-ambiguous", {"A1": "5.3.2026"}, {"A1": {"date_or_text": serial("2026-03-05")}}, "typed 5.3.2026: dots are a day-first form (5 March 2026, as Excel in German has it), or text (Excel in English US)",
        excel_only=True, harm="medium", why_bad="Lantern saves 3 May 2026 (month first), which no Excel reads from 5.3.2026")
ty_case("typed-dots-ambiguous2", {"A1": "12.1.2026"}, {"A1": {"date_or_text": serial("2026-01-12")}}, "typed 12.1.2026: 12 January 2026 (day first), or text",
        excel_only=True, harm="medium", why_bad="Lantern saves 1 December 2026")
ty_case("typed-dots-ambiguous3", {"A1": "1.12.2026", "A2": "=MONTH(A1)"}, {"A2": {"number_or_error": 12}}, "typed 1.12.2026 and =MONTH(A1): 12 (day first), or #VALUE! where it is text",
        excel_only=True, harm="medium", why_bad="Lantern's MONTH is 1: it reads the dots month first")
ty_case("typed-dots-end", {"A1": "31.12.2026"}, {"A1": {"date_or_text": serial("2026-12-31")}}, "typed 31.12.2026: 31 Dec 2026 or text", excel_only=True, harm="low")
ty_case("typed-mixed-sum", {"A1": "1 1/2", "A2": "(100)", "A3": "($1,200.50)", "A4": "=SUM(A1:A3)"}, {"A4": {"number": -1299}}, "typed 1 1/2, (100) and ($1,200.50) then =SUM(A1:A3): -1299")

BOOK = {"Jan": {"A1": "Item", "B1": "Amt", "A2": "Rent", "B2": "1200", "A3": "Food", "B3": "450.5", "A4": "Gas", "B4": "80", "B6": "=SUM(B2:B4)"},
        "Feb": {"A1": "Item", "B1": "Amt", "A2": "Rent", "B2": "1250", "A3": "Food", "B3": "400", "B6": "=SUM(B2:B4)"},
        "Feb 26": {"B2": "1250", "B3": "400", "B6": "=SUM(B2:B4)"}}
BK = [("=INDIRECT(\"Jan!B6\")", 1730.5), ("=SUM(Jan!B:B)", 3461), ("=INDIRECT(\"'Feb 26'!B6\")", 1650), ("=SUM(INDIRECT(\"Jan!B2:B4\"))", 1730.5),
      ("=INDIRECT(\"Nope!B6\")", "#REF!"), ("=SUMIF(Jan!A:A,\"Rent\",Jan!B:B)", 1200), ("=VLOOKUP(\"Gas\",Jan!A:B,2,FALSE)", 80), ("=INDIRECT(\"jan!b6\")", 1730.5),
      ("=INDIRECT(ADDRESS(2,2,1,1,\"Jan\"))", 1200), ("=SUM(Jan:Feb!B2)", 2450), ("=SUM('Feb 26'!B:B)", 3300), ("=INDIRECT(\"Jan!B\"&2)*2", 2400),
      ("=COUNTA(Jan!A:A)", 4), ("=ADDRESS(2,2,1,1,\"Jan\")", "Jan!$B$2"), ("=ADDRESS(2,2,4,TRUE,\"Feb 26\")", "'Feb 26'!B2"), ("=SUM(INDIRECT(\"'Feb 26'!B2:B3\"))", 1650), ("=Jan!B2+Feb!B2", 2450), ("=AVERAGE(Jan!B2:B4)", 1730.5 / 3)]
for i, (f, want) in enumerate(BK):
    book = json.loads(json.dumps(BOOK)); book["Summary"] = {"A1": f}
    add("book-%02d" % (i + 1), "compute", "5 another sheet of the workbook (INDIRECT, whole columns)", f, {"book": book, "self": "Summary"}, {"values": {"A1": want}}, harm="medium",
        why_bad="Excel reaches the other sheet and gives this answer")

IX = [("=SUM(INDEX(C2:C11,0))", 45), ("=SUM(INDEX(C2:D11,0,2))", 115), ("=AVERAGE(INDEX(C2:D11,,1))", 4.5), ("=SUM(INDEX(A2:K11,0,3))", 45),
      ("=ROWS(INDEX(C2:D11,0,1))", 10), ("=SUM(INDEX(C2:D11,3,0))", 12), ("=INDEX(C2:C11,0)", 5), ("=SUM(TRANSPOSE(C2:C11))", 45),
      ("=INDEX(TRANSPOSE(C2:C4),1,2)", 3), ("=COLUMNS(TRANSPOSE(C2:C11))", 10), ("=ROWS(TRANSPOSE(A1:K1))", 11), ("=TRANSPOSE(F2:F4)", "Ann"),
      ("=GAMMA.DIST(2,3,2,FALSE)", 0.0919698602928605), ("=GAMMA.DIST(2,3,2,TRUE)", 0.0803013970713941), ("=GAMMA.DIST(1,1,1,TRUE)", 0.632120558828558),
      ("=GAMMA.DIST(0.5,0.5,1,FALSE)", 0.4839414490382867), ("=GAMMA.DIST(2,0,2,FALSE)", "#NUM!"), ("=GAMMA.DIST(-1,3,2,TRUE)", "#NUM!"),
      ("=GAMMA.DIST(0,3,2,TRUE)", 0), ("=GAMMA.DIST(3,2,1.5,TRUE)", 0.5939941502901619), ("=GAMMA.DIST(\"a\",3,2,TRUE)", "#VALUE!"),
      ("=SUM(C2:INDEX(C2:C11,3))", 10), ("=SUM(INDEX(C2:C11,2):INDEX(C2:C11,4))", 12)]
for i, (f, want) in enumerate(IX):
    cells = dict(DATA); cells["Q2"] = f
    add("newfn-%02d" % (i + 1), "compute", "5 INDEX(range,0), TRANSPOSE, GAMMA.DIST", f, {"cells": cells}, {"values": {"Q2": want}}, harm="medium",
        why_bad="Excel gives another answer")

MERGED = {"title": "Merged", "cells": {"A2": "left", "B2": "Title", "D2": "right", "B5": "below", "A1": "x", "D3": "d3"}, "merges": ["B2:C3"]}
MG = [([{"click": "B2"}, {"click": "C3"}], "B2", "a click on C3, inside the merged B2:C3 that is selected, stays on it"),
      ([{"click": "A2"}, {"click": "C3"}], "B2", "a click on C3 from A2 selects the merged cell (its top-left is B2)"),
      ([{"click": "B2"}, {"click": "B3"}], "B2", "a click on B3, inside the selected merged cell, stays on it"),
      ([{"click": "B2"}, {"key": "ArrowRight"}], "D2", "ArrowRight from the merged cell goes past it to D2"),
      ([{"click": "B2"}, {"key": "Tab"}], "D2", "Tab from the merged cell goes to D2"),
      ([{"click": "B2"}, {"type": "New title"}], "B4", "a new title typed into the merged cell and Enter: the cell below it, B4"),
      ([{"click": "B2"}, {"type": "New title", "end": "Tab"}], "D2", "a new title typed into the merged cell and Tab: D2, past it"),
      ([{"click": "A2"}, {"type": "left 2", "end": "Tab"}], "B2", "typed into A2 and Tab: the merged cell (B2)"),
      ([{"click": "B4"}, {"key": "ArrowUp"}], "B2", "ArrowUp from B4 lands on the merged cell above (B2)"),
      ([{"click": "B2"}, {"key": "ArrowDown"}], "B4", "ArrowDown from the merged cell goes to B4"),
      ([{"click": "B2"}, {"key": "ArrowLeft"}], "A2", "ArrowLeft from the merged cell goes to A2"),
      ([{"click": "D3"}, {"key": "ArrowLeft"}], "B2", "ArrowLeft from D3 lands on the merged cell (B2)"),
      ([{"click": "B2"}, {"click": "D2"}], "D2", "a click outside the merged cell moves there")]
for i, (steps, active, what) in enumerate(MG):
    add("merge-%02d" % (i + 1), "grid", "5 a click inside a selected merged cell", what, {"doc": MERGED, "steps": steps + [{"check": {}}]}, {"active": active}, harm="low",
        why_bad="Excel's selection is elsewhere")

# ---------------------------------------------------------------------------------------------------------------
# the guard's cases, and LibreOffice as the oracle for them
def main():
    oracle = os.path.join(FILES, "guard_oracle.xlsx")
    oracle_book(oracle, DATA, guard_cells)
    import lo
    with lo.Office() as o:
        got = o.cells(oracle, list(guard_cells.keys()))
        lo_read = {}
        for fn, refs in READ_LO.items():
            lo_read[fn] = o.cells(os.path.join(FILES, fn), sorted(set(refs)))
    guard = []
    for ref, f in guard_cells.items():
        if f in OVERRIDE: want, src = OVERRIDE[f]; src = "by hand: " + src
        else:
            want = lo_value(got.get(ref)); src = "LibreOffice 24.2 (Excel's answer for this ordinary function)"
            if want is None: print("NO ORACLE", ref, f, got.get(ref)); continue
        cells = dict(DATA); cells[ref] = f
        guard.append(("guard-%03d" % (len(guard) + 1), f, cells, ref, want, src))
    MISSING = {"=ISLOGICAL(TRUE)", "=TYPE(A2)"}   # a function Lantern does not have shows #NAME? openly: less harm than a wrong number
    for cid, f, cells, ref, want, src in guard:
        add(cid, "compute", "1 the guard: everyday formulas that name a range in an ordinary way", "an everyday formula gives Excel's answer: %s" % f,
            {"cells": cells}, {"values": {ref: want}}, harm="low" if f in MISSING else "high",
            why_bad="Lantern does not have this Excel function (#NAME?)" if f in MISSING else "an ordinary right formula no longer gives Excel's answer", source=src)
    # cross-check of the read cases with LibreOffice (printed only: LibreOffice is not Excel for MATCH and INDEX's lists)
    for c in CASES:
        if c["kind"] != "read": continue
        lr = lo_read.get(c["input"]["file"], {})
        for ref, e in c["expected"]["cells"].items():
            v = lo_value(lr.get(ref))
            ev = e.get("value")
            same = (v == ev) or (isinstance(v, (int, float)) and isinstance(ev, (int, float)) and abs(v - ev) < 1e-6)
            if not same: print("LO differs from the written answer:", c["id"], ref, "LibreOffice", v, "written", ev)
            if ev is None: e["value"] = v; c["expected_source"] = "LibreOffice 24.2"
    order = ["guard", "lift", "shown", "err", "read", "round", "write", "save", "typed", "book", "newfn", "merge"]
    CASES.sort(key=lambda c: order.index(c["id"].split("-")[0]))
    json.dump(CASES, open(os.path.join(HERE, "cases.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(len(CASES), "cases;", sum(1 for c in CASES if c["id"].startswith("guard")), "in the guard;", sum(1 for c in CASES if c["kind"] == "read"), "read files")

if __name__ == "__main__":
    main()
