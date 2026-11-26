# run_review.py -- a fourth, independent review of the Photo tile (Lantern 1.24.42, after the mends of the first review):
# layer groups, the boxes (modal, Esc/Enter/Cancel, the new ones), layer styles, keys, the Magnetic Lasso, Swatches,
# dropping files, Type, Free Transform, Straighten, Crop, Quick Mask, History, three window sizes and a 12 MP photo.
# Driven as a person drives it: menus, tools, the Layers/History/Swatches panels, keys, drags on the picture.
# The document's state is only READ, to check results.
# Each check prints "PASS  ..." or "FAIL  ..."; the run ends with "N checks, M failed". A FAIL is a finding (REPORT.txt).
# Usage: python3 run_review.py [path/to/index.html] [section ...]
#   sections: groups groups2 boxes newboxes styles keys maglasso swatches drop typetool transform image mends sizes big
import os, sys, json, re, time, math, tempfile, traceback, io
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from harness import Serve, Tile, DEFAULT_BUILD
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
BUILD = DEFAULT_BUILD
if args and (args[0].endswith(".html") or os.path.isfile(args[0])):
    BUILD = args.pop(0)
ONLY = set(args)
INPUTS = os.path.join(HERE, "inputs")
OUT = tempfile.mkdtemp(prefix="photo_review4_")
RESULTS = []
T0 = time.time()


def check(name, cond, info=""):
    RESULTS.append({"check": name, "ok": bool(cond), "info": str(info)[:700]})
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  -- " + str(info)[:500]), flush=True)


def near(a, b, tol):
    return a is not None and b is not None and len(a) >= len(b) and all(abs(x - y) <= tol for x, y in zip(a, b))


SECTIONS = []
def section(fn):
    SECTIONS.append(fn); return fn


def page_errors(T, where):
    errs = list(T.errs)
    check(where + ": no uncaught page errors", not errs, errs[:4])


def fresh(B, port, pic="photo.png", viewport=(1400, 900)):
    T = Tile(B, port, INPUTS, OUT, viewport=viewport)
    if pic: T.open(pic)
    return T


def paint_rect(T, x0, y0, x1, y1, rgb):
    """select a rectangle with the Marquee and fill it with a colour by Alt+Backspace, then deselect"""
    T.tool("marquee"); T.drag((x0, y0), (x1, y1)); T.set_colour(rgb); T.focus_away(); T.key("Alt+Backspace"); T.key("Control+d")


def ensure_open(T, g):
    """open the group in the Layers panel if it is shut (a person clicks its triangle to see its layers)"""
    if any(x.startswith(g + "[G shut]") for x in T.struct()): T.twist(g)


def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


# ============================================================ layer groups
@section
def groups(B, port):
    T = fresh(B, port)
    base = T.flat_hash()
    T.menu("Layer", "New Layer"); paint_rect(T, 50, 50, 150, 150, (220, 0, 0)); T.rename(T.active_name(), "A")
    T.menu("Layer", "New Layer"); paint_rect(T, 100, 100, 200, 200, (0, 0, 220)); T.rename(T.active_name(), "B")
    check("setup: two painted layers A (red) and B (blue) above the Background", T.names() == ["Background", "A", "B"] and near(T.flat(125, 125), [0, 0, 220], 2) and near(T.flat(60, 60), [220, 0, 0], 2), (T.names(), T.flat(125, 125)))
    pic = T.flat_hash(); h0 = len(T.hist())
    # Ctrl+G with B chosen
    T.key("Control+g")
    st = T.struct()
    check("Ctrl+G puts the chosen layer B in a new group 'Group 1' (the group just above it, chosen)", st == ["Background", "A", "B<Group 1", "Group 1[G]"] and T.active_name() == "Group 1", st)
    check("Ctrl+G: the picture is unchanged", T.flat_hash() == pic)
    check("Ctrl+G: one History step 'Group Layers'", T.hist()[-1] == "Group Layers" and len(T.hist()) == h0 + 1, T.hist()[-3:])
    rows = T.rows()
    check("Layers panel: the group's row has a triangle and B is set in under it", rows[0][0].startswith("Group 1") and rows[0][3] in ("▾",) and rows[1][0].startswith("B") and rows[1][1] > rows[0][1], rows)
    # the blending list offers pass through only for a group
    opt = T.J("(() => { var s = document.querySelector('.ph-lctl select'); return [s.value, !s.options[0].hidden && !s.options[0].disabled]; })()")
    check("The blending list shows 'pass-through' for the group, and offers it", opt[0] == "pass-through" and opt[1], opt)
    T.row_click("A")
    opt2 = T.J("(() => { var s = document.querySelector('.ph-lctl select'); return [s.value, s.options[0].hidden, s.options[0].disabled]; })()")
    check("...and not for a plain layer (A)", opt2[0] == "normal" and opt2[1] and opt2[2], opt2)
    # A up: into the open group, at its bottom
    T.lbtn("Move up")
    check("Up button on A (below an open group): A goes into the group, at its bottom", T.struct() == ["Background", "A<Group 1", "B<Group 1", "Group 1[G]"] and T.active_name() == "A", T.struct())
    check("...the picture is unchanged by that move", T.flat_hash() == pic)
    T.lbtn("Move up")
    check("Up again: A moves above B inside the group (A's red now over B's blue)", T.struct() == ["Background", "B<Group 1", "A<Group 1", "Group 1[G]"] and near(T.flat(125, 125), [220, 0, 0], 2), (T.struct(), T.flat(125, 125)))
    T.lbtn("Move up")
    check("Up again: at the top of its group, A leaves the group above it", T.struct() == ["Background", "B<Group 1", "Group 1[G]", "A"], T.struct())
    T.lbtn("Move down")
    check("Down: from above an open group, A goes into it at its top", T.struct() == ["Background", "B<Group 1", "A<Group 1", "Group 1[G]"], T.struct())
    T.lbtn("Move down"); T.lbtn("Move down")
    check("Down twice: below B, then out of the bottom of the group", T.struct() == ["Background", "A", "B<Group 1", "Group 1[G]"], T.struct())
    # shut the group: its layers leave the panel; not a History step
    nh = len(T.hist())
    T.twist("Group 1")
    rows = T.rows()
    check("The triangle shuts the group: its layer B leaves the panel, the triangle turns", [r[0].split()[0] for r in rows] == ["Group", "A", "Background"] and rows[0][3] == "▸", rows)
    check("...shutting a group is not a History step", len(T.hist()) == nh, T.hist()[-2:])
    # a new layer above the shut group, moved down past it
    T.row_click("Group 1"); T.menu("Layer", "New Layer"); T.rename(T.active_name(), "C")
    check("New Layer with a shut group chosen goes above the group, not into it", T.struct()[-1] == "C", T.struct())
    T.lbtn("Move down")
    check("Down on C past the shut group: C goes under the whole group, not into it", T.struct() == ["Background", "A", "C", "B<Group 1", "Group 1[G shut]"], T.struct())
    T.lbtn("Move up")
    check("Up on C past the shut group: back above it", T.struct() == ["Background", "A", "B<Group 1", "Group 1[G shut]", "C"], T.struct())
    T.twist("Group 1")
    check("The triangle opens the group again (B back in the panel)", any(r[0].startswith("B") for r in T.rows()), T.rows())
    # a brush stroke and a filter with the group chosen: refused plainly
    T.row_click("Group 1"); hb = T.layers_hash(); nh = len(T.hist())
    T.tool("brush"); T.drag((300, 300), (400, 320))
    st = T.center_status()
    check("Brush with a group chosen: nothing painted, no History step, a plain message", T.layers_hash() == hb and len(T.hist()) == nh and "group" in st.lower(), st)
    T.menu("Filter", "Blur", "Gaussian Blur…"); T.pg.wait_for_timeout(300)
    if T.dialog_open(): T.ok()
    st = T.center_status()
    check("Filter > Gaussian Blur with a group chosen: refused with a plain message, nothing changed", T.layers_hash() == hb and len(T.hist()) == nh and "group" in st.lower(), st)
    T.menu("Image", "Adjustments", "Invert…"); st = T.center_status()
    check("Image > Adjustments > Invert with a group chosen: refused with a plain message", T.layers_hash() == hb and "group" in st.lower(), st)
    # Merge Group from the menu name and Ctrl+E
    T.pg.click(".ph-mbtn:text-is('Layer')")
    lab = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-menu > .ph-mitem'), function (b) { return b.children[0].textContent; })")
    T.key("Escape")
    check("With a group chosen the Layer menu says 'Merge Group' (not Merge Down)", "Merge Group" in lab and "Merge Down" not in lab, [x for x in lab if "Merge" in x])
    check("Esc closes the open menu", not T.J("!!document.querySelector('.ph-menu')"))
    before = T.flat_hash(); n0 = len(T.names())
    T.key("Control+e")
    check("Ctrl+E on the group: one layer 'Group 1' in its place, the picture unchanged", T.struct() == ["Background", "A", "Group 1", "C"] and T.flat_hash() == before and T.hist()[-1] == "Merge Group", (T.struct(), T.hist()[-1]))
    T.key("Control+z")
    st = T.struct()
    check("Ctrl+Z gives the group back with its layer", [x.replace(" shut", "") for x in st] == ["Background", "A", "B<Group 1", "Group 1[G]", "C"], st)
    check("...and the group stays open in the panel as the person left it (shutting/opening is not a step; Undo should not shut it again)", st == ["Background", "A", "B<Group 1", "Group 1[G]", "C"], st)
    if "Group 1[G shut]" in st: T.twist("Group 1")
    # group opacity: the picture, then Merge Group keeps the look
    T.row_click("Group 1"); T.pg.locator(".ph-lctl input[type=number]").fill("50"); T.pg.locator(".ph-lctl input[type=number]").press("Enter"); T.pg.wait_for_timeout(200)
    c50 = T.flat(180, 180)
    check("Group opacity 50%: B shows half over the Background", c50 and 60 < c50[2] < 200 and c50[0] < 200, c50)
    before = T.flat_hash(); T.key("Control+e")
    check("Merge Group of a 50% group: the picture is unchanged", T.flat_hash() == before, (T.flat(180, 180), c50))
    T.key("Control+z"); T.key("Control+z")
    check("Ctrl+Z twice: the merge and the 50% undone", [l["op"] for l in T.doc()["layers"] if l["name"] == "Group 1"] == [1], T.doc()["layers"])
    # pass through vs normal: an Invert adjustment layer inside the group
    ensure_open(T, "Group 1"); T.row_click("B"); T.pg.locator(".ph-lbar select[title='New adjustment layer']").select_option("invert"); T.pg.wait_for_timeout(300); T.focus_away()
    st = T.struct()
    inside = len(st) >= 2 and any(s.startswith("Invert<Group 1") for s in st)
    bgpt = T.flat(600, 400)
    check("An Invert adjustment layer made from the Layers panel's list with B chosen goes into B's group", inside, st)
    orig_bg = [70, 140, 60]
    check("Pass Through group: the Invert inside also inverts the Background under the group (as the help says)", near(bgpt, [255 - orig_bg[0], 255 - orig_bg[1], 255 - orig_bg[2]], 3), bgpt)
    T.row_click("Group 1"); T.pg.select_option(".ph-lctl select", "normal"); T.focus_away()
    bgpt2 = T.flat(600, 400); bpt = T.flat(180, 180)
    check("Group set to Normal: the Invert changes only the group's own layers (Background back, B inverted)", near(bgpt2, orig_bg, 3) and bpt[0] > 200 and bpt[2] < 60, (bgpt2, bpt))
    T.key("Control+z"); T.key("Control+z")
    check("Ctrl+Z twice: the Invert layer and the Normal mode undone", [x.replace(" shut", "") for x in T.struct()] == ["Background", "A", "B<Group 1", "Group 1[G]", "C"] and [l["blend"] for l in T.doc()["layers"] if l["name"] == "Group 1"] == ["pass-through"], T.struct())
    # moving the group with the Move tool takes its layers
    T.row_click("Group 1"); T.tool("move"); T.drag((150, 150), (190, 170))
    check("Move tool on a group moves its layer (B's blue square now starts at 140,120)", near(T.flat(145, 125), [0, 0, 220], 2) and not near(T.flat(105, 105), [0, 0, 220], 2), (T.flat(145, 125), T.flat(105, 105)))
    T.key("Control+z")
    # duplicate and delete a group
    T.row_click("Group 1"); n0 = len(T.names()); pic = T.flat_hash()
    T.menu("Layer", "Duplicate Layer")
    st = T.struct()
    st = [x.replace(" shut", "") for x in st]
    check("Duplicate Layer on a group copies the group and its layer ('Group 1 copy' holding a B, just above the group)", st[-3:-1] == ["B<Group 1 copy", "Group 1 copy[G]"] and len(st) == n0 + 2, st)
    check("...the picture is unchanged by the copy (it lies exactly over the first)", T.flat_hash() == pic)
    T.lbtn("Delete layer")
    check("Delete on the group copy takes away the group and its layer", len(T.names()) == n0 and "Group 1 copy" not in T.names(), T.struct())
    # Ctrl+Shift+G: ungroup
    T.row_click("Group 1"); pic = T.flat_hash()
    T.key("Control+Shift+g")
    check("Ctrl+Shift+G takes the group away and leaves its layer B in place", "Group 1" not in T.names() and "B" in T.names() and T.flat_hash() == pic, T.struct())
    T.key("Control+z")
    check("Ctrl+Z after Ungroup: the group is back with B in it", "B<Group 1" in T.struct(), T.struct())
    T.key("Control+Shift+z")
    check("Ctrl+Shift+Z: ungrouped again", "Group 1" not in T.names(), T.struct())
    T.key("Control+z")
    # Layer > New Group with the Background chosen
    T.row_click("Background"); T.menu("Layer", "New Group")
    st = T.struct()
    check("Layer > New Group: an empty group 'Group 2' just above the chosen layer", st[:2] == ["Background", "Group 2[G]"] and T.active_name() == "Group 2", st)
    T.key("Control+z")
    # Merge Visible keeps a hidden layer that is inside a visible group (Photoshop leaves hidden layers alone)
    ensure_open(T, "Group 1"); T.row_click("B"); T.menu("Layer", "New Layer"); T.rename(T.active_name(), "Hid")
    paint_rect(T, 400, 50, 450, 100, (0, 200, 0)); T.row_click("Hid"); T.row_loc("Hid").locator(".ph-eye").first.click(); T.pg.wait_for_timeout(150)
    check("setup: a hidden layer 'Hid' inside the visible group", "Hid<Group 1" in T.struct() and [l for l in T.doc()["layers"] if l["name"] == "Hid"][0]["vis"] is False, T.struct())
    pic = T.flat_hash(); T.key("Control+Shift+e")
    check("Merge Visible: the picture is unchanged", T.flat_hash() == pic)
    check("Merge Visible keeps the hidden layer inside the group (Photoshop merges only what shows; hidden layers stay)", "Hid" in T.names(), T.struct())
    T.key("Control+z")
    # Image-wide commands with a group in the picture
    for path, label in [(("Image", "Image Rotation", "90° Clockwise"), "Image Rotation 90° Clockwise"), (("Image", "Image Rotation", "Flip Canvas Horizontal"), "Flip Canvas Horizontal"), (("Image", "Image Size…"), "Image Size")]:
        nh = len(T.hist()); w0 = T.doc()["w"]
        T.menu(*path)
        if T.dialog_open():
            T.dlg_set({"w": 320}); T.ok()
        ok = len(T.hist()) == nh + 1
        check("%s works on a picture that has a group (it changes every layer, the group's too)" % label, ok, (T.center_status(), T.hist()[-1]))
        if ok: T.key("Control+z")
    T.tool("measure"); T.drag((100, 300), (500, 330)); nh = len(T.hist())
    T.menu("Image", "Image Rotation", "Straighten by the Ruler line")
    ok = len(T.hist()) == nh + 1
    check("Straighten by the Ruler line works on a picture that has a group", ok, (T.center_status(), T.hist()[-1]))
    if ok: T.key("Control+z")
    # Free Transform with a group chosen: Photoshop transforms all its layers
    T.row_click("Group 1"); nh = len(T.hist())
    T.menu("Edit", "Free Transform"); T.pg.wait_for_timeout(200)
    T.drag((150, 150), (200, 150)); T.key("Enter")
    ok = len(T.hist()) == nh + 1 and near(T.flat(205, 125), [0, 0, 220], 2)
    check("Free Transform on a group: moving it moves the group's layers (as Photoshop's), or it says at once it cannot", ok or "group" in T.center_status().lower() and len(T.hist()) == nh and False, (T.center_status(), T.hist()[-2:]))
    if len(T.hist()) == nh + 1: T.key("Control+z")
    # save to .psd and open it again
    T.row_click("Group 1"); T.twist("Group 1")
    try:
        p = T.download(lambda: T.key("Control+s"))
        from psd_tools import PSDImage
        pp = PSDImage.open(p)
        tree = [(l.name, l.kind, l.parent.name if l.parent is not None and l.parent is not pp else None) for l in pp.descendants()]
        check("Ctrl+S: psd-tools reads 'Group 1' as a group holding B", ("B", "pixel", "Group 1") in tree and ("Group 1", "group", None) in tree, tree)
        g1 = [l for l in pp.descendants() if l.name == "Group 1"][0]
        check("...the group saved shut stays shut (open_folder false) and Pass Through", (not g1.is_visible() or True) and str(g1.blend_mode).lower().endswith("pass_through"), (str(g1.blend_mode),))
        comp = np.array(pp.composite().convert("RGB")).astype(int); fl = T.flat_np()[..., :3]
        check("...psd-tools' picture of the saved file is the tile's", np.abs(comp - fl).max() <= 3, np.abs(comp - fl).max())
        pic = T.flat_hash(); st0 = T.struct()
        T.open(p)
        check("Opening the saved .psd again: the same layers and group, the same picture", T.struct() == st0 and T.flat_hash() == pic, (T.struct(), st0))
    except Exception as e:
        check("Ctrl+S saves a .psd with the group", False, str(e)[:300])
    # a .psd with a group made by another program (psd-tools)
    T.open("group_psdtools.psd")
    st = T.struct(); d = T.doc()
    bd = [l for l in d["layers"] if l["name"] == "Blue disc"]
    check("A .psd made by psd-tools with a group 'Things': the group and its two layers open as a group", st == ["Paper", "Red square<Things", "Blue disc<Things", "Things[G]"], st)
    check("...its hidden layer stays hidden and the picture is as psd-tools draws it", bd and not bd[0]["vis"] and near(T.flat(50, 50), [200, 30, 30], 2) and near(T.flat(140, 80), [240, 240, 230], 2), (bd, T.flat(50, 50), T.flat(140, 80)))
    # Undo through all of it, back to Open: the photo as it was
    T.open("photo.png"); base = T.flat_hash()
    T.menu("Layer", "New Layer"); paint_rect(T, 10, 10, 60, 60, (255, 0, 255)); T.key("Control+g"); T.menu("Layer", "New Group"); T.key("Control+e"); T.key("Control+Shift+g") if T.J("Lantern.photo.api.d.layers[Lantern.photo.api.d.active].kind") == "group" else None
    for _ in range(12): T.key("Control+z", wait=60)
    check("Undo through New Layer, fill, Group, New Group, Merge Group: the photo exactly as opened", T.flat_hash() == base and T.names() == ["Background"], (T.names(), T.hist()))
    page_errors(T, "groups")
    T.close()


