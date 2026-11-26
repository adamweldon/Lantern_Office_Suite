# pdf_tile_e2e.py -- the PDF tile (1.24.40) in a real browser (Chromium via Playwright): open, find, go to a page,
# the side panels; and every tool that changes a PDF, each result checked by qpdf, pypdf or poppler: pages, stamp,
# comment, sign, fill in, flatten, save, undo, a maker's limits said and the work done, a password asked in the page, Text Reader taking the PDF; redaction
# (what is marked gone from the whole file, poppler's own word boxes inside the marks, a turned page kept turned)
# and removing hidden information; export (PNG, JPEG, a zip, the words); compare two versions; a picture combined
# as a page; pictures made smaller; a PDF's own words changed; a PDF made into a form. PDFs: tests/fixtures/pdf_open, pdf_review1_1239, pdf_edit (make_fixtures.py there says how).
# Usage: python3 tests/browser/pdf_tile_e2e.py
import os, sys, re, threading, http.server, socketserver, json, base64, subprocess, tempfile, zipfile
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SITE = os.path.join(ROOT, "site", "index.html") if len(sys.argv) < 2 else sys.argv[1]
OUT = tempfile.mkdtemp(prefix="pdf_tile_")
DIRS = [os.path.join(ROOT, "tests", "fixtures", d) for d in ("pdf_open", "pdf_review1_1239", "pdf_edit")]
FX = DIRS[0]
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0]
        if p in ("/", "/index.html"): return SITE
        for d in DIRS:
            f = os.path.join(d, p.lstrip("/"))
            if os.path.exists(f): return f
        return "/nonexistent"
srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = 0; n = 0
def check(name, cond, info=""):
    global fails, n
    n += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:500]))
    if not cond: fails += 1
def qdf(path): return subprocess.run(["qpdf", "--qdf", "--object-streams=disable", path, "-"], capture_output=True).stdout
def qcheck(path): r = subprocess.run(["qpdf", "--check", path], capture_output=True, text=True); return r.returncode in (0, 3), r.stdout[-300:] + r.stderr[-300:]
def ptext(path, page): return subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), path, "-"], capture_output=True, text=True).stdout

