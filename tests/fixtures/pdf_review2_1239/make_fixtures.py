# make_fixtures.py -- PDFs for a second independent review of 1.24.39's PDF reading: linearized and updated files,
# text strings, passwords in every encoding, blend modes and see-through annotations, layer expressions, forms, and
# scanned pages with comments for Text Reader. Made with reportlab 5.0.1, pypdf 6.17.0, pikepdf 10.16 / qpdf 11.9 and
# byte by byte. Usage: python3 make_fixtures.py   (writes the PDFs beside this script, and expect.json)
import os, io, re, json, zlib, subprocess, hashlib
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (NameObject, DictionaryObject, ArrayObject, TextStringObject, DecodedStreamObject, IndirectObject)
import pikepdf
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
def P(n): return os.path.join(HERE, n)
EXPECT = {}
def sh(*a, ok=(0, 3)):
    r = subprocess.run(a, capture_output=True)
    if r.returncode not in ok: raise SystemExit("failed: %s\n%s" % (" ".join(map(str, a)), r.stderr.decode(errors="replace")))
    return r

# ---------------------------------------------------------------- a byte-by-byte PDF writer
class Doc:
    def __init__(self): self.objs = []
    def add(self, o=None): self.objs.append(o); return len(self.objs)
    def set(self, n, o): self.objs[n - 1] = o
    def build(self, root, trailer_extra=b"", version=b"1.7"):
        out = b"%PDF-" + version + b"\n%\xe2\xe3\xcf\xd3\n"; offs = []
        for i, o in enumerate(self.objs, 1):
            offs.append(len(out))
            if isinstance(o, tuple):
                d, data = o
                d = d.encode("latin-1") if isinstance(d, str) else d
                out += b"%d 0 obj\n" % i + d.replace(b"LEN", b"%d" % len(data)) + b"\nstream\n" + data + b"\nendstream\nendobj\n"
            else:
                o = o.encode("latin-1") if isinstance(o, str) else o
                out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
        x = len(out)
        out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(self.objs) + 1) + b"".join(b"%010d 00000 n \n" % f for f in offs)
        te = trailer_extra.encode("latin-1") if isinstance(trailer_extra, str) else trailer_extra
        out += b"trailer\n<< /Size %d /Root %d 0 R %s >>\nstartxref\n%d\n%%%%EOF\n" % (len(self.objs) + 1, root, te, x)
        return out
    def write(self, name, root, trailer_extra=b"", version=b"1.7"):
        open(P(name), "wb").write(self.build(root, trailer_extra, version))

def hexs(b): return "<" + b.hex().upper() + ">"
def u16(s): return "<FEFF" + s.encode("utf-16-be").hex().upper() + ">"
HELV = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
def bt(x, y, s, size=12, font="F1"): return "BT /%s %g Tf %g %g Td (%s) Tj ET\n" % (font, size, x, y, s)

def append_update(raw, objs, trailer):
    """Append an incremental update (plain, no lock): objs {num: bytes}, trailer: the new trailer's entries (str)."""
    start = raw.rfind(b"startxref"); prev = int(raw[start + 9:].split()[0])
    out = bytearray(raw if raw.endswith(b"\n") else raw + b"\n"); offs = {}
    for n in sorted(objs):
        offs[n] = len(out); o = objs[n]
        out += b"%d 0 obj\n" % n + (o.encode("latin-1") if isinstance(o, str) else o) + b"\nendobj\n"
    x = len(out)
    out += b"xref\n0 1\n0000000000 65535 f \n"
    for n in sorted(offs): out += b"%d 1\n%010d 00000 n \n" % (n, offs[n])
    out += b"trailer\n<< %s /Prev %d >>\nstartxref\n%d\n%%%%EOF\n" % (trailer.encode("latin-1"), prev, x)
    return bytes(out)

def trailer_bits(path, pw=""):
    """/Root, /Info, /Encrypt, /ID and /Size of a file as qpdf sees them (its newest trailer)."""
    with pikepdf.open(path, password=pw) as q:
        t = q.trailer
        def ref(k): return "%d 0 R" % t[k].objgen[0] if k in t else None
        ids = t.get("/ID")
        idhex = "".join("<" + bytes(i).hex() + ">" for i in ids) if ids is not None else ""
        return {"Root": ref("/Root"), "Info": ref("/Info"), "Encrypt": ref("/Encrypt"), "ID": idhex, "Size": int(t["/Size"])}

def encrypted_update(src, dst, pw, title, line, new_root_outline=None):
    """Append an update to a locked PDF, its new objects scrambled with the file's own key (pypdf's encryptor):
    page 1 gets one more content stream, the Info a new title."""
    raw = open(src, "rb").read()
    r = PdfReader(src); r.decrypt(pw)
    enc = r._encryption
    size = int(r.trailer["/Size"]); start = raw.rfind(b"startxref"); prev = int(raw[start + 9:].split()[0])
    pg = r.pages[0]; pnum = pg.indirect_reference.idnum
    cnum, inum = size, size + 1
    cs = DecodedStreamObject(); cs.set_data(("BT /UPD 16 Tf 72 760 Td (%s) Tj ET\n" % line).encode())
    ecs = enc.encrypt_object(cs, cnum, 0)
    newpage = DictionaryObject({k: v for k, v in pg.items()})
    old = pg.raw_get("/Contents")
    arr = ArrayObject(list(old) if isinstance(old, ArrayObject) else [old]); arr.append(IndirectObject(cnum, 0, None))
    newpage[NameObject("/Contents")] = arr
    res = DictionaryObject({k: v for k, v in pg["/Resources"].items()})
    fonts = DictionaryObject({k: v for k, v in res.get("/Font", DictionaryObject()).items()})
    fonts[NameObject("/UPD")] = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    res[NameObject("/Font")] = fonts; newpage[NameObject("/Resources")] = res
    info = DictionaryObject({NameObject("/Title"): TextStringObject(title)})
    einfo = enc.encrypt_object(info, inum, 0); epage = enc.encrypt_object(newpage, pnum, 0)
    out = io.BytesIO(); out.write(raw if raw.endswith(b"\n") else raw + b"\n"); offs = {}
    def put(num, obj):
        offs[num] = out.tell(); out.write(b"%d 0 obj\n" % num)
        b = io.BytesIO(); obj.write_to_stream(b); out.write(b.getvalue()); out.write(b"\nendobj\n")
    put(pnum, epage); put(cnum, ecs); put(inum, einfo)
    x = out.tell()
    out.write(b"xref\n0 1\n0000000000 65535 f \n")
    for n in sorted(offs): out.write(b"%d 1\n%010d 00000 n \n" % (n, offs[n]))
    tb = trailer_bits(src, pw)
    out.write(("trailer\n<< /Size %d /Root %s /Encrypt %s /Info %d 0 R /ID [%s] /Prev %d >>\nstartxref\n%d\n%%%%EOF\n" %
               (inum + 1, tb["Root"], tb["Encrypt"], inum, tb["ID"], prev, x)).encode("latin-1"))
    open(dst, "wb").write(out.getvalue())

