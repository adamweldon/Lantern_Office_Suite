# check_fit.py -- does the text Lantern saved fit its box at the size it stored (normAutofit fontScale), as PowerPoint
# draws it without editing? Lays each body and title out again with Georgia's widths (Gelasio, the font made to Georgia's
# metrics, where it is installed; else a measured average) and word wrap, at the master's sizes (title 40 pt; levels 24,
# 20, 18, 16 pt), the master's margins and space before, line height 1.2, the box's insets.
#   python3 check_fit.py <deck.pptx>  -> JSON [{slide, box, scale, need, avail}] in points
import json, re, sys, zipfile, glob
FONT = None
try:
    from PIL import ImageFont
    fs = glob.glob("/usr/share/fonts/**/Gelasio*.ttf", recursive=True)
    fs = [f for f in fs if "Italic" not in f]
    if fs: FONT = ImageFont.truetype(fs[0], 1000)
except Exception:
    FONT = None
def width(t, size, bold=False):
    if FONT: return FONT.getlength(t) / 1000.0 * size * (1.05 if bold else 1)
    return len(t) * 0.45 * size
z = zipfile.ZipFile(sys.argv[1])
out = []
SZ = [24, 20, 18, 16, 16, 16, 16, 16, 16]
n = 1
while "ppt/slides/slide%d.xml" % n in z.namelist():
    x = z.read("ppt/slides/slide%d.xml" % n).decode("utf-8")
    for sp in re.findall(r"<p:sp>.*?</p:sp>", x, re.S):
        title = 'type="title"' in sp
        if not title and 'idx="1"' not in sp: continue
        m = re.search(r'<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)" cy="(\d+)"/>', sp)
        box = [int(v) for v in m.groups()] if m else ([838200, 365125, 10515600, 1325563] if title else [838200, 1825625, 10515600, 4351338])
        fsc = re.search(r'fontScale="(\d+)"', sp)
        sc = int(fsc.group(1)) / 100000.0 if fsc else 1.0
        need = 0.0
        for i, p in enumerate(re.findall(r"<a:p>(.*?)</a:p>", sp, re.S)):
            lv = re.search(r'lvl="(\d)"', p); lv = int(lv.group(1)) if lv else 0
            ml = re.search(r'marL="(\d+)"', p)
            marL = 0 if title else (int(ml.group(1)) if ml else 228600 + 457200 * lv)
            size = (40 if title else SZ[lv]) * sc
            usable = (box[2] - 182880 - marL) / 12700.0
            text = "".join(re.findall(r"<a:t>([^<]*)</a:t>", p)).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
            brs = p.count("<a:br")
            words = text.split(" "); lines = 1; cur = 0.0; sp_w = width(" ", size)
            for w in words:
                ww = width(w, size)
                if cur and cur + sp_w + ww > usable: lines += 1; cur = ww
                else: cur = cur + (sp_w if cur else 0) + ww
            lines += brs
            need += lines * size * (0.9 if title else 1.0) * 1.2 + (0 if (title or i == 0) else (5 if lv else 10) * sc)
        out.append({"slide": n, "title": title, "scale": sc, "need": round(need, 1), "avail": round((box[3] - 91440) / 12700.0, 1)})
    n += 1
print(json.dumps({"font": "Gelasio" if FONT else "average", "boxes": out}))
