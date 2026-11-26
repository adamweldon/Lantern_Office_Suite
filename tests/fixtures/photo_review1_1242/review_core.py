# review_core.py -- the parts run_review.py shares: a tiny web server for one build, the page helper, the checks'
# bookkeeping, and a Photoshop file writer built from Adobe's file format specification (so that edge cases can be made
# byte by byte, independent of Lantern). Written by an independent reviewer (photo review 1, 1.24.42).
import os, sys, io, json, base64, struct, zlib, threading, http.server, socketserver, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
INP = os.path.join(HERE, "inputs")
import tempfile
OUTDIR = tempfile.mkdtemp(prefix="photo_review1_out_")   # files Lantern saves, kept out of this folder
DEFAULT_BUILD = "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad/photo_r1/index.html"

# ---------------------------------------------------------------- bookkeeping
class Book:
    def __init__(self):
        self.rows = []
    def check(self, sec, name, ok, got="", want="", note=""):
        ok = bool(ok)
        self.rows.append({"section": sec, "check": name, "pass": ok, "got": str(got)[:600], "want": str(want)[:600], "note": note})
        line = ("PASS  " if ok else "FAIL  ") + "[%s] %s" % (sec, name)
        if not ok:
            line += "  | got: %s | want: %s" % (str(got)[:300], str(want)[:300])
        print(line, flush=True)
        return ok
    def info(self, sec, name, text):
        self.rows.append({"section": sec, "check": name, "pass": None, "got": str(text)[:1200], "want": "", "note": "info"})
        print("INFO  [%s] %s: %s" % (sec, name, str(text)[:300]), flush=True)

# ---------------------------------------------------------------- the page
HELPER_JS = r"""
() => {
  window.R = {
    u8(b64) { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; },
    b64(u8) { if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8.buffer ? u8.buffer : u8); let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); },
    docs: {},
    info(d) {
      return { w: d.w, h: d.h, dpi: d.dpi, notes: (d.notes || []).slice(), layers: d.layers.map(function (l) {
        return { name: l.name, kind: l.kind, x: l.x, y: l.y, w: l.cv ? l.cv.width : null, h: l.cv ? l.cv.height : null, visible: l.visible, opacity: l.opacity,
          blend: l.blend, clip: l.clip, adj: l.adj ? JSON.parse(JSON.stringify(l.adj)) : null, group: l.group || null,
          mask: l.mask ? { x: l.mask.x, y: l.mask.y, w: l.mask.cv.width, h: l.mask.cv.height, def: l.mask.def, on: l.mask.on } : null };
      }) };
    },
    async open(b64, name, key) { const d = await Lantern.photo.files.open({ bytes: R.u8(b64), name: name }); R.docs[key || name] = d; return R.info(d); },
    pixels(cv) { return new Uint8Array(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.buffer); },
    flat(key) { const cv = Lantern.photo.compose.all(R.docs[key]); return { w: cv.width, h: cv.height, b64: R.b64(R.pixels(cv)) }; },
    layerPix(key, i) { const l = R.docs[key].layers[i]; if (!l.cv) return null; return { x: l.x, y: l.y, w: l.cv.width, h: l.cv.height, b64: R.b64(R.pixels(l.cv)) }; },
    maskOf(key, i) { const d = R.docs[key], l = d.layers[i], m = Lantern.photo.doc.maskData(d, l); return m ? R.b64(m) : null; },
    async save(key, fmt, opt) {
      const d = R.docs[key], r = await Lantern.photo.files.save(d, fmt, opt || {});
      let bytes = r.bytes; if (!bytes) bytes = new Uint8Array(await r.blob.arrayBuffer());
      return { name: r.name, b64: R.b64(bytes), type: r.blob.type, notes: (d.notes || []).slice() };
    },
    id(w, h, b64) { return { width: w, height: h, data: new Uint8ClampedArray(R.u8(b64).buffer) }; },
    get(path) { let o = Lantern.photo; path.split('.').forEach(function (k) { o = o[k]; }); return o; },
    // a pure function of Lantern.photo on a picture: fn(imageData, params) in place, or returning a new one
    pure(path, w, h, b64, params) {
      const d = R.id(w, h, b64), fn = R.get(path), t0 = performance.now();
      const r = fn(d, params === undefined ? {} : params);
      const o = r && r.data ? r : d;
      return { w: o.width, h: o.height, b64: R.b64(new Uint8Array(o.data.buffer, o.data.byteOffset, o.data.length)), ms: performance.now() - t0 };
    },
    canvasOf(w, h, b64) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); const im = g.createImageData(w, h); im.data.set(R.u8(b64)); g.putImageData(im, 0, 0); return cv; }
  };
  return true;
}
"""

