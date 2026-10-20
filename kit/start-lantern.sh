#!/bin/sh
# start-lantern.sh -- Lantern with its AI on a Linux or Mac computer (laptop / USB kit).
# Starts llama-server with the best model that fits this computer's memory,
# serves Lantern from the same address, and opens the browser.
#   ./start-lantern.sh          this computer only
#   ./start-lantern.sh share    also phones on the same Wi-Fi or hotspot
#   ./start-lantern.sh gpu      use the graphics card (Linux; Macs always do)
#   MODEL=/path/x.gguf ./start-lantern.sh   use a particular model
# Folder layout (USB stick or this repository):
#   site/  engine/linux/ or engine/mac/  models/*.gguf  start-lantern.sh
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
SITE="$DIR/site"; [ -d "$SITE" ] || SITE="$DIR/../site"
MODELS="$DIR/models"; [ -d "$MODELS" ] || MODELS="$DIR/../models"
PORT="${PORT:-8080}"
HOST=127.0.0.1; GPU=""
for a in "$@"; do
  case "$a" in
    share) HOST=0.0.0.0 ;;
    gpu) GPU=1 ;;
  esac
done

case "$(uname -s)" in
  Darwin) OS=mac;   MEM=$(( $(sysctl -n hw.memsize) / 1048576 )) ;;
  *)      OS=linux; MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo) ;;
esac
BIN="$DIR/engine/$OS/llama-server"
[ -x "$BIN" ] || BIN="$(command -v llama-server 2>/dev/null || true)"
if [ -z "$BIN" ] || [ ! -x "$BIN" ]; then
  echo "llama-server not found. Run ./setup-kit.sh first (needs internet once)."; exit 1
fi

# Largest model that fits: about a third of memory for the model file.
pick() { for p in "$@"; do f=$(ls "$MODELS"/*"$p"*.gguf 2>/dev/null | grep -v -i mmproj | head -n 1); [ -n "$f" ] && { echo "$f"; return 0; }; done; return 1; }
if [ -n "${MODEL:-}" ]; then M="$MODEL"
elif [ "$MEM" -ge 15000 ]; then M=$(pick 9B 4B 2B 0.8B "")
elif [ "$MEM" -ge 7000 ]; then M=$(pick 4B 2B 0.8B "")
elif [ "$MEM" -ge 5000 ]; then M=$(pick 2B 0.8B "")
else M=$(pick 0.8B 2B "")
fi
if [ -z "${M:-}" ] || [ ! -f "$M" ]; then
  echo "No model in $MODELS. Run ./setup-kit.sh, or copy a .gguf file there."; exit 1
fi

NGL="-ngl 0"
if [ "$OS" = mac ] || [ -n "$GPU" ]; then NGL=""; fi
echo "Lantern: $(basename "$M") on $OS with ${MEM} MB memory"
echo "Open http://127.0.0.1:$PORT/ (this window must stay open; Ctrl+C stops it)"
if [ "$HOST" = 0.0.0.0 ]; then
  if [ "$OS" = mac ]; then IPS=$(ipconfig getifaddr en0 2>/dev/null; ipconfig getifaddr en1 2>/dev/null)
  else IPS=$(hostname -I 2>/dev/null); fi
  for ip in $IPS; do echo "Phones on this network: http://$ip:$PORT/"; done
fi

cd "$(dirname "$BIN")" || exit 1
# Engine libraries sit next to the binary.
LD_LIBRARY_PATH="$(pwd)${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"; export LD_LIBRARY_PATH
DYLD_LIBRARY_PATH="$(pwd)${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"; export DYLD_LIBRARY_PATH
# shellcheck disable=SC2086
"$BIN" -m "$M" --path "$SITE" --host "$HOST" --port "$PORT" -c 8192 $NGL &
PID=$!
trap 'kill $PID 2>/dev/null' INT TERM EXIT
i=0
while [ $i -lt 120 ]; do
  if curl -s "http://127.0.0.1:$PORT/health" 2>/dev/null | grep -q ok; then break; fi
  sleep 1; i=$((i+1))
done
if [ -z "${NO_BROWSER:-}" ]; then
  if [ "$OS" = mac ]; then open "http://127.0.0.1:$PORT/"; else xdg-open "http://127.0.0.1:$PORT/" >/dev/null 2>&1 || true; fi
fi
wait $PID
