# sec_tiff.py -- TIFF reading with the horizontal predictor at 16 bits (LZW and Deflate, both byte orders, chunky and
# planar, strips and tiles) and the floating-point predictor (3) at 32 bits. The files are written by ImageMagick
# (libtiff) and, for the floating-point predictor, also by hand from Adobe's TIFF Technical Note 3; every file is first
# decoded by libtiff (through ImageMagick) to check it holds the values meant. Small files are kept in inputs/.
import os, struct, subprocess, zlib
import numpy as np
from core import *

SEC = "tiff"
H, W = 7, 11


def src16():
    y, x = np.mgrid[0:H, 0:W]
    return np.dstack([(x * 4099 + y * 733 + c * 9001) % 65536 for c in range(3)]).astype(np.uint16)


def src32():
    y, x = np.mgrid[0:H, 0:W]
    return np.dstack([((x * 0.113 + y * 0.071 + c * 0.29) % 1.0) for c in range(3)]).astype(np.float32)


def im(*args):
    r = subprocess.run(["convert"] + list(args), capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr.decode()[:300])
    return r.stdout


def tiff_by_hand(arr, comp=8, predictor=3, rows_per_strip=None, big_endian=False, extra=None):
    """A strip TIFF (TIFF 6.0) of float32 samples, chunky, compressed with Deflate (8), floating-point predictor per
    Adobe TIFF Technical Note 3: each row's samples split into byte planes, most significant first, then each byte made
    the difference from the byte `samples-per-pixel` before it."""
    h, w = arr.shape[:2]; spp = 1 if arr.ndim == 2 else arr.shape[2]
    rps = rows_per_strip or h
    e = ">" if big_endian else "<"
    strips = []
    for y0 in range(0, h, rps):
        rows = b""
        for y in range(y0, min(h, y0 + rps)):
            row = arr[y].reshape(-1).astype(">f4")          # wc samples, big-endian bytes (MSB first)
            wc = row.size
            b = np.frombuffer(row.tobytes(), np.uint8).reshape(wc, 4)
            planes = bytearray(b.T.reshape(-1).tobytes())   # byte 0 of every sample, then byte 1 ...
            if predictor == 3:
                for i in range(len(planes) - 1, spp - 1, -1):
                    planes[i] = (planes[i] - planes[i - spp]) & 255
                rows += bytes(planes)
            else:
                rows += arr[y].reshape(-1).astype(e + "f4").tobytes()
        strips.append(zlib.compress(rows) if comp == 8 else rows)
    tags = []
    def tag(t, typ, vals):
        tags.append((t, typ, vals if isinstance(vals, list) else [vals]))
    tag(256, 4, w); tag(257, 4, h); tag(258, 3, [32] * spp); tag(259, 3, comp); tag(262, 3, 1 if spp in (1, 2) else 2)
    tag(273, 4, [0] * len(strips)); tag(277, 3, spp); tag(278, 4, rps); tag(279, 4, [len(s) for s in strips]); tag(284, 3, 1)
    if predictor != 1:
        tag(317, 3, predictor)
    if extra is not None:
        tag(338, 3, extra)
    tag(339, 3, [3] * spp)
    tags.sort()
    n = len(tags); ifd_at = 8; after = ifd_at + 2 + n * 12 + 4
    blob = bytearray(); offs = {}
    for t, typ, vals in tags:
        size = (2 if typ == 3 else 4) * len(vals)
        if size > 4:
            offs[t] = after + len(blob); blob += b"\0" * size
            if len(blob) % 2: blob += b"\0"
    data_at = after + len(blob)
    so = []; p = data_at
    for s in strips:
        so.append(p); p += len(s)
    out = bytearray((b"MM" if big_endian else b"II") + struct.pack(e + "HI", 42, ifd_at))
    out += struct.pack(e + "H", n)
    for t, typ, vals in tags:
        if t == 273:
            vals = so
        fmt = "H" if typ == 3 else "I"
        raw = struct.pack(e + fmt * len(vals), *vals)
        if len(raw) <= 4:
            out += struct.pack(e + "HHI", t, typ, len(vals)) + raw + b"\0" * (4 - len(raw))
        else:
            out += struct.pack(e + "HHII", t, typ, len(vals), offs[t])
            blob[offs[t] - after: offs[t] - after + len(raw)] = raw
    out += struct.pack(e + "I", 0) + blob
    for s in strips:
        out += s
    return bytes(out)


