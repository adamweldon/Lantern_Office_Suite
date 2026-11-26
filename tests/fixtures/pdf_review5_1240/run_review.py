# run_review.py -- review 5 of 1.24.40's PDF tools. The PDFs are made by make_fixtures.py (reportlab, pikepdf, Chromium);
# every result is judged by programs that are not Lantern: poppler (pdftotext -bbox-layout/-layout, pdfinfo -dests,
# pdftoppm), pdfminer, pypdf, pikepdf, qpdf, and each fixture's own design.
# Usage: python3 run_review.py <new.html> <old.html> [group ...]
#   groups: hyph ls enc kept links forms deep flat sweep   (all when none given)
# Env: CJNAME (cases json), R3OUT (scratch copies), R3EV (evidence pictures).
import os, sys, json, re, glob, base64
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "pdf_review3_1240"))
SCRATCH = "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad"
os.environ.setdefault("R3OUT", os.path.join(SCRATCH, "r5out"))
os.environ.setdefault("R3EV", os.path.join(HERE, "evidence"))
import r3lib
from r3lib import Browser, Cases, save_b64, run, qcheck, qdf, npages, ptext, bbox, layout_lines, page_info, shown_to_user_rect, \
    fold, leaks_in_bytes, render, ocr, pypdf_text, pdfminer_text, HYPH, locate, pw_stop
OUT = os.environ["R3OUT"]; EV = os.environ["R3EV"]
os.makedirs(OUT, exist_ok=True); os.makedirs(EV, exist_ok=True)
_sq = r3lib.squeeze
def squeeze(s): return _sq(s.replace("­", ""))
r3lib.squeeze = squeeze
args = [a for a in sys.argv[1:] if a.endswith(".html")]
NEW = args[0] if args else os.path.join(SCRATCH, "lantern_1240_r5.html")
OLD = args[1] if len(args) > 1 else os.path.join(SCRATCH, "lantern_1240_r4.html")
GROUPS = set(a for a in sys.argv[1:] if not a.endswith(".html"))
def on(g): return not GROUPS or g in GROUPS
C = Cases(os.environ.get("CJNAME") or os.path.join(HERE, "cases.json"))
FXROOT = os.path.join(r3lib.ROOT, "tests", "fixtures")
def F(f): return f if os.path.isabs(f) else os.path.join(HERE, f)
_B = {}
def browser(which):
    if which not in _B: _B[which] = Browser(NEW if which == "new" else OLD, [HERE, OUT, "/"])
    return _B[which]

MARKS_JS = r"""
var pdf = await __open(a.f), out = {};
for (var i = 0; i < pdf.count; i++) { if (a.pages && a.pages.indexOf(i) < 0) continue;
  var bx = (await P.pageText(pdf, i)).boxes;
  for (var k = 0; k < a.words.length; k++) { var g = P.redactMarks(bx, a.words[k], true); (out[a.words[k]] = out[a.words[k]] || []); g.forEach(function (rs) { out[a.words[k]].push({page: i, rects: rs}); }); } }
return out;"""
TEXT_JS = r"""
var pdf = await __open(a.f), out = [];
for (var i = 0; i < pdf.count; i++) { var t = await P.pageText(pdf, i); out.push({text: t.text, lines: t.lines.map(function (l) { return l.text; }),
  words: a.boxes ? t.boxes.map(function (b) { return {y: b.y, size: b.size, parts: b.parts.map(function (p) { return [p.x, p.x1, p.text]; })}; }) : null}); }
return out;"""
REDACT_JS = r"""
var pdf = await __open(a.f), areas = [], t0 = Date.now();
for (var i = 0; i < pdf.count; i++) { var bx = (await P.pageText(pdf, i)).boxes;
  a.words.forEach(function (w) { P.redactMarks(bx, w, false).forEach(function (r) { areas.push({page: i, rect: r}); }); }); }
if (!areas.length) return {err: 'nothing marked', areas: []};
try { var b = await P.redact(pdf, {areas: areas, words: a.words}); return {b64: __b64(b), areas: areas, ms: Date.now() - t0}; }
catch (e) { return {err: String(e && e.message || e), areas: areas}; }"""
FLAT_JS = r"""
var pdf = await __open(a.f);
try { var b = await P.flatten(pdf, {forms: true, comments: true}); return {b64: __b64(b)}; } catch (e) { return {err: String(e && e.stack || e)}; }"""

def marks(f, words, which="new"): return browser(which).js(MARKS_JS, {"f": F(f), "words": words, "pages": None})
def ltext(f, which="new", boxes=False): return browser(which).js(TEXT_JS, {"f": F(f), "boxes": boxes})
def redact(f, words, name, which="new"):
    r = browser(which).js(REDACT_JS, {"f": F(f), "words": words})
    if r.get("err"): return None, r
    return save_b64(r["b64"], os.path.join(OUT, name + ".pdf")), r

def area(r): return max(0, r[2] - r[0]) * max(0, r[3] - r[1])
def inter(a, b): return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
def covered(box, rects):
    a = area(box)
    return min(1.0, sum(inter(box, r) for r in rects) / a) if a else 0

