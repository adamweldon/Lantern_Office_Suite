# replay.py -- replays the grid_1269 review cases (draft 1.24.29: drag selection, right-click menus, Insert/Delete,
# Format Cells, row height / column width, hide / unhide, SUBTOTAL/AGGREGATE over hidden rows, .xlsx, undo) in a
# real Chromium through Playwright: real mouse drags and right-clicks, real keys, a Pixel 5 long press for the phone.
# What Excel does is written in cases.py; where formulas move after an insert or a delete, LibreOffice (the stand-in
# for Excel) was asked beforehand and its answer is in lo_expect.json (made by lo_expect.py).
#
# Usage: python3 tests/fixtures/grid_1269/replay.py [--site DIR] [--port N] [--only id,id] [--verbose]
#   --site  folder served as the web root (default: site/ of this repository; build it with tools/build_site.py)
# Prints one line per case, AGREE <id> or DISAGREE <id> <what differed> [harm], then "<n> cases: <a> AGREE, <d> DISAGREE".
# Cases marked unjudged print UNJUDGED <id> <what Lantern did> and are not counted as either.
import json, os, re, sys, subprocess, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, HERE)
import cases as CASES

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); return args[i + 1]
    return default
SITE = opt("--site", os.path.join(ROOT, "site"))
PORT = int(opt("--port", "8269"))
ONLY = set((opt("--only", "") or "").split(",")) - {""}
VERBOSE = "--verbose" in args
URL = "http://127.0.0.1:%d/index.html#sheet" % PORT
TMP = tempfile.mkdtemp(prefix="grid1269_")
LO = json.load(open(os.path.join(HERE, "lo_expect.json"), encoding="utf-8"))

from playwright.sync_api import sync_playwright

# ---------------------------------------------------------------- page helpers
OPEN = "(cells) => { var L = window.Lantern; window.__id = L.sheetDocs.create('Grid', cells); L.sheetDocs.open(window.__id); }"
RAWDOC = "() => window.Lantern.store.collection('sheet.docs').get(window.__id)"
VALUES = "() => window.Lantern.sheetDocs.values(window.__id)"
NAME = "() => document.querySelector('.cellname').textContent"
ACTIVE = "() => window.Lantern.sheetEdit.active()"
MSG = "() => Array.prototype.map.call(document.querySelectorAll('[aria-live]'), function (e) { return e.textContent; }).join(' | ')"
MENU = "() => { var m = document.querySelector('.lp-cmenu'); if (!m || getComputedStyle(m).display === 'none' || !m.getBoundingClientRect().width) return null; return Array.prototype.map.call(m.querySelectorAll('button'), function (b) { return b.firstChild.textContent; }); }"
DLG = "() => { var m = document.querySelector('.lp-cdlg form'); return m ? m.getAttribute('aria-label') : null; }"
DLGCHECKED = "() => { var c = document.querySelector('.lp-cdlg input[type=radio]:checked'); return c ? c.parentNode.textContent : null; }"
DLGFIELD = "() => { var c = document.querySelector('.lp-cdlg input[type=number], .lp-cdlg input[type=text]'); return c ? c.value : null; }"
GRIDSIZE = "() => [document.querySelectorAll('thead th').length - 1, document.querySelectorAll('tbody tr').length]"

def colnum(L):
    n = 0
    for ch in L: n = n * 26 + ord(ch) - 64
    return n
def colname(n):
    s = ""
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s

def target(t):
    if t == "corner": return "thead th:nth-child(1)"
    m = re.match(r"^r(\d+)$", t)
    if m: return "tbody tr:nth-child(%s) > th" % m.group(1)
    m = re.match(r"^c([A-Z]+)$", t)
    if m: return "thead th:nth-child(%d)" % (colnum(m.group(1)) + 1)
    if t == "editor": return "input[aria-label='Cell editor']"
    return "td[data-ref=%s]" % t

def center(pg, t):
    loc = pg.locator(target(t)).first
    loc.scroll_into_view_if_needed(timeout=3000)
    bb = loc.bounding_box()
    return bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2

class Phone:
    def __init__(self, pg):
        self.pg = pg; self.cdp = pg.context.new_cdp_session(pg)
    def press(self, x, y, ms):
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        self.pg.wait_for_timeout(ms)
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        self.pg.wait_for_timeout(250)

