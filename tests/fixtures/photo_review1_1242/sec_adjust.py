# sec_adjust.py -- Image > Adjustments against independent formulas (numpy, scipy, OpenCV) and the claims in the
# module comments; greys that must stay grey, alpha that must stay, identities, extremes.
import numpy as np, json
from review_core import *

SEC = "adjust"

def test_picture():
    """greys, primaries and secondaries, a hue wheel, a soft gradient, and partly see-through pixels"""
    h, w = 64, 96
    a = np.zeros((h, w, 4), np.uint8); a[:, :, 3] = 255
    a[0:8, :, :3] = np.repeat(np.linspace(0, 255, w).round().astype(np.uint8)[None, :, None], 3, 2)[0:1]   # grey ramp
    hues = np.linspace(0, 360, w, endpoint=False)
    import colorsys
    for x in range(w):
        for row, (s, l) in enumerate([(1, 0.5), (0.6, 0.4), (0.3, 0.7), (1, 0.25)]):
            r, g, b = colorsys.hls_to_rgb(hues[x] / 360, l, s)
            a[8 + row * 8: 16 + row * 8, x, :3] = np.round(np.array([r, g, b]) * 255)
    rng = np.random.default_rng(2)
    a[40:56, :, :3] = rng.integers(0, 256, (16, w, 3))
    a[56:64, :, :3] = rng.integers(60, 180, (8, w, 3))
    a[56:64, :, 3] = np.tile(np.linspace(0, 255, w).round().astype(np.uint8), (8, 1))
    prim = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (0, 255, 255), (255, 0, 255), (255, 255, 255), (0, 0, 0), (128, 128, 128)]
    for i, c in enumerate(prim): a[40:44, i * 4:i * 4 + 4, :3] = c
    return a

def lum601(a): return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

