#!/usr/bin/env python3
"""make_lantern_zip.py -- Lantern.zip: one folder, "Lantern", with everything a
person needs and nothing they downloaded themselves.

    python3 tools/make_lantern_zip.py [outdir]        (default: dist/)

Writes outdir/Lantern.zip and outdir/notes.md (the newest CHANGELOG entry, for
the release page). Extracting Lantern.zip into the folder that holds a Lantern
folder updates it in place: Windows' Extract All asks before replacing files.
The AI engine, models and encyclopedia (kit/engine, kit/models, kit/library)
are never in the zip, so an update never touches them.

In the zip, under Lantern/:
  Install Lantern (...) / Start Lantern (...)   the double-click launchers
  Lantern_Office_Suite.html                     the single file (no AI needed)
  README.txt  CHANGELOG.md                      what it is; what changed
  site/                                          Lantern itself (what the kit shows)
  kit/                                           the scripts that set up and start the AI
  docs/                                          the PDF guides
Not in it: src/, tests/, tools/, package files (the repository's working parts).

Stops, writing nothing, when the pieces disagree about the version: package.json,
site/index.html, site/lantern-sw.js and Lantern_Office_Suite.html must all say
the same one (bench run 10 ran an old Lantern without anyone knowing).
Python 3 standard library only, so the GitHub workflow needs nothing installed.
"""
import json, os, re, subprocess, sys, time, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOP_FILES = ("Lantern_Office_Suite.html", "README.txt", "CHANGELOG.md")
TOP_DIRS = ("site", "kit", "docs")
NEVER = ("kit/engine/", "kit/models/", "kit/library/",   # what setup downloads
         "kit/site/", "kit/site.new/", "kit/site.old/", "site.new/", "site.old/")   # Lantern lives in Lantern/site only


def launcher(name):
    return re.match(r"^(Install|Start) Lantern \((Windows|Mac|Linux)\)\.(bat|command|desktop)$", name) is not None


def wanted(path):
    if any(path.startswith(n) for n in NEVER) or path.endswith((".part", ".pyc")) or "__pycache__/" in path:
        return False
    if path.rsplit("/", 1)[-1].startswith("."):   # .nojekyll, .gitignore, locks: not for people
        return False
    if "/" not in path:
        return path in TOP_FILES or launcher(path)
    return path.split("/", 1)[0] in TOP_DIRS


def files():
    """(path, mode) for each file to pack: git's list when this is a git
    checkout (so nothing untracked slips in), else what is on disk."""
    try:
        out = subprocess.run(["git", "-C", ROOT, "ls-files", "-s", "-z"], capture_output=True, check=True).stdout.decode("utf-8")
        got = []
        for rec in out.split("\0"):
            if not rec:
                continue
            meta, path = rec.split("\t", 1)
            mode = int(meta.split()[0], 8)
            if wanted(path) and os.path.isfile(os.path.join(ROOT, path)):
                got.append((path, 0o755 if mode & 0o111 else 0o644))
        if got:
            return sorted(got)
    except (OSError, subprocess.CalledProcessError, ValueError):
        pass
    got = []
    for dirpath, dirs, names in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT).replace(os.sep, "/")
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "__pycache__")]
        for n in names:
            if n.startswith(".") or n.endswith(".pyc"):
                continue
            p = n if rel == "." else rel + "/" + n
            if wanted(p):
                x = os.stat(os.path.join(ROOT, p)).st_mode
                got.append((p, 0o755 if x & 0o111 else 0o644))
    return sorted(got)


def read(rel, mode="r"):
    with open(os.path.join(ROOT, rel), mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f:
        return f.read()


def versions():
    v = json.loads(read("package.json"))["version"] if os.path.exists(os.path.join(ROOT, "package.json")) else None
    page = re.search(r'version: "([0-9][0-9.]*)"', read("site/index.html"))
    sw = re.search(r'VERSION = "([0-9][0-9.]*)-', read("site/lantern-sw.js"))
    one = re.search(r'version: \\"([0-9][0-9.]*)\\"', read("Lantern_Office_Suite.html"))
    return v, {"site/index.html": page and page.group(1), "site/lantern-sw.js": sw and sw.group(1),
               "Lantern_Office_Suite.html": one and one.group(1)}


def notes(version):
    """The newest CHANGELOG entry, for the release page."""
    text = read("CHANGELOG.md") if os.path.exists(os.path.join(ROOT, "CHANGELOG.md")) else ""
    parts = re.split(r"(?m)^## ", text)
    top = ("## " + parts[1]).strip() if len(parts) > 1 else "Lantern " + version
    head = ("Download **Lantern.zip** below. Extract it into the folder that holds your Lantern folder "
            "(on a USB stick, the folder with `Lantern` in it) and choose **Replace** when asked: "
            "the AI models and encyclopedia you downloaded stay as they are. New here? Extract it "
            "anywhere, then double-click **Install Lantern** for your computer.\n\n")
    return head + top + "\n"


def main():
    out_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist"))
    v, found = versions()
    wrong = [k + " says " + str(x) for k, x in found.items() if x != v]
    if not v or wrong:
        sys.exit("Lantern.zip not made: package.json says %s, but %s. Rebuild (tools/build_site.py, tools/bundle.js) first."
                 % (v, "; ".join(wrong) or "no version"))
    fl = files()
    have = set(p for p, _ in fl)
    for must in ("site/index.html", "Lantern_Office_Suite.html", "kit/start-lantern.bat", "kit/start-lantern.sh",
                 "Start Lantern (Windows).bat", "Install Lantern (Windows).bat"):
        if must not in have:
            sys.exit("Lantern.zip not made: %s is missing" % must)
    try:
        when = int(subprocess.run(["git", "-C", ROOT, "log", "-1", "--format=%ct"], capture_output=True, check=True).stdout.strip())
    except (OSError, subprocess.CalledProcessError, ValueError):
        when = int(time.time())
    stamp = time.localtime(when)[:6]
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "Lantern.zip")
    tmp = path + ".part"
    dirs = set()
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p, mode in fl:
            parts = p.split("/")[:-1]
            for i in range(len(parts) + 1):
                d = "/".join(["Lantern"] + parts[:i]) + "/"
                if d not in dirs:
                    dirs.add(d)
                    zi = zipfile.ZipInfo(d, stamp); zi.create_system = 3; zi.external_attr = (0o40755 << 16) | 0x10
                    z.writestr(zi, b"")
            zi = zipfile.ZipInfo("Lantern/" + p, stamp)
            zi.create_system = 3                      # unix: Mac and Linux keep the "may run" mark
            zi.external_attr = (0o100000 | mode) << 16
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, read(p, "rb"), compresslevel=9)
    os.replace(tmp, path)
    with open(os.path.join(out_dir, "notes.md"), "w", encoding="utf-8") as f:
        f.write(notes(v))
    print("Lantern %s: %s (%d files, %.1f MB)" % (v, path, len(fl), os.path.getsize(path) / 1048576.0))


if __name__ == "__main__":
    main()
