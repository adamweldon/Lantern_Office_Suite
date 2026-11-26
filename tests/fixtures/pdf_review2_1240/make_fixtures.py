# make_fixtures.py -- the PDFs of review 2 of 1.24.40's PDF tools, each made by a program that is not Lantern:
# reportlab (standard fonts with no /Widths, AcroForm radio groups and comb fields), pdflatex and xelatex, LibreOffice,
# Chromium's own print to PDF (Playwright), qpdf (linearized, object streams), tesseract (a scan with its words), and
# pdfw.py here for hand-written drawing programs and file structures (incremental updates, hybrid files, an unpacked
# PDF attached inside another). Usage: python3 make_fixtures.py [only-these-names...]
import os, sys, subprocess, shutil, tempfile, zlib, io
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pdfw import *
OUT = HERE
ONLY = set(sys.argv[1:])
def want(n): return not ONLY or n in ONLY
def P(n): return os.path.join(OUT, n)
def sh(*a, **k): return subprocess.run(list(a), capture_output=True, text=True, **k)

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, landscape, A4
from reportlab.lib import colors

# ---------------------------------------------------------------------------------------------------------------------
# 1. An invoice in the standard fonts (reportlab writes them with no /Widths): Helvetica, Helvetica-Bold, Times-Roman,
#    Times-Italic, Times-Bold, Courier; WinAnsi letters beyond ASCII; letter spacing (Tc), word spacing (Tw),
#    horizontal scaling (Tz), a raised "2" (Ts); a line where the secret sits beside short words ("it", "on", "is")
def invoice():
    c = canvas.Canvas(P("r_invoice.pdf"), pagesize=letter)
    c.setTitle("Invoice INV-2026-00417")
    c.setFont("Helvetica-Bold", 18); c.drawString(54, 730, "NORTHWIND FABRICATION LLC")
    c.setFont("Helvetica", 9); c.drawString(54, 716, "4100 Industrial Blvd., Tulsa, OK 74115  •  Tel. 918-555-0199")
    c.setFont("Helvetica-Bold", 14); c.drawRightString(558, 730, "INVOICE")
    c.setFont("Helvetica", 10)
    c.drawRightString(558, 714, "Invoice No. INV-2026-00417")
    c.drawRightString(558, 701, "Date: 25 Nov 2026")
    c.setFont("Helvetica-Bold", 10); c.drawString(54, 670, "Bill to:")
    c.setFont("Helvetica", 10)
    y = 656
    for l in ["Okonkwo-Bradshaw Holdings", "Attn: Mrs. Ýrr Þórsdóttir", "1420 Quarry Lane, Smithfield, OK 74070", "Phone: 918-555-0143", "Tax ID 73-1192845"]:
        c.drawString(54, y, l); y -= 13
    c.setFont("Helvetica-Bold", 10); c.drawString(330, 670, "Ship to:")
    c.setFont("Helvetica", 10)
    y = 656
    for l in ["Dock 7, Kingsbridge Yard", "Große Straße 12, 20095 Hamburg", "Account 4417-8820-1193-0056"]:
        c.drawString(330, y, l); y -= 13
    # the table
    c.setLineWidth(0.5); c.line(54, 580, 558, 580); c.line(54, 562, 558, 562)
    c.setFont("Helvetica-Bold", 9)
    for x, t in [(58, "Qty"), (90, "Description"), (400, "Unit price"), (490, "Amount")]: c.drawString(x, 568, t)
    rows = [("2", "Hydraulic seal kit — 40 mm bore, Viton®", "€ 48.50", "€ 97.00"),
            ("1", "Thermocouple, type K, 0…400 °C ±1.5 °C", "€ 31.20", "€ 31.20"),
            ("4", "Shim stock 0.05 mm × 150 mm, 25 µm tolerance", "€ 6.75", "€ 27.00"),
            ("3", "“Premium” cutting fluid, 5 l (‰ mix 50)", "€ 19.90", "€ 59.70")]
    c.setFont("Helvetica", 9); y = 548
    for r in rows:
        c.drawString(62, y, r[0]); c.drawString(90, y, r[1]); c.drawRightString(460, y, r[2]); c.drawRightString(552, y, r[3]); y -= 14
    c.line(54, y + 6, 558, y + 6)
    c.setFont("Helvetica-Bold", 10); c.drawString(400, y - 10, "Total"); c.drawRightString(552, y - 10, "€ 214.90")
    # Times paragraph: the secret beside short words
    c.setFont("Times-Roman", 11)
    c.drawString(54, 420, "Note: Smithfield said it is on time, and Smithfield is where it ships from.")
    c.setFont("Times-Italic", 11); c.drawString(54, 405, "Payment within 30 days to Waverley Savings, sort code 40-11-62.")
    c.setFont("Times-Bold", 11); c.drawString(54, 390, "Late fees: 1.5 % a month (§ 4 of our terms).")
    c.setFont("Times-BoldItalic", 11); c.drawString(54, 375, "Questions? Ask for Halversen in accounts.")
    c.setFont("Courier", 10); c.drawString(54, 355, "REF: WAVERLEY-7731  BATCH 00417/Q")
    # letter-spaced, word-spaced, scaled, raised
    t = c.beginText(54, 320); t.setFont("Helvetica-Bold", 12); t.setCharSpace(4); t.textOut("CONFIDENTIAL ZEPHYRINE"); c.drawText(t)
    t = c.beginText(54, 300); t.setFont("Helvetica", 11); t.setWordSpace(14); t.textOut("Wide words for Quillfeather here"); c.drawText(t)
    t = c.beginText(54, 280); t.setFont("Helvetica", 11); t.setHorizScale(150); t.textOut("Stretched Tremontane line"); c.drawText(t)
    t = c.beginText(54, 260); t.setFont("Times-Roman", 11); t.textOut("Floor area 25 m"); t.setRise(4); t.setFont("Times-Roman", 7); t.textOut("2"); t.setRise(0); t.setFont("Times-Roman", 11); t.textOut(" at Bellweather site"); c.drawText(t)
    t = c.beginText(54, 240); t.setFont("Helvetica", 11); t.setRise(9); t.textOut("Raised Harrowgate words"); c.drawText(t)
    c.setFont("Helvetica", 8); c.drawString(54, 60, "Northwind Fabrication LLC – registered in Oklahoma – thank you for your business.")
    c.showPage(); c.save()

