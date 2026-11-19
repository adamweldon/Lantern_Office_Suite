# review_lists_1267.py -- the review of 1.24.27's lists (a list in a list numbered 1. a. i., as Word and Google Docs do)
# and of MAKE DOC's new example, replayed. A reviewer that had not written the change made 117 cases of its own
# (tests/fixtures/review_lists_1267.json; the files in tests/fixtures/lists/review/, made by make.py there): lists
# typed in Writer with its own buttons and keys, Word's and Google Docs' and LibreOffice's files, pastes, Save .txt,
# .html, .pdf and .docx, round trips, and MAKE DOC documents written as a small model writes them. Each case is run
# again here against the Lantern of now, in Chromium (the list markers are the ones Chromium draws, read from its
# accessibility tree), LibreOffice (as a stand-in for Word) and the OOXML schema, and its "expect" checked.
# A case that does not do what it expects fails, unless it is in KEEP (left as it is, with the reason) or LATER (not
# from this change, and in agent/QUEUE.md). What a machine lacks (Playwright, LibreOffice, pdftotext, the validator)
# is said as SKIP.
# Usage: python3 tests/review_lists_1267.py [-v]
import base64, json, os, re, shutil, subprocess, sys, tempfile, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, "tests", "fixtures", "review_lists_1267.json")
R = json.load(open(FIX, encoding="utf-8"))
VERBOSE = "-v" in sys.argv
VALIDATOR = "/mnt/skills/public/docx/scripts/office/validate.py"
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print("SKIP  Playwright is not on this machine: the lists review needs Chromium")
    print("ALL LISTS REVIEW CHECKS PASS (0 run)")
    sys.exit(0)
SOFFICE, PDFTOTEXT = shutil.which("soffice"), shutil.which("pdftotext")
skips = set()
if not SOFFICE: skips.add("LibreOffice")
if not PDFTOTEXT: skips.add("pdftotext")
if not os.path.exists(VALIDATOR): skips.add("the OOXML schema validator")

# Left as they are, with the reason (the case still runs; it is reported, not failed)
KEEP = {
    "import-libreoffice-html-decimal-levels": "an HTML file's nested <ol> says no style, so Writer shows its own, Word's 1. a. i., as it does every list in a list; a Word or LibreOffice file says its levels' styles and they are kept (docx-read-lo-toolbar-list), and Writer's own Save .html now writes them too",
    "docx-read-stored-1-24-26-imports": "documents read from a Word file on 1.24.26 (a branch never merged to main) kept no style for a 1, 2, 3 level, and show 1. a. i. now; it needs 1.24.26's reader to replay, so it is not run",
    "txt-save-then-import": "a .txt has no lists: it comes back as paragraphs (Import file), its indents gone, as a .txt does in Word; not run here (it needs the page's file chooser)",
    "makedoc-letter-copying-example-headings": "not seen in any run: a letter under ## Steps would be the model's, and a bench question for a letter would show whether it happens (QUEUE)",
    "makedoc-example-title-copied": "the title is the model's: Lantern cannot know that a compressor's title is wrong for a lawn mower without the question's own words for the machine",
}
# Not from this change: what they found is in agent/QUEUE.md, to be mended in a version of its own
LATER = {
    "pdf-item-two-paragraphs": ".pdf: an item's two paragraphs run together",
    "pdf-list-in-table-cell": ".pdf: a list in a table cell loses its numbers",
    "pdf-rtl-hebrew": ".pdf: Hebrew (and every script past Latin-1) printed as ?, unsaid",
    "pdf-wide-marks": ".pdf: a very wide number starts off the page",
    "docx-write-li-value": ".docx: an item's own number (value) is not written",
    "docx-write-negative-start": ".docx: a list from below 0 starts at 0, unsaid",
    "docx-write-ul-own-type": ".docx: a bullet list's own sign (square) is written by its level",
    "docx-read-word-multilevel-1-1-1": "Word's 1. 1.1. 1.1.1. lists come in as numbered paragraphs (1.24.26's choice), not lists",
    "docx-read-word-multilevel-paren": "Word's 1) a) i) come in as 1. a. i.",
    "docx-read-word-contract-parens": "Word's (a) (i) come in as a. i.",
    "docx-read-word-decimal-zero": "Word's 01. comes in as 1.",
    "docx-read-word-rtl-hebrew": "Word's Hebrew letters come in as 1. 2.",
    "roundtrip-word-parens": "Word's (a) (i) saved back as a. i.",
    "roundtrip-word-multilevel": "Word's 1. 1.1. saved back as numbered paragraphs",
    "paste-word-clipboard": "a list copied from Word pastes as paragraphs",
    "paste-li-value": "paste drops an item's own number (value); the Word file could not keep it (docx-write-li-value)",
    "paste-reversed": "paste drops reversed (a countdown)",
}
cases = R["cases"]
tmp = tempfile.mkdtemp(prefix="lists_review_")
PORT = 8141
REV = os.path.join(ROOT, "tests", "fixtures", "lists", "review")
def path_of(s): return os.path.join(ROOT, s) if isinstance(s, str) and s.startswith("tests/") else None
def body_of(html):
    m = re.search(r"<body[^>]*>([\s\S]*)</body>", html, re.I)
    return m.group(1) if m else html
