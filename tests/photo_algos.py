# photo_algos.py -- the Photo tile's arithmetic (1.24.42) against other programs' own: SciPy's filters and distance transform,
# PIL's resampling, OpenCV's perspective warp, scikit-image's flood fill, psd-tools reading Lantern's .psd and Lantern reading
# psd-tools', PIL reading Lantern's TIFF, GIF and BMP and Lantern reading PIL's TIFFs, and the formulas Photoshop documents
# (Levels, Posterize, Desaturate, Black & White's defaults, Exposure in stops), and what Shadows/Highlights, Match Color,
# Replace Color and Selective Color must leave alone. The modules run in Node, taken from
# src/lantern.inner.html between their markers. Each that needs a program not on the machine says SKIP.
# Usage: python3 tests/photo_algos.py
import os, re, sys, json, subprocess, tempfile
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = open(os.path.join(ROOT, "src", "lantern.inner.html"), encoding="utf-8").read()
NAMES = ["PHOTO_MATH", "PHOTO_ADJ_TONE", "PHOTO_ADJ_COLOR", "PHOTO_FILT_BLUR", "PHOTO_FILT_SHARPEN", "PHOTO_ADJ_MORE", "PHOTO_FILT_NOISE", "PHOTO_FILT_DISTORT", "PHOTO_FILT_STYLE",
         "PHOTO_FILT_PIXELATE", "PHOTO_RESAMPLE", "PHOTO_SEL_OPS", "PHOTO_HEAL", "PHOTO_INPAINT", "PHOTO_PSD_ADJ", "PHOTO_PSD_READ", "PHOTO_PSD_WRITE", "PHOTO_TIFF", "PHOTO_GIF",
         "PHOTO_LIQUIFY", "PHOTO_FUSE_SEAMS"]
code = "".join(re.search(r"// MODULE: %s - START\n.*?// MODULE: %s - END\n" % (n, n), SRC, re.S).group(0) for n in NAMES)
inflate = re.search(r"// MODULE: ZIP_INFLATE - START\n.*?// MODULE: ZIP_INFLATE - END\n", SRC, re.S)
OUT = tempfile.mkdtemp(prefix="photo_algos_")
lib = os.path.join(OUT, "lib.js")
open(lib, "w", encoding="utf-8").write("global.window = global.window || { Lantern: {} };\n" + (inflate.group(0) if inflate else "") + code)
fails = 0; n = 0
def check(name, cond, info=""):
    global fails, n
    n += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:300]))
    if not cond: fails += 1
def run(js):
    """js: a function body with P (Lantern.photo), fs, OUT, load(name) -> {width,height,data}, save(name, d); prints JSON"""
    f = os.path.join(OUT, "t.js")
    open(f, "w").write("var fs = require('fs'); require(%s); var P = window.Lantern.photo, OUT = %s;\n"
        "function load(n) { var m = JSON.parse(fs.readFileSync(OUT + '/' + n + '.json')); return { width: m[0], height: m[1], data: new Uint8ClampedArray(fs.readFileSync(OUT + '/' + n + '.bin')) }; }\n"
        "function save(n, d) { fs.writeFileSync(OUT + '/' + n + '.json', JSON.stringify([d.width, d.height])); fs.writeFileSync(OUT + '/' + n + '.bin', Buffer.from(d.data.buffer, d.data.byteOffset, d.data.length)); }\n"
        "console.log(JSON.stringify((function () {\n%s\n})()));" % (json.dumps(lib), json.dumps(OUT), js))
    r = subprocess.run(["node", f], capture_output=True, text=True, timeout=600)
    if r.returncode: raise RuntimeError(r.stderr[-1500:])
    return json.loads(r.stdout.strip().split("\n")[-1])
def put(name, a):
    a = np.ascontiguousarray(a.astype(np.uint8)); h, w = a.shape[:2]
    if a.shape[2] == 3: a = np.dstack([a, np.full((h, w), 255, np.uint8)])
    open(os.path.join(OUT, name + ".json"), "w").write(json.dumps([w, h])); open(os.path.join(OUT, name + ".bin"), "wb").write(a.tobytes())
def get(name):
    w, h = json.load(open(os.path.join(OUT, name + ".json"))); return np.frombuffer(open(os.path.join(OUT, name + ".bin"), "rb").read(), np.uint8).reshape(h, w, 4).astype(float)
rng = np.random.default_rng(7)
H, W = 120, 160
yy, xx = np.mgrid[0:H, 0:W]
photo = np.dstack([128 + 100 * np.sin(xx / 13.0) * np.cos(yy / 17.0), 128 + 90 * np.cos(xx / 23.0 + yy / 31.0), (xx * 255 / W + yy * 0.5) % 256]) + rng.normal(0, 12, (H, W, 3))
photo = np.clip(photo, 0, 255).round()
put("photo", photo)
try:
    from scipy import ndimage
    have_scipy = True
except ImportError:
    have_scipy = False; print("SKIP  SciPy not here: filters not compared")
