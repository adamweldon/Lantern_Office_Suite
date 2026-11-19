# lo.py -- LibreOffice (python3-uno) for the third Excel review: open a workbook, work it out again, and read back
# each cell's value, shown text and formula. Used by build.py (the oracle for the guard) and replay.py (saved files).
#   import lo; with lo.Office() as o: o.cells(path, ["A1", "Data!B2"]) -> {ref: {"v", "s", "f", "kind", "err"}}
import os, subprocess, tempfile, time, shutil, uuid
try:
    import uno
    from com.sun.star.beans import PropertyValue
except Exception:
    uno = None


def _pv(name, value):
    p = PropertyValue(); p.Name = name; p.Value = value; return p


class Office:
    def __init__(self):
        if uno is None: raise RuntimeError("python3-uno is not installed")
        self.dir = tempfile.mkdtemp(prefix="lo_review3_")
        self.pipe = "review3_" + uuid.uuid4().hex[:8]
        prof = "file://" + os.path.join(self.dir, "profile")
        self.proc = subprocess.Popen(["soffice", "--headless", "--invisible", "--norestore", "--nologo", "--nodefault",
                                      "-env:UserInstallation=" + prof, "--accept=pipe,name=%s;urp;" % self.pipe],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ctx = uno.getComponentContext()
        res = ctx.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", ctx)
        last = None
        for _ in range(120):
            try:
                self.ctx = res.resolve("uno:pipe,name=%s;urp;StarOffice.ComponentContext" % self.pipe); break
            except Exception as e:
                last = e; time.sleep(0.5)
        else:
            raise RuntimeError("LibreOffice did not start: %s" % last)
        self.desk = self.ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", self.ctx)

    def __enter__(self): return self

    def __exit__(self, *a): self.close()

    def close(self):
        try: self.desk.terminate()
        except Exception: pass
        try: self.proc.wait(10)
        except Exception: self.proc.kill()
        shutil.rmtree(self.dir, ignore_errors=True)

    def load(self, path):
        url = uno.systemPathToFileUrl(os.path.abspath(path))
        return self.desk.loadComponentFromURL(url, "_blank", 0, (_pv("Hidden", True), _pv("ReadOnly", True)))

    def cells(self, path, refs, recalc=True):
        doc = self.load(path)
        if doc is None: return {"__error__": "LibreOffice could not open it"}
        try:
            if recalc: doc.calculateAll()
            sheets = doc.Sheets
            out = {"__sheets__": list(sheets.ElementNames)}
            for ref in refs:
                a1 = ref
                if "!" in ref:
                    name, a1 = ref.rsplit("!", 1)
                    if name.startswith("'"): name = name[1:-1].replace("''", "'")
                    if not sheets.hasByName(name): out[ref] = {"missing_sheet": name}; continue
                    sh = sheets.getByName(name)
                else:
                    sh = sheets.getByIndex(0)
                c = sh.getCellRangeByName(a1)
                t = c.Type.value
                err = c.getError()
                o = {"s": c.String, "f": c.Formula if t == "FORMULA" else None, "kind": t}
                if err: o["err"] = err; o["v"] = c.String
                elif t == "FORMULA":
                    rt = c.FormulaResultType2
                    o["v"] = c.String if rt == 2 else c.Value
                elif t == "VALUE": o["v"] = c.Value
                elif t == "TEXT": o["v"] = c.String
                else: o["v"] = None
                out[ref] = o
            return out
        finally:
            doc.close(True)
