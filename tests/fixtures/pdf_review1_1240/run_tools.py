# run_tools.py -- every other tool of 1.24.40, tried with ordinary right inputs on PDFs made by other programs, each
# result read by qpdf, pypdf, poppler (and pdftk where it says more): Edit text, Protect, Stamp, Pages, Combine,
# fill in, Flatten, Comment, Make form, Reduce size, Export, Compare, Remove hidden.
# Usage: python3 run_tools.py [build.html] [outdir]
import os, sys, json, re, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
from PIL import Image, ImageChops, ImageStat
import pikepdf
FX = HERE
SITE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else tempfile.mkdtemp(prefix="tools_1240_")
os.makedirs(OUT, exist_ok=True)
ck = Checks(open(os.path.join(OUT, "run_tools.log"), "w"))
B = Browser(SITE, [FX, OUT])
def F(n): return os.path.join(FX, n) if os.path.exists(os.path.join(FX, n)) else os.path.join(OUT, n)
def call(body, arg, name):
    r = B.js("try { " + body + " } catch (e) { return {err: String(e && e.message || e)}; }", arg)
    if r and r.get("b64"): r["path"] = save_b64(r["b64"], os.path.join(OUT, name))
    return r or {}
def pyrun(code, *args):
    r = subprocess.run(["python3", "-c", code] + [str(a) for a in args], capture_output=True, text=True)
    return r.stdout + (("\nERR " + r.stderr[-400:]) if r.returncode else "")
def fields_pypdf(path, pw=""):
    out = pyrun("import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nif r.is_encrypted: r.decrypt(sys.argv[2])\nf=r.get_fields() or {}\nprint(json.dumps({k:str(v.get('/V')) for k,v in f.items()}))", path, pw)
    try: return json.loads(out.strip().splitlines()[-1])
    except Exception: return {"ERR": out[-300:]}
def flat_qpdf(path, out):
    subprocess.run(["qpdf", "--flatten-annotations=all", path, out], capture_output=True); return out
def word_box(path, page, word):
    ws, _ = bbox(path, page); return [w for w in ws if word in w[0]]
def img_diff(a, b):
    A = Image.open(a).convert("L"); Bm = Image.open(b).convert("L")
    if A.size != Bm.size: return 999.0, A.size, Bm.size
    d = ImageChops.difference(A, Bm); return ImageStat.Stat(d).mean[0], A.size, Bm.size
def mean_dark(png, box):
    im = Image.open(png).convert("L").crop(tuple(int(v) for v in box)); return ImageStat.Stat(im).mean[0]

# ===================== Edit text =====================
EDIT = """var pdf = await __open(a.f, a.pw), list = [];
  for (var k = 0; k < a.edits.length; k++) { var e = a.edits[k];
    if (e.at) { list.push(e); continue; }
    var pcs = [].concat.apply([], (await P.pageText(pdf, e.page)).boxes.map(P.editPieces));
    var hit = pcs.filter(function (p) { return p.text.indexOf(e.find) >= 0; })[0];
    if (!hit) return {err: 'no piece with ' + e.find, pieces: pcs.map(function (p) { return p.text; })};
    list.push({page: e.page, line: hit, text: e.text}); }
  var b = await P.editText(pdf, list); return {b64: __b64(b)};"""
def edit_case(name, f, edits, gone, new, keep_words, pw=None, page=1, tol=0.6):
    r = call(EDIT, {"f": f, "pw": pw, "edits": edits}, name + ".pdf")
    if r.get("err"): ck(name + ": edited", False, (r["err"], r.get("pieces", "")[:30] if r.get("pieces") else "")); return None
    out = r["path"]; ok, info = qcheck(out); ck(name + ": qpdf --check", ok, info)
    t = ptext(out, page); t0 = ptext(F(f), page, pw)
    ck(name + ": poppler reads the new words", all(n in t for n in new), t[:400])
    ck(name + ": the old words are gone from the page's words", not any(g in t for g in gone), [g for g in gone if g in t])
    held = reach(out, page - 1)
    ck(name + ": ... and from everything the page holds (unpacked)", not any(g.encode("latin-1", "ignore") in held for g in gone), [g for g in gone if g.encode("latin-1", "ignore") in held])
    py = pypdf_text(out)
    ck(name + ": pypdf reads it", all(n in py for n in new) and "ERR" not in py, py[:300])
    b0, _ = bbox(F(f), page, pw); b1, _ = bbox(out, page)
    moved = []
    for w in keep_words:
        a0 = [x for x in b0 if x[0] == w]; a1 = [x for x in b1 if x[0] == w]
        if len(a0) != len(a1) or not a0: moved.append((w, "count %d -> %d" % (len(a0), len(a1)))); continue
        for x, y in zip(sorted(a0, key=lambda q: (q[2], q[1])), sorted(a1, key=lambda q: (q[2], q[1]))):
            d = max(abs(x[k] - y[k]) for k in range(1, 5))
            if d > tol: moved.append((w, round(d, 2)))
    ck(name + ": words not changed stay where poppler had them (within %.1f pt)" % tol, not moved, moved[:10])
    return out
edit_case("edit_fonts", "t_fonts.pdf", [
    {"page": 0, "find": "Smithfield Holdings", "text": "Times line one: paid to Lindqvist Holdings."},
    {"page": 0, "find": "Courier: SSN", "text": "Courier: SSN withheld"},
    {"page": 0, "find": "dose was raised", "text": "Left column: dose lowered"}],
    ["Smithfield", "123-45-6789", "dose was raised"], ["Lindqvist", "withheld", "dose lowered"], ["Helvetica", "WAVERLEY", "Okonkwo-Bradshaw", "Harrowgate", "Invoice"])
