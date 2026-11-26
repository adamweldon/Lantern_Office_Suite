# run_review.py -- review 4 of 1.24.40's PDF tools. The PDFs are made by make_fixtures.py (programs that are not
# Lantern); every result is judged by programs that are not Lantern either: poppler (pdftotext -bbox-layout, -layout),
# pdfplumber, pypdf, pikepdf, qpdf, reportlab's Adobe metrics, and the fixture's own design (what was drawn where).
# Usage: python3 run_review.py <new.html> <old.html> [group ...]
#   groups: hyph ls fold std14 deep links forms sweep   (all when none given)
# Writes cases.json (a list of {group, file, check, expected, got, pass}) and prints PASS/FAIL lines.
import os, sys, json, re, time, glob, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "pdf_review3_1240"))
SCRATCH = "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad"
os.environ.setdefault("R3OUT", os.path.join(SCRATCH, "r4out"))
os.environ.setdefault("R3EV", os.path.join(HERE, "evidence"))
from r3lib import *                       # Browser, poppler helpers, leaks_in_bytes, fold/squeeze
HERE = os.path.dirname(os.path.abspath(__file__))   # (r3lib has a HERE of its own)
import r3lib
_sq = r3lib.squeeze
def squeeze(s): return _sq(s.replace('\u00ad', ''))   # Chromium writes U+00AD inside unbroken words; poppler passes it on
r3lib.squeeze = squeeze
import unicodedata
args = [a for a in sys.argv[1:] if a.endswith(".html")]
NEW = args[0] if args else os.path.join(SCRATCH, "lantern_1240_r4.html")
OLD = args[1] if len(args) > 1 else os.path.join(SCRATCH, "old_1239_index.html")
GROUPS = set(a for a in sys.argv[1:] if not a.endswith(".html"))
def on(g): return not GROUPS or g in GROUPS
C = Cases(os.environ.get("CJNAME") or os.path.join(HERE, "cases.json" if not GROUPS else "cases_%s.json" % "_".join(sorted(GROUPS))))   # (a replay writes its cases elsewhere: CJNAME)
FXROOT = os.path.join(ROOT, "tests", "fixtures")
def F(f): return f if os.path.isabs(f) else os.path.join(HERE, f)
_B = {}
def browser(which):
    if which not in _B:
        _B[which] = Browser(NEW if which == "new" else OLD, [HERE, OUT, "/"])
    return _B[which]

MARKS_JS = r"""
var pdf = await __open(a.f), out = {};
for (var i = 0; i < pdf.count; i++) { if (a.pages && a.pages.indexOf(i) < 0) continue;
  var bx = (await P.pageText(pdf, i)).boxes;
  for (var k = 0; k < a.words.length; k++) { var g = P.redactMarks(bx, a.words[k], true); (out[a.words[k]] = out[a.words[k]] || []); g.forEach(function (rs) { out[a.words[k]].push({page: i, rects: rs}); }); } }
return out;"""
TEXT_JS = r"""
var pdf = await __open(a.f), out = [];
for (var i = 0; i < pdf.count; i++) { if (a.pages && a.pages.indexOf(i) < 0) continue; var t = await P.pageText(pdf, i); out.push(t.text); }
return out;"""
REDACT_JS = r"""
var pdf = await __open(a.f), areas = [], t0 = Date.now();
for (var i = 0; i < pdf.count; i++) { var bx = (await P.pageText(pdf, i)).boxes;
  a.words.forEach(function (w) { P.redactMarks(bx, w, false).forEach(function (r) { areas.push({page: i, rect: r}); }); }); }
if (!areas.length) return {err: 'nothing marked', areas: []};
try { var b = await P.redact(pdf, {areas: areas, words: a.words}); return {b64: __b64(b), areas: areas, ms: Date.now() - t0}; }
catch (e) { return {err: String(e && e.stack || e), areas: areas}; }"""

def marks(f, words, pages=None, which="new"):
    return browser(which).js(MARKS_JS, {"f": F(f), "words": words, "pages": pages})
def ltext(f, which="new", pages=None):
    return browser(which).js(TEXT_JS, {"f": F(f), "pages": pages})
def redact(f, words, name):
    r = browser("new").js(REDACT_JS, {"f": F(f), "words": words})
    if r.get("err"): return None, r
    return save_b64(r["b64"], os.path.join(OUT, name + ".pdf")), r

def area(r): return max(0, r[2] - r[0]) * max(0, r[3] - r[1])
def inter(a, b): return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
def covered(box, rects):
    """the share of box (user space) under the rects (rects assumed not to overlap much)"""
    a = area(box)
    return min(1.0, sum(inter(box, r) for r in rects) / a) if a else 0

def poppler_places(path, page, target):
    """where poppler shows target on a page (1-based), as lists of word boxes in user space: on one line (letters poppler
    splits apart joined), and across a line break at a hyphen, the hyphen dropped or kept"""
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

def word_boxes(path, page, word):
    """poppler's boxes (user space) for a word as poppler splits words"""
    info = page_info(path, page - 1)
    ws, _ = bbox(path, page)
    return [shown_to_user_rect(info["crop"], info["rot"], w[1:]) for w in ws if fold(w[0]) == fold(word)]

def judge_marks(G, f, page, target, groups, expect_n, places, note=""):
    """count of places, each expected place's words covered, each mark on the word it is for"""
    gs = [g["rects"] for g in groups if g["page"] == page - 1]
    C(G, f, "p%d '%s': search finds %d place(s)%s" % (page, target, expect_n, note), len(gs) == expect_n, expect_n, "%d: %s" % (len(gs), [[[round(v) for v in r] for r in g] for g in gs])[:600])
    allr = [r for g in gs for r in g]
    for k, pl in enumerate(places):
        cov = [covered(b, allr) for b in pl]
        C(G, f, "p%d '%s': place %d (%s) has all its pieces marked" % (page, target, k + 1, "broken" if len(pl) > 1 else "one line"),
          all(c >= 0.6 for c in cov), ">= 0.6 of each piece's box", "%s pieces at %s" % ([round(c, 2) for c in cov], [[round(v) for v in b] for b in pl]))
    if places and len(places) == expect_n:
        stray = [r for r in allr if not any(inter(r, b) > 0.3 * area(r) for pl in places for b in pl)]
        C(G, f, "p%d '%s': every mark sits on the word (no stray marks)" % (page, target), not stray, "none", [[round(v) for v in r] for r in stray])

