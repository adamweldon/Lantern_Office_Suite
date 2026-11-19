# cases.py -- the second Excel review's cases: what Excel does (expected), case by case, and the judgement of each
# disagreement (JUDGE: harm and why). build.py writes them to cases.json; replay.py runs them against Lantern.
# Values are Excel's, worked out by hand from what Excel does; LibreOffice was asked about the guard sheet's
# (files/guard_lo.xlsx, replay.py --oracle) and agrees with every one it can work out.
import datetime as dt

CASES = []


def add(cid, area, kind, what, inp, exp, excel_only=False, excel_note=None, **kw):
    c = {"id": cid, "area": area, "group": GROUPS[area], "kind": kind, "what": what, "input": inp, "expected": exp, "excel_only": excel_only}
    if excel_note: c["excel_note"] = excel_note
    c.update(kw)
    CASES.append(c)
    return c


GROUPS = {1: "1 ranges and lists worked out cell by cell (and the guard of ordinary formulas)", 2: "2 per cent and minus before power",
          3: "3 formulas that use another sheet", 4: "4 array and spilling formulas saved", 5: "5 GAMMA and the new functions",
          6: "6 dates and times typed, and text that is not a date", 7: "7 reading Excel files", 8: "8 number formats",
          9: "9 merged cells on the grid", 10: "10 Excel's grammar check"}


def serial(y, m, d): return (dt.date(y, m, d) - dt.date(1899, 12, 30)).days


THIS_YEAR = dt.date.today().year

# ---------------------------------------------------------------------------------------------------------------
# The guard sheet: an order book as a small business keeps one (typed as a person types it into Sheets)
GUARD_DATA = {"A1": "Region", "B1": "Item", "C1": "Qty", "D1": "Price", "E1": "Date", "F1": "Rep", "G1": "Status"}
_rows = [("North", "Widget", "5", "2.5", "2026-01-15", "Ann", "Paid"), ("South", "Gadget", "3", "10", "2026-02-03", "Bob", "Due"),
         ("North", "Gadget", "2", "10", "2026-02-20", "Cy", "Paid"), ("East", "Widget", "7", "2.5", "2026-03-05", "Ann", "Due"),
         ("West", "Gizmo", "1", "25", "2026-03-18", "Bob", "Paid"), ("North", "Gizmo", "4", "25", "2026-04-01", "Cy", "Due"),
         ("South", "Widget", "6", "2.5", "2026-04-22", "Ann", "Paid"), ("East", "Gadget", "8", "10", "2026-05-10", "Dee", "Paid")]
for _i, _r in enumerate(_rows):
    for _c, _v in zip("ABCDEFG", _r): GUARD_DATA["%s%d" % (_c, _i + 2)] = _v
DATA_RQ = [(r[0], int(r[2])) for r in _rows]

# (formula, Excel's value) -- ordinary, right formulas that must keep Excel's answer
GUARD = [
    ("=SUM(C2:C9)", 36), ("=SUMPRODUCT(C2:C9,D2:D9)", 300), ("=AVERAGE(D2:D9)", 10.9375), ("=MAX(C2:C9)-MIN(C2:C9)", 7),
    ('=COUNTIF(A2:A9,"North")', 3), ('=SUMIF(A2:A9,"North",C2:C9)', 11), ('=SUMIFS(C2:C9,A2:A9,"North",G2:G9,"Paid")', 7),
    ('=COUNTIFS(B2:B9,"Widget",C2:C9,">4")', 3), ('=AVERAGEIF(B2:B9,"Gadget",D2:D9)', 10), ('=VLOOKUP("Gizmo",B2:D9,3,FALSE)', 25),
    ("=INDEX(F2:F9,MATCH(MAX(C2:C9),C2:C9,0))", "Dee"), ('=IF(C2>4,"Big","Small")', "Big"), ('=IF(AND(C2>2,G2="Paid"),"ok","check")', "ok"),
    ('=IF(C3>=5,"A",IF(C3>=3,"B","C"))', "B"), ('=A2&" - "&B2', "North - Widget"), ('=F2&" owes "&TEXT(C3*D3,"$#,##0.00")', "Ann owes $30.00"),
    ("=ROUND(D2*1.0825,2)", 2.71), ("=C2/SUM($C$2:$C$9)", 5 / 36), ('=TEXT(C2/36,"0.0%")', "13.9%"), ("=E3-E2", 19),
    ("=YEAR(E2)", 2026), ("=MONTH(E5)", 3), ("=EDATE(E2,1)", serial(2026, 2, 15)), ("=EOMONTH(E2,0)", serial(2026, 1, 31)),
    ('=DATEDIF(E2,E9,"m")', 3), ("=NETWORKDAYS(E2,E3)", 14), ("=WEEKDAY(E2)", 5), ("=UPPER(B2)", "WIDGET"), ("=LEFT(A3,3)", "Sou"),
    ("=LEN(B6)", 5), ('=TRIM("  a  b ")', "a b"), ('=SUBSTITUTE(G3,"Due","Owed")', "Owed"), ("=PMT(5%/12,36,-10000)", 299.7089710466557),
    ("=FV(4%,10,-100)", 1200.6107122958608), ("=NPV(10%,100,200,300)", 481.59278737791135), ("=ABS(-3)+INT(7.9)+MOD(10,3)", 11),
    ("=ROUNDUP(2.341,1)", 2.4), ("=COUNTA(A1:G9)", 63), ("=COUNTBLANK(H1:H9)", 9), ("=MEDIAN(C2:C9)", 4.5), ("=STDEV(C2:C9)", 2.449489742783178),
    ("=LARGE(C2:C9,2)", 7), ("=RANK(C2,C2:C9)", 4), ('=IFERROR(VLOOKUP("Thing",B2:D9,3,FALSE),"none")', "none"), ("=SUM(C2:C9)*1.1", 39.6),
    ("=C2*D2", 12.5), ("=D2*(1+8.25%)", 2.70625), ("=(C2+C3)/2", 4), ("=MAX(0,C2-10)", 0), ('=COUNTIF(C2:C9,">="&5)', 4),
    ('=ISNUMBER(SEARCH("dg",B3))', True), ('=XLOOKUP("Gizmo",B2:B9,D2:D9)', 25), ("=DATE(2026,12,25)-DATE(2026,11,19)", 36),
    ('=TEXT(E2,"mmm d, yyyy")', "Jan 15, 2026"), ('=TEXT(1234.5,"#,##0.00")', "1,234.50"), ('=PROPER("ann lee")', "Ann Lee"),
    ("=ROUND(1/3,4)", 0.3333), ("=SUM(C2:C9)/COUNT(C2:C9)", 4.5), ("=SUMPRODUCT(C2:C9,D2:D9)/SUM(C2:C9)", 300 / 36),
    ('=HLOOKUP("Qty",A1:G9,3,FALSE)', 3), ('=COUNTIF(G2:G9,"<>Paid")', 3), ('=SUMIF(E2:E9,">="&DATE(2026,3,1),C2:C9)', 26),
    ('=IF(ISBLANK(H2),"empty","full")', "empty"), ('=IF(H2="","-",H2)', "-"), ('=CHOOSE(2,"a","b","c")', "b"), ("=INDEX(A2:G9,3,2)", "Gadget"),
    ('=MATCH("East",A2:A9,0)', 4), ('=AVERAGEIFS(C2:C9,A2:A9,"North",C2:C9,">2")', 4.5), ('=MAXIFS(C2:C9,A2:A9,"South")', 6),
    ('=MINIFS(D2:D9,B2:B9,"Gadget")', 10), ('=TEXTJOIN(", ",TRUE,F2:F4)', "Ann, Bob, Cy"), ('=CONCAT(A2,"/",B2)', "North/Widget"),
    ('=VALUE("12.5")*2', 25), ("=MID(B3,2,3)", "adg"), ('=FIND("g",B3)', 4), ("=RIGHT(B2,3)", "get"), ('=REPT("*",3)', "***"),
    ("=DAYS(E9,E2)", 115), ("=DAY(E9)", 10), ("=WORKDAY(E2,10)", serial(2026, 1, 29)), ('=IFS(C2>6,"high",C2>3,"mid",TRUE,"low")', "mid"),
    ('=SWITCH(A2,"North","N","South","S","?")', "N"), ("=ROUND(SUMPRODUCT(C2:C9,D2:D9)*0.0825,2)", 24.75), ("=PERCENTILE(C2:C9,0.25)", 2.75),
    ("=QUARTILE(C2:C9,3)", 6.25), ("=SUMSQ(C2:C3)", 34), ("=PRODUCT(C2:C4)", 30), ("=INT(-2.5)", -3), ("=MOD(-7,3)", 2), ("=ROUND(-2.5,0)", -3),
    ("=SIGN(-5)", -1), ("=SQRT(16)+2^3", 12), ("=10/4", 2.5), ('="Total: "&SUM(C2:C9)', "Total: 36"), ('=EXACT(A2,"north")', False),
    ("=C2>=5", True), ("=NOT(C2>5)", True), ('=OR(A2="East",A2="North")', True), ("=COUNT(E2:E9)", 8), ("=MAX(E2:E9)", serial(2026, 5, 10)),
    ('=TEXT(MAX(E2:E9),"yyyy-mm-dd")', "2026-05-10"), ("=SUM(C2:C9)-SUM(C2:C3)", 28), ("=C2*-1", -5), ("=ROUNDDOWN(D2*3.3,1)", 8.2),
    ("=MROUND(17,5)", 15), ("=CEILING(17,5)", 20), ("=FLOOR(17,5)", 15), ('=LOWER("ABC")', "abc"), ('=LEN(TRIM(" x y "))', 3),
    ('=DATEVALUE("2026-11-17")', serial(2026, 11, 17)), ("=TIME(14,30,0)", 14.5 / 24), ("=HOUR(0.75)", 18), ('=IF(SUM(C2:C9)>30,"over","under")', "over"),
    ("=AVERAGE(C2:C9)>4", True), ('=VLOOKUP(4.5,{0,"F";5,"C";8,"A"},2,TRUE)', "F"), ('=INDEX(B2:B9,MATCH("Dee",F2:F9,0))', "Gadget"),
    ('=COUNTIF(B2:B9,"G*")', 5), ('=SUMIF(B2:B9,"*get",C2:C9)', 31), ("=SUM(C2:C4,C6:C8)", 21), ('=C2&""', "5"), ('=D2&" each"', "2.5 each"),
    ('=TEXT(D2,"0.00")', "2.50"), ("=ROUND(D3/3,2)", 3.33), ("=AVERAGE(C2:C9)*COUNT(C2:C9)", 36), ('=SUMIF(C2:C9,">"&AVERAGE(C2:C9),D2:D9)', 17.5),
    ("=COUNTIF(A2:A9,A2)", 3), ('=IF(COUNTIF(F2:F9,"Ann")>2,"often","rarely")', "often"), ("=ROUND(PMT(0.06/12,60,-25000),2)", 483.32),
    ('=EDATE("2026-01-31",1)', serial(2026, 2, 28)), ("=YEARFRAC(E2,E9)", 115 / 360), ("=WEEKNUM(E9)", 20), ("=SUM(C:C)", 36), ("=COUNTA(B:B)", 9),
    ("=AVERAGE(C2:C9,10)", 46 / 9), ("=MIN(D2:D9)", 2.5), ("=ROUND(AVERAGE(D2:D9),1)", 10.9), ('=IFERROR(C2/0,"n/a")', "n/a"), ("=C2/0", "#DIV/0!"),
    ('=VLOOKUP("Nope",B2:D9,2,FALSE)', "#N/A"), ('="a"+1', "#VALUE!"), ("=SUM(C2:C9)/0", "#DIV/0!"),
    ('=IFERROR(SQRT(C3-C2),"no root")', "no root"), ("=ISERROR(LN(0))", True), ("=IFERROR(LOG(C2-10),0)", 0), ("=ISNUMBER(SQRT(-1))", False),
    ('=IFERROR(ACOS(D3),"out of range")', "out of range"), ('=IFERROR(AVERAGEIF(A2:A9,"Nowhere",C2:C9),0)', 0), ('=IFNA(MATCH("Zed",A2:A9,0),"missing")', "missing"),
    ('=ISNA(VLOOKUP("Zed",A2:B9,2,FALSE))', True), ('=IF(ISERROR(C2/0),"err","ok")', "err"), ("=SUM(A2:A9)", 0), ("=C2+H2", 5), ('=IF(H2>0,"pos","zero")', "zero"),
    ("=AVERAGE(C2:C10)", 4.5), ("=COUNT(SQRT(-1))", 0), ("=IFERROR(SQRT(-1)*0,-1)", -1),
]
for _n, (_f, _v) in enumerate(GUARD):
    _cell = "J%d" % (_n + 1)
    _cells = dict(GUARD_DATA); _cells[_cell] = _f
    add("guard-%03d" % (_n + 1), 1, "compute", "an ordinary formula still gives Excel's answer: " + _f, {"cells": _cells}, {"values": {_cell: _v}}, guard_cell=_cell,
        lo_skip="XLOOKUP" in _f)

