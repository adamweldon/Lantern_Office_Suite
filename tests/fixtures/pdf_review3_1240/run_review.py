# run_review.py -- review 3 of 1.24.40's PDF tools (the second round of mends), tried with PDFs made here
# (make_fixtures.py) and read back by programs that are not Lantern: poppler, qpdf, pypdf, pdfminer, pikepdf, tesseract.
# Usage: python3 run_review.py [new.html] [old.html] [group ...]
#   groups: read redact area form tile misc sweep redsweep   (all when none given)
# Every check goes to cases.json here (cases_<groups>.json for a run of some groups; merge.py joins them) and to a .log.
import os, sys, json, re, time, glob, base64, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from r3lib import *
args = [a for a in sys.argv[1:] if a.endswith(".html")]
NEW = args[0] if args else os.path.join(SCR, "lantern_1240_r3.html")
OLD = args[1] if len(args) > 1 else os.path.join(SCR, "r3work", "old_12439.html")
GROUPS = set(a for a in sys.argv[1:] if not a.endswith(".html"))
def on(g): return not GROUPS or g in GROUPS
CJ = os.path.join(HERE, os.environ.get("CJNAME") or ("cases.json" if not GROUPS else "cases_%s.json" % "_".join(sorted(GROUPS))))
C = Cases(CJ)
FX = HERE
FXROOT = os.path.join(ROOT, "tests", "fixtures")
EV = os.path.join(HERE, "evidence")
os.makedirs(EV, exist_ok=True)
def F(f): return f if os.path.isabs(f) else os.path.join(FX, f)
_B = {}
def browser(which):
    if which not in _B: _B[which] = Browser(NEW if which == "new" else OLD, [FX, OUT, "/"])
    return _B[which]
def close_browsers():
    for k in list(_B): _B[k].close(); del _B[k]

def oracle_src(src, name):
    """what a viewer shows: form values and comments drawn into the page by qpdf, so poppler reads them as page text"""
    o = os.path.join(OUT, name + "_oracle.pdf")
    run(["qpdf", "--generate-appearances", "--flatten-annotations=all", src, o])
    return o if os.path.exists(o) and npages(o) == npages(src) else src

def ink_box(png, box, dpi, thr=180):
    """the tight box (pixels) round the original's ink inside a shown box (points)"""
    im = png_gray(png); s = dpi / 72.0
    x0, y0, x1, y1 = [int(round(v * s)) for v in box]
    x0 = max(0, x0); y0 = max(0, y0); x1 = min(im.width, x1); y1 = min(im.height, y1)
    if x1 <= x0 or y1 <= y0: return None
    px = im.load(); xs = []; ys = []
    for yy in range(y0, y1):
        for xx in range(x0, x1):
            if px[xx, yy] < thr: xs.append(xx); ys.append(yy)
    if not xs: return None
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)

def black_share(png, pbox, thr=70):
    im = png_gray(png); px = im.load(); n = k = 0
    x0, y0, x1, y1 = pbox
    for yy in range(y0, min(y1, im.height)):
        for xx in range(x0, min(x1, im.width)):
            n += 1
            if px[xx, yy] < thr: k += 1
    return k / n if n else None

def to_shown(info, r):
    return user_to_shown_rect(info["crop"], info["rot"], r)

def inter(a, b):
    return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))

def ocr_lang(t):
    if re.search("[Ѐ-ӿ]", t): return "rus"
    if re.search("[Ͱ-Ͽ]", t): return None
    if re.search("[ĞğİıŞş]", t): return "tur"
    return "eng"

RJS = r"""
var pdf = await __open(a.f), areas = [], miss = [], groups = {}, t0 = Date.now();
var src = null, by_ = null;
if (a.fill) { by_ = await P.fillForm(pdf, a.fill); pdf = await P.open(by_); }
if (a.stamps) for (var s = 0; s < a.stamps; s++) { by_ = P.stamp(pdf, {items: [{text: 'RECEIVED ' + (s + 1) + ' Ingleborough', where: 'top-right', size: 8, margin: 20 + 7 * s}]}); pdf = await P.open(by_); }
if (by_) src = __b64(by_);
for (var k = 0; k < (a.find || []).length; k++) {
  var m = await __marks(pdf, a.find[k], a.pages); if (!m.length) miss.push(a.find[k]); areas = areas.concat(m);
  groups[a.find[k]] = (await __marks(pdf, a.find[k], a.pages, true)).length; }
(a.rects || []).forEach(function (r) { areas.push(r); });
if (!areas.length) return {areas: [], miss: miss, groups: groups, err: 'nothing marked'};
try { var out = await P.redact(pdf, {areas: areas, words: a.noWords ? [] : (a.find || [])}); return {b64: __b64(out), areas: areas, miss: miss, groups: groups, src: src, ms: Date.now() - t0}; }
catch (e) { return {areas: areas, miss: miss, groups: groups, err: String(e && e.stack || e)}; }
"""