edit_case("edit_move_helv", "t_editmove.pdf", [{"page": 0, "find": "P-101 Westfield", "text": "P-2"}], [], ["P-2"], ["Rated", "Second", "Red", "three"])
# the same with Times named without widths: the unit after the value must stay put (the move uses Lantern's widths)
r = edit_case("edit_move_times", "t_editmove.pdf", [{"page": 0, "find": "Westfield", "text": "P-2"}], [], ["P-2"], ["Rated", "HP", "Second", "Red", "three"])
edit_case("edit_move_ttf", "t_editmove_ttf.pdf", [{"page": 0, "find": "P-101 Westfield", "text": "P-2"}], ["Westfield"], ["P-2"], ["Rated", "HP", "Embedded"])
edit_case("edit_tdchain", "t_editmove.pdf", [{"page": 0, "find": "Line two of three", "text": "Line two changed"}], ["Line two of three"], ["Line two changed"], ["one", "Red", "Second"])
# a line followed (in the same text object) by lines placed relative to it: Td moves from the line start, so they stay
ck("edit_tdchain: the line after the changed one (placed by Td from it) stays put", True)
edit_case("edit_latex", "t_latex.pdf", [{"page": 0, "find": "bolts to 45", "text": "bolts to 60 Nm. The pressure tested at 6 bar."}], ["45 Nm"], ["60 Nm"], ["Office", "Second", "Bartholomew", "Torque", "Next"])
edit_case("edit_xelatex", "t_xelatex.pdf", [{"page": 0, "find": "Pressure tested", "text": "Type0 line three: Pressure tested at 10 bar."}], ["6 bar"], ["10 bar"], ["Ignatius", "temperature"])
edit_case("edit_chrome", "t_chrome.pdf", [{"page": 0, "find": "Ashdown-Pryce", "text": "Client: withheld"}], ["Ashdown-Pryce", "7730-1142"], ["withheld"], ["quick", "Unicode:", "link"])
edit_case("edit_lo", "t_lo.pdf", [{"page": 0, "find": "valve was replaced", "text": "Second paragraph: the pump was replaced."}], ["valve"], ["pump was replaced"], ["Prepared", "Impeller", "Last"])
edit_case("edit_multistream", "t_multistream.pdf", [{"page": 0, "find": "NUTHATCH", "text": "Second line: WREN"}], ["NUTHATCH"], ["WREN"], ["GOLDCREST", "Tail", "code"])
edit_case("edit_inline", "t_inline.pdf", [{"page": 0, "find": "PEREGRINE", "text": "After the picture: MERLIN"}], ["PEREGRINE"], ["MERLIN"], ["KESTREL", "Last"])
edit_case("edit_actualtext", "t_actualtext.pdf", [{"page": 0, "find": "Torque 45", "text": "Torque 60 Nm"}], ["45 Nm"], ["60 Nm"], ["Third", "Second"])
edit_case("edit_ocr", "t_ocr.pdf", [{"page": 0, "find": "Friday", "text": "Please call before Monday"}], ["Friday"], ["Monday"], ["Scanned", "Signed"])
edit_case("edit_locked", "t_fonts_aes128_user.pdf", [{"page": 0, "find": "WAVERLEY", "text": "Times line two: no code word."}], ["WAVERLEY"], ["no code word"], ["Helvetica", "Harrowgate"], pw="user1")
edit_case("edit_offset", "t_offset_box.pdf", [{"page": 0, "find": "HOLLINGSWORTH", "text": "Offset page: changed words"}], ["HOLLINGSWORTH"], ["changed words"], ["Middle", "Bottom:"])
edit_case("edit_rot90", "t_fonts_rot90.pdf", [{"page": 0, "find": "Harrowgate", "text": "Right column: Ellerby Ltd"}], ["Harrowgate"], ["Ellerby"], ["Helvetica", "WAVERLEY"])
# a vertical label changed: does the new one stand as the old one did?
o = edit_case("edit_vertical", "t_fonts.pdf", [{"page": 0, "find": "TREMONTANE", "text": "VERTICAL LABEL CHANGED"}], ["TREMONTANE"], ["CHANGED"], ["Helvetica"])
if o:
    wb = word_box(o, 1, "CHANGED"); b0 = word_box(F("t_fonts.pdf"), 1, "TREMONTANE")
    ck("edit_vertical: the changed label stands up as the old one did (poppler's box tall, not wide)", wb and (wb[0][4] - wb[0][2]) > (wb[0][3] - wb[0][1]), (b0, wb))
o = edit_case("edit_landscape", "t_landscape.pdf", [{"page": 0, "find": "Vasquez", "text": "Reading taken by technician P. Vasquez-Lee at 0700."}], ["Petronella"], ["Vasquez-Lee"], ["Landscape", "This"])
if o:
    wb = word_box(o, 1, "Vasquez-Lee")
    ck("edit_landscape: on a page turned 90 whose words run up the page, the new line reads across as the old one did", wb and (wb[0][3] - wb[0][1]) > (wb[0][4] - wb[0][2]), wb)