def make_inputs():
    os.makedirs(INP, exist_ok=True)
    ref16 = os.path.join(OUT, "ref16.tif"); ref32 = os.path.join(OUT, "ref32.tif")
    import tifffile
    a16 = src16(); a32 = src32()
    tifffile.imwrite(ref16, a16, photometric="rgb")
    tifffile.imwrite(ref32, a32, photometric="rgb")
    g16 = a16[..., 0]; tifffile.imwrite(os.path.join(OUT, "refg16.tif"), g16, photometric="minisblack")
    rgba16 = np.dstack([a16, ((np.arange(H * W).reshape(H, W) * 911) % 65536).astype(np.uint16)])
    tifffile.imwrite(os.path.join(OUT, "refa16.tif"), rgba16, photometric="rgb", extrasamples=["unassalpha"])
    specs = {
        "t16_lzw_le.tif": [ref16, "-compress", "LZW", "-define", "tiff:predictor=2"],
        "t16_zip_be.tif": [ref16, "-compress", "Zip", "-define", "tiff:predictor=2", "-endian", "MSB"],
        "t16_lzw_be.tif": [ref16, "-compress", "LZW", "-define", "tiff:predictor=2", "-endian", "MSB"],
        "t16_planar_strips.tif": [ref16, "-compress", "LZW", "-define", "tiff:predictor=2", "-interlace", "Plane", "-define", "tiff:rows-per-strip=3"],
        "t16_grey_lzw.tif": [os.path.join(OUT, "refg16.tif"), "-compress", "LZW", "-define", "tiff:predictor=2"],
        "t16_rgba_zip.tif": [os.path.join(OUT, "refa16.tif"), "-compress", "Zip", "-define", "tiff:predictor=2"],
        "t16_tiles_zip.tif": ["-size", "40x20", "gradient:#ff2000-#0010f0", "-depth", "16", "-compress", "Zip", "-define", "tiff:predictor=2", "-define", "tiff:tile-geometry=16x16"],
        "t32_zip_p3_le.tif": [ref32, "-define", "quantum:format=floating-point", "-depth", "32", "-compress", "Zip", "-define", "tiff:predictor=3"],
        "t32_lzw_p3_le.tif": [ref32, "-define", "quantum:format=floating-point", "-depth", "32", "-compress", "LZW", "-define", "tiff:predictor=3"],
        "t32_zip_p2.tif": [ref32, "-define", "quantum:format=floating-point", "-depth", "32", "-compress", "Zip", "-define", "tiff:predictor=2"],
        "t32_none.tif": [ref32, "-define", "quantum:format=floating-point", "-depth", "32", "-compress", "None"],
    }
    for name, args in specs.items():
        p = os.path.join(INP, name)
        if not os.path.exists(p):
            im(*(args + [p]))
    # by hand (Technical Note 3): grey multi-strip, and RGBA with alpha
    y, x = np.mgrid[0:H, 0:W]
    grey = ((x * 0.07 + y * 0.13) % 1.0).astype(np.float32); grey[0, 0] = 0.5; grey[0, 1] = 0.21404114
    rgba = np.dstack([src32(), np.full((H, W), 0.5, np.float32)]); rgba[0, 0, 3] = 1.0; rgba[0, 1, 3] = 0.0
    hand = {"t32_hand_grey_strips.tif": tiff_by_hand(grey, rows_per_strip=2), "t32_hand_rgba_be.tif": tiff_by_hand(rgba, big_endian=True, extra=2)}
    for name, data in hand.items():
        p = os.path.join(INP, name)
        if not os.path.exists(p):
            open(p, "wb").write(data)
    return grey, rgba


def ident(path):
    out = subprocess.run(["identify", "-format", "%w %h", path], capture_output=True).stdout.decode().split()
    return int(out[0]), int(out[1])