TYPED_HTML = [c for c in cases if c["id"] == "page-typed-numbered-indent"][0]["input"]
HELP = r"""() => {
  var L = window.Lantern, R = window.__R = {};
  function b64(u8) { var s = "", i; for (i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, Array.prototype.slice.call(u8.subarray(i, i + 8192))); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  window.__saved = []; L.download = function (n, d, m) { window.__saved.push({ name: n, data: typeof d === "string" ? d : null }); };
  R.txt = function (h) { return L.writerText(h, true); };
  R.clean = function (h) { return L.writerClean(h); };
  R.blocks = function (h) {
    var body = new DOMParser().parseFromString("<!DOCTYPE html><body>" + h, "text/html").body;
    return L.pdf.layout.blocks(body).filter(function (b) { return b.kind === "li"; }).map(function (b) { return b.depth + ":" + b.mark + " " + b.runs.map(function (r) { return r.t; }).join(""); });
  };
  R.pdf = async function (h) { var bl = L.pdf.fromHtml("T", h); var ab = await bl.arrayBuffer(); return b64(new Uint8Array(ab)); };
  R.docx = function (h) { var x = L.docx.write("T", h); return { b64: b64(x.bytes), notes: x.notes }; };
  R.read = function (s, name) { var r = L.docx.read(unb64(s), name || "x.docx"); return { html: r.html, notes: r.notes }; };
  R.word = function (s) {
    var z = L.zip.read(unb64(s)), dx = z.text("word/document.xml"), nx = z.text("word/numbering.xml"), abs = {};
    nx.replace(/<w:abstractNum w:abstractNumId="(\d+)">([\s\S]*?)<\/w:abstractNum>/g, function (all, id, body) {
      abs[id] = []; body.replace(/<w:lvl w:ilvl="(\d)"><w:start w:val="(-?\d+)"\/><w:numFmt w:val="(\w+)"\/>/g, function (a, i, st, f) { abs[id][+i] = f + ":" + st; });
    });
    var nums = {}; nx.replace(/<w:num w:numId="(\d+)"><w:abstractNumId w:val="(\d+)"\/>/g, function (a, n, b) { nums[n] = b; });
    var items = []; dx.replace(/<w:p>(?:(?!<\/w:p>)[\s\S])*?<w:numPr><w:ilvl w:val="(\d)"\/><w:numId w:val="(\d+)"\/><\/w:numPr>([\s\S]*?)<\/w:p>/g, function (a, il, n, rest) {
      var t = (rest.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(function (x) { return x.replace(/<[^>]+>/g, ""); }).join("");
      items.push(t + "=ilvl" + il + ":" + (abs[nums[n]] ? abs[nums[n]][+il] : "?")); });
    return { items: items, xml: dx };
  };
  R.doc = function (reply) {
    var lines = reply.split("\n"), t = lines[0].replace(/^MAKE DOC:\s*/, ""), end = lines.lastIndexOf("END");
    var d = L.aiDoc.doc({ title: t, lines: lines.slice(1, end < 0 ? lines.length : end), closed: end >= 0 });
    return { html: d.html, parts: d.parts, title: t };
  };
  R.grade = function (id, reply) { var it = L.aiBenchQuestions.filter(function (q) { return q.id === id; })[0]; var g = L.aiBench.grade(it, reply, { made: L.aiAct.build(reply, it.q) }); return { pass: g.pass, why: g.why }; };
  R.prompt = function (q) { return L.aiAct.prompt(q); };
  return Object.keys(R);
}"""
def ax_markers(page, ctx, scope_name="Document text"):
    """the list markers Chromium draws, in document order, each with the start of its item's text: ["1. one", "a. two"]"""
    cdp = ctx.new_cdp_session(page)
    tree = cdp.send("Accessibility.getFullAXTree")["nodes"]
    cdp.detach()
    by = {n["nodeId"]: n for n in tree}
    out = []
    def name(n): return (n.get("name") or {}).get("value") or ""
    def role(n): return (n.get("role") or {}).get("value")
    def text_of(n):
        s = ""
        for c in n.get("childIds", []):
            k = by.get(c)
            if not k: continue
            r = role(k)
            if r == "ListMarker": continue
            if r == "list": break
            if r == "StaticText": s += name(k)
            elif r != "InlineTextBox": s += text_of(k)
            if len(s) > 24: break
        return s
    def walk(n, inside):
        if scope_name and name(n) == scope_name: inside = True
        if inside and role(n) == "listitem":
            mk = ""
            for c in n.get("childIds", []):
                k = by.get(c)
                if k and role(k) == "ListMarker": mk = name(k); break
            out.append(mk.strip() + " " + text_of(n).strip()[:24])
        for c in n.get("childIds", []):
            if c in by: walk(by[c], inside)
    walk(tree[0], scope_name is None)
    return out