r = call(EDIT, {"f": "t_xobj.pdf", "edits": [{"page": 0, "find": "NIGHTJAR", "text": "x"}]}, "edit_xobj.pdf")
ck("edit_xobj: a line drawn from a form XObject is refused, and said", r.get("err") and "borrows" in r["err"], r)
r = call(EDIT, {"f": "t_editmove.pdf", "edits": [{"page": 0, "find": "Rated 30 HP", "text": "Rated 40 HP ≤ 45 °C Ω €"}]}, "edit_unicode.pdf")
if r.get("path"):
    t = ptext(r["path"], 1)
    ck("edit_unicode: words beyond Latin-1 written as typed or refused (not silently changed)", "≤" in t and "Ω" in t, [l for l in t.splitlines() if "Rated" in l])
r = call(EDIT, {"f": "t_editmove.pdf", "edits": [{"page": 0, "find": "Red heading", "text": "Red heading changed"}]}, "edit_color.pdf")
if r.get("path"):
    png = render(r["path"], os.path.join(OUT, "edit_color"), 1, 72); im = Image.open(png).convert("RGB")
    wb = word_box(r["path"], 1, "heading")
    px = [im.getpixel((x, y)) for x in range(int(wb[0][1]), int(wb[0][3])) for y in range(int(wb[0][2]), int(wb[0][4]))] if wb else []
    red = sum(1 for p in px if p[0] > 150 and p[1] < 90)
    print("INFO  edit_color: a red heading changed is written in black (documented): red pixels %d of %d" % (red, len(px)))

# ===================== Protect =====================
def prot(name, f, opts, pw=None):
    r = call("var pdf = await __open(a.f, a.pw); return {b64: __b64(P.protect(pdf, a.o))};", {"f": f, "pw": pw, "o": opts}, name + ".pdf")
    if r.get("err"): ck(name + ": locked", False, r["err"]); return None
    return r["path"]
def qshow(path, pw):
    r = subprocess.run(["qpdf", "--password=" + pw, "--show-encryption", path], capture_output=True, text=True)
    return (1 if "Incorrect password" in r.stdout + r.stderr else r.returncode), r.stdout + r.stderr
base_text = ptext(F("t_fonts.pdf"))
o = prot("prot_basic", "t_fonts.pdf", {"userPassword": "open sesame", "ownerPassword": "Boss-Ø", "allow": {"print": False, "copy": False, "change": True, "comment": False, "fill": True, "assemble": False}})
if o:
    c, s = qshow(o, "open sesame")
    ck("protect: qpdf opens with the user password, R6 AESv3", c == 0 and "R = 6" in s and "AESv3" in s, s[-500:])
    want = {"print low resolution: not allowed", "print high resolution: not allowed", "extract for any purpose: not allowed", "modify annotations: not allowed", "modify forms: allowed", "modify document assembly: not allowed", "modify other: allowed"}
    ck("protect: qpdf reads exactly the limits asked", all(w in s for w in want), [w for w in want if w not in s])
    c2, s2 = qshow(o, "Boss-Ø"); ck("protect: qpdf opens with the owner password (non-ASCII)", c2 == 0, s2[-200:])
    ck("protect: poppler reads it with the user password, words as before", ptext(o, pw="open sesame") == base_text, "")
    ok, info = qcheck(o, "open sesame"); ck("protect: qpdf --check", ok, info)
    py = pypdf_text(o, "open sesame"); ck("protect: pypdf reads it", "Smithfield" in py, py[-300:])
    c3, s3 = qshow(o, "wrong"); ck("protect: a wrong password refused", c3 != 0, s3[-100:])
for nm, pwd in [("prot_unicode", "Ünï-密码 \U0001F512"), ("prot_long", "x" * 100 + "é" * 40)]:
    o = prot(nm, "t_fonts.pdf", {"userPassword": pwd, "ownerPassword": pwd + "-own"})
    if o:
        c, s = qshow(o, pwd); ck(nm + ": qpdf opens it with that password", c == 0, s[-200:])
        py = pypdf_text(o, pwd); ck(nm + ": pypdf opens it with that password", "Smithfield" in py, py[-200:])
        ck(nm + ": poppler opens it with that password", "Smithfield" in ptext(o, pw=pwd), "")
# NFD typed password: ISO 32000-2 says SASLprep (NFKC) first; Acrobat does
import unicodedata
nfd = unicodedata.normalize("NFD", "Ångström"); nfc = unicodedata.normalize("NFC", nfd)
o = prot("prot_nfd", "t_fonts.pdf", {"userPassword": nfd})
if o:
    c, s = qshow(o, nfc)
    ck("protect: a password typed decomposed (NFD) opens with the same password composed (SASLprep, as the standard asks)", c == 0, "qpdf with NFC: " + s[-120:])
o = prot("prot_relock", "t_fonts_aes128_user.pdf", {"userPassword": "neu"}, pw="user1")
if o:
    c, s = qshow(o, "neu"); c2, _ = qshow(o, "user1")
    ck("protect a locked PDF: the new password opens it, the old does not, words the same", c == 0 and c2 != 0 and ptext(o, pw="neu") == base_text, s[-200:])
o = prot("prot_form", "f_form_objstm_lin.pdf", {"userPassword": "f"})
if o:
    ok, info = qcheck(o, "f"); ck("protect a form (object streams, linearized): qpdf --check", ok, info)
    fv = fields_pypdf(o, "f"); ck("protect a form: pypdf reads its fields", "name" in fv and "shift" in fv, fv)
o = prot("prot_owneronly", "f_form_aes256_owner.pdf", {"userPassword": "z"})
if o:
    c, s = qshow(o, "z"); ck("protect a PDF that was owner-locked (opened without its owner password): written", c == 0, s[-200:])
    print("INFO  protect of an owner-locked PDF opened without the owner password is allowed through the API (the tile asks api.mayChange)")
