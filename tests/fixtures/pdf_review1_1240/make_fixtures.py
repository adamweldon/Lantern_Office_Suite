# make_fixtures.py -- the PDFs for the independent review of 1.24.40's PDF tools (redact, edit text, protect, stamp,
# pages, combine, forms, flatten, comments, shrink, export, compare). Each is made here, by tools that are not Lantern:
# reportlab, pikepdf (hand-written content), qpdf (object streams, linearized, locked), pdflatex/xelatex, LibreOffice,
# Chromium's own "Save as PDF", tesseract (a scan with its invisible words), and a hand-written incremental update.
# Usage: python3 make_fixtures.py [outdir]   (default: this folder). make_big(outdir) makes the picture-heavy PDFs
# for Reduce size (not kept in the repository; the runner makes them in its own temp folder).
import os, sys, io, subprocess, shutil, tempfile, zlib, random
import pikepdf
from pikepdf import Pdf, Dictionary, Name, Array, Stream, String
from reportlab.pdfgen import canvas
from reportlab.lib.colors import white, black, red, blue
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else HERE

def p(name): return os.path.join(OUT, name)
def run(*a, **k): return subprocess.run(list(a), check=True, capture_output=True, **k)

# --- 1. fonts and text placements (reportlab; standard fonts named without widths) ----------------------------------
def t_fonts(path, rotate=0, crop=None, mediabox=None):
    c = canvas.Canvas(path, pagesize=(612, 792))
    for pg in range(2):
        c.setFont("Helvetica", 12); c.drawString(72, 740, "Helvetica line: account 4417-2290 is closed.")
        c.setFont("Times-Roman", 12); c.drawString(72, 715, "Times line one: the quick brown fox paid 3150 dollars to Smithfield Holdings.")
        c.setFont("Times-Roman", 12); c.drawString(72, 698, "Times line two: WAVERLEY is the code word, and nothing else.")
        c.setFont("Times-Bold", 14); c.drawString(72, 672, "Times Bold: Margaret Okonkwo-Bradshaw")
        c.setFont("Times-Italic", 11); c.drawString(72, 652, "Times Italic: telephone 918-555-0143 after hours")
        c.setFont("Courier", 10); c.drawString(72, 632, "Courier: SSN 123-45-6789 on file")
        # two columns, Times
        c.setFont("Times-Roman", 11)
        left = ["Left column: Patient Delphine", "Left column: dose was raised", "Left column: no fever"]
        right = ["Right column: Invoice 88231", "Right column: Harrowgate Ltd", "Right column: paid in full"]
        for k in range(3):
            c.drawString(72, 600 - 15 * k, left[k]); c.drawString(330, 600 - 15 * k, right[k])
        # text rise (Ts), horizontal scale (Tz), letter spacing (Tc), word spacing (Tw)
        t = c.beginText(72, 520); t.setFont("Times-Roman", 12); t.textOut("Before the raised word "); t.setRise(18); t.textOut("ZEPHYRINE"); t.setRise(0); t.textOut(" after it."); c.drawText(t)
        t = c.beginText(72, 490); t.setFont("Helvetica", 12); t.setHorizScale(150); t.textOut("Stretched: KINGSBRIDGE wide"); c.drawText(t)
        t = c.beginText(72, 465); t.setFont("Helvetica", 12); t.setCharSpace(3); t.textOut("Spaced: QUILLFEATHER letters"); c.drawText(t)
        t = c.beginText(72, 440); t.setFont("Times-Roman", 12); t.setWordSpace(10); t.textOut("Word spaced: alpha OSTRAVA gamma delta"); c.drawText(t)
        # a label turned 90 degrees (as on a drawing), and one upside down
        c.saveState(); c.translate(520, 200); c.rotate(90); c.setFont("Helvetica", 12); c.drawString(0, 0, "VERTICAL LABEL TREMONTANE"); c.restoreState()
        c.saveState(); c.translate(400, 120); c.rotate(180); c.setFont("Helvetica", 12); c.drawString(0, 0, "UPSIDE DOWN BELLWEATHER"); c.restoreState()
        c.saveState(); c.translate(100, 250); c.rotate(30); c.setFont("Times-Roman", 12); c.drawString(0, 0, "SLANTED GRANITEFALL TEXT"); c.restoreState()
        c.setFont("Helvetica", 9); c.drawString(72, 60, "Page %d of 2 footer: Kept as it is." % (pg + 1))
        c.showPage()
    c.save()
    if rotate or crop or mediabox:
        with Pdf.open(path, allow_overwriting_input=True) as d:
            for pgo in d.pages:
                if rotate: pgo.Rotate = rotate
                if crop: pgo.CropBox = Array(crop)
            d.save(path)

def t_landscape(path):
    # MediaBox upright, /Rotate 90, and the drawing turned so it reads across when shown (as scanners and some printers make landscape)
    c = canvas.Canvas(path, pagesize=(612, 792))
    c.saveState(); c.translate(612, 0); c.rotate(90)   # now x runs up the page, y runs to the left: draw a 792 x 612 landscape page
    c.setFont("Helvetica", 14); c.drawString(72, 540, "Landscape report: Station ALDERGROVE pressures")
    c.setFont("Times-Roman", 12); c.drawString(72, 510, "Reading taken by technician Petronella Vasquez at 0700.")
    c.setFont("Times-Roman", 12); c.drawString(72, 490, "This line is kept and must stay where it is.")
    c.restoreState(); c.showPage(); c.save()
    with Pdf.open(path, allow_overwriting_input=True) as d:
        d.pages[0].Rotate = 90; d.save(path)

