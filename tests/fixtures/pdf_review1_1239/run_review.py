# run_review.py -- the review's checks: each PDF of this folder opened by Lantern in Chromium (probe.js), what it read
# and drew compared with what the PDF says (the PDF standard, ISO 32000; qpdf's unlocked copy; poppler's pdftotext for
# layers). Writes cases.json beside this script. Usage:
#   python3 run_review.py                       (Lantern = src/lantern.inner.html)
#   LANTERN_OLD=<an older index.html> python3 run_review.py   (adds the before/after checks on older PDFs)
import os, sys, json, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import Browser, HERE, ROOT, MOUNTS
OLD = os.environ.get("LANTERN_OLD", "")
B = Browser(("new", "old") if OLD else ("new",))
cases = []
def case(f, check, expected, got, ok):
    cases.append({"file": f, "check": check, "expected": expected, "got": got, "pass": bool(ok)})
    print(("PASS  " if ok else "FAIL  ") + f + ": " + check + ("" if ok else "   got: " + json.dumps(got, ensure_ascii=False)[:300]))
def rv(f, **k): return B.probe("rv/" + f, **k)
def reg(r, page, k): return r["draw"][str(page)]["regions"][k]
def has(t, *words): return all(w in t for w in words)
def lacks(t, *words): return not any(w in t for w in words)

# ---------------------------------------------------------------- 1. locks
base = rv("lock_base.pdf", drawPages=[0, 1], meta=True)
dec = rv("lock_base_decrypted.pdf", drawPages=[0, 1])
case("lock_base_decrypted.pdf", "oracle: qpdf's unlocked copy reads and draws the same as the original", "same text and pixels",
     [dec["texts"] == base["texts"], dec["draw"]["0"]["hash"] == base["draw"]["0"]["hash"]], dec["texts"] == base["texts"] and dec["draw"]["0"]["hash"] == base["draw"]["0"]["hash"])
def same_as_base(f, r, label):
    ok_t = r.get("texts") == base["texts"]
    ok_d = all(r.get("draw", {}).get(str(p), {}).get("hash") == base["draw"][str(p)]["hash"] for p in (0, 1))
    case(f, label + ": text exactly the unlocked text", base["texts"], r.get("texts") or r.get("openError"), ok_t)
    case(f, label + ": both pages drawn pixel for pixel as the unlocked PDF", "same canvas hashes", [r.get("draw", {}).get(str(p), {}).get("hash") for p in (0, 1)], ok_d)
    case(f, label + ": its title (Info, a scrambled string) and bookmarks (a UTF-16 title) read", ["Lock Test Title", base["outline"]], [r.get("title"), r.get("outline")],
         r.get("title") == "Lock Test Title" and r.get("outline") == base["outline"])
owner_only = {
    "pdftk_rc4_40_owner.pdf": ("RC4-40", {"print": False, "copy": False, "change": False}),
    "pdftk_rc4_128_owner_print.pdf": ("RC4-128", {"print": True, "copy": False, "change": False}),
    "pypdf_aes256_owner_utf8.pdf": ("AES-256", {"print": True, "copy": True, "change": True}),
    "qpdf_aes256_cleartext_meta.pdf": ("AES-256", {"print": True, "copy": True, "change": True}),
    "qpdf_aes128_cleartext_meta.pdf": ("AES-128", {"print": True, "copy": True, "change": True}),
    "qpdf_rc4_128_v4_cleartext_meta.pdf": ("RC4-128", {"print": True, "copy": True, "change": True}),
    "qpdf_rc4_128_forceV4.pdf": ("RC4-128", {"print": True, "copy": True, "change": True}),
    "qpdf_aes128_objstm.pdf": ("AES-128", {"print": True, "copy": True, "change": True}),
    "qpdf_aes256_noprint.pdf": ("AES-256", {"print": False, "copy": False, "change": False}),
}
for f, (method, perms) in owner_only.items():
    r = rv(f, drawPages=[0, 1], meta=True)
    if r.get("openError"):
        case(f, "locked only against changes: opens with no question", "opens", r["openError"], False); continue
    sec = r.get("security") or {}
    case(f, "locked only against changes: opens with no question; security says locked, " + method + ", no user password",
         {"locked": True, "method": method, "userPassword": False}, {k: sec.get(k) for k in ("locked", "method", "userPassword")},
         sec.get("locked") and sec.get("method") == method and not sec.get("userPassword"))
    got_p = {k: (sec.get("permissions") or {}).get(k) for k in perms}
    case(f, "what its maker asked (permissions) read from /P", perms, got_p, got_p == perms)
    if f == "qpdf_aes128_objstm.pdf":
        case(f, "object streams + lock: text exactly the unlocked text", base["texts"], r.get("texts"), r.get("texts") == base["texts"])
        case(f, "object streams + lock: drawn as the unlocked PDF", "same hashes", [r["draw"][str(p)]["hash"] for p in (0, 1)],
             all(r["draw"][str(p)]["hash"] == base["draw"][str(p)]["hash"] for p in (0, 1)))
        case(f, "object streams (cross-reference stream, no 'trailer'): the Info title is read", "Lock Test Title", r.get("title"), r.get("title") == "Lock Test Title")
    else:
        same_as_base(f, r, "owner-only lock")
    case(f, "its XMP metadata stream comes out as XML (scrambled or left clear by --cleartext-metadata)", "<?xpacket begin=...", (r.get("meta") or "")[:40],
         (r.get("meta") or "").startswith("<?xpacket"))
# the same objstm without a lock: is the missing title the lock's doing?
r = rv("lock_base_objstm.pdf")
case("lock_base_objstm.pdf", "unlocked, object streams: the Info title is read (control for the case above)", "Lock Test Title", r.get("title"), r.get("title") == "Lock Test Title")
# user passwords
users = [("pdftk_rc4_40_user.pdf", "lantern", "ownpw", "RC4-40"), ("pdftk_rc4_128_user.pdf", "lantern", "ownpw", "RC4-128"),
         ("pdftk_rc4_128_user_latin1.pdf", "façade", "ownpw", "RC4-128"), ("pypdf_aes128_user.pdf", "lantern", "ownpw", "AES-128"),
         ("pypdf_aes256r5_user.pdf", "lantern", "ownpw", "AES-256"), ("pypdf_aes256_user_utf8.pdf", "Café-Ñandú", "Größe-Ø", "AES-256"),
         ("qpdf_aes256_user_objstm.pdf", "lantern", "ownpw", "AES-256"), ("qpdf_aes256_r5_user.pdf", "lantern", "ownpw", "AES-256"),
         ("pypdf_aes256_user_nbsp.pdf", "pump room", "ownpw", "AES-256")]
