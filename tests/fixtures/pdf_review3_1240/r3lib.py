# r3lib.py -- review 3 of 1.24.40's PDF tools: the shared parts. A small HTTP server (a build served as index.html, the
# fixture folders beside it), Chromium through Playwright with Lantern loaded, and oracles that are not Lantern: poppler
# (pdftotext, -bbox, pdftoppm), qpdf, pypdf, pikepdf, pdfminer, tesseract, Pillow.
import os, sys, re, json, base64, subprocess, threading, http.server, socketserver, html as _html, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SCR = "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad"
OUT = os.environ.get("R3OUT", os.path.join(SCR, "r3out"))
os.makedirs(OUT, exist_ok=True)

class Server:
    def __init__(self, site, dirs):
        site = os.path.abspath(site); dirs = [os.path.abspath(d) for d in dirs]
        class H(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
            def translate_path(self, p):
                p = p.split("?")[0].split("#")[0]
                if p in ("/", "/index.html"): return site
                from urllib.parse import unquote
                p = unquote(p)
                if p.startswith("/abs/"):
                    f = p[4:]
                    return f if os.path.exists(f) else "/nonexistent"
                for d in dirs:
                    f = os.path.join(d, p.lstrip("/"))
                    if os.path.exists(f): return f
                return "/nonexistent"
        socketserver.TCPServer.allow_reuse_address = True
        self.srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H); self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
    def url(self, path=""): return "http://127.0.0.1:%d/%s" % (self.port, path)

PRELUDE = r"""
window.__b64 = function (b) { var s = ''; for (var j = 0; j < b.length; j += 8192) s += String.fromCharCode.apply(null, b.subarray(j, j + 8192)); return btoa(s); };
window.__u8 = function (b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
window.__open = async function (f, pw) { var u = f.charAt(0) === '/' ? '/abs' + f : f; return Lantern.pdf.open(new Uint8Array(await (await fetch(u)).arrayBuffer()), pw ? {password: pw} : {}); };
window.__marks = async function (pdf, word, pages, grouped) { var P = Lantern.pdf, out = []; for (var i = 0; i < pdf.count; i++) { if (pages && pages.indexOf(i) < 0) continue;
  var bx = (await P.pageText(pdf, i)).boxes; P.redactMarks(bx, word, grouped).forEach(function (r) { out.push({page: i, rect: r}); }); } return out; };
window.__png = function (cv) { return cv.toDataURL('image/png').split(',')[1]; };
"""

_PW = [None]
class Browser:
    def __init__(self, site, dirs, viewport=(1280, 900)):
        from playwright.sync_api import sync_playwright
        self.server = Server(site, dirs)
        if _PW[0] is None: _PW[0] = sync_playwright().start()
        self.pw = _PW[0]
        self.b = self.pw.chromium.launch()
        self.ctx = self.b.new_context(accept_downloads=True, viewport={"width": viewport[0], "height": viewport[1]})
        self.pg = self.ctx.new_page(); self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append(str(e)[:400]))
        self.answers = []
        self.pg.on("dialog", self._dialog)
        self.pg.goto(self.server.url("index.html"))
        self.pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.open)", timeout=120000)
        self.pg.evaluate("(function () {" + PRELUDE + "})()")
    def _dialog(self, d):
        try:
            if d.type == "prompt": d.accept(self.answers.pop(0) if self.answers else "")
            else: d.accept()
        except Exception: pass
    def js(self, body, arg=None, timeout=240000):
        self.pg.set_default_timeout(timeout)
        return self.pg.evaluate("async (a) => { var P = Lantern.pdf; " + body + " }", arg)
    def close(self):
        try: self.b.close()
        except Exception: pass
        self.server.srv.shutdown()

def pw_stop():
    if _PW[0] is not None:
        try: _PW[0].stop()
        except Exception: pass
        _PW[0] = None

def save_b64(b64, path):
    open(path, "wb").write(base64.b64decode(b64)); return path

def run(args, timeout=180, text=True, inp=None):
    try:
        return subprocess.run(args, capture_output=True, text=text, timeout=timeout, input=inp, **({"errors": "replace"} if text else {}))
    except subprocess.TimeoutExpired:
        class R: stdout = "" if text else b""; stderr = "TIMEOUT"; returncode = -9
        return R()

