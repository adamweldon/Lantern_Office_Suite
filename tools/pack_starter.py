#!/usr/bin/env python3
# pack_starter.py OUT_DIR -- build the Lantern starter (tools/starter, Go) for
# every computer and pack each the way that computer opens it (1.24.19):
#   Get-Lantern.exe          Windows (64-bit): double-click; no black window
#   Get-Lantern-Mac.zip      a Mac (Apple chips and Intel): Lantern.app inside,
#                            which runs the right one of the two programs
#   Get-Lantern-Linux-x64, Get-Lantern-Linux-arm64   Linux / Raspberry Pi
# Each finds Lantern beside it or in ~/Lantern, or downloads the newest
# Lantern.zip from the releases and sets it up (see tools/starter/main.go).
# Needs Go 1.21 or newer (on the PATH, or /usr/local/go/bin/go).
import os, shutil, stat, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "starter")


def go():
    g = shutil.which("go") or ("/usr/local/go/bin/go" if os.path.exists("/usr/local/go/bin/go") else None)
    if not g:
        sys.exit("pack_starter: Go is needed (https://go.dev/dl/)")
    return g


def build(goos, goarch, out, gui=False):
    env = dict(os.environ, GOOS=goos, GOARCH=goarch, CGO_ENABLED="0", GOFLAGS="-mod=mod", GOTOOLCHAIN="local")
    ld = "-s -w" + (" -H=windowsgui" if gui else "")
    subprocess.run([go(), "build", "-trimpath", "-ldflags", ld, "-o", out, "."], cwd=SRC, env=env, check=True)


PLIST = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>Lantern</string>
  <key>CFBundleIdentifier</key><string>org.lantern-office-suite.starter</string>
  <key>CFBundleName</key><string>Lantern</string>
  <key>CFBundleDisplayName</key><string>Lantern</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>%s</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
"""
LAUNCH = """#!/bin/sh
# Lantern.app: the program for this Mac's processor (the page in the browser is Lantern's window)
d=$(cd "$(dirname "$0")" && pwd)
case "$(uname -m)" in arm64) exec "$d/lantern-arm64" "$@" ;; *) exec "$d/lantern-x86_64" "$@" ;; esac
"""


def zadd(z, name, data, exe=False):
    zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    zi.create_system = 3   # Unix, so the permissions below are kept by the Mac's Archive Utility
    zi.external_attr = ((0o755 if exe else 0o644) | stat.S_IFREG) << 16
    zi.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(zi, data)


def version():
    import json
    return json.load(open(os.path.join(ROOT, "package.json")))["version"]


def main(out):
    os.makedirs(out, exist_ok=True)
    build("windows", "amd64", os.path.join(out, "Get-Lantern.exe"), gui=True)
    build("linux", "amd64", os.path.join(out, "Get-Lantern-Linux-x64"))
    build("linux", "arm64", os.path.join(out, "Get-Lantern-Linux-arm64"))
    tmp = os.path.join(out, ".mac")
    os.makedirs(tmp, exist_ok=True)
    build("darwin", "arm64", os.path.join(tmp, "lantern-arm64"))
    build("darwin", "amd64", os.path.join(tmp, "lantern-x86_64"))
    with zipfile.ZipFile(os.path.join(out, "Get-Lantern-Mac.zip"), "w") as z:
        zadd(z, "Lantern.app/Contents/Info.plist", PLIST % version())
        zadd(z, "Lantern.app/Contents/MacOS/Lantern", LAUNCH, exe=True)
        for a in ("lantern-arm64", "lantern-x86_64"):
            zadd(z, "Lantern.app/Contents/MacOS/" + a, open(os.path.join(tmp, a), "rb").read(), exe=True)
    shutil.rmtree(tmp)
    for f in sorted(os.listdir(out)):
        p = os.path.join(out, f)
        if os.path.isfile(p):
            print("%-26s %5.1f MB" % (f, os.path.getsize(p) / 1e6))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: pack_starter.py OUT_DIR")
    main(sys.argv[1])
