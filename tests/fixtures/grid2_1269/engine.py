# engine.py -- the second grid reviewer's driver (1.24.29): runs one case of cases.py in a real Chromium page with
# the real mouse and keyboard, and compares what Lantern did with what Excel does (the case's "expect").
# A case: {"id", "rule", "title", "excel" (what Excel does), "steps": [...], "expect": {...}, "harm", "judged"}.
# Steps:
#   ["open", cells, more, title]      a new sheet (more: merges, hidden, heights, widths, fmt, rows), opened
#   ["click", target, mods]           target: "B2", "row:4", "col:C", "corner", "bar"; mods: ["Shift"] ...
#   ["dblclick", target]
#   ["rclick", target]                the right button
#   ["drag", from, to]                press on from, move to to, let go
#   ["path", a, b, c ...]             press on a, move through b, c ..., let go on the last
#   ["longpress", target]             a finger held on it (the case has "touch": True: a page with a touch screen)
#   ["press", key] / ["type", text]
#   ["menu", text]                    an item of the open right-click menu, clicked
#   ["radio", text] / ["fill", value] / ["tick", text, on] / ["choose", aria-label, value] / ["ok"] / ["cancel"]
#   ["save", name]                    Save .xlsx: the download kept as <name>
#   ["import", spec]                  Import file (list of sheets): an .xlsx made by openpyxl from spec, or {"saved": name}
#   ["wait", ms]
import json, os, re, tempfile

TMP = tempfile.mkdtemp(prefix="grid2_")
SAVED = {}

OPEN = """([cells, more, title]) => { var L = window.Lantern;
  if (L.sheetMenu) L.sheetMenu.close();
  document.querySelectorAll('.lp-cdlg').forEach(function (d) { d.parentNode.removeChild(d); });
  window.__id = L.sheetDocs.create(title || 'T', cells, more || undefined); L.sheetDocs.open(window.__id); }"""

STATE = """() => { var L = window.Lantern, id = window.__id, d = L.store.collection('sheet.docs').get(id) || {};
  var S = L.sheetEdit || {}, R = S.range ? S.range() : null;
  function ref(c, r) { return String.fromCharCode(65 + c) + (r + 1); }
  var ae = document.activeElement, focus = null;
  if (ae) focus = ae.classList && ae.classList.contains('gridwrap') ? 'grid' : ae.matches && ae.matches('.fbar input') ? 'bar' :
    ae.closest && ae.closest('.lp-cmenu') ? 'menu' : ae.closest && ae.closest('.lp-cdlg') ? 'dialog' : ae.tagName;
  var menu = document.querySelector('.lp-cmenu'), dlg = document.querySelector('.lp-cdlg');
  var items = menu ? [].map.call(menu.querySelectorAll('button'), function (b) { return b.firstChild.textContent + (b.disabled ? ' (off)' : ''); }) : null;
  var warn = dlg ? [].filter.call(dlg.querySelectorAll('[role=alert]'), function (w) { return w.style.display !== 'none' && w.textContent; }).map(function (w) { return w.textContent; }).join(' ') : '';
  var note = document.querySelector('.lp-editbar [role=status]');
  var shown = {}; document.querySelectorAll('td[data-ref]').forEach(function (t) { if (t.textContent) shown[t.getAttribute('data-ref')] = t.textContent; });
  return { range: R ? ref(R.c0, R.r0) + ':' + ref(R.c1, R.r1) : null, active: S.active ? S.active() : null,
    name: (document.querySelector('.cellname') || {}).textContent, cells: d.cells || {}, fmt: d.fmt || {},
    merges: d.merges || [], hidden: d.hidden || {}, heights: d.heights || {}, widths: d.widths || {}, rows: d.rows || null,
    values: L.sheetDocs.values(id) || {}, focus: focus, items: items, dlg: dlg ? (dlg.querySelector('h3') || {}).textContent : null,
    dlgText: dlg ? dlg.innerText : '', warn: warn, note: note && note.style.display !== 'none' ? note.textContent : '',
    bar: (document.querySelector('.fbar input') || {}).value, shown: shown,
    book: d.book ? (function () { var o = {}; L.store.collection('sheet.docs').all().forEach(function (x) {
      if (x.book && x.book.id === d.book.id) o[x.book.sheet] = { cells: x.cells, values: L.sheetDocs.values(x.id) }; }); return o; })() : null,
    dlgValue: dlg && dlg.querySelector('input[type=number]') ? dlg.querySelector('input[type=number]').value : null,
    dlgChecked: dlg ? [].filter.call(dlg.querySelectorAll('input[type=radio]'), function (i) { return i.checked; }).map(function (i) { return i.parentNode.textContent; }) : null };
}"""

