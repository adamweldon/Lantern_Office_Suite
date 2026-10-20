#!/bin/sh
# setup-kit.sh -- fetch the AI engine (llama.cpp) and models into this kit.
# Needs internet once; afterwards the kit works offline and can be copied.
#   ./setup-kit.sh              engine for this computer + the model that fits it
#   ./setup-kit.sh phone        the two phone models (0.8B, 2B) -- to copy onto phones
#   ./setup-kit.sh laptop big   4B (8 GB laptops) and 9B (16 GB laptops)
#   ./setup-kit.sh usb          engines for Windows, Mac and Linux + every model (~10 GB)
#   add "gpu" for the Vulkan engine builds (graphics card) on Windows/Linux
# Overrides: LLAMA_BUILD (default b11435), LLAMA_BASE, HF_BASE (mirrors).
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD="${LLAMA_BUILD:-b11435}"
LLAMA_BASE="${LLAMA_BASE:-https://github.com/ggml-org/llama.cpp/releases/download/$BUILD}"
HF_BASE="${HF_BASE:-https://huggingface.co}"
MODELS="$DIR/models"; mkdir -p "$MODELS"

fetch() {  # url dest
  if [ -s "$2" ]; then echo "  have $(basename "$2")"; return 0; fi
  echo "  downloading $(basename "$2")"
  curl -L --fail --retry 3 --progress-bar -o "$2.part" "$1"
  mv "$2.part" "$2"
}
model() {  # repo file
  fetch "$HF_BASE/$1/resolve/main/$2" "$MODELS/$2"
  if [ "$(head -c 4 "$MODELS/$2")" != "GGUF" ]; then echo "  $2 is not a GGUF file; deleted"; rm -f "$MODELS/$2"; return 1; fi
}
engine() {  # os asset
  if [ -x "$DIR/engine/$1/llama-server" ] || [ -f "$DIR/engine/$1/llama-server.exe" ]; then echo "  have engine for $1"; return 0; fi
  tmp=$(mktemp -d)
  fetch "$LLAMA_BASE/$2" "$tmp/$2"
  case "$2" in
    *.zip) (cd "$tmp" && unzip -q "$2") ;;
    *) tar -xzf "$tmp/$2" -C "$tmp" ;;
  esac
  bin=$(find "$tmp" -type f \( -name llama-server -o -name llama-server.exe \) | head -n 1)
  if [ -z "$bin" ]; then echo "  no llama-server inside $2"; rm -rf "$tmp"; return 1; fi
  mkdir -p "$DIR/engine/$1"
  cp -R "$(dirname "$bin")"/. "$DIR/engine/$1/"
  chmod +x "$DIR/engine/$1/"llama-* 2>/dev/null || true
  rm -rf "$tmp"
  echo "  engine for $1 ready"
}
phone()  { model unsloth/Qwen3.5-0.8B-GGUF Qwen3.5-0.8B-Q4_K_M.gguf; model unsloth/Qwen3.5-2B-GGUF Qwen3.5-2B-Q4_K_M.gguf; }
laptop() { model unsloth/Qwen3.5-4B-GGUF Qwen3.5-4B-Q4_K_M.gguf; }
big()    { model unsloth/Qwen3.5-9B-GGUF Qwen3.5-9B-Q4_K_M.gguf; }

GPU=""; SETS=""
for a in "$@"; do case "$a" in gpu) GPU=1 ;; *) SETS="$SETS $a" ;; esac; done
LNX="llama-$BUILD-bin-ubuntu-x64.tar.gz"; WIN="llama-$BUILD-bin-win-cpu-x64.zip"
if [ -n "$GPU" ]; then LNX="llama-$BUILD-bin-ubuntu-vulkan-x64.tar.gz"; WIN="llama-$BUILD-bin-win-vulkan-x64.zip"; fi
case "$(uname -m)" in aarch64|arm64) LNX="llama-$BUILD-bin-ubuntu-arm64.tar.gz"; MACA="llama-$BUILD-bin-macos-arm64.tar.gz" ;;
  *) MACA="llama-$BUILD-bin-macos-x64.tar.gz" ;; esac

echo "Lantern kit setup (llama.cpp $BUILD)"
case "$(uname -s)" in
  Darwin) OS=mac; MEM=$(( $(sysctl -n hw.memsize) / 1048576 )); THIS="$MACA" ;;
  *) OS=linux; MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo); THIS="$LNX" ;;
esac
if [ -z "$SETS" ]; then
  engine "$OS" "$THIS"
  if [ "$MEM" -ge 7000 ]; then laptop; else phone; fi
fi
for s in $SETS; do
  case "$s" in
    phone) phone ;; laptop) laptop ;; big) big ;;
    usb) engine linux "$LNX"; engine windows "$WIN"; engine mac "llama-$BUILD-bin-macos-arm64.tar.gz"; phone; laptop; big ;;
    engine) engine "$OS" "$THIS" ;;
    *) echo "unknown option: $s" ;;
  esac
done
echo "Done. Start Lantern with ./start-lantern.sh (or start-lantern.bat on Windows)."