# (formula, Excel's value, note) -- ranges and lists worked out cell by cell (Excel 365, or Ctrl+Shift+Enter before it)
ARRAYS = [
    ('=SUMPRODUCT((A2:A9="North")*(D2:D9))', 37.5, ""), ("=SUMPRODUCT(--(C2:C9>2))", 6, ""), ("=SUM(C2:C5*D2:D5)", 80, ""),
    ("=SUM(IF(C2:C9>2,D2:D9))", 52.5, ""), ('=AVERAGE(IF(A2:A9="North",C2:C9))', 11 / 3, ""), ("=MAX(C2:C9*D2:D9)", 100, ""),
    ('=VLOOKUP(7,{0,"low";5,"mid";10,"high"},2)', "mid", ""), ('=LOOKUP(12,{0,5,10},{"low","mid","high"})', "high", ""),
    ("=IRR({-1000,300,400,500})", 0.08896339469335, ""), ("=C2:C4*2", 10, "Excel 365 spills 10, 6, 4; the cell itself shows 10"),
    ("=SUM(C2:C9>2)", 0, "a list of TRUE/FALSE is left out of SUM"), ("=SUMPRODUCT(C2:C9>2)", 0, "TRUE/FALSE count as 0 in SUMPRODUCT"),
    ("=SUMPRODUCT(LEN(B2:B9))", 46, "LEN of each cell"), ("=SUMPRODUCT(1/COUNTIF(B2:B9,B2:B9))", 3, "the count of different items"),
    ("=SUMPRODUCT((MONTH(E2:E9)=3)*C2:C9)", 8, "MONTH of each date"), ('=SUMPRODUCT(ISNUMBER(SEARCH("Wid",B2:B9))*C2:C9)', 18, "SEARCH in each cell"),
    ('=INDEX(F2:F9,MATCH(1,(A2:A9="North")*(B2:B9="Gizmo"),0))', "Cy", "a lookup on two columns"),
    ('=SUM(C2:C9*(G2:G9="Paid"))', 22, ""), ("=SUM(LEN(A2:A9))", 37, "LEN of each cell"), ('=SUMPRODUCT(--(LEFT(A2:A9,1)="N"))', 3, "LEFT of each cell"),
    ("=SUM(ROUND(D2:D9*1.1,0))", 98, "ROUND of each cell"), ("=SUM(ABS(C2:C9-5))", 16, "ABS of each cell"),
    ('=MAX(IF(B2:B9="Gadget",E2:E9))', serial(2026, 5, 10), ""), ('=SUMPRODUCT((A2:A9="North")+(A2:A9="South"),C2:C9)', 20, ""),
    ('=SUMPRODUCT(A2:A9="North",C2:C9)', 0, "TRUE/FALSE as its own argument counts as 0"), ("=COUNT(IF(C2:C9>4,C2:C9))", 4, ""),
    ("=MIN(IF(C2:C9>3,C2:C9))", 4, ""), ("=AND(C2:C9>0)", True, ""), ('=SUMPRODUCT(SUMIF(A2:A9,{"North","East"},C2:C9))', 26, "SUMIF with a list of things to look for"),
    ('=SUM(COUNTIF(A2:A9,{"North","South"}))', 5, "COUNTIF with a list of things to look for"), ('=A2:A9="North"', True, "the cell shows the first value"),
    ("=SUMPRODUCT(C2:C9,D2:D8)", "#VALUE!", "ranges of different sizes"), ("=SUM(C2*D2:D9)", 437.5, ""),
    ("=SUMPRODUCT((C2:C9>2)*(C2:C9<7))", 4, ""), ('=SUM(IF(A2:A9="North",C2:C9,"x"))', 11, ""), ('=SUM((A2:A9="North")*1)', 3, ""),
    ('=MEDIAN(IF(A2:A9="North",C2:C9))', 4, ""), ("=SUMPRODUCT((YEAR(E2:E9)=2026)*1)", 8, "YEAR of each date"),
    ("=SUM(IF(ISNUMBER(C2:C9),1,0))", 8, "ISNUMBER of each cell"), ('=TEXTJOIN(",",TRUE,IF(A2:A9="North",F2:F9,""))', "Ann,Cy,Cy", ""),
    ('=SUMPRODUCT(--(B2:B9<>"Widget"))', 5, ""), ("=MAX(LEN(B2:B9))", 6, "LEN of each cell"),
    ("=INDEX(C2:C9,MATCH(MAX(C2:C9*D2:D9),C2:C9*D2:D9,0))", 4, "MATCH in a worked-out list"),
    ("=SUM(IF(C2:C9>5,1,IF(C2:C9>2,0.5,0)))", 4.5, ""), ("=SUMPRODUCT(D2:D9*(C2:C9>=5))", 17.5, ""),
    ('=SUM(IF(G2:G9="Paid",C2:C9*D2:D9))', 152.5, ""), ("=ROWS(UNIQUE(B2:B9))", 3, ""), ("=COUNTA(UNIQUE(A2:A9))", 4, ""),
    ("=SUM(SEQUENCE(4))", 10, ""), ("=INDEX(SORT(C2:C9,1,-1),2)", 7, ""), ('=SUM(FILTER(C2:C9,A2:A9="North"))', 11, ""),
    ("=UNIQUE(A2:A9)", "North", "Excel spills; the first cell shows North"), ("=SORT(C2:C9)", 1, "Excel spills; the first cell shows 1"),
    ("=FILTER(B2:B9,C2:C9>6)", "Widget", "Excel spills; the first cell shows Widget"), ("=SEQUENCE(3,1,10,5)", 10, "Excel spills 10, 15, 20"),
    ('=SUMPRODUCT(--ISNUMBER(MATCH(A2:A9,{"North","West"},0)))', 4, "MATCH of each cell"), ("=SUM(IFERROR(1/C2:C9,0))", 2.717857142857143, ""),
    ('=SUMPRODUCT(--(TEXT(E2:E9,"mmm")="Mar"))', 2, "TEXT of each date"), ("=SUM(C2:C9*D2:D9)/SUM(C2:C9)", 300 / 36, ""),
    ("=SUMPRODUCT(C2:C9*D2:D9)", 300, ""), ("=SUM((C2:C9-AVERAGE(C2:C9))^2)", 42, ""), ('=SUMPRODUCT(C2:C9,--(A2:A9="North"))', 11, ""),
    ("=COUNT(1/(C2:C9>4))", 4, "an error in one cell of the list stays in that cell"), ('=SUM(IFERROR(C2:C9/(A2:A9="North"),0))', 11, "an error in one cell of the list stays in that cell"),
    ('=IF(C2:C9>4,"y","n")', "y", "the cell shows the first value"), ("=MAX(INDEX(C2:C9*D2:D9,0))", 100, "INDEX(list,0) is the whole list"),
    ('=SUMPRODUCT(MAX((A2:A9="North")*C2:C9))', 5, ""), ('=SUMPRODUCT((A2:A9="North")*C2:C9*D2:D9)', 132.5, ""),
]
for _n, (_f, _v, _note) in enumerate(ARRAYS):
    _cell = "K%d" % (_n + 1)
    _cells = dict(GUARD_DATA); _cells[_cell] = _f
    add("cells-%02d" % (_n + 1), 1, "compute", "worked out cell by cell: " + _f + (" (" + _note + ")" if _note else ""), {"cells": _cells},
        {"values": {_cell: _v}}, guard_cell=_cell, guard_array=True, lo_skip=any(k in _f for k in ("UNIQUE", "SORT(", "FILTER", "SEQUENCE", "XLOOKUP")))
# how the grid shows a list's first value that is TRUE (as Excel does)
_c = dict(GUARD_DATA); _c["K1"] = '=A2:A9="North"'
add("cells-shown-true", 1, "compute", "the grid shows the first value of a list of TRUE/FALSE as TRUE, as Excel does", {"cells": _c, "grid": True}, {"shown": {"K1": "TRUE"}})
_c = dict(GUARD_DATA); _c["K1"] = '=MAX(IF(B2:B9="Gadget",E2:E9))'
add("cells-shown-date", 1, "compute", "the latest date of a list shows as a date, as Excel shows it (it carries the dates' look)", {"cells": _c, "grid": True},
    {"shown_re": {"K1": r"^(2026-05-10|5/10/2026|10 May 2026)$"}}, excel_only=True, excel_note="Excel carries the date look of E2:E9 into MAX(IF(...)); not checked in Excel here")

# ---------------------------------------------------------------------------------------------------------------
# 2. per cent and minus before power (in a sheet); the Calculator keeps the order on paper
PREC = [("=50%^2", 0.25), ("=2^300%", 8), ("=-2^2", 4), ("=-B1^2", 9), ("=0-2^2", -4), ("=-2^-2", 0.25), ("=2^3^2", 64), ("=-(2^2)", -4),
        ("=5%%", 0.0005), ("=-50%^2", 0.25), ("=2^-50%", 0.7071067811865476), ("=3*-2^2", 12), ("=10-B1^2", 1), ("=-SQRT(4)^2", 4),
        ("=B1%^2", 0.0009), ("=1+2*3^2", 19), ("=2^1/2", 1), ("=(1+B1)^2%", 1.0281138266560665), ("=--2^2", 4), ("=-B1^0.5", "#NUM!"),
        ("=200*5%", 10), ("=B1^2*-1", -9), ("=2*-B1^2", 18), ("=-B1%", -0.03), ("=50%*50%", 0.25), ("=1/2%", 50),
        ("=2^-1^2", 0.25), ("=-2^0.5", "#NUM!"), ("=100*-5%", -5), ("=+-2^2", 4), ('="a"&1+2', "a3"), ('=1+2&"x"', "3x"), ('="x"&-2^2', "x4"),
        ("=1+1=2", True), ("=5%>4%", True), ("=-B1^2=9", True)]
for _n, (_f, _v) in enumerate(PREC):
    add("order-%02d" % (_n + 1), 2, "compute", "Excel's order of signs: " + _f + " (B1 holds 3)", {"cells": {"B1": "3", "C1": _f}}, {"values": {"C1": _v}})
