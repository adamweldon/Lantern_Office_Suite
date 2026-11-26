# make_fixtures.py -- PDFs for an independent review of 1.24.39's PDF reading (locks, forms, annotations, layers,
# bookmarks). Made with reportlab 5.0.1, pypdf 6.17.0, qpdf 11.9 and pdftk (pdftk-java), and byte by byte where a
# tool cannot make the case. Usage: python3 make_fixtures.py  (writes the PDFs beside this script)
import os, io, subprocess, zlib
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (NameObject, DictionaryObject, ArrayObject, FloatObject, NumberObject, TextStringObject,
                           StreamObject, DecodedStreamObject, IndirectObject, BooleanObject)
import pypdf.annotations as AN

HERE = os.path.dirname(os.path.abspath(__file__))
def P(n): return os.path.join(HERE, n)
def sh(*a):
    r = subprocess.run(a, capture_output=True)
    if r.returncode not in (0, 3):   # qpdf exits 3 on warnings
        raise SystemExit("failed: %s\n%s" % (" ".join(a), r.stderr.decode(errors="replace")))

# ---------------------------------------------------------------- a byte-by-byte PDF writer
class Doc:
    def __init__(self): self.objs = []
    def add(self, o=None): self.objs.append(o); return len(self.objs)
    def set(self, n, o): self.objs[n - 1] = o
    def write(self, name, root, trailer_extra=b"", version=b"1.7"):
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
        open(P(name), "wb").write(out)
def u16(s): return "<FEFF" + s.encode("utf-16-be").hex().upper() + ">"
HELV = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
def bt(x, y, s, size=12, font="F1"): return "BT /%s %d Tf %g %g Td (%s) Tj ET\n" % (font, size, x, y, s)

# ================================================================ 1. LOCKS
def locks():
    pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    c = canvas.Canvas(P("_lock_base.pdf"), pagesize=(612, 792))
    c.setTitle("Lock Test Title")
    c.setFont("Helvetica-Bold", 18); c.drawString(72, 700, "Lock test page one")
    c.setFont("Helvetica", 12); c.drawString(72, 670, "Pump P-201 runs on the high float (start) and stops on the low float.")
    c.setFont("DejaVu", 12); c.drawString(72, 640, "Café – naïve Ünicöde Ω 2.2 kΩ")
    c.setFillColorRGB(0, 0, 1); c.rect(72, 560, 200, 50, fill=1, stroke=0)
    c.bookmarkPage("p1"); c.addOutlineEntry("Seção um", "p1", 0)
    c.showPage()
    c.setFont("Helvetica-Bold", 18); c.drawString(72, 700, "Lock test page two")
    c.setFont("Helvetica", 12); c.drawString(72, 670, "Strings with (parens) and \\ backslash survive.")
    c.bookmarkPage("p2"); c.addOutlineEntry("Page two", "p2", 0)
    c.showPage(); c.save()
    # an XMP metadata stream in the catalog (what --cleartext-metadata leaves unscrambled)
    w = PdfWriter(clone_from=P("_lock_base.pdf"))
    xmp = (b'<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF '
           b'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">'
           b'<dc:title><rdf:Alt><rdf:li xml:lang="x-default">Lock Test Title</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta>'
           b'<?xpacket end="w"?>')
    ms = DecodedStreamObject(); ms.set_data(xmp)
    ms[NameObject("/Type")] = NameObject("/Metadata"); ms[NameObject("/Subtype")] = NameObject("/XML")
    w._root_object[NameObject("/Metadata")] = w._add_object(ms)
    with open(P("lock_base.pdf"), "wb") as f: w.write(f)
    os.remove(P("_lock_base.pdf"))
    base = P("lock_base.pdf")
    # pdftk (iText): RC4 40 and 128, owner only (pdftk's default: nothing allowed) and with a user password
    sh("pdftk", base, "output", P("pdftk_rc4_40_owner.pdf"), "owner_pw", "ownpw", "encrypt_40bit")
    sh("pdftk", base, "output", P("pdftk_rc4_128_owner_print.pdf"), "owner_pw", "ownpw", "encrypt_128bit", "allow", "Printing")
    sh("pdftk", base, "output", P("pdftk_rc4_40_user.pdf"), "user_pw", "lantern", "owner_pw", "ownpw", "encrypt_40bit")
    sh("pdftk", base, "output", P("pdftk_rc4_128_user.pdf"), "user_pw", "lantern", "owner_pw", "ownpw", "encrypt_128bit", "allow", "AllFeatures")
    sh("pdftk", base, "output", P("pdftk_rc4_128_user_latin1.pdf"), "user_pw", "façade", "owner_pw", "ownpw", "encrypt_128bit")
    # pypdf AES-256 (revision 6) with non-ASCII passwords; and owner only
    for name, up, op, alg in [("pypdf_aes256_user_utf8.pdf", "Café-Ñandú", "Größe-Ø", "AES-256"),
                              ("pypdf_aes256_owner_utf8.pdf", "", "Größe-Ø", "AES-256"),
                              ("pypdf_aes256r5_user.pdf", "lantern", "ownpw", "AES-256-R5"),
                              ("pypdf_aes128_user.pdf", "lantern", "ownpw", "AES-128"),
                              ("pypdf_aes256_user_nbsp.pdf", "pump room", "ownpw", "AES-256")]:
        w = PdfWriter(clone_from=base); w.encrypt(user_password=up, owner_password=op, algorithm=alg)
        with open(P(name), "wb") as f: w.write(f)
    # qpdf: metadata left in the clear, object streams, a user password, V4 with RC4, revision 5
    sh("qpdf", "--encrypt", "", "ownpw", "256", "--cleartext-metadata", "--", base, P("qpdf_aes256_cleartext_meta.pdf"))
    sh("qpdf", "--encrypt", "", "ownpw", "128", "--use-aes=y", "--cleartext-metadata", "--", base, P("qpdf_aes128_cleartext_meta.pdf"))
    sh("qpdf", "--allow-weak-crypto", "--encrypt", "", "ownpw", "128", "--use-aes=n", "--cleartext-metadata", "--", base, P("qpdf_rc4_128_v4_cleartext_meta.pdf"))
    sh("qpdf", "--allow-weak-crypto", "--encrypt", "", "ownpw", "128", "--use-aes=n", "--force-V4", "--", base, P("qpdf_rc4_128_forceV4.pdf"))
    sh("qpdf", "--object-streams=generate", "--encrypt", "lantern", "ownpw", "256", "--", base, P("qpdf_aes256_user_objstm.pdf"))
    sh("qpdf", "--object-streams=generate", "--encrypt", "", "ownpw", "128", "--use-aes=y", "--", base, P("qpdf_aes128_objstm.pdf"))
    sh("qpdf", "--encrypt", "lantern", "ownpw", "256", "--force-R5", "--", base, P("qpdf_aes256_r5_user.pdf"))
    sh("qpdf", "--encrypt", "", "ownpw", "256", "--print=none", "--extract=n", "--modify=none", "--", base, P("qpdf_aes256_noprint.pdf"))
    # the oracle: the same file with every lock taken off by qpdf (Lantern's text and drawing of each must match it)
    sh("qpdf", "--decrypt", P("qpdf_aes256_cleartext_meta.pdf"), P("lock_base_decrypted.pdf"))
    sh("qpdf", "--object-streams=generate", base, P("lock_base_objstm.pdf"))   # no lock, cross-reference stream (a control)
    # incremental updates written after the lock (new objects scrambled with the file's own key, by pypdf's encryptor)
    for src, name in [("qpdf_aes128_cleartext_meta.pdf", "incr_aes128.pdf"), ("pdftk_rc4_128_owner_print.pdf", "incr_rc4_128.pdf"),
                      ("pypdf_aes256_owner_utf8.pdf", "incr_aes256.pdf")]:
        incremental(P(src), P(name))
    # a hybrid: an encrypted file with a cross-reference stream (qpdf object streams) updated with a classic xref + trailer
    incremental(P("qpdf_aes128_objstm.pdf"), P("incr_objstm_classic.pdf"))
    # a certificate (public-key) lock, and an unknown handler: Lantern cannot open them and should say so
    for name, flt in [("cert_pubsec.pdf", "/Adobe.PubSec /SubFilter /adbe.pkcs7.s5"), ("unknown_handler.pdf", "/FOPN_foweb")]:
        d = Doc()
        d.add("<< /Type /Catalog /Pages 2 0 R >>"); d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
        d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>")
        d.add(("<< /Length LEN >>", bytes(range(256)) * 2))
        d.add("<< /Filter %s /V 4 /R 4 /Length 128 /CF << /DefaultCryptFilter << /CFM /AESV2 /Length 16 /Recipients [<3082010A0282010100C0FFEE>] >> >> "
              "/StmF /DefaultCryptFilter /StrF /DefaultCryptFilter >>" % flt)
        d.write(name, 1, "/Encrypt 5 0 R /ID [<0123456789ABCDEF0123456789ABCDEF> <0123456789ABCDEF0123456789ABCDEF>]")

