# run_review.py -- review 2 of 1.24.40's PDF tools: the mends tried to break with PDFs made here (make_fixtures.py) and
# read back by programs that are not Lantern (poppler, qpdf, pypdf, pikepdf, tesseract, reportlab's Adobe metrics).
# Usage: python3 run_review.py <new build.html> <old build.html> <outdir> [group ...]
#   groups: afm redact find sweep form helv parse regress layout perf  (all when none given)
# Every check goes to cases.json (here) and cases.log.
import os, sys, json, re, time, base64, glob, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from common import *
NEW = sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad/lantern_1240_r2.html"
OLD = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "site", "index.html")
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "out")
GROUPS = set(sys.argv[4:])
os.makedirs(OUT, exist_ok=True)
def on(g): return not GROUPS or g in GROUPS
# (a replay that names its own output folder -- tests/review2_pdf_1240.py -- keeps its cases there, not over the review's)
CJ_DIR = OUT if len(sys.argv) > 3 else HERE
CJ = os.path.join(CJ_DIR, "cases.json") if not GROUPS else os.path.join(CJ_DIR, "cases_%s.json" % "_".join(sorted(GROUPS)))
C = Cases(CJ)
FX = HERE
R1 = os.path.join(ROOT, "tests", "fixtures", "pdf_review1_1240")
R3 = os.path.join(ROOT, "tests", "fixtures", "pdf_review3_1239")
FXROOT = os.path.join(ROOT, "tests", "fixtures")
def F(f):
    for d in (FX, OUT, R1, R3):
        if os.path.exists(os.path.join(d, f)): return os.path.join(d, f)
    return os.path.join(FX, f)

PRE2 = """
window.__marks2 = async function (pdf, word, pages, grouped) { var P = Lantern.pdf, out = []; for (var i = 0; i < pdf.count; i++) { if (pages && pages.indexOf(i) < 0) continue;
  var bx = (await P.pageText(pdf, i)).boxes; P.redactMarks(bx, word.toLowerCase(), grouped).forEach(function (r) { out.push({page: i, rect: r}); }); } return out; };
window.__png = function (cv) { return cv.toDataURL('image/png').split(',')[1]; };
"""
_B = {}
def browser(which):
    if which not in _B:
        b = Browser2(NEW if which == "new" else OLD, [FX, OUT, R1, R3, FXROOT])
        b.pg.evaluate("(function () {" + PRE2 + "})()")
        _B[which] = b
    return _B[which]

def save(b64, name):
    p = os.path.join(OUT, name); open(p, "wb").write(base64.b64decode(b64)); return p

# =====================================================================================================================
# 1. Adobe's metrics: Lantern's stdWidth for every WinAnsi letter against reportlab's copy of Adobe's AFM files
# =====================================================================================================================
if on("afm"):
    from reportlab.pdfbase._fontdata import widthsByFontGlyph, encodings
    win = encodings["WinAnsiEncoding"]
    import codecs
    B = browser("new")
    fonts = [("Helvetica", "Helvetica"), ("Helvetica-Bold", "Helvetica-Bold"), ("Helvetica-Oblique", "Helvetica"), ("Times-Roman", "Times-Roman"), ("Times-Bold", "Times-Bold"),
             ("Times-Italic", "Times-Italic"), ("Times-BoldItalic", "Times-BoldItalic"), ("Arial,Bold", "Helvetica-Bold"), ("TimesNewRomanPS-BoldItalicMT", "Times-BoldItalic"), ("Courier-Bold", "Courier-Bold")]
    for bn, ref in fonts:
        chars = []
        for code in range(32, 256):
            g = win[code]
            if g is None: continue
            try: ch = bytes([code]).decode("cp1252")
            except Exception: continue
            chars.append((code, g, ch))
        got = B.js("return a.ch.map(function (c) { return P.stdWidth(a.bn, c); });", {"bn": bn, "ch": [c[2] for c in chars]})
        bad = [(c[0], c[1], widthsByFontGlyph[ref].get(c[1]), g2) for c, g2 in zip(chars, got) if widthsByFontGlyph[ref].get(c[1]) is not None and abs(widthsByFontGlyph[ref][c[1]] - g2) > 0.5]
        C("afm", bn, "Lantern's width of every WinAnsi letter (%d) equals Adobe's AFM (reportlab's table for %s)" % (len(chars), ref), not bad, "all equal", bad[:12])
    # code 127 (and 129 141 143 144 157): the PDF standard's WinAnsi maps unused codes to the bullet; reportlab writes every
    # bullet as 127, and poppler shows a bullet there. What Lantern reads and how wide it takes it to be:
    r = B.js("var pdf = await __open('r_invoice.pdf'); var t = await P.pageText(pdf, 0); var l = t.boxes.filter(function (b) { return /Tulsa/.test(b.text); })[0]; return {text: l.text, codes: l.text.split('').map(function (c) { return c.charCodeAt(0); }).filter(function (c) { return c < 32 || c > 126; }), w127: P.stdWidth('Helvetica', String.fromCharCode(127))};")
    C("afm", "r_invoice.pdf", "a bullet written as code 127 (reportlab writes every bullet so; poppler reads U+2022) is read as a bullet", 8226 in r["codes"], "U+2022 in the line", r)
    C("afm", "r_invoice.pdf", "... and is as wide as Helvetica's bullet (350), so the words after it stay in place", abs((r["w127"] or 0) - 350) < 1, 350, r["w127"])
    ws, _ = words(F("r_invoice.pdf"), 1)
    tel = [w for w in ws if w[0] == "918-555-0199"]
    r2 = B.js("var pdf = await __open('r_invoice.pdf'); var t = await P.pageText(pdf, 0); return P.redactMarks(t.boxes, '918-555-0199');")
    if tel and r2:
        H = 792; m = r2[0]
        C("afm", "r_invoice.pdf", "a mark for the number after that bullet starts where poppler puts the number (within 1 pt of its left edge, less the 2.7 pt margin)", abs((m[0] + 0.3 * 9) - tel[0][1]) < 1.0, round(tel[0][1], 2), round(m[0] + 2.7, 2))

# =====================================================================================================================
# 2. Redaction: found and marked (redactMarks + words), or dragged over where poppler shows a word
# =====================================================================================================================
RJS = """var pdf = await __open(a.f, a.pw), areas = [], miss = [], groups = {};
  if (a.fill) pdf = await P.open(await P.fillForm(pdf, a.fill));
  for (var k = 0; k < (a.find || []).length; k++) {
    var m = await __marks2(pdf, a.find[k], a.pages); if (!m.length) miss.push(a.find[k]); areas = areas.concat(m);
    var g = await __marks2(pdf, a.find[k], a.pages, true); groups[a.find[k]] = g.length; }
  (a.rects || []).forEach(function (r) { areas.push(r); });
  var src = a.fill ? __b64(await P.fillForm(await __open(a.f, a.pw), a.fill)) : null;
  if (!areas.length) return {areas: [], miss: miss, err: 'nothing marked'};
  try { var t0 = Date.now(), out = await P.redact(pdf, {areas: areas, words: a.noWords ? [] : (a.find || [])}); return {b64: __b64(out), areas: areas, miss: miss, groups: groups, src: src, ms: Date.now() - t0}; }
  catch (e) { return {areas: areas, miss: miss, err: String(e && e.stack || e)}; }"""

def langs_for(t):
    if re.search("[Ѐ-ӿ]", t): return "rus"
    if re.search("[Ͱ-Ͽ]", t): return None   # no Greek for tesseract here
    return "eng"

