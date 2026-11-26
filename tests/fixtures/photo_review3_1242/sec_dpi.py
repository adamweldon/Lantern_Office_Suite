# sec_dpi.py -- the picture's resolution (ppi) kept through PNG (pHYs), JPEG (JFIF density) and BMP (pixels per metre),
# saving and opening; read back with PIL, and the chunks checked by hand against the PNG and JFIF specifications.
import io, struct, zlib
import numpy as np
from PIL import Image
from core import *
from pics import *

SEC = "dpi"


def png_chunks(b):
    out = []; i = 8
    while i + 12 <= len(b):
        n = struct.unpack(">I", b[i:i + 4])[0]; t = b[i + 4:i + 8]; data = b[i + 8:i + 8 + n]; crc = struct.unpack(">I", b[i + 8 + n:i + 12 + n])[0]
        out.append((t.decode("latin-1"), data, crc == (zlib.crc32(t + data) & 0xffffffff)))
        i += 12 + n
    return out


def jpeg_segments(b):
    out = []; i = 2
    while i + 4 <= len(b) and b[i] == 0xFF:
        m = b[i + 1]
        if m == 0xDA:
            break
        n = struct.unpack(">H", b[i + 2:i + 4])[0]
        out.append((m, b[i + 4:i + 2 + n])); i += 2 + n
    return out


