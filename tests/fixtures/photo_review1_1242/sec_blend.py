# sec_blend.py -- the 27 blending modes (Lantern.photo.blend.draw onto a canvas) against the W3C Compositing and Blending
# Level 1 formulas, and the commonly published Photoshop formulas for the ten Lantern works out itself; opaque and
# partly see-through backdrops and sources, opacity below 100%.
import base64
import numpy as np
from review_core import *

SEC = "blend"

def lum(c): return 0.3 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2]
def clipcolor(c):
    l = lum(c)[..., None]; n = c.min(-1, keepdims=True); x = c.max(-1, keepdims=True)
    c = np.where(n < 0, l + (c - l) * l / np.where(l - n == 0, 1, l - n), c)
    c = np.where(x > 1, l + (c - l) * (1 - l) / np.where(x - l == 0, 1, x - l), c)
    return c
def setlum(c, l): return clipcolor(c + (l - lum(c))[..., None])
def sat(c): return c.max(-1) - c.min(-1)
def setsat(c, s):
    out = np.zeros_like(c)
    for i in np.ndindex(c.shape[:-1]):
        v = c[i]; o = np.argsort(v, kind="stable"); mn, md, mx = o
        r = np.zeros(3)
        if v[mx] > v[mn]:
            r[md] = (v[md] - v[mn]) * s[i] / (v[mx] - v[mn]); r[mx] = s[i]
        out[i] = r
    return out
def softlight(b, s):
    d = np.where(b <= 0.25, ((16 * b - 12) * b + 4) * b, np.sqrt(b))
    return np.where(s <= 0.5, b - (1 - 2 * s) * b * (1 - b), b + (2 * s - 1) * (d - b))
def burn(b, s): return np.where(b >= 1, 1, np.where(s <= 0, 0, 1 - np.minimum(1, (1 - b) / np.where(s <= 0, 1, s))))
def dodge(b, s): return np.where(b <= 0, 0, np.where(s >= 1, 1, np.minimum(1, b / np.where(s >= 1, 1, 1 - s))))
def hardlight(b, s): return np.where(s <= 0.5, b * 2 * s, 1 - (1 - b) * (1 - (2 * s - 1)))
SEPF = {
    "normal": lambda b, s: s, "multiply": lambda b, s: b * s, "screen": lambda b, s: b + s - b * s, "overlay": lambda b, s: hardlight(s, b),
    "darken": np.minimum, "lighten": np.maximum, "color-dodge": dodge, "color-burn": burn, "hard-light": hardlight, "soft-light": softlight,
    "difference": lambda b, s: np.abs(b - s), "exclusion": lambda b, s: b + s - 2 * b * s,
    "linear-dodge": lambda b, s: np.minimum(1, b + s),
    # Photoshop's, as commonly published
    "linear-burn": lambda b, s: np.maximum(0, b + s - 1),
    "vivid-light": lambda b, s: np.where(s <= 0.5, burn(b, 2 * s), dodge(b, 2 * s - 1)),
    "linear-light": lambda b, s: np.clip(b + 2 * s - 1, 0, 1),
    "pin-light": lambda b, s: np.where(s <= 0.5, np.minimum(b, 2 * s), np.maximum(b, 2 * s - 1)),
    "hard-mix": lambda b, s: np.where(b + s >= 1, 1.0, 0.0),
    "subtract": lambda b, s: np.maximum(0, b - s),
    "divide": lambda b, s: np.where(s <= 0, np.where(b > 0, 1.0, 0.0), np.minimum(1, b / np.where(s <= 0, 1, s))),
}
def nonsep(mode, b, s):
    if mode == "hue": return setlum(setsat(s, sat(b)), lum(b))
    if mode == "saturation": return setlum(setsat(b, sat(s)), lum(b))
    if mode == "color": return setlum(s, lum(b))
    if mode == "luminosity": return setlum(b, lum(s))
    l601 = lambda c: 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]
    if mode == "darker-color": return np.where((l601(s) < l601(b))[..., None], s, b)
    if mode == "lighter-color": return np.where((l601(s) > l601(b))[..., None], s, b)

def reference(mode, back, src, opacity):
    b = back[..., :3] / 255.0; ab = back[..., 3:] / 255.0; s = src[..., :3] / 255.0; as_ = src[..., 3:] / 255.0 * opacity
    Bm = SEPF[mode](b, s) if mode in SEPF else nonsep(mode, b, s)
    ao = as_ + ab * (1 - as_)
    co = as_ * (1 - ab) * s + as_ * ab * Bm + (1 - as_) * ab * b
    col = np.where(ao > 0, co / np.where(ao > 0, ao, 1), 0)
    return np.concatenate([col * 255, ao * 255], -1)