# 2. A manual page in two columns, Times, justified (reportlab justifies with word spacing, Tw): the same words in both
#    columns on shared baselines; two pages
def manual():
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_JUSTIFY
    doc = BaseDocTemplate(P("r_manual2col.pdf"), pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
    W = (letter[0] - 108 - 18) / 2
    f1 = Frame(54, 54, W, letter[1] - 108, id="c1"); f2 = Frame(54 + W + 18, 54, W, letter[1] - 108, id="c2")
    doc.addPageTemplates([PageTemplate(id="two", frames=[f1, f2])])
    body = ParagraphStyle("b", fontName="Times-Roman", fontSize=10, leading=12.5, alignment=TA_JUSTIFY)
    head = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=12, leading=15, spaceBefore=6, spaceAfter=3)
    txt = ("Before servicing the pump skid, isolate the motor at the disconnect and lock it out. Bleed the accumulator "
           "until the gauge reads zero, then wait five minutes. Technician Marchetti must sign the permit before work "
           "begins. The relief valve is set at 210 bar; do not adjust it without the engineer's approval. ")
    story = []
    for k in range(1, 9):
        story.append(Paragraph("%d. Procedure for unit Kestrel-%d" % (k, k), head))
        story.append(Paragraph(txt * 2 + ("Call Marchetti at extension 4471 if the seal weeps. " if k % 2 else ""), body))
    doc.build(story)

# 3. A drawing sheet (11 x 17 landscape, no /Rotate) with a title block, labels turned 90 and 270, a dimension at 30
#    degrees, a note upside down, a label in a form XObject placed turned, and Symbol letters (Delta, Omega)
def titleblock():
    c = canvas.Canvas(P("r_titleblock.pdf"), pagesize=(1224, 792))
    c.setLineWidth(1.5); c.rect(20, 20, 1184, 752)
    c.setLineWidth(0.8); c.rect(824, 20, 380, 140)
    for y in (48, 76, 104, 132): c.line(824, y, 1204, y)
    c.line(1000, 20, 1000, 160)
    c.setFont("Helvetica", 7)
    for (x, y, lab) in [(828, 150, "TITLE"), (828, 122, "DRAWN"), (828, 94, "CHECKED"), (828, 66, "DWG NO."), (828, 38, "SCALE"), (1004, 150, "PROJECT"), (1004, 122, "DATE"), (1004, 94, "SHEET"), (1004, 66, "REV")]:
        c.drawString(x, y, lab)
    c.setFont("Helvetica-Bold", 11)
    for (x, y, t) in [(828, 136, "PUMP SKID P-101 GENERAL ARRANGEMENT"), (828, 108, "J. QUILLFEATHER"), (828, 80, "R. HALVERSEN"), (828, 52, "TX-4471-B"), (828, 24, "1:20"),
                      (1004, 136, "KINGSBRIDGE WATER"), (1004, 108, "2026-11-25"), (1004, 80, "3 OF 7"), (1004, 52, "C")]:
        c.drawString(x, y, t)
    # equipment outlines
    c.rect(200, 300, 400, 200); c.circle(400, 400, 60); c.rect(650, 330, 120, 140)
    c.setFont("Helvetica", 10); c.drawCentredString(400, 396, "MOTOR M-101"); c.drawCentredString(710, 396, "TANK T-7")
    # vertical labels
    c.saveState(); c.translate(160, 300); c.rotate(90); c.setFont("Helvetica-Bold", 12); c.drawString(0, 0, "ELEVATION A-A NIGHTJAR"); c.restoreState()
    c.saveState(); c.translate(640, 520); c.rotate(270); c.setFont("Helvetica", 10); c.drawString(0, 0, "SUCTION LINE PELLINORE 150NB"); c.restoreState()
    # a dimension at 30 degrees, an upside-down note
    c.saveState(); c.translate(250, 560); c.rotate(30); c.setFont("Helvetica", 10); c.drawString(0, 0, "R 450 TYP OBADIAH"); c.restoreState()
    c.saveState(); c.translate(600, 640); c.rotate(180); c.setFont("Helvetica", 10); c.drawString(0, 0, "VIEW FROM NORTH SIDE ROSKILDE"); c.restoreState()
    # a label in a form XObject, placed twice: level, and turned 90
    c.beginForm("lbl"); c.setFont("Helvetica-Bold", 9); c.drawString(0, 0, "VALVE V-12 CASSIOPEIA"); c.endForm()
    c.saveState(); c.translate(220, 250); c.doForm("lbl"); c.restoreState()
    c.saveState(); c.translate(120, 520); c.rotate(90); c.doForm("lbl"); c.restoreState()
    # Symbol letters: Delta p and Omega; Symbol is a standard font with its own encoding
    c.setFont("Symbol", 12); c.drawString(220, 220, "\u0394P = 2.5, R = 4.7 \u03a9")
    c.setFont("Helvetica", 9); c.drawString(220, 205, "Insulation test 500 V; see note LINDQVIST.")
    c.showPage(); c.save()

# 4. A form: text fields, a comb field (MaxLen 9), two radio groups, a check box, a choice -- reportlab's AcroForm
def form():
    c = canvas.Canvas(P("r_form.pdf"), pagesize=letter)
    f = c.acroForm
    c.setFont("Helvetica-Bold", 14); c.drawString(54, 740, "Contractor access request")
    c.setFont("Helvetica", 10)
    c.drawString(54, 700, "Full name:"); f.textfield(name="fullname", x=140, y=694, width=250, height=18, value="", borderWidth=1)
    c.drawString(54, 670, "SSN:"); f.textfield(name="ssn", x=140, y=664, width=180, height=20, maxlen=9, fieldFlags="comb", value="", borderWidth=1)
    c.drawString(54, 640, "Shift:")
    for k, v in enumerate(["Day", "Night", "Swing"]):
        f.radio(name="shift", value=v, selected=(v == "Day"), x=140 + 70 * k, y=636, size=12, buttonStyle="circle", borderWidth=1)
        c.drawString(156 + 70 * k, 638, v)
    c.drawString(54, 610, "Payment:")
    for k, v in enumerate(["Cash", "Card"]):
        f.radio(name="payment", value=v, selected=False, x=140 + 70 * k, y=606, size=12, buttonStyle="circle", borderWidth=1)
        c.drawString(156 + 70 * k, 608, v)
    c.drawString(54, 580, "Escort needed:"); f.checkbox(name="escort", x=140, y=576, size=12, checked=False, buttonStyle="check")
    c.drawString(54, 550, "Site:"); f.choice(name="site", value="Tulsa", options=["Tulsa", "Skiatook", "Owasso"], x=140, y=544, width=120, height=18)
    c.drawString(54, 520, "Notes:"); f.textfield(name="notes", x=140, y=480, width=300, height=50, value="", fieldFlags="multiline", borderWidth=1)
    c.showPage(); c.save()

