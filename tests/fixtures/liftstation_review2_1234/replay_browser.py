#!/usr/bin/env python3
"""replay_browser.py -- the second review's station results and circuits drawn in Chromium (Playwright).

Serves site/ (the built page: run `python3 tools/build_site.py` first if src changed) on a port of its own, opens
index.html, builds each input of render_inputs.js with Lantern.aiAct.build, puts Lantern.aiAct.view(result) on the page
(what Chat shows) and saves a screenshot of it, plus each station drawing's own canvas. Prints the files written.
How a drawing looks to a person is Adam's to judge; this only makes the pictures to look at.
Usage: python3 tests/fixtures/liftstation_review2_1234/replay_browser.py <out dir> [port]
"""
import functools, json, os, subprocess, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SITE = os.path.join(ROOT, "site")
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "png")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8347
os.makedirs(OUT, exist_ok=True)
INPUTS = json.loads(subprocess.check_output(["node", os.path.join(HERE, "render_inputs.js")]))


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=SITE))
threading.Thread(target=srv.serve_forever, daemon=True).start()

JS = r"""
([text, q, id]) => {
  const m = Lantern.aiAct.build(text, q);
  const box = Lantern.aiAct.view(m);
  box.id = "shot-" + id;
  box.style.width = "1100px";
  document.body.appendChild(box);
  const out = { ok: !!m.ok, readAs: m.readAs || "", problems: m.problems || [], summary: m.summary || "", canvases: [] };
  // each drawing of a station, at its own size
  if (m.views) Object.keys(m.views).forEach(v => { try { const c = m.views[v].preview && m.views[v].preview(); if (c && c.toDataURL) out.canvases.push([v, c.toDataURL("image/png")]); else if (c && c.querySelector && c.querySelector("canvas")) out.canvases.push([v, c.querySelector("canvas").toDataURL("image/png")]); } catch (e) { } });
  else if (m.preview) { try { const c = m.preview(); const cv = c && (c.toDataURL ? c : c.querySelector && c.querySelector("canvas")); if (cv) out.canvases.push(["drawing", cv.toDataURL("image/png")]); } catch (e) { } }
  return out;
}
"""

import base64
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 900})
    pg.goto("http://127.0.0.1:%d/index.html" % PORT)
    pg.wait_for_function("window.Lantern && window.Lantern.aiAct && window.Lantern.aiStation", timeout=60000)
    for it in INPUTS:
        r = pg.evaluate(JS, [it["text"], it["q"], it["id"]])
        el = pg.query_selector("#shot-" + it["id"])
        f = os.path.join(OUT, it["id"] + ".png")
        el.screenshot(path=f)
        print("%s ok=%s readAs=%s -> %s" % (it["id"], r["ok"], r["readAs"], f))
        for v, url in r["canvases"]:
            g = os.path.join(OUT, it["id"] + "-" + v + ".png")
            with open(g, "wb") as fh:
                fh.write(base64.b64decode(url.split(",", 1)[1]))
            print("   " + g)
        pg.evaluate("id => { const e = document.getElementById('shot-' + id); if (e) e.remove(); }", it["id"])
    b.close()
srv.shutdown()
