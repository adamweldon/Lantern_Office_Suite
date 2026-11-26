# sec_select.py -- Select > Modify > Expand, Contract and Border on a selection held as one byte a pixel. Judged
# against scipy's exact Euclidean distance transform (scipy.ndimage.distance_transform_edt): expanding by r whole
# pixels must take in every pixel within r of the selection and nothing beyond r + 1; contracting by r must drop every
# pixel within r of the outside and keep everything farther than r + 1; a straight edge moves exactly r pixels.
import numpy as np
from scipy import ndimage
from core import *

SEC = "select"


def lan(pg, fn, m, r):
    h, w = m.shape
    out = pg.ev("([f, w, h, b, r]) => RV.b64(Lantern.photo.sel[f](RV.u8(b), w, h, r))", [fn, w, h, b64(m.astype(np.uint8).tobytes()), r])
    return np.frombuffer(unb64(out), np.uint8).reshape(h, w).copy()


def run(pg, B):
    W, H = 60, 40
    rect = np.zeros((H, W), np.uint8); rect[12:28, 15:40] = 255
    disc = np.zeros((H, W), np.uint8); yy, xx = np.mgrid[0:H, 0:W]; disc[(xx - 30) ** 2 + (yy - 20) ** 2 <= 81] = 255
    ring = disc.copy(); ring[(xx - 30) ** 2 + (yy - 20) ** 2 <= 16] = 0
    dot = np.zeros((H, W), np.uint8); dot[20, 30] = 255
    shapes = {"rectangle": rect, "disc": disc, "ring": ring, "one pixel": dot}
    for nm, m in shapes.items():
        din = ndimage.distance_transform_edt(m < 128)       # each pixel's distance to the nearest selected one
        dout = ndimage.distance_transform_edt(m >= 128)     # each pixel's distance to the nearest unselected one
        for r in (1, 3, 10):
            o = lan(pg, "expand", m, r)
            miss = int(((din <= r) & (o < 255)).sum()); extra = int(((din > r + 1) & (o > 0)).sum())
            part = o[(o > 0) & (o < 255)]
            B.check(SEC, "Expand %s by %d: every pixel within %d taken whole, nothing beyond %d" % (nm, r, r, r + 1), miss == 0 and extra == 0,
                    got="missed %d, beyond %d, partly chosen %d" % (miss, extra, part.size), want="0, 0", how="scipy.ndimage.distance_transform_edt (exact Euclidean distance between pixel centres)")
            if nm == "rectangle":
                row = o[20]; col = o[:, 27]
                left = 15 - int(np.argmax(row > 0)); right = int(W - 1 - np.argmax(row[::-1] > 0)) - 39
                top = 12 - int(np.argmax(col > 0)); bot = int(H - 1 - np.argmax(col[::-1] > 0)) - 27
                hard = set(np.unique(row).tolist()) <= {0, 255} and set(np.unique(col).tolist()) <= {0, 255}
                B.check(SEC, "Expand a rectangle by %d: each straight edge moves out exactly %d pixels, hard" % (r, r), (left, right, top, bot) == (r, r, r, r) and hard,
                        got=(left, right, top, bot, sorted(set(row.tolist()))), want=(r, r, r, r), how="Photoshop's Expand moves the selection edge out by the number of pixels given")
            if r <= 3 or nm != "one pixel":
                o = lan(pg, "contract", m, r)
                miss = int(((dout > r + 1) & (o < 255) & (m >= 128)).sum()); extra = int(((dout <= r) & (o > 0)).sum())
                B.check(SEC, "Contract %s by %d: every pixel within %d of the outside dropped, everything farther than %d kept" % (nm, r, r, r + 1), miss == 0 and extra == 0,
                        got="kept wrongly %d, dropped wrongly %d" % (extra, miss), want="0, 0", how="scipy.ndimage.distance_transform_edt")
        if nm == "one pixel":
            o = lan(pg, "expand", m, 3)
            B.check(SEC, "Expand one pixel by 3: the 29 pixels within distance 3", int((o == 255).sum()) == 29, got=int((o == 255).sum()), want=29, how="count of integer points with x^2 + y^2 <= 9")
    o = lan(pg, "contract", rect, 3)
    row = o[20]; inner = (int(np.argmax(row > 0)), int(W - 1 - np.argmax(row[::-1] > 0)))
    B.check(SEC, "Contract a rectangle by 3: each straight edge moves in exactly 3 pixels", inner == (18, 36), got=inner, want=(18, 36))
    o = lan(pg, "contract", rect, 9)
    B.check(SEC, "Contract a 16-pixel-tall rectangle by 9: nothing is left", int(o.max()) == 0, got=int(o.max()), want=0)
    # Expand then Contract by the same amount gives back a rectangle (a closing: a convex shape keeps its straight edges)
    o = lan(pg, "contract", lan(pg, "expand", rect, 4), 4)
    B.check(SEC, "Expand 4 then Contract 4 gives the rectangle back along its straight edges", maxdiff(o[14:26, 17:38], rect[14:26, 17:38]) == 0 and maxdiff(o[20], rect[20]) <= 0,
            got=maxdiff(o[20], rect[20]), want=0)

    # Border: a band of the width given, centred on the edge (Photoshop: Select > Modify > Border)
    m = rect
    dist_edge = np.where(m >= 128, ndimage.distance_transform_edt(m >= 128) - 0.5, ndimage.distance_transform_edt(m < 128) - 0.5)
    for px in (4, 7, 10):
        o = lan(pg, "border", m, px).astype(float)
        far = dist_edge > px / 2 + 2
        inside_w = o[(m >= 128)].sum() / 255; outside_w = o[(m < 128)].sum() / 255
        core_band = dist_edge <= px / 2 - 1
        row = o[20]
        ins = int((row[15:27] >= 128).sum()); outs = int((row[0:15] >= 128).sum())
        B.check(SEC, "Border %d px on a rectangle: a band astride the edge (as much inside as outside), nothing beyond %g px" % (px, px / 2 + 2),
                int(o[far].max()) <= 3 and (o[core_band] >= 128).mean() > 0.95 and abs(ins - outs) <= 1,
                got="farthest-away value %d; band chosen %.2f; across the left edge %d inside, %d outside" % (o[far].max(), (o[core_band] >= 128).mean(), ins, outs), want="<= 3; > 0.95; equal within 1",
                how="Adobe help: Border selects a band of the given width that straddles the original selection's edge", sure="medium (the band's exact softness in Photoshop is not published)")
        straight = o[20, 0:30]
        width = (straight >= 128).sum()
        B.check(SEC, "Border %d px: across a straight edge the band is %d pixels wide (within 1)" % (px, px), abs(int(width) - px) <= 1, got=int(width), want=px, sure="medium")

    # a soft (feathered) selection, expanded: its soft edge should move out with it, not be cut into a step
    soft = np.clip((12.0 - np.sqrt((xx + 0.5 - 30) ** 2 + (yy + 0.5 - 20) ** 2)) / 6 + 0.5, 0, 1) * 255
    soft = np.round(soft).astype(np.uint8)
    o = lan(pg, "expand", soft, 3)
    prof_in = soft[20, 30:]; prof_out = o[20, 30:]
    shifted = np.round(np.clip((15.0 - np.sqrt((xx + 0.5 - 30) ** 2 + (yy + 0.5 - 20) ** 2)) / 6 + 0.5, 0, 1) * 255)[20, 30:]
    # recorded, not judged: whether Photoshop's Expand keeps a feathered edge soft is not something this reviewer can
    # confirm from a published source
    B.info(SEC, "Expand 3 on a feathered selection (soft over 6 px)", "profile from the centre out: Lantern %s; before %s; the soft edge moved out would be %s. Lantern makes the edge hard at the 50%% line + 3 px (the feather is lost)." % (prof_out[8:22].tolist(), prof_in[8:22].tolist(), shifted[8:22].astype(int).tolist()))

    # through the menu command, on a document
    pg.make("se", W, H, [dict(name="Back", rgba=np.full((H, W, 4), 255, np.uint8))])
    pg.ev("([b]) => Lantern.photo.doc.setSel(RV.docs.se, RV.u8(b))", [b64(rect.tobytes())])
    r = pg.exec("se", "modify", {"how": "expand", "px": 3})
    got = np.frombuffer(unb64(pg.ev("RV.b64(Lantern.photo.doc.selMask(RV.docs.se))")), np.uint8).reshape(H, W)
    B.check(SEC, "Select > Modify > Expand 3 through the command gives the same as the function", r["ok"] and maxdiff(got, lan(pg, "expand", rect, 3)) == 0, got=r.get("err") or maxdiff(got, lan(pg, "expand", rect, 3)), want=0)
    pg.ev("([b]) => Lantern.photo.doc.setSel(RV.docs.se, RV.u8(b))", [b64(rect.tobytes())])
    r = pg.exec("se", "modify", {"how": "contract", "px": 20})
    B.check(SEC, "Contract by more than the selection's half-height leaves no selection (and no error)", r["ok"] and pg.ev("RV.docs.se.sel === null"), got=r.get("err") or pg.ev("RV.docs.se.sel === null"), want="no selection")
