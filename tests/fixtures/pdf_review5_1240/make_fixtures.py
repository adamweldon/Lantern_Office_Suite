# make_fixtures.py -- review 5 of 1.24.40's PDF tools: the PDFs, made by programs that are not Lantern
# (reportlab, pikepdf, Chromium's page.pdf). Run from anywhere: python3 make_fixtures.py
import os, sys, json, zlib
HERE = os.path.dirname(os.path.abspath(__file__))
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.pagesizes import letter
import pikepdf
from pikepdf import Name, Dictionary, Array, String

FILL = ("the pump house on the north bank was rebuilt after the flood and the new valves were set by the crew "
        "who checked every flange and gauge before the water was let back into the main channel at dawn while "
        "the engineer wrote down each reading in the log book kept by the door of the old control room on site ").split()
_fi = [0]
def filler():
    w = FILL[_fi[0] % len(FILL)]; _fi[0] += 1; return w

def fit(width, font="Helvetica", size=10, head=None, tail=None, full=True):
    """one line of filler words reaching near width, starting with head and ending with tail (if given)"""
    words = [head] if head else []
    while True:
        w = filler()
        cand = " ".join(words + [w] + ([tail] if tail else []))
        if stringWidth(cand, font, size) > width:
            _fi[0] -= 1; break
        words.append(w)
    return " ".join(words + ([tail] if tail else []))

def column(c, x, ytop, width, n, breaks=None, lead=13, font="Helvetica", size=10, first_head=None, last_tail=None):
    """n lines of filler from ytop down; breaks = {k: (tail, head)}: line k ends in tail, line k+1 starts with head"""
    breaks = breaks or {}; c.setFont(font, size); head = first_head; ys = []
    for k in range(n):
        tail = breaks[k][0] if k in breaks else (last_tail if k == n - 1 else None)
        s = fit(width, font, size, head, tail)
        c.drawString(x, ytop - k * lead, s); ys.append(ytop - k * lead)
        head = breaks[k][1] if k in breaks else None
    return ys

def hy_rl():
    p = os.path.join(HERE, "hy_rl.pdf"); c = canvas.Canvas(p, pagesize=letter)
    c.setTitle("hy_rl")
    W = 210
    # page 1: two columns, a full-width heading, two columns again; a footer
    column(c, 72, 760, W, 8, breaks={2: ("Brad-", "ford")}, last_tail="Winter-")
    column(c, 312, 760, W, 8, breaks={3: ("Thorn-", "ton")}, first_head="bourne")
    c.setFont("Helvetica-Bold", 12); c.drawString(72, 760 - 7 * 13 - 22, "Results of the survey across the district")
    y2 = 760 - 7 * 13 - 22 - 26
    column(c, 72, y2, W, 8, last_tail="Pember-")
    column(c, 312, y2, W, 8, first_head="ton")
    c.setFont("Helvetica", 8); c.drawCentredString(297, 40, "Lancaster Works - page 1")
    c.showPage()
    # page 2: two columns with a table under them
    column(c, 72, 760, W, 10, last_tail="Kirk-")
    column(c, 312, 760, W, 10, breaks={4: ("Raven-", "sworth")}, first_head="stall")
    yt = 760 - 9 * 13 - 20
    c.setFont("Helvetica-Bold", 10)
    for x, s in ((72, "Valve"), (160, "Seal"), (250, "Size"), (340, "Rating"), (430, "Supplier")): c.drawString(x, yt, s)
    c.setFont("Helvetica", 10)
    for r, row in enumerate((("V1", "nitrile", "DN50", "PN16", "Smith"), ("V2", "viton", "DN80", "PN25", "Jones"), ("V3", "EPDM", "DN100", "PN16", "Brown"))):
        for x, s in zip((72, 160, 250, 340, 430), row): c.drawString(x, yt - 15 * (r + 1), s)
    c.showPage()
    # page 3: two columns, a rule and a footnote under them, a footer
    column(c, 72, 760, W, 10, last_tail="Feather-")
    column(c, 312, 760, W, 10, first_head="stonehaugh")
    yf = 760 - 9 * 13
    c.line(72, yf - 9, 200, yf - 9)
    c.setFont("Helvetica", 8); c.drawString(72, yf - 20, "1 See the annual report of the drainage board for the full figures.")
    c.drawString(72, 40, "Confidential - drainage board")
    c.showPage()
    # page 4: lists with hanging indents, first-line indents, a hanging-indent paragraph, a list of prefixes
    y = 760
    c.setFont("Helvetica", 10)
    items = [[("", "Hollings-"), ("worth", None), (None, None)], [("", "Ashworth-"), ("Bramley", None)], [("", None)]]
    for it in items:
        c.drawString(72, y, "•" if False else "-")
        head = None
        for k, (h, t) in enumerate(it):
            s = fit(432, head=h if h else None, tail=t)
            c.drawString(90, y, s); y -= 13
        y -= 4
    for n, it in enumerate([[(None, None)], [(None, "Quarm-"), ("by", None)], [(None, None), (None, None)]]):
        c.drawString(72, y, "%d." % (n + 1))
        for k, (h, t) in enumerate(it):
            c.drawString(90, y, fit(432, head=h, tail=t)); y -= 13
        y -= 4
    y -= 6
    # first-line indent 36 pt: five paragraphs, the third's first line ends "Ravens-"
    for n in range(5):
        c.drawString(108, y, fit(396, tail="Ravens-" if n == 2 else None)); y -= 13
        c.drawString(72, y, fit(432, head="worth" if n == 2 else None)); y -= 13
        c.drawString(72, y, fit(200)); y -= 13
    y -= 6
    # a hanging-indent paragraph: first line at 72, the rest at 108
    c.drawString(72, y, fit(432, tail="Lindis-")); y -= 13
    c.drawString(108, y, fit(396, head="farne", tail="Alnm-")); y -= 13
    c.drawString(108, y, fit(396, head="outh")); y -= 13
    c.drawString(108, y, fit(150)); y -= 19
    for s in ("anti-", "counter-", "de-", "inter-"):
        c.drawString(72, y, s); y -= 13
    c.showPage()
    # page 5: right-aligned and centred lines broken at a hyphen; a table of narrow cells
    c.setFont("Helvetica", 10)
    y = 760
    for s in ("The pumping station by the weir has an Electro-", "magnetic flow meter fitted in 1998", "and checked each spring."):
        c.drawRightString(522, y, s); y -= 13
    y -= 10
    for s in ("Notes on the heat engine and its Thermo-", "dynamics as taught at the works school", "in the winter term."):
        c.drawCentredString(297, y, s); y -= 13
    y -= 20
    rows = [(("Hydro-", "static"), ("Pump",), ("Gear-", "box")), (("Valve",), ("AX-",), ("Main",)), (("Seal",), ("Lever",), ("Motor",))]
    for row in rows:
        for x, cell in zip((72, 140, 208), row):
            for k, s in enumerate(cell): c.drawString(x, y - 11 * k, s)
        y -= 26
    c.showPage()
    # page 6: the right column starts lower; columns of unequal length
    column(c, 72, 760, W, 12, last_tail="Ulver-")
    column(c, 312, 730, W, 5, first_head="ston")
    c.showPage()
    c.save()

