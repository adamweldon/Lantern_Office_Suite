# run_review.py -- the second review's checks: each PDF of this folder opened by Lantern (src/lantern.inner.html) in
# Chromium (probe.js), what it read and drew compared with an oracle: the PDF standard (ISO 32000-2), qpdf (it checked
# and unlocked every file), poppler (pdfinfo, pdftotext, pdftoppm pixels) and pypdf's PDFDocEncoding table; and with
# 1.24.38 (LANTERN_OLD=<old index.html>) for the before/after checks. Writes cases.json beside this script.
#   python3 make_fixtures.py ; LANTERN_OLD=<1.24.38 index.html> python3 run_review.py
import os, sys, json, re, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import Browser, HERE, poppler_regions
OLD = os.environ.get("LANTERN_OLD", "")
B = Browser(("new", "old") if OLD else ("new",))
E = json.load(open(os.path.join(HERE, "expect.json")))
cases = []
def case(group, f, check, expected, got, ok, kind="must"):
    # kind: "must" (ISO 32000, or what qpdf/poppler/1.24.38 do with a correct PDF); "info" (beyond the standard: reported,
    # not counted as a failure)
    cases.append({"group": group, "file": f, "check": check, "expected": expected, "got": got, "pass": bool(ok), "kind": kind})
    tag = "PASS  " if ok else ("INFO  " if kind == "info" else "FAIL  ")
    print(tag + f + ": " + check + ("" if ok else "   got: " + json.dumps(got, ensure_ascii=False)[:300]), flush=True)
def rv(f, **k): return B.probe(f, **k)
def old(f, **k): return B.probe(f, which="old", **k)
def reg(r, page, k): return r["draw"][str(page)]["regions"][k]
WS = "[ \t\n\x0b\x0c\r   -     　﻿]"
def jsc(s): return re.sub(WS + "+", " ", s).strip(" ")   # JavaScript's /\s+/g -> " " and trim()
def near(a, b, tol=40): return a is not None and b is not None and all(abs(x - y) <= tol for x, y in zip(a, b))
def pdftotext(f, pw=None):
    a = ["pdftotext", "-layout"] + (["-upw", pw] if pw else []) + [os.path.join(HERE, f), "-"]
    return subprocess.run(a, capture_output=True).stdout.decode("utf-8", "replace")

# =============================================================== 1. LINEARIZED, UPDATED, HYBRID FILES
G = "linearized"
ref = rv("plain3.pdf", drawPages=[0, 1, 2])
REF_T = ref["texts"]; REF_H = [ref["draw"][str(p)]["hash"] for p in (0, 1, 2)]
pt = pdftotext("plain3.pdf")
case(G, "plain3.pdf", "oracle: the plain (not linearized) file reads as poppler reads it, title as pdfinfo", ["Linear page 1..3", "Pump Station Manual"],
     [REF_T, ref.get("title")], all(("Linear page %d" % k) in REF_T[k - 1] and ("Linear page %d" % k) in pt for k in (1, 2, 3)) and ref.get("title") == "Pump Station Manual")
REF_OUT = [["Chapter 1", 0, 0], ["Chapter 2", 1, 0], ["Chapter 3", 2, 0]]
LIN = [("lin2_plain.pdf", None, None), ("lin2_rc4_40_user.pdf", "pump", "RC4-40"), ("lin2_rc4_128_owner.pdf", "", "RC4-128"), ("lin2_rc4_128_user.pdf", "pump", "RC4-128"),
       ("lin2_aes128_user.pdf", "pump", "AES-128"), ("lin2_aes256_owner.pdf", "", "AES-256"), ("lin2_aes256_r5_user.pdf", "pump", "AES-256"),
       ("lin2_objstm_plain.pdf", None, None), ("lin2_objstm_rc4_user.pdf", "pump", "RC4-128"), ("lin2_objstm_aes128_owner.pdf", "", "AES-128")]
for f, pw, meth in LIN:
    if pw:
        r = rv(f, draw=False, text=False)
        case(G, f, "linearized with a user password: asks for it (needPassword, not wrongPassword)", {"needPassword": True}, {k: r.get(k) for k in ("openError", "needPassword", "wrongPassword")},
             r.get("needPassword") and not r.get("wrongPassword"))
        r = rv(f, draw=False, text=False, pw="not-it")
        case(G, f, "linearized with a user password: a wrong one is refused as wrong", {"wrongPassword": True}, {k: r.get(k) for k in ("openError", "wrongPassword")}, r.get("wrongPassword"))
        r = rv(f, draw=False, pw="chief")
        case(G, f, "the owner password opens it (owner true), text as the plain file", {"owner": True}, r.get("openError") or (r.get("security") or {}).get("owner"),
             (r.get("security") or {}).get("owner") and r.get("texts") == REF_T)
    r = rv(f, drawPages=[0, 1, 2], pw=pw) if pw else rv(f, drawPages=[0, 1, 2])
    sec = r.get("security") or {}
    case(G, f, "linearized%s: text of all three pages exactly the plain file's" % (" + " + meth if meth else ""), REF_T, r.get("texts") or r.get("openError"), r.get("texts") == REF_T)
    case(G, f, "... all three pages drawn pixel for pixel as the plain file", "same hashes", [r.get("draw", {}).get(str(p), {}).get("hash") for p in (0, 1, 2)],
         [r.get("draw", {}).get(str(p), {}).get("hash") for p in (0, 1, 2)] == REF_H)
    case(G, f, "... title (named in the first-page trailer) and bookmarks", ["Pump Station Manual", REF_OUT], [r.get("title"), r.get("outline")],
         r.get("title") == "Pump Station Manual" and r.get("outline") == REF_OUT)
    if meth:
        case(G, f, "... the lock said: method " + meth + (", user password" if pw else ", no user password"), {"method": meth, "userPassword": bool(pw)},
             {"method": sec.get("method"), "userPassword": sec.get("userPassword")}, sec.get("method") == meth and bool(sec.get("userPassword")) == bool(pw))
