# sec_adjust.py -- the new adjustments' arithmetic: Hue/Saturation (master, Colorize) and legacy Brightness/Contrast
# against psd-tools' compositor on the .psd Lantern saves; Shadows/Highlights, Match Color, Replace Color and Selective
# Color against the rules each must keep (neutral settings change nothing, greys stay grey where they should, far colours
# are untouched, alpha is untouched) and against Adobe's own published examples where there are some.
import io
import numpy as np
from core import *
from pics import *

SEC = "adjust"


def hsl_hue(c):
    c = c.astype(float) / 255
    mx = c.max(-1); mn = c.min(-1); d = mx - mn
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-9
    hr = ((g - b) / np.where(m, d, 1)) % 6; hg = (b - r) / np.where(m, d, 1) + 2; hb = (r - g) / np.where(m, d, 1) + 4
    h = np.where(mx == r, hr, np.where(mx == g, hg, hb)) * 60
    return np.where(m, h, np.nan)


def run(pg, B):
    grid = colours_grid()                       # 512 colours, 32 x 16, opaque
    gh, gw = grid.shape[:2]
    soft = grid.copy(); soft[..., 3] = (np.arange(gh * gw).reshape(gh, gw) * 37) % 256   # the same with many alphas

    # ---------------- Hue/Saturation and legacy Brightness/Contrast against psd-tools
    hs_cases = [("hue +60", {"hue": 60}), ("hue -150", {"hue": -150}), ("hue +180", {"hue": 180}), ("saturation +50", {"saturation": 50}),
                ("saturation -60", {"saturation": -60}), ("saturation +100", {"saturation": 100}), ("saturation -100", {"saturation": -100}),
                ("lightness +40", {"lightness": 40}), ("lightness -70", {"lightness": -70}), ("lightness +100", {"lightness": 100}), ("lightness -100", {"lightness": -100}),
                ("hue 30, saturation 20, lightness -10", {"hue": 30, "saturation": 20, "lightness": -10}),
                ("hue -90, saturation -40, lightness 60", {"hue": -90, "saturation": -40, "lightness": 60}),
                ("Colorize 200/60/15", {"colorize": True, "hue": 200, "saturation": 60, "lightness": 15}),
                ("Colorize 0/25/0 (Photoshop's default when ticked)", {"colorize": True, "hue": 0, "saturation": 25, "lightness": 0}),
                ("Colorize 120/100/-50", {"colorize": True, "hue": 120, "saturation": 100, "lightness": -50}),
                ("Colorize 300/40/80", {"colorize": True, "hue": 300, "saturation": 40, "lightness": 80})]
    worst = []
    for nm, p in hs_cases:
        pg.make("hs", gw, gh, [dict(name="Back", rgba=grid), dict(name="HS", kind="adjust", adj={"type": "hueSat", "p": p})])
        fl = pg.flat("hs"); s = pg.save("hs", "psd"); ref = psd_composite(s["bytes"])
        d = maxdiff(fl, ref)
        i = np.unravel_index(np.argmax(np.abs(fl.astype(int) - ref.astype(int)).max(-1)), fl.shape[:2])
        B.check(SEC, "Hue/Saturation %s: as psd-tools composites it" % nm, d <= 3, got="largest difference %d; colour %s -> Lantern %s, psd-tools %s" % (d, grid[i][:3].tolist(), fl[i][:3].tolist(), ref[i][:3].tolist()),
                want="within 3 levels", how="psd-tools 1.27 apply_huesaturation (master lightness first, HSL hue and saturation, fitted to Photoshop's renders)", sure="high")
    # colour ranges: Lantern's own weighting (it says so); psd-tools has a model fitted to Photoshop's renders. Recorded only.
    rng_notes = []
    for nm, p in (("reds hue +30 saturation +40", {"reds": {"hue": 30, "saturation": 40, "lightness": 0}}), ("blues lightness -50", {"blues": {"hue": 0, "saturation": 0, "lightness": -50}}),
                  ("greens saturation -100", {"greens": {"hue": 0, "saturation": -100, "lightness": 0}})):
        pg.make("hs", gw, gh, [dict(name="Back", rgba=grid), dict(name="HS", kind="adjust", adj={"type": "hueSat", "p": p})])
        fl = pg.flat("hs"); ref = psd_composite(pg.save("hs", "psd")["bytes"])
        dd = np.abs(fl.astype(int) - ref.astype(int)).max(-1)
        rng_notes.append("%s: largest %d, mean %.1f" % (nm, dd.max(), dd.mean()))
    B.info(SEC, "Hue/Saturation colour ranges against psd-tools' fitted model (not judged)", "; ".join(rng_notes))
    # a colour range's Lightness on colours that are almost grey (a faint tint of that range's hue)
    near = np.array([[[250, 250, 255, 255], [200, 200, 205, 255], [128, 128, 131, 255], [60, 60, 62, 255], [255, 250, 250, 255], [180, 178, 178, 255]]], np.uint8)
    for nm, p in (("blues lightness -50", {"blues": {"hue": 0, "saturation": 0, "lightness": -50}}), ("reds lightness +60", {"reds": {"hue": 0, "saturation": 0, "lightness": 60}})):
        out = pg.pure("adjust.hueSat", near, p)
        pg.make("hn", near.shape[1], 1, [dict(name="Back", rgba=near), dict(name="HS", kind="adjust", adj={"type": "hueSat", "p": p})])
        ref = psd_composite(pg.save("hn", "psd")["bytes"])
        d = np.abs(out[..., :3].astype(int) - near[..., :3]).max(-1)[0]
        B.check(SEC, "Hue/Saturation %s barely touches near-greys (a faint tint of that hue)" % nm, d.max() <= 12,
                got="change per pixel %s; Lantern %s; psd-tools %s" % (d.tolist(), out[0, :, :3].tolist(), ref[0, :, :3].tolist()), want="a few levels at most (psd-tools: %s)" % np.abs(ref[..., :3].astype(int) - near[..., :3]).max(-1)[0].tolist(),
                how="a colour range acts on colours of that hue, as much as they have of it: psd-tools scales a range's Lightness by the pixel's saturation (its model fitted to Photoshop's renders); greys stay grey", sure="high")
    # rules
    out = pg.pure("adjust.hueSat", soft, {})
    B.check(SEC, "Hue/Saturation with every setting 0 changes nothing", maxdiff(out, soft) == 0, got=maxdiff(out, soft), want=0)
    out = pg.pure("adjust.hueSat", soft, {"saturation": -100})
    hl = np.round((grid[..., :3].max(-1).astype(float) + grid[..., :3].min(-1)) / 2)
    ok = maxdiff(out[..., 0], out[..., 1]) == 0 and maxdiff(out[..., 1], out[..., 2]) == 0 and maxdiff(out[..., 0], hl) <= 1 and maxdiff(out[..., 3], soft[..., 3]) == 0
    B.check(SEC, "Hue/Saturation saturation -100: every pixel grey at its HSL lightness, alpha kept", ok, got=(maxdiff(out[..., 0], hl), maxdiff(out[..., 3], soft[..., 3])), want="(<=1, 0)",
            how="Photoshop's Hue/Saturation at -100 gives the HSL lightness grey (as Image > Adjustments > Desaturate)", sure="high")
    for L_, v in ((100, 255), (-100, 0)):
        out = pg.pure("adjust.hueSat", soft, {"lightness": L_})
        B.check(SEC, "Hue/Saturation lightness %+d makes everything %s, alpha kept" % (L_, "white" if v else "black"), (out[..., :3] == v).all() and maxdiff(out[..., 3], soft[..., 3]) == 0,
                got=(int(out[..., :3].min()), int(out[..., :3].max())), want=v)
    out = pg.pure("adjust.hueSat", soft, {"hue": 77, "saturation": 33})
    greys = (grid[..., 0] == grid[..., 1]) & (grid[..., 1] == grid[..., 2])
    B.check(SEC, "Hue/Saturation hue and saturation leave greys grey", maxdiff(out[greys][:, :3], grid[greys][:, :3]) == 0, got=maxdiff(out[greys][:, :3], grid[greys][:, :3]), want=0)

    bc_cases = [(40, -30), (-50, 60), (100, 0), (-100, -50), (0, -100), (25, 99), (-150, 20), (150, 50)]
    for br, co in bc_cases:
        pg.make("bc", gw, gh, [dict(name="Back", rgba=grid), dict(name="BC", kind="adjust", adj={"type": "brightness", "p": {"brightness": br, "contrast": co, "legacy": True}})])
        fl = pg.flat("bc"); s = pg.save("bc", "psd"); ref = psd_composite(s["bytes"])
        d = maxdiff(fl, ref)
        B.check(SEC, "legacy Brightness/Contrast %+d/%+d: as psd-tools composites it" % (br, co), d <= 1, got="largest difference %d" % d, want="within 1",
                how="psd-tools _legacy_brightnesscontrast_lut (a line through 127: brightness shifts, contrast steepens after the shift or flattens before it)", sure="high")
    # contrast 100: a threshold; the one grey on the pivot
    ramp = np.zeros((1, 256, 4), np.uint8); ramp[0, :, 0] = ramp[0, :, 1] = ramp[0, :, 2] = np.arange(256); ramp[..., 3] = 255
    out = pg.pure("adjust.brightness", ramp, {"brightness": 0, "contrast": 100, "legacy": True})
    B.info(SEC, "legacy contrast 100 at the pivot", "input 126 -> %d, 127 -> %d, 128 -> %d (psd-tools gives 0, 127, 255: its line through 127 at an infinite slope)" % (out[0, 126, 0], out[0, 127, 0], out[0, 128, 0]))

    # ---------------- Shadows/Highlights
    W, H = 48, 24
    y, x = np.mgrid[0:H, 0:W]
    var = np.dstack([(x * 7) % 31, (y * 5) % 29, (x * 3 + y * 2) % 27])
    photo = np.dstack([np.where(x[..., None] < 24, 18 + var, 185 + var), np.full((H, W, 1), 255)]).astype(np.uint8)   # a dark left half (a face in shadow), a light right half
    photo_a = photo.copy(); photo_a[..., 3] = (x * 7 + y * 3) % 256
    out = pg.pure("adjust.shadowsHighlights", photo_a, {"shadows": 0, "highlights": 0})
    B.check(SEC, "Shadows/Highlights at 0 and 0 changes nothing", maxdiff(out, photo_a) == 0, got=maxdiff(out, photo_a), want=0)
    out = pg.pure("adjust.shadowsHighlights", photo_a, {"shadows": 50, "highlights": 50, "radius": 8})
    B.check(SEC, "Shadows/Highlights leaves alpha as it was", maxdiff(out[..., 3], photo_a[..., 3]) == 0, got=maxdiff(out[..., 3], photo_a[..., 3]), want=0)
    greyp = np.dstack([np.repeat(photo[..., :1], 3, 2), photo[..., 3:]])
    out = pg.pure("adjust.shadowsHighlights", greyp, {"shadows": 80, "highlights": 60, "radius": 6})
    B.check(SEC, "Shadows/Highlights keeps greys grey", maxdiff(out[..., 0], out[..., 1]) == 0 and maxdiff(out[..., 1], out[..., 2]) == 0, got=maxdiff(out[..., 0], out[..., 2]), want=0)
    out = pg.pure("adjust.shadowsHighlights", photo, {"shadows": 60, "highlights": 0, "radius": 6})
    dark_before = photo[:, :16, :3].astype(float).mean(); dark_after = out[:, :16, :3].astype(float).mean()
    B.check(SEC, "Shadows/Highlights: shadows 60 lifts the dark half and leaves the light half", dark_after > dark_before + 5 and maxdiff(out[:, 32:, :3], photo[:, 32:, :3]) <= 1,
            got="dark mean %.1f -> %.1f; light half changed by %d" % (dark_before, dark_after, maxdiff(out[:, 32:, :3], photo[:, 32:, :3])), want="lighter dark half, light half unchanged")
    out = pg.pure("adjust.shadowsHighlights", photo, {"shadows": 0, "highlights": 60, "radius": 6})
    lb = photo[:, 32:, :3].astype(float).mean(); la = out[:, 32:, :3].astype(float).mean()
    B.check(SEC, "Shadows/Highlights: highlights 60 darkens the light half and leaves the dark half", la < lb - 5 and maxdiff(out[:, :16, :3], photo[:, :16, :3]) <= 1,
            got="light mean %.1f -> %.1f; dark half changed by %d" % (lb, la, maxdiff(out[:, :16, :3], photo[:, :16, :3])), want="darker light half, dark half unchanged")
    h0 = hsl_hue(photo[..., :3]); h1 = hsl_hue(out[..., :3])
    unclipped = (out[..., :3].max(-1) < 250) & (photo[..., :3].max(-1) - photo[..., :3].min(-1) >= 20)
    dh = np.abs(((h1 - h0 + 180) % 360) - 180)[unclipped]
    B.check(SEC, "Shadows/Highlights keeps each colour's hue (where nothing clips)", np.nanmax(dh) <= 4, got="largest hue change %.1f degrees" % np.nanmax(dh), want="<= 4 (rounding of small values)")
    one = pg.pure("adjust.shadowsHighlights", np.array([[[10, 20, 30, 255]]], np.uint8), {"shadows": 50})
    B.check(SEC, "Shadows/Highlights on a 1 x 1 picture works", one.shape == (1, 1, 4), got=one.tolist(), want="a pixel")

    # ---------------- Match Color
    src = np.dstack([(x * 3 + 90) % 256, (y * 5 + 60) % 256, ((x + y) * 2 + 40) % 256, np.full((H, W), 255)]).astype(np.uint8)
    tgt = np.dstack([(x * 2 + 60) % 200 + 30, (y * 3 + 80) % 150 + 50, (x * 4 + y) % 120 + 70, (x * 11 + y * 5) % 256]).astype(np.uint8)
    tgt_op = tgt.copy(); tgt_op[..., 3] = 255
    out = pg.pure("adjust.matchColor", tgt, {})
    B.check(SEC, "Match Color with no source and the defaults leaves the picture (within 1, the Lab round trip)", maxdiff(out[..., :3], tgt[..., :3]) <= 1 and maxdiff(out[..., 3], tgt[..., 3]) == 0,
            got=(maxdiff(out[..., :3], tgt[..., :3]), maxdiff(out[..., 3], tgt[..., 3])), want="(<=1, 0)")
    st = pg.ev("([w, h, b]) => Lantern.photo.adjust.stats(RV.id(w, h, b))", [W, H, b64(src.tobytes())])
    out = pg.pure("adjust.matchColor", tgt_op, {"source": st, "fade": 100})
    B.check(SEC, "Match Color with Fade 100 changes nothing", maxdiff(out, tgt_op) == 0, got=maxdiff(out, tgt_op), want=0)
    out = pg.pure("adjust.matchColor", tgt_op, {"source": st})
    ls = srgb_to_lab(src[..., :3]).reshape(-1, 3); lo = srgb_to_lab(out[..., :3]).reshape(-1, 3)
    dm = np.abs(ls.mean(0) - lo.mean(0)); rs = lo.std(0) / ls.std(0)
    B.check(SEC, "Match Color to a source: the result's Lab mean and spread are the source's (Reinhard's transfer)", (dm < 2.5).all() and (np.abs(rs - 1) < 0.12).all(),
            got="mean differences L,a,b %s; spread ratios %s" % (np.round(dm, 2).tolist(), np.round(rs, 3).tolist()), want="means within 2.5, spreads within 12%",
            how="Reinhard et al. 2001 colour transfer (what the tile says it does); Lab by the CIE formulas in numpy", sure="high")
    cast = np.dstack([np.clip(tgt_op[..., 0].astype(int) + 25, 0, 255), tgt_op[..., 1], np.clip(tgt_op[..., 2].astype(int) - 20, 0, 255), tgt_op[..., 3]]).astype(np.uint8)
    out = pg.pure("adjust.matchColor", cast, {"neutralize": True})
    lab = srgb_to_lab(out[..., :3]).reshape(-1, 3)
    B.check(SEC, "Match Color Neutralize takes a colour cast away (mean a and b near 0)", abs(lab[:, 1].mean()) < 1.5 and abs(lab[:, 2].mean()) < 1.5,
            got="mean a %.2f, b %.2f (before %.2f, %.2f)" % (lab[:, 1].mean(), lab[:, 2].mean(), srgb_to_lab(cast[..., :3]).reshape(-1, 3)[:, 1].mean(), srgb_to_lab(cast[..., :3]).reshape(-1, 3)[:, 2].mean()), want="|mean a|, |mean b| < 1.5")
    out = pg.pure("adjust.matchColor", tgt, {"source": st, "luminance": 150, "intensity": 50})
    B.check(SEC, "Match Color leaves alpha as it was", maxdiff(out[..., 3], tgt[..., 3]) == 0, got=maxdiff(out[..., 3], tgt[..., 3]), want=0)
    clear = np.zeros((4, 4, 4), np.uint8)
    out = pg.pure("adjust.matchColor", clear, {"source": st})
    B.check(SEC, "Match Color on a picture with no solid pixels does nothing (no error)", maxdiff(out, clear) == 0, got=maxdiff(out, clear), want=0)

    # ---------------- Replace Color
    for p in ({}, {"color": [200, 40, 40], "fuzziness": 80}):
        out = pg.pure("adjust.replaceColor", soft, p)
        B.check(SEC, "Replace Color with hue, saturation and lightness 0 changes nothing (%s)" % (p or "defaults"), maxdiff(out, soft) == 0, got=maxdiff(out, soft), want=0)
    col = [200, 40, 40]; fz = 60
    out = pg.pure("adjust.replaceColor", soft, {"color": col, "fuzziness": fz, "hue": 120, "saturation": -30, "lightness": 10})
    dist = np.abs(soft[..., :3].astype(int) - np.array(col)).max(-1)
    far = dist >= fz
    B.check(SEC, "Replace Color leaves colours at or beyond the fuzziness untouched", maxdiff(out[far], soft[far]) == 0, got=maxdiff(out[far], soft[far]), want=0, sure="sure (by the tile's own reach; Photoshop's fuzziness measure is its own)")
    B.check(SEC, "Replace Color leaves alpha as it was", maxdiff(out[..., 3], soft[..., 3]) == 0, got=maxdiff(out[..., 3], soft[..., 3]), want=0)
    one = np.array([[col + [255]]], np.uint8)
    o1 = pg.pure("adjust.replaceColor", one, {"color": col, "fuzziness": fz, "hue": 120})
    hh = hsl_hue(o1[..., :3])[0, 0]
    B.check(SEC, "Replace Color hue +120 turns the chosen red to green (hue 120)", abs(hh - 120) <= 3, got="hue %.1f, colour %s" % (hh, o1[0, 0].tolist()), want="hue 120")

    # ---------------- Selective Color
    SCN = ["reds", "yellows", "greens", "cyans", "blues", "magentas", "whites", "neutrals", "blacks"]
    for rel in (True, False):
        out = pg.pure("adjust.selectiveColor", soft, {"relative": rel})
        B.check(SEC, "Selective Color with nothing set changes nothing (%s)" % ("relative" if rel else "absolute"), maxdiff(out, soft) == 0, got=maxdiff(out, soft), want=0)
    greys = np.zeros((1, 256, 4), np.uint8); greys[0, :, :3] = np.arange(256)[:, None]; greys[..., 3] = 255
    prim = np.array([[[255, 0, 0, 255], [255, 255, 0, 255], [0, 255, 0, 255], [0, 255, 255, 255], [0, 0, 255, 255], [255, 0, 255, 255]]], np.uint8)
    for rng in ["reds", "yellows", "greens", "cyans", "blues", "magentas"]:
        for rel in (True, False):
            p = {"relative": rel, rng: [-50, -40, -30, 20] if rel else [60, -40, 30, 50]}
            og = pg.pure("adjust.selectiveColor", greys, p)
            op_ = pg.pure("adjust.selectiveColor", prim, p)
            k = ["reds", "yellows", "greens", "cyans", "blues", "magentas"].index(rng)
            others = [j for j in range(6) if j != k and j not in ((k + 1) % 6, (k + 5) % 6)]   # the colour opposite and the two beside it
            far_ok = all(maxdiff(op_[0, j], prim[0, j]) == 0 for j in others)
            B.check(SEC, "Selective Color %s (%s): greys and the far primaries/secondaries untouched; the range's own colour changed" % (rng, "relative" if rel else "absolute"),
                    maxdiff(og, greys) == 0 and far_ok and maxdiff(op_[0, k], prim[0, k]) > 0,
                    got="greys changed by %d; far colours %s; own colour %s -> %s" % (maxdiff(og, greys), [op_[0, j].tolist() for j in others], prim[0, k].tolist(), op_[0, k].tolist()),
                    want="greys 0; far colours as they were; own colour changed", how="a colour range touches only colours of that hue (Photoshop's Selective Color)")
    # Adobe's documented example: "if you start with a pixel that is 50% magenta and add 10%, 5% is added ... (Relative) ... set to 60% (Absolute)"
    mid = np.array([[[128, 128, 128, 255]]], np.uint8)
    ink = 1 - 128 / 255
    for rel, want_ink in ((True, ink * 1.1), (False, ink + 0.10)):
        o = pg.pure("adjust.selectiveColor", mid, {"relative": rel, "neutrals": [0, 10, 0, 0]})
        g_ink = 1 - o[0, 0, 1] / 255
        B.check(SEC, "Selective Color neutrals magenta +10%% (%s) on mid grey: magenta %.1f%% -> %.1f%%" % ("relative" if rel else "absolute", ink * 100, want_ink * 100),
                abs(g_ink - want_ink) <= 0.01 and o[0, 0, 0] == 128 and o[0, 0, 2] == 128, got="magenta %.1f%%, pixel %s" % (g_ink * 100, o[0, 0].tolist()), want="%.1f%%, red and blue 128" % (want_ink * 100),
                how="Adobe Photoshop help, Selective Color: Relative adds 10% of 50% (55%), Absolute adds 10 points (60%); magenta read as 1 - G (no press profile)", sure="high")
    white = np.array([[[255, 255, 255, 255]]], np.uint8)
    o = pg.pure("adjust.selectiveColor", white, {"relative": True, "whites": [100, 50, 30, 60]})
    B.check(SEC, "Selective Color relative cannot change pure white", maxdiff(o, white) == 0, got=o[0, 0].tolist(), want=[255, 255, 255, 255],
            how="Adobe Photoshop help: the Relative option cannot adjust pure specular white, which contains no colour components")
    o = pg.pure("adjust.selectiveColor", white, {"relative": False, "whites": [50, 0, 0, 0]})
    B.check(SEC, "Selective Color absolute whites cyan +50 on white gives 50% cyan (red 127 or 128)", o[0, 0, 0] in (127, 128) and o[0, 0, 1] == 255 and o[0, 0, 2] == 255, got=o[0, 0].tolist(), want="[127/128, 255, 255]")
    o = pg.pure("adjust.selectiveColor", greys, {"relative": True, "neutrals": [0, 0, 0, 40], "whites": [0, 0, 0, -30], "blacks": [0, 0, 0, 25]})
    B.check(SEC, "Selective Color black (K) changes in whites, neutrals, blacks keep greys grey", maxdiff(o[..., 0], o[..., 1]) == 0 and maxdiff(o[..., 1], o[..., 2]) == 0, got=maxdiff(o[..., 0], o[..., 2]), want=0)
    o = pg.pure("adjust.selectiveColor", soft, {"relative": False, "reds": [20, 20, 20, 20], "neutrals": [-10, 30, 5, 5]})
    B.check(SEC, "Selective Color leaves alpha as it was", maxdiff(o[..., 3], soft[..., 3]) == 0, got=maxdiff(o[..., 3], soft[..., 3]), want=0)
    o = pg.pure("adjust.selectiveColor", prim, {"relative": True, "reds": [0, -100, 0, 0]})
    B.check(SEC, "Selective Color reds magenta -100% (relative) turns pure red to yellow", o[0, 0, :3].tolist() == [255, 255, 0], got=o[0, 0].tolist(), want=[255, 255, 0, 255],
            how="red = magenta + yellow inks; taking all the magenta out leaves yellow")