SLANTED = {"Goathland", "Ravensworth"}
def redact_case(name, f, targets, expect=None, mode="find", fill=None, stamps=0, pages=None, do_ocr=True, keep=True, notes=None, extra_keep_ok=()):
    """redact targets in f (found by redactMarks, or dragged over where poppler shows them), and check the copy against
    poppler, pypdf, pdfminer, the file's bytes, the picture and tesseract. expect: {target: places a person sees}"""
    G = "redact" if mode == "find" else "area"
    if os.environ.get("CASES") and name not in os.environ["CASES"].split(","): return
    B = browser("new"); src = F(f)
    t0 = time.time()
    arg = {"f": src, "fill": fill, "stamps": stamps, "pages": pages}
    if mode == "find": arg["find"] = targets
    else:
        rects = []; osrc = oracle_src(src, name)
        for i in range(npages(src)):
            info = page_info(src, i)
            for t in targets:
                for occ in locate(osrc, i + 1, t):
                    for bx in occ: rects.append({"page": i, "rect": shown_to_user_rect(info["crop"], info["rot"], (bx[0] - 1.5, bx[1] - 1.5, bx[2] + 1.5, bx[3] + 1.5))})
        arg["rects"] = rects; arg["noWords"] = True
    r = B.js(RJS, arg)
    if r.get("src"): src = save_b64(r["src"], os.path.join(OUT, name + "_src.pdf"))
    if r.get("err"):
        C(G, f, "%s: redact ran and marked something (%s)" % (name, ", ".join(targets)), False, "a redacted copy", r["err"][:500] + " miss=%s" % r.get("miss")); return None
    cp = save_b64(r["b64"], os.path.join(OUT, name + ".pdf"))
    osrc = oracle_src(src, name)
    n0, n1 = npages(src), npages(cp)
    C(G, f, "%s: the copy has the original's %d pages" % (name, n0), n0 == n1, n0, n1)
    ok, msg = qcheck(cp); C(G, f, "%s: qpdf --check finds the copy clean" % name, ok, "clean", msg)
    marks = {}
    for a_ in r["areas"]: marks.setdefault(a_["page"], []).append(a_["rect"])
    # the oracles over the whole copy
    if pages is None:
        pp_copy = ptext(cp); py_copy = pypdf_text(cp); pm_copy = pdfminer_text(cp); qb = qdf(cp)
    else:   # (only some pages redacted: the others keep their words; the copy's marked pages alone, as poppler reads them)
        pp_copy = "\n".join(ptext(cp, i + 1) for i in pages); py_copy = pm_copy = ""; qb = b""
    pp_orig = ptext(osrc)
    for t in targets:
        if squeeze(t) not in squeeze(pp_orig) and not any(locate(osrc, i + 1, t) for i in range(n0)): continue
        C(G, f, "%s: '%s' is not in poppler's text of the copy" % (name, t), squeeze(t) not in squeeze(pp_copy), "gone", [l for l in pp_copy.split("\n") if squeeze(t) in squeeze(l)][:3])
        C(G, f, "%s: '%s' is not in pypdf's text of the copy" % (name, t), squeeze(t) not in squeeze(py_copy), "gone", [l for l in py_copy.split("\n") if squeeze(t) in squeeze(l)][:3])
        C(G, f, "%s: '%s' is not in pdfminer's text of the copy" % (name, t), squeeze(t) not in squeeze(pm_copy), "gone", [l for l in pm_copy.split("\n") if squeeze(t) in squeeze(l)][:3])
        lk = leaks_in_bytes(qb, t)
        C(G, f, "%s: '%s' is not in the copy's bytes (qpdf --qdf, streams unpacked)" % (name, t), not lk, "gone", lk)
    allp = range(n0) if pages is None else pages
    for i in allp:
        info = page_info(src, i)
        dpi = 100 if max(info["crop"][2] - info["crop"][0], info["crop"][3] - info["crop"][1]) < 1000 else 72
        po = render(osrc, os.path.join(OUT, "%s_p%d_o" % (name, i)), i + 1, dpi)
        pc = render(cp, os.path.join(OUT, "%s_p%d_c" % (name, i)), i + 1, dpi)
        lines_o = layout_lines(osrc, i + 1)
        occs = {t: locate(osrc, i + 1, t, lines_o) for t in targets}
        # (slanted words: poppler cuts them into pieces; their letters from pdfplumber, and no size or neighbour checks there)
        slanted = set(t for t in targets if t in SLANTED and not occs[t] and info["rot"] == 0 and info["crop"] == info["media"] and locate_chars(osrc, i + 1, t))
        for t in slanted: occs[t] = locate_chars(osrc, i + 1, t)
        mk = [to_shown(info, m) for m in marks.get(i, [])]
        # 1. every place poppler shows a target is black in the copy's picture
        for t in targets:
            for occ in occs[t]:
                for bx in occ:
                    ib = ink_box(po, bx, dpi)
                    if not ib: continue
                    sh_ = black_share(pc, ib)
                    ok = sh_ is not None and sh_ >= 0.97
                    C(G, f, "%s: p%d '%s' at %s (poppler) is black in the copy's picture" % (name, i + 1, t, [round(v) for v in bx]), ok, ">= 0.97 of its letters' box black", round(sh_ or 0, 3))
                    if not ok:
                        try:
                            from PIL import Image
                            im = Image.open(pc).convert("RGB"); s = dpi / 72.0
                            pad = 30; crop = im.crop((max(0, int(bx[0] * s) - pad), max(0, int(bx[1] * s) - pad), min(im.width, int(bx[2] * s) + pad), min(im.height, int(bx[3] * s) + pad)))
                            crop.save(os.path.join(EV, "%s_p%d_%s.png" % (name, i + 1, re.sub(r"\W+", "_", t)[:20])))
                        except Exception: pass
            # the places Lantern found against the places a person sees
            want_n = (expect or {}).get(t)
        # 2. marks: none far from a target; none grossly bigger than its word
        tb = [(t, bx) for t in targets for occ in occs[t] for bx in occ]
        sl_boxes = [bx for t in slanted for occ in occs[t] for bx in occ]
        for m in mk:
            if any(inter(m, (b[0] - 6, b[1] - 6, b[2] + 6, b[3] + 6)) > 0 for b in sl_boxes): continue
            near = [(t, bx) for (t, bx) in tb if inter(m, (bx[0] - 2, bx[1] - 2, bx[2] + 2, bx[3] + 2)) > 0]
            if not near:
                C(G, f, "%s: p%d the mark %s lies over a word looked for (poppler)" % (name, i + 1, [round(v, 1) for v in m]), False, "over a target", [w for ln in lines_o for w in ln if inter(m, w[1]) > 0][:6]); continue
            u = union([bx for _, bx in near]); h = u[3] - u[1]; wdt = u[2] - u[0]
            # (along the line and across it: no more than half a line height beyond the word's box)
            grow_ = 0.5 * min(h, wdt) if wdt < h else 0.5 * h
            ok = m[0] >= u[0] - grow_ - 1 and m[1] >= u[1] - grow_ - 1 and m[2] <= u[2] + grow_ + 1 and m[3] <= u[3] + grow_ + 1
            C(G, f, "%s: p%d the mark %s is not grossly bigger than '%s' %s" % (name, i + 1, [round(v, 1) for v in m], near[0][0], [round(v, 1) for v in u]), ok, "within %.1f pt of the word" % grow_, [round(v, 1) for v in m])
        # 3. words not looked for: none cut (more than 15% of its letters' box under a mark), every one still found in place
        if keep:
            lines_c = layout_lines(cp, i + 1)
            cw = [w for ln in lines_c for w in ln]
            cut = []; lost = []
            for ln in lines_o:
                for (wd, bx) in ln:
                    fw = squeeze(wd)
                    if any(inter(bx, (b[0] - 6, b[1] - 6, b[2] + 6, b[3] + 6)) > 0 for b in sl_boxes): continue
                    if not fw or any(squeeze(t) in fw or (len(fw) >= 3 and fw in squeeze(t)) for t in targets): continue
                    if any(inter(bx, ob) > 0.5 * (bx[2] - bx[0]) * (bx[3] - bx[1]) for t in targets for occ in occs[t] for ob in occ): continue
                    ib = ink_box(po, bx, dpi)
                    s = dpi / 72.0
                    under = 0
                    if ib:
                        ibp = (ib[0] / s, ib[1] / s, ib[2] / s, ib[3] / s); area = (ibp[2] - ibp[0]) * (ibp[3] - ibp[1]) or 1
                        under = sum(inter(ibp, m) for m in mk) / area
                    if under > 0.15: cut.append("%s (%d%%)" % (wd, round(100 * under))); continue
                    if under > 0.0: continue   # (grazed: a reader may or may not keep it)
                    got = "".join(squeeze(w2) for w2, b2 in sorted(cw, key=lambda z: z[1][0]) if (b2[0] + b2[2]) / 2 > bx[0] - 2 and (b2[0] + b2[2]) / 2 < bx[2] + 2 and (b2[1] + b2[3]) / 2 > bx[1] - 2 and (b2[1] + b2[3]) / 2 < bx[3] + 2)
                    if fw not in got and wd not in extra_keep_ok: lost.append(wd)
            C(G, f, "%s: p%d no word that is not looked for is cut by a mark (over 15%% of its letters)" % (name, i + 1), not cut, "none", cut[:12])
            C(G, f, "%s: p%d every word not marked is still found by poppler in its place in the copy (%d words)" % (name, i + 1, sum(len(l) for l in lines_o)), not lost, "none lost", lost[:20])
    # 4. counts: the places found against the places a person sees
    for t in targets:
        seen = sum(len(locate(osrc, i + 1, t)) for i in allp)
        if expect and t in expect: seen = expect[t]
        got = r["groups"].get(t) if mode == "find" else None
        if mode == "find":
            C(G, f, "%s: Lantern finds '%s' as often as it is on the pages (%d)" % (name, t, seen), got is not None and got >= seen, seen, got)
    # 5. OCR of the copy's pages (only where OCR reads the word in the original)
    if do_ocr:
        for i in allp:
            info = page_info(src, i); big = max(info["crop"][2] - info["crop"][0], info["crop"][3] - info["crop"][1]) > 1000
            dpi = 150 if big else 200
            ao = render(osrc, os.path.join(OUT, "%s_p%d_ocro" % (name, i)), i + 1, dpi); ac = render(cp, os.path.join(OUT, "%s_p%d_ocrc" % (name, i)), i + 1, dpi)
            for t in targets:
                lg = ocr_lang(t)
                if not lg or not locate(osrc, i + 1, t): continue
                to = ocr(ao, lg); tc = ocr(ac, lg)
                ho = ocr_has(to, t); hc = ocr_has(tc, t)
                if not ho: continue
                C(G, f, "%s: p%d tesseract (%s) does not read '%s' in the copy (it reads it in the original: %s)" % (name, i + 1, lg, t, ho), not hc, "not read", hc)
    C(G, f, "%s: redacted in %.0f s (Lantern %d ms)" % (name, time.time() - t0, r.get("ms") or 0), True, "", "")
    return cp, r

# =====================================================================================================================
if on("redact"):
    T1 = ["Ashcombe-Pryce", "Okonkwo", "555-0143", "Marchetti"]
    redact_case("inv", "r_invoice.pdf", T1)
    redact_case("inv_lin", "r_invoice_lin.pdf", ["Okonkwo", "Wolstenholme"], do_ocr=False)
    for rot in (0, 90, 180, 270):
        redact_case("inv_crop%d" % rot, "r_invoice_crop%d.pdf" % rot, ["Okonkwo", "Wolstenholme", "HG3"])
    redact_case("textops", "e_textops.pdf", ["Penhaligon", "Trevelyan", "Lockridge", "Hollinshead", "Wolstenholme", "Hargreaves", "Ashworth-Bramley",
                                             "Featherstonehaugh", "José", "Griffiths", "Fothergill", "Ravenscroft", "Quenby", "Hagworth", "Ashgrove"], pages=[0], extra_keep_ok=("\U0001F600\u20ac\u03a9", "\u00e9\U0001F4A1", "done", "\u2460"))
    redact_case("textops_p2", "e_textops.pdf", ["Aldbrough", "Ebberston", "Fylingdales", "Goathland", "Gosforth", "Hawkshead", "Ireby", "Keswick"], pages=[1])
    redact_case("drawing", "e_drawing.pdf", ["Okonkwo", "Villanueva-Prieto", "HX-4471-B", "Pendlebury", "Ravensworth", "Ackroyd", "Hathersage", "Fairbairn"])
    redact_case("drawing_rot90", "e_drawing_rot90.pdf", ["Okonkwo", "Villanueva-Prieto", "Pendlebury", "Hathersage", "Fairbairn"])
    redact_case("acro", "f_acro.pdf", ["Featherstonehaugh", "078051120", "9185550143", "Wharfedale", "Hollingworth"])
    redact_case("acro_qflat", "f_acro_qflat.pdf", ["078051120", "9185550143", "Featherstonehaugh"])
    redact_case("acro_lin", "f_acro_lin.pdf", ["078051120", "Featherstonehaugh"], do_ocr=False)
    redact_case("orphan", "f_orphan.pdf", ["078051120", "Featherstonehaugh", "Wharfedale"])
    redact_case("acro_filled", "f_acro.pdf", ["123456789", "Quarrington"], fill={"ssn": "123456789", "name": "Bartholomew Quarrington", "shift": "Night"})
    redact_case("manual2", "l_manual2.pdf", ["Winterbourne", "Featherstonehaugh", "Marchetti", "Ravenscroft"])
    redact_case("manual3", "l_manual3.pdf", ["Winterbourne", "Featherstonehaugh", "Marchetti", "Ravenscroft"])
    redact_case("manual2_t1", "l_manual2_t1.pdf", ["Winterbourne", "Featherstonehaugh", "Marchetti"])
    redact_case("intl", "x_intl.pdf", ["Παπαδόπουλος", "ΠΑΠΑΔΟΠΟΥΛΟΣ", "οδος", "Петровский", "ПЕТРОВСКИЙ", "Şahin", "Yıldız", "İzmir", "Işıl"])
    redact_case("lo_letter", "lo_letter.pdf", ["Featherstonehaugh", "Şahin", "ΠΑΠΑΔΟΠΟΥΛΟΣ", "Ashcombe-Pryce", "Wolstenholme"])
    redact_case("chrome", "c_styles.pdf", ["Wolstenholme", "Hargreaves", "Calderbank", "Meriweather", "Ainsworth", "Featherstonehaugh", "Winterbourne", "Marchetti",
                                          "Okonkwo", "Corrigan", "Şahin", "Hollingworth", "Quenby-Ashton", "Παπαδόπουλος"])
    redact_case("deep", "s_deep.pdf", ["Hawkshead", "Ireby", "Ambleside", "Penrith", "Keswick"])
    redact_case("scan", "t_scan.pdf", ["Okonkwo", "Ashcombe-Pryce", "555-0143"])
    redact_case("stamped10", "r_invoice.pdf", ["Okonkwo", "Ingleborough"], stamps=10, pages=[0])