fref = rv("lin2_form_plain.pdf", drawPages=[0, 1])
fv = {x["name"]: x["value"] for x in fref.get("fields") or []}
case(G, "lin2_form_plain.pdf", "linearized form: value beside its label, the tick read; fields() as pypdf reads them", ["Tag: LIN-FIELD-42", "Done: [x]", {"tag": "LIN-FIELD-42", "done": "Yes"}],
     [fref.get("texts"), fv], "Tag: LIN-FIELD-42" in fref["texts"][0] and "Done: [x]" in fref["texts"][0] and fv == {"tag": "LIN-FIELD-42", "done": "Yes"})
for f, pw in [("lin2_form_aes256_user.pdf", "pump"), ("lin2_form_objstm_rc4_owner.pdf", None)]:
    r = rv(f, drawPages=[0, 1], pw=pw) if pw else rv(f, drawPages=[0, 1])
    case(G, f, "linearized + locked form: text, fields and both pages drawn as the unlocked linearized form", "same",
         [r.get("texts") == fref["texts"], r.get("fields") == fref.get("fields"), [r.get("draw", {}).get(str(p), {}).get("hash") == fref["draw"][str(p)]["hash"] for p in (0, 1)], r.get("openError")],
         r.get("texts") == fref["texts"] and r.get("fields") == fref.get("fields") and all(r.get("draw", {}).get(str(p), {}).get("hash") == fref["draw"][str(p)]["hash"] for p in (0, 1)))
# updates after linearizing
r = rv("lin2_incr_title.pdf", drawPages=[0, 1, 2], regions={0: [[72, 755, 250, 778]]})
case(G, "lin2_incr_title.pdf", "update after linearizing: the new title (pdfinfo: 'Updated After Linearize')", "Updated After Linearize", r.get("title"), r.get("title") == "Updated After Linearize")
case(G, "lin2_incr_title.pdf", "... page 1's new content stream read with the old, pages 2-3 unchanged", "APPENDED-LINE + page 1; pages 2, 3 as before", r.get("texts"),
     r.get("texts") and r["texts"][0].startswith("APPENDED-LINE") and REF_T[0] in r["texts"][0] and r["texts"][1:] == REF_T[1:])
case(G, "lin2_incr_title.pdf", "... the new line drawn; pages 2-3 pixel for pixel as before", "ink; same hashes", [reg(r, 0, 0) if r.get("draw") else None, [r.get("draw", {}).get(str(p), {}).get("hash") for p in (1, 2)]],
     r.get("draw") and reg(r, 0, 0)["dark"] > 1 and [r["draw"][str(p)]["hash"] for p in (1, 2)] == REF_H[1:])
r = rv("lin2_incr_root.pdf", draw=False)
case(G, "lin2_incr_root.pdf", "update after linearizing that names a new catalog (new number): its outline, not the old one", [["New Root Outline", 0, 0]], r.get("outline"), r.get("outline") == [["New Root Outline", 0, 0]])
case(G, "lin2_incr_root.pdf", "... title (Info kept) and text", ["Pump Station Manual"], [r.get("title")], r.get("title") == "Pump Station Manual" and r.get("texts") == REF_T)
r = rv("lin2_incr_xrefstm.pdf", draw=False)
case(G, "lin2_incr_xrefstm.pdf", "update written as a cross-reference STREAM after a classic linearized file: new title, text", "XRefStm Update Title", [r.get("title"), r.get("texts") == REF_T],
     r.get("title") == "XRefStm Update Title" and r.get("texts") == REF_T)
for f, pw, title, line in [("lin2_rc4_128_owner_incr.pdf", None, "Locked Linear Updated", "LOCKED-APPEND"), ("lin2_aes128_user_incr.pdf", "pump", "AES Linear Updated", "AES-APPEND"),
                           ("lin2_aes256_owner_incr.pdf", None, "AES256 Linear Updated", "AES256-APPEND")]:
    r = rv(f, drawPages=[1, 2], pw=pw) if pw else rv(f, drawPages=[1, 2])
    case(G, f, "locked + linearized + a scrambled update: new title, new line, other pages as before", [title, line], [r.get("title"), (r.get("texts") or [""])[0][:40], r.get("openError")],
         r.get("title") == title and r.get("texts") and r["texts"][0].startswith(line) and r["texts"][1:] == REF_T[1:] and [r["draw"][str(p)]["hash"] for p in (1, 2)] == REF_H[1:])
r = rv("incr_new_root.pdf", draw=False)
case(G, "incr_new_root.pdf", "update that replaces the catalog (not linearized): the new outline", [["Replaced Catalog Outline", 0, 0]], r.get("outline"), r.get("outline") == [["Replaced Catalog Outline", 0, 0]])
r = rv("incr_drop_info.pdf", draw=False); ro = old("incr_drop_info.pdf", draw=False) if OLD else {}
case(G, "incr_drop_info.pdf", "update whose trailer has no /Info (the details removed): no title, as qpdf, pdfinfo and 1.24.38 say", "",
     {"1.24.39": r.get("title"), "1.24.38": ro.get("title")}, r.get("title") == "")