for f, up, op, method in users:
    r = rv(f, draw=False)
    case(f, "a user password: asks for it (needPassword, not wrongPassword), does not crash", {"needPassword": True, "wrongPassword": False},
         {"needPassword": r.get("needPassword"), "wrongPassword": r.get("wrongPassword"), "msg": r.get("openError")}, r.get("needPassword") and not r.get("wrongPassword"))
    r = rv(f, draw=False, pw="not it")
    case(f, "a wrong password is refused and said (wrongPassword)", {"needPassword": True, "wrongPassword": True},
         {"needPassword": r.get("needPassword"), "wrongPassword": r.get("wrongPassword"), "msg": r.get("openError")}, r.get("needPassword") and r.get("wrongPassword"))
    r = rv(f, drawPages=[0, 1], pw=up)
    sec = r.get("security") or {}
    case(f, "the user password %r opens it (userPassword true, owner false, %s)" % (up, method), {"userPassword": True, "owner": False, "method": method},
         r.get("openError") or {k: sec.get(k) for k in ("userPassword", "owner", "method")}, sec.get("userPassword") and not sec.get("owner") and sec.get("method") == method)
    case(f, "opened with the user password: text exactly the unlocked text", base["texts"], r.get("texts") or r.get("openError"), r.get("texts") == base["texts"])
    case(f, "opened with the user password: drawn as the unlocked PDF", "same hashes", [r.get("draw", {}).get(str(p), {}).get("hash") for p in (0, 1)],
         all(r.get("draw", {}).get(str(p), {}).get("hash") == base["draw"][str(p)]["hash"] for p in (0, 1)))
    r = rv(f, draw=False, pw=op)
    sec = r.get("security") or {}
    case(f, "the owner password %r typed by the person opens it (owner true)" % op, {"owner": True}, r.get("openError") or {"owner": sec.get("owner"), "userPassword": sec.get("userPassword")},
         sec.get("owner") and r.get("texts") == base["texts"])
r = rv("pypdf_aes256_user_utf8.pdf", draw=False, pw=unicodedata.normalize("NFD", "Café-Ñandú"))
case("pypdf_aes256_user_utf8.pdf", "the same password typed in decomposed form (NFD, as a Mac keyboard may send it) opens it (SASLprep normalises)", "opens",
     r.get("openError") or "opened", not r.get("openError") and r.get("texts") == base["texts"])
r = rv("pypdf_aes256_user_nbsp.pdf", draw=False, pw="pump room")
case("pypdf_aes256_user_nbsp.pdf", "password set with a no-break space opens with an ordinary space (SASLprep maps it)", "opens", r.get("openError") or "opened", not r.get("openError"))
r = rv("pypdf_aes256_owner_utf8.pdf", drawPages=[0], pw="Größe-Ø")
sec = r.get("security") or {}
case("pypdf_aes256_owner_utf8.pdf", "owner-only lock, the owner password typed anyway: opens as owner, same text", {"owner": True}, r.get("openError") or {"owner": sec.get("owner")},
     sec.get("owner") and r.get("texts") == base["texts"])
r = rv("pdftk_rc4_128_owner_print.pdf", draw=False, pw="typo")
case("pdftk_rc4_128_owner_print.pdf", "owner-only lock, a wrong password given: refused as wrong (as pdf.js does), not a crash", "error wrongPassword (or opens)",
     r.get("openError") or "opened", (r.get("wrongPassword") is True) or not r.get("openError"))
# updates appended after the lock
for f in ["incr_aes128.pdf", "incr_rc4_128.pdf", "incr_aes256.pdf", "incr_objstm_classic.pdf"]:
    r = rv(f, drawPages=[0, 1], regions={0: [[72, 735, 330, 758]]})
    t = r.get("texts") or [""]
    case(f, "an update appended after the lock: the new (scrambled) content stream is read with the old", "UPDATED after the lock + page one text",
         t[0][:60], t[0].startswith("UPDATED after the lock") and base["texts"][0] in t[0])
    case(f, "... and drawn (ink where the new line is)", "dark > 3%", reg(r, 0, 0) if r.get("draw") else r.get("errors"), r.get("draw") and reg(r, 0, 0)["dark"] > 3)
    case(f, "... the updated Info title (a new scrambled string) is read", "Updated Title", r.get("title"), r.get("title") == "Updated Title")
    case(f, "... page two, untouched by the update, is drawn as before", base["draw"]["1"]["hash"], r.get("draw", {}).get("1", {}).get("hash"), r.get("draw", {}).get("1", {}).get("hash") == base["draw"]["1"]["hash"])
for f, what in [("cert_pubsec.pdf", "a certificate (Adobe.PubSec) lock"), ("unknown_handler.pdf", "an unknown security handler (FOPN_foweb)")]:
    r = rv(f, draw=False)
    msg = r.get("openError") or ""
    case(f, what + ": refused with an error, no password asked, no crash", "Error, needPassword false", {"msg": msg, "needPassword": r.get("needPassword")},
         bool(msg) and not r.get("needPassword") and not r.get("harnessError"))
    if f == "unknown_handler.pdf":
        case(f, "the message does not call an unknown handler a certificate", "no 'certificate'", msg, "certificate" not in msg)
    else:
        case(f, "the message reads as plain English ('an Adobe.PubSec lock', not 'a Adobe.PubSec lock')", "an Adobe...", msg, "a Adobe" not in msg)

# ---------------------------------------------------------------- 2. forms
r = rv("form_rl.pdf", drawPages=[0, 1], regions={0: [[152, 697, 300, 711], [150, 656, 166, 672], [200, 616, 216, 632], [150, 616, 166, 632], [152, 576, 268, 592],
                                                    [150, 494, 270, 554], [355, 436, 388, 452], [152, 396, 268, 412]], 1: [[152, 697, 300, 711]]})
t = r["texts"]
for label, want in [("Name", "Name: Ada Lovelace"), ("Agree", "Agree: [x]"), ("Size", "Size: Large"), ("Parts", "Parts: bolt, washer"), ("Serial", "Serial: AB12CD34"), ("Code", "Code: RO-77")]:
    case("form_rl.pdf", "reportlab form: %s value read beside its label" % label, want, [l for l in t[0].split("\n") if l.startswith(label)], want in t[0].split("\n"))
