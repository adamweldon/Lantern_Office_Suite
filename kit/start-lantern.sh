#!/bin/sh
# start-lantern.sh -- Lantern with its AI on a Linux or Mac computer (laptop / USB kit).
# Starts llama-server with the best model that fits this computer's memory,
# serves Lantern from the same address, and opens the browser.
#   ./start-lantern.sh          this computer only
#   ./start-lantern.sh share    also phones on the same Wi-Fi or hotspot
#   ./start-lantern.sh gpu      use the graphics card (Linux; Macs always do)
#   ./start-lantern.sh 9b       use a particular model from models/ (35b 9b 4b 2b 0.8b)
#   ./start-lantern.sh nodownload   do not offer a bigger model
#   ./start-lantern.sh novision     do not load the model's vision part (it
#                                   is loaded when models/ has it: the AI can
#                                   then look at the drawings it makes)
#   MODEL=/path/x.gguf ./start-lantern.sh   use a particular model file
# When this computer could run a better model than the kit has (and there is
# internet and room on the drive), it asks once and downloads it in the
# background while Lantern starts; the next start uses it.
# Folder layout (USB stick or this repository):
#   site/  engine/linux/ or engine/mac/  models/*.gguf  start-lantern.sh
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
SITE="$DIR/site"; [ -d "$SITE" ] || SITE="$DIR/../site"
MODELS="$DIR/models"; [ -d "$MODELS" ] || MODELS="$DIR/../models"
LIBRARY="$DIR/library"; [ -d "$LIBRARY" ] || LIBRARY="$DIR/../library"
LIBRARY_PORT="${LIBRARY_PORT:-8081}"
PORT="${PORT:-8080}"
HOST=127.0.0.1; GPU=""; AUTO=1; FORCE=""; VISION=1
for a in "$@"; do
  case "$a" in
    share) HOST=0.0.0.0 ;;
    gpu) GPU=1 ;;
    nodownload) AUTO="" ;;
    novision) VISION="" ;;
    35b|35B) FORCE=35B-A3B ;;
    9b|9B) FORCE=9B ;;
    4b|4B) FORCE=4B ;;
    2b|2B) FORCE=2B ;;
    0.8b|0.8B) FORCE=0.8B ;;
  esac
done
[ "${LANTERN_AUTO_DOWNLOAD:-}" = 0 ] && AUTO=""
[ -n "${MODEL:-}" ] && AUTO=""
[ -n "$FORCE" ] && AUTO=""

case "$(uname -s)" in
  Darwin) OS=mac;   MEM=$(( $(sysctl -n hw.memsize) / 1048576 )) ;;
  *)      OS=linux; MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo) ;;
esac
[ -n "${LANTERN_MEM_MB:-}" ] && MEM=$LANTERN_MEM_MB   # pretend, for testing
BIN="$DIR/engine/$OS/llama-server"
[ -x "$BIN" ] || BIN="$(command -v llama-server 2>/dev/null || true)"
if [ -z "$BIN" ] || [ ! -x "$BIN" ]; then
  echo "llama-server not found. Run ./setup-kit.sh first (needs internet once)."; exit 1
fi

# A bigger model for this computer? (asks once; downloads in the background)
if [ -n "$AUTO" ] && [ -x "$DIR/setup-kit.sh" ]; then "$DIR/setup-kit.sh" offer || true; fi