class Server:
    def __init__(self, build):
        build = os.path.abspath(build)
        class Hd(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
            def handle(self):
                try: super().handle()
                except (ConnectionResetError, BrokenPipeError): pass
            def translate_path(self, p):
                p = p.split("?")[0].split("#")[0]
                if p in ("/", "/index.html"): return build
                return os.path.join(os.path.dirname(build), p.lstrip("/"))
        socketserver.TCPServer.allow_reuse_address = True
        self.srv = socketserver.TCPServer(("127.0.0.1", 0), Hd)
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

class Page:
    def __init__(self, pw, build):
        self.server = Server(build)
        self.browser = pw.chromium.launch()
        self.pg = self.browser.new_page()
        self.errors = []
        self.pg.on("pageerror", lambda e: self.errors.append(str(e)[:300]))
        self.pg.goto("http://127.0.0.1:%d/index.html#photo" % self.server.port)
        self.pg.wait_for_function("!!(window.Lantern && Lantern.photo && Lantern.photo.files && Lantern.photo.ops && Lantern.photo.compose)", timeout=90000)
        self.pg.evaluate(HELPER_JS)
        self.pg.set_default_timeout(600000)
    def J(self, js, arg=None):
        return self.pg.evaluate(js, arg) if arg is not None else self.pg.evaluate(js)
    def open(self, data, name, key=None):
        return self.J("([b, n, k]) => R.open(b, n, k)", [base64.b64encode(data).decode(), name, key or name])
    def flat(self, key):
        r = self.J("(k) => R.flat(k)", key)
        return np.frombuffer(base64.b64decode(r["b64"]), np.uint8).reshape(r["h"], r["w"], 4)
    def layer(self, key, i):
        r = self.J("([k, i]) => R.layerPix(k, i)", [key, i])
        if r is None: return None
        return r["x"], r["y"], np.frombuffer(base64.b64decode(r["b64"]), np.uint8).reshape(r["h"], r["w"], 4)
    def mask(self, key, i, w, h):
        r = self.J("([k, i]) => R.maskOf(k, i)", [key, i])
        return None if r is None else np.frombuffer(base64.b64decode(r), np.uint8).reshape(h, w)
    def save(self, key, fmt, opt=None):
        r = self.J("([k, f, o]) => R.save(k, f, o)", [key, fmt, opt or {}])
        r["bytes"] = base64.b64decode(r["b64"]); del r["b64"]
        return r
    def pure(self, path, arr, params=None):
        h, w = arr.shape[:2]
        a = np.ascontiguousarray(arr.astype(np.uint8))
        r = self.J("([p, w, h, b, q]) => R.pure(p, w, h, b, q)", [path, w, h, base64.b64encode(a.tobytes()).decode(), params if params is not None else {}])
        out = np.frombuffer(base64.b64decode(r["b64"]), np.uint8).reshape(r["h"], r["w"], 4)
        return out, r["ms"]

def rgba(img_rgb, alpha=255):
    a = np.asarray(img_rgb)
    if a.ndim == 2: a = np.dstack([a, a, a])
    if a.shape[2] == 4: return a.astype(np.uint8)
    return np.dstack([a, np.full(a.shape[:2], alpha, np.uint8)]).astype(np.uint8)

def maxdiff(a, b):
    a = np.asarray(a, np.int32); b = np.asarray(b, np.int32)
    if a.shape != b.shape: return 9999
    return int(np.abs(a - b).max()) if a.size else 0

# ---------------------------------------------------------------- a PSD/PSB writer from Adobe's specification
def _pascal(name, pad):
    b = name.encode("latin-1", "replace")[:255]
    out = bytes([len(b)]) + b
    while len(out) % pad: out += b"\0"
    return out

def packbits_row(row):
    out = bytearray(); i = 0; n = len(row)
    while i < n:
        run = 1
        while i + run < n and run < 128 and row[i + run] == row[i]: run += 1
        if run >= 2:
            out += bytes([(257 - run) & 255, row[i]]); i += run; continue
        st = i; lit = 0
        while i < n and lit < 128:
            if i + 1 < n and row[i] == row[i + 1]: break
            i += 1; lit += 1
        out += bytes([lit - 1]) + bytes(row[st:st + lit])
    return bytes(out)

def to_bytes_plane(plane, depth):
    plane = np.asarray(plane)
    if depth == 8: return plane.astype(np.uint8).tobytes()
    if depth == 16: return plane.astype(">u2").tobytes()
    if depth == 32: return plane.astype(">f4").tobytes()
    if depth == 1: return np.packbits(plane.astype(np.uint8), axis=1).tobytes()
    raise ValueError(depth)

def encode_channel(plane, depth, comp, big=False):
    """plane: h x w array in the file's own sample format (bitmap: 1 = black). Returns compression + data."""
    plane = np.asarray(plane); h, w = plane.shape
    if w == 0 or h == 0: return struct.pack(">H", 0)
    raw = to_bytes_plane(plane, depth); bpr = len(raw) // h
    if comp == 0: return struct.pack(">H", 0) + raw
    if comp == 1:
        rows = [packbits_row(raw[y * bpr:(y + 1) * bpr]) for y in range(h)]
        cnt = b"".join(struct.pack(">I" if big else ">H", len(r)) for r in rows)
        return struct.pack(">H", 1) + cnt + b"".join(rows)
    if comp == 2: return struct.pack(">H", 2) + zlib.compress(raw)
    if comp == 3:
        if depth == 8:
            a = np.frombuffer(raw, np.uint8).reshape(h, w).astype(np.int32)
            d = a.copy(); d[:, 1:] = (a[:, 1:] - a[:, :-1]) & 255
            return struct.pack(">H", 3) + zlib.compress(d.astype(np.uint8).tobytes())
        if depth == 16:
            a = np.frombuffer(raw, ">u2").reshape(h, w).astype(np.int64)
            d = a.copy(); d[:, 1:] = (a[:, 1:] - a[:, :-1]) & 0xffff
            return struct.pack(">H", 3) + zlib.compress(d.astype(">u2").tobytes())
        if depth == 32:
            # Photoshop's 32-bit prediction: each row's bytes split into four planes (high bytes first), then byte deltas
            a = np.frombuffer(raw, np.uint8).reshape(h, w, 4)
            sh = np.concatenate([a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]], axis=1).astype(np.int32)
            d = sh.copy(); d[:, 1:] = (sh[:, 1:] - sh[:, :-1]) & 255
            return struct.pack(">H", 3) + zlib.compress(d.astype(np.uint8).tobytes())
    raise ValueError(comp)

