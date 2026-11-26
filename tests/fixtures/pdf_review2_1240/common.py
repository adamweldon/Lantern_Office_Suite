# common.py -- review 2's shared parts on top of harness.py (copied from review 1): the case log written to cases.json,
# poppler's words found however poppler splits them, ink coverage between two pictures, page-space conversions.
import os, re, json, subprocess, html as _h
_run = subprocess.run
def _safe_run(*a, **k):
    """subprocess.run, but a program that does not end in its time gives empty output instead of stopping the review"""
    try: return _run(*a, **k)
    except subprocess.TimeoutExpired as e:
        return subprocess.CompletedProcess(e.cmd, 124, "" if k.get("text") else b"", "" if k.get("text") else b"")
subprocess.run = _safe_run
from harness import *
from PIL import Image

_PW = [None]
class Browser2(Browser):
    """review 1's Browser, sharing one Playwright between the two builds"""
    def __init__(self, site, dirs, hash_=""):
        self.server = Server(site, dirs)
        if _PW[0] is None: _PW[0] = sync_playwright().start()
        self.pw = _PW[0]
        self.b = self.pw.chromium.launch()
        self.ctx = self.b.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900})
        self.pg = self.ctx.new_page(); self.errs = []
        self.pg.on("pageerror", lambda e: self.errs.append(str(e)[:400]))
        self.answers = []
        self.pg.on("dialog", self._dialog)
        self.pg.goto(self.server.url("index.html" + hash_))
        self.pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.open)", timeout=90000)
        self.pg.evaluate("(function () {" + PRELUDE + "})()")
    def close(self):
        self.b.close(); self.server.srv.shutdown()

class Cases:
    def __init__(self, path):
        self.path = path; self.rows = []; self.log = open(path.replace(".json", ".log"), "w")
    def __call__(self, group, file, check, ok, expected="", got=""):
        row = {"group": group, "file": file, "check": check, "expected": str(expected)[:600], "got": str(got)[:1500], "pass": bool(ok)}
        self.rows.append(row)
        line = ("PASS  " if ok else "FAIL  ") + "[%s] %s: %s" % (group, file, check) + ("" if ok else "  | expected: %s | got: %s" % (row["expected"][:200], row["got"][:400]))
        print(line, flush=True); self.log.write(line + "\n"); self.log.flush()
        self.save()
        return ok
    def save(self):
        json.dump(self.rows, open(self.path, "w"), indent=1, ensure_ascii=False)

def words(path, page=1, pw=None):
    """poppler's words of a page as shown: [(text, x0, y0, x1, y1)], origin top left, y down, points"""
    a = ["pdftotext"] + (["-upw", pw] if pw else []) + ["-f", str(page), "-l", str(page), "-bbox", "-cropbox", path, "-"]
    h = subprocess.run(a, capture_output=True, text=True, timeout=120).stdout
    pg = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', h)
    ws = [(_h.unescape(w), float(x0), float(y0), float(x1), float(y1)) for x0, y0, x1, y1, w in re.findall(r'xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">([^<]*)<', h)]
    return ws, ((float(pg.group(1)), float(pg.group(2))) if pg else (0, 0))

def norm(s): return re.sub(r"\s+", "", s).lower()

def locate(ws, target):
    """where poppler shows a target, in poppler's word order; failing that, in each line's order left to right"""
    r = _locate(ws, target)
    if r: return r
    ws2 = sorted(ws, key=lambda w: (round((w[2] + w[4]) / 2 / 4), w[1]))
    return _locate(ws2, target)

def _locate(ws, target):
    """where poppler shows a target: runs of consecutive words (in poppler's order) whose letters, joined, hold it --
    a word poppler splits into letters (letter-spaced) is found too. -> [box]"""
    t = norm(target); out = []
    for i in range(len(ws)):
        acc = ""; box = None
        for j in range(i, min(len(ws), i + 40)):
            w = ws[j]
            if j > i:
                p = ws[j - 1]
                # the same line: poppler's boxes overlap across the line
                if min(p[4], w[4]) - max(p[2], w[2]) < 0.3 * min(p[4] - p[2], w[4] - w[2]) and min(p[3], w[3]) - max(p[1], w[1]) < 0.3 * min(p[3] - p[1], w[3] - w[1]): break
            acc += norm(w[0]); box = list(w[1:]) if box is None else [min(box[0], w[1]), min(box[1], w[2]), max(box[2], w[3]), max(box[3], w[4])]
            if t in acc:
                if j == i or t not in norm(ws[j][0]) and t not in acc[len(norm(ws[i][0])):]:
                    out.append(box)
                break
            if not t.startswith(acc) and not any(t.startswith(acc[k:]) for k in range(len(acc))): break
    # one box per place
    res = []
    for b in out:
        if not any(abs(b[0] - r[0]) < 1 and abs(b[1] - r[1]) < 1 for r in res): res.append(b)
    return res