def menu_button(pg, label):
    bs = pg.locator(".lp-cmenu button"); names = []
    for i in range(bs.count()):
        names.append(bs.nth(i).evaluate("b => b.firstChild.textContent"))
    for want in (label, label.rstrip("…"), label + "…"):   # Insert... and Insert are the same command
        if want in names: return bs.nth(names.index(want))
    raise RuntimeError("no menu item %s in %s" % (label, names))

def dlg_label(pg, label):
    loc = pg.locator(".lp-cdlg label", has_text=label).first
    if loc.count() == 0: raise RuntimeError("no dialog choice " + label)
    return loc

def run_step(pg, st, state):
    op = st[0]
    if op == "click":
        pg.locator(target(st[1])).first.scroll_into_view_if_needed(timeout=3000)
        x, y = center(pg, st[1])
        mods = st[2] if len(st) > 2 else []
        for m in mods: pg.keyboard.down(m)
        pg.mouse.click(x, y)
        for m in mods: pg.keyboard.up(m)
        pg.wait_for_timeout(80)
    elif op == "dblclick":
        x, y = center(pg, st[1]); pg.mouse.dblclick(x, y); pg.wait_for_timeout(100)
    elif op == "drag":
        x1, y1 = center(pg, st[1]); x2, y2 = center(pg, st[2])
        pg.mouse.move(x1, y1); pg.mouse.down()
        pg.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, steps=5)
        pg.mouse.move(x2, y2, steps=5); pg.mouse.up(); pg.wait_for_timeout(100)
    elif op == "rclick":
        x, y = center(pg, st[1]); pg.mouse.click(x, y, button="right"); pg.wait_for_timeout(150)
    elif op == "pick":
        b = menu_button(pg, st[1]); bb = b.bounding_box()
        pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(200)
    elif op == "radio":
        dlg_label(pg, st[1]).click(); pg.wait_for_timeout(50)
    elif op == "check":
        box = dlg_label(pg, st[1]).locator("input")
        if box.is_checked() != st[2]: box.click()
        pg.wait_for_timeout(50)
    elif op == "select":
        pg.locator(".lp-cdlg select[aria-label='%s']" % st[1]).select_option(st[2]); pg.wait_for_timeout(50)
    elif op == "field":
        f = pg.locator(".lp-cdlg input[type=number], .lp-cdlg input[type=text]:visible").first
        f.fill(str(st[1])); pg.wait_for_timeout(50)
    elif op == "ok":
        pg.locator(".lp-cdlg button[type=submit]").click(); pg.wait_for_timeout(250)
    elif op == "cancel":
        pg.locator(".lp-cdlg button", has_text="Cancel").click(); pg.wait_for_timeout(150)
    elif op == "key":
        pg.keyboard.press(st[1]); pg.wait_for_timeout(150)
    elif op == "type":
        pg.keyboard.type(st[1]); pg.wait_for_timeout(80)
    elif op == "wait":
        pg.wait_for_timeout(st[1])
    elif op == "tap":
        x, y = center(pg, st[1]); pg.touchscreen.tap(x, y); pg.wait_for_timeout(200)
    elif op == "longpress":
        x, y = center(pg, st[1]); state["phone"].press(x, y, st[2] if len(st) > 2 else 800)
    elif op == "tapitem":
        b = menu_button(pg, st[1]); bb = b.bounding_box()
        pg.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(250)
    elif op == "tapdlg":
        loc = dlg_label(pg, st[1]) if st[1] not in ("OK", "Cancel") else pg.locator(".lp-cdlg button", has_text=st[1]).first
        bb = loc.bounding_box(); pg.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(250)
    elif op == "button":
        pg.evaluate("t => Array.prototype.filter.call(document.querySelectorAll('.lp-editbar button'), function (b) { return b.textContent === t; })[0].click()", st[1])
        pg.wait_for_timeout(100)
    elif op == "save":
        with pg.expect_download() as dl:
            pg.locator("button", has_text="Save .xlsx").first.click()
        path = os.path.join(TMP, st[1] + ".xlsx"); dl.value.save_as(path); state["files"][st[1]] = path
    elif op == "import":
        name = st[1]
        path = state["files"].get(name)
        if not path:
            path = os.path.join(TMP, name + ".xlsx"); CASES.build_xlsx(CASES.IMPORTS[name], path)
        before = pg.evaluate("() => window.Lantern.sheetDocs.list().map(function (d) { return d.id; })")
        pg.set_input_files("input[type=file]", path); pg.wait_for_timeout(1500)
        pg.evaluate("(before) => { var l = window.Lantern.sheetDocs.list(); for (var i = 0; i < l.length; i++) if (before.indexOf(l[i].id) < 0) { window.__id = l[i].id; return; } }", before)
    elif op == "js":
        pg.evaluate(st[1]); pg.wait_for_timeout(100)
    elif op == "clicktext":
        loc = pg.get_by_text(st[1], exact=True).first; loc.scroll_into_view_if_needed(timeout=3000)
        bb = loc.bounding_box(); pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(400)
    elif op == "remember":
        state["mem"][st[1]] = pg.evaluate(st[2])
    elif op == "scroll":
        pg.locator(target(st[1])).first.scroll_into_view_if_needed(); pg.wait_for_timeout(100)
    else:
        raise RuntimeError("unknown step " + op)