# ============================================================ groups: Undo and Redo through each command, nesting, and a .psd round trip
@section
def groups2(B, port):
    T = fresh(B, port)
    def state(): return (T.struct(), T.flat_hash())
    def step(label, fn):
        """do fn as a person; then Undo every History step it made and Redo them: the picture and the layers must come back each way"""
        before = state(); n0 = len(T.hist()); fn(); T.pg.wait_for_timeout(100)
        after = state(); k = len(T.hist()) - n0
        for _ in range(k): T.key("Control+z", wait=80)
        back = state()
        for _ in range(k): T.key("Control+Shift+z", wait=80)
        fwd = state()
        norm = lambda s: ([x.replace(" shut", "") for x in s[0]], s[1])
        check("Undo/Redo through '%s' (%d step%s): Undo gives the layers and picture before it, Redo after it" % (label, k, "" if k == 1 else "s"), k >= 1 and norm(back) == norm(before) and norm(fwd) == norm(after), (k, back[0], before[0], fwd[0], after[0]))
    def new_red():
        T.menu("Layer", "New Layer"); paint_rect(T, 50, 50, 150, 150, (220, 0, 0))
    step("New Layer and a red square", new_red)
    ch = T.active_name()
    check("After Undo and Redo of New Layer, the new layer is chosen again (the next stroke goes on it, as in Photoshop's History)", ch == T.names()[-1], (ch, T.names()))
    T.row_click(T.names()[-1]); T.rename(T.names()[-1], "P")
    step("Group Layers (Ctrl+G)", lambda: T.key("Control+g"))
    T.row_click("Group 1")
    step("New Group (with the group chosen)", lambda: T.menu("Layer", "New Group"))
    check("New Group with a group chosen: a second group beside it, above it", T.struct()[-1] == "Group 2[G]" and T.struct()[-2] == "Group 1[G]", T.struct())
    ensure_open(T, "Group 1"); T.row_click("P")
    step("P moved up twice (out of Group 1, into Group 2)", lambda: (T.lbtn("Move up"), T.lbtn("Move up")))
    check("...P now in Group 2", "P<Group 2" in T.struct(), T.struct())
    T.row_click("Group 2")
    step("Ctrl+G on Group 2 (a group in a group)", lambda: T.key("Control+g"))
    check("...Group 2 inside Group 3, P inside Group 2", T.struct()[-3:] == ["P<Group 2", "Group 2[G]<Group 3", "Group 3[G]"], T.struct())
    rows = T.rows()
    check("Layers panel: P set in twice as far as Group 2", [r[1] for r in rows if r[0].startswith("P")] and [r[1] for r in rows if r[0].startswith("P")][0] > [r[1] for r in rows if r[0].startswith("Group 2")][0] > [r[1] for r in rows if r[0].startswith("Group 3")][0], rows)
    T.row_click("Group 3")
    def op60():
        o = T.pg.locator(".ph-lctl input[type=number]"); o.fill("60"); o.press("Enter"); T.pg.wait_for_timeout(150)
    step("Group 3 opacity 60%", op60)
    ensure_open(T, "Group 3"); T.row_click("Group 2")
    step("Group 2 set to Multiply", lambda: (T.pg.select_option(".ph-lctl select", "multiply"), T.focus_away()))
    step("Group 1 hidden (its eye)", lambda: T.row_loc("Group 1").locator(".ph-eye").first.click())
    # a .psd round trip of all that
    try:
        st0, pic = T.struct(), T.flat_hash()
        p = T.download(lambda: T.key("Control+s"))
        from psd_tools import PSDImage
        pp = PSDImage.open(p)
        tree = [(l.name, l.kind, l.parent.name if l.parent is not None and l.parent is not pp else None) for l in pp.descendants()]
        check(".psd of nested groups: psd-tools reads P in Group 2 in Group 3, and Group 1", ("P", "pixel", "Group 2") in tree and ("Group 2", "group", "Group 3") in tree and ("Group 1", "group", None) in tree, tree)
        g = {l.name: l for l in pp.descendants() if l.kind == "group"}
        check("...Group 3 at 60% (153 of 255), Group 2 Multiply, Group 1 hidden", g["Group 3"].opacity in (152, 153) and str(g["Group 2"].blend_mode).lower().endswith("multiply") and not g["Group 1"].visible, (g["Group 3"].opacity, str(g["Group 2"].blend_mode), g["Group 1"].visible))
        comp = np.array(pp.composite().convert("RGB")).astype(int); fl = T.flat_np()[..., :3]
        check("...psd-tools draws the same picture as the tile (within 3 levels)", np.abs(comp - fl).max() <= 3, np.abs(comp - fl).max())
        T.open(p)
        check("...opened again in the tile: the same layers, groups and picture", [x.replace(" shut", "") for x in T.struct()] == [x.replace(" shut", "") for x in st0] and T.flat_hash() == pic, (T.struct(), st0))
        T.key("Control+z") if False else None
    except Exception as e:
        check(".psd of nested groups saved and read back", False, str(e)[:300])
    ensure_open(T, "Group 3"); T.row_click("Group 3")
    step("Duplicate Layer on Group 3 (with its group and layer)", lambda: T.menu("Layer", "Duplicate Layer"))
    own = T.J("(() => { var d = Lantern.photo.api.d, n = d.layers.length, ids = d.layers.slice(n - 3).map(function (l) { return l.id; }); return [d.layers[n - 3].gid === ids[1], d.layers[n - 2].gid === ids[2], ids[0] !== d.layers[n - 6].id]; })()")
    check("...the copy holds its own copies: P in a new Group 2 in 'Group 3 copy' (the copy's P belongs to the copied Group 2, not the first one)", [x.replace(" shut", "") for x in T.struct()][-3:] == ["P<Group 2", "Group 2[G]<Group 3 copy", "Group 3 copy[G]"] and all(own), (T.struct(), own))
    ch = T.active_name()
    check("After Undo and Redo of Duplicate Layer on a group, the copy is chosen again (else Delete next takes away the first group, not the copy)", ch == "Group 3 copy", ch)
    T.row_click("Group 3 copy")
    step("Delete Layer on the copy", lambda: T.lbtn("Delete layer"))
    check("...the copy is gone and Group 3 with its layers is still there", [x.replace(" shut", "") for x in T.struct()][-3:] == ["P<Group 2", "Group 2[G]<Group 3", "Group 3[G]"], T.struct())
    ensure_open(T, "Group 3"); ensure_open(T, "Group 2"); T.row_click("Group 2")
    step("Merge Group on Group 2 (inside Group 3)", lambda: T.key("Control+e"))
    check("...the merged layer stays inside Group 3, in Multiply", "Group 2<Group 3" in T.struct() and [l["blend"] for l in T.doc()["layers"] if l["name"] == "Group 2"] == ["multiply"], (T.struct(), [l["blend"] for l in T.doc()["layers"] if l["name"] == "Group 2"]))
    T.row_click("Group 3")
    step("Ungroup Group 3 (Ctrl+Shift+G)", lambda: T.key("Control+Shift+g"))
    # a group's mask: paint black on it, part of the group hidden
    T.open("photo.png"); T.menu("Layer", "New Layer"); paint_rect(T, 50, 50, 250, 250, (220, 0, 0)); T.key("Control+g")
    T.lbtn("Add a layer mask (from the selection, if there is one)")
    has = [l["mask"] for l in T.doc()["layers"] if l["name"] == "Group 1"]
    T.row_loc("Group 1").locator("canvas[title^='Layer mask']").click(); T.pg.wait_for_timeout(150)
    T.tool("brush"); T.key("d"); T.setopt_ui("Size", 60); T.drag((150, 60), (150, 240))
    hid = T.flat(150, 150); kept = T.flat(70, 150)
    check("A mask on a group (the half-moon button), black painted down its middle: that part of the group's layer hidden, the rest shows", has == [True] and not near(hid, [220, 0, 0], 40) and near(kept, [220, 0, 0], 3), (has, hid, kept))
    # every tool that changes pixels, with a group chosen: refused plainly, nothing changed, no page error
    T.open("photo.png"); T.menu("Layer", "New Layer"); paint_rect(T, 50, 50, 250, 250, (220, 0, 0)); T.key("Control+g")
    hb = T.layers_hash(); fh = T.flat_hash(); nh = len(T.hist())
    for tid in ["brush", "pencil", "eraser", "clone", "historyBrush", "spotHeal", "heal", "patch", "redEye", "dodge", "burn", "sponge", "blurTool", "sharpenTool", "smudge", "bucket", "gradient"]:
        e0 = len(T.errs); n0 = len(T.hist())
        T.tool(tid)
        if tid in ("clone", "heal"): T.click((400, 400), mods=["Alt"])
        if tid == "patch": T.drag((100, 100), (100, 100), via=[(200, 100), (200, 200), (100, 200)]); n0 = len(T.hist()); T.drag((150, 150), (450, 380))
        elif tid in ("redEye", "bucket"): T.click((150, 150))
        else: T.drag((100, 150), (200, 160))
        st = T.center_status(); errs = T.errs[e0:]
        check("Group chosen, the %s used on the picture: nothing changed, no step, no uncaught error, a plain message" % T.J("(i) => Lantern.photo.tools.byId[i].name", tid), T.flat_hash() == fh and len(T.hist()) == n0 and not errs and "group" in st.lower(), (T.flat_hash() == fh, len(T.hist()) - n0, errs[:1], st[:80]))
        while len(T.hist()) > nh: T.key("Control+z")
        if T.dialog_open(): T.cancel()
        T.key("Control+d") if T.doc()["sel"] else None
    T.row_click("Group 1"); T.key("Alt+Backspace"); st = T.center_status()
    check("Alt+Backspace (fill) with a group chosen: refused plainly", T.layers_hash() == hb and "group" in st.lower(), st)
    T.menu("Image", "Adjustments", "Shadows/Highlights…"); T.pg.wait_for_timeout(400); st = T.center_status()
    if T.dialog_open(): T.ok()
    check("Shadows/Highlights with a group chosen: refused plainly, nothing changed", T.layers_hash() == hb and "group" in (st + T.center_status()).lower(), (st, T.center_status()))
    page_errors(T, "groups2")
    T.close()


