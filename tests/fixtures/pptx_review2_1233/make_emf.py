# make_emf.py -- the second review's EMF pictures (1.24.33), written record by record as Windows writes them (MS-EMF),
# each with the points where its colour is known (probes.json: [x, y] as fractions of the picture, and the colour there
# by what the records say); and EMF files LibreOffice makes from SVG drawings written here (lo_*.emf), whose probes are
# read from LibreOffice's own drawing of them at replay time (replay_browser.py).
# Run: python3 tests/fixtures/pptx_review2_1233/make_emf.py
import json, os, shutil, struct, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "emf")
os.makedirs(OUT, exist_ok=True)

def rgb(r, g, b): return r | g << 8 | b << 16
class EMF:
    """records in device pixels of a 96-dpi reference screen, unless a map mode says otherwise; w, h: the picture's
    size in those pixels (its frame)"""
    def __init__(self, w, h, frame_origin=(0, 0)):
        self.w, self.h, self.recs, self.handles, self.fo = w, h, [], 1, frame_origin
    def rec(self, t, body=b""):
        d = struct.pack("<II", t, 8 + len(body)) + body
        while len(d) % 4: d += b"\0"
        d = d[:4] + struct.pack("<I", len(d)) + d[8:]
        self.recs.append(d)
    def handle(self): self.handles += 1; return self.handles - 1
    # state
    def mapmode(self, m): self.rec(17, struct.pack("<I", m))
    def window_ext(self, x, y): self.rec(9, struct.pack("<ii", x, y))
    def window_org(self, x, y): self.rec(10, struct.pack("<ii", x, y))
    def viewport_ext(self, x, y): self.rec(11, struct.pack("<ii", x, y))
    def viewport_org(self, x, y): self.rec(12, struct.pack("<ii", x, y))
    def save(self): self.rec(33)
    def restore(self, k=-1): self.rec(34, struct.pack("<i", k))
    def world(self, m): self.rec(35, struct.pack("<6f", *m))
    def modify_world(self, m, mode): self.rec(36, struct.pack("<6fI", *(list(m) + [mode])))
    def polyfill(self, m): self.rec(19, struct.pack("<I", m))
    def rop2(self, m): self.rec(20, struct.pack("<I", m))
    def text_align(self, a): self.rec(22, struct.pack("<I", a))
    def text_color(self, c): self.rec(24, struct.pack("<I", c))
    def bk_mode(self, m): self.rec(18, struct.pack("<I", m))
    # objects
    def pen(self, color, width=1, style=0):
        h = self.handle(); self.rec(38, struct.pack("<IIiiI", h, style, width, 0, color)); return h
    def extpen(self, color, width, style):
        h = self.handle(); self.rec(95, struct.pack("<IIIIIIIIII", h, 0, 0, 0, 0, style, width, 0, color, 0)); return h
    def brush(self, color, style=0, hatch=0):
        h = self.handle(); self.rec(39, struct.pack("<IIII", h, style, color, hatch)); return h
    def font(self, height, face="Arial", weight=400, italic=0, underline=0, esc=0):
        h = self.handle()
        lf = struct.pack("<iiiiiBBBBBBBB", height, 0, esc, esc, weight, italic, underline, 0, 0, 0, 0, 0, 0) + face.encode("utf-16-le").ljust(64, b"\0")
        self.rec(82, struct.pack("<I", h) + lf); return h
    def select(self, h): self.rec(37, struct.pack("<I", h))
    def stock(self, n): return 0x80000000 | n
    def delete(self, h): self.rec(40, struct.pack("<I", h))
    # drawing
    def rect(self, l, t, r, b): self.rec(43, struct.pack("<iiii", l, t, r, b))
    def ellipse(self, l, t, r, b): self.rec(42, struct.pack("<iiii", l, t, r, b))
    def roundrect(self, l, t, r, b, cw, ch): self.rec(44, struct.pack("<iiiiii", l, t, r, b, cw, ch))
    def _bounds(self, pts):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return struct.pack("<iiii", min(xs), min(ys), max(xs), max(ys))
    def poly16(self, t, pts): self.rec(t, self._bounds(pts) + struct.pack("<I", len(pts)) + b"".join(struct.pack("<hh", x, y) for x, y in pts))
    def poly32(self, t, pts): self.rec(t, self._bounds(pts) + struct.pack("<I", len(pts)) + b"".join(struct.pack("<ii", x, y) for x, y in pts))
    def polygon16(self, pts): self.poly16(86, pts)
    def polyline16(self, pts): self.poly16(87, pts)
    def polygon(self, pts): self.poly32(3, pts)
    def polypolygon16(self, rings):
        allp = [p for r in rings for p in r]
        self.rec(91, self._bounds(allp) + struct.pack("<II", len(rings), len(allp)) + b"".join(struct.pack("<I", len(r)) for r in rings) + b"".join(struct.pack("<hh", x, y) for x, y in allp))
    def moveto(self, x, y): self.rec(27, struct.pack("<ii", x, y))
    def lineto(self, x, y): self.rec(54, struct.pack("<ii", x, y))
    def bezierto16(self, pts): self.poly16(88, pts)
    def begin_path(self): self.rec(59)
    def end_path(self): self.rec(60)
    def close_figure(self): self.rec(61)
    def fill_path(self): self.rec(62, struct.pack("<iiii", 0, 0, self.w, self.h))
    def stroke_fill_path(self): self.rec(63, struct.pack("<iiii", 0, 0, self.w, self.h))
    def stroke_path(self): self.rec(64, struct.pack("<iiii", 0, 0, self.w, self.h))
    def clip_path(self, mode=1): self.rec(67, struct.pack("<I", mode))
    def clip_rect(self, l, t, r, b): self.rec(30, struct.pack("<iiii", l, t, r, b))
    def text(self, x, y, s):
        u = s.encode("utf-16-le"); n = len(s)
        off = 76; dxoff = off + len(u) + (len(u) % 4)
        body = struct.pack("<iiii", x, y, x + 10 * n, y + 20) + struct.pack("<Iff", 1, 0.0, 0.0) + struct.pack("<iiIIIiiiiI", x, y, n, off, 0, 0, 0, 0, 0, dxoff)
        body += u + b"\0" * (len(u) % 4) + b"".join(struct.pack("<I", 0) for _ in range(n))
        self.rec(84, body)
    def dib(self, w, h, pixels, bpp=24, palette=None):
        """pixels: rows top to bottom of (r, g, b) or palette indexes; stored bottom-up"""
        stride = (w * bpp + 31) // 32 * 4; rows = []
        for row in reversed(pixels):
            if bpp == 24: b = b"".join(bytes([p[2], p[1], p[0]]) for p in row)
            elif bpp == 32: b = b"".join(bytes([p[2], p[1], p[0], 0]) for p in row)
            elif bpp == 8: b = bytes(row)
            elif bpp == 1:
                b = bytearray((w + 7) // 8)
                for i, v in enumerate(row):
                    if v: b[i >> 3] |= 0x80 >> (i & 7)
                b = bytes(b)
            rows.append(b.ljust(stride, b"\0"))
        pal = b"".join(bytes([c[2], c[1], c[0], 0]) for c in (palette or []))
        bmi = struct.pack("<IiiHHIIiiII", 40, w, h, 1, bpp, 0, len(b"".join(rows)), 2835, 2835, len(palette or []), 0) + pal
        return bmi, b"".join(rows)
    def stretchdib(self, x, y, cw, ch, w, h, pixels, bpp=24, palette=None, rop=0xCC0020):
        bmi, bits = self.dib(w, h, pixels, bpp, palette)
        head = 80
        body = struct.pack("<iiii", x, y, x + cw, y + ch) + struct.pack("<iiiiii", x, y, 0, 0, w, h) + struct.pack("<IIIIII", head, len(bmi), head + len(bmi), len(bits), 0, rop) + struct.pack("<ii", cw, ch)
        self.rec(81, body + bmi + bits)
    def bitblt(self, x, y, cw, ch, rop, pixels=None, w=0, h=0):
        bmi, bits = self.dib(w, h, pixels) if pixels else (b"", b"")
        head = 100
        body = struct.pack("<iiii", x, y, x + cw, y + ch) + struct.pack("<iiiiIii", x, y, cw, ch, rop, 0, 0) + struct.pack("<6f", 1, 0, 0, 1, 0, 0) + struct.pack("<II", 0xFFFFFF, 0)
        body += struct.pack("<IIII", head if pixels else 0, len(bmi), head + len(bmi) if pixels else 0, len(bits))
        self.rec(76, body + bmi + bits)
    def gradient_rect(self, l, t, r, b, c0, c1, horizontal=True):
        v = struct.pack("<iiHHHH", l, t, (c0 & 255) << 8, (c0 >> 8 & 255) << 8, (c0 >> 16 & 255) << 8, 0) + struct.pack("<iiHHHH", r, b, (c1 & 255) << 8, (c1 >> 8 & 255) << 8, (c1 >> 16 & 255) << 8, 0)
        self.rec(118, struct.pack("<iiii", l, t, r, b) + struct.pack("<III", 2, 1, 0 if horizontal else 1) + v + struct.pack("<II", 0, 1))
    def pie(self, l, t, r, b, x1, y1, x2, y2): self.rec(47, struct.pack("<iiiiiiii", l, t, r, b, x1, y1, x2, y2))
    def comment_emfplus(self): self.rec(70, struct.pack("<I", 28) + b"EMF+" + struct.pack("<HHII", 0x4001, 1, 28, 16) + struct.pack("<IIII", 0xDBC01002, 1, 96, 96))
    def bytes(self):
        self.rec(14, struct.pack("<III", 0, 16, 20))
        dev, mm = (1920, 1080), (508, 286)   # a 96-dpi screen
        fx = lambda px: int(round(px * 100 * mm[0] / dev[0]))
        fy = lambda px: int(round(px * 100 * mm[1] / dev[1]))
        fl, ft = self.fo
        body = sum(len(r) for r in self.recs)
        hdr = struct.pack("<II", 1, 108) + struct.pack("<iiii", fl, ft, fl + self.w - 1, ft + self.h - 1) + struct.pack("<iiii", fx(fl), fy(ft), fx(fl + self.w), fy(ft + self.h))
        hdr += struct.pack("<IIIIHHIII", 0x464D4520, 0x10000, 108 + body, len(self.recs) + 1, self.handles, 0, 0, 0, 0)
        hdr += struct.pack("<iiii", dev[0], dev[1], mm[0], mm[1]) + struct.pack("<III", 0, 0, 0) + struct.pack("<ii", mm[0] * 1000, mm[1] * 1000)
        return hdr + b"".join(self.recs)

RED, GREEN, BLUE, YELLOW, BLACK, WHITE, GREY = rgb(220, 30, 30), rgb(30, 160, 60), rgb(30, 60, 210), rgb(240, 210, 30), rgb(0, 0, 0), rgb(255, 255, 255), rgb(128, 128, 128)
def C(c): return [c & 255, c >> 8 & 255, c >> 16 & 255]
probes = {}
def emit(name, e, pts, note=""):
    open(os.path.join(OUT, name + ".emf"), "wb").write(e.bytes())
    out = []
    for q in pts:
        if isinstance(q, dict): out.append(q)
        else: out.append({"at": [q[0], q[1]], "rgb": C(q[2]) if isinstance(q[2], int) else q[2]})
    probes[name] = {"w": e.w, "h": e.h, "probes": out, "note": note}

# e01: shapes -- a filled rectangle with a pen, an ellipse, a rounded rectangle (a pump drawing's parts)
e = EMF(400, 300)
e.select(e.pen(BLACK, 2)); e.select(e.brush(RED)); e.rect(20, 20, 180, 140)
e.select(e.brush(GREEN)); e.ellipse(220, 20, 380, 140)
e.select(e.brush(BLUE)); e.roundrect(20, 170, 380, 280, 40, 40)
emit("e01_shapes", e, [(0.25, 0.27, RED), (0.75, 0.27, GREEN), (0.5, 0.75, BLUE), (0.53, 0.05, WHITE), (0.56, 0.06, WHITE)])
# e02: polygons and lines, 16 bit, a triangle and an L-shaped outline
e = EMF(400, 300)
e.select(e.pen(BLACK, 1)); e.select(e.brush(YELLOW)); e.polygon16([(200, 20), (380, 280), (20, 280)])
e.select(e.pen(BLUE, 6)); e.polyline16([(30, 30), (30, 150), (150, 150)])
emit("e02_polys", e, [(0.5, 0.7, YELLOW), (0.075, 0.3, BLUE), (0.25, 0.5, BLUE), (0.95, 0.1, WHITE)])
# e03: text -- a label in Arial, centred on its point, black on white, and a bold red one at the top left
e = EMF(400, 200)
e.select(e.font(-40, "Arial", 700)); e.text_color(RED); e.text_align(0); e.bk_mode(1); e.text(10, 10, "PUMP 1")
e.select(e.font(-30, "Arial")); e.text_color(BLACK); e.text_align(6); e.text(200, 120, "Wet well")
emit("e03_text", e, [(0.95, 0.5, WHITE), (0.95, 0.95, WHITE), {"ink": [0, 0, 0.6, 0.4], "rgb": C(RED)}, {"ink": [0.25, 0.45, 0.75, 0.85], "rgb": C(BLACK)}, {"noink": [0, 0.45, 0.2, 1], "rgb": C(BLACK)}], "red text at the top left, black text centred low")
# e04: anisotropic mapping -- a 1000 by 1000 logical drawing on a 400 by 300 picture
e = EMF(400, 300)
e.mapmode(8); e.window_ext(1000, 1000); e.viewport_ext(400, 300)
e.select(e.stock(8)); e.select(e.brush(RED)); e.rect(0, 0, 500, 500)
e.select(e.brush(BLUE)); e.rect(500, 500, 1000, 1000)
emit("e04_aniso", e, [(0.25, 0.25, RED), (0.75, 0.75, BLUE), (0.75, 0.25, WHITE), (0.25, 0.75, WHITE)])
# e05: millimetres with y up (MM_LOMETRIC, tenths of a millimetre), the origin at the bottom left
e = EMF(378, 378)   # 100 mm square
e.mapmode(2); e.viewport_org(0, 378)
e.select(e.stock(8)); e.select(e.brush(GREEN)); e.rect(0, 0, 500, 500)   # the bottom-left quarter
emit("e05_lometric", e, [(0.25, 0.75, GREEN), (0.25, 0.25, WHITE), (0.75, 0.75, WHITE)])
# e06: a world transform -- a bar turned 90 degrees about the picture's centre
e = EMF(300, 300)
e.select(e.stock(8)); e.select(e.brush(BLUE))
e.world([0, 1, -1, 0, 300, 0]); e.rect(20, 130, 280, 170)   # a horizontal bar, turned: vertical
emit("e06_world", e, [(0.5, 0.2, BLUE), (0.5, 0.8, BLUE), (0.2, 0.5, WHITE), (0.8, 0.5, WHITE)])
# e07: save and restore -- a red brush saved, a green one chosen inside, then the red one back
e = EMF(300, 100)
e.select(e.stock(8)); e.select(e.brush(RED)); e.save(); e.select(e.brush(GREEN)); e.rect(0, 0, 100, 100); e.restore(); e.rect(200, 0, 300, 100)
emit("e07_savedc", e, [(0.17, 0.5, GREEN), (0.83, 0.5, RED), (0.5, 0.5, WHITE)])
# e08: a clip -- a big blue ellipse drawn through a clip rectangle on its left half
e = EMF(300, 200)
e.save(); e.clip_rect(0, 0, 150, 200); e.select(e.stock(8)); e.select(e.brush(BLUE)); e.ellipse(10, 10, 290, 190); e.restore()
emit("e08_clip", e, [(0.3, 0.5, BLUE), (0.7, 0.5, WHITE)])
# e09: a path with a curve, stroked and filled
e = EMF(300, 300)
e.select(e.pen(BLACK, 3)); e.select(e.brush(YELLOW))
e.begin_path(); e.moveto(30, 270); e.lineto(30, 150); e.bezierto16([(30, 30), (270, 30), (270, 150)]); e.lineto(270, 270); e.close_figure(); e.end_path(); e.stroke_fill_path()
emit("e09_path", e, [(0.5, 0.6, YELLOW), (0.5, 0.3, YELLOW), (0.75, 0.82, YELLOW), (0.05, 0.05, WHITE), (0.95, 0.05, WHITE), {"ink": [0.3, 0.88, 0.7, 0.92], "rgb": C(BLACK)}])
# e10: bitmaps -- a 24-bit 2 by 2 picture stretched over the left half, an 8-bit one with a palette on the right
e = EMF(400, 200)
e.stretchdib(0, 0, 200, 200, 2, 2, [[(255, 0, 0), (0, 255, 0)], [(0, 0, 255), (255, 255, 0)]])
e.stretchdib(200, 0, 200, 200, 2, 1, [[0, 1]], 8, [(0, 0, 0), (255, 128, 0)])
emit("e10_dib", e, [(0.12, 0.25, [255, 0, 0]), (0.37, 0.25, [0, 255, 0]), (0.12, 0.75, [0, 0, 255]), (0.37, 0.75, [255, 255, 0]), (0.62, 0.5, [0, 0, 0]), (0.87, 0.5, [255, 128, 0])])
# e11: a hatched brush (BS_HATCHED, crossed lines) over a rectangle: mostly the white under it, not a solid block
e = EMF(300, 200)
e.select(e.pen(BLACK, 1)); e.select(e.brush(BLACK, 2, 4)); e.bk_mode(1); e.rect(20, 20, 280, 180)
emit("e11_hatch", e, [{"light": [0.15, 0.15, 0.85, 0.85]}, {"ink": [0.15, 0.15, 0.85, 0.85], "rgb": C(BLACK)}], "a hatched rectangle: thin black crossed lines on white")
# e12: a gradient (EMR_GRADIENTFILL), red at the left to blue at the right
e = EMF(300, 100)
e.gradient_rect(0, 0, 300, 100, RED, BLUE)
emit("e12_gradient", e, [(0.05, 0.5, RED), (0.95, 0.5, BLUE)])
# e13: a pie slice (EMR_PIE): the top-right quarter of a circle, green
e = EMF(300, 300)
e.select(e.stock(8)); e.select(e.brush(GREEN)); e.pie(0, 0, 300, 300, 300, 150, 150, 0)
emit("e13_pie", e, [(0.7, 0.3, GREEN), (0.3, 0.7, WHITE), (0.3, 0.3, WHITE)])
# e14: a donut (two rings in one polypolygon, filled alternate): the hole stays white
e = EMF(300, 300)
e.select(e.stock(8)); e.select(e.brush(BLUE)); e.polyfill(1)
e.polypolygon16([[(20, 20), (280, 20), (280, 280), (20, 280)], [(100, 100), (200, 100), (200, 200), (100, 200)]])
emit("e14_donut", e, [(0.15, 0.5, BLUE), (0.5, 0.5, WHITE)])
# e15: a frame that does not start at 0,0 (Visio's pages): the drawing's own place
e = EMF(200, 200, frame_origin=(500, 300))
e.select(e.stock(8)); e.select(e.brush(RED)); e.rect(500, 300, 600, 400); e.select(e.brush(BLUE)); e.rect(600, 400, 700, 500)
emit("e15_offset", e, [(0.25, 0.25, RED), (0.75, 0.75, BLUE), (0.75, 0.25, WHITE)])
# e16: dashed geometric pen (EXTCREATEPEN, 8 px, PS_DASH) along a line: dashes with gaps
e = EMF(400, 100)
e.select(e.extpen(BLACK, 8, 0x00010000 | 1)); e.moveto(10, 50); e.lineto(390, 50)
emit("e16_dash", e, [{"dashes": [0.05, 0.5, 0.95]}], "a dashed line")
# e17: XOR (R2_XORPEN) -- the same red rectangle drawn twice with XOR is nothing at all
e = EMF(200, 200)
e.rop2(7); e.select(e.stock(8)); e.select(e.brush(RED)); e.rect(20, 20, 180, 180); e.rect(20, 20, 180, 180)
emit("e17_xor_twice", e, [(0.5, 0.5, WHITE)])
# e18: a 1-bit bitmap (black and white, a checker)
e = EMF(200, 200)
e.stretchdib(0, 0, 200, 200, 2, 2, [[0, 1], [1, 0]], 1, [(0, 0, 0), (255, 255, 255)])
emit("e18_mono", e, [(0.25, 0.25, BLACK), (0.75, 0.25, WHITE), (0.25, 0.75, WHITE), (0.75, 0.75, BLACK)])
# e19: an EMF+ picture (dual: EMF+ records in comments, then the plain records): the plain records drawn
e = EMF(200, 100)
e.comment_emfplus(); e.select(e.stock(8)); e.select(e.brush(GREEN)); e.rect(0, 0, 100, 100)
emit("e19_dual", e, [(0.25, 0.5, GREEN), (0.75, 0.5, WHITE)])
# e20: text turned 90 degrees (escapement 900), a vertical label down the left side
e = EMF(100, 300)
e.select(e.font(-40, "Arial", 700, esc=900)); e.text_color(BLACK); e.bk_mode(1); e.text_align(0); e.text(20, 280, "LEVEL")
emit("e20_vtext", e, [(0.95, 0.5, WHITE), {"tallInk": [0, 0, 1, 1]}], "the word LEVEL reading upwards at the left")
# e21: a BITBLT with no picture, PATCOPY with a green brush (a filled background, as Visio writes one)
e = EMF(200, 100)
e.select(e.brush(GREEN)); e.bitblt(0, 0, 200, 100, 0xF00021)
emit("e21_patcopy", e, [(0.5, 0.5, GREEN)])
# e22: an isotropic map mode with a window larger one way: shapes keep their shape
e = EMF(400, 200)
e.mapmode(7); e.window_ext(100, 100); e.viewport_ext(200, 200)
e.select(e.stock(8)); e.select(e.brush(RED)); e.rect(0, 0, 100, 100)
emit("e22_iso", e, [(0.25, 0.5, RED), (0.75, 0.5, WHITE)])
# e23: a triangle drawn as a path of lines (MoveTo, LineTo, LineTo, CloseFigure, FillPath): a LineTo goes on with its figure
e = EMF(300, 300)
e.select(e.stock(8)); e.select(e.brush(RED))
e.begin_path(); e.moveto(150, 20); e.lineto(280, 280); e.lineto(20, 280); e.close_figure(); e.end_path(); e.fill_path()
emit("e23_path_lines", e, [(0.5, 0.7, RED), (0.1, 0.1, WHITE)])
# e24: a small bitmap stretched big with the default stretch mode: each pixel a sharp square, as Windows draws it
e = EMF(400, 200)
e.stretchdib(0, 0, 400, 200, 2, 1, [[(255, 0, 0), (0, 0, 255)]])
emit("e24_dib_sharp", e, [(0.4, 0.5, [255, 0, 0]), (0.6, 0.5, [0, 0, 255])])
json.dump(probes, open(os.path.join(OUT, "probes.json"), "w"), indent=1)

# ---- LibreOffice's own EMF, from SVG drawings ----------------------------------------------------------------------
SVGS = {
  "lo_shapes": '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#ffffff"/><rect x="20" y="20" width="160" height="120" fill="#dc1e1e" stroke="#000" stroke-width="3"/><circle cx="300" cy="80" r="60" fill="#1ea03c"/><polygon points="200,170 380,280 20,280" fill="#f0d21e"/></svg>',
  "lo_text": '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="#ffffff"/><rect x="0" y="0" width="400" height="60" fill="#1e3cd2"/><text x="20" y="45" font-family="Liberation Sans" font-size="36" fill="#ffffff">VALVE V-3</text><text x="200" y="140" font-family="Liberation Serif" font-size="30" text-anchor="middle" fill="#000">open slowly</text></svg>',
  "lo_gradient": '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#dc1e1e"/><stop offset="1" stop-color="#1e3cd2"/></linearGradient></defs><rect width="300" height="100" fill="url(#g)"/></svg>',
  "lo_dashes": '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="#ffffff"/><path d="M20 100 C 120 0, 280 200, 380 100" fill="none" stroke="#1ea03c" stroke-width="8"/><line x1="20" y1="180" x2="380" y2="180" stroke="#000" stroke-width="4" stroke-dasharray="20 10"/></svg>',
  "lo_clip": '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><defs><clipPath id="c"><rect x="0" y="0" width="150" height="200"/></clipPath></defs><rect width="300" height="200" fill="#ffffff"/><ellipse cx="150" cy="100" rx="140" ry="90" fill="#1e3cd2" clip-path="url(#c)"/></svg>',
  "lo_image": None,   # an embedded PNG: written below
}
so = shutil.which("soffice") or shutil.which("libreoffice")
if so:
    import base64, io
    from PIL import Image
    im = Image.new("RGB", (4, 2)); im.putdata([(255, 0, 0)] * 2 + [(0, 0, 255)] * 2 + [(255, 0, 0)] * 2 + [(0, 0, 255)] * 2); b = io.BytesIO(); im.save(b, "PNG")
    SVGS["lo_image"] = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="#ffffff"/><image x="0" y="0" width="400" height="200" preserveAspectRatio="none" image-rendering="pixelated" xlink:href="data:image/png;base64,%s"/></svg>' % base64.b64encode(b.getvalue()).decode()
    tmp = tempfile.mkdtemp(prefix="emf_r2_"); env = dict(os.environ, HOME=tmp)
    for k, s in SVGS.items():
        p = os.path.join(tmp, k + ".svg"); open(p, "w").write(s)
        subprocess.run([so, "--headless", "--convert-to", "emf", "--outdir", tmp, p], capture_output=True, timeout=120, env=env)
        if os.path.exists(os.path.join(tmp, k + ".emf")): shutil.copy(os.path.join(tmp, k + ".emf"), os.path.join(OUT, k + ".emf"))
        open(os.path.join(OUT, k + ".svg"), "w").write(s)
    shutil.rmtree(tmp, ignore_errors=True)
for f in sorted(os.listdir(OUT)): print("%-24s %7d" % (f, os.path.getsize(os.path.join(OUT, f))))