WIDTHS = """() => { var out = {}; document.querySelectorAll('.gridwrap thead th').forEach(function (th, i) {
  if (i) out[String.fromCharCode(64 + i)] = th.getBoundingClientRect().width; });
  var rows = {}; document.querySelectorAll('.gridwrap tbody tr').forEach(function (tr, i) { if (i < 30) rows[String(i + 1)] = tr.getBoundingClientRect().height; });
  return { cols: out, rows: rows }; }"""


def sel(t):
    if re.match(r"^[A-Z][0-9]+$", t):
        return "td[data-ref=%s]" % t
    if t.startswith("row:"):
        return ".gridwrap tbody tr:nth-child(%d) > th" % int(t[4:])
    if t.startswith("col:"):
        return ".gridwrap thead th:nth-child(%d)" % (ord(t[4]) - 63)
    if t == "corner":
        return ".gridwrap thead th:nth-child(1)"
    if t == "bar":
        return ".fbar input"
    return t


def centre(page, t):
    loc = page.locator(sel(t)).first
    loc.scroll_into_view_if_needed()
    b = loc.bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2


def make_xlsx(spec, path):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = spec.get("sheet", "Data")
    for k, v in spec.get("cells", {}).items():
        ws[k] = v
    for name, cells in spec.get("more", []):   # other sheets of the workbook, in order
        o = wb.create_sheet(name)
        for k, v in cells.items():
            o[k] = v
    for c, w in spec.get("widths", {}).items():
        ws.column_dimensions[c].width = w
    for c in spec.get("hidecols", []):
        ws.column_dimensions[c].hidden = True
    for r, h in spec.get("heights", {}).items():
        ws.row_dimensions[int(r)].height = h
    for r in spec.get("hiderows", []):
        ws.row_dimensions[int(r)].hidden = True
    for m in spec.get("merges", []):
        ws.merge_cells(m)
    wb.save(path)


