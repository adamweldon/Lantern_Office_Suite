# make_inputs.py -- makes the small pictures run_review.py opens (inputs/). The 12-megapixel photo is made at run time.
# python3 make_inputs.py   (deterministic: the same files each time)
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "inputs")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1242)


def scene(w=640, h=480):
    """a landscape: a blue sky that lightens to the horizon, green ground, a yellow sun, a red house, a dark tree"""
    a = np.zeros((h, w, 3), np.float32)
    y = np.arange(h)[:, None]
    sky = np.stack([60 + 80 * y / 300, 120 + 70 * y / 300, 230 - 10 * y / 300], -1) * np.ones((1, w, 1))
    a[:] = sky
    a[300:] = [70, 140, 60]
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    g = ImageDraw.Draw(im)
    g.ellipse((480, 40, 560, 120), fill=(250, 220, 60))
    g.rectangle((120, 220, 260, 330), fill=(190, 40, 40))
    g.polygon([(110, 220), (190, 160), (270, 220)], fill=(120, 60, 30))
    g.rectangle((170, 270, 200, 330), fill=(60, 40, 20))
    g.ellipse((380, 200, 460, 300), fill=(30, 80, 30))
    g.rectangle((415, 290, 425, 340), fill=(80, 50, 20))
    return im


def busy_object():
    """a dark-red blob (known shape) on a busy background of stripes and noise: for the Magnetic Lasso"""
    w, h = 640, 480
    y, x = np.mgrid[0:h, 0:w]
    bg = 150 + 40 * np.sin(x / 7.0) * np.cos(y / 11.0) + rng.normal(0, 18, (h, w))
    stripes = ((x // 23 + y // 31) % 2) * 30
    base = np.clip(bg + stripes, 0, 255)
    a = np.stack([base * 0.9 + 20, base * 0.95 + 10, base * 0.8 + 30], -1)
    cx, cy = 320, 240
    r = 120 + 25 * np.sin(3 * np.arctan2(y - cy, x - cx))   # a rounded three-lobed blob
    inside = np.hypot(x - cx, y - cy) < r
    a[inside] = np.stack([110 + rng.normal(0, 6, inside.sum()), 15 + rng.normal(0, 4, inside.sum()), 20 + rng.normal(0, 4, inside.sum())], -1)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "busy_object.png"))
    Image.fromarray((inside * 255).astype(np.uint8)).save(os.path.join(OUT, "busy_object_mask.png"))


def flat():
    Image.new("RGB", (400, 300), (128, 140, 150)).save(os.path.join(OUT, "flat.png"))


def plain_object():
    """a dark square 200 x 160 at 120,100 on white: an object with clean edges (Magnetic Lasso, the simple case)"""
    im = Image.new("RGB", (480, 360), (245, 245, 245))
    ImageDraw.Draw(im).rectangle((120, 100, 319, 259), fill=(30, 50, 90))
    im.save(os.path.join(OUT, "plain_object.png"))


def horizon():
    """a sea horizon tilted 5 degrees (rises to the right), sky above, sea below, 640 x 400"""
    w, h = 640, 400
    y, x = np.mgrid[0:h, 0:w]
    t = math.radians(5)
    line = 200 - (x - w / 2) * math.tan(t)
    a = np.where((y < line)[..., None], np.array([150, 190, 235]), np.array([20, 60, 110])).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, "horizon_tilt5.png"))