for _n, (_src, _v) in enumerate([("-2^2", -4), ("2^3^2", 512), ("200*5%", 10), ("50%", 0.5), ("-3^2+1", -8)]):
    add("calc-%02d" % (_n + 1), 2, "calc", "the Calculator keeps the order on paper: " + _src, {"src": _src}, {"value": _v})

# ---------------------------------------------------------------------------------------------------------------
# 3. formulas that use another sheet of the same workbook
ITEMS = ["Paper", "Pens", "Ink", "Tape"]


def month_sheet(nums):
    c = {"A1": "Item", "B1": "Amount", "A6": "Total", "B6": "=SUM(B2:B5)"}
    for i, (it, n) in enumerate(zip(ITEMS, nums)): c["A%d" % (i + 2)] = it; c["B%d" % (i + 2)] = str(n)
    return c


BOOK = {"Jan": month_sheet([10, 20, 30, 40]), "Feb": month_sheet([1, 2, 3, 4]), "Mar": month_sheet([100, 200, 300, 400]),
        "Bob's rates": {"A1": "Rate", "B1": "0.08", "A2": "Fee", "B2": "=B1*100"}, "Q1 2026": {"A1": "=Jan!B6+Feb!B6+Mar!B6"},
        "2026": {"A1": "42"}, "R&D": {"A1": "Hours", "B1": "7"}, "A1": {"B2": "9"}, "Caf\u00e9": {"A1": "3"}}
SUMMARY = [("Jan total", "=Jan!B6", 100), ("Rate", "='Bob''s rates'!B1", 0.08), ("First items", "=SUM(Jan:Mar!B2)", 111),
           ("Tax on Jan", "=SUM(Jan!B2:B5)*'Bob''s rates'!B1", 8), ("Pens in Jan", '=VLOOKUP("Pens",Jan!A2:B5,2,FALSE)', 20),
           ("Quarter", "='Q1 2026'!A1", 1110), ("Average", "=AVERAGE(Jan:Mar!B2:B3)", 55.5), ("Over 15", '=COUNTIF(Jan!B2:B5,">15")', 3),
           ("Jan x Feb", "=SUMPRODUCT(Jan!B2:B5,Feb!B2:B5)", 300), ("Glue", '=IFERROR(VLOOKUP("Glue",Jan!A2:B5,2,FALSE),"none")', "none"),
           ("Words", '=Jan!A3&" and "&Feb!A4', "Pens and Ink"), ("All totals", "=SUM(Jan:Mar!B6)", 1110), ("R and D", "='R&D'!B1*2", 14)]
SHEETREFS = [(f, v) for _, f, v in SUMMARY] + [("=jan!B6", 100), ("=Missing!A1", "#REF!"), ('=IFERROR(Missing!A1,"no sheet")', "no sheet"),
             ("='Bob''s rates'!B2", 8), ("=SUM(Jan:Feb!B6)", 110), ("=Summary!Z1*2", 10), ("=Feb!B9", 0), ("='2026'!A1+1", 43),
             ("=Jan!B2:B5*2", 20), ("='A1'!B2+1", 10), ("=SUM('Jan:Mar'!B2)", 111), ("='Summary'!Z1", 5), ("=COUNTA(Jan:Mar!A2:A5)", 12), ("=Caf\u00e9!A1*2", 6), ('=INDIRECT("Jan!B6")', 100), ("=SUM(Jan!B:B)", 200),
             ("=Jan!$B$6+Feb!B$6", 110), ("=SUM(Jan:Mar!B2:B5)", 1110), ('=SUMIF(Jan!A2:A5,"P*",Jan!B2:B5)', 30)]
for _n, (_f, _v) in enumerate(SHEETREFS):
    add("sheets-%02d" % (_n + 1), 3, "compute", "worked out from the workbook's other sheets: " + _f, {"cells": {"Z1": "5", "B1": _f}, "book": BOOK, "self": "Summary"},
        {"values": {"B1": _v}})

add("sheets-read", 3, "read", "a workbook of seven sheets that use each other reads with Excel's values and no difference noted",
    {"file": "multi_sheet.xlsx"}, {"sheet_names": ["Jan", "Feb", "Mar", "Bob's rates", "Q1 2026", "R&D", "Summary"],
                                    "values": {"Summary!B%d" % (i + 1): v for i, (_, _, v) in enumerate(SUMMARY)}, "notes_not": [r"differently"]})
add("sheets-save-ui", 3, "import", "Import file then Save .xlsx from Summary: all seven sheets saved together, under their names, and Excel's values come back",
    {"file": "multi_sheet.xlsx", "steps": [{"open": "Summary"}, {"save": True}]},
    {"file_sheets": ["Jan", "Feb", "Mar", "Bob's rates", "Q1 2026", "R&D", "Summary"], "lo": {"Summary!B%d" % (i + 1): v for i, (_, _, v) in enumerate(SUMMARY)},
     "xml": [{"sheet": "Summary", "cell": "B2", "f": "'Bob''s rates'!B1"}, {"sheet": "Summary", "cell": "B3", "f": "SUM(Jan:Mar!B2)"}, {"sheet": "Summary", "cell": "B13", "f": "'R&D'!B1*2"}]})
add("sheets-edit-ui", 3, "import", "an amount changed on Jan shows at once in Summary, and is in the file Save .xlsx makes",
    {"file": "multi_sheet.xlsx", "steps": [{"open": "Jan"}, {"type": "50", "at": "B2"}, {"open": "Summary"}, {"check": ["B1", "B3"]}, {"save": True}]},
    {"shown": {"B1": "140", "B3": "151"}, "lo": {"Summary!B1": 140, "Summary!B3": 151, "Jan!B2": 50}})
add("sheets-missing-save", 3, "save", "a sheet not from a workbook, with =Other!A1: saved as its value (#REF!), with a note",
    {"sheet": {"title": "Budget", "cells": {"A1": "5", "B1": "=Other!A1", "B2": "=A1*2"}}},
    {"xml": [{"cell": "B1", "no_f": True}, {"cell": "B2", "f": "A1*2"}], "notes_has": [r"Other"], "lo": {"B2": 10}})

# ---------------------------------------------------------------------------------------------------------------
# 4. array and spilling formulas, saved
for _n, (_f, _v, _arr) in enumerate([("=SUM(C2:C5*D2:D5)", 80, True), ("=SUM(IF(C2:C9>2,D2:D9))", 52.5, True), ('=AVERAGE(IF(A2:A9="North",C2:C9))', 11 / 3, True),
                                    ('=INDEX(F2:F9,MATCH(1,(A2:A9="North")*(B2:B9="Gizmo"),0))', "Cy", True), ("=SUMPRODUCT(LEN(B2:B9))", 46, False),
                                    ("=MAX(C2:C9*D2:D9)", 100, True), ('=SUM(COUNTIF(A2:A9,{"North","South"}))', 5, False)]):
    _cells = dict(GUARD_DATA); _cells["K1"] = _f
    add("arrays-save-%02d" % (_n + 1), 4, "save", "saved as an array formula that Excel works out cell by cell, with the right value saved beside it: " + _f,
        {"sheet": {"title": "Orders", "cells": _cells}}, {"xml": [{"cell": "K1", "attrs": {"t": "array"}}] if _arr else [{"cell": "K1"}], "lo": {"K1": _v}, "cached": {"K1": _v}})
for _n, (_f, _v) in enumerate([("=SUM(LEN(A2:A9))", 37), ("=MAX(LEN(B2:B9))", 6), ("=SUM(--ISNUMBER(C2:C9))", 8), ("=C2:C4", 5)]):
    _cells = dict(GUARD_DATA); _cells["K1"] = _f
    add("arrays-save-more-%02d" % (_n + 1), 4, "save", "saved so that Excel works it out as Lantern means it (cell by cell, or its first value): " + _f,
        {"sheet": {"title": "Orders", "cells": _cells}}, {"lo": {"K1": _v}},
        excel_note="a plain formula (no t=array) is read by Excel 2019, and by Excel 365 as =@..., with the range cut to the formula's own row")
for _n, (_f, _xf, _v) in enumerate([("=UNIQUE(A2:A9)", "_xlfn.UNIQUE(A2:A9)", "North"), ("=SORT(C2:C9)", "_xlfn._xlws.SORT(C2:C9)", 1),
                                    ("=FILTER(B2:B9,C2:C9>6)", "_xlfn._xlws.FILTER(B2:B9,C2:C9>6)", "Widget"), ("=SEQUENCE(3)", "_xlfn.SEQUENCE(3)", 1),
                                    ("=COUNTA(UNIQUE(A2:A9))", "COUNTA(_xlfn.UNIQUE(A2:A9))", 4)]):
    _cells = dict(GUARD_DATA); _cells["K1"] = _f
    add("spill-save-%02d" % (_n + 1), 4, "save", "an Excel 365 spilling formula saved as Excel 365 writes it (cm=1, xl/metadata.xml): " + _f,
        {"sheet": {"title": "Orders", "cells": _cells}}, {"xml": [{"cell": "K1", "f": _xf, "attrs": {"t": "array", "cm": "1"}}], "parts": ["xl/metadata.xml"], "cached": {"K1": _v}},
        excel_only=True, excel_note="LibreOffice 24.2 has no UNIQUE, SORT, FILTER or SEQUENCE; the file's form is checked against XlsxWriter's and the schema")
add("spill-shown", 4, "compute", "=SORT(C2:C9) in a cell: Excel shows the whole sorted list down the column; Lantern shows only its first value",
    {"cells": dict(GUARD_DATA, K1="=SORT(C2:C9)", L1="=K2"), "grid": True}, {"values": {"K1": 1, "L1": 2}},
    excel_note="Excel 365 spills 1,2,3,...,8 into K1:K8, so =K2 is 2")
add("arrays-read", 4, "read", "Ctrl+Shift+Enter array formulas from Excel: each kept in its first cell, worked out, and remembered as array formulas",
    {"file": "array_legacy.xlsx"}, {"raw": {"D2": "=B2:B5*C2:C5", "E2": "=SUM(B2:B5*C2:C5)", "G2": "=MAX(IF(B2:B5>2,C2:C5))"},
                                    "values": {"D2": 20, "E2": 400, "G2": 40, "F2": "Item"}, "arrays": {"D2": "D2:D5", "E2": "E2", "F2": "F2:F4"}, "notes_not": [r"differently"]})
add("arrays-roundtrip", 4, "import", "Import then Save .xlsx: the array formulas are array formulas again, over the same cells, with Excel's values",
    {"file": "array_legacy.xlsx", "steps": [{"save": True}]},
    {"xml": [{"cell": "D2", "f": "B2:B5*C2:C5", "attrs": {"t": "array", "ref": "D2:D5"}}, {"cell": "E2", "attrs": {"t": "array", "ref": "E2"}},
             {"cell": "F2", "attrs": {"t": "array", "ref": "F2:F4"}}, {"cell": "G2", "attrs": {"t": "array"}}],
     "lo": {"D2": 20, "D3": 60, "D4": 120, "D5": 200, "E2": 400, "F2": "Item", "F4": "Price", "G2": 40}})
add("arrays-edit", 4, "import", "a multi-cell array formula from Excel: after a quantity changes, the other cells of the array follow it (as in Excel)",
    {"file": "array_legacy.xlsx", "steps": [{"type": "10", "at": "B3"}, {"check": ["D3", "E2"]}]},
    {"shown": {"D3": "200", "E2": "540"}}, excel_note="Excel works the whole array D2:D5 out again: D3 = 10 x 20")
