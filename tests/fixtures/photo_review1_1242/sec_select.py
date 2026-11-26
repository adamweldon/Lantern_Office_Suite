# sec_select.py -- selection arithmetic: wand tolerance and contiguity, colour range fuzziness, feather, expand and
# contract (true distance, against SciPy's Euclidean distance transform), border, smooth, grow, similar, and Layer Via
# Copy of a soft selection.
import io, base64
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from review_core import *

SEC = "select"

def sel_call(pg, fn, img, params, extra=None):
    h, w = img.shape[:2]
    js = """([fn, w, h, b, q]) => { var d = R.id(w, h, b), S = Lantern.photo.sel, m;
      if (fn === 'wand' || fn === 'colorRange') m = S[fn](d, q);
      else if (fn === 'grow' || fn === 'similar') m = S[fn](d, new Uint8Array(q.mask), q.tol);
      else m = S[fn](new Uint8Array(q.mask), w, h, q.r);
      return Array.prototype.slice.call(m); }"""
    r = pg.J(js, [fn, w, h, base64.b64encode(np.ascontiguousarray(img).tobytes()).decode(), params])
    return np.array(r, np.uint8).reshape(h, w)

def run(pg, B):
    # wand: two grey fields 32 apart, a barrier, a copy beyond it
    img = np.zeros((40, 60, 4), np.uint8); img[..., 3] = 255
    img[:, :20, :3] = 100; img[:, 20:30, :3] = 132; img[:, 30:32, :3] = 0; img[:, 32:, :3] = 100; img[5, 5, :3] = 133
    m = sel_call(pg, "wand", img, {"x": 2, "y": 2, "tolerance": 32, "antialias": False})
    B.check(SEC, "wand tolerance 32 from 100: takes 132 (difference of exactly 32: inclusive, as Photoshop's)", m[10, 25] == 255 and m[5, 5] == 0, (int(m[10, 25]), int(m[5, 5])), "(255, 0): 132 in, 133 out")
    B.check(SEC, "wand contiguous: stops at the barrier", m[10, 40] == 0, int(m[10, 40]), 0)
    m = sel_call(pg, "wand", img, {"x": 2, "y": 2, "tolerance": 32, "antialias": False, "contiguous": False})
    B.check(SEC, "wand not contiguous: the same colour beyond the barrier too", m[10, 40] == 255 and m[10, 31] == 0, (int(m[10, 40]), int(m[10, 31])), (255, 0))
    m = sel_call(pg, "wand", img, {"x": 2, "y": 2, "tolerance": 0, "antialias": False})
    B.check(SEC, "wand tolerance 0: only the exact colour", m[10, 25] == 0 and m[10, 10] == 255, (int(m[10, 25]), int(m[10, 10])), (0, 255))
    m = sel_call(pg, "wand", img, {"x": 2, "y": 2, "tolerance": 32})
    B.check(SEC, "wand anti-aliased: the inside of the region stays fully chosen", m[20, 10] == 255 and m[20, 45] == 0, (int(m[20, 10]), int(m[20, 45])), (255, 0))
    # colour range fuzziness: full within half, none at fuzziness, linear between
    ramp = np.zeros((1, 256, 4), np.uint8); ramp[0, :, 0] = np.arange(256); ramp[0, :, 1] = 50; ramp[0, :, 2] = 50; ramp[0, :, 3] = 255
    m = sel_call(pg, "colorRange", ramp, {"colors": [[100, 50, 50]], "fuzziness": 40})[0]
    want = np.where(np.abs(np.arange(256) - 100) <= 20, 255, np.where(np.abs(np.arange(256) - 100) >= 40, 0, np.round(255 * (40 - np.abs(np.arange(256) - 100)) / 20)))
    B.check(SEC, "colour range fuzziness 40: full within 20 levels, fading to none at 40 (the comment's rule)", maxdiff(m, want) <= 1, (m[75:82].tolist(), m[118:125].tolist()), (want[75:82].tolist(), want[118:125].tolist()))
    # expand / contract: a true distance (a circle), against SciPy's Euclidean distance transform
    sq = np.zeros((61, 61), np.uint8); sq[30, 30] = 255
    for r in (3, 7.5, 12):
        e = sel_call(pg, "expand", np.zeros((61, 61, 4), np.uint8), {"mask": sq.ravel().tolist(), "r": r})
        dist = ndi.distance_transform_edt(sq == 0)
        full = dist <= r - 0.5; none = dist >= r + 0.5
        B.check(SEC, "expand a point by %s: a disc (255 within r - 0.5, 0 beyond r + 0.5)" % r, (e[full] == 255).all() and (e[none] == 0).all(), "area %d (disc %.0f)" % ((e >= 128).sum(), np.pi * r * r), "a disc")
    big = np.zeros((61, 61), np.uint8); big[10:51, 10:51] = 255
    c = sel_call(pg, "contract", np.zeros((61, 61, 4), np.uint8), {"mask": big.ravel().tolist(), "r": 5})
    B.check(SEC, "contract a 41 x 41 square by 5: a 31 x 31 square (corners stay square: the distance to outside)", (c >= 128).sum() == 31 * 31 and c[15, 15] == 255 and c[14, 30] == 0, (int((c >= 128).sum()), int(c[15, 15]), int(c[14, 30])), (961, 255, 0))
    e = sel_call(pg, "expand", np.zeros((61, 61, 4), np.uint8), {"mask": big.ravel().tolist(), "r": 5})
    B.check(SEC, "expand a 41 x 41 square by 5: rows 5 and 55 fully chosen (51 px across), as Photoshop's Expand 5 px", e[5, 30] == 255 and e[55, 30] == 255 and e[4, 30] < 128, (int(e[5, 30]), int(e[55, 30]), int(e[4, 30])), (255, 255, "< 128"))
    e1 = sel_call(pg, "expand", np.zeros((61, 61, 4), np.uint8), {"mask": big.ravel().tolist(), "r": 1})
    B.check(SEC, "expand the square by 1: the row next to it fully chosen", e1[9, 30] == 255, int(e1[9, 30]), 255)
    b = sel_call(pg, "border", np.zeros((61, 61, 4), np.uint8), {"mask": big.ravel().tolist(), "r": 6})
    B.check(SEC, "border 6 px of the square: chosen on the edge, not deep inside or far outside", b[10, 30] >= 128 and b[30, 30] == 0 and b[2, 30] == 0, (int(b[10, 30]), int(b[30, 30]), int(b[2, 30])), "(>= 128, 0, 0)")
    f = sel_call(pg, "feather", np.zeros((61, 61, 4), np.uint8), {"mask": big.ravel().tolist(), "r": 4})
    ref = np.clip(np.round(ndi.gaussian_filter(big.astype(float), 4, mode="nearest", truncate=3)), 0, 255)
    B.check(SEC, "feather 4 = a Gaussian of sigma 4 on the selection (<= 1)", maxdiff(f, ref) <= 1, maxdiff(f, ref), "<= 1")
    sp = big.copy(); sp[3, 3] = 255; sp[30, 30] = 0
    s = sel_call(pg, "smooth", np.zeros((61, 61, 4), np.uint8), {"mask": sp.ravel().tolist(), "r": 2})
    B.check(SEC, "smooth 2: a lone speck outside goes, a pinhole inside fills", s[3, 3] < 128 and s[30, 30] >= 128, (int(s[3, 3]), int(s[30, 30])), "(< 128, >= 128)")
    # grow and similar
    img2 = np.zeros((30, 60, 4), np.uint8); img2[..., 3] = 255; img2[:, :, :3] = 200; img2[:, 28:32, :3] = 0; img2[10:20, 5:15, :3] = 210; img2[10:20, 40:50, :3] = 205
    seed = np.zeros((30, 60), np.uint8); seed[0:3, 0:3] = 255
    g = sel_call(pg, "grow", img2, {"mask": seed.ravel().tolist(), "tol": 12})
    B.check(SEC, "grow (tolerance 12): spreads over its joined like colours, stops at the black bar", g[15, 10] == 255 and g[5, 20] == 255 and g[15, 45] == 0, (int(g[15, 10]), int(g[5, 20]), int(g[15, 45])), (255, 255, 0))
    sm = sel_call(pg, "similar", img2, {"mask": seed.ravel().tolist(), "tol": 12})
    B.check(SEC, "similar (tolerance 12): like colours anywhere, not the black bar", sm[15, 45] == 255 and sm[5, 50] == 255 and sm[5, 29] == 0, (int(sm[15, 45]), int(sm[5, 50]), int(sm[5, 29])), (255, 255, 0))
    # Layer Via Copy of a soft (feathered) selection: the new layer's alpha is the selection, colours kept
    rng = np.random.default_rng(1); ph = np.clip(rng.normal(120, 40, (80, 100, 3)), 0, 255).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(ph).save(buf, "PNG"); pg.open(buf.getvalue(), "lv.png", "lv")
    pg.J("(k) => { var d = R.docs[k], O = Lantern.photo.ops; O.exec(d, 'selectShape', {shape: 'rect', x: 20, y: 20, w: 60, h: 40}); O.exec(d, 'modify', {how: 'feather', px: 5}); O.exec(d, 'layerVia', {}); return true; }", "lv")
    selm = pg.J("(k) => Array.prototype.slice.call(Lantern.photo.doc.selMask(R.docs[k]))", "lv"); selm = np.array(selm, np.uint8).reshape(80, 100)
    x, y, lay = pg.layer("lv", 1)
    B.check(SEC, "layer via copy of a feathered selection: the new layer's alpha is the selection", maxdiff(lay[:, :, 3], selm) <= 1, maxdiff(lay[:, :, 3], selm), "<= 1")
    m = lay[:, :, 3] >= 64
    B.check(SEC, "layer via copy of a feathered selection: colours kept where alpha >= 64 (<= 2)", np.abs(lay[:, :, :3].astype(int) - ph.astype(int))[m].max() <= 2, np.abs(lay[:, :, :3].astype(int) - ph.astype(int))[m].max(), "<= 2")
    flat = pg.flat("lv")
    B.check(SEC, "layer via copy: the picture looks the same (the copy over its own original)", maxdiff(flat[:, :, :3], ph) <= 1, maxdiff(flat[:, :, :3], ph), "<= 1")
    # a filter inside a soft selection: changed as much as the selection is soft
    pg.open(buf.getvalue(), "lv.png", "lv2")
    pg.J("(k) => { var d = R.docs[k], O = Lantern.photo.ops; O.exec(d, 'selectShape', {shape: 'rect', x: 20, y: 20, w: 60, h: 40}); O.exec(d, 'modify', {how: 'feather', px: 5}); O.exec(d, O.adjustCmd('invert'), {}); return true; }", "lv2")
    selm2 = np.array(pg.J("(k) => Array.prototype.slice.call(Lantern.photo.doc.selMask(R.docs[k]))", "lv2"), np.uint8).reshape(80, 100) / 255.0
    f2 = pg.flat("lv2")[:, :, :3].astype(float)
    want = ph * (1 - selm2[..., None]) + (255 - ph.astype(float)) * selm2[..., None]
    B.check(SEC, "invert inside a feathered selection = old + (new - old) x selection (<= 1)", np.abs(f2 - want).max() <= 1.01, "%.2f" % np.abs(f2 - want).max(), "<= 1")