STYLES = "() => Array.prototype.map.call(document.querySelectorAll('.page ol, .page ul'), function (o) { return getComputedStyle(o).listStyleType; })"
obs = {}
lo_jobs = []          # (case id, key, file) for LibreOffice's text
resave_jobs = []      # (case id, file) for LibreOffice's resave as Word
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1366, "height": 900}, accept_downloads=True)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        dialog_answers = []
        def on_dialog(d):
            if dialog_answers: d.accept(dialog_answers.pop(0))
            else: d.dismiss()
        pg.on("dialog", on_dialog)
        pg.goto("http://127.0.0.1:%d/index.html#writer" % PORT); pg.wait_for_timeout(1500)
        pg.evaluate(HELP)
        def ev(js, arg=None): return pg.evaluate(js, arg)
        def open_doc(html, title="T"):
            ev("([t, h]) => { var L = window.Lantern; var id = L.writerDocs.create(t, h); L.writerDocs.open(id); }", [title, html]); pg.wait_for_timeout(200)
        def page_obs():
            return {"markers": ax_markers(pg, ctx), "styles": ev(STYLES), "page_html": ev("() => document.querySelector('.page').innerHTML"),
                    "focus": ev("() => !!document.activeElement && !!document.activeElement.closest && !!document.activeElement.closest('.page')")}
        def caret_end(): ev("() => { var pe = document.querySelector('.page'); pe.focus(); var r = document.createRange(); r.selectNodeContents(pe); r.collapse(false); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }")
        def typed(made):
            open_doc(""); ev("() => { var pe = document.querySelector('.page'); pe.focus(); var r = document.createRange(); r.selectNodeContents(pe); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }")
            pg.keyboard.press("Delete")
            steps = re.sub(r"\([^)]*\)", "", made.split("as listed: ", 1)[1])
            for tok in [t.strip() for t in re.findall(r"'[^']*'|[^,]+", steps) if t.strip()]:
                m = re.match(r"^(Indent more|Indent less)(?: x(\d+))?$", tok)
                if tok.startswith("'"): pg.keyboard.type(tok[1:-1])
                elif tok in ("1. List", "• List"): pg.locator("button", has_text=tok).first.click()
                elif m:
                    for _ in range(int(m.group(2) or 1)): pg.locator("button[title='%s']" % m.group(1)).first.click()
                elif tok in ("Enter", "Tab", "Shift+Tab", "Shift+ArrowUp"): pg.keyboard.press(tok)
                elif tok.startswith("Table tool"):
                    dialog_answers[:] = ["1", "2"]; pg.locator("button[title='Insert a table']").first.click(); pg.wait_for_timeout(300); dialog_answers[:] = []
                elif tok == "caret in the first cell":
                    ev("() => { var td = document.querySelector('.page td'); var r = document.createRange(); r.selectNodeContents(td); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector('.page').focus(); }")
                elif tok == "click in the page": pass
                else: raise Exception("a step this replay does not know: " + tok)
            pg.wait_for_timeout(200)
            return page_obs()
        def save_html(html):
            open_doc(html, "Typed"); ev("() => { window.__saved = []; }")
            pg.locator("button", has_text="Save .html").first.click(); pg.wait_for_timeout(100)
            return ev("() => window.__saved[0].data")
        def write_file(name, b64s):
            f = os.path.join(tmp, name); open(f, "wb").write(base64.b64decode(b64s)); return f
        def pdf_text(f): return subprocess.run(["pdftotext", "-layout", f, "-"], capture_output=True, text=True).stdout if PDFTOTEXT else None
        def example():
            pr = ev("([q]) => window.__R.prompt(q)", ["Write a short procedure for changing the oil in a lawn mower engine, as a document I can print."])
            ex = pr[pr.index("For example:\nMAKE DOC:") + len("For example:\n"):]
            return ex[:ex.index("\nEND") + 4], pr
        def from_file(c):
            f = path_of(c["input"]); return f, open(f, "rb").read()
        for c in cases:
            cid, area, inp, e, o = c["id"], c["area"], c["input"], c["expect"], {}
            obs[cid] = o
            if cid in ("docx-read-stored-1-24-26-imports", "txt-save-then-import"): o["not_run"] = True; continue
            try:
                f = path_of(inp)
                # --- what the page shows ---
                if area == "page":
                    if c["made"].startswith("typed in Chromium"): o.update(typed(c["made"]))
                    elif cid == "page-indent-inside-own-type":
                        open_doc(inp); caret_end(); pg.locator("button[title='Indent more']").first.click(); pg.wait_for_timeout(150); o.update(page_obs())
                    elif f: open_doc(ev("([h]) => window.__R.clean(h)", [body_of(open(f, encoding="utf-8").read())])); o.update(page_obs())
                    else: open_doc(inp); o.update(page_obs())
                    if "page_markers_27_to_30" in e: o["txt"] = ev("([h]) => window.__R.txt(h)", [inp])
                elif area == "html":
                    saved = save_html(TYPED_HTML); o["saved"] = saved
                    hf = os.path.join(tmp, cid + ".html"); open(hf, "w", encoding="utf-8").write(saved)
                    if "browser_markers" in e:
                        p2 = ctx.new_page(); p2.goto("file://" + hf); o["browser_markers"] = ax_markers(p2, ctx, None); p2.close()
                    if "lo_text_contains" in e: lo_jobs.append((cid, "lo_text", hf))
                    if "page_markers" in e: open_doc(ev("([h]) => window.__R.clean(h)", [body_of(saved)])); o.update(page_obs())
                elif area == "txt":
                    if f and f.endswith(".docx"): h = ev("([s, n]) => window.__R.read(s, n).html", [base64.b64encode(open(f, "rb").read()).decode(), os.path.basename(f)])
                    elif f: h = ev("([h]) => window.__R.clean(h)", [body_of(open(f, encoding="utf-8").read())])
                    else: h = inp
                    o["txt"] = ev("([h]) => window.__R.txt(h)", [h])
                    if "txt_label_of_item_28_equals_page_label" in e: open_doc(h); o.update(page_obs())
                elif area == "pdf":
                    pf = write_file(cid + ".pdf", ev("async ([h]) => await window.__R.pdf(h)", [inp]))
                    o["pdf_text"] = pdf_text(pf); o["blocks"] = ev("([h]) => window.__R.blocks(h)", [inp]); o["pdf_raw"] = open(pf, "rb").read().decode("latin1")
                    if "pdf_label_of_item_28_equals_page_label" in e: open_doc(inp); o.update(page_obs())
                elif area == "docx-write" and f:
                    # a round trip: the file read, written again, both in LibreOffice
                    r = ev("([s, n]) => window.__R.read(s, n)", [base64.b64encode(open(f, "rb").read()).decode(), os.path.basename(f)])
                    w = ev("([h]) => window.__R.docx(h)", [r["html"]])
                    lo_jobs.append((cid, "lo_original", f)); lo_jobs.append((cid, "lo_text", write_file(cid + ".docx", w["b64"])))
                elif area == "docx-write":
                    w = ev("([h]) => window.__R.docx(h)", [inp]); df = write_file(cid + ".docx", w["b64"])
                    o["docx"] = df; o["notes"] = w["notes"]; wd = ev("([s]) => window.__R.word(s)", [w["b64"]]); o["items"], o["xml"] = wd["items"], wd["xml"]
                    o["back"] = ev("([s]) => window.__R.read(s, 'x.docx').html", [w["b64"]])
                    lo_jobs.append((cid, "lo_text", df))
                    if "word_label_of_item_28_equals_page_label" in e: open_doc(inp); o.update(page_obs())
                elif area == "docx-read" and not f:
                    # HTML -> Word file -> LibreOffice's resave -> read
                    w = ev("([h]) => window.__R.docx(h)", [inp]); resave_jobs.append((cid, write_file(cid + ".docx", w["b64"])))
                elif area == "docx-read":
                    r = ev("([s, n]) => window.__R.read(s, n)", [base64.b64encode(open(f, "rb").read()).decode(), os.path.basename(f)])
                    o["read_html"], o["notes"] = r["html"], r["notes"]
                    open_doc(r["html"]); o.update(page_obs())
                elif area == "paste":
                    open_doc("<p><br></p>"); caret_end()
                    ev("""([h]) => { var pe = document.querySelector('.page'); var dt = new DataTransfer(); dt.setData('text/html', h); dt.setData('text/plain', 'x');
                      pe.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""", [inp]); pg.wait_for_timeout(100)
                    o.update(page_obs())
                elif area == "makedoc":
                    ex, pr = example()
                    if cid == "makedoc-example-in-every-prompt":
                        qs = ["Write a short procedure for changing the oil in a lawn mower engine, as a document I can print.", "Write a procedure for changing the oil in my air compressor, as a document I can print.",
                              "Write a letter to my landlord about the broken boiler.", "Make a notice for the village hall: the water is off on Saturday.",
                              "Make me a Word document (.docx) I can print: a weekly safety checklist for a small workshop.", "Write a short report on the generator fault for the committee."]
                        o["prompts"] = [ev("([q]) => window.__R.prompt(q)", [q]) for q in qs]; continue
                    # the cases that copy the example copy the example of now
                    reply = ex if cid in ("makedoc-example-as-a-document", "makedoc-example-copied-for-compressor") else \
                        ex.replace("Changing the compressor oil", "Changing the oil in a lawn mower engine").replace("compressor", "mower") if cid == "makedoc-example-copied-for-lawn-mower" else inp
                    o["reply"] = reply
                    d = ev("([r]) => window.__R.doc(r)", [reply]); o["doc"] = d
                    o["txt"] = ev("([h]) => window.__R.txt(h)", [d["html"]])
                    if "bench_pass" in e: o["grade"] = ev("([i, r]) => window.__R.grade(i, r)", ["make-doc-word-checklist" if "checklist" in reply.split("\n")[0].lower() else "make-doc-oil-change", reply])
                    if "page_markers_one_of" in e: open_doc(d["html"]); o.update(page_obs())
            except Exception as ex_:
                o["error"] = str(ex_)[:400]
        o_errs = list(errs)
        ctx.close(); b.close()