def run(pg, B):
    W, H = 20, 12
    pic = grad(W, H)
    for dpi in (300, 72, 96, 150, 600, 72.5):
        pg.make("dp", W, H, [dict(name="Back", rgba=pic)])
        pg.ev("RV.docs.dp.dpi = %s" % dpi)
        # PNG
        s = pg.save("dp", "png"); b = s["bytes"]
        ch = png_chunks(b)
        phys = [c for c in ch if c[0] == "pHYs"]
        im = Image.open(io.BytesIO(b)); im.load()
        got = im.info.get("dpi")
        ok = len(phys) == 1 and phys[0][2] and got and abs(got[0] - dpi) < 0.02 and abs(got[1] - dpi) < 0.02 and ch[0][0] == "IHDR" and [c[0] for c in ch].index("pHYs") < [c[0] for c in ch].index("IDAT") and all(c[2] for c in ch)
        B.check(SEC, "PNG saved at %s ppi: one pHYs chunk, right CRC, before IDAT, PIL reads %s" % (dpi, dpi), ok,
                got="pHYs chunks %d, CRCs %s, PIL dpi %s, chunk order %s" % (len(phys), [c[2] for c in ch], got, [c[0] for c in ch][:5]), want="1, all good, (%s, %s)" % (dpi, dpi),
                how="PNG spec 11.3.5.3: pHYs = 4-byte X and Y pixels per unit, 1 byte unit (1 = metre), before the first IDAT; PIL 12")
        # JPEG
        s = pg.save("dp", "jpg"); b = s["bytes"]
        seg = jpeg_segments(b)
        app0 = [d for m, d in seg if m == 0xE0 and d[:5] == b"JFIF\0"]
        im = Image.open(io.BytesIO(b)); im.load()
        got = im.info.get("dpi")
        want_d = round(dpi)
        ok = len(app0) == 1 and app0[0][7] == 1 and got and abs(got[0] - dpi) <= 0.5 and abs(got[1] - dpi) <= 0.5
        B.check(SEC, "JPEG saved at %s ppi: one JFIF segment, units dots/inch, PIL reads %s" % (dpi, want_d), ok,
                got="JFIF segments %d, units %s, PIL dpi %s" % (len(app0), app0[0][7] if app0 else None, got), want="1, 1, (%s, %s) to the nearest whole number" % (dpi, dpi),
                how="JFIF 1.02: APP0 'JFIF\\0', version, units (1 = dots per inch), Xdensity, Ydensity (whole numbers)")
        # BMP
        s = pg.save("dp", "bmp"); b = s["bytes"]
        im = Image.open(io.BytesIO(b)); im.load()
        got = im.info.get("dpi")
        ppm = struct.unpack("<ii", b[38:46])
        ok = got and abs(got[0] - dpi) < 0.05 and ppm[0] == ppm[1] == round(dpi / 0.0254)
        B.check(SEC, "BMP saved at %s ppi: pixels per metre %d, PIL reads %s" % (dpi, round(dpi / 0.0254), dpi), ok, got="ppm %s, PIL dpi %s" % (ppm, got), want=round(dpi / 0.0254),
                how="BITMAPINFOHEADER biXPelsPerMeter / biYPelsPerMeter at offsets 38 and 42")
        # TIFF and PSD keep it too
        s = pg.save("dp", "tif"); im = Image.open(io.BytesIO(s["bytes"])); got = im.info.get("dpi")
        B.check(SEC, "TIFF saved at %s ppi: PIL reads it" % dpi, got and abs(got[0] - dpi) < 0.02, got=got, want=dpi)

    # opening: files made by PIL with a resolution
    def opened_dpi(data, name):
        info = pg.open_err(data, name, "od")
        return info.get("dpi", info.get("error"))
    img = Image.fromarray(pic[..., :3])
    for dpi in (300, 96, 240):
        bio = io.BytesIO(); img.save(bio, "PNG", dpi=(dpi, dpi)); got = opened_dpi(bio.getvalue(), "a.png")
        B.check(SEC, "a PNG made by PIL at %d ppi opens at %d ppi (within 0.02: pHYs holds whole pixels per metre)" % (dpi, dpi), got is not None and abs(got - dpi) <= 0.02, got=got, want=dpi)
        bio = io.BytesIO(); img.save(bio, "JPEG", dpi=(dpi, dpi)); got = opened_dpi(bio.getvalue(), "a.jpg")
        B.check(SEC, "a JPEG made by PIL at %d ppi opens at %d ppi" % (dpi, dpi), got == dpi, got=got, want=dpi)
        bio = io.BytesIO(); img.save(bio, "BMP", dpi=(dpi, dpi)); got = opened_dpi(bio.getvalue(), "a.bmp")
        B.check(SEC, "a BMP made by PIL at %d ppi opens at %d ppi" % (dpi, dpi), got is not None and abs(got - dpi) < 0.02, got=got, want=dpi)
    # a PNG whose pHYs gives only the shape of a pixel (unit 0): no resolution, so the default
    bio = io.BytesIO(); img.save(bio, "PNG"); b = bio.getvalue()
    phys = b"pHYs" + struct.pack(">IIB", 3, 2, 0)
    chunk = struct.pack(">I", 9) + phys + struct.pack(">I", zlib.crc32(phys) & 0xffffffff)
    b2 = b[:33] + chunk + b[33:]
    got = opened_dpi(b2, "aspect.png")
    B.check(SEC, "a PNG whose pHYs unit is 0 (pixel shape only) opens at the default 72 ppi", got == 72, got=got, want=72, how="PNG spec: unit 0 = unknown, the values give only the aspect ratio")
    # a JPEG with JFIF in dots per centimetre
    bio = io.BytesIO(); img.save(bio, "JPEG", dpi=(300, 300)); b = bytearray(bio.getvalue())
    assert b[6:11] == b"JFIF\0"
    b[13] = 2; b[14:16] = struct.pack(">H", 118); b[16:18] = struct.pack(">H", 118)
    got = opened_dpi(bytes(b), "cm.jpg")
    B.check(SEC, "a JPEG with JFIF density 118 dots/cm opens at 299.72 ppi", got is not None and abs(got - 299.72) < 0.02, got=got, want=299.72, how="JFIF units 2 = dots per cm; x 2.54")
    # a JPEG whose resolution is only in its EXIF (as cameras write: no JFIF segment)
    ex = Image.Exif(); ex[282] = 300.0; ex[283] = 300.0; ex[296] = 2
    bio = io.BytesIO(); img.save(bio, "JPEG", exif=ex.tobytes()); b = bio.getvalue()
    segs = jpeg_segments(b)
    # take the JFIF APP0 out, keep EXIF (APP1)
    out = b[:2]; i = 2
    while i + 4 <= len(b) and b[i] == 0xFF and b[i + 1] != 0xDA:
        n = struct.unpack(">H", b[i + 2:i + 4])[0]
        if not (b[i + 1] == 0xE0 and b[i + 4:i + 9] == b"JFIF\0"):
            out += b[i:i + 2 + n]
        i += 2 + n
    out += b[i:]
    chk = Image.open(io.BytesIO(out)); chk.load()
    got = opened_dpi(out, "camera.jpg")
    B.check(SEC, "a camera-style JPEG (no JFIF; EXIF XResolution 300 inches) opens at 300 ppi", got == 300, got=got, want=300, sure="medium",
            how="EXIF 2.3 XResolution/YResolution/ResolutionUnit (tags 282, 283, 296); PIL reads dpi %s from it; Photoshop takes a camera JPEG's resolution from EXIF (reviewer's memory)" % (chk.info.get("dpi"),))
    # round trip: opened at 300, saved as each format
    bio = io.BytesIO(); img.save(bio, "PNG", dpi=(300, 300))
    pg.open(bio.getvalue(), "rt.png", "rt")
    res = {}
    for fmt in ("png", "jpg", "bmp", "tif"):
        s = pg.save("rt", fmt); im2 = Image.open(io.BytesIO(s["bytes"])); res[fmt] = im2.info.get("dpi")
    B.check(SEC, "a 300 ppi PNG opened and saved as PNG, JPEG, BMP and TIFF stays 300 ppi in each", all(v and abs(v[0] - 300) < 0.02 for v in res.values()), got=res, want="300 everywhere")
    s = pg.save("rt", "psd")
    from psd_tools import PSDImage
    ps = PSDImage.open(io.BytesIO(s["bytes"]))
    ri = ps.image_resources.get_data(1005)
    hz = getattr(ri, "horizontal", None)
    B.check(SEC, "...and as PSD (ResolutionInfo 1005 says 300)", hz is not None and abs(hz / 65536 - 300) < 0.01, got=None if hz is None else hz / 65536, want=300,
            how="Adobe spec resource 1005: horizontal resolution as 16.16 fixed point (psd-tools gives the raw number)")