add("spill-read", 4, "read", "Excel 365's spilling formulas read: the first value worked out, the spilled values kept, nothing noted as different",
    {"file": "dynamic365.xlsx"}, {"values": {"E2": "North", "E3": "South", "F2": 1, "G2": "East", "H2": 1, "I2": 4, "J2": 36},
                                  "raw": {"E2": "=UNIQUE(A2:A9)", "G2": "=FILTER(A2:A9,C2:C9>5)", "I2": "=COUNTA(UNIQUE(A2:A9))"}, "notes_not": [r"differently"]})
add("spill-roundtrip", 4, "import", "Import then Save .xlsx: Excel 365's spilling formulas written back with cm=1 over their spill ranges, and metadata.xml",
    {"file": "dynamic365.xlsx", "steps": [{"save": True}]},
    {"xml": [{"cell": "E2", "f": "_xlfn.UNIQUE(A2:A9)", "attrs": {"t": "array", "ref": "E2:E5", "cm": "1"}},
             {"cell": "F2", "f": "_xlfn._xlws.SORT(C2:C9)", "attrs": {"cm": "1"}}, {"cell": "G2", "f": "_xlfn._xlws.FILTER(A2:A9,C2:C9>5)", "attrs": {"cm": "1"}},
             {"cell": "H2", "f": "_xlfn.SEQUENCE(3)", "attrs": {"cm": "1"}}, {"cell": "I2", "f": "COUNTA(_xlfn.UNIQUE(A2:A9))", "attrs": {"cm": "1"}},
             {"cell": "J2", "f": "SUM(C2:C9)", "attrs_not": ["cm", "t"]}], "parts": ["xl/metadata.xml"], "lo": {"J2": 36}})

# ---------------------------------------------------------------------------------------------------------------
# 5. GAMMA (Excel's: the gamma function; Lantern's: the Lorentz factor) and the new functions
GAMMA_FILE = [("=GAMMA(5)", 24), ("=GAMMA(0.5)", 1.7724538509055159), ("=GAMMALN(10)", 12.801827480081467), ("=GAMMALN.PRECISE(0.5)", 0.5723649429247004),
              ("=BASE(255,2,10)", "0011111111"), ('=DECIMAL("zap",36)', 45745), ("=ERROR.TYPE(#N/A)", 7), ("=GAMMA.DIST(2,3,2,FALSE)", 0.09196986029286058),
              ("=GAMMA(5)+GAMMALN(1)", 24)]
add("gamma-read", 5, "read", "Excel's GAMMA read as GAMMAFN, and GAMMA.DIST, GAMMALN and GAMMALN.PRECISE left as they are",
    {"file": "gamma.xlsx"}, {"raw": {"B1": "=GAMMAFN(5)", "B2": "=GAMMAFN(0.5)", "B4": "=GAMMALN.PRECISE(0.5)", "B8": "=GAMMA.DIST(2,3,2,FALSE)", "B9": "=GAMMAFN(5)+GAMMALN(1)"},
                             "notes_has": [r"GAMMAFN"]})
for _n, (_f, _v) in enumerate(GAMMA_FILE):
    add("gamma-value-%d" % (_n + 1), 5, "read", "Excel's " + _f + " worked out as Excel works it out", {"file": "gamma.xlsx"}, {"values": {"B%d" % (_n + 1): _v}})
add("gamma-roundtrip", 5, "import", "Import then Save .xlsx: GAMMAFN back to _xlfn.GAMMA, the new functions with _xlfn., and Excel's values",
    {"file": "gamma.xlsx", "steps": [{"save": True}]},
    {"xml": [{"cell": "B1", "f": "_xlfn.GAMMA(5)"}, {"cell": "B4", "f": "_xlfn.GAMMALN.PRECISE(0.5)"}, {"cell": "B5", "f": "_xlfn.BASE(255,2,10)"},
             {"cell": "B6", "f": '_xlfn.DECIMAL("zap",36)'}, {"cell": "B8", "f": "_xlfn.GAMMA.DIST(2,3,2,FALSE)"}, {"cell": "B9", "f": "_xlfn.GAMMA(5)+GAMMALN(1)"}],
     "lo": {"B1": 24, "B2": 1.7724538509055159, "B3": 12.801827480081467, "B5": "0011111111", "B6": 45745, "B7": 7, "B9": 24}})
add("gamma-typed", 5, "compute", "=GAMMA(0.5) typed in a sheet: Excel's answer is 1.7724538509 (the gamma function)",
    {"cells": {"A1": "=GAMMA(0.5)"}}, {"values": {"A1": 1.7724538509055159}})
add("gamma-typed-save", 5, "save", "=GAMMA(0.5) typed in a sheet is saved as its value, with a note (Lantern's GAMMA is not Excel's)",
    {"sheet": {"title": "g", "cells": {"A1": "=GAMMA(0.5)", "A2": "=GAMMA(5)+1"}}}, {"xml": [{"cell": "A1", "no_f": True}, {"cell": "A2", "no_f": True}], "notes_has": [r"GAMMA"]})
add("gammafn-save", 5, "save", "=GAMMAFN(5) typed in a sheet is saved as Excel's _xlfn.GAMMA(5)",
    {"sheet": {"title": "g", "cells": {"A1": "=GAMMAFN(5)", "A2": "=GAMMALN.PRECISE(4)", "A3": "=BASE(10,2)", "A4": '=DECIMAL("ff",16)', "A5": "=ERROR.TYPE(1/0)"}}},
    {"xml": [{"cell": "A1", "f": "_xlfn.GAMMA(5)"}, {"cell": "A2", "f": "_xlfn.GAMMALN.PRECISE(4)"}, {"cell": "A3", "f": "_xlfn.BASE(10,2)"},
             {"cell": "A4", "f": '_xlfn.DECIMAL("ff",16)'}, {"cell": "A5", "f": "ERROR.TYPE(1/0)"}], "lo": {"A1": 24, "A2": 1.791759469228055, "A3": "1010", "A4": 255, "A5": 2}})
NEWFN = [("=BASE(7,2)", "111"), ('=DECIMAL("FF",16)', 255), ("=ERROR.TYPE(#VALUE!)", 3), ("=ERROR.TYPE(#REF!)", 4), ("=ERROR.TYPE(#NAME?)", 5),
         ("=ERROR.TYPE(SQRT(-1))", 6), ("=ERROR.TYPE(#NULL!)", 1), ("=ERROR.TYPE(5)", "#N/A"), ("=ERROR.TYPE(1/0)", 2), ("=ERROR.TYPE(Z9)", 2),
         ("=GAMMAFN(-0.5)", -3.544907701811032), ("=GAMMAFN(0)", "#NUM!"), ("=GAMMALN(0)", "#NUM!"), ("=GAMMALN(-1)", "#NUM!"),
         ("=BASE(-1,2)", "#NUM!"), ("=BASE(10,1)", "#NUM!"), ('=DECIMAL("12",2)', "#NUM!"), ("=BASE(15,16,4)", "000F"),
         ("=IFERROR(ERROR.TYPE(Z8),0)", 0), ("=GAMMALN.PRECISE(10)", 12.801827480081467), ('=BASE(DECIMAL("777",8),10)', "511")]
for _n, (_f, _v) in enumerate(NEWFN):
    add("newfn-%02d" % (_n + 1), 5, "compute", "the new functions as Excel has them: " + _f + " (Z9 holds =1/0, Z8 holds 5)", {"cells": {"Z9": "=1/0", "Z8": "5", "A1": _f}}, {"values": {"A1": _v}})

# ---------------------------------------------------------------------------------------------------------------
# 6. dates and times typed in Sheets, saved as Excel keeps them; text that is not a date
TYPED = [("2026-11-17", serial(2026, 11, 17), "2026-11-17"), ("11/17/2026", serial(2026, 11, 17), "11/17/2026"), ("17 Nov 2026", serial(2026, 11, 17), "17 Nov 2026"),
         ("Nov 17, 2026", serial(2026, 11, 17), "Nov 17, 2026"), ("3:30 PM", 15.5 / 24, "3:30 PM"), ("14:30", 14.5 / 24, "14:30"), ("40:00", 40 / 24, "40:00"),
         ("November 17, 2026", serial(2026, 11, 17), "November 17, 2026"), ("17-Nov-2026", serial(2026, 11, 17), "17-Nov-2026"), ("Nov 2026", serial(2026, 11, 1), "Nov 2026"),
         ("11/17/26", serial(2026, 11, 17), "11/17/26"), ("2026-11-17 14:30", serial(2026, 11, 17) + 14.5 / 24, "2026-11-17 14:30"), ("9:05", 9 / 24 + 5 / 1440, "9:05"),
         ("1/5/2026", serial(2026, 1, 5), "1/5/2026"), ("$1,200.50", 1200.5, "$1,200.50"), ("12%", 0.12, "12%"), ("1,500", 1500, "1,500"), ("TRUE", True, "TRUE"),
         ("8:30:15", (8 * 3600 + 30 * 60 + 15) / 86400, "8:30:15"), ("11/17/2026 3:30 PM", serial(2026, 11, 17) + 15.5 / 24, "11/17/2026 3:30 PM"),
         ("29 Feb 2028", serial(2028, 2, 29), "29 Feb 2028"), ("2026-02-30", "2026-02-30", "2026-02-30"), ("1-Jan", serial(THIS_YEAR, 1, 1), "1-Jan")]
for _n, (_t, _v, _s) in enumerate(TYPED):
    add("typed-%02d" % (_n + 1), 6, "save", "typed %r: saved as Excel keeps it when typed, and shows as typed" % _t,
        {"sheet": {"title": "t", "cells": {"A1": _t}}}, {"lo": {"A1": _v}, "lo_shown": {"A1": _s}})
DATEF = [("=B1+30", serial(2026, 12, 17), r"^(2026-12-17|12/17/2026)$"), ("=EDATE(B1,1)", serial(2026, 12, 17), r"^(2026-12-17|12/17/2026)$"),
         ("=DATE(2026,12,25)", serial(2026, 12, 25), r"^(2026-12-25|12/25/2026)$"), ("=TIME(14,30,0)", 14.5 / 24, r"^(14:30|2:30 PM)(:00)?$"),
         ("=TODAY()", None, r"^\d{4}-\d\d-\d\d$|^\d{1,2}/\d{1,2}/\d{4}$"), ("=NOW()", None, r"\d{1,2}:\d\d"), ("=MAX(B1:B3)", serial(2026, 12, 25), r"^(2026-12-25|12/25/2026)$"),
         ("=B4-B5", 8.5 / 24, r"^0?8:30(:00)?$"), ("=WORKDAY(B1,5)", serial(2026, 11, 24), r"^(2026-11-24|11/24/2026)$"), ("=EOMONTH(B1,0)", serial(2026, 11, 30), r"^(2026-11-30|11/30/2026)$")]
for _n, (_f, _v, _re) in enumerate(DATEF):
    exp = {"lo_shown_re": {"C1": _re}}
    if _v is not None: exp["lo"] = {"C1": _v}
    add("datef-%02d" % (_n + 1), 6, "save", "a formula Lantern shows as a date or time is saved with a date or time look: " + _f,
        {"sheet": {"title": "t", "cells": {"B1": "2026-11-17", "B2": "2026-12-25", "B3": "2026-12-01", "B4": "17:30", "B5": "9:00", "C1": _f}}}, exp)
add("datef-sumtimes", 6, "save", "two times typed (16:00 and 10:00) added: Excel carries the first cell's h:mm, so it shows 2:00",
    {"sheet": {"title": "t", "cells": {"A1": "16:00", "A2": "10:00", "A3": "=SUM(A1:A2)"}}}, {"lo": {"A3": 26 / 24}, "lo_shown_re": {"A3": r"^0?2:00$"}},
    excel_only=True, excel_note="Excel gives a typed 16:00 the look h:mm and SUM carries it: 26 hours show as 2:00 (a duration needs [h]:mm)")