def qcheck(path):
    r = run(["qpdf", "--check", path])
    return r.returncode in (0, 3), (r.stdout[-300:] + r.stderr[-300:])

def qdf(path):
    r = run(["qpdf", "--qdf", "--object-streams=disable", "--decode-level=all", path, "-"], text=False)
    return r.stdout

def npages(path):
    r = run(["qpdf", "--show-npages", path])
    try: return int(r.stdout.strip())
    except Exception: return 0

def ptext(path, page=None, raw=False, layout=False):
    a = ["pdftotext", "-enc", "UTF-8"] + (["-f", str(page), "-l", str(page)] if page else []) + (["-raw"] if raw else []) + (["-layout"] if layout else []) + [path, "-"]
    return run(a).stdout

def bbox(path, page=1):
    """poppler's words on a page as shown: [(word, xMin, yMin, xMax, yMax)] (origin top left, y down, points), and the page size"""
    h = run(["pdftotext", "-enc", "UTF-8", "-f", str(page), "-l", str(page), "-bbox", "-cropbox", path, "-"]).stdout
    pg = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', h)
    ws = [(_html.unescape(w), float(x0), float(y0), float(x1), float(y1)) for x0, y0, x1, y1, w in re.findall(r'xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">([^<]*)<', h)]
    return ws, ((float(pg.group(1)), float(pg.group(2))) if pg else (0, 0))

def bbox_lines(path, page=1):
    """poppler's lines (from -bbox-layout): [[word, ...], ...] in its reading order"""
    h = run(["pdftotext", "-enc", "UTF-8", "-f", str(page), "-l", str(page), "-bbox-layout", path, "-"]).stdout
    out = []
    for ln in re.findall(r"<line[^>]*>(.*?)</line>", h, re.S):
        out.append([_html.unescape(w) for w in re.findall(r"<word[^>]*>([^<]*)</word>", ln)])
    return out

def render(path, out_base, page=1, dpi=72, gray=True):
    a = ["pdftoppm", "-cropbox"] + (["-gray"] if gray else []) + ["-r", str(dpi), "-f", str(page), "-l", str(page), "-png", "-singlefile", path, out_base]
    run(a)
    return out_base + ".png"

def ocr(png, lang="eng", psm="11"):
    r = run(["tesseract", png, "-", "-l", lang, "--psm", psm])
    return r.stdout

def pypdf_text(path):
    code = "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint('\\f'.join((p.extract_text() or '') for p in r.pages))"
    r = run([sys.executable, "-I", "-c", code, path])
    return r.stdout + ("\nERR " + r.stderr[-300:] if r.returncode else "")

def pdfminer_text(path):
    code = "import sys\nfrom pdfminer.high_level import extract_text\nprint(extract_text(sys.argv[1]))"
    r = run([sys.executable, "-I", "-c", code, path], timeout=240)
    return r.stdout + ("\nERR " + r.stderr[-300:] if r.returncode else "")

def page_info(path, i=0):
    import pikepdf
    with pikepdf.open(path) as d:
        p = d.pages[i]
        rot = int(p.obj.get("/Rotate", 0)) % 360
        mb = [float(x) for x in p.mediabox]
        cb = [float(x) for x in (p.obj.get("/CropBox") or p.mediabox)]
        cb = [max(cb[0], mb[0]), max(cb[1], mb[1]), min(cb[2], mb[2]), min(cb[3], mb[3])]
        return {"rot": rot, "crop": cb, "media": mb}

def to_user(box, rot, dx, dy):
    """a point as poppler shows it (origin top left of the shown page) -> the page's own space"""
    x0, y0, x1, y1 = box
    if rot == 90: return (x0 + dy, y0 + dx)
    if rot == 180: return (x1 - dx, y0 + dy)
    if rot == 270: return (x1 - dy, y1 - dx)
    return (x0 + dx, y1 - dy)

def from_user(box, rot, ux, uy):
    x0, y0, x1, y1 = box
    if rot == 90: return (uy - y0, ux - x0)
    if rot == 180: return (x1 - ux, uy - y0)
    if rot == 270: return (y1 - uy, x1 - ux)
    return (ux - x0, y1 - uy)

def shown_to_user_rect(box, rot, r):
    a = to_user(box, rot, r[0], r[1]); b = to_user(box, rot, r[2], r[3])
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])]