# --- filters against SciPy ---
if have_scipy:
    r = run("""var out = {}; [0.5, 1, 2, 3.5, 6, 10, 25].forEach(function (s) { var d = load('photo'); P.filter.gaussian(d, {radius: s}); save('g' + s, d); });
      ['median', 'minimum', 'maximum'].forEach(function (f) { [1, 3].forEach(function (r) { var d = load('photo'); P.filter[f](d, {radius: r}); save(f + r, d); }); });
      var d = load('photo'); P.filter.box(d, {radius: 4}); save('box4', d);
      d = load('photo'); P.filter.unsharp(d, {amount: 150, radius: 2, threshold: 4}); save('usm', d);
      d = load('photo'); P.filter.highPass(d, {radius: 3}); save('hp', d); return 1;""")
    src = photo
    for s in [0.5, 1, 2, 3.5, 6, 10, 25]:
        ref = np.stack([ndimage.gaussian_filter(src[..., c], sigma=s, mode="nearest", truncate=3.0 if s <= 6 else 4.0) for c in range(3)], -1)
        d = np.abs(get("g%s" % s)[..., :3] - ref).max(); lim = 1.01 if s <= 6 else 4.5
        check("Gaussian Blur radius %s: within %s level%s of SciPy's" % (s, round(lim), "" if lim < 2 else "s"), d <= lim, d)
    for f, fn in [("median", ndimage.median_filter), ("minimum", ndimage.minimum_filter), ("maximum", ndimage.maximum_filter)]:
        for r_ in (1, 3):
            ref = np.stack([fn(src[..., c], size=2 * r_ + 1, mode="nearest") for c in range(3)], -1)
            check("%s radius %d: as SciPy's (a %d x %d square)" % (f.capitalize(), r_, 2 * r_ + 1, 2 * r_ + 1), np.abs(get(f + str(r_))[..., :3] - ref).max() == 0)
    ref = np.stack([ndimage.uniform_filter(src[..., c], size=9, mode="nearest") for c in range(3)], -1)
    check("Box Blur radius 4: as SciPy's 9 x 9 mean", np.abs(get("box4")[..., :3] - ref).max() <= 1.01, np.abs(get("box4")[..., :3] - ref).max())
    bl = np.stack([ndimage.gaussian_filter(src[..., c], sigma=2, mode="nearest", truncate=3.0) for c in range(3)], -1); df = src - bl
    ref = np.where(np.abs(df) >= 4, np.clip(np.round(src + 1.5 * df), 0, 255), src)
    check("Unsharp Mask 150%, 2 px, threshold 4: the textbook sum", np.abs(get("usm")[..., :3] - ref).max() <= 1.01, np.abs(get("usm")[..., :3] - ref).max())
    bl = np.stack([ndimage.gaussian_filter(src[..., c], sigma=3, mode="nearest", truncate=3.0) for c in range(3)], -1)
    check("High Pass 3 px: the picture less its blur, about 128", np.abs(get("hp")[..., :3] - np.clip(np.round(src - bl + 128), 0, 255)).max() <= 1.01)
# --- adjustments against Photoshop's documented sums ---
r = run("""var d = load('photo'); P.adjust.levels(d, {inBlack: 20, inWhite: 230, gamma: 1.6, outBlack: 10, outWhite: 245}); save('lev', d);
  d = load('photo'); P.adjust.posterize(d, {levels: 5}); save('post', d); d = load('photo'); P.adjust.desaturate(d); save('desat', d);
  d = load('photo'); P.adjust.invert(d); save('inv', d); d = load('photo'); P.adjust.threshold(d, {level: 100}); save('thr', d);
  d = load('photo'); P.adjust.curves(d, {rgb: [[0, 0], [255, 255]]}); save('cid', d);
  d = load('photo'); P.adjust.exposure(d, {exposure: 1}); save('exp', d);
  var prim = {width: 6, height: 1, data: new Uint8ClampedArray([255,0,0,255, 255,255,0,255, 0,255,0,255, 0,255,255,255, 0,0,255,255, 255,0,255,255])};
  P.adjust.blackWhite(prim, {}); var bw = Array.prototype.slice.call(prim.data).filter(function (v, i) { return i % 4 === 0; });
  var hs = {width: 3, height: 1, data: new Uint8ClampedArray([255,0,0,255, 0,255,0,255, 0,0,255,255])}; P.adjust.hueSat(hs, {hue: 120});
  var lut = P.math.curve([[0, 0], [64, 32], [192, 224], [255, 255]]);
  return {bw: bw, hs: Array.prototype.slice.call(hs.data), lut: [lut[0], lut[64], lut[192], lut[255], lut[128]]};""")
