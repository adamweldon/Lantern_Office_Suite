# replay.py -- the second review of 1.24.27's lists, replayed (tests/fixtures/review2_lists_1267.json).
# Each case runs again against the Lantern of now (site/index.html) in Chromium, with the list markers Chromium
# draws read from its accessibility tree (the function is tests/review_lists_1267.py's), LibreOffice as a stand-in
# for Word, pdftotext, and the OOXML schema; then its "expect" is checked. It uses the first review's expectation
# keys, and these new ones:
#   browser_markers_contains            a marker (with the start of its item's words) the saved .html shows in Chromium
#   page_markers_after_import_contains  ...that the saved .html shows once imported back into Writer (writerClean)
#   page_markers_not_contains           a marker the page must not show
#   txt_one_of                          the .txt is one of these
#   preview_markers                     the markers MAKE DOC's preview (the box shown before Open in Writer) shows
#   pdf_raw_contains                    a drawing operator in the PDF (" S Q": the circle bullet drawn)
#   example_contains                    words MAKE DOC's example (in Lantern.aiAct.prompt) must have
# and these case fields: "into" (a paste lands in this document, at its end, instead of an empty one), "bench_id"
# (the bench question bench_pass grades the reply against), "questions" (the prompts example_lines_contain_no reads).
# A page case opened from HTML can say "then: caret at the end of 'words', Tab" in its "made".
# Usage: python3 tests/fixtures/lists/review2/replay.py [-v] [--dump obs.json]
# A case passes when Lantern does what it expects; "agree" cases should pass and "disagree" ones fail until mended.
import base64, json, os, re, shutil, subprocess, sys, tempfile, time
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
FIX = os.path.join(ROOT, "tests", "fixtures", "review2_lists_1267.json")
R = json.load(open(FIX, encoding="utf-8"))
VERBOSE = "-v" in sys.argv
DUMP = sys.argv[sys.argv.index("--dump") + 1] if "--dump" in sys.argv else None
VALIDATOR = "/mnt/skills/public/docx/scripts/office/validate.py"
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print("SKIP  Playwright is not on this machine"); sys.exit(0)
SOFFICE, PDFTOTEXT = shutil.which("soffice"), shutil.which("pdftotext")
sys.path.insert(0, os.path.join(ROOT, "tests"))
# the helpers and the marker reader of the first review's replay, as they are there
SRC = open(os.path.join(ROOT, "tests", "review_lists_1267.py"), encoding="utf-8").read()
HELP = re.search(r'HELP = r"""([\s\S]*?)"""', SRC).group(1)
exec(re.search(r"(def ax_markers[\s\S]*?\n    return out\n)", SRC).group(1))
STYLES = "() => Array.prototype.map.call(document.querySelectorAll('.page ol, .page ul'), function (o) { return getComputedStyle(o).listStyleType; })"
PORT = 8143
tmp = tempfile.mkdtemp(prefix="lists_review2_")
cases = R["cases"]
def path_of(s): return os.path.join(ROOT, s) if isinstance(s, str) and s.startswith("tests/") else None
def body_of(html):
    m = re.search(r"<body[^>]*>([\s\S]*)</body>", html, re.I)
    return m.group(1) if m else html
