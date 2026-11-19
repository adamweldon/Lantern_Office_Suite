# writer_lists.py -- a list in a list numbered 1. a. i. (1.24.27), in a real browser (Chromium through Playwright).
# Adam (2026-11-19): "lists inside lists should follow the same schema as word and google docs". A list typed in
# Writer with its own buttons (1. List, Indent more, Indent less) shows 1. a. i. 1. on the page, bullets disc,
# circle, square; and Save .txt, Save .html (opened in the browser), Save .pdf (its text) and Save .docx (opened in
# LibreOffice, where it is on the machine) say the same. Then a phone's screen (Pixel 5). Screenshots in the folder
# given (default: temp).
# Usage: python3 tests/browser/writer_lists.py [screenshot folder]
import os, re, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8133
URL = "http://127.0.0.1:%d/index.html#writer" % PORT
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:700]))
    if not cond: fails.append(name)
STYLES = "() => Array.prototype.map.call(document.querySelectorAll('%s'), function (o) { var t = o.firstElementChild && o.firstElementChild.firstChild; return (t && t.nodeType === 3 ? t.nodeValue.slice(0, 6) : '') + ':' + getComputedStyle(o).listStyleType; }).join(' | ')"
tmp = tempfile.mkdtemp(prefix="writer_lists_")
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, ctx_args in [("laptop", {"viewport": {"width": 1366, "height": 900}, "accept_downloads": True}), ("phone", dict(p.devices["Pixel 5"], accept_downloads=True))]:
            ctx = b.new_context(**ctx_args)
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("dialog", lambda dlg: dlg.dismiss())
            pg.goto(URL); pg.wait_for_timeout(1500)
            pg.evaluate("() => { var L = window.Lantern; var id = L.writerDocs.create('Lockout', '<p>x</p>'); L.writerDocs.open(id); }")
            pg.wait_for_timeout(500)
            # typed with Writer's own buttons: 1. List, then Indent more and Indent less
            # (on a phone the toolbar stays over the top of the page: the caret is put in the page as a tap there would)
            pg.evaluate("() => { var pe = document.querySelector('.page'); pe.focus(); var r = document.createRange(); r.selectNodeContents(pe); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }")
            pg.keyboard.press("Delete")
            def tool(title): pg.locator("button[title='%s']" % title).first.click()
            pg.locator("button", has_text="1. List").first.click()
            pg.keyboard.type("Isolate"); pg.keyboard.press("Enter"); pg.keyboard.type("Open the disconnect"); tool("Indent more")
            pg.keyboard.press("Enter"); pg.keyboard.type("Fit your padlock"); pg.keyboard.press("Enter"); pg.keyboard.type("One lock each"); tool("Indent more")
            pg.keyboard.press("Enter"); pg.keyboard.type("Your own key"); tool("Indent more")
            pg.keyboard.press("Enter"); pg.keyboard.type("Test"); tool("Indent less"); tool("Indent less"); tool("Indent less")
            pg.keyboard.press("Enter"); pg.keyboard.type("Work")
            pg.wait_for_timeout(300)
            html = pg.evaluate("() => document.querySelector('.page').innerHTML")
            shown = pg.evaluate(STYLES % ".page ol, .page ul")
            ok(label + ": typed with 1. List and Indent more: 1. a. i. 1. on the page", shown == "Isolat:decimal | Open t:lower-alpha | One lo:lower-roman | Your o:decimal", [shown, html])
            pg.screenshot(path=os.path.join(OUT, "writer_lists_%s.png" % label))
            # a document with bullets, own styles and a start, made in the page
            pg.evaluate("""() => { var L = window.Lantern; var id = L.writerDocs.create('Kit', '<h1>Kit</h1><ol><li>Tools<ul><li>Hand<ul><li>Wrench<ul><li>13 mm</li></ul></li></ul></li></ul></li><li>Parts<ol type="A" start="2"><li>Bolts<ol><li>M8</li></ol></li></ol></li></ol>'); L.writerDocs.open(id); }""")
            pg.wait_for_timeout(500)
            shown2 = pg.evaluate(STYLES % ".page ol, .page ul")
            ok(label + ": bullets disc, circle, square, disc by level; an own style and start kept; a plain list in it by its level",
               shown2 == "Tools:decimal | Hand:circle | Wrench:square | 13 mm:disc | Bolts:upper-alpha | M8:lower-roman", shown2)
            if label == "laptop":
                files = {}
                for btxt in ["Save .txt", "Save .html", "Save .pdf", "Save .docx"]:
                    with pg.expect_download() as dl:
                        pg.locator("button", has_text=btxt).first.click()
                    f = os.path.join(tmp, "kit" + btxt.split(" ")[1]); dl.value.save_as(f); files[btxt] = f
                txt = open(files["Save .txt"], encoding="utf-8").read()
                ok("Save .txt: the numbers and bullets as the page shows them", txt == "Kit\n1. Tools\n    - Hand\n        - Wrench\n            - 13 mm\n2. Parts\n    B. Bolts\n        i. M8\n", txt)
                p2 = ctx.new_page(); p2.goto("file://" + files["Save .html"])
                shown3 = p2.evaluate(STYLES % "ol, ul"); p2.close()
                ok("Save .html opened in the browser: the same styles", shown3 == shown2, shown3)
                if shutil.which("pdftotext"):
                    pt = subprocess.run(["pdftotext", "-layout", files["Save .pdf"], "-"], capture_output=True, text=True).stdout
                    ok("Save .pdf: 1., 2., B., i. (the bullets drawn)", re.search(r"1\.\s+Tools", pt) and re.search(r"2\.\s+Parts", pt) and re.search(r"B\.\s+Bolts", pt) and re.search(r"i\.\s+M8", pt) and "?" not in pt, pt)
                else: print("SKIP  pdftotext not on this machine")
                if shutil.which("soffice"):
                    subprocess.run(["soffice", "--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", tmp, files["Save .docx"]], capture_output=True, timeout=180)
                    lt = open(os.path.join(tmp, "kit.txt"), encoding="utf-8", errors="replace").read().replace("﻿", "")
                    ok("Save .docx in LibreOffice: 1., bullets by level, B., i.", re.search(r"1\.\s+Tools", lt) and "◦ Hand" in lt and "▪ Wrench" in lt and "• 13 mm" in lt and re.search(r"B\.\s+Bolts", lt) and re.search(r"i\.\s+M8", lt), lt)
                else: print("SKIP  LibreOffice not on this machine")
            ok(label + ": no page errors", not errs, errs)
            ctx.close()
        b.close()
finally:
    srv.terminate()
    shutil.rmtree(tmp, ignore_errors=True)
print(("%d FAILED" % len(fails)) if fails else "ALL WRITER LIST BROWSER CHECKS PASS")
sys.exit(1 if fails else 0)