case("form_rl.pdf", "reportlab radio group: only the chosen (green, the middle) ticked", "Colour: [ ] [x] [ ]", [l for l in t[0].split("\n") if l.startswith("Colour")], "Colour: [ ] [x] [ ]" in t[0])
case("form_rl.pdf", "field on page 2 read on page 2", ["Inspector: B. Smith", "Signed off: [ ]"], t[1], has(t[1], "Inspector: B. Smith", "Signed off: [ ]"))
fl = r["fields"]
names = [x["name"] for x in fl]
case("form_rl.pdf", "fields(): one entry per field (a radio group of 3 buttons is one field, 'colour' = 'green')", "colour once, value green",
     [x for x in fl if x["name"] == "colour"], names.count("colour") == 1 and [x for x in fl if x["name"] == "colour"][0]["value"] == "green")
case("form_rl.pdf", "fields(): choice export value L shown as its display text", "Large", [x["value"] for x in fl if x["name"] == "size"], [x["value"] for x in fl if x["name"] == "size"] == ["Large"])
case("form_rl.pdf", "fields(): multiple list selections", "bolt, washer", [x["value"] for x in fl if x["name"] == "parts"], [x["value"] for x in fl if x["name"] == "parts"] == ["bolt, washer"])
case("form_rl.pdf", "fields(): page 2 field has page 2", 2, [x["page"] for x in fl if x["name"] == "inspector"], [x["page"] for x in fl if x["name"] == "inspector"] == [2])
rg = r["draw"]["0"]["regions"]
case("form_rl.pdf", "drawn from its own appearances: name, tick, chosen radio, size, list, code", "each region inked",
     [x["dark"] for x in rg], rg[0]["dark"] > 1 and rg[1]["dark"] > 3 and rg[2]["dark"] > rg[3]["dark"] and rg[4]["dark"] > 1 and rg[5]["nonwhite"] > 3 and rg[7]["dark"] > 1)
case("form_rl.pdf", "comb field with reportlab's own appearance (which writes the digits left-aligned): drawn as the appearance says, as poppler does (last cell empty)",
     "last cell blank (poppler: 0.0)", rg[6]["dark"], rg[6]["dark"] == 0)
case("form_rl.pdf", "page 2 field drawn", "inked", reg(r, 1, 0), reg(r, 1, 0)["dark"] > 1)

for f in ["form_hand.pdf", "form_hand_aes128.pdf"]:
    r = rv(f, drawPages=[0, 1], regions={0: [[152, 686, 300, 702], [152, 646, 300, 662], [290, 602, 306, 618], [190, 602, 206, 618], [152, 562, 348, 578],
                                             [312, 524, 348, 540], [152, 484, 330, 500], [150, 442, 166, 458], [150, 402, 166, 418], [150, 362, 166, 378],
                                             [152, 324, 330, 340], [152, 244, 250, 260], [270, 244, 330, 260], [150, 202, 400, 222], [152, 284, 330, 300]],
                                         1: [[152, 696, 300, 712], [152, 656, 300, 672]]})
    t = r["texts"]; L0 = t[0].split("\n")
    for want in ["Customer: Grace Hopper", "Site: Tulsa Hangar 3", "Shift: Day [ ] Night [x] Swing [ ]", "Tools: Wrench, Screwdriver", "Zip: 74070",
                 "Read only: READ ONLY VALUE", "Ja box: [x]", "On box: [x]", "Unticked: [ ]", "Owner: Müller – Ståhl", "Centered: MID"]:
        case(f, "no drawings (NeedAppearances): %r read on its line" % want, want, [l for l in L0 if l.split(":")[0] == want.split(":")[0]], want in L0)
    case(f, "PDFDocEncoding value (\\205 = en dash, as pypdf writes it) read as an en dash", "Bay: Bay 3 – East", [l for l in L0 if l.startswith("Bay")], "Bay: Bay 3 – East" in L0)
    case(f, "a hidden field (F 2) is not read", "no TOPSECRET", [l for l in L0 if "Secret" in l], "TOPSECRET" not in t[0])
    case(f, "one field, two widgets on two pages: value read on page 2 too", ["Site again: Tulsa Hangar 3", "P2 note: Second page value"], t[1],
         has(t[1], "Site again: Tulsa Hangar 3", "P2 note: Second page value"))
    fl = r["fields"]; fv = {}
    for x in fl: fv.setdefault(x["name"], []).append(x["value"])
    case(f, "fields(): hierarchical full name order.customer.name", "Grace Hopper", fv.get("order.customer.name"), fv.get("order.customer.name") == ["Grace Hopper"])
    case(f, "fields(): radio group 'shift' reported once as Night", ["Night"], fv.get("shift"), fv.get("shift") == ["Night"])
    case(f, "fields(): list box export values w,s shown as Wrench, Screwdriver", ["Wrench, Screwdriver"], fv.get("tools"), fv.get("tools") == ["Wrench, Screwdriver"])
    case(f, "fields(): check box whose on-state is /Ja", ["Ja"], fv.get("ja"), fv.get("ja") == ["Ja"])
    case(f, "fields(): check box with no drawing, value /On (not 'Yes')", ["On"], fv.get("onbox"), fv.get("onbox") == ["On"])
    case(f, "fields(): UTF-16 value", ["Müller – Ståhl"], fv.get("owner"), fv.get("owner") == ["Müller – Ståhl"])
    case(f, "fields(): PDFDocEncoding value", ["Bay 3 – East"], fv.get("bay"), fv.get("bay") == ["Bay 3 – East"])
    rg = r["draw"]["0"]["regions"]; d = [x["dark"] for x in rg]
    case(f, "drawn: customer, site, chosen radio (Night) ticked, Day not", "inked/blank", d[:4], d[0] > 1 and d[1] > 1 and d[2] > 20 and d[3] == 0)
    case(f, "drawn: list box selections, read-only value, Ja tick, On tick (no drawing), Unticked blank, owner", "inked/blank", [d[4], d[6], d[7], d[8], d[9], d[10]],
         d[4] > 1 and d[6] > 1 and d[7] > 20 and d[8] > 3 and d[9] == 0 and d[10] > 1)
    case(f, "drawn: comb field (MaxLen 5, 200 pt wide) spreads its digits, the last in the last cell", "last cell [310-350] inked", d[5], d[5] > 1)
    case(f, "drawn: Q 1 centres the value (none at the left, ink in the middle)", "left 0, middle > 2", [d[11], d[12]], d[11] == 0 and d[12] > 2)
    case(f, "drawn: a hidden field (F 2) is not drawn", "nonwhite 0", rg[13]["nonwhite"], rg[13]["nonwhite"] == 0)
    case(f, "drawn: page 2 widget of the same field and the page 2 field", "inked", [x["dark"] for x in r["draw"]["1"]["regions"]], all(x["dark"] > 1 for x in r["draw"]["1"]["regions"]))
    if f == "form_hand_aes128.pdf":
        h = rv("form_hand.pdf", drawPages=[0, 1])
        case(f, "the locked form reads and draws exactly as the unlocked one", "same", [t == h["texts"], r["draw"]["0"]["hash"] == h["draw"]["0"]["hash"]],
             t == h["texts"] and r["draw"]["0"]["hash"] == h["draw"]["0"]["hash"] and r["draw"]["1"]["hash"] == h["draw"]["1"]["hash"])