def poppler_places(path, page, target):
    """where poppler shows target on a page (1-based), as lists of word boxes in user space: on one line, and across a
    break at a hyphen between two lines that follow each other in poppler's reading order"""
    info = page_info(path, page - 1)
    lines = layout_lines(path, page)
    occ = [o for o in locate(path, page, target, lines) if len(o) == 1]
    t = squeeze(target)
    for a_, b_ in zip(lines, lines[1:]):
        last, first = a_[-1][0], b_[0][0]
        if last and last[-1] in HYPH and len(last) > 1:
            for j in (squeeze(last.rstrip(HYPH)) + squeeze(first), squeeze(last.rstrip(HYPH)) + "-" + squeeze(first)):
                if t in j and t not in squeeze(last) and t not in squeeze(first):
                    occ.append([a_[-1][1], b_[0][1]]); break
    return [[shown_to_user_rect(info["crop"], info["rot"], b) for b in o] for o in occ]

def word_box(path, page, word, which=0):
    info = page_info(path, page - 1); ws, _ = bbox(path, page)
    bs = [shown_to_user_rect(info["crop"], info["rot"], w[1:]) for w in ws if squeeze(w[0]) == squeeze(word)]
    return bs[which] if len(bs) > which else None

def head_box(path, page, word, tail):
    """the box of the word that goes on from tail: the nearest under it in its column (starting left of it, within 30 pt
    down), else the top-most one right of it (the head of the next column)"""
    info = page_info(path, page - 1); ws, _ = bbox(path, page)
    bs = [shown_to_user_rect(info["crop"], info["rot"], w[1:]) for w in ws if squeeze(w[0]) == squeeze(word)]
    near = [b for b in bs if 0 < tail[3] - b[3] < 30 and b[0] < tail[0]]
    if near: return max(near, key=lambda b: b[3])
    right = [b for b in bs if b[0] > tail[2]]
    return max(right, key=lambda b: b[3]) if right else None

def judge(G, f, page, target, groups, expect_n, places, note=""):
    gs = [g["rects"] for g in groups if g["page"] == page - 1]
    ok = C(G, f, "p%d '%s': search finds %d place(s)%s" % (page, target, expect_n, note), len(gs) == expect_n, expect_n,
           "%d: %s" % (len(gs), [[[round(v) for v in r] for r in g] for g in gs])[:600])
    allr = [r for g in gs for r in g]
    for k, pl in enumerate(places):
        cov = [covered(b, allr) for b in pl]
        C(G, f, "p%d '%s': place %d (%s) has all its pieces marked" % (page, target, k + 1, "broken" if len(pl) > 1 else "one line"),
          all(c >= 0.6 for c in cov), ">= 0.6 of each piece's box", "%s pieces at %s" % ([round(c, 2) for c in cov], [[round(v) for v in b] for b in pl]))
    if places and len(places) == expect_n and allr:
        stray = [r for r in allr if not any(inter(r, b) > 0.3 * area(r) for pl in places for b in pl)]
        C(G, f, "p%d '%s': every mark sits on the word (no stray marks)" % (page, target), not stray, "none", [[round(v) for v in r] for r in stray])
    return ok

# =====================================================================================================================
# 1. words broken at a line's end, in layouts the last review did not try
# =====================================================================================================================
def g_hyph():
    G = "hyph"; f = "hy_rl.pdf"; p = F(f)
    # by design: page -> [(word, n, (tail, head) or None)]; and joins that must not be made: page -> [word]
    EXP = {1: [("Bradford", 1, ("Brad-", "ford")), ("Thornton", 1, ("Thorn-", "ton")), ("Winterbourne", 1, ("Winter-", "bourne")),
               ("Pemberton", 1, ("Pember-", "ton"))],
           2: [("Kirkstall", 1, ("Kirk-", "stall")), ("Ravensworth", 1, ("Raven-", "sworth"))],
           3: [("Featherstonehaugh", 1, ("Feather-", "stonehaugh"))],
           4: [("Hollingsworth", 1, ("Hollings-", "worth")), ("AshworthBramley", 1, ("Ashworth-", "Bramley")), ("Quarmby", 1, ("Quarm-", "by")),
               ("Ravensworth", 1, ("Ravens-", "worth")), ("Lindisfarne", 1, ("Lindis-", "farne")), ("Alnmouth", 1, ("Alnm-", "outh"))],
           5: [("Electromagnetic", 1, ("Electro-", "magnetic")), ("Thermodynamics", 1, ("Thermo-", "dynamics")), ("Hydrostatic", 1, ("Hydro-", "static")),
               ("Gearbox", 1, ("Gear-", "box"))],
           6: [("Ulverston", 1, ("Ulver-", "ston"))]}
    WRONG = {1: ["WinterResults", "Winterthe", "Pemberbourne", "Pembernew"], 2: ["KirkValve", "Kirkthe"], 3: ["Feather1", "FeatherSee", "Featherthe"],
             4: ["anticounter", "counterde", "deinter"], 5: ["AXMain", "AXLever", "HydroValve", "GearMain"], 6: ["Ulverthe"]}
    words = sorted(set([w for v in EXP.values() for w, _, _ in v] + [w for v in WRONG.values() for w in v]))
    m = marks(f, words)
    for pg, exp in EXP.items():
        for w, n, hv in exp:
            places = []
            if hv:
                a_ = word_box(p, pg, hv[0]); b_ = head_box(p, pg, hv[1], a_) if a_ else None
                if a_ and b_: places = [[a_, b_]]
            judge(G, f, pg, w, m.get(w, []), n, places, " (by design)")
    for pg, ws in WRONG.items():
        for w in ws:
            gs = [g for g in m.get(w, []) if g["page"] == pg - 1]
            C(G, f, "p%d '%s' (halves that are not one word) is not found" % (pg, w), not gs, 0, len(gs))
    # Chromium: every made-up name is used once; poppler shows where it is
    for f, nf in (("hy_chrome.pdf", "hy_chrome_names.json"), ("lo_word.pdf", "lo_word_names.json")):
        names_check(G, f, json.load(open(F(nf))))
    hyph_redact(G)

