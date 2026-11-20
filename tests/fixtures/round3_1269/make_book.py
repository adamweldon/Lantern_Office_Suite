# make_book.py -- the third reviewer's workbook for rule A1 (rows and columns put in or taken out on one sheet of an
# imported workbook), written with openpyxl as Excel writes its formulas: Book3.xlsx, eight sheets.
# Each sheet's column B holds numbers that say where they came from (Jan!B6 is 106, Feb 2xx, Summary 4xx ...), so a
# value read after rows go in tells which cell a formula reads.
# Usage: python3 -I tests/fixtures/round3_1269/make_book.py <out.xlsx>
import sys
from openpyxl import Workbook

SHEETS = [("Jan", 100), ("Feb", 200), ("Mar", 300), ("Summary", 400), ("Q1 2026", 500), ("My Sheet", 600), ("Março", 700), ("Лист2", 800), ("Março26", 900), ("Bob's", 1000)]
FORMULAS = {
    "Jan": {"C6": "=B6*2", "D1": "=Jan!B6", "E1": "=SUM(B2:B8)", "F1": "=Summary!B6", "G1": "=Summary!B6+B6"},
    "Summary": {
        "A1": "=Jan!B6+B6", "B1": "='My Sheet'!B6+B6", "C1": "=SUM(Jan:Mar!B2)+B6", "D1": "='Q1 2026'!B6+B6",
        "E1": "=Março!B6+B6", "F1": "=jan!B6+B6", "G1": "=SUM(Jan!B2:B8)+SUM(B2:B8)", "H1": "=Jan!B6", "I1": "=Summary!B6",
        "J1": "=INDIRECT(\"Jan!B6\")", "K1": "=Jan!C6", "L1": "=Jan!B3", "M1": "=Jan!$B$6", "N1": "=Feb!B6",
        "O1": "=Лист2!B6+B6", "P1": "=Março26!B6+B6", "Q1": "=SUM(Jan!B6:B7)","R1": "=COUNT(Jan!B:B)", "S1": "='Bob''s'!B6+B6",
    },
    "Q1 2026": {"A1": "=Jan!B6*2"},
    "My Sheet": {"A1": "=Jan!B6+'Q1 2026'!B6"},
    "Março": {"A1": "=Jan!B6"},
    "Лист2": {"A1": "=Summary!B6"},
}

def main(out):
    wb = Workbook()
    wb.remove(wb.active)
    for name, base in SHEETS:
        ws = wb.create_sheet(name)
        ws["A1"] = "Item"
        for r in range(2, 9):
            ws["A%d" % r] = "row %d" % r
            ws["B%d" % r] = base + r
        for ref, f in FORMULAS.get(name, {}).items():
            ws[ref] = f
    wb.save(out)

if __name__ == "__main__":
    main(sys.argv[1])