if on("area"):
    redact_case("area_crop270", "r_invoice_crop270.pdf", ["Okonkwo", "Ashcombe-Pryce"], mode="area")
    redact_case("area_drawing_rot90", "e_drawing_rot90.pdf", ["Okonkwo", "Pendlebury"], mode="area")
    redact_case("area_acro", "f_acro.pdf", ["078051120", "Featherstonehaugh"], mode="area")
    redact_case("area_textops", "e_textops.pdf", ["Aldbrough", "Fylingdales", "Ebberston"], mode="area", pages=[1])

# =====================================================================================================================
# read: PDF_TEXT's new rules on the lines made for them, this build against 1.24.39 and poppler
# =====================================================================================================================
TJS = "var pdf = await __open(a.f), o = []; for (var i = 0; i < pdf.count; i++) o.push((await P.pageText(pdf, i)).text); return o;"
def lt_text(which, f):
    return browser(which).js(TJS, {"f": F(f)})
def one_line(text, phrase):
    return any(phrase in " ".join(l.split()) for l in text.split("\n"))
def pp_has_line(f, phrase, page=None):
    t = ptext(F(f), page)
    return any(phrase in " ".join(l.split()) for l in t.split("\n"))
if on("read"):
    G = "read"
    cache = {}
    def T(which, f):
        if (which, f) not in cache: cache[(which, f)] = "\n".join(lt_text(which, f))
        return cache[(which, f)]
    # phrases this round set out to read as one line, in the words a person sees
    want = [("e_textops.pdf", "Level start Penhaligon ends here.", "a skewed (Tm 1 0 0.25 1) run stays in its line"),
            ("e_textops.pdf", "Strong slant Trevelyan backslant done.", "slants of 0.5 and -0.3 stay in their line"),
            ("e_textops.pdf", "Below Lockridge after, Hollinshead last.", "a word raised (Ts 6) and one lowered (Ts -3) stay in their line"),
            ("e_textops.pdf", "CONFIDENTIAL MEMO", "letters one a Tj at 0.12 em read as words"),
            ("e_textops.pdf", "PRIVATE FILE WOLSTENHOLME", "letters one a Tj at 0.25 em read as words"),
            ("e_textops.pdf", "INTERNAL ONLY", "letters one a Tj at 0.45 em read as words"),
            ("e_textops.pdf", "SECRET HARGREAVES", "letters one a Tj at 0.65 em read as words"),
            ("e_textops.pdf", "Tulsa • Tel • 918 • 555 • 0199 • x • end", "WinAnsi 127 129 141 143 144 157 read as bullets"),
            ("e_textops.pdf", "Glyphs: \U0001F600€ΩΩé\U0001F4A1 done", "glyph names u1F600 uni20AC u2126 Omega uni00E9 u1F4A1"),
            ("e_textops.pdf", "R1 = 4.7 kΩ ±5%, α = 30°, ∆p ≤ 2 bar, µ = 0.15, d ≥ 12 Hagworth", "Symbol with no /Encoding: Adobe's Symbol letters"),
            ("e_textops.pdf", "✔ pressure tested ✓ leak free ✘ flushed ■ tagged ❑ signed", "ZapfDingbats with no /Encoding: ticks, cross, boxes"),
            ("e_textops.pdf", "Scaled Fothergill and Ravenscroft end", "Tz 150 and Tc 3 words in their line"),
            ("c_styles.pdf", "PRIVATE CALDERBANK (0.2em)", "Chromium letter-spacing 0.2 em"),
            ("c_styles.pdf", "Engineer Wolstenholme signs (0.3em)", "Chromium letter-spacing 0.3 em on small letters"),
            ("c_styles.pdf", "SECRET HARGREAVES (0.5em)", "Chromium letter-spacing 0.5 em"),
            ("c_styles.pdf", "The pump runs really fast after Corrigan fitted the seal", "a made-up italic (font with no italic face) stays in its line"),
            ("e_drawing.pdf", "NOT FOR CONSTRUCTION", "a slanted (Tm 1 0 0.3 1) title reads as one line"),
            ("e_drawing.pdf", "1. Heater R1 = 4.7 kΩ ± 5 %, rated 2 W at 40 °C.", "Symbol units in a note"),
            ("e_drawing.pdf", "✔ Hydrotest 16 bar, witnessed Fairbairn", "ZapfDingbats tick in a checklist"),
            ("s_deep.pdf", "Stamp 3: Coniston approved", "a word in a form 8 deep (qpdf --underlay wraps stamp and page each time)"),
            ("s_deep.pdf", "Stamp 2: Bowness approved", "a word in a form 9 deep (qpdf --underlay wraps stamp and page each time)"),
            ("s_deep.pdf", "Stamp 1: Ambleside approved", "a word in a form 10 deep (ten stamps)"),
            ("s_deep.pdf", "Base page: Lindale Penrith Ulverston", "the page's own words after ten stamps (10 deep)"),
            ("e_textops.pdf", "Depth 9 Ireby", "a word in a form 9 deep"),
            ]
    for f, ph, what in want:
        n, o = one_line(T("new", f), ph), one_line(T("old", f), ph)
        C(G, f, "%s: '%s' (poppler: %s; 1.24.39: %s)" % (what, ph, "same" if pp_has_line(f, ph) else "differs", "same" if o else "differs"), n, ph,
          [l for l in T("new", f).split("\n") if any(w in l for w in ph.split()[:2])][:3])
    # what poppler and 1.24.39 read as separate words, this build should not join: single letters and digits in narrow
    # table cells, TeX-like math
    for f, ph, what in [("e_textops.pdf", "1 2 3 4 5 6 7 8 9 0", "a keypad row: ten digits each in its own 9 pt cell"),
                        ("e_textops.pdf", "A B C", "connector pins: letters each in its own 9.5 pt cell"),
                        ("e_textops.pdf", "a + b = c", "single symbols set apart by a thick space, as TeX sets a + b = c"),
                        ("l_manual2.pdf", "a + b = c", "pdflatex's inline $a + b = c$"),
                        ("l_manual2.pdf", "Q = 25", "pdflatex's inline $Q = 25$")]:
        n, o, p_ = one_line(T("new", f), ph), one_line(T("old", f), ph), pp_has_line(f, ph)
        C(G, f, "%s: read as '%s' as poppler%s and 1.24.39%s read it" % (what, ph, "" if p_ else " (NOT)", "" if o else " (NOT)"), n or not (p_ or o), ph,
          [l for l in T("new", f).split("\n") if re.search(r"Keys|Pins|holds|motor current|follows|delivers", l)][:4])
    # words, page by page, against poppler's: this build no further from poppler than 1.24.39
    for f in ["e_textops.pdf", "e_drawing.pdf", "e_drawing_rot90.pdf", "r_invoice.pdf", "r_invoice_crop90.pdf", "r_invoice_crop270.pdf", "c_styles.pdf", "l_manual2.pdf", "l_manual3.pdf",
              "l_manual2_t1.pdf", "x_intl.pdf", "lo_letter.pdf", "s_deep.pdf", "t_scan.pdf", "f_acro.pdf"]:
        for i, (tn, to) in enumerate(zip(lt_text("new", f), lt_text("old", f))):
            pw_ = [norm(x) for x in ptext(F(f), i + 1).split()]
            def f1(a, b):
                from collections import Counter
                ca, cb = Counter(a), Counter(b); k = sum((ca & cb).values()); return 2 * k / (len(a) + len(b)) if a or b else 1
            sn, so = f1([norm(x) for x in tn.split()], pw_), f1([norm(x) for x in to.split()], pw_)
            C(G, f, "p%d: words as near poppler's as 1.24.39's were (F1 new %.3f, old %.3f)" % (i + 1, sn, so), sn >= so - 0.01, ">= %.3f" % (so - 0.01), round(sn, 3))
    # parts carry y and size (a field's value, a typed comment)
    r = browser("new").js("""var pdf = await __open(a.f); var t = await P.pageText(pdf, 0);
       var ps = []; t.boxes.forEach(function (b) { b.parts.forEach(function (p) { if (/Featherstonehaugh|078051120|Wharfedale/.test(p.text)) ps.push({text: p.text, x: p.x, x1: p.x1, y: p.y, size: p.size}); }); }); return ps;""", {"f": F("f_acro.pdf")})
    for p_ in r:
        C(G, "f_acro.pdf", "a field's value '%s' in boxes carries y (%s) and size (%s)" % (p_["text"], p_.get("y"), p_.get("size")), p_.get("y") and p_["y"] > 400 and p_.get("size"), "y in the field, size > 0", p_)

