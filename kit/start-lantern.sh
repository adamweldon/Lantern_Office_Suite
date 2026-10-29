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
# "Start Lantern (Linux).desktop" runs this from Lantern's own window
# (kit/lantern-kit.py) with LANTERN_UI=1: it follows along by @@ lines on
# stderr (MODEL, URL, PHONE, FAIL) and answers setup-kit's questions on stdin.
set -u
ui() { if [ -n "${LANTERN_UI:-}" ]; then printf '@@%s\n' "$*" >&2; fi; return 0; }
DIR="$(cd "$(dirname "$0")" && pwd)"
# Lantern itself: the Lantern folder's site/ (beside kit/, what Lantern.zip
# updates) first, else kit/site for a kit on its own.
SITE="$DIR/../site"; [ -f "$SITE/index.html" ] || SITE="$DIR/site"
[ -d "$SITE" ] && SITE=$(cd "$SITE" && pwd)
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
# This computer's engine folder: engine/linux-<cpu> when setup made one (a stick
# shared by computers with different CPUs), else engine/<os>.
ENG="$DIR/engine/$OS"
if [ "$OS" = linux ]; then
  A="$DIR/engine/linux-$(uname -m)"
  if [ -e "$A/llama-server" ] || [ -e "$A/kiwix/kiwix-serve" ]; then ENG="$A"; fi
fi
if [ ! -f "$SITE/index.html" ]; then
  echo "Lantern itself is not in this folder (no site/index.html beside start-lantern.sh or"
  echo "next to its folder). Run ./setup-kit.sh (Install Lantern) first: it downloads it."
  ui "FAIL nosite"; exit 1
fi
BIN="$ENG/llama-server"
[ -x "$BIN" ] || BIN="$(command -v llama-server 2>/dev/null || true)"
if [ -z "$BIN" ] || [ ! -x "$BIN" ]; then
  echo "llama-server not found. Run ./setup-kit.sh first (needs internet once)."; ui "FAIL noengine"; exit 1
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
  echo "No model in $MODELS. Run ./setup-kit.sh, or copy a .gguf file there."; ui "FAIL nomodel"; exit 1
fi
# Lantern Watch (kit/lantern-watch.py): is there room in FREE memory for this
# model right now, not just in total? If not, it asks (zenity, or a Mac dialog)
# or takes a smaller model and says why. It also gives the engine a gentler
# priority. Without python3 or the watcher, nothing changes.
LW="$DIR/lantern-watch.py"; LWPY=""; LWARGS=""
if [ -f "$LW" ]; then
  LWPY=$(command -v python3 2>/dev/null || true)
  # a Mac without its developer tools has only a python3 stub that pops up an installer
  if [ "$OS" = mac ] && [ "$LWPY" = /usr/bin/python3 ] && ! xcode-select -p >/dev/null 2>&1; then LWPY=""; fi
fi
if [ -n "$LWPY" ]; then
  LWF=""; if [ -n "$FORCE" ] || [ -n "${MODEL:-}" ]; then LWF="--forced"; fi
  LWV=""; [ -z "$VISION" ] && LWV="--no-vision"
  # shellcheck disable=SC2086
  LWOUT=$("$LWPY" "$LW" plan --model "$M" --models "$MODELS" $LWF $LWV) || LWOUT=""
  LWPICK=$(printf '%s\n' "$LWOUT" | sed -n 's/^PICK=//p' | head -n 1)
  LWARGS=$(printf '%s\n' "$LWOUT" | sed -n 's/^ARGS=//p' | head -n 1)
  if printf '%s\n' "$LWOUT" | grep -q '^STOP=1'; then
    echo "Stopped so other programs can be closed first. Start Lantern again when ready."
    ui "FAIL memory"; exit 0
  fi
  if [ -n "$LWPICK" ] && [ -f "$MODELS/$LWPICK" ]; then M="$MODELS/$LWPICK"; fi
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
ui "MODEL $(basename "$M")"
VER=$(grep -o 'version: "[0-9][0-9.]*"' "$SITE/index.html" 2>/dev/null | head -1 | cut -d'"' -f2)
echo "Lantern ${VER:-?} files: $SITE"
echo "  (to update: extract a newer Lantern.zip over the Lantern folder and replace the files)"
if [ -f "$DIR/site/index.html" ] && [ "$SITE" != "$DIR/site" ]; then echo "  (kit/site is a second copy and is not used; it can be deleted)"; fi
[ -n "$MMPROJ" ] && echo "Vision: $(basename "$MMPROJ") (the AI can look at the pictures it makes)"
echo "Open http://127.0.0.1:$PORT/ (this window must stay open; Ctrl+C stops it)"
if [ "$HOST" = 0.0.0.0 ]; then
  if [ "$OS" = mac ]; then IPS=$(ipconfig getifaddr en0 2>/dev/null; ipconfig getifaddr en1 2>/dev/null)
  else IPS=$(hostname -I 2>/dev/null); fi
  for ip in $IPS; do echo "Phones on this network: http://$ip:$PORT/"; ui "PHONE http://$ip:$PORT/"; done
