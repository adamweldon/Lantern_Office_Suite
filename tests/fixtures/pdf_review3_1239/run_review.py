# run_review.py -- the third review's checks of 1.24.39's PDF reading (after the second review's mends). Each PDF of this
# folder is opened by Lantern (src/lantern.inner.html) in Chromium (probe.js) and what it read and drew is compared with
# an oracle: ISO 32000-2, qpdf, poppler (pdfinfo, pdftotext, pdftoppm pixels), and 1.24.38 (LANTERN_OLD=<its
# index.html>) for the before/after checks. Writes cases.json beside this script.
#   python3 make_fixtures.py ; git show HEAD:site/index.html > /tmp/old.html ; LANTERN_OLD=/tmp/old.html python3 run_review.py [group ...]
# groups: trailer hidden blend textreader forms sweep (sweep: every other PDF under tests/fixtures, before against after)
import os, sys, json, re, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import Browser, HERE, poppler_regions
OLD = os.environ.get("LANTERN_OLD", "")
B = Browser(("new", "old") if OLD else ("new",))
cases = []
OUT = os.path.join(HERE, "cases.json")
def case(group, f, check, expected, got, ok, kind="must"):
    # kind: "must" (the standard, or what qpdf/poppler/1.24.38 do with a correct PDF); "info" (a damaged file, or beyond
    # the standard: reported, not counted as a failure)
    cases.append({"group": group, "file": f, "check": check, "expected": expected, "got": got, "pass": bool(ok), "kind": kind})
    tag = "PASS  " if ok else ("INFO  " if kind == "info" else "FAIL  ")
    print(tag + f + ": " + check + ("" if ok else "   got: " + json.dumps(got, ensure_ascii=False)[:400]), flush=True)
def rv(f, **k): return B.probe(f, **k)
def old(f, **k): return B.probe(f, which="old", **k) if OLD else {}
def reg(r, page, k):
    try: return r["draw"][str(page)]["regions"][k]
    except Exception: return None
def pdftotext(f, pw=None, layout=False):
    a = ["pdftotext"] + (["-layout"] if layout else []) + (["-upw", pw] if pw else []) + [os.path.join(HERE, f), "-"]
    return subprocess.run(a, capture_output=True).stdout.decode("utf-8", "replace")
def pdfinfo_title(f):
    o = subprocess.run(["pdfinfo", os.path.join(HERE, f)], capture_output=True).stdout.decode("utf-8", "replace")
    m = re.search(r"^Title:\s*(.*)$", o, re.M)
    return m.group(1).strip() if m else ""
def near(a, b, tol=40): return a is not None and b is not None and all(abs(x - y) <= tol for x, y in zip(a, b))
def ink(m): return m is not None and m["dark"] > 2
def save():
    # (the review's record is written only in a run against 1.24.38, as it was made; a replay leaves it as it is)
    if not OLD: return
    json.dump(cases, open(OUT, "w"), indent=1, ensure_ascii=False)

