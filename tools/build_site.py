#!/usr/bin/env python3
"""build_site.py -- refresh site/ from src/lantern.inner.html.

site/ is the deployable web build: Lantern itself (index.html, served as the
plain inner document -- no self-unpacking wrapper needed on a web server),
the offline worker, the install manifest, icons, and the on-device AI engine
(site/ai, vendored wllama 3.8.1). This script rewrites index.html and stamps
the version into the worker so every build replaces the old offline copy.

Usage: python3 tools/build_site.py
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "lantern.inner.html")
SITE = os.path.join(ROOT, "site")
HEAD = (
    '<link rel="manifest" href="manifest.webmanifest">\n'
    '<meta name="theme-color" content="#1e293b">\n'
    '<link rel="icon" href="icons/icon-192.png">\n'
    '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-title" content="Lantern">\n'
)

def main():
    html = open(SRC, encoding="utf-8").read()
    m = re.search(r'version: "([^"]+)"', html)
    if not m:
        sys.exit("no version in source")
    anchor = '<meta charset="utf-8">\n'
    if html.count(anchor) < 1:
        sys.exit("no charset meta to anchor the site head tags")
    i = html.index(anchor) + len(anchor)
    page = html[:i] + HEAD + html[i:]
    open(os.path.join(SITE, "index.html"), "w", encoding="utf-8").write(page)
    stamp = m.group(1) + "-" + hashlib.sha256(page.encode("utf-8")).hexdigest()[:8]
    swp = os.path.join(SITE, "lantern-sw.js")
    sw = open(swp, encoding="utf-8").read()
    sw2 = re.sub(r'var VERSION = "[^"]*";', 'var VERSION = "%s";' % stamp, sw, count=1)
    open(swp, "w", encoding="utf-8").write(sw2)
    for need in ["ai/wllama/index.js", "ai/wllama/wllama.wasm", "ai/wllama-compat/wllama.js",
                 "ai/wllama-compat/wllama.wasm", "manifest.webmanifest", "icons/icon-192.png"]:
        if not os.path.exists(os.path.join(SITE, need)):
            sys.exit("site is missing " + need)
    open(os.path.join(SITE, ".nojekyll"), "w").close()
    print("site/index.html written (Lantern %s), worker cache %s" % (m.group(1), stamp))

if __name__ == "__main__":
    main()
