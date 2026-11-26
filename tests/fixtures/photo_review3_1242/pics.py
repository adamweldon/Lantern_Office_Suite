# pics.py -- small deterministic test pictures (numpy, no Lantern), shared by the sections.
import numpy as np


def grad(w, h, alpha=255, seed=0):
    """A picture with many colours: red across, green down, blue a mix; alpha constant or an array."""
    y, x = np.mgrid[0:h, 0:w]
    r = (x * 255 // max(1, w - 1))
    g = (y * 255 // max(1, h - 1))
    b = ((x * 37 + y * 91 + seed * 53) % 256)
    a = np.full((h, w), alpha) if np.isscalar(alpha) else alpha
    return np.dstack([r, g, b, a]).astype(np.uint8)


def solid(w, h, rgba):
    a = np.zeros((h, w, 4), np.uint8); a[:] = rgba; return a


def patch(w, h, x0, y0, x1, y1, rgba, base=None):
    a = np.zeros((h, w, 4), np.uint8) if base is None else base.copy()
    a[y0:y1, x0:x1] = rgba
    return a


def soft_disc(w, h, cx, cy, r, rgb, edge=3.0):
    """A disc whose edge fades over `edge` pixels (alpha from 255 inside to 0 outside)."""
    y, x = np.mgrid[0:h, 0:w]
    d = np.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
    a = np.clip((r - d) / edge + 0.5, 0, 1) * 255
    out = np.zeros((h, w, 4), np.uint8)
    out[..., 0] = rgb[0]; out[..., 1] = rgb[1]; out[..., 2] = rgb[2]; out[..., 3] = np.round(a)
    out[out[..., 3] == 0, :3] = 0
    return out


def colours_grid():
    """Every combination of a few channel values: a picture of 8*8*8 = 512 colours, 32 x 16."""
    v = [0, 1, 37, 100, 128, 155, 254, 255]
    cols = [(r, g, b) for r in v for g in v for b in v]
    a = np.zeros((16, 32, 4), np.uint8)
    for i, c in enumerate(cols):
        a[i // 32, i % 32] = (c[0], c[1], c[2], 255)
    return a


def srgb_to_lab(rgb):
    """CIE L*a*b* (D65) of sRGB values 0-255, by the published formulas (IEC 61966-2-1 and CIE 15)."""
    c = rgb.astype(float) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ M.T
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    e, k = 216 / 24389, 24389 / 27
    f = np.where(xyz > e, np.cbrt(xyz), (k * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    A = 500 * (f[..., 0] - f[..., 1])
    B = 200 * (f[..., 1] - f[..., 2])
    return np.dstack([L, A, B]) if rgb.ndim == 3 else np.stack([L, A, B], -1)