src = photo
v = np.clip((src - 20) / 210.0, 0, 1); ref = np.round(10 + v ** (1 / 1.6) * 235)
check("Levels 20/1.6/230 to 10-245: Photoshop's sum", np.abs(get("lev")[..., :3] - ref).max() <= 1, np.abs(get("lev")[..., :3] - ref).max())
check("Posterize 5: Photoshop's steps", np.abs(get("post")[..., :3] - np.round(np.floor(src * 5 / 256) * 255 / 4)).max() == 0)
check("Desaturate: each pixel's HSL lightness, as Photoshop's", np.abs(get("desat")[..., 0] - np.round((src.max(-1) + src.min(-1)) / 2)).max() <= 1)
check("Invert: 255 less each channel", np.abs(get("inv")[..., :3] - (255 - src)).max() == 0)
lum = 0.299 * src[..., 0] + 0.587 * src[..., 1] + 0.114 * src[..., 2]
check("Threshold 100: white where the lightness is 100 or more", np.abs(get("thr")[..., 0] - np.where(lum >= 100, 255, 0)).max() == 0)
check("Curves through (0,0) and (255,255) changes nothing", np.abs(get("cid")[..., :3] - src).max() == 0)
lin = np.where(src / 255 <= 0.04045, src / 255 / 12.92, ((src / 255 + 0.055) / 1.055) ** 2.4) * 2
ref = np.clip(np.round(np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(np.minimum(lin, 10), 1 / 2.4) - 0.055) * 255), 0, 255)
check("Exposure +1 stop doubles the light (in linear sRGB)", np.abs(get("exp")[..., :3] - ref).max() <= 1, np.abs(get("exp")[..., :3] - ref).max())
check("Black & White's defaults: red 40%, yellow 60%, green 40%, cyan 60%, blue 20%, magenta 80% of white", r["bw"] == [102, 153, 102, 153, 51, 204], r["bw"])
check("Hue/Saturation +120: red becomes green, green blue, blue red", r["hs"] == [0, 255, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255], r["hs"])
check("Curves: the spline goes through its points", r["lut"][:4] == [0, 32, 224, 255], r["lut"])
# --- resampling against PIL, perspective against OpenCV ---
try:
    from PIL import Image
    r = run("""['nearest', 'bilinear', 'bicubic', 'lanczos'].forEach(function (m) { save('up_' + m, P.resample.resize(load('photo'), 233, 171, m)); save('dn_' + m, P.resample.resize(load('photo'), 61, 47, m)); }); return 1;""")
    pim = Image.fromarray(photo.astype(np.uint8))
    for m, pm, lim in [("bilinear", Image.BILINEAR, 2), ("bicubic", Image.BICUBIC, 3), ("lanczos", Image.LANCZOS, 3)]:
        for k, size in [("up", (233, 171)), ("dn", (61, 47))]:
            ref = np.asarray(pim.resize(size, pm), float); got = get(k + "_" + m)[..., :3]
            check("Image Size %s, %s to %d x %d: within %d levels of PIL's (mean %.2f)" % (m, "up" if k == "up" else "down", size[0], size[1], lim, np.abs(ref - got).mean()), np.abs(ref - got).mean() < 1.0 and np.percentile(np.abs(ref - got), 99) <= lim, (np.abs(ref - got).mean(), np.abs(ref - got).max()))
except ImportError:
    print("SKIP  PIL not here")
try:
    import cv2
    q = [[20, 15], [140, 5], [150, 110], [10, 100]]
    r = run("""var m = P.resample.homography([[0, 0], [100, 0], [100, 80], [0, 80]], %s); save('persp', P.resample.perspective(load('photo'), m, 100, 80)); return m;""" % json.dumps(q))
    # Lantern counts from pixels' corners, OpenCV from their centres: the same points, half a pixel apart
    M = cv2.getPerspectiveTransform(np.float32(q) - 0.5, np.float32([[0, 0], [100, 0], [100, 80], [0, 80]]) - 0.5)
    ref = cv2.warpPerspective(photo.astype(np.float32), M, (100, 80), flags=cv2.INTER_LINEAR)
    d = np.abs(get("persp")[2:-2, 2:-2, :3] - ref[2:-2, 2:-2]); check("Perspective Crop: OpenCV's warp to within 1 level inside the edge (mean %.2f)" % d.mean(), d.mean() < 0.6 and np.percentile(d, 99) <= 2, (d.mean(), d.max()))
except ImportError:
    print("SKIP  OpenCV not here: the perspective is not compared")
# --- selections ---
if have_scipy:
    blob = np.zeros((H, W), np.uint8); blob[30:90, 40:120] = 255; blob[50:70, 120:140] = 255
    put("blob", np.dstack([blob] * 4))
    r = run("""var d = load('blob'), m = new Uint8Array(d.width * d.height); for (var j = 0; j < m.length; j++) m[j] = d.data[j * 4];
      var e = P.sel.expand(m, d.width, d.height, 6), c = P.sel.contract(m, d.width, d.height, 6), dist = P.sel.distance(m, d.width, d.height, function (v) { return v >= 128; });
      return {e: Array.prototype.slice.call(e), c: Array.prototype.slice.call(c), d: Array.prototype.slice.call(dist)};""")
    edt_out = ndimage.distance_transform_edt(blob == 0); edt_in = ndimage.distance_transform_edt(blob > 0)
    check("Selection distance: SciPy's exact Euclidean distance transform", np.abs(np.sqrt(np.array(r["d"], float)).reshape(H, W) - edt_out).max() < 1e-6)
    e = np.array(r["e"]).reshape(H, W); c = np.array(r["c"]).reshape(H, W)
    # (distances centre to centre: the 6th ring out from an edge is 6 away, and Expand 6 takes it whole, as Photoshop's 6 px; review 1, 2026-11-26)
    check("Expand 6 px: every pixel 6 px or nearer chosen whole, none 7 or more away", (e[edt_out <= 6] == 255).all() and (e[edt_out >= 7] == 0).all())
    check("Contract 6 px: none 6 px or nearer the edge, all 7 or more in", (c[(blob > 0) & (edt_in <= 6)] == 0).all() and (c[edt_in >= 7] == 255).all())
    check("...a block 60 rows high: Expand 6 makes it 72 rows, Contract 6 makes it 48", int((e[:, 60] == 255).sum()) == 72 and int((c[:, 60] == 255).sum()) == 48, (int((e[:, 60] == 255).sum()), int((c[:, 60] == 255).sum())))
