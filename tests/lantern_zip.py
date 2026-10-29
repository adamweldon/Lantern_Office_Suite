# lantern_zip.py -- Lantern.zip (tools/make_lantern_zip.py): one folder, Lantern,
# that updates a Lantern folder when extracted over it.
#   - one top folder, "Lantern"; the launchers, the single file, the readme, site/,
#     kit/, docs/ in it; nothing of src/, tests/, tools/ or the package files;
#   - never kit/engine, kit/models, kit/library (what setup downloads), nor a
#     kit/site copy;
#   - the "may run" mark kept for Mac and Linux, Windows line endings kept;
#   - refuses when the pieces disagree about the version (a Lantern that says
#     1.13.2 inside a 1.12.9 site is what bench run 10 ran into);
#   - extracted over the USB stick's old Lantern folder (the way Windows' Extract
#     All does: merge, replace files): Lantern is new, the models and the files
#     that were only on the stick are still there, and the kit uses the new site/.
import json, os, re, shutil, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, "tools", "make_lantern_zip.py")
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:600]))
    if not cond: fails.append(name)

tmp = tempfile.mkdtemp(prefix="lantern-zip-")
version = json.load(open(os.path.join(ROOT, "package.json")))["version"]

# 1. From this checkout (git's list of files)
r = subprocess.run([sys.executable, TOOL, os.path.join(tmp, "dist")], capture_output=True, text=True)
zp = os.path.join(tmp, "dist", "Lantern.zip")
ok("packs Lantern.zip", r.returncode == 0 and os.path.exists(zp) and ("Lantern " + version) in r.stdout, r.stdout + r.stderr)
z = zipfile.ZipFile(zp)
names = z.namelist()
tops = set(n.split("/", 1)[0] for n in names)
ok("one top folder: Lantern", tops == {"Lantern"}, tops)
must = ["Lantern/Lantern_Office_Suite.html", "Lantern/README.txt", "Lantern/CHANGELOG.md", "Lantern/site/index.html",
        "Lantern/site/lantern-sw.js", "Lantern/kit/start-lantern.bat", "Lantern/kit/start-lantern.sh", "Lantern/kit/setup-kit.ps1",
        "Lantern/kit/setup-kit.sh", "Lantern/kit/lantern-kit.py", "Lantern/Install Lantern (Windows).bat",
        "Lantern/Start Lantern (Windows).bat", "Lantern/Install Lantern (Mac).command", "Lantern/Start Lantern (Mac).command",
        "Lantern/Install Lantern (Linux).desktop", "Lantern/Start Lantern (Linux).desktop"]
ok("has the launchers, the single file, the readme, site/ and kit/", all(m in names for m in must), [m for m in must if m not in names])
ok("has the guides", any(n.startswith("Lantern/docs/") and n.endswith(".pdf") for n in names))
ok("has the phone AI engine site/ai", any(n.startswith("Lantern/site/ai/") for n in names))
bad = [n for n in names if re.match(r"Lantern/(src|tests|tools|node_modules|dist|\.git|\.github)/", n) or
       n in ("Lantern/package.json", "Lantern/package-lock.json", "Lantern/README.md", "Lantern/.gitignore", "Lantern/.gitattributes")]
ok("nothing of the repository's working parts", not bad, bad)
never = [n for n in names if re.match(r"Lantern/kit/(engine|models|library|site)/", n) or n.endswith(".part")]
ok("never the engine, models, library or a kit/site copy", not never, never)
def mode(n): return (z.getinfo(n).external_attr >> 16) & 0o777
ok("the Mac and Linux launchers and scripts may run", all(mode(n) & 0o111 for n in
   ("Lantern/Install Lantern (Mac).command", "Lantern/Start Lantern (Linux).desktop", "Lantern/kit/setup-kit.sh", "Lantern/kit/start-lantern.sh", "Lantern/kit/lantern-kit.py")),
   [(n, oct(mode(n))) for n in names if n.endswith((".command", ".sh", ".desktop"))])
ok("the Windows launchers keep their line endings", b"\r\n" in z.read("Lantern/Install Lantern (Windows).bat") and b"\r\n" in z.read("Lantern/kit/start-lantern.bat"))
page = z.read("Lantern/site/index.html").decode("utf-8", "replace")
ok("the zip's Lantern says this version", ('version: "%s"' % version) in page)
notes = open(os.path.join(tmp, "dist", "notes.md"), encoding="utf-8").read()
ok("release notes: how to update, and the newest changelog entry", "Replace" in notes and ("## " + version) in notes, notes[:400])

# 2. From a plain folder (no git): the same choice of files, by what is on disk
plain = os.path.join(tmp, "plain")
def cp(rel):
    s = os.path.join(ROOT, rel); d = os.path.join(plain, rel)
    os.makedirs(os.path.dirname(d), exist_ok=True)
    (shutil.copytree if os.path.isdir(s) else shutil.copy2)(s, d)