# --- the tile and its tools ---
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900}); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    answers = []
    def on_dialog(d):
        a = answers.pop(0) if answers else ""
        d.accept(a) if d.type in ("prompt", "confirm") else d.accept()
    pg.on("dialog", on_dialog)
    pg.goto("http://127.0.0.1:%d/index.html#pdf" % port)
    pg.wait_for_function("!!(window.Lantern && Lantern.pdfView)", timeout=60000)
    pg.wait_for_selector("text=Open a PDF", timeout=30000)
    def stat(): return pg.evaluate("(document.querySelector('[aria-live=polite]')||{}).textContent||''")
    def open_pdf(name):
        pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", os.path.join(FX, name))
    def wait_stat(rx, t=20000):
        pg.wait_for_function("(rx) => { var s = Array.prototype.map.call(document.querySelectorAll('[aria-live=polite]'), function (e) { return e.textContent; }).join(' '); return new RegExp(rx).test(s); }", arg=rx, timeout=t)
    open_pdf("plain.pdf"); wait_stat(r"2 pages\.")
    pg.wait_for_function("document.querySelectorAll('.pv-page canvas').length >= 1", timeout=20000)
    check("opened: 2 pages, the first drawn", True)
    tools = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('.pv-bar button'), function (b) { return b.textContent; })")
    for t in ["Pages", "Combine", "Stamp", "Measure", "Fill in", "Comment", "Sign", "Flatten", "Save", "Print", "Find"]:
        check("the tile has " + t, t in tools, tools)
    # find
    pg.fill("input[type=search]", "overload"); pg.click("text=Find"); wait_stat("2 places found|Place 1 of 2")
    check("find: both places marked", pg.evaluate("document.querySelectorAll('.pv-hit').length") >= 1, stat())
    # go to page 2
    pg.fill("input[aria-label=Page]", "2"); pg.dispatch_event("input[aria-label=Page]", "change"); pg.wait_for_timeout(300)
    check("go to page 2", pg.evaluate("Lantern.pdfView.api.page()") == 1, pg.evaluate("Lantern.pdfView.api.page()"))
    # stamp page numbers, then undo
    pg.click(".pv-bar button:text-is('Stamp')"); pg.click("text=Apply"); wait_stat("Stamped")
    t = pg.evaluate("Lantern.pdfView.api.textOf(1).then(function (t) { return t.text; })")
    check("stamp: page numbers on the pages", "Page 2 of 2" in t, t)
    pg.click(".pv-bar button:text-is('Undo')"); wait_stat(r"2 pages\.")
    t = pg.evaluate("Lantern.pdfView.api.textOf(1).then(function (t) { return t.text; })")
    check("undo: the stamp is gone", "Page 2 of 2" not in t, t)
    # comment: a box dragged on page 1
    pg.evaluate("Lantern.pdfView.api.go(0)"); pg.wait_for_timeout(300)
    pg.click(".pv-bar button:text-is('Comment')")
    pg.select_option("select[aria-label='What to add']", "box")
    box = pg.evaluate("(function () { var r = Lantern.pdfView.api.pageEl(0).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    x0, y0 = box[0] + box[2] * 0.5, max(box[1], 0) + 250
    want = pg.evaluate("(a) => { var api = Lantern.pdfView.api, r = api.pageEl(0).getBoundingClientRect(), p = api.toPdf(0, a[0] - r.left, a[1] - r.top), q = api.toPdf(0, a[0] + 60 - r.left, a[1] + 40 - r.top); return [p[0], q[1], q[0], p[1]].map(Math.round); }", [x0, y0])
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 60, y0 + 40, steps=5); pg.mouse.up()
    pg.wait_for_timeout(200)
    check("comment: one waiting to be written", "1 not yet written" in pg.inner_text("body"), pg.inner_text("body")[-120:])
    # a note too (asks for its words)
    pg.select_option("select[aria-label='What to add']", "note")
    answers.append("Check torque 45 Nm")
    pg.mouse.move(box[0] + 40, box[1] + 40); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(200)
    pg.click("button:text-is('Apply')"); wait_stat("Written into the PDF")
    an = pg.evaluate("Lantern.pdf.annots(Lantern.pdfView.api.pdf, 0).then(function (a) { return a.map(function (x) { return [x.sub, x.rect.map(Math.round), x.contents || '']; }); })")
    check("comment: a box and a note written into the PDF", sorted(a[0] for a in an) == ["Square", "Text"], an)
    sq = [a for a in an if a[0] == "Square"]
    check("comment: the box where it was dragged", sq and all(abs(sq[0][1][k] - want[k]) <= 2 for k in range(4)), [sq, want])
    check("comment: the note's words kept", any("torque" in a[2] for a in an), an)
    pg.click("button:text-is('Done')")
    # sign: a typed name, tapped on page 1
    pg.click(".pv-bar button:text-is('Sign')")
    pg.fill("input[placeholder='or type your name']", "Adam Weldon"); pg.click("button:text-is('Use it')")
    pg.mouse.click(box[0] + 100, max(box[1], 0) + 500); pg.wait_for_timeout(200)
    pg.click("button:text-is('Apply')"); wait_stat("Written into the PDF")
    an = pg.evaluate("Lantern.pdf.annots(Lantern.pdfView.api.pdf, 0).then(function (a) { return a.map(function (x) { return [x.sub, x.name || '', !!x.apRef]; }); })")
    check("sign: the signature is on the page, with its picture", any(a[0] == "Stamp" and a[2] for a in an), an)
    pg.click("button:text-is('Done')")
    # save: the download is a PDF qpdf accepts
    with pg.expect_download() as dl:
        pg.click(".pv-bar button:text-is('Save')")
    f = os.path.join(OUT, "saved.pdf"); dl.value.save_as(f)
    r = subprocess.run(["qpdf", "--check", f], capture_output=True, text=True)
    check("save: the file passes qpdf", r.returncode in (0, 3), r.stdout[-300:] + r.stderr[-300:])
    r2 = subprocess.run(["python3", "-c", "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(sorted(a.get_object()['/Subtype'] for a in r.pages[0]['/Annots']))", f], capture_output=True, text=True)
    check("save: pypdf reads the box, the note and the signature", "/Square" in r2.stdout and "/Text" in r2.stdout and "/Stamp" in r2.stdout, r2.stdout + r2.stderr)
    subprocess.run(["pdftoppm", "-r", "50", "-png", "-singlefile", f, os.path.join(OUT, "saved")])
    # flatten
    answers.append("")
    pg.click(".pv-bar button:text-is('Flatten')"); wait_stat("Flattened")
    an = pg.evaluate("Lantern.pdf.annots(Lantern.pdfView.api.pdf, 0).then(function (a) { return a.length; })")
    check("flatten: no comments left over the page", an == 0, an)
    # fill in a form
    open_pdf("form_plain.pdf"); wait_stat(r"1 page\.")
    pg.click(".pv-bar button:text-is('Fill in')"); pg.wait_for_selector("input[title=name]")
    pg.fill("input[title=name]", "JOHN SMITH"); pg.click("button:text-is('Apply')"); wait_stat("The form is filled in")
    fv = pg.evaluate("Lantern.pdf.fields(Lantern.pdfView.api.pdf).then(function (f) { var o = {}; f.forEach(function (x) { o[x.name] = x.value; }); return o; })")
    check("fill in: the name typed on the page is in the PDF, the rest kept", fv.get("name") == "JOHN SMITH" and fv.get("shift") == "Night shift", fv)
    # pages: turn page 1 right and add a blank page
    open_pdf("nav.pdf"); wait_stat(r"3 pages\.")
    pg.click(".pv-bar button:text-is('Pages')"); pg.wait_for_timeout(500)
    pg.click("text=Pick all"); pg.click("text=Turn right"); pg.click("text=Pick none"); pg.click("text=Add a blank page")
    pg.click("button.primary:text-is('Apply')"); wait_stat("Pages changed")
    info = pg.evaluate("(function (p) { return {n: p.count, rot: p.pages.map(function (x) { return x.rotate; })}; })(Lantern.pdfView.api.pdf)")
    check("pages: all turned right, a blank page added", info["n"] == 4 and info["rot"][:3] == [90, 90, 90], info)
    # bookmarks panel
    side = pg.inner_text(".pv-side") if pg.query_selector(".pv-side") else ""
    pg.click(".pv-side button:text-is('Bookmarks')"); pg.wait_for_timeout(300)
    side = pg.inner_text(".pv-side")
    check("bookmarks panel lists the sections", "Section 2" in side or "Wiring" in side, side[:300])
    # measure: opens its bar
    pg.click(".pv-bar button:text-is('Measure')")
    check("measure: its bar opens", pg.is_visible("text=Set scale"), "")
    pg.click("button:text-is('Done')")
    # (1.24.41) a PDF whose maker asked that it not be printed or changed (Adam, 2026-11-26: "say so and do what the
    # person wants"): no question asked; the line under the toolbar says what its maker asked, and it is done
    dlg = []
    pg.on("dialog", lambda d: dlg.append(d.message))
    open_pdf("owner_aes_256_noprint.pdf"); wait_stat(r"maker asked that it not be printed")
    pg.click(".pv-bar button:text-is('Stamp')"); pg.click("text=Apply"); wait_stat("Stamped")
    t = pg.evaluate("Lantern.pdfView.api.textOf(0).then(function (t) { return t.text; })")
    wl = pg.evaluate("(document.querySelector('.pv-wish')||{}).textContent||''")
    check("a maker's 'no changes': the stamp made with no question asked", re.search(r"Page 1 of \d", t) is not None and not dlg, (dlg, t[:200]))
    check("a maker's 'no changes': said on its own line", "asked that this PDF not be changed; done as you asked, in a new copy" in wl, wl)
    pg.evaluate("window.__printed = 0; window.print = function () { window.__printed++; }")
    pg.click(".pv-bar button:text-is('Print')"); pg.wait_for_function("window.__printed > 0", timeout=60000)
    wl = pg.evaluate("(document.querySelector('.pv-wish')||{}).textContent||''")
    check("a maker's 'no printing': printed with no question asked, and said", not dlg and "not be printed; printed as you asked" in wl and "not be changed" in wl, (dlg, wl))
    open_pdf("plain.pdf"); wait_stat(r"2 pages\.")
    wl = pg.evaluate("(document.querySelector('.pv-wish')||{}).textContent||''")
    check("another PDF opened: the line is gone", wl == "", wl)
    # a PDF with a password: asked in the page, a wrong one refused
    open_pdf("user_aes_256.pdf"); pg.wait_for_selector("input[aria-label=Password]")
    pg.fill("input[aria-label=Password]", "nope"); pg.click(".pv-pw button"); pg.wait_for_selector("text=That password does not open it")
    check("password: a wrong one is refused in the page", True)
    pg.fill("input[aria-label=Password]", "lantern"); pg.click(".pv-pw button"); wait_stat(r"2 pages\.")
    check("password: the right one opens it", "with a password" in stat(), stat())
    # hand-off to Text Reader
    if pg.query_selector("text=Read in Text Reader"):
        pg.click("text=Read in Text Reader"); pg.wait_for_function("location.hash === '#reader'")
        pg.wait_for_function("document.body.innerText.indexOf('Pump P-101') >= 0 || /password/i.test(document.body.innerText)", timeout=60000)
        check("Text Reader takes the PDF", True)
    else:
        check("Text Reader button present", False, "")
    check("no page errors", not errs, errs)
    b.close()