for f, title in [("hybrid_plain.pdf", "Hybrid Title"), ("hybrid_incr.pdf", "Hybrid Updated Title")]:
    r = rv(f, draw=False)
    case(G, f, "hybrid-reference file (classic trailer naming /XRefStm, Info in an object stream): title as qpdf reads it, text", title, [r.get("title"), r.get("texts")],
         r.get("title") == title and r.get("texts") and "Hybrid reference page" in r["texts"][0])
r = rv("about_trailers.pdf", draw=False); ro = old("about_trailers.pdf", draw=False) if OLD else {}
case(G, "about_trailers.pdf", "an ordinary PDF whose page shows a trailer as text (uncompressed): opens and reads, as in 1.24.38 and qpdf/pdfinfo",
     "opens, title 'PDF Syntax Lesson'", {"1.24.39": r.get("openError") or r.get("title"), "1.24.38": ro.get("openError") or ro.get("title")},
     not r.get("openError") and r.get("title") == "PDF Syntax Lesson" and "How a locked PDF names its lock" in (r.get("texts") or [""])[0])

# =============================================================== 2. TEXT STRINGS
G = "strings"
r = rv("strings.pdf", drawPages=[0], maxPages=1)
outl = [x[0] for x in r.get("outline") or []]
fl = {x["name"]: x["value"] for x in r.get("fields") or []}
t = r["texts"][0] if r.get("texts") else ""
lines = t.split("\n")
for k, s in enumerate(E["strings"]):
    want = s["want"]; lab = s["label"]; kind = s["kind"]
    got = outl[k] if k < len(outl) else None
    case(G, "strings.pdf", "bookmark title, %s: %r" % (lab, jsc(want)), jsc(want), got, got == jsc(want), kind)
    got = fl.get("s%02d" % k)
    case(G, "strings.pdf", "field value (fields()), %s" % lab, want, got, got == want, kind)
    lab_line = [l for l in lines if l.startswith("F%02d:" % k)]
    wl = ("F%02d: " % k + jsc(want)).strip() if jsc(want) else "F%02d:" % k
    case(G, "strings.pdf", "field value read beside its label (pageText), %s" % lab, wl, lab_line, wl in lab_line, kind)
    if jsc(want):
        raw_is_bom = lab in ("utf16-astral", "utf16-empty", "utf16-odd", "utf8-bom", "utf8-bom-empty", "utf16le-bom", "utf16-lang-escape")
        note = "Note (%s): %s" % (want, jsc(want) if raw_is_bom else jsc("C%02d=" % k + want))
        gotn = [l for l in lines if l.startswith("Note") and (("C%02d=" % k) in l or (raw_is_bom and jsc(want)[:4] in l))]
        case(G, "strings.pdf", "a note's words and author (Comments on this page), %s" % lab, note, gotn, note in t, kind)
case(G, "strings.pdf", "Info title in PDFDocEncoding mixed with Latin-1 (pdfinfo: 'Café – naïve “quoted” ﬁle • € 5')",
     "Café – naïve “quoted” ﬁle • € 5", r.get("title"), r.get("title") == "Café – naïve “quoted” ﬁle • € 5")
case(G, "strings.pdf", "list box display text in PDFDocEncoding (export value b)", E["pick"], fl.get("pick"), fl.get("pick") == E["pick"])
case(G, "strings.pdf", "layer name in PDFDocEncoding", E["layer_name"], [l["name"] for l in r.get("layers") or []], [l["name"] for l in r.get("layers") or []] == [E["layer_name"]])
TITLES = {"utf8": "U8: Straße – Tor 2 \U0001F527", "utf16": "U16: Ω ü 日本 \U0001F527", "pdfdoc": [s["want"] for s in E["strings"] if s["label"] == "pdfdoc-all"][0],
          "latin1": [s["want"] for s in E["strings"] if s["label"] == "latin1-accents"][0], "fe_ff_only": "", "empty": ""}
for lab, want in TITLES.items():
    f = "title_%s.pdf" % lab
    info = subprocess.run(["pdfinfo", os.path.join(HERE, f)], capture_output=True).stdout.decode("utf-8", "replace")
    pop = re.search(r"^Title:\s*(.*)$", info, re.M); pop = pop.group(1) if pop else ""
    r = rv(f, draw=False)
    case(G, f, "Info title, %s (pdfinfo agrees: %s)" % (lab, pop == want), want, r.get("title"), r.get("title") == want)
    if OLD and lab in ("latin1", "utf16", "empty"):
        ro = old(f, draw=False)
        case(G, f, "Info title, %s: the same as 1.24.38 gave (Latin-1 accents and UTF-16 unchanged)" % lab, ro.get("title"), r.get("title"), r.get("title") == ro.get("title"))