def ls_rl():
    p = os.path.join(HERE, "ls_rl2.pdf"); c = canvas.Canvas(p, pagesize=letter)
    y = 760
    def lab(s):
        c.setFont("Helvetica", 10); c.drawString(72, y, s)
    # chess board file labels: each letter centred under a 14 pt square, 9 pt type
    c.setFont("Helvetica", 9)
    for k, ch in enumerate("abcdefgh"): c.drawCentredString(80 + 14 * k, y, ch)
    y -= 24
    # a row of single-letter cells at a 12 pt pitch, left aligned, 10 pt
    c.setFont("Helvetica", 10)
    for k, ch in enumerate("YNYNY"): c.drawString(72 + 12 * k, y, ch)
    y -= 24
    # rank labels down the side are not on one line; a keyboard row, each key centred in a 16 pt key
    for k, ch in enumerate("QWERTY"): c.drawCentredString(80 + 16 * k, y, ch)
    y -= 24
    # letters spaced by hand at a 0.4 em gap after each (Helvetica 12)
    x = 72; c.setFont("Helvetica", 12)
    for ch in "KIRKSTALL":
        c.drawString(x, y, ch); x += stringWidth(ch, "Helvetica", 12) + 0.4 * 12
    y -= 24
    # the same in Courier (a monospaced font: even starts and even gaps)
    x = 72; c.setFont("Courier", 12)
    for ch in "KIRKSTALL":
        c.drawString(x, y, ch); x += stringWidth(ch, "Courier", 12) + 0.4 * 12
    y -= 24
    c.save()

