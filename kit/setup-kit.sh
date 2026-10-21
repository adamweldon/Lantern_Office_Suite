#!/bin/sh
# setup-kit.sh -- fetch the AI engine (llama.cpp) and models into this kit.
# Needs internet once; afterwards the kit works offline and can be copied.
#   ./setup-kit.sh              engine + the 4B model, then offers a bigger model
#                               when this computer can run one, then the offline
#                               encyclopedia -- everything in one go
#   ./setup-kit.sh phone        the two phone models (0.8B, 2B) -- to copy onto phones
#   ./setup-kit.sh laptop       Qwen3.5 4B   (8 GB computers)
#   ./setup-kit.sh big          Qwen3.5 9B   (16 GB computers)
#   ./setup-kit.sh xl           Qwen3.5 35B-A3B (32 GB computers; 17.5 GB file)
#   ./setup-kit.sh usb          engines for Windows, Mac and Linux + 0.8B, 2B, 4B, 9B (~10 GB)
#   ./setup-kit.sh library      an offline encyclopedia: kiwix-serve + English Wikipedia
#                               (lead sections, ~12 GB; Simple English ~2.5 GB if the
#                               drive is small or FAT32)
#   ./setup-kit.sh library-simple   Simple English Wikipedia (~2.5 GB)
#   ./setup-kit.sh library-full     the full English Wikipedia (every article, text
#                               without pictures, ~60 GB): explanation questions in
#                               Chat read whole articles; quick facts keep the small
#                               file. Offered once the small one is there; never
#                               downloaded unasked.
#   ./setup-kit.sh zim NAME     any Kiwix file by name (e.g. wikipedia_en_medicine_maxi)
#                               or full URL, into library/
#   ./setup-kit.sh check        what this computer can run and what the kit has
#   add "gpu" for the Vulkan engine builds (graphics card) on Windows/Linux
# start-lantern.sh runs "setup-kit.sh offer": when this computer can run a
# bigger model than the kit has, and there is room and internet, it asks once
# and downloads it in the background while Lantern starts.
# Overrides: LLAMA_BUILD (default b11435), LLAMA_BASE, HF_BASE, KIWIX_BASE (mirrors);
# LANTERN_AUTO_DOWNLOAD=0 never offer, =1 download without asking; for
# testing: LANTERN_MEM_MB, LANTERN_FS, LANTERN_FREE_GB.
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD="${LLAMA_BUILD:-b11435}"
LLAMA_BASE="${LLAMA_BASE:-https://github.com/ggml-org/llama.cpp/releases/download/$BUILD}"
HF_BASE="${HF_BASE:-https://huggingface.co}"
KIWIX_BASE="${KIWIX_BASE:-https://download.kiwix.org}"
MODELS="$DIR/models"; mkdir -p "$MODELS"
LIBRARY="$DIR/library"

fetch() {  # url dest -- resumes an interrupted download
  if [ -s "$2" ]; then echo "  have $(basename "$2")"; return 0; fi
  echo "  downloading $(basename "$2")"
  curl -L --fail --retry 3 -C - --progress-bar -o "$2.part" "$1"
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

# Models, best first: id, file-name pattern, name, repo, file, GB, memory (MB) needed.
TIERS="xl big laptop 2b 0.8b"
tier() {
  T_NOTE=""
  case "$1" in
    xl|35b) T_ID=xl; T_PAT=35B-A3B; T_NAME="Qwen3.5 35B-A3B"; T_REPO=unsloth/Qwen3.5-35B-A3B-GGUF; T_FILE=Qwen3.5-35B-A3B-UD-IQ4_XS.gguf; T_GB=17.5; T_MEM=28000
      T_NOTE="A mixture-of-experts model: 35B parameters of knowledge, but only about 3B work on each word, so it should run near the 4B's speed." ;;
    big|9b) T_ID=big; T_PAT=9B; T_NAME="Qwen3.5 9B"; T_REPO=unsloth/Qwen3.5-9B-GGUF; T_FILE=Qwen3.5-9B-Q4_K_M.gguf; T_GB=5.7; T_MEM=15000 ;;
    laptop|4b) T_ID=laptop; T_PAT=4B; T_NAME="Qwen3.5 4B"; T_REPO=unsloth/Qwen3.5-4B-GGUF; T_FILE=Qwen3.5-4B-Q4_K_M.gguf; T_GB=2.7; T_MEM=7000 ;;
    2b) T_ID=2b; T_PAT=2B; T_NAME="Qwen3.5 2B"; T_REPO=unsloth/Qwen3.5-2B-GGUF; T_FILE=Qwen3.5-2B-Q4_K_M.gguf; T_GB=1.3; T_MEM=5000 ;;
    0.8b) T_ID=0.8b; T_PAT=0.8B; T_NAME="Qwen3.5 0.8B"; T_REPO=unsloth/Qwen3.5-0.8B-GGUF; T_FILE=Qwen3.5-0.8B-Q4_K_M.gguf; T_GB=0.55; T_MEM=0 ;;
    *) return 1 ;;
  esac
}
get_tier() { tier "$1" && model "$T_REPO" "$T_FILE"; }
phone()  { get_tier 0.8b; get_tier 2b; }

