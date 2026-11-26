# sec_blend.py -- blend modes. Linear Dodge (Add) below 100% and over see-through backdrops against the published rule
# (W3C Compositing and Blending Level 1, section 5.1: Cs' = (1 - ab) Cs + ab B(Cb, Cs), then source-over; B = min(1, Cb + Cs)),
# and every mode against psd-tools' compositor on the .psd Lantern saves, over pairs of channel values that include the
# extremes (0, 1, 127, 128, 254, 255) and backdrops and sources that are partly see-through.
import numpy as np
from core import *
from pics import *

SEC = "blend"
MODES = ["normal", "darken", "multiply", "color-burn", "linear-burn", "darker-color", "lighten", "screen", "color-dodge", "linear-dodge", "lighter-color",
         "overlay", "soft-light", "hard-light", "vivid-light", "linear-light", "pin-light", "hard-mix", "difference", "exclusion", "subtract", "divide",
         "hue", "saturation", "color", "luminosity"]
V = [0, 1, 37, 100, 127, 128, 155, 200, 254, 255]


def pair_pictures():
    """backdrop and source: every pair of values from V in the red channel (other pairs in green and blue), each row a
    pairing of backdrop alpha and source alpha."""
    n = len(V)
    W = n * n
    rows = [(255, 255), (191, 255), (64, 255), (255, 128), (191, 128), (64, 128), (0, 200)]
    H = len(rows)
    b = np.zeros((H, W, 4), np.uint8); s = np.zeros((H, W, 4), np.uint8)
    for x in range(W):
        i, j = divmod(x, n)
        b[:, x, 0] = V[i]; s[:, x, 0] = V[j]
        b[:, x, 1] = V[(i + 3) % n]; s[:, x, 1] = V[(j * 7 + 1) % n]
        b[:, x, 2] = V[(i * 3 + j) % n]; s[:, x, 2] = V[(j + 5) % n]
    for y, (ab, as_) in enumerate(rows):
        b[y, :, 3] = ab; s[y, :, 3] = as_
    b[b[..., 3] == 0, :3] = 0
    return b, s


def w3c(b, s, op, f):
    """W3C Compositing 1, 5.1 and 5.2: blending then source-over, straight colours in 0..1; returns RGBA 0..255 floats."""
    cb = b[..., :3] / 255.0; cs = s[..., :3] / 255.0
    ab = b[..., 3:4] / 255.0; as_ = s[..., 3:4] / 255.0 * op
    B = f(cb, cs)
    ao = as_ + ab * (1 - as_)
    co = as_ * (1 - ab) * cs + as_ * ab * B + (1 - as_) * ab * cb
    c = np.where(ao > 0, co / np.where(ao > 0, ao, 1), 0)
    return np.concatenate([c * 255, ao * 255], -1)