def user_to_shown_rect(box, rot, r):
    a = from_user(box, rot, r[0], r[1]); b = from_user(box, rot, r[2], r[3])
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])]

def norm(s):
    return unicodedata.normalize("NFKC", s)

def fold(s):
    """a fair case fold for 'is it still there': NFKC, casefold, final sigma as sigma, Turkish dotted/dotless i as i"""
    s = norm(s).replace("İ", "I").replace("ı", "i").replace("̇", "")
    return s.casefold().replace("ς", "σ")

def squeeze(s): return re.sub(r"\s+", "", fold(s))

def png_gray(path):
    from PIL import Image
    return Image.open(path).convert("L")

def ink_cover(png_copy, shown_rect, dpi, png_orig=None, thr=60):
    """the share of the word's box (as shown, points) that is black (< thr) in the copy; where an original is given, only
    its inked pixels (the letters) are counted: are the letters' pixels black now?"""
    im = png_gray(png_copy); s = dpi / 72.0
    x0, y0, x1, y1 = [int(round(v * s)) for v in shown_rect]
    x0 = max(0, x0); y0 = max(0, y0); x1 = min(im.width, x1); y1 = min(im.height, y1)
    if x1 <= x0 or y1 <= y0: return None, 0
    c = im.crop((x0, y0, x1, y1)).load()
    o = png_gray(png_orig).crop((x0, y0, x1, y1)).load() if png_orig else None
    n = k = 0
    for yy in range(y1 - y0):
        for xx in range(x1 - x0):
            if o is not None and o[xx, yy] > 160: continue   # only where the original had ink (a letter)
            n += 1
            if c[xx, yy] < thr: k += 1
    return (k / n if n else None), n

class Cases:
    def __init__(self, path):
        self.path = path; self.rows = []
        self.log = open(path.replace(".json", ".log"), "w")
    def __call__(self, group, file, check, ok, expected="", got=""):
        row = {"group": group, "file": file, "check": check, "expected": str(expected)[:800], "got": str(got)[:2000], "pass": bool(ok)}
        self.rows.append(row)
        line = ("PASS  " if ok else "FAIL  ") + "[%s] %s: %s" % (group, file, check) + ("" if ok else "  | expected: %s | got: %s" % (row["expected"][:240], row["got"][:500]))
        print(line, flush=True); self.log.write(line + "\n"); self.log.flush()
        if len(self.rows) % 20 == 0: self.save()
        return ok
    def save(self):
        json.dump(self.rows, open(self.path, "w"), indent=1, ensure_ascii=False)

# ---------------------------------------------------------------------------------------------------------------------
# where poppler shows a word: lines of (word, box) from -bbox-layout; a target found across words of a line (letters
# poppler splits apart), and across a line break at a hyphen (- U+2010 U+00AD) when neither half holds it
# ---------------------------------------------------------------------------------------------------------------------
HYPH = "-‐­‑"
def layout_lines(path, page=1):
    h = run(["pdftotext", "-enc", "UTF-8", "-f", str(page), "-l", str(page), "-bbox-layout", "-cropbox", path, "-"]).stdout
    out = []
    for blk in re.findall(r"<block[^>]*>(.*?)</block>", h, re.S):
        for ln in re.findall(r"<line[^>]*>(.*?)</line>", blk, re.S):
            ws = [(_html.unescape(t), (float(a), float(b), float(c), float(d))) for a, b, c, d, t in
                  re.findall(r'<word xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">([^<]*)</word>', ln)]
            if ws: out.append(ws)
    return out

def union(bs):
    return (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))

