# pdfhand.py -- hand-written PDF pages for review 3 (pikepdf): a page is its drawing program and its resources, written
# here byte for byte, so the test controls every operator (Tm skews, Ts, Tc, one letter a Tj, nested forms, Symbol and
# ZapfDingbats named with no encoding, WinAnsi's spare codes, ToUnicode maps with decomposed letters and ligatures).
import pikepdf
from pikepdf import Name, Dictionary, Array, Stream

def std_font(pdf, base, enc="/WinAnsiEncoding", diffs=None, tounicode=None, widths=None, first=32):
    d = Dictionary(Type=Name.Font, Subtype=Name.Type1, BaseFont=Name("/" + base))
    if diffs is not None:
        e = Dictionary(Type=Name.Encoding, Differences=Array(diffs))
        if enc: e.BaseEncoding = Name(enc)
        d.Encoding = e
    elif enc:
        d.Encoding = Name(enc)
    if tounicode:
        d.ToUnicode = Stream(pdf, tounicode.encode("latin-1"))
    if widths:
        d.FirstChar = first; d.LastChar = first + len(widths) - 1; d.Widths = Array(widths)
    return pdf.make_indirect(d)

def cmap(pairs, two=False):
    """a ToUnicode CMap: pairs [(code, unicode string)]"""
    def hx(s):
        b = s.encode("utf-16-be"); return b.hex().upper()
    body = "\n".join("<%s> <%s>" % (("%04X" if two else "%02X") % c, hx(u)) for c, u in pairs)
    return ("/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n"
            "/CMapName /R3 def\n/CMapType 2 def\n1 begincodespacerange\n<%s> <%s>\nendcodespacerange\n%d beginbfchar\n%s\nendbfchar\nendcmap\n"
            "CMapName currentdict /CMap defineresource pop\nend\nend\n") % ("0000" if two else "00", "FFFF" if two else "FF", len(pairs), body)

def form(pdf, content, res, bbox=(0, 0, 612, 792), matrix=None):
    s = Stream(pdf, content.encode("latin-1") if isinstance(content, str) else content)
    s.Type = Name.XObject; s.Subtype = Name.Form; s.BBox = Array(list(bbox)); s.Resources = res
    if matrix: s.Matrix = Array(list(matrix))
    return pdf.make_indirect(s)

def page(pdf, content, res, size=(612, 792), rotate=0, crop=None):
    p = pikepdf.Page(Dictionary(Type=Name.Page, MediaBox=Array([0, 0, size[0], size[1]]), Resources=res,
                                Contents=Stream(pdf, content.encode("latin-1") if isinstance(content, str) else content)))
    if rotate: p.obj.Rotate = rotate
    if crop: p.obj.CropBox = Array(list(crop))
    pdf.pages.append(p)
    return p

def lit(s):
    """a PDF string literal from a latin-1 str"""
    o = "("
    for ch in s:
        c = ord(ch)
        if ch in "()\\": o += "\\" + ch
        elif c < 32 or c > 126: o += "\\%03o" % c
        else: o += ch
    return o + ")"

# Adobe Helvetica widths for placing letters one at a time (thousandths)
from reportlab.pdfbase.pdfmetrics import stringWidth
def w(s, font="Helvetica", size=10): return stringWidth(s, font, size)

def spaced(x, y, text, size, ls, font="/F1", fname="Helvetica", tj_space=False):
    """letters drawn one at a time, each its own Tm, letter-spacing ls (em) after each, as Chromium prints CSS letter-spacing;
    a space is not drawn (its advance and the spacing are)"""
    out = []
    for ch in text:
        if ch == " ":
            if tj_space: out.append("BT %s %g Tf 1 0 0 1 %.3f %.3f Tm ( ) Tj ET" % (font, size, x, y))
            x += w(" ", fname, size) + ls * size; continue
        out.append("BT %s %g Tf 1 0 0 1 %.3f %.3f Tm %s Tj ET" % (font, size, x, y, lit(ch)))
        x += w(ch, fname, size) + ls * size
    return "\n".join(out), x