def names_check(G, f, names):
    p = F(f)
    m = marks(f, names)
    for w in names:
        found_on = sorted(set(g["page"] for g in m.get(w, [])))
        pp = [(pg, poppler_places(p, pg, w)) for pg in range(1, npages(p) + 1)]
        pp = [(pg, pl) for pg, pl in pp if pl]
        if not pp:
            C(G, f, "'%s' found by poppler (fixture check)" % w, False, "1 place", "none"); continue
        pg, pl = pp[0]
        broken = len(pl[0]) > 1
        judge(G, f, pg, w, m.get(w, []), 1, pl, " (used once%s)" % ("; broken at a line's end" if broken else ""))
def hyph_redact(G):
    # Redact the broken names of hy_rl that the search should find; look for their halves in the copy
    cp, r = redact("hy_rl.pdf", ["Quarmby", "Hollingsworth", "Winterbourne", "Pemberton", "Kirkstall", "Featherstonehaugh", "Electromagnetic", "Lindisfarne"], "hy_rl_red")
    if not cp: C(G, "hy_rl.pdf", "redact ran", False, "a copy", r.get("err"))
    else:
        for pg, halves in ((1, ("Winter-", "bourne", "Pember-")), (2, ("Kirk-", "stall")), (3, ("Feather-", "stonehaugh")), (4, ("Quarm-", "Hollings-", "Lindis-", "farne")), (5, ("Electro-", "magnetic"))):
            ws = [w[0] for w in bbox(cp, pg)[0]]
            for h in halves:
                C(G, "hy_rl.pdf", "copy p%d: '%s' (half of a redacted word) is gone" % (pg, h), h not in ws, "gone", "still there")

# =====================================================================================================================
# 2. letter-spacing
# =====================================================================================================================
def g_ls():
    G = "ls"; sys.path.insert(0, HERE)
    import make_fixtures as mf
    f = "ls_chrome2.pdf"
    for which in ("new", "old"):
        t = ltext(f, which)
        lines = [l for pg in t for l in pg["lines"]]
        for html, exp, spaced in mf.LS_LINES:
            cand = [l for l in lines if squeeze(l) == squeeze(exp)]
            got = cand[0] if cand else None
            if which == "old":
                C(G, f, "1.24.39/r4 for comparison: '%s' read as '%s'" % (exp, got), True, exp, got); continue
            C(G, f, "Text reading of '%s'%s gives its words as written" % (exp, " (letter-spaced)" if spaced else ""),
              got is not None and [fold(x) for x in got.split()] == [fold(x) for x in exp.split()], exp, got if got is not None else [l for l in lines][:40])
    # poppler on the same lines, as a second opinion
    pl = [" ".join(ln) for ln in r3lib.bbox_lines(F(f), 1)]
    for html, exp, spaced in mf.LS_LINES:
        if not spaced:
            C(G, f, "(oracle) poppler reads '%s' as written" % exp, any(squeeze(x) == squeeze(exp) and x.split() == exp.split() for x in pl), exp, [x for x in pl if squeeze(x) == squeeze(exp)])
    f = "ls_rl2.pdf"
    t = ltext(f)
    lines = t[0]["lines"]
    for exp, why in (("a b c d e f g h", "chess files centred in 14 pt squares"), ("Y N Y N Y", "one-letter cells at a 12 pt pitch"),
                     ("Q W E R T Y", "keys centred at a 16 pt pitch"), ("KIRKSTALL", "letters spaced 0.4 em by hand, Helvetica"),
                     ("KIRKSTALL", "letters spaced 0.4 em by hand, Courier")):
        cand = [l for l in lines if squeeze(l) == squeeze(exp)]
        if "Courier" in why: cand = cand[1:2]
        elif "Helvetica" in why: cand = cand[0:1]
        ok = bool(cand) and cand[0].split() == exp.split()
        C(G, f, "Text reading of '%s' (%s) gives its words as written" % (exp, why), ok, exp, cand)
    pl = [" ".join(ln) for ln in r3lib.bbox_lines(F(f), 1)]
    C(G, f, "(oracle) poppler's lines of ls_rl2", True, "", pl)