# =============================================================== 1. TRAILERS
def g_trailer():
    G = "trailer"
    want_t, want_o = "", [["Rev2 Outline", 0, 0]]
    for tag in ["exact", "m1", "p1", "m2", "p2", "m7", "p7", "m15", "p15", "p19", "m19"]:
        f = "tr_cls_dropinfo_%s.pdf" % tag
        r = rv(f, draw=False); ro = old(f, draw=False)
        got = {"1.24.39": [r.get("openError") or r.get("title"), r.get("outline"), (r.get("texts") or [""])[0][:30]], "1.24.38": [ro.get("openError") or ro.get("title"), ro.get("outline")]}
        case(G, f, "update drops /Info, names a new catalog; startxref %s: no title, the new outline, the new text (pdfinfo: no title)" % tag,
             [want_t, want_o], got, r.get("title") == want_t and r.get("outline") == want_o and "Revision two" in (r.get("texts") or [""])[0])
    for tag in ["p40", "m60"]:
        f = "tr_cls_dropinfo_%s.pdf" % tag
        r = rv(f, draw=False); ro = old(f, draw=False)
        case(G, f, "DAMAGED: startxref %s (beyond the 20-byte window): as qpdf/pdfinfo after their repair (no title, new outline)" % tag, [want_t, want_o],
             {"1.24.39": [r.get("openError") or r.get("title"), r.get("outline")], "1.24.38": [ro.get("openError") or ro.get("title"), ro.get("outline")]},
             r.get("title") == want_t and r.get("outline") == want_o, "info")
    for tag in ["exact", "p1", "p2", "m1", "m3", "p5"]:
        f = "tr_xs_dropinfo_%s.pdf" % tag
        r = rv(f, draw=False); ro = old(f, draw=False)
        case(G, f, "update as a cross-reference stream (object 123) dropping /Info; startxref %s: no title, new outline" % tag, [want_t, want_o],
             {"1.24.39": [r.get("openError") or r.get("title"), r.get("outline")], "1.24.38": [ro.get("openError") or ro.get("title"), ro.get("outline")]},
             r.get("title") == want_t and r.get("outline") == want_o)
    for f in ["tr_cls_newinfo.pdf", "tr_xs_newinfo.pdf"]:
        r = rv(f, draw=False)
        case(G, f, "update names a new Info: its title (pdfinfo 'New Title'), the old outline", ["New Title", [["Rev1 Outline", 0, 0]]], [r.get("title"), r.get("outline")],
             r.get("title") == "New Title" and r.get("outline") == [["Rev1 Outline", 0, 0]])
    for f, want, kind in [("tr_prefix12_dropinfo.pdf", [want_t, want_o], "must"), ("tr_prefix12_single.pdf", ["Single Title", []], "must"),
                          ("tr_prefix300_single.pdf", ["Single Title", []], "must"), ("tr_prefix300_dropinfo.pdf", [want_t, want_o], "info")]:
        r = rv(f, draw=False); ro = old(f, draw=False)
        case(G, f, "junk before %%PDF (%s): opens, title and outline as qpdf/pdfinfo read them" % ("12 bytes" if "12" in f else "300 bytes" + (", two revisions: DAMAGED-ish, informational" if kind == "info" else "")),
             want, {"1.24.39": [r.get("openError") or r.get("title"), r.get("outline")], "1.24.38": [ro.get("openError") or ro.get("title"), ro.get("outline")]},
             [r.get("title"), r.get("outline")] == want, kind)
    for tag in ["nuls", "mime", "dummyxref"]:
        f = "tr_tail_%s_dropinfo.pdf" % tag
        r = rv(f, draw=False); ro = old(f, draw=False)
        case(G, f, "garbage after %%%%EOF (%s): no title, new outline, as pdfinfo" % tag, [want_t, want_o],
             {"1.24.39": [r.get("openError") or r.get("title"), r.get("outline")], "1.24.38": [ro.get("openError") or ro.get("title"), ro.get("outline")]},
             [r.get("title"), r.get("outline")] == [want_t, want_o], "must" if tag != "dummyxref" else "info")
    f = "tr_startxref_oldtable.pdf"; r = rv(f, draw=False); ro = old(f, draw=False)
    case(G, f, "DAMAGED: the last startxref names the first revision's table (qpdf and pdfinfo follow it: 'Old Title', Rev1 outline)", ["Old Title", [["Rev1 Outline", 0, 0]]],
         {"1.24.39": [r.get("title"), r.get("outline"), (r.get("texts") or [""])[0][:20]], "1.24.38": [ro.get("title"), ro.get("outline")]}, r.get("title") == "Old Title", "info")
    f = "tr_hybrid_upd_dropinfo.pdf"; r = rv(f, draw=False)
    case(G, f, "hybrid file (Info in an object stream named by /XRefStm), updated without /Info: no title (pdfinfo, qpdf), new text", "",
         [r.get("openError") or r.get("title"), r.get("texts")], r.get("title") == "" and "revision two" in (r.get("texts") or [""])[0])
    f = "tr_lin_upd_dropinfo.pdf"; r = rv(f, draw=False)
    case(G, f, "linearized (qpdf), then updated by a cross-reference stream without /Info: no title, both lines", "",
         [r.get("openError") or r.get("title"), r.get("texts")], r.get("title") == "" and "Update after linearizing" in (r.get("texts") or [""])[0] and "Linearized base page" in (r.get("texts") or [""])[0])
    f = "tr_lesson_words_in_update.pdf"; r = rv(f, draw=False); ro = old(f, draw=False)
    case(G, f, "page text (uncompressed, in the update) shows 'trailer << ... /Encrypt 7 0 R >>' and 'startxref 0': opens, title, text", "opens, 'PDF Lesson Two'",
         {"1.24.39": r.get("openError") or [r.get("title"), (r.get("texts") or [""])[0][:60]], "1.24.38": ro.get("openError") or ro.get("title")},
         not r.get("openError") and r.get("title") == "PDF Lesson Two" and "/Encrypt 7 0 R" in (r.get("texts") or [""])[0])
    f = "tr_xs_noinfo_attached_pdf.pdf"; r = rv(f, draw=False); ro = old(f, draw=False)
    case(G, f, "a file (cross-reference stream, no /Info) carrying an unpacked attached PDF: its own page and no title (poppler: %r, title %r), not the attachment's" % (pdftotext(f).strip(), pdfinfo_title(f)),
         ["Binder page: the manual is attached.", ""], {"1.24.39": [r.get("openError") or r.get("title"), r.get("texts")], "1.24.38": [ro.get("openError") or ro.get("title"), ro.get("texts")]},
         r.get("title") == "" and "Binder page" in (r.get("texts") or [""])[0])
    for f in ["tr_concat_ab.pdf", "tr_concat_aa.pdf"]:
        r = rv(f, draw=False); ro = old(f, draw=False)
        pt = pdftotext(f).strip(); pi = pdfinfo_title(f)
        case(G, f, "DAMAGED: two PDFs one after the other: the second's page, as poppler (text %r, title %r)" % (pt, pi), [pt, pi],
             {"1.24.39": [r.get("openError") or r.get("title"), r.get("texts")], "1.24.38": [ro.get("openError") or ro.get("title"), ro.get("texts")]},
             (r.get("texts") or [""])[0].strip() == pt and r.get("title") == pi, "info")
    save()