NOTDATE = [("1.2.3", "text"), ("1.2.10", "text"), ("2.10.25", "text"), ("555-1234", "text"), ("918-555-1234", "text"), ("(918) 555-1234", "text"),
           ("12-34-56", "text"), ("A-102", "text"), ("Q1-2026", "text"), ("17.11.2026", "text"), ("17/11/2026", "text"), ("March 5th", "text"),
           ("007", 7), ("2026", 2026), ("1 1/2", 1.5), ("(100)", -100), ("1e3", 1000)]
for _n, (_t, _want) in enumerate(NOTDATE):
    exp = {"lo_kind": {"A1": "TEXT"}, "lo": {"A1": _t}} if _want == "text" else {"lo_kind": {"A1": "VALUE"}, "lo": {"A1": _want}}
    add("notdate-%02d" % (_n + 1), 6, "save", "typed %r: Excel (English, US) keeps it as %s" % (_t, "text" if _want == "text" else "the number %s" % _want),
        {"sheet": {"title": "t", "cells": {"A1": _t}}}, exp)
add("notdate-excel-dates", 6, "save", "typed 1/2, 3-1, 5/2026 and 1:2: Excel turns each into a date or a time (2-Jan, 1-Mar, May-26, 1:02)",
    {"sheet": {"title": "t", "cells": {"A1": "1/2", "A2": "3-1", "A3": "5/2026", "A4": "1:2"}}},
    {"lo_kind": {"A1": "VALUE", "A2": "VALUE", "A3": "VALUE", "A4": "VALUE"}, "lo": {"A1": serial(THIS_YEAR, 1, 2), "A2": serial(THIS_YEAR, 3, 1), "A3": serial(2026, 5, 1), "A4": 62 / 1440}},
    excel_only=True, excel_note="Excel (English, US) reads 1/2 as 2 January this year, 3-1 as 1 March, 5/2026 as May 2026, 1:2 as 1:02")
add("notdate-sum", 6, "save", "a fraction (1 1/2) and a bracketed minus ((100)) typed beside 2.5: Excel's total is -96; the saved file must give the same",
    {"sheet": {"title": "t", "cells": {"A1": "1 1/2", "A2": "(100)", "A3": "2.5", "A4": "=SUM(A1:A3)", "A5": "=COUNT(A1:A3)"}}},
    {"lo": {"A4": -96, "A5": 3}, "cached": {"A4": -96}})
add("notdate-jun3", 6, "save", "typed 'Jun 3': a date in this year, as Excel reads it", {"sheet": {"title": "t", "cells": {"A1": "Jun 3"}}},
    {"lo": {"A1": serial(THIS_YEAR, 6, 3)}})
add("typed-grid-save", 6, "grid", "typed in the grid (2026-11-17, 3:30 PM, 1,500) then Save .xlsx: dates and numbers in the file, shown as typed",
    {"doc": {"title": "Typed", "cells": {}}, "steps": [{"type": "2026-11-17", "at": "A1"}, {"type": "3:30 PM", "at": "A2"}, {"type": "1,500", "at": "A3"},
                                                        {"type": "=A1+7", "at": "A4"}, {"save": True}]},
    {"lo": {"A1": serial(2026, 11, 17), "A2": 15.5 / 24, "A3": 1500, "A4": serial(2026, 11, 24)}, "lo_shown": {"A1": "2026-11-17", "A2": "3:30 PM", "A3": "1,500"},
     "lo_shown_re": {"A4": r"^(2026-11-24|11/24/2026)$"}})

# ---------------------------------------------------------------------------------------------------------------
# 7. reading Excel files
add("r1904-date", 7, "read", "a 1904 workbook's date (yyyy-mm-dd) is the same day here", {"file": "date1904.xlsx"}, {"values": {"B1": serial(2026, 11, 17), "B2": serial(2026, 12, 25)}})
add("r1904-duration", 7, "read", "a 1904 workbook's lengths of time ([h]:mm) and time of day (h:mm) are left alone", {"file": "date1904.xlsx"}, {"values": {"C1": 1.5, "C2": 0.75, "D1": 0.5, "C3": 2.25}})
add("r1904-datetime", 7, "read", "a 1904 workbook's date and time (m/d/yyyy h:mm) is the same moment here", {"file": "date1904.xlsx"}, {"values": {"E1": serial(2026, 11, 17) + 14.5 / 24}})
add("r1904-formulas", 7, "read", "a 1904 workbook's formulas give Excel's answers (days between dates; a due date) and nothing is noted as different",
    {"file": "date1904.xlsx"}, {"values": {"B3": 38, "B4": serial(2026, 12, 17), "F1": 42}, "notes_not": [r"differently"]})
add("r1904-roundtrip", 7, "import", "a 1904 workbook saved again shows the same dates and hours in Excel", {"file": "date1904.xlsx", "steps": [{"save": True}]},
    {"lo_shown": {"B1": "2026-11-17", "C1": "36:00", "B4": "2026-12-17"}, "lo": {"B3": 38, "C3": 2.25}})
TEXTLIKE = ["00123", "1,500", "2026-11-17", "3:30", "1 1/2", "TRUE", "=A1", "(100)", "1.2.10", "#N/A", "Nov 2026", " 42", "1e5", "12abc", "1/2", "555-1234", "-", "March 5th", "'90s"]
add("rtext-count", 7, "read", "text that looks like a number, a date or a time stays text: COUNT 0, SUM 0, COUNTA 19 (as in Excel)", {"file": "text_numbers.xlsx"},
    {"values": {"B1": 0, "B2": 0, "B3": len(TEXTLIKE)}})
add("rtext-shown", 7, "import", "the grid shows such text as it is (00123, TRUE, =A1, #N/A), not as a number or a formula", {"file": "text_numbers.xlsx", "steps": [{"check": ["A1", "A2", "A6", "A7", "A10", "A12", "A19"]}]},
    {"shown": {"A1": "00123", "A2": "1,500", "A6": "TRUE", "A7": "=A1", "A10": "#N/A", "A12": " 42", "A19": "'90s"}})
add("rtext-roundtrip", 7, "import", "such text saved again is still text in Excel (COUNT 0)", {"file": "text_numbers.xlsx", "steps": [{"save": True}]},
    {"lo_kind": {"A1": "TEXT", "A3": "TEXT", "A5": "TEXT", "A6": "TEXT", "A8": "TEXT", "A9": "TEXT"}, "lo": {"A1": "00123", "A6": "TRUE", "B1": 0, "B2": 0}})
CONSTANTS = [("0.30000000000000004", 0.3), ("1234567890123456789", 1.23456789012346e18), ("4111111111111111", 4111111111111110), ("1.0000000000000002", 1),
             ("123456.78901234567", 123456.789012346), ("-0", 0), ("1E-20", 1e-20), ("2.675", 2.675)]
for _n, (_s, _v) in enumerate(CONSTANTS):
    add("rconst-%d" % (_n + 1), 7, "read", "a number saved as %s reads as Excel shows it, to 15 significant digits (%r)" % (_s, _v), {"file": "constants.xlsx"},
        {"values": {"A%d" % (_n + 1): _v}, "tol": 1e-14})
TABLE_SUMMARY = [("Total", "=SUM(Orders[Line Total])", 90), ("Qty and price", "=SUM(Orders[[Qty]:[Unit Price]])", 54.25), ("Rows all", "=ROWS(Orders[#All])", 7),
                 ("Totals qty", "=Orders[[#Totals],[Qty]]", 25), ("Headers", "=COUNTA(Orders[#Headers])", 4), ("Avg price", "=AVERAGE(Orders[Unit Price])", 5.85),
                 ("Lookup", '=VLOOKUP("Pens",Orders,2,FALSE)', 10), ("Biggest", "=INDEX(Orders[Item],MATCH(MAX(Orders[Line Total]),Orders[Line Total],0))", "Ink"),
                 ("Data rows", "=ROWS(Orders)", 5), ("Count", "=COUNTA(Orders[[#Data],[Item]])", 5)]
add("rtable-inside", 7, "read", "a table's own row formula (Orders[[#This Row],[Qty]]*...) is written as the cells of its row", {"file": "tables.xlsx"},
    {"raw": {"Data!D2": "=B2*C2", "Data!D6": "=B6*C6"}, "values": {"Data!D4": 36, "Data!B7": 25, "Data!D7": 90}, "notes_has": [r"Orders"]})
for _n, (_l, _f, _v) in enumerate(TABLE_SUMMARY):
    add("rtable-%02d" % (_n + 1), 7, "read", "a table named from another sheet: " + _f, {"file": "tables.xlsx"}, {"values": {"Summary!B%d" % (_n + 1): _v}})
add("rtable-roundtrip", 7, "import", "a workbook with a table saved again: the formulas work in Excel as cell ranges", {"file": "tables.xlsx", "steps": [{"open": "Summary"}, {"save": True}]},
    {"lo": {"Summary!B%d" % (i + 1): v for i, (_, _, v) in enumerate(TABLE_SUMMARY)}})
add("rtable-notes", 7, "read", "a table of 200 rows whose last column is a formula: the note says so once, not once a row", {"file": "table200.xlsx"},
    {"notes_count_max": 12, "values": {"D201": 200 * 3}})
add("rcomments", 7, "read", "comments: each one's cell and words are in the note", {"file": "comments_filter.xlsx"},
    {"notes_has": [r"B2[^;]*Check this count with the supplier", r"D5[^;]*Price rises in March"]})
add("rfilter", 7, "read", "an AutoFilter on the headings is said", {"file": "comments_filter.xlsx"}, {"notes_has": [r"(?i)filter"]})
add("rlocked", 7, "import", "a workbook locked with a password gets its own message", {"file": "locked.xlsx", "steps": []}, {"alert_has": [r"(?i)password"]})
add("rfullcalc", 7, "read", "a Python report's workbook (full recalculation asked, 0 saved beside formulas): the 0s are not called differences; a wrong 99 is",
    {"file": "fullcalc.xlsx"}, {"notes_has": [r"B3"], "notes_not": [r"\bB1\b", r"\bB2\b"], "values": {"B1": 6, "B2": 10, "B3": 12}})
add("rnocalc", 7, "read", "a workbook that does not ask for recalculation, with 0 saved for a sum of 6: the difference is said; a right 0 is not",
    {"file": "nocalc_zero.xlsx"}, {"notes_has": [r"B1"], "notes_not": [r"\bB2\b"]})
add("rnames-other-sheet", 7, "read", "a name for a cell on another sheet (TaxRate = Rates!$B$1) works as in Excel", {"file": "names_sheet.xlsx"},
    {"values": {"Summary!B2": 8.25, "Summary!B5": 108.25}})
add("rnames-number", 7, "read", "a name for a number (Discount = 0.1) and one for this sheet only (Local)", {"file": "names_sheet.xlsx"}, {"values": {"Summary!B3": 90, "Summary!B4": 200}})
add("implicit-read", 7, "read", "Excel 2016's =C2:C9*2 in row 5 (no Ctrl+Shift+Enter) is C5*2 = 14: Lantern's value should be Excel's", {"file": "implicit.xlsx"},
    {"values": {"J5": 14, "L5": 36}}, excel_note="Excel 2016 takes the cell of the range in the formula's own row; Excel 365 opens it as =@C2:C9*2, the same 14")
add("implicit-roundtrip", 7, "import", "the same file saved again: Excel must still show 14 (the formula must not become an array formula of its first cell)",
    {"file": "implicit.xlsx", "steps": [{"save": True}]}, {"lo": {"J5": 14, "L5": 36}, "xml": [{"cell": "J5", "attrs_not": ["t", "cm"]}]})