try:
    from skimage.segmentation import flood
    r = run("""var d = load('photo'), m = P.sel.wand(d, {x: 80, y: 60, tolerance: 40, contiguous: true, antialias: false}); return Array.prototype.slice.call(m);""")
    got = np.array(r).reshape(H, W) > 127
    ref = np.ones((H, W), bool)
    for ch in range(3): ref &= np.abs(photo[..., ch] - photo[60, 80, ch]) <= 40
    from scipy import ndimage as nd2
    lab, _ = nd2.label(ref); ref = lab == lab[60, 80]
    check("Magic Wand (tolerance 40, contiguous): the pixels joined to the click within 40 on every channel", (got == ref).all(), int((got != ref).sum()))
except ImportError:
    print("SKIP  scikit-image not here: the wand is not compared")
# --- healing and filling ---
grad = np.dstack([np.tile(np.linspace(30, 220, W), (H, 1)), np.tile(np.linspace(200, 60, H)[:, None], (1, W)), np.full((H, W), 128.0)])
put("grad", grad)
r = run("""var d = load('grad'), hole = new Uint8Array(d.width * d.height); for (var y = 40; y < 80; y++) for (var x = 60; x < 100; x++) hole[y * d.width + x] = 255;
  save('filled', P.inpaint.fill(d, hole, {})); var src = load('grad'); for (var j = 0; j < src.data.length; j += 4) { src.data[j] = Math.min(255, src.data[j] + 30); }
  var mk = new Uint8Array(d.width * d.height); for (y = 40; y < 80; y++) for (x = 60; x < 100; x++) mk[y * d.width + x] = 255; save('healed', P.heal.heal(load('grad'), src, mk)); return 1;""")
f = get("filled")[40:80, 60:100, :3]; ref = grad[40:80, 60:100]
check("Content-Aware Fill of a hole in a smooth gradient: within 12 levels of the gradient (mean %.1f)" % np.abs(f - ref).mean(), np.abs(f - ref).mean() < 12, np.abs(f - ref).mean())
hd = get("healed")[42:78, 62:98, :3]
check("Healing a patch 30 levels too red: the membrane takes the 30 away", np.abs(hd - grad[42:78, 62:98]).max() <= 2, np.abs(hd - grad[42:78, 62:98]).max())
# --- Merge Exposures, Content-Aware Scale, Liquify ---
r = run("""var base = load('photo'); function sc(k) { var o = {width: base.width, height: base.height, data: new Uint8ClampedArray(base.data)}; for (var j = 0; j < o.data.length; j += 4) for (var c = 0; c < 3; c++) o.data[j + c] = Math.min(255, o.data[j + c] * k); return o; }
  save('fused', P.fuse([sc(0.4), sc(1), sc(2.5)])); save('dark', sc(0.4)); save('light', sc(2.5));
  var pic = load('photo'), prot = new Uint8Array(pic.width * pic.height); for (var y = 40; y < 80; y++) for (var x = 60; x < 90; x++) { prot[y * pic.width + x] = 255; var i = (y * pic.width + x) * 4; pic.data[i] = 255; pic.data[i + 1] = 0; pic.data[i + 2] = 0; }
  save('carved', P.seams.carve(pic, 120, 100, prot));
  var f = {w: 40, h: 30, dx: new Float32Array(1200).fill(7), dy: new Float32Array(1200).fill(-3)}; save('warped', P.liquify.warp(load('photo'), f)); return 1;""")
