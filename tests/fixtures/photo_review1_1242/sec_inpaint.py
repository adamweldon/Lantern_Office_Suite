# sec_inpaint.py -- Content-Aware Fill (PatchMatch) and the healing arithmetic on pictures made here: does it fill, stay
# inside the hole, keep the rest exactly, and finish in reasonable time on a 12-megapixel picture with a small and a big hole.
import io, base64, time
import numpy as np
from PIL import Image
from review_core import *

SEC = "inpaint"

def landscape(w, h, seed=0):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sky = np.dstack([110 + 60 * yy / h, 160 + 40 * yy / h, 235 - 20 * yy / h])
    grass = np.dstack([60 + 0 * xx, 130 + 25 * np.sin(xx / 3.0) * np.cos(yy / 5.0), 50 + 0 * xx])
    a = np.where((yy < h * 0.6)[..., None], sky, grass) + rng.normal(0, 5, (h, w, 3)).astype(np.float32)
    return np.clip(a, 0, 255).astype(np.uint8)

def run(pg, B):
    # a pole across sky and grass
    w, h = 400, 300
    ph = landscape(w, h)
    pole = ph.copy(); pole[40:260, 195:205] = [40, 40, 40]
    hole = np.zeros((h, w), np.uint8); hole[36:264, 191:209] = 255
    t0 = time.time()
    r = pg.J("([w, h, b, m]) => { var d = R.id(w, h, b), t = performance.now(), o = Lantern.photo.inpaint.fill(d, new Uint8Array(m), {seed: 3}); return [R.b64(new Uint8Array(o.data.buffer)), performance.now() - t]; }",
             [w, h, base64.b64encode(rgba(pole).tobytes()).decode(), hole.ravel().tolist()])
    o = np.frombuffer(base64.b64decode(r[0]), np.uint8).reshape(h, w, 4)
    B.check(SEC, "content-aware fill 400 x 300, a pole 18 x 228: outside the hole every pixel exactly as it was", np.array_equal(o[hole == 0], rgba(pole)[hole == 0]), int((o[hole == 0] != rgba(pole)[hole == 0]).any(1).sum()), 0)
    inside = o[hole > 0][:, :3].astype(float)
    sky_in = o[36:150, 191:209, :3].reshape(-1, 3).astype(float); grass_in = o[190:264, 191:209, :3].reshape(-1, 3).astype(float)
    sky_ref = ph[36:150, 191:209].reshape(-1, 3).astype(float); grass_ref = ph[190:264, 191:209].reshape(-1, 3).astype(float)
    B.check(SEC, "content-aware fill: the pole is gone (no dark pixels left in the hole)", (inside.max(1) < 70).sum() == 0, int((inside.max(1) < 70).sum()), 0)
    B.check(SEC, "content-aware fill: sky filled with sky, grass with grass (mean colour within 12 of the true scene)", np.abs(sky_in.mean(0) - sky_ref.mean(0)).max() <= 12 and np.abs(grass_in.mean(0) - grass_ref.mean(0)).max() <= 12,
            (sky_in.mean(0).round().tolist(), grass_in.mean(0).round().tolist()), (sky_ref.mean(0).round().tolist(), grass_ref.mean(0).round().tolist()))
    B.info(SEC, "content-aware fill 400 x 300: time in the page", "%.1f s" % (r[1] / 1000))
    # healing arithmetic: a patch from a darker place takes the light round where it goes; the outside untouched
    g = np.tile(np.linspace(80, 200, 120), (90, 1)); tex = np.random.default_rng(1).normal(0, 6, (90, 120))
    dst = rgba(np.dstack([g] * 3).round().astype(np.uint8)); src = rgba(np.clip(np.dstack([g - 50 + tex] * 3), 0, 255).round().astype(np.uint8))
    mk = np.zeros((90, 120), np.uint8); mk[30:60, 40:80] = 255
    r = pg.J("([w, h, a, b, m]) => { var o = Lantern.photo.heal.heal(R.id(w, h, a), R.id(w, h, b), new Uint8Array(m)); return R.b64(new Uint8Array(o.data.buffer)); }",
             [120, 90, base64.b64encode(dst.tobytes()).decode(), base64.b64encode(src.tobytes()).decode(), mk.ravel().tolist()])
    o = np.frombuffer(base64.b64decode(r), np.uint8).reshape(90, 120, 4).astype(float)
    want = np.clip(np.dstack([g + tex] * 3), 0, 255)
    d = np.abs(o[30:60, 40:80, :3] - want[30:60, 40:80])
    B.check(SEC, "healing: a patch 50 levels darker, put on a gradient, takes the gradient's light and keeps its own texture (mean error <= 2)", d.mean() <= 2, "mean %.2f max %.1f" % (d.mean(), d.max()), "<= 2")
    B.check(SEC, "healing: outside the patch unchanged", np.array_equal(o[mk == 0], dst[mk == 0].astype(float)), "", "")
    # 12 megapixels through Edit > Content-Aware Fill (the command crops round the selection)
    for label, (x, y, ww, hh), limit in [("small hole 24 x 24", (2000, 1500, 24, 24), 60), ("big hole 600 x 400", (1700, 1300, 600, 400), 300)]:
        js = """([x, y, ww, hh]) => { var W = 4000, H = 3000, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var g = cv.getContext('2d');
          var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#6fa0e8'); gr.addColorStop(0.6, '#a8c8f0'); gr.addColorStop(0.61, '#3d7a32'); gr.addColorStop(1, '#2c5a22'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
          var id = g.getImageData(0, 0, W, H), a = id.data, s = 7; for (var i = 0; i < a.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; var n = (s % 13) - 6; a[i] += n; a[i + 1] += n; a[i + 2] += n; } g.putImageData(id, 0, 0);
          g.fillStyle = '#222'; g.fillRect(x + 4, y + 4, ww - 8, hh - 8);
          var d = Lantern.photo.doc.fromCanvas(cv, 'big'), O = Lantern.photo.ops; R.docs.big = d;
          O.exec(d, 'selectShape', {shape: 'rect', x: x, y: y, w: ww, h: hh});
          var t = performance.now(); O.exec(d, 'contentAware', {seed: 2}); var ms = performance.now() - t;
          var after = d.layers[0].cv.getContext('2d').getImageData(0, 0, W, H).data, changed = 0, outside = 0, dark = 0;
          for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) { var j = (yy * W + xx) * 4, ins = xx >= x && xx < x + ww && yy >= y && yy < y + hh;
            if (after[j] !== a[j] || after[j + 1] !== a[j + 1] || after[j + 2] !== a[j + 2]) { if (ins) changed++; else outside++; }
            if (ins && xx >= x + 4 && xx < x + ww - 4 && yy >= y + 4 && yy < y + hh - 4 && after[j] < 40 && after[j + 1] < 40 && after[j + 2] < 40) dark++; }
          return [ms, changed, outside, dark]; }"""
        t0 = time.time()
        try:
            r = pg.J(js, [x, y, ww, hh])
            B.check(SEC, "content-aware fill on 4000 x 3000, %s: finishes within %d s" % (label, limit), r[0] / 1000 <= limit, "%.1f s" % (r[0] / 1000), "<= %d s" % limit)
            B.check(SEC, "content-aware fill on 4000 x 3000, %s: nothing outside the selection changed" % label, r[2] == 0, r[2], 0)
            B.check(SEC, "content-aware fill on 4000 x 3000, %s: the dark block is gone" % label, r[3] == 0, "%d dark pixels left" % r[3], 0)
        except Exception as e:
            B.check(SEC, "content-aware fill on 4000 x 3000, %s: finishes" % label, False, "%s after %.0f s" % (str(e).split("\n")[0][:150], time.time() - t0), "finishes")
