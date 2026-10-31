# make_sheets.py -- remake the test sheets in this folder (Lantern 1.21.0): engrave each tune of expected.json with Verovio
# (pip install verovio) and rasterise it in Chromium (Playwright) at 1300, 900 and 700 pixels wide (the tests use eight of
# them, and ode_title_900.png: the piano Ode with its heading).
# Usage: python3 tests/fixtures/sheets/make_sheets.py   (writes NAME_1300.png, NAME_900.png, NAME_700.png here)
import json, os
import verovio
from playwright.sync_api import sync_playwright
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(HERE, "expected.json")))
songs = [(k, "abc", v, "none") for k, v in E["sources"].items()] + [("ode_piano", "humdrum", E["ode_piano_kern"], "none"),
  ("ode_title", "humdrum", E["ode_title_kern_head"] + E["ode_piano_kern"], "auto")]   # 1.21.1: with its title and composer printed above
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1400, "height": 1000})
    for name, kind, data, head in songs:
        tk = verovio.toolkit()
        tk.setOptions({"pageWidth": 2100, "pageHeight": 60000, "scale": 60, "adjustPageHeight": True, "footer": "none", "header": head, "breaks": "auto", "inputFrom": kind, "svgViewBox": False})
        tk.loadData(data)
        pg.set_content("<html><body style='margin:0;background:#fff'><div id=s style='width:1300px;padding:20px'>" + tk.renderToSVG(1) + "</div></body></html>")
        pg.eval_on_selector("#s svg", "s => { s.style.width = '1260px'; s.style.height = 'auto'; }")
        big = os.path.join(HERE, name + "_1300.png")
        pg.locator("#s").screenshot(path=big)
        im = Image.open(big).convert("RGB")
        for w in (900, 700): im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(HERE, "%s_%d.png" % (name, w)))
    b.close()
