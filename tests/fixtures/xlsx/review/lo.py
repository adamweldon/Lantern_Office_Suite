# lo.py -- LibreOffice as the oracle for the .xlsx review (make.py and replay.py use it).
# LibreOffice is started once, headless, with a profile of its own; each workbook is opened, every formula worked out
# again (calculateAll, so the values saved in the file count for nothing), and each cell's value, its text as shown
# (in its number format), its formula and its kind are handed back.
import os, socket, subprocess, tempfile, time, shutil
try:
    import uno
    from com.sun.star.beans import PropertyValue
except Exception:          # no LibreOffice on this machine: the callers say SKIP
    uno = None

ERRS = ("#DIV/0!", "#N/A", "#NAME?", "#NULL!", "#NUM!", "#REF!", "#VALUE!", "Err:502", "Err:504", "Err:508", "Err:511", "Err:522")


def _pv(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p


def col_name(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26); s = chr(65 + r) + s
    return s


class Office:
    def __init__(self):
        if uno is None: raise RuntimeError("python3-uno is not here")
        self.dir = tempfile.mkdtemp(prefix="lo_review_")
        s = socket.socket(); s.bind(("127.0.0.1", 0)); self.port = s.getsockname()[1]; s.close()
        self.proc = subprocess.Popen(["soffice", "--headless", "--invisible", "--nologo", "--norestore", "--nodefault",
                                      "-env:UserInstallation=file://" + os.path.join(self.dir, "profile"),
                                      "--accept=socket,host=127.0.0.1,port=%d;urp;" % self.port],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        local = uno.getComponentContext()
        res = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        self.ctx = None
        for _ in range(120):
            try:
                self.ctx = res.resolve("uno:socket,host=127.0.0.1,port=%d;urp;StarOffice.ComponentContext" % self.port); break
            except Exception:
                time.sleep(0.5)
        if self.ctx is None: raise RuntimeError("LibreOffice did not start")
        self.desk = self.ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", self.ctx)

    def close(self):
        try: self.desk.terminate()
        except Exception: pass
        try: self.proc.wait(10)
        except Exception: self.proc.kill()
        shutil.rmtree(self.dir, ignore_errors=True)

    def load(self, path):
        return self.desk.loadComponentFromURL(uno.systemPathToFileUrl(os.path.abspath(path)), "_blank", 0, (_pv("Hidden", True),))

    def read(self, path, recalc=True, max_rows=2100, max_cols=40):
        """{"sheets": [names], "cells": {sheet: {ref: {v, s, f, k, nf}}}} -- k is num, text, bool, err"""
        doc = self.load(path)
        if doc is None: return None
        try:
            if recalc: doc.calculateAll()
            nfs = doc.NumberFormats
            out = {"sheets": [], "cells": {}, "hidden_sheets": []}
            for i in range(doc.Sheets.Count):
                sh = doc.Sheets.getByIndex(i)
                out["sheets"].append(sh.Name)
                if not sh.IsVisible: out["hidden_sheets"].append(sh.Name)
                cur = sh.createCursor(); cur.gotoEndOfUsedArea(False)
                ra = cur.getRangeAddress()
                rows, cols = min(ra.EndRow + 1, max_rows), min(ra.EndColumn + 1, max_cols)
                cells = {}
                for r in range(rows):
                    for c in range(cols):
                        cell = sh.getCellByPosition(c, r)
                        t = cell.getType().value
                        if t == "EMPTY": continue
                        ref = col_name(c) + str(r + 1)
                        e = {"s": cell.getString()}
                        try:
                            fmt = nfs.getByKey(cell.NumberFormat); e["nf"] = fmt.FormatString; ftype = fmt.Type
                        except Exception:
                            ftype = 0
                        if t == "FORMULA":
                            e["f"] = cell.getFormula()
                            rt = cell.FormulaResultType2
                            if cell.getError():
                                e["k"] = "err"; e["v"] = e["s"]
                            elif rt == 2:
                                e["k"] = "text"; e["v"] = cell.getString()
                            else:
                                e["v"] = cell.getValue(); e["k"] = "bool" if (ftype & 1024) else "num"
                        elif t == "TEXT":
                            e["k"] = "text"; e["v"] = cell.getString()
                        else:
                            e["v"] = cell.getValue(); e["k"] = "bool" if (ftype & 1024) else "num"
                        if e["k"] == "bool": e["v"] = bool(e["v"])
                        cells[ref] = e
                out["cells"][sh.Name] = cells
            return out
        finally:
            doc.close(True)

    def convert(self, path, out_path, filt):
        """save a file in another form: filt is a LibreOffice filter name (Calc MS Excel 2007 XML, calc8, Text - txt - csv (StarCalc))"""
        doc = self.load(path)
        if doc is None: raise RuntimeError("LibreOffice could not open " + path)
        try:
            doc.calculateAll()
            doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(out_path)), (_pv("FilterName", filt), _pv("Overwrite", True)))
        finally:
            doc.close(True)
