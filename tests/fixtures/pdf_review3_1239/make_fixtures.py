# make_fixtures.py -- the third review's PDFs (1.24.39, after the second review's mends). Every file is a correct PDF a
# person could meet, unless its name says "damaged" in cases.json's group; each passes `qpdf --check` (run_review.py
# checks). Made byte by byte here (offsets counted), with reportlab 5.0.1, pypdf 6.17.0, pikepdf 10.16 / qpdf 11.9,
# PIL, and real makers: LibreOffice (soffice --convert-to pdf), cairo (rsvg-convert), pdfTeX, matplotlib.
#   python3 make_fixtures.py            (all groups)      python3 make_fixtures.py trailer hidden ...
import os, sys, zlib, io, json, subprocess, shutil, struct
HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.environ.get("REVIEW_SCRATCH", "/tmp/pdf_review3_scratch")
os.makedirs(SCRATCH, exist_ok=True)
def P(name): return os.path.join(HERE, name)

# ------------------------------------------------------------------ a PDF written by hand, with incremental sections
class Doc:
    def __init__(self, version="1.7"):
        self.b = bytearray(b"%PDF-" + version.encode() + b"\n%\xe2\xe3\xcf\xd3\n")
        self.offs = {}; self.pending = []; self.size = 1; self.prev = None; self.first = True
    def add(self, num, body, gen=0):
        if isinstance(body, str): body = body.encode("latin-1")
        self.offs[num] = (len(self.b), gen); self.size = max(self.size, num + 1); self.pending.append(num)
        self.b += b"%d %d obj\n" % (num, gen) + body + b"\nendobj\n"
        return num
    def stream(self, num, d, data, flate=False):
        if isinstance(d, str): d = d.encode("latin-1")
        if isinstance(data, str): data = data.encode("latin-1")
        if flate: data = zlib.compress(data); d += b" /Filter /FlateDecode"
        return self.add(num, b"<< " + d + b" /Length %d >>\nstream\n" % len(data) + data + b"\nendstream")
    def _subsections(self, nums):
        nums = sorted(nums); out = []; i = 0
        while i < len(nums):
            j = i
            while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1: j += 1
            out.append(nums[i:j + 1]); i = j + 1
        return out
    def xref(self, trailer, delta=0, startxref=True, eof=b"%%EOF\n"):
        # a classic cross-reference section for the objects written since the last one (object 0 in the first)
        off = len(self.b); nums = list(self.pending) + ([0] if self.first else [])
        s = b"xref\n"
        for sub in self._subsections(nums):
            s += b"%d %d\n" % (sub[0], len(sub))
            for n in sub: s += b"0000000000 65535 f\r\n" if n == 0 else b"%010d %05d n\r\n" % (self.offs[n][0], self.offs[n][1])
        if isinstance(trailer, str): trailer = trailer.encode("latin-1")
        trailer = trailer.replace(b"SIZE", b"%d" % self.size).replace(b"PREV", b"%d" % (self.prev or 0))
        self.b += s + b"trailer\n" + trailer + b"\n"
        if startxref: self.b += b"startxref\n%d\n" % (off + delta) + eof
        self.prev = off; self.pending = []; self.first = False
        return off
    def xrefstream(self, num, extra, delta=0, eof=b"%%EOF\n"):
        # a cross-reference stream (PDF 1.5) for the objects written since the last section, and itself
        off = len(self.b); self.offs[num] = (off, 0); self.size = max(self.size, num + 1)
        nums = list(self.pending) + [num] + ([0] if self.first else [])
        rows = b""; index = []
        for sub in self._subsections(nums):
            index += [sub[0], len(sub)]
            for n in sub: rows += struct.pack(">BIH", 0, 0, 65535) if n == 0 else struct.pack(">BIH", 1, self.offs[n][0], self.offs[n][1])
        if isinstance(extra, str): extra = extra.encode("latin-1")
        extra = extra.replace(b"SIZE", b"%d" % self.size).replace(b"PREV", b"%d" % (self.prev or 0))
        d = b"<< /Type /XRef /Size %d /Index [%s] /W [1 4 2] %s /Length %d >>" % (self.size, " ".join(map(str, index)).encode(), extra, len(rows))
        self.b += b"%d 0 obj\n" % num + d + b"\nstream\n" + rows + b"\nendstream\nendobj\n"
        self.b += b"startxref\n%d\n" % (off + delta) + eof
        self.prev = off; self.pending = []; self.first = False
        return off
    def write(self, name, prefix=b"", suffix=b""):
        open(P(name), "wb").write(prefix + bytes(self.b) + suffix)
        return name

COURIER = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /FirstChar 32 /LastChar 126 /Widths [%s] /Encoding /WinAnsiEncoding >>" % " ".join(["600"] * 95)
HELV = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
def page_text(lines, size=14, x=72, y=720, lead=22):
    s = "BT /F1 %d Tf %d %d Td %d TL " % (size, x, y, lead)
    for ln in lines: s += "(%s) Tj T* " % ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return s + "ET"

# =================================================================== 1. TRAILERS (PDF_PARSE: the last startxref's section)
def base_two_revs(d, info_in_rev2, rev2_kind="classic", root2=False):
    # revision 1: catalog 1, pages 2, page 3, content 4, Info 5 ("Old Title"), font 6, outline 7/8
    d.add(1, "<< /Type /Catalog /Pages 2 0 R /Outlines 7 0 R >>")
    d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>")
    d.stream(4, "", page_text(["Revision one page text: the pump station manual.", "Second line of the first revision."]))
    d.add(5, "<< /Title (Old Title) /Producer (hand) >>")
    d.add(6, COURIER)
    d.add(7, "<< /Type /Outlines /First 8 0 R /Last 8 0 R /Count 1 >>")
    d.add(8, "<< /Title (Rev1 Outline) /Parent 7 0 R /Dest [3 0 R /Fit] >>")
    d.xref("<< /Size SIZE /Root 1 0 R /Info 5 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>] >>")
    # revision 2: new page text (content 4 replaced), maybe a new catalog (9) with its own outline (10/11), Info dropped or new
    d.stream(4, "", page_text(["Revision two page text: the pump station manual, updated.", "Second line of the second revision."]))
    if root2:
        d.add(9, "<< /Type /Catalog /Pages 2 0 R /Outlines 10 0 R >>")
        d.add(10, "<< /Type /Outlines /First 11 0 R /Last 11 0 R /Count 1 >>")
        d.add(11, "<< /Title (Rev2 Outline) /Parent 10 0 R /Dest [3 0 R /Fit] >>")
    if info_in_rev2: d.add(12, "<< /Title (New Title) >>")
    return "/Root %d 0 R %s /Prev PREV /ID [<00112233445566778899aabbccddeeff> <ffeeddccbbaa99887766554433221100>]" % (9 if root2 else 1, "/Info 12 0 R" if info_in_rev2 else "")