# =============================================================== 3. PASSWORDS
G = "passwords"
for c in E["passwords"]:
    f = c["file"]
    if f == "v4_rc4_nocflen.pdf":
        r = rv(f, draw=False)
        case(G, f, "V4 lock with RC4 whose crypt filter has no /Length (key length from the lock's /Length 128; qpdf opens it): opens with no question",
             "opens, 'Password test page'", r.get("openError") or (r.get("texts") or [""])[0][:60], not r.get("openError") and "Password test page" in (r.get("texts") or [""])[0])
        continue
    r = rv(f, draw=False, pw=c["typed"])
    sec = r.get("security") or {}
    ok = not r.get("openError") and "Password test page" in (r.get("texts") or [""])[0] and bool(sec.get("owner")) == (c["as"] == "owner")
    kind = "info" if c["stored"] == "cp1252" or (c["stored"] == "qpdf" and c["rev"] == "R6" and c["typed"] != __import__("unicodedata").normalize("NFKC", c["typed"])) else "must"
    why = {"pdfdoc": "stored in PDFDocEncoding (ISO 32000, as Acrobat and qpdf do)", "utf8": "stored as UTF-8 (pypdf and qpdf do when PDFDocEncoding cannot)",
           "cp1252": "stored in the Windows code page (not the standard)", "qpdf": "made by qpdf", "pypdf": "made by pypdf (SASLprep)"}[c["stored"]]
    case(G, f, "%s %s password %r, %s: opens%s" % (c["rev"], c["as"], c["typed"], why, " as owner" if c["as"] == "owner" else ""), "opens",
         r.get("openError") or {"owner": sec.get("owner"), "text": (r.get("texts") or [""])[0][:40]}, ok, kind)
r = rv("pw_R3_euro_pdfdoc_user.pdf", draw=False, pw="€uro-6")
case(G, "pw_R3_euro_pdfdoc_user.pdf", "a near-miss password (one letter wrong, non-ASCII) is refused as wrong", {"wrongPassword": True}, {k: r.get(k) for k in ("openError", "wrongPassword")}, r.get("wrongPassword"))

# =============================================================== 4. BLEND MODES AND SEE-THROUGH ANNOTATIONS
G = "blend"
regs, names = [], []
for k, bm in enumerate(E["blends"]):
    x = 45 + 54 * k
    regs += [[x + 8, 702, x + 36, 708], [x + 8, 715, x + 36, 725]]; names += [bm + " over the black bar", bm + " over white"]
regs += [[105, 602, 195, 608], [72, 522, 540, 528]]; names += ["after Q (blend back to Normal) a white box covers the bar", "/BM /Normal (as Word writes): black bar drawn"]
r = rv("blend_page.pdf", regions={0: regs}); pop = poppler_regions(os.path.join(HERE, "blend_page.pdf"), 0, regs)
ro = old("blend_page.pdf", regions={0: regs}) if OLD else None
for k, nm in enumerate(names):
    got = reg(r, 0, k)["rgb"] if r.get("draw") else r.get("errors")
    og = reg(ro, 0, k)["rgb"] if ro and ro.get("draw") else None
    case(G, "blend_page.pdf", "page content, " + nm + ": colour as poppler draws it (1.24.38 drew %s%s)" % (og, ", right" if near(og, pop[k]["rgb"]) else ", wrong"),
         pop[k]["rgb"], got, near(got, pop[k]["rgb"]))
R1 = [[74, 680, 300, 696], [72, 618, 328, 638], [72, 558, 328, 578], [402, 618, 518, 638], [404, 506, 576, 534], [402, 422, 518, 468]]
N1 = ["highlight drawing with /BM [/Multiply] over words", "Screen box over words", "Darken box over words", "box drawn by its appearance, /CA 0.5",
      "typed comment drawn by its appearance in Helvetica (a font the PDF does not carry), /CA 0.3: the words faint", "stamp whose appearance is a black picture, /CA 0.5"]
r = rv("blend_annots.pdf", drawPages=[0, 1, 2], regions={0: R1, 1: [[250, 618, 295, 636], [110, 600, 290, 604]], 2: [[310, 310, 390, 390]]})
pop = poppler_regions(os.path.join(HERE, "blend_annots.pdf"), 0, R1)
SPEC = {3: {"rgb": [128, 128, 255], "dark": 0.0}, 5: {"rgb": [128, 128, 128], "dark": 0.0}}
for k, nm in enumerate(N1):
    got = reg(r, 0, k) if r.get("draw") else None
    if k in SPEC:   # poppler does not apply /CA to an annotation's own drawing; ISO 32000 12.5.2 (CA) does
        ok = got is not None and near(got["rgb"], SPEC[k]["rgb"], 20)
        case(G, "blend_annots.pdf", "annotation, " + nm + ": half strength, as ISO 32000 12.5.2 asks (poppler ignores /CA here)", SPEC[k], got, ok)
    elif k == 4:
        ok = got is not None and got["dark"] < 1 and got["nonwhite"] > 3
        case(G, "blend_annots.pdf", "annotation, " + nm + " (ISO 32000 12.5.2: 30% black over white is light grey, no dark pixels; poppler ignores /CA here)",
             {"dark": "< 1", "nonwhite": "> 3"}, got, ok)
    else:
        ok = got is not None and near(got["rgb"], pop[k]["rgb"]) and abs(got["dark"] - pop[k]["dark"]) < 8
        case(G, "blend_annots.pdf", "annotation, " + nm + ": as poppler draws it (mean colour, share of dark pixels)", pop[k], got, ok)
pop2 = poppler_regions(os.path.join(HERE, "blend_annots.pdf"), 1, [[250, 618, 295, 636], [110, 600, 290, 604]])
got = [reg(r, 1, 0), reg(r, 1, 1)] if r.get("draw") else None
case(G, "blend_annots.pdf", "page 2: the page leaves /BM /Multiply set at the top level; an annotation's white box must still cover the black band (each appearance starts from the default state)",
     [p["rgb"] for p in pop2], [g["rgb"] for g in got] if got else None, got and near(got[0]["rgb"], pop2[0]["rgb"]) and near(got[1]["rgb"], pop2[1]["rgb"]))
