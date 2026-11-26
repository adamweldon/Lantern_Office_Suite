# make_fixtures.py -- review 3 of 1.24.40's PDF tools: every PDF this review reads, made by programs that are not Lantern.
#   python3 make_fixtures.py [name ...]     (all when none given; each writes <name>.pdf here)
# reportlab (standard fonts with no /Widths, Symbol and ZapfDingbats with no /Encoding, bullets as code 127), pikepdf
# (hand-written drawing programs and Acrobat-style forms), pdflatex / xelatex (two- and three-column manuals, Greek,
# Cyrillic, Turkish), LibreOffice (a letter with a header and footer, soft hyphens), Chromium's print to PDF (CSS
# letter-spacing, small-caps, a made-up italic, sup/sub, tight tables, a page header and footer), qpdf (pages wrapped in
# forms ten deep by --underlay, as stamping tools do; linearized and object-stream copies), tesseract (a scan with its words).
import os, sys, subprocess, shutil, tempfile, io
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pikepdf
from pikepdf import Name, Dictionary, Array, Stream, String
from pdfhand import *
WORK = os.path.join("/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad", "r3work")
os.makedirs(WORK, exist_ok=True)
WANT = set(sys.argv[1:])
def want(n): return not WANT or n in WANT
def out(n): return os.path.join(HERE, n + ".pdf")
def sh(*a, **k): return subprocess.run(list(a), capture_output=True, text=True, **k)

# =====================================================================================================================
# e_textops: PDF_TEXT's new rules, one line each (page 1), turned runs and nested forms (page 2)
# =====================================================================================================================
def e_textops():
    pdf = pikepdf.new()
    F1 = std_font(pdf, "Helvetica"); F2 = std_font(pdf, "Times-Roman"); FB = std_font(pdf, "Helvetica-Bold")
    FS = std_font(pdf, "Symbol", enc=None); FZ = std_font(pdf, "ZapfDingbats", enc=None)
    # glyph names past U+FFFF, uniXXXX, plain names -- no ToUnicode, so the names are what is read
    FG = std_font(pdf, "Helvetica", enc="/WinAnsiEncoding", diffs=[65, Name("/u1F600"), Name("/uni20AC"), Name("/u2126"), Name("/Omega"), Name("/uni00E9"), Name("/u1F4A1")])
    # a ToUnicode with a decomposed accent (e + U+0301) and with ligature code points (U+FB01, U+FB03)
    FD = std_font(pdf, "Helvetica", tounicode=cmap([(c, chr(c)) for c in range(32, 127)] + [(0xE9, "é"), (0xF1, "ñ"), (0x01, "ﬁ"), (0x02, "ﬃ")]),
                  diffs=[1, Name("/fi"), Name("/ffi")])
    res = Dictionary(Font=Dictionary(F1=F1, F2=F2, FB=FB, FS=FS, FZ=FZ, FG=FG, FD=FD))
    c = []
    y = 740
    def line(s): c.append(s)
    line("BT /FB 14 Tf 72 760 Td (Field notes: text operators) Tj ET")
    # 1. a skewed (oblique) run mid-line: same baseline
    line("BT /F1 11 Tf 72 %d Td (Level start) Tj ET" % y)
    line("BT /F1 11 Tf 1 0 0.25 1 %.2f %d Tm (Penhaligon) Tj ET" % (72 + w("Level start ", "Helvetica", 11), y))
    line("BT /F1 11 Tf %.2f %d Td (ends here.) Tj ET" % (72 + w("Level start Penhaligon ", "Helvetica", 11), y)); y -= 18
    # 2. a strong slant (0.5) and a negative one
    line("BT /F1 11 Tf 72 %d Td (Strong slant) Tj ET" % y)
    line("BT /F1 11 Tf 1 0 0.5 1 %.2f %d Tm (Trevelyan) Tj ET" % (72 + w("Strong slant ", "Helvetica", 11), y))
    line("BT /F1 11 Tf 1 0 -0.3 1 %.2f %d Tm (backslant) Tj ET" % (72 + w("Strong slant Trevelyan ", "Helvetica", 11), y))
    line("BT /F1 11 Tf %.2f %d Td (done.) Tj ET" % (72 + w("Strong slant Trevelyan backslant ", "Helvetica", 11), y)); y -= 18
    # 3. a raised word (Ts 6 at 12 pt) and a lowered one (Ts -3)
    line("BT /F1 12 Tf 72 %d Td (Below ) Tj 6 Ts (Lockridge) Tj 0 Ts ( after, ) Tj -3 Ts (Hollinshead) Tj 0 Ts ( last.) Tj ET" % y); y -= 20
    # 4. letters drawn one at a time (Chromium's letter-spacing): 0.12, 0.25, 0.45, 0.65, 0.85 em
    for ls, word in [(0.12, "CONFIDENTIAL MEMO"), (0.25, "PRIVATE FILE WOLSTENHOLME"), (0.45, "INTERNAL ONLY"), (0.65, "SECRET HARGREAVES"), (0.85, "WIDE SPACED")]:
        s, _ = spaced(72, y, word, 10, ls); line(s); y -= 16
    # 5. single letters and digits in narrow table cells (a connector's pins, a keypad row): each a cell of its own
    line("BT /F1 9 Tf 72 %d Td (Pins:) Tj ET" % y)
    for k, ch in enumerate("ABCDEFGHJK"):
        line("BT /F1 9 Tf %.2f %d Td (%s) Tj ET" % (110 + k * 9.5, y, ch))
    y -= 14
    line("BT /F1 9 Tf 72 %d Td (Keys:) Tj ET" % y)
    for k, ch in enumerate("1234567890"):
        line("BT /F1 9 Tf %.2f %d Td (%s) Tj ET" % (110 + k * 9.0, y, ch))
    y -= 14
    # 6. WinAnsi's spare codes (127 129 141 143 144 157) between words: read and measured as bullets
    line("BT /F1 10 Tf 72 %d Td %s Tj ET" % (y, lit("Tulsa \x7f Tel \x81 918 \x8d 555 \x8f 0199 \x90 x \x9d end")))
    line("BT /F1 10 Tf 400 %d Td (Ashgrove) Tj ET" % y); y -= 16
    # 7. glyph names: u1F600 (past U+FFFF), uni20AC, u2126, Omega, uni00E9, u1F4A1
    line("BT /FG 10 Tf 72 %d Td (Glyphs: ) Tj (ABCDEF) Tj ( done) Tj ET" % y); y -= 16
    # 8. Symbol and ZapfDingbats named with no encoding: units on an engineering note, ticks and boxes on a checklist
    line("BT /F1 10 Tf 72 %d Td (R1 = 4.7 k) Tj /FS 10 Tf (W) Tj /F1 10 Tf ( ) Tj /FS 10 Tf (\\261) Tj /F1 10 Tf (5%%, ) Tj /FS 10 Tf (a) Tj /F1 10 Tf ( = 30) Tj /FS 10 Tf (\\260) Tj /F1 10 Tf (, ) Tj"
         " /FS 10 Tf (D) Tj /F1 10 Tf (p ) Tj /FS 10 Tf (\\243) Tj /F1 10 Tf ( 2 bar, ) Tj /FS 10 Tf (m) Tj /F1 10 Tf ( = 0.15, d ) Tj /FS 10 Tf (\\263) Tj /F1 10 Tf ( 12 Hagworth) Tj ET" % y); y -= 16
    line("BT /FZ 11 Tf 72 %d Td (4) Tj /F1 10 Tf ( pressure tested ) Tj /FZ 11 Tf (3) Tj /F1 10 Tf ( leak free ) Tj /FZ 11 Tf (8) Tj /F1 10 Tf ( flushed ) Tj /FZ 11 Tf (n) Tj /F1 10 Tf ( tagged ) Tj /FZ 11 Tf (q) Tj /F1 10 Tf ( signed ) Tj /FZ 11 Tf (\\254) Tj /F1 10 Tf ( one) Tj ET" % y); y -= 16
    # 9. a ToUnicode with a decomposed accent, and ligatures read as U+FB01 / U+FB03
    line("BT /FD 10 Tf 72 %d Td %s Tj ET" % (y, lit("Witness: Jos\xe9 Nu\xf1ez Ib\xe1\xf1ez of Gri\x02ths & Cli\x01ord")))
    y -= 16
    # 10. a double-barrelled name broken at its own hyphen, and a long name broken by a hyphen, across lines of one column
    line("BT /F2 11 Tf 72 %d Td 13 TL (The lease was signed by Ms Philippa Ashworth-) Tj T* (Bramley and witnessed by Mr Oswald Feather-) Tj T* (stonehaugh at the Kirkby office on 3 May.) Tj ET" % y); y -= 44
    # 11. a word widened (Tz 150) and a word letter-spaced by Tc 3
    line("BT /F1 10 Tf 72 %d Td (Scaled ) Tj 150 Tz (Fothergill) Tj 100 Tz ( and ) Tj 3 Tc (Ravenscroft) Tj 0 Tc ( end) Tj ET" % y); y -= 16
    # 12. a math-like line: single symbols with a thick space between them (as TeX sets a + b = c)
    xx = 72
    parts = [("F2", "a"), ("F2", "+"), ("F2", "b"), ("F2", "="), ("F2", "c")]
    for k, (f, ch) in enumerate(parts):
        line("BT /F2 11 Tf %.2f %d Td (%s) Tj ET" % (xx, y, ch)); xx += w(ch, "Times-Roman", 11) + 0.25 * 11
    line("BT /F2 11 Tf %.2f %d Td (holds for Quenby.) Tj ET" % (xx + 8, y)); y -= 16
    page(pdf, "\n".join(c), res)
    # ---- page 2: turned runs, and words in forms nested 1 to 10 deep
    c = []
    c.append("BT /FB 14 Tf 72 760 Td (Turned and nested) Tj ET")
    c.append("BT /F1 10 Tf 0 1 -1 0 90 500 Tm (Rotated ninety Aldbrough) Tj ET")
    c.append("BT /F1 10 Tf 0 -1 1 0 560 700 Tm (Rotated back Ebberston) Tj ET")
    c.append("BT /F1 10 Tf -1 0 0 -1 400 600 Tm (Upside down Fylingdales) Tj ET")
    c.append("BT /F1 10 Tf 0.866 0.5 -0.5 0.866 150 560 Tm (Thirty degrees Goathland) Tj ET")
    # nested forms: depth d draws word d and then form d+1
    words = ["Ambleside", "Bowness", "Coniston", "Dalegarth", "Eskdale", "Frizington", "Gosforth", "Hawkshead", "Ireby", "Keswick"]
    inner = None
    for d in range(10, 0, -1):
        cs = "BT /F1 10 Tf 100 %d Td (Depth %d %s) Tj ET" % (400 - d * 14, d, words[d - 1])
        r = Dictionary(Font=Dictionary(F1=F1))
        if inner is not None:
            cs += "\nq /Fx Do Q"; r.XObject = Dictionary(Fx=inner)
        inner = form(pdf, cs, r)
    c.append("q /Fx Do Q")
    res2 = Dictionary(Font=Dictionary(F1=F1, FB=FB), XObject=Dictionary(Fx=inner))
    page(pdf, "\n".join(c), res2)
    pdf.save(out("e_textops"))