def incremental(src, dst):
    """Append an update to an encrypted PDF: page 1 gets a new content stream, the Info title a new string."""
    raw = open(src, "rb").read()
    r = PdfReader(src); r.decrypt("")
    enc = r._encryption
    size = int(r.trailer["/Size"]); start = raw.rfind(b"startxref"); prev = int(raw[start + 9:].split()[0])
    pg = r.pages[0]; pnum = pg.indirect_reference.idnum
    cnum, inum = size, size + 1
    content = b"BT /UPD 20 Tf 72 740 Td (UPDATED after the lock) Tj ET\n"
    cs = DecodedStreamObject(); cs.set_data(content)
    ecs = enc.encrypt_object(cs, cnum, 0)
    # new page dictionary: old contents plus the new stream, a font for it
    newpage = DictionaryObject({k: v for k, v in pg.items()})
    old = pg.raw_get("/Contents")
    arr = ArrayObject(list(old) if isinstance(old, ArrayObject) else [old]); arr.append(IndirectObject(cnum, 0, None))
    newpage[NameObject("/Contents")] = arr
    res = DictionaryObject({k: v for k, v in pg["/Resources"].items()})  # (Resources resolved; its entries stay references)
    fonts = DictionaryObject({k: v for k, v in res.get("/Font", DictionaryObject()).items()})
    fonts[NameObject("/UPD")] = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                                                  NameObject("/BaseFont"): NameObject("/Helvetica")})
    res[NameObject("/Font")] = fonts; newpage[NameObject("/Resources")] = res
    info = DictionaryObject({NameObject("/Title"): TextStringObject("Updated Title"), NameObject("/Producer"): TextStringObject("review")})
    einfo = enc.encrypt_object(info, inum, 0)
    epage = enc.encrypt_object(newpage, pnum, 0)
    out = io.BytesIO(); out.write(raw if raw.endswith(b"\n") else raw + b"\n"); offs = {}
    def put(num, obj):
        offs[num] = out.tell(); out.write(b"%d 0 obj\n" % num)
        b = io.BytesIO(); obj.write_to_stream(b); out.write(b.getvalue()); out.write(b"\nendobj\n")
    put(pnum, epage); put(cnum, ecs); put(inum, einfo)
    x = out.tell()
    out.write(b"xref\n0 1\n0000000000 65535 f \n")
    for n in sorted(offs): out.write(b"%d 1\n%010d 00000 n \n" % (n, offs[n]))
    tr = r.trailer
    enc_ref = tr.raw_get("/Encrypt"); root_ref = tr.raw_get("/Root")
    ids = tr["/ID"]
    idhex = b"".join(b"<" + bytes(i.original_bytes if hasattr(i, "original_bytes") else i).hex().encode() + b">" for i in ids)
    out.write(b"trailer\n<< /Size %d /Root %d 0 R /Encrypt %d 0 R /Info %d 0 R /ID [%s] /Prev %d >>\nstartxref\n%d\n%%%%EOF\n" %
              (inum + 1, root_ref.idnum, enc_ref.idnum, inum, idhex, prev, x))
    open(dst, "wb").write(out.getvalue())

