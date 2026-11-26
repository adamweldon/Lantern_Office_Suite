# harness.py -- the review's shared parts: a tiny HTTP server (the build as index.html, these PDFs and the run's own
# folder beside it), Chromium through Playwright with Lantern loaded, and oracles that are not Lantern (qpdf, poppler,
# pypdf, tesseract, Pillow).
import os, sys, re, json, base64, subprocess, threading, http.server, socketserver, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

class Server:
    def __init__(self, site, dirs):
        site = os.path.abspath(site); dirs = [os.path.abspath(d) for d in dirs]
        class H(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
            def translate_path(self, p):
                p = p.split("?")[0]
                if p in ("/", "/index.html"): return site
                for d in dirs:
                    f = os.path.join(d, p.lstrip("/"))
                    if os.path.exists(f): return f
                return "/nonexistent"
        socketserver.TCPServer.allow_reuse_address = True
        self.srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H); self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
    def url(self, path=""): return "http://127.0.0.1:%d/%s" % (self.port, path)

PRELUDE = """
window.__b64 = function (b) { var s = ''; for (var j = 0; j < b.length; j += 8192) s += String.fromCharCode.apply(null, b.subarray(j, j + 8192)); return btoa(s); };
window.__open = async function (f, pw) { return Lantern.pdf.open(new Uint8Array(await (await fetch(f)).arrayBuffer()), pw ? {password: pw} : {}); };
window.__marks = async function (pdf, word, pages) { var P = Lantern.pdf, areas = []; for (var i = 0; i < pdf.count; i++) { if (pages && pages.indexOf(i) < 0) continue; P.redactMarks((await P.pageText(pdf, i)).boxes, word.toLowerCase()).forEach(function (r) { areas.push({page: i, rect: r}); }); } return areas; };
"""

class Browser:
    def __init__(self, site, dirs, hash_=""):
        self.server = Server(site, dirs)
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch()
        self.ctx = self.b.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900})
        self.pg = self.ctx.new_page(); self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append(str(e)[:400]))
        self.answers = []
        self.pg.on("dialog", self._dialog)
        self.pg.goto(self.server.url("index.html" + hash_))
        self.pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.open)", timeout=90000)
        self.pg.evaluate("(function () {" + PRELUDE + "})()")
    def _dialog(self, d):
        a = self.answers.pop(0) if self.answers else ""
        try:
            if d.type in ("prompt", "confirm"): d.accept(a) if d.type == "prompt" else (d.dismiss() if a == "__no" else d.accept())
            else: d.accept()
        except Exception: pass
    def js(self, body, arg=None, timeout=180000):
        self.pg.set_default_timeout(timeout)
        return self.pg.evaluate("async (a) => { var P = Lantern.pdf; " + body + " }", arg)
    def close(self):
        self.b.close(); self.pw.stop(); self.server.srv.shutdown()

def save_b64(b64, path):
    open(path, "wb").write(base64.b64decode(b64)); return path

def sh(*a, **k):
    r = subprocess.run(list(a), capture_output=True, **k)
    return r

def qcheck(path, pw=None):
    args = ["qpdf"] + (["--password=" + pw] if pw else []) + ["--check", path]
    r = subprocess.run(args, capture_output=True, text=True, timeout=120)
    return r.returncode in (0, 3), (r.stdout[-400:] + r.stderr[-400:])

def qdf(path, pw=None):
    args = ["qpdf"] + (["--password=" + pw] if pw else []) + ["--qdf", "--object-streams=disable", "--decode-level=all", path, "-"]
    return subprocess.run(args, capture_output=True, timeout=120).stdout

def ptext(path, page=None, pw=None, raw=False):
    a = ["pdftotext"] + (["-upw", pw] if pw else []) + (["-f", str(page), "-l", str(page)] if page else []) + (["-raw"] if raw else []) + [path, "-"]
    return subprocess.run(a, capture_output=True, text=True, timeout=120).stdout