if want("e_textops"): e_textops()

# =====================================================================================================================
# r_invoice: a two-page invoice (reportlab): letterhead, header and footer on each page, a bullet-separated contact line
# (reportlab writes every bullet as code 127), a parts table at leading 1.0 and one at 1.15, a Symbol ohm in a
# description, single-letter revision cells; and copies with a CropBox and turned 90 / 180 / 270
# =====================================================================================================================
def r_invoice():
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    p = out("r_invoice")
    c = canvas.Canvas(p, pagesize=letter)
    c.setTitle("Invoice HPV-2291"); c.setAuthor("Harrowgate Pump & Valve Ltd")
    def head(n):
        c.setFont("Helvetica-Bold", 16); c.drawString(54, 740, "Harrowgate Pump & Valve Ltd")
        c.setFont("Helvetica", 8.5); c.drawString(54, 727, "14 Tanner Row • Knaresborough HG5 8AL • Tel. 01423 555 0187 • accounts@harrowgate.example")
        c.setFont("Helvetica", 8); c.drawRightString(558, 740, "INVOICE HPV-2291-0047"); c.drawRightString(558, 729, "Page %d of 2" % n)
        c.line(54, 720, 558, 720)
        c.setFont("Helvetica-Oblique", 7.5); c.drawCentredString(306, 30, "Harrowgate Pump & Valve Ltd • VAT GB 274 5519 08 • Registered in England 0447 2291 • Page %d" % n)
    head(1)
    c.setFont("Helvetica-Bold", 10); c.drawString(54, 698, "Bill to")
    c.setFont("Helvetica", 10)
    for k, t in enumerate(["Mrs Gwendolyn Ashcombe-Pryce", "Ashcombe Surveying Ltd", "7 Quarry Lane, Pateley Bridge", "HG3 5QT", "Acct. HPV-2291-0047 • (918) 555-0143"]):
        c.drawString(54, 684 - 12 * k, t)
    c.setFont("Helvetica-Bold", 10); c.drawString(330, 698, "Ship to")
    c.setFont("Helvetica", 10)
    for k, t in enumerate(["Site office, Bellweather Reservoir", "attn. Mr Thaddeus Okonkwo", "Dam Road, Greenhow HG3 5JL"]):
        c.drawString(330, 684 - 12 * k, t)
    # table 1: leading 1.0 (9 pt rows at 9 pt)
    y = 600
    c.setFont("Helvetica-Bold", 9)
    cols = [54, 84, 104, 200, 470, 520]
    for x, t in zip(cols, ["Qty", "Rev", "Part no.", "Description", "Unit", "Total"]): c.drawString(x, y, t)
    rows = [("2", "B", "HX-4471-B", "Impeller, 316L, 180 mm", "212.40", "424.80"), ("1", "C", "HX-4472-C", "Mechanical seal kit (Marchetti)", "96.15", "96.15"),
            ("4", "A", "PT-0019-A", "Pressure transducer 0-10 bar", "54.00", "216.00"), ("3", "D", "SN-7731-D", "Sensor 4.7 kΩ thermistor", "11.20", "33.60"),
            ("1", "A", "LB-0002-A", "Labour, Wolstenholme (4 h)", "65.00", "260.00"), ("6", "B", "GK-1180-B", "Gasket, EPDM, DN80", "3.75", "22.50")]
    c.setFont("Helvetica", 9)
    for r in rows:
        y -= 9
        for x, t in zip(cols, r):
            if "Ω" in t:
                a, b = t.split("Ω"); c.drawString(x, y, a); xx = x + c.stringWidth(a, "Helvetica", 9)
                c.setFont("Symbol", 9); c.drawString(xx, y, "Ω"); xx += c.stringWidth("Ω", "Symbol", 9); c.setFont("Helvetica", 9); c.drawString(xx, y, b)
            else: c.drawString(x, y, t)
    # table 2: leading 1.15 (10.35 pt at 9 pt), names in it
    y -= 30
    c.setFont("Helvetica-Bold", 9); c.drawString(54, y, "Site visits"); y -= 12
    c.setFont("Helvetica", 9)
    for r in [("12 Mar", "Thaddeus Okonkwo", "Inspection of pump 2", "Bellweather"), ("19 Mar", "Philippa Ashworth-Bramley", "Seal replaced (Marchetti kit)", "Bellweather"),
              ("26 Mar", "Thaddeus Okonkwo", "Commissioning, 25 m³/h", "Greenhow"), ("02 Apr", "Oswald Wolstenholme", "Handover, signed", "Greenhow")]:
        for x, t in zip([54, 104, 250, 430], r): c.drawString(x, y, t)
        y -= 10.35
    c.setFont("Helvetica", 9); c.drawString(54, y - 14, "Payment within 30 days to Ashcombe Surveying Ltd's account manager, Mrs Ashcombe-Pryce, quoting HPV-2291-0047.")
    c.showPage()
    head(2)
    c.setFont("Helvetica", 10)
    y = 690
    for t in ["Notes", "The impeller supplied by Marchetti Pumps replaces the part fitted by Mr Okonkwo in 2019.",
              "Warranty: 24 months from handover. Contact Mrs Gwendolyn Ashcombe-Pryce on (918) 555-0143.",
              "Bank: Knaresborough Savings • Sort 40-47-22 • Account 91 22 47 03"]:
        c.drawString(54, y, t); y -= 14
    c.setFont("Times-Roman", 11); c.drawString(54, y - 10, "Signed for Harrowgate: Oswald Wolstenholme, Director")
    c.showPage(); c.save()
    # copies: a CropBox, and turned 90 / 180 / 270 (with the crop)
    for rot in (0, 90, 180, 270):
        with pikepdf.open(p) as d:
            for pg in d.pages:
                pg.obj.CropBox = Array([18, 24, 594, 768])
                if rot: pg.obj.Rotate = rot
            d.save(out("r_invoice_crop%d" % rot))
    # linearized with object streams (the same pages)
    sh("qpdf", "--linearize", "--object-streams=generate", p, out("r_invoice_lin"))

