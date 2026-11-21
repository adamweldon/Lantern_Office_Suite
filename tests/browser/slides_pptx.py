# slides_pptx.py -- PowerPoint files in Slides (1.24.33), in a real browser (Chromium through Playwright): Open .pptx in
# the list of decks, with the browser's own file chooser, makes a deck of python-pptx's deck (tests/fixtures/pptx_1233),
# and a dialog says what could not come in as it was; its pictures are made smaller as Slides makes a picture it is given
# (a JPEG at most 1,200 pixels across: a 2,400-pixel picture comes in at 1,200); Save .pptx downloads a file python-pptx
# opens with every title; a table drawn with its lines; an EMF picture drawn by Lantern, and a slide's two pictures put
# together into one, each where it sat; the dialog and the table are photographed. Then a phone's screen (Pixel 5).
# Screenshots in the folder given (default: temp).
# Usage: python3 tests/browser/slides_pptx.py [screenshot folder]
import io, os, sys, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FX = os.path.join(ROOT, "tests", "fixtures", "pptx_1233")
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8133
URL = "http://127.0.0.1:%d/index.html#slides" % PORT
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:700]))
    if not cond: fails.append(name)
# a deck with one big picture, made here (python-pptx and PIL), or none if they are not installed
big = None
try:
    from pptx import Presentation
    from pptx.util import Inches
    from PIL import Image
    b = io.BytesIO(); Image.new("RGB", (2400, 1600), (30, 90, 160)).save(b, "PNG"); b.seek(0)
    pr = Presentation(); s = pr.slides.add_slide(pr.slide_layouts[5]); s.shapes.title.text = "A big picture"
    s.shapes.add_picture(b, Inches(1), Inches(2), Inches(6), Inches(4))
    big = os.path.join(tempfile.mkdtemp(prefix="slides_pptx_"), "Big picture.pptx"); pr.save(big)
except ImportError:
    print("SKIP  python-pptx or PIL is not installed: the big picture is not tried")
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def decks(pg):
    return pg.evaluate("() => window.Lantern.store.collection('slides.docs').all().map(function (d) { return { id: d.id, title: d.title, n: d.slides.length, imgs: d.slides.map(function (s) { return s.img ? s.img.slice(0, 23) : ''; }), notes: d.slides.map(function (s) { return s.notes || ''; }) }; })")