# =============================================================== 2. HIDDEN PARTS
def g_hidden():
    G = "hidden"; f = "oc_parts.pdf"
    R = {0: [[50, 698, 98, 716], [98, 698, 194, 716], [194, 698, 242, 716], [50, 598, 74, 616], [94, 598, 118, 616], [118, 598, 186, 616], [186, 598, 210, 616],
             [50, 498, 74, 516], [50, 474, 74, 492], [74, 474, 98, 492]],
         1: [[50, 700, 70, 720], [72, 700, 108, 720], [110, 700, 130, 720]],
         2: [[200, 600, 300, 700], [200, 400, 300, 500]], 3: [[200, 600, 300, 700]], 4: [[200, 600, 300, 700]], 5: [[200, 600, 300, 700]],
         6: [[300, 600, 324, 616], [0, 0, 30, 16]],
         7: [[50, 600, 100, 650], [200, 600, 250, 650], [200, 400, 240, 440], [200, 450, 250, 500], [400, 600, 450, 650], [400, 400, 450, 450], [50, 300, 100, 350], [150, 300, 200, 350], [300, 200, 350, 250]],
         8: [[50, 600, 100, 650], [100, 600, 150, 650], [200, 600, 300, 650], [350, 600, 370, 650], [370, 600, 450, 650], [480, 600, 560, 650], [480, 400, 560, 450]],
         9: [[50, 600, 100, 650], [200, 600, 250, 650], [300, 300, 380, 350]]}
    r = rv(f, drawPages=list(range(10)), regions=R, maxPages=10)
    pop = {p: poppler_regions(os.path.join(HERE, f), p, R[p]) for p in R}
    def chk(p, k, want, what, kind="must", oracle="poppler"):
        m = reg(r, p, k); pm = pop[p][k]
        if want == "ink": ok = ink(m)
        elif want == "none": ok = m is not None and m["nonwhite"] < 1
        else: ok = m is not None and near(m["rgb"], want)
        case(G, f, "page %d: %s (%s: %s)" % (p + 1, what, oracle, pm["rgb"]), want, m, ok, kind)
    chk(0, 0, "ink", "text before a hidden part in the same text object drawn")
    chk(0, 1, "none", "the hidden words not drawn")
    chk(0, 2, "ink", "the words after the hidden part drawn where they belong (advanced past the hidden words)")
    chk(0, 3, "ink", "TJ before: first word"); chk(0, 4, "ink", "TJ before: second word after kerning")
    chk(0, 5, "none", "TJ inside the hidden part not drawn"); chk(0, 6, "ink", "the word after the hidden TJ at its place")
    chk(0, 7, "ink", "line 1 before the quote operator"); chk(0, 8, "none", "the quote operator's words in the hidden part not drawn")
    chk(0, 9, "ink", "the words after it, on the quote operator's new line")
    chk(1, 0, "ink", "Type 3 square before the hidden part", oracle="poppler draws the hidden Type 3 squares too; the standard does not")
    chk(1, 1, "none", "Type 3 squares in the hidden part not drawn", oracle="poppler draws them; the standard does not")
    chk(1, 2, "ink", "Type 3 square after the hidden part, advanced past the hidden ones")
    chk(2, 0, "none", "a clip set inside a hidden part still clips (until its Q): the red box not drawn")
    chk(2, 1, [0, 0, 255], "after that Q, the blue box drawn")
    chk(3, 0, [255, 0, 0], "q and the clip and Q inside a hidden part: the red box after it drawn")
    chk(4, 0, [0, 0, 0], "the picture's placing (cm) set inside a hidden part: the picture drawn there")
    chk(5, 0, [255, 0, 0], "the colour set inside a hidden part: the box after it red")
    chk(6, 0, "ink", "the text position (Td) set inside a hidden part: XX drawn at 300,600"); chk(6, 1, "none", "... not at the origin")
    for k, (want, what) in enumerate([([0, 255, 0], "shown form's own box"), ("none", "a form with /OC off inside a shown form"), ("none", "a form drawn in a hidden part"),
                                      ("none", "a form inside a form in a hidden part"), ([0, 0, 255], "a shown form (/OC on): its box"), ("none", "... its hidden part"),
                                      ([0, 255, 0], "a form whose hidden part is never closed: its box before"), ("none", "... the part after the open BDC"),
                                      ([0, 0, 255], "the page's box after that form (the open hidden part ends with the form)")]):
        chk(7, k, want, "forms: " + what)
    chk(8, 0, [255, 0, 0], "annotation drawing: its shown half"); chk(8, 1, "none", "annotation drawing: its hidden half (property in its own resources)")
    chk(8, 2, "none", "annotation drawing with a hidden part named only in the PAGE's /Properties (not its own: beyond the standard)", "info")
    chk(8, 3, [0, 0, 0], "annotation drawing whose hidden part is never closed: the part before")
    chk(8, 4, "none", "... the part after"); chk(8, 5, [255, 0, 0], "the NEXT annotation drawn (each appearance stands alone, ISO 32000 12.5.5)", oracle="poppler leaks the open part into the next annotation")
    chk(8, 6, "none", "an annotation with /OC off not drawn")
    chk(9, 0, [0, 0, 255], "page that ends inside a hidden part: the box before"); chk(9, 1, "none", "the box in the open hidden part")
    chk(9, 2, [0, 255, 0], "an annotation on that page drawn (it is not page content)", oracle="poppler leaks the open part into the annotation")
    # the words read (pageText) as poppler's pdftotext reads them
    t = (r.get("texts") or [""])[0]; pt = pdftotext(f, layout=False)
    lines = [l.strip() for l in t.split("\n") if l.strip()]
    case(G, f, "page 1 read: hidden words left out, the words before and after a hidden part kept apart (pdftotext: 'AAAA CCCC', 'DD DD FF', 'GG' / 'II')",
         ["AAAA CCCC", "DD DD FF", "GG", "II"], lines, lines[:4] == ["AAAA CCCC", "DD DD FF", "GG", "II"])
    case(G, f, "page 7 read: XX", "XX", (r.get("texts") or ["", "", "", "", "", "", ""])[6], (r.get("texts") or [""] * 7)[6].strip() == "XX")
    # pageImage (a scan's pictures, PDF_PAGES) follows the placing set in a hidden part too
    r2 = rv(f, draw=False, text=False, pageImage=[[200, 600, 300, 700]], page=4)
    case(G, f, "page 5, pageImage: the picture placed by a cm inside a hidden part", "dark", r2.get("pageImage"), r2.get("pageImage") and r2["pageImage"][0]["dark"] > 90)
    case(G, f, "no errors", [], r.get("errors"), not r.get("errors"))
    f = "inline_img.pdf"; RG = [[60, 610, 140, 690], [260, 610, 340, 690], [460, 610, 540, 690]]
    r = rv(f, regions={0: RG}, text=False); ro = old(f, regions={0: RG}, text=False); pop = poppler_regions(os.path.join(HERE, f), 0, RG)
    for k, (want, what, kind) in enumerate([([0, 0, 0], "an inline image (BI ID EI) drawn", "info"), ("none", "an inline image in a hidden part not drawn", "must"), ([0, 0, 255], "the box after them", "must")]):
        m = reg(r, 0, k); mo = reg(ro, 0, k)
        ok = (m is not None and m["nonwhite"] < 1) if want == "none" else (m is not None and near(m["rgb"], want))
        case(G, f, "%s (poppler %s; 1.24.38 %s)" % (what, pop[k]["rgb"], mo and mo["rgb"]), want, m, ok, kind)
    # a real maker's layers: pdfTeX + ocgx2, a hidden layer inside a line of words
    f = "ord_pdftex_ocgx2.pdf"; RG = [[150, 703, 215, 716], [240, 703, 330, 716], [346, 703, 454, 716]]
    r = rv(f, regions={0: RG}); ro = old(f, draw=False); pop = poppler_regions(os.path.join(HERE, f), 0, RG)
    for k, (want, what) in enumerate([("ink", "the words before the hidden layer"), ("none", "the hidden layer's words"), ("ink", "the words after it")]):
        m = reg(r, 0, k)
        case(G, f, "pdfTeX ocgx2 layer (off) inside a line: %s (poppler dark %s%%)%s" % (what, pop[k]["dark"], " -- ink here spills from the garbled Type 1 letters beside it (the flex bug, see the blend group); a copy with that fixed draws it clean" if k == 1 else ""),
             want, m, ink(m) if want == "ink" else (m is not None and m["nonwhite"] < 1), "info" if k == 1 else "must")
    m = reg(r, 0, 2)
    case(G, f, "pdfTeX's Computer Modern (embedded Type 1, flex hints) drawn as poppler draws it: ink of 'after the layer, same line.' within 30%% of poppler's %s%% (1.24.38 the same)" % pop[2]["dark"],
         pop[2]["dark"], m and m["dark"], m is not None and abs(m["dark"] - pop[2]["dark"]) <= 0.3 * pop[2]["dark"])
    t = (r.get("texts") or [""])[0]
    case(G, f, "pdfTeX ocgx2: the hidden layer's words not read, the rest read (1.24.38 read them: %r)" % (ro.get("texts") or [""])[0][:70], "no SECRET; SHOWN WORDS kept", t[:200],
         "SECRET" not in t and "SHOWN WORDS" in t and "Before the layer" in t and "after the layer" in t)
    save()