if want("r_invoice"): r_invoice()

# =====================================================================================================================
# e_drawing: an A3 engineering drawing as a CAD program writes one -- zone labels round the border, the title block a
# form (with the firm's logo a form inside it), notes with Symbol units, a ZapfDingbats inspection checklist, dimensions
# turned 90 degrees, a leader note at 30 degrees, a slanted "NOT FOR CONSTRUCTION", Tz-condensed text; and the same
# sheet stored portrait with /Rotate 90 and a CropBox (as plotters and scanners save it)
# =====================================================================================================================
def e_drawing():
    for variant in ("", "_rot90"):
        pdf = pikepdf.new()
        F1 = std_font(pdf, "Helvetica"); FB = std_font(pdf, "Helvetica-Bold"); FS = std_font(pdf, "Symbol", enc=None); FZ = std_font(pdf, "ZapfDingbats", enc=None)
        FC = std_font(pdf, "Courier")
        fonts = Dictionary(F1=F1, FB=FB, FS=FS, FZ=FZ, FC=FC)
        W, H = 1191, 842
        logo = form(pdf, "q 0.2 0.3 0.6 rg 0 0 40 24 re f Q BT /FB 9 Tf 1 g 4 8 Td (KHL) Tj ET", Dictionary(Font=fonts), bbox=(0, 0, 40, 24))
        tb = []
        tb.append("0.8 w 0 0 380 120 re S 0 40 m 380 40 l S 0 80 m 380 80 l S 190 0 m 190 80 l S")
        tb.append("q 1 0 0 1 330 88 cm /Logo Do Q")
        tb.append("BT /FB 12 Tf 8 100 Td (KIRKSTALL HYDRAULICS LTD) Tj ET")
        tb.append("BT /F1 7 Tf 8 88 Td (TITLE) Tj /FB 10 Tf 0 -0 Td 40 0 Td (PUMP HOUSING, DN80) Tj ET")
        tb.append("BT /F1 7 Tf 8 66 Td (DRAWN) Tj /F1 9 Tf 40 0 Td (K. Okonkwo) Tj ET")
        tb.append("BT /F1 7 Tf 8 50 Td (CHECKED) Tj /F1 9 Tf 40 0 Td (R. Villanueva-Prieto) Tj ET")
        tb.append("BT /F1 7 Tf 198 66 Td (PART No.) Tj /FC 9 Tf 40 0 Td (HX-4471-B) Tj ET")
        tb.append("BT /F1 7 Tf 198 50 Td (MATERIAL) Tj /F1 9 Tf 40 0 Td (AISI 316L) Tj ET")
        tb.append("BT /F1 7 Tf 8 26 Td (SCALE) Tj /F1 9 Tf 40 0 Td (1:2) Tj /F1 7 Tf 60 0 Td (SHEET) Tj /F1 9 Tf 30 0 Td (1 OF 3) Tj ET")
        tb.append("BT /F1 7 Tf 198 26 Td (DATE) Tj /F1 9 Tf 40 0 Td (2026-03-12) Tj /F1 7 Tf 60 0 Td (REV) Tj /F1 9 Tf 20 0 Td (B) Tj ET")
        tb.append("BT /F1 7 Tf 8 8 Td (UNLESS STATED: TOL ) Tj /FS 7 Tf (\\261) Tj /F1 7 Tf (0.1 mm, ANGLES ) Tj /FS 7 Tf (\\261) Tj /F1 7 Tf (0.5) Tj /FS 7 Tf (\\260) Tj /F1 7 Tf (, Ra 1.6 ) Tj /FS 7 Tf (m) Tj /F1 7 Tf (m) Tj ET")
        title = form(pdf, "\n".join(tb), Dictionary(Font=fonts, XObject=Dictionary(Logo=logo)), bbox=(0, 0, 380, 120))
        c = ["1 w 20 20 %d %d re S 30 30 %d %d re S" % (W - 40, H - 40, W - 60, H - 60)]
        for k in range(8):   # zone numbers along the top and bottom, letters down the sides
            x = 30 + (W - 60) * (k + 0.5) / 8
            c.append("BT /F1 10 Tf %.1f %d Td (%d) Tj ET BT /F1 10 Tf %.1f %d Td (%d) Tj ET" % (x, H - 28, k + 1, x, 22, k + 1))
        for k, ch in enumerate("FEDCBA"):
            y = 30 + (H - 60) * (k + 0.5) / 6
            c.append("BT /F1 10 Tf 22 %.1f Td (%s) Tj ET BT /F1 10 Tf %d %.1f Td (%s) Tj ET" % (y, ch, W - 28, y, ch))
        c.append("q 1 0 0 1 %d 30 cm /TB Do Q" % (W - 30 - 380))
        # the part: a rectangle with a bore, and dimensions
        c.append("0.6 w 200 300 500 300 re S 450 450 60 0 360 re S")
        c.append("BT /F1 10 Tf 400 280 Td (1250 ) Tj /FS 10 Tf (\\261) Tj /F1 10 Tf ( 0.5) Tj ET")
        c.append("BT /F1 10 Tf 0 1 -1 0 185 400 Tm (840 ) Tj /FS 10 Tf (\\261) Tj /F1 10 Tf ( 0.2) Tj ET")
        c.append("BT /F1 10 Tf 0 1 -1 0 725 360 Tm (BORE Pendlebury 120 H7) Tj ET")
        c.append("BT /F1 9 Tf 0.866 0.5 -0.5 0.866 560 640 Tm (SEE DETAIL A, Ravensworth) Tj ET")
        c.append("BT /FB 20 Tf 1 0 0.3 1 220 700 Tm 0.6 g (NOT FOR CONSTRUCTION) Tj 0 g ET")
        c.append("BT /F1 10 Tf 75 Tz 220 660 Td (CONDENSED NOTE: Ackroyd to confirm flange PCD) Tj 100 Tz ET")
        # notes with Symbol units
        notes = [("NOTES", None),
                 ("1. Heater R1 = 4.7 k", "W"), ("2. Draft angle ", "a"), ("3. Pressure drop ", "D"), ("4. Friction coefficient ", "m"), ("5. Fit per Hathersage ", None)]
        y = 240
        c.append("BT /FB 10 Tf 200 %d Td (NOTES) Tj ET" % y)
        y -= 14
        c.append("BT /F1 9 Tf 200 %d Td (1. Heater R1 = 4.7 k) Tj /FS 9 Tf (W) Tj /F1 9 Tf ( ) Tj /FS 9 Tf (\\261) Tj /F1 9 Tf ( 5 %%, rated 2 W at 40 ) Tj /FS 9 Tf (\\260) Tj /F1 9 Tf (C.) Tj ET" % y); y -= 12
        c.append("BT /F1 9 Tf 200 %d Td (2. Draft angle ) Tj /FS 9 Tf (a) Tj /F1 9 Tf ( = 3) Tj /FS 9 Tf (\\260) Tj /F1 9 Tf ( on all cast faces.) Tj ET" % y); y -= 12
        c.append("BT /F1 9 Tf 200 %d Td (3. Pressure drop ) Tj /FS 9 Tf (D) Tj /F1 9 Tf (p ) Tj /FS 9 Tf (\\243) Tj /F1 9 Tf ( 0.4 bar at 25 m3/h; ) Tj /FS 9 Tf (D) Tj /F1 9 Tf (T ) Tj /FS 9 Tf (\\243) Tj /F1 9 Tf ( 5 K.) Tj ET" % y); y -= 12
        c.append("BT /F1 9 Tf 200 %d Td (4. Friction coefficient ) Tj /FS 9 Tf (m) Tj /F1 9 Tf ( = 0.15; surface Ra 0.8 ) Tj /FS 9 Tf (m) Tj /F1 9 Tf (m.) Tj ET" % y); y -= 12
        c.append("BT /F1 9 Tf 200 %d Td (5. Shaft ) Tj /FS 9 Tf (f) Tj /F1 9 Tf ( 40 h6; torque ) Tj /FS 9 Tf (\\263) Tj /F1 9 Tf ( 85 N) Tj /FS 9 Tf (\\327) Tj /F1 9 Tf (m per Hathersage.) Tj ET" % y); y -= 12
        # inspection checklist (ZapfDingbats)
        y = 240
        c.append("BT /FB 10 Tf 560 %d Td (INSPECTION) Tj ET" % y); y -= 14
        for mark, txt in [("4", "Hydrotest 16 bar, witnessed Fairbairn"), ("4", "Dimensions checked"), ("8", "Paint DFT (rework)"), ("q", "Final release"), ("n", "Tagged HX-4471-B")]:
            c.append("BT /FZ 10 Tf 560 %d Td (%s) Tj /F1 9 Tf 14 0 Td (%s) Tj ET" % (y, mark, txt)); y -= 12
        res = Dictionary(Font=fonts, XObject=Dictionary(TB=title))
        content = "\n".join(c)
        if variant:
            # stored portrait: the sheet drawn turned into a 842 x 1191 page, shown landscape by /Rotate 90
            content = "q 0 -1 1 0 0 %d cm\n%s\nQ" % (W, content)
            page(pdf, content, res, size=(H, W), rotate=90, crop=(6, 6, H - 6, W - 6))
        else:
            page(pdf, content, res, size=(W, H), crop=(5, 5, W - 5, H - 5))
        pdf.save(out("e_drawing" + variant))