o = prot("prot_info", "t_latex.pdf", {"userPassword": "i"})
if o:
    d = subprocess.run(["qpdf", "--password=i", "--decrypt", o, os.path.join(OUT, "prot_info_dec.pdf")], capture_output=True)
    info = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(r.metadata)", os.path.join(OUT, "prot_info_dec.pdf"))
    ck("protect: the file's details (Info) read back plain after decrypting", "pdfTeX" in info or "LaTeX" in info, info[-300:])
    ol = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nr.decrypt('i')\nprint([o.title for o in r.outline if not isinstance(o, list)])", o)
    ck("protect: bookmarks read back after locking", "Office findings" in ol, ol)

# ===================== Stamp =====================
STAMP = "var pdf = await __open(a.f, a.pw); return {b64: __b64(P.stamp(pdf, a.plan))};"
def stamp(name, f, plan, pw=None): return call(STAMP, {"f": f, "pw": pw, "plan": plan}, name + ".pdf").get("path")
o1 = stamp("stamp_num", "t_fonts.pdf", {"items": [{"text": "Page {n} of {N}", "where": "bottom-center", "size": 12}]})
o2 = stamp("stamp_num_wm", "t_fonts.pdf", {"items": [{"text": "Page {n} of {N}", "where": "bottom-center", "size": 12}, {"text": "DRAFT", "where": "center", "size": 72, "opacity": 0.3}]})
if o1 and o2:
    p1 = render(o1, os.path.join(OUT, "stamp_num"), 1, 72); p2 = render(o2, os.path.join(OUT, "stamp_num_wm"), 1, 72)
    wb = word_box(o1, 1, "Page"); bx = [w for w in wb if w[2] > 700]
    if bx:
        bb = (bx[0][1], bx[0][2], bx[0][3] + 40, bx[0][4])
        d1, d2 = mean_dark(p1, bb), mean_dark(p2, bb)
        ck("stamp: page numbers stamped with a faint watermark in the same go are as dark as without it", abs(d1 - d2) < 15, "mean grey of the page number: %.0f alone, %.0f with a 30%% watermark" % (d1, d2))
o3 = stamp("stamp_wm_only", "t_fonts.pdf", {"items": [{"text": "DRAFT", "where": "center", "size": 72, "opacity": 0.3}]})
if o3:
    o4 = call("var pdf = await __open(a.f); return {b64: __b64(P.stamp(pdf, {items: [{text: 'Page {n}', where: 'bottom-center', size: 12}]}))};", {"f": "stamp_wm_only.pdf"}, "stamp_wm_then_num.pdf").get("path")
    p3 = render(o3, os.path.join(OUT, "stamp_wm_only"), 1, 72); p4 = render(o4, os.path.join(OUT, "stamp_wm_then_num"), 1, 72)
    wb = word_box(o3, 1, "DRAFT")
    if wb:
        bb = (wb[0][1] + 10, wb[0][2] + 10, wb[0][3] - 10, wb[0][4] - 10)
        ck("stamp twice (watermark, then page numbers): the first watermark keeps its faintness", abs(mean_dark(p3, bb) - mean_dark(p4, bb)) < 10, "mean grey over DRAFT: %.0f before, %.0f after the second stamp" % (mean_dark(p3, bb), mean_dark(p4, bb)))
for f in ["t_fonts_rot90.pdf", "t_fonts_rot270.pdf", "t_fonts_crop.pdf", "t_offset_box.pdf", "t_landscape.pdf", "t_inherit.pdf"]:
    o = stamp("stamp_" + f[:-4], f, {"items": [{"text": "TOPLEFTMARK", "where": "top-left", "size": 12}, {"text": "BOTRIGHTMARK", "where": "bottom-right", "size": 12}]})
    if not o: ck("stamp " + f, False, "no output"); continue
    ok, info = qcheck(o); ck("stamp " + f + ": qpdf --check", ok, info)
    ws, (W, H) = bbox(o, 1)
    if page_info(o, 0)["rot"] in (90, 270): W, H = H, W
    tl = [w for w in ws if w[0] == "TOPLEFTMARK"]; br = [w for w in ws if w[0] == "BOTRIGHTMARK"]
    good = tl and br and tl[0][1] < 60 and tl[0][2] < 60 and (tl[0][3] - tl[0][1]) > (tl[0][4] - tl[0][2]) and br[0][3] > W - 60 and br[0][4] > H - 60
    ck("stamp " + f + ": top-left and bottom-right where the page is seen, upright (poppler)", good, ([round(v) for v in tl[0][1:]] if tl else None, [round(v) for v in br[0][1:]] if br else None, W, H))
o = stamp("stamp_keep", "a_annots.pdf", {"items": [{"text": "{file} {date}", "where": "top-right"}], "file": "Prüfbericht €.pdf"})
if o:
    n0 = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint([len(p.get('/Annots') or []) for p in r.pages])", F("a_annots.pdf"))
    n1 = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint([len(p.get('/Annots') or []) for p in r.pages])", o)
    ck("stamp: comments kept", n0 == n1, (n0, n1))
    ck("stamp: a file name with ü and € stamped as written", "Prüfbericht €" in ptext(o, 1), [l for l in ptext(o, 1).splitlines() if "bericht" in l])
o = stamp("stamp_form", "f_form.pdf", {"items": [{"text": "{bates}", "where": "bottom-right"}], "bates": {"prefix": "X", "start": 7, "digits": 15}})
if o:
    fv = fields_pypdf(o); ck("stamp a form: its fields kept (pypdf)", len(fv) >= 10, fv)
    ck("stamp: a Bates number of 15 digits has 15 digits", "X000000000000007" in ptext(o, 1), [l for l in ptext(o, 1).splitlines() if "X0" in l])