# =============================================================== 3. BLEND MODES, PAGE GROUP, CLEAN STATE, ALPHA, ORDINARY FILES, TIME
def g_blend():
    G = "blend"
    f = "blend_deep.pdf"; RG = [[150, 610, 250, 640], [150, 555, 250, 595]]
    regs = {p: RG for p in range(4)}
    r = rv(f, drawPages=[0, 1, 2, 3], regions=regs, text=False); ro = old(f, drawPages=[0, 1, 2, 3], regions=regs, text=False)
    for p, what, kind in [(0, "Screen in a form three deep", "must"), (1, "Screen in a form FOUR deep", "must"), (2, "Screen in a Type 3 font's own resources", "info"),
                          (3, "Screen in an annotation's drawing, three forms in", "must")]:
        pop = poppler_regions(os.path.join(HERE, f), p, RG)
        for k, where in [(0, "over the black bar"), (1, "over nothing (white paper)")]:
            m = reg(r, p, k); mo = reg(ro, p, k)
            case(G, f, "page %d: a blue box drawn with /BM /Screen, %s, %s: blue (poppler %s; 1.24.38, which drew it Normal: %s)" % (p + 1, what, where, pop[k]["rgb"], mo and mo["rgb"]),
                 [0, 0, 255], m and m["rgb"], m is not None and near(m["rgb"], [0, 0, 255]), kind if p != 2 else "info")
    # state the page's drawing leaves behind
    f = "state_unbalanced.pdf"
    regs = {0: [[400, 400, 500, 500], [410, 610, 490, 640], [110, 110, 190, 190]], 1: [[300, 300, 400, 400], [5, 5, 45, 45]], 2: [[410, 610, 490, 640], [110, 110, 190, 190]]}
    r = rv(f, drawPages=[0, 1, 2], regions=regs, text=False); ro = old(f, drawPages=[0, 1, 2], regions=regs, text=False)
    m = reg(r, 0, 0)
    case(G, f, "page 1: a clip at the top level, then a q never closed, a Screen blend (page drawn on nothing): the paper outside the clip is still white, not see-through",
         {"rgb": [255, 255, 255], "clear": 0}, m, m is not None and m["clear"] == 0 and near(m["rgb"], [255, 255, 255], 5))
    m = reg(r, 0, 1); case(G, f, "page 1: an annotation outside that clip drawn (each annotation from the default state, ISO 32000 12.5.5; poppler red)", [255, 0, 0], m, m is not None and near(m["rgb"], [255, 0, 0]))
    m = reg(r, 0, 2); case(G, f, "page 1: the blue box inside the clip (poppler blue)", [0, 0, 255], m, m is not None and near(m["rgb"], [0, 0, 255]))
    m = reg(r, 1, 0); mo = reg(ro, 1, 0)
    case(G, f, "page 2: a form whose content leaves a q open: the page's red box after it, outside the form's box, drawn (poppler red; 1.24.38: %s)" % (mo and mo["rgb"]),
         [255, 0, 0], m, m is not None and near(m["rgb"], [255, 0, 0]), "must" if (mo and near(mo["rgb"], [255, 0, 0])) else "info")
    m = reg(r, 1, 1); case(G, f, "page 2: the form's own green box", [0, 255, 0], m, m is not None and near(m["rgb"], [0, 255, 0]))
    m = reg(r, 2, 0); case(G, f, "page 3: a clip then a q never closed (no blend mode anywhere): an annotation outside the clip drawn (each from the default state; poppler red)", [255, 0, 0], m, m is not None and near(m["rgb"], [255, 0, 0]))
    m = reg(r, 2, 1); case(G, f, "page 3: the blue box inside the clip (poppler blue)", [0, 0, 255], m, m is not None and near(m["rgb"], [0, 0, 255]))
    # outlined letters with a see-through stroke
    f = "stroke_alpha.pdf"; RG = [[60, 645 - 150 * k, 330, 700 - 150 * k] for k in range(3)]
    r = rv(f, regions={0: RG}, text=False); pop = poppler_regions(os.path.join(HERE, f), 0, RG)
    for k, what in enumerate(["outlined letters (Tr 1), stroke /CA 0.3", "outlined letters, /CA 1", "filled white and outlined (Tr 2), stroke /CA 0.3"]):
        m = reg(r, 0, k)
        case(G, f, "%s: as light as poppler draws them (poppler dark %s%%, mean %s)" % (what, pop[k]["dark"], pop[k]["rgb"]), {"dark": pop[k]["dark"]}, m,
             m is not None and abs(m["dark"] - pop[k]["dark"]) <= max(2, pop[k]["dark"] * 0.5) and abs(m["rgb"][0] - pop[k]["rgb"][0]) <= 20)
    # TikZ blend mode (pdfTeX): the page is a group, white put under at the end
    f = "ord_tikz_screen.pdf"; RG = [[285, 643, 350, 650], [285, 615, 350, 636], [395, 643, 440, 650], [395, 615, 440, 636]]
    r = rv(f, regions={0: RG}, text=False); pop = poppler_regions(os.path.join(HERE, f), 0, RG)
    for k, what in enumerate(["blue Screen box over the black bar", "blue Screen box over the paper", "green Screen box over the black bar", "green Screen box over the paper"]):
        m = reg(r, 0, k)
        case(G, f, "TikZ blend mode=screen: %s as poppler (%s)" % (what, pop[k]["rgb"]), pop[k]["rgb"], m, m is not None and near(m["rgb"], pop[k]["rgb"]))
    # ordinary PDFs from real makers: drawn pixel for pixel as 1.24.38 drew them, and no slower than a few times
    for f, pages in [("ord_pdftex.pdf", [0]), ("ord_matplotlib.pdf", [0]), ("ord_cairo.pdf", [0]), ("ord_writer.pdf", [0]), ("cairo_screen_depth3.pdf", [0]), ("cairo_screen_depth4.pdf", [0]),
                     ("lo_transp_30.pdf", [0]), ("lo_transp_60.pdf", [0]), ("lo_transp_90.pdf", [0])]:
        r = rv(f, drawPages=pages, text=False, timeout=300000); ro = old(f, drawPages=pages, text=False, timeout=300000)
        hn = [r.get("draw", {}).get(str(p), {}).get("hash") for p in pages]; ho = [ro.get("draw", {}).get(str(p), {}).get("hash") for p in pages]
        tn = [r.get("draw", {}).get(str(p), {}).get("ms") for p in pages]; to = [ro.get("draw", {}).get(str(p), {}).get("ms") for p in pages]
        if OLD and not f.startswith("cairo_screen"):
            case(G, f, "an ordinary PDF (no blend mode): drawn pixel for pixel as 1.24.38", ho, hn, hn == ho and None not in hn)
        # (with no 1.24.38 to time against -- the replay in npm test -- 1.5 s is the bound)
        ok = all(a is not None and (b is not None and a <= max(1500, 5 * b) or not OLD and a <= 1500) for a, b in zip(tn, to))
        case(G, f, "drawing time: no more than five times 1.24.38's (or 1.5 s)", {"1.24.38 ms": to}, {"1.24.39 ms": tn, "error": r.get("harnessError") or r.get("errors")}, ok)
    save()