try:
    time.sleep(1)
    with sync_playwright() as p:
        br = p.chromium.launch()
        for label, ctx_args in [("laptop", {"viewport": {"width": 1366, "height": 768}, "accept_downloads": True}), ("phone", dict(p.devices["Pixel 5"], accept_downloads=True))]:
            ctx = br.new_context(**ctx_args)
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("dialog", lambda dlg: dlg.dismiss())
            pg.goto(URL); pg.wait_for_timeout(1500)
            with pg.expect_file_chooser() as fc:
                pg.locator("button", has_text="Open .pptx").first.click()
            fc.value.set_files(os.path.join(FX, "python_pptx.pptx"))
            pg.wait_for_timeout(1500)
            dlg = pg.evaluate("() => { var d = document.querySelector('.guide-overlay[aria-label=\"PowerPoint file\"]'); return d ? { text: d.textContent, items: d.querySelectorAll('li').length } : null; }")
            ok(label + ": Open .pptx opens python_pptx.pptx and says what could not come in as it was", dlg and "Opened from the PowerPoint file “python_pptx.pptx” (11 slides)" in dlg["text"] and dlg["items"] == 6, dlg)
            pg.screenshot(path=os.path.join(OUT, "pptx_open_%s.png" % label))
            pg.locator(".guide-overlay[aria-label='PowerPoint file'] button", has_text="OK").click()
            d = [x for x in decks(pg) if x["title"] == "python_pptx"]
            ok(label + ": the deck has its 11 slides, its notes, and its picture as a JPEG (as Slides stores one)", d and d[0]["n"] == 11 and d[0]["imgs"][5] == "data:image/jpeg;base64," and d[0]["notes"][1].startswith("Ask who"), d)
            heads = pg.evaluate("() => Array.prototype.map.call(document.querySelectorAll('.sb, h1, h2, input'), function (e) { return e.value || e.textContent; }).join(' | ').slice(0, 400)")
            ok(label + ": the deck is open in the editor", "Pump station basics" in heads or "python_pptx" in heads, heads)
            pg.locator("text=5. Float heights").first.click(); pg.wait_for_timeout(400)
            tb = pg.evaluate("() => { var c = document.querySelector('.sb td'); if (!c) return null; var st = getComputedStyle(c); return [st.borderTopWidth, st.borderTopStyle, st.paddingLeft, document.querySelectorAll('.sb tr').length]; }")
            ok(label + ": the table on slide 5 is drawn with its lines and room in its cells", tb and tb[0] == "1px" and tb[1] == "solid" and float(tb[2].replace("px", "")) > 4 and tb[3] == 4, tb)
            pg.screenshot(path=os.path.join(OUT, "pptx_table_%s.png" % label))
            with pg.expect_download() as dl:
                pg.locator("button", has_text="Save .pptx").first.click()
            path = os.path.join(OUT, "slides_%s.pptx" % label)
            dl.value.save_as(path)
            ok(label + ": Save .pptx downloads python_pptx.pptx", dl.value.suggested_filename == "python_pptx.pptx", dl.value.suggested_filename)
            try:
                from pptx import Presentation as Pr
                t = [s.shapes.title.text for s in Pr(path).slides]
                ok(label + ": python-pptx opens it: eleven slides, each title in its title box", len(t) == 11 and t[0] == "Pump station basics" and t[10] == "A Visio drawing", t)
            except ImportError:
                print("SKIP  python-pptx is not installed")
            if big:
                pg.evaluate("() => { location.hash = 'home'; }"); pg.wait_for_timeout(300)
                pg.evaluate("() => { location.hash = 'slides'; }"); pg.wait_for_timeout(700)
                with pg.expect_file_chooser() as fc:
                    pg.locator("button", has_text="Open .pptx").first.click()
                fc.value.set_files(big)
                pg.wait_for_timeout(1800)
                w = pg.evaluate("""() => new Promise(function (res) { var d = window.Lantern.store.collection('slides.docs').all().filter(function (x) { return x.title === 'Big picture'; })[0];
                  if (!d || !d.slides[0].img) return res(null); var im = new Image(); im.onload = function () { res([im.width, im.height, d.slides[0].img.slice(0, 23)]); }; im.src = d.slides[0].img; })""")
                ok(label + ": a 2,400-pixel picture comes in at 1,200 by 800, a JPEG", w and w[0] == 1200 and w[1] == 800 and w[2] == "data:image/jpeg;base64,", w)
                pg.evaluate("() => { var o = document.querySelector('.guide-overlay'); if (o) o.parentNode.removeChild(o); }")
            # an EMF picture drawn by Lantern, and a slide's two pictures put together (tests/fixtures/pptx_1233/emf.pptx)
            pg.evaluate("() => { var o = document.querySelector('.guide-overlay'); if (o) o.parentNode.removeChild(o); location.hash = 'home'; }"); pg.wait_for_timeout(300)
            pg.evaluate("() => { location.hash = 'slides'; }"); pg.wait_for_timeout(700)
            with pg.expect_file_chooser() as fc:
                pg.locator("button", has_text="Open .pptx").first.click()
            fc.value.set_files(os.path.join(FX, "emf.pptx"))
            pg.wait_for_timeout(2000)
            dlg = pg.evaluate("() => { var d = document.querySelector('.guide-overlay[aria-label=\"PowerPoint file\"]'); return d ? d.textContent : ''; }")
            ok(label + ": emf.pptx: the EMF drawn by Lantern and said so; slide 2's pictures put together and said so", "2 pictures in EMF drawn by Lantern" in dlg and "the pictures on slide 2 put together into one picture each, as they sat on the slide" in dlg and "more picture" not in dlg, dlg[:600])
            em = pg.evaluate("""() => new Promise(function (res) { var d = window.Lantern.store.collection('slides.docs').all().filter(function (x) { return x.title === 'emf'; })[0], out = [];
              if (!d) return res(null);
              var n = 0; d.slides.forEach(function (s, i) { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = im.width; c.height = im.height; var x = c.getContext('2d'); x.drawImage(im, 0, 0);
                var p = i === 0 ? x.getImageData(Math.round(im.width * 0.2), Math.round(im.height * 0.69), 1, 1).data : x.getImageData(Math.round(im.width * 0.85), Math.round(im.height * 0.5), 1, 1).data;
                out[i] = [im.width, im.height, p[0], p[1], p[2]]; if (++n === 2) res(out); }; im.onerror = function () { out[i] = null; if (++n === 2) res(out); }; im.src = s.img || ''; }); })""")
            ok(label + ": the EMF's green circle is drawn where it is in the drawing", em and em[0] and em[0][3] > 120 and em[0][3] > em[0][2] + 40 and em[0][3] > em[0][4] + 40, em)
            ok(label + ": slide 2's picture is both, side by side as on the slide (8 by 3 inches: 1,200 by 450), the red square on the right", em and em[1] and em[1][0] == 1200 and abs(em[1][1] - 450) <= 2 and em[1][2] > 150 and em[1][3] < 80, em)
            pg.screenshot(path=os.path.join(OUT, "pptx_emf_%s.png" % label))
            ok(label + ": no errors in the page", not errs, errs)
            ctx.close()
        br.close()
finally:
    srv.terminate()
print("ALL SLIDES PPTX BROWSER CHECKS PASS" if not fails else "%d SLIDES PPTX BROWSER CHECKS FAILED" % len(fails))
sys.exit(1 if fails else 0)