def hy_chrome_html():
    """paragraphs dense with long made-up names, each with soft hyphens between its syllables, each used once: most lines
    end in a broken name, wherever the line is (a column's foot before a heading, a picture, a table, a footnote; lists;
    indents; right and centred text; narrow cells)"""
    A = ["Ash", "Brad", "Carl", "Dun", "Eller", "Fen", "Gar", "Hal", "Ing", "Kel", "Lang", "Mar", "Nor", "Os", "Pen", "Rav", "Sed", "Thorn", "Ul", "Wen"]
    B = ["ber", "ing", "den", "ley", "ton", "by", "wick", "ford", "ham", "dale"]
    Cc = ["stone", "worth", "bridge", "moor", "field", "haugh", "brook", "combe"]
    import itertools, random
    rnd = random.Random(5)
    combos = [(a, b, c) for a in A for b in B for c in Cc]; rnd.shuffle(combos)
    used = []; plain = []
    for a, b, c in combos:
        w = a + b + c
        if any(w in u or u in w for u in plain): continue
        used.append("&shy;".join((a, b, c))); plain.append(w)
    it = iter(used)
    def para(n): return " ".join(("the %s" if k % 3 == 0 else "%s") % next(it) for k in range(n))
    html = """<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: Letter; margin: 0.75in; }
    body { font: 10pt/1.3 'DejaVu Sans', sans-serif; hyphens: manual; -webkit-hyphens: manual; }
    .cols { column-count: 2; column-gap: 22pt; }
    .j { text-align: justify; }
    h2 { font-size: 13pt; margin: 6pt 0; }
    .fig { height: 50pt; border: 1px solid #444; margin: 6pt 0; }
    ul, ol { padding-left: 22pt; margin: 4pt 0; }
    p { margin: 0 0 4pt 0; }
    p.ind { text-indent: 30pt; margin: 0; }
    p.hang { padding-left: 30pt; text-indent: -30pt; margin: 4pt 0; }
    .fn { font-size: 8pt; border-top: 1px solid #000; margin-top: 4pt; }
    .r { text-align: right; width: 240pt; margin-left: auto; }
    .c { text-align: center; width: 240pt; margin: 4pt auto; }
    table { border-collapse: collapse; margin: 4pt 0; } td { border: 1px solid #888; width: 54pt; vertical-align: top; padding: 2pt; font-size: 9pt; }
    .pb { break-before: page; }
    </style></head><body>
    <div class="cols j">%s</div>
    <h2>Results across the whole district</h2>
    <div class="cols">%s</div>
    <div class="fig"></div>
    <div class="cols j">%s</div>
    <table><tr><td>Valve</td><td>Seal</td><td>Rating</td><td>Size</td></tr><tr><td>V1</td><td>nitrile</td><td>PN16</td><td>DN50</td></tr></table>
    <div class="cols">%s</div>
    <div class="fn">1 See the annual report of the drainage board for the figures.</div>
    <div class="pb"></div>
    <ul><li>%s</li><li>%s</li></ul>
    <ol><li>%s</li><li>%s</li></ol>
    <p class="ind">%s</p><p class="ind">%s</p><p class="ind">%s</p>
    <p class="hang">%s</p><p class="hang">%s</p>
    <div class="r">%s</div>
    <div class="c">%s</div>
    <table><tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr><tr><td>Seal</td><td>Lever</td><td>Motor</td><td>Pipe</td></tr></table>
    <div class="cols" style="column-count:3">%s</div>
    </body></html>"""
    parts = [para(26), para(26), para(26), para(14)] + [para(9) for _ in range(11)] + [next(it) for _ in range(4)] + [para(30)]
    n = len(used) - len(list(it))
    return html % tuple(parts), plain[:n]

LS_LINES = [
    # (html, expected words as a reader should give them, letter-spaced?)
    ('<p>A B C D</p>', "A B C D", False),
    ('<p>• A B C D</p>', "• A B C D", False),
    ('<p>Q W E R T Y</p>', "Q W E R T Y", False),
    ('<p>I V X L C D M</p>', "I V X L C D M", False),
    ('<p>K Q R B N P</p>', "K Q R B N P", False),
    ('<p style="font-family:serif">A B C D E</p>', "A B C D E", False),
    ('<p style="font-family:monospace">A B C D E</p>', "A B C D E", False),
    ('<table><tr><td>Y</td><td>N</td><td>Y</td><td>N</td><td>Y</td></tr></table>', "Y N Y N Y", False),
    ('<p style="letter-spacing:.3em;font-family:monospace">SOWERBY BRIDGE</p>', "SOWERBY BRIDGE", True),
    ('<p style="letter-spacing:.3em;font-family:serif">CALDERDALE DEPOT</p>', "CALDERDALE DEPOT", True),
    ('<p style="letter-spacing:.15em;font-family:serif;font-size:6pt">HALIFAX STORES</p>', "HALIFAX STORES", True),
    ('<p style="letter-spacing:.5em;font-size:24pt">ELLAND</p>', "ELLAND", True),
    ('<p style="letter-spacing:.2em;font-size:40pt">BATLEY</p>', "BATLEY", True),
    ('<p style="letter-spacing:.25em;font-variant:small-caps">Warehouse North</p>', "Warehouse North", True),
    ('<p>Site: <span style="letter-spacing:.3em">KIRKSTALL</span> today</p>', "Site: KIRKSTALL today", True),
    ('<p style="letter-spacing:.3em">SAFETY FIRST AT ALL TIMES</p>', "SAFETY FIRST AT ALL TIMES", True),
    ('<p style="letter-spacing:.3em">A B C D</p>', "A B C D", True),
    ('<p>H<sub>2</sub>SO<sub>4</sub> and NaCl and CO<sub>2</sub></p>', "H2SO4 and NaCl and CO2", False),
    ('<p>1. e4 e5 2. Nf3 Nc6 3. Bb5 a6</p>', "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6", False),
]
def ls_chrome_html():
    body = "".join(h for h, _, _ in LS_LINES)
    return ("<!doctype html><html><head><meta charset='utf-8'><style>body{font:11pt 'DejaVu Sans',sans-serif} p{margin:5pt 0} "
            "td{padding:0 6pt}</style></head><body>" + body + "</body></html>")

def chrome_pdfs():
    from playwright.sync_api import sync_playwright
    h, names = hy_chrome_html()
    json.dump(names, open(os.path.join(HERE, "hy_chrome_names.json"), "w"))
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page()
        for name, src in (("hy_chrome.pdf", h), ("ls_chrome2.pdf", ls_chrome_html())):
            pg.set_content(src); pg.pdf(path=os.path.join(HERE, name), format="Letter", print_background=True)
        b.close()