def t_offset_box(path):
    # a MediaBox that does not start at 0 0, and a CropBox inside it; words outside the CropBox are not seen
    c = canvas.Canvas(path, pagesize=(712, 892))
    c.setFont("Helvetica", 12)
    c.drawString(160, 820, "Offset page: the word HOLLINGSWORTH near the top")
    c.drawString(160, 400, "Middle line: kept words stay put")
    c.drawString(160, 160, "Bottom: reference OBADIAH-77")
    c.drawString(20, 40, "OUTSIDE THE CROP: unseen words")
    c.showPage(); c.save()
    with Pdf.open(path, allow_overwriting_input=True) as d:
        d.pages[0].MediaBox = Array([100, 100, 712, 892]); d.pages[0].CropBox = Array([140, 140, 660, 860]); d.save(path)

def t_xobj(path):
    c = canvas.Canvas(path, pagesize=(612, 792))
    c.beginForm("hdr"); c.setFont("Helvetica", 12); c.drawString(0, 0, "Form header: PROJECT NIGHTJAR budget"); c.endForm()
    c.doForm("hdr")  # at 0,0 -> place it with a cm
    c.saveState(); c.translate(72, 700); c.doForm("hdr"); c.restoreState()
    c.saveState(); c.translate(72, 600); c.scale(1.5, 1.5); c.doForm("hdr"); c.restoreState()
    c.saveState(); c.translate(500, 300); c.rotate(90); c.doForm("hdr"); c.restoreState()
    c.setFont("Helvetica", 12); c.drawString(72, 500, "Page words: the form above holds the header.")
    c.showPage(); c.save()

# --- 2. hand-written content (pikepdf) -------------------------------------------------------------------------------
def new_page(pdf, content, resources, box=(0, 0, 612, 792), extra=None):
    d = Dictionary(Type=Name.Page, MediaBox=Array(list(box)), Resources=resources, Contents=pdf.make_stream(content))
    if extra:
        for k, v in extra.items(): d[k] = v
    pdf.pages.append(pikepdf.Page(d))

def std_font(pdf, base, widths=False):
    return pdf.make_indirect(Dictionary(Type=Name.Font, Subtype=Name.Type1, BaseFont=Name("/" + base), Encoding=Name.WinAnsiEncoding))

def tounicode(pdf, lo, hi):
    cm = ("/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /X def 1 begincodespacerange <00> <FF> endcodespacerange "
          "1 beginbfrange <%02X> <%02X> <%04X> endbfrange endcmap CMapName currentdict /CMap defineresource pop end end" % (lo, hi, lo)).encode()
    return pdf.make_stream(cm)

def t_type3(path):
    pdf = Pdf.new()
    procs = Dictionary()
    diffs = [32, Name("/space")]
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    diffs.append(65)
    for ch in letters: diffs.append(Name("/" + ch))
    procs.space = pdf.make_stream(b"60 0 d0")
    for ch in letters:
        procs["/" + ch] = pdf.make_stream(b"60 0 0 0 50 70 d1 5 0 40 70 re f")
    widths = [60] + [0] * 32 + [60] * 26   # codes 32..90
    f = pdf.make_indirect(Dictionary(Type=Name.Font, Subtype=Name.Type3, FontBBox=Array([0, 0, 60, 70]), FontMatrix=Array([0.01, 0, 0, 0.01, 0, 0]),
        CharProcs=procs, Encoding=Dictionary(Type=Name.Encoding, Differences=Array(diffs)), FirstChar=32, LastChar=90, Widths=Array(widths),
        Resources=Dictionary(), ToUnicode=tounicode(pdf, 32, 90)))
    h = std_font(pdf, "Helvetica")
    content = b"BT /T3 14 Tf 72 700 Td (TYPE THREE SECRET PELLINORE) Tj ET\nBT /H 12 Tf 72 650 Td (Helvetica words below the Type 3 line.) Tj ET\n"
    new_page(pdf, content, Dictionary(Font=Dictionary(T3=f, H=h)))
    pdf.save(path)

def t_hidden(path):
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    oc = pdf.make_indirect(Dictionary(Type=Name.OCG, Name=String("Hidden notes")))
    pdf.Root.OCProperties = Dictionary(OCGs=Array([oc]), D=Dictionary(Order=Array([oc]), OFF=Array([oc])))
    content = (b"BT /H 12 Tf 72 720 Td (Seen line: the visible words.) Tj ET\n"
               b"1 1 1 rg BT /H 12 Tf 72 700 Td (White text: CASSIOPEIA hidden in white) Tj ET 0 g\n"
               b"BT /H 12 Tf 72 680 Td (Covered text: LINDQVIST under a box) Tj ET 1 1 1 rg 70 676 260 16 re f 0 g\n"
               b"BT /H 12 Tf -400 600 Td (Off the page: MARCHETTI far left) Tj ET\n"
               b"BT 3 Tr /H 12 Tf 72 640 Td (Invisible mode three: ROSKILDE text) Tj ET\n"
               b"/OC /L1 BDC BT /H 12 Tf 72 620 Td (In a layer that is off: BALTHAZAR) Tj ET EMC\n"
               b"BT /H 12 Tf 72 560 Td (Last seen line stays.) Tj ET\n")
    new_page(pdf, content, Dictionary(Font=Dictionary(H=h), Properties=Dictionary(L1=oc)))
    pdf.save(path)