def redact_case(name, f, targets, mode="find", pages=None, fill=None, keep_check=True, ocr_check=True, note=""):
    G = "redact"
    if os.environ.get("CASES") and name not in os.environ["CASES"].split(","): return
    B = browser("new")
    src = F(f)
    n0 = npages(src)
    allp = list(range(n0)) if pages is None else pages
    rects = []
    pb = {}
    # the oracle reads the original with its form values and comments made part of the page by qpdf, so poppler sees
    # what a viewer shows (a typed comment, a field's value, a comb's letters)
    osrc = os.path.join(OUT, name + "_oracle_src.pdf")
    subprocess.run(["qpdf", "--generate-appearances", "--flatten-annotations=screen", src, osrc], capture_output=True, timeout=120)
    if not os.path.exists(osrc) or npages(osrc) != n0: osrc = src
    def both(i, t):
        out = locate(words(osrc, i + 1)[0], t)
        for b in locate(words(src, i + 1)[0], t):
            if not any(abs(b[0] - c[0]) < 2 and abs(b[1] - c[1]) < 2 for c in out): out.append(b)
        return out
    for i in allp:
        cb, rot = page_box_rot(src, i)
        for t in targets:
            for bx in both(i, t):
                pb.setdefault(t, []).append((i, bx))
                if mode == "area":
                    # the shown box (2 pt wider) back into the page's own space
                    r = shown_rect_to_user(cb, rot, (bx[0] - 2, bx[1] - 2, bx[2] + 2, bx[3] + 2))
                    rects.append({"page": i, "rect": r})
    arg = {"f": os.path.basename(src) if os.path.dirname(src) in (FX, OUT, R1, R3) else src, "pages": pages, "fill": fill}
    if mode == "find": arg["find"] = targets
    else: arg["rects"] = rects; arg["noWords"] = True
    r = B.js(RJS, arg)
    if r.get("err"):
        C(G, f, "%s: redact ran (%s)" % (name, mode), False, "a PDF", r["err"][:600]); return
    if fill and r.get("src"):
        src = save(r["src"], name + "_src.pdf")
        osrc = os.path.join(OUT, name + "_oracle_src.pdf")
        subprocess.run(["qpdf", "--generate-appearances", "--flatten-annotations=screen", src, osrc], capture_output=True, timeout=120)
        pb = {}
        for i in allp:
            for t in targets:
                for bx in both(i, t): pb.setdefault(t, []).append((i, bx))
    out = save(r["b64"], name + ".pdf")
    n1 = npages(out)
    C(G, f, "%s: the copy has the original's %d pages" % (name, n0), n1 == n0, n0, n1)
    ok, info = qpdf_check(out); C(G, f, "%s: qpdf --check" % name, ok, "clean", info)
    marked = sorted(set(a["page"] for a in r["areas"]))
    for t in targets:
        if mode == "find":
            pp = len(pb.get(t, [])); lg = r.get("groups", {}).get(t, 0)
            C(G, f, "%s: Lantern finds '%s' as often as poppler shows it" % (name, t), lg >= pp and (pp > 0 or lg > 0), "%d (poppler)" % pp, "%d (Lantern's find)" % lg)
        elif not pb.get(t):
            C(G, f, "%s: poppler shows '%s' (else the area case tests nothing)" % (name, t), False, "found", "not found")
    if mode == "find":
        for i in marked:
            cb, rot = page_box_rot(src, i)
            tb = [bx for t in targets for (pi, bx) in pb.get(t, []) if pi == i]
            if not tb: continue
            stray = []
            for a in r["areas"]:
                if a["page"] != i: continue
                m = user_rect_to_shown(cb, rot, a["rect"])
                if not any(m[0] < b[2] + 2 and b[0] - 2 < m[2] and m[1] < b[3] + 2 and b[1] - 2 < m[3] for b in tb): stray.append([round(v) for v in a["rect"]])
            C(G, f, "%s: every mark Lantern made on page %d lies on a place poppler shows a target (none stray)" % (name, i + 1), not stray, "none", stray[:6])
            # how far the marks reach: words that are not targets, whose letters (poppler's box less 0.5 pt) a mark overlaps
            tl0 = [norm(t) for t in targets]
            over = []
            for w in words(osrc, i + 1)[0]:
                if any(tt in norm(w[0]) for tt in tl0): continue
                b = (w[1] + 0.5, w[2] + 0.5, w[3] - 0.5, w[4] - 0.5)
                for a in r["areas"]:
                    if a["page"] != i: continue
                    m = user_rect_to_shown(cb, rot, a["rect"])
                    if m[0] < b[2] and b[0] < m[2] and m[1] < b[3] and b[1] < m[3]:
                        over.append("%s (%.1f x %.1f pt)" % (w[0], min(m[2], b[2]) - max(m[0], b[0]), min(m[3], b[3]) - max(m[1], b[1]))); break
            C(G, f, "%s: the marks on page %d cover no part of a word that is not looked for (%d do)" % (name, i + 1, len(over)), not over, "none", over[:12])
    raw = qdf_bytes(out)
    for t in targets:
        low = norm(t)
        txt = "\n".join(subprocess.run(["pdftotext", "-f", str(i + 1), "-l", str(i + 1), out, "-"], capture_output=True, text=True, timeout=120).stdout for i in marked)
        ptx = pypdf_pages(out); ptx = "\n".join(ptx[i] for i in marked if i < len(ptx))
        def has(s): return (low in norm(s)) if len(low) >= 6 else bool(re.search(r"(?<![\w])" + re.escape(t.lower()) + r"(?![\w])", s.lower()))
        C(G, f, "%s: '%s' not in poppler's words of the marked pages" % (name, t), not has(txt), "absent", [l for l in txt.splitlines() if t.lower()[:4] in l.lower()][:3])
        C(G, f, "%s: '%s' not in pypdf's words of the marked pages" % (name, t), not has(ptx), "absent", [l for l in ptx.splitlines() if t.lower()[:4] in l.lower()][:3])
        forms = set()
        for enc in ("latin-1", "utf-8", "utf-16-be"):
            try: forms.add(t.encode(enc))
            except Exception: pass
        hits = [fm for fm in forms if fm.lower() in raw.lower()]
        C(G, f, "%s: '%s' nowhere in the copy's bytes (qpdf --qdf, every stream unpacked; Latin-1, UTF-8, UTF-16)" % (name, t), not hits, "absent", [(h, raw.lower().count(h.lower())) for h in hits][:3])
    # the picture: where poppler showed each target, every dark pixel of the original is dark in the copy
    for t in targets:
        for (i, bx) in pb.get(t, []):
            if i not in marked: continue
            o = render(osrc, os.path.join(OUT, name + "_o%d" % i), i + 1, 100); c2 = render(out, os.path.join(OUT, name + "_c%d" % i), i + 1, 100)
            sh_, ink = ink_cover(o, c2, bx, 100)
            if sh_ is None: continue
            C(G, f, "%s: where poppler showed '%s' (page %d, its box %s) is black in the copy" % (name, t, i + 1, [round(v) for v in bx]), sh_ > 0.97, ">0.97 of %d pixels" % ink, "%.3f; Lantern's marks there %s" % (sh_, [[round(v) for v in a["rect"]] for a in r["areas"] if a["page"] == i][:6]))
    # tesseract on the copy (four ways round): a piece of the target (6 letters, 5 if short) read inside one OCR word, and not
    # a piece that the page's other words also hold (Kestrel-5 beside Kestrel-3, DEPTHTWO beside DEPTHTHREE)
    if ocr_check:
        for i in marked:
            png = render(out, os.path.join(OUT, name + "_ocr%d" % i), i + 1, 200)
            other = subprocess.run(["pdftotext", "-f", str(i + 1), "-l", str(i + 1), src, "-"], capture_output=True, text=True, timeout=120).stdout.lower()
            for t in targets: other = re.sub(re.escape(t.lower()), " ", other)
            otoks = [re.sub(r"[\W_]", "", x) for x in other.split()]
            texts = {}
            for t in targets:
                lg = langs_for(t)
                if not lg: continue
                if lg not in texts: texts[lg] = ocr(png, lg)
                toks = [re.sub(r"[\W_]", "", x) for x in texts[lg].lower().split()]
                core = re.sub(r"[\W_]", "", t.lower())
                if len(core) < 5: continue
                k = 6 if len(core) >= 6 else 5
                grams = [core[j:j + k] for j in range(0, len(core) - k + 1)]
                grams = [g for g in grams if not any(g in ot for ot in otoks)]
                seen = [g for g in grams if any(g in tk for tk in toks)]
                C(G, f, "%s: tesseract (%s) does not read '%s' on page %d of the copy" % (name, lg, t, i + 1), not seen, "not read", (seen[:3], [tk for tk in toks if any(g in tk for g in seen)][:3]))
    # words not marked: still found by poppler, in their places, split as poppler split them
    if keep_check:
        for i in marked:
            cb, rot = page_box_rot(src, i)
            w0, _ = words(osrc, i + 1); w1, _ = words(out, i + 1)
            ms = [user_rect_to_shown(cb, rot, a["rect"]) for a in r["areas"] if a["page"] == i]
            tl = [norm(t) for t in targets]
            exp, near = [], []
            for w in w0:
                if any(tt in norm(w[0]) for tt in tl): continue
                wd, ht = w[3] - w[1], w[4] - w[2]
                if wd >= ht or len(w[0]) == 1: body = (w[1] + 1.0, w[2] + 0.15 * ht, w[3] - 1.0, w[4] - 0.15 * ht)
                else: body = (w[1] + 0.15 * wd, w[2] + 1.0, w[3] - 0.15 * wd, w[4] - 1.0)
                if any(m[0] < body[2] and body[0] < m[2] and m[1] < body[3] and body[1] < m[3] for m in ms): continue
                close = any(m[0] < w[3] + 3 and w[1] - 3 < m[2] and m[1] < w[4] + 3 and w[2] - 3 < m[3] for m in ms)
                (near if close else exp).append(w)
            got = {}
            for w in w1: got.setdefault(w[0], []).append(w)
            def find(w):
                cand = got.get(w[0], [])
                best = None
                for c in cand:
                    vert = (w[4] - w[2]) > (w[3] - w[1]) and len(w[0]) > 1
                    along = max(abs(c[2] - w[2]), abs(c[4] - w[4])) if vert else max(abs(c[1] - w[1]), abs(c[3] - w[3]))
                    across = abs((c[1] + c[3]) / 2 - (w[1] + w[3]) / 2) if vert else abs((c[2] + c[4]) / 2 - (w[2] + w[4]) / 2)
                    if across < 0.8 * min(w[4] - w[2], w[3] - w[1]) + 3 and along < 30:
                        if best is None or along < best: best = along
                return best
            miss, moved, nonlat = [], [], [0, 0]
            for w in exp:
                d = find(w)
                if re.search("[^\x00-ɏ]", w[0]): nonlat[1] += 1; nonlat[0] += d is not None
                if d is None: miss.append(w[0])
                elif d > 4: moved.append((w[0], round(d, 1)))
            nm = [w[0] for w in near if find(w) is None]
            C(G, f, "%s: page %d's words away from every mark are still found, split as poppler split them (%d of %d)" % (name, i + 1, len(exp) - len(miss), len(exp)), not miss, "all", miss[:25])
            C(G, f, "%s: page %d's kept words start and end within 4 pt of the original along the line (%d moved more)" % (name, i + 1, len(moved)), not moved, "none", sorted(moved, key=lambda x: -x[1])[:12])
            if nonlat[1]: C(G, f, "%s: page %d's non-Latin words away from marks survive as themselves (%d of %d)" % (name, i + 1, nonlat[0], nonlat[1]), nonlat[0] == nonlat[1], nonlat[1], nonlat[0])
            if nm: print("INFO  %s page %d: words within 3 pt of a mark (not counted) not found: %s" % (name, i + 1, nm[:15]))
    return out, r

