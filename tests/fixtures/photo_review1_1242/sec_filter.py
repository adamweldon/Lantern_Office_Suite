# sec_filter.py -- filters and resampling against SciPy, OpenCV, PIL and ImageMagick: Gaussian at many radii and sizes
# (the exact path and the six-box path), box, median, minimum/maximum, unsharp, high pass, motion blur, emboss, find edges,
# add noise statistics, resize each way, rotate, perspective; edges, transparency, odd sizes.
import io, os, json, subprocess, time, base64
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from review_core import *

SEC = "filter"

def photo(w, h, seed=1):
    """a smooth-plus-detail picture: shapes, gradients and fine noise (numpy)"""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    r = 128 + 90 * np.sin(xx / max(w, 1) * 6.3) * np.cos(yy / max(h, 1) * 4.1)
    g = 60 + 150 * (xx + yy) / (w + h)
    b = np.where(((xx - w * 0.6) ** 2 + (yy - h * 0.4) ** 2) < (min(w, h) * 0.25) ** 2, 230, 40)
    a = np.dstack([r, g, b]) + rng.normal(0, 10, (h, w, 3))
    return rgba(np.clip(a, 0, 255).round().astype(np.uint8))

def sep_resize(a, W, H, f, r):
    """an independent separable resampler: pixel centres, kernel widened when shrinking, weights normalised, edges extended"""
    def wts(n, N):
        sc = n / N; fs = max(1, sc); out = []
        for o in range(N):
            c = (o + 0.5) * sc; lo = int(np.floor(c - r * fs)); hi = int(np.ceil(c + r * fs))
            idx = np.arange(lo, hi + 1); w = np.array([f((i + 0.5 - c) / fs) for i in idx]); w /= w.sum()
            out.append((np.clip(idx, 0, n - 1), w))
        return out
    a = a.astype(float)
    t = np.stack([sum(a[:, i] * ww for i, ww in zip(*e)) for e in wts(a.shape[1], W)], 1)
    return np.stack([sum(t[i] * ww for i, ww in zip(*e)) for e in wts(a.shape[0], H)], 0)

def _cubic(a):
    def f(x):
        x = abs(x)
        return (a + 2) * x ** 3 - (a + 3) * x ** 2 + 1 if x < 1 else (a * x ** 3 - 5 * a * x ** 2 + 8 * a * x - 4 * a if x < 2 else 0)
    return f
KER = {"bilinear": (lambda x: max(0, 1 - abs(x)), 1), "bicubic": (_cubic(-0.5), 2), "lanczos": (lambda x: (np.sinc(x) * np.sinc(x / 3)) if abs(x) < 3 else 0, 3)}

def gauss_ref(a, s):
    return np.dstack([ndi.gaussian_filter(a[:, :, c].astype(float), s, mode="nearest", truncate=3.0) for c in range(3)])