# =====================================================================================================================
# form: P.fields lists a radio group's choices; fillForm by state name, by /Opt value, by UTF-8 name; Fill in's values
# =====================================================================================================================
def pk_fields(path):
    import pikepdf
    out = {}
    with pikepdf.open(path) as d:
        for f in d.Root.AcroForm.Fields if "/AcroForm" in d.Root else []:
            nm = str(f.get("/T")); kids = f.get("/Kids")
            v = f.get("/V")
            out[nm] = {"V": (bytes(v.unparse()).decode("latin-1") if v is not None else None),
                       "AS": [bytes(k.get("/AS").unparse()).decode("latin-1") if k.get("/AS") is not None else None for k in kids] if kids else ([bytes(f.get("/AS").unparse()).decode("latin-1")] if f.get("/AS") is not None else [])}
    return out
if on("form"):
    G = "form"
    B = browser("new")
    fl = B.js("var pdf = await __open(a.f); return await P.fields(pdf);", {"f": F("f_acro.pdf")})
    byn = {x["name"]: x for x in fl}
    for nm, opts, val in [("shift", ["Day", "Night", "Swing"], "Day"), ("size", ["Klein", "Mittel", "Große"], "Mittel"), ("colour", ["Grün", "Weiß", "Blau"], "Blau")]:
        g = byn.get(nm, {})
        C(G, "f_acro.pdf", "P.fields lists radio group '%s' with its choices %s" % (nm, opts), g.get("options") == opts, opts, g)
        C(G, "f_acro.pdf", "P.fields gives radio group '%s' its value '%s'" % (nm, val), g.get("value") == val, val, g.get("value"))
    C(G, "f_acro.pdf", "P.fields gives the ticked check box 'agree' a value, the unticked 'nightrate' Off", byn.get("agree", {}).get("value") not in (None, "", "Off") and byn.get("nightrate", {}).get("value") == "Off", "Yes / Off", [byn.get("agree"), byn.get("nightrate")])
    C(G, "f_acro.pdf", "P.fields gives the comb field its value", byn.get("ssn", {}).get("value") == "078051120", "078051120", byn.get("ssn"))
    FILLJS = "var pdf = await __open(a.f); return __b64(await P.fillForm(pdf, a.v));"
    cases = [("shift", "Night", "/Night", ["/Off", "/Night", "/Off"]), ("shift", "Swing", "/Swing", ["/Off", "/Off", "/Swing"]),
             ("size", "Große", "/2", ["/Off", "/Off", "/2"]), ("size", "Klein", "/0", ["/0", "/Off", "/Off"]), ("size", "2", "/2", ["/Off", "/Off", "/2"]),
             ("colour", "Grün", "/Gr#c3#bcn", ["/Gr#c3#bcn", "/Off", "/Off"]), ("colour", "Weiß", "/Wei#c3#9f", ["/Off", "/Wei#c3#9f", "/Off"]),
             ("shift", "Purple", "/Day", ["/Day", "/Off", "/Off"]), ("shift", "", "/Off", ["/Off", "/Off", "/Off"])]
    for nm, v, wantV, wantAS in cases:
        o = save_b64(B.js(FILLJS, {"f": F("f_acro.pdf"), "v": {nm: v}}), os.path.join(OUT, "fill_%s_%s.pdf" % (nm, re.sub(r"\W", "_", v) or "none")))
        got = pk_fields(o).get(nm, {})
        gv = (got.get("V") or "").lower(); ga = [(x or "").lower() for x in got.get("AS", [])]
        C(G, "f_acro.pdf", "fillForm({%s: '%s'}) sets /V %s and the buttons' /AS %s" % (nm, v, wantV, wantAS), gv == wantV.lower() and ga == [x.lower() for x in wantAS], [wantV, wantAS], got)
        ok, msg = qcheck(o); C(G, "f_acro.pdf", "fillForm({%s: '%s'}): qpdf --check clean" % (nm, v), ok, "clean", msg)
    # what other readers say of a filled group (pypdf) and what poppler draws: the dot in the chosen button
    o = save_b64(B.js(FILLJS, {"f": F("f_acro.pdf"), "v": {"shift": "Night", "size": "Große", "colour": "Grün", "agree": False, "nightrate": True, "ssn": "987654321", "name": "Νίκος Papadopoulos"}}), os.path.join(OUT, "fill_all.pdf"))
    code = "import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(json.dumps({k:str(v.get('/V')) for k,v in r.get_fields().items()}, ensure_ascii=False))"
    pv = json.loads(run([sys.executable, "-I", "-c", code, o]).stdout or "{}")
    C(G, "f_acro.pdf", "pypdf reads the filled values (shift /Night, size /2, nightrate /Yes, agree /Off, ssn 987654321)", pv.get("shift") == "/Night" and pv.get("size") == "/2" and pv.get("nightrate") == "/Yes" and pv.get("agree") == "/Off" and pv.get("ssn") == "987654321", "as filled", pv)
    png = render(o, os.path.join(OUT, "fill_all"), 1, 144)
    def dark(png, rect):
        im = png_gray(png); s = 2.0; x0, y0, x1, y1 = [int(v * s) for v in (rect[0], 792 - rect[3], rect[2], 792 - rect[1])]
        px = im.load(); n = sum(1 for yy in range(y0 + 4, y1 - 4) for xx in range(x0 + 4, x1 - 4) if px[xx, yy] < 100); return n
    dots = {nm: [dark(png, [200 + k * 110, y, 212 + k * 110, y + 12]) for k in range(3)] for nm, y in (("shift", 572), ("size", 548), ("colour", 524))}
    C(G, "f_acro.pdf", "poppler draws the dot in Night, Grosse and Gruen only (dark pixels per button)", dots["shift"][1] > 10 and dots["shift"][0] < 5 and dots["size"][2] > 10 and dots["size"][1] < 5 and dots["colour"][0] > 10 and dots["colour"][2] < 5, "dot only in the chosen", dots)
    pt = ptext(o)
    C(G, "f_acro.pdf", "a value with Greek letters typed in a field: poppler reads it as typed (/ActualText)", "Νίκος" in pt, "Νίκος Papadopoulos", [l for l in pt.split("\n") if "Papadop" in l][:2])
    # the filled comb: one digit a cell; read back by Lantern after flattening
    r = B.js("var pdf = await __open(a.f); var f = await P.open(await P.flatten(pdf, {forms: true, comments: true})); var t = await P.pageText(f, 0); return {text: t.text, n: P.redactMarks(t.boxes, '987654321').length};", {"f": o})
    C(G, "f_acro.pdf", "a filled comb (987654321, 20 pt cells at 12 pt) once flattened is found by Redact's search (poppler too reads it as nine separate digits: a limit, not a regression)", r["n"] > 0, ">= 1 place", [l for l in r["text"].split("\n") if "9" in l][:2])
    # the orphan page: P.fields and fillForm without /AcroForm
    fo = B.js("var pdf = await __open(a.f); return await P.fields(pdf);", {"f": F("f_orphan.pdf")})
    C(G, "f_orphan.pdf", "P.fields reads the widgets of a page with no /AcroForm (%d fields)" % len(fo), len(fo) >= 9, ">= 9", [x["name"] for x in fo])