finally:
    srv.terminate()
# LibreOffice: every file's text at once; the Word files to resave
if SOFFICE:
    if resave_jobs:
        rd = os.path.join(tmp, "resave"); os.makedirs(rd, exist_ok=True)
        subprocess.run([SOFFICE, "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", rd] + [f for _, f in resave_jobs], capture_output=True, timeout=600)
    groups = {}
    for cid, key, f in lo_jobs: groups.setdefault(key, []).append((cid, f))
    for key, jobs in groups.items():
        od = os.path.join(tmp, "lo_" + key); os.makedirs(od, exist_ok=True)
        # the same base name twice (a round trip's original) would clash: copy each into a name of its own
        names = []
        for cid, f in jobs:
            g = os.path.join(tmp, "in_" + key, cid + os.path.splitext(f)[1]); os.makedirs(os.path.dirname(g), exist_ok=True); shutil.copy(f, g); names.append(g)
        subprocess.run([SOFFICE, "--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", od] + names, capture_output=True, timeout=900)
        for cid, f in jobs:
            t = os.path.join(od, cid + ".txt")
            obs[cid][key] = open(t, encoding="utf-8", errors="replace").read().replace("﻿", "").replace("\r\n", "\n") if os.path.exists(t) else None
# the resaved Word files read back (in a fresh browser)
if resave_jobs and SOFFICE:
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(); pg.goto("http://127.0.0.1:%d/index.html#writer" % PORT); pg.wait_for_timeout(1200); pg.evaluate(HELP)
            for cid, f in resave_jobs:
                g = os.path.join(tmp, "resave", os.path.basename(f))
                obs[cid]["read_html"] = pg.evaluate("([s]) => window.__R.read(s, 'x.docx').html", [base64.b64encode(open(g, "rb").read()).decode()]) if os.path.exists(g) else None
            b.close()
    finally:
        srv.terminate()