# --- redaction and removing hidden information ---
JS = """async (a) => {
  var P = Lantern.pdf, pdf = await P.open(await (await fetch(a.f)).blob(), a.pw ? {password: a.pw} : {}), out = {};
  if (a.flatFirst) pdf = await P.open(await P.flatten(pdf, {forms: true, comments: true}));   // as the Redact tool does before marking
  var areas = [];
  if (a.word) for (var i = 0; i < pdf.count; i++) { if (a.pages && a.pages.indexOf(i) < 0) continue; P.redactMarks((await P.pageText(pdf, i)).boxes, a.word.toLowerCase()).forEach(function (r) { areas.push({page: i, rect: r}); }); }
  if (a.rect) areas.push({page: a.page || 0, rect: a.rect});
  if (a.annot) (await P.annots(pdf, a.page || 0)).forEach(function (an) { if (an.sub === a.annot) areas.push({page: a.page || 0, rect: an.rect}); });
  out.areas = areas;
  var b = a.sanitize ? P.sanitize(pdf, a.sanitize) : await P.redact(pdf, {areas: areas, words: a.word && !a.noWords ? [a.word] : []});
  var s = ''; for (var j = 0; j < b.length; j += 8192) s += String.fromCharCode.apply(null, b.subarray(j, j + 8192));
  out.b64 = btoa(s);
  return out;
}"""
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto("http://127.0.0.1:%d/index.html" % port)
    pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.redact)", timeout=60000)
    def run(f, out, **k):
        k["f"] = f; r = pg.evaluate(JS, k); path = os.path.join(OUT, out); open(path, "wb").write(base64.b64decode(r["b64"])); return r, path
    # a word on page 1
    r, f = run("plain.pdf", "red_plain.pdf", word="overload", pages=[0])
    check("one mark found and made", len(r["areas"]) == 1, r["areas"])
    ok, info = qcheck(f); check("qpdf checks the redacted PDF clean", ok, info)
    t1, t2 = ptext(f, 1), ptext(f, 2)
    check("page 1: the marked word is gone from its words, the rest of its line kept (searchable, in its place)", "overload" not in t1 and "Check the motor" in t1, t1)
    check("page 1: its other words are still there to find and copy", "Pump P-101 page 1" in t1, t1)
    check("page 2, not marked, as it was", "overload" in t2 and "Pump P-101 page 2" in t2, t2)
    raw = qdf(f)
    check("in the whole file, 'overload' is only page 2's", raw.count(b"overload") == 1, raw.count(b"overload"))
    subprocess.run(["pdftoppm", "-r", "72", "-f", "1", "-l", "1", "-png", "-singlefile", f, os.path.join(OUT, "red_plain")])
    from PIL import Image
    im = Image.open(os.path.join(OUT, "red_plain.png")).convert("L"); a0 = r["areas"][0]["rect"]; H = im.height
    box = (int(a0[0]) + 2, int(H - a0[3]) + 2, int(a0[2]) - 2, int(H - a0[1]) - 2)
    px = list(im.crop(box).getdata())
    check("the marked place is black when another viewer draws it", px and max(px) < 60, (box, max(px) if px else None))
    # a filled form: the field's value marked
    r, f = run("form_filled.pdf", "red_form.pdf", word="WELDON")
    raw = qdf(f)
    check("a form: the marked name is nowhere in the file (the form flattened first)", b"WELDON" not in raw and len(r["areas"]) >= 1, (r["areas"], raw.count(b"WELDON")))
    check("a form: no fields left to hold it", b"/AcroForm" not in raw, "")
    ok, info = qcheck(f); check("a form: qpdf checks it clean", ok, info)
    # comments on a marked page do not survive
    r, f = run("annotated.pdf", "red_ann.pdf", annot="FreeText", page=0)
    raw = qdf(f)
    check("a typed comment marked: its words are not in the file", b"CHECK THIS" not in raw and len(r["areas"]) == 1, (raw.count(b"CHECK THIS"), r["areas"]))
    check("a note on the marked page (its words never on the page) is not in the file", b"sticky note" not in raw, raw.count(b"sticky note"))
    # the find's marks, without the words kept back from the invisible text: the marks alone cover the form's value
    r, f = run("form_filled.pdf", "red_form2.pdf", word="WELDON", noWords=True, flatFirst=True)
    raw = qdf(f)
    check("a form's value marked by finding it (flattened first, as the tool does): covered by the mark itself", b"WELDON" not in raw, (r["areas"], raw.count(b"WELDON")))
    def covered(src, words, area, pageh=792):
        # poppler's own box for each word (an oracle Lantern did not write): inside the mark?
        subprocess.run(["qpdf", "--flatten-annotations=all", src, os.path.join(OUT, "oracle.pdf")])
        html = subprocess.run(["pdftotext", "-f", "1", "-l", "1", "-bbox", os.path.join(OUT, "oracle.pdf"), "-"], capture_output=True, text=True).stdout
        boxes = [(float(a), float(b), float(c), float(d)) for a, b, c, d, w in re.findall(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<', html) if w in words]
        if len(boxes) != len(words): return False, ("oracle words", boxes)
        bad = [b for b in boxes if not (area[0] <= b[0] + 0.3 and b[2] - 0.3 <= area[2] and area[1] <= pageh - b[3] + 1 and pageh - b[1] - 1 <= area[3])]
        return not bad, (bad, area)
    ok, info = covered(os.path.join(DIRS[0], "form_filled.pdf"), ["WELDON"], r["areas"][0]["rect"]); check("... the mark holds the whole word where poppler puts it", ok, info)
    r, f = run("plain.pdf", "red_plain2.pdf", word="motor overload", pages=[0], noWords=True)
    check("a phrase across a line, marked by finding it: gone, the line's other words too", "overload" not in ptext(f, 1) and "Pump P-101 page 1" in ptext(f, 1), ptext(f, 1))
    ok, info = covered(os.path.join(DIRS[0], "plain.pdf"), ["motor", "overload"], r["areas"][0]["rect"]); check("... the mark holds both words where poppler puts them", ok, info)
    ok, info = qcheck(f); check("qpdf checks it clean", ok, info)
    # a page turned 90 degrees keeps its turn
    r, f = run("form_rot90.pdf", "red_rot.pdf", rect=[50, 50, 100, 100], page=0)
    info2 = subprocess.run(["python3", "-c", "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(r.pages[0].get('/Rotate'), [float(x) for x in r.pages[0].mediabox])", f], capture_output=True, text=True).stdout
    orig = subprocess.run(["python3", "-c", "import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(r.pages[0].get('/Rotate'), [float(x) for x in r.pages[0].mediabox])", os.path.join(DIRS[1], "form_rot90.pdf")], capture_output=True, text=True).stdout
    check("a turned page keeps its turn and size", info2.split()[0] == orig.split()[0] and info2 == orig, (info2, orig))
    subprocess.run(["pdftoppm", "-r", "40", "-png", "-singlefile", f, os.path.join(OUT, "red_rot")]); subprocess.run(["pdftoppm", "-r", "40", "-png", "-singlefile", os.path.join(DIRS[1], "form_rot90.pdf"), os.path.join(OUT, "orig_rot")])
    a, b2 = Image.open(os.path.join(OUT, "red_rot.png")), Image.open(os.path.join(OUT, "orig_rot.png"))
    check("... drawn the same way round as before", a.size == b2.size, (a.size, b2.size))
    # remove hidden information
    r, f = run("hidden.pdf", "clean.pdf", sanitize={"details": True, "scripts": True, "files": True, "comments": True, "forms": False})
    raw = qdf(f)
    for w in [b"Secret Person", b"/JavaScript", b"app.alert", b"/EmbeddedFile", b"secret attached", b"/AA", b"SECRET PERSON", b"/Metadata"]:
        check("hidden removed: no " + w.decode(), w not in raw, raw.count(w))
    check("hidden removed: the pages' words kept", "Pump P-101 page 2" in ptext(f, 2), ptext(f, 2))
    ok, info = qcheck(f); check("hidden removed: qpdf checks it clean", ok, info)
    r, f = run("hidden.pdf", "clean_keep.pdf", sanitize={"details": False, "scripts": True, "files": False, "comments": False})
    raw = qdf(f)
    check("only what is ticked goes: details, the attached file and the comment kept, the scripts gone", b"Secret Person" in raw and b"secret attached" in raw and b"SECRET PERSON" in raw and b"app.alert" not in raw, [w for w in [b"Secret Person", b"secret attached", b"SECRET PERSON", b"app.alert"] if w in raw])
    check("no page errors", not errs, errs)
    br.close()

# --- export, compare, a picture combined ---
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900}); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto("http://127.0.0.1:%d/index.html" % port)
    pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.comparePage && Lantern.pdf.pagesAsPictures)", timeout=60000)
    r = pg.evaluate("""async () => {
      var P = Lantern.pdf, a = await P.open(await (await fetch('rev_a.pdf')).blob()), b = await P.open(await (await fetch('rev_b.pdf')).blob());
      var la = (await P.pageText(a, 0)).lines.map(function (l) { return l.text; }), lb = (await P.pageText(b, 0)).lines.map(function (l) { return l.text; });
      var w = P.compareWords(la, lb).filter(function (x) { return x.kind !== 'same'; });
      var c0 = await P.comparePage(a, 0, b, 0, {dpi: 72}), c1 = await P.comparePage(a, 1, b, 1, {dpi: 72});
      // where the box moved: red at its old left edge (x=100), blue at its new (x=140), at y 350 (from the top: 792-350)
      var g = c0.canvas.getContext('2d'), at = function (x, y) { var d = g.getImageData(x, 792 - y, 1, 1).data; return [d[0], d[1], d[2]]; };
      var red = 0, blue = 0; for (var y = 310; y < 390; y += 5) { var o = at(100, y), nw = at(140, y); if (o[0] > 200 && o[2] < 80) red++; if (nw[2] > 200 && nw[0] < 80) blue++; }
      var pics = await P.pagesAsPictures(a, {dpi: 100, name: 'rev_a.pdf'}), words = await P.wordsOf(a);
      var jp = await P.pagesAsPictures(a, {dpi: 72, type: 'jpeg', pages: [1]});
      return {words: w, p0: [c0.gone, c0.added, c0.share], p1: [c1.gone, c1.added, c1.share], red: red, blue: blue,
        pics: pics.map(function (f) { return [f.name, f.data.length, Array.prototype.slice.call(f.data, 0, 4)]; }), jp: jp.map(function (f) { return [f.name, Array.prototype.slice.call(f.data, 0, 3)]; }), text: words.text};
    }""")
    check("compare words: the changed line gone and new, nothing else", [x["kind"] for x in r["words"]] == ["gone", "new"] and "overload" in r["words"][0]["text"] and "thermal" in r["words"][1]["text"], r["words"])
    check("compare picture: page 1 has marks only in one or the other", r["p0"][0] > 0 and r["p0"][1] > 0, r["p0"])
    check("compare picture: the moved box red where it was, blue where it is", r["red"] >= 12 and r["blue"] >= 12, (r["red"], r["blue"]))
    check("compare picture: page 2, the same in both, has nothing red or blue", r["p1"][0] == 0 and r["p1"][1] == 0, r["p1"])
    check("export: two PNG pages, named in order", [x[0] for x in r["pics"]] == ["rev_a p001.png", "rev_a p002.png"] and all(x[2] == [137, 80, 78, 71] for x in r["pics"]), r["pics"])
    check("export: a JPEG of page 2 only", len(r["jp"]) == 1 and r["jp"][0][0].endswith("p002.jpg") and r["jp"][0][1] == [255, 216, 255], r["jp"])
    check("export: the words, page by page", "--- page 1 ---" in r["text"] and "Page two is the same" in r["text"], r["text"])
    # the tile: Export as a zip, Combine with a picture, Compare opens
    pg.goto("http://127.0.0.1:%d/index.html#pdf" % port); pg.wait_for_selector("text=Open a PDF")
    pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", os.path.join(DIRS[2], "rev_a.pdf"))
    pg.wait_for_function("/2 pages\\./.test(document.body.innerText)")
    pg.click(".pv-bar button:text-is('Export')")
    with pg.expect_download() as dl:
        pg.click("button.primary:text-is('Export')")
    f = os.path.join(OUT, "pages.zip"); dl.value.save_as(f)
    z = zipfile.ZipFile(f); names = z.namelist()
    check("the tile's Export: one zip with both pages as PNG", names == ["rev_a p001.png", "rev_a p002.png"] and z.read(names[0])[:4] == b"\x89PNG", names)
    pg.click("button:text-is('Close')")
    pg.click(".pv-bar button:text-is('Combine')")
    pg.set_input_files("input[type=file][accept='application/pdf,.pdf,image/*']", os.path.join(DIRS[2], "nameplate.jpg"))
    pg.wait_for_selector("text=nameplate.jpg")
    pg.click("button.primary:text-is('Combine')"); pg.wait_for_function("/Combined 2 PDFs/.test(document.body.innerText)")
    info = pg.evaluate("(function (p) { return {n: p.count, w: p.pages[2].w, h: p.pages[2].h}; })(Lantern.pdfView.api.pdf)")
    check("Combine with a picture: it is page 3, the picture's own shape (4:3)", info["n"] == 3 and abs(info["w"] / info["h"] - 800 / 600) < 0.01, info)
    pg.click(".pv-bar button:text-is('Compare')")
    pg.locator("input[type=file][accept='application/pdf,.pdf']").last.set_input_files(os.path.join(DIRS[2], "rev_b.pdf"))
    pg.wait_for_function("/pages? differ|No differences/.test(document.body.innerText)", timeout=60000)
    body = pg.inner_text("body")
    check("the tile's Compare: page 1 differs, the counts said", "Page 1:" in body and "changed" in body and "This one has 3 pages, the other 2" in body, body[-600:])
    pg.wait_for_selector("text=thermal before reset", timeout=30000)
    check("... and its changed words shown", True)
    check("no page errors", not errs, errs)
    br.close()