# ---------------------------------------------------------------- comparing
def norm_formula(s):
    if s is None: return None
    s = str(s)
    if not s.startswith("="): return s
    out = []; parts = re.split(r'("(?:[^"]|"")*")', s)
    for i, p in enumerate(parts):
        if i % 2 == 1: out.append(p); continue
        p = p.replace(" ", "").upper()
        p = re.sub(r"\$?[A-Z]{1,3}\$?#REF!", "#REF!", p)          # LibreOffice B#REF! is Excel #REF!
        p = re.sub(r"\$?#REF!\$?\d*", "#REF!", p)
        p = re.sub(r"#REF!:#REF!", "#REF!", p)
        p = re.sub(r"(?<![A-Z$])(\$?[A-Z]{1,3}\$?\d+):\1(?![\d(])", r"\1", p)  # B2:B2 is B2
        out.append(p)
    return "".join(out)

def same_value(a, b):
    if a is None or a == "": a = None
    if b is None or b == "": b = None
    if isinstance(a, bool) or isinstance(b, bool): return a == b
    try:
        fa, fb = float(a), float(b)
        return abs(fa - fb) <= 1e-9 * max(1, abs(fa), abs(fb))
    except (TypeError, ValueError):
        return str(a) == str(b)

def grid_facts(pg):
    return pg.evaluate("""() => {
      var rows = document.querySelectorAll('tbody tr'), heads = document.querySelectorAll('thead th');
      var hr = [], hc = [], rh = {}, cw = {}, rowcls = {}, colcls = {};
      for (var i = 0; i < rows.length; i++) { var h = rows[i].getBoundingClientRect().height; rh[i + 1] = h;
        if (getComputedStyle(rows[i]).display === 'none' || h < 1) hr.push(i + 1);
        rowcls[i + 1] = rows[i].querySelector('th').className; }
      for (var j = 1; j < heads.length; j++) { var w = heads[j].getBoundingClientRect().width; cw[heads[j].textContent] = w;
        if (getComputedStyle(heads[j]).display === 'none' || w < 1) hc.push(heads[j].textContent);
        colcls[heads[j].textContent] = heads[j].className; }
      return {hr: hr, hc: hc, rh: rh, cw: cw, rowcls: rowcls, colcls: colcls};
    }""")

def cell_style(pg, ref):
    return pg.evaluate("""r => { var t = document.querySelector('td[data-ref=' + r + ']'); if (!t) return null; var s = getComputedStyle(t);
      return {bold: parseInt(s.fontWeight, 10) >= 600, italic: s.fontStyle === 'italic', align: s.textAlign, text: t.textContent,
              colspan: t.colSpan, rowspan: t.rowSpan, shown: s.display !== 'none'}; }""", ref)