# =====================================================================================================================
# 1. words broken at a line's end
# =====================================================================================================================
NAMES = ["Featherstonehaugh", "electrohydraulic", "counterbalancing", "Pemberton", "Winterbourne", "Kirkstall", "decommissioning", "superintendent", "Ashworth-Bramley"]
DESIGN = {"h_lo.pdf": dict((w, 7) for w in NAMES), "h_chrome.pdf": dict([(w, 9) for w in NAMES] + [("AshworthBramley", 9)])}
def g_hyph():
    G = "hyph"; f = "h_rl.pdf"; p = F(f)
    words = ["Ashworth-Bramley", "AshworthBramley", "Pemberton", "Winterbourne", "Featherstonehaugh", "Hollingsworth", "Quarmby",
             "AshworthCarlton", "AshworthDunmore", "HollingsBramley", "prestart", "1020", "SmithJones", "QuenbyAshton", "Quenby-Ashton",
             "Ravensworth", "KirkbySeal", "AXSeal", "KirkbySettle", "BXHawes", "AXLonsdale"]
    m = marks(f, words)
    EXP = {  # by design (what was drawn): page -> {word: places}
        1: {"Ashworth-Bramley": 1, "AshworthBramley": 1, "Pemberton": 1, "Winterbourne": 1, "Featherstonehaugh": 1, "prestart": 0, "1020": 0, "SmithJones": 0},
        2: {"Ashworth-Bramley": 1, "AshworthBramley": 1, "Pemberton": 1, "Winterbourne": 1, "Featherstonehaugh": 1, "Hollingsworth": 1, "Quarmby": 1,
            "AshworthCarlton": 0, "AshworthDunmore": 0, "HollingsBramley": 0, "prestart": 0, "1020": 0, "SmithJones": 0},
        3: {"Ashworth-Bramley": 1, "Pemberton": 1, "Winterbourne": 1, "Featherstonehaugh": 1, "Hollingsworth": 1, "Quarmby": 1,
            "AshworthCarlton": 0, "AshworthDunmore": 0, "HollingsBramley": 0, "prestart": 0},
        4: {"Ashworth-Bramley": 1, "AshworthBramley": 1, "Pemberton": 1, "Winterbourne": 1, "QuenbyAshton": 1, "Quenby-Ashton": 1, "Ravensworth": 1,
            "KirkbySeal": 0, "AXSeal": 0},
    }
    halves = {"Ashworth-Bramley": ("Ashworth-", "Bramley,"), "AshworthBramley": ("Ashworth-", "Bramley,"), "Pemberton": ("Pember\u2010", "ton"),
              "Winterbourne": ("Winter\u2011", "bourne"), "Featherstonehaugh": ("Feather\u00ad", "stonehaugh"), "Hollingsworth": ("Hollings-", "worth"),
              "Quarmby": ("Quarm-", "by"), "QuenbyAshton": ("Quenby-", "Ashton"), "Quenby-Ashton": ("Quenby-", "Ashton"), "Ravensworth": ("Ravens-", "worth")}
    for pg, exp in EXP.items():
        for w, n in exp.items():
            places = []
            if n and w in halves:
                a_, b_ = halves[w]
                ba = word_boxes(p, pg, a_); bb = word_boxes(p, pg, b_)
                if pg == 4 and w in ("Pemberton", "Winterbourne"): a_, b_ = {"Pemberton": ("Pember-", "ton,"), "Winterbourne": ("Winter-", "bourne")}[w]; ba = word_boxes(p, pg, a_); bb = word_boxes(p, pg, b_)
                if pg == 4 and w in ("Ashworth-Bramley", "AshworthBramley"): bb = word_boxes(p, pg, "Bramley")
                if pg == 4 and w == "Ravensworth":  # "worth" is also in nothing else on page 4
                    pass
                if ba and bb:
                    a0 = ba[0]
                    if pg == 4 and w in ("QuenbyAshton", "Quenby-Ashton", "Ravensworth"): cand = bb
                    else: cand = [b for b in bb if 4 < a0[1] - b[1] < 25 and b[0] < a0[0]] or bb
                    places = [[a0, min(cand, key=lambda b: abs(a0[1] - b[1]))]]
            judge_marks(G, f, pg, w, m.get(w, []), n, places)
    # TeX, LibreOffice, Chromium: the places poppler shows
    for f, ws in (("h_tex.pdf", ["electrohydraulic", "recharacterisation", "reconfirmed", "commissioning", "depot", "Dunmore", "representatives", "Featherstonehaugh", "Winterbottom-Smythe", "WinterbottomSmythe",
                                 "Ashworth-Bramley", "AshworthBramley", "Pemberton", "Winterbourne", "1020", "Thornton"]),
                  ("h_lo.pdf", ["Featherstonehaugh", "electrohydraulic", "counterbalancing", "Pemberton", "Winterbourne", "Kirkstall", "decommissioning", "superintendent", "Ashworth-Bramley"]),
                  ("h_chrome.pdf", ["Featherstonehaugh", "electrohydraulic", "counterbalancing", "Pemberton", "Winterbourne", "Kirkstall", "decommissioning",
                                    "superintendent", "Ashworth-Bramley", "AshworthBramley", "QuenbyAshton", "Ravensworth", "1020", "SmithJones", "KirkbySeal", "AXSeal"])):
        p = F(f); m = marks(f, ws)
        for pg in range(1, npages(p) + 1):
            for w in ws:
                pl = poppler_places(p, pg, w)
                if not pl and not [g for g in m.get(w, []) if g["page"] == pg - 1]: continue
                n = len(pl); note = " (as poppler shows it)"
                if f in DESIGN and w in DESIGN[f]: n = DESIGN[f][w]; note = " (each paragraph has it once)"
                judge_marks(G, f, pg, w, m.get(w, []), n, pl, note)
    # redact the broken names in h_rl and look for their halves in the copy
    cp, r = redact("h_rl.pdf", ["Ashworth-Bramley", "Hollingsworth", "Pemberton", "QuenbyAshton"], "h_rl_red")
    if not cp: C(G, "h_rl.pdf", "redact the broken names ran", False, "a copy", r.get("err"))
    else:
        for pg in range(1, 5):
            t = ptext(cp, pg)
            for half in ("Ashworth", "Bramley", "Hollings", "Pember", "Quenby", "Ashton"):
                if pg == 1 and half == "Hollings": continue
                if pg == 4 and half == "Hollings": continue
                if pg == 1 and half in ("Quenby", "Ashton"): continue
                if pg in (2, 3) and half in ("Quenby", "Ashton"): continue
                C(G, "h_rl.pdf", "p%d redacted copy: '%s' is not in poppler's text" % (pg, half), squeeze(half) not in squeeze(t), "gone",
                  [l for l in t.split("\n") if squeeze(half) in squeeze(l)][:2])
            for keep in ("Philippa", "Dunmore", "Carlton"):
                if pg in (2, 3):
                    C(G, "h_rl.pdf", "p%d redacted copy: '%s' is kept" % (pg, keep), squeeze(keep) in squeeze(t), "kept", "missing")

