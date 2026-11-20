#!/usr/bin/env python3
# lo_recalc.py -- opens each workbook Lantern saved for the xlsx cases (replay.js --save <dir>) in LibreOffice,
# works every formula out again, and compares the cell with the value Lantern showed. LibreOffice stands in for
# Excel here; its CONVERT keeps some old constants (its pound is 453.5923097 g, its psi 6894.759 Pa), so numbers
# are compared to 1e-5. A unit LibreOffice has of its own (Schooner, pond, acre) is skipped. A cell that shows #NAME? (Lantern's own LORE) agrees when Lantern's note names it.
#
#   soffice --headless --accept="socket,host=localhost,port=2299;urp;" &
#   node replay.js --save /tmp/x && python3 lo_recalc.py /tmp/x
import sys, os, json, time
import uno
from com.sun.star.beans import PropertyValue


def connect():
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(30):
        try:
            return resolver.resolve("uno:socket,host=localhost,port=2299;urp;StarOffice.ComponentContext")
        except Exception:
            time.sleep(1)
    raise SystemExit("LibreOffice is not listening on port 2299")


LO_ONLY = ["\"Schooner\"", "\"Middy\"", "\"Glass\"", "\"Sixpack\"", "\"Humpen\"", "pond\"", "\"pweight\"", "\"lightyear\"", "\"picapt\""]


def main():
    d = sys.argv[1]
    exp = json.load(open(os.path.join(d, "expect.json")))
    ctx = connect()
    desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    hidden = PropertyValue(); hidden.Name = "Hidden"; hidden.Value = True
    n = a = 0
    for c in exp["cases"]:
        cid = c["id"]
        if cid not in exp["shown"]:
            continue
        src = " ".join(c["input"]["cells"].values())
        if any(u in src for u in LO_ONLY):
            print("SKIP %s (a unit LibreOffice has of its own)" % cid)
            continue
        n += 1
        ref, shown = exp["shown"][cid]["ref"], exp["shown"][cid]["shown"]
        url = uno.systemPathToFileUrl(os.path.abspath(os.path.join(d, cid + ".xlsx")))
        doc = desktop.loadComponentFromURL(url, "_blank", 0, (hidden,))
        try:
            doc.calculateAll()
            cell = doc.Sheets.getByIndex(0).getCellRangeByName(ref)
            err = cell.getError()
            rt = cell.FormulaResultType2
            rt = rt if isinstance(rt, int) else rt.value
            if err:
                got = "#" + cell.String.lstrip("#") if cell.String.startswith("#") else "Err:%d" % err
            elif rt in (1, "VALUE") or cell.Type.value == "VALUE":
                got = cell.Value
            else:
                got = cell.String
            f = cell.Formula
        finally:
            doc.close(True)
        if isinstance(shown, (int, float)) and isinstance(got, float):
            ok = abs(got - shown) <= 1e-5 * max(abs(shown), 1e-300)
        elif isinstance(shown, str) and shown.startswith("#"):
            ok = isinstance(got, str) and (got.startswith("#") or got.startswith("Err"))
        elif isinstance(got, str) and got.startswith("#NAME"):
            ok = bool(c["expect"].get("note"))   # Lantern's own function, said in the note
        else:
            ok = got == shown
        if ok:
            a += 1
            print("AGREE " + cid)
        else:
            print("DISAGREE %s LibreOffice shows %r for %s, Lantern showed %r [%s]" % (cid, got, f, shown, c["harm"]))
    print("%d cases: %d AGREE, %d DISAGREE" % (n, a, n - a))


main()