# =====================================================================================================================
# tile: the PDF tile clicked through as a person would
# =====================================================================================================================
if on("tile"):
    G = "tile"
    br = None
    from playwright.sync_api import sync_playwright
    import r3lib
    if r3lib._PW[0] is None: r3lib._PW[0] = sync_playwright().start()
    srv = Server(NEW, [FX, OUT]); br = r3lib._PW[0].chromium.launch()
    ctx = br.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.on("dialog", lambda d: d.accept() if d.type != "prompt" else d.accept(""))
    pg.goto(srv.url("index.html#pdf"))
    pg.wait_for_selector("input[type=file][accept='application/pdf,.pdf']", state="attached", timeout=90000)
    def open_pdf(path):
        pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", path)
        pg.wait_for_function("(n) => Lantern.pdfView && Lantern.pdfView.api && Lantern.pdfView.api.pdf && Lantern.pdfView.api.name === n", arg=os.path.basename(path), timeout=90000)
        pg.wait_for_timeout(900)
    def tool(label): pg.click(".pv-bar button:text-is('%s')" % label); pg.wait_for_timeout(700)
    def save_as(name):
        with pg.expect_download() as dl: pg.click(".pv-bar button:text-is('Save')")
        p_ = os.path.join(OUT, name); dl.value.save_as(p_); return p_
    def status(): return pg.evaluate("Array.prototype.map.call(document.querySelectorAll('span.muted, [aria-live]'), function (e) { return e.textContent; }).join(' | ')")
    # Fill in: radios shown as radios; Night, Grosse, Gruen chosen
    try:
        open_pdf(F("f_acro.pdf")); tool("Fill in")
        kinds = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('.pv-over input[title=shift], .pv-over input[title=size], .pv-over input[title=colour]'), function (e) { return e.type; })")
        C(G, "f_acro.pdf", "Fill in shows the three radio groups' buttons as radio buttons (%d)" % len(kinds), len(kinds) == 9 and all(k == "radio" for k in kinds), "9 radios", kinds)
        pg.locator(".pv-over input[title=shift]").nth(1).check(); pg.locator(".pv-over input[title=size]").nth(2).check(); pg.locator(".pv-over input[title=colour]").nth(0).check()
        pg.wait_for_timeout(200); pg.locator("div:has(> b:text-is('Fill in')) button.primary:text-is('Apply')").first.click(); pg.wait_for_timeout(1800)
        o = save_as("tile_fill.pdf"); got = pk_fields(o)
        ok = got["shift"]["V"] == "/Night" and got["size"]["V"] == "/2" and got["colour"]["V"].lower() == "/gr#c3#bcn"
        C(G, "f_acro.pdf", "Fill in: choosing Night, Grosse and Gruen and Apply writes /Night, /2 and /Gr#C3#BCn", ok, "/Night /2 /Gr#C3#BCn", {k: got[k] for k in ("shift", "size", "colour")})
        # the same tool again on the filled copy: the chosen buttons show chosen
        tool("Fill in")
        ch = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('.pv-over input[type=radio]'), function (e) { return e.title + ':' + e.checked; })")
        C(G, "f_acro.pdf", "Fill in on the filled copy shows Night, Grosse and Gruen chosen", ch.count("shift:true") == 1 and ch[1] == "shift:true" and ch[5] == "size:true" and ch[6] == "colour:true", "those three", ch)
        pg.locator("div:has(> b:text-is('Fill in')) button:text-is('Done')").first.click(); pg.wait_for_timeout(300)
    except Exception as e:
        C(G, "f_acro.pdf", "Fill in (tile) ran", False, "ran", str(e)[:300])
    def tile_redact(f, word, name, expect_n):
        try:
            open_pdf(F(f)); tool("Redact")
            pg.fill("input[aria-label='Words to take out']", word); pg.click("button:text-is('Mark them all')"); pg.wait_for_timeout(2500)
            msg = status()
            nm = pg.evaluate("document.querySelectorAll('[title^=\"Marked to take out\"]').length")
            m = re.search(r"Marked (\d+) place", msg)
            k = int(m.group(1)) if m else 0
            C(G, f, "Redact (tile): Mark them all finds '%s' in %d places (a person sees %d)" % (word, k, expect_n), k >= expect_n, expect_n, msg[:200])
            if not nm: return None
            pg.locator("div:has(> b:text-is('Redact')) button.primary:text-is('Apply')").first.click(); pg.wait_for_timeout(5000)
            o_ = save_as(name)
            pg.evaluate("Array.prototype.forEach.call(document.querySelectorAll('div'), function (d) { var b = d.querySelector(':scope > b'); if (b && /^(Redact|Fill in)$/.test(b.textContent)) d.remove(); })")
            return o_
        except Exception as e:
            C(G, f, "Redact (tile) of '%s' ran" % word, False, "ran", str(e)[:300]); return None
    for f, word, name, n_ in [("f_acro.pdf", "078051120", "tile_acro_ssn.pdf", 1), ("f_orphan.pdf", "078051120", "tile_orphan_ssn.pdf", 1), ("f_acro.pdf", "9185550143", "tile_acro_phone.pdf", 1),
                              ("c_styles.pdf", "Featherstonehaugh", "tile_chrome_fsh.pdf", 4), ("c_styles.pdf", "Hargreaves", "tile_chrome_harg.pdf", 1),
                              ("x_intl.pdf", "Şahin", "tile_intl_sahin.pdf", 2), ("x_intl.pdf", "Παπαδόπουλος", "tile_intl_papa.pdf", 3),
                              ("l_manual3.pdf", "Winterbourne", "tile_m3_winter.pdf", 0), ("lo_letter.pdf", "Featherstonehaugh", "tile_lo_fsh.pdf", 0)]:
        if n_ == 0:
            n_ = sum(len(locate(F(f), i + 1, word)) for i in range(npages(F(f))))
        o = tile_redact(f, word, name, n_)
        if not o: continue
        src = oracle_src(F(f), name[:-4])
        for i in range(npages(src)):
            for occ in locate(src, i + 1, word):
                for bx in occ:
                    po = render(src, os.path.join(OUT, name[:-4] + "_o%d" % i), i + 1, 100); pc = render(o, os.path.join(OUT, name[:-4] + "_c%d" % i), i + 1, 100)
                    ib = ink_box(po, bx, 100); sh_ = black_share(pc, ib) if ib else None
                    C(G, f, "Redact (tile) '%s': p%d where poppler shows it (%s) is black in the saved copy" % (word, i + 1, [round(v) for v in bx]), sh_ is not None and sh_ >= 0.97, ">= 0.97", sh_)
        pt = ptext(o)
        C(G, f, "Redact (tile) '%s': poppler does not read it in the saved copy" % word, squeeze(word) not in squeeze(pt), "gone", [l for l in pt.split("\n") if squeeze(word)[:5] in squeeze(l)][:3])
    # a stamp (Comment tool's kind, through the API) with letters Helvetica has not: /ActualText, and the tool says so
    try:
        r = pg.evaluate("""async () => { var P = Lantern.pdf, api = Lantern.pdfView.api; var b = await P.addAnnots(api.pdf, [{page: 0, kind: 'stamp', rect: [300, 600, 560, 660], text: 'Привет kΩ ≤ 5 ok'}]);
            var s = ''; for (var j = 0; j < b.length; j += 8192) s += String.fromCharCode.apply(null, b.subarray(j, j + 8192)); return {b64: btoa(s), note: P.edit.unshownNote(['Привет kΩ ≤ 5 ok'])}; }""")
        o = save_b64(r["b64"], os.path.join(OUT, "stamp_actual.pdf")); o2 = os.path.join(OUT, "stamp_actual_flat.pdf")
        run(["qpdf", "--flatten-annotations=all", o, o2]); pt = ptext(o2)
        C(G, "lo_letter.pdf", "a stamp comment's words carry /ActualText: poppler reads the stamp as typed (uppercased)", "ПРИВЕТ" in pt and "Ω" in pt and "≤" in pt, "ПРИВЕТ KΩ ≤ 5 OK", [l for l in pt.split("\n") if "OK" in l.upper()][:2])
        C(G, "lo_letter.pdf", "the tools' note says which letters are drawn as '?'", "П" in r["note"] and "?" in r["note"], "names П... and says ?", r["note"])
    except Exception as e:
        C(G, "-", "stamp ActualText check ran", False, "ran", str(e)[:300])
    C(G, "-", "no page errors in the tile", not errs, "none", errs[:4])
    ctx.close()
    # a phone turned: refit; zoomed by the person: not refit
    for zoom_first in (False, True):
        ctx = br.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
        pg = ctx.new_page(); pg.on("dialog", lambda d: d.accept())
        pg.goto(srv.url("index.html#pdf"))
        try:
            pg.wait_for_selector("input[type=file][accept='application/pdf,.pdf']", state="attached", timeout=90000)
            pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", F("r_invoice.pdf"))
            pg.wait_for_function("() => Lantern.pdfView && Lantern.pdfView.api && Lantern.pdfView.api.pdf", timeout=90000); pg.wait_for_timeout(1500)
            z0 = pg.evaluate("() => Lantern.pdfView.api.zoom")
            if zoom_first: pg.click("button[aria-label='Zoom in']"); pg.wait_for_timeout(600)
            z1 = pg.evaluate("() => Lantern.pdfView.api.zoom")
            pg.set_viewport_size({"width": 390, "height": 844}); pg.wait_for_timeout(1800)
            m = pg.evaluate("() => { var el = Lantern.pdfView.api.pageEl(0).getBoundingClientRect(); return {sw: document.documentElement.scrollWidth, iw: innerWidth, page: [Math.round(el.left), Math.round(el.width)], zoom: Lantern.pdfView.api.zoom}; }")
            if not zoom_first:
                C(G, "r_invoice.pdf", "opened at 844 x 390, turned to 390 x 844: the page is refitted to the width", m["page"][0] >= -1 and m["page"][0] + m["page"][1] <= 391 and m["page"][1] > 250, "fits 390", m)
            else:
                C(G, "r_invoice.pdf", "zoomed in by the person (%.2f -> %.2f), then turned: the zoom is kept" % (z0, z1), abs(m["zoom"] - z1) < 0.01, z1, m)
            C(G, "r_invoice.pdf", "turned: no sideways scroll of the whole page", m["sw"] <= m["iw"] + 1, "<= %d" % m["iw"], m["sw"])
            # turned back
            if not zoom_first:
                pg.set_viewport_size({"width": 844, "height": 390}); pg.wait_for_timeout(1800)
                m2 = pg.evaluate("() => { var el = Lantern.pdfView.api.pageEl(0).getBoundingClientRect(); return {page: [Math.round(el.left), Math.round(el.width)], zoom: Lantern.pdfView.api.zoom}; }")
                C(G, "r_invoice.pdf", "turned back to 844 wide: the page is fitted to that width again (wider than at 390)", m2["page"][1] > m["page"][1] + 100, "> %d px" % (m["page"][1] + 100), m2)
        except Exception as e:
            C(G, "r_invoice.pdf", "turn test ran (zoom first: %s)" % zoom_first, False, "ran", str(e)[:300])
        ctx.close()
    br.close(); srv.srv.shutdown()