# --- the expectations ---
def norm_style(s): return "lower-alpha" if s == "lp-word-alpha" else s
def same_marker(e, a):
    if " " not in e: return a.split(" ")[0] == e
    return a == e or a.startswith(e) or (len(a) >= len(e.split(" ")[0]) + 20 and e.startswith(a))
def same_list(E, A): return len(E) == len(A) and all(same_marker(e, a) for e, a in zip(E, A))
def sq(s): return re.sub(r"[ \t]+", " ", s or "")
def label(markers, text):
    for m in markers:
        if m.split(" ", 1)[-1].startswith(text): return m.split(" ")[0]
def txt_label(txt, text):
    for l in (txt or "").split("\n"):
        if l.strip().split(" ", 1)[-1] == text: return l.strip().split(" ")[0]
def check(c, o):
    e, bad = c["expect"], []
    if o.get("error"): return ["the replay could not run it: " + o["error"]]
    M = o.get("markers")
    for k, v in e.items():
        if k == "page_markers" and M is not None and not same_list(v, M): bad.append("markers %s" % " | ".join(M))
        elif k == "page_markers_one_of" and not any(same_list(x, M or []) for x in v): bad.append("markers %s" % " | ".join(M or []))
        elif k == "page_markers_27_to_30" and not same_list(v, (M or [])[27:31]): bad.append("markers 27-30: %s" % " | ".join((M or [])[27:31]))
        elif k == "page_markers_first_9" and not same_list(v, (M or [])[:9]): bad.append("first 9: %s" % " | ".join((M or [])[:9]))
        elif k == "page_markers_first_3" and not same_list(v, (M or [])[:3]): bad.append("first 3: %s" % " | ".join((M or [])[:3]))
        elif k == "page_markers_after_9_all" and not all(m.split(" ")[0] == v for m in (M or [])[9:]): bad.append("after 9: %s" % " | ".join((M or [])[9:]))
        elif k == "page_markers_contains" and not any(v in m for m in (M or [])): bad.append("no marker %r: %s" % (v, " | ".join(M or [])))
        elif k == "page_styles" and [norm_style(s) for s in (o.get("styles") or [])][:len(v)] != v: bad.append("styles %s" % o.get("styles"))
        elif k == "page_html_contains" and v not in (o.get("page_html") or ""): bad.append("page lacks %r: %s" % (v, (o.get("page_html") or "")[:300]))
        elif k == "page_html_not_contains" and any(x in (o.get("page_html") or "") for x in (v if isinstance(v, list) else [v])): bad.append("page has one of %r" % v)
        elif k == "focus_stays_in" and not o.get("focus"): bad.append("the page lost the keys")
        elif k == "browser_markers" and not same_list(v, o.get("browser_markers") or []): bad.append("browser %s" % " | ".join(o.get("browser_markers") or []))
        elif k == "lo_text_contains":
            if o.get("lo_text") is None:
                if SOFFICE: bad.append("LibreOffice did not open it")
                continue
            for x in v:
                if x not in o["lo_text"] and sq(x) not in sq(o["lo_text"]): bad.append("LibreOffice lacks %r" % x)
        elif k == "lo_text_equals_original":
            if o.get("lo_text") is None or o.get("lo_original") is None:
                if SOFFICE: bad.append("LibreOffice did not open it")
                continue
            if sq(o["lo_text"]).strip() != sq(o["lo_original"]).strip(): bad.append("LibreOffice's text differs from the original's: %r vs %r" % (o["lo_text"][:300], o["lo_original"][:300]))
        elif k == "txt_equals" and o.get("txt") != v: bad.append("txt %r" % o.get("txt"))
        elif k == "txt_contains" and v not in (o.get("txt") or ""): bad.append("txt lacks %r: %r" % (v, (o.get("txt") or "")[:400]))
        elif k == "txt_not_contains" and v in (o.get("txt") or ""): bad.append("txt has %r" % v)
        elif k == "txt_label_of_item_28_equals_page_label" and txt_label(o.get("txt"), "Part 28") != label(M or [], "Part 28"): bad.append("txt %s, page %s" % (txt_label(o.get("txt"), "Part 28"), label(M or [], "Part 28")))
        elif k == "pdf_text_contains":
            if o.get("pdf_text") is None: continue
            for x in v:
                if sq(x) not in sq(o["pdf_text"]): bad.append("PDF lacks %r" % x)
        elif k == "pdf_text_not_contains" and o.get("pdf_text") is not None and sq(v) in sq(o["pdf_text"]): bad.append("PDF has %r" % v)
        elif k == "pdf_label_of_item_28_equals_page_label":
            bl = [x for x in o.get("blocks") or [] if x.endswith("Part 28")]
            if not bl or bl[0].split(":", 1)[1].split(" ")[0] != label(M or [], "Part 28"): bad.append("PDF %s, page %s" % (bl, label(M or [], "Part 28")))
        elif k == "blocks_first_12_marks" and [x.split(":", 1)[1].split(" ")[0] for x in (o.get("blocks") or [])[:12]] != v: bad.append("blocks %s" % (o.get("blocks") or [])[:12])
        elif k == "blocks" and o.get("blocks") != v: bad.append("blocks %s" % o.get("blocks"))
        elif k == "drawn" and not (" S Q" in (o.get("pdf_raw") or "") and " re f" in (o.get("pdf_raw") or "")): bad.append("the circle and square are not drawn")
        elif k == "valid" and v and os.path.exists(VALIDATOR) and o.get("docx"):
            r = subprocess.run([sys.executable, "validate.py", o["docx"]], cwd=os.path.dirname(VALIDATOR), capture_output=True, text=True, timeout=300)
            if "All validations PASSED" not in r.stdout + r.stderr: bad.append("not valid: " + (r.stdout + r.stderr)[-300:])
        elif k == "docx_numfmts":
            for x in v:
                if not any(i == x or i.startswith(x + ":") for i in o.get("items") or []): bad.append("Word file lacks %r: %s" % (x, o.get("items")))
        elif k == "docx_contains" and v not in (o.get("xml") or ""): bad.append("document.xml lacks %r" % v)
        elif k == "read_back_contains" and v not in (o.get("back") or ""): bad.append("read back lacks %r: %s" % (v, o.get("back")))
        elif k == "read_back_equals_input" and o.get("back") != c["input"]: bad.append("read back %r" % o.get("back"))
        elif k == "read_html_equals_input" and SOFFICE and o.get("read_html") != c["input"]: bad.append("read %r" % o.get("read_html"))
        elif k == "read_html_contains" and v not in (o.get("read_html") or ""): bad.append("read lacks %r: %s" % (v, (o.get("read_html") or "")[:300]))
        elif k == "read_html_not_contains" and v in (o.get("read_html") or ""): bad.append("read has %r" % v)
        elif k == "word_label_of_item_28_equals_page_label":
            if o.get("lo_text") is None:
                if SOFFICE: bad.append("LibreOffice did not open it")
                continue
            ll = [l.strip().split(" ")[0] for l in o["lo_text"].split("\n") if l.strip().endswith("Part 28")]
            if not ll or ll[0] != label(M or [], "Part 28"): bad.append("Word (LibreOffice) %s, page %s" % (ll, label(M or [], "Part 28")))
        elif k == "no_crash" and o.get("error"): bad.append("crashed")
        elif k in ("doc_headings", "doc_items", "doc_paragraphs", "doc_rows") and o.get("doc") and o["doc"]["parts"][k[4:] if k != "doc_items" else "items"] != v: bad.append("%s %s" % (k, o["doc"]["parts"]))
        elif k == "html_contains" and v not in o["doc"]["html"]: bad.append("lacks %r" % v)
        elif k == "html_contains_any" and not any(x in o["doc"]["html"] for x in v): bad.append("none of %r in %r" % (v, o["doc"]["html"][:300]))
        elif k == "numbered_step_marks_in_order":
            got = [l.split(" ")[0] for l in o["txt"].split("\n") if re.match(r"^\S+\. ", l)]
            if got != v: bad.append("steps %s (%r)" % (got, o["txt"][:400]))
        elif k == "sub_step_marks":
            got = [l.strip().split(" ")[0] for l in o["txt"].split("\n") if re.match(r"^ {4}\S+\. ", l)]
            if got != v: bad.append("sub-steps %s" % got)
        elif k == "bench_pass" and not o["grade"]["pass"]: bad.append("the bench: " + o["grade"]["why"])
        elif k == "first_heading_directly_above_step_1":
            ls = o["reply"].split("\n")
            if not (ls[1].startswith("## ") and ls[2].startswith("1. ")): bad.append("example %r" % ls[:3])
        elif k == "no_digits_except_step_numbers" and any(re.search(r"\d", re.sub(r"^\d+\. ", "", l)) for l in o["reply"].split("\n")): bad.append("a figure in the example")
        elif k == "example_lines_contain_no":
            for pr in o["prompts"]:
                exs = pr[pr.index("For example:"):] if "For example:" in pr else ""
                for x in v:
                    if x in exs: bad.append("an example has %r" % x)
        elif k == "example_count_per_prompt" and any(pr.count("For example:\nMAKE DOC:") != v for pr in o["prompts"]): bad.append("examples per prompt %s" % [pr.count("For example:\nMAKE DOC:") for pr in o["prompts"]])
        elif k == "or_notes_contain" and bad and any(v in n for n in o.get("notes") or []): bad = []
        elif k == "title_not" and o["doc"]["title"] == v: bad.append("the title is %r" % v)
        elif k not in KNOWN: bad.append("an expectation this replay does not know: " + k)
    return bad