if want("e_drawing"): e_drawing()

# =====================================================================================================================
# f_acro: an Acrobat-style form -- text fields, comb fields (an SSN in 9 cells, a phone number in 10), radio groups
# drawn as Acrobat draws them (ZapfDingbats l in each "on" drawing): one by plain names, one by numbers with /Opt export
# values (Klein, Mittel, Gross with an sharp s), one with UTF-8 state names (/Gr#C3#BCn); check boxes (ZapfDingbats 4);
# /DR, /DA. f_orphan: a page split from such a form -- its widgets filled and drawn, no /AcroForm.
# =====================================================================================================================
def acro_page(pdf, orphan=False):
    Helv = std_font(pdf, "Helvetica"); ZaDb = std_font(pdf, "ZapfDingbats", enc=None)
    annots = []; fields = []
    def ap(content, w, h, res=None):
        s = Stream(pdf, content.encode("latin-1")); s.Type = Name.XObject; s.Subtype = Name.Form; s.BBox = Array([0, 0, w, h])
        s.Resources = res if res is not None else Dictionary(Font=Dictionary(Helv=Helv, ZaDb=ZaDb))
        return pdf.make_indirect(s)
    def text(name, rect, value, size=10, comb=0):
        x0, y0, x1, y1 = rect; wd, ht = x1 - x0, y1 - y0
        if comb:
            cw = wd / comb; parts = ["/Tx BMC q 1 1 %.2f %.2f re W n" % (wd - 2, ht - 2), "0.5 0.5 0.5 RG 0.5 w"]
            for k in range(1, comb): parts.append("%.2f 0 m %.2f %.2f l S" % (cw * k, cw * k, ht))
            parts.append("BT /Helv %g Tf 0 g" % size)
            for k, ch in enumerate(value):
                tw = w(ch, "Helvetica", size); parts.append("1 0 0 1 %.2f %.2f Tm (%s) Tj" % (cw * (k + 0.5) - tw / 2, (ht - size) / 2 + 0.22 * size, ch))
            parts.append("ET Q EMC")
        else:
            parts = ["/Tx BMC q 1 1 %.2f %.2f re W n BT /Helv %g Tf 0 g 2 %.2f Td %s Tj ET Q EMC" % (wd - 2, ht - 2, size, (ht - size) / 2 + 0.22 * size, lit(value))]
        d = Dictionary(Type=Name.Annot, Subtype=Name.Widget, FT=Name.Tx, T=String(name), V=String(value), Rect=Array(list(rect)), F=4,
                       DA=String("/Helv %g Tf 0 g" % size), AP=Dictionary(N=ap("\n".join(parts), wd, ht)), MK=Dictionary(BC=Array([0.5, 0.5, 0.5])))
        if comb: d.Ff = 16777216; d.MaxLen = comb
        d = pdf.make_indirect(d); annots.append(d); fields.append(d)
    def radio(name, states, on, y, opt=None, labels=None):
        kids = []
        parent = pdf.make_indirect(Dictionary(FT=Name.Btn, Ff=49152, T=String(name), V=Name("/" + on) if on else Name.Off, DA=String("/ZaDb 0 Tf 0 g")))
        if opt: parent.Opt = Array([String(o) for o in opt])
        for k, st in enumerate(states):
            x = 200 + k * 110; rect = [x, y, x + 12, y + 12]
            onap = ap("q 0 g BT /ZaDb 8.4 Tf 2.2 3.1 Td (l) Tj ET Q", 12, 12)
            offap = ap("q 0.5 0.5 0.5 RG 0.6 w 6 6 5 0 360 re S Q", 12, 12)
            st_name = Name("/" + st) if isinstance(st, str) else st
            k_ = pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, Parent=parent, Rect=Array(rect), F=4, AS=st_name if (("/" + on) == str(st_name)) else Name.Off,
                                              MK=Dictionary(CA=String("l"), BC=Array([0.5])), AP=Dictionary(N=Dictionary({str(st_name): onap, "/Off": offap}))))
            kids.append(k_); annots.append(k_)
        parent.Kids = Array(kids); fields.append(parent)
    def check(name, rect, on):
        onap = ap("q 0 g BT /ZaDb 9 Tf 1.6 2.4 Td (4) Tj ET Q", 12, 12); offap = ap("q 0.5 G 0.5 0.5 11 11 re S Q", 12, 12)
        d = pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Widget, FT=Name.Btn, T=String(name), V=Name.Yes if on else Name.Off, AS=Name.Yes if on else Name.Off,
                                         Rect=Array(rect), F=4, DA=String("/ZaDb 0 Tf 0 g"), MK=Dictionary(CA=String("4")), AP=Dictionary(N=Dictionary(Yes=onap, Off=offap))))
        annots.append(d); fields.append(d)
    lab = ["BT /F1 16 Tf 54 740 Td (Contractor registration) Tj ET", "BT /F1 9 Tf 54 724 Td (Kirkstall Hydraulics Ltd \\225 Site access office) Tj ET"]
    rows = [("Full name", 690), ("Home address", 662), ("SSN", 634), ("Phone", 606), ("Shift", 572), ("Overall size", 548), ("Helmet colour", 524), ("Agreed", 496), ("Night rate", 474)]
    for t, y in rows: lab.append("BT /F1 10 Tf 54 %d Td (%s) Tj ET" % (y + 3, t))
    text("name", [200, 686, 480, 704], "Gwendolyn Featherstonehaugh", 11)
    text("address", [200, 658, 540, 676], "Flat 3, 22 Wharfedale Rise, Otley LS21 9QT", 10)
    text("ssn", [200, 628, 380, 648], "078051120", 12, comb=9)
    text("phone", [200, 600, 400, 620], "9185550143", 11, comb=10)
    radio("shift", ["Day", "Night", "Swing"], "Day", 572)
    for k, t in enumerate(["Day", "Night", "Swing"]): lab.append("BT /F1 9 Tf %d 575 Td (%s) Tj ET" % (216 + k * 110, t))
    radio("size", ["0", "1", "2"], "1", 548, opt=["Klein", "Mittel", "Gro\xdfe"])
    for k, t in enumerate(["Klein", "Mittel", "Gro\xdfe"]): lab.append("BT /F1 9 Tf %d 551 Td %s Tj ET" % (216 + k * 110, lit(t)))
    radio("colour", [Name("/Gr\u00fcn"), Name("/Wei\u00df"), Name("/Blau")], "Blau", 524)
    for k, t in enumerate(["Gr\xfcn", "Wei\xdf", "Blau"]): lab.append("BT /F1 9 Tf %d 527 Td %s Tj ET" % (216 + k * 110, lit(t)))
    check("agree", [200, 494, 212, 506], True)
    check("nightrate", [200, 472, 212, 484], False)
    lab.append("BT /F1 9 Tf 54 440 Td (Office use: vetted by Hollingworth on 2026-03-12.) Tj ET")
    res = Dictionary(Font=Dictionary(F1=std_font(pdf, "Helvetica")))
    p = page(pdf, "\n".join(lab), res)
    p.obj.Annots = Array(annots)
    if not orphan:
        pdf.Root.AcroForm = Dictionary(Fields=Array(fields), DR=Dictionary(Font=Dictionary(Helv=Helv, ZaDb=ZaDb)), DA=String("/Helv 0 Tf 0 g"))