def run(pg, B):
    F = lambda name, img, p=None: pg.pure("filter." + name, img, p if p is not None else {})
    img = photo(203, 151)
    # Gaussian, exact path
    for s in (0.3, 0.5, 1, 2.5, 4, 8, 20):
        o, ms = F("gaussian", img, {"radius": s}); ref = gauss_ref(img, s)
        d = np.abs(o[:, :, :3].astype(float) - ref)
        B.check(SEC, "gaussian radius %s on 203 x 151 = scipy gaussian_filter(sigma=%s, nearest) (max <= 1)" % (s, s), d.max() <= 1.01, "max %.2f mean %.3f" % (d.max(), d.mean()), "<= 1")
    # the six-box path: 2400 x 1600 at radius 10, and 1000 x 800 at radius 60 (claim: at most 4 levels, under 1 on average)
    for (w, h, s) in [(2400, 1600, 10), (1000, 800, 60), (3000, 4000, 2)]:
        big = photo(w, h, 3)
        t0 = time.time(); o, ms = F("gaussian", big, {"radius": s}); ref = gauss_ref(big, s)
        d = np.abs(o[:, :, :3].astype(float) - ref)
        B.check(SEC, "gaussian radius %s on %d x %d (the box path): within 4 levels of the true Gaussian, under 1 on average (the module's claim)" % (s, w, h, ), d.max() <= 4.01 and d.mean() < 1,
                "max %.2f mean %.3f (%.1f s in the page)" % (d.max(), d.mean(), ms / 1000), "max <= 4, mean < 1")
        if s == 60:
            inner = d[200:-200, 200:-200]
            B.info(SEC, "gaussian r60 1000x800: error away from the edges (200 px in)", "max %.2f mean %.3f; at the edges max %.2f" % (inner.max(), inner.mean(), d.max()))
    # odd sizes
    for (w, h) in [(1, 1), (1, 57), (57, 1), (2, 3)]:
        im = photo(w, h, 4)
        try:
            o, ms = F("gaussian", im, {"radius": 3}); ref = gauss_ref(im, 3)
            B.check(SEC, "gaussian radius 3 on %d x %d" % (w, h), maxdiff(o[:, :, :3], np.round(ref)) <= 1, maxdiff(o[:, :, :3], np.round(ref)), "<= 1")
        except Exception as e:
            B.check(SEC, "gaussian radius 3 on %d x %d" % (w, h), False, str(e).split("\n")[0][:150], "works")
    # transparency: a red disc on clear: the soft edge stays red (no dark fringe)
    disc = np.zeros((60, 60, 4), np.uint8); yy, xx = np.mgrid[0:60, 0:60]; disc[(xx - 30) ** 2 + (yy - 30) ** 2 < 15 ** 2] = [230, 20, 20, 255]
    for name, p in [("gaussian", {"radius": 4}), ("box", {"radius": 3}), ("motion", {"angle": 30, "distance": 12})]:
        o, ms = F(name, disc, p); m = (o[:, :, 3] >= 16) & (o[:, :, 3] < 250)
        B.check(SEC, "%s on a red disc on clear: soft edge pixels stay red (no dark fringe, within 8 where alpha >= 16)" % name, m.any() and np.abs(o[m][:, :3].astype(int) - [230, 20, 20]).max() <= 8,
                "worst %s" % (o[m][np.abs(o[m][:, :3].astype(int) - [230, 20, 20]).max(1).argmax()].tolist() if m.any() else None), "about [230, 20, 20]")
    # Box blur = a (2r+1) mean
    for r in (1, 3, 10):
        o, ms = F("box", img, {"radius": r}); ref = np.dstack([ndi.uniform_filter(img[:, :, c].astype(float), 2 * r + 1, mode="nearest") for c in range(3)])
        B.check(SEC, "box radius %d = scipy uniform_filter(size %d, nearest) (<= 1)" % (r, 2 * r + 1), np.abs(o[:, :, :3] - ref).max() <= 1.01, "%.2f" % np.abs(o[:, :, :3] - ref).max(), "<= 1")
    # Median, Minimum, Maximum
    for r in (1, 2, 5):
        o, ms = F("median", img, {"radius": r}); ref = np.dstack([ndi.median_filter(img[:, :, c], size=2 * r + 1, mode="nearest") for c in range(3)])
        B.check(SEC, "median radius %d = scipy median_filter (exact)" % r, maxdiff(o[:, :, :3], ref) == 0, maxdiff(o[:, :, :3], ref), 0)
        o, ms = F("minimum", img, {"radius": r}); ref = np.dstack([ndi.grey_erosion(img[:, :, c], size=(2 * r + 1, 2 * r + 1), mode="nearest") for c in range(3)])
        B.check(SEC, "minimum radius %d = scipy grey_erosion (exact)" % r, maxdiff(o[:, :, :3], ref) == 0, maxdiff(o[:, :, :3], ref), 0)
        o, ms = F("maximum", img, {"radius": r}); ref = np.dstack([ndi.grey_dilation(img[:, :, c], size=(2 * r + 1, 2 * r + 1), mode="nearest") for c in range(3)])
        B.check(SEC, "maximum radius %d = scipy grey_dilation (exact)" % r, maxdiff(o[:, :, :3], ref) == 0, maxdiff(o[:, :, :3], ref), 0)
    # Unsharp and High Pass from the Gaussian
    for (amt, rad, th) in [(150, 1.5, 0), (80, 4, 10)]:
        o, ms = F("unsharp", img, {"amount": amt, "radius": rad, "threshold": th}); bl = gauss_ref(img, rad); x = img[:, :, :3].astype(float); df = x - bl
        ref = np.where(np.abs(df) >= th, np.clip(np.round(x + amt / 100 * df), 0, 255), x)
        bad = (np.abs(o[:, :, :3] - ref) > 1) & (np.abs(np.abs(df) - th) > 0.5)
        B.check(SEC, "unsharp %d%% r%s t%d = x + amount (x - gaussian) where |x - gaussian| >= threshold (<= 1, away from the threshold)" % (amt, rad, th), not bad.any(), "%d pixels off" % bad.sum(), 0)
    o, ms = F("highPass", img, {"radius": 6}); ref = np.clip(np.round(img[:, :, :3] - gauss_ref(img, 6) + 128), 0, 255)
    B.check(SEC, "high pass radius 6 = x - gaussian + 128 (<= 1)", maxdiff(o[:, :, :3], ref) <= 1, maxdiff(o[:, :, :3], ref), "<= 1")
    flat = rgba(np.full((40, 50, 3), [90, 140, 200], np.uint8))
    for name, p, want in [("highPass", {"radius": 4}, [128, 128, 128]), ("findEdges", {}, [255, 255, 255]), ("emboss", {}, [128, 128, 128]), ("motion", {"angle": 45, "distance": 20}, [90, 140, 200]),
                          ("gaussian", {"radius": 30}, [90, 140, 200]), ("median", {"radius": 4}, [90, 140, 200]), ("unsharp", {"amount": 300, "radius": 5}, [90, 140, 200]), ("surface", {"radius": 5, "threshold": 15}, [90, 140, 200]),
                          ("reduceNoise", {}, [90, 140, 200]), ("oilPaint", {"radius": 4}, [90, 140, 200]), ("radial", {"amount": 20}, [90, 140, 200]), ("radial", {"amount": 30, "method": "zoom"}, [90, 140, 200])]:
        o, ms = F(name, flat, p)
        B.check(SEC, "%s %s on a flat colour gives %s everywhere (edges included)" % (name, json.dumps(p), want), np.abs(o[:, :, :3].astype(int) - want).max() <= 1, "max diff %d, e.g. corner %s" % (np.abs(o[:, :, :3].astype(int) - want).max(), o[0, 0].tolist()), want)
    # Motion blur along its angle: vertical stripes blurred at 90 degrees do not change; at 0 degrees they average
    st = np.zeros((40, 60, 4), np.uint8); st[:, :, 3] = 255; st[:, ::4, :3] = 255
    o, ms = F("motion", st, {"angle": 90, "distance": 15})
    B.check(SEC, "motion blur 90 degrees on vertical stripes: unchanged (it runs along them)", maxdiff(o, st) <= 1, maxdiff(o, st), "<= 1")
    o, ms = F("motion", st, {"angle": 0, "distance": 16})
    B.check(SEC, "motion blur 0 degrees, 16 px on 1-in-4 stripes: about 64 in the middle", abs(float(o[20, 20:40, 0].mean()) - 63.75) <= 4, float(o[20, 20:40, 0].mean()), "about 64")
    # Add noise statistics
    grey = rgba(np.full((200, 200, 3), 128, np.uint8))
    o, ms = F("addNoise", grey, {"amount": 10, "seed": 3}); n = o[:, :, :3].astype(float) - 128
    B.check(SEC, "add noise 10% uniform: mean 0, spread +/-25.5 (std 14.7)", abs(n.mean()) < 0.5 and abs(n.std() - 25.5 / np.sqrt(3)) < 0.5 and np.abs(n).max() <= 26, "mean %.2f std %.2f max %d" % (n.mean(), n.std(), np.abs(n).max()), "0, 14.7, 26")
    o, ms = F("addNoise", grey, {"amount": 10, "seed": 3, "gaussian": True}); n = o[:, :, :3].astype(float) - 128
    B.info(SEC, "add noise 10%% Gaussian: mean %.2f std %.2f (Lantern's own choice: std = amount/2)" % (n.mean(), n.std()), "")
    o, ms = F("addNoise", grey, {"amount": 10, "seed": 3, "mono": True})
    B.check(SEC, "add noise monochromatic: R = G = B", np.array_equal(o[:, :, 0], o[:, :, 1]) and np.array_equal(o[:, :, 1], o[:, :, 2]), "", "")
    o2, ms = F("addNoise", grey, {"amount": 10, "seed": 3, "mono": True})
    B.check(SEC, "add noise: the same seed gives the same grain", np.array_equal(o, o2), "", "")
    # Resize against PIL (same kernels, same pixel-centre convention); PIL renormalises at the edges, so compare 4 px in
    for (W, H) in [(101, 75), (406, 302), (150, 300)]:
        for meth, pil in [("nearest", Image.NEAREST), ("bilinear", Image.BILINEAR), ("bicubic", Image.BICUBIC), ("lanczos", Image.LANCZOS)]:
            o = pg.J("([w, h, b, W, H, m]) => { var r = Lantern.photo.resample.resize(R.id(w, h, b), W, H, m); return R.b64(new Uint8Array(r.data.buffer)); }",
                     [203, 151, base64.b64encode(img.tobytes()).decode(), W, H, meth])
            o = np.frombuffer(base64.b64decode(o), np.uint8).reshape(H, W, 4)
            ref = np.array(Image.fromarray(img[:, :, :3]).resize((W, H), pil))
            e = 4 if meth != "nearest" else 0
            dd = np.abs(o[e:H - e, e:W - e, :3].astype(int) - ref[e:H - e, e:W - e])
            B.check(SEC, "resize 203x151 -> %dx%d %s = PIL's resize, 4 px from the edges (mean <= 0.5, max <= 20: PIL rounds and clips between its two passes)" % (W, H, meth), dd.mean() <= 0.5 and dd.max() <= 20, "mean %.3f max %d" % (dd.mean(), dd.max()), "mean <= 0.5")
            if meth in KER:
                mref = np.clip(np.round(sep_resize(img[:, :, :3], W, H, *KER[meth])), 0, 255)
                d = np.abs(o[:, :, :3].astype(int) - mref).max()
                B.check(SEC, "resize 203x151 -> %dx%d %s = the textbook separable filter (float, edges extended) (<= 1)" % (W, H, meth), d <= 1, d, "<= 1")
    # Mitchell ("bicubic smoother") against ImageMagick's Mitchell filter
    p = OUTDIR; Image.fromarray(img[:, :, :3]).save(os.path.join(p, "rs.png"))
    for (W, H) in [(406, 302), (101, 75)]:
        o = pg.J("([w, h, b, W, H, m]) => { var r = Lantern.photo.resample.resize(R.id(w, h, b), W, H, m); return R.b64(new Uint8Array(r.data.buffer)); }", [203, 151, base64.b64encode(img.tobytes()).decode(), W, H, "smoother"])
        o = np.frombuffer(base64.b64decode(o), np.uint8).reshape(H, W, 4)
        ref = subprocess.run(["convert", os.path.join(p, "rs.png"), "-colorspace", "sRGB", "-filter", "Mitchell", "-resize", "%dx%d!" % (W, H), "-depth", "8", "rgb:-"], capture_output=True).stdout
        ref = np.frombuffer(ref, np.uint8).reshape(H, W, 3)
        d = np.abs(o[4:-4, 4:-4, :3].astype(int) - ref[4:-4, 4:-4]).max()
        B.check(SEC, "resize -> %dx%d 'smoother' = ImageMagick's Mitchell filter, 4 px in (<= 2)" % (W, H), d <= 2, d, "<= 2")
    # resize of a soft-edged picture: no dark fringe
    o = pg.J("([w, h, b]) => { var r = Lantern.photo.resample.resize(R.id(w, h, b), 25, 25, 'bicubic'); return R.b64(new Uint8Array(r.data.buffer)); }", [60, 60, base64.b64encode(disc.tobytes()).decode()])
    o = np.frombuffer(base64.b64decode(o), np.uint8).reshape(25, 25, 4); m = (o[:, :, 3] >= 16) & (o[:, :, 3] < 250)
    B.check(SEC, "resize a red disc on clear to 25 x 25: edge pixels stay red", np.abs(o[m][:, :3].astype(int) - [230, 20, 20]).max() <= 8, np.abs(o[m][:, :3].astype(int) - [230, 20, 20]).max(), "<= 8")
    # 1-pixel tall picture down and up
    thin = photo(300, 1)
    o = pg.J("([w, h, b]) => { var r = Lantern.photo.resample.resize(R.id(w, h, b), 50, 3, 'bicubic'); return [r.width, r.height, Array.prototype.slice.call(r.data, 0, 8)]; }", [300, 1, base64.b64encode(thin.tobytes()).decode()])
    B.check(SEC, "resize a 300 x 1 picture to 50 x 3 works", o[0] == 50 and o[1] == 3, o, "50 x 3")
    # Rotate 90 and 180 exactly, and 30 degrees the size the canvas must grow to
    buf = io.BytesIO(); Image.fromarray(img).save(buf, "PNG")
    for ang, fn in [(90, lambda a: np.rot90(a, -1)), (-90, lambda a: np.rot90(a, 1)), (180, lambda a: np.rot90(a, 2))]:
        pg.open(buf.getvalue(), "rot.png", "rot%d" % ang)
        pg.J("([k, a]) => { Lantern.photo.ops.exec(R.docs[k], 'rotate', {angle: a}); return true; }", ["rot%d" % ang, ang])
        f = pg.flat("rot%d" % ang)
        B.check(SEC, "rotate %d: exactly the turned pixels" % ang, f.shape == fn(img).shape and maxdiff(f, fn(img)) == 0, (f.shape, maxdiff(f, fn(img)) if f.shape == fn(img).shape else ""), "exact")
    pg.open(buf.getvalue(), "rot.png", "rot30"); pg.J("(k) => { Lantern.photo.ops.exec(R.docs[k], 'rotate', {angle: 30}); return true; }", "rot30")
    f = pg.flat("rot30"); W = round(203 * np.cos(np.pi / 6) + 151 * np.sin(np.pi / 6)); H = round(203 * np.sin(np.pi / 6) + 151 * np.cos(np.pi / 6))
    B.check(SEC, "rotate 30: canvas grows to %d x %d" % (W, H), f.shape[:2] == (H, W), f.shape[:2], (H, W))
    ref = np.array(Image.fromarray(img).rotate(-30, resample=Image.BICUBIC, expand=True))
    if ref.shape == f.shape:
        m = (ref[:, :, 3] == 255) & (f[:, :, 3] == 255)
        m2 = ndi.binary_erosion(m, iterations=3)
        d = np.abs(f[:, :, :3].astype(int) - ref[:, :, :3])[m2]
        B.check(SEC, "rotate 30 = PIL's rotate(-30, bicubic, expand) inside the picture (mean <= 3)", d.mean() <= 3, "mean %.2f max %d" % (d.mean(), d.max()), "mean <= 3")
    # homography against OpenCV
    import cv2
    src = [[0, 0], [200, 10], [190, 150], [5, 140]]; dst = [[0, 0], [100, 0], [100, 80], [0, 80]]
    Hm = pg.J("([a, b]) => Lantern.photo.resample.homography(a, b)", [src, dst])
    ref = cv2.getPerspectiveTransform(np.float32(src), np.float32(dst)).ravel()
    B.check(SEC, "homography (4 points to 4 points) = OpenCV getPerspectiveTransform", np.allclose(np.array(Hm), ref, atol=1e-6), np.round(Hm, 6).tolist(), np.round(ref, 6).tolist())
    o = pg.J("([w, h, b]) => { var r = Lantern.photo.resample.perspective(R.id(w, h, b), [1,0,0,0,1,0,0,0,1], w, h); return R.b64(new Uint8Array(r.data.buffer)); }", [203, 151, base64.b64encode(img.tobytes()).decode()])
    o = np.frombuffer(base64.b64decode(o), np.uint8).reshape(151, 203, 4)
    B.check(SEC, "perspective with the identity matrix gives the picture back", maxdiff(o, img) == 0, maxdiff(o, img), 0)
    Minv = cv2.getPerspectiveTransform(np.float32(dst), np.float32(src)).ravel().tolist()
    o = pg.J("([w, h, b, m]) => { var r = Lantern.photo.resample.perspective(R.id(w, h, b), m, 100, 80); return R.b64(new Uint8Array(r.data.buffer)); }", [203, 151, base64.b64encode(img.tobytes()).decode(), Minv])
    o = np.frombuffer(base64.b64decode(o), np.uint8).reshape(80, 100, 4)
    T = lambda t: np.array([[1, 0, t], [0, 1, t], [0, 0, 1]], float)
    Mcv = T(-0.5) @ np.array(Minv).reshape(3, 3) @ T(0.5)    # Lantern reads pixel centres at +0.5; OpenCV at whole numbers
    ref = cv2.warpPerspective(img, Mcv, (100, 80), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    d = np.abs(o[2:-2, 2:-2, :3].astype(int) - ref[2:-2, 2:-2, :3])
    B.check(SEC, "perspective crop of a slanted quad = OpenCV warpPerspective (bilinear), 2 px in (mean <= 1, max <= 3)", d.mean() <= 1 and d.max() <= 3, "mean %.2f max %d" % (d.mean(), d.max()), "mean <= 1")
