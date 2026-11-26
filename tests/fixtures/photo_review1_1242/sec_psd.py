# sec_psd.py -- Photoshop files: made by psd-tools, ImageMagick and by hand from Adobe's specification; opened in
# Lantern and compared with psd-tools' own reading; saved by Lantern and read back by psd-tools and ImageMagick.
import os, io, json, subprocess, struct
import numpy as np
from PIL import Image, ImageDraw
from review_core import *

SEC = "psd"

def scene(w, h, seed=1):
    """a small 'photo': sky gradient, ground, a sun, noise -- made with PIL/numpy"""
    rng = np.random.default_rng(seed)
    y = np.linspace(0, 1, h)[:, None]; x = np.linspace(0, 1, w)[None, :]
    r = (90 + 100 * y + 20 * x); g = (150 + 60 * y + 0 * x); b = (230 - 80 * y + 0 * x)
    a = np.dstack([r + 0 * x, g + 0 * x, b + 0 * x])
    a[int(h * 0.7):, :, :] = [110, 90, 60]
    yy, xx = np.mgrid[0:h, 0:w]
    sun = (xx - w * 0.75) ** 2 + (yy - h * 0.25) ** 2 < (min(w, h) * 0.12) ** 2
    a[sun] = [250, 215, 80]
    a = a + rng.normal(0, 4, a.shape)
    return np.clip(a, 0, 255).astype(np.uint8)

def make_inputs():
    os.makedirs(INP, exist_ok=True)
    from psd_tools import PSDImage
    from psd_tools.constants import Compression, BlendMode
    W, H = 160, 120
    # 1. psd-tools: layers of every common kind
    p = os.path.join(INP, "pt_layers.psd")
    if not os.path.exists(p):
        doc = PSDImage.new("RGB", (W, H), color=(255, 255, 255))
        bg = scene(W, H)
        doc.create_pixel_layer(Image.fromarray(rgba(bg)), name="Photo")
        ov = np.zeros((50, 70, 4), np.uint8); ov[:, :] = [200, 40, 40, 255]; ov[10:40, 20:50, 3] = 128
        doc.create_pixel_layer(Image.fromarray(ov), name="Red multiply", top=30, left=20, opacity=191, blend_mode=BlendMode.MULTIPLY)
        hid = np.zeros((30, 30, 4), np.uint8); hid[:] = [0, 0, 255, 255]
        lh = doc.create_pixel_layer(Image.fromarray(hid), name="Hidden blue", top=5, left=5); lh.visible = False
        off = np.zeros((60, 80, 4), np.uint8); off[:, :] = [30, 160, 60, 255]; off[:, :, 1] = np.linspace(60, 250, 80)[None, :].astype(np.uint8)
        doc.create_pixel_layer(Image.fromarray(off), name="Off canvas", top=-20, left=-30)
        uni = np.zeros((20, 40, 4), np.uint8); uni[:] = [250, 250, 0, 200]
        doc.create_pixel_layer(Image.fromarray(uni), name="Gr\u00fc\u00dfe \u00e9t\u00e9", top=90, left=100, compression=Compression.ZIP)
        zp = np.zeros((24, 24, 4), np.uint8); zp[:, :, 0] = np.arange(24)[None, :] * 10; zp[:, :, 1] = 100; zp[:, :, 2] = np.arange(24)[:, None] * 10; zp[:, :, 3] = 255
        doc.create_pixel_layer(Image.fromarray(zp), name="Zip predicted", top=60, left=120, compression=Compression.ZIP_WITH_PREDICTION)
        scr = np.zeros((40, 40, 4), np.uint8); scr[:] = [40, 80, 200, 255]
        doc.create_pixel_layer(Image.fromarray(scr), name="Screen", top=70, left=60, blend_mode=BlendMode.SCREEN)
        mk = np.zeros((40, 60, 4), np.uint8); mk[:] = [255, 128, 0, 255]
        lm = doc.create_pixel_layer(Image.fromarray(mk), name="Masked", top=10, left=90)
        mimg = Image.new("L", (60, 40), 255); ImageDraw.Draw(mimg).ellipse([10, 5, 50, 35], fill=0)
        if lm.has_mask(): lm.remove_mask()
        lm.create_mask(mimg)
        doc.save(p)
    # 2. ImageMagick: three pictures as layers
    p = os.path.join(INP, "im_layers.psd")
    if not os.path.exists(p):
        a = os.path.join(INP, "_a.png"); b = os.path.join(INP, "_b.png")
        Image.fromarray(scene(120, 90, 3)).save(a)
        t = np.zeros((90, 120, 4), np.uint8); t[20:70, 30:90] = [200, 30, 30, 255]; t[30:60, 40:80, 3] = 100
        Image.fromarray(t).save(b)
        subprocess.run(["convert", a, a, b, p], check=True)
        os.remove(a); os.remove(b)
    # 3. by hand, from the specification
    hand_inputs()

def grad(w, h):
    x = np.tile(np.linspace(0, 255, w), (h, 1))
    y = np.tile(np.linspace(0, 255, h)[:, None], (1, w))
    return np.dstack([x, y, 255 - x, np.full((h, w), 255)]).round().astype(np.uint8)

