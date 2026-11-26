# sec_fx.py -- layer styles Satin, Pattern Overlay, Bevel & Emboss (inner bevel) and Inner Glow: each must change only
# what lies inside the layer's shape, keep its alpha (and so its soft edge) exactly, and not break at sizes 0, 1, the
# largest Photoshop offers (250), far larger, on a 1 x 1 layer, or on a layer with no pixels.
import numpy as np
from core import *
from pics import *

SEC = "fx"

RENDER_JS = r"""
([k, i, fx]) => {
  const d = RV.docs[k], l = d.layers[i];
  l.fx = fx; l.ver++;
  let cv;
  try { cv = Lantern.photo.compose.render(d, l); } catch (e) { return { err: String(e && e.message || e) }; }
  return { b64: RV.b64(RV.px(cv)), w: cv.width, h: cv.height };
}
"""


def render(pg, key, i, fx):
    r = pg.ev(RENDER_JS, [key, i, fx])
    if "err" in r:
        return r["err"]
    return np.frombuffer(unb64(r["b64"]), np.uint8).reshape(r["h"], r["w"], 4).copy()


def run(pg, B):
    W, H = 40, 30
    shape = soft_disc(W, H, 20, 15, 10, (40, 120, 200), edge=4.0)
    pg.make("fx", W, H, [dict(name="Shape", rgba=shape)])
    checker = np.zeros((4, 4, 4), np.uint8); checker[..., 3] = 255
    checker[::2, ::2, :3] = (250, 220, 0); checker[1::2, 1::2, :3] = (250, 220, 0); checker[::2, 1::2, :3] = (90, 0, 140); checker[1::2, ::2, :3] = (90, 0, 140)
    pg.ev("([b]) => { RV.docs.fx.pattern = RV.cv(4, 4, b); }", [b64(checker.tobytes())])
    plain = render(pg, "fx", 0, None)
    inside = plain[..., 3] > 0

    def dflt(kind):
        return pg.ev("(k) => Lantern.photo.fx.defaults(k)", kind)

    kinds = {"satin": "Satin", "pattern": "Pattern Overlay", "bevel": "Bevel & Emboss", "innerGlow": "Inner Glow"}
    for k, label in kinds.items():
        base = dflt(k)
        variants = [("defaults", {})]
        if k in ("satin", "bevel", "innerGlow"):
            variants += [("size 0", {"size": 0}), ("size 1", {"size": 1}), ("size 250", {"size": 250}), ("size 5000", {"size": 5000})]
        if k == "satin":
            variants += [("distance 0", {"distance": 0}), ("distance 250", {"distance": 250}), ("invert off", {"invert": False}), ("angle -180", {"angle": -180})]
        if k == "bevel":
            variants += [("depth 1", {"depth": 1}), ("depth 1000", {"depth": 1000}), ("altitude 90", {"altitude": 90}), ("altitude 0", {"altitude": 0})]
        if k == "pattern":
            variants += [("scale 1", {"scale": 1}), ("scale 1000", {"scale": 1000}), ("opacity 0.5", {"opacity": 0.5})]
        if k == "innerGlow":
            variants += [("opacity 1", {"opacity": 1})]
        for vn, extra in variants:
            e = dict(base); e.update(extra)
            out = render(pg, "fx", 0, {k: e})
            if isinstance(out, str):
                B.check(SEC, "%s (%s): draws without an error" % (label, vn), False, got=out, want="no error"); continue
            same_alpha = maxdiff(out[..., 3], plain[..., 3]) == 0
            changed = maxdiff(out[inside][:, :3], plain[inside][:, :3])
            B.check(SEC, "%s (%s): keeps the layer's alpha exactly (soft edge too); changes only inside" % (label, vn), same_alpha,
                    got="alpha difference %d; colour change inside up to %d" % (maxdiff(out[..., 3], plain[..., 3]), changed), want="alpha difference 0",
                    how="an inner style (Satin, Pattern Overlay, inner Bevel, Inner Glow) draws within the layer's own transparency (Adobe help, Layer effects and styles)")
            if vn == "defaults":
                B.check(SEC, "%s at its defaults visibly changes the shape" % label, changed >= 10, got=changed, want=">= 10 levels somewhere inside")
            if vn == "size 0" and k in ("innerGlow", "bevel"):
                e2 = dict(base); e2["size"] = 10 if k == "innerGlow" else 5
                as_def = render(pg, "fx", 0, {k: e2})
                same = not isinstance(as_def, str) and maxdiff(as_def, out) == 0
                B.check(SEC, "%s size 0: no %s drawn (the size is its reach)" % (label, "glow" if k == "innerGlow" else "bevel"), changed <= 1,
                        got="colour change inside up to %d; %s" % (changed, "exactly the picture size %d gives" % e2["size"] if same else "not the default size's picture"),
                        want="0 (as with no style)", how="Photoshop's Size is how far the effect reaches in from the edge; at 0 it reaches nowhere. The tile offers 0 in its own slider (0-250)",
                        sure="medium (Photoshop behaviour from the reviewer's memory)")

    # Pattern Overlay: the pattern repeats across the shape from the document's corner, at scale 100 one pattern pixel a pixel
    e = dflt("pattern")
    out = render(pg, "fx", 0, {"pattern": e})
    full = inside & (plain[..., 3] == 255)
    ys, xs = np.nonzero(full)
    want = checker[ys % 4, xs % 4, :3]
    B.check(SEC, "Pattern Overlay at 100%: each solid pixel of the shape is the pattern's pixel (x mod 4, y mod 4)", maxdiff(out[ys, xs, :3], want) <= 1, got=maxdiff(out[ys, xs, :3], want), want="<= 1",
            how="a pattern overlay tiles the defined pattern over the layer (Adobe help); origin at the document's top left (Photoshop's 'Snap to Origin')", sure="high")
    # no pattern defined: what happens
    pg.make("fx2", W, H, [dict(name="Shape", rgba=shape)])
    out = render(pg, "fx2", 0, {"pattern": e})
    B.info(SEC, "Pattern Overlay with no pattern defined yet", "the shape is left as it was (colour change %d); nothing tells the person why" % maxdiff(out, plain) if not isinstance(out, str) else out)

    # a 1 x 1 layer, an empty layer, a thin document
    for nm, w, h, px in (("a 1 x 1 document, one solid pixel", 1, 1, np.array([[[200, 30, 30, 255]]], np.uint8)),
                         ("a layer with no pixels", 20, 10, np.zeros((10, 20, 4), np.uint8)),
                         ("a 300 x 1 document, a half see-through line", 300, 1, np.dstack([np.full((1, 300), 9), np.full((1, 300), 99), np.full((1, 300), 199), np.full((1, 300), 128)]).astype(np.uint8))):
        pg.make("fe", w, h, [dict(name="L", rgba=px)])
        pg.ev("([b]) => { RV.docs.fe.pattern = RV.cv(4, 4, b); }", [b64(checker.tobytes())])
        p0 = render(pg, "fe", 0, None)
        bad = []
        for k in kinds:
            for extra in ({}, {"size": 0}, {"size": 250}):
                ee = dflt(k); ee.update(extra)
                out = render(pg, "fe", 0, {k: ee})
                if isinstance(out, str) or maxdiff(out[..., 3], p0[..., 3]) != 0:
                    bad.append((k, extra, out if isinstance(out, str) else "alpha changed"))
        allfx = {k: dflt(k) for k in kinds}
        out = render(pg, "fe", 0, allfx)
        if isinstance(out, str) or maxdiff(out[..., 3], p0[..., 3]) != 0:
            bad.append(("all four together", out if isinstance(out, str) else "alpha changed"))
        B.check(SEC, "the four styles on %s: no error, alpha kept" % nm, not bad, got=bad, want="none")

    # a style on a group: the group's picture keeps its alpha too
    lay = [dict(name="A", rgba=soft_disc(W, H, 14, 15, 8, (200, 60, 60)), gid=2), dict(name="B", rgba=soft_disc(W, H, 26, 15, 8, (60, 200, 60)), gid=2), dict(name="G", kind="group", blend="normal")]
    pg.make("fg", W, H, lay)
    g0 = render(pg, "fg", 2, None)
    bad = []
    for k in kinds:
        out = render(pg, "fg", 2, {k: dflt(k)})
        if isinstance(out, str) or maxdiff(out[..., 3], g0[..., 3]) != 0:
            bad.append((k, out if isinstance(out, str) else "alpha changed by %d" % maxdiff(out[..., 3], g0[..., 3])))
    B.check(SEC, "the four styles on a group: no error, the group's alpha kept", not bad, got=bad, want="none")