# =====================================================================================================================
# 2. letters one at a time read as words; single signs not joined
# =====================================================================================================================
LS_EXPECT = {
    "ls_chrome.pdf": ["WAREHOUSE NORTH (0.05em)", "Loading Bay Seven (0.1em)", "CALDERDALE DEPOT (0.2em)", "Mossley Works (0.35em)", "HEBDEN BRIDGE (0.5em)",
                      "TODMORDEN (0.75em)", "SOWERBY (1em)", "Plain line: the pump at Ripponden runs well.", "Pins 1 2 3 4 5", "Keys: A B C D", "Code: 4 7 1 9 2",
                      "Check: a + b = c and x = y + 2", "U \u2264 230 V, I \u2265 2 A",
                      "Grades: A B C D E", "BLOCK A AND B (0.3em)", "Files a b c d e f g h", "Row: Q W E R T Y", "Answer: A B C or D", "Vitamins A B C and E were listed.", "Initials J R R T Tolkien", "Axes x y z", "Sizes: S M L XL", "Choose one of A B C D E and F.", "Rows a b c d e f in the grid."],
    "ls_lo.pdf": ["Grades: A B C D E", "Answer: A B C or D", "Vitamins A B C and E were listed.", "Initials J R R T Tolkien", "Axes x y z", "WAREHOUSE NORTH spaced in Writer"],
    "ls_rl.pdf": ["WAREHOUSE NORTH", "Mossley Works", "Pins: 1 2 3 4 5", "Keys: A B C D", "Code: 4 7 1 9 2", "Grid: X O X O X", "Plain line: the pump at Ripponden runs well."],
    "ls_tex.pdf": ["AVATAR WAVY TOWARD Yorkshire VAT Toyota Wolverhampton.", "WAREHOUSE NORTH and Calderdale letter-spaced.", "Check: a + b = c and x = y + 2 and U \u2264 230 V.",
                   "Pins 1 2 3 4 5", "Keys A B C D", "Office affine fluent waffle effort shuffle."],
    "ls_xe.pdf": ["Supply: U \u2264 230 V, I \u2265 2 A, f = 50 Hz \u00b1 1 %.", "Check: a + b = c and x = y + 2.", "Pins 1 2 3 4 5", "Keys A B C D",
                  "Plain line: the pump at Ripponden runs well."],
}
BEYOND = {("ls_tex.pdf", "WAREHOUSE NORTH and Calderdale letter-spaced."), ("ls_lo.pdf", "WAREHOUSE NORTH spaced in Writer")}   # letter-spacing not made by a browser: beyond what the rule names
def find_tokens(text, expected):
    """the run of tokens on one of the text's lines that spells the expected line (spaces ignored), or None"""
    t = squeeze(expected)
    for ln in text.split("\n"):
        toks = ln.split()
        for i in range(len(toks)):
            s = ""
            for j in range(i, len(toks)):
                s += squeeze(toks[j])
                if s == t: return toks[i:j + 1]
                if not t.startswith(s): break
    return None

def g_ls():
    G = "ls"
    for f, lines in LS_EXPECT.items():
        tn = "\n".join(ltext(f, "new")); to = "\n".join(ltext(f, "old")); tp = ptext(F(f))
        for e in lines:
            exp = e.split()
            gn = find_tokens(tn, e); go = find_tokens(to, e); gp = find_tokens(tp, e)
            note = " (beyond the rule: not a browser's letter-spacing)" if (f, e) in BEYOND else ""
            C(G, f, "Text reading of '%s' has its words as written%s" % (e, note), gn == exp, " | ".join(exp),
              "new: %s ;; old 1.24.39: %s ;; poppler: %s" % (" | ".join(gn) if gn else "(not found as one line)", " | ".join(go) if go else "(not found)", " | ".join(gp) if gp else "(not found)"))