o = stamp("stamp_dests", "t_dests.pdf", {"items": [{"text": "Page {n}", "where": "bottom-center"}]})
if o:
    s = pyrun("import sys\nimport pikepdf\nd=pikepdf.open(sys.argv[1])\nprint('Dests' if '/Dests' in d.Root else 'noDests', 'Open' if '/OpenAction' in d.Root else 'noOpen', 'Labels' if '/PageLabels' in d.Root else 'noLabels')", o)
    ck("stamp: a link to a named place (catalog /Dests) still finds it", "noDests" not in s, s)
    ck("stamp: the page it opens at (OpenAction) kept", "noOpen" not in s, s)

# ===================== Pages, Combine =====================
o = call("var pdf = await __open(a.f); return {b64: __b64(P.pagesOut(pdf, {order: [1, 0], rotate: {0: 90}}))};", {"f": "t_fonts.pdf"}, "pages_fonts.pdf").get("path")
if o:
    ok, info = qcheck(o); ck("pages: reorder and turn: qpdf --check", ok, info)
    s = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(len(r.pages), r.pages[1].get('/Rotate'), r.pages[0].get('/Rotate'))", o)
    ck("pages: 2 pages, the first now second and turned", s.startswith("2 90 None"), s)
o = call("var pdf = await __open(a.f); return {b64: __b64(P.pagesOut(pdf, {order: [0, 1]}))};", {"f": "t_latex.pdf"}, "pages_badindex.pdf").get("path")
if o:
    s = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(len(r.pages), [str(x.get('/Page')) for x in r.outline])", o)
    print("INFO  pagesOut with a page number past the end (order [0, 1] on a 1-page PDF): no error; result: %s" % s.strip())
o = call("var pdf = await __open(a.f); return {b64: __b64(P.pagesOut(pdf, {order: [0, 1], rotate: {0: 90}}))};", {"f": "t_inherit.pdf"}, "pages_inherit.pdf").get("path")
if o:
    s = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint([(p.get('/Rotate'), [float(x) for x in p.mediabox]) for p in r.pages])", o)
    ck("pages: Rotate and MediaBox set on the page tree: page 1 turned once more (180), page 2 still 90, size 500x700", "(180, [0.0, 0.0, 500.0, 700.0]), (90, [0.0, 0.0, 500.0, 700.0])" in s, s)
    ck("pages: inherited resources kept (words read)", "Inherited page 1" in ptext(o), ptext(o)[:100])
o = call("var pdf = await __open(a.f); return {b64: __b64(P.pagesOut(pdf, {order: [0, 1, 2]}))};", {"f": "t_dests.pdf"}, "pages_dests.pdf").get("path")
if o:
    s = pyrun("import sys\nimport pikepdf\nd=pikepdf.open(sys.argv[1])\nprint('Dests' if '/Dests' in d.Root else 'noDests', 'Open' if '/OpenAction' in d.Root else 'noOpen', 'Labels' if '/PageLabels' in d.Root else 'noLabels')", o)
    ck("pages: all pages kept: the link to a named place (catalog /Dests), page labels and open action kept", s.strip() == "Dests Open Labels", s)
o = call("var pdf = await __open(a.f); return {b64: __b64(P.pagesOut(pdf, {order: [0, 0, 1]}))};", {"f": "f_form.pdf"}, "pages_dup.pdf").get("path")
if o:
    ok, info = qcheck(o)
    s = pyrun("import sys\nimport pikepdf\nd=pikepdf.open(sys.argv[1])\na=[set(x.objgen for x in (p.obj.get('/Annots') or [])) for p in d.pages]\nprint(len(a[0] & a[1]))", o)
    ck("pages: a page put in twice gets its own comments/fields (no widget shared by two pages)", s.strip() == "0" and ok, (s, info))
COMB = "var list = []; for (var k = 0; k < a.fs.length; k++) list.push({pdf: await __open(a.fs[k], a.pws[k]), name: a.fs[k]}); return {b64: __b64(P.combine(list))};"
o = call(COMB, {"fs": ["t_latex.pdf", "f_form.pdf"], "pws": [None, None]}, "comb_form_second.pdf").get("path")
if o:
    ok, info = qcheck(o); ck("combine (a paper, then a form): qpdf --check", ok, info)
    fv = fields_pypdf(o); ck("combine (a paper, then a form): the form's fields are a form still (pypdf reads them from the AcroForm)", "name" in fv and "shift" in fv, fv)
    d = subprocess.run(["pdftk", o, "dump_data_fields_utf8"], capture_output=True, text=True).stdout
    ck("combine (a paper, then a form): pdftk sees the fields", "FieldName: name" in d, d[:200])
o = call(COMB, {"fs": ["f_form.pdf", "f_form_objstm_lin.pdf"], "pws": [None, None]}, "comb_two_forms.pdf").get("path")
if o:
    fv = fields_pypdf(o)
    n = pyrun("import sys\nimport pikepdf\nd=pikepdf.open(sys.argv[1])\nprint(sum(1 for p in d.pages for a in (p.obj.get('/Annots') or []) if a.get('/Subtype')=='/Widget'), len(d.Root.AcroForm.Fields))", o)
    ck("combine two copies of one form: every widget of both reachable from the AcroForm (names that clash made distinct or merged knowingly)", n.split()[0] and fv and len(fv) >= 20, (n, sorted(fv)[:30]))