def t_actualtext(path):
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    content = (b"BT /H 12 Tf 72 720 Td /Span <</ActualText (Torque 45 Nm)>> BDC (Torque 45 Nm) Tj EMC ET\n"
               b"BT /H 12 Tf 72 700 Td /Span <</Alt (alt words VESPERTINE)>> BDC (Second line with alt) Tj EMC ET\n"
               b"BT /H 12 Tf 72 680 Td (Third line unchanged.) Tj ET\n")
    new_page(pdf, content, Dictionary(Font=Dictionary(H=h)))
    pdf.save(path)

def t_multistream(path):
    # one text object split over three content streams (allowed: they are read as one), and TJ with kerning
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica"); tr = std_font(pdf, "Times-Roman")
    s1 = pdf.make_stream(b"BT /H 12 Tf 72 720 Td (First stream line: GOLDCREST) Tj 0 -20 Td")
    s2 = pdf.make_stream(b"(Second line spans streams: ) Tj")
    s3 = pdf.make_stream(b"(NUTHATCH) Tj ET\nBT /T 12 Tf 72 660 Td [(Kerned T) 80 (imes: W) 120 (A) 60 (VERLEY ) -250 (code)] TJ ET\nBT /H 12 Tf 72 640 Td (Tail line stays put.) Tj ET\n")
    d = Dictionary(Type=Name.Page, MediaBox=Array([0, 0, 612, 792]), Resources=Dictionary(Font=Dictionary(H=h, T=tr)), Contents=Array([s1, s2, s3]))
    pdf.pages.append(pikepdf.Page(d))
    pdf.save(path)

def t_inline(path):
    # an inline image whose data holds the letters EI (as raw image data can), then words after it
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    data = bytes([0x45, 0x49, 0x20, 0x41] * 12)   # "EI A" repeated: 8x6 gray = 48 bytes
    content = (b"BT /H 12 Tf 72 720 Td (Before the picture: KESTREL) Tj ET\n"
               b"q 40 0 0 30 72 650 cm BI /W 8 /H 6 /CS /G /BPC 8 ID " + data + b" EI Q\n"
               b"BT /H 12 Tf 72 620 Td (After the picture: PEREGRINE) Tj ET\n"
               b"BT /H 12 Tf 72 600 Td (Last line after the picture.) Tj ET\n")
    new_page(pdf, content, Dictionary(Font=Dictionary(H=h)))
    pdf.save(path)

def t_incremental(path):
    # a page saved, then changed by an incremental update: the old words remain in the file's earlier part
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    new_page(pdf, b"BT /H 14 Tf 72 700 Td (OLD PRICE 450 for the pump) Tj ET\nBT /H 12 Tf 72 660 Td (Unchanged second line.) Tj ET\n", Dictionary(Font=Dictionary(H=h)))
    buf = io.BytesIO(); pdf.save(buf, static_id=True, object_stream_mode=pikepdf.ObjectStreamMode.disable, compress_streams=False)
    base = buf.getvalue()
    with Pdf.open(io.BytesIO(base)) as d:
        page = d.pages[0].obj; pnum = page.objgen[0]; size = int(d.trailer.Size); root = d.Root.objgen[0]
    new_content = b"BT /H 14 Tf 72 700 Td (NEW PRICE 520 for the pump) Tj ET\nBT /H 12 Tf 72 660 Td (Unchanged second line.) Tj ET\n"
    cnum = size
    startxref = int(base.rsplit(b"startxref", 1)[1].split()[0])
    out = bytearray(base)
    if not out.endswith(b"\n"): out += b"\n"
    off_c = len(out); out += b"%d 0 obj\n<< /Length %d >>\nstream\n" % (cnum, len(new_content)) + new_content + b"\nendstream\nendobj\n"
    # the page again, pointing at the new drawing
    with Pdf.open(io.BytesIO(base)) as d:
        pg = d.pages[0].obj
        parent = pg.Parent.objgen[0]; fnt = pg.Resources.Font.H.objgen[0]
    off_p = len(out); out += b"%d 0 obj\n<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Resources << /Font << /H %d 0 R >> >> /Contents %d 0 R >>\nendobj\n" % (pnum, parent, fnt, cnum)
    xr = len(out)
    out += b"xref\n%d 1\n%010d 00000 n \n%d 1\n%010d 00000 n \n" % (pnum, off_p, cnum, off_c)
    out += b"trailer\n<< /Size %d /Root %d 0 R /Prev %d >>\nstartxref\n%d\n%%%%EOF\n" % (cnum + 1, root, startxref, xr)
    open(path, "wb").write(bytes(out))

def t_dests(path):
    # old-style named destinations in the catalog (/Dests), a link that uses one, page labels and an open action
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    for k in range(3):
        new_page(pdf, b"BT /H 14 Tf 72 700 Td (Chapter %d page) Tj ET\n" % (k + 1), Dictionary(Font=Dictionary(H=h)))
    pdf.Root.Dests = pdf.make_indirect(Dictionary(chap3=Array([pdf.pages[2].obj, Name.Fit])))
    link = pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 690, 250, 715]), Border=Array([0, 0, 1]), Dest=Name("/chap3")))
    pdf.pages[0].Annots = Array([link])
    pdf.Root.PageLabels = Dictionary(Nums=Array([0, Dictionary(S=Name.r)]))
    pdf.Root.OpenAction = Array([pdf.pages[1].obj, Name.Fit])
    pdf.save(path)