# ================================================================ 2. FORMS
def forms():
    # reportlab: fields with their own drawings (appearance streams)
    def rl(name, filled):
        c = canvas.Canvas(P(name), pagesize=(612, 792)); f = c.acroForm
        c.setFont("Helvetica", 12)
        c.drawString(72, 700, "Name:"); f.textfield(name="name", value="Ada Lovelace" if filled else "", x=150, y=694, width=200, height=20, fontSize=12, borderWidth=1)
        c.drawString(72, 660, "Agree:"); f.checkbox(name="agree", checked=filled, x=150, y=656, size=16)
        c.drawString(72, 620, "Colour:")
        for k, v in enumerate(["red", "green", "blue"]): f.radio(name="colour", value=v, selected=filled and v == "green", x=150 + 50 * k, y=616, size=16)
        c.drawString(72, 580, "Size:"); f.choice(name="size", value="L" if filled else "S", options=[("Small", "S"), ("Large", "L")], x=150, y=574, width=120, height=20, fontSize=12)
        c.drawString(72, 520, "Parts:"); f.listbox(name="parts", value=["bolt", "washer"] if filled else ["nut"], options=["bolt", "nut", "washer"], fieldFlags="multiSelect", x=150, y=494, width=120, height=60, fontSize=12)
        c.drawString(72, 440, "Serial:"); f.textfield(name="serial", value="AB12CD34" if filled else "", fieldFlags="comb", maxlen=8, x=150, y=434, width=240, height=20, fontSize=12)
        c.drawString(72, 400, "Code:"); f.textfield(name="code", value="RO-77" if filled else "", fieldFlags="readOnly", x=150, y=394, width=120, height=20, fontSize=12)
        c.showPage()
        c.setFont("Helvetica", 12)
        c.drawString(72, 700, "Inspector:"); f.textfield(name="inspector", value="B. Smith" if filled else "", x=150, y=694, width=200, height=20, fontSize=12)
        c.drawString(72, 660, "Signed off:"); f.checkbox(name="signed", checked=False, x=150, y=656, size=16)
        c.showPage(); c.save()
    rl("form_rl.pdf", True); rl("_form_rl_blank.pdf", False)
    # pypdf filling the blank form: its own drawings for the values, with and without NeedAppearances
    for name, regen in [("form_pypdf_filled_regen.pdf", True), ("form_pypdf_filled_noregen.pdf", False)]:
        w = PdfWriter(clone_from=P("_form_rl_blank.pdf"))
        w.update_page_form_field_values(w.pages[0], {"name": "Filled By Pypdf", "serial": "ZX98", "code": "PY-12"}, auto_regenerate=regen)
        w.update_page_form_field_values(w.pages[1], {"inspector": "C. Jones"}, auto_regenerate=regen)
        with open(P(name), "wb") as fo: w.write(fo)
    os.remove(P("_form_rl_blank.pdf"))
    # by hand: no drawings (NeedAppearances), every kind of field a viewer must draw itself
    d = Doc()
    cat = d.add(); pages = d.add(); p1 = d.add(); p2 = d.add(); font = d.add(HELV)
    on_ap = d.add(("<< /Type /XObject /Subtype /Form /BBox [0 0 16 16] /Length LEN >>", b"0 g 3 3 10 10 re f"))
    off_ap = d.add(("<< /Type /XObject /Subtype /Form /BBox [0 0 16 16] /Length LEN >>", b""))
    order = d.add(); cust = d.add()
    cname = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /Parent %d 0 R /V (Grace Hopper) /DA (/Helv 12 Tf 0 g) /Rect [150 684 400 704] /F 4 /P %d 0 R >>" % (cust, p1))
    d.set(order, "<< /T (order) /Kids [%d 0 R] >>" % cust)
    d.set(cust, "<< /T (customer) /Parent %d 0 R /Kids [%d 0 R] >>" % (order, cname))
    site = d.add()
    sw1 = d.add("<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [150 644 400 664] /F 4 /P %d 0 R >>" % (site, p1))
    sw2 = d.add("<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [150 694 400 714] /F 4 /P %d 0 R >>" % (site, p2))
    d.set(site, "<< /FT /Tx /T (site) /V (Tulsa Hangar 3) /DA (/Helv 12 Tf 0 g) /Kids [%d 0 R %d 0 R] >>" % (sw1, sw2))
    shift = d.add(); kids = []
    for k, (nm, x) in enumerate([("Day", 190), ("Night", 290), ("Swing", 390)]):
        kids.append(d.add("<< /Type /Annot /Subtype /Widget /Parent %d 0 R /Rect [%d 602 %d 618] /F 4 /P %d 0 R /AS /%s /AP << /N << /%s %d 0 R /Off %d 0 R >> >> >>"
                          % (shift, x, x + 16, p1, nm if nm == "Night" else "Off", nm, on_ap, off_ap)))
    d.set(shift, "<< /FT /Btn /Ff 49152 /T (shift) /V /Night /Kids [%s] >>" % " ".join("%d 0 R" % k for k in kids))
    tools = d.add("<< /Type /Annot /Subtype /Widget /FT /Ch /Ff 2097152 /T (tools) /V [(w) (s)] /Opt [[(w) (Wrench)] [(h) (Hammer)] [(s) (Screwdriver)]] "
                  "/DA (/Helv 10 Tf 0 g) /Rect [150 560 350 580] /F 4 /P %d 0 R >>" % p1)
    zipf = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /Ff 16777216 /MaxLen 5 /T (zip) /V (74070) /DA (/Helv 12 Tf 0 g) /Rect [150 522 350 542] /F 4 /P %d 0 R >>" % p1)
    ro = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /Ff 1 /T (ro) /V (READ ONLY VALUE) /DA (/Helv 12 Tf 0 g) /Rect [150 482 400 502] /F 4 /P %d 0 R >>" % p1)
    ja = d.add("<< /Type /Annot /Subtype /Widget /FT /Btn /T (ja) /V /Ja /AS /Ja /AP << /N << /Ja %d 0 R /Off %d 0 R >> >> /Rect [150 442 166 458] /F 4 /P %d 0 R >>" % (on_ap, off_ap, p1))
    onb = d.add("<< /Type /Annot /Subtype /Widget /FT /Btn /T (onbox) /V /On /AS /On /DA (/ZaDb 0 Tf 0 g) /Rect [150 402 166 418] /F 4 /P %d 0 R >>" % p1)
    unt = d.add("<< /Type /Annot /Subtype /Widget /FT /Btn /T (unticked) /V /Off /AS /Off /AP << /N << /Yes %d 0 R /Off %d 0 R >> >> /Rect [150 362 166 378] /F 4 /P %d 0 R >>" % (on_ap, off_ap, p1))
    own = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (owner) /V %s /DA (/Helv 12 Tf 0 g) /Rect [150 322 400 342] /F 4 /P %d 0 R >>" % (u16("Müller – Ståhl"), p1))
    bay = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (bay) /V (Bay 3 \\205 East) /DA (/Helv 12 Tf 0 g) /Rect [150 282 400 302] /F 4 /P %d 0 R >>" % p1)
    mid = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (centered) /Q 1 /V (MID) /DA (/Helv 12 Tf 0 g) /Rect [150 242 450 262] /F 4 /P %d 0 R >>" % p1)
    hid = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (secret) /V (TOPSECRET) /DA (/Helv 12 Tf 0 g) /Rect [150 202 400 222] /F 6 /P %d 0 R >>" % p1)
    note2 = d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (p2note) /V (Second page value) /DA (/Helv 12 Tf 0 g) /Rect [150 654 400 674] /F 4 /P %d 0 R >>" % p2)
    c1 = (bt(72, 720, "Hand form", 14) + bt(72, 690, "Customer:") + bt(72, 650, "Site:") + bt(72, 606, "Shift:") + bt(160, 606, "Day") + bt(250, 606, "Night")
          + bt(350, 606, "Swing") + bt(72, 566, "Tools:") + bt(72, 528, "Zip:") + bt(72, 488, "Read only:") + bt(72, 446, "Ja box:") + bt(72, 406, "On box:")
          + bt(72, 366, "Unticked:") + bt(72, 328, "Owner:") + bt(72, 288, "Bay:") + bt(72, 248, "Centered:") + bt(72, 208, "Secret:")).encode()
    c2 = (bt(72, 700, "Site again:") + bt(72, 660, "P2 note:")).encode()
    cs1 = d.add(("<< /Length LEN >>", c1)); cs2 = d.add(("<< /Length LEN >>", c2))
    annots1 = [cname, sw1] + kids + [tools, zipf, ro, ja, onb, unt, own, bay, mid, hid]
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /AcroForm << /Fields [%s] /NeedAppearances true /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv %d 0 R >> >> >> >>"
          % (pages, " ".join("%d 0 R" % n for n in [order, site, shift, tools, zipf, ro, ja, onb, unt, own, bay, mid, hid, note2]), font))
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R %d 0 R] /Count 2 >>" % (p1, p2))
    d.set(p1, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Annots [%s] >>"
          % (pages, cs1, font, " ".join("%d 0 R" % n for n in annots1)))
    d.set(p2, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Annots [%d 0 R %d 0 R] >>"
          % (pages, cs2, font, sw2, note2))
    d.write("form_hand.pdf", cat)
    # the same form locked against changes (AES-128, pypdf): every value is a scrambled string
    w = PdfWriter(clone_from=P("form_hand.pdf")); w.encrypt(user_password="", owner_password="ownpw", algorithm="AES-128")
    with open(P("form_hand_aes128.pdf"), "wb") as fo: w.write(fo)
    # a page turned a quarter (/Rotate 90) with a field on it
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R] /NeedAppearances true /DR << /Font << /Helv 4 0 R >> >> >> >>")
    d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate 90 /Contents 6 0 R /Resources << /Font << /F1 4 0 R >> >> /Annots [5 0 R] >>")
    d.add(HELV)
    d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (rot) /V (ROT VALUE) /DA (/Helv 12 Tf 0 g) /Rect [170 692 370 712] /F 4 /P 3 0 R >>")
    d.add(("<< /Length LEN >>", (bt(72, 698, "Rotated name:") + bt(72, 600, "Below the field")).encode()))
    d.write("form_rot90.pdf", 1)