def median(xs):
    xs = sorted(xs); return xs[len(xs) // 2] if xs else 0

def sel_text(pg, want, size):
    nc, nr = size; LC = colname(nc)
    kind = want[0]
    if kind == "cells": return want[1]
    if kind == "rows": return "A%d:%s%d" % (want[1], LC, want[2])
    if kind == "cols": return "%s1:%s%d" % (want[1], want[2], nr)
    if kind == "all": return "A1:%s%d" % (LC, nr)
    raise RuntimeError(kind)

def check(pg, case, state):
    E = case["expect"]; diffs = []
    size = pg.evaluate(GRIDSIZE)
    doc = pg.evaluate(RAWDOC) or {}
    cells = dict((k, v) for k, v in (doc.get("cells") or {}).items() if v not in (None, ""))
    if "sel" in E:
        want = sel_text(pg, E["sel"], size); got = pg.evaluate(NAME)
        if got != want: diffs.append("selection %s (Excel %s)" % (got, want))
    if "active" in E:
        got = pg.evaluate(ACTIVE)
        if got != E["active"]: diffs.append("active cell %s (Excel %s)" % (got, E["active"]))
    if E.get("notext"):
        t = pg.evaluate("() => window.getSelection().toString()")
        if t.strip(): diffs.append("page text selected: %r" % t[:40])
    if "menu" in E:
        got = pg.evaluate(MENU)
        if got != E["menu"]: diffs.append("menu %s (Excel %s)" % (got, E["menu"]))
    if E.get("menu_on_screen"):
        r = pg.evaluate("() => { var m = document.querySelector('.lp-cmenu'); if (!m) return null; var b = m.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight]; }")
        if not r or r[0] < 0 or r[1] < 0 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5: diffs.append("menu not wholly on screen %s" % r)
    if E.get("dlg_on_screen"):
        r = pg.evaluate("() => { var m = document.querySelector('.lp-cdlg form'); if (!m) return null; var b = m.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight]; }")
        if not r or r[0] < 0 or r[1] < 0 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5: diffs.append("dialog not wholly on screen %s" % r)
    if "dlg" in E:
        got = pg.evaluate(DLG)
        if got != E["dlg"]: diffs.append("dialog %s (Excel %s)" % (got, E["dlg"]))
    if "dlg_checked" in E:
        got = pg.evaluate(DLGCHECKED)
        if got != E["dlg_checked"]: diffs.append("dialog choice %s (Excel %s)" % (got, E["dlg_checked"]))
    if "dlg_field" in E:
        got = pg.evaluate(DLGFIELD)
        if not same_value(got, E["dlg_field"]): diffs.append("dialog shows %s (Excel %s)" % (got, E["dlg_field"]))
    if "dlg_checks" in E:
        for label, want in E["dlg_checks"].items():
            got = dlg_label(pg, label).locator("input").is_checked()
            if got != want: diffs.append("dialog %s %s (Excel %s)" % (label, got, want))
    if "dlg_select" in E:
        for aria, want in E["dlg_select"].items():
            got = pg.locator(".lp-cdlg select[aria-label='%s']" % aria).input_value()
            if got != want: diffs.append("dialog %s %r (Excel %r)" % (aria, got, want))
    if "editor" in E:
        got = pg.evaluate("() => document.querySelector(\"input[aria-label='Cell editor']\").value")
        if got != E["editor"]: diffs.append("being typed %r (Excel %r)" % (got, E["editor"]))
    if "raw" in E:
        for ref, want in E["raw"].items():
            got = cells.get(ref)
            if norm_formula(got) != norm_formula(want): diffs.append("%s holds %r (Excel %r)" % (ref, got, want))
    if "cells_exact" in E:
        want = dict((k, v) for k, v in E["cells_exact"].items() if v not in (None, ""))
        for ref in sorted(set(want) | set(cells)):
            if norm_formula(cells.get(ref)) != norm_formula(want.get(ref)):
                diffs.append("%s holds %r (Excel %r)" % (ref, cells.get(ref), want.get(ref)))
    if E.get("lo"):
        exp = LO[case["id"]]
        for ref in sorted(set(exp["f"]) | set(cells), key=lambda r: (int(re.sub(r"[A-Z]", "", r)), r)):
            if norm_formula(cells.get(ref)) != norm_formula(exp["f"].get(ref)):
                diffs.append("%s holds %r (Excel %r)" % (ref, cells.get(ref), exp["f"].get(ref)))
        vals = pg.evaluate(VALUES) or {}
        for ref, want in exp["v"].items():
            if not same_value(vals.get(ref), want):
                diffs.append("%s shows %r (Excel %r)" % (ref, vals.get(ref), want))
    if "vals" in E:
        vals = pg.evaluate(VALUES) or {}
        for ref, want in E["vals"].items():
            if not same_value(vals.get(ref), want): diffs.append("%s = %r (Excel %r)" % (ref, vals.get(ref), want))
    if "shown" in E:
        for ref, want in E["shown"].items():
            st = cell_style(pg, ref); got = st and st["text"]
            if got != want: diffs.append("%s shows %r (Excel %r)" % (ref, got, want))
    for key, prop in (("bold", "bold"), ("italic", "italic"), ("align", "align")):
        if key in E:
            for ref, want in E[key].items():
                st = cell_style(pg, ref); got = st and st[prop]
                if got != want: diffs.append("%s %s %r (Excel %r)" % (ref, key, got, want))
    if "merged" in E:
        for ref, want in E["merged"].items():
            st = cell_style(pg, ref); got = st and [st["colspan"], st["rowspan"]]
            if got != want: diffs.append("%s spans %s (Excel %s)" % (ref, got, want))
    need_facts = any(k in E for k in ("hidden_rows", "hidden_cols", "row_h", "col_w", "rowhead", "colhead", "visible_rows"))
    if need_facts:
        F = grid_facts(pg)
        if "hidden_rows" in E:
            lo, hi = E.get("rows_span", (1, 40)); got = [r for r in F["hr"] if lo <= r <= hi]
            if got != E["hidden_rows"]: diffs.append("hidden rows %s (Excel %s)" % (got, E["hidden_rows"]))
        if "hidden_cols" in E:
            got = F["hc"]
            if got != E["hidden_cols"]: diffs.append("hidden columns %s (Excel %s)" % (got, E["hidden_cols"]))
        if "row_h" in E:
            base = median([F["rh"][str(r)] for r in range(30, 60)])
            for r, ratio in E["row_h"].items():
                got = F["rh"][str(r)] / base
                if abs(got - ratio) > 0.06 * max(ratio, 0.5): diffs.append("row %s height x%.2f of usual (Excel x%.2f)" % (r, got, ratio))
        if "col_w" in E:
            base = median([F["cw"][c] for c in "PQRSTUVWX"])
            for c, ratio in E["col_w"].items():
                got = F["cw"][c] / base
                if abs(got - ratio) > 0.06 * max(ratio, 0.5): diffs.append("column %s width x%.2f of usual (Excel x%.2f)" % (c, got, ratio))
        if "rowhead" in E:
            for r, want in E["rowhead"].items():
                got = F["rowcls"][str(r)]
                if got != want: diffs.append("row %s number shaded %r (Excel %r)" % (r, got, want))
        if "colhead" in E:
            for c, want in E["colhead"].items():
                got = F["colcls"][c]
                if got != want: diffs.append("column %s letter shaded %r (Excel %r)" % (c, got, want))
    if "note" in E:
        got = pg.evaluate("() => document.body.innerText")
        if E["note"] not in got: diffs.append("no note saying %r" % E["note"])
    if "msg" in E:   # a message shown anywhere on the page (Lantern's notes are not always in an aria-live region)
        got = pg.evaluate(MSG) + " | " + pg.evaluate("() => document.body.innerText")
        if E["msg"] not in got: diffs.append("no message saying %r" % E["msg"])
    if E.get("warned_before"):   # a question asked before the values go: a browser dialog or Lantern's own dialog left open
        if not state["dialogs"] and not pg.evaluate(DLG):
            diffs.append("no question before the values were dropped (Excel asks first: %s)" % E["warned_text"])
    if "xlsx" in E:
        diffs += check_xlsx(state["files"].get(E["xlsx"]["file"]), E["xlsx"])
    if "same_as" in E:
        for expr, key in E["same_as"]:
            got = pg.evaluate(expr); want = state["mem"].get(key)
            if want is None or abs(got - want) > 1: diffs.append("%s is %s (Excel: as before, %s)" % (key, got, want))
    if "js" in E:
        for expr, want in E["js"]:
            got = pg.evaluate(expr)
            if got != want: diffs.append("%s gave %r (Excel %r)" % (expr[:60], got, want))
    if E.get("noerrors", True) and state["errs"]:
        diffs.append("page errors: %s" % "; ".join(state["errs"])[:200])
    return diffs

def check_xlsx(path, X):
    if not path: return ["no .xlsx was saved"]
    import openpyxl
    diffs = []
    wb = openpyxl.load_workbook(path); ws = wb.active
    if "hidden_rows" in X:
        got = [r for r in range(1, 60) if ws.row_dimensions[r].hidden]
        if got != X["hidden_rows"]: diffs.append("file hides rows %s (Excel %s)" % (got, X["hidden_rows"]))
    if "hidden_cols" in X:
        got = [colname(c) for c in range(1, 27) if ws.column_dimensions[colname(c)].hidden]
        # openpyxl groups a run of columns under its first letter
        for key, dim in ws.column_dimensions.items():
            if dim.hidden and dim.min and dim.max:
                for c in range(dim.min, dim.max + 1):
                    if colname(c) not in got: got.append(colname(c))
        got.sort(key=colnum)
        if got != X["hidden_cols"]: diffs.append("file hides columns %s (Excel %s)" % (got, X["hidden_cols"]))
    if "heights" in X:
        for r, h in X["heights"].items():
            got = ws.row_dimensions[int(r)].height
            if got is None or abs(got - h) > 0.01: diffs.append("file row %s height %s (Excel %s)" % (r, got, h))
    if "widths" in X:
        for c, w in X["widths"].items():
            got = ws.column_dimensions[c].width
            if got is None or abs(got - w) > 0.01: diffs.append("file column %s width %s (Excel %s)" % (c, got, w))
    if "merges" in X:
        got = sorted(str(m) for m in ws.merged_cells.ranges)
        if got != sorted(X["merges"]): diffs.append("file merges %s (Excel %s)" % (got, X["merges"]))
    if "cells" in X:
        for ref, want in X["cells"].items():
            got = ws[ref].value
            if norm_formula(got) != norm_formula(want) and not same_value(got, want): diffs.append("file %s holds %r (Excel %r)" % (ref, got, want))
    return diffs

# ---------------------------------------------------------------- run
def main():
    all_cases = CASES.CASES
    ids = [c["id"] for c in all_cases]
    dup = set(i for i in ids if ids.count(i) > 1)
    if dup: sys.exit("duplicate case ids: %s" % sorted(dup))
    todo = [c for c in all_cases if not ONLY or c["id"] in ONLY]
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=SITE,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    agree = disagree = unjudged = 0
    try:
        time.sleep(1)
        # make sure the page served is this build (another program on the same port would be tested instead)
        import urllib.request
        served = urllib.request.urlopen("http://127.0.0.1:%d/index.html" % PORT).read()
        if srv.poll() is not None or served != open(os.path.join(SITE, "index.html"), "rb").read():
            sys.exit("port %d serves something else: choose another with --port" % PORT)
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctxs = {}
            def page_for(dev):
                if dev not in ctxs:
                    if dev == "phone": ctx = b.new_context(**p.devices["Pixel 5"])
                    else: ctx = b.new_context(viewport={"width": 1600, "height": 1200}, device_scale_factor=1)
                    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://127.0.0.1:%d" % PORT)
                    pg = ctx.new_page(); ctxs[dev] = pg
                    st = {"errs": [], "dialogs": []}
                    pg.on("pageerror", lambda e, st=st: st["errs"].append(str(e)))
                    def ondialog(d, st=st):
                        st["dialogs"].append(d.message); d.accept()
                    pg.on("dialog", ondialog)
                    pg._st = st
                    pg._phone = Phone(pg) if dev == "phone" else None
                return ctxs[dev]
            for case in todo:
                pg = page_for(case.get("dev", "laptop"))
                st = pg._st; st["errs"][:] = []; st["dialogs"][:] = []
                state = {"errs": st["errs"], "dialogs": st["dialogs"], "files": {}, "phone": pg._phone, "mem": {}}
                try:
                    # a fresh page for every case (a goto to the same address with a hash would not reload it), and
                    # an empty store, so no case sees another's sheets, undo steps or selection
                    if pg.url.startswith("http"):
                        pg.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
                    pg.goto("about:blank")
                    pg.goto(URL); pg.wait_for_function("() => window.Lantern && window.Lantern.sheetDocs && window.Lantern.sheetMenu")
                    pg.evaluate("() => navigator.clipboard ? navigator.clipboard.writeText('').catch(function () {}) : null")
                    pg.wait_for_timeout(300)
                    pg.evaluate(OPEN, case["cells"]); pg.wait_for_timeout(300)
                    for s in case["steps"]: run_step(pg, s, state)
                    pg.wait_for_timeout(150)
                    diffs = check(pg, case, state)
                except Exception as e:
                    diffs = ["could not be done: %s" % str(e).split("\n")[0][:200]]
                if case.get("unjudged"):
                    unjudged += 1
                    print("UNJUDGED %s %s" % (case["id"], "; ".join(diffs) if diffs else "Lantern did as the case expects"))
                elif diffs:
                    disagree += 1
                    print("DISAGREE %s %s [%s]" % (case["id"], "; ".join(diffs), case["harm"]))
                else:
                    agree += 1
                    print("AGREE %s" % case["id"])
                if VERBOSE: print("    " + case["does"] + " -- Excel: " + case["excel"])
                sys.stdout.flush()
            b.close()
    finally:
        srv.terminate()
    n = agree + disagree
    print("%d cases: %d AGREE, %d DISAGREE%s" % (n, agree, disagree, (" (and %d unjudged)" % unjudged) if unjudged else ""))

if __name__ == "__main__":
    main()