def f_acro():
    pdf = pikepdf.new(); acro_page(pdf); pdf.save(out("f_acro"))
    pdf = pikepdf.new(); acro_page(pdf, orphan=True); pdf.save(out("f_orphan"))
    sh("qpdf", "--linearize", "--object-streams=generate", out("f_acro"), out("f_acro_lin"))
    # the same form as it is often sent on: flattened by another program (here qpdf), the comb's digits page text now
    sh("qpdf", "--flatten-annotations=all", "--remove-unreferenced-resources=no", out("f_acro"), out("f_acro_qflat"))

if want("f_acro"): f_acro()

# =====================================================================================================================
# l_manual2 / l_manual3: a pump manual from pdflatex, two columns (article, twocolumn) and three (multicol), justified
# and hyphenated, with running heads and page numbers, footnotes, inline equations, and people's names that TeX breaks
# across lines (\hyphenation gives their break points); l_manual2_t1 the same in T1 Latin Modern with ToUnicode maps
# =====================================================================================================================
MANUAL_TEXT = r"""
\section{Scope}
This manual covers the DN80 pump housing designed by Featherstonehaugh and checked by Winterbourne. The seal kit was
specified by Marchetti, and every flange was measured by Featherstonehaugh twice before the housing left the works at
Kirkstall. Questions on the impeller go to Winterbourne; questions on the bearings to Marchbanks.\footnote{Marchbanks
retired in 2025; ask Ravenscroft instead.}

\section{Ratings}
The pump delivers $Q = 25$ m$^3$/h against a head of $H = 32$ m. The shaft power follows $P = \rho g Q H / \eta$, and the
motor current satisfies $a + b = c$ when the phases are balanced, which Winterbourne verified on site with
Featherstonehaugh. Never run the pump dry: the mechanical seal from Marchetti fails within minutes, as Marchbanks found
during the acceptance test witnessed by Winterbourne and Ravenscroft.

\section{Maintenance}
Every six months, Featherstonehaugh's checklist applies: inspect the seal, grease the bearings, and record the vibration
reading. If the vibration exceeds 4.5 mm/s, call Winterbourne or Marchbanks at once. The impeller clearance is set by
Ravenscroft with feeler gauges; Featherstonehaugh's method uses a dial indicator instead, which Winterbourne prefers for
the larger housings. Spare seals come from Marchetti in Bergamo; order them through Marchbanks, quoting the drawing
number HX-4471-B and the serial number stamped by Featherstonehaugh on the flange.

\section{Safety}
Isolate the motor before opening the casing. The interlock fitted by Winterbourne must not be bypassed. Featherstonehaugh
recommends a second person on site, and Ravenscroft keeps the permit book. Marchetti's warranty is void if the seal is
replaced by anyone other than Marchbanks or Featherstonehaugh, who were trained at the works. Report incidents to
Winterbourne within a day.
"""
def latex(name, preamble, body, engine="pdflatex"):
    d = tempfile.mkdtemp(dir=WORK)
    src = "\\documentclass" + preamble + "\n\\begin{document}\n" + body + "\n\\end{document}\n"
    open(os.path.join(d, "m.tex"), "w").write(src)
    for _ in range(2): r = sh(engine, "-interaction=nonstopmode", "m.tex", cwd=d, timeout=300)
    if not os.path.exists(os.path.join(d, "m.pdf")): print(r.stdout[-2000:]); raise SystemExit("latex failed: " + name)
    shutil.copy(os.path.join(d, "m.pdf"), out(name))