obs, lo_jobs, resave_jobs = {}, [], []
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1366, "height": 900}, accept_downloads=True)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        answers = []
        pg.on("dialog", lambda d: d.accept(answers.pop(0)) if answers else d.dismiss())
        pg.goto("http://127.0.0.1:%d/index.html#writer" % PORT); pg.wait_for_timeout(1500)
        pg.evaluate(HELP)
        def ev(js, arg=None): return pg.evaluate(js, arg)
        def open_doc(html, title="T"):
            ev("([t, h]) => { var L = window.Lantern; var id = L.writerDocs.create(t, h); L.writerDocs.open(id); }", [title, html]); pg.wait_for_timeout(200)
        def page_obs():
            return {"markers": ax_markers(pg, ctx), "styles": ev(STYLES), "page_html": ev("() => document.querySelector('.page').innerHTML"),
                    "focus": ev("() => !!document.activeElement && !!document.activeElement.closest && !!document.activeElement.closest('.page')")}
        def caret(where, text=None):
            ev("""([w, t]) => { var pe = document.querySelector('.page'); pe.focus(); var r = document.createRange(), s = getSelection();
              if (t != null) { var tw = document.createTreeWalker(pe, NodeFilter.SHOW_TEXT), n; while ((n = tw.nextNode())) if (n.nodeValue.indexOf(t) >= 0) { r.setStart(n, n.nodeValue.indexOf(t) + t.length); break; } }
              else if (w === 'cell') { r.selectNodeContents(pe.querySelector('td')); } else r.selectNodeContents(pe);
              r.collapse(w === 'cell'); s.removeAllRanges(); s.addRange(r); }""", [where, text])
        def step(tok):
            m = re.match(r"^(Indent more|Indent less)(?: x(\d+))?$", tok)
            mc = re.match(r"^caret at the end of '([^']*)'$", tok)
            if tok.startswith("'"): pg.keyboard.type(tok[1:-1])
            elif tok in ("1. List", "• List"): pg.locator("button", has_text=tok).first.click()
            elif m:
                for _ in range(int(m.group(2) or 1)): pg.locator("button[title='%s']" % m.group(1)).first.click()
            elif tok in ("Enter", "Tab", "Shift+Tab", "Shift+ArrowUp", "ArrowUp", "ArrowDown", "Home", "End"): pg.keyboard.press(tok)
            elif tok.startswith("Table tool"):
                mm = re.match(r"Table tool (\d+)x(\d+)", tok)
                answers[:] = [mm.group(1), mm.group(2)] if mm else ["1", "2"]; pg.locator("button[title='Insert a table']").first.click(); pg.wait_for_timeout(300); answers[:] = []
            elif tok == "caret in the first cell": caret("cell")
            elif mc: caret("text", mc.group(1))
            elif tok == "click in the page": pass
            else: raise Exception("a step this replay does not know: " + tok)
            pg.wait_for_timeout(60)
        def steps_of(s): return [t.strip() for t in re.findall(r"'[^']*'|[^,]+", re.sub(r"\([^)]*\)", "", s)) if t.strip()]
        def typed(made):
            open_doc(""); ev("() => { var pe = document.querySelector('.page'); pe.focus(); var r = document.createRange(); r.selectNodeContents(pe); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }")
            pg.keyboard.press("Delete")
            for tok in steps_of(made.split("as listed: ", 1)[1]): step(tok)
            pg.wait_for_timeout(200)
            return page_obs()
        def save(html, which, title):
            open_doc(html, title); ev("() => { window.__saved = []; }")
            pg.locator("button", has_text=which).first.click(); pg.wait_for_timeout(150)
            return ev("() => window.__saved[0].data")
        def write_file(name, b64s):
            f = os.path.join(tmp, name); open(f, "wb").write(base64.b64decode(b64s)); return f
        def html_in(c):
            f = path_of(c["input"])
            if f and f.endswith(".docx"): return ev("([s, n]) => window.__R.read(s, n).html", [base64.b64encode(open(f, "rb").read()).decode(), os.path.basename(f)])
            if f: return ev("([h]) => window.__R.clean(h)", [body_of(open(f, encoding="utf-8").read())])
            return c["input"]
        def doc_of(reply):
            lines = reply.split("\n"); t = re.sub(r"^MAKE DOC:\s*", "", lines[0]); end = len(lines) - 1 - lines[::-1].index("END") if "END" in lines else -1
            return ev("([t, ls, cl]) => { var d = window.Lantern.aiDoc.doc({ title: t, lines: ls, closed: cl }); return { html: d.html, parts: d.parts, title: t }; }", [t, lines[1:end if end >= 0 else len(lines)], end >= 0])
        for c in cases:
            cid, area, e, o = c["id"], c["area"], c["expect"], {}
            obs[cid] = o
            try:
                if area == "page":
                    if c["made"].startswith("typed in Chromium"): o.update(typed(c["made"]))
                    else:
                        open_doc(html_in(c))
                        if "then: " in c["made"]:
                            for tok in steps_of(c["made"].split("then: ", 1)[1]): step(tok)
                            pg.wait_for_timeout(150)
                        o.update(page_obs())
                elif area == "txt":
                    o["txt"] = ev("([h]) => window.__R.txt(h)", [html_in(c)])
                elif area == "html":
                    saved = save(html_in(c), "Save .html", cid); o["saved"] = saved
                    hf = os.path.join(tmp, cid + ".html"); open(hf, "w", encoding="utf-8").write(saved)
                    p2 = ctx.new_page(); p2.goto("file://" + hf); o["browser_markers"] = ax_markers(p2, ctx, None); p2.close()
                    if "lo_text_contains" in e: lo_jobs.append((cid, "lo_text", hf))
                    if "page_markers_after_import_contains" in e: open_doc(ev("([h]) => window.__R.clean(h)", [body_of(saved)])); o["import_markers"] = ax_markers(pg, ctx)
                elif area == "pdf":
                    h = html_in(c)
                    pf = write_file(cid + ".pdf", ev("async ([h]) => await window.__R.pdf(h)", [h]))
                    o["pdf_text"] = subprocess.run(["pdftotext", "-layout", pf, "-"], capture_output=True, text=True).stdout if PDFTOTEXT else None
                    o["blocks"] = ev("([h]) => window.__R.blocks(h)", [h]); o["pdf_raw"] = open(pf, "rb").read().decode("latin1")
                elif area == "docx-write":
                    w = ev("([h]) => window.__R.docx(h)", [html_in(c)]); df = write_file(cid + ".docx", w["b64"])
                    o["docx"] = df; o["notes"] = w["notes"]; wd = ev("([s]) => window.__R.word(s)", [w["b64"]]); o["items"], o["xml"] = wd["items"], wd["xml"]
                    o["back"] = ev("([s]) => window.__R.read(s, 'x.docx').html", [w["b64"]])
                    lo_jobs.append((cid, "lo_text", df))
                elif area == "docx-read" and not path_of(c["input"]):
                    w = ev("([h]) => window.__R.docx(h)", [c["input"]]); resave_jobs.append((cid, write_file(cid + ".docx", w["b64"])))
                elif area == "docx-read":
                    f = path_of(c["input"])
                    r = ev("([s, n]) => window.__R.read(s, n)", [base64.b64encode(open(f, "rb").read()).decode(), os.path.basename(f)])
                    o["read_html"], o["notes"] = r["html"], r["notes"]
                    open_doc(r["html"]); o.update(page_obs()); o["txt"] = ev("([h]) => window.__R.txt(h)", [r["html"]])
                    lo_jobs.append((cid, "lo_original", f))
                elif area == "paste":
                    open_doc(c.get("into") or "<p><br></p>"); caret("end")
                    ev("""([h]) => { var pe = document.querySelector('.page'); var dt = new DataTransfer(); dt.setData('text/html', h); dt.setData('text/plain', 'x');
                      pe.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""", [open(path_of(c["input"]), encoding="utf-8").read() if path_of(c["input"]) else c["input"]]); pg.wait_for_timeout(100)
                    o.update(page_obs()); o["txt"] = ev("([h]) => window.__R.txt(h)", [o["page_html"]])
                elif area == "makedoc":
                    if "example_contains" in e or "example_lines_contain_no" in e:
                        o["prompts"] = [ev("([q]) => window.__R.prompt(q)", [q]) for q in c.get("questions") or ["Write a short procedure for changing the oil in a lawn mower engine, as a document I can print."]]
                        ex = o["prompts"][0]; ex = ex[ex.index("For example:\nMAKE DOC:") + len("For example:\n"):]; o["reply"] = ex[:ex.index("\nEND") + 4]
                    else: o["reply"] = c["input"]
                    d = doc_of(o["reply"]); o["doc"] = d; o["txt"] = ev("([h]) => window.__R.txt(h)", [d["html"]])
                    if "bench_pass" in e: o["grade"] = ev("([i, r]) => window.__R.grade(i, r)", [c.get("bench_id", "make-doc-oil-change"), o["reply"]])
                    if "preview_markers" in e:
                        ev("""([r]) => { var m = window.Lantern.aiAct.build(r, 'Write this as a document I can print.'); var old = document.getElementById('rv2pv'); if (old) old.remove();
                          var box = m.preview(); box.id = 'rv2pv'; box.setAttribute('aria-label', 'Preview box'); box.setAttribute('role', 'region'); document.body.appendChild(box); }""", [o["reply"]])
                        pg.wait_for_timeout(100); o["preview_markers"] = ax_markers(pg, ctx, "Preview box")
                        ev("() => { var b = document.getElementById('rv2pv'); if (b) b.remove(); }")
            except Exception as ex_:
                o["error"] = str(ex_)[:400]
        page_errors = list(errs)
        ctx.close(); b.close()