# ---------------------------------------------------------------------------------------------------------------------
# pikepdf-made: standard fonts and encodings; links and named places; forms over two pages; deep forms; fields with no
# appearance
# ---------------------------------------------------------------------------------------------------------------------
def page(pdf, content, fonts=None, xobjs=None, size=(612, 792)):
    res = Dictionary()
    if fonts: res.Font = Dictionary(fonts)
    if xobjs: res.XObject = Dictionary(xobjs)
    pg = pikepdf.Page(Dictionary(Type=Name.Page, MediaBox=Array([0, 0, size[0], size[1]]), Resources=res,
                                 Contents=pdf.make_stream(content)))
    pdf.pages.append(pg)
    return pdf.pages[-1]

def std_font(pdf, base, enc=None, extra=None):
    d = Dictionary(Type=Name.Font, Subtype=Name.Type1, BaseFont=Name("/" + base))
    if enc is not None: d.Encoding = enc
    if extra:
        for k, v in extra.items(): d[k] = v
    return pdf.make_indirect(d)

ENC_LINES = [   # bytes drawn, what StandardEncoding says they are
    (b"Don\x27t \x60quote\x27 the \xaenance of the \xafuent pump", "Don’t ‘quote’ the finance of the fluent pump"),
    (b"\xe8ukasz and \xe1sir at the Stra\xfbe by the \xf9re", "Łukasz and Æsir at the Straße by the øre"),
    (b"pages 1\xb12 and \xaaHello\xba and 1\xa42 inch", "pages 1–2 and “Hello” and 1⁄2 inch"),
]
def enc_pdf():
    pdf = pikepdf.new()
    fonts = {}
    specs = [("F1", "Helvetica", None), ("F2", "Times-Roman", None), ("F3", "Courier", None), ("F4", "Helvetica-Bold", None),
             ("F5", "Times-BoldItalic", None), ("F6", "Arial", None), ("F7", "TimesNewRoman", None),
             ("F8", "Helvetica", Dictionary(Type=Name.Encoding, Differences=Array([65, Name.Aring]))),
             ("F9", "Helvetica", Name.WinAnsiEncoding), ("FA", "Times-Roman", Name.MacRomanEncoding),
             ("FB", "Symbol", None), ("FC", "ZapfDingbats", None), ("FD", "Helvetica", Name.StandardEncoding)]
    for k, base, enc in specs: fonts["/" + k] = std_font(pdf, base, enc)
    # one page per font: the three lines, 12 pt, at x 72, y 700 / 680 / 660
    for k, base, enc in specs:
        lines = ENC_LINES if base not in ("Symbol", "ZapfDingbats") else [(b"abg pqr ABG", ""), (b"4 8 l n u H", "")]
        cs = b"BT /" + k.encode() + b" 12 Tf "
        for i, (raw, _) in enumerate(lines):
            esc = raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
            cs += b"1 0 0 1 72 %d Tm (" % (700 - 20 * i) + esc + b") Tj "
        cs += b"ET"
        page(pdf, cs, {"/" + k: fonts["/" + k]})
    # an embedded TrueType (DejaVu Sans) with no /Encoding and no ToUnicode: unaffected by the rule
    pdf.save(os.path.join(HERE, "enc_std.pdf"))
    json.dump([[k, base, str(enc) if enc is not None else None] for k, base, enc in specs], open(os.path.join(HERE, "enc_std.json"), "w"))

