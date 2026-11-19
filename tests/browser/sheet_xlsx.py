# sheet_xlsx.py -- Excel files in Sheets (1.24.28), in a real browser (Chromium through Playwright): Import file in
# the list of sheets, with the browser's own file chooser, opens an Excel workbook written in Excel's own form as a
# sheet, with the note of what was left out above the grid; the merged title shown across its cells, the column
# widths, the numbers worked out (G4 90, not 9000%; =-2^2 is 4); an arrow passes over the cells a merge covers;
# Save .xlsx downloads a workbook openpyxl reads with its formulas, merged cells, widths and frozen row; a workbook
# of three sheets opens as three sheets. Then a phone's screen (Pixel 5): the import and the save there too.
# Screenshots in the folder given (default: temp).
# Usage: python3 tests/browser/sheet_xlsx.py [screenshot folder]
import os, sys, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FX = os.path.join(ROOT, "tests", "fixtures", "xlsx")
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8128
URL = "http://127.0.0.1:%d/index.html#sheet" % PORT
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:700]))
    if not cond: fails.append(name)
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
            with pg.expect_file_chooser() as fc:
                pg.locator("button", has_text="Import file").first.click()
            fc.value.set_files(os.path.join(FX, "excel_form.xlsx"))
            pg.wait_for_timeout(900)
            note = pg.evaluate("() => (document.querySelector('.lp-xlsx-note') || {}).textContent || ''")
            ok(label + ": Import file opens excel_form.xlsx, with the note above the grid", "Opened from the Excel file" in note and "Colours, borders" in note, note[:300])
            g = pg.evaluate("""() => { var t = function (r) { return document.querySelector('td[data-ref=' + r + ']'); };
              return { c1: t('C1').colSpan, d1: getComputedStyle(t('D1')).display, title: t('C1').textContent, align: getComputedStyle(t('C1')).textAlign,
                wA: t('A3').getBoundingClientRect().width, wB: t('B3').getBoundingClientRect().width, g4: t('G4').textContent, c8: t('C8').textContent,
                f3: t('F3').textContent, b3: t('B3').textContent, a8: t('A8').textContent, bold: getComputedStyle(t('A2')).fontWeight }; }""")
            ok(label + ": the title across C1:E1, centred; D1 passed over", g["c1"] == 3 and g["d1"] == "none" and g["title"] == "Paint for two rooms" and g["align"] == "center", g)
            ok(label + ": column A as wide as Excel has it (112 px); B as Sheets' own", abs(g["wA"] - 112) <= 2 and g["wB"] >= 88, g)
            ok(label + ": G4 shows 90 (not 9000%), C8 4, F3 100%, B3 15.0 ft, A8 a date, the headings bold", g["g4"] == "90" and g["c8"] == "4" and g["f3"] == "100%" and g["b3"] == "15.0 ft" and g["a8"] == "11/17/2026" and int(g["bold"]) >= 600, g)
            pg.screenshot(path=os.path.join(OUT, "xlsx_import_%s.png" % label))
            # the arrows pass over what the merge covers
            pg.evaluate("() => { var t = document.querySelector('td[data-ref=B1]'); ['mousedown','mouseup','click'].forEach(function (k) { t.dispatchEvent(new MouseEvent(k, { bubbles: true })); }); }")
            pg.focus(".gridwrap"); pg.keyboard.press("ArrowRight"); n1 = pg.inner_text(".cellname"); pg.keyboard.press("ArrowRight"); n2 = pg.inner_text(".cellname")
            ok(label + ": ArrowRight from B1 goes to C1, then past the merge to F1", n1 == "C1" and n2 == "F1", [n1, n2])
            with pg.expect_download() as dl:
                pg.locator("button", has_text="Save .xlsx").first.click()
            path = os.path.join(OUT, "excel_form_%s.xlsx" % label)
            dl.value.save_as(path)
            ok(label + ": Save .xlsx downloads excel_form.xlsx", dl.value.suggested_filename == "excel_form.xlsx", dl.value.suggested_filename)
            try:
                import openpyxl
                wb = openpyxl.load_workbook(path); ws = wb.active
                ok(label + ": openpyxl reads it: the shared formula in each cell, SUM, the merge, the width, the frozen row",
                   ws["G5"].value == "=D5*F5" and ws["D7"].value == "=SUM(D3:D6)" and [str(m) for m in ws.merged_cells.ranges] == ["C1:E1"] and abs(ws.column_dimensions["A"].width - 15.285156) < 1e-5 and ws.freeze_panes == "A2",
                   [ws["G5"].value, ws["D7"].value, ws.merged_cells.ranges, ws.freeze_panes])
                wb = openpyxl.load_workbook(path, data_only=True); ws = wb.active
                ok(label + ": ...with the values Lantern worked out saved beside them", ws["G7"].value == 634 and ws["D7"].value == 724 and ws["C8"].value == 4, [ws["G7"].value, ws["C8"].value])
            except ImportError:
                print("SKIP  openpyxl is not installed")
            # three sheets in one workbook
            pg.evaluate("() => { location.hash = 'home'; }"); pg.wait_for_timeout(300)
            pg.evaluate("() => { location.hash = 'sheet'; }"); pg.wait_for_timeout(600)
            with pg.expect_file_chooser() as fc:
                pg.locator("button", has_text="Import file").first.click()
            fc.value.set_files(os.path.join(FX, "workbook2.xlsx"))
            pg.wait_for_timeout(900)
            titles = pg.evaluate("() => window.Lantern.sheetDocs.list().map(function (d) { return d.title; })")
            ok(label + ": a workbook of three sheets opens as three sheets", all(("workbook2 — " + n) in titles for n in ("Prices", "Order", "Rates")), titles)
            ok(label + ": no page errors", not errs, errs)
            ctx.close()
        b.close()
finally:
    srv.terminate()
print("%d BROWSER XLSX FAILURES" % len(fails) if fails else "ALL BROWSER XLSX CHECKS PASS")
sys.exit(1 if fails else 0)
