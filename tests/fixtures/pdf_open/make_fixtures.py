# make_fixtures.py -- the hand-made test PDFs of tests/fixtures/pdf_open (1.24.39). The locked ones were made from
# plain.pdf with qpdf 11.9 (see tests/pdf_open.js); plain.pdf, form_filled.pdf and annotated.pdf with reportlab 5.0.1
# and pypdf 6.17.0 (Lantern_and_Acrobat_Pro check, 2026-11-25). This writes the rest byte by byte:
#   layers.pdf      two layers (optional content): "Wiring" on, "Dimensions" off as the PDF opens; a picture in "Dimensions" too
#   form_plain.pdf  a form whose fields have no drawing of their own (NeedAppearances): a name, a multi-line note,
#                   a ticked box, a choice, a password -- a viewer must draw them
#   nav.pdf         three pages; bookmarks (one by page, one by a named destination, one nested); links to page 3
#                   and to a web address; a comment with no drawing on page 1
import os
HERE = os.path.dirname(os.path.abspath(__file__))
def pdf(objs, root, name):
    out = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        if isinstance(o, tuple):
            d, data = o
            out += b"%d 0 obj\n" % i + d.encode("latin-1") .replace(b"LEN", b"%d" % len(data)) + b"\nstream\n" + data + b"\nendstream\nendobj\n"
        else:
            out += b"%d 0 obj\n" % i + o.encode("latin-1") + b"\nendobj\n"
    x = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % f for f in offs)
    out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, root, x)
    open(os.path.join(HERE, name), "wb").write(out)
font = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
# --- layers.pdf
content = (b"BT /F1 18 Tf 72 700 Td (Pump P-101 panel) Tj ET\n"
           b"/OC /MC0 BDC BT /F1 14 Tf 72 660 Td (WIRING: L1 to K1 coil) Tj ET 0 0 1 RG 4 w 72 640 m 400 640 l S EMC\n"
           b"/OC /MC1 BDC BT /F1 14 Tf 72 600 Td (DIMENSIONS: 450 mm by 300 mm) Tj ET 1 0 0 rg 72 560 300 20 re f EMC\n"
           b"/Fm1 Do\n")
form = b"0 1 0 rg 72 500 150 30 re f BT /F1 12 Tf 80 510 Td (HIDDEN BOX) Tj ET"
pdf([
  "<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R 6 0 R] /D << /Order [5 0 R 6 0 R] /OFF [6 0 R] >> >> >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> /Properties << /MC0 5 0 R /MC1 6 0 R >> /XObject << /Fm1 8 0 R >> >> >>",
  ("<< /Length LEN >>", content),
  "<< /Type /OCG /Name (Wiring) >>",
  "<< /Type /OCG /Name (Dimensions) >>",
  font,
  ("<< /Type /XObject /Subtype /Form /BBox [0 0 612 792] /OC 6 0 R /Resources << /Font << /F1 7 0 R >> >> /Length LEN >>", form),
], 1, "layers.pdf")
# --- form_plain.pdf
content = (b"BT /F1 12 Tf 72 720 Td (Work order 17) Tj ET\n"
           b"BT /F1 12 Tf 72 690 Td (Name:) Tj ET BT /F1 12 Tf 72 650 Td (Done:) Tj ET BT /F1 12 Tf 72 610 Td (Shift:) Tj ET\n"
           b"BT /F1 12 Tf 72 570 Td (PIN:) Tj ET BT /F1 12 Tf 72 530 Td (Notes:) Tj ET\n")
pdf([
  "<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R 6 0 R 8 0 R 9 0 R 10 0 R] /NeedAppearances true /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv 4 0 R >> >> >> >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 11 0 R /Resources << /Font << /F1 4 0 R >> >> /Annots [5 0 R 6 0 R 8 0 R 9 0 R 10 0 R] >>",
  font,
  "<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /V (ADAM WELDON) /DA (/Helv 12 Tf 0 0 1 rg) /Rect [130 682 400 704] /F 4 /P 3 0 R >>",
  "<< /Type /Annot /Subtype /Widget /FT /Btn /T (done) /V /Yes /AS /Yes /Rect [130 645 146 661] /F 4 /P 3 0 R /AP << /N << /Yes 7 0 R /Off 12 0 R >> >> >>",
  ("<< /Type /XObject /Subtype /Form /BBox [0 0 16 16] /Length LEN >>", b"0 g 2 8 m 6 3 l 14 14 l 2 w S"),
  "<< /Type /Annot /Subtype /Widget /FT /Ch /Ff 131072 /T (shift) /V (N) /Opt [[(D) (Day shift)] [(N) (Night shift)]] /DA (/Helv 12 Tf 0 g) /Rect [130 602 400 624] /F 4 /P 3 0 R >>",
  "<< /Type /Annot /Subtype /Widget /FT /Tx /Ff 8192 /T (pin) /V (4321) /DA (/Helv 12 Tf 0 g) /Rect [130 562 400 584] /F 4 /P 3 0 R >>",
  "<< /Type /Annot /Subtype /Widget /FT /Tx /Ff 4096 /T (notes) /V (Replaced the float switch. Pump runs on high float and stops on low.) /DA (/Helv 10 Tf 0 g) /Rect [130 470 330 545] /F 4 /P 3 0 R >>",
  ("<< /Length LEN >>", content),
  ("<< /Type /XObject /Subtype /Form /BBox [0 0 16 16] /Length LEN >>", b""),
], 1, "form_plain.pdf")
# --- nav.pdf
def page_content(n): return b"BT /F1 24 Tf 72 700 Td (Section %d) Tj ET BT /F1 12 Tf 72 660 Td (Go to the wiring table.) Tj ET" % n
pdf([
  "<< /Type /Catalog /Pages 2 0 R /Outlines 9 0 R /Names << /Dests 13 0 R >> >>",
  "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 14 0 R >> >> /Annots [15 0 R 16 0 R 17 0 R] >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 14 0 R >> >> >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 14 0 R >> >> >>",
  ("<< /Length LEN >>", page_content(1)), ("<< /Length LEN >>", page_content(2)), ("<< /Length LEN >>", page_content(3)),
  "<< /Type /Outlines /First 10 0 R /Last 11 0 R /Count 3 >>",
  "<< /Title (Safety first) /Parent 9 0 R /Next 11 0 R /Dest [3 0 R /XYZ 0 792 0] >>",
  "<< /Title (Wiring table) /Parent 9 0 R /Prev 10 0 R /A << /S /GoTo /D (wiring) >> /First 12 0 R /Last 12 0 R /Count 1 >>",
  "<< /Title (Spare parts) /Parent 11 0 R /Dest [4 0 R /Fit] >>",
  "<< /Names [(wiring) [5 0 R /Fit]] >>",
  font,
  "<< /Type /Annot /Subtype /Link /Rect [72 655 260 675] /Border [0 0 0] /Dest (wiring) >>",
  "<< /Type /Annot /Subtype /Link /Rect [72 600 300 620] /Border [0 0 0] /A << /S /URI /URI (https://example.org/manual) >> >>",
  "<< /Type /Annot /Subtype /Square /Rect [400 600 500 700] /C [1 0 0] /IC [1 1 0.6] /BS << /W 3 >> /Contents (Check this terminal) /T (Adam) /F 4 >>",
], 1, "nav.pdf")
print("made layers.pdf, form_plain.pdf, nav.pdf")