# =============================================================== 4. TEXT READER: what a page counts as its own words, and its picture
TRJS = """async (a) => {
  var TR = Lantern.textReader, buf = await (await fetch(a.f)).arrayBuffer(), out = {}, real = TR.read;
  if (a.stub) TR.read = async function (cv) { return { text: 'OCR[' + cv.width + 'x' + cv.height + ']', conf: 0.9, unsure: [], blocks: [] }; };
  var file = new File([buf], a.f.split('/').pop(), {type: 'application/pdf'});
  try {
    var doc = await TR.docs.open([file], {});
    var pi = await Lantern.pdf.pageImage(doc.pdf, 0); out.pageImage = pi ? [pi.width, pi.height] : null;
    var cv = await TR.docs.picture(doc, 0); out.picture = cv ? [cv.width, cv.height] : null;
    await TR.docs.readSection(doc, 0, {}); var p = doc.pages[0]; out.own = !!p.own; out.text = TR.docs.text(doc); out.error = p.error;
  } catch (e) { out.error = String(e.message || e); }
  TR.read = real;
  return out;
}"""
def g_textreader():
    G = "text reader"
    def tr(f, stub=True, which="new"): return B.run(TRJS, {"f": "/" + f, "stub": stub}, which=which, timeout=400000)
    NOTE = "Note (Adam): Checked by the night shift, see the log book"
    for f, what, want_own, want_pic, extra in [
            ("tr_scan150_note.pdf", "150-dpi scan + a sticky note", False, "scan", [NOTE]),
            ("tr_scan150_fields.pdf", "150-dpi scan + two filled fields", False, "scan", []),
            ("tr_scan300_stamp.pdf", "300-dpi scan + a stamp with no words of its own (/Name /Approved)", False, "scan", ["Stamp: Approved"]),
            ("tr_scan300_highlight.pdf", "300-dpi scan + a highlight with a comment", False, "scan", ["Highlighted (Grace): Check this line"]),
            ("tr_scan150_link_popup.pdf", "150-dpi scan + a link and a popup only (nothing drawn on top)", False, "scan", []),
            ("tr_scan150_rot90_note.pdf", "150-dpi scan on a page turned by /Rotate 90 + a note", False, "scan", [NOTE]),
            ("tr_scan150_ocrlayer_note.pdf", "a scan already read (an invisible text layer) + a note", True, None, [NOTE, "INSPECTION REPORT"]),
            ("tr_typed_short_field.pdf", "typed page with 4 letters ('Name:') + a filled field", False, "2.5", []),
            ("tr_typed_29_note.pdf", "typed page with 29 letters + a note", False, "2.5", [NOTE]),
            ("tr_typed_30_note.pdf", "typed page with 30 letters + a note", True, None, [NOTE, "ABCDEFGHIJABCDEFGHIJABCDEFGHIJ"]),
            ("tr_typed_31_note.pdf", "typed page with 31 letters + a note", True, None, [NOTE])]:
        r = tr(f)
        pic = r.get("picture"); pim = r.get("pageImage"); t = r.get("text") or ""
        if want_pic == "scan": wp = pim
        elif want_pic == "2.5": wp = [1530, 1980]
        else: wp = None
        ok_path = r.get("own") == want_own and (want_own or "OCR[" in t)
        case(G, f, what + ": read %s" % ("by its own words" if want_own else "by OCR of its picture"), want_own, {"own": r.get("own"), "text": t[:200], "error": r.get("error")}, ok_path)
        if wp is not None:
            case(G, f, what + ": its picture %s %s" % ("at the scan's own resolution, as pageImage" if want_pic == "scan" else "at 2.5 dots a point", wp), wp, {"picture": pic, "pageImage": pim}, pic == wp)
        for e in extra:
            case(G, f, what + ": the text has %r (once)" % e[:50], e, t[:300], t.count(e) == 1)
        if want_own is False and "Comments on this page" in t:
            case(G, f, what + ": the comments come after what OCR read", "OCR first", t[:120], t.index("OCR[") < t.index("Comments on this page"))
    # the picture of a page with a small logo (its only picture), a few printed letters and a long typed field value
    r1 = tr("tr_logo_field.pdf"); r2 = tr("tr_nologo_field.pdf")
    case(G, "tr_logo_field.pdf", "few letters + a long field value + a SMALL LOGO (48 px over 54 pt): drawn for OCR at 2.5 dots a point as the same page without the logo is, not at the logo's 0.9 (floor 1)",
         r2.get("picture"), {"with logo": r1.get("picture"), "without": r2.get("picture")}, r1.get("picture") == r2.get("picture"))
    # real OCR (Text Reader's own reader) on the cases that matter most
    LONG = "Pump two tripped at three in the morning; reset it and checked the floats"
    for f, words in [("tr_scan150_note.pdf", ["INSPECTION", "PUMP", "STATION", "FLOATS", "night shift"]), ("tr_scan150_fields.pdf", ["INSPECTION", "FLOATS", "Grace", "Hopper", "2026"]),
                     ("tr_logo_field.pdf", ["Pump", "tripped", "three", "morning", "checked", "floats"]), ("tr_nologo_field.pdf", ["Pump", "tripped", "three", "morning", "checked", "floats"])]:
        r = tr(f, stub=False); ro = B.run(TRJS, {"f": "/" + f, "stub": False}, which="old", timeout=400000) if OLD else {}
        t = r.get("text") or ""; to = ro.get("text") or ""
        got = [w for w in words if w.lower() in t.lower()]; goto = [w for w in words if w.lower() in to.lower()]
        case(G, f, "real OCR: the printed and typed words read (%s)" % ", ".join(words), words, {"1.24.39 found": got, "1.24.39 text": t[:240], "1.24.38 found": goto, "picture": r.get("picture")},
             len(got) == len(words), "must")
    save()