# =====================================================================================================================
# misc: Lantern's own stamp ten times; Symbol / ZapfDingbats drawn against poppler; the typed comment's words placed
# =====================================================================================================================
if on("misc"):
    G = "misc"
    B = browser("new")
    # drawing: the Symbol and ZapfDingbats lines of e_textops and the drawing's notes, against poppler, new and old
    DJS = "var pdf = await __open(a.f); var cv = await P.pageDraw(pdf, a.i, {scale: a.s, maxSide: 5000}); return __png(cv);"
    from PIL import Image, ImageChops, ImageStat
    for f, i, region, what in [("e_textops.pdf", 0, (60, 300, 560, 340), "the Symbol and ZapfDingbats lines"), ("e_drawing.pdf", 0, (190, 590, 760, 680), "the drawing's notes and checklist"),
                               ("e_textops.pdf", 1, (60, 380, 300, 540), "words in forms 1 to 10 deep")]:
        s = 2.0
        pp = render(F(f), os.path.join(OUT, "misc_%s_%d_pp" % (f[:-4], i)), i + 1, 144)
        res = {}
        for which in ("new", "old"):
            b64 = browser(which).js(DJS, {"f": F(f), "i": i, "s": s})
            p_ = save_b64(b64, os.path.join(OUT, "misc_%s_%d_%s.png" % (f[:-4], i, which)))
            a = Image.open(pp).convert("L"); b = Image.open(p_).convert("RGB")
            bg = Image.new("RGB", b.size, (255, 255, 255)); bg.paste(b, mask=Image.open(p_).split()[-1] if Image.open(p_).mode == "RGBA" else None); b = bg.convert("L")
            if b.size != a.size: b = b.resize(a.size)
            box = tuple(int(v * s) for v in region)
            # (region given from the top of the page as shown)
            d = ImageChops.difference(a.crop(box), b.crop(box)); res[which] = round(ImageStat.Stat(d).mean[0], 2)
            ink = sum(1 for v in b.crop(box).getdata() if v < 128); res[which + "_ink"] = ink
        res["poppler_ink"] = sum(1 for v in Image.open(pp).convert("L").crop(tuple(int(v * s) for v in region)).getdata() if v < 128)
        C(G, f, "p%d %s: drawn nearer poppler than 1.24.39 drew them (mean grey difference)" % (i + 1, what), res["new"] <= res["old"] + 0.3, "<= old + 0.3", res)
        C(G, f, "p%d %s: about as much ink as poppler draws (within 25%%)" % (i + 1, what), abs(res["new_ink"] - res["poppler_ink"]) <= 0.25 * res["poppler_ink"] + 50, res["poppler_ink"], res["new_ink"])
    # Lantern's own stamp applied ten times, then read: the page's words and each stamp
    r = B.js("""var pdf = await __open(a.f), by_; for (var s = 0; s < 10; s++) { by_ = P.stamp(pdf, {items: [{text: 'RECEIVED ' + (s + 1) + ' Ingleborough', where: 'top-right', size: 8, margin: 20 + 9 * s}]}); pdf = await P.open(by_); }
        var t = (await P.pageText(pdf, 0)).text; return {t: t, b64: __b64(by_)};""", {"f": F("r_invoice.pdf")})
    o = save_b64(r["b64"], os.path.join(OUT, "stamp10.pdf"))
    C(G, "r_invoice.pdf", "stamped ten times by Lantern: its words and all ten stamps are read (Lantern)", "Okonkwo" in r["t"] and all(("RECEIVED %d Ingleborough" % k) in r["t"] for k in range(1, 11)), "all", [l for l in r["t"].split("\n") if "RECEIVED" in l][:3])
    ok, msg = qcheck(o); C(G, "r_invoice.pdf", "stamped ten times: qpdf --check clean", ok, "clean", msg)
    pt = ptext(o, 1)
    C(G, "r_invoice.pdf", "stamped ten times: poppler reads all ten stamps (spaces and line breaks aside: poppler breaks a stamp's line where it meets the page's words)", all(squeeze("RECEIVED %d Ingleborough" % k) in squeeze(pt) for k in range(1, 11)), "all", [l for l in pt.split("\n") if "RECEIVED" in l][:3])
    # a typed comment's words placed by Helvetica's widths from its box's left edge
    r = B.js("""var pdf = await __open(a.f); var b = await P.addAnnots(pdf, [{page: 0, kind: 'text', rect: [300, 420, 560, 450], text: 'Checked by Hollingworth', size: 12}]);
        var p2 = await P.open(b); var t = await P.pageText(p2, 0); var out = null; t.boxes.forEach(function (bx) { bx.parts.forEach(function (p) { if (/Hollingworth/.test(p.text)) out = {x: p.x, x1: p.x1, y: p.y, size: p.size, text: p.text}; }); });
        return {part: out, marks: P.redactMarks(t.boxes, 'hollingworth'), b64: __b64(b)};""", {"f": F("r_invoice.pdf")})
    o = save_b64(r["b64"], os.path.join(OUT, "freetext.pdf")); o2 = os.path.join(OUT, "freetext_flat.pdf"); run(["qpdf", "--flatten-annotations=all", o, o2])
    ws, _ = bbox(o2, 1)
    hw = [w_ for w_ in ws if w_[0] == "Hollingworth"]
    if hw and r["marks"]:
        m = r["marks"][0]; x0, x1 = hw[0][1], hw[0][3]
        C(G, "r_invoice.pdf", "a typed comment's word is marked where its drawing puts it (poppler x %.1f-%.1f; mark %.1f-%.1f)" % (x0, x1, m[0], m[2]), m[0] <= x0 + 1 and m[2] >= x1 - 1 and m[2] - m[0] < (x1 - x0) * 1.3 + 4, "covers it, not much more", m)
        C(G, "r_invoice.pdf", "... and on its line (poppler y %.1f-%.1f from the top; mark %.1f-%.1f from the bottom)" % (hw[0][2], hw[0][4], m[1], m[3]), m[1] <= 792 - hw[0][4] + 1 and m[3] >= 792 - hw[0][2] - 1, "covers its height", m)
    else:
        C(G, "r_invoice.pdf", "a typed comment's word is found and drawn", False, "found", [r["marks"], hw])

# =====================================================================================================================
# sweep: every PDF under tests/fixtures, read and drawn by this build and by 1.24.39, each against poppler
# =====================================================================================================================
def all_fixture_pdfs():
    fs = sorted(glob.glob(os.path.join(FXROOT, "**", "*.pdf"), recursive=True))
    # (poppler loops for ever on review 2's ve_cycle.pdf, writing without end: the oracle cannot read it)
    return [f for f in fs if "/evidence/" not in f and not f.endswith("/ve_cycle.pdf")]
SWJS = r"""
function race(p, ms) { return Promise.race([p, new Promise(function (res) { setTimeout(function () { res('__timeout'); }, ms); })]); }
var pdf; try { pdf = await race(__open(a.f), 60000); } catch (e) { return {err: String(e).slice(0, 200)}; }
if (pdf === '__timeout') return {err: 'open timeout'};
var out = {n: pdf.count, pages: []};
for (var i = 0; i < Math.min(pdf.count, a.maxp); i++) {
  var pg = {};
  try { var t = await race(P.pageText(pdf, i), 60000); pg.lines = t === '__timeout' ? null : t.lines.map(function (l) { return l.text; }).filter(Boolean); } catch (e) { pg.terr = String(e).slice(0, 200); }
  if (a.draw) { try { var cv = await race(P.pageDraw(pdf, i, {scale: 1, maxSide: 2000}), 90000); pg.png = cv === '__timeout' ? null : __png(cv); } catch (e) { pg.derr = String(e).slice(0, 200); } }
  out.pages.push(pg);
}
return out;
"""
def toks(s): return [norm(x) for x in s.split()]
def bigrams(lines):
    out = []
    for l in lines:
        t = toks(l); out += list(zip(t, t[1:]))
    return out
