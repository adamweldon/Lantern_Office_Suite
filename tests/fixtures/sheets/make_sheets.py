# make_sheets.py -- remake the test sheets in this folder (Lantern 1.21.0): engrave each tune of expected.json with Verovio
# (pip install verovio) and rasterise it in Chromium (Playwright) at 1300, 900, 820, 760 and 700 pixels wide (the tests use eleven of
# them, ode_title_900.png: the piano Ode with its heading, and ode_banner_900.png, below; 1.22.4: minor_e_piano at 900 and 760;
# 1.22.5: voice_e_piano at 900; 1.22.7: barcarolle_g_piano and jig_d at 900; 1.22.8: ode_viewer.png, below).
# Usage: python3 tests/fixtures/sheets/make_sheets.py [NAME ...]   (writes NAME_1300.png, NAME_900.png, NAME_820.png, NAME_760.png,
# NAME_700.png here; with names, only those songs -- the banner is remade when ode_piano is)
# 1.23.1: piano_b_lyrics, a piece written for these tests in B major as MusicXML (piano_b_musicxml), with what Adam's piano page
# had: words under the right hand, chords tied into shorter ones, dotted rhythms, high notes beamed inside the staff, a sixteenth
# rest, a dotted eighth rest, a lone sixteenth, an octave sign under a left hand of quarters over whole notes (its 900 is tested).
# 1.22.7: barcarolle_g_piano, a piece written for these tests in G minor and 12/8 (as Adam's sheet): the left hand a quarter and
# an eighth four times a bar, the right hand dotted quarters and eighths beamed in threes; jig_d, a 6/8 tune in Leland.
# 1.22.4: minor_e_piano, a piece written for these tests in E minor (minor_e_kern): whole-note chords in the left hand, a sharp a
# tie runs into, a sharpened chord tied over the bar line, eighth rests and sixteenths, an end-repeat bar line.
# 1.22.1: and ode_banner_900.png -- the piano Ode with a dark banner across its second left hand, as a web page's preview
# lays one over the music.
import json, os, sys
import verovio
from playwright.sync_api import sync_playwright
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(HERE, "expected.json")))
songs = [(k, "abc", v, "none") for k, v in E["sources"].items()] + [("ode_piano", "humdrum", E["ode_piano_kern"], "none"),
  ("ode_title", "humdrum", E["ode_title_kern_head"] + E["ode_piano_kern"], "auto"),   # 1.21.1: with its title and composer printed above
  ("minor_e_piano", "humdrum", E["minor_e_kern"], "none"),
  ("voice_e_piano", "humdrum", E["voice_e_kern"], "none"),   # 1.22.5: a voice over a piano (voice_e_kern)
  ("barcarolle_g_piano", "humdrum", E["barcarolle_g_kern"], "none"),   # 1.22.7: 12/8 (barcarolle_g_kern)
  ("piano_b_lyrics", "musicxml", E["piano_b_musicxml"], "none")]   # 1.23.1: words, ties, an octave sign, two voices (piano_b_musicxml)
# 1.22.7: a time signature in another font -- jig_d (6/8) in Leland, MuseScore 4's
FONT = {"jig_d": "Leland"}
ONLY = sys.argv[1:]
if ONLY: songs = [s for s in songs if s[0] in ONLY]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 1000})
    for name, kind, data, head in songs:
        tk = verovio.toolkit()
        tk.setOptions(dict({"pageWidth": 2100, "pageHeight": 60000, "scale": 60, "adjustPageHeight": True, "footer": "none", "header": head, "breaks": "auto", "inputFrom": kind, "svgViewBox": False},
                           **({"font": FONT[name]} if name in FONT else {})))
        tk.loadData(data)
        pg.set_content("<html><body style='margin:0;background:#fff'><div id=s style='width:1300px;padding:20px'>" + tk.renderToSVG(1) + "</div></body></html>")
        pg.eval_on_selector("#s svg", "s => { s.style.width = '1260px'; s.style.height = 'auto'; }")
        big = os.path.join(HERE, name + "_1300.png")
        pg.locator("#s").screenshot(path=big)
        im = Image.open(big).convert("RGB")
        for w in (900, 820, 760, 700): im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(HERE, "%s_%d.png" % (name, w)))
    b.close()
# 1.22.6: ode_clarinet.pdf -- the Ode as a clarinet part in B flat (printed a whole step higher, in D major) under its title and
# instrument, made into a PDF by Chromium: a music program's PDF has no picture -- its notes are drawn
if not ONLY or "ode_clarinet" in ONLY:
    tk = verovio.toolkit()
    tk.setOptions({"pageWidth": 2100, "pageHeight": 60000, "scale": 60, "adjustPageHeight": True, "footer": "none", "header": "none", "breaks": "auto", "inputFrom": "abc", "svgViewBox": False})
    tk.loadData(E["ode_clarinet_abc"])
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.set_content("<html><body style='margin:0;background:#fff;font-family:serif'><div style='padding:30px 40px'><div style='text-align:center;font-size:30px'>Ode to Joy</div>"
                       "<div style='display:flex;justify-content:space-between;font-size:15px;margin:6px 0 10px'><span>Clarinet in B\u266d</span><span>Ludwig van Beethoven</span></div>"
                       "<div id=s>" + tk.renderToSVG(1) + "</div></div></body></html>")
        pg.eval_on_selector("#s svg", "s => { s.style.width = '720px'; s.style.height = 'auto'; }")
        pg.pdf(path=os.path.join(HERE, "ode_clarinet.pdf"), format="Letter")
        b.close()
# 1.22.8: ode_viewer.png -- the piano Ode as a PDF viewer shows it (Adam's screenshot): the sheet on a white page, the page on a
# dark grey ground three times its width
if not ONLY or "ode_viewer" in ONLY:
    sheet = Image.open(os.path.join(HERE, "ode_piano_900.png")).convert("RGB")
    page = Image.new("RGB", (1000, 1294), (255, 255, 255)); page.paste(sheet, (50, 90))
    ground = Image.new("RGB", (2520, 1400), (31, 31, 31)); ground.paste(page, ((2520 - 1000) // 2, 53))
    ground.save(os.path.join(HERE, "ode_viewer.png"))
# the banner (1.22.1): across the fourth staff (the second system's left hand), a space above it to a space below
if ONLY and "ode_piano" not in ONLY: sys.exit(0)
from PIL import ImageDraw
im = Image.open(os.path.join(HERE, "ode_piano_900.png")).convert("RGB")
g = im.convert("L"); W, H = g.size; px = g.load()
rows = [y for y in range(H) if sum(1 for x in range(0, W, 2) if px[x, y] < 215) > 0.4 * W / 2]
bands = []
for y in rows:
    if bands and y - bands[-1][1] <= 1: bands[-1][1] = y
    else: bands.append([y, y])
lines = [(a + b) / 2 for a, b in bands]
st = lines[15:20]; sp = (st[4] - st[0]) / 4
d = ImageDraw.Draw(im); d.rectangle([0, int(st[0] - sp), W, int(st[4] + sp)], fill=(47, 51, 55))
d.text((W // 2 - 60, int((st[0] + st[4]) / 2) - 6), "Preview ends here", fill=(255, 255, 255))
im.save(os.path.join(HERE, "ode_banner_900.png"))