def step(page, s):
    op = s[0]
    if op == "open":
        page.evaluate(OPEN, [s[1], s[2] if len(s) > 2 else None, s[3] if len(s) > 3 else None])
        page.wait_for_timeout(250)
    elif op in ("click", "rclick", "dblclick"):
        mods = s[2] if len(s) > 2 else []
        loc = page.locator(sel(s[1])).first
        if op == "click":
            loc.click(modifiers=mods)
        elif op == "dblclick":
            loc.dblclick()
        else:
            loc.click(button="right", modifiers=mods)
    elif op == "drag":
        x0, y0 = centre(page, s[1])
        x1, y1 = centre(page, s[2])
        page.mouse.move(x0, y0)
        page.mouse.down()
        page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=4)
        page.mouse.move(x1, y1, steps=6)
        page.mouse.up()
    elif op == "path":
        pts = [centre(page, t) for t in s[1:]]
        page.mouse.move(pts[0][0], pts[0][1])
        page.mouse.down()
        for x, y in pts[1:]:
            page.mouse.move(x, y, steps=6)
        page.mouse.up()
    elif op == "longpress":
        # a finger held on the target for 0.8 s (the browser's own touch events, through Chromium's DevTools input)
        x, y = centre(page, s[1])
        cdp = page.context.new_cdp_session(page)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        page.wait_for_timeout(800)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        cdp.detach()
    elif op == "press":
        page.keyboard.press(s[1])
    elif op == "type":
        page.keyboard.type(s[1])
    elif op == "menu":
        bs = page.locator(".lp-cmenu button")
        for i in range(bs.count()):
            if bs.nth(i).locator("span").first.inner_text() == s[1]:
                bs.nth(i).click()
                break
        else:
            raise RuntimeError("no menu item " + s[1])
    elif op == "radio":
        page.locator(".lp-cdlg label", has_text=s[1]).first.click()
    elif op == "fill":
        inp = page.locator(".lp-cdlg input[type=number]").first
        inp.click()
        page.keyboard.press("Control+a")
        page.keyboard.type(str(s[1]))
    elif op == "tick":
        box = page.locator(".lp-cdlg label", has_text=s[1]).locator("input").first
        if box.is_checked() != s[2]:
            box.click()
    elif op == "choose":
        page.locator(".lp-cdlg select[aria-label='%s']" % s[1]).select_option(s[2])
    elif op == "ok":
        page.locator(".lp-cdlg button[type=submit]").click()
    elif op == "cancel":
        page.locator(".lp-cdlg button", has_text="Cancel").click()
    elif op == "save":
        with page.expect_download() as dl:
            page.locator("button", has_text="Save .xlsx").first.click()
        path = os.path.join(TMP, s[1] + ".xlsx")
        dl.value.save_as(path)
        SAVED[s[1]] = path
    elif op == "import":
        spec = s[1]
        if "saved" in spec:
            path = SAVED[spec["saved"]]
        else:
            path = os.path.join(TMP, spec.get("name", "in") + ".xlsx")
            make_xlsx(spec, path)
        before = page.evaluate("() => window.Lantern.store.collection('sheet.docs').all().map(function (d) { return d.id; })")
        page.locator("button", has_text="← Sheets").first.click()
        page.wait_for_timeout(150)
        with page.expect_file_chooser() as fc:
            page.locator("button", has_text="Import file").first.click()
        fc.value.set_files(path)
        page.wait_for_timeout(700)
        page.evaluate("""(before) => { var all = window.Lantern.store.collection('sheet.docs').all();
          var nw = all.filter(function (d) { return before.indexOf(d.id) < 0; }).sort(function (a, b) { return (a.book && a.book.at || 0) - (b.book && b.book.at || 0); });
          if (nw.length) window.__id = nw[0].id; }""", before)
    elif op == "wait":
        page.wait_for_timeout(s[1])
    else:
        raise RuntimeError("unknown step " + op)
    page.wait_for_timeout(s[-1] if op == "wait" else 70)


def same(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        return abs(a - b) <= 1e-9 * max(1, abs(a), abs(b))
    return a == b


def read_xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path)
    ws = wb.active
    cols = {}
    for k, d in ws.column_dimensions.items():
        cols[k] = {"width": d.width, "hidden": bool(d.hidden), "custom": bool(d.customWidth)}
    rows = {}
    for k, d in ws.row_dimensions.items():
        rows[str(k)] = {"height": d.height, "hidden": bool(d.hidden)}
    cells = {}
    for row in ws.iter_rows():
        for c in row:
            if c.value is not None:
                cells[c.coordinate] = c.value
    return {"cols": cols, "rows": rows, "merges": sorted(str(m) for m in ws.merged_cells.ranges), "cells": cells}