# ================================================================ 3. ANNOTATIONS
def annots():
    # every subtype pypdf makes (none of them with a drawing of its own)
    c = canvas.Canvas(P("_annot_base.pdf"), pagesize=(612, 792))
    c.setFont("Helvetica", 14); c.drawString(72, 740, "Annotations made by pypdf"); c.drawString(72, 640, "highlight me please")
    c.showPage(); c.setFont("Helvetica", 14); c.drawString(72, 740, "Second page"); c.showPage(); c.save()
    w = PdfWriter(clone_from=P("_annot_base.pdf"))
    note = w.add_annotation(0, AN.Text(rect=(50, 50, 70, 70), text="Sticky A", open=False, title_bar="Reviewer"))
    w.add_annotation(0, AN.Popup(rect=(400, 200, 560, 300), parent=note, open=True))
    w.add_annotation(0, AN.FreeText(text="FREE TEXT HERE", rect=(300, 690, 560, 730), font_size="14pt", font_color="0000ff", border_color="ff0000", background_color=None))
    w.add_annotation(0, AN.Line(p1=(72, 600), p2=(300, 600), rect=(70, 595, 302, 605), text="line note"))
    w.add_annotation(0, AN.Rectangle(rect=(72, 500, 200, 560), interior_color="00ff00"))
    w.add_annotation(0, AN.Ellipse(rect=(250, 500, 380, 560), interior_color="0000ff"))
    w.add_annotation(0, AN.Polygon(vertices=[(400, 500), (500, 500), (450, 560)]))
    w.add_annotation(0, AN.PolyLine(vertices=[(72, 420), (150, 460), (230, 420)]))
    w.add_annotation(0, AN.Highlight(rect=(70, 636, 205, 655), quad_points=ArrayObject([FloatObject(v) for v in (70, 655, 205, 655, 70, 636, 205, 636)]), highlight_color="ffff00"))
    w.add_annotation(0, AN.Link(rect=(72, 300, 200, 320), target_page_index=1))
    w.add_annotation(0, AN.Link(rect=(72, 260, 200, 280), url="https://example.org/manual"))
    with open(P("annots_pypdf.pdf"), "wb") as fo: w.write(fo)
    os.remove(P("_annot_base.pdf"))
    # by hand: the rest, flags, a layer, and drawings with their own /Matrix and /BBox
    d = Doc()
    cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV)
    ocon = d.add("<< /Type /OCG /Name (Shown layer) >>"); ocoff = d.add("<< /Type /OCG /Name (Comments off) >>")
    A = []
    def ann(s): n = d.add(s); A.append(n); return n
    def ap(bbox, data, extra=""): return d.add(("<< /Type /XObject /Subtype /Form /BBox [%s] %s /Length LEN >>" % (bbox, extra), data))
    ann("<< /Type /Annot /Subtype /Underline /Rect [70 694 202 714] /QuadPoints [72 712 200 712 72 696 200 696] /C [0 0 1] /Contents (underlined words) >>")
    ann("<< /Type /Annot /Subtype /StrikeOut /Rect [70 654 202 674] /QuadPoints [72 672 200 672 72 656 200 656] /C [1 0 0] >>")
    ann("<< /Type /Annot /Subtype /Squiggly /Rect [70 614 202 634] /QuadPoints [72 632 200 632 72 616 200 616] /C [0 0.6 0] >>")
    ann("<< /Type /Annot /Subtype /Ink /Rect [295 690 405 725] /InkList [[300 700 350 720 400 700]] /C [1 0 1] /BS << /W 3 >> >>")
    ann("<< /Type /Annot /Subtype /Stamp /Rect [300 600 500 650] /Name /Approved >>")
    sap = ap("0 0 200 50", b"0 0.7 0 rg 0 0 200 50 re f")
    ann("<< /Type /Annot /Subtype /Stamp /Rect [300 530 500 580] /Name /Draft /AP << /N %d 0 R >> /Contents (stamp with drawing) >>" % sap)
    ann("<< /Type /Annot /Subtype /Square /Rect [72 530 150 580] /F 2 /C [1 0 0] /IC [1 0 0] /Contents (HIDDEN-SQUARE) >>")
    ann("<< /Type /Annot /Subtype /Square /Rect [160 530 240 580] /F 32 /C [1 0 0] /IC [1 0 0] /Contents (NOVIEW-SQUARE) >>")
    hap = ap("0 0 78 60", b"1 0 0 rg 0 0 78 60 re f")
    ann("<< /Type /Annot /Subtype /Square /Rect [72 440 150 500] /F 2 /AP << /N %d 0 R >> /Contents (HIDDEN-WITH-DRAWING) >>" % hap)
    ann("<< /Type /Annot /Subtype /Square /Rect [160 440 240 500] /OC %d 0 R /C [0 0 1] /IC [0 0 1] /Contents (OC-OFF-NOTE) >>" % ocoff)
    bap = ap("1000 1000 1100 1050", b"0 0 1 rg 1000 1000 100 50 re f")
    ann("<< /Type /Annot /Subtype /Square /Rect [300 440 400 490] /AP << /N %d 0 R >> >>" % bap)
    rap = ap("0 0 50 100", b"0 1 0 rg 0 0 50 50 re f", "/Matrix [0 1 -1 0 0 0]")
    ann("<< /Type /Annot /Subtype /Square /Rect [420 440 520 490] /AP << /N %d 0 R >> >>" % rap)
    sap2 = ap("0 0 10 5", b"1 0 1 rg 0 0 10 5 re f")
    ann("<< /Type /Annot /Subtype /Square /Rect [300 360 400 410] /AP << /N %d 0 R >> >>" % sap2)
    gs = d.add("<< /Type /ExtGState /BM /Multiply /CA 1 /ca 1 >>")
    hlap = ap("70 376 260 396", b"/GS0 gs 1 1 0 rg 70 376 190 20 re f", "/Resources << /ExtGState << /GS0 %d 0 R >> >>" % gs)
    ann("<< /Type /Annot /Subtype /Highlight /Rect [70 376 260 396] /QuadPoints [70 396 260 396 70 376 260 376] /C [1 1 0] /AP << /N %d 0 R >> >>" % hlap)
    ann("<< /Type /Annot /Subtype /Square /Rect [72 300 200 340] /C [0.8 0 0] /T (Adam) /Contents (Check terminal 4) /Popup %d 0 R >>" % (len(d.objs) + 2))
    ann("<< /Type /Annot /Subtype /Popup /Rect [400 200 560 300] /Open true /Contents (POPUP-COPY) >>")
    ann("<< /Type /Annot /Subtype /Square /Rect [430 300 530 340] /C [0 0 1] /CA 0.5 /BS << /W 0 >> /IC [0 0 1] >>")
    content = (bt(72, 740, "Annotations made by hand", 14) + bt(72, 700, "UNDER THIS LINE", 14) + bt(72, 660, "STRIKE THIS", 14) + bt(72, 620, "SQUIGGLE THIS", 14)
               + bt(74, 380, "HIGHLIGHTED WORDS", 16)).encode()
    cs = d.add(("<< /Length LEN >>", content))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /OCProperties << /OCGs [%d 0 R %d 0 R] /D << /OFF [%d 0 R] >> >> >>" % (pages, ocon, ocoff, ocoff))
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
    d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Annots [%s] >>"
          % (pages, cs, font, " ".join("%d 0 R" % n for n in A)))
    d.write("annots_hand.pdf", cat)