def hand_inputs():
    W, H = 64, 48
    g = grad(W, H)
    P = lambda n: os.path.join(INP, n)
    def mk(name, fn):
        if not os.path.exists(P(name)): fn(P(name))
    # mask with default colour 255 (outside the mask's own rectangle shows), a hole drawn in it
    def f(path):
        red = np.zeros((40, 50, 4), np.uint8); red[:] = [220, 30, 30, 255]
        m = np.full((10, 12), 255, np.uint8); m[2:8, 3:9] = 0
        write_psd(path, W, H, [PLayer("Back", planes=rgb_planes(g)), PLayer("Red masked", top=4, left=6, planes=rgb_planes(red), mask={"top": 10, "left": 20, "data": m, "def": 255})])
    mk("h_mask_def255.psd", f)
    # a disabled mask (flags bit 1): the layer shows whole
    def f(path):
        red = np.zeros((40, 50, 4), np.uint8); red[:] = [220, 30, 30, 255]
        m = np.zeros((20, 20), np.uint8)
        write_psd(path, W, H, [PLayer("Back", planes=rgb_planes(g)), PLayer("Red, mask off", top=4, left=6, planes=rgb_planes(red), mask={"top": 10, "left": 20, "data": m, "def": 0, "flags": 2})])
    mk("h_mask_disabled.psd", f)
    # clipping: a stripe clipped to a disc
    def f(path):
        disc = np.zeros((H, W, 4), np.uint8); yy, xx = np.mgrid[0:H, 0:W]; disc[(xx - 32) ** 2 + (yy - 24) ** 2 < 15 ** 2] = [255, 255, 255, 255]
        stripe = np.zeros((10, W, 4), np.uint8); stripe[:] = [0, 0, 200, 255]
        write_psd(path, W, H, [PLayer("Back", planes=rgb_planes(g)), PLayer("Disc", planes=rgb_planes(disc)), PLayer("Stripe clipped", top=19, left=0, planes=rgb_planes(stripe), clip=1)])
    mk("h_clip.psd", f)
    # groups: Photoshop order (bottom first): end marker (lsct 3), the group's layers, the folder (lsct 1); a hidden group and a half-opaque one
    def f(path):
        a = np.zeros((20, 20, 4), np.uint8); a[:] = [0, 200, 0, 255]
        b = np.zeros((20, 20, 4), np.uint8); b[:] = [200, 0, 200, 255]
        c = np.zeros((20, 20, 4), np.uint8); c[:] = [250, 250, 250, 255]
        e = lambda nm, ex, hid=False, op=255, bl=b"pass": PLayer(nm, planes={}, extra=ex, hidden=hid, opacity=op, blend=bl)
        write_psd(path, W, H, [PLayer("Back", planes=rgb_planes(g)),
                               e("</Layer group>", lsct(3)), PLayer("In shown group", top=2, left=2, planes=rgb_planes(a)), e("Shown half group", lsct(1, b"pass"), op=128),
                               e("</Layer group>", lsct(3)), PLayer("In hidden group", top=25, left=40, planes=rgb_planes(b)), e("Hidden group", lsct(2, b"pass"), hid=True),
                               PLayer("Top", top=26, left=2, planes=rgb_planes(c))])
    mk("h_groups.psd", f)
    # adjustment layers over a gradient
    adjs = {"levl": adj_levl({"ib": 20, "iw": 230, "gamma": 1.6, "ob": 10, "ow": 245}, r={"ib": 0, "iw": 200}),
            "curv": adj_curv({0: [(0, 0), (64, 40), (192, 220), (255, 255)], 3: [(0, 30), (255, 200)]}),
            "hue2": adj_hue2(master=(40, 30, -10), ranges={2: (0, -50, 0)}),
            "hue2col": adj_hue2(colorize=(200, 60, 10)),
            "brit": adj_brit(30, 40), "britneg": adj_brit(-20, -40),
            "nvrt": adj_nvrt(), "post": adj_post(4), "thrs": adj_thrs(100)}
    for k, ex in adjs.items():
        def f(path, ex=ex, k=k):
            write_psd(path, W, H, [PLayer("Back", planes=rgb_planes(g)), PLayer("Adj " + k, planes={}, extra=ex)])
        mk("h_adj_%s.psd" % k, f)
    # 16-bit, layers in Lr16 as Photoshop saves them; and 16-bit with the layers in the plain section (as other programs write)
    g16 = (g[:, :, :3].astype(np.uint32) * 257).astype(np.uint16)
    a16 = np.full((H, W), 65535, np.uint16)
    sq = np.zeros((16, 16, 3), np.uint16); sq[:] = [65535, 32896, 0]
    def L16(top=0, left=0, arr=g16, alpha=None, comp=1):
        hh, ww = arr.shape[:2]; al = np.full((hh, ww), 65535, np.uint16) if alpha is None else alpha
        return PLayer("L%dx%d" % (ww, hh), top=top, left=left, planes={-1: al, 0: arr[:, :, 0], 1: arr[:, :, 1], 2: arr[:, :, 2]}, comp=comp)
    mk("h_16bit_Lr16.psd", lambda path: write_psd(path, W, H, [L16(), L16(10, 10, sq)], merged={0: g16[:, :, 0], 1: g16[:, :, 1], 2: g16[:, :, 2]}, depth=16, layers_in="Lr16"))
    mk("h_16bit_plain.psd", lambda path: write_psd(path, W, H, [L16(), L16(10, 10, sq)], merged={0: g16[:, :, 0], 1: g16[:, :, 1], 2: g16[:, :, 2]}, depth=16))
    mk("h_16bit_zippred.psd", lambda path: write_psd(path, W, H, [L16(comp=3), L16(10, 10, sq, comp=3)], merged={0: g16[:, :, 0], 1: g16[:, :, 1], 2: g16[:, :, 2]}, depth=16))
    # 32-bit float, ZIP with prediction (Photoshop's only packing for 32-bit), layers in Lr32
    c0 = g[:, :, :3] / 255.0; gf = np.where(c0 <= 0.04045, c0 / 12.92, ((c0 + 0.055) / 1.055) ** 2.4)
    def L32(comp):
        return PLayer("Float", planes={-1: np.ones((H, W), np.float32), 0: gf[:, :, 0].astype(np.float32), 1: gf[:, :, 1].astype(np.float32), 2: gf[:, :, 2].astype(np.float32)}, comp=comp)
    mk("h_32bit_zippred_Lr32.psd", lambda path: write_psd(path, W, H, [L32(3)], merged={i: gf[:, :, i].astype(np.float32) for i in range(3)}, depth=32, layers_in="Lr32", merged_comp=0))
    mk("h_32bit_zippred_plain.psd", lambda path: write_psd(path, W, H, [L32(3)], merged={i: gf[:, :, i].astype(np.float32) for i in range(3)}, depth=32, merged_comp=0))
    mk("h_32bit_raw.psd", lambda path: write_psd(path, W, H, [L32(0)], merged={i: gf[:, :, i].astype(np.float32) for i in range(3)}, depth=32, merged_comp=0))
    # grayscale with layers; CMYK with layers; Lab with layers
    gray = (0.299 * g[:, :, 0] + 0.587 * g[:, :, 1] + 0.114 * g[:, :, 2]).round().astype(np.uint8)
    mk("h_gray_layers.psd", lambda path: write_psd(path, W, H, [PLayer("Grey", planes={-1: g[:, :, 3], 0: gray}), PLayer("Dark square", top=8, left=8, planes={-1: np.full((10, 10), 255, np.uint8), 0: np.full((10, 10), 40, np.uint8)})], merged={0: gray}, mode=1))
    # CMYK: stored inverted (255 = no ink): pure cyan, magenta, yellow, black, white patches
    cm = np.full((H, W, 4), 255, np.uint8)
    cm[0:12, 0:16] = [0, 255, 255, 255]; cm[0:12, 16:32] = [255, 0, 255, 255]; cm[0:12, 32:48] = [255, 255, 0, 255]; cm[0:12, 48:64] = [255, 255, 255, 0]
    cm[12:24, :, 0] = np.linspace(255, 0, W).astype(np.uint8)[None, :]
    mk("h_cmyk_layers.psd", lambda path: write_psd(path, W, H, [PLayer("CMYK", planes={-1: np.full((H, W), 255, np.uint8), 0: cm[:, :, 0], 1: cm[:, :, 1], 2: cm[:, :, 2], 3: cm[:, :, 3]})], merged={i: cm[:, :, i] for i in range(4)}, mode=4))
    # Lab: L 0..255 = 0..100, a and b with 128 = 0
    from skimage import color as skc
    lab = skc.rgb2lab(g[:, :, :3] / 255.0)
    Lp = np.clip(lab[:, :, 0] * 255 / 100, 0, 255).round().astype(np.uint8); ap = np.clip(lab[:, :, 1] + 128, 0, 255).round().astype(np.uint8); bp = np.clip(lab[:, :, 2] + 128, 0, 255).round().astype(np.uint8)
    mk("h_lab_layers.psd", lambda path: write_psd(path, W, H, [PLayer("Lab", planes={-1: np.full((H, W), 255, np.uint8), 0: Lp, 1: ap, 2: bp})], merged={0: Lp, 1: ap, 2: bp}, mode=9))
    # indexed (no layers: Photoshop keeps none in this mode) and bitmap
    pal = np.zeros((256, 3), np.uint8); pal[:, 0] = np.arange(256); pal[:, 1] = 255 - np.arange(256); pal[:, 2] = (np.arange(256) * 7) % 256
    idx = (np.arange(W * H) % 256).reshape(H, W).astype(np.uint8)
    mk("h_indexed.psd", lambda path: write_psd(path, W, H, [], merged={0: idx}, mode=2, palette=np.concatenate([pal[:, 0], pal[:, 1], pal[:, 2]]).tobytes()))
    bits = ((np.add.outer(np.arange(H), np.arange(W)) // 4) % 2).astype(np.uint8)   # 1 = black
    mk("h_bitmap.psd", lambda path: write_psd(path, W, H, [], merged={0: bits}, depth=1, mode=0))
    # PSB with layers
    red = np.zeros((20, 30, 4), np.uint8); red[:] = [200, 30, 30, 255]
    mk("h_psb.psb", lambda path: write_psd(path, W, H, [PLayer("Back", planes=rgb_planes(g)), PLayer("Red", top=5, left=7, planes=rgb_planes(red))], merged={i: g[:, :, i] for i in range(3)}, big=True))
    # an empty layer (no pixels), and layers wholly and partly off the canvas
    mk("h_empty_offcanvas.psd", lambda path: write_psd(path, W, H, [PLayer("Back", planes=rgb_planes(g)), PLayer("Empty", planes={-1: np.zeros((0, 0)), 0: np.zeros((0, 0)), 1: np.zeros((0, 0)), 2: np.zeros((0, 0))}),
                                                                 PLayer("Far off", top=-500, left=900, planes=rgb_planes(red)), PLayer("Half off", top=-10, left=50, planes=rgb_planes(red))]))
    # raw and ZIP 8-bit channels
    mk("h_zip8.psd", lambda path: write_psd(path, W, H, [PLayer("Zip", planes=rgb_planes(g), comp=2), PLayer("ZipPred", top=3, left=3, planes=rgb_planes(red), comp=3), PLayer("Raw", top=25, left=30, planes=rgb_planes(red[:, :, [2, 1, 0, 3]]), comp=0)]))
    # a merged picture only (no layers), with see-through parts: Photoshop stores the colour composited over white
    al = np.tile(np.linspace(0, 255, W), (H, 1)).round().astype(np.uint8)
    col = np.zeros((H, W, 3), np.uint8); col[:] = [200, 40, 40]
    matted = (col * (al[:, :, None] / 255.0) + 255 * (1 - al[:, :, None] / 255.0)).round().astype(np.uint8)
    mk("h_merged_alpha.psd", lambda path: write_psd(path, W, H, [], merged={0: matted[:, :, 0], 1: matted[:, :, 1], 2: matted[:, :, 2], 3: al}, nchan=4))
    # Unicode name only in luni (the Pascal name in Latin-1 '?')
    mk("h_unicode.psd", lambda path: write_psd(path, W, H, [PLayer("????", planes=rgb_planes(g), unicode_name="日本 été \U0001F600")]))

# ------------------------------------------------------------------ the judge: psd-tools
def pt_open(path):
    from psd_tools import PSDImage
    return PSDImage.open(path)

def pt_layers(psd):
    out = []
    for l in psd.descendants():
        if l.is_group(): continue
        out.append(l)
    return out

def run(pg, B):
    from psd_tools import PSDImage
    make_inputs()
    # ---------------- psd-tools layered file
    path = os.path.join(INP, "pt_layers.psd"); data = open(path, "rb").read()
    info = pg.open(data, "pt_layers.psd", "pt")
    psd = PSDImage.open(path); pls = pt_layers(psd)
    B.check(SEC, "pt_layers.psd: layer count as psd-tools reads it", len(info["layers"]) == len(pls), len(info["layers"]), len(pls))
    B.check(SEC, "pt_layers.psd: names and order (Unicode name kept)", [l["name"] for l in info["layers"]] == [l.name for l in pls], [l["name"] for l in info["layers"]], [l.name for l in pls])
    for i, l in enumerate(pls):
        if i >= len(info["layers"]): break
        li = info["layers"][i]
        x, y, px = pg.layer("pt", i)
        ref = np.array(l.topil().convert("RGBA")) if l.width and l.height else None
        B.check(SEC, "pt_layers.psd '%s': bounds" % l.name, (x, y, px.shape[1], px.shape[0]) == (l.left, l.top, l.width, l.height), (x, y, px.shape[1], px.shape[0]), (l.left, l.top, l.width, l.height))
        if ref is not None and ref.shape == px.shape:
            # compare colour only where solid (canvas keeps premultiplied colour, so see-through colours may round)
            m = ref[:, :, 3] > 0
            d = np.abs(ref.astype(int) - px.astype(int)); d[:, :, :3][~m] = 0
            B.check(SEC, "pt_layers.psd '%s': pixels" % l.name, d.max() <= 1, "max diff %d" % d.max(), "<= 1")
        B.check(SEC, "pt_layers.psd '%s': opacity, visibility, blend" % l.name,
                abs(li["opacity"] - l.opacity / 255) < 0.003 and li["visible"] == l.visible and li["blend"].replace("-", "") in str(l.blend_mode).lower().replace("_", ""),
                (li["opacity"], li["visible"], li["blend"]), (l.opacity / 255, l.visible, str(l.blend_mode)))
        if l.has_mask():
            mm = l.mask
            B.check(SEC, "pt_layers.psd '%s': mask place" % l.name, li["mask"] and (li["mask"]["x"], li["mask"]["y"], li["mask"]["w"], li["mask"]["h"]) == (mm.left, mm.top, mm.width, mm.height), li["mask"], (mm.left, mm.top, mm.width, mm.height))
    flat = pg.flat("pt")
    ref = np.array(psd.composite(force=True).convert("RGBA"))
    d = np.abs(flat.astype(int) - ref.astype(int))
    B.check(SEC, "pt_layers.psd: flattened picture vs psd-tools' composite (max diff <= 3)", d.max() <= 3, "max %d, mean %.3f, pixels > 3: %d" % (d.max(), d.mean(), (d.max(axis=2) > 3).sum()), "<= 3")
    # ---------------- ImageMagick layered file
    path = os.path.join(INP, "im_layers.psd"); data = open(path, "rb").read()
    info = pg.open(data, "im_layers.psd", "im")
    psd = PSDImage.open(path); pls = pt_layers(psd)
    B.check(SEC, "im_layers.psd (ImageMagick): layer count", len(info["layers"]) == len(pls), len(info["layers"]), len(pls))
    flat = pg.flat("im"); ref = np.array(psd.composite(force=True).convert("RGBA"))
    B.check(SEC, "im_layers.psd: flattened vs psd-tools composite (<= 3)", maxdiff(flat, ref) <= 3, maxdiff(flat, ref), "<= 3")
    # ---------------- hand-made edge cases
    def hopen(name):
        path = os.path.join(INP, name)
        return path, pg.open(open(path, "rb").read(), name, name)
    def comp_vs_pt(name, tol=3, what="flattened vs psd-tools composite"):
        path, info = hopen(name)
        psd = PSDImage.open(path)
        flat = pg.flat(name)
        ref = np.array(psd.composite(force=True).convert("RGBA"))
        if ref.shape != flat.shape:
            return B.check(SEC, "%s: %s" % (name, what), False, flat.shape, ref.shape), info, flat, ref
        d = np.abs(flat.astype(int) - ref.astype(int))
        return B.check(SEC, "%s: %s (<= %d)" % (name, what, tol), d.max() <= tol, "max %d mean %.2f; at worst pixel %s Lantern %s psd-tools %s" % (d.max(), d.mean(), np.unravel_index(d.max(axis=2).argmax(), d.shape[:2]),
                       flat[np.unravel_index(d.max(axis=2).argmax(), d.shape[:2])].tolist(), ref[np.unravel_index(d.max(axis=2).argmax(), d.shape[:2])].tolist()), "<= %d" % tol), info, flat, ref
    ok, info, flat, ref = comp_vs_pt("h_mask_def255.psd")
    B.check(SEC, "h_mask_def255.psd: outside the mask's rectangle the layer shows (default colour 255)", tuple(flat[6, 8, :3]) == (220, 30, 30), flat[6, 8].tolist(), [220, 30, 30, 255])
    B.check(SEC, "h_mask_def255.psd: inside the mask's black hole the layer is hidden", tuple(flat[15, 26, :3]) != (220, 30, 30), flat[15, 26].tolist(), "the gradient below")
    ok, info, flat, ref = comp_vs_pt("h_mask_disabled.psd")
    ok, info, flat, ref = comp_vs_pt("h_clip.psd")
    ok, info, flat, ref = comp_vs_pt("h_groups.psd")
    B.check(SEC, "h_groups.psd: the hidden group's layer does not show", tuple(flat[30, 45, :3]) != (200, 0, 200), flat[30, 45].tolist(), "gradient")
    B.check(SEC, "h_groups.psd: 3 picture layers + Back (dividers not shown as layers)", len(info["layers"]) == 4, [l["name"] for l in info["layers"]], "Back, In shown group, In hidden group, Top")
    for k in ["levl", "curv", "hue2", "hue2col", "brit", "britneg", "nvrt", "post", "thrs"]:
        name = "h_adj_%s.psd" % k
        if k == "thrs":
            path, info = hopen(name); flat = pg.flat(name); ref = np.array(PSDImage.open(path).composite(force=True).convert("RGBA"))
            g0 = grad(64, 48).astype(float); lum = 0.299 * g0[:, :, 0] + 0.587 * g0[:, :, 1] + 0.114 * g0[:, :, 2]
            dif = np.abs(flat.astype(int) - ref.astype(int)).max(axis=2) > 0
            B.check(SEC, "h_adj_thrs.psd: threshold 100 agrees with psd-tools except within 1 level of the threshold", not (dif & (np.abs(lum - 100) > 1)).any(), "%d pixels differ, %d of them away from the threshold" % (dif.sum(), (dif & (np.abs(lum - 100) > 1)).sum()), 0)
        else:
            ok, info, flat, ref = comp_vs_pt(name, tol=4, what="adjustment layer applied, vs psd-tools' composite")
        adj = info["layers"][1]["adj"] if len(info["layers"]) > 1 else None
        B.info(SEC, name + " settings as Lantern read them", json.dumps(adj))
    # Levels and curves settings read back exactly
    _, info = hopen("h_adj_levl.psd"); a = info["layers"][1]["adj"]["p"]
    B.check(SEC, "h_adj_levl.psd: levels settings read", (a["inBlack"], a["inWhite"], a["gamma"], a["outBlack"], a["outWhite"], a["r"]["inWhite"]) == (20, 230, 1.6, 10, 245, 200), a, "20 230 1.6 10 245, red inWhite 200")
    _, info = hopen("h_adj_curv.psd"); a = info["layers"][1]["adj"]["p"]
    B.check(SEC, "h_adj_curv.psd: curve points read (composite and blue)", a.get("rgb") == [[0, 0], [64, 40], [192, 220], [255, 255]] and a.get("b") == [[0, 30], [255, 200]], a, "rgb 4 points, b 2 points")
    # 16-bit
    for name in ["h_16bit_plain.psd", "h_16bit_Lr16.psd", "h_16bit_zippred.psd"]:
        path, info = hopen(name)
        B.check(SEC, "%s: both layers open" % name, len(info["layers"]) == 2, [l["name"] for l in info["layers"]], ["L64x48", "L16x16"])
        flat = pg.flat(name)
        g = grad(64, 48)
        want = g.copy(); want[10:26, 10:26, :3] = [255, 128, 0]
        B.check(SEC, "%s: picture (16-bit brought to 8)" % name, maxdiff(flat, want) <= 1, maxdiff(flat, want), "<= 1")
    for name in ["h_32bit_raw.psd", "h_32bit_zippred_plain.psd", "h_32bit_zippred_Lr32.psd"]:
        path, info = hopen(name)
        flat = pg.flat(name); g = grad(64, 48)
        B.check(SEC, "%s: 32-bit linear float layer 'Float' opens as the 8-bit sRGB picture (<= 1)" % name, maxdiff(flat, g) <= 1 and [l["name"] for l in info["layers"]] == ["Float"], "layers %s, max diff %d" % ([l["name"] for l in info["layers"]], maxdiff(flat, g)), "['Float'], <= 1")
    # grey, CMYK, Lab
    path, info = hopen("h_gray_layers.psd"); flat = pg.flat("h_gray_layers.psd")
    g = grad(64, 48); gray = (0.299 * g[:, :, 0] + 0.587 * g[:, :, 1] + 0.114 * g[:, :, 2]).round()
    want = np.dstack([gray] * 3); want[8:18, 8:18] = 40
    B.check(SEC, "h_gray_layers.psd: grey layers", maxdiff(flat[:, :, :3], want) <= 0 and len(info["layers"]) == 2, (len(info["layers"]), maxdiff(flat[:, :, :3], want)), "2 layers, exact")
    path, info = hopen("h_cmyk_layers.psd"); flat = pg.flat("h_cmyk_layers.psd")
    B.check(SEC, "h_cmyk_layers.psd: pure cyan, magenta, yellow, black patches by the plain conversion", [flat[5, 5, :3].tolist(), flat[5, 20, :3].tolist(), flat[5, 40, :3].tolist(), flat[5, 55, :3].tolist(), flat[40, 5, :3].tolist()] == [[0, 255, 255], [255, 0, 255], [255, 255, 0], [0, 0, 0], [255, 255, 255]],
            [flat[5, 5, :3].tolist(), flat[5, 20, :3].tolist(), flat[5, 40, :3].tolist(), flat[5, 55, :3].tolist(), flat[40, 5, :3].tolist()], "C M Y K W")
    path, info = hopen("h_lab_layers.psd"); flat = pg.flat("h_lab_layers.psd")
    from skimage import color as skc
    lab = skc.rgb2lab(grad(64, 48)[:, :, :3] / 255.0)
    Lp = np.clip(lab[:, :, 0] * 255 / 100, 0, 255).round(); ap = np.clip(lab[:, :, 1] + 128, 0, 255).round(); bp = np.clip(lab[:, :, 2] + 128, 0, 255).round()
    want = np.clip(skc.lab2rgb(np.dstack([Lp * 100 / 255, ap - 128, bp - 128])) * 255, 0, 255).round()
    B.check(SEC, "h_lab_layers.psd: the stored Lab values to sRGB as scikit-image converts them (<= 1)", maxdiff(flat[:, :, :3], want) <= 1, maxdiff(flat[:, :, :3], want), "<= 1")
    path, info = hopen("h_indexed.psd"); flat = pg.flat("h_indexed.psd")
    ref = np.array(PSDImage.open(path).composite(force=True).convert("RGBA"))
    B.check(SEC, "h_indexed.psd: indexed colours through the palette", maxdiff(flat, ref) == 0, maxdiff(flat, ref), 0)
    path, info = hopen("h_bitmap.psd"); flat = pg.flat("h_bitmap.psd")
    bits = ((np.add.outer(np.arange(48), np.arange(64)) // 4) % 2)
    B.check(SEC, "h_bitmap.psd: 1-bit (1 = black)", np.array_equal(flat[:, :, 0], np.where(bits == 1, 0, 255)), "differs at %d pixels" % int((flat[:, :, 0] != np.where(bits == 1, 0, 255)).sum()), 0)
    path, info = hopen("h_psb.psb"); flat = pg.flat("h_psb.psb")
    want = grad(64, 48); want[5:25, 7:37, :3] = [200, 30, 30]
    B.check(SEC, "h_psb.psb: large-document format with layers", len(info["layers"]) == 2 and maxdiff(flat, want) == 0, (len(info["layers"]), maxdiff(flat, want)), "2 layers, exact")
    path, info = hopen("h_empty_offcanvas.psd"); flat = pg.flat("h_empty_offcanvas.psd")
    want = grad(64, 48); want[0:10, 50:64, :3] = [200, 30, 30]
    B.check(SEC, "h_empty_offcanvas.psd: empty layer and off-canvas layers open, picture right", len(info["layers"]) == 4 and maxdiff(flat, want) == 0, (len(info["layers"]), maxdiff(flat, want)), "4 layers, exact")
    B.check(SEC, "h_empty_offcanvas.psd: 'Half off' keeps its place and its off-canvas part", (info["layers"][3]["x"], info["layers"][3]["y"], info["layers"][3]["w"], info["layers"][3]["h"]) == (50, -10, 30, 20), info["layers"][3], "x 50 y -10 30 x 20")
    path, info = hopen("h_zip8.psd"); flat = pg.flat("h_zip8.psd")
    ref = np.array(PSDImage.open(path).composite(force=True).convert("RGBA"))
    B.check(SEC, "h_zip8.psd: ZIP, ZIP+prediction and raw 8-bit channels", maxdiff(flat, ref) == 0, maxdiff(flat, ref), 0)
    path, info = hopen("h_merged_alpha.psd"); flat = pg.flat("h_merged_alpha.psd")
    ref = np.array(PSDImage.open(path).topil().convert("RGBA"))
    m = ref[:, :, 3] >= 32
    d = np.abs(flat.astype(int) - ref.astype(int))[m].max()
    B.check(SEC, "h_merged_alpha.psd: a flat PSD with see-through parts (colour stored over white, as Photoshop does): colours", d <= 3,
            "max diff %d where alpha >= 32; e.g. at alpha %d Lantern %s, psd-tools %s" % (d, flat[10, 16, 3], flat[10, 16].tolist(), ref[10, 16].tolist()), "<= 3")
    path, info = hopen("h_unicode.psd")
    B.check(SEC, "h_unicode.psd: name from luni, characters beyond the BMP kept", info["layers"][0]["name"] == "日本 été \U0001F600", repr(info["layers"][0]["name"]), repr("日本 été \U0001F600"))
    # ---------------- saving: Lantern -> PSD -> psd-tools / ImageMagick / Lantern
    save_checks(pg, B)

def save_checks(pg, B):
    from psd_tools import PSDImage
    out = OUTDIR; os.makedirs(out, exist_ok=True)
    pg.open(open(os.path.join(INP, "pt_layers.psd"), "rb").read(), "pt_layers.psd", "pt2")
    lantern_info = pg.J("(k) => R.info(R.docs[k])", "pt2")
    r = pg.save("pt2", "psd")
    p = os.path.join(out, "pt_layers_lantern.psd"); open(p, "wb").write(r["bytes"])
    psd = PSDImage.open(p); pls = pt_layers(psd)
    B.check(SEC, "save psd: psd-tools reads the same number of layers", len(pls) == len(lantern_info["layers"]), len(pls), len(lantern_info["layers"]))
    B.check(SEC, "save psd: names (with Unicode) and order", [l.name for l in pls] == [l["name"] for l in lantern_info["layers"]], [l.name for l in pls], [l["name"] for l in lantern_info["layers"]])
    src = PSDImage.open(os.path.join(INP, "pt_layers.psd")); spl = pt_layers(src)
    for a, b in zip(spl, pls):
        B.check(SEC, "save psd '%s': opacity, visibility, blend mode kept" % a.name, (a.opacity, a.visible, a.blend_mode) == (b.opacity, b.visible, b.blend_mode), (b.opacity, b.visible, str(b.blend_mode)), (a.opacity, a.visible, str(a.blend_mode)))
        if a.has_mask():
            B.check(SEC, "save psd '%s': mask kept" % a.name, b.has_mask(), b.has_mask(), True)
    # bounds: the 'Off canvas' layer reaches outside the canvas in the source
    oc = [l for l in pls if l.name == "Off canvas"]
    if oc:
        B.check(SEC, "save psd: a layer partly off the canvas keeps its off-canvas pixels (source bbox (-30,-20,50,40))", oc[0].bbox == (-30, -20, 50, 40), oc[0].bbox, (-30, -20, 50, 40))
    # pixels of each layer, compared with what Lantern holds, where both have them
    flat = pg.flat("pt2")
    comp_pt = np.array(psd.composite(force=True).convert("RGBA"))
    B.check(SEC, "save psd: psd-tools composites Lantern's file to Lantern's own picture (<= 3)", maxdiff(comp_pt, flat) <= 3, maxdiff(comp_pt, flat), "<= 3")
    prev = np.array(psd.topil().convert("RGBA"))
    B.check(SEC, "save psd: the stored flattened picture (what viewers without layers show) is Lantern's picture (<= 1)", maxdiff(prev, flat) <= 1, maxdiff(prev, flat), "<= 1")
    # ImageMagick reads it
    idn = subprocess.run(["identify", p], capture_output=True, text=True)
    B.check(SEC, "save psd: ImageMagick reads the file and its layers (one line each, plus the flattened)", idn.returncode == 0 and len(idn.stdout.strip().splitlines()) == len(pls) + 1, idn.stdout.strip().splitlines()[:3] + [idn.stderr[:200]], "%d lines" % (len(pls) + 1))
    # a document with see-through parts: the stored flattened picture as psd-tools reads it
    t = np.zeros((40, 60, 4), np.uint8); t[:, :, 0] = 200; t[:, :, 1] = 40; t[:, :, 2] = 40; t[:, :, 3] = np.tile(np.linspace(0, 255, 60), (40, 1)).round().astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(t).save(buf, "PNG")
    pg.open(buf.getvalue(), "seethrough.png", "st")
    r = pg.save("st", "psd"); p2 = os.path.join(out, "seethrough_lantern.psd"); open(p2, "wb").write(r["bytes"])
    psd2 = PSDImage.open(p2)
    prev = np.array(psd2.topil().convert("RGBA")); m = t[:, :, 3] >= 64
    d = np.abs(prev.astype(int) - t.astype(int))[m].max()
    B.check(SEC, "save psd (see-through picture): psd-tools reads the stored flattened colours right (Photoshop stores them over white)", d <= 3,
            "max diff %d where alpha >= 64; at alpha %d psd-tools reads %s, the picture is %s" % (d, t[5, 15, 3], prev[5, 15].tolist(), t[5, 15].tolist()), "<= 3")
    # round trip Lantern -> PSD -> Lantern
    pg.open(r["bytes"], "seethrough_lantern.psd", "st2"); f2 = pg.flat("st2"); f1 = pg.flat("st")
    B.check(SEC, "round trip: Lantern -> PSD -> Lantern gives the same picture", maxdiff(f1, f2) <= 1, maxdiff(f1, f2), "<= 1")
    r = pg.save("pt2", "psd"); pg.open(r["bytes"], "rt.psd", "rt"); f3 = pg.flat("rt")
    B.check(SEC, "round trip pt_layers: Lantern -> PSD -> Lantern same picture", maxdiff(flat, f3) <= 1, maxdiff(flat, f3), "<= 1")
    # groups survive a save?
    pg.open(open(os.path.join(INP, "h_groups.psd"), "rb").read(), "h_groups.psd", "grp")
    r = pg.save("grp", "psd"); p3 = os.path.join(out, "groups_lantern.psd"); open(p3, "wb").write(r["bytes"])
    psd3 = PSDImage.open(p3)
    ngroups = len([l for l in psd3.descendants() if l.is_group()])
    B.check(SEC, "save psd: groups opened from a PSD are saved as groups", ngroups == 2, "%d groups in Lantern's file" % ngroups, "2 (as opened)")
    # adjustment layers written: psd-tools reads the settings and composites them as Lantern does
    for k in ["levl", "curv", "hue2", "brit", "post", "thrs", "nvrt"]:
        name = "h_adj_%s.psd" % k
        pg.open(open(os.path.join(INP, name), "rb").read(), name, "a_" + k)
        r = pg.save("a_" + k, "psd"); pa = os.path.join(out, "adj_%s_lantern.psd" % k); open(pa, "wb").write(r["bytes"])
        try:
            psda = PSDImage.open(pa); kinds = [l.kind for l in psda.descendants()]
            fl = pg.flat("a_" + k); cp = np.array(psda.composite(force=True).convert("RGBA"))
            live = any(x in ("levels", "curves", "huesaturation", "brightnesscontrast", "posterize", "threshold", "invert") for x in kinds)
            B.check(SEC, "save psd adjustment '%s': kept as a live adjustment layer psd-tools reads" % k, live, kinds, "an adjustment kind")
            if k == "thrs":
                lum = (0.299 * fl[:, :, 0] + 0.587 * fl[:, :, 0] * 0 + 0) if False else None
            tol = 255 if k == "thrs" else 4
            B.check(SEC, "save psd adjustment '%s': psd-tools composites Lantern's file as Lantern shows it (<= 4%s)" % (k, "; threshold only boundary pixels" if k == "thrs" else ""),
                    maxdiff(fl, cp) <= 4 or (k == "thrs" and (np.abs(fl.astype(int) - cp.astype(int)).max(axis=2) > 0).sum() <= 0.01 * fl.shape[0] * fl.shape[1]), maxdiff(fl, cp), "<= 4")
        except Exception as e:
            B.check(SEC, "save psd adjustment '%s': psd-tools opens it" % k, False, repr(e)[:200], "opens")
    # the levels block as psd-tools reads it
    try:
        psda = PSDImage.open(os.path.join(out, "adj_levl_lantern.psd")); lv = [l for l in psda.descendants() if l.kind == "levels"][0]
        rec = lv.master
        B.check(SEC, "save psd: Levels settings read back by psd-tools", (rec.input_floor, rec.input_ceiling, rec.output_floor, rec.output_ceiling, rec.gamma) == (20, 230, 10, 245, 160), (rec.input_floor, rec.input_ceiling, rec.output_floor, rec.output_ceiling, rec.gamma), (20, 230, 10, 245, 160))
    except Exception as e:
        B.check(SEC, "save psd: Levels settings read back by psd-tools", False, repr(e)[:200], "readable")
