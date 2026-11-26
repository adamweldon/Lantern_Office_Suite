# run_redact.py -- redaction, tried to break: words found and marked ("Mark them all"), and areas dragged over words
# where another viewer (poppler) shows them, on PDFs from many makers. For each word marked, the copy is checked by
# tools that are not Lantern: not in poppler's words nor pypdf's, nowhere in the file (qpdf, every stream unpacked), the
# place poppler showed it black in poppler's picture of the copy, and not read back by tesseract from that picture.
# Pages not marked: their drawing byte for byte as before. Words not marked: still found, near where they were.
# Usage: python3 run_redact.py [build.html] [outdir]
import os, sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
from PIL import Image
import pikepdf
FX = HERE
SITE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else tempfile.mkdtemp(prefix="redact_1240_")
os.makedirs(OUT, exist_ok=True)
ck = Checks(open(os.path.join(OUT, "run_redact.log"), "w"))
B = Browser(SITE, [FX, OUT])
results = []

JS = """var pdf = await __open(a.f, a.pw), areas = [];
  if (a.flat) pdf = await P.open(await P.flatten(pdf, {forms: true, comments: true}));
  for (var k = 0; k < (a.find || []).length; k++) areas = areas.concat(await __marks(pdf, a.find[k], a.pages));
  (a.rects || []).forEach(function (r) { areas.push(r); });
  if (!areas.length) return {areas: [], err: 'nothing marked'};
  try { var out = await P.redact(pdf, {areas: areas, words: a.noWords ? [] : (a.find || [])}); return {b64: __b64(out), areas: areas}; }
  catch (e) { return {areas: areas, err: String(e && e.stack || e)}; }"""

def dark_share(png, box, pad=1.0):
    im = Image.open(png).convert("L"); W, H = im.size
    x0, y0, x1, y1 = [int(round(v)) for v in (box[0] + pad, box[1] + pad, box[2] - pad, box[3] - pad)]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0: return 1.0
    px = list(im.crop((x0, y0, x1, y1)).getdata())
    return sum(1 for v in px if v < 90) / float(len(px))

def ocr_any(png):
    im = Image.open(png); txt = ""
    for ang in (0, 90, 180, 270):
        f = png[:-4] + "_r%d.png" % ang
        (im.rotate(ang, expand=True) if ang else im).save(f)
        txt += "\n" + ocr_words(f)
    return txt

def contents_of(path, i, pw=None):
    with pikepdf.open(path, password=pw or "") as d:
        pg = d.pages[i]
        c = pg.obj.get("/Contents")
        if c is None: return b""
        if isinstance(c, pikepdf.Array): return b"\n".join(x.read_bytes() for x in c)
        return c.read_bytes()