def l_manuals():
    hy = r"\hyphenation{Feath-er-stone-haugh Win-ter-bourne March-banks Ra-vens-croft Mar-chet-ti}"
    head = r"\usepackage{fancyhdr}\pagestyle{fancy}\fancyhead[L]{Kirkstall Hydraulics}\fancyhead[R]{Pump housing DN80}\fancyfoot[C]{Page \thepage}" + hy
    latex("l_manual2", "[twocolumn,10pt]{article}\n\\usepackage[margin=3.6cm,columnsep=0.8cm]{geometry}\n" + head, MANUAL_TEXT * 2)
    latex("l_manual3", "[10pt]{article}\n\\usepackage[margin=1.6cm]{geometry}\\usepackage{multicol}\n" + head, r"\begin{multicols}{3}" + MANUAL_TEXT + MANUAL_TEXT + r"\end{multicols}")
    latex("l_manual2_t1", "[twocolumn,10pt]{article}\n\\input{glyphtounicode}\\pdfgentounicode=1\\usepackage[T1]{fontenc}\\usepackage{lmodern}\n\\usepackage[margin=3.6cm,columnsep=0.8cm]{geometry}\n" + head, MANUAL_TEXT * 2)

if want("l_manuals"): l_manuals()

# =====================================================================================================================
# x_intl: Greek, Cyrillic and Turkish from xelatex (DejaVu Serif): capitals with a final sigma, Turkish dotted and
# dotless i in capitals and small letters, the micro and increment signs beside mu and delta, a Greek label turned 90
# =====================================================================================================================
def x_intl():
    body = r"""
\section*{Μητρώο εργολάβων / Реестр подрядчиков / Yüklenici kaydı}
Υπεύθυνος έργου: ΝΙΚΟΛΑΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ, οδός Ερμού 12, Αθήνα. Ο κ. Παπαδόπουλος υπογράφει για την ΟΔΟΣ ΑΝΑΠΤΥΞΗΣ Α.Ε.
και ο βοηθός του, ο Σωκράτης Καραμανλής, ελέγχει τις μετρήσεις της πίεσης.

Ответственный: СЕРГЕЙ ИВАНОВИЧ ПЕТРОВСКИЙ, ул. Ленина 5, Новосибирск. Его заместитель Петровская Анна проверяет давление.

Sorumlu mühendis: ŞEBNEM YILDIZ ŞAHİN, İSTANBUL şubesi. Yardımcısı Işıl Yıldız, İzmir'de ölçümleri denetler.
Rapor IĞDIR bölgesi için hazırlandı; ılık su hattı Kadıköy'de.

Units: 4.7 kΩ, 12 µm (micro sign), 12 μm (mu), ∆p = 2 bar (increment), Δp = 3 bar (delta), 25 °C ± 0.5.

\rotatebox{90}{ΠΑΠΑΔΟΠΟΥΛΟΣ ΕΛΕΓΧΟΣ} \quad \rotatebox{90}{ПЕТРОВСКИЙ ПРОВЕРКА}
"""
    latex("x_intl", "[11pt]{article}\n\\usepackage{fontspec}\\setmainfont{DejaVu Serif}\\usepackage{graphicx}\\usepackage[margin=2.5cm]{geometry}", body, engine="xelatex")