fu = get("fused")[..., :3]; e_f = np.abs(fu - photo).mean(); e_d = np.abs(get("dark")[..., :3] - photo).mean(); e_l = np.abs(get("light")[..., :3] - photo).mean()
check("Merge Exposures of shots at 0.4, 1 and 2.5 times the light: nearer the middle shot than either other (%.1f against %.1f and %.1f)" % (e_f, e_d, e_l), e_f < min(e_d, e_l) and np.isfinite(fu).all())
cv_ = get("carved"); red = (cv_[..., 0] == 255) & (cv_[..., 1] == 0) & (cv_[..., 2] == 0)
ys, xs = np.nonzero(red)
check("Content-Aware Scale 160 x 120 to 120 x 100: that size, and the protected 30 x 40 red block kept whole", cv_.shape[:2] == (100, 120) and red.sum() == 1200 and xs.max() - xs.min() + 1 == 30 and ys.max() - ys.min() + 1 == 40, (cv_.shape, int(red.sum())))
wp = get("warped")[..., :3]
check("Liquify's warp: a field of (7, -3) takes each pixel from 7 right and 3 up", np.abs(wp[10:-10, 10:-10] - photo[7:-13, 17:-3]).max() <= 1, np.abs(wp[10:-10, 10:-10] - photo[7:-13, 17:-3]).max())
# --- files: PSD both ways, TIFF, GIF, BMP ---
try:
    from psd_tools import PSDImage
    from PIL import Image, ImageDraw
    r = run("""var d = load('photo'), w = d.width, h = d.height, a = new Uint8ClampedArray(40 * 30 * 4); for (var j = 0; j < 1200; j++) { a[j * 4] = 250; a[j * 4 + 1] = 200; a[j * 4 + 2] = 10; a[j * 4 + 3] = 255; }
      var mk = new Uint8Array(40 * 30); for (j = 0; j < mk.length; j++) mk[j] = (j % 40) < 20 ? 0 : 255;
      var b = P.psd.write({w: w, h: h, dpi: 150, composite: d.data, layers: [{name: 'Back', x: 0, y: 0, w: w, h: h, rgba: d.data, visible: true, opacity: 1, blend: 'normal'},
        {name: 'Sun é', x: 100, y: 10, w: 40, h: 30, rgba: a, visible: true, opacity: 0.6, blend: 'screen', mask: {x: 100, y: 10, w: 40, h: 30, data: mk, def: 0}},
        {name: 'Lev', adj: {type: 'levels', p: {inBlack: 10, inWhite: 240, gamma: 1.3}}, visible: true, opacity: 1, blend: 'normal'},
        {name: 'Hue', adj: {type: 'hueSat', p: {hue: 15, saturation: 10, lightness: 0}}, visible: false, opacity: 1, blend: 'normal'}]});
      fs.writeFileSync(OUT + '/lantern.psd', Buffer.from(b)); return b.length;""")
    p = PSDImage.open(os.path.join(OUT, "lantern.psd")); ls = list(p)
    check("Lantern's .psd: psd-tools reads 4 layers, their names, kinds, opacity, blend, visibility", [l.name for l in ls] == ["Back", "Sun é", "Lev", "Hue"] and [l.kind for l in ls] == ["pixel", "pixel", "levels", "huesaturation"] and ls[1].opacity == 153 and "SCREEN" in str(ls[1].blend_mode) and ls[3].visible is False, [(l.name, l.kind, l.opacity, str(l.blend_mode), l.visible) for l in ls])
    check("...the layer's pixels and place", np.abs(np.asarray(ls[0].topil().convert("RGB"), float) - photo).max() == 0 and ls[1].bbox == (100, 10, 140, 40))
    check("...its mask", ls[1].has_mask() and ls[1].mask.bbox == (100, 10, 140, 40) and np.asarray(ls[1].mask.topil())[5, 5] == 0 and np.asarray(ls[1].mask.topil())[5, 30] == 255)
    lv = ls[2].data[0] if hasattr(ls[2], "data") else None
    check("...the Levels layer's settings", lv is not None and lv.input_floor == 10 and lv.input_ceiling == 240 and lv.gamma == 130, lv)
    check("...the flattened picture", np.abs(np.asarray(p.topil().convert("RGB"), float) - photo).max() == 0)
    r = run("""var d = load('photo'), sc = {relative: false, reds: [-30, 10, 0, 5], blues: [0, 0, 20, 0], neutrals: [0, -7, 0, 0]};
      var b = P.psd.write({w: d.width, h: d.height, dpi: 72, composite: d.data, layers: [{name: 'Back', x: 0, y: 0, w: d.width, h: d.height, rgba: d.data, visible: true, opacity: 1, blend: 'normal'},
        {name: 'Sel', adj: {type: 'selectiveColor', p: sc}, visible: true, opacity: 1, blend: 'normal'}]});
      fs.writeFileSync(OUT + '/selc.psd', Buffer.from(b)); var back = P.psd.read(new Uint8Array(b)).layers[1]; return back.adj || null;""")
    sl = list(PSDImage.open(os.path.join(OUT, "selc.psd")))[1]
    check("Lantern's .psd: a Selective Color layer is one psd-tools reads as Photoshop's own (absolute; reds, blues, neutrals)", sl.kind == "selectivecolor" and sl.method == 1 and tuple(sl.data[1]) == (-30, 10, 0, 5) and tuple(sl.data[5]) == (0, 0, 20, 0) and tuple(sl.data[8]) == (0, -7, 0, 0) and tuple(sl.data[0]) == (0, 0, 0, 0), (sl.kind, getattr(sl, "method", None), getattr(sl, "data", None)))
    check("...and Lantern reads it back as it wrote it", r and r["type"] == "selectiveColor" and r["p"]["relative"] is False and r["p"]["reds"] == [-30, 10, 0, 5] and r["p"]["neutrals"] == [0, -7, 0, 0] and r["p"]["greens"] == [0, 0, 0, 0], r)
    # groups: Lantern writes Photoshop's section records; psd-tools reads the tree and composes the picture from the layers alone
    r = run("""var w = 60, h = 40, n = w * h; function solid(c, x0, x1) { var a = new Uint8ClampedArray(n * 4); for (var j = 0; j < n; j++) { var x = j % w; if (x >= x0 && x < x1) { a[j * 4] = c[0]; a[j * 4 + 1] = c[1]; a[j * 4 + 2] = c[2]; a[j * 4 + 3] = 255; } } return a; }
      var comp = solid([0, 0, 0], 0, w), L = function (name, rgba, o) { var l = {name: name, x: 0, y: 0, w: w, h: h, rgba: rgba, visible: true, opacity: 1, blend: 'normal'}; for (var k in o || {}) l[k] = o[k]; return l; };
      var b = P.psd.write({w: w, h: h, dpi: 72, composite: comp, layers: [L('Back', solid([230, 200, 120], 0, w)), {divider: true, name: '</Layer group>'}, L('Blue', solid([20, 90, 200], 5, 40)),
        {divider: true, name: '</Layer group>'}, L('Red', solid([250, 40, 40], 25, 55), {blend: 'multiply'}), {group: true, name: 'Inner', visible: true, opacity: 1, blend: 'pass-through', open: false},
        {group: true, name: 'Outer', visible: true, opacity: 160 / 255, blend: 'normal', open: true}]});
      fs.writeFileSync(OUT + '/groups.psd', Buffer.from(b));
      var back = P.psd.read(new Uint8Array(b)).layers; return back.map(function (l) { return [l.name, !!l.group, l.blend, Math.round(l.opacity * 255), l.rid == null ? null : l.rid, l.pgid == null ? null : l.pgid, l.open == null ? null : l.open]; });""")
    gp = PSDImage.open(os.path.join(OUT, "groups.psd"))
    def tree(g): return [(l.name, l.kind, str(l.blend_mode).split(".")[-1], l.opacity, tree(l) if l.is_group() else None) for l in g]
    check("Lantern's .psd with a group in a group: psd-tools reads the tree, the modes (Pass Through, Normal) and the group's opacity", tree(gp) == [("Back", "pixel", "NORMAL", 255, None), ("Outer", "group", "NORMAL", 160, [("Blue", "pixel", "NORMAL", 255, None), ("Inner", "group", "PASS_THROUGH", 255, [("Red", "pixel", "MULTIPLY", 255, None)])])], tree(gp))
    gc = np.asarray(gp.composite(ignore_preview=True).convert("RGB"), float)
    # by hand: Red multiplies Blue inside Outer (made alone), Outer laid at 160/255 over Back
    o = 160 / 255.0; bl = np.array([20, 90, 200.]); rd = np.array([250, 40, 40.]); bk = np.array([230, 200, 120.])
    want = {10: bk * (1 - o) + bl * o, 30: bk * (1 - o) + bl * rd / 255 * o, 50: bk * (1 - o) + rd * o, 58: bk}
    check("...and the picture psd-tools makes from those layers is the one the groups mean (within 2 levels)", all(np.abs(gc[20, x] - v).max() <= 2 for x, v in want.items()), [(x, list(gc[20, x]), list(np.round(v))) for x, v in want.items()])
    check("...Lantern reads its own groups back: the tree, Inner shut, Outer open", r == [["Back", False, "normal", 255, None, None, None], ["Blue", False, "normal", 255, None, 2, None], ["Red", False, "multiply", 255, None, 1, None], ["Inner", True, "pass-through", 255, 1, 2, False], ["Outer", True, "normal", 160, 2, None, True]], r)
    # psd-tools' own layered PSD read by Lantern
    q = PSDImage.new("RGB", (W, H))
    from psd_tools.api.layers import PixelLayer
    for nm, col, box in [("Ground", (120, 90, 60), (0, 80, W, H)), ("Tree", (20, 140, 40), (60, 20, 100, 90))]:
        li = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(li).rectangle(box, fill=col + (255,)); q.append(PixelLayer.frompil(li, q, nm))
    q[1].opacity = 128; q.save(os.path.join(OUT, "pt.psd"))
    r = run("""var b = new Uint8Array(fs.readFileSync(OUT + '/pt.psd')), r = P.psd.read(b); r.layers.forEach(function (l, i) { save('pl' + i, {width: l.w, height: l.h, data: l.rgba}); if (l.mask) save('pm' + i, {width: l.mask.w, height: l.mask.h, data: (function () { var o = new Uint8ClampedArray(l.mask.data.length * 4); for (var j = 0; j < l.mask.data.length; j++) o[j * 4] = o[j * 4 + 3] = l.mask.data[j]; return o; })()}); });
      return r.layers.map(function (l) { return [l.name, l.x, l.y, l.w, l.h, Math.round(l.opacity * 255), !!l.mask]; });""")
    qq = PSDImage.open(os.path.join(OUT, "pt.psd")); same = True
    for i, l in enumerate(qq):
        same = same and np.abs(get("pl%d" % i) - np.asarray(l.topil().convert("RGBA"), float)).max() == 0 and (not l.has_mask() or np.abs(get("pm%d" % i)[..., 0] - np.asarray(l.mask.topil(), float)).max() == 0)
    check("a .psd psd-tools made: Lantern reads its layers, places and opacity as psd-tools does", [x[0] for x in r] == ["Ground", "Tree"] and r[1][5] == 128 and [x[1:5] for x in r] == [[l.bbox[0], l.bbox[1], l.bbox[2] - l.bbox[0], l.bbox[3] - l.bbox[1]] for l in qq], r)
    check("...its pixels and masks, as psd-tools reads them", same)