# ================================================================ 1. LINEARIZED, UPDATED AND HYBRID FILES
def linear():
    c = canvas.Canvas(P("_base3.pdf"), pagesize=(612, 792)); c.setTitle("Pump Station Manual")
    for k, words in enumerate(["wet well level control", "float switches and alarms", "pump rotation and lead lag"]):
        c.setFont("Helvetica-Bold", 18); c.drawString(72, 700, "Linear page %d" % (k + 1))
        c.setFont("Helvetica", 12); c.drawString(72, 670, "Section on " + words + ".")
        c.setFillColorRGB(0, 0, 1 if k == 0 else 0); c.rect(72, 560, 200, 50, fill=1, stroke=0); c.setFillColorRGB(0, 0, 0)
        c.bookmarkPage("p%d" % k); c.addOutlineEntry("Chapter %d" % (k + 1), "p%d" % k, 0)
        c.showPage()
    c.save()
    # a form to linearize: a value with its own drawing (reportlab), and a check box
    c = canvas.Canvas(P("_form1.pdf"), pagesize=(612, 792)); f = c.acroForm
    c.setTitle("Linear Form"); c.setFont("Helvetica", 12)
    c.drawString(72, 700, "Tag:"); f.textfield(name="tag", value="LIN-FIELD-42", x=150, y=694, width=200, height=20, fontSize=12, borderWidth=1)
    c.drawString(72, 660, "Done:"); f.checkbox(name="done", checked=True, x=150, y=656, size=16)
    c.showPage(); c.drawString(72, 700, "Second page of the linear form"); c.showPage(); c.save()
    B, F = P("_base3.pdf"), P("_form1.pdf")
    W = ["--allow-weak-crypto"]
    jobs = [("lin2_plain.pdf", B, []), ("lin2_rc4_40_user.pdf", B, W + ["--encrypt", "pump", "chief", "40", "--"]),
            ("lin2_rc4_128_owner.pdf", B, W + ["--encrypt", "", "chief", "128", "--use-aes=n", "--"]),
            ("lin2_rc4_128_user.pdf", B, W + ["--encrypt", "pump", "chief", "128", "--use-aes=n", "--"]),
            ("lin2_aes128_user.pdf", B, ["--encrypt", "pump", "chief", "128", "--use-aes=y", "--"]),
            ("lin2_aes256_owner.pdf", B, ["--encrypt", "", "chief", "256", "--"]),
            ("lin2_aes256_r5_user.pdf", B, ["--encrypt", "pump", "chief", "256", "--force-R5", "--"]),
            ("lin2_objstm_plain.pdf", B, ["--object-streams=generate"]),
            ("lin2_objstm_rc4_user.pdf", B, W + ["--object-streams=generate", "--encrypt", "pump", "chief", "128", "--use-aes=n", "--"]),
            ("lin2_objstm_aes128_owner.pdf", B, ["--object-streams=generate", "--encrypt", "", "chief", "128", "--use-aes=y", "--"]),
            ("lin2_form_plain.pdf", F, []), ("lin2_form_aes256_user.pdf", F, ["--encrypt", "pump", "chief", "256", "--"]),
            ("lin2_form_objstm_rc4_owner.pdf", F, W + ["--object-streams=generate", "--encrypt", "", "chief", "128", "--use-aes=n", "--"])]
    for name, src, opts in jobs:
        sh("qpdf", "--linearize", *opts, src, P(name))
    sh("qpdf", "--decrypt", B, P("plain3.pdf"))   # the oracle (not linearized, no lock)
    # updates appended after linearizing (Acrobat and pypdf's incremental writer both do this): the update's /Prev is the
    # first-page cross-reference table (where the last startxref points); its trailer is the newest
    raw = open(P("lin2_plain.pdf"), "rb").read(); tb = trailer_bits(P("lin2_plain.pdf"))
    with pikepdf.open(P("lin2_plain.pdf")) as q:
        p1 = q.pages[0].obj.objgen[0]; p1d = q.pages[0].obj; contents = p1d["/Contents"]
        cref = [c.objgen[0] for c in (contents if isinstance(contents, pikepdf.Array) else [contents])]
        res = q.pages[0].obj["/Resources"]; fonts = {str(k): v.objgen[0] for k, v in res["/Font"].items()}
        parent = p1d["/Parent"].objgen[0]; mb = [float(v) for v in p1d["/MediaBox"]]
        pages_ref = q.Root["/Pages"].objgen[0]
    n = tb["Size"]
    font_str = " ".join("%s %d 0 R" % (k, v) for k, v in fonts.items())
    newpage = "<< /Type /Page /Parent %d 0 R /MediaBox [%g %g %g %g] /Contents [%s %d 0 R] /Resources << /Font << %s /UPD %d 0 R >> >> >>" % (
        parent, mb[0], mb[1], mb[2], mb[3], " ".join("%d 0 R" % c for c in cref), n, font_str, n + 1)
    ub = b"BT /UPD 16 Tf 72 760 Td (APPENDED-LINE) Tj ET"
    upd = {p1: newpage, n: b"<< /Length %d >>\nstream\n" % len(ub) + ub + b"\nendstream",
           n + 1: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", n + 2: "<< /Title (Updated After Linearize) >>"}
    open(P("lin2_incr_title.pdf"), "wb").write(append_update(raw, upd, "/Size %d /Root %s /Info %d 0 R /ID [%s]" % (n + 3, tb["Root"], n + 2, tb["ID"])))
    # an update that names a NEW catalog (another number) with a new outline
    upd = {n: "<< /Type /Catalog /Pages %d 0 R /Outlines %d 0 R >>" % (pages_ref, n + 1), n + 1: "<< /Type /Outlines /First %d 0 R /Last %d 0 R /Count 1 >>" % (n + 2, n + 2),
           n + 2: "<< /Title (New Root Outline) /Parent %d 0 R /Dest [%d 0 R /Fit] >>" % (n + 1, p1)}
    open(P("lin2_incr_root.pdf"), "wb").write(append_update(raw, upd, "/Size %d /Root %d 0 R /Info %s /ID [%s]" % (n + 3, n, tb["Info"], tb["ID"])))
    # an update written with a cross-reference STREAM after a classic linearized file
    start = raw.rfind(b"startxref"); prev = int(raw[start + 9:].split()[0])
    out = bytearray(raw); o1 = len(out); out += b"%d 0 obj\n<< /Title (XRefStm Update Title) >>\nendobj\n" % n
    o2 = len(out)
    rows = bytes([1]) + o1.to_bytes(4, "big") + b"\x00\x00" + bytes([1]) + o2.to_bytes(4, "big") + b"\x00\x00"
    xs = zlib.compress(rows)
    out += (b"%d 0 obj\n<< /Type /XRef /Size %d /Index [%d 2] /W [1 4 2] /Root %s /Info %d 0 R /ID [%s] /Prev %d /Filter /FlateDecode /Length %d >>\nstream\n"
            % (n + 1, n + 2, n, tb["Root"].encode(), n, tb["ID"].encode(), prev, len(xs))) + xs + b"\nendstream\nendobj\n"
    out += b"startxref\n%d\n%%%%EOF\n" % o2
    open(P("lin2_incr_xrefstm.pdf"), "wb").write(bytes(out))
    # locked + linearized + an update scrambled with the file's key
    encrypted_update(P("lin2_rc4_128_owner.pdf"), P("lin2_rc4_128_owner_incr.pdf"), "", "Locked Linear Updated", "LOCKED-APPEND")
    encrypted_update(P("lin2_aes128_user.pdf"), P("lin2_aes128_user_incr.pdf"), "pump", "AES Linear Updated", "AES-APPEND")
    encrypted_update(P("lin2_aes256_owner.pdf"), P("lin2_aes256_owner_incr.pdf"), "", "AES256 Linear Updated", "AES256-APPEND")
    # not linearized: an update that changes the catalog (new Root, new outline) and one that drops /Info
    raw = open(P("plain3.pdf"), "rb").read(); tb = trailer_bits(P("plain3.pdf"))
    with pikepdf.open(P("plain3.pdf")) as q: pages_ref = q.Root["/Pages"].objgen[0]; p1 = q.pages[0].obj.objgen[0]
    n = tb["Size"]
    upd = {n: "<< /Type /Catalog /Pages %d 0 R /Outlines %d 0 R >>" % (pages_ref, n + 1), n + 1: "<< /Type /Outlines /First %d 0 R /Last %d 0 R /Count 1 >>" % (n + 2, n + 2),
           n + 2: "<< /Title (Replaced Catalog Outline) /Parent %d 0 R /Dest [%d 0 R /Fit] >>" % (n + 1, p1)}
    open(P("incr_new_root.pdf"), "wb").write(append_update(raw, upd, "/Size %d /Root %d 0 R /Info %s /ID [%s]" % (n + 3, n, tb["Info"], tb["ID"])))
    open(P("incr_drop_info.pdf"), "wb").write(append_update(raw, {n: "<< /Type /Catalog /Pages %d 0 R >>" % pages_ref},
                                                            "/Size %d /Root %d 0 R /ID [%s]" % (n + 1, n, tb["ID"])))
    # a hybrid-reference file (PDF 1.5 for older readers): a classic table + trailer naming /XRefStm; the font and the
    # Info sit in an object stream that only the cross-reference stream lists
    def hybrid(title_obj):
        objs = {1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"}
        content = (bt(72, 700, "Hybrid reference page", 18) + bt(72, 670, "Font and Info live in an object stream.")).encode()
        packed = [(5, HELV.encode()), (6, title_obj.encode("latin-1"))]
        head, body = b"", b""
        for num, ob in packed: head += b"%d %d " % (num, len(body)); body += ob + b"\n"
        osdata = head + body
        out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n"); off = {}
        for k in (1, 2, 3):
            off[k] = len(out); out += b"%d 0 obj\n%s\nendobj\n" % (k, objs[k].encode())
        off[4] = len(out); out += b"4 0 obj\n<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream\nendobj\n"
        off[7] = len(out); out += b"7 0 obj\n<< /Type /ObjStm /N 2 /First %d /Length %d >>\nstream\n" % (len(head), len(osdata)) + osdata + b"\nendstream\nendobj\n"
        rows = b""
        for k in range(0, 9):
            if k in (5, 6): rows += bytes([2]) + (7).to_bytes(4, "big") + (k - 5).to_bytes(2, "big")
            elif k in off: rows += bytes([1]) + off[k].to_bytes(4, "big") + b"\x00\x00"
            elif k == 0: rows += bytes([0, 0, 0, 0, 0, 0xff, 0xff])
            else: rows += bytes([1]) + (0).to_bytes(4, "big") + b"\x00\x00"
        off[8] = len(out)
        rows = rows[:8 * 7] + bytes([1]) + off[8].to_bytes(4, "big") + b"\x00\x00"
        xs = zlib.compress(rows)
        out += b"8 0 obj\n<< /Type /XRef /Size 9 /W [1 4 2] /Filter /FlateDecode /Length %d >>\nstream\n" % len(xs) + xs + b"\nendstream\nendobj\n"
        x = len(out)
        out += b"xref\n0 9\n0000000000 65535 f \n"
        for k in range(1, 9):
            out += (b"%010d 00000 n \n" % off[k]) if k in off else b"0000000000 65535 f \n"
        out += b"trailer\n<< /Size 9 /Root 1 0 R /Info 6 0 R /XRefStm %d /ID [<A1B2C3D4E5F60718293A4B5C6D7E8F90> <A1B2C3D4E5F60718293A4B5C6D7E8F90>] >>\nstartxref\n%d\n%%%%EOF\n" % (off[8], x)
        return bytes(out)
    h = hybrid("<< /Title (Hybrid Title) >>")
    open(P("hybrid_plain.pdf"), "wb").write(h)
    open(P("hybrid_incr.pdf"), "wb").write(append_update(h, {9: "<< /Title (Hybrid Updated Title) >>"},
                                                         "/Size 10 /Root 1 0 R /Info 9 0 R /ID [<A1B2C3D4E5F60718293A4B5C6D7E8F90> <A1B2C3D4E5F60718293A4B5C6D7E8F90>]"))
    # an ordinary PDF that is ABOUT the PDF format: its (uncompressed) page shows a trailer as text, which a reader that
    # scans the whole file for the word "trailer" might take for the file's own
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R >>"); d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>")
    d.add(("<< /Length LEN >>", (bt(72, 720, "How a locked PDF names its lock", 16) + bt(72, 690, "The last part of the file reads:")
                                 + bt(90, 670, "trailer << /Size 9 /Root 1 0 R /Encrypt 6 0 R /Info 7 0 R >>") + bt(72, 650, "and a reader finds the lock there.")).encode()))
    d.add(HELV)
    d.add("<< /Producer (hand) /Filler (%s) >>" % ("x" * 6000))   # keeps the example text far from the file's end
    d.add("<< /Title (PDF Syntax Lesson) >>")
    d.write("about_trailers.pdf", 1, "/Info 7 0 R")
    for f in ["_base3.pdf", "_form1.pdf"]: os.remove(P(f))

# ================================================================ 2. TEXT STRINGS
PDFDOC = {0x18: 0x2d8, 0x19: 0x2c7, 0x1a: 0x2c6, 0x1b: 0x2d9, 0x1c: 0x2dd, 0x1d: 0x2db, 0x1e: 0x2da, 0x1f: 0x2dc, 0x80: 0x2022, 0x81: 0x2020, 0x82: 0x2021,
          0x83: 0x2026, 0x84: 0x2014, 0x85: 0x2013, 0x86: 0x192, 0x87: 0x2044, 0x88: 0x2039, 0x89: 0x203a, 0x8a: 0x2212, 0x8b: 0x2030, 0x8c: 0x201e,
          0x8d: 0x201c, 0x8e: 0x201d, 0x8f: 0x2018, 0x90: 0x2019, 0x91: 0x201a, 0x92: 0x2122, 0x93: 0xfb01, 0x94: 0xfb02, 0x95: 0x141, 0x96: 0x152,
          0x97: 0x160, 0x98: 0x178, 0x99: 0x17d, 0x9a: 0x131, 0x9b: 0x142, 0x9c: 0x153, 0x9d: 0x161, 0x9e: 0x17e, 0xa0: 0x20ac}
def pdfdoc(b): return "".join(chr(PDFDOC.get(c, c)) for c in b)
def check_table():
    # our table against pypdf's own (an independent copy of ISO 32000 Annex D)
    from pypdf._codecs import _pdfdoc_encoding as T
    bad = [c for c in PDFDOC if T[c] != chr(PDFDOC[c])]
    assert not bad, bad
STRINGS = [   # (label, raw bytes as written in the PDF, what a reader should show, "must" = ISO 32000, "info" = beyond it)
    ("pdfdoc-all", b"P:" + bytes(range(0x18, 0x20)) + bytes(range(0x80, 0x9f)) + b"\xa0", None, "must"),
    ("latin1-accents", b"L:" + bytes([c for c in range(0xa1, 0x100) if c != 0xad]), None, "must"),
    ("pdfdoc-mixed", b"Caf\xe9 \x85 na\xefve \x8dquoted\x8e \x93le \x80 \xa0 5", None, "must"),
    ("utf16-astral", b"\xfe\xff" + "U16: \u03a9 \u00fc \u65e5\u672c \U0001F527".encode("utf-16-be"), "U16: \u03a9 \u00fc \u65e5\u672c \U0001F527", "must"),
    ("utf16-empty", b"\xfe\xff", "", "must"),
    ("utf16-odd", b"\xfe\xff\x00A\x00B\x00", "AB", "info"),
    ("utf8-bom", b"\xef\xbb\xbf" + "U8: Stra\u00dfe \u2013 Tor 2 \U0001F527".encode(), "U8: Stra\u00dfe \u2013 Tor 2 \U0001F527", "must"),
    ("utf8-bom-empty", b"\xef\xbb\xbf", "", "must"),
    ("empty", b"", "", "must"),
    ("ascii", b"Plain ASCII words 123", "Plain ASCII words 123", "must"),
    ("undefined-codes", b"U:\x7f\x9f\xad.", "U:\x7f\x9f\xad.", "info"),
    ("utf16le-bom", b"\xff\xfe" + "LE text".encode("utf-16-le"), "LE text", "info"),
    ("utf16-lang-escape", b"\xfe\xff\x00\x1b\x65\x6e\x00\x1b" + "Hello".encode("utf-16-be"), "Hello", "info"),
]
def strings():
    check_table()
    exp = []
    for lab, raw, want, kind in STRINGS:
        if want is None: want = pdfdoc(raw[2:] if False else raw)
        exp.append({"label": lab, "want": want, "kind": kind})
    d = Doc()
    cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV); outl = d.add()
    items = [d.add() for _ in STRINGS]
    for k, (lab, raw, want, kind) in enumerate(STRINGS):
        d.set(items[k], "<< /Title %s /Parent %d 0 R /Dest [%d 0 R /Fit] %s %s >>" % (hexs(raw), outl, pg, "/Prev %d 0 R" % items[k - 1] if k else "",
                                                                                     "/Next %d 0 R" % items[k + 1] if k + 1 < len(items) else ""))
    d.set(outl, "<< /Type /Outlines /First %d 0 R /Last %d 0 R /Count %d >>" % (items[0], items[-1], len(items)))
    # a text field for each string (no drawing: NeedAppearances), labelled on the page; and a note whose words and author are it
    fields, annots, content = [], [], bt(72, 760, "Text strings", 14)
    for k, (lab, raw, want, kind) in enumerate(STRINGS):
        y = 730 - 26 * k
        content += bt(40, y + 4, "F%02d:" % k, 9)
        f = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (s%02d) /V %s /DA (/Helv 9 Tf 0 g) /Rect [80 %d 330 %d] /F 4 /P %d 0 R >>" % (k, hexs(raw), y, y + 16, pg))
        fields.append(f); annots.append(f)
        a = d.add("<< /Type /Annot /Subtype /Text /Rect [560 %d 576 %d] /Contents %s /T %s /NM (n%02d) >>" % (y, y + 16, hexs(b"C%02d=" % k + raw if raw[:2] not in (b"\xfe\xff", b"\xff\xfe") and raw[:3] != b"\xef\xbb\xbf" else raw), hexs(raw), k))
        annots.append(a)
    # a list box whose display texts are PDFDocEncoding, its export values plain
    ch = d.add("<< /Type /Annot /Subtype /Widget /FT /Ch /T (pick) /V (b) /Opt [[(a) (Alpha \\205 one)] [(b) (Beta \\223 \\224 two)]] /DA (/Helv 9 Tf 0 g) /Rect [350 30 560 46] /F 4 /P %d 0 R >>" % pg)
    fields.append(ch); annots.append(ch)
    ocg = d.add("<< /Type /OCG /Name (Layer \\205 B\\351ta) >>")
    cs = d.add(("<< /Length LEN >>", (content + "/OC /L0 BDC " + bt(350, 10, "LAYER-TEXT", 8) + "EMC\n").encode()))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /Outlines %d 0 R /OCProperties << /OCGs [%d 0 R] /D << >> >> /AcroForm << /Fields [%s] /NeedAppearances true /DR << /Font << /Helv %d 0 R >> >> >> >>"
          % (pages, outl, ocg, " ".join("%d 0 R" % f for f in fields), font))
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
    d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /Properties << /L0 %d 0 R >> >> /Annots [%s] >>"
          % (pages, cs, font, ocg, " ".join("%d 0 R" % a for a in annots)))
    info = d.add("<< /Title %s /Author (hand) >>" % hexs(STRINGS[2][1]))
    d.write("strings.pdf", cat, "/Info %d 0 R" % info)
    # Info titles in each form, one file each (a title is one string)
    for lab, raw in [("utf8", STRINGS[6][1]), ("utf16", STRINGS[3][1]), ("pdfdoc", STRINGS[0][1]), ("latin1", STRINGS[1][1]), ("fe_ff_only", b"\xfe\xff"), ("empty", b"")]:
        d = Doc(); d.add("<< /Type /Catalog /Pages 2 0 R >>"); d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
        d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>")
        d.add(("<< /Length LEN >>", bt(72, 700, "Title test " + lab).encode())); d.add(HELV); d.add("<< /Title %s >>" % hexs(raw))
        d.write("title_%s.pdf" % lab, 1, "/Info 6 0 R")
    EXPECT["strings"] = exp
    EXPECT["pick"] = "Beta \ufb01 \ufb02 two"
    EXPECT["layer_name"] = "Layer \u2013 B\u00e9ta"