# --- the offline library (Kiwix) -------------------------------------------------
LIBS="library library-simple"
libinfo() {
  case "$1" in
    library) L_ID=library; L_NAME="English Wikipedia (lead section of every article)"; L_FOLDER=wikipedia; L_BASE=wikipedia_en_all_mini; T_GB=12 ;;
    library-simple) L_ID=library-simple; L_NAME="Simple English Wikipedia"; L_FOLDER=wikipedia; L_BASE=wikipedia_en_simple_all_maxi; T_GB=2.5 ;;
    library-full) L_ID=library-full; L_NAME="the full English Wikipedia (every article, text without pictures)"; L_FOLDER=wikipedia; L_BASE=wikipedia_en_all_nopic; T_GB=60 ;;
    *) return 1 ;;
  esac
}
listing() { curl -sL --fail --max-time 30 "$1"; }
latest_zim() {  # folder base -> newest dated file name, e.g. wikipedia_en_all_mini_2026-06.zim
  listing "$KIWIX_BASE/zim/$1/" | grep -o "href=\"[^\"]*$2_[0-9]\{4\}-[0-9]\{2\}\.zim\"" | sed 's/^href="//; s/"$//; s#.*/##' | sort -u | tail -n 1
}
have_library() { ls "$LIBRARY"/*.zim >/dev/null 2>&1; }
have_full() { ls "$LIBRARY"/wikipedia_en_all_nopic_*.zim "$LIBRARY"/wikipedia_en_all_maxi_*.zim 2>/dev/null | grep -q .; }
# remote_gb url fallback -- the file's size on the server in GB (the full
# Wikipedia grows every release), or the fallback when it cannot be asked.
remote_gb() {
  g=$(curl -sIL --max-time 20 "$1" 2>/dev/null | tr -d '\r' | awk 'tolower($1) == "content-length:" { n = $2 } END { if (n > 0) printf "%.1f", n / 1073741824 }') || g=""
  [ -n "$g" ] && echo "$g" || echo "$2"
}
left_gb() {  # name gb -- what is still to download (a stopped download resumes)
  if [ -f "$LIBRARY/$1.part" ]; then
    awk -v g="$2" -v p="$(wc -c < "$LIBRARY/$1.part")" 'BEGIN { l = g - p / 1073741824; if (l < 0.1) l = 0.1; printf "%.1f", l }'
  else echo "$2"; fi
}
kiwix_plat() {
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) echo macos-arm64 ;; Darwin-*) echo macos-x86_64 ;;
    *-aarch64|*-arm64) echo linux-aarch64 ;; *) echo linux-x86_64 ;;
  esac
}
kiwix_tools() {
  case "$(uname -s)" in Darwin) kos=mac ;; *) kos=linux ;; esac
  kt="$DIR/engine/$kos/kiwix"
  if [ -x "$kt/kiwix-serve" ]; then echo "  have kiwix-serve"; return 0; fi
  plat=$(kiwix_plat); list=$(listing "$KIWIX_BASE/release/kiwix-tools/") || { echo "  could not list $KIWIX_BASE/release/kiwix-tools/"; return 1; }
  asset=$(printf '%s' "$list" | grep -o "href=\"[^\"]*kiwix-tools_$plat-[0-9][0-9.-]*\.tar\.gz\"" | sed 's/^href="//; s/"$//; s#.*/##' | sort -u | sort -V | tail -n 1)
  if [ -z "$asset" ] && [ "$plat" = macos-arm64 ]; then
    asset=$(printf '%s' "$list" | grep -o "href=\"[^\"]*kiwix-tools_macos-x86_64-[0-9][0-9.-]*\.tar\.gz\"" | sed 's/^href="//; s/"$//; s#.*/##' | sort -u | sort -V | tail -n 1)
  fi
  if [ -z "$asset" ]; then echo "  no kiwix-tools for $plat at $KIWIX_BASE/release/kiwix-tools/"; return 1; fi
  tmp=$(mktemp -d)
  fetch "$KIWIX_BASE/release/kiwix-tools/$asset" "$tmp/$asset"
  tar -xzf "$tmp/$asset" -C "$tmp"
  bin=$(find "$tmp" -type f -name kiwix-serve | head -n 1)
  if [ -z "$bin" ]; then echo "  no kiwix-serve inside $asset"; rm -rf "$tmp"; return 1; fi
  mkdir -p "$kt"; cp -R "$(dirname "$bin")"/. "$kt/"; chmod +x "$kt"/kiwix-* 2>/dev/null || true
  rm -rf "$tmp"
  echo "  kiwix-serve ready ($asset)"
}
get_zim() {  # url -- into library/, checked against the published SHA-256
  mkdir -p "$LIBRARY"; f=$(basename "$1"); dest="$LIBRARY/$f"; fresh=1
  [ -s "$dest" ] && fresh=""
  fetch "$1" "$dest"
  [ -n "$fresh" ] || return 0
  want=$(listing "$1.sha256" 2>/dev/null | awk '{ print tolower($1); exit }') || want=""
  if printf '%s' "$want" | grep -qE '^[0-9a-f]{64}$'; then
    echo "  checking $f (SHA-256)..."
    if command -v sha256sum >/dev/null 2>&1; then got=$(sha256sum "$dest" | awk '{print $1}'); else got=$(shasum -a 256 "$dest" | awk '{print $1}'); fi
    if [ "$got" != "$want" ]; then rm -f "$dest"; echo "  $f is damaged (checksum differs); deleted -- run setup again"; return 1; fi
    echo "  checksum OK"
  else echo "  (no published checksum for $f)"; fi
}
pick_lib() { for id in $LIBS; do libinfo "$id"; if [ -z "$(no_room)" ]; then echo "$id"; return 0; fi; done; return 1; }
get_library() {
  libinfo "$1" || return 1
  kiwix_tools
  name=$(latest_zim "$L_FOLDER" "$L_BASE")
  if [ -z "$name" ]; then echo "  no $L_BASE file listed at $KIWIX_BASE/zim/$L_FOLDER/"; return 1; fi
  echo "  $L_NAME: $name"
  get_zim "$KIWIX_BASE/zim/$L_FOLDER/$name"
}
get_zim_name() {
  kiwix_tools
  case "$1" in
    http://*|https://*) get_zim "$1" ;;
    *) folder=${1%%_*}; base=$(printf '%s' "$1" | sed 's/_[0-9]\{4\}-[0-9]\{2\}\(\.zim\)\{0,1\}$//')
       name=$(latest_zim "$folder" "$base")
       if [ -z "$name" ]; then echo "  no $base file listed at $KIWIX_BASE/zim/$folder/"; return 1; fi
       get_zim "$KIWIX_BASE/zim/$folder/$name" ;;
  esac
}