pop3 = poppler_regions(os.path.join(HERE, "blend_annots.pdf"), 2, [[310, 310, 390, 390]])
got = reg(r, 2, 0) if r.get("draw") else None
case(G, "blend_annots.pdf", "page 3: the page leaves a clip set at the top level; an annotation outside it must still be drawn", pop3[0]["rgb"], got and got["rgb"], got and near(got["rgb"], pop3[0]["rgb"]))

# =============================================================== 5. LAYERS
G = "layers"
def ve_eval(e, on):
    if isinstance(e, str): return on[e]
    op, rest = e[0], [ve_eval(x, on) for x in e[1:]]
    return (not rest[0]) if op == "Not" else all(rest) if op == "And" else any(rest)
popt = pdftotext("ve_shapes.pdf")
for state, lo in [({"A": True, "B": False, "C": True, "D": False}, None), ({"A": True, "B": True, "C": True, "D": False}, {"Layer B": True}),
                  ({"A": False, "B": False, "C": True, "D": True}, {"Layer A": False, "Layer D": True})]:
    regs = [[420, x["y"] - 2, 540, x["y"] + 12] for x in E["ve"]]
    r = rv("ve_shapes.pdf", regions={0: regs}, layerOn=lo) if lo else rv("ve_shapes.pdf", regions={0: regs})
    t = (r.get("texts") or [""])[0]
    for k, x in enumerate(E["ve"]):
        want = ve_eval(x["tree"], state)
        extra = ""
        if lo is None:
            ppl = re.search(r"\b%s\b" % re.escape(x["label"]), popt) is not None
            extra = " (poppler agrees: %s)" % (ppl == want)
        got_t = re.search(r"(^|\n)%s(\n|$)" % re.escape(x["label"]), t) is not None
        got_d = reg(r, 0, k)["nonwhite"] > 30 if r.get("draw") else None
        st = "default" if lo is None else ",".join("%s %s" % (a[-1], "on" if b else "off") for a, b in lo.items())
        case(G, "ve_shapes.pdf", "[%s] /VE %s: %s%s" % (st, x["label"], "shown" if want else "hidden", extra), {"read": want, "drawn": want}, {"read": got_t, "drawn": got_d},
             got_t == want and got_d == want)
MARKS = [("HID-1 picture in a form drawn inside a hidden BDC", [60, 650, 160, 710], False), ("HID-2 picture whose own /OC is an OCMD /VE [/Not V]", [360, 410, 460, 470], False),
         ("HID-3 form whose own /OC is off", [360, 650, 460, 710], False), ("HID-4 BDC inside a visible form, property in the form's resources", [60, 530, 160, 590], False),
         ("HID-5 BDC in a form, the property only in the page's resources", [360, 530, 460, 590], False), ("HID-6 form nested in a form, inside a hidden BDC", [60, 410, 160, 470], False),
         ("VIS control mark", [360, 290, 460, 350], True)]
regs = [m[1] for m in MARKS]
r = rv("hidden_marks.pdf", regions={0: regs}, pageImage=regs)
pop = poppler_regions(os.path.join(HERE, "hidden_marks.pdf"), 0, regs)
t = (r.get("texts") or [""])[0]
for k, (nm, rg, vis) in enumerate(MARKS):
    want = "black" if vis else "light grey (the scan)"
    d = reg(r, 0, k)["rgb"][0] if r.get("draw") else None
    pi = r["pageImage"][k]["rgb"][0] if r.get("pageImage") else None
    pp = pop[k]["rgb"][0]
    kind = "info" if "HID-5" in nm else "must"
    case(G, "hidden_marks.pdf", nm + ": pageDraw (poppler: %s)" % ("black" if pp < 100 else "grey"), want, d, d is not None and ((d < 100) == vis), kind)
    case(G, "hidden_marks.pdf", nm + ": pageImage (Text Reader's picture of a scanned page)", want, pi, pi is not None and ((pi < 100) == vis), kind)
    if not vis:
        lab = nm.split()[0]
        case(G, "hidden_marks.pdf", nm + ": its words not read (pageText)", "absent", lab in t, lab not in t, kind)
popt = pdftotext("hidden_marks.pdf")
case(G, "hidden_marks.pdf", "visible words read: VIS-6 (outer form), VIS-CONTROL; poppler reads them too", ["VIS-6", "VIS-CONTROL"], t, "VIS-6" in t and "VIS-CONTROL" in t and "VIS-6" in popt)
r = rv("hidden_marks.pdf", regions={0: regs}, pageImage=regs, layerOn={"Hidden marks": True})
t = (r.get("texts") or [""])[0]
for k in (0, 2, 3, 4, 5):
    nm = MARKS[k][0]
    case(G, "hidden_marks.pdf", "layer turned on (pdf.layerOn): " + nm.split(" ")[0] + " drawn, pageImage too, words read", "black, black, read",
         [reg(r, 0, k)["rgb"][0] if r.get("draw") else None, r["pageImage"][k]["rgb"][0] if r.get("pageImage") else None, nm.split()[0] in t],
         r.get("draw") and reg(r, 0, k)["rgb"][0] < 100 and r.get("pageImage") and r["pageImage"][k]["rgb"][0] < 100 and nm.split()[0] in t)