# ================================================================ 3. PASSWORDS
# the password as a person types it, and the bytes each kind of maker stores for revisions 2-4
PW = [("facade", "fa\u00e7ade", {"pdfdoc": "fa\u00e7ade".encode("latin-1")}),
      ("euro", "\u20acuro-5", {"pdfdoc": b"\xa0uro-5", "cp1252": b"\x80uro-5", "utf8": "\u20acuro-5".encode()}),
      ("endash", "en\u2013dash", {"pdfdoc": b"en\x85dash", "cp1252": b"en\x96dash", "utf8": "en\u2013dash".encode()}),
      ("quotes", "\u201cq\u201d", {"pdfdoc": b"\x8dq\x8e", "cp1252": b"\x93q\x94", "utf8": "\u201cq\u201d".encode()}),
      ("oe", "\u0152uvre", {"pdfdoc": b"\x96uvre", "cp1252": b"\x8cuvre", "utf8": "\u0152uvre".encode()}),
      ("cyrillic", "\u041f\u0430\u0440\u043e\u043b\u044c", {"utf8": "\u041f\u0430\u0440\u043e\u043b\u044c".encode()}),
      ("cjk", "\u5bc6\u7801", {"utf8": "\u5bc6\u7801".encode()})]
ALG = {"R2": "RC4-40", "R3": "RC4-128", "R4": "AES-128"}
def passwords():
    c = canvas.Canvas(P("_pwbase.pdf"), pagesize=(612, 792)); c.setTitle("Password Test")
    c.setFont("Helvetica", 14); c.drawString(72, 700, "Password test page: the lock opened."); c.showPage(); c.save()
    base = P("_pwbase.pdf"); cases = []
    for key, typed, enc in PW:
        for how, b in enc.items():
            for rev in (["R2", "R3", "R4"] if key in ("euro", "facade") else ["R3"]):
                name = "pw_%s_%s_%s_user.pdf" % (rev, key, how)
                w = PdfWriter(clone_from=base); w.encrypt(user_password=b, owner_password=b"chief-owner", algorithm=ALG[rev])
                w.write(P(name)); cases.append({"file": name, "typed": typed, "as": "user", "stored": how, "rev": rev})
            # the same bytes as the OWNER password (user password "u1"): the person types the owner's
            name = "pw_R3_%s_%s_owner.pdf" % (key, how)
            w = PdfWriter(clone_from=base); w.encrypt(user_password=b"u1", owner_password=b, algorithm="RC4-128")
            w.write(P(name)); cases.append({"file": name, "typed": typed, "as": "owner", "stored": how, "rev": "R3"})
    # qpdf's own choice of bytes (PDFDocEncoding when it can, else UTF-8 with a warning) and AES-256 (UTF-8, SASLprep)
    for key, typed in [("euro_mix", "\u20acuro\u2013\u201cq\u201d"), ("cyrillic", "\u041f\u0430\u0440\u043e\u043b\u044c"), ("cjk", "\u5bc6\u7801"),
                       ("emoji", "\U0001F527tool"), ("tm", "Brand\u2122"), ("sup2", "x\u00b2y"), ("nfd", "Cafe\u0301")]:
        for rev, extra in [("R4", ["128", "--use-aes=y"]), ("R6", ["256"])]:
            name = "pwq_%s_%s.pdf" % (rev, key)
            sh("qpdf", "--encrypt", typed, "chief-owner", *extra, "--", base, P(name)); cases.append({"file": name, "typed": typed, "as": "user", "stored": "qpdf", "rev": rev})
        name = "pwp_R6_%s.pdf" % key
        w = PdfWriter(clone_from=base); w.encrypt(user_password=typed, owner_password="chief-owner", algorithm="AES-256"); w.write(P(name))
        cases.append({"file": name, "typed": typed, "as": "user", "stored": "pypdf", "rev": "R6"})
    # a V4 lock with RC4 whose crypt filter has no /Length (the key length then comes from the /Length of the lock itself:
    # 128 bits). Made from qpdf's --force-V4 by blanking the crypt filter's /Length (offsets unchanged)
    sh("qpdf", "--allow-weak-crypto", "--encrypt", "", "chief-owner", "128", "--use-aes=n", "--force-V4", "--", base, P("v4_rc4_nocflen.pdf"))
    raw = open(P("v4_rc4_nocflen.pdf"), "rb").read()
    m = re.search(rb"/CF\s*<<\s*/StdCF\s*<<[^>]*?(/Length\s+16)", raw)
    if m:
        raw = raw[:m.start(1)] + b" " * len(m.group(1)) + raw[m.end(1):]
        open(P("v4_rc4_nocflen.pdf"), "wb").write(raw)
    cases.append({"file": "v4_rc4_nocflen.pdf", "typed": "", "as": "none", "stored": "-", "rev": "R4", "patched": bool(m)})
    os.remove(base)
    EXPECT["passwords"] = cases