add("implicit-single", 7, "read", "Excel 365's explicit @ (written _xlfn.SINGLE) in row 5: =@C2:C9*2 is 14", {"file": "implicit.xlsx"}, {"values": {"K5": 14}})
add("rshared", 7, "read", "a shared formula with $ written out across a block, as Excel shows each cell", {"file": "shared.xlsx"},
    {"raw": {"B2": "=$A2*B$1", "D2": "=$A2*D$1", "C4": "=$A4*C$1", "D4": "=$A4*D$1"}, "values": {"D4": 120, "C3": 60}, "notes_not": [r"differently"]})

# ---------------------------------------------------------------------------------------------------------------
# 8. number formats
SHOWN = [(1234567, "[$¥-411]#,##0", "¥1,234,567"), (1234.5, "[$$-409]#,##0.00", "$1,234.50"), (-1234.5, "[$$-409]#,##0.00;[RED]\\-[$$-409]#,##0.00", "-$1,234.50"),
         (5551234, "[<=9999999]###-####;(###) ###-####", "555-1234"), (9185551234, "[<=9999999]###-####;(###) ###-####", "(918) 555-1234"),
         (1500, '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0', "1.5K"), (2500000, '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0', "2.5M"),
         (999, '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0', "999"), (-3, '0.00;[Red](0.00);"zero"', "(3.00)"), (0, '0.00;[Red](0.00);"zero"', "zero"),
         (1234567, '#,##0,"K"', "1,235K"), (1.5, "# ?/?", "1 1/2"), (501, "00000", "00501"), (-1234.5, '"$"#,##0.00_);[Red]("$"#,##0.00)', "($1,234.50)"),
         (1.5, "[h]:mm", "36:00"), (serial(2026, 11, 17), "dddd", "Tuesday"), (12345, "0.00E+00", "1.23E+04"), (12.5, '0.0 "kg"', "12.5 kg"),
         (0, "0;-0;;@", ""), (serial(2026, 11, 17), "[$-409]mmmm d, yyyy", "November 17, 2026"), (15.5 / 24, "h:mm AM/PM", "3:30 PM"),
         (-5, '[<0]"neg";"pos"', "neg"), (5, '[<0]"neg";"pos"', "pos"), (0.1234, "0.0%", "12.3%"), (serial(2026, 11, 17) + 0.5, "yyyy-mm-dd hh:mm", "2026-11-17 12:00"),
         (-5, "[Blue]#,##0;[Red]-#,##0", "-5"), (2, '[=1]"one";[=2]"two";0', "two"), (7, '[=1]"one";[=2]"two";0', "7"),
         (serial(2026, 11, 17), "mmm-yy", "Nov-26"), (serial(2026, 11, 17), "d-mmm-yy", "17-Nov-26"), (serial(2026, 11, 17) + 0.5, "m/d/yyyy h:mm", "11/17/2026 12:00"),
         (1234567, '#,##0.0,,"M"', "1.2M"), (3.14159, "# ??/??", "3 14/99"), (serial(2026, 11, 17), "dddd, mmmm d, yyyy", "Tuesday, November 17, 2026"),
         (1.5 / 24, "[mm]:ss", "90:00"), (0, '#,##0.00;(#,##0.00);"-"', "-"), (-0.05, "0.0%", "-5.0%"), (15.5 / 24, "[$-409]h:mm AM/PM;@", "3:30 PM"),
         (1234.5, "[$€-407] #,##0.00", "€ 1,234.50"), (1234.5, "#,##0.00 [$€-1]", "1,234.50 €"), (0.5, "[$-F400]h:mm:ss AM/PM", "12:00:00 PM")]
for _n, (_v, _code, _s) in enumerate(SHOWN):
    add("fmt-%02d" % (_n + 1), 8, "shown", "%r with the format %s shows as %r" % (_v, _code, _s), {"value": _v, "code": _code}, {"text": _s},
        excel_only=_code in ("[$€-407] #,##0.00", "[$-F400]h:mm:ss AM/PM"),
        excel_note="Excel (English, US) uses its own separators whatever the [$-407] says" if "407" in _code else None)
NUMFMT_FILE = [(1234567, "[$¥-411]#,##0", "¥1,234,567"), (5551234, "[<=9999999]###-####;(###) ###-####", "555-1234"),
               (9185551234, "[<=9999999]###-####;(###) ###-####", "(918) 555-1234"), (2500000, '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0', "2.5M"),
               (-3, '0.00;[Red](0.00);"zero"', "(3.00)"), (1.5, "[h]:mm", "36:00"), (serial(2026, 11, 17), "[$-409]mmmm d, yyyy", "November 17, 2026")]
add("fmt-file", 8, "import", "a workbook's number formats shown on the grid as Excel shows them", {"file": "numfmt.xlsx", "steps": [{"check": ["A%d" % (i + 1) for i in range(len(NUMFMT_FILE))]}]},
    {"shown": {"A%d" % (i + 1): s for i, (_, _, s) in enumerate(NUMFMT_FILE)}})
add("fmt-file-roundtrip", 8, "import", "the same formats saved again: Excel shows the same", {"file": "numfmt.xlsx", "steps": [{"save": True}]},
    {"lo_shown": {"A1": "¥1,234,567", "A2": "555-1234", "A3": "(918) 555-1234", "A6": "36:00"}})
