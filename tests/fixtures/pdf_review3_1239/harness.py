# harness.py -- third review of 1.24.39's PDF reading. Serves Lantern (src/lantern.inner.html as "new", and the
# 1.24.38 build as "old" when LANTERN_OLD names it) and this folder's PDFs, and runs probe.js (or any script) on a PDF
# in Chromium (Playwright). After pdf_review2_1239/harness.py, with page restarts on a hang and a per-call timeout.
import os, json, threading, http.server, socketserver, subprocess
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PAGES = {"new": os.environ.get("LANTERN_NEW", os.path.join(ROOT, "src", "lantern.inner.html")), "old": os.environ.get("LANTERN_OLD", "")}
PROBE = open(os.path.join(HERE, "probe.js")).read()
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0].lstrip("/")
        if p in ("new.html", "old.html"): return PAGES[p[:3]]
        if p.startswith("fx/"): return os.path.join(ROOT, "tests", "fixtures", p[3:])   # the other reviews' and tests' PDFs (the sweep)
        return os.path.join(HERE, p)
class Browser:
    def __init__(self, which=("new",)):
        self.srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H); self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.pw = sync_playwright().start(); self.b = self.pw.chromium.launch(); self.pages = {}; self.errs = {}
        for w in which: self.page(w)
    def page(self, w):
        pg = self.b.new_page(); self.errs.setdefault(w, [])
        pg.on("pageerror", lambda e, w=w: self.errs[w].append(str(e)[:300]))
        pg.goto("http://127.0.0.1:%d/%s.html" % (self.port, w))
        pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.pageDraw && Lantern.pdf.pageText)", timeout=120000)
        pg.set_default_timeout(60000)
        self.pages[w] = pg
        return pg
    def _call(self, which, fn, timeout):
        pg = self.pages[which]; pg.set_default_timeout(timeout)
        try: return fn(pg)
        except Exception as e:
            # a page that hung or died: a new one, so the next case is not spoiled
            try: pg.close()
            except Exception: pass
            self.page(which)
            return {"harnessError": str(e)[:300]}
    def probe(self, f, which="new", timeout=60000, **k):
        k["f"] = "/" + f
        if isinstance(k.get("regions"), dict): k["regions"] = {str(a): b for a, b in k["regions"].items()}
        return self._call(which, lambda pg: pg.evaluate(PROBE, k), timeout)
    def run(self, js, arg, which="new", timeout=60000):
        return self._call(which, lambda pg: pg.evaluate(js, arg), timeout)
    def close(self):
        self.b.close(); self.pw.stop(); self.srv.shutdown()

# poppler as an oracle: a page drawn at 72 dpi (one pixel a point), measured in PDF points as probe.js measures Lantern
def poppler_regions(path, page, regions, pw=None, dpi=72):
    from PIL import Image
    out = os.path.join(HERE, "_pop")
    args = ["pdftoppm", "-r", str(dpi), "-f", str(page + 1), "-l", str(page + 1), "-png", "-singlefile"]
    if pw: args += ["-upw", pw]
    subprocess.run(args + [path, out], check=True, capture_output=True)
    im = Image.open(out + ".png").convert("RGB"); W, Hh = im.size; px = im.load(); res = []; s = dpi / 72.0
    for r in regions:
        x0, x1 = int(round(r[0] * s)), int(round(r[2] * s)); y0, y1 = int(round(Hh - r[3] * s)), int(round(Hh - r[1] * s))
        n = c = white = 0; R = G = B = 0
        for y in range(max(0, y0), min(Hh, y1)):
            for x in range(max(0, x0), min(W, x1)):
                a, b, cc = px[x, y]; n += 1; R += a; G += b; B += cc
                if a + b + cc < 300: c += 1
                if a > 245 and b > 245 and cc > 245: white += 1
        n = max(1, n)
        res.append({"dark": round(1000 * c / n) / 10, "nonwhite": round(1000 * (n - white) / n) / 10, "rgb": [round(R / n), round(G / n), round(B / n)]})
    os.remove(out + ".png")
    return res