def case(name, f, targets, mode="find", pages=None, pw=None, extra_rects=None, keep_pages=None, flat=False, page_of=None, note=""):
    """targets: words (as poppler splits them) to be taken out; mode find: Lantern finds and marks them; mode area: a
    rectangle dragged over each where poppler shows it (2 points wider on each side), with no words given"""
    src = os.path.join(FX, f) if os.path.exists(os.path.join(FX, f)) else os.path.join(OUT, f)
    marked_pages = pages if pages is not None else [0]
    rects = list(extra_rects or [])
    pb = {}   # target -> [(page, box as shown)]
    for i in marked_pages:
        info = page_info(src, i, pw)
        words, (W, H) = bbox(src, i + 1, pw)
        for t in targets:
            hits = [w for w in words if t.lower() in w[0].lower() or (len(w[0]) >= 4 and w[0].lower() in t.lower() and len(t) <= len(w[0]) + 3)]
            for w in hits:
                pb.setdefault(t, []).append((i, w[1:]))
                if mode == "area":
                    r = shown_rect_to_user(info["crop"], info["rot"], (w[1] - 2, w[2] - 2, w[3] + 2, w[4] + 2))
                    rects.append({"page": i, "rect": r})
    arg = {"f": f, "pw": pw, "pages": marked_pages, "flat": flat}
    if mode == "find": arg["find"] = targets
    else: arg["rects"] = rects; arg["noWords"] = True
    if extra_rects and mode == "find": arg["rects"] = extra_rects
    r = B.js(JS, arg)
    res = {"case": name, "file": f, "mode": mode, "targets": targets, "areas": r.get("areas"), "err": r.get("err"), "fails": []}
    if r.get("err"):
        ck(name + ": redact ran", False, r["err"]); res["fails"].append("error " + r["err"][:300]); results.append(res); return
    out = save_b64(r["b64"], os.path.join(OUT, name + ".pdf"))
    ok, info = qcheck(out); ck(name + ": qpdf --check", ok, info)
    raw = qdf(out)
    txt = "\n".join(ptext(out, i + 1) for i in marked_pages)
    ptxt = "\f".join(pypdf_text(out).split("\f")[i] for i in marked_pages if i < len(pypdf_text(out).split("\f")))
    with pikepdf.open(src, password=pw or "") as d0: n_all = len(d0.pages)
    unmarked_src = b"\n".join(contents_of(src, i, pw) for i in range(n_all) if i not in marked_pages)
    for t in targets:
        if not pb.get(t): ck(name + ": poppler finds '%s' in the original (else this target tests nothing)" % t, False, "poppler has no such word"); continue
        low = t.lower()
        # in the file at all (the invisible words are written in plain Helvetica, so a literal search finds them)
        ck(name + ": '%s' not in poppler's words of the marked pages" % t, low not in txt.lower(), [l for l in txt.splitlines() if low in l.lower()][:3])
        ck(name + ": '%s' not in pypdf's words of the marked pages" % t, low not in ptxt.lower(), [l for l in ptxt.splitlines() if low in l.lower()][:3])
        tb = t.encode("latin-1", "ignore")
        held = b"\n".join(reach(out, i) for i in marked_pages)
        ck(name + ": '%s' in nothing the marked pages hold (their drawing, pictures, fonts, comments; qpdf/pikepdf unpacked)" % t, tb.lower() not in held.lower() and t.encode("utf-8").lower() not in held.lower(), held.lower().count(tb.lower()))
        raw0 = qdf(src, pw); was = b"\n".join(reach(src, i, pw) for i in marked_pages)
        ck(name + ": '%s' nowhere else in the file than before less the marked pages" % t, raw.count(tb) <= raw0.count(tb) - was.count(tb), "%d in the copy; %d in the original, %d of them on the marked pages" % (raw.count(tb), raw0.count(tb), was.count(tb)))
        for (i, bx) in pb[t]:
            png = render(out, os.path.join(OUT, name + "_p%d" % (i + 1)), i + 1, 72)
            share = dark_share(png, bx)
            ck(name + ": where poppler showed '%s' (page %d, %s) is black in the copy" % (t, i + 1, [round(v) for v in bx]), share > 0.97, "black share %.2f; Lantern's marks %s" % (share, [[round(v) for v in m["rect"]] for m in r["areas"] if m["page"] == i][:8]))
    # tesseract on the copy's marked pages (all four ways round)
    for i in marked_pages:
        png = render(out, os.path.join(OUT, name + "_ocr_p%d" % (i + 1)), i + 1, 200)
        o = ocr_any(png).lower().replace(" ", "")
        for t in targets:
            core = re.sub(r"[^a-z0-9]", "", t.lower())
            if len(core) >= 5:
                seen = [core[k:k + 6] for k in range(0, max(1, len(core) - 5)) if core[k:k + 6] in re.sub(r"[^a-z0-9]", "", o)]
                ck(name + ": tesseract does not read '%s' on page %d of the copy" % (t, i + 1), not seen, "read: %s" % seen[:3])
    # pages not marked: their drawing as it was
    with pikepdf.open(src, password=pw or "") as d0: n0 = len(d0.pages)
    for i in range(n0):
        if i in marked_pages: continue
        a0, a1 = contents_of(src, i, pw), contents_of(out, i)
        ck(name + ": page %d (not marked) drawn as before, byte for byte" % (i + 1), a0 == a1, "%d vs %d bytes" % (len(a0), len(a1)))
    # turned and cropped as before
    for i in range(n0):
        i0, i1 = page_info(src, i, pw), page_info(out, i)
        same = i0["rot"] == i1["rot"] and all(abs(a - b) < 0.01 for a, b in zip(i0["crop"], i1["crop"]))
        ck(name + ": page %d keeps its turn and its seen box" % (i + 1), same, (i0, i1))
    # words not marked: still there, near where they were (poppler, before and after)
    for i in marked_pages:
        w0, _ = bbox(src, i + 1, pw); w1, _ = bbox(out, i + 1)
        marks = [m["rect"] for m in r["areas"] if m["page"] == i]
        info = page_info(src, i, pw)
        # a word poppler shows on a line no mark touches (the line taken as poppler's box, the full page wide)
        tboxes = [bx for t in targets for (pi, bx) in pb.get(t, []) if pi == i]
        def row_touched(w):
            if info["rot"] in (90, 270): return any(not (w[3] < b[0] - 2 or w[1] > b[2] + 2) for b in tboxes)
            return any(not (w[4] < b[1] - 2 or w[2] > b[3] + 2) for b in tboxes)
        far = [w for w in w0 if not any(t.lower() in w[0].lower() for t in targets) and not row_touched(w)]
        got = {}
        for w in w1: got.setdefault(w[0], []).append(w)
        missing, moved = [], []
        for w in far:
            cand = [c for c in got.get(w[0], []) if abs((c[2] + c[4]) / 2 - (w[2] + w[4]) / 2) < 6 or abs((c[1] + c[3]) / 2 - (w[1] + w[3]) / 2) < 6]
            if not cand: missing.append(w[0]); continue
            # along the line only (x as shown, or y on a page turned 90/270): the invisible words are Helvetica, whose height differs
            if info["rot"] in (90, 270): d = min(max(abs(c[2] - w[2]), abs(c[4] - w[4])) for c in cand)
            else: d = min(max(abs(c[1] - w[1]), abs(c[3] - w[3])) for c in cand)
            if d > 4: moved.append((w[0], round(d, 1)))
        res["kept_words"] = [len(far) - len(missing), len(far)]; res["moved"] = moved[:10]
        ck(name + ": page %d's words on rows no mark touches are still found in the copy (%d of %d)" % (i + 1, len(far) - len(missing), len(far)), not missing, missing[:20])
        ck(name + ": page %d's kept words start and end within 4 points of where poppler had them, along the line (%d moved more)" % (i + 1, len(moved)), not moved, sorted(moved, key=lambda x: -x[1])[:10])
    results.append(res)