def f1(a, b):
    from collections import Counter
    ca, cb = Counter(a), Counter(b); k = sum((ca & cb).values())
    return 2 * k / (len(a) + len(b)) if (a or b) else 1.0
if on("sweep"):
    G = "sweep"
    from PIL import Image, ImageChops, ImageStat
    files = all_fixture_pdfs()
    if os.environ.get("SWEEP_FROM"): files = files[int(os.environ["SWEEP_FROM"]):]
    summ = {"files": 0, "pages": 0, "text_worse": [], "text_better": 0, "draw_worse": [], "draw_better": 0, "open_err": []}
    for fi, f in enumerate(files):
        rel = os.path.relpath(f, FXROOT)
        res = {}
        for which in ("new", "old"):
            try: res[which] = browser(which).js(SWJS, {"f": f, "maxp": 4, "draw": True}, timeout=600000)
            except Exception as e:
                res[which] = {"err": str(e)[:200]}
                close_browsers()
        if res["new"].get("err") or res["old"].get("err"):
            if bool(res["new"].get("err")) != bool(res["old"].get("err")):
                C(G, rel, "opens in this build as in 1.24.39", not res["new"].get("err"), res["old"].get("err") or "opens", res["new"].get("err") or "opens")
            summ["open_err"].append(rel); continue
        summ["files"] += 1
        for i, (pn, po) in enumerate(zip(res["new"]["pages"], res["old"]["pages"])):
            summ["pages"] += 1
            pt = run(["pdftotext", "-enc", "UTF-8", "-f", str(i + 1), "-l", str(i + 1), f, "-"], timeout=60).stdout
            plines = [l for l in pt.split("\n") if l.strip()]
            if pn.get("lines") is not None and po.get("lines") is not None and plines:
                wn, wo = f1(toks(" ".join(pn["lines"])), toks(" ".join(plines))), f1(toks(" ".join(po["lines"])), toks(" ".join(plines)))
                bn, bo = f1(bigrams(pn["lines"]), bigrams(plines)), f1(bigrams(po["lines"]), bigrams(plines))
                worse = wn < wo - 0.01 or bn < bo - 0.03
                if worse:
                    sn, so = set(pn["lines"]), set(po["lines"])
                    C(G, rel, "p%d: words and word pairs as near poppler's as 1.24.39's (words %.3f vs %.3f, pairs %.3f vs %.3f)" % (i + 1, wn, wo, bn, bo), False, "no worse",
                      {"new_only": [l for l in pn["lines"] if l not in so][:6], "old_only": [l for l in po["lines"] if l not in sn][:6]})
                    summ["text_worse"].append((rel, i + 1, round(wn - wo, 3), round(bn - bo, 3)))
                else:
                    if wn > wo + 0.01 or bn > bo + 0.03: summ["text_better"] += 1
                    C(G, rel, "p%d: words and word pairs as near poppler's as 1.24.39's" % (i + 1), True, "", "")
            elif pn.get("terr") and not po.get("terr"):
                C(G, rel, "p%d: read without error" % (i + 1), False, "read", pn["terr"])
            if pn.get("png") and po.get("png"):
                pp = render(f, os.path.join(OUT, "sw"), i + 1, 72)
                if not os.path.exists(pp): continue
                try:
                    a_ = Image.open(pp).convert("L")
                    def im_(b64):
                        p_ = os.path.join(OUT, "sw_l.png"); save_b64(b64, p_); b = Image.open(p_).convert("RGBA")
                        bg = Image.new("RGBA", b.size, (255, 255, 255, 255)); bg.alpha_composite(b); return bg.convert("L")
                    n_, o_ = im_(pn["png"]), im_(po["png"])
                    if n_.size != a_.size: n_ = n_.resize(a_.size)
                    if o_.size != a_.size: o_ = o_.resize(a_.size)
                    dn = ImageStat.Stat(ImageChops.difference(a_, n_)).mean[0]; do = ImageStat.Stat(ImageChops.difference(a_, o_)).mean[0]
                    dno = ImageStat.Stat(ImageChops.difference(n_, o_)).mean[0]
                    worse = dn > do + 0.4
                    if worse:
                        summ["draw_worse"].append((rel, i + 1, round(do, 2), round(dn, 2)))
                        dd = os.path.join(EV, "sweep_%s_p%d" % (re.sub(r"\W+", "_", rel)[-60:], i + 1))
                        n_.save(dd + "_new.png"); o_.save(dd + "_old.png"); a_.save(dd + "_poppler.png")
                    elif dn < do - 0.4: summ["draw_better"] += 1
                    C(G, rel, "p%d: drawn as near poppler as 1.24.39 drew it (mean grey difference new %.2f, old %.2f; new vs old %.2f)" % (i + 1, dn, do, dno), not worse, "<= old + 0.4", round(dn, 2))
                except Exception as e:
                    C(G, rel, "p%d: drawing compared" % (i + 1), False, "compared", str(e)[:200])
        if fi % 25 == 0: print("== sweep", fi, len(files), flush=True); C.save()
    json.dump(summ, open(os.path.join(HERE, "sweep_summary.json"), "w"), indent=1)

# =====================================================================================================================
# redsweep: on page 1 of every PDF under tests/fixtures, two words poppler reads (6 letters or more, once on the page)
# found with Redact's search and taken out; the copy read by poppler and looked at
# =====================================================================================================================
RSJS = r"""
function race(p, ms) { return Promise.race([p, new Promise(function (res) { setTimeout(function () { res('__timeout'); }, ms); })]); }
var pdf; try { pdf = await race(__open(a.f), 60000); } catch (e) { return {err: String(e).slice(0, 200)}; }
if (pdf === '__timeout') return {err: 'open timeout'};
var t = await race(P.pageText(pdf, 0), 60000); if (t === '__timeout') return {err: 'text timeout'};
var areas = [], found = {};
a.words.forEach(function (w) { var m = P.redactMarks(t.boxes, w); found[w] = m.length; m.forEach(function (r) { areas.push({page: 0, rect: r}); }); });
if (!areas.length) return {found: found, none: true};
try { var o = await race(P.redact(pdf, {areas: areas, words: a.words.filter(function (w) { return found[w]; })}), 180000); if (o === '__timeout') return {err: 'redact timeout', found: found};
  return {found: found, areas: areas, b64: __b64(o)}; } catch (e) { return {err: String(e).slice(0, 300), found: found}; }
"""
if on("redsweep"):
    G = "redsweep"
    files = all_fixture_pdfs()
    if os.environ.get("SWEEP_FROM"): files = files[int(os.environ["SWEEP_FROM"]):]
    tot = {"files": 0, "words": 0, "found": 0, "leaks": [], "notfound": [], "lostwords": 0, "keptwords": 0}
    for fi, f in enumerate(files):
        rel = os.path.relpath(f, FXROOT)
        try:
            if npages(f) < 1: continue
            info = page_info(f, 0)
        except Exception: continue
        lines = layout_lines(f, 1)
        allw = [w for ln in lines for w in ln]
        txt = squeeze(ptext(f, 1))
        cands = []
        for ln_i, ln in enumerate(lines):
            for wd, bx in ln:
                core = wd.strip(".,;:()[]\"'!?")
                if len(core) >= 6 and core.isalpha() and txt.count(squeeze(core)) == 1 and bx[2] - bx[0] > 5:
                    cands.append((ln_i, core, bx))
        pick = []
        for c in cands:
            if not any(p[0] == c[0] for p in pick): pick.append(c)
            if len(pick) == 2: break
        if not pick: continue
        words = [p[1] for p in pick]
        try: r = browser("new").js(RSJS, {"f": f, "words": words}, timeout=400000)
        except Exception as e:
            close_browsers(); C(G, rel, "redact ran", False, "ran", str(e)[:200]); continue
        if r.get("err") and "timeout" not in r["err"] and not r.get("found"):
            continue   # (a file Lantern does not open: the sweep group reports those)
        tot["files"] += 1
        for w_ in words:
            tot["words"] += 1
            if r.get("found", {}).get(w_): tot["found"] += 1
            else: tot["notfound"].append((rel, w_))
            C(G, rel, "Redact's search finds '%s' (poppler reads it once on page 1)" % w_, bool(r.get("found", {}).get(w_)), ">= 1", r.get("found", {}).get(w_))
        if r.get("err"):
            C(G, rel, "redact of %s ran" % words, False, "a copy", r["err"]); continue
        if not r.get("b64"): continue
        cp = save_b64(r["b64"], os.path.join(OUT, "rs.pdf"))
        ok, msg = qcheck(cp); C(G, rel, "the copy is qpdf-clean", ok, "clean", msg)
        n0, n1 = npages(f), npages(cp)
        C(G, rel, "the copy keeps the %d pages" % n0, n0 == n1, n0, n1)
        pc_txt = squeeze(ptext(cp, 1))
        po = render(f, os.path.join(OUT, "rs_o"), 1, 72); pc = render(cp, os.path.join(OUT, "rs_c"), 1, 72)
        for ln_i, w_, bx in pick:
            if not r["found"].get(w_): continue
            C(G, rel, "'%s' is not in poppler's text of the copy's page 1" % w_, squeeze(w_) not in pc_txt, "gone", "still read")
            ib = ink_box(po, bx, 72); sh_ = black_share(pc, ib) if ib else None
            ok = sh_ is None or sh_ >= 0.95
            if not ok: tot["leaks"].append((rel, w_, round(sh_, 2)))
            C(G, rel, "'%s' at %s (poppler) is black in the copy's picture" % (w_, [round(v) for v in bx]), ok, ">= 0.95", sh_)
        # the page's other words: still read in place (counted)
        mk = [user_to_shown_rect(info["crop"], info["rot"], a_["rect"]) for a_ in r["areas"]]
        cw = all_words(cp, 1); lost = []
        for wd, bx in allw:
            fw = squeeze(wd)
            if not fw or any(squeeze(p[1]) in fw for p in pick): continue
            if any(inter((bx[0] - 1, bx[1] - 1, bx[2] + 1, bx[3] + 1), m) > 0 for m in mk): continue
            tot["keptwords"] += 1
            got = "".join(squeeze(w2) for w2, b2 in sorted(cw, key=lambda z: z[1][0]) if bx[0] - 2 < (b2[0] + b2[2]) / 2 < bx[2] + 2 and bx[1] - 2 < (b2[1] + b2[3]) / 2 < bx[3] + 2)
            if fw not in got: lost.append(wd)
        tot["lostwords"] += len(lost)
        nk = sum(1 for wd, bx in allw)
        C(G, rel, "words away from the marks still read in place by poppler (lost %d of %d)" % (len(lost), nk), len(lost) <= max(1, 0.02 * nk), "<= 2%", lost[:10])
        if fi % 25 == 0: print("== redsweep", fi, len(files), flush=True); C.save()
    json.dump(tot, open(os.path.join(HERE, "redsweep_summary.json"), "w"), indent=1, ensure_ascii=False)