def bbox(path, page=1, pw=None):
    """poppler's words: [(word, xMin, yMin, xMax, yMax)] in the page as shown (origin top left, y down, in points)"""
    a = ["pdftotext"] + (["-upw", pw] if pw else []) + ["-f", str(page), "-l", str(page), "-bbox", "-cropbox", path, "-"]
    h = subprocess.run(a, capture_output=True, text=True, timeout=120).stdout
    pg = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', h)
    import html as _h
    words = [(_h.unescape(w), float(x0), float(y0), float(x1), float(y1)) for x0, y0, x1, y1, w in re.findall(r'xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">([^<]*)<', h)]
    return words, (float(pg.group(1)), float(pg.group(2))) if pg else (0, 0)

def render(path, out_base, page=1, dpi=72, pw=None):
    a = ["pdftoppm"] + (["-upw", pw] if pw else []) + ["-r", str(dpi), "-f", str(page), "-l", str(page), "-png", "-singlefile", path, out_base]
    subprocess.run(a, capture_output=True, timeout=120)
    return out_base + ".png"

def ocr_words(png):
    r = subprocess.run(["tesseract", png, "-", "--psm", "11"], capture_output=True, text=True, timeout=120)
    return r.stdout

def pypdf_text(path, pw=None):
    code = "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nif r.is_encrypted: r.decrypt(sys.argv[2])\nprint('\\f'.join((p.extract_text() or '') for p in r.pages))"
    r = subprocess.run(["python3", "-c", code, path, pw or ""], capture_output=True, text=True, timeout=120)
    return r.stdout + ("\nERR " + r.stderr[-300:] if r.returncode else "")

def to_user(box, rot, dx, dy):
    """a point as shown (poppler's, origin top left) -> the page's own space, for a page with this (crop) box and turn"""
    x0, y0, x1, y1 = box
    if rot == 90: return (x0 + dy, y0 + dx)
    if rot == 180: return (x1 - dx, y0 + dy)
    if rot == 270: return (x1 - dy, y1 - dx)
    return (x0 + dx, y1 - dy)

def shown_rect_to_user(box, rot, r):
    a = to_user(box, rot, r[0], r[1]); b = to_user(box, rot, r[2], r[3])
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])]

def page_info(path, i=0, pw=None):
    code = ("import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nif r.is_encrypted: r.decrypt(sys.argv[3])\np=r.pages[int(sys.argv[2])]\n"
            "print(json.dumps({'rot': int(p.get('/Rotate',0) or 0)%360, 'crop':[float(x) for x in p.cropbox], 'media':[float(x) for x in p.mediabox]}))")
    r = subprocess.run(["python3", "-c", code, path, str(i), pw or ""], capture_output=True, text=True, timeout=120)
    return json.loads(r.stdout)

class Checks:
    def __init__(self, log=None):
        self.n = 0; self.bad = []; self.log = log
    def __call__(self, name, ok, info=""):
        self.n += 1
        line = ("PASS  " if ok else "FAIL  ") + name + ("" if ok else "  " + str(info)[:700])
        print(line, flush=True)
        if self.log: self.log.write(line + "\n"); self.log.flush()
        if not ok: self.bad.append((name, str(info)[:2000]))
        return ok

def reach(path, i, pw=None):
    """every string and every unpacked stream reachable from page i (not through /Parent): what that page holds"""
    import pikepdf
    out = []; seen = set()
    with pikepdf.open(path, password=pw or "") as d:
        def walk(o, depth=0):
            if depth > 60: return
            if isinstance(o, pikepdf.Object) and o.is_indirect:
                k = o.objgen
                if k in seen: return
                seen.add(k)
            if isinstance(o, pikepdf.Stream):
                try: out.append(o.read_bytes())
                except Exception: out.append(o.read_raw_bytes())
                for k2, v in o.stream_dict.items():
                    if k2 not in ("/Parent", "/P"): walk(v, depth + 1)
            elif isinstance(o, pikepdf.Dictionary):
                for k2, v in o.items():
                    if k2 in ("/Parent", "/P"): continue
                    walk(v, depth + 1)
            elif isinstance(o, pikepdf.Array):
                for v in o: walk(v, depth + 1)
            elif isinstance(o, pikepdf.String):
                out.append(bytes(o))
                try: out.append(str(o).encode("utf-8", "ignore"))
                except Exception: pass
        walk(d.pages[i].obj)
    return b"\n".join(out)
