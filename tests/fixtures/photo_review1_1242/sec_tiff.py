# sec_tiff.py -- TIFF: many kinds made by ImageMagick (libtiff 4.5) and PIL, opened in Lantern and compared with what
# ImageMagick decodes; Lantern's own TIFF (LZW and plain) read back by PIL and ImageMagick.
import os, io, subprocess
import numpy as np
from PIL import Image
from review_core import *

SEC = "tiff"

def src_picture(w=61, h=37, alpha=False):
    rng = np.random.default_rng(5)
    y = np.linspace(0, 1, h)[:, None]; x = np.linspace(0, 1, w)[None, :]
    a = np.dstack([40 + 200 * x + 0 * y, 30 + 180 * y + 0 * x, 220 - 150 * x * y])
    a[h // 3: h // 2, :, :] = [250, 250, 250]          # a run of one colour (PackBits, LZW runs)
    a = np.clip(a + rng.normal(0, 6, a.shape), 0, 255).astype(np.uint8)
    if not alpha: return a
    al = np.full((h, w), 255, np.uint8); al[:, w // 2:] = np.tile(np.linspace(255, 20, w - w // 2), (h, 1)).astype(np.uint8); al[0:4, 0:6] = 0
    return np.dstack([a, al])

VARIANTS = [
    # name, source kind, ImageMagick options
    ("im_none.tif", "rgb", ["-compress", "None"]),
    ("im_lzw.tif", "rgb", ["-compress", "LZW"]),
    ("im_lzw_pred.tif", "rgb", ["-compress", "LZW", "-define", "tiff:predictor=2"]),
    ("im_zip_pred.tif", "rgb", ["-compress", "ZIP", "-define", "tiff:predictor=2"]),
    ("im_zip.tif", "rgb", ["-compress", "ZIP"]),
    ("im_packbits.tif", "rgb", ["-compress", "RLE"]),
    ("im_tiled_lzw.tif", "rgb", ["-compress", "LZW", "-define", "tiff:tile-geometry=16x16"]),
    ("im_planar_lzw.tif", "rgb", ["-compress", "LZW", "-interlace", "plane"]),
    ("im_planar_tiled.tif", "rgb", ["-compress", "None", "-interlace", "plane", "-define", "tiff:tile-geometry=16x16"]),
    ("im_bigendian.tif", "rgb", ["-endian", "MSB", "-compress", "None"]),
    ("im_bigendian_lzw_pred.tif", "rgb", ["-endian", "MSB", "-compress", "LZW", "-define", "tiff:predictor=2"]),
    ("im_rows3.tif", "rgb", ["-compress", "LZW", "-define", "tiff:rows-per-strip=3"]),
    ("im_16.tif", "rgb", ["-depth", "16", "-compress", "None"]),
    ("im_16_bigendian.tif", "rgb", ["-depth", "16", "-endian", "MSB", "-compress", "None"]),
    ("im_16_lzw_pred.tif", "rgb", ["-depth", "16", "-compress", "LZW", "-define", "tiff:predictor=2"]),
    ("im_16_zip_pred.tif", "rgb", ["-depth", "16", "-compress", "ZIP", "-define", "tiff:predictor=2"]),
    ("im_float32.tif", "rgb", ["-depth", "32", "-define", "quantum:format=floating-point", "-compress", "None"]),
    ("im_float32_zip_pred3.tif", "rgb", ["-depth", "32", "-define", "quantum:format=floating-point", "-compress", "ZIP", "-define", "tiff:predictor=3"]),
    ("im_gray.tif", "rgb", ["-colorspace", "Gray", "-compress", "None"]),
    ("im_gray_minwhite.tif", "rgb", ["-colorspace", "Gray", "-define", "tiff:photometric=min-is-white", "-compress", "None"]),
    ("im_gray16.tif", "rgb", ["-colorspace", "Gray", "-depth", "16", "-compress", "LZW"]),
    ("im_gray4.tif", "rgb", ["-colorspace", "Gray", "-depth", "4", "-compress", "None"]),
    ("im_bilevel.tif", "rgb", ["-monochrome", "-compress", "None"]),
    ("im_bilevel_g4.tif", "rgb", ["-monochrome", "-compress", "Group4"]),
    ("im_palette.tif", "rgb", ["-colors", "200", "-type", "Palette", "-compress", "LZW"]),
    ("im_palette4.tif", "rgb", ["-colors", "16", "-type", "Palette", "-depth", "4", "-compress", "None"]),
    ("im_cmyk.tif", "rgb", ["-colorspace", "CMYK", "-compress", "LZW"]),
    ("im_rgba_unassoc.tif", "rgba", ["-define", "tiff:alpha=unassociated", "-compress", "LZW"]),
    ("im_rgba_assoc.tif", "rgba", ["-define", "tiff:alpha=associated", "-compress", "None"]),
    ("im_gray_alpha.tif", "rgba", ["-colorspace", "Gray", "-compress", "None"]),
    ("im_jpeg.tif", "rgb", ["-compress", "JPEG"]),
]

def make_inputs():
    os.makedirs(INP, exist_ok=True)
    srgb = os.path.join(INP, "tif_src_rgb.png"); srgba = os.path.join(INP, "tif_src_rgba.png")
    if not os.path.exists(srgb): Image.fromarray(src_picture()).save(srgb)
    if not os.path.exists(srgba): Image.fromarray(src_picture(alpha=True)).save(srgba)
    for name, kind, opts in VARIANTS:
        p = os.path.join(INP, name)
        if os.path.exists(p): continue
        src = srgba if kind == "rgba" else srgb
        r = subprocess.run(["convert", src] + opts + [p], capture_output=True, text=True)
        if r.returncode: print("could not make", name, r.stderr[:200])
    p = os.path.join(INP, "im_multipage.tif")
    if not os.path.exists(p):
        subprocess.run(["convert", srgb, os.path.join(INP, "tif_src_rgba.png"), "-compress", "LZW", p], check=True)
    # PIL's own writers
    a = src_picture(); im = Image.fromarray(a)
    for name, kw in [("pil_lzw.tif", {"compression": "tiff_lzw"}), ("pil_deflate.tif", {"compression": "tiff_adobe_deflate"}), ("pil_packbits.tif", {"compression": "packbits"}), ("pil_raw.tif", {})]:
        p = os.path.join(INP, name)
        if not os.path.exists(p): im.save(p, dpi=(300, 300), **kw)
    p = os.path.join(INP, "pil_rgba_lzw.tif")
    if not os.path.exists(p): Image.fromarray(src_picture(alpha=True)).save(p, compression="tiff_lzw")
    p = os.path.join(INP, "pil_I16.tif")
    if not os.path.exists(p):
        g16 = (np.tile(np.linspace(0, 65535, 61), (37, 1))).astype(np.uint16)
        Image.fromarray(g16).save(p)
    p = os.path.join(INP, "pil_dpi_cm.tif")
    if not os.path.exists(p):
        im.save(p, dpi=(118.11, 118.11), resolution_unit=3) if False else None
        # PIL writes ResolutionUnit inch; make one in centimetres with ImageMagick
        subprocess.run(["convert", srgb, "-units", "PixelsPerCentimeter", "-density", "118.11", "-compress", "None", p], check=True)

def im_decode(path, frame=0):
    """what ImageMagick (libtiff) decodes: h x w x 4 uint8"""
    r = subprocess.run(["convert", "%s[%d]" % (path, frame), "-alpha", "on", "-depth", "8", "rgba:-"], capture_output=True)
    ident = subprocess.run(["identify", "-format", "%w %h\n", "%s[%d]" % (path, frame)], capture_output=True, text=True).stdout.split()
    w, h = int(ident[0]), int(ident[1])
    return np.frombuffer(r.stdout, np.uint8).reshape(h, w, 4)

def run(pg, B):
    make_inputs()
    rgb = src_picture(); rgba_src = src_picture(alpha=True)
    for name, kind, opts in VARIANTS + [("im_multipage.tif", "rgb", []), ("pil_lzw.tif", "rgb", []), ("pil_deflate.tif", "rgb", []), ("pil_packbits.tif", "rgb", []), ("pil_raw.tif", "rgb", []), ("pil_rgba_lzw.tif", "rgba", []), ("pil_I16.tif", "gray", [])]:
        p = os.path.join(INP, name)
        if not os.path.exists(p): continue
        data = open(p, "rb").read()
        try:
            info = pg.open(data, name, "t_" + name)
        except Exception as e:
            msg = str(e).split("\n")[0][:200]
            if name == "im_jpeg.tif":
                B.check(SEC, "%s: a JPEG-packed TIFF is refused with a plain message (as the module says)" % name, "JPEG" in msg, msg, "says JPEG")
            elif name == "im_bilevel_g4.tif":
                B.check(SEC, "%s: a CCITT Group 4 TIFF (not claimed) is refused with a plain message" % name, "does not read" in msg, msg, "a plain refusal")
                B.info(SEC, "gap: CCITT Group 4 (bilevel scans, faxes) does not open", msg)
            else:
                B.check(SEC, "%s: opens" % name, False, msg, "opens")
            continue
        got = pg.flat("t_" + name)
        ref = im_decode(p)
        if name == "im_rgba_assoc.tif":
            # libtiff/ImageMagick un-premultiply on reading; compare where alpha is high enough to keep colour
            m = rgba_src[:, :, 3] >= 64
            d = np.abs(got.astype(int) - rgba_src.astype(int))[m].max() if got.shape == rgba_src.shape else 999
            B.check(SEC, "%s: associated (premultiplied) alpha brought back to plain colour (<= 3 where alpha >= 64)" % name, d <= 3, d, "<= 3")
            continue
        if got.shape != ref.shape:
            B.check(SEC, "%s: size" % name, False, got.shape, ref.shape); continue
        tol = 1 if ("16" in name or "float" in name or "I16" in name) else 0
        if name.startswith("im_cmyk") or "palette" in name: tol = 1
        if "unassoc" in name or "rgba" in name or "gray_alpha" in name:
            m = ref[:, :, 3] >= 64
            d = np.abs(got.astype(int) - ref.astype(int)); d[~m] = 0; dd = d.max(); tol = max(tol, 2)
            lo = (ref[:, :, 3] > 0) & (ref[:, :, 3] < 64)
            if lo.any(): B.info(SEC, name + ": colour error where alpha is 1-63 (canvas holds colour premultiplied)", int(np.abs(got.astype(int) - ref.astype(int))[lo][:, :3].max()))
        else:
            dd = maxdiff(got, ref)
        extra = ""
        if dd > tol:
            ij = np.unravel_index(np.abs(got.astype(int) - ref.astype(int)).max(axis=2).argmax(), got.shape[:2])
            extra = " at %s Lantern %s ImageMagick %s" % (tuple(int(v) for v in ij), got[ij].tolist(), ref[ij].tolist())
        B.check(SEC, "%s: pixels as libtiff (ImageMagick) decodes them (<= %d%s)" % (name, tol, ", where alpha >= 64" if ("rgba" in name or "alpha" in name) else ""), dd <= tol, "max diff %d%s" % (dd, extra), "<= %d" % tol)
        if name == "im_multipage.tif":
            B.check(SEC, "im_multipage.tif: says it has 2 pages and opened the first", any("2 pages" in n for n in info["notes"]), info["notes"], "a note: 2 pages")
    # resolution
    for name, want in [("pil_raw.tif", 300), ("pil_dpi_cm.tif", 300)]:
        info = pg.open(open(os.path.join(INP, name), "rb").read(), name, "r_" + name)
        B.check(SEC, "%s: resolution read as %d dpi" % (name, want), abs(info["dpi"] - want) <= 1, info["dpi"], want)
    # ---- Lantern's own TIFF
    buf = io.BytesIO(); Image.fromarray(rgb).save(buf, "PNG"); pg.open(buf.getvalue(), "photo.png", "w_rgb")
    buf = io.BytesIO(); Image.fromarray(rgba_src).save(buf, "PNG"); pg.open(buf.getvalue(), "photoa.png", "w_rgba")
    out = OUTDIR; os.makedirs(out, exist_ok=True)
    for key, src in [("w_rgb", rgb), ("w_rgba", rgba_src)]:
        held = pg.flat(key)
        for lzw in (True, False):
            r = pg.save(key, "tif", {"lzw": lzw}); p = os.path.join(out, "%s_%s.tif" % (key, "lzw" if lzw else "plain")); open(p, "wb").write(r["bytes"])
            try:
                im = Image.open(p); im.load(); a = np.array(im.convert("RGBA"))
                B.check(SEC, "Lantern TIFF %s %s: PIL reads the same pixels" % (key, "LZW" if lzw else "plain"), maxdiff(a, held) == 0, maxdiff(a, held), 0)
            except Exception as e:
                B.check(SEC, "Lantern TIFF %s %s: PIL reads it" % (key, "LZW" if lzw else "plain"), False, repr(e)[:200], "reads")
            ref = im_decode(p)
            B.check(SEC, "Lantern TIFF %s %s: ImageMagick (libtiff) reads the same pixels" % (key, "LZW" if lzw else "plain"), maxdiff(ref, held) == 0, maxdiff(ref, held), 0)
            chk = subprocess.run(["identify", "-verbose", p], capture_output=True, text=True)
            B.check(SEC, "Lantern TIFF %s %s: libtiff gives no warning" % (key, "LZW" if lzw else "plain"), "warning" not in (chk.stderr + chk.stdout).lower(), chk.stderr[:200], "no warning")
    # a big picture through LZW (the dictionary fills and is cleared many times): photo-like noise, 1500 x 1000
    big = np.clip(np.random.default_rng(9).normal(128, 50, (1000, 1500, 3)), 0, 255).astype(np.uint8)
    big[:, :, 1] = (np.arange(1500)[None, :] // 7 % 256)
    buf = io.BytesIO(); Image.fromarray(big).save(buf, "PNG"); pg.open(buf.getvalue(), "big.png", "w_big")
    r = pg.save("w_big", "tif", {"lzw": True}); p = os.path.join(out, "big_lzw.tif"); open(p, "wb").write(r["bytes"])
    a = np.array(Image.open(p).convert("RGB"))
    B.check(SEC, "Lantern TIFF LZW of a 1500 x 1000 noisy picture: PIL reads it exactly", maxdiff(a, big) == 0, maxdiff(a, big), 0)
    # and Lantern reads libtiff's LZW of the same
    p2 = os.path.join(out, "big_im_lzw_pred.tif"); Image.fromarray(big).save(os.path.join(out, "big.png"))
    subprocess.run(["convert", os.path.join(out, "big.png"), "-compress", "LZW", "-define", "tiff:predictor=2", p2], check=True)
    pg.open(open(p2, "rb").read(), "big_im.tif", "big_im"); got = pg.flat("big_im")
    B.check(SEC, "libtiff LZW+predictor 1500 x 1000 noisy picture opens exactly in Lantern", maxdiff(got[:, :, :3], big) == 0, maxdiff(got[:, :, :3], big), 0)
    os.remove(os.path.join(out, "big.png"))