def t_editmove(path):
    # a label, a value and a unit on one line, far apart (three pieces), the gaps made by TJ moves after each, in
    # Helvetica, in Times named without widths, and in an embedded TrueType font with its widths
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica"); tr = std_font(pdf, "Times-Roman")
    content = (b"BT /H 12 Tf 72 700 Td (Pump number:) Tj [-6000] TJ (P-101 Westfield) Tj [-6000] TJ (Rated 30 HP) Tj ET\n"
               b"BT /T 12 Tf 72 660 Td (Pump number:) Tj [-6000] TJ (P-101 Westfield) Tj [-6000] TJ (Rated 30 HP) Tj ET\n"
               b"BT /T 12 Tf 72 620 Td (Second Times line: a long run of words to keep where they are) Tj ET\n"
               b"0.8 0 0 rg BT /H 14 Tf 72 580 Td (Red heading words) Tj ET 0 g\n"
               b"BT /H 12 Tf 1 0 0 1 72 540 Tm (Line one of three) Tj 0 -16 Td (Line two of three) Tj 0 -16 Td (Line three of three) Tj ET\n")
    new_page(pdf, content, Dictionary(Font=Dictionary(H=h, T=tr)))
    pdf.save(path)
    # the same words in an embedded TrueType font (reportlab), on a second file
    pdfmetrics.registerFont(TTFont("DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    c = canvas.Canvas(path.replace(".pdf", "_ttf.pdf"), pagesize=(612, 792))
    t = c.beginText(72, 700); t.setFont("DejaVuSans", 12); t.textOut("Pump number:"); t.moveCursor(150, 0); t.textOut("P-101 Westfield"); t.moveCursor(150, 0); t.textOut("Rated 30 HP"); c.drawText(t)
    c.setFont("DejaVuSans", 12); c.drawString(72, 660, "Embedded font line: 40 °C, 4.7 kΩ, kept as it is.")
    c.showPage(); c.save()

def t_scripts(path):
    # what Remove hidden is for: scripts and actions, attached files, details (Info, XMP on the document and on a page)
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    new_page(pdf, b"BT /H 12 Tf 72 700 Td (Page one words.) Tj ET\n", Dictionary(Font=Dictionary(H=h)))
    new_page(pdf, b"BT /H 12 Tf 72 700 Td (Page two words.) Tj ET\n", Dictionary(Font=Dictionary(H=h)))
    js = pdf.make_stream(b"app.alert('DOCSCRIPT ZANZIBAR');")
    pdf.Root.Names = Dictionary(JavaScript=Dictionary(Names=Array([String("doc"), Dictionary(S=Name.JavaScript, JS=js)])))
    pdf.Root.OpenAction = Dictionary(S=Name.JavaScript, JS=String("app.alert('OPENSCRIPT QUIXOTE')"))
    xmp = pdf.make_stream(b'<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>XMPAUTHOR HEPZIBAH</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>')
    xmp.Type = Name.Metadata; xmp.Subtype = Name.XML
    pdf.Root.Metadata = xmp
    pdf.docinfo["/Author"] = "INFOAUTHOR PERPETUA"; pdf.docinfo["/Title"] = "Title kept or not"
    p1 = pdf.pages[0].obj
    pm = pdf.make_stream(b"<x:xmpmeta>PAGEXMP ALOYSIUS</x:xmpmeta>"); pm.Type = Name.Metadata; pm.Subtype = Name.XML
    p1.Metadata = pm
    p1.PieceInfo = Dictionary(Illustrator=Dictionary(Private=String("PIECEINFO TIBERIUS"), LastModified=String("D:20200101")))
    p1.AA = Dictionary(O=Dictionary(S=Name.JavaScript, JS=String("app.alert('PAGEOPEN SCRIPT')")))
    emb = pdf.make_stream(b"EMBEDDED FILE BARNABY"); emb.Type = Name.EmbeddedFile
    pdf.Root.Names.EmbeddedFiles = Dictionary(Names=Array([String("a.txt"), Dictionary(Type=Name.Filespec, F=String("a.txt"), EF=Dictionary(F=emb))]))
    links = [
        Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 600, 200, 620]), A=Dictionary(S=Name.JavaScript, JS=String("app.alert('LINKSCRIPT')"))),
        Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 560, 200, 580]), A=Dictionary(S=Name.Launch, F=String("calc.exe"))),
        Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 520, 200, 540]), A=Dictionary(S=Name.URI, URI=String("https://example.org/kept"))),
        Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 480, 200, 500]), A=Dictionary(S=Name.SubmitForm, F=Dictionary(FS=Name.URL, F=String("https://example.org/collect")))),
        Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 440, 200, 460]), A=Dictionary(S=Name.GoTo, D=Array([pdf.pages[1].obj, Name.Fit]), Next=Dictionary(S=Name.JavaScript, JS=String("app.alert('NEXTSCRIPT')")))),
    ]
    p1.Annots = Array([pdf.make_indirect(a) for a in links])
    pdf.save(path)

def t_inherit(path):
    # Rotate, MediaBox and Resources set on the page tree, not the page
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    for k in range(2):
        new_page(pdf, b"BT /H 12 Tf 72 700 Td (Inherited page %d: words) Tj ET\n" % (k + 1), Dictionary(Font=Dictionary(H=h)))
    pdf.Root.Pages.Rotate = 90; pdf.Root.Pages.MediaBox = Array([0, 0, 500, 700]); pdf.Root.Pages.Resources = Dictionary(Font=Dictionary(H=h))
    for pgo in pdf.pages:
        del pgo.obj["/MediaBox"]; del pgo.obj["/Resources"]
    pdf.save(path)


def t_many_objstm(path):
    # 120 pages, then qpdf packs the objects into object streams of 100 each: two object streams
    c = canvas.Canvas(path + ".tmp.pdf")
    for k in range(120):
        c.setFont("Helvetica", 12); c.drawString(72, 700, "Page %d of the manual" % (k + 1)); c.showPage()
    c.save()
    run("qpdf", "--object-streams=generate", path + ".tmp.pdf", path); os.remove(path + ".tmp.pdf")