fi

# The offline library: kiwix-serve on port 8081 with every ZIM in library/.
# Lantern finds it there by itself (AI app > Offline library).
KIWIX="$ENG/kiwix/kiwix-serve"; [ -x "$KIWIX" ] || KIWIX="$(command -v kiwix-serve 2>/dev/null || true)"
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
  "$BIN" -m "$M" --mmproj "$MMPROJ" --path "$SITE" --host "$HOST" --port "$PORT" -c 8192 $NGL $LWARGS &
else
  "$BIN" -m "$M" --path "$SITE" --host "$HOST" --port "$PORT" -c 8192 $NGL $LWARGS &
fi
PID=$!
# Lantern Watch tells the loading screen (and this terminal) what is really
# happening while the model loads: bytes read, speed, time left, memory.
WPID=""; LWQ=""
if [ -n "$LWPY" ]; then
  "$LWPY" "$LW" watch --model "$M" --mmproj "$MMPROJ" --port "$PORT" --status-port "${LANTERN_WATCH_PORT:-8082}" --engine-pid "$PID" &
  WPID=$!; LWQ="&watch=${LANTERN_WATCH_PORT:-8082}"
fi
# On the way out, stop the servers and wait for them, so the address is free
# again at once (Lantern's window restarts on it to share with phones).
trap 'kill $PID $KPID $WPID 2>/dev/null; wait' INT TERM EXIT
# Open Lantern as soon as the server answers (503 while the model loads):
# the page shows a progress bar and connects by itself when the model is
# ready. It is told the model's name and size and when the server started.
i=0
while [ $i -lt 60 ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/health" 2>/dev/null)
  if [ -n "$code" ] && [ "$code" != "000" ]; then break; fi
  kill -0 $PID 2>/dev/null || break   # the engine stopped at once: no need to wait for it
  sleep 0.5; i=$((i+1))
done
if ! kill -0 $PID 2>/dev/null; then
  wait $PID; rc=$?
  echo "The AI engine stopped (code $rc); the lines above say why. Run ./setup-kit.sh again: it checks the engine and can build one for this computer."
  ui "FAIL stopped"; exit 1
fi
MBYTES=$(ls -ln "$M" 2>/dev/null | awk '{print $5}')
VBYTES=0
[ -n "$MMPROJ" ] && VBYTES=$(ls -ln "$MMPROJ" 2>/dev/null | awk '{print $5}')
URL="http://127.0.0.1:$PORT/?kit=1&model=$(basename "$M" | sed 's/ /%20/g')&bytes=${MBYTES:-0}&vbytes=${VBYTES:-0}${LWQ}&t=$T0"
ui "URL $URL"
if [ -z "${NO_BROWSER:-}" ]; then
  if [ "$OS" = mac ]; then open "$URL"; else xdg-open "$URL" >/dev/null 2>&1 || true; fi
fi
wait $PID