# =====================================================================================================================
# 3. standard fonts with no /Encoding (and fonts the rule must not touch)
# =====================================================================================================================
def g_enc():
    G = "enc"; f = "enc_std.pdf"; p = F(f)
    specs = json.load(open(F("enc_std.json")))
    import make_fixtures as mf
    tn = ltext(f, "new", boxes=True); to = ltext(f, "old")
    for i, (k, base, enc) in enumerate(specs):
        pop = [l.strip() for l in ptext(p, i + 1).split("\n") if l.strip()]
        lan = [l for l in tn[i]["lines"] if l.strip()]
        old = [l for l in to[i]["lines"] if l.strip()]
        label = "%s %s" % (base, "no /Encoding" if enc is None else ("/Encoding << /Differences >> (no /BaseEncoding)" if "Differences" in enc else enc))
        C(G, f, "p%d %s: Text reading equals poppler's lines" % (i + 1, label), [squeeze(x) for x in lan] == [squeeze(x) for x in pop], pop, lan)
        if enc is None and base not in ("Symbol", "ZapfDingbats"):
            exp = [b for _, b in mf.ENC_LINES]
            C(G, f, "p%d %s: Text reading is Adobe's StandardEncoding (by the table)" % (i + 1, label), [squeeze(x) for x in lan] == [squeeze(x) for x in exp], exp, lan)
        if enc is not None or base in ("Symbol", "ZapfDingbats"):
            C(G, f, "p%d %s: read as before (r4)" % (i + 1, label), lan == old, old, lan)
        # each poppler word's right edge where Lantern's run puts it: compare the line's end
        ws, (pw, ph) = bbox(p, i + 1)
        lines = {}
        for w in ws: lines.setdefault(round(w[2]), []).append(w)
        lb = tn[i]["words"]
        for y_, wl in sorted(lines.items()):
            pend = max(w[3] for w in wl)
            ly = [b for b in lb if abs((ph - b["y"]) - (max(w[4] for w in wl) - 0.22 * (wl[0][4] - wl[0][2]))) < 6]
            lend = max((pp[1] for b in ly for pp in b["parts"]), default=None)
            C(G, f, "p%d %s: line at y %d ends where poppler's does (within 1 pt)" % (i + 1, label, y_), lend is not None and abs(lend - pend) <= 1.0, round(pend, 1), None if lend is None else round(lend, 1))
    # pdfminer as a third reader for the no-/Encoding pages
    pm = pdfminer_text(p).split("\f")
    for i, (k, base, enc) in enumerate(specs):
        if enc is None and base not in ("Symbol", "ZapfDingbats") and i < len(pm):
            pml = [l.strip() for l in pm[i].split("\n") if l.strip()]
            lan = [l for l in tn[i]["lines"] if l.strip()]
            C(G, f, "p%d %s no /Encoding: Text reading equals pdfminer's (oracle 3)" % (i + 1, base), [squeeze(x) for x in lan] == [squeeze(x) for x in pml], pml, lan)

# =====================================================================================================================
# 4. the kept words of a redacted copy, read by poppler, pypdf and pdfminer
# =====================================================================================================================
def g_kept():
    G = "kept"; f = "kept.pdf"; p = F(f)
    cp, r = redact(f, ["Ormskirk"], "kept_red")
    if not cp: C(G, f, "redact ran", False, "a copy", r.get("err")); return
    ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)
    for name, fn in (("poppler", ptext), ("pypdf", pypdf_text), ("pdfminer", pdfminer_text)):
        orig = [w for w in squeeze_words(fn(p)) if w != "ormskirk"]
        txt = fn(cp); got = squeeze_words(txt)
        missing = [w for w in orig if w not in got]
        C(G, f, "%s reads every kept word in the copy as it reads it in the original (%d words)" % (name, len(orig)), not missing, "all", "missing/split: %s | copy: %s" % (missing, " ".join(got)[:500]))
        C(G, f, "%s: the word is gone" % name, "ormskirk" not in squeeze(txt), "gone", "found")
    # places: poppler's word boxes in the copy against the original's (kept words, level lines)
    wo, _ = bbox(p); wc, _ = bbox(cp)
    far = []
    for w in wo:
        if squeeze(w[0]) == "ormskirk": continue
        cand = [c for c in wc if squeeze(c[0]) == squeeze(w[0])]
        if not cand: far.append((w[0], "absent")); continue
        d = min(max(abs(c[1] - w[1]), abs(c[2] - w[2]), abs(c[3] - w[3]), abs(c[4] - w[4])) for c in cand)
        if d > 1.5: far.append((w[0], round(d, 1)))
    C(G, f, "poppler puts each kept word where it was (within 1.5 pt)", not far, "all in place", far)

def squeeze_words(txt):
    return [squeeze(w) for w in re.split(r"\s+", txt) if squeeze(w)]