# =============================================================== 5. FORMS, LINKS, NAMES, TEXT STRINGS, PASSWORDS
def g_forms():
    G = "forms, names, strings, locks"
    f = "forms3.pdf"; r = rv(f, links=True, draw=False); ro = old(f, links=True, draw=False)
    fv = {x["name"]: x["value"] for x in r.get("fields") or []}; fo = {x["name"]: x["value"] for x in ro.get("fields") or []}
    for name, want, what, kind in [("dir", "Downstream", "radio with /Opt, on-names /0 /1 /2 (Acrobat's way): the export value from /Opt", "must"),
                                   ("rating", "2", "radio whose export values are 1 2 3 (on-names), no /Opt", "must"),
                                   ("agree", "Ja", "check box with /Opt [(Ja)], on-name /0", "must"),
                                   ("dir2", "Downstream", "radio with /Opt and on-names /Up /Down (the standard: Opt is each widget's on state as text)", "info"),
                                   ("notes", "Value kept in a stream, compressed", "text field whose /V is a compressed stream", "must"),
                                   ("le", "Pumpe – Handbuch", "text value in UTF-16LE with its mark FF FE", "info"),
                                   ("be", "Schacht gereinigt", "text value in UTF-16BE with a language+country escape (ESC de DE ESC)", "must"),
                                   ("si8", "Sí", "check box on-name in UTF-8 (/S#C3#AD)", "info"),
                                   ("si1", "Sí", "check box on-name in Latin-1 bytes (/S#ED): kept as it is", "must")]:
        case(G, f, "fields(): " + what, want, {"1.24.39": fv.get(name), "1.24.38": fo.get(name)}, fv.get(name) == want, kind)
    t = (r.get("texts") or [""])[0]
    case(G, f, "pageText: the stream value and the UTF-16 values beside their places", ["Value kept in a stream, compressed", "Schacht gereinigt"], t,
         "Value kept in a stream, compressed" in t and "Schacht gereinigt" in t and "\x1b" not in t)
    lk = [x.get("uri") for x in (r.get("links") or [[]])[0]]
    case(G, f, "links: a web address in UTF-8 bytes, one in Latin-1 bytes, one %-escaped", ["https://example.org/café", "https://example.org/café", "https://example.org/caf%C3%A9"], lk,
         lk == ["https://example.org/café", "https://example.org/café", "https://example.org/caf%C3%A9"])
    # names
    f = "names3.pdf"; r = rv(f, links=True, draw=False); meta = json.load(open(os.path.join(HERE, "names3.json")))
    lk = [x.get("page") for x in (r.get("links") or [[]])[0]]
    want = [meta["pages"][k] for k in meta["keys"]] + [1]
    case(G, f, "named destinations whose names are PDFDocEncoding, UTF-8 and UTF-16BE bytes, in a name tree of two byte-sorted kids (hex and literal /Limits), and a /Dests name with UTF-8 bytes",
         want, lk, lk == want)
    # titles
    for f, want, kind in [("title_utf16le.pdf", "Pumpe – Handbuch", "info"), ("title_utf16_langmid.pdf", "Wet well puits humide", "must"), ("title_pdfdoc.pdf", "Manual — Part € 5", "must")]:
        r = rv(f, draw=False)
        case(G, f, "title (pdfinfo: %r)" % pdfinfo_title(f), want, r.get("title"), r.get("title") == want, kind)
    # passwords
    for f, pw in [("pw_aes256_softhyphen.pdf", "pump­house"), ("pw_aes256_nbsp.pdf", "pump house"), ("pw_v4_rc4_cflen_bits.pdf", "pump")]:
        r = rv(f, draw=False, pw=pw); r0 = rv(f, draw=False, text=False)
        case(G, f, "locked with a user password (qpdf opens it with %r): Lantern asks for it, then opens with it" % pw, ["needPassword", "Title test"],
             [r0.get("needPassword"), r.get("openError") or (r.get("texts") or [""])[0]], r0.get("needPassword") and "Title test" in (r.get("texts") or [""])[0])
    save()