# 4b. A radio group the way Acrobat writes one whose export values are not plain names: states /0 /1 /2 and /Opt
#     giving the values (one of them non-ASCII), and a group whose state names are UTF-8 in #xx form
def form_opt():
    objs = {}
    font = 10; objs[font] = {"Type": b"/Font", "Subtype": b"/Type1", "BaseFont": b"/Helvetica", "Encoding": b"/WinAnsiEncoding"}
    def dot(on):
        return Stream(("q 0 g 7 7 m 7 9.76 4.76 12 2 12 c 0 12 0 0 2 0 c 4.76 0 7 4.24 7 7 c f Q" if on else "") , {"BBox": [0, 0, 14, 14], "Subtype": b"/Form"}, compress=False)
    nxt = [20]
    def new(v): n = nxt[0]; nxt[0] += 1; objs[n] = v; return n
    annots = []
    # group "size" with /Opt
    kids = []
    grp = new({"FT": b"/Btn", "Ff": 49152, "T": lit("size"), "V": b"/0", "Opt": [lit("Klein"), lit("Mittel"), utf16("Größe")], "Kids": []})
    for k in range(3):
        on = new(dot(True)); off = new(dot(False))
        w = new({"Type": b"/Annot", "Subtype": b"/Widget", "Rect": [140 + 80 * k, 600, 154 + 80 * k, 614], "Parent": R(grp), "F": 4,
                 "AS": b"/0" if k == 0 else b"/Off", "MK": {"BC": [0], "CA": lit("l")}, "AP": {"N": ser({str(k): R(on), "Off": R(off)})}})
        kids.append(R(w)); annots.append(R(w))
    objs[grp]["Kids"] = kids
    # group "colour" whose states are UTF-8 names written with #xx
    kids2 = []
    names = ["Blau", "Gr#C3#BCn", "Wei#C3#9F"]
    grp2 = new({"FT": b"/Btn", "Ff": 49152, "T": lit("colour"), "V": b"/Blau", "Kids": []})
    for k, nm in enumerate(names):
        on = new(dot(True)); off = new(dot(False))
        w = new({"Type": b"/Annot", "Subtype": b"/Widget", "Rect": [140 + 80 * k, 560, 154 + 80 * k, 574], "Parent": R(grp2), "F": 4,
                 "AS": b"/Blau" if k == 0 else b"/Off", "MK": {"BC": [0]}, "AP": {"N": ("<</%s %s /Off %s>>" % (nm, R(on).decode(), R(off).decode())).encode()}})
        kids2.append(R(w)); annots.append(R(w))
    objs[grp2]["Kids"] = kids2
    cont = new(Stream("BT /F1 12 Tf 54 700 Td (Order form, Acrobat-style radio groups) Tj ET BT /F1 10 Tf 54 604 Td (Size:) Tj 100 0 Td (Klein) Tj 80 0 Td (Mittel) Tj 80 0 Td <47726Ff6df65> Tj ET BT /F1 10 Tf 54 564 Td (Colour:) Tj 100 0 Td (Blau) Tj 80 0 Td <4772fc6e> Tj 80 0 Td <576569df> Tj ET"))
    objs[3] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(font)}}, "Contents": R(cont), "Annots": annots}
    objs[2] = {"Type": b"/Pages", "Kids": [R(3)], "Count": 1}
    objs[1] = {"Type": b"/Catalog", "Pages": R(2), "AcroForm": {"Fields": [R(grp), R(grp2)], "DR": {"Font": {"Helv": R(font)}}, "DA": lit("/Helv 0 Tf 0 g")}}
    open(P("h_form_opt.pdf"), "wb").write(classic(objs, 1)[0])

# 4c. Check boxes and a radio group as Acrobat draws them: ZapfDingbats (not embedded) "4" (a tick) and "l" (a dot)
def form_zadb():
    objs = {1: None, 10: helv(), 11: {"Type": b"/Font", "Subtype": b"/Type1", "BaseFont": b"/ZapfDingbats"}}
    def ap(ch, on):
        return Stream(("0.75 g 0 0 14 14 re f 0 G 0.5 0.5 13 13 re S " + ("q BT /ZaDb 11 Tf 0 g 2.2 3 Td (%s) Tj ET Q" % ch if on else "")), {"Type": b"/XObject", "Subtype": b"/Form", "BBox": [0, 0, 14, 14], "Resources": {"Font": {"ZaDb": R(11)}}}, compress=False)
    objs[20] = ap("4", True); objs[21] = ap("4", False); objs[22] = ap("l", True); objs[23] = ap("l", False); objs[24] = ap("l", True); objs[25] = ap("l", False)
    objs[30] = {"Type": b"/Annot", "Subtype": b"/Widget", "FT": b"/Btn", "T": lit("agree"), "V": b"/Yes", "AS": b"/Yes", "Rect": [140, 600, 154, 614], "F": 4, "DA": lit("/ZaDb 0 Tf 0 g"), "MK": {"CA": lit("4")}, "AP": {"N": {"Yes": R(20), "Off": R(21)}}}
    objs[31] = {"FT": b"/Btn", "Ff": 49152, "T": lit("plan"), "V": b"/Gold", "Kids": [R(32), R(33)]}
    objs[32] = {"Type": b"/Annot", "Subtype": b"/Widget", "Parent": R(31), "AS": b"/Gold", "Rect": [140, 560, 154, 574], "F": 4, "MK": {"CA": lit("l")}, "AP": {"N": {"Gold": R(22), "Off": R(23)}}}
    objs[33] = {"Type": b"/Annot", "Subtype": b"/Widget", "Parent": R(31), "AS": b"/Off", "Rect": [220, 560, 234, 574], "F": 4, "MK": {"CA": lit("l")}, "AP": {"N": {"Silver": R(24), "Off": R(25)}}}
    objs[5] = Stream("BT /F1 12 Tf 54 700 Td (Membership form for Fenella Strathearn) Tj ET BT /F1 10 Tf 54 604 Td (I agree:) Tj ET BT /F1 10 Tf 54 564 Td (Plan:) Tj 106 0 Td (Gold) Tj 80 0 Td (Silver) Tj ET")
    objs[3] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(5), "Annots": [R(30), R(32), R(33)]}
    objs[2] = {"Type": b"/Pages", "Kids": [R(3)], "Count": 1}
    objs[1] = {"Type": b"/Catalog", "Pages": R(2), "AcroForm": {"Fields": [R(30), R(31)], "DR": {"Font": {"ZaDb": R(11), "Helv": R(10)}}, "DA": lit("/Helv 0 Tf 0 g")}}
    open(P("h_form_zadb.pdf"), "wb").write(classic(objs, 1)[0])