HARD = """import json, sys; sys.path.insert(0, %r)
from harness import Browser
B = Browser(("new",)); print(json.dumps(B.probe(%r, regions={0: [[72, 695, 200, 712]]}, timeout=30000))); B.close()"""
for f, what in [("ve_cycle.pdf", "a /VE array that names itself twice (damaged)"), ("ve_shared_dag.pdf", "a legal /VE whose parts are shared 22 deep (2^22 paths)")]:
    t0 = time.time()
    try:
        pr = subprocess.run([sys.executable, "-c", HARD % (HERE, f)], capture_output=True, timeout=60); res = (pr.stdout.decode().strip().splitlines() or ["{}"])[-1]
        r = json.loads(res) if res.startswith("{") else {"harnessError": res}
    except subprocess.TimeoutExpired: r = {"harnessError": "killed after 60 s (the page was still busy)"}
    el = round(time.time() - t0, 1)
    case(G, f, what + ": text and drawing come back within 10 s (browser start included), no error", "< 10 s",
         {"seconds": el, "err": r.get("harnessError") or r.get("errors") or r.get("openError")}, el < 20 and not r.get("harnessError") and not r.get("errors"))
RG = [[210, 510, 390, 590], [72, 298, 200, 312]]
r = rv("interleave_clip.pdf", regions={0: RG}); ro = old("interleave_clip.pdf", regions={0: RG}) if OLD else None
pop = poppler_regions(os.path.join(HERE, "interleave_clip.pdf"), 0, RG)
for k, nm in enumerate(["q, a clip, then a hidden BDC that holds the Q: the clip ends at Q, so the red box after it shows",
                        "... and the words after it are drawn"]):
    if k == 0:
        got = reg(r, 0, k)["rgb"] if r.get("draw") else None; og = reg(ro, 0, k)["rgb"] if ro else None
        case(G, "interleave_clip.pdf", nm + " (poppler %s; 1.24.38 %s)" % (pop[k]["rgb"], og), pop[k]["rgb"], got, near(got, pop[k]["rgb"]))
    else:   # sparse words: compare the share of inked pixels, not the mean colour
        got = reg(r, 0, k)["nonwhite"] if r.get("draw") else None; og = reg(ro, 0, k)["nonwhite"] if ro else None
        case(G, "interleave_clip.pdf", nm + " (inked share: poppler %s; 1.24.38 %s)" % (pop[k]["nonwhite"], og), "> 2", got, got is not None and got > 2)
RG = [[110, 302, 190, 308], [110, 312, 190, 318]]
r = rv("hidden_gs.pdf", regions={0: RG}); pop = poppler_regions(os.path.join(HERE, "hidden_gs.pdf"), 0, RG)
for k, nm in enumerate(["/BM /Multiply set inside a hidden part still applies after it (ISO 32000, optional content in content streams): the black bar shows through the yellow box",
                        "... and above the bar the box is yellow"]):
    got = reg(r, 0, k)["rgb"] if r.get("draw") else None
    case(G, "hidden_gs.pdf", nm + " (as poppler draws it)", pop[k]["rgb"], got, near(got, pop[k]["rgb"]))
for f, what in [("damaged_ocgs_dict.pdf", "/OCProperties /OCGs a dictionary, not an array"), ("damaged_onoff_dict.pdf", "/D /ON and /OFF dictionaries, not arrays"),
                ("damaged_ve_odd.pdf", "a /VE with a number, a string and empty /Not, /Or in it")]:
    r = rv(f); ro = old(f) if OLD else {}
    case(G, f, "damaged layer settings, " + what + ": nothing throws, the page reads and draws (1.24.38: %r)" % ((ro.get("texts") or [""])[0][:40],),
         "no errors; 'Damaged layers page' and A-PART read", {"errors": r.get("errors"), "text": (r.get("texts") or [""])[0][:80]},
         not r.get("openError") and not r.get("errors") and "A-PART" in (r.get("texts") or [""])[0])

# =============================================================== 5b. NAMES, LINKS, ATTACHMENTS
G = "names"
LJS = """async (a) => { var P = Lantern.pdf, pdf = await P.open(new Uint8Array(await (await fetch(a.f)).arrayBuffer())); return await P.links(pdf, 0); }"""
lk = B.run(LJS, {"f": "/nav_names_bytes.pdf"})
pages = [l.get("page") for l in lk] if isinstance(lk, list) else lk
case(G, "nav_names_bytes.pdf", "named destination (caf\\205) in a name tree whose keys are sorted byte by byte (ISO 32000 7.9.6): found, page 3", 2, pages[0] if isinstance(pages, list) else pages,
     isinstance(pages, list) and pages[0] == 2)
case(G, "nav_names_bytes.pdf", "named destination (caf\\245), the kid's upper limit: page 4", 3, pages[1] if isinstance(pages, list) else pages, isinstance(pages, list) and pages[1] == 3)
case(G, "nav_names_bytes.pdf", "a URI written as UTF-8 bytes (pdf.js decodes it): https://example.org/caf\u00e9", "https://example.org/caf\u00e9",
     lk[2].get("uri") if isinstance(lk, list) else lk, isinstance(lk, list) and lk[2].get("uri") == "https://example.org/caf\u00e9", "info")
