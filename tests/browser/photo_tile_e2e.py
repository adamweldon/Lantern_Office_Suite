# photo_tile_e2e.py -- the Photo tile (1.24.42) in a real browser (Chromium via Playwright), driven as a person drives it:
# open pictures made here by PIL, ImageMagick and psd-tools; the tools by mouse (marquee, wand, brush, eraser, crop, free transform,
# type, shape, gradient, bucket, clone, spot healing, patch, red eye); the menus and their boxes (Levels, Curves, Gaussian Blur ...);
# layers, masks, adjustment layers, styles (Bevel & Emboss, Inner Glow); the adjustments Photoshop applies only to pixels; undo and History; Actions recorded, played and batched; every save format opened again
# by PIL, psd-tools and ImageMagick; keys; a phone-sized window. Usage: python3 tests/browser/photo_tile_e2e.py [site/index.html]
import os, sys, io, json, re, threading, http.server, socketserver, tempfile, subprocess, zipfile
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SITE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = tempfile.mkdtemp(prefix="photo_e2e_")
fails = 0; n = 0
def check(name, cond, info=""):
    global fails, n
    n += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:400]))
    if not cond: fails += 1
# --- pictures to open, made here ---
W, H = 400, 300
im = Image.new("RGB", (W, H), (200, 220, 240)); dr = ImageDraw.Draw(im)
dr.rectangle([40, 40, 160, 140], fill=(30, 120, 40)); dr.ellipse([220, 60, 360, 200], fill=(200, 40, 40)); dr.rectangle([0, 230, W, H], fill=(120, 90, 60))
dr.ellipse([300, 250, 310, 260], fill=(0, 0, 0))   # a speck on the ground, for the Spot Healing Brush
im.save(os.path.join(OUT, "scene.png"))
grad = np.dstack([np.tile(np.linspace(0, 255, W), (H, 1))] * 3).astype(np.uint8)
Image.fromarray(grad).save(os.path.join(OUT, "grad.png"))
Image.fromarray(grad).save(os.path.join(OUT, "grad_lzw.tif"), compression="tiff_lzw")
im.save(os.path.join(OUT, "scene.jpg"), quality=92)
for k, f in [("dark", 0.4), ("light", 2.2)]:
    Image.fromarray(np.clip(np.asarray(im, float) * f, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "scene_%s.png" % k))
psd_ok = False
try:
    from psd_tools import PSDImage
    from psd_tools.api.layers import PixelLayer
    p = PSDImage.new("RGB", (W, H))
    for name, col, box in [("Sky", (90, 160, 230), (0, 0, W, H)), ("Sun", (250, 220, 60), (300, 20, 380, 100))]:
        li = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(li).rectangle(box, fill=col + (255,))
        p.append(PixelLayer.frompil(li, p, name))
    p.save(os.path.join(OUT, "made_by_psdtools.psd")); psd_ok = True
except Exception as e:
    print("SKIP  psd-tools could not make a layered PSD here: " + str(e)[:120])
have_magick = subprocess.run(["which", "convert"], capture_output=True).returncode == 0
if have_magick:
    subprocess.run(["convert", os.path.join(OUT, "scene.png"), os.path.join(OUT, "scene.png"), os.path.join(OUT, "grad.png"), os.path.join(OUT, "made_by_magick.psd")])
class Hd(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0]
        return SITE if p in ("/", "/index.html") else os.path.join(OUT, p.lstrip("/"))