def links_pdf():
    """named places in a /Names /Dests tree WITH /Kids and /Limits (sorted), the word in some names; links by name string
    (/Dest), by GoTo /D, by a name object from the catalog's /Dests; bookmarks by name; a GoToR to a file named with the word"""
    pdf = pikepdf.new()
    F = std_font(pdf, "Helvetica", Name.WinAnsiEncoding)
    for i, txt in enumerate([b"Visit Ormskirk market on page one.", b"Page two: the Burscough canal.", b"Page three: Aughton and Ormskirk road.", b"Page four: the index."]):
        page(pdf, b"BT /F1 12 Tf 72 700 Td (" + txt + b") Tj ET", {"/F1": F})
    P = [pdf.pages[i].obj for i in range(4)]
    def dest(i, y=700): return Array([P[i], Name.XYZ, 0, y, 0])
    names = [("Appendix", 3), ("Ormskirk-plan", 1), ("aaa.first", 0), ("chapter.2", 1), ("sec.Ormskirk.3", 2), ("zeta.end", 3)]
    srt = sorted(names, key=lambda x: x[0].encode())
    k1, k2 = srt[:3], srt[3:]
    def leaf(items): return pdf.make_indirect(Dictionary(Names=Array([v for n, i in items for v in (String(n), dest(i))]),
                                                       Limits=Array([String(items[0][0]), String(items[-1][0])])))
    tree = Dictionary(Kids=Array([leaf(k1), leaf(k2)]))
    pdf.Root.Names = Dictionary(Dests=pdf.make_indirect(tree))
    pdf.Root.Dests = pdf.make_indirect(Dictionary({"/OrmskirkTown": dest(2, 600), "/plain": dest(0, 500)}))
    def link(pg, rect, **kw):
        a = Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array(rect), Border=Array([0, 0, 0]), **kw)
        o = pdf.pages[pg].obj
        if "/Annots" not in o: o.Annots = Array()
        o.Annots.append(pdf.make_indirect(a))
    # page 4 (not marked): links to each named place, by each means
    link(3, [72, 600, 300, 615], Dest=String("Ormskirk-plan"))
    link(3, [72, 580, 300, 595], A=Dictionary(S=Name.GoTo, D=String("sec.Ormskirk.3")))
    link(3, [72, 560, 300, 575], Dest=Name("/OrmskirkTown"))
    link(3, [72, 540, 300, 555], Dest=String("zeta.end"))
    link(3, [72, 520, 300, 535], A=Dictionary(S=Name.GoTo, D=String("chapter.2")))
    link(3, [72, 500, 300, 515], A=Dictionary(S=Name.GoToR, F=String("Ormskirk-annex.pdf"), D=Array([0, Name.Fit])))
    # page 1 (marked): a link to a named place
    link(0, [72, 690, 300, 712], Dest=String("Ormskirk-plan"))
    # bookmarks
    items = [("Plan of Ormskirk", Dictionary(Dest=String("Ormskirk-plan"))), ("Road", Dictionary(A=Dictionary(S=Name.GoTo, D=String("sec.Ormskirk.3")))),
             ("Town", Dictionary(Dest=Name("/OrmskirkTown"))), ("End", Dictionary(Dest=String("zeta.end")))]
    ol = pdf.make_indirect(Dictionary(Type=Name.Outlines))
    objs = []
    for t, d in items:
        d.Title = String(t); d.Parent = ol; objs.append(pdf.make_indirect(d))
    for a, b in zip(objs, objs[1:]): a.Next = b; b.Prev = a
    ol.First = objs[0]; ol.Last = objs[-1]; ol.Count = len(objs)
    pdf.Root.Outlines = ol
    pdf.save(os.path.join(HERE, "links2.pdf"))

def ap(pdf, w, h, text, F):
    s = b"/Tx BMC q BT /Helv 10 Tf 2 %d Td (" % int(h / 2 - 3) + text.encode("latin-1") + b") Tj ET Q EMC"
    return pdf.make_stream(s, Type=Name.XObject, Subtype=Name.Form, BBox=Array([0, 0, w, h]), Resources=Dictionary(Font=Dictionary(Helv=F)))

def box_ap(pdf, w, h, on):
    s = (b"0 g 1 1 %d %d re f" % (w - 2, h - 2)) if on else b"0 G 0.5 0.5 %d %d re s" % (w - 1, h - 1)
    return pdf.make_stream(s, Type=Name.XObject, Subtype=Name.Form, BBox=Array([0, 0, w, h]))

def forms_pdf():
    """fields on two pages: page 1 holds the word Ormskirk (marked), page 2 does not. A text field with a widget on each
    page (one parent, two kids); radio groups with a button on each page; a parent with a child on each page"""
    pdf = pikepdf.new()
    F = std_font(pdf, "Helvetica", Name.WinAnsiEncoding)
    page(pdf, b"BT /F1 12 Tf 72 740 Td (Owner from Ormskirk, page one.) Tj ET", {"/F1": F})
    page(pdf, b"BT /F1 12 Tf 72 740 Td (Page two of the form.) Tj ET", {"/F1": F})
    P = [pdf.pages[0].obj, pdf.pages[1].obj]
    fields = []
    def widget(pg, rect, parent=None, **kw):
        w = Dictionary(Type=Name.Annot, Subtype=Name.Widget, Rect=Array(rect), P=P[pg], F=4, **kw)
        if parent is not None: w.Parent = parent
        w = pdf.make_indirect(w)
        (P[pg].__setattr__("Annots", Array()) if "/Annots" not in P[pg] else None); P[pg].Annots.append(w)
        return w
    def tx(name, pg, rect, val):
        w = widget(pg, rect, FT=Name.Tx, T=String(name), V=String(val), DA=String("/Helv 10 Tf 0 g"))
        w.AP = Dictionary(N=ap(pdf, rect[2] - rect[0], rect[3] - rect[1], val, F)); fields.append(w); return w
    tx("name", 0, [72, 680, 272, 700], "Alice Weaver")
    tx("city", 1, [72, 680, 272, 700], "Wigan Pier")
    # one field, two widgets
    ref = pdf.make_indirect(Dictionary(FT=Name.Tx, T=String("ref"), V=String("REF-77"), DA=String("/Helv 10 Tf 0 g"), Kids=Array()))
    for pg in (0, 1):
        w = widget(pg, [72, 640, 272, 660], ref); w.AP = Dictionary(N=ap(pdf, 200, 20, "REF-77", F)); ref.Kids.append(w)
    fields.append(ref)
    # radio groups: "choice" (selected button on page 2), "pick" (selected button on page 1)
    for nm, sel in (("choice", 1), ("pick", 0)):
        g = pdf.make_indirect(Dictionary(FT=Name.Btn, Ff=49152, T=String(nm), V=Name("/O%d" % sel), Kids=Array()))
        for pg in (0, 1):
            y = 600 if nm == "choice" else 570
            w = widget(pg, [72, y, 86, y + 14], g, AS=Name("/O%d" % pg) if pg == sel else Name.Off)
            w.AP = Dictionary(N=Dictionary({"/O%d" % pg: box_ap(pdf, 14, 14, True), "/Off": box_ap(pdf, 14, 14, False)}))
            g.Kids.append(w)
        fields.append(g)
    # a parent with a child on each page
    addr = pdf.make_indirect(Dictionary(T=String("addr"), Kids=Array()))
    for pg, (nm, val) in enumerate((("street", "12 Moor Lane"), ("town", "Burscough"))):
        k = pdf.make_indirect(Dictionary(FT=Name.Tx, T=String(nm), V=String(val), Parent=addr, Kids=Array(), DA=String("/Helv 10 Tf 0 g")))
        w = widget(pg, [72, 520, 272, 540], k); w.AP = Dictionary(N=ap(pdf, 200, 20, val, F)); k.Kids.append(w)
        addr.Kids.append(k)
    fields.append(addr)
    # a check box on page 2
    cb = widget(1, [72, 480, 86, 494], FT=Name.Btn, T=String("agree"), V=Name.Yes, AS=Name.Yes)
    cb.AP = Dictionary(N=Dictionary(Yes=box_ap(pdf, 14, 14, True), Off=box_ap(pdf, 14, 14, False))); fields.append(cb)
    pdf.Root.AcroForm = Dictionary(Fields=Array(fields), DA=String("/Helv 10 Tf 0 g"), DR=Dictionary(Font=Dictionary(Helv=F)))
    pdf.save(os.path.join(HERE, "forms2.pdf"))