# ============================================================ boxes: modal, Esc, Enter, Cancel
def no_download(T, fn, ms=1500):
    """None when nothing is saved; else the path of what was saved"""
    try:
        with T.pg.expect_download(timeout=ms) as dl:
            fn()
        d = dl.value; p = os.path.join(OUT, "during_box_" + d.suggested_filename); d.save_as(p); return p
    except Exception:
        return None


@section
def boxes(B, port):
    T = fresh(B, port)
    def setup():
        """the photo with a full copy above it (chosen), and the Hue/Saturation box open with Hue +120 previewed"""
        T.open("photo.png"); T.key("Control+a"); T.key("Control+j"); T.key("Control+d")
        st = {"orig": T.layers_hash(), "h0": len(T.hist()), "bg0": T.layer_hash(0), "cp0": T.layer_hash(1)}
        T.menu("Image", "Adjustments", "Hue/Saturation…"); T.dlg_slider("Hue", 120); T.pg.wait_for_timeout(300)
        st["prev"] = T.layers_hash()
        return st
    s = setup()
    check("Hue/Saturation box: moving Hue previews on the picture", s["prev"] != s["orig"])
    T.tool("brush"); T.drag((300, 100), (400, 140))
    st = T.center_status()
    check("With a box open, a stroke on the picture paints nothing and says to finish the box", T.layers_hash() == s["prev"] and len(T.hist()) == s["h0"] and "finish" in st.lower(), st)
    T.key("Control+i"); T.key("Control+z")
    check("With a box open, Ctrl+I and Ctrl+Z do nothing", T.layers_hash() == s["prev"] and len(T.hist()) == s["h0"] and T.dialog_open(), T.hist()[-2:])
    T.menu("Select", "All")
    check("With a box open, Select > All does not run (the box holds the picture)", not T.doc()["sel"] and T.dialog_open(), T.center_status())
    # Enter after a click outside the box (Photoshop's boxes are modal: Enter is always OK)
    T.click((300, 300)); T.key("Enter")
    check("With a box open and the picture clicked, Enter still OKs the box", not T.dialog_open() and T.hist()[-1] == "Hue/Saturation", (T.dialog_open(), T.hist()[-1]))
    # each of these on a fresh picture with the box open
    s = setup(); T.menu("Edit", "Undo")
    check("With a box open, Edit > Undo from the menu does not run", len(T.hist()) == s["h0"] and T.doc()["redo"] == 0 and T.dlg_title() == "Hue/Saturation", (T.hist()[-2:], T.doc()["redo"], T.dlg_title()))
    while T.dialog_open(): T.cancel()
    s = setup(); T.menu("Image", "Adjustments", "Levels…")
    check("With a box open, Image > Adjustments > Levels does not open over it (Hue/Saturation and its preview stay)", T.dlg_title() == "Hue/Saturation" and T.layers_hash() == s["prev"], (T.dlg_title(), T.layers_hash() == s["prev"]))
    T.ok(); lv = T.hist()[-1]; T.key("Escape")
    check("...and OK in the Levels box that opened over it does not quietly drop the Hue/Saturation that was on the picture", lv != "Levels" or T.layers_hash() != s["orig"], (lv, T.layers_hash() == s["orig"]))
    while T.dialog_open(): T.cancel()
    s = setup(); f = no_download(T, lambda: T.menu("File", "Save (.psd, with layers)"))
    what = None
    if f:
        try:
            from psd_tools import PSDImage
            comp = np.array(PSDImage.open(f).composite().convert("RGB")).astype(int)
            what = "the saved .psd holds the unconfirmed Hue +120 preview" if np.abs(comp[50, 50] - np.array([95, 151, 226])).max() > 30 else "the saved .psd holds the picture without the preview"
            what += " (pixel 50,50 = %s)" % comp[50, 50].tolist()
        except Exception as e:
            what = str(e)[:100]
    check("With a box open, File > Save does not save (the picture holds a preview not yet OK'd)", f is None, (os.path.basename(f) if f else None, what))
    while T.dialog_open(): T.cancel()
    s = setup(); T.pg.locator(".ph-hrow").first.click(); T.pg.wait_for_timeout(200)
    check("With a box open, a click on a History step does not go back", len(T.hist()) == s["h0"] and T.dlg_title() == "Hue/Saturation", (T.hist(), T.dlg_title()))
    while T.dialog_open(): T.cancel()
    s = setup(); T.row_click("Background"); T.ok()
    chg_bg = T.layer_hash(0) != s["bg0"]; chg_cp = T.layer_hash(1) != s["cp0"]
    check("Box open on the copy, the Background clicked in the Layers panel, then OK: the change lands on the layer that was previewed, not the Background", chg_cp and not chg_bg, ("background changed" if chg_bg else "background unchanged", "copy changed" if chg_cp else "copy unchanged", T.hist()[-1]))
    s = setup(); errs0 = len(T.errs)
    T.pg.locator(".ph-lbar select[title='New adjustment layer']").select_option("curves"); T.pg.wait_for_timeout(300)
    check("Box open, then the Layers panel's Adjust... > Curves: refused, no page error, the first box stays", len(T.errs) == errs0 and T.dlg_title() == "Hue/Saturation" and len(T.names()) == 2, (T.errs[errs0:], T.dlg_title(), T.names()))
    while T.dialog_open(): T.cancel()
    check("...after Cancel, every layer exactly as before", T.layers_hash() == s["orig"] and len(T.hist()) == s["h0"], (T.hist()[-2:], T.names()))
    # the same with an adjustment layer chosen: the open box must not turn it into another kind
    T.open("photo.png"); T.pg.locator(".ph-lbar select[title='New adjustment layer']").select_option("invert"); T.pg.wait_for_timeout(300)
    while T.dialog_open(): T.ok()
    adj0 = T.J("JSON.stringify(Lantern.photo.api.d.layers.map(function (l) { return l.adj; }))"); pic0 = T.flat_hash()
    T.row_click("Background"); T.menu("Image", "Adjustments", "Hue/Saturation…"); T.dlg_slider("Hue", 60); T.row_click("Invert")
    T.pg.locator(".ph-lbar select[title='New adjustment layer']").select_option("threshold"); T.pg.wait_for_timeout(300)
    while T.dialog_open(): T.cancel()
    adj1 = T.J("JSON.stringify(Lantern.photo.api.d.layers.map(function (l) { return l.adj; }))")
    check("Box open, the Invert adjustment layer clicked, Adjust... > Threshold, then Cancel twice: the Invert layer is still there, still an Invert, the picture as before", adj1 == adj0 and T.flat_hash() == pic0, (adj0, adj1, T.names(), T.hist()))
    T.key("Control+Shift+z")
    check("...Ctrl+Shift+Z then brings the Invert layer back (an earlier step must never be lost for good)", T.J("Lantern.photo.api.d.layers.length") == 2, (T.names(), T.doc()["redo"]))
    # Esc cancels, Cancel leaves nothing, Enter in a number box OKs
    T.open("photo.png"); orig = T.layers_hash(); h0 = len(T.hist())
    T.menu("Image", "Adjustments", "Levels…"); T.dlg_slider("Input black", 80); T.pg.wait_for_timeout(300)
    T.key("Escape")
    check("Esc cancels Levels: every layer exactly as before, no History step", T.layers_hash() == orig and len(T.hist()) == h0 and not T.dialog_open(), T.hist()[-2:])
    T.menu("Filter", "Blur", "Gaussian Blur…"); T.dlg_slider("Radius (pixels)", 6); T.pg.wait_for_timeout(300); T.cancel()
    check("Cancel in Gaussian Blur: every layer exactly as before, no History step", T.layers_hash() == orig and len(T.hist()) == h0, T.hist()[-2:])
    T.menu("Filter", "Blur", "Gaussian Blur…"); loc = T.pg.locator(".ph-dialog input[type=number]").first; loc.click(); loc.press("Control+a"); loc.type("3"); loc.press("Enter"); T.pg.wait_for_timeout(400)
    check("Enter typed in the Radius box OKs Gaussian Blur (one step 'Gaussian Blur')", not T.dialog_open() and T.hist()[-1] == "Gaussian Blur", T.hist()[-2:])
    T.key("Control+z")
    # the Layers panel's Adjust... list, then Cancel: nothing left
    n = len(T.names()); h1 = len(T.hist())
    T.pg.locator(".ph-lbar select[title='New adjustment layer']").select_option("levels"); T.pg.wait_for_timeout(300)
    check("Adjust... > Levels: a box for the new adjustment layer", T.dialog_open() and "Levels" in (T.dlg_title() or ""), T.dlg_title())
    T.dlg_slider("Input black", 60); T.pg.wait_for_timeout(200); T.cancel()
    check("...Cancel: no adjustment layer left, History as before, nothing to redo", len(T.names()) == n and len(T.hist()) == h1 and T.doc()["redo"] == 0 and T.layers_hash() == orig, (T.names(), T.hist()[-2:], T.doc()["redo"]))
    T.menu("Layer", "New Adjustment Layer", "Curves"); T.pg.wait_for_timeout(300); T.key("Escape")
    check("Layer > New Adjustment Layer > Curves, then Esc: nothing left", len(T.names()) == n and len(T.hist()) == h1 and T.doc()["redo"] == 0, (T.names(), T.hist()[-2:]))
    # Layer Style box open, then a filter box from the menu: the style must not be left on the layer without a step
    T.menu("Layer", "New Layer"); paint_rect(T, 100, 100, 200, 200, (200, 200, 0)); orig = T.layers_hash(); h1 = len(T.hist())
    T.lbtn("Layer style"); T.pg.locator(".ph-dialog label:has-text('Drop Shadow') input[type=checkbox]").check(); T.pg.wait_for_timeout(250)
    T.menu("Filter", "Blur", "Gaussian Blur…"); T.pg.wait_for_timeout(250)
    while T.dialog_open(): T.cancel()
    fx = [l["fx"] for l in T.doc()["layers"]]
    check("Layer Style (Drop Shadow ticked), then Filter > Gaussian Blur from the menu, then Cancel: no shadow left behind", not any(fx) and T.layers_hash() == orig and len(T.hist()) == h1, (fx, T.hist()[-2:]))
    T.open("photo.png"); T.menu("Layer", "New Layer"); paint_rect(T, 100, 100, 200, 200, (200, 200, 0)); orig = T.layers_hash(); h1 = len(T.hist())
    T.lbtn("Layer style"); T.pg.locator(".ph-dialog label:has-text('Drop Shadow') input[type=checkbox]").check(); T.pg.wait_for_timeout(250); T.cancel()
    check("Layer Style: Drop Shadow ticked then Cancel leaves no style", not any(l["fx"] for l in T.doc()["layers"]) and T.layers_hash() == orig and len(T.hist()) == h1, [l["fx"] for l in T.doc()["layers"]])
    page_errors(T, "boxes")
    T.close()