# "or", "or_nested", "import_html" say in words what else would do; they are read, not checked
KNOWN = set("""page_markers page_markers_one_of page_markers_27_to_30 page_markers_first_9 page_markers_first_3 page_markers_after_9_all page_markers_contains page_styles
 page_html_contains page_html_not_contains focus_stays_in browser_markers lo_text_contains lo_text_equals_original txt_equals txt_contains txt_not_contains
 txt_label_of_item_28_equals_page_label pdf_text_contains pdf_text_not_contains pdf_label_of_item_28_equals_page_label blocks_first_12_marks blocks drawn valid
 docx_numfmts docx_contains read_back_contains read_back_equals_input read_html_equals_input read_html_contains read_html_not_contains
 word_label_of_item_28_equals_page_label no_crash doc_headings doc_items doc_paragraphs doc_rows html_contains html_contains_any numbered_step_marks_in_order
 sub_step_marks bench_pass first_heading_directly_above_step_1 no_digits_except_step_numbers example_lines_contain_no example_count_per_prompt or_notes_contain
 title_not or or_nested import_html""".split())
fails, passes, kept, later, notes = 0, 0, [], [], []
for c in cases:
    cid, o = c["id"], obs.get(c["id"], {})
    if o.get("not_run"):
        kept.append(cid)
        if VERBOSE: print("KEPT  %s (not run): %s" % (cid, KEEP.get(cid, "")))
        continue
    bad = check(c, o)
    if not bad:
        passes += 1
        if cid in KEEP or cid in LATER: notes.append(cid)
        continue
    if cid in KEEP:
        kept.append(cid)
        if VERBOSE: print("KEPT  %s: %s\n      %s" % (cid, KEEP[cid], "; ".join(bad)[:500]))
        continue
    if cid in LATER:
        later.append(cid)
        if VERBOSE: print("LATER %s: %s\n      %s" % (cid, LATER[cid], "; ".join(bad)[:500]))
        continue
    fails += 1
    print("FAIL  %s (%s): %s" % (cid, c["verdict"], "; ".join(bad)[:900]))
for n in notes: print("NOTE  %s now does what it expects; take it off KEEP or LATER" % n)
if o_errs: print("FAIL  page errors: %s" % o_errs[:3]); fails += 1
shutil.rmtree(tmp, ignore_errors=True)
if skips: print("SKIP  " + ", ".join(sorted(skips)) + " not on this machine")
print(("%d FAILED" % fails) if fails else "ALL LISTS REVIEW CHECKS PASS", "(%d agree, %d kept as they are, %d later)" % (passes, len(kept), len(later)))
sys.exit(1 if fails else 0)