def trailers():
    made = []
    # 1a. a classic file, updated with a classic section that drops /Info and names a new catalog; startxref exact or off by a few
    for tag, delta in [("exact", 0), ("m1", -1), ("p1", 1), ("m2", -2), ("p2", 2), ("m7", -7), ("p7", 7), ("m15", -15), ("p15", 15), ("p19", 19), ("m19", -19)]:
        d = Doc(); t = base_two_revs(d, False, root2=True)
        d.xref("<< /Size SIZE %s >>" % t, delta=delta)
        made.append(d.write("tr_cls_dropinfo_%s.pdf" % tag))
    # 1b. the same, off by more than the window (damaged): read whole-file as a damaged file (informational)
    for tag, delta in [("p40", 40), ("m60", -60)]:
        d = Doc(); t = base_two_revs(d, False, root2=True)
        d.xref("<< /Size SIZE %s >>" % t, delta=delta)
        made.append(d.write("tr_cls_dropinfo_%s.pdf" % tag))
    # 1c. the update as a cross-reference STREAM (object 123, a three-digit number), off by a few into its number
    for tag, delta in [("exact", 0), ("p1", 1), ("p2", 2), ("m1", -1), ("m3", -3), ("p5", 5)]:
        d = Doc(); t = base_two_revs(d, False, root2=True)
        d.xrefstream(123, t, delta=delta)
        made.append(d.write("tr_xs_dropinfo_%s.pdf" % tag))
    # 1d. update keeps a new Info (title must be the new one)
    d = Doc(); t = base_two_revs(d, True); d.xref("<< /Size SIZE %s >>" % t); made.append(d.write("tr_cls_newinfo.pdf"))
    d = Doc(); t = base_two_revs(d, True); d.xrefstream(123, t); made.append(d.write("tr_xs_newinfo.pdf"))
    # 1e. junk before %PDF (a mail or web header saved with it): 12 bytes (in the window) and 300 bytes (beyond)
    for tag, junk in [("12", b"X-Junk: 1234"), ("300", (b"Content-Type: application/pdf\r\nContent-Disposition: attachment; filename=manual.pdf\r\n" * 4)[:298] + b"\r\n")]:
        d = Doc(); t = base_two_revs(d, False, root2=True); d.xref("<< /Size SIZE %s >>" % t)
        made.append(d.write("tr_prefix%s_dropinfo.pdf" % tag, prefix=junk))
        d = Doc(); base_single(d); made.append(d.write("tr_prefix%s_single.pdf" % tag, prefix=junk))
    # 1f. garbage after %%EOF: NULs, a mail footer, a dummy "startxref 0 %%EOF" (as a linearized first part ends)
    for tag, junk in [("nuls", b"\x00" * 2048), ("mime", b"\r\n------=_Part_1234--\r\n\r\n"), ("dummyxref", b"startxref\n0\n%%EOF\n")]:
        d = Doc(); t = base_two_revs(d, False, root2=True); d.xref("<< /Size SIZE %s >>" % t)
        made.append(d.write("tr_tail_%s_dropinfo.pdf" % tag, suffix=junk))
    # 1g. a startxref that names the FIRST revision's table (a writer that copied the old number; qpdf follows it)
    d = Doc(); t = base_two_revs(d, False, root2=True); first = d.prev; d.xref("<< /Size SIZE %s >>" % t, delta=0)
    s = bytes(d.b); k = s.rfind(b"startxref\n"); s = s[:k] + b"startxref\n%d\n%%%%EOF\n" % first
    open(P("tr_startxref_oldtable.pdf"), "wb").write(s); made.append("tr_startxref_oldtable.pdf")
    # 1h. a hybrid file (classic table + /XRefStm), updated with a classic section that drops /Info
    d = Doc(); base_hybrid_update(d); made.append(d.write("tr_hybrid_upd_dropinfo.pdf"))
    # 1i. two PDFs one after the other (a download glued twice, or `cat a.pdf b.pdf`): damaged, informational
    a = Doc(); base_single(a, title="Alpha Manual", text="Document A page"); b = Doc(); base_single(b, title=None, text="Document B page", xs=True)
    open(P("tr_concat_ab.pdf"), "wb").write(bytes(a.b) + bytes(b.b)); made.append("tr_concat_ab.pdf")
    open(P("tr_concat_aa.pdf"), "wb").write(bytes(a.b) + bytes(a.b)); made.append("tr_concat_aa.pdf")
    # 1j. page text that shows the words (uncompressed): "startxref", "trailer", "/Encrypt", near the end of the file
    d = Doc()
    d.add(1, "<< /Type /Catalog /Pages 2 0 R >>"); d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>")
    d.add(6, COURIER); d.add(5, "<< /Title (PDF Lesson Two) >>")
    d.xref("<< /Size SIZE /Root 1 0 R /Info 5 0 R >>")
    d.stream(4, "", page_text(["How a PDF ends: the last lines are", "trailer << /Size 9 /Root 1 0 R /Encrypt 7 0 R >>", "startxref", "0", "%%EOF", "and a lock is named by /Encrypt in it."]))
    d.xref("<< /Size SIZE /Root 1 0 R /Info 5 0 R /Prev PREV >>")
    made.append(d.write("tr_lesson_words_in_update.pdf"))
    # 1k. a linearized file (qpdf) then updated with a cross-reference stream that drops /Info and adds a page line
    d = Doc(); base_single(d, title="Linear Base", text="Linearized base page"); d.write("_lin_src.pdf")
    subprocess.run(["qpdf", "--linearize", P("_lin_src.pdf"), P("_lin.pdf")], check=True)
    lin = open(P("_lin.pdf"), "rb").read()
    made.append(lin_update(lin, "tr_lin_upd_dropinfo.pdf"))
    for f in ("_lin_src.pdf", "_lin.pdf"): os.remove(P(f))
    # 1l. an xref-stream file with no /Info (PDF 2.0 style) carrying, unpacked, an attached classic PDF whose trailer says /Info 5 0 R
    inner = Doc(); base_single(inner, title="Inner Attachment Title", text="Inner page")
    ib = bytes(inner.b)
    d = Doc()
    d.add(1, "<< /Type /Catalog /Pages 2 0 R /Outlines 4 0 R /Names << /EmbeddedFiles << /Names [(inner.pdf) 9 0 R] >> >> >>")
    d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>")
    d.add(4, "<< /Type /Outlines /First 5 0 R /Last 5 0 R /Count 1 >>")
    d.add(5, "<< /Title (Chapter One) /Parent 4 0 R /Dest [3 0 R /Fit] >>")
    d.stream(6, "", page_text(["Binder page: the manual is attached."])); d.add(7, COURIER)
    d.stream(8, "/Type /EmbeddedFile /Subtype /application#2Fpdf", ib)
    d.add(9, "<< /Type /Filespec /F (inner.pdf) /UF (inner.pdf) /EF << /F 8 0 R >> >>")
    d.xrefstream(10, "/Root 1 0 R")
    made.append(d.write("tr_xs_noinfo_attached_pdf.pdf"))
    return made

def base_single(d, title="Single Title", text="Single revision page", xs=False):
    d.add(1, "<< /Type /Catalog /Pages 2 0 R >>"); d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>")
    d.stream(4, "", page_text([text]))
    d.add(6, COURIER)
    if title: d.add(5, "<< /Title (%s) >>" % title)
    if xs: d.xrefstream(7, "/Root 1 0 R" + (" /Info 5 0 R" if title else ""))
    else: d.xref("<< /Size SIZE /Root 1 0 R %s >>" % ("/Info 5 0 R" if title else ""))