def to_shown(box, rot, ux, uy):
    x0, y0, x1, y1 = box
    if rot == 90: return (uy - y0, ux - x0)
    if rot == 180: return (x1 - ux, uy - y0)
    if rot == 270: return (y1 - uy, x1 - ux)
    return (ux - x0, y1 - uy)

def user_rect_to_shown(box, rot, r):
    a = to_shown(box, rot, r[0], r[1]); b = to_shown(box, rot, r[2], r[3])
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])]

def render(path, out_base, page=1, dpi=72, pw=None):
    a = ["pdftoppm"] + (["-upw", pw] if pw else []) + ["-r", str(dpi), "-f", str(page), "-l", str(page), "-cropbox", "-png", "-singlefile", path, out_base]
    subprocess.run(a, capture_output=True, timeout=120)
    return out_base + ".png"

def ink_cover(orig_png, red_png, box, dpi):
    """how much of the place poppler showed a word (its box, 1 pt in from each side) is black in the copy's picture:
    a word taken out is under a box of black; a word left is mostly white paper (dark text on white stays white around
    its letters). -> (share of the box's pixels darker than 90 in the copy, pixels in the box)"""
    Bm = Image.open(red_png).convert("L")
    k = dpi / 72.0
    x0, y0, x1, y1 = [int(round(v * k)) for v in (box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 1)]
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(Bm.size[0], x1), min(Bm.size[1], y1)
    if x1 <= x0 or y1 <= y0: return None, 0
    px = list(Bm.crop((x0, y0, x1, y1)).getdata())
    return sum(1 for v in px if v < 90) / float(len(px)), len(px)

def ocr(png, lang="eng", rotations=(0, 90, 180, 270)):
    im = Image.open(png); txt = ""
    for ang in rotations:
        f = png[:-4] + "_r%d.png" % ang
        (im.rotate(ang, expand=True) if ang else im).save(f)
        r = subprocess.run(["tesseract", f, "-", "-l", lang, "--psm", "11"], capture_output=True, text=True, timeout=120)
        txt += "\n" + r.stdout
    return txt

def pypdf_pages(path, pw=None):
    try:
        from pypdf import PdfReader
        r = PdfReader(path)
        if r.is_encrypted: r.decrypt(pw or "")
        return [(p.extract_text() or "") for p in r.pages]
    except Exception as e:
        return ["ERR " + repr(e)]

def qpdf_check(path):
    r = subprocess.run(["qpdf", "--check", path], capture_output=True, text=True, timeout=120)
    return r.returncode in (0, 3), (r.stdout[-300:] + r.stderr[-300:])

def qdf_bytes(path, pw=None):
    a = ["qpdf"] + (["--password=" + pw] if pw else []) + ["--qdf", "--object-streams=disable", "--decode-level=all", path, "-"]
    return subprocess.run(a, capture_output=True, timeout=120).stdout

def npages(path):
    try:
        import pikepdf
        with pikepdf.open(path) as d: return len(d.pages)
    except Exception: return -1

def page_box_rot(path, i):
    import pikepdf
    with pikepdf.open(path) as d:
        p = d.pages[i]
        mb = [float(v) for v in p.mediabox]
        cb = [float(v) for v in (p.obj.get("/CropBox") or p.mediabox)] if "/CropBox" in p.obj else mb
        # inherited crop or rotate
        rot = int(p.obj.get("/Rotate", 0)) % 360 if "/Rotate" in p.obj else int(p.obj.Parent.get("/Rotate", 0)) % 360 if "/Parent" in p.obj else 0
        cb = [max(cb[0], mb[0]), max(cb[1], mb[1]), min(cb[2], mb[2]), min(cb[3], mb[3])]
        return cb, rot