def tagged(key, data, big=False, pad=2):
    data = bytes(data)
    while len(data) % pad: data += b"\0"
    bigkeys = ("LMsk", "Lr16", "Lr32", "Layr", "Mt16", "Mt32", "Mtrn", "Alph", "FMsk", "lnk2", "FEid", "FXid", "PxSD")
    ln = struct.pack(">Q", len(data)) if (big and key in bigkeys) else struct.pack(">I", len(data))
    return b"8BIM" + key.encode("latin-1") + ln + data

def luni(name):
    u = name.encode("utf-16-be")
    return tagged("luni", struct.pack(">I", len(name.encode("utf-16-le")) // 2) + u + b"\0\0", pad=4)

def lsct(kind, blend=b"norm"):
    return tagged("lsct", struct.pack(">I", kind) + b"8BIM" + blend)

class PLayer:
    def __init__(self, name, top=0, left=0, planes=None, opacity=255, blend=b"norm", clip=0, hidden=False, mask=None,
                 extra=b"", unicode_name=None, comp=1):
        # planes: dict channel id -> 2-D array (in file sample format), all the same size
        self.name = name; self.top = top; self.left = left; self.planes = planes or {}; self.opacity = opacity; self.blend = blend
        self.clip = clip; self.hidden = hidden; self.mask = mask; self.extra = extra; self.unicode_name = unicode_name; self.comp = comp

def write_psd(path, w, h, layers, merged=None, depth=8, mode=3, nchan=None, big=False, palette=None, dpi=72,
              layers_in=None, merged_comp=1, alpha_first=False, global_tagged=b""):
    """layers: bottom first list of PLayer. merged: dict index -> plane (merged image planes in order).
    layers_in: None (the layer info section) or 'Lr16' / 'Lr32' (Photoshop's place for 16- and 32-bit layers)."""
    L = lambda n: struct.pack(">Q" if big else ">I", n)
    out = bytearray()
    if nchan is None: nchan = len(merged) if merged else {0: 1, 1: 1, 2: 1, 3: 3, 4: 4, 7: 1, 8: 1, 9: 3}[mode]
    out += b"8BPS" + struct.pack(">H", 2 if big else 1) + b"\0" * 6 + struct.pack(">HIIHH", nchan, h, w, depth, mode)
    cm = b"" if palette is None else bytes(palette)
    out += struct.pack(">I", len(cm)) + cm
    res = b"8BIM" + struct.pack(">H", 1005) + b"\0\0" + struct.pack(">I", 16) + struct.pack(">IHHIHH", int(dpi * 65536), 1, 1, int(dpi * 65536), 1, 1)
    out += struct.pack(">I", len(res)) + res
    # layer info
    li = bytearray()
    if layers:
        li += struct.pack(">h", -len(layers) if alpha_first else len(layers))
        chan_blobs = []
        for ly in layers:
            ids = sorted(ly.planes.keys())
            blobs = []
            for cid in ids:
                pl = ly.planes[cid]
                blobs.append((cid, encode_channel(pl, depth, ly.comp, big)))
            if ly.mask is not None:
                blobs.append((-2, encode_channel(ly.mask["data"], depth if depth != 1 else 8, ly.comp, big)))
            hh, ww = (next(iter(ly.planes.values())).shape if ly.planes else (0, 0))
            li += struct.pack(">iiii", ly.top, ly.left, ly.top + hh, ly.left + ww)
            li += struct.pack(">H", len(blobs))
            for cid, bl in blobs: li += struct.pack(">h", cid) + L(len(bl))
            li += b"8BIM" + ly.blend + bytes([ly.opacity, ly.clip, (2 if ly.hidden else 0) | 8, 0])
            ex = bytearray()
            if ly.mask is not None:
                m = ly.mask; mh, mw = np.asarray(m["data"]).shape
                ex += struct.pack(">I", 20) + struct.pack(">iiii", m["top"], m["left"], m["top"] + mh, m["left"] + mw) + bytes([m.get("def", 0), m.get("flags", 0)]) + b"\0\0"
            else:
                ex += struct.pack(">I", 0)
            ex += struct.pack(">I", 0)   # blending ranges
            ex += _pascal(ly.name, 4)
            ex += luni(ly.unicode_name if ly.unicode_name is not None else ly.name)
            ex += ly.extra
            li += struct.pack(">I", len(ex)) + ex
            chan_blobs.append(blobs)
        for blobs in chan_blobs:
            for cid, bl in blobs: li += bl
        if len(li) % 2: li += b"\0"
    lm = bytearray()
    if layers_in is None:
        lm += L(len(li)) + li
        lm += struct.pack(">I", 0)
        lm += global_tagged
    else:
        lm += L(0)
        lm += struct.pack(">I", 0)
        lm += tagged(layers_in, li, big=big, pad=4)
        lm += global_tagged
    out += L(len(lm)) + lm
    # merged image
    if merged is None:
        merged = {i: np.zeros((h, w)) for i in range(nchan)}
    planes = [merged[i] for i in range(nchan)]
    if merged_comp == 0:
        out += struct.pack(">H", 0) + b"".join(to_bytes_plane(p, depth) for p in planes)
    else:
        rows_all = []; cnts = bytearray()
        for p in planes:
            raw = to_bytes_plane(p, depth); bpr = len(raw) // h
            for y in range(h):
                r = packbits_row(raw[y * bpr:(y + 1) * bpr]); rows_all.append(r); cnts += struct.pack(">I" if big else ">H", len(r))
        out += struct.pack(">H", 1) + cnts + b"".join(rows_all)
    with open(path, "wb") as f: f.write(out)
    return path

def rgb_planes(arr):
    """an h x w x 4 uint8 RGBA picture as PSD layer planes {-1: alpha, 0: R, 1: G, 2: B}"""
    return {-1: arr[:, :, 3], 0: arr[:, :, 0], 1: arr[:, :, 1], 2: arr[:, :, 2]}

# Adobe's adjustment layer blocks (the binary ones)
def adj_levl(master=None, r=None, g=None, b=None):
    def rec(q):
        q = q or {}
        return struct.pack(">HHHHH", q.get("ib", 0), q.get("iw", 255), q.get("ob", 0), q.get("ow", 255), int(round(q.get("gamma", 1.0) * 100)))
    data = struct.pack(">H", 2) + rec(master) + rec(r) + rec(g) + rec(b) + b"".join(rec(None) for _ in range(25))
    return tagged("levl", data)

def adj_curv(curves):
    # curves: dict channel index (0 = composite, 1 R, 2 G, 3 B) -> [(in, out), ...]; legacy part plus Photoshop's 'Crv ' extra
    bits = 0
    for k in curves: bits |= 1 << k
    d = bytearray(b"\0") + struct.pack(">HI", 1, bits)
    for k in sorted(curves):
        pts = curves[k]; d += struct.pack(">H", len(pts))
        for i, o in pts: d += struct.pack(">HH", o, i)
    d += b"Crv " + struct.pack(">HI", 4, len(curves))
    for k in sorted(curves):
        pts = curves[k]; d += struct.pack(">HH", k, len(pts))
        for i, o in pts: d += struct.pack(">HH", o, i)
    return tagged("curv", d)

def adj_hue2(master=(0, 0, 0), colorize=None, ranges=None):
    d = struct.pack(">H", 2) + bytes([1 if colorize else 0, 0])
    c = colorize or (0, 25, 0)
    d += struct.pack(">hhh", *c) + struct.pack(">hhh", *master)
    R = [[315, 345, 15, 45], [15, 45, 75, 105], [75, 105, 135, 165], [135, 165, 195, 225], [195, 225, 255, 285], [255, 285, 315, 345]]
    for i in range(6):
        d += struct.pack(">hhhh", *R[i]) + struct.pack(">hhh", *((ranges or {}).get(i, (0, 0, 0))))
    return tagged("hue2", d)

def adj_brit(b, c):
    return tagged("brit", struct.pack(">hhHB", b, c, 127, 0))
def adj_post(n): return tagged("post", struct.pack(">HH", n, 0))
def adj_thrs(n): return tagged("thrs", struct.pack(">HH", n, 0))
def adj_nvrt(): return tagged("nvrt", b"")