def run(pg, B):
    T = test_picture(); A = T.astype(float)
    grey = (T[:, :, 0] == T[:, :, 1]) & (T[:, :, 1] == T[:, :, 2])
    def P(name, params=None, img=None):
        out, ms = pg.pure("adjust." + name, T if img is None else img, params if params is not None else {})
        return out
    def alpha_kept(name, out):
        return B.check(SEC, "%s: alpha untouched" % name, np.array_equal(out[:, :, 3], T[:, :, 3]), "alpha changed at %d" % int((out[:, :, 3] != T[:, :, 3]).sum()), 0)
    def greys_grey(name, out):
        g = out[grey]
        return B.check(SEC, "%s: greys stay grey" % name, (np.abs(g[:, 0].astype(int) - g[:, 1]) <= 0).all() and (np.abs(g[:, 1].astype(int) - g[:, 2]) <= 0).all(),
                       "a grey became %s" % g[(g[:, 0] != g[:, 1]) | (g[:, 1] != g[:, 2])][:1].tolist(), "R = G = B")
    # identities
    for name, p in [("levels", {}), ("curves", {}), ("brightness", {}), ("brightness", {"legacy": True}), ("exposure", {}), ("hueSat", {}), ("vibrance", {}), ("colorBalance", {}),
                    ("channelMixer", {}), ("photoFilter", {"density": 0}), ("curves", {"rgb": [[0, 0], [255, 255]]})]:
        o = P(name, p)
        B.check(SEC, "%s %s: neutral settings leave the picture as it was" % (name, json.dumps(p)), maxdiff(o, T) == 0, "max diff %d" % maxdiff(o, T), 0)
    # Levels
    def lev(x, ib=0, iw=255, g=1.0, ob=0, ow=255):
        v = np.clip((x - ib) / (iw - ib), 0, 1) ** (1 / g); return np.clip(np.round(ob + v * (ow - ob)), 0, 255)
    p = {"inBlack": 20, "inWhite": 230, "gamma": 1.6, "outBlack": 10, "outWhite": 245}
    o = P("levels", p); want = lev(A[:, :, :3], 20, 230, 1.6, 10, 245)
    B.check(SEC, "levels 20/1.6/230 -> 10..245: the published sum (<= 0)", maxdiff(o[:, :, :3], want) <= 0, maxdiff(o[:, :, :3], want), 0)
    alpha_kept("levels", o); greys_grey("levels", o)
    p = {"r": {"inWhite": 200}, "gamma": 0.7}
    o = P("levels", p); want = A[:, :, :3].copy(); want[:, :, 0] = lev(want[:, :, 0], 0, 200); want = lev(want, g=0.7)
    B.check(SEC, "levels: red channel 0..200, then RGB gamma 0.7 (channel first, as the comment says) (<= 1)", maxdiff(o[:, :, :3], want) <= 1, maxdiff(o[:, :, :3], want), "<= 1")
    o = P("levels", {"inBlack": 100, "inWhite": 100})
    B.check(SEC, "levels with input black = input white (100): a hard step at 100, no NaN", set(np.unique(o[:, :, :3])) <= {0, 255} and o[0, 0, 0] == 0 and o[0, -1, 0] == 255, np.unique(o[:, :, :3])[:6].tolist(), "0 and 255")
    # Curves: through its points, a natural spline (scipy), flat beyond the end points
    from scipy.interpolate import CubicSpline
    pts = [[0, 0], [64, 40], [192, 220], [255, 255]]
    o = P("curves", {"rgb": pts}); cs = CubicSpline([p_[0] for p_ in pts], [p_[1] for p_ in pts], bc_type="natural")
    want = np.clip(np.round(cs(A[:, :, :3])), 0, 255)
    B.check(SEC, "curves through 4 points = scipy's natural cubic spline (<= 1)", maxdiff(o[:, :, :3], want) <= 1, maxdiff(o[:, :, :3], want), "<= 1")
    lut = P("curves", {"rgb": [[30, 50], [100, 160], [220, 200]]}, img=np.dstack([np.arange(256, dtype=np.uint8)[None, :]] * 3 + [np.full((1, 256), 255, np.uint8)]))[0, :, 0]
    B.check(SEC, "curves: passes exactly through each point and is flat beyond the end points", lut[30] == 50 and lut[100] == 160 and lut[220] == 200 and (lut[:30] == 50).all() and (lut[221:] == 200).all(), (int(lut[30]), int(lut[100]), int(lut[220]), int(lut[0]), int(lut[255])), (50, 160, 200, 50, 200))
    lut2 = P("curves", {"rgb": [[0, 0], [128, 100], [128, 160], [255, 255]]}, img=np.dstack([np.arange(256, dtype=np.uint8)[None, :]] * 3 + [np.full((1, 256), 255, np.uint8)]))[0, :, 0]
    B.check(SEC, "curves with two points at one input (128): no hole of zeros (NaN) in the table", not (lut2[1:255] == 0).any(), "zeros at inputs %s" % np.where(lut2 == 0)[0][:10].tolist(), "none past 0")
    # Posterize, Threshold, Invert, Desaturate
    for n in (2, 4, 7):
        o = P("posterize", {"levels": n}); want = np.floor(A[:, :, :3] * n / 256) * 255 / (n - 1)
        B.check(SEC, "posterize %d: floor(x n / 256) * 255 / (n-1) (as psd-tools' Photoshop formula) (<= 1)" % n, maxdiff(o[:, :, :3], np.round(want)) <= 1 and len(np.unique(o[:, :, :3])) <= n, (maxdiff(o[:, :, :3], np.round(want)), len(np.unique(o[:, :, :3]))), "<= 1, <= %d values" % n)
    o = P("threshold", {"level": 128}); want = np.where(lum601(A) >= 128, 255, 0)
    B.check(SEC, "threshold 128: Rec.601 luminance >= 128 is white", np.array_equal(o[:, :, 0], want) and np.array_equal(o[:, :, 0], o[:, :, 2]), int((o[:, :, 0] != want).sum()), 0)
    o = P("invert"); B.check(SEC, "invert: 255 - x, alpha kept", np.array_equal(o[:, :, :3], 255 - T[:, :, :3]) and np.array_equal(o[:, :, 3], T[:, :, 3]), "", "")
    o = P("desaturate"); want = np.floor((A[:, :, :3].max(2) + A[:, :, :3].min(2)) / 2 + 0.5)
    B.check(SEC, "desaturate: HSL lightness (max + min) / 2", maxdiff(o[:, :, 0], want) == 0 and np.array_equal(o[:, :, 0], o[:, :, 1]), maxdiff(o[:, :, 0], want), 0)
    # Equalize vs OpenCV on a grey picture
    import cv2
    rng = np.random.default_rng(4); gp = np.clip(rng.normal(110, 18, (80, 120)), 0, 255).astype(np.uint8)
    o = P("equalize", img=rgba(gp)); want = cv2.equalizeHist(gp)
    B.check(SEC, "equalize on a grey picture = OpenCV's equalizeHist (<= 1)", maxdiff(o[:, :, 0], want) <= 1, maxdiff(o[:, :, 0], want), "<= 1")
    o = P("equalize"); greys_grey("equalize", o); alpha_kept("equalize", o)
    # Brightness/Contrast
    o = P("brightness", {"brightness": 40, "contrast": 30, "legacy": True})
    slope = 100 / 70.0; want = np.clip(np.round((A[:, :, :3] + 40 - 127.5) * slope + 127.5), 0, 255)
    B.check(SEC, "brightness/contrast legacy +40/+30: (x + b - 127.5) * 100/(100-c) + 127.5 (<= 1)", maxdiff(o[:, :, :3], want) <= 1, maxdiff(o[:, :, :3], want), "<= 1")
    o = P("brightness", {"brightness": 60, "contrast": 40}); greys_grey("brightness (modern)", o); alpha_kept("brightness", o)
    ramp = o[0, :, 0].astype(int)
    B.check(SEC, "brightness (modern) +60/+40: the tone curve rises (monotone)", (np.diff(ramp) >= 0).all(), ramp[::12].tolist(), "rising")
    # Exposure in linear light
    def lin(x): x = x / 255.0; return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
    def enc(v): v = np.clip(v, 0, None); v = np.where(v <= 0.0031308, 12.92 * v, 1.055 * v ** (1 / 2.4) - 0.055); return np.clip(np.round(v * 255), 0, 255)
    o = P("exposure", {"exposure": 1}); want = enc(lin(A[:, :, :3]) * 2)
    B.check(SEC, "exposure +1 stop: twice the linear light (<= 1)", maxdiff(o[:, :, :3], want) <= 1, maxdiff(o[:, :, :3], want), "<= 1")
    o = P("exposure", {"exposure": -1.5, "offset": 0.02, "gamma": 1.4}); want = enc((np.clip(lin(A[:, :, :3]) * 2 ** -1.5 + 0.02, 0, None)) ** (1 / 1.4))
    B.check(SEC, "exposure -1.5, offset 0.02, gamma 1.4 (<= 1)", maxdiff(o[:, :, :3], want) <= 1, maxdiff(o[:, :, :3], want), "<= 1")
    # Channel mixer, Gradient map, Black & White
    o = P("channelMixer", {"r": [50, 30, 20, 0], "g": [0, 100, 0, 10], "b": [-20, 0, 120, 0]})
    want = np.dstack([0.5 * A[:, :, 0] + 0.3 * A[:, :, 1] + 0.2 * A[:, :, 2], A[:, :, 1] + 25.5, -0.2 * A[:, :, 0] + 1.2 * A[:, :, 2]])
    B.check(SEC, "channel mixer rows and constant (<= 1)", maxdiff(o[:, :, :3], np.clip(np.round(want), 0, 255)) <= 1, maxdiff(o[:, :, :3], np.clip(np.round(want), 0, 255)), "<= 1")
    try:
        o = P("channelMixer", {"mono": True})
        B.check(SEC, "channel mixer Monochrome ticked with no rows given: a grey picture, no error", np.array_equal(o[:, :, 0], o[:, :, 1]), "", "grey")
    except Exception as e:
        B.check(SEC, "channel mixer Monochrome ticked with no rows given: a grey picture, no error", False, str(e).split("\n")[0][:160], "grey")
    o = P("gradientMap"); want = np.clip(np.round(lum601(A)), 0, 255)
    B.check(SEC, "gradient map black to white = Rec.601 grey (<= 1)", maxdiff(o[:, :, 0], want) <= 1 and np.array_equal(o[:, :, 0], o[:, :, 2]), maxdiff(o[:, :, 0], want), "<= 1")
    o = P("blackWhite"); greys_grey("black & white", o)
    sw = {(255, 0, 0): 102, (255, 255, 0): 153, (0, 255, 0): 102, (0, 255, 255): 153, (0, 0, 255): 51, (255, 0, 255): 204}
    got = {c: int(o[40, i * 4, 0]) for i, c in enumerate([(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (0, 255, 255), (255, 0, 255)])}
    B.check(SEC, "black & white defaults (40 60 40 60 20 80): pure colours give their percentage of 255", all(abs(got[c] - sw[c]) <= 1 for c in got), got, sw)
    B.check(SEC, "black & white: grey stays its own level (128 -> 128)", o[40, 32, 0] == 128 and o[0, 50, 0] == T[0, 50, 0], (int(o[40, 32, 0]), int(o[0, 50, 0])), (128, int(T[0, 50, 0])))
    # Hue/Saturation
    o = P("hueSat", {"hue": 120})
    B.check(SEC, "hue +120: pure red -> pure green, green -> blue", o[40, 0, :3].tolist() == [0, 255, 0] and o[40, 4, :3].tolist() == [0, 0, 255], (o[40, 0, :3].tolist(), o[40, 4, :3].tolist()), ([0, 255, 0], [0, 0, 255]))
    greys_grey("hue +120", o); alpha_kept("hueSat", o)
    o = P("hueSat", {"saturation": -100}); want = np.floor((A[:, :, :3].max(2) + A[:, :, :3].min(2)) / 2 + 0.5)
    B.check(SEC, "saturation -100 = Desaturate's HSL lightness (<= 1)", maxdiff(o[:, :, 0], want) <= 1, maxdiff(o[:, :, 0], want), "<= 1")
    o = P("hueSat", {"saturation": 60}); greys_grey("saturation +60", o)
    hs = np.array([[[0, 0, 0]]])
    o = P("hueSat", {"reds": {"saturation": -100}})
    B.check(SEC, "reds saturation -100: pure red goes grey, pure blue and green untouched", (o[40, 0, 0] == o[40, 0, 1] == o[40, 0, 2]) and o[40, 4, :3].tolist() == [0, 255, 0] and o[40, 8, :3].tolist() == [0, 0, 255], (o[40, 0, :3].tolist(), o[40, 4, :3].tolist(), o[40, 8, :3].tolist()), "grey, [0,255,0], [0,0,255]")
    o = P("hueSat", {"lightness": 100}); B.check(SEC, "lightness +100: white", (o[:, :, :3] == 255).all(), np.unique(o[:, :, :3])[:5].tolist(), "all 255")
    o = P("hueSat", {"lightness": -100}); B.check(SEC, "lightness -100: black", (o[:, :, :3] == 0).all(), np.unique(o[:, :, :3])[:5].tolist(), "all 0")
    o = P("hueSat", {"colorize": True, "hue": 200, "saturation": 60})
    from colorsys import rgb_to_hls
    hh = [rgb_to_hls(*(o[40, i * 4, :3] / 255.0)) for i in range(9)]
    B.check(SEC, "colorize: every pixel takes hue 200 and saturation 60 (greys too)", all(abs(h_[0] * 360 - 200) < 3 and abs(h_[2] - 0.6) < 0.05 for h_ in hh if 0.04 < h_[1] < 0.96), [(round(h_[0] * 360), round(h_[2], 2)) for h_ in hh], "200, 0.6")
    yl = o[40, 12, :3]
    B.info(SEC, "colorize hue 200 sat 60 on pure yellow (HSL lightness 0.5, Rec.601 luminance 0.886): Lantern gives", "%s (psd-tools, which keeps HSL lightness, gives [51, 153, 204])" % yl.tolist())
    # Color balance, vibrance, photo filter
    o = P("colorBalance", {"midtones": [40, -20, 10], "preserve": True}); alpha_kept("colorBalance", o)
    o = P("vibrance", {"vibrance": 100}); greys_grey("vibrance +100", o)
    sat_before = (A[8:16, :, :3].max(2) - A[8:16, :, :3].min(2)).mean(); sat_dull = (A[24:32, :, :3].max(2) - A[24:32, :, :3].min(2)).mean()
    sb = (o[8:16, :, :3].astype(float).max(2) - o[8:16, :, :3].min(2)).mean(); sd = (o[24:32, :, :3].astype(float).max(2) - o[24:32, :, :3].min(2)).mean()
    B.check(SEC, "vibrance +100: dull colours gain more than strong ones", (sd - sat_dull) > (sb - sat_before), (round(sd - sat_dull, 1), round(sb - sat_before, 1)), "dull gain > strong gain")
    o = P("photoFilter", {"color": [236, 138, 0], "density": 50})
    d = np.abs(lum601(o.astype(float)) - lum601(A))[8:40]
    B.check(SEC, "photo filter with Preserve Luminosity keeps each pixel's Rec.601 lightness (<= 1.5) where colours are not clipped", np.percentile(d, 95) <= 1.5, "95th percentile %.2f, max %.1f" % (np.percentile(d, 95), d.max()), "<= 1.5")
    # Auto: a dull picture
    rng = np.random.default_rng(7); dull = np.clip(rng.normal(0, 1, (60, 80, 1)) * 25 + np.array([120, 110, 90]), 60, 180).astype(np.uint8)
    o = P("autoContrast", img=rgba(dull)); lo, hi = o[:, :, :3].min(), o[:, :, :3].max()
    B.check(SEC, "auto contrast: a dull picture (60..180) spread to near 0..255", lo <= 3 and hi >= 252, (int(lo), int(hi)), "about 0..255")
    gg = rgba(np.dstack([np.clip(rng.normal(120, 20, (60, 80)), 0, 255).astype(np.uint8)] * 3))
    o = P("autoContrast", img=gg); B.check(SEC, "auto contrast on a grey picture: stays grey", np.array_equal(o[:, :, 0], o[:, :, 2]), "", "")
    o = P("autoColor", img=rgba(dull)); m = o[:, :, :3].reshape(-1, 3).astype(float); mid = m[(lum601(m) > 60) & (lum601(m) < 200)].mean(0)
    B.check(SEC, "auto color: the mid tones of a picture with a warm cast average near grey (channel means within 6)", mid.max() - mid.min() <= 6, mid.round(1).tolist(), "within 6")
    # extremes: nothing out of range or NaN (shown as 0) where it should not be
    o = P("exposure", {"exposure": 20}); B.check(SEC, "exposure +20: all white, nothing wrapped", (o[:, :, :3][T[:, :, :3] > 0] == 255).all(), np.unique(o[:, :, :3])[:4].tolist(), "255 wherever there was light")
    o = P("brightness", {"brightness": 0, "contrast": 100, "legacy": True}); B.check(SEC, "legacy contrast 100: a threshold at mid grey", set(np.unique(o[:, :, :3])) <= {0, 255}, np.unique(o[:, :, :3])[:6].tolist(), "0 and 255")
    o = P("levels", {"gamma": 0}); B.check(SEC, "levels gamma 0 (an empty box): no change rather than garbage", maxdiff(o, T) == 0, maxdiff(o, T), 0)
    # Auto Tone / Contrast / Color as the Image menu runs them: api.exec(P.ops.adjustCmd("autoContrast"), {})
    import io
    from PIL import Image
    buf = io.BytesIO(); Image.fromarray(dull).save(buf, "PNG"); pg.open(buf.getvalue(), "dull.png", "dull")
    for cmd in ("autoTone", "autoContrast", "autoColor"):
        pg.open(buf.getvalue(), "dull.png", "dull_" + cmd)
        pg.J("([k, c]) => { var d = R.docs[k], O = Lantern.photo.ops; O.exec(d, O.adjustCmd(c), {}); return true; }", ["dull_" + cmd, cmd])
        f = pg.flat("dull_" + cmd)
        B.check(SEC, "Image > Auto %s as the menu calls it (exec(adjustCmd('%s'), {})): the dull picture (60..180) is stretched" % (cmd[4:], cmd), f[:, :, :3].min() <= 10 and f[:, :, :3].max() >= 245,
                "range %d..%d" % (f[:, :, :3].min(), f[:, :, :3].max()), "about 0..255")
    o, _ = pg.pure("adjust.autoContrast", rgba(dull), None)
    r = pg.J("([w, h, b]) => { var d = R.id(w, h, b); Lantern.photo.adjust.autoContrast(d); return [Math.min.apply(null, Array.prototype.filter.call(d.data, function (v, i) { return i % 4 < 3; })), Math.max.apply(null, Array.prototype.filter.call(d.data, function (v, i) { return i % 4 < 3; }))]; }",
             [80, 60, base64.b64encode(rgba(dull).tobytes()).decode()])
    B.info(SEC, "autoContrast called with no second argument (clip undefined) stretches to", r)