if want("x_intl"): x_intl()

# =====================================================================================================================
# lo_letter: a letter from LibreOffice Writer (a flat ODT): a header and a footer on each page, Turkish and Greek names,
# a soft hyphen inside long names so that Writer breaks them with a visible hyphen at the line's end, a table at
# single spacing
# =====================================================================================================================
def lo_letter():
    shy = "­"
    name1 = "Feather" + shy + "stone" + shy + "haugh"
    para = ("Dear Ms Ashcombe-Pryce, further to our meeting with Mr " + name1 + " and Mrs Şebnem Yıldız Şahin of the İzmir office, "
            "we confirm that the pump housing was inspected by " + name1 + " on 12 March. The seal kit from Marchetti was fitted by Mr Okonkwo "
            "and witnessed by ŞAHİN and by ΠΑΠΑΔΟΠΟΥΛΟΣ of the Athens office. ") * 3
    def cell(t): return '<table:table-cell office:value-type="string"><text:p>%s</text:p></table:table-cell>' % t
    rows = "".join("<table:table-row>%s</table:table-row>" % "".join(cell(t) for t in r) for r in
                   [("Date", "Engineer", "Site"), ("12 Mar", name1, "Bellweather"), ("19 Mar", "Şebnem Yıldız Şahin", "İzmir"), ("26 Mar", "Νίκος Παπαδόπουλος", "Αθήνα")])
    fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.text">
<office:font-face-decls><style:font-face style:name="Liberation Serif" svg:font-family="'Liberation Serif'" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"/></office:font-face-decls>
<office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:text-align="justify"/><style:text-properties style:font-name="Liberation Serif" fo:font-size="11pt" fo:language="en" fo:country="GB"/></style:default-style></office:styles>
<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="8.5in" fo:page-height="11in" fo:margin-top="0.6in" fo:margin-bottom="0.6in" fo:margin-left="1.6in" fo:margin-right="1.6in"/>
<style:header-style><style:header-footer-properties fo:min-height="0.3in"/></style:header-style><style:footer-style><style:header-footer-properties fo:min-height="0.3in"/></style:footer-style></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1">
<style:header><text:p>Kirkstall Hydraulics Ltd — Ref. KH/2291/İZM</text:p></style:header>
<style:footer><text:p>Page <text:page-number text:select-page="current"/> — Wolstenholme &amp; Partners, Otley</text:p></style:footer>
</style:master-page></office:master-styles>
<office:body><office:text>
<text:p>Kirkstall Hydraulics Ltd, 14 Tanner Row, Knaresborough</text:p><text:p/>
%s
<table:table table:name="T1"><table:table-column table:number-columns-repeated="3"/>%s</table:table>
<text:p>Yours sincerely,</text:p><text:p>Oswald Wolstenholme</text:p>
%s
</office:text></office:body></office:document>""" % ("".join("<text:p>%s</text:p>" % para for _ in range(2)), rows, "".join("<text:p>%s</text:p>" % para for _ in range(3)))
    d = tempfile.mkdtemp(dir=WORK)
    open(os.path.join(d, "lo_letter.fodt"), "w").write(fodt)
    r = sh("soffice", "--headless", "--convert-to", "pdf", "--outdir", d, os.path.join(d, "lo_letter.fodt"), timeout=300)
    shutil.copy(os.path.join(d, "lo_letter.pdf"), out("lo_letter"))

if want("lo_letter"): lo_letter()

# =====================================================================================================================
# c_styles: a work order printed from Chromium (Playwright's page.pdf with a header and footer): CSS letter-spacing from
# 0.05 to 0.9 em on capitals and on small letters, small-caps, a made-up italic (a font with no italic face), sup and sub,
# tables at line-height 1.0 and 1.15, justified text with names broken at soft hyphens, text-transform: uppercase in
# Turkish (lang=tr) and in Greek, a label turned with rotate(-90deg)
# =====================================================================================================================
C_HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body { font-family: 'Liberation Sans', sans-serif; font-size: 11pt; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 6pt; }
.ls { font-size: 11pt; margin: 2pt 0; }
td, th { padding: 0 6pt; text-align: left; }
.t10 td { line-height: 1.0; font-size: 9pt; } .t115 td { line-height: 1.15; font-size: 9pt; }
.just { text-align: justify; width: 250pt; font-size: 10.5pt; hyphens: manual; }
.sc { font-variant: small-caps; }
.noit { font-family: 'Noto Sans CJK JP'; }
.rot { display: inline-block; transform: rotate(-90deg); transform-origin: left top; position: absolute; left: 520pt; top: 300pt; font-size: 10pt; }
</style></head><body>
<h1>Work order WO-5531 &mdash; Bellweather Reservoir</h1>
<p class="ls" style="letter-spacing:0.05em">CONFIDENTIAL Pemberton-Whyte (0.05em)</p>
<p class="ls" style="letter-spacing:0.1em">RESTRICTED MERIWEATHER (0.1em)</p>
<p class="ls" style="letter-spacing:0.2em">PRIVATE CALDERBANK (0.2em)</p>
<p class="ls" style="letter-spacing:0.3em">Engineer Wolstenholme signs (0.3em)</p>
<p class="ls" style="letter-spacing:0.5em">SECRET HARGREAVES (0.5em)</p>
<p class="ls" style="letter-spacing:0.7em">TOP AINSWORTH (0.7em)</p>
<p class="ls" style="letter-spacing:0.9em">WIDE BOOTHROYD (0.9em)</p>
<p class="sc">Inspected by Thaddeus Okonkwo of Kirkstall Hydraulics, small capitals.</p>
<p>The pump runs <em class="noit">really</em> fast after Corrigan fitted the seal; the flow is 25 m<sup>3</sup>/h and H<sub>2</sub>O at 4<sup>o</sup>C.<sup>1</sup></p>
<table class="t10"><tr><th>Date</th><th>Engineer</th><th>Task</th></tr>
<tr><td>12 Mar</td><td>Thaddeus Okonkwo</td><td>Inspection of pump 2</td></tr><tr><td>19 Mar</td><td>Philippa Ashworth-Bramley</td><td>Seal replaced</td></tr>
<tr><td>26 Mar</td><td>Oswald Wolstenholme</td><td>Commissioning</td></tr><tr><td>02 Apr</td><td>Gwendolyn Ashcombe-Pryce</td><td>Handover</td></tr></table>
<table class="t115"><tr><td>Pins</td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td></tr><tr><td>Night shift</td><td>Hollingworth</td><td>Fairbairn</td><td>Ravenscroft</td><td>Marchbanks</td><td>Pendlebury</td></tr></table>
<p class="just">The housing was measured by Feather&shy;stone&shy;haugh and by Win&shy;ter&shy;bourne before dispatch; Feather&shy;stone&shy;haugh signed the record, and Win&shy;ter&shy;bourne countersigned it at Kirk&shy;stall. The seal kit came from Mar&shy;chetti, and Feather&shy;stone&shy;haugh fitted it with Win&shy;ter&shy;bourne watching, while Mar&shy;chetti's agent took notes for Feather&shy;stone&shy;haugh.</p>
<p lang="tr" style="text-transform:uppercase">sorumlu: şebnem yıldız şahin, istanbul ve izmir.</p>
<p lang="el" style="text-transform:uppercase">υπεύθυνος: νικόλαος παπαδόπουλος, οδός ερμού.</p>
<div class="rot">ROTATED Quenby-Ashton</div>
</body></html>"""