# =====================================================================================================================
# 5. links to named places, the names tree, bookmarks
# =====================================================================================================================
def dests_pdfinfo(path):
    out = run(["pdfinfo", "-dests", path]).stdout
    d = {}
    for ln in out.splitlines():
        m_ = re.match(r"\s*(\d+)\s+\[.*?\]\s+\"(.*)\"\s*$", ln)
        if m_: d[m_.group(2)] = int(m_.group(1))
    return d, out

def link_report(path):
    """each link: (page, rect, what it goes to, page it resolves to), resolving names by the tree's /Limits as a viewer
    does (qpdf's NameTree) and by the catalog /Dests"""
    import pikepdf
    out = []
    with pikepdf.open(path) as pdf:
        pages = {pg.objgen: i for i, pg in enumerate(pdf.pages)}
        nt = None
        try: nt = pikepdf.NameTree(pdf.Root.Names.Dests)
        except Exception: pass
        cat = pdf.Root.get("/Dests")
        def res(d):
            if isinstance(d, pikepdf.String):
                k = str(d)
                if nt is not None and k in nt: d = nt[k]
                else: return ("name " + k, None)
            elif isinstance(d, pikepdf.Name):
                k = str(d)
                if cat is not None and k in cat: d = cat[k]
                else: return ("name " + k, None)
            if isinstance(d, pikepdf.Dictionary) and "/D" in d: d = d.D
            try: return ("ok", pages.get(d[0].objgen))
            except Exception: return ("bad", None)
        for i, pg in enumerate(pdf.pages):
            for a in pg.obj.get("/Annots", []):
                if a.get("/Subtype") != "/Link": continue
                rect = [round(float(v)) for v in a.Rect]
                if "/Dest" in a: out.append((i, rect, "Dest", str(a.Dest), res(a.Dest)))
                elif "/A" in a and a.A.get("/S") == "/GoTo": out.append((i, rect, "GoTo", str(a.A.D), res(a.A.D)))
                elif "/A" in a: out.append((i, rect, str(a.A.get("/S")), str(a.A.get("/F", "")), (None, None)))
        outl = []
        try:
            with pdf.open_outline() as ol:
                for it in ol.root:
                    d = it.destination if it.destination is not None else (it.action.D if it.action is not None else None)
                    outl.append((it.title, str(d), res(d) if d is not None else None))
        except Exception as e: outl = ["ERR " + str(e)]
        tree_ok = True; tree_msg = ""
        try:
            keys = list(nt.keys()) if nt is not None else []
            if keys != sorted(keys, key=lambda s: s.encode("latin-1", "replace")): tree_ok = False; tree_msg = "names not sorted: %s" % keys
            def chk(node, lo=None, hi=None):
                nonlocal tree_ok, tree_msg
                if "/Limits" in node:
                    ks = []
                    def coll(n):
                        if "/Names" in n: ks.extend(str(n.Names[j]) for j in range(0, len(n.Names), 2))
                        for kid in n.get("/Kids", []): coll(kid)
                    coll(node)
                    lim = [str(node.Limits[0]), str(node.Limits[1])]
                    if ks and lim != [min(ks, key=lambda s: s.encode()), max(ks, key=lambda s: s.encode())]: tree_ok = False; tree_msg += " limits %s vs names %s;" % (lim, ks)
                for kid in node.get("/Kids", []): chk(kid)
            chk(pdf.Root.Names.Dests)
        except Exception as e: tree_ok = False; tree_msg = "ERR %s" % e
        return out, outl, (tree_ok, tree_msg)

def g_links():
    G = "links"; f = "links2.pdf"; p = F(f)
    L0, O0, T0 = link_report(p)
    C(G, f, "(fixture) the names tree is sorted with right /Limits", T0[0], "ok", T0[1])
    cp, r = redact(f, ["Ormskirk"], "links2_red")
    if not cp: C(G, f, "redact ran", False, "a copy", r.get("err")); return
    C(G, f, "pages 1 and 3 were marked", sorted(set(a["page"] for a in r["areas"])) == [0, 2], [0, 2], sorted(set(a["page"] for a in r["areas"])))
    ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)
    L1, O1, T1 = link_report(cp)
    C(G, f, "the copy's names tree is sorted with right /Limits (a viewer looks names up by them)", T1[0], "ok", T1[1])
    for (i, rect, kind, tgt, (st, pg)) in L0:
        now = [x for x in L1 if x[0] == i and x[1] == rect]
        if kind == "/GoToR":
            C(G, f, "p%d GoToR link to a file named with the word is dropped or no longer names it" % (i + 1), not now or "ormskirk" not in str(now).lower(), "dropped", now)
            continue
        if i == 3:
            C(G, f, "p%d link %s %s still goes to page %s" % (i + 1, kind, tgt, pg + 1), bool(now) and now[0][4][1] == pg, pg, [(x[3], x[4]) for x in now] or "link gone")
    d0, raw0 = dests_pdfinfo(p); d1, raw1 = dests_pdfinfo(cp)
    C(G, f, "pdfinfo -dests: no named place holds the word", not [k for k in d1 if "ormskirk" in k.lower()], "none", list(d1))
    C(G, f, "pdfinfo -dests: the same pages are named", sorted(d0.values()) == sorted(d1.values()), sorted(d0.values()), sorted(d1.values()))
    for (t0, d_, (st, pg)), o1 in zip(O0, O1 if isinstance(O1, list) else []):
        if isinstance(o1, str): continue
        C(G, f, "bookmark '%s' still goes to page %s" % (t0, pg + 1 if pg is not None else None), o1[2] is not None and o1[2][1] == pg, pg, o1)
        C(G, f, "bookmark '%s': title has no word" % t0, "ormskirk" not in o1[0].lower(), "no word", o1[0])
    qb = qdf(cp)
    C(G, f, "the word is nowhere in the copy's bytes", not leaks_in_bytes(qb, "Ormskirk"), "none", leaks_in_bytes(qb, "Ormskirk"))

