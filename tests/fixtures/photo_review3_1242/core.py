# core.py -- what every section of run_review.py shares: a small web server for one build, the browser page and its
# helpers, the book of checks, and small independent tools (a PSD layer-record writer built from Adobe's Photoshop File
# Format Specification, image comparisons). Written by an independent reviewer (photo review 3, Lantern 1.24.42).
# Nothing here is taken from Lantern's code: Lantern is only driven and read.
import os, sys, io, json, base64, struct, zlib, threading, http.server, socketserver, tempfile, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
INP = os.path.join(HERE, "inputs")
OUT = tempfile.mkdtemp(prefix="photo_review3_out_")   # what Lantern saves goes here, not into this folder
DEFAULT_BUILD = "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad/photo_r2/index.html"


class Book:
    def __init__(self):
        self.rows = []

    def check(self, sec, name, ok, got="", want="", how="", sure="sure"):
        ok = bool(ok)
        self.rows.append({"section": sec, "check": name, "pass": ok, "got": str(got)[:900], "want": str(want)[:900],
                          "how": how, "sure": sure})
        line = ("PASS  " if ok else "FAIL  ") + "[%s] %s" % (sec, name)
        if not ok:
            line += "  | got: %s | want: %s" % (str(got)[:260], str(want)[:260])
        print(line, flush=True)
        return ok

    def info(self, sec, name, text):
        self.rows.append({"section": sec, "check": name, "pass": None, "got": str(text)[:1500], "want": "", "how": "info", "sure": ""})
        print("INFO  [%s] %s: %s" % (sec, name, str(text)[:300]), flush=True)


HELPER_JS = r"""
() => {
  const P = Lantern.photo;
  window.RV = {
    u8(b64) { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; },
    b64(u8) { if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8.buffer, u8.byteOffset || 0, u8.byteLength); let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); },
    docs: {},
    cv(w, h, b64) { const c = document.createElement('canvas'); c.width = w; c.height = h; if (b64) { const g = c.getContext('2d'); const im = g.createImageData(w, h); im.data.set(RV.u8(b64)); g.putImageData(im, 0, 0); } return c; },
    px(cv) { return new Uint8Array(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.buffer); },
    tree(d) { return d.layers.map(function (l) { return { id: l.id, name: l.name, kind: l.kind, gid: l.gid == null ? null : l.gid, visible: l.visible, opacity: l.opacity,
      blend: l.blend, open: l.open, clip: !!l.clip, adj: l.adj ? JSON.parse(JSON.stringify(l.adj)) : null, x: l.x, y: l.y, cw: l.cv ? l.cv.width : null, ch: l.cv ? l.cv.height : null,
      mask: l.mask ? { x: l.mask.x, y: l.mask.y, w: l.mask.cv.width, h: l.mask.cv.height, def: l.mask.def, on: l.mask.on } : null }; }); },
    info(d) { return { w: d.w, h: d.h, dpi: d.dpi, active: d.active, notes: (d.notes || []).slice(), layers: RV.tree(d), hist: d.hist.length }; },
    flat(key) { const cv = P.compose.all(RV.docs[key]); return { w: cv.width, h: cv.height, b64: RV.b64(RV.px(cv)) }; },
    async open(b64, name, key) { const d = await P.files.open({ bytes: RV.u8(b64), name: name }); RV.docs[key || name] = d; return RV.info(d); },
    async save(key, fmt, opt) { const d = RV.docs[key], r = await P.files.save(d, fmt, opt || {}); let b = r.bytes; if (!b) b = new Uint8Array(await r.blob.arrayBuffer()); return { name: r.name, b64: RV.b64(b), type: r.blob.type, notes: (d.notes || []).slice() }; },
    // a document from a plan: {w, h, layers: [{name, rgba (b64, w*h*4 of the doc), kind, blend, opacity, visible, gid (index into plan of its group), adj, open, mask (b64 w*h)}]} bottom first
    make(key, plan) {
      const d = P.doc.create(plan.w, plan.h, {}); d.layers = []; const ids = [];
      plan.layers.forEach(function (q, i) {
        const l = P.doc.layer({ name: q.name, kind: q.kind || 'pixel', blend: q.blend || (q.kind === 'group' ? 'pass-through' : 'normal'), opacity: q.opacity == null ? 1 : q.opacity,
          visible: q.visible !== false, open: q.open !== false, clip: !!q.clip });
        if (q.kind === 'adjust') l.adj = q.adj;
        else if (q.kind !== 'group') { l.cv = RV.cv(plan.w, plan.h, q.rgba); }
        if (q.mask) { const mk = document.createElement('canvas'); mk.width = plan.w; mk.height = plan.h; const g = mk.getContext('2d'), im = g.createImageData(plan.w, plan.h), m = RV.u8(q.mask); for (let j = 0; j < m.length; j++) im.data[j * 4 + 3] = m[j]; g.putImageData(im, 0, 0); l.mask = { cv: mk, x: 0, y: 0, on: true, def: 0 }; }
        ids.push(l); d.layers.push(l);
      });
      plan.layers.forEach(function (q, i) { ids[i].gid = q.gid == null ? null : ids[q.gid].id; });
      d.active = d.layers.length - 1; d.hist = [{ label: 'New', state: P.doc.snap(d) }];
      RV.docs[key] = d; return RV.info(d);
    },
    exec(key, name, p) { const d = RV.docs[key]; try { const r = P.ops.exec(d, name, p || {}); return { ok: true, r: r === undefined ? null : r, info: RV.info(d) }; } catch (e) { return { ok: false, err: String(e && e.message || e), info: RV.info(d) }; } },
    id(w, h, b64) { return { width: w, height: h, data: new Uint8ClampedArray(RV.u8(b64).buffer) }; },
    get(path) { let o = P; path.split('.').forEach(function (k) { o = o[k]; }); return o; },
    pure(path, w, h, b64, params) { const d = RV.id(w, h, b64), fn = RV.get(path); const r = fn(d, params === undefined ? {} : params); const o = r && r.data ? r : d; return { w: o.width, h: o.height, b64: RV.b64(new Uint8Array(o.data.buffer, o.data.byteOffset, o.data.length)) }; }
  };
  return true;
}
"""