def run(pg, B):
    b, s = pair_pictures()
    H, W = b.shape[:2]

    # ---- Linear Dodge (Add): the published rule, at several opacities, over see-through backdrops
    for op in (1.0, 0.7, 0.5, 0.25):
        pg.make("ld", W, H, [dict(name="Back", rgba=b), dict(name="Add", rgba=s, blend="linear-dodge", opacity=op)])
        fl = pg.flat("ld")
        want = w3c(b.astype(float), s.astype(float), op, lambda cb, cs: np.minimum(1, cb + cs))
        d = premul_diff(fl, np.round(want))
        B.check(SEC, "Linear Dodge (Add) at %d%% over solid and see-through backdrops: min(1, b + s) laid on by source-over" % round(op * 100), d <= 2,
                got="largest difference %.2f" % d, want="within 2 (the canvas keeps colour premultiplied in 8 bits)", how="W3C Compositing and Blending 1, 5.1 (general formula) with B = min(1, Cb + Cs); Photoshop's Add", sure="high")
        # a see-through Add layer must not make a see-through backdrop more solid than source-over does
        al_ok = maxdiff(fl[..., 3], np.round(want[..., 3])) <= 1
        B.check(SEC, "Linear Dodge (Add) at %d%%: the result's alpha is source-over's, as + ab(1 - as)" % round(op * 100), al_ok, got=maxdiff(fl[..., 3], np.round(want[..., 3])), want="<= 1")

    # ---- every mode against psd-tools, at 100% and 70%. A pixel whose blend changes by more than 4 levels when either
    # colour moves by 2 levels is left out of this comparison (the canvas keeps a see-through pixel's colour to about that
    # precision, and Color Dodge/Burn, Vivid Light, Hard Mix, Darker/Lighter Color jump there); the extremes are checked
    # one by one below instead.
    from psd_tools.composite import blend as ptb
    from psd_tools.constants import BlendMode
    dirs = [(1, 1, 1), (-1, -1, -1), (1, -1, 0), (-1, 1, 0), (0, 1, -1), (0, -1, 1), (1, 0, -1), (-1, 0, 1)]
    for mode in MODES:
        fn = ptb.get_blend_func(getattr(BlendMode, mode.upper().replace("-", "_")), None) if hasattr(ptb, "get_blend_func") else None
        cb = b[..., :3].astype(np.float32) / 255; cs = s[..., :3].astype(np.float32) / 255
        try:
            B0 = fn(cb.copy(), cs.copy())
            ill = np.zeros(cb.shape[:2], bool)
            for dvec in dirs:
                dv = np.array(dvec, np.float32) * 2 / 255
                for which in (0, 1):
                    xb = np.clip(cb + dv, 0, 1) if which == 0 else cb
                    xs = np.clip(cs + dv, 0, 1) if which == 1 else cs
                    ill |= (np.abs(fn(xb.copy(), xs.copy()) - B0).max(-1) > 4 / 255)
        except Exception as e:
            ill = np.zeros(cb.shape[:2], bool)
        for op in (1.0, 0.7):
            pg.make("bm", W, H, [dict(name="Back", rgba=b), dict(name="Top", rgba=s, blend=mode, opacity=op)])
            fl = pg.flat("bm"); sv = pg.save("bm", "psd"); ref = psd_composite(sv["bytes"])
            pa = fl.astype(float); pb = ref.astype(float)
            err = np.maximum(np.abs(pa[..., :3] * pa[..., 3:4] - pb[..., :3] * pb[..., 3:4]).max(-1) / 255, np.abs(pa[..., 3] - pb[..., 3]))
            err[ill] = 0
            d = float(err.max())
            yx = np.unravel_index(np.argmax(err), err.shape)
            tol = 3
            B.check(SEC, "%s at %d%%: as psd-tools composites Lantern's .psd (%d of %d pixels on a knife edge left out)" % (mode, round(op * 100), int(ill.sum()), ill.size), d <= tol,
                    got="largest difference %.1f at backdrop %s, source %s: Lantern %s, psd-tools %s" % (d, b[yx].tolist(), s[yx].tolist(), fl[yx].tolist(), ref[yx].tolist()),
                    want="within %d" % tol, how="psd-tools 1.27 compositor (its modes pinned against Photoshop's renders where its comments say so)", sure="high")

    # ---- the solid row alone (both layers opaque, so every colour is exact in the canvas), with no pixel left out but
    # the three known disagreements (Vivid Light with a 0 or 255 source, Hard Mix ties, Darker/Lighter Color near-ties
    # where the two programs weigh the channels 0.299/0.587/0.114 and 0.3/0.59/0.11)
    b1 = b[:1]; s1 = s[:1]
    for mode in MODES:
        pg.make("bo", W, 1, [dict(name="Back", rgba=b1), dict(name="Top", rgba=s1, blend=mode)])
        fl = pg.flat("bo"); ref = psd_composite(pg.save("bo", "psd")["bytes"])
        keep = np.ones((1, W), bool)
        if mode == "vivid-light":
            keep &= ~((s1[..., :3] == 0) | (s1[..., :3] == 255)).any(-1)
        if mode == "hard-mix":
            keep &= ~((b1[..., :3].astype(int) + s1[..., :3]) == 255).any(-1)
        if mode in ("darker-color", "lighter-color"):
            l601 = lambda c: c[..., 0] * 0.299 + c[..., 1] * 0.587 + c[..., 2] * 0.114
            lpdf = lambda c: c[..., 0] * 0.3 + c[..., 1] * 0.59 + c[..., 2] * 0.11
            bf = b1[..., :3].astype(float); sf = s1[..., :3].astype(float)
            keep &= np.sign(l601(bf) - l601(sf)) == np.sign(lpdf(bf) - lpdf(sf))
        d = maxdiff(fl[keep], ref[keep])
        i = int(np.argmax(np.where(keep[0], np.abs(fl[0].astype(int) - ref[0].astype(int)).max(-1), -1)))
        B.check(SEC, "%s, both layers solid, every value pair: as psd-tools" % mode, d <= 2, got="largest difference %d at backdrop %s source %s: Lantern %s, psd-tools %s" % (d, b1[0, i].tolist(), s1[0, i].tolist(), fl[0, i].tolist(), ref[0, i].tolist()),
                want="within 2", how="psd-tools 1.27 blend functions on exact 8-bit values", sure="high")

    # ---- the extremes, opaque, one by one: Vivid Light with a black or white source; Hard Mix where the two add to exactly 255
    vals = [0, 1, 37, 100, 127, 128, 155, 200, 254, 255]
    bb = np.array([[[v, v, v, 255] for v in vals for _ in (0, 255)]], np.uint8)
    ss = np.array([[[t, t, t, 255] for _ in vals for t in (0, 255)]], np.uint8)
    pg.make("vx", bb.shape[1], 1, [dict(name="Back", rgba=bb), dict(name="Top", rgba=ss, blend="vivid-light")])
    fl = pg.flat("vx"); ref = psd_composite(pg.save("vx", "psd")["bytes"])
    bad = [(int(bb[0, i, 0]), int(ss[0, i, 0]), int(fl[0, i, 0]), int(ref[0, i, 0])) for i in range(bb.shape[1]) if abs(int(fl[0, i, 0]) - int(ref[0, i, 0])) > 1]
    B.check(SEC, "Vivid Light with a pure black or pure white source (opaque)", not bad, got="(backdrop, source, Lantern, psd-tools): %s" % bad, want="as psd-tools: a black source burns to black and a white one dodges to white, whatever lies under",
            how="psd-tools vivid_light, whose comment says this reading is pinned against Photoshop's own render (#189); W3C has no Vivid Light", sure="medium (psd-tools' word for Photoshop; not seen in Photoshop by this reviewer)")
    pairs = [(b_, 255 - b_) for b_ in (0, 1, 37, 100, 127, 128, 155, 200, 254, 255)]
    bb = np.array([[[p[0], p[0], p[0], 255] for p in pairs]], np.uint8); ss = np.array([[[p[1], p[1], p[1], 255] for p in pairs]], np.uint8)
    pg.make("hx", len(pairs), 1, [dict(name="Back", rgba=bb), dict(name="Top", rgba=ss, blend="hard-mix")])
    fl = pg.flat("hx"); ref = psd_composite(pg.save("hx", "psd")["bytes"])
    bad = [(p[0], p[1], int(fl[0, i, 0]), int(ref[0, i, 0])) for i, p in enumerate(pairs) if fl[0, i, 0] != ref[0, i, 0]]
    # not counted as a check: Adobe's help says a sum of 255 or more gives 255 (as Lantern does); psd-tools says Photoshop's
    # renders give 0 there unless the backdrop is above half. The two sources disagree, so this is recorded, not judged.
    B.info(SEC, "Hard Mix where backdrop + source = 255 exactly (opaque): Lantern against psd-tools",
           "(backdrop, source, Lantern, psd-tools) where they differ: %s. Adobe's help ('if the resulting sum for a channel is 255 or greater, it receives a value of 255') agrees with Lantern; psd-tools (#189) says Photoshop's renders give 0 there" % bad)

    # ---- Dissolve: each pixel all source or all backdrop, in proportion to the opacity
    n = 64
    blue = solid(n, n, (0, 0, 255, 255)); red = solid(n, n, (255, 0, 0, 255)); red_half = solid(n, n, (255, 0, 0, 128))
    for nm, top, op, back in (("red at 50% opacity over blue", red, 0.5, blue), ("half see-through red at 100% over blue", red_half, 1.0, blue),
                              ("red at 30% over nothing", red, 0.3, np.zeros((n, n, 4), np.uint8))):
        pg.make("ds", n, n, [dict(name="Back", rgba=back), dict(name="Top", rgba=top, blend="dissolve", opacity=op)])
        fl = pg.flat("ds")
        is_red = (fl == np.array([255, 0, 0, 255])).all(-1)
        is_back = (fl == back).all(-1)
        frac = is_red.mean()
        target = op * top[0, 0, 3] / 255
        B.check(SEC, "Dissolve, %s: every pixel wholly source or wholly backdrop, about %d%% source" % (nm, round(target * 100)), (is_red | is_back).all() and abs(frac - target) < 0.05,
                got="mixed pixels %d; source share %.3f" % (int((~(is_red | is_back)).sum()), frac), want="0 mixed; %.2f +- 0.05" % target,
                how="Photoshop's Dissolve: a random share of pixels, as many as the opacity, shown whole (Adobe help, Blending modes)")