# =====================================================================================================================
# fold: what a person types against what the page shows -- Redact's search (redactMarks, grouped) counted against the
# places a reader sees the same word (counted by hand from poppler's text of these fixtures)
# =====================================================================================================================
if on("fold"):
    G = "fold"
    B = browser("new")
    FJS = "var pdf = await __open(a.f), n = 0; for (var i = 0; i < pdf.count; i++) n += P.redactMarks((await P.pageText(pdf, i)).boxes, a.q, true).length; return n;"
    for f, q, n_, what in [
        ("x_intl.pdf", "Παπαδόπουλος", 3, "a Greek name typed with its accent finds it in capitals, which Greek writes without accents (ΠΑΠΑΔΟΠΟΥΛΟΣ, twice) and as written (once)"),
        ("x_intl.pdf", "παπαδοπουλος", 3, "the same typed in small letters with a final sigma and no accent"),
        ("x_intl.pdf", "οδος", 2, "οδος (final sigma typed) finds ΟΔΟΣ and οδός"),
        ("x_intl.pdf", "Şahin", 1, "Turkish: Şahin finds ŞAHİN (capitals, dotted İ)"),
        ("x_intl.pdf", "Yıldız", 2, "Turkish: Yıldız finds YILDIZ and Yıldız"),
        ("x_intl.pdf", "istanbul", 1, "Turkish: istanbul (typed on a keyboard without İ) finds İSTANBUL"),
        ("x_intl.pdf", "ışıl", 1, "Turkish: ışıl (small dotless ı) finds Işıl"),
        ("x_intl.pdf", "IĞDIR", 1, "Turkish: IĞDIR finds IĞDIR"),
        ("x_intl.pdf", "иванович", 1, "Cyrillic small letters find ИВАНОВИЧ in capitals"),
        ("x_intl.pdf", "μm", 2, "μm (mu) finds 12 µm (micro sign) and 12 μm"),
        ("x_intl.pdf", "Δp", 2, "Δp (delta) finds ∆p (increment) and Δp"),
        ("e_textops.pdf", "José", 1, "José (as typed, one letter é) finds José (e and a combining accent in the PDF's ToUnicode)"),
        ("e_textops.pdf", "Griffiths", 1, "Griffiths finds Griﬃths (the PDF maps its ligature to U+FB03)"),
        ("e_textops.pdf", "Clifford", 1, "Clifford finds Cliﬁord (U+FB01)"),
        ("e_textops.pdf", "Ashworth-Bramley", 1, "a double-barrelled name broken at its own hyphen (Ashworth- / Bramley) in one column"),
        ("e_textops.pdf", "Featherstonehaugh", 1, "a name broken by a hyphen (Feather- / stonehaugh) in one column"),
        ("c_styles.pdf", "Featherstonehaugh", 4, "Chromium breaks a name at a soft hyphen with U+2010 (Featherstone‐ / haugh)"),
        ("c_styles.pdf", "Winterbourne", 3, "... and Win‐ / terbourne"),
        ("c_styles.pdf", "Quenby-Ashton", 1, "a name on a turned (rotate(-90deg)) label broken at its own hyphen"),
        ("lo_letter.pdf", "Featherstonehaugh", 0, "LibreOffice breaks a name at a soft hyphen (counted from poppler's lines)"),
        ("l_manual2.pdf", "Winterbourne", 16, "two columns (pdflatex): the name, broken by TeX in either column"),
        ("l_manual3.pdf", "Winterbourne", 0, "three columns (multicol): the name, broken by TeX in any column"),
        ("l_manual3.pdf", "Featherstonehaugh", 0, "three columns: Featherstonehaugh"),
        ("c_styles.pdf", "Ainsworth", 1, "CSS letter-spacing 0.7 em (TOP AINSWORTH)"),
        ("c_styles.pdf", "Boothroyd", 1, "CSS letter-spacing 0.9 em (WIDE BOOTHROYD)"),
        ("f_acro_qflat.pdf", "078051120", 1, "a comb field flattened by another program (digits one a cell, 20 pt apart)"),
        ("s_deep.pdf", "Ambleside", 1, "a stamp 10 forms deep (qpdf --underlay ten times)"),
        ("s_deep.pdf", "Lindale", 1, "the page's own words after ten stamps")]:
        if n_ == 0: n_ = sum(len(locate(F(f), i + 1, q)) for i in range(npages(F(f))))
        got = B.js(FJS, {"f": F(f), "q": q})
        C(G, f, "%s: '%s' found in %d places (a reader sees %d)" % (what, q, got, n_), got >= n_, n_, got)

# links on a marked page and elsewhere
if on("misc"):
    G = "misc"
    r = browser("new").js(RJS, {"f": F("h_links.pdf"), "find": ["Okonkwo"]})
    if r.get("b64"):
        o = save_b64(r["b64"], os.path.join(OUT, "links.pdf"))
        import pikepdf
        with pikepdf.open(o) as d:
            p1 = [str(a.get("/A", {}).get("/URI", "")) + str(a.get("/A", {}).get("/D", "")) + str(a.get("/Contents", "")) for a in d.pages[0].obj.get("/Annots", [])]
            p2 = [str(a.get("/A", {}).get("/URI", "")) for a in d.pages[1].obj.get("/Annots", [])]
        C(G, "h_links.pdf", "page 1 (marked): the links whose address, destination or note names Okonkwo are gone", not any("konkwo" in x.lower() or "%4f" in x.lower() for x in p1), "none name him", p1)
        C(G, "h_links.pdf", "page 1 (marked): the link that names nobody is kept", any("hospital.example.org" in x for x in p1), "kept", p1)
        C(G, "h_links.pdf", "page 2 (nothing marked on it): a link whose address holds the word looked for is taken out too", not any("konkwo" in x.lower() for x in p2), "taken out (or the tool says it stays)", p2)
        qb = qdf(o).decode("latin-1").lower()
        C(G, "h_links.pdf", "the name is nowhere in the copy's bytes (links, destinations, outline)", "okonkwo" not in qb, "gone (Apply says bookmarks are not changed)", [m.start() for m in re.finditer("okonkwo", qb)][:5])
    else:
        C(G, "h_links.pdf", "redact ran", False, "ran", r.get("err"))
    # the extra fonts' ToUnicode: pypdf reads the Greek and Cyrillic words kept in the redacted copy
    cp = os.path.join(OUT, "intl.pdf")
    if os.path.exists(cp):
        t = pypdf_text(cp)
        C(G, "x_intl.pdf", "pypdf reads kept Greek and Cyrillic words in the redacted copy (spaces aside: pypdf ignores Tz, so it splits letters Lantern widens; \u0391\u03b8\u03ae\u03bd\u03b1, \u041d\u043e\u0432\u043e\u0441\u0438\u0431\u0438\u0440\u0441\u043a)", squeeze("\u0391\u03b8\u03ae\u03bd\u03b1") in squeeze(t) and squeeze("\u041d\u043e\u0432\u043e\u0441\u0438\u0431\u0438\u0440\u0441\u043a") in squeeze(t), "both", [l for l in t.split("\n") if "\u0391\u03b8" in l or "\u041d\u043e\u0432" in l][:3])

close_browsers()
C.save()
fails = [r for r in C.rows if not r["pass"]]
print("%d checks, %d failed -> %s" % (len(C.rows), len(fails), CJ))