# ================================================================ 4. BLEND MODES AND SEE-THROUGH ANNOTATIONS
BLENDS = [("Normal", "1 1 0"), ("Multiply", "1 1 0"), ("Screen", "0 0 1"), ("Darken", "1 0 0"), ("Lighten", "0 1 0"), ("Difference", "1 1 1"),
          ("[/Multiply /Normal]", "1 1 0"), ("[/NoSuchMode /Multiply]", "1 1 0"), ("Compatible", "1 0 1"), ("Multiply-ca50", "1 1 0")]
def blends():
    d = Doc()
    cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV)
    gs = {}
    for k, (bm, col) in enumerate(BLENDS):
        mode = bm if bm.startswith("[") else "/" + bm.split("-")[0]
        gs["G%d" % k] = d.add("<< /Type /ExtGState /BM %s %s >>" % (mode, "/ca 0.5" if bm.endswith("ca50") else ""))
    gs["GN"] = d.add("<< /Type /ExtGState /BM /Normal /ca 1 /CA 1 >>")
    content = "0 g 40 700 540 10 re f\n"   # the black bar every box straddles
    for k, (bm, col) in enumerate(BLENDS):
        x = 45 + 54 * k
        content += "q /G%d gs %s rg %d 690 44 40 re f Q\n" % (k, col, x)
    # after a Q the blend mode is Normal again: a white box over the bar must cover it
    content += "1 g 45 600 200 10 re 0 g 40 600 540 10 re f 1 g 100 590 100 30 re f\n"
    content += "/GN gs 0 g 40 520 540 10 re f\n"   # Word and Ghostscript write /BM /Normal: no change
    content += bt(72, 760, "Blend modes over a black bar", 14)
    cs = d.add(("<< /Length LEN >>", content.encode()))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R >>" % pages)
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
    d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /ExtGState << %s >> >> >>"
          % (pages, cs, font, " ".join("/%s %d 0 R" % (k, v) for k, v in gs.items())))
    d.write("blend_page.pdf", cat)
    EXPECT["blends"] = [b for b, c in BLENDS]
    # annotations with their own drawings: blend modes, /CA over fills, over text in a font the PDF does not carry, over a picture
    d = Doc()
    cat = d.add(); pages = d.add(); p1 = d.add(); p2 = d.add(); p3 = d.add(); font = d.add(HELV)
    def ap(bbox, data, res=""): return d.add(("<< /Type /XObject /Subtype /Form /BBox [%s] /Resources << %s >> /Length LEN >>" % (bbox, res), data))
    gmul = d.add("<< /Type /ExtGState /BM [/Multiply] >>"); gscr = d.add("<< /Type /ExtGState /BM /Screen >>"); gdark = d.add("<< /Type /ExtGState /BM /Darken >>")
    A = []
    def ann(s): n = d.add(s); A.append(n); return n
    # 1-3: a highlight's drawing in Multiply (array form), a Screen box, a Darken box, each over black words on page 1
    ann("<< /Type /Annot /Subtype /Highlight /Rect [70 676 330 700] /QuadPoints [70 700 330 700 70 676 330 676] /C [1 1 0] /AP << /N %d 0 R >> >>"
        % ap("0 0 260 24", b"/G gs 1 1 0 rg 0 0 260 24 re f", "/ExtGState << /G %d 0 R >>" % gmul))
    ann("<< /Type /Annot /Subtype /Square /Rect [70 616 330 640] /AP << /N %d 0 R >> >>" % ap("0 0 260 24", b"/G gs 0 0 1 rg 0 0 260 24 re f", "/ExtGState << /G %d 0 R >>" % gscr))
    ann("<< /Type /Annot /Subtype /Square /Rect [70 556 330 580] /AP << /N %d 0 R >> >>" % ap("0 0 260 24", b"/G gs 1 0 0 rg 0 0 260 24 re f", "/ExtGState << /G %d 0 R >>" % gdark))
    # 4: a box drawn by its appearance, annotation /CA 0.5
    ann("<< /Type /Annot /Subtype /Square /Rect [400 616 520 640] /CA 0.5 /AP << /N %d 0 R >> >>" % ap("0 0 120 24", b"0 0 1 rg 0 0 120 24 re f"))
    # 5: a typed comment drawn by its appearance in Helvetica (not carried by the PDF), /CA 0.3: the words faint
    ann("<< /Type /Annot /Subtype /FreeText /Rect [400 500 580 540] /CA 0.3 /Contents (FADED NOTE) /DA (/Helv 20 Tf 0 g) /AP << /N %d 0 R >> >>"
        % ap("0 0 180 40", b"BT /Helv 20 Tf 0 g 4 12 Td (FADED NOTE) Tj ET", "/Font << /Helv %d 0 R >>" % font))
    # 6: a stamp whose appearance is a picture (black), /CA 0.5
    img = d.add(("<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length LEN >>", b"\x00" * 16))
    ann("<< /Type /Annot /Subtype /Stamp /Rect [400 420 520 470] /CA 0.5 /AP << /N %d 0 R >> >>" % ap("0 0 120 50", b"q 120 0 0 50 0 0 cm /Im Do Q", "/XObject << /Im %d 0 R >>" % img))
    c1 = (bt(72, 760, "Annotations drawn with blend modes and opacity", 14) + bt(74, 682, "WORDS UNDER MULTIPLY", 16) + bt(74, 622, "WORDS UNDER SCREEN", 16)
          + bt(74, 562, "WORDS UNDER DARKEN", 16)).encode()
    cs1 = d.add(("<< /Length LEN >>", c1))
    # page 2: the page's own drawing leaves Multiply set at the top level (no q/Q); a field's drawing (white box, black
    # value) over a black band must still cover it (each annotation starts from a fresh graphics state)
    gtop = d.add("<< /Type /ExtGState /BM /Multiply >>")
    w2 = d.add("<< /Type /Annot /Subtype /Square /Rect [100 600 300 640] /AP << /N %d 0 R >> >>" % ap("0 0 200 40", b"1 g 0 0 200 40 re f 0 g BT /Helv 14 Tf 10 14 Td (COVER) Tj ET", "/Font << /Helv %d 0 R >>" % font))
    cs2 = d.add(("<< /Length LEN >>", ("/GT gs 0 g 50 590 500 60 re f\n" + bt(72, 760, "Top-level blend left set", 14)).encode()))
    # page 3: the page's drawing leaves a clip at the top level (no q/Q); an annotation outside it must still show
    w3 = d.add("<< /Type /Annot /Subtype /Square /Rect [300 300 400 400] /C [1 0 0] /IC [1 0 0] /AP << /N %d 0 R >> >>" % ap("0 0 100 100", b"1 0 0 rg 0 0 100 100 re f"))
    cs3 = d.add(("<< /Length LEN >>", (bt(72, 760, "Top-level clip left set", 14) + "50 50 100 100 re W n 0 g 50 50 100 100 re f\n").encode()))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R >>" % pages)
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R %d 0 R %d 0 R] /Count 3 >>" % (p1, p2, p3))
    d.set(p1, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Annots [%s] >>"
          % (pages, cs1, font, " ".join("%d 0 R" % a for a in A)))
    d.set(p2, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /ExtGState << /GT %d 0 R >> >> /Annots [%d 0 R] >>"
          % (pages, cs2, font, gtop, w2))
    d.set(p3, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Annots [%d 0 R] >>" % (pages, cs3, font, w3))
    d.write("blend_annots.pdf", cat)

# ================================================================ 5. LAYERS: visibility expressions, hidden pictures and forms
VE = [("AND-A-C", "[/And A C]"), ("AND-A-B", "[/And A B]"), ("OR-B-D", "[/Or B D]"), ("OR-B-C", "[/Or B C]"), ("NOT-A", "[/Not A]"), ("NOT-B", "[/Not B]"),
      ("NOT-AND-A-B", "[/Not [/And A B]]"), ("AND-A-OR-B-C", "[/And A [/Or B C]]"), ("AND-A-NOT-OR-B-C", "[/And A [/Not [/Or B C]]]"),
      ("OR-ANDBC-ANDANOTD", "[/Or [/And B C] [/And A [/Not D]]]"), ("TEN-NOTS-B", "[/Not " * 10 + "B" + "]" * 10),
      ("AND-A-REF-NOT-D", "[/And A REF1]"), ("VE-REF-OR-B-D", "REF2"), ("EMPTY-VE-ALLON-A", "EMPTY_A"), ("EMPTY-VE-B", "EMPTY_B"),
      ("AND-A-B-C", "[/And A B C]"), ("VE-OVER-P-NOT-C", "P_NOT_C")]
def ve_eval(e, on):
    if isinstance(e, str): return on[e]
    op, rest = e[0], [ve_eval(x, on) for x in e[1:]]
    return (not rest[0]) if op == "Not" else all(rest) if op == "And" else any(rest)
def ve_parse(s):
    toks = re.findall(r"\[|\]|/\w+|\w+", s); pos = [0]
    def val():
        t = toks[pos[0]]; pos[0] += 1
        if t == "[":
            out = []
            while toks[pos[0]] != "]": out.append(val())
            pos[0] += 1; return out
        return t.lstrip("/")
    return val()
VE_TREE = {"REF1": ["And", "A", ["Not", "D"]], "REF2": ["Or", "B", "D"], "EMPTY_A": "A", "EMPTY_B": "B", "P_NOT_C": ["Not", "C"]}
def layers():
    d = Doc()
    cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV)
    G = {k: d.add("<< /Type /OCG /Name (Layer %s) >>" % k) for k in "ABCD"}
    r1 = d.add("[/Not %d 0 R]" % G["D"]); r2 = d.add("[/Or %d 0 R %d 0 R]" % (G["B"], G["D"]))
    props, content, exp = {}, bt(72, 770, "VE-HEADER", 10), []
    for k, (lab, ve) in enumerate(VE):
        if ve == "EMPTY_A": dic = "/VE [] /OCGs [%d 0 R] /P /AllOn" % G["A"]; tree = "A"
        elif ve == "EMPTY_B": dic = "/VE [] /OCGs [%d 0 R]" % G["B"]; tree = "B"
        elif ve == "P_NOT_C": dic = "/OCGs [%d 0 R %d 0 R] /P /AllOn /VE [/Not %d 0 R]" % (G["A"], G["C"], G["C"]); tree = ["Not", "C"]
        elif ve == "REF2": dic = "/VE %d 0 R" % r2; tree = VE_TREE["REF2"]
        else:
            tree = ve_parse(ve)
            if ve == "[/And A REF1]": tree = ["And", "A", VE_TREE["REF1"]]
            s = ve
            for g in "ABCD": s = re.sub(r"(?<=[\s\[])%s(?=[\s\]])" % g, "%d 0 R" % G[g], s)
            s = s.replace("REF1", "%d 0 R" % r1)
            dic = "/VE %s" % s
        props["M%d" % k] = d.add("<< /Type /OCMD %s >>" % dic)
        y = 740 - 26 * k
        content += "/OC /M%d BDC %s 0 0 1 rg 420 %d 120 14 re f 0 g EMC\n" % (k, bt(72, y, lab), y - 2)
        exp.append({"label": lab, "tree": tree, "y": y})
    cs = d.add(("<< /Length LEN >>", content.encode()))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /OCProperties << /OCGs [%s] /D << /Order [%s] /OFF [%d 0 R %d 0 R] >> >> >>"
          % (pages, " ".join("%d 0 R" % G[k] for k in "ABCD"), " ".join("%d 0 R" % G[k] for k in "ABCD"), G["B"], G["D"]))
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
    d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /Properties << %s /LA %d 0 R /LB %d 0 R >> >> >>"
          % (pages, cs, font, " ".join("/%s %d 0 R" % kv for kv in props.items()), G["A"], G["B"]))
    d.write("ve_shapes.pdf", cat)
    EXPECT["ve"] = exp
    # hidden pictures and forms on a scanned page (layer H off, layer V on)
    d = Doc()
    cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV)
    H = d.add("<< /Type /OCG /Name (Hidden marks) >>"); V = d.add("<< /Type /OCG /Name (Visible marks) >>")
    mnot = d.add("<< /Type /OCMD /VE [/Not %d 0 R] >>" % V)
    scan = d.add(("<< /Type /XObject /Subtype /Image /Width 61 /Height 79 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length LEN >>", b"\xe0" * (61 * 79)))
    mark = d.add(("<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length LEN >>", b"\x00" * 16))
    markoc = d.add(("<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8 /OC %d 0 R /Length LEN >>" % mnot, b"\x00" * 16))
    def form(data, res, extra=""):
        return d.add(("<< /Type /XObject /Subtype /Form /BBox [0 0 612 792] %s /Resources << %s >> /Length LEN >>" % (extra, res), data.encode()))
    R_IMG = "/XObject << /Mk %d 0 R >> /Font << /F1 %d 0 R >>" % (mark, font)
    f1 = form("q 100 0 0 60 60 650 cm /Mk Do Q " + bt(60, 630, "HID-1 form in hidden BDC"), R_IMG)                      # 1: drawn inside a hidden BDC
    f3 = form("q 100 0 0 60 360 650 cm /Mk Do Q " + bt(360, 630, "HID-3 form with own OC"), R_IMG, "/OC %d 0 R" % H)    # 3: the form's own /OC off
    f4 = form("/OC /HH BDC q 100 0 0 60 60 530 cm /Mk Do Q " + bt(60, 510, "HID-4 BDC inside a visible form") + "EMC", R_IMG + " /Properties << /HH %d 0 R >>" % H)
    f5 = form("/OC /PH BDC q 100 0 0 60 360 530 cm /Mk Do Q " + bt(360, 510, "HID-5 page property") + "EMC", R_IMG)   # 5: property only in the page's resources
    f6b = form("q 100 0 0 60 60 410 cm /Mk Do Q " + bt(60, 390, "HID-6 nested form"), R_IMG)
    f6a = form("/OC /HH BDC /Inner Do EMC " + bt(60, 370, "VIS-6 outer form words"), "/XObject << /Inner %d 0 R >> /Font << /F1 %d 0 R >> /Properties << /HH %d 0 R >>" % (f6b, font, H))
    content = ("q 612 0 0 792 0 0 cm /Scan Do Q\n" + bt(72, 760, "Scanned page with hidden marks", 12)
               + "/OC /PH BDC /F1x Do EMC\n"
               + "q 100 0 0 60 360 410 cm /MkOC Do Q\n"          # 2: a picture whose own /OC is an OCMD /VE [/Not V] (V on: hidden)
               + "/F3x Do /F4x Do /F5x Do /F6x Do\n"
               + "q 100 0 0 60 360 290 cm /Mk Do Q\n" + bt(360, 270, "VIS-CONTROL"))   # 7: a visible mark, the control
    cs = d.add(("<< /Length LEN >>", content.encode()))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /OCProperties << /OCGs [%d 0 R %d 0 R] /D << /OFF [%d 0 R] >> >> >>" % (pages, H, V, H))
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
    d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /Properties << /PH %d 0 R >> "
              "/XObject << /Scan %d 0 R /Mk %d 0 R /MkOC %d 0 R /F1x %d 0 R /F3x %d 0 R /F4x %d 0 R /F5x %d 0 R /F6x %d 0 R >> >> >>"
          % (pages, cs, font, H, scan, mark, markoc, f1, f3, f4, f5, f6a))
    d.write("hidden_marks.pdf", cat)
    # a visibility expression that names itself twice (damaged) and a legal one whose parts are shared 22 deep (2^22 paths)
    for name, kind in [("ve_cycle.pdf", "cycle"), ("ve_shared_dag.pdf", "dag")]:
        d = Doc()
        cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV); A_ = d.add("<< /Type /OCG /Name (A) >>")
        if kind == "cycle":
            top = d.add(); d.set(top, "[/And %d 0 R %d 0 R]" % (top, top))
        else:
            prev = A_
            for k in range(22):
                cur = d.add("[/Or %d 0 R %d 0 R]" % (prev, prev)) if k else d.add("[/And %d 0 R %d 0 R]" % (A_, A_)); prev = cur
            top = prev
        m = d.add("<< /Type /OCMD /VE %d 0 R >>" % top)
        cs = d.add(("<< /Length LEN >>", ("/OC /M BDC " + bt(72, 700, "INSIDE-VE") + "EMC " + bt(72, 650, "OUTSIDE")).encode()))
        d.set(cat, "<< /Type /Catalog /Pages %d 0 R /OCProperties << /OCGs [%d 0 R] /D << >> >> >>" % (pages, A_))
        d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
        d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /Properties << /M %d 0 R >> >> >>" % (pages, cs, font, m))
        d.write(name, cat)
    # marked content and q/Q interleaved (legal: the standard asks BDC/EMC to nest with each other, not with q/Q); and,
    # separately, a blend mode set inside a hidden part (its state still applies after it, ISO 32000-2 8.11.3.3)
    for name, content in [("interleave_clip.pdf", bt(72, 760, "Interleaved q and BDC", 12) + "q 0 0 50 50 re W n /OC /O BDC Q EMC\n1 0 0 rg 200 500 200 100 re f\n"
                           + bt(72, 300, "AFTER-THE-CLIP")),
                          ("hidden_gs.pdf", bt(72, 760, "A blend mode set while hidden", 12) + "0 g 40 300 540 10 re f\n/OC /O BDC /GM gs EMC\n1 1 0 rg 100 290 100 30 re f\n")]:
        d = Doc()
        cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV); O = d.add("<< /Type /OCG /Name (Off) >>")
        gm = d.add("<< /Type /ExtGState /BM /Multiply >>")
        cs = d.add(("<< /Length LEN >>", content.encode()))
        d.set(cat, "<< /Type /Catalog /Pages %d 0 R /OCProperties << /OCGs [%d 0 R] /D << /OFF [%d 0 R] >> >> >>" % (pages, O, O))
        d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
        d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /Properties << /O %d 0 R >> /ExtGState << /GM %d 0 R >> >> >>"
              % (pages, cs, font, O, gm))
        d.write(name, cat)
    # damaged layer settings, one fault a file: /OCGs a dictionary; /D /ON and /OFF dictionaries; /VE with numbers and strings
    for name, ocp, ve in [("damaged_ocgs_dict.pdf", "/OCGs << /x A_ >> /D << >>", "[/Not A_]"), ("damaged_onoff_dict.pdf", "/OCGs [A_] /D << /ON << /a 1 >> /OFF << /b 2 >> >>", "[/Not A_]"),
                          ("damaged_ve_odd.pdf", "/OCGs [A_] /D << >>", "[/And 5 (x) [/Not] [/Or]]")]:
        d = Doc()
        cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV); A_ = d.add("<< /Type /OCG /Name (A) >>")
        m = d.add("<< /Type /OCMD /VE %s >>" % ve.replace("A_", "%d 0 R" % A_))
        cs = d.add(("<< /Length LEN >>", (bt(72, 740, "Damaged layers page") + "/OC /M BDC " + bt(72, 700, "ODD-VE") + "EMC /OC /A BDC " + bt(72, 650, "A-PART") + "EMC").encode()))
        d.set(cat, "<< /Type /Catalog /Pages %d 0 R /OCProperties << %s >> >>" % (pages, ocp.replace("A_", "%d 0 R" % A_)))
        d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
        d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> /Properties << /M %d 0 R /A %d 0 R >> >> >>" % (pages, cs, font, m, A_))
        d.write(name, cat)