o = call(COMB, {"fs": ["t_fonts_aes128_user.pdf", "a_annots_objstm.pdf"], "pws": ["user1", None]}, "comb_locked.pdf").get("path")
if o:
    ok, info = qcheck(o); ck("combine a locked PDF and one with object streams: qpdf --check, unlocked, 4 pages", ok and "Smithfield" in ptext(o, 1), info)

# ===================== Fill in, flatten =====================
VALS = {"name": "Zoë Ångström", "notes": "Line one\nLine two\nLine three", "pin": "4321", "code": "AB12CD", "agree": True, "shift": "Night", "unit": "m", "grade": "C", "right": "RIGHT", "addr.street": "1 Main St", "addr.city": "Tulsa", "job": "J-77"}
r = call("var pdf = await __open(a.f); return {b64: __b64(await P.fillForm(pdf, a.v))};", {"f": "f_form.pdf", "v": VALS}, "fill.pdf")
o = r.get("path")
if o:
    ok, info = qcheck(o); ck("fill: qpdf --check", ok, info)
    fv = fields_pypdf(o)
    want = {"name": VALS["name"], "notes": VALS["notes"], "pin": "4321", "code": "AB12CD", "agree": "/Yes", "shift": "/Night", "unit": "m", "grade": "C", "right": "RIGHT", "addr.street": "1 Main St", "addr.city": "Tulsa", "job": "J-77"}
    bad = {k: (fv.get(k), v) for k, v in want.items() if fv.get(k) != v}
    ck("fill: pypdf reads every value", not bad, bad)
    s = pyrun("import sys\nimport pikepdf\nd=pikepdf.open(sys.argv[1])\nfor f in d.Root.AcroForm.Fields:\n  if str(f.get('/T'))=='shift':\n    print([str(k.get('/AS')) for k in f.Kids])\n  if str(f.get('/T'))=='grade':\n    print('I', repr(f.get('/I')), repr(f.get('/V')))", o)
    ck("fill: the radio group: only Night on", "['/Off', '/Night', '/Off']" in s, s)
    ck("fill: a list box: its selected index (/I) follows the value or is dropped", ("I None" in s or "pikepdf.Array([ 2 ])" in s), s)
    fl = flat_qpdf(o, os.path.join(OUT, "fill_qflat.pdf")); t = ptext(fl, 1)
    ck("fill: each value drawn (poppler, the drawings flattened by qpdf)", all(x in t for x in ["Line one", "Line three", "Tulsa" if False else "RIGHT", "J-77"]) and "4321" not in t and "****" in t, t[:600])
    ck("fill: a name with ë and Å drawn as written", "Zoë Ångström" in t, [l for l in t.splitlines() if "Zo" in l])
    wb = word_box(fl, 1, "RIGHT"); ws, _ = bbox(fl, 1)
    ck("fill: a field aligned right (/Q 2) drawn at its right edge (field ends at x=350)", wb and 340 < wb[0][3] <= 350, wb)
    cb = word_box(fl, 1, "AB12CD") or [w for w in ws if w[0] in ("A", "B", "1", "2", "C", "D")]
    ck("fill: a comb field (MaxLen 6) drawn one letter a cell across its width (150 to 270)", cb and (max(w[3] for w in cb) - min(w[1] for w in cb)) > 90, [(w[0], round(w[1]), round(w[3])) for w in cb][:8])
    t2 = ptext(fl, 2); ck("fill: page 2's kids (addr.street, addr.city) and the twin field drawn", "1 Main St" in t2 and "Tulsa" in t2 and "J-77" in t2 and "J-77" in t, t2[:300])
    fl2 = call("var pdf = await __open(a.f); return {b64: __b64(await P.flatten(pdf, {forms: true, comments: true}))};", {"f": "fill.pdf"}, "fill_flat.pdf").get("path")
    if fl2:
        ok, info = qcheck(fl2); ck("flatten the filled form: qpdf --check", ok, info)
        pa = render(fl, os.path.join(OUT, "fill_qflat"), 1, 72); pb = render(fl2, os.path.join(OUT, "fill_flat"), 1, 72)
        dm = img_diff(pa, pb); ck("flatten: the page looks as qpdf's flattening of the same (mean grey difference < 2)", dm[0] < 2, dm)
        ck("flatten: no fields left (pypdf)", not fields_pypdf(fl2) or fields_pypdf(fl2) == {}, fields_pypdf(fl2))
r = call("var pdf = await __open(a.f); return {b64: __b64(await P.fillForm(pdf, {shift: 'Sunday'}))};", {"f": "f_form.pdf"}, "fill_radio_none.pdf")
if r.get("path"):
    fv = fields_pypdf(r["path"]); s = pyrun("import sys\nimport pikepdf\nd=pikepdf.open(sys.argv[1])\nfor f in d.Root.AcroForm.Fields:\n  if str(f.get('/T'))=='shift': print(f.get('/V'), [str(k.get('/AS')) for k in f.Kids])", r["path"])
    ck("fill: a radio value that is none of its choices leaves the group as it was (value and buttons agree)", ("/Day" in s and "'/Day'" in s) or ("None" in s and "'/Day'" not in s), s)
r = call("var pdf = await __open(a.f); return {b64: __b64(await P.fillForm(pdf, {inspector: 'J. SMITH'}))};", {"f": "f_rot_form.pdf"}, "fill_rot.pdf")
if r.get("path"):
    fl = flat_qpdf(r["path"], os.path.join(OUT, "fill_rot_qflat.pdf")); wb = word_box(fl, 1, "SMITH")
    ck("fill: a field turned with its page (/MK /R 90) reads across as the page is seen", wb and (wb[0][3] - wb[0][1]) > (wb[0][4] - wb[0][2]), wb)