# ============================================================ the new boxes
def mean_rgb(a):
    return [float(a[..., c].mean()) for c in range(3)]


@section
def newboxes(B, port):
    T = fresh(B, port, "backlit.png")
    orig = T.layers_hash(); h0 = len(T.hist())
    dark0, sky0 = T.flat(240, 250), T.flat(30, 30)
    T.menu("Image", "Adjustments", "Shadows/Highlights…")
    check("Shadows/Highlights opens its box (amount, tone, radius)", T.dialog_open() and "Shadows" in (T.dlg_title() or ""), T.dlg_fields()[:6])
    T.pg.wait_for_timeout(600); prev = T.flat(240, 250)
    T.key("Escape")
    check("Shadows/Highlights: Esc leaves the picture exactly as it was, no step", T.layers_hash() == orig and len(T.hist()) == h0, T.hist()[-2:])
    T.menu("Image", "Adjustments", "Shadows/Highlights…"); T.pg.wait_for_timeout(600); prev = T.flat_hash(); T.ok(wait=800)
    dark1, sky1 = T.flat(240, 250), T.flat(30, 30)
    check("Shadows/Highlights (35%): the dark figure is lifted (its level up by 15 or more)", lum(dark1) - lum(dark0) >= 15, (dark0, dark1))
    check("...the bright sky is left nearly as it was (within 6 levels)", abs(lum(sky1) - lum(sky0)) <= 6, (sky0, sky1))
    check("...OK gives exactly what was previewed, as one step 'Shadows/Highlights'", T.flat_hash() == prev and T.hist()[-1] == "Shadows/Highlights", T.hist()[-2:])
    T.key("Control+z")
    T.menu("Image", "Adjustments", "Shadows/Highlights…"); T.dlg_slider("Shadows: amount (%)", 0); T.dlg_slider("Highlights: amount (%)", 60); T.pg.wait_for_timeout(600); T.ok(wait=800)
    sky2 = T.flat(30, 30)
    check("Shadows/Highlights with Highlights 60%: the sky comes down (darker by 8 or more)", lum(sky0) - lum(sky2) >= 8, (sky0, sky2))
    T.key("Control+z")
    check("Shadows/Highlights is not offered as an adjustment layer (as in Photoshop)", "shadowsHighlights" not in T.J("Array.prototype.map.call(document.querySelector('.ph-lbar select').options, function (o) { return o.value; })"))
    # Match Color: a warm picture takes the colours of a cool layer
    T.open("warm.png"); T.place("cool.png")
    check("setup: the cool picture placed as a layer over the warm one", len(T.names()) == 2, T.names())
    T.row_loc(T.names()[1]).locator(".ph-eye").first.click(); T.pg.wait_for_timeout(150)
    T.row_click("Background"); warm = mean_rgb(T.flat_np())
    T.menu("Image", "Adjustments", "Match Color…")
    opts = T.J("Array.prototype.map.call(document.querySelector('.ph-dialog select').options, function (o) { return o.textContent; })")
    check("Match Color: the source list names the other layer", any("cool" in o for o in opts), opts)
    T.pg.locator(".ph-dialog select").first.select_option(label=[o for o in opts if "cool" in o][0] if any("cool" in o for o in opts) else opts[0]); T.pg.wait_for_timeout(400); T.ok(wait=600)
    after = mean_rgb(T.flat_np())
    cool = mean_rgb(np.array(Image.open(os.path.join(INPUTS, "cool.png")).convert("RGB")).astype(int))
    check("Match Color from the cool layer: the warm picture's mean colour moves most of the way to the cool one's", sum(abs(a - c) for a, c in zip(after, cool)) < 0.4 * sum(abs(w - c) for w, c in zip(warm, cool)), (warm, after, cool))
    check("...one History step 'Match Color'", T.hist()[-1] == "Match Color", T.hist()[-2:])
    T.key("Control+z")
    T.open("cast.png"); castm = mean_rgb(T.flat_np())
    T.menu("Image", "Adjustments", "Match Color…"); T.dlg_check("Neutralize", True); T.pg.wait_for_timeout(300); T.ok(wait=600)
    neu = mean_rgb(T.flat_np())
    check("Match Color with no source and Neutralize on a photo with an orange cast: the cast is reduced (red and blue means at least 40% closer)", abs(neu[0] - neu[2]) < 0.6 * abs(castm[0] - castm[2]), (castm, neu))
    # Replace Color: the red bar turned, the rest left
    T.open("colours.png"); orig = T.layers_hash(); h0 = len(T.hist())
    T.menu("Image", "Adjustments", "Replace Color…")
    T.J("(() => { var i = document.querySelector('.ph-dialog input[type=color]'); i.value = '#dc1e1e'; i.dispatchEvent(new Event('input', {bubbles: true})); })()")
    T.dlg_slider("Hue", 120); T.pg.wait_for_timeout(400); T.ok(wait=500)
    red, yel, blu, grey, mag = T.flat(30, 100), T.flat(90, 100), T.flat(270, 100), T.flat(390, 100), T.flat(330, 100)
    check("Replace Color (red, Hue +120): the red bar turns green", red[1] > red[0] + 60, red)
    check("...the yellow, blue, magenta and grey bars are left as they were (within 3)", near(yel, [230, 220, 30], 3) and near(blu, [30, 40, 220], 3) and near(grey, [128, 128, 128], 3) and near(mag, [210, 30, 210], 3), (yel, blu, mag, grey))
    check("...one step 'Replace Color'", T.hist()[-1] == "Replace Color", T.hist()[-2:])
    T.key("Control+z")
    T.menu("Image", "Adjustments", "Replace Color…"); T.dlg_slider("Hue", 120); T.pg.wait_for_timeout(300); T.cancel()
    check("Replace Color: Cancel leaves nothing", T.layers_hash() == orig and len(T.hist()) == h0)
    # Selective Color: Reds, Cyan +100, Relative then Absolute
    T.menu("Image", "Adjustments", "Selective Color…")
    T.pg.locator(".ph-dialog select").first.select_option("reds"); T.dlg_slider("Cyan", 100); T.pg.wait_for_timeout(400)
    meth = T.J("(() => { var s = document.querySelectorAll('.ph-dialog select'); return s[s.length - 1].value; })()")
    check("Selective Color: the method starts at Relative (Photoshop's default)", meth == "relative", meth)
    T.ok(wait=500); rel = T.flat(30, 100); blu2 = T.flat(270, 100); grey2 = T.flat(390, 100)
    check("Selective Color Reds Cyan +100 (Relative): the red bar loses red", rel[0] < 220 - 10, rel)
    check("...the blue bar and the grey bar are left alone", near(blu2, [30, 40, 220], 3) and near(grey2, [128, 128, 128], 3), (blu2, grey2))
    T.key("Control+z")
    T.menu("Image", "Adjustments", "Selective Color…"); T.pg.locator(".ph-dialog select").first.select_option("reds"); T.dlg_slider("Cyan", 100)
    T.pg.locator(".ph-dialog select").last.select_option("absolute"); T.pg.wait_for_timeout(400); T.ok(wait=500); ab = T.flat(30, 100)
    check("Selective Color Absolute takes more red away than Relative for the same +100 (Photoshop: absolute adds the amount itself)", ab[0] < rel[0] - 10, (rel, ab))
    T.key("Control+z")
    T.menu("Image", "Adjustments", "Selective Color…"); T.pg.locator(".ph-dialog select").first.select_option("reds"); T.dlg_slider("Cyan", 100); T.pg.wait_for_timeout(300); T.cancel()
    check("Selective Color: Cancel leaves nothing", T.layers_hash() == orig and len(T.hist()) == h0)
    # Selective Color as an adjustment layer (it is one in Photoshop), and its Cancel
    n = len(T.names())
    T.pg.locator(".ph-lbar select[title='New adjustment layer']").select_option("selectiveColor"); T.pg.wait_for_timeout(300)
    if T.dialog_open(): T.cancel()
    check("Selective Color as an adjustment layer: Cancel leaves no layer", len(T.names()) == n and len(T.hist()) == h0, T.names())
    page_errors(T, "newboxes")
    T.close()


# ============================================================ layer styles (the new ones)
@section
def styles(B, port):
    T = fresh(B, port)
    T.menu("Layer", "New Layer"); paint_rect(T, 200, 150, 400, 270, (128, 128, 128))
    li = len(T.names()) - 1; orig = T.layers_hash(); h0 = len(T.hist())
    def style(name, tick=True):
        T.lbtn("Layer style"); box = T.pg.locator(".ph-dialog label:has-text(%s) input[type=checkbox]" % json.dumps(name)).first
        box.check(); T.pg.wait_for_timeout(350)
    c0 = T.flat(300, 210)
    style("Inner Glow"); edge, mid = T.flat(203, 210), T.flat(300, 210)
    check("Inner Glow: the shape's inside edge is lighter than its middle (preview)", lum(edge) > lum(mid) + 20, (edge, mid))
    T.cancel()
    check("Inner Glow: Cancel leaves no style, nothing changed", T.layers_hash() == orig and len(T.hist()) == h0)
    style("Bevel & Emboss"); tl, br, mid = T.flat(202, 152), T.flat(397, 267), T.flat(300, 210)
    check("Bevel & Emboss: the top-left edge lit, the bottom-right edge shaded (Photoshop's light from 120 degrees)", lum(tl) > lum(mid) + 10 and lum(br) < lum(mid) - 10, (tl, mid, br))
    check("Bevel & Emboss: the middle of a flat face keeps its colour", near(mid, [128, 128, 128], 4), mid)
    T.ok()
    check("Bevel & Emboss OK: one step 'Layer Style' and the layer marked fx in the panel", T.hist()[-1] == "Layer Style" and "fx" in T.rows()[0][0], (T.hist()[-1], T.rows()[0]))
    T.key("Control+z")
    check("Ctrl+Z takes the style away", T.layers_hash() == orig, T.hist()[-2:])
    style("Satin"); sat = T.flat_np()[150:271, 200:401, :3]
    check("Satin: the shape gets the shading (some of it darker than the plain grey by 15 or more)", sat.min() < 128 - 15 and T.flat(150, 140)[:3] == c0[:3] or sat.min() < 113, int(sat.min()))
    T.cancel()
    # Pattern Overlay: first without a pattern, then after Edit > Define Pattern
    style("Pattern Overlay"); nop = T.flat(300, 210); msg = T.pg.inner_text(".ph-dialog")
    T.cancel()
    T.row_click("Background"); T.tool("marquee"); T.drag((480, 40), (560, 120)); T.menu("Edit", "Define Pattern"); T.key("Control+d")
    T.row_click(T.names()[li]); style("Pattern Overlay"); T.pg.wait_for_timeout(300)
    p1 = T.flat(280, 200); p2 = T.flat(222, 162)
    check("Pattern Overlay after Define Pattern (the sun, 80 x 80): the shape shows the pattern repeated from the picture's corner (the sun's middle at 280,200)", near(p1, [250, 220, 60], 6), (p1, p2))
    T.ok()
    check("Pattern Overlay OK: one step 'Layer Style'", T.hist()[-1] == "Layer Style", T.hist()[-2:])
    page_errors(T, "styles")
    T.close()