# ================================================================ 5b. NAMES AND LINKS: a name tree whose keys hold bytes 0x80-0xA0
def nav():
    d = Doc()
    cat = d.add(); pages = d.add(); font = d.add(HELV)
    pg = [d.add() for _ in range(4)]
    for k in range(4):
        cs = d.add(("<< /Length LEN >>", bt(72, 700, "Names page %d" % (k + 1), 20).encode()))
        d.set(pg[k], "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> %s >>"
              % (pages, cs, font, "/Annots [LINKS]" if k == 0 else ""))
    # keys sorted byte by byte as the standard asks: (caf) < (caf\205) < (caf\245) ; (zed)
    k1 = d.add("<< /Limits [(caf) (caf\\245)] /Names [(caf) [%d 0 R /Fit] (caf\\205) [%d 0 R /Fit] (caf\\245) [%d 0 R /Fit]] >>" % (pg[1], pg[2], pg[3]))
    k2 = d.add("<< /Limits [(zed) (zed)] /Names [(zed) [%d 0 R /Fit]] >>" % pg[1])
    root = d.add("<< /Kids [%d 0 R %d 0 R] >>" % (k1, k2))
    links = [d.add("<< /Type /Annot /Subtype /Link /Rect [72 600 200 620] /Border [0 0 0] /Dest (caf\\205) >>"),
             d.add("<< /Type /Annot /Subtype /Link /Rect [72 560 200 580] /Border [0 0 0] /Dest (caf\\245) >>"),
             d.add("<< /Type /Annot /Subtype /Link /Rect [72 520 200 540] /Border [0 0 0] /A << /S /URI /URI (https://example.org/caf\\303\\251) >> >>")]
    d.set(pg[0], d.objs[pg[0] - 1].replace("LINKS", " ".join("%d 0 R" % n for n in links)))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /Names << /Dests %d 0 R >> >>" % (pages, root))
    d.set(pages, "<< /Type /Pages /Kids [%s] /Count 4 >>" % " ".join("%d 0 R" % n for n in pg))
    d.write("nav_names_bytes.pdf", cat)
    # a plain PDF carrying another, locked PDF as an attachment (pypdf stores attachments unpacked)
    c = canvas.Canvas(P("_outer.pdf"), pagesize=(612, 792)); c.setTitle("Binder")
    c.setFont("Helvetica", 16); c.drawString(72, 700, "Binder page: see the attached locked manual"); c.showPage(); c.save()
    c = canvas.Canvas(P("_inner.pdf"), pagesize=(612, 792)); c.drawString(72, 700, "Inner locked manual"); c.showPage(); c.save()
    sh("qpdf", "--encrypt", "inner", "innerown", "128", "--use-aes=y", "--", P("_inner.pdf"), P("_inner_locked.pdf"))
    w = PdfWriter(clone_from=P("_outer.pdf")); w.add_attachment("manual.pdf", open(P("_inner_locked.pdf"), "rb").read()); w.write(P("attach_locked_pdf.pdf"))
    # the same binder after an ordinary later save (an update adding a 6 kB note), so the attachment is not near the file's end
    raw = open(P("attach_locked_pdf.pdf"), "rb").read(); tb = trailer_bits(P("attach_locked_pdf.pdf"))
    open(P("attach_locked_pdf_saved.pdf"), "wb").write(append_update(raw, {tb["Size"]: "<< /Note (%s) >>" % ("n" * 6000)},
                                                                    "/Size %d /Root %s /Info %s /ID [%s]" % (tb["Size"] + 1, tb["Root"], tb["Info"], tb["ID"])))
    for f in ["_outer.pdf", "_inner.pdf", "_inner_locked.pdf"]: os.remove(P(f))