# --- 3. comments of every kind (pikepdf), on an upright page and on a page turned 90 ----------------------------------
def a_annots(path):
    c = canvas.Canvas(path, pagesize=(612, 792))
    for k in range(2):
        c.setFont("Helvetica", 12)
        c.drawString(72, 700, "Annotated page %d: the words under the comments." % (k + 1))
        c.drawString(72, 500, "A second line far below, near the box comment.")
        c.showPage()
    c.save()
    pdf = Pdf.open(path, allow_overwriting_input=True)
    helv = std_font(pdf, "Helvetica")
    for k, pgo in enumerate(pdf.pages):
        if k == 1: pgo.Rotate = 90
        ap_ft = pdf.make_stream(b"q 0 0 1 RG 1 w 0.5 0.5 199 29 re S BT /Helv 11 Tf 0 0 0 rg 4 10 Td (FREETEXT ESMERALDA box) Tj ET Q")
        ap_ft.Type = Name.XObject; ap_ft.Subtype = Name.Form; ap_ft.BBox = Array([0, 0, 200, 30]); ap_ft.Resources = Dictionary(Font=Dictionary(Helv=helv))
        ap_sq = pdf.make_stream(b"q 1 0 0 rg 0 0 1 RG 2 w 1 1 98 48 re B Q")   # filled red: the annotation's /CA makes it see-through
        ap_sq.Type = Name.XObject; ap_sq.Subtype = Name.Form; ap_sq.BBox = Array([0, 0, 100, 50]); ap_sq.Resources = Dictionary()
        emb = pdf.make_stream(b"ATTACHED SECRET OBERON payroll")
        emb.Type = Name.EmbeddedFile
        fs = Dictionary(Type=Name.Filespec, F=String("pay.txt"), UF=String("pay.txt"), EF=Dictionary(F=emb))
        popup = pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Popup, Rect=Array([300, 600, 450, 700]), Open=False))
        note = pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Text, Rect=Array([40, 690, 60, 710]), Contents=String("Sticky note: MORDECAI called"), T=String("Reviewer"), Popup=popup, C=Array([1, 1, 0])))
        popup.Parent = note
        annots = [
            note, popup,
            Dictionary(Type=Name.Annot, Subtype=Name.FreeText, Rect=Array([300, 690, 500, 720]), Contents=String("FREETEXT ESMERALDA box"), DA=String("/Helv 11 Tf 0 0 1 rg"), AP=Dictionary(N=ap_ft)),
            Dictionary(Type=Name.Annot, Subtype=Name.Square, Rect=Array([60, 480, 160, 530]), CA=0.3, C=Array([0, 0, 1]), IC=Array([1, 0, 0]), AP=Dictionary(N=ap_sq), Contents=String("box comment")),
            Dictionary(Type=Name.Annot, Subtype=Name.Highlight, Rect=Array([70, 695, 300, 714]), QuadPoints=Array([70, 714, 300, 714, 70, 695, 300, 695]), C=Array([1, 1, 0]), Contents=String("highlighted words")),
            Dictionary(Type=Name.Annot, Subtype=Name.Ink, Rect=Array([300, 400, 400, 460]), InkList=Array([Array([310, 410, 350, 450, 390, 420])]), C=Array([0, 0.5, 0]), BS=Dictionary(W=2)),
            Dictionary(Type=Name.Annot, Subtype=Name.Line, Rect=Array([100, 300, 300, 350]), L=Array([105, 305, 295, 345]), C=Array([1, 0, 0])),
            Dictionary(Type=Name.Annot, Subtype=Name.Stamp, Rect=Array([400, 200, 550, 250]), Name=Name.Approved, Contents=String("stamp")),
            Dictionary(Type=Name.Annot, Subtype=Name.FileAttachment, Rect=Array([560, 700, 575, 720]), FS=fs, Contents=String("payroll attached"), Name=Name.PushPin),
            Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 495, 300, 512]), Border=Array([0, 0, 0]), A=Dictionary(S=Name.URI, URI=String("https://example.org/a"))),
        ]
        pgo.Annots = Array([pdf.make_indirect(a) if not isinstance(a, pikepdf.Object) or not a.is_indirect else a for a in annots])
    pdf.save(path)
    pdf.close()