# ================================================================ 4. LAYERS (optional content)
def layers():
    d = Doc()
    cat = d.add(); pages = d.add(); pg = d.add(); font = d.add(HELV)
    A = d.add("<< /Type /OCG /Name (Layer A) >>"); B = d.add("<< /Type /OCG /Name (Layer B) >>"); C = d.add("<< /Type /OCG /Name (Layer C) >>")
    def ocmd(s): return d.add("<< /Type /OCMD %s >>" % s)
    MA = ocmd("/OCGs [%d 0 R %d 0 R] /P /AllOn" % (A, B)); MB = ocmd("/OCGs [%d 0 R %d 0 R] /P /AnyOn" % (A, B))
    MC = ocmd("/OCGs [%d 0 R %d 0 R] /P /AnyOff" % (A, B)); MD = ocmd("/OCGs [%d 0 R %d 0 R] /P /AllOff" % (A, C))
    ME = ocmd("/OCGs %d 0 R" % B); MF = ocmd("/VE [/Not %d 0 R]" % B); MG = ocmd("/VE [/And %d 0 R %d 0 R]" % (A, B))
    MH = ocmd("/OCGs [%d 0 R %d 0 R] /P /AnyOn /VE [/And %d 0 R %d 0 R]" % (A, B, A, B))
    fm = d.add(("<< /Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /Font << /F1 %d 0 R >> >> /Length LEN >>" % font,
                (bt(72, 250, "FORM-IN-B") + "1 0 0 rg 400 245 150 20 re f").encode()))
    fmo = d.add(("<< /Type /XObject /Subtype /Form /BBox [0 0 612 792] /OC %d 0 R /Resources << /Font << /F1 %d 0 R >> >> /Length LEN >>" % (MA, font),
                 (bt(72, 150, "FORM-OCMD-ALLON") + "1 0 0 rg 400 145 150 20 re f").encode()))
    im = d.add(("<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length LEN >>", b"\x00" * 64))
    def line(tag, y, txt, box=True):
        return ("/OC /%s BDC " % tag if tag else "") + bt(72, y, txt) + ("1 0 0 rg 400 %d 150 20 re f 0 g\n" % (y - 5) if box else "") + ("EMC\n" if tag else "")
    content = (bt(72, 740, "VISIBLE-HEADER") + line("MA", 700, "ALLON-AB") + line("MB", 660, "ANYON-AB") + line("MC", 620, "ANYOFF-AB")
               + line("MD", 580, "ALLOFF-AC") + line("ME", 540, "SINGLE-B") + line("MF", 500, "VE-NOT-B") + line("MG", 460, "VE-AND-AB")
               + "/OC /A BDC " + bt(72, 420, "A-OUTER") + "/Span << /MCID 0 >> BDC " + bt(72, 400, "SPAN-IN-A") + "EMC "
               + "/OC /B BDC " + bt(72, 380, "B-IN-A") + "1 0 0 rg 400 375 150 20 re f 0 g EMC " + bt(72, 360, "A-AFTER") + "EMC\n"
               + "/OC /B BDC /Artifact BMC " + bt(72, 330, "ART-IN-B") + "EMC " + bt(72, 310, "B-TAIL") + "EMC " + bt(72, 290, "AFTER-ALL")
               + "/OC /B BDC /FmB Do EMC\n"
               + "/OC /B BDC q 150 0 0 20 400 195 cm /ImB Do Q EMC\n"
               + "/FmO Do\n" + line("MH", 110, "VE-OVERRIDES-P")).encode()
    cs = d.add(("<< /Length LEN >>", content))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /OCProperties << /OCGs [%d 0 R %d 0 R %d 0 R] /D << /Order [%d 0 R %d 0 R %d 0 R] /OFF [%d 0 R] >> >> >>"
          % (pages, A, B, C, A, B, C, B))
    d.set(pages, "<< /Type /Pages /Kids [%d 0 R] /Count 1 >>" % pg)
    d.set(pg, "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> "
              "/Properties << /A %d 0 R /B %d 0 R /MA %d 0 R /MB %d 0 R /MC %d 0 R /MD %d 0 R /ME %d 0 R /MF %d 0 R /MG %d 0 R /MH %d 0 R >> "
              "/XObject << /FmB %d 0 R /FmO %d 0 R /ImB %d 0 R >> >> >>" % (pages, cs, font, A, B, MA, MB, MC, MD, ME, MF, MG, MH, fm, fmo, im))
    d.write("layers_ocmd.pdf", cat)
    # BaseState /OFF with an /ON list
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R 6 0 R] /D << /BaseState /OFF /ON [5 0 R] >> >> >>")
    d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 4 0 R >> /Properties << /X 5 0 R /Y 6 0 R >> >> >>")
    d.add(HELV); d.add("<< /Type /OCG /Name (Layer X) >>"); d.add("<< /Type /OCG /Name (Layer Y) >>")
    d.add(("<< /Length LEN >>", ("/OC /X BDC " + bt(72, 700, "X-SHOWN") + "0 0 1 rg 400 695 150 20 re f EMC /OC /Y BDC " + bt(72, 660, "Y-HIDDEN")
                                 + "1 0 0 rg 400 655 150 20 re f EMC").encode()))
    d.write("layers_baseoff.pdf", 1)
    # a scanned page (pictures only) with a picture in a layer that is off: Text Reader's picture of the page
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R] /D << /OFF [5 0 R] >> >> >>")
    d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Scan 6 0 R /Mark 7 0 R >> /Properties << /Off 5 0 R >> >> >>")
    d.add(("<< /Length LEN >>", b"q 612 0 0 792 0 0 cm /Scan Do Q /OC /Off BDC q 200 0 0 100 300 600 cm /Mark Do Q EMC"))
    d.add("<< /Type /OCG /Name (Inspector mark) >>")
    d.add(("<< /Type /XObject /Subtype /Image /Width 61 /Height 79 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length LEN >>", b"\xe0" * (61 * 79)))
    d.add(("<< /Type /XObject /Subtype /Image /Width 8 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length LEN >>", b"\x00" * 32))
    d.write("layers_scan_off.pdf", 1)