# =====================================================================================================================
# 6. forms over two pages: only the marked page's fields made part of the page
# =====================================================================================================================
def fields_of(path):
    code = ("import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nf=r.get_fields() or {}\n"
            "print(json.dumps({k:(str(v.get('/V')) if v.get('/V') is not None else None) for k,v in f.items()}))")
    rr = run([sys.executable, "-I", "-c", code, path])
    try: return json.loads(rr.stdout)
    except Exception: return {"ERR": rr.stderr[-300:]}

def widgets(path):
    import pikepdf
    out = []
    with pikepdf.open(path) as pdf:
        for i, pg in enumerate(pdf.pages):
            for a in pg.obj.get("/Annots", []):
                if a.get("/Subtype") != "/Widget": continue
                nm = []; n = a
                while n is not None:
                    if "/T" in n: nm.append(str(n.T))
                    n = n.get("/Parent")
                out.append((i, ".".join(reversed(nm)), str(a.get("/AS", "")), "/P" in a and a.P.objgen == pg.obj.objgen))
        af = pdf.Root.get("/AcroForm")
        nf = len(af.Fields) if af is not None and "/Fields" in af else 0
    return out, nf

def g_forms():
    G = "forms"; f = "forms2.pdf"; p = F(f)
    f0 = fields_of(p); w0, _ = widgets(p)
    cp, r = redact(f, ["Ormskirk"], "forms2_red")
    if not cp: C(G, f, "redact ran", False, "a copy", r.get("err")); return
    C(G, f, "only page 1 was marked", sorted(set(a["page"] for a in r["areas"])) == [0], [0], sorted(set(a["page"] for a in r["areas"])))
    ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)
    f1 = fields_of(cp); w1, nf = widgets(cp)
    C(G, f, "page 1 (marked) has no widgets left", not [w for w in w1 if w[0] == 0], "none", [w for w in w1 if w[0] == 0])
    exp2 = sorted((w[1], w[2]) for w in w0 if w[0] == 1)
    got2 = sorted((w[1], w[2]) for w in w1 if w[0] == 1)
    C(G, f, "page 2 (not marked) keeps every widget, each in its field, its state kept", exp2 == got2, exp2, got2)
    for k in ("city", "ref", "choice", "pick", "addr.town", "agree"):
        C(G, f, "pypdf reads field '%s' with its value kept (%s)" % (k, f0.get(k)), k in f1 and f1[k] == f0.get(k), f0.get(k), f1.get(k, "absent"))
    for k in ("name", "addr.street"):
        C(G, f, "field '%s' (page 1 only) is no longer a field" % k, k not in f1, "absent", f1.get(k))
    t1 = ptext(cp, 1)
    for v in ("Alice Weaver", "REF-77", "12 Moor Lane"):
        C(G, f, "page 1 shows the value '%s' as page text" % v, v in t1, v, t1[:300])
    C(G, f, "page 1's own word is gone", "Ormskirk" not in t1, "gone", t1[:200])
    C(G, f, "the copy keeps an /AcroForm with fields", nf > 0, "> 0", nf)

def g_forms3():
    G = "forms"; f = "forms3.pdf"; p = F(f)
    cp, r = redact(f, ["Ormskirk"], "forms3_red")
    if not cp: C(G, f, "redact ran", False, "a copy", r.get("err")); return
    ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)
    qb = qdf(cp)
    C(G, f, "the word is nowhere in the copy's bytes (orphan field value, hidden widget's value, field name, tooltip)", not leaks_in_bytes(qb, "Ormskirk"), "none", leaks_in_bytes(qb, "Ormskirk"))
    f1 = fields_of(cp)
    C(G, f, "pypdf: no field name or value left holds the word", not [k for k, v in f1.items() if "ormskirk" in (k + str(v)).lower()], "none", f1)
    C(G, f, "pypdf: the field 'note' (no word in its name or value) is still a field", "note" in f1, "note", f1)

# =====================================================================================================================
# 7. forms nested deep
# =====================================================================================================================
def chain_depth(path, pg):
    import pikepdf
    with pikepdf.open(path) as d:
        cur = list(d.pages[pg].obj.Resources.XObject.values())[0]; n = 0
        while True:
            n += 1
            if cur.get("/Subtype") != "/Form": return (n, "a stream that is not a form: %s" % cur.read_bytes()[:30])
            r = cur.get("/Resources")
            if r is None or "/XObject" not in r: return (n, cur.read_bytes()[:40].decode("latin-1"))
            cur = list(r.XObject.values())[0]