for f in ["form_pypdf_filled_regen.pdf", "form_pypdf_filled_noregen.pdf"]:
    r = rv(f, drawPages=[0, 1], regions={0: [[152, 697, 300, 711], [152, 437, 300, 451], [152, 397, 268, 411]], 1: [[152, 697, 300, 711]]})
    t = r["texts"]
    case(f, "filled by pypdf: values read beside labels", ["Name: Filled By Pypdf", "Serial: ZX98", "Code: PY-12", "Inspector: C. Jones"], t,
         has(t[0], "Name: Filled By Pypdf", "Serial: ZX98", "Code: PY-12") and "Inspector: C. Jones" in t[1])
    case(f, "filled by pypdf: values drawn", "inked", [x["dark"] for x in r["draw"]["0"]["regions"] + r["draw"]["1"]["regions"]],
         all(x["dark"] > 1 for x in r["draw"]["0"]["regions"] + r["draw"]["1"]["regions"]))
r = rv("form_rot90.pdf", regions={0: [[172, 695, 240, 709], [72, 695, 150, 712], [250, 680, 380, 690]]})
case("form_rot90.pdf", "page /Rotate 90: value read beside its label", "Rotated name: ROT VALUE", r["texts"][0], "Rotated name: ROT VALUE" in r["texts"][0].split("\n"))
rg = r["draw"]["0"]["regions"]
case("form_rot90.pdf", "page /Rotate 90: label and value drawn where they belong on the turned page, nothing below the field", "label, value inked; below blank",
     [x["dark"] for x in rg], rg[0]["dark"] > 2 and rg[1]["dark"] > 2 and rg[2]["nonwhite"] == 0)

# ---------------------------------------------------------------- 3. annotations
r = rv("annots_pypdf.pdf", regions={0: [[50, 50, 70, 70], [400, 200, 560, 300], [300, 690, 560, 730], [100, 598, 280, 602], [90, 510, 180, 550], [300, 520, 330, 540],
                                        [410, 498, 490, 502], [105, 434, 117, 446], [70, 636, 205, 655], [72, 300, 200, 320], [72, 260, 200, 280]]})
rg = r["draw"]["0"]["regions"]
case("annots_pypdf.pdf", "Text (sticky note) icon drawn", "nonwhite > 20", rg[0]["nonwhite"], rg[0]["nonwhite"] > 20)
case("annots_pypdf.pdf", "Popup never drawn", "nonwhite 0", rg[1]["nonwhite"], rg[1]["nonwhite"] == 0)
case("annots_pypdf.pdf", "FreeText drawn", "nonwhite > 2", rg[2]["nonwhite"], rg[2]["nonwhite"] > 2)
case("annots_pypdf.pdf", "Line drawn", "nonwhite > 30", rg[3]["nonwhite"], rg[3]["nonwhite"] > 30)
case("annots_pypdf.pdf", "Rectangle (Square) filled green inside", "green", rg[4]["rgb"], rg[4]["rgb"][1] > 200 and rg[4]["rgb"][0] < 80 and rg[4]["rgb"][2] < 80)
case("annots_pypdf.pdf", "Ellipse (Circle) filled blue at its centre", "blue", rg[5]["rgb"], rg[5]["rgb"][2] > 200 and rg[5]["rgb"][0] < 80)
case("annots_pypdf.pdf", "Polygon edge drawn", "nonwhite > 20", rg[6]["nonwhite"], rg[6]["nonwhite"] > 20)
case("annots_pypdf.pdf", "PolyLine drawn", "nonwhite > 5", rg[7]["nonwhite"], rg[7]["nonwhite"] > 5)
case("annots_pypdf.pdf", "Highlight yellow over its words, words still dark", "yellow mean, dark > 3%", rg[8], rg[8]["rgb"][0] > 180 and rg[8]["rgb"][2] < 170 and rg[8]["dark"] > 3)
case("annots_pypdf.pdf", "Links (Border 0) not drawn", "nonwhite 0", [rg[9]["nonwhite"], rg[10]["nonwhite"]], rg[9]["nonwhite"] == 0 and rg[10]["nonwhite"] == 0)
t = r["texts"][0]
case("annots_pypdf.pdf", "text: FreeText where it lies, the note and line comment after, the popup not doubled", "FREE TEXT HERE; Note (Reviewer): Sticky A; Comment: line note",
     t, has(t, "FREE TEXT HERE", "Comments on this page:", "Note (Reviewer): Sticky A", "Comment: line note") and t.count("Sticky A") == 1)
case("annots_pypdf.pdf", "links(): to page 2 and to the web", [1, "https://example.org/manual"], r["links"][0], [l.get("page") for l in r["links"][0]] == [1, -1] and r["links"][0][1].get("uri") == "https://example.org/manual")

R_HAND = [[72, 696, 200, 699], [72, 663, 200, 665], [72, 616, 200, 619], [345, 712, 355, 722], [300, 600, 500, 650], [310, 540, 490, 570], [72, 530, 150, 580],
          [160, 530, 240, 580], [72, 440, 150, 500], [160, 440, 240, 500], [302, 442, 310, 450], [390, 480, 398, 488], [474, 444, 516, 486], [424, 444, 466, 486],
          [302, 362, 398, 408], [74, 379, 250, 392], [72, 300, 200, 302], [400, 200, 560, 300], [440, 310, 520, 330]]