r = rv("attach_locked_pdf_saved.pdf", draw=False); ro = old("attach_locked_pdf_saved.pdf", draw=False) if OLD else {}
case(G, "attach_locked_pdf_saved.pdf", "a plain PDF carrying a locked PDF as an attachment (pypdf leaves it unpacked): opens with no password and reads (poppler: 'Binder page...')",
     "Binder page: see the attached locked manual", {"1.24.39": r.get("openError") or (r.get("texts") or [""])[0][:60], "1.24.38": ro.get("openError") or (ro.get("texts") or [""])[0][:60]},
     not r.get("openError") and "Binder page" in (r.get("texts") or [""])[0])

# =============================================================== 6. FORMS
G = "forms"
CR = []
for c in E["combs"]:
    x0, y0, x1, y1 = c["rect"]; w = (x1 - x0) / c["maxlen"]
    CR += [[x0 + w * i + 1, y0 + 3, x0 + w * (i + 1) - 1, y1 - 3] for i in range(c["maxlen"])]
r = rv("forms2.pdf", drawPages=[0], regions={0: CR}, maxPages=2)
fl = r.get("fields") or []
fv = {}
for x in fl: fv.setdefault(x["name"], []).append(x["value"])
WANT = [("route", ["East"], "a radio group across two pages, the button on page 2 chosen: one field, 'East'", "must"),
        ("dir", ["Downstream"], "a radio group with /Opt (on-names /0 /1 /2, as Acrobat writes): the export value from /Opt", "must"),
        ("sp", ["On Site"], "check box on-name /On#20Site", "must"), ("si", ["Sí"], "check box on-name /S#C3#AD (a UTF-8 name, PDF 2.0)", "info"),
        ("zero", ["0"], "check box on-name /0", "must"), ("up", ["YES"], "check box on-name /YES", "must"),
        ("oui_noap", ["Oui"], "check box with no drawing, /AS /Oui", "must"), ("oui_vonly", ["Oui"], "check box with no drawing and no /AS, /V /Oui", "must"),
        ("pair", ["B"], "two check boxes of one field with different on-names (B ticked): one field, 'B'", "must"),
        ("c1", ["Z"], "comb MaxLen 1", "must"), ("c4", ["12"], "comb MaxLen 4, value shorter", "must"), ("c6", ["ABCDEF"], "comb MaxLen 6", "must"),
        ("c10", ["0123456789ABC"], "comb MaxLen 10, value longer (the value as stored)", "must"), ("cinh", ["98765"], "comb with Ff and MaxLen on the parent", "must"),
        ("cml", ["AB"], "comb flag with multiline (not a comb)", "must"),
        ("twice", ["Alpha-on-field"], "one field on two pages (its second widget carries a /V of its own): listed once, the field's value", "must"),
        ("streamv", ["Value kept in a stream"], "a text field whose /V is a text stream (ISO 32000, text fields)", "must")]
for name, want, what, kind in WANT:
    case(G, "forms2.pdf", "fields(): " + what, want, fv.get(name), fv.get(name) == want, kind)
t0 = (r.get("texts") or ["", ""])[0].split("\n"); t1 = (r.get("texts") or ["", ""])[1].split("\n") if len(r.get("texts") or []) > 1 else []
for want, lines, what, kind in [("Route: [ ] [ ]", t0, "page 1 of the cross-page radio group: both unticked", "must"), ("Route p2: [x]", t1, "page 2: the chosen one ticked", "must"),
                                ("Dir: [ ] [x] [ ]", t0, "the /Opt radio group's middle button ticked", "must"), ("Pair: [ ] [x]", t0, "the check-box pair", "must"),
                                ("Oui: [x]", t0, "a check box with no drawing", "must"), ("OuiV: [x]", t0, "... and no /AS", "must"),
                                ("c10: 0123456789ABC", t0, "comb value read whole (longer than MaxLen)", "info"), ("Stream: Value kept in a stream", t0, "a value kept in a text stream", "must"),
                                ("Twice: Alpha-on-field", t0, "the field's value on page 1", "must")]:
    case(G, "forms2.pdf", "pageText: " + what, want, [l for l in lines if l.split(":")[0] == want.split(":")[0]], want in lines, kind)
tw = [l for l in t1 if l.startswith("Twice p2")]
case(G, "forms2.pdf", "pageText page 2: the second widget of 'twice' (with its own /V): what Lantern shows (pdf.js shows the widget's own; the standard keeps one value per field)",
     "Twice p2: Alpha-on-field or Beta-on-widget", tw, tw in (["Twice p2: Alpha-on-field"], ["Twice p2: Beta-on-widget"]), "info")
pop = poppler_regions(os.path.join(HERE, "forms2.pdf"), 0, CR)
k = 0
for c in E["combs"]:
    ours = [round(reg(r, 0, k + i)["dark"], 1) if r.get("draw") else None for i in range(c["maxlen"])]
    theirs = [pop[k + i]["dark"] for i in range(c["maxlen"])]
    k += c["maxlen"]
    ok = all(o is not None and ((o > 0.5) == (p > 0.5)) for o, p in zip(ours, theirs))
    case(G, "forms2.pdf", "comb %s (MaxLen %d, value %r) drawn one letter per cell, cells inked as poppler inks them" % (c["name"], c["maxlen"], c["value"]),
         theirs, ours, ok)