# ================================================================ 5. BOOKMARKS AND LINKS
def nav():
    d = Doc()
    cat = d.add(); pages = d.add(); font = d.add(HELV)
    pg = [d.add() for _ in range(5)]
    for k in range(5):
        cs = d.add(("<< /Length LEN >>", (bt(72, 700, "Page %d of the manual" % (k + 1), 20)).encode()))
        d.set(pg[k], "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> %s >>"
              % (pages, cs, font, "/Annots [LINKS]" if k == 0 else ""))
    outl = d.add()
    tops = []
    def item(title, extra): n = d.add(); tops.append((n, title, extra)); return n
    # 15 levels deep under the first item
    deep = [d.add() for _ in range(15)]
    for k, n in enumerate(deep):
        d.set(n, "<< /Title (Deep %d) /Parent %d 0 R /Dest [%d 0 R /Fit] %s /Count %d >>"
              % (k + 1, outl if k == 0 else deep[k - 1], pg[k % 5], "/First %d 0 R /Last %d 0 R" % (deep[k + 1], deep[k + 1]) if k < 14 else "", 14 - k))
    item_list = [
        ("(Old named)", "/Dest /chapB"),
        ("(Tree named)", "/Dest (gamma)"),
        ("(GoTo beta)", "/A << /S /GoTo /D (beta) >>"),
        (u16("Ünïcödé – 日本 ✓"), "/Dest [%d 0 R /Fit]" % pg[0]),
        ("(Safety \\205 first \\223 fi)", "/Dest [%d 0 R /Fit]" % pg[1]),
        ("(Web)", "/A << /S /URI /URI (https://example.org/x) >>"),
        ("(Limit edge)", "/Dest (delta)"),
        ("(Missing name)", "/Dest (nosuch)"),
        ("(Dest dict name)", "/Dest /chapD"),
        ("(GoTo name)", "/A << /S /GoTo /D /chapB >>"),
        ("(Tree name via name object)", "/Dest /gamma"),
        ("(Next tree leaf)", "/Dest (epsilon)"),
    ]
    nums = [deep[0]] + [d.add() for _ in item_list]
    titles = ["(Deep 1)"] + [t for t, e in item_list]
    for k, (t, e) in enumerate(item_list, 1):
        d.set(nums[k], "<< /Title %s /Parent %d 0 R %s %s %s >>" % (t, outl, e, "/Prev %d 0 R" % nums[k - 1], "/Next %d 0 R" % nums[k + 1] if k + 1 < len(nums) else ""))
    d.set(deep[0], d.objs[deep[0] - 1].replace(">>", "/Next %d 0 R >>" % nums[1], 1) if False else
          "<< /Title (Deep 1) /Parent %d 0 R /Dest [%d 0 R /Fit] /First %d 0 R /Last %d 0 R /Count 14 /Next %d 0 R >>" % (outl, pg[0], deep[1], deep[1], nums[1]))
    d.set(outl, "<< /Type /Outlines /First %d 0 R /Last %d 0 R /Count %d >>" % (nums[0], nums[-1], len(nums)))
    dests = d.add("<< /chapB [%d 0 R /XYZ 0 792 0] /chapD << /D [%d 0 R /Fit] >> >>" % (pg[2], pg[1]))
    n3 = d.add("<< /Limits [(delta) (gamma)] /Names [(delta) [%d 0 R /Fit] (gamma) << /D [%d 0 R /Fit] >>] >>" % (pg[3], pg[4]))
    n4 = d.add("<< /Limits [(epsilon) (epsilon)] /Names [(epsilon) [%d 0 R /FitH 700]] >>" % pg[3])
    n2 = d.add("<< /Limits [(delta) (gamma)] /Kids [%d 0 R] >>" % n3)
    n1 = d.add("<< /Limits [(alpha) (beta)] /Names [(alpha) [%d 0 R /Fit] (beta) [%d 0 R /Fit]] >>" % (pg[0], pg[1]))
    root = d.add("<< /Kids [%d 0 R %d 0 R %d 0 R] >>" % (n1, n2, n4))
    links = [d.add("<< /Type /Annot /Subtype /Link /Rect [72 600 200 620] /Border [0 0 0] /Dest (gamma) >>"),
             d.add("<< /Type /Annot /Subtype /Link /Rect [72 560 200 580] /Border [0 0 0] /A << /S /GoTo /D /chapB >> >>"),
             d.add("<< /Type /Annot /Subtype /Link /Rect [72 520 200 540] /Border [0 0 0] /A << /S /URI /URI (https://example.org/manual) >> >>"),
             d.add("<< /Type /Annot /Subtype /Link /Rect [72 480 200 500] /Border [0 0 0] /Dest [%d 0 R /XYZ null null null] >>" % pg[2]),
             d.add("<< /Type /Annot /Subtype /Link /Rect [72 440 200 460] /Border [0 0 0] /A << /S /GoTo /D (beta) >> >>")]
    d.set(pg[0], d.objs[pg[0] - 1].replace("LINKS", " ".join("%d 0 R" % n for n in links)))
    d.set(cat, "<< /Type /Catalog /Pages %d 0 R /Outlines %d 0 R /PageMode /UseOutlines /Dests %d 0 R /Names << /Dests %d 0 R >> >>" % (pages, outl, dests, root))
    d.set(pages, "<< /Type /Pages /Kids [%s] /Count 5 >>" % " ".join("%d 0 R" % n for n in pg))
    d.write("nav_deep.pdf", cat)
    # cycles: Next leads back to the first item, and a child's First leads back to the top
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R >>"); d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 11 0 R >> >> >>")
    d.add(("<< /Length LEN >>", bt(72, 700, "Cycle").encode()))
    d.add("<< /Type /Outlines /First 6 0 R /Last 8 0 R /Count 3 >>")
    d.add("<< /Title (One) /Parent 5 0 R /Next 7 0 R /Dest [3 0 R /Fit] >>")
    d.add("<< /Title (Two) /Parent 5 0 R /Prev 6 0 R /Next 8 0 R /First 9 0 R /Last 10 0 R /Count 2 /Dest [3 0 R /Fit] >>")
    d.add("<< /Title (Three) /Parent 5 0 R /Prev 7 0 R /Next 6 0 R /Dest [3 0 R /Fit] >>")
    d.add("<< /Title (Two-a) /Parent 7 0 R /Next 10 0 R >>")
    d.add("<< /Title (Two-b) /Parent 7 0 R /Prev 9 0 R /Next 9 0 R /First 6 0 R >>")
    d.add(HELV)
    d.write("nav_cycle.pdf", 1)
    # an outline item whose /Next is itself (a one-item loop) and an outline with no /First
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R >>"); d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>")
    d.add(("<< /Length LEN >>", b""))
    d.add("<< /Type /Outlines /First 6 0 R /Last 6 0 R /Count 1 >>")
    d.add("<< /Title (Self) /Parent 5 0 R /Next 6 0 R /First 6 0 R /Dest [3 0 R /Fit] >>")
    d.write("nav_selfloop.pdf", 1)
    # reportlab's own bookmarks (nested, with a non-Latin title) and pypdf's (titles pypdf writes in PDFDocEncoding)
    c = canvas.Canvas(P("_nav_rl.pdf"), pagesize=(612, 792))
    for k, t in enumerate(["Intro", "Wiring – main panel", "Схема"]):
        c.setFont("Helvetica", 18); c.drawString(72, 700, "Chapter %d" % (k + 1)); c.bookmarkPage("c%d" % k); c.addOutlineEntry(t, "c%d" % k, level=0 if k != 2 else 1); c.showPage()
    c.save()
    w = PdfWriter(clone_from=P("_nav_rl.pdf"))
    top = w.add_outline_item("Safety – first “quoted”", 0)
    w.add_outline_item("Spare parts • list", 2, parent=top)
    with open(P("nav_rl_pypdf.pdf"), "wb") as fo: w.write(fo)
    os.remove(P("_nav_rl.pdf"))