def run(pg, B):
    grey, rgba = make_inputs()
    a16 = src16(); a32 = src32()
    lantern = {}
    for name in sorted(os.listdir(INP)):
        if not (name.startswith("t16") or name.startswith("t32")):
            continue
        p = os.path.join(INP, name)
        w, h = ident(p)
        ref = np.frombuffer(im(p, "-depth", "8", "-alpha", "on", "rgba:-"), np.uint8).reshape(h, w, 4)
        info = pg.open_err(open(p, "rb").read(), name, "t_" + name)
        if "error" in info:
            B.check(SEC, name + ": opens", False, got=info["error"], want="opens, or a plain refusal for a kind it does not read")
            continue
        fl = pg.flat("t_" + name)
        lantern[name] = fl
        # what the file is meant to hold (and libtiff agrees: checked first)
        if name.startswith("t16") and "grey" in name:
            want = np.dstack([np.round(a16[..., 0] / 257)] * 3 + [np.full((H, W), 255)])
        elif name.startswith("t16_rgba"):
            al = (np.arange(H * W).reshape(H, W) * 911) % 65536
            want = np.dstack([np.round(a16 / 257), np.round(al / 257)])
        elif name.startswith("t16_tiles"):
            v = np.frombuffer(im(p, "-depth", "16", "rgb:-"), "<u2").reshape(h, w, 3).astype(float)
            want = np.dstack([np.floor(v / 257 + 0.5), np.full((h, w), 255)])
        elif name.startswith("t16"):
            want = np.dstack([np.round(a16 / 257), np.full((H, W), 255)])
        elif "hand_grey" in name:
            want = np.dstack([np.round(np.clip(grey, 0, 1) * 255)] * 3 + [np.full((H, W), 255)])
        elif "hand_rgba" in name:
            want = np.round(np.clip(rgba, 0, 1) * 255)
        else:
            want = np.dstack([np.round(np.clip(a32, 0, 1) * 255), np.full((H, W), 255)])
        if True:
            lib_ok = maxdiff(ref, want) <= 1
            B.check(SEC, "(input check) libtiff decodes %s to the values meant" % name, lib_ok, got=maxdiff(ref, want), want="<= 1", how="ImageMagick 6.9 / libtiff")
        d = maxdiff(fl, want)
        tol = 0 if name.startswith("t16") else 1
        if "rgba" in name:
            d = round(premul_diff(fl, want), 2); tol = 1.5
        B.check(SEC, "%s: Lantern's pixels are the file's values brought to 8 bits" % name, d <= tol, got="largest difference %s; first pixels Lantern %s, meant %s" % (d, fl[0, :2].tolist(), np.asarray(want)[0, :2].tolist()),
                want="within %s" % tol, how="16-bit: round(v/257); float: round(clip(v,0,1) x 255), as libtiff/ImageMagick bring them to 8 bits")
    # the same 16-bit file in both byte orders and both packings gives the same picture
    keys = [k for k in ("t16_lzw_le.tif", "t16_zip_be.tif", "t16_lzw_be.tif", "t16_planar_strips.tif") if k in lantern]
    if len(keys) == 4:
        B.check(SEC, "16-bit: LZW and Deflate, little and big endian, chunky and planar give one picture", all(np.array_equal(lantern[keys[0]], lantern[k]) for k in keys), got=[maxdiff(lantern[keys[0]], lantern[k]) for k in keys], want=[0, 0, 0, 0])
    # one float, two files: a 32-bit TIFF and a 32-bit PSD holding 0.5 should show the same
    if "t32_hand_grey_strips.tif" in lantern and getattr(pg, "_p32", None):
        t_half = int(lantern["t32_hand_grey_strips.tif"][0, 0, 0]); t_lin = int(lantern["t32_hand_grey_strips.tif"][0, 1, 0])
        p_half, p_lin = pg._p32
        B.check(SEC, "a 32-bit float means the same in a TIFF and in a PSD (0.5 and 0.21404)", (t_half, t_lin) == (p_half, p_lin), got="TIFF %d and %d; PSD %d and %d" % (t_half, t_lin, p_half, p_lin),
                want="the same two numbers from both readers", sure="sure they differ; which mapping is right is not settled (Photoshop's 32-bit documents are linear light and show 0.5 as about 188; libtiff/ImageMagick give 128)",
                how="PHOTO_PSD_READ to8() applies the sRGB curve to 32-bit values; PHOTO_TIFF sample() multiplies by 255")