def g_deep():
    G = "deep"
    for f, keep, depthword in (("deep256.pdf", ["Ambleside", "Coniston", "Eskdale", "Grasmere", "Keswick"], None),
                               ("deep257.pdf", ["Ambleside"], "Langdale"), ("deep_unmarked.pdf", ["Ambleside"], "Eskdale"), ("deep_unmarked70.pdf", ["Ambleside"], "Dalegarth")):
        p = F(f)
        t = ltext(f)
        alltxt = " ".join(x["text"] for x in t)
        for w in keep:
            C(G, f, "Text reading has '%s' (poppler reads it: %s)" % (w, w in ptext(p)), w in alltxt, w, alltxt[:200])
        C(G, f, "the form that draws itself is read once ('Mardale' x%d by poppler)" % ptext(p).count("Mardale"), alltxt.count("Mardale") == 1, 1, alltxt.count("Mardale"))
        cp, r = redact(f, ["Ormskirk"], f[:-4] + "_red")
        if f == "deep257.pdf":
            C(G, f, "Redact refuses with a message (a form 257 deep on the marked page)", cp is None and "256" in str(r.get("err")), "refused, says 256", r.get("err") if not cp else "a copy was made")
            if cp: C(G, f, "copy keeps 'Langdale' (257 deep)", "Langdale" in ptext(cp), "kept", "lost")
            continue
        if not cp:
            C(G, f, "Redact makes a copy (nothing deeper than 256 on a marked page)", False, "a copy", r.get("err")); continue
        C(G, f, "Redact makes a copy (nothing deeper than 256 on a marked page)", True, "a copy", "made")
        txt = ptext(cp)
        if f.startswith("deep_unmarked"):
            d0 = chain_depth(p, 1); d1 = chain_depth(cp, 1)
            C(G, f, "the unmarked page's forms nested %d deep are copied whole (each level a form, the word at the end)" % d0[0], d1 == d0, d0, d1)
        for w in keep + ([depthword] if depthword and "Eskdale" not in depthword else []):
            C(G, f, "copy keeps '%s' (poppler)" % w, w in txt, w, txt[:300])
        C(G, f, "copy: 'Ormskirk' gone", "Ormskirk" not in txt, "gone", "found")
        ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)

# =====================================================================================================================
# 8. fields with no appearance of their own, flattened
# =====================================================================================================================
def ink_glyph(png, rect_pts, dpi, page_h):
    from PIL import Image
    im = Image.open(png).convert("L"); s = dpi / 72.0
    x0, y0, x1, y1 = rect_pts
    crop = im.crop((int(x0 * s), int((page_h - y1) * s), int(x1 * s), int((page_h - y0) * s)))
    bb = crop.point(lambda v: 255 if v < 128 else 0).getbbox()
    if not bb: return None
    g = crop.crop(bb).resize((24, 24)).point(lambda v: 1 if v < 128 else 0)
    return list(g.getdata())

def iou(a, b):
    i_ = sum(1 for x, y in zip(a, b) if x and y); u = sum(1 for x, y in zip(a, b) if x or y)
    return i_ / u if u else 0

