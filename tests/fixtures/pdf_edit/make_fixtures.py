# make_fixtures.py -- the PDFs tests/browser/pdf_tile_e2e.py changes (1.24.40), besides tests/fixtures/pdf_open:
#   hidden.pdf   plain.pdf with the things "Remove hidden" takes out: details naming "Secret Person", an XMP record,
#                a document script, a script run when page 1 opens, an attached file, and a typed comment
#   rev_a.pdf, rev_b.pdf   two versions of a drawing for Compare: one word changed, one box moved 40 pt, page 2 the same
#   nameplate.jpg          a photo-like picture to combine as a page (800 x 600)
#   shows.pdf              a page whose words are shown every way a PDF shows them (Tj, TJ with spacing, ' and "),
#                          and two columns on one line, for Edit text (written byte by byte)
#   table.pdf              a spare-parts table (four columns, a header row, commas inside cells) between two lines of prose
# Usage: python3 make_fixtures.py   (reportlab, pypdf, Pillow)
import os
from pypdf import PdfWriter, PdfReader
from pypdf.generic import NameObject, DictionaryObject, TextStringObject, DecodedStreamObject
from pypdf.annotations import FreeText
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
r = PdfReader(os.path.join(HERE, "..", "pdf_open", "plain.pdf"))
w = PdfWriter()
for p in r.pages: w.add_page(p)
w.add_metadata({"/Author": "Secret Person", "/Title": "Pump notes"})
w.add_js("app.alert('hello from a script');")
w.add_attachment("secret.txt", b"secret attached notes")
js = DictionaryObject({NameObject("/S"): NameObject("/JavaScript"), NameObject("/JS"): TextStringObject("app.alert('page opened');")})
w.pages[0][NameObject("/AA")] = DictionaryObject({NameObject("/O"): w._add_object(js)})
xmp = DecodedStreamObject(); xmp.set_data(b'<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Secret Person</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>')
xmp.update({NameObject("/Type"): NameObject("/Metadata"), NameObject("/Subtype"): NameObject("/XML")})
w._root_object[NameObject("/Metadata")] = w._add_object(xmp)
w.add_annotation(0, FreeText(text="REVIEWED BY SECRET PERSON", rect=(300, 500, 500, 540)))
w.write(os.path.join(HERE, "hidden.pdf"))
for name, word, bx in [("rev_a.pdf", "overload", 100), ("rev_b.pdf", "thermal", 140)]:
    c = canvas.Canvas(os.path.join(HERE, name), pagesize=(612, 792))
    c.setFont("Helvetica-Bold", 20); c.drawString(72, 700, "Pump P-101 wiring")
    c.setFont("Helvetica", 12); c.drawString(72, 670, "Check the motor %s before reset." % word)
    c.rect(bx, 300, 150, 100); c.line(72, 650, 540, 650)
    c.showPage()
    c.setFont("Helvetica", 12); c.drawString(72, 700, "Page two is the same in both.")
    c.save()
im = Image.new("RGB", (800, 600), "white"); d = ImageDraw.Draw(im); d.rectangle((100, 100, 700, 500), outline="black", width=6); d.text((300, 280), "NAMEPLATE 480V 3PH", fill="black")
im.save(os.path.join(HERE, "nameplate.jpg"), quality=90)
import zlib
content = b"""BT /F1 12 Tf 72 700 Td (Torque the flange bolts to 45 Nm.) Tj ET
BT /F1 12 Tf 72 680 Td [(Pres) 20 (sure) -250 (test) 30 (ed)] TJ ( at 6 bar.) Tj ET
BT /F1 12 Tf 14 TL 72 640 Td (First line) Tj (Second line) ' 2 0 (Third line) " ET
BT /F1 12 Tf 72 560 Td (Left column words) Tj 300 0 Td (Right column words) Tj ET
BT /F1 12 Tf 72 520 Td (Kept as it is.) Tj ET
"""
z = zlib.compress(content)
objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
 b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
 b"<< /Length %d /Filter /FlateDecode >>\nstream\n" % len(z) + z + b"\nendstream",
 b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"]
out = b"%PDF-1.4\n"; offs = []
for i, o in enumerate(objs):
    offs.append(len(out)); out += b"%d 0 obj\n" % (i + 1) + o + b"\nendobj\n"
x = len(out)
out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
open(os.path.join(HERE, "shows.pdf"), "wb").write(out)
c = canvas.Canvas(os.path.join(HERE, "table.pdf"), pagesize=(612, 792))
c.setFont("Helvetica-Bold", 14); c.drawString(72, 740, "Spare parts list")
c.setFont("Helvetica", 11); c.drawString(72, 715, "Order these parts from the maker, quoting the pump's serial number.")
rows = [("Item", "Part number", "Description", "Qty"), ("1", "PX-101-04", "Mechanical seal, 35 mm", "2"), ("2", "PX-101-11", "Impeller, bronze", "1"), ("3", "BRG-6206", "Bearing, ball, sealed", "4"), ("4", "GSK-220", "Gasket set, casing", "1")]
y = 680
for r in rows:
    for x, t in zip((72, 120, 230, 470), r): c.drawString(x, y, t)
    y -= 18
c.drawString(72, y - 20, "Check every part on arrival against this list before signing for it.")
c.save()
print("made")
