# photo_algos.py -- the Photo tile's arithmetic (1.24.42) against other programs' own: SciPy's filters and distance transform,
# PIL's resampling, OpenCV's perspective warp, scikit-image's flood fill, psd-tools reading Lantern's .psd and Lantern reading
# psd-tools', PIL reading Lantern's TIFF, GIF and BMP and Lantern reading PIL's TIFFs, and the formulas Photoshop documents
# (Levels, Posterize, Desaturate, Black & White's defaults, Exposure in stops). The modules run in Node, taken from
# src/lantern.inner.html between their markers. Each that needs a program not on the machine says SKIP.
# Usage: python3 tests/photo_algos.py
import os, re, sys, json, subprocess, tempfile
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = open(os.path.join(ROOT, "src", "lantern.inner.html"), encoding="utf-8").read()
NAMES = ["PHOTO_MATH", "PHOTO_ADJ_TONE", "PHOTO_ADJ_COLOR", "PHOTO_FILT_BLUR", "PHOTO_FILT_SHARPEN", "PHOTO_FILT_NOISE", "PHOTO_FILT_DISTORT", "PHOTO_FILT_STYLE",
         "PHOTO_FILT_PIXELATE", "PHOTO_RESAMPLE", "PHOTO_SEL_OPS", "PHOTO_HEAL", "PHOTO_INPAINT", "PHOTO_PSD_ADJ", "PHOTO_PSD_READ", "PHOTO_PSD_WRITE", "PHOTO_TIFF", "PHOTO_GIF"]
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
    check("Expand 6 px: every pixel within 5.5 px chosen, none beyond 6.5", (e[edt_out <= 5.5] == 255).all() and (e[edt_out >= 6.5] == 0).all())
    check("Contract 6 px: none within 5.5 px of the edge, all beyond 6.5", (c[(blob > 0) & (edt_in <= 5.5)] == 0).all() and (c[edt_in >= 6.5] == 255).all())
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