def g_flat():
    G = "flat"; f = "noap.pdf"
    r = browser("new").js(FLAT_JS, {"f": F(f)})
    if r.get("err"): C(G, f, "flatten ran", False, "a copy", r["err"]); return
    cp = save_b64(r["b64"], os.path.join(OUT, "noap_flat.pdf"))
    ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the flattened copy clean", ok, "clean", msg)
    dpi = 288
    png = render(cp, os.path.join(OUT, "noap_flat"), 1, dpi)
    # (poppler here has no ZapfDingbats to draw with: the letter drawn in each box is read with pdfplumber instead)
    code = ("import sys,json,pdfplumber\np=pdfplumber.open(sys.argv[1]).pages[0]\n"
            "print(json.dumps([[c['text'],c['fontname'],c['x0'],c['x1'],c['top'],c['bottom'],c['size']] for c in p.chars]))")
    rr = run([sys.executable, "-I", "-c", code, cp])
    try: chs = json.loads(rr.stdout)
    except Exception: chs = []
    def drawn(x0, y0, x1, y1):
        return [c for c in chs if x0 - 1 <= (c[2] + c[3]) / 2 <= x1 + 1 and 792 - y1 - 1 <= (c[4] + c[5]) / 2 <= 792 - y0 + 1]
    for k, ca in enumerate(["8", "4", "l", "n", "u", "H", None]):
        d = drawn(72 + 50 * k, 680, 92 + 50 * k, 700)
        want = [ca] if ca else ["4", "3"]
        C(G, f, "ticked box /MK /CA %s is drawn as ZapfDingbats %s, inside its box" % (ca, " or ".join(want)),
          len(d) == 1 and "Zapf" in d[0][1] and d[0][0] in want, want, d)
    C(G, f, "a box that is Off draws nothing", not drawn(422, 680, 442, 700), "nothing", drawn(422, 680, 442, 700))
    for k, ca in enumerate([None, "u"]):
        d = drawn(72 + 50 * k, 630, 92 + 50 * k, 650)
        want = ca or "l"
        C(G, f, "radio /MK /CA %s is drawn as ZapfDingbats '%s', inside its box" % (ca, want), len(d) == 1 and "Zapf" in d[0][1] and d[0][0] == want, want, d)
    # the list box: its choices in order, the chosen ones on a band
    ws, _ = bbox(cp)
    lb = [w for w in ws if 72 <= w[1] <= 232 and 792 - 580 <= w[2] <= 792 - 480]
    names = [w[0] for w in sorted(lb, key=lambda w: w[2])]
    C(G, f, "list box shows its choices in order from the first (poppler)", names[:4] == ["Apple", "Banana", "Cherry", "Damson"], ["Apple", "Banana", "Cherry", "Damson", "..."], names)
    from PIL import Image
    im = Image.open(png).convert("L"); s = dpi / 72.0
    def band(word):
        w = [x for x in lb if x[0] == word]
        if not w: return None
        x0, y0, x1, y1 = w[0][1:]
        # the background just right of the word, inside the box
        px = [im.getpixel((int(xx * s), int((y0 + y1) / 2 * s))) for xx in range(int(x1) + 4, 228)]
        return sum(px) / len(px)
    bands = {w: band(w) for w in ("Apple", "Banana", "Cherry", "Damson")}
    C(G, f, "list box: the chosen (Banana, Damson) on a band, the others not", all(v is not None for v in bands.values()) and bands["Banana"] < 200 and bands["Damson"] < 200 and bands["Apple"] > 240 and bands["Cherry"] > 240, "chosen < 200, others > 240 (mean grey right of the word)", bands)
    # the comb: a letter a cell (8 cells over 240 pt from x 72)
    code = ("import sys,json,pdfplumber\np=pdfplumber.open(sys.argv[1]).pages[0]\n"
            "print(json.dumps([[c['text'],c['x0'],c['x1'],c['top']] for c in p.chars]))")
    rr = run([sys.executable, "-I", "-c", code, cp])
    try: ch = [c for c in json.loads(rr.stdout) if 792 - 444 - 2 <= c[3] <= 792 - 420]
    except Exception: ch = []
    txt = "".join(c[0] for c in ch)
    C(G, f, "comb field: its letters AB12CD", txt == "AB12CD", "AB12CD", txt)
    if txt == "AB12CD":
        off = [round(((c[1] + c[2]) / 2) - (72 + 30 * (k + 0.5)), 1) for k, c in enumerate(ch)]
        C(G, f, "comb field: each letter centred in its cell (within 2 pt)", all(abs(o) <= 2 for o in off), "offsets 0", off)

# =====================================================================================================================
# 9. a sweep of the repository's own PDFs: r5 against r4 against poppler
# =====================================================================================================================
def g_sweep():
    G = "sweep"
    fs = sorted(glob.glob(os.path.join(FXROOT, "**", "*.pdf"), recursive=True))
    fs = [x for x in fs if "pdf_review5_1240" not in x and os.path.getsize(x) < 400000 and run(["qpdf", "--requires-password", x]).returncode != 0][:60]
    for f in fs:
        try:
            tn = ltext(f, "new"); to = ltext(f, "old")
        except Exception as e:
            C(G, os.path.relpath(f, FXROOT), "read by both", False, "read", str(e)[:200]); continue
        rel = os.path.relpath(f, FXROOT)
        for i, (a, b) in enumerate(zip(tn, to)):
            if a["text"] == b["text"]: continue
            pop = ptext(f, i + 1)
            pw = set(squeeze_words(pop)); an = set(squeeze_words(a["text"])); bo = set(squeeze_words(b["text"]))
            sn = len(an & pw) / max(1, len(an | pw)); so = len(bo & pw) / max(1, len(bo | pw))
            C(G, rel, "p%d reads differently from r4: r5 is as close to poppler's words (r5 %.3f, r4 %.3f)" % (i + 1, sn, so), sn >= so - 0.005,
              "r5 >= r4", "r5 only: %s | r4 only: %s" % (sorted(an - bo)[:15], sorted(bo - an)[:15]))
        C(G, rel, "read by r5 and r4 (%d pages)" % len(tn), len(tn) == len(to), len(to), len(tn))

if __name__ == "__main__":
    try:
        for g, fn in (("hyph", g_hyph), ("ls", g_ls), ("enc", g_enc), ("kept", g_kept), ("links", g_links), ("forms", g_forms), ("forms", g_forms3),
                      ("deep", g_deep), ("flat", g_flat), ("sweep", g_sweep)):
            if on(g):
                try: fn()
                except Exception as e:
                    import traceback; C(g, "-", "group ran to the end", False, "no error", traceback.format_exc()[-600:])
    finally:
        C.save()
        for b in _B.values(): b.close()
        pw_stop()
    n = len(C.rows); k = sum(1 for r in C.rows if not r["pass"])
    print("%d checks, %d failed" % (n, k))