def check(page, case, lo):
    ex = case["expect"]
    st = page.evaluate(STATE)
    bad = []

    def want(name, got, exp):
        if not same(got, exp):
            bad.append("%s %s, Excel %s" % (name, json.dumps(got), json.dumps(exp)))
    for k, v in ex.items():
        if k in ("range", "active", "focus", "bar", "dlg", "dlgValue"):
            want(k, st[k], v)
        elif k == "dlgChecked":
            want(k, st[k], v)
        elif k == "cells":
            for r, raw in v.items():
                want(r, st["cells"].get(r), raw)
        elif k == "values":
            for r, val in v.items():
                want("value " + r, st["values"].get(r), val)
        elif k == "shown":
            for r, t in v.items():
                want("shown " + r, st["shown"].get(r), t)
        elif k == "book":
            for name, o in v.items():
                got = (st["book"] or {}).get(name)
                if got is None:
                    bad.append("no sheet " + name + " in the workbook")
                    continue
                for r, raw in o.get("cells", {}).items():
                    want("%s!%s" % (name, r), got["cells"].get(r), raw)
                for r, val in o.get("values", {}).items():
                    want("value %s!%s" % (name, r), got["values"].get(r), val)
        elif k == "merges":
            want("merges", sorted(st["merges"]), sorted(v))
        elif k in ("hidden", "heights"):
            want(k, {a: b for a, b in st[k].items()}, v)
        elif k == "widths_any":
            for c, ws in v.items():
                if not any(same(st["widths"].get(c), w) for w in ws):
                    bad.append("width %s %s, Excel one of %s" % (c, json.dumps(st["widths"].get(c)), json.dumps(ws)))
        elif k == "widths":
            for c, w in v.items():
                want("width " + c, st["widths"].get(c), w)
        elif k == "fmt":
            for r, f in v.items():
                got = st["fmt"].get(r) or {}
                for fk, fv in f.items():
                    want("fmt %s.%s" % (r, fk), got.get(fk), fv)
        elif k == "menu":
            want("menu", st["items"], v)
        elif k == "menu_open":
            want("menu open", st["items"] is not None, v)
        elif k == "dlg_open":
            want("dialog open", st["dlg"] is not None, v)
        elif k == "warn":
            want("warning shown", bool(st["warn"]), v)
        elif k == "note_has":
            if v not in (st["note"] or ""):
                bad.append("note %s lacks %s" % (json.dumps(st["note"]), json.dumps(v)))
        elif k == "lo":
            exp = lo.get(case["id"])
            if exp is None:
                bad.append("no LibreOffice expectation")
            else:
                for r in sorted(set(exp) | set(st["cells"])):
                    got, f = st["cells"].get(r), exp.get(r)
                    if f is not None and "#REF!" in str(f):
                        if got is None or "#REF!" not in str(got):
                            bad.append("%s %s, LibreOffice %s" % (r, json.dumps(got), json.dumps(f)))
                    elif not same(got, f):
                        bad.append("%s %s, LibreOffice %s" % (r, json.dumps(got), json.dumps(f)))
        elif k == "xlsx":
            got = read_xlsx(SAVED[v["file"]])
            for c, o in v.get("cols", {}).items():
                g = got["cols"].get(c, {"width": None, "hidden": False})
                for a, b in o.items():
                    want("xlsx col %s %s" % (c, a), g.get(a), b)
            for r, o in v.get("rows", {}).items():
                g = got["rows"].get(r, {"height": None, "hidden": False})
                for a, b in o.items():
                    want("xlsx row %s %s" % (r, a), g.get(a), b)
            if "merges" in v:
                want("xlsx merges", got["merges"], sorted(v["merges"]))
            for r, val in v.get("cells", {}).items():
                want("xlsx " + r, got["cells"].get(r), val)
        elif k == "px":
            m = page.evaluate(WIDTHS)
            for a, b in v.items():
                if a.startswith("ratio:"):
                    c1, c2 = a[6:].split("/")
                    r = m["cols"][c1] / m["cols"][c2]
                    if abs(r - b) > 0.03 * b:
                        bad.append("drawn %s/%s %.3f, Excel %.3f" % (c1, c2, r, b))
                elif a.startswith("rratio:"):
                    r1, r2 = a[7:].split("/")
                    r = m["rows"][r1] / m["rows"][r2]
                    if abs(r - b) > 0.03 * b:
                        bad.append("drawn row %s/row %s %.3f, Excel %.3f" % (r1, r2, r, b))
                elif a.startswith("row:"):
                    if abs(m["rows"][a[4:]] - b) > 1.5:
                        bad.append("drawn row %s %.1f px, expected %.1f" % (a[4:], m["rows"][a[4:]], b))
                else:
                    if abs(m["cols"][a] - b) > 1.5:
                        bad.append("drawn %s %.1f px, expected %.1f" % (a, m["cols"][a], b))
        else:
            bad.append("unknown check " + k)
    return bad, st


def run_case(page, case, lo):
    for s in case["steps"]:
        step(page, s)
    page.wait_for_timeout(120)
    return check(page, case, lo)