# =====================================================================================================================
# 3. search folding, and kept words in a redacted copy
# =====================================================================================================================
FOLD_EXP = {"istanbul": 4, "\u0130STANBUL": 4, "ISTANBUL": 4, "\u0131stanbul": 4, "\u0130zmir": 1, "izmir": 1,
            "\u03a0\u0391\u03a0\u0391\u0394\u039f\u03a0\u039f\u03a5\u039b\u039f\u03a3": 2, "\u03a0\u03b1\u03c0\u03b1\u03b4\u03cc\u03c0\u03bf\u03c5\u03bb\u03bf\u03c2": 2,
            "\u03c0\u03b1\u03c0\u03b1\u03b4\u03bf\u03c0\u03bf\u03c5\u03bb\u03bf\u03c3": 2, "\u03a0\u03a1\u039f\u03aa\u039f\u039d": 2, "\u03c0\u03c1\u03bf\u03b9\u03bf\u03bd": 2,
            "ffort": 1, "finance": 1, "fluent": 1, "ffice": 2, "ffle": 1, "stop": 1, "step": 1,
            "Ren\u00e9": 2, "Fern\u00e1ndez": 2, "Caf\u00e9": 1, "\u03b1\u03bb\u03c6\u03b1": 1, "na\u00efve": 1}
KEEP = ["\u0130STANBUL", "\u0130stanbul", "Istanbul", "\u0131stanbul", "\u03a0\u0391\u03a0\u0391\u0394\u039f\u03a0\u039f\u03a5\u039b\u039f\u03a3",
        "\u03a0\u03b1\u03c0\u03b1\u03b4\u03cc\u03c0\u03bf\u03c5\u03bb\u03bf\u03c2", "\u03a0\u03a1\u039f\u03aa\u039f\u039d", "\u03c0\u03c1\u03bf\u03ca\u03cc\u03bd",
        "Ren\u00e9", "Fern\u00e1ndez", "Caf\u00e9", "S\u00e3o", "na\u00efve", "\u00c5ngstr\u00f6m", "\u03ac\u03bb\u03c6\u03b1", "\u0130zmir", "finance", "fluent"]
def nfc(s): return unicodedata.normalize("NFC", s)
def nfkc(s): return unicodedata.normalize("NFKC", s)
def g_fold():
    G = "fold"
    for f in ("fold_rl.pdf", "fold_xe.pdf"):
        p = F(f); m = marks(f, list(FOLD_EXP))
        for w, n in FOLD_EXP.items():
            gs = m.get(w, [])
            note = " (the PDF's text says \u017ft, long s and t, for U+FB05)" if (f == "fold_xe.pdf" and w == "stop") else ""
            C(G, f, "search '%s' finds %d place(s)%s" % (w, n, note), len(gs) == n, n, len(gs))
        # the mark over a letter written e + U+0301 covers the letter and its accent (pdfplumber's letter boxes)
        code = ("import sys,json,pdfplumber\np=pdfplumber.open(sys.argv[1]).pages[0]\n"
                "print(json.dumps([[c['text'],c['x0'],c['top'],c['x1'],c['bottom']] for c in p.chars]))")
        ch = json.loads(run([sys.executable, "-I", "-c", code, p]).stdout or "[]")
        H = page_info(p)["media"][3]
        s = "".join(c[0] for c in ch)
        for word in ("Rene\u0301", "Ferna\u0301ndez", "Cafe\u0301"):
            at = s.find(word)
            if at < 0: continue   # (xelatex composes e + U+0301 into one letter: only fold_rl tries a letter written as two)
            letters = ch[at:at + len(word)]
            acc = [c for c in letters if c[0] == "\u0301"][0]
            base = letters[[c[0] for c in letters].index("\u0301") - 1]
            gs = [g["rects"] for g in m.get(nfc(word), []) if any(inter(r, [acc[1] - 0.1, H - acc[4], acc[3] + 0.1, H - acc[2]]) > 0 or inter(r, [base[1], H - base[4], base[3], H - base[2]]) > 0 for r in g["rects"])]
            allr = [r for g in gs for r in g]
            bx0 = min(c[1] for c in letters); bx1 = max(c[3] for c in letters)
            okx = bool(allr) and min(r[0] for r in allr) <= bx0 + 0.5 and max(r[2] for r in allr) >= max(bx1, base[3], acc[3]) - 0.5
            C(G, f, "the mark for '%s' (accent a letter of its own) covers the whole word, the accented letter to its right edge" % nfc(word), okx,
              "x %.1f..%.1f (accent %.1f..%.1f)" % (bx0, bx1, acc[1], acc[3]), [[round(v, 1) for v in r] for r in allr])
        # redact another word; the kept words' text in the copy, accents on the right letters
        cp, r = redact(f, ["Ormskirk"], f[:-4] + "_red_orm")
        if not cp: C(G, f, "redact 'Ormskirk' ran", False, "a copy", r.get("err")); continue
        for name, txt in (("poppler", ptext(cp)), ("pypdf", pypdf_text(cp))):
            tN = nfc(txt); tK = nfkc(txt)
            C(G, f, "copy without Ormskirk: '%s' not in %s" % ("Ormskirk", name), "ormskirk" not in txt.lower(), "gone", "present")
            orig = nfc(ptext(p)) if name == "poppler" else nfc(pypdf_text(p))
            for k in KEEP:
                if nfc(k) not in orig and nfkc(k) not in nfkc(orig): continue   # the oracle does not read it in the original either
                C(G, f, "copy without Ormskirk: %s still reads '%s'" % (name, k), nfc(k) in tN or nfkc(k) in tK, k,
                  [l for l in tN.split("\n") if squeeze(k)[:3] in squeeze(l)][:2])
        cp, r = redact(f, ["\u03a0\u03b1\u03c0\u03b1\u03b4\u03cc\u03c0\u03bf\u03c5\u03bb\u03bf\u03c2", "Ren\u00e9"], f[:-4] + "_red_greek")
        if not cp: C(G, f, "redact the Greek name and Ren\u00e9 ran", False, "a copy", r.get("err")); continue
        t = ptext(cp); qb = qdf(cp)
        for w in ("\u03a0\u0391\u03a0\u0391\u0394\u039f\u03a0\u039f\u03a5\u039b\u039f\u03a3", "\u03a0\u03b1\u03c0\u03b1\u03b4\u03cc\u03c0\u03bf\u03c5\u03bb\u03bf\u03c2", "Ren\u00e9", "Rene\u0301"):
            C(G, f, "copy: '%s' not in poppler's text" % w, squeeze(w) not in squeeze(t) and nfc(w) not in nfc(t), "gone", [l for l in t.split("\n") if nfc(w) in nfc(l)][:2])
            C(G, f, "copy: '%s' not in the file's bytes" % w, not leaks_in_bytes(qb, w), "none", leaks_in_bytes(qb, w))
        for k in ("Fern\u00e1ndez", "Caf\u00e9", "\u03ac\u03bb\u03c6\u03b1", "\u0130zmir", "S\u00e3o"):
            C(G, f, "copy without the Greek name and Ren\u00e9: poppler still reads '%s'" % k, nfc(k) in nfc(t), k, [l for l in nfc(t).split("\n") if squeeze(k)[:3] in squeeze(l)][:2])