# 5. Symbol and ZapfDingbats (standard fonts with their own letters)
def symbol():
    c = canvas.Canvas(P("r_symbol.pdf"), pagesize=letter)
    c.setFont("Helvetica", 12); c.drawString(54, 720, "Electrical data sheet (Symbol font for Greek):")
    c.setFont("Symbol", 14); c.drawString(54, 690, "\u03a9 = 4.7 \u03ba, \u03b1 = 30\xb0, \u0394\u03a4 < 5 \u039a, \u03bc = 0.2")
    c.setFont("Helvetica", 12); c.drawString(54, 660, "Resistance above is in ohms; Galbraith checked it.")
    c.setFont("ZapfDingbats", 14); c.drawString(54, 630, "\u2714 \u2713 \u25a0")
    c.showPage(); c.save()

# ---------------------------------------------------------------------------------------------------------------------
# 6. xelatex: Greek, Cyrillic, symbols, final sigma, a Greek label turned 90 (DejaVu, Type 0 with ToUnicode)
XETEX = r"""\documentclass[11pt]{article}
\usepackage{fontspec}\setmainfont{DejaVu Serif}\setsansfont{DejaVu Sans}
\usepackage{graphicx}\usepackage[margin=2.5cm]{geometry}\pagestyle{empty}
\begin{document}
\section*{Τεχνικό δελτίο -- Техническая карта}
Ο τεχνικός Παπαδόπουλος έλεγξε την αντλία στην ΟΔΟΣ ΑΘΗΝΑΣ 42. Η πίεση ήταν 210 bar και η θερμοκρασία 65 °C.

Инженер Смирнов проверил насос на улице Ленина 17. Давление 210 бар, температура 65 °C.

Symbols: R = 4.7 kΩ, U ≤ 230 V, I ≥ 2 A, ±0.5 \%, 25 µm, √2, x → y, ∑ = 12.

Customer: Ζαχαρίας Κωνσταντίνου, phone 210-555-0187.

\vspace{1cm}\noindent\rotatebox{90}{\sffamily ΟΔΟΣ ΕΡΜΟΥ ΤΕΣΣΕΡΑ} \hspace{2cm} \rotatebox{90}{\sffamily Улица Пушкина}
\end{document}
"""
def xelatex():
    d = tempfile.mkdtemp()
    open(os.path.join(d, "x.tex"), "w").write(XETEX)
    r = sh("xelatex", "-interaction=nonstopmode", "x.tex", cwd=d)
    shutil.copy(os.path.join(d, "x.pdf"), P("x_nonlatin.pdf"))

# 7. pdflatex: a two-column manual page in Computer Modern (Type 1 fonts with flex hints), ligatures, a table
PDFTEX = r"""\documentclass[10pt,twocolumn]{article}
\usepackage[margin=2cm]{geometry}\pagestyle{empty}
\begin{document}
\section*{Hydraulic press maintenance}
\subsection*{Daily checks}
The official procedure, signed off by Marchetti, requires the efficient filling of the reservoir. Officers on the
first shift fill the fluid to the mark. Check the affinity of the seals; the fitting must not leak. Office staff
record the pressure (210 bar) in the log. Waverley oversees the effort.
\begin{enumerate}\item Isolate the pump. \item Bleed the accumulator. \item Inspect the filter.\end{enumerate}
\subsection*{Weekly checks}
Lubricate the slides. The difficult offset fittings near Waverley's bench are checked by Quince. Fifty fluffy filters
were fitted in the office. Fit the ﬁnal flange with five bolts.
\newpage
\section*{Torque table}
\begin{tabular}{lrr}Bolt & Nm & ft-lb\\\hline M12 & 85 & 63\\ M16 & 210 & 155\\ M20 & 410 & 302\end{tabular}

Quince approved the table on Friday.
\end{document}
"""
def pdflatex():
    d = tempfile.mkdtemp()
    open(os.path.join(d, "l.tex"), "w").write(PDFTEX.replace("ﬁnal", "final"))
    sh("pdflatex", "-interaction=nonstopmode", "l.tex", cwd=d)
    shutil.copy(os.path.join(d, "l.pdf"), P("l_twocol.pdf"))

# 8. LibreOffice: a document with Greek, Cyrillic, a table, from HTML; and a long one (40 pages) for timing
LO_HTML = """<html><head><meta charset="utf-8"><style>body{font-family:'Liberation Serif';font-size:11pt} td,th{border:1px solid #000;padding:3px}</style></head><body>
<h2>Service report 2026-11-25</h2>
<p>Customer: Δημήτρης Παπανικολάου, Αθήνα. Contact: Сергей Иванов, Москва.</p>
<p>Measured: R = 4,7 kΩ; U ≤ 230 V; t = 65 °C ± 2 °C; 25 µm.</p>
<table><tr><th>Item</th><th>Код</th><th>Τιμή</th></tr><tr><td>Seal kit</td><td>УП-1290</td><td>48,50 €</td></tr><tr><td>Sensor</td><td>ДТ-40</td><td>31,20 €</td></tr></table>
<p>Technician Blackwood-Ince signed the report; reference 1290-KX.</p>
</body></html>"""
def libreoffice():
    d = tempfile.mkdtemp()
    open(os.path.join(d, "lo.html"), "w").write(LO_HTML)
    sh("soffice", "--headless", "--convert-to", "pdf:writer_pdf_Export", "--outdir", d, os.path.join(d, "lo.html"), timeout=180)
    if os.path.exists(os.path.join(d, "lo.pdf")): shutil.copy(os.path.join(d, "lo.pdf"), P("lo_nonlatin.pdf"))
    long = "<html><head><meta charset='utf-8'></head><body style=\"font-family:'Liberation Sans'\">" + "".join(
        "<h2>Section %d</h2>" % k + "<p>" + ("Inspection of line %d found the flange gasket worn; replace at next stop. " % k) * 30 + "</p>" for k in range(1, 61)) + "</body></html>"
    open(os.path.join(d, "long.html"), "w").write(long)
    sh("soffice", "--headless", "--convert-to", "pdf:writer_pdf_Export", "--outdir", d, os.path.join(d, "long.html"), timeout=240)
    if os.path.exists(os.path.join(d, "long.pdf")): shutil.copy(os.path.join(d, "long.pdf"), P("lo_long.pdf"))