# --- 4. forms of every kind ---------------------------------------------------------------------------------------
def f_form(path):
    c = canvas.Canvas(path, pagesize=(612, 792))
    f = c.acroForm
    c.setFont("Helvetica", 11)
    c.drawString(72, 740, "Name:"); f.textfield(name="name", value="", x=150, y=732, width=250, height=20)
    c.drawString(72, 705, "Notes:"); f.textfield(name="notes", value="", x=150, y=650, width=300, height=60, fieldFlags="multiline")
    c.drawString(72, 625, "PIN:"); f.textfield(name="pin", value="", x=150, y=617, width=100, height=20, fieldFlags="password")
    c.drawString(72, 590, "Code:"); f.textfield(name="code", value="", x=150, y=582, width=120, height=20, fieldFlags="comb", maxlen=6)
    c.drawString(72, 555, "Agree:"); f.checkbox(name="agree", x=150, y=550, size=16, checked=False, buttonStyle="check")
    c.drawString(72, 520, "Shift:")
    for k, v in enumerate(["Day", "Night", "Weekend"]):
        f.radio(name="shift", value=v, selected=(v == "Day"), x=150 + 80 * k, y=515, size=16, buttonStyle="circle")
        c.drawString(170 + 80 * k, 520, v)
    c.drawString(72, 480, "Unit:"); f.choice(name="unit", value="mm", options=["mm", "inch", ("Metres (m)", "m")], x=150, y=472, width=120, height=20)
    c.drawString(72, 440, "Grade:"); f.listbox(name="grade", value="B", options=["A", "B", "C"], x=150, y=390, width=80, height=60)
    c.drawString(72, 360, "Right:"); f.textfield(name="right", value="", x=150, y=352, width=200, height=20)
    c.showPage()
    c.setFont("Helvetica", 11); c.drawString(72, 740, "Page 2 of the form."); c.showPage()
    c.save()
    with Pdf.open(path, allow_overwriting_input=True) as d:
        flds = d.Root.AcroForm.Fields
        for fo in flds:
            if str(fo.get("/T", "")) == "right": fo.Q = 2
        # a parent field with two kids (full names addr.street, addr.city), on page 2
        helv = d.Root.AcroForm.DR.Font.get("/Helv") if "/DR" in d.Root.AcroForm and "/Helv" in d.Root.AcroForm.DR.Font else None
        parent = d.make_indirect(Dictionary(T=String("addr"), FT=Name.Tx, Kids=Array([])))
        p2 = d.pages[1].obj
        kids = []
        for k, (nm, y) in enumerate([("street", 680), ("city", 640)]):
            w = d.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, T=String(nm), Parent=parent, Rect=Array([150, y, 400, y + 20]), F=4, DA=String("/Helv 10 Tf 0 g"), P=p2))
            kids.append(w)
        parent.Kids = Array(kids)
        # one field shown twice: on page 1 and on page 2 (two widgets, one value)
        twin = d.make_indirect(Dictionary(T=String("job"), FT=Name.Tx, DA=String("/Helv 10 Tf 0 g"), Kids=Array([])))
        w1 = d.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, Parent=twin, Rect=Array([420, 732, 560, 752]), F=4, P=d.pages[0].obj))
        w2 = d.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, Parent=twin, Rect=Array([420, 600, 560, 620]), F=4, P=p2))
        twin.Kids = Array([w1, w2])
        flds.append(parent); flds.append(twin)
        a1 = d.pages[0].obj.Annots; a1.append(w1)
        p2.Annots = Array(kids + [w2])
        d.save(path)

def f_rot_form(path):
    # a field on a page turned 90, the field turned with it (/MK /R 90), as Acrobat makes it for a landscape page
    c = canvas.Canvas(path, pagesize=(612, 792))
    c.saveState(); c.translate(612, 0); c.rotate(90); c.setFont("Helvetica", 12); c.drawString(72, 540, "Landscape form: Inspector name"); c.restoreState()
    c.showPage(); c.save()
    with Pdf.open(path, allow_overwriting_input=True) as d:
        d.pages[0].Rotate = 90
        helv = std_font(d, "Helvetica")
        w = d.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, FT=Name.Tx, T=String("inspector"), Rect=Array([40, 300, 62, 560]), F=4, DA=String("/Helv 12 Tf 0 g"), MK=Dictionary(R=90), P=d.pages[0].obj))
        d.pages[0].Annots = Array([w])
        d.Root.AcroForm = Dictionary(Fields=Array([w]), DR=Dictionary(Font=Dictionary(Helv=helv)), DA=String("/Helv 0 Tf 0 g"))
        d.save(path)

# --- 5. real makers: LaTeX, xelatex (Type0 fonts), LibreOffice (tagged), Chromium, tesseract --------------------------
LATEX = r"""\documentclass[twocolumn]{article}
\usepackage[T1]{fontenc}\usepackage{lmodern}\usepackage[colorlinks=true]{hyperref}
\begin{document}
\section{Office findings}\label{sec:a}
The confidential office affirmed that the fifth officer, Bartholomew Quince, filed the claim. Waverley is the code. Efficient staff fill the offices daily.
\section{Second part}
See section~\ref{sec:a} and \href{https://example.org/x}{the web page}. Torque the flange bolts to 45 Nm. The pressure tested at 6 bar.
\newpage
\section{Next page}
Unmarked page: confidential office words again, Bartholomew Quince.
\end{document}
"""
XELATEX = r"""\documentclass{article}
\usepackage{fontspec}\setmainfont{DejaVu Serif}
\begin{document}
Type0 line one: the account of Ignatius Fairweather is closed.

Type0 line two: temperature 40\,°C, resistance 4.7~k$\Omega$, and Ünïcödé words.

Type0 line three: Pressure tested at 6 bar.
\end{document}
"""
def tex(path, src, engine):
    d = tempfile.mkdtemp()
    open(os.path.join(d, "x.tex"), "w").write(src)
    for _ in range(2): subprocess.run([engine, "-interaction=nonstopmode", "x.tex"], cwd=d, capture_output=True)
    shutil.copy(os.path.join(d, "x.pdf"), path)

HTML = """<html><head><meta charset="utf-8"><style>body{font-family:'Liberation Serif',serif;font-size:13pt;margin:60px}
.v{position:absolute;left:520px;top:300px;transform:rotate(-90deg);transform-origin:left top;font-family:sans-serif}</style></head><body>
<h1>Chromium report</h1>
<p>Client: Cornelius Ashdown-Pryce, account 7730-1142.</p>
<p>The quick brown fox paid 3150 dollars; nothing else is secret here.</p>
<p><a href="https://example.org/c">A link to the web</a> and more words after it.</p>
<p>Unicode: 40 °C, 4.7 kΩ, “quoted” words, naïve café.</p>
<div class="v">SIDEWAYS CHROME MARGINALIA</div>
</body></html>"""
def chrome_pdf(path):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page(); pg.set_content(HTML); pg.pdf(path=path, format="Letter", print_background=True); b.close()