# =====================================================================================================================
# 4. standard fonts with no /Widths
# =====================================================================================================================
WORDS_JS = r"""
var pdf = await __open(a.f), t = await P.pageText(pdf, 0), out = [];
t.boxes.forEach(function (ln) { (ln.parts || []).forEach(function (p) { var s = p.text, i = 0;
  while (i < s.length) { while (i < s.length && /\s/.test(s.charAt(i))) i++; var j = i; while (j < s.length && !/\s/.test(s.charAt(j))) j++;
    if (j > i) out.push({w: s.slice(i, j), x0: p.cx ? p.cx[i] : null, x1: p.cx ? p.cx[j] : null, y: p.y}); i = j; } }); });
return {words: out, text: t.text};"""
def g_std14():
    G = "std14"; f = "std14.pdf"; p = F(f)
    r = browser("new").js(WORDS_JS, {"f": p})
    ws, (W, H) = bbox(p, 1)
    lw = r["words"]
    fonts = ["Helvetica", "Times-Roman", "Courier", "Helvetica-Bold", "Times-Italic", "Helvetica-Oblique", "Times-Roman, built-in encoding (fi \\256, fl \\257)", "Courier, built-in encoding (fi \\256, fl \\257)"]
    # poppler's words in order; pair them with Lantern's by order on each line (same y)
    used = set(); bad = {}
    for w in ws:
        y = H - w[4]
        cands = [k for k, l in enumerate(lw) if k not in used and nfkc(l["w"]) == nfkc(w[0]) and l["x0"] is not None and abs(l["x0"] - w[1]) < 30 and abs(l["y"] - y) < 6]
        if not cands: bad.setdefault("unmatched", []).append(w[0]); continue
        k = min(cands, key=lambda k: abs(lw[k]["x0"] - w[1])); used.add(k); l = lw[k]
        line = int(round((740 - l["y"]) / 18.0)); fi = fonts[min(7, int((740 - l["y"]) // 62))]
        d0, d1 = l["x0"] - w[1], l["x1"] - w[3]
        if abs(d0) > 0.6 or abs(d1) > 0.6: bad.setdefault(fi, []).append("%s x0 %+.1f x1 %+.1f" % (w[0], d0, d1))
    for fi in fonts:
        C(G, f, "%s with no /Widths: each word's left and right edge where poppler puts it (within 0.6 pt)" % fi, fi not in bad, "all within 0.6", bad.get(fi, []))
    C(G, f, "every poppler word has a Lantern word to match", "unmatched" not in bad, "none", bad.get("unmatched", []))
    pt = [l.strip() for l in ptext(p).split("\n") if l.strip()]
    lt = [l.strip() for l in r["text"].split("\n") if l.strip()]
    diff = [(a_, b_) for a_, b_ in zip(pt, lt) if nfkc(a_) != nfkc(b_)]
    C(G, f, "Text reading equals poppler's lines (fi fl ff ffi ffl as letters)", not diff and len(pt) == len(lt), "the same lines", diff[:4] or (len(pt), len(lt)))
    # the redact mark for the word after ffl sits on it
    m = marks(f, ["Ormskirk", "after"])
    for w in ("Ormskirk", "after"):
        pb = word_boxes(p, 1, w)
        gs = m.get(w, [])
        C(G, f, "'%s' found %d times" % (w, len(pb)), len(gs) == len(pb), len(pb), len(gs))
        offs = []
        for b in pb:
            best = max((covered(b, g["rects"]) for g in gs), default=0)
            if best < 0.8: offs.append(([round(v) for v in b], round(best, 2)))
        C(G, f, "each '%s' is covered by its mark (>= 0.8 of poppler's box)" % w, not offs, "all covered", offs)

# =====================================================================================================================
# 5. deep and looping forms
# =====================================================================================================================
def g_deep():
    G = "deep"; f = "deep.pdf"; p = F(f)
    B = browser("new")
    t0 = time.time()
    try:
        r = B.js("var pdf = await __open(a.f); var t = await P.pageText(pdf, 0); var cv = await P.pageDraw(pdf, 0, {scale: 1}); return {text: t.text, w: cv.width, png: __png(cv)};", {"f": p}, timeout=90000)
        ok = True
    except Exception as e:
        r = {"text": "", "err": str(e)[:300]}; ok = False
    dt = time.time() - t0
    C(G, f, "read and drawn without hanging (< 60 s)", ok and dt < 60, "< 60 s", "%.1f s %s" % (dt, r.get("err", "")))
    txt = r.get("text", "")
    pp = ptext(p)
    for d, nm in ((1, "Ambleside"), (2, "Bowness"), (10, "Coniston"), (32, "Dalegarth"), (48, "Eskdale"), (63, "Grasmere"), (64, "Hawkshead"),
                  (65, "Ireby"), (66, "Keswick"), (70, "Langdale")):
        note = "" if d <= 64 else " (deeper than the claimed 64; poppler reads it)"
        C(G, f, "a word in a form %d deep is read (%s)%s" % (d, nm, note), nm in txt, "read" + (" (poppler: %s)" % ("yes" if nm in pp else "no")), "missing")
    for nm in ("Mardale", "Patterdale", "Glenridding", "Troutbeck", "Windermere"):
        C(G, f, "'%s' (a form that draws itself / a ring / the page) is read once" % nm, txt.count(nm) == 1, 1, txt.count(nm))
    if r.get("png"):
        save_b64(r["png"], os.path.join(OUT, "deep_lantern.png"))
    # redact a page word and a word 63 deep, then look at what is left
    t0 = time.time()
    try:
        cp, rr = redact(f, ["Ormskirk", "Grasmere", "Mardale"], "deep_red")
    except Exception as e:
        cp, rr = None, {"err": str(e)[:300]}
    dt = time.time() - t0
    C(G, f, "redacted without hanging (< 60 s)", cp is not None and dt < 60, "a copy in < 60 s", "%.1f s %s" % (dt, (rr or {}).get("err", "")))
    if cp:
        ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)
        tc = ptext(cp)
        for w in ("Ormskirk", "Grasmere", "Mardale"):
            C(G, f, "copy: '%s' gone from poppler's text" % w, w not in tc, "gone", "present")
            C(G, f, "copy: '%s' not in the file's bytes" % w, not leaks_in_bytes(qdf(cp), w), "none", leaks_in_bytes(qdf(cp), w))
        for w in ("Ambleside", "Bowness", "Coniston", "Dalegarth", "Eskdale", "Hawkshead", "Ireby", "Keswick", "Langdale", "Patterdale", "Glenridding", "Troutbeck", "Windermere"):
            C(G, f, "copy keeps '%s' (as poppler reads the original)%s" % (w, "" if w not in ("Ireby", "Keswick", "Langdale") else " (deeper than 64)"), w in tc, "kept", "lost")
        # the copy's picture: the depth-70 line still drawn? (OCR of the copy's page, the line's region)
        png = render(cp, os.path.join(OUT, "deep_red_p1"), 1, 150)
        o = ocr(png, psm="6")
        for w in ("Langdale", "Keswick", "Hawkshead", "Windermere"):
            C(G, f, "copy's picture shows '%s' (tesseract)" % w, ocr_has(o, w) is not None, "shown", "not seen by OCR")

# =====================================================================================================================
# 6. links, destinations, bookmarks
# =====================================================================================================================
from urllib.parse import unquote
def dest_page(pdf, d, names, cat):
    """the page index a destination goes to: an array, a name (catalog /Dests), a string (the /Names tree)"""
    import pikepdf
    if isinstance(d, pikepdf.Dictionary) and "/D" in d: d = d.D
    if isinstance(d, pikepdf.Array): return [p.objgen for p in pdf.pages].index(d[0].objgen)
    if isinstance(d, pikepdf.Name): v = cat.get(str(d)); return dest_page(pdf, v, names, cat) if v is not None else None
    if isinstance(d, pikepdf.String): v = names.get(bytes(d)); return dest_page(pdf, v, names, cat) if v is not None else None
    return None
def dests_of(pdf):
    import pikepdf
    names = {}
    def walk(n):
        if "/Names" in n:
            a = n.Names
            for i in range(0, len(a), 2): names[bytes(a[i])] = a[i + 1]
        for k in n.get("/Kids", []): walk(k)
    if "/Names" in pdf.Root and "/Dests" in pdf.Root.Names: walk(pdf.Root.Names.Dests)
    cat = {k: v for k, v in pdf.Root.Dests.items()} if "/Dests" in pdf.Root else {}
    return names, cat
def link_targets(path):
    import pikepdf
    out = []
    with pikepdf.open(path) as pdf:
        names, cat = dests_of(pdf)
        for i, p in enumerate(pdf.pages):
            for a in p.obj.get("/Annots", []):
                if a.get("/Subtype") != "/Link": continue
                rect = [round(float(v)) for v in a.Rect]
                if "/A" in a and a.A.get("/S") == "/URI": out.append((i, rect, "uri", str(a.A.URI)))
                elif "/Dest" in a: out.append((i, rect, "goto", dest_page(pdf, a.Dest, names, cat)))
                elif "/A" in a and a.A.get("/S") == "/GoTo": out.append((i, rect, "goto", dest_page(pdf, a.A.D, names, cat)))
        return out, {k.decode("latin-1"): dest_page(pdf, v, names, cat) for k, v in names.items()}, {k: dest_page(pdf, v, names, cat) for k, v in cat.items()}
def outline_of(path):
    code = ("import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nout=[]\n"
            "def w(o):\n  for x in o:\n    if isinstance(x,list): w(x)\n    else: out.append([x.title, r.get_destination_page_number(x)])\n"
            "w(r.outline)\nprint(json.dumps(out))")
    rr = run([sys.executable, "-I", "-c", code, path])
    try: return json.loads(rr.stdout)
    except Exception: return "ERR " + rr.stderr[-400:]
def g_links():
    G = "links"; f = "links.pdf"; p = F(f)
    cp, r = redact(f, ["Ormskirk"], "links_red")
    if not cp: C(G, f, "redact 'Ormskirk' ran", False, "a copy", r.get("err")); return
    C(G, f, "only page 1 was marked", sorted(set(a["page"] for a in r["areas"])) == [0], [0], sorted(set(a["page"] for a in r["areas"])))
    ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)
    L0, N0, D0 = link_targets(p); L1, N1, D1 = link_targets(cp)
    for (i, rect, kind, tgt) in L0:
        if kind != "uri": continue
        has = "ormskirk" in unquote(tgt).lower()
        kept = [x for x in L1 if x[0] == i and x[2] == "uri" and x[3] == tgt]
        if has: C(G, f, "p%d link to %s (holds the word) is dropped" % (i + 1, tgt), not kept, "dropped", "kept")
        elif i != 0: C(G, f, "p%d link to %s (no word, page not marked) is kept" % (i + 1, tgt), bool(kept), "kept", "dropped")
    left = [x for x in L1 if x[2] == "uri" and "ormskirk" in unquote(x[3]).lower()]
    C(G, f, "no link address left holds the word (percent-decoded)", not left, "none", left)
    for (i, rect, kind, tgt) in L0:
        if kind != "goto": continue
        now = [x for x in L1 if x[0] == i and x[2] == "goto" and x[1] == rect]
        C(G, f, "p%d link at %s still goes to page %s" % (i + 1, rect, None if tgt is None else tgt + 1), bool(now) and now[0][3] == tgt, tgt, [x[3] for x in now])
    C(G, f, "/Names /Dests: no name holds the word", not [k for k in N1 if "ormskirk" in k.lower()], "none", list(N1))
    C(G, f, "catalog /Dests: no name holds the word", not [k for k in D1 if "ormskirk" in k.lower()], "none", list(D1))
    C(G, f, "/Names /Dests: the same pages are named", sorted(N0.values()) == sorted(N1.values()), sorted(N0.values()), sorted(N1.values()))
    C(G, f, "catalog /Dests: the same pages are named", sorted(D0.values()) == sorted(D1.values()), sorted(D0.values()), sorted(D1.values()))
    o0 = outline_of(p); o1 = outline_of(cp)
    C(G, f, "the copy's outline is read by pypdf", isinstance(o1, list) and len(o1) == len(o0), len(o0), o1 if not isinstance(o1, list) else len(o1))
    if isinstance(o1, list) and isinstance(o0, list):
        for (t0_, p0), (t1_, p1) in zip(o0, o1):
            C(G, f, "bookmark '%s' still goes to page %s" % (t0_, p0 + 1 if p0 is not None else None), p0 == p1, p0, p1)
            if "ormskirk" in t0_.lower():
                rest = re.sub("(?i)ormskirk", "", t0_)
                C(G, f, "bookmark '%s': the word is replaced by three block letters, the rest kept" % t0_,
                  "ormskirk" not in t1_.lower() and len(t1_) == len(rest) + 3 and t1_.replace("\u2588", "").replace("\u25a0", "").replace("X", "") .strip() == rest.replace("  ", " ").strip() or
                  ("ormskirk" not in t1_.lower() and re.sub(r"[\u2588\u25a0\u2587]{3}", "", t1_) == rest), "word -> 3 block letters; rest '%s'" % rest, t1_)
            else:
                C(G, f, "bookmark '%s' keeps its title" % t0_, t0_ == t1_, t0_, t1_)
    qb = qdf(cp)
    C(G, f, "the word is nowhere in the copy's bytes (latin-1, UTF-16, shown strings)", not leaks_in_bytes(qb, "Ormskirk"), "none", leaks_in_bytes(qb, "Ormskirk"))
    low = qb.decode("latin-1").lower()
    for enc in ("%4frmskirk", "o%72mskirk", "ormskirk"):
        C(G, f, "the copy's bytes have no '%s' (any case)" % enc, enc not in low, "none", "found at %d" % low.find(enc))
    pt = ptext(cp, 1)
    C(G, f, "page 1's other words still searchable in the copy", "farm" in pt and "Visit our map" in pt, "farm, Visit our map", pt[:200])

# =====================================================================================================================
# 7. forms
# =====================================================================================================================
def fields_of(path):
    code = ("import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nf=r.get_fields() or {}\n"
            "print(json.dumps({k:(str(v.get('/V')) if v.get('/V') is not None else None) for k,v in f.items()}))")
    rr = run([sys.executable, "-I", "-c", code, path])
    try: return json.loads(rr.stdout)
    except Exception: return {"ERR": rr.stderr[-300:]}
def widgets_by_page(path):
    import pikepdf
    with pikepdf.open(path) as pdf:
        return [[str(a.get("/T", a.get("/Parent", {}).get("/T", "?"))) for a in p.obj.get("/Annots", []) if a.get("/Subtype") == "/Widget"] for p in pdf.pages]
def g_forms():
    G = "forms"
    from reportlab.pdfbase.pdfmetrics import stringWidth
    # a form whose fields are all on a page not marked (review 3's Acrobat-style f_acro after a cover page)
    f = "forms_acro2.pdf"; p = F(f); before = fields_of(p)
    cp, r = redact(f, ["Ormskirk"], "forms_acro2_red")
    if not cp: C(G, f, "redact 'Ormskirk' on the cover page ran", False, "a copy", r.get("err"))
    else:
        after = fields_of(cp); wb = widgets_by_page(cp)
        C(G, f, "the form on the unmarked page 2 is still a form, every field kept", sorted(after) == sorted(before) and len(before) > 0, sorted(before), sorted(after))
        C(G, f, "page 2 keeps its widgets", len(wb) > 1 and len(wb[1]) == len(widgets_by_page(p)[1]), len(widgets_by_page(p)[1]), [len(x) for x in wb])
    for f in ("forms_rl.pdf", "forms_noap.pdf"):
        p = F(f)
        m = marks(f, ["Ormskirk", "Farm", "Wigan"])
        gs = [g for g in m.get("Ormskirk", [])]
        C(G, f, "search finds 'Ormskirk' in the field value on page 1", len(gs) == 1 and gs[0]["page"] == 0, "1 on page 1", [(g["page"], [[round(v, 1) for v in r] for r in g["rects"]]) for g in gs])
        # where the value is drawn: reportlab's appearance (poppler after qpdf flattens it), or for no appearance: Helvetica 12's width
        if gs:
            r0 = gs[0]["rects"][0]; wd = stringWidth("Ormskirk", "Helvetica", 12)
            if f == "forms_rl.pdf":
                fl = os.path.join(OUT, "forms_rl_flat.pdf"); run(["qpdf", "--flatten-annotations=all", p, fl])
                pb = word_boxes(fl, 1, "Ormskirk")
                ok = bool(pb) and abs(r0[0] - pb[0][0]) < 1.5 and abs(r0[2] - pb[0][2]) < 1.5
                C(G, f, "the mark is where the appearance draws the word (poppler, within 1.5 pt)", ok, [round(v, 1) for v in pb[0]] if pb else "?", [round(v, 1) for v in r0])
            ok = (r0[2] - r0[0]) <= wd + 3 and (r0[2] - r0[0]) >= wd - 1 and r0[0] >= 120 and r0[2] <= 380
            C(G, f, "the mark is the word's width by Helvetica's metrics (%.1f pt, + padding) and inside the field" % wd, ok, "%.1f..%.1f wide, in 120..380" % (wd - 1, wd + 3), "%.1f wide at %.1f..%.1f" % (r0[2] - r0[0], r0[0], r0[2]))
        C(G, f, "'Wigan' (a field on page 2) is found on page 2", [g["page"] for g in m.get("Wigan", [])] == [1], [1], [g["page"] for g in m.get("Wigan", [])])
        cp, r = redact(f, ["Ormskirk"], f[:-4] + "_red")
        if not cp: C(G, f, "redact 'Ormskirk' ran", False, "a copy", r.get("err")); continue
        ok, msg = qcheck(cp); C(G, f, "qpdf --check finds the copy clean", ok, "clean", msg)
        fl = fields_of(cp); wb = widgets_by_page(cp)
        C(G, f, "page 2's fields are still a working form (city = Wigan Pier, agreed)", fl.get("city") == "Wigan Pier" and "agreed" in fl, "city=Wigan Pier, agreed", fl)
        C(G, f, "page 2 still has its widgets", len(wb) > 1 and len(wb[1]) == 2, 2, wb)
        C(G, f, "page 1 (marked) has no widgets left", len(wb) > 0 and not wb[0], [], wb[0] if wb else "?")
        C(G, f, "no field left holds the word", not [k for k, v in fl.items() if v and "ormskirk" in v.lower()], "none", fl)
        qb = qdf(cp)
        C(G, f, "the word is nowhere in the copy's bytes", not leaks_in_bytes(qb, "Ormskirk"), "none", leaks_in_bytes(qb, "Ormskirk"))
        t1 = ptext(cp, 1)
        C(G, f, "page 1's other words and values still searchable in the copy (Owner:, Farm Ltd, 01695)", all(x in t1 for x in ("Owner:", "Farm", "01695")), "all", t1[:300])
    # only page 2 marked (a word of its own, not in a field): page 1's fields are on a page not marked
    f = "forms_rl.pdf"; p = F(f)
    cp, r = redact(f, ["site"], "forms_rl_red_p2only")
    if not cp: C(G, f, "redact 'site' (page 2 only) ran", False, "a copy", r.get("err"))
    else:
        C(G, f, "only page 2 was marked", sorted(set(a["page"] for a in r["areas"])) == [1], [1], sorted(set(a["page"] for a in r["areas"])))
        fl = fields_of(cp); wb = widgets_by_page(cp)
        C(G, f, "page 2 marked: page 1's fields are still a working form (owner, phone, notes)", all(k in fl for k in ("owner", "phone", "notes")) and fl.get("owner") == "Ormskirk Farm Ltd", "owner=Ormskirk Farm Ltd, phone, notes", fl)
        C(G, f, "page 2 marked: page 1 still has its 3 widgets", len(wb) > 0 and len(wb[0]) == 3, 3, wb)

# =====================================================================================================================
# sweep: earlier fixtures read by both builds against poppler
# =====================================================================================================================
def bag(s): return [squeeze(w) for w in s.split() if squeeze(w)]
def f1(a, b):
    from collections import Counter
    ca, cb = Counter(a), Counter(b); inter_ = sum((ca & cb).values())
    if not a and not b: return 1.0
    if not inter_: return 0.0
    pr = inter_ / max(1, sum(ca.values())); rc = inter_ / max(1, sum(cb.values()))
    return 2 * pr * rc / (pr + rc)
def g_sweep():
    G = "sweep"
    files = sorted(glob.glob(os.path.join(FXROOT, "**", "*.pdf"), recursive=True))
    files = [x for x in files if "pdf_review4_1240" not in x and os.path.getsize(x) < 400000 and "_red" not in os.path.basename(x)]
    random.seed(4); pick = random.sample(files, min(60, len(files)))
    pick += [x for x in sorted(glob.glob(os.path.join(HERE, "*.pdf"))) if not os.path.basename(x).startswith("ls_")]   # (and this review's own PDFs; its letter-spaced ones are judged against their source in the ls group: poppler reads spaced letters one by one)
    for x in pick:
        rel = os.path.relpath(x, FXROOT)
        n = npages(x)
        if n == 0: continue
        pages = list(range(min(n, 2)))
        try:
            tn = ltext(x, "new", pages); to = ltext(x, "old", pages)
        except Exception as e:
            C(G, rel, "both builds read it", False, "read", str(e)[:200]); continue
        for i in pages:
            pp = bag(ptext(x, i + 1))
            if not pp: continue
            a = f1(bag(tn[i]), pp); b = f1(bag(to[i]), pp)
            C(G, rel, "p%d words against poppler: 1.24.40 not worse than 1.24.39 (F1 new %.3f, old %.3f)" % (i + 1, a, b), a >= b - 0.01, ">= %.3f" % (b - 0.01), "%.3f" % a)

try:
    if on("hyph"): g_hyph()
    if on("ls"): g_ls()
    if on("fold"): g_fold()
    if on("std14"): g_std14()
    if on("deep"): g_deep()
    if on("links"): g_links()
    if on("forms"): g_forms()
    if on("sweep"): g_sweep()
finally:
    C.save()
    for b in _B.values(): b.close()
    pw_stop()
    n = len(C.rows); k = sum(1 for r_ in C.rows if not r_["pass"])
    print("%d checks, %d failed" % (n, k))
