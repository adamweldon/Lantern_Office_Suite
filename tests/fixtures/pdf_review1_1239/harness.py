# harness.py -- serves Lantern (the current src/lantern.inner.html, and optionally an older build) and the review PDFs,
# and runs probe.js on a PDF in Chromium (Playwright). Used by run_review.py.
import os, json, threading, http.server, socketserver
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MOUNTS = {"rv": HERE, "tr": os.path.join(ROOT, "tests", "fixtures", "text_reader"), "po": os.path.join(ROOT, "tests", "fixtures", "pdf_open"),
          "sh": os.path.join(ROOT, "tests", "fixtures", "sheets"), "docs": os.path.join(ROOT, "docs")}
PAGES = {"new": os.environ.get("LANTERN_NEW", os.path.join(ROOT, "src", "lantern.inner.html")), "old": os.environ.get("LANTERN_OLD", "")}
PROBE = open(os.path.join(HERE, "probe.js")).read()
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0].lstrip("/")
        if p in ("new.html", "old.html"): return PAGES[p[:3]]
        top, _, rest = p.partition("/")
        return os.path.join(MOUNTS.get(top, HERE), rest)
class Browser:
    def __init__(self, which=("new",)):
        self.srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H); self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.pw = sync_playwright().start(); self.b = self.pw.chromium.launch(); self.pages = {}; self.errs = {}
        for w in which:
            pg = self.b.new_page(); self.errs[w] = []
            pg.on("pageerror", lambda e, w=w: self.errs[w].append(str(e)[:300]))
            pg.goto("http://127.0.0.1:%d/%s.html" % (self.port, w))
            pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.pageDraw && Lantern.pdf.pageText)", timeout=90000)
            pg.set_default_timeout(60000)
            self.pages[w] = pg
    def probe(self, f, which="new", **k):
        k["f"] = "/" + f
        if isinstance(k.get("regions"), dict): k["regions"] = {str(a): b for a, b in k["regions"].items()}
        try: return self.pages[which].evaluate(PROBE, k)
        except Exception as e: return {"harnessError": str(e)[:500]}
    def close(self):
        self.b.close(); self.pw.stop(); self.srv.shutdown()
