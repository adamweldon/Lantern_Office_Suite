# replay_grid.py -- the third reviewer's cases for rule A (the Sheets grid, judged by Excel), replayed in Chromium
# through Playwright with the real mouse, keyboard, right-click menus and file chooser. site/ is served with
# python3 -m http.server and index.html#sheet opened; each group starts in a fresh browser context (empty storage).
# The workbook is Book3.xlsx (make_book.py), imported through Import file; AGGREGATE's expected values are Excel's
# options table, checked against LibreOffice in agg_lo.json.
# Prints AGREE <id> / DISAGREE <id> <detail> [harm] per case, then "<n> cases: <a> AGREE, <d> DISAGREE".
# Usage: python3 tests/fixtures/round3_1269/replay_grid.py [site dir] [group_... to run only those groups]
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
_args = [a for a in sys.argv[1:] if not a.startswith("group_")]
SITE = _args[0] if _args else os.path.join(ROOT, "site")
BOOK = os.path.join(HERE, "Book3.xlsx")
AGG = json.load(open(os.path.join(HERE, "agg_lo.json"), encoding="utf-8"))
PORT = 8197
URL = "http://127.0.0.1:%d/index.html#sheet" % PORT
res = {"a": 0, "d": 0}

def say(ok, cid, detail="", harm=None):
    if ok:
        res["a"] += 1; print("AGREE " + cid)
    else:
        res["d"] += 1; print("DISAGREE " + cid + " " + detail + (" [" + harm + "]" if harm else ""))
    sys.stdout.flush()