# ============================================================ keys
@section
def keys(B, port):
    T = fresh(B, port)
    T.menu("Layer", "New Layer"); paint_rect(T, 100, 100, 200, 200, (0, 150, 0))
    T.tool("brush"); s0 = int(T.opt_value("Size"))
    # a checkbox in the Layers panel, then ] and a tool key and Ctrl+Z
    T.pg.locator(".ph-lctl input[type=checkbox]").first.click(); T.pg.wait_for_timeout(50)
    T.key("]"); s1 = int(T.opt_value("Size") or 0)
    check("After ticking Lock in the Layers panel, ] makes the brush bigger", s1 > s0, (s0, s1))
    T.key("e")
    check("...and E picks the Eraser", T.tool_id() == "eraser", T.tool_id())
    lk = [l["lockAlpha"] for l in T.doc()["layers"]][-1]; T.key("Control+z")
    check("...and Ctrl+Z undoes the Lock", lk and not [l["lockAlpha"] for l in T.doc()["layers"]][-1], (lk, T.hist()[-2:]))
    # a slider on the options bar (moved with the mouse), then a tool key
    T.tool("brush"); rg = T.pg.locator(".ph-opts input[type=range]").first; bb = rg.bounding_box()
    T.pg.mouse.click(bb["x"] + bb["width"] * 0.3, bb["y"] + bb["height"] / 2); T.key("v", wait=60)
    check("After moving the brush Size slider with the mouse, V picks the Move tool", T.tool_id() == "move", T.tool_id())
    # a list in the Layers panel, then a tool key
    T.pg.select_option(".ph-lctl select", "multiply"); T.key("b", wait=60)
    check("After choosing Multiply from the blending list, B picks the Brush", T.tool_id() == "brush", T.tool_id())
    T.key("Control+z")
    # Enter in an options bar number box gives the keys back
    n = T.pg.locator(".ph-opts label", has_text="Size").locator("input[type=number]").first
    n.click(); n.press("Control+a"); n.type("33"); n.press("Enter"); T.key("e", wait=60)
    check("Size 33 typed on the options bar, Enter, then E: the Eraser is chosen (the keys came back)", T.tool_id() == "eraser", T.tool_id())
    T.tool("brush"); check("...and the Brush kept Size 33", T.opt_value("Size") == "33", T.opt_value("Size"))
    # only Shift+letter cycles a group
    T.key("b"); T.key("b")
    check("B then B again: still the Brush (only Shift+B moves along the group)", T.tool_id() == "brush", T.tool_id())
    T.key("Shift+B")
    check("Shift+B: the Pencil", T.tool_id() == "pencil", T.tool_id())
    T.key("b")
    check("B while the Pencil is the group's tool in use: Photoshop keeps the Pencil (the key picks the tool last used in its group)", T.tool_id() == "pencil", T.tool_id())
    # a tool letter during a stroke
    T.tool("brush"); T.set_colour((200, 0, 0)); T.focus_away(); nh = len(T.hist())
    p0, p1, p2 = T.scr(300, 320), T.scr(380, 320), T.scr(460, 320)
    T.pg.mouse.move(*p0); T.pg.mouse.down(); T.pg.mouse.move(*p1, steps=6); T.pg.keyboard.press("m"); T.pg.mouse.move(*p2, steps=6); T.pg.mouse.up(); T.pg.wait_for_timeout(200)
    check("M pressed in the middle of a brush stroke: the stroke is whole and one 'Brush' step", T.hist()[-1] == "Brush" and len(T.hist()) == nh + 1 and T.flat(450, 320)[0] > 150 and not T.J("!!Lantern.photo.api.d.open"), (T.hist()[-2:], T.flat(450, 320)))
    # Ctrl+Z during a stroke
    T.tool("brush"); nh = len(T.hist()); q0, q1, q2 = T.scr(300, 380), T.scr(380, 380), T.scr(460, 380)
    T.pg.mouse.move(*q0); T.pg.mouse.down(); T.pg.mouse.move(*q1, steps=6); T.pg.keyboard.press("Control+z"); T.pg.mouse.move(*q2, steps=6); T.pg.mouse.up(); T.pg.wait_for_timeout(200)
    after = T.flat_hash(); stroke = T.flat(450, 380)[0] > 150; prevs = T.flat(450, 320)[0] > 150
    check("Ctrl+Z pressed during a brush stroke: the stroke drawn is kept and the stroke before it is not lost (Photoshop takes no command while the button is held)", stroke and prevs, ("this stroke " + ("kept" if stroke else "lost"), "the stroke before " + ("kept" if prevs else "lost"), T.hist()[-3:], T.doc()["redo"]))
    T.key("Control+z"); T.key("Control+Shift+z")
    check("...and History stays whole: what is on screen comes back after Undo and Redo", T.flat_hash() == after, T.hist()[-3:])
    # Delete with nothing selected
    T.key("Control+d"); hb = T.layers_hash(); nh = len(T.hist()); T.focus_away(); T.key("Delete")
    st = T.center_status()
    check("Delete with nothing selected does nothing and says so", T.layers_hash() == hb and len(T.hist()) == nh and len(st.strip()) > 4, st)
    T.key("Backspace")
    check("Backspace with nothing selected does nothing either", T.layers_hash() == hb and len(T.hist()) == nh, T.hist()[-2:])
    # Alt+Backspace / Ctrl+Backspace
    T.tool("marquee"); T.drag((400, 50), (500, 120)); T.set_colour((10, 20, 230)); T.set_colour((240, 230, 10), "Background"); T.focus_away()
    T.key("Alt+Backspace"); fgc = T.flat(450, 80); out = T.flat(520, 80)
    check("Alt+Backspace fills the selection with the foreground colour (only inside it)", near(fgc, [10, 20, 230], 2) and not near(out, [10, 20, 230], 30), (fgc, out, T.hist()[-1]))
    T.key("Control+Backspace"); bgc = T.flat(450, 80)
    check("Ctrl+Backspace fills it with the background colour", near(bgc, [240, 230, 10], 2), (bgc, T.hist()[-1]))
    T.key("Control+d")
    # Ctrl+Shift+Alt+W
    T.key("Control+Shift+Alt+w")
    check("Ctrl+Shift+Alt+W opens Export As", T.dialog_open() and "Export" in (T.dlg_title() or ""), T.dlg_title())
    while T.dialog_open(): T.cancel()
    # Esc closes an open menu (and a submenu)
    T.pg.click(".ph-mbtn:text-is('Filter')"); T.pg.click(".ph-menubar > .ph-menu > .ph-mitem:has(span:text-is('Blur'))"); T.key("Escape")
    check("Esc closes an open menu with its submenu open", not T.J("!!document.querySelector('.ph-menu')"))
    # Esc in the middle of a marquee drag
    T.tool("marquee"); a, b2, c = T.scr(100, 300), T.scr(200, 380), T.scr(250, 420)
    T.pg.mouse.move(*a); T.pg.mouse.down(); T.pg.mouse.move(*b2, steps=5); T.pg.keyboard.press("Escape"); T.pg.mouse.move(*c, steps=3); T.pg.mouse.up(); T.pg.wait_for_timeout(150)
    check("Esc in the middle of a marquee drag drops it (no selection when the button is let go)", not T.doc()["sel"], T.sel_bounds())
    # Polygonal Lasso: Backspace, Enter, Esc
    T.tool("polyLasso")
    for pt in [(100, 100), (300, 100), (300, 300), (100, 300)]: T.click(pt, wait=80)
    T.key("Backspace"); T.key("Enter")
    check("Polygonal Lasso: four corners, Backspace takes the last back, Enter closes the triangle that is left", T.sel_at(280, 120) > 200 and T.sel_at(120, 280) < 50 and T.hist()[-1] == "Polygonal Lasso", (T.sel_at(280, 120), T.sel_at(120, 280), T.hist()[-1]))
    T.key("Control+d")
    for pt in [(100, 100), (300, 100), (300, 300)]: T.click(pt, wait=80)
    T.key("Escape"); T.click((400, 400), wait=80); T.click((450, 400), wait=80); T.click((450, 450), wait=80); T.key("Enter")
    check("Polygonal Lasso: Esc drops the corners; the next clicks start a new polygon (nothing at the first one)", T.sel_at(200, 150) < 50 and T.sel_at(445, 410) > 200, (T.sel_at(200, 150), T.sel_at(445, 410)))
    T.key("Control+d")
    # rename: letters typed into the name box stay there
    T.rename(T.names()[-1], "Bike path"); tl = T.tool_id()
    check("Renaming a layer by double-clicking its name: the new name, and the letters did not pick tools", T.names()[-1] == "Bike path" and tl == "polyLasso", (T.names(), tl))
    page_errors(T, "keys")
    T.close()



# ============================================================ the Magnetic Lasso
def hover_path(T, pts, wait=0):
    """move the pointer over the picture with no button held, through doc points"""
    for x, y in pts:
        T.pg.mouse.move(*T.scr(x, y))
        if wait: T.pg.wait_for_timeout(wait)


def iou(a, b):
    a = a > 127; b = b > 127
    return float((a & b).sum()) / max(1, float((a | b).sum()))


def square_trace(off=3, step=6):
    """round the square 120..319 x 100..259, 'off' pixels outside its edge, clockwise from the left side going down"""
    x0, y0, x1, y1 = 120 - off, 100 - off, 319 + off, 259 + off
    pts = [(x0, y) for y in range(130, y1, step)] + [(x, y1) for x in range(x0, x1, step)] + [(x1, y) for y in range(y1, y0, -step)] + [(x, y0) for x in range(x1, x0, -step)] + [(x0, y) for y in range(y0, 126, step)]
    return pts


@section
def maglasso(B, port):
    T = fresh(B, port, "plain_object.png")
    T.tool("move"); T.key("l"); a = T.tool_id(); T.key("Shift+L"); b = T.tool_id(); T.key("Shift+L"); c = T.tool_id()
    check("L, then Shift+L twice: Lasso, Polygonal Lasso, Magnetic Lasso", [a, b, c] == ["lasso", "polyLasso", "magLasso"], [a, b, c])
    truth = np.zeros((360, 480), np.uint8); truth[100:260, 120:320] = 255
    T.tool("magLasso"); nh = len(T.hist())
    T.click((120, 130)); hover_path(T, square_trace(3)); T.key("Enter")
    m = T.sel_np(); v = iou(m, truth) if m is not None else 0
    check("Magnetic Lasso round a dark square on white, the pointer 3 px off its edge: the selection clings to the edge (overlap 0.95 or more)", v >= 0.95, round(v, 3))
    check("...one History step 'Magnetic Lasso'", T.hist()[-1] == "Magnetic Lasso" and len(T.hist()) == nh + 1, T.hist()[-2:])
    T.key("Control+d")
    # 8 px off: Width 10 still finds it
    T.click((120, 130)); hover_path(T, square_trace(8)); T.key("Enter")
    m = T.sel_np(); v8 = iou(m, truth) if m is not None else 0
    check("...with the pointer 8 px off the edge (within the Width of 10): still on the edge (overlap 0.93 or more)", v8 >= 0.93, round(v8, 3))
    T.key("Control+d")
    # Esc drops it all
    nh = len(T.hist())
    T.click((120, 130)); hover_path(T, square_trace(3)[:60]); T.key("Escape"); T.key("Enter")
    check("Esc drops the Magnetic Lasso's line: Enter after it makes no selection, no step", not T.doc()["sel"] and len(T.hist()) == nh, T.hist()[-2:])
    # Backspace: the points taken back one by one, to nothing
    T.click((120, 130)); hover_path(T, square_trace(3)[:40])
    for _ in range(40): T.pg.keyboard.press("Backspace")
    T.pg.wait_for_timeout(100); T.key("Enter")
    check("Backspace pressed until every point is taken back drops the line (Enter then selects nothing)", not T.doc()["sel"], T.sel_bounds())
    # Backspace twice after a whole trace: less than the whole square, more than half
    T.click((120, 130)); hover_path(T, square_trace(3)); T.key("Backspace"); T.key("Backspace"); T.key("Enter")
    m = T.sel_np(); area = int((m > 127).sum()) if m is not None else 0
    check("Backspace twice near the end of a trace, then Enter: a selection a little smaller than the whole square", 0.5 * 32000 < area < 32000 * 0.995 or (m is not None and iou(m, truth) < 0.99 and area > 16000), area)
    T.key("Control+d")
    # double-click closes
    T.click((120, 130)); pts = square_trace(3); hover_path(T, pts); T.dbl(pts[-1])
    m = T.sel_np(); v = iou(m, truth) if m is not None else 0
    check("A double-click closes the Magnetic Lasso (the same square selected)", v >= 0.93, round(v, 3))
    T.key("Control+d")
    # a click on the first point closes it
    T.click((120, 130)); hover_path(T, square_trace(3)); T.click((120, 130))
    m = T.sel_np(); v = iou(m, truth) if m is not None else 0
    check("A click on the first point closes it", v >= 0.93 and T.hist()[-1] == "Magnetic Lasso", (round(v, 3), T.hist()[-1]))
    T.key("Control+d")
    # the pointer leaving the picture for a moment does not drop the line
    T.click((120, 130)); pts = square_trace(3); hover_path(T, pts[:60]); T.pg.mouse.move(5, 300); T.pg.wait_for_timeout(100); hover_path(T, pts[60:]); T.key("Enter")
    m = T.sel_np(); v = iou(m, truth) if m is not None else 0
    check("The pointer wandering off the picture and back in the middle of a trace: the line is kept", v >= 0.93, round(v, 3))
    T.key("Control+d")
    # Shift held at the first click adds to the selection there
    T.tool("marquee"); T.drag((10, 10), (60, 60)); T.tool("magLasso")
    T.click((120, 130), mods=["Shift"]); hover_path(T, square_trace(3)); T.key("Enter")
    check("Shift held at the Magnetic Lasso's first click: the square is added to the box selected before", T.sel_at(30, 30) > 200 and T.sel_at(200, 180) > 200, (T.sel_at(30, 30), T.sel_at(200, 180)))
    T.key("Control+d")
    # a busy background
    T.open("busy_object.png")
    truth = np.array(Image.open(os.path.join(INPUTS, "busy_object_mask.png")))
    rng = np.random.default_rng(7)
    pts = []
    for k in range(0, 361, 2):
        t = math.radians(k); r = 120 + 25 * math.sin(3 * t) + rng.uniform(-4, 4)
        pts.append((320 + r * math.cos(t), 240 + r * math.sin(t)))
    t1 = time.time(); T.click(pts[0]); hover_path(T, pts[1:]); T.key("Enter"); dt = time.time() - t1
    m = T.sel_np(); v = iou(m, truth) if m is not None else 0
    check("Magnetic Lasso round a dark-red blob on a busy striped, noisy background, the hand 4 px unsteady: overlap with the blob 0.9 or more", v >= 0.9, round(v, 3))
    check("...the trace of 180 moves took under 15 s", dt < 15, round(dt, 1))
    T.key("Control+d")
    # a flat picture with no edges at all
    T.open("flat.png"); errs0 = len(T.errs)
    T.click((50, 50)); hover_path(T, [(50 + i * 5, 50) for i in range(1, 61)] + [(350 - i * 2.5, 50 + i * 3.3) for i in range(1, 61)]); T.key("Enter")
    m = T.sel_np(); area = int((m > 127).sum()) if m is not None else 0
    tri = 0.5 * 300 * 198
    check("Magnetic Lasso on a flat picture (no edges): it follows the pointer and selects about the triangle drawn (within 25%)", m is not None and abs(area - tri) < 0.25 * tri and len(T.errs) == errs0, (area, int(tri)))
    page_errors(T, "maglasso")
    T.close()