finally:
    srv.terminate()
if SOFFICE:
    if resave_jobs:
        rd = os.path.join(tmp, "resave"); os.makedirs(rd, exist_ok=True)
        subprocess.run([SOFFICE, "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", rd] + [f for _, f in resave_jobs], capture_output=True, timeout=600)
    groups = {}
    for cid, key, f in lo_jobs: groups.setdefault(key, []).append((cid, f))
    for key, jobs in groups.items():
        names = []
        for cid, f in jobs:
            g = os.path.join(tmp, "in_" + key, cid + os.path.splitext(f)[1]); os.makedirs(os.path.dirname(g), exist_ok=True); shutil.copy(f, g); names.append(g)
        od = os.path.join(tmp, "lo_" + key); os.makedirs(od, exist_ok=True)
        subprocess.run([SOFFICE, "--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", od] + names, capture_output=True, timeout=900)
        for cid, f in jobs:
            t = os.path.join(od, cid + ".txt")
            obs[cid][key] = open(t, encoding="utf-8", errors="replace").read().replace("﻿", "").replace("\r\n", "\n") if os.path.exists(t) else None
if resave_jobs and SOFFICE:
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page(); pg.goto("http://127.0.0.1:%d/index.html#writer" % PORT); pg.wait_for_timeout(1200); pg.evaluate(HELP)
            for cid, f in resave_jobs:
                g = os.path.join(tmp, "resave", os.path.basename(f))
                if not os.path.exists(g): continue
                h = pg.evaluate("([s]) => window.__R.read(s, 'x.docx').html", [base64.b64encode(open(g, "rb").read()).decode()]); obs[cid]["read_html"] = h
                pg.evaluate("([h]) => { var L = window.Lantern; L.writerDocs.open(L.writerDocs.create('T', h)); }", [h]); pg.wait_for_timeout(200)
                obs[cid]["markers"] = ax_markers(pg, ctx)
            b.close()
    finally:
        srv.terminate()