def base_hybrid_update(d):
    # revision 1: hybrid -- the Info (5) and an outline item live in an object stream (20) named only by the
    # cross-reference stream (21) that the classic trailer's /XRefStm points to
    d.add(1, "<< /Type /Catalog /Pages 2 0 R >>"); d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>")
    d.stream(4, "", page_text(["Hybrid file page, revision one"])); d.add(6, COURIER)
    objs = b"<< /Title (Hybrid Old Title) >>"; head = b"5 0 "; first = len(head)
    d.stream(20, "/Type /ObjStm /N 1 /First %d" % first, head + objs)
    xs_off = len(d.b)
    rows = struct.pack(">BIH", 2, 20, 0)
    d.offs[21] = (xs_off, 0); d.size = 22
    d.b += b"21 0 obj\n<< /Type /XRef /Size 22 /Index [5 1] /W [1 4 2] /Length %d >>\nstream\n" % len(rows) + rows + b"\nendstream\nendobj\n"
    d.pending = [n for n in d.pending] + [21]
    d.xref("<< /Size SIZE /Root 1 0 R /Info 5 0 R /XRefStm %d >>" % xs_off)
    d.stream(4, "", page_text(["Hybrid file page, revision two"]))
    d.xref("<< /Size SIZE /Root 1 0 R /Prev PREV /XRefStm %d >>" % xs_off)