class Server:
    def __init__(self, build):
        build = os.path.abspath(build)
        files = {}
        self.files = files

        class Hd(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                p = self.path.split("?")[0].split("#")[0]
                if p in ("/", "/index.html"):
                    body = open(build, "rb").read(); ct = "text/html; charset=utf-8"
                elif p in files:
                    body = files[p]; ct = "application/octet-stream"
                else:
                    self.send_response(404); self.end_headers(); return
                self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store"); self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        socketserver.TCPServer.allow_reuse_address = True
        self.httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Hd)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()


def b64(b):
    return base64.b64encode(bytes(b)).decode()


def unb64(s):
    return base64.b64decode(s)


class Page:
    def __init__(self, pw, build):
        self.server = Server(build)
        self.browser = pw.chromium.launch()
        self.page = self.browser.new_page(viewport={"width": 1400, "height": 900})
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)[:300]))
        self.page.goto("http://127.0.0.1:%d/index.html#photo" % self.server.port)
        self.page.wait_for_function("!!(window.Lantern && Lantern.photo && Lantern.photo.api)", timeout=120000)
        self.page.evaluate(HELPER_JS)
        self.version = self.page.evaluate("Lantern.version")

    def ev(self, js, arg=None):
        return self.page.evaluate(js, arg) if arg is not None else self.page.evaluate(js)

    def make(self, key, w, h, layers):
        plan = {"w": w, "h": h, "layers": []}
        for q in layers:
            q = dict(q)
            if q.get("rgba") is not None:
                q["rgba"] = b64(np.ascontiguousarray(q["rgba"], dtype=np.uint8).tobytes())
            if q.get("mask") is not None:
                q["mask"] = b64(np.ascontiguousarray(q["mask"], dtype=np.uint8).tobytes())
            plan["layers"].append(q)
        return self.ev("([k, p]) => RV.make(k, p)", [key, plan])

    def flat(self, key):
        r = self.ev("(k) => RV.flat(k)", key)
        return np.frombuffer(unb64(r["b64"]), np.uint8).reshape(r["h"], r["w"], 4).copy()

    def exec(self, key, name, p=None):
        return self.ev("([k, n, p]) => RV.exec(k, n, p)", [key, name, p or {}])

    def info(self, key):
        return self.ev("(k) => RV.info(RV.docs[k])", key)

    def save(self, key, fmt, opt=None):
        r = self.ev("async ([k, f, o]) => await RV.save(k, f, o)", [key, fmt, opt or {}])
        r["bytes"] = unb64(r["b64"]); del r["b64"]
        return r

    def open(self, data, name, key):
        return self.ev("async ([b, n, k]) => await RV.open(b, n, k)", [b64(data), name, key])

    def open_err(self, data, name, key):
        return self.ev("async ([b, n, k]) => { try { return await RV.open(b, n, k); } catch (e) { return {error: String(e.message || e)}; } }", [b64(data), name, key])

    def pure(self, path, img, params=None):
        img = np.ascontiguousarray(img, dtype=np.uint8)
        h, w = img.shape[:2]
        r = self.ev("([p, w, h, b, q]) => RV.pure(p, w, h, b, q)", [path, w, h, b64(img.tobytes()), params if params is not None else {}])
        return np.frombuffer(unb64(r["b64"]), np.uint8).reshape(r["h"], r["w"], 4).copy()

    def close(self):
        try:
            self.browser.close()
        except Exception:
            pass
        self.server.httpd.shutdown()


