# text_reader_e2e.py -- Text Reader in a real browser (Chromium via Playwright):
# reads the fixture pages and checks the error rate per page, reads the PDF
# fixtures (fax G4 in object streams; a page with its own words), makes a
# searchable PDF and reads it back with pdftotext when that is installed, and
# reads the sheet music fixture note for note.
# Usage: python3 tests/browser/text_reader_e2e.py   (needs: pip install playwright;
#        playwright install chromium -- or a Chromium already set up for it)
import json, os, re, sys, subprocess, threading, time, base64, functools, http.server, socketserver, shutil
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FX = os.path.join(ROOT, "tests", "fixtures", "text_reader")
TRUTH = json.load(open(os.path.join(FX, "pages", "truth.json")))
LIMIT = {"LiberationSans_scan300.png": 0.5, "FreeSerif_scan300.png": 2.0, "shot_Arial_13.png": 3.0, "plate1.jpg": 2.0, "photo_arial.jpg": 2.0, "italic_arial.png": 3.0,
         # 1.12.1: screenshots turned upside down and 2.5 degrees (were 6.9% and 7.9% in 1.12.0)
         "shot_upside_down_skewed.png": 2.0, "shot_serif_upside_down_skewed.png": 2.5}

def norm(t):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("—", "-"), ("–", "-")): t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip()
def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]
def cer(h, r): h, r = norm(h), norm(r); return lev(h, r) / max(1, len(r))

# serve the built site and the fixtures from one place
SITE = os.path.join(ROOT, "site", "index.html")
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0]
        if p in ("/", "/index.html"): return SITE
        return os.path.join(FX, p.lstrip("/"))
srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = 0
def check(name, cond, info=""):
    global fails
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:300]))
    if not cond: fails += 1
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto("http://127.0.0.1:%d/index.html" % port)
    pg.wait_for_function("!!(window.Lantern && Lantern.textReader && Lantern.textReader.read && Lantern.pdf && Lantern.sheetMusic)", timeout=30000)
    for f, truth in TRUTH["text"].items():
        r = pg.evaluate("""async function (f) { var pgx = await Lantern.textReader.read(await (await fetch('pages/' + f)).blob()); return {text: pgx.text, conf: pgx.conf, ms: pgx.ms}; }""", f)
        c = cer(r["text"], truth)
        check("%-28s %5.2f%% errors (limit %.1f%%), %d ms" % (f, 100 * c, LIMIT[f], r["ms"]), 100 * c <= LIMIT[f], r["text"][:200])
    r = pg.evaluate("""async function () {
      var pdf = await Lantern.pdf.open(await (await fetch('g4_objstm.pdf')).blob()), cv = await Lantern.pdf.pageImage(pdf, 0), rd = await Lantern.textReader.read(cv);
      var own = await Lantern.pdf.open(await (await fetch('own_text.pdf')).blob()), tx = await Lantern.pdf.pageText(own, 0);
      var blob = await Lantern.pdf.searchable([{canvas: cv, read: rd, pt: {w: pdf.pages[0].w, h: pdf.pages[0].h}}], {title: 'test'});
      var ab = new Uint8Array(await blob.arrayBuffer()), s = '';
      for (var k = 0; k < ab.length; k += 8192) s += String.fromCharCode.apply(null, ab.subarray(k, k + 8192));
      return {w: cv.width, h: cv.height, text: rd.text, own: tx.text, pdf: btoa(s)};
    }""")
    check("fax G4 PDF page read", r["w"] == 700 and r["h"] == 200 and "careful" in r["text"] and "value." in r["text"], r)
    check("PDF page with its own words", "Torque the bolts to 45 Nm (33 ft-lb)" in r["own"], r["own"])
    out = os.path.join(FX, "..", "..", "..", "searchable_test.pdf")
    open(out, "wb").write(base64.b64decode(r["pdf"]))
    if shutil.which("pdftotext"):
        back = subprocess.run(["pdftotext", out, "-"], capture_output=True, text=True).stdout
        check("searchable PDF: its hidden words read back", cer(back, r["text"]) < 0.02, back[:200])
    os.remove(out)
    # 1.22.6: pages made on a computer, with no picture -- drawn as they look (PDF_DRAW): each font kind a PDF carries, read back
    # by Text Reader as the PDF's own words (make_pdfs.py)
    LINES = {"fonts_tt_t1.pdf": ["TrueType: quick brown foxes 0123", "Type 1: jumps over the lazy dog", "Standard Helvetica, not embedded"],
             "fonts_cff.pdf": ["CFF Type 1C: waltz, bad nymph, for quick jigs vex 0123"],
             "fonts_web.pdf": ["Type 3 letters: waltz, bad nymph", "Type 3 again: for quick jigs vex", "CID TrueType: sphinx of black quartz"]}
    for f, kinds, lim in (("fonts_tt_t1.pdf", "TrueType, Type 1 and a standard font not embedded", 8.0), ("fonts_cff.pdf", "CFF (Type 1C)", 8.0), ("fonts_web.pdf", "Type 3 and CID-keyed TrueType", 8.0)):
        r = pg.evaluate("""async function (f) {
          var pdf = await Lantern.pdf.open(await (await fetch(f)).blob()), pi = await Lantern.pdf.pageImage(pdf, 0), t0 = performance.now(), cv = await Lantern.pdf.pageDraw(pdf, 0, { scale: 2.5 }), ms = performance.now() - t0;
          var rd = await Lantern.textReader.read(cv), own = await Lantern.pdf.pageText(pdf, 0), x = cv.getContext('2d'), d = x.getImageData(0, 0, cv.width, cv.height).data, ink = 0;
          for (var i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 384) ink++;
          return { picture: !!pi, text: rd.text, own: own.text, ms: Math.round(ms), ink: ink / (cv.width * cv.height), w: cv.width }; }""", f)
        got = [l for l in r["text"].split("\n") if l.strip()]
        c = max(min(cer(g, want) for g in got) if got else 1 for want in LINES[f])   # each line, against the line read nearest it
        check("%s, drawn as it looks (%s; no picture in it): its worst line %.2f%% misread (limit %.1f%%), drawn in %d ms" % (f, kinds, 100 * c, lim, r["ms"]),
              not r["picture"] and 100 * c <= lim and r["ink"] > 0.005, [r["text"][:200], r["own"][:200]])
    m = pg.evaluate("""async function () { var cv = await Lantern.textReader.image.load(await (await fetch('pages/piano.png')).blob()); var res = Lantern.sheetMusic.read(cv, {});
      return {staves: res.staves, mode: res.mode, names: [].concat.apply([], res.chords.map(function (c) { return c.notes.map(function (n) { return n.name; }); }))}; }""")
    want = TRUTH["music"]["piano.png"]
    check("sheet music: %d staves (%s), %d of %d notes in order" % (m["staves"], m["mode"], len(m["names"]), len(want)), m["names"] == want, " ".join(m["names"][:30]))
    check("no page errors", not errs, errs)
    b.close()
srv.shutdown()
print("ALL TEXT READER BROWSER TESTS PASS" if not fails else "%d TEXT READER BROWSER TEST(S) FAILED" % fails)
sys.exit(1 if fails else 0)
