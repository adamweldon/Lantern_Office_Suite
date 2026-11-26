# sec_export.py -- PNG, JPEG, WebP, GIF (one picture and animated), BMP and PDF saved by Lantern, opened by PIL,
# ImageMagick and poppler: sizes, pixels (exact where the format is lossless), transparency, resolution.
import os, io, subprocess, json
import numpy as np
from PIL import Image
from review_core import *
from sec_tiff import src_picture

SEC = "export"

def psnr(a, b):
    m = np.mean((a.astype(float) - b.astype(float)) ** 2)
    return 99 if m == 0 else 10 * np.log10(255 * 255 / m)

def png_bytes(arr, **kw):
    buf = io.BytesIO(); Image.fromarray(arr).save(buf, "PNG", **kw); return buf.getvalue()

def run(pg, B):
    out = OUTDIR; os.makedirs(out, exist_ok=True)
    photo = np.array(Image.open(os.path.join(INP, "photo_small.jpg")).convert("RGB")) if os.path.exists(os.path.join(INP, "photo_small.jpg")) else None
    if photo is None:
        # a phone-like photo made here: a scene with texture, saved as JPEG by PIL at 300 dpi
        from sec_psd import scene
        a = scene(480, 360, seed=11).astype(float)
        yy, xx = np.mgrid[0:360, 0:480]
        a[:, :, 1] += 25 * np.sin(xx / 7.0) * (yy > 250)           # grass texture
        a = np.clip(a, 0, 255).astype(np.uint8)
        Image.fromarray(a).save(os.path.join(INP, "photo_small.jpg"), quality=90, dpi=(300, 300))
        photo = np.array(Image.open(os.path.join(INP, "photo_small.jpg")).convert("RGB"))
    jpg = open(os.path.join(INP, "photo_small.jpg"), "rb").read()
    info = pg.open(jpg, "photo_small.jpg", "ph")
    held = pg.flat("ph")
    B.check(SEC, "JPEG opens at its size with the decoder's pixels (<= 2 vs PIL's decoder)", held.shape[:2] == photo.shape[:2] and maxdiff(held[:, :, :3], photo) <= 2, (held.shape, maxdiff(held[:, :, :3], photo)), "(360, 480), <= 2")
    B.check(SEC, "JPEG's 300 dpi is kept in the document (Image Size, PDF page size)", info["dpi"] == 300, info["dpi"], 300)
    # PNG
    r = pg.save("ph", "png"); p = os.path.join(out, "ph.png"); open(p, "wb").write(r["bytes"])
    im = Image.open(p)
    B.check(SEC, "PNG: PIL reads the same pixels (lossless)", maxdiff(np.array(im.convert("RGBA")), held) == 0, maxdiff(np.array(im.convert("RGBA")), held), 0)
    B.check(SEC, "PNG: carries the picture's resolution (pHYs 300 dpi, as Photoshop writes)", "dpi" in im.info and abs(im.info["dpi"][0] - 300) < 1, im.info.get("dpi"), "(300, 300)")
    # see-through picture
    t = src_picture(120, 80, alpha=True)
    pg.open(png_bytes(t), "alpha.png", "al"); heldA = pg.flat("al")
    m = t[:, :, 3] >= 64
    B.check(SEC, "PNG with soft alpha opens: colours where alpha >= 64 within 2", np.abs(heldA.astype(int) - t.astype(int))[m].max() <= 2, np.abs(heldA.astype(int) - t.astype(int))[m].max(), "<= 2")
    lo = (t[:, :, 3] > 0) & (t[:, :, 3] < 64)
    dlo = np.abs(heldA.astype(int) - t.astype(int))[lo][:, :3].max()
    B.check(SEC, "PNG with soft alpha: colours of nearly clear pixels (alpha 20-63) kept within 2 (Photoshop keeps them exactly)", dlo <= 2, "max diff %d" % dlo, "<= 2")
    r = pg.save("al", "png"); a2 = np.array(Image.open(io.BytesIO(r["bytes"])).convert("RGBA"))
    B.check(SEC, "PNG save of a see-through picture keeps alpha exactly", np.array_equal(a2[:, :, 3], t[:, :, 3]), "alpha differs at %d pixels" % int((a2[:, :, 3] != t[:, :, 3]).sum()), 0)
    # JPEG
    for q in (12, 10, 6, 1):
        r = pg.save("ph", "jpg", {"quality": q}); a = np.array(Image.open(io.BytesIO(r["bytes"])).convert("RGB"))
        B.info(SEC, "JPEG quality %d: %d bytes, PSNR %.1f dB" % (q, len(r["bytes"]), psnr(a, held[:, :, :3])), "")
        if q == 12: B.check(SEC, "JPEG quality 12: PSNR >= 40 dB against the picture", psnr(a, held[:, :, :3]) >= 40, "%.1f" % psnr(a, held[:, :, :3]), ">= 40")
    r = pg.save("ph", "jpg", {"quality": 10}); im = Image.open(io.BytesIO(r["bytes"]))
    B.check(SEC, "JPEG: carries the picture's resolution (300 dpi)", abs(im.info.get("dpi", (0, 0))[0] - 300) < 1, im.info.get("dpi"), "(300, 300)")
    r = pg.save("al", "jpg", {"quality": 12}); a = np.array(Image.open(io.BytesIO(r["bytes"])).convert("RGB")).astype(int)
    want = (t[:, :, :3] * (t[:, :, 3:] / 255.0) + 255 * (1 - t[:, :, 3:] / 255.0))
    B.check(SEC, "JPEG of a see-through picture: flattened on white (the help's default) (PSNR >= 35)", psnr(a, want) >= 35, "%.1f dB; a clear corner pixel %s" % (psnr(a, want), a[1, 1].tolist()), ">= 35, corner white")
    r = pg.save("al", "jpg", {"quality": 12, "bg": [0, 0, 0]}); a = np.array(Image.open(io.BytesIO(r["bytes"])).convert("RGB")).astype(int)
    B.check(SEC, "JPEG with bg black: clear corner black", a[1, 1].max() <= 8, a[1, 1].tolist(), "about [0, 0, 0]")
    # WebP
    r = pg.save("ph", "webp", {"quality": 12}); im = Image.open(io.BytesIO(r["bytes"]))
    a = np.array(im.convert("RGB"))
    B.check(SEC, "WebP quality 12: right size, PSNR >= 38", a.shape == held[:, :, :3].shape and psnr(a, held[:, :, :3]) >= 38, (a.shape, "%.1f" % psnr(a, held[:, :, :3])), ">= 38")
    r = pg.save("al", "webp", {"quality": 12}); a = np.array(Image.open(io.BytesIO(r["bytes"])).convert("RGBA")).astype(int)
    B.check(SEC, "WebP keeps transparency (alpha within 8)", np.abs(a[:, :, 3] - t[:, :, 3]).max() <= 8, np.abs(a[:, :, 3] - t[:, :, 3]).max(), "<= 8")
    # BMP
    r = pg.save("al", "bmp"); p = os.path.join(out, "al.bmp"); open(p, "wb").write(r["bytes"])
    a = np.array(Image.open(p).convert("RGBA"))
    B.check(SEC, "BMP (32-bit, V4 header): PIL reads the same pixels and alpha", maxdiff(a, heldA) == 0, maxdiff(a, heldA), 0)
    ref = subprocess.run(["convert", p, "-depth", "8", "rgba:-"], capture_output=True).stdout
    ref = np.frombuffer(ref, np.uint8).reshape(heldA.shape) if len(ref) == heldA.size else None
    B.check(SEC, "BMP: ImageMagick reads the same pixels", ref is not None and maxdiff(ref, heldA) == 0, None if ref is None else maxdiff(ref, heldA), 0)
    r = pg.save("ph", "bmp"); im = Image.open(io.BytesIO(r["bytes"]))
    B.check(SEC, "BMP: carries the picture's resolution (300 dpi = 11811 px/m)", abs(im.info.get("dpi", (0, 0))[0] - 300) < 1, im.info.get("dpi"), "(300, 300)")
    # GIF: a picture of 40 colours, some used by only a few pixels (pixel art, a chart): exact?
    rng = np.random.default_rng(3)
    pal = rng.integers(0, 256, (40, 3)).astype(np.uint8)
    idx = np.zeros((64, 96), np.int64); idx[:, :] = 0
    for k in range(1, 40):
        n = int(2 ** (k % 9))   # 2 .. 256 pixels of each
        ys = rng.integers(0, 64, n); xs = rng.integers(0, 96, n); idx[ys, xs] = k
    art = pal[idx]
    pg.open(png_bytes(art), "art.png", "art")
    r = pg.save("art", "gif"); a = np.array(Image.open(io.BytesIO(r["bytes"])).convert("RGB"))
    nlost = int((np.abs(a.astype(int) - art.astype(int)).max(axis=2) > 0).sum())
    B.check(SEC, "GIF of a 40-colour picture (some colours on few pixels) is exact (Photoshop's Exact palette would be)", nlost == 0, "%d pixels changed colour, max diff %d" % (nlost, maxdiff(a, art)), 0)
    # a photo to 256 colours
    r = pg.save("ph", "gif"); im = Image.open(io.BytesIO(r["bytes"])); a = np.array(im.convert("RGB"))
    B.check(SEC, "GIF of a photo: right size, PSNR >= 28 with 256 colours", a.shape == held[:, :, :3].shape and psnr(a, held[:, :, :3]) >= 28, "%.1f dB" % psnr(a, held[:, :, :3]), ">= 28")
    r2 = pg.save("ph", "gif", {"dither": True}); a2 = np.array(Image.open(io.BytesIO(r2["bytes"])).convert("RGB"))
    B.info(SEC, "GIF of a photo, dithered: PSNR %.1f dB; ImageMagick +dither 256 colours for comparison" % psnr(a2, held[:, :, :3]), "")
    # transparency in a single GIF
    r = pg.save("al", "gif"); im = Image.open(io.BytesIO(r["bytes"])); a = np.array(im.convert("RGBA"))
    want_t = t[:, :, 3] < 128
    B.check(SEC, "GIF with see-through parts: pixels under half solid are transparent, the rest solid", np.array_equal(a[:, :, 3] == 0, want_t), "%d pixels differ" % int(((a[:, :, 3] == 0) != want_t).sum()), 0)
    ident = subprocess.run(["identify", "-"], input=r["bytes"], capture_output=True)
    B.check(SEC, "GIF: ImageMagick reads it without complaint", ident.returncode == 0 and not ident.stderr, ident.stderr[:200], "clean")
    # animated: each layer a frame
    pg.open(open(os.path.join(INP, "pt_layers.psd"), "rb").read(), "pt_layers.psd", "anim")
    linfo = pg.J("(k) => R.info(R.docs[k])", "anim")
    nvis = len([l for l in linfo["layers"] if l["visible"] and l["kind"] != "adjust"]); nall = len([l for l in linfo["layers"] if l["kind"] != "adjust"])
    r = pg.save("anim", "gif", {"animate": True, "delay": 25}); p = os.path.join(out, "anim.gif"); open(p, "wb").write(r["bytes"])
    im = Image.open(p)
    B.check(SEC, "animated GIF: one frame per visible layer (PHOTO_FILES: 'each visible layer a frame')", im.n_frames == nvis, "%d frames (%d visible layers, %d layers)" % (im.n_frames, nvis, nall), nvis)
    im.seek(1)
    B.check(SEC, "animated GIF: frame delay 250 ms and loops forever", im.info.get("duration") == 250 and im.info.get("loop") == 0, (im.info.get("duration"), im.info.get("loop")), (250, 0))
    ident = subprocess.run(["identify", p], capture_output=True, text=True)
    B.check(SEC, "animated GIF: ImageMagick reads every frame", ident.returncode == 0 and len(ident.stdout.strip().splitlines()) == im.n_frames, len(ident.stdout.strip().splitlines()), im.n_frames)
    # PDF
    r = pg.save("ph", "pdf"); p = os.path.join(out, "ph.pdf"); open(p, "wb").write(r["bytes"])
    chk = subprocess.run(["qpdf", "--check", p], capture_output=True, text=True)
    B.check(SEC, "PDF: qpdf finds no errors", chk.returncode == 0, (chk.stdout + chk.stderr)[-300:], "no errors")
    pi = subprocess.run(["pdfinfo", p], capture_output=True, text=True).stdout
    size = [l for l in pi.splitlines() if l.startswith("Page size")]
    B.check(SEC, "PDF of the 300-dpi JPEG: page is its print size (480 x 360 px at 300 dpi = 115.2 x 86.4 pt)", size and "115.2 x 86.4" in size[0], size, "115.2 x 86.4 pts")
    dpi_doc = pg.J("(k) => R.docs[k].dpi", "ph")
    subprocess.run(["pdftoppm", "-r", str(dpi_doc), "-png", "-singlefile", p, os.path.join(out, "ph_pdf")], check=True)
    a = np.array(Image.open(os.path.join(out, "ph_pdf.png")).convert("RGB"))
    B.check(SEC, "PDF rendered by poppler at the document's resolution is the picture (480 x 360, PSNR >= 33)", a.shape == held[:, :, :3].shape and psnr(a, held[:, :, :3]) >= 33, (a.shape, "%.1f" % psnr(a, held[:, :, :3]) if a.shape == held[:, :, :3].shape else ""), ">= 33")
    # a 300-dpi TIFF (whose resolution Lantern does read): the PDF page is its print size
    pg.open(open(os.path.join(INP, "pil_raw.tif"), "rb").read(), "pil_raw.tif", "t300")
    r = pg.save("t300", "pdf"); p = os.path.join(out, "t300.pdf"); open(p, "wb").write(r["bytes"])
    pi = subprocess.run(["pdfinfo", p], capture_output=True, text=True).stdout
    size = [l for l in pi.splitlines() if l.startswith("Page size")]
    B.check(SEC, "PDF of a 300-dpi TIFF (61 x 37 px): page 14.64 x 8.88 pt", size and "14.64 x 8.88" in size[0], size, "14.64 x 8.88 pts")
    # PNG with a resolution (pHYs) opened
    pg.open(png_bytes(t, dpi=(300, 300)), "alpha300.png", "p300")
    B.check(SEC, "PNG's resolution (pHYs 300 dpi) is read", pg.J("(k) => R.docs[k].dpi", "p300") == 300, pg.J("(k) => R.docs[k].dpi", "p300"), 300)