# ---------------------------------------------------------------- independent helpers
def psd_composite(data):
    """psd-tools' own compositor on a .psd's layers (the flattened picture saved in the file is ignored)."""
    from psd_tools import PSDImage
    psd = PSDImage.open(io.BytesIO(data))
    im = psd.composite(ignore_preview=True)
    return np.asarray(im.convert("RGBA")).copy()


def psd_merged(data):
    """The flattened picture as psd-tools reads it from the file (its 'preview')."""
    from psd_tools import PSDImage
    psd = PSDImage.open(io.BytesIO(data))
    return np.asarray(psd.topil().convert("RGBA")).copy()


def psd_tree(data):
    from psd_tools import PSDImage
    psd = PSDImage.open(io.BytesIO(data))

    def walk(g):
        out = []
        for l in g:
            o = {"name": l.name, "kind": l.kind, "visible": l.visible, "opacity": l.opacity, "blend": str(l.blend_mode).split(".")[-1],
                 "clip": bool(l.clipping)}
            if l.is_group():
                try:
                    o["open"] = bool(l.open_folder)
                except Exception:
                    o["open"] = None
                o["children"] = walk(l)
            out.append(o)
        return out
    return walk(psd)


def maxdiff(a, b, where=None):
    a = a.astype(int); b = b.astype(int)
    d = np.abs(a - b)
    if where is not None:
        d = d[where]
    return int(d.max()) if d.size else 0


def premul_diff(a, b):
    """Largest difference of two RGBA pictures as they would show over any backdrop: colour weighted by alpha, and alpha."""
    a = a.astype(float); b = b.astype(float)
    pa = a[..., :3] * a[..., 3:4] / 255.0
    pb = b[..., :3] * b[..., 3:4] / 255.0
    return float(max(np.abs(pa - pb).max(), np.abs(a[..., 3] - b[..., 3]).max()))


# ------------------------------------------------- a .psd written by hand from Adobe's specification
# Photoshop File Format Specification (Adobe, Nov 2019 edition): header, colour mode data, image resources, layer and mask
# information, image data. Layer records: rectangle (top, left, bottom, right), channel count, per channel (id 2 bytes,
# length 4 bytes), '8BIM', blend key, opacity, clipping, flags, filler, extra data length, then mask data, blending
# ranges, Pascal name padded to 4, tagged blocks. Channel image data: compression (0 raw, 1 RLE, 2 ZIP, 3 ZIP with
# prediction), then the data.
def pascal4(name_bytes):
    b = bytes([len(name_bytes)]) + name_bytes
    while len(b) % 4:
        b += b"\0"
    return b


def tagged(key, data, sig=b"8BIM", pad=2):
    while len(data) % pad:
        data += b"\0"
    return sig + key + struct.pack(">I", len(data)) + data


def packbits_row(row):
    out = bytearray(); i = 0; n = len(row)
    while i < n:
        j = i
        while j + 1 < n and row[j + 1] == row[i] and j - i < 127:
            j += 1
        if j > i:
            out += bytes([(257 - (j - i + 1)) & 255, row[i]]); i = j + 1
        else:
            st = i
            while i < n and i - st < 128 and not (i + 1 < n and row[i + 1] == row[i]):
                i += 1
            if i == st:
                i += 1
            out += bytes([i - st - 1]) + bytes(row[st:i])
    return bytes(out)