def norm_style(s): return "lower-alpha" if s == "lp-word-alpha" else s
def same_marker(e, a):
    if " " not in e: return a.split(" ")[0] == e
    return a == e or a.startswith(e) or (len(a) >= len(e.split(" ")[0]) + 20 and e.startswith(a))
def same_list(E, A): return len(E) == len(A) and all(same_marker(x, y) for x, y in zip(E, A))
def has_marker(v, M): return any(same_marker(v, m) for m in M or [])
def sq(s): return re.sub(r"[ \t]+", " ", s or "")
def check(c, o):
    e, bad = c["expect"], []
    if o.get("error"): return ["could not run it: " + o["error"]]
    M = o.get("markers")
    for k, v in e.items():
        if k == "page_markers" and not same_list(v, M or []): bad.append("markers %s" % " | ".join(M or []))
        elif k == "page_markers_one_of" and not any(same_list(x, M or []) for x in v): bad.append("markers %s" % " | ".join(M or []))
        elif k == "page_markers_contains" and not has_marker(v, M): bad.append("no marker %r: %s" % (v, " | ".join(M or [])))
        elif k == "page_markers_not_contains" and has_marker(v, M): bad.append("marker %r shown" % v)
        elif k == "page_styles" and [norm_style(s) for s in (o.get("styles") or [])][:len(v)] != v: bad.append("styles %s" % o.get("styles"))
        elif k == "page_html_contains" and v not in (o.get("page_html") or ""): bad.append("page lacks %r: %s" % (v, (o.get("page_html") or "")[:300]))
        elif k == "page_html_not_contains" and any(x in (o.get("page_html") or "") for x in (v if isinstance(v, list) else [v])): bad.append("page has one of %r" % v)
        elif k == "focus_stays_in" and bool(o.get("focus")) != bool(v): bad.append("focus in the page: %s" % o.get("focus"))
        elif k == "browser_markers" and not same_list(v, o.get("browser_markers") or []): bad.append("browser %s" % " | ".join(o.get("browser_markers") or []))
        elif k == "browser_markers_contains" and not has_marker(v, o.get("browser_markers")): bad.append("browser lacks %r: %s" % (v, " | ".join((o.get("browser_markers") or [])[-6:])))
        elif k == "page_markers_after_import_contains" and not has_marker(v, o.get("import_markers")): bad.append("imported back lacks %r: %s" % (v, " | ".join((o.get("import_markers") or [])[-6:])))
        elif k == "lo_text_contains":
            t = o.get("lo_text") if c["area"] != "docx-read" else o.get("lo_original")
            if t is None:
                if SOFFICE: bad.append("LibreOffice did not open it")
                continue
            for x in v:
                if x not in t and sq(x) not in sq(t): bad.append("LibreOffice lacks %r" % x)
        elif k == "txt_equals" and o.get("txt") != v: bad.append("txt %r" % o.get("txt"))
        elif k == "txt_one_of" and o.get("txt") not in v: bad.append("txt %r" % o.get("txt"))
        elif k == "txt_contains" and v not in (o.get("txt") or ""): bad.append("txt lacks %r: %r" % (v, (o.get("txt") or "")[:400]))
        elif k == "txt_not_contains" and v in (o.get("txt") or ""): bad.append("txt has %r: %r" % (v, (o.get("txt") or "")[:300]))
        elif k == "pdf_text_contains" and o.get("pdf_text") is not None:
            for x in v:
                if sq(x) not in sq(o["pdf_text"]): bad.append("PDF lacks %r" % x)
        elif k == "pdf_text_not_contains" and o.get("pdf_text") is not None and sq(v) in sq(o["pdf_text"]): bad.append("PDF has %r" % v)
        elif k == "pdf_raw_contains" and v not in (o.get("pdf_raw") or ""): bad.append("PDF draws no %r" % v)
        elif k == "blocks" and o.get("blocks") != v: bad.append("blocks %s" % o.get("blocks"))
        elif k == "valid" and v and os.path.exists(VALIDATOR) and o.get("docx"):
            r = subprocess.run([sys.executable, "validate.py", o["docx"]], cwd=os.path.dirname(VALIDATOR), capture_output=True, text=True, timeout=300)
            if "All validations PASSED" not in r.stdout + r.stderr: bad.append("not valid: " + (r.stdout + r.stderr)[-300:])
        elif k == "docx_numfmts":
            for x in v:
                if not any(i == x or i.startswith(x + ":") for i in o.get("items") or []): bad.append("Word file lacks %r: %s" % (x, o.get("items")))
        elif k == "read_back_contains" and v not in (o.get("back") or ""): bad.append("read back lacks %r: %s" % (v, o.get("back")))
        elif k == "read_html_contains" and v not in (o.get("read_html") or ""): bad.append("read lacks %r: %s" % (v, (o.get("read_html") or "")[:300]))
        elif k == "read_html_not_contains" and v in (o.get("read_html") or ""): bad.append("read has %r: %s" % (v, (o.get("read_html") or "")[:300]))
        elif k in ("doc_headings", "doc_items", "doc_paragraphs", "doc_rows") and o.get("doc") and o["doc"]["parts"][{"doc_items": "items"}.get(k, k[4:])] != v: bad.append("%s %s" % (k, o["doc"]["parts"]))
        elif k == "html_contains" and v not in o["doc"]["html"]: bad.append("lacks %r" % v)
        elif k == "html_contains_any" and not any(x in o["doc"]["html"] for x in v): bad.append("none of %r" % v)
        elif k == "numbered_step_marks_in_order":
            got = [l.split(" ")[0] for l in o["txt"].split("\n") if re.match(r"^\S+\. ", l)]
            if got != v: bad.append("steps %s" % got)
        elif k == "sub_step_marks":
            got = [l.strip().split(" ")[0] for l in o["txt"].split("\n") if re.match(r"^ {4}\S+\. ", l)]
            if got != v: bad.append("sub-steps %s" % got)
        elif k == "bench_pass" and bool(o["grade"]["pass"]) != bool(v): bad.append("the bench: %s %s" % (o["grade"]["pass"], o["grade"]["why"]))
        elif k == "preview_markers" and not same_list(v, o.get("preview_markers") or []): bad.append("preview %s" % " | ".join(o.get("preview_markers") or []))
        elif k == "no_digits_except_step_numbers" and any(re.search(r"\d", re.sub(r"^\d+\. ", "", l)) for l in o["reply"].split("\n")): bad.append("a figure in the example")
        elif k == "example_contains":
            for x in v:
                if x not in o["reply"]: bad.append("the example lacks %r" % x)
        elif k == "example_lines_contain_no":
            for pr in o.get("prompts") or []:
                exs = pr[pr.index("For example:"):] if "For example:" in pr else ""
                for x in v:
                    if re.search(r"\b" + re.escape(x) + r"\b", exs, re.I): bad.append("an example has %r" % x)
        elif k not in KNOWN: bad.append("an expectation this replay does not know: " + k)
    return bad