LO_HTML = """<html><body><h1>LibreOffice document</h1><p>Prepared for Theodora Blackwood-Ince, file 55-0921.</p>
<p>Second paragraph: the valve was replaced on Tuesday.</p><table border="1"><tr><td>Part</td><td>Price</td></tr><tr><td>Impeller</td><td>1290</td></tr></table>
<p>Last paragraph stays as it is.</p></body></html>"""
def lo_pdf(path):
    d = tempfile.mkdtemp(); src = os.path.join(d, "lo.html"); open(src, "w").write(LO_HTML)
    flt = 'pdf:writer_web_pdf_Export:{"UseTaggedPDF":{"type":"boolean","value":"true"}}'
    subprocess.run(["soffice", "--headless", "--convert-to", flt, "--outdir", d, src], capture_output=True, timeout=180)
    shutil.copy(os.path.join(d, "lo.pdf"), path)

def ocr_pdf(path):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new("L", (1275, 900), 255); dr = ImageDraw.Draw(im)
    fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    lines = ["Scanned letter from Wilhelmina Strand", "Account number 5512 0098 7765", "Please call before Friday", "Signed by the manager"]
    for k, t in enumerate(lines): dr.text((100, 120 + 140 * k), t, font=fnt, fill=0)
    d = tempfile.mkdtemp(); f = os.path.join(d, "scan.png"); im.save(f, dpi=(150, 150))
    subprocess.run(["tesseract", f, os.path.join(d, "ocr"), "pdf"], capture_output=True)
    shutil.copy(os.path.join(d, "ocr.pdf"), path)

# --- 6. locked and restructured copies (qpdf) -------------------------------------------------------------------
def qpdf_variants():
    run("qpdf", "--encrypt", "user1", "own1", "128", "--use-aes=y", "--", p("t_fonts.pdf"), p("t_fonts_aes128_user.pdf"))
    run("qpdf", "--encrypt", "", "boss", "256", "--print=none", "--modify=none", "--extract=n", "--", p("f_form.pdf"), p("f_form_aes256_owner.pdf"))
    run("qpdf", "--object-streams=generate", "--linearize", p("f_form.pdf"), p("f_form_objstm_lin.pdf"))
    run("qpdf", "--object-streams=generate", p("a_annots.pdf"), p("a_annots_objstm.pdf"))
    run("qpdf", "--encrypt", "Ünï-密码", "Ünï-密码-owner", "256", "--", p("t_actualtext.pdf"), p("t_unicode_pw.pdf"))

