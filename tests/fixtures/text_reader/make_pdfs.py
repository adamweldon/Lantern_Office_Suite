# make_pdfs.py -- the PDFs PDF_DRAW is tested on (Lantern 1.22.6): pages made on a computer, with no picture in them -- their
# words drawn in the fonts the PDFs carry. Each font kind a PDF can carry: TrueType (simple and CID-keyed), Type 1, CFF
# (Type 1C) and Type 3, and one of the standard fonts no PDF carries; lines, shapes and dashes too.
# Usage: python3 tests/fixtures/text_reader/make_pdfs.py   (needs reportlab, fonttools and playwright with Chromium; writes
#        fonts_tt_t1.pdf, fonts_cff.pdf and fonts_web.pdf here). The fonts are free to share inside documents: DejaVu Serif and
#        Sans (Bitstream Vera licence), Bitstream Charter, Latin Modern (GUST font licence), Inter (SIL Open Font Licence).
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import EmbeddedType1Face, Font
pdfmetrics.registerFont(TTFont("DJ", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"))
T1 = "/usr/share/fonts/type1/texlive-fonts-recommended/"
face = EmbeddedType1Face(T1 + "bchr8a.afm", T1 + "bchr8a.pfb"); pdfmetrics.registerTypeFace(face)
pdfmetrics.registerFont(Font("Charter", face.name, "WinAnsiEncoding"))
c = canvas.Canvas(os.path.join(HERE, "fonts_tt_t1.pdf"), pagesize=(612, 400))
c.setFont("DJ", 28); c.drawString(40, 340, "TrueType: quick brown foxes 0123")
c.setFont("Charter", 28); c.drawString(40, 290, "Type 1: jumps over the lazy dog")
c.setFont("Helvetica", 24); c.drawString(40, 240, "Standard Helvetica, not embedded")
c.setLineWidth(2); c.line(40, 220, 560, 220)
c.setFillColorRGB(0.8, 0.1, 0.1); c.rect(40, 120, 120, 80, fill=1, stroke=0)
c.setStrokeColorRGB(0, 0, 0.7); c.setLineWidth(4); c.circle(300, 160, 40, stroke=1, fill=0)
c.setDash(6, 3); c.line(380, 160, 560, 160)
c.save()
# CFF (Type 1C): Latin Modern's outlines, cut to the letters used, in a PDF written here
from fontTools.ttLib import TTFont as FT
from fontTools import subset
f = FT("/usr/share/texmf/fonts/opentype/public/lm/lmroman10-regular.otf")
opts = subset.Options(); opts.glyph_names = True; opts.notdef_outline = True
TEXT = "CFF Type 1C: waltz, bad nymph, for quick jigs vex 0123"
s = subset.Subsetter(opts); s.populate(text=TEXT); s.subset(f)
buf = io.BytesIO(); f.save(buf); f2 = FT(io.BytesIO(buf.getvalue()))
cff = f2.getTableData("CFF "); cmap = f2.getBestCmap(); hm = f2["hmtx"].metrics; upm = f2["head"].unitsPerEm
widths = [int(hm[cmap[c]][0] * 1000 / upm) if c in cmap else 0 for c in range(32, 127)]
objs = []
def obj(b): objs.append(b); return len(objs)
ff = obj(b"<< /Subtype /Type1C /Length %d >>\nstream\n" % len(cff) + cff + b"\nendstream")
fd = obj(b"<< /Type /FontDescriptor /FontName /LMRoman10-Regular /Flags 32 /FontBBox [-430 -290 1417 1127] /ItalicAngle 0 /Ascent 1127 /Descent -290 /CapHeight 683 /StemV 80 /FontFile3 %d 0 R >>" % ff)
fn = obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /LMRoman10-Regular /FirstChar 32 /LastChar 126 /Widths [" + b" ".join(str(w).encode() for w in widths) + b"] /Encoding /WinAnsiEncoding /FontDescriptor %d 0 R >>" % fd)
body = ("BT /F1 30 Tf 40 330 Td (%s) Tj ET 2 w 40 300 m 560 300 l S" % TEXT).encode()
cs = obj(b"<< /Length %d >>\nstream\n" % len(body) + body + b"\nendstream")
pg = obj(b"<< /Type /Page /Parent 6 0 R /MediaBox [0 0 900 400] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>" % (fn, cs))
pages = obj(b"<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg); cat = obj(b"<< /Type /Catalog /Pages %d 0 R >>" % pages)
out = io.BytesIO(); out.write(b"%PDF-1.4\n"); offs = []
for i, o in enumerate(objs): offs.append(out.tell()); out.write(b"%d 0 obj\n" % (i + 1) + o + b"\nendobj\n")
x = out.tell(); out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1))
for o in offs: out.write(b"%010d 00000 n \n" % o)
out.write(b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, cat, x))
open(os.path.join(HERE, "fonts_cff.pdf"), "wb").write(out.getvalue())
# Chromium's own PDF: CFF fonts become Type 3 fonts (each letter a little drawing), TrueType ones CID-keyed
html = """<html><head><style>
@font-face { font-family: LM; src: url("file:///usr/share/texmf/fonts/opentype/public/lm/lmroman10-regular.otf"); }
@font-face { font-family: IN; src: url("file:///usr/share/fonts/opentype/inter/Inter-Regular.otf"); }
body { margin: 40px; } .a { font: 34px LM; } .b { font: 30px IN; } .c { font: 30px 'DejaVu Sans'; }
</style></head><body><div class=a>Type 3 letters: waltz, bad nymph</div><div class=b>Type 3 again: for quick jigs vex</div><div class=c>CID TrueType: sphinx of black quartz</div>
<svg width="500" height="120"><path d="M10 60 C 60 0, 120 120, 200 60 S 300 0, 400 60" stroke="black" fill="none" stroke-width="3"/><rect x="420" y="20" width="60" height="60" fill="#36c"/></svg></body></html>"""
open(os.path.join(HERE, "_web.html"), "w").write(html)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg2 = b.new_page()
    pg2.goto("file://" + os.path.join(HERE, "_web.html")); pg2.wait_for_timeout(500)
    pg2.pdf(path=os.path.join(HERE, "fonts_web.pdf"), width="8.5in", height="4in")
    b.close()
os.remove(os.path.join(HERE, "_web.html"))