def c_styles():
    from playwright.sync_api import sync_playwright
    d = tempfile.mkdtemp(dir=WORK); h = os.path.join(d, "c.html"); open(h, "w").write(C_HTML)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto("file://" + h)
        pg.pdf(path=out("c_styles"), format="Letter", display_header_footer=True, margin={"top": "60px", "bottom": "60px", "left": "50px", "right": "50px"},
               header_template="<div style='font-size:8px;width:100%;text-align:center'>Kirkstall Hydraulics &mdash; WO-5531 &mdash; Hollingworth</div>",
               footer_template="<div style='font-size:8px;width:100%;text-align:center'>Page <span class='pageNumber'></span> of <span class='totalPages'></span></div>")
        b.close()

if want("c_styles"): c_styles()

# =====================================================================================================================
# s_deep: a page wrapped in forms ten deep, as stamping tools leave it (qpdf --underlay, once a stamp): each level its own
# word; s_stamped10: the invoice stamped ten times by Lantern-independent qpdf --overlay of a one-line stamp
# =====================================================================================================================
def s_deep():
    from reportlab.pdfgen import canvas
    words = ["Ambleside", "Bowness", "Coniston", "Dalegarth", "Eskdale", "Frizington", "Gosforth", "Hawkshead", "Ireby", "Keswick"]
    base = os.path.join(WORK, "deep0.pdf")
    c = canvas.Canvas(base, pagesize=(612, 792)); c.setFont("Helvetica", 11); c.drawString(72, 700, "Base page: Lindale Penrith Ulverston"); c.save()
    cur = base
    for k, wd in enumerate(words):
        st = os.path.join(WORK, "deepst%d.pdf" % k)
        c = canvas.Canvas(st, pagesize=(612, 792)); c.setFont("Helvetica", 11); c.drawString(72, 680 - 16 * k, "Stamp %d: %s approved" % (k + 1, wd)); c.save()
        nxt = os.path.join(WORK, "deep%d.pdf" % (k + 1))
        # the stamp page drawn over the old page, the old page wrapped as a form under it
        sh("qpdf", st, "--underlay", cur, "--", nxt)
        cur = nxt
    shutil.copy(cur, out("s_deep"))

if want("s_deep"): s_deep()

# =====================================================================================================================
# t_scan: the invoice's first page as a 150 dpi picture, read by tesseract into a PDF with its words (invisible) over it
# =====================================================================================================================
def t_scan():
    png = os.path.join(WORK, "scan")
    sh("pdftoppm", "-r", "150", "-f", "1", "-l", "1", "-png", "-singlefile", out("r_invoice"), png)
    sh("tesseract", png + ".png", os.path.join(WORK, "scan_ocr"), "-l", "eng", "pdf", timeout=300)
    shutil.copy(os.path.join(WORK, "scan_ocr.pdf"), out("t_scan"))

if want("t_scan"): t_scan()

# =====================================================================================================================
# h_links: a patient letter with links -- a URI holding the name, one percent-encoded (%4Fkonkwo), a named destination
# holding it, a link whose /Contents names him, one that names nobody; page 2 has no visible name but a link whose
# address holds it, and the outline (bookmarks) names him too
# =====================================================================================================================
def h_links():
    pdf = pikepdf.new()
    F1 = std_font(pdf, "Helvetica")
    res = Dictionary(Font=Dictionary(F1=F1))
    c1 = "\n".join(["BT /F1 12 Tf 72 720 Td (Patient: Thaddeus Okonkwo, ward 7) Tj ET",
                    "BT /F1 11 Tf 72 690 Td (Open the chart) Tj ET", "BT /F1 11 Tf 72 670 Td (Open the scan) Tj ET", "BT /F1 11 Tf 72 650 Td (See the record) Tj ET",
                    "BT /F1 11 Tf 72 630 Td (Call the ward) Tj ET", "BT /F1 11 Tf 72 610 Td (Hospital home page) Tj ET"])
    p1 = page(pdf, c1, res)
    p2 = page(pdf, "BT /F1 11 Tf 72 720 Td (Appendix: imaging index) Tj ET\nBT /F1 11 Tf 72 690 Td (Open the imaging folder) Tj ET", res)
    def link(rect, **kw):
        d = Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=Array(rect), Border=Array([0, 0, 0]), **kw)
        return pdf.make_indirect(d)
    uri = lambda u: Dictionary(S=Name.URI, URI=String(u))
    l1 = [link([72, 686, 160, 700], A=uri("https://records.example.org/patient/Okonkwo/chart")),
          link([72, 666, 160, 680], A=uri("https://records.example.org/scan?name=%4Fkonkwo%20T")),
          link([72, 646, 160, 660], A=Dictionary(S=Name.GoTo, D=String("Okonkwo_record"))),
          link([72, 626, 160, 640], A=uri("tel:+44-113-555-0199"), Contents=String("Call Okonkwo's ward")),
          link([72, 606, 180, 620], A=uri("https://hospital.example.org/"))]
    p1.obj.Annots = Array(l1)
    p2.obj.Annots = Array([link([72, 686, 220, 700], A=uri("https://pacs.example.org/folder/OKONKWO_T/"))])
    names = pdf.make_indirect(Dictionary(Names=Array([String("Okonkwo_record"), Array([p2.obj, Name.XYZ, 0, 792, 0])])))
    pdf.Root.Names = Dictionary(Dests=names)
    ol = pdf.make_indirect(Dictionary(Title=String("Okonkwo, T. - chart"), Dest=Array([p1.obj, Name.XYZ, 0, 792, 0])))
    outl = pdf.make_indirect(Dictionary(Type=Name.Outlines, First=ol, Last=ol, Count=1)); ol.Parent = outl
    pdf.Root.Outlines = outl
    pdf.save(out("h_links"))

if want("h_links"): h_links()