KNOWN = set("""page_markers page_markers_one_of page_markers_contains page_markers_not_contains page_styles page_html_contains page_html_not_contains
 focus_stays_in browser_markers browser_markers_contains page_markers_after_import_contains lo_text_contains txt_equals txt_one_of txt_contains
 txt_not_contains pdf_text_contains pdf_text_not_contains pdf_raw_contains blocks valid docx_numfmts read_back_contains read_html_contains
 read_html_not_contains doc_headings doc_items doc_paragraphs doc_rows html_contains html_contains_any numbered_step_marks_in_order sub_step_marks
 bench_pass preview_markers no_digits_except_step_numbers example_contains example_lines_contain_no or""".split())
fails = []
for c in cases:
    bad = check(c, obs.get(c["id"], {}))
    ok = not bad
    if (c["verdict"] == "agree") != ok or VERBOSE:
        print(("PASS " if ok else "FAIL ") + "%-48s %-9s %s" % (c["id"], c["verdict"], "; ".join(bad)[:600]))
    if c["verdict"] == "agree" and not ok: fails.append(c["id"])
if DUMP: json.dump(obs, open(DUMP, "w"), indent=1, default=str)
if page_errors: print("page errors:", page_errors[:3])
shutil.rmtree(tmp, ignore_errors=True)
n_ag = sum(1 for c in cases if c["verdict"] == "agree")
print("%d cases: %d agree (%d of them failing now), %d disagree, %d unsure" % (len(cases), n_ag, len(fails), sum(1 for c in cases if c["verdict"] == "disagree"), sum(1 for c in cases if c["verdict"] == "unsure")))
sys.exit(1 if fails else 0)
