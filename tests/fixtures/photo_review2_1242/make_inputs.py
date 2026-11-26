# make_inputs.py -- the pictures the review opens, made the way a person would have them:
# a camera-like JPEG with EXIF, a logo with transparency, a scan, a screenshot, a 1x1, very wide/tall strips,
# a tilted horizon, a slanted document, three shots with a "walker" for Stack Median, a red-eye face, a layered PSD.
# Run: python3 make_inputs.py [outdir]   (default: ./inputs next to this file)
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "inputs")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1242)
def save(im, name, **kw): im.save(os.path.join(OUT, name), **kw)
# 1. a "photo": sky gradient, hills, a tree, noise, EXIF (Make/Model/DateTime/orientation 1)
W, H = 640, 480
y = np.linspace(0, 1, H)[:, None]
sky = np.dstack([90 + 80 * y, 150 + 60 * y, 230 - 20 * y]) * np.ones((1, W, 1))
im = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8))
dr = ImageDraw.Draw(im)
dr.polygon([(0, 330), (160, 260), (330, 320), (500, 250), (640, 300), (640, 480), (0, 480)], fill=(70, 120, 50))
dr.rectangle([300, 250, 315, 330], fill=(90, 60, 30)); dr.ellipse([260, 180, 355, 270], fill=(40, 100, 40))
dr.line([(0, 120), (640, 160)], fill=(30, 30, 30), width=2)      # a wire across the sky
arr = np.array(im).astype(int) + rng.integers(-6, 7, (H, W, 3))
im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
ex = Image.Exif(); ex[0x010F] = "ReviewCam"; ex[0x0110] = "RC-1"; ex[0x0132] = "2026:11:26 10:00:00"; ex[0x0112] = 1
save(im, "photo.jpg", quality=90, exif=ex.tobytes())
# 2. the same photo with EXIF orientation 6 (camera held upright): stored landscape, shown portrait
save(im, "photo_orient6.jpg", quality=90, exif=(lambda e: (e.__setitem__(0x0112, 6), e)[1])(Image.Exif()).tobytes())
# 3. a logo with transparency (soft edges)
lg = Image.new("RGBA", (300, 200), (0, 0, 0, 0)); d2 = ImageDraw.Draw(lg)
d2.ellipse([20, 20, 180, 180], fill=(220, 30, 30, 255)); d2.rectangle([150, 70, 280, 130], fill=(20, 60, 200, 160))
lg = lg.filter(ImageFilter.GaussianBlur(1.2)); save(lg, "logo.png")
# 4. a grey scan of a page (L mode)
sc = Image.new("L", (500, 700), 235); d3 = ImageDraw.Draw(sc)
for i in range(20): d3.line([(40, 60 + i * 30), (460, 60 + i * 30 + (i % 3))], fill=60, width=2)
for i in range(60): x, yy = rng.integers(0, 500), rng.integers(0, 700); d3.point((int(x), int(yy)), fill=0)
save(sc, "scan_gray.png")
# 5. a screenshot: flat colours, hard edges
ss = Image.new("RGB", (800, 500), (245, 245, 245)); d4 = ImageDraw.Draw(ss)
d4.rectangle([0, 0, 800, 40], fill=(30, 58, 138)); d4.rectangle([20, 70, 380, 470], fill=(255, 255, 255), outline=(200, 200, 200))
d4.rectangle([420, 70, 780, 200], fill=(220, 252, 231)); d4.text((30, 12), "Settings", fill=(255, 255, 255))
save(ss, "screenshot.png")
# 6. 1x1, very wide, very tall
save(Image.new("RGB", (1, 1), (12, 34, 56)), "one_pixel.png")
save(Image.fromarray(np.tile(np.linspace(0, 255, 6000).astype(np.uint8), (40, 1))), "wide_6000x40.png")
save(Image.fromarray(np.tile(np.linspace(0, 255, 6000).astype(np.uint8)[:, None], (1, 40))), "tall_40x6000.png")
# 7. a tilted horizon (5 degrees): for the Ruler and Straighten
hz = Image.new("RGB", (600, 400), (150, 190, 235)); d5 = ImageDraw.Draw(hz)
import math
a = math.radians(5); cx, cy = 300, 200
pts = [(-400, 0), (1000, 0), (1000, 600), (-400, 600)]
rot = [(cx + (px - cx) * math.cos(a) - (py + 200 - cy) * math.sin(a), cy + (px - cx) * math.sin(a) + (py + 200 - cy) * math.cos(a)) for px, py in pts]
d5.polygon(rot, fill=(40, 90, 150)); save(hz, "horizon_tilt5.png")
# 8. a document photographed at a slant: a white quad on a dark table
dc = Image.new("RGB", (600, 450), (60, 50, 45)); d6 = ImageDraw.Draw(dc)
quad = [(120, 60), (480, 90), (520, 400), (80, 380)]; d6.polygon(quad, fill=(250, 250, 245))
d6.line([(150, 120), (450, 140)], fill=(0, 0, 0), width=3); save(dc, "slanted_doc.png")
# 9. three shots of one scene with a walker in a different place each time
for k in range(3):
    s = Image.new("RGB", (300, 200), (180, 200, 160)); d7 = ImageDraw.Draw(s)
    d7.rectangle([200, 40, 260, 160], fill=(120, 80, 60)); d7.rectangle([30 + 70 * k, 60, 60 + 70 * k, 180], fill=(200, 30, 120))
    save(s, "walker_%d.png" % (k + 1))
# 10. a face with red pupils
fc = Image.new("RGB", (400, 300), (225, 190, 160)); d8 = ImageDraw.Draw(fc)
for ex_ in (130, 270):
    d8.ellipse([ex_ - 40, 110, ex_ + 40, 170], fill=(250, 250, 250)); d8.ellipse([ex_ - 18, 122, ex_ + 18, 158], fill=(70, 110, 60)); d8.ellipse([ex_ - 10, 130, ex_ + 10, 150], fill=(210, 20, 25))
save(fc, "redeye.png")
# 11. a layered PSD made by psd-tools: background, a half-transparent layer, a hidden layer, a multiply layer
try:
    from psd_tools import PSDImage
    from psd_tools.api.layers import PixelLayer
    from psd_tools.constants import BlendMode
    p = PSDImage.new("RGB", (320, 240))
    def lay(name, col, box, op=255):
        li = Image.new("RGBA", (320, 240), (0, 0, 0, 0)); ImageDraw.Draw(li).rectangle(box, fill=col + (op,)); l = PixelLayer.frompil(li, p, name); p.append(l); return l
    lay("Paper", (240, 235, 220), (0, 0, 319, 239))
    lay("Blue box", (30, 60, 200), (40, 40, 160, 160), 128)
    h = lay("Hidden note", (255, 0, 0), (200, 20, 300, 60)); h.visible = False
    m = lay("Shade", (128, 128, 128), (100, 100, 300, 220)); m.blend_mode = BlendMode.MULTIPLY
    p.save(os.path.join(OUT, "layers_psdtools.psd"))
except Exception as e:
    print("psd-tools could not make the layered PSD:", e)
# 12. three small files for a batch
for k, col in enumerate([(200, 50, 50), (50, 200, 50), (50, 50, 200)]):
    b = Image.new("RGB", (160 + 40 * k, 120), col); ImageDraw.Draw(b).ellipse([10, 10, 60, 60], fill=(255, 255, 255)); save(b, "batch_%d.png" % (k + 1))
print("made", sorted(os.listdir(OUT)))
