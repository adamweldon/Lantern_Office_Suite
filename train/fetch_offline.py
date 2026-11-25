r"""fetch_offline.py -- everything the training needs, fetched once, so it can then run with no internet.

    python train/fetch_offline.py                    the 0.8B and the 2B, for a Windows computer with Python 3.12
    python train/fetch_offline.py --sizes 0.8b       only the 0.8B
    "Get everything for offline use (Windows).bat"   the same, double-clicked

Run it on a Windows computer that has the internet: the computer that will train, while it is connected, or any other
(pip decides which packages PyTorch needs by the computer it runs on, so a Linux or Mac computer fetches the wrong
set). It puts into this train folder:
  offline\python-3.12.10-amd64.exe   Python, for a computer that has none (the training uses Python 3.12)
  offline\wheels\                    PyTorch for NVIDIA cards, transformers, peft and what they need, for Python 3.12
  base\<size>\                       each model's original weights (Qwen3.5, Apache-2.0), from Hugging Face
  llama.cpp-b11435\                  llama.cpp's converter, the same build as the kit's engine
Then carry the train folder (on the stick) to the computer that trains. "Train Lantern model (Windows).bat" sees
offline\wheels and installs from it, with no internet; every other step finds its files already there.
A file already fetched whole is not fetched again, so it can be run again after an interruption.
Needs only Python 3.8 or newer and pip; nothing is installed on the computer that fetches.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = {"0.8b": "Qwen/Qwen3.5-0.8B", "2b": "Qwen/Qwen3.5-2B", "4b": "Qwen/Qwen3.5-4B", "9b": "Qwen/Qwen3.5-9B"}
PY_VERSION = "3.12.10"   # the last Python 3.12 with a Windows installer from python.org
BUILD = "b11435"         # the kit's llama.cpp build
PACKAGES = ["transformers>=5.24", "peft>=0.22", "accelerate", "safetensors", "huggingface_hub", "sentencepiece", "numpy", "pyyaml", "protobuf"]


def say(s):
    print(s, flush=True)


def fetch(url, dest, size=None):
    """url to dest, through dest.part; skipped when dest is there already (and, if the size is known, that size)"""
    if os.path.exists(dest) and (size is None or os.path.getsize(dest) == size):
        return False
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    part = dest + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": "lantern-train-fetch"})
    t0 = time.time(); got = 0; last = t0
    with urllib.request.urlopen(req, timeout=60) as r, open(part, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0) or size or 0
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b); got += len(b)
            if total and time.time() - last > 5:
                last = time.time(); say("    %s  %d of %d MB" % (os.path.basename(dest), got >> 20, total >> 20))
    if size is not None and got != size:
        raise IOError("%s: got %d bytes, expected %d" % (url, got, size))
    os.replace(part, dest)
    say("    %s  %d MB in %ds" % (os.path.basename(dest), got >> 20, time.time() - t0))
    return True


def get_python(out, base):
    name = "python-%s-amd64.exe" % PY_VERSION
    say("Python %s for Windows ..." % PY_VERSION)
    fetch("%s/ftp/python/%s/%s" % (base, PY_VERSION, name), os.path.join(out, name))


def pip_download(args, check=True):
    cmd = [sys.executable, "-m", "pip", "download", "--disable-pip-version-check"] + args
    say("    " + " ".join(cmd[3:])[:300])
    return subprocess.run(cmd, check=check)


def get_wheels(wheels, platform, pyver, torch_index, cuda, only, qlora):
    """PyTorch from PyTorch's own index (the PyPI one for Windows has no CUDA), then the rest from PyPI with that
    same PyTorch in front of pip, so pip does not fetch a second, CPU-only one."""
    os.makedirs(wheels, exist_ok=True)
    tag = ["--platform", platform, "--python-version", pyver, "--only-binary=:all:", "-d", wheels]
    pkgs = list(only) if only else list(PACKAGES)
    if qlora and not only:
        pkgs.append("bitsandbytes")
    def have_torch():
        found = sorted(f for f in os.listdir(wheels) if f.startswith("torch-") and f.endswith(".whl"))
        return found[-1] if found else None
    if not only or "torch" in only:
        say("PyTorch for NVIDIA cards (%s), for Python %s on %s ..." % (cuda, pyver, platform))
        index = torch_index or "https://download.pytorch.org/whl/%s" % cuda
        pip_download(["torch", "--index-url", index] + tag)
        if not have_torch():
            raise SystemExit("PyTorch was not fetched")
        pkgs = [p for p in pkgs if p != "torch"]
    torch_whl = have_torch()   # this one, or one fetched before: the rest is fetched against it
    if pkgs:
        say("transformers, peft and what they need ...")
        pin = []
        if torch_whl:
            pin = ["torch==" + torch_whl.split("-")[1], "--find-links", wheels]
        pip_download(pkgs + pin + tag)
    torches = [f for f in os.listdir(wheels) if f.startswith("torch-")]
    if len(torches) > 1:
        say("    note: more than one PyTorch here: %s" % ", ".join(sorted(torches)))


def get_model(repo, dest, hf):
    """every file of the model's main branch, the way huggingface_hub's snapshot_download lays them out"""
    say("%s ..." % repo)
    api = "%s/api/models/%s/tree/main?recursive=1" % (hf, repo)
    with urllib.request.urlopen(urllib.request.Request(api, headers={"User-Agent": "lantern-train-fetch"}), timeout=60) as r:
        tree = json.loads(r.read().decode("utf-8"))
    files = [t for t in tree if t.get("type") == "file"]
    if not any(t["path"] == "config.json" for t in files):
        raise SystemExit("%s: no config.json in the model's files" % repo)
    # config.json last: the training script takes its presence to mean the download is whole
    files.sort(key=lambda t: t["path"] == "config.json")
    for t in files:
        size = (t.get("lfs") or {}).get("size", t.get("size"))
        url = "%s/%s/resolve/main/%s" % (hf, repo, urllib.parse.quote(t["path"]))
        fetch(url, os.path.join(dest, *t["path"].split("/")), size)


def get_llama(dest_parent, url):
    folder = os.path.join(dest_parent, "llama.cpp-%s" % BUILD)
    say("llama.cpp %s (its converter) ..." % BUILD)
    if os.path.exists(os.path.join(folder, "convert_hf_to_gguf.py")):
        return
    zp = os.path.join(dest_parent, "llama-src.zip")
    fetch(url, zp)
    with zipfile.ZipFile(zp) as z:
        z.extractall(dest_parent)
    os.remove(zp)
    if not os.path.exists(os.path.join(folder, "convert_hf_to_gguf.py")):
        raise SystemExit("llama.cpp's zip did not hold llama.cpp-%s/convert_hf_to_gguf.py" % BUILD)


def cuda_for_driver():
    """the newest of PyTorch's CUDA builds this computer's NVIDIA driver runs (nvidia-smi says which CUDA it supports);
    cu126, which the most drivers run, when there is no NVIDIA card here (fetching for another computer)"""
    try:
        out = subprocess.run(["nvidia-smi"], capture_output=True, text=True, timeout=30).stdout
    except (OSError, subprocess.SubprocessError):
        return "cu126"
    m = re.search(r"CUDA Version:\s*(\d+)\.(\d+)", out)
    if not m:
        return "cu126"
    v = (int(m.group(1)), int(m.group(2)))
    return "cu130" if v >= (13, 0) else "cu128" if v >= (12, 8) else "cu126"


def du(path):
    n = 0
    for root, _, fs in os.walk(path):
        for f in fs:
            n += os.path.getsize(os.path.join(root, f))
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sizes", default="0.8b,2b", help="which models: 0.8b,2b,4b,9b (default 0.8b,2b)")
    ap.add_argument("--cuda", default="auto", help="PyTorch's CUDA build: cu126, cu128 or cu130 (auto: what this computer's NVIDIA driver runs; cu126 with no NVIDIA card)")
    ap.add_argument("--dir", default=HERE, help="the train folder to fill (default: this one)")
    ap.add_argument("--skip-python", action="store_true")
    ap.add_argument("--skip-wheels", action="store_true")
    ap.add_argument("--skip-models", action="store_true")
    ap.add_argument("--skip-llama", action="store_true")
    # for a test on another computer: other sources and another platform
    ap.add_argument("--platform", default="win_amd64", help=argparse.SUPPRESS)
    ap.add_argument("--python-version", default="3.12", help=argparse.SUPPRESS)
    ap.add_argument("--torch-index", default="", help=argparse.SUPPRESS)
    ap.add_argument("--only", default="", help=argparse.SUPPRESS)
    ap.add_argument("--hf", default="https://huggingface.co", help=argparse.SUPPRESS)
    ap.add_argument("--python-site", default="https://www.python.org", help=argparse.SUPPRESS)
    ap.add_argument("--llama-url", default="https://github.com/ggml-org/llama.cpp/archive/refs/tags/%s.zip" % BUILD, help=argparse.SUPPRESS)
    a = ap.parse_args()
    sizes = [s.strip().lower() for s in a.sizes.split(",") if s.strip()]
    bad = [s for s in sizes if s not in MODELS]
    if bad:
        raise SystemExit("unknown size %s: 0.8b, 2b, 4b or 9b" % ", ".join(bad))
    if a.cuda == "auto":
        a.cuda = cuda_for_driver()
    off = os.path.join(a.dir, "offline")
    os.makedirs(off, exist_ok=True)
    t0 = time.time()
    if not a.skip_python:
        get_python(off, a.python_site)
    if not a.skip_wheels:
        get_wheels(os.path.join(off, "wheels"), a.platform, a.python_version, a.torch_index, a.cuda,
                   [p for p in a.only.split(",") if p], "9b" in sizes)
    if not a.skip_models:
        for s in sizes:
            get_model(MODELS[s], os.path.join(a.dir, "base", s), a.hf)
    if not a.skip_llama:
        get_llama(a.dir, a.llama_url)
    lines = ["Fetched for offline training, %s, in %d minutes." % (time.strftime("%Y-%m-%d %H:%M"), (time.time() - t0) // 60),
             "For Python %s on %s; PyTorch %s; models: %s." % (a.python_version, a.platform, a.cuda, ", ".join(sizes) or "none")]
    for name in ["offline", "base", "llama.cpp-%s" % BUILD]:
        p = os.path.join(a.dir, name)
        if os.path.exists(p):
            lines.append("  %-20s %6.1f GB" % (name, du(p) / 1e9))
    with open(os.path.join(off, "FETCHED.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")
    say("\n".join(lines))
    say("Done. Carry this train folder to the computer that trains; it needs no internet now.")


if __name__ == "__main__":
    main()
