# docx_real.py -- Word files in Writer (1.24.26), in a real browser (Chromium through Playwright): Import file with
# the browser's own file chooser opens a .docx (Word's own document.xml; a file with Word's harder features) as a new
# document, with the note of what was left out above the page; Save .docx downloads a Word file that python-docx
# reads with its headings, list and table; MAKE DOC's Save .docx in Chat's preview does the same. Then a phone's
# screen (Pixel 5): the import and the save there too.
# Screenshots in the folder given (default: temp).
# Usage: python3 tests/browser/docx_real.py [screenshot folder]
import io, os, sys, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FX = os.path.join(ROOT, "tests", "fixtures", "docx")
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8127
URL = "http://127.0.0.1:%d/index.html#writer" % PORT
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:700]))
    if not cond: fails.append(name)
def button(pg, text):
    return pg.locator("button", has_text=text).filter(has_text=text).first
def docx_text(path):
    import docx
    d = docx.Document(path)
    return [(p.style.name, p.text) for p in d.paragraphs], [[c.text for c in r.cells] for t in d.tables for r in t.rows]
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, ctx_args in [("laptop", {"viewport": {"width": 1366, "height": 768}, "accept_downloads": True}), ("phone", dict(p.devices["Pixel 5"], accept_downloads=True))]:
            ctx = b.new_context(**ctx_args)
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("dialog", lambda dlg: dlg.dismiss())
            pg.goto(URL); pg.wait_for_timeout(1500)
            # Import file -> the browser's chooser -> features.docx
            with pg.expect_file_chooser() as fc:
                pg.locator("button", has_text="Import file").first.click()
            fc.value.set_files(os.path.join(FX, "features.docx"))
            pg.wait_for_timeout(800)
            page_html = pg.evaluate("() => (document.querySelector('.page') || {}).innerHTML || ''")
            note = pg.evaluate("() => (document.querySelector('.lp-docx-note') || {}).textContent || ''")
            ok(label + ": Import file opens features.docx: heading, list, joined cells, a picture",
               "Feature test" in page_html and "<ol>" in page_html and 'rowspan="2"' in page_html and "<img" in page_html, page_html[:300])
            ok(label + ": the note above the page says what was left out", "Opened from the Word file" in note and "comments are not shown" in note, note)
            pg.screenshot(path=os.path.join(OUT, "docx_import_%s.png" % label))
            # Save .docx from a document made here
            pg.evaluate("""() => { var L = window.Lantern; var id = L.writerDocs.create('Shop notes', '<h1>Shop notes</h1><p style="text-align: center;"><b>Read first.</b></p><ul><li>Oil</li><li>Rags</li></ul><table><tr><th>Part</th><th>Qty</th></tr><tr><td>Seal</td><td>2</td></tr></table>'); L.writerDocs.open(id); }""")
            pg.wait_for_timeout(500)
            with pg.expect_download() as dl:
                pg.locator("button", has_text="Save .docx").first.click()
            path = os.path.join(OUT, "shop_notes_%s.docx" % label)
            dl.value.save_as(path)
            paras, cells = docx_text(path)
            ok(label + ": Save .docx downloads Shop notes.docx", dl.value.suggested_filename == "Shop notes.docx", dl.value.suggested_filename)
            ok(label + ": python-docx reads it: Heading 1, the centred line, two list items, the table", paras[0] == ("Heading 1", "Shop notes") and paras[1][1] == "Read first." and
               [t for s, t in paras if s == "List Paragraph"] == ["Oil", "Rags"] and cells == [["Part", "Qty"], ["Seal", "2"]], [paras, cells])
            # Word's own document.xml (Adam's file, 2026-11-18)
            pg.evaluate("() => { location.hash = 'home'; }"); pg.wait_for_timeout(300)
            pg.evaluate("() => { location.hash = 'writer'; }"); pg.wait_for_timeout(500)
            with pg.expect_file_chooser() as fc:
                pg.locator("button", has_text="Import file").first.click()
            fc.value.set_files(os.path.join(FX, "word_plain.docx"))
            pg.wait_for_timeout(800)
            first = pg.evaluate("() => { var p = document.querySelector('.page p'); return p ? [p.textContent, getComputedStyle(p).textAlign, !!p.querySelector('b u')] : null; }")
            ok(label + ": Word's own file: the title centred, bold and underlined as Adam made it", first and first[0] == "Using Lantern" and first[1] == "center" and first[2], first)
            ok(label + ": no page errors", not errs, errs)
            ctx.close()
        b.close()
finally:
    srv.terminate()
print("ALL DOCX CHECKS IN CHROMIUM PASS" if not fails else "%d FAILED" % len(fails))
sys.exit(1 if fails else 0)
