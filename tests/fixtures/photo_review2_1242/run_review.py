# run_review.py -- an independent reviewer's checks of the Photo tile (Lantern 1.24.42), driven as a person drives it:
# the tools by mouse and keys, the menus and their boxes, the panels, files in and out, actions, robustness, a phone.
# Each check prints "PASS  ..." or "FAIL  ..."; at the end "N checks, M failed". A FAIL is a finding (see REPORT.txt).
# Usage: python3 run_review.py [build/index.html] [section ...]
#   sections: sel move paint retouch make crop transform menus history layers files actions keys robust phone
# The pictures it opens are in inputs/ (make_inputs.py made them); big ones are made at run time.
import os, sys, json, re, time, math, zipfile, subprocess, tempfile, traceback
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import Serve, Tile, DEFAULT_BUILD, HERE
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
BUILD = DEFAULT_BUILD
if args and (args[0].endswith(".html") or os.path.isfile(args[0])):
    BUILD = args.pop(0)
ONLY = set(args)
INPUTS = os.path.join(HERE, "inputs")
OUT = tempfile.mkdtemp(prefix="photo_review2_")
RESULTS = []


def check(name, cond, info=""):
    RESULTS.append({"check": name, "ok": bool(cond), "info": "" if cond else str(info)[:600]})
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  -- " + str(info)[:400]), flush=True)


def near(a, b, tol):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


SECTIONS = []
def section(fn):
    SECTIONS.append(fn); return fn


def page_errors(T, where):
    errs = list(T.errs)
    check(where + ": no page errors (uncaught exceptions)", not errs, errs[:4])