def stamp():
    """a 120 x 80 blue badge with a see-through edge, to drop on a picture"""
    im = Image.new("RGBA", (120, 80), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((4, 4, 115, 75), radius=12, fill=(20, 60, 200, 255))
    im.save(os.path.join(OUT, "stamp.png"))


def big_stamp():
    """a 1600 x 1200 orange picture: bigger than the picture it is dropped on"""
    Image.new("RGB", (1600, 1200), (240, 140, 20)).save(os.path.join(OUT, "big_orange.png"))


def colours():
    """six bars (red, yellow, green, cyan, blue, magenta) and a grey bar: Replace Color, Selective Color, Match Color"""
    w, h = 420, 200
    a = np.zeros((h, w, 3), np.uint8)
    cols = [(220, 30, 30), (230, 220, 30), (30, 200, 40), (30, 210, 220), (30, 40, 220), (210, 30, 210), (128, 128, 128)]
    for i, c in enumerate(cols):
        a[:, i * 60:(i + 1) * 60] = c
    Image.fromarray(a).save(os.path.join(OUT, "colours.png"))


def dark_backlit():
    """a backlit scene: a dark figure (shadows near 25) against a bright sky (near 235): Shadows/Highlights"""
    w, h = 480, 360
    a = np.full((h, w, 3), 235, np.uint8)
    a[:, :, 2] = 245
    y, x = np.mgrid[0:h, 0:w]
    body = (np.hypot(x - 240, y - 230) < 110) | ((abs(x - 240) < 40) & (y > 80) & (y < 200))
    a[body] = [25, 22, 20]
    a[body & ((x + y) % 9 == 0)] = [45, 40, 35]   # some detail in the dark
    Image.fromarray(a).save(os.path.join(OUT, "backlit.png"))


def warm_and_cool():
    """two small pictures: an orange-tinted one and a blue-tinted one (Match Color: take the colours of the other layer)"""
    base = np.array(scene(320, 240)).astype(np.float32)
    warm = np.clip(base * [1.15, 0.95, 0.7] + [30, 10, 0], 0, 255).astype(np.uint8)
    cool = np.clip(base * [0.7, 0.9, 1.15] + [0, 10, 30], 0, 255).astype(np.uint8)
    Image.fromarray(warm).save(os.path.join(OUT, "warm.png"))
    Image.fromarray(cool).save(os.path.join(OUT, "cool.png"))


def cast():
    """the landscape under an orange cast (mean red far above mean blue): Match Color's Neutralize"""
    a = np.array(scene()).astype(float)
    Image.fromarray(np.clip(a * 0.55 + np.array([255, 150, 40]) * 0.45, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "cast.png"))


def coords():
    """640 x 480 where each pixel says where it is: red = x mod 256, green = y mod 256, blue = 64 * (x // 256) + 16 * (y // 256)"""
    y, x = np.mgrid[0:480, 0:640]
    a = np.stack([x % 256, y % 256, 64 * (x // 256) + 16 * (y // 256)], -1).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, "coords.png"))


def psd_with_group():
    """a .psd made by psd-tools (another program): a background, and a group "Things" holding two layers, one hidden"""
    try:
        from psd_tools import PSDImage
    except Exception:
        return
    psd = PSDImage.new("RGB", (200, 150), color=(255, 255, 255))
    bg = Image.new("RGB", (200, 150), (240, 240, 230))
    psd.create_pixel_layer(bg, name="Paper")
    a = Image.new("RGBA", (200, 150), (0, 0, 0, 0)); ImageDraw.Draw(a).rectangle((20, 20, 90, 90), fill=(200, 30, 30, 255))
    b = Image.new("RGBA", (200, 150), (0, 0, 0, 0)); ImageDraw.Draw(b).ellipse((100, 40, 180, 120), fill=(30, 30, 200, 255))
    try:
        la = psd.create_pixel_layer(a, name="Red square")
        lb = psd.create_pixel_layer(b, name="Blue disc")
        lb.visible = False
        psd.create_group([la, lb], name="Things")
    except Exception as e:
        print("no group psd:", e)
        return
    psd.save(os.path.join(OUT, "group_psdtools.psd"))


if __name__ == "__main__":
    scene().save(os.path.join(OUT, "photo.png"))
    scene().convert("RGB").save(os.path.join(OUT, "photo.jpg"), quality=92)
    busy_object(); flat(); plain_object(); horizon(); stamp(); big_stamp(); colours(); dark_backlit(); warm_and_cool(); cast(); coords(); psd_with_group()
    Image.new("RGB", (1, 1), (200, 100, 50)).save(os.path.join(OUT, "one_pixel.png"))
    tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print("inputs:", sorted(os.listdir(OUT)), tot, "bytes")
