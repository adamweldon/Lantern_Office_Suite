#!/usr/bin/env python3
# lo_recalc.py <dir> <cell> -- opens every .xlsx in <dir> in LibreOffice (headless, Python UNO), recalculates it, and
# prints one line of JSON: {case id: the cell's value, or {"err": "#N/A"} for an error}. Used by replay.js --lo.
import json, os, subprocess, sys, tempfile, time

import uno
from com.sun.star.beans import PropertyValue

ERRS = {532: "#DIV/0!", 519: "#VALUE!", 524: "#REF!", 525: "#NAME?", 503: "#NUM!", 32767: "#N/A", 502: "#VALUE!", 504: "#VALUE!"}


def prop(name, value):
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


def main():
    folder, ref = sys.argv[1], sys.argv[2]
    port = 2300 + os.getpid() % 500
    profile = tempfile.mkdtemp(prefix="lo_profile_")
    office = subprocess.Popen(["soffice", "--headless", "--invisible", "--nologo", "--norestore", "--nodefault",
                               "-env:UserInstallation=file://" + profile,
                               "--accept=socket,host=127.0.0.1,port=%d;urp;" % port],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ctx = None
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(120):
        try:
            ctx = resolver.resolve("uno:socket,host=127.0.0.1,port=%d;urp;StarOffice.ComponentContext" % port)
            break
        except Exception:
            time.sleep(0.5)
    if ctx is None:
        print(json.dumps({"__error__": "LibreOffice did not start"}))
        office.kill()
        return
    desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    out = {}
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".xlsx"):
            continue
        url = uno.systemPathToFileUrl(os.path.abspath(os.path.join(folder, name)))
        doc = desktop.loadComponentFromURL(url, "_blank", 0, (prop("Hidden", True),))
        try:
            doc.calculateAll()
            cell = doc.Sheets.getByIndex(0).getCellRangeByName(ref)
            err = cell.getError()
            t = cell.getType().value
            if err:
                val = {"err": ERRS.get(err, "#ERR%d" % err)}
            elif t == "EMPTY":
                val = None
            elif t == "VALUE":
                val = cell.getValue()
            elif t == "TEXT":
                val = cell.getString()
            else:  # FORMULA
                rt = cell.FormulaResultType2
                val = cell.getValue() if rt == 1 else cell.getString()
            out[name[:-5]] = val
        finally:
            doc.close(True)
    print(json.dumps(out))
    try:
        desktop.terminate()
    except Exception:
        pass
    office.wait(timeout=30)


main()