LO_FODS = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
<office:automatic-styles>
<number:currency-style style:name="N1P0" style:volatile="true"><number:currency-symbol number:language="en" number:country="US">$</number:currency-symbol><number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true"/></number:currency-style>
<number:currency-style style:name="N1"><style:text-properties fo:color="#ff0000"/><number:text>-</number:text><number:currency-symbol number:language="en" number:country="US">$</number:currency-symbol><number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true"/><style:map style:condition="value()&gt;=0" style:apply-style-name="N1P0"/></number:currency-style>
<style:style style:name="ce1" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="N1"/>
</office:automatic-styles>
<office:body><office:spreadsheet><table:table table:name="Money">
<table:table-row><table:table-cell table:style-name="ce1" office:value-type="currency" office:currency="USD" office:value="1234.5"><text:p>$1,234.50</text:p></table:table-cell></table:table-row>
<table:table-row><table:table-cell table:style-name="ce1" office:value-type="currency" office:currency="USD" office:value="-1234.5"><text:p>-$1,234.50</text:p></table:table-cell></table:table-row>
<table:table-row><table:table-cell table:formula="of:=[.A1]*2" table:style-name="ce1" office:value-type="currency" office:currency="USD" office:value="2469"><text:p>$2,469.00</text:p></table:table-cell></table:table-row>
</table:table></office:spreadsheet></office:body></office:document>
"""
add("fmt-lo-currency", 8, "import", "LibreOffice's dollar format ([$$-409]) keeps its $ on the grid", {"file": "lo_currency.xlsx", "steps": [{"check": ["A1", "A2", "A3"]}]},
    {"shown": {"A1": "$1,234.50", "A2": "-$1,234.50", "A3": "$2,469.00"}})
add("fmt-carried-yen", 8, "compute", "a formula of a yen cell carries the yen look on the grid, as Excel does", {"cells": {"A1": "1000", "A2": "=A1*3"}, "fmt": {"A1": {"nf": "[$¥-411]#,##0"}}, "grid": True},
    {"shown": {"A1": "¥1,000", "A2": "¥3,000"}})

# ---------------------------------------------------------------------------------------------------------------
# 9. merged cells on the grid
MDOC = {"title": "Merged", "cells": {"A2": "left", "B2": "Title", "D2": "right", "B5": "below", "A1": "x"}, "merges": ["B2:C3"]}
add("merge-shift-right", 9, "grid", "Shift+Right from A2 into the merged B2:C3 selects A2:C3, as Excel does", {"doc": MDOC, "steps": [{"click": "A2"}, {"key": "ArrowRight", "shift": True}, {"check": {}}]},
    {"checks": [{"step": 2, "range": "A2:C3"}]})
add("merge-shift-left", 9, "grid", "Shift+Left from D3 into the merged B2:C3 selects B2:D3", {"doc": MDOC, "steps": [{"click": "D3"}, {"key": "ArrowLeft", "shift": True}, {"check": {}}]},
    {"checks": [{"step": 2, "range": "B2:D3"}]})
add("merge-shift-up", 9, "grid", "Shift+Up from B5 twice reaches the merged cell and takes all of it: B2:C5",
    {"doc": MDOC, "steps": [{"click": "B5"}, {"key": "ArrowUp", "shift": True}, {"key": "ArrowUp", "shift": True}, {"check": {}}]}, {"checks": [{"step": 3, "range": "B2:C5"}]})
add("merge-copy", 9, "grid", "a merged cell copied and pasted brings its merge", {"doc": MDOC, "steps": [{"click": "B2"}, {"copy": True}, {"click": "E6"}, {"paste": True}, {"check": {"cells": ["E6", "B2"]}}]},
    {"checks": [{"step": 4, "merges_has": ["B2:C3", "E6:F7"], "cells": {"E6": "Title", "B2": "Title"}, "no_overlap": True}]})
add("merge-cut", 9, "grid", "a merged cell cut and pasted moves its merge", {"doc": MDOC, "steps": [{"click": "B2"}, {"cut": True}, {"click": "E6"}, {"paste": True}, {"check": {"cells": ["E6", "B2"]}}]},
    {"checks": [{"step": 4, "merges_has": ["E6:F7"], "merges_not": ["B2:C3"], "cells": {"E6": "Title", "B2": None}, "no_overlap": True}]})
add("merge-insert-cols", 9, "grid", "the merged B2:C3 selected, Insert column left: two columns go in, as many as it covers",
    {"doc": MDOC, "steps": [{"click": "B2"}, {"act": "colLeft"}, {"check": {"cells": ["D2", "B2", "F2"]}}]},
    {"checks": [{"step": 2, "merges_has": ["D2:E3"], "cells": {"D2": "Title", "F2": "right", "B2": None}}]})
add("merge-insert-cols-right", 9, "grid", "the merged B2:C3 selected, Insert column right: two columns go in after C",
    {"doc": MDOC, "steps": [{"click": "B2"}, {"act": "colRight"}, {"check": {"cells": ["B2", "D2", "F2"]}}]},
    {"checks": [{"step": 2, "merges_has": ["B2:C3"], "cells": {"B2": "Title", "F2": "right", "D2": None}}]})
add("merge-insert-rows", 9, "grid", "the merged B2:C3 selected, Insert row above: two rows go in, as many as it covers",
    {"doc": MDOC, "steps": [{"click": "B2"}, {"act": "rowAbove"}, {"check": {"cells": ["B4", "B2", "B7"]}}]},
    {"checks": [{"step": 2, "merges_has": ["B4:C5"], "cells": {"B4": "Title", "B7": "below", "B2": None}}]})
add("merge-paste-overlap", 9, "grid", "the merged B2:C3 copied, C3 (inside it) clicked and pasted: Excel selects B2 on the click and pastes it onto itself; nothing else changes",
    {"doc": MDOC, "steps": [{"click": "B2"}, {"copy": True}, {"click": "C3"}, {"paste": True}, {"check": {"cells": ["B2", "D2"]}}, {"save": True}]},
    {"checks": [{"step": 4, "no_overlap": True, "merges_has": ["B2:C3"], "merges_not": ["D2:E3"], "cells": {"B2": "Title", "D2": "right"}}]})
add("merge-click-covered-from-merge", 9, "grid", "with the merged B2 selected, a click on C3 (a cell it covers) keeps the merged cell B2 selected",
    {"doc": MDOC, "steps": [{"click": "B2"}, {"click": "C3"}, {"check": {}}]}, {"checks": [{"step": 2, "active": "B2"}]})
add("merge-paste-onto-merge", 9, "grid", "the merged B2:C3 pasted at A2, where it would cover half of itself: Excel refuses (it cannot change part of a merged cell)",
    {"doc": MDOC, "steps": [{"click": "B2"}, {"copy": True}, {"click": "A2"}, {"paste": True}, {"check": {"cells": ["A2", "B2"]}}]},
    {"checks": [{"step": 4, "merges_has": ["B2:C3"], "cells": {"A2": "left", "B2": "Title"}}]})
add("merge-enter", 9, "grid", "typing in the merged B2:C3 and pressing Enter goes to B4, below the merge", {"doc": MDOC, "steps": [{"type": "New", "at": "B2"}, {"check": {}}]},
    {"checks": [{"step": 1, "active": "B4"}]})
add("merge-arrow", 9, "grid", "Right from the merged B2:C3 goes to D2", {"doc": MDOC, "steps": [{"click": "B2"}, {"key": "ArrowRight"}, {"check": {}}]},
    {"checks": [{"step": 2, "active": "D2"}]})
add("merge-shift-down", 9, "grid", "Shift+Down from B1 into the merged B2:C3 selects B1:C3", {"doc": MDOC, "steps": [{"click": "B1"}, {"key": "ArrowDown", "shift": True}, {"check": {}}]},
    {"checks": [{"step": 2, "range": "B1:C3"}]})
add("merge-click-covered", 9, "grid", "a click on C3, a cell the merge covers, selects the merged cell B2", {"doc": MDOC, "steps": [{"click": "C3"}, {"check": {}}]},
    {"checks": [{"step": 1, "active": "B2"}]})
add("merge-undo-paste", 9, "grid", "a merged cell pasted, then Ctrl+Z: the pasted merge goes again", {"doc": MDOC, "steps": [{"click": "B2"}, {"copy": True}, {"click": "E6"}, {"paste": True}, {"undo": True}, {"check": {"cells": ["E6"]}}]},
    {"checks": [{"step": 5, "merges_not": ["E6:F7"], "merges_has": ["B2:C3"], "cells": {"E6": None}}]})
add("merge-delete-key", 9, "grid", "Delete on a merged cell empties it and keeps the merge", {"doc": MDOC, "steps": [{"click": "B2"}, {"key": "Delete"}, {"check": {"cells": ["B2"]}}]},
    {"checks": [{"step": 2, "merges_has": ["B2:C3"], "cells": {"B2": None}}]})
add("merge-save", 9, "grid", "a sheet with merged cells copied about, saved: the file's merges are valid", {"doc": MDOC, "steps": [{"click": "B2"}, {"copy": True}, {"click": "E6"}, {"paste": True}, {"click": "H9"}, {"paste": True}, {"save": True}]},
    {"merges_file": ["B2:C3", "E6:F7", "H9:I10"]})

# ---------------------------------------------------------------------------------------------------------------
# 10. Excel's grammar (excelFormula): what goes into the file
GRAMMAR = [
    ("sum(a1:b2)", {"ok": True, "f": "SUM(A1:B2)"}, ""), ("SUM(Jan:Mar!B2)", {"ok": True, "f": "SUM(Jan:Mar!B2)", "sheets": ["Jan", "Mar"]}, ""),
    ("sum(jan:mar!b2)", {"ok": True, "f": "SUM(jan:mar!B2)"}, ""), ("NETWORKDAYS.INTL(A1,B1,11)", {"ok": True, "f": "NETWORKDAYS.INTL(A1,B1,11)"}, "Excel 2010's, no _xlfn."),
    ("WORKDAY.INTL(A1,5,1)", {"ok": True, "f": "WORKDAY.INTL(A1,5,1)"}, ""), ("xlookup(a1,b1:b9,c1:c9)", {"ok": True, "f": "_xlfn.XLOOKUP(A1,B1:B9,C1:C9)"}, ""),
    ("concat(a1,b1)", {"ok": True, "f": "_xlfn.CONCAT(A1,B1)"}, ""), ("stdev.s(a1:a9)", {"ok": True, "f": "_xlfn.STDEV.S(A1:A9)"}, ""),
    ("filter(a1:a9,b1:b9>2)", {"ok": True, "f": "_xlfn._xlws.FILTER(A1:A9,B1:B9>2)"}, ""), ("IFNA(A1,0)", {"ok": True, "f": "_xlfn.IFNA(A1,0)"}, ""),
    ("17%5", {"ok": False}, "Lantern's remainder; Excel cannot read it"), ("'Bob''s rates'!B1*2", {"ok": True, "f": "'Bob''s rates'!B1*2", "sheets": ["Bob's rates"]}, ""),
    ("Z1+AA1", {"ok": True, "wide": True}, ""), ("PI*2", {"ok": True, "f": "PI()*2"}, ""), ("1e3+a1", {"ok": True, "f": "1E3+A1"}, ""),
    ("A1=", {"ok": False}, ""), ("SUM(A1:A3", {"ok": False}, ""), ("IF(A1,,2)", {"ok": True, "f": "IF(A1,,2)"}, ""), ("SUM({1,2,3}*2)", {"ok": True, "array": True}, ""),
    ("GAMMAFN(5)", {"ok": True, "f": "_xlfn.GAMMA(5)"}, ""), ("GAMMA(5)", {"ok": True, "clash": ["GAMMA"]}, ""), ("E*2", {"ok": True, "f": "EXP(1)*2"}, ""),
    ("ANS+1", {"ok": False}, ""), ("true+1", {"ok": True, "f": "TRUE+1"}, ""), ('COUNTIF(A1:A9,"<>")', {"ok": True}, ""), ("#REF!+1", {"ok": True, "f": "#REF!+1"}, ""),
    ("SUM(A:A)", {"ok": True, "f": "SUM(A:A)"}, ""), ("ROUND(A1)", {"ok_or_fixed": "ROUND(A1,0)"}, "Excel's ROUND needs the number of digits"),
    ("FLOOR(A1)", {"ok_or_fixed": "FLOOR(A1,1)"}, "Excel's FLOOR needs the multiple"), ("CEILING(A1)", {"ok_or_fixed": "CEILING(A1,1)"}, "Excel's CEILING needs the multiple"),
    ("ROUNDUP(A1)", {"ok_or_fixed": "ROUNDUP(A1,0)"}, ""), ("IF(A1)", {"ok": False}, "Excel's IF needs a value for TRUE"), ("SUM()", {"ok": False}, "Excel's SUM needs a value"),
    ("POW(2,3)", {"ok": True, "f": "POWER(2,3)"}, "Excel calls it POWER"), ("CEIL(2.5)", {"ok": True, "f": "CEILING(2.5,1)"}, "Excel calls it CEILING"),
    ("LET(x,2,x+1)", {"ok": True, "f": "_xlfn.LET(_xlpm.x,2,_xlpm.x+1)"}, "Excel writes LET's names with _xlpm."),
    ("SUM(" + "+".join(["A1"] * 2800) + ")", {"ok": False}, "longer than Excel's 8,192 characters"),
    ('LEN("' + "x" * 300 + '")', {"ok": False}, "Excel's text in a formula is at most 255 characters"),
]
for _n, (_f, _e, _why) in enumerate(GRAMMAR):
    _xo = "ok_or_fixed" in _e or _f.startswith(("IF(A1)", "SUM()", "LET(", "SUM(A1+", 'LEN("'))
    add("grammar-%02d" % (_n + 1), 10, "grammar", "Excel's grammar: " + (_f if len(_f) < 60 else _f[:40] + "... (%d characters)" % len(_f)) + (" -- " + _why if _why else ""), {"f": _f}, _e,
        excel_only=_xo, excel_note=("Excel cannot read the formula as written: it asks to repair the file (Removed Records: Formula), or works out another thing" if _xo else None))
add("grammar-longtext", 10, "save", "a cell of 40,000 characters is cut at 32,767, with a note", {"sheet": {"title": "t", "cells": {"A1": "y" * 40000, "A2": "=LEN(A1)"}}},
    {"notes_has": [r"32,767"], "lo": {"A2": 32767}})
add("grammar-wide-save", 10, "save", "a formula that reaches past Z is saved as a formula, with a note", {"sheet": {"title": "t", "cells": {"A1": "=SUM(Z1:AB1)+1"}}},
    {"notes_has": [r"(?i)past Z"], "xml": [{"cell": "A1", "f": "SUM(Z1:AB1)+1"}]})
add("grammar-round1-save", 10, "save", "=ROUND(A1) and =FLOOR(A1) typed (Lantern takes a whole number): the file must hold formulas Excel can read",
    {"sheet": {"title": "t", "cells": {"A1": "2.5", "B1": "=ROUND(A1)", "B2": "=FLOOR(A1)", "B3": "=ROUNDUP(A1)", "B4": "=CEILING(A1)"}}},
    {"xml_readable": ["B1", "B2", "B3", "B4"], "lo": {"B1": 3, "B2": 2, "B3": 3}},
    excel_only=True, excel_note="Excel's ROUND, ROUNDUP, FLOOR and CEILING need their second value: Excel asks to repair a file with them short (LibreOffice reads them)")
add("grammar-ceilpow-save", 10, "save", "=CEIL(A1) and =POW(A1,2) typed: Excel calls them CEILING and POWER; the file should give Excel's answer",
    {"sheet": {"title": "t", "cells": {"A1": "2.5", "B3": "=CEIL(A1)", "B4": "=POW(A1,2)"}}}, {"lo": {"B3": 3, "B4": 6.25}, "notes_has": [r"CEIL", r"POW"]})

# where LibreOffice is not Excel: it counts TRUE as 1 inside SUM and SUMPRODUCT; Excel leaves TRUE and FALSE out of SUM
# and counts them as 0 in SUMPRODUCT (that is why Excel's users write -- before a comparison)
LO_DIFFERS = {"cells-11": "LibreOffice adds TRUE as 1 (6); Excel's SUM leaves TRUE and FALSE out (0)",
              "cells-12": "LibreOffice adds TRUE as 1 (6); Excel's SUMPRODUCT counts TRUE and FALSE as 0",
              "cells-25": "LibreOffice counts TRUE as 1 (11); Excel's SUMPRODUCT counts TRUE and FALSE as 0"}
for c in CASES:
    if c["id"] in LO_DIFFERS: c["lo_differs"] = LO_DIFFERS[c["id"]]

# ---------------------------------------------------------------------------------------------------------------
# the judgement of each disagreement found on 1.24.28 at 5331955: harm (high: a wrong number shown or saved without a
# word, or a file Excel must repair; medium: wrong but said, or something lost; low: looks, wording) and why
JUDGE = {}


def judge(ids, harm, why):
    for i in ids.split(): JUDGE[i] = {"harm": harm, "why": why}


judge("cells-13 cells-14 cells-16 cells-19 cells-20 cells-29 cells-30 cells-39 cells-42 cells-56 cells-58", "high",
      "A function that takes one value (LEN, LEFT, SEARCH, ISNUMBER, MATCH's value, TEXT) or a criterion (COUNTIF, SUMIF) is given the whole "
      "list as one value, so the list is not worked out cell by cell: SUMPRODUCT(LEN(B2:B9)) is 0, SUMPRODUCT(1/COUNTIF(B2:B9,B2:B9)) is 0.33. "
      "Excel works each cell out. The answer looks like a number and nothing is said. Mend: in a sheet, when a list reaches an argument that takes "
      "one value, work the function out for each cell (as zip does for + and *), and give COUNTIF/SUMIF a list of criteria the same way.")
judge("cells-15 cells-21 cells-22 cells-38 cells-66", "medium",
      "MONTH, YEAR, ROUND, ABS and INDEX(list,0) refuse a list: #VALUE! where Excel gives a number. Wrong, but it shows as an error. "
      "Same mend as the LEN finding: work one-value functions out cell by cell over a list.")
judge("cells-63", "medium", "One #DIV/0! inside a list makes the whole formula #DIV/0!; Excel keeps the error in its own cell and COUNT passes over it (4). "
      "Mend: zip should put an element's error in that element, not throw; SUM/MAX then throw on it, COUNT/IFERROR/ISERROR look at each.")
judge("cells-64", "high", "SUM(IFERROR(C2:C9/(A2:A9=\"North\"),0)) is 0 in Lantern, 11 in Excel: the first #DIV/0! in the list throws for the whole "
      "list, and IFERROR then gives 0 for all of it. A wrong total, shown without a word. Same mend as cells-63.")
judge("cells-shown-date", "low", "The array MAX of dates shows as a serial number (46152); Excel most likely carries the dates' look. Display only; not checked in Excel.")
judge("guard-143 guard-145 guard-155", "high",
      "SQRT, LN, LOG and ACOS of a number they cannot take give NaN, not an error: a cell shows #NUM!, but inside another function the NaN passes "
      "as a number, so ISERROR(LN(0)) is FALSE, ISNUMBER(SQRT(-1)) is TRUE and COUNT(SQRT(-1)) is 1. Excel: TRUE, FALSE, 0. Mend: when any "
      "function returns NaN or Infinity, throw #NUM! there (in FORMULA, where FN and EXT are called), so IFERROR, ISERROR and COUNT see the error.")
judge("guard-142 guard-144 guard-146", "medium",
      "IFERROR does not catch SQRT/LOG/ACOS of a bad number (NaN, see guard-143): the cell shows #NUM! where Excel shows IFERROR's own value. "
      "Ordinary error handling that used to be relied on; the error shows, so medium.")
judge("newfn-06", "medium", "ERROR.TYPE(SQRT(-1)) is #N/A (no error seen) where Excel gives 6: the NaN of guard-143 again.")
judge("newfn-09", "high", "ERROR.TYPE(1/0) is 3 (#VALUE!) where Excel gives 2: a division by 0 written in the formula throws an error with no "
      "code, and ERROR.TYPE takes a code-less error as #VALUE!. A wrong number, said nowhere (rare function). Mend: give the divide error the "
      "code #DIV/0! where mulDiv throws it (as the cell's errCode already names it).")
judge("arrays-save-05 arrays-save-07", "high", "The formula goes into the file right and Excel works it out again, but the value saved beside it is "
      "Lantern's wrong one (0 for SUMPRODUCT(LEN(...)), 3 for SUM(COUNTIF(..,{..}))). A program that shows saved values (a phone preview, "
      "openpyxl, a viewer) shows the wrong number. Follows from cells-13 and cells-30.")
judge("arrays-save-more-01 arrays-save-more-02 arrays-save-more-03 arrays-save-more-04", "high",
      "Saved as a plain formula, so Excel 2019 (and Excel 365, which opens it as =SUM(@LEN(A2:A9))) cuts the range to the formula's own row: "
      "#VALUE! or 0 in Excel where Excel's own typed formula gives 37, 6, 8, 5. The writer marks a formula as an array only when a range "
      "stands beside a sign; a range given to a function that takes one value (LEN, ISNUMBER), or a range alone (=C2:C4), needs it too. "
      "Mend: in excelFormula, set array when a range is an argument of a one-value function or the whole formula. LibreOffice shows it; "
      "Excel's own reading of such a file is by the same rule.")
judge("spill-shown", "medium", "=SORT(C2:C9) shows only its first value and a cell below it (=K2) is 0; Excel 365 spills the whole list. "
      "Lantern says nothing on the grid, but the missing list is plain to see. Mend (larger): spill a list into the empty cells below and beside, "
      "with #SPILL! when they are not empty.")
judge("arrays-read", "medium", "TRANSPOSE is not in Lantern: #NAME? (said in the notes). Lantern also lacks MMULT, TREND, LINEST, SKEW, KURT, "
      "ISLOGICAL, TYPE, SORTBY, TAKE, DROP, VSTACK, HSTACK and others an Excel file may use.")
judge("arrays-edit", "medium", "A multi-cell array formula from Excel (D2:D5) keeps Excel's saved values in D3:D5: after B3 changes, D3 still shows "
      "60 (Excel 200). Said once when the file is opened; afterwards the old values look live. Mend: work the array formula out and put each "
      "value in its cell (the same machinery as a spill).")
judge("gamma-value-8", "medium", "GAMMA.DIST (and GAMMA.INV) are not in Lantern: #NAME?, said in the notes. The GAMMA rename leaves them alone, as it should.")
judge("gamma-typed", "medium", "=GAMMA(0.5) typed in Sheets is the Lorentz factor (1 here); Excel's is the gamma function (1.7725). The grid says "
      "nothing; Save .xlsx saves the value with a note. Which GAMMA a sheet means is Adam's call; at least the grid could say it when typed.")
judge("datef-sumtimes", "low", "16:00 + 10:00 shows 26:00 in the saved file; Excel would carry the typed cells' h:mm and show 2:00. Lantern's "
      "[hh]:mm is the more useful look; differs from Excel only in looks.")
judge("notdate-02 notdate-03", "medium", "Version numbers 1.2.10 and 2.10.25 typed in Sheets are text on the grid, but Save .xlsx writes them "
      "as dates (1 Feb 2010, 10 Feb 2025) with a look that shows the same digits. Excel (English, US) keeps them as text. They then sort, "
      "filter and join (&) as day numbers in Excel, without a word. Mend: read a date with dots only with a four-digit year (17.11.2026), "
      "never m.d.yy.")
judge("notdate-10 notdate-11", "low", "17.11.2026 and 17/11/2026 are saved as dates (17 November); Excel (English, US) keeps them as text. "
      "Lantern's reading is what a person writing them means; Excel set to a European language does the same as Lantern.")
judge("notdate-12", "low", "March 5th is saved as a date (shown March 5); Excel keeps it as text.")
judge("notdate-15 notdate-16", "high", "1 1/2 and (100) typed in Sheets count as 1.5 and -100 in Lantern's own sums (as in Excel, where typing "
      "them makes numbers), but Save .xlsx writes them as text. In the file Excel leaves them out of SUM and COUNT. Mend: write such a cell as "
      "its number, with the look # ?/? or #,##0_);(#,##0).")
judge("notdate-sum", "high", "The sum Lantern showed (-96) and saved beside the formula is not what Excel works out from the file (2.5): the "
      "total in Excel changes when the file is opened, without a word. Follows from notdate-15/16.")
judge("notdate-excel-dates", "low", "Excel turns 1/2, 3-1, 5/2026 and 1:2 into dates and a time; Lantern keeps them as text. Lantern's way is "
      "kinder to scores and fractions; recorded as a difference only.")
judge("rtext-count", "medium", "A text cell holding #N/A (an apostrophe in Sheets) is taken as the error #N/A inside a range: SUM of the "
      "column is #N/A, Excel 0. Mend: keep text from an apostrophe cell apart from errors (fval/range should test the raw cell, not only the value).")
judge("rnames-other-sheet", "medium", "A name for a cell on another sheet (TaxRate = Rates!$B$1) is left as a name: #NAME? (the note lists "
      "the difference from Excel's values). Now that other sheets work, the reader could write Rates!$B$1 in its place.")
judge("implicit-read", "medium", "Excel 2016's =C2:C9*2 in row 5 (implicit intersection) is 14 in Excel, 10 in Lantern (the list's first value). "
      "The note lists the difference. Mend: in a plain (not array) formula from a file, a range where one value is wanted is the cell in the "
      "formula's own row (Excel 365's @).")
judge("implicit-roundtrip", "high", "Saving that file again marks the formula as an array formula (t=array), so Excel itself now shows 10 where "
      "it showed 14: Lantern changes Excel's own answer in Excel's own file. Mend: a formula that came from the file as a plain formula is "
      "written as a plain formula (or, with @ read, as Excel 365 writes it).")
judge("implicit-single", "medium", "Excel 365's explicit @ (_xlfn.SINGLE) is not in Lantern: #NAME?, said in the notes.")
judge("rtable-notes", "medium", "A table of 200 rows gives 401 notes, one for each table reference rewritten in each row. The note box above "
      "the grid becomes a long list, and the notes that matter (a value worked out differently) are lost in it. Mend: one note per table.")
judge("merge-paste-overlap merge-click-covered-from-merge", "medium",
      "With the merged B2:C3 selected, a click on C3 (a cell it covers) selects D2, not B2: the rule that an arrow from a merged cell goes past "
      "it is applied to a click too. A paste after that click lands on D2 and writes over what was there (\"right\"), and makes a second merge. "
      "Excel selects the merged cell on any click inside it. Mend: in SHEET_LAYOUT's onSelect, go past the merge only for an arrow key, never a click.")
judge("merge-paste-onto-merge", "low", "Pasting a merged cell where it would cover part of another merged cell: Excel refuses; Lantern pastes, "
      "takes the old merge away and writes over A2 and B2. Undo brings it back; it is what the person asked, done differently from Excel.")
judge("sheets-28", "medium", "INDIRECT(\"Jan!B6\") is #REF! here, 100 in Excel: INDIRECT does not reach the workbook's other sheets. "
      "Month-by-month summaries often use it (=INDIRECT(A2&\"!B6\")). An error shows, so medium. Mend: let INDIRECT read a sheet name through ctx.other.")
judge("sheets-29", "medium", "=SUM(Jan!B:B) is #ERR (not even one of Excel's errors), 200 in Excel: a whole column on another sheet is not read. "
      "Mend: otherSheet() should take A:A and 2:2 as argExpr does on the formula's own sheet.")
judge("grammar-28 grammar-29 grammar-30 grammar-31 grammar-round1-save", "high",
      "Lantern's ROUND, ROUNDUP, FLOOR and CEILING take one value (to a whole number); Excel's need two. The grammar check passes ROUND(A1) as it "
      "is, and Excel cannot read it: it asks to repair the file and takes the formula out. Mend: write the second value Lantern means "
      "(ROUND(A1,0), FLOOR(A1,1), CEILING(A1,1)).")
judge("grammar-32 grammar-33", "high", "IF(A1) and SUM() are Lantern's (1/0, and 0) but too few arguments for Excel, which cannot read them. "
      "Rare. Mend: IF(A1,1,0); SUM() saved as its value.")
judge("grammar-34 grammar-35 grammar-ceilpow-save", "medium", "POW and CEIL are Lantern's names; Excel has POWER and CEILING. Saved as POW(...), "
      "CEIL(...): Excel shows #NAME? (Lantern's note says so). Mend: write POWER(a,b) and CEILING(x,1).")
judge("grammar-36", "medium", "LET is not in Lantern (#NAME? here, said). If kept, Excel writes LET's names as _xlpm.x; written plain, "
      "Excel may not read them. Not checked in Excel.")
judge("grammar-37 grammar-38", "high", "A formula over 8,192 characters, or a text in quotes over 255 characters, passes the check; Excel "
      "cannot read either. Rare. Mend: save such a cell as its value, with a note (or split the long text with &).")

for c in CASES:
    j = JUDGE.get(c["id"])
    if j: c.update(j)
    else: c.update({"harm": None, "why": "Lantern does what Excel does here"})