# Largest model this computer's memory runs well.
pick() { for p in "$@"; do f=$(ls "$MODELS"/*"$p"*.gguf 2>/dev/null | grep -v -i mmproj | head -n 1); [ -n "$f" ] && { echo "$f"; return 0; }; done; return 1; }
M=""
if [ -n "${MODEL:-}" ]; then M="$MODEL"
elif [ -n "$FORCE" ] && M=$(pick "$FORCE"); then :
else
  [ -n "$FORCE" ] && echo "No $FORCE model in $MODELS, so using the best one there instead."
  M=""
fi
if [ -n "$M" ]; then :
elif [ "$MEM" -ge 28000 ]; then M=$(pick 35B-A3B 9B 4B 2B 0.8B "")
elif [ "$MEM" -ge 15000 ]; then M=$(pick 9B 4B 2B 0.8B 35B-A3B "")
elif [ "$MEM" -ge 7000 ]; then M=$(pick 4B 2B 0.8B 9B 35B-A3B "")
elif [ "$MEM" -ge 5000 ]; then M=$(pick 2B 0.8B 4B 9B 35B-A3B "")
else M=$(pick 0.8B 2B 4B 9B 35B-A3B "")
fi
if [ -z "${M:-}" ] || [ ! -f "$M" ]; then
  echo "No model in $MODELS. Run ./setup-kit.sh, or copy a .gguf file there."; exit 1
fi

NGL="-ngl 0"
if [ "$OS" = mac ] || [ -n "$GPU" ]; then NGL=""; fi
# The model's vision part (mmproj-<model>-F16.gguf, from setup-kit), so the
# AI can look at pictures -- the drawings Lantern makes for it to check.
MMPROJ=""
if [ -n "$VISION" ]; then
  MB=$(basename "$M")
  for v in "$MODELS"/mmproj-*.gguf; do
    [ -f "$v" ] || continue
    base=$(basename "$v" .gguf | sed 's/^mmproj-//; s/-BF16$//; s/-F16$//; s/-F32$//')
    case "$MB" in "$base"-*) MMPROJ="$v" ;; esac
  done
fi
echo "Lantern: $(basename "$M") on $OS with ${MEM} MB memory"
[ -n "$MMPROJ" ] && echo "Vision: $(basename "$MMPROJ") (the AI can look at the pictures it makes)"
echo "Open http://127.0.0.1:$PORT/ (this window must stay open; Ctrl+C stops it)"
if [ "$HOST" = 0.0.0.0 ]; then
  if [ "$OS" = mac ]; then IPS=$(ipconfig getifaddr en0 2>/dev/null; ipconfig getifaddr en1 2>/dev/null)
  else IPS=$(hostname -I 2>/dev/null); fi
  for ip in $IPS; do echo "Phones on this network: http://$ip:$PORT/"; done
fi

# The offline library: kiwix-serve on port 8081 with every ZIM in library/.
# Lantern finds it there by itself (AI app > Offline library).
KIWIX="$DIR/engine/$OS/kiwix/kiwix-serve"; [ -x "$KIWIX" ] || KIWIX="$(command -v kiwix-serve 2>/dev/null || true)"
KPID=""
if ls "$LIBRARY"/*.zim >/dev/null 2>&1; then
  if [ -n "$KIWIX" ] && [ -x "$KIWIX" ]; then
    "$KIWIX" --port "$LIBRARY_PORT" --address "$HOST" -z "$LIBRARY"/*.zim > /dev/null 2>&1 &
    KPID=$!
    echo "Library: $(cd "$LIBRARY" && ls *.zim | tr '\n' ' ')(http://127.0.0.1:$LIBRARY_PORT/)"
  else
    echo "Library files found, but not kiwix-serve: run ./setup-kit.sh library"
  fi
fi

cd "$(dirname "$BIN")" || exit 1
# Engine libraries sit next to the binary.
LD_LIBRARY_PATH="$(pwd)${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"; export LD_LIBRARY_PATH
DYLD_LIBRARY_PATH="$(pwd)${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"; export DYLD_LIBRARY_PATH
# When the server started, for Lantern's progress bar while the model loads
T0="$(date +%s)000"
echo "The AI model is loading now. That takes a minute or two, longer from a USB"
echo "stick; Lantern's page shows a progress bar until it is ready."
echo "Keep this window open: closing it stops Lantern's AI."
# shellcheck disable=SC2086
if [ -n "$MMPROJ" ]; then
  "$BIN" -m "$M" --mmproj "$MMPROJ" --path "$SITE" --host "$HOST" --port "$PORT" -c 8192 $NGL &
else
  "$BIN" -m "$M" --path "$SITE" --host "$HOST" --port "$PORT" -c 8192 $NGL &
fi
PID=$!
trap 'kill $PID $KPID 2>/dev/null' INT TERM EXIT
# Open Lantern as soon as the server answers (503 while the model loads):
# the page shows a progress bar and connects by itself when the model is
# ready. It is told the model's name and size and when the server started.
i=0
while [ $i -lt 60 ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/health" 2>/dev/null)
  if [ -n "$code" ] && [ "$code" != "000" ]; then break; fi
  sleep 0.5; i=$((i+1))
done
MBYTES=$(ls -ln "$M" 2>/dev/null | awk '{print $5}')
VBYTES=0
[ -n "$MMPROJ" ] && VBYTES=$(ls -ln "$MMPROJ" 2>/dev/null | awk '{print $5}')
URL="http://127.0.0.1:$PORT/?kit=1&model=$(basename "$M" | sed 's/ /%20/g')&bytes=${MBYTES:-0}&vbytes=${VBYTES:-0}&t=$T0"
if [ -z "${NO_BROWSER:-}" ]; then
  if [ "$OS" = mac ]; then open "$URL"; else xdg-open "$URL" >/dev/null 2>&1 || true; fi
fi
wait $PID