def lin_update(lin, name):
    # an incremental update after a linearized file: new content for its page, a cross-reference stream, no /Info
    import pikepdf
    with pikepdf.open(io.BytesIO(lin)) as pdf:
        root = pdf.trailer.Root.objgen[0]; page = pdf.pages[0].obj; pnum = page.objgen[0]; size = int(pdf.trailer.Size)
        cont = page.Contents.objgen[0]; font = page.Resources.Font.F1.objgen[0]; parent = page.Parent.objgen[0]
        idv = pdf.trailer.ID
    sx = lin.rfind(b"startxref"); prev = int(lin[sx + 9:].split()[0])
    d = Doc(); d.b = bytearray(lin); d.first = False; d.size = size; d.prev = prev
    newc = size; d.stream(newc, "", "BT /F1 14 Tf 72 600 Td (Update after linearizing) Tj ET")
    d.add(pnum, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents [%d 0 R %d 0 R] /Resources << /Font << /F1 %d 0 R >> >> >>" % (parent, cont, newc, font))
    d.xrefstream(size + 1, "/Root %d 0 R /Prev PREV /ID [<%s> <%s>]" % (root, bytes(idv[0]).hex(), bytes(idv[1]).hex()))
    return d.write(name)


# =================================================================== 2. HIDDEN PARTS (optional content, PDF_DRAW / PDF_TEXT)
T3FONT = ("<< /Type /Font /Subtype /Type3 /FontBBox [0 0 1000 1000] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << /sq %d 0 R >> "
          "/Encoding << /Type /Encoding /Differences [97 /sq] >> /FirstChar 97 /LastChar 97 /Widths [1000] /Resources << >> >>")
def hidden():
    d = Doc()
    pages = []
    OC = "/OCProperties << /OCGs [10 0 R 11 0 R] /D << /ON [11 0 R] /OFF [10 0 R] /Order [10 0 R 11 0 R] >> >>"
    d.add(10, "<< /Type /OCG /Name (Hidden Layer) >>"); d.add(11, "<< /Type /OCG /Name (Shown Layer) >>")
    d.add(12, COURIER); d.stream(13, "", "1000 0 0 0 1000 1000 d1 0 0 1000 1000 re f"); d.add(14, T3FONT % 13)
    d.stream(15, "/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8", b"\x00\x00\x00\x00")
    RES = "<< /Font << /F1 12 0 R /T3 14 0 R >> /XObject << /Im1 15 0 R /FmA 40 0 R /FmD 43 0 R /FmC 44 0 R /FmU 45 0 R >> /Properties << /off 10 0 R /on 11 0 R /pgoff 10 0 R >> >>"
    progs = [
        # p1: one text object running through a hidden part: Tj, TJ with kerning, the quote operator
        "BT /F1 20 Tf 50 700 Td (AAAA) Tj /OC /off BDC (BBBBBBBB) Tj EMC (CCCC) Tj ET\n"
        "BT /F1 20 Tf 50 600 Td [(DD) -1000 (DD)] TJ /OC /off BDC [(EE) -1000 (EE)] TJ EMC (FF) Tj ET\n"
        "BT /F1 20 Tf 24 TL 50 500 Td (GG) Tj /OC /off BDC (HH) ' EMC (II) Tj ET",
        # p2: a Type 3 font (each letter a little drawing): two squares hidden between two shown
        "BT /T3 20 Tf 50 700 Td (a) Tj /OC /off BDC (aa) Tj EMC (a) Tj ET",
        # p3: a clip set inside a hidden part and ended by a Q outside it
        "q /OC /off BDC 0 0 100 100 re W n EMC 1 0 0 rg 200 600 100 100 re f Q 0 0 1 rg 200 400 100 100 re f",
        # p4: q and Q inside a hidden part, the clip ending with them
        "/OC /off BDC q 0 0 100 100 re W n Q EMC 1 0 0 rg 200 600 100 100 re f",
        # p5: the picture's placing (cm) inside a hidden part, the picture drawn after it
        "q /OC /off BDC 100 0 0 100 200 600 cm EMC /Im1 Do Q",
        # p6: the colour set inside a hidden part, the box filled after it
        "/OC /off BDC 1 0 0 rg EMC 200 600 100 100 re f",
        # p7: the text position set inside a hidden part
        "BT /F1 20 Tf /OC /off BDC 300 600 Td EMC (XX) Tj ET",
        # p8: forms: a shown form holding a hidden one; a form in a hidden part; a shown form with a hidden part; a form
        # whose hidden part is never closed, then a box after it on the page
        "/FmA Do /OC /off BDC /FmD Do EMC /FmC Do /FmU Do 0 0 1 rg 300 200 50 50 re f",
        # p9: annotations whose own drawings have hidden parts (see Annots)
        "BT /F1 12 Tf 50 750 Td (Annotations with hidden parts in their drawings) Tj ET",
        # p10: the page ends inside a hidden part; an annotation must still be drawn
        "0 0 1 rg 50 600 50 50 re f /OC /off BDC 1 0 0 rg 200 600 50 50 re f",
    ]
    # forms of page 8
    d.stream(41, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /OC 10 0 R", "1 0 0 rg 200 600 50 50 re f")
    d.stream(40, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /XObject << /FmB 41 0 R >> >>", "/FmB Do 0 1 0 rg 50 600 50 50 re f")
    d.stream(42, "/Type /XObject /Subtype /Form /BBox [0 0 612 792]", "0 0 0 rg 200 450 50 50 re f")
    d.stream(43, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /XObject << /FmE 42 0 R >> >>", "0 0 0 rg 200 400 40 40 re f /FmE Do")
    d.stream(44, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /OC 11 0 R /Resources << /Properties << /h 10 0 R >> >>", "0 0 1 rg 400 600 50 50 re f /OC /h BDC 1 0 0 rg 400 400 50 50 re f EMC")
    d.stream(45, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /Properties << /h 10 0 R >> >>", "0 1 0 rg 50 300 50 50 re f /OC /h BDC 1 0 0 rg 150 300 50 50 re f")
    # annotation drawings (page 9 and 10)
    d.stream(50, "/Type /XObject /Subtype /Form /BBox [0 0 100 50] /Resources << /Properties << /oc1 10 0 R >> >>", "1 0 0 rg 0 0 50 50 re f /OC /oc1 BDC 0 0 1 rg 50 0 50 50 re f EMC")
    d.stream(51, "/Type /XObject /Subtype /Form /BBox [0 0 100 50]", "/OC /pgoff BDC 0 1 0 rg 0 0 100 50 re f EMC")
    d.stream(52, "/Type /XObject /Subtype /Form /BBox [0 0 100 50] /Resources << /Properties << /oc1 10 0 R >> >>", "0 0 0 rg 0 0 20 50 re f /OC /oc1 BDC 0 0 1 rg 20 0 80 50 re f")
    d.stream(53, "/Type /XObject /Subtype /Form /BBox [0 0 80 50]", "1 0 0 rg 0 0 80 50 re f")
    d.stream(54, "/Type /XObject /Subtype /Form /BBox [0 0 80 50]", "0 1 0 rg 0 0 80 50 re f")
    d.add(60, "<< /Type /Annot /Subtype /Stamp /Rect [50 600 150 650] /F 4 /AP << /N 50 0 R >> >>")
    d.add(61, "<< /Type /Annot /Subtype /Square /Rect [200 600 300 650] /F 4 /AP << /N 51 0 R >> >>")
    d.add(62, "<< /Type /Annot /Subtype /Square /Rect [350 600 450 650] /F 4 /AP << /N 52 0 R >> >>")
    d.add(63, "<< /Type /Annot /Subtype /Square /Rect [480 600 560 650] /F 4 /AP << /N 53 0 R >> >>")
    d.add(64, "<< /Type /Annot /Subtype /Square /Rect [480 400 560 450] /F 4 /OC 10 0 R /AP << /N 53 0 R >> >>")
    d.add(65, "<< /Type /Annot /Subtype /Square /Rect [300 300 380 350] /F 4 /AP << /N 54 0 R >> >>")
    kids = []
    for k, prog in enumerate(progs):
        pn = 100 + 2 * k; cn = 101 + 2 * k
        annots = " /Annots [60 0 R 61 0 R 62 0 R 63 0 R 64 0 R]" if k == 8 else " /Annots [65 0 R]" if k == 9 else ""
        d.stream(cn, "", prog)
        d.add(pn, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources %s%s >>" % (cn, RES, annots)); kids.append(pn)
    d.add(1, "<< /Type /Catalog /Pages 2 0 R %s >>" % OC)
    d.add(2, "<< /Type /Pages /Kids [%s] /Count %d >>" % (" ".join("%d 0 R" % p for p in kids), len(kids)))
    d.xref("<< /Size SIZE /Root 1 0 R >>")
    made = [d.write("oc_parts.pdf")]
    # small pictures written inside the page's program (inline images, BI ... ID ... EI), shown and in a hidden part
    d = Doc(); d.add(10, "<< /Type /OCG /Name (Hidden Layer) >>")
    d.stream(5, "", b"q 100 0 0 100 50 600 cm BI /W 2 /H 2 /BPC 8 /CS /G ID \x00\x00\x00\x00 EI Q\n"
                    b"/OC /off BDC q 100 0 0 100 250 600 cm BI /W 2 /H 2 /BPC 8 /CS /G ID \x00\x00\x00\x00 EI Q EMC\n"
                    b"0 0 1 rg 450 600 100 100 re f")
    d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Properties << /off 10 0 R >> >> >>")
    d.add(1, "<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [10 0 R] /D << /OFF [10 0 R] >> >> >>"); d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.xref("<< /Size SIZE /Root 1 0 R >>"); made.append(d.write("inline_img.pdf"))
    return made

# =================================================================== 3. BLEND MODES, THE PAGE GROUP, CLEAN STATE, ALPHA
def blends():
    made = []
    GS = "<< /Type /ExtGState /BM /Screen >>"
    BAR = "0 g 0 600 612 100 re f "   # a black bar, y 600-700
    BOX = "/GS1 gs 0 0 1 rg 100 550 200 100 re f"   # a blue box in Screen, its top half over the bar, its bottom half over nothing
    d = Doc()
    d.add(10, GS)
    # p1: Screen in a form three deep (found); p2: four deep; p3: in a Type 3 font's resources; p4: in an annotation's drawing, three forms in
    def chain(first, n, inner):
        nums = list(range(first, first + n))
        for i, num in enumerate(nums):
            if i == n - 1: d.stream(num, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /ExtGState << /GS1 10 0 R >> >>", inner)
            else: d.stream(num, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /XObject << /Fm 0 R >> >>".replace("/Fm 0 R", "/Fm %d 0 R" % nums[i + 1]), "/Fm Do")
        return nums[0]
    f3 = chain(20, 3, BOX); f4 = chain(30, 4, BOX)
    d.stream(40, "", "1000 0 0 0 1000 1000 d1 /GS1 gs 0 0 1 rg 0 0 1000 1000 re f")
    d.add(41, "<< /Type /Font /Subtype /Type3 /FontBBox [0 0 1000 1000] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << /sq 40 0 R >> "
              "/Encoding << /Type /Encoding /Differences [97 /sq] >> /FirstChar 97 /LastChar 97 /Widths [1000] /Resources << /ExtGState << /GS1 10 0 R >> >> >>")
    a3 = chain(50, 3, "/GS1 gs 0 0 1 rg 100 550 200 100 re f")
    d.stream(55, "/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /XObject << /Fm %d 0 R >> >>" % a3, "/Fm Do")
    d.add(56, "<< /Type /Annot /Subtype /Stamp /Rect [0 0 612 792] /F 4 /AP << /N 55 0 R >> >>")
    progs = [(BAR + "/Fm Do", "/XObject << /Fm %d 0 R >>" % f3, ""), (BAR + "/Fm Do", "/XObject << /Fm %d 0 R >>" % f4, ""),
             (BAR + "BT /T3 100 Tf 100 550 Td (aa) Tj ET", "/Font << /T3 41 0 R >>", ""), (BAR, "", " /Annots [56 0 R]")]
    kids = []
    for k, (prog, res, extra) in enumerate(progs):
        d.stream(101 + 2 * k, "", prog)
        d.add(100 + 2 * k, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << %s >>%s >>" % (101 + 2 * k, res, extra)); kids.append(100 + 2 * k)
    d.add(1, "<< /Type /Catalog /Pages 2 0 R >>"); d.add(2, "<< /Type /Pages /Kids [%s] /Count %d >>" % (" ".join("%d 0 R" % p for p in kids), len(kids)))
    d.xref("<< /Size SIZE /Root 1 0 R >>"); made.append(d.write("blend_deep.pdf"))

    # state left by the page's drawing: an unclosed q after a clip (with and without a blend mode), a form whose q is never closed
    d = Doc()
    d.add(10, GS); d.add(11, COURIER)
    d.stream(20, "/Type /XObject /Subtype /Form /BBox [0 0 100 100]", "q 0 1 0 rg 0 0 50 50 re f")
    d.stream(21, "/Type /XObject /Subtype /Form /BBox [0 0 100 50]", "1 0 0 rg 0 0 100 50 re f")
    d.add(22, "<< /Type /Annot /Subtype /Square /Rect [400 600 500 650] /F 4 /AP << /N 21 0 R >> >>")
    progs = [("0 0 300 300 re W n q /GS1 gs 0 0 1 rg 100 100 100 100 re f", " /Annots [22 0 R]"),
             ("/Fm Do 1 0 0 rg 300 300 100 100 re f", ""),
             ("0 0 300 300 re W n q 0 0 1 rg 100 100 100 100 re f", " /Annots [22 0 R]")]
    kids = []
    for k, (prog, extra) in enumerate(progs):
        d.stream(101 + 2 * k, "", prog)
        gs = "/ExtGState << /GS1 10 0 R >> " if k == 0 else ""   # (only page 1 has a blend mode in its resources)
        d.add(100 + 2 * k, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << %s/XObject << /Fm 20 0 R >> >>%s >>" % (101 + 2 * k, gs, extra)); kids.append(100 + 2 * k)
    d.add(1, "<< /Type /Catalog /Pages 2 0 R >>"); d.add(2, "<< /Type /Pages /Kids [%s] /Count %d >>" % (" ".join("%d 0 R" % p for p in kids), len(kids)))
    d.xref("<< /Size SIZE /Root 1 0 R >>"); made.append(d.write("state_unbalanced.pdf"))

    # outlined words (Tr 1) and filled-and-outlined words (Tr 2) with a stroke see-through /CA 0.3, in an embedded font
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
    c = canvas.Canvas(P("stroke_alpha.pdf"), pagesize=(612, 792))
    for k, (mode, ca) in enumerate([(1, 0.3), (1, 1.0), (2, 0.3)]):
        c.saveState(); c.setStrokeAlpha(ca); c.setLineWidth(3); c.setStrokeColorRGB(0, 0, 0); c.setFillColorRGB(1, 1, 1)
        t = c.beginText(60, 650 - 150 * k); t.setFont("DejaVu", 60); t.setTextRenderMode(mode); t.textLine("OUTLINE"); c.drawText(t); c.restoreState()
    c.save(); made.append("stroke_alpha.pdf")
    return made

# =================================================================== 4. ORDINARY PDFs FROM REAL MAKERS (must draw as 1.24.38 did)
def ordinary():
    made = []
    tmp = os.path.join(SCRATCH, "ord"); os.makedirs(tmp, exist_ok=True)
    # pdfTeX: words, maths, a table, a TikZ drawing with see-through fills (no blend modes), bookmarks
    tex = r"""\documentclass{article}\usepackage{tikz}\usepackage{hyperref}\begin{document}
\section{Pump station}Lift station two: the wet well is cleaned every month. $Q = A\,v = \pi r^2 v$.
\begin{tabular}{|l|r|}\hline Pump & Hours\\\hline P1 & 1200\\ P2 & 1180\\\hline\end{tabular}
\begin{tikzpicture}\fill[blue,opacity=0.4](0,0) rectangle (3,2);\fill[red,fill opacity=0.5](1,1) circle (1);\draw[thick,dashed](0,0)--(4,3);\end{tikzpicture}
\section{Floats}High level float, low level float, alarm float.\end{document}"""
    open(os.path.join(tmp, "ord_pdftex.tex"), "w").write(tex)
    subprocess.run(["pdflatex", "-interaction=nonstopmode", "ord_pdftex.tex"], cwd=tmp, capture_output=True)
    subprocess.run(["pdflatex", "-interaction=nonstopmode", "ord_pdftex.tex"], cwd=tmp, capture_output=True)
    shutil.copy(os.path.join(tmp, "ord_pdftex.pdf"), P("ord_pdftex.pdf")); made.append("ord_pdftex.pdf")
    # pdfTeX with a TikZ blend mode (screen) on the page: the page is drawn on nothing, white put under
    tex2 = r"""\documentclass{article}\usepackage{tikz}\begin{document}Blend modes in TikZ.
\begin{tikzpicture}\fill[black](0,1) rectangle (8,2);\begin{scope}[blend mode=screen]\fill[blue](1,0) rectangle (4,1.5);\fill[green!70!black](5,0) rectangle (7,1.5);\end{scope}\end{tikzpicture}
\end{document}"""
    open(os.path.join(tmp, "ord_tikz_screen.tex"), "w").write(tex2)
    subprocess.run(["pdflatex", "-interaction=nonstopmode", "ord_tikz_screen.tex"], cwd=tmp, capture_output=True)
    shutil.copy(os.path.join(tmp, "ord_tikz_screen.pdf"), P("ord_tikz_screen.pdf")); made.append("ord_tikz_screen.pdf")
    # pdfTeX + ocgx2: a layer that is off, inside a line of words, and one that is on (two runs: ocgx2 needs them)
    tex3 = r"""\documentclass{article}\usepackage{ocgx2}\begin{document}
Before the layer \begin{ocg}{Answers}{ans}{0}SECRET ANSWER TEXT\end{ocg} after the layer, same line.

Second paragraph with a visible layer: \begin{ocg}{Shown}{shw}{1}SHOWN WORDS\end{ocg} end.
\end{document}"""
    open(os.path.join(tmp, "ord_pdftex_ocgx2.tex"), "w").write(tex3)
    for _ in range(2): subprocess.run(["pdflatex", "-interaction=nonstopmode", "ord_pdftex_ocgx2.tex"], cwd=tmp, capture_output=True)
    shutil.copy(os.path.join(tmp, "ord_pdftex_ocgx2.pdf"), P("ord_pdftex_ocgx2.pdf")); made.append("ord_pdftex_ocgx2.pdf")
    # matplotlib: Type 3 letters (its default), see-through patches, a line plot
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(6, 4)); ax.plot([0, 1, 2, 3], [3, 1, 2, 4], label="wet well level"); ax.bar([0.5, 1.5, 2.5], [1, 2, 1.5], alpha=0.4, color="orange")
    ax.set_title("Pump hours"); ax.legend(); fig.savefig(P("ord_matplotlib.pdf")); plt.close(fig); made.append("ord_matplotlib.pdf")
    # cairo (rsvg-convert): an SVG drawing with see-through groups (forms with transparency groups), no blend mode
    svg = """<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f4f4f4"/>
<g opacity="0.6"><rect x="20" y="20" width="200" height="120" fill="#2060c0"/><g opacity="0.7"><circle cx="200" cy="150" r="80" fill="#c04020"/></g></g>
<text x="30" y="280" font-family="DejaVu Sans" font-size="22">Valve chart, cairo</text></svg>"""
    open(os.path.join(tmp, "ord_cairo.svg"), "w").write(svg)
    subprocess.run(["rsvg-convert", "-f", "pdf", "-o", P("ord_cairo.pdf"), os.path.join(tmp, "ord_cairo.svg")], check=True); made.append("ord_cairo.pdf")
    # LibreOffice Writer: a manual page (words, a table, a picture)
    html = """<html><body><h1>Lift Station Two</h1><p>Check the floats every week. Clean the wet well every month.</p>
<table border="1"><tr><td>Pump</td><td>Hours</td></tr><tr><td>P1</td><td>1200</td></tr></table><p style="color:#a00">Warning: lock out both pumps first.</p></body></html>"""
    open(os.path.join(tmp, "ord_writer.html"), "w").write(html)
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf:writer_pdf_Export", "--outdir", tmp, os.path.join(tmp, "ord_writer.html")], capture_output=True, timeout=180)
    shutil.copy(os.path.join(tmp, "ord_writer.pdf"), P("ord_writer.pdf")); made.append("ord_writer.pdf")
    # LibreOffice Draw: shapes with see-through fills -- each a form; ONE resource dictionary shared by the pages and every form
    for n in (30, 60, 90):
        shapes = "".join('<draw:rect draw:style-name="gr%d" svg:x="%.2fcm" svg:y="%.2fcm" svg:width="1.6cm" svg:height="1.6cm"/>' % (i % 3, 0.5 + (i % 10) * 1.9, 1 + (i // 10) * 1.9) for i in range(n))
        styles = "".join('<style:style style:name="gr%d" style:family="graphic"><style:graphic-properties draw:fill="solid" draw:fill-color="#%s" draw:opacity="%d%%" draw:stroke="none"/></style:style>' % (k, ["ff0000", "00aa00", "0000ff"][k], [50, 60, 70][k]) for k in range(3))
        doc = ('<?xml version="1.0" encoding="UTF-8"?><office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
               'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" '
               'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.graphics"><office:automatic-styles>%s</office:automatic-styles>'
               '<office:body><office:drawing><draw:page draw:name="p1"><draw:frame svg:x="1cm" svg:y="0.2cm" svg:width="12cm" svg:height="0.8cm"><draw:text-box><text:p>Transparent shapes %d</text:p></draw:text-box></draw:frame>%s</draw:page></office:drawing></office:body></office:document>') % (styles, n, shapes)
        open(os.path.join(tmp, "lo_transp_%d.fodg" % n), "w").write(doc)
        subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, os.path.join(tmp, "lo_transp_%d.fodg" % n)], capture_output=True, timeout=180)
        shutil.copy(os.path.join(tmp, "lo_transp_%d.pdf" % n), P("lo_transp_%d.pdf" % n)); made.append("lo_transp_%d.pdf" % n)
    # cairo with Screen nested in see-through groups (cairo draws the blended box in a group of its own)
    for D in (0, 3, 4):
        op = "".join('<g opacity="0.95">' for _ in range(D)); cl = "</g>" * D
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect x="0" y="0" width="300" height="80" fill="black"/>'
               '<text x="10" y="190" font-family="DejaVu Sans" font-size="14">Screen box nested %d groups deep</text>%s<rect x="40" y="40" width="220" height="100" fill="#3050ff" style="mix-blend-mode:screen"/>%s</svg>') % (D, op, cl)
        open(os.path.join(tmp, "s%d.svg" % D), "w").write(svg)
        subprocess.run(["rsvg-convert", "-f", "pdf", "-o", P("cairo_screen_depth%d.pdf" % D), os.path.join(tmp, "s%d.svg" % D)], check=True); made.append("cairo_screen_depth%d.pdf" % D)
    return made

# =================================================================== 5. TEXT READER: scanned and typed pages with things on top
def textreader():
    from PIL import Image, ImageDraw, ImageFont
    made = []
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    def scan_img(dpi):
        W, H = int(8.5 * dpi), int(11 * dpi)
        im = Image.new("L", (W, H), 255); g = ImageDraw.Draw(im)
        f = ImageFont.truetype(FONT, int(34 * dpi / 150))
        for i, line in enumerate(["INSPECTION REPORT", "PUMP STATION TWO", "WET WELL CLEAN", "FLOATS TESTED OK"]):
            g.text((int(0.8 * dpi), int((1.0 + 0.7 * i) * dpi)), line, fill=0, font=f)
        return im
    def logo_img():
        im = Image.new("L", (48, 48), 255); g = ImageDraw.Draw(im); g.ellipse((4, 4, 44, 44), fill=0); g.rectangle((18, 10, 30, 38), fill=255); return im
    def doc(name, dpi=150, rotate=0, annots=(), ocr_layer=None, typed=None, logo=False, scan=True, need=True):
        d = Doc(); d.add(6, HELV)
        res, prog = [], ""
        if scan:
            im = scan_img(dpi)
            if rotate: im = im.rotate(rotate, expand=True)   # a page scanned sideways and turned by /Rotate
            d.stream(7, "/Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceGray /BitsPerComponent 8" % im.size, im.tobytes(), flate=True)
            w, h = (792, 612) if rotate in (90, 270) else (612, 792)
            prog += "q %d 0 0 %d 0 0 cm /Im Do Q\n" % (w, h); res.append("/Im 7 0 R")
        if logo:
            im = logo_img(); d.stream(8, "/Type /XObject /Subtype /Image /Width 48 /Height 48 /ColorSpace /DeviceGray /BitsPerComponent 8", im.tobytes(), flate=True)
            prog += "q 54 0 0 54 60 700 cm /Logo Do Q\n"; res.append("/Logo 8 0 R")
        if ocr_layer: prog += "BT 3 Tr /F1 30 Tf 58 640 Td (%s) Tj ET\n" % ocr_layer
        if typed: prog += "BT /F1 16 Tf 130 730 Td (%s) Tj ET\n" % typed
        d.stream(5, "", prog)
        nums = []
        for k, a in enumerate(annots):
            n = 20 + k; d.add(n, a.replace("PAGE", "3 0 R")); nums.append(n)
        fields = [n for n, a in zip(nums, annots) if "/Widget" in a]
        acro = (" /AcroForm << /Fields [%s] %s /DR << /Font << /Helv 6 0 R >> >> /DA (/Helv 12 Tf 0 g) >>" % (" ".join("%d 0 R" % n for n in fields), "/NeedAppearances true" if need else "")) if fields else ""
        d.add(1, "<< /Type /Catalog /Pages 2 0 R%s >>" % acro); d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
        d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %s] %s /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> /XObject << %s >> >>%s >>"
              % ("792 612" if rotate in (90, 270) else "612 792", "/Rotate %d" % rotate if rotate else "", " ".join(res), " /Annots [%s]" % " ".join("%d 0 R" % n for n in nums) if nums else ""))
        d.xref("<< /Size SIZE /Root 1 0 R >>"); made.append(d.write(name))
    NOTE = "<< /Type /Annot /Subtype /Text /Rect [500 700 520 720] /T (Adam) /Contents (Checked by the night shift, see the log book) >>"
    FIELD = "<< /Type /Annot /Subtype /Widget /FT /Tx /T (%s) /V (%s) /DA (/Helv 12 Tf 0 g) /Rect [%d %d %d %d] /F 4 /P PAGE >>"
    doc("tr_scan150_note.pdf", annots=[NOTE])
    doc("tr_scan150_fields.pdf", annots=[FIELD % ("inspector", "Grace Hopper", 380, 200, 580, 220), FIELD % ("date", "2026-11-25", 380, 170, 580, 190)])
    doc("tr_scan300_stamp.pdf", dpi=300, annots=["<< /Type /Annot /Subtype /Stamp /Rect [400 60 560 110] /F 4 /Name /Approved >>"])
    doc("tr_scan300_highlight.pdf", dpi=300, annots=["<< /Type /Annot /Subtype /Highlight /Rect [55 600 400 640] /F 4 /C [1 1 0] /QuadPoints [55 640 400 640 55 600 400 600] /T (Grace) /Contents (Check this line) >>"])
    doc("tr_scan150_link_popup.pdf", annots=["<< /Type /Annot /Subtype /Link /Rect [55 600 400 640] /A << /S /URI /URI (https://example.org/) >> >>",
                                             "<< /Type /Annot /Subtype /Popup /Rect [400 600 560 700] >>"])
    doc("tr_scan150_rot90_note.pdf", rotate=90, annots=[NOTE])
    doc("tr_scan150_ocrlayer_note.pdf", ocr_layer="INSPECTION REPORT PUMP STATION TWO WET WELL CLEAN FLOATS TESTED OK", annots=[NOTE])
    # typed pages: few letters with a filled field; 29, 30, 31 letters with a note; a small logo, few letters and a long filled field
    LONG = "Pump two tripped at three in the morning; reset it and checked the floats"
    doc("tr_typed_short_field.pdf", scan=False, typed="Name:", annots=[FIELD % ("name", "Grace Hopper", 200, 724, 500, 744)])
    for n in (29, 30, 31):
        word = ("ABCDEFGHIJ" * 4)[:n]
        doc("tr_typed_%d_note.pdf" % n, scan=False, typed=word, annots=[NOTE])
    doc("tr_logo_field.pdf", scan=False, logo=True, typed="Site log", annots=[FIELD % ("entry", LONG, 60, 600, 560, 620)])
    doc("tr_nologo_field.pdf", scan=False, logo=False, typed="Site log", annots=[FIELD % ("entry", LONG, 60, 600, 560, 620)])
    return made

# =================================================================== 6. FORMS, LINKS, NAMES, TEXT STRINGS, PASSWORDS
def lit(b):
    # a PDF literal string from bytes (octal escapes for anything not plain ASCII)
    o = "("
    for c in b:
        ch = chr(c)
        if ch in "()\\": o += "\\" + ch
        elif 32 <= c < 127: o += ch
        else: o += "\\%03o" % c
    return o + ")"
def forms():
    made = []
    d = Doc(); d.add(6, HELV)
    AP = "/AP << /N << /%s %d 0 R /Off %d 0 R >> >>"
    d.stream(7, "/Type /XObject /Subtype /Form /BBox [0 0 20 20]", "0 g 4 4 12 12 re f"); d.stream(8, "/Type /XObject /Subtype /Form /BBox [0 0 20 20]", "")
    objs = {}
    # radio "dir": /Opt on the field, on-names /0 /1 /2 (Acrobat's way), the middle one on
    objs[30] = "<< /FT /Btn /Ff 49152 /T (dir) /V /1 /Opt [(Upstream) (Downstream) (Bypass)] /Kids [31 0 R 32 0 R 33 0 R] >>"
    for k, n in enumerate((31, 32, 33)):
        objs[n] = "<< /Type /Annot /Subtype /Widget /Parent 30 0 R /Rect [%d 700 %d 720] /F 4 /AS /%s %s >>" % (60 + 40 * k, 80 + 40 * k, str(k) if k == 1 else "Off", AP % (str(k), 7, 8))
    # radio "rating": export values 1 2 3 as on-names, no /Opt, 2 on
    objs[34] = "<< /FT /Btn /Ff 49152 /T (rating) /V /2 /Kids [35 0 R 36 0 R 37 0 R] >>"
    for k, n in enumerate((35, 36, 37)):
        objs[n] = "<< /Type /Annot /Subtype /Widget /Parent 34 0 R /Rect [%d 650 %d 670] /F 4 /AS /%s %s >>" % (60 + 40 * k, 80 + 40 * k, str(k + 1) if k == 1 else "Off", AP % (str(k + 1), 7, 8))
    # check box "agree" with /Opt [(Ja)] and on-name /0, on
    objs[38] = "<< /Type /Annot /Subtype /Widget /FT /Btn /T (agree) /V /0 /AS /0 /Opt [(Ja)] /Rect [60 600 80 620] /F 4 %s >>" % (AP % ("0", 7, 8))
    # radio "dir2": /Opt with on-names that are not numbers (the standard: Opt holds each widget's on state as text)
    objs[39] = "<< /FT /Btn /Ff 49152 /T (dir2) /V /Down /Opt [(Upstream) (Downstream)] /Kids [40 0 R 41 0 R] >>"
    objs[40] = "<< /Type /Annot /Subtype /Widget /Parent 39 0 R /Rect [60 550 80 570] /F 4 /AS /Off %s >>" % (AP % ("Up", 7, 8))
    objs[41] = "<< /Type /Annot /Subtype /Widget /Parent 39 0 R /Rect [100 550 120 570] /F 4 /AS /Down %s >>" % (AP % ("Down", 7, 8))
    # text field "notes" whose value is a compressed stream
    d.stream(42, "", "Value kept in a stream, compressed", flate=True)
    objs[43] = "<< /Type /Annot /Subtype /Widget /FT /Tx /T (notes) /V 42 0 R /DA (/Helv 10 Tf 0 g) /Rect [60 500 400 520] /F 4 >>"
    # text fields in UTF-16LE (FF FE) and UTF-16BE with a language and country escape
    le = b"\xff\xfe" + "Pumpe – Handbuch".encode("utf-16-le")
    be = b"\xfe\xff" + b"\x00\x1b" + b"de" + b"DE" + b"\x00\x1b" + "Schacht gereinigt".encode("utf-16-be")
    objs[44] = "<< /Type /Annot /Subtype /Widget /FT /Tx /T (le) /V <%s> /DA (/Helv 10 Tf 0 g) /Rect [60 450 400 470] /F 4 >>" % le.hex()
    objs[45] = "<< /Type /Annot /Subtype /Widget /FT /Tx /T (be) /V <%s> /DA (/Helv 10 Tf 0 g) /Rect [60 400 400 420] /F 4 >>" % be.hex()
    # check boxes with on-names in UTF-8 and in Latin-1 bytes
    objs[46] = "<< /Type /Annot /Subtype /Widget /FT /Btn /T (si8) /V /S#C3#AD /AS /S#C3#AD /Rect [60 350 80 370] /F 4 /AP << /N << /S#C3#AD 7 0 R /Off 8 0 R >> >> >>"
    objs[47] = "<< /Type /Annot /Subtype /Widget /FT /Btn /T (si1) /V /S#ED /AS /S#ED /Rect [100 350 120 370] /F 4 /AP << /N << /S#ED 7 0 R /Off 8 0 R >> >> >>"
    # links: a web address in UTF-8 bytes, one in Latin-1 bytes, one already %-escaped
    objs[48] = "<< /Type /Annot /Subtype /Link /Rect [60 300 200 320] /A << /S /URI /URI %s >> >>" % lit("https://example.org/café".encode("utf-8"))
    objs[49] = "<< /Type /Annot /Subtype /Link /Rect [60 270 200 290] /A << /S /URI /URI %s >> >>" % lit("https://example.org/café".encode("latin-1"))
    objs[50] = "<< /Type /Annot /Subtype /Link /Rect [60 240 200 260] /A << /S /URI /URI (https://example.org/caf%C3%A9) >> >>"
    for n, o in objs.items(): d.add(n, o)
    widgets = [31, 32, 33, 35, 36, 37, 38, 40, 41, 43, 44, 45, 46, 47]
    d.stream(5, "", "BT /F1 10 Tf 60 730 Td (Forms three) Tj ET")
    d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> /Annots [%s] >>" % " ".join("%d 0 R" % n for n in widgets + [48, 49, 50]))
    d.add(1, "<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [30 0 R 34 0 R 38 0 R 39 0 R 43 0 R 44 0 R 45 0 R 46 0 R 47 0 R] /DR << /Font << /Helv 6 0 R >> >> /DA (/Helv 10 Tf 0 g) >> >>")
    d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.xref("<< /Size SIZE /Root 1 0 R >>"); made.append(d.write("forms3.pdf"))

    # names: a name tree whose keys are bytes -- PDFDocEncoding (0x84 em dash), UTF-8, UTF-16BE -- with byte-sorted /Limits in
    # two kids; links to each; and an old-style /Dests dictionary looked up by a name with UTF-8 bytes
    d = Doc(); d.add(6, HELV)
    keys = sorted([b"Kap\x84", "café".encode("utf-8"), b"\xfe\xff" + "café".encode("utf-16-be"), b"zeta", b"Kap1"])
    pages = {b"Kap\x84": 0, b"Kap1": 0, "café".encode("utf-8"): 1, b"\xfe\xff" + "café".encode("utf-16-be"): 2, b"zeta": 2}
    k1, k2 = keys[:2], keys[2:]
    def hexs(b): return "<%s>" % b.hex()
    d.add(20, "<< /Limits [%s %s] /Names [%s] >>" % (hexs(k1[0]), hexs(k1[-1]), " ".join("%s [%d 0 R /Fit]" % (lit(k), 100 + pages[k]) for k in k1)))
    d.add(21, "<< /Limits [%s %s] /Names [%s] >>" % (lit(k2[0]), lit(k2[-1]), " ".join("%s [%d 0 R /Fit]" % (hexs(k), 100 + pages[k]) for k in k2)))
    d.add(22, "<< /Kids [20 0 R 21 0 R] >>")
    links = []
    for i, k in enumerate(keys):
        links.append(d.add(30 + i, "<< /Type /Annot /Subtype /Link /Rect [60 %d 200 %d] /Dest %s >>" % (700 - 30 * i, 720 - 30 * i, lit(k))))
    links.append(d.add(40, "<< /Type /Annot /Subtype /Link /Rect [60 400 200 420] /Dest /Sch#C3#B6n >>"))
    for p in range(3):
        d.stream(200 + p, "", "BT /F1 12 Tf 300 700 Td (Names page %d) Tj ET" % (p + 1))
        d.add(100 + p, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 6 0 R >> >>%s >>" % (200 + p, " /Annots [%s]" % " ".join("%d 0 R" % n for n in links) if p == 0 else ""))
    d.add(1, "<< /Type /Catalog /Pages 2 0 R /Names << /Dests 22 0 R >> /Dests << /Sch#C3#B6n [101 0 R /Fit] >> >>")
    d.add(2, "<< /Type /Pages /Kids [100 0 R 101 0 R 102 0 R] /Count 3 >>")
    d.xref("<< /Size SIZE /Root 1 0 R >>"); made.append(d.write("names3.pdf"))
    json.dump({"keys": [k.hex() for k in keys], "pages": {k.hex(): v for k, v in pages.items()}}, open(P("names3.json"), "w"))

    # titles: UTF-16LE with its mark; UTF-16BE with a language+country escape in the middle; PDFDocEncoding with 0x84, 0xA0
    for name, b in [("title_utf16le.pdf", b"\xff\xfe" + "Pumpe – Handbuch".encode("utf-16-le")),
                    ("title_utf16_langmid.pdf", b"\xfe\xff" + "Wet well ".encode("utf-16-be") + b"\x00\x1bfr\x00\x1b" + "puits humide".encode("utf-16-be")),
                    ("title_pdfdoc.pdf", b"Manual \x84 Part \xa0 5")]:
        d = Doc(); d.add(6, HELV); d.stream(5, "", "BT /F1 12 Tf 72 700 Td (Title test) Tj ET")
        d.add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>")
        d.add(1, "<< /Type /Catalog /Pages 2 0 R >>"); d.add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"); d.add(4, "<< /Title <%s> >>" % b.hex())
        d.xref("<< /Size SIZE /Root 1 0 R /Info 4 0 R >>"); made.append(d.write(name))

    # passwords AES-256 (qpdf stores them as typed): with a soft hyphen, with a no-break space
    base = P("title_pdfdoc.pdf")
    for name, pw in [("pw_aes256_softhyphen.pdf", "pump­house"), ("pw_aes256_nbsp.pdf", "pump house")]:
        subprocess.run(["qpdf", "--encrypt", pw, "owner-x", "256", "--", base, P(name)], check=True); made.append(name)
    # a V4 RC4 lock whose crypt filter says its length in bits (/Length 128), as some makers write it
    subprocess.run(["qpdf", "--allow-weak-crypto", "--encrypt", "pump", "owner-y", "128", "--force-V4", "--use-aes=n", "--", base, P("_v4.pdf")], check=True)
    b = open(P("_v4.pdf"), "rb").read()
    i = b.find(b"/StdCF"); j = b.find(b"/Length 16 >>", i)
    assert i > 0 and j > 0
    b = b[:j] + b"/Length 128>>" + b[j + len(b"/Length 16 >>"):]   # (the same number of bytes: offsets stay right)
    open(P("pw_v4_rc4_cflen_bits.pdf"), "wb").write(b); os.remove(P("_v4.pdf"))
    made.append("pw_v4_rc4_cflen_bits.pdf")
    return made

if __name__ == "__main__":
    ALL = {"trailer": trailers, "hidden": hidden, "blends": blends, "ordinary": ordinary, "textreader": textreader, "forms": forms}
    for g in sys.argv[1:] or list(ALL):
        print(g, ALL[g]())