r = rv("annots_hand.pdf", regions={0: R_HAND})
rg = r["draw"]["0"]["regions"]
case("annots_hand.pdf", "Underline: a blue line under the words", "blue, nonwhite > 30", rg[0], rg[0]["nonwhite"] > 30 and rg[0]["rgb"][2] > rg[0]["rgb"][0] + 20)
case("annots_hand.pdf", "StrikeOut: a red line through the middle", "red", rg[1], rg[1]["rgb"][0] > rg[1]["rgb"][2] + 20)
case("annots_hand.pdf", "Squiggly drawn", "nonwhite > 20", rg[2]["nonwhite"], rg[2]["nonwhite"] > 20)
case("annots_hand.pdf", "Ink (pen stroke) drawn magenta", "nonwhite > 20", rg[3], rg[3]["nonwhite"] > 20 and rg[3]["rgb"][1] < rg[3]["rgb"][0])
case("annots_hand.pdf", "Stamp with no drawing: its name drawn", "nonwhite > 5", rg[4]["nonwhite"], rg[4]["nonwhite"] > 5)
case("annots_hand.pdf", "Stamp with its own drawing (green)", "green", rg[5]["rgb"], rg[5]["rgb"][1] > 150 and rg[5]["rgb"][0] < 60)
case("annots_hand.pdf", "Hidden (F 2) and NoView (F 32) annotations, with or without a drawing, not drawn", "nonwhite 0,0,0",
     [rg[6]["nonwhite"], rg[7]["nonwhite"], rg[8]["nonwhite"]], rg[6]["nonwhite"] == 0 and rg[7]["nonwhite"] == 0 and rg[8]["nonwhite"] == 0)
case("annots_hand.pdf", "annotation with /OC in a layer that is off: not drawn", "nonwhite 0", rg[9]["nonwhite"], rg[9]["nonwhite"] == 0)
case("annots_hand.pdf", "appearance with its BBox far from the origin fills its Rect (both corners blue)", "blue corners", [rg[10]["rgb"], rg[11]["rgb"]],
     rg[10]["rgb"][2] > 200 and rg[10]["rgb"][0] < 60 and rg[11]["rgb"][2] > 200 and rg[11]["rgb"][0] < 60)
case("annots_hand.pdf", "appearance with a turning /Matrix: green in the right half, the left half blank", "right green, left white", [rg[12]["rgb"], rg[13]["nonwhite"]],
     rg[12]["rgb"][1] > 200 and rg[12]["rgb"][0] < 60 and rg[13]["nonwhite"] < 2)
case("annots_hand.pdf", "appearance with a small BBox scaled to its Rect (magenta all over)", "magenta", rg[14]["rgb"], rg[14]["rgb"][0] > 200 and rg[14]["rgb"][2] > 200 and rg[14]["rgb"][1] < 60)
case("annots_hand.pdf", "highlight drawn by its own appearance in Multiply blend (as Acrobat makes them): the words stay readable", "dark > 5% under the yellow",
     rg[15], rg[15]["dark"] > 5)
case("annots_hand.pdf", "a box comment with no drawing: its edge drawn in its colour", "reddish edge", rg[16], rg[16]["nonwhite"] > 20 and rg[16]["rgb"][0] > rg[16]["rgb"][2])
case("annots_hand.pdf", "a Popup with Open true is still not drawn", "nonwhite 0", rg[17]["nonwhite"], rg[17]["nonwhite"] == 0)
case("annots_hand.pdf", "CA 0.5 on a box with no drawing: half-strength blue", "about (128,128,255)", rg[18]["rgb"], 100 < rg[18]["rgb"][0] < 160 and rg[18]["rgb"][2] > 200)
t = r["texts"][0]
case("annots_hand.pdf", "text: hidden, no-view, off-layer and popup contents never read", "none of HIDDEN-/NOVIEW-/OC-OFF-/POPUP-", t,
     lacks(t, "HIDDEN-SQUARE", "NOVIEW-SQUARE", "HIDDEN-WITH-DRAWING", "OC-OFF-NOTE", "POPUP-COPY"))
case("annots_hand.pdf", "text: stamp name, underline note, the comment with its author", ["Stamp: Approved", "Comment: underlined words", "Comment (Adam): Check terminal 4"], t,
     has(t, "Stamp: Approved", "Comment: underlined words", "Comment (Adam): Check terminal 4"))
r = rv("annots_hand.pdf", layerOn={"Comments off": True}, regions={0: [[160, 440, 240, 500]]})
case("annots_hand.pdf", "the off layer turned on (pdf.layerOn): the annotation is drawn and read", "blue, OC-OFF-NOTE in text", [reg(r, 0, 0), "OC-OFF-NOTE" in r["texts"][0]],
     reg(r, 0, 0)["rgb"][2] > 200 and reg(r, 0, 0)["rgb"][0] < 100 and "OC-OFF-NOTE" in r["texts"][0])

# ---------------------------------------------------------------- 4. layers
BOX = lambda y: [402, y - 3, 548, y + 13]
LR = {0: [BOX(700), BOX(660), BOX(620), BOX(580), BOX(540), BOX(500), BOX(460), BOX(380), BOX(250), [402, 197, 548, 213], BOX(150), BOX(110)]}
expect_on = ["VISIBLE-HEADER", "ANYON-AB", "ANYOFF-AB", "VE-NOT-B", "A-OUTER", "SPAN-IN-A", "A-AFTER", "AFTER-ALL"]
expect_off = ["ALLON-AB", "ALLOFF-AC", "SINGLE-B", "VE-AND-AB", "B-IN-A", "ART-IN-B", "B-TAIL", "FORM-IN-B", "FORM-OCMD-ALLON", "VE-OVERRIDES-P"]
r = rv("layers_ocmd.pdf", regions=LR)
t = r["texts"][0]; rg = r["draw"]["0"]["regions"]
case("layers_ocmd.pdf", "layers listed as the PDF opens: A on, B off, C on", [("Layer A", True), ("Layer B", False), ("Layer C", True)], [(l["name"], l["on"]) for l in r["layers"]],
     [(l["name"], l["on"]) for l in r["layers"]] == [("Layer A", True), ("Layer B", False), ("Layer C", True)])
for w in expect_on:
    case("layers_ocmd.pdf", "text in a visible part is read: " + w, "present", w in t, w in t)
for w in expect_off:
    case("layers_ocmd.pdf", "text in a hidden part is not read: " + w, "absent", w in t, w not in t)
names = ["ALLON-AB (OCMD AllOn A,B)", "ANYON-AB", "ANYOFF-AB", "ALLOFF-AC (OCMD AllOff A,C)", "SINGLE-B (OCMD /OCGs B)", "VE-NOT-B (OCMD /VE [/Not B])",
         "VE-AND-AB (OCMD /VE [/And A B])", "B-IN-A (nested BDC)", "FORM-IN-B (Form XObject inside a hidden BDC)", "image inside a hidden BDC",
         "Form XObject with /OC = OCMD AllOn", "VE-OVERRIDES-P (VE false, OCGs+P true)"]
want_drawn = [False, True, True, False, False, True, False, False, False, False, False, False]
for k, (nm, wd) in enumerate(zip(names, want_drawn)):
    case("layers_ocmd.pdf", "box drawn? " + nm, "drawn" if wd else "not drawn", rg[k]["nonwhite"], (rg[k]["nonwhite"] > 30) if wd else (rg[k]["nonwhite"] == 0))