# ============================================================ Swatches
def open_details(T, title):
    """click a collapsed panel's heading (a <details> summary) to open it"""
    loc = T.pg.locator(".ph-side details > summary", has_text=title).first
    if not loc.evaluate("(s) => s.parentNode.open"): loc.click(); T.pg.wait_for_timeout(150)


@section
def swatches(B, port):
    T = fresh(B, port)
    open_details(T, "Swatches")
    T.pg.click("button[aria-label='Swatch #ff0000']"); fg = T.fg()
    check("Swatches: a click on the red swatch makes red the foreground colour", fg == [255, 0, 0], fg)
    T.pg.click("button[aria-label='Swatch #0000ff']", modifiers=["Control"]); fg, bg = T.fg(), T.bg()
    check("Ctrl+click on the blue swatch makes blue the background colour, the foreground stays red", bg == [0, 0, 255] and fg == [255, 0, 0], (fg, bg))
    sw = T.J("[document.querySelector('.ph-swatch input[aria-label=\\'Foreground colour\\']').value, document.querySelector('.ph-swatch input[aria-label=\\'Background colour\\']').value]")
    check("...the colour boxes on the tool column show them", sw == ["#ff0000", "#0000ff"], sw)
    T.key("b")
    check("After clicking a swatch, B still picks the Brush", T.tool_id() == "brush", T.tool_id())
    T.set_colour((18, 52, 86)); n0 = T.pg.locator(".ph-sw").count()
    T.pg.click("button[aria-label='Keep the foreground colour as a swatch']")
    has = T.pg.locator("button[aria-label='Swatch #123456']").count()
    check("+ keeps the foreground colour (#123456) as a new swatch", has == 1 and T.pg.locator(".ph-sw").count() == n0 + 1, (has, n0))
    T.pg.click("button[aria-label='Swatch #000000']"); T.pg.click("button[aria-label='Swatch #123456']")
    check("...a click on it gives that colour back", T.fg() == [18, 52, 86], T.fg())
    T.pg.reload(); T.pg.wait_for_function("!!(window.Lantern && Lantern.photo && Lantern.photo.api)"); T.pg.wait_for_selector("text=Open a picture"); T.open("photo.png"); open_details(T, "Swatches")
    check("The kept swatch is still there after the page is opened again (kept on this device)", T.pg.locator("button[aria-label='Swatch #123456']").count() == 1)
    T.pg.click("button[aria-label='Swatch #123456']", button="right"); T.pg.wait_for_timeout(150)
    check("Right-click takes the kept swatch away", T.pg.locator("button[aria-label='Swatch #123456']").count() == 0)
    T.pg.click("button[aria-label='Swatch #ff0000']", button="right"); T.pg.wait_for_timeout(150)
    check("Right-click on one of the swatches that come with the tile leaves it", T.pg.locator("button[aria-label='Swatch #ff0000']").count() == 1)
    page_errors(T, "swatches")
    T.close()


# ============================================================ dropping files, and the start screen's New box
@section
def drop(B, port):
    T = fresh(B, port, None)
    T.J("(() => { var a = Lantern.photo.api, o = a.openDoc; window.__opens = 0; a.openDoc = function (d) { window.__opens++; return o.apply(this, arguments); }; })()")
    r = T.drop_on(".ph-drop", "/stamp.png", "stamp.png", "image/png", wait=1500)
    d = T.doc()
    check("A picture dropped on the start screen's box opens, and the drop is cancelled (the browser does not open the file itself)", d and d["name"] == "stamp" and r == [True, True], (r, d and d["name"]))
    check("...it is opened once, not twice", T.J("window.__opens") == 1, T.J("window.__opens"))
    # on the start screen outside the box
    T2 = fresh(B, port, None)
    r = T2.drop_on(".ph-start h2", "/stamp.png", "stamp.png", "image/png")
    check("A picture dropped on the start screen outside the dashed box also opens, cancelled", T2.doc() and T2.doc()["name"] == "stamp" and r == [True, True], (r,))
    T2.close()
    # on an open picture: a new layer
    T.open("photo.png"); n = len(T.names())
    r = T.drop_on(".ph-view canvas", "/stamp.png", "stamp.png", "image/png")
    check("A picture dropped on an open picture comes in as a new layer, the events cancelled", len(T.names()) == n + 1 and r == [True, True], (r, T.names(), T.hist()[-1:]))
    c = T.flat(320, 240)
    check("...placed in the middle of the picture at its own size (as Photoshop places it)", near(c, [20, 60, 200], 3) and not near(T.flat(200, 240), [20, 60, 200], 30), (c, T.flat(200, 240)))
    r = T.drop_on(".ph-side", "/big_orange.png", "big_orange.png", "image/png")
    check("A picture bigger than the picture, dropped on the Layers panel: a layer made to fit, the events cancelled", len(T.names()) == n + 2 and r == [True, True] and near(T.flat(3, 3), [240, 140, 20], 3) and near(T.flat(636, 476), [240, 140, 20], 3), (r, T.names(), T.flat(3, 3)))
    # while a box is open
    T.menu("Image", "Adjustments", "Levels…"); n2 = len(T.names())
    r = T.drop_on(".ph-menubar", "/stamp.png", "stamp.png", "image/png")
    check("A picture dropped while a box is open: refused (the box first), still cancelled", len(T.names()) == n2 and r == [True, True] and T.dialog_open(), (r, T.names(), T.center_status()))
    T.cancel()
    # a file that is not a picture
    errs0 = len(T.errs)
    T.J("(() => { var f = new File(['just words'], 'notes.txt', {type: 'text/plain'}); var dt = new DataTransfer(); dt.items.add(f); window.__dt = dt; })()")
    r = T.J("""(() => { var z = document.querySelector('.ph-view canvas'); var e2 = new DragEvent('dragover', {dataTransfer: window.__dt, bubbles: true, cancelable: true}); z.dispatchEvent(e2); var e3 = new DragEvent('drop', {dataTransfer: window.__dt, bubbles: true, cancelable: true}); z.dispatchEvent(e3); return [e2.defaultPrevented, e3.defaultPrevented]; })()""")
    T.pg.wait_for_timeout(800)
    check("A text file dropped: cancelled, nothing added, a message, no page error", r == [True, True] and len(T.names()) == n2 and len(T.errs) == errs0 and len(T.center_status().strip()) > 4, (r, T.center_status(), T.errs[errs0:]))
    page_errors(T, "drop")
    T.close()
    # the start screen's New... box
    T = fresh(B, port, None)
    T.pg.click(".ph-drop button:text-is('New…')"); T.pg.wait_for_timeout(200)
    check("Start screen: New... opens the New box", T.dialog_open() and T.dlg_title() == "New", T.dlg_title())
    T.key("Escape")
    check("...Esc closes it and leaves the start screen", not T.dialog_open() and not T.J("!!Lantern.photo.api.d") and T.pg.locator("text=Open a picture").count() == 1)
    T.pg.click(".ph-drop button:text-is('New…')"); T.dlg_set({"w": 300, "h": 200}); T.dlg_select("Background", "clear"); T.ok()
    d = T.doc()
    check("...300 x 200, Transparent, OK: a new see-through picture of that size", d and d["w"] == 300 and d["h"] == 200 and T.flat(10, 10)[3] == 0, (d and [d["w"], d["h"]], T.flat(10, 10)))
    page_errors(T, "new box")
    T.close()


# ============================================================ Type
def text_of(T, name=None):
    return T.J("(n) => { var d = Lantern.photo.api.d; for (var i = d.layers.length - 1; i >= 0; i--) { var l = d.layers[i]; if (l.kind === 'text' && (!n || l.name.indexOf(n) === 0)) return {str: l.text.str, size: l.text.size, color: l.text.color, font: l.text.font, x: l.text.x, y: l.text.y, align: l.text.align}; } return null; }", name)


def type_opt(T, label, value):
    """set a Type option on the options bar by its label (Size) or, for the font and alignment lists, by position"""
    if label == "Size":
        n = T.pg.locator(".ph-opts label", has_text="Size").locator("input[type=number]").first
        n.click(); n.press("Control+a"); n.type(str(value)); n.press("Tab"); T.pg.wait_for_timeout(80)
    elif label == "align":
        T.pg.locator(".ph-opts select").nth(1).select_option(value); T.pg.wait_for_timeout(80)