if on("redact"):
    redact_case("inv_find", "r_invoice.pdf", ["555-0143", "Smithfield", "Okonkwo-Bradshaw", "4417-8820-1193-0056", "Þórsdóttir", "ZEPHYRINE", "Quillfeather", "Tremontane", "Bellweather", "Harrowgate", "WAVERLEY"])
    redact_case("inv_area", "r_invoice.pdf", ["Halversen", "Tremontane", "Harrowgate", "Kingsbridge"], mode="area")
    redact_case("manual_find", "r_manual2col.pdf", ["Marchetti", "Kestrel-3", "4471"])
    redact_case("latex_find", "l_twocol.pdf", ["Waverley", "Quince", "Marchetti"])
    redact_case("latex_area", "l_twocol.pdf", ["Marchetti", "Quince"], mode="area")
    redact_case("title_find", "r_titleblock.pdf", ["NIGHTJAR", "PELLINORE", "OBADIAH", "ROSKILDE", "CASSIOPEIA", "QUILLFEATHER", "TX-4471-B", "LINDQVIST"])
    redact_case("title_area", "r_titleblock.pdf", ["NIGHTJAR", "PELLINORE", "ROSKILDE", "QUILLFEATHER"], mode="area")
    redact_case("chrome_find", "c_workorder.pdf", ["MERIWEATHER", "Ashdown-Pryce", "7730-1142-5561-0098", "MARGINALIA", "LANTHORNE", "Σταματόπουλος", "Кузнецова", "Corrigan"])
    redact_case("chrome_area", "c_workorder.pdf", ["MARGINALIA", "LANTHORNE", "Ashdown-Pryce"], mode="area")
    redact_case("table_find", "c_table_landscape.pdf", ["ALDERGROVE", "Vasquez", "205.5"])
    redact_case("xe_find", "x_nonlatin.pdf", ["Παπαδόπουλος", "Смирнов", "210-555-0187", "Κωνσταντίνου"])
    redact_case("xe_sigma_level", "x_nonlatin.pdf", ["ΑΘΗΝΑΣ"])
    redact_case("xe_vertical", "x_nonlatin.pdf", ["ΕΡΜΟΥ", "Пушкина"])
    redact_case("xe_sigma_vertical", "x_nonlatin.pdf", ["\u039f\u0394\u039f\u03a3"])
    redact_case("freetext_footer", "h_freetext_footer.pdf", ["Ottoline"])
    redact_case("zadb_find", "h_form_zadb.pdf", ["Strathearn"])
    redact_case("lo_find", "lo_nonlatin.pdf", ["\u03a0\u03b1\u03c0\u03b1\u03bd\u03b9\u03ba\u03bf\u03bb\u03ac\u03bf\u03c5", "\u0418\u0432\u0430\u043d\u043e\u0432", "Blackwood-Ince", "\u0423\u041f-1290"])
    redact_case("scan_find", "t_scan_invoice.pdf", ["Smithfield", "Okonkwo-Bradshaw"])
    redact_case("ops_find", "h_textops.pdf", ["Fairweather", "Galloway", "Ingleby", "Jessamine", "Lockridge", "KERNEDWORD", "Montague", "Northcote", "Oblique", "Quenby", "Rutherford", "DEPTHTHREE", "DEPTHFOUR", "DEPTHFIVE", "Thistlewood", "Umberleigh"])
    redact_case("crop_find", "h_croprot.pdf", ["Fenwick", "Gorringe", "Hollingsworth"])
    redact_case("crop_area", "h_croprot.pdf", ["Gorringe", "Hollingsworth"], mode="area")
    redact_case("qopen_find", "h_qopen.pdf", ["Wetherby", "Yarborough", "Ottoline", "Zetland"])
    redact_case("orphan_find", "h_orphan_links.pdf", ["123-45-6789", "Winterbourne"])
    redact_case("form_find", "r_form.pdf", ["Wexford", "987654321"], fill={"fullname": "Ingrid Wexford", "ssn": "987654321", "notes": "Escort Wexford to bay 4"})
    redact_case("symbol_find", "r_symbol.pdf", ["Galbraith"])
    # what the copy holds that is not drawn: the hidden words outside the seen box
    o = os.path.join(OUT, "crop_find.pdf")
    if os.path.exists(o):
        raw = qdf_bytes(o); t = subprocess.run(["pdftotext", "-nopgbrk", o, "-"], capture_output=True, text=True, timeout=120).stdout
        C("redact", "h_croprot.pdf", "crop_find: a word wholly outside the seen box (OUTSIDERWORD) is not written into the marked pages' words", "OUTSIDERWORD" not in t.replace(" ", ""), "absent", [l for l in t.splitlines() if "OUTSIDER" in l][:3])
        r0 = subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-bbox", o, "-"], capture_output=True, text=True, timeout=120).stdout
        C("redact", "h_croprot.pdf", "crop_find: the part of EDGEWORDACROSS inside the seen box is kept, the part outside not", ("ACROSS" in r0 or "WORDACROSS" in r0) and "EDGEWORDACROSS" not in r0, "a tail such as 'WORDACROSS'", re.findall(r">([^<]*ACROSS[^<]*)<", r0)[:3])
    o = os.path.join(OUT, "orphan_find.pdf")
    if os.path.exists(o):
        raw = qdf_bytes(o)
        C("redact", "h_orphan_links.pdf", "orphan_find: a link whose web address holds a word looked for (WINTERBOURNE) is not kept on the marked page", b"winterbourne" not in raw.lower(), "absent", raw.lower().count(b"winterbourne"))