def deep_pdf(name, depths, unmarked_depth=None):
    """page 1: 'Ormskirk' on the page and a word in a form nested d deep for each d in depths; page 2 (no word): a form
    nested unmarked_depth deep holding 'Langdale'; page 3: a form that draws itself holding 'Mardale'"""
    pdf = pikepdf.new()
    F = std_font(pdf, "Helvetica", Name.WinAnsiEncoding)
    def nest(d, word, y):
        inner = pdf.make_stream(b"BT /F1 12 Tf 200 %d Td (%s) Tj ET" % (y, word), Type=Name.XObject, Subtype=Name.Form,
                                BBox=Array([0, 0, 612, 792]), Resources=Dictionary(Font=Dictionary(F1=F)))
        cur = inner
        for _ in range(d - 1):
            cur = pdf.make_stream(b"q /X Do Q", Type=Name.XObject, Subtype=Name.Form, BBox=Array([0, 0, 612, 792]),
                                  Resources=Dictionary(XObject=Dictionary(X=cur)))
        return cur
    WORDS = {1: b"Ambleside", 70: b"Dalegarth", 100: b"Coniston", 200: b"Eskdale", 255: b"Grasmere", 256: b"Keswick", 257: b"Langdale", 300: b"Wasdale"}
    xo = {}; cs = b"BT /F1 12 Tf 72 740 Td (Ormskirk is on this page.) Tj ET "
    for n, d in enumerate(depths):
        xo["/D%d" % d] = nest(d, WORDS[d], 700 - 20 * n); cs += b"q /D%d Do Q " % d
    page(pdf, cs, {"/F1": F}, xo)
    if unmarked_depth:
        page(pdf, b"BT /F1 12 Tf 72 740 Td (Page two.) Tj ET q /DD Do Q", {"/F1": F}, {"/DD": nest(unmarked_depth, WORDS[unmarked_depth], 600)})
    me = pdf.make_stream(b"BT /F1 12 Tf 200 500 Td (Mardale) Tj ET q 0.5 0 0 0.5 0 0 cm /Me Do Q", Type=Name.XObject, Subtype=Name.Form,
                         BBox=Array([0, 0, 612, 792]), Resources=Dictionary(Font=Dictionary(F1=F)))
    me.Resources.XObject = Dictionary(Me=me)
    page(pdf, b"BT /F1 12 Tf 72 740 Td (Page three.) Tj ET q /Me Do Q", {"/F1": F}, {"/Me": me})
    pdf.save(os.path.join(HERE, name), object_stream_mode=pikepdf.ObjectStreamMode.generate, compress_streams=True)