def run(pg, B):
    rng = np.random.default_rng(12)
    n = 24
    back = rng.integers(0, 256, (n, n, 4)).astype(np.uint8); src = rng.integers(0, 256, (n, n, 4)).astype(np.uint8)
    # edge values
    back[0, :, :3] = [0, 0, 0]; back[1, :, :3] = 255; src[:, 0, :3] = 0; src[:, 1, :3] = 255; src[:, 2, :3] = 128
    opaque_b = back.copy(); opaque_b[..., 3] = 255; opaque_s = src.copy(); opaque_s[..., 3] = 255
    soft_b = back.copy(); soft_b[..., 3] = rng.choice([255, 200, 128, 60], (n, n)).astype(np.uint8)
    soft_s = src.copy(); soft_s[..., 3] = rng.choice([255, 180, 100, 40], (n, n)).astype(np.uint8)
    modes = pg.J("Lantern.photo.doc.BLENDS")
    B.check(SEC, "27 blending modes listed", len(modes) == 27, len(modes), 27)
    # the canvas holds colour premultiplied, so a see-through pixel's colour is already rounded when it is put in: the formula
    # is given the backdrop and source as the canvas holds them (read back before drawing)
    js = """([bb, sb, n, mode, op]) => { var b = R.canvasOf(n, n, bb), s = R.canvasOf(n, n, sb), g = b.getContext('2d');
        var b0 = R.b64(R.pixels(b)), s0 = R.b64(R.pixels(s));
        Lantern.photo.blend.draw(g, s, mode, op, 0, 0); return [R.b64(R.pixels(b)), b0, s0]; }"""
    def run_js(bk, sr, n, mode, op):
        r = pg.J(js, [base64.b64encode(bk.tobytes()).decode(), base64.b64encode(sr.tobytes()).decode(), n, mode, op])
        f = lambda x: np.frombuffer(base64.b64decode(x), np.uint8).reshape(n, n, 4)
        return f(r[0]).astype(int), f(r[1]), f(r[2])
    for mode in modes:
        if mode == "dissolve": continue
        for label, bk, sr, op in [("opaque", opaque_b, opaque_s, 1.0), ("opaque, 60% opacity", opaque_b, opaque_s, 0.6), ("see-through backdrop and source, 70%", soft_b, soft_s, 0.7)]:
            got, bk, sr = run_js(bk, sr, n, mode, op)
            ref = reference(mode, bk.astype(float), sr.astype(float), op)
            m = ref[..., 3] >= 64
            # the result is held premultiplied too: a colour step of 255 / alpha, so the tolerance is 2 + 2 * 255 / alpha
            allow = 2 + 510.0 / np.maximum(ref[..., 3], 1)
            over = (np.abs(got[..., :3] - ref[..., :3]).max(-1) - allow)[m]
            dc = np.abs(got[..., :3] - ref[..., :3])[m].max(); da = np.abs(got[..., 3] - ref[..., 3]).max()
            ok = over.max() <= 0 and da <= 2
            info = "colour max %d, alpha max %d" % (dc, da)
            if not ok:
                bad = (np.abs(got[..., :3] - ref[..., :3]).max(-1) * m + np.abs(got[..., 3] - ref[..., 3])).argmax(); ij = np.unravel_index(bad, (n, n))
                info += "; e.g. backdrop %s source %s -> Lantern %s, formula %s" % (bk[ij].tolist(), sr[ij].tolist(), got[ij].tolist(), np.round(ref[ij]).astype(int).tolist())
            B.check(SEC, "%s, %s = %s formula (colour within 2 + 510/alpha, alpha <= 2)" % (mode, label, "W3C" if mode in ("normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity") else "Photoshop's published"), ok, info, "within")
    # Dissolve: each pixel whole or not shown, in proportion to opacity
    big = 200
    bk = np.zeros((big, big, 4), np.uint8); bk[..., 2] = 255; bk[..., 3] = 255
    sr = np.zeros((big, big, 4), np.uint8); sr[..., 0] = 255; sr[..., 3] = 255
    got = run_js(bk, sr, big, "dissolve", 0.3)[0]
    frac = (got[..., 0] == 255).mean(); mixed = ((got[..., 0] != 255) & (got[..., 0] != 0)).sum()
    B.check(SEC, "dissolve at 30%: about 30% of pixels are the source, none blended", abs(frac - 0.3) < 0.02 and mixed == 0, "%.3f source, %d blended" % (frac, mixed), "0.30, 0")
