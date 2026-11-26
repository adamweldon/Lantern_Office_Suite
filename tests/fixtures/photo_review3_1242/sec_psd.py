# sec_psd.py -- the PSD reader and writer: 16- and 32-bit layers kept in Lr16/Lr32, ZIP with prediction at 16 and 32
# bits, the flattened picture of a see-through document (colour laid over white), Mac Roman names, Curves (with its
# "Crv " section) and Selective Color both ways. Files are made by hand from Adobe's Photoshop File Format Specification
# (core.psd_by_hand) and checked first against psd-tools' own reader, so the inputs do not depend on Lantern.
import io, struct
import numpy as np
from core import *
from pics import *

SEC = "psd"


def lsct(kind, key=None):
    d = struct.pack(">I", kind)
    if key:
        d += b"8BIM" + key
    return tagged(b"lsct", d)


def empty_chans():
    return {-1: np.zeros((0, 0)), 0: np.zeros((0, 0)), 1: np.zeros((0, 0)), 2: np.zeros((0, 0))}


def lantern_layer_pixels(pg, key, i):
    r = pg.ev("([k, i]) => { const l = RV.docs[k].layers[i]; return l.cv ? {x: l.x, y: l.y, w: l.cv.width, h: l.cv.height, b64: RV.b64(RV.px(l.cv))} : null; }", [key, i])
    if not r:
        return None
    return r["x"], r["y"], np.frombuffer(unb64(r["b64"]), np.uint8).reshape(r["h"], r["w"], 4).copy()


def parse_merged_rle(data, W, H):
    """The image data section of an 8-bit PSD (Adobe spec: after the layer and mask section): compression 1 = row byte
    counts for every channel, then PackBits rows."""
    o = 26
    o += 4 + struct.unpack(">I", data[o:o + 4])[0]          # colour mode data
    o += 4 + struct.unpack(">I", data[o:o + 4])[0]          # image resources
    o += 4 + struct.unpack(">I", data[o:o + 4])[0]          # layer and mask information
    nch = struct.unpack(">H", data[12:14])[0]
    comp = struct.unpack(">H", data[o:o + 2])[0]; o += 2
    planes = []
    if comp == 0:
        for c in range(nch):
            planes.append(np.frombuffer(data[o:o + W * H], np.uint8).reshape(H, W)); o += W * H
        return comp, planes
    counts = struct.unpack(">%dH" % (H * nch), data[o:o + 2 * H * nch]); o += 2 * H * nch
    for c in range(nch):
        rows = []
        for y in range(H):
            n = counts[c * H + y]; src = data[o:o + n]; o += n
            out = bytearray(); i = 0
            while i < len(src):
                b = src[i]; i += 1
                if b < 128:
                    out += src[i:i + b + 1]; i += b + 1
                elif b > 128:
                    out += bytes([src[i]]) * (257 - b); i += 1
            rows.append(np.frombuffer(bytes(out[:W]), np.uint8))
        planes.append(np.stack(rows))
    return comp, planes


def find_block(data, key):
    """Every tagged block with this key anywhere in the file, as raw bytes (a plain scan for '8BIM'+key)."""
    out = []; i = 0
    while True:
        i = data.find(b"8BIM" + key, i)
        if i < 0:
            return out
        n = struct.unpack(">I", data[i + 8:i + 12])[0]
        out.append(data[i + 12:i + 12 + n]); i += 12 + n


