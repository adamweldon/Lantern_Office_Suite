# make_fixtures.py -- review 4 of 1.24.40's PDF tools: the PDFs, all made by programs that are not Lantern
# (reportlab, pikepdf, pdflatex, xelatex, LibreOffice, Chromium's page.pdf). Usage: python3 make_fixtures.py [name ...]
#   h_rl      reportlab: words broken at a line's end (- U+2010 U+2011 U+00AD) in one, two (aligned, offset) and three
#             justified columns whose word gaps are wider than the gap between columns; traps (a list's " -", a
#             paragraph that ends in a hyphen, the next column's line, a table's cells); labels turned 90 and -90
#   h_tex     pdflatex two columns (and multicol three), justified, explicit breaks and TeX's own hyphenation
#   h_lo      LibreOffice Writer: a two-column justified section with soft hyphens
#   h_chrome  Chromium: CSS columns (2 and 3), justify, &shy;, names broken at their own hyphen, turned labels, traps
#   ls_chrome Chromium: CSS letter-spacing 0.05-1 em with "(0.2em)" signs; single-character cells, keys, a comb box
#   ls_rl     reportlab: single characters drawn one at a time at an even pitch (cells, keys, comb), and letter-spaced words
#   ls_tex    pdflatex: kerned words, microtype \textls letter-spacing, inline equations; ls_xe xelatex symbol lines
#   fold_xe   xelatex (DejaVu Serif): Turkish I/i, Greek tonos/dialytika/final sigma, U+FB00-FB06, e + U+0301
#   fold_rl   reportlab (DejaVu Sans): the same with the code points exactly as typed (no shaping)
#   std14     pikepdf: Helvetica/Times/Courier named with no /Widths, fi fl ff ffi ffl by /Differences
#   deep      pikepdf: forms nested 70 deep with words at depths 1..70; a form that draws itself, and a ring of two
#   links     pikepdf: URI links holding a word (plain, %4F, upper case) on marked and unmarked pages, /Names /Dests and
#             catalog /Dests holding it, links and bookmarks going to them, bookmark titles holding it (also UTF-16)
#   forms     reportlab AcroForm: fields on page 1 (marked) and page 2 (not), one with no appearance (NeedAppearances)
import os, sys, subprocess, shutil, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "pdf_review3_1240"))
import pikepdf
from pikepdf import Name, Dictionary, Array, Stream, String
from pdfhand import std_font, cmap, form, page, lit
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("DJ", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
WANT = set(sys.argv[1:])
def want(n): return not WANT or n in WANT
def out(n): return os.path.join(HERE, n + ".pdf")
WORK = tempfile.mkdtemp()
def sh(*a, **k):
    return subprocess.run(list(a), capture_output=True, text=True, timeout=k.get("timeout", 240), cwd=k.get("cwd"))

# ----------------------------------------------------------------------------------------------------------------------
def jline(c, words, x0, width, y, font="DJ", size=10, justify=True, mode="words"):
    """one line, justified to width: each word its own drawString (mode words) or one string with Tw (mode tw)"""
    ws = [pdfmetrics.stringWidth(w, font, size) for w in words]
    gap = (width - sum(ws)) / (len(words) - 1) if justify and len(words) > 1 else pdfmetrics.stringWidth(" ", font, size)
    if mode == "tw" and len(words) > 1:
        t = c.beginText(x0, y); t.setFont(font, size)
        t.setWordSpace(gap - pdfmetrics.stringWidth(" ", font, size)); t.textOut(" ".join(words)); c.drawText(t)
        return
    x = x0
    c.setFont(font, size)
    for w, wd in zip(words, ws):
        c.drawString(x, y, w); x += wd + gap

COL_A = [("The survey of the old reservoir was led", 1), ("by Philippa Ashworth-", 1), ("Bramley, with notes kept by Mr Pember‐", 1),
         ("ton and by Mrs Winter‑", 1), ("bourne of the Kirkstall office, who also", 1), ("checked the Feather­", 1),
         ("stonehaugh valve records in May.", 0), ("Next step: pre-", 0), ("Start checks on both pumps today.", 0),
         ("Range set to 10 -", 0), ("20 V on the panel meter.", 0), ("Signed: Smith -", 0), ("Jones witnessed the test run.", 0)]
COL_B = [("Carlton and Dunmore checked the pump", 1), ("Dunmore found that Hollings-", 1), ("worth had fitted the seal kit before", 1),
         ("Carlton arrived; the test went well and", 1), ("Ellerby signed the sheet at noon on a", 1), ("Friday, and the crew left for Quarm-", 1),
         ("by at four in the afternoon. The new", 1), ("Gisburn office has the full report and", 1), ("the drawings of the valve chamber.", 0),
         ("Tosside keeps a copy of the file.", 0), ("Wray keeps the second copy.", 0), ("Bentham has none at all.", 0), ("Clapham asked for one.", 0)]

def h_rl():
    c = canvas.Canvas(out("h_rl"), pagesize=(612, 792))
    # page 1: one column (the same lines, one column 300 wide), then page 2: two aligned columns, page 3: offset columns
    c.setFont("DJ", 14); c.drawString(50, 750, "Reservoir survey, one column")
    y = 720
    for t, j in COL_A:
        jline(c, t.split(" "), 60, 230, y, justify=bool(j)); y -= 13
    c.showPage()
    for title, off, mode in (("Reservoir survey, two columns", 0, "words"), ("Reservoir survey, two columns, offset", 6.5, "tw")):
        c.setFont("DJ", 14); c.drawString(50, 750, title)
        y = 720
        for (ta, ja), (tb, jb) in zip(COL_A, COL_B):
            jline(c, ta.split(" "), 50, 240, y, justify=bool(ja), mode=mode)
            jline(c, tb.split(" "), 316, 240, y - off, justify=bool(jb), mode=mode)
            y -= 13
        c.showPage()
    # page 4: three columns, 160 wide, 16 apart; the third column's lines 4 lower
    c.setFont("DJ", 14); c.drawString(50, 750, "Three columns")
    cols = [
        [("The crew from the depot met", 1), ("Philippa Ashworth-", 1), ("Bramley at the gate and", 1), ("walked to the dam with", 1), ("the keeper at nine.", 0)],
        [("Ingleton sent a van with", 1), ("tools for Mr Pember-", 1), ("ton, who fixed the old", 1), ("sluice before the rain", 1), ("came in at noon.", 0)],
        [("Kettlewell had the keys", 1), ("and Mrs Winter-", 1), ("bourne had the maps", 1), ("of the whole valley for", 1), ("the next survey.", 0)]]
    for k, col in enumerate(cols):
        y = 720 - (4 if k == 2 else 0)
        for t, j in col:
            jline(c, t.split(" "), 50 + k * 176, 160, y, size=9.5, justify=bool(j)); y -= 12.5
    # turned labels (90 and -90), each two lines: "Quenby-" / "Ashton" and "Ravens-" / "worth Hall"
    c.saveState(); c.translate(80, 300); c.rotate(90); c.setFont("DJ", 11)
    c.drawString(0, 0, "Gate key: Quenby-"); c.drawString(0, -13, "Ashton holds it"); c.restoreState()
    c.saveState(); c.translate(560, 560); c.rotate(-90); c.setFont("DJ", 11)
    c.drawString(0, 0, "Store key: Ravens-"); c.drawString(0, -13, "worth Hall has it"); c.restoreState()
    # a table: cells that end in a hyphen and are not at the line's end; a last cell that ends in one
    rows = [("Part", "Code", "Note"), ("Valve", "AX-", "Kirkby-"), ("Seal", "Lonsdale", "spare"), ("Gasket", "BX-", "Settle"), ("Bolt", "Hawes", "none")]
    y = 560
    for r in rows:
        for k, t in enumerate(r):
            c.setFont("DJ", 10); c.drawString(150 + k * 110, y, t)
        y -= 14
    c.showPage(); c.save()

# ----------------------------------------------------------------------------------------------------------------------
TEX_BODY = r"""
The survey of the old reservoir at Thornton was led by Philippa Ashworth-\linebreak Bramley, who brought the electrohydraulic
counterbalancing gear from the depot; notes were kept by Mr Pember-\linebreak ton, and the drawings by Mrs Winter-\linebreak bourne
of the Kirkstall office. The inspection of the decommissioning valves was done in the afternoon by the maintenance
superintendent, who recommended the recharacterisation of the instrumentation and the electromechanical interlocking.
Range checks: 10 -- 20\,V on the panel, and a + b = c held for every reading.
\par
Carlton and Dunmore checked the pump; Dunmore found that the counterweights had been fitted incorrectly, and
the superintendent's representatives reconfirmed the characterisation of the hydrogeological conditions.
The Featherstonehaugh family's land agent, Mr Winterbottom-\linebreak Smythe, attended the commissioning.
"""
def tex(name, src, engine="pdflatex"):
    d = tempfile.mkdtemp(dir=WORK)
    open(os.path.join(d, name + ".tex"), "w").write(src)
    r = sh(engine, "-interaction=nonstopmode", name + ".tex", cwd=d, timeout=300)
    if not os.path.exists(os.path.join(d, name + ".pdf")): print(r.stdout[-1500:]); raise SystemExit(name + " failed")
    shutil.copy(os.path.join(d, name + ".pdf"), out(name))

def h_tex():
    src = (r"\documentclass[twocolumn,10pt]{article}\usepackage[margin=2cm]{geometry}\usepackage{multicol}\pagestyle{empty}"
           r"\hyphenation{Feather-stone-haugh}\begin{document}" + TEX_BODY * 3 +
           r"\onecolumn\begin{multicols}{3}" + TEX_BODY * 2 + r"\end{multicols}\end{document}")
    tex("h_tex", src)

# ----------------------------------------------------------------------------------------------------------------------
def h_lo():
    shy = "­"
    para = ("The survey of the old reservoir at Thornton was led by Philippa Ashworth-Bramley and by Mr Feather" + shy + "stone" + shy +
            "haugh, who brought the electro" + shy + "hydraulic counter" + shy + "balancing gear; notes were kept by Mr Pember" + shy +
            "ton and Mrs Winter" + shy + "bourne of the Kirk" + shy + "stall office, and the de" + shy + "commissioning valves were "
            "checked by the super" + shy + "intendent. ")
    fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.text">
<office:font-face-decls><style:font-face style:name="Liberation Serif" svg:font-family="'Liberation Serif'"/></office:font-face-decls>
<office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:text-align="justify"/><style:text-properties style:font-name="Liberation Serif" fo:font-size="10pt" fo:language="en" fo:country="GB"/></style:default-style></office:styles>
<office:automatic-styles><style:style style:name="S2" style:family="section"><style:section-properties><style:columns fo:column-count="2" fo:column-gap="0.15in"/></style:section-properties></style:style>
<style:style style:name="S3" style:family="section"><style:section-properties><style:columns fo:column-count="3" fo:column-gap="0.12in"/></style:section-properties></style:style>
<style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="8.5in" fo:page-height="11in" fo:margin-top="0.6in" fo:margin-bottom="0.6in" fo:margin-left="0.8in" fo:margin-right="0.8in"/></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
<office:body><office:text>
<text:p>Reservoir survey (LibreOffice)</text:p>
<text:section text:name="A" text:style-name="S2">%s</text:section>
<text:p>Three columns</text:p>
<text:section text:name="B" text:style-name="S3">%s</text:section>
</office:text></office:body></office:document>""" % ("".join("<text:p>%s</text:p>" % para for _ in range(4)), "".join("<text:p>%s</text:p>" % para for _ in range(3)))
    d = tempfile.mkdtemp(dir=WORK)
    open(os.path.join(d, "h_lo.fodt"), "w").write(fodt)
    sh("soffice", "--headless", "--convert-to", "pdf", "--outdir", d, os.path.join(d, "h_lo.fodt"), timeout=300)
    shutil.copy(os.path.join(d, "h_lo.pdf"), out("h_lo"))

# ----------------------------------------------------------------------------------------------------------------------
H_CHROME = """<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body { font-family: 'Liberation Serif', serif; font-size: 10pt; margin: 0; }
.c2 { column-count: 2; column-gap: 14pt; text-align: justify; hyphens: manual; }
.c3 { column-count: 3; column-gap: 12pt; text-align: justify; hyphens: manual; font-size: 9pt; }
.r90 { position: absolute; left: 470pt; top: 520pt; transform: rotate(90deg); transform-origin: left top; font-size: 10pt; }
.rm90 { position: absolute; left: 20pt; top: 700pt; transform: rotate(-90deg); transform-origin: left top; font-size: 10pt; }
ul { font-size: 10pt; } td { padding: 0 8pt; }
</style></head><body>
<h3>Reservoir survey (Chromium)</h3>
<div class="c2">%s</div>
<h3>Three columns</h3>
<div class="c3">%s</div>
<ul><li>Range set to 10 -<br>20 V on the panel meter</li><li>Signed: Smith -<br>Jones witnessed it</li></ul>
<table><tr><td>Valve</td><td>AX-</td><td>Kirkby-</td></tr><tr><td>Seal</td><td>Lonsdale</td><td>spare</td></tr></table>
<div class="r90">Gate key: Quenby-<br>Ashton holds it</div>
<div class="rm90">Store key: Ravens-<br>worth Hall has it</div>
</body></html>"""
def chrome_pdf(html, name, fmt="A4"):
    from playwright.sync_api import sync_playwright
    d = tempfile.mkdtemp(dir=WORK); f = os.path.join(d, name + ".html"); open(f, "w").write(html)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto("file://" + f)
        pg.pdf(path=out(name), format=fmt, margin={"top": "14mm", "bottom": "14mm", "left": "14mm", "right": "14mm"}); b.close()

def h_chrome():
    p = ("<p>The survey of the old reservoir at Thornton was led by Philippa Ashworth-Bramley and by Mr Feather&shy;stone&shy;haugh, "
         "who brought the electro&shy;hydraulic counter&shy;balancing gear; notes were kept by Mr Pember&shy;ton and Mrs Winter&shy;bourne "
         "of the Kirk&shy;stall office, and the de&shy;commissioning valves were checked by the super&shy;intendent.</p>")
    chrome_pdf(H_CHROME % (p * 5, p * 4), "h_chrome")

# ----------------------------------------------------------------------------------------------------------------------
LS_CHROME = """<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body { font-family: 'Liberation Sans', sans-serif; font-size: 11pt; margin: 0; }
p { margin: 4pt 0; }
td.k { width: 14pt; text-align: center; padding: 0; } table { border-collapse: collapse; }
.key { display: inline-block; width: 16pt; text-align: center; }
.comb span { display: inline-block; width: 13pt; border: 0.5pt solid #000; text-align: center; margin-right: 1pt; }
</style></head><body>
<p style="letter-spacing:0.05em">WAREHOUSE NORTH (0.05em)</p>
<p style="letter-spacing:0.1em">Loading Bay Seven (0.1em)</p>
<p style="letter-spacing:0.2em">CALDERDALE DEPOT (0.2em)</p>
<p style="letter-spacing:0.35em">Mossley Works (0.35em)</p>
<p style="letter-spacing:0.5em">HEBDEN BRIDGE (0.5em)</p>
<p style="letter-spacing:0.75em">TODMORDEN (0.75em)</p>
<p style="letter-spacing:1em">SOWERBY (1em)</p>
<p>Plain line: the pump at Ripponden runs well.</p>
<table><tr><td>Pins</td><td class="k">1</td><td class="k">2</td><td class="k">3</td><td class="k">4</td><td class="k">5</td></tr></table>
<p>Keys: <span class="key">A</span><span class="key">B</span><span class="key">C</span><span class="key">D</span></p>
<p class="comb">Code: <span>4</span><span>7</span><span>1</span><span>9</span><span>2</span></p>
<p>Check: a + b = c and x = y + 2</p>
<p>U &le; 230 V, I &ge; 2 A</p>
<p>Grades: A B C D E</p>
<p>Answer: A B C or D</p>
<p>Vitamins A B C and E were listed.</p>
<p>Initials J R R T Tolkien</p>
<p>Axes x y z</p>
<p>Sizes: S M L XL</p>
<p>Choose one of A B C D E and F.</p>
<p>Rows a b c d e f in the grid.</p>
<p style="letter-spacing:0.3em">BLOCK A AND B (0.3em)</p>
<table><tr><td>Files</td><td class="k">a</td><td class="k">b</td><td class="k">c</td><td class="k">d</td><td class="k">e</td><td class="k">f</td><td class="k">g</td><td class="k">h</td></tr></table>
<p>Row: <span class="key">Q</span><span class="key">W</span><span class="key">E</span><span class="key">R</span><span class="key">T</span><span class="key">Y</span></p>
</body></html>"""
def ls_chrome(): chrome_pdf(LS_CHROME, "ls_chrome")

PLAIN = ["Grades: A B C D E", "Answer: A B C or D", "Vitamins A B C and E were listed.", "Initials J R R T Tolkien", "Axes x y z"]
def ls_lo():
    fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.text">
<office:automatic-styles><style:style style:name="LS" style:family="text"><style:text-properties fo:letter-spacing="0.08in"/></style:style></office:automatic-styles>
<office:body><office:text>%s<text:p><text:span text:style-name="LS">WAREHOUSE NORTH</text:span> spaced in Writer</text:p></office:text></office:body></office:document>""" % "".join("<text:p>%s</text:p>" % t for t in PLAIN)
    d = tempfile.mkdtemp(dir=WORK)
    open(os.path.join(d, "ls_lo.fodt"), "w").write(fodt)
    sh("soffice", "--headless", "--convert-to", "pdf", "--outdir", d, os.path.join(d, "ls_lo.fodt"), timeout=300)
    shutil.copy(os.path.join(d, "ls_lo.pdf"), out("ls_lo"))

def ls_rl():
    c = canvas.Canvas(out("ls_rl"), pagesize=(612, 792)); size = 10
    def one_at_a_time(x, y, text, pitch=None, ls=None, font="Helvetica"):
        c.setFont(font, size)
        for ch in text:
            if ch != " ": c.drawString(x, y, ch)
            x += pitch if pitch else pdfmetrics.stringWidth(ch, font, size) + ls * size
    c.setFont("Helvetica", 12); c.drawString(50, 750, "Spaced letters and single cells")
    one_at_a_time(50, 720, "WAREHOUSE NORTH", ls=0.3)
    one_at_a_time(50, 700, "Mossley Works", ls=0.6)
    c.setFont("Helvetica", size); c.drawString(50, 680, "Pins:")
    for k, pitch in enumerate((12, 14, 18)):
        y = 680 - 20 * k
        if k: c.drawString(50, y, "Pins:")
        one_at_a_time(90, y, "12345", pitch=pitch)
    c.drawString(50, 600, "Keys:"); one_at_a_time(90, 600, "ABCD", pitch=14)
    c.drawString(50, 580, "Code:")
    for k, d in enumerate("47192"):
        c.rect(90 + 13 * k, 577, 12, 14); c.drawCentredString(96 + 13 * k, 580, d)
    c.drawString(50, 560, "Grid:"); one_at_a_time(90, 560, "XOXOX", pitch=13)
    c.drawString(50, 540, "Plain line: the pump at Ripponden runs well.")
    c.showPage(); c.save()

def ls_tex():
    src = (r"\documentclass{article}\usepackage[margin=2cm]{geometry}\usepackage{microtype}\pagestyle{empty}\begin{document}"
           r"AVATAR WAVY TOWARD Yorkshire VAT Toyota Wolverhampton.\par "
           r"\textls[200]{WAREHOUSE NORTH} and \textls[120]{Calderdale} letter-spaced.\par "
           r"Check: $a + b = c$ and $x = y + 2$ and $U \le 230$~V.\par "
           r"\begin{tabular}{llllll}Pins & 1 & 2 & 3 & 4 & 5\\ Keys & A & B & C & D & \end{tabular}\par "
           r"Office affine fluent waffle effort shuffle.\par\end{document}")
    tex("ls_tex", src)
    src = (r"\documentclass{article}\usepackage[margin=2cm]{geometry}\usepackage{fontspec}\setmainfont{DejaVu Serif}\pagestyle{empty}\begin{document}"
           "Supply: U ≤ 230 V, I ≥ 2 A, f = 50 Hz ± 1 \\%.\\par Check: a + b = c and x = y + 2.\\par "
           "\\begin{tabular}{llllll}Pins & 1 & 2 & 3 & 4 & 5\\\\ Keys & A & B & C & D & \\end{tabular}\\par "
           "Plain line: the pump at Ripponden runs well.\\par\\end{document}")
    tex("ls_xe", src, "xelatex")

# ----------------------------------------------------------------------------------------------------------------------
FOLD_LINES = ["İSTANBUL office: İstanbul, Istanbul and ıstanbul", "Customer: ΠΑΠΑΔΟΠΟΥΛΟΣ of Athens",
              "Signed: Παπαδόπουλος (agent)", "Product: ΠΡΟΪΟΝ and προϊόν",
              "Ligatures: ﬀort ﬁnance ﬂuent ﬃce ﬄe ﬅop ﬆep", "Accents: René Fernández at the Café Ormskirk",
              "Keep: René Fernández, São Paulo, naïve, Ångström, άλφα, İzmir"]
def fold_xe():
    src = (r"\documentclass{article}\usepackage[margin=2cm]{geometry}\usepackage{fontspec}\setmainfont{DejaVu Serif}[Ligatures=NoCommon]\pagestyle{empty}\begin{document}" +
           "\\par ".join(FOLD_LINES) + r"\end{document}")
    tex("fold_xe", src, "xelatex")
def fold_rl():
    c = canvas.Canvas(out("fold_rl"), pagesize=(612, 792)); c.setFont("DJ", 12); y = 740
    for t in FOLD_LINES: c.drawString(50, y, t); y -= 22
    c.showPage(); c.save()

# ----------------------------------------------------------------------------------------------------------------------
def std14():
    pdf = pikepdf.new()
    diffs = [1, Name("/fi"), Name("/fl"), Name("/ff"), Name("/ffi"), Name("/ffl")]
    fonts = {}
    for k, b in enumerate(["Helvetica", "Times-Roman", "Courier", "Helvetica-Bold", "Times-Italic", "Helvetica-Oblique"]):
        fonts["/F%d" % (k + 1)] = std_font(pdf, b, enc="/WinAnsiEncoding", diffs=diffs)
    res = Dictionary(Font=Dictionary(fonts))
    lines = []
    y = 740
    # \001 fi \002 fl \003 ff \004 ffi \005 ffl
    texts = ["Wavy AV To \001nance and \002uent Ormskirk", "The e\003ort o\004ce wa\005e Ormskirk after", "Plain Kirkby Lonsdale Settle Hawes"]
    for k in range(6):
        for t in texts:
            lines.append("BT /F%d 12 Tf 50 %d Td %s Tj ET" % (k + 1, y, lit(t))); y -= 18
        y -= 8
    # the same fonts with no /Encoding at all (their built-in StandardEncoding: fi is \256, fl is \257)
    for k, b in enumerate(["Times-Roman", "Courier"]):
        fonts["/S%d" % (k + 1)] = std_font(pdf, b, enc=None)
        for t in ["Wavy AV To \256nance and \257uent Ormskirk", "Pro\256le \257ow Ormskirk after", "Plain Kirkby Lonsdale Settle Hawes"]:
            lines.append("BT /S%d 12 Tf 50 %d Td %s Tj ET" % (k + 1, y, lit(t))); y -= 18
        y -= 8
    res = Dictionary(Font=Dictionary(fonts))
    page(pdf, "\n".join(lines), res)
    pdf.save(out("std14"))

# ----------------------------------------------------------------------------------------------------------------------
def deep():
    pdf = pikepdf.new()
    f1 = std_font(pdf, "Helvetica")
    fres = lambda extra=None: Dictionary(Font=Dictionary(F1=f1), XObject=Dictionary(extra or {}))
    DEPTHS = [1, 2, 10, 32, 48, 63, 64, 65, 66, 70]
    names = {1: "Ambleside", 2: "Bowness", 10: "Coniston", 32: "Dalegarth", 48: "Eskdale", 63: "Grasmere", 64: "Hawkshead", 65: "Ireby", 66: "Keswick", 70: "Langdale"}
    inner = None
    for d in range(70, 0, -1):
        body = ""
        if d in names: body += "BT /F1 11 Tf 60 %d Td (Depth %d %s) Tj ET\n" % (760 - 14 * DEPTHS.index(d), d, names[d])
        if inner is not None: body += "q /Fx Do Q\n"
        inner = form(pdf, body, fres({"/Fx": inner} if inner is not None else None))
    # a form that draws itself; two forms that draw each other
    selfF = form(pdf, "BT /F1 11 Tf 60 560 Td (Selfloop Mardale) Tj ET\nq /Fs Do Q\n", fres())
    selfF.Resources.XObject.Fs = selfF
    ringA = form(pdf, "BT /F1 11 Tf 60 540 Td (Ringwalk Patterdale) Tj ET\nq /Fb Do Q\n", fres())
    ringB = form(pdf, "BT /F1 11 Tf 60 520 Td (Ringstep Glenridding) Tj ET\nq /Fa Do Q\n", fres())
    ringA.Resources.XObject.Fb = ringB; ringB.Resources.XObject.Fa = ringA
    res = Dictionary(Font=Dictionary(F1=f1), XObject=Dictionary(Fx=inner, Fs=selfF, Fa=ringA))
    page(pdf, "BT /F1 11 Tf 60 600 Td (Page text Troutbeck and Ormskirk) Tj ET\nq /Fx Do Q\nq /Fs Do Q\nq /Fa Do Q\n"
              "BT /F1 11 Tf 60 480 Td (After the forms: Windermere) Tj ET\n", res)
    pdf.save(out("deep"))

# ----------------------------------------------------------------------------------------------------------------------
def links():
    pdf = pikepdf.new()
    f1 = std_font(pdf, "Helvetica")
    res = Dictionary(Font=Dictionary(F1=f1))
    def pg(lines):
        return page(pdf, "\n".join("BT /F1 12 Tf 60 %d Td %s Tj ET" % (740 - 20 * k, lit(t)) for k, t in enumerate(lines)), res)
    p1 = pg(["Page one: the farm at Ormskirk is ours.", "Visit our map (link).", "Plain link: example info."])
    p2 = pg(["Page two: the plan.", "A link with no visible name here.", "Another link here."])
    p3 = pg(["Page three: section three.", "Go to the plan (link).", "Go to section three (link).", "Plain link: example info."])
    def uri(p, rect, u, contents=None):
        a = Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array(rect), Border=Array([0, 0, 0]), A=Dictionary(S=Name.URI, URI=String(u)))
        if contents: a.Contents = String(contents)
        p.obj.Annots = p.obj.get("/Annots", Array()); p.obj.Annots.append(pdf.make_indirect(a))
    def goto(p, rect, dest=None, d_action=None):
        a = Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array(rect), Border=Array([0, 0, 0]))
        if dest is not None: a.Dest = dest
        if d_action is not None: a.A = Dictionary(S=Name.GoTo, D=d_action)
        p.obj.Annots = p.obj.get("/Annots", Array()); p.obj.Annots.append(pdf.make_indirect(a))
    uri(p1, [60, 715, 250, 732], "https://example.org/visit/Ormskirk")
    uri(p1, [60, 695, 250, 712], "https://example.org/info")
    uri(p2, [60, 715, 300, 732], "https://example.org/%4Frmskirk/map")
    uri(p2, [60, 695, 300, 712], "https://example.org/ORMSKIRK-farm", contents="Map of the farm")
    uri(p2, [60, 675, 300, 692], "https://example.org/o%72mskirk")
    goto(p3, [60, 715, 300, 732], dest=String("Ormskirk-plan"))
    goto(p3, [60, 695, 300, 712], d_action=Name("/sec.Ormskirk"))
    uri(p3, [60, 675, 300, 692], "https://example.org/info")
    goto(p3, [60, 655, 300, 672], dest=String("intro"))
    # the destinations: a /Names /Dests tree and an old-style catalog /Dests dictionary
    pdf.Root.Names = Dictionary(Dests=Dictionary(Names=Array([String("Ormskirk-plan"), Array([p2.obj, Name.XYZ, 0, 792, 0]),
                                                              String("intro"), Array([p1.obj, Name.Fit])])))
    pdf.Root.Dests = pdf.make_indirect(Dictionary({"/sec.Ormskirk": Array([p3.obj, Name.Fit]), "/plain": Array([p1.obj, Name.Fit])}))
    # bookmarks
    with pdf.open_outline() as ol:
        pass
    items = [("Visit Ormskirk", Dictionary(Dest=String("Ormskirk-plan"))), ("Section three (Ormskirk)", Dictionary(A=Dictionary(S=Name.GoTo, D=Name("/sec.Ormskirk")))),
             ("Intro", Dictionary(Dest=Array([p1.obj, Name.Fit]))), ("ORMSKIRK – the map", Dictionary(Dest=String("intro"))),
             ("Plain", Dictionary(Dest=Name("/plain")))]
    outl = pdf.make_indirect(Dictionary(Type=Name.Outlines))
    objs = []
    for t, d in items:
        o = Dictionary(Title=String(t), Parent=outl); o.update(d); objs.append(pdf.make_indirect(o))
    for k, o in enumerate(objs):
        if k: o.Prev = objs[k - 1]
        if k < len(objs) - 1: o.Next = objs[k + 1]
    outl.First = objs[0]; outl.Last = objs[-1]; outl.Count = len(objs)
    pdf.Root.Outlines = outl
    pdf.save(out("links"))