# ================================================================ 6. FORMS
def forms():
    d = Doc()
    cat = d.add(); pages = d.add(); p1 = d.add(); p2 = d.add(); font = d.add(HELV)
    zadb = d.add("<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats >>")
    on_ap = d.add(("<< /Type /XObject /Subtype /Form /BBox [0 0 16 16] /Length LEN >>", b"0 g 3 3 10 10 re f"))
    off_ap = d.add(("<< /Type /XObject /Subtype /Form /BBox [0 0 16 16] /Length LEN >>", b""))
    A1, A2, fields = [], [], []
    def w(page_list, s): n = d.add(s); page_list.append(n); return n
    # a radio group across two pages: North, South on page 1, East on page 2 (East chosen)
    route = d.add(); rk = []
    for nm, x, pl, pgn, y in [("North", 150, A1, p1, 700), ("South", 250, A1, p1, 700), ("East", 150, A2, p2, 700)]:
        rk.append(w(pl, "<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [%d %d %d %d] /F 4 /P %d 0 R /AS /%s /AP << /N << /%s %d 0 R /Off %d 0 R >> >> >>"
                    % (route, x, y, x + 16, y + 16, pgn, nm if nm == "East" else "Off", nm, on_ap, off_ap)))
    d.set(route, "<< /FT /Btn /Ff 49152 /T (route) /V /East /Kids [%s] >>" % " ".join("%d 0 R" % k for k in rk)); fields.append(route)
    # a radio group as Acrobat writes it with /Opt: on-names /0 /1 /2, the export values in /Opt
    dirf = d.add(); dk = []
    for i, x in enumerate([150, 250, 350]):
        dk.append(w(A1, "<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [%d 660 %d 676] /F 4 /P %d 0 R /AS /%s /AP << /N << /%d %d 0 R /Off %d 0 R >> >> >>"
                    % (dirf, x, x + 16, p1, "1" if i == 1 else "Off", i, on_ap, off_ap)))
    d.set(dirf, "<< /FT /Btn /Ff 49152 /T (dir) /V /1 /Opt [(Upstream) (Downstream) (Bypass)] /Kids [%s] >>" % " ".join("%d 0 R" % k for k in dk)); fields.append(dirf)
    # check boxes with odd on-names, with and without drawings
    odd = [("sp", "/On#20Site", True), ("si", "/S#C3#AD", True), ("zero", "/0", True), ("up", "/YES", True)]
    for t, nm, ap in odd:
        k = len(fields)
        fields.append(w(A1, "<< /Type /Annot /Subtype /Widget /FT /Btn /T (%s) /V %s /AS %s /AP << /N << %s %d 0 R /Off %d 0 R >> >> /Rect [150 %d 166 %d] /F 4 /P %d 0 R >>"
                        % (t, nm, nm, nm, on_ap, off_ap, 620 - 30 * (k - 2), 636 - 30 * (k - 2), p1)))
    fields.append(w(A1, "<< /Type /Annot /Subtype /Widget /FT /Btn /T (oui_noap) /V /Oui /AS /Oui /DA (/ZaDb 0 Tf 0 g) /Rect [150 500 166 516] /F 4 /P %d 0 R >>" % p1))
    fields.append(w(A1, "<< /Type /Annot /Subtype /Widget /FT /Btn /T (oui_vonly) /V /Oui /DA (/ZaDb 0 Tf 0 g) /Rect [150 470 166 486] /F 4 /P %d 0 R >>" % p1))
    # a check-box "group": one field, two boxes with different on-names (B chosen)
    grp = d.add(); gk = []
    for i, (nm, x) in enumerate([("A", 150), ("B", 250)]):
        gk.append(w(A1, "<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [%d 440 %d 456] /F 4 /P %d 0 R /AS /%s /AP << /N << /%s %d 0 R /Off %d 0 R >> >> >>"
                    % (grp, x, x + 16, p1, nm if nm == "B" else "Off", nm, on_ap, off_ap)))
    d.set(grp, "<< /FT /Btn /T (pair) /V /B /Kids [%s] >>" % " ".join("%d 0 R" % k for k in gk)); fields.append(grp)
    # comb fields (no drawings: the viewer spaces the letters one per cell)
    combs = [("c1", 1, "Z", 150, 40), ("c4", 4, "12", 150, 160), ("c6", 6, "ABCDEF", 150, 240), ("c10", 10, "0123456789ABC", 150, 300)]
    for k, (t, ml, v, x, wd) in enumerate(combs):
        y = 400 - 30 * k
        fields.append(w(A1, "<< /Type /Annot /Subtype /Widget /FT /Tx /Ff 16777216 /MaxLen %d /T (%s) /V (%s) /DA (/Helv 12 Tf 0 g) /Rect [%d %d %d %d] /F 4 /P %d 0 R >>"
                        % (ml, t, v, x, y, x + wd, y + 20, p1)))
    combp = d.add(); ck = w(A1, "<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [150 250 350 270] /F 4 /P %d 0 R >>" % (combp, p1))
    d.set(combp, "<< /FT /Tx /Ff 16777216 /MaxLen 5 /T (cinh) /V (98765) /DA (/Helv 12 Tf 0 g) /Kids [%d 0 R] >>" % ck); fields.append(combp)
    fields.append(w(A1, "<< /Type /Annot /Subtype /Widget /FT /Tx /Ff %d /MaxLen 4 /T (cml) /V (AB) /DA (/Helv 12 Tf 0 g) /Rect [150 210 350 240] /F 4 /P %d 0 R >>" % (16777216 | 4096, p1)))
    # one field shown on two pages whose second widget carries a /V of its own (writers that merge field and widget do this)
    two = d.add()
    tw1 = w(A1, "<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [150 170 400 190] /F 4 /P %d 0 R >>" % (two, p1))
    tw2 = w(A2, "<< /Type /Annot /Subtype /Widget /Parent %d 0 R /V (Beta-on-widget) /Rect [150 650 400 670] /F 4 /P %d 0 R >>" % (two, p2))
    d.set(two, "<< /FT /Tx /T (twice) /V (Alpha-on-field) /DA (/Helv 12 Tf 0 g) /Kids [%d 0 R %d 0 R] >>" % (tw1, tw2)); fields.append(two)
    # a text field whose value is a text stream (allowed for long values)
    vs = d.add(("<< /Length LEN >>", b"Value kept in a stream"))
    fields.append(w(A1, "<< /Type /Annot /Subtype /Widget /FT /Tx /T (streamv) /V %d 0 R /DA (/Helv 12 Tf 0 g) /Rect [150 130 450 150] /F 4 /P %d 0 R >>" % (vs, p1)))
    labels = (bt(72, 704, "Route:") + bt(72, 664, "Dir:") + "".join(bt(72, 624 - 30 * i, t + ":") for i, (t, _, _) in enumerate(odd)) + bt(72, 504, "Oui:") + bt(72, 474, "OuiV:")
              + bt(72, 444, "Pair:") + "".join(bt(72, 404 - 30 * k, c[0] + ":") for k, c in enumerate(combs)) + bt(72, 254, "Cinh:") + bt(72, 214, "Cml:")
              + bt(72, 174, "Twice:") + bt(72, 134, "Stream:"))
    cs1 = d.add(("<< /Length LEN >>", (bt(72, 760, "Forms two", 14) + labels).encode()))
    cs2 = d.add(("<< /Length LEN >>", (bt(72, 704, "Route p2:") + bt(72, 654, "Twice p2:")).encode()))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /AcroForm << /Fields [%s] /NeedAppearances true /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv %d 0 R /ZaDb %d 0 R >> >> >> >>"
          % (pages, " ".join("%d 0 R" % f for f in fields), font, zadb))
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R %d 0 R] /Count 2 >>" % (p1, p2))
    d.set(p1, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Annots [%s] >>" % (pages, cs1, font, " ".join("%d 0 R" % a for a in A1)))
    d.set(p2, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Annots [%s] >>" % (pages, cs2, font, " ".join("%d 0 R" % a for a in A2)))
    d.write("forms2.pdf", cat)
    EXPECT["combs"] = [{"name": t, "maxlen": ml, "value": v, "rect": [x, 400 - 30 * k, x + wd, 420 - 30 * k]} for k, (t, ml, v, x, wd) in enumerate(combs)] + \
                      [{"name": "cinh", "maxlen": 5, "value": "98765", "rect": [150, 250, 350, 270]}]

# ================================================================ 7. SCANNED PAGES WITH THINGS ON TOP (Text Reader)
SMALL = ["Item %d  bearing seal kit part %d%03d torque %d Nm grease every %d hours" % (i + 1, 40 + i, 17 * i % 1000, 12 + 3 * i, 250 * (1 + i % 4)) for i in range(40)]
def scans():
    EXPECT["small_lines"] = SMALL
    fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
    def scan_img(dpi):
        W, H = int(8.5 * dpi), int(11 * dpi)
        im = Image.new("L", (W, H), 255); g = ImageDraw.Draw(im)
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", int(34 * dpi / 150))
        fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", int(14 * dpi / 150))
        for i, line in enumerate(["INSPECTION REPORT", "PUMP STATION TWO", "WET WELL CLEAN", "FLOATS TESTED OK"]):
            g.text((int(0.8 * dpi), int((1.0 + 0.7 * i) * dpi)), line, fill=0, font=f)
        for i in range(12):
            g.text((int(0.8 * dpi), int((4.2 + 0.25 * i) * dpi)), "small print line %d: check the seal and the bearing grease" % (i + 1), fill=0, font=fs)
        return im
    def small_img(dpi):   # a page of 6-point print (a parts list), what a 300-dpi scan keeps and a 180-dpi drawing may lose
        W, H = int(8.5 * dpi), int(11 * dpi)
        im = Image.new("L", (W, H), 255); g = ImageDraw.Draw(im)
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", int(6 * dpi / 72))
        for i, line in enumerate(SMALL):
            g.text((int(0.7 * dpi), int((0.8 + 0.14 * i) * dpi)), line, fill=0, font=f)
        return im
    for name, dpi, extra in [("scan_note.pdf", 150, "note"), ("scan_fields.pdf", 150, "fields"), ("scan_emptyfield.pdf", 300, "empty"), ("scan_plain.pdf", 300, "none"),
                             ("scan_small_emptyfield.pdf", 300, "empty"), ("scan_small_plain.pdf", 300, "none")]:
        im = small_img(dpi) if "small" in name else scan_img(dpi); data = zlib.compress(im.tobytes())
        d = Doc()
        cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV)
        img = d.add(("<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length LEN >>" % im.size, data))
        cs = d.add(("<< /Length LEN >>", b"q 612 0 0 792 0 0 cm /Im Do Q"))
        ann, acro = [], ""
        if extra == "note":
            ann.append(d.add("<< /Type /Annot /Subtype /Text /Rect [500 700 520 720] /T (Adam) /Contents (Checked by the night shift, see the log book) >>"))
        if extra == "fields":
            for k, (t, v) in enumerate([("inspector", "Grace Hopper"), ("date", "2026-11-25"), ("station", "Lift Station Two")]):
                ann.append(d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (%s) /V (%s) /DA (/Helv 12 Tf 0 g) /Rect [380 %d 580 %d] /F 4 /P %d 0 R >>" % (t, v, 200 - 30 * k, 220 - 30 * k, pg)))
        if extra == "empty":
            ann.append(d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (sign) /DA (/Helv 12 Tf 0 g) /Rect [380 100 580 120] /F 4 /P %d 0 R >>" % pg))
        if ann and extra != "note": acro = "/AcroForm << /Fields [%s] /NeedAppearances true /DR << /Font << /Helv %d 0 R >> >> >>" % (" ".join("%d 0 R" % a for a in ann), font)
        d.set(cat, "<< /Type /Catalog /Pages %d 0 R %s >>" % (pages, acro))
        d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
        d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /XObject << /Im %d 0 R >> >> %s >>"
              % (pages, cs, img, "/Annots [%s]" % " ".join("%d 0 R" % a for a in ann) if ann else ""))
        d.write(name, cat)

# ================================================================ 8. ORDINARY PDFs (must read and draw as 1.24.38 did)
def ordinary():
    im = Image.new("RGB", (64, 48)); px = im.load()
    for x in range(64):
        for y in range(48): px[x, y] = (x * 4, y * 5, 128)
    im.save(P("_grad.png"))
    c = canvas.Canvas(P("ord_reportlab.pdf"), pagesize=(612, 792)); c.setTitle("Ordinary")
    c.setFont("Helvetica-Bold", 20); c.drawString(72, 720, "Ordinary page: shapes, see-through fills, a picture")
    c.setFillColorRGB(1, 0, 0); c.setFillAlpha(0.5); c.rect(72, 560, 200, 100, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 1); c.rect(172, 600, 200, 100, fill=1, stroke=0); c.setFillAlpha(1)
    c.setStrokeColorRGB(0, 0.5, 0); c.setStrokeAlpha(0.6); c.setLineWidth(6); c.setDash(6, 3); c.line(72, 520, 540, 520); c.setStrokeAlpha(1); c.setDash()
    c.drawImage(P("_grad.png"), 72, 380, 128, 96)
    p = c.beginPath(); p.circle(400, 430, 50); c.clipPath(p, stroke=0)
    c.setFillColorRGB(0, 0.6, 0); c.rect(340, 370, 120, 120, fill=1, stroke=0)
    c.showPage()
    c.setFont("Times-Roman", 14); c.translate(300, 400); c.rotate(30); c.drawString(0, 0, "Turned words on page two"); c.showPage()
    c.setPageRotation(90); c.setFont("Courier", 12); c.drawString(72, 700, "A page turned a quarter"); c.showPage()
    c.save()
    os.remove(P("_grad.png"))
    # ExtGState with /BM /Normal and /Compatible and /ca (as Word, LibreOffice and Ghostscript write), text in each
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R >>"); d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> /ExtGState << /G1 6 0 R /G2 7 0 R /G3 8 0 R >> >> >>")
    d.add(("<< /Length LEN >>", ("/G1 gs 0 0 1 rg 72 600 300 60 re f /G2 gs 1 0 0 rg 150 620 300 60 re f /G3 gs 0 g " + bt(72, 700, "Normal and Compatible blend, ca 0.6", 16)
                                 + "q /G2 gs 0 1 0 rg 72 500 200 50 re f Q 0 g " + bt(72, 470, "after the group")).encode()))
    d.add(HELV); d.add("<< /Type /ExtGState /BM /Normal /ca 1 /CA 1 /SA true >>"); d.add("<< /Type /ExtGState /BM /Compatible /ca 0.6 >>"); d.add("<< /Type /ExtGState /BM [/Normal] /LW 2 >>")
    d.write("ord_extgstate_normal.pdf", 1)

if __name__ == "__main__":
    import sys
    which = sys.argv[1:] or ["linear", "strings", "passwords", "blends", "layers", "forms", "scans", "ordinary"]
    old = json.load(open(P("expect.json"))) if os.path.exists(P("expect.json")) and sys.argv[1:] else {}
    for wname in which: globals()[wname]()
    old.update(EXPECT)
    json.dump(old, open(P("expect.json"), "w"), indent=1, ensure_ascii=False)
    print("made", len([f for f in os.listdir(HERE) if f.endswith(".pdf")]), "PDFs in", HERE)