r = rv("layers_ocmd.pdf", layerOn={"Layer B": True}, regions=LR)
t = r["texts"][0]; rg = r["draw"]["0"]["regions"]
case("layers_ocmd.pdf", "Layer B turned on: its parts read", ["ALLON-AB", "SINGLE-B", "B-IN-A", "ART-IN-B", "B-TAIL", "FORM-IN-B", "VE-AND-AB"], t,
     has(t, "ALLON-AB", "SINGLE-B", "B-IN-A", "ART-IN-B", "B-TAIL", "FORM-IN-B", "VE-AND-AB"))
case("layers_ocmd.pdf", "Layer B turned on: ALLOFF-AC still hidden, VE-NOT-B now hidden", "absent both", [w in t for w in ("ALLOFF-AC", "VE-NOT-B")], lacks(t, "ALLOFF-AC", "VE-NOT-B"))
case("layers_ocmd.pdf", "Layer B turned on: its boxes and picture drawn (AllOn, single B, nested, form, image)", "drawn", [rg[k]["nonwhite"] for k in (0, 4, 7, 8, 9)],
     all(rg[k]["nonwhite"] > 30 for k in (0, 4, 7, 8, 9)))
r = rv("layers_baseoff.pdf", regions={0: [BOX(700), BOX(660)]})
case("layers_baseoff.pdf", "BaseState /OFF with /ON [X]: X on, Y off", [("Layer X", True), ("Layer Y", False)], [(l["name"], l["on"]) for l in r["layers"]],
     [(l["name"], l["on"]) for l in r["layers"]] == [("Layer X", True), ("Layer Y", False)])
case("layers_baseoff.pdf", "BaseState /OFF: X read and drawn, Y neither", "X-SHOWN, blue box; no Y", [r["texts"][0], [x["nonwhite"] for x in r["draw"]["0"]["regions"]]],
     "X-SHOWN" in r["texts"][0] and "Y-HIDDEN" not in r["texts"][0] and reg(r, 0, 0)["nonwhite"] > 30 and reg(r, 0, 1)["nonwhite"] == 0)
r = rv("layers_baseoff.pdf", layerOn={"Layer X": False, "Layer Y": True}, regions={0: [BOX(700), BOX(660)]})
case("layers_baseoff.pdf", "turned the other way with pdf.layerOn: Y read and drawn, X neither", "Y-HIDDEN, red box; no X", [r["texts"][0], [x["nonwhite"] for x in r["draw"]["0"]["regions"]]],
     "Y-HIDDEN" in r["texts"][0] and "X-SHOWN" not in r["texts"][0] and reg(r, 0, 1)["nonwhite"] > 30 and reg(r, 0, 0)["nonwhite"] == 0)
r = rv("layers_scan_off.pdf", regions={0: [[310, 610, 490, 690]]}, pageImage=[[310, 610, 490, 690]])
case("layers_scan_off.pdf", "scanned page, a picture in an off layer: pageDraw leaves it out", "light grey (224)", reg(r, 0, 0)["rgb"], reg(r, 0, 0)["rgb"][0] > 200)
case("layers_scan_off.pdf", "scanned page, a picture in an off layer: pageImage (what Text Reader reads for a scanned page) leaves it out", "light grey (224)",
     r.get("pageImage"), r.get("pageImage") and r["pageImage"][0]["rgb"][0] > 200)

# ---------------------------------------------------------------- 5. bookmarks and links
r = rv("nav_deep.pdf", draw=False)
o = r["outline"]
def depth(items, k=1): return max([k] + [depth(i["kids"], k + 1) for i in items if i["kids"]])
case("nav_deep.pdf", "15 levels of nesting all listed", 15, depth(o[:1]), depth(o[:1]) == 15)
deep_pages = []; it = o[0]
while it: deep_pages.append(it["page"]); it = it["kids"][0] if it["kids"] else None
case("nav_deep.pdf", "each level's page", [k % 5 for k in range(15)], deep_pages, deep_pages == [k % 5 for k in range(15)])
want = [("Old named", 2), ("Tree named", 4), ("GoTo beta", 1), ("Ünïcödé – 日本 ✓", 0), ("Safety – first ﬁ fi", 1),
        ("Web", -1), ("Limit edge", 3), ("Missing name", -1), ("Dest dict name", 1), ("GoTo name", 2), ("Tree name via name object", 4), ("Next tree leaf", 3)]
got = [(x["title"], x["page"]) for x in o[1:]]
for k, (w, g) in enumerate(zip(want, got)):
    what = ["PDF 1.1 /Dests name", "Names tree with Kids/Limits, << /D >> form", "GoTo action, named (string)", "UTF-16 title",
            "PDFDocEncoding title (\\205 en dash, \\223 fi ligature)", "URI item", "name equal to a Limits bound", "unknown name gives -1",
            "/Dests value as << /D >>", "GoTo with a name object", "name object found in the Names tree (as pdf.js does)", "a later leaf of the tree"][k]
    case("nav_deep.pdf", "bookmark: " + what, list(w), list(g), w == g)
case("nav_deep.pdf", "URI bookmark keeps its address", "https://example.org/x", o[6].get("uri"), o[6].get("uri") == "https://example.org/x")
case("nav_deep.pdf", "links(): named (tree), GoTo name, URI, explicit, GoTo string", [4, 2, -1, 2, 1], [l["page"] for l in r["links"][0]],
     [l["page"] for l in r["links"][0]] == [4, 2, -1, 2, 1])
r = rv("nav_cycle.pdf", draw=False)
o = r.get("outline") or []
case("nav_cycle.pdf", "Next leading back to the first item, and a child's First leading to the top: no hang, each item once",
     [["One", "Two", "Three"], ["Two-a", "Two-b"]], [[x["title"] for x in o], [x["title"] for x in o[1]["kids"]] if len(o) > 1 else None],
     [x["title"] for x in o] == ["One", "Two", "Three"] and [x["title"] for x in o[1]["kids"]] == ["Two-a", "Two-b"] and r.get("outlineMs", 99) < 1000)
r = rv("nav_selfloop.pdf", draw=False)
case("nav_selfloop.pdf", "an item whose Next and First are itself: listed once, no hang", [["Self", 0]], [[x["title"], x["page"]] for x in r.get("outline") or []],
     [[x["title"], x["page"]] for x in r.get("outline") or []] == [["Self", 0]])