except ImportError:
    print("SKIP  psd-tools not here: .psd not checked")
# --- Shadows/Highlights, Match Color, Replace Color, Selective Color: what each must change and what it must leave alone ---
r = run("""var out = {}, d = load('photo'), j, c;
  var greys = {width: 256, height: 1, data: new Uint8ClampedArray(1024)}; for (j = 0; j < 256; j++) { greys.data[j * 4] = greys.data[j * 4 + 1] = greys.data[j * 4 + 2] = j; greys.data[j * 4 + 3] = 255; }
  var g1 = {width: 256, height: 1, data: new Uint8ClampedArray(greys.data)}; P.adjust.selectiveColor(g1, {reds: [-60, 40, 30, 20], greens: [50, -50, 0, 0], blues: [0, 30, -70, 10], yellows: [20, 20, 20, 20], cyans: [-30, 0, 0, 0], magentas: [0, 0, 80, 0]});
  out.greysKept = Array.prototype.every.call(g1.data, function (v, i) { return v === greys.data[i]; });
  var z = load('photo'); P.adjust.selectiveColor(z, {reds: [0, 0, 0, 0], neutrals: [0, 0, 0, 0]}); out.zeroKept = Array.prototype.every.call(z.data, function (v, i) { return v === d.data[i]; });
  var pr = {width: 3, height: 1, data: new Uint8ClampedArray([255,0,0,255, 0,255,0,255, 0,0,255,255])}; P.adjust.selectiveColor(pr, {neutrals: [50, 50, 50, 50]}); out.pureKept = Array.prototype.slice.call(pr.data);
  var rr = {width: 2, height: 1, data: new Uint8ClampedArray([200,30,30,255, 30,30,200,255])}; P.adjust.selectiveColor(rr, {reds: [-100, 0, 0, 0], relative: false}); out.redLess = Array.prototype.slice.call(rr.data);
  // shadows: a dark half and a light half
  var sh = {width: 64, height: 32, data: new Uint8ClampedArray(64 * 32 * 4)}; for (j = 0; j < 64 * 32; j++) { var x = j % 64, v = x < 32 ? [40, 30, 20] : [220, 200, 180]; for (c = 0; c < 3; c++) sh.data[j * 4 + c] = v[c]; sh.data[j * 4 + 3] = 255; }
  var s2 = {width: 64, height: 32, data: new Uint8ClampedArray(sh.data)}; P.adjust.shadowsHighlights(s2, {shadows: 50, shadowTone: 50, highlights: 0, radius: 4}); out.shDark = Array.prototype.slice.call(s2.data, (16 * 64 + 4) * 4, (16 * 64 + 4) * 4 + 3); out.shLight = Array.prototype.slice.call(s2.data, (16 * 64 + 60) * 4, (16 * 64 + 60) * 4 + 3);
  var s3 = {width: 64, height: 32, data: new Uint8ClampedArray(sh.data)}; P.adjust.shadowsHighlights(s3, {shadows: 0, highlights: 50, highlightTone: 50, radius: 4}); out.hiDark = Array.prototype.slice.call(s3.data, (16 * 64 + 4) * 4, (16 * 64 + 4) * 4 + 3); out.hiLight = Array.prototype.slice.call(s3.data, (16 * 64 + 60) * 4, (16 * 64 + 60) * 4 + 3);
  // replace colour: far colours untouched, the colour itself moved as Hue/Saturation moves it
  var rc = load('photo'); P.adjust.replaceColor(rc, {color: [200, 120, 90], fuzziness: 40, hue: 90, saturation: 20, lightness: 0}); var far = 0, farMoved = 0;
  for (j = 0; j < d.data.length; j += 4) { var dd = Math.max(Math.abs(d.data[j] - 200), Math.abs(d.data[j + 1] - 120), Math.abs(d.data[j + 2] - 90)); if (dd >= 40) { far++; if (rc.data[j] !== d.data[j] || rc.data[j + 1] !== d.data[j + 1] || rc.data[j + 2] !== d.data[j + 2]) farMoved++; } }
  out.far = [far, farMoved];
  var one = {width: 1, height: 1, data: new Uint8ClampedArray([200, 120, 90, 255])}, hs = {width: 1, height: 1, data: new Uint8ClampedArray([200, 120, 90, 255])}; P.adjust.replaceColor(one, {color: [200, 120, 90], fuzziness: 40, hue: 90, saturation: 20}); P.adjust.hueSat(hs, {hue: 90, saturation: 20});
  out.exact = [Array.prototype.slice.call(one.data, 0, 3), Array.prototype.slice.call(hs.data, 0, 3)];
  // match colour: its own numbers change nothing; another picture's make its mean and spread
  var m1 = load('photo'), st = P.adjust.stats(m1); P.adjust.matchColor(m1, {source: st}); var dmax = 0; for (j = 0; j < d.data.length; j++) if (j % 4 !== 3) dmax = Math.max(dmax, Math.abs(m1.data[j] - d.data[j])); out.selfMax = dmax;
  var tgt = {width: 80, height: 60, data: new Uint8ClampedArray(80 * 60 * 4)}; for (j = 0; j < 4800; j++) { var t = (j % 80) / 80, u = Math.floor(j / 80) / 60; tgt.data[j * 4] = 150 + 60 * t; tgt.data[j * 4 + 1] = 110 + 40 * u; tgt.data[j * 4 + 2] = 70 + 30 * t * u; tgt.data[j * 4 + 3] = 255; }
  var ts = P.adjust.stats(tgt), m2 = load('photo'); P.adjust.matchColor(m2, {source: ts}); var ms = P.adjust.stats(m2); out.match = [ts.mean, ms.mean, ts.sd, ms.sd];
  return out;""")
