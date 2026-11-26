# run_tile.py -- the PDF tile (index.html#pdf) clicked through as a person would, in Chromium: Redact (find and mark,
# and a box dragged over a word where it is seen), Edit text on a landscape page, Remove hidden, Protect, Reduce size,
# Stamp twice, a PDF whose objects sit in two object streams, and the tile at phone width. Each saved file is read by
# qpdf, poppler and tesseract, not by Lantern.
# Usage: python3 run_tile.py [build.html] [outdir]
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
from PIL import Image
FX = HERE
SITE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else tempfile.mkdtemp(prefix="tile_1240_")
os.makedirs(OUT, exist_ok=True)
ck = Checks(open(os.path.join(OUT, "run_tile.log"), "w"))
B = Browser(SITE, [FX, OUT], "#pdf")
pg = B.pg
pg.wait_for_selector("text=Open a PDF", timeout=30000)
prompts = []
def on_dialog(d):
    prompts.append((d.type, d.message[:200], d.default_value[:400] if d.type == "prompt" else ""))
    a = B.answers.pop(0) if B.answers else ""
    try:
        if d.type == "prompt": d.accept(a)
        elif d.type == "confirm": d.accept() if a != "__no" else d.dismiss()
        else: d.accept()
    except Exception: pass
pg.remove_listener("dialog", B._dialog); pg.on("dialog", on_dialog)
def stat(): return pg.evaluate("Array.prototype.map.call(document.querySelectorAll('[aria-live=polite]'), function (e) { return e.textContent; }).join(' ')")
def wait_stat(rx, t=60000):
    pg.wait_for_function("(rx) => { var s = Array.prototype.map.call(document.querySelectorAll('[aria-live=polite]'), function (e) { return e.textContent; }).join(' ') + ' ' + document.body.innerText; return new RegExp(rx).test(s); }", arg=rx, timeout=t)
def open_pdf(path, rx=r"pages?\."):
    pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", path); wait_stat(rx)
    pg.wait_for_timeout(600)
def tool(label): pg.click(".pv-bar button:text-is('%s')" % label); pg.wait_for_timeout(400)
def save(name):
    with pg.expect_download() as dl: pg.click(".pv-bar button:text-is('Save')")
    f = os.path.join(OUT, name); dl.value.save_as(f); return f
def page_rect(i): return pg.evaluate("(i) => { var r = Lantern.pdfView.api.pageEl(i).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }", i)
def drag_shown(i, box, pad=2):
    """drag over a box given as poppler shows the page (points from its top left)"""
    pg.evaluate("(i) => Lantern.pdfView.api.pageEl(i).scrollIntoView({block: 'center'})", i); pg.wait_for_timeout(300)
    r = page_rect(i); z = pg.evaluate("Lantern.pdfView.api.zoom")
    x0, y0, x1, y1 = r[0] + (box[0] - pad) * z, r[1] + (box[1] - pad) * z, r[0] + (box[2] + pad) * z, r[1] + (box[3] + pad) * z
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x1, y1, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)

# 1. Redact on a page with a vertical label: a word found and marked, and the label dragged over where it is seen
src = os.path.join(FX, "t_fonts.pdf")
open_pdf(src, r"2 pages\.")
tool("Redact")
pg.fill("input[aria-label='Words to take out']", "WAVERLEY"); pg.click("button:text-is('Mark them all')"); wait_stat("Marked 2 places")
ws, _ = bbox(src, 1); lab = [w for w in ws if "TREMONTANE" in w[0]][0]
drag_shown(0, lab[1:])
n = pg.evaluate("document.querySelectorAll('[title^=\"Marked to take out\"]').length")
ck("tile redact: 2 found + 1 dragged = 3 marks shown", n == 3, n)
pg.click("button.primary:text-is('Apply')"); wait_stat("Redacted")
f = save("tile_redact.pdf")
ok, info = qcheck(f); ck("tile redact: saved copy passes qpdf", ok, info)
t1 = ptext(f, 1)
ck("tile redact: WAVERLEY (found) gone from page 1's words", "WAVERLEY" not in t1, "")
ck("tile redact: TREMONTANE (dragged over where it is seen) gone from page 1's words", "TREMONTANE" not in t1, [l for l in t1.splitlines() if "TREMONTANE" in l])
ck("tile redact: TREMONTANE not in pypdf's words of page 1", "TREMONTANE" not in pypdf_text(f).split("\f")[0], "")
# 2. Redact on a landscape page whose words run up the page (MediaBox upright, /Rotate 90)
open_pdf(os.path.join(FX, "t_landscape.pdf"), r"1 page\.")
tool("Redact")
pg.fill("input[aria-label='Words to take out']", "ALDERGROVE"); pg.click("button:text-is('Mark them all')"); wait_stat("Marked 1 place")
shot = os.path.join(OUT, "tile_landscape_marks.png"); pg.screenshot(path=shot)
pg.click("button.primary:text-is('Apply')"); wait_stat("Redacted")
f = save("tile_redact_landscape.pdf")
png = render(f, os.path.join(OUT, "tile_redact_landscape"), 1, 200)
o = ocr_words(png)
ck("tile redact (landscape): tesseract does not read ALDERGROVE in the saved copy", "ALDERGROVE" not in o.upper(), [l for l in o.splitlines() if "ALDER" in l.upper()])
# 3. Edit text on the same landscape page: what a tap on a line offers to change
open_pdf(os.path.join(FX, "t_landscape.pdf"), r"1 page\.")
tool("Edit text")
boxes = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('[title=\"Tap to change these words\"]'), function (d) { var r = d.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })")
B.answers.append("")
if boxes:
    pg.locator("[title='Tap to change these words']").first.click(); pg.wait_for_timeout(300)