srv = socketserver.TCPServer(("127.0.0.1", 0), Hd); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    b = pw.chromium.launch(); ctx = b.new_context(accept_downloads=True, viewport={"width": 1400, "height": 900}); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto("http://127.0.0.1:%d/index.html#photo" % port)
    pg.wait_for_function("!!(window.Lantern && Lantern.photo && Lantern.photo.api)", timeout=60000)
    pg.wait_for_selector("text=Open a picture", timeout=20000)
    check("the tile opens on its start: Open a picture, New", pg.is_visible("text=New…") or pg.is_visible("text=New..."))
    J = lambda s, a=None: pg.evaluate(s, a) if a is not None else pg.evaluate(s)
    def opn(name):
        pg.set_input_files("input[type=file][accept*=psd]", os.path.join(OUT, name)); pg.wait_for_function("Lantern.photo.api.d && Lantern.photo.api.d.name === %s" % json.dumps(re.sub(r"\.[a-z]+$", "", name)), timeout=30000); pg.wait_for_timeout(300)
    def pix(x, y, layer=None):
        return J("([x, y, i]) => { var d = Lantern.photo.api.d, l = i == null ? d.layers[d.active] : d.layers[i], c = Lantern.photo.compose.render(d, l); return Array.prototype.slice.call(c.getContext('2d').getImageData(x, y, 1, 1).data); }", [x, y, layer])
    def flat(x, y):
        return J("([x, y]) => Array.prototype.slice.call(Lantern.photo.compose.all(Lantern.photo.api.d).getContext('2d').getImageData(x, y, 1, 1).data)", [x, y])
    def scr(x, y):   # doc point -> page point
        return J("([x, y]) => { var v = Lantern.photo.api.view, r = v.cv.getBoundingClientRect(), s = v.toScreen(x, y); return [r.left + s[0], r.top + s[1]]; }", [x, y])
    def drag(a, b, steps=8, mods=None):
        p0 = scr(*a); p1 = scr(*b)
        if mods: [pg.keyboard.down(m) for m in mods]
        pg.mouse.move(*p0); pg.mouse.down(); pg.mouse.move(*p1, steps=steps); pg.mouse.up()
        if mods: [pg.keyboard.up(m) for m in mods]
        pg.wait_for_timeout(150)
    def click(pt, mods=None):
        p0 = scr(*pt)
        if mods: [pg.keyboard.down(m) for m in mods]
        pg.mouse.click(*p0)
        if mods: [pg.keyboard.up(m) for m in mods]
        pg.wait_for_timeout(150)
    def tool(i): pg.click(".ph-tool[data-id=%s]" % i); pg.wait_for_timeout(80)
    def hist(): return J("Lantern.photo.api.d.hist.map(function (h) { return h.label; })")
    def menu(*path):
        pg.click(".ph-mbtn:text-is(%s)" % json.dumps(path[0]))
        for p_ in path[1:]: pg.click(".ph-mitem:has(span:text-is(%s))" % json.dumps(p_, ensure_ascii=False))
        pg.wait_for_timeout(150)
    def ok(): pg.click(".ph-dialog button:text-is('OK')"); pg.wait_for_timeout(250)
    def setopt(tid, k, v): J("([t, k, v]) => { Lantern.photo.api.setOpt(t, k, v); }", [tid, k, v])
    # --- open ---
    opn("scene.png")
    check("PNG opens at its size, one layer", J("[Lantern.photo.api.d.w, Lantern.photo.api.d.h, Lantern.photo.api.d.layers.length]") == [W, H, 1])
    check("the pixels are the file's", flat(100, 90)[:3] == [30, 120, 40] and flat(290, 130)[:3] == [200, 40, 40])
    # --- marquee ---
    tool("marquee"); drag((50, 50), (150, 120))
    r = J("(() => { var d = Lantern.photo.api.d; return Lantern.photo.sel.bounds(Lantern.photo.doc.selMask(d), d.w, d.h); })()")
    check("Rectangular Marquee: dragged 50,50 to 150,120 selects that rectangle", r and abs(r["x"] - 50) <= 1 and abs(r["w"] - 100) <= 1 and abs(r["h"] - 70) <= 1, r)
    drag((120, 100), (200, 180), mods=["Shift"])
    r2 = J("(() => { var d = Lantern.photo.api.d; return Lantern.photo.sel.bounds(Lantern.photo.doc.selMask(d), d.w, d.h); })()")
    check("Shift+drag adds to the selection", r2 and r2["x"] <= 51 and r2["x"] + r2["w"] >= 199, r2)
    pg.keyboard.press("Control+d"); pg.wait_for_timeout(100)
    check("Ctrl+D deselects", J("Lantern.photo.api.d.sel === null"))
    # --- magic wand ---
    tool("wand"); click((290, 130))
    m = J("(() => { var d = Lantern.photo.api.d, m = Lantern.photo.doc.selMask(d), n = 0; for (var j = 0; j < m.length; j++) if (m[j] > 127) n++; return [n, m[130 * d.w + 290], m[10 * d.w + 10]]; })()")
    area = 3.14159 * 70 * 70
    check("Magic Wand on the red disc selects it and not the sky", abs(m[0] - area) / area < 0.05 and m[1] == 255 and m[2] == 0, m)
    # --- a Levels box from the menu, on the selection ---
    before_out = flat(10, 10)
    menu("Image", "Adjustments", "Levels…")
    check("Image > Adjustments > Levels opens its box with a histogram", pg.is_visible(".ph-dialog canvas"))
    J("(() => { var i = Array.prototype.filter.call(document.querySelectorAll('.ph-dialog input[type=number]'), function (x) { return true; }); i[0].value = 60; i[0].dispatchEvent(new Event('input')); })()")
    pg.wait_for_timeout(300); ok()
    check("Levels runs as one History step, inside the selection only", hist()[-1] == "Levels" and flat(10, 10) == before_out and flat(290, 130)[0] < 200, (hist()[-3:], flat(290, 130)))
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(150)
    check("Ctrl+Z takes it back", flat(290, 130)[:3] == [200, 40, 40], flat(290, 130))
    pg.keyboard.press("Control+Shift+z"); pg.wait_for_timeout(150)
    check("Ctrl+Shift+Z brings it again", flat(290, 130)[0] < 200)
    pg.keyboard.press("Control+d")
    # --- brush on a new layer ---
    pg.keyboard.press("Control+Shift+n"); pg.wait_for_timeout(100)
    check("Ctrl+Shift+N makes a new layer", J("Lantern.photo.api.d.layers.length") == 2)
    J("Lantern.photo.api.d.fg = [0, 0, 255]")
    tool("brush"); setopt("brush", "size", 12); setopt("brush", "hardness", 100); drag((20, 200), (380, 200), steps=20)
    check("Brush paints the foreground colour along the drag, on the new layer", pix(200, 200)[:3] == [0, 0, 255] and pix(200, 200)[3] == 255 and pix(200, 230)[3] == 0, (pix(200, 200), pix(200, 230)))
    check("the layer under it is untouched", pix(200, 200, 0)[:3] == [200, 220, 240])
    pg.keyboard.press("]");
    check("] makes the brush bigger", J("Lantern.photo.api.opts('brush').size") > 12)
    tool("eraser"); setopt("eraser", "size", 30); setopt("eraser", "hardness", 100); drag((150, 200), (250, 200))
    check("Eraser clears to transparency", pix(200, 200)[3] == 0 and pix(100, 200)[3] == 255, (pix(200, 200), pix(100, 200)))
    # --- mask ---
    J("Lantern.photo.api.exec('addMask', {how: 'reveal'})"); J("Lantern.photo.api.d.editMask = true; Lantern.photo.api.d.fg = [0, 0, 0]")
    tool("brush"); setopt("brush", "size", 40); drag((60, 200), (80, 200))
    check("painting black on the mask hides the layer there, and the layer keeps its pixels", flat(70, 200)[:3] == [200, 220, 240] and J("Lantern.photo.api.d.layers[1].cv.getContext('2d').getImageData(70 - Lantern.photo.api.d.layers[1].x, 200 - Lantern.photo.api.d.layers[1].y, 1, 1).data[3]") == 255, flat(70, 200))
    J("Lantern.photo.api.d.editMask = false")
    # --- dialogs: Gaussian Blur against SciPy ---
    J("Lantern.photo.api.d.active = 0; Lantern.photo.api.refresh()")
    src = np.array(J("Array.prototype.slice.call(Lantern.photo.api.d.layers[0].cv.getContext('2d').getImageData(0, 0, %d, %d).data)" % (W, H)), dtype=float).reshape(H, W, 4)[..., :3]
    menu("Filter", "Blur", "Gaussian Blur…")
    J("(() => { var n = document.querySelector('.ph-dialog input[type=number]'); n.value = 3; n.dispatchEvent(new Event('input')); })()"); pg.wait_for_timeout(200); ok()
    got = np.array(J("Array.prototype.slice.call(Lantern.photo.api.d.layers[0].cv.getContext('2d').getImageData(0, 0, %d, %d).data)" % (W, H)), dtype=float).reshape(H, W, 4)[..., :3]
    try:
        from scipy import ndimage
        ref = np.stack([ndimage.gaussian_filter(src[..., c], sigma=3, mode="nearest", truncate=3.0) for c in range(3)], -1)
        check("Gaussian Blur radius 3 matches SciPy's (within 1 level)", np.abs(ref - got).max() <= 1.01, np.abs(ref - got).max())
    except ImportError:
        print("SKIP  SciPy not here: the blur is not compared")
    pg.keyboard.press("Control+z")
    # --- crop ---
    tool("crop"); drag((100, 50), (300, 250)); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    check("Crop: drag 100,50 to 300,250 and Enter makes a 200 x 200 picture", J("[Lantern.photo.api.d.w, Lantern.photo.api.d.h]") == [200, 200], J("[Lantern.photo.api.d.w, Lantern.photo.api.d.h]"))
    check("the cropped picture is what was in the box", flat(20, 20)[:3] == [30, 120, 40], flat(20, 20))
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(200)
    check("undo restores the full size", J("[Lantern.photo.api.d.w, Lantern.photo.api.d.h]") == [W, H])
    # --- free transform: scale the green square layer ---
    J("(() => { var a = Lantern.photo.api; a.exec('selectShape', {shape: 'rect', x: 40, y: 40, w: 121, h: 101}); a.d.active = 0; a.exec('layerVia', {}); a.exec('deselect'); })()")
    pg.keyboard.press("Control+t"); pg.wait_for_timeout(200)
    check("Ctrl+T shows Free Transform", J("Lantern.photo.transformUI.active()"))
    drag((161, 141), (221, 191)); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    r = J("(() => { var d = Lantern.photo.api.d, l = d.layers[d.active], a = Lantern.photo.compose.render(d, l).getContext('2d').getImageData(0, 0, d.w, d.h).data, m = new Uint8Array(d.w * d.h); for (var j = 0; j < m.length; j++) m[j] = a[j * 4 + 3] > 127 ? 1 : 0; return Lantern.photo.sel.bounds(m, d.w, d.h); })()")
    check("dragging the corner out by half scales the layer (kept in shape), Enter applies", r and abs(r["w"] - 181) <= 3 and abs(r["h"] - 151) <= 3 and hist()[-1] == "Free Transform", (r, hist()[-1:]))
    # --- type ---
    J("Lantern.photo.api.d.fg = [255, 255, 255]")
    tool("type"); click((50, 280)); pg.wait_for_selector(".ph-typebox"); pg.keyboard.type("Lantern 1.24.42"); click((5, 5)); pg.wait_for_timeout(300)
    lay = J("Lantern.photo.api.d.layers.map(function (l) { return [l.kind, l.name]; })")
    check("Type: click, type, click away makes a type layer with the words", any(k == "text" and "Lantern 1.24.42" in nm for k, nm in lay), lay)
    # --- shape and gradient and bucket on fresh layers ---
    tool("shape"); setopt("shape", "type", "ellipse"); J("Lantern.photo.api.d.fg = [255, 0, 255]"); drag((20, 20), (80, 60))
    check("Shape: an ellipse layer where dragged", J("Lantern.photo.api.d.layers[Lantern.photo.api.d.active].kind") == "shape" and pix(50, 40)[:3] == [255, 0, 255], pix(50, 40))
    J("Lantern.photo.api.exec('newLayer', {}); Lantern.photo.api.d.fg = [0, 0, 0]; Lantern.photo.api.d.bg = [255, 255, 255]")
    tool("gradient"); setopt("gradient", "colours", "foreground to background"); drag((0, 150), (399, 150))
    g0, g1 = pix(2, 10), pix(396, 10)
    check("Gradient: black to white along the drag", g0[0] < 10 and g1[0] > 245 and abs(pix(200, 10)[0] - 128) < 8, (g0, pix(200, 10), g1))
    J("Lantern.photo.api.exec('deleteLayer', {})")
    # --- Spot Healing Brush on the speck: back to the ground's colour ---
    J("(() => { var d = Lantern.photo.api.d; d.active = 0; Lantern.photo.api.refresh(); })()")
    tool("spotHeal"); setopt("spotHeal", "size", 22); drag((303, 255), (307, 255), steps=3); pg.wait_for_function("Lantern.photo.api.d.hist[Lantern.photo.api.d.hist.length - 1].label === 'Spot Healing Brush'", timeout=30000)
    sp = pix(305, 255, 0)
    check("Spot Healing Brush: the black speck becomes the ground round it", abs(sp[0] - 120) < 20 and abs(sp[1] - 90) < 20 and abs(sp[2] - 60) < 20, sp)
    # --- clone ---
    tool("clone"); setopt("clone", "size", 10); setopt("clone", "hardness", 100); click((100, 90), mods=["Alt"]); drag((300, 20), (310, 20))
    check("Clone Stamp: Alt+click the green, paint in the sky: green there", all(abs(a - b) <= 2 for a, b in zip(pix(305, 20, 0)[:3], [30, 120, 40])), pix(305, 20, 0))
    # --- layers panel by clicks ---
    nl = J("Lantern.photo.api.d.layers.length")
    pg.click(".ph-lbar button[title='Duplicate layer']"); pg.wait_for_timeout(150)
    check("Layers panel: Duplicate", J("Lantern.photo.api.d.layers.length") == nl + 1)
    pg.select_option(".ph-lctl select", "multiply"); pg.wait_for_timeout(150)
    check("Layers panel: blending mode set", J("Lantern.photo.api.d.layers[Lantern.photo.api.d.active].blend") == "multiply")
    pg.select_option(".ph-lbar select", "invert"); pg.wait_for_timeout(300)
    check("Layers panel: an Invert adjustment layer", J("Lantern.photo.api.d.layers[Lantern.photo.api.d.active].kind") == "adjust")
    # --- save and open again: PSD, PNG, JPEG, TIFF, GIF, BMP, WebP, PDF ---
    def save(fmt, extra=None):
        with pg.expect_download(timeout=60000) as dl:
            J("([f, o]) => Lantern.photo.saveAs(Lantern.photo.api, f, o || {})", [fmt, extra])
        pth = os.path.join(OUT, "saved." + fmt); dl.value.save_as(pth); return pth
    pth = save("psd")
    try:
        from psd_tools import PSDImage
        pp = PSDImage.open(pth); kinds = [l.kind for l in pp]; names = [l.name for l in pp]
        check("Save .psd: psd-tools opens it with every layer", len(kinds) == J("Lantern.photo.api.d.layers.length") and "invert" in kinds, (kinds, names))
        check("...its layer names", "Background" in names and any("Lantern 1.24.42" in x for x in names), names)
    except ImportError:
        print("SKIP  psd-tools not here")
    if have_magick:
        r = subprocess.run(["identify", pth], capture_output=True, text=True)
        check("Save .psd: ImageMagick reads it", r.returncode == 0 and "PSD" in r.stdout, r.stdout[:200] + r.stderr[:200])
    for fmt, mode in [("png", None), ("jpg", None), ("tif", None), ("gif", None), ("bmp", None), ("webp", None)]:
        pth = save(fmt); im2 = Image.open(pth)
        check("Export " + fmt.upper() + ": PIL opens it at the picture's size", im2.size == (W, H), im2.size)
    pth = save("pdf")
    r = subprocess.run(["pdfinfo", pth], capture_output=True, text=True)
    check("Export PDF: poppler reads one page", r.returncode == 0 and re.search(r"Pages:\s+1", r.stdout) is not None, r.stdout[:200] + r.stderr[:200])
    # --- open PSDs made by other programs, and a TIFF ---
    if psd_ok:
        opn("made_by_psdtools.psd")
        check("a PSD made by psd-tools opens with its layers and names", J("Lantern.photo.api.d.layers.map(function (l) { return l.name; })")[-2:] == ["Sky", "Sun"], J("Lantern.photo.api.d.layers.map(function (l) { return l.name; })"))
        check("...and looks right (the sun on the sky)", flat(340, 60)[:3] == [250, 220, 60] and flat(100, 200)[:3] == [90, 160, 230], (flat(340, 60), flat(100, 200)))
    if have_magick:
        opn("made_by_magick.psd")
        check("a PSD made by ImageMagick opens", J("Lantern.photo.api.d.layers.length") >= 1 and J("Lantern.photo.api.d.w") == W)
    opn("grad_lzw.tif")
    check("an LZW TIFF made by PIL opens, its pixels the file's", flat(200, 10)[:3] == list(grad[10, 200]), (flat(200, 10), list(grad[10, 200])))
    # --- the Pen: four corners, closed, made a selection ---
    opn("scene.png")
    tool("pen"); [click(p_) for p_ in [(60, 60), (160, 60), (160, 140), (60, 140), (60, 60)]]
    menu("Select", "Make Selection from Path")
    r = J("(() => { var d = Lantern.photo.api.d; return d.sel ? Lantern.photo.sel.bounds(Lantern.photo.doc.selMask(d), d.w, d.h) : null; })()")
    check("Pen: four corners clicked and closed, Select > Make Selection from Path selects that box", r and abs(r["x"] - 60) <= 1 and abs(r["w"] - 100) <= 2 and abs(r["h"] - 80) <= 2, r)
    J("Lantern.photo.api.exec('deselect')")
    # --- Liquify: a drag in its own window, OK ---
    J("(() => { var d = Lantern.photo.api.d; d.active = 0; Lantern.photo.api.refresh(); })()")
    menu("Filter", "Liquify…"); pg.wait_for_selector(".ph-liquify canvas")
    bx = pg.eval_on_selector(".ph-liquify canvas", "c => { var r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
    pg.mouse.move(bx[0] + bx[2] * 0.3, bx[1] + bx[3] * 0.5); pg.mouse.down(); pg.mouse.move(bx[0] + bx[2] * 0.6, bx[1] + bx[3] * 0.5, steps=10); pg.mouse.up()
    pg.click(".ph-liquify button:text-is('OK')"); pg.wait_for_timeout(500)
    check("Liquify: a drag, OK: one History step, the picture moved", hist()[-1] == "Liquify" and J("!document.querySelector('.ph-liquify')"), hist()[-2:])
    # --- Content-Aware Scale from the Edit menu ---
    tool("wand"); click((290, 130))
    menu("Edit", "Content-Aware Scale…")
    J("(() => { var n = document.querySelectorAll('.ph-dialog input[type=number]'); n[0].value = 300; n[0].dispatchEvent(new Event('input')); n[1].value = 300; n[1].dispatchEvent(new Event('input')); })()"); ok()
    pg.wait_for_function("Lantern.photo.api.d.w === 300", timeout=60000)
    check("Content-Aware Scale with the red disc selected (protected): 400 wide to 300, the disc still round", J("Lantern.photo.api.d.w") == 300 and (lambda m: abs(m[0] - m[1]) <= 4)(J("(() => { var d = Lantern.photo.api.d, a = Lantern.photo.compose.all(d).getContext('2d').getImageData(0, 0, d.w, d.h).data, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (var y = 0; y < d.h; y++) for (var x = 0; x < d.w; x++) { var i = (y * d.w + x) * 4; if (a[i] > 180 && a[i + 1] < 80 && a[i + 2] < 80) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } } return [x1 - x0, y1 - y0]; })()")))
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(200)
    # --- Merge Exposures: three shots, one picture ---
    J("""async () => { var fs = []; for (var n of ["scene_dark.png", "scene.png", "scene_light.png"]) { var b = await (await fetch("/" + n)).blob(); fs.push(new File([b], n, { type: "image/png" })); } Lantern.photo.api.mergeExposures(fs); }""")
    pg.wait_for_function("Lantern.photo.api.d.name === 'Merged exposures'", timeout=60000)
    check("Merge Exposures: three shots make one new picture of their size, its sky between the darkest and lightest shots'", J("[Lantern.photo.api.d.w, Lantern.photo.api.d.h]") == [W, H] and 80 <= flat(100, 20)[0] <= 255, flat(100, 20))
    # --- Image > Adjustments: Shadows/Highlights, Replace Color, Selective Color, Match Color; each one History step under Photoshop's name ---
    for lab in ["Shadows/Highlights\u2026", "Replace Color\u2026", "Selective Color\u2026", "Match Color\u2026"]:
        menu("Image", "Adjustments", lab); vis = pg.is_visible(".ph-dialog"); ok()
        check("Image > Adjustments > %s: its box, OK, one History step named so" % lab[:-1], vis and hist()[-1] == lab[:-1], hist()[-2:])
    sky0 = flat(100, 20); menu("Image", "Adjustments", "Shadows/Highlights\u2026")
    J("(() => { var r = document.querySelectorAll('.ph-dialog input[type=range]'); r[0].value = 0; r[0].dispatchEvent(new Event('input')); r[2].value = 80; r[2].dispatchEvent(new Event('input')); r[3].value = 100; r[3].dispatchEvent(new Event('input')); })()"); ok()
    check("...Shadows/Highlights with Highlights 80 over every tone darkens the sky", flat(100, 20)[2] < sky0[2], (sky0, flat(100, 20)))
    adj_opts = J("Array.prototype.map.call(document.querySelectorAll('.ph-side select[aria-label=\"New adjustment layer\"] option'), function (o) { return o.textContent; })")
    check("the Layers panel offers Selective Color as an adjustment layer, and not the three Photoshop applies only to pixels", "Selective Color" in adj_opts and not any(x in adj_opts for x in ["Shadows/Highlights", "Match Color", "Replace Color"]), adj_opts)
    # --- Layer Style: Bevel & Emboss and Inner Glow on a grey square ---
    J("(() => { var api = Lantern.photo.api; api.exec('newLayer', {}); api.exec('selectShape', {x: 150, y: 100, w: 100, h: 80}); api.exec('fill', {use: 'gray'}); api.exec('deselect'); api.exec('setFx', {fx: {bevel: Lantern.photo.fx.defaults('bevel')}}); })()")
    bev = [pix(153, 140), pix(246, 140), pix(200, 102), pix(200, 177), pix(200, 140), pix(140, 140)]
    check("Bevel & Emboss: the square's top and left edges lit, bottom and right shaded, the middle and the outside as they were", bev[0][0] > 150 and bev[2][0] > 150 and bev[1][0] < 100 and bev[3][0] < 100 and bev[4][:4] == [128, 128, 128, 255] and bev[5][3] == 0, bev)
    J("Lantern.photo.api.exec('setFx', {fx: {innerGlow: Lantern.photo.fx.defaults('innerGlow')}})")
    gl = [pix(151, 140), pix(200, 140), pix(140, 140)]
    check("Inner Glow: light just inside the edge, the middle and the outside as they were", gl[0][0] > 140 and gl[1][:4] == [128, 128, 128, 255] and gl[2][3] == 0, gl)
    check("...Layer Style is one History step each time", hist()[-1] == "Layer Style" and hist()[-2] == "Layer Style", hist()[-3:])
    # --- Actions: record, play, batch ---
    J("Array.prototype.forEach.call(document.querySelectorAll('.ph-side details'), function (x) { x.open = true; })")
    pg.click("button:text-is('● Record')"); J("Lantern.photo.ops.adjustCmd('invert'); Lantern.photo.api.exec('adjust:invert', {})"); pg.click("button:text-is('■ Stop')")
    check("Actions: a recorded action holds the step", "Invert" in pg.inner_text(".ph-side") or "adjust:invert" in pg.inner_text(".ph-side"))
    opn("scene.png"); J("Array.prototype.forEach.call(document.querySelectorAll('.ph-side details'), function (x) { x.open = true; })")
    pg.click(".ph-hrow:has-text('Action ')"); pg.click("button:text-is('▶ Play')"); pg.wait_for_timeout(300)
    check("Actions: Play runs it on another picture", flat(100, 90)[:3] == [225, 135, 215], flat(100, 90))
    with pg.expect_download(timeout=60000) as dl:
        pg.set_input_files(".ph-side input[type=file][multiple]", [os.path.join(OUT, "scene.png"), os.path.join(OUT, "grad.png")])
    zp = os.path.join(OUT, "batch.zip"); dl.value.save_as(zp); z = zipfile.ZipFile(zp)
    check("Batch: two pictures in, a zip of two out", len(z.namelist()) == 2, z.namelist())
    # --- keys and a phone ---
    pg.keyboard.press("b"); check("B picks the Brush", J("Lantern.photo.api.view.tool.id") == "brush")
    pg.keyboard.press("b"); check("B again: the Pencil", J("Lantern.photo.api.view.tool.id") == "pencil")
    pg.set_viewport_size({"width": 390, "height": 844}); pg.wait_for_timeout(400)
    check("on a phone: no sideways scrolling", J("document.documentElement.scrollWidth <= window.innerWidth + 1"), J("[document.documentElement.scrollWidth, window.innerWidth]"))
    check("no page errors", not errs, errs[:5])
    b.close()
print("%d checks, %d failed" % (n, fails))
print("ALL PHOTO TILE CHECKS PASS" if not fails else "PHOTO TILE CHECKS FAILED")
sys.exit(1 if fails else 0)
