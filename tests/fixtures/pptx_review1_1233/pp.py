# pp.py -- helpers for make_decks.py (review 1 of 1.24.33's PowerPoint files): python-pptx decks, hand edits of their
# parts, and packages written by hand the way other programs write them.
import io, re, zipfile
from lxml import etree
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.oxml.ns import qn
from PIL import Image

A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

def img(w, h, rgb, fmt="PNG", **kw):
    b = io.BytesIO(); Image.new("RGB", (w, h), rgb).save(b, fmt, **kw); return b.getvalue()

def new_prs(wide=False):
    p = Presentation()
    if wide: p.slide_width = Inches(13.333)
    return p

def slide(p, layout, title=None):
    s = p.slides.add_slide(p.slide_layouts[layout])
    if title is not None and s.shapes.title is not None: s.shapes.title.text = title
    return s

def para_set(tf, items, first=True):
    """items: list of (text | [runs], lvl) or str; a run is str or dict(t=, b=, i=, u=, link=, base=, strike=)"""
    for k, it in enumerate(items):
        if isinstance(it, str): it = (it, 0)
        text, lvl = it[0], it[1]
        p = tf.paragraphs[0] if (k == 0 and first) else tf.add_paragraph()
        p.level = lvl
        if isinstance(text, str): p.text = text
        else:
            for r in text:
                if isinstance(r, str): r = {"t": r}
                if r.get("br"): p._p.add_br(); continue
                run = p.add_run(); run.text = r["t"]
                if r.get("b"): run.font.bold = True
                if r.get("i"): run.font.italic = True
                if r.get("u"): run.font.underline = True
                if r.get("link"): run.hyperlink.address = r["link"]
                if r.get("base"): run._r.get_or_add_rPr().set("baseline", str(r["base"]))
                if r.get("strike"): run._r.get_or_add_rPr().set("strike", "sngStrike")
                if r.get("cap"): run._r.get_or_add_rPr().set("cap", r["cap"])
        if len(it) > 2 and it[2]: bu(p, **it[2])
    return tf

def bu(p, char=None, auto=None, start=None, none=False, marL=None, indent=None, rtl=None, algn=None):
    pPr = p._p.get_or_add_pPr()
    if marL is not None: pPr.set("marL", str(marL))
    if indent is not None: pPr.set("indent", str(indent))
    if rtl: pPr.set("rtl", "1")
    if algn: pPr.set("algn", algn)
    for c in list(pPr):
        if etree.QName(c).localname in ("buNone", "buChar", "buAutoNum", "buFont"): pPr.remove(c)
    if none: etree.SubElement(pPr, qn("a:buNone"))
    if char:
        f = etree.SubElement(pPr, qn("a:buFont")); f.set("typeface", "Arial")
        e = etree.SubElement(pPr, qn("a:buChar")); e.set("char", char)
    if auto:
        f = etree.SubElement(pPr, qn("a:buFont")); f.set("typeface", "+mj-lt")
        e = etree.SubElement(pPr, qn("a:buAutoNum")); e.set("type", auto)
        if start: e.set("startAt", str(start))
    # the schema's order: defRPr after the bullet
    for c in list(pPr):
        if etree.QName(c).localname == "defRPr": pPr.remove(c); pPr.append(c)

def tbox(s, x, y, w, h, items):
    b = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    para_set(b.text_frame, items)
    return b

def save(p):
    b = io.BytesIO(); p.save(b); return b.getvalue()

def parts(data):
    z = zipfile.ZipFile(io.BytesIO(data)); return [(i, z.read(i.filename)) for i in z.infolist()]

def patch(data, edits=None, add=None, drop=(), order=None, descriptors=False, store=False):
    """edits: {name: f(str) -> str}; add: {name: bytes|str}; drop: names (or a function name -> bool); order: names first"""
    edits = edits or {}; add = dict(add or {})
    items = []
    for info, d in parts(data):
        n = info.filename
        if (callable(drop) and drop(n)) or (not callable(drop) and n in drop): continue
        if n in edits:
            d = edits[n](d.decode("utf-8"))
            d = d.encode("utf-8") if isinstance(d, str) else d
        if n in add: d = add.pop(n); d = d.encode("utf-8") if isinstance(d, str) else d
        items.append((n, d))
    for n, d in add.items(): items.append((n, d.encode("utf-8") if isinstance(d, str) else d))
    if order: items.sort(key=lambda it: (order.index(it[0]) if it[0] in order else len(order)))
    return write_zip(items, descriptors=descriptors, store=store)

class _NoSeek(io.RawIOBase):
    """a stream zipfile cannot seek in: it then writes each entry with a data descriptor, as Java's ZipOutputStream does"""
    def __init__(self): self.buf = bytearray()
    def writable(self): return True
    def write(self, b): self.buf += b; return len(b)
    def tell(self): return len(self.buf)
    def seekable(self): return False
    def flush(self): pass

def write_zip(items, descriptors=False, store=False):
    out = _NoSeek() if descriptors else io.BytesIO()
    z = zipfile.ZipFile(out, "w", zipfile.ZIP_STORED if store else zipfile.ZIP_DEFLATED)
    for n, d in items: z.writestr(n, d)
    z.close()
    return bytes(out.buf) if descriptors else out.getvalue()

def ct_default(xml, ext, ctype):
    if ('Extension="%s"' % ext) in xml: return xml
    return xml.replace("<Default ", '<Default Extension="%s" ContentType="%s"/><Default ' % (ext, ctype), 1)

def ct_override(xml, part, ctype):
    return xml.replace("</Types>", '<Override PartName="%s" ContentType="%s"/></Types>' % (part, ctype))

def add_rel(xml, rid, rtype, target, external=False):
    return xml.replace("</Relationships>", '<Relationship Id="%s" Type="%s" Target="%s"%s/></Relationships>' % (rid, rtype, target, ' TargetMode="External"' if external else ""))

RT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"

def into_ph(s, idx, shape, keep_xfrm=True):
    """puts a shape (a table, chart or picture added to the slide) into the content placeholder idx, as PowerPoint does
    when one clicks the placeholder's icon: the empty placeholder goes, the shape carries <p:ph idx=../>"""
    for ph in list(s.placeholders):
        if ph.placeholder_format.idx == idx and ph._element is not shape._element: ph._element.getparent().remove(ph._element)
    nvPr = shape._element.find(".//" + qn("p:nvPr"))
    e = etree.SubElement(nvPr, qn("p:ph")); e.set("idx", str(idx))
    nvPr.insert(0, e)
    if not keep_xfrm:
        x = shape._element.find(".//" + qn("a:xfrm"))
        if x is not None: x.getparent().remove(x)
    return shape