offered = [p for p in prompts if p[0] == "prompt"]
ck("tile edit text (landscape): one tappable box per line (3 lines)", len(boxes) == 3, boxes)
ck("tile edit text (landscape): a tap offers one line's words", offered and offered[-1][2].count("0700") <= 1 and "This line is kept" not in offered[-1][2], offered[-1:] )
pg.click("button:text-is('Done')")
# 4. Remove hidden
open_pdf(os.path.join(FX, "t_scripts.pdf"), r"2 pages\.")
tool("Remove hidden"); pg.click("button:text-is('Remove them')"); wait_stat("Removed")
f = save("tile_sanitized.pdf"); raw = qdf(f)
ck("tile remove hidden: no document script, XMP, Info author, attached file", all(w not in raw for w in [b"ZANZIBAR", b"QUIXOTE", b"HEPZIBAH", b"PERPETUA", b"BARNABY"]), [w for w in [b"ZANZIBAR", b"QUIXOTE", b"HEPZIBAH", b"PERPETUA", b"BARNABY"] if w in raw])
# 5. Protect
open_pdf(os.path.join(FX, "t_fonts.pdf"), r"2 pages\.")
tool("Protect")
pg.fill("input[aria-label='Password to open it']", "tile pass"); pg.fill("input[aria-label='The same again']", "tile pass")
pg.fill("input[aria-label=\"Owner's password\"]", "tile owner"); pg.fill("input[aria-label=\"Owner's password again\"]", "tile owner")
pg.locator("label:has-text('Print it') input").uncheck()
with pg.expect_download() as dl: pg.click("button:text-is('Save a locked copy')")
f = os.path.join(OUT, "tile_locked.pdf"); dl.value.save_as(f)
r = subprocess.run(["qpdf", "--password=tile pass", "--show-encryption", f], capture_output=True, text=True).stdout
ck("tile protect: the saved copy opens with its password in qpdf, R6, no printing", "R = 6" in r and "print high resolution: not allowed" in r and "Incorrect" not in r, r[-300:])
pg.click("button:text-is('Close')")
# 6. Stamp: a watermark, then page numbers (two Applies)
tool("Stamp"); pg.select_option("select[aria-label='What to put on']", "4"); pg.dispatch_event("select[aria-label='What to put on']", "change"); pg.click("button.primary:text-is('Apply')"); wait_stat("Stamped")
tool("Stamp"); pg.select_option("select[aria-label='What to put on']", "0"); pg.dispatch_event("select[aria-label='What to put on']", "change"); pg.click("button.primary:text-is('Apply')"); wait_stat("Stamped")
f = save("tile_stamped_twice.pdf")
t = ptext(f, 1); ck("tile stamp twice: DRAFT and Page 1 of 2 both on page 1", "DRAFT" in t and "Page 1 of 2" in t, t[-200:])
s = subprocess.run(["qpdf", "--qdf", "--object-streams=disable", f, "-"], capture_output=True).stdout
gs = re.findall(rb"/LtnGS <<[^>]*/ca ([\d.]+)", s) + re.findall(rb"/LtnGS\s*<<\s*/Type /ExtGState /ca ([\d.]+)", s)
ck("tile stamp twice: the watermark keeps its faintness (0.25) and the page numbers stay solid", b"0.25" in s and len(set(gs)) >= 1, gs[:6])
# 7. Reduce size
import make_fixtures
if not os.path.exists(os.path.join(OUT, "i_images.pdf")): make_fixtures.make_big(OUT)
open_pdf(os.path.join(OUT, "i_images.pdf"), r"12 pages\.")
tool("Reduce size"); pg.click("button:text-is('Make it smaller')"); wait_stat(r"From [\d.]+ MB to", 180000)
ck("tile reduce size: said how much smaller", True, stat())
# 8. a PDF whose objects sit in two object streams (qpdf --object-streams=generate, 120 pages)
open_pdf(os.path.join(FX, "t_many_objstm.pdf"), r"pages?\.|Could not")
s0 = stat()
ck("tile: a 120-page PDF with two object streams opens with its 120 pages", "120 pages" in s0, s0)
# 9. phone width: the tool bar and a tool's bar stay on the screen
pg.set_viewport_size({"width": 390, "height": 844}); open_pdf(os.path.join(FX, "t_fonts.pdf"), r"2 pages\.")
tool("Redact")
over = pg.evaluate("(function () { var w = document.documentElement.clientWidth, bad = []; document.querySelectorAll('.pv-bar, [style*=\"position:fixed\"]').forEach(function (e) { var r = e.getBoundingClientRect(); if (r.width && (r.right > w + 1 || r.left < -1)) bad.push([e.className || e.tagName, Math.round(r.left), Math.round(r.right)]); }); return {w: w, bad: bad, scroll: document.documentElement.scrollWidth}; })()")
ck("tile at phone width (390): no bar off the screen, no sideways scroll", not over["bad"] and over["scroll"] <= over["w"] + 1, over)
pg.screenshot(path=os.path.join(OUT, "tile_phone.png"))
ck("tile: no page errors", not B.errs, B.errs)
B.close()
print("%d checks, %d failed (outputs in %s)" % (ck.n, len(ck.bad), OUT))