# ================================================================ 6. MORE: locks on forms, PDF 2.0 text, long and non-Latin-1 passwords
def more():
    # a form whose values sit inside object streams of a locked file (they must not be unscrambled twice)
    sh("qpdf", "--object-streams=generate", "--encrypt", "", "ownpw", "128", "--use-aes=y", "--", P("form_hand.pdf"), P("form_hand_objstm_aes128.pdf"))
    sh("qpdf", "--allow-weak-crypto", "--object-streams=generate", "--encrypt", "", "ownpw", "128", "--use-aes=n", "--", P("form_rl.pdf"), P("form_rl_objstm_rc4.pdf"))
    # passwords: longer than 32 bytes (revisions 2-4 use the first 32), and with a euro sign (PDFDocEncoding 0xA0 in revisions 2-4)
    sh("pdftk", P("lock_base.pdf"), "output", P("pdftk_rc4_128_user_long.pdf"), "user_pw", "averyveryverylongpasswordthatexceeds32ch", "owner_pw", "ownpw", "encrypt_128bit")
    sh("qpdf", "--encrypt", "€uro-5", "ownpw", "128", "--use-aes=y", "--", P("lock_base.pdf"), P("qpdf_aes128_user_euro.pdf"))
    sh("qpdf", "--encrypt", "€uro-5", "ownpw", "256", "--", P("lock_base.pdf"), P("qpdf_aes256_user_euro.pdf"))
    # linearized ("Fast Web View") locked PDFs: the lock is named in the FIRST trailer (the first-page section); the last trailer has only /Size and /ID
    sh("qpdf", "--linearize", "--encrypt", "", "ownpw", "128", "--use-aes=y", "--", P("lock_base.pdf"), P("lin_aes128_owner.pdf"))
    sh("qpdf", "--linearize", "--allow-weak-crypto", "--encrypt", "", "ownpw", "128", "--use-aes=n", "--", P("lock_base.pdf"), P("lin_rc4_128_owner.pdf"))
    sh("qpdf", "--linearize", "--encrypt", "lantern", "ownpw", "256", "--", P("lock_base.pdf"), P("lin_aes256_user.pdf"))
    sh("qpdf", "--linearize", "--object-streams=generate", "--encrypt", "", "ownpw", "256", "--", P("lock_base.pdf"), P("lin_objstm_aes256_owner.pdf"))
    sh("qpdf", "--linearize", P("lock_base.pdf"), P("lin_plain.pdf"))
    # PDF 2.0 text strings in UTF-8 (with its byte-order mark): a bookmark title and a field value
    d = Doc()
    bom = "<EFBBBF" + "Wiring – panel été".encode("utf-8").hex().upper() + ">"
    val = "<EFBBBF" + "Straße 7 – Tor 2".encode("utf-8").hex().upper() + ">"
    d.add("<< /Type /Catalog /Pages 2 0 R /Outlines 6 0 R /AcroForm << /Fields [8 0 R] /NeedAppearances true /DR << /Font << /Helv 4 0 R >> >> >> >>")
    d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> /Annots [8 0 R] >>")
    d.add(HELV)
    d.add(("<< /Length LEN >>", (bt(72, 700, "PDF 2.0 strings") + bt(72, 660, "Address:")).encode()))
    d.add("<< /Type /Outlines /First 7 0 R /Last 7 0 R /Count 1 >>")
    d.add("<< /Title %s /Parent 6 0 R /Dest [3 0 R /Fit] >>" % bom)
    d.add("<< /Type /Annot /Subtype /Widget /FT /Tx /T (addr) /V %s /DA (/Helv 12 Tf 0 g) /Rect [150 654 400 674] /F 4 /P 3 0 R >>" % val)
    d.write("pdf20_utf8_strings.pdf", 1, version=b"2.0")