# =====================================================================================================================
# 3. The viewer's find (grouped marks) and Mark them all against poppler, on every page of every fixture here
# =====================================================================================================================
if on("find"):
    B = browser("new")
    for f, ts in [("r_invoice.pdf", ["smithfield", "waverley", "°c", "€"]), ("r_manual2col.pdf", ["marchetti", "the gauge"]), ("x_nonlatin.pdf", ["οδος", "τεχνικ", "210"]),
                  ("c_workorder.pdf", ["night shift", "really fast", "стам" if False else "клиент"]), ("lo_nonlatin.pdf", ["kω", "€"]), ("h_textops.pdf", ["depth", "words"])]:
        ptxt = " ".join(subprocess.run(["pdftotext", "-f", "1", "-l", "1", F(f), "-"], capture_output=True, text=True, timeout=120).stdout.split()).lower()
        r = B.js("var pdf = await __open(a.f), n = {}; for (var k = 0; k < a.ts.length; k++) n[a.ts[k]] = (await __marks2(pdf, a.ts[k], null, true)).length; return n;", {"f": f, "ts": ts})
        for t in ts:
            p = ptxt.count(t)
            C("find", f, "the viewer's Find counts '%s' as often as poppler's text holds it" % t, r.get(t) == p, p, r.get(t))

# =====================================================================================================================
# 4. Redact never throws nor writes a PDF of no pages: a box in the middle of page 1 of every PDF in the tests
# =====================================================================================================================
if on("sweep"):
    B = browser("new")
    files = sorted(glob.glob(os.path.join(FXROOT, "**", "*.pdf"), recursive=True))
    files = [p for p in files if os.path.getsize(p) < 6e6 and not os.path.basename(p).startswith("sweep_")]
    bad = []
    for p in files:
        rel = os.path.relpath(p, os.path.join(ROOT, "tests", "fixtures"))
        try:
            r = B.js("""var pdf; try { pdf = await __open(a.f, a.pw); } catch (e) { return {open: String(e)}; }
              if (!pdf.count) return {count: 0};
              var bx = pdf.pages[0].box, W = bx[2] - bx[0], H = bx[3] - bx[1];
              try { var o = await P.redact(pdf, {areas: [{page: 0, rect: [bx[0] + 0.3 * W, bx[1] + 0.45 * H, bx[0] + 0.7 * W, bx[1] + 0.55 * H]}], words: []}); return {b64: __b64(o), count: pdf.count}; }
              catch (e) { return {err: String(e && e.message || e), count: pdf.count, locked: !!pdf.doc.needPassword}; }""", {"f": os.path.relpath(p, FXROOT), "pw": None}, timeout=240000)
        except Exception as e:
            r = {"err": "harness: " + str(e)[:200]}
        if r.get("open") or r.get("locked"): continue
        if "b64" in r:
            o = save(r["b64"], "sweep_" + os.path.basename(p)); n = npages(o); ok, info = qpdf_check(o)
            n0 = npages(p)
            good = n == r["count"] and n > 0 and ok
            if not good: bad.append((rel, n, r["count"], info[-120:]))
            C("sweep", rel, "redact a box on page 1: no error, as many pages as Lantern opened (%s), qpdf clean" % r.get("count"), good, "%d pages, clean" % r["count"], (n, info[-160:]))
        elif r.get("count") == 0:
            C("sweep", rel, "Lantern opens it with pages (poppler: %d)" % npages(p), npages(p) <= 0, npages(p), 0)
        else:
            C("sweep", rel, "redact a box on page 1 runs", False, "a PDF", r.get("err"))

# =====================================================================================================================
# 5. Fill in: radio groups (a value none has, "" and "Off", Acrobat's /Opt groups, UTF-8 state names), comb fields
# =====================================================================================================================
def fields_pikepdf(path):
    import pikepdf
    out = {}
    with pikepdf.open(path) as d:
        for f in d.Root.AcroForm.Fields:
            nm = str(f.get("/T", ""))
            kids = f.get("/Kids", [])
            out[nm] = {"V": str(f.get("/V", "")), "AS": [str(k.get("/AS", "")) for k in kids]}
    return out