# ---------------- helpers ----------------
def new_page(b):
    ctx = b.new_context(viewport={"width": 1400, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(6000)
    pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(1200)
    return ctx, pg

def to_list(pg):
    if pg.locator("button", has_text="← Sheets").count():
        pg.locator("button", has_text="← Sheets").first.click(); pg.wait_for_timeout(250)

def open_sheet(pg, title):
    to_list(pg)
    pg.get_by_text(title, exact=True).first.click(); pg.wait_for_timeout(350)

def import_book(pg):
    to_list(pg)
    with pg.expect_file_chooser() as fc:
        pg.get_by_role("button", name="Import file").click()
    fc.value.set_files(BOOK)
    pg.wait_for_timeout(1500)

def make_sheet(pg, title, cells, more=None):
    # made in storage, then the page opened again so the list of sheets shows it (as after a restart)
    pg.evaluate("(a) => window.Lantern.sheetDocs.create(a[0], a[1], a[2])", [title, cells, more or {}])
    pg.goto("about:blank"); pg.goto(URL); pg.wait_for_timeout(700)

RAW = "(a) => { var d = window.Lantern.store.collection('sheet.docs').all().filter(function (x) { return x.title === a[0]; })[0]; return d && d.cells[a[1]] != null ? d.cells[a[1]] : null; }"
def raw(pg, title, ref): return pg.evaluate(RAW, [title, ref])
def shown(pg, ref): return pg.evaluate("r => { var t = document.querySelector('td[data-ref=' + r + ']'); return t ? t.textContent : null; }", ref)
def name(pg): return pg.evaluate("() => document.querySelector('.cellname').textContent")
def bar(pg): return pg.evaluate("() => document.querySelector('.fbar input').value")
def td(ref): return "td[data-ref=%s]" % ref
def row_head(n): return "table.grid tbody tr:nth-child(%d) > th" % n
def col_head(letter): return "table.grid thead th:nth-child(%d)" % (ord(letter) - 63)
def center(pg, sel):
    bb = pg.locator(sel).first.bounding_box()
    return bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
def drag(pg, a, b, release_at=None):
    x1, y1 = center(pg, a); x2, y2 = center(pg, b)
    pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, steps=4); pg.mouse.move(x2, y2, steps=4)
    if release_at:
        x3, y3 = release_at; pg.mouse.move(x3, y3, steps=4)
    pg.mouse.up(); pg.wait_for_timeout(120)
def menu(pg, text):
    pg.locator(".lp-cmenu").get_by_text(text, exact=True).first.click(); pg.wait_for_timeout(250)
def dialog_pick(pg, text):
    pg.locator(".lp-cdlg label", has_text=text).first.click()
    pg.locator(".lp-cdlg button[type=submit]").click(); pg.wait_for_timeout(250)
def grid_keys(pg):
    pg.evaluate("() => { var g = document.querySelector('.gridwrap'); if (g) g.focus(); }")
def undo(pg):
    grid_keys(pg); pg.keyboard.press("Control+z"); pg.wait_for_timeout(250)
def typ(pg, ref, text, enter=False):
    pg.click(td(ref)); pg.keyboard.type(text); pg.wait_for_timeout(60)
    if enter: pg.keyboard.press("Enter"); pg.wait_for_timeout(120)

def check_raws(pg, cid, title, want, harm="a formula reads another cell than before"):
    # (the xlsx reader keeps a sheet's reference to itself, =Summary!B6 on Summary, as =B6: the same cell, either form)
    own = title.split(" — ")[-1]
    def ok(g, w):
        return g == w or (isinstance(w, str) and g == w.replace("=" + own + "!", "=").replace("+" + own + "!", "+"))
    got = {k: raw(pg, title, k) for k in want}
    bad = {k: got[k] for k in want if not ok(got[k], want[k])}
    say(not bad, cid, "on " + title + ": " + ", ".join("%s is %r, want %r" % (k, bad[k], want[k]) for k in bad), harm)

def guard(fn, cid):
    try: fn()
    except Exception as e: say(False, cid, "the replay could not run: " + str(e)[:300], "unchecked")

T = lambda s: "Book3 — " + s

# ---------------- A1: rows and columns in a workbook ----------------
def group_rows_on_summary(b):
    ctx, pg = new_page(b)
    import_book(pg); open_sheet(pg, T("Summary"))
    pg.click(row_head(5), button="right"); menu(pg, "Insert")
    S = T("Summary")
    check_raws(pg, "W01-own-ref-moves-other-stays", S, {"A1": "=Jan!B6+B7"})
    check_raws(pg, "W02-quoted-name-stays", S, {"B1": "='My Sheet'!B6+B7"})
    check_raws(pg, "W03-3d-range-stays", S, {"C1": "=SUM(Jan:Mar!B2)+B7"})
    check_raws(pg, "W04-cell-like-quoted-name", S, {"D1": "='Q1 2026'!B6+B7"})
    check_raws(pg, "W05-accented-name-stays", S, {"E1": "=Março!B6+B7"})
    check_raws(pg, "W06-lowercase-name-stays", S, {"F1": "=jan!B6+B7"})
    check_raws(pg, "W07-two-sums", S, {"G1": "=SUM(Jan!B2:B8)+SUM(B2:B9)"})
    check_raws(pg, "W08-pure-other", S, {"H1": "=Jan!B6", "N1": "=Feb!B6", "Q1": "=SUM(Jan!B6:B7)"})
    check_raws(pg, "W09-own-sheet-by-name-moves", S, {"I1": "=Summary!B7"})
    check_raws(pg, "W10-text-in-indirect-stays", S, {"J1": "=INDIRECT(\"Jan!B6\")"})
    check_raws(pg, "W11-cyrillic-name-stays", S, {"O1": "=Лист2!B6+B7"}, "a reference to another sheet moved: it reads another cell, unsaid")
    check_raws(pg, "W12-name-ending-in-letters-digits", S, {"P1": "=Março26!B6+B7"}, "the sheet's name rewritten: the formula breaks")
    check_raws(pg, "W12b-apostrophe-name-stays", S, {"S1": "='Bob''s'!B6+B7"})
    check_raws(pg, "W13-other-sheet-follows", T("Jan"), {"F1": "=Summary!B7", "G1": "=Summary!B7+B6"})
    check_raws(pg, "W14-cyrillic-sheet-follows", T("Лист2"), {"A1": "=Summary!B7"})
    v = {k: shown(pg, k) for k in ("A1", "H1", "I1")}
    say(v == {"A1": "512", "H1": "106", "I1": "406"}, "W15-values-shown-same", "Summary shows %r, want A1 512, H1 106, I1 406" % v, "a total shows another number")
    undo(pg)
    check_raws(pg, "W16-undo-both", S, {"A1": "=Jan!B6+B6", "I1": "=Summary!B6", "P1": "=Março26!B6+B6"})
    check_raws(pg, "W17-undo-other-sheet", T("Jan"), {"F1": "=Summary!B6", "G1": "=Summary!B6+B6"})
    say(not pg.errs, "W18-no-page-errors-1", "page errors: %r" % pg.errs[:3], "a broken page")
    ctx.close()

def group_rows_on_jan(b):
    ctx, pg = new_page(b)
    import_book(pg)
    J, S = T("Jan"), T("Summary")
    pg.click(row_head(3)); pg.click(row_head(4), modifiers=["Shift"]); pg.wait_for_timeout(100)
    pg.click(row_head(4), button="right"); menu(pg, "Insert")
    check_raws(pg, "W19-jan-own-formulas", J, {"C8": "=B8*2", "D1": "=Jan!B8", "E1": "=SUM(B2:B10)", "F1": "=Summary!B6"})
    check_raws(pg, "W20-summary-follows", S, {"A1": "=Jan!B8+B6", "F1": "=jan!B8+B6", "H1": "=Jan!B8", "M1": "=Jan!$B$8"})
    check_raws(pg, "W21-summary-others-stay", S, {"B1": "='My Sheet'!B6+B6", "C1": "=SUM(Jan:Mar!B2)+B6", "D1": "='Q1 2026'!B6+B6", "N1": "=Feb!B6", "J1": "=INDIRECT(\"Jan!B6\")"})
    check_raws(pg, "W22-summary-ranges", S, {"G1": "=SUM(Jan!B2:B10)+SUM(B2:B8)", "Q1": "=SUM(Jan!B8:B9)", "K1": "=Jan!C8", "L1": "=Jan!B5", "R1": "=COUNT(Jan!B:B)"})
    check_raws(pg, "W23-quoted-sheets-follow", T("Q1 2026"), {"A1": "=Jan!B8*2"})
    check_raws(pg, "W24-mixed-sheet-follows", T("My Sheet"), {"A1": "=Jan!B8+'Q1 2026'!B6"})
    open_sheet(pg, S)
    v = {k: shown(pg, k) for k in ("H1", "A1", "K1", "L1", "Q1")}
    say(v == {"H1": "106", "A1": "512", "K1": "212", "L1": "103", "Q1": "213"}, "W25-summary-shows-same", "Summary shows %r" % v, "a total shows another number")
    open_sheet(pg, J); undo(pg)
    check_raws(pg, "W26-undo-on-jan", S, {"A1": "=Jan!B6+B6", "H1": "=Jan!B6", "G1": "=SUM(Jan!B2:B8)+SUM(B2:B8)"})
    check_raws(pg, "W27-undo-on-jan-quoted", T("Q1 2026"), {"A1": "=Jan!B6*2"})
    ctx.close()

def group_delete_on_jan(b):
    ctx, pg = new_page(b)
    import_book(pg)
    J, S = T("Jan"), T("Summary")
    pg.click(row_head(6), button="right"); menu(pg, "Delete")
    check_raws(pg, "W28-deleted-row-ref", S, {"H1": "=Jan!#REF!", "A1": "=Jan!#REF!+B6"}, "a formula reads the next row's cell")
    check_raws(pg, "W29-deleted-row-ranges", S, {"G1": "=SUM(Jan!B2:B7)+SUM(B2:B8)", "Q1": "=SUM(Jan!B6:B6)", "L1": "=Jan!B3"})
    undo(pg)
    check_raws(pg, "W30-undo-delete", S, {"H1": "=Jan!B6", "G1": "=SUM(Jan!B2:B8)+SUM(B2:B8)"})
    ctx.close()

def group_shift_cells(b):
    ctx, pg = new_page(b)
    import_book(pg)
    J, S = T("Jan"), T("Summary")
    pg.click(td("B4")); pg.click(td("B4"), button="right"); menu(pg, "Insert…"); dialog_pick(pg, "Shift cells down")
    check_raws(pg, "W31-shift-down-band", S, {"H1": "=Jan!B7", "K1": "=Jan!C6", "L1": "=Jan!B3"})
    check_raws(pg, "W32-shift-down-jan", J, {"C6": "=B7*2", "B5": "104"})
    undo(pg)
    pg.click(td("A3")); pg.click(td("A3"), button="right"); menu(pg, "Delete…"); dialog_pick(pg, "Shift cells left")
    check_raws(pg, "W33-shift-left", S, {"L1": "=Jan!A3", "H1": "=Jan!B6"})
    open_sheet(pg, S)
    pg.click(td("B4")); pg.click(td("B4"), button="right"); menu(pg, "Insert…"); dialog_pick(pg, "Shift cells down")
    check_raws(pg, "W33b-shift-down-on-summary", S, {"A1": "=Jan!B6+B7", "H1": "=Jan!B6", "G1": "=SUM(Jan!B2:B8)+SUM(B2:B9)", "E1": "=Março!B6+B7"})
    check_raws(pg, "W33c-shift-down-on-summary-others-follow", J, {"F1": "=Summary!B7"})
    undo(pg)
    check_raws(pg, "W33d-undo-shift-on-summary", J, {"F1": "=Summary!B6"})
    ctx.close()

def group_columns(b):
    ctx, pg = new_page(b)
    import_book(pg)
    J, S = T("Jan"), T("Summary")
    pg.click(col_head("B"), button="right"); menu(pg, "Insert")
    check_raws(pg, "W34-col-on-jan", S, {"H1": "=Jan!C6", "K1": "=Jan!D6", "R1": "=COUNT(Jan!C:C)", "B1": "='My Sheet'!B6+B6"})
    open_sheet(pg, S)
    pg.click(col_head("A"), button="right"); menu(pg, "Insert")
    check_raws(pg, "W35-col-on-summary", S, {"B1": "=Jan!C6+C6", "F1": "=Março!B6+C6", "P1": "=Лист2!B6+C6"}, "a reference to another sheet moved")
    check_raws(pg, "W36-col-on-summary-letters-digits", S, {"Q1": "=Março26!B6+C6"}, "the sheet's name rewritten: the formula breaks")
    # (Jan's G1 =Summary!B6+B6 went to H1 with the column put in on Jan: =Summary!B6+C6; now Summary's column too)
    check_raws(pg, "W37-col-on-summary-other-follows", J, {"H1": "=Summary!C6+C6"})
    ctx.close()

def group_accented_sheet(b):
    ctx, pg = new_page(b)
    import_book(pg)
    open_sheet(pg, T("Março"))
    pg.click(row_head(3), button="right"); menu(pg, "Insert")
    check_raws(pg, "W38-rows-on-accented-sheet", T("Summary"), {"E1": "=Março!B7+B6"}, "a formula on another sheet reads another cell after rows went in, unsaid")
    open_sheet(pg, T("Лист2"))
    pg.click(row_head(3), button="right"); menu(pg, "Insert")
    check_raws(pg, "W39-rows-on-cyrillic-sheet", T("Summary"), {"O1": "=Лист2!B7+B6"}, "a formula on another sheet reads another cell after rows went in, unsaid")
    open_sheet(pg, T("Bob's"))
    pg.click(row_head(3), button="right"); menu(pg, "Insert")
    check_raws(pg, "W39b-rows-on-apostrophe-sheet", T("Summary"), {"S1": "='Bob''s'!B7+B6"}, "a formula on another sheet reads another cell after rows went in, unsaid")
    ctx.close()

def group_undo_across(b):
    # (Excel keeps one undo list for the workbook: Ctrl+Z takes back the last thing done, on whichever sheet)
    ctx, pg = new_page(b)
    import_book(pg)
    J, S = T("Jan"), T("Summary")
    open_sheet(pg, S); typ(pg, "T2", "x", enter=True)
    open_sheet(pg, J); pg.click(row_head(3), button="right"); menu(pg, "Insert")
    open_sheet(pg, S); undo(pg)
    got = {"H1": raw(pg, S, "H1"), "shown H1": shown(pg, "H1"), "Jan B6": raw(pg, J, "B6"), "T2": raw(pg, S, "T2")}
    rows_still_in = got["Jan B6"] == "105"
    consistent = (rows_still_in and got["H1"] == "=Jan!B7") or (not rows_still_in and got["H1"] == "=Jan!B6")
    # Excel: one Ctrl+Z takes back the last thing done (the row put in on Jan); the x typed before it stays
    say(consistent and got["shown H1"] == "106" and got["T2"] == "x", "W40-undo-on-summary-after-rows-on-jan",
        "after x typed in Summary!T2, a row put in on Jan, then one Ctrl+Z on Summary: %r (Excel: the row comes out, x stays)" % got,
        "two things taken back by one Ctrl+Z, one of them on another sheet" if consistent else "every formula on Summary reads the wrong row of Jan, unsaid")
    ctx.close()
    ctx, pg = new_page(b)
    import_book(pg)
    pg.click(row_head(3), button="right"); menu(pg, "Insert")
    open_sheet(pg, S); typ(pg, "T1", "note", enter=True)
    open_sheet(pg, J); typ(pg, "Z1", "y", enter=True); undo(pg); undo(pg)
    got = {"Summary T1": raw(pg, S, "T1"), "Jan Z1": raw(pg, J, "Z1"), "Jan B6": raw(pg, J, "B6")}
    # Excel after two Ctrl+Z: y and note taken back, the row still in (B6 is 105); after three, the row out too
    say(got["Jan B6"] == "105" or got["Summary T1"] == "note", "W41-two-undos-on-jan",
        "rows in on Jan, note typed on Summary, y on Jan, then Ctrl+Z twice on Jan: %r -- the second Ctrl+Z took the rows out and Summary's note with them (Excel: y, then note)" % got,
        "typing on another sheet taken back unseen")
    ctx.close()

# ---------------- A2: the mouse while typing ----------------
PLAIN = {"A1": "Item", "B2": "2", "B3": "3", "B4": "4", "C2": "5", "C3": "6", "C4": "7", "D5": "x"}
def fresh_plain(pg, n):
    t = "Plain %d" % n
    make_sheet(pg, t, dict(PLAIN)); open_sheet(pg, t)
    return t

def group_mouse(b):
    ctx, pg = new_page(b)
    n = [0]
    def nxt():
        n[0] += 1; return fresh_plain(pg, n[0])
    def case(cid, fn):
        guard(fn, cid)
    def m01():
        t = nxt(); typ(pg, "E1", "hello"); pg.click(td("C3")); pg.wait_for_timeout(100)
        say(raw(pg, t, "E1") == "hello" and name(pg) == "C3", "M01-text-then-press-cell", "E1 %r, selected %r" % (raw(pg, t, "E1"), name(pg)), "typing lost")
    def m02():
        t = nxt(); typ(pg, "E1", "hello"); drag(pg, td("C3"), td("D5"))
        say(raw(pg, t, "E1") == "hello" and name(pg) == "C3:D5", "M02-text-then-drag", "E1 %r, selected %r" % (raw(pg, t, "E1"), name(pg)), "typing lost or no range")
    def m03():
        t = nxt(); typ(pg, "E1", "42"); pg.click(row_head(5)); pg.wait_for_timeout(100)
        say(raw(pg, t, "E1") == "42" and name(pg) == "A5:Z5", "M03-text-then-row-number", "E1 %r, selected %r" % (raw(pg, t, "E1"), name(pg)), "typing lost")
    def m04():
        t = nxt(); typ(pg, "E1", "42"); pg.click(col_head("C")); pg.wait_for_timeout(100)
        say(raw(pg, t, "E1") == "42" and name(pg).startswith("C1:C"), "M04-text-then-column-letter", "E1 %r, selected %r" % (raw(pg, t, "E1"), name(pg)), "typing lost")
    def m05():
        t = nxt(); typ(pg, "E1", "=1+"); pg.click(td("B2")); b1 = bar(pg); pg.keyboard.press("Enter"); pg.wait_for_timeout(120)
        say(b1 == "=1+B2" and raw(pg, t, "E1") == "=1+B2", "M05-point-after-plus", "bar %r, E1 %r" % (b1, raw(pg, t, "E1")))
    def m06():
        t = nxt(); typ(pg, "E1", "=SUM("); drag(pg, td("B2"), td("B4")); b1 = bar(pg); pg.keyboard.type(")"); pg.keyboard.press("Enter"); pg.wait_for_timeout(120)
        say(b1 == "=SUM(B2:B4" and raw(pg, t, "E1") == "=SUM(B2:B4)", "M06-drag-a-range", "bar %r, E1 %r" % (b1, raw(pg, t, "E1")))
    def m07():
        t = nxt(); typ(pg, "E1", "=SUM("); drag(pg, td("B2"), td("B4")); drag(pg, td("C2"), td("C3"))
        say(bar(pg) == "=SUM(C2:C3", "M07-second-drag-replaces", "bar %r" % bar(pg))
    def m08():
        t = nxt(); typ(pg, "E1", "=1+"); pg.click(td("B2")); pg.click(td("C3"))
        say(bar(pg) == "=1+C3", "M08-second-press-replaces", "bar %r" % bar(pg))
    def m09():
        t = nxt(); typ(pg, "E1", "=1+"); pg.click(td("B2")); drag(pg, td("C2"), td("C4"))
        say(bar(pg) == "=1+C2:C4", "M09-press-then-drag-replaces", "bar %r" % bar(pg))
    def m10():
        t = nxt(); typ(pg, "E1", "=B2"); pg.click(td("C3")); pg.wait_for_timeout(100)
        say(raw(pg, t, "E1") == "=B2" and name(pg) == "C3", "M10-no-operator-commits", "E1 %r, selected %r" % (raw(pg, t, "E1"), name(pg)))
    def ops(cid, typed, want):
        def f():
            t = nxt(); typ(pg, "E1", typed); pg.click(td("B2"))
            say(bar(pg) == want, cid, "typed %r then pressed B2: bar %r, want %r" % (typed, bar(pg), want))
        return f
    def m18():
        t = nxt(); typ(pg, "E1", "+"); pg.click(td("B2")); b1 = bar(pg); pg.keyboard.press("Enter"); pg.wait_for_timeout(120)
        say(b1 == "+B2" and raw(pg, t, "E1") == "=+B2" and shown(pg, "E1") == "2", "M18-plus-then-point", "bar %r, E1 %r shows %r" % (b1, raw(pg, t, "E1"), shown(pg, "E1")))
    def m20():
        t = nxt(); typ(pg, "E1", "5+"); pg.click(td("B2")); pg.wait_for_timeout(100)
        say(raw(pg, t, "E1") == "5+" and name(pg) == "B2", "M20-text-ending-in-plus", "E1 %r, selected %r (5+ without = is text in Excel)" % (raw(pg, t, "E1"), name(pg)), "text turned into a formula")
    def m21():
        t = nxt(); typ(pg, "E1", "=SUM("); pg.click(row_head(5)); pg.wait_for_timeout(100)
        say(bar(pg) == "=SUM(5:5", "M21-point-row-number", "typed =SUM( then pressed row number 5: bar %r (Excel puts in 5:5)" % bar(pg), "nothing happens")
    def m22():
        t = nxt(); typ(pg, "E1", "=SUM("); pg.click(col_head("C")); pg.wait_for_timeout(100)
        say(bar(pg) == "=SUM(C:C", "M22-point-column-letter", "typed =SUM( then pressed column C: bar %r (Excel puts in C:C)" % bar(pg), "nothing happens")
    def m23():
        nxt(); drag(pg, td("B2"), td("C3")); pg.click(td("E5")); pg.wait_for_timeout(100)
        say(name(pg) == "E5", "M23-click-after-drag", "selected %r" % name(pg), "a click lost")
    def m24():
        nxt(); x, y = center(pg, ".toolbar"); drag(pg, td("B2"), td("C3"), release_at=(x, y)); pg.click(td("E5")); pg.wait_for_timeout(100)
        say(name(pg) == "E5", "M24-click-after-drag-ending-off-grid", "selected %r" % name(pg), "a click lost")
    def m25():
        nxt(); drag(pg, td("B2"), td("D4")); pg.click(td("C3")); pg.wait_for_timeout(100)
        say(name(pg) == "C3", "M25-click-inside-dragged-range", "selected %r" % name(pg), "a click lost")
    def m26():
        t = nxt(); typ(pg, "E1", "hi"); pg.click(td("G3"), modifiers=["Shift"]); pg.wait_for_timeout(100)
        say(raw(pg, t, "E1") == "hi" and name(pg) == "E1:G3", "M26-text-then-shift-click", "E1 %r, selected %r" % (raw(pg, t, "E1"), name(pg)), "typing lost")
    def m27():
        t = nxt(); typ(pg, "E1", "=1+"); pg.click(td("B2")); pg.keyboard.type("*"); pg.click(td("C2"))
        say(bar(pg) == "=1+B2*C2", "M27-press-after-typed-operator-adds", "bar %r" % bar(pg), "a reference replaced")
    def m28():
        t = nxt(); typ(pg, "E1", "hello"); pg.click(td("B2")); pg.keyboard.type("9"); pg.keyboard.press("Enter"); pg.wait_for_timeout(120)
        say(raw(pg, t, "E1") == "hello" and raw(pg, t, "B2") == "9", "M28-typing-goes-to-pressed-cell", "E1 %r, B2 %r" % (raw(pg, t, "E1"), raw(pg, t, "B2")), "typing lost")
    for cid, fn in [("M01", m01), ("M02", m02), ("M03", m03), ("M04", m04), ("M05", m05), ("M06", m06), ("M07", m07), ("M08", m08), ("M09", m09), ("M10", m10),
                    ("M11", ops("M11-point-after-bracket", "=(", "=(B2")), ("M12", ops("M12-point-after-comma", "=MAX(1,", "=MAX(1,B2")),
                    ("M13", ops("M13-point-after-colon", "=B5:", "=B5:B2")), ("M14", ops("M14-point-after-ampersand", "=C2&", "=C2&B2")),
                    ("M15", ops("M15-point-after-greater", "=C2>", "=C2>B2")), ("M16", ops("M16-point-after-minus", "=-", "=-B2")),
                    ("M17", ops("M17-point-after-power", "=2^", "=2^B2")), ("M18", m18), ("M19", ops("M19-point-after-slash", "=10/", "=10/B2")),
                    ("M20", m20), ("M21", m21), ("M22", m22), ("M23", m23), ("M24", m24), ("M25", m25), ("M26", m26), ("M27", m27), ("M28", m28)]:
        case(cid, fn)
    say(not pg.errs, "M29-no-page-errors", "page errors: %r" % pg.errs[:3], "a broken page")
    ctx.close()

# ---------------- +B2 typed, Backspace and Delete, Shift+arrow from a merged cell, keys at once ----------------
def group_keys(b):
    ctx, pg = new_page(b)
    n = [0]
    def nxt(cells=None, more=None):
        n[0] += 1; t = "Keys %d" % n[0]; make_sheet(pg, t, dict(cells or PLAIN), more); open_sheet(pg, t); return t
    def typed(cid, text, want_raw, want_shown, harm):
        def f():
            t = nxt(); typ(pg, "E1", text, enter=True)
            r, s = raw(pg, t, "E1"), shown(pg, "E1")
            say((r in want_raw) and s is not None and re.match(want_shown, s) is not None, cid, "typed %r: E1 holds %r and shows %r; want %r showing %s" % (text, r, s, want_raw[0], want_shown), harm)
        guard(f, cid)
    typed("T01-plus-B2", "+B2", ["=+B2"], r"^2$", "text where Excel makes a formula")
    typed("T02-minus-B2", "-B2", ["=-B2"], r"^-2$", "text where Excel makes a formula")
    typed("T03-plus-lower-b2", "+b2", ["=+b2", "=+B2"], r"^2$", "text where Excel makes a formula")
    typed("T04-plus-5-number", "+5", ["+5", "5"], r"^5$", "a number taken as a formula or text")
    typed("T05-plus-dollar-ref", "+$B$2", ["=+$B$2"], r"^2$", "text where Excel makes a formula")
    typed("T06-plus-function", "+SUM(B2:B4)", ["=+SUM(B2:B4)"], r"^9$", "text where Excel makes a formula")
    typed("T07-plus-PI", "+PI()*2", ["=+PI()*2"], r"^6\.28", "text where Excel makes a formula")
    typed("T08-minus-5pct", "-5%", ["-5%"], r"^-(5%|0\.05)$", "a number taken as a formula")
    def k01():
        t = nxt(); drag(pg, td("B2"), td("C4")); pg.keyboard.press("Backspace"); pg.wait_for_timeout(150)
        r = {k: raw(pg, t, k) for k in ("B2", "B3", "C2", "C4")}
        say(r == {"B2": None, "B3": "3", "C2": "5", "C4": "7"}, "K01-backspace-active-only", "after Backspace on B2:C4: %r" % r, "cells emptied that Excel keeps")
    def k02():
        t = nxt(); drag(pg, td("B2"), td("C4")); pg.keyboard.press("Delete"); pg.wait_for_timeout(150)
        r = {k: raw(pg, t, k) for k in ("B2", "B3", "C2", "C4", "D5")}
        say(r == {"B2": None, "B3": None, "C2": None, "C4": None, "D5": "x"}, "K02-delete-range", "after Delete on B2:C4: %r" % r, "cells left that Delete should empty")
    def k03():
        t = nxt({"A3": "a", "B3": "3", "C3": "6"}); pg.click(row_head(3)); pg.keyboard.press("Backspace"); pg.wait_for_timeout(150)
        r = {k: raw(pg, t, k) for k in ("A3", "B3", "C3")}
        say(r == {"A3": None, "B3": "3", "C3": "6"}, "K03-backspace-whole-row", "after Backspace on row 3: %r" % r, "cells emptied that Excel keeps")
    def merged(cid, keys, want):
        def f():
            t = nxt({"B2": "merged", "E5": "5"}, {"merges": ["B2:C3"]}); pg.click(td("B2")); grid_keys(pg)
            for k in keys: pg.keyboard.press(k); pg.wait_for_timeout(60)
            say(name(pg) == want, cid, "from merged B2:C3, %s: selected %r, want %r" % ("+".join(keys), name(pg), want), "a key press does nothing")
        guard(f, cid)
    for cid, fn in [("K01", k01), ("K02", k02), ("K03", k03)]: guard(fn, cid)
    merged("K04-shift-right-merged", ["Shift+ArrowRight"], "B2:D3")
    merged("K05-shift-down-merged", ["Shift+ArrowDown"], "B2:C4")
    merged("K06-shift-left-merged", ["Shift+ArrowLeft"], "A2:C3")
    merged("K07-shift-up-merged", ["Shift+ArrowUp"], "B1:C3")
    merged("K08-shift-right-twice", ["Shift+ArrowRight", "Shift+ArrowRight"], "B2:E3")
    merged("K09-shift-right-then-left", ["Shift+ArrowRight", "Shift+ArrowLeft"], "B2:C3")
    def k10():
        t = nxt(); to_list(pg); pg.get_by_text(t, exact=True).first.click(); pg.wait_for_timeout(300)
        pg.keyboard.press("ArrowDown"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(80)
        sel = name(pg); pg.keyboard.type("7"); pg.keyboard.press("Enter"); pg.wait_for_timeout(120)
        say(sel == "B2" and raw(pg, t, "B2") == "7", "K10-opened-from-list-takes-keys", "after opening from the list, Down, Right: %r; 7 Enter put %r in B2" % (sel, raw(pg, t, "B2")), "the keys go nowhere")
    def k11():
        to_list(pg)
        with pg.expect_file_chooser() as fc:
            pg.get_by_role("button", name="Import file").click()
        fc.value.set_files(BOOK); pg.wait_for_timeout(1500)
        pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(80)
        say(name(pg) == "B1", "K11-imported-takes-keys", "after Import file, Right: %r" % name(pg), "the keys go nowhere")
    def k12():
        to_list(pg); pg.get_by_role("button", name="Use").first.click(); pg.wait_for_timeout(400)
        pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(80)
        say(name(pg) == "A2", "K12-template-takes-keys", "after Use on the first template, Down: %r" % name(pg), "the keys go nowhere")
    def k13():
        to_list(pg); pg.get_by_role("button", name="+ New sheet").click(); pg.wait_for_timeout(400)
        pg.keyboard.type("5"); pg.keyboard.press("Enter"); pg.wait_for_timeout(120)
        say(shown(pg, "A1") == "5" and name(pg) == "A2", "K13-new-sheet-takes-keys", "after + New sheet, 5 Enter: A1 shows %r, selected %r" % (shown(pg, "A1"), name(pg)), "the keys go nowhere")
    guard(k10, "K10"); guard(k11, "K11"); guard(k12, "K12"); guard(k13, "K13")
    # AGGREGATE and SUBTOTAL, as the grid shows them (row 6 hidden)
    for lay in ("plain", "nested"):
        cells, lo = AGG[lay]["cells"], AGG[lay]["lo"]
        def f(lay=lay, cells=cells, lo=lo):
            t = "Agg " + lay; make_sheet(pg, t, cells, {"hidden": {"6": 1}}); open_sheet(pg, t)
            for k in sorted(lo, key=lambda r: int(r[1:])):
                want = lo[k]; got = shown(pg, k)
                ok = (str(want) == got) if isinstance(want, str) else (got is not None and re.sub(r"[,\s]", "", got) == ("%g" % want))
                say(ok, "G-%s-%s %s" % (lay, k, cells[k]), "shows %r, want %r (Excel's options; LibreOffice the same)" % (got, want), "a total counts a subtotal twice, unsaid")
        guard(f, "G-" + lay)
    ctx.close()

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=SITE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        only = [a for a in sys.argv[1:] if a.startswith("group_")] or None
        for g in (group_rows_on_summary, group_rows_on_jan, group_delete_on_jan, group_shift_cells, group_columns, group_accented_sheet, group_undo_across, group_mouse, group_keys):
            if only and g.__name__ not in only: continue
            guard(lambda: g(b), g.__name__)
        b.close()
finally:
    srv.terminate()
print("%d cases: %d AGREE, %d DISAGREE" % (res["a"] + res["d"], res["a"], res["d"]))