def noap_pdf():
    """fields with no appearance of their own (/NeedAppearances): check boxes ticked with each /MK /CA, radios, a list box
    with two chosen, a comb field"""
    pdf = pikepdf.new()
    F = std_font(pdf, "Helvetica", Name.WinAnsiEncoding)
    Z = std_font(pdf, "ZapfDingbats")
    page(pdf, b"BT /F1 10 Tf 72 760 Td (Fields with no appearance) Tj ET", {"/F1": F})
    P = pdf.pages[0].obj; fields = []
    def w(rect, **kw):
        a = pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, Rect=Array(rect), P=P, F=4, **kw))
        (P.__setattr__("Annots", Array()) if "/Annots" not in P else None); P.Annots.append(a); return a
    cas = ["8", "4", "l", "n", "u", "H", None]
    for k, ca in enumerate(cas):
        x = 72 + 50 * k
        kw = dict(FT=Name.Btn, T=String("cb%d" % k), V=Name.Yes, AS=Name.Yes, DA=String("/ZaDb 0 Tf 0 g"))
        if ca: kw["MK"] = Dictionary(CA=String(ca))
        fields.append(w([x, 680, x + 20, 700], **kw))
    fields.append(w([72 + 50 * 7, 680, 72 + 50 * 7 + 20, 700], FT=Name.Btn, T=String("cboff"), V=Name.Off, AS=Name.Off, DA=String("/ZaDb 0 Tf 0 g"), MK=Dictionary(CA=String("8"))))
    for k, ca in enumerate([None, "u"]):
        g = pdf.make_indirect(Dictionary(FT=Name.Btn, Ff=49152, T=String("rad%d" % k), V=Name.On, Kids=Array()))
        x = 72 + 50 * k
        kw = dict(AS=Name.On, DA=String("/ZaDb 0 Tf 0 g"))
        if ca: kw["MK"] = Dictionary(CA=String(ca))
        kid = w([x, 630, x + 20, 650], **kw); kid.Parent = g; g.Kids.append(kid); fields.append(g)
    fields.append(w([72, 480, 232, 580], FT=Name.Ch, Ff=2097152, T=String("fruit"), Opt=Array([String(s) for s in ("Apple", "Banana", "Cherry", "Damson", "Elder", "Fig")]),
                    V=Array([String("Banana"), String("Damson")]), I=Array([1, 3]), DA=String("/Helv 12 Tf 0 g")))
    fields.append(w([72, 420, 312, 444], FT=Name.Tx, Ff=16777216, MaxLen=8, T=String("comb"), V=String("AB12CD"), DA=String("/Helv 14 Tf 0 g")))
    pdf.Root.AcroForm = Dictionary(Fields=Array(fields), NeedAppearances=True, DA=String("/Helv 10 Tf 0 g"),
                                   DR=Dictionary(Font=Dictionary(Helv=F, ZaDb=Z)))
    pdf.save(os.path.join(HERE, "noap.pdf"))
    # the reference: each ZapfDingbats letter drawn by reportlab in a 20 pt box, the size viewers use for an auto size
    c = canvas.Canvas(os.path.join(HERE, "zapf_ref.pdf"), pagesize=letter)
    for k, ch in enumerate("48lnuH"):
        c.setFont("ZapfDingbats", 16); c.drawCentredString(82 + 50 * k, 684, ch)
    c.save()

def kept_pdf():
    """words to keep in many scripts, plain, turned and slanted (DejaVu Sans, embedded by reportlab)"""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    c = canvas.Canvas(os.path.join(HERE, "kept.pdf"), pagesize=letter)
    lines = ["Ormskirk Café naïve façade Ångström Fernández",
             "Ormskirk Αθήνα κόσμος Μόσχα",
             "Ormskirk Москва журнал Щётка",
             "Ormskirk ﬁnance ﬂuent baﬄe İstanbul",
             "Ormskirk Café Zürich"]
    c.setFont("DV", 12)
    for i, s in enumerate(lines): c.drawString(72, 720 - 22 * i, s)
    for ang, (x, y), s in ((90, (500, 300), "Ormskirk Ulverston Kendal"), (30, (100, 200), "Ormskirk Penrith Keswick"), (-90, (560, 600), "Ormskirk Millom Sedbergh")):
        c.saveState(); c.translate(x, y); c.rotate(ang); c.drawString(0, 0, s); c.restoreState()
    c.saveState(); c.transform(1, 0, 0.35, 1, 300, 120); c.drawString(0, 0, "Ormskirk Appleby Tebay"); c.restoreState()
    c.save()

def forms3_pdf():
    """the word where no page shows it: an orphan field's value, a hidden widget's value on an unmarked page, a field
    named with it, a tooltip holding it"""
    pdf = pikepdf.new()
    F = std_font(pdf, "Helvetica", Name.WinAnsiEncoding)
    page(pdf, b"BT /F1 12 Tf 72 740 Td (Owner from Ormskirk, page one.) Tj ET", {"/F1": F})
    page(pdf, b"BT /F1 12 Tf 72 740 Td (Page two of the form.) Tj ET", {"/F1": F})
    P2 = pdf.pages[1].obj; fields = []
    def w(rect, **kw):
        a = pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, Rect=Array(rect), P=P2, **kw))
        if "/Annots" not in P2: P2.Annots = Array()
        P2.Annots.append(a); return a
    cb = w([72, 680, 86, 694], F=4, FT=Name.Btn, T=String("ormskirk_resident"), V=Name.Yes, AS=Name.Yes)
    cb.AP = Dictionary(N=Dictionary(Yes=box_ap(pdf, 14, 14, True), Off=box_ap(pdf, 14, 14, False))); fields.append(cb)
    nt = w([72, 640, 272, 660], F=4, FT=Name.Tx, T=String("note"), TU=String("Ormskirk residents only"), V=String("yes"), DA=String("/Helv 10 Tf 0 g"))
    nt.AP = Dictionary(N=ap(pdf, 200, 20, "yes", F)); fields.append(nt)
    hid = w([72, 600, 272, 620], F=6, FT=Name.Tx, T=String("city2"), V=String("Ormskirk Road"), DA=String("/Helv 10 Tf 0 g"))
    hid.AP = Dictionary(N=ap(pdf, 200, 20, "Ormskirk Road", F)); fields.append(hid)
    fields.append(pdf.make_indirect(Dictionary(FT=Name.Tx, T=String("hidden_town"), V=String("Ormskirk"))))
    pdf.Root.AcroForm = Dictionary(Fields=Array(fields), DA=String("/Helv 10 Tf 0 g"), DR=Dictionary(Font=Dictionary(Helv=F)))
    pdf.save(os.path.join(HERE, "forms3.pdf"))