# --- reduce size, and Edit text in the tile ---
# a scan-like PDF made here (two pages of pictures, 2400 x 3100 dots: about 4 MB), not kept in the repository
import random
from PIL import ImageDraw, ImageFilter
from reportlab.pdfgen import canvas as rcanvas
random.seed(3)
im = Image.new("RGB", (2400, 3100), "white"); dr = ImageDraw.Draw(im)
for k in range(400): x, y = random.randrange(2400), random.randrange(3100); dr.ellipse((x, y, x + 120, y + 80), fill=(random.randrange(256), random.randrange(256), random.randrange(256)))
im = im.filter(ImageFilter.GaussianBlur(3)); im.save(os.path.join(OUT, "scan.png")); im.save(os.path.join(OUT, "scan_hi.jpg"), quality=95)
c = rcanvas.Canvas(os.path.join(OUT, "big.pdf"), pagesize=(612, 792))
c.drawImage(os.path.join(OUT, "scan.png"), 0, 0, 612, 792); c.setFont("Helvetica", 14); c.drawString(72, 740, "Scanned manual page"); c.showPage()
c.drawImage(os.path.join(OUT, "scan_hi.jpg"), 0, 0, 612, 792); c.line(72, 72, 540, 72); c.showPage(); c.save()
DIRS.append(OUT)
big = os.path.getsize(os.path.join(OUT, "big.pdf"))
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(accept_downloads=True, viewport={"width": 1280, "height": 900}); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    answers = []
    pg.on("dialog", lambda d: d.accept(answers.pop(0) if answers else ""))
    pg.goto("http://127.0.0.1:%d/index.html" % port)
    pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.shrink && Lantern.pdf.editText)", timeout=60000)
    for dpi, most in ((150, 0.1), (72, 0.05)):
        r = pg.evaluate("""async (dpi) => { var P = Lantern.pdf, pdf = await P.open(await (await fetch('big.pdf')).blob()), r = await P.shrink(pdf, {dpi: dpi});
          var s = ''; for (var j = 0; j < r.bytes.length; j += 8192) s += String.fromCharCode.apply(null, r.bytes.subarray(j, j + 8192));
          var t = (await P.pageText(await P.open(r.bytes), 0)).text; return {b64: btoa(s), n: r.pictures, after: r.after, t: t}; }""", dpi)
        f = os.path.join(OUT, "small%d.pdf" % dpi); open(f, "wb").write(base64.b64decode(r["b64"]))
        ok, info = qcheck(f)
        lst = subprocess.run(["pdfimages", "-list", f], capture_output=True, text=True).stdout
        ppi = [int(l.split()[12]) for l in lst.splitlines()[2:] if l.strip()]
        check("reduce size to %d dots an inch: both pictures, JPEG, %d dots an inch on the page, under %d%% of the size, qpdf clean, its words kept" % (dpi, dpi, most * 100),
            r["n"] == 2 and r["after"] < big * most and ok and ppi == [dpi, dpi] and "Scanned manual page" in r["t"] and " jpeg " in lst, (r["n"], r["after"], big, ppi, info, r["t"][:40]))
    # Edit text, clicked through: a line changed, a line added
    pg.goto("http://127.0.0.1:%d/index.html#pdf" % port); pg.wait_for_selector("text=Open a PDF")
    pg.set_input_files("input[type=file][accept='application/pdf,.pdf']", os.path.join(DIRS[2], "shows.pdf"))
    pg.wait_for_function("/1 page\\./.test(document.body.innerText)")
    pg.click(".pv-bar button:text-is('Edit text')"); pg.wait_for_selector("[title='Tap to change these words']")
    answers.append("Torque the flange bolts to 60 Nm.")
    pg.locator("[title='Tap to change these words']").first.click()
    box = pg.evaluate("(function () { var r = Lantern.pdfView.api.pageEl(0).getBoundingClientRect(); return [r.left, r.top]; })()")
    answers.append("Checked by the night shift.")
    pg.mouse.click(box[0] + 100, box[1] + 500)
    pg.click("button.primary:text-is('Apply')"); pg.wait_for_function("/Changed\\./.test(document.body.innerText)")
    t = pg.evaluate("Lantern.pdfView.api.textOf(0).then(function (t) { return t.text; })")
    check("Edit text in the tile: the line reads anew, the old words gone, a line added, the rest kept", "60 Nm" in t and "45 Nm" not in t and "Checked by the night shift." in t and "Right column words" in t, t)
    with pg.expect_download() as dl:
        pg.click(".pv-bar button:text-is('Save')")
    f = os.path.join(OUT, "edited.pdf"); dl.value.save_as(f)
    ok, info = qcheck(f); tt = ptext(f, 1)
    check("... saved, qpdf clean, poppler reads the new words", ok and "60 Nm" in tt and "45 Nm" not in tt and "night shift" in tt, (info, tt))
    # Make form, clicked through: a box dragged and named, then filled in
    pg.click(".pv-bar button:text-is('Make form')")
    box = pg.evaluate("(function () { var r = Lantern.pdfView.api.pageEl(0).getBoundingClientRect(); return [r.left, r.top]; })()")
    answers.append("Inspector")
    x0, y0 = box[0] + 300, box[1] + 200
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 150, y0 + 25, steps=4); pg.mouse.up()
    pg.click("button.primary:text-is('Apply')"); pg.wait_for_function("/boxes are in/.test(document.body.innerText)")
    pg.click(".pv-bar button:text-is('Fill in')"); pg.wait_for_selector("input[title=Inspector]")
    pg.fill("input[title=Inspector]", "J. SMITH"); pg.click("button.primary:text-is('Apply')"); pg.wait_for_function("/The form is filled in/.test(document.body.innerText)")
    fv = pg.evaluate("Lantern.pdf.fields(Lantern.pdfView.api.pdf).then(function (f) { return f.map(function (x) { return [x.name, x.value]; }); })")
    check("Make form in the tile: a box made where it was dragged, named, and filled in", fv == [["Inspector", "J. SMITH"]], fv)
    check("no page errors (reduce size, edit text, make form)", not errs, errs)
    br.close()
print("%d checks, %d failed" % (n, fails))
sys.exit(1 if fails else 0)