# ================================================================ 7. DAMAGED: what a careless writer leaves (nothing here should throw)
def damaged():
    d = Doc()
    d.add("<< /Type /Catalog /Pages 2 0 R /Outlines 8 0 R /OCProperties << /OCGs 99 0 R >> /AcroForm << /Fields 5 0 R >> >>")
    d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> "
          "/Annots [null 77 0 R 5 0 R (junk) << /Subtype /Square /Rect [10 10] >> << /Subtype /Square /Rect [100 100 50 50] /C [0 0 1] /IC [0 0 1] >> "
          "<< /Subtype /Widget /FT /Btn /Rect [300 300 320 320] /AS /Yes /AP << /N << /Yes 4 0 R >> >> >> "
          "<< /Subtype /Widget /FT /Tx /Rect [300 400 500 420] /V 12 /AP << /N 6 0 R >> >> << /Subtype /Text /Rect [5 5 25 25] /AP << /N 99 0 R >> >> "
          "<< /Subtype /Highlight /Rect [72 690 200 710] /QuadPoints [1 2 3] >> << /Subtype /Ink /Rect [0 0 50 50] /InkList [null [1 2 3]] >> "
          "<< /Subtype /Line /Rect [0 0 1 1] /L [5] >> << /Subtype /Widget /FT /Ch /Rect [300 500 500 520] /V [null /x] /Opt [null (a) [(b)]] >> "
          "<< /Subtype /Widget /Parent 5 0 R /Rect [300 550 500 570] >>] >>")
    d.add(("<< /Length LEN >>", bt(72, 700, "Damaged but readable").encode() + b"/OC /Nope BDC " + bt(72, 650, "UNKNOWN-PROPERTY").encode() + b"EMC EMC EMC"))
    d.add("<< /FT /Tx /T (loop) /Parent 5 0 R /V (LOOPED) /Kids [5 0 R] >>")
    d.add(HELV)
    d.add("<< /Title (Orphan) >>")
    d.add("<< /Type /Outlines /First 9 0 R >>")
    d.add("<< /Parent 8 0 R /Next 10 0 R /Dest 55 0 R >>")
    d.add("<< /Title [ (not a string) ] /Parent 8 0 R /A << /S /GoTo /D [ 99 0 R /Fit ] >> /First 7 0 R >>")
    d.write("damaged_mix.pdf", 1)
    # a lock with its O and U strings missing, and one with revision 6 but no UE
    for name, enc in [("damaged_lock_no_OU.pdf", "<< /Filter /Standard /V 2 /R 3 /Length 128 /P -4 >>"),
                      ("damaged_lock_r6_no_UE.pdf", "<< /Filter /Standard /V 5 /R 6 /Length 256 /P -4 /O <%s> /U <%s> /CF << /StdCF << /CFM /AESV3 /Length 32 >> >> /StmF /StdCF /StrF /StdCF >>"
                       % ("00" * 48, "00" * 48))]:
        d = Doc()
        d.add("<< /Type /Catalog /Pages 2 0 R >>"); d.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
        d.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>"); d.add(("<< /Length LEN >>", b"\x01\x02\x03"))
        d.add(enc)
        d.write(name, 1, "/Encrypt 5 0 R /ID [<00112233445566778899AABBCCDDEEFF> <00112233445566778899AABBCCDDEEFF>]")

if __name__ == "__main__":
    import sys
    which = sys.argv[1:] or ["locks", "forms", "annots", "layers", "nav", "more", "damaged"]
    for wname in which: globals()[wname]()
    print("made", len([f for f in os.listdir(HERE) if f.endswith(".pdf")]), "PDFs in", HERE)
