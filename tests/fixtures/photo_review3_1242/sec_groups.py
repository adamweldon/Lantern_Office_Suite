# sec_groups.py -- layer groups: the picture they make (against psd-tools' compositor on the .psd Lantern saves, and on
# .psd files psd-tools makes), the tree Lantern saves, and the group commands.
import io, random
import numpy as np
from core import *
from pics import *

SEC = "groups"
W, H = 16, 8
TOL = 4   # levels of 255, on colour weighted by alpha, and on alpha


def psd_blend_name(b):
    return b.upper().replace("-", "_")


def well_formed(layers):
    """Problems with the layer list as a tree: every member must lie in one unbroken run just under its group."""
    groups = {l["id"]: i for i, l in enumerate(layers) if l["kind"] == "group"}
    probs = []

    def anc(i):
        out = []; l = layers[i]; seen = 0
        while l["gid"] is not None and seen < 70:
            seen += 1
            if l["gid"] not in groups:
                probs.append("layer %s names a group that is not there" % l["name"]); break
            out.append(l["gid"]); l = layers[groups[l["gid"]]]
        return out
    ancs = [anc(i) for i in range(len(layers))]
    for i, l in enumerate(layers):
        if l["gid"] is not None and l["gid"] in groups and groups[l["gid"]] <= i:
            probs.append("%s lies above its own group" % l["name"])
    for gid, h in groups.items():
        mem = [i for i in range(len(layers)) if gid in ancs[i]]
        if mem and mem != list(range(min(mem), h)):
            probs.append("group %s: its layers are not one run just under it (%s, group at %d)" % (layers[h]["name"], mem, h))
    return probs


def lantern_tree(layers):
    kids = {}
    for l in layers:
        kids.setdefault(l["gid"], []).append(l)

    def node(l):
        o = {"name": l["name"], "group": l["kind"] == "group", "visible": l["visible"], "opacity": int(round(l["opacity"] * 255)),
             "blend": psd_blend_name(l["blend"]), "clip": l["clip"]}
        if l["kind"] == "group":
            o["open"] = l["open"] is not False
            o["children"] = [node(c) for c in kids.get(l["id"], [])]
        return o
    return [node(l) for l in kids.get(None, [])]


def norm_psd_tree(t):
    out = []
    for o in t:
        n = {"name": o["name"], "group": o["kind"] == "group", "visible": o["visible"], "opacity": o["opacity"], "blend": o["blend"], "clip": o["clip"]}
        if o["kind"] == "group":
            n["open"] = o["open"]; n["children"] = norm_psd_tree(o["children"])
        out.append(n)
    return out


def shape_of(layers):
    """ids and gids in order: what a move changes."""
    return [(l["id"], l["gid"]) for l in layers]


def compare_to_psdtools(pg, B, key, name, sure="sure", tol=TOL, note=""):
    flat = pg.flat(key)
    s = pg.save(key, "psd")
    ref = psd_composite(s["bytes"])
    d = premul_diff(flat, ref)
    pa = flat.astype(float); pb = ref.astype(float)
    err = np.maximum(np.abs(pa[..., :3] * pa[..., 3:4] - pb[..., :3] * pb[..., 3:4]).max(-1) / 255, np.abs(pa[..., 3] - pb[..., 3]))
    yx = np.unravel_index(np.argmax(err), err.shape)
    B.check(SEC, name, d <= tol, got="largest difference %.1f; at (x %d, y %d) Lantern %s, psd-tools %s" % (d, yx[1], yx[0], flat[yx].tolist(), ref[yx].tolist()),
            want="the same picture as psd-tools' compositor on the .psd Lantern saved (within %d)" % tol,
            how="Lantern's compose.all against psd-tools 1.27 PSDImage.composite(ignore_preview=True) of P.files.save(d,'psd')" + (" ; " + note if note else ""), sure=sure)
    return flat, ref, s