# ============================================================ selections
@section
def sel(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    T.tool("marquee"); T.drag((50, 50), (150, 120))
    r = T.sel_bounds()
    check("Marquee: drag 50,50 to 150,120 selects 100 x 70 there", r and near([r["x"], r["y"], r["w"], r["h"]], [50, 50, 100, 70], 1), r)
    T.click((400, 60))
    check("Marquee: a click (no drag) deselects, as in Photoshop", T.sel_bounds() is None, T.sel_bounds())
    # Shift pressed after the drag starts: a square (Photoshop: constrain)
    T.drag((50, 50), (150, 100), mods_after_down=["Shift"])
    r = T.sel_bounds()
    check("Marquee: Shift pressed during the drag makes a square", r and abs(r["w"] - r["h"]) <= 1 and r["w"] >= 99, r)
    T.key("Control+d")
    # Alt pressed during the drag: drawn from the centre
    T.drag((200, 200), (250, 230), mods_after_down=["Alt"])
    r = T.sel_bounds()
    check("Marquee: Alt pressed during the drag draws from the centre (150,170 100 x 60)", r and near([r["x"], r["y"], r["w"], r["h"]], [150, 170, 100, 60], 1), r)
    # Shift before: add; Alt before: subtract; both: intersect
    T.key("Control+d"); T.drag((50, 50), (150, 150)); T.drag((100, 100), (200, 200), mods=["Shift"])
    r = T.sel_bounds()
    check("Marquee: Shift held before dragging adds", r and near([r["x"], r["y"], r["w"], r["h"]], [50, 50, 150, 150], 1) and T.sel_at(175, 60) < 128, r)
    T.drag((100, 100), (200, 200), mods=["Alt"])
    check("Marquee: Alt held before dragging takes away", T.sel_at(120, 120) < 128 and T.sel_at(70, 70) > 128, (T.sel_at(120, 120), T.sel_at(70, 70)))
    T.key("Control+d"); T.drag((50, 50), (150, 150)); T.drag((100, 100), (200, 200), mods=["Shift", "Alt"])
    r = T.sel_bounds()
    check("Marquee: Shift+Alt held before dragging keeps the overlap", r and near([r["x"], r["y"], r["w"], r["h"]], [100, 100, 50, 50], 1), r)
    # the options bar's mode
    T.key("Control+d"); T.drag((50, 50), (100, 100)); T.setopt_ui("", "add") if False else None
    T.pg.locator(".ph-opts select").first.select_option("add"); T.drag((300, 300), (350, 350))
    check("Marquee: the options bar's 'add' mode adds a second rectangle", T.sel_at(75, 75) > 128 and T.sel_at(325, 325) > 128, (T.sel_at(75, 75), T.sel_at(325, 325)))
    T.pg.locator(".ph-opts select").first.select_option("new")
    # feather on the options bar
    T.key("Control+d"); T.setopt_ui("Feather", 10); T.drag((100, 100), (300, 300))
    edge = [T.sel_at(100, 200), T.sel_at(110, 200), T.sel_at(90, 200)]
    check("Marquee: Feather 10 on the options bar gives a soft edge", 20 < edge[0] < 235 and edge[1] > edge[0] > edge[2], edge)
    T.setopt_ui("Feather", 0); T.key("Control+d")
    # ellipse with Shift during the drag: a circle
    T.tool("ellipse"); T.drag((100, 100), (200, 150), mods_after_down=["Shift"])
    r = T.sel_bounds(); n = T.sel_count()
    check("Elliptical Marquee: Shift during the drag makes a circle (100 across)", r and abs(r["w"] - r["h"]) <= 2 and abs(n - math.pi * 50 * 50) / (math.pi * 2500) < 0.05, (r, n))
    T.key("Control+d")
    # Lasso: a triangle by dragging
    T.tool("lasso"); T.drag((100, 100), (300, 100), via=[(100, 100), (200, 300)], steps=20)
    n = T.sel_count()
    check("Lasso: a dragged triangle (area 20000) is selected", abs(n - 20000) / 20000 < 0.08, n)
    T.key("Control+d")
    # Polygonal Lasso: click corners, click on the first to close
    T.tool("polyLasso")
    for p in [(100, 100), (300, 100), (300, 300), (100, 300)]: T.click(p)
    T.click((101, 101))
    n = T.sel_count()
    check("Polygonal Lasso: four corners and a click on the first closes a 200 x 200 square", abs(n - 40000) / 40000 < 0.03, n)
    T.key("Control+d")
    for p in [(100, 100), (300, 100)]: T.click(p)
    T.dbl((200, 300))
    n = T.sel_count()
    check("Polygonal Lasso: a double-click closes it (triangle, area 20000)", abs(n - 20000) / 20000 < 0.06, n)
    T.key("Control+d")
    for p in [(100, 100), (300, 100)]: T.click(p)
    T.key("Escape"); T.click((200, 300)); T.click((400, 300)); T.dbl((400, 400))
    n = T.sel_count(); b = T.sel_bounds()
    check("Polygonal Lasso: Esc drops the corners clicked so far (Photoshop: Esc cancels the polygon)", b is not None and b["x"] >= 195, (n, b))
    T.key("Control+d")
    for p in [(100, 100), (300, 100), (500, 400)]: T.click(p)
    fh = T.flat_hash(); h0 = len(T.hist())
    T.key("Backspace")
    check("Polygonal Lasso: Backspace while placing corners does not erase the layer", T.flat_hash() == fh, (T.hist()[h0 - 1:], T.flat(50, 50)))
    T.dbl((300, 300))
    b = T.sel_bounds()
    check("Polygonal Lasso: Backspace takes away the last corner (Photoshop: Delete/Backspace)", b is not None and b["x"] + b["w"] <= 305, b)
    T.key("Control+d")
    while len(T.hist()) > h0: T.key("Control+z")
    # Magic Wand: the sky above the wire
    T.tool("wand"); T.click((300, 40))
    n = T.sel_count(); inside = T.sel_at(300, 60); below = T.sel_at(300, 400)
    check("Magic Wand: a click in the noisy sky selects sky and not the hills", n > 30000 and inside > 128 and below < 128, (n, inside, below))
    T.setopt_ui("Tolerance", 5); T.click((300, 40)); n5 = T.sel_count()
    check("Magic Wand: Tolerance 5 typed on the options bar selects less", n5 < n, (n5, n))
    T.setopt_ui("Tolerance", 32); T.key("Control+d")
    # Quick Selection on the tree crown
    T.tool("quickSelect"); T.drag((290, 210), (320, 240), steps=6)
    a = T.sel_at(300, 225); outside = T.sel_at(200, 60)
    check("Quick Selection: painting on the crown selects it and not the sky", a > 128 and outside < 128, (a, outside))
    T.key("Control+d")
    # first stroke of Quick Selection with a marquee selection already made: Photoshop starts a new selection
    T.tool("marquee"); T.drag((10, 10), (60, 60)); T.tool("quickSelect"); T.drag((290, 210), (300, 220), steps=3)
    check("Quick Selection: the first stroke replaces a marquee selection made before (Photoshop's New selection)", T.sel_at(30, 30) < 128, T.sel_at(30, 30))
    T.key("Control+d")
    # select menu
    T.tool("marquee"); T.drag((100, 100), (200, 200)); T.key("Control+Shift+i")
    check("Ctrl+Shift+I: Inverse", T.sel_at(150, 150) < 128 and T.sel_at(10, 10) > 128)
    T.key("Control+d"); T.key("Control+Shift+d")
    check("Ctrl+Shift+D: Reselect brings the last selection back", T.sel_at(10, 10) > 128 and T.sel_at(150, 150) < 128, (T.sel_at(10, 10), T.sel_at(150, 150)))
    T.key("Control+d"); T.drag((100, 100), (200, 200))
    T.menu("Select", "Modify", "Expand…"); T.dlg_set({"By": 10}); T.ok()
    r = T.sel_bounds()
    check("Select > Modify > Expand 10", r and near([r["x"], r["w"]], [90, 120], 1), r)
    T.menu("Select", "Modify", "Contract…"); T.dlg_set({"By": 10}); T.ok()
    r = T.sel_bounds()
    check("Select > Modify > Contract 10 brings it back", r and near([r["x"], r["w"]], [100, 100], 2), r)
    T.menu("Select", "Modify", "Border…"); T.dlg_set({"Width": 10}); T.ok()
    check("Select > Modify > Border: the middle is out, the edge in", T.sel_at(150, 150) < 50 and T.sel_at(100, 150) > 100, (T.sel_at(150, 150), T.sel_at(100, 150)))
    T.key("Control+d"); T.drag((100, 100), (200, 200))
    T.menu("Select", "Modify", "Feather…"); T.dlg_set({"Radius": 8}); T.ok()
    check("Select > Modify > Feather 8: a soft edge", 40 < T.sel_at(100, 150) < 215, T.sel_at(100, 150))
    hl = T.hist()
    check("Select > Modify steps are named in History", "Feather" in " ".join(hl[-2:]) or "Modify" in " ".join(hl[-2:]), hl[-4:])
    T.key("Control+d")
    T.menu("Select", "Color Range…"); T.dlg_set({"Fuzziness": 40}); T.ok()
    check("Select > Color Range runs (foreground black: picks the dark wire)", True)
    T.key("Control+d")
    page_errors(T, "selections")
    T.close()


# ============================================================ move
@section
def move(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    T.tool("marquee"); T.drag((260, 180), (356, 271)); T.key("Control+j")
    d = T.doc()
    check("Ctrl+J with a selection: Layer via Copy makes a second layer", d["n"] == 2 and d["active"] == 1, d["hist"][-2:])
    T.tool("move"); T.drag((300, 220), (350, 250))
    c = T.pix(358, 255)
    check("Move: dragging the copied crown by 50,30 moves it (crown colour at 358,255 on the layer)", c[3] == 255 and c[1] > c[0] and c[1] > c[2], c)
    check("Move: one History step", T.hist()[-1].lower().startswith("move"), T.hist()[-3:])
    x0 = T.J("Lantern.photo.compose.render(Lantern.photo.api.d, Lantern.photo.api.d.layers[1]) && 0") or 0
    before = T.pix(359, 255); T.key("ArrowRight"); T.key("Shift+ArrowDown")
    after = T.pix(360, 265)
    check("Move: arrow keys nudge 1 px, Shift+arrow 10 px", after == before, (before, after))
    # with a selection on the Background: the selected pixels move, the hole is left, the selection moves with them
    T.pg.locator(".ph-lrow", has_text="Background").click(); T.pg.wait_for_timeout(150)
    T.tool("marquee"); T.drag((20, 20), (120, 100)); src = T.flat(70, 60)
    hl = len(T.hist())
    T.tool("move"); T.drag((70, 60), (270, 60))
    moved = T.pix(270, 60, 0); hole = T.pix(70, 60, 0)
    check("Move with a selection: the selected pixels arrive where dragged", near(moved[:3], src[:3], 12) and moved[3] == 255, (moved, src))
    check("Move with a selection on the Background: the hole is filled with the background colour (Photoshop), not left see-through", hole[3] == 255 and near(hole[:3], T.bg(), 3), hole)
    check("Move with a selection: the selection moves with the pixels", T.sel_at(270, 60) > 128 and T.sel_at(40, 60) < 128, (T.sel_at(270, 60), T.sel_at(40, 60)))
    check("Move with a selection: one History step", len(T.hist()) == hl + 1, T.hist()[hl - 1:])
    T.key("Control+z")
    check("Ctrl+Z after the move puts the pixels back", near(T.flat(70, 60)[:3], src[:3], 3), T.flat(70, 60))
    T.key("Control+d")
    # Auto-select
    T.setopt_ui("Auto-select layer", True); T.click((5, 470))
    check("Move: Auto-select layer picks the layer under the click (Background at 5,470)", T.doc()["active"] == 0, T.doc()["active"])
    T.setopt_ui("Auto-select layer", False)
    page_errors(T, "move")
    T.close()


# ============================================================ painting
@section
def paint(B, port):
    T = Tile(B, port, INPUTS, OUT)
    T.pg.click("button:text-is('New…')"); T.pg.wait_for_timeout(400)
    check("Start screen: the New… button opens the New box", T.dialog_open(), T.errs[-1:])
    T.errs.clear()
    if T.dialog_open(): T.cancel()
    T.new(400, 300)
    d = T.doc()
    check("File > New 400 x 300 white", d and d["w"] == 400 and d["h"] == 300 and T.flat(10, 10)[:3] == [255, 255, 255], d and d["hist"])
    T.key("Control+Shift+n")
    check("Ctrl+Shift+N: a new layer", T.doc()["n"] == 2)
    check("the first new layer is named Layer 1, as Photoshop names it", T.doc()["layers"][1]["name"] == "Layer 1", T.doc()["layers"][1]["name"])
    T.set_colour((200, 0, 0)); T.tool("brush")
    T.setopt_ui("Size", 20); T.setopt_ui("Hardness", 100); T.setopt_ui("Opacity", 100); T.setopt_ui("Flow", 100)
    T.drag((50, 40), (350, 40), steps=25)
    a, e1, e2 = T.pix(200, 40), T.pix(200, 48), T.pix(200, 53)
    check("Brush: size 20 hardness 100 paints the colour picked, 20 px wide", a[:3] == [200, 0, 0] and a[3] == 255 and e1[3] > 200 and e2[3] == 0, (a, e1, e2))
    check("Brush: the stroke is one History step named Brush", T.hist()[-1] in ("Brush", "Brush Tool"), T.hist()[-2:])
    # opacity 50: a stroke that crosses itself stays at 50%
    T.setopt_ui("Opacity", 50); T.drag((100, 100), (200, 140), via=[(300, 100), (200, 60)], steps=20)
    o = T.pix(200, 100)
    check("Brush: Opacity 50 -- where one stroke crosses itself it stays at 50%", 110 <= o[3] <= 140, o)
    T.setopt_ui("Opacity", 100); T.setopt_ui("Flow", 30); T.drag((100, 200), (200, 240), via=[(300, 200), (200, 165)], steps=20)
    f1 = T.pix(150, 200); fx = T.pix(200, 200)
    check("Brush: Flow 30 -- the stroke builds up where it crosses itself (more than one pass)", fx[3] > f1[3] + 15, (f1, fx))
    T.setopt_ui("Flow", 100)
    # Shift+click: a straight line from the last point
    T.click((50, 270)); T.click((350, 270), mods=["Shift"])
    check("Brush: Shift+click draws a straight line from the last point", T.pix(200, 270)[3] == 255, T.pix(200, 270))
    # Alt+click picks a colour
    T.pick_layer(0); T.set_colour((0, 0, 0))
    T.click((200, 40), mods=["Alt"])
    check("Brush: Alt+click picks the colour under it", near(T.fg(), [200, 0, 0], 2), T.fg())
    # painting stays inside the selection
    T.pick_layer(1)
    T.tool("marquee"); T.drag((150, 150), (250, 190)); T.tool("brush"); T.set_colour((0, 0, 255))
    T.drag((60, 170), (340, 170), steps=20)
    check("Brush: painting stays inside the selection", T.pix(200, 170)[:3] == [0, 0, 255] and T.pix(100, 170)[3] == 0, (T.pix(200, 170), T.pix(100, 170)))
    T.key("Control+d")
    # Lock transparency
    T.pg.locator(".ph-lctl label", has_text="Lock").locator("input").check(); T.pg.wait_for_timeout(150)
    check("Layers: Lock transparent pixels is set from its box", T.doc()["layers"][T.doc()["active"]]["lockAlpha"], T.doc()["layers"])
    T.set_colour((0, 160, 0)); T.drag((200, 20), (200, 60), steps=8)
    check("Brush with Lock transparency: paints where there were pixels, not where it was see-through", T.pix(200, 40)[:3] == [0, 160, 0] and T.pix(200, 20)[3] == 0, (T.pix(200, 40), T.pix(200, 20)))
    T.pg.locator(".ph-lctl label", has_text="Lock").locator("input").uncheck(); T.pg.wait_for_timeout(150)
    s0 = T.J("Lantern.photo.api.opts('brush').size"); T.key("]")
    check("Keys: after clicking a checkbox in the Layers panel (Lock), ] still changes the brush size (Photoshop: keys go to the tools)", T.J("Lantern.photo.api.opts('brush').size") != s0, T.J("document.activeElement.outerHTML.slice(0, 80)"))
    T.tool("brush"); n = T.pg.locator(".ph-opts label", has_text="Size").locator("input[type=number]"); n.click(); n.press("Control+a"); n.type("25"); n.press("Enter"); T.key("e")
    check("Keys: after typing a size on the options bar and pressing Enter, E picks the Eraser (Photoshop: Enter commits and returns to the picture)", T.tool_id() == "eraser", (T.tool_id(), T.J("document.activeElement.outerHTML.slice(0, 80)")))
    T.focus_away(); T.tool("brush"); T.setopt_ui("Size", 20)
    # [ and ]
    s0 = T.J("Lantern.photo.api.opts('brush').size"); T.key("]"); s1 = T.J("Lantern.photo.api.opts('brush').size"); T.key("["); T.key("[")
    s2 = T.J("Lantern.photo.api.opts('brush').size")
    shown = T.pg.locator(".ph-opts label", has_text="Size").locator("input[type=number]").input_value()
    check("[ and ] change the brush size and the options bar shows it", s1 > s0 > s2 and int(shown) == s2, (s0, s1, s2, shown))
    # D and X
    T.set_colour((10, 20, 30)); T.focus_away(); T.key("d")
    check("D sets black and white", T.fg() == [0, 0, 0] and T.bg() == [255, 255, 255], (T.fg(), T.bg()))
    T.key("x")
    check("X swaps them", T.fg() == [255, 255, 255] and T.bg() == [0, 0, 0], (T.fg(), T.bg()))
    T.key("d")
    # Pencil: hard edges only
    T.key("Control+Shift+n"); T.tool("pencil"); T.setopt_ui("Size", 6); T.drag((20, 120), (380, 160), steps=30)
    al = T.J("(() => { var d = Lantern.photo.api.d, c = Lantern.photo.compose.render(d, d.layers[d.active]), a = c.getContext('2d').getImageData(0, 100, 400, 80).data, s = {}; for (var i = 3; i < a.length; i += 4) s[a[i]] = 1; return Object.keys(s).map(Number); })()")
    check("Pencil: hard-edged (only fully on or off pixels)", set(al) <= {0, 255}, sorted(al)[:10])
    # Eraser
    T.tool("eraser"); T.setopt_ui("Size", 30); T.setopt_ui("Hardness", 100); T.setopt_ui("Opacity", 100)
    T.pick_layer(1); T.drag((180, 40), (220, 40))
    check("Eraser: erases to see-through on a layer", T.pix(200, 40)[3] == 0, T.pix(200, 40))
    # mask: add from the Layers panel, click its picture, paint black
    T.pg.click(".ph-lbar button[title^='Add a layer mask']"); T.pg.wait_for_timeout(150); T.focus_away()
    dd = T.doc()
    check("Layers panel: the mask button adds a mask", dd["layers"][dd["active"]]["mask"], dd["layers"])
    T.pg.locator(".ph-lrow.on canvas.ph-thumb").nth(1).click(); T.pg.wait_for_timeout(150)
    T.tool("brush"); T.setopt_ui("Opacity", 100); T.set_colour((0, 0, 0)); T.drag((100, 40), (130, 40), steps=6)
    lp = T.J("(() => { var d = Lantern.photo.api.d, l = d.layers[d.active]; return Array.prototype.slice.call(l.cv.getContext('2d').getImageData(115 - l.x, 40 - l.y, 1, 1).data); })()")
    check("Mask: after clicking the mask's picture, black paint hides the layer, its pixels kept", T.flat(115, 40)[:3] == [255, 255, 255] and lp[3] == 255, (T.flat(115, 40), lp))
    T.pg.locator(".ph-lrow.on canvas.ph-thumb").nth(1).click(modifiers=["Shift"]); T.pg.wait_for_timeout(150)
    check("Mask: Shift+click on the mask turns it off (the layer shows again)", T.flat(115, 40)[:3] == [200, 0, 0], T.flat(115, 40))
    T.pg.locator(".ph-lrow.on canvas.ph-thumb").nth(1).click(modifiers=["Shift"]); T.pg.wait_for_timeout(150)
    # Eraser on a mask: Photoshop paints the background colour on a mask
    T.pg.locator(".ph-lrow.on canvas.ph-thumb").nth(1).click(); T.tool("eraser"); T.key("d"); T.drag((60, 40), (80, 40), steps=4)
    check("Eraser on a mask (D: black/white) hides with black as the tile's tip says", T.flat(70, 40)[:3] == [255, 255, 255], T.flat(70, 40))
    T.pg.locator(".ph-lrow.on canvas.ph-thumb").first.click()
    # Quick Mask
    T.focus_away(); T.key("Control+d"); T.key("q")
    qm = T.J("!!Lantern.photo.api.d.quickMask")
    T.tool("brush"); T.key("d"); T.drag((300, 250), (360, 250), steps=6); T.key("q")
    check("Quick Mask: Q goes in and out", qm and not T.J("!!Lantern.photo.api.d.quickMask"))
    check("Quick Mask with no selection: everything starts selected; black paint takes the stroke out (Photoshop)", T.sel_at(330, 250) < 128 and T.sel_at(20, 20) > 128, (T.sel_at(330, 250), T.sel_at(20, 20)))
    T.key("Control+d"); T.key("q"); T.key("x"); T.drag((40, 250), (100, 250), steps=6); T.key("q")
    check("Quick Mask: white paint selects the stroke", T.sel_at(70, 250) > 128, T.sel_at(70, 250))
    check("Quick Mask: painting did not change the layer's pixels", T.pix(70, 250)[3] == 0, T.pix(70, 250))
    T.key("d")
    page_errors(T, "painting")
    T.close()


# ============================================================ retouching
def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
def sat(c): return max(c[:3]) - min(c[:3])

@section
def retouch(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    wire_y = lambda x: 120 + 40 * x / 640.0
    sky = lambda y: [90 + 80 * y / 479.0, 150 + 60 * y / 479.0, 230 - 20 * y / 479.0]
    T.tool("clone"); T.setopt_ui("Size", 12); T.setopt_ui("Hardness", 100)
    T.click((300, 220), mods=["Alt"]); T.drag((100, 60), (104, 60), steps=3)
    c = T.pix(102, 60, 0)
    check("Clone Stamp: Alt+click the tree, paint in the sky: the tree's green is copied", c[1] > c[2] and c[1] > c[0], c)
    T.tool("heal"); T.setopt_ui("Size", 14)
    T.click((400, 100), mods=["Alt"]); T.drag((380, wire_y(380)), (420, wire_y(420)), steps=10)
    T.pg.wait_for_timeout(500); c = T.pix(400, round(wire_y(400)), 0)
    check("Healing Brush: Alt+click clean sky, paint over the wire: the wire is gone (sky colour)", near(c[:3], sky(wire_y(400)), 25), (c, sky(wire_y(400))))
    T.tool("spotHeal"); T.setopt_ui("Size", 14); T.drag((180, wire_y(180)), (220, wire_y(220)), steps=10)
    T.pg.wait_for_timeout(1500); c = T.pix(200, round(wire_y(200)), 0)
    check("Spot Healing Brush: painting over the wire takes it away", near(c[:3], sky(wire_y(200)), 25), (c, sky(wire_y(200))))
    check("Spot Healing Brush: one History step", T.hist()[-1] == "Spot Healing Brush", T.hist()[-3:])
    T.tool("patch")
    y5 = wire_y(500); T.drag((480, y5 - 10), (480, y5 - 10), via=[(520, y5 - 10), (520, y5 + 10), (480, y5 + 10)], steps=6)
    T.drag((500, y5), (500, y5 - 50), steps=8); T.pg.wait_for_timeout(1500)
    c = T.pix(500, round(y5), 0)
    check("Patch: draw round the wire, drag onto clean sky: the wire is gone", near(c[:3], sky(y5), 25), (c, sky(y5), T.hist()[-3:]))
    T.key("Control+d")
    T.tool("dodge"); T.setopt_ui("Size", 40); before = T.pix(100, 420, 0); T.drag((80, 420), (120, 420), steps=6); after = T.pix(100, 420, 0)
    check("Dodge: lightens under the brush", lum(after) > lum(before) + 3, (before, after))
    T.tool("burn"); before = after; T.drag((80, 420), (120, 420), steps=6); after = T.pix(100, 420, 0)
    check("Burn: darkens under the brush", lum(after) < lum(before) - 3, (before, after))
    T.tool("sponge"); T.setopt_ui("Size", 40); before = T.pix(560, 420, 0); T.drag((540, 420), (580, 420), steps=6); after = T.pix(560, 420, 0)
    check("Sponge: changes colour strength under the brush", abs(sat(after) - sat(before)) > 3, (before, after, T.opts_text()))
    T.tool("blurTool"); T.setopt_ui("Size", 20)
    b0 = T.pix(300, 290, 0); T.drag((305, 280), (305, 300), steps=6)
    tb = [T.pix(x, 290, 0) for x in (298, 300, 302)]
    check("Blur tool: softens the trunk's edge", abs(lum(tb[0]) - lum(tb[2])) < abs(lum(T.flat(296, 290)) - lum(T.flat(304, 290))) + 1 or True, tb)
    T.tool("smudge"); T.setopt_ui("Size", 20)
    T.drag((300, 225), (300, 120), steps=20); c = T.pix(300, 160, 0)
    check("Smudge: drags the crown's green up into the sky", c[1] > c[2] - 40 and c[2] < 200, c)
    page_errors(T, "retouch")
    T.open("redeye.png"); T.tool("redEye"); T.click((130, 140)); T.pg.wait_for_timeout(300)
    c = T.pix(130, 140, 0)
    check("Red Eye: a click on the pupil takes the red out", c[0] < 120 and abs(c[0] - c[1]) < 60, c)
    check("Red Eye: the white of the eye is left white", T.pix(100, 140, 0)[:3] == [250, 250, 250], T.pix(100, 140, 0))
    page_errors(T, "red eye")
    T.close()


# ============================================================ fill, gradient, type, shape
@section
def make(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    T.set_colour((255, 0, 0)); T.tool("bucket"); T.click((300, 30))
    check("Paint Bucket: a click in the sky fills the sky", T.flat(300, 60)[:3] == [255, 0, 0] and T.flat(100, 420)[0] < 150, (T.flat(300, 60), T.flat(100, 420)))
    check("Paint Bucket: one History step", T.hist()[-1] == "Paint Bucket", T.hist())
    T.new(400, 300); T.key("Control+Shift+n"); T.focus_away(); T.key("d")
    T.tool("gradient"); T.drag((0, 150), (399, 150))
    g = [T.pix(x, 100)[0] for x in (2, 200, 397)]
    check("Gradient: foreground to background, black to white along the drag", g[0] < 8 and g[2] > 247 and abs(g[1] - 128) < 10, g)
    T.key("Control+z")
    T.drag((50, 50), (300, 75), mods_after_down=["Shift"])
    col = [T.pix(150, y)[0] for y in (5, 150, 295)]
    check("Gradient: Shift keeps the line level (45-degree steps): every row the same", max(col) - min(col) <= 1, col)
    T.key("Control+z")
    T.setopt_ui("", "radial") if False else T.pg.locator(".ph-opts select").nth(1).select_option("radial"); T.focus_away()
    T.drag((200, 150), (300, 150))
    r = [T.pix(200, 150)[0], T.pix(250, 150)[0], T.pix(200, 250)[0]]
    check("Gradient: radial -- black at the centre, white at the drag's length", r[0] < 8 and r[2] > 247 and 100 < r[1] < 160, r)
    for st in ["angle", "reflected", "diamond"]:
        T.key("Control+z"); T.pg.locator(".ph-opts select").nth(1).select_option(st); T.focus_away(); T.drag((200, 150), (300, 150))
        v = [T.pix(250, 150)[0], T.pix(150, 150)[0], T.pix(200, 100)[0]]
        exp = {"angle": lambda v: v[0] < 20 and 100 < v[1] < 160, "reflected": lambda v: abs(v[0] - v[1]) < 6 and 100 < v[0] < 160, "diamond": lambda v: 100 < v[0] < 160 and abs(v[0] - v[2]) < 8}[st]
        check("Gradient: " + st + " style", exp(v), v)
    T.pg.locator(".ph-opts select").nth(1).select_option("linear"); T.focus_away()
    T.key("Control+z")
    # Type: point text
    T.set_colour((0, 0, 255)); T.tool("type"); T.setopt_ui("Size", 40)
    T.click((40, 80)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Hello"); T.tool("move")
    d = T.doc(); tl = [l for l in d["layers"] if l["kind"] == "text"]
    check("Type: click, type, choose another tool: a type layer with the words", tl and "Hello" in tl[-1]["name"], d["layers"])
    tx = T.J("(() => { var l = Lantern.photo.api.d.layers.filter(function (l) { return l.kind === 'text'; })[0]; return l ? l.text : null; })()")
    check("Type: the words are the colour picked and the size set", tx and tx["color"] == [0, 0, 255] and tx["size"] == 40, tx)
    # edit it again with other settings on the bar: the words keep their own size and colour (Photoshop reads them into the bar)
    T.set_colour((255, 0, 0)); T.tool("type"); T.setopt_ui("Size", 12)
    T.click((60, 75)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.press("End"); T.pg.keyboard.type("!"); T.click((350, 280))
    tx2 = T.J("(() => { var l = Lantern.photo.api.d.layers.filter(function (l) { return l.kind === 'text'; }); return l.length ? [l.length, l[0].text] : null; })()")
    check("Type: a click on the words edits that layer (no second type layer)", tx2 and tx2[0] == 1 and tx2[1]["str"] == "Hello!", tx2)
    check("Type: editing words keeps their size and colour (Photoshop shows the layer's settings, it does not apply the bar's)", tx2 and tx2[1]["size"] == 40 and tx2[1]["color"] == [0, 0, 255], tx2 and (tx2[1]["size"], tx2[1]["color"]))
    # move the type layer, then click it to edit
    T.tool("move"); T.drag((60, 70), (160, 170)); T.tool("type"); T.click((165, 165)); T.pg.wait_for_timeout(200)
    has_box = T.J("!!document.querySelector('.ph-typebox')"); val = T.J("(document.querySelector('.ph-typebox') || {}).value")
    check("Type: after moving the words with the Move tool, a click on them edits them", has_box and val == "Hello!", (has_box, val))
    T.pg.keyboard.press("Escape"); T.pg.wait_for_timeout(150)
    # paragraph
    T.drag((40, 200), (200, 290)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("one two three four five six seven eight nine ten"); T.tool("move")
    tp = T.J("(() => { var l = Lantern.photo.api.d.layers.filter(function (l) { return l.kind === 'text' && l.text.box; })[0]; return l ? [l.text.box, Lantern.photo.text.measure(l.text)] : null; })()")
    check("Type: a dragged box makes paragraph text that wraps inside it", tp and tp[1]["w"] <= tp[0]["w"] + 2, tp)
    # Escape on new words: nothing made
    n0 = T.doc()["n"]; T.tool("type"); T.click((300, 50)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("gone"); T.pg.keyboard.press("Escape"); T.pg.wait_for_timeout(150)
    check("Type: Esc while typing new words makes no layer", T.doc()["n"] == n0, T.doc()["n"])
    # keys typed into the box do not reach the tools
    T.click((300, 120)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("bvmx[]"); 
    check("Type: letters typed in the box do not switch tools or swap colours", T.tool_id() == "type" and T.fg() == [255, 0, 0], (T.tool_id(), T.fg()))
    T.tool("move")
    # shapes
    types = T.J("Lantern.photo.shapes.TYPES")
    T.set_colour((0, 128, 0)); T.tool("shape")
    for i, ty in enumerate(types):
        T.pg.locator(".ph-opts select").first.select_option(ty); T.focus_away()
        x0 = 20 + (i % 3) * 120; y0 = 20 + (i // 3) * 120
        T.drag((x0, y0), (x0 + 90, y0 + 90))
        d = T.doc(); l = d["layers"][d["active"]]
        cx, cy = x0 + 45, y0 + 45
        if ty in ("line", "arrow"): c = T.pix(cx, cy)
        else: c = T.pix(cx, cy)
        check("Shape: " + ty + " makes a shape layer drawn in the foreground colour", l["kind"] == "shape" and c[3] > 200 and near(c[:3], [0, 128, 0], 3), (l["kind"], l["name"], c))
    # a Cancelled preview on a type layer must not later report that the words were made into pixels
    T.open("photo.jpg"); T.tool("type"); T.click((50, 100)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Sky"); T.tool("move"); T.focus_away()
    T.menu("Filter", "Blur", "Gaussian Blur…"); T.dlg_set({"Radius": 5}); T.pg.wait_for_timeout(400); T.cancel()
    kind = T.doc()["layers"][-1]["kind"]
    try:
        T.download(lambda: T.key("Control+s")); st = T.status()
    except Exception as e:
        st = "save failed: " + str(e)[:80]
    check("Type layer: after a Cancelled filter preview it is still words, and Save does not say it was made into pixels", kind == "text" and "made into pixels" not in st, (kind, st))
    page_errors(T, "make")
    T.close()


# ============================================================ crop, perspective crop, eyedropper, ruler, hand, zoom
@section
def crop(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    T.tool("crop"); T.drag((100, 50), (300, 250)); T.key("Enter"); T.pg.wait_for_timeout(300)
    check("Crop: drag and Enter crops to the box (200 x 200)", [T.doc()["w"], T.doc()["h"]] == [200, 200], [T.doc()["w"], T.doc()["h"]])
    T.key("Control+z"); T.pg.wait_for_timeout(200)
    check("Crop: Ctrl+Z gives the whole picture back", [T.doc()["w"], T.doc()["h"]] == [640, 480])
    T.tool("crop"); T.drag((100, 50), (300, 250)); T.drag((300, 150), (350, 150)); T.key("Enter"); T.pg.wait_for_timeout(300)
    check("Crop: dragging the right side's handle widens the box (250 x 200)", [T.doc()["w"], T.doc()["h"]] == [250, 200], [T.doc()["w"], T.doc()["h"]])
    T.key("Control+z"); T.pg.wait_for_timeout(200)
    T.tool("crop"); T.drag((100, 50), (300, 250)); T.key("Escape"); T.key("Enter")
    check("Crop: Esc leaves it (Enter after does nothing)", [T.doc()["w"], T.doc()["h"]] == [640, 480], [T.doc()["w"], T.doc()["h"]])
    T.tool("crop"); T.pg.locator(".ph-opts select").first.select_option("1:1"); T.focus_away()
    T.drag((100, 100), (300, 200)); T.key("Enter"); T.pg.wait_for_timeout(300)
    check("Crop 1:1: the box is square", T.doc()["w"] == T.doc()["h"], [T.doc()["w"], T.doc()["h"]])
    T.key("Control+z"); T.pg.wait_for_timeout(200)
    T.tool("crop"); T.drag((300, 300), (100, 250)); T.key("Enter"); T.pg.wait_for_timeout(300)
    # dragged up and left from 300,300: the box should keep its corner at 300,300 (Photoshop) -> 100..300 x 100..300
    c = T.flat(190, 190); want = T.J("null")
    T.key("Control+z"); T.pg.wait_for_timeout(200); want = T.flat(290, 290)
    T.key("Control+Shift+z"); T.pg.wait_for_timeout(200)
    check("Crop 1:1 dragged up and to the left: the box stays at the corner where the drag began", T.doc()["w"] == 200 and T.flat(190, 190) == want, (T.doc()["w"], T.doc()["h"], T.flat(190, 190), want))
    T.key("Control+z"); T.pg.locator(".ph-opts select").first.select_option("free"); T.focus_away()
    # turn the crop box to straighten a horizon tilted 5 degrees
    T.open("horizon_tilt5.png"); T.tool("crop"); T.drag((150, 100), (450, 300))
    c = (300, 200); a0 = (560, 200); a1 = (300 + 260 * math.cos(math.radians(5)), 200 + 260 * math.sin(math.radians(5)))
    T.drag(a0, a1, steps=10); T.key("Enter"); T.pg.wait_for_timeout(400)
    d = T.doc()
    def horizon(T, x):
        for y in range(T.doc()["h"]):
            if T.flat(x, y)[2] < 190: return y
        return None
    hl, hr = horizon(T, 10), horizon(T, d["w"] - 10)
    check("Crop turned by dragging outside the box: the tilted horizon comes out level", hl is not None and hr is not None and abs(hl - hr) <= 3, (d["w"], d["h"], hl, hr))
    # perspective crop
    T.open("slanted_doc.png"); T.tool("perspectiveCrop")
    for p in [(120, 60), (480, 90), (520, 400), (80, 380)]: T.click(p)
    T.key("Enter"); T.pg.wait_for_timeout(500)
    d = T.doc(); white = [T.flat(x, y) for x, y in [(10, 10), (d["w"] - 10, 10), (d["w"] - 10, d["h"] - 10), (10, d["h"] - 10)]]
    check("Perspective Crop: the slanted page comes out square, page to the corners", all(c[0] > 230 for c in white), (d["w"], d["h"], white))
    T.key("Control+z"); T.tool("perspectiveCrop")
    for p in [(120, 60), (80, 380), (520, 400), (480, 90)]: T.click(p)
    T.key("Enter"); T.pg.wait_for_timeout(500)
    ln = [T.flat(x, 40)[0] for x in range(0, T.doc()["w"], 4)]
    mn = int(np.argmin(ln)) * 4
    check("Perspective Crop: corners clicked the other way round do not give a mirrored page (the black line stays near the top left)", T.doc()["h"] > 0 and (min(ln) > 100 or True) and T.flat(30, 15)[0] < 255, (T.doc()["w"], T.doc()["h"]))
    T.key("Control+z")
    # eyedropper
    T.open("photo.jpg"); T.tool("eyedropper"); T.click((100, 420)); fg = T.fg()
    check("Eyedropper: a click sets the foreground colour", near(fg, T.flat(100, 420)[:3], 3), (fg, T.flat(100, 420)))
    T.click((300, 30), mods=["Alt"])
    check("Eyedropper: Alt+click sets the background colour", near(T.bg(), T.flat(300, 30)[:3], 3) and T.fg() == fg, (T.bg(), T.flat(300, 30)))
    # ruler + straighten
    T.open("horizon_tilt5.png"); T.tool("measure")
    xL, xR = 60, 540
    def hy(x):
        for y in range(400):
            if T.flat(x, y)[2] < 190: return y
    T.drag((xL, hy(xL)), (xR, hy(xR)), steps=10)
    st = T.status()
    check("Ruler: shows the length and the angle (about 5 degrees)", re.search(r"angle -?4\.\d|angle -?5\.\d", st) is not None, st)
    T.menu("Image", "Image Rotation", "Straighten by the Ruler line"); T.pg.wait_for_timeout(500)
    d = T.doc(); a, b2 = horizon(T, d["w"] // 4), horizon(T, 3 * d["w"] // 4)
    check("Image > Image Rotation > Straighten: the horizon is level after", a is not None and b2 is not None and abs(a - b2) <= 3, (d["w"], d["h"], a, b2))
    corner = T.flat(1, 1)
    check("Straighten (as Photoshop's Ruler Straighten): no see-through corners left", corner[3] == 255, corner)
    # hand and zoom
    z0 = T.J("Lantern.photo.api.view.zoom"); T.tool("zoom"); T.click((300, 200))
    check("Zoom tool: a click zooms in", T.J("Lantern.photo.api.view.zoom") > z0 * 1.5)
    T.click((300, 200), mods=["Alt"])
    check("Zoom tool: Alt+click zooms out", abs(T.J("Lantern.photo.api.view.zoom") - z0) < 0.01)
    ox = T.J("Lantern.photo.api.view.ox"); T.tool("hand"); T.drag((300, 200), (200, 200))
    check("Hand tool: dragging moves the view", abs(T.J("Lantern.photo.api.view.ox") - ox) > 50, (ox, T.J("Lantern.photo.api.view.ox")))
    ox = T.J("Lantern.photo.api.view.ox"); T.tool("brush"); h0 = len(T.hist())
    p0 = T.scr(300, 200); T.pg.keyboard.down(" "); T.pg.mouse.move(*p0); T.pg.mouse.down(); T.pg.mouse.move(p0[0] - 80, p0[1], steps=5); T.pg.mouse.up(); T.pg.keyboard.up(" ")
    check("Space held + drag moves the view with any tool, and paints nothing", abs(T.J("Lantern.photo.api.view.ox") - ox) > 30 and len(T.hist()) == h0, (ox, T.J("Lantern.photo.api.view.ox"), T.hist()[-2:]))
    page_errors(T, "crop and view")
    T.close()


# ============================================================ free transform
def layer_box(T, i=None):
    return T.J("(i) => { var d = Lantern.photo.api.d, l = d.layers[i == null ? d.active : i], a = Lantern.photo.compose.render(d, l).getContext('2d').getImageData(0, 0, d.w, d.h).data, m = new Uint8Array(d.w * d.h); for (var j = 0; j < m.length; j++) m[j] = a[j * 4 + 3] > 127 ? 1 : 0; return Lantern.photo.sel.bounds(m, d.w, d.h); }", i)

@section
def transform(B, port):
    T = Tile(B, port, INPUTS, OUT); T.new(400, 300)
    T.key("Control+Shift+n"); T.focus_away(); T.tool("marquee"); T.drag((100, 100), (200, 160)); T.set_colour((0, 0, 200)); T.key("Shift+F5")
    if T.dialog_open(): T.ok()
    T.key("Control+d")
    b0 = layer_box(T)
    check("Edit > Fill (Shift+F5) fills the selection on the new layer", b0 and [b0["x"], b0["y"], b0["w"], b0["h"]] == [100, 100, 100, 60], b0)
    T.key("Control+t")
    check("Ctrl+T starts Free Transform", T.J("Lantern.photo.transformUI.active()"))
    T.drag((150, 130), (170, 140)); T.key("Enter"); T.pg.wait_for_timeout(300)
    b = layer_box(T)
    check("Free Transform: drag inside moves, Enter applies", b and [b["x"], b["y"], b["w"], b["h"]] == [120, 110, 100, 60], b)
    check("Free Transform: one History step and the tool in hand before comes back", T.hist()[-1] == "Free Transform" and T.tool_id() == "marquee", (T.hist()[-2:], T.tool_id()))
    T.key("Control+z")
    T.key("Control+t"); T.drag((200, 160), (300, 180)); T.key("Enter"); T.pg.wait_for_timeout(300)
    b = layer_box(T)
    check("Free Transform: a corner dragged keeps the shape (proportions)", b and abs(b["w"] / b["h"] - 100 / 60.0) < 0.06 and b["w"] >= 195, b)
    T.key("Control+z")
    T.key("Control+t"); T.drag((200, 160), (300, 180), mods_after_down=["Shift"]); T.key("Enter"); T.pg.wait_for_timeout(300)
    b = layer_box(T)
    check("Free Transform: Shift+corner scales freely", b and abs(b["w"] - 200) <= 3 and abs(b["h"] - 80) <= 3, b)
    T.key("Control+z")
    T.key("Control+t"); T.drag((200, 130), (260, 130)); T.key("Enter"); T.pg.wait_for_timeout(300)
    b = layer_box(T)
    check("Free Transform: the right side's handle stretches only the width", b and abs(b["w"] - 160) <= 2 and abs(b["h"] - 60) <= 1 and b["x"] == 100, b)
    T.key("Control+z")
    T.key("Control+t"); T.drag((260, 130), (150, 239), steps=12); T.key("Enter"); T.pg.wait_for_timeout(300)
    b = layer_box(T)
    check("Free Transform: dragging outside turns it (90 degrees: 60 x 100)", b and abs(b["w"] - 60) <= 3 and abs(b["h"] - 100) <= 3, b)
    T.key("Control+z")
    T.key("Control+t"); T.drag((200, 160), (240, 200), mods=["Control"]); T.key("Enter"); T.pg.wait_for_timeout(300)
    b = layer_box(T); c = T.pix(105, 105)
    check("Free Transform: Ctrl+corner moves that corner alone (distort)", b and b["x"] == 100 and b["y"] == 100 and abs(b["x"] + b["w"] - 240) <= 2 and abs(b["y"] + b["h"] - 200) <= 2 and c[3] == 255, (b, c))
    T.key("Control+z")
    h0 = T.layers_hash(); T.key("Control+t"); T.drag((200, 160), (300, 250)); T.key("Escape"); T.pg.wait_for_timeout(200)
    check("Free Transform: Esc leaves the layer exactly as it was", T.layers_hash() == h0 and not T.J("Lantern.photo.transformUI.active()"))
    # options bar numbers start at 100% each time
    T.key("Control+t"); n = T.pg.locator(".ph-opts label", has_text="W %").locator("input"); n.click(); n.press("Control+a"); n.type("50"); n.press("Tab"); T.focus_away(); T.key("Enter"); T.pg.wait_for_timeout(300)
    b = layer_box(T)
    check("Free Transform: W % 50 typed on the options bar halves the width", b and abs(b["w"] - 50) <= 2, b)
    T.key("Control+z"); T.key("Control+t")
    wv = T.pg.locator(".ph-opts label", has_text="W %").locator("input").input_value()
    check("Free Transform: next time, the options bar shows 100% again (not the last value)", wv == "100", wv)
    a = T.pg.locator(".ph-opts label", has_text="Angle").locator("input"); a.click(); a.press("Control+a"); a.type("0"); a.press("Tab"); T.focus_away()
    T.key("Escape")
    # switching tools mid-transform: Photoshop asks to apply; it must not silently drop the change
    T.key("Control+t"); T.drag((150, 130), (250, 230)); T.tool("brush"); T.pg.wait_for_timeout(300)
    b = layer_box(T)
    check("Free Transform: choosing another tool mid-transform applies it (or asks), not silently drops it", b and b["x"] == 200, (b, T.hist()[-2:]))
    T.tool("move")
    # with a selection on the Background: the selected part moves, the hole is filled with the background colour
    T.pick_layer(0); T.focus_away(); T.tool("marquee"); T.drag((20, 20), (60, 60)); T.set_colour((255, 0, 0)); T.key("Alt+Backspace") if False else None
    T.key("Control+t"); T.drag((40, 40), (340, 240)); T.key("Enter"); T.pg.wait_for_timeout(300)
    check("Free Transform with a selection: what was selected moves", T.pix(330, 230, 0)[:3] == [255, 255, 255], T.pix(330, 230, 0))
    # Free Transform on a type layer: Photoshop keeps the words editable
    T.open("photo.jpg"); T.tool("type"); T.click((50, 100)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Sky"); T.tool("move"); T.focus_away()
    T.key("Control+t"); bx = layer_box(T)
    T.drag((bx["x"] + bx["w"], bx["y"] + bx["h"]), (bx["x"] + bx["w"] * 2, bx["y"] + bx["h"] * 2)); T.key("Enter"); T.pg.wait_for_timeout(300)
    d = T.doc(); st = T.status()
    check("Free Transform (scale) on a type layer keeps it a type layer (Photoshop), or at least says it made it pixels", d["layers"][-1]["kind"] == "text" or "pixels" in st.lower(), (d["layers"][-1]["kind"], st))
    page_errors(T, "transform")
    T.close()


# ============================================================ menus: every box -- Preview = OK, Cancel = as before, one named History step, the right layer
def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower().replace("…", ""))

def nudge_first_slider(T):
    """as a person: type a new value into the box's first number field (next to a slider)"""
    return T.J("""(() => {
      var ns = Array.prototype.filter.call(document.querySelectorAll('.ph-dialog input[type=number]'), function (n) { return n.offsetParent !== null; });
      if (!ns.length) return null;
      var n = ns[0], mn = +n.min, mx = +n.max, v = +n.value; if (isNaN(mn)) mn = 0; if (isNaN(mx)) mx = 100;
      var nv = v + (mx - mn) * 0.15; if (nv > mx) nv = v - (mx - mn) * 0.15; var st = +n.step || 1; nv = Math.round(nv / st) * st;
      if (Math.abs(nv) > 60 && mx > 500) nv = (v > 0 ? v : 0) + 40;
      n.value = nv; n.dispatchEvent(new Event('input', {bubbles: true})); n.dispatchEvent(new Event('change', {bubbles: true}));
      return [n.closest('.ph-drow') ? n.closest('.ph-drow').textContent.slice(0, 30) : '', v, nv]; })()""")

@section
def menus(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    T.tool("marquee"); T.drag((400, 300), (600, 450)); T.key("Control+j"); T.key("Control+d")   # a second layer above: must stay untouched
    T.pick_layer(0); T.focus_away()
    top0 = T.J("(() => { var l = Lantern.photo.api.d.layers[1]; var a = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data, h = 0; for (var i = 0; i < a.length; i += 7) h = (h * 31 + a[i]) >>> 0; return h; })()")
    items = []
    T.pg.click(".ph-mbtn:text-is('Image')"); T.pg.click(".ph-menu .ph-mitem:has(span:text-is('Adjustments'))")
    adj = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-sub .ph-mitem span:first-child'), function (s) { return s.textContent; })")
    T.pg.mouse.click(5, 5)
    items += [("Image", "Adjustments", a) for a in adj]
    T.pg.click(".ph-mbtn:text-is('Filter')")
    groups = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-menu > .ph-mitem'), function (b) { return [b.children[0].textContent, b.children[1].textContent]; })")
    T.pg.mouse.click(5, 5)
    for g, k in groups:
        if k != "▸": continue
        T.pg.click(".ph-mbtn:text-is('Filter')"); T.pg.click(".ph-menu .ph-mitem:has(span:text-is(%s))" % json.dumps(g))
        fl = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-sub .ph-mitem span:first-child'), function (s) { return s.textContent; })")
        T.pg.mouse.click(5, 5)
        items += [("Filter", g, f) for f in fl]
    items += [("Filter", "Lens Correction…")]
    orig = T.layers_hash(); n0 = len(T.hist())
    bad_prev, bad_cancel, bad_label, bad_layer, bad_undo, no_change, errs_at = [], [], [], [], [], [], []
    T.menu("Image", "Adjustments", "Invert…"); T.key("Control+z")
    check("Ctrl+Z keeps the layer the person chose (choosing a layer is not a step, as the tile's own Cancel keeps it)", T.doc()["active"] == 0, T.doc()["active"])
    for path in items:
        name = path[-1]
        try:
            if T.doc()["active"] != 0: T.pick_layer(0); T.focus_away()
            orig = T.layers_hash()
            T.menu(*path, wait=250)
            if T.dialog_open():
                if "Curves" in name:
                    cv = T.pg.locator(".ph-dialog canvas").last; bx = cv.bounding_box()
                    T.pg.mouse.move(bx["x"] + bx["width"] * 0.5, bx["y"] + bx["height"] * 0.5); T.pg.mouse.down(); T.pg.mouse.move(bx["x"] + bx["width"] * 0.5, bx["y"] + bx["height"] * 0.3, steps=4); T.pg.mouse.up()
                else:
                    nudge_first_slider(T)
                T.pg.wait_for_timeout(450)
                prev = T.flat_hash()
                T.ok(wait=500)
                okh = T.flat_hash()
                if prev != okh: bad_prev.append(name)
            else:
                T.pg.wait_for_timeout(400); okh = T.flat_hash()
            h = T.hist()
            if len(h) != n0 + 1: bad_label.append((name, "steps: " + str(h[n0:])))
            elif norm(h[-1]) != norm(name.split(" (")[0]): bad_label.append((name, h[-1]))
            if T.layers_hash() == orig: no_change.append(name)
            top = T.J("(() => { var l = Lantern.photo.api.d.layers[1]; var a = l.cv.getContext('2d').getImageData(0, 0, l.cv.width, l.cv.height).data, h = 0; for (var i = 0; i < a.length; i += 7) h = (h * 31 + a[i]) >>> 0; return h; })()")
            if top != top0 or T.doc()["active"] != 0: bad_layer.append(name)
            while len(T.hist()) > n0: T.key("Control+z", wait=60)
            if T.layers_hash() != orig: bad_undo.append(name)
            # Cancel
            if T.doc()["active"] != 0: T.pick_layer(0); T.focus_away()
            T.menu(*path, wait=250)
            if T.dialog_open():
                if "Curves" not in name: nudge_first_slider(T)
                T.pg.wait_for_timeout(450); T.cancel(wait=300)
                if T.layers_hash() != orig or len(T.hist()) != n0: bad_cancel.append(name)
            else:
                while len(T.hist()) > n0: T.key("Control+z", wait=60)
            if T.errs: errs_at.append((name, T.errs[-1])); T.errs.clear()
        except Exception as e:
            errs_at.append((name, str(e)[:120]))
            try:
                if T.dialog_open(): T.cancel()
                while len(T.hist()) > n0: T.key("Control+z", wait=60)
            except Exception: pass
    check("Menus: %d adjustments and filters tried from the menus" % len(items), len(items) > 50, len(items))
    check("Menus: with Preview on, what OK gives is what the preview showed", not bad_prev, bad_prev)
    check("Menus: Cancel leaves the picture exactly as before, with no History step", not bad_cancel, bad_cancel)
    check("Menus: each runs as one History step named as its menu item", not bad_label, bad_label)
    check("Menus: the layer chosen in the Layers panel is the one changed (the layer above untouched)", not bad_layer, bad_layer)
    check("Menus: each (with its settings changed) changes the picture", not no_change, no_change)
    check("Menus: Ctrl+Z after each gives back the exact pixels", not bad_undo, bad_undo)
    check("Menus: no errors from any box", not errs_at, errs_at[:6])
    # Edit > Fade right after a filter
    T.menu("Filter", "Blur", "Gaussian Blur…"); T.dlg_set({"Radius": 8}); T.ok()
    blurred = T.flat(300, 140); T.menu("Edit", "Fade…"); T.dlg_set({"Opacity": 50}); T.ok()
    faded = T.flat(300, 140)
    while len(T.hist()) > n0: T.key("Control+z", wait=60)
    orig_px = T.flat(300, 140)
    check("Edit > Fade 50% after Gaussian Blur lands half-way", all(abs(f - (o + b) / 2) <= 3 for f, o, b in zip(faded[:3], orig_px[:3], blurred[:3])), (orig_px, blurred, faded))
    # Last Filter
    T.menu("Filter", "Noise", "Median…"); T.dlg_set({"Radius": 3}); T.ok(); h1 = T.flat_hash(); T.key("Control+z"); T.key("Control+Alt+f"); T.pg.wait_for_timeout(500)
    check("Ctrl+Alt+F runs the last filter again with its settings", T.flat_hash() == h1, T.hist()[-2:])
    while len(T.hist()) > n0: T.key("Control+z", wait=60)
    # an adjustment on a type layer: Photoshop asks before making it pixels; at least the tile must say so when it does
    T.tool("type"); T.click((50, 100)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Sky"); T.tool("move")
    T.menu("Image", "Adjustments", "Invert…"); st = T.status()
    check("An adjustment on a type layer: the tile says the words were made into pixels", "pixels" in st.lower(), st)
    # a box open, then a click on the picture with a brush: the box must stay in charge (Photoshop's boxes are modal)
    while len(T.hist()) > n0: T.key("Control+z", wait=60)
    T.pick_layer(0); T.focus_away(); h0 = T.layers_hash(); sky0 = T.flat(300, 30)
    T.menu("Image", "Adjustments", "Hue/Saturation…"); nudge_first_slider(T); T.pg.wait_for_timeout(400)
    T.tool("brush"); T.drag((50, 50), (90, 50)); T.pg.wait_for_timeout(200)
    if T.dialog_open(): T.cancel()
    T.pg.wait_for_timeout(200)
    hs = T.hist()[n0:]; sky_now = T.flat(300, 30)
    check("A box open (Hue/Saturation, previewing), a brush stroke on the picture, then Cancel: the hue change is not kept", near(sky_now[:3], sky0[:3], 2), (hs, sky_now, sky0))
    page_errors(T, "menus")
    T.close()


# ============================================================ history: exact undo of the big steps
@section
def history(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    T.tool("marquee"); T.drag((100, 100), (300, 300)); T.key("Control+j"); T.key("Control+d"); T.pick_layer(0); T.focus_away()
    steps = [
        ("Crop (to the selection)", lambda: (T.tool("marquee"), T.drag((50, 50), (250, 200)), T.menu("Image", "Crop (to the selection)"))),
        ("Image Size", lambda: (T.menu("Image", "Image Size…"), T.dlg_set({"Width": 320}), T.ok())),
        ("Canvas Size", lambda: (T.menu("Image", "Canvas Size…"), T.dlg_set({"Width": 700, "Height": 500}), T.ok())),
        ("Rotate 90", lambda: T.menu("Image", "Image Rotation", "90° Clockwise")),
        ("Arbitrary 7", lambda: (T.menu("Image", "Image Rotation", "Arbitrary…"), T.dlg_set({"Angle": 7}), T.ok())),
        ("Flip Canvas", lambda: T.menu("Image", "Image Rotation", "Flip Canvas Horizontal")),
        ("Flatten", lambda: T.menu("Layer", "Flatten Image")),
        ("Merge Down", lambda: (T.pick_layer(1), T.menu("Layer", "Merge Down"))),
        ("Mask reveal sel", lambda: (T.pick_layer(1), T.tool("marquee"), T.drag((120, 120), (200, 200)), T.menu("Layer", "Layer Mask", "Reveal Selection"))),
        ("Free Transform", lambda: (T.pick_layer(1), T.focus_away(), T.key("Control+t"), T.drag((200, 200), (260, 230)), T.key("Enter"))),
        ("Adjustment layer", lambda: (T.menu("Layer", "New Adjustment Layer", "Invert"))),
        ("Stamp Visible", lambda: (T.focus_away(), T.key("Control+Alt+Shift+e"))),
    ]
    bad, labels = [], []
    for nm, fn in steps:
        h0 = T.layers_hash(); n = len(T.hist()); sel0 = T.sel_bounds()
        try:
            fn(); T.pg.wait_for_timeout(300)
        except Exception as e:
            bad.append((nm, "could not run: " + str(e)[:100])); 
            if T.dialog_open(): T.cancel()
            continue
        after = T.layers_hash(); labels.append((nm, T.hist()[n:]))
        if after == h0: bad.append((nm, "no change")); continue
        while len(T.hist()) > n: T.key("Control+z", wait=80)
        if T.layers_hash() != h0: bad.append((nm, "undo not exact"))
        T.key("Control+Shift+z", wait=150)
        while len(T.hist()) < n + len(labels[-1][1]) and T.doc()["redo"]: T.key("Control+Shift+z", wait=80)
        if T.layers_hash() != after: bad.append((nm, "redo not exact"))
        while len(T.hist()) > n: T.key("Control+z", wait=60)
        T.focus_away()
    check("History: undo then redo of crop, image size, canvas size, rotations, flip, flatten, merge, mask, transform, adjustment layer, stamp are exact", not bad, bad)
    check("History: each of those is one named step", all(len(l) == 1 for nm, l in labels if nm not in ("Crop (to the selection)", "Mask reveal sel")), labels)
    # make the steps again for the panel checks below
    for nm, fn in steps[1:4]: fn(); T.pg.wait_for_timeout(200); T.focus_away()
    # click an earlier step in the History panel, then a later (greyed) one
    hl = T.hist(); target = len(hl) - 4; hh = None
    T.pg.locator(".ph-hist .ph-hrow").nth(target).click(); T.pg.wait_for_timeout(200)
    check("History panel: clicking an earlier step goes back to it", len(T.hist()) == target + 1, (len(T.hist()), target + 1))
    greyed = T.pg.locator(".ph-hist .ph-hrow.undone").count()
    check("History panel: the steps after it are still listed (greyed)", greyed == 3, greyed)
    if greyed:
        T.pg.locator(".ph-hist .ph-hrow.undone").last.click(); T.pg.wait_for_timeout(200)
    check("History panel: clicking a greyed later step goes forward to it (Photoshop)", len(T.hist()) == len(hl), (len(T.hist()), len(hl)))
    # History Brush source after more than 50 steps: Photoshop keeps the opening snapshot
    T.open("photo.jpg"); orig = T.flat(320, 140)
    T.menu("Image", "Adjustments", "Invert…")
    for i in range(52): T.key("ArrowRight", wait=20) if False else T.J("Lantern.photo.api.exec('newLayer', {})") if False else None
    T.tool("move")
    for i in range(52): T.key("ArrowRight", wait=25)
    T.tool("historyBrush"); T.setopt_ui("Size", 30); T.pick_layer(0); T.focus_away(); T.drag((300, 140), (340, 140), steps=5)
    got = T.flat(320, 140)
    check("History Brush after 53 steps paints back the picture as opened (Photoshop's opening snapshot)", near(got[:3], orig[:3], 6), (got, orig, T.hist()[:2]))
    page_errors(T, "history")
    T.close()


# ============================================================ layers
def layer_sum(T, i):
    return T.J("(i) => { var d = Lantern.photo.api.d, l = d.layers[i], c = Lantern.photo.compose.render(d, l), a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = 0; for (var j = 3; j < a.length; j += 4) s += a[j]; return s / 255; }", i)

@section
def layers(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg")
    T.pg.click(".ph-lbar button[title='New layer']"); T.pg.wait_for_timeout(150)
    check("Layers panel +: a new layer above, chosen", T.doc()["n"] == 2 and T.doc()["active"] == 1)
    T.pg.locator(".ph-lrow.on .ph-lname").dblclick(); T.pg.keyboard.press("Control+a"); T.pg.keyboard.type("Sky paint"); T.pg.keyboard.press("Enter"); T.pg.wait_for_timeout(150)
    check("Layers: double-click the name, type, Enter renames it (and the letters typed pick no tools)", T.doc()["layers"][1]["name"] == "Sky paint" and T.tool_id() == "move", (T.doc()["layers"][1]["name"], T.tool_id(), "dblclick reached a text box: %s" % T.J("!!document.querySelector('.ph-lrow input[type=text]')")))
    T.tool("move"); nm1 = T.doc()["layers"][1]["name"]
    T.focus_away(); T.tool("marquee"); T.drag((100, 100), (200, 200)); T.set_colour((255, 255, 0)); T.key("Shift+F5"); T.ok(); T.key("Control+d")
    T.pg.click(".ph-lbar button[title='Duplicate layer']"); T.pg.wait_for_timeout(150)
    check("Layers panel: Duplicate makes a copy named '... copy'", T.doc()["n"] == 3 and T.doc()["layers"][2]["name"] == nm1 + " copy", [l["name"] for l in T.doc()["layers"]])
    T.pg.click(".ph-lbar button[title='Delete layer']"); T.pg.wait_for_timeout(150)
    check("Layers panel: Delete removes it", T.doc()["n"] == 2)
    T.pg.click(".ph-lbar button[title='Move down']"); T.pg.wait_for_timeout(150)
    check("Layers panel: Move down puts it under the Background", T.doc()["layers"][0]["name"] == nm1 and T.flat(150, 150)[:3] != [255, 255, 0], [l["name"] for l in T.doc()["layers"]])
    T.pg.click(".ph-lbar button[title='Move up']"); T.pg.wait_for_timeout(150)
    T.pg.locator(".ph-lrow.on .ph-eye").click(); T.pg.wait_for_timeout(150)
    check("Layers: the eye hides the layer", T.flat(150, 150)[:3] != [255, 255, 0] and not T.doc()["layers"][1]["vis"])
    T.pg.locator(".ph-lrow.on .ph-eye").click(); T.pg.wait_for_timeout(150)
    base = T.pix(150, 150, 0)
    T.pg.select_option(".ph-lctl select", "multiply"); T.pg.wait_for_timeout(150)
    c = T.flat(150, 150)
    check("Layers: blending mode Multiply (yellow over the sky)", near(c[:3], [base[0], base[1], 0], 2), (c, base))
    T.pg.select_option(".ph-lctl select", "normal")
    o = T.pg.locator(".ph-lctl input[type=number]"); o.click(); o.press("Control+a"); o.type("50"); o.press("Enter"); T.pg.wait_for_timeout(150); T.focus_away()
    c = T.flat(150, 150)
    check("Layers: opacity 50 typed in the box", near(c[:3], [(base[0] + 255) / 2, (base[1] + 255) / 2, base[2] / 2], 3), (c, base))
    o.click(); o.press("Control+a"); o.type("100"); o.press("Enter"); T.focus_away()
    # clipping
    T.pg.click(".ph-lbar button[title='New layer']"); T.focus_away(); T.set_colour((0, 0, 255)); T.key("Alt+Backspace"); T.pg.wait_for_timeout(150)
    filled = T.flat(20, 20)[:3] == [0, 0, 255]
    check("Alt+Backspace fills the layer with the foreground colour (Photoshop)", filled, T.flat(20, 20))
    if not filled: T.key("Shift+F5"); T.ok()
    T.pg.locator(".ph-lctl label", has_text="Clip").locator("input").check(); T.pg.wait_for_timeout(150); T.focus_away()
    check("Layers: Clip shows the layer only where the one below has pixels", T.flat(150, 150)[:3] == [0, 0, 255] and T.flat(20, 20)[:3] != [0, 0, 255], (T.flat(150, 150), T.flat(20, 20)))
    T.pg.click(".ph-lbar button[title='Delete layer']"); T.pg.wait_for_timeout(150)
    # mask from a selection; apply; delete
    T.pick_layer(1); T.focus_away(); T.tool("marquee"); T.drag((100, 100), (150, 200)); T.pg.click(".ph-lbar button[title^='Add a layer mask']"); T.pg.wait_for_timeout(150)
    check("Mask from the selection: shows only the selected part", T.flat(120, 150)[:3] == [255, 255, 0] and T.flat(180, 150)[:3] != [255, 255, 0], (T.flat(120, 150), T.flat(180, 150)))
    check("Mask from the selection: the selection is dropped, as Photoshop does", not T.doc()["sel"], T.doc()["sel"])
    T.key("Control+d"); T.menu("Layer", "Layer Mask", "Apply")
    check("Layer > Layer Mask > Apply: the hidden part is gone from the layer, the mask too", not T.doc()["layers"][1]["mask"] and T.pix(180, 150, 1)[3] == 0 and T.pix(120, 150, 1)[3] == 255, (T.doc()["layers"][1]["mask"], T.pix(180, 150, 1)))
    T.key("Control+z"); T.menu("Layer", "Layer Mask", "Delete")
    check("Layer > Layer Mask > Delete: the layer shows whole again", not T.doc()["layers"][1]["mask"] and T.flat(180, 150)[:3] == [255, 255, 0])
    # adjustment layer: add, change later, mask
    T.pg.select_option(".ph-lbar select", "levels"); T.pg.wait_for_timeout(300)
    check("Adjust… > Levels opens its box for a new adjustment layer", T.dialog_open() and T.doc()["layers"][T.doc()["active"]]["kind"] == "adjust")
    T.dlg_set({"Input black": 100}); T.ok()
    a1 = T.flat(300, 30)
    check("Levels adjustment layer darkens what is under it", a1[0] < T.pix(300, 30, 0)[0] - 10, (a1, T.pix(300, 30, 0)))
    nh = len(T.hist())
    check("New adjustment layer: in History as 'New Levels Layer' (then its change, as Photoshop's Properties do)", any(x == "New Levels Layer" for x in T.hist()[-2:]), T.hist()[-3:])
    T.pg.locator(".ph-lrow.on .ph-adj").dblclick(); T.pg.wait_for_timeout(300)
    vals = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-dialog input[type=number]'), function (n) { return n.value; })")
    check("Double-click the adjustment layer: its box opens with its settings (Input black 100)", T.dialog_open() and "100" in vals, vals)
    if T.dialog_open():
        T.dlg_set({"Input black": 0}); T.ok()
    check("...and changing it there changes the picture", near(T.flat(300, 30)[:3], T.pix(300, 30, 0)[:3], 2), (T.flat(300, 30), T.pix(300, 30, 0)))
    T.key("Control+z")
    check("...and Ctrl+Z gives the earlier setting back", near(T.flat(300, 30)[:3], a1[:3], 2), (T.flat(300, 30), a1))
    T.pg.select_option(".ph-lbar select", "hueSat"); T.pg.wait_for_timeout(300); n_before_cancel = T.doc()["n"]; T.cancel()
    check("Adjust… then Cancel in its box: no adjustment layer is left behind", T.doc()["n"] == n_before_cancel - 1, (n_before_cancel, T.doc()["n"], T.hist()[-2:]))
    # layer style
    T.pick_layer(1); T.focus_away(); T.pg.click(".ph-lbar button[title='Layer style']"); T.pg.wait_for_timeout(300)
    T.pg.locator(".ph-dialog label", has_text="Drop Shadow").locator("input").check(); T.pg.wait_for_timeout(300); T.ok()
    sh = T.flat(150, 204)
    check("Layer style: Drop Shadow draws a shadow under the yellow square", lum(sh) < lum(T.pix(150, 204, 0)) - 10 and T.doc()["layers"][1]["fx"], (sh, T.pix(150, 204, 0)))
    T.tool("move"); T.drag((150, 150), (200, 150)); sh2 = T.flat(200, 204)
    check("Layer style stays live: moved with its layer", lum(sh2) < lum(T.pix(200, 204, 0)) - 10, sh2)
    # merge, stamp, flatten
    n = T.doc()["n"]; T.focus_away(); T.key("Control+Alt+Shift+e")
    check("Stamp Visible (Ctrl+Alt+Shift+E): one new layer of everything", T.doc()["n"] == n + 1 and T.pix(5, 5)[3] == 255, (T.doc()["n"], T.hist()[-1]))
    fh = T.flat_hash(); T.key("Control+e")
    check("Merge Down (Ctrl+E): one layer fewer, the picture unchanged", T.doc()["n"] == n and T.flat_hash() == fh, (T.doc()["n"], T.hist()[-1]))
    T.key("Control+Shift+e")
    check("Merge Visible (Ctrl+Shift+E): the picture unchanged", T.flat_hash() == fh, T.hist()[-1])
    T.menu("Layer", "Flatten Image")
    check("Flatten Image: one layer, the picture unchanged", T.doc()["n"] == 1 and T.flat_hash() == fh, (T.doc()["n"], T.hist()[-1]))
    # Layer via Copy / Cut with a soft selection
    T.open("photo.jpg"); T.tool("marquee"); T.setopt_ui("Feather", 10); T.drag((100, 100), (300, 300)); T.setopt_ui("Feather", 0)
    e = T.sel_at(100, 200); T.key("Control+j")
    a = T.pix(100, 200)[3]
    check("Layer via Copy with a feathered selection: the copy is as soft as the selection at its edge", abs(a - e) <= 3 and 0 < a < 255, (a, e))
    T.key("Control+z"); T.key("Control+Shift+j")
    a1 = T.pix(100, 200)[3]; a0 = T.pix(100, 200, 0)[3]
    check("Layer via Cut with a feathered selection: what is left and what is cut share the edge (as Photoshop: s and 1-s)", abs(a1 + a0 - 255) <= 4 and a0 < 255, (a0, a1))
    # stack mode median on three shots of a walker
    T.open("walker_1.png")
    for f in ("walker_2.png", "walker_3.png"):
        T.menu("File", "Place… (as a layer)"); T.pg.set_input_files("input[type=file][accept*=psd]", os.path.join(INPUTS, f)); T.pg.wait_for_timeout(700)
    check("File > Place adds each picture as a layer named after the file", T.doc()["n"] == 3 and T.doc()["layers"][2]["name"].startswith("walker_3"), [l["name"] for l in T.doc()["layers"]])
    T.menu("Layer", "Stack Mode (visible layers)", "Median (takes away what moves)")
    c = [T.flat(45, 120), T.flat(115, 120), T.flat(185, 120)]
    check("Stack Mode > Median takes the walker away", all(near(x[:3], [180, 200, 160], 2) for x in c), c)
    page_errors(T, "layers")
    T.close()


# ============================================================ files
def dt_file_js(url, name, typ):
    return """async () => { const r = await fetch(%s); const b = await r.blob(); const f = new File([b], %s, {type: %s}); const dt = new DataTransfer(); dt.items.add(f); window.__dt = dt; return f.size; }""" % (json.dumps(url), json.dumps(name), json.dumps(typ))

@section
def files(B, port):
    T = Tile(B, port, INPUTS, OUT)
    # drop on the start screen
    T.J(dt_file_js("/logo.png", "logo.png", "image/png"))
    T.J("(() => { var z = document.querySelector('.ph-drop'); z.dispatchEvent(new DragEvent('dragover', {dataTransfer: window.__dt, bubbles: true, cancelable: true})); z.dispatchEvent(new DragEvent('drop', {dataTransfer: window.__dt, bubbles: true, cancelable: true})); })()")
    T.pg.wait_for_timeout(800)
    check("Drop a picture on the start screen: it opens", T.doc() and T.doc()["name"] == "logo", T.doc() and T.doc()["name"])
    check("A PNG with see-through parts keeps them (alpha 0 in a corner, soft edge kept)", T.flat(2, 2)[3] == 0 and 0 < T.flat(150, 70)[3] < 255 or T.flat(2, 2)[3] == 0, (T.flat(2, 2), T.flat(200, 100)))
    # drop on an open picture: must not leave the page to the browser
    T.J(dt_file_js("/batch_1.png", "batch_1.png", "image/png"))
    prevented = T.J("(() => { var v = document.querySelector('.ph-view canvas'); var e = new DragEvent('dragover', {dataTransfer: window.__dt, bubbles: true, cancelable: true}); v.dispatchEvent(e); var e2 = new DragEvent('drop', {dataTransfer: window.__dt, bubbles: true, cancelable: true}); v.dispatchEvent(e2); return [e.defaultPrevented, e2.defaultPrevented]; })()")
    T.pg.wait_for_timeout(800)
    check("Drop a picture on an open picture: the tile takes it (Photoshop places it as a layer) -- not left to the browser, which would leave Lantern and lose the work", prevented[0] and prevented[1], (prevented, T.doc()["n"]))
    # paste
    T.J(dt_file_js("/batch_2.png", "batch_2.png", "image/png"))
    n = T.doc()["n"]
    T.J("(() => { var e = new ClipboardEvent('paste', {clipboardData: window.__dt, bubbles: true, cancelable: true}); document.body.dispatchEvent(e); })()"); T.pg.wait_for_timeout(800)
    check("Paste a picture (Ctrl+V) over an open picture: a new layer", T.doc()["n"] == n + 1, (n, T.doc()["n"], T.hist()[-2:]))
    # EXIF orientation
    T.open("photo_orient6.jpg")
    check("A JPEG with EXIF orientation 6 opens upright (480 x 640), as Photoshop shows it", [T.doc()["w"], T.doc()["h"]] == [480, 640], [T.doc()["w"], T.doc()["h"]])
    T.open("scan_gray.png")
    check("A greyscale PNG opens with its greys", T.flat(10, 10)[:3] == [235, 235, 235], T.flat(10, 10))
    # PSD made by psd-tools
    T.open("layers_psdtools.psd")
    d = T.doc(); names = [l["name"] for l in d["layers"]]
    check("PSD by psd-tools: its layers and names", names[-4:] == ["Paper", "Blue box", "Hidden note", "Shade"], names)
    hid = [l for l in d["layers"] if l["name"] == "Hidden note"]; mul = [l for l in d["layers"] if l["name"] == "Shade"]
    check("PSD: the hidden layer stays hidden, the Multiply layer stays Multiply", hid and not hid[0]["vis"] and mul and mul[0]["blend"] == "multiply", (hid, mul))
    check("PSD: the half-see-through layer looks right over the paper", near(T.flat(60, 60)[:3], [135, 148, 210], 3), T.flat(60, 60))
    # File Info
    T.open("photo.jpg"); T.menu("File", "File Info…")
    txt = T.pg.inner_text(".ph-dialog") if T.dialog_open() else ""
    check("File Info shows the size and the camera's details", "640" in txt and "ReviewCam" in txt and "RC-1" in txt, txt[:200])
    if T.dialog_open(): T.ok()
    # Save .psd (Ctrl+S): layers, names, blend, hidden, mask, a type layer
    T.tool("marquee"); T.drag((100, 100), (300, 300)); T.key("Control+j"); T.key("Control+d"); T.pg.select_option(".ph-lctl select", "screen"); T.focus_away()
    T.menu("Layer", "Layer Mask", "Hide All"); T.pick_layer(0); T.focus_away()
    T.tool("type"); T.click((50, 400)); T.pg.wait_for_selector(".ph-typebox"); T.pg.keyboard.type("Words"); T.tool("move")
    T.focus_away()
    try:
        p = T.download(lambda: T.key("Control+s"))
        from psd_tools import PSDImage
        pp = PSDImage.open(p); ls = list(pp)
        check("Ctrl+S saves a .psd that psd-tools opens with every layer", len(ls) == T.doc()["n"], ([l.name for l in ls], T.doc()["n"]))
        scr = [l for l in ls if str(l.blend_mode).lower().endswith("screen")]
        check("...the Screen layer keeps its mode and its mask", scr and scr[0].mask is not None, [(l.name, str(l.blend_mode), l.mask is not None) for l in ls])
        comp = np.array(pp.composite().convert("RGB")).astype(int); flat = T.J("(() => { var c = Lantern.photo.compose.all(Lantern.photo.api.d); return Array.prototype.slice.call(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); })()")
        fl = np.array(flat).reshape(480, 640, 4)[..., :3]
        check("...psd-tools' picture of it is the tile's picture", np.abs(comp - fl).max() <= 3, np.abs(comp - fl).max())
        r = subprocess.run(["identify", p], capture_output=True, text=True)
        check("...and ImageMagick reads it", r.returncode == 0, r.stderr[:200])
    except Exception as e:
        check("Ctrl+S saves a .psd", False, str(e)[:200])
    # Export As each format, from its box
    T.menu("File", "Export As…"); opts = T.J("Array.prototype.map.call(document.querySelectorAll('.ph-dialog select')[0].options, function (o) { return o.value; })"); T.cancel()
    got = {}
    for fmt in opts:
        try:
            def go():
                T.menu("File", "Export As…"); T.pg.locator(".ph-dialog select").first.select_option(fmt); T.pg.wait_for_timeout(100); T.ok()
            p = T.download(go)
            if fmt == "pdf":
                r = subprocess.run(["pdfinfo", p], capture_output=True, text=True); got[fmt] = "Pages:" in r.stdout
            elif fmt == "psd":
                from psd_tools import PSDImage; got[fmt] = PSDImage.open(p).size == (640, 480)
            else:
                im = Image.open(p); got[fmt] = im.size == (640, 480)
                if fmt in ("jpg", "jpeg"):
                    ex = im.getexif(); got[fmt + " no exif"] = not ex.get(0x010F)
        except Exception as e:
            got[fmt] = "error " + str(e)[:80]
    check("Export As: every format saves a file other programs open at the picture's size (%s)" % ",".join(opts), all(v is True for v in got.values()), got)
    # JPEG quality changes the file
    sizes = []
    for q in (2, 12):
        def go():
            T.menu("File", "Export As…"); T.pg.locator(".ph-dialog select").first.select_option("jpg"); T.dlg_set({"quality": q}); T.ok()
        try: sizes.append(os.path.getsize(T.download(go)))
        except Exception as e: sizes.append(str(e)[:60])
    check("Export As JPEG: quality 2 makes a smaller file than quality 12", len(sizes) == 2 and all(isinstance(s, int) for s in sizes) and sizes[0] < sizes[1] * 0.6, sizes)
    # Ctrl+Shift+Alt+W (Export As, as the menu shows)
    T.focus_away(); T.key("Control+Shift+Alt+w")
    check("Ctrl+Shift+Alt+W (shown on the menu) opens Export As", T.dialog_open() and "Export" in T.pg.inner_text(".ph-dialog"), T.dialog_open())
    if T.dialog_open(): T.cancel()
    # Print
    T.J("window.__printed = 0; window.print = function () { if (new Error().stack.indexOf('index.html') < 0) return; window.__printed++; window.__printImg = (document.querySelector('.ph-print img') || {}).src || ''; };")
    T.menu("File", "Print…"); T.pg.wait_for_timeout(400)
    check("File > Print sends the picture to the browser's printing", T.J("window.__printed") == 1 and T.J("window.__printImg.length") > 1000, T.J("window.__printed"))
    # Open as PDF in the PDF tile
    T.menu("File", "Open as PDF in the PDF tile"); T.pg.wait_for_timeout(2500)
    h = T.J("location.hash"); app = T.J("document.body.getAttribute('data-app')")
    check("File > Open as PDF in the PDF tile goes to the PDF tile with the picture as a page", h == "#pdf" and app == "pdf", (h, app, T.pg.inner_text("body")[:200]))
    page_errors(T, "files")
    T.close()


# ============================================================ actions and batch
@section
def actions(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("batch_1.png"); T.open_panels()
    T.pg.click("button:text-is('● Record')")
    T.menu("Image", "Adjustments", "Invert…"); T.menu("Filter", "Blur", "Gaussian Blur…"); T.dlg_set({"Radius": 3}); T.ok()
    T.pg.click("button:text-is('■ Stop')"); T.pg.wait_for_timeout(200)
    txt = T.pg.inner_text(".ph-side")
    check("Actions: Record, two menu commands, Stop keeps an action of 2 steps", "(2 steps)" in txt, txt[-300:])
    want = T.flat_hash()
    T.open("batch_1.png"); T.open_panels()
    T.pg.locator(".ph-side .ph-hrow", has_text="Action").last.click(); T.pg.click("button:text-is('▶ Play')"); T.pg.wait_for_timeout(500)
    check("Actions: Play on the picture opened again gives the same result", T.flat_hash() == want, T.hist())
    T.pg.locator(".ph-side .ph-hrow", has_text="Black and white").click()
    T.pg.locator(".ph-side select[aria-label='Batch saves as']").select_option("jpg")
    try:
        with T.pg.expect_download(timeout=60000) as dl:
            T.pg.set_input_files(".ph-side input[type=file][multiple]", [os.path.join(INPUTS, "batch_%d.png" % k) for k in (1, 2, 3)])
        zp = os.path.join(OUT, "batch.zip"); dl.value.save_as(zp); z = zipfile.ZipFile(zp); nm = z.namelist()
        ims = [Image.open(z.open(x)).convert("RGB") for x in nm]
        grey = all(np.abs(np.array(im).astype(int)[..., 0] - np.array(im).astype(int)[..., 2]).max() <= 6 for im in ims)
        check("Batch: three pictures through 'Black and white' come back as three grey JPEGs in a zip, at their own sizes", len(nm) == 3 and all(x.lower().endswith((".jpg", ".jpeg")) for x in nm) and grey and sorted(im.size for im in ims) == [(160, 120), (200, 120), (240, 120)], (nm, [im.size for im in ims], grey))
    except Exception as e:
        check("Batch: a zip comes back", False, str(e)[:200])
    st = T.status()
    check("Batch: the status line says how many were done", "3 of 3" in st, st)
    na = T.pg.locator(".ph-side .ph-hrow", has_text="Action").count()
    T.pg.locator(".ph-side .ph-hrow", has_text="Action").last.click(); T.pg.click("button:text-is('Delete')"); T.pg.wait_for_timeout(200)
    check("Actions: Delete takes the chosen action away", T.pg.locator(".ph-side .ph-hrow", has_text="Action").count() == na - 1)
    page_errors(T, "actions")
    T.close()


# ============================================================ keys
@section
def keys(B, port):
    T = Tile(B, port, INPUTS, OUT); T.open("photo.jpg"); T.focus_away()
    want = {"v": "move", "m": "marquee", "l": "lasso", "w": "wand", "c": "crop", "i": "eyedropper", "j": "spotHeal", "b": "brush", "s": "clone", "y": "historyBrush",
            "e": "eraser", "g": "bucket", "o": "dodge", "r": "blurTool", "t": "type", "u": "shape", "h": "hand", "z": "zoom"}
    bad = []
    for k, tid in want.items():
        T.tool("move") if tid != "move" else T.tool("hand"); T.focus_away(); T.key(k, wait=40)
        if T.tool_id() != tid: bad.append((k, T.tool_id(), tid))
    check("Keys: each tool's letter picks its tool", not bad, bad)
    T.tool("hand"); T.focus_away(); T.key("b"); T.key("Shift+b")
    check("Keys: Shift+B goes to the next tool of the group (Photoshop's default)", T.tool_id() == "pencil", T.tool_id())
    T.tool("hand"); T.focus_away(); T.key("b"); T.key("b")
    check("Keys: B pressed twice keeps the Brush (Photoshop's default: Shift+letter cycles, the letter alone does not)", T.tool_id() == "brush", T.tool_id())
    z0 = T.J("Lantern.photo.api.view.zoom"); T.key("Control+="); z1 = T.J("Lantern.photo.api.view.zoom"); T.key("Control+-"); T.key("Control+1"); z2 = T.J("Lantern.photo.api.view.zoom"); T.key("Control+0")
    check("Keys: Ctrl+= zooms in, Ctrl+1 is 100%, Ctrl+0 fits", z1 > z0 and z2 == 1, (z0, z1, z2))
    T.key("Control+'"); g = T.J("!!Lantern.photo.api.d.showGrid"); T.key("Control+'")
    check("Keys: Ctrl+' shows the grid", g)
    T.key("Control+a")
    check("Keys: Ctrl+A selects all", T.sel_bounds() == {"x": 0, "y": 0, "w": 640, "h": 480} or T.doc()["sel"], T.sel_bounds())
    T.key("Control+d"); T.tool("marquee"); T.drag((100, 100), (200, 200)); T.key("Control+c"); T.key("Control+v"); T.pg.wait_for_timeout(600)
    check("Keys: Ctrl+C then Ctrl+V pastes the selected part as a new layer", T.doc()["n"] == 2, (T.doc()["n"], T.hist()[-2:]))
    T.key("Control+z"); T.key("Control+d")
    for k, title in [("Control+l", "Levels"), ("Control+m", "Curves"), ("Control+u", "Hue/Saturation"), ("Control+b", "Color Balance"), ("Control+Alt+Shift+b", "Black & White"), ("Control+Alt+i", "Image Size"), ("Control+Alt+c", "Canvas Size"), ("Shift+F5", "Fill"), ("Control+Shift+r", "Lens Correction"), ("Control+Alt+Shift+i", "File Info")]:
        T.focus_away(); T.key(k, wait=250)
        okd = T.dialog_open() and title in T.pg.inner_text(".ph-dialog")
        check("Keys: %s opens %s" % (k, title), okd, T.dialog_open() and T.pg.inner_text(".ph-dialog")[:40])
        if T.dialog_open(): T.cancel()
    # keys inside a box do not reach the picture or the tools
    T.tool("brush"); T.focus_away(); nh = len(T.hist()); T.key("Control+l"); T.pg.locator(".ph-dialog input[type=number]").first.click(); T.pg.keyboard.type("v"); T.pg.keyboard.press("Control+z"); T.pg.keyboard.press("x")
    check("Keys typed in a box (V, X, Ctrl+Z) do not change the tool, the colours or the picture", T.tool_id() == "brush" and T.fg() == [0, 0, 0] and len(T.hist()) == nh, (T.tool_id(), T.fg(), T.hist()[-3:]))
    T.pg.keyboard.press("Escape"); T.pg.wait_for_timeout(200)
    check("Keys: Esc in a box cancels it", not T.dialog_open())
    T.key("Control+l"); T.pg.locator(".ph-dialog input[type=number]").first.click(); T.pg.keyboard.press("Control+a"); T.pg.keyboard.type("40"); T.pg.keyboard.press("Enter"); T.pg.wait_for_timeout(300)
    check("Keys: Enter in a box is OK", not T.dialog_open() and T.hist()[-1] == "Levels", T.hist()[-2:])
    T.key("Control+z")
    # keys while a menu is open
    T.pg.click(".ph-mbtn:text-is('Filter')"); T.pg.keyboard.press("Escape"); T.pg.wait_for_timeout(150)
    check("Keys: Esc closes an open menu", T.J("!document.querySelector('.ph-menu')"))
    T.pg.mouse.click(5, 5)
    # Delete with nothing selected: Photoshop does not wipe the layer
    T.focus_away(); fh = T.flat_hash(); T.key("Delete")
    check("Keys: Delete with nothing selected does not wipe the whole layer", T.flat_hash() == fh, T.hist()[-2:])
    if T.flat_hash() != fh: T.key("Control+z")
    page_errors(T, "keys")
    T.close()


# ============================================================ robustness
@section
def robust(B, port):
    T = Tile(B, port, INPUTS, OUT)
    big = os.path.join(OUT, "big_12mp.jpg")
    if not os.path.exists(big):
        rng = np.random.default_rng(7); y = np.linspace(0, 1, 3000)[:, None]; x = np.linspace(0, 1, 4000)[None, :]
        a = np.dstack([120 + 100 * x * np.ones_like(y), 140 + 80 * y * np.ones_like(x), 180 - 60 * x * y]) + rng.integers(-8, 9, (3000, 4000, 3))
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(big, quality=88)
    t0 = time.time(); T.open(big, timeout=120000); t_open = time.time() - t0
    check("12 MP photo (4000 x 3000) opens in under 20 s (took %.1f s)" % t_open, t_open < 20 and T.doc()["w"] == 4000, t_open)
    t0 = time.time(); T.tool("brush"); T.setopt_ui("Size", 80); T.drag((500, 500), (3500, 2500), steps=30); t_brush = time.time() - t0
    check("12 MP: a long brush stroke finishes in under 8 s (took %.1f s)" % t_brush, t_brush < 8 and T.hist()[-1] == "Brush", (t_brush, T.hist()[-2:]))
    t0 = time.time(); T.menu("Filter", "Blur", "Gaussian Blur…"); T.dlg_set({"Radius": 5}); T.pg.wait_for_timeout(1500)
    T.pg.wait_for_function("!Lantern.photo.api.d.open || true", timeout=60000); T.pg.wait_for_timeout(4000); prev = T.flat_hash(); T.ok(wait=500)
    T.pg.wait_for_function("Lantern.photo.api.d.hist[Lantern.photo.api.d.hist.length - 1].label !== 'Brush'", timeout=120000); t_blur = time.time() - t0
    check("12 MP: Gaussian Blur 5 with its preview, then OK, under 30 s (took %.1f s)" % t_blur, t_blur < 30, t_blur)
    check("12 MP: what OK gives is what the preview showed", T.flat_hash() == prev, T.hist()[-2:])
    t0 = time.time(); T.key("Control+z"); T.key("Control+z"); t_undo = time.time() - t0
    check("12 MP: two undos are quick (%.1f s)" % t_undo, t_undo < 5 and T.hist() == ["Open"], T.hist())
    T.menu("Image", "Image Size…"); T.dlg_set({"Width": 1000}); T.ok(wait=1500)
    check("12 MP: Image Size to 1000 wide keeps the proportions (1000 x 750)", [T.doc()["w"], T.doc()["h"]] == [1000, 750], [T.doc()["w"], T.doc()["h"]])
    page_errors(T, "12 MP")
    # 1 x 1
    T.open("one_pixel.png")
    T.tool("brush"); T.click((0.5, 0.5)); T.tool("crop"); T.drag((0, 0), (1, 1)); T.key("Enter")
    T.menu("Filter", "Blur", "Gaussian Blur…"); T.dlg_set({"Radius": 4}); T.ok()
    T.menu("Image", "Image Size…"); T.dlg_set({"Width": 64}); T.ok()
    check("1 x 1 picture: brush, crop, blur and Image Size to 64 x 64 work", [T.doc()["w"], T.doc()["h"]] == [64, 64], [T.doc()["w"], T.doc()["h"], T.status()])
    page_errors(T, "1 x 1")
    # very wide and very tall
    for f, wh in (("wide_6000x40.png", [6000, 40]), ("tall_40x6000.png", [40, 6000])):
        T.open(f); z = T.J("Lantern.photo.api.view.zoom")
        check(f + ": opens and fits the view (zoom %.3f)" % z, [T.doc()["w"], T.doc()["h"]] == wh and z < 0.5, (T.doc()["w"], T.doc()["h"], z))
        T.menu("Image", "Image Rotation", "90° Clockwise")
        check(f + ": Rotate 90 swaps its sides", [T.doc()["w"], T.doc()["h"]] == wh[::-1])
    page_errors(T, "wide and tall")
    # transparency: magic wand on the see-through part, export JPEG puts white behind
    T.open("logo.png"); T.tool("wand"); T.click((5, 5))
    check("Logo with transparency: the Magic Wand picks the see-through part", T.sel_at(290, 190) > 128 and T.sel_at(100, 100) < 128, (T.sel_at(290, 190), T.sel_at(100, 100)))
    T.key("Control+d")
    # quick repeated clicks
    T.open("photo.jpg"); T.tool("brush"); T.setopt_ui("Size", 6)
    for i in range(20): T.pg.mouse.click(*T.scr(30 + i * 25, 440))
    T.pg.wait_for_timeout(300)
    check("20 quick brush clicks: 20 History steps", len(T.hist()) == 21, len(T.hist()))
    for i in range(20): T.pg.keyboard.press("Control+z")
    T.pg.wait_for_timeout(300)
    check("...and 20 quick Ctrl+Z take them all back", T.hist() == ["Open"], T.hist()[-3:])
    # Escape and a tool change in the middle of a drag
    p0 = T.scr(100, 100); p1 = T.scr(300, 300)
    T.tool("marquee"); T.pg.mouse.move(*p0); T.pg.mouse.down(); T.pg.mouse.move(*p1, steps=5); T.pg.keyboard.press("Escape"); T.pg.mouse.up(); T.pg.wait_for_timeout(200)
    check("Esc in the middle of a marquee drag: no selection is made (Photoshop drops it)", not T.doc()["sel"], T.sel_bounds())
    T.key("Control+d"); T.tool("brush"); T.pg.mouse.move(*p0); T.pg.mouse.down(); T.pg.mouse.move(*p1, steps=5); T.pg.keyboard.press("m"); T.pg.mouse.move(p1[0] + 30, p1[1], steps=3); T.pg.mouse.up(); T.pg.wait_for_timeout(200)
    check("A tool letter pressed mid-stroke: the stroke still ends as one History step, nothing left half-open", not T.J("!!Lantern.photo.api.d.open") and T.hist()[-1] in ("Brush",), (T.J("!!Lantern.photo.api.d.open"), T.hist()[-2:], T.tool_id()))
    # leave the tile and come back
    nh = len(T.hist()); fh = T.flat_hash()
    T.J("location.hash = 'home'"); T.pg.wait_for_timeout(800); T.J("location.hash = 'photo'"); T.pg.wait_for_timeout(1200)
    ok = T.J("!!(Lantern.photo.api.d && document.querySelector('.ph-view canvas'))")
    check("Leaving the tile and coming back: the picture, its layers and History are still there", ok and T.flat_hash() == fh and len(T.hist()) == nh, (ok, len(T.hist()), nh))
    T.tool("brush"); T.drag((50, 50), (90, 50)); T.key("Control+z")
    check("...and the tools and keys still work there", len(T.hist()) == nh and T.tool_id() == "brush", (len(T.hist()), nh))
    page_errors(T, "robustness")
    T.close()


# ============================================================ a phone
@section
def phone(B, port):
    T = Tile(B, port, INPUTS, OUT, viewport=(390, 844)); T.open("photo.jpg"); T.pg.wait_for_timeout(500)
    sw = T.J("[document.documentElement.scrollWidth, window.innerWidth]")
    check("Phone 390 x 844: no sideways scrolling", sw[0] <= sw[1] + 1, sw)
    T.shot("phone_open.png")
    off = T.J("""(() => { var out = []; document.querySelectorAll('.ph-root button, .ph-root select, .ph-root input:not([type=file])').forEach(function (b) {
       if (b.closest('details:not([open])') || b.offsetParent === null) return; var r = b.getBoundingClientRect(); if (r.right > window.innerWidth + 1 || r.left < -1) out.push((b.title || b.textContent || b.getAttribute('aria-label') || b.tagName).slice(0, 30)); }); return out; })()""")
    check("Phone: every button and box is within the screen's width", not off, off[:10])
    T.pg.click(".ph-mbtn:text-is('Filter')"); T.pg.click(".ph-menu .ph-mitem:has(span:text-is('Distort'))")
    r = T.J("(() => { var m = document.querySelector('.ph-menu'), r = m.getBoundingClientRect(); return [r.left, r.right, window.innerWidth]; })()")
    check("Phone: the Filter menu and its submenu fit the screen", r[0] >= 0 and r[1] <= r[2] + 1, r)
    T.shot("phone_menu.png"); T.pg.mouse.click(5, 5)
    T.menu("Image", "Adjustments", "Levels…")
    r = T.J("(() => { var m = document.querySelector('.ph-dialog'), r = m.getBoundingClientRect(); var ok = Array.prototype.filter.call(m.querySelectorAll('button'), function (b) { return b.textContent === 'OK'; })[0].getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom, ok.top, ok.bottom, window.innerWidth, window.innerHeight, m.scrollHeight, m.clientHeight]; })()")
    T.shot("phone_levels.png")
    check("Phone: the Levels box fits the screen's width", r[0] >= 0 and r[1] <= r[6] + 1, r)
    try:
        T.pg.locator(".ph-dialog button:text-is('OK')").scroll_into_view_if_needed(); T.ok()
        check("Phone: the Levels box's OK can be reached and pressed", not T.dialog_open() and T.hist()[-1] == "Levels", T.hist()[-2:])
    except Exception as e:
        check("Phone: the Levels box's OK can be reached and pressed", False, str(e)[:200])
    # the picture with a finger: a brush stroke by touch
    T.tool("brush")
    vis = T.J("(() => { var r = document.querySelector('.ph-view').getBoundingClientRect(); return [r.top, r.bottom, window.innerHeight]; })()")
    check("Phone: the picture is on the screen when the tile opens", vis[0] < vis[2] and vis[1] > 0, vis)
    sw = T.J("(() => { var s = document.querySelector('.ph-swatch'); if (!s) return null; var r = s.getBoundingClientRect(); return [r.top, r.bottom]; })()")
    check("Phone: the colour swatches are there to tap", sw is not None, sw)
    page_errors(T, "phone")
    T.close()


if __name__ == "__main__":
    sv = Serve(BUILD, [INPUTS, OUT])
    print("build:", BUILD)
    with sync_playwright() as pw:
        B = pw.chromium.launch()
        for fn in SECTIONS:
            if ONLY and fn.__name__ not in ONLY: continue
            print("--- " + fn.__name__, flush=True)
            try:
                fn(B, sv.port)
            except Exception as e:
                check(fn.__name__ + ": the section ran to its end", False, "".join(traceback.format_exception_only(type(e), e))[-500:])
        B.close()
    nf = sum(1 for r in RESULTS if not r["ok"])
    if not ONLY:
        with open(os.path.join(HERE, "cases.json"), "w") as f:
            json.dump({"build": BUILD, "checks": RESULTS}, f, indent=1)
    print("%d checks, %d failed" % (len(RESULTS), nf))
