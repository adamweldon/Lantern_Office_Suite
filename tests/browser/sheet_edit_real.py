# sheet_edit_real.py -- Sheets edited as Excel is (1.24.25), in a real browser (Chromium through Playwright), with
# the real keyboard, mouse and clipboard: Ctrl+C and Ctrl+V move a formula (Lantern's mark on the clipboard says the
# copy is its own); the same text written to the clipboard by another program is pasted as text; a cut moves the
# cells on paste and the formula that used them follows; a comparison shows TRUE; Ctrl+A keeps the active cell. On
# a phone's screen (Pixel 5): Select range, then Bold, then a tap chooses one cell (any tool ends Select range); the
# editing bar is one row, Select range first.
# Screenshots in the folder given (default: temp).
# Usage: python3 tests/browser/sheet_edit_real.py [screenshot folder]
import json, os, sys, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8126
URL = "http://127.0.0.1:%d/index.html#sheet" % PORT
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:700]))
    if not cond: fails.append(name)
OPEN = """(cells) => { var L = window.Lantern; var id = L.sheetDocs.create('Real', cells); L.sheetDocs.open(id); window.__id = id; }"""
RAW = "r => { var d = window.Lantern.store.collection('sheet.docs').get(window.__id); return d.cells[r] == null ? null : d.cells[r]; }"
SHOWN = "r => { var t = document.querySelector('td[data-ref=' + r + ']'); return t ? t.textContent : null; }"
NAME = "() => document.querySelector('.cellname').textContent"
BUTTON = "t => Array.prototype.filter.call(document.querySelectorAll('.lp-editbar button'), b => b.textContent === t)[0].click()"
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1366, "height": 768})
        ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://127.0.0.1:%d" % PORT)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.evaluate(OPEN, {"A1": "Item", "B1": "Qty", "C1": "Price", "D1": "Total", "A2": "rice", "B2": "2", "C2": "$3.50", "D2": "=B2*C2",
                           "A3": "beans", "B3": "5", "C3": "$1.20", "A4": "oil", "B4": "1", "C4": "$6.00", "F1": "=B2>1"})
        pg.wait_for_timeout(400)
        pg.click("td[data-ref=D2]"); pg.keyboard.press("Control+c"); pg.wait_for_timeout(100)
        pg.click("td[data-ref=D3]"); pg.keyboard.press("Control+v"); pg.wait_for_timeout(200)
        ok("Ctrl+C on D2, Ctrl+V on D3: =B3*C3, shown as money", pg.evaluate(RAW, "D3") == "=B3*C3" and pg.evaluate(SHOWN, "D3") == "$6.00",
           [pg.evaluate(RAW, "D3"), pg.evaluate(SHOWN, "D3")])
        pg.evaluate("() => navigator.clipboard.writeText('$7.00')")
        pg.click("td[data-ref=D6]"); pg.keyboard.press("Control+v"); pg.wait_for_timeout(200)
        ok("the same text, written by another program (no mark), is pasted as text", pg.evaluate(RAW, "D6") == "$7.00", pg.evaluate(RAW, "D6"))
        pg.click("td[data-ref=B2]"); pg.click("td[data-ref=B3]", modifiers=["Shift"]); pg.keyboard.press("Control+x"); pg.wait_for_timeout(100)
        ok("a cut leaves B2:B3 until the paste", pg.evaluate(RAW, "B2") == "2")
        pg.click("td[data-ref=H2]"); pg.keyboard.press("Control+v"); pg.wait_for_timeout(200)
        ok("...pasted at H2: moved, and D2's formula follows (=H2*C2, still $7.00)",
           pg.evaluate(RAW, "B2") is None and pg.evaluate(RAW, "H2") == "2" and pg.evaluate(RAW, "D2") == "=H2*C2" and pg.evaluate(SHOWN, "D2") == "$7.00",
           [pg.evaluate(RAW, "B2"), pg.evaluate(RAW, "H2"), pg.evaluate(RAW, "D2"), pg.evaluate(SHOWN, "D2")])
        ok("=B2>1 shows TRUE or FALSE, as Excel does", pg.evaluate(SHOWN, "F1") in ("TRUE", "FALSE"), pg.evaluate(SHOWN, "F1"))
        pg.click("td[data-ref=C3]"); pg.keyboard.press("Control+a"); pg.wait_for_timeout(100)
        ok("Ctrl+A on C3 selects the table, C3 stays the active cell", pg.evaluate(NAME).startswith("A1:") and pg.evaluate("() => window.Lantern.sheetEdit.active()") == "C3",
           [pg.evaluate(NAME), pg.evaluate("() => window.Lantern.sheetEdit.active()")])
        pg.screenshot(path=os.path.join(OUT, "sheet_edit_laptop.png"))
        ok("no page errors on the laptop", not errs, errs)
        ctx.close()
        ctx2 = b.new_context(**p.devices["Pixel 5"])
        pg2 = ctx2.new_page(); errs2 = []
        pg2.on("pageerror", lambda e: errs2.append(str(e)))
        pg2.goto(URL); pg2.wait_for_timeout(1500)
        pg2.evaluate(OPEN, {"A1": "Item", "B1": "Qty", "A2": "rice", "B2": "2", "A3": "beans", "B3": "5", "A4": "oil", "B4": "1"})
        pg2.wait_for_timeout(400)
        pg2.tap("td[data-ref=A2]"); pg2.evaluate(BUTTON, "Select range"); pg2.tap("td[data-ref=B3]")
        ok("phone: tap A2, Select range, tap B3: A2:B3", pg2.evaluate(NAME) == "A2:B3", pg2.evaluate(NAME))
        pg2.evaluate(BUTTON, "B"); pg2.tap("td[data-ref=A4]")
        ok("phone: after Bold, a tap on A4 chooses A4 alone", pg2.evaluate(NAME) == "A4", pg2.evaluate(NAME))
        bar = pg2.evaluate("() => { var r = document.querySelector('.lp-editbar').getBoundingClientRect(); return [r.height, document.querySelector('.lp-editbar').firstChild.textContent]; }")
        ok("phone: the editing bar is one row, Select range first", bar[0] < 70 and bar[1] == "Select range", bar)
        pg2.screenshot(path=os.path.join(OUT, "sheet_edit_phone.png"))
        ok("no page errors on the phone", not errs2, errs2)
        b.close()
finally:
    srv.terminate()
print("ALL SHEET EDITING CHECKS IN CHROMIUM PASS" if not fails else "%d FAILED" % len(fails))
sys.exit(1 if fails else 0)
