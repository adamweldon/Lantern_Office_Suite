# browser.py -- the second review's real-browser half (1.24.33): Lantern's page (the src given, served as index.html from
# a folder of its own) in Chromium through Playwright, and
#   emf    every EMF in emf/ drawn by Lantern.emf.draw: its probes (probes.json) read on the drawing, and LibreOffice's
#          own EMFs (lo_*.emf) compared with the SVG drawing each was made from, drawn by the same browser;
#   open   decks opened through Slides' Open .pptx with the browser's file chooser: the deck stored, its pictures, the
#          dialog; and what is left on the page after the file chooser is closed with no file.
# Usage: python3 browser.py <src> <out.json> [shots folder]
# Prints nothing but errors; writes {"emf": {...}, "open": {...}, "errors": [...]} to out.json.
import base64, json, os, shutil, socket, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
SRC, OUTJ = sys.argv[1], sys.argv[2]
SHOTS = sys.argv[3] if len(sys.argv) > 3 else None
site = tempfile.mkdtemp(prefix="lantern_r2_")
shutil.copy(SRC, os.path.join(site, "index.html"))
s = socket.socket(); s.bind(("127.0.0.1", 0)); PORT = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
res = {"emf": {}, "open": {}, "errors": []}
PROBE_JS = r"""
async ([b64, probes, svg, max]) => {
  function bytes(s) { var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function load(url) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = url; }); }
  var d = null, err = null;
  try { d = window.Lantern.emf.draw(bytes(b64), max || 800); } catch (e) { err = String(e && e.message || e); }
  if (!d) return { drawn: false, err: err };
  var im = await load(d.url), c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  var x = c.getContext("2d"); x.drawImage(im, 0, 0);
  var W = c.width, H = c.height, data = x.getImageData(0, 0, W, H).data;
  function px(fx, fy) { var X = Math.min(W - 1, Math.max(0, Math.round(fx * (W - 1)))), Y = Math.min(H - 1, Math.max(0, Math.round(fy * (H - 1)))), r = 0, g = 0, b = 0, n = 0;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = Math.min(W - 1, Math.max(0, X + dx)), yy = Math.min(H - 1, Math.max(0, Y + dy)), o = (yy * W + xx) * 4; r += data[o]; g += data[o + 1]; b += data[o + 2]; n++; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]; }
  function near(a, b, t) { return Math.abs(a[0] - b[0]) <= t && Math.abs(a[1] - b[1]) <= t && Math.abs(a[2] - b[2]) <= t; }
  function region(q, f) { var x0 = Math.round(q[0] * W), y0 = Math.round(q[1] * H), x1 = Math.round(q[2] * W), y1 = Math.round(q[3] * H);
    for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { var o = (yy * W + xx) * 4; f(xx, yy, [data[o], data[o + 1], data[o + 2]]); } }
  var bad = [];
  (probes || []).forEach(function (p) {
    if (p.at) { var got = px(p.at[0], p.at[1]); if (!near(got, p.rgb, 60)) bad.push("at " + p.at.join(",") + " " + got.join(",") + " (wanted " + p.rgb.join(",") + ")"); }
    else if (p.ink || p.noink) { var n = 0; region(p.ink || p.noink, function (xx, yy, c) { if (near(c, p.rgb, 80)) n++; }); if (p.ink && n < 15) bad.push("no ink of " + p.rgb.join(",") + " in " + p.ink.join(",")); if (p.noink && n >= 15) bad.push(n + " pixels of " + p.rgb.join(",") + " in " + p.noink.join(",") + ", where there should be none"); }
    else if (p.light) { var s = 0, k = 0; region(p.light, function (xx, yy, c) { s += (c[0] + c[1] + c[2]) / 3; k++; }); if (s / k < 170) bad.push("the area " + p.light.join(",") + " is dark (mean " + Math.round(s / k) + "), where it should be mostly white"); }
    else if (p.dashes) { var y = Math.round(p.dashes[1] * (H - 1)), t = 0, last = null; for (var xx = Math.round(p.dashes[0] * W); xx < Math.round(p.dashes[2] * W); xx++) { var o = (y * W + xx) * 4, v = (data[o] + data[o + 1] + data[o + 2]) / 3, st = v < 90 ? 1 : v > 180 ? 0 : last; if (last !== null && st !== last) t++; last = st; } if (t < 6) bad.push("the line is not dashed (" + t + " changes along it)"); }
    else if (p.tallInk) { var a = [1e9, 1e9, -1, -1]; region(p.tallInk, function (xx, yy, c) { if (c[0] + c[1] + c[2] < 300) { a[0] = Math.min(a[0], xx); a[1] = Math.min(a[1], yy); a[2] = Math.max(a[2], xx); a[3] = Math.max(a[3], yy); } }); if (a[2] < 0) bad.push("no text drawn"); else if ((a[3] - a[1]) < 1.5 * (a[2] - a[0])) bad.push("the text runs across (" + (a[2] - a[0]) + " by " + (a[3] - a[1]) + "), not up"); }
  });
  var cmp = null;
  if (svg) {
    var sv = await load("data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg))));
    var c2 = document.createElement("canvas"); c2.width = W; c2.height = H; var x2 = c2.getContext("2d"); x2.fillStyle = "#fff"; x2.fillRect(0, 0, W, H); x2.drawImage(sv, 0, 0, W, H);
    var sd = x2.getImageData(0, 0, W, H).data, tried = 0, off = [];
    for (var gy = 1; gy < 12; gy++) for (var gx = 1; gx < 16; gx++) {
      var X = Math.round(gx / 16 * W), Y = Math.round(gy / 12 * H), base = null, uni = true;
      for (var dy = -3; dy <= 3 && uni; dy++) for (var dx = -3; dx <= 3; dx++) { var o = ((Y + dy) * W + X + dx) * 4, c3 = [sd[o], sd[o + 1], sd[o + 2]]; if (!base) base = c3; else if (!near(base, c3, 12)) { uni = false; break; } }
      if (!uni) continue;
      tried++;
      var got2 = px(X / (W - 1), Y / (H - 1));
      if (!near(got2, base, 60)) off.push([gx, gy, got2, base]);
    }
    cmp = { tried: tried, off: off.length, first: off.slice(0, 4) };
  }
  return { drawn: true, w: W, h: H, left: d.left, bad: bad, cmp: cmp, url: d.url.length < 400000 ? d.url : null };
}
"""
try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={"width": 1280, "height": 800}, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: res["errors"].append(str(e)[:300]))
        pg.on("dialog", lambda d: (res["errors"].append("alert: " + d.message[:300]), d.dismiss()))
        for i in range(40):
            try: pg.goto("http://127.0.0.1:%d/index.html#home" % PORT); break
            except Exception: time.sleep(0.25)
        pg.wait_for_timeout(1200)
        res["version"] = pg.evaluate("() => window.Lantern && window.Lantern.version")
        # ---- EMF ----
        probes = json.load(open(os.path.join(HERE, "emf", "probes.json")))
        names = sorted(f[:-4] for f in os.listdir(os.path.join(HERE, "emf")) if f.endswith(".emf"))
        for n in names:
            b64 = base64.b64encode(open(os.path.join(HERE, "emf", n + ".emf"), "rb").read()).decode()
            svgp = os.path.join(HERE, "emf", n + ".svg")
            svg = open(svgp).read() if os.path.exists(svgp) else None
            r = pg.evaluate(PROBE_JS, [b64, (probes.get(n) or {}).get("probes", []), svg, 800])
            if SHOTS and r.get("url"):
                os.makedirs(SHOTS, exist_ok=True)
                open(os.path.join(SHOTS, n + ".png"), "wb").write(base64.b64decode(r["url"].split(",", 1)[1]))
            r.pop("url", None)
            res["emf"][n] = r
        # ---- Open .pptx in Slides ----
        def to_library():
            pg.evaluate("() => { var o = document.querySelectorAll('.guide-overlay'); o.forEach(function (e) { e.parentNode.removeChild(e); }); location.hash = 'home'; }"); pg.wait_for_timeout(250)
            pg.evaluate("() => { location.hash = 'slides'; }"); pg.wait_for_timeout(700)
        def open_deck(path, title):
            to_library()
            with pg.expect_file_chooser() as fc:
                pg.locator("button", has_text="Open .pptx").first.click()
            fc.value.set_files(path)
            pg.wait_for_timeout(2500)
            return pg.evaluate("""(title) => new Promise(function (res) {
              var dl = document.querySelector('.guide-overlay[aria-label="PowerPoint file"]'), said = dl ? Array.prototype.map.call(dl.querySelectorAll('li'), function (l) { return l.textContent; }) : null;
              var ds = window.Lantern.store.collection('slides.docs').all().filter(function (d) { return d.title === title; });
              var d = ds[0];
              if (!d) return res({ deck: null, said: said });
              var out = { title: d.title, n: d.slides.length, said: said, head: dl ? dl.querySelector('p').textContent : null, slides: [] }, left = d.slides.length;
              if (!left) return res(out);
              d.slides.forEach(function (s, i) {
                var o = out.slides[i] = { h: s.h, body: s.body, notes: s.notes || '', img: s.img ? s.img.slice(0, 23) : '' };
                if (!s.img) { if (--left === 0) res(out); return; }
                var im = new Image();
                im.onload = function () { var c = document.createElement('canvas'); c.width = im.width; c.height = im.height; var x = c.getContext('2d'); x.drawImage(im, 0, 0);
                  o.w = im.width; o.hgt = im.height; o.grid = [];
                  for (var gy = 0; gy < 4; gy++) for (var gx = 0; gx < 6; gx++) { var p = x.getImageData(Math.round((gx + 0.5) / 6 * im.width), Math.round((gy + 0.5) / 4 * im.height), 1, 1).data; o.grid.push([p[0], p[1], p[2]]); }
                  if (--left === 0) res(out); };
                im.onerror = function () { o.broken = true; if (--left === 0) res(out); };
                im.src = s.img;
              });
            })""", title)
        # newest deck first: the store lists decks most recent first (checked below by title)
        for f, t in [("r06_pictures.pptx", "r06_pictures"), ("r01_toolbox.pptx", "Safe lifting"), ("r02_boxes.pptx", "r02_boxes"), ("w04_broken_slide.pptx", "Safe lifting"), ("r03_tables_charts.pptx", "r03_tables_charts"), ("r17_emf.pptx", "r17_emf"), ("r18_hostile.pptx", "r18_hostile")]:
            try:
                before = len(res["errors"])
                r = open_deck(os.path.join(HERE, "decks", f), t)
                pg.evaluate("() => { var o = document.querySelectorAll('.guide-overlay'); o.forEach(function (e) { e.parentNode.removeChild(e); }); }")
                for k in range(min(3, r.get("n") or 0)):
                    try: pg.locator(".sb, [class*=side] *", has_text=(r["slides"][k]["h"] or "")[:12]).first.click(timeout=1500); pg.wait_for_timeout(300)
                    except Exception: pass
                r["alerts"] = [e for e in res["errors"][before:] if e.startswith("alert: ")]
                res["open"][f] = r
                if SHOTS: pg.screenshot(path=os.path.join(SHOTS, "open_" + f + ".png"))
            except Exception as e:
                res["open"][f] = {"error": str(e)[:300]}
        # a wrong file through the same button: what the person is told
        for f in ["w14_old_ppt.pptx", "w17_locked.pptx", "w08_broken_content_types.pptx"]:
            got = []
            h = lambda d: got.append(d.message)
            pg.on("dialog", h)
            try:
                to_library()
                with pg.expect_file_chooser() as fc:
                    pg.locator("button", has_text="Open .pptx").first.click()
                fc.value.set_files(os.path.join(HERE, "decks", f)); pg.wait_for_timeout(1200)
            except Exception as e:
                got.append("error: " + str(e)[:200])
            pg.remove_listener("dialog", h)
            res["open"]["alert:" + f] = got
        res["errors"] = [e for e in res["errors"] if not e.startswith("alert: ")]
        # the file chooser closed with no file: is anything left showing on the page?
        to_library()
        pg.evaluate("() => { document.querySelectorAll('input[type=file]').forEach(function (e) { e.parentNode.removeChild(e); }); }")
        # (the chooser is caught and never answered: as a person who closes it, no change event comes)
        with pg.expect_file_chooser() as fc:
            pg.locator("button", has_text="Open .pptx").first.click()
        pg.wait_for_timeout(2500)
        res["open"]["cancelled"] = pg.evaluate("() => Array.prototype.map.call(document.querySelectorAll('input[type=file]'), function (e) { var r = e.getBoundingClientRect(), st = getComputedStyle(e); return { shown: st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0, w: r.width, h: r.height, accept: (e.accept || '').slice(0, 20) }; })")
        br.close()
except Exception as e:
    res["errors"].append("the run stopped: " + str(e)[:300])
finally:
    srv.terminate()
    shutil.rmtree(site, ignore_errors=True)
    json.dump(res, open(OUTJ, "w"), indent=1)