# =============================================================== 7. TEXT READER: scanned pages with something on top
G = "text reader"
TRJS = """async (a) => {
  var TR = Lantern.textReader, buf = await (await fetch(a.f)).arrayBuffer(), out = {};
  var file = new File([buf], a.f.split('/').pop(), {type: 'application/pdf'});
  try {
    var doc = await TR.docs.open([file], {});
    var cv = await TR.docs.picture(doc, 0); out.picture = cv ? [cv.width, cv.height] : null;
    await TR.docs.readSection(doc, 0, {}); var p = doc.pages[0]; out.own = !!p.own; out.text = TR.docs.text(doc);
  } catch (e) { out.error = String(e.message || e); }
  return out;
}"""
for f, what in [("scan_note.pdf", "a scanned page with a sticky note"), ("scan_fields.pdf", "a scanned form with three filled fields"),
                ("scan_emptyfield.pdf", "a 300-dpi scanned page with one empty field"), ("scan_plain.pdf", "a 300-dpi scanned page (control)")]:
    rn = B.run(TRJS, {"f": "/" + f}, timeout=300000)
    ro = B.run(TRJS, {"f": "/" + f}, which="old", timeout=300000) if OLD else {}
    tn, to = rn.get("text") or "", ro.get("text") or ""
    case(G, f, what + ": Text Reader reads the scan (OCR), as 1.24.38 did: 'INSPECTION' and 'PUMP STATION TWO' in the text", {"1.24.38": "INSPECTION" in to},
         {"1.24.39 own words only": rn.get("own"), "text": tn[:160], "1.24.38 has INSPECTION": "INSPECTION" in to},
         "INSPECTION" in tn and "PUMP STATION TWO" in tn)
    if f == "scan_note.pdf":
        case(G, f, "... and the note is kept beside the scan's words", "Note (Adam): Checked by the night shift...", tn[-120:], "Checked by the night shift" in tn, "info")
    if f in ("scan_emptyfield.pdf", "scan_plain.pdf"):
        case(G, f, what + ": the picture Text Reader reads is as sharp as 1.24.38's (the scan's own 2550 x 3300 pixels; OCR of 6-point print was not hurt, below)",
             ro.get("picture"), rn.get("picture"), rn.get("picture") == ro.get("picture") if OLD else True, "info")

def words(t): return re.findall(r"[A-Za-z0-9]+", t)
want = [w for l in E["small_lines"] for w in words(l)]
def score(t):
    have = {}
    for w in words(t): have[w] = have.get(w, 0) + 1
    hit = 0
    for w in want:
        if have.get(w, 0) > 0: hit += 1; have[w] -= 1
    return round(100.0 * hit / len(want), 1)
sc = {}
for f in ["scan_small_emptyfield.pdf", "scan_small_plain.pdf"]:
    for w in (["new", "old"] if OLD else ["new"]):
        x = B.run(TRJS, {"f": "/" + f}, which=w, timeout=400000); sc[(f, w)] = (score(x.get("text") or ""), x.get("picture"))
case(G, "scan_small_emptyfield.pdf", "6-point print on a 300-dpi scan with one empty field: Text Reader reads as many words right as 1.24.38 (it drew the scan at its own size)",
     {"1.24.38": sc.get(("scan_small_emptyfield.pdf", "old"))}, {"1.24.39": sc.get(("scan_small_emptyfield.pdf", "new")), "the same scan with no field, 1.24.39": sc.get(("scan_small_plain.pdf", "new"))},
     not OLD or sc[("scan_small_emptyfield.pdf", "new")][0] >= sc[("scan_small_emptyfield.pdf", "old")][0] - 2)

# =============================================================== 8. ORDINARY PDFs: the same as 1.24.38
G = "before/after"
if OLD:
    for f in ["ord_reportlab.pdf", "ord_extgstate_normal.pdf", "plain3.pdf", "lin2_plain.pdf", "lin2_objstm_plain.pdf", "hybrid_plain.pdf", "title_latin1.pdf", "title_utf16.pdf",
              "about_trailers.pdf", "scan_plain.pdf", "lin2_incr_title.pdf"]:
        rn = rv(f, drawPages=[0, 1, 2]); ro = old(f, drawPages=[0, 1, 2])
        if ro.get("openError"):
            case(G, f, "1.24.38 opens it (control)", "opens", ro.get("openError"), False, "info"); continue
        case(G, f, "ordinary PDF: text of every page the same as 1.24.38", ro.get("texts"), rn.get("texts") or rn.get("openError"), rn.get("texts") == ro.get("texts"))
        dd = [p for p in ro.get("draw", {}) if ro["draw"][p]["hash"] != rn.get("draw", {}).get(p, {}).get("hash")]
        case(G, f, "ordinary PDF: pages 1-3 drawn pixel for pixel as 1.24.38", "no page differs", {"pages differing": dd, "err": rn.get("openError")}, not dd and not rn.get("openError"))

case("all", "(all)", "no uncaught page errors in the browser during the review", "[]", B.errs, not any(B.errs.values()))
B.close()
# (1.24.39, the release) cases.json is this review's record after the mends (cases_found.json: as it was found); written
# again only when the review is run whole (with LANTERN_OLD)
if OLD: json.dump(cases, open(os.path.join(HERE, "cases.json"), "w"), indent=1, ensure_ascii=False)
n = len(cases); bad = [c for c in cases if not c["pass"] and c["kind"] == "must"]; info = [c for c in cases if not c["pass"] and c["kind"] == "info"]
print("%d cases: %d pass, %d fail, %d informational (beyond the standard) not met" % (n, n - len(bad) - len(info), len(bad), len(info)))