def locate(path, page, target, lines=None):
    """[[box, ...], ...]: each place poppler shows target (folded, spaces ignored), as the boxes of the words it spans"""
    t = squeeze(target)
    lines = lines if lines is not None else layout_lines(path, page)
    occ = []
    # (poppler's lines on one baseline joined into rows, left to right: a comb's digits each come as a line of their own)
    rows = []
    for ln in lines:
        y0, y1 = min(b[1] for _, b in ln), max(b[3] for _, b in ln)
        for r_ in rows:
            if abs(r_[0] - y0) < 1.5 and abs(r_[1] - y1) < 1.5: r_[2].extend(ln); break
        else: rows.append([y0, y1, list(ln)])
    rows = [sorted(r_[2], key=lambda z: z[1][0]) for r_ in rows]
    for ln in rows:
        s = ""; owner = []
        for k, (wd, bx) in enumerate(ln):
            f = squeeze(wd)
            s += f; owner += [k] * len(f)
        at = s.find(t)
        while at >= 0 and t:
            ks = sorted(set(owner[at:at + len(t)]))
            occ.append([union([ln[k][1] for k in ks])])
            at = s.find(t, at + len(t))
    # a break at a hyphen at a line's end
    for a, b in zip(lines, lines[1:]):
        last, first = a[-1][0], b[0][0]
        if last and last[-1] in HYPH and len(last) > 1:
            j = squeeze(last.rstrip(HYPH)) + squeeze(first)
            if t in j and t not in squeeze(last) and t not in squeeze(first):
                occ.append([a[-1][1], b[0][1]])
    return occ

def all_words(path, page=1):
    return [w for ln in layout_lines(path, page) for w in ln]

def strings_in(qdf_bytes):
    """every string a content stream shows (Tj, TJ, ' and \"), joined in order: what the file's bytes say as text"""
    s = qdf_bytes.decode("latin-1")
    out = []
    for m in re.finditer(r"\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>(?!>)", s):
        tok = m.group(0)
        if tok.startswith("("):
            body = tok[1:-1]
            body = re.sub(r"\\([0-7]{1,3})", lambda x: chr(int(x.group(1), 8) & 255), body)
            body = re.sub(r"\\(.)", lambda x: {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f"}.get(x.group(1), x.group(1)), body)
            out.append(body)
        else:
            hx = re.sub(r"\s", "", tok[1:-1])
            if len(hx) % 2: hx += "0"
            try: out.append(bytes.fromhex(hx).decode("latin-1"))
            except Exception: pass
    return "".join(out)

def leaks_in_bytes(qdf_bytes, target):
    """the target in the file's bytes: as latin-1 or UTF-16BE (hex or raw), or as the letters its strings show in order"""
    t = squeeze(target)
    raw = qdf_bytes.decode("latin-1")
    found = []
    if t in squeeze(raw): found.append("latin-1 text")
    u16 = target.encode("utf-16-be")
    if u16 in qdf_bytes: found.append("UTF-16BE bytes")
    if u16.hex().upper() in raw.upper().replace("\n", ""): found.append("UTF-16BE hex")
    try:
        if t in squeeze(qdf_bytes.decode("utf-8", "ignore")): found.append("UTF-8 text")
    except Exception: pass
    if t in squeeze(strings_in(qdf_bytes)): found.append("shown strings in order")
    return found

def lev(a, b):
    if abs(len(a) - len(b)) > 2: return 9
    p = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        c = [i]
        for j, cb in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (ca != cb)))
        p = c
    return p[-1]

def ocr_has(text, target):
    """the target in OCR's words: exactly (folded) or, for 6 letters and more, one letter off"""
    t = squeeze(target)
    toks = [squeeze(x) for x in re.split(r"[\s,.;:()\[\]]+", text) if x]
    if t in squeeze(text): return "exact"
    if len(t) >= 6:
        for x in toks:
            for k in range(0, max(1, len(x) - len(t) + 1)):
                if lev(x[k:k + len(t)], t) <= 1: return "near: " + x
    return None

def locate_chars(path, page, target):
    """for slanted text, where poppler's words are fragments: pdfplumber's letters in drawing order, each its own box
    (shown space of an unturned, uncropped page)"""
    code = ("import sys,json,pdfplumber\np=pdfplumber.open(sys.argv[1]).pages[int(sys.argv[2])]\n"
            "print(json.dumps([[c['text'],c['x0'],c['top'],c['x1'],c['bottom']] for c in p.chars]))")
    r = run([sys.executable, "-I", "-c", code, path, str(page - 1)], timeout=240)
    try: ch = json.loads(r.stdout)
    except Exception: return []
    s = "".join(fold(c[0]) for c in ch); t = fold(target); out = []
    at = s.find(t)
    while at >= 0 and t:
        out.append([tuple(c[1:]) for c in ch[at:at + len(t)]]); at = s.find(t, at + len(t))
    return out