# --- what this computer can run ---------------------------------------------
mem_mb() {
  if [ -n "${LANTERN_MEM_MB:-}" ]; then echo "$LANTERN_MEM_MB"; return; fi
  case "$(uname -s)" in
    Darwin) echo $(( $(sysctl -n hw.memsize) / 1048576 )) ;;
    *) awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo ;;
  esac
}
have() { ls "$MODELS"/*"$1"*.gguf 2>/dev/null | grep -v -i mmproj | grep -q . ; }
free_gb() {
  if [ -n "${LANTERN_FREE_GB:-}" ]; then echo "$LANTERN_FREE_GB"; return; fi
  df -Pk "$MODELS" 2>/dev/null | awk 'NR==2 {printf "%.1f", $4/1048576}'
}
fs_type() {
  if [ -n "${LANTERN_FS:-}" ]; then echo "$LANTERN_FS"; return; fi
  case "$(uname -s)" in
    Darwin) mp=$(df "$MODELS" | awk 'NR==2 {print $NF}'); mount | awk -v mp="$mp" '$3 == mp {print $4}' | tr -d '(,' ;;
    *) stat -f -c %T "$MODELS" 2>/dev/null || true ;;
  esac
}
busy() {  # a download of this model already running?
  lock="$MODELS/.downloading-$1"
  [ -f "$lock" ] || return 1
  if kill -0 "$(cat "$lock" 2>/dev/null)" 2>/dev/null; then return 0; fi
  rm -f "$lock"; return 1
}
no_room() {  # prints why this model cannot go on this drive, or nothing
  fs=$(fs_type); fr=$(free_gb)
  if awk -v g="$T_GB" 'BEGIN { exit !(g >= 4) }' && printf '%s' "$fs" | grep -qiE '^(msdos|vfat|fat)'; then
    echo "this drive is FAT32, which cannot hold files over 4 GB (reformat the stick as exFAT to use it)"; return
  fi
  if [ -n "$fr" ] && awk -v g="$T_GB" -v f="$fr" 'BEGIN { exit !(f < g + 1) }'; then
    echo "it needs $(awk -v g="$T_GB" 'BEGIN { print g + 1 }') GB free and this drive has $fr GB"
  fi
}
ask() {  # prints yes / no / nothing (no keyboard). "ask optin": a very large
  # download -- only Y says yes; no answer means not now (asked next time).
  if [ "${LANTERN_AUTO_DOWNLOAD:-}" = 1 ]; then echo yes; return; fi
  if [ ! -t 0 ]; then echo "  (no keyboard here, so not now)" >&2; return; fi
  if [ "${1:-}" = optin ]; then d="not now"; else d="yes"; fi
  printf "  Download it now?  Y = yes   N = no, and don't ask again   (%s in 30 s) " "$d" >&2
  if command -v bash >/dev/null 2>&1; then a=$(bash -c 'read -r -t 30 a; echo "$a"'); else read -r a; fi
  case "$a" in n*|N*) echo no ;; y*|Y*) echo yes ;; *) [ "${1:-}" = optin ] || echo yes ;; esac
}
# reach: prints why the model site cannot give this file, or nothing. It does
# NOT follow the redirect: Hugging Face sends large files from signed storage
# links that answer only a real download, so a check that followed it with a
# HEAD request failed and the kit wrongly thought it was offline (1.8.5).
reach() {
  code=$(curl -s -o /dev/null -I --max-time 15 -w '%{http_code}' "$HF_BASE/$T_REPO/resolve/main/$T_FILE" 2>/dev/null || true)
  case "$code" in
    2??|3??) ;;
    ""|000) echo "no connection to $(echo "$HF_BASE" | sed 's#^[a-z]*://##; s#/.*##')" ;;
    *) echo "the model site answered $code for $T_FILE" ;;
  esac
}
# plan: what to offer. Sets P_ID (model to offer, or empty), P_WHY (why
# nothing), P_OFFLINE, and P_NOTES (bigger models passed over, one a line).
plan() {
  P_ID=""; P_WHY="nothing more suits this computer"; P_NOTES=""; P_OFFLINE=""; P_BUSY=""
  mem=$(mem_mb)
  for id in $TIERS; do
    tier "$id"
    [ "$mem" -ge "$T_MEM" ] || continue
    if have "$T_PAT"; then P_WHY="the kit already has $T_NAME"; return 0; fi
    if busy "$T_ID"; then P_WHY="$T_NAME is still downloading (see models/download-$T_ID.log)"; P_BUSY=1; return 0; fi
    if [ -f "$MODELS/.skip-$T_ID" ]; then
      P_NOTES="$P_NOTES$T_NAME: you answered N before (delete models/.skip-$T_ID to be asked again)
"; continue
    fi
    why=$(no_room)
    if [ -n "$why" ]; then P_NOTES="$P_NOTES$T_NAME would suit this computer, but $why
"; continue; fi
    net=$(reach)
    if [ -n "$net" ]; then P_WHY="could not check for $T_NAME: $net"; P_OFFLINE=1; return 0; fi
    P_ID=$T_ID; P_WHY=""; return 0
  done
}
offer() {  # inline: 1 = download here, else in the background
  [ "${LANTERN_AUTO_DOWNLOAD:-}" = 0 ] && return 0
  shown=""
  while :; do
    plan
    old_ifs=$IFS; IFS='
'
    for n in $P_NOTES; do
      case "$shown" in *"[$n]"*) ;; *) echo "  $n."; shown="$shown[$n]" ;; esac
    done
    IFS=$old_ifs
    if [ -z "$P_ID" ]; then
      if [ -n "$P_OFFLINE" ]; then echo "  ($P_WHY; starting with the model the kit has.)"; return 0; fi
      if [ -z "$P_BUSY" ]; then offer_library "${1:-}"; if have_library; then offer_full "${1:-}"; fi; fi
      return 0
    fi
    tier "$P_ID"; mem=$(mem_mb)
    echo ""
    echo "  This computer has $(( mem / 1024 )) GB of memory: it can run $T_NAME ($T_GB GB download),"
    echo "  a stronger model than any in this kit. $T_NOTE"
    ans=$(ask)
    [ -n "$ans" ] || return 0
    if [ "$ans" = no ]; then
      : > "$MODELS/.skip-$T_ID"
      shown="$shown[$T_NAME: you answered N before (delete models/.skip-$T_ID to be asked again)]"
      echo "  Not asking again. To get it later: ./setup-kit.sh $T_ID"; continue
    fi
    if [ "${1:-}" = 1 ]; then   # setup: download it here, then look again (the library comes next)
      get_tier "$T_ID"
      if ! have "$T_PAT"; then echo "  $T_NAME did not download properly; run ./setup-kit.sh $T_ID to try again."; return 0; fi
      continue
    fi
    nohup "$DIR/setup-kit.sh" get "$T_ID" > "$MODELS/download-$T_ID.log" 2>&1 &
    echo "  Downloading in the background (progress: models/download-$T_ID.log)."
    echo "  Lantern starts now with the model it has; start it again when the download is done."
    return 0
  done
}
# library_plan: once the kit has the right model, the encyclopedia (asked once).
library_plan() {
  LP_ID=""
  if have_library; then LP_WHY="the kit has a library"; return 0; fi
  if [ -f "$MODELS/.skip-library" ]; then LP_WHY="you answered N before (delete models/.skip-library to be asked again)"; return 0; fi
  if busy library; then LP_WHY="the library is still downloading (see models/download-library.log)"; return 0; fi
  LP_ID=$(pick_lib) || { LP_ID=""; LP_WHY="there is no room on this drive for an encyclopedia"; return 0; }
  LP_WHY=""
}
offer_library() {
  library_plan
  if [ -z "$LP_ID" ]; then case "$LP_WHY" in *downloading*) echo "  The $LP_WHY." ;; esac; return 0; fi
  libinfo "$LP_ID"
  listing "$KIWIX_BASE/zim/$L_FOLDER/" >/dev/null 2>&1 || return 0
  echo ""
  echo "  Lantern can also keep an offline encyclopedia for the AI to read: $L_NAME,"
  echo "  about $T_GB GB. Fact questions are then answered from it, with quotes Lantern checks."
  ans=$(ask)
  [ -n "$ans" ] || return 0
  if [ "$ans" = no ]; then : > "$MODELS/.skip-library"; echo "  Not asking again. To get it later: ./setup-kit.sh library"; return 0; fi
  if [ "${1:-}" = 1 ]; then get_library "$LP_ID"; return 0; fi
  nohup "$DIR/setup-kit.sh" get "$LP_ID" > "$MODELS/download-library.log" 2>&1 &
  echo "  Downloading in the background (progress: models/download-library.log)."
  echo "  Start Lantern again when it is done to use the library."
}
# full_plan: the full Wikipedia, offered (opt-in) once the kit has the small
# one. Sets FP_URL (empty when not offered), FP_GB, FP_WHY.
full_plan() {
  FP_URL=""; FP_GB=""; FP_WHY=""
  libinfo library-full
  if have_full; then FP_WHY="the kit has the full Wikipedia"; return 0; fi
  if ! have_library; then FP_WHY="the small encyclopedia comes first"; return 0; fi
  if [ -f "$MODELS/.skip-library-full" ]; then FP_WHY="you answered N before (delete models/.skip-library-full to be asked again)"; return 0; fi
  if busy library-full; then FP_WHY="the full Wikipedia is still downloading (see models/download-library-full.log)"; return 0; fi
  name=$(latest_zim "$L_FOLDER" "$L_BASE" 2>/dev/null) || name=""
  if [ -z "$name" ]; then FP_WHY="could not reach $KIWIX_BASE"; return 0; fi
  FP_GB=$(remote_gb "$KIWIX_BASE/zim/$L_FOLDER/$name" "$T_GB")
  T_GB=$(left_gb "$name" "$FP_GB"); why=$(no_room)
  if [ -n "$why" ]; then FP_WHY="the full Wikipedia ($FP_GB GB) would not fit: $why"; return 0; fi
  FP_URL="$KIWIX_BASE/zim/$L_FOLDER/$name"
}
get_full() {
  if have_full; then echo "  have the full Wikipedia"; return 0; fi
  libinfo library-full
  name=$(latest_zim "$L_FOLDER" "$L_BASE")
  if [ -z "$name" ]; then echo "  no $L_BASE file listed at $KIWIX_BASE/zim/$L_FOLDER/"; return 1; fi
  gb=$(remote_gb "$KIWIX_BASE/zim/$L_FOLDER/$name" "$T_GB")
  T_GB=$(left_gb "$name" "$gb"); why=$(no_room)
  if [ -n "$why" ]; then echo "  The full Wikipedia ($gb GB) would not fit: $why."; return 1; fi
  kiwix_tools || return 1
  echo "  The full English Wikipedia: $name ($gb GB; this takes hours -- an interrupted download resumes where it stopped)"
  get_zim "$KIWIX_BASE/zim/$L_FOLDER/$name"
}
offer_full() {  # never unasked: not in unattended set-ups
  case "${LANTERN_AUTO_DOWNLOAD:-}" in 0|1) return 0 ;; esac
  full_plan
  [ -n "$FP_URL" ] || return 0
  echo ""
  echo "  Lantern can also keep the FULL English Wikipedia: every article, text without pictures,"
  echo "  about $FP_GB GB (a long download -- hours). Explanation questions in Chat (\"explain\","
  echo "  \"in detail\", \"how does\") are then read from whole articles; quick facts keep the small file."
  ans=$(ask optin)
  [ -n "$ans" ] || return 0
  if [ "$ans" = no ]; then : > "$MODELS/.skip-library-full"; echo "  Not asking again. To get it later: ./setup-kit.sh library-full"; return 0; fi
  if [ "${1:-}" = 1 ]; then get_full; return 0; fi
  nohup "$DIR/setup-kit.sh" get library-full > "$MODELS/download-library-full.log" 2>&1 &
  echo "  Downloading in the background (progress: models/download-library-full.log; it resumes if stopped)."
  echo "  Start Lantern again when it is done."
}
check() {
  mem=$(mem_mb)
  echo "Memory: $(awk -v m="$mem" 'BEGIN { printf "%.1f", m / 1024 }') GB"
  echo "Drive: $(fs_type), $(free_gb) GB free"
  echo "Kit folder: $DIR"
  for id in $TIERS; do
    tier "$id"
    if [ "$mem" -ge "$T_MEM" ]; then fits="runs here"; else fits="needs $(( T_MEM / 1024 )) GB memory"; fi
    if have "$T_PAT"; then h="in kit"; else h="not in kit"; fi
    printf "  %-17s%-9s%-22s%s\n" "$T_NAME" "$T_GB GB" "$fits" "$h"
  done
  plan
  printf '%s' "$P_NOTES" | sed 's/^/  /; s/$/./'
  case "$(uname -s)" in Darwin) kos=mac ;; *) kos=linux ;; esac
  if have_library; then
    for z in "$LIBRARY"/*.zim; do
      printf 'Library: %s (%s)%s\n' "$(basename "$z")" "$(du -h "$z" | awk '{print $1}')" "$([ -x "$DIR/engine/$kos/kiwix/kiwix-serve" ] || echo ' -- kiwix-serve missing: ./setup-kit.sh library')"
    done
  else echo "Library: none (./setup-kit.sh library adds an offline encyclopedia)"; fi
  if [ "${LANTERN_AUTO_DOWNLOAD:-}" = 0 ]; then echo "Next start: offers nothing (LANTERN_AUTO_DOWNLOAD=0)."
  elif [ -n "$P_ID" ]; then tier "$P_ID"; echo "Next start: will offer $T_NAME ($T_GB GB). Or fetch it now: ./setup-kit.sh $T_ID"
  elif [ -n "$P_OFFLINE" ] || [ -n "$P_BUSY" ]; then echo "Next start: offers nothing: $P_WHY."
  else
    library_plan
    if [ -n "$LP_ID" ]; then libinfo "$LP_ID"; echo "Next start: will offer the encyclopedia ($L_NAME, about $T_GB GB). Or fetch it now: ./setup-kit.sh library"
    else echo "Next start: offers nothing: $P_WHY; library: $LP_WHY."; fi
  fi
  if have_library && ! have_full; then
    full_plan
    if [ -n "$FP_URL" ]; then echo "Full Wikipedia: not in the kit; about $FP_GB GB and there is room. Get it: ./setup-kit.sh library-full"
    else echo "Full Wikipedia: not in the kit ($FP_WHY)."; fi
  fi
}

GPU=""; SETS=""
for a in "$@"; do case "$a" in gpu) GPU=1 ;; *) SETS="$SETS $a" ;; esac; done
set -- $SETS
case "${1:-}" in
  offer) offer 0 || true; exit 0 ;;
  check) check; exit 0 ;;
  get)   # one model or the library, in the background (from offer)
    if [ "${2:-}" = library-full ]; then
      echo $$ > "$MODELS/.downloading-library-full"
      trap 'rm -f "$MODELS/.downloading-library-full"' EXIT
      get_full || true
      echo "Done. Stop Lantern (Ctrl+C) and start it again to use the full Wikipedia."
      exit 0
    fi
    if libinfo "${2:-}"; then
      echo $$ > "$MODELS/.downloading-library"
      trap 'rm -f "$MODELS/.downloading-library"' EXIT
      echo "Downloading $L_NAME (about $T_GB GB) into the kit. Lantern keeps working meanwhile."
      get_library "$L_ID"
      echo "Done. Stop Lantern (Ctrl+C) and start it again to use the library."
      exit 0
    fi
    tier "${2:-}" || exit 1
    echo $$ > "$MODELS/.downloading-$T_ID"
    trap 'rm -f "$MODELS/.downloading-$T_ID"' EXIT
    echo "Downloading $T_NAME ($T_GB GB) into the kit. Lantern keeps working meanwhile."
    get_tier "$T_ID"
    echo "Done. Stop Lantern (Ctrl+C) and start it again to use $T_NAME."
    exit 0 ;;
esac
LNX="llama-$BUILD-bin-ubuntu-x64.tar.gz"; WIN="llama-$BUILD-bin-win-cpu-x64.zip"
if [ -n "$GPU" ]; then LNX="llama-$BUILD-bin-ubuntu-vulkan-x64.tar.gz"; WIN="llama-$BUILD-bin-win-vulkan-x64.zip"; fi
case "$(uname -m)" in aarch64|arm64) LNX="llama-$BUILD-bin-ubuntu-arm64.tar.gz"; MACA="llama-$BUILD-bin-macos-arm64.tar.gz" ;;
  *) MACA="llama-$BUILD-bin-macos-x64.tar.gz" ;; esac

echo "Lantern kit setup (llama.cpp $BUILD)"
case "$(uname -s)" in
  Darwin) OS=mac; THIS="$MACA" ;;
  *) OS=linux; THIS="$LNX" ;;
esac
if [ -z "$SETS" ]; then
  engine "$OS" "$THIS"
  if [ "$(mem_mb)" -ge 7000 ]; then get_tier laptop; else phone; fi
  offer 1 || true
fi
ZIMNEXT=""
for s in $SETS; do
  if [ -n "$ZIMNEXT" ]; then ZIMNEXT=""; get_zim_name "$s"; continue; fi
  case "$s" in
    zim) ZIMNEXT=1 ;;
    library) if lid=$(pick_lib); then get_library "$lid"; else echo "  No room for an encyclopedia on this drive."; fi ;;
    library-simple) get_library library-simple ;;
    library-full) get_full || true ;;
    phone) phone ;;
    usb) engine linux "$LNX"; engine windows "$WIN"; engine mac "llama-$BUILD-bin-macos-arm64.tar.gz"; phone; get_tier laptop; get_tier big ;;
    engine) engine "$OS" "$THIS" ;;
    *) if tier "$s"; then get_tier "$s"; else echo "unknown option: $s"; fi ;;
  esac
done
echo "Done. Start Lantern with ./start-lantern.sh (or start-lantern.bat on Windows)."
