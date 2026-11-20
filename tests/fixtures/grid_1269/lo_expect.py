# lo_expect.py -- asks LibreOffice (the stand-in for Excel) what each grid_1269 case's insert or delete does to the
# cells and formulas, and writes lo_expect.json for replay.py. Needs LibreOffice with Python UNO:
#   soffice --headless --invisible --norestore "--accept=socket,host=localhost,port=2199;urp;" &
#   python3 tests/fixtures/grid_1269/lo_expect.py
# LibreOffice writes a deleted reference as B#REF! where Excel writes #REF!; replay.py reads the two as the same.
import json, os, re, sys, time
import uno
from com.sun.star.beans import PropertyValue

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cases as CASES

def connect():
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for i in range(30):
        try: return resolver.resolve("uno:socket,host=localhost,port=2199;urp;StarOffice.ComponentContext")
        except Exception: time.sleep(1)
    sys.exit("LibreOffice is not listening on port 2199")

INSMODE = {"down": "DOWN", "right": "RIGHT", "rows": "ROWS", "cols": "COLUMNS"}
DELMODE = {"up": "UP", "left": "LEFT", "rows": "ROWS", "cols": "COLUMNS"}

def colname(n):
    s = ""
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s

def run(desktop, case):
    pv = PropertyValue(); pv.Name = "Hidden"; pv.Value = True
    doc = desktop.loadComponentFromURL("private:factory/scalc", "_blank", 0, (pv,))
    try:
        sh = doc.Sheets.getByIndex(0)
        for ref, v in case["cells"].items():
            c = sh.getCellRangeByName(ref)
            if v.startswith("="): c.FormulaLocal = v
            else:
                try: c.Value = float(v)
                except ValueError: c.String = v
        for op, ref, mode in case["lo"]:
            sh = doc.Sheets.getByIndex(0)       # the sheet object's own range moves with a delete; fetch it again
            addr = sh.getCellRangeByName(ref).RangeAddress
            if op == "ins": sh.insertCells(addr, uno.Enum("com.sun.star.sheet.CellInsertMode", INSMODE[mode]))
            else: sh.removeRange(addr, uno.Enum("com.sun.star.sheet.CellDeleteMode", DELMODE[mode]))
        doc.calculateAll()
        sh = doc.Sheets.getByIndex(0)
        cur = sh.createCursor(); cur.gotoEndOfUsedArea(False)
        end = cur.RangeAddress
        f, v = {}, {}
        for r in range(0, end.EndRow + 1):
            for c in range(0, end.EndColumn + 1):
                cell = sh.getCellByPosition(c, r)
                t = cell.Type.value
                if t == "EMPTY": continue
                ref = "%s%d" % (colname(c + 1), r + 1)
                f[ref] = cell.FormulaLocal
                if t == "VALUE": v[ref] = cell.Value
                elif t == "TEXT": v[ref] = cell.String
                else:
                    rt = cell.FormulaResultType2
                    v[ref] = cell.Value if rt == 1 else cell.String
        return {"f": f, "v": v}
    finally:
        doc.close(True)

def main():
    ctx = connect()
    desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    out = {}
    for case in CASES.CASES:
        if case.get("lo"):
            out[case["id"]] = run(desktop, case)
            print(case["id"], json.dumps(out[case["id"]]["f"])[:150])
    json.dump(out, open(os.path.join(HERE, "lo_expect.json"), "w", encoding="utf-8"), indent=1, sort_keys=True)
    print("%d cases written to lo_expect.json" % len(out))

if __name__ == "__main__":
    main()