if on("form"):
    B = browser("new")
    FILL = "var pdf = await __open(a.f); try { return {b64: __b64(await P.fillForm(pdf, a.v))}; } catch (e) { return {err: String(e && e.stack || e)}; }"
    def fill(name, f, v):
        r = B.js(FILL, {"f": f, "v": v})
        if r.get("err"): C("form", f, name + ": fillForm ran", False, "a PDF", r["err"]); return None
        return save(r["b64"], name + ".pdf")
    f0 = fields_pikepdf(F("r_form.pdf"))
    o = fill("radio_valid", "r_form.pdf", {"shift": "Night", "payment": "Card"})
    if o:
        f1 = fields_pikepdf(o)
        C("form", "r_form.pdf", "radio: 'Night' turns Night on and the others off, /V /Night", f1["shift"]["V"] == "/Night" and f1["shift"]["AS"] == ["/Off", "/Night", "/Off"], "/Night [Off Night Off]", f1["shift"])
        C("form", "r_form.pdf", "radio: 'Card' in a group none was on", f1["payment"]["V"] == "/Card" and f1["payment"]["AS"] == ["/Off", "/Card"], "/Card [Off Card]", f1["payment"])
    o = fill("radio_none_of_them", "r_form.pdf", {"shift": "Graveyard"})
    if o:
        f1 = fields_pikepdf(o)
        C("form", "r_form.pdf", "radio: a value none of the buttons has ('Graveyard') leaves the group as it was", f1["shift"] == f0["shift"], f0["shift"], f1["shift"])
    for v in ["", "Off"]:
        o = fill("radio_off_%s" % (v or "empty"), "r_form.pdf", {"shift": v})
        if o:
            f1 = fields_pikepdf(o)
            C("form", "r_form.pdf", "radio: %r turns every button off and /V /Off" % v, f1["shift"]["V"] == "/Off" and all(a == "/Off" for a in f1["shift"]["AS"]), "/Off, all Off", f1["shift"])
    # Acrobat-style: states /0 /1 /2, /Opt giving the values
    f0 = fields_pikepdf(F("h_form_opt.pdf"))
    lst = B.js("var pdf = await __open('h_form_opt.pdf'); var fs = await P.fields(pdf); return fs.map(function (f) { return {name: f.name, type: f.type, value: f.value, options: f.options || f.states || f.choices}; });")
    C("form", "h_form_opt.pdf", "P.fields lists the /Opt group's choices by their values (Klein, Mittel, Größe), as Acrobat shows them", any(x.get("name") == "size" and json.dumps(x).find("Mittel") >= 0 for x in lst), "Klein Mittel Größe", [x for x in lst if x.get("name") == "size"])
    C("form", "h_form_opt.pdf", "P.fields lists the UTF-8 named group's choices readably (Grün, Weiß)", any(x.get("name") == "colour" and "Grün" in json.dumps(x, ensure_ascii=False) for x in lst), "Blau Grün Weiß", [x for x in lst if x.get("name") == "colour"])
    o = fill("radio_opt_value", "h_form_opt.pdf", {"size": "Mittel"})
    if o:
        f1 = fields_pikepdf(o)
        C("form", "h_form_opt.pdf", "radio with /Opt: 'Mittel' turns the second button (state /1) on", f1["size"]["AS"] == ["/Off", "/1", "/Off"], "[Off 1 Off]", f1["size"])
    o = fill("radio_opt_index", "h_form_opt.pdf", {"size": "2"})
    if o:
        f1 = fields_pikepdf(o)
        C("form", "h_form_opt.pdf", "radio with /Opt: its state name '2' turns the third on (/V /2)", f1["size"]["AS"] == ["/Off", "/Off", "/2"] and f1["size"]["V"] == "/2", "[Off Off 2]", f1["size"])
    o = fill("radio_utf8", "h_form_opt.pdf", {"colour": "Grün"})
    if o:
        f1 = fields_pikepdf(o)
        C("form", "h_form_opt.pdf", "radio with UTF-8 state names: 'Grün' turns the second on", f1["colour"]["AS"][1] not in ("/Off", "") and f1["colour"]["AS"][0] == "/Off", "[Off Grün Off]", f1["colour"])
    # comb: each letter in its cell (qpdf flattens the appearance into the page; poppler reads where each letter is)
    o = fill("comb", "r_form.pdf", {"ssn": "123456789", "fullname": "Ingrid Wexford"})
    if o:
        fl = os.path.join(OUT, "comb_qflat.pdf"); subprocess.run(["qpdf", "--flatten-annotations=all", o, fl], timeout=120)
        ws, _ = words(fl, 1)
        letters = []
        r0 = subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-bbox-layout", fl, "-"], capture_output=True, text=True, timeout=120).stdout
        digits = [w for w in ws if re.fullmatch(r"[0-9]+", w[0]) and 140 <= w[1] <= 330 and 792 - 690 < w[2] < 792 - 660]
        # one digit a cell: cells of 20 pt from x 140
        cells = []
        for w in digits:
            n = len(w[0]); step = (w[3] - w[1]) / n
            for k in range(n): cells.append(int(((w[1] + step * (k + 0.5)) - 140) // 20))
        C("form", "r_form.pdf", "comb (MaxLen 9 over 180 pt): the nine digits sit one to a 20 pt cell", sorted(cells) == list(range(9)), list(range(9)), (cells, [(w[0], round(w[1]), round(w[3])) for w in digits]))
        C("form", "r_form.pdf", "comb: qpdf --check of the filled copy", qpdf_check(o)[0], "clean", qpdf_check(o)[1])

# =====================================================================================================================
# 6. Words Helvetica cannot draw: Edit text, comments (text box, stamp), fields, stamps -- drawn spelled out, with
#    /ActualText giving them as typed (poppler honours ActualText)
# =====================================================================================================================
if on("helv"):
    B = browser("new")
    G = "helv"
    TXT = "R = 4.7 kΩ ≤ 5 %, Δp ≥ 2 bar, Привет 中文 \U0001F600 ok"
    WANT = ["Ω", "≤", "≥", "Δ", "Привет", "中文"]
    def flat(o, name):
        fl = os.path.join(OUT, name + "_qflat.pdf"); subprocess.run(["qpdf", "--flatten-annotations=all", o, fl], timeout=120); return fl
    def check_out(name, o, flatten=False, where=""):
        ok, info = qpdf_check(o); C(G, "r_invoice.pdf", "%s: qpdf --check" % name, ok, "clean", info)
        p = flat(o, name) if flatten else o
        t = subprocess.run(["pdftotext", p, "-"], capture_output=True, text=True, timeout=120).stdout
        miss = [w for w in WANT if w not in t]
        C(G, "r_invoice.pdf", "%s: poppler reads the words as typed (Ω ≤ ≥ Δ, Cyrillic, Chinese) through /ActualText" % name, not miss, WANT, (miss, [l for l in t.splitlines() if "4.7" in l][:2]))
        raw = qdf_bytes(p)
        C(G, "r_invoice.pdf", "%s: the drawing spells the ohm sign 'Ohm' and ≤ '<='" % name, b"Ohm" in raw and b"<=" in raw, "Ohm, <=", (b"Ohm" in raw, b"<=" in raw))
        ats = []
        for h in re.findall(rb"/ActualText\s*<([0-9A-Fa-f\s]*)>", raw):
            h = re.sub(rb"\s", b"", h)
            try: ats.append(bytes.fromhex(h.decode())[2:].decode("utf-16-be"))
            except Exception as e: ats.append("?" + repr(e))
        joined = " ".join(ats)
        miss2 = [w for w in WANT + ["\U0001F600"] if w not in joined]
        C(G, "r_invoice.pdf", "%s: the /ActualText strings give every letter as typed (\u03a9 \u2264 \u2265 \u0394, Cyrillic, Chinese, the emoji as a surrogate pair)" % name, not miss2, WANT + ["U+1F600"], (miss2, ats[:4]))
        # what a person sees: the drawing read by tesseract
        png = render(p, os.path.join(OUT, name + "_see"), 1, 200)
        o2 = subprocess.run(["tesseract", png, "-", "--psm", "11"], capture_output=True, text=True, timeout=120).stdout
        return t, raw, o2
    r = B.js("""var pdf = await __open('r_invoice.pdf'); var pcs = [].concat.apply([], (await P.pageText(pdf, 0)).boxes.map(P.editPieces));
      var hit = pcs.filter(function (p) { return p.text.indexOf('Halversen') >= 0; })[0]; if (!hit) return {err: 'no piece'};
      try { return {b64: __b64(await P.editText(pdf, [{page: 0, line: hit, text: a.t}]))}; } catch (e) { return {err: String(e.stack || e)}; }""", {"t": TXT})
    if r.get("err"): C(G, "r_invoice.pdf", "editText ran", False, "", r["err"])
    else: t, raw, see = check_out("edit", save(r["b64"], "helv_edit.pdf"))
    r = B.js("var pdf = await __open('r_invoice.pdf'); try { return {b64: __b64(await P.addAnnots(pdf, [{page: 0, kind: 'text', rect: [300, 150, 580, 200], text: a.t}]))}; } catch (e) { return {err: String(e.stack || e)}; }", {"t": TXT})
    if r.get("err"): C(G, "r_invoice.pdf", "addAnnots (text box) ran", False, "", r["err"])
    else: check_out("annot_text", save(r["b64"], "helv_annot_text.pdf"), flatten=True)
    r = B.js("var pdf = await __open('r_invoice.pdf'); try { return {b64: __b64(await P.addAnnots(pdf, [{page: 0, kind: 'stamp', rect: [300, 100, 580, 140], text: a.t}]))}; } catch (e) { return {err: String(e.stack || e)}; }", {"t": TXT})
    if r.get("err"): C(G, "r_invoice.pdf", "addAnnots (stamp) ran", False, "", r["err"])
    else: check_out("annot_stamp", save(r["b64"], "helv_annot_stamp.pdf"), flatten=True)
    r = B.js("var pdf = await __open('r_form.pdf'); try { return {b64: __b64(await P.fillForm(pdf, {notes: a.t, fullname: a.t}))}; } catch (e) { return {err: String(e.stack || e)}; }", {"t": TXT})
    if r.get("err"): C(G, "r_form.pdf", "fillForm ran", False, "", r["err"])
    else:
        o = save(r["b64"], "helv_fill.pdf"); check_out("fill", o, flatten=True)
        import pikepdf
        with pikepdf.open(o) as d:
            vs = {str(f.get("/T")): str(f.get("/V")) for f in d.Root.AcroForm.Fields if "/V" in f}
        C(G, "r_form.pdf", "fill: the field's value (/V) is the text as typed", vs.get("fullname") == TXT, TXT, vs.get("fullname"))
    r = B.js("var pdf = await __open('r_invoice.pdf'); try { return {b64: __b64(P.stamp(pdf, {items: [{text: a.t, where: 'top-left', size: 10}]}))}; } catch (e) { return {err: String(e.stack || e)}; }", {"t": TXT})
    if r.get("err"): C(G, "r_invoice.pdf", "stamp ran", False, "", r["err"])
    else: check_out("stamp", save(r["b64"], "helv_stamp.pdf"))
    # a line with only Latin-1 letters gets no ActualText (nothing to say), and 'Ohm' typed as such is not changed
    r = B.js("var pdf = await __open('r_invoice.pdf'); return {b64: __b64(P.stamp(pdf, {items: [{text: 'Größe 5 Ohm °C €', where: 'top-left', size: 10}]}))};")
    o = save(r["b64"], "helv_stamp_latin.pdf"); raw = qdf_bytes(o); t = subprocess.run(["pdftotext", o, "-"], capture_output=True, text=True, timeout=120).stdout
    C(G, "r_invoice.pdf", "stamp of WinAnsi words only: no /ActualText, read as typed", b"ActualText" not in raw and "Größe 5 Ohm °C €" in t, "no ActualText; words as typed", (b"ActualText" in raw, [l for l in t.splitlines() if "Ohm" in l][:2]))

# =====================================================================================================================
# 7. PDF_PARSE: cross-reference sections followed (classic, streams, /Prev, /XRefStm), objects checked, the scan as
#    the fallback -- against poppler, and against 1.24.39
# =====================================================================================================================
TJS = "var pdf; try { pdf = await __open(a.f); } catch (e) { return {err: String(e)}; } var t = []; for (var i = 0; i < pdf.count; i++) t.push((await P.pageText(pdf, i)).text); return {count: pdf.count, text: t};"
def ptext_pages(p):
    n = npages(p)
    if n <= 0:
        out = subprocess.run(["pdftotext", p, "-"], capture_output=True, text=True, timeout=120).stdout.split("\f")
        return [x for x in out if x.strip()] if out else []
    return [subprocess.run(["pdftotext", "-f", str(i + 1), "-l", str(i + 1), p, "-"], capture_output=True, text=True, timeout=120).stdout for i in range(n)]
if on("parse"):
    G = "parse"
    expect = {"s_incr_classic.pdf": (["UPDATEDWORD"], ["ORIGINALWORD"]), "s_objstm_base.pdf": (["ORIGINALWORD"], []), "s_objstm_then_plain.pdf": (["NEWPLAINWORD"], ["ORIGINALWORD"]),
              "s_plain_then_objstm.pdf": (["PACKEDNEWWORD"], ["ORIGINALWORD"]), "s_hybrid.pdf": (["HYBRIDWORD"], []), "s_attached_unpacked.pdf": (["OUTERWORD"], ["EMBEDDEDDOC"]),
              "s_attached_unpacked_objstm.pdf": (["OUTERWORD"], ["EMBEDDEDDOC"]), "s_junk_prefix.pdf": (["ORIGINALWORD"], []), "s_offsets_off.pdf": (["SHIFTWORD"], []),
              "s_xref_from1.pdf": (["SHIFTWORD"], []), "s_gen_reuse.pdf": (["REUSENEW"], ["REUSEOLD"]), "q_invoice_lin.pdf": (["Okonkwo-Bradshaw"], []), "q_manual_lin.pdf": (["Marchetti"], []),
              "q_form_lin_objstm.pdf": (["Contractor"], []), "q_lo_long_objstm.pdf": (["Section 60"], [])}
    for f, (yes, no) in expect.items():
        pt = ptext_pages(F(f))
        for which in ("new", "old"):
            r = browser(which).js(TJS, {"f": f})
            if r.get("err"):
                C(G, f, "%s opens it" % which, False, "opens", r["err"]); continue
            alltext = "\n".join(r["text"])
            good = r["count"] == len(pt) and all(y in alltext for y in yes) and not any(n_ in alltext for n_ in no)
            C(G, f, "%s: as many pages as poppler (%d) and the newest words (%s), none of the old or attached (%s)" % (which, len(pt), yes, no), good, (len(pt), yes, no), (r["count"], [y for y in yes if y not in alltext], [n_ for n_ in no if n_ in alltext]))
    # a deleted object brought back? (an annotation dropped from the page's list in an update is not shown)
    # redact and save on a structural file: the copy reads as the newest revision
    for f, w in [("s_objstm_then_plain.pdf", "NEWPLAINWORD"), ("s_plain_then_objstm.pdf", "PACKEDNEWWORD"), ("s_attached_unpacked_objstm.pdf", "OUTERWORD")]:
        r = browser("new").js("var pdf = await __open(a.f); return {b64: __b64(P.stamp(pdf, {items: [{text: 'STAMPED', where: 'top-left', size: 10}]}))};", {"f": f})
        o = save(r["b64"], "parse_stamp_" + f); t = subprocess.run(["pdftotext", o, "-"], capture_output=True, text=True, timeout=120).stdout
        C(G, f, "a stamped copy holds the newest page (%s) and the stamp" % w, w in t and "STAMPED" in t and "EMBEDDEDDOC" not in t, w, t[:200])

# =====================================================================================================================
# 8. Regressions: every PDF in the tests, read and drawn by 1.24.39 and by this build, against poppler
# =====================================================================================================================
DJS = """var pdf; try { pdf = await __open(a.f, a.pw); } catch (e) { return {err: String(e && e.message || e)}; }
  var out = {count: pdf.count, text: [], png: [], ms: 0};
  for (var i = 0; i < Math.min(pdf.count, a.n); i++) {
    var t0 = Date.now();
    try { out.text.push((await P.pageText(pdf, i)).text); } catch (e) { out.text.push('ERR ' + e); }
    try { var cv = await P.pageDraw(pdf, i, {scale: a.s, maxSide: 2000}); out.png.push(__png(cv)); } catch (e) { out.png.push(null); }
    out.ms += Date.now() - t0;
  }
  return out;"""
def wordbag(s): return re.findall(r"\w+", s.lower())
def sim(a, b):
    import difflib
    A, Bw = wordbag(a), wordbag(b)
    if not A and not Bw: return 1.0
    return difflib.SequenceMatcher(None, A, Bw, autojunk=False).ratio()
def gray_diff(png_a, png_b):
    from PIL import ImageChops, ImageStat
    A = Image.open(png_a).convert("L"); Bm = Image.open(png_b).convert("L")
    if A.size != Bm.size: Bm = Bm.resize(A.size)
    return ImageStat.Stat(ImageChops.difference(A, Bm)).mean[0]
POPPLER_LOOPS = {"ve_cycle.pdf"}   # pdftotext and pdftoppm never end on it (optional content that names itself)
if on("regress"):
    G = "regress"
    files = sorted(glob.glob(os.path.join(FXROOT, "**", "*.pdf"), recursive=True))
    files = [p for p in files if os.path.getsize(p) < 6e6 and not re.match(r"(sweep_|redact|inv_|parse_|helv_|radio|comb|form_|crop_|title_|chrome_|table_|xe_|lo_find|scan_|ops_|qopen_|orphan_|symbol_|manual_|latex_)", os.path.basename(p))]
    rows = []
    for p in files:
        rel = os.path.relpath(p, os.path.join(ROOT, "tests", "fixtures")); base = os.path.basename(p)
        res = {}
        for which in ("old", "new"):
            try: res[which] = browser(which).js(DJS, {"f": os.path.relpath(p, FXROOT), "n": 3, "s": 1.0}, timeout=240000)
            except Exception as e: res[which] = {"err": "harness " + str(e)[:200]}
        o, n = res["old"], res["new"]
        if o.get("err") and n.get("err"): continue
        if not o.get("err"):
            C(G, rel, "what 1.24.39 opened, this build opens with the same page count", not n.get("err") and n.get("count") == o.get("count"), o.get("count"), n.get("err") or n.get("count"))
        if n.get("err") or o.get("err"): continue
        if base in POPPLER_LOOPS:
            # poppler never ends on this file: the two builds against each other only
            for i in range(min(len(o["text"]), len(n["text"]), 3)):
                C(G, rel, "page %d: words read as 1.24.39 read them (poppler cannot read this file)" % (i + 1), sim(o["text"][i], n["text"][i]) >= 0.98, "the same", "%.3f alike" % sim(o["text"][i], n["text"][i]))
            continue
        pt = ptext_pages(p)
        for i in range(min(len(o["text"]), len(n["text"]), 3)):
            ref = pt[i] if i < len(pt) else ""
            so, sn = sim(o["text"][i], ref), sim(n["text"][i], ref)
            C(G, rel, "page %d: words read no worse than 1.24.39 (sequence likeness to poppler's)" % (i + 1), sn >= so - 0.02, ">= %.3f" % so, "%.3f" % sn)
            if o["png"][i] and n["png"][i]:
                po = os.path.join(OUT, "rg_old.png"); pn = os.path.join(OUT, "rg_new.png")
                open(po, "wb").write(base64.b64decode(o["png"][i])); open(pn, "wb").write(base64.b64decode(n["png"][i]))
                d_on = gray_diff(po, pn)
                if d_on > 0.3:
                    pp = render(p, os.path.join(OUT, "rg_pop"), i + 1, 72)
                    try: do, dn = gray_diff(pp, po), gray_diff(pp, pn)
                    except Exception: do, dn = 0, 0
                    keep = os.path.join(OUT, "rg_%s_p%d" % (base[:-4], i + 1))
                    if dn > do + 0.3:
                        import shutil; shutil.copy(po, keep + "_old.png"); shutil.copy(pn, keep + "_new.png"); shutil.copy(pp, keep + "_poppler.png")
                    C(G, rel, "page %d: drawn as before, or nearer poppler (old vs new %.2f)" % (i + 1, d_on), dn <= do + 0.3, "<= %.2f from poppler" % do, "%.2f from poppler" % dn)
                else:
                    C(G, rel, "page %d: drawn as before" % (i + 1), True, "", "%.2f" % d_on)
        rows.append((rel, o.get("ms"), n.get("ms")))
    json.dump(rows, open(os.path.join(OUT, "regress_times.json"), "w"))

# =====================================================================================================================
# 9. The tile at phone width: no sideways scroll, pages fitted once the page area exists
# =====================================================================================================================
if on("layout"):
    G = "layout"
    from playwright.sync_api import sync_playwright
    srv = Server(NEW, [FX, OUT])
    import common
    if common._PW[0] is None: common._PW[0] = sync_playwright().start()
    pw = common._PW[0]; br = pw.chromium.launch()
    for (vw, vh, f) in [(390, 844, "c_table_landscape.pdf"), (390, 844, "r_titleblock.pdf"), (360, 740, "r_invoice.pdf"), (844, 390, "r_invoice.pdf")]:
        ctx = br.new_context(viewport={"width": vw, "height": vh}, is_mobile=True, has_touch=True, device_scale_factor=2)
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.goto(srv.url("index.html#pdf"))
        try:
            pg.wait_for_selector("input[type=file][accept='application/pdf,.pdf']", state="attached", timeout=60000)
            pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", os.path.join(FX, f))
            pg.wait_for_function("() => window.Lantern && Lantern.pdfView && Lantern.pdfView.api && Lantern.pdfView.api.pdf && document.querySelectorAll('canvas').length > 0", timeout=60000)
            pg.wait_for_timeout(1500)
            m = pg.evaluate("""() => { var api = Lantern.pdfView.api, el = api.pageEl(0).getBoundingClientRect(), d = document.documentElement;
              var wide = Array.prototype.filter.call(document.querySelectorAll('body *'), function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map(function (e) { return e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right); });
              return {sw: d.scrollWidth, bw: document.body.scrollWidth, iw: innerWidth, page: [Math.round(el.left), Math.round(el.width)], zoom: api.zoom, wide: wide}; }""")
            pg.mouse.wheel(300, 0); pg.wait_for_timeout(200)
            sx = pg.evaluate("() => window.scrollX")
            C(G, f, "%dx%d: the page does not scroll sideways (scrollWidth %s, window %s)" % (vw, vh, m["sw"], m["iw"]), m["sw"] <= m["iw"] + 1 and m["bw"] <= m["iw"] + 1 and sx == 0, "<= %d" % vw, m)
            C(G, f, "%dx%d: the first page is fitted to the width (its left edge on screen, its width at most the window's)" % (vw, vh), m["page"][0] >= -1 and m["page"][0] + m["page"][1] <= vw + 1 and m["page"][1] >= 0.6 * vw, "fits", m["page"])
        except Exception as e:
            C(G, f, "%dx%d: the tile opened the PDF" % (vw, vh), False, "opened", str(e)[:300])
        C(G, f, "%dx%d: no page errors" % (vw, vh), not errs, "none", errs[:3])
        ctx.close()
    # turned: opened wide, then the phone turned upright -- the pages fitted again
    ctx = br.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.goto(srv.url("index.html#pdf"))
    try:
        pg.wait_for_selector("input[type=file][accept='application/pdf,.pdf']", state="attached", timeout=60000)
        pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", os.path.join(FX, "r_invoice.pdf"))
        pg.wait_for_function("() => Lantern.pdfView && Lantern.pdfView.api && Lantern.pdfView.api.pdf", timeout=60000); pg.wait_for_timeout(1200)
        pg.set_viewport_size({"width": 390, "height": 844}); pg.wait_for_timeout(1500)
        m = pg.evaluate("() => { var el = Lantern.pdfView.api.pageEl(0).getBoundingClientRect(); return {sw: document.documentElement.scrollWidth, iw: innerWidth, page: [Math.round(el.left), Math.round(el.width)]}; }")
        C(G, "r_invoice.pdf", "opened at 844 wide, the phone turned upright (390): no sideways scroll and the page refitted", m["sw"] <= m["iw"] + 1 and m["page"][0] + m["page"][1] <= 391, "fits 390", m)
    except Exception as e:
        C(G, "r_invoice.pdf", "turn test ran", False, "", str(e)[:300])
    ctx.close(); br.close()

# =====================================================================================================================
# 11. The tile clicked through as a person would: Fill in a radio group; Redact (Mark them all, Apply, Save)
# =====================================================================================================================
if on("tile"):
    G = "tile"
    import common
    from playwright.sync_api import sync_playwright
    if common._PW[0] is None: common._PW[0] = sync_playwright().start()
    srv = Server(NEW, [FX, OUT]); br = common._PW[0].chromium.launch()
    ctx = br.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(srv.url("index.html#pdf"))
    pg.wait_for_selector("input[type=file][accept='application/pdf,.pdf']", state="attached", timeout=60000)
    def stat(): return pg.evaluate("Array.prototype.map.call(document.querySelectorAll('[aria-live=polite], .muted'), function (e) { return e.textContent; }).join(' | ')")
    def open_pdf(path):
        pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", path)
        pg.wait_for_function("(n) => Lantern.pdfView && Lantern.pdfView.api && Lantern.pdfView.api.pdf && Lantern.pdfView.api.name === n", arg=os.path.basename(path), timeout=60000)
        pg.wait_for_timeout(800)
    def tool(label): pg.click(".pv-bar button:text-is('%s')" % label); pg.wait_for_timeout(500)
    def save_as(name):
        with pg.expect_download() as dl: pg.click(".pv-bar button:text-is('Save')")
        f = os.path.join(OUT, name); dl.value.save_as(f); return f
    # Fill in: tick Night in the shift group (Day was on), Apply, Save
    try:
        open_pdf(os.path.join(FX, "r_form.pdf")); tool("Fill in")
        boxes = pg.locator("input[title='shift']")
        n = boxes.count()
        boxes.nth(1).check(); pg.wait_for_timeout(200)
        pg.click("button.primary:text-is('Apply')"); pg.wait_for_timeout(1500)
        o = save_as("tile_fill_radio.pdf"); f1 = fields_pikepdf(o)
        C(G, "r_form.pdf", "Fill in (tile): the shift group shows %d boxes; ticking Night and Apply turns Night on, Day off" % n, f1["shift"]["AS"] == ["/Off", "/Night", "/Off"] and f1["shift"]["V"] == "/Night", "/Night [Off Night Off]", f1["shift"])
    except Exception as e:
        C(G, "r_form.pdf", "Fill in (tile) ran", False, "ran", str(e)[:300])
    def tile_redact(f, word, name, expect_found=True):
        try:
            open_pdf(os.path.join(FX, f)); tool("Redact")
            pg.fill("input[aria-label='Words to take out']", word); pg.click("button:text-is('Mark them all')"); pg.wait_for_timeout(1500)
            msg = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('span.muted'), function (e) { return e.textContent; }).join(' | ')")
            nm = pg.evaluate("document.querySelectorAll('[title^=\"Marked to take out\"]').length")
            if not nm:
                C(G, f, "Redact (tile): Mark them all finds '%s' (poppler shows it %d times)" % (word, len(locate(words(os.path.join(FX, f), 1)[0], word))), not expect_found, "found", msg[:200]); return None
            pg.click("button.primary:text-is('Apply')"); pg.wait_for_timeout(4000)
            o = save_as(name)
            return o
        except Exception as e:
            C(G, f, "Redact (tile) of '%s' ran" % word, False, "ran", str(e)[:300]); return None
    for f, word, name in [("x_nonlatin.pdf", "ΟΔΟΣ", "tile_redact_odos.pdf"), ("h_orphan_links.pdf", "123-45-6789", "tile_redact_orphan.pdf"), ("c_workorder.pdf", "MERIWEATHER", "tile_redact_meri.pdf"), ("r_titleblock.pdf", "NIGHTJAR", "tile_redact_nightjar.pdf")]:
        o = tile_redact(f, word, name)
        if not o: continue
        src = os.path.join(FX, f)
        for bx in locate(words(src, 1)[0], word):
            a = render(src, os.path.join(OUT, name[:-4] + "_o"), 1, 100); b = render(o, os.path.join(OUT, name[:-4] + "_c"), 1, 100)
            sh_, ink = ink_cover(a, b, bx, 100)
            C(G, f, "Redact (tile): where poppler shows '%s' (%s) is black in the saved copy" % (word, [round(v) for v in bx]), sh_ is not None and sh_ > 0.97, ">0.97", "%s of %d pixels" % (sh_ and round(sh_, 3), ink))
    C(G, "-", "no page errors in the tile", not errs, "none", errs[:3])
    ctx.close(); br.close()

# =====================================================================================================================
# 12. Reading order against 1.24.39: a run drawn slanted (a synthetic italic) or raised stays in its line
# =====================================================================================================================
if on("text"):
    G = "text"
    for f, phrase in [("c_workorder.pdf", "Pump runs really fast after Corrigan"), ("h_textops.pdf", "Level then Oblique Penhaligon end"), ("h_textops.pdf", "Below Raised Lockridge after"),
                      ("r_invoice.pdf", "Floor area 25 m2 at Bellweather site"), ("c_workorder.pdf", "CONFIDENTIAL MERIWEATHER"), ("r_symbol.pdf", "Ω = 4.7 κ"), ("r_symbol.pdf", "✔✓■"), ("r_invoice.pdf", "74115 • Tel.")]:
        pp = " ".join(subprocess.run(["pdftotext", F(f), "-"], capture_output=True, text=True, timeout=120).stdout.split())
        got = {}
        for which in ("old", "new"):
            r = browser(which).js("var pdf = await __open(a.f); return (await P.pageText(pdf, 0)).text;", {"f": f})
            got[which] = " ".join(r.split())
        line = [l for l in got["new"].split("  ")][:1]
        C(G, f, "this build reads '%s' as one line, as poppler%s does (1.24.39: %s)" % (phrase, "" if phrase in pp else " does NOT", "yes" if phrase in got["old"] else "no"), phrase in got["new"], phrase, [x for x in re.split(r"(?<=[.:])\s", got["new"]) if phrase.split()[0] in x or phrase.split()[-1] in x][:3])

# =====================================================================================================================
# 10. Time: LibreOffice's long document drawn whole, old and new
# =====================================================================================================================
if on("perf"):
    for f in ["lo_long.pdf", "q_lo_long_objstm.pdf"]:
        t = {}
        for which in ("old", "new"):
            r = browser(which).js("var t0 = Date.now(), pdf = await __open(a.f), t1 = Date.now(); for (var i = 0; i < pdf.count; i++) await P.pageDraw(pdf, i, {scale: 1, maxSide: 2000}); return {open: t1 - t0, draw: Date.now() - t1, n: pdf.count};", {"f": f}, timeout=600000)
            t[which] = r
        C("perf", f, "drawing all %d pages takes no longer than in 1.24.39 (+20%%)" % t["new"]["n"], t["new"]["draw"] <= 1.2 * t["old"]["draw"] + 200, "<= %d ms" % (1.2 * t["old"]["draw"] + 200), t)

for b in _B.values():
    C("harness", "-", "no page errors in the %s build" % ("new" if b is _B.get("new") else "old"), not b.errs, "none", b.errs[:5])
    b.close()
C.save()
fails = [r for r in C.rows if not r["pass"]]
print("%d checks, %d failed -> %s" % (len(C.rows), len(fails), CJ))
