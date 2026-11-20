# agg_lo.py -- the AGGREGATE and SUBTOTAL cases of rule A3, worked out by LibreOffice (whose SUBTOTAL and AGGREGATE
# pass over a cell whose formula has SUBTOTAL or AGGREGATE anywhere in it, as Excel's do) as a second opinion beside
# Excel's documented options table (0-3 leave out nested SUBTOTAL and AGGREGATE; 1, 3, 5, 7 hidden rows; 2, 3, 6, 7
# errors). Two layouts: "plain" (each nested total a SUBTOTAL or AGGREGATE by itself) and "nested" (one more total,
# ROUND(SUBTOTAL(...)), and SUBTOTAL over an AGGREGATE). Row 6 is hidden. Writes agg_lo.json.
# Usage: python3 -I tests/fixtures/round3_1269/agg_lo.py <work dir>
import json, os, subprocess, sys
from openpyxl import Workbook, load_workbook

BASE = {
    "A1": "Item", "B1": "Value",
    "B2": 10, "B3": 20, "B4": "=SUBTOTAL(9,B2:B3)", "B5": 40, "B6": 50, "B7": "=AGGREGATE(9,0,B5:B6)",
    "B9": "=B4", "B10": "=1/0",
    "D1": "=AGGREGATE(9,0,B2:B9)", "D2": "=AGGREGATE(9,1,B2:B9)", "D3": "=AGGREGATE(9,4,B2:B9)", "D4": "=AGGREGATE(9,5,B2:B9)",
    "D5": "=AGGREGATE(4,0,B2:B9)", "D6": "=AGGREGATE(2,0,B2:B9)", "D7": "=AGGREGATE(1,3,B2:B10)", "D8": "=AGGREGATE(9,0,B2:B10)",
    "D11": "=AGGREGATE(9,6,B2:B10)", "D12": "=AGGREGATE(9,2,B2:B10)", "D13": "=AGGREGATE(5,1,B2:B9)", "D14": "=AGGREGATE(3,0,A1:B9)",
}
LAYOUTS = {
    "plain": dict(BASE),
    "nested": dict(BASE, **{"B8": "=ROUND(SUBTOTAL(9,B2:B3),0)", "D9": "=SUBTOTAL(9,B2:B9)", "D10": "=SUBTOTAL(109,B2:B9)"}),
}
HIDDEN = [6]

def run(work, name, cells):
    src = os.path.join(work, name + ".xlsx")
    wb = Workbook(); ws = wb.active; ws.title = "Agg"
    for k, v in cells.items():
        # in the file Excel writes AGGREGATE (an Excel 2010 function) as _xlfn.AGGREGATE
        ws[k] = v.replace("AGGREGATE(", "_xlfn.AGGREGATE(") if isinstance(v, str) else v
    for r in HIDDEN:
        ws.row_dimensions[r].hidden = True
    wb.save(src)
    out = os.path.join(work, "lo")
    os.makedirs(out, exist_ok=True)
    subprocess.run(["soffice", "--headless", "--calc", "--convert-to", "xlsx", "--outdir", out, src], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    got = load_workbook(os.path.join(out, name + ".xlsx"), data_only=True).active
    return {k: got[k].value for k in cells if k.startswith("D")}

def main(work):
    res = {}
    for name, cells in LAYOUTS.items():
        res[name] = {"cells": {k: str(v) for k, v in cells.items()}, "lo": run(work, name, cells)}
    res["hidden"] = HIDDEN
    print(json.dumps({k: v["lo"] for k, v in res.items() if k != "hidden"}, indent=1))
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "agg_lo.json"), "w") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)

if __name__ == "__main__":
    main(sys.argv[1])