def run(pg, B):
    back = grad(W, H)                                    # opaque backdrop with many colours
    half = grad(W, H, alpha=128)                         # half see-through backdrop
    patchL = patch(W, H, 0, 0, 12, 8, (200, 120, 40, 255))   # covers the left three quarters
    patchR = patch(W, H, 4, 2, 16, 8, (30, 160, 220, 255))
    softp = soft_disc(W, H, 8, 4, 4, (250, 40, 90))
    gm = np.tile(np.linspace(0, 255, W).astype(np.uint8), (H, 1))   # a mask fading left to right
    inv = {"type": "invert", "p": {}}
    lev = {"type": "levels", "p": {"inBlack": 30, "inWhite": 220, "gamma": 1.4, "outBlack": 10, "outWhite": 240}}
    cur = {"type": "curves", "p": {"rgb": [[0, 0], [64, 40], [190, 220], [255, 255]]}}

    cases = [
        ("pass-through group, a Multiply layer inside, over an opaque picture",
         [dict(name="Back", rgba=back), dict(name="Mul", rgba=patchL, blend="multiply", gid=2), dict(name="Group 1", kind="group")]),
        ("Normal group, a Multiply layer inside (made alone, then laid on)",
         [dict(name="Back", rgba=back), dict(name="Mul", rgba=patchL, blend="multiply", gid=2), dict(name="Group 1", kind="group", blend="normal")]),
        ("pass-through group: an Invert adjustment inside changes the picture under the group",
         [dict(name="Back", rgba=back), dict(name="Patch", rgba=patchR, gid=3), dict(name="Invert", kind="adjust", adj=inv, gid=3), dict(name="Group 1", kind="group")]),
        ("Normal group: an Invert adjustment inside changes only the group's own layers",
         [dict(name="Back", rgba=back), dict(name="Patch", rgba=patchR, gid=3), dict(name="Invert", kind="adjust", adj=inv, gid=3), dict(name="Group 1", kind="group", blend="normal")]),
        ("pass-through group at 50% opacity over an opaque picture",
         [dict(name="Back", rgba=back), dict(name="Patch", rgba=patchL, gid=2), dict(name="Group 1", kind="group", opacity=0.5)]),
        ("pass-through group at 50% opacity over a half see-through picture (the group covers only part of it)",
         [dict(name="Back", rgba=half), dict(name="Patch", rgba=patch(W, H, 0, 0, 8, 8, (200, 120, 40, 255)), gid=2), dict(name="Group 1", kind="group", opacity=0.5)]),
        ("Normal group at 50% opacity over a half see-through picture",
         [dict(name="Back", rgba=half), dict(name="Patch", rgba=patch(W, H, 0, 0, 8, 8, (200, 120, 40, 255)), gid=2), dict(name="Group 1", kind="group", blend="normal", opacity=0.5)]),
        ("Normal group with a mask that fades left to right",
         [dict(name="Back", rgba=back), dict(name="Patch", rgba=patchR, gid=2), dict(name="Group 1", kind="group", blend="normal", mask=gm)]),
        ("pass-through group with a mask, a Screen layer inside",
         [dict(name="Back", rgba=back), dict(name="Scr", rgba=patchR, blend="screen", gid=2), dict(name="Group 1", kind="group", mask=gm)]),
        ("pass-through group with a mask over a half see-through picture",
         [dict(name="Back", rgba=half), dict(name="Patch", rgba=patch(W, H, 0, 0, 8, 8, (200, 120, 40, 255)), gid=2), dict(name="Group 1", kind="group", mask=gm)]),
        ("nested: a Screen group holding a pass-through group holding a Multiply layer",
         [dict(name="Back", rgba=back), dict(name="Under", rgba=patchR, gid=4), dict(name="Mul", rgba=patchL, blend="multiply", gid=3), dict(name="Inner", kind="group", gid=4), dict(name="Outer", kind="group", blend="screen")]),
        ("a group in Multiply at 70% opacity",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=3), dict(name="B", rgba=softp, gid=3), dict(name="Group 1", kind="group", blend="multiply", opacity=0.7)]),
        ("a group in Difference holding two layers, one Overlay",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=3), dict(name="B", rgba=patchR, blend="overlay", gid=3), dict(name="Group 1", kind="group", blend="difference")]),
        ("a hidden group hides its layers",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=2), dict(name="Group 1", kind="group", visible=False)]),
        ("a hidden layer inside a shown group",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=3, visible=False), dict(name="B", rgba=softp, gid=3), dict(name="Group 1", kind="group")]),
        ("a clipped layer inside a group (clipped to the soft disc under it)",
         [dict(name="Back", rgba=back), dict(name="Disc", rgba=softp, gid=3), dict(name="Clipped", rgba=patchR, clip=True, gid=3), dict(name="Group 1", kind="group", blend="normal")]),
        ("Levels inside a pass-through group at 60% opacity",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patchR, gid=3), dict(name="Levels", kind="adjust", adj=lev, gid=3), dict(name="Group 1", kind="group", opacity=0.6)]),
        ("Curves inside a Normal group",
         [dict(name="Back", rgba=back), dict(name="A", rgba=softp, gid=3), dict(name="Curves", kind="adjust", adj=cur, gid=3), dict(name="Group 1", kind="group", blend="normal")]),
        ("a Normal group inside a pass-through group, Invert inside the inner one",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patchR, gid=3), dict(name="Invert", kind="adjust", adj=inv, gid=3), dict(name="Inner", kind="group", blend="normal", gid=5), dict(name="B", rgba=softp, gid=5), dict(name="Outer", kind="group")]),
        ("(not a group) a layer clipped to a soft-edged layer, at the top level",
         [dict(name="Back", rgba=back), dict(name="Disc", rgba=softp), dict(name="Clipped", rgba=patchR, clip=True)]),
        ("a layer clipped to a Normal group below it (the group is the base)",
         [dict(name="Back", rgba=back), dict(name="Disc", rgba=softp, gid=2), dict(name="G", kind="group", blend="normal"), dict(name="Clipped", rgba=patchR, clip=True)]),
        ("a layer clipped to a pass-through group below it",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patch(W, H, 3, 1, 13, 7, (90, 200, 60, 255)), gid=2), dict(name="G", kind="group"), dict(name="Clipped", rgba=patchL, blend="multiply", clip=True)]),
        ("three pass-through groups nested, each at 70%, over an opaque picture",
         [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=2), dict(name="G3", kind="group", opacity=0.7, gid=4), dict(name="B", rgba=softp, gid=4, blend="multiply"), dict(name="G2", kind="group", opacity=0.7, gid=5), dict(name="G1", kind="group", opacity=0.7)]),
        ("an empty group changes nothing",
         [dict(name="Back", rgba=back), dict(name="Group 1", kind="group", blend="normal", opacity=0.3)]),
        ("pass-through group at 40% holding an Invert adjustment only",
         [dict(name="Back", rgba=back), dict(name="Invert", kind="adjust", adj=inv, gid=2), dict(name="Group 1", kind="group", opacity=0.4)]),
        ("a group in Hard Light over a see-through picture, a soft disc inside",
         [dict(name="Back", rgba=half), dict(name="B", rgba=softp, gid=2), dict(name="Group 1", kind="group", blend="hard-light")]),
    ]
    for i, (name, layers) in enumerate(cases):
        key = "gc%d" % i
        pg.make(key, W, H, layers)
        compare_to_psdtools(pg, B, key, "picture: " + name)

    # a group clipped to the layer below: Lantern clips it; psd-tools ignores a group's clipping flag on purpose ("In
    # Photoshop, clipping groups are not supported"), so this is recorded, not judged
    pg.make("gclip", W, H, [dict(name="Back", rgba=back), dict(name="Base", rgba=patch(W, H, 3, 1, 13, 7, (90, 200, 60, 255))), dict(name="A", rgba=patchR, gid=3), dict(name="G", kind="group", clip=True)])
    fl = pg.flat("gclip"); ref = psd_composite(pg.save("gclip", "psd")["bytes"])
    B.info(SEC, "a group clipped to the layer below it", "Lantern shows the group clipped to the layer under it; the .psd keeps the group's clipping flag, which psd-tools ignores "
           "('In Photoshop, clipping groups are not supported'), so other programs may show it unclipped (largest difference %.0f). Unsure what Photoshop itself does." % premul_diff(fl, ref))

    # ---- the tree as saved: names, nesting, modes, opacity, eyes, open or shut
    lay = [dict(name="Back", rgba=back), dict(name="Café – résumé", rgba=patchL, gid=5, blend="multiply", opacity=0.4),
           dict(name="Inner hidden", rgba=patchR, gid=3, visible=False), dict(name="Inner", kind="group", gid=5, open=False, blend="screen", opacity=0.75),
           dict(name="Adj", kind="adjust", adj=lev, gid=5), dict(name="Outer 日本", kind="group", blend="pass-through", opacity=0.9),
           dict(name="Empty", kind="group", blend="normal", visible=False), dict(name="Top", rgba=softp, blend="luminosity")]
    info = pg.make("tree", W, H, lay)
    s = pg.save("tree", "psd")
    want = lantern_tree(info["layers"])
    got = norm_psd_tree(psd_tree(s["bytes"]))
    B.check(SEC, "tree saved in the .psd (names, nesting, modes, opacity, eyes, open/shut) as psd-tools reads it", got == want, got=got, want=want,
            how="psd-tools' layer tree of the saved file against the document's own layers")

    # ---- the commands
    def fresh(key, extra=None):
        lays = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL), dict(name="B", rgba=patchR, blend="multiply"), dict(name="C", rgba=softp)]
        return pg.make(key, W, H, lays + (extra or []))

    # Group Layers on one layer: a pass-through group at 100% around it; the picture does not change
    fresh("g1"); before = pg.flat("g1")
    pg.ev("RV.docs.g1.active = 2")
    r = pg.exec("g1", "groupLayers", {})
    L = r["info"]["layers"]
    ok = r["ok"] and L[3]["kind"] == "group" and L[2]["name"] == "B" and L[2]["gid"] == L[3]["id"] and L[3]["blend"] == "pass-through" and L[3]["opacity"] == 1 and not well_formed(L)
    B.check(SEC, "Group Layers on one layer: a pass-through group at 100% just above it, holding it", ok, got=[(l["name"], l["kind"], l["gid"], l["blend"]) for l in L],
            want="B inside a new pass-through group", how="Photoshop's Layer > Group Layers makes a Pass Through group at 100% (Photoshop's documented default for a new group)")
    B.check(SEC, "Group Layers does not change the picture", maxdiff(before, pg.flat("g1")) == 0, got=maxdiff(before, pg.flat("g1")), want=0,
            how="a pass-through group at 100% with no mask composites exactly as its layers alone (W3C/Adobe group rule; psd-tools)")
    r = pg.exec("g1", "groupLayers", {"lo": 1, "hi": 3})   # A and the new group: side by side at the top level
    L = r["info"]["layers"]
    B.check(SEC, "Group Layers on a range {lo, hi} holding a group: one new group around both, nesting kept", r["ok"] and not well_formed(L) and L[4]["kind"] == "group" and L[3]["gid"] == L[4]["id"] and L[1]["gid"] == L[4]["id"] and L[2]["gid"] == L[3]["id"],
            got=[(l["name"], l["gid"]) for l in L] if r["ok"] else r["err"], want="A and Group 1 inside Group 2; B still inside Group 1")
    fresh("g2")
    pg.exec("g2", "groupLayers", {"lo": 2, "hi": 2})
    r = pg.exec("g2", "groupLayers", {"lo": 1, "hi": 2})   # A (top level) and B (inside Group 1, without its group): not side by side in one group
    B.check(SEC, "Group Layers refuses layers that are not side by side in one group", (not r["ok"]) and not well_formed(r["info"]["layers"]),
            got=r.get("err", "grouped them") , want="an error, tree unchanged")

    # New Group: an empty pass-through group above the chosen layer; saved as an empty group
    fresh("g3"); pg.ev("RV.docs.g3.active = 1")
    r = pg.exec("g3", "newGroup", {})
    L = r["info"]["layers"]
    s = pg.save("g3", "psd"); t = psd_tree(s["bytes"])
    emp = [o for o in t if o["kind"] == "group"]
    B.check(SEC, "New Group: an empty group above the chosen layer, saved as an empty group", r["ok"] and L[2]["kind"] == "group" and r["info"]["active"] == 2 and len(emp) == 1 and emp[0]["children"] == [],
            got=[(o["name"], o["kind"], len(o.get("children", []))) for o in t], want="Back, A, Group 1 (empty), B, C")

    # Ungroup: layers come out to the level the group was at; a pass-through 100% group's picture is unchanged
    lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=4), dict(name="B", rgba=patchR, blend="multiply", gid=3), dict(name="In", kind="group", gid=4), dict(name="Out", kind="group")]
    pg.make("g4", W, H, lay); before = pg.flat("g4")
    pg.ev("RV.docs.g4.active = 3")
    r = pg.exec("g4", "ungroupLayers", {})
    L = r["info"]["layers"]
    ok = r["ok"] and len(L) == 4 and [l["name"] for l in L] == ["Back", "A", "B", "Out"] and L[2]["gid"] == L[3]["id"] and not well_formed(L)
    B.check(SEC, "Ungroup Layers on a nested group: its layers move up one level, the group goes", ok, got=[(l["name"], l["gid"]) for l in L], want="B now directly in Out")
    B.check(SEC, "Ungroup of a pass-through 100% group leaves the picture as it was", maxdiff(before, pg.flat("g4")) <= 1, got=maxdiff(before, pg.flat("g4")), want="<= 1")
    r = pg.exec("g4", "undo", {}) if False else None
    pg.ev("Lantern.photo.doc.undo(RV.docs.g4)")
    L = pg.info("g4")["layers"]
    B.check(SEC, "Undo after Ungroup puts the group back", [l["name"] for l in L] == ["Back", "A", "B", "In", "Out"] and L[2]["gid"] == L[3]["id"], got=[(l["name"], l["gid"]) for l in L], want="the tree before")

    # Merge Group: a Normal group made one layer looks the same
    for nm, gb, gop, inner in [("Normal 100%", "normal", 1, "multiply"), ("Normal 60%, masked", "normal", 0.6, "screen"), ("Multiply 80%", "multiply", 0.8, "normal"),
                               ("pass-through 100%, normal layers", "pass-through", 1, "normal"), ("pass-through 50%, normal layers", "pass-through", 0.5, "normal")]:
        lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=3), dict(name="B", rgba=softp, blend=inner, gid=3),
               dict(name="G", kind="group", blend=gb, opacity=gop, mask=gm if "masked" in nm else None)]
        pg.make("gm", W, H, lay); before = pg.flat("gm")
        r = pg.exec("gm", "mergeGroup", {})
        after = pg.flat("gm")
        d = premul_diff(before, after)
        B.check(SEC, "Merge Group (%s) keeps the picture" % nm, r["ok"] and len(r["info"]["layers"]) == 2 and d <= 2, got="diff %.1f, layers %s" % (d, [l["name"] for l in r["info"]["layers"]]),
                want="the same picture, one layer for the group", how="merging an isolated group gives a layer that looks the same (Photoshop's Merge Group)")

    # toggleGroup: open/shut, not a History step, saved as such
    lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=2), dict(name="G", kind="group")]
    pg.make("gt", W, H, lay)
    h0 = pg.info("gt")["hist"]
    r = pg.exec("gt", "toggleGroup", {"index": 2})
    L = r["info"]["layers"]
    s = pg.save("gt", "psd"); t = psd_tree(s["bytes"])
    B.check(SEC, "Shut a group (toggleGroup): no History step; saved shut (lsct 2)", L[2]["open"] is False and r["info"]["hist"] == h0 and t[1]["open"] is False,
            got="open %s, history %d->%d, psd-tools open_folder %s" % (L[2]["open"], h0, r["info"]["hist"], t[1]["open"]), want="shut, no new step, open_folder False")

    # shutting a group is not a History step; Undo of a later step should not open it again
    lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=2), dict(name="G", kind="group")]
    pg.make("gt2", W, H, lay)
    pg.exec("gt2", "toggleGroup", {"index": 2})
    pg.ev("RV.docs.gt2.active = 0")
    pg.exec("gt2", "newLayer", {})
    pg.ev("Lantern.photo.doc.undo(RV.docs.gt2)")
    L = pg.info("gt2")["layers"]
    B.check(SEC, "a group shut by hand stays shut when a later step is undone", L[2]["open"] is False, got="open" if L[2]["open"] else "shut", want="shut",
            how="Photoshop: opening and shutting groups is not in History, and Undo does not reopen them (reviewer's memory)", sure="medium")
    # the group commands undo and redo exactly
    und = []
    for cmd, prm, act in (("groupLayers", {}, 2), ("newGroup", {}, 1), ("mergeGroup", {}, 5), ("duplicateLayer", {}, 5), ("moveLayer", {"to": 0}, 2), ("ungroupLayers", {}, 5), ("deleteLayer", {}, 5)):
        lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=5), dict(name="B", rgba=softp, gid=3, blend="multiply"), dict(name="In", kind="group", gid=5, blend="normal", opacity=0.6),
               dict(name="C", rgba=patchR, gid=5), dict(name="Out", kind="group", mask=gm)]
        pg.make("gu2", W, H, lay)
        pg.ev("RV.docs.gu2.active = %d" % act)
        s0 = shape_of(pg.info("gu2")["layers"]); f0 = pg.flat("gu2")
        r = pg.exec("gu2", cmd, prm)
        s1 = shape_of(r["info"]["layers"]); f1 = pg.flat("gu2")
        pg.ev("Lantern.photo.doc.undo(RV.docs.gu2)")
        s2 = shape_of(pg.info("gu2")["layers"]); f2 = pg.flat("gu2")
        pg.ev("Lantern.photo.doc.redo(RV.docs.gu2)")
        s3 = shape_of(pg.info("gu2")["layers"]); f3 = pg.flat("gu2")
        if not r["ok"] or s2 != s0 or maxdiff(f2, f0) or s3 != s1 or maxdiff(f3, f1) or well_formed(pg.info("gu2")["layers"]):
            und.append((cmd, r.get("err"), s2 == s0, maxdiff(f2, f0), s3 == s1, maxdiff(f3, f1)))
    B.check(SEC, "Group Layers, New Group, Merge Group, Duplicate, Move, Ungroup and Delete each undo and redo exactly (tree and picture)", not und, got=und, want="none")

    # Delete a group: its layers go with it; Undo brings them back
    lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=3), dict(name="B", rgba=softp, gid=3), dict(name="G", kind="group"), dict(name="C", rgba=patchR)]
    pg.make("gd", W, H, lay); before = pg.flat("gd")
    pg.ev("RV.docs.gd.active = 3")
    r = pg.exec("gd", "deleteLayer", {})
    L = r["info"]["layers"]
    B.check(SEC, "Delete Layer on a group removes the group and its layers", [l["name"] for l in L] == ["Back", "C"], got=[l["name"] for l in L], want=["Back", "C"])
    pg.ev("Lantern.photo.doc.undo(RV.docs.gd)")
    B.check(SEC, "Undo brings the deleted group back, picture and all", maxdiff(before, pg.flat("gd")) == 0 and [l["name"] for l in pg.info("gd")["layers"]] == ["Back", "A", "B", "G", "C"],
            got=[l["name"] for l in pg.info("gd")["layers"]], want=["Back", "A", "B", "G", "C"])

    # Duplicate a nested group: the copies belong to the copies
    lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=2), dict(name="In", kind="group", gid=4, blend="normal", opacity=0.5),
           dict(name="B", rgba=softp, gid=4), dict(name="Out", kind="group", blend="screen", mask=gm)]
    pg.make("gu", W, H, lay)
    pg.ev("RV.docs.gu.active = 4")
    r = pg.exec("gu", "duplicateLayer", {})
    L = r["info"]["layers"]
    names = [l["name"] for l in L]
    wf = well_formed(L)
    ok = r["ok"] and not wf and names == ["Back", "A", "In", "B", "Out", "A", "In", "B", "Out copy"] and L[5]["gid"] == L[6]["id"] and L[6]["gid"] == L[8]["id"] and L[7]["gid"] == L[8]["id"] \
        and L[1]["gid"] == L[2]["id"] and L[2]["gid"] == L[4]["id"] and L[8]["mask"] is not None and L[6]["opacity"] == 0.5
    B.check(SEC, "Duplicate Layer on a nested group: a whole copy above it, the copies in the copies", ok, got=[(l["name"], l["id"], l["gid"]) for l in L], want="Back, A, In, B, Out, then the same again named 'Out copy'",
            how="Photoshop's Duplicate Group copies the group with its layers and names the copy '<name> copy'")
    s = pg.save("gu", "psd"); t = norm_psd_tree(psd_tree(s["bytes"]))
    B.check(SEC, "the duplicated group saves as two whole groups", t == lantern_tree(L), got=t, want=lantern_tree(L))
    # the copy is an independent copy: painting into the copy's layer does not change the original
    pg.ev("(() => { const d = RV.docs.gu, l = d.layers[5]; const c = Lantern.photo.doc.touch(d, l); c.getContext('2d').fillStyle = '#00ff00'; c.getContext('2d').fillRect(0,0,4,4); })()")
    a1 = pg.ev("RV.b64(RV.px(RV.docs.gu.layers[1].cv))"); a5 = pg.ev("RV.b64(RV.px(RV.docs.gu.layers[5].cv))")
    B.check(SEC, "the copy's pixels are its own (a change to the copy leaves the original)", a1 != a5, got="same" if a1 == a5 else "different", want="different")

    # Move Layer: into an open group, over a shut one, out at the top and the bottom (the tile's stated rule, which is Photoshop's
    # behaviour as this reviewer remembers it: medium)
    def movecase(label, lay, active, to, want_names, want_parent, sure="medium"):
        pg.make("mv", W, H, lay)
        pg.ev("RV.docs.mv.active = %d" % active)
        r = pg.exec("mv", "moveLayer", {"to": to})
        L = r["info"]["layers"]
        par = {l["name"]: next((x["name"] for x in L if x["id"] == l["gid"]), None) for l in L}
        ok = r["ok"] and [l["name"] for l in L] == want_names and all(par[k] == v for k, v in want_parent.items()) and not well_formed(L)
        B.check(SEC, "Move Layer: " + label, ok, got=[(l["name"], par[l["name"]]) for l in L] if r["ok"] else r["err"], want=(want_names, want_parent), sure=sure,
                how="each step of Layer > Arrange moves one layer or one whole group one place; into an open group, over a shut one, out at a group's edge")

    base = [dict(name="Back", rgba=back), dict(name="X", rgba=patchR), dict(name="A", rgba=patchL, gid=4), dict(name="B", rgba=softp, gid=4), dict(name="G", kind="group"), dict(name="Y", rgba=patchR)]
    movecase("up from under an open group goes into it at its bottom", base, 1, 2, ["Back", "X", "A", "B", "G", "Y"], {"X": "G"})
    shut = [dict(q) for q in base]; shut[4]["open"] = False
    movecase("up from under a shut group steps over the whole group", shut, 1, 2, ["Back", "A", "B", "G", "X", "Y"], {"X": None, "A": "G"})
    movecase("up from the top of a group goes out above it", base, 3, 4, ["Back", "X", "A", "G", "B", "Y"], {"B": None, "A": "G"})
    movecase("down from the bottom of a group goes out under it", base, 2, 1, ["Back", "X", "A", "B", "G", "Y"], {"A": None, "B": "G"})
    movecase("down from above an open group goes into it at its top", base, 5, 4, ["Back", "X", "A", "B", "Y", "G"], {"Y": "G"})
    movecase("a group moved up steps over the layer above, with its layers", base, 4, 5, ["Back", "X", "Y", "A", "B", "G"], {"A": "G", "B": "G", "Y": None})
    movecase("a group moved down steps under the layer below, with its layers", base, 4, 3, ["Back", "A", "B", "G", "X", "Y"], {"A": "G", "X": None})

    # every move is undone by the opposite move; and the tree stays whole through random moves (random documents, fixed seed)
    rnd = random.Random(1242)

    def gen(depth):
        out = []
        for k in range(rnd.randint(0 if depth else 2, 3)):
            if depth < 3 and rnd.random() < 0.4:
                out.append(("G", rnd.random() < 0.7, gen(depth + 1)))
            else:
                out.append(("L",))
        return out

    def flatten(nodes, parent, out):
        for nd in nodes:
            if nd[0] == "L":
                out.append({"name": "L%d" % len(out), "rgba": patchL, "_par": parent})
            else:
                g = {"name": "G%d" % len(out), "kind": "group", "open": nd[1], "_par": parent}
                flatten(nd[2], g, out); g["name"] = "G%d" % len(out); out.append(g)
        return out

    bad_rev, bad_wf, tried, bad_save = [], [], 0, []
    for trial in range(30):
        flat_l = flatten(gen(0), None, [{"name": "Back", "rgba": back, "_par": None}])
        L2 = []
        for q in flat_l:
            q2 = {k: v for k, v in q.items() if k != "_par"}
            q2["gid"] = None if q["_par"] is None else next(i for i, x in enumerate(flat_l) if x is q["_par"])
            L2.append(q2)
        info = pg.make("rnd", W, H, L2)
        L = info["layers"]
        if well_formed(L):
            bad_wf.append(("the reviewer's own tree is broken", trial)); continue
        tried += 1
        # the writer on any tree: psd-tools reads the same tree, and Lantern opens its own file to the same tree
        sv = pg.save("rnd", "psd")
        if norm_psd_tree(psd_tree(sv["bytes"])) != lantern_tree(L):
            bad_save.append((trial, "psd-tools", [(l["name"], l["gid"]) for l in L]))
        back_info = pg.open(sv["bytes"], "rnd.psd", "rndback")
        if lantern_tree(back_info["layers"]) != lantern_tree(L):
            bad_save.append((trial, "reopened", [(l["name"], l["gid"]) for l in L]))
        hid = pg.ev("(() => { const d = RV.docs.rnd; return d.layers.map(function (l) { return Lantern.photo.groups.hidden(d, l); }); })()")
        for k in range(1, len(L)):
            if hid[k]:
                continue
            for dirn in (1, -1):
                pg.make("rnd", W, H, L2)
                pg.ev("RV.docs.rnd.active = %d" % k)
                s0 = shape_of(pg.info("rnd")["layers"])
                r = pg.exec("rnd", "moveLayer", {"to": k + dirn})
                if not r["ok"] or r["r"] is False or shape_of(r["info"]["layers"]) == s0:
                    continue
                if well_formed(r["info"]["layers"]):
                    bad_wf.append((trial, k, dirn, well_formed(r["info"]["layers"])))
                a = r["info"]["active"]
                r2 = pg.exec("rnd", "moveLayer", {"to": a - dirn})
                if shape_of(r2["info"]["layers"]) != s0:
                    bad_rev.append((trial, [(l["name"], l["gid"]) for l in L], "index %d" % k, "up" if dirn > 0 else "down"))
    B.check(SEC, "Move Layer keeps the tree whole (every group's layers one run just under it), %d random trees" % tried, not bad_wf, got=bad_wf[:3], want="no broken trees")
    B.check(SEC, "random trees (up to 4 deep, open and shut) saved: psd-tools reads the same tree and Lantern reopens it the same", not bad_save, got=bad_save[:3], want="no difference")
    B.check(SEC, "a move up and then down (or down then up) puts the layers back as they were", not bad_rev, got=bad_rev[:3], want="no difference", sure="medium",
            how="Photoshop's Bring Forward and Send Backward undo each other (reviewer's expectation, not from a published rule)")

    # Move tool on a group moves all of its layers and its mask
    lay = [dict(name="Back", rgba=solid(W, H, (255, 255, 255, 255))), dict(name="A", rgba=patch(W, H, 2, 2, 5, 5, (255, 0, 0, 255)), gid=3),
           dict(name="B", rgba=patch(W, H, 6, 1, 8, 3, (0, 0, 255, 255)), gid=3), dict(name="G", kind="group", blend="normal")]
    pg.make("gmv", W, H, lay); before = pg.flat("gmv")
    pg.ev("RV.docs.gmv.active = 3")
    r = pg.exec("gmv", "moveBy", {"dx": 3, "dy": 2})
    after = pg.flat("gmv")
    want = np.full_like(before, 255); want[:, :, :] = before[0, 0]
    want[2 + 2:5 + 2, 2 + 3:5 + 3] = (255, 0, 0, 255); want[1 + 2:3 + 2, 6 + 3:8 + 3] = (0, 0, 255, 255)
    B.check(SEC, "the Move tool on a group moves every layer in it", maxdiff(after, want) == 0, got=maxdiff(after, want), want=0)

    # Merge Visible with a hidden group: what shows becomes one layer; the hidden group stays as it was
    lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patchL, gid=2), dict(name="G", kind="group", visible=False),
           dict(name="B", rgba=softp, gid=4), dict(name="H", kind="group", blend="multiply")]
    pg.make("gv", W, H, lay); before = pg.flat("gv")
    r = pg.exec("gv", "mergeVisible", {})
    L = r["info"]["layers"]
    B.check(SEC, "Merge Visible with groups keeps the picture and the hidden group", r["ok"] and maxdiff(before, pg.flat("gv")) <= 1 and any(l["name"] == "G" and l["kind"] == "group" for l in L) and not well_formed(L),
            got=([(l["name"], l["kind"], l["gid"]) for l in L], maxdiff(before, pg.flat("gv"))), want="the same picture; G and A kept hidden")

    # Merge Down inside a group: the merged layer stays in the group
    lay = [dict(name="Back", rgba=back), dict(name="A", rgba=patch(W, H, 0, 0, 16, 8, (200, 120, 40, 255)), gid=3), dict(name="B", rgba=softp, blend="multiply", gid=3), dict(name="G", kind="group")]
    pg.make("gmd", W, H, lay); before = pg.flat("gmd")
    pg.ev("RV.docs.gmd.active = 2")
    r = pg.exec("gmd", "mergeDown", {})
    L = r["info"]["layers"]
    B.check(SEC, "Merge Down inside a group: one layer, still in the group, the same picture", r["ok"] and len(L) == 3 and L[1]["gid"] == L[2]["id"] and maxdiff(before, pg.flat("gmd")) <= 1,
            got=([(l["name"], l["gid"]) for l in L], maxdiff(before, pg.flat("gmd"))), want="A in G, picture unchanged")

    # ---- grouped .psd files made by psd-tools, opened in Lantern
    from psd_tools import PSDImage
    from psd_tools.api.layers import PixelLayer, Group
    from psd_tools.constants import BlendMode
    from PIL import Image

    def ptool_file(spec, mode="RGBA", w=W, h=H):
        psd = PSDImage.new(mode, (w, h))
        def add(parent, items):
            for it in items:
                if it[0] == "g":
                    _, nm, bm, op, vis, opn, kids = it
                    g = parent.create_group(name=nm, blend_mode=bm, opacity=op, open_folder=opn)
                    add(g, kids)
                    g.visible = vis
                else:
                    _, nm, arr, bm, op, vis = it
                    lyr = PixelLayer.frompil(Image.fromarray(arr, "RGBA"), parent=parent, name=nm)
                    lyr.blend_mode = bm; lyr.opacity = op; lyr.visible = vis
        add(psd, spec)
        bio = io.BytesIO(); psd.save(bio); return bio.getvalue()

    files = [
        ("a pass-through group with a Multiply layer", [("l", "Back", back, BlendMode.NORMAL, 255, True),
                                                       ("g", "G", BlendMode.PASS_THROUGH, 255, True, True, [("l", "Mul", patchL, BlendMode.MULTIPLY, 255, True)])]),
        ("a Normal group at opacity 128 holding a Screen layer", [("l", "Back", back, BlendMode.NORMAL, 255, True),
                                                       ("g", "G", BlendMode.NORMAL, 128, True, False, [("l", "Scr", patchR, BlendMode.SCREEN, 255, True), ("l", "Disc", softp, BlendMode.NORMAL, 200, True)])]),
        ("nested groups: Multiply holding pass-through holding Difference", [("l", "Back", back, BlendMode.NORMAL, 255, True),
                                                       ("g", "Out", BlendMode.MULTIPLY, 230, True, True, [("l", "A", patchL, BlendMode.NORMAL, 255, True),
                                                        ("g", "In", BlendMode.PASS_THROUGH, 255, True, False, [("l", "D", patchR, BlendMode.DIFFERENCE, 255, True)])])]),
        ("a hidden group and a hidden layer", [("l", "Back", half, BlendMode.NORMAL, 255, True),
                                               ("g", "H", BlendMode.NORMAL, 255, False, True, [("l", "A", patchL, BlendMode.NORMAL, 255, True)]),
                                               ("g", "S", BlendMode.LINEAR_DODGE, 255, True, True, [("l", "B", patchR, BlendMode.NORMAL, 255, False), ("l", "C", softp, BlendMode.NORMAL, 255, True)])]),
        ("a pass-through group at opacity 100 over a half see-through layer", [("l", "Back", half, BlendMode.NORMAL, 255, True),
                                                       ("g", "G", BlendMode.PASS_THROUGH, 100, True, True, [("l", "A", patch(W, H, 0, 0, 8, 8, (200, 120, 40, 255)), BlendMode.NORMAL, 255, True)])]),
    ]
    for nm, spec in files:
        data = ptool_file(spec)
        info = pg.open(data, "grouped.psd", "pt")
        L = info["layers"]
        want = norm_psd_tree(psd_tree(data))
        got = lantern_tree(L)
        B.check(SEC, "a psd-tools .psd opens with its groups: " + nm, got == want and not well_formed(L), got=got, want=want,
                how="psd-tools' own tree of the file it wrote")
        ref = psd_composite(data); flat = pg.flat("pt")
        d = premul_diff(flat, ref)
        B.check(SEC, "a psd-tools .psd looks as psd-tools composites it: " + nm, d <= TOL, got="largest difference %.1f" % d, want="<= %d" % TOL)
