# pdf_open_e2e.py -- PDFs as a viewer shows them (1.24.39), in a real browser (Chromium via Playwright): a locked PDF
# drawn; form fields, comments, highlights, stamps and notes drawn and read; layers that are off left out, and turned
# on; bookmarks and links. The PDFs are tests/fixtures/pdf_open (make_fixtures.py says how each was made).
# Usage: python3 tests/browser/pdf_open_e2e.py
import json, os, sys, threading, http.server, socketserver
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FX = os.path.join(ROOT, "tests", "fixtures", "pdf_open"); SITE = os.path.join(ROOT, "site", "index.html")
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0]
        return SITE if p in ("/", "/index.html") else os.path.join(FX, p.lstrip("/"))
srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = 0; n = 0
def check(name, cond, info=""):
    global fails, n
    n += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:400]))
    if not cond: fails += 1
JS = """async (a) => {
  var P = Lantern.pdf, pdf = await P.open(await (await fetch(a.f)).blob(), a.pw ? {password: a.pw} : {});
  if (a.layerOn) pdf.layerOn = a.layerOn;
  var cv = await P.pageDraw(pdf, a.page || 0, {scale: 1}), g = cv.getContext('2d'), s = cv.width / pdf.pages[a.page || 0].w, H = cv.height;
  function region(r) {   // PDF points, origin bottom left -> share of dark pixels, and the mean colour
    var d = g.getImageData(Math.round(r[0]*s), Math.round(H - r[3]*s), Math.max(1, Math.round((r[2]-r[0])*s)), Math.max(1, Math.round((r[3]-r[1])*s))).data, c = 0, n = 0, R = 0, G = 0, B = 0;
    for (var i = 0; i < d.length; i += 4) { n++; R += d[i]; G += d[i+1]; B += d[i+2]; if (d[i] + d[i+1] + d[i+2] < 600) c++; }
    return {ink: Math.round(1000*c/n)/10, rgb: [Math.round(R/n), Math.round(G/n), Math.round(B/n)]};
  }
  var out = {regions: (a.regions || []).map(region), text: (await P.pageText(pdf, a.page || 0)).text, security: pdf.security};
  if (P.layers) out.layers = P.layers(pdf);
  if (P.outline) out.outline = P.outline(pdf);
  if (P.links) out.links = await P.links(pdf, a.page || 0);
  if (P.fields) out.fields = await P.fields(pdf);
  return out;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto("http://127.0.0.1:%d/index.html" % port)
    pg.wait_for_function("!!(window.Lantern && Lantern.pdf && Lantern.pdf.pageDraw && Lantern.pdf.annots && Lantern.pdf.unlock)", timeout=60000)
    def run(f, **k): k["f"] = f; return pg.evaluate(JS, k)
    r = run("owner_aes_256.pdf", regions=[[72, 695, 300, 720]])
    check("a PDF locked only against changes is drawn (its title in ink)", r["regions"][0]["ink"] > 5 and r["security"]["method"] == "AES-256", r)
    r = run("user_aes_256.pdf", pw="lantern", regions=[[72, 695, 300, 720]])
    check("a PDF with a user password is drawn once it is given", r["regions"][0]["ink"] > 5, r)
    # a form filled in with reportlab (fields with their own drawings)
    r = run("form_filled.pdf", regions=[[130, 680, 330, 702], [130, 645, 146, 661]])
    check("a filled form: the typed name is drawn", r["regions"][0]["ink"] > 2, r["regions"])
    check("a filled form: the ticked box is drawn", r["regions"][1]["ink"] > 2, r["regions"])
    check("a filled form: its text has the name beside its label, and the tick", "Name: WELDON" in r["text"] and "Done: [x]" in r["text"], r["text"])
    # fields with no drawing (NeedAppearances): Lantern draws them
    r = run("form_plain.pdf", regions=[[130, 682, 400, 704], [130, 645, 146, 661], [130, 602, 400, 624], [130, 562, 165, 584], [130, 470, 330, 545]])
    ink = [x["ink"] for x in r["regions"]]
    check("fields with no drawing of their own are drawn: name, tick, choice, password dots, notes", all(v > 1 for v in ink), ink)
    check("their text: the name, the tick and the choice's words beside their labels", "Name: ADAM WELDON" in r["text"] and "Done: [x]" in r["text"] and "Shift: Night shift" in r["text"], r["text"])
    check("a password field's value is never read out", "4321" not in r["text"], r["text"])
    check("a note field's words are read", "Replaced the float switch" in r["text"], r["text"])
    check("fields(pdf) lists them, with their values (not the password)", {f["name"]: f["value"] for f in r["fields"]} == {"name": "ADAM WELDON", "done": "Yes", "shift": "Night shift", "pin": "", "notes": "Replaced the float switch. Pump runs on high float and stops on low."}, r["fields"])
    # comments with no drawing (pypdf)
    r = run("annotated.pdf", regions=[[300, 560, 520, 600], [72, 668, 330, 684], [50, 50, 70, 70]])
    check("a typed comment is drawn", r["regions"][0]["ink"] > 2, r["regions"])
    hl = r["regions"][1]["rgb"]
    check("a highlight is drawn yellow over its words", hl[0] > 180 and hl[1] > 180 and hl[2] < 140, hl)
    check("a sticky note's icon is drawn", r["regions"][2]["ink"] > 5 or r["regions"][2]["rgb"][2] < 200, r["regions"])
    check("the typed comment is in the text, and the note under 'Comments on this page'", "CHECK THIS" in r["text"] and "Comments on this page:" in r["text"] and "Note: sticky note" in r["text"], r["text"])
    # layers
    r = run("layers.pdf", regions=[[72, 555, 380, 585], [72, 495, 230, 535], [72, 635, 400, 645]])
    check("layers are listed as the PDF opens: Wiring on, Dimensions off", [(l["name"], l["on"]) for l in r["layers"]] == [("Wiring", True), ("Dimensions", False)], r["layers"])
    check("a layer that is off is not drawn (its box, and a picture in it)", r["regions"][0]["ink"] < 1 and r["regions"][1]["ink"] < 1 and r["regions"][2]["ink"] > 5, r["regions"])
    check("... nor read", "DIMENSIONS" not in r["text"] and "HIDDEN BOX" not in r["text"] and "WIRING" in r["text"], r["text"])
    key_dim = r["layers"][1]["key"]; key_wir = r["layers"][0]["key"]
    r = run("layers.pdf", layerOn={key_dim: True, key_wir: False}, regions=[[72, 555, 380, 585], [72, 495, 230, 535], [72, 635, 400, 645]])
    check("turned on, it is drawn and read; the layer turned off is gone", r["regions"][0]["ink"] > 5 and r["regions"][1]["ink"] > 5 and r["regions"][2]["ink"] < 1 and "DIMENSIONS" in r["text"] and "WIRING" not in r["text"], [r["regions"], r["text"]])
    # bookmarks and links
    r = run("nav.pdf", regions=[[398, 598, 402, 702]])
    o = r["outline"]
    check("bookmarks: titles and pages, by page, by a named destination, nested", [(x["title"], x["page"]) for x in o] == [("Safety first", 0), ("Wiring table", 2)] and [(x["title"], x["page"]) for x in o[1]["kids"]] == [("Spare parts", 1)], o)
    check("links: to a page by name, and to a web address", [l.get("page") for l in r["links"]] == [2, -1] and r["links"][1].get("uri") == "https://example.org/manual", r["links"])
    check("a box comment with no drawing is drawn (its red edge)", r["regions"][0]["rgb"][0] > 150 and r["regions"][0]["rgb"][2] < 150, r["regions"])
    check("... and read, with who wrote it", "Comment (Adam): Check this terminal" in r["text"], r["text"])
    check("no page errors", not errs, errs)
    b.close()
print(("ALL %d PDF VIEW CHECKS PASS" % n) if not fails else "%d of %d FAILED" % (fails, n))
sys.exit(1 if fails else 0)