# ----------------------------------------------------------------------------------------------------------------------
def forms():
    c = canvas.Canvas(out("forms_rl"), pagesize=(612, 792))
    c.setFont("Helvetica", 12); c.drawString(50, 740, "Page one: owner details")
    c.drawString(50, 700, "Owner:"); c.acroForm.textfield(name="owner", value="Ormskirk Farm Ltd", x=120, y=694, width=260, height=20, fontName="Helvetica", fontSize=12, borderWidth=1)
    c.drawString(50, 670, "Phone:"); c.acroForm.textfield(name="phone", value="01695 555", x=120, y=664, width=160, height=20, fontName="Helvetica", fontSize=12, borderWidth=1)
    c.drawString(50, 640, "Notes:"); c.acroForm.textfield(name="notes", value="", x=120, y=634, width=260, height=20, fontName="Helvetica", fontSize=12, borderWidth=1)
    c.showPage()
    c.setFont("Helvetica", 12); c.drawString(50, 740, "Page two: the site")
    c.drawString(50, 700, "City:"); c.acroForm.textfield(name="city", value="Wigan Pier", x=120, y=694, width=200, height=20, fontName="Helvetica", fontSize=12, borderWidth=1)
    c.drawString(50, 670, "Agreed:"); c.acroForm.checkbox(name="agreed", x=120, y=664, size=16, checked=True)
    c.showPage(); c.save()
    # a field with no appearance: Lantern draws the value itself (as a viewer must, /NeedAppearances)
    pdf = pikepdf.open(out("forms_rl"))
    for f in pdf.Root.AcroForm.Fields:
        if str(f.get("/T")) == "owner":
            f.V = String("Ormskirk Farm Ltd")
            if "/AP" in f: del f["/AP"]
            f.DA = String("/Helv 12 Tf 0 g")
    pdf.Root.AcroForm.NeedAppearances = True
    dr = pdf.Root.AcroForm.get("/DR") or Dictionary()
    if "/Font" not in dr: dr.Font = Dictionary()
    dr.Font.Helv = std_font(pdf, "Helvetica"); pdf.Root.AcroForm.DR = dr
    pdf.save(out("forms_noap")); pdf.close()

def forms_acro2():
    """review 3's Acrobat-style form (f_acro, pikepdf) with a cover page put before it: a form whose fields are all on a
    page that is not marked"""
    d = pikepdf.open(os.path.join(HERE, "..", "pdf_review3_1240", "f_acro.pdf"))
    f1 = std_font(d, "Helvetica")
    page(d, "BT /F1 12 Tf 60 740 Td (Cover page: the farm at Ormskirk.) Tj ET", Dictionary(Font=Dictionary(F1=f1)))
    d.pages.insert(0, d.pages[-1]); del d.pages[-1]
    d.save(out("forms_acro2"))

for n, f in [("forms_acro2", forms_acro2), ("h_rl", h_rl), ("h_tex", h_tex), ("h_lo", h_lo), ("h_chrome", h_chrome), ("ls_chrome", ls_chrome), ("ls_rl", ls_rl), ("ls_lo", ls_lo),
             ("ls_tex", ls_tex), ("fold_xe", fold_xe), ("fold_rl", fold_rl), ("std14", std14), ("deep", deep), ("links", links), ("forms", forms)]:
    if want(n):
        try: f(); print("made", n)
        except SystemExit as e: print("FAILED", n, e)
shutil.rmtree(WORK, ignore_errors=True)