# --- 7. the picture-heavy PDFs for Reduce size (made where asked, not kept) ------------------------------------
def make_big(outdir):
    from PIL import Image, ImageDraw, ImageFilter
    random.seed(7)
    def photo(w, h, mode="RGB"):
        im = Image.new("RGB", (w, h), "white"); dr = ImageDraw.Draw(im)
        for k in range(160):
            x, y = random.randrange(w), random.randrange(h)
            dr.ellipse((x, y, x + w // 8, y + h // 10), fill=(random.randrange(256), random.randrange(256), random.randrange(256)))
        im = im.filter(ImageFilter.GaussianBlur(2))
        return im.convert(mode) if mode != "RGB" else im
    pdf = Pdf.new()
    h = std_font(pdf, "Helvetica")
    def img_obj(data, w, hh, cs, bpc=8, flt=Name.FlateDecode, **extra):
        s = pdf.make_stream(data); s.Type = Name.XObject; s.Subtype = Name.Image; s.Width = w; s.Height = hh; s.BitsPerComponent = bpc
        if cs is not None: s.ColorSpace = cs
        if flt is not None: s.Filter = flt
        for k, v in extra.items(): s["/" + k] = v
        return s
    pages = []
    W, H = 1100, 1400
    rgb = photo(W, H)
    gray = photo(W, H, "L")
    cmyk = photo(W, H).convert("CMYK")
    pal = photo(W, H).convert("P", palette=Image.ADAPTIVE, colors=64)
    b_rgb = img_obj(zlib.compress(rgb.tobytes()), W, H, Name.DeviceRGB)
    b_gray = img_obj(zlib.compress(gray.tobytes()), W, H, Name.DeviceGray)
    bio = io.BytesIO(); cmyk.save(bio, "JPEG", quality=95); b_cmyk = img_obj(bio.getvalue(), W, H, Name.DeviceCMYK, flt=Name.DCTDecode, Decode=Array([1, 0, 1, 0, 1, 0, 1, 0]))
    palette = pal.getpalette()[:64 * 3]
    b_idx = img_obj(zlib.compress(pal.tobytes()), W, H, Array([Name.Indexed, Name.DeviceRGB, 63, String(bytes(palette))]))
    alpha = Image.new("L", (W, H), 0); ImageDraw.Draw(alpha).ellipse((50, 50, W - 50, H - 50), fill=255)
    sm = img_obj(zlib.compress(alpha.tobytes()), W, H, Name.DeviceGray)
    b_smask = img_obj(zlib.compress(rgb.tobytes()), W, H, Name.DeviceRGB, SMask=sm)
    stencil = img_obj(zlib.compress(alpha.point(lambda v: 0 if v else 255).convert("1").tobytes()), W, H, None, bpc=1, ImageMask=True)
    b_mask = img_obj(zlib.compress(rgb.tobytes()), W, H, Name.DeviceRGB, Mask=stencil)
    b_ckey = img_obj(zlib.compress(rgb.tobytes()), W, H, Name.DeviceRGB, Mask=Array([250, 255, 250, 255, 250, 255]))
    b_dec = img_obj(zlib.compress(gray.tobytes()), W, H, Name.DeviceGray, Decode=Array([1, 0]))
    rgb16 = bytearray()
    raw = rgb.tobytes()
    for v in raw: rgb16 += bytes([v, v])
    b_16 = img_obj(zlib.compress(bytes(rgb16)), W, H, Name.DeviceRGB, bpc=16)
    bio = io.BytesIO(); photo(300, 400).save(bio, "JPEG", quality=70); b_small = img_obj(bio.getvalue(), 300, 400, Name.DeviceRGB, flt=Name.DCTDecode)
    bio = io.BytesIO(); photo(2200, 2800).save(bio, "JPEG", quality=95); b_bigjpg = img_obj(bio.getvalue(), 2200, 2800, Name.DeviceRGB, flt=Name.DCTDecode)
    kinds = [("rgb flate", b_rgb), ("gray flate", b_gray), ("cmyk jpeg inverted", b_cmyk), ("indexed", b_idx), ("rgb with smask", b_smask),
             ("rgb with stencil mask", b_mask), ("rgb with colour-key mask", b_ckey), ("gray decode 1 0", b_dec), ("rgb 16 bit", b_16), ("small jpeg", b_small), ("big jpeg", b_bigjpg)]
    for label, im in kinds:
        content = b"q 0.9 0.2 0.2 rg 0 0 612 792 re f Q q 432 0 0 550 90 160 cm /Im Do Q BT /H 14 Tf 72 740 Td (" + label.encode() + b") Tj ET\n"
        new_page(pdf, content, Dictionary(Font=Dictionary(H=h), XObject=Dictionary(Im=im)))
    # a picture placed through a form
    fx = pdf.make_stream(b"q 432 0 0 550 0 0 cm /Im Do Q"); fx.Type = Name.XObject; fx.Subtype = Name.Form; fx.BBox = Array([0, 0, 432, 550]); fx.Resources = Dictionary(XObject=Dictionary(Im=b_rgb))
    new_page(pdf, b"q 1 0 0 1 90 160 cm /Fx Do Q BT /H 14 Tf 72 740 Td (rgb flate through a form) Tj ET\n", Dictionary(Font=Dictionary(H=h), XObject=Dictionary(Fx=fx)))
    pdf.save(os.path.join(outdir, "i_images.pdf"))
    # text-heavy with object streams and one modest picture: must not grow
    pdf2 = Pdf.new(); h2 = std_font(pdf2, "Helvetica")
    bio = zlib.compress(photo(420, 420).tobytes())
    im2 = pdf2.make_stream(bio); im2.Type = Name.XObject; im2.Subtype = Name.Image; im2.Width = 420; im2.Height = 420; im2.ColorSpace = Name.DeviceRGB; im2.BitsPerComponent = 8; im2.Filter = Name.FlateDecode
    for k in range(60):
        lines = b"".join(b"BT /H 9 Tf 72 %d Td (Line %d of page %d: words words words) Tj ET\n" % (760 - 12 * j, j, k) for j in range(55))
        extra = b"q 200 0 0 200 300 300 cm /Im Do Q\n" if k == 0 else b""
        res = Dictionary(Font=Dictionary(H=h2), XObject=Dictionary(Im=im2)) if k == 0 else Dictionary(Font=Dictionary(H=h2))
        a = [pdf2.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array([72, 700 - 12 * j, 200, 710 - 12 * j]), A=Dictionary(S=Name.URI, URI=String("https://example.org/%d/%d" % (k, j))))) for j in range(6)]
        new_page(pdf2, lines + extra, res, extra={"/Annots": Array(a)})
    pdf2.save(os.path.join(outdir, "i_objstm_text.pdf"), object_stream_mode=pikepdf.ObjectStreamMode.generate)

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    t_fonts(p("t_fonts.pdf"))
    t_fonts(p("t_fonts_rot90.pdf"), rotate=90)
    t_fonts(p("t_fonts_rot270.pdf"), rotate=270)
    t_fonts(p("t_fonts_crop.pdf"), crop=[50, 100, 560, 760])
    t_landscape(p("t_landscape.pdf"))
    t_offset_box(p("t_offset_box.pdf"))
    t_xobj(p("t_xobj.pdf"))
    t_type3(p("t_type3.pdf"))
    t_hidden(p("t_hidden.pdf"))
    t_actualtext(p("t_actualtext.pdf"))
    t_multistream(p("t_multistream.pdf"))
    t_inline(p("t_inline.pdf"))
    t_incremental(p("t_incremental.pdf"))
    t_dests(p("t_dests.pdf"))
    t_editmove(p("t_editmove.pdf"))
    t_scripts(p("t_scripts.pdf"))
    t_inherit(p("t_inherit.pdf"))
    t_many_objstm(p("t_many_objstm.pdf"))
    a_annots(p("a_annots.pdf"))
    f_form(p("f_form.pdf"))
    f_rot_form(p("f_rot_form.pdf"))
    tex(p("t_latex.pdf"), LATEX, "pdflatex")
    tex(p("t_xelatex.pdf"), XELATEX, "xelatex")
    chrome_pdf(p("t_chrome.pdf"))
    lo_pdf(p("t_lo.pdf"))
    ocr_pdf(p("t_ocr.pdf"))
    qpdf_variants()
    if "--big" in sys.argv: make_big(OUT)
    for f in sorted(os.listdir(OUT)):
        if f.endswith(".pdf"): print("%-28s %8d" % (f, os.path.getsize(p(f))))