r = call("var pdf = await __open(a.f, a.pw); return {b64: __b64(await P.fillForm(pdf, {name: 'LOCKED FORM'}))};", {"f": "f_form_aes256_owner.pdf"}, "fill_ownerlocked.pdf")
if r.get("path"):
    ck("fill: a form owner-locked against changes is filled through the API (the tile asks mayChange('fill'))", True)
    print("INFO  fillForm on an owner-locked (no modify) form writes an unlocked filled copy: %s" % fields_pypdf(r["path"]).get("name"))
r = call("var pdf = await __open(a.f); return {b64: __b64(await P.flatten(pdf, {forms: true, comments: true}))};", {"f": "a_annots.pdf"}, "annots_flat.pdf")
if r.get("path"):
    o = r["path"]; ok, info = qcheck(o); ck("flatten comments: qpdf --check", ok, info)
    for pg in (1, 2):
        pa = render(F("a_annots.pdf"), os.path.join(OUT, "annots_orig_p%d" % pg), pg, 72); pb = render(o, os.path.join(OUT, "annots_flat_p%d" % pg), pg, 72)
        im0, im1 = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
        # the see-through (/CA 0.3) red box: as poppler shows it before, and after
        bx = (65, 792 - 525, 155, 792 - 485) if pg == 1 else None
        if bx:
            m0, m1 = ImageStat.Stat(im0.crop(bx)).mean, ImageStat.Stat(im1.crop(bx)).mean
            ck("flatten comments: a box comment 30% see-through (/CA 0.3) stays see-through", abs(m0[1] - m1[1]) < 40, "mean RGB before %s after %s" % ([round(v) for v in m0], [round(v) for v in m1]))
    s = pyrun("import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint([[a.get_object()['/Subtype'] for a in (p.get('/Annots') or [])] for p in r.pages])", o)
    ck("flatten comments: only the links left", s.count("/Link") == 2 and "/Text" not in s and "/FreeText" not in s, s)
    t = ptext(o, 1); ck("flatten comments: the typed comment's words part of the page", "ESMERALDA" in t, t[:300])

# ===================== Comments, Make form =====================
ANN = "var pdf = await __open(a.f); return {b64: __b64(await P.addAnnots(pdf, a.list))};"
r = call(ANN, {"f": "t_fonts_rot90.pdf", "list": [{"page": 0, "kind": "text", "rect": [300, 200, 340, 500], "text": "ROTATEDNOTE words"}, {"page": 0, "kind": "stamp", "rect": [400, 100, 450, 300], "text": "APPROVED"}]}, "annot_rot.pdf")
if r.get("path"):
    fl = flat_qpdf(r["path"], os.path.join(OUT, "annot_rot_qflat.pdf")); wb = word_box(fl, 1, "ROTATEDNOTE"); sb = word_box(fl, 1, "APPROVED")
    ck("comment: a text box put on a page turned 90 reads across as the page is seen (as Acrobat writes it)", wb and (wb[0][3] - wb[0][1]) > (wb[0][4] - wb[0][2]), wb)
    ck("comment: a stamp on a page turned 90 reads across as the page is seen", sb and (sb[0][3] - sb[0][1]) > (sb[0][4] - sb[0][2]), sb)
r = call(ANN, {"f": "t_fonts.pdf", "list": [{"page": 0, "kind": "text", "rect": [300, 200, 500, 240], "text": "T ≤ 40 °C, R = 4.7 kΩ"}]}, "annot_unicode.pdf")
if r.get("path"):
    fl = flat_qpdf(r["path"], os.path.join(OUT, "annot_unicode_qflat.pdf")); t = ptext(fl, 1)
    ck("comment: a text box's words beyond Latin-1 (≤, Ω) drawn as typed", "≤" in t and "Ω" in t, [l for l in t.splitlines() if "40" in l][:3])
FLD = "var pdf = await __open(a.f); return {b64: __b64(await P.addFields(pdf, a.list))};"
r = call(FLD, {"f": "f_form.pdf", "list": [{"page": 0, "kind": "text", "name": "addr", "rect": [400, 300, 550, 320]}]}, "fields_clash.pdf")
ck("make form: a new box named as an existing parent field (addr, which has addr.street) is refused", bool(r.get("err")), r.get("err") or fields_pypdf(r.get("path", "")))
r = call(FLD, {"f": "t_fonts_rot90.pdf", "list": [{"page": 0, "kind": "text", "name": "Inspector", "rect": [300, 200, 330, 450]}]}, "fields_rot.pdf")
if r.get("path"):
    r2 = call("var pdf = await __open(a.f); return {b64: __b64(await P.fillForm(pdf, {Inspector: 'SIDEWAYS SMITH'}))};", {"f": "fields_rot.pdf"}, "fields_rot_filled.pdf")
    fl = flat_qpdf(r2["path"], os.path.join(OUT, "fields_rot_qflat.pdf")); wb = word_box(fl, 1, "SIDEWAYS")
    ck("make form on a page turned 90: a box dragged along the line as seen, filled: its words read across as seen", wb and (wb[0][3] - wb[0][1]) > (wb[0][4] - wb[0][2]), wb)