# --- the cases -------------------------------------------------------------------------------------------------
SECRETS = ["Smithfield", "WAVERLEY", "Okonkwo-Bradshaw", "918-555-0143", "123-45-6789", "Harrowgate"]
ODD = ["ZEPHYRINE", "KINGSBRIDGE", "QUILLFEATHER", "TREMONTANE", "BELLWEATHER"]
case("fonts_find_plain", "t_fonts.pdf", SECRETS)
case("fonts_find_odd", "t_fonts.pdf", ODD)
case("fonts_area_plain", "t_fonts.pdf", SECRETS, mode="area")
case("fonts_area_odd", "t_fonts.pdf", ODD, mode="area")
case("rot90_find", "t_fonts_rot90.pdf", SECRETS + ["TREMONTANE"])
case("rot90_area", "t_fonts_rot90.pdf", SECRETS + ["TREMONTANE"], mode="area")
case("rot270_area", "t_fonts_rot270.pdf", ["Smithfield", "Harrowgate"], mode="area")
case("crop_find", "t_fonts_crop.pdf", ["Smithfield", "Harrowgate", "123-45-6789"])
case("crop_area", "t_fonts_crop.pdf", ["Smithfield", "Harrowgate", "123-45-6789"], mode="area")
case("landscape_find", "t_landscape.pdf", ["ALDERGROVE", "Vasquez"])
case("landscape_area", "t_landscape.pdf", ["ALDERGROVE", "Vasquez"], mode="area")
case("offset_find", "t_offset_box.pdf", ["HOLLINGSWORTH", "OBADIAH-77"])
case("offset_area", "t_offset_box.pdf", ["HOLLINGSWORTH", "OBADIAH-77"], mode="area")
case("xobj_find", "t_xobj.pdf", ["NIGHTJAR"])
case("xobj_area", "t_xobj.pdf", ["NIGHTJAR"], mode="area")
case("type3_find", "t_type3.pdf", ["PELLINORE"])
case("type3_area", "t_type3.pdf", ["PELLINORE"], mode="area")
case("latex_find", "t_latex.pdf", ["office", "Quince", "Waverley"], pages=[0])
case("latex_area", "t_latex.pdf", ["offices", "Quince", "Waverley"], mode="area", pages=[0])
case("xelatex_find", "t_xelatex.pdf", ["Fairweather", "Ünïcödé"])
case("chrome_find", "t_chrome.pdf", ["Ashdown-Pryce", "7730-1142", "MARGINALIA"])
case("chrome_area", "t_chrome.pdf", ["Ashdown-Pryce", "7730-1142", "MARGINALIA"], mode="area")
case("lo_find", "t_lo.pdf", ["Blackwood-Ince", "1290"])
case("ocr_find", "t_ocr.pdf", ["Wilhelmina", "5512"])
case("annots_find", "a_annots.pdf", ["ESMERALDA"], pages=[0])
case("annots_rot_find", "a_annots.pdf", ["ESMERALDA"], pages=[1])
case("inline_find", "t_inline.pdf", ["PEREGRINE", "KESTREL"])
case("multistream_find", "t_multistream.pdf", ["NUTHATCH", "GOLDCREST"])
case("incremental_find", "t_incremental.pdf", ["NEW"])
case("locked_find", "t_fonts_aes128_user.pdf", ["Smithfield"], pw="user1")
# things the marked pages hold that are not drawn: a note's words, an attached file; the old revision of an updated page
case("annots_find_flatfirst", "a_annots.pdf", ["ESMERALDA"], pages=[0], flat=True)
if os.path.exists(os.path.join(OUT, "annots_find.pdf")):
    held = reach(os.path.join(OUT, "annots_find.pdf"), 0)
    for w in [b"MORDECAI", b"OBERON", b"ESMERALDA"]:
        ck("annots_find: '%s' (a note, an attached file, a typed comment on the marked page) not held by the marked page" % w.decode(), w not in held, held.count(w))
    held2 = reach(os.path.join(OUT, "annots_find.pdf"), 1)
    ck("annots_find: page 2 (not marked) keeps its note, attached file and typed comment", all(w in held2 for w in [b"MORDECAI", b"OBERON", b"ESMERALDA"]), [w for w in [b"MORDECAI", b"OBERON", b"ESMERALDA"] if w not in held2])