r = rv("nav_rl_pypdf.pdf", draw=False)
got = [(x["title"], x["page"], [(k["title"], k["page"]) for k in x["kids"]]) for x in r["outline"]]
want = [("Intro", 0, []), ("Wiring – main panel", 1, [("Схема", 2)]), ("Safety – first “quoted”", 0, [("Spare parts • list", 2)])]
case("nav_rl_pypdf.pdf", "reportlab and pypdf bookmarks (pypdf writes – “ ” • in PDFDocEncoding)", [list(map(str, w)) for w in want], [list(map(str, g)) for g in got], got == want)

# ---------------------------------------------------------------- 6b. more: forms in object streams of a locked file, passwords, PDF 2.0 strings
h = rv("form_hand.pdf", drawPages=[0, 1])
r = rv("form_hand_objstm_aes128.pdf", drawPages=[0, 1])
case("form_hand_objstm_aes128.pdf", "a locked form whose fields sit in object streams (qpdf AES-128): reads and draws as the unlocked form", "same text, same pixels",
     [r.get("texts") == h["texts"], r.get("draw", {}).get("0", {}).get("hash") == h["draw"]["0"]["hash"], r.get("openError")],
     r.get("texts") == h["texts"] and r["draw"]["0"]["hash"] == h["draw"]["0"]["hash"] and r["draw"]["1"]["hash"] == h["draw"]["1"]["hash"])
h = rv("form_rl.pdf", drawPages=[0, 1])
r = rv("form_rl_objstm_rc4.pdf", drawPages=[0, 1])
case("form_rl_objstm_rc4.pdf", "a locked reportlab form (RC4-128, object streams): fields and their own drawings as unlocked", "same text, same pixels, same fields",
     [r.get("texts") == h["texts"], r.get("draw", {}).get("0", {}).get("hash") == h["draw"]["0"]["hash"], r.get("fields") == h["fields"], r.get("openError")],
     r.get("texts") == h["texts"] and r["draw"]["0"]["hash"] == h["draw"]["0"]["hash"] and r.get("fields") == h["fields"])
r = rv("pdftk_rc4_128_user_long.pdf", draw=False, pw="averyveryverylongpasswordthatexceeds32ch")
case("pdftk_rc4_128_user_long.pdf", "a 40-character user password (revision 3 uses the first 32) opens it", "opens, same text", r.get("openError") or "opened", r.get("texts") == base["texts"])
for f in ["qpdf_aes128_user_euro.pdf", "qpdf_aes256_user_euro.pdf"]:
    r = rv(f, draw=False, pw="\u20acuro-5")
    case(f, "a user password with a euro sign (qpdf writes it as PDFDocEncoding 0xA0 for revision 4, UTF-8 for 6) opens it", "opens, same text",
         r.get("openError") or "opened", r.get("texts") == base["texts"])
r = rv("pdf20_utf8_strings.pdf", regions={0: [[152, 656, 330, 672]]})
case("pdf20_utf8_strings.pdf", "PDF 2.0 UTF-8 (EF BB BF) bookmark title", "Wiring \u2013 panel \u00e9t\u00e9", r["outline"][0]["title"] if r.get("outline") else None,
     r.get("outline") and r["outline"][0]["title"] == "Wiring \u2013 panel \u00e9t\u00e9")
case("pdf20_utf8_strings.pdf", "PDF 2.0 UTF-8 field value read beside its label", "Address: Stra\u00dfe 7 \u2013 Tor 2", r["texts"][0], "Address: Stra\u00dfe 7 \u2013 Tor 2" in r["texts"][0])

# ---------------------------------------------------------------- 6c. linearized (Fast Web View) locked PDFs
r = rv("lin_plain.pdf", drawPages=[0, 1])
case("lin_plain.pdf", "linearized, no lock: text and drawing as the original (control)", "same", [r.get("texts") == base["texts"], r["draw"]["0"]["hash"] == base["draw"]["0"]["hash"]],
     r.get("texts") == base["texts"] and r["draw"]["0"]["hash"] == base["draw"]["0"]["hash"])
case("lin_plain.pdf", "linearized, no lock: the Info title (named in the first-page trailer) is read", "Lock Test Title", r.get("title"), r.get("title") == "Lock Test Title")
for f, meth in [("lin_aes128_owner.pdf", "AES-128"), ("lin_rc4_128_owner.pdf", "RC4-128"), ("lin_objstm_aes256_owner.pdf", "AES-256")]:
    r = rv(f, drawPages=[0, 1])
    case(f, "linearized + locked against changes: seen as locked (" + meth + ")", {"locked": True, "method": meth}, r.get("openError") or r.get("security"),
         (r.get("security") or {}).get("method") == meth)
    case(f, "linearized + locked against changes: text exactly the unlocked text", base["texts"], r.get("texts") or r.get("openError"), r.get("texts") == base["texts"])
    case(f, "linearized + locked against changes: drawn as the unlocked PDF", "same hashes", [r.get("draw", {}).get(str(p), {}).get("hash") for p in (0, 1)],
         all(r.get("draw", {}).get(str(p), {}).get("hash") == base["draw"][str(p)]["hash"] for p in (0, 1)))
r = rv("lin_aes256_user.pdf", draw=False)
case("lin_aes256_user.pdf", "linearized + a user password: asks for it (needPassword)", {"needPassword": True}, {"openError": r.get("openError"), "texts": r.get("texts"), "security": r.get("security")},
     r.get("needPassword") is True)
r = rv("lin_aes256_user.pdf", draw=False, pw="lantern")
case("lin_aes256_user.pdf", "linearized + a user password, given: text exactly the unlocked text", base["texts"], r.get("texts") or r.get("openError"), r.get("texts") == base["texts"])

# ---------------------------------------------------------------- 6d. damaged PDFs: nothing should throw or hang
r = rv("damaged_mix.pdf", drawPages=[0], regions={0: [[50, 50, 100, 100], [72, 645, 250, 665]]})
case("damaged_mix.pdf", "null/missing/junk annotations, short Rect/QuadPoints/InkList/L, missing AP, OCGs not an array, a /Parent loop, an outline item with no title: no error",
     "opens; text, fields, outline, drawing all return", {"openError": r.get("openError"), "errors": r.get("errors"), "harness": r.get("harnessError")},
     not r.get("openError") and not r.get("errors") and not r.get("harnessError") and r.get("texts") and "Damaged but readable" in r["texts"][0])
case("damaged_mix.pdf", "an inverted Rect [100 100 50 50] is drawn normalised (blue box at 50-100)", "blue", reg(r, 0, 0)["rgb"] if r.get("draw") else None,
     r.get("draw") and reg(r, 0, 0)["rgb"][2] > 200 and reg(r, 0, 0)["rgb"][0] < 60)