# 9. Chromium's print to PDF: an invoice with letter-spacing, word-spacing, a label turned with CSS, a vertical
#    (writing-mode) label, a synthetic italic (a font with no italic face), Greek and Cyrillic; and a landscape table
CH_INV = """<html><head><meta charset="utf-8"><style>
body{font-family:'Liberation Sans',sans-serif;font-size:12px;margin:40px}
.ls{letter-spacing:4px;font-weight:bold} .ws{word-spacing:12px}
.rot{position:absolute;left:10px;top:400px;transform:rotate(-90deg);transform-origin:left top;font-size:14px}
.vert{position:absolute;right:30px;top:200px;writing-mode:vertical-rl;font-size:14px}
.syn{font-family:'Noto Sans CJK SC';font-style:italic}
</style></head><body>
<h1>Work order WO-88123</h1>
<p class="ls">CONFIDENTIAL MERIWEATHER</p>
<p class="ws">Assigned to Ashdown-Pryce for the night shift.</p>
<p>Pump runs <span class="syn">really</span> fast after Corrigan fitted the seal.</p>
<p>Πελάτης: Ευάγγελος Σταματόπουλος — Клиент: Наталья Кузнецова</p>
<p>Card on file 7730-1142-5561-0098, expiry 09/29.</p>
<div class="rot">ROTATED MARGINALIA TEXT</div>
<div class="vert">VERTICAL LANTHORNE</div>
</body></html>"""
CH_TAB = """<html><head><meta charset="utf-8"><style>body{font-family:'Liberation Sans';font-size:11px} td,th{border:1px solid #444;padding:2px 6px}</style></head><body>
<h2>Pressure readings, week 47 (station ALDERGROVE)</h2><table><tr><th>Day</th>""" + "".join("<th>Gauge %d</th>" % k for k in range(1, 13)) + "</tr>" + "".join(
    "<tr><td>%s</td>" % d + "".join("<td>%d.%d bar</td>" % (200 + k + i, (k * 7 + i) % 10) for k in range(12)) + "</tr>" for i, d in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri"])) + """</table>
<p>Read by Vasquez; checked by Okafor.</p></body></html>"""
def chromium():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page()
        pg.set_content(CH_INV); pg.wait_for_timeout(300); pg.pdf(path=P("c_workorder.pdf"), format="Letter", print_background=True)
        pg.set_content(CH_TAB); pg.wait_for_timeout(300); pg.pdf(path=P("c_table_landscape.pdf"), format="Letter", landscape=True)
        b.close()

# ---------------------------------------------------------------------------------------------------------------------
# 10. Hand-written drawing programs: every text operator that moves letters, in Helvetica WITH /Widths (so the places
#     are certain), turned and slanted runs, TJ letter by letter, forms nested 1 to 5 deep, invisible (3) and clip (7)
HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584]
def helv(): return {"Type": b"/Font", "Subtype": b"/Type1", "BaseFont": b"/Helvetica", "Encoding": b"/WinAnsiEncoding", "FirstChar": 32, "LastChar": 126, "Widths": HW}
def textops():
    objs = {}; objs[10] = helv()
    # nested forms: form k draws its word and then form k+1
    words = ["DEPTHONE", "DEPTHTWO", "DEPTHTHREE", "DEPTHFOUR", "DEPTHFIVE"]
    for k in range(5, 0, -1):
        n = 20 + k
        prog = "BT /F1 10 Tf 0 0 Td (%s) Tj ET" % words[k - 1]
        res = {"Font": {"F1": R(10)}}
        if k < 5: prog += " q 1 0 0 1 0 -14 cm /Fx Do Q"; res["XObject"] = {"Fx": R(n + 1)}
        objs[n] = Stream(prog, {"Type": b"/XObject", "Subtype": b"/Form", "BBox": [0, -200, 300, 20], "Resources": res})
    tj = " ".join("(%s) %d" % (ch, -20) for ch in "KERNEDWORD")
    prog = "\n".join([
        "BT /F1 12 Tf 54 740 Td (Plain line with Fairweather in it.) Tj ET",
        "BT /F1 12 Tf 3 Tc 54 720 Td (Spaced Galloway letters) Tj ET",
        "BT /F1 12 Tf 0 Tc 15 Tw 54 700 Td (Word spaced Ingleby words) Tj ET",
        "BT /F1 12 Tf 0 Tw 200 Tz 54 680 Td (Wide Jessamine) Tj 100 Tz ET",
        "BT /F1 12 Tf 54 660 Td (Below ) Tj 6 Ts (Raised Lockridge) Tj 0 Ts ( after) Tj ET",
        "BT /F1 12 Tf 54 640 Td [%s] TJ ET" % tj,
        "BT /F1 12 Tf 0.866 0.5 -0.5 0.866 300 560 Tm (Thirty degree Montague line) Tj ET",
        "BT /F1 12 Tf 1 0 0.3 1 54 600 Tm (Slanted Northcote words) Tj ET",
        "BT /F1 12 Tf 54 580 Td (Level then ) Tj 1 0 0.25 1 120 580 Tm (Oblique) Tj 1 0 0 1 170 580 Tm ( Penhaligon end) Tj ET",
        "BT /F1 12 Tf -1 0 0 1 300 540 Tm (Mirrored Quenby) Tj ET",
        "BT /F1 12 Tf 0 -1 1 0 520 700 Tm (Downward Rutherford label) Tj ET",
        "BT 3 Tr /F1 12 Tf 54 520 Td (Invisible Sallowmere words) Tj 0 Tr ET",
        "q BT 7 Tr /F1 30 Tf 54 470 Td (CLIPTEXT) Tj ET 0.8 g 40 460 300 40 re f Q",
        "q 1 0 0 1 54 400 cm /Fx Do Q",
        "BT /F1 12 Tf 2 0 0 2 54 300 Tm (Double Thistlewood) Tj ET",
        "q 0.5 0 0 0.5 54 250 cm BT /F1 24 Tf 0 0 Td (Half scale Umberleigh) Tj ET Q",
    ])
    objs[5] = Stream(prog)
    objs[3] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}, "XObject": {"Fx": R(21)}}, "Contents": R(5)}
    objs[2] = {"Type": b"/Pages", "Kids": [R(3)], "Count": 1}
    objs[1] = {"Type": b"/Catalog", "Pages": R(2)}
    open(P("h_textops.pdf"), "wb").write(classic(objs, 1)[0])

# 11. Seen boxes and turns: a CropBox offset with a word across its edge and one outside it; pages turned 90, 180, 270
#     with a crop; a MediaBox not at 0 0
def croprot():
    objs = {1: {"Type": b"/Catalog", "Pages": R(2)}, 10: helv()}
    kids = []
    spec = [(0, [0, 0, 612, 792], [72, 72, 540, 720]), (90, [0, 0, 612, 792], [36, 36, 576, 756]), (180, [0, 0, 612, 792], [50, 60, 560, 740]),
            (270, [0, 0, 612, 792], [20, 30, 600, 780]), (0, [100, 200, 712, 992], [100, 200, 712, 992])]
    for k, (rot, mb, cb) in enumerate(spec):
        x0, y0 = mb[0], mb[1]
        prog = "\n".join([
            "BT /F1 12 Tf %d %d Td (Page %d turned %d: Fenwick wrote this line.) Tj ET" % (cb[0] + 20, cb[3] - 40, k + 1, rot),
            "BT /F1 12 Tf %d %d Td (Second line names Gorringe and Ellery.) Tj ET" % (cb[0] + 20, cb[3] - 60),
            "BT /F1 12 Tf %d %d Td (EDGEWORDACROSS the crop) Tj ET" % (cb[0] - 40, cb[3] - 90),
            "BT /F1 12 Tf %d %d Td (OUTSIDERWORD hidden) Tj ET" % (cb[0] + 20, cb[1] - 30),
            "BT /F1 12 Tf %d %d Td (Last seen line: Hollingsworth 77.) Tj ET" % (cb[0] + 20, cb[1] + 20),
        ])
        cn = 30 + 2 * k; pn = 31 + 2 * k
        objs[cn] = Stream(prog)
        pd = {"Type": b"/Page", "Parent": R(2), "MediaBox": mb, "CropBox": cb, "Resources": {"Font": {"F1": R(10)}}, "Contents": R(cn)}
        if rot: pd["Rotate"] = rot
        objs[pn] = pd; kids.append(R(pn))
    objs[2] = {"Type": b"/Pages", "Kids": kids, "Count": len(kids)}
    open(P("h_croprot.pdf"), "wb").write(classic(objs, 1)[0])

# 12. A q left open (with a clip and a cm) at the end of the page's program, then a second content stream and a typed
#     comment drawn by its appearance; a form XObject that leaves a cm in force; more Q than q
def qopen():
    objs = {1: {"Type": b"/Catalog", "Pages": R(2)}, 10: helv()}
    objs[20] = Stream("q 2 0 0 2 0 0 cm BT /F1 10 Tf 0 0 Td (Inside form) Tj ET", {"Type": b"/XObject", "Subtype": b"/Form", "BBox": [0, 0, 200, 40], "Resources": {"Font": {"F1": R(10)}}})
    objs[5] = Stream("BT /F1 14 Tf 54 740 Td (First stream: words before the open q) Tj ET\nq 54 600 100 40 re W n 0.5 0 0 0.5 0 0 cm 1 0 0 rg 0 0 1224 1584 re f")
    objs[6] = Stream("BT /F1 14 Tf 54 500 Td (Second stream: Wetherby words) Tj ET\nq 1 0 0 1 54 400 cm /Fx Do Q\nBT /F1 14 Tf 54 360 Td (After the form: Yarborough) Tj ET Q Q Q\nBT /F1 14 Tf 54 320 Td (After extra Q: Zetland) Tj ET")
    objs[7] = Stream("BT /F1 12 Tf 2 4 Td (Typed comment Ottoline) Tj ET", {"Type": b"/XObject", "Subtype": b"/Form", "BBox": [0, 0, 220, 20], "Resources": {"Font": {"F1": R(10)}}})
    objs[8] = {"Type": b"/Annot", "Subtype": b"/FreeText", "Rect": [300, 200, 520, 220], "Contents": lit("Typed comment Ottoline"), "DA": lit("/Helv 12 Tf 0 g"), "AP": {"N": R(7)}, "F": 4}
    objs[3] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}, "XObject": {"Fx": R(20)}}, "Contents": [R(5), R(6)], "Annots": [R(8)]}
    objs[2] = {"Type": b"/Pages", "Kids": [R(3)], "Count": 1}
    open(P("h_qopen.pdf"), "wb").write(classic(objs, 1)[0])

# 13. A filled field with no /AcroForm (its page split from a form by a tool that left the form behind): an auto-size
#     (0 Tf) right-aligned value drawn by its own appearance; and links, one of whose web address holds a secret word
def orphan_and_links():
    objs = {1: {"Type": b"/Catalog", "Pages": R(2)}, 10: helv()}
    ap = Stream("/Tx BMC q BT /F1 22 Tf 1 0 0 1 152 8 Tm (123-45-6789) Tj ET Q EMC", {"Type": b"/XObject", "Subtype": b"/Form", "BBox": [0, 0, 300, 34], "Resources": {"Font": {"F1": R(10)}}})
    objs[11] = ap
    objs[12] = {"Type": b"/Annot", "Subtype": b"/Widget", "FT": b"/Tx", "T": lit("ssn"), "V": lit("123-45-6789"), "DA": lit("/Helv 0 Tf 0 g"), "Q": 2,
                "Rect": [150, 600, 450, 634], "F": 4, "AP": {"N": R(11)}}
    objs[13] = {"Type": b"/Annot", "Subtype": b"/Link", "Rect": [54, 500, 160, 514], "Border": [0, 0, 0], "A": {"S": b"/URI", "URI": lit("https://records.example.org/patient/WINTERBOURNE/chart")}}
    objs[14] = {"Type": b"/Annot", "Subtype": b"/Link", "Rect": [54, 470, 200, 484], "Border": [0, 0, 0], "A": {"S": b"/URI", "URI": lit("mailto:a.winterbourne@example.org")}}
    objs[5] = Stream("\n".join([
        "BT /F1 12 Tf 54 700 Td (Patient record, page split from the intake form) Tj ET",
        "BT /F1 12 Tf 54 612 Td (SSN:) Tj ET 0 G 150 600 300 34 re S",
        "BT /F1 12 Tf 54 560 Td (Patient: Winterbourne, Alder) Tj ET",
        "BT 0 0 1 rg /F1 12 Tf 54 503 Td (Open the chart) Tj ET",
        "BT 0 0 1 rg /F1 12 Tf 54 473 Td (a.winterbourne@example.org) Tj ET"]))
    objs[3] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(5), "Annots": [R(12), R(13), R(14)]}
    objs[2] = {"Type": b"/Pages", "Kids": [R(3)], "Count": 1}
    open(P("h_orphan_links.pdf"), "wb").write(classic(objs, 1)[0])


# 13b. A typed comment (FreeText, drawn by its appearance) on a page with a footer at the bottom: where "Mark them all"
#      put its marks before the comment was made part of the page
def freetext_footer():
    objs = {1: {"Type": b"/Catalog", "Pages": R(2)}, 10: helv()}
    objs[7] = Stream("BT /F1 12 Tf 2 4 Td (Typed note Ottoline) Tj ET", {"Type": b"/XObject", "Subtype": b"/Form", "BBox": [0, 0, 220, 20], "Resources": {"Font": {"F1": R(10)}}})
    objs[8] = {"Type": b"/Annot", "Subtype": b"/FreeText", "Rect": [300, 400, 520, 420], "Contents": lit("Typed note Ottoline"), "DA": lit("/Helv 12 Tf 0 g"), "AP": {"N": R(7)}, "F": 4}
    objs[5] = Stream("BT /F1 12 Tf 54 700 Td (Site diary, 25 November) Tj ET BT /F1 9 Tf 300 6 Td (Ashcombe Surveying Ltd page 1 of 1) Tj ET")
    objs[3] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(5), "Annots": [R(8)]}
    objs[2] = {"Type": b"/Pages", "Kids": [R(3)], "Count": 1}
    open(P("h_freetext_footer.pdf"), "wb").write(classic(objs, 1)[0])

# ---------------------------------------------------------------------------------------------------------------------
# 14. File structures. A small two-page document written by hand, so the object numbers are known
def two_pages(words=("Alpha page ORIGINALWORD", "Beta page words"), extra=None):
    objs = {1: {"Type": b"/Catalog", "Pages": R(2)}, 10: helv()}
    objs[5] = Stream("BT /F1 14 Tf 54 700 Td (%s) Tj ET" % words[0]); objs[6] = Stream("BT /F1 14 Tf 54 700 Td (%s) Tj ET" % words[1])
    objs[3] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(5)}
    objs[4] = {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(6)}
    objs[2] = {"Type": b"/Pages", "Kids": [R(3), R(4)], "Count": 2}
    objs[7] = {"Producer": lit("pdfw")}
    if extra: objs.update(extra)
    return objs

def structures():
    # a. classic file, then an update (classic) that changes page 1's words and deletes nothing
    base = classic(two_pages(), 1, 7)[0]
    upd = update_classic(base, {5: Stream("BT /F1 14 Tf 54 700 Td (Alpha page UPDATEDWORD) Tj ET")}, 1, 11, info=7)
    open(P("s_incr_classic.pdf"), "wb").write(upd)
    # b. object streams in the base (the page dictionaries packed), then an update whose new page 1 dictionary stands on
    #    its own (classic table update over an xref-stream file) -- the newer plain copy must win
    objs = two_pages()
    plain = {k: v for k, v in objs.items() if isinstance(v, Stream) or k == 10}
    packed = {k: v for k, v in objs.items() if k not in plain}
    base2 = with_objstm(plain, packed, 1, info=7)
    open(P("s_objstm_base.pdf"), "wb").write(base2)
    newc = Stream("BT /F1 14 Tf 54 700 Td (Alpha page NEWPLAINWORD) Tj ET")
    upd2 = update_xrefstm(base2, {20: newc, 3: {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(20)}}, 1, 21, info=7)
    open(P("s_objstm_then_plain.pdf"), "wb").write(upd2)
    # c. plain base, update that puts the new page 1 dictionary inside an object stream (xref stream update)
    newc2 = Stream("BT /F1 14 Tf 54 700 Td (Alpha page PACKEDNEWWORD) Tj ET")
    upd3 = update_xrefstm(base, {20: newc2}, 1, 21, packed={3: {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(20)}}, info=7)
    open(P("s_plain_then_objstm.pdf"), "wb").write(upd3)
    # d. a hybrid file (as Word writes them): a classic table for the plain objects, where the packed ones are marked
    #    free, and /XRefStm naming an xref stream that says where the packed ones are
    objs = two_pages(("Hybrid page HYBRIDWORD", "Hybrid second page"))
    plain = {k: v for k, v in objs.items() if isinstance(v, Stream) or k in (1, 7, 10)}
    packed = {k: v for k, v in objs.items() if k not in plain}
    out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n"); offs = {}
    for n in sorted(plain): offs[n] = len(out); out += body(n, plain[n])
    sn = 30; offs[sn] = len(out); out += body(sn, objstm(sorted(packed.items())))
    ent = {}
    for k, n in enumerate(sorted(packed)): ent[n] = (2, sn, k)
    xs = 31; xso = len(out); ent[xs] = (1, xso, 0)
    out += xref_stream_bytes(ent, 32, 1, num=xs, info=7)
    x = len(out)
    out += b"xref\n0 1\n0000000000 65535 f \n"   # (the packed objects are not in the table: as Word writes it)
    for n in sorted(offs): out += b"%d 1\n%010d 00000 n \n" % (n, offs[n])
    out += b"trailer\n" + ser({"Size": 32, "Root": R(1), "Info": R(7), "XRefStm": xso}) + b"\nstartxref\n%d\n%%%%EOF\n" % x
    open(P("s_hybrid.pdf"), "wb").write(bytes(out))
    # e. an unpacked PDF attached inside another (its objects carry the same numbers and come later in the file)
    inner = classic(two_pages(("EMBEDDEDDOC inner page one", "EMBEDDEDDOC inner page two")), 1, 7)[0]
    o = two_pages(("Outer page OUTERWORD", "Outer second page"))
    o[40] = Stream(inner, {"Type": b"/EmbeddedFile", "Subtype": b"/application#2Fpdf"}, compress=False)
    o[41] = {"Type": b"/Filespec", "F": lit("inner.pdf"), "UF": lit("inner.pdf"), "EF": {"F": R(40)}}
    o[1] = {"Type": b"/Catalog", "Pages": R(2), "Names": {"EmbeddedFiles": {"Names": [lit("inner.pdf"), R(41)]}}}
    outer = classic(o, 1, 7)[0]
    open(P("s_attached_unpacked.pdf"), "wb").write(outer)
    # e2. the same with the outer document's dictionaries in an object stream
    plain = {k: v for k, v in o.items() if isinstance(v, Stream) or k == 10}
    packed = {k: v for k, v in o.items() if k not in plain}
    open(P("s_attached_unpacked_objstm.pdf"), "wb").write(with_objstm(plain, packed, 1, info=7))
    # f. 150 bytes of junk before %PDF (a mail header): every offset is off by 150
    open(P("s_junk_prefix.pdf"), "wb").write(b"X-Mailer: scan2mail 1.3\r\nContent-Type: application/pdf\r\n" + b"=" * 92 + b"\r\n" + base)
    # g. offsets all 2 bytes off (a file whose line endings were changed after it was written)
    b0, offs0, x0 = classic(two_pages(("Shifted page SHIFTWORD", "Shifted second")), 1, 7)
    txt = b0.decode("latin-1")
    import re as _re
    head, tail = txt[:x0], txt[x0:]
    tail = _re.sub(r"(\d{10}) 00000 n", lambda m: "%010d 00000 n" % (int(m.group(1)) + 2), tail)
    open(P("s_offsets_off.pdf"), "wb").write((head + tail).encode("latin-1"))
    # h. a classic table whose subsection wrongly starts at 1 (a known writer bug), entries shifted by one object
    tail2 = txt[x0:].replace("xref\n0 ", "xref\n1 ", 1)
    open(P("s_xref_from1.pdf"), "wb").write((head + tail2).encode("latin-1"))
    # i. an update that frees an object and reuses its number with generation 1 for a new page content
    base3 = classic(two_pages(("Reuse page REUSEOLD", "Reuse second")), 1, 7)[0]
    prev = last_startxref(base3); outb = bytearray(base3)
    o5 = len(outb); outb += body(5, Stream("BT /F1 14 Tf 54 700 Td (Reuse page REUSENEW) Tj ET"), gen=1)
    x = len(outb)
    outb += b"xref\n0 1\n0000000000 65535 f \n5 1\n%010d 00001 n \n" % o5
    outb += b"trailer\n" + ser({"Size": 11, "Root": R(1), "Prev": prev, "Info": R(7)}) + b"\nstartxref\n%d\n%%%%EOF\n" % x
    # page 1 must now say 5 1 R: rewrite page 3 in the same update
    o3 = len(outb); outb += body(3, {"Type": b"/Page", "Parent": R(2), "MediaBox": [0, 0, 612, 792], "Resources": {"Font": {"F1": R(10)}}, "Contents": R(5, 1)})
    x2 = len(outb)
    outb += b"xref\n0 1\n0000000000 65535 f \n3 1\n%010d 00000 n \n" % o3
    outb += b"trailer\n" + ser({"Size": 11, "Root": R(1), "Prev": x, "Info": R(7)}) + b"\nstartxref\n%d\n%%%%EOF\n" % x2
    open(P("s_gen_reuse.pdf"), "wb").write(bytes(outb))

def qpdf_variants():
    # linearized copies (Fast Web View) and a copy with every object it can packed, 100 to a stream
    for src, dst in [("r_invoice.pdf", "q_invoice_lin.pdf"), ("r_manual2col.pdf", "q_manual_lin.pdf"), ("r_form.pdf", "q_form_lin_objstm.pdf")]:
        if os.path.exists(P(src)):
            extra = ["--object-streams=generate"] if "objstm" in dst else []
            sh("qpdf", "--linearize", *extra, P(src), P(dst))
    if os.path.exists(P("lo_long.pdf")):
        sh("qpdf", "--object-streams=generate", P("lo_long.pdf"), P("q_lo_long_objstm.pdf"))

# 15. A scan with its words (tesseract's own PDF): a picture of the invoice at 150 dpi, read by tesseract
def scan():
    if not os.path.exists(P("r_invoice.pdf")): return
    d = tempfile.mkdtemp()
    sh("pdftoppm", "-r", "150", "-f", "1", "-l", "1", "-png", "-singlefile", P("r_invoice.pdf"), os.path.join(d, "inv"))
    sh("tesseract", os.path.join(d, "inv.png"), os.path.join(d, "inv"), "pdf")
    if os.path.exists(os.path.join(d, "inv.pdf")): shutil.copy(os.path.join(d, "inv.pdf"), P("t_scan_invoice.pdf"))

STEPS = [("invoice", invoice), ("manual", manual), ("titleblock", titleblock), ("form", form), ("form_opt", form_opt), ("form_zadb", form_zadb), ("symbol", symbol),
         ("xelatex", xelatex), ("pdflatex", pdflatex), ("libreoffice", libreoffice), ("chromium", chromium), ("textops", textops),
         ("croprot", croprot), ("qopen", qopen), ("orphan", orphan_and_links), ("freetext", freetext_footer), ("structures", structures), ("qpdf", qpdf_variants), ("scan", scan)]
if __name__ == "__main__":
    for n, f in STEPS:
        if want(n):
            try: f(); print("made", n)
            except Exception as e: print("FAILED", n, repr(e))