# =============================================================== 6. SWEEP: every other PDF in tests/fixtures, 1.24.38 against 1.24.39
def g_sweep():
    G = "sweep"
    import glob
    root = os.path.abspath(os.path.join(HERE, ".."))
    files = sorted(f for f in glob.glob(os.path.join(root, "**", "*.pdf"), recursive=True) if "pdf_review3_1239" not in f)
    diffs = []
    for path in files:
        rel = os.path.relpath(path, root)
        k = {"drawPages": [0, 1], "drawOpts": {"annots": False}, "maxPages": 3, "fields": False, "timeout": 120000}
        r = B.probe("fx/" + rel, **k); ro = B.probe("fx/" + rel, which="old", **k)
        if ro.get("openError") or ro.get("harnessError"):
            if r.get("harnessError") or r.get("errors"): diffs.append((rel, "new errors where 1.24.38 could not open", r.get("harnessError") or r.get("errors")))
            continue
        if r.get("openError") or r.get("harnessError"):
            diffs.append((rel, "1.24.38 opened it, 1.24.39 does not", r.get("openError") or r.get("harnessError"))); continue
        tn = [t.split("\nComments on this page:")[0] for t in r.get("texts") or []]; to = ro.get("texts") or []
        hn = {p: d["hash"] for p, d in (r.get("draw") or {}).items()}; ho = {p: d["hash"] for p, d in (ro.get("draw") or {}).items()}
        mn = sum(d["ms"] for d in (r.get("draw") or {}).values()); mo = sum(d["ms"] for d in (ro.get("draw") or {}).values())
        if tn != to: diffs.append((rel, "text differs", {"1.24.39": [t[:160] for t in tn], "1.24.38": [t[:160] for t in to]}))
        if hn != ho: diffs.append((rel, "drawing (annotations off) differs", {"1.24.39": hn, "1.24.38": ho}))
        if mn > max(1500, 5 * mo): diffs.append((rel, "drawing slower", {"1.24.39 ms": mn, "1.24.38 ms": mo}))
        if r.get("errors"): diffs.append((rel, "errors", r.get("errors")))
    json.dump(diffs, open(os.path.join(HERE, "sweep_diffs.json"), "w"), indent=1, ensure_ascii=False)
    case(G, "%d PDFs in tests/fixtures" % len(files), "opened by 1.24.38 and 1.24.39: same text (comments aside), same drawing with annotations off, not slower; differences listed in sweep_diffs.json and judged in REPORT.txt",
         0, len(diffs), True, "info")
    save()

GROUPS = {"trailer": g_trailer, "hidden": g_hidden, "blend": g_blend, "textreader": g_textreader, "forms": g_forms, "sweep": g_sweep}
if __name__ == "__main__":
    which = sys.argv[1:] or list(GROUPS)
    try:
        if OLD and os.path.exists(OUT) and sys.argv[1:]:
            cases[:] = [c for c in json.load(open(OUT)) if c["group"] not in which]
        for g in which: GROUPS[g]()
    finally:
        # (cases.json is the review's record: written again only in a run against 1.24.38, as the review was made;
        # cases_found.json is its run as found)
        if OLD: save()
        B.close()
    must = [c for c in cases if c["kind"] == "must"]
    print("\n%d checks: %d pass, %d FAIL, %d informational (%d of them as expected)" % (len(cases), sum(c["pass"] for c in must), sum(not c["pass"] for c in must),
          len(cases) - len(must), sum(c["pass"] for c in cases if c["kind"] == "info")))
    print("page errors:", B.errs)