for rel in ("site", "kit", "docs", "src", "tools", "Lantern_Office_Suite.html", "README.txt", "CHANGELOG.md", "package.json",
            "Install Lantern (Windows).bat", "Start Lantern (Windows).bat", "Install Lantern (Mac).command", "Start Lantern (Mac).command",
            "Install Lantern (Linux).desktop", "Start Lantern (Linux).desktop"):
    cp(rel)
for junk in ("kit/models/Qwen3.5-35B-A3B.gguf", "kit/engine/windows/llama-server.exe", "kit/library/wikipedia.zim", "kit/site/index.html",
             "kit/models/big.gguf.part", "kit/logs/loads.csv"):
    p = os.path.join(plain, junk); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write("downloaded")
r = subprocess.run([sys.executable, os.path.join(plain, "tools", "make_lantern_zip.py"), os.path.join(tmp, "dist2")], capture_output=True, text=True, cwd=tmp,
                   env=dict(os.environ, GIT_DIR=os.path.join(tmp, "no-git")))
names2 = zipfile.ZipFile(os.path.join(tmp, "dist2", "Lantern.zip")).namelist() if r.returncode == 0 else []
ok("from a plain folder: the same files, still no downloads or working parts",
   r.returncode == 0 and set(names2) == set(names), (r.stderr, sorted(set(names2) ^ set(names))[:10]))

# 3. Refuses when the pieces disagree about the version
pj = os.path.join(plain, "package.json")
pjs = open(pj).read()
open(pj, "w").write(pjs.replace('"version": "%s"' % version, '"version": "9.9.9"'))
r = subprocess.run([sys.executable, os.path.join(plain, "tools", "make_lantern_zip.py"), os.path.join(tmp, "dist3")], capture_output=True, text=True,
                   env=dict(os.environ, GIT_DIR=os.path.join(tmp, "no-git")))
ok("refuses a Lantern whose files disagree about the version, and says which",
   r.returncode != 0 and "site/index.html says " + version in r.stderr and not os.path.exists(os.path.join(tmp, "dist3", "Lantern.zip")), r.stderr)

# 4. Extracted over the USB stick's old Lantern folder (E:\Lantern_USB_Kit_1.9.1\Lantern)
stick = os.path.join(tmp, "Lantern_USB_Kit_1.9.1"); L = os.path.join(stick, "Lantern")
old = {"site/index.html": '<script>var C = { version: "1.12.9" };</script>', "site/lantern-sw.js": "old worker",
       "kit/site/index.html": '<script>var C = { version: "1.12.9" };</script>', "kit/models/Qwen3.5-35B-A3B-UD-IQ4_XS.gguf": "GGUF the big model",
       "kit/engine/windows/llama-server.exe": "MZ engine", "kit/library/wikipedia_en_all_mini.zim": "ZIM library",
       "kit/start-lantern.bat": "old", "README.txt": "old readme", "Lantern_Office_Suite.html": "old single file",
       "Lantern_Library_Pilot_Guide.pdf": "%PDF only on the stick"}
for rel, text in old.items():
    p = os.path.join(L, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(text)
with zipfile.ZipFile(zp) as zz:      # what Extract All does with "Replace the files in the destination"
    zz.extractall(stick)
def text(rel): return open(os.path.join(L, rel), encoding="utf-8", errors="replace").read()
ok("over the old folder: Lantern itself is the new one", ('version: "%s"' % version) in text("site/index.html") and text("site/lantern-sw.js") != "old worker")
ok("...the launchers, kit scripts, readme and single file too", os.path.exists(os.path.join(L, "Install Lantern (Windows).bat")) and
   text("kit/start-lantern.bat") != "old" and text("README.txt") != "old readme" and text("Lantern_Office_Suite.html") != "old single file")
ok("...the model, engine and library are untouched", text("kit/models/Qwen3.5-35B-A3B-UD-IQ4_XS.gguf") == "GGUF the big model" and
   text("kit/engine/windows/llama-server.exe") == "MZ engine" and text("kit/library/wikipedia_en_all_mini.zim") == "ZIM library")
ok("...files that were only on the stick stay", text("Lantern_Library_Pilot_Guide.pdf") == "%PDF only on the stick")
# which Lantern the kit shows now: the folder's site/, not the old kit/site
bat = text("kit/start-lantern.bat")
ok("...and the kit shows the folder's new site/, not the old kit/site", bat.index('set "SITE=%DIR%..\\site"') < bat.index('set "SITE=%DIR%site"'))
sh = subprocess.run(["sh", "-c", 'DIR="$1"; ' + re.search(r'(?m)^SITE="\$DIR/\.\./site".*$', text("kit/start-lantern.sh")).group(0) + '; echo "$SITE"', "x",
                     os.path.join(L, "kit")], capture_output=True, text=True).stdout.strip()
ok("...(start-lantern.sh: the same)", os.path.realpath(sh) == os.path.realpath(os.path.join(L, "site")), sh)

shutil.rmtree(tmp, ignore_errors=True)
print("LANTERN ZIP FAILED (%d)" % len(fails) if fails else "LANTERN ZIP TESTS PASS")
sys.exit(1 if fails else 0)
