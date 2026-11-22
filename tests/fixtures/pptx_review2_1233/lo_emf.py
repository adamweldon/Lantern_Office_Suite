# lo_emf.py -- LibreOffice's own drawing of the review's EMF pictures, judged at the same probes as Lantern's
# (emf/probes.json), so a finding can say whether LibreOffice draws the picture as the records say.
#   python3 lo_emf.py <out.json>   -> {name: [what is off] | "not drawn"} ; {"missing": ...} without LibreOffice or PIL
# LibreOffice opens an EMF in Draw at its own size, in the middle of an A4 page (794 by 1123 px at 96 dpi); the probes
# are read in that frame.
import json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
so = shutil.which("soffice") or shutil.which("libreoffice")
try:
    from PIL import Image
except ImportError:
    Image = None
if not so or Image is None:
    json.dump({"missing": "LibreOffice" if not so else "PIL"}, open(out, "w")); sys.exit(0)
probes = json.load(open(os.path.join(HERE, "emf", "probes.json")))
tmp = tempfile.mkdtemp(prefix="lo_emf_"); env = dict(os.environ, HOME=tmp)
files = [os.path.join(HERE, "emf", n + ".emf") for n in sorted(probes)]
subprocess.run([so, "--headless", "--convert-to", "png", "--outdir", tmp] + files, capture_output=True, timeout=600, env=env)
res = {}
def near(a, b, t): return all(abs(a[i] - b[i]) <= t for i in range(3))
for n, pr in sorted(probes.items()):
    p = os.path.join(tmp, n + ".png")
    if not os.path.exists(p): res[n] = "not drawn"; continue
    im = Image.open(p).convert("RGB"); W, H = im.size; w, h = pr["w"], pr["h"]; x0, y0 = (W - w) / 2.0, (H - h) / 2.0
    def px(fx, fy):
        X, Y = int(round(x0 + fx * (w - 1))), int(round(y0 + fy * (h - 1))); s = [0, 0, 0]
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                c = im.getpixel((min(W - 1, max(0, X + dx)), min(H - 1, max(0, Y + dy))))
                s = [s[i] + c[i] for i in range(3)]
        return [round(v / 9) for v in s]
    def region(q):
        for yy in range(int(y0 + q[1] * h), int(y0 + q[3] * h)):
            for xx in range(int(x0 + q[0] * w), int(x0 + q[2] * w)): yield xx, yy, im.getpixel((xx, yy))
    bad = []
    for q in pr["probes"]:
        if "at" in q:
            g = px(*q["at"])
            if not near(g, q["rgb"], 60): bad.append("at %s %s (wanted %s)" % (q["at"], g, q["rgb"]))
        elif "ink" in q or "noink" in q:
            k = sum(1 for _, _, c in region(q.get("ink") or q.get("noink")) if near(c, q["rgb"], 80))
            if "ink" in q and k < 15: bad.append("no ink of %s" % q["rgb"])
            if "noink" in q and k >= 15: bad.append("ink where none should be")
        elif "light" in q:
            v = [sum(c) / 3.0 for _, _, c in region(q["light"])]
            if sum(v) / max(1, len(v)) < 170: bad.append("dark where it should be mostly white")
        elif "dashes" in q:
            y = int(y0 + q["dashes"][1] * (h - 1)); t = 0; last = None
            for xx in range(int(x0 + q["dashes"][0] * w), int(x0 + q["dashes"][2] * w)):
                v = sum(im.getpixel((xx, y))) / 3.0; st = 1 if v < 90 else 0 if v > 180 else last
                if last is not None and st != last: t += 1
                last = st
            if t < 6: bad.append("not dashed")
        elif "tallInk" in q:
            pts = [(xx, yy) for xx, yy, c in region(q["tallInk"]) if sum(c) < 300]
            if not pts: bad.append("no text")
            elif (max(p[1] for p in pts) - min(p[1] for p in pts)) < 1.5 * (max(p[0] for p in pts) - min(p[0] for p in pts)): bad.append("text across, not up")
    res[n] = bad
shutil.rmtree(tmp, ignore_errors=True)
json.dump(res, open(out, "w"), indent=1)