def run(pg, B):
    from psd_tools import PSDImage
    W, H = 9, 5
    y, x = np.mgrid[0:H, 0:W]

    # ------------------------------------------------ 16-bit, layers in Lr16, a group, compressions 0 / 2 / 3
    v16 = [((x * 4099 + y * 733 + c * 9001) % 65536).astype(np.uint16) for c in range(3)]
    tw, th = 4, 3
    ty, tx = np.mgrid[0:th, 0:tw]
    t16 = [((tx * 15013 + ty * 20011 + c * 3) % 65536).astype(np.uint16) for c in range(3)]
    ta16 = np.array([[65535, 32768, 257, 0], [65535, 65535, 1000, 40000], [128, 129, 383, 384]], np.uint16)
    name_mac = bytes([0x47, 0x72, 0x9f, 0xa7, 0x65, 0x20, 0x8e, 0x74, 0x8e, 0x20, 0xdb, 0xa5])   # "Größe état € •" in Mac Roman
    results16 = {}
    for comp in (0, 2, 3):
        layers = [
            dict(name_bytes=b"Back", rect=(0, 0, H, W), chans={-1: np.full((H, W), 65535, np.uint16), 0: v16[0], 1: v16[1], 2: v16[2]}, comp=comp, luni="Back"),
            dict(name_bytes=b"</Layer group>", rect=(0, 0, 0, 0), chans=empty_chans(), comp=0, extra=lsct(3), luni="</Layer group>"),
            dict(name_bytes=name_mac, rect=(1, 3, 1 + th, 3 + tw), chans={-1: ta16, 0: t16[0], 1: t16[1], 2: t16[2]}, comp=comp, blend=b"mul ", opacity=200),
            dict(name_bytes=b"Group A", rect=(0, 0, 0, 0), chans=empty_chans(), comp=0, extra=lsct(1, b"pass"), blend=b"pass", luni="Group A"),
        ]
        merged = {0: v16[0], 1: v16[1], 2: v16[2]}
        data = psd_by_hand(W, H, layers, depth=16, comp=comp, lr_block=b"Lr16", merged=merged)
        with open(os.path.join(INP, "lr16_c%d.psd" % comp), "wb") as f:
            f.write(data)
        # the file is right by psd-tools' own reader first
        ps = PSDImage.open(io.BytesIO(data))
        pl = list(ps.descendants())
        top = [l for l in pl if not l.is_group()][-1]
        tarr = top.numpy()
        sane = len(pl) == 3 and abs(tarr[0, 0, 0] - t16[0][0, 0] / 65535) < 1e-4 and abs(tarr[2, 3, 3] - ta16[2, 3] / 65535) < 1e-4
        B.check(SEC, "(input check) psd-tools reads the hand-made 16-bit Lr16 file (compression %d)" % comp, sane, got=[(l.name, l.kind) for l in pl], want="Back, Group A holding one layer",
                how="psd-tools 1.27 reader")
        info = pg.open_err(data, "lr16.psd", "p16_%d" % comp)
        if "error" in info:
            B.check(SEC, "16-bit Lr16 file (compression %d) opens" % comp, False, got=info["error"], want="opens"); continue
        L = info["layers"]
        names = [l["name"] for l in L]
        want_names = ["Back", name_mac.decode("mac_roman"), "Group A"]
        B.check(SEC, "16-bit Lr16 (compression %d): layers, group and Mac Roman name read" % comp,
                names == want_names and L[1]["gid"] == L[2]["id"] and L[2]["kind"] == "group" and L[1]["blend"] == "multiply" and abs(L[1]["opacity"] - 200 / 255) < 1e-6,
                got=[(l["name"], l["kind"], l["gid"], l["blend"], round(l["opacity"], 3)) for l in L], want=want_names,
                how="names: Python's mac_roman codec (Apple's ROMAN.TXT, 0xDB = euro); structure: Adobe spec lsct 1/3")
        bx, by_, bp = lantern_layer_pixels(pg, "p16_%d" % comp, 0)
        wantb = np.dstack([np.round(v16[c].astype(float) / 257) for c in range(3)] + [np.full((H, W), 255)])
        tx0, ty0, tp = lantern_layer_pixels(pg, "p16_%d" % comp, 1)
        wantt = np.dstack([np.round(t16[c].astype(float) / 257) for c in range(3)] + [np.round(ta16.astype(float) / 257)])
        ok_t = tp.shape[:2] == (th, tw) and (tx0, ty0) == (3, 1)
        dt = maxdiff(tp[..., 3], wantt[..., 3]) if ok_t else 999
        dtc = maxdiff(tp[..., :3], wantt[..., :3], tp[..., 3] == 255) if ok_t else 999
        B.check(SEC, "16-bit Lr16 (compression %d): every value brought to 8 bits as round(v / 257)" % comp, maxdiff(bp, wantb) == 0 and ok_t and dt == 0 and dtc == 0,
                got="back diff %d, top place %s size %s, alpha diff %s, colour diff %s" % (maxdiff(bp, wantb), (tx0, ty0), tp.shape[:2], dt, dtc), want="exact",
                how="16-bit 0..65535 to 8-bit 0..255 is v*255/65535 = v/257, rounded (psd-tools reads v/65535)")
        results16[comp] = (bp, tp)
    if len(results16) == 3:
        same = all(np.array_equal(results16[0][0], results16[c][0]) and np.array_equal(results16[0][1][..., 3], results16[c][1][..., 3]) for c in (2, 3))
        B.check(SEC, "16-bit: raw, ZIP and ZIP-with-prediction channels give the same pixels", same, got=same, want=True)

    # ------------------------------------------------ 32-bit, layers in Lr32, compressions 0 / 3
    f32 = [np.clip(((x * 0.113 + y * 0.071 + c * 0.29) % 1.0), 0, 1).astype(np.float32) for c in range(3)]
    f32[0][0, 0] = -0.25; f32[0][0, 1] = 1.75; f32[1][0, 0] = 0.5; f32[2][0, 0] = 0.21404114   # out of range, mid grey, linear of sRGB 128
    a32 = np.ones((H, W), np.float32); a32[1, 1] = 0.5; a32[2, 2] = 0.0
    r32 = {}
    for comp in (0, 2, 3):
        layers = [dict(name_bytes=b"HDR", rect=(0, 0, H, W), chans={-1: a32, 0: f32[0], 1: f32[1], 2: f32[2]}, comp=comp, luni="HDR")]
        data = psd_by_hand(W, H, layers, depth=32, comp=comp, lr_block=b"Lr32", merged={0: f32[0], 1: f32[1], 2: f32[2]})
        with open(os.path.join(INP, "lr32_c%d.psd" % comp), "wb") as f:
            f.write(data)
        ps = PSDImage.open(io.BytesIO(data))
        arr = list(ps.descendants())[0].numpy()
        sane = np.allclose(arr[..., 0], f32[0], atol=1e-6) and np.allclose(arr[..., 2], f32[2], atol=1e-6)
        B.check(SEC, "(input check) psd-tools reads the hand-made 32-bit Lr32 file (compression %d) to the same floats" % comp, sane, got=float(np.abs(arr[..., 0] - f32[0]).max()), want=0,
                how="psd-tools' decoder of Photoshop's 32-bit ZIP prediction (byte planes, then differences along the row)")
        info = pg.open_err(data, "lr32.psd", "p32_%d" % comp)
        if "error" in info:
            B.check(SEC, "32-bit Lr32 file (compression %d) opens" % comp, False, got=info["error"], want="opens"); continue
        r32[comp] = lantern_layer_pixels(pg, "p32_%d" % comp, 0)
        B.check(SEC, "32-bit Lr32 (compression %d) opens with its layer" % comp, [l["name"] for l in info["layers"]] == ["HDR"] and r32[comp][2].shape[:2] == (H, W),
                got=[l["name"] for l in info["layers"]], want=["HDR"])
    if 0 in r32 and 3 in r32:
        B.check(SEC, "32-bit: ZIP-with-prediction channels decode to the same pixels as raw ones", np.array_equal(r32[0][2], r32[3][2]) and np.array_equal(r32[0][2], r32[2][2]),
                got=maxdiff(r32[0][2], r32[3][2]), want=0, how="the same floats stored three ways (psd-tools reads all three alike)")
        p = r32[0][2]
        srgb = lambda v: int(round((12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055) * 255))
        lin = lambda v: int(round(v * 255))
        B.info(SEC, "32-bit to 8-bit mapping", "float 0.5 -> %d, 0.21404 -> %d (sRGB encoding gives %d and %d; a straight x255 gives %d and %d); -0.25 -> %d; 1.75 -> %d; alpha 0.5 -> %d" %
               (p[0, 0, 1], p[0, 0, 2], srgb(0.5), srgb(0.21404114), lin(0.5), lin(0.21404114), p[0, 0, 0], p[0, 1, 0], p[1, 1, 3]))
        B.check(SEC, "32-bit alpha is taken as it stands (0.5 -> 128), not through the colour curve", p[1, 1, 3] in (127, 128) and p[2, 2, 3] == 0, got=(int(p[1, 1, 3]), int(p[2, 2, 3])), want="(128, 0)",
                how="alpha is coverage, never gamma-encoded (Photoshop keeps 32-bit transparency linear; Porter-Duff)", sure="sure")
        pg._p32 = (int(p[0, 0, 1]), int(p[0, 0, 2]))

    # a 32-bit layer with a layer mask of 0.5 (masks are kept at the document's depth)
    mk = np.full((H, W), 0.5, np.float32); mk[0, 0] = 1.0; mk[0, 1] = 0.0
    layers = [dict(name_bytes=b"Masked", rect=(0, 0, H, W), chans={-1: np.ones((H, W), np.float32), 0: f32[0], 1: f32[1], 2: f32[2], -2: mk}, comp=0, luni="Masked",
                   mask=(0, 0, H, W, 0, 0))]
    data = psd_by_hand(W, H, layers, depth=32, comp=0, lr_block=b"Lr32", merged={0: f32[0], 1: f32[1], 2: f32[2]})
    ps = PSDImage.open(io.BytesIO(data))
    pm = list(ps)[0].mask
    sane = pm is not None and abs(float(np.asarray(pm.topil())[2, 2]) / 255 - 0.5) < 0.01 if pm is not None else False
    info = pg.open_err(data, "m32.psd", "pm32")
    if "error" not in info:
        mv = pg.ev("(() => { const d = RV.docs.pm32; const m = Lantern.photo.doc.maskData(d, d.layers[0]); return m ? [m[2 * d.w + 2], m[0], m[1]] : null; })()")
        B.check(SEC, "a 32-bit layer mask of 0.5 opens as half (128), 1 as 255, 0 as 0", mv is not None and abs(mv[0] - 128) <= 1 and mv[1] == 255 and mv[2] == 0, got=mv, want=[128, 255, 0],
                how="a mask is coverage, never gamma-encoded; psd-tools reads this file's mask as %s" % ("half" if sane else "something else"))

    # ------------------------------------------------ the flattened picture of a see-through document (no layers)
    W2, H2 = 12, 6
    yy, xx = np.mgrid[0:H2, 0:W2]
    col = np.dstack([(xx * 21) % 256, (yy * 47 + 30) % 256, (xx * yy * 13 + 200) % 256]).astype(np.float64)
    alpha = np.array([[0, 1, 2, 10, 64, 127, 128, 200, 254, 255, 33, 99]] * H2, np.float64)
    alpha[3] = 255
    matted = np.round(col * alpha[..., None] / 255 + 255 * (1 - alpha[..., None] / 255)).astype(np.uint8)
    merged = {0: matted[..., 0], 1: matted[..., 1], 2: matted[..., 2], 3: alpha.astype(np.uint8)}
    hdr = b"8BPS" + struct.pack(">H", 1) + b"\0" * 6 + struct.pack(">HIIHH", 4, H2, W2, 8, 3)
    data = hdr + struct.pack(">I", 0) + struct.pack(">I", 0) + struct.pack(">I", 0) + struct.pack(">H", 0) + b"".join(merged[c].tobytes() for c in range(4))
    with open(os.path.join(INP, "merged_alpha.psd"), "wb") as f:
        f.write(data)
    info = pg.open_err(data, "merged.psd", "pm")
    if "error" in info:
        B.check(SEC, "a layerless see-through .psd opens", False, got=info["error"], want="opens")
    else:
        fl = pg.flat("pm")
        want = np.dstack([col, alpha]).astype(np.uint8)
        d = premul_diff(fl, want)
        B.check(SEC, "a layerless see-through .psd: the colour laid over white is taken off again (colour x alpha within 1.5, alpha exact)", d <= 1.5 and maxdiff(fl[..., 3], want[..., 3]) == 0,
                got="diff %.2f; alpha 128 pixel Lantern %s, true %s" % (d, list(fl[0, 6]), list(want[0, 6])), want="the colours before matting",
                how="Adobe's spec / Photoshop store a see-through document's merged image composited over white; un-matte c = (m - 255(1-a))/a")
        try:
            pt = psd_merged(data)
            B.check(SEC, "...and the same as psd-tools reads that file", premul_diff(fl, pt) <= 1.5, got="diff %.2f" % premul_diff(fl, pt), want="<= 1.5", how="psd-tools removes the white background too")
        except Exception as e:
            B.info(SEC, "psd-tools on the layerless see-through file", repr(e))

    # a flattened file (no layers) with a saved selection: the extra channel is an alpha channel named in resources 1006
    # and 1053, as Photoshop writes a Background with "Alpha 1"; it is not transparency
    plain = np.dstack([col, np.full((H2, W2), 255)]).astype(np.uint8)
    selch = ((xx * 23) % 256).astype(np.uint8)
    def res(rid, payload):
        if len(payload) % 2:
            payload += b"\0"
        return b"8BIM" + struct.pack(">H", rid) + b"\0\0" + struct.pack(">I", len(payload)) + payload
    resources = res(1006, b"\x07Alpha 1") + res(1053, struct.pack(">I", 7))
    hdr = b"8BPS" + struct.pack(">H", 1) + b"\0" * 6 + struct.pack(">HIIHH", 4, H2, W2, 8, 3)
    data = hdr + struct.pack(">I", 0) + struct.pack(">I", len(resources)) + resources + struct.pack(">I", 0) + struct.pack(">H", 0) + b"".join(p_.tobytes() for p_ in (plain[..., 0], plain[..., 1], plain[..., 2], selch))
    with open(os.path.join(INP, "flat_with_alpha_channel.psd"), "wb") as f:
        f.write(data)
    from psd_tools.api.utils import has_transparency
    ps = PSDImage.open(io.BytesIO(data))
    B.check(SEC, "(input check) psd-tools reads the flattened file with a saved selection as having no transparency", not has_transparency(ps), got=has_transparency(ps), want=False)
    info = pg.open_err(data, "flat_alpha.psd", "pfa")
    if "error" in info:
        B.check(SEC, "a flattened .psd with a saved selection channel opens", False, got=info["error"], want="opens")
    else:
        fl = pg.flat("pfa")
        B.check(SEC, "a flattened .psd with a saved selection channel ('Alpha 1') opens solid, its colours as stored", maxdiff(fl, plain) <= 0,
                got="alpha from %d to %d; colour difference %d" % (fl[..., 3].min(), fl[..., 3].max(), maxdiff(fl[..., :3], plain[..., :3])), want="alpha 255 everywhere, colours exact",
                how="Adobe spec: resource 1006 names the alpha channels, 1053 gives their ids; a document with a Background has no transparency, its extra channels are saved selections (psd-tools reads it so)",
                sure="high")

    # the same at 16 and 32 bits (layerless files: only the flattened picture, laid over white, with its alpha)
    for depth in (16, 32):
        a = alpha / 255.0
        if depth == 16:
            planes = [np.round((col[..., c] / 255 * a + (1 - a)) * 65535).astype(np.uint16) for c in range(3)] + [np.round(a * 65535).astype(np.uint16)]
            raw = b"".join(p_.astype(">u2").tobytes() for p_ in planes)
        else:
            planes = [(col[..., c] / 255 * a + (1 - a)).astype(np.float32) for c in range(3)] + [a.astype(np.float32)]
            raw = b"".join(p_.astype(">f4").tobytes() for p_ in planes)
        hdr = b"8BPS" + struct.pack(">H", 1) + b"\0" * 6 + struct.pack(">HIIHH", 4, H2, W2, depth, 3)
        data = hdr + struct.pack(">I", 0) * 3 + struct.pack(">H", 0) + raw
        info = pg.open_err(data, "merged%d.psd" % depth, "pm%d" % depth)
        if "error" in info:
            B.check(SEC, "a layerless see-through %d-bit .psd opens" % depth, False, got=info["error"], want="opens"); continue
        fl = pg.flat("pm%d" % depth)
        wa = np.round(alpha).astype(int)
        B.check(SEC, "a layerless see-through %d-bit .psd: alpha read as it stands (0.5 is 128)" % depth, maxdiff(fl[..., 3], wa) <= 1,
                got="largest alpha difference %d; alpha 127/255 -> %d" % (maxdiff(fl[..., 3], wa), int(fl[0, 5, 3])), want="within 1",
                how="the alpha channel is coverage; 16-bit: v/257; 32-bit: the float x 255 (no colour curve on alpha)")
        if depth == 16:
            want = np.dstack([col, alpha]).astype(np.uint8)
            B.check(SEC, "a layerless see-through 16-bit .psd: the white taken off the colour (colour x alpha within 1.5)", premul_diff(fl, want) <= 1.5, got="diff %.2f" % premul_diff(fl, want), want="<= 1.5")

    # ------------------------------------------------ Lantern's own flattened picture of a see-through document
    rgba = np.dstack([col, alpha]).astype(np.uint8)
    pg.make("pw", W2, H2, [dict(name="Soft", rgba=rgba)])
    fl = pg.flat("pw")
    s = pg.save("pw", "psd")
    nch = struct.unpack(">H", s["bytes"][12:14])[0]
    comp, planes = parse_merged_rle(s["bytes"], W2, H2)
    if nch == 4 and len(planes) == 4:
        a = planes[3].astype(float)
        wantm = np.round(fl[..., :3].astype(float) * fl[..., 3:4] / 255 + 255 * (1 - fl[..., 3:4] / 255))
        got = np.dstack(planes[:3]).astype(float)
        B.check(SEC, "saved .psd: the flattened picture is laid over white where see-through, with its own alpha channel", maxdiff(got, wantm) <= 1 and maxdiff(a, fl[..., 3]) == 0,
                got="colour diff %d, alpha diff %d, channels %d, compression %d" % (maxdiff(got, wantm), maxdiff(a, fl[..., 3]), nch, comp), want="within 1, exact",
                how="Adobe spec, image data section; Photoshop's convention (psd-tools removes the white again)")
        pt = psd_merged(s["bytes"])
        B.check(SEC, "saved .psd: psd-tools' reading of the flattened picture is the picture", premul_diff(pt, fl) <= 1.5, got="diff %.2f" % premul_diff(pt, fl), want="<= 1.5")
    else:
        B.check(SEC, "saved .psd of a see-through picture has 4 channels", False, got=nch, want=4)

    # ------------------------------------------------ Mac Roman names, with and without luni
    allhigh = bytes(range(0x80, 0xc0)) + b"!"
    allhigh2 = bytes(range(0xc0, 0x100))
    lays = [dict(name_bytes=allhigh, rect=(0, 0, H, W), chans={0: v16[0] // 257, 1: v16[1] // 257, 2: v16[2] // 257}, comp=1),
            dict(name_bytes=allhigh2, rect=(0, 0, 2, 2), chans={-1: np.full((2, 2), 255), 0: np.zeros((2, 2)), 1: np.zeros((2, 2)), 2: np.zeros((2, 2))}, comp=1),
            dict(name_bytes=b"\x8e\x8f", rect=(0, 0, 2, 2), chans={-1: np.full((2, 2), 255), 0: np.zeros((2, 2)), 1: np.zeros((2, 2)), 2: np.zeros((2, 2))}, comp=1, luni="Unicode wins é")]
    data = psd_by_hand(W, H, lays, depth=8, comp=1)
    info = pg.open_err(data, "mac.psd", "pmac")
    if "error" in info:
        B.check(SEC, "Mac Roman names file opens", False, got=info["error"], want="opens")
    else:
        got = [l["name"] for l in info["layers"]]
        want = [allhigh.decode("mac_roman"), allhigh2.decode("mac_roman"), "Unicode wins é"]
        bad = [(i, hex(0x80 + i), got[0][i] if i < len(got[0]) else None, want[0][i]) for i in range(len(want[0])) if i >= len(got[0]) or got[0][i] != want[0][i]]
        bad2 = [(hex(0xc0 + i), got[1][i] if i < len(got[1]) else None, want[1][i]) for i in range(len(want[1])) if i >= len(got[1]) or got[1][i] != want[1][i]]
        B.check(SEC, "Mac Roman layer names (bytes 0x80-0xFF, no luni) read as Apple's table", not bad and not bad2, got=(bad[:6], bad2[:6]), want="every byte as Python's mac_roman codec",
                how="Apple's ROMAN.TXT via Python's mac_roman codec; psd-tools decodes Pascal names as macroman too")
        B.check(SEC, "a luni (Unicode) name is taken over the Pascal name", got[2] == want[2], got=got[2], want=want[2])
        pn = [l.name for l in PSDImage.open(io.BytesIO(data))]
        B.check(SEC, "(cross-check) psd-tools reads the same names", pn == got, got=pn, want=got)

    # ------------------------------------------------ Curves written with its Crv section; read back by psd-tools
    W3, H3 = 16, 8
    back = grad(W3, H3)
    cases = [("master only", {"rgb": [[0, 0], [70, 40], [180, 220], [255, 255]]}),
             ("red and blue channels and master", {"rgb": [[0, 20], [255, 235]], "r": [[0, 0], [128, 180], [255, 255]], "b": [[0, 40], [100, 90], [255, 200]]}),
             ("green only, points out of order", {"g": [[255, 255], [0, 0], [60, 120]]})]
    names = ["rgb", "r", "g", "b"]
    for nm, p in cases:
        pg.make("pc", W3, H3, [dict(name="Back", rgba=back), dict(name="Curves 1", kind="adjust", adj={"type": "curves", "p": p})])
        fl = pg.flat("pc")
        s = pg.save("pc", "psd")
        ps = PSDImage.open(io.BytesIO(s["bytes"]))
        lay = list(ps)[-1]
        ok = lay.kind == "curves"
        want_pts = {names.index(k): sorted([tuple(pt) for pt in v]) for k, v in p.items()}
        got_legacy, got_extra = None, None
        try:
            got_legacy = [[(pt[1], pt[0]) for pt in curve] for curve in lay.data.data]
            got_extra = {it.channel_id: [(pt[1], pt[0]) for pt in it.points] for it in lay.extra}
        except Exception as e:
            ok = False
        want_legacy = [want_pts[k] for k in sorted(want_pts)]
        ok = ok and got_legacy == want_legacy and got_extra == want_pts
        B.check(SEC, "Curves (%s) saved: psd-tools reads the same points in both the old section and 'Crv '" % nm, ok, got=(got_legacy, got_extra), want=(want_legacy, want_pts),
                how="psd-tools' parser of 'curv' (version 1, channel bit field, points output-input) and its 'Crv ' extra (version 4, channel id, points)")
        ref = psd_composite(s["bytes"])
        d = premul_diff(fl, ref)
        B.check(SEC, "Curves (%s): psd-tools composites Lantern's file as Lantern shows it" % nm, d <= 3, got="diff %.1f" % d, want="<= 3",
                how="psd-tools' natural cubic spline Curves on the saved file")
        blk = find_block(s["bytes"], b"curv")
        B.check(SEC, "Curves (%s): the 'curv' block's length is even and covers the Crv section" % nm, len(blk) == 1 and len(blk[0]) % 2 == 0 and b"Crv " in blk[0], got=[len(b) for b in blk], want="one block, even length")
    # a curv block by hand (Adobe spec: pad byte, version 1, 4-byte channel bits, per channel count + output/input pairs; then 'Crv ' v4)
    pts_m = [(0, 0), (50, 90), (255, 255)]; pts_g = [(0, 30), (255, 210)]
    blk = struct.pack(">BHI", 0, 1, 0b0101)
    for pts in (pts_m, pts_g):
        blk += struct.pack(">H", len(pts)) + b"".join(struct.pack(">HH", o, i) for i, o in pts)
    blk += b"Crv " + struct.pack(">HI", 4, 2)
    for cid, pts in ((0, pts_m), (2, pts_g)):
        blk += struct.pack(">HH", cid, len(pts)) + b"".join(struct.pack(">HH", o, i) for i, o in pts)
    lays = [dict(name_bytes=b"Back", rect=(0, 0, H3, W3), chans={0: back[..., 0], 1: back[..., 1], 2: back[..., 2]}, comp=1),
            dict(name_bytes=b"Curves", rect=(0, 0, 0, 0), chans={-1: np.zeros((0, 0)), 0: np.zeros((0, 0)), 1: np.zeros((0, 0)), 2: np.zeros((0, 0))}, comp=0, extra=tagged(b"curv", blk))]
    data = psd_by_hand(W3, H3, lays, depth=8, comp=1)
    info = pg.open_err(data, "curv.psd", "pcr")
    adj = info.get("layers", [{}, {}])[1].get("adj") if "error" not in info else None
    want = {"rgb": [list(p) for p in pts_m], "g": [list(p) for p in pts_g]}
    B.check(SEC, "a hand-made Curves layer (master and green) opens live with its points", adj is not None and adj.get("type") == "curves" and adj["p"] == want, got=adj, want={"type": "curves", "p": want})
    if adj:
        ref = psd_composite(data); fl = pg.flat("pcr")
        B.check(SEC, "...and looks as psd-tools composites it", premul_diff(fl, ref) <= 3, got="diff %.1f" % premul_diff(fl, ref), want="<= 3")

    # ------------------------------------------------ Selective Color both ways
    sc_rel = {"relative": True, "reds": [10, -20, 30, -5], "yellows": [0, 0, -100, 0], "neutrals": [-15, 25, 0, 40], "blacks": [0, 0, 0, 100], "whites": [100, -100, 50, -50]}
    sc_abs = {"relative": False, "greens": [50, 0, 0, 0], "cyans": [-30, 0, 70, 10], "blues": [0, 33, 0, -33], "magentas": [5, 5, 5, 5], "reds": [150, -150, 0, 0]}
    order = ["reds", "yellows", "greens", "cyans", "blues", "magentas", "whites", "neutrals", "blacks"]
    for nm, p in (("relative", sc_rel), ("absolute", sc_abs)):
        pg.make("ps", W3, H3, [dict(name="Back", rgba=back), dict(name="SC", kind="adjust", adj={"type": "selectiveColor", "p": p})])
        s = pg.save("ps", "psd")
        ps = PSDImage.open(io.BytesIO(s["bytes"]))
        lay = list(ps)[-1]
        try:
            method, dat = lay.method, [tuple(r) for r in lay.data]
        except Exception as e:
            method, dat = repr(e), None
        want_d = [(0, 0, 0, 0)] + [tuple(max(-100, min(100, v)) for v in p.get(k, [0, 0, 0, 0])) for k in order]
        B.check(SEC, "Selective Color (%s) saved: psd-tools reads method and the nine ink sets (first set unused)" % nm, method == (0 if p["relative"] else 1) and dat == want_d,
                got=(method, dat), want=(0 if p["relative"] else 1, want_d), how="Adobe spec 'selc': version 1, method (0 relative, 1 absolute), ten CMYK records, the first reserved")
        info = pg.open_err(s["bytes"], "sc.psd", "ps2")
        adj = info["layers"][1]["adj"] if "error" not in info else None
        wantp = {"relative": p["relative"]}; wantp.update({k: list(max(-100, min(100, v)) for v in p.get(k, [0, 0, 0, 0])) for k in order})
        B.check(SEC, "Selective Color (%s): Lantern's .psd opens again with the same settings" % nm, adj is not None and adj["type"] == "selectiveColor" and adj["p"] == wantp, got=adj, want=wantp)
    # a selc block by hand with the reserved first record set to junk (it must be ignored)
    recs = [(11, 22, 33, 44), (5, -5, 10, -10), (0, 0, 0, 0), (100, 100, 100, 100), (-100, -100, -100, -100), (1, 2, 3, 4), (0, 0, 0, 0), (-7, 8, -9, 10), (12, 0, 0, 0), (0, 0, 0, -12)]
    blk = struct.pack(">HH", 1, 1) + b"".join(struct.pack(">4h", *r) for r in recs)
    lays = [dict(name_bytes=b"Back", rect=(0, 0, H3, W3), chans={0: back[..., 0], 1: back[..., 1], 2: back[..., 2]}, comp=1),
            dict(name_bytes=b"Selective", rect=(0, 0, 0, 0), chans={-1: np.zeros((0, 0)), 0: np.zeros((0, 0)), 1: np.zeros((0, 0)), 2: np.zeros((0, 0))}, comp=0, extra=tagged(b"selc", blk))]
    data = psd_by_hand(W3, H3, lays, depth=8, comp=1)
    info = pg.open_err(data, "selc.psd", "psh")
    adj = info["layers"][1]["adj"] if "error" not in info else None
    wantp = {"relative": False}; wantp.update({k: list(recs[i + 1]) for i, k in enumerate(order)})
    B.check(SEC, "a hand-made Selective Color layer (absolute, first record junk) opens with its nine sets", adj is not None and adj["p"] == wantp, got=adj, want=wantp)

    # ------------------------------------------------ Hue/Saturation and legacy Brightness/Contrast blocks as psd-tools reads them
    for nm, adj, chk in [("Hue/Saturation master", {"type": "hueSat", "p": {"hue": -40, "saturation": 30, "lightness": -20}},
                          lambda l: (l.enable_colorization, tuple(l.master)) == (0, (-40, 30, -20))),
                         ("Hue/Saturation colorize", {"type": "hueSat", "p": {"colorize": True, "hue": 200, "saturation": 60, "lightness": 15}},
                          lambda l: (l.enable_colorization, tuple(l.colorization)) == (1, (200, 60, 15))),
                         ("Brightness/Contrast legacy", {"type": "brightness", "p": {"brightness": 40, "contrast": -30, "legacy": True}},
                          lambda l: (l.brightness, l.contrast, l.use_legacy) == (40, -30, True))]:
        pg.make("ph", W3, H3, [dict(name="Back", rgba=back), dict(name="Adj", kind="adjust", adj=adj)])
        s = pg.save("ph", "psd")
        lay = list(PSDImage.open(io.BytesIO(s["bytes"])))[-1]
        try:
            ok = chk(lay); got = (lay.kind, getattr(lay, "master", None), getattr(lay, "colorization", None), getattr(lay, "brightness", None), getattr(lay, "contrast", None))
        except Exception as e:
            ok = False; got = repr(e)
        B.check(SEC, "%s saved: psd-tools reads the same settings" % nm, ok, got=got, want=adj["p"])