def chan_data(plane, depth, comp):
    """plane: 2-D numpy array of the channel's samples (uint8, uint16 or float32 for depth 8/16/32)."""
    h, w = plane.shape
    if depth == 8:
        raw = plane.astype(np.uint8).tobytes()
    elif depth == 16:
        raw = plane.astype(">u2").tobytes()
    else:
        raw = plane.astype(">f4").tobytes()
    if comp == 0:
        return struct.pack(">H", 0) + raw
    if comp == 1:
        assert depth == 8
        rows = [packbits_row(plane[y].astype(np.uint8).tobytes()) for y in range(h)]
        return struct.pack(">H", 1) + b"".join(struct.pack(">H", len(r)) for r in rows) + b"".join(rows)
    if comp == 2:
        return struct.pack(">H", 2) + zlib.compress(raw)
    if comp == 3:
        bpr = w * depth // 8
        a = bytearray(raw)
        if depth == 8:
            for y in range(h):
                for x in range(w - 1, 0, -1):
                    a[y * bpr + x] = (a[y * bpr + x] - a[y * bpr + x - 1]) & 255
        elif depth == 16:
            v = np.frombuffer(raw, ">u2").reshape(h, w).astype(np.int64)
            d = v.copy(); d[:, 1:] = (v[:, 1:] - v[:, :-1]) & 0xFFFF
            a = bytearray(d.astype(">u2").tobytes())
        else:
            # Photoshop's 32-bit prediction: each row's bytes rearranged into planes (all first bytes of the row's values,
            # then all second bytes ...), then each byte differenced with the byte before it along the row
            vb = np.frombuffer(raw, np.uint8).reshape(h, w, 4)
            out = bytearray()
            for y in range(h):
                planes = bytes(vb[y, :, 0]) + bytes(vb[y, :, 1]) + bytes(vb[y, :, 2]) + bytes(vb[y, :, 3])
                r = bytearray(planes)
                for k in range(len(r) - 1, 0, -1):
                    r[k] = (r[k] - r[k - 1]) & 255
                out += r
            a = out
        return struct.pack(">H", 3) + zlib.compress(bytes(a))
    raise ValueError(comp)


def psd_by_hand(W, H, layers, depth=8, comp=1, lr_block=None, merged=None, merged_alpha=True, resolution=None,
                version=1):
    """layers: bottom first, each {name_bytes, rect (t,l,b,r), chans: {id: plane}, blend key, opacity 0-255, flags,
    extra: bytes (tagged blocks), luni: str or None, mask: (t,l,b,r,def,flags) or None, clip}.
    lr_block: None (layers in the layer info), or b'Lr16' / b'Lr32' (layer info length 0, layers in that tagged block).
    merged: dict {channel index: plane} for the image data (written raw)."""
    hdr = b"8BPS" + struct.pack(">H", version) + b"\0" * 6
    nch = len(merged) if merged else 3
    hdr += struct.pack(">HIIHH", nch, H, W, depth, 3)
    cmd = struct.pack(">I", 0)
    res = b""
    if resolution:
        r = struct.pack(">IHHIHH", int(resolution * 65536), 1, 1, int(resolution * 65536), 1, 1)
        res = b"8BIM" + struct.pack(">H", 1005) + b"\0\0" + struct.pack(">I", len(r)) + r
    res = struct.pack(">I", len(res)) + res
    recs = b""; datas = b""
    for L in layers:
        t, l, b, r = L["rect"]
        chans = []
        for cid, plane in L["chans"].items():
            cd = chan_data(plane, depth, L.get("comp", comp))
            chans.append((cid, cd))
        rec = struct.pack(">iiiiH", t, l, b, r, len(chans))
        for cid, cd in chans:
            rec += struct.pack(">hI", cid, len(cd))
        rec += b"8BIM" + L.get("blend", b"norm") + bytes([L.get("opacity", 255), 1 if L.get("clip") else 0, L.get("flags", 8), 0])
        ex = b""
        if L.get("mask"):
            mt, ml, mb, mr, mdef, mfl = L["mask"]
            ex += struct.pack(">I", 20) + struct.pack(">iiiiBB", mt, ml, mb, mr, mdef, mfl) + b"\0\0"
        else:
            ex += struct.pack(">I", 0)
        ex += struct.pack(">I", 0)   # blending ranges
        ex += pascal4(L["name_bytes"])
        if L.get("luni") is not None:
            u = L["luni"].encode("utf-16-be")
            ex += tagged(b"luni", struct.pack(">I", len(L["luni"])) + u, pad=4)
        ex += L.get("extra", b"")
        rec += struct.pack(">I", len(ex)) + ex
        recs += rec
        for cid, cd in chans:
            datas += cd
    li = struct.pack(">h", len(layers)) + recs + datas
    if len(li) % 2:
        li += b"\0"
    if lr_block is None:
        lm = struct.pack(">I", len(li)) + li + struct.pack(">I", 0)
    else:
        if len(li) % 4:
            li += b"\0" * (4 - len(li) % 4)
        lm = struct.pack(">I", 0) + struct.pack(">I", 0) + b"8BIM" + lr_block + struct.pack(">I", len(li)) + li
    lm = struct.pack(">I", len(lm)) + lm
    img = struct.pack(">H", 0)
    if merged:
        for c in sorted(merged):
            p = merged[c]
            img += (p.astype(np.uint8).tobytes() if depth == 8 else p.astype(">u2").tobytes() if depth == 16 else p.astype(">f4").tobytes())
    else:
        img += b"\0" * (W * H * 3 * depth // 8)
    return hdr + cmd + res + lm + img
