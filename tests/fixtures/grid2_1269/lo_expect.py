# lo_expect.py -- LibreOffice Calc as the stand-in for Excel's formula moves (the second grid reviewer, 1.24.29).
# For every case of cases.py with "lo": [op, range, mode], the case's first sheet is typed into Calc (FormulaLocal),
# the same Insert or Delete is made there (insertCells / removeRange: DOWN, RIGHT, ROWS, COLUMNS; UP, LEFT, ROWS,
# COLUMNS), and every filled cell of A1:Z130 afterwards is written to lo_expect.json.
# Start Calc first:  soffice --headless --invisible --norestore "--accept=socket,host=localhost,port=2399;urp;" &
# Usage: python3 tests/fixtures/grid2_1269/lo_expect.py
import json, os, sys
import uno
from com.sun.star.beans import PropertyValue
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cases import CASES


def connect():
    local = uno.getComponentContext()
    res = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    ctx = res.resolve("uno:socket,host=localhost,port=2399;urp;StarOffice.ComponentContext")
    return ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)


def main():
    desk = connect()
    p = PropertyValue(); p.Name = "Hidden"; p.Value = True
    out = {}
    for case in CASES:
        if not case.get("lo"):
            continue
        op, rng, mode = case["lo"]
        cells = case["steps"][0][1]
        doc = desk.loadComponentFromURL("private:factory/scalc", "_blank", 0, (p,))
        sh = doc.Sheets.getByIndex(0)
        for k, v in cells.items():
            sh.getCellRangeByName(k).FormulaLocal = v
        addr = sh.getCellRangeByName(rng).RangeAddress
        if op == "insert":
            sh.insertCells(addr, uno.Enum("com.sun.star.sheet.CellInsertMode", mode))
        else:
            sh.removeRange(addr, uno.Enum("com.sun.star.sheet.CellDeleteMode", mode))
        got = {}
        sh = doc.Sheets.getByIndex(0)   # (the sheet object taken before a removeRange UP no longer reads the cells below it)
        for r in range(130):
            for c in range(26):
                cell = sh.getCellByPosition(c, r)
                f = cell.FormulaLocal
                if f != "":
                    got["%s%d" % (chr(65 + c), r + 1)] = f
        out[case["id"]] = got
        doc.close(True)
    json.dump(out, open(os.path.join(HERE, "lo_expect.json"), "w"), indent=1, sort_keys=True)
    print("%d cases worked out in LibreOffice" % len(out))


if __name__ == "__main__":
    main()