case("damaged_mix.pdf", "/OC naming a property that does not exist: drawn and read (as other viewers do)", "UNKNOWN-PROPERTY read and drawn",
     [("UNKNOWN-PROPERTY" in (r.get("texts") or [""])[0]), reg(r, 0, 1)["dark"] if r.get("draw") else None], "UNKNOWN-PROPERTY" in (r.get("texts") or [""])[0] and reg(r, 0, 1)["dark"] > 2)
nm = [x["name"] for x in r.get("fields") or [] if x["value"] == "LOOPED"]
case("damaged_mix.pdf", "a field whose /Parent points to itself: a sane name (not 'loop.loop.loop...')", "loop", nm, nm == ["loop"])
for f in ["damaged_lock_no_OU.pdf", "damaged_lock_r6_no_UE.pdf"]:
    r = rv(f, draw=False)
    case(f, "a lock with its O/U (or UE) strings missing: says the lock is damaged rather than asking for a password no one can give", "error, needPassword false",
         {"msg": r.get("openError"), "needPassword": r.get("needPassword")}, bool(r.get("openError")) and not r.get("needPassword"))

# ---------------------------------------------------------------- 6. Text Reader: a password asked, a scanned page drawn
TRJS = """async (a) => {
  var TR = Lantern.textReader, buf = await (await fetch(a.f)).arrayBuffer(), asked = [], out = {};
  var file = new File([buf], a.f.split('/').pop(), {type: 'application/pdf'});
  try {
    var doc = await TR.docs.open([file], {askPassword: function (n, wrong) { asked.push([n, wrong]); return a.answers[n - 1] === undefined ? null : a.answers[n - 1]; }});
    out.security = doc.pdf.security; out.pages = doc.pages.length;
    if (a.read) { await TR.docs.readSection(doc, 0, {}); out.text = TR.docs.text(doc); }
    if (a.picture) { var cv = await TR.docs.picture(doc, 0), g = cv.getContext('2d'), s = cv.width / doc.pdf.pages[0].w, r = a.picture;
      var d = g.getImageData(Math.round(r[0]*s), Math.round(cv.height - r[3]*s), Math.round((r[2]-r[0])*s), Math.round((r[3]-r[1])*s)).data, R = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) { R += d[i]; n++; } out.pictureMeanR = Math.round(R / n); }
  } catch (e) { out.error = String(e.message || e); }
  out.asked = asked; return out;
}"""
def tr(f, **k):
    k["f"] = "/rv/" + f; k.setdefault("answers", [])
    try: return B.pages["new"].evaluate(TRJS, k)
    except Exception as e: return {"harnessError": str(e)[:300]}
x = tr("pdftk_rc4_128_user.pdf", answers=["wrong", "lantern"], read=True)
case("pdftk_rc4_128_user.pdf", "Text Reader: asks, says the first try was wrong, opens with the second, reads page 1", "asked [[1,false],[2,true]]; text has 'Lock test page one'",
     x, x.get("asked") == [[1, False], [2, True]] and "Lock test page one" in (x.get("text") or ""))
x = tr("pdftk_rc4_128_user.pdf", answers=[None])
case("pdftk_rc4_128_user.pdf", "Text Reader: the person cancels: a plain error, no crash", "error 'needs its password'", x, "password" in (x.get("error") or ""))
x = tr("layers_scan_off.pdf", picture=[310, 610, 490, 690])
case("layers_scan_off.pdf", "Text Reader's picture of a scanned page leaves out a picture in a layer that is off", "mean red > 200 (light grey)", x.get("pictureMeanR"),
     (x.get("pictureMeanR") or 0) > 200)

# ---------------------------------------------------------------- 7. older PDFs: nothing changed that should not have
OLDPDFS = [("tr", f) for f in sorted(os.listdir(MOUNTS["tr"])) if f.endswith(".pdf")] + [("po", "plain.pdf"), ("po", "annotated.pdf"), ("po", "nav.pdf"),
          ("po", "layers.pdf"), ("po", "form_filled.pdf"), ("sh", "ode_clarinet.pdf")] + [("docs", f) for f in sorted(os.listdir(MOUNTS["docs"])) if f.endswith(".pdf")]
for mnt, f in OLDPDFS:
    rn = B.probe(mnt + "/" + f, drawPages=[0, 1, 2], maxPages=40)
    if rn.get("openError") or rn.get("harnessError"):
        case(mnt + "/" + f, "older PDF opens", "opens", rn.get("openError") or rn.get("harnessError"), False); continue
    case(mnt + "/" + f, "older PDF: no errors reading text, annotations or drawing (up to 40 pages)", "[]", rn["errors"], not rn["errors"])
    if OLD:
        ro = B.probe(mnt + "/" + f, which="old", drawPages=[0, 1, 2], maxPages=40)
        ann = [any(a["sub"] != "Link" and not a["hidden"] for a in pa) for pa in rn.get("annots") or []]
        if any(not l["on"] for l in rn.get("layers") or []): ann = [True] * len(ann)   # a layer that is off: its parts are meant to go
        diffs = [i for i, (a, b) in enumerate(zip(ro.get("texts") or [], rn["texts"])) if a != b]
        case(mnt + "/" + f, "older PDF: text the same as before 1.24.39 on every page with nothing on top of it (annotations, fields)",
             "differences only on pages with annotations", {"pages differing": diffs, "pages with annotations": [i for i, x in enumerate(ann) if x]},
             all(ann[i] if i < len(ann) else False for i in diffs))
        dd = [p for p in ("0", "1", "2") if p in ro.get("draw", {}) and ro["draw"][p]["hash"] != rn["draw"][p]["hash"]]
        case(mnt + "/" + f, "older PDF: pages 1-3 drawn as before unless something lies on them", "differences only on pages with annotations",
             {"pages differing": dd, "pages with annotations": [i for i, x in enumerate(ann) if x]}, all(ann[int(p)] for p in dd))
        if diffs:
            print("   text diff example:", json.dumps([ro["texts"][diffs[0]][-200:], rn["texts"][diffs[0]][-200:]], ensure_ascii=False)[:600])
case("(all)", "no uncaught page errors in the browser during the review", "[]", B.errs, not any(B.errs.values()))
B.close()
# (1.24.39, the release) cases.json is the review's record: written again only when the review is run whole (with LANTERN_OLD)
if OLD: json.dump(cases, open(os.path.join(HERE, "cases.json"), "w"), indent=1, ensure_ascii=False)
n = len(cases); bad = [c for c in cases if not c["pass"]]
print("%d cases, %d pass, %d fail" % (n, n - len(bad), len(bad)))