check("Selective Color moves no grey for any colour range", r["greysKept"])
check("...and with every amount 0 changes nothing", r["zeroKept"])
check("...its Neutrals leave pure red, green and blue as they are", r["pureKept"] == [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255], r["pureKept"])
check("...less cyan in the reds makes a red redder and leaves a blue alone", r["redLess"][0] > 200 and r["redLess"][1:3] == [30, 30] and r["redLess"][4:7] == [30, 30, 200], r["redLess"])
check("Shadows/Highlights: Shadows lightens the dark part, keeps its colour's balance, leaves the light part", r["shDark"][0] > 60 and r["shDark"][0] > r["shDark"][1] > r["shDark"][2] and r["shLight"] == [220, 200, 180], (r["shDark"], r["shLight"]))
check("...Highlights darkens the light part and leaves the dark part", r["hiLight"][0] < 210 and r["hiDark"] == [40, 30, 20], (r["hiDark"], r["hiLight"]))
check("Replace Color leaves every colour farther than its fuzziness alone (%d pixels)" % r["far"][0], r["far"][0] > 1000 and r["far"][1] == 0, r["far"])
check("...and moves the colour picked exactly as Hue/Saturation moves it", r["exact"][0] == r["exact"][1], r["exact"])
check("Match Color with the picture's own numbers changes it by at most 2 levels (%d)" % r["selfMax"], r["selfMax"] <= 2, r["selfMax"])
tm, mm, ts_, ms_ = r["match"]
check("...with another picture's, its Lab mean and spread become that picture's", all(abs(tm[i] - mm[i]) < 3 for i in range(3)) and all(abs(ts_[i] - ms_[i]) < max(2, 0.15 * ts_[i]) for i in range(3)), r["match"])
try:
    from PIL import Image
    im = Image.fromarray(photo.astype(np.uint8))
    for nm, kw in [("lzw", dict(compression="tiff_lzw")), ("deflate", dict(compression="tiff_adobe_deflate")), ("pack", dict(compression="packbits")), ("raw", {})]:
        im.save(os.path.join(OUT, "p_%s.tif" % nm), **kw)
    im.convert("L").save(os.path.join(OUT, "p_gray.tif")); im.convert("P", palette=Image.ADAPTIVE, colors=40).save(os.path.join(OUT, "p_pal.tif")); im.convert("CMYK").save(os.path.join(OUT, "p_cmyk.tif"))
    Image.fromarray((photo[..., 0].astype(np.uint16) * 257)).save(os.path.join(OUT, "p_16.tif"))
    r = run("""var out = {}; ['lzw', 'deflate', 'pack', 'raw', 'gray', 'pal', 'cmyk', '16'].forEach(function (k) { try { var t = P.tiff.read(new Uint8Array(fs.readFileSync(OUT + '/p_' + k + '.tif'))); save('tr_' + k, {width: t.w, height: t.h, data: t.rgba}); out[k] = 'ok'; } catch (e) { out[k] = e.message; } });
      var d = load('photo'); fs.writeFileSync(OUT + '/l_lzw.tif', Buffer.from(P.tiff.write(d.width, d.height, d.data, {lzw: true, dpi: 300}))); fs.writeFileSync(OUT + '/l.gif', Buffer.from(P.gif.write([{rgba: d.data, colors: 256}], d.width, d.height)));
      fs.writeFileSync(OUT + '/l.bmp', Buffer.from(P.bmp(d.width, d.height, d.data))); return out;""")
    for k in ["lzw", "deflate", "pack", "raw", "gray", "pal", "cmyk", "16"]:
        if r[k] != "ok": check("a TIFF PIL made (" + k + "): Lantern reads it", False, r[k]); continue
        ref = np.asarray(Image.open(os.path.join(OUT, "p_%s.tif" % k)).convert("RGBA") if k != "16" else Image.fromarray(np.round(np.asarray(Image.open(os.path.join(OUT, "p_16.tif")), float) / 257).astype(np.uint8)).convert("RGBA"), float)
        check("a TIFF PIL made (" + k + "): Lantern reads it pixel for pixel", np.abs(get("tr_" + k) - ref).max() == 0, np.abs(get("tr_" + k) - ref).max())
    t = Image.open(os.path.join(OUT, "l_lzw.tif"))
    check("Lantern's LZW TIFF: PIL reads it pixel for pixel, at 300 ppi", np.abs(np.asarray(t.convert("RGB"), float) - photo).max() == 0 and round(t.info.get("dpi", (0,))[0]) == 300)
    g = Image.open(os.path.join(OUT, "l.gif")); e1 = np.abs(np.asarray(g.convert("RGB"), float) - photo).mean(); e0 = np.abs(np.asarray(im.quantize(256, method=Image.MEDIANCUT).convert("RGB"), float) - photo).mean()
    check("Lantern's GIF: PIL reads it; its 256 colours as close as PIL's own median cut (%.1f against %.1f)" % (e1, e0), g.size == (W, H) and e1 <= e0 * 1.1, (e1, e0))
    bm = Image.open(os.path.join(OUT, "l.bmp")); check("Lantern's BMP: PIL reads it pixel for pixel", np.abs(np.asarray(bm.convert("RGB"), float) - photo).max() == 0)
except ImportError:
    print("SKIP  PIL not here: TIFF, GIF and BMP not checked")
print("%d checks, %d failed" % (n, fails))
print("ALL PHOTO ARITHMETIC CHECKS PASS" if not fails else "PHOTO ARITHMETIC CHECKS FAILED")
sys.exit(1 if fails else 0)