def lo_docx():
    """a Word-like document made by python-docx, set by LibreOffice: two columns after a full-width heading, a header and
    a footer, bulleted and numbered lists, first-line and hanging indents, justified; made-up names with soft hyphens"""
    import docx, subprocess, tempfile, shutil, random
    from docx.shared import Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    A = ["Ash", "Brad", "Carl", "Dun", "Eller", "Fen", "Gar", "Hal", "Ing", "Kel", "Lang", "Mar", "Nor", "Os", "Pen", "Rav", "Sed", "Thorn", "Ul", "Wen"]
    B = ["ber", "ing", "den", "ley", "ton", "by", "wick", "ford", "ham", "dale"]
    Cc = ["gate", "holm", "thwaite", "beck", "garth", "royd", "shaw", "ley"]
    rnd = random.Random(7); combos = [(a, b, c) for a in A for b in B for c in Cc]; rnd.shuffle(combos)
    plain = []; used = []
    for a, b, c in combos:
        w_ = a + b + c
        if any(w_ in u or u in w_ for u in plain): continue
        plain.append(w_); used.append("­".join((a, b, c)))
    it = iter(used); n = [0]
    def para(k):
        n[0] += k
        return " ".join(("the %s" if j % 3 == 0 else "%s") % next(it) for j in range(k))
    d = docx.Document()
    st = d.styles["Normal"]; st.font.name = "Liberation Serif"; st.font.size = Pt(10)
    sec = d.sections[0]
    sec.header.paragraphs[0].text = "Drainage board report"
    sec.footer.paragraphs[0].text = "Confidential"
    d.add_heading("Survey of the district", level=1)
    # a continuous section of two columns
    def cols(section, num):
        sp = section._sectPr; c = sp.find(qn("w:cols"))
        if c is None: c = OxmlElement("w:cols"); sp.append(c)
        c.set(qn("w:num"), str(num)); c.set(qn("w:space"), "360")
    for _ in range(3):
        p = d.add_paragraph(para(18)); p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    from docx.enum.section import WD_SECTION
    s1 = d.sections[0]; cols(s1, 1)
    s2 = d.add_section(WD_SECTION.CONTINUOUS); cols(s2, 2)
    # (the paragraphs above belong to the first section: python-docx puts the break after them; so the two-column text
    # is what follows, up to the next break)
    for _ in range(6):
        p = d.add_paragraph(para(14)); p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    s3 = d.add_section(WD_SECTION.CONTINUOUS); cols(s3, 1)
    d.add_heading("Lists and indents", level=2)
    for _ in range(3): d.add_paragraph(para(9), style="List Bullet")
    for _ in range(3): d.add_paragraph(para(9), style="List Number")
    for _ in range(3):
        p = d.add_paragraph(para(14)); p.paragraph_format.first_line_indent = Pt(28)
    for _ in range(2):
        p = d.add_paragraph(para(14)); p.paragraph_format.left_indent = Pt(36); p.paragraph_format.first_line_indent = Pt(-36)
    p = d.add_paragraph(para(8)); p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p = d.add_paragraph(para(8)); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tmp = tempfile.mkdtemp(); src = os.path.join(tmp, "lo_word.docx"); d.save(src)
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, src], capture_output=True, timeout=180)
    shutil.copy(os.path.join(tmp, "lo_word.pdf"), os.path.join(HERE, "lo_word.pdf"))
    json.dump(plain[:n[0]], open(os.path.join(HERE, "lo_word_names.json"), "w"))

if __name__ == "__main__":
    hy_rl(); ls_rl(); chrome_pdfs(); enc_pdf(); links_pdf(); forms_pdf(); noap_pdf(); kept_pdf()
    forms3_pdf(); lo_docx()
    deep_pdf("deep256.pdf", [1, 100, 200, 255, 256])
    deep_pdf("deep257.pdf", [1, 257])
    deep_pdf("deep_unmarked.pdf", [1], unmarked_depth=200)
    deep_pdf("deep_unmarked70.pdf", [1], unmarked_depth=70)
    print("made", sorted(f for f in os.listdir(HERE) if f.endswith(".pdf")))