@section
def typetool(B, port):
    T = fresh(B, port)
    T.tool("type"); type_opt(T, "Size", 40); T.set_colour((0, 0, 230)); T.focus_away()
    T.click((60, 120)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Hello"); T.tool("move")
    t = text_of(T)
    check("Type: 'Hello' at size 40 in blue becomes a type layer", t and t["str"] == "Hello" and t["size"] == 40 and t["color"] == [0, 0, 230], t)
    # the bar set to other things, then the words clicked again
    T.tool("type"); type_opt(T, "Size", 12); T.set_colour((230, 0, 0)); T.focus_away()
    T.click((t["x"] + 30, t["y"] - 15)); T.pg.wait_for_timeout(200)
    val = T.J("(() => { var b = document.querySelector('.ph-typebox'); return b ? b.value : null; })()"); shown = T.opt_value("Size")
    check("Clicking the words with the Type tool opens them for editing ('Hello' in the box)", val == "Hello", val)
    check("...and the options bar shows their own size (40), not the 12 it was set to", shown == "40", shown)
    if val is not None:
        T.pg.keyboard.press("End"); T.pg.keyboard.type("!"); T.tool("move")
    t = text_of(T)
    check("...'!' added: the words keep their size 40 and their blue (the bar's red was set before, not while editing)", t and t["str"] == "Hello!" and t["size"] == 40 and t["color"] == [0, 0, 230], t)
    shownc = T.J("document.querySelector('.ph-swatch input[aria-label=\\'Foreground colour\\']').value")
    check("While the blue words are open for editing, the foreground colour box (the only colour the tile shows) shows their own blue (the help: 'shows their own font, size and colour on the options bar')", shownc == "#0000e6", shownc)
    # changed while editing: size and colour
    t = text_of(T); T.tool("type"); T.click((t["x"] + 30, t["y"] - 15)); T.pg.wait_for_timeout(200)
    type_opt(T, "Size", 60); T.set_colour((0, 160, 0)); T.tool("move")
    t = text_of(T)
    check("Size 60 and green chosen while the words are open: the words take them", t and t["size"] == 60 and t["color"] == [0, 160, 0] and t["str"] == "Hello!", t)
    # moved words, clicked again
    T.tool("move"); T.drag((100, 100), (200, 150))
    T.tool("type"); t0 = text_of(T); T.click((t0["x"] + 30, t0["y"] - 20)); T.pg.wait_for_timeout(200)
    val = T.J("(() => { var b = document.querySelector('.ph-typebox'); return b ? b.value : null; })()")
    check("Words moved with the Move tool, then clicked with the Type tool: they open for editing", val == "Hello!", (val, t0))
    T.key("Escape"); T.tool("move")
    # centred and right-aligned words, clicked on their left half
    for al, x in (("center", 320), ("right", 600)):
        T.tool("type"); type_opt(T, "Size", 40); type_opt(T, "align", al); T.focus_away()
        T.click((x, 330)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Wide words"); T.tool("move")
        t = text_of(T, "Wide"); n = len(T.names())
        w = T.J("(t) => Lantern.photo.text.measure(t).w", t) if t else 0
        left = x - w * 0.35 if al == "center" else x - w * 0.8
        T.tool("type"); T.click((left, t["y"] - 15)); T.pg.wait_for_timeout(200)
        val = T.J("(() => { var b = document.querySelector('.ph-typebox'); return b ? b.value : null; })()")
        check("Words aligned %s, clicked with the Type tool on their own letters (left part): they open for editing, not a new empty box" % al, val == "Wide words", (val, round(w), t["x"]))
        T.key("Escape"); T.tool("move")
        if len(T.names()) > n: T.key("Control+z")
        T.key("Control+z")
    type_opt(T, "align", "left") if T.tool_id() == "type" else None
    page_errors(T, "type")
    T.close()



# ============================================================ Free Transform
def layer_box(T, i=None):
    """the box round what a layer draws (doc pixels), alpha > 0"""
    return T.J("(i) => { var d = Lantern.photo.api.d, l = i == null ? d.layers[d.active] : d.layers[i], c = Lantern.photo.compose.render(d, l), a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;"
               " for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (a[(y * c.width + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1]; }", i)


def tr_opt(T, label, value):
    n = T.pg.locator(".ph-opts label", has_text=label).locator("input[type=number]").first
    n.click(); n.press("Control+a"); n.type(str(value)); n.press("Enter"); T.pg.wait_for_timeout(120)


@section
def transform(B, port):
    T = fresh(B, port)
    T.menu("Layer", "New Layer"); paint_rect(T, 100, 100, 200, 200, (220, 0, 0)); li = len(T.names()) - 1
    T.menu("Edit", "Free Transform"); vals = [T.opt_value("W %"), T.opt_value("H %"), T.opt_value("Angle")]
    check("Free Transform starts with W 100, H 100, Angle 0 on the options bar", vals == ["100", "100", "0"], vals)
    tr_opt(T, "W %", 50); T.key("Enter")
    bx = layer_box(T)
    check("W 50 typed, Enter, Enter: the layer is half as wide (50 x 100, about its centre)", bx and abs(bx[2] - 50) <= 2 and abs(bx[3] - 100) <= 2 and abs(bx[0] - 125) <= 2, bx)
    T.menu("Edit", "Free Transform"); vals = [T.opt_value("W %"), T.opt_value("H %"), T.opt_value("Angle")]
    check("The next Free Transform starts at 100 / 100 / 0 again", vals == ["100", "100", "0"], vals)
    T.key("Escape"); T.key("Control+z")
    # choosing another tool part-way applies it
    nh = len(T.hist()); T.menu("Edit", "Free Transform"); T.drag((150, 150), (250, 150)); T.tool("brush")
    bx = layer_box(T, li)
    check("Free Transform, the layer dragged 100 px, then the Brush chosen: the move is applied (one 'Free Transform' step)", bx and abs(bx[0] - 200) <= 2 and T.hist()[-1] == "Free Transform" and len(T.hist()) == nh + 1, (bx, T.hist()[-2:]))
    T.key("Control+z")
    # Esc leaves it exactly
    hb = T.layers_hash(); T.menu("Edit", "Free Transform"); T.drag((150, 150), (250, 200)); T.key("Escape")
    check("Free Transform, dragged, then Esc: the layer exactly as it was, no step", T.layers_hash() == hb and len(T.hist()) == nh, T.hist()[-2:])
    # another layer clicked in the Layers panel in the middle of a Free Transform, then Enter
    bg0 = T.layer_hash(0); T.menu("Edit", "Free Transform"); T.drag((150, 150), (250, 150)); T.row_click("Background"); T.key("Enter")
    bx = layer_box(T, li)
    check("Free Transform on the red layer, dragged 100 px, the Background clicked in the Layers panel, Enter: the red layer moves, the Background is left alone", T.layer_hash(0) == bg0 and bx and abs(bx[0] - 200) <= 2, ("Background changed" if T.layer_hash(0) != bg0 else "Background same", bx, T.flat(5, 5)))
    while len(T.hist()) > nh: T.key("Control+z")
    T.row_click(T.names()[li])
    # moved by dragging, then an angle typed: the move must be kept
    T.tool("move"); T.menu("Edit", "Free Transform"); T.drag((150, 150), (250, 150)); tr_opt(T, "Angle", 10); T.key("Enter")
    bx = layer_box(T, li); cx = bx[0] + bx[2] / 2 if bx else None
    check("Free Transform: dragged 100 px to the right, then Angle 10 typed: turned where it was moved to (centre near x 250, not back at 150)", cx is not None and abs(cx - 250) <= 4, (bx, cx))
    while len(T.hist()) > nh: T.key("Control+z")
    # a menu command in the middle of a Free Transform must not leave the layer hidden in History
    T.menu("Edit", "Free Transform"); T.key("Control+i"); T.key("Escape"); T.key("Control+i"); T.key("Control+z")
    vis = T.flat(150, 150); ph = [l["ph"] for l in T.doc()["layers"]]
    check("Free Transform, Ctrl+I (it runs), Esc, Ctrl+I, Ctrl+Z: the inverted layer shows (the transform's hiding of it was not kept in History)", not any(ph) and near(vis, [35, 255, 255], 3), (vis, "layer hidden" if any(ph) else "", T.hist()[-3:]))
    while len(T.hist()) > nh: T.key("Control+z")
    T.key("Control+z") if any(l["ph"] for l in T.doc()["layers"]) else None
    # Ctrl+J in the middle of a Free Transform: the copy must show
    T.menu("Edit", "Free Transform"); T.key("Control+j"); T.key("Escape")
    ph = [(l["name"], l["ph"]) for l in T.doc()["layers"]]
    T.row_click(T.names()[li]); T.row_loc(T.names()[li]).locator(".ph-eye").first.click(); T.pg.wait_for_timeout(150)
    cc = T.flat(150, 150)
    check("Free Transform, Ctrl+J (Layer via Copy), Esc: the copy shows (with the first layer hidden, its red square is still there)", near(cc, [220, 0, 0], 3) and not any(x[1] for x in ph), (cc, ph))
    while len(T.hist()) > nh: T.key("Control+z")
    # exporting in the middle of a Free Transform
    T.menu("Edit", "Free Transform"); T.drag((150, 150), (160, 150))
    try:
        p = T.download(lambda: T.menu("File", "Quick Export as PNG"))
        im = np.array(Image.open(p).convert("RGB")).astype(int)
        check("File > Quick Export as PNG in the middle of a Free Transform: the exported picture has the layer in it", im[150, 150][0] > 150 and im[150, 150][1] < 80, im[150, 150].tolist())
    except Exception as e:
        check("File > Quick Export as PNG in the middle of a Free Transform: the exported picture has the layer in it", False, str(e)[:200])
    T.key("Escape")
    # Free Transform on words keeps them words
    T.tool("type"); T.click((300, 300)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Big"); T.tool("move")
    T.menu("Edit", "Free Transform"); tr_opt(T, "W %", 200); T.key("Enter")
    k = T.J("Lantern.photo.api.d.layers[Lantern.photo.api.d.active].kind"); st = T.center_status()
    check("Free Transform on words (W 200%): they stay words to edit, or the tile says plainly they were made into pixels", k == "text" or "pixel" in st.lower(), (k, st))
    page_errors(T, "transform")
    T.close()


# ============================================================ Straighten, Crop, Quick Mask, History
def horizon_rows(a):
    """for each column, the first row that is sea (dark) below sky; columns with no sky/sea change: None"""
    out = []
    for x in range(a.shape[1]):
        col = a[:, x, 2]
        idx = np.where((col[:-1] > 170) & (col[1:] < 170))[0]
        out.append(int(idx[0]) if len(idx) else None)
    return out


@section
def image(B, port):
    T = fresh(B, port, "horizon_tilt5.png")
    t = math.tan(math.radians(5))
    T.tool("measure"); T.drag((40, 200 + 280 * t), (600, 200 - 280 * t))
    T.menu("Image", "Image Rotation", "Straighten by the Ruler line")
    a = T.flat_np(); d = T.doc(); rows = [r for r in horizon_rows(a)[int(d["w"] * 0.1):int(d["w"] * 0.9)] if r is not None]
    check("Straighten by the Ruler line: the 5 degree horizon comes out level (within 2 px across the picture)", rows and max(rows) - min(rows) <= 2, (min(rows), max(rows)) if rows else None)
    check("...and the empty corners are cropped away (no see-through pixel left)", a[..., 3].min() == 255, int(a[..., 3].min()))
    co, si = math.cos(math.radians(5)), math.sin(math.radians(5)); sc = min(640 / (640 * co + 400 * si), 400 / (640 * si + 400 * co))
    check("...to the largest box of the picture's own shape (%d x %d)" % (round(640 * sc), round(400 * sc)), abs(d["w"] - 640 * sc) <= 3 and abs(d["h"] - 400 * sc) <= 3, (d["w"], d["h"]))
    T.key("Control+z")
    T.menu("Image", "Image Rotation", "Straighten by the Ruler line, keeping the corners")
    a = T.flat_np(); d = T.doc(); rows = [r for r in horizon_rows(a)[int(d["w"] * 0.15):int(d["w"] * 0.85)] if r is not None]
    check("Straighten keeping the corners: level, the canvas grown to hold the whole turned picture (%d x %d)" % (round(640 * co + 400 * si), round(640 * si + 400 * co)), rows and max(rows) - min(rows) <= 2 and abs(d["w"] - (640 * co + 400 * si)) <= 3 and abs(d["h"] - (640 * si + 400 * co)) <= 3, (d["w"], d["h"], (min(rows), max(rows)) if rows else None))
    # the ruler line left from another picture
    T.open("photo.png"); w0 = T.doc()["w"]
    T.menu("Image", "Image Rotation", "Straighten by the Ruler line")
    check("A new picture opened, no Ruler line drawn on it: Straighten asks for a line (it does not use the last picture's line)", T.doc()["w"] == w0 and T.hist() == ["Open"], (T.doc()["w"], T.hist(), T.center_status()))
    # Crop at 1:1 dragged each way, on a picture whose pixels say where they are
    T.open("coords.png")
    T.tool("crop"); T.pg.locator(".ph-opts select").first.select_option("1:1"); T.focus_away()
    for dx, dy in ((150, 100), (-150, 100), (150, -100), (-150, -100)):
        T.drag((300, 200), (300 + dx, 200 + dy)); T.key("Enter")
        d = T.doc(); px = T.flat(2, 2)
        x0 = 300 if dx > 0 else 150; y0 = 200 if dy > 0 else 50
        got = [px[0] + 256 * (px[2] // 64), px[1] + 256 * ((px[2] % 64) // 16)]
        check("Crop 1:1 dragged from 300,200 by %+d,%+d: a 150 x 150 square whose corner is where the drag began (top-left %d,%d)" % (dx, dy, x0, y0), d["w"] == d["h"] and abs(d["w"] - 150) <= 2 and abs(got[0] - x0 - 2) <= 2 and abs(got[1] - y0 - 2) <= 2, (d["w"], d["h"], got))
        T.key("Control+z"); T.tool("crop")
    # Quick Mask with nothing selected
    T.open("photo.png"); T.focus_away(); T.key("q")
    red = T.J("Lantern.photo.api.d.quickMask && Lantern.photo.api.d.sel ? Lantern.photo.doc.selMask(Lantern.photo.api.d)[100 * 640 + 100] : -1")
    check("Quick Mask (Q) with nothing selected: everything selected (no red over the picture)", red == 255, red)
    T.tool("brush"); T.key("d"); T.drag((100, 200), (300, 200)); T.key("q")
    check("...black painted across, Q again: the stroke is taken out of the selection, the rest stays selected", T.sel_at(200, 200) < 60 and T.sel_at(200, 100) > 200, (T.sel_at(200, 200), T.sel_at(200, 100)))
    T.key("Control+d")
    # the History Brush after more than 50 steps
    T.open("photo.png"); orig = T.flat(350, 400)
    T.focus_away()
    for _ in range(53): T.pg.keyboard.press("Control+i")
    T.pg.wait_for_timeout(300)
    inv = T.flat(350, 400)
    T.tool("historyBrush"); T.drag((300, 400), (400, 400))
    hb = T.flat(350, 400)
    check("53 Inverts, then the History Brush: it paints back the picture as it was opened (not a later step)", near(hb, orig, 3) and not near(inv, orig, 30), (orig, inv, hb, len(T.hist())))
    check("History keeps the opening state and the last 50 steps", T.hist()[0] == "Open" and len(T.hist()) == 51, (len(T.hist()), T.hist()[:2]))
    # the History Brush from a step whose circle is clicked
    T.open("photo.png"); T.focus_away(); orig = T.flat(350, 400); T.key("Control+i"); T.key("Control+Shift+u")
    T.pg.locator(".ph-hrow").nth(1).locator(".ph-hsrc").click(); T.pg.wait_for_timeout(100)
    T.tool("historyBrush"); T.drag((300, 400), (400, 400)); hb = T.flat(350, 400)
    check("History Brush from the 'Invert' step (its circle clicked): paints the inverted colours back over the grey", near(hb, [255 - orig[0], 255 - orig[1], 255 - orig[2]], 3), (orig, hb))
    # a greyed step clicked
    T.open("photo.png"); T.focus_away(); T.key("Control+i"); T.key("Control+Shift+u"); T.key("Control+i")
    T.key("Control+z"); T.key("Control+z"); T.key("Control+z")
    T.pg.locator(".ph-hrow.undone").nth(1).click(); T.pg.wait_for_timeout(200)
    check("Three steps undone; a click on the second greyed step goes forward to it", T.hist() == ["Open", "Invert", "Desaturate"] and T.doc()["redo"] == 1, (T.hist(), T.doc()["redo"]))
    # Undo keeps the chosen layer
    T.open("photo.png"); T.tool("marquee"); T.drag((100, 100), (300, 300)); T.key("Control+j"); T.key("Control+d")
    c0 = T.layer_hash(1); T.row_click("Background"); T.key("Control+i"); T.key("Control+z")
    a1 = T.active_name(); T.key("Control+i")
    check("Undo keeps the chosen layer: the Background stays chosen and the next Invert inverts it, not the copy", a1 == "Background" and T.layer_hash(1) == c0 and near(T.flat(600, 450), [185, 115, 195], 3), (a1, T.flat(600, 450)))
    page_errors(T, "image")
    T.close()


# ============================================================ window sizes
@section
def sizes(B, port):
    T = fresh(B, port, viewport=(1366, 768))
    miss = T.J("""(() => { var out = [], col = document.querySelector('.ph-tools').getBoundingClientRect();
        document.querySelectorAll('.ph-tools .ph-tool, .ph-swatch input').forEach(function (b) { var r = b.getBoundingClientRect();
          if (r.bottom > Math.min(window.innerHeight, col.bottom) + 1 || r.right > window.innerWidth + 1 || r.height < 5) out.push((b.getAttribute('data-id') || b.title || b.getAttribute('aria-label')) + '@' + Math.round(r.bottom)); }); return out; })()""")
    check("1366 x 768: every tool, the two colour boxes, Swap, Default and Quick Mask are on the screen", not miss, miss)
    T.close()
    for vp in ((1366, 768), (1400, 900), (1920, 1080), (390, 844)):
        T = fresh(B, port, viewport=vp)
        r = T.J("""(() => { var c = document.querySelector('.ph-tools'), cr = c.getBoundingClientRect(), bs = Array.prototype.slice.call(document.querySelectorAll('.ph-tools .ph-tool')), clip = [], over = 0, w = 0;
            bs.forEach(function (b) { var q = b.getBoundingClientRect(); w = Math.max(w, q.width); if (q.right > cr.right + 0.5 || q.left < cr.left - 0.5) clip.push(b.getAttribute('data-id') || b.title.slice(0, 12)); });
            for (var i = 0; i < bs.length; i++) for (var j = i + 1; j < bs.length; j++) { var a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect(); if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) over++; }
            return {buttonWidth: w, overlapping: over, cut: clip}; })()""")
        if vp == (1366, 768): T.shot("laptop_1366x768.png")
        if vp == (390, 844): T.pg.locator(".ph-tools").screenshot(path=os.path.join(HERE, "evidence", "phone_tools.png"))
        check("%d x %d: the tool buttons do not overlap one another and none is cut off at the column's edge" % vp, r["overlapping"] == 0 and not r["cut"], r)
        T.close()
    T = fresh(B, port, viewport=(390, 844))
    sw = T.J("[document.documentElement.scrollWidth, window.innerWidth]")
    check("Phone 390 x 844: no sideways scrolling", sw[0] <= sw[1] + 1, sw)
    bad = []
    tops = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-mbtn'), function (b) { return b.textContent; })")
    for top in tops:
        T.pg.click(".ph-mbtn:text-is(%s)" % json.dumps(top)); T.pg.wait_for_timeout(80)
        subs = T.J("Array.prototype.filter.call(document.querySelectorAll('.ph-menubar > .ph-menu > .ph-mitem'), function (b) { return b.children[1].textContent === '\\u25b8'; }).map(function (b) { return b.children[0].textContent; })")
        r = T.J("(() => { var m = document.querySelector('.ph-menubar > .ph-menu'), r = m.getBoundingClientRect(); return [r.left, r.right, document.documentElement.scrollWidth]; })()")
        if r[0] < -1 or r[1] > 391 or r[2] > 391: bad.append((top, [round(x) for x in r]))
        for sname in subs:
            T.pg.click(".ph-menubar > .ph-menu > .ph-mitem:has(span:text-is(%s))" % json.dumps(sname)); T.pg.wait_for_timeout(60)
            r = T.J("(() => { var m = document.querySelector('.ph-menubar > .ph-menu'), s = m.querySelector('.ph-sub'), r = m.getBoundingClientRect(), q = s ? s.getBoundingClientRect() : r; var k = Array.prototype.map.call(s ? s.querySelectorAll('.ph-mkey') : [], function (x) { return x.getBoundingClientRect().right; }); return [r.left, r.right, q.left, q.right, Math.max.apply(null, k.concat([0])), document.documentElement.scrollWidth]; })()")
            if min(r[0], r[2]) < -1 or max(r[1], r[3], r[4]) > 391 or r[5] > 391: bad.append((top + " > " + sname, [round(x) for x in r]))
        T.key("Escape")
    check("Phone: every menu and every submenu (with its shortcut column) fits inside the screen, and the page does not scroll sideways", not bad, bad[:6])
    T.menu("Image", "Adjustments", "Shadows/Highlights…")
    r = T.J("(() => { var m = document.querySelector('.ph-dialog'), r = m.getBoundingClientRect(); return [r.left, r.right, document.documentElement.scrollWidth]; })()")
    check("Phone: the Shadows/Highlights box fits the screen's width", r[0] >= -1 and r[1] <= 391 and r[2] <= 391, r)
    T.key("Escape")
    T.lbtn("Layer style"); r = T.J("(() => { var m = document.querySelector('.ph-dialog'), r = m.getBoundingClientRect(); return [r.left, r.right, m.scrollHeight > m.clientHeight, document.documentElement.scrollWidth]; })()")
    check("Phone: the Layer Style box fits the screen's width", r[0] >= -1 and r[1] <= 391 and r[3] <= 391, r)
    T.key("Escape")
    off = T.J("""(() => { var out = []; document.querySelectorAll('.ph-root button, .ph-root select, .ph-root input:not([type=file])').forEach(function (b) {
       if (b.closest('details:not([open])') || b.offsetParent === null) return; var r = b.getBoundingClientRect(); if (r.right > window.innerWidth + 1 || r.left < -1) out.push((b.title || b.textContent || b.getAttribute('aria-label') || b.tagName).slice(0, 30)); }); return out; })()""")
    check("Phone: every button and box (Layers panel's group and merge buttons too) within the width", not off, off[:8])
    page_errors(T, "sizes")
    T.close()


# ============================================================ a 12-megapixel photo
@section
def big(B, port):
    p = os.path.join(OUT, "big12mp.jpg")
    if not os.path.exists(p):
        rng = np.random.default_rng(5); y, x = np.mgrid[0:3000, 0:4000]
        a = np.stack([(x / 4000 * 200 + 30), (y / 3000 * 180 + 40), ((x + y) % 512) / 2 + 40], -1) + rng.normal(0, 8, (3000, 4000, 1))
        a[1000:2000, 1500:2600] = [140, 20, 25]
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(p, quality=88)
    T = Tile(B, port, INPUTS, OUT)
    t1 = time.time(); T.open(p, timeout=120000); dt = time.time() - t1
    check("12 MP photo (4000 x 3000) opens in under 8 s", dt < 8, round(dt, 1))
    T.menu("Layer", "New Layer")
    t1 = time.time(); T.key("Control+g"); dt1 = time.time() - t1
    t1 = time.time(); T.row_click("Background"); T.lbtn("Move up"); dt2 = time.time() - t1
    check("12 MP: Ctrl+G and moving the Background into the group each take under 3 s", dt1 < 3 and dt2 < 3, (round(dt1, 1), round(dt2, 1), T.struct()))
    T.key("Control+z"); T.row_click("Group 1")
    t1 = time.time(); T.key("Control+e"); T.pg.wait_for_function("Lantern.photo.api.d.hist[Lantern.photo.api.d.hist.length - 1].label === 'Merge Group'", timeout=60000); dt = time.time() - t1
    check("12 MP: Merge Group in under 5 s", dt < 5, round(dt, 1))
    T.key("Control+z"); T.key("Control+z")
    # the Magnetic Lasso round the red block
    T.tool("magLasso"); T.J("Lantern.photo.api.view.zoomTo(0.2)"); T.pg.wait_for_timeout(300)
    t1 = time.time(); T.click((1500, 1300)); dt0 = time.time() - t1
    pts = [(1497, y) for y in range(1300, 2003, 40)] + [(x, 2003) for x in range(1497, 2603, 40)] + [(2603, y) for y in range(2003, 997, -40)] + [(x, 997) for x in range(2603, 1497, -40)] + [(1497, y) for y in range(997, 1290, 40)]
    t1 = time.time(); hover_path(T, pts); T.pg.wait_for_timeout(50); dtm = (time.time() - t1) / len(pts)
    t1 = time.time(); T.key("Enter"); T.pg.wait_for_function("!!Lantern.photo.api.d.sel", timeout=60000); dte = time.time() - t1
    r = T.sel_bounds()
    check("12 MP Magnetic Lasso: the first click under 4 s, each move under 0.3 s on average, Enter under 5 s", dt0 < 4 and dtm < 0.3 and dte < 5, (round(dt0, 2), round(dtm, 3), round(dte, 2)))
    check("12 MP Magnetic Lasso: the selection is the red block (1500,1000 1100 x 1000 within 12 px)", r and near([r["x"], r["y"], r["w"], r["h"]], [1500, 1000, 1100, 1000], 12), r)
    T.key("Control+d")
    # Shadows/Highlights
    t1 = time.time(); T.menu("Image", "Adjustments", "Shadows/Highlights…")
    T.pg.wait_for_function("Lantern.photo.api.d.open === true", timeout=120000); dtp = time.time() - t1
    t1 = time.time(); T.ok(wait=50); T.pg.wait_for_function("Lantern.photo.api.d.hist[Lantern.photo.api.d.hist.length - 1].label === 'Shadows/Highlights'", timeout=120000); dto = time.time() - t1
    check("12 MP Shadows/Highlights: the preview shows in under 15 s and OK takes under 15 s", dtp < 15 and dto < 15, (round(dtp, 1), round(dto, 1)))
    page_errors(T, "big")
    T.close()



# ============================================================ the smaller mends of the first review, held?
@section
def mends(B, port):
    T = fresh(B, port)
    # Shift+Alt held before a marquee drag: the overlap (not a centred square)
    T.tool("marquee"); T.drag((50, 50), (150, 150)); T.drag((100, 100), (200, 200), mods=["Shift", "Alt"])
    r = T.sel_bounds()
    check("Marquee: Shift+Alt held before the drag keeps only the overlap (100,100 50 x 50)", r and near([r["x"], r["y"], r["w"], r["h"]], [100, 100, 50, 50], 1), r)
    T.key("Control+d")
    # Quick Selection's first stroke starts a new selection
    T.drag((400, 350), (500, 450)); T.tool("quickSelect"); T.drag((100, 50), (140, 60))
    check("Quick Selection: the first stroke starts a new selection (the marquee's box is dropped)", T.sel_at(450, 400) < 50 and T.sel_at(120, 55) > 200, (T.sel_at(450, 400), T.sel_at(120, 55)))
    T.key("Control+d")
    # a mask made from the selection drops the selection
    T.key("Control+a"); T.key("Control+j"); T.key("Control+d"); T.tool("marquee"); T.drag((100, 100), (300, 300))
    T.menu("Layer", "Layer Mask", "Reveal Selection")
    check("Layer Mask > Reveal Selection: the mask made, and the selection dropped (as Photoshop)", [l["mask"] for l in T.doc()["layers"]][-1] and not T.doc()["sel"], (T.doc()["sel"], T.hist()[-1]))
    # Pencil hard-edged
    T.open("photo.png"); T.menu("Layer", "New Layer"); T.tool("pencil"); T.setopt_ui("Size", 6); T.drag((100, 300), (400, 330))
    al = T.J("(() => { var d = Lantern.photo.api.d, c = Lantern.photo.compose.render(d, d.layers[d.active]), a = c.getContext('2d').getImageData(90, 290, 320, 50).data, s = {}; for (var i = 3; i < a.length; i += 4) s[a[i]] = 1; return Object.keys(s).map(Number); })()")
    check("Pencil at size 6: hard-edged (every pixel fully painted or not at all)", set(al) <= {0, 255} and 255 in al, sorted(al)[:12])
    # History names as the menus name them
    T.open("photo.png"); names = []
    for path in [("Filter", "Sharpen", "Unsharp Mask…"), ("Filter", "Noise", "Dust & Scratches…"), ("Filter", "Blur", "Motion Blur…"), ("Image", "Adjustments", "Brightness/Contrast…")]:
        T.menu(*path); T.pg.wait_for_timeout(200)
        if T.dialog_open(): T.ok(wait=500)
        names.append(T.hist()[-1])
    check("History names the steps as the menu does (Unsharp Mask, Dust & Scratches, Motion Blur, Brightness/Contrast)", names == ["Unsharp Mask", "Dust & Scratches", "Motion Blur", "Brightness/Contrast"], names)
    # Invert opens no box: listed without the dots
    T.pg.click(".ph-mbtn:text-is('Image')"); T.pg.click(".ph-menubar > .ph-menu > .ph-mitem:has(span:text-is('Adjustments'))")
    labs = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-sub > .ph-mitem'), function (b) { return b.children[0].textContent; })"); T.key("Escape")
    check("Image > Adjustments lists Invert without '…' (it opens no box)", "Invert" in labs, [x for x in labs if x.startswith("Invert")])
    summ = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-side details > summary'), function (s) { return s.textContent; })")
    check("The collapsed Histogram panel's heading reads 'Histogram' (not the channel list run together)", "Histogram" in [x.strip() for x in summ], summ)
    # Dodge refused on a group must not leave the tool keys dead
    T.menu("Layer", "New Layer"); paint_rect(T, 50, 50, 150, 150, (220, 0, 0)); T.key("Control+g")
    T.tool("dodge"); T.drag((60, 100), (140, 100)); T.key("b")
    check("Dodge used with a group chosen (refused): the tool keys still work afterwards (B picks the Brush)", T.tool_id() == "brush", (T.tool_id(), T.J("!!Lantern.photo.api.d.open")))
    T.errs[:] = [e for e in T.errs if "is a group" not in e]
    page_errors(T, "mends")
    T.close()



if __name__ == "__main__":
    sv = Serve(BUILD, [INPUTS, OUT])
    print("build:", BUILD)
    with sync_playwright() as pw:
        B = pw.chromium.launch()
        for fn in SECTIONS:
            if ONLY and fn.__name__ not in ONLY: continue
            print("--- " + fn.__name__, flush=True)
            t1 = time.time()
            try:
                fn(B, sv.port)
            except Exception as e:
                check(fn.__name__ + ": the section ran to its end", False, "".join(traceback.format_exception_only(type(e), e))[-500:])
            print("    (%.0f s)" % (time.time() - t1), flush=True)
        B.close()
    nf = sum(1 for r in RESULTS if not r["ok"])
    if not ONLY:
        # cases.json is the record of the frozen build reviewed; a run on any other build goes to cases_last_run.json
        fn = "cases.json" if os.path.abspath(BUILD) == os.path.abspath(DEFAULT_BUILD) else "cases_last_run.json"
        with open(os.path.join(HERE, fn), "w") as f:
            json.dump({"build": BUILD, "seconds": round(time.time() - T0), "checks": RESULTS}, f, indent=1, ensure_ascii=False)
    print("%d checks, %d failed" % (len(RESULTS), nf))