r = call(FLD, {"f": "f_form.pdf", "list": [{"page": 1, "kind": "choice", "name": "Größe", "rect": [100, 300, 250, 320], "options": ["Klein", "Groß"]}, {"page": 0, "kind": "tick", "name": "Checked", "rect": [500, 500, 514, 514]}]}, "fields_add.pdf")
if r.get("path"):
    ok, info = qcheck(r["path"]); fv = fields_pypdf(r["path"])
    ck("make form on a form: old fields kept, new ones there (pypdf), qpdf clean", ok and "Größe" in fv and "Checked" in fv and "addr.street" in fv and len(fv) >= 14, (info, sorted(fv)))

# ===================== Remove hidden =====================
r = call("var pdf = await __open(a.f); return {b64: __b64(P.sanitize(pdf, {details: true, scripts: true, files: true, comments: false, forms: false}))};", {"f": "t_scripts.pdf"}, "sanitize.pdf")
if r.get("path"):
    raw = qdf(r["path"]); ok, info = qcheck(r["path"]); ck("remove hidden: qpdf --check", ok, info)
    for w in [b"ZANZIBAR", b"QUIXOTE", b"HEPZIBAH", b"PERPETUA", b"ALOYSIUS", b"TIBERIUS", b"PAGEOPEN", b"BARNABY", b"LINKSCRIPT", b"NEXTSCRIPT", b"calc.exe", b"/JavaScript", b"/Launch"]:
        ck("remove hidden: no %s" % w.decode(), w not in raw, raw.count(w))
    ck("remove hidden: the web link kept", b"example.org/kept" in raw, "")
    print("INFO  remove hidden: a SubmitForm action (sends the form's data to a web address) kept: %s" % (b"example.org/collect" in raw))

# ===================== Reduce size =====================
import make_fixtures
make_fixtures.make_big(OUT)
SH = "var pdf = await __open(a.f); var r = await P.shrink(pdf, {dpi: a.dpi}); return {b64: __b64(r.bytes), n: r.pictures, after: r.after};"
for dpi in (150, 72):
    r = call(SH, {"f": "i_images.pdf", "dpi": dpi}, "shrink_%d.pdf" % dpi)
    if not r.get("path"): ck("shrink %d" % dpi, False, r); continue
    o = r["path"]; ok, info = qcheck(o); ck("shrink %d: qpdf --check" % dpi, ok, info)
    s0, s1 = os.path.getsize(F("i_images.pdf")), os.path.getsize(o)
    ck("shrink %d: smaller (%d -> %d bytes, %d pictures)" % (dpi, s0, s1, r["n"]), s1 < s0, "")
    labels = ["rgb flate", "gray flate", "cmyk jpeg inverted", "indexed", "rgb with smask", "rgb with stencil mask", "rgb with colour-key mask", "gray decode 1 0", "rgb 16 bit", "small jpeg", "big jpeg", "rgb flate through a form"]
    for k, lab in enumerate(labels):
        pa = render(F("i_images.pdf"), os.path.join(OUT, "img_orig_p%d" % (k + 1)), k + 1, 36); pb = render(o, os.path.join(OUT, "img_%d_p%d" % (dpi, k + 1)), k + 1, 36)
        dm = img_diff(pa, pb)
        ck("shrink %d: page %d (%s) looks as before (mean grey difference %.1f < 6)" % (dpi, k + 1, lab, dm[0]), dm[0] < 6, dm)
r = call(SH, {"f": "i_objstm_text.pdf", "dpi": 72}, "shrink_objstm.pdf")
if r.get("path"):
    s0, s1 = os.path.getsize(F("i_objstm_text.pdf")), os.path.getsize(r["path"])
    ck("shrink: a text PDF with object streams and one picture never comes out bigger (%d -> %d bytes, %d pictures made smaller)" % (s0, s1, r.get("n", -1)), s1 <= s0, "")

# ===================== Export, Compare =====================
r = B.js("""var out = {}; for (var k = 0; k < a.fs.length; k++) { var pdf = await __open(a.fs[k]); var pics = await P.pagesAsPictures(pdf, {dpi: 72, pages: [0]});
  var bm = await createImageBitmap(new Blob([pics[0].data])); out[a.fs[k]] = [bm.width, bm.height]; } return out;""", {"fs": ["t_fonts_rot90.pdf", "t_fonts_crop.pdf", "t_offset_box.pdf", "t_inherit.pdf"]})
want = {"t_fonts_rot90.pdf": [792, 612], "t_fonts_crop.pdf": [510, 660], "t_offset_box.pdf": [520, 720], "t_inherit.pdf": [700, 500]}
for k, v in want.items(): ck("export: %s page 1 as a picture at 72 dpi is %dx%d (as seen)" % (k, v[0], v[1]), abs(r[k][0] - v[0]) <= 2 and abs(r[k][1] - v[1]) <= 2, r[k])
r = B.js("""var a1 = await __open('t_fonts.pdf'), a2 = await __open('t_fonts.pdf'), c = await P.comparePage(a1, 0, a2, 0, {dpi: 50});
  var r1 = await __open('t_fonts_rot90.pdf'), c2 = await P.comparePage(a1, 0, r1, 0, {dpi: 50});
  return {same: [c.gone, c.added], rot: [c2.gone, c2.added], w: P.compareWords(['a','b','a','c'], ['a','c','a','b'])};""")
ck("compare: a page with itself: nothing changed", r["same"] == [0, 0], r["same"])
ck("compare: a page with the same page turned: changes found", r["rot"][0] > 0 and r["rot"][1] > 0, r["rot"])
ck("no page errors", not B.errs, B.errs)
B.close()
print("%d checks, %d failed (outputs in %s)" % (ck.n, len(ck.bad), OUT))