raw = qdf(os.path.join(OUT, "incremental_find.pdf")) if os.path.exists(os.path.join(OUT, "incremental_find.pdf")) else b""
ck("incremental_find: the earlier revision's words (OLD PRICE 450) are not in the copy", b"OLD PRICE" not in raw, raw.count(b"OLD PRICE"))
raw = qdf(os.path.join(OUT, "lo_find.pdf")) if os.path.exists(os.path.join(OUT, "lo_find.pdf")) else b""
ck("lo_find: no structure tree (its ActualText/Alt could hold marked words)", b"/StructTreeRoot" not in raw, "")
# hidden text on a page that is marked elsewhere: what becomes of it
r = B.js(JS, {"f": "t_hidden.pdf", "pages": [0], "rects": [{"page": 0, "rect": [60, 672, 340, 696]}], "noWords": True})
if r.get("b64"):
    out = save_b64(r["b64"], os.path.join(OUT, "hidden_area.pdf")); raw = qdf(out)
    ck("hidden: the words under the area marked (white, covered) gone", b"CASSIOPEIA" not in raw and b"LINDQVIST" not in raw, [w for w in [b"CASSIOPEIA", b"LINDQVIST"] if w in raw])
    ck("hidden: words in a layer that is off are not carried into the copy (they were never seen)", b"BALTHAZAR" not in raw, "")
    for w in [b"MARCHETTI", b"ROSKILDE"]:
        print("INFO  hidden: '%s' (off the page / invisible in the original, not marked) in the copy: %s" % (w.decode(), w in raw))
else: ck("hidden: redact ran", False, r.get("err"))
ck("no page errors", not B.errs, B.errs)
json.dump(results, open(os.path.join(OUT, "redact_results.json"), "w"), indent=1)
B.close()
print("%d checks, %d failed (outputs in %s)" % (ck.n, len(ck.bad), OUT))
